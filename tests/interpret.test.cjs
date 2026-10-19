"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../src/core.js");
const interpretation = require("../src/interpret.js");
const bank = require("../sources/oejts-1.2.json");

const ORDER = ["IE", "SN", "FT", "JP"];
const LOW = ["I", "S", "F", "J"];
const HIGH = ["E", "N", "T", "P"];

// Build a scoring-result fixture with each dimension displaced by the given
// integer offset from the midpoint. Used to pin wording thresholds without
// relying on particular answer patterns.
function resultWith(offsets) {
  const dimensions = ORDER.map((key, index) => {
    const score = 24 + offsets[index];
    const position = (score - 8) / (40 - 8) * 100;
    const borderline = position >= 45 && position <= 55;
    const letter = score === 24 ? "X" : score > 24 ? HIGH[index] : LOW[index];
    return {
      key, low: LOW[index], high: HIGH[index], score, letter,
      distance: Math.abs(score - 24), borderline, position
    };
  });
  return {
    dimensions,
    type: dimensions.map(dimension => dimension.letter).join(""),
    originalType: dimensions.map((dimension, index) => dimension.score > 24 ? HIGH[index] : LOW[index]).join(""),
    cautiousType: dimensions.map(dimension => dimension.borderline ? "X" : dimension.letter).join("")
  };
}

test("four balanced dimensions stay unresolved, list 16 candidates, and still explain every dimension", () => {
  const reading = interpretation.interpret(core.score(Array(32).fill(3)));
  assert.equal(reading.headline, "你的回答目前呈现为 XXXX");
  assert.equal(reading.candidateCount, 16);
  assert.equal(reading.interactions.length, 0);
  assert.equal(reading.dimensions.length, 4);
  assert.ok(reading.overall.length >= 3);
  assert.match(reading.overall[0], /四个维度都落在 45%–55% 的中间带/);
  for (const dimension of reading.dimensions) {
    assert.equal(dimension.side, "balanced");
    assert.equal(dimension.strength, "balanced");
    assert.equal(dimension.strengthLabel, "中间带");
    assert.equal(dimension.directionLabel, "中间带");
    assert.match(dimension.scoreLine, /^原始分 24 \/ 40 · 刻度位置 50\.0% · 中间带 45%–55%$/);
    const texts = interpretation.DIMENSIONS[dimension.key].texts.balanced;
    assert.equal(dimension.expression, texts.expression);
    assert.equal(dimension.upside, texts.upside);
    assert.equal(dimension.watch, texts.watch);
    assert.equal(dimension.strengthNote, interpretation.STRENGTHS.balanced.text);
  }
  assert.deepEqual(reading.scenes.map(scene => scene.title), ["工作与学习", "关系与沟通", "压力与恢复"]);
  assert.deepEqual(reading.scenes.map(scene => scene.items.length), [2, 2, 2]);
  for (const scene of reading.scenes) {
    for (const item of scene.items) {
      assert.equal(item.text, interpretation.DIMENSIONS[item.key].texts.balanced.scenes[scene.key]);
    }
  }
  assert.ok(reading.summary.some(line => /16 种四字母组合/.test(line)));
  assert.ok(reading.summary.some(line => /23–25 分都视为中间带/.test(line)));
  assert.equal(reading.caveats.length, 4);
  assert.equal(Object.isFrozen(reading), true);
  assert.equal(Object.isFrozen(reading.overall), true);
  assert.equal(Object.isFrozen(reading.caveats), true);
  assert.equal(Object.isFrozen(reading.dimensions), true);
  assert.equal(Object.isFrozen(reading.dimensions[0]), true);
  assert.equal(Object.isFrozen(reading.scenes), true);
  assert.equal(Object.isFrozen(reading.scenes[0].items), true);
  assert.equal(Object.isFrozen(reading.scenes[0].items[0]), true);
});

test("fully resolved extreme answers produce strong dimensions, three interactions, and one candidate", () => {
  const reading = interpretation.interpret(resultWith([16, 16, 16, 16]));
  assert.equal(reading.headline, "你的回答整体偏向 ENTP");
  assert.equal(reading.candidateCount, 1);
  assert.deepEqual(reading.dimensions.map(dimension => dimension.strength), ["strong", "strong", "strong", "strong"]);
  assert.deepEqual(reading.dimensions.map(dimension => dimension.directionLabel), ["E · 外向", "N · 直觉", "T · 思考", "P · 知觉"]);
  assert.deepEqual(reading.interactions.map(item => item.title), [
    "信息与判断：你怎样把观察变成决定",
    "能量与节奏：你怎样安排一天",
    "关系中的关心方式"
  ]);
  assert.deepEqual(reading.interactions.map(item => item.keys.join("×")), ["SN×FT", "IE×JP", "IE×FT"]);
  const overallText = reading.overall.join("");
  assert.ok(overallText.includes(interpretation.DIMENSIONS.IE.texts.high.clause));
  assert.ok(overallText.includes(interpretation.DIMENSIONS.SN.texts.high.clause));
  assert.ok(overallText.includes(interpretation.DIMENSIONS.FT.texts.high.clause));
  assert.ok(overallText.includes(interpretation.DIMENSIONS.JP.texts.high.clause));
  for (const scene of reading.scenes) {
    for (const item of scene.items) {
      assert.equal(item.text, interpretation.DIMENSIONS[item.key].texts.high.scenes[scene.key]);
    }
  }
  assert.ok(reading.summary.some(line => /4 个很强/.test(line)));
  assert.ok(reading.summary.some(line => /不是固定人格/.test(line)));
});

test("strength bands switch at the declared distance boundaries and only add a note", () => {
  const cases = [
    [-16, "strong", "很强"], [-10, "strong", "很强"],
    [-9, "clear", "明显"], [-5, "clear", "明显"],
    [-4, "slight", "轻微"], [-2, "slight", "轻微"],
    [-1, "balanced", "中间带"], [0, "balanced", "中间带"], [1, "balanced", "中间带"],
    [2, "slight", "轻微"], [4, "slight", "轻微"],
    [5, "clear", "明显"], [9, "clear", "明显"],
    [10, "strong", "很强"], [16, "strong", "很强"]
  ];
  for (const [offset, strength, label] of cases) {
    const reading = interpretation.interpret(resultWith([offset, 0, 0, 0]));
    assert.equal(reading.dimensions[0].strength, strength, `offset ${offset}`);
    assert.equal(reading.dimensions[0].strengthLabel, label, `offset ${offset}`);
    assert.equal(reading.dimensions[0].side, strength === "balanced" ? "balanced" : offset > 0 ? "high" : "low");
    assert.equal(reading.dimensions[0].scoreLine.includes("中间带 45%–55%"), strength === "balanced");
    assert.equal(reading.dimensions[0].strengthNote, interpretation.STRENGTHS[strength].text);
    const texts = interpretation.DIMENSIONS.IE.texts[reading.dimensions[0].side];
    assert.equal(reading.dimensions[0].expression, texts.expression);
    assert.equal(reading.dimensions[0].upside, texts.upside);
    assert.equal(reading.dimensions[0].watch, texts.watch);
  }
});

test("interaction pairs appear only when both dimensions are resolved and rank by combined distance", () => {
  const snft = interpretation.interpret(resultWith([0, 3, 5, 0]));
  assert.deepEqual(snft.interactions.map(item => item.title), ["信息与判断：你怎样把观察变成决定"]);

  const iejp = interpretation.interpret(resultWith([3, 0, 0, 3]));
  assert.deepEqual(iejp.interactions.map(item => item.title), ["能量与节奏：你怎样安排一天"]);

  const all = interpretation.interpret(resultWith([3, 3, 5, 3]));
  assert.deepEqual(all.interactions.map(item => item.title), [
    "信息与判断：你怎样把观察变成决定",
    "关系中的关心方式",
    "决定与执行：你怎样把判断变成行动"
  ]);

  const ranked = interpretation.interpret(resultWith([2, 10, 2, 10]));
  assert.deepEqual(ranked.interactions.map(item => item.title), [
    "探索与收束：你怎样从想法走到完成",
    "信息与判断：你怎样把观察变成决定",
    "能量与节奏：你怎样安排一天"
  ]);

  const ieft = interpretation.interpret(resultWith([3, 0, 5, 0]));
  assert.deepEqual(ieft.interactions.map(item => item.title), ["关系中的关心方式"]);
  assert.match(ieft.interactions[0].text, /讨论、建议和行动/);

  const onePair = interpretation.interpret(resultWith([0, 3, 0, 3]));
  assert.deepEqual(onePair.interactions.map(item => item.title), ["探索与收束：你怎样从想法走到完成"]);

  const none = interpretation.interpret(resultWith([0, 3, 0, 0]));
  assert.equal(none.interactions.length, 0);
});

test("public wording keeps its caveats and makes no probability, diagnosis, or fixed-type claim", () => {
  const reading = interpretation.interpret(resultWith([16, -16, 16, -16]));
  const allText = [
    reading.headline,
    ...reading.summary,
    ...reading.overall,
    ...reading.dimensions.flatMap(dimension => [
      dimension.directionLabel,
      dimension.strengthLabel,
      dimension.strengthNote,
      dimension.expression,
      dimension.upside,
      dimension.watch,
      dimension.scoreLine
    ]),
    ...reading.interactions.flatMap(item => [item.title, item.text]),
    ...reading.scenes.flatMap(scene => [scene.title, ...scene.items.flatMap(item => [item.name, item.label, item.text])]),
    ...reading.caveats
  ].join("\n");
  assert.doesNotMatch(allText, /你属于|你的类型是|正确率|匹配度|诊断(?:为|出)/);
  assert.doesNotMatch(allText, /\d+(?:\.\d+)?%\s*(?:的)?(?:概率|可能性|准确率)/);
  assert.match(allText, /不是 AI 推断/);
  assert.match(allText, /不是人群百分位/);
  assert.match(allText, /不表示人格无法判断/);
});

test("the same scoring result always produces identical text", () => {
  const first = interpretation.interpret(resultWith([4, -6, 2, 8]));
  const second = interpretation.interpret(resultWith([4, -6, 2, 8]));
  assert.deepEqual(first, second);
});

test("invalid scoring results are rejected before any interpretation is built", () => {
  const base = resultWith([2, 2, 2, 2]);
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    null, undefined, {}, { ...base, dimensions: base.dimensions.slice(0, 3) },
    { ...base, cautiousType: "esfj" },
    { ...base, originalType: "XXFJ" }
  ];
  const mutations = [
    result => { result.dimensions[0].key = "SN"; },
    result => { result.dimensions[0].score = 2.5; },
    result => { result.dimensions[0].score = 41; },
    result => { result.dimensions[0].position = NaN; },
    result => { result.dimensions[0].distance = "2"; },
    result => { result.dimensions[0].borderline = "yes"; },
    result => { delete result.dimensions[0].borderline; }
  ];
  for (const mutation of mutations) {
    const result = clone();
    mutation(result);
    cases.push(result);
  }
  for (const value of cases) {
    assert.throws(() => interpretation.interpret(value), /Invalid scoring result/);
  }
});

test("the browser build attaches to the global object without a module loader", () => {
  const context = { QUESTION_BANK: bank };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/core.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/interpret.js"), "utf8"), context);
  assert.equal(typeof context.MBTIInterpretation.interpret, "function");
  assert.equal(Object.isFrozen(context.MBTIInterpretation), true);
  assert.equal(Object.isFrozen(context.MBTIInterpretation.DIMENSIONS), true);
  assert.equal(Object.isFrozen(context.MBTIInterpretation.DIMENSIONS.IE), true);
  assert.equal(Object.isFrozen(context.MBTIInterpretation.DIMENSIONS.IE.texts), true);
  assert.equal(Object.isFrozen(context.MBTIInterpretation.DIMENSIONS.IE.texts.high.scenes), true);
  assert.equal(Object.isFrozen(context.MBTIInterpretation.INTERACTION_PAIRS), true);
  assert.equal(Object.isFrozen(context.MBTIInterpretation.SCENE_GROUPS), true);
  const reading = context.MBTIInterpretation.interpret(context.MBTICore.score(Array(32).fill(3)));
  assert.equal(reading.candidateCount, 16);
});
