import {
  buildPromptMetaFields,
  buildPromptSectionLayout,
  clampNumber,
  formatLora,
  getPromptTemplateDesign,
  promptTextForMode,
  resolvePromptCardSettings,
  resolvePromptCardSize,
} from './promptCardModel.js';

export {
  PROMPT_CARD_DESIGN_TOKENS,
  PROMPT_CARD_RATIOS,
  PROMPT_CARD_TEMPLATES,
  buildPromptMetaFields,
  buildPromptSectionLayout,
  getPromptTemplateDesign,
  measurePromptColumnPlan,
  promptTextForMode,
  resolvePromptCardSettings,
  resolvePromptCardSize,
  shouldRenderNegativePrompt,
} from './promptCardModel.js';

const DISPLAY_FONT = '"Bahnschrift Condensed", "Arial Narrow", Impact, "Malgun Gothic", sans-serif';
const UI_FONT = '"Segoe UI Variable", "Segoe UI", "Malgun Gothic", sans-serif';
const MONO_FONT = '"Cascadia Mono", "IBM Plex Mono", Consolas, "Malgun Gothic", monospace';

const GOLD = '#f0b846';
const GOLD_SOFT = '#ffd36d';
const PAPER = '#f3efe6';
const INK = '#0b0e0f';
const PANEL = 'rgba(8, 11, 11, 0.78)';

export async function drawPromptCard(canvas, payload = {}) {
  const settings = resolvePromptCardSettings(payload.settings);
  const { width, height } = resolvePromptCardSize(settings);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const image = payload.imageSource ? await loadCanvasImage(payload.imageSource) : null;
  const nextPayload = { ...payload, settings, card: payload.card || {} };

  if (settings.template === 'zine') {
    drawZineCard(ctx, image, nextPayload, width, height);
  } else if (settings.template === 'recipe') {
    drawRecipeCard(ctx, image, nextPayload, width, height);
  } else if (settings.template === 'minimal') {
    drawMinimalCard(ctx, image, nextPayload, width, height);
  } else {
    drawMagazineCard(ctx, image, nextPayload, width, height);
  }

  return { width, height };
}

function drawMagazineCard(ctx, image, payload, width, height) {
  const { settings, card } = payload;
  const tokens = getPromptTemplateDesign('magazine');
  drawPhotoBase(ctx, image, width, height, '#090d0d');
  drawBottomGradient(ctx, width, height, settings, 0.34, 0.94);
  drawVignette(ctx, width, height, 0.28);
  drawGuideFrame(ctx, tokens, width, height);

  const pad = Math.round(width * tokens.title.x);
  const topY = Math.round(height * 0.055);
  drawSmallCaps(ctx, settings.handle || '@NoEXIFPro', pad, topY, Math.round(width * 0.28), 22, '#ffffff');
  drawTinyText(ctx, formatDateStamp(), pad, topY + 34, width * 0.25, '#fff');

  const qrSize = Math.round(width * tokens.qr.size);
  const qrX = width - pad - qrSize;
  const qrY = Math.round(height * tokens.qr.y);
  drawBrandLockup(ctx, settings.brand || 'No EXIF Pro', 'PROMPT CARD STUDIO', qrX - Math.round(width * 0.04), qrY, qrSize);
  if (settings.showQr !== false) drawQrMark(ctx, qrX, qrY + 58, qrSize);

  const titleY = Math.round(height * tokens.title.y);
  drawStackedTitle(ctx, settings.title || tokens.title.text, pad, titleY, width * 0.55, {
    size: Math.round(width * tokens.title.size),
    leading: tokens.title.leading,
    family: DISPLAY_FONT,
    color: '#ffffff',
    shadow: true,
  });
  drawSmallCaps(ctx, 'AI ART  ·  COMFYUI  ·  PROMPT CARD', pad + 4, titleY + Math.round(width * 0.19), width * 0.62, 20, GOLD);

  const promptRect = rectFromToken(tokens.prompt, width, height);
  drawMagazinePromptSections(ctx, card, settings, promptRect);
  drawMetaChips(ctx, buildPromptMetaFields(card, settings), rectFromToken(tokens.meta, width, height), { compact: true });
  drawFooterStamp(ctx, settings, width, height);
}

function drawZineCard(ctx, image, payload, width, height) {
  const { settings, card } = payload;
  const tokens = getPromptTemplateDesign('zine');
  drawPhotoBase(ctx, image, width, height, '#0b100f');
  drawSolidOverlay(ctx, width, height, 0.38 + clampNumber(settings.darken, 0, 72, 24) / 300);
  drawBottomGradient(ctx, width, height, settings, 0.42, 0.92);
  drawZineGrid(ctx, width, height);
  drawGuideFrame(ctx, tokens, width, height);

  const pad = Math.round(width * tokens.title.x);
  drawSmallCaps(ctx, '#COMFYUI //', pad, Math.round(height * 0.055), width * 0.32, 22, PAPER);
  drawStackedTitle(ctx, titleForTemplate(settings, tokens), pad, Math.round(height * tokens.title.y), width * 0.42, {
    size: Math.round(width * tokens.title.size),
    leading: 0.78,
    family: DISPLAY_FONT,
    color: '#ffffff',
    shadow: true,
  });

  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `400 ${Math.round(width * 0.052)}px ${MONO_FONT}`;
  ctx.fillText('001', width - pad, Math.round(height * 0.055));
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 ${Math.round(width * 0.016)}px ${MONO_FONT}`;
  ctx.fillText(`v2.0  ${formatDateStamp()}`, width - pad, Math.round(height * 0.105));
  ctx.textAlign = 'left';

  drawZineSideData(ctx, card, settings, pad, Math.round(height * 0.30), Math.round(width * 0.28), height);
  if (settings.showQr !== false) {
    drawQrMark(ctx, Math.round(width * tokens.qr.x), Math.round(height * tokens.qr.y), Math.round(width * tokens.qr.size));
    drawTinyText(ctx, 'SCAN FOR FULL DATA', Math.round(width * tokens.qr.x) + Math.round(width * tokens.qr.size) + 16, Math.round(height * tokens.qr.y) + 14, width * 0.16, PAPER);
  }

  const promptRect = rectFromToken(tokens.prompt, width, height);
  drawZinePromptPanels(ctx, card, settings, promptRect);
  drawFooterStamp(ctx, settings, width, height);
}

function drawRecipeCard(ctx, image, payload, width, height) {
  const { settings, card } = payload;
  const tokens = getPromptTemplateDesign('recipe');
  fillBackground(ctx, '#0f1110', width, height);
  const pad = Math.round(width * 0.055);
  const imageRect = { x: pad, y: Math.round(height * 0.17), width: width - pad * 2, height: Math.round(height * 0.34) };
  drawPanel(ctx, pad, pad, width - pad * 2, height - pad * 2, 'rgba(255, 255, 255, 0.025)', 0, 'rgba(255,255,255,0.12)');
  drawPhotoBase(ctx, image, imageRect.width, imageRect.height, '#111', imageRect.x, imageRect.y);
  drawStackedTitle(ctx, settings.title || tokens.title.text, pad, Math.round(height * 0.06), width * 0.5, {
    size: Math.round(width * 0.082),
    leading: 0.86,
    family: DISPLAY_FONT,
    color: PAPER,
  });
  if (settings.showQr !== false) drawQrMark(ctx, width - pad - Math.round(width * 0.115), Math.round(height * 0.058), Math.round(width * 0.115));

  const promptRect = rectFromToken(tokens.prompt, width, height);
  drawPanel(ctx, promptRect.x, promptRect.y, promptRect.width, promptRect.height, 'rgba(5, 6, 6, 0.84)', 0, 'rgba(255,255,255,0.16)');
  drawSectionHeader(ctx, '01  POSITIVE PROMPT', promptRect.x + 20, promptRect.y + 18, GOLD);
  drawFittedColumns(ctx, card.positivePrompt || promptTextForMode(card, settings.promptMode), {
    x: promptRect.x + 20,
    y: promptRect.y + 56,
    width: promptRect.width - 40,
    height: promptRect.height - 76,
  }, {
    color: PAPER,
    fontSize: scaleFont(settings, 21),
    minFontSize: 9,
    lineHeight: Number(settings.lineHeight) || 1.22,
    columns: Math.max(1, Number(settings.columns) || 2),
    family: MONO_FONT,
    weight: '500',
  });
  drawMetaChips(ctx, buildPromptMetaFields(card, settings), rectFromToken(tokens.meta, width, height), { compact: false });
  drawFooterStamp(ctx, settings, width, height);
}

function drawMinimalCard(ctx, image, payload, width, height) {
  const { settings, card } = payload;
  const tokens = getPromptTemplateDesign('minimal');
  drawPhotoBase(ctx, image, width, height, '#080909');
  drawBottomGradient(ctx, width, height, settings, 0.48, 0.88);
  drawVignette(ctx, width, height, 0.22);
  const pad = Math.round(width * 0.06);
  drawBrand(ctx, settings, pad, Math.round(height * 0.055), width - pad * 2);
  drawStackedTitle(ctx, settings.title || tokens.title.text, pad, Math.round(height * tokens.title.y), width * 0.7, {
    size: Math.round(width * tokens.title.size),
    leading: 0.84,
    family: DISPLAY_FONT,
    color: '#ffffff',
    shadow: true,
  });
  drawFittedColumns(ctx, promptTextForMode(card, settings.promptMode), rectFromToken(tokens.prompt, width, height), {
    color: PAPER,
    fontSize: scaleFont(settings, 23),
    minFontSize: 9,
    lineHeight: Number(settings.lineHeight) || 1.24,
    columns: Math.max(1, Number(settings.columns) || 1),
    family: MONO_FONT,
    weight: '500',
  });
  drawFooterStamp(ctx, settings, width, height);
}

function drawMagazinePromptSections(ctx, card, settings, rect) {
  const layout = buildPromptSectionLayout('magazine', settings);
  if (!layout.negative.visible) {
    drawSectionHeader(ctx, 'POSITIVE PROMPT', rect.x, rect.y, GOLD);
    drawFittedColumns(ctx, card.positivePrompt || promptTextForMode(card, 'positive'), {
      x: rect.x,
      y: rect.y + 40,
      width: rect.width,
      height: rect.height - 42,
    }, {
      color: PAPER,
      fontSize: scaleFont(settings, layout.positive.fontSize),
      minFontSize: 10,
      lineHeight: Number(settings.lineHeight) || 1.2,
      columns: layout.positive.columns,
      family: MONO_FONT,
      weight: '700',
    });
    return;
  }

  const gap = Math.round(rect.width * 0.035);
  const columnWidth = (rect.width - gap) / 2;
  const positiveRect = { x: rect.x, y: rect.y + 42, width: columnWidth, height: rect.height - 48 };
  const negativeRect = { x: rect.x + columnWidth + gap, y: rect.y + 42, width: columnWidth, height: rect.height - 48 };
  const positive = card.positivePrompt || promptTextForMode(card, settings.promptMode);
  const negative = card.negativePrompt || 'negative prompt not found';

  drawSectionHeader(ctx, 'PROMPT', rect.x, rect.y, GOLD);
  drawSectionHeader(ctx, 'NEGATIVE PROMPT', negativeRect.x, rect.y, '#f5efe4');
  drawVerticalRule(ctx, rect.x + columnWidth + gap / 2, rect.y + 8, rect.height - 14, GOLD);
  drawFittedColumns(ctx, positive, positiveRect, {
    color: PAPER,
    fontSize: scaleFont(settings, layout.positive.fontSize),
    minFontSize: 8,
    lineHeight: Number(settings.lineHeight) || 1.22,
    columns: 1,
    family: MONO_FONT,
    weight: '600',
  });
  drawFittedColumns(ctx, negative, negativeRect, {
    color: '#e8e2d8',
    fontSize: scaleFont(settings, layout.negative.fontSize),
    minFontSize: 8,
    lineHeight: Number(settings.lineHeight) || 1.2,
    columns: 1,
    family: MONO_FONT,
    weight: '500',
  });
}

function drawZineSideData(ctx, card, settings, x, y, width, height) {
  const subject = inferSubject(card.positivePrompt);
  const location = inferLocation(card.positivePrompt);
  const step = Math.round(height * 0.072);
  drawLabelValue(ctx, 'SUBJECT', subject, x, y, width);
  drawLabelValue(ctx, 'LOCATION', location, x, y + step, width);
  drawLabelValue(ctx, 'MODEL', card.model || 'unknown', x, y + step * 3, width);
  drawSmallCaps(ctx, settings.brand || 'No EXIF Pro', x, y + step * 3.75, width, 18, GOLD);
}

function drawZinePromptPanels(ctx, card, settings, rect) {
  const layout = buildPromptSectionLayout('zine', settings);
  if (!layout.negative.visible) {
    const mainH = Math.round(rect.height * 0.68);
    const metaY = rect.y + mainH;
    const metaH = rect.height - mainH;
    drawPanel(ctx, rect.x, rect.y, rect.width, mainH, 'rgba(6, 8, 8, 0.76)', 0, 'rgba(255,255,255,0.22)');
    drawSectionHeader(ctx, '01  POSITIVE PROMPT', rect.x + 20, rect.y + 16, GOLD);
    drawFittedColumns(ctx, card.positivePrompt || promptTextForMode(card, 'positive'), {
      x: rect.x + 20,
      y: rect.y + 54,
      width: rect.width - 40,
      height: mainH - 68,
    }, {
      color: PAPER,
      fontSize: scaleFont(settings, layout.positive.fontSize),
      minFontSize: 8,
      lineHeight: Number(settings.lineHeight) || 1.18,
      columns: layout.positive.columns,
      family: MONO_FONT,
      weight: '650',
    });
    drawZineMetaPanels(ctx, card, rect.x, metaY, rect.width, metaH);
    return;
  }

  const rowGap = 0;
  const mainH = Math.round(rect.height * 0.42);
  const negH = Math.round(rect.height * 0.29);
  const metaH = rect.height - mainH - negH - rowGap * 2;

  drawPanel(ctx, rect.x, rect.y, rect.width, mainH, 'rgba(6, 8, 8, 0.76)', 0, 'rgba(255,255,255,0.22)');
  drawSectionHeader(ctx, '01  POSITIVE PROMPT', rect.x + 20, rect.y + 16, GOLD);
  drawFittedColumns(ctx, card.positivePrompt || promptTextForMode(card, settings.promptMode), {
    x: rect.x + 20,
    y: rect.y + 54,
    width: rect.width - 40,
    height: mainH - 68,
  }, {
    color: PAPER,
    fontSize: scaleFont(settings, 18),
    minFontSize: 7,
    lineHeight: Number(settings.lineHeight) || 1.18,
    columns: Math.max(1, Number(settings.columns) || 2),
    family: MONO_FONT,
    weight: '500',
  });

  const negY = rect.y + mainH;
  drawPanel(ctx, rect.x, negY, rect.width, negH, 'rgba(7, 9, 9, 0.8)', 0, 'rgba(255,255,255,0.2)');
  drawSectionHeader(ctx, '02  NEGATIVE PROMPT', rect.x + 20, negY + 15, '#f5efe4');
  drawFittedColumns(ctx, card.negativePrompt || 'negative prompt not found', {
    x: rect.x + 20,
    y: negY + 50,
    width: rect.width - 40,
    height: negH - 62,
  }, {
    color: '#d9d1c5',
    fontSize: scaleFont(settings, 16),
    minFontSize: 7,
    lineHeight: 1.17,
    columns: Math.max(1, Number(settings.columns) || 2),
    family: MONO_FONT,
    weight: '500',
  });

  const metaY = negY + negH;
  drawZineMetaPanels(ctx, card, rect.x, metaY, rect.width, metaH);
}

function drawZineMetaPanels(ctx, card, rectX, rectY, rectWidth, rectHeight) {
  const thirds = [
    ['02  MODEL', card.model || '-'],
    ['03  LORA', card.loras?.length ? card.loras.map(formatLora).join(', ') : 'none'],
    ['04  SEED', card.recipe?.seed || '-'],
  ];
  const columnW = rectWidth / thirds.length;
  thirds.forEach(([label, value], index) => {
    const x = rectX + index * columnW;
    drawPanel(ctx, x, rectY, columnW, rectHeight, 'rgba(6, 8, 8, 0.76)', 0, 'rgba(255,255,255,0.18)');
    drawCenteredSectionHeader(ctx, label, x, rectY + 16, columnW, GOLD);
    drawFittedColumns(ctx, value, {
      x: x + 18,
      y: rectY + 52,
      width: columnW - 36,
      height: rectHeight - 62,
    }, {
      color: PAPER,
      fontSize: 18,
      minFontSize: 9,
      lineHeight: 1.15,
      columns: 1,
      family: MONO_FONT,
      weight: '600',
      align: 'center',
    });
  });
}

function drawMetaChips(ctx, fields, rect, options = {}) {
  const visible = fields.slice(0, 6);
  const gap = options.compact ? 10 : 12;
  const perRow = Math.min(options.columns || 3, visible.length || 1);
  const rows = Math.ceil((visible.length || 1) / perRow);
  const chipH = Math.max(48, (rect.height - gap * (rows - 1)) / rows);
  const chipW = (rect.width - gap * (perRow - 1)) / perRow;

  visible.forEach((field, index) => {
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    const x = rect.x + col * (chipW + gap);
    const y = rect.y + row * (chipH + gap);
    drawPanel(ctx, x, y, chipW, chipH, 'rgba(8, 10, 10, 0.72)', options.compact ? 5 : 0, 'rgba(255,255,255,0.16)');
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = `900 ${options.compact ? 15 : 17}px ${MONO_FONT}`;
    ctx.fillText(field.label, x + chipW / 2, y + 9, chipW - 24);
    drawShrunkText(ctx, field.value, x + chipW / 2, y + (options.compact ? 31 : 38), chipW - 24, {
      size: options.compact ? 20 : 21,
      minSize: options.compact ? 10 : 10,
      weight: '700',
      family: MONO_FONT,
      color: PAPER,
      align: 'center',
    });
    ctx.textAlign = 'left';
  });
}

function drawFittedColumns(ctx, text, rect, options) {
  const cleanText = String(text || '').trim() || 'No prompt text found.';
  const columns = Math.max(1, Number(options.columns) || 1);
  const gap = Math.max(18, Number(options.gap) || rect.width * 0.035);
  const columnWidth = (rect.width - gap * (columns - 1)) / columns;
  let fontSize = Number(options.fontSize) || 20;
  const minFontSize = Number(options.minFontSize) || 9;
  let lines = [];
  let lineHeight = fontSize * (Number(options.lineHeight) || 1.24);
  let capacity = 0;

  while (fontSize >= minFontSize) {
    ctx.font = `${options.weight || '500'} ${fontSize}px ${options.family || UI_FONT}`;
    lines = wrapParagraphs(ctx, cleanText, columnWidth);
    lineHeight = fontSize * (Number(options.lineHeight) || 1.24);
    capacity = Math.max(1, Math.floor(rect.height / lineHeight) * columns);
    if (lines.length <= capacity || fontSize === minFontSize) break;
    fontSize -= 1;
  }

  ctx.fillStyle = options.color || '#fff';
  ctx.textBaseline = 'top';
  ctx.textAlign = options.align || 'left';
  ctx.font = `${options.weight || '500'} ${fontSize}px ${options.family || UI_FONT}`;
  const rowsPerColumn = Math.max(1, Math.floor(rect.height / lineHeight));
  for (let column = 0; column < columns; column += 1) {
    const start = column * rowsPerColumn;
    const end = start + rowsPerColumn;
    const x = rect.x + column * (columnWidth + gap);
    lines.slice(start, end).forEach((line, row) => {
      const drawX = options.align === 'center' ? x + columnWidth / 2 : x;
      ctx.fillText(line, drawX, rect.y + row * lineHeight, columnWidth);
    });
  }
  ctx.textAlign = 'left';
  return { overflow: lines.length > capacity, lines: lines.length, fontSize, truncated: false };
}

function drawShrunkText(ctx, text, x, y, maxWidth, options = {}) {
  let size = Number(options.size) || 16;
  const minSize = Number(options.minSize) || 9;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = options.align || 'left';
  ctx.fillStyle = options.color || PAPER;
  while (size > minSize) {
    ctx.font = `${options.weight || '600'} ${size}px ${options.family || UI_FONT}`;
    if (ctx.measureText(String(text || '')).width <= maxWidth) break;
    size -= 1;
  }
  ctx.font = `${options.weight || '600'} ${size}px ${options.family || UI_FONT}`;
  ctx.fillText(String(text || '-'), x, y, maxWidth);
  ctx.restore();
}

function wrapParagraphs(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = String(text || '').split(/\n+/);
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth || !line) {
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

function rectFromToken(token, width, height) {
  return {
    x: Math.round(width * token.x),
    y: Math.round(height * token.y),
    width: Math.round(width * token.width),
    height: Math.round(height * token.height),
  };
}

function drawPhotoBase(ctx, image, width, height, color, x = 0, y = 0) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  if (image) {
    drawCover(ctx, image, x, y, width, height);
    return;
  }
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, '#1b211f');
  gradient.addColorStop(1, '#070808');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
}

function drawBottomGradient(ctx, width, height, settings, start = 0.44, endAlpha = 0.9) {
  const extraDarken = clampNumber(settings.darken, 0, 72, 34) / 100;
  if (extraDarken > 0.01) {
    ctx.fillStyle = `rgba(0,0,0,${extraDarken * 0.38})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (settings.readability === 'none') return;
  const gradient = ctx.createLinearGradient(0, height * start, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.4, `rgba(0,0,0,${endAlpha * 0.42})`);
  gradient.addColorStop(1, `rgba(0,0,0,${endAlpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawSolidOverlay(ctx, width, height, alpha) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(0, 0, width, height);
}

function drawVignette(ctx, width, height, alpha) {
  const gradient = ctx.createRadialGradient(width * 0.52, height * 0.42, width * 0.18, width * 0.52, height * 0.42, width * 0.8);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawGuideFrame(ctx, tokens, width, height) {
  const inset = Math.round(width * (tokens.border?.inset || 0.035));
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.24)';
  ctx.lineWidth = 2;
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  if (tokens.border?.guide) {
    ctx.strokeStyle = 'rgba(240,184,70,0.22)';
    ctx.setLineDash([6, 8]);
    ctx.strokeRect(inset + 18, inset + 18, width - (inset + 18) * 2, height - (inset + 18) * 2);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawZineGrid(ctx, width, height) {
  const inset = Math.round(width * 0.045);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width * 0.36, inset);
  ctx.lineTo(width * 0.36, height - inset);
  ctx.moveTo(inset, height * 0.6);
  ctx.lineTo(width - inset, height * 0.6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(240,184,70,0.22)';
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(width * 0.07, inset);
  ctx.lineTo(width * 0.07, height - inset);
  ctx.moveTo(width - width * 0.07, inset);
  ctx.lineTo(width - width * 0.07, height - inset);
  ctx.stroke();
  ctx.restore();
}

function drawStackedTitle(ctx, title, x, y, maxWidth, options = {}) {
  const words = String(title || 'PROMPT SHARE').toUpperCase().split(/\s+/).filter(Boolean);
  const size = Number(options.size) || 96;
  const leading = Number(options.leading) || 0.82;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.fillStyle = options.color || '#fff';
  ctx.font = `900 ${size}px ${options.family || DISPLAY_FONT}`;
  if (options.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
  }
  if (words.length <= 1) {
    ctx.fillText(words[0] || 'PROMPT', x, y, maxWidth);
  } else {
    words.slice(0, 3).forEach((word, index) => {
      ctx.fillText(word, x, y + index * size * leading, maxWidth);
    });
  }
  ctx.restore();
}

function drawSmallCaps(ctx, text, x, y, maxWidth, size = 18, color = PAPER) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.font = `900 ${size}px ${UI_FONT}`;
  ctx.fillText(String(text || '').toUpperCase(), x, y, maxWidth);
  ctx.restore();
}

function drawTinyText(ctx, text, x, y, maxWidth, color = 'rgba(255,255,255,0.72)') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.font = `600 16px ${MONO_FONT}`;
  ctx.fillText(String(text || ''), x, y, maxWidth);
  ctx.restore();
}

function drawSectionHeader(ctx, text, x, y, color = GOLD) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.font = `900 18px ${MONO_FONT}`;
  ctx.fillText(String(text || '').toUpperCase(), x, y);
  ctx.restore();
}

function drawCenteredSectionHeader(ctx, text, x, y, width, color = GOLD) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `900 17px ${MONO_FONT}`;
  ctx.fillText(String(text || '').toUpperCase(), x + width / 2, y, width - 20);
  ctx.restore();
}

function drawBrandLockup(ctx, brand, subtitle, x, y, qrSize) {
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 19px ${UI_FONT}`;
  ctx.fillText(brand, x + qrSize, y, qrSize + 120);
  ctx.fillStyle = 'rgba(255,255,255,0.76)';
  ctx.font = `800 12px ${MONO_FONT}`;
  ctx.fillText(subtitle, x + qrSize, y + 28, qrSize + 120);
  ctx.restore();
}

function drawBrand(ctx, settings, x, y, maxWidth) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `800 25px ${UI_FONT}`;
  ctx.fillText(settings.brand || 'No EXIF Pro', x, y, maxWidth);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = `600 18px ${MONO_FONT}`;
  ctx.fillText(settings.handle || '@NoEXIFPro', x, y + 34, maxWidth);
}

function drawLabelValue(ctx, label, value, x, y, maxWidth) {
  drawSectionHeader(ctx, `/ ${label} /`, x, y, PAPER);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.font = `900 23px ${MONO_FONT}`;
  ctx.fillText(String(value || '-').toUpperCase(), x, y + 34, maxWidth);
  ctx.restore();
}

function titleForTemplate(settings, tokens) {
  if (!settings.title || settings.title === 'PROMPT SHARE') return tokens.title.text;
  return settings.title;
}

function drawVerticalRule(ctx, x, y, height, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + height);
  ctx.stroke();
  ctx.restore();
}

function drawFooterStamp(ctx, settings, width, height) {
  ctx.save();
  const y = height - Math.round(height * 0.035);
  ctx.fillStyle = GOLD;
  ctx.font = `900 ${Math.max(13, Math.round(width * 0.013))}px ${MONO_FONT}`;
  ctx.fillText('CREATED BY', Math.round(width * 0.06), y);
  ctx.fillStyle = PAPER;
  ctx.fillText(settings.handle || '@NoEXIFPro', Math.round(width * 0.155), y);
  ctx.textAlign = 'right';
  ctx.fillStyle = GOLD;
  ctx.fillText(`ASPECT RATIO  --ar ${settings.ratio || '4:5'}`, width - Math.round(width * 0.06), y);
  ctx.restore();
}

function drawQrMark(ctx, x, y, size) {
  ctx.save();
  drawPanel(ctx, x, y, size, size, 'rgba(255,255,255,0.94)', 0);
  ctx.fillStyle = '#0a0d0d';
  const cell = size / 9;
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const finder = (row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3);
      const body = (row * 7 + col * 11) % 5 < 2;
      if (finder || body) {
        ctx.fillRect(x + col * cell + 3, y + row * cell + 3, Math.max(2, cell - 6), Math.max(2, cell - 6));
      }
    }
  }
  ctx.restore();
}

function drawPanel(ctx, x, y, width, height, fill, radius = 8, stroke = '') {
  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillBackground(ctx, color, width, height, x = 0, y = 0) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function drawCover(ctx, image, x, y, width, height) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function scaleFont(settings, baseSize) {
  return Math.round(baseSize * (clampNumber(settings.textScale, 70, 130, 100) / 100));
}

function formatDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function inferSubject(prompt = '') {
  const lower = String(prompt).toLowerCase();
  if (lower.includes('woman') || lower.includes('girl')) return 'woman';
  if (lower.includes('man') || lower.includes('boy')) return 'man';
  if (lower.includes('city')) return 'city scene';
  return 'AI image';
}

function inferLocation(prompt = '') {
  const lower = String(prompt).toLowerCase();
  if (lower.includes('subway') || lower.includes('train')) return 'subway platform';
  if (lower.includes('city') || lower.includes('street')) return 'urban street';
  if (lower.includes('beach') || lower.includes('pool')) return 'night resort';
  return 'generated scene';
}

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Prompt card image could not be loaded.'));
    image.src = src;
  });
}
