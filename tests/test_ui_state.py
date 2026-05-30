import os
import tempfile
import unittest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PIL import Image
from PyQt6.QtWidgets import QApplication

from src.main_window import MainWindow


class UiStateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def test_exif_button_updates_when_selection_changes(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "plain.png")
            Image.new("RGB", (16, 16), (10, 20, 30)).save(image_path)

            window = MainWindow()
            window.preview_panel.add_images([image_path])
            self.app.processEvents()

            self.assertTrue(window.exif_btn.isEnabled())

            window.preview_panel.select_all_cb.setChecked(False)
            self.app.processEvents()

            self.assertEqual(window.preview_panel.selected_count, 0)
            self.assertFalse(window.exif_btn.isEnabled())
            self.assertIn("제거 대상 0장", window.status_label.text())

    def test_processing_state_locks_mutating_controls(self):
        window = MainWindow()

        window._set_processing_state(True)
        self.app.processEvents()

        self.assertFalse(window.add_images_btn.isEnabled())
        self.assertFalse(window.add_folder_btn.isEnabled())
        self.assertFalse(window.preview_panel.select_all_cb.isEnabled())
        self.assertFalse(window.preview_panel.clear_btn.isEnabled())

        window._set_processing_state(False)
        self.app.processEvents()

        self.assertTrue(window.add_images_btn.isEnabled())
        self.assertTrue(window.add_folder_btn.isEnabled())


if __name__ == "__main__":
    unittest.main()
