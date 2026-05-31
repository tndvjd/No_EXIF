# Private Command Workbench Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert No EXIF Pro's Electron/React shell into the C-direction Private Command Workbench: clean, fast, private, command-first, graphite/amber, and premium motion without purple/blue AI-gradient SaaS styling.

**Architecture:** Keep the existing Electron + React + Vite + Python bridge. Add a pure command palette model first, then wire a React command palette overlay into `App.jsx`, then apply GSAP only to stateful overlay/selection motion. CSS carries the visual system through tokens so later screens can share one restrained design language.

**Tech Stack:** Electron, React 18, Vite, Node test runner, Python unittest, Playwright Electron QA, GSAP.

---

## File Structure

- Create `pro-ui/src/commandPaletteModel.js`: pure command definitions, filtering, disabled-state rules, and context-derived action list.
- Create `pro-ui/src/commandPaletteModel.test.mjs`: RED/GREEN tests for command palette behavior.
- Create `pro-ui/src/CommandPalette.jsx`: React overlay component with keyboard-accessible rows.
- Modify `pro-ui/src/App.jsx`: palette state, keyboard shortcut, command execution, and overlay render.
- Modify `pro-ui/src/ModeRail.jsx`: cleaned mode labels and command-friendly rail copy.
- Modify `pro-ui/src/TopBar.jsx`: compact private/local status and command affordance.
- Modify `pro-ui/src/styles.css`: graphite/amber tokens, palette overlay, refined rails/topbar/buttons, motion rules, reduced-motion fallback.
- Modify `package.json` and `package-lock.json`: add GSAP if used in production code.
- Modify `tools/electron_qa.cjs`: assert command palette opens, has no mojibake, and CSS avoids banned AI-gradient tokens.

---

### Task 1: Command Palette Model

**Files:**
- Create: `pro-ui/src/commandPaletteModel.js`
- Create: `pro-ui/src/commandPaletteModel.test.mjs`

- [ ] **Step 1: Write the failing tests**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCommandPaletteActions,
  filterCommandPaletteActions,
  findCommandPaletteAction,
} from './commandPaletteModel.js';

test('command palette exposes the core private workbench actions', () => {
  const actions = buildCommandPaletteActions({
    activeMode: 'exif',
    imageCount: 3,
    exifTargetCount: 2,
    promptCount: 1,
    pixivCount: 0,
    busy: false,
  });

  assert.deepEqual(
    actions.map(action => action.id),
    [
      'add-images',
      'remove-exif',
      'open-grid',
      'open-metadata',
      'open-prompt-share',
      'open-pixiv',
    ],
  );
  assert.equal(actions[0].title, '이미지 추가');
  assert.equal(actions[1].scope, 'Privacy');
  assert.equal(actions[2].shortcut, 'G');
});

test('command palette disables destructive or export actions when context is not ready', () => {
  const actions = buildCommandPaletteActions({
    activeMode: 'exif',
    imageCount: 0,
    exifTargetCount: 0,
    promptCount: 0,
    pixivCount: 0,
    busy: false,
  });

  assert.equal(findCommandPaletteAction(actions, 'remove-exif').disabled, true);
  assert.match(findCommandPaletteAction(actions, 'remove-exif').disabledReason, /이미지/);
  assert.equal(findCommandPaletteAction(actions, 'open-prompt-share').disabled, true);
});

test('command palette filters by title helper scope and shortcut', () => {
  const actions = buildCommandPaletteActions({
    activeMode: 'metadata',
    imageCount: 4,
    exifTargetCount: 2,
    promptCount: 1,
    pixivCount: 0,
    busy: false,
  });

  assert.deepEqual(filterCommandPaletteActions(actions, 'privacy').map(action => action.id), ['remove-exif']);
  assert.deepEqual(filterCommandPaletteActions(actions, 'workflow').map(action => action.id), ['open-metadata']);
  assert.deepEqual(filterCommandPaletteActions(actions, 'p').map(action => action.id).includes('open-prompt-share'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test pro-ui/src/commandPaletteModel.test.mjs`

Expected: FAIL with `Cannot find module` or missing export for `commandPaletteModel.js`.

- [ ] **Step 3: Write minimal implementation**

Implement `buildCommandPaletteActions(context)`, `filterCommandPaletteActions(actions, query)`, and `findCommandPaletteAction(actions, id)` with plain JavaScript objects. Keep UI icons out of this file.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test pro-ui/src/commandPaletteModel.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run JS suite**

Run: `npm run test:js`

Expected: 0 failures.

---

### Task 2: Command Palette UI and App Wiring

**Files:**
- Create: `pro-ui/src/CommandPalette.jsx`
- Modify: `pro-ui/src/App.jsx`
- Modify: `pro-ui/src/styles.css`
- Test: `npm run build`

- [ ] **Step 1: Add the overlay component**

Create `CommandPalette.jsx` with:
- `open`, `actions`, `query`, `selectedIndex`, `onQueryChange`, `onSelectedIndexChange`, `onRun`, and `onClose` props.
- A dialog-like overlay with `role="dialog"` and `aria-label="Command palette"`.
- A search input that receives auto focus.
- ArrowUp, ArrowDown, Enter, and Escape handling.
- Disabled rows visible but not executable.

- [ ] **Step 2: Wire state into App**

In `App.jsx`:
- Import `CommandPalette`.
- Import `buildCommandPaletteActions` and `filterCommandPaletteActions`.
- Add `commandOpen`, `commandQuery`, and `commandSelectedIndex` state.
- Open palette with `Ctrl+K` or `Meta+K`.
- Run actions by dispatching existing functions: `addImages`, `handleExifExport`, `changeMode('grid')`, `changeMode('metadata')`, `changeMode('prompt-share')`, `changeMode('pixiv')`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: PASS with Vite output and no JSX syntax errors.

---

### Task 3: GSAP Overlay Motion

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `pro-ui/src/CommandPalette.jsx`
- Modify: `pro-ui/src/styles.css`

- [ ] **Step 1: Install GSAP**

Run: `npm install gsap`

Expected: `gsap` appears in `dependencies`.

- [ ] **Step 2: Add motion with cleanup**

In `CommandPalette.jsx`, use `useEffect`, a container ref, and `gsap.context()` so animations are scoped and reverted on unmount. Animate only `autoAlpha`, `y`, and `scale`. Use reduced-motion detection and skip movement when `prefers-reduced-motion: reduce` matches.

- [ ] **Step 3: Verify build and tests**

Run: `npm run build && npm run test:js`

Expected: PASS.

---

### Task 4: Private Workbench Styling

**Files:**
- Modify: `pro-ui/src/styles.css`
- Modify: `pro-ui/src/ModeRail.jsx`
- Modify: `pro-ui/src/TopBar.jsx`

- [ ] **Step 1: Apply design tokens**

Set CSS tokens from `DESIGN.md`: `#0B0D10`, `#101317`, `#15191E`, `#1B2027`, `#2A3038`, `#F3F0E8`, `#B4AFA5`, `#777D76`, `#E4B85E`, `#F2CF7A`, `#78B66F`, and `#D8665A`.

- [ ] **Step 2: Refine shell**

Mode rail should feel icon-first, compact, and command-oriented. Top bar should show local/private status, image count, and a visible `Ctrl K` command hint.

- [ ] **Step 3: Add banned-style guardrails**

Avoid purple/blue gradient backgrounds, neon glow, decorative bokeh/orbs, and glass cards. Keep standard panels flat, with tonal layering and dividers.

- [ ] **Step 4: Verify CSS and build**

Run: `npm run build`

Expected: PASS.

---

### Task 5: Electron QA Coverage

**Files:**
- Modify: `tools/electron_qa.cjs`

- [ ] **Step 1: Add command palette QA**

After the app launches, send `ControlOrMeta+K`, assert the palette is visible, assert it contains `이미지 추가`, type `metadata`, assert metadata command remains visible, press `Escape`, and assert the overlay closes.

- [ ] **Step 2: Add visual anti-pattern QA**

Read `pro-ui/src/styles.css` and assert banned generic AI visual tokens are absent: `purple`, `violet`, `aurora`, `bokeh`, `orb`, `background-clip: text`, and `linear-gradient(135deg, #20264b`.

- [ ] **Step 3: Run E2E**

Run: `npm run test:e2e`

Expected: PASS and no mojibake or overflow failures.

---

### Task 6: Final Verification

**Files:**
- No new files expected.

- [ ] **Step 1: Full verification**

Run: `npm run verify`

Expected: build, JS tests, Python tests, Electron QA, and audit all pass.

- [ ] **Step 2: Inspect final diff**

Run: `git diff --stat`

Expected: changed files are limited to the planned UI/design/test/dependency files plus existing cleanup/docs changes.

- [ ] **Step 3: Report clearly**

Summarize what changed, which commands passed, and any visual QA limitations.
