"""
Image processing helpers for the Electron bridge.
"""

import os
from io import BytesIO
from typing import Callable, List, Optional, Sequence, Tuple

from PIL import Image, ImageDraw, ImageOps


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp", ".gif"}


def is_supported_image(filepath: str) -> bool:
    """Return whether a file extension is supported by the app."""
    ext = os.path.splitext(filepath)[1].lower()
    return ext in SUPPORTED_EXTENSIONS


def has_exif(filepath: str) -> bool:
    """Return whether an image has EXIF metadata."""
    try:
        with Image.open(filepath) as img:
            return bool(img.getexif())
    except Exception:
        return False


def remove_exif(filepath: str, output_path: Optional[str] = None) -> str:
    """
    Remove EXIF data from an image file.

    If output_path is None, the original file is overwritten.
    """
    if output_path is None:
        output_path = filepath

    with Image.open(filepath) as img:
        if _is_unsupported_multiframe(img):
            raise ValueError("Multi-frame GIF/TIFF files are not supported.")

        clean_img = ImageOps.exif_transpose(img)
        clean_img.load()

        icc = img.info.get("icc_profile")
        save_kwargs = {}
        if icc:
            save_kwargs["icc_profile"] = icc

        ext = os.path.splitext(output_path)[1].lower()
        if ext in (".jpg", ".jpeg"):
            save_kwargs["quality"] = 95
            save_kwargs["subsampling"] = 0
            clean_img.save(output_path, "JPEG", **save_kwargs)
        elif ext == ".png":
            clean_img.save(output_path, "PNG", **save_kwargs)
        elif ext == ".webp":
            save_kwargs["quality"] = 95
            clean_img.save(output_path, "WEBP", **save_kwargs)
        else:
            clean_img.save(output_path, **save_kwargs)

    return output_path


def _is_unsupported_multiframe(img: Image.Image) -> bool:
    """Return True for multi-frame formats that are not safely processed."""
    try:
        return getattr(img, "n_frames", 1) > 1
    except Exception:
        return False


def _fix_orientation(img: Image.Image) -> Image.Image:
    """Apply EXIF orientation when Pillow can read it."""
    try:
        return ImageOps.exif_transpose(img)
    except Exception:
        return img


def create_thumbnail(filepath: str, size: Tuple[int, int] = (200, 200)) -> Optional[bytes]:
    """Create a PNG thumbnail for renderer previews."""
    try:
        with Image.open(filepath) as img:
            img = _fix_orientation(img)
            img.thumbnail(size, Image.LANCZOS)
            buf = BytesIO()
            img.save(buf, format="PNG")
            return buf.getvalue()
    except Exception:
        return None


def create_custom_grid_image(
    image_paths: List[str],
    rows: int,
    cols: int,
    cells: Sequence[dict],
    output_size: Tuple[int, int] = (1600, 2000),
    gap: int = 24,
    bg_color: Tuple[int, int, int] = (16, 17, 20),
    round_corners: bool = True,
    radius: int = 12,
    image_crops: Optional[Sequence[dict]] = None,
    error_callback: Optional[Callable[[str, Exception], None]] = None,
) -> Image.Image:
    """
    Create a custom grid image from renderer cell dictionaries.

    Cell dictionaries use zero-based grid units:
    {"row": 0, "col": 0, "rowSpan": 2, "colSpan": 1, "imageIndex": 0}
    """
    if rows < 1 or cols < 1:
        raise ValueError("rows and cols must be at least 1.")

    output_width, output_height = output_size
    if output_width < 1 or output_height < 1:
        raise ValueError("output_size must contain positive dimensions.")

    safe_gap = max(0, int(gap))
    cell_w = (output_width - (cols + 1) * safe_gap) / cols
    cell_h = (output_height - (rows + 1) * safe_gap) / rows
    if cell_w <= 0 or cell_h <= 0:
        raise ValueError("gap is too large for the requested output size.")

    canvas = Image.new("RGB", (output_width, output_height), bg_color)

    for visual_index, cell in enumerate(cells):
        row = int(cell.get("row", 0))
        col = int(cell.get("col", 0))
        row_span = int(cell.get("rowSpan", 1))
        col_span = int(cell.get("colSpan", 1))
        raw_image_index = cell.get("imageIndex", visual_index)
        image_index = -1 if raw_image_index is None else int(raw_image_index)

        if row < 0 or col < 0 or row_span < 1 or col_span < 1:
            continue
        if row + row_span > rows or col + col_span > cols:
            continue

        x = round(safe_gap + col * (cell_w + safe_gap))
        y = round(safe_gap + row * (cell_h + safe_gap))
        x2 = round(safe_gap + (col + col_span) * cell_w + (col + col_span - 1) * safe_gap)
        y2 = round(safe_gap + (row + row_span) * cell_h + (row + row_span - 1) * safe_gap)
        w = max(1, x2 - x)
        h = max(1, y2 - y)

        if image_index < 0 or image_index >= len(image_paths):
            _draw_empty_cell(canvas, x, y, w, h)
            continue

        try:
            crop_focus = _crop_focus_for_index(image_crops, image_index)
            img = _fit_image_to_cell(image_paths[image_index], w, h, crop_focus)
            if round_corners:
                img = _add_rounded_corners(
                    img,
                    radius=max(0, int(radius)),
                    bg_color=bg_color,
                )
            canvas.paste(img, (x, y))
        except Exception as e:
            if error_callback:
                error_callback(image_paths[image_index], e)
            _draw_empty_cell(canvas, x, y, w, h, label="Error")

    return canvas


def _crop_focus_for_index(image_crops: Optional[Sequence[dict]], image_index: int) -> Tuple[float, float]:
    """Return a normalized crop focus point for one image index."""
    if not image_crops or image_index >= len(image_crops):
        return (0.5, 0.5)
    crop = image_crops[image_index] or {}
    return (
        _clamp_float(crop.get("cropX", 0.5), 0.0, 1.0),
        _clamp_float(crop.get("cropY", 0.5), 0.0, 1.0),
    )


def _fit_image_to_cell(
    filepath: str,
    width: int,
    height: int,
    crop_focus: Tuple[float, float] = (0.5, 0.5),
) -> Image.Image:
    """Open, orient, crop, and resize an image so it fills one grid cell."""
    with Image.open(filepath) as img:
        img = _fix_orientation(img)
        img = img.convert("RGB")

        img_ratio = img.width / img.height
        cell_ratio = width / height

        if img_ratio > cell_ratio:
            new_h = img.height
            new_w = int(new_h * cell_ratio)
            left = int(round((img.width - new_w) * crop_focus[0]))
            img = img.crop((left, 0, left + new_w, new_h))
        else:
            new_w = img.width
            new_h = int(new_w / cell_ratio)
            top = int(round((img.height - new_h) * crop_focus[1]))
            img = img.crop((0, top, new_w, top + new_h))

        return img.resize((width, height), Image.LANCZOS)


def _clamp_float(value, minimum: float, maximum: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = minimum
    return max(minimum, min(maximum, parsed))


def _draw_empty_cell(
    canvas: Image.Image,
    x: int,
    y: int,
    width: int,
    height: int,
    label: str = "",
) -> None:
    """Draw a quiet placeholder for empty or failed custom-grid cells."""
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([x, y, x + width, y + height], fill=(28, 31, 37))
    draw.rectangle([x, y, x + width, y + height], outline=(55, 60, 69), width=1)
    if label:
        draw.text((x + width // 2 - 18, y + height // 2 - 6), label, fill=(190, 190, 190))


def _add_rounded_corners(
    img: Image.Image,
    radius: int,
    bg_color: Tuple[int, int, int] = (16, 17, 20),
) -> Image.Image:
    """Add rounded corners to an image."""
    radius = max(0, min(int(radius), min(img.size) // 2))
    if radius <= 0:
        return img

    mask = Image.new("L", img.size, 255)
    draw = ImageDraw.Draw(mask)

    draw.rectangle([0, 0, radius, radius], fill=0)
    draw.rectangle([img.width - radius, 0, img.width, radius], fill=0)
    draw.rectangle([0, img.height - radius, radius, img.height], fill=0)
    draw.rectangle([img.width - radius, img.height - radius, img.width, img.height], fill=0)

    draw.ellipse([0, 0, radius * 2, radius * 2], fill=255)
    draw.ellipse([img.width - radius * 2, 0, img.width, radius * 2], fill=255)
    draw.ellipse([0, img.height - radius * 2, radius * 2, img.height], fill=255)
    draw.ellipse([img.width - radius * 2, img.height - radius * 2, img.width, img.height], fill=255)

    result = Image.new("RGB", img.size, bg_color)
    result.paste(img, mask=mask)
    return result


def batch_remove_exif(
    filepaths: List[str],
    output_dir: str,
    flags: List[bool],
    conflict_mode: str = "rename",
    progress_callback=None,
    error_callback=None,
) -> List[str]:
    """
    Batch remove EXIF from selected files.

    conflict_mode="rename" appends a number, while "replace" overwrites the target.
    """
    os.makedirs(output_dir, exist_ok=True)
    results = []

    for i, fp in enumerate(filepaths):
        should_remove = flags[i] if i < len(flags) else False

        if should_remove:
            filename = os.path.basename(fp)
            base, ext = os.path.splitext(filename)
            output_path = str(os.path.join(output_dir, f"NOEXIF_{base}{ext}"))

            if conflict_mode != "replace":
                counter = 1
                while os.path.exists(output_path):
                    output_path = str(os.path.join(output_dir, f"NOEXIF_{base}_{counter}{ext}"))
                    counter += 1

            try:
                remove_exif(str(fp), output_path)
                results.append(output_path)
            except Exception as e:
                if error_callback:
                    error_callback(str(fp), e)

        if progress_callback:
            progress_callback(i + 1, len(filepaths))

    return results
