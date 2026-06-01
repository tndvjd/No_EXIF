import assert from 'node:assert/strict';
import test from 'node:test';

import {
  IMPORT_IMAGE_LIMIT,
  initialPixivState,
  initialPromptSettings,
  initialSettings,
  modeNotices,
  pixivMockItems,
} from './appConstants.js';

test('app constants expose stable defaults outside App.jsx', () => {
  assert.equal(IMPORT_IMAGE_LIMIT, 500);
  assert.equal(initialSettings.rows, 4);
  assert.equal(initialSettings.cols, 5);
  assert.equal(initialPromptSettings.template, 'magazine');
});

test('mode notices cover every top-level mode', () => {
  for (const mode of ['exif', 'grid', 'metadata', 'prompt-share', 'pixiv']) {
    assert.equal(typeof modeNotices[mode], 'string');
    assert.ok(modeNotices[mode].length > 8);
  }
});

test('initial Pixiv state keeps request and selection defaults together', () => {
  assert.equal(initialPixivState.limit, 48);
  assert.equal(initialPixivState.workers, 4);
  assert.equal(initialPixivState.downloadMode, '선택한 이미지만');
  assert.deepEqual(initialPixivState.resultCounts, { downloaded: 0, skipped: 0, failed: 0 });
});

test('Pixiv mock items remain immutable sample inputs', () => {
  assert.ok(pixivMockItems.length >= 3);
  assert.equal(pixivMockItems[0].selected, true);
  assert.notEqual(pixivMockItems[0], initialPixivState.items[0]);
});
