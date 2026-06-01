export const initialSettings = {
  rows: 4,
  cols: 5,
  gap: 24,
  radius: 12,
  background: '#1f1e1c',
  width: 1600,
  height: 2000,
  format: 'png',
  quality: 95,
  roundCorners: true,
};

export const modeNotices = {
  exif: '체크한 이미지만 EXIF 제거 파일로 저장합니다. 원본은 그대로 유지됩니다.',
  grid: '이미지 순서와 캔버스 편집 내용이 그리드 결과에 반영됩니다.',
  metadata: 'ComfyUI workflow, prompt, EXIF, PNG 태그를 확인합니다.',
  'prompt-share': 'ComfyUI 프롬프트를 사진 위에 공유용 카드로 렌더링합니다.',
  pixiv: 'Pixiv에서 필요한 이미지만 골라 내려받고, No EXIF Pro 작업 목록으로 가져옵니다.',
};

export const pixivMockItems = [
  { illustId: 144721221, title: 'Midnight poolside study', fileName: '001_144721221.jpg', resolution: '1344 x 1728', pageCount: 1, sizeBytes: 2_900_000, selected: true, preview: 'linear-gradient(135deg, #16191e 0%, #473f31 48%, #e4b85e 100%)' },
  { illustId: 144721908, title: 'Soft window portrait', fileName: '002_144721908.png', resolution: '1344 x 1728', pageCount: 1, sizeBytes: 3_120_000, selected: true, preview: 'linear-gradient(135deg, #5c4f43 0%, #d8c1aa 55%, #f5e8dd 100%)' },
  { illustId: 144722310, title: 'City light sequence', fileName: '003_144722310_p0.jpg', resolution: '1536 x 2048', pageCount: 4, sizeBytes: 4_480_000, selected: true, preview: 'linear-gradient(135deg, #15191e 0%, #323128 48%, #f0c16a 100%)' },
  { illustId: 144722870, title: 'Reference pose sheet', fileName: '004_144722870_p0.png', resolution: '1024 x 1536', pageCount: 2, sizeBytes: 2_420_000, selected: false, preview: 'linear-gradient(135deg, #2d2b29 0%, #74634f 44%, #d5b47f 100%)' },
  { illustId: 144723120, title: 'Neon alley draft', fileName: '005_144723120.jpg', resolution: '1216 x 1792', pageCount: 1, sizeBytes: 2_760_000, selected: true, preview: 'linear-gradient(135deg, #111317 0%, #4b3f2f 46%, #d8a84f 100%)' },
  { illustId: 144723881, title: 'Costume detail archive', fileName: '006_144723881.png', resolution: '1408 x 1856', pageCount: 1, sizeBytes: 3_660_000, selected: false, preview: 'linear-gradient(135deg, #27221d 0%, #8c7357 40%, #e7d6bd 100%)' },
];

export const IMPORT_IMAGE_LIMIT = 500;

export const initialPixivState = {
  refreshToken: '',
  target: 'https://www.pixiv.net/users/73211891/illustrations',
  limit: 48,
  timeout: 30,
  workers: 4,
  retries: 2,
  filter: '전체',
  query: '',
  outputDir: '',
  downloadMode: '선택한 이미지만',
  naming: '작품순_원본명',
  items: [],
  resultCounts: { downloaded: 0, skipped: 0, failed: 0 },
  downloadedPaths: [],
};

export const initialPromptSettings = {
  template: 'magazine',
  ratio: '4:5',
  width: 1080,
  height: 1350,
  title: 'PROMPT SHARE',
  brand: 'No EXIF Pro',
  handle: '@NoEXIFPro',
  promptMode: 'positive',
  readability: 'gradient',
  darken: 34,
  textScale: 100,
  lineHeight: 1.24,
  columns: 2,
  showModel: true,
  showLora: true,
  showSeed: true,
  showSteps: true,
  showCfg: true,
  showSampler: true,
  showQr: false,
};
