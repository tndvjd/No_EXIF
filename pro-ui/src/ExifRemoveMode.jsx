import React, { useState, useEffect } from 'react';
import { ImagePlus, Folder, ShieldCheck } from 'lucide-react';
import { metadataChip, formatDimensions, formatBytes } from './appUtils.js';

export function SecureExifPreview({ image, zoom = 1, onAdd }) {
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
      <div className="single-preview-frame">
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

export function ExifListItem({ image, index, active, disabled, onSelect, onToggle }) {
  const chip = metadataChip(image);
  return (
    <article className={`exif-list-item${active ? ' is-active' : ''}`} onClick={onSelect}>
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
}

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
  const selectedChip = selectedImage ? metadataChip(selectedImage) : null;

  useEffect(() => {
    setViewerZoom(1);
  }, [selectedImage?.path]);

  function scrollFilmstripWithWheel(event) {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth) return;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (!horizontal) {
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    }
  }

  return (
    <main className="exif-review-mode exif-mode exif-viewer-mode">
      <section className="preview-panel exif-review-stage exif-viewer-stage">
        <SecureExifPreview image={selectedImage} zoom={viewerZoom} onAdd={onAdd} />
        <div className="exif-viewer-toolbar">
          <span>{images.length ? `${selectedImageIndex + 1} / ${images.length}` : '이미지 없음'}</span>
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
          <div className="exif-filmstrip list-scroll" onWheel={scrollFilmstripWithWheel}>
            {images.map((image, index) => (
              <ExifListItem
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
