export function buildTopBarStatus({
  modeId = 'exif',
  imageCount = 0,
  exifTargetCount = 0,
  promptCount = 0,
  pixivCount = 0,
  busy = false,
} = {}) {
  const countLabel = modeId === 'exif'
    ? `${exifTargetCount}장 선택`
    : modeId === 'prompt-share'
      ? `${promptCount}개 프롬프트`
      : modeId === 'pixiv'
        ? `${pixivCount}장 후보`
        : `${imageCount}장 불러옴`;

  return {
    countLabel,
    commandHint: 'Ctrl K',
    busyLabel: busy ? '처리 중' : '',
  };
}
