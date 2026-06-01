import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPixivDownloadPayload,
  buildPixivListState,
  clonePixivMockItems,
  downloadedPixivPaths,
} from './pixivImportController.js';

test('clonePixivMockItems returns fresh selected sample rows', () => {
  const first = clonePixivMockItems();
  const second = clonePixivMockItems();

  first[0].selected = false;
  assert.equal(second[0].selected, true);
});

test('buildPixivListState stores normalized target and selectable artist rows', () => {
  const state = buildPixivListState(
    { items: [{ selected: false }], resultCounts: { downloaded: 1, skipped: 1, failed: 1 } },
    'https://www.pixiv.net/users/123',
    { userId: '123', items: [{ illustId: 9, selected: false }] },
  );

  assert.equal(state.target, 'https://www.pixiv.net/users/123');
  assert.equal(state.items[0].artistId, '123');
  assert.equal(state.items[0].selected, false);
  assert.deepEqual(state.resultCounts, { downloaded: 0, skipped: 0, failed: 0 });
  assert.deepEqual(state.downloadedPaths, []);
});

test('buildPixivDownloadPayload keeps Electron bridge request shape in one place', () => {
  const payload = buildPixivDownloadPayload(
    {
      refreshToken: 'refresh',
      outputDir: 'C:/pixiv',
      retries: 2,
      workers: 4,
      naming: 'artistId_illustId',
      timeout: 45,
    },
    [{ illustId: 1 }],
  );

  assert.deepEqual(payload, {
    refreshToken: 'refresh',
    outputDir: 'C:/pixiv',
    items: [{ illustId: 1 }],
    retries: 2,
    workers: 4,
    naming: { mode: 'artistId_illustId' },
    requestTimeout: 45,
  });
});

test('downloadedPixivPaths returns importable downloaded and skipped paths only', () => {
  const paths = downloadedPixivPaths([
    { status: 'downloaded', path: 'C:/a.png' },
    { status: 'skipped', path: 'C:/b.png' },
    { status: 'failed', path: 'C:/c.png' },
    { status: 'downloaded', path: '' },
  ]);

  assert.deepEqual(paths, ['C:/a.png', 'C:/b.png']);
});
