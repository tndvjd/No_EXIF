const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const { validateCleanPngBuffer } = require(path.join(ROOT, 'electron', 'security.cjs'));
const QA_SOURCE_DIR = 'C:/Users/cdg/Downloads/260515';
const OUT_DIR = path.join(ROOT, 'output', 'playwright', `e2e-${Date.now()}`);
const QA_OUTPUT_DIR = path.join(ROOT, 'output', 'qa');
const FIXTURE_DIR = path.join(ROOT, 'output', 'qa-fixtures');
const CAMERA_FIXTURE_DIR = path.join(ROOT, 'output', 'qa-fixtures-camera');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function exifFolderName(date = new Date()) {
  return `No_EXIF_Export_${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}

function pythonCommand() {
  const venvPython = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPython)) return { command: venvPython, prefix: [] };
  return { command: 'py', prefix: ['-3'] };
}

function createComfyFixture() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const fixturePath = path.join(FIXTURE_DIR, 'comfy_workflow_fixture.png');
  const python = pythonCommand();
  const code = `
import json
import sys
from PIL import Image
from PIL.PngImagePlugin import PngInfo

path = sys.argv[1]
prompt = {
    "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "qa_realisticVision.safetensors"}},
    "2": {"class_type": "KSampler", "inputs": {"sampler_name": "dpmpp_2m", "scheduler": "karras", "seed": 424242, "steps": 28, "cfg": 7.5, "denoise": 0.55}},
    "3": {"class_type": "Positive Prompt", "inputs": {"text": "QA alpine lake, premium local photo manager"}},
    "4": {"class_type": "Negative Prompt", "inputs": {"text": "blur, artifacts"}},
}
workflow = {"nodes": [{"id": 1, "type": "CheckpointLoaderSimple"}, {"id": 2, "type": "KSampler"}]}
pnginfo = PngInfo()
pnginfo.add_text("prompt", json.dumps(prompt))
pnginfo.add_text("workflow", json.dumps(workflow))
img = Image.new("RGB", (900, 600), (38, 92, 126))
for x in range(900):
    for y in range(600):
        img.putpixel((x, y), (38 + x % 90, 92 + y % 80, 126 + (x + y) % 80))
img.save(path, pnginfo=pnginfo)
`;
  const result = spawnSync(python.command, [...python.prefix, '-c', code, fixturePath], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return fixturePath.replaceAll('\\', '/');
}

function createUnsupportedFixture() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const fixturePath = path.join(FIXTURE_DIR, 'not_an_image.txt');
  fs.writeFileSync(fixturePath, 'this file intentionally verifies unsupported image handling', 'utf8');
  return fixturePath.replaceAll('\\', '/');
}

function createCameraExifFixture() {
  fs.mkdirSync(CAMERA_FIXTURE_DIR, { recursive: true });
  const fixturePath = path.join(CAMERA_FIXTURE_DIR, 'camera_exif_gps_fixture.jpg');
  const python = pythonCommand();
  const code = `
import sys
from PIL import Image
from PIL.TiffImagePlugin import IFDRational

path = sys.argv[1]
img = Image.new("RGB", (900, 1200), (116, 84, 54))
for x in range(900):
    for y in range(1200):
        if (x // 80 + y // 80) % 2 == 0:
            img.putpixel((x, y), (146, 110, 72))
exif = Image.Exif()
exif[271] = "QA Camera Make"
exif[272] = "QA Camera Model"
exif[305] = "No EXIF Pro QA"
exif[274] = 6
exif[34853] = {
    1: "N",
    2: (IFDRational(37, 1), IFDRational(46, 1), IFDRational(30, 1)),
    3: "E",
    4: (IFDRational(122, 1), IFDRational(25, 1), IFDRational(10, 1)),
}
img.save(path, quality=94, exif=exif)
`;
  const result = spawnSync(python.command, [...python.prefix, '-c', code, fixturePath], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return fixturePath.replaceAll('\\', '/');
}

function createPhotoFixture(index) {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const fixturePath = path.join(FIXTURE_DIR, `fallback_photo_${index}.jpg`);
  const python = pythonCommand();
  const code = `
import sys
from PIL import Image, ImageDraw

path = sys.argv[1]
index = int(sys.argv[2])
colors = [((82, 154, 214), (246, 196, 89)), ((205, 102, 79), (48, 52, 68)), ((74, 171, 135), (111, 103, 194))]
primary, secondary = colors[index % len(colors)]
img = Image.new("RGB", (900, 1200), primary)
draw = ImageDraw.Draw(img)
for y in range(0, 1200, 80):
    draw.rectangle((0, y, 900, y + 38), fill=tuple(min(255, c + (y // 80) * 4) for c in primary))
for x in range(-300, 900, 90):
    draw.polygon([(x, 1200), (x + 420, 0), (x + 500, 0), (x + 80, 1200)], fill=secondary)
draw.ellipse((220, 330, 680, 790), outline=(255, 255, 255), width=16)
img.save(path, quality=94)
`;
  const result = spawnSync(python.command, [...python.prefix, '-c', code, fixturePath, String(index)], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return fixturePath.replaceAll('\\', '/');
}

function qaImages() {
  const files = [createCameraExifFixture()];
  const realFiles = fs.existsSync(QA_SOURCE_DIR)
    ? fs.readdirSync(QA_SOURCE_DIR)
      .filter(name => /\.(png|jpe?g|webp)$/i.test(name))
      .sort()
      .slice(0, 3)
      .map(name => path.join(QA_SOURCE_DIR, name).replaceAll('\\', '/'))
    : [];
  for (const file of realFiles) {
    if (!files.includes(file)) files.push(file);
  }
  while (files.length < 3) {
    files.push(createPhotoFixture(files.length));
  }
  return files.slice(0, 3);
}

async function dropPaths(page, paths) {
  await page.evaluate((nextPaths) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', nextPaths.join('\n'));
    document.querySelector('.app-shell').dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    }));
  }, paths);
}

async function expectText(page, selector, pattern) {
  assert.match(await page.locator(selector).textContent(), pattern);
}

async function assertStatusbarHasNoMojibake(page, label) {
  const result = await page.evaluate(() => {
    const text = document.body?.textContent || '';
    const suspicious = ['�', '泥', '濡', '쨌', '遺덈', '洹몃', '꾨＼', '뺄', '먮낯'];
    const suspiciousRanges = /[\u0080-\u009F\u3400-\u9FFF\uF900-\uFAFF]/u;
    return {
      text: text.slice(0, 500),
      found: [
        ...suspicious.filter(token => text.includes(token)),
        ...(suspiciousRanges.test(text) ? ['cjk-mojibake-range'] : []),
      ],
    };
  });
  assert.deepEqual(result.found, [], `${label} page has mojibake: ${JSON.stringify(result)}`);
}

async function assertModeRailAlignment(page, label) {
  const result = await page.evaluate(() => {
    const activeButton = document.querySelector('.rail-button.is-active');
    const activeIcon = activeButton?.querySelector('.rail-icon-wrapper');
    const activeLine = activeButton?.querySelector('.rail-active-line');
    const floatingPill = document.querySelector('.rail-active-pill');
    const buttonRect = activeButton?.getBoundingClientRect();
    const iconRect = activeIcon?.getBoundingClientRect();
    const lineRect = activeLine?.getBoundingClientRect();
    if (!buttonRect || !iconRect || !lineRect) {
      return {
        ok: false,
        reason: 'missing active rail geometry',
        hasFloatingPill: Boolean(floatingPill),
      };
    }

    const centerDeltaX = Math.abs((buttonRect.left + buttonRect.width / 2) - (iconRect.left + iconRect.width / 2));
    const lineInsideButton = lineRect.left >= buttonRect.left - 1 && lineRect.right <= buttonRect.right + 1;
    return {
      ok: true,
      hasFloatingPill: Boolean(floatingPill),
      buttonWidth: buttonRect.width,
      buttonHeight: buttonRect.height,
      iconWidth: iconRect.width,
      iconHeight: iconRect.height,
      centerDeltaX,
      lineInsideButton,
    };
  });

  assert.equal(result.ok, true, `${label} mode rail geometry missing: ${JSON.stringify(result)}`);
  assert.equal(result.hasFloatingPill, false, `${label} mode rail uses a detached active pill: ${JSON.stringify(result)}`);
  assert.ok(result.centerDeltaX <= 1.5, `${label} mode rail icon is not centered in its button: ${JSON.stringify(result)}`);
  assert.equal(result.lineInsideButton, true, `${label} mode rail active line escapes the button: ${JSON.stringify(result)}`);
  assert.ok(result.iconWidth >= 30 && result.iconWidth <= 38, `${label} mode rail icon box width is off: ${JSON.stringify(result)}`);
  assert.ok(result.buttonWidth >= 64 && result.buttonWidth <= 78, `${label} mode rail button width is off: ${JSON.stringify(result)}`);
}

async function assertActiveRailMode(page, expectedMode, label) {
  const activeModes = await page.locator('.rail-button.is-active').evaluateAll(buttons => (
    buttons.map(button => button.getAttribute('data-mode'))
  ));
  assert.deepEqual(activeModes, [expectedMode], `${label} active rail mode mismatch`);
}

async function assertNoLocalProcessingCopy(page, label) {
  const text = await page.locator('body').textContent();
  assert.doesNotMatch(text, /로컬 처리|로컬에서|LOCAL/, `${label} repeats unnecessary local-processing copy`);
}

async function assertNoLocalCommandCopy(page, label) {
  const text = await page.locator('.command-palette-panel').textContent();
  assert.doesNotMatch(text, /로컬 처리|로컬에서|LOCAL|Local image/i, `${label} repeats unnecessary local command copy`);
}

async function assertNoHorizontalOverflow(page, label) {
  const result = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    appWidth: Math.ceil(document.querySelector('.app-shell')?.getBoundingClientRect().width || 0),
    overflowingContainers: Array.from(document.querySelectorAll('.panel, .inspector, .metadata-preview, .grid-canvas-column, .preview-panel'))
      .filter(element => element.scrollWidth > element.clientWidth + 2)
      .map(element => ({
        className: element.className,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
    hiddenTexts: Array.from(document.querySelectorAll('button, .brand-block strong, .brand-block span, .panel-header h2'))
      .filter(element => element.scrollWidth > element.clientWidth + 2)
      .map(element => element.textContent.trim()),
    clippedInputs: Array.from(document.querySelectorAll('.folder-name-input'))
      .filter(element => element.scrollWidth > element.clientWidth + 2)
      .map(element => element.value),
    clippedMetadataValues: Array.from(document.querySelectorAll('.metadata-info .info-table strong'))
      .filter(element => element.scrollWidth > element.clientWidth + 2)
      .map(element => element.textContent.trim()),
    blockedPrimaryActions: (() => {
      const statusbar = document.querySelector('.statusbar')?.getBoundingClientRect();
      if (!statusbar) return [];
      return Array.from(document.querySelectorAll('.primary-cta, .export-button'))
        .filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.bottom > statusbar.top - 2;
        })
        .map(element => element.textContent.trim());
    })(),
    stickyCoveredControls: (() => {
      const sticky = document.querySelector('.export-section')?.getBoundingClientRect();
      const scroll = document.querySelector('.inspector-scroll')?.getBoundingClientRect();
      if (!sticky) return [];
      return Array.from(document.querySelectorAll('.inspector-scroll .inspector-section button, .inspector-scroll .inspector-section input, .inspector-scroll .inspector-section select'))
        .filter(element => {
          const rect = element.getBoundingClientRect();
          const overlaps = sticky.left < rect.right && sticky.right > rect.left && sticky.top < rect.bottom && sticky.bottom > rect.top;
          if (!overlaps || rect.width <= 0 || rect.height <= 0) return false;
          if (!scroll) return true;
          const visibleTop = Math.max(rect.top, scroll.top);
          const visibleBottom = Math.min(rect.bottom, scroll.bottom);
          const visibleHeight = visibleBottom - visibleTop;
          if (visibleHeight < Math.min(12, rect.height * 0.5)) return false;
          const sampleX = Math.min(rect.right - 1, Math.max(rect.left + 1, (rect.left + rect.right) / 2));
          const sampleY = Math.min(visibleBottom - 1, Math.max(visibleTop + 1, (visibleTop + visibleBottom) / 2));
          const topElement = document.elementFromPoint(sampleX, sampleY);
          return topElement?.closest?.('.export-section') !== null;
        })
        .map(element => element.textContent.trim() || element.getAttribute('aria-label') || element.getAttribute('type') || element.tagName);
    })(),
    toastBlockedActions: (() => {
      const toast = document.querySelector('.toast')?.getBoundingClientRect();
      if (!toast) return [];
      return Array.from(document.querySelectorAll('.metadata-actions, .merge-tools, .primary-cta, .export-button'))
        .filter(element => {
          const rect = element.getBoundingClientRect();
          const horizontallyOverlaps = toast.left < rect.right && toast.right > rect.left;
          const verticallyOverlaps = toast.top < rect.bottom && toast.bottom > rect.top;
          return horizontallyOverlaps && verticallyOverlaps;
        })
        .map(element => element.className || element.textContent.trim());
    })(),
  }));
  assert.ok(
    result.scrollWidth <= result.innerWidth + 2,
    `${label} has horizontal overflow: ${JSON.stringify(result)}`,
  );
  assert.deepEqual(result.overflowingContainers, [], `${label} has internal panel overflow: ${JSON.stringify(result.overflowingContainers)}`);
  assert.deepEqual(result.hiddenTexts, [], `${label} has clipped key text: ${JSON.stringify(result.hiddenTexts)}`);
  assert.deepEqual(result.clippedInputs, [], `${label} has clipped input values: ${JSON.stringify(result.clippedInputs)}`);
  assert.deepEqual(result.clippedMetadataValues, [], `${label} has clipped metadata values: ${JSON.stringify(result.clippedMetadataValues)}`);
  assert.deepEqual(result.blockedPrimaryActions, [], `${label} has primary action blocked by statusbar: ${JSON.stringify(result.blockedPrimaryActions)}`);
  assert.deepEqual(result.stickyCoveredControls, [], `${label} has sticky export covering controls: ${JSON.stringify(result.stickyCoveredControls)}`);
  assert.deepEqual(result.toastBlockedActions, [], `${label} has toast over action controls: ${JSON.stringify(result.toastBlockedActions)}`);
}

async function captureResponsiveScreens(page, prefix) {
  const viewports = [
    { name: '1280x800', width: 1280, height: 800 },
    { name: '1500x940', width: 1500, height: 940 },
    { name: '1920x1080', width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(350);
    await assertNoHorizontalOverflow(page, `${prefix}-${viewport.name}`);
    await page.screenshot({
      path: path.join(OUT_DIR, `${prefix}-${viewport.name}.png`),
      fullPage: true,
    });
  }
}

async function assertMinimumWindowLayout(page) {
  await page.setViewportSize({ width: 1160, height: 760 });
  await page.waitForTimeout(350);
  await assertNoHorizontalOverflow(page, 'grid-minimum-1160x760');
  const stickyState = await page.evaluate(() => {
    const inspector = document.querySelector('.inspector')?.getBoundingClientRect();
    const exportSection = document.querySelector('.export-section')?.getBoundingClientRect();
    const statusbar = document.querySelector('.statusbar')?.getBoundingClientRect();
    if (!inspector || !exportSection || !statusbar) return null;
    return {
      inspectorHeight: inspector.height,
      exportHeight: exportSection.height,
      exportAboveStatusbar: exportSection.bottom <= statusbar.top + 2,
      exportShare: exportSection.height / inspector.height,
    };
  });
  assert.ok(stickyState, 'minimum viewport should expose inspector geometry');
  assert.equal(stickyState.exportAboveStatusbar, true, JSON.stringify(stickyState));
  assert.ok(stickyState.exportShare <= 0.32, JSON.stringify(stickyState));
  await page.screenshot({
    path: path.join(OUT_DIR, 'grid-1160x760-minimum.png'),
    fullPage: true,
  });
}

async function assertCommandPaletteFlow(page) {
  await page.keyboard.press('Control+K');
  await page.waitForSelector('.command-palette-panel', { timeout: 10000 });
  await expectText(page, '.command-palette-panel', /이미지 추가/);
  await assertNoLocalCommandCopy(page, 'command-palette');
  assert.equal(await page.locator('.command-row kbd').count(), 0);
  assert.equal(await page.locator('.command-palette-search input').evaluate(element => document.activeElement === element), true);
  assert.equal(await page.locator('.command-palette-search input').getAttribute('aria-activedescendant'), 'command-option-add-images');
  await page.screenshot({ path: path.join(OUT_DIR, '00-command-palette.png'), fullPage: true });

  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('.command-palette-search input').getAttribute('aria-activedescendant'), 'command-option-import-pixiv');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.command-palette-panel').evaluate(element => element.contains(document.activeElement)), true);
  await page.locator('.command-palette-search input').focus();
  await page.locator('.command-palette-search input').fill('metadata');
  await expectText(page, '.command-palette-panel', /메타데이터|metadata/i);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.command-palette-panel', { state: 'detached', timeout: 10000 });

  await page.locator('.command-hint').click();
  await page.waitForSelector('.command-palette-panel', { timeout: 10000 });
  assert.equal(await page.locator('.command-palette-search input').inputValue(), '');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.command-palette-panel', { state: 'detached', timeout: 10000 });
  assert.equal(await page.locator('.command-hint').evaluate(element => document.activeElement === element), true);
}

async function waitForFileSystem(assertion, timeoutMs = 10000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = assertion();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (lastError) throw lastError;
  throw new Error('Timed out waiting for file system state');
}

async function gridInteractionPoints(page) {
  const geometry = await page.evaluate(() => {
    const wrap = document.querySelector('.stage-wrap')?.getBoundingClientRect();
    const canvas = document.querySelector('.stage-wrap canvas')?.getBoundingClientRect();
    if (!wrap || !canvas) return null;
    return {
      wrap: {
        x: wrap.x,
        y: wrap.y,
        width: wrap.width,
        height: wrap.height,
      },
      canvas: {
        x: canvas.x,
        y: canvas.y,
        width: canvas.width,
        height: canvas.height,
      },
    };
  });
  assert.ok(geometry, 'Grid canvas should be visible');

  const settings = {
    width: 1600,
    height: 2000,
    rows: 4,
    cols: 5,
    gap: 24,
  };
  const maxW = Math.max(420, geometry.wrap.width - 80);
  const maxH = Math.max(420, geometry.wrap.height - 120);
  const aspect = settings.width / settings.height;
  let canvasW = maxW;
  let canvasH = canvasW / aspect;
  if (canvasH > maxH) {
    canvasH = maxH;
    canvasW = canvasH * aspect;
  }

  const scale = canvasW / settings.width;
  const gap = Math.max(2, settings.gap * scale);
  const unitW = (canvasW - (settings.cols + 1) * gap) / settings.cols;
  const unitH = (canvasH - (settings.rows + 1) * gap) / settings.rows;
  const offsetX = (geometry.wrap.width - canvasW) / 2;
  const offsetY = 38;
  const originX = geometry.canvas.x + offsetX;
  const originY = geometry.canvas.y + offsetY;
  const firstLeft = gap;
  const firstTop = gap;
  const stepX = unitW + gap;
  const stepY = unitH + gap;

  return {
    firstCenter: {
      x: originX + firstLeft + unitW / 2,
      y: originY + firstTop + unitH / 2,
    },
    secondCenter: {
      x: originX + firstLeft + stepX + unitW / 2,
      y: originY + firstTop + unitH / 2,
    },
    diagonalCenter: {
      x: originX + firstLeft + stepX + unitW / 2,
      y: originY + firstTop + stepY + unitH / 2,
    },
    mergedBottomRight: {
      x: originX + firstLeft + 2 * unitW + gap,
      y: originY + firstTop + unitH,
    },
    resizeToTwoByTwo: {
      x: originX + firstLeft + 2 * unitW + gap,
      y: originY + firstTop + 2 * unitH + gap,
    },
  };
}

async function firstTwoCellCentersFromCanvas(page) {
  const centers = await page.evaluate(() => {
    const wrap = document.querySelector('.stage-wrap')?.getBoundingClientRect();
    const canvases = Array.from(document.querySelectorAll('.stage-wrap canvas'));
    const canvas = canvases.find(item => item.width > 1 && item.height > 1)?.getBoundingClientRect();
    const title = document.querySelector('.canvas-title span')?.textContent || '';
    const zoomMatch = title.match(/(\d+)%/);
    const zoom = zoomMatch ? Number(zoomMatch[1]) / 100 : 1;
    if (!wrap || !canvas) return null;

    const settings = { width: 1600, height: 2000, rows: 4, cols: 5, gap: 24 };
    const maxW = Math.max(420, wrap.width - 80);
    const maxH = Math.max(420, wrap.height - 120);
    const aspect = settings.width / settings.height;
    let canvasW = maxW;
    let canvasH = canvasW / aspect;
    if (canvasH > maxH) {
      canvasH = maxH;
      canvasW = canvasH * aspect;
    }
    const scale = canvasW / settings.width;
    const gap = Math.max(2, settings.gap * scale);
    const unitW = (canvasW - (settings.cols + 1) * gap) / settings.cols;
    const unitH = (canvasH - (settings.rows + 1) * gap) / settings.rows;
    const localFirstX = gap + unitW / 2;
    const localFirstY = gap + unitH / 2;
    const localSecondX = gap + (unitW + gap) + unitW / 2;
    const groupLeft = canvas.left + (wrap.width - canvasW) / 2;
    const groupTop = canvas.top + 38;

    return {
      first: {
        x: groupLeft + localFirstX * zoom,
        y: groupTop + localFirstY * zoom,
      },
      second: {
        x: groupLeft + localSecondX * zoom,
        y: groupTop + localFirstY * zoom,
      },
    };
  });
  assert.ok(centers, 'Zoomed grid centers should be measurable');
  return centers;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_OUTPUT_DIR, { recursive: true });

  const comfyFixture = createComfyFixture();
  const unsupportedFixture = createUnsupportedFixture();
  const sourceImages = qaImages();
  const importedImages = [...sourceImages.slice(0, 2), comfyFixture];
  const uiExifParentDir = path.join(QA_OUTPUT_DIR, `ui-exif-parent-${Date.now()}`);
  const uiGridPath = path.join(QA_OUTPUT_DIR, `ui-grid-export-${Date.now()}.png`);
  const uiMetadataJsonPath = path.join(QA_OUTPUT_DIR, `ui-metadata-${Date.now()}.json`);
  const uiTemplatePath = path.join(QA_OUTPUT_DIR, `ui-template-${Date.now()}.json`);
  const uiPromptCardPath = path.join(QA_OUTPUT_DIR, `ui-prompt-card-${Date.now()}.png`);
  const uiPromptCardMagazinePath = uiPromptCardPath.replace(/\.png$/i, '-magazine.png');
  const uiPromptCardZinePath = uiPromptCardPath.replace(/\.png$/i, '-zine.png');
  const app = await electron.launch({
    args: ['.', '--noexif-e2e'],
    cwd: ROOT,
    env: {
      ...process.env,
      NOEXIF_E2E: '1',
      NOEXIF_E2E_EXIF_PARENT_DIR: uiExifParentDir,
      NOEXIF_E2E_GRID_OUTPUT_PATH: uiGridPath,
      NOEXIF_E2E_METADATA_JSON_PATH: uiMetadataJsonPath,
      NOEXIF_E2E_TEMPLATE_SAVE_PATH: uiTemplatePath,
      NOEXIF_E2E_TEMPLATE_LOAD_PATH: uiTemplatePath,
      NOEXIF_E2E_PROMPT_CARD_OUTPUT_PATH: uiPromptCardPath,
    },
  });
  const page = await app.firstWindow();
  const consoleIssues = [];
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('Electron Security Warning')) {
      consoleIssues.push(`[${msg.type()}] ${text}`);
    }
  });
  page.on('pageerror', error => consoleIssues.push(`[pageerror] ${error.message}`));

  try {
    await page.waitForSelector('.app-shell', { timeout: 20000 });
    await page.setViewportSize({ width: 1500, height: 940 });
    await assertStatusbarHasNoMojibake(page, 'initial');
    assert.equal(await page.locator('.rail-button').count(), 5);
    await assertModeRailAlignment(page, 'initial');
    await assertActiveRailMode(page, 'exif', 'initial');
    await assertNoLocalProcessingCopy(page, 'initial');
    await expectText(page, '.rail-button[data-mode="prompt-share"]', /프롬프트/);
    await expectText(page, '.rail-button[data-mode="pixiv"]', /Pixiv/);
    await assertCommandPaletteFlow(page);
    await page.locator('.rail-button[data-mode="pixiv"]').click();
    await page.waitForSelector('.pixiv-import-mode', { timeout: 10000 });
    await assertModeRailAlignment(page, 'pixiv');
    await assertActiveRailMode(page, 'pixiv', 'pixiv');
    await assertNoLocalProcessingCopy(page, 'pixiv');
    await assertStatusbarHasNoMojibake(page, 'pixiv');
    await expectText(page, '.pixiv-import-mode', /Pixiv 소스/);
    assert.doesNotMatch(
      await page.locator('.pixiv-import-mode').textContent(),
      /토큰은 계정 열쇠|다운로드 요청에만 사용|브리지|다운로드 엔진|UI 먼저 연결/,
    );
    await page.locator('.pixiv-field input[type="password"]').fill('e2e-refresh-token');
    await page.locator('.pixiv-primary').click();
    await page.waitForSelector('.pixiv-card', { timeout: 10000 });
    assert.equal(await page.locator('.pixiv-card').count(), 3);
    await page.screenshot({ path: path.join(OUT_DIR, '00-pixiv-import-ui.png'), fullPage: true });
    await page.locator('.rail-button[data-mode="exif"]').click();
    await page.waitForSelector('.exif-mode', { timeout: 10000 });
    await assertStatusbarHasNoMojibake(page, 'exif');
    await assertActiveRailMode(page, 'exif', 'exif');
    await page.screenshot({ path: path.join(OUT_DIR, '01-empty-exif.png'), fullPage: true });

    await dropPaths(page, [sourceImages[0], sourceImages[1], FIXTURE_DIR.replaceAll('\\', '/'), unsupportedFixture]);
    await page.waitForSelector('.exif-list-item', { timeout: 60000 });
    assert.equal(await page.locator('.exif-list-item').count(), 3);
    assert.ok((await page.locator('.exif-mode .panel-header button').first().textContent()).length > 0);
    assert.match(await page.locator('.toast').textContent(), /not_an_image|1/);
    assert.match(await page.locator('.toast').textContent(), /not_an_image\.txt/);
    assert.equal(await page.locator('.compare-divider').count(), 0, 'EXIF preview should not use before/after comparison divider');
    assert.equal(await page.locator('.single-preview-image').count(), 1, 'EXIF preview should show one selected image preview');
    assert.doesNotMatch(
      await page.locator('.preview-panel').textContent(),
      /__no_before_after_copy_expected__/,
      'EXIF preview copy should avoid before/after comparison language',
    );
    await captureResponsiveScreens(page, 'exif');
    await page.setViewportSize({ width: 1500, height: 940 });
    await page.screenshot({ path: path.join(OUT_DIR, '02-exif-imported.png'), fullPage: true });
    await page.locator('.selection-tools button').nth(1).click();
    assert.match(await page.locator('.panel-foot').textContent(), /0 \/ 3/);
    assert.equal(await page.locator('.primary-cta').isDisabled(), true);
    await page.locator('.selection-tools button').nth(0).click();
    assert.match(await page.locator('.panel-foot').textContent(), /3 \/ 3/);
    assert.equal(await page.locator('.primary-cta').isDisabled(), false);
    await page.locator('.exif-list-item').nth(1).locator('input[type="checkbox"]').uncheck();
    assert.match(await page.locator('.panel-foot').textContent(), /2 \/ 3/);
    await page.locator('.primary-cta').click();
    await page.waitForFunction(() => (document.querySelector('.toast')?.textContent || '').includes('완료'), null, { timeout: 10000 });
    const exifToastText = await page.locator('.toast').textContent();
    assert.ok(exifToastText.length > 0);
    assert.match(exifToastText, /2/);
    const uiExifDir = await waitForFileSystem(() => {
      if (!fs.existsSync(uiExifParentDir)) return null;
      const dirs = fs.readdirSync(uiExifParentDir)
        .filter(name => /^No_EXIF_Export_\d{4}-\d{2}-\d{2}_\d{4}$/.test(name))
        .map(name => path.join(uiExifParentDir, name));
      return dirs[0] || null;
    });
    const uiExifFiles = fs.readdirSync(uiExifDir).filter(name => /^NOEXIF_/.test(name));
    assert.equal(uiExifFiles.length, 2);
    const uiExifInspect = await page.evaluate(paths => window.noExif.inspectImages(paths), (
      uiExifFiles.map(name => path.join(uiExifDir, name).replaceAll('\\', '/'))
    ));
    assert.deepEqual(uiExifInspect.items.map(item => item.hasExif), [false, false]);
    await page.locator('.toast div button').click();
    await page.waitForSelector('.toast', { state: 'detached', timeout: 10000 });

    await page.evaluate(() => {
      const button = document.querySelector('.rail-button[data-mode="grid"]');
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    });
    await page.waitForFunction(() => document.querySelector('.app-shell')?.classList.contains('mode-grid'), null, { timeout: 10000 });
    await page.waitForSelector('.grid-mode .canvas-panel', { timeout: 10000 });
    await page.waitForSelector('.order-item', { timeout: 10000 });
    assert.equal(await page.locator('.order-item').count(), 3);
    assert.ok((await page.locator('.template-strip button').nth(0).textContent()).length > 0);
    assert.ok((await page.locator('.panel-header button').first().textContent()).length > 0);
    const originalOrderTitles = await page.locator('.order-item strong').evaluateAll(nodes => nodes.map(node => node.getAttribute('title')));
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.order-item'));
      const dt = new DataTransfer();
      items[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      items[2].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      items[2].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await page.waitForTimeout(150);
    assert.deepEqual(await page.locator('.order-item strong').evaluateAll(nodes => nodes.map(node => node.getAttribute('title'))), [
      originalOrderTitles[1],
      originalOrderTitles[2],
      originalOrderTitles[0],
    ]);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.order-item'));
      const dt = new DataTransfer();
      items[2].dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      items[0].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      items[0].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await page.waitForTimeout(150);
    assert.deepEqual(await page.locator('.order-item strong').evaluateAll(nodes => nodes.map(node => node.getAttribute('title'))), originalOrderTitles);
    await page.locator('.canvas-tools .tool-button').nth(3).click();
    assert.match(await page.locator('.canvas-title span').textContent(), /125%/);
    await page.locator('.canvas-tools .tool-button').nth(2).click();
    assert.ok((await page.locator('.canvas-hint').textContent()).length > 0);
    const zoomedCenters = await firstTwoCellCentersFromCanvas(page);
    const panDelta = { x: 34, y: 22 };
    await page.mouse.move(zoomedCenters.first.x, zoomedCenters.first.y);
    await page.mouse.down();
    await page.mouse.move(zoomedCenters.first.x + panDelta.x, zoomedCenters.first.y + panDelta.y, { steps: 8 });
    await page.mouse.up();
    await page.locator('.canvas-tools .tool-button').nth(0).click();
    assert.ok((await page.locator('.canvas-hint').textContent()).length > 0);
    await page.mouse.click(zoomedCenters.first.x + panDelta.x, zoomedCenters.first.y + panDelta.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(zoomedCenters.second.x + panDelta.x, zoomedCenters.second.y + panDelta.y);
    await page.keyboard.up('Shift');
    assert.match(await page.locator('.selected-summary').textContent(), /2.*선택/);
    assert.equal(await page.locator('.merge-tools button').nth(0).isDisabled(), false);
    await page.locator('.merge-tools button').nth(3).click();
    assert.ok((await page.locator('.selected-summary').textContent()).length > 0);
    await page.locator('.canvas-tools .tool-button').nth(4).click();
    assert.match(await page.locator('.canvas-title span').textContent(), /100%/);
    await page.waitForTimeout(150);
    assert.match(await page.locator('.snap-toggle').textContent(), /가이드\s*ON/);
    assert.ok((await page.locator('.merge-tools button').nth(3).textContent()).trim().length > 0);
    let gridPoints = await gridInteractionPoints(page);
    await page.mouse.click(gridPoints.firstCenter.x, gridPoints.firstCenter.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(gridPoints.diagonalCenter.x, gridPoints.diagonalCenter.y);
    await page.keyboard.up('Shift');
    assert.match(await page.locator('.warning-text').textContent(), /직사각형/);
    await page.locator('.merge-tools button').nth(0).click();
    assert.match(await page.locator('.toast').textContent(), /직사각형/);
    const toastCoversInspector = await page.evaluate(() => {
      const toast = document.querySelector('.toast')?.getBoundingClientRect();
      const inspector = document.querySelector('.inspector')?.getBoundingClientRect();
      if (!toast || !inspector) return false;
      const horizontallyOverlaps = toast.left < inspector.right && toast.right > inspector.left;
      const verticallyOverlaps = toast.top < inspector.bottom && toast.bottom > inspector.top;
      return horizontallyOverlaps && verticallyOverlaps;
    });
    assert.equal(toastCoversInspector, false, 'toast should not cover the grid inspector controls');
    await page.locator('.merge-tools button').nth(3).click();
    assert.ok((await page.locator('.selected-summary').textContent()).length > 0);

    gridPoints = await gridInteractionPoints(page);
    await page.mouse.click(gridPoints.firstCenter.x, gridPoints.firstCenter.y);
    assert.equal(await page.locator('.merge-tools button').nth(1).isDisabled(), true);
    await page.keyboard.down('Shift');
    await page.mouse.click(gridPoints.secondCenter.x, gridPoints.secondCenter.y);
    await page.keyboard.up('Shift');
    assert.equal(await page.locator('.merge-tools button').nth(0).isDisabled(), false);
    await page.locator('.merge-tools button').nth(0).click();
    await page.waitForTimeout(250);
    assert.match(await page.locator('.selected-summary').textContent(), /1.*선택/);
    gridPoints = await gridInteractionPoints(page);
    await page.mouse.move(gridPoints.mergedBottomRight.x, gridPoints.mergedBottomRight.y);
    await page.mouse.down();
    await page.mouse.move(gridPoints.resizeToTwoByTwo.x, gridPoints.resizeToTwoByTwo.y, { steps: 12 });
    await page.waitForTimeout(150);
    assert.match(await page.locator('.resize-tooltip').textContent(), /2 x 2/);
    await page.screenshot({ path: path.join(OUT_DIR, '03-grid-resize-preview.png'), fullPage: true });
    await page.mouse.up();
    const cropSection = page.locator('.inspector-section').nth(3);
    await page.waitForFunction(() => (
      document.querySelectorAll('.inspector-section')[3]?.querySelectorAll('input[type="range"]').length === 2
    ), null, { timeout: 5000 });
    const cropSliders = cropSection.locator('input[type="range"]');
    assert.equal(await cropSliders.count(), 2);
    await cropSliders.nth(0).evaluate(input => {
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setValue.call(input, '0.2');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await cropSliders.nth(1).evaluate(input => {
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setValue.call(input, '0.8');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    assert.match(await cropSection.textContent(), /20%/);
    assert.match(await cropSection.textContent(), /80%/);
    await cropSection.locator('.crop-reset-button').click();
    await page.waitForTimeout(150);
    assert.match(await cropSection.textContent(), /50%/);
    await page.screenshot({ path: path.join(OUT_DIR, '03e-grid-crop-controls.png'), fullPage: true });
    await page.locator('.template-strip button').nth(1).click();
    await page.waitForFunction(() => !!document.querySelector('.toast')?.textContent, null, { timeout: 10000 });
    assert.ok(fs.existsSync(uiTemplatePath));
    const savedTemplate = JSON.parse(fs.readFileSync(uiTemplatePath, 'utf8'));
    assert.ok(savedTemplate.cells.some(cell => cell.rowSpan === 2 && cell.colSpan === 2));
    await page.locator('.size-preset button').nth(3).click();
    await page.waitForFunction(() => /1080 x 1920/.test(document.querySelector('.canvas-title span')?.textContent || ''), null, { timeout: 5000 });
    await page.locator('.template-strip button').nth(0).click();
    await page.waitForFunction(() => /1600 x 2000/.test(document.querySelector('.canvas-title span')?.textContent || ''), null, { timeout: 5000 });
    gridPoints = await gridInteractionPoints(page);
    await page.mouse.click(gridPoints.firstCenter.x, gridPoints.firstCenter.y);
    assert.equal(await page.locator('.merge-tools button').nth(1).isDisabled(), false);
    await page.locator('.export-button').click();
    await waitForFileSystem(() => fs.existsSync(uiGridPath));
    const uiGridInspect = await page.evaluate(paths => window.noExif.inspectImages(paths), [uiGridPath.replaceAll('\\', '/')]);
    assert.equal(uiGridInspect.items[0].hasExif, false);
    await page.locator('.toast div button').click();
    await page.waitForSelector('.toast', { state: 'detached', timeout: 10000 });
    await assertMinimumWindowLayout(page);
    await page.setViewportSize({ width: 1500, height: 940 });
    await page.waitForTimeout(150);
    await page.locator('.snap-toggle').click();
    assert.match(await page.locator('.snap-toggle').textContent(), /OFF/);
    await page.screenshot({ path: path.join(OUT_DIR, '03b-grid-snap-off.png'), fullPage: true });
    await page.locator('.snap-toggle').click();
    assert.match(await page.locator('.snap-toggle').textContent(), /ON/);
    await page.locator('.merge-tools button').nth(1).click();
    await page.waitForTimeout(200);
    const unmergeState = await page.evaluate(() => ({
      selectedSummary: document.querySelector('.selected-summary')?.textContent || '',
      bodyText: document.body.textContent?.slice(0, 1200) || '',
    }));
    assert.match(unmergeState.selectedSummary, /4.*선택/, JSON.stringify({ unmergeState, consoleIssues }));
    await page.screenshot({ path: path.join(OUT_DIR, '03c-grid-unmerged-selection.png'), fullPage: true });
    await captureResponsiveScreens(page, 'grid');
    await page.locator('.grid-reset-button').click();
    await page.waitForSelector('.confirm-modal', { timeout: 5000 });
    assert.ok((await page.locator('.confirm-modal').textContent()).length > 0);
    await page.screenshot({ path: path.join(OUT_DIR, '03d-grid-reset-modal.png'), fullPage: true });
    await page.locator('.confirm-cancel').click();
    await page.waitForSelector('.confirm-modal', { state: 'detached', timeout: 5000 });
    assert.match(await page.locator('.selected-summary').textContent(), /4.*선택/);
    await page.locator('.grid-reset-button').click();
    await page.locator('.confirm-confirm').click();
    await page.waitForSelector('.confirm-modal', { state: 'detached', timeout: 5000 });
    assert.ok((await page.locator('.selected-summary').textContent()).length > 0);
    assert.ok((await page.locator('.toast').textContent()).length > 0);
    await page.locator('.inspector-section').nth(1).locator('.secondary-wide').click();
    await page.waitForFunction(() => /2 x 2/.test(document.querySelector('.canvas-title span')?.textContent || ''), null, { timeout: 5000 });
    assert.ok((await page.locator('.toast').textContent()).length > 0);

    await page.locator('.rail-button[data-mode="metadata"]').click();
    await page.waitForSelector('.metadata-item', { timeout: 10000 });
    assert.ok((await page.locator('.metadata-mode .panel-header button').first().textContent()).length > 0);
    await page.locator('.metadata-filters input').fill('comfy');
    await page.waitForFunction(() => document.querySelectorAll('.metadata-item').length === 1, null, { timeout: 5000 });
    assert.match(await page.locator('.metadata-item').first().textContent(), /comfy_workflow_fixture/);
    await page.locator('.metadata-filters input').fill('');
    await page.locator('.metadata-filters select').selectOption('workflow');
    await page.waitForFunction(() => document.querySelectorAll('.metadata-item').length >= 1, null, { timeout: 5000 });
    assert.match(await page.locator('.metadata-list').textContent(), /comfy_workflow_fixture/);
    await page.locator('.metadata-filters select').selectOption('all');
    await page.waitForFunction(() => document.querySelectorAll('.metadata-item').length === 3, null, { timeout: 5000 });
    await page.locator('.metadata-item').nth(2).click();
    await page.waitForTimeout(250);
    const metadataBadgesText = await page.locator('.metadata-health-strip').textContent();
    assert.ok(metadataBadgesText.length > 0);
    assert.match(metadataBadgesText, /Workflow/);
    assert.doesNotMatch(metadataBadgesText, /EXIF ?놁쓬|GPS ?놁쓬/);
    const metadataText = await page.locator('.metadata-info').textContent();
    assert.match(metadataText, /qa_realisticVision\.safetensors/);
    assert.match(metadataText, /QA alpine lake/);
    assert.match(metadataText, /Workflow JSON/);
    assert.doesNotMatch(metadataText, /__file_or_sensitive_section_should_not_exist__/);
    assert.equal(await page.locator('.metadata-actions button').nth(0).isDisabled(), false);
    assert.equal(await page.locator('.metadata-actions button').nth(1).isDisabled(), false);
    await page.evaluate(() => navigator.clipboard.writeText('__before_prompt_copy__'));
    await page.locator('.metadata-actions button').nth(0).click();
    await page.waitForFunction(() => navigator.clipboard.readText().then(text => text.includes('QA alpine lake')), null, { timeout: 5000 });
    await page.evaluate(() => navigator.clipboard.writeText('__before_workflow_copy__'));
    await page.locator('.metadata-actions button').nth(1).click();
    await page.waitForFunction(() => navigator.clipboard.readText().then(text => text.includes('CheckpointLoaderSimple')), null, { timeout: 5000 });
    await page.locator('.metadata-actions button').nth(2).click();
    await page.waitForFunction(() => !!document.querySelector('.toast')?.textContent, null, { timeout: 10000 });
    assert.ok(fs.existsSync(uiMetadataJsonPath));
    assert.match(fs.readFileSync(uiMetadataJsonPath, 'utf8'), /QA alpine lake/);
    await page.locator('.toast div button').click();
    await page.waitForSelector('.toast', { state: 'detached', timeout: 10000 });
    const missingShowResult = await page.evaluate(targetPath => window.noExif.showItemInFolder(targetPath), path.join(QA_OUTPUT_DIR, 'missing-file-for-e2e.png'));
    assert.equal(missingShowResult.ok, false);
    await page.locator('.metadata-actions button').nth(3).click();
    await page.waitForFunction(() => !!document.querySelector('.toast')?.textContent, null, { timeout: 5000 });
    assert.ok((await page.locator('.toast').textContent()).length > 0);
    const toastCoversMetadataActions = await page.evaluate(() => {
      const toast = document.querySelector('.toast')?.getBoundingClientRect();
      const actions = document.querySelector('.metadata-actions')?.getBoundingClientRect();
      if (!toast || !actions) return false;
      const horizontallyOverlaps = toast.left < actions.right && toast.right > actions.left;
      const verticallyOverlaps = toast.top < actions.bottom && toast.bottom > actions.top;
      return horizontallyOverlaps && verticallyOverlaps;
    });
    assert.equal(toastCoversMetadataActions, false, 'metadata toast should not cover metadata action buttons');
    await captureResponsiveScreens(page, 'metadata');
    await page.screenshot({ path: path.join(OUT_DIR, '04-metadata-workflow.png'), fullPage: true });

    await page.locator('.metadata-to-prompt').click();
    await page.waitForSelector('.prompt-share-mode', { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('.app-shell')?.classList.contains('mode-prompt-share'), null, { timeout: 10000 });
    await page.waitForSelector('.prompt-card-stage canvas', { timeout: 10000 });
    const firstPromptSource = page.locator('.prompt-library-card').first();
    if (await firstPromptSource.count()) {
      await firstPromptSource.click();
      await page.waitForTimeout(250);
    }
    const promptShareText = await page.locator('.prompt-share-mode').textContent();
    assert.match(promptShareText, /comfy_workflow_fixture/);
    assert.match(promptShareText, /qa_realisticVision\.safetensors/);
    assert.ok(promptShareText.length > 0);
    await page.waitForFunction(() => /1080 x 1350/.test(document.querySelector('.prompt-editor-footer')?.textContent || ''), null, { timeout: 5000 });
    if (fs.existsSync(uiPromptCardPath)) fs.unlinkSync(uiPromptCardPath);
    await page.locator('.prompt-preset-panel .prompt-export-button').click();
    await waitForFileSystem(() => fs.existsSync(uiPromptCardPath));
    fs.copyFileSync(uiPromptCardPath, uiPromptCardMagazinePath);
    const magazinePngInfo = validateCleanPngBuffer(fs.readFileSync(uiPromptCardMagazinePath));
    assert.equal(magazinePngInfo.width, 1080);
    assert.equal(magazinePngInfo.height, 1350);
    assert.equal(magazinePngInfo.chunks.includes('eXIf'), false);
    assert.equal(magazinePngInfo.chunks.includes('tEXt'), false);
    assert.equal(magazinePngInfo.chunks.includes('iTXt'), false);
    await page.locator('.toast .toast-close').click();
    await page.waitForSelector('.toast', { state: 'detached', timeout: 10000 });

    await page.locator('.prompt-ratio-select').selectOption('9:16');
    await page.waitForFunction(() => /1080 x 1920/.test(document.querySelector('.prompt-editor-footer')?.textContent || ''), null, { timeout: 5000 });
    await page.locator('.prompt-template-picker button[data-template="zine"]').click();
    await page.waitForTimeout(250);
    if (fs.existsSync(uiPromptCardPath)) fs.unlinkSync(uiPromptCardPath);
    await page.locator('.prompt-preset-panel .prompt-export-button').click();
    await waitForFileSystem(() => fs.existsSync(uiPromptCardPath));
    fs.copyFileSync(uiPromptCardPath, uiPromptCardZinePath);
    const promptPngInfo = validateCleanPngBuffer(fs.readFileSync(uiPromptCardPath));
    assert.equal(promptPngInfo.width, 1080);
    assert.equal(promptPngInfo.height, 1920);
    assert.equal(promptPngInfo.chunks.includes('eXIf'), false);
    assert.equal(promptPngInfo.chunks.includes('tEXt'), false);
    assert.equal(promptPngInfo.chunks.includes('iTXt'), false);
    const promptCardInspect = await page.evaluate(paths => window.noExif.inspectImages(paths), [uiPromptCardPath.replaceAll('\\', '/')]);
    assert.equal(promptCardInspect.items[0].hasExif, false);
    await page.locator('.toast div button').click();
    await page.waitForSelector('.toast', { state: 'detached', timeout: 10000 });
    await page.locator('.prompt-preset-panel .prompt-inspector-stack').evaluate(node => {
      node.scrollTop = 0;
    });
    await captureResponsiveScreens(page, 'prompt-share');
    await page.screenshot({ path: path.join(OUT_DIR, '05-prompt-share.png'), fullPage: true });

    await page.locator('.rail-button[data-mode="metadata"]').click();
    await page.waitForSelector('.metadata-mode', { timeout: 10000 });
    await page.locator('.metadata-to-exif').click();
    await page.waitForSelector('.exif-mode', { timeout: 10000 });
    assert.match(await page.locator('.brand-block span').textContent(), /EXIF 제거/);
    assert.ok((await page.locator('.toast').textContent()).length > 0);
    assert.match(await page.locator('.exif-list-item.is-active').textContent(), /\.png/i);
    const activeExifChecked = await page.locator('.exif-list-item.is-active input[type="checkbox"]').isChecked();
    assert.equal(activeExifChecked, true);

    const metadataJsonPath = path.join(QA_OUTPUT_DIR, `metadata-${Date.now()}.json`);
    const savedMetadataPath = await page.evaluate(({ outputPath, imageName }) => window.noExif.saveMetadataJson({
      name: imageName,
      outputPath,
      metadata: {
        source: 'e2e',
        comfyui: { workflow: true },
        prompt: 'QA alpine lake, premium local photo manager',
      },
    }), { outputPath: metadataJsonPath, imageName: 'comfy_workflow_fixture.png' });
    assert.equal(savedMetadataPath, metadataJsonPath);
    assert.ok(fs.existsSync(metadataJsonPath));
    assert.match(fs.readFileSync(metadataJsonPath, 'utf8'), /QA alpine lake/);

    const exifDir = path.join(QA_OUTPUT_DIR, exifFolderName());
    const dirtyInspect = await page.evaluate(pathToInspect => window.noExif.inspectImages([pathToInspect]), importedImages[0]);
    assert.equal(dirtyInspect.items[0].hasExif, true);
    assert.equal(dirtyInspect.items[0].metadata.privacy.hasGps, true);
    const cleanResult = await page.evaluate(({ imagePaths, outputDir }) => window.noExif.removeExifBatch({
      imagePaths,
      flags: [true, false, true],
      outputDir,
    }), { imagePaths: importedImages, outputDir: exifDir });
    assert.equal(cleanResult.processed, 2);
    assert.equal(cleanResult.skipped, 1);
    assert.equal(cleanResult.outputDir, exifDir);
    assert.equal(cleanResult.failures.length, 0);
    assert.match(exifDir, /No_EXIF_Export_\d{4}-\d{2}-\d{2}_\d{4}$/);
    const cleanInspect = await page.evaluate(paths => window.noExif.inspectImages(paths), cleanResult.outputPaths);
    assert.deepEqual(cleanInspect.items.map(item => item.hasExif), [false, false]);
    assert.deepEqual(cleanInspect.items.map(item => item.metadata.privacy.hasGps), [false, false]);
    assert.equal((await page.evaluate(dir => window.noExif.openPath(dir), exifDir)).ok, true);

    const gridPath = path.join(QA_OUTPUT_DIR, `grid-export-${Date.now()}.png`);
    const gridResult = await page.evaluate(({ imagePaths, outputPath }) => window.noExif.exportGrid({
      imagePaths,
      layout: {
        rows: 2,
        cols: 2,
        cells: [
          { row: 0, col: 0, rowSpan: 1, colSpan: 1, imageIndex: 0 },
          { row: 0, col: 1, rowSpan: 1, colSpan: 1, imageIndex: 1 },
          { row: 1, col: 0, rowSpan: 1, colSpan: 2, imageIndex: 2 },
        ],
      },
      settings: {
        width: 900,
        height: 1100,
        gap: 20,
        background: '#1f1e1c',
        roundCorners: true,
        radius: 24,
        quality: 95,
      },
      imageCrops: [
        { cropX: 0.5, cropY: 0.5 },
        { cropX: 0.5, cropY: 0.5 },
        { cropX: 0.5, cropY: 0.5 },
      ],
      outputPath,
    }), { imagePaths: importedImages, outputPath: gridPath });
    assert.equal(gridResult.width, 900);
    assert.equal(gridResult.height, 1100);
    assert.equal(gridResult.exifCount, 0);
    assert.equal(gridResult.failures.length, 0);
    assert.equal((await page.evaluate(filePath => window.noExif.showItemInFolder(filePath), gridPath)).ok, true);

    assert.deepEqual(consoleIssues, []);
    console.log(JSON.stringify({
      ok: true,
      screenshots: OUT_DIR,
      uiExifParentDir,
      uiGridPath,
      uiMetadataJsonPath,
      uiPromptCardPath,
      exifDir,
      cleanOutputCount: cleanResult.outputPaths.length,
      gridPath,
      comfyFixture,
    }, null, 2));
  } finally {
    await app.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
