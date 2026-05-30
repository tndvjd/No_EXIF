import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChildPath,
  buildExifExportFolderName,
  buildExifOutputDirectory,
  buildPromptCardFileName,
  extractComfyPromptCard,
  extractComfySummary,
  formatBytes,
  metadataChip,
  metadataStatusBadges,
  parseDroppedPathText,
  runToastAction,
} from './appUtils.js';

test('buildExifExportFolderName uses the required timestamp format', () => {
  const date = new Date(2026, 4, 18, 1, 24, 59);
  assert.equal(buildExifExportFolderName(date), 'No_EXIF_Export_2026-05-18_0124');
});

test('buildExifOutputDirectory nests export folder under selected parent', () => {
  const date = new Date(2026, 4, 18, 7, 3, 0);
  assert.equal(
    buildExifOutputDirectory('C:\\Users\\cdg\\Pictures', date),
    'C:\\Users\\cdg\\Pictures\\No_EXIF_Export_2026-05-18_0703',
  );
  assert.equal(
    buildExifOutputDirectory('C:\\Users\\cdg\\Pictures', 'No_EXIF_Export_2026-05-18_0710'),
    'C:\\Users\\cdg\\Pictures\\No_EXIF_Export_2026-05-18_0710',
  );
  assert.equal(buildChildPath('C:/tmp', 'child'), 'C:/tmp/child');
});

test('buildPromptCardFileName creates a timestamped PNG filename from source image name', () => {
  const date = new Date(2026, 4, 19, 8, 7, 22);
  assert.equal(
    buildPromptCardFileName('26-05-17_00181_.png', date),
    'PROMPT_CARD_26-05-17_00181__2026-05-19_0807.png',
  );
});

test('formatBytes produces compact Korean UI friendly values', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(2_621_440), '2.5 MB');
});

test('metadataChip prioritizes ComfyUI workflow over generic EXIF', () => {
  assert.deepEqual(
    metadataChip({
      hasExif: true,
      metadata: { comfyui: { present: true, workflow: '{"nodes":[]}' } },
    }),
    { label: 'workflow', tone: 'workflow' },
  );
  assert.deepEqual(
    metadataChip({
      hasExif: true,
      metadata: { comfyui: { present: true, prompt: '{"1":{}}' } },
    }),
    { label: 'prompt', tone: 'ok' },
  );
  assert.deepEqual(metadataChip({ hasExif: true, metadata: {} }), { label: 'EXIF', tone: 'warn' });
  assert.deepEqual(metadataChip({ hasExif: false, metadata: {} }), { label: '정리됨', tone: 'ok' });
});

test('metadataStatusBadges describes ComfyUI generation metadata instead of camera EXIF absence', () => {
  const badges = metadataStatusBadges(
    {
      metadata: {
        privacy: { hasExif: false, hasGps: false },
        pngText: { count: 2 },
        comfyui: { present: true },
      },
    },
    {
      generationPresent: true,
      workflowPresent: true,
      promptPresent: true,
      model: 'anima_baseV10.safetensors',
      loras: [{ name: 'line_style' }, { name: 'soft_light' }],
    },
  );

  assert.deepEqual(
    badges.map(badge => badge.label),
    ['생성 메타데이터 있음', 'Workflow 감지', '모델 감지', 'LoRA 2개', 'PNG 태그 2개'],
  );
  assert.equal(badges.some(badge => /EXIF|GPS/.test(badge.label)), false);
});

test('extractComfySummary reads common ComfyUI node fields', () => {
  const metadata = {
    comfyui: {
      present: true,
      prompt: JSON.stringify({
        1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'realisticVision.safetensors' } },
        2: { class_type: 'KSampler', inputs: { sampler_name: 'dpmpp_2m', scheduler: 'karras', seed: 123, steps: 30, cfg: 7, denoise: 0.6 } },
        3: { class_type: 'CLIPTextEncode', inputs: { text: 'positive mountain prompt' } },
        4: { class_type: 'CLIPTextEncode', inputs: { text: 'negative blur' } },
      }),
    },
  };
  const summary = extractComfySummary(metadata);
  assert.equal(summary.positivePrompt, 'positive mountain prompt');
  assert.equal(summary.negativePrompt, 'negative blur');
  assert.equal(summary.model, 'realisticVision.safetensors');
  assert.equal(summary.sampler, 'dpmpp_2m');
  assert.equal(summary.scheduler, 'karras');
  assert.equal(summary.seed, 123);
  assert.equal(summary.steps, 30);
  assert.equal(summary.cfg, 7);
  assert.equal(summary.denoise, 0.6);
  assert.equal(summary.workflowPresent, false);
});

test('extractComfySummary only marks workflow present when workflow JSON exists', () => {
  assert.equal(
    extractComfySummary({
      comfyui: {
        present: true,
        prompt: JSON.stringify({
          1: { class_type: 'CLIPTextEncode', inputs: { text: 'prompt only' } },
        }),
      },
    }).workflowPresent,
    false,
  );

  assert.equal(
    extractComfySummary({
      comfyui: {
        present: true,
        workflow: JSON.stringify({ nodes: [{ id: 1, type: 'KSampler' }] }),
      },
    }).workflowPresent,
    true,
  );
});

test('extractComfySummary resolves referenced ComfyUI prompt nodes and model stack', () => {
  const metadata = {
    pngText: { count: 2 },
    comfyui: {
      present: true,
      prompt: JSON.stringify({
        '3': { class_type: 'CLIPTextEncode', inputs: { text: ['301', 0] }, _meta: { title: 'Positive Prompt' } },
        '5': { class_type: 'CLIPTextEncode', inputs: { text: 'low quality, watermark' }, _meta: { title: 'Negative Prompt' } },
        '295': {
          class_type: 'Lora Loader (LoraManager)',
          inputs: {
            text: '<lora:line_style:0.85> <lora:soft_light:0.25>',
            model: ['296:290', 0],
            clip: ['296:291', 0],
            loras: {
              __value__: [
                { name: 'line_style', strength: '0.85' },
                { name: 'soft_light', strength: '0.25' },
              ],
            },
          },
        },
        '296:290': { class_type: 'UNETLoader', inputs: { unet_name: 'anima_baseV10.safetensors' } },
        '296:291': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_06b_base.safetensors' } },
        '296:292': { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_vae.safetensors' } },
        '297:293': { class_type: 'PatchAttention', inputs: { model: ['295', 0] } },
        '297:294': { class_type: 'EasyCache', inputs: { model: ['297:293', 0] } },
        '301': { class_type: 'easy showAnything', inputs: { text: 'masterpiece, 1girl, poolside night' } },
        '7': {
          class_type: 'KSampler',
          inputs: {
            seed: 7801,
            steps: 30,
            cfg: 5,
            sampler_name: 'er_sde',
            scheduler: 'simple',
            denoise: 1,
            model: ['297:294', 0],
            positive: ['3', 0],
            negative: ['5', 0],
          },
        },
        '326:310': {
          class_type: 'KSampler',
          inputs: {
            seed: 4443,
            steps: 20,
            cfg: 5,
            sampler_name: 'er_sde',
            scheduler: 'simple',
            denoise: 0.73,
            model: ['297:294', 0],
            positive: ['3', 0],
            negative: ['5', 0],
          },
        },
      }),
      workflow: JSON.stringify({ nodes: [] }),
    },
  };

  const summary = extractComfySummary(metadata);

  assert.equal(summary.positivePrompt, 'masterpiece, 1girl, poolside night');
  assert.equal(summary.negativePrompt, 'low quality, watermark');
  assert.equal(summary.model, 'anima_baseV10.safetensors');
  assert.equal(summary.clip, 'qwen_3_06b_base.safetensors');
  assert.equal(summary.vae, 'qwen_image_vae.safetensors');
  assert.equal(summary.seed, 4443);
  assert.equal(summary.steps, 20);
  assert.equal(summary.baseSeed, 7801);
  assert.equal(summary.baseSteps, 30);
  assert.deepEqual(summary.loras.map(lora => lora.name), ['line_style', 'soft_light']);
  assert.equal(summary.generationPresent, true);
});

test('extractComfySummary counts only active LoRA Manager entries', () => {
  const metadata = {
    comfyui: {
      present: true,
      prompt: JSON.stringify({
        '10': {
          class_type: 'Lora Loader (LoraManager)',
          inputs: {
            text: '<lora:off_a:0.8> <lora:on_b:0.7> <lora:off_zero:0>',
            loras: {
              __value__: [
                { name: 'off_a', strength: '0.8', active: false },
                { name: 'on_b', strength: '0.7', active: true, clipStrength: '0.6' },
                { name: 'off_zero', strength: '0', active: true, clipStrength: '0' },
              ],
            },
          },
        },
      }),
    },
  };

  const summary = extractComfySummary(metadata);

  assert.deepEqual(summary.loras, [{ name: 'on_b', strength: '0.7' }]);
});

test('extractComfyPromptCard exposes full prompt-card data without disabled LoRAs', () => {
  const prompt = {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'dream-model.safetensors' } },
    '2': {
      class_type: 'KSampler',
      inputs: {
        seed: 20260519,
        steps: 32,
        cfg: 6.5,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        positive: ['3', 0],
        negative: ['4', 0],
      },
    },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: 'full positive prompt, cinematic lighting, detailed background' } },
    '4': { class_type: 'CLIPTextEncode', inputs: { text: 'low quality, watermark' } },
    '5': {
      class_type: 'Lora Loader (LoraManager)',
      inputs: {
        loras: {
          __value__: [
            { name: 'active-style', strength: '0.75', active: true },
            { name: 'disabled-style', strength: '0.8', active: false },
          ],
        },
      },
    },
  };

  const card = extractComfyPromptCard({
    pngText: { count: 2 },
    comfyui: { present: true, prompt: JSON.stringify(prompt) },
  });

  assert.equal(card.present, true);
  assert.equal(card.source, 'prompt');
  assert.equal(card.positivePrompt, 'full positive prompt, cinematic lighting, detailed background');
  assert.equal(card.negativePrompt, 'low quality, watermark');
  assert.equal(card.model, 'dream-model.safetensors');
  assert.deepEqual(card.loras, [{ name: 'active-style', strength: '0.75' }]);
  assert.deepEqual(card.recipe, {
    seed: 20260519,
    sampler: 'dpmpp_2m',
    steps: 32,
    cfg: 6.5,
    scheduler: 'karras',
  });
});

test('extractComfySummary reads workflow-only ComfyUI nodes with links and widgets', () => {
  const metadata = {
    comfyui: {
      present: true,
      workflow: JSON.stringify({
        nodes: [
          {
            id: 3,
            type: 'CLIPTextEncode',
            inputs: [{ name: 'text', widget: { name: 'text' }, link: null }],
            outputs: [{ name: 'CONDITIONING', links: [31] }],
            widgets_values: ['workflow positive prompt'],
          },
          {
            id: 5,
            type: 'CLIPTextEncode',
            inputs: [{ name: 'text', widget: { name: 'text' }, link: null }],
            outputs: [{ name: 'CONDITIONING', links: [51] }],
            widgets_values: ['workflow negative prompt'],
          },
          {
            id: 7,
            type: 'KSampler',
            inputs: [
              { name: 'positive', link: 31 },
              { name: 'negative', link: 51 },
              { name: 'seed', widget: { name: 'seed' }, link: null },
              { name: 'steps', widget: { name: 'steps' }, link: null },
              { name: 'cfg', widget: { name: 'cfg' }, link: null },
              { name: 'sampler_name', widget: { name: 'sampler_name' }, link: null },
              { name: 'scheduler', widget: { name: 'scheduler' }, link: null },
              { name: 'denoise', widget: { name: 'denoise' }, link: null },
            ],
            widgets_values: [1234, 'fixed', 22, 6.5, 'euler', 'normal', 0.72],
          },
          {
            id: 9,
            type: 'Lora Loader (LoraManager)',
            inputs: [],
            widgets_values: [
              { version: 1 },
              '<lora:disabled:0.9> <lora:active:0.4>',
              [
                { name: 'disabled', strength: '0.9', active: false },
                { name: 'active', strength: '0.4', active: true },
              ],
            ],
          },
        ],
        links: [
          [31, 3, 0, 7, 0, 'CONDITIONING'],
          [51, 5, 0, 7, 1, 'CONDITIONING'],
        ],
      }),
    },
  };

  const summary = extractComfySummary(metadata);

  assert.equal(summary.positivePrompt, 'workflow positive prompt');
  assert.equal(summary.negativePrompt, 'workflow negative prompt');
  assert.equal(summary.seed, 1234);
  assert.equal(summary.steps, 22);
  assert.equal(summary.sampler, 'euler');
  assert.equal(summary.scheduler, 'normal');
  assert.equal(summary.denoise, 0.72);
  assert.deepEqual(summary.loras, [{ name: 'active', strength: '0.4' }]);
});

test('parseDroppedPathText reads plain and file URI paths', () => {
  assert.deepEqual(
    parseDroppedPathText('file:///C:/Users/cdg/Downloads/a%20b.png\r\nfile:///D:/work/c.png'),
    ['C:/Users/cdg/Downloads/a b.png', 'D:/work/c.png'],
  );
  assert.deepEqual(parseDroppedPathText('C:\\Users\\cdg\\Pictures\\one.png\n'), ['C:\\Users\\cdg\\Pictures\\one.png']);
});

test('runToastAction reports native action failures', async () => {
  await assert.rejects(
    runToastAction(() => ({ ok: false, error: 'folder is gone' })),
    /folder is gone/,
  );
});

test('runToastAction accepts successful or empty actions', async () => {
  assert.deepEqual(await runToastAction(() => ({ ok: true })), { ok: true });
  assert.deepEqual(await runToastAction(null), { ok: true });
});
