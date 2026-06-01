"""JSON bridge for Pixiv import.

Commands read one JSON object from stdin and write one JSON object to stdout.
This mirrors noexif_bridge.py so Electron can call Pixiv features without
exposing Node or filesystem APIs to the renderer.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import base64
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urlparse

import requests
from pixivpy3 import AppPixivAPI


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
IMAGE_REQUEST_HEADERS = {
    "Referer": "https://app-api.pixiv.net/",
    "User-Agent": "PixivIOSApp/7.13.3 (iOS 14.6; iPhone13,2)",
}


@dataclass
class DownloadResult:
    status: str
    fileName: str
    path: str
    sizeBytes: int = 0
    message: str = ""


def _configure_stdio() -> None:
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(encoding="utf-8", errors="replace")


_configure_stdio()


def extract_user_id(value) -> str | None:
    text = str(value or "").strip()
    if text.isdigit():
        return text
    parsed = urlparse(text)
    if parsed.netloc and parsed.netloc.lower() not in {"www.pixiv.net", "pixiv.net"}:
        return None
    match = re.search(r"/users/(\d+)", parsed.path)
    return match.group(1) if match else None


def extract_user_page(value) -> int:
    parsed = urlparse(str(value or "").strip())
    query = parsed.query or ""
    match = re.search(r"(?:^|&)p=(\d+)(?:&|$)", query)
    if not match:
        return 1
    return max(1, int(match.group(1)))


def safe_output_name(file_name) -> str:
    return os.path.basename(str(file_name or "").replace("\\", "/"))


def safe_name_part(value) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "", str(value or ""))


def extension_from_url(image_url) -> str:
    extension = os.path.splitext(urlparse(str(image_url)).path)[1].lower()
    return extension if extension in IMAGE_EXTENSIONS else ".jpg"


def _extension_from_item(item: dict) -> str:
    url_extension = os.path.splitext(urlparse(str(item.get("url") or "")).path)[1].lower()
    if url_extension in IMAGE_EXTENSIONS:
        return url_extension
    file_extension = os.path.splitext(safe_output_name(item.get("fileName")))[1].lower()
    return file_extension if file_extension in IMAGE_EXTENSIONS else ".jpg"


def _naming_mode(naming) -> str:
    if isinstance(naming, dict):
        return str(naming.get("mode") or "").strip()
    return str(naming or "").strip()


def _output_name_for_item(item: dict, naming=None) -> str:
    mode = _naming_mode(naming)
    if mode in {"artistId_illustId", "artist_id_illust_id", "artist-illust"}:
        artist_id = safe_name_part(_first_attr(item, "artistId", "artist_id", "userId", "user_id"))
        illust_id = safe_name_part(_first_attr(item, "illustId", "illust_id", "sourceId", "source_id", "id"))
        if artist_id and illust_id:
            return f"{artist_id}_{illust_id}{_extension_from_item(item)}"
    return safe_output_name(item.get("fileName"))


def _bounded_workers(value) -> int:
    try:
        workers = int(value or 1)
    except (TypeError, ValueError):
        workers = 1
    return max(1, min(workers, 8))


def _first_attr(value, *names, default=""):
    for name in names:
        if isinstance(value, dict) and name in value:
            return value[name]
        item = getattr(value, name, None)
        if item is not None:
            return item
    return default


def _preview_url_for_illust(illust) -> str:
    image_urls = _first_attr(illust, "image_urls", default=None) or {}
    preview = _first_attr(image_urls, "square_medium", "medium", "large", default="")
    if preview:
        return str(preview)
    pages = _first_attr(illust, "meta_pages", default=[]) or []
    if pages:
        page_urls = _first_attr(pages[0], "image_urls", default={})
        preview = _first_attr(page_urls, "medium", "large", "original", default="")
        if preview:
            return str(preview)
    return ""


def _image_urls_for_illust(illust) -> list[tuple[str, str]]:
    downloads = []
    single_page = _first_attr(illust, "meta_single_page", default=None)
    if single_page:
        image_url = single_page.get("original_image_url") or _first_attr(_first_attr(illust, "image_urls", default={}), "large")
        if image_url:
            downloads.append((str(image_url), f"{_first_attr(illust, 'id')}{extension_from_url(image_url)}"))
        return downloads

    pages = _first_attr(illust, "meta_pages", default=[]) or []
    for index, page in enumerate(pages):
        image_urls = _first_attr(page, "image_urls", default={})
        image_url = _first_attr(image_urls, "original", "large")
        if image_url:
            downloads.append((str(image_url), f"{_first_attr(illust, 'id')}_p{index}{extension_from_url(image_url)}"))
    return downloads


def build_download_plan(illusts) -> list[dict]:
    plan = []
    for order, illust in enumerate(illusts, start=1):
        for image_url, source_name in _image_urls_for_illust(illust):
            width = _first_attr(illust, "width", default=0)
            height = _first_attr(illust, "height", default=0)
            plan.append(
                {
                    "illustId": _first_attr(illust, "id"),
                    "title": _first_attr(illust, "title", default=""),
                    "url": image_url,
                    "previewUrl": _preview_url_for_illust(illust),
                    "fileName": f"{order:03d}_{source_name}",
                    "resolution": f"{width} x {height}" if width and height else "",
                    "pageCount": max(1, len(_first_attr(illust, "meta_pages", default=[]) or [])),
                    "sizeBytes": 0,
                    "selected": True,
                }
            )
    return plan


class PixivService:
    def __init__(self, request_timeout: int = 30):
        self.request_timeout = request_timeout
        self.api = AppPixivAPI(timeout=request_timeout)

    def login(self, refresh_token: str) -> None:
        self.api.auth(refresh_token=refresh_token)

    def _preview_data_url(self, preview_url: str) -> str:
        if not preview_url:
            return ""
        response = self.api.requests_call(
            "GET",
            preview_url,
            headers={"Referer": IMAGE_REQUEST_HEADERS["Referer"]},
        )
        if response.status_code != 200:
            return ""
        content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
        if not content_type.startswith("image/"):
            return ""
        encoded = base64.b64encode(response.content).decode("ascii")
        return f"data:{content_type};base64,{encoded}"

    def attach_previews(self, items: list[dict]) -> list[dict]:
        if not items:
            return items

        def attach(item: dict) -> dict:
            try:
                preview = self._preview_data_url(str(item.get("previewUrl") or ""))
                return {**item, "preview": preview} if preview else item
            except Exception:
                return item

        workers = min(6, len(items))
        with ThreadPoolExecutor(max_workers=workers) as executor:
            return list(executor.map(attach, items))

    def list_user_works(self, user_id: str, limit: int = 30, start_page: int = 1) -> list[dict]:
        result = self.api.user_illusts(user_id)
        illusts = []
        skip_remaining = max(0, (int(start_page or 1) - 1) * 48)
        while result is not None and len(illusts) < limit:
            for illust in getattr(result, "illusts", []) or []:
                if skip_remaining > 0:
                    skip_remaining -= 1
                    continue
                if len(illusts) >= limit:
                    break
                if getattr(illust, "type", "") in {"illust", "manga"}:
                    illusts.append(illust)
            next_qs = self.api.parse_qs(getattr(result, "next_url", None))
            if not next_qs:
                break
            time.sleep(0.35)
            result = self.api.user_illusts(**next_qs)
        return self.attach_previews(build_download_plan(illusts))

    def download_one(self, item: dict, output_dir: str, retries: int = 2, naming=None) -> DownloadResult:
        file_name = _output_name_for_item(item, naming)
        if not file_name:
            return DownloadResult("failed", "", "", 0, "File name is required.")
        target_dir = Path(output_dir).expanduser().resolve()
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / file_name

        if target_path.exists() and target_path.stat().st_size > 0:
            return DownloadResult("skipped", file_name, str(target_path), target_path.stat().st_size, "already exists")

        temp_path = target_path.with_suffix(target_path.suffix + ".part")
        last_error = ""
        for attempt in range(retries + 1):
            try:
                if temp_path.exists():
                    temp_path.unlink()
                response = requests.get(
                    item.get("url", ""),
                    headers=IMAGE_REQUEST_HEADERS,
                    stream=True,
                    timeout=self.request_timeout,
                )
                if response.status_code != 200:
                    raise RuntimeError(f"HTTP {response.status_code}")
                content_type = response.headers.get("Content-Type", "")
                if content_type and not content_type.lower().startswith("image/"):
                    raise RuntimeError(f"unexpected content type: {content_type}")
                with open(temp_path, "wb") as output:
                    for chunk in response.iter_content(chunk_size=1024 * 256):
                        if chunk:
                            output.write(chunk)
                size_bytes = temp_path.stat().st_size
                if size_bytes <= 0:
                    raise RuntimeError("downloaded file is empty")
                os.replace(temp_path, target_path)
                return DownloadResult("downloaded", file_name, str(target_path), size_bytes, "downloaded")
            except Exception as exc:  # network errors must not stop the batch
                last_error = str(exc)
                if temp_path.exists():
                    temp_path.unlink()
                if attempt < retries:
                    time.sleep(1.5 * (attempt + 1))
        return DownloadResult("failed", file_name, str(target_path), 0, last_error)


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def _write_payload(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))
    sys.stdout.flush()


def _service_from_payload(payload: dict) -> PixivService:
    timeout = int(payload.get("requestTimeout") or payload.get("timeout") or 30)
    token = str(payload.get("refreshToken") or os.environ.get("PIXIV_REFRESH_TOKEN") or "").strip()
    if not token:
        raise ValueError("Refresh Token is required.")
    service = PixivService(request_timeout=max(5, min(timeout, 120)))
    service.login(token)
    return service


def list_command(payload: dict) -> dict:
    user_id = extract_user_id(payload.get("target"))
    if not user_id:
        raise ValueError("Valid Pixiv user URL or ID is required.")
    limit = max(1, min(int(payload.get("limit") or 30), 200))
    start_page = extract_user_page(payload.get("target"))
    service = _service_from_payload(payload)
    return {"ok": True, "userId": user_id, "items": service.list_user_works(user_id, limit, start_page=start_page)}


def download_command(payload: dict) -> dict:
    output_dir = str(payload.get("outputDir") or "").strip()
    if not output_dir:
        raise ValueError("Output directory is required.")
    items = payload.get("items") or []
    if not isinstance(items, list):
        raise ValueError("Items must be a list.")
    retries = max(0, min(int(payload.get("retries") or 2), 5))
    workers = _bounded_workers(payload.get("workers"))
    naming = payload.get("naming")
    service = _service_from_payload(payload)
    worker_mode = "parallel" if workers > 1 and len(items) > 1 else "serial"
    if worker_mode == "parallel":
        with ThreadPoolExecutor(max_workers=workers) as executor:
            results = list(executor.map(
                lambda item: asdict(service.download_one(item, output_dir, retries=retries, naming=naming)),
                items,
            ))
    else:
        results = [asdict(service.download_one(item, output_dir, retries=retries, naming=naming)) for item in items]
    return {
        "ok": True,
        "results": results,
        "workers": workers,
        "workerMode": worker_mode,
    }


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    payload = _read_payload()
    try:
        if command == "list":
            _write_payload(list_command(payload))
        elif command == "download":
            _write_payload(download_command(payload))
        else:
            raise ValueError(f"Unknown command: {command}")
    except Exception as exc:
        _write_payload({"ok": False, "error": str(exc)})
        raise SystemExit(1)


if __name__ == "__main__":
    main()
