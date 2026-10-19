import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const { validateQuestionBank } = createRequire(import.meta.url)('./src/core.js');
const serializeScriptData = value => JSON.stringify(value).replace(/</g, '\\u003c');

// Export the pure assembly step so tests can inspect a build without touching
// checked-in artifacts. Both Node scoring and the page use this same bank.
export function createBuild(rootDir = root) {
  const read = path => readFileSync(join(rootDir, path), 'utf8');
  const bank = JSON.parse(read('sources/oejts-1.2.json'));
  validateQuestionBank(bank);
  const pkg = JSON.parse(read('package.json'));
  if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(pkg.version)) {
    throw new Error('package.json must contain a valid app version');
  }
  const config = {
    appVersion: pkg.version,
    storageSchemaVersion: 2,
    translationVersion: bank.translationVersion
  };
  let html = read('src/template.html');
  const replacements = {
    '<!-- STYLES -->': `<style>\n${read('src/styles.css')}\n</style>`,
    '<!-- TRANSLATION_VERSION -->': bank.translationVersion,
    '<!-- CONFIG -->': `<script>window.APP_CONFIG=${serializeScriptData(config)};</script>`,
    '<!-- DATA -->': `<script>window.QUESTION_BANK=${serializeScriptData(bank)};</script>`,
    '<!-- CORE -->': `<script>\n${read('src/core.js')}\n</script>`,
    '<!-- INTERPRET -->': `<script>\n${read('src/interpret.js')}\n</script>`,
    '<!-- APP -->': `<script>\n${read('src/app.js')}\n</script>`
  };
  // Check every marker before replacing any of them. A duplicate is as unsafe as
  // a missing marker because a generated page may otherwise look valid.
  for (const marker of Object.keys(replacements)) {
    const count = html.split(marker).length - 1;
    if (count !== 1) throw new Error(`Expected exactly one build marker ${marker}; found ${count}`);
  }
  for (const [marker, content] of Object.entries(replacements)) {
    html = html.replace(marker, () => content);
  }
  return { html, config, bank };
}

export function buildProject({ rootDir = root, check = false, log = console.log } = {}) {
  const build = createBuild(rootDir);
  const outputs = [
    ['index.html', build.html],
    ['publish/index.html', build.html],
    ['publish/.nojekyll', '']
  ];
  if (check) {
    const stale = outputs.filter(([path, content]) => {
      const absolute = join(rootDir, path);
      return !existsSync(absolute) || !readFileSync(absolute).equals(Buffer.from(content, 'utf8'));
    }).map(([path]) => path);
    if (stale.length) throw new Error(`Build artifacts are missing or out of date: ${stale.join(', ')}. Run npm run build.`);
    log(`Verified build artifacts (${Buffer.byteLength(build.html, 'utf8')} bytes, ${build.bank.items.length} items).`);
  } else {
    mkdirSync(join(rootDir, 'publish'), { recursive: true });
    for (const [path, content] of outputs) writeFileSync(join(rootDir, path), content, 'utf8');
    log(`Built index.html and publish/index.html (${Buffer.byteLength(build.html, 'utf8')} bytes, ${build.bank.items.length} items).`);
  }
  return build;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(argument => argument !== '--check')) throw new Error('Usage: node build.mjs [--check]');
    buildProject({ check: process.argv.includes('--check') });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
