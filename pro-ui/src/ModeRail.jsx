import React from 'react';
import { Download, Grid2X2, Search, Share2, ShieldCheck } from 'lucide-react';

export const modes = [
  { id: 'exif', label: 'EXIF 제거', shortLabel: 'EXIF 제거', icon: ShieldCheck },
  { id: 'grid', label: '그리드 생성', shortLabel: '그리드', icon: Grid2X2 },
  { id: 'metadata', label: '메타데이터', shortLabel: '메타데이터', icon: Search },
  { id: 'prompt-share', label: '프롬프트 공유', shortLabel: '프롬프트', icon: Share2 },
  { id: 'pixiv', label: 'Pixiv 가져오기', shortLabel: 'Pixiv', icon: Download },
];

export function ModeRail({ activeMode, onChange }) {
  const activeIndex = Math.max(0, modes.findIndex(mode => mode.id === activeMode));

  return (
    <nav className="mode-rail" aria-label="작업 모드">
      <div className="rail-logo">
        <ShieldCheck size={24} />
      </div>
      <div className="rail-modes-wrapper" style={{ position: 'relative', width: '100%', padding: '0 4px' }}>
        <div
          className="rail-active-pill"
          style={{
            position: 'absolute',
            left: '8px',
            right: '8px',
            height: '86px',
            borderRadius: '8px',
            background: 'rgba(162, 185, 161, 0.08)',
            border: '1px solid rgba(162, 185, 161, 0.25)',
            transform: `translateY(${activeIndex * (86 + 12)}px)`,
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <div className="rail-active-line" />
        </div>

        <div className="rail-modes" style={{ position: 'relative', zIndex: 1, background: 'transparent' }}>
          {modes.map(mode => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                data-mode={mode.id}
                className={`rail-button${activeMode === mode.id ? ' is-active' : ''}`}
                onClick={() => onChange(mode.id)}
                title={mode.label}
              >
                <div className="rail-icon-wrapper" style={{ display: 'inline-flex' }}>
                  <Icon size={24} />
                </div>
                <span>{mode.shortLabel || mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rail-foot">LOCAL</div>
    </nav>
  );
}
