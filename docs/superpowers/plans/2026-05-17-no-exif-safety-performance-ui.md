# No EXIF Safety Performance UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make No EXIF safer for privacy-sensitive image handling, faster with large batches, and visually more polished as a dark photo workspace.

**Architecture:** Keep the existing PyQt6 desktop app and Pillow image pipeline. Add focused unittest coverage first, then improve processing helpers, thread heavy work where practical, and refresh the Qt stylesheet/UI copy without migrating frameworks.

**Tech Stack:** Python, PyQt6, Pillow, unittest.

---

### Task 1: Regression Tests

**Files:**
- Create: `tests/test_image_processor.py`

- [x] Add tests for EXIF removal, batch skip behavior, round corner option, and multi-frame rejection.
- [x] Run `python -m unittest discover -v` and confirm new tests fail against current production code.

### Task 2: Image Processing Safety And Performance

**Files:**
- Modify: `src/image_processor.py`

- [x] Replace `list(img.getdata())` with lower-memory Pillow operations.
- [x] Use `ImageOps.exif_transpose()` for orientation.
- [x] Reject multi-frame GIF/TIFF explicitly before destructive conversion.
- [x] Make `batch_remove_exif()` skip unchecked files instead of copying them as `NOEXIF_`.
- [x] Use streaming copy helpers only if copy mode remains necessary.
- [x] Add `round_corners` option to `create_grid_image()`.

### Task 3: UI State And Copy

**Files:**
- Modify: `src/preview_panel.py`
- Modify: `src/main_window.py`

- [x] Separate actual EXIF count from selected removal count.
- [x] Change labels so users understand checked images are removal targets.
- [x] Make completion messages report processed/skipped counts clearly.
- [x] Keep image-card behavior compatible with existing drag-and-drop and folder import.

### Task 4: Grid Dialog And Visual Refresh

**Files:**
- Modify: `src/grid_dialog.py`
- Modify: `src/styles.py`

- [x] Pass the round-corner checkbox value into grid generation.
- [x] Improve dark photo-workspace styling: near-black canvas, quiet surfaces, refined action hierarchy, clearer focus/hover states.
- [x] Reduce noisy emoji dependency where it can break fonts.
- [x] Keep all controls usable on the existing minimum window sizes.

### Task 5: QA

**Files:**
- No required source edits unless QA finds issues.

- [x] Run `python -m compileall -q .`.
- [x] Run `python -m unittest discover -v`.
- [x] Render main window and grid dialog and inspect screenshots.
- [x] Verify sample EXIF removal and grid output manually with script.

### Final Verification

- [x] `.\.venv\Scripts\python.exe -m unittest discover -s tests -v`
- [x] `.\.venv\Scripts\python.exe -m compileall -q main.py src tests`
- [x] Added QA hardening for partial grid failures so users see failed image counts instead of a silent success.
