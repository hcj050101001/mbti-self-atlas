"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");
const projectRoot = path.resolve(__dirname, "..");
const builder = import(pathToFileURL(path.join(projectRoot, "build.mjs")).href);

function fixture(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "self-atlas-build-"));
  t.after(() => {
    const cleanupRoot = fs.realpathSync(rootDir);
    const temporaryRoot = fs.realpathSync(os.tmpdir());
    if (path.dirname(cleanupRoot) !== temporaryRoot || !path.basename(cleanupRoot).startsWith("self-atlas-build-")) {
      throw new Error("Refusing to remove an unexpected build-test directory");
    }
    fs.rmSync(cleanupRoot, { recursive: true, force: true });
  });
  for (const file of ["package.json", "sources/oejts-1.2.json", "src/template.html", "src/styles.css", "src/core.js", "src/interpret.js", "src/app.js"]) {
    const target = path.join(rootDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(projectRoot, file), target);
  }
  return rootDir;
}

function editJson(rootDir, file, edit) {
  const target = path.join(rootDir, file);
  const data = JSON.parse(fs.readFileSync(target, "utf8"));
  edit(data);
  fs.writeFileSync(target, JSON.stringify(data), "utf8");
}

test("build injects independent versions and the complete canonical bank into an offline page", async t => {
  const { createBuild } = await builder;
  const rootDir = fixture(t);
  editJson(rootDir, "package.json", data => { data.version = "7.3.2"; });
  editJson(rootDir, "sources/oejts-1.2.json", data => { data.translationVersion = "1.1"; });
  const build = createBuild(rootDir);
  assert.deepEqual(build.config, {
    appVersion: "7.3.2", storageSchemaVersion: 2, translationVersion: "1.1"
  });
  assert.match(build.html, /中文试译 v1\.1/);
  assert.match(build.html, /property="og:title" content="见己 · 四维探索"/);
  assert.match(build.html, /property="og:description" content="见己 · 四维探索：/);
  assert.match(build.html, /name="twitter:title" content="见己 · 四维探索"/);
  assert.match(build.html, /name="twitter:description" content="见己 · 四维探索：/);
  assert.match(build.html, /property="og:image" content="https:\/\/hcj050101001\.github\.io\/mbti-self-atlas\/preview\.png"/);
  assert.match(build.html, /name="twitter:image" content="https:\/\/hcj050101001\.github\.io\/mbti-self-atlas\/preview\.png"/);
  assert.match(build.html, /property="og:url" content="https:\/\/hcj050101001\.github\.io\/mbti-self-atlas\/"/);
  assert.match(build.html, /非官方 MBTI，试译未经测量验证，不提供结果文件导出。/);
  assert.match(build.html, /http-equiv="Content-Security-Policy"[^>]*script-src 'unsafe-inline'/);
  assert.doesNotMatch(build.html, /og:description" content="[^"]*(准确率|严格测出|支持导出|可导出结果)/);
  assert.equal(build.bank.translationNotes.length, 12);
  assert.doesNotMatch(build.html, /<!-- (?:STYLES|DATA|CORE|INTERPRET|APP|CONFIG|TRANSLATION_VERSION) -->/);
  const context = { window: {} };
  context.window = context;
  vm.createContext(context);
  // Exercise the four generated scripts needed for scoring and interpretation independently of UI.
  const scripts = [...build.html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  for (const script of scripts.slice(0, 4)) vm.runInContext(script, context);
  assert.equal(context.APP_CONFIG.appVersion, "7.3.2");
  assert.equal(context.QUESTION_BANK.items[17].scale, "FT");
  const neutral = context.MBTICore.score(Array(32).fill(3));
  assert.equal(neutral.type, "XXXX");
  assert.equal(typeof context.MBTIInterpretation.interpret, "function");
  assert.equal(context.MBTIInterpretation.interpret(neutral).candidateCount, 16);
  assert.equal(fs.existsSync(path.join(rootDir, "index.html")), false, "assembly must not write artifacts");
});

test("each build marker is required exactly once", async t => {
  const { createBuild } = await builder;
  const rootDir = fixture(t);
  const target = path.join(rootDir, "src/template.html");
  const original = fs.readFileSync(target, "utf8");
  for (const marker of ["STYLES", "DATA", "CORE", "INTERPRET", "APP", "CONFIG", "TRANSLATION_VERSION"]) {
    const token = `<!-- ${marker} -->`;
    for (const changed of [original.replace(token, ""), original + token]) {
      fs.writeFileSync(target, changed, "utf8");
      assert.throws(() => createBuild(rootDir), /Expected exactly one build marker/);
    }
  }
});

test("build refuses inconsistent questionnaire data before generating artifacts", async t => {
  const { buildProject } = await builder;
  const rootDir = fixture(t);
  editJson(rootDir, "sources/oejts-1.2.json", data => { data.items[0].coefficient = -1; });
  assert.throws(() => buildProject({ rootDir, log() {} }), /constant or bounds/);
  assert.equal(fs.existsSync(path.join(rootDir, "index.html")), false);
  assert.equal(fs.existsSync(path.join(rootDir, "publish")), false);
});

test("embedded bank strings cannot terminate the data script", async t => {
  const { createBuild } = await builder;
  const rootDir = fixture(t);
  editJson(rootDir, "sources/oejts-1.2.json", data => {
    data.translationNotes[0].note = "</script><img src=x onerror=alert(1)>";
  });
  const { html } = createBuild(rootDir);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /\\u003c\/script>/);
});

test("check detects stale or missing outputs without writing; build syncs both entry points", async t => {
  const { buildProject } = await builder;
  const rootDir = fixture(t);
  const run = options => buildProject({ rootDir, log() {}, ...options });
  assert.throws(() => run({ check: true }), /missing or out of date/);
  assert.equal(fs.existsSync(path.join(rootDir, "publish")), false, "check must not create directories");
  run();
  const index = path.join(rootDir, "index.html");
  const published = path.join(rootDir, "publish/index.html");
  assert.deepEqual(fs.readFileSync(index), fs.readFileSync(published));
  assert.doesNotThrow(() => run({ check: true }));
  const originalTime = fs.statSync(index).mtimeMs;
  fs.writeFileSync(published, "stale", "utf8");
  assert.throws(() => run({ check: true }), /publish\/index.html/);
  assert.equal(fs.readFileSync(published, "utf8"), "stale", "check must not repair changed artifacts");
  assert.equal(fs.statSync(index).mtimeMs, originalTime, "check must not touch matching artifacts");
  run();
  fs.unlinkSync(published);
  assert.throws(() => run({ check: true }), /publish\/index.html/);
  assert.equal(fs.existsSync(published), false, "check must not restore missing artifacts");
  run();
  editJson(rootDir, "package.json", data => { data.version = "7.3.2"; });
  assert.throws(() => run({ check: true }), /index.html, publish\/index.html/);
});
