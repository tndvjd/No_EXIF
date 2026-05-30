"""
Grid configuration dialog.
Allows users to select grid templates and preview the layout before generation.
"""

import os
from typing import List, Optional

from PyQt6.QtCore import Qt, QRectF
from PyQt6.QtGui import QPainter, QColor, QBrush, QPen, QFont
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QGroupBox, QSpinBox, QWidget, QGridLayout,
    QScrollArea, QFrame, QFileDialog, QCheckBox, QTabWidget,
    QMessageBox,
)

from .grid_templates import (
    GridTemplate, STANDARD_TEMPLATES, MAGAZINE_TEMPLATES,
)
from .image_processor import create_grid_image


class GridPreviewWidget(QWidget):
    """Small widget that draws a preview of the grid layout."""

    def __init__(self, template: GridTemplate, parent=None):
        super().__init__(parent)
        self.template = template
        self.setFixedSize(160, 120)

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        # Background
        painter.fillRect(self.rect(), QColor(12, 13, 16))

        if not self.template:
            return

        cell_w = (self.width() - 8) / self.template.cols
        cell_h = (self.height() - 8) / self.template.rows
        gap = 3

        colors = [
            QColor(213, 180, 106),
            QColor(118, 139, 122),
            QColor(78, 92, 109),
            QColor(180, 114, 92),
            QColor(141, 125, 102),
            QColor(95, 107, 132),
        ]

        for i, (row, col, row_span, col_span) in enumerate(self.template.cells):
            x = 4 + col * cell_w + gap / 2
            y = 4 + row * cell_h + gap / 2
            w = col_span * cell_w - gap
            h = row_span * cell_h - gap

            color = colors[i % len(colors)]
            painter.setBrush(QBrush(color))
            painter.setPen(Qt.PenStyle.NoPen)
            painter.drawRoundedRect(QRectF(x, y, w, h), 4, 4)

            # Draw cell number
            painter.setPen(QPen(QColor(255, 255, 255, 180)))
            font = QFont("Segoe UI", 10, QFont.Weight.Bold)
            painter.setFont(font)
            painter.drawText(QRectF(x, y, w, h), Qt.AlignmentFlag.AlignCenter, str(i + 1))

        painter.end()


class TemplateCard(QFrame):
    """Clickable card for a grid template."""

    def __init__(self, template: GridTemplate, parent=None):
        super().__init__(parent)
        self.template = template
        self._selected = False

        self.setFixedSize(180, 188)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self._update_style()

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(4)

        # Preview
        preview = GridPreviewWidget(template)
        layout.addWidget(preview, 0, Qt.AlignmentFlag.AlignCenter)

        # Name
        name = QLabel(template.display_name)
        name.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name.setStyleSheet("font-size: 12px; font-weight: 600; color: #f4efe4;")
        layout.addWidget(name)

        # Description
        desc = QLabel(f"{template.total_cells}칸")
        desc.setAlignment(Qt.AlignmentFlag.AlignCenter)
        desc.setStyleSheet("font-size: 10px; color: #8e8a80;")
        layout.addWidget(desc)

    def _update_style(self):
        if self._selected:
            self.setStyleSheet("""
                QFrame {
                    background-color: #1c1a16;
                    border: 2px solid #d5b46a;
                    border-radius: 8px;
                }
            """)
        else:
            self.setStyleSheet("""
                QFrame {
                    background-color: #15171c;
                    border: 1px solid #252a32;
                    border-radius: 8px;
                }
                QFrame:hover {
                    border-color: #6d6658;
                    background-color: #191c22;
                }
            """)

    @property
    def selected(self):
        return self._selected

    @selected.setter
    def selected(self, value):
        self._selected = value
        self._update_style()

    def mousePressEvent(self, event):
        self.selected = True
        super().mousePressEvent(event)


class GridDialog(QDialog):
    """Dialog for configuring and generating grid images."""

    def __init__(self, image_paths: List[str], exif_flags: List[bool], parent=None):
        super().__init__(parent)
        self.image_paths = image_paths
        self.exif_flags = exif_flags
        self._selected_template: Optional[GridTemplate] = None
        self._template_cards: List[TemplateCard] = []

        self.setWindowTitle("그리드 이미지 생성")
        self.setMinimumSize(900, 680)
        self.setStyleSheet("""
            QDialog {
                background-color: #101114;
            }
        """)

        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(22, 20, 22, 20)
        layout.setSpacing(16)

        # Title
        title = QLabel("Layout studio")
        title.setStyleSheet("font-size: 22px; font-weight: 650; color: #f4efe4;")
        layout.addWidget(title)

        info = QLabel(
            f"{len(self.image_paths)}장의 이미지로 그리드를 만듭니다. "
            "레이아웃과 출력 밀도를 선택하세요."
        )
        info.setStyleSheet("font-size: 13px; color: #8e8a80; margin-bottom: 8px;")
        layout.addWidget(info)

        # Tab widget for standard vs magazine templates
        tabs = QTabWidget()
        tabs.addTab(self._create_template_tab(STANDARD_TEMPLATES), "Standard")
        tabs.addTab(self._create_template_tab(MAGAZINE_TEMPLATES), "Magazine")
        layout.addWidget(tabs, 1)

        # Options
        options_group = QGroupBox("출력 설정")
        options_layout = QHBoxLayout(options_group)

        # Cell size
        options_layout.addWidget(QLabel("셀 크기:"))
        self.cell_size_spin = QSpinBox()
        self.cell_size_spin.setRange(100, 1200)
        self.cell_size_spin.setValue(400)
        self.cell_size_spin.setSuffix(" px")
        self.cell_size_spin.setSingleStep(50)
        options_layout.addWidget(self.cell_size_spin)

        options_layout.addSpacing(20)

        # Gap
        options_layout.addWidget(QLabel("간격:"))
        self.gap_spin = QSpinBox()
        self.gap_spin.setRange(0, 30)
        self.gap_spin.setValue(4)
        self.gap_spin.setSuffix(" px")
        options_layout.addWidget(self.gap_spin)

        options_layout.addSpacing(20)

        # Round corners
        self.round_corners_cb = QCheckBox("사진 모서리를 둥글게")
        self.round_corners_cb.setChecked(True)
        options_layout.addWidget(self.round_corners_cb)

        options_layout.addStretch()
        layout.addWidget(options_group)

        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        cancel_btn = QPushButton("취소")
        cancel_btn.setObjectName("ghostBtn")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        self.generate_btn = QPushButton("그리드 생성")
        self.generate_btn.setObjectName("primaryBtn")
        self.generate_btn.setEnabled(False)
        self.generate_btn.clicked.connect(self._on_generate)
        btn_layout.addWidget(self.generate_btn)

        layout.addLayout(btn_layout)

    def _create_template_tab(self, templates: List[GridTemplate]) -> QWidget:
        """Create a scrollable tab with template cards."""
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { border: none; }")

        container = QWidget()
        grid = QGridLayout(container)
        grid.setContentsMargins(8, 8, 8, 8)
        grid.setSpacing(12)

        cols = 4
        for i, tmpl in enumerate(templates):
            card = TemplateCard(tmpl)
            card.mousePressEvent = self._make_card_click_handler(card)
            self._template_cards.append(card)
            grid.addWidget(card, i // cols, i % cols)

        # Add stretch at the bottom
        grid.setRowStretch(len(templates) // cols + 1, 1)

        scroll.setWidget(container)
        return scroll

    def _make_card_click_handler(self, card: TemplateCard):
        def handler(event):
            # Deselect all
            for c in self._template_cards:
                c.selected = False
            # Select this one
            card.selected = True
            self._selected_template = card.template

            # Check if we have enough images
            needed = card.template.total_cells
            have = len(self.image_paths)
            if have < needed:
                self.generate_btn.setText(f"그리드 생성 ({have}/{needed}장)")
            else:
                self.generate_btn.setText("그리드 생성")
            self.generate_btn.setEnabled(True)

        return handler

    def _on_generate(self):
        """Generate the grid image."""
        if not self._selected_template:
            return

        needed = self._selected_template.total_cells
        paths_to_use = self.image_paths[:needed]

        if len(paths_to_use) < needed:
            reply = QMessageBox.question(
                self,
                "이미지 부족",
                f"선택한 레이아웃에는 {needed}장이 필요하지만 {len(paths_to_use)}장만 있습니다.\n"
                f"빈 칸은 비워둔 채로 생성하시겠습니까?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            )
            if reply == QMessageBox.StandardButton.No:
                return

        # Ask save location
        save_path, _ = QFileDialog.getSaveFileName(
            self,
            "그리드 이미지 저장",
            os.path.expanduser("~/Desktop/NOEXIF_grid_image.png"),
            "PNG (*.png);;JPEG (*.jpg *.jpeg);;WebP (*.webp)",
        )

        if not save_path:
            return

        try:
            failures = []
            grid_img = create_grid_image(
                paths_to_use,
                self._selected_template,
                cell_size=self.cell_size_spin.value(),
                gap=self.gap_spin.value(),
                round_corners=self.round_corners_cb.isChecked(),
                error_callback=lambda path, error: failures.append((path, str(error))),
            )

            # Save without any EXIF metadata
            ext = os.path.splitext(save_path)[1].lower()
            save_kwargs = {'quality': 95}
            if ext in ('.jpg', '.jpeg'):
                grid_img.save(save_path, 'JPEG', **save_kwargs, exif=b'')
            elif ext == '.webp':
                grid_img.save(save_path, 'WEBP', **save_kwargs, exif=b'')
            else:
                grid_img.save(save_path, 'PNG')

            message = f"그리드 이미지가 저장되었습니다.\n{save_path}"
            if failures:
                failed_names = ", ".join(os.path.basename(path) for path, _ in failures[:3])
                if len(failures) > 3:
                    failed_names += f" 외 {len(failures) - 3}개"
                message += f"\n\n불러오지 못한 이미지: {len(failures)}개 ({failed_names})"

            QMessageBox.information(self, "완료", message)
            self.accept()
        except Exception as e:
            QMessageBox.critical(
                self,
                "오류",
                f"그리드 생성 중 오류가 발생했습니다:\n{str(e)}",
            )

    @property
    def selected_template(self) -> Optional[GridTemplate]:
        return self._selected_template
