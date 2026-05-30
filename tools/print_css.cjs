const fs = require('fs');
const content = fs.readFileSync('pro-ui/src/styles.css', 'utf8');
const lines = content.split('\n');
for (let i = 2480; i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
