export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function buildExifExportFolderName(date = new Date()) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  return `No_EXIF_Export_${year}-${month}-${day}_${hour}${minute}`;
}

export function buildChildPath(parent, child) {
  const trimmed = String(parent || '').replace(/[\\/]+$/, '');
  const separator = trimmed.includes('\\') ? '\\' : '/';
  return `${trimmed}${separator}${child}`;
}

export function buildExifOutputDirectory(parent, date = new Date()) {
  const folderName = typeof date === 'string' ? date : buildExifExportFolderName(date);
  return buildChildPath(parent, folderName);
}

export function buildPromptCardFileName(sourceName = 'prompt-card.png', date = new Date()) {
  const baseName = String(sourceName || 'prompt-card.png')
    .split(/[\\/]/)
    .filter(Boolean)
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    || 'prompt-card';
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  return `PROMPT_CARD_${baseName}_${year}-${month}-${day}_${hour}${minute}.png`;
}

export function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumber(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${formatNumber(mb)} MB`;
  return `${formatNumber(mb / 1024)} GB`;
}

export function formatDimensions(image) {
  const width = image?.metadata?.image?.width ?? image?.width;
  const height = image?.metadata?.image?.height ?? image?.height;
  if (!width || !height) return '크기 확인 중';
  return `${width} x ${height}`;
}

export function metadataChip(image) {
  const comfy = image?.metadata?.comfyui;
  if (comfy?.workflow || comfy?.workflowJson) {
    return { label: 'workflow', tone: 'workflow' };
  }
  if (comfy?.present) {
    return { label: 'prompt', tone: 'ok' };
  }
  if (image?.hasExif || image?.metadata?.privacy?.hasExif) {
    return { label: 'EXIF', tone: 'warn' };
  }
  return { label: '정리됨', tone: 'ok' };
}

export function metadataStatusBadges(image, summary = extractComfySummary(image?.metadata || {})) {
  const metadata = image?.metadata;
  if (!metadata) return [];

  const pngTagCount = metadata.pngText?.count || 0;
  const badges = [
    {
      label: summary.generationPresent ? '생성 메타데이터 있음' : '생성 메타데이터 없음',
      tone: summary.generationPresent ? 'workflow' : 'ok',
    },
    {
      label: summary.workflowPresent
        ? 'Workflow 감지'
        : summary.promptPresent
          ? 'Prompt만 감지'
          : 'Workflow 없음',
      tone: summary.workflowPresent || summary.promptPresent ? 'workflow' : 'ok',
    },
    {
      label: summary.model || summary.unet ? '모델 감지' : '모델 없음',
      tone: summary.model || summary.unet ? 'workflow' : 'ok',
    },
    {
      label: `PNG 태그 ${pngTagCount}개`,
      tone: pngTagCount ? 'workflow' : 'ok',
    },
  ];

  if (summary.loras?.length) {
    badges.splice(3, 0, { label: `LoRA ${summary.loras.length}개`, tone: 'workflow' });
  }

  return badges;
}

export function extractComfySummary(metadata = {}) {
  const comfy = metadata.comfyui || {};
  const promptJson = comfy.promptJson || parseJson(comfy.prompt);
  const workflowJson = comfy.workflowJson || parseJson(comfy.workflow);
  const promptNodes = flattenNodes(promptJson);
  const workflowNodes = flattenNodes(workflowJson);
  const nodes = promptNodes.length ? promptNodes : workflowNodes;
  const nodeMap = buildNodeMap(nodes);
  const samplerNodes = nodes.filter(node => isSamplerNode(node));
  const samplerNode = samplerNodes[samplerNodes.length - 1] || samplerNodes[0];
  const baseSamplerNode = samplerNodes.length > 1 ? samplerNodes[0] : null;
  const textNodes = nodes
    .map(node => ({ node, text: resolveNodeText(node, nodeMap) }))
    .filter(({ node, text }) => text && !String(node.classType || '').toLowerCase().includes('lora'));
  const modelStack = collectModelStack(nodes);
  const loras = collectLoras(nodes);
  const positivePrompt = samplerNode
    ? resolveNodeText(resolveLinkedNode(samplerNode.inputs?.positive, nodeMap), nodeMap)
    : '';
  const negativePrompt = samplerNode
    ? resolveNodeText(resolveLinkedNode(samplerNode.inputs?.negative, nodeMap), nodeMap)
    : '';

  return {
    positivePrompt: positivePrompt || pickPrompt(textNodes, 'positive') || textNodes[0]?.text || '',
    negativePrompt: negativePrompt || pickPrompt(textNodes, 'negative') || textNodes[1]?.text || '',
    model: firstDefined(modelStack.ckpt, modelStack.model, modelStack.unet, ''),
    unet: firstDefined(modelStack.unet, ''),
    clip: firstDefined(modelStack.clip, ''),
    vae: firstDefined(modelStack.vae, ''),
    loras,
    sampler: firstDefined(samplerNode?.inputs?.sampler_name, ''),
    scheduler: firstDefined(samplerNode?.inputs?.scheduler, ''),
    seed: firstDefined(samplerNode?.inputs?.seed, ''),
    steps: firstDefined(samplerNode?.inputs?.steps, ''),
    cfg: firstDefined(samplerNode?.inputs?.cfg, ''),
    denoise: firstDefined(samplerNode?.inputs?.denoise, ''),
    baseSeed: firstDefined(baseSamplerNode?.inputs?.seed, ''),
    baseSteps: firstDefined(baseSamplerNode?.inputs?.steps, ''),
    baseDenoise: firstDefined(baseSamplerNode?.inputs?.denoise, ''),
    promptPresent: Boolean(comfy.prompt || promptJson),
    workflowPresent: Boolean(comfy.workflow || workflowJson),
    generationPresent: Boolean(comfy.present || promptJson || workflowJson || metadata.pngText?.count),
  };
}

export function extractComfyPromptCard(metadata = {}) {
  const summary = extractComfySummary(metadata);
  return {
    present: summary.generationPresent,
    source: summary.workflowPresent ? 'workflow' : summary.promptPresent ? 'prompt' : '',
    positivePrompt: summary.positivePrompt || '',
    negativePrompt: summary.negativePrompt || '',
    model: summary.model || summary.unet || '',
    loras: summary.loras || [],
    recipe: {
      seed: summary.seed || '',
      sampler: summary.sampler || '',
      steps: summary.steps || '',
      cfg: summary.cfg || '',
      scheduler: summary.scheduler || '',
    },
  };
}

export function fileBaseName(path) {
  return String(path || '').split(/[\\/]/).filter(Boolean).pop() || '';
}

export function parseDroppedPathText(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith('#'))
    .map(line => {
      if (!line.startsWith('file://')) return line;
      const withoutScheme = line.replace(/^file:\/+/, '');
      const windowsPath = withoutScheme.replace(/^\/([A-Za-z]:)/, '$1');
      return decodeURIComponent(windowsPath);
    });
}

export async function runToastAction(action) {
  if (!action) return { ok: true };
  const result = await action();
  if (result?.ok === false) {
    throw new Error(result.error || '작업을 열 수 없습니다.');
  }
  return result || { ok: true };
}

function formatNumber(value) {
  return Number(value).toFixed(1).replace(/\.0$/, '.0');
}

function parseJson(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function flattenNodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.nodes)) {
    const linkMap = buildWorkflowLinkMap(value.links);
    return value.nodes.map(node => normalizeNode(node.id, node, linkMap));
  }
  return Object.entries(value)
    .map(([id, item]) => normalizeNode(id, item))
    .filter(Boolean);
}

function normalizeNode(id, node, linkMap = new Map()) {
  if (!node || typeof node !== 'object') return null;
  const classType = node.class_type || node.type || '';
  const widgets = Array.isArray(node.widgets_values) ? node.widgets_values : [];
  const inputs = Array.isArray(node.inputs)
    ? normalizeWorkflowInputs(node.inputs, widgets, classType, linkMap)
    : node.inputs && typeof node.inputs === 'object'
      ? node.inputs
      : {};
  return {
    ...node,
    id: String(id ?? node.id ?? ''),
    classType,
    title: node._meta?.title || node.title || node.name || '',
    inputs,
    widgets,
  };
}

function buildNodeMap(nodes) {
  return new Map(nodes.filter(Boolean).map(node => [String(node.id), node]));
}

function buildWorkflowLinkMap(links = []) {
  const linkMap = new Map();
  for (const link of Array.isArray(links) ? links : []) {
    if (!Array.isArray(link) || link.length < 3) continue;
    const [linkId, originId, originSlot = 0] = link;
    linkMap.set(Number(linkId), [String(originId), originSlot]);
    linkMap.set(String(linkId), [String(originId), originSlot]);
  }
  return linkMap;
}

function normalizeWorkflowInputs(inputs, widgets, classType, linkMap) {
  const normalized = {};
  for (const input of inputs) {
    if (!input?.name) continue;
    if (input.link !== null && input.link !== undefined && linkMap.has(input.link)) {
      normalized[input.name] = linkMap.get(input.link);
    }
  }

  const lowerClass = String(classType || '').toLowerCase();
  if (lowerClass.includes('ksampler')) {
    Object.assign(normalized, normalizeSamplerWidgets(widgets));
  } else if (lowerClass.includes('cliptextencode')) {
    const widgetText = findWidgetText(widgets);
    if (widgetText && !normalized.text) normalized.text = widgetText;
  } else if (lowerClass.includes('checkpointloader')) {
    if (typeof widgets[0] === 'string') normalized.ckpt_name = widgets[0];
  } else if (lowerClass.includes('unetloader')) {
    if (typeof widgets[0] === 'string') normalized.unet_name = widgets[0];
  } else if (lowerClass.includes('cliploader')) {
    if (typeof widgets[0] === 'string') normalized.clip_name = widgets[0];
  } else if (lowerClass.includes('vaeloader')) {
    if (typeof widgets[0] === 'string') normalized.vae_name = widgets[0];
  }

  if (lowerClass.includes('lora')) {
    const loraStack = widgets.find(item => Array.isArray(item) && item.some(entry => entry?.name));
    const text = widgets.find(item => typeof item === 'string' && item.includes('<lora:'));
    if (loraStack) normalized.loras = { __value__: loraStack };
    if (text) normalized.text = text;
  }

  return normalized;
}

function normalizeSamplerWidgets(widgets) {
  const normalized = {};
  if (!Array.isArray(widgets) || widgets.length < 6) return normalized;
  const hasControlMode = typeof widgets[1] === 'string' && typeof widgets[2] === 'number';
  const offset = hasControlMode ? 1 : 0;
  normalized.seed = widgets[0];
  normalized.steps = widgets[1 + offset];
  normalized.cfg = widgets[2 + offset];
  normalized.sampler_name = widgets[3 + offset];
  normalized.scheduler = widgets[4 + offset];
  normalized.denoise = widgets[5 + offset];
  return normalized;
}

function isSamplerNode(node) {
  const classType = String(node.classType || '').toLowerCase();
  return classType.includes('ksampler') || hasAnyKey(node.inputs, ['sampler_name', 'scheduler', 'seed', 'steps', 'cfg', 'denoise']);
}

function resolveLinkedNode(value, nodeMap) {
  if (!Array.isArray(value) || value.length === 0) return null;
  return nodeMap.get(String(value[0])) || null;
}

function resolveInputValue(value, nodeMap, visited = new Set()) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return resolveNodeText(resolveLinkedNode(value, nodeMap), nodeMap, visited);
  }
  return '';
}

function resolveNodeText(node, nodeMap, visited = new Set()) {
  if (!node || visited.has(node.id)) return '';
  visited.add(node.id);
  const inputText = resolveInputValue(node.inputs?.text, nodeMap, visited);
  if (inputText) return inputText;
  const widgetText = findWidgetText(node.widgets);
  return widgetText || '';
}

function collectModelStack(nodes) {
  const stack = {};
  for (const node of nodes) {
    if (!node?.inputs) continue;
    stack.ckpt ||= firstDefined(node.inputs.ckpt_name, '');
    stack.model ||= firstDefined(node.inputs.model_name, '');
    stack.unet ||= firstDefined(node.inputs.unet_name, '');
    stack.clip ||= firstDefined(node.inputs.clip_name, '');
    stack.vae ||= firstDefined(node.inputs.vae_name, '');
  }
  return stack;
}

function collectLoras(nodes) {
  const byName = new Map();
  for (const node of nodes) {
    const direct = node?.inputs?.loras?.__value__;
    if (Array.isArray(direct)) {
      for (const lora of direct) {
        if (!isActiveLora(lora)) continue;
        byName.set(lora.name, {
          name: lora.name,
          strength: firstDefined(lora.strength, lora.modelStrength, lora.clipStrength, ''),
        });
      }
      continue;
    }
    const text = typeof node?.inputs?.text === 'string' ? node.inputs.text : '';
    for (const match of text.matchAll(/<lora:([^:>]+):([^>]+)>/gi)) {
      if (isZeroStrength(match[2])) continue;
      if (!byName.has(match[1])) {
        byName.set(match[1], { name: match[1], strength: match[2] });
      }
    }
  }
  return Array.from(byName.values());
}

function isActiveLora(lora) {
  if (!lora?.name) return false;
  if (lora.active === false || lora.enabled === false || lora.disabled === true || lora.bypass === true) {
    return false;
  }
  const strength = firstDefined(lora.strength, lora.modelStrength, lora.clipStrength, '');
  const clipStrength = firstDefined(lora.clipStrength, strength, '');
  return !(isZeroStrength(strength) && isZeroStrength(clipStrength));
}

function isZeroStrength(value) {
  if (value === '' || value === undefined || value === null) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric === 0;
}

function findWidgetText(widgets = []) {
  for (const value of widgets) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value)) {
      const nested = findWidgetText(value);
      if (nested) return nested;
    }
  }
  return '';
}

function hasAnyKey(target = {}, keys = []) {
  return keys.some(key => Object.prototype.hasOwnProperty.call(target, key));
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

function pickPrompt(nodes, kind) {
  const found = nodes.find(({ node }) => {
    const title = `${node._meta?.title || ''} ${node.title || ''} ${node.name || ''}`.toLowerCase();
    return title.includes(kind);
  });
  return found?.text || '';
}
