import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROMPT_CARD_TEMPLATES,
  buildPromptMetaFields,
  buildPromptSectionLayout,
  getPromptTemplateDesign,
  measurePromptColumnPlan,
  promptTextForMode,
  resolvePromptCardSettings,
  resolvePromptCardSize,
  shouldRenderNegativePrompt,
} from './promptCardRenderer.js';

const sampleCard = {
  positivePrompt: 'masterpiece, cinematic portrait, detailed fabric, warm backlight, editorial framing',
  negativePrompt: 'low quality, blurry, watermark',
  model: 'qa_realisticVision.safetensors',
  loras: [
    { name: 'detailer_v2', strength: '0.75' },
    { name: 'cinematic_light', strength: '0.35' },
  ],
  recipe: {
    seed: '2147483647',
    sampler: 'DPM++ 2M Karras',
    steps: 28,
    cfg: 7.5,
    scheduler: 'karras',
  },
};

test('prompt templates use the dedicated mockup-oriented ids', () => {
  assert.deepEqual(
    PROMPT_CARD_TEMPLATES.map(template => template.id),
    ['magazine', 'zine', 'recipe', 'minimal'],
  );
});

test('template design tokens expose the important mockup measurements', () => {
  const magazine = getPromptTemplateDesign('magazine');
  const zine = getPromptTemplateDesign('zine');

  assert.equal(magazine.defaultRatio, '4:5');
  assert.equal(magazine.title.anchor, 'bottom-left');
  assert.equal(magazine.qr.anchor, 'top-right');
  assert.equal(magazine.prompt.columns, 2);
  assert.equal(zine.defaultRatio, '9:16');
  assert.equal(zine.title.text, 'PROMPT ZINE');
  assert.ok(zine.prompt.sections >= 4);
});

test('prompt card ratios keep production export dimensions', () => {
  assert.deepEqual(resolvePromptCardSize({ ratio: '4:5' }), { width: 1080, height: 1350 });
  assert.deepEqual(resolvePromptCardSize({ ratio: '9:16' }), { width: 1080, height: 1920 });
  assert.deepEqual(resolvePromptCardSize({ ratio: 'custom', width: 5000, height: 200 }), { width: 3200, height: 640 });
});

test('full prompt mode preserves prompt and generation recipe text', () => {
  const full = promptTextForMode(sampleCard, 'full');
  assert.match(full, /masterpiece/);
  assert.match(full, /Negative: low quality/);
  assert.match(full, /Model: qa_realisticVision\.safetensors/);
  assert.match(full, /LoRA: detailer_v2 \(0\.75\), cinematic_light \(0\.35\)/);
});

test('metadata fields include active lora and recipe values for card chips', () => {
  const fields = buildPromptMetaFields(sampleCard);
  assert.deepEqual(fields.map(field => field.label), ['MODEL', 'LORA', 'SEED', 'STEPS', 'CFG', 'SAMPLER']);
  assert.match(fields.find(field => field.label === 'LORA')?.value || '', /detailer_v2/);
  assert.equal(fields.find(field => field.label === 'CFG')?.value, '7.5');
});

test('long prompt layout plan increases columns before cutting text', () => {
  const longPrompt = Array.from({ length: 80 }, (_, index) => `visual detail ${index}`).join(', ');
  const plan = measurePromptColumnPlan(longPrompt, {
    width: 760,
    height: 230,
    columns: 2,
    fontSize: 24,
    minFontSize: 10,
    lineHeight: 1.22,
  });

  assert.equal(plan.columns, 2);
  assert.ok(plan.fontSize <= 24);
  assert.ok(plan.lineCount > 0);
  assert.equal(plan.truncated, false);
});

test('prompt cards hide negative prompt by default to give positive prompt more room', () => {
  assert.equal(shouldRenderNegativePrompt({ promptMode: 'positive' }), false);
  assert.equal(shouldRenderNegativePrompt({ promptMode: 'full' }), false);
  assert.equal(shouldRenderNegativePrompt({ promptMode: 'positive-negative' }), true);

  const magazine = buildPromptSectionLayout('magazine', { promptMode: 'positive' });
  assert.equal(magazine.negative.visible, false);
  assert.equal(magazine.positive.widthShare, 1);
  assert.ok(magazine.positive.fontSize >= 24);
});

test('metadata chip layout favors larger centered values over a dense one-line strip', () => {
  const magazine = getPromptTemplateDesign('magazine');
  assert.equal(magazine.meta.columns, 3);
  assert.equal(magazine.meta.align, 'center');
  assert.ok(magazine.meta.height > 0.09);
});

test('QR is hidden by default but can be enabled explicitly', () => {
  assert.equal(resolvePromptCardSettings({}).showQr, false);
  assert.equal(resolvePromptCardSettings({ showQr: true }).showQr, true);
});
