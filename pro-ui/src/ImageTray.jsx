import React from 'react';

export function ImageTray({ images, onAdd, onMove, onToggleExif, disabled, icons }) {
  const { ImagePlus, ArrowUp, ArrowDown } = icons;

  return (
    <aside className="image-tray">
      <div className="panel-header">
        <div>
          <h2>Image Tray</h2>
          <p>{images.length} Photos</p>
        </div>
        <button className="small-button" onClick={onAdd} disabled={disabled}>
          <ImagePlus size={16} /> 추가
        </button>
      </div>

      {images.length === 0 ? (
        <div className="empty-tray">
          <ImagePlus size={28} />
          <strong>이미지를 추가하세요</strong>
          <span>원본은 그대로 두고 새 결과물만 저장합니다.</span>
        </div>
      ) : (
        <div className="thumb-grid">
          {images.map((image, index) => (
            <article className="thumb-card" key={image.path}>
              <div className="thumb-preview">
                {image.thumb ? <img src={image.thumb} alt="" /> : <span>로드 실패</span>}
                <b className={image.hasExif ? 'badge warn' : 'badge ok'}>
                  {image.hasExif ? 'EXIF 있음' : '정리됨'}
                </b>
              </div>
              <div className="thumb-meta">
                <label className="thumb-check" title="EXIF 제거 저장 대상">
                  <input
                    type="checkbox"
                    checked={image.removeExif !== false}
                    onChange={event => onToggleExif(index, event.target.checked)}
                    disabled={disabled}
                  />
                </label>
                <span title={image.name}>{image.name}</span>
                <div className="thumb-actions">
                  <button onClick={() => onMove(index, -1)} disabled={index === 0 || disabled} title="위로">
                    <ArrowUp size={13} />
                  </button>
                  <button onClick={() => onMove(index, 1)} disabled={index === images.length - 1 || disabled} title="아래로">
                    <ArrowDown size={13} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
