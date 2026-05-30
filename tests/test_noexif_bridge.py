import base64
import os
import io
import sys
import tempfile
import unittest

from PIL import Image
from PIL.PngImagePlugin import PngInfo
from PIL.TiffImagePlugin import IFDRational

from tools.noexif_bridge import (
    _preview_data_url,
    _write_payload,
    export_grid,
    extract_metadata,
    inspect_images,
    preview_image,
    remove_exif_batch,
)


class NoExifBridgeTests(unittest.TestCase):
    def test_write_payload_is_safe_for_cp949_consoles_with_emoji_metadata(self):
        buffer = io.BytesIO()
        cp949_stdout = io.TextIOWrapper(buffer, encoding="cp949")
        original_stdout = sys.stdout
        try:
            sys.stdout = cp949_stdout
            _write_payload({"ok": True, "prompt": "rotate 🔄 and sparkle ✨"})
            cp949_stdout.flush()
        finally:
            sys.stdout = original_stdout

        decoded = buffer.getvalue().decode("cp949")
        self.assertIn("\\ud83d\\udd04", decoded)
        self.assertIn("\\u2728", decoded)

    def test_extract_metadata_reports_file_basics_exif_privacy_and_icc(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "camera.jpg")

            exif = Image.Exif()
            exif[271] = "Test Make"
            exif[272] = "Test Model"
            exif[305] = "No EXIF Test"
            Image.new("RGB", (32, 24), (10, 20, 30)).save(
                image_path,
                exif=exif,
                icc_profile=b"fake profile bytes",
            )

            metadata = extract_metadata(image_path)

            self.assertEqual(metadata["file"]["name"], "camera.jpg")
            self.assertGreater(metadata["file"]["sizeBytes"], 0)
            self.assertEqual(metadata["image"]["format"], "JPEG")
            self.assertEqual(metadata["image"]["width"], 32)
            self.assertEqual(metadata["image"]["height"], 24)
            self.assertTrue(metadata["privacy"]["hasExif"])
            self.assertTrue(metadata["privacy"]["hasPrivacyFields"])
            self.assertTrue(metadata["icc"]["present"])
            self.assertGreater(metadata["icc"]["sizeBytes"], 0)

            exif_by_name = {item["name"]: item["value"] for item in metadata["exif"]["tags"]}
            self.assertEqual(exif_by_name["Make"], "Test Make")
            self.assertEqual(exif_by_name["Model"], "Test Model")

            privacy_labels = {field["label"] for field in metadata["privacy"]["fields"]}
            self.assertIn("Camera make", privacy_labels)
            self.assertIn("Camera model", privacy_labels)
            self.assertIn("Software", privacy_labels)

    def test_remove_exif_batch_removes_deterministic_camera_exif_and_gps(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            source = os.path.join(tmpdir, "gps_camera.jpg")
            output_dir = os.path.join(tmpdir, "clean")

            exif = Image.Exif()
            exif[271] = "QA Camera Make"
            exif[272] = "QA Camera Model"
            exif[305] = "QA Software"
            exif[274] = 6
            exif[34853] = {
                1: "N",
                2: (IFDRational(37, 1), IFDRational(46, 1), IFDRational(30, 1)),
                3: "E",
                4: (IFDRational(122, 1), IFDRational(25, 1), IFDRational(10, 1)),
            }
            Image.new("RGB", (24, 36), (110, 80, 50)).save(source, exif=exif)

            before = extract_metadata(source)
            self.assertTrue(before["privacy"]["hasExif"])
            self.assertTrue(before["privacy"]["hasGps"])

            result = remove_exif_batch({
                "imagePaths": [source],
                "flags": [True],
                "outputDir": output_dir,
            })

            self.assertTrue(result["ok"])
            self.assertEqual(result["processed"], 1)
            after = extract_metadata(result["outputPaths"][0])
            self.assertFalse(after["privacy"]["hasExif"])
            self.assertFalse(after["privacy"]["hasGps"])
            self.assertEqual(after["image"]["width"], 36)
            self.assertEqual(after["image"]["height"], 24)

    def test_extract_metadata_reports_comfyui_png_text_chunks(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "comfy.png")
            pnginfo = PngInfo()
            pnginfo.add_text("prompt", '{"6": {"inputs": {"text": "cat portrait"}}}')
            pnginfo.add_text("workflow", '{"nodes": [{"id": 6, "type": "CLIPTextEncode"}]}')
            pnginfo.add_text("parameters", "Steps: 20, Sampler: test")

            Image.new("RGB", (16, 16), (40, 50, 60)).save(
                image_path,
                pnginfo=pnginfo,
                icc_profile=b"png profile bytes",
            )

            metadata = extract_metadata(image_path)

            self.assertFalse(metadata["privacy"]["hasExif"])
            self.assertTrue(metadata["icc"]["present"])
            self.assertEqual(metadata["pngText"]["count"], 3)
            self.assertEqual(
                metadata["comfyui"]["promptJson"]["6"]["inputs"]["text"],
                "cat portrait",
            )
            self.assertEqual(
                metadata["comfyui"]["workflowJson"]["nodes"][0]["type"],
                "CLIPTextEncode",
            )
            self.assertEqual(metadata["comfyui"]["keys"], ["prompt", "workflow"])

    def test_extract_metadata_detects_comfyui_keys_case_insensitively(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "comfy_variant.png")
            pnginfo = PngInfo()
            pnginfo.add_text("Prompt", '{"7": {"inputs": {"text": "variant prompt"}}}')
            pnginfo.add_text("Workflow", '{"nodes": [{"id": 7, "type": "KSampler"}]}')

            Image.new("RGB", (16, 16), (40, 50, 60)).save(image_path, pnginfo=pnginfo)

            metadata = extract_metadata(image_path)

            self.assertTrue(metadata["comfyui"]["present"])
            self.assertEqual(metadata["comfyui"]["keys"], ["Prompt", "Workflow"])
            self.assertEqual(
                metadata["comfyui"]["promptJson"]["7"]["inputs"]["text"],
                "variant prompt",
            )
            self.assertEqual(
                metadata["comfyui"]["workflowJson"]["nodes"][0]["type"],
                "KSampler",
            )

    def test_inspect_images_preserves_existing_fields_and_adds_metadata(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "plain.png")
            Image.new("RGB", (12, 10), (1, 2, 3)).save(image_path)

            result = inspect_images({"paths": [image_path]})

            self.assertTrue(result["ok"])
            self.assertEqual(result["failures"], [])
            item = result["items"][0]
            self.assertEqual(item["path"], image_path)
            self.assertEqual(item["name"], "plain.png")
            self.assertFalse(item["hasExif"])
            self.assertTrue(item["thumb"].startswith("data:image/png;base64,"))
            self.assertTrue(item["preview"].startswith("data:image/png;base64,"))
            self.assertEqual(item["metadata"]["image"]["width"], 12)
            self.assertEqual(item["metadata"]["image"]["height"], 10)

    def test_preview_data_url_preserves_original_aspect_ratio(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "portrait.png")
            Image.new("RGB", (1344, 1728), (1, 2, 3)).save(image_path)

            data_url = _preview_data_url(image_path)
            encoded = data_url.split(",", 1)[1]
            with Image.open(io.BytesIO(base64.b64decode(encoded))) as preview:
                self.assertEqual(preview.size, (996, 1280))

    def test_inspect_images_can_skip_large_preview_payloads(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "plain.png")
            Image.new("RGB", (12, 10), (1, 2, 3)).save(image_path)

            result = inspect_images({"paths": [image_path], "includePreview": False})

            self.assertTrue(result["ok"])
            item = result["items"][0]
            self.assertTrue(item["thumb"].startswith("data:image/png;base64,"))
            self.assertNotIn("preview", item)

    def test_preview_image_loads_large_preview_on_demand(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "plain.png")
            Image.new("RGB", (12, 10), (1, 2, 3)).save(image_path)

            result = preview_image({"path": image_path})

            self.assertTrue(result["ok"])
            self.assertEqual(result["path"], os.path.normpath(image_path))
            self.assertTrue(result["preview"].startswith("data:image/png;base64,"))

    def test_inspect_images_expands_directories_and_reports_unsupported_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            first = os.path.join(tmpdir, "first.png")
            second = os.path.join(tmpdir, "nested", "second.jpg")
            bad = os.path.join(tmpdir, "notes.txt")
            os.makedirs(os.path.dirname(second))
            Image.new("RGB", (12, 10), (1, 2, 3)).save(first)
            Image.new("RGB", (10, 12), (4, 5, 6)).save(second)
            with open(bad, "w", encoding="utf-8") as handle:
                handle.write("not an image")

            result = inspect_images({"paths": [tmpdir]})

            self.assertTrue(result["ok"])
            self.assertEqual([item["name"] for item in result["items"]], ["first.png", "second.jpg"])
            self.assertEqual(len(result["failures"]), 1)
            self.assertEqual(result["failures"][0]["path"], bad)

    def test_inspect_images_limits_directory_imports_by_accepted_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            first_bad = os.path.join(tmpdir, "00_notes.txt")
            first = os.path.join(tmpdir, "01_first.png")
            second = os.path.join(tmpdir, "02_second.jpg")
            skipped_bad = os.path.join(tmpdir, "03_skipped.txt")
            skipped_image = os.path.join(tmpdir, "04_skipped.png")
            with open(first_bad, "w", encoding="utf-8") as handle:
                handle.write("not an image")
            Image.new("RGB", (12, 10), (1, 2, 3)).save(first)
            Image.new("RGB", (10, 12), (4, 5, 6)).save(second)
            with open(skipped_bad, "w", encoding="utf-8") as handle:
                handle.write("not reached")
            Image.new("RGB", (8, 8), (7, 8, 9)).save(skipped_image)

            result = inspect_images({
                "paths": [tmpdir],
                "includePreview": False,
                "maxFiles": 2,
            })

            self.assertTrue(result["ok"])
            self.assertTrue(result["truncated"])
            self.assertEqual(result["scanned"], 2)
            self.assertEqual(result["limit"], 2)
            self.assertEqual([item["name"] for item in result["items"]], ["01_first.png", "02_second.jpg"])
            self.assertEqual(result["failures"], [{"path": first_bad, "error": "Unsupported image type"}])
            self.assertNotIn(skipped_bad, [failure["path"] for failure in result["failures"]])

    def test_inspect_images_allows_direct_file_with_max_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "single.png")
            Image.new("RGB", (12, 10), (1, 2, 3)).save(image_path)

            result = inspect_images({
                "paths": [image_path],
                "includePreview": False,
                "maxFiles": 10,
            })

            self.assertTrue(result["ok"])
            self.assertFalse(result["truncated"])
            self.assertEqual(result["scanned"], 1)
            self.assertEqual(result["limit"], 10)
            self.assertEqual([item["path"] for item in result["items"]], [image_path])
            self.assertEqual(result["failures"], [])

    def test_remove_exif_batch_rejects_non_boolean_flags(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "source.png")
            Image.new("RGB", (8, 8), (1, 2, 3)).save(image_path)

            with self.assertRaisesRegex(ValueError, "flags must be booleans"):
                remove_exif_batch({
                    "imagePaths": [image_path],
                    "flags": ["false"],
                    "outputDir": os.path.join(tmpdir, "clean"),
                })

    def test_export_grid_rejects_unsafe_dimensions_and_extensions(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "source.png")
            Image.new("RGB", (8, 8), (1, 2, 3)).save(image_path)

            with self.assertRaisesRegex(ValueError, "width"):
                export_grid({
                    "imagePaths": [image_path],
                    "layout": {
                        "rows": 1,
                        "cols": 1,
                        "cells": [{"row": 0, "col": 0, "rowSpan": 1, "colSpan": 1, "imageIndex": 0}],
                    },
                    "settings": {"width": 9000, "height": 1000},
                    "outputPath": os.path.join(tmpdir, "grid.png"),
                })

            with self.assertRaisesRegex(ValueError, "Unsupported export extension"):
                export_grid({
                    "imagePaths": [image_path],
                    "layout": {
                        "rows": 1,
                        "cols": 1,
                        "cells": [{"row": 0, "col": 0, "rowSpan": 1, "colSpan": 1, "imageIndex": 0}],
                    },
                    "settings": {"width": 1000, "height": 1000},
                    "outputPath": os.path.join(tmpdir, "grid.bmp"),
                })

    def test_export_grid_still_writes_clean_output(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "source.jpg")
            output_path = os.path.join(tmpdir, "grid.jpg")
            exif = Image.Exif()
            exif[271] = "Camera"
            Image.new("RGB", (20, 20), (200, 80, 40)).save(image_path, exif=exif)

            result = export_grid(
                {
                    "imagePaths": [image_path],
                    "layout": {
                        "rows": 1,
                        "cols": 1,
                        "cells": [
                            {
                                "row": 0,
                                "col": 0,
                                "rowSpan": 1,
                                "colSpan": 1,
                                "imageIndex": 0,
                            }
                        ],
                    },
                    "settings": {
                        "width": 320,
                        "height": 320,
                        "gap": 0,
                        "roundCorners": False,
                    },
                    "outputPath": output_path,
                }
            )

            self.assertTrue(result["ok"])
            self.assertEqual(result["outputPath"], output_path)
            self.assertEqual(result["exifCount"], 0)
            self.assertTrue(os.path.exists(output_path))

    def test_export_grid_accepts_empty_cells(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "source.png")
            output_path = os.path.join(tmpdir, "grid.png")
            Image.new("RGB", (20, 20), (200, 80, 40)).save(image_path)

            result = export_grid(
                {
                    "imagePaths": [image_path],
                    "layout": {
                        "rows": 1,
                        "cols": 2,
                        "cells": [
                            {"row": 0, "col": 0, "rowSpan": 1, "colSpan": 1, "imageIndex": 0},
                            {"row": 0, "col": 1, "rowSpan": 1, "colSpan": 1, "imageIndex": None},
                        ],
                    },
                    "settings": {
                        "width": 420,
                        "height": 420,
                        "gap": 20,
                        "roundCorners": False,
                    },
                    "outputPath": output_path,
                }
            )

            self.assertTrue(result["ok"])
            self.assertTrue(os.path.exists(output_path))

    def test_remove_exif_batch_processes_only_checked_images(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            first = os.path.join(tmpdir, "first.jpg")
            second = os.path.join(tmpdir, "second.jpg")
            output_dir = os.path.join(tmpdir, "clean")

            exif = Image.Exif()
            exif[271] = "Camera"
            Image.new("RGB", (16, 16), (10, 20, 30)).save(first, exif=exif)
            Image.new("RGB", (16, 16), (40, 50, 60)).save(second)

            result = remove_exif_batch({
                "imagePaths": [first, second],
                "flags": [True, False],
                "outputDir": output_dir,
            })

            self.assertTrue(result["ok"])
            self.assertEqual(result["processed"], 1)
            self.assertEqual(result["requested"], 1)
            self.assertEqual(result["skipped"], 1)
            self.assertEqual(result["outputDir"], output_dir)
            self.assertEqual(len(result["outputPaths"]), 1)
            self.assertTrue(os.path.exists(os.path.join(output_dir, "NOEXIF_first.jpg")))
            self.assertFalse(os.path.exists(os.path.join(output_dir, "NOEXIF_second.jpg")))

    def test_remove_exif_batch_passes_replace_conflict_mode(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            source = os.path.join(tmpdir, "source.png")
            output_dir = os.path.join(tmpdir, "clean")
            output_path = os.path.join(output_dir, "NOEXIF_source.png")
            os.makedirs(output_dir)
            Image.new("RGB", (8, 8), (20, 120, 220)).save(source)
            Image.new("RGB", (8, 8), (220, 20, 20)).save(output_path)

            result = remove_exif_batch({
                "imagePaths": [source],
                "flags": [True],
                "outputDir": output_dir,
                "conflictMode": "replace",
            })

            self.assertTrue(result["ok"])
            self.assertEqual(result["outputPaths"], [output_path])
            with Image.open(output_path) as img:
                self.assertEqual(img.getpixel((0, 0)), (20, 120, 220))


if __name__ == "__main__":
    unittest.main()
