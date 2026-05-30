"""
Main application window for No EXIF.
"""

from PyQt6.QtCore import QThread, pyqtSignal
from PyQt6.QtGui import QAction
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QFileDialog, QProgressBar,
    QStatusBar, QMessageBox,
)

from .preview_panel import PreviewPanel
from .grid_dialog import GridDialog
from .image_processor import batch_remove_exif, collect_images_from_folder


class ExifWorker(QThread):
    """Worker thread for batch EXIF removal."""
    progress = pyqtSignal(int, int)  # current, total
    finished = pyqtSignal(list, list)  # output paths, failures
    error = pyqtSignal(str)

    def __init__(self, filepaths, output_dir, flags):
        super().__init__()
        self.filepaths = filepaths
        self.output_dir = output_dir
        self.flags = flags

    def run(self):
        try:
            failures = []
            results = batch_remove_exif(
                self.filepaths,
                self.output_dir,
                self.flags,
                progress_callback=lambda cur, total: self.progress.emit(cur, total),
                error_callback=lambda path, err: failures.append((path, str(err))),
            )
            self.finished.emit(results, failures)
        except Exception as e:
            self.error.emit(str(e))


class MainWindow(QMainWindow):
    """Main application window."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("No EXIF — EXIF 제거 & 그리드 생성")
        self.setMinimumSize(920, 640)
        self.resize(1200, 800)

        self._worker: ExifWorker = None
        self._is_processing = False
        self._processing_requested = 0
        self._processing_skipped = 0
        self._init_ui()
        self._init_menubar()
        self._update_status()

    def _init_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Hero header
        header = self._create_header()
        layout.addWidget(header)

        # Main content area
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(18, 16, 18, 16)
        content_layout.setSpacing(12)

        # Action buttons
        btn_bar = self._create_button_bar()
        content_layout.addLayout(btn_bar)

        # Preview panel
        self.preview_panel = PreviewPanel()
        self.preview_panel.images_changed.connect(self._update_status)
        self.preview_panel.selection_changed.connect(lambda _: self._update_status())
        content_layout.addWidget(self.preview_panel, 1)

        # Progress bar (hidden by default)
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setFixedHeight(28)
        content_layout.addWidget(self.progress_bar)

        # Bottom action bar
        bottom_bar = self._create_bottom_bar()
        content_layout.addLayout(bottom_bar)

        layout.addWidget(content, 1)

        # Status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_label = QLabel("준비")
        self.status_bar.addWidget(self.status_label)

    def _create_header(self) -> QWidget:
        """Create a restrained photo-workspace header."""
        header = QWidget()
        header.setFixedHeight(72)
        header.setStyleSheet("""
            QWidget {
                background-color: #101114;
                border-bottom: 1px solid #252a32;
            }
        """)

        h_layout = QHBoxLayout(header)
        h_layout.setContentsMargins(24, 0, 24, 0)

        # App icon and title
        title_layout = QVBoxLayout()
        title_layout.setSpacing(2)

        app_title = QLabel("No EXIF")
        app_title.setStyleSheet("""
            font-size: 24px;
            font-weight: 650;
            color: #f4efe4;
            background: transparent;
        """)
        title_layout.addWidget(app_title)

        subtitle = QLabel("사진을 조용히 정리하고, 안전하게 내보내는 데스크톱 작업대")
        subtitle.setStyleSheet("""
            font-size: 12px;
            color: #8e8a80;
            background: transparent;
        """)
        title_layout.addWidget(subtitle)

        h_layout.addLayout(title_layout)
        h_layout.addStretch()

        # Version badge
        version = QLabel("privacy first")
        version.setStyleSheet("""
            font-size: 11px;
            color: #d5b46a;
            background: transparent;
            padding: 5px 12px;
            border: 1px solid rgba(213, 180, 106, 0.28);
            border-radius: 8px;
        """)
        h_layout.addWidget(version)

        return header

    def _create_button_bar(self) -> QHBoxLayout:
        """Create the top action button bar."""
        bar = QHBoxLayout()
        bar.setSpacing(10)

        # Add images button
        self.add_images_btn = QPushButton("이미지 추가")
        self.add_images_btn.setToolTip("이미지 파일 선택 (Ctrl+O)")
        self.add_images_btn.clicked.connect(self._on_add_images)
        self.add_images_btn.setShortcut("Ctrl+O")
        bar.addWidget(self.add_images_btn)

        # Add folder button
        self.add_folder_btn = QPushButton("폴더 추가")
        self.add_folder_btn.setToolTip("폴더의 모든 이미지 추가 (Ctrl+Shift+O)")
        self.add_folder_btn.clicked.connect(self._on_add_folder)
        self.add_folder_btn.setShortcut("Ctrl+Shift+O")
        bar.addWidget(self.add_folder_btn)

        bar.addStretch()

        return bar

    def _create_bottom_bar(self) -> QHBoxLayout:
        """Create the bottom action bar."""
        bar = QHBoxLayout()
        bar.setSpacing(12)

        bar.addStretch()

        # EXIF removal button
        self.exif_btn = QPushButton("EXIF 제거 후 저장")
        self.exif_btn.setObjectName("ghostBtn")
        self.exif_btn.setToolTip("제거 대상으로 선택한 이미지만 NOEXIF 파일로 저장합니다")
        self.exif_btn.setFixedHeight(44)
        self.exif_btn.setEnabled(False)
        self.exif_btn.clicked.connect(self._on_remove_exif)
        bar.addWidget(self.exif_btn)

        # Grid generation button
        self.grid_btn = QPushButton("그리드 이미지 생성")
        self.grid_btn.setObjectName("primaryBtn")
        self.grid_btn.setToolTip("현재 목록의 이미지로 그리드 이미지를 생성합니다")
        self.grid_btn.setFixedHeight(44)
        self.grid_btn.setEnabled(False)
        self.grid_btn.clicked.connect(self._on_create_grid)
        bar.addWidget(self.grid_btn)

        return bar

    def _init_menubar(self):
        """Create the menu bar."""
        menubar = self.menuBar()

        # File menu
        file_menu = menubar.addMenu("파일(&F)")

        self.add_images_action = QAction("이미지 추가(&I)...", self)
        self.add_images_action.setShortcut("Ctrl+O")
        self.add_images_action.triggered.connect(self._on_add_images)
        file_menu.addAction(self.add_images_action)

        self.add_folder_action = QAction("폴더 추가(&F)...", self)
        self.add_folder_action.setShortcut("Ctrl+Shift+O")
        self.add_folder_action.triggered.connect(self._on_add_folder)
        file_menu.addAction(self.add_folder_action)

        file_menu.addSeparator()

        exit_action = QAction("종료(&X)", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        # Edit menu
        edit_menu = menubar.addMenu("편집(&E)")

        self.clear_action = QAction("전체 삭제(&C)", self)
        self.clear_action.setShortcut("Ctrl+Shift+Delete")
        self.clear_action.triggered.connect(self.preview_panel.clear_all)
        edit_menu.addAction(self.clear_action)

        # Tools menu
        tools_menu = menubar.addMenu("도구(&T)")

        self.exif_action = QAction("EXIF 제거(&E)...", self)
        self.exif_action.setShortcut("Ctrl+E")
        self.exif_action.triggered.connect(self._on_remove_exif)
        tools_menu.addAction(self.exif_action)

        self.grid_action = QAction("그리드 생성(&G)...", self)
        self.grid_action.setShortcut("Ctrl+G")
        self.grid_action.triggered.connect(self._on_create_grid)
        tools_menu.addAction(self.grid_action)

        # Help menu
        help_menu = menubar.addMenu("도움말(&H)")

        about_action = QAction("No EXIF 정보(&A)", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)

    def _update_status(self):
        """Update UI based on current state."""
        count = self.preview_panel.image_count
        selected_count = self.preview_panel.selected_count
        has_images = count > 0

        if self._is_processing:
            self.exif_btn.setEnabled(False)
            self.grid_btn.setEnabled(False)
            return

        self.exif_btn.setEnabled(selected_count > 0)
        self.grid_btn.setEnabled(has_images)
        if hasattr(self, "exif_action"):
            self.exif_action.setEnabled(selected_count > 0)
            self.grid_action.setEnabled(has_images)
            self.clear_action.setEnabled(has_images)

        if has_images:
            self.status_label.setText(
                f"{count}장 로드됨 · 제거 대상 {selected_count}장"
            )
        else:
            self.status_label.setText("준비")

    def _on_add_images(self):
        """Open file dialog to add images."""
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "이미지 선택",
            "",
            "이미지 파일 (*.jpg *.jpeg *.png *.bmp *.tiff *.tif *.webp *.gif);;모든 파일 (*)",
        )
        if files:
            self.preview_panel.add_images(files)

    def _on_add_folder(self):
        """Open folder dialog to add all images from a folder."""
        folder = QFileDialog.getExistingDirectory(self, "폴더 선택")
        if folder:
            images = collect_images_from_folder(folder)
            if images:
                self.preview_panel.add_images(images)
                self.status_label.setText(f"폴더에서 {len(images)}장의 이미지를 찾았습니다.")
            else:
                QMessageBox.information(
                    self, "알림", "선택한 폴더에 지원되는 이미지 파일이 없습니다."
                )

    def _on_remove_exif(self):
        """Start batch EXIF removal."""
        if self._is_processing or self.preview_panel.image_count == 0:
            return

        output_dir = QFileDialog.getExistingDirectory(
            self, "EXIF 제거된 이미지 저장 폴더 선택"
        )
        if not output_dir:
            return

        paths = self.preview_panel.image_paths
        flags = self.preview_panel.exif_flags
        self._processing_requested = sum(1 for f in flags if f)
        self._processing_skipped = len(paths) - self._processing_requested

        # Check if any flags are set
        if not any(flags):
            QMessageBox.information(
                self, "알림",
                "제거 대상으로 선택된 이미지가 없습니다.\n"
                "이미지 카드의 체크박스를 확인해주세요."
            )
            return

        self.progress_bar.setVisible(True)
        self.progress_bar.setMaximum(len(paths))
        self.progress_bar.setValue(0)
        self._set_processing_state(True)

        self._worker = ExifWorker(paths, output_dir, flags)
        self._worker.progress.connect(self._on_progress)
        self._worker.finished.connect(self._on_exif_done)
        self._worker.error.connect(self._on_exif_error)
        self._worker.start()

    def _on_progress(self, current, total):
        self.progress_bar.setValue(current)
        self.status_label.setText(f"처리 중... {current}/{total}")

    def _on_exif_done(self, results, failures):
        self.progress_bar.setVisible(False)
        self._set_processing_state(False)

        failed_count = len(failures)
        failure_note = ""
        if failed_count:
            failed_names = ", ".join(path.split("\\")[-1] for path, _ in failures[:3])
            if failed_count > 3:
                failed_names += f" 외 {failed_count - 3}개"
            failure_note = f"\n실패한 파일: {failed_count}개 ({failed_names})"
        QMessageBox.information(
            self, "완료",
            "처리 완료\n"
            f"저장된 파일: {len(results)}개\n"
            f"건너뛴 파일: {self._processing_skipped}개"
            f"{failure_note}",
        )
        self.status_label.setText(
            f"EXIF 제거 완료 · {len(results)}개 저장 · 실패 {failed_count}개"
        )

    def _on_exif_error(self, error_msg):
        self.progress_bar.setVisible(False)
        self._set_processing_state(False)
        QMessageBox.critical(self, "오류", f"처리 중 오류:\n{error_msg}")
        self.status_label.setText("오류 발생")

    def _on_create_grid(self):
        """Open grid creation dialog."""
        if self._is_processing or self.preview_panel.image_count == 0:
            return

        dialog = GridDialog(
            self.preview_panel.image_paths,
            self.preview_panel.exif_flags,
            parent=self,
        )
        dialog.exec()

    def _set_processing_state(self, processing: bool):
        self._is_processing = processing
        controls_enabled = not processing
        self.add_images_btn.setEnabled(controls_enabled)
        self.add_folder_btn.setEnabled(controls_enabled)
        self.preview_panel.set_controls_enabled(controls_enabled)

        if hasattr(self, "add_images_action"):
            self.add_images_action.setEnabled(controls_enabled)
            self.add_folder_action.setEnabled(controls_enabled)

        if processing:
            self.exif_btn.setEnabled(False)
            self.grid_btn.setEnabled(False)
            if hasattr(self, "exif_action"):
                self.exif_action.setEnabled(False)
                self.grid_action.setEnabled(False)
                self.clear_action.setEnabled(False)
        else:
            self._update_status()

    def _show_about(self):
        """Show about dialog."""
        QMessageBox.about(
            self,
            "No EXIF 정보",
            "<h2>No EXIF</h2>"
            "<p>버전 1.0</p>"
            "<p>이미지의 EXIF 메타데이터를 제거하고,<br>"
            "인스타그램 스타일 그리드 이미지를 생성하는 도구입니다.</p>"
            "<p><b>기능:</b></p>"
            "<ul>"
            "<li>EXIF 메타데이터 완전 제거</li>"
            "<li>다양한 그리드 레이아웃 (표준 & 잡지 스타일)</li>"
            "<li>드래그 앤 드롭 지원</li>"
            "<li>폴더 일괄 처리</li>"
            "</ul>"
            "<p style='color: #888;'>Made with Python & PyQt6</p>",
        )

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event):
        self.preview_panel.dropEvent(event)
