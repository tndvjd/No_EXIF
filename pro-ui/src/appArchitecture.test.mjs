import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('App delegates mode rendering to ModeSwitchboard', () => {
  const source = fs.readFileSync('pro-ui/src/App.jsx', 'utf8');

  assert.match(source, /import \{ ModeSwitchboard \} from '\.\/ModeSwitchboard\.jsx';/);
  assert.doesNotMatch(source, /const modeBody = activeMode ===/);
});

test('App delegates import-heavy workflows to focused controllers', () => {
  const source = fs.readFileSync('pro-ui/src/App.jsx', 'utf8');

  assert.match(source, /import \{ useImageImportController \} from '\.\/useImageImportController\.js';/);
  assert.match(source, /import \{ usePixivImportController \} from '\.\/usePixivImportController\.js';/);
  assert.doesNotMatch(source, /async function importImagePaths/);
  assert.doesNotMatch(source, /async function addImages/);
  assert.doesNotMatch(source, /function handleDragOver/);
  assert.doesNotMatch(source, /async function listPixivWorks/);
  assert.doesNotMatch(source, /async function downloadPixivWorks/);
});

test('App delegates prompt-share actions to a focused controller', () => {
  const source = fs.readFileSync('pro-ui/src/App.jsx', 'utf8');

  assert.match(source, /import \{ usePromptShareController \} from '\.\/usePromptShareController\.js';/);
  assert.doesNotMatch(source, /function updatePromptSetting/);
  assert.doesNotMatch(source, /async function exportPromptCard/);
  assert.doesNotMatch(source, /async function copyPromptSharePrompt/);
  assert.doesNotMatch(source, /function sendSelectedImageToPromptShare/);
});

test('App delegates grid, EXIF, and metadata actions to focused controllers', () => {
  const source = fs.readFileSync('pro-ui/src/App.jsx', 'utf8');

  assert.match(source, /import \{ useGridController \} from '\.\/useGridController\.js';/);
  assert.match(source, /import \{ useExifExportController \} from '\.\/useExifExportController\.js';/);
  assert.match(source, /import \{ useMetadataActions \} from '\.\/useMetadataActions\.js';/);
  assert.doesNotMatch(source, /function handleMerge/);
  assert.doesNotMatch(source, /async function exportGrid/);
  assert.doesNotMatch(source, /async function exportCleanImages/);
  assert.doesNotMatch(source, /async function saveSelectedMetadataJson/);
  assert.doesNotMatch(source, /async function openSelectedImageLocation/);
  assert.doesNotMatch(source, /function requestGridReset/);
});

test('App stays below the orchestration line budget', () => {
  const source = fs.readFileSync('pro-ui/src/App.jsx', 'utf8');

  assert.ok(
    source.split('\n').length <= 760,
    'App.jsx should stay under 760 lines so feature logic lives in focused modules',
  );
});

test('prompt card renderer delegates template and settings model', () => {
  const source = fs.readFileSync('pro-ui/src/promptCardRenderer.js', 'utf8');

  assert.match(source, /from '\.\/promptCardModel\.js';/);
  assert.doesNotMatch(source, /export const PROMPT_CARD_TEMPLATES =/);
  assert.doesNotMatch(source, /export function resolvePromptCardSettings/);
  assert.ok(
    source.split('\n').length <= 850,
    'promptCardRenderer.js should stay focused on canvas drawing',
  );
});

test('global CSS is split into focused style modules', () => {
  const manifest = fs.readFileSync('pro-ui/src/styles.css', 'utf8');
  const imports = [...manifest.matchAll(/@import\s+"\.\/styles\/([^"]+\.css)";/g)]
    .map(match => match[1]);

  assert.deepEqual(imports, [
    'base.css',
    'navigation.css',
    'workspace-shared.css',
    'exif.css',
    'grid.css',
    'metadata.css',
    'prompt-share.css',
    'feedback.css',
    'refinements.css',
    'pixiv.css',
    'responsive.css',
  ]);
  assert.ok(manifest.split('\n').length <= 20, 'styles.css should stay an import manifest');

  for (const fileName of imports) {
    const css = fs.readFileSync(`pro-ui/src/styles/${fileName}`, 'utf8');
    assert.ok(
      css.split('\n').length <= 750,
      `${fileName} should stay small enough to own one styling area`,
    );
  }
});
