'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.js');
const interpretation = require('../src/interpret.js');
const report = require('../src/report.js');
const bank = require('../sources/oejts-1.2.json');
const config = { appVersion: '1.4.0', translationVersion: '1.0' };
const date = new Date(2026, 9, 29);
test('report projects the result and excludes answers and session details', () => {
  const answers = Array(32).fill(1);
  const data = report.create(answers, core, interpretation, config, date);
  const score = core.score(answers);
  assert.equal(data.type, score.cautiousType);
  assert.deepEqual(data.dimensions.map(d => [d.score, d.position, d.low, d.high]), score.dimensions.map(d => [d.score, d.position, d.low, d.high]));
  assert.deepEqual(data.summary, interpretation.interpret(score).overall.slice(0, 3));
  assert.equal(data.dimensions[0].lowLabel, '内向');
  assert.equal(data.dimensions[0].highLabel, '外向');
  assert.equal(data.disclaimer, '非官方 MBTI，中文试译，未经心理测量验证');
  assert.match(data.attribution, /Eric Jorgenson.*CC BY-NC-SA 4\.0/);
  assert.equal(report.filename(data), 'jianji-ESTJ-2026-10-29.png');
  assert.doesNotMatch(JSON.stringify(data), /answers|flags|activeMs|startedAt|completedAt/);
  assert.deepEqual(data, report.create(answers, core, interpretation, config, date));
  assert.throws(() => report.create(Array(32).fill(null), core, interpretation, config, date));
});
test('report uses the result page X band for 23, 24 and 25', () => {
  for (const target of [23, 24, 25]) {
    const answers = Array(32).fill(3);
    if (target !== 24) {
      const term = bank.items.find(item => item.scale === 'IE');
      answers[term.id - 1] += (target - 24) * term.coefficient;
    }
    const data = report.create(answers, core, interpretation, config, date);
    assert.equal(data.dimensions[0].score, target);
    assert.equal(data.type[0], 'X');
  }
});
