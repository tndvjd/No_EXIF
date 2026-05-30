import { resizeCell } from './gridModel.js';

export function previewResizeCells(cells, cellId, rows, cols, nextRect) {
  const result = resizeCell(cells, cellId, rows, cols, nextRect);
  if (result.error) {
    return {
      cells: null,
      error: result.error,
    };
  }

  return {
    cells: result.cells,
    error: '',
  };
}
