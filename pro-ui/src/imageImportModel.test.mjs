import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildImageImportToast,
  decorateImportedImages,
  uniqueNewImagePaths,
} from './imageImportModel.js';

test('uniqueNewImagePaths removes duplicates and already imported files', () => {
  const result = uniqueNewImagePaths(
    ['C:/a.png', 'C:/b.png', 'C:/a.png', 'C:/c.png'],
    ['C:/b.png'],
  );

  assert.deepEqual(result, ['C:/a.png', 'C:/c.png']);
});

test('decorateImportedImages adds UI defaults without mutating bridge items', () => {
  const bridgeItem = { path: 'C:/image.png', name: 'image.png' };
  const [decorated] = decorateImportedImages([bridgeItem]);

  assert.deepEqual(bridgeItem, { path: 'C:/image.png', name: 'image.png' });
  assert.equal(decorated.cropX, 0.5);
  assert.equal(decorated.cropY, 0.5);
  assert.equal(decorated.removeExif, true);
});

test('buildImageImportToast summarizes clean imports, failures, and truncation', () => {
  const clean = buildImageImportToast({ items: [{}, {}], failures: [] }, { fileBaseName: value => value });
  assert.equal(clean.type, 'success');
  assert.match(clean.title, /2/);

  const warning = buildImageImportToast(
    { items: [{}], failures: [{ path: 'bad.webp' }], truncated: true, limit: 500 },
    { fileBaseName: value => value },
  );
  assert.equal(warning.type, 'warning');
  assert.match(warning.detail, /bad\.webp|500/);
});
