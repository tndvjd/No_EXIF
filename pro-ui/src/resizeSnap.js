function clampInt(value, min, max) {
  const next = Number.isFinite(Number(value)) ? Math.round(Number(value)) : min;
  return Math.min(max, Math.max(min, next));
}

export function snapResizeToGrid(cell, corner, pointer, frame) {
  const colStep = frame.unitW + frame.gap;
  const rowStep = frame.unitH + frame.gap;
  const next = {
    row: cell.row,
    col: cell.col,
    rowSpan: cell.rowSpan,
    colSpan: cell.colSpan,
  };

  if (corner.includes('right')) {
    next.colSpan = clampInt(
      (pointer.x + frame.gap) / colStep,
      1,
      frame.cols - cell.col,
    );
  }

  if (corner.includes('bottom')) {
    next.rowSpan = clampInt(
      (pointer.y + frame.gap) / rowStep,
      1,
      frame.rows - cell.row,
    );
  }

  if (corner.includes('left')) {
    const delta = clampInt(
      pointer.x / colStep,
      -cell.col,
      cell.colSpan - 1,
    );
    next.col = cell.col + delta;
    next.colSpan = cell.colSpan - delta;
  }

  if (corner.includes('top')) {
    const delta = clampInt(
      pointer.y / rowStep,
      -cell.row,
      cell.rowSpan - 1,
    );
    next.row = cell.row + delta;
    next.rowSpan = cell.rowSpan - delta;
  }

  return next;
}

export function resizeHandleCenter(cell, corner, rect, frame) {
  const colStep = frame.unitW + frame.gap;
  const rowStep = frame.unitH + frame.gap;
  const left = (rect.col - cell.col) * colStep;
  const top = (rect.row - cell.row) * rowStep;
  const width = rect.colSpan * frame.unitW + (rect.colSpan - 1) * frame.gap;
  const height = rect.rowSpan * frame.unitH + (rect.rowSpan - 1) * frame.gap;

  return {
    x: corner.includes('left') ? left : left + width,
    y: corner.includes('top') ? top : top + height,
  };
}

export function resizeInteraction(cell, corner, pointer, frame, snapEnabled = true) {
  const rect = snapResizeToGrid(cell, corner, pointer, frame);
  return {
    rect,
    handleCenter: snapEnabled ? resizeHandleCenter(cell, corner, rect, frame) : pointer,
  };
}
