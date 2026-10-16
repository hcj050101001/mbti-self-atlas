import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const bank = JSON.parse(read('sources/items.json'));
if (bank.items.length !== 32 || bank.items.some((q, i) => q.id !== i + 1)) throw new Error('Invalid item order');
let html = read('src/template.html');
const replacements = {
  '<!-- STYLES -->': `<style>\n${read('src/styles.css')}\n</style>`,
  '<!-- DATA -->': `<script>window.QUESTION_BANK=${JSON.stringify(bank).replace(/</g, '\\u003c')};</script>`,
  '<!-- CORE -->': `<script>\n${read('src/core.js')}\n</script>`,
  '<!-- APP -->': `<script>\n${read('src/app.js')}\n</script>`
};
for (const [marker, content] of Object.entries(replacements)) {
  if (!html.includes(marker)) throw new Error(`Missing build marker: ${marker}`);
  html = html.replace(marker, () => content);
}
writeFileSync(join(root, 'index.html'), html, 'utf8');
console.log(`Built standalone index.html (${Buffer.byteLength(html, 'utf8')} bytes, ${bank.items.length} items).`);
