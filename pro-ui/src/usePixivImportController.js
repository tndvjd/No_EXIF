import { useState } from 'react';

import { initialPixivState } from './appConstants.js';
import {
  choosePixivDownloadItems,
  countPixivResults,
  filterPixivItems,
  normalizePixivTarget,
} from './pixivImportUtils.js';
import {
  buildPixivDownloadPayload,
  buildPixivListState,
  clonePixivMockItems,
  downloadedPixivPaths,
} from './pixivImportController.js';

export function usePixivImportController({
  setBusy,
  showToast,
  importImagePaths,
  changeMode,
}) {
  const [pixivState, setPixivState] = useState(initialPixivState);

  function updatePixivState(patch) {
    setPixivState(current => ({ ...current, ...patch }));
  }

  function togglePixivItem(index) {
    setPixivState(current => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, selected: item.selected === false } : item
      )),
    }));
  }

  async function listPixivWorks() {
    const target = normalizePixivTarget(pixivState.target);
    if (!target) {
      showToast({ type: 'warning', title: 'Pixiv 작가 URL 또는 ID를 입력하세요.' });
      return;
    }
    if (!pixivState.refreshToken.trim()) {
      showToast({ type: 'warning', title: 'Refresh Token을 입력하세요.', detail: '토큰은 Pixiv 목록 조회와 다운로드에 필요합니다.' });
      return;
    }
    if (!window.noExif?.listPixivWorks) {
      const items = clonePixivMockItems();
      setPixivState(current => ({ ...current, items, resultCounts: { downloaded: 0, skipped: 0, failed: 0 }, downloadedPaths: [] }));
      showToast({ type: 'info', title: 'Pixiv 샘플 목록을 표시했습니다.', detail: '데스크톱 앱에서 실제 목록 조회를 사용할 수 있습니다.' });
      return;
    }
    setBusy(true);
    try {
      const result = await window.noExif.listPixivWorks({
        refreshToken: pixivState.refreshToken,
        target,
        limit: pixivState.limit,
        requestTimeout: pixivState.timeout,
      });
      setPixivState(current => buildPixivListState(current, target, result));
      showToast({ title: `Pixiv 목록 ${result.items?.length || 0}장을 불러왔습니다.`, detail: `사용자 ID ${result.userId}` });
    } catch (error) {
      showToast({ type: 'error', title: 'Pixiv 목록을 불러오지 못했습니다.', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function choosePixivFolder() {
    if (!window.noExif?.choosePixivOutputDirectory) {
      setPixivState(current => ({ ...current, outputDir: 'No_EXIF_Pixiv' }));
      showToast({ type: 'info', title: '샘플 저장 폴더를 설정했습니다.' });
      return;
    }
    try {
      const outputDir = await window.noExif.choosePixivOutputDirectory();
      if (!outputDir) return;
      setPixivState(current => ({ ...current, outputDir }));
      showToast({ type: 'info', title: 'Pixiv 저장 폴더를 선택했습니다.', detail: outputDir });
    } catch (error) {
      showToast({ type: 'error', title: '저장 폴더 선택 실패', detail: error.message });
    }
  }

  async function downloadPixivWorks() {
    const downloadItems = choosePixivDownloadItems(pixivState.items, pixivState);
    if (!downloadItems.length) {
      showToast({ type: 'warning', title: '다운로드할 이미지를 선택하세요.' });
      return;
    }
    if (!pixivState.outputDir) {
      showToast({ type: 'warning', title: '저장 폴더를 먼저 선택하세요.' });
      return;
    }
    if (!pixivState.refreshToken.trim()) {
      showToast({ type: 'warning', title: 'Refresh Token을 입력하세요.' });
      return;
    }
    if (!window.noExif?.downloadPixivWorks) {
      showToast({ type: 'warning', title: '브라우저 미리보기에서는 실제 다운로드를 할 수 없습니다.' });
      return;
    }
    setBusy(true);
    try {
      const result = await window.noExif.downloadPixivWorks(
        buildPixivDownloadPayload(pixivState, downloadItems),
      );
      const counts = countPixivResults(result.results);
      const downloadedPaths = downloadedPixivPaths(result.results);
      setPixivState(current => ({ ...current, resultCounts: counts, downloadedPaths }));
      showToast({
        title: `Pixiv 다운로드 완료 · 저장 ${counts.downloaded}장`,
        detail: `이미 있음 ${counts.skipped}장 · 실패 ${counts.failed}장`,
        actionLabel: '폴더 열기',
        onAction: () => window.noExif.openPath(pixivState.outputDir),
      });
    } catch (error) {
      showToast({ type: 'error', title: 'Pixiv 다운로드 실패', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function addDownloadedPixivImages() {
    if (!pixivState.downloadedPaths.length) {
      showToast({ type: 'warning', title: '추가할 다운로드 이미지가 없습니다.' });
      return;
    }
    setBusy(true);
    try {
      await importImagePaths(pixivState.downloadedPaths);
      changeMode('metadata');
    } catch (error) {
      showToast({ type: 'error', title: '다운로드 이미지를 앱에 추가하지 못했습니다.', detail: error.message });
    } finally {
      setBusy(false);
    }
  }

  function setVisiblePixivSelection(selected) {
    const visibleIndexes = new Set(filterPixivItems(pixivState.items, pixivState).map(item => item.originalIndex));
    updatePixivState({
      items: pixivState.items.map((item, index) => (
        visibleIndexes.has(index) ? { ...item, selected } : item
      )),
    });
  }

  return {
    pixivState,
    updatePixivState,
    togglePixivItem,
    listPixivWorks,
    choosePixivFolder,
    downloadPixivWorks,
    addDownloadedPixivImages,
    setVisiblePixivSelection,
  };
}
