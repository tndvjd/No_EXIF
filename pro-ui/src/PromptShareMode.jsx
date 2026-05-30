import React, { useRef, useMemo, useState, useEffect } from 'react';
import {
  ImagePlus,
  ShieldCheck,
  Search,
  ListFilter,
  Star,
  Minus,
  Plus,
  Maximize2,
  Copy,
  Undo2,
  Redo2,
  FolderOpen,
  Type,
  SlidersHorizontal,
  QrCode,
  Download,
} from 'lucide-react';
import { extractComfyPromptCard, metadataChip } from './appUtils.js';
import {
  drawPromptCard,
  PROMPT_CARD_RATIOS,
  PROMPT_CARD_TEMPLATES,
  promptTextForMode,
  resolvePromptCardSize,
} from './promptCardRenderer.js';

export function RangeField({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <label className="slider-row prompt-slider-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
      <em>
        {value}
        {suffix}
      </em>
    </label>
  );
}

export function PromptShareInspector({ settings, card, size, busy, onSettingChange, onExport }) {
  return (
    <aside className="panel metadata-info prompt-preset-panel">
      <div className="info-stack prompt-inspector-stack">
        <section className="prompt-template-picker">
          <h3>템플릿</h3>
          <div className="prompt-template-strip">
            {PROMPT_CARD_TEMPLATES.map(template => (
              <button
                key={template.id}
                data-template={template.id}
                className={settings.template === template.id ? 'is-active' : ''}
                onClick={() => onSettingChange('template', template.id)}
                title={template.description}
              >
                <span className={`template-thumb ${template.id}`}>
                  {template.id === 'magazine'
                    ? 'PROMPT'
                    : template.id === 'zine'
                    ? 'ZINE'
                    : template.id === 'recipe'
                    ? 'RECIPE'
                    : 'MIN'}
                </span>
                <strong>{template.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="prompt-inspector-section">
          <h3>
            <Type size={16} /> 프롬프트 텍스트
          </h3>
          <label className="field-block">
            <span>제목</span>
            <input
              value={settings.title}
              onChange={event => onSettingChange('title', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>브랜드 / 핸들</span>
            <input
              value={settings.brand}
              onChange={event => onSettingChange('brand', event.target.value)}
            />
            <input
              value={settings.handle}
              onChange={event => onSettingChange('handle', event.target.value)}
            />
          </label>
          <label className="field-block">
            <span>표시 범위</span>
            <select
              value={settings.promptMode}
              onChange={event => onSettingChange('promptMode', event.target.value)}
            >
              <option value="positive">Positive만</option>
              <option value="full">전체 텍스트</option>
              <option value="positive-negative">Positive + Negative</option>
            </select>
          </label>
          <RangeField
            label="텍스트 밀도"
            value={settings.textScale}
            min={70}
            max={130}
            suffix="%"
            onChange={value => onSettingChange('textScale', value)}
          />
          <RangeField
            label="줄 간격"
            value={settings.lineHeight}
            min={1.05}
            max={1.6}
            step={0.05}
            onChange={value => onSettingChange('lineHeight', value)}
          />
          <RangeField
            label="레이아웃"
            value={settings.columns}
            min={1}
            max={3}
            onChange={value => onSettingChange('columns', value)}
          />
        </section>

        <section className="prompt-inspector-section">
          <h3>
            <SlidersHorizontal size={16} /> 가독성
          </h3>
          <label className="field-block">
            <span>배경 오버레이</span>
            <select
              value={settings.readability}
              onChange={event => onSettingChange('readability', event.target.value)}
            >
              <option value="gradient">그라디언트</option>
              <option value="solid">텍스트 박스</option>
              <option value="blur">블러 패널</option>
              <option value="none">없음</option>
            </select>
          </label>
          <RangeField
            label="강도"
            value={settings.darken}
            min={0}
            max={72}
            suffix="%"
            onChange={value => onSettingChange('darken', value)}
          />
        </section>

        <section className="prompt-inspector-section">
          <h3>
            <QrCode size={16} /> 메타데이터 표시
          </h3>
          <div className="prompt-check-grid">
            {[
              ['showModel', 'Model'],
              ['showLora', 'LoRA'],
              ['showSeed', 'Seed'],
              ['showSteps', 'Steps'],
              ['showCfg', 'CFG'],
              ['showSampler', 'Sampler'],
              ['showQr', 'QR 코드 표시'],
            ].map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={settings[key] !== false}
                  onChange={event => onSettingChange(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="prompt-inspector-section prompt-export-settings">
          <h3>
            <Download size={16} /> 내보내기 설정
          </h3>
          <label className="field-block">
            <span>해상도</span>
            <select
              value={settings.ratio}
              onChange={event => onSettingChange('ratio', event.target.value)}
            >
              {PROMPT_CARD_RATIOS.map(ratio => (
                <option key={ratio.id} value={ratio.id}>
                  {ratio.width} x {ratio.height} ({ratio.label})
                </option>
              ))}
            </select>
          </label>
          {settings.ratio === 'custom' ? (
            <div className="custom-size-grid">
              <label className="field-block">
                <span>가로</span>
                <input
                  type="number"
                  min="640"
                  max="3200"
                  value={settings.width}
                  onChange={event => onSettingChange('width', Number(event.target.value))}
                />
              </label>
              <label className="field-block">
                <span>세로</span>
                <input
                  type="number"
                  min="640"
                  max="4000"
                  value={settings.height}
                  onChange={event => onSettingChange('height', Number(event.target.value))}
                />
              </label>
            </div>
          ) : null}
          <div className="metadata-digest prompt-export-digest">
            <span>PNG Export</span>
            <strong>
              {size.width} x {size.height}
            </strong>
            <small>
              {card.model || '모델 정보 없음'} · LoRA {card.loras?.length || 0}개 · 프롬프트 전문
              유지
            </small>
          </div>
        </section>
        <button
          className="prompt-export-button"
          onClick={onExport}
          disabled={busy || !card.present}
        >
          <Download size={20} /> PNG 내보내기
        </button>
      </div>
    </aside>
  );
}

export function PromptShareMode({
  images,
  promptItems,
  selectedImage,
  selectedImageIndex,
  settings,
  busy,
  onAdd,
  onSelectImage,
  onSettingChange,
  onCopyPrompt,
  onSendToExif,
  onExport,
}) {
  const canvasRef = useRef(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [zoom, setZoom] = useState(70);
  const [guidesVisible, setGuidesVisible] = useState(true);
  const [renderError, setRenderError] = useState('');
  const card = useMemo(
    () => extractComfyPromptCard(selectedImage?.metadata || {}),
    [selectedImage?.metadata]
  );
  const size = resolvePromptCardSize(settings);
  const fullPrompt = promptTextForMode(card, settings.promptMode);
  const activeTemplate =
    PROMPT_CARD_TEMPLATES.find(item => item.id === settings.template) ||
    PROMPT_CARD_TEMPLATES[0];
  const promptStats = useMemo(
    () => ({
      total: promptItems.length,
      workflow: promptItems.filter(item => item.card?.source === 'workflow').length,
      clean: promptItems.filter(
        item => !(item.image.hasExif || item.image.metadata?.privacy?.hasExif)
      ).length,
    }),
    [promptItems]
  );
  const filteredPromptItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return promptItems.filter(({ image, card: itemCard }, itemIndex) => {
      const haystack = `${image.name} ${image.path} ${itemCard.model || ''} ${
        itemCard.positivePrompt || ''
      }`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'workflow' && itemCard.source === 'workflow') ||
        (filter === 'clean' && !(image.hasExif || image.metadata?.privacy?.hasExif)) ||
        (filter === 'favorite' && itemIndex === 0);
      return matchesQuery && matchesFilter;
    });
  }, [filter, promptItems, query]);
  const zoomStyle = `${zoom}%`;
  const stageScale = Math.max(0.74, Math.min(1.35, zoom / 70));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedImage) return undefined;
    let cancelled = false;
    drawPromptCard(canvas, {
      image: selectedImage,
      imageSource: selectedImage.preview || selectedImage.thumb,
      card,
      settings,
    })
      .then(() => {
        if (!cancelled) setRenderError('');
      })
      .catch(error => {
        if (!cancelled) setRenderError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [card, selectedImage?.path, selectedImage?.preview, selectedImage?.thumb, settings]);

  return (
    <main className="mode-grid prompt-share-mode">
      <aside className="panel prompt-source-panel prompt-library-panel">
        <div className="prompt-panel-title">
          <div>
            <h2>이미지 라이브러리</h2>
            <p>
              {promptStats.total}장 이미지 · {promptStats.workflow}개 워크플로우 감지
            </p>
          </div>
          <button className="prompt-detected-pill" type="button" onClick={onAdd} disabled={busy}>
            <ShieldCheck size={15} /> 메타데이터 감지
          </button>
        </div>
        <div className="prompt-library-search">
          <label className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="이미지, 태그, 프롬프트 검색..."
            />
          </label>
          <button type="button" title="필터">
            <ListFilter size={17} />
          </button>
        </div>
        <div className="prompt-filter-pills">
          {[
            ['all', `전체 ${promptStats.total}`],
            ['workflow', `워크플로우 ${promptStats.workflow}`],
            ['clean', `EXIF 없음 ${promptStats.clean}`],
            ['favorite', '즐겨찾기 ★'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? 'is-active' : ''}
              type="button"
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {filteredPromptItems.length ? (
          <div className="prompt-library-grid">
            {filteredPromptItems.map(({ image, index, card: itemCard }) => {
              const chip = metadataChip(image);
              return (
                <article
                  key={image.path}
                  className={`prompt-library-card${
                    index === selectedImageIndex ? ' is-active' : ''
                  }`}
                  onClick={() => onSelectImage(index)}
                >
                  <img src={image.thumb} alt="" />
                  <button type="button" title="즐겨찾기">
                    <Star size={15} />
                  </button>
                  <div>
                    <strong title={image.name}>{image.name}</strong>
                    <span>{itemCard.model || 'ComfyUI prompt'}</span>
                  </div>
                  <b className={`chip ${chip.tone}`}>{itemCard.source || chip.label}</b>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-tray">
            <ImagePlus size={28} />
            <strong>프롬프트가 있는 이미지를 추가하세요</strong>
            <span>
              ComfyUI PNG의 prompt/workflow 태그가 있는 이미지를 카드로 만들 수 있습니다.
            </span>
            <button className="small-button" onClick={onAdd}>
              <ImagePlus size={16} /> 이미지 추가
            </button>
          </div>
        )}
        <div className="prompt-library-foot">
          <span>
            선택 {selectedImage ? '1' : '0'} / {promptItems.length}
          </span>
          <button type="button" onClick={onAdd}>
            <FolderOpen size={15} /> 폴더 열기
          </button>
        </div>
      </aside>

      <section className="prompt-share-preview prompt-editor-panel">
        {selectedImage && (card.present || card.positivePrompt || card.negativePrompt) ? (
          <>
            <div className="prompt-editor-toolbar">
              <select
                className="prompt-ratio-select"
                value={settings.ratio}
                onChange={event => onSettingChange('ratio', event.target.value)}
              >
                {PROMPT_CARD_RATIOS.map(ratio => (
                  <option key={ratio.id} value={ratio.id}>
                    {ratio.label} ({ratio.width} x {ratio.height})
                  </option>
                ))}
              </select>
              <select value="fit" onChange={() => {}} aria-label="보기 방식">
                <option value="fit">맞춤</option>
              </select>
              <div className="prompt-zoom-control">
                <button type="button" onClick={() => setZoom(value => Math.max(52, value - 8))}>
                  <Minus size={15} />
                </button>
                <strong>{zoomStyle}</strong>
                <button type="button" onClick={() => setZoom(value => Math.min(118, value + 8))}>
                  <Plus size={15} />
                </button>
              </div>
              <button type="button" title="화면 맞춤" onClick={() => setZoom(70)}>
                <Maximize2 size={16} />
              </button>
              <button type="button" onClick={onCopyPrompt} disabled={!fullPrompt}>
                <Copy size={16} /> 복사
              </button>
            </div>
            <div
              className={`prompt-card-stage${guidesVisible ? ' show-guides' : ''}`}
              style={{
                '--prompt-card-ratio': `${size.width} / ${size.height}`,
                '--prompt-stage-scale': stageScale,
              }}
            >
              <div className="prompt-card-mount">
                <canvas ref={canvasRef} aria-label="프롬프트 공유 카드 미리보기" />
                <i className="corner top-left" />
                <i className="corner top-right" />
                <i className="corner bottom-left" />
                <i className="corner bottom-right" />
              </div>
              {renderError ? <div className="prompt-render-error">{renderError}</div> : null}
            </div>
            <div className="prompt-editor-footer">
              <button type="button" onClick={() => setZoom(100)}>
                실제 크기
              </button>
              <button type="button" onClick={() => setZoom(70)}>
                화면 맞춤
              </button>
              <button type="button" disabled>
                <Undo2 size={16} />
              </button>
              <button type="button" disabled>
                <Redo2 size={16} />
              </button>
              <button
                type="button"
                className={guidesVisible ? 'is-active' : ''}
                onClick={() => setGuidesVisible(value => !value)}
              >
                가이드 표시
              </button>
              <span>
                {size.width} x {size.height} · {activeTemplate.label}
              </span>
            </div>
          </>
        ) : (
          <div className="large-empty">
            <ImagePlus size={34} />
            <strong>공유할 프롬프트가 없습니다</strong>
            <span>
              ComfyUI workflow/prompt가 포함된 PNG를 추가하거나 메타데이터 탭에서 이미지를 보내세요.
            </span>
            <button className="small-button" onClick={onAdd}>
              <ImagePlus size={16} /> 이미지 추가
            </button>
          </div>
        )}
      </section>

      <PromptShareInspector
        settings={settings}
        card={card}
        size={size}
        busy={busy}
        onSettingChange={onSettingChange}
        onExport={onExport}
      />
    </main>
  );
}
