'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../src/core.js');
const Interpretation = require('../src/interpret.js');
const bank = require('../sources/oejts-1.2.json');
const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const KEY = 'self-atlas.oejts12.zh.v1';

// These tests exercise app event handlers against storage failures and render
// states; they do not replace real-browser layout and interaction verification.
function harness(options = {}) {
  const handlers = {};
  const windowHandlers = {};
  const elements = new Map();
  let focused = null;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', textContent: '', value: '', checked: false, open: false,
      classList: { add() {}, remove() {} },
      firstElementChild: { style: {} },
      addEventListener(name, handler) { (handlers[`${id}:${name}`] ||= []).push(handler); }, setAttribute() {}, focus() { focused = id; }, select() {}, before() {},
      showModal() { this.open = true; }, close() { this.open = false; },
      querySelector(selector) { return element(selector); },
      querySelectorAll() { return []; }
    });
    return elements.get(id);
  }
  const store = options.store || new Map(options.draft ? [[KEY, JSON.stringify(options.draft)]] : []);
  const navigator = {};
  if (options.clipboard) navigator.clipboard = { writeText(text) { options.clipboard.push(text); return Promise.resolve(); } };
  if (options.denyClipboard) navigator.clipboard = { writeText() { return Promise.reject(new Error('denied')); } };
  if (options.share) {
    navigator.share = options.share;
    navigator.canShare = options.canShare || (() => true);
  }
  const document = {
    hidden: false,
    getElementById: element,
    createElement() { const node = element(`created-${elements.size}`); Object.defineProperty(node, 'id', { set(value) { elements.set(value, node); } }); return node; },
    addEventListener(name, handler) { (handlers[name] ||= []).push(handler); }
  };
  const window = { MBTICore: Core, MBTIInterpretation: Interpretation, QUESTION_BANK: bank,
    APP_CONFIG: { appVersion: options.appVersion || '1.1.0', storageSchemaVersion: 2, translationVersion: '1.0' },
    addEventListener(name, handler) { (windowHandlers[name] ||= []).push(handler); }, scrollTo() {} };
  const localStorage = {
    getItem(key) { if (options.denyRead) throw new Error('denied read'); return store.get(key) || null; },
    setItem(key, value) { if (options.denyWrite) throw new Error('denied write'); store.set(key, value); },
    removeItem(key) { if (options.denyRemove) throw new Error('denied remove'); if (!options.ignoreRemove) store.delete(key); }
  };
  vm.runInNewContext(source, { window, document, localStorage, navigator, Promise, Error,
    Date, setTimeout() { return 1; }, clearTimeout() {}, console });
  function emit(name, target, extra = {}) {
    const event = { target, prevented: false, preventDefault() { this.prevented = true; }, ...extra };
    for (const handler of handlers[name] || []) handler(event);
    return event;
  }
  return { elements, store, element,
    get focused() { return focused; },
    click(action) { emit('click', { closest() { return { dataset: { action }, disabled: false }; } }); },
    filter(value) { emit('click', { closest() { return { dataset: { filter: value }, disabled: false }; } }); },
    change(id, checked) { emit('change', { id, checked }); },
    key(key, target = { tagName: 'H1' }) { return emit('keydown', target, { key }); },
    hide() { emit('visibilitychange', document); },
    home() { emit('homeButton:click', element('homeButton')); },
    storage() { for (const handler of windowHandlers.storage || []) handler({ key: KEY }); },
    pagehide() { for (const handler of windowHandlers.pagehide || []) handler(); }
  };
}
function draft(complete = false) {
  return { version: '1.0.0', remember: true, answers: complete ? Array(32).fill(3) : [5, ...Array(31).fill(null)],
    flags: [2], index: 0, autoNext: false, english: false, notes: '上一位的测试笔记',
    startedAt: '2026-10-15T00:00:00.000Z', completedAt: complete ? '2026-10-15T00:02:00.000Z' : null, activeMs: 120000 };
}

test('explicit save request reports failure even when initial storage read was denied', () => {
  const app = harness({ denyRead: true, denyWrite: true });
  app.change('remember', true);
  assert.match(app.element('toast').textContent, /无法开启保存/);
  assert.doesNotMatch(app.element('main').innerHTML, /id="remember" checked/);
  assert.equal(app.store.size, 0);
});

test('failed draft deletion keeps the current participant and displays a persistent error', () => {
  const app = harness({ draft: draft(), denyRemove: true });
  app.click('reset'); app.click('confirmReset');
  assert.equal(app.element('infoDialog').open, true);
  assert.match(app.element('dialogContent').innerHTML, /role="alert"/);
  assert.match(app.element('dialogContent').innerHTML, /没有开始新的回答/);
  assert.match(app.element('main').innerHTML, /已答 1 \/ 32/);
  assert.equal(JSON.parse(app.store.get(KEY)).answers[0], 5);
});

test('failed opt-out does not falsely advertise that saved answers were removed', () => {
  const app = harness({ draft: draft(), denyRemove: true });
  app.change('remember', false);
  assert.match(app.element('main').innerHTML, /id="remember" checked/);
  assert.match(app.element('dialogContent').innerHTML, /保存选项尚未关闭/);
  assert.equal(app.element('infoDialog').open, true);
  assert.equal(JSON.parse(app.store.get(KEY)).answers[0], 5);
});

test('successful participant reset clears persisted answers', () => {
  const app = harness({ draft: draft(true) });
  app.click('reset'); app.click('confirmReset');
  assert.equal(app.store.size, 0);
  assert.doesNotMatch(app.element('main').innerHTML, /继续上次作答|查看我的结果/);
  assert.equal(app.element('infoDialog').open, false);
  assert.equal(app.element('dialogContent').innerHTML, '');
});

test('the result page keeps a short summary first and folds the long sections', () => {
  const app = harness({ draft: draft(true) });
  app.click('start');
  const html = app.element('main').innerHTML;
  assert.match(html, /45%–55% 中间带/);
  assert.match(html, /<nav class="result-nav" aria-label="结果页章节">/);
  const typeAt = html.indexOf('class="result-type"');
  const barsAt = html.indexOf('class="dimension-summary"');
  const summaryAt = html.indexOf('class="result-summary-box"');
  const foldAt = html.indexOf('id="result-overview"');
  assert.ok(typeAt >= 0 && typeAt < barsAt && barsAt < summaryAt && summaryAt < foldAt);
  assert.equal((html.match(/class="dimension-summary-card"/g) || []).length, 4);
  assert.equal((html.match(/class="track"/g) || []).length, 4);
  for (const [label, target] of [
    ['整体', 'result-overview'],
    ['四个维度', 'result-dimensions'],
    ['维度互动', 'result-interactions'],
    ['场景建议', 'result-scenes']
  ]) {
    assert.match(html, new RegExp(`<a href="#${target}">${label}</a>`));
    assert.match(html, new RegExp(`<details class="result-section result-fold" id="${target}">`));
  }
  assert.doesNotMatch(html, /<details[^>]*\sopen[\s>]/);
  assert.match(html, /把四个维度放在一起看/);
  assert.match(html, /四个维度分别看/);
  assert.match(html, /维度之间：组合起来的样子/);
  assert.match(html, /放回生活：工作、关系与恢复/);
  assert.match(html, /这份解读能做什么，不能做什么/);
  assert.equal((html.match(/class="dimension-card"/g) || []).length, 4);
  assert.equal((html.match(/class="reading-block"/g) || []).length, 12);
  assert.equal((html.match(/class="reading-label">通常表现<\/div>/g) || []).length, 4);
  assert.equal((html.match(/class="reading-label">可以发挥的地方<\/div>/g) || []).length, 4);
  assert.equal((html.match(/class="reading-label">压力下留意<\/div>/g) || []).length, 4);
  assert.equal((html.match(/class="scene-card"/g) || []).length, 3);
  assert.equal((html.match(/class="scene-item"/g) || []).length, 6);
  assert.match(html, /class="interaction-empty"/);
  assert.match(html, /data-action="copySummary"/);
  assert.doesNotMatch(html, /data-action="shareSummary"/);
  assert.doesNotMatch(html, /result-reflection|补上真实生活里的你|继续观察|id="reflection"/);
  assert.doesNotMatch(html, /复制完整结果|下载文本|下载 JSON|data-action="download|download=|type="file"/);
});

test('copy summary is local text with the type, four scores, and one fixed disclaimer', async () => {
  const clipboard = [];
  const app = harness({ draft: draft(true), clipboard });
  app.click('start');
  app.click('copySummary');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(clipboard.length, 1);
  const lines = clipboard[0].split('\n');
  assert.deepEqual(lines, [
    '见己 · 四维探索',
    '偏好轮廓：XXXX',
    'IE I/E 原始分 24/40 · 刻度位置 50.0%',
    'SN S/N 原始分 24/40 · 刻度位置 50.0%',
    'FT F/T 原始分 24/40 · 刻度位置 50.0%',
    'JP J/P 原始分 24/40 · 刻度位置 50.0%',
    '非官方 MBTI，中文试译，未经心理测量验证。'
  ]);
  assert.equal(clipboard[0].split('未经心理测量验证').length - 1, 1);
  assert.doesNotMatch(clipboard[0], /通常表现|工作与学习|下载|上传/);
  assert.match(app.element('toast').textContent, /已复制摘要/);
});

test('web share stays local and falls back to copy when sharing is unavailable', async () => {
  const clipboard = [];
  const shared = [];
  const app = harness({
    draft: draft(true),
    clipboard,
    share(data) { shared.push(data); return Promise.resolve(); }
  });
  app.click('start');
  assert.match(app.element('main').innerHTML, /data-action="shareSummary"/);
  app.click('shareSummary');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(shared.length, 1);
  assert.equal(shared[0].title, '见己 · 四维探索');
  assert.match(shared[0].text, /偏好轮廓：XXXX/);
  assert.match(shared[0].text, /非官方 MBTI，中文试译，未经心理测量验证。/);
  assert.equal(shared[0].url, undefined);
  assert.equal(shared[0].files, undefined);
  assert.equal(clipboard.length, 0);
  assert.match(app.element('toast').textContent, /已交给系统分享/);

  const cancelled = [];
  const cancelClipboard = [];
  const cancelApp = harness({
    draft: draft(true),
    clipboard: cancelClipboard,
    share() {
      const error = new Error('abort');
      error.name = 'AbortError';
      return Promise.reject(error);
    }
  });
  cancelApp.click('start');
  cancelApp.click('shareSummary');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(cancelClipboard.length, 0);
  assert.equal(cancelled.length, 0);
  assert.equal(cancelApp.element('toast').textContent, '');

  const fallbackClipboard = [];
  let shareCalls = 0;
  const fallback = harness({
    draft: draft(true),
    clipboard: fallbackClipboard,
    canShare() { return false; },
    share() { shareCalls += 1; return Promise.resolve(); }
  });
  fallback.click('start');
  fallback.click('shareSummary');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(shareCalls, 0);
  assert.equal(fallbackClipboard.length, 1);
  assert.match(fallbackClipboard[0], /非官方 MBTI，中文试译，未经心理测量验证。/);
  assert.match(fallback.element('toast').textContent, /无法系统分享，摘要已复制到剪贴板/);
});

test('legacy draft migrates to an independently versioned storage envelope on save', () => {
  const app = harness({ draft: draft(), appVersion: '2.7.3' });
  assert.match(app.element('main').innerHTML, /已答 1 \/ 32/);
  app.click('start');
  const saved = JSON.parse(app.store.get(KEY));
  assert.equal(saved.storageSchemaVersion, 2);
  assert.equal(saved.appVersion, '2.7.3');
  assert.equal(saved.version, undefined);
  assert.equal(saved.answers[0], 5);
  assert.equal(saved.notes, undefined);
  assert.equal(typeof saved.sessionId, 'string');
  assert.equal(saved.revision, 1);
  const updated = harness({ store: app.store, appVersion: '2.8.0' });
  assert.match(updated.element('main').innerHTML, /已答 1 \/ 32/);
});

test('incompatible storage schema is visible and is not overwritten by enabling save', () => {
  const incompatible = { ...draft(), storageSchemaVersion: 999, sessionId: 'future', revision: 1 };
  const app = harness({ draft: incompatible });
  const original = app.store.get(KEY);
  assert.equal(app.element('infoDialog').open, true);
  assert.match(app.element('dialogContent').innerHTML, /不兼容/);
  app.change('remember', true);
  app.click('start'); app.pagehide();
  assert.equal(app.store.get(KEY), original);
  app.click('reset'); app.click('confirmReset');
  assert.equal(app.store.size, 0);
});

test('malformed stored data displays an explicit preservation notice', () => {
  const store = new Map([[KEY, '{not-json']]);
  const app = harness({ store });
  assert.match(app.element('dialogContent').innerHTML, /内容已经损坏/);
  assert.equal(app.store.get(KEY), '{not-json');
});

test('an older tab cannot resurrect a removed draft before storage events arrive', () => {
  const store = new Map([[KEY, JSON.stringify(draft())]]);
  const older = harness({ store });
  const current = harness({ store });
  current.click('reset'); current.click('confirmReset');
  older.home(); older.hide(); older.pagehide();
  assert.equal(store.size, 0);
  assert.match(older.element('dialogContent').innerHTML, /保存会话已失效/);
  assert.doesNotMatch(older.element('main').innerHTML, /id="remember" checked/);
  older.change('remember', true);
  assert.equal(store.size, 0);
});

test('an older tab cannot overwrite or delete a newer participant draft', () => {
  const store = new Map([[KEY, JSON.stringify(draft())]]);
  const older = harness({ store });
  const current = harness({ store });
  current.click('reset'); current.click('confirmReset'); current.change('remember', true);
  const fresh = store.get(KEY);
  older.click('reset'); older.click('confirmReset');
  older.change('remember', false); older.hide(); older.pagehide();
  assert.equal(store.get(KEY), fresh);
  assert.match(older.element('dialogContent').innerHTML, /保存会话已失效/);
  assert.match(older.element('main').innerHTML, /已答 1 \/ 32/);
});

test('opt-out from an older revision cannot remove another tab\'s saved edits', () => {
  const first = harness({ draft: draft() });
  first.click('start');
  const older = harness({ store: first.store });
  first.click('flag');
  const current = first.store.get(KEY);
  older.change('remember', false);  assert.equal(first.store.get(KEY), current);
  assert.match(older.element('dialogContent').innerHTML, /保存会话已失效/);
});

test('blocked reads during lifecycle save never write unchecked local answers', () => {
  const options = { draft: draft() };
  const app = harness(options);
  const original = app.store.get(KEY);
  options.denyRead = true;
  app.change('autoNext', true); app.pagehide();
  assert.equal(app.store.get(KEY), original);
  assert.match(app.element('toast').textContent, /未能保存/);
});

test('a deletion that leaves stored data in place does not claim a successful reset', () => {
  const app = harness({ draft: draft(), ignoreRemove: true });
  app.click('reset'); app.click('confirmReset');
  assert.match(app.element('dialogContent').innerHTML, /没有开始新的回答/);
  assert.equal(JSON.parse(app.store.get(KEY)).answers[0], 5);
  assert.match(app.element('main').innerHTML, /已答 1 \/ 32/);
});

test('concurrent updates are rejected by revision without discarding current in-memory state', () => {
  const first = harness({ draft: draft() });
  first.click('start');
  const other = harness({ store: first.store });
  first.click('flag');
  const current = first.store.get(KEY);
  other.change('autoNext', true);
  assert.equal(first.store.get(KEY), current);
  other.click('next');
  assert.match(other.element('main').innerHTML, /id="autoNext" checked/);
  assert.equal(JSON.parse(first.store.get(KEY)).autoNext, false);
});

test('storage invalidation preserves the current main view and blocks lifecycle saves', () => {
  const first = harness({ draft: draft(true) });
  first.click('start');
  const other = harness({ store: first.store });
  const mainBefore = first.element('main').innerHTML;
  first.element('main').focus();
  other.click('reset'); other.click('confirmReset');
  first.storage(); first.pagehide();
  assert.match(first.element('storageConflict').textContent, /保存会话已失效/);
  assert.equal(first.element('storageConflict').hidden, false);
  assert.equal(first.focused, 'main');
  assert.equal(first.element('infoDialog').open, false);
  assert.equal(first.store.size, 0);
  assert.equal(first.element('main').innerHTML, mainBefore);
});

test('native radio arrow keys do not invoke question navigation', () => {
  const app = harness({ draft: draft() });
  app.click('start');
  const radio = { tagName: 'INPUT', type: 'radio' };
  const before = app.element('main').innerHTML;
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) assert.equal(app.key(key, radio).prevented, false);
  assert.equal(app.element('main').innerHTML, before);
  assert.equal(app.key('ArrowRight').prevented, true);
  assert.notEqual(app.element('main').innerHTML, before);
});

test('English toggle, flag and review filters preserve control focus after rendering', () => {
  const app = harness({ draft: draft() });
  app.click('start');
  app.click('english'); assert.equal(app.focused, '[data-action="english"]');
  app.click('flag'); assert.equal(app.focused, '[data-action="flag"]');
  app.click('review'); app.filter('missing'); assert.equal(app.focused, '[data-filter="missing"]');
});
