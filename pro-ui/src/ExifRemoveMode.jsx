import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Folder, GripHorizontal, ImagePlus, ShieldCheck } from 'lucide-react';
import { metadataChip, formatDimensions, formatBytes } from './appUtils.js';
import {
  filmstripWheelDelta,
  nextImageIndex,
  PREVIEW_WHEEL_COOLDOWN_MS,
  previewWheelDirection,
} from './exifFilmstripModel.js';

export function SecureExifPreview({ image, zoom = 1, onAdd, onPreviewWheel }) {
  if (!image) {
    return (
      <div className="large-empty">
        <ImagePlus size={34} />
        <strong>이미지를 추가하세요</strong>
        <span>드래그 앤 드롭하거나 이미지 추가 버튼을 누르세요.</span>
        <button className="small-button" onClick={onAdd}>
          <ImagePlus size={16} /> 이미지 추가
        </button>
      </div>
    );
  }

  return (
    <div className="secure-preview-wrap">
      <div className="secure-preview-title">
        <div>
          <h1>{image.name}</h1>
          <p>
            {formatDimensions(image)} · {formatBytes(image.metadata?.file?.sizeBytes)} · {image.metadata?.image?.format || '이미지'}
          </p>
        </div>
      </div>
      <div className="single-preview-frame" onWheel={onPreviewWheel}>
        <img
          className="single-preview-image"
          src={image.preview || image.thumb}
          alt=""
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
    </div>
  );
}

export const ExifListItem = React.forwardRef(function ExifListItem(
  { image, index, active, disabled, onSelect, onToggle },
  ref,
) {
  const chip = metadataChip(image);
  return (
    <article ref={ref} className={`exif-list-item${active ? ' is-active' : ''}`} onClick={onSelect}>
      <label className="check-cell" onClick={event => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={image.removeExif !== false}
          disabled={disabled}
          onChange={event => onToggle(event.target.checked)}
        />
      </label>
      <img src={image.thumb} alt="" />
      <div className="list-meta">
        <strong title={image.name}>{image.name}</strong>
        <span>
          {formatDimensions(image)} · {formatBytes(image.metadata?.file?.sizeBytes)}
        </span>
        <b className={`chip ${chip.tone}`}>{chip.label}</b>
      </div>
      <em>{index + 1}</em>
    </article>
  );
});

export function ExifRemoveMode({
  images,
  selectedImageIndex,
  selectedImage,
  exifTargetCount,
  exportFolderName,
  plannedOutputDir,
  parentDir,
  overwriteMode,
  busy,
  onAdd,
  onSelectImage,
  onToggleExif,
  onSetAll,
  onChooseFolder,
  onOverwriteModeChange,
  onExport,
}) {
  const [viewerZoom, setViewerZoom] = useState(1);
  const [filmstripDragging, setFilmstripDragging] = useState(false);
  const filmstripRef = useRef(null);
  const filmstripItemRefs = useRef([]);
  const lastPreviewWheelAtRef = useRef(0);
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
    suppressClick: false,
  });
  const selectedChip = selectedImage ? metadataChip(selectedImage) : null;
  const canMovePrevious = selectedImageIndex > 0;
  const canMoveNext = selectedImageIndex < images.length - 1;

  useEffect(() => {
    setViewerZoom(1);
  }, [selectedImage?.path]);

  useEffect(() => {
    filmstripItemRefs.current.length = images.length;
  }, [images.length]);

  useEffect(() => {
    if (!images.length) return;
    filmstripItemRefs.current[selectedImageIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [images.length, selectedImageIndex]);

  useEffect(() => {
    function moveWithKeyboard(event) {
      if (!images.length) return;
      if (busy) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        selectRelativeImage(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        selectRelativeImage(1);
      }
    }

    window.addEventListener('keydown', moveWithKeyboard);
    return () => window.removeEventListener('keydown', moveWithKeyboard);
  }, [busy, images.length, selectedImageIndex]);

  function scrollFilmstripWithWheel(event) {
    const element = filmstripRef.current;
    if (!element) return;
    if (element.scrollWidth <= element.clientWidth) return;
    const delta = filmstripWheelDelta(event);
    if (!delta) return;
    event.preventDefault();
    element.scrollLeft += delta;
  }

  function selectRelativeImage(direction) {
    const nextIndex = nextImageIndex(selectedImageIndex, images.length, direction);
    if (nextIndex === selectedImageIndex) return;
    onSelectImage(nextIndex);
  }

  function navigatePreviewWithWheel(event) {
    if (busy || images.length <= 1) return;

    const direction = previewWheelDirection(event);
    if (!direction) return;

    event.preventDefault();
    const now = performance.now();
    if (now - lastPreviewWheelAtRef.current < PREVIEW_WHEEL_COOLDOWN_MS) return;

    lastPreviewWheelAtRef.current = now;
    selectRelativeImage(direction);
  }

  function startFilmstripDrag(event) {
    if (event.button !== 0) return;
    if (event.target.closest('button, input, label, select, a')) return;

    const element = filmstripRef.current;
    if (!element || element.scrollWidth <= element.clientWidth) return;

    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: element.scrollLeft,
      moved: false,
      suppressClick: false,
    };
    setFilmstripDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function dragFilmstrip(event) {
    const state = dragStateRef.current;
    if (!state.active) return;

    const element = filmstripRef.current;
    if (!element) return;

    const offsetX = event.clientX - state.startX;
    if (Math.abs(offsetX) > 4) {
      state.moved = true;
    }

    if (state.moved) {
      event.preventDefault();
      element.scrollLeft = state.scrollLeft - offsetX;
    }
  }

  function stopFilmstripDrag(event) {
    const state = dragStateRef.current;
    if (!state.active) return;

    state.active = false;
    state.suppressClick = state.moved;
    setFilmstripDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function cancelFilmstripClickAfterDrag(event) {
    const state = dragStateRef.current;
    if (!state.suppressClick) return;

    event.preventDefault();
    event.stopPropagation();
    state.suppressClick = false;
  }

  return (
    <main className="exif-review-mode exif-mode exif-viewer-mode">
      <section className="preview-panel exif-review-stage exif-viewer-stage">
        <SecureExifPreview
          image={selectedImage}
          zoom={viewerZoom}
          onAdd={onAdd}
          onPreviewWheel={navigatePreviewWithWheel}
        />
        <div className="exif-viewer-toolbar">
          <div className="exif-preview-stepper" aria-label="큰 미리보기 이미지 이동">
            <button
              type="button"
              onClick={() => selectRelativeImage(-1)}
              disabled={!canMovePrevious || busy}
              title="이전 이미지 크게 보기"
              aria-label="이전 이미지 크게 보기"
            >
              <ChevronLeft size={16} />
            </button>
            <span>{images.length ? `${selectedImageIndex + 1} / ${images.length}` : '이미지 없음'}</span>
            <button
              type="button"
              onClick={() => selectRelativeImage(1)}
              disabled={!canMoveNext || busy}
              title="다음 이미지 크게 보기"
              aria-label="다음 이미지 크게 보기"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setViewerZoom(value => Math.max(0.5, Math.round((value - 0.25) * 100) / 100))}
            >
              -
            </button>
            <button type="button" onClick={() => setViewerZoom(1)}>
              {Math.round(viewerZoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setViewerZoom(value => Math.min(3, Math.round((value + 0.25) * 100) / 100))}
            >
              +
            </button>
            <button type="button" onClick={onAdd} disabled={busy} title="이미지 추가">
              <ImagePlus size={16} />
            </button>
          </div>
        </div>
        <div className="selection-tools">
          <button onClick={() => onSetAll(true)} disabled={!images.length || busy}>
            전체 선택
          </button>
          <button onClick={() => onSetAll(false)} disabled={!images.length || busy}>
            전체 해제
          </button>
        </div>
        {images.length ? (
          <div className="filmstrip-shell" onWheel={scrollFilmstripWithWheel}>
            <button
              type="button"
              className="filmstrip-nav filmstrip-nav-left"
              onClick={() => selectRelativeImage(-1)}
              disabled={!canMovePrevious || busy}
              title="이전 이미지 크게 보기"
              aria-label="이전 이미지 크게 보기"
            >
              <ChevronLeft size={20} />
            </button>
            <div
              ref={filmstripRef}
              className={`exif-filmstrip list-scroll${filmstripDragging ? ' is-dragging' : ''}`}
              onPointerDown={startFilmstripDrag}
              onPointerMove={dragFilmstrip}
              onPointerUp={stopFilmstripDrag}
              onPointerCancel={stopFilmstripDrag}
              onClickCapture={cancelFilmstripClickAfterDrag}
            >
              {images.map((image, index) => (
                <ExifListItem
                  ref={node => {
                    filmstripItemRefs.current[index] = node;
                  }}
                  key={image.path}
                  image={image}
                  index={index}
                  active={index === selectedImageIndex}
                  disabled={busy}
                  onSelect={() => onSelectImage(index)}
                  onToggle={checked => onToggleExif(index, checked)}
                />
              ))}
            </div>
            <button
              type="button"
              className="filmstrip-nav filmstrip-nav-right"
              onClick={() => selectRelativeImage(1)}
              disabled={!canMoveNext || busy}
              title="다음 이미지 크게 보기"
              aria-label="다음 이미지 크게 보기"
            >
              <ChevronRight size={20} />
            </button>
            <div className="filmstrip-drag-rail" aria-hidden="true">
              <GripHorizontal size={18} />
            </div>
          </div>
        ) : null}
        <div className="panel-foot">선택 {exifTargetCount} / {images.length}</div>
      </section>

      <aside className="panel settings-panel exif-export-drawer">
        <div className="panel-header simple">
          <h2>Export</h2>
          <button className="small-button" onClick={onAdd} disabled={busy}>
            <ImagePlus size={16} /> 이미지 추가
          </button>
        </div>
        <div className="settings-stack">
          {selectedImage ? (
            <div className="selected-file-card">
              <span>선택 이미지</span>
              <strong title={selectedImage.name}>{selectedImage.name}</strong>
              <small>
                {formatDimensions(selectedImage)} · {formatBytes(selectedImage.metadata?.file?.sizeBytes)} ·{' '}
                {selectedImage.metadata?.image?.format || 'IMAGE'}
              </small>
              {selectedChip ? <b className={`chip ${selectedChip.tone}`}>{selectedChip.label}</b> : null}
            </div>
          ) : null}
          <label className="field-block">
            <span>저장 위치</span>
            <div className="path-control">
              <Folder size={17} />
              <strong title={parentDir}>{parentDir || '저장할 상위 폴더를 선택하세요'}</strong>
              <button onClick={onChooseFolder} disabled={busy}>
                찾아보기
              </button>
            </div>
          </label>
          <label className="field-block">
            <span>하위 폴더명</span>
            <input className="folder-name-input" value={exportFolderName} readOnly />
          </label>
          <label className="field-block">
            <span>파일명</span>
            <select value="prefix" readOnly>
              <option value="prefix">NOEXIF_원본파일명</option>
            </select>
          </label>
          <label className="field-block">
            <span>덮어쓰기 처리</span>
            <select value={overwriteMode} onChange={event => onOverwriteModeChange(event.target.value)}>
              <option value="rename">중복 시 번호 붙이기</option>
              <option value="confirm">중복 시 덮어쓰기 전 확인</option>
            </select>
          </label>
          <div className="export-summary">
            <span>선택</span>
            <strong>{exifTargetCount}장</strong>
            <small>{plannedOutputDir || '저장 위치를 선택하세요.'}</small>
          </div>
          <button className="primary-cta" onClick={onExport} disabled={busy || !exifTargetCount}>
            <ShieldCheck size={20} /> EXIF 제거 저장
          </button>
        </div>
      </aside>
    </main>
  );
}
