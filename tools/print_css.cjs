const fs = require('fs');
const path = require('path');

function readCssBundle(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const baseDir = path.dirname(filePath);
  const imports = [...content.matchAll(/@import\s+"([^"]+)";/g)]
    .map(match => path.join(baseDir, match[1]));
  if (!imports.length) return content;
  return [
    content,
    ...imports.map(importPath => fs.readFileSync(importPath, 'utf8')),
  ].join('\n');
}

const content = readCssBundle('pro-ui/src/styles.css');
const lines = content.split('\n');
for (let i = 2480; i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
