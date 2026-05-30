import React from 'react';
import { ArrowDown, ArrowUp, FolderOpen, FileJson, ImagePlus, GripVertical, X } from 'lucide-react';
import { formatDimensions } from './appUtils.js';
import { EmptyDropCard } from './EmptyDropCard.jsx';
import { LayoutCanvas } from './LayoutCanvas.jsx';
import { Inspector } from './Inspector.jsx';

export function GridImageOrderPanel({
  images,
  removedImages = [],
  disabled,
  onAdd,
  onMove,
  onReorder,
  onRemove,
  onRestore,
}) {
  return (
    <aside className="panel order-panel">
      <div className="panel-header">
        <div>
          <h2>이미지 순서</h2>
          <p>{images.length}장 · 순서대로 셀에 배치</p>
        </div>
        <button className="small-button" onClick={onAdd} disabled={disabled}>
          <ImagePlus size={16} /> 이미지 추가
        </button>
      </div>
      {images.length ? (
        <div className="order-list">
          {images.map((image, index) => (
            <article
              className="order-item"
              key={image.path}
              draggable={!disabled}
              onDragStart={event => event.dataTransfer.setData('text/plain', String(index))}
              onDragOver={event => event.preventDefault()}
              onDrop={event => {
                event.preventDefault();
                onReorder(Number(event.dataTransfer.getData('text/plain')), index);
              }}
            >
              <span className="index">{index + 1}</span>
              <img src={image.thumb} alt="" />
              <div>
                <strong title={image.name}>{image.name}</strong>
                <span>{formatDimensions(image)}</span>
              </div>
              <button
                className="remove-order-button"
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  onRemove(index);
                }}
                disabled={disabled}
                title="목록에서 제거"
              >
                <X size={14} />
              </button>
              <GripVertical className="drag-grip" size={17} />
              <div className="move-pair">
                <button
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0 || disabled}
                  title="위로"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={() => onMove(index, 1)}
                  disabled={index === images.length - 1 || disabled}
                  title="아래로"
                >
                  <ArrowDown size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyDropCard onAdd={onAdd} />
      )}
      {removedImages.length ? (
        <div className="restore-strip">
          <div>
            <strong>최근 제거</strong>
            <span>{removedImages.length}장 복원 가능</span>
          </div>
          <div className="restore-list">
            {removedImages.slice(0, 4).map((image, index) => (
              <button
                key={image.path}
                type="button"
                onClick={() => onRestore(index)}
                disabled={disabled}
                title={`${image.name} 다시 추가`}
              >
                <img src={image.thumb} alt="" />
                <span>복원</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="panel-foot">이미지 순서 변경은 캔버스 배치에 바로 반영됩니다.</div>
    </aside>
  );
}

export function GridStudioMode({
  images,
  removedImages = [],
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
  canUndo,
  canRedo,
  onAdd,
  onMove,
  onReorder,
  onRemoveImage,
  onRestoreImage,
  onMoveCellImage,
  onMoveCellBlock,
  onClearCellImage,
  onToggleCell,
  onPreviewResize,
  onResizeCell,
  onSettingChange,
  onRecommendGrid,
  onMerge,
  onUnmerge,
  onClearCellImages,
  onClearSelection,
  onReset,
  onCropChange,
  onExport,
  onUndo,
  onRedo,
  onToggleSnap,
  onSaveTemplate,
  onLoadTemplate,
}) {
  return (
    <main className="mode-grid grid-mode">
      <GridImageOrderPanel
        images={images}
        removedImages={removedImages}
        disabled={busy}
        onAdd={onAdd}
        onMove={onMove}
        onReorder={onReorder}
        onRemove={onRemoveImage}
        onRestore={onRestoreImage}
      />
      <section className="grid-canvas-column">
        <div className="template-strip">
          <button onClick={onLoadTemplate} disabled={busy}>
            <FolderOpen size={16} /> 템플릿 불러오기
          </button>
          <button onClick={onSaveTemplate} disabled={busy}>
            <FileJson size={16} /> 템플릿 저장
          </button>
          <span>
            {images.length} images · {settings.rows} x {settings.cols}
          </span>
        </div>
        <LayoutCanvas
          cells={canvasCells}
          images={images}
          settings={settings}
          selectedIds={selectedIds}
          resizePreview={resizePreview}
          canUndo={canUndo}
          canRedo={canRedo}
          snapEnabled={snapEnabled}
          onUndo={onUndo}
          onRedo={onRedo}
          onToggleSnap={onToggleSnap}
          onToggleCell={onToggleCell}
          onPreviewResize={onPreviewResize}
          onResizeCell={onResizeCell}
          onMoveCellImage={onMoveCellImage}
          onMoveCellBlock={onMoveCellBlock}
          onClearCellImage={onClearCellImage}
        />
      </section>
      <Inspector
        settings={settings}
        selectedCount={selectedCells.length}
        canUnmerge={canUnmergeSelected}
        mergeReason={mergeReason}
        cropTarget={cropTarget}
        cropTargetIndex={cropTargetIndex}
        imageCount={images.length}
        cellCount={cells.length}
        busy={busy}
        onSettingChange={onSettingChange}
        onRecommendGrid={onRecommendGrid}
        onMerge={onMerge}
        onUnmerge={onUnmerge}
        onClearCellImages={onClearCellImages}
        onClearSelection={onClearSelection}
        onReset={onReset}
        onCropChange={onCropChange}
        onExport={onExport}
      />
    </main>
  );
}
