import { IMPORT_IMAGE_LIMIT } from './appConstants.js';

export function uniqueNewImagePaths(paths = [], knownPaths = []) {
  const known = new Set(knownPaths);
  return [...new Set(paths)].filter(path => !known.has(path));
}

export function decorateImportedImages(items = []) {
  return items.map(item => ({
    ...item,
    cropX: 0.5,
    cropY: 0.5,
    removeExif: true,
  }));
}

export function buildImageImportToast(result = {}, options = {}) {
  const items = result.items || [];
  const failures = result.failures || [];
  const failed = failures.length;
  const truncated = Boolean(result.truncated);
  const limit = result.limit || options.limit || IMPORT_IMAGE_LIMIT;
  const fileBaseName = options.fileBaseName || (value => value);
  const failedNames = failures
    .slice(0, 3)
    .map(failure => fileBaseName(failure.path))
    .filter(Boolean);
  const failureDetail = failedNames.length
    ? `${failedNames.join(', ')}${failed > failedNames.length ? ` 외 ${failed - failedNames.length}개` : ''} 파일은 지원하지 않거나 손상되어 건너뛰었습니다.`
    : '지원하지 않거나 손상된 파일은 건너뛰었습니다.';
  const truncatedDetail = `폴더가 커서 먼저 ${limit}개 파일까지만 확인했습니다. 필요하면 나눠서 다시 불러오세요.`;

  return {
    type: failed || truncated ? 'warning' : 'success',
    title: failed || truncated
      ? `이미지 ${items.length}장 추가${failed ? ` · 실패 ${failed}장` : ''}${truncated ? ' · 일부만 확인' : ''}`
      : `이미지 ${items.length}장을 추가했습니다.`,
    detail: truncated ? truncatedDetail : failed ? failureDetail : '이제 EXIF 제거, 그리드 생성, 메타데이터 확인에 사용할 수 있습니다.',
  };
}
