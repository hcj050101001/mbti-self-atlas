'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../src/core.js');
const bank = require('../sources/items.json');
const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const KEY = 'self-atlas.oejts12.zh.v1';

// These tests exercise app event handlers against storage/clipboard failures;
// they do not replace real-browser layout and interaction verification.
function harness(options = {}) {
  const handlers = {};
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', textContent: '', value: '', checked: false, open: false,
      classList: { add() {}, remove() {} },
      addEventListener() {}, setAttribute() {}, focus() {}, select() {},
      showModal() { this.open = true; }, close() { this.open = false; },
      querySelector() { return { setAttribute() {}, focus() {} }; }
    });
    return elements.get(id);
  }
  const store = new Map(options.draft ? [[KEY, JSON.stringify(options.draft)]] : []);
  const document = {
    hidden: false,
    getElementById: element,
    addEventListener(name, handler) { (handlers[name] ||= []).push(handler); }
  };
  const window = { MBTICore: Core, QUESTION_BANK: bank, addEventListener() {}, scrollTo() {} };
  const localStorage = {
    getItem(key) { if (options.denyRead) throw new Error('denied read'); return store.get(key) || null; },
    setItem(key, value) { if (options.denyWrite) throw new Error('denied write'); store.set(key, value); },
    removeItem(key) { if (options.denyRemove) throw new Error('denied remove'); store.delete(key); }
  };
  vm.runInNewContext(source, { window, document, localStorage,
    navigator: { clipboard: options.clipboard }, Date, setTimeout() { return 1; }, clearTimeout() {},
    console, Blob, URL });
  function emit(name, target) { for (const handler of handlers[name] || []) handler({ target }); }
  return { elements, store, element,
    click(action) { emit('click', { closest() { return { dataset: { action }, disabled: false }; } }); },
    change(id, checked) { emit('change', { id, checked }); }
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
  assert.equal(JSON.parse(app.store.get(KEY)).notes, '上一位的测试笔记');
});

test('successful participant reset clears persisted answers and reflection', () => {
  const app = harness({ draft: draft(true) });
  app.click('reset'); app.click('confirmReset');
  assert.equal(app.store.size, 0);
  assert.doesNotMatch(app.element('main').innerHTML, /继续上次作答|查看我的结果|上一位的测试笔记/);
  assert.equal(app.element('infoDialog').open, false);
  assert.equal(app.element('dialogContent').innerHTML, '');
});

test('a rejected clipboard request cannot reopen the previous participant report after reset', async () => {
  let rejectCopy;
  const app = harness({ draft: draft(true), clipboard: { writeText() { return new Promise((resolve, reject) => { rejectCopy = reject; }); } } });
  app.click('start'); app.click('copy');
  app.click('reset'); app.click('confirmReset');
  rejectCopy(new Error('permission denied'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.element('infoDialog').open, false);
  assert.equal(app.element('dialogContent').innerHTML, '');
  assert.equal(app.element('manualCopy').value, '');
});

test('unavailable clipboard offers an explicit full-text fallback for the current participant', () => {
  const app = harness({ draft: draft(true) });
  app.click('start'); app.click('copy');
  assert.equal(app.element('infoDialog').open, true);
  assert.match(app.element('manualCopy').value, /Q32=3/);
  assert.match(app.element('manualCopy').value, /上一位的测试笔记/);
  assert.match(app.element('dialogContent').innerHTML, /Ctrl\+C/);
});
