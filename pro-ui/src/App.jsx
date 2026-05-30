import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, ImagePlus } from 'lucide-react';
import {
  canMerge,
  clearCellImages,
  createGrid,
  hydrateTemplate,
  mergeCells,
  moveCellBlock,
  moveCellImage,
  recommendGridSize,
  removeImageAtIndex,
  restoreImageToFirstEmptyCell,
  resetGrid,
  resizeCell,
  sanitizeGridSettings,
  serializeTemplate,
  unmergeCells,
  updateImageCrop,
} from './gridModel.js';
import { previewResizeCells } from './resizePreview.js';
import {
  buildExifExportFolderName,
  buildExifOutputDirectory,
  buildPromptCardFileName,
  extractComfyPromptCard,
  extractComfySummary,
  fileBaseName,
  formatBytes,
  formatDimensions,
  metadataChip,
  metadataStatusBadges,
  parseDroppedPathText,
  runToastAction,
} from './appUtils.js';
// Split UI components
import { ModeRail, modes } from './ModeRail.jsx';
import { TopBar } from './TopBar.jsx';
import { ToastHost } from './ToastHost.jsx';
import { ConfirmModal } from './ConfirmModal.jsx';
import { ExifRemoveMode } from './ExifRemoveMode.jsx';
import { GridStudioMode } from './GridStudioMode.jsx';
import { MetadataMode } from './MetadataMode.jsx';
import {
  choosePixivDownloadItems,
  countPixivResults,
  filterPixivItems,
  normalizePixivTarget,
} from './pixivImportUtils.js';

const PromptShareMode = lazy(() => import('./PromptShareMode.jsx').then(module => ({ default: module.PromptShareMode })));
const PixivImportMode = lazy(() => import('./PixivImportMode.jsx').then(module => ({ default: module.PixivImportMode })));

const initialSettings = {
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

const modeNotices = {
  exif: '체크한 이미지만 EXIF 제거 파일로 저장합니다. 원본은 그대로 유지됩니다.',
  grid: '이미지 순서와 캔버스 편집 내용이 그리드 결과에 반영됩니다.',
  metadata: 'ComfyUI workflow, prompt, EXIF, PNG 태그를 로컬에서 확인합니다.',
  'prompt-share': 'ComfyUI 프롬프트를 사진 위에 공유용 카드로 렌더링합니다.',
  pixiv: 'Pixiv에서 필요한 이미지만 골라 내려받고, No EXIF Pro 작업 목록으로 가져옵니다.',
};

const pixivMockItems = [
  { illustId: 144721221, title: 'Midnight poolside study', fileName: '001_144721221.jpg', resolution: '1344 x 1728', pageCount: 1, sizeBytes: 2_900_000, selected: true, preview: 'linear-gradient(135deg, #20264b 0%, #7e557e 42%, #e6b5a3 100%)' },
  { illustId: 144721908, title: 'Soft window portrait', fileName: '002_144721908.png', resolution: '1344 x 1728', pageCount: 1, sizeBytes: 3_120_000, selected: true, preview: 'linear-gradient(135deg, #5c4f43 0%, #d8c1aa 55%, #f5e8dd 100%)' },
  { illustId: 144722310, title: 'City light sequence', fileName: '003_144722310_p0.jpg', resolution: '1536 x 2048', pageCount: 4, sizeBytes: 4_480_000, selected: true, preview: 'linear-gradient(135deg, #151c24 0%, #496b82 48%, #f0c16a 100%)' },
  { illustId: 144722870, title: 'Reference pose sheet', fileName: '004_144722870_p0.png', resolution: '1024 x 1536', pageCount: 2, sizeBytes: 2_420_000, selected: false, preview: 'linear-gradient(135deg, #2d2b29 0%, #74634f 44%, #d5b47f 100%)' },
  { illustId: 144723120, title: 'Neon alley draft', fileName: '005_144723120.jpg', resolution: '1216 x 1792', pageCount: 1, sizeBytes: 2_760_000, selected: true, preview: 'linear-gradient(135deg, #111827 0%, #6a365a 46%, #49a6a8 100%)' },
  { illustId: 144723881, title: 'Costume detail archive', fileName: '006_144723881.png', resolution: '1408 x 1856', pageCount: 1, sizeBytes: 3_660_000, selected: false, preview: 'linear-gradient(135deg, #27221d 0%, #8c7357 40%, #e7d6bd 100%)' },
];

const IMPORT_IMAGE_LIMIT = 500;

const initialPixivState = {
  refreshToken: '',
  target: 'https://www.pixiv.net/users/73211891/illustrations',
  limit: 48,
  timeout: 30,
  workers: 4,
  retries: 2,
  filter: '전체',
  query: '',
  outputDir: '',
  downloadMode: '선택한 이미지만',
  naming: '작품순_원본명',
  items: [],
  resultCounts: { downloaded: 0, skipped: 0, failed: 0 },
  downloadedPaths: [],
};

const initialPromptSettings = {
  template: 'magazine',
  ratio: '4:5',
  width: 1080,
  height: 1350,
  title: 'PROMPT SHARE',
  brand: 'No EXIF Pro',
  handle: '@NoEXIFPro',
  promptMode: 'positive',
  readability: 'gradient',
  darken: 34,
  textScale: 100,
  lineHeight: 1.24,
  columns: 2,
  showModel: true,
  showLora: true,
  showSeed: true,
  showSteps: true,
  showCfg: true,
  showSampler: true,
  showQr: false,
};

export default function App() {
  const [activeMode, setActiveMode] = useState('exif');
  const [images, setImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [settings, setSettings] = useState(initialSettings);
  const [cells, setCells] = useState(() => createGrid(initialSettings.rows, initialSettings.cols));
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [resizePreview, setResizePreview] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [metadataQuery, setMetadataQuery] = useState('');
  const [metadataFilter, setMetadataFilter] = useState('all');
  const [promptSettings, setPromptSettings] = useState(initialPromptSettings);
  const [pixivState, setPixivState] = useState(initialPixivState);
  const [exifParentDir, setExifParentDir] = useState('');
  const [exportFolderName, setExportFolderName] = useState(() => buildExifExportFolderName());
  const [overwriteMode, setOverwriteMode] = useState('rename');
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [notice, setNotice] = useState('이미지를 추가하면 로컬에서만 처리합니다. 원본 파일은 변경하지 않습니다.');
  const [history, setHistory] = useState({ past: [], future: [] });

  const canvasCells = resizePreview?.cells || cells;
  const exifTargetCount = images.filter(image => image.removeExif !== false).length;
  const selectedCells = useMemo(
    () => canvasCells.filter(cell => selectedIds.includes(cell.id)),
    [canvasCells, selectedIds],
  );
  const mergeState = useMemo(
    () => canMerge(cells, selectedIds),
    [cells, selectedIds],
  );
  const mergeReason = selectedIds.length >= 2 && !mergeState.ok ? mergeState.reason : '';
  const canUnmergeSelected = selectedCells.length === 1
    && (selectedCells[0].rowSpan > 1 || selectedCells[0].colSpan > 1);
  const cropTargetIndex = selectedCells.length === 1 ? selectedCells[0].imageIndex : -1;
  const cropTarget = cropTargetIndex >= 0 ? images[cropTargetIndex] : null;
  const selectedImage = images[selectedImageIndex] || images[0] || null;
  const plannedExifOutputDir = exifParentDir ? buildExifOutputDirectory(exifParentDir, exportFolderName) : '';
  const activeModeMeta = modes.find(mode => mode.id === activeMode) || modes[0];

  const promptShareItems = useMemo(() => (
    images
      .map((image, index) => ({ image, index, card: extractComfyPromptCard(image.metadata || {}) }))
      .filter(({ card }) => card.present || card.positivePrompt || card.negativePrompt)
  ), [images]);

  const filteredMetadataImages = useMemo(() => {
    const query = metadataQuery.trim().toLowerCase();
    return images
      .map((image, index) => ({ image, index, chip: metadataChip(image) }))
      .filter(({ image, chip }) => {
        const matchesQuery = !query || image.name.toLowerCase().includes(query) || image.path.toLowerCase().includes(query);
        const summary = extractComfySummary(image.metadata || {});
        const matchesFilter = metadataFilter === 'all'
          || (metadataFilter === 'workflow' && summary.generationPresent)
          || (metadataFilter === 'exif' && (image.hasExif || image.metadata?.privacy?.hasExif || chip.tone === 'warn'));
        return matchesQuery && matchesFilter;
      });
  }, [images, metadataFilter, metadataQuery]);

  useEffect(() => {
    if (activeMode !== 'metadata' || !filteredMetadataImages.length) return;
    const selectedVisible = filteredMetadataImages.some(item => item.index === selectedImageIndex);
    if (!selectedVisible) setSelectedImageIndex(filteredMetadataImages[0].index);
  }, [activeMode, filteredMetadataImages, selectedImageIndex]);

  useEffect(() => {
    if (activeMode !== 'prompt-share' || !promptShareItems.length) return;
    const selectedVisible = promptShareItems.some(item => item.index === selectedImageIndex);
    if (!selectedVisible) setSelectedImageIndex(promptShareItems[0].index);
  }, [activeMode, promptShareItems, selectedImageIndex]);

  const selectedMetadataImage = activeMode === 'metadata'
    ? filteredMetadataImages.find(item => item.index === selectedImageIndex)?.image || null
    : selectedImage;
  const selectedPromptImage = activeMode === 'prompt-share'
    ? promptShareItems.find(item => item.index === selectedImageIndex)?.image || selectedImage
    : selectedImage;

  useEffect(() => {
    if (!selectedImage?.path || selectedImage.preview || !window.noExif?.loadPreview) return undefined;

    let cancelled = false;
    window.noExif.loadPreview(selectedImage.path)
      .then(result => {
        if (cancelled || !result?.preview) return;
        setImages(current => current.map(image => (
          image.path === selectedImage.path ? { ...image, preview: result.preview } : image
        )));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedImage?.path, selectedImage?.preview]);

  function snapshot() {
    return {
      settings: { ...settings },
      cells: cells.map(cell => ({ ...cell })),
      images: images.map(image => ({ ...image })),
      removedImages: removedImages.map(image => ({ ...image })),
    };
  }

  function recordHistory() {
    const current = snapshot();
    setHistory(state => ({
      past: [...state.past.slice(-39), current],
      future: [],
    }));
  }

  function restoreSnapshot(next) {
    setSettings(sanitizeGridSettings({ ...initialSettings, ...next.settings }));
    setCells(next.cells.map(cell => ({ ...cell })));
    setImages(next.images.map(image => ({ ...image })));
    setRemovedImages((next.removedImages || []).map(image => ({ ...image })));
    setSelectedIds([]);
    setResizePreview(null);
  }

  function showToast(payload) {
    const next = { id: Date.now(), type: 'success', ...payload };
    setToast(next);
    setNotice(next.detail ? `${next.title} · ${next.detail}` : next.title);
  }

  function changeMode(mode) {
    setActiveMode(mode);
    setToast(null);
    setNotice(modeNotices[mode] || modeNotices.exif);
  }

  function undo() {
    setHistory(state => {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      const present = snapshot();
      restoreSnapshot(previous);
      return {
        past: state.past.slice(0, -1),
        future: [present, ...state.future].slice(0, 40),
      };
    });
    setNotice('이전 작업으로 되돌렸습니다.');
  }

  function redo() {
    setHistory(state => {
      if (!state.future.length) return state;
      const next = state.future[0];
      const present = snapshot();
      restoreSnapshot(next);
      return {
        past: [...state.past.slice(-39), present],
        future: state.future.slice(1),
      };
    });
    setNotice('되돌린 작업을 다시 적용했습니다.');
  }

  async function importImagePaths(paths) {
    if (!paths?.length) return;
    const known = new Set(images.map(image => image.path));
    const nextPaths = [...new Set(paths)].filter(path => !known.has(path));
    if (!nextPaths.length) {
      showToast({ type: 'info', title: '이미 추가된 이미지는 건너뛰었습니다.' });
      return;
    }
    const result = await window.noExif.inspectImages({
      paths: nextPaths,
      includePreview: false,
      maxFiles: IMPORT_IMAGE_LIMIT,
    });
    recordHistory();
    setImages(current => [
      ...current,
      ...result.items.map(item => ({
        ...item,
        cropX: 0.5,
        cropY: 0.5,
        removeExif: true,
      })),
    ]);
    if (!images.length && result.items.length) {
      setSelectedImageIndex(0);
    }
    const failed = result.failures?.length || 0;
    const truncated = Boolean(result.truncated);
    const failedNames = (result.failures || [])
      .slice(0, 3)
      .map(failure => fileBaseName(failure.path))
      .filter(Boolean);
    const failureDetail = failedNames.length
      ? `${failedNames.join(', ')}${failed > failedNames.length ? ` 외 ${failed - failedNames.length}개` : ''} 파일은 지원하지 않거나 손상되어 건너뛰었습니다.`
      : '지원하지 않거나 손상된 파일은 건너뛰었습니다.';
    const truncatedDetail = `폴더가 커서 먼저 ${result.limit || IMPORT_IMAGE_LIMIT}개 파일까지만 확인했습니다. 필요하면 나눠서 다시 불러오세요.`;
    showToast({
      type: failed || truncated ? 'warning' : 'success',
      title: failed || truncated
        ? `이미지 ${result.items.length}장 추가${failed ? ` · 실패 ${failed}장` : ''}${truncated ? ' · 일부만 확인' : ''}`
        : `이미지 ${result.items.length}장을 추가했습니다.`,
      detail: truncated ? truncatedDetail : failed ? failureDetail : '이제 EXIF 제거, 그리드 생성, 메타데이터 확인에 사용할 수 있습니다.',
    });
  }

  async function addImages() {
    setBusy(true);
    try {
      const paths = await window.noExif.selectImages();
      await importImagePaths(paths);
    } catch (error) {
      showToast({ type: 'error', title: '이미지 추가 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (busy) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.dataTransfer.dropEffect = 'copy';
    setDragActive(true);
  }

  function handleDragLeave(event) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDragActive(false);
  }

  async function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    if (busy) return;

    const files = Array.from(event.dataTransfer.files || []);
    const nativePaths = window.noExif.getDroppedFilePaths(files);
    const textPaths = parseDroppedPathText(
      event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain'),
    );
    const paths = nativePaths.length ? nativePaths : textPaths;
    if (!paths.length) {
      showToast({ type: 'error', title: '드롭한 이미지 경로를 읽지 못했습니다.' });
      return;
    }

    setBusy(true);
    try {
      await importImagePaths(paths);
    } catch (error) {
      showToast({ type: 'error', title: '이미지 드롭 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

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

  function toggleImageExif(index, checked) {
    recordHistory();
    setImages(current => current.map((image, imageIndex) => (
      imageIndex === index ? { ...image, removeExif: checked } : image
    )));
  }

  function setAllExifTargets(checked) {
    recordHistory();
    setImages(current => current.map(image => ({ ...image, removeExif: checked })));
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

  async function chooseExifParentDir() {
    const outputDir = await window.noExif.chooseExifOutputDirectory();
    if (outputDir) {
      setExifParentDir(outputDir);
      showToast({ type: 'info', title: '저장 위치를 선택했습니다.', detail: outputDir });
    }
    return outputDir;
  }

  async function exportCleanImages() {
    if (!images.length) {
      showToast({ type: 'warning', title: '먼저 이미지를 추가하세요.' });
      return;
    }
    if (!exifTargetCount) {
      showToast({ type: 'warning', title: 'EXIF를 제거할 이미지를 체크하세요.' });
      return;
    }

    try {
      const parentDir = exifParentDir || await chooseExifParentDir();
      if (!parentDir) return;
      if (overwriteMode === 'confirm') {
        setConfirmDialog({
          title: '덮어쓰기 확인',
          message: '같은 이름의 결과 파일이 있으면 기존 결과물을 새 파일로 교체합니다. 원본 이미지는 변경하지 않습니다.',
          confirmLabel: '덮어쓰기',
          onConfirm: () => performCleanExport(parentDir, 'replace'),
        });
        return;
      }
      await performCleanExport(parentDir, 'rename');
    } catch (error) {
      showToast({ type: 'error', title: 'EXIF 제거 저장 실패', detail: error.message });
    }
  }

  async function performCleanExport(parentDir, conflictMode) {
    try {
      const outputDir = buildExifOutputDirectory(parentDir, exportFolderName);
      setBusy(true);
      const result = await window.noExif.removeExifBatch({
        imagePaths: images.map(image => image.path),
        flags: images.map(image => image.removeExif !== false),
        outputDir,
        conflictMode,
      });
      const failed = result.failures?.length || 0;
      showToast({
        type: failed ? 'warning' : 'success',
        title: 'EXIF 제거 저장 완료',
        detail: `${result.processed}장 저장됨${failed ? ` · 실패 ${failed}장` : ''}`,
        actionLabel: '폴더 열기',
        onAction: () => window.noExif.openPath(result.outputDir || outputDir),
      });
      setExportFolderName(buildExifExportFolderName());
    } catch (error) {
      showToast({ type: 'error', title: 'EXIF 제거 저장 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function copyText(label, text) {
    if (!text) {
      showToast({ type: 'warning', title: `${label} 내용이 없습니다.` });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast({ title: `${label}했습니다.` });
    } catch (error) {
      showToast({ type: 'error', title: `${label} 실패`, detail: error.message });
    }
  }

  async function saveSelectedMetadataJson() {
    const targetImage = selectedMetadataImage || selectedImage;
    if (!targetImage?.metadata) return;
    try {
      const savedPath = await window.noExif.saveMetadataJson({
        name: targetImage.name,
        metadata: targetImage.metadata,
      });
      if (savedPath) {
        showToast({
          title: '메타데이터 JSON 저장 완료',
          detail: fileBaseName(savedPath),
          actionLabel: '파일 보기',
          onAction: () => window.noExif.showItemInFolder(savedPath),
        });
      }
    } catch (error) {
      showToast({ type: 'error', title: 'JSON 저장 실패', detail: error.message });
    }
  }

  async function openSelectedImageLocation() {
    const targetImage = selectedMetadataImage || selectedImage;
    if (!targetImage?.path) {
      showToast({ type: 'warning', title: '선택한 이미지가 없습니다.' });
      return;
    }
    try {
      await runToastAction(() => window.noExif.showItemInFolder(targetImage.path));
      showToast({ title: '이미지 위치를 열었습니다.', detail: targetImage.name });
    } catch (error) {
      showToast({ type: 'error', title: '이미지 위치 열기 실패', detail: error.message });
    }
  }

  function updatePromptSetting(key, value) {
    setPromptSettings(current => ({ ...current, [key]: value }));
  }

  async function exportPromptCard() {
    const targetImage = selectedPromptImage || selectedImage;
    const card = extractComfyPromptCard(targetImage?.metadata || {});
    if (!targetImage) {
      showToast({ type: 'warning', title: '먼저 이미지를 추가하세요.' });
      return;
    }
    if (!card.present && !card.positivePrompt && !card.negativePrompt) {
      showToast({ type: 'warning', title: '공유할 ComfyUI 프롬프트가 없습니다.' });
      return;
    }

    setBusy(true);
    try {
      const { drawPromptCard } = await import('./promptCardRenderer.js');
      const canvas = document.createElement('canvas');
      const size = await drawPromptCard(canvas, {
        image: targetImage,
        imageSource: targetImage.preview || targetImage.thumb,
        card,
        settings: promptSettings,
      });
      const pngBytes = await canvasToPngBytes(canvas);
      const result = await window.noExif.savePromptCardPng({
        pngBytes,
        defaultName: buildPromptCardFileName(targetImage.name),
      });
      if (!result) return;
      showToast({
        title: '프롬프트 카드 저장 완료',
        detail: `${size.width} x ${size.height} PNG`,
        actionLabel: '파일 보기',
        onAction: () => window.noExif.showItemInFolder(result.outputPath),
      });
    } catch (error) {
      showToast({ type: 'error', title: '프롬프트 카드 저장 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function copyPromptSharePrompt() {
    const { promptTextForMode } = await import('./promptCardRenderer.js');
    await copyText(
      '프롬프트 복사',
      promptTextForMode(extractComfyPromptCard(selectedPromptImage?.metadata), promptSettings.promptMode),
    );
  }

  function sendSelectedImageToExif() {
    const targetImage = selectedMetadataImage || selectedImage;
    if (!targetImage) {
      showToast({ type: 'warning', title: '보낼 이미지가 없습니다.' });
      return;
    }
    const targetIndex = images.findIndex(image => image.path === targetImage.path);
    recordHistory();
    setImages(current => current.map((image, index) => (
      index === targetIndex ? { ...image, removeExif: true } : image
    )));
    changeMode('exif');
    showToast({ title: 'EXIF 제거 작업으로 보냈습니다.', detail: targetImage.name });
  }

  function sendSelectedImageToPromptShare() {
    const targetImage = selectedMetadataImage || selectedImage;
    if (!targetImage) {
      showToast({ type: 'warning', title: '보낼 이미지가 없습니다.' });
      return;
    }
    const targetIndex = images.findIndex(image => image.path === targetImage.path);
    if (targetIndex >= 0) setSelectedImageIndex(targetIndex);
    changeMode('prompt-share');
    showToast({ title: '프롬프트 공유 작업으로 보냈습니다.', detail: targetImage.name });
  }

  function updatePixivState(patch) {
    setPixivState(current => ({ ...current, ...patch }));
  }

  function togglePixivItem(index) {
    setPixivState(current => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, selected: item.selected === false } : item
      )),
    }));
  }

  async function listPixivWorks() {
    const target = normalizePixivTarget(pixivState.target);
    if (!target) {
      showToast({ type: 'warning', title: 'Pixiv 작가 URL 또는 ID를 입력하세요.' });
      return;
    }
    if (!pixivState.refreshToken.trim()) {
      showToast({ type: 'warning', title: 'Refresh Token을 입력하세요.', detail: '토큰은 Pixiv 목록 조회와 다운로드에 필요합니다.' });
      return;
    }
    if (!window.noExif?.listPixivWorks) {
      const items = pixivMockItems.map(item => ({ ...item }));
      setPixivState(current => ({ ...current, items, resultCounts: { downloaded: 0, skipped: 0, failed: 0 }, downloadedPaths: [] }));
      showToast({ type: 'info', title: 'Pixiv 샘플 목록을 표시했습니다.', detail: '브라우저 미리보기에서는 Electron 브리지를 사용할 수 없습니다.' });
      return;
    }
    setBusy(true);
    try {
      const result = await window.noExif.listPixivWorks({
        refreshToken: pixivState.refreshToken,
        target,
        limit: pixivState.limit,
        requestTimeout: pixivState.timeout,
      });
      setPixivState(current => ({
        ...current,
        target,
        items: (result.items || []).map(item => ({ ...item, artistId: result.userId, selected: item.selected !== false })),
        resultCounts: { downloaded: 0, skipped: 0, failed: 0 },
        downloadedPaths: [],
      }));
      showToast({ title: `Pixiv 목록 ${result.items?.length || 0}장을 불러왔습니다.`, detail: `사용자 ID ${result.userId}` });
    } catch (error) {
      showToast({ type: 'error', title: 'Pixiv 목록을 불러오지 못했습니다.', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function choosePixivFolder() {
    if (!window.noExif?.choosePixivOutputDirectory) {
      setPixivState(current => ({ ...current, outputDir: 'C:\\Users\\cdg\\Pictures\\No_EXIF_Pixiv' }));
      showToast({ type: 'info', title: '샘플 저장 폴더를 설정했습니다.' });
      return;
    }
    try {
      const outputDir = await window.noExif.choosePixivOutputDirectory();
      if (!outputDir) return;
      setPixivState(current => ({ ...current, outputDir }));
      showToast({ type: 'info', title: 'Pixiv 저장 폴더를 선택했습니다.', detail: outputDir });
    } catch (error) {
      showToast({ type: 'error', title: '저장 폴더 선택 실패', detail: error.message });
    }
  }

  async function downloadPixivWorks() {
    const downloadItems = choosePixivDownloadItems(pixivState.items, pixivState);
    if (!downloadItems.length) {
      showToast({ type: 'warning', title: '다운로드할 이미지를 선택하세요.' });
      return;
    }
    if (!pixivState.outputDir) {
      showToast({ type: 'warning', title: '저장 폴더를 먼저 선택하세요.' });
      return;
    }
    if (!pixivState.refreshToken.trim()) {
      showToast({ type: 'warning', title: 'Refresh Token을 입력하세요.' });
      return;
    }
    if (!window.noExif?.downloadPixivWorks) {
      showToast({ type: 'warning', title: '브라우저 미리보기에서는 실제 다운로드를 할 수 없습니다.' });
      return;
    }
    setBusy(true);
    try {
      const result = await window.noExif.downloadPixivWorks({
        refreshToken: pixivState.refreshToken,
        outputDir: pixivState.outputDir,
        items: downloadItems,
        retries: pixivState.retries,
        workers: pixivState.workers,
        naming: { mode: pixivState.naming },
        requestTimeout: pixivState.timeout,
      });
      const counts = countPixivResults(result.results);
      const downloadedPaths = (result.results || [])
        .filter(item => ['downloaded', 'skipped'].includes(item.status))
        .map(item => item.path)
        .filter(Boolean);
      setPixivState(current => ({ ...current, resultCounts: counts, downloadedPaths }));
      showToast({
        title: `Pixiv 다운로드 완료 · 저장 ${counts.downloaded}장`,
        detail: `이미 있음 ${counts.skipped}장 · 실패 ${counts.failed}장`,
        actionLabel: '폴더 열기',
        onAction: () => window.noExif.openPath(pixivState.outputDir),
      });
    } catch (error) {
      showToast({ type: 'error', title: 'Pixiv 다운로드 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function addDownloadedPixivImages() {
    if (!pixivState.downloadedPaths.length) {
      showToast({ type: 'warning', title: '추가할 다운로드 이미지가 없습니다.' });
      return;
    }
    setBusy(true);
    try {
      await importImagePaths(pixivState.downloadedPaths);
      changeMode('metadata');
    } catch (error) {
      showToast({ type: 'error', title: '다운로드 이미지를 앱에 추가하지 못했습니다.', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  function setVisiblePixivSelection(selected) {
    const visibleIndexes = new Set(filterPixivItems(pixivState.items, pixivState).map(item => item.originalIndex));
    updatePixivState({
      items: pixivState.items.map((item, index) => (
        visibleIndexes.has(index) ? { ...item, selected } : item
      )),
    });
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

  const modeBody = activeMode === 'exif' ? (
    <ExifRemoveMode
      images={images}
      selectedImageIndex={selectedImageIndex}
      selectedImage={selectedImage}
      exifTargetCount={exifTargetCount}
      exportFolderName={exportFolderName}
      plannedOutputDir={plannedExifOutputDir}
      parentDir={exifParentDir}
      overwriteMode={overwriteMode}
      busy={busy}
      onAdd={addImages}
      onSelectImage={setSelectedImageIndex}
      onToggleExif={toggleImageExif}
      onSetAll={setAllExifTargets}
      onChooseFolder={chooseExifParentDir}
      onOverwriteModeChange={setOverwriteMode}
      onExport={exportCleanImages}
    />
  ) : activeMode === 'grid' ? (
    <GridStudioMode
      images={images}
      removedImages={removedImages}
      settings={settings}
      cells={cells}
      canvasCells={canvasCells}
      selectedIds={selectedIds}
      selectedCells={selectedCells}
      canUnmergeSelected={canUnmergeSelected}
      mergeReason={mergeReason}
      resizePreview={resizePreview}
      cropTarget={cropTarget}
      cropTargetIndex={cropTargetIndex}
      busy={busy}
      snapEnabled={snapEnabled}
      canUndo={history.past.length > 0}
      canRedo={history.future.length > 0}
      onAdd={addImages}
      onMove={moveImage}
      onReorder={reorderImage}
      onRemoveImage={removeImage}
      onRestoreImage={restoreRemovedImage}
      onMoveCellImage={moveImageBetweenCells}
      onMoveCellBlock={moveGridCellBlock}
      onClearCellImage={cellId => clearGridCells([cellId])}
      onToggleCell={toggleCell}
      onPreviewResize={previewResizeCell}
      onResizeCell={handleResizeCell}
      onSettingChange={updateSetting}
      onRecommendGrid={applyRecommendedGrid}
      onMerge={handleMerge}
      onUnmerge={handleUnmerge}
      onClearCellImages={() => clearGridCells(selectedIds)}
      onClearSelection={() => setSelectedIds([])}
      onReset={requestGridReset}
      onCropChange={handleCropChange}
      onExport={exportGrid}
      onUndo={undo}
      onRedo={redo}
      onToggleSnap={() => setSnapEnabled(current => !current)}
      onSaveTemplate={saveTemplate}
      onLoadTemplate={loadTemplate}
    />
  ) : activeMode === 'metadata' ? (
    <MetadataMode
      images={images}
      filteredItems={filteredMetadataImages}
      selectedImage={selectedMetadataImage}
      selectedImageIndex={selectedImageIndex}
      query={metadataQuery}
      filter={metadataFilter}
      busy={busy}
      onAdd={addImages}
      onQueryChange={setMetadataQuery}
      onFilterChange={setMetadataFilter}
      onSelectImage={setSelectedImageIndex}
      onSendToExif={sendSelectedImageToExif}
      onSendToPromptShare={sendSelectedImageToPromptShare}
      onCopyPrompt={() => copyText('프롬프트 복사', extractComfySummary(selectedMetadataImage?.metadata).positivePrompt)}
      onCopyWorkflow={() => copyText('워크플로 복사', selectedMetadataImage?.metadata?.comfyui?.workflow || JSON.stringify(selectedMetadataImage?.metadata?.comfyui?.workflowJson || {}, null, 2))}
      onSaveJson={saveSelectedMetadataJson}
      onOpenLocation={openSelectedImageLocation}
    />
  ) : activeMode === 'pixiv' ? (
    <PixivImportMode
      state={pixivState}
      busy={busy}
      onChange={updatePixivState}
      onToggleItem={togglePixivItem}
      onSelectAll={() => setVisiblePixivSelection(true)}
      onClearSelection={() => setVisiblePixivSelection(false)}
      onMockList={listPixivWorks}
      onChooseFolder={choosePixivFolder}
      onMockDownload={downloadPixivWorks}
      onAddDownloaded={addDownloadedPixivImages}
    />
  ) : (
    <PromptShareMode
      images={images}
      promptItems={promptShareItems}
      selectedImage={selectedPromptImage}
      selectedImageIndex={selectedImageIndex}
      settings={promptSettings}
      busy={busy}
      onAdd={addImages}
      onSelectImage={setSelectedImageIndex}
      onSettingChange={updatePromptSetting}
      onCopyPrompt={copyPromptSharePrompt}
      onSendToExif={sendSelectedImageToExif}
      onExport={exportPromptCard}
    />
  );

  return (
    <div
      className={`app-shell mode-${activeMode}${dragActive ? ' is-dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ModeRail activeMode={activeMode} onChange={changeMode} />
      <section className="workspace">
        <TopBar
          mode={activeModeMeta}
          imageCount={images.length}
          exifTargetCount={exifTargetCount}
          promptCount={promptShareItems.length}
          pixivCount={pixivState.items.length}
          busy={busy}
        />
        <Suspense fallback={<div className="mode-loading">작업 화면을 불러오는 중입니다.</div>}>
          {modeBody}
        </Suspense>
        <footer className="statusbar">
          <div className="privacy-pill"><ShieldCheck size={16} /> 로컬 처리 · 원본 유지</div>
          <div>{notice}</div>
          <div>{images.length}장 불러옴</div>
        </footer>
      </section>
      <ToastHost
        toast={toast}
        onClose={() => setToast(null)}
        onActionError={error => showToast({ type: 'error', title: '작업을 열 수 없습니다.', detail: error.message })}
      />
      <ConfirmModal
        dialog={confirmDialog}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          const action = confirmDialog?.onConfirm;
          setConfirmDialog(null);
          return action?.();
        }}
      />
      <div className="drop-overlay">
        <ImagePlus size={34} />
        <strong>이미지를 놓으면 바로 추가합니다.</strong>
        <span>JPG, PNG, WEBP, TIFF 등 지원 파일을 불러옵니다.</span>
      </div>
    </div>
  );
}



function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async blob => {
      try {
        if (!blob) {
          reject(new Error('PNG 렌더링에 실패했습니다.'));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      } catch (error) {
        reject(error);
      }
    }, 'image/png');
  });
}
