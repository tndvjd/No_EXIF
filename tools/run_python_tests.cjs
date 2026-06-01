const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const venvPython = process.platform === 'win32'
  ? path.join(root, '.venv', 'Scripts', 'python.exe')
  : path.join(root, '.venv', 'bin', 'python');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  });
}

const deps = run(process.execPath, [path.join('tools', 'ensure_python_test_deps.cjs')]);
if (deps.status !== 0) {
  process.exit(deps.status ?? 1);
}

if (!fs.existsSync(venvPython)) {
  console.error(`Expected Python test environment at ${venvPython}`);
  process.exit(1);
}

const tests = run(venvPython, ['-m', 'unittest', 'discover', '-s', 'tests', '-v']);
process.exit(tests.status ?? 1);
