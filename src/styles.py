"""
Application-wide Qt stylesheet for No EXIF.
The palette is a restrained dark photo workspace: near-black canvas, warm text,
and a single brass accent for trustworthy actions.
"""

DARK_THEME = """
/* ===== Global ===== */
QWidget {
    background-color: #101114;
    color: #e7e1d5;
    font-family: 'Malgun Gothic', 'Segoe UI', sans-serif;
    font-size: 13px;
}

QMainWindow,
QDialog {
    background-color: #101114;
}

/* ===== Menu Bar ===== */
QMenuBar {
    background-color: #111318;
    color: #c9c2b5;
    border-bottom: 1px solid #252a32;
    padding: 4px;
}
QMenuBar::item {
    padding: 5px 10px;
    border-radius: 4px;
}
QMenuBar::item:selected {
    background-color: #1b1f26;
    color: #f4efe4;
}
QMenu {
    background-color: #15171c;
    border: 1px solid #2b3039;
    border-radius: 6px;
    padding: 5px;
}
QMenu::item {
    padding: 7px 26px;
    border-radius: 4px;
}
QMenu::item:selected {
    background-color: #242016;
    color: #f0d391;
}

/* ===== Buttons ===== */
QPushButton {
    background-color: #1b1f26;
    color: #f4efe4;
    border: 1px solid #2d333d;
    border-radius: 7px;
    padding: 9px 18px;
    font-weight: 600;
    font-size: 13px;
    min-width: 80px;
}
QPushButton:hover {
    background-color: #242932;
    border-color: #6d6658;
}
QPushButton:pressed {
    background-color: #14161b;
    padding-top: 10px;
    padding-bottom: 8px;
}
QPushButton:focus {
    border: 1px solid #d5b46a;
}
QPushButton:disabled {
    background-color: #17191e;
    border-color: #20242b;
    color: #5c5b57;
}

QPushButton#primaryBtn {
    background-color: #d5b46a;
    color: #101114;
    border: 1px solid #e4c67e;
    font-size: 14px;
    padding: 11px 26px;
}
QPushButton#primaryBtn:hover {
    background-color: #e0c276;
    border-color: #f0d391;
}
QPushButton#primaryBtn:pressed {
    background-color: #b99545;
}
QPushButton#primaryBtn:disabled {
    background-color: #1a1d23;
    color: #5c5b57;
    border-color: #252a32;
}

QPushButton#dangerBtn {
    background-color: #231a18;
    color: #e07a5f;
    border-color: #5b332b;
}
QPushButton#dangerBtn:hover {
    background-color: #2d1e1a;
    border-color: #e07a5f;
}
QPushButton#dangerBtn:disabled {
    background-color: #17191e;
    color: #5c5b57;
    border-color: #252a32;
}

QPushButton#ghostBtn {
    background-color: transparent;
    border: 1px solid #3b414c;
    color: #d5b46a;
}
QPushButton#ghostBtn:hover {
    background-color: #191b20;
    border-color: #d5b46a;
}
QPushButton#ghostBtn:disabled {
    background-color: transparent;
    border-color: #252a32;
    color: #5c5b57;
}

/* ===== Scroll Area ===== */
QScrollArea {
    border: none;
    background-color: transparent;
}
QScrollBar:vertical {
    background: #101114;
    width: 10px;
    margin: 0;
}
QScrollBar::handle:vertical {
    background: #3a3f49;
    min-height: 34px;
    border-radius: 5px;
}
QScrollBar::handle:vertical:hover {
    background: #6d6658;
}
QScrollBar::add-line:vertical,
QScrollBar::sub-line:vertical,
QScrollBar::add-line:horizontal,
QScrollBar::sub-line:horizontal {
    height: 0;
    width: 0;
}
QScrollBar:horizontal {
    background: #101114;
    height: 10px;
    margin: 0;
}
QScrollBar::handle:horizontal {
    background: #3a3f49;
    min-width: 34px;
    border-radius: 5px;
}

/* ===== Check Box ===== */
QCheckBox {
    spacing: 8px;
    color: #c9c2b5;
}
QCheckBox::indicator {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid #4a505a;
    background-color: #121419;
}
QCheckBox::indicator:checked {
    background-color: #d5b46a;
    border-color: #f0d391;
}
QCheckBox::indicator:hover {
    border-color: #d5b46a;
}
QCheckBox:disabled {
    color: #5c5b57;
}
QCheckBox::indicator:disabled {
    border-color: #252a32;
    background-color: #17191e;
}

/* ===== Inputs ===== */
QComboBox,
QSpinBox {
    background-color: #15171c;
    border: 1px solid #2d333d;
    border-radius: 6px;
    padding: 7px 10px;
    color: #e7e1d5;
    min-width: 120px;
}
QComboBox:hover,
QSpinBox:hover,
QComboBox:focus,
QSpinBox:focus {
    border-color: #d5b46a;
}
QComboBox::drop-down,
QSpinBox::up-button,
QSpinBox::down-button {
    background: transparent;
    border: none;
    width: 22px;
}
QComboBox::down-arrow {
    image: none;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #d5b46a;
    margin-right: 8px;
}
QComboBox QAbstractItemView {
    background-color: #15171c;
    border: 1px solid #2d333d;
    selection-background-color: #242016;
    selection-color: #f0d391;
    outline: none;
}

/* ===== Labels ===== */
QLabel {
    color: #e7e1d5;
    background: transparent;
}
QLabel#titleLabel {
    font-size: 22px;
    font-weight: 650;
    color: #f4efe4;
}
QLabel#subtitleLabel {
    font-size: 13px;
    color: #8e8a80;
}
QLabel#statusLabel {
    font-size: 12px;
    color: #d5b46a;
    padding: 4px 8px;
}
QLabel#counterLabel {
    font-size: 14px;
    font-weight: 650;
    color: #101114;
    padding: 4px 11px;
    background-color: #d5b46a;
    border-radius: 8px;
}

/* ===== Group Box ===== */
QGroupBox {
    background-color: #121419;
    border: 1px solid #252a32;
    border-radius: 8px;
    margin-top: 12px;
    padding: 16px;
    padding-top: 28px;
    font-weight: 600;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 14px;
    padding: 0 8px;
    color: #d5b46a;
}

/* ===== Progress Bar ===== */
QProgressBar {
    border: 1px solid #252a32;
    border-radius: 6px;
    background-color: #15171c;
    text-align: center;
    color: #f4efe4;
    height: 24px;
    font-weight: 600;
}
QProgressBar::chunk {
    background-color: #d5b46a;
    border-radius: 5px;
}

/* ===== Status Bar ===== */
QStatusBar {
    background-color: #111318;
    color: #8e8a80;
    border-top: 1px solid #252a32;
    padding: 4px;
}

/* ===== Tab Widget ===== */
QTabWidget::pane {
    border: 1px solid #252a32;
    border-radius: 8px;
    background-color: #101114;
}
QTabBar::tab {
    background-color: #15171c;
    color: #8e8a80;
    border: 1px solid #252a32;
    border-bottom: none;
    padding: 10px 22px;
    margin-right: 2px;
    border-top-left-radius: 7px;
    border-top-right-radius: 7px;
}
QTabBar::tab:selected {
    background-color: #101114;
    color: #d5b46a;
    border-bottom: 2px solid #d5b46a;
}
QTabBar::tab:hover {
    color: #f4efe4;
}

/* ===== Tooltip ===== */
QToolTip {
    background-color: #15171c;
    color: #e7e1d5;
    border: 1px solid #d5b46a;
    border-radius: 6px;
    padding: 6px 10px;
}
"""
