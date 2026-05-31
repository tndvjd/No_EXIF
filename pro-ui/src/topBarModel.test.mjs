import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTopBarStatus } from './topBarModel.js';

test('buildTopBarStatus keeps mode counts compact without local-processing copy', () => {
  assert.deepEqual(
    buildTopBarStatus({
      modeId: 'exif',
      imageCount: 8,
      exifTargetCount: 5,
      promptCount: 2,
      pixivCount: 3,
      busy: false,
    }),
    {
      countLabel: '5장 선택',
      commandHint: 'Ctrl K',
      busyLabel: '',
    },
  );

  assert.equal(buildTopBarStatus({ modeId: 'prompt-share', promptCount: 2 }).countLabel, '2개 프롬프트');
  assert.equal(buildTopBarStatus({ modeId: 'pixiv', pixivCount: 7 }).countLabel, '7장 후보');
  assert.equal(buildTopBarStatus({ modeId: 'grid', imageCount: 4 }).countLabel, '4장 불러옴');
});

test('buildTopBarStatus exposes a busy label only while work is running', () => {
  assert.equal(buildTopBarStatus({ modeId: 'exif', busy: true }).busyLabel, '처리 중');
  assert.equal(buildTopBarStatus({ modeId: 'exif', busy: false }).busyLabel, '');
});
