import { pixivMockItems } from './appConstants.js';

export function clonePixivMockItems() {
  return pixivMockItems.map(item => ({ ...item }));
}

export function buildPixivListState(current, target, result = {}) {
  return {
    ...current,
    target,
    items: (result.items || []).map(item => ({
      ...item,
      artistId: result.userId,
      selected: item.selected !== false,
    })),
    resultCounts: { downloaded: 0, skipped: 0, failed: 0 },
    downloadedPaths: [],
  };
}

export function buildPixivDownloadPayload(state, items) {
  return {
    refreshToken: state.refreshToken,
    outputDir: state.outputDir,
    items,
    retries: state.retries,
    workers: state.workers,
    naming: { mode: state.naming },
    requestTimeout: state.timeout,
  };
}

export function downloadedPixivPaths(results = []) {
  return results
    .filter(item => ['downloaded', 'skipped'].includes(item.status))
    .map(item => item.path)
    .filter(Boolean);
}
