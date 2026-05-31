import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMMAND_PALETTE_ACTIONS,
  buildCommandPaletteModel,
  filterCommandPaletteActions,
  recommendCommandPaletteActions,
} from './commandPaletteModel.js';

test('command palette includes the product core actions', () => {
  assert.deepEqual(
    COMMAND_PALETTE_ACTIONS.map(action => action.title),
    [
      '이미지 추가',
      'EXIF 제거',
      '그리드 내보내기',
      '메타데이터 확인',
      '프롬프트 카드 만들기',
      'Pixiv 가져오기',
    ],
  );
});

test('filterCommandPaletteActions searches title, helper, and scope while preserving disabled state', () => {
  const context = {
    activeMode: 'grid',
    images: [{ id: 'a' }, { id: 'b' }],
    promptCount: 1,
    pixivCount: 0,
    busy: false,
  };

  assert.deepEqual(
    filterCommandPaletteActions({ query: 'canvas', context }).map(action => action.id),
    ['export-grid'],
  );
  assert.deepEqual(
    filterCommandPaletteActions({ query: 'privacy', context }).map(action => action.id),
    ['remove-exif'],
  );

  const disabled = filterCommandPaletteActions({
    query: 'metadata',
    context: { ...context, images: [] },
  })[0];
  assert.equal(disabled.id, 'inspect-metadata');
  assert.equal(disabled.disabled, true);
  assert.equal(disabled.disabledReason, '이미지를 먼저 추가하세요.');
  assert.equal(Object.hasOwn(disabled, 'shortcut'), false);
  assert.equal(Object.hasOwn(disabled, 'onClick'), false);
});

test('recommendCommandPaletteActions uses app context to put the next useful actions first', () => {
  assert.deepEqual(
    recommendCommandPaletteActions({
      activeMode: 'exif',
      images: [],
      promptCount: 0,
      pixivCount: 0,
      busy: false,
    }).map(action => action.id),
    ['add-images', 'import-pixiv', 'inspect-metadata'],
  );

  assert.deepEqual(
    recommendCommandPaletteActions({
      activeMode: 'prompt-share',
      images: [{ id: 'a' }],
      promptCount: 2,
      pixivCount: 0,
      busy: false,
    }).map(action => action.id),
    ['create-prompt-card', 'inspect-metadata', 'remove-exif'],
  );

  assert.equal(
    recommendCommandPaletteActions({
      activeMode: 'pixiv',
      images: [{ id: 'a' }],
      promptCount: 0,
      pixivCount: 4,
      busy: true,
    })[0].disabled,
    true,
  );
});

test('buildCommandPaletteModel combines filtered results and recommendations without UI state', () => {
  const model = buildCommandPaletteModel({
    query: 'exif',
    context: {
      activeMode: 'metadata',
      images: [{ id: 'a' }],
      promptCount: 0,
      pixivCount: 0,
      busy: false,
    },
  });

  assert.deepEqual(model.results.map(action => action.id), ['remove-exif']);
  assert.equal(model.recommended[0].id, 'inspect-metadata');
  assert.equal(Object.hasOwn(model.results[0], 'onClick'), false);
});
