const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const python = path.join(root, '.venv', 'Scripts', 'python.exe');
const requirements = path.join(root, 'requirements.txt');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  });
}

if (!fs.existsSync(python)) {
  const create = run('py', ['-3', '-m', 'venv', '.venv']);
  if (create.status !== 0) {
    process.exit(create.status ?? 1);
  }
}

const importCheck = run(python, ['-c', 'import PIL; import PyQt6']);
if (importCheck.status === 0) {
  process.exit(0);
}

const install = run(python, ['-m', 'pip', 'install', '-r', requirements]);
process.exit(install.status ?? 1);
