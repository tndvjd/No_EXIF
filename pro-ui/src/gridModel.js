export function createGrid(rows = 4, cols = 5) {
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push(makeCell(row, col, 1, 1));
    }
  }
  return assignImages(sortCells(cells));
}

export function makeCell(row, col, rowSpan = 1, colSpan = 1) {
  return {
    id: `cell-${row}-${col}-${rowSpan}-${colSpan}-${Math.random().toString(36).slice(2, 8)}`,
    row,
    col,
    rowSpan,
    colSpan,
  };
}

export function cloneCells(cells) {
  return cells.map(cell => ({ ...cell }));
}

export function sortCells(cells) {
  return [...cells].sort((a, b) => (a.row - b.row) || (a.col - b.col));
}

export function assignImages(cells) {
  const sorted = sortCells(cells);
  const used = new Set(
    sorted
      .filter(cell => cell.imageIndex !== null)
      .map(cell => Number(cell.imageIndex))
      .filter(index => Number.isInteger(index) && index >= 0),
  );
  let nextImageIndex = 0;

  return sorted.map(cell => {
    if (cell.imageIndex === null) {
      return { ...cell, imageIndex: null };
    }
    const preserved = Number(cell.imageIndex);
    if (Number.isInteger(preserved) && preserved >= 0) {
      return { ...cell, imageIndex: preserved };
    }
    while (used.has(nextImageIndex)) nextImageIndex += 1;
    used.add(nextImageIndex);
    return { ...cell, imageIndex: nextImageIndex };
  });
}

export function moveCellImage(cells, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) {
    return { cells, changed: false };
  }

  const source = cells.find(cell => cell.id === sourceId);
  const target = cells.find(cell => cell.id === targetId);
  if (!source || !target || source.imageIndex === null || source.imageIndex === undefined) {
    return { cells, changed: false };
  }

  return {
    changed: true,
    cells: sortCells(cells.map(cell => {
      if (cell.id === sourceId) return { ...cell, imageIndex: target.imageIndex ?? null };
      if (cell.id === targetId) return { ...cell, imageIndex: source.imageIndex };
      return cell;
    })),
  };
}

export function clearCellImages(cells, selectedIds) {
  const selected = new Set(selectedIds || []);
  if (!selected.size) return { cells, changed: false };

  let changed = false;
  const next = cells.map(cell => {
    if (!selected.has(cell.id) || cell.imageIndex === null) return cell;
    changed = true;
    return { ...cell, imageIndex: null };
  });

  return { cells: sortCells(next), changed };
}

export function removeImageAtIndex(images, cells, index) {
  if (!Number.isInteger(index) || index < 0 || index >= images.length) {
    return { images, cells, changed: false };
  }

  return {
    changed: true,
    images: images.filter((_, imageIndex) => imageIndex !== index),
    cells: sortCells(cells.map(cell => {
      const imageIndex = Number(cell.imageIndex);
      if (!Number.isInteger(imageIndex) || imageIndex < 0) return cell;
      if (imageIndex === index) return { ...cell, imageIndex: null };
      if (imageIndex > index) return { ...cell, imageIndex: imageIndex - 1 };
      return cell;
    })),
  };
}

export function restoreImageToFirstEmptyCell(images, cells, image) {
  if (!image?.path || images.some(item => item.path === image.path)) {
    return { images, cells, changed: false };
  }

  const nextIndex = images.length;
  let restored = false;
  const nextCells = sortCells(cells.map(cell => {
    if (!restored && (cell.imageIndex === null || cell.imageIndex === undefined || Number(cell.imageIndex) < 0)) {
      restored = true;
      return { ...cell, imageIndex: nextIndex };
    }
    return cell;
  }));

  return {
    changed: true,
    images: [...images, image],
    cells: restored ? nextCells : cells,
  };
}

export function moveCellBlock(cells, cellId, rows, cols, nextPosition) {
  const target = cells.find(cell => cell.id === cellId);
  if (!target) return { cells, changed: false };

  const nextRect = normalizeRect({
    row: nextPosition?.row ?? target.row,
    col: nextPosition?.col ?? target.col,
    rowSpan: target.rowSpan,
    colSpan: target.colSpan,
  }, rows, cols);
  if (nextRect.row === target.row && nextRect.col === target.col) {
    return { cells, changed: false };
  }

  const moved = { ...target, row: nextRect.row, col: nextRect.col };
  const movedPositions = new Set(occupiedPositions(moved));
  const oldPositions = new Set(occupiedPositions(target));
  const kept = [];
  const displacedImages = [];

  for (const cell of cells) {
    if (cell.id === cellId) continue;
    const positions = occupiedPositions(cell);
    const overlap = positions.filter(position => movedPositions.has(position));
    if (!overlap.length) {
      kept.push(cell);
      continue;
    }

    const remaining = positions.filter(position => !movedPositions.has(position));
    if (!remaining.length) {
      if (cell.imageIndex !== null && cell.imageIndex !== undefined) displacedImages.push(cell.imageIndex);
      continue;
    }

    let imageCarried = false;
    for (const position of remaining) {
      const [row, col] = position.split(':').map(Number);
      const restored = makeCell(row, col, 1, 1);
      if (!imageCarried) {
        restored.imageIndex = cell.imageIndex ?? null;
        imageCarried = true;
      } else {
        restored.imageIndex = null;
      }
      kept.push(restored);
    }
  }

  const occupied = new Set([
    ...kept.flatMap(occupiedPositions),
    ...occupiedPositions(moved),
  ]);
  const released = [];
  for (const position of oldPositions) {
    if (movedPositions.has(position) || occupied.has(position)) continue;
    const [row, col] = position.split(':').map(Number);
    const restored = makeCell(row, col, 1, 1);
    restored.imageIndex = displacedImages.length ? displacedImages.shift() : null;
    released.push(restored);
  }

  return {
    changed: true,
    cells: sortCells([...kept, ...released, moved]),
  };
}

export function occupiedPositions(cell) {
  const positions = [];
  for (let row = cell.row; row < cell.row + cell.rowSpan; row += 1) {
    for (let col = cell.col; col < cell.col + cell.colSpan; col += 1) {
      positions.push(`${row}:${col}`);
    }
  }
  return positions;
}

export function canMerge(cells, selectedIds) {
  const selected = cells.filter(cell => selectedIds.includes(cell.id));
  if (selected.length < 2) return { ok: false, reason: '두 칸 이상 선택하세요.' };

  const positions = selected.flatMap(occupiedPositions);
  const coords = positions.map(item => item.split(':').map(Number));
  const minRow = Math.min(...coords.map(([row]) => row));
  const maxRow = Math.max(...coords.map(([row]) => row));
  const minCol = Math.min(...coords.map(([, col]) => col));
  const maxCol = Math.max(...coords.map(([, col]) => col));
  const expectedArea = (maxRow - minRow + 1) * (maxCol - minCol + 1);
  const unique = new Set(positions);

  if (unique.size !== positions.length) {
    return { ok: false, reason: '선택 영역이 겹칩니다.' };
  }
  if (unique.size !== expectedArea) {
    return { ok: false, reason: '직사각형으로 이어진 칸만 병합할 수 있습니다.' };
  }

  return {
    ok: true,
    row: minRow,
    col: minCol,
    rowSpan: maxRow - minRow + 1,
    colSpan: maxCol - minCol + 1,
  };
}

export function mergeCells(cells, selectedIds) {
  const merge = canMerge(cells, selectedIds);
  if (!merge.ok) return { cells, error: merge.reason };

  const kept = cells.filter(cell => !selectedIds.includes(cell.id));
  const selected = sortCells(cells.filter(cell => selectedIds.includes(cell.id)));
  const mergedCell = makeCell(merge.row, merge.col, merge.rowSpan, merge.colSpan);
  mergedCell.imageIndex = selected[0]?.imageIndex;
  return { cells: assignImages([...kept, mergedCell]), error: '', mergedId: mergedCell.id };
}

export function unmergeCells(cells, selectedIds) {
  const next = [];
  const unmergedIds = [];
  let changed = false;

  for (const cell of cells) {
    if (!selectedIds.includes(cell.id) || (cell.rowSpan === 1 && cell.colSpan === 1)) {
      next.push(cell);
      continue;
    }

    changed = true;
    for (let row = cell.row; row < cell.row + cell.rowSpan; row += 1) {
      for (let col = cell.col; col < cell.col + cell.colSpan; col += 1) {
        const restored = makeCell(row, col, 1, 1);
        if (unmergedIds.length === 0) restored.imageIndex = cell.imageIndex;
        next.push(restored);
        unmergedIds.push(restored.id);
      }
    }
  }

  return { cells: assignImages(next), changed, unmergedIds };
}

export function resizeCell(cells, cellId, rows, cols, nextRect) {
  const target = cells.find(cell => cell.id === cellId);
  if (!target) return { cells, error: '선택한 칸을 찾을 수 없습니다.' };

  const normalized = normalizeRect(nextRect, rows, cols);
  const targetPositions = new Set(occupiedPositions(normalized));
  const kept = [];

  for (const cell of cells) {
    if (cell.id === cellId) continue;
    const positions = occupiedPositions(cell);
    const overlap = positions.filter(position => targetPositions.has(position));
    if (overlap.length === 0) {
      kept.push(cell);
      continue;
    }
    if (overlap.length !== positions.length) {
      return { cells, error: '다른 병합 칸의 일부만 덮을 수 없습니다.' };
    }
  }

  const keptPositions = new Set(kept.flatMap(occupiedPositions));
  const released = occupiedPositions(target)
    .filter(position => !targetPositions.has(position) && !keptPositions.has(position))
    .map(position => {
      const [row, col] = position.split(':').map(Number);
      return makeCell(row, col, 1, 1);
    });

  const resized = {
    ...target,
    row: normalized.row,
    col: normalized.col,
    rowSpan: normalized.rowSpan,
    colSpan: normalized.colSpan,
  };

  return { cells: assignImages([...kept, ...released, resized]), error: '' };
}

export function normalizeRect(rect, rows, cols) {
  const row = clampInt(rect.row, 0, rows - 1);
  const col = clampInt(rect.col, 0, cols - 1);
  const maxRowSpan = rows - row;
  const maxColSpan = cols - col;
  return {
    row,
    col,
    rowSpan: clampInt(rect.rowSpan, 1, maxRowSpan),
    colSpan: clampInt(rect.colSpan, 1, maxColSpan),
  };
}

export function sanitizeGridSettings(settings = {}) {
  const rows = clampInt(settings.rows, 1, 8);
  const cols = clampInt(settings.cols, 1, 8);
  const width = clampInt(settings.width, 320, 6000);
  const height = clampInt(settings.height, 320, 6000);
  const maxGap = Math.max(0, Math.floor(Math.min(width / (cols + 1), height / (rows + 1)) - 1));
  const gap = clampInt(settings.gap, 0, Math.min(80, maxGap));
  const maxRadius = Math.floor(Math.min(width, height) / 2);
  const radius = clampInt(settings.radius, 0, Math.min(80, maxRadius));
  const format = ['png', 'jpeg', 'webp'].includes(settings.format) ? settings.format : 'png';
  const background = /^#[0-9a-f]{6}$/i.test(String(settings.background || ''))
    ? settings.background
    : '#1f1e1c';

  return {
    ...settings,
    rows,
    cols,
    width,
    height,
    gap,
    radius,
    background,
    format,
    quality: clampInt(settings.quality, 70, 100),
    roundCorners: settings.roundCorners !== false,
  };
}

export function validateGridLayout(rows, cols, cells) {
  const safeRows = Number(rows);
  const safeCols = Number(cols);
  if (!Number.isInteger(safeRows) || !Number.isInteger(safeCols) || safeRows < 1 || safeCols < 1) {
    return { ok: false, reason: '행과 열 값이 올바르지 않습니다.' };
  }
  if (!Array.isArray(cells) || !cells.length) {
    return { ok: false, reason: '셀 정보가 없습니다.' };
  }

  const occupied = new Set();
  for (const cell of cells) {
    const row = Number(cell.row);
    const col = Number(cell.col);
    const rowSpan = Number(cell.rowSpan);
    const colSpan = Number(cell.colSpan);
    if (![row, col, rowSpan, colSpan].every(Number.isInteger) || row < 0 || col < 0 || rowSpan < 1 || colSpan < 1) {
      return { ok: false, reason: '셀 값이 올바르지 않습니다.' };
    }
    if (row + rowSpan > safeRows || col + colSpan > safeCols) {
      return { ok: false, reason: '셀 영역이 캔버스 밖으로 나갑니다.' };
    }
    for (const position of occupiedPositions({ row, col, rowSpan, colSpan })) {
      if (occupied.has(position)) {
        return { ok: false, reason: '셀 영역이 서로 겹칩니다.' };
      }
      occupied.add(position);
    }
  }

  return { ok: true, reason: '' };
}

export function serializeTemplate({ name = 'No EXIF Layout', settings, cells }) {
  return {
    version: 1,
    name,
    settings: {
      rows: settings.rows,
      cols: settings.cols,
      gap: settings.gap,
      radius: settings.radius,
      background: settings.background,
      width: settings.width,
      height: settings.height,
      format: settings.format,
      quality: settings.quality,
      roundCorners: settings.roundCorners,
    },
    cells: sortCells(cells).map(({ row, col, rowSpan, colSpan, imageIndex }) => ({
      row,
      col,
      rowSpan,
      colSpan,
      imageIndex,
    })),
  };
}

export function hydrateTemplate(payload) {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.cells)) {
    throw new Error('지원하지 않는 템플릿 파일입니다.');
  }
  const settings = sanitizeGridSettings({ ...initialTemplateSettings(), ...payload.settings });
  const layout = validateGridLayout(settings.rows, settings.cols, payload.cells);
  if (!layout.ok) throw new Error(layout.reason);

  return {
    name: payload.name || 'Loaded Layout',
    settings,
    cells: assignImages(payload.cells.map(cell => ({
      ...makeCell(Number(cell.row), Number(cell.col), Number(cell.rowSpan), Number(cell.colSpan)),
      imageIndex: cell.imageIndex === null
        ? null
        : Number.isInteger(Number(cell.imageIndex)) ? Number(cell.imageIndex) : undefined,
    }))),
  };
}

function initialTemplateSettings() {
  return {
    rows: 4,
    cols: 5,
    gap: 24,
    radius: 12,
    background: '#1f1e1c',
    width: 1600,
    height: 2000,
    format: 'png',
    quality: 95,
    roundCorners: true,
  };
}

export function updateImageCrop(images, index, crop) {
  return images.map((image, imageIndex) => {
    if (imageIndex !== index) return image;
    return {
      ...image,
      cropX: clampNumber(crop.cropX ?? image.cropX ?? 0.5, 0, 1),
      cropY: clampNumber(crop.cropY ?? image.cropY ?? 0.5, 0, 1),
    };
  });
}

export function resetGrid(rows, cols) {
  return createGrid(rows, cols);
}

export function recommendGridSize(imageCount, targetAspect = 0.8) {
  const count = clampInt(imageCount, 0, 64);
  if (count <= 0) return { rows: 4, cols: 5 };

  let best = { rows: 8, cols: 8, score: Number.POSITIVE_INFINITY };
  for (let rows = 1; rows <= 8; rows += 1) {
    for (let cols = 1; cols <= 8; cols += 1) {
      const capacity = rows * cols;
      if (capacity < count) continue;
      const emptyCells = capacity - count;
      const aspectPenalty = Math.abs((cols / rows) - targetAspect) * Math.max(2, count * 0.6);
      const skinnyPenalty = count > 1 && (rows === 1 || cols === 1) ? 2 : 0;
      const balancePenalty = Math.abs(rows - cols) * 0.18;
      const score = emptyCells * 1.8 + aspectPenalty + skinnyPenalty + balancePenalty;
      if (score < best.score) {
        best = { rows, cols, score };
      }
    }
  }
  return { rows: best.rows, cols: best.cols };
}

function clampInt(value, min, max) {
  const next = Number.isFinite(Number(value)) ? Math.round(Number(value)) : min;
  return Math.min(max, Math.max(min, next));
}

function clampNumber(value, min, max) {
  const next = Number.isFinite(Number(value)) ? Number(value) : min;
  return Math.min(max, Math.max(min, next));
}
