const fs = require('fs');
const f = 'dist/bookmarklet.js';

const code = fs.readFileSync(f, 'utf8')
  .trim()
  .replace(/\r?\n/g, '\\n');   // 生の改行 → \n（文字列内なので意味は同じ）

const m = code.match(/.{0,20}%[0-9a-fA-F]{2}.{0,20}/);
if (m) {
  console.error('ブックマークレットとして壊れる可能性のある並びがあります:', m[0]);
  process.exit(1);
}

fs.writeFileSync(f, code);
