# No EXIF Pro V2 Finishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining Layout Studio limits: drag-resizable cells, undo/redo, custom template save/load, and per-photo crop focus that affects final exports.

**Architecture:** Stay on the current Electron + React + Konva shell and Python/Pillow bridge. Put grid behavior in pure JS model helpers with tests, keep export fidelity in the Python image engine, and expose template file IO through Electron IPC.

**Tech Stack:** Electron, React, Konva/react-konva, Python 3.10, Pillow, Node test runner, unittest.

---

### Task 1: Grid Model V2

**Files:**
- Modify: `pro-ui/src/gridModel.js`
- Test: `pro-ui/src/gridModel.test.mjs`

- [x] Add failing tests for resizing merged cells.
- [x] Implement `resizeCell()` with expansion absorbing covered neighbors and shrinking releasing unit cells.
- [x] Add template serialize/hydrate helpers.
- [x] Add image crop update helper with clamp behavior.
- [x] Run `npm run test:js`.

### Task 2: Crop-Aware Export

**Files:**
- Modify: `src/image_processor.py`
- Modify: `tools/noexif_bridge.py`
- Test: `tests/test_image_processor.py`

- [x] Add failing test proving crop focus changes custom grid output.
- [x] Add `image_crops` support to `create_custom_grid_image()`.
- [x] Pass crop focus through `tools/noexif_bridge.py`.
- [x] Run Python unit tests.

### Task 3: UI Controls

**Files:**
- Modify: `pro-ui/src/App.jsx`
- Modify: `pro-ui/src/LayoutCanvas.jsx`
- Modify: `pro-ui/src/Inspector.jsx`
- Modify: `pro-ui/src/styles.css`

- [x] Add undo/redo history for layout, settings, and image order/crop.
- [x] Add top-bar buttons for undo, redo, template load, template save, reset, and export.
- [x] Add Konva corner handles for grid-snapped cell resizing.
- [x] Add inspector crop focus sliders for the selected cell image.
- [x] Include image crop focus in export payload.

### Task 4: Template File IO

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`

- [x] Add safe IPC for template save/load dialogs.
- [x] Read/write JSON templates without exposing filesystem access to the renderer.

### Task 5: Verification

**Files:**
- No source files unless verification finds issues.

- [x] Run `npm run test:js`.
- [x] Run `.\\.venv\\Scripts\\python.exe -m unittest discover -s tests -v`.
- [x] Run `npm run build`.
- [x] Run final compile/audit/run.bat checks.
- [x] Capture and inspect a fresh UI screenshot.
