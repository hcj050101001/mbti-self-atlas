"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../src/core.js");
const bank = require("../sources/oejts-1.2.json");

// Independently transcribed item directions from the questionnaire scoring key.
// Each tuple says which preference dimension increases when this answer increases.
const itemDirections = [
  ["JP", 1], ["FT", -1], ["IE", -1], ["SN", 1],
  ["JP", 1], ["FT", 1], ["IE", -1], ["SN", 1],
  ["JP", -1], ["FT", 1], ["IE", -1], ["SN", 1],
  ["JP", 1], ["FT", -1], ["IE", 1], ["SN", 1],
  ["JP", -1], ["FT", -1], ["IE", -1], ["SN", 1],
  ["JP", 1], ["FT", 1], ["IE", 1], ["SN", -1],
  ["JP", -1], ["FT", -1], ["IE", 1], ["SN", -1],
  ["JP", 1], ["FT", -1], ["IE", -1], ["SN", 1]
];
const scales = ["IE", "SN", "FT", "JP"];
const allTypes = [
  "ISFJ", "ISFP", "ISTJ", "ISTP", "INFJ", "INFP", "INTJ", "INTP",
  "ESFJ", "ESFP", "ESTJ", "ESTP", "ENFJ", "ENFP", "ENTJ", "ENTP"
];

test("a hand-calculated complete response keeps source scores and scale order", () => {
  const answers = [
    1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1,
    2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2
  ];
  const before = answers.slice();
  const result = core.score(answers);
  assert.deepEqual(result.dimensions, [
    { key: "IE", low: "I", high: "E", score: 29, letter: "E", distance: 5, borderline: false, position: 65.625 },
    { key: "SN", low: "S", high: "N", score: 22, letter: "S", distance: 2, borderline: false, position: 43.75 },
    { key: "FT", low: "F", high: "T", score: 23, letter: "F", distance: 1, borderline: true, position: 46.875 },
    { key: "JP", low: "J", high: "P", score: 21, letter: "J", distance: 3, borderline: false, position: 40.625 }
  ]);
  assert.equal(result.type, "ESFJ");
  assert.equal(result.originalType, "ESFJ");
  assert.equal(result.cautiousType, "ESXJ");
  assert.deepEqual(answers, before, "scoring must not mutate saved responses");
});

test("partial validation accepts explicit nulls but complete scoring never fills them", () => {
  const empty = Array(32).fill(null);
  assert.equal(core.validateAnswers(empty), true);
  assert.equal(core.validateAnswers(empty, true), false);
  assert.throws(() => core.score(empty), TypeError);
  const partial = Array(32).fill(3);
  partial[17] = null;
  assert.equal(core.validateAnswers(partial), true);
  assert.equal(core.validateAnswers(partial, true), false);
  assert.throws(() => core.score(partial), TypeError);
  assert.equal(core.validateAnswers(Array(32).fill(3), true), true);
});

test("invalid shape, holes, inherited entries, values, and numeric strings are rejected", () => {
  const invalid = [null, undefined, {}, "3".repeat(32), new Uint8Array(32), [], Array(31).fill(3), Array(33).fill(3), Array(32)];
  const hole = Array(32).fill(3);
  delete hole[10];
  invalid.push(hole);
  const inheritedEntry = Array(32).fill(3);
  delete inheritedEntry[10];
  const parent = Object.create(Array.prototype);
  parent[10] = 3;
  Object.setPrototypeOf(inheritedEntry, parent);
  invalid.push(inheritedEntry);
  for (const badValue of [undefined, NaN, Infinity, -Infinity, 0, 6, -1, 2.5, "3", true, false, {}, []]) {
    const answers = Array(32).fill(3);
    answers[4] = badValue;
    invalid.push(answers);
  }
  for (const answers of invalid) {
    assert.equal(core.validateAnswers(answers), false);
    assert.equal(core.validateAnswers(answers, true), false);
    assert.throws(() => core.score(answers), TypeError);
  }
});

test("neutral answers remain unresolved on all dimensions", () => {
  const result = core.score(Array(32).fill(3));
  assert.equal(result.originalType, "ISFJ", "the PDF assigns ties to the low-side letters");
  assert.equal(result.type, "XXXX");
  assert.equal(result.cautiousType, "XXXX");
  assert.deepEqual(result.dimensions.map(d => d.score), [24, 24, 24, 24]);
  assert.ok(result.dimensions.every(d => d.distance === 0 && d.borderline && d.position === 50));
});

test("constant answers preserve the unequal reverse-keying in the source", () => {
  const ones = core.score(Array(32).fill(1));
  const fives = core.score(Array(32).fill(5));
  assert.deepEqual(ones.dimensions.map(d => d.score), [28, 16, 28, 20]);
  assert.equal(ones.type, "ESTJ");
  assert.deepEqual(fives.dimensions.map(d => d.score), [20, 32, 20, 28]);
  assert.equal(fives.type, "INFP");
});

test("all 16 endpoint combinations produce the expected types and 8/40 bounds", () => {
  const highLetters = ["E", "N", "T", "P"];
  for (const type of allTypes) {
    const answers = itemDirections.map(([key, direction]) => {
      const index = scales.indexOf(key);
      const wantsHigh = type[index] === highLetters[index];
      return wantsHigh === (direction === 1) ? 5 : 1;
    });
    const result = core.score(answers);
    assert.equal(result.originalType, type);
    assert.equal(result.type, type);
    assert.equal(result.cautiousType, type);
    result.dimensions.forEach((dimension, index) => {
      const high = type[index] === highLetters[index];
      assert.equal(dimension.score, high ? 40 : 8, `${type}/${dimension.key}`);
      assert.equal(dimension.position, high ? 100 : 0);
      assert.equal(dimension.distance, 16);
      assert.equal(dimension.borderline, false);
    });
    assert.deepEqual(core.candidates(result), [type]);
  }
});

test("each of the 32 items moves exactly one expected dimension by its signed step", () => {
  itemDirections.forEach(([affectedKey, direction], index) => {
    for (const response of [1, 2, 4, 5]) {
      const answers = Array(32).fill(3);
      answers[index] = response;
      const result = core.score(answers);
      for (const dimension of result.dimensions) {
        const expected = dimension.key === affectedKey ? 24 + direction * (response - 3) : 24;
        assert.equal(dimension.score, expected, `Q${index + 1}=${response}, ${dimension.key}`);
      }
    }
  });
});

test("the custom review zone includes only ±1 (23–25) and excludes ±2 on either side", () => {
  for (const [offset, borderline] of [[-3, false], [-2, false], [-1, true], [0, true], [1, true], [2, false], [3, false]]) {
    const answers = Array(32).fill(3);
    // Q15 and Q23 both increase E: together they produce the requested displacement.
    const first = Math.max(-2, Math.min(2, offset));
    answers[14] += first;
    answers[22] += offset - first;
    const result = core.score(answers);
    assert.equal(result.dimensions[0].score, 24 + offset);
    assert.equal(result.dimensions[0].borderline, borderline);
    assert.equal(result.cautiousType[0], borderline ? "X" : (offset < 0 ? "I" : "E"));
  }
});

test("candidates enumerate all unresolved letters without ranking or duplicates", () => {
  assert.deepEqual(core.candidates(core.score(Array(32).fill(3))), allTypes);
  assert.deepEqual(core.candidates({ cautiousType: "EXXJ" }), ["ESFJ", "ESTJ", "ENFJ", "ENTJ"]);
  assert.deepEqual(core.candidates({ cautiousType: "INTP" }), ["INTP"]);
  for (const malformed of [null, {}, { cautiousType: "" }, { cautiousType: "IESN" }, { cautiousType: "intp" }, { cautiousType: 1234 }]) {
    assert.throws(() => core.candidates(malformed), TypeError);
  }
});

test("source metadata is exposed, immutable, and the script works without a module loader", () => {
  assert.equal(core.VERSION, "OEJTS1.2");
  assert.equal(core.SOURCE, "https://openpsychometrics.org/tests/OJTS/development/OEJTS1.2.pdf");
  assert.deepEqual(Object.keys(core.FORMULAS), scales);
  assert.deepEqual(core.FORMULAS, {
    IE: "30-Q3-Q7-Q11+Q15-Q19+Q23+Q27-Q31",
    SN: "12+Q4+Q8+Q12+Q16+Q20-Q24-Q28+Q32",
    FT: "30-Q2+Q6+Q10-Q14-Q18+Q22-Q26-Q30",
    JP: "18+Q1+Q5-Q9+Q13-Q17+Q21-Q25+Q29"
  });
  assert.deepEqual(core.REVIEW_ZONE, { minPercent: 45, maxPercent: 55 });
  assert.equal(Object.isFrozen(core.REVIEW_ZONE), true);
  assert.equal(Object.isFrozen(core), true);
  assert.equal(Object.isFrozen(core.FORMULAS), true);
  const browserContext = { QUESTION_BANK: bank };
  vm.createContext(browserContext);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/core.js"), "utf8"), browserContext);
  assert.equal(browserContext.MBTICore.score(Array(32).fill(3)).type, "XXXX");
});

test("the canonical bank validates all item fields, signed membership, constants, and bounds", () => {
  assert.equal(core.validateQuestionBank(bank), true);
  const corruptions = [
    data => { data.items[0].id = 2; },
    data => { data.items[0].leftEn = " "; },
    data => { data.items[0].rightZh = null; },
    data => { data.items[0].coefficient = 0; },
    data => { data.items[0].scale = "EI"; },
    data => { data.items[0].scale = "IE"; },
    data => { data.scales.IE.constant += 1; },
    data => { data.scoring.min += 1; },
    data => { data.scoring.max -= 1; },
    data => { data.scoring.threshold += 1; },
    data => { data.responseScale.max = 6; },
    data => { data.translationVersion = ""; },
    data => { data.translationVersion = 1.1; },
    data => { data.translationNotes = []; },
    data => { data.translationNotes[0].id = 33; },
    data => { data.translationNotes[0].note = ""; },
    data => { data.translationNotes.push(data.translationNotes[0]); },
    data => { data.scales.IE.formula = "30+Q3"; },
    data => { data.scales.IE.negative = [3, 7, 11, 19, 19]; },
    data => { data.scales.IE.negative = ["3", 7, 11, 19, 31]; },
    data => { data.scoring.highWhen = "score >= 24"; }
  ];
  for (const corrupt of corruptions) {
    const data = JSON.parse(JSON.stringify(bank));
    corrupt(data);
    assert.throws(() => core.validateQuestionBank(data), /Invalid questionnaire/);
  }
});

test("a coherent offset of every scoring scale cannot silently change the instrument bounds", () => {
  const data = JSON.parse(JSON.stringify(bank));
  for (const scale of Object.values(data.scales)) scale.constant += 1;
  data.scoring.min += 1;
  data.scoring.max += 1;
  data.scoring.threshold += 1;
  data.scoring.highWhen = "score > 25";
  assert.throws(() => core.validateQuestionBank(data), /expected OEJTS 1.2 scoring bounds 8\/40\/24/);
});

test("legacy scoring references must agree with the single item definition", () => {
  const data = JSON.parse(JSON.stringify(bank));
  data.scales.IE.formula = "30 - Q3 - Q7 - Q11 + Q15 - Q19 + Q23 + Q27 - Q31";
  data.scales.IE.negative = [31, 19, 11, 7, 3];
  data.scales.IE.positive = [15, 23, 27];
  assert.equal(core.validateQuestionBank(data), true);
  data.scales.IE.positive.push(31);
  assert.throws(() => core.validateQuestionBank(data), /inconsistent IE positive/);
});
