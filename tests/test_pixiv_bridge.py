import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

from tools.pixiv_bridge import (
    DownloadResult,
    IMAGE_REQUEST_HEADERS,
    PixivService,
    build_download_plan,
    download_command,
    extract_user_id,
    safe_output_name,
)


class PixivBridgeTests(unittest.TestCase):
    def test_extract_user_id_from_url(self):
        self.assertEqual(
            extract_user_id("https://www.pixiv.net/users/73211891/illustrations"),
            "73211891",
        )

    def test_extract_user_id_from_plain_id(self):
        self.assertEqual(extract_user_id(" 73211891 "), "73211891")

    def test_extract_user_id_rejects_other_domains(self):
        self.assertIsNone(extract_user_id("https://example.com/users/73211891"))

    def test_headers_keep_pixiv_download_shape(self):
        self.assertEqual(IMAGE_REQUEST_HEADERS["Referer"], "https://app-api.pixiv.net/")
        self.assertIn("PixivIOSApp", IMAGE_REQUEST_HEADERS["User-Agent"])

    def test_safe_output_name_removes_path_parts(self):
        self.assertEqual(safe_output_name("../bad/144721221.jpg"), "144721221.jpg")

    def test_build_download_plan_keeps_page_extensions(self):
        page = Mock()
        page.image_urls.original = "https://i.pximg.net/img-original/test/144721221.png"
        illust = Mock()
        illust.id = 144721221
        illust.title = "sample"
        illust.width = 1344
        illust.height = 1728
        illust.meta_single_page = None
        illust.meta_pages = [page]

        plan = build_download_plan([illust])

        self.assertEqual(plan[0]["fileName"], "001_144721221_p0.png")
        self.assertEqual(plan[0]["resolution"], "1344 x 1728")
        self.assertEqual(plan[0]["selected"], True)

    def test_download_one_sends_pixiv_headers(self):
        class FakeResponse:
            status_code = 200
            headers = {"Content-Type": "image/jpeg"}

            def iter_content(self, chunk_size):
                yield b"image-bytes"

        with tempfile.TemporaryDirectory() as tmp_dir:
            service = PixivService()
            with patch("tools.pixiv_bridge.requests.get", return_value=FakeResponse()) as get_mock:
                result = service.download_one(
                    {"url": "https://i.pximg.net/test.jpg", "fileName": "test.jpg"},
                    tmp_dir,
                    retries=0,
                )

        self.assertEqual(result.status, "downloaded")
        headers = get_mock.call_args.kwargs["headers"]
        self.assertEqual(headers["Referer"], "https://app-api.pixiv.net/")
        self.assertIn("PixivIOSApp", headers["User-Agent"])

    def test_download_one_can_name_file_by_artist_and_illust_id(self):
        class FakeResponse:
            status_code = 200
            headers = {"Content-Type": "image/png"}

            def iter_content(self, chunk_size):
                yield b"image-bytes"

        with tempfile.TemporaryDirectory() as tmp_dir:
            service = PixivService()
            with patch("tools.pixiv_bridge.requests.get", return_value=FakeResponse()):
                result = service.download_one(
                    {
                        "url": "https://i.pximg.net/img-original/img/2026/01/01/00/00/00/67890_p0.png?token=x",
                        "fileName": "../old-name.jpg",
                        "artistId": "12345/unsafe",
                        "illustId": "67890:bad",
                    },
                    tmp_dir,
                    retries=0,
                    naming={"mode": "artistId_illustId"},
                )

        self.assertEqual(result.status, "downloaded")
        self.assertEqual(result.fileName, "12345unsafe_67890bad.png")

    def test_download_command_bounds_workers_and_runs_downloads_in_parallel(self):
        payload = {
            "refreshToken": "token",
            "outputDir": "unused",
            "workers": 99,
            "naming": {"mode": "artistId_illustId"},
            "items": [
                {"url": "https://i.pximg.net/first.jpg", "fileName": "first.jpg"},
                {"url": "https://i.pximg.net/second.jpg", "fileName": "second.jpg"},
            ],
        }
        started = []
        started_lock = threading.Lock()
        both_started = threading.Event()

        def fake_download(item, output_dir, retries=2, naming=None):
            with started_lock:
                started.append(item["fileName"])
                if len(started) == 2:
                    both_started.set()
            self.assertTrue(both_started.wait(1), "downloads should overlap when workers > 1")
            return DownloadResult(
                "downloaded",
                item["fileName"],
                f"unused/{item['fileName']}",
                10,
                "downloaded",
            )

        with patch("tools.pixiv_bridge._service_from_payload") as service_factory:
            service = Mock()
            service.download_one.side_effect = fake_download
            service_factory.return_value = service

            result = download_command(payload)

        self.assertEqual(result["workers"], 8)
        self.assertEqual(result["workerMode"], "parallel")
        self.assertEqual([item["fileName"] for item in result["results"]], ["first.jpg", "second.jpg"])
        self.assertEqual(service.download_one.call_count, 2)
        self.assertEqual(service.download_one.call_args.kwargs["naming"], {"mode": "artistId_illustId"})


if __name__ == "__main__":
    unittest.main()
