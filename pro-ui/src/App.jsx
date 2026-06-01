import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { gsap } from 'gsap';
import {
  canMerge,
  createGrid,
  sanitizeGridSettings,
} from './gridModel.js';
import {
  extractComfyPromptCard,
  extractComfySummary,
  formatBytes,
  formatDimensions,
  metadataChip,
  metadataStatusBadges,
} from './appUtils.js';
// Split UI components
import { ModeRail, modes } from './ModeRail.jsx';
import { TopBar } from './TopBar.jsx';
import { ToastHost } from './ToastHost.jsx';
import { ConfirmModal } from './ConfirmModal.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { ModeSwitchboard } from './ModeSwitchboard.jsx';
import { buildCommandPaletteModel } from './commandPaletteModel.js';
import {
  initialSettings,
  modeNotices,
} from './appConstants.js';
import { useImageImportController } from './useImageImportController.js';
import { usePixivImportController } from './usePixivImportController.js';
import { usePromptShareController } from './usePromptShareController.js';
import { useSelectedImagePreview } from './useSelectedImagePreview.js';
import { useGridController } from './useGridController.js';
import { useExifExportController } from './useExifExportController.js';
import { useMetadataActions } from './useMetadataActions.js';

export default function App() {
  const [activeMode, setActiveMode] = useState('exif');
  const [images, setImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [settings, setSettings] = useState(initialSettings);
  const [cells, setCells] = useState(() => createGrid(initialSettings.rows, initialSettings.cols));
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resizePreview, setResizePreview] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [metadataQuery, setMetadataQuery] = useState('');
  const [metadataFilter, setMetadataFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [notice, setNotice] = useState('이미지를 추가하면 원본 파일은 변경하지 않습니다.');
  const [history, setHistory] = useState({ past: [], future: [] });
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const modeStageRef = useRef(null);

  const {
    dragActive,
    importImagePaths,
    addImages,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useImageImportController({
    images,
    busy,
    setBusy,
    setImages,
    setSelectedImageIndex,
    recordHistory,
    showToast,
  });
  const {
    pixivState,
    updatePixivState,
    togglePixivItem,
    listPixivWorks,
    choosePixivFolder,
    downloadPixivWorks,
    addDownloadedPixivImages,
    setVisiblePixivSelection,
  } = usePixivImportController({
    setBusy,
    showToast,
    importImagePaths,
    changeMode,
  });

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
  const activeModeMeta = modes.find(mode => mode.id === activeMode) || modes[0];

  const promptShareItems = useMemo(() => (
    images
      .map((image, index) => ({ image, index, card: extractComfyPromptCard(image.metadata || {}) }))
      .filter(({ card }) => card.present || card.positivePrompt || card.negativePrompt)
  ), [images]);

  const commandModel = useMemo(() => buildCommandPaletteModel({
    query: commandQuery,
    context: {
      activeMode,
      images,
      promptCount: promptShareItems.length,
      pixivCount: pixivState.items.length,
      busy,
    },
  }), [activeMode, busy, commandQuery, images, pixivState.items.length, promptShareItems.length]);
  const commandActions = commandQuery.trim() ? commandModel.results : commandModel.recommended;

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

  useEffect(() => {
    function handleCommandShortcut(event) {
      const isCommandKey = event.ctrlKey || event.metaKey;
      if (!isCommandKey || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setCommandOpen(true);
    }

    window.addEventListener('keydown', handleCommandShortcut);
    return () => window.removeEventListener('keydown', handleCommandShortcut);
  }, []);

  useEffect(() => {
    setCommandSelectedIndex(0);
  }, [commandOpen, commandQuery]);

  useEffect(() => {
    if (!modeStageRef.current) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        modeStageRef.current,
        { autoAlpha: 0.92, y: 7 },
        { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out', overwrite: true },
      );
    }, modeStageRef);

    return () => ctx.revert();
  }, [activeMode]);

  const selectedMetadataImage = activeMode === 'metadata'
    ? filteredMetadataImages.find(item => item.index === selectedImageIndex)?.image || null
    : selectedImage;
  const selectedPromptImage = activeMode === 'prompt-share'
    ? promptShareItems.find(item => item.index === selectedImageIndex)?.image || selectedImage
    : selectedImage;

  const {
    copyText,
    saveSelectedMetadataJson,
    openSelectedImageLocation,
  } = useMetadataActions({
    selectedMetadataImage,
    selectedImage,
    showToast,
  });
  const {
    promptSettings,
    updatePromptSetting,
    exportPromptCard,
    copyPromptSharePrompt,
    sendSelectedImageToExif,
    sendSelectedImageToPromptShare,
  } = usePromptShareController({
    images,
    selectedImage,
    selectedMetadataImage,
    selectedPromptImage,
    setBusy,
    setImages,
    setSelectedImageIndex,
    recordHistory,
    changeMode,
    showToast,
    copyText,
  });
  const {
    exifParentDir,
    exportFolderName,
    overwriteMode,
    plannedExifOutputDir,
    setOverwriteMode,
    chooseExifParentDir,
    exportCleanImages,
  } = useExifExportController({
    images,
    exifTargetCount,
    setBusy,
    setConfirmDialog,
    showToast,
  });
  const {
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
  } = useGridController({
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
  });
  useSelectedImagePreview({ selectedImage, setImages });

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

  function closeCommandPalette() {
    setCommandOpen(false);
    setCommandQuery('');
  }

  function runCommandPaletteAction(action) {
    if (!action || action.disabled) return;
    setCommandOpen(false);
    setCommandQuery('');

    if (action.id === 'add-images') {
      void addImages();
      return;
    }
    if (action.id === 'remove-exif') {
      changeMode('exif');
      void exportCleanImages();
      return;
    }
    if (action.id === 'export-grid') {
      changeMode('grid');
      void exportGrid();
      return;
    }
    if (action.id === 'inspect-metadata') {
      changeMode('metadata');
      return;
    }
    if (action.id === 'create-prompt-card') {
      changeMode('prompt-share');
      return;
    }
    if (action.id === 'import-pixiv') {
      changeMode('pixiv');
    }
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

  const modeBody = (
    <ModeSwitchboard
      activeMode={activeMode}
      exifProps={{
        images,
        selectedImageIndex,
        selectedImage,
        exifTargetCount,
        exportFolderName,
        plannedOutputDir: plannedExifOutputDir,
        parentDir: exifParentDir,
        overwriteMode,
        busy,
        onAdd: addImages,
        onSelectImage: setSelectedImageIndex,
        onToggleExif: toggleImageExif,
        onSetAll: setAllExifTargets,
        onChooseFolder: chooseExifParentDir,
        onOverwriteModeChange: setOverwriteMode,
        onExport: exportCleanImages,
      }}
      gridProps={{
        images,
        removedImages,
        settings,
        cells,
        canvasCells,
        selectedIds,
        selectedCells,
        canUnmergeSelected,
        mergeReason,
        resizePreview,
        cropTarget,
        cropTargetIndex,
        busy,
        snapEnabled,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        onAdd: addImages,
        onMove: moveImage,
        onReorder: reorderImage,
        onRemoveImage: removeImage,
        onRestoreImage: restoreRemovedImage,
        onMoveCellImage: moveImageBetweenCells,
        onMoveCellBlock: moveGridCellBlock,
        onClearCellImage: cellId => clearGridCells([cellId]),
        onToggleCell: toggleCell,
        onPreviewResize: previewResizeCell,
        onResizeCell: handleResizeCell,
        onSettingChange: updateSetting,
        onRecommendGrid: applyRecommendedGrid,
        onMerge: handleMerge,
        onUnmerge: handleUnmerge,
        onClearCellImages: () => clearGridCells(selectedIds),
        onClearSelection: () => setSelectedIds([]),
        onReset: requestGridReset,
        onCropChange: handleCropChange,
        onExport: exportGrid,
        onUndo: undo,
        onRedo: redo,
        onToggleSnap: () => setSnapEnabled(current => !current),
        onSaveTemplate: saveTemplate,
        onLoadTemplate: loadTemplate,
      }}
      metadataProps={{
        images,
        filteredItems: filteredMetadataImages,
        selectedImage: selectedMetadataImage,
        selectedImageIndex,
        query: metadataQuery,
        filter: metadataFilter,
        busy,
        onAdd: addImages,
        onQueryChange: setMetadataQuery,
        onFilterChange: setMetadataFilter,
        onSelectImage: setSelectedImageIndex,
        onSendToExif: sendSelectedImageToExif,
        onSendToPromptShare: sendSelectedImageToPromptShare,
        onCopyPrompt: () => copyText('프롬프트 복사', extractComfySummary(selectedMetadataImage?.metadata).positivePrompt),
        onCopyWorkflow: () => copyText('워크플로 복사', selectedMetadataImage?.metadata?.comfyui?.workflow || JSON.stringify(selectedMetadataImage?.metadata?.comfyui?.workflowJson || {}, null, 2)),
        onSaveJson: saveSelectedMetadataJson,
        onOpenLocation: openSelectedImageLocation,
      }}
      pixivProps={{
        state: pixivState,
        busy,
        onChange: updatePixivState,
        onToggleItem: togglePixivItem,
        onSelectAll: () => setVisiblePixivSelection(true),
        onClearSelection: () => setVisiblePixivSelection(false),
        onMockList: listPixivWorks,
        onChooseFolder: choosePixivFolder,
        onMockDownload: downloadPixivWorks,
        onAddDownloaded: addDownloadedPixivImages,
      }}
      promptShareProps={{
        images,
        promptItems: promptShareItems,
        selectedImage: selectedPromptImage,
        selectedImageIndex,
        settings: promptSettings,
        busy,
        onAdd: addImages,
        onSelectImage: setSelectedImageIndex,
        onSettingChange: updatePromptSetting,
        onCopyPrompt: copyPromptSharePrompt,
        onSendToExif: sendSelectedImageToExif,
        onExport: exportPromptCard,
      }}
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
          onOpenCommand={() => setCommandOpen(true)}
        />
        <div className="mode-stage" ref={modeStageRef}>
          <Suspense fallback={<div className="mode-loading">작업 화면을 불러오는 중입니다.</div>}>
            {modeBody}
          </Suspense>
        </div>
        <footer className="statusbar">
          <div className="statusbar-note">{notice}</div>
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
      <CommandPalette
        open={commandOpen}
        query={commandQuery}
        actions={commandActions}
        selectedIndex={commandSelectedIndex}
        onQueryChange={setCommandQuery}
        onSelectedIndexChange={setCommandSelectedIndex}
        onRun={runCommandPaletteAction}
        onClose={closeCommandPalette}
      />
      <div className="drop-overlay">
        <ImagePlus size={34} />
        <strong>이미지를 놓으면 바로 추가합니다.</strong>
        <span>JPG, PNG, WEBP, TIFF 등 지원 파일을 불러옵니다.</span>
      </div>
    </div>
  );
}
