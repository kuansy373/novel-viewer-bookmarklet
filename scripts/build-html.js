const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

const srcDir = 'src/templates';
const outFile = 'build/templates.json';
const MARKER = /^<!-- @template (\w+) -->[ \t]*$/m;

(async () => {
  const templates = {};

  for (const f of fs.readdirSync(srcDir).filter(f => f.endsWith('.html'))) {
    const source = fs.readFileSync(path.join(srcDir, f), 'utf8');

    // split(正規表現 + キャプチャ) → ['', name1, body1, name2, body2, ...]
    const parts = source.split(MARKER);
    if (parts[0].trim() !== '') {
      throw new Error(`${f}: 最初の @template マーカーより前に内容があります`);
    }

    for (let i = 1; i < parts.length; i += 2) {
      const name = parts[i];
      if (name in templates) throw new Error(`${f}: テンプレート名が重複: ${name}`);

      templates[name] = await minify(parts[i + 1], {
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeComments: true,
        caseSensitive: true,   // {{extractAttrs}} 等を小文字化されないように
        minifyJS: false,       // <script>{{script}}</script> には触らない
        minifyCSS: false,
      });
    }
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(templates, null, 2));
})();
