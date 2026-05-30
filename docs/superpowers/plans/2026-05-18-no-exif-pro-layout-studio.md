# No EXIF Pro Layout Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild No EXIF as a premium local desktop photo privacy and custom grid layout studio while preserving the existing Python/Pillow image-processing engine.

**Architecture:** Keep the current PyQt app intact as a legacy fallback. Add an Electron desktop shell with a React/Konva renderer for the premium three-panel UI, and call a small Python bridge for EXIF inspection, thumbnail generation, and EXIF-free grid export. Electron is selected over Tauri for this workspace because Node/npm are installed but Rust/Cargo are not.

**Tech Stack:** Electron, React, Konva/react-konva, Vite, Python 3.10, Pillow, unittest, Node built-in test runner.

---

### Task 1: Technology Spike And Baseline

**Files:**
- Read: `src/image_processor.py`
- Read: `tests/test_image_processor.py`
- Create: `docs/superpowers/plans/2026-05-18-no-exif-pro-layout-studio.md`

- [x] Verify Node/npm availability.
- [x] Verify Rust/Cargo availability.
- [x] Run Python regression tests.
- [x] Choose Electron + React + Konva because it can be implemented immediately in this workspace without installing Rust.

### Task 2: Python Bridge And Custom Export Engine

**Files:**
- Modify: `src/image_processor.py`
- Create: `tools/noexif_bridge.py`
- Test: `tests/test_image_processor.py`

- [x] Add a custom grid export function that accepts row/column spans.
- [x] Add tests proving custom grid output size and EXIF-free export.
- [x] Add a JSON bridge with `inspect` and `export` commands.
- [x] Keep current PyQt processing functions compatible.

### Task 3: Electron App Shell

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.js`
- Create: `electron/main.cjs`
- Create: `electron/preload.cjs`

- [x] Add Vite/Electron scripts.
- [x] Add native image-open and export-save dialogs.
- [x] Call the Python bridge from Electron main process.
- [x] Expose a small safe API through preload.

### Task 4: Layout Studio UI

**Files:**
- Create: `pro-ui/src/main.jsx`
- Create: `pro-ui/src/App.jsx`
- Create: `pro-ui/src/ImageTray.jsx`
- Create: `pro-ui/src/LayoutCanvas.jsx`
- Create: `pro-ui/src/Inspector.jsx`
- Create: `pro-ui/src/styles.css`

- [x] Build the premium three-panel interface.
- [x] Implement image tray, privacy badges, and selection count.
- [x] Implement Konva custom grid canvas with selected cells and merged cells.
- [x] Implement inspector controls for rows, columns, gap, radius, background, export size, format, and quality.
- [x] Implement export flow through Electron and Python bridge.

### Task 5: Grid Model Tests

**Files:**
- Create: `pro-ui/src/gridModel.js`
- Create: `pro-ui/src/gridModel.test.mjs`

- [x] Add pure JS helpers for grid creation, cell sorting, merge validation, merge, and unmerge.
- [x] Test rectangular merge success.
- [x] Test invalid merge failure.
- [x] Test unmerge restores unit cells.

### Task 6: Windows Launchers And QA

**Files:**
- Modify: `run.bat`
- Create: `run_legacy_pyqt.bat`

- [x] Make `run.bat` install npm dependencies when needed, build the renderer, and launch Electron.
- [x] Preserve a legacy PyQt launcher.
- [x] Run Python tests, JS tests, renderer build, and a headless bridge export smoke test.
- [x] Confirm generated exports do not contain EXIF.
