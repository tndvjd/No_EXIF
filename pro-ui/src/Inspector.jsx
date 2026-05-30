import React from 'react';
import { Crop, Download, Grid2X2, Palette, SlidersHorizontal } from 'lucide-react';

function NumberControl({ label, value, min, max, suffix, onChange }) {
  return (
    <label className="field-row">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
      {suffix ? <em>{suffix}</em> : null}
    </label>
  );
}

export function Inspector({
  settings,
  selectedCount,
  canUnmerge = false,
  mergeReason = '',
  cropTarget,
  cropTargetIndex,
  imageCount,
  cellCount,
  busy,
  onSettingChange,
  onRecommendGrid,
  onMerge,
  onUnmerge,
  onClearCellImages,
  onReset,
  onClearSelection,
  onCropChange,
  onExport,
}) {
  const mergeDisabled = selectedCount < 2;
  const unmergeDisabled = !canUnmerge;
  const mergeTitle = mergeDisabled
    ? '두 칸 이상 선택하세요.'
    : mergeReason || '선택한 칸을 하나로 병합합니다.';

  return (
    <aside className="inspector">
      <div className="inspector-scroll">
        <section className="inspector-section">
        <h2><Palette size={17} /> 캔버스</h2>
        <div className="size-preset">
          <button onClick={() => { onSettingChange('width', 1600); onSettingChange('height', 2000); }}>4:5</button>
          <button onClick={() => { onSettingChange('width', 1600); onSettingChange('height', 1600); }}>1:1</button>
          <button onClick={() => { onSettingChange('width', 1920); onSettingChange('height', 1080); }}>16:9</button>
          <button onClick={() => { onSettingChange('width', 1080); onSettingChange('height', 1920); }}>9:16</button>
        </div>
        <NumberControl label="너비" value={settings.width} min={320} max={6000} suffix="px" onChange={value => onSettingChange('width', value)} />
        <NumberControl label="높이" value={settings.height} min={320} max={6000} suffix="px" onChange={value => onSettingChange('height', value)} />
        <label className="field-row">
          <span>배경색</span>
          <input type="color" value={settings.background} onChange={event => onSettingChange('background', event.target.value)} />
          <em>{settings.background.toUpperCase()}</em>
        </label>
      </section>

        <section className="inspector-section">
        <h2><Grid2X2 size={17} /> 그리드</h2>
        <button className="secondary-wide" onClick={onRecommendGrid} disabled={!imageCount || busy}>사진 수 기준 추천</button>
        <NumberControl label="행" value={settings.rows} min={1} max={8} onChange={value => onSettingChange('rows', value)} />
        <NumberControl label="열" value={settings.cols} min={1} max={8} onChange={value => onSettingChange('cols', value)} />
        <label className="slider-row">
          <span>간격</span>
          <input type="range" min="0" max="80" value={settings.gap} onChange={event => onSettingChange('gap', Number(event.target.value))} />
          <em>{settings.gap}px</em>
        </label>
        <label className="slider-row">
          <span>모서리</span>
          <input type="range" min="0" max="80" value={settings.radius} onChange={event => onSettingChange('radius', Number(event.target.value))} />
          <em>{settings.radius}px</em>
        </label>
      </section>

        <section className="inspector-section">
        <h2><Grid2X2 size={17} /> 셀 편집</h2>
        <div className="selected-summary">
          <span>선택 영역</span>
          <strong>{selectedCount ? `${selectedCount}칸 선택` : '선택 없음'}</strong>
        </div>
        <div className="merge-tools">
          <button onClick={onMerge} disabled={mergeDisabled} title={mergeTitle}>병합</button>
          <button onClick={onUnmerge} disabled={unmergeDisabled} title={unmergeDisabled ? '병합된 셀 하나를 선택하세요.' : '병합된 칸을 다시 나눕니다.'}>해제</button>
          <button onClick={onClearCellImages} disabled={!selectedCount} title="선택한 셀의 이미지만 비웁니다.">비우기</button>
          <button onClick={onClearSelection} disabled={!selectedCount} title="선택 초기화">초기화</button>
        </div>
        <button className="secondary-wide grid-reset-button" onClick={onReset}>그리드 초기화</button>
        <p className="helper-text">출력 셀 {cellCount}개 · 이미지 {imageCount}장</p>
        {mergeReason ? <p className="helper-text warning-text">{mergeReason}</p> : null}
      </section>

        <section className="inspector-section">
        <h2><Crop size={17} /> 사진 크롭</h2>
        {cropTarget ? (
          <>
            <p className="helper-text crop-file" title={cropTarget.name}>{cropTarget.name}</p>
            <label className="slider-row">
              <span>가로</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={cropTarget.cropX ?? 0.5}
                onChange={event => onCropChange(cropTargetIndex, {
                  cropX: Number(event.target.value),
                  cropY: cropTarget.cropY ?? 0.5,
                })}
              />
              <em>{Math.round((cropTarget.cropX ?? 0.5) * 100)}%</em>
            </label>
            <label className="slider-row">
              <span>세로</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={cropTarget.cropY ?? 0.5}
                onChange={event => onCropChange(cropTargetIndex, {
                  cropX: cropTarget.cropX ?? 0.5,
                  cropY: Number(event.target.value),
                })}
              />
              <em>{Math.round((cropTarget.cropY ?? 0.5) * 100)}%</em>
            </label>
            <button
              className="secondary-wide crop-reset-button"
              type="button"
              onClick={() => onCropChange(cropTargetIndex, { cropX: 0.5, cropY: 0.5 })}
            >
              중앙으로 되돌리기
            </button>
          </>
        ) : (
          <p className="helper-text">셀 하나를 선택하면 해당 사진의 크롭 기준점을 조절할 수 있습니다.</p>
        )}
      </section>

      </div>

      <section className="inspector-section export-section">
        <h2><SlidersHorizontal size={17} /> 내보내기</h2>
        <label className="field-row">
          <span>파일 형식</span>
          <select value={settings.format} onChange={event => onSettingChange('format', event.target.value)}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
          </select>
        </label>
        <label className="slider-row">
          <span>품질</span>
          <input type="range" min="70" max="100" value={settings.quality} onChange={event => onSettingChange('quality', Number(event.target.value))} />
          <em>{settings.quality}</em>
        </label>
        <button className="export-button" onClick={onExport} disabled={busy || imageCount === 0}>
          <Download size={18} /> 그리드 내보내기
        </button>
      </section>
    </aside>
  );
}
