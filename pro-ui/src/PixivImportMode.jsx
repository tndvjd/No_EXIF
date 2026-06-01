import React, { useEffect, useMemo, useRef } from 'react';
import {
  Check,
  Download,
  FolderOpen,
  ImageDown,
  KeyRound,
  Link,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { gsap } from 'gsap';
import { formatBytes } from './appUtils.js';
import { choosePixivDownloadItems, filterPixivItems, summarizePixivEstimate } from './pixivImportUtils.js';

const filterLabels = ['전체', '일러스트', '만화', '이미 받은 파일 제외'];

function pixivPreviewBackground(preview) {
  if (!preview) {
    return 'linear-gradient(135deg, rgba(232, 184, 79, 0.22), rgba(255, 255, 255, 0.04))';
  }
  if (/^(data:image\/|https?:\/\/)/.test(preview)) {
    const escaped = String(preview).replace(/"/g, '\\"');
    return `center / cover no-repeat url("${escaped}")`;
  }
  return preview;
}

function PixivThumb({ item, index, onToggle }) {
  const title = item.title || `Pixiv 작품 ${item.illustId || ''}`.trim();
  const fileName = item.fileName || '파일명 미확인';
  const resolution = item.resolution || '해상도 확인 전';
  const pageCount = Number(item.pageCount || 1);

  return (
    <button
      type="button"
      className={`pixiv-card${item.selected !== false ? ' is-selected' : ''}`}
      onClick={() => onToggle(index)}
    >
      <span className="pixiv-check">
        {item.selected !== false ? <Check size={14} /> : null}
      </span>
      <span
        className="pixiv-thumb"
        style={{
          background: pixivPreviewBackground(item.preview || item.previewUrl),
        }}
      />
      <span className="pixiv-card-body">
        <strong title={title}>{title}</strong>
        <small title={fileName}>{fileName}</small>
        <span className="pixiv-card-meta">
          <em>{resolution}</em>
          <i>{pageCount}장</i>
        </span>
      </span>
    </button>
  );
}

function AnimatedMetricValue({ value }) {
  const valueRef = useRef(null);
  const previousValueRef = useRef(Number(value) || 0);

  useEffect(() => {
    const nextValue = Number(value) || 0;
    if (!valueRef.current) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      valueRef.current.textContent = String(nextValue);
      previousValueRef.current = nextValue;
      return undefined;
    }

    const counter = { value: previousValueRef.current };
    const tween = gsap.to(counter, {
      value: nextValue,
      duration: 0.36,
      ease: 'power2.out',
      onUpdate: () => {
        if (valueRef.current) valueRef.current.textContent = String(Math.round(counter.value));
      },
      onComplete: () => {
        if (valueRef.current) valueRef.current.textContent = String(nextValue);
      },
    });
    previousValueRef.current = nextValue;

    return () => tween.kill();
  }, [value]);

  return <strong ref={valueRef}>{value}</strong>;
}

export function PixivImportMode({
  state,
  busy,
  onChange,
  onToggleItem,
  onSelectAll,
  onClearSelection,
  onMockList,
  onChooseFolder,
  onMockDownload,
  onAddDownloaded,
}) {
  const pixivRef = useRef(null);
  const visibleItems = useMemo(() => filterPixivItems(state.items, state), [state]);
  const downloadItems = useMemo(() => choosePixivDownloadItems(state.items, state), [state]);
  const estimate = useMemo(() => summarizePixivEstimate(downloadItems), [downloadItems]);
  const estimateLabel = estimate.known ? formatBytes(estimate.bytes) : '다운로드 후 확인';
  const hasItems = visibleItems.length > 0;

  useEffect(() => {
    if (!pixivRef.current || !hasItems) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.pixiv-card',
        { autoAlpha: 0, y: 12, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.24,
          ease: 'power2.out',
          stagger: 0.035,
          overwrite: true,
        },
      );
      gsap.fromTo(
        '.pixiv-queue-bar',
        { autoAlpha: 0.82, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out', overwrite: true },
      );
    }, pixivRef);

    return () => ctx.revert();
  }, [hasItems, state.filter, state.query, visibleItems.length]);

  return (
    <section className="pixiv-import-mode" ref={pixivRef}>
      <aside className="pixiv-source-panel">
        <div className="pixiv-panel-head">
          <span className="panel-kicker">PIXIV SOURCE</span>
          <h2>Pixiv 소스</h2>
          <p>작가 URL이나 ID를 넣고, 다운로드 후보를 먼저 확인합니다.</p>
        </div>

        <label className="pixiv-field">
          <span><Link size={15} /> 작가 URL 또는 ID</span>
          <input
            value={state.target}
            onChange={event => onChange({ target: event.target.value })}
            placeholder="https://www.pixiv.net/users/73211891/illustrations"
          />
        </label>

        <label className="pixiv-field">
          <span><KeyRound size={15} /> Refresh Token</span>
          <input
            type="password"
            value={state.refreshToken}
            onChange={event => onChange({ refreshToken: event.target.value })}
            placeholder="토큰은 작업 중에만 사용"
          />
        </label>

        <div className="pixiv-field-grid">
          <label className="pixiv-field">
            <span>최대 작품 수</span>
            <input
              type="number"
              min="1"
              max="200"
              value={state.limit}
              onChange={event => onChange({ limit: Number(event.target.value) })}
            />
          </label>
          <label className="pixiv-field">
            <span>타임아웃</span>
            <input
              type="number"
              min="5"
              max="120"
              value={state.timeout}
              onChange={event => onChange({ timeout: Number(event.target.value) })}
            />
          </label>
        </div>

        <button className="pixiv-folder-button" type="button" onClick={onChooseFolder}>
          <FolderOpen size={17} />
          <span>{state.outputDir || '저장 폴더 선택'}</span>
        </button>

        <button className="pixiv-primary" type="button" disabled={busy} onClick={onMockList}>
          <Search size={18} />
          작품 목록 불러오기
        </button>
      </aside>

      <main className="pixiv-browser-panel">
        <div className="pixiv-browser-top">
          <div>
            <span className="panel-kicker">DOWNLOAD CANDIDATES</span>
            <h2>다운로드 후보</h2>
          </div>
          <div className="pixiv-search">
            <Search size={16} />
            <input
              value={state.query}
              onChange={event => onChange({ query: event.target.value })}
              placeholder="작품명, 파일명 검색"
            />
          </div>
        </div>

        <div className="pixiv-filter-row">
          {filterLabels.map(label => (
            <button
              type="button"
              key={label}
              className={state.filter === label ? 'is-active' : ''}
              onClick={() => onChange({ filter: label })}
            >
              {label}
            </button>
          ))}
        </div>

        {hasItems ? (
          <div className="pixiv-card-grid">
            {visibleItems.map(item => (
              <PixivThumb
                key={`${item.illustId}-${item.fileName}`}
                item={item}
                index={item.originalIndex}
                onToggle={onToggleItem}
              />
            ))}
          </div>
        ) : (
          <div className="pixiv-empty-state">
            <ImageDown size={42} />
            <strong>Pixiv 목록을 불러오면 후보 이미지가 여기에 표시됩니다.</strong>
            <span>먼저 목록을 보고, 필요한 이미지만 체크해서 가져오는 흐름입니다.</span>
          </div>
        )}

        <div className="pixiv-queue-bar">
          <div>
            <strong>대상 {downloadItems.length}장</strong>
            <span>예상 {estimateLabel} · 저장 위치 {state.outputDir ? '확인됨' : '미선택'}</span>
          </div>
          <div className="pixiv-queue-actions">
            <button type="button" onClick={onSelectAll}>전체 선택</button>
            <button type="button" onClick={onClearSelection}>전체 해제</button>
          </div>
        </div>
      </main>

      <aside className="pixiv-inspector-panel">
        <div className="pixiv-panel-head">
          <span className="panel-kicker">IMPORT SETTINGS</span>
          <h2>가져오기 설정</h2>
        </div>

        <div className="pixiv-segmented">
          {['선택한 이미지만', '새 파일만', '전체 다시 받기'].map(mode => (
            <button
              key={mode}
              type="button"
              className={state.downloadMode === mode ? 'is-active' : ''}
              onClick={() => onChange({ downloadMode: mode })}
            >
              {mode}
            </button>
          ))}
        </div>

        <label className="pixiv-slider">
          <span><SlidersHorizontal size={15} /> 동시 다운로드 <em>{state.workers}</em></span>
          <input
            type="range"
            min="1"
            max="8"
            value={state.workers}
            onChange={event => onChange({ workers: Number(event.target.value) })}
          />
        </label>

        <div className="pixiv-field-grid">
          <label className="pixiv-field">
            <span>재시도</span>
            <input
              type="number"
              min="0"
              max="5"
              value={state.retries}
              onChange={event => onChange({ retries: Number(event.target.value) })}
            />
          </label>
          <label className="pixiv-field">
            <span>형식</span>
            <select value={state.naming} onChange={event => onChange({ naming: event.target.value })}>
              <option value="작품순_원본명">작품순_원본명</option>
              <option value="artistId_illustId">작가ID_작품ID</option>
            </select>
          </label>
        </div>

        <div className="pixiv-result-metrics">
          <div><span>새로 저장</span><AnimatedMetricValue value={state.resultCounts.downloaded} /></div>
          <div><span>이미 있음</span><AnimatedMetricValue value={state.resultCounts.skipped} /></div>
          <div><span>실패</span><AnimatedMetricValue value={state.resultCounts.failed} /></div>
        </div>

        <button className="pixiv-download-cta" type="button" disabled={!downloadItems.length || busy} onClick={onMockDownload}>
          <Download size={19} />
          선택 이미지 다운로드
        </button>
        <button className="pixiv-secondary" type="button" disabled={!state.downloadedPaths.length} onClick={onAddDownloaded}>
          다운로드 후 앱에 추가
        </button>
      </aside>
    </section>
  );
}
