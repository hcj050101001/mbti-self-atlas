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

test("four balanced dimensions stay unresolved, list 16 candidates, and invent no interaction", () => {
  const reading = interpretation.interpret(core.score(Array(32).fill(3)));
  assert.equal(reading.headline, "你的回答目前呈现为 XXXX");
  assert.equal(reading.candidateCount, 16);
  assert.equal(reading.interactions.length, 0);
  assert.equal(reading.reflection.length, 3);
  assert.equal(reading.dimensions.length, 4);
  for (const dimension of reading.dimensions) {
    assert.equal(dimension.side, "balanced");
    assert.equal(dimension.strength, "balanced");
    assert.equal(dimension.strengthLabel, "中间带");
    assert.equal(dimension.directionLabel, "中间带");
    assert.match(dimension.scoreLine, /^原始分 24 \/ 40 · 刻度位置 50\.0% · 中间带 45%–55%$/);
    assert.equal(dimension.text, interpretation.DIMENSIONS[dimension.key].balancedText);
  }
  assert.ok(reading.summary.some(line => /16 种四字母组合/.test(line)));
  assert.ok(reading.summary.some(line => /23–25 分都视为中间带/.test(line)));
  assert.equal(reading.caveats.length, 3);
  assert.equal(Object.isFrozen(reading), true);
  assert.equal(Object.isFrozen(reading.caveats), true);
  assert.equal(Object.isFrozen(reading.dimensions), true);
});

test("fully resolved extreme answers produce strong dimensions, two interactions, and one candidate", () => {
  const reading = interpretation.interpret(resultWith([16, 16, 16, 16]));
  assert.equal(reading.headline, "你的回答整体偏向 ENTP");
  assert.equal(reading.candidateCount, 1);
  assert.deepEqual(reading.dimensions.map(dimension => dimension.strength), ["strong", "strong", "strong", "strong"]);
  assert.deepEqual(reading.dimensions.map(dimension => dimension.directionLabel), ["E · 外向", "N · 直觉", "T · 思考", "P · 知觉"]);
  assert.deepEqual(reading.interactions.map(item => item.title), [
    "信息与判断：你怎样把观察变成决定",
    "能量与节奏：你怎样安排一天"
  ]);
  assert.equal(reading.interactions.length, 2, "only the two highest-priority complete pairs are shown");
  assert.ok(reading.summary.some(line => /4 个很强/.test(line)));
  assert.ok(reading.summary.some(line => /不是固定人格/.test(line)));
});

test("strength bands switch at the declared distance boundaries", () => {
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
  }
});

test("interaction pairs appear only when both dimensions are resolved, in priority order", () => {
  const snft = interpretation.interpret(resultWith([0, 3, 5, 0]));
  assert.deepEqual(snft.interactions.map(item => item.title), ["信息与判断：你怎样把观察变成决定"]);

  const iejp = interpretation.interpret(resultWith([3, 0, 0, 3]));
  assert.deepEqual(iejp.interactions.map(item => item.title), ["能量与节奏：你怎样安排一天"]);

  const all = interpretation.interpret(resultWith([3, 3, 5, 3]));
  assert.deepEqual(all.interactions.map(item => item.title), [
    "信息与判断：你怎样把观察变成决定",
    "能量与节奏：你怎样安排一天"
  ]);

  const ieft = interpretation.interpret(resultWith([3, 0, 5, 0]));
  assert.deepEqual(ieft.interactions.map(item => item.title), ["关系中的关心方式"]);
  assert.match(ieft.interactions[0].text, /讨论与建议/);

  const none = interpretation.interpret(resultWith([0, 3, 0, 3]));
  assert.equal(none.interactions.length, 0);
});

test("reflection questions take balanced dimensions first, then the closest resolved ones", () => {
  const allBalanced = interpretation.interpret(resultWith([0, 0, 0, 0]));
  assert.deepEqual(allBalanced.reflection, [
    interpretation.DIMENSIONS.IE.prompt,
    interpretation.DIMENSIONS.SN.prompt,
    interpretation.DIMENSIONS.FT.prompt
  ]);

  const oneBalanced = interpretation.interpret(resultWith([0, 3, 5, 10]));
  assert.deepEqual(oneBalanced.reflection, [
    interpretation.DIMENSIONS.IE.prompt,
    interpretation.DIMENSIONS.SN.prompt,
    interpretation.DIMENSIONS.FT.prompt
  ]);

  const balancedLast = interpretation.interpret(resultWith([10, 5, 3, 0]));
  assert.deepEqual(balancedLast.reflection, [
    interpretation.DIMENSIONS.JP.prompt,
    interpretation.DIMENSIONS.FT.prompt,
    interpretation.DIMENSIONS.SN.prompt
  ]);
});

test("public wording keeps its caveats and makes no probability, diagnosis, or fixed-type claim", () => {
  const reading = interpretation.interpret(resultWith([16, -16, 16, -16]));
  const allText = [
    reading.headline,
    ...reading.summary,
    ...reading.dimensions.flatMap(dimension => [dimension.directionLabel, dimension.strengthLabel, dimension.text, dimension.scoreLine]),
    ...reading.interactions.flatMap(item => [item.title, item.text]),
    ...reading.reflection,
    ...reading.caveats
  ].join("\n");
  assert.doesNotMatch(allText, /你属于|你的类型是|正确率|匹配度|诊断(?:为|出)/);
  assert.doesNotMatch(allText, /\d+(?:\.\d+)?%\s*(?:的)?(?:概率|可能性|准确率)/);
  assert.match(allText, /不是 AI 推断/);
  assert.match(allText, /不是人群百分位/);
  assert.match(allText, /不表示人格无法判断/);
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
  const reading = context.MBTIInterpretation.interpret(context.MBTICore.score(Array(32).fill(3)));
  assert.equal(reading.candidateCount, 16);
});
