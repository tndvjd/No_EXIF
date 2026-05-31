export const COMMAND_PALETTE_ACTIONS = [
  {
    id: 'add-images',
    title: '이미지 추가',
    helper: '이미지를 작업 목록에 추가',
    scope: 'workspace import',
  },
  {
    id: 'remove-exif',
    title: 'EXIF 제거',
    helper: 'Privacy field cleanup',
    scope: 'exif safety export',
    requiresImages: true,
  },
  {
    id: 'export-grid',
    title: '그리드 내보내기',
    helper: 'Export the current canvas grid',
    scope: 'grid canvas export',
    requiresImages: true,
  },
  {
    id: 'inspect-metadata',
    title: '메타데이터 확인',
    helper: 'Inspect ComfyUI workflow, prompt, and PNG tags',
    scope: 'metadata inspector',
    requiresImages: true,
  },
  {
    id: 'create-prompt-card',
    title: '프롬프트 카드 만들기',
    helper: 'Render a share card from detected generation prompts',
    scope: 'prompt share card',
    requiresPrompts: true,
  },
  {
    id: 'import-pixiv',
    title: 'Pixiv 가져오기',
    helper: 'Pixiv 후보 이미지를 작업 목록으로 가져오기',
    scope: 'pixiv import',
  },
];

const DEFAULT_RECOMMENDATION_LIMIT = 3;

function normalizeContext(context = {}) {
  return {
    activeMode: context.activeMode || 'exif',
    images: Array.isArray(context.images) ? context.images : [],
    promptCount: Number(context.promptCount) || 0,
    pixivCount: Number(context.pixivCount) || 0,
    busy: Boolean(context.busy),
  };
}

function disabledState(action, context) {
  if (context.busy) {
    return { disabled: true, disabledReason: '작업이 끝난 뒤 다시 실행하세요.' };
  }
  if (action.requiresImages && context.images.length === 0) {
    return { disabled: true, disabledReason: '이미지를 먼저 추가하세요.' };
  }
  if (action.requiresPrompts && context.promptCount === 0) {
    return { disabled: true, disabledReason: '프롬프트가 있는 이미지를 먼저 추가하세요.' };
  }
  return { disabled: false, disabledReason: '' };
}

function presentAction(action, context) {
  const { requiresImages, requiresPrompts, ...publicAction } = action;
  return {
    ...publicAction,
    ...disabledState(action, context),
  };
}

function searchText(action) {
  return `${action.title} ${action.helper} ${action.scope}`.toLocaleLowerCase();
}

export function filterCommandPaletteActions({ query = '', context = {} } = {}) {
  const normalizedContext = normalizeContext(context);
  const normalizedQuery = String(query).trim().toLocaleLowerCase();

  return COMMAND_PALETTE_ACTIONS
    .filter(action => !normalizedQuery || searchText(action).includes(normalizedQuery))
    .map(action => presentAction(action, normalizedContext));
}

function scoreAction(action, context) {
  let score = 0;

  if (action.id === 'add-images' && context.images.length === 0) score += 100;
  if (action.id === 'import-pixiv' && context.images.length === 0) score += 80;
  if (action.id === 'import-pixiv' && (context.activeMode === 'pixiv' || context.pixivCount > 0)) score += 100;
  if (action.id === 'inspect-metadata' && context.images.length > 0) score += 85;
  if (action.id === 'inspect-metadata' && context.images.length === 0) score += 60;
  if (action.id === 'inspect-metadata' && context.activeMode === 'metadata') score += 45;
  if (action.id === 'remove-exif' && context.images.length > 0) score += 70;
  if (action.id === 'remove-exif' && context.activeMode === 'exif') score += 30;
  if (action.id === 'export-grid' && context.images.length > 1) score += 65;
  if (action.id === 'export-grid' && context.activeMode === 'grid') score += 35;
  if (action.id === 'create-prompt-card' && context.promptCount > 0) score += 95;
  if (action.id === 'create-prompt-card' && context.activeMode === 'prompt-share') score += 30;

  return score;
}

export function recommendCommandPaletteActions(context = {}, limit = DEFAULT_RECOMMENDATION_LIMIT) {
  const normalizedContext = normalizeContext(context);

  return COMMAND_PALETTE_ACTIONS
    .map((action, index) => ({ action, index, score: scoreAction(action, normalizedContext) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(item => presentAction(item.action, normalizedContext));
}

export function buildCommandPaletteModel({ query = '', context = {} } = {}) {
  return {
    query: String(query),
    results: filterCommandPaletteActions({ query, context }),
    recommended: recommendCommandPaletteActions(context),
  };
}
