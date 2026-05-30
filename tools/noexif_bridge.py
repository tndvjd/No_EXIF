"""
JSON bridge used by the Electron No EXIF Pro app.

Commands read one JSON object from stdin and write one JSON object to stdout.
This keeps the desktop shell small while preserving the existing Pillow engine.
"""

import base64
import json
import os
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.image_processor import (  # noqa: E402
    batch_remove_exif,
    create_custom_grid_image,
    create_thumbnail,
    has_exif,
    is_supported_image,
)


def _configure_stdio() -> None:
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(encoding="utf-8", errors="replace")


_configure_stdio()

GPS_INFO_TAG = 34853
EXIF_IFD_TAG = 34665
COMFYUI_TEXT_KEYS = ("prompt", "workflow")
SUPPORTED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".tif",
    ".tiff",
    ".webp",
    ".gif",
}
PRIVACY_EXIF_TAGS = {
    271: "Camera make",
    272: "Camera model",
    305: "Software",
    306: "Date/time",
    315: "Artist",
    316: "Host computer",
    33432: "Copyright",
    36867: "Original date/time",
    GPS_INFO_TAG: "GPS location",
}


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def _write_payload(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))
    sys.stdout.flush()


def _image_data_url(path: str, size: tuple[int, int]) -> str:
    thumb = create_thumbnail(path, size)
    if not thumb:
        return ""
    encoded = base64.b64encode(thumb).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _thumb_data_url(path: str) -> str:
    return _image_data_url(path, (420, 320))


def _preview_data_url(path: str) -> str:
    return _image_data_url(path, (1280, 1280))


def _decode_bytes(value: bytes) -> str:
    if value.startswith(b"UNICODE\x00"):
        try:
            return value[8:].decode("utf-16-be", errors="replace").rstrip("\x00")
        except UnicodeDecodeError:
            pass
    if value.startswith(b"ASCII\x00\x00\x00"):
        return value[8:].decode("ascii", errors="replace").rstrip("\x00")
    for encoding in ("utf-8-sig", "utf-16-le", "cp949", "latin-1"):
        try:
            return value.decode(encoding).rstrip("\x00")
        except UnicodeDecodeError:
            continue
    return value.decode("utf-8", errors="replace").rstrip("\x00")


def _json_safe(value):
    if isinstance(value, bytes):
        return _decode_bytes(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    try:
        return float(value)
    except (TypeError, ValueError):
        return str(value)


def _parse_json_text(value):
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _file_metadata(path: str) -> dict:
    stat = os.stat(path)
    return {
        "path": path,
        "name": os.path.basename(path),
        "extension": os.path.splitext(path)[1].lower(),
        "sizeBytes": stat.st_size,
        "modifiedTime": stat.st_mtime,
    }


def _collect_exif_tags(img: Image.Image) -> tuple[list, dict]:
    exif = img.getexif()
    tags = []
    by_id = {}

    for tag_id, value in exif.items():
        if tag_id == GPS_INFO_TAG:
            continue
        name = TAGS.get(tag_id, f"Tag {tag_id}")
        safe_value = _json_safe(value)
        tags.append({"id": tag_id, "name": name, "value": safe_value})
        by_id[tag_id] = safe_value

    try:
        gps_ifd = exif.get_ifd(GPS_INFO_TAG)
    except Exception:
        gps_ifd = {}
    if gps_ifd:
        gps_tags = []
        for tag_id, value in gps_ifd.items():
            gps_tags.append(
                {
                    "id": tag_id,
                    "name": GPSTAGS.get(tag_id, f"GPS Tag {tag_id}"),
                    "value": _json_safe(value),
                }
            )
        tags.append({"id": GPS_INFO_TAG, "name": "GPSInfo", "value": gps_tags})
        by_id[GPS_INFO_TAG] = gps_tags

    try:
        nested_exif = exif.get_ifd(EXIF_IFD_TAG)
    except Exception:
        nested_exif = {}
    for tag_id, value in nested_exif.items():
        if tag_id in by_id:
            continue
        name = TAGS.get(tag_id, f"Tag {tag_id}")
        safe_value = _json_safe(value)
        tags.append({"id": tag_id, "name": name, "value": safe_value})
        by_id[tag_id] = safe_value

    tags.sort(key=lambda item: (item["name"], item["id"]))
    return tags, by_id


def _privacy_fields(exif_by_id: dict) -> list:
    fields = []
    for tag_id, label in PRIVACY_EXIF_TAGS.items():
        if tag_id in exif_by_id:
            fields.append(
                {
                    "id": tag_id,
                    "label": label,
                    "value": exif_by_id[tag_id],
                }
            )
    return fields


def _text_entries(img: Image.Image) -> list:
    entries = []
    for key, value in img.info.items():
        if key in ("exif", "icc_profile"):
            continue
        if isinstance(value, bytes):
            text = _decode_bytes(value)
        elif isinstance(value, str):
            text = value
        else:
            continue
        entries.append({"key": key, "value": text})
    entries.sort(key=lambda item: item["key"])
    return entries


def _comfyui_metadata(entries: list) -> dict:
    by_key = {entry["key"]: entry["value"] for entry in entries}
    prompt_key, prompt = _find_text_entry(by_key, "prompt")
    workflow_key, workflow = _find_text_entry(by_key, "workflow")
    prompt_json = _parse_json_text(prompt)
    workflow_json = _parse_json_text(workflow)
    keys = [key for key in (prompt_key, workflow_key) if key]

    return {
        "present": bool(keys),
        "keys": keys,
        "prompt": prompt,
        "promptJson": prompt_json,
        "workflow": workflow,
        "workflowJson": workflow_json,
    }


def _find_text_entry(by_key: dict, expected_key: str) -> tuple:
    for key, value in by_key.items():
        if key.lower() == expected_key:
            return key, value
    return None, None


def extract_metadata(path: str) -> dict:
    with Image.open(path) as img:
        exif_tags, exif_by_id = _collect_exif_tags(img)
        text_entries = _text_entries(img)
        icc_profile = img.info.get("icc_profile")
        privacy_fields = _privacy_fields(exif_by_id)

        return {
            "file": _file_metadata(path),
            "image": {
                "format": img.format,
                "mode": img.mode,
                "width": img.width,
                "height": img.height,
                "frames": getattr(img, "n_frames", 1),
                "isAnimated": bool(getattr(img, "is_animated", False)),
            },
            "privacy": {
                "hasExif": bool(exif_tags),
                "hasGps": GPS_INFO_TAG in exif_by_id,
                "hasPrivacyFields": bool(privacy_fields),
                "fields": privacy_fields,
            },
            "exif": {
                "count": len(exif_tags),
                "tags": exif_tags,
            },
            "icc": {
                "present": bool(icc_profile),
                "sizeBytes": len(icc_profile) if icc_profile else 0,
            },
            "pngText": {
                "count": len(text_entries),
                "keys": [entry["key"] for entry in text_entries],
                "entries": text_entries,
            },
            "comfyui": _comfyui_metadata(text_entries),
        }


def inspect_images(payload: dict) -> dict:
    paths = payload.get("paths", [])
    include_preview = payload.get("includePreview", True) is not False
    has_max_files = "maxFiles" in payload
    max_files = _parse_optional_max_files(payload.get("maxFiles")) if has_max_files else None
    expanded_paths, truncated, scanned = _expand_input_paths(paths, max_files)
    items = []
    failures = []

    for path in expanded_paths:
        try:
            if not is_supported_image(path):
                failures.append({"path": path, "error": "Unsupported image type"})
                continue
            item = {
                "path": path,
                "name": os.path.basename(path),
                "hasExif": has_exif(path),
                "thumb": _thumb_data_url(path),
                "metadata": extract_metadata(path),
            }
            if include_preview:
                item["preview"] = _preview_data_url(path)
            items.append(item)
        except Exception as exc:
            failures.append({"path": path, "error": str(exc)})

    result = {"ok": True, "items": items, "failures": failures}
    if has_max_files:
        result.update({"truncated": truncated, "scanned": scanned, "limit": max_files})
    return result


def preview_image(payload: dict) -> dict:
    path = os.path.normpath(str(payload.get("path", "")))
    if not path or not is_supported_image(path):
        return {"ok": False, "error": "Unsupported image type"}
    return {"ok": True, "path": path, "preview": _preview_data_url(path)}


def _parse_optional_max_files(value) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError("maxFiles must be a number.") from None
    if parsed < 0:
        raise ValueError("maxFiles must be at least 0.")
    return parsed


def _expand_input_paths(paths: list, max_files: int | None = None) -> tuple[list, bool, int]:
    expanded = []
    seen = set()
    accepted = 0
    for path_index, raw_path in enumerate(paths):
        path = str(raw_path)
        if os.path.isdir(path):
            for root, dirs, files in os.walk(path):
                dirs.sort()
                sorted_files = sorted(files)
                for file_index, filename in enumerate(sorted_files):
                    file_path = os.path.join(root, filename)
                    normalized = os.path.normpath(file_path)
                    if normalized in seen:
                        continue
                    supported = is_supported_image(normalized)
                    if max_files is not None and supported and accepted >= max_files:
                        return expanded, True, accepted
                    expanded.append(normalized)
                    seen.add(normalized)
                    if supported:
                        accepted += 1
                        if max_files is not None and accepted >= max_files:
                            has_more_here = file_index < len(sorted_files) - 1 or bool(dirs)
                            has_more_inputs = path_index < len(paths) - 1
                            if has_more_here or has_more_inputs:
                                return expanded, True, accepted
            continue
        normalized = os.path.normpath(path)
        if normalized in seen:
            continue
        supported = is_supported_image(normalized)
        if max_files is not None and supported and accepted >= max_files:
            return expanded, True, accepted
        expanded.append(normalized)
        seen.add(normalized)
        if supported:
            accepted += 1
            if max_files is not None and accepted >= max_files and path_index < len(paths) - 1:
                return expanded, True, accepted
    return expanded, False, accepted


def _parse_hex_color(value: str) -> tuple:
    text = (value or "#101114").strip().lstrip("#")
    if len(text) != 6:
        return (16, 17, 20)
    try:
        return tuple(int(text[index:index + 2], 16) for index in (0, 2, 4))
    except ValueError:
        return (16, 17, 20)


def export_grid(payload: dict) -> dict:
    image_paths = payload.get("imagePaths", [])
    layout = payload.get("layout", {})
    settings = payload.get("settings", {})
    output_path = payload.get("outputPath")

    if not output_path:
        raise ValueError("outputPath is required.")
    image_paths = _validate_string_list(image_paths, "imagePaths", maximum=128)
    rows = _clamp_payload_int(layout.get("rows", 4), "rows", 1, 8)
    cols = _clamp_payload_int(layout.get("cols", 5), "cols", 1, 8)
    width = _clamp_payload_int(settings.get("width", 1600), "width", 320, 6000)
    height = _clamp_payload_int(settings.get("height", 2000), "height", 320, 6000)
    gap = _clamp_payload_int(settings.get("gap", 24), "gap", 0, 800)
    radius = _clamp_payload_int(settings.get("radius", 12), "radius", 0, 3000)
    quality = _clamp_payload_int(settings.get("quality", 95), "quality", 70, 100)
    cells = _validate_cells(layout.get("cells", []), rows, cols)

    ext = os.path.splitext(output_path)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp"):
        raise ValueError("Unsupported export extension. Use PNG, JPEG, or WebP.")

    failures = []
    grid = create_custom_grid_image(
        image_paths=image_paths,
        rows=rows,
        cols=cols,
        cells=cells,
        output_size=(
            width,
            height,
        ),
        gap=gap,
        bg_color=_parse_hex_color(settings.get("background", "#101114")),
        round_corners=bool(settings.get("roundCorners", True)),
        radius=radius,
        image_crops=payload.get("imageCrops", []),
        error_callback=lambda path, error: failures.append(
            {"path": path, "error": str(error)}
        ),
    )

    save_kwargs = {"quality": quality}
    if ext in (".jpg", ".jpeg"):
        grid.save(output_path, "JPEG", **save_kwargs, exif=b"")
    elif ext == ".webp":
        grid.save(output_path, "WEBP", **save_kwargs, exif=b"")
    else:
        grid.save(output_path, "PNG")

    with Image.open(output_path) as exported:
        exif_count = len(exported.getexif())
        width, height = exported.size

    return {
        "ok": True,
        "outputPath": output_path,
        "width": width,
        "height": height,
        "exifCount": exif_count,
        "failures": failures,
    }


def remove_exif_batch(payload: dict) -> dict:
    image_paths = _validate_string_list(payload.get("imagePaths", []), "imagePaths", maximum=1000)
    output_dir = payload.get("outputDir")
    flags = payload.get("flags")

    if not output_dir:
        raise ValueError("outputDir is required.")
    if flags is None:
        flags = [True] * len(image_paths)
    if not isinstance(flags, list) or len(flags) != len(image_paths):
        raise ValueError("flags must match imagePaths length.")
    if any(type(flag) is not bool for flag in flags):
        raise ValueError("flags must be booleans.")

    failures = []
    output_paths = batch_remove_exif(
        filepaths=image_paths,
        output_dir=output_dir,
        flags=flags,
        conflict_mode=payload.get("conflictMode", "rename"),
        error_callback=lambda path, error: failures.append(
            {"path": path, "error": str(error)}
        ),
    )

    requested = sum(1 for flag in flags if flag)
    return {
        "ok": True,
        "outputDir": output_dir,
        "outputPaths": output_paths,
        "processed": len(output_paths),
        "requested": requested,
        "skipped": max(0, len(image_paths) - requested),
        "failures": failures,
    }


def _validate_string_list(value, name: str, maximum: int) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f"{name} must be a list.")
    if len(value) > maximum:
        raise ValueError(f"{name} contains too many items.")
    result = []
    for item in value:
        if not isinstance(item, str) or not item:
            raise ValueError(f"{name} must contain paths.")
        result.append(item)
    return result


def _clamp_payload_int(value, name: str, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number.") from None
    if parsed < minimum or parsed > maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}.")
    return parsed


def _validate_cells(cells, rows: int, cols: int) -> list[dict]:
    if not isinstance(cells, list):
        raise ValueError("cells must be a list.")
    if len(cells) > rows * cols:
        raise ValueError("cells contains too many items.")

    occupied = set()
    normalized = []
    for cell in cells:
        if not isinstance(cell, dict):
            raise ValueError("cells must contain objects.")
        row = _clamp_payload_int(cell.get("row", 0), "cell.row", 0, rows - 1)
        col = _clamp_payload_int(cell.get("col", 0), "cell.col", 0, cols - 1)
        row_span = _clamp_payload_int(cell.get("rowSpan", 1), "cell.rowSpan", 1, rows)
        col_span = _clamp_payload_int(cell.get("colSpan", 1), "cell.colSpan", 1, cols)
        raw_image_index = cell.get("imageIndex", 0)
        image_index = -1 if raw_image_index is None else _clamp_payload_int(raw_image_index, "cell.imageIndex", -1, 1000)
        if row + row_span > rows or col + col_span > cols:
            raise ValueError("cell is outside the grid.")
        for next_row in range(row, row + row_span):
            for next_col in range(col, col + col_span):
                position = (next_row, next_col)
                if position in occupied:
                    raise ValueError("cells overlap.")
                occupied.add(position)
        normalized.append({
            "row": row,
            "col": col,
            "rowSpan": row_span,
            "colSpan": col_span,
            "imageIndex": image_index,
        })
    return normalized


def main() -> int:
    if len(sys.argv) < 2:
        _write_payload({"ok": False, "error": "Command is required."})
        return 1

    command = sys.argv[1]
    try:
        payload = _read_payload()
        if command == "inspect":
            _write_payload(inspect_images(payload))
        elif command == "preview":
            _write_payload(preview_image(payload))
        elif command == "export":
            _write_payload(export_grid(payload))
        elif command == "remove-exif":
            _write_payload(remove_exif_batch(payload))
        else:
            _write_payload({"ok": False, "error": f"Unknown command: {command}"})
            return 1
        return 0
    except Exception as exc:
        _write_payload({"ok": False, "error": str(exc)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
