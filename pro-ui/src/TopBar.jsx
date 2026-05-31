import React from 'react';
import { Activity } from 'lucide-react';
import { buildTopBarStatus } from './topBarModel.js';

export function TopBar({
  mode,
  imageCount,
  exifTargetCount,
  promptCount,
  pixivCount = 0,
  busy,
  onOpenCommand,
}) {
  const status = buildTopBarStatus({
    modeId: mode?.id,
    imageCount,
    exifTargetCount,
    promptCount,
    pixivCount,
    busy,
  });

  return (
    <header className="topbar">
      <div className="brand-block">
        <strong>No EXIF Pro</strong>
        <i />
        <span>{mode?.label || ''}</span>
      </div>
      <div className="top-status">
        <span className="count-pill">
          <Activity size={15} /> {status.countLabel}
        </span>
        <button className="command-hint" type="button" onClick={onOpenCommand}>
          <span>Command</span>
          <kbd>{status.commandHint}</kbd>
        </button>
        {status.busyLabel ? <span className="busy-pill">{status.busyLabel}</span> : null}
      </div>
    </header>
  );
}
