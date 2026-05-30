import assert from 'node:assert/strict';
import test from 'node:test';
import { createGrid, mergeCells } from './gridModel.js';
import { previewResizeCells } from './resizePreview.js';

test('previewResizeCells returns live resized cells without mutating the committed grid', () => {
  const cells = createGrid(3, 3);
  const target = cells[0];
  const result = previewResizeCells(cells, target.id, 3, 3, {
    row: 0,
    col: 0,
    rowSpan: 2,
    colSpan: 2,
  });

  assert.equal(result.error, '');
  assert.equal(result.cells.find(cell => cell.id === target.id).rowSpan, 2);
  assert.equal(result.cells.find(cell => cell.id === target.id).colSpan, 2);
  assert.equal(cells.find(cell => cell.id === target.id).rowSpan, 1);
  assert.equal(cells.find(cell => cell.id === target.id).colSpan, 1);
  assert.equal(result.cells.length, 6);
});

test('previewResizeCells clears the live preview when resize is invalid', () => {
  const cells = createGrid(3, 3);
  const verticalMergeIds = cells
    .filter(cell => cell.col === 1 && cell.row < 2)
    .map(cell => cell.id);
  const merged = mergeCells(cells, verticalMergeIds).cells;
  const target = merged.find(cell => cell.row === 0 && cell.col === 0);

  const result = previewResizeCells(merged, target.id, 3, 3, {
    row: 0,
    col: 0,
    rowSpan: 1,
    colSpan: 2,
  });

  assert.match(result.error, /일부만 덮을 수 없습니다/);
  assert.equal(result.cells, null);
});
