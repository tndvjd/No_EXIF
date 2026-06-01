const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function listTests(dir, extension) {
  return fs.readdirSync(path.join(root, dir))
    .filter((file) => file.endsWith(extension))
    .sort()
    .map((file) => path.join(dir, file));
}

const testFiles = [
  ...listTests(path.join('pro-ui', 'src'), '.test.mjs'),
  ...listTests('electron', '.test.cjs'),
];

if (testFiles.length === 0) {
  console.error('No JavaScript test files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
});

process.exit(result.status ?? 1);
