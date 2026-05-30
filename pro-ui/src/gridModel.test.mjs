import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignImages,
  clearCellImages,
  canMerge,
  createGrid,
  hydrateTemplate,
  mergeCells,
  moveCellBlock,
  moveCellImage,
  removeImageAtIndex,
  restoreImageToFirstEmptyCell,
  resizeCell,
  serializeTemplate,
  sanitizeGridSettings,
  unmergeCells,
  updateImageCrop,
  recommendGridSize,
  validateGridLayout,
} from './gridModel.js';

test('mergeCells merges a rectangular selection', () => {
  const cells = createGrid(2, 2);
  const selected = cells.filter(cell => cell.row === 0).map(cell => cell.id);
  const result = mergeCells(cells, selected);

  assert.equal(result.error, '');
  assert.ok(result.mergedId);
  assert.equal(result.cells.length, 3);
  const merged = result.cells.find(cell => cell.row === 0 && cell.col === 0);
  assert.equal(merged.rowSpan, 1);
  assert.equal(merged.colSpan, 2);
});

test('canMerge rejects a non-rectangular selection', () => {
  const cells = createGrid(2, 2);
  const selected = cells
    .filter(cell => (cell.row === 0 && cell.col === 0) || (cell.row === 1 && cell.col === 1))
    .map(cell => cell.id);
  const result = canMerge(cells, selected);

  assert.equal(result.ok, false);
});

test('canMerge explains why a diagonal selection cannot be merged', () => {
  const cells = createGrid(2, 2);
  const selected = cells
    .filter(cell => (cell.row === 0 && cell.col === 0) || (cell.row === 1 && cell.col === 1))
    .map(cell => cell.id);
  const result = canMerge(cells, selected);

  assert.equal(result.ok, false);
  assert.match(result.reason, /직사각형/);
});

test('unmergeCells restores merged cells into unit cells', () => {
  const cells = createGrid(2, 2);
  const selected = cells.filter(cell => cell.row === 0).map(cell => cell.id);
  const merged = mergeCells(cells, selected).cells;
  const mergedCell = merged.find(cell => cell.row === 0 && cell.col === 0);
  const result = unmergeCells(merged, [mergedCell.id]);

  assert.equal(result.changed, true);
  assert.equal(result.cells.length, 4);
  assert.equal(result.cells.every(cell => cell.rowSpan === 1 && cell.colSpan === 1), true);
});

test('unmergeCells returns the restored cell ids so the UI can keep them selected', () => {
  const cells = createGrid(2, 2);
  const merged = mergeCells(cells, cells.map(cell => cell.id)).cells;
  const mergedCell = merged.find(cell => cell.row === 0 && cell.col === 0);
  const result = unmergeCells(merged, [mergedCell.id]);
  const restored = result.cells.filter(cell => result.unmergedIds.includes(cell.id));

  assert.equal(result.changed, true);
  assert.equal(result.unmergedIds.length, 4);
  assert.equal(restored.length, 4);
  assert.equal(restored.every(cell => cell.rowSpan === 1 && cell.colSpan === 1), true);
});

test('resizeCell expands a cell and absorbs fully covered neighbors', () => {
  const cells = createGrid(2, 3);
  const target = cells.find(cell => cell.row === 0 && cell.col === 0);
  const result = resizeCell(cells, target.id, 2, 3, {
    row: 0,
    col: 0,
    rowSpan: 1,
    colSpan: 2,
  });

  assert.equal(result.error, '');
  assert.equal(result.cells.length, 5);
  const resized = result.cells.find(cell => cell.row === 0 && cell.col === 0);
  assert.equal(resized.colSpan, 2);
});

test('resizeCell preserves the resized cell image assignment', () => {
  const cells = createGrid(2, 3);
  const target = cells.find(cell => cell.row === 0 && cell.col === 1);
  const result = resizeCell(cells, target.id, 2, 3, {
    row: 0,
    col: 0,
    rowSpan: 1,
    colSpan: 2,
  });

  assert.equal(result.error, '');
  const resized = result.cells.find(cell => cell.id === target.id);
  assert.equal(resized.imageIndex, target.imageIndex);
});

test('mergeCells preserves the top-left selected image assignment', () => {
  const cells = createGrid(2, 2);
  const selected = cells.filter(cell => cell.row === 0).map(cell => cell.id);
  const firstImageIndex = cells.find(cell => cell.row === 0 && cell.col === 0).imageIndex;
  const result = mergeCells(cells, selected);

  assert.equal(result.error, '');
  const merged = result.cells.find(cell => cell.id === result.mergedId);
  assert.equal(merged.imageIndex, firstImageIndex);
});

test('assignImages preserves deliberately empty cells', () => {
  const cells = [
    { row: 0, col: 0, rowSpan: 1, colSpan: 1, imageIndex: null },
    { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
  ];
  const result = assignImages(cells);

  assert.equal(result[0].imageIndex, null);
  assert.equal(result[1].imageIndex, 0);
});

test('moveCellImage swaps occupied cell image assignments', () => {
  const cells = createGrid(2, 2);
  const source = cells[0];
  const target = cells[3];
  const result = moveCellImage(cells, source.id, target.id);

  assert.equal(result.changed, true);
  assert.equal(result.cells.find(cell => cell.id === source.id).imageIndex, target.imageIndex);
  assert.equal(result.cells.find(cell => cell.id === target.id).imageIndex, source.imageIndex);
});

test('moveCellImage moves an image into an empty cell', () => {
  const cells = createGrid(2, 2).map((cell, index) => (
    index === 3 ? { ...cell, imageIndex: null } : cell
  ));
  const source = cells[0];
  const target = cells[3];
  const result = moveCellImage(cells, source.id, target.id);

  assert.equal(result.changed, true);
  assert.equal(result.cells.find(cell => cell.id === source.id).imageIndex, null);
  assert.equal(result.cells.find(cell => cell.id === target.id).imageIndex, source.imageIndex);
});

test('clearCellImages empties selected grid cells', () => {
  const cells = createGrid(2, 2);
  const selected = [cells[0].id, cells[2].id];
  const result = clearCellImages(cells, selected);

  assert.equal(result.changed, true);
  assert.equal(result.cells.find(cell => cell.id === cells[0].id).imageIndex, null);
  assert.equal(result.cells.find(cell => cell.id === cells[2].id).imageIndex, null);
});

test('removeImageAtIndex removes image and rewrites later grid references', () => {
  const images = ['a', 'b', 'c', 'd'].map(name => ({ name, path: `${name}.png` }));
  const cells = createGrid(2, 2);
  const result = removeImageAtIndex(images, cells, 1);

  assert.deepEqual(result.images.map(image => image.name), ['a', 'c', 'd']);
  assert.equal(result.cells[0].imageIndex, 0);
  assert.equal(result.cells[1].imageIndex, null);
  assert.equal(result.cells[2].imageIndex, 1);
  assert.equal(result.cells[3].imageIndex, 2);
});

test('restoreImageToFirstEmptyCell appends image and fills the first empty cell', () => {
  const images = ['a', 'b'].map(name => ({ name, path: `${name}.png` }));
  const cells = createGrid(2, 2).map((cell, index) => (
    index === 1 ? { ...cell, imageIndex: null } : cell
  ));
  const result = restoreImageToFirstEmptyCell(images, cells, { name: 'c', path: 'c.png' });

  assert.equal(result.changed, true);
  assert.deepEqual(result.images.map(image => image.name), ['a', 'b', 'c']);
  assert.equal(result.cells[1].imageIndex, 2);
});

test('moveCellBlock moves a merged cell and leaves empty cells behind', () => {
  const cells = createGrid(2, 3);
  const merged = mergeCells(cells, cells.filter(cell => cell.row === 0 && cell.col < 2).map(cell => cell.id)).cells;
  const target = merged.find(cell => cell.row === 0 && cell.col === 0);
  const result = moveCellBlock(merged, target.id, 2, 3, { row: 1, col: 1 });

  assert.equal(result.changed, true);
  const moved = result.cells.find(cell => cell.id === target.id);
  assert.equal(moved.row, 1);
  assert.equal(moved.col, 1);
  assert.equal(moved.rowSpan, 1);
  assert.equal(moved.colSpan, 2);
  assert.ok(result.cells.some(cell => cell.row === 0 && cell.col === 0));
  assert.ok(result.cells.some(cell => cell.row === 0 && cell.col === 1));
  assert.equal(validateGridLayout(2, 3, result.cells).ok, true);
});

test('moveCellBlock splits partially covered merged cells instead of failing', () => {
  const cells = createGrid(3, 3);
  const firstMerge = mergeCells(cells, cells.filter(cell => cell.row < 2 && cell.col < 2).map(cell => cell.id)).cells;
  const secondMerge = mergeCells(firstMerge, firstMerge.filter(cell => cell.row === 0 && cell.col === 2).map(cell => cell.id)).cells;
  const target = secondMerge.find(cell => cell.row === 0 && cell.col === 0);
  const result = moveCellBlock(secondMerge, target.id, 3, 3, { row: 1, col: 1 });

  assert.equal(result.changed, true);
  const moved = result.cells.find(cell => cell.id === target.id);
  assert.deepEqual(
    { row: moved.row, col: moved.col, rowSpan: moved.rowSpan, colSpan: moved.colSpan },
    { row: 1, col: 1, rowSpan: 2, colSpan: 2 },
  );
  assert.equal(validateGridLayout(3, 3, result.cells).ok, true);
  assert.ok(result.cells.some(cell => cell.row === 0 && cell.col === 0));
});

test('resizeCell shrink releases uncovered grid positions as unit cells', () => {
  const cells = createGrid(2, 2);
  const topRow = cells.filter(cell => cell.row === 0).map(cell => cell.id);
  const merged = mergeCells(cells, topRow).cells;
  const target = merged.find(cell => cell.row === 0 && cell.col === 0);
  const result = resizeCell(merged, target.id, 2, 2, {
    row: 0,
    col: 0,
    rowSpan: 1,
    colSpan: 1,
  });

  assert.equal(result.error, '');
  assert.equal(result.cells.length, 4);
  assert.ok(result.cells.some(cell => cell.row === 0 && cell.col === 1 && cell.colSpan === 1));
});

test('validateGridLayout rejects overlapping and out-of-bounds cells', () => {
  assert.deepEqual(validateGridLayout(2, 2, [
    { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
    { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
  ]), { ok: false, reason: '셀 영역이 서로 겹칩니다.' });

  assert.deepEqual(validateGridLayout(2, 2, [
    { row: 0, col: 0, rowSpan: 3, colSpan: 1 },
  ]), { ok: false, reason: '셀 영역이 캔버스 밖으로 나갑니다.' });
});

test('hydrateTemplate rejects malformed grid layouts', () => {
  assert.throws(() => hydrateTemplate({
    version: 1,
    settings: { rows: 2, cols: 2 },
    cells: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 },
    ],
  }), /겹칩니다/);
});

test('sanitizeGridSettings clamps unsafe numeric values and gap', () => {
  const sanitized = sanitizeGridSettings({
    rows: '',
    cols: 20,
    width: 100,
    height: 9000,
    gap: 500,
    radius: 999,
    quality: 10,
    format: 'bmp',
    background: 'red',
  });

  assert.equal(sanitized.rows, 1);
  assert.equal(sanitized.cols, 8);
  assert.equal(sanitized.width, 320);
  assert.equal(sanitized.height, 6000);
  assert.ok(sanitized.gap < 320 / (8 + 1));
  assert.equal(sanitized.quality, 70);
  assert.equal(sanitized.format, 'png');
  assert.equal(sanitized.background, '#1f1e1c');
});

test('serializeTemplate and hydrateTemplate preserve layout settings and cells', () => {
  const cells = createGrid(2, 2);
  const settings = { rows: 2, cols: 2, gap: 18, radius: 9, background: '#123456', width: 900, height: 900 };
  const payload = serializeTemplate({ name: 'Test Layout', settings, cells });
  const hydrated = hydrateTemplate(payload);

  assert.equal(payload.version, 1);
  assert.equal(hydrated.name, 'Test Layout');
  assert.equal(hydrated.settings.background, '#123456');
  assert.equal(hydrated.cells.length, 4);
  assert.ok(hydrated.cells.every(cell => typeof cell.id === 'string' && cell.id.length > 0));
});

test('updateImageCrop clamps crop focus values between 0 and 1', () => {
  const images = [{ path: 'a.jpg', cropX: 0.5, cropY: 0.5 }];
  const updated = updateImageCrop(images, 0, { cropX: 1.4, cropY: -0.2 });

  assert.equal(updated[0].cropX, 1);
  assert.equal(updated[0].cropY, 0);
  assert.equal(images[0].cropX, 0.5);
});

test('recommendGridSize chooses practical portrait grids from image count', () => {
  assert.deepEqual(recommendGridSize(1, 0.8), { rows: 1, cols: 1 });
  assert.deepEqual(recommendGridSize(3, 0.8), { rows: 2, cols: 2 });
  assert.deepEqual(recommendGridSize(6, 0.8), { rows: 3, cols: 2 });
});

test('recommendGridSize stays within supported grid limits', () => {
  assert.deepEqual(recommendGridSize(0, 0.8), { rows: 4, cols: 5 });
  assert.deepEqual(recommendGridSize(80, 0.8), { rows: 8, cols: 8 });
});
