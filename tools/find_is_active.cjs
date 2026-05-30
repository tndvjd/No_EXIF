const fs = require('fs');
const content = fs.readFileSync('pro-ui/src/styles.css', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('is-active')) {
    console.log(`${index + 1}: ${line}`);
  }
});
