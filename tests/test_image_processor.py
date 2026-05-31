import os
import tempfile
import unittest

from PIL import Image

from src.image_processor import (
    batch_remove_exif,
    create_custom_grid_image,
    remove_exif,
)


class ImageProcessorTests(unittest.TestCase):
    def test_remove_exif_strips_metadata_and_applies_orientation(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            source_path = os.path.join(tmpdir, "oriented.jpg")
            output_path = os.path.join(tmpdir, "clean.png")

            img = Image.new("RGB", (40, 60))
            pixels = {
                "a": (255, 0, 0),
                "b": (0, 255, 0),
                "c": (0, 0, 255),
                "d": (255, 255, 0),
                "e": (255, 0, 255),
                "f": (0, 255, 255),
            }
            for index, key in enumerate(["a", "b", "c", "d", "e", "f"]):
                col = index % 2
                row = index // 2
                for x in range(col * 20, (col + 1) * 20):
                    for y in range(row * 20, (row + 1) * 20):
                        img.putpixel((x, y), pixels[key])

            exif = Image.Exif()
            exif[274] = 6
            img.save(source_path, exif=exif, quality=100, subsampling=0)

            result = remove_exif(source_path, output_path)

            self.assertEqual(result, output_path)
            with Image.open(output_path) as cleaned:
                self.assertEqual(cleaned.size, (60, 40))
                self.assertFalse(cleaned.getexif())
                self.assertColorAlmostEqual(cleaned.getpixel((10, 10)), pixels["e"])
                self.assertColorAlmostEqual(cleaned.getpixel((50, 10)), pixels["a"])
                self.assertColorAlmostEqual(cleaned.getpixel((10, 30)), pixels["f"])
                self.assertColorAlmostEqual(cleaned.getpixel((50, 30)), pixels["b"])

    def test_batch_remove_exif_skips_false_flags_without_copying(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_dir = os.path.join(tmpdir, "input")
            output_dir = os.path.join(tmpdir, "output")
            os.makedirs(input_dir)
            filepaths = self._make_pngs(input_dir, ["keep.png", "skip.png"])

            results = batch_remove_exif(filepaths, output_dir, [True, False])

            self.assertEqual(results, [os.path.join(output_dir, "NOEXIF_keep.png")])
            self.assertTrue(os.path.exists(os.path.join(output_dir, "NOEXIF_keep.png")))
            self.assertFalse(os.path.exists(os.path.join(output_dir, "NOEXIF_skip.png")))

    def test_batch_remove_exif_result_count_matches_true_flags(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_dir = os.path.join(tmpdir, "input")
            output_dir = os.path.join(tmpdir, "output")
            os.makedirs(input_dir)
            filepaths = self._make_pngs(input_dir, ["a.png", "b.png", "c.png", "d.png"])
            flags = [True, False, True, False]

            results = batch_remove_exif(filepaths, output_dir, flags)

            self.assertEqual(len(results), sum(flags))
            self.assertEqual(len(os.listdir(output_dir)), sum(flags))

    def test_batch_remove_exif_renames_conflicting_outputs_by_default(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_dir = os.path.join(tmpdir, "input")
            output_dir = os.path.join(tmpdir, "output")
            os.makedirs(input_dir)
            os.makedirs(output_dir)
            source_path = self._make_pngs(input_dir, ["photo.png"])[0]
            existing_path = os.path.join(output_dir, "NOEXIF_photo.png")
            Image.new("RGB", (4, 4), (200, 0, 0)).save(existing_path)

            results = batch_remove_exif([source_path], output_dir, [True])

            self.assertEqual(results, [os.path.join(output_dir, "NOEXIF_photo_1.png")])
            self.assertTrue(os.path.exists(existing_path))
            self.assertTrue(os.path.exists(results[0]))

    def test_batch_remove_exif_replace_conflicting_outputs_when_requested(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_dir = os.path.join(tmpdir, "input")
            output_dir = os.path.join(tmpdir, "output")
            os.makedirs(input_dir)
            os.makedirs(output_dir)
            source_path = os.path.join(input_dir, "photo.png")
            output_path = os.path.join(output_dir, "NOEXIF_photo.png")
            Image.new("RGB", (4, 4), (10, 140, 220)).save(source_path)
            Image.new("RGB", (4, 4), (200, 0, 0)).save(output_path)

            results = batch_remove_exif(
                [source_path],
                output_dir,
                [True],
                conflict_mode="replace",
            )

            self.assertEqual(results, [output_path])
            with Image.open(output_path) as img:
                self.assertEqual(img.getpixel((0, 0)), (10, 140, 220))

    def test_create_custom_grid_image_supports_merged_cells(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_paths = self._make_pngs(tmpdir, ["hero.png", "side.png", "bottom.png"])
            cells = [
                {"row": 0, "col": 0, "rowSpan": 1, "colSpan": 2, "imageIndex": 0},
                {"row": 1, "col": 0, "rowSpan": 1, "colSpan": 1, "imageIndex": 1},
                {"row": 1, "col": 1, "rowSpan": 1, "colSpan": 1, "imageIndex": 2},
            ]

            grid = create_custom_grid_image(
                image_paths,
                rows=2,
                cols=2,
                cells=cells,
                output_size=(220, 220),
                gap=10,
                round_corners=False,
            )

            self.assertEqual(grid.size, (220, 220))
            self.assertNotEqual(grid.getpixel((20, 20)), (16, 17, 20))
            self.assertNotEqual(grid.getpixel((120, 120)), (16, 17, 20))

    def test_create_custom_grid_image_reports_failed_cells(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            good_path = os.path.join(tmpdir, "good.png")
            missing_path = os.path.join(tmpdir, "missing.png")
            Image.new("RGB", (20, 20), (30, 80, 140)).save(good_path)
            failures = []

            grid = create_custom_grid_image(
                [good_path, missing_path],
                rows=1,
                cols=2,
                cells=[
                    {"row": 0, "col": 0, "rowSpan": 1, "colSpan": 1, "imageIndex": 0},
                    {"row": 0, "col": 1, "rowSpan": 1, "colSpan": 1, "imageIndex": 1},
                ],
                output_size=(100, 50),
                gap=0,
                round_corners=False,
                error_callback=lambda path, error: failures.append((path, str(error))),
            )

            self.assertEqual(grid.size, (100, 50))
            self.assertEqual(len(failures), 1)
            self.assertEqual(failures[0][0], missing_path)

    def test_create_custom_grid_image_supports_empty_cells(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "source.png")
            Image.new("RGB", (80, 80), (210, 30, 30)).save(image_path)

            grid = create_custom_grid_image(
                [image_path],
                rows=1,
                cols=2,
                cells=[
                    {"row": 0, "col": 0, "rowSpan": 1, "colSpan": 1, "imageIndex": 0},
                    {"row": 0, "col": 1, "rowSpan": 1, "colSpan": 1, "imageIndex": None},
                ],
                output_size=(420, 220),
                gap=20,
                bg_color=(16, 17, 20),
                round_corners=False,
            )

            self.assertEqual(grid.size, (420, 220))
            self.assertNotEqual(grid.getpixel((60, 60)), (16, 17, 20))
            self.assertEqual(grid.getpixel((300, 110)), (28, 31, 37))

    def test_create_custom_grid_image_uses_crop_focus(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "wide.png")
            img = Image.new("RGB", (100, 50), (255, 0, 0))
            for x in range(50, 100):
                for y in range(50):
                    img.putpixel((x, y), (0, 0, 255))
            img.save(image_path)
            cells = [{"row": 0, "col": 0, "rowSpan": 1, "colSpan": 1, "imageIndex": 0}]

            left_focus = create_custom_grid_image(
                [image_path],
                rows=1,
                cols=1,
                cells=cells,
                output_size=(50, 50),
                gap=0,
                round_corners=False,
                image_crops=[{"cropX": 0, "cropY": 0.5}],
            )
            right_focus = create_custom_grid_image(
                [image_path],
                rows=1,
                cols=1,
                cells=cells,
                output_size=(50, 50),
                gap=0,
                round_corners=False,
                image_crops=[{"cropX": 1, "cropY": 0.5}],
            )

            self.assertColorAlmostEqual(left_focus.getpixel((25, 25)), (255, 0, 0))
            self.assertColorAlmostEqual(right_focus.getpixel((25, 25)), (0, 0, 255))

    def test_remove_exif_rejects_multiframe_gif_with_explicit_exception(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            source_path = os.path.join(tmpdir, "animated.gif")
            output_path = os.path.join(tmpdir, "clean.gif")
            frames = [
                Image.new("RGB", (8, 8), (255, 0, 0)),
                Image.new("RGB", (8, 8), (0, 0, 255)),
            ]
            frames[0].save(
                source_path,
                save_all=True,
                append_images=frames[1:],
                duration=100,
                loop=0,
            )

            with self.assertRaises((ValueError, NotImplementedError)):
                remove_exif(source_path, output_path)

    def test_remove_exif_rejects_animated_webp_with_explicit_exception(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            source_path = os.path.join(tmpdir, "animated.webp")
            output_path = os.path.join(tmpdir, "clean.webp")
            frames = [
                Image.new("RGB", (8, 8), (255, 0, 0)),
                Image.new("RGB", (8, 8), (0, 0, 255)),
            ]
            try:
                frames[0].save(
                    source_path,
                    "WEBP",
                    save_all=True,
                    append_images=frames[1:],
                    duration=100,
                    loop=0,
                )
            except Exception as exc:
                self.skipTest(f"Animated WebP not supported in this Pillow build: {exc}")

            with self.assertRaises((ValueError, NotImplementedError)):
                remove_exif(source_path, output_path)

    def test_batch_remove_exif_continues_after_one_file_fails(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            input_dir = os.path.join(tmpdir, "input")
            output_dir = os.path.join(tmpdir, "output")
            os.makedirs(input_dir)

            bad_path = os.path.join(input_dir, "animated.gif")
            frames = [
                Image.new("RGB", (8, 8), (255, 0, 0)),
                Image.new("RGB", (8, 8), (0, 0, 255)),
            ]
            frames[0].save(
                bad_path,
                save_all=True,
                append_images=frames[1:],
                duration=100,
                loop=0,
            )
            good_path = os.path.join(input_dir, "good.png")
            Image.new("RGB", (8, 8), (10, 20, 30)).save(good_path)

            failures = []
            results = batch_remove_exif(
                [bad_path, good_path],
                output_dir,
                [True, True],
                error_callback=lambda path, error: failures.append((path, str(error))),
            )

            self.assertEqual([os.path.basename(p) for p in results], ["NOEXIF_good.png"])
            self.assertEqual(len(failures), 1)
            self.assertEqual(failures[0][0], bad_path)

    def _make_pngs(self, folder, names):
        filepaths = []
        for index, name in enumerate(names):
            path = os.path.join(folder, name)
            Image.new("RGB", (4, 4), (index * 30, 10, 20)).save(path)
            filepaths.append(path)
        return filepaths

    def assertColorAlmostEqual(self, actual, expected, tolerance=8):
        self.assertTrue(
            all(abs(int(a) - int(e)) <= tolerance for a, e in zip(actual, expected)),
            f"{actual} is not within {tolerance} of {expected}",
        )
