import { fileBaseName, runToastAction } from './appUtils.js';

export function useMetadataActions({
  selectedMetadataImage,
  selectedImage,
  showToast,
}) {
  async function copyText(label, text) {
    if (!text) {
      showToast({ type: 'warning', title: `${label} 내용이 없습니다.` });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast({ title: `${label}했습니다.` });
    } catch (error) {
      showToast({ type: 'error', title: `${label} 실패`, detail: error.message });
    }
  }

  async function saveSelectedMetadataJson() {
    const targetImage = selectedMetadataImage || selectedImage;
    if (!targetImage?.metadata) return;
    try {
      const savedPath = await window.noExif.saveMetadataJson({
        name: targetImage.name,
        metadata: targetImage.metadata,
      });
      if (savedPath) {
        showToast({
          title: '메타데이터 JSON 저장 완료',
          detail: fileBaseName(savedPath),
          actionLabel: '파일 보기',
          onAction: () => window.noExif.showItemInFolder(savedPath),
        });
      }
    } catch (error) {
      showToast({ type: 'error', title: 'JSON 저장 실패', detail: error.message });
    }
  }

  async function openSelectedImageLocation() {
    const targetImage = selectedMetadataImage || selectedImage;
    if (!targetImage?.path) {
      showToast({ type: 'warning', title: '선택한 이미지가 없습니다.' });
      return;
    }
    try {
      await runToastAction(() => window.noExif.showItemInFolder(targetImage.path));
      showToast({ title: '이미지 위치를 열었습니다.', detail: targetImage.name });
    } catch (error) {
      showToast({ type: 'error', title: '이미지 위치 열기 실패', detail: error.message });
    }
  }

  return {
    copyText,
    saveSelectedMetadataJson,
    openSelectedImageLocation,
  };
}
