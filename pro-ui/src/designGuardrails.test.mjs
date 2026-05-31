import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const SOURCE_FILES = [
  'pro-ui/src/App.jsx',
  'pro-ui/src/CommandPalette.jsx',
  'pro-ui/src/TopBar.jsx',
  'pro-ui/src/commandPaletteModel.js',
  'pro-ui/src/LayoutCanvas.jsx',
  'pro-ui/src/ModeRail.jsx',
  'pro-ui/src/PixivImportMode.jsx',
  'pro-ui/src/styles.css',
];

const BANNED_PATTERNS = [
  { name: 'green showcase glow', pattern: /rgba\(162,\s*185,\s*161/i },
  { name: 'purple blue Pixiv mock gradient', pattern: /#20264b|#7e557e|#496b82|#6a365a/i },
  { name: 'bouncy elastic motion', pattern: /cubic-bezier\(0\.34,\s*1\.56,\s*0\.64,\s*1\)/i },
  { name: 'gradient text', pattern: /background-clip:\s*text/i },
  { name: 'negative letter spacing', pattern: /letter-spacing:\s*-/i },
];

test('private workbench sources avoid generic AI-gradient SaaS patterns', () => {
  const findings = [];

  for (const filePath of SOURCE_FILES) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const banned of BANNED_PATTERNS) {
      if (banned.pattern.test(content)) {
        findings.push(`${filePath}: ${banned.name}`);
      }
    }
  }

  assert.deepEqual(findings, []);
});

test('styles define a reduced motion fallback for product UI motion', () => {
  const css = fs.readFileSync('pro-ui/src/styles.css', 'utf8');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('mode rail active state is in-flow and icon aligned', () => {
  const modeRail = fs.readFileSync('pro-ui/src/ModeRail.jsx', 'utf8');
  const css = fs.readFileSync('pro-ui/src/styles.css', 'utf8');

  assert.doesNotMatch(modeRail, /rail-active-pill/);
  assert.doesNotMatch(modeRail, /rail-modes-wrapper/);
  assert.doesNotMatch(modeRail, /style=\{\{/);
  assert.doesNotMatch(css, /rail-active-pill/);
  assert.doesNotMatch(css, /rail-modes-wrapper/);
});

test('pixiv import copy stays terse and tool-native', () => {
  const content = [
    'pro-ui/src/PixivImportMode.jsx',
    'pro-ui/src/App.jsx',
  ].map(filePath => fs.readFileSync(filePath, 'utf8')).join('\n');
  const bannedCopy = [
    /토큰은 계정 열쇠/,
    /다운로드 요청에만 사용/,
    /브리지/,
    /다운로드 엔진/,
    /UI 먼저 연결/,
  ];

  for (const pattern of bannedCopy) {
    assert.doesNotMatch(content, pattern);
  }
});

test('product UI does not repeat local-processing copy', () => {
  const content = [
    'pro-ui/src/App.jsx',
    'pro-ui/src/ModeRail.jsx',
    'pro-ui/src/TopBar.jsx',
    'pro-ui/src/topBarModel.js',
    'pro-ui/src/commandPaletteModel.js',
  ].map(filePath => fs.readFileSync(filePath, 'utf8')).join('\n');

  for (const pattern of [/로컬 처리/, /로컬에서/, /LOCAL/, /local workspace/i, /Local image/i]) {
    assert.doesNotMatch(content, pattern);
  }
});

test('approved GSAP micro-interactions are wired to focused UI surfaces', () => {
  const commandPalette = fs.readFileSync('pro-ui/src/CommandPalette.jsx', 'utf8');
  const modeRail = fs.readFileSync('pro-ui/src/ModeRail.jsx', 'utf8');
  const pixivImport = fs.readFileSync('pro-ui/src/PixivImportMode.jsx', 'utf8');
  const app = fs.readFileSync('pro-ui/src/App.jsx', 'utf8');

  assert.match(commandPalette, /gsap\.timeline/);
  assert.match(modeRail, /gsap\.context/);
  assert.match(pixivImport, /gsap\.fromTo\([^)]*pixiv-card/s);
  assert.match(pixivImport, /AnimatedMetricValue/);
  assert.match(app, /modeStageRef/);
});

test('typographic hierarchy avoids over-heavy interface weights', () => {
  const styles = fs.readFileSync('pro-ui/src/styles.css', 'utf8');

  assert.doesNotMatch(styles, /font-weight:\s*(750|800|900)\b/);
  assert.match(styles, /font-weight:\s*650\b/);
});
