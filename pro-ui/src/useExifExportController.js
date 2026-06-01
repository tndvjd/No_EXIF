import { useState } from 'react';

import {
  buildExifExportFolderName,
  buildExifOutputDirectory,
} from './appUtils.js';

export function useExifExportController({
  images,
  exifTargetCount,
  setBusy,
  setConfirmDialog,
  showToast,
}) {
  const [exifParentDir, setExifParentDir] = useState('');
  const [exportFolderName, setExportFolderName] = useState(() => buildExifExportFolderName());
  const [overwriteMode, setOverwriteMode] = useState('rename');
  const plannedExifOutputDir = exifParentDir ? buildExifOutputDirectory(exifParentDir, exportFolderName) : '';

  async function chooseExifParentDir() {
    const outputDir = await window.noExif.chooseExifOutputDirectory();
    if (outputDir) {
      setExifParentDir(outputDir);
      showToast({ type: 'info', title: '저장 위치를 선택했습니다.', detail: outputDir });
    }
    return outputDir;
  }

  async function exportCleanImages() {
    if (!images.length) {
      showToast({ type: 'warning', title: '먼저 이미지를 추가하세요.' });
      return;
    }
    if (!exifTargetCount) {
      showToast({ type: 'warning', title: 'EXIF를 제거할 이미지를 체크하세요.' });
      return;
    }

    try {
      const parentDir = exifParentDir || await chooseExifParentDir();
      if (!parentDir) return;
      if (overwriteMode === 'confirm') {
        setConfirmDialog({
          title: '덮어쓰기 확인',
          message: '같은 이름의 결과 파일이 있으면 기존 결과물을 새 파일로 교체합니다. 원본 이미지는 변경하지 않습니다.',
          confirmLabel: '덮어쓰기',
          onConfirm: () => performCleanExport(parentDir, 'replace'),
        });
        return;
      }
      await performCleanExport(parentDir, 'rename');
    } catch (error) {
      showToast({ type: 'error', title: 'EXIF 제거 저장 실패', detail: error.message });
    }
  }

  async function performCleanExport(parentDir, conflictMode) {
    try {
      const outputDir = buildExifOutputDirectory(parentDir, exportFolderName);
      setBusy(true);
      const result = await window.noExif.removeExifBatch({
        imagePaths: images.map(image => image.path),
        flags: images.map(image => image.removeExif !== false),
        outputDir,
        conflictMode,
      });
      const failed = result.failures?.length || 0;
      showToast({
        type: failed ? 'warning' : 'success',
        title: 'EXIF 제거 저장 완료',
        detail: `${result.processed}장 저장됨${failed ? ` · 실패 ${failed}장` : ''}`,
        actionLabel: '폴더 열기',
        onAction: () => window.noExif.openPath(result.outputDir || outputDir),
      });
      setExportFolderName(buildExifExportFolderName());
    } catch (error) {
      showToast({ type: 'error', title: 'EXIF 제거 저장 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  return {
    exifParentDir,
    exportFolderName,
    overwriteMode,
    plannedExifOutputDir,
    setOverwriteMode,
    chooseExifParentDir,
    exportCleanImages,
  };
}
