import { useState } from 'react';

import { IMPORT_IMAGE_LIMIT } from './appConstants.js';
import { fileBaseName, parseDroppedPathText } from './appUtils.js';
import {
  buildImageImportToast,
  decorateImportedImages,
  uniqueNewImagePaths,
} from './imageImportModel.js';

export function useImageImportController({
  images,
  busy,
  setBusy,
  setImages,
  setSelectedImageIndex,
  recordHistory,
  showToast,
}) {
  const [dragActive, setDragActive] = useState(false);

  async function importImagePaths(paths) {
    if (!paths?.length) return;
    const nextPaths = uniqueNewImagePaths(paths, images.map(image => image.path));
    if (!nextPaths.length) {
      showToast({ type: 'info', title: '이미 추가된 이미지는 건너뛰었습니다.' });
      return;
    }
    const result = await window.noExif.inspectImages({
      paths: nextPaths,
      includePreview: false,
      maxFiles: IMPORT_IMAGE_LIMIT,
    });
    recordHistory();
    setImages(current => [
      ...current,
      ...decorateImportedImages(result.items),
    ]);
    if (!images.length && result.items.length) {
      setSelectedImageIndex(0);
    }
    showToast(buildImageImportToast(result, { fileBaseName, limit: IMPORT_IMAGE_LIMIT }));
  }

  async function addImages() {
    setBusy(true);
    try {
      const paths = await window.noExif.selectImages();
      await importImagePaths(paths);
    } catch (error) {
      showToast({ type: 'error', title: '이미지 추가 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (busy) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.dataTransfer.dropEffect = 'copy';
    setDragActive(true);
  }

  function handleDragLeave(event) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDragActive(false);
  }

  async function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    if (busy) return;

    const files = Array.from(event.dataTransfer.files || []);
    const nativePaths = window.noExif.getDroppedFilePaths(files);
    const textPaths = parseDroppedPathText(
      event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain'),
    );
    const paths = nativePaths.length ? nativePaths : textPaths;
    if (!paths.length) {
      showToast({ type: 'error', title: '드롭한 이미지 경로를 읽지 못했습니다.' });
      return;
    }

    setBusy(true);
    try {
      await importImagePaths(paths);
    } catch (error) {
      showToast({ type: 'error', title: '이미지 드롭 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  return {
    dragActive,
    importImagePaths,
    addImages,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
