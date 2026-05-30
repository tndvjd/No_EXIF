"""
No EXIF — EXIF Metadata Remover & Instagram Grid Generator
Entry point for the application.
"""

import sys
import os

# Add the project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

from src.main_window import MainWindow
from src.styles import DARK_THEME


def main():
    # High DPI support
    os.environ["QT_ENABLE_HIGHDPI_SCALING"] = "1"

    app = QApplication(sys.argv)
    app.setApplicationName("No EXIF")
    app.setOrganizationName("NoEXIF")

    # Set global font
    font = QFont("Segoe UI", 10)
    font.setHintingPreference(QFont.HintingPreference.PreferFullHinting)
    app.setFont(font)

    # Apply dark theme
    app.setStyleSheet(DARK_THEME)

    # Create and show main window
    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
