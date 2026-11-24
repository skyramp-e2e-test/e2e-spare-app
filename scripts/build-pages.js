'use strict';

// Page build: checks every public/*.html with html-validate, then writes the pages and assets to dist/.
// Any error (for example an unclosed tag) fails the build and names the file and line.
const fs = require('fs');
const path = require('path');
const { HtmlValidate, FileSystemConfigLoader, formatterFactory } = require('html-validate');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

async function main() {
  const htmlvalidate = new HtmlValidate(new FileSystemConfigLoader());
  const pages = fs.readdirSync(SRC).filter((f) => f.endsWith('.html')).sort();
  const results = [];
  for (const page of pages) {
    const report = await htmlvalidate.validateFile(path.join('public', page));
    if (!report.valid) results.push(...report.results);
  }
  if (results.length > 0) {
    const text = formatterFactory('text');
    console.error(text(results));
    console.error(`Page build failed: ${results.reduce((n, r) => n + r.errorCount, 0)} error(s) in public/.`);
    process.exit(1);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.cpSync(SRC, OUT, { recursive: true });
  console.log(`Page build OK: ${pages.length} page(s) checked, written to dist/.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
