export function normalizePixivTarget(value) {
  return String(value || '').trim();
}

export function countPixivResults(results) {
  return (results || []).reduce((counts, item) => {
    if (item.status === 'downloaded') counts.downloaded += 1;
    else if (item.status === 'skipped') counts.skipped += 1;
    else if (item.status === 'failed') counts.failed += 1;
    return counts;
  }, { downloaded: 0, skipped: 0, failed: 0 });
}

export function selectedPixivItems(items) {
  return (items || []).filter(item => item.selected !== false);
}

export function estimatePixivBytes(items) {
  return selectedPixivItems(items).reduce((total, item) => total + (Number(item.sizeBytes) || 0), 0);
}

export function filterPixivItems(items, options = {}) {
  const query = String(options.query || '').trim().toLowerCase();
  const filter = options.filter || '전체';
  const downloadedNames = new Set((options.downloadedPaths || []).map(pathBaseName).filter(Boolean));

  return (items || [])
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .filter(item => {
      const title = String(item.title || '').toLowerCase();
      const fileName = String(item.fileName || '').toLowerCase();
      if (query && !title.includes(query) && !fileName.includes(query)) return false;
      if (filter === '일러스트' && Number(item.pageCount || 1) > 1) return false;
      if (filter === '만화' && Number(item.pageCount || 1) <= 1) return false;
      if (filter === '이미 받은 파일 제외' && downloadedNames.has(pathBaseName(item.fileName))) return false;
      return true;
    });
}

export function choosePixivDownloadItems(items, options = {}) {
  const candidates = filterPixivItems(items, options);
  const downloadedNames = new Set((options.downloadedPaths || []).map(pathBaseName).filter(Boolean));
  const mode = options.downloadMode || '선택한 이미지만';

  if (mode === '전체 다시 받기') return candidates;
  if (mode === '새 파일만') {
    return candidates.filter(item => item.selected !== false && !downloadedNames.has(pathBaseName(item.fileName)));
  }
  return candidates.filter(item => item.selected !== false);
}

export function pathBaseName(value) {
  const text = String(value || '').replace(/\\/g, '/');
  return text.split('/').filter(Boolean).pop() || '';
}
