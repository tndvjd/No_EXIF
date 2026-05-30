import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function TopBar({ mode, imageCount, exifTargetCount, promptCount, pixivCount = 0, busy }) {
  const countLabel = mode.id === 'exif'
    ? `${exifTargetCount}장 선택`
    : mode.id === 'prompt-share'
      ? `${promptCount}개 프롬프트`
      : mode.id === 'pixiv'
        ? `${pixivCount}장 후보`
        : `${imageCount}장 불러옴`;

  return (
    <header className="topbar">
      <div className="brand-block">
        <strong>No EXIF Pro</strong>
        <i />
        <span>{mode?.label || ''}</span>
      </div>
      <div className="top-status">
        <span className="secure-pill">
          <ShieldCheck size={15} /> 로컬 처리 · 원본 유지 · {countLabel}
        </span>
        {busy ? <span className="busy-pill">처리 중</span> : null}
      </div>
    </header>
  );
}
