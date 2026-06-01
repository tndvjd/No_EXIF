import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filmstripPageStep,
  filmstripWheelDelta,
  nextImageIndex,
  PREVIEW_WHEEL_COOLDOWN_MS,
  previewWheelDirection,
} from './exifFilmstripModel.js';

test('filmstripWheelDelta maps normal vertical mouse wheel movement to horizontal scroll', () => {
  assert.equal(filmstripWheelDelta({ deltaX: 0, deltaY: 120 }), 120);
  assert.equal(filmstripWheelDelta({ deltaX: 0, deltaY: -90 }), -90);
});

test('filmstripWheelDelta preserves intentional horizontal trackpad movement', () => {
  assert.equal(filmstripWheelDelta({ deltaX: 44, deltaY: 8 }), 44);
  assert.equal(filmstripWheelDelta({ deltaX: -52, deltaY: 6 }), -52);
});

test('filmstripPageStep advances by a useful viewport-sized distance', () => {
  assert.equal(filmstripPageStep(900), 630);
  assert.equal(filmstripPageStep(120), 180);
});

test('nextImageIndex moves the active preview within image bounds', () => {
  assert.equal(nextImageIndex(0, 12, 1), 1);
  assert.equal(nextImageIndex(4, 12, -1), 3);
  assert.equal(nextImageIndex(0, 12, -1), 0);
  assert.equal(nextImageIndex(11, 12, 1), 11);
  assert.equal(nextImageIndex(0, 0, 1), 0);
});

test('previewWheelDirection treats vertical preview wheel movement as image navigation', () => {
  assert.equal(previewWheelDirection({ deltaX: 0, deltaY: 120 }), 1);
  assert.equal(previewWheelDirection({ deltaX: 0, deltaY: -90 }), -1);
});

test('previewWheelDirection ignores tiny or mostly horizontal wheel movement', () => {
  assert.equal(previewWheelDirection({ deltaX: 0, deltaY: 8 }), 0);
  assert.equal(previewWheelDirection({ deltaX: 70, deltaY: 20 }), 0);
});

test('preview wheel cooldown stays responsive for quick image review', () => {
  assert.equal(PREVIEW_WHEEL_COOLDOWN_MS, 120);
});
