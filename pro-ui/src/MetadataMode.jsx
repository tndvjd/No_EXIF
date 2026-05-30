import React from 'react';
import {
  Folder,
  ImagePlus,
  Search,
  ListFilter,
  Share2,
  ShieldCheck,
  Copy,
  FileJson,
  ExternalLink,
} from 'lucide-react';
import {
  extractComfySummary,
  metadataStatusBadges,
  formatDimensions,
  formatBytes,
  metadataChip,
} from './appUtils.js';
import { EmptyDropCard } from './EmptyDropCard.jsx';

export function InfoTable({ title, rows }) {
  return (
    <section className="info-table">
      <h3>{title}</h3>
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong title={String(value || '')}>{value || '-'}</strong>
        </div>
      ))}
    </section>
  );
}

export function MetadataInfoPanel({ image, summary }) {
  const metadata = image?.metadata;
  const pngKeys = metadata?.pngText?.keys?.length ? metadata.pngText.keys.join(', ') : '-';
  return (
    <aside className="panel metadata-info">
      <div className="panel-header simple">
        <h2>ComfyUI 생성 정보</h2>
      </div>
      {metadata ? (
        <div className="info-stack">
          <section className="metadata-digest">
            <span>{summary.generationPresent ? 'ComfyUI 메타데이터 감지' : '생성 메타데이터 없음'}</span>
            <strong>{summary.model || summary.unet || '모델 정보 없음'}</strong>
            <small>PNG prompt/workflow 태그를 따라 생성 설정을 정리합니다.</small>
          </section>
          <InfoTable
            title="모델 스택"
            rows={[
              ['UNET / Model', summary.unet || summary.model || '-'],
              ['CLIP', summary.clip || '-'],
              ['VAE', summary.vae || '-'],
              ['Prompt 태그', summary.promptPresent ? '있음' : '없음'],
              ['Workflow JSON', summary.workflowPresent ? '있음' : '없음'],
              ['PNG 태그', `${metadata.pngText?.count || 0}개 · ${pngKeys}`],
            ]}
          />
          <InfoTable
            title="샘플링"
            rows={[
              ['Sampler', summary.sampler || '-'],
              ['Scheduler', summary.scheduler || '-'],
              ['Seed', summary.seed || '-'],
              ['Steps', summary.steps || '-'],
              ['CFG', summary.cfg || '-'],
              ['Denoise', summary.denoise || '-'],
              ['Base seed', summary.baseSeed || '-'],
              ['Base steps', summary.baseSteps || '-'],
            ]}
          />
          <section className="lora-box">
            <h3>LoRA</h3>
            {summary.loras?.length ? (
              <div className="lora-list">
                {summary.loras.map(lora => (
                  <span key={`${lora.name}-${lora.strength || ''}`}>
                    <strong>{lora.name}</strong>
                    {lora.strength ? <em>{lora.strength}</em> : null}
                  </span>
                ))}
              </div>
            ) : (
              <p>감지된 LoRA가 없습니다.</p>
            )}
          </section>
          <section className="prompt-box">
            <h3>Positive Prompt</h3>
            <p>{summary.positivePrompt || '감지된 positive prompt가 없습니다.'}</p>
          </section>
          {summary.negativePrompt ? (
            <section className="prompt-box negative">
              <h3>Negative Prompt</h3>
              <p>{summary.negativePrompt}</p>
            </section>
          ) : null}
          <details className="raw-tags">
            <summary>원본 생성 태그 전체 보기</summary>
            <pre>{JSON.stringify(metadata, null, 2)}</pre>
          </details>
        </div>
      ) : (
        <div className="side-empty">이미지를 선택하면 상세 정보가 표시됩니다.</div>
      )}
    </aside>
  );
}

export function MetadataMode({
  images,
  filteredItems,
  selectedImage,
  selectedImageIndex,
  query,
  filter,
  busy,
  onAdd,
  onQueryChange,
  onFilterChange,
  onSelectImage,
  onSendToExif,
  onSendToPromptShare,
  onCopyPrompt,
  onCopyWorkflow,
  onSaveJson,
  onOpenLocation,
}) {
  const summary = extractComfySummary(selectedImage?.metadata);
  const metadata = selectedImage?.metadata;
  const metadataBadges = metadataStatusBadges(selectedImage, summary);
  const previewRatio =
    metadata?.image?.width && metadata?.image?.height
      ? metadata.image.width / metadata.image.height
      : 4 / 3;

  return (
    <main className="mode-grid metadata-mode">
      <aside className="panel metadata-library">
        <div className="panel-header">
          <div>
            <h2>
              <Folder size={18} /> ComfyUI Output
            </h2>
            <p>{images.length}개 이미지</p>
          </div>
          <button className="small-button" onClick={onAdd} disabled={busy}>
            <ImagePlus size={16} /> 이미지 추가
          </button>
        </div>
        <div className="metadata-filters">
          <label className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="검색..."
            />
          </label>
          <label className="filter-box">
            <ListFilter size={16} />
            <select value={filter} onChange={event => onFilterChange(event.target.value)}>
              <option value="all">전체</option>
              <option value="workflow">workflow</option>
              <option value="exif">카메라 EXIF</option>
            </select>
          </label>
        </div>
        {filteredItems.length ? (
          <div className="metadata-list">
            {filteredItems.map(({ image, index, chip }) => (
              <article
                key={image.path}
                className={`metadata-item${index === selectedImageIndex ? ' is-active' : ''}`}
                onClick={() => onSelectImage(index)}
              >
                <img src={image.thumb} alt="" />
                <div>
                  <strong title={image.name}>{image.name}</strong>
                  <span>{formatDimensions(image)}</span>
                  <b className={`chip ${chip.tone}`}>{chip.label}</b>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyDropCard onAdd={onAdd} />
        )}
        <div className="panel-foot">{filteredItems.length}개 표시</div>
      </aside>

      <section className="metadata-preview">
        {selectedImage ? (
          <>
            <div className="metadata-title-row">
              <div>
                <h1>{selectedImage.name}</h1>
                <p>
                  {formatDimensions(selectedImage)} · {formatBytes(selectedImage.metadata?.file?.sizeBytes)} ·{' '}
                  {selectedImage.metadata?.image?.format || '이미지'}
                </p>
              </div>
              <div className="metadata-title-actions">
                <button
                  className="metadata-to-prompt"
                  onClick={onSendToPromptShare}
                  disabled={!summary.generationPresent}
                >
                  <Share2 size={17} /> 프롬프트 공유로
                </button>
                <button className="metadata-to-exif" onClick={onSendToExif}>
                  <ShieldCheck size={17} /> EXIF 제거로 보내기
                </button>
              </div>
            </div>
            <div className="metadata-health-strip">
              {metadataBadges.map(badge => (
                <span className={`status-badge ${badge.tone}`} key={badge.label}>
                  {badge.label}
                </span>
              ))}
            </div>
            <div className="big-image-frame" style={{ '--preview-ratio': previewRatio }}>
              <img src={selectedImage.preview || selectedImage.thumb} alt="" />
            </div>
            <div className="metadata-actions">
              <button onClick={onCopyPrompt} disabled={!summary.positivePrompt}>
                <Copy size={17} /> 프롬프트 복사
              </button>
              <button onClick={onCopyWorkflow} disabled={!summary.workflowPresent}>
                <Copy size={17} /> 워크플로우 복사
              </button>
              <button onClick={onSaveJson}>
                <FileJson size={17} /> JSON 저장
              </button>
              <button onClick={onOpenLocation}>
                <ExternalLink size={17} /> 이미지 위치 열기
              </button>
            </div>
          </>
        ) : (
          <div className="large-empty">
            <Search size={34} />
            <strong>메타데이터를 확인할 이미지를 추가하세요</strong>
            <span>ComfyUI PNG의 workflow/prompt 텍스트 청크와 EXIF 정보를 같이 확인합니다.</span>
          </div>
        )}
      </section>

      <MetadataInfoPanel image={selectedImage} summary={summary} />
    </main>
  );
}
