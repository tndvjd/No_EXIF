import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const USER_FACING_FILES = [
  'pro-ui/src/App.jsx',
  'pro-ui/src/PixivImportMode.jsx',
  'electron/main.cjs',
];

const MOJIBAKE_PATTERNS = [
  /[\u0080-\u009F]/,
  /[\u3400-\u9FFF\uF900-\uFAFF]/,
  /�/,
  /\?대/,
  /\?쒗/,
  /\?꾨/,
  /\?묓/,
  /\?ㅼ/,
  /\?좏/,
  /\?뚯/,
  /硫뷀/,
  /洹몃/,
  /癒쇱/,
  /蹂묓/,
  /쨌/,
];

test('user-facing source files do not contain mojibake fragments', () => {
  const findings = [];

  for (const filePath of USER_FACING_FILES) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (MOJIBAKE_PATTERNS.some(pattern => pattern.test(line))) {
        findings.push(`${filePath}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(findings, []);
});
