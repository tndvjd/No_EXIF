# No EXIF Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the review findings from the May 29 codebase audit: broken Korean UI text, incomplete Pixiv controls, large-folder safety, Electron hardening, bundle splitting/refactoring, and Git registration readiness.

**Architecture:** Keep the existing Electron + React + Konva shell and Python/Pillow bridge. Add small pure helpers with tests before wiring UI behavior, keep Electron IPC as the filesystem boundary, and verify with unit tests, build, E2E, and screenshot review.

**Tech Stack:** Electron, React 18, Vite, Konva/react-konva, Python 3, Pillow, pixivpy3, Node test runner, Python unittest, Playwright/Electron QA.

---

### Task 1: Korean UI Text and Encoding Guard

**Files:**
- Modify: `pro-ui/src/App.jsx`
- Modify: `pro-ui/src/PixivImportMode.jsx`
- Modify: `electron/main.cjs`
- Create: `pro-ui/src/textQuality.test.mjs`

- [ ] Add a failing test that scans user-facing source files and rejects mojibake fragments such as `?대?`, `硫뷀`, `洹몃`, `쨌`, and malformed JSX text.
- [ ] Replace broken Korean labels, toast titles, dialog titles, comments, and copy labels with readable Korean.
- [ ] Run `node --test pro-ui/src/textQuality.test.mjs`.
- [ ] Run `npm run test:js`.

### Task 2: Pixiv Controls Become Real Behavior

**Files:**
- Modify: `pro-ui/src/pixivImportUtils.js`
- Modify: `pro-ui/src/pixivImportUtils.test.mjs`
- Modify: `pro-ui/src/PixivImportMode.jsx`
- Modify: `pro-ui/src/App.jsx`
- Modify: `tools/pixiv_bridge.py`
- Modify: `tests/test_pixiv_bridge.py`

- [ ] Add failing JS tests for filtering by query, filtering already-downloaded items, and choosing selected-only/all/new-only download candidates.
- [ ] Add failing Python tests for Pixiv download naming mode and bounded worker/retry payload validation.
- [ ] Implement Pixiv list filtering and queue selection helpers in `pixivImportUtils.js`.
- [ ] Wire `PixivImportMode.jsx` to render filtered items and pass stable item indexes for toggling.
- [ ] Wire `App.jsx` to send download mode, naming mode, and worker count to the bridge.
- [ ] Implement naming mode and bounded worker support in `tools/pixiv_bridge.py`.
- [ ] Run `npm run test:js` and `npm run test:py`.

### Task 3: Large Folder Import Safety

**Files:**
- Modify: `tools/noexif_bridge.py`
- Modify: `tests/test_noexif_bridge.py`
- Modify: `pro-ui/src/App.jsx`

- [ ] Add a failing Python test proving directory expansion stops at a maximum file count and reports the skipped remainder.
- [ ] Add a failing UI/helper test if a new JS helper is needed for displaying the warning.
- [ ] Add `maxFiles` support to `inspect_images()` and include `truncated`, `scanned`, and `limit` in the bridge response.
- [ ] Pass a conservative import limit from `App.jsx` and show a warning toast when truncation occurs.
- [ ] Run `npm run test:py` and `npm run test:js`.

### Task 4: Electron Security and Git Hygiene

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/security.test.cjs`
- Modify: `.gitignore`

- [ ] Add or update security tests for trusted origin behavior and any new security helper.
- [ ] Try `sandbox: true`; if Electron preload compatibility breaks, document why and keep `sandbox: false` with a focused TODO-free test-backed hardening alternative.
- [ ] Add a conservative Content Security Policy through Electron response headers or packaged HTML where compatible with Vite output.
- [ ] Expand `.gitignore` to exclude all generated QA, output, downloads, caches, and logs.
- [ ] Run `npm run test:js`, `npm run build`, and `npm run test:e2e`.
- [ ] Initialize local Git after generated files are ignored.

### Task 5: Bundle Split and React Refactor

**Files:**
- Modify: `pro-ui/src/App.jsx`
- Modify: `pro-ui/src/main.jsx` if Suspense boundary is cleaner there
- Modify: `vite.config.js` if manual chunks are needed

- [ ] Add lazy loading for heavy modes, starting with `PromptShareMode` and `PixivImportMode`.
- [ ] Keep user-visible fallback compact and non-disruptive.
- [ ] Add manual chunks only if lazy loading alone does not remove the Vite chunk warning.
- [ ] Run `npm run build` and confirm the main chunk warning is gone or materially reduced with documented evidence.

### Task 6: Final Verification and QA Review

**Files:**
- No source files unless verification finds issues.

- [ ] Run `npm run verify`.
- [ ] Inspect fresh screenshots from `npm run test:e2e` for broken Korean text, overlapping toast content, and Pixiv/Grid/Metadata/Prompt-share regressions.
- [ ] Dispatch a final review subagent to check spec compliance and code quality across all changes.
- [ ] Close subagents, summarize exact changes, tests, Git state, and remaining risks.
