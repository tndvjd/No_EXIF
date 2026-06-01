export const PROMPT_CARD_TEMPLATES = [
  {
    id: 'magazine',
    label: 'Magazine',
    description: '두 번째 목업 기준의 메인 공유 카드',
  },
  {
    id: 'zine',
    label: 'Zine',
    description: '첫 번째 목업의 Prompt Zine 감성을 담은 기술 포스터',
  },
  {
    id: 'recipe',
    label: 'Recipe',
    description: '프롬프트와 생성값을 레시피 시트처럼 정리',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: '사진을 크게 남기는 간결한 공유 카드',
  },
];

export const PROMPT_CARD_RATIOS = [
  { id: '1:1', label: '1:1', width: 1080, height: 1080 },
  { id: '4:5', label: '4:5', width: 1080, height: 1350 },
  { id: '9:16', label: '9:16', width: 1080, height: 1920 },
  { id: '16:9', label: '16:9', width: 1920, height: 1080 },
  { id: 'custom', label: 'Custom', width: 1400, height: 1800 },
];

export const PROMPT_CARD_DESIGN_TOKENS = {
  magazine: {
    id: 'magazine',
    defaultRatio: '4:5',
    surface: 'full-bleed-photo',
    title: { text: 'PROMPT SHARE', anchor: 'bottom-left', x: 0.055, y: 0.49, size: 0.118, leading: 0.78 },
    qr: { anchor: 'top-right', x: 0.84, y: 0.07, size: 0.135 },
    prompt: { x: 0.055, y: 0.68, width: 0.89, height: 0.165, columns: 2, gap: 0.035 },
    meta: { x: 0.055, y: 0.86, width: 0.89, height: 0.105, columns: 3, align: 'center' },
    border: { inset: 0.028, guide: true },
  },
  zine: {
    id: 'zine',
    defaultRatio: '9:16',
    surface: 'technical-zine',
    title: { text: 'PROMPT ZINE', anchor: 'top-left', x: 0.075, y: 0.075, size: 0.112, leading: 0.82 },
    qr: { anchor: 'left-column', x: 0.075, y: 0.44, size: 0.115 },
    prompt: { x: 0.045, y: 0.60, width: 0.91, height: 0.31, columns: 2, sections: 4 },
    meta: { x: 0.045, y: 0.84, width: 0.91, height: 0.075, columns: 3 },
    border: { inset: 0.035, guide: true },
  },
  recipe: {
    id: 'recipe',
    defaultRatio: '4:5',
    surface: 'recipe-sheet',
    title: { text: 'RECIPE SHEET', anchor: 'top-left', x: 0.06, y: 0.06, size: 0.086, leading: 0.9 },
    qr: { anchor: 'top-right', x: 0.82, y: 0.055, size: 0.125 },
    prompt: { x: 0.06, y: 0.57, width: 0.88, height: 0.24, columns: 2, sections: 4 },
    meta: { x: 0.06, y: 0.835, width: 0.88, height: 0.085, columns: 3 },
    border: { inset: 0.04, guide: true },
  },
  minimal: {
    id: 'minimal',
    defaultRatio: '4:5',
    surface: 'quiet-card',
    title: { text: 'PROMPT', anchor: 'bottom-left', x: 0.06, y: 0.61, size: 0.092, leading: 0.84 },
    qr: { anchor: 'top-right', x: 0.83, y: 0.07, size: 0.12 },
    prompt: { x: 0.06, y: 0.72, width: 0.88, height: 0.17, columns: 1, gap: 0.03 },
    meta: { x: 0.06, y: 0.91, width: 0.88, height: 0.045, columns: 4 },
    border: { inset: 0.035, guide: false },
  },
};

const TEMPLATE_ALIASES = {
  editorial: 'magazine',
  fashion: 'zine',
  technical: 'recipe',
  manuscript: 'minimal',
};

export function getPromptTemplateDesign(templateId = 'magazine') {
  const id = resolveTemplateId(templateId);
  return PROMPT_CARD_DESIGN_TOKENS[id] || PROMPT_CARD_DESIGN_TOKENS.magazine;
}

export function resolvePromptCardSize(settings = {}) {
  const preset = PROMPT_CARD_RATIOS.find(item => item.id === settings.ratio) || PROMPT_CARD_RATIOS[1];
  const width = settings.ratio === 'custom'
    ? clampNumber(settings.width, 640, 3200, preset.width)
    : preset.width;
  const height = settings.ratio === 'custom'
    ? clampNumber(settings.height, 640, 4000, preset.height)
    : preset.height;
  return { width, height };
}

export function promptTextForMode(card = {}, mode = 'full') {
  const positive = card.positivePrompt || '';
  const negative = card.negativePrompt || '';
  if (mode === 'positive') return positive;
  if (mode === 'positive-negative') {
    return [positive, negative ? `Negative: ${negative}` : ''].filter(Boolean).join('\n\n');
  }
  return [
    positive,
    negative ? `Negative: ${negative}` : '',
    card.model ? `Model: ${card.model}` : '',
    card.loras?.length ? `LoRA: ${card.loras.map(formatLora).join(', ')}` : '',
  ].filter(Boolean).join('\n\n');
}

export function buildPromptMetaFields(card = {}, settings = {}) {
  const recipe = card.recipe || {};
  const allFields = [
    ['MODEL', card.model || '-'],
    ['LORA', card.loras?.length ? card.loras.map(formatLora).join(', ') : 'none'],
    ['SEED', recipe.seed || '-'],
    ['STEPS', recipe.steps || '-'],
    ['CFG', recipe.cfg || '-'],
    ['SAMPLER', recipe.sampler || recipe.scheduler || '-'],
  ];
  const flags = {
    MODEL: settings.showModel !== false,
    LORA: settings.showLora !== false,
    SEED: settings.showSeed !== false,
    STEPS: settings.showSteps !== false,
    CFG: settings.showCfg !== false,
    SAMPLER: settings.showSampler !== false,
  };
  return allFields
    .filter(([label]) => flags[label])
    .map(([label, value]) => ({ label, value: String(value || '-') }));
}

export function shouldRenderNegativePrompt(settings = {}) {
  return settings.showNegativePrompt === true || settings.promptMode === 'positive-negative';
}

export function buildPromptSectionLayout(templateId = 'magazine', settings = {}) {
  const template = getPromptTemplateDesign(templateId);
  const showNegative = shouldRenderNegativePrompt(settings);
  const baseFontSize = templateId === 'zine' ? 20 : templateId === 'magazine' ? 26 : 22;
  return {
    positive: {
      visible: true,
      widthShare: showNegative ? 0.5 : 1,
      fontSize: showNegative ? Math.max(18, baseFontSize - 4) : baseFontSize,
      columns: showNegative ? 1 : Math.max(1, Number(settings.columns) || template.prompt.columns || 2),
    },
    negative: {
      visible: showNegative,
      widthShare: showNegative ? 0.5 : 0,
      fontSize: Math.max(14, baseFontSize - 6),
    },
  };
}

export function measurePromptColumnPlan(text, options = {}) {
  const columns = Math.max(1, Number(options.columns) || 1);
  const gap = Math.max(18, Number(options.gap) || Number(options.width || 0) * 0.035);
  const columnWidth = Math.max(1, (Number(options.width || 0) - gap * (columns - 1)) / columns);
  const minFontSize = Number(options.minFontSize) || 9;
  let fontSize = Number(options.fontSize) || 20;
  let lines = [];
  let capacity = 0;

  while (fontSize >= minFontSize) {
    const charsPerLine = Math.max(7, Math.floor(columnWidth / (fontSize * 0.56)));
    lines = wrapByChars(text, charsPerLine);
    const lineHeight = fontSize * (Number(options.lineHeight) || 1.24);
    capacity = Math.max(1, Math.floor(Number(options.height || 0) / lineHeight) * columns);
    if (lines.length <= capacity || fontSize === minFontSize) break;
    fontSize -= 1;
  }

  return {
    columns,
    fontSize,
    lineCount: lines.length,
    capacity,
    overflow: lines.length > capacity,
    truncated: false,
  };
}

export function resolvePromptCardSettings(settings = {}) {
  return normalizeSettings(settings);
}

export function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function formatLora(lora) {
  if (!lora?.name) return '';
  return `${lora.name}${lora.strength ? ` (${lora.strength})` : ''}`;
}

function wrapByChars(text, charsPerLine) {
  const lines = [];
  const paragraphs = String(text || '').split(/\n+/);
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (testLine.length <= charsPerLine || !line) {
        line = testLine;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    lines.push('');
  }
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function normalizeSettings(settings = {}) {
  return {
    template: resolveTemplateId(settings.template),
    ratio: settings.ratio || '4:5',
    width: settings.width,
    height: settings.height,
    title: settings.title || 'PROMPT SHARE',
    brand: settings.brand || 'No EXIF Pro',
    handle: settings.handle || '@NoEXIFPro',
    promptMode: settings.promptMode || 'positive',
    readability: settings.readability || 'gradient',
    darken: clampNumber(settings.darken, 0, 72, 34),
    textScale: clampNumber(settings.textScale, 70, 130, 100),
    lineHeight: Number(settings.lineHeight) || 1.22,
    columns: clampNumber(settings.columns, 1, 3, 2),
    showModel: settings.showModel !== false,
    showLora: settings.showLora !== false,
    showSeed: settings.showSeed !== false,
    showSteps: settings.showSteps !== false,
    showCfg: settings.showCfg !== false,
    showSampler: settings.showSampler !== false,
    showQr: settings.showQr === true,
  };
}

function resolveTemplateId(templateId = 'magazine') {
  const id = TEMPLATE_ALIASES[templateId] || templateId || 'magazine';
  return PROMPT_CARD_DESIGN_TOKENS[id] ? id : 'magazine';
}
