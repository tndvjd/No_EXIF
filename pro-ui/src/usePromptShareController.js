import { useState } from 'react';

import { initialPromptSettings } from './appConstants.js';
import {
  buildPromptCardFileName,
  extractComfyPromptCard,
} from './appUtils.js';
import { canvasToPngBytes } from './canvasUtils.js';

export function usePromptShareController({
  images,
  selectedImage,
  selectedMetadataImage,
  selectedPromptImage,
  setBusy,
  setImages,
  setSelectedImageIndex,
  recordHistory,
  changeMode,
  showToast,
  copyText,
}) {
  const [promptSettings, setPromptSettings] = useState(initialPromptSettings);

  function updatePromptSetting(key, value) {
    setPromptSettings(current => ({ ...current, [key]: value }));
  }

  async function exportPromptCard() {
    const targetImage = selectedPromptImage || selectedImage;
    const card = extractComfyPromptCard(targetImage?.metadata || {});
    if (!targetImage) {
      showToast({ type: 'warning', title: '먼저 이미지를 추가하세요.' });
      return;
    }
    if (!card.present && !card.positivePrompt && !card.negativePrompt) {
      showToast({ type: 'warning', title: '공유할 ComfyUI 프롬프트가 없습니다.' });
      return;
    }

    setBusy(true);
    try {
      const { drawPromptCard } = await import('./promptCardRenderer.js');
      const canvas = document.createElement('canvas');
      const size = await drawPromptCard(canvas, {
        image: targetImage,
        imageSource: targetImage.preview || targetImage.thumb,
        card,
        settings: promptSettings,
      });
      const pngBytes = await canvasToPngBytes(canvas);
      const result = await window.noExif.savePromptCardPng({
        pngBytes,
        defaultName: buildPromptCardFileName(targetImage.name),
      });
      if (!result) return;
      showToast({
        title: '프롬프트 카드 저장 완료',
        detail: `${size.width} x ${size.height} PNG`,
        actionLabel: '파일 보기',
        onAction: () => window.noExif.showItemInFolder(result.outputPath),
      });
    } catch (error) {
      showToast({ type: 'error', title: '프롬프트 카드 저장 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function copyPromptSharePrompt() {
    const { promptTextForMode } = await import('./promptCardRenderer.js');
    await copyText(
      '프롬프트 복사',
      promptTextForMode(extractComfyPromptCard(selectedPromptImage?.metadata), promptSettings.promptMode),
    );
  }

  function sendSelectedImageToExif() {
    const targetImage = selectedMetadataImage || selectedImage;
    if (!targetImage) {
      showToast({ type: 'warning', title: '보낼 이미지가 없습니다.' });
      return;
    }
    const targetIndex = images.findIndex(image => image.path === targetImage.path);
    recordHistory();
    setImages(current => current.map((image, index) => (
      index === targetIndex ? { ...image, removeExif: true } : image
    )));
    changeMode('exif');
    showToast({ title: 'EXIF 제거 작업으로 보냈습니다.', detail: targetImage.name });
  }

  function sendSelectedImageToPromptShare() {
    const targetImage = selectedMetadataImage || selectedImage;
    if (!targetImage) {
      showToast({ type: 'warning', title: '보낼 이미지가 없습니다.' });
      return;
    }
    const targetIndex = images.findIndex(image => image.path === targetImage.path);
    if (targetIndex >= 0) setSelectedImageIndex(targetIndex);
    changeMode('prompt-share');
    showToast({ title: '프롬프트 공유 작업으로 보냈습니다.', detail: targetImage.name });
  }

  return {
    promptSettings,
    updatePromptSetting,
    exportPromptCard,
    copyPromptSharePrompt,
    sendSelectedImageToExif,
    sendSelectedImageToPromptShare,
  };
}
