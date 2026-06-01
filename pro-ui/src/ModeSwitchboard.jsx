import React, { lazy } from 'react';

import { ExifRemoveMode } from './ExifRemoveMode.jsx';
import { GridStudioMode } from './GridStudioMode.jsx';
import { MetadataMode } from './MetadataMode.jsx';

const PromptShareMode = lazy(() => import('./PromptShareMode.jsx').then(module => ({ default: module.PromptShareMode })));
const PixivImportMode = lazy(() => import('./PixivImportMode.jsx').then(module => ({ default: module.PixivImportMode })));

export function ModeSwitchboard({
  activeMode,
  exifProps,
  gridProps,
  metadataProps,
  pixivProps,
  promptShareProps,
}) {
  if (activeMode === 'exif') {
    return <ExifRemoveMode {...exifProps} />;
  }

  if (activeMode === 'grid') {
    return <GridStudioMode {...gridProps} />;
  }

  if (activeMode === 'metadata') {
    return <MetadataMode {...metadataProps} />;
  }

  if (activeMode === 'pixiv') {
    return <PixivImportMode {...pixivProps} />;
  }

  return <PromptShareMode {...promptShareProps} />;
}
