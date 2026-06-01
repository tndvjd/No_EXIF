const { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const {
  createPathAccessGuard,
  isAllowedJsonPath,
  isAllowedPngPath,
  isTrustedSenderUrl,
  normalizePath,
  validateCleanPngBuffer,
} = require('./security.cjs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pathGuard = createPathAccessGuard();
const APP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function isE2ERun() {
  return process.env.NOEXIF_E2E === '1' && process.argv.includes('--noexif-e2e');
}

async function e2eOutputPath(envName) {
  if (!isE2ERun()) return '';
  const targetPath = process.env[envName];
  if (!targetPath) return '';
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  return pathGuard.rememberGeneratedOutput(targetPath);
}

async function e2eOutputDirectory(envName) {
  if (!isE2ERun()) return '';
  const targetPath = process.env[envName];
  if (!targetPath) return '';
  await fs.promises.mkdir(targetPath, { recursive: true });
  return pathGuard.rememberDirectory(targetPath);
}

function assertTrustedSender(event) {
  const url = event.senderFrame?.url || event.sender?.getURL?.() || '';
  if (!isTrustedSenderUrl(url)) {
    throw new Error('Untrusted renderer origin.');
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'noexif',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function registerLocalAppProtocol() {
  protocol.handle('noexif', async request => {
    const url = new URL(request.url);
    const assetPath = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const filePath = path.normalize(path.join(DIST, assetPath));
    const relative = path.relative(DIST, filePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'Content-Security-Policy': APP_CONTENT_SECURITY_POLICY,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const response = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', APP_CONTENT_SECURITY_POLICY);
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}

function resolvePythonCommand() {
  const venvPython = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPython)) {
    return { command: venvPython, argsPrefix: [] };
  }
  return { command: 'py', argsPrefix: ['-3'] };
}

function runBridge(command, payload) {
  return new Promise((resolve, reject) => {
    const python = resolvePythonCommand();
    const child = spawn(
      python.command,
      [...python.argsPrefix, path.join(ROOT, 'tools', 'noexif_bridge.py'), command],
      {
        cwd: ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', code => {
      try {
        const parsed = stdout ? JSON.parse(stdout) : {};
        if (code !== 0 || parsed.ok === false) {
          reject(new Error(parsed.error || stderr || `Bridge exited with code ${code}`));
          return;
        }
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Bridge returned invalid JSON: ${error.message}\n${stderr}`));
      }
    });
    child.stdin.write(JSON.stringify(payload || {}));
    child.stdin.end();
  });
}

function runPixivBridge(command, payload) {
  return new Promise((resolve, reject) => {
    const python = resolvePythonCommand();
    const child = spawn(
      python.command,
      [...python.argsPrefix, path.join(ROOT, 'tools', 'pixiv_bridge.py'), command],
      {
        cwd: ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', code => {
      try {
        const parsed = stdout ? JSON.parse(stdout) : {};
        if (code !== 0 || parsed.ok === false) {
          reject(new Error(parsed.error || stderr || `Pixiv bridge exited with code ${code}`));
          return;
        }
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Pixiv bridge returned invalid JSON: ${error.message}\n${stderr}`));
      }
    });
    child.stdin.write(JSON.stringify(payload || {}));
    child.stdin.end();
  });
}

function decodePngPayload(payload) {
  const bytes = payload?.pngBytes;
  if (bytes instanceof Uint8Array) return Buffer.from(bytes);
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
  if (Array.isArray(bytes)) return Buffer.from(bytes);
  if (bytes && typeof bytes === 'object' && Array.isArray(bytes.data)) return Buffer.from(bytes.data);
  if (typeof payload?.pngDataUrl === 'string') {
    const match = payload.pngDataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!match) throw new Error('Prompt card payload must be a PNG data URL.');
    return Buffer.from(match[1], 'base64');
  }
  throw new Error('Prompt card PNG payload is required.');
}

function e2ePixivItems() {
  const baseItems = [
    {
      illustId: 144721221,
      title: 'E2E Pixiv sample',
      url: 'https://i.pximg.net/test/144721221.jpg',
      fileName: '001_144721221.jpg',
      resolution: '1344 x 1728',
      pageCount: 1,
      sizeBytes: 2900000,
      selected: true,
    },
    {
      illustId: 144721908,
      title: 'E2E second sample',
      url: 'https://i.pximg.net/test/144721908.jpg',
      fileName: '002_144721908.jpg',
      resolution: '1536 x 2048',
      pageCount: 1,
      sizeBytes: 3300000,
      selected: true,
    },
    {
      illustId: 144722310,
      title: 'E2E manga sample',
      url: 'https://i.pximg.net/test/144722310_p0.png',
      fileName: '003_144722310_p0.png',
      resolution: '1024 x 1536',
      pageCount: 3,
      sizeBytes: 4100000,
      selected: true,
    },
  ];
  const requestedCount = Math.max(3, Math.min(Number(process.env.NOEXIF_E2E_PIXIV_ITEM_COUNT || baseItems.length), 120));
  return Array.from({ length: requestedCount }, (_, index) => {
    const base = baseItems[index % baseItems.length];
    const illustId = Number(base.illustId) + index;
    const extension = path.extname(base.fileName || '.jpg') || '.jpg';
    return {
      ...base,
      illustId,
      title: `${base.title} ${index + 1}`,
      fileName: `${String(index + 1).padStart(3, '0')}_${illustId}${extension}`,
    };
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1160,
    minHeight: 760,
    backgroundColor: '#0f1115',
    title: 'No EXIF Pro',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL('noexif://app/index.html');
}

app.whenReady().then(() => {
  registerLocalAppProtocol();

  ipcMain.handle('images:select', async event => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog({
      title: '이미지 선택',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tif', 'tiff', 'webp', 'gif'] },
      ],
    });
    if (result.canceled) return [];
    for (const filePath of result.filePaths) pathGuard.rememberPath(filePath);
    return result.filePaths;
  });

  ipcMain.handle('bridge:inspect', async (event, input) => {
    assertTrustedSender(event);
    const payload = Array.isArray(input)
      ? { paths: input }
      : {
          ...((input && typeof input === 'object') ? input : {}),
          paths: (input && typeof input === 'object' && Array.isArray(input.paths)) ? input.paths : [],
        };
    const result = await runBridge('inspect', payload);
    for (const item of result.items || []) {
      if (item.path) pathGuard.rememberPath(item.path);
    }
    return result;
  });

  ipcMain.handle('bridge:preview', async (event, input) => {
    assertTrustedSender(event);
    const imagePath = normalizePath(typeof input === 'string' ? input : input?.path || '');
    if (!pathGuard.isAllowed(imagePath)) {
      throw new Error('Preview path was not selected in this session.');
    }
    return runBridge('preview', { path: imagePath });
  });

  ipcMain.handle('export:saveDialog', async (event, defaultFormat) => {
    assertTrustedSender(event);
    const e2ePath = await e2eOutputPath('NOEXIF_E2E_GRID_OUTPUT_PATH');
    if (e2ePath) return e2ePath;

    const extension = defaultFormat === 'webp' ? 'webp' : defaultFormat === 'jpeg' ? 'jpg' : 'png';
    const result = await dialog.showSaveDialog({
      title: '그리드 이미지 저장',
      defaultPath: path.join(app.getPath('desktop'), `NOEXIF_layout.${extension}`),
      filters: [
        { name: 'PNG', extensions: ['png'] },
        { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
        { name: 'WebP', extensions: ['webp'] },
      ],
    });
    if (result.canceled) return null;
    return pathGuard.rememberGeneratedOutput(result.filePath);
  });

  ipcMain.handle('exif:outputDirectory', async event => {
    assertTrustedSender(event);
    const e2eDir = await e2eOutputDirectory('NOEXIF_E2E_EXIF_PARENT_DIR');
    if (e2eDir) return e2eDir;

    const result = await dialog.showOpenDialog({
      title: 'EXIF 제거 파일을 저장할 폴더 선택',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return pathGuard.rememberDirectory(result.filePaths[0]);
  });

  ipcMain.handle('bridge:removeExif', async (event, payload) => {
    assertTrustedSender(event);
    const outputDir = normalizePath(payload?.outputDir || '');
    if (!pathGuard.isAllowed(outputDir) && isE2ERun()) {
      pathGuard.rememberDirectory(outputDir);
    }
    if (!pathGuard.isAllowed(outputDir)) {
      throw new Error('Output directory was not selected in this session.');
    }
    const result = await runBridge('remove-exif', { ...payload, outputDir });
    if (result.outputDir) pathGuard.rememberDirectory(result.outputDir);
    for (const outputPath of result.outputPaths || []) pathGuard.rememberGeneratedOutput(outputPath);
    return result;
  });

  ipcMain.handle('bridge:export', async (event, payload) => {
    assertTrustedSender(event);
    const outputPath = normalizePath(payload?.outputPath || '');
    if (!pathGuard.isAllowed(outputPath) && isE2ERun()) {
      pathGuard.rememberGeneratedOutput(outputPath);
    }
    if (!pathGuard.isAllowed(outputPath)) {
      throw new Error('Export path was not selected in this session.');
    }
    const result = await runBridge('export', { ...payload, outputPath });
    if (result.outputPath) pathGuard.rememberGeneratedOutput(result.outputPath);
    return result;
  });

  ipcMain.handle('pixiv:chooseOutputDirectory', async event => {
    assertTrustedSender(event);
    const e2eDir = await e2eOutputDirectory('NOEXIF_E2E_PIXIV_OUTPUT_DIR');
    if (e2eDir) return e2eDir;

    const result = await dialog.showOpenDialog({
      title: 'Pixiv 이미지를 저장할 폴더 선택',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return pathGuard.rememberDirectory(result.filePaths[0]);
  });

  ipcMain.handle('pixiv:list', async (event, payload) => {
    assertTrustedSender(event);
    if (isE2ERun()) {
      return { ok: true, userId: '73211891', items: e2ePixivItems() };
    }
    return runPixivBridge('list', payload);
  });

  ipcMain.handle('pixiv:download', async (event, payload) => {
    assertTrustedSender(event);
    const outputDir = normalizePath(payload?.outputDir || '');
    if (!pathGuard.isAllowed(outputDir) && isE2ERun()) {
      pathGuard.rememberDirectory(outputDir);
    }
    if (!pathGuard.isAllowed(outputDir)) {
      throw new Error('Pixiv output directory was not selected in this session.');
    }
    if (isE2ERun()) {
      await fs.promises.mkdir(outputDir, { recursive: true });
      const results = [];
      for (const item of payload?.items || []) {
        const outputPath = path.join(outputDir, path.basename(item.fileName || 'pixiv-e2e.jpg'));
        await fs.promises.writeFile(outputPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        pathGuard.rememberGeneratedOutput(outputPath);
        pathGuard.rememberPath(outputPath);
        results.push({ status: 'downloaded', fileName: path.basename(outputPath), path: outputPath, sizeBytes: 4, message: 'e2e' });
      }
      return { ok: true, results };
    }
    const result = await runPixivBridge('download', { ...payload, outputDir });
    for (const item of result.results || []) {
      if (item.path) {
        pathGuard.rememberPath(item.path);
        pathGuard.rememberGeneratedOutput(item.path);
      }
    }
    return result;
  });

  ipcMain.handle('shell:openPath', async (event, targetPath) => {
    assertTrustedSender(event);
    if (!targetPath) return { ok: false, error: 'Path is required.' };
    if (!pathGuard.isAllowedToOpen(targetPath)) return { ok: false, error: 'Path is not allowed.' };
    if (isE2ERun()) return { ok: true, e2e: true };
    const error = await shell.openPath(targetPath);
    return error ? { ok: false, error } : { ok: true };
  });

  ipcMain.handle('shell:showItemInFolder', async (event, targetPath) => {
    assertTrustedSender(event);
    if (!targetPath) return { ok: false, error: 'Path is required.' };
    if (!pathGuard.isAllowedToOpen(targetPath)) return { ok: false, error: 'Path is not allowed.' };
    if (!fs.existsSync(targetPath)) return { ok: false, error: 'Path does not exist.' };
    if (isE2ERun()) return { ok: true, e2e: true };
    shell.showItemInFolder(targetPath);
    return { ok: true };
  });

  ipcMain.handle('metadata:saveJson', async (event, payload) => {
    assertTrustedSender(event);
    const fallbackName = payload?.name ? `${path.parse(payload.name).name}.metadata.json` : 'metadata.json';
    const outputPath = await (async () => {
      if (isE2ERun() && payload?.outputPath) {
        return pathGuard.rememberGeneratedOutput(payload.outputPath);
      }
      const e2ePath = await e2eOutputPath('NOEXIF_E2E_METADATA_JSON_PATH');
      if (e2ePath) return e2ePath;

      const result = await dialog.showSaveDialog({
        title: '메타데이터 JSON 저장',
        defaultPath: path.join(app.getPath('documents'), fallbackName),
        filters: [
          { name: 'JSON', extensions: ['json'] },
        ],
      });
      if (result.canceled) return null;
      return pathGuard.rememberGeneratedOutput(result.filePath);
    })();
    if (!outputPath) return null;
    if (!isAllowedJsonPath(outputPath)) {
      throw new Error('Metadata output must be a .json file.');
    }
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, JSON.stringify(payload?.metadata || payload, null, 2), 'utf8');
    return outputPath;
  });

  ipcMain.handle('prompt-card:savePng', async (event, payload) => {
    assertTrustedSender(event);
    const outputPath = await (async () => {
      if (isE2ERun() && process.env.NOEXIF_E2E_PROMPT_CARD_OUTPUT_PATH) {
        const targetPath = normalizePath(process.env.NOEXIF_E2E_PROMPT_CARD_OUTPUT_PATH);
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
        return pathGuard.rememberPath(targetPath);
      }

      const fallbackName = payload?.defaultName || `PROMPT_CARD_${Date.now()}.png`;
      const result = await dialog.showSaveDialog({
        title: '프롬프트 카드 저장',
        defaultPath: path.join(app.getPath('pictures'), fallbackName),
        filters: [
          { name: 'PNG', extensions: ['png'] },
        ],
      });
      if (result.canceled) return null;
      return pathGuard.rememberPath(result.filePath);
    })();
    if (!outputPath) return null;
    if (!isAllowedPngPath(outputPath)) {
      throw new Error('Prompt card output must be a .png file.');
    }

    const pngBuffer = decodePngPayload(payload);
    const before = validateCleanPngBuffer(pngBuffer);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, pngBuffer);
    const after = validateCleanPngBuffer(await fs.promises.readFile(outputPath));
    return {
      ok: true,
      outputPath,
      width: after.width,
      height: after.height,
      chunks: after.chunks,
      exifCount: before.chunks.includes('eXIf') ? 1 : 0,
    };
  });

  ipcMain.handle('template:save', async (event, payload) => {
    assertTrustedSender(event);
    const e2ePath = await e2eOutputPath('NOEXIF_E2E_TEMPLATE_SAVE_PATH');
    if (e2ePath) {
      await fs.promises.writeFile(e2ePath, JSON.stringify(payload, null, 2), 'utf8');
      return e2ePath;
    }

    const result = await dialog.showSaveDialog({
      title: '레이아웃 템플릿 저장',
      defaultPath: path.join(app.getPath('documents'), 'No EXIF Layout.noexif-template.json'),
      filters: [
        { name: 'No EXIF Template', extensions: ['json'] },
      ],
    });
    if (result.canceled) return null;
    pathGuard.rememberGeneratedOutput(result.filePath);
    await fs.promises.writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
    return result.filePath;
  });

  ipcMain.handle('template:load', async event => {
    assertTrustedSender(event);
    if (isE2ERun() && process.env.NOEXIF_E2E_TEMPLATE_LOAD_PATH) {
      pathGuard.rememberPath(process.env.NOEXIF_E2E_TEMPLATE_LOAD_PATH);
      const raw = await fs.promises.readFile(process.env.NOEXIF_E2E_TEMPLATE_LOAD_PATH, 'utf8');
      return JSON.parse(raw);
    }

    const result = await dialog.showOpenDialog({
      title: '레이아웃 템플릿 불러오기',
      properties: ['openFile'],
      filters: [
        { name: 'No EXIF Template', extensions: ['json'] },
      ],
    });
    if (result.canceled || !result.filePaths.length) return null;
    pathGuard.rememberPath(result.filePaths[0]);
    const raw = await fs.promises.readFile(result.filePaths[0], 'utf8');
    return JSON.parse(raw);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
