import assert from 'node:assert/strict';
import test from 'node:test';
import { resizeHandleCenter, resizeInteraction, snapResizeToGrid } from './resizeSnap.js';

const frame = {
  unitW: 100,
  unitH: 80,
  gap: 10,
  rows: 5,
  cols: 5,
};

test('snapResizeToGrid expands right and bottom edges by grid steps', () => {
  const cell = { row: 1, col: 1, rowSpan: 2, colSpan: 2 };
  assert.deepEqual(
    snapResizeToGrid(cell, 'bottom-right', { x: 265, y: 240 }, frame),
    { row: 1, col: 1, rowSpan: 3, colSpan: 3 },
  );
});

test('snapResizeToGrid lets left edge expand to the previous column', () => {
  const cell = { row: 1, col: 1, rowSpan: 2, colSpan: 2 };
  assert.deepEqual(
    snapResizeToGrid(cell, 'top-left', { x: -96, y: 0 }, frame),
    { row: 1, col: 0, rowSpan: 2, colSpan: 3 },
  );
});

test('snapResizeToGrid clamps edges so a cell never collapses', () => {
  const cell = { row: 0, col: 0, rowSpan: 2, colSpan: 2 };
  assert.deepEqual(
    snapResizeToGrid(cell, 'bottom-right', { x: 2, y: 2 }, frame),
    { row: 0, col: 0, rowSpan: 1, colSpan: 1 },
  );
});

test('resizeHandleCenter returns snapped handle position in local cell coordinates', () => {
  const cell = { row: 1, col: 1, rowSpan: 2, colSpan: 2 };
  const rect = { row: 1, col: 0, rowSpan: 2, colSpan: 3 };
  assert.deepEqual(
    resizeHandleCenter(cell, 'top-left', rect, frame),
    { x: -110, y: 0 },
  );
});

test('resizeInteraction keeps the handle on-grid when snap is enabled', () => {
  const cell = { row: 1, col: 1, rowSpan: 2, colSpan: 2 };
  const result = resizeInteraction(cell, 'bottom-right', { x: 265, y: 238 }, frame, true);

  assert.deepEqual(result.rect, { row: 1, col: 1, rowSpan: 3, colSpan: 3 });
  assert.deepEqual(result.handleCenter, { x: 320, y: 260 });
});

test('resizeInteraction lets the handle follow the pointer when snap is disabled', () => {
  const cell = { row: 1, col: 1, rowSpan: 2, colSpan: 2 };
  const result = resizeInteraction(cell, 'bottom-right', { x: 265, y: 238 }, frame, false);

  assert.deepEqual(result.rect, { row: 1, col: 1, rowSpan: 3, colSpan: 3 });
  assert.deepEqual(result.handleCenter, { x: 265, y: 238 });
});
