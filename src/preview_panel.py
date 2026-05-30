"""
Image preview panel widget.
Displays loaded images with thumbnails, file info, and EXIF removal checkboxes.
"""

import os
from typing import List

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QPixmap, QImage, QDragEnterEvent, QDropEvent
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QCheckBox,
    QScrollArea, QFrame, QPushButton, QGridLayout,
)

from .image_processor import create_thumbnail, has_exif, is_supported_image


class ImageCard(QFrame):
    """A card widget displaying one image with thumbnail, info, and checkbox."""

    remove_requested = pyqtSignal(int)  # index
    exif_toggled = pyqtSignal(int, bool)  # index, state

    def __init__(self, index: int, filepath: str, parent=None):
        super().__init__(parent)
        self.index = index
        self.filepath = filepath
        self._has_exif = has_exif(filepath)

        self.setObjectName("imageCard")
        self.setStyleSheet("""
            QFrame#imageCard {
                background-color: #15171c;
                border: 1px solid #252a32;
                border-radius: 8px;
                padding: 0px;
            }
            QFrame#imageCard:hover {
                border-color: #d5b46a;
                background-color: #191c22;
            }
        """)
        self.setFixedSize(190, 252)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(6)

        # Thumbnail
        self.thumb_label = QLabel()
        self.thumb_label.setFixedSize(172, 144)
        self.thumb_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.thumb_label.setStyleSheet("""
            QLabel {
                background-color: #0c0d10;
                border-radius: 6px;
            }
        """)
        self._load_thumbnail()
        layout.addWidget(self.thumb_label)

        # Filename
        filename = os.path.basename(filepath)
        if len(filename) > 22:
            filename = filename[:19] + "..."
        name_label = QLabel(filename)
        name_label.setStyleSheet("font-size: 11px; color: #d7d4ca;")
        name_label.setToolTip(os.path.basename(filepath))
        layout.addWidget(name_label)

        # Bottom row: EXIF checkbox + remove button
        bottom = QHBoxLayout()
        bottom.setContentsMargins(0, 0, 0, 0)

        self.exif_cb = QCheckBox("제거 대상")
        self.exif_cb.setChecked(True)  # Always checked by default
        self.exif_cb.setEnabled(True)  # Always enabled
        self.exif_cb.setStyleSheet("""
            QCheckBox {
                font-size: 11px;
                color: #d5b46a;
            }
            QCheckBox::indicator {
                width: 16px;
                height: 16px;
            }
        """)
        self.exif_cb.setToolTip("체크한 이미지만 EXIF 제거 파일로 저장합니다")
        self.exif_cb.toggled.connect(lambda state: self.exif_toggled.emit(self.index, state))
        bottom.addWidget(self.exif_cb)

        bottom.addStretch()

        # Remove button
        self.remove_btn = QPushButton("✕")
        self.remove_btn.setFixedSize(24, 24)
        self.remove_btn.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                color: #e94560;
                border: none;
                border-radius: 12px;
                font-size: 14px;
                font-weight: bold;
                min-width: 24px;
                padding: 0;
            }
            QPushButton:hover {
                background-color: rgba(233, 69, 96, 0.2);
            }
        """)
        self.remove_btn.setToolTip("제거")
        self.remove_btn.clicked.connect(lambda: self.remove_requested.emit(self.index))
        bottom.addWidget(self.remove_btn)

        layout.addLayout(bottom)

        # EXIF badge
        if self._has_exif:
            badge = QLabel("EXIF")
            badge.setStyleSheet("""
                QLabel {
                    background-color: #d5b46a;
                    color: #101114;
                    font-size: 9px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
            """)
            badge.setFixedSize(36, 16)
            badge.setAlignment(Qt.AlignmentFlag.AlignCenter)
            badge.setParent(self.thumb_label)
            badge.move(130, 6)

    def _load_thumbnail(self):
        """Load thumbnail from file."""
        thumb_data = create_thumbnail(self.filepath, (168, 140))
        if thumb_data:
            qimg = QImage.fromData(thumb_data)
            pixmap = QPixmap.fromImage(qimg)
            scaled = pixmap.scaled(
                168, 140,
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation,
            )
            self.thumb_label.setPixmap(scaled)
        else:
            self.thumb_label.setText("⚠ 로드 실패")
            self.thumb_label.setStyleSheet("""
                QLabel {
                background-color: #0c0d10;
                border-radius: 6px;
                color: #e07a5f;
                    font-size: 12px;
                }
            """)

    @property
    def should_remove_exif(self) -> bool:
        return self.exif_cb.isChecked()

    @property
    def has_exif(self) -> bool:
        return self._has_exif

    def set_controls_enabled(self, enabled: bool):
        self.exif_cb.setEnabled(enabled)
        self.remove_btn.setEnabled(enabled)


class PreviewPanel(QWidget):
    """
    Panel that shows all loaded images as cards in a flow layout.
    Supports drag-and-drop, displays image count, and per-image EXIF controls.
    """

    images_changed = pyqtSignal()  # Emitted when images are added/removed
    selection_changed = pyqtSignal(list)  # Emitted with list of selected indices

    def __init__(self, parent=None):
        super().__init__(parent)
        self._image_paths: List[str] = []
        self._exif_flags: List[bool] = []
        self._cards: List[ImageCard] = []
        self._path_set = set()
        self._controls_enabled = True

        self.setAcceptDrops(True)
        self._init_ui()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(14, 14, 14, 14)
        main_layout.setSpacing(10)

        # Header
        header = QHBoxLayout()

        title = QLabel("Image tray")
        title.setStyleSheet("font-size: 16px; font-weight: 600; color: #f4efe4;")
        header.addWidget(title)

        header.addStretch()

        # Counters
        self.count_label = QLabel("0장")
        self.count_label.setObjectName("counterLabel")
        header.addWidget(self.count_label)

        self.exif_count_label = QLabel("EXIF 있음 0장 · 제거 대상 0장")
        self.exif_count_label.setStyleSheet("""
            font-size: 12px;
            color: #d5b46a;
            padding: 4px 10px;
            background-color: rgba(213, 180, 106, 0.08);
            border: 1px solid rgba(213, 180, 106, 0.20);
            border-radius: 8px;
        """)
        header.addWidget(self.exif_count_label)

        main_layout.addLayout(header)

        # Toolbar
        toolbar = QHBoxLayout()

        self.select_all_cb = QCheckBox("전체를 제거 대상으로 선택")
        self.select_all_cb.setChecked(True)
        self.select_all_cb.toggled.connect(self._on_select_all)
        toolbar.addWidget(self.select_all_cb)

        toolbar.addStretch()

        self.clear_btn = QPushButton("목록 비우기")
        self.clear_btn.setObjectName("dangerBtn")
        self.clear_btn.setFixedHeight(32)
        self.clear_btn.clicked.connect(self.clear_all)
        toolbar.addWidget(self.clear_btn)

        main_layout.addLayout(toolbar)

        # Scroll area for cards
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)

        self.cards_container = QWidget()
        self.cards_layout = FlowLayout(self.cards_container, margin=8, spacing=10)
        self.scroll.setWidget(self.cards_container)

        main_layout.addWidget(self.scroll, 1)

        # Empty state
        self.empty_label = QLabel("이미지를 이곳에 드래그하세요\n또는 상단에서 파일과 폴더를 추가하세요")
        self.empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.empty_label.setStyleSheet("""
            font-size: 16px;
            color: #77736a;
            padding: 60px;
            border: 1px dashed #3a3731;
            border-radius: 8px;
            background-color: #121419;
        """)
        main_layout.addWidget(self.empty_label, 1)

        self._update_empty_state()

    def _update_empty_state(self):
        """Show/hide empty state based on image count."""
        has_images = len(self._image_paths) > 0
        self.scroll.setVisible(has_images)
        self.empty_label.setVisible(not has_images)
        self.select_all_cb.setEnabled(has_images and self._controls_enabled)
        self.clear_btn.setEnabled(has_images and self._controls_enabled)
        total_count = len(self._image_paths)
        actual_exif_count = sum(1 for c in self._cards if c.has_exif)
        selected_count = sum(1 for c in self._cards if c.should_remove_exif)
        self.count_label.setText(f"{total_count}장")
        self.exif_count_label.setText(
            f"EXIF 있음 {actual_exif_count}장 · 제거 대상 {selected_count}장"
        )

    def add_images(self, filepaths: List[str]):
        """Add images to the preview panel."""
        if not self._controls_enabled:
            return

        new_paths = []
        for fp in filepaths:
            if fp not in self._path_set and is_supported_image(fp):
                new_paths.append(fp)
                self._path_set.add(fp)

        if not new_paths:
            return

        new_cards = []
        for fp in new_paths:
            self._image_paths.append(fp)
            self._exif_flags.append(True)  # Default: always remove EXIF

            idx = len(self._image_paths) - 1
            card = ImageCard(idx, fp)
            card.remove_requested.connect(self._on_remove_card)
            card.exif_toggled.connect(self._on_exif_toggled)
            self._cards.append(card)
            new_cards.append(card)

        self.cards_layout.addWidgets(new_cards)

        self._update_empty_state()
        self.images_changed.emit()

    def _on_remove_card(self, index: int):
        """Remove an image by index."""
        if not self._controls_enabled:
            return

        if 0 <= index < len(self._image_paths):
            self._image_paths.pop(index)
            self._exif_flags.pop(index)

            # Remove card widget
            card = self._cards.pop(index)
            self._path_set.discard(card.filepath)
            self.cards_layout.removeWidget(card)
            card.deleteLater()

            # Update indices for remaining cards
            for i, c in enumerate(self._cards):
                c.index = i

            self._update_empty_state()
            self.images_changed.emit()

    def _on_exif_toggled(self, index: int, state: bool):
        """Update EXIF flag for an image."""
        if 0 <= index < len(self._exif_flags):
            self._exif_flags[index] = state
            self._update_empty_state()
            self._sync_select_all_checkbox()
            self.selection_changed.emit(self.exif_flags)

    def _on_select_all(self, checked: bool):
        """Toggle all EXIF checkboxes."""
        if not self._controls_enabled:
            return

        for card in self._cards:
            card.exif_cb.setChecked(checked)
        self._update_empty_state()
        self.selection_changed.emit(self.exif_flags)

    def clear_all(self):
        """Remove all images."""
        if not self._controls_enabled:
            return

        for card in self._cards:
            self.cards_layout.removeWidget(card)
            card.deleteLater()
        self._cards.clear()
        self._image_paths.clear()
        self._exif_flags.clear()
        self._path_set.clear()
        self._update_empty_state()
        self.images_changed.emit()

    def _sync_select_all_checkbox(self):
        if not self._cards:
            return
        all_selected = all(card.should_remove_exif for card in self._cards)
        self.select_all_cb.blockSignals(True)
        self.select_all_cb.setChecked(all_selected)
        self.select_all_cb.blockSignals(False)

    @property
    def image_paths(self) -> List[str]:
        return list(self._image_paths)

    @property
    def exif_flags(self) -> List[bool]:
        return [c.should_remove_exif for c in self._cards]

    @property
    def image_count(self) -> int:
        return len(self._image_paths)

    @property
    def selected_count(self) -> int:
        return sum(1 for c in self._cards if c.should_remove_exif)

    def set_controls_enabled(self, enabled: bool):
        self._controls_enabled = enabled
        for card in self._cards:
            card.set_controls_enabled(enabled)
        self.setAcceptDrops(enabled)
        self._update_empty_state()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self.cards_layout.refresh()

    # Drag and Drop
    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event: QDropEvent):
        if not self._controls_enabled:
            return

        urls = event.mimeData().urls()
        paths = []
        for url in urls:
            path = url.toLocalFile()
            if os.path.isfile(path) and is_supported_image(path):
                paths.append(path)
            elif os.path.isdir(path):
                from .image_processor import collect_images_from_folder
                paths.extend(collect_images_from_folder(path))
        if paths:
            self.add_images(paths)


class FlowLayout(QGridLayout):
    """
    A simple flow layout that wraps items into rows.
    Uses QGridLayout internally for simplicity.
    """

    def __init__(self, parent=None, margin=0, spacing=8):
        super().__init__(parent)
        self.setContentsMargins(margin, margin, margin, margin)
        self.setSpacing(spacing)
        self._items: List[QWidget] = []
        self._cols = 4  # Will be updated based on container width

    def addWidget(self, widget: QWidget):
        self._items.append(widget)
        self._relayout()

    def addWidgets(self, widgets: List[QWidget]):
        self._items.extend(widgets)
        self._relayout()

    def removeWidget(self, widget: QWidget):
        if widget in self._items:
            self._items.remove(widget)
        super().removeWidget(widget)
        self._relayout()

    def refresh(self):
        self._relayout()

    def _relayout(self):
        """Re-arrange all items in the grid."""
        # Calculate columns based on parent width
        parent = self.parentWidget()
        if parent:
            available_width = parent.width() - 30
            item_width = 202  # card width + spacing
            self._cols = max(1, available_width // item_width)

        for i, item in enumerate(self._items):
            row = i // self._cols
            col = i % self._cols
            super().addWidget(item, row, col)
