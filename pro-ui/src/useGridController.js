import {
  clearCellImages,
  hydrateTemplate,
  mergeCells,
  moveCellBlock,
  moveCellImage,
  recommendGridSize,
  removeImageAtIndex,
  resetGrid,
  resizeCell,
  restoreImageToFirstEmptyCell,
  sanitizeGridSettings,
  serializeTemplate,
  unmergeCells,
  updateImageCrop,
} from './gridModel.js';
import { previewResizeCells } from './resizePreview.js';

export function useGridController({
  images,
  removedImages,
  settings,
  cells,
  selectedIds,
  setSettings,
  setCells,
  setSelectedIds,
  setImages,
  setRemovedImages,
  setSelectedImageIndex,
  setResizePreview,
  setNotice,
  setBusy,
  setConfirmDialog,
  recordHistory,
  showToast,
}) {
  function updateSetting(key, value) {
    recordHistory();
    setSettings(current => {
      const next = sanitizeGridSettings({ ...current, [key]: value });
      if (key === 'rows' || key === 'cols') {
        setCells(resetGrid(next.rows, next.cols));
        setResizePreview(null);
        setSelectedIds([]);
      }
      return next;
    });
  }

  function toggleCell(id, additive) {
    setSelectedIds(current => {
      if (!additive) return current.includes(id) ? [] : [id];
      return current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id];
    });
  }

  function handleMerge() {
    const result = mergeCells(cells, selectedIds);
    if (result.error) {
      showToast({ type: 'warning', title: '병합할 수 없습니다.', detail: result.error });
      return;
    }
    recordHistory();
    setCells(result.cells);
    setSelectedIds(result.mergedId ? [result.mergedId] : []);
    showToast({ title: '선택한 셀을 병합했습니다.' });
  }

  function handleUnmerge() {
    const result = unmergeCells(cells, selectedIds);
    if (!result.changed) {
      showToast({ type: 'warning', title: '병합된 셀을 선택해야 해제할 수 있습니다.' });
      return;
    }
    recordHistory();
    setCells(result.cells);
    setSelectedIds(result.unmergedIds || []);
    showToast({
      title: '선택한 셀을 다시 나눴습니다.',
      detail: `${result.unmergedIds?.length || 0}칸 선택 유지`,
    });
  }

  function moveImage(index, direction) {
    recordHistory();
    setImages(current => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      setSelectedImageIndex(target);
      return next;
    });
  }

  function reorderImage(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    recordHistory();
    setImages(current => {
      if (fromIndex >= current.length || toIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      setSelectedImageIndex(toIndex);
      return next;
    });
  }

  function removeImage(index) {
    const result = removeImageAtIndex(images, cells, index);
    if (!result.changed) return;
    recordHistory();
    const removed = images[index];
    setImages(result.images);
    if (removed) {
      setRemovedImages(current => [removed, ...current.filter(image => image.path !== removed.path)].slice(0, 12));
    }
    setCells(result.cells);
    setSelectedImageIndex(current => {
      if (!result.images.length) return 0;
      if (current > index) return current - 1;
      return Math.min(current, result.images.length - 1);
    });
    setResizePreview(null);
    showToast({ title: '이미지를 목록에서 제거했습니다.', detail: images[index]?.name || '' });
  }

  function restoreRemovedImage(index) {
    const image = removedImages[index];
    if (!image) return;
    const result = restoreImageToFirstEmptyCell(images, cells, image);
    if (!result.changed) return;
    recordHistory();
    setImages(result.images);
    setCells(result.cells);
    setRemovedImages(current => current.filter((_, itemIndex) => itemIndex !== index));
    setSelectedImageIndex(result.images.length - 1);
    setResizePreview(null);
    showToast({ title: '제거했던 이미지를 다시 추가했습니다.', detail: image.name });
  }

  function moveImageBetweenCells(sourceId, targetId) {
    const result = moveCellImage(cells, sourceId, targetId);
    if (!result.changed) return;
    recordHistory();
    setCells(result.cells);
    setSelectedIds(targetId ? [targetId] : []);
    setResizePreview(null);
    showToast({ title: '셀 이미지 위치를 바꿨습니다.' });
  }

  function moveGridCellBlock(cellId, nextPosition) {
    const result = moveCellBlock(cells, cellId, settings.rows, settings.cols, nextPosition);
    if (!result.changed) return;
    recordHistory();
    setCells(result.cells);
    setSelectedIds([cellId]);
    setResizePreview(null);
    showToast({ title: '셀 블록을 이동했습니다.' });
  }

  function clearGridCells(cellIds = selectedIds) {
    const result = clearCellImages(cells, cellIds);
    if (!result.changed) return;
    recordHistory();
    setCells(result.cells);
    setSelectedIds(cellIds);
    setResizePreview(null);
    showToast({ title: '선택한 셀을 비웠습니다.' });
  }

  function previewResizeCell(cellId, nextRect) {
    const result = previewResizeCells(cells, cellId, settings.rows, settings.cols, nextRect);
    if (!result.error) {
      setResizePreview({ cellId, rect: nextRect, cells: result.cells });
    } else {
      setResizePreview(null);
    }
  }

  function handleResizeCell(cellId, nextRect) {
    setResizePreview(null);
    const result = resizeCell(cells, cellId, settings.rows, settings.cols, nextRect);
    if (result.error) {
      showToast({ type: 'warning', title: '셀 크기를 조정할 수 없습니다.', detail: result.error });
      return;
    }
    recordHistory();
    setCells(result.cells);
    setSelectedIds([cellId]);
    showToast({ title: '셀 크기를 조정했습니다.', detail: `${nextRect.colSpan} x ${nextRect.rowSpan} 칸` });
  }

  function handleCropChange(index, crop) {
    if (index < 0) return;
    recordHistory();
    setImages(current => updateImageCrop(current, index, crop));
    setNotice('사진 프레임 기준점을 조정했습니다.');
  }

  function applyRecommendedGrid() {
    if (!images.length) {
      showToast({ type: 'warning', title: '추천할 이미지가 없습니다.' });
      return;
    }
    const nextSize = recommendGridSize(images.length, settings.width / settings.height);
    recordHistory();
    setSettings(current => sanitizeGridSettings({ ...current, rows: nextSize.rows, cols: nextSize.cols }));
    setCells(resetGrid(nextSize.rows, nextSize.cols));
    setSelectedIds([]);
    setResizePreview(null);
    showToast({
      title: '사진 수에 맞춰 그리드를 추천했습니다.',
      detail: `${nextSize.rows} x ${nextSize.cols} · ${images.length}장 기준`,
    });
  }

  async function saveTemplate() {
    try {
      const payload = serializeTemplate({ name: 'No EXIF Layout', settings, cells });
      const savedPath = await window.noExif.saveTemplate(payload);
      if (savedPath) showToast({ title: '템플릿을 저장했습니다.', detail: savedPath });
    } catch (error) {
      showToast({ type: 'error', title: '템플릿 저장 실패', detail: error.message });
    }
  }

  async function loadTemplate() {
    try {
      const payload = await window.noExif.loadTemplate();
      if (!payload) return;
      const loaded = hydrateTemplate(payload);
      recordHistory();
      setSettings(current => sanitizeGridSettings({ ...current, ...loaded.settings }));
      setCells(loaded.cells);
      setSelectedIds([]);
      showToast({ title: '템플릿을 불러왔습니다.', detail: loaded.name });
    } catch (error) {
      showToast({ type: 'error', title: '템플릿 불러오기 실패', detail: error.message });
    }
  }

  async function exportGrid() {
    if (!images.length) {
      showToast({ type: 'warning', title: '먼저 이미지를 추가하세요.' });
      return;
    }

    setBusy(true);
    try {
      const outputPath = await window.noExif.chooseExportPath(settings.format);
      if (!outputPath) return;
      const result = await window.noExif.exportGrid({
        imagePaths: images.map(image => image.path),
        layout: {
          rows: settings.rows,
          cols: settings.cols,
          cells: cells.map(({ id, ...cell }) => cell),
        },
        settings,
        imageCrops: images.map(image => ({
          cropX: image.cropX ?? 0.5,
          cropY: image.cropY ?? 0.5,
        })),
        outputPath,
      });
      const failed = result.failures?.length || 0;
      showToast({
        type: failed ? 'warning' : 'success',
        title: '그리드 내보내기 완료',
        detail: `${result.width} x ${result.height} ${settings.format.toUpperCase()}${failed ? ` · 실패 ${failed}개` : ''}`,
        actionLabel: '파일 보기',
        onAction: () => window.noExif.showItemInFolder(result.outputPath),
      });
    } catch (error) {
      showToast({ type: 'error', title: '그리드 내보내기 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  function requestGridReset() {
    setConfirmDialog({
      title: '그리드 초기화',
      message: '병합, 선택 상태, 캔버스 배치를 기본 그리드로 되돌립니다. 이미지 목록은 유지됩니다.',
      confirmLabel: '초기화',
      onConfirm: () => {
        recordHistory();
        setCells(resetGrid(settings.rows, settings.cols));
        setSelectedIds([]);
        setResizePreview(null);
        showToast({ title: '그리드를 초기화했습니다.' });
      },
    });
  }

  return {
    updateSetting,
    toggleCell,
    handleMerge,
    handleUnmerge,
    moveImage,
    reorderImage,
    removeImage,
    restoreRemovedImage,
    moveImageBetweenCells,
    moveGridCellBlock,
    clearGridCells,
    previewResizeCell,
    handleResizeCell,
    handleCropChange,
    applyRecommendedGrid,
    saveTemplate,
    loadTemplate,
    exportGrid,
    requestGridReset,
  };
}
