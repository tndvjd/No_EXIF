import React, { useEffect, useRef } from 'react';
import { Download, Grid2X2, Search, Share2, ShieldCheck } from 'lucide-react';
import { gsap } from 'gsap';

export const modes = [
  { id: 'exif', label: 'EXIF 제거', shortLabel: 'EXIF 제거', icon: ShieldCheck },
  { id: 'grid', label: '그리드 생성', shortLabel: '그리드', icon: Grid2X2 },
  { id: 'metadata', label: '메타데이터', shortLabel: '메타데이터', icon: Search },
  { id: 'prompt-share', label: '프롬프트 공유', shortLabel: '프롬프트', icon: Share2 },
  { id: 'pixiv', label: 'Pixiv 가져오기', shortLabel: 'Pixiv', icon: Download },
];

export function ModeRail({ activeMode, onChange }) {
  const railRef = useRef(null);

  useEffect(() => {
    if (!railRef.current) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const ctx = gsap.context(() => {
      const activeButton = railRef.current.querySelector('.rail-button.is-active');
      if (!activeButton) return;

      const icon = activeButton.querySelector('.rail-icon-wrapper');
      const line = activeButton.querySelector('.rail-active-line');
      gsap.killTweensOf([activeButton, icon, line]);
      gsap.fromTo(activeButton, { y: 2 }, { y: 0, duration: 0.18, ease: 'power2.out' });
      gsap.fromTo(icon, { scale: 0.94 }, { scale: 1, duration: 0.2, ease: 'power2.out' });
      gsap.fromTo(line, { scaleY: 0.25, transformOrigin: 'center center' }, { scaleY: 1, duration: 0.22, ease: 'power2.out' });
    }, railRef);

    return () => ctx.revert();
  }, [activeMode]);

  return (
    <nav className="mode-rail" aria-label="작업 모드" ref={railRef}>
      <div className="rail-logo" aria-hidden="true">
        <ShieldCheck size={20} />
      </div>

      <div className="rail-modes">
        {modes.map(mode => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;

          return (
            <button
              key={mode.id}
              data-mode={mode.id}
              className={`rail-button${isActive ? ' is-active' : ''}`}
              onClick={() => onChange(mode.id)}
              title={mode.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="rail-active-line" aria-hidden="true" />
              <span className="rail-icon-wrapper" aria-hidden="true">
                <Icon size={20} strokeWidth={2.1} />
              </span>
              <span className="rail-button-label">{mode.shortLabel || mode.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rail-foot" aria-hidden="true" />
    </nav>
  );
}
