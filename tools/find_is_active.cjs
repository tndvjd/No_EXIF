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
lines.forEach((line, index) => {
  if (line.includes('is-active')) {
    console.log(`${index + 1}: ${line}`);
  }
});
