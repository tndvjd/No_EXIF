import assert from 'node:assert/strict';
import test from 'node:test';

import {
  choosePixivDownloadItems,
  countPixivResults,
  estimatePixivBytes,
  filterPixivItems,
  normalizePixivTarget,
  selectedPixivItems,
} from './pixivImportUtils.js';

test('normalizePixivTarget trims user input', () => {
  assert.equal(normalizePixivTarget('  https://www.pixiv.net/users/73211891/illustrations  '), 'https://www.pixiv.net/users/73211891/illustrations');
});

test('selectedPixivItems keeps items selected by default', () => {
  const items = [
    { fileName: 'a.jpg' },
    { fileName: 'b.jpg', selected: false },
    { fileName: 'c.jpg', selected: true },
  ];
  assert.deepEqual(selectedPixivItems(items).map(item => item.fileName), ['a.jpg', 'c.jpg']);
});

test('countPixivResults counts download statuses', () => {
  assert.deepEqual(countPixivResults([
    { status: 'downloaded' },
    { status: 'skipped' },
    { status: 'failed' },
    { status: 'downloaded' },
  ]), { downloaded: 2, skipped: 1, failed: 1 });
});

test('estimatePixivBytes only counts selected items', () => {
  assert.equal(estimatePixivBytes([
    { sizeBytes: 100, selected: true },
    { sizeBytes: 200, selected: false },
    { sizeBytes: 300 },
  ]), 400);
});

test('filterPixivItems searches title and file name while preserving original index', () => {
  const items = [
    { title: 'Blue archive portrait', fileName: '001_a.jpg', pageCount: 1 },
    { title: 'Sketch pack', fileName: '002_pose_sheet.png', pageCount: 4 },
  ];

  assert.deepEqual(
    filterPixivItems(items, { query: 'pose' }).map(item => [item.originalIndex, item.fileName]),
    [[1, '002_pose_sheet.png']],
  );
});

test('filterPixivItems applies Pixiv candidate filters', () => {
  const items = [
    { title: 'Single image', fileName: '001_a.jpg', pageCount: 1 },
    { title: 'Manga set', fileName: '002_b.png', pageCount: 3 },
    { title: 'Already downloaded', fileName: '003_c.webp', pageCount: 1 },
  ];

  assert.deepEqual(filterPixivItems(items, { filter: '일러스트' }).map(item => item.fileName), ['001_a.jpg', '003_c.webp']);
  assert.deepEqual(filterPixivItems(items, { filter: '만화' }).map(item => item.fileName), ['002_b.png']);
  assert.deepEqual(
    filterPixivItems(items, {
      filter: '이미 받은 파일 제외',
      downloadedPaths: ['C:/Users/cdg/Pictures/003_c.webp'],
    }).map(item => item.fileName),
    ['001_a.jpg', '002_b.png'],
  );
});

test('choosePixivDownloadItems honors download mode and active filters', () => {
  const items = [
    { title: 'Selected', fileName: '001_a.jpg', selected: true, pageCount: 1 },
    { title: 'Unselected', fileName: '002_b.jpg', selected: false, pageCount: 1 },
    { title: 'Downloaded', fileName: '003_c.jpg', selected: true, pageCount: 1 },
  ];

  assert.deepEqual(
    choosePixivDownloadItems(items, {
      downloadMode: '선택한 이미지만',
      filter: '전체',
    }).map(item => item.fileName),
    ['001_a.jpg', '003_c.jpg'],
  );
  assert.deepEqual(
    choosePixivDownloadItems(items, {
      downloadMode: '새 파일만',
      downloadedPaths: ['C:/out/003_c.jpg'],
    }).map(item => item.fileName),
    ['001_a.jpg'],
  );
  assert.deepEqual(
    choosePixivDownloadItems(items, {
      downloadMode: '전체 다시 받기',
      query: 'unselected',
    }).map(item => item.fileName),
    ['002_b.jpg'],
  );
});
