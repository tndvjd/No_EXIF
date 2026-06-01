export const PREVIEW_WHEEL_COOLDOWN_MS = 120;

export function filmstripWheelDelta({ deltaX = 0, deltaY = 0 } = {}) {
  return Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
}

export function filmstripPageStep(clientWidth = 0) {
  return Math.max(180, Math.round(clientWidth * 0.7));
}

export function nextImageIndex(currentIndex = 0, imageCount = 0, direction = 0) {
  if (imageCount <= 0) return 0;
  const next = currentIndex + direction;
  return Math.min(imageCount - 1, Math.max(0, next));
}

export function previewWheelDirection({ deltaX = 0, deltaY = 0 } = {}, threshold = 20) {
  if (Math.abs(deltaY) < threshold) return 0;
  if (Math.abs(deltaX) > Math.abs(deltaY)) return 0;
  return deltaY > 0 ? 1 : -1;
}
