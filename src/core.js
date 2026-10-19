/*
 * Open Extended Jungian Type Scales, version 1.2 (OEJTS1.2).
 * Original questionnaire and scoring: https://openpsychometrics.org/tests/OJTS/development/OEJTS1.2.pdf
 * Questionnaire license: CC BY-NC-SA 4.0.
 * A score describes this questionnaire's preference scale, not a probability.
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../sources/oejts-1.2.json"));
  } else {
    root.MBTICore = factory(root.QUESTION_BANK);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (bank) {
  "use strict";

  var SCALE_KEYS = ["IE", "SN", "FT", "JP"];
  // Display convention only: answers whose scale position falls in this band are
  // shown as X. It is not a confidence interval or a probability.
  var REVIEW_ZONE = Object.freeze({ minPercent: 45, maxPercent: 55 });

  function formulaFor(data, key) {
    return String(data.scales[key].constant) + data.items.filter(function (item) {
      return item.scale === key;
    }).map(function (item) {
      return (item.coefficient === 1 ? "+Q" : "-Q") + item.id;
    }).join("");
  }

  // The same validation runs in the browser, Node, and the build. Item directions
  // are stored only on the items; formulas and arithmetic are derived from them.
  function validateQuestionBank(data) {
    function fail(message) { throw new TypeError("Invalid questionnaire: " + message); }
    function nonempty(value) { return typeof value === "string" && value.trim().length > 0; }
    if (!data || typeof data !== "object") fail("missing question bank");
    ["instrument", "version", "sourceUrl", "license", "licenseUrl", "adaptation"].forEach(function (field) {
      if (!nonempty(data[field])) fail("missing " + field);
    });
    if (typeof data.translationVersion !== "string" || !/^\d+\.\d+(?:\.\d+)?$/.test(data.translationVersion)) fail("invalid translationVersion");
    if (data.itemCount !== 32 || !Array.isArray(data.items) || data.items.length !== data.itemCount) fail("expected 32 items");
    if (!data.scales || Object.keys(data.scales).join(",") !== SCALE_KEYS.join(",")) fail("expected IE, SN, FT, JP scale order");
    var response = data.responseScale;
    var scoring = data.scoring;
    if (!response || response.min !== 1 || response.max !== 5 || response.midpoint !== 3) fail("expected the original 1–5 response scale");
    if (!scoring || scoring.min !== 8 || scoring.max !== 40 || scoring.threshold !== 24) fail("expected OEJTS 1.2 scoring bounds 8/40/24");
    if (scoring.highWhen !== undefined && scoring.highWhen !== "score > " + scoring.threshold) fail("inconsistent highWhen");
    data.items.forEach(function (item, index) {
      if (!item || item.id !== index + 1) fail("invalid item order at Q" + (index + 1));
      ["leftEn", "rightEn", "leftZh", "rightZh"].forEach(function (field) {
        if (!nonempty(item[field])) fail("Q" + item.id + " is missing " + field);
      });
      if (SCALE_KEYS.indexOf(item.scale) < 0) fail("Q" + item.id + " has an invalid scale");
      if (item.coefficient !== -1 && item.coefficient !== 1) fail("Q" + item.id + " has an invalid coefficient");
    });
    SCALE_KEYS.forEach(function (key) {
      var scale = data.scales[key];
      if (!scale || !Number.isInteger(scale.constant) || scale.low !== key[0] || scale.high !== key[1]) fail("invalid " + key + " metadata");
      var terms = data.items.filter(function (item) { return item.scale === key; });
      if (terms.length !== 8) fail(key + " must contain exactly eight items");
      var minimum = scale.constant;
      var maximum = scale.constant;
      var midpoint = scale.constant;
      terms.forEach(function (item) {
        minimum += item.coefficient * (item.coefficient === 1 ? response.min : response.max);
        maximum += item.coefficient * (item.coefficient === 1 ? response.max : response.min);
        midpoint += item.coefficient * response.midpoint;
      });
      if (minimum !== scoring.min || maximum !== scoring.max || midpoint !== scoring.threshold) fail("inconsistent " + key + " constant or bounds");
      // If legacy reference metadata is supplied, it must agree with the item key.
      if (scale.formula !== undefined && (typeof scale.formula !== "string" || scale.formula.replace(/\s/g, "") !== formulaFor(data, key))) fail("inconsistent " + key + " formula");
      [["positive", 1], ["negative", -1]].forEach(function (entry) {
        var listed = scale[entry[0]];
        if (listed === undefined) return;
        var expected = terms.filter(function (item) { return item.coefficient === entry[1]; }).map(function (item) { return item.id; });
        if (!Array.isArray(listed) || listed.some(function (id) { return !Number.isInteger(id); }) ||
            listed.slice().sort(function (a, b) { return a - b; }).join(",") !== expected.join(",")) fail("inconsistent " + key + " " + entry[0] + " items");
      });
    });
    if (!Array.isArray(data.translationNotes) || data.translationNotes.length === 0) fail("translationNotes must be a non-empty array");
    var noteIds = [];
    data.translationNotes.forEach(function (note) {
      if (!note || (note.id !== null && (!Number.isInteger(note.id) || note.id < 1 || note.id > data.itemCount)) || !nonempty(note.note)) fail("invalid translation note");
      if (noteIds.indexOf(note.id) !== -1) fail("duplicate translation note");
      noteIds.push(note.id);
    });
    return true;
  }

  validateQuestionBank(bank);
  var SOURCE = bank.sourceUrl;
  var VERSION = "OEJTS" + bank.version;
  var ITEM_COUNT = bank.itemCount;
  var RESPONSE_MIN = bank.responseScale.min;
  var RESPONSE_MAX = bank.responseScale.max;
  var SCORE_MIN = bank.scoring.min;
  var SCORE_MAX = bank.scoring.max;
  var THRESHOLD = bank.scoring.threshold;
  var formulas = {};
  var SCALES = SCALE_KEYS.map(function (key) {
    var scale = bank.scales[key];
    formulas[key] = formulaFor(bank, key);
    return {
      key: key, low: scale.low, high: scale.high, constant: scale.constant,
      terms: bank.items.filter(function (item) { return item.scale === key; }).map(function (item) {
        return { index: item.id - 1, coefficient: item.coefficient };
      })
    };
  });
  var FORMULAS = Object.freeze(formulas);

  // A partial response is still a dense, 32-entry array; only null means unanswered.
  // Do not use Array#every here: it skips holes in a sparse array.
  function validateAnswers(answers, complete) {
    if (!Array.isArray(answers) || answers.length !== ITEM_COUNT) return false;
    for (var i = 0; i < ITEM_COUNT; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(answers, i)) return false;
      var value = answers[i];
      if (value === null && !complete) continue;
      if (!Number.isInteger(value) || value < RESPONSE_MIN || value > RESPONSE_MAX) return false;
    }
    return true;
  }

  function score(answers) {
    if (!validateAnswers(answers, true)) {
      throw new TypeError("Expected a complete, dense array of 32 integer answers from 1 to 5.");
    }
    var dimensions = SCALES.map(function (scale) {
      var raw = scale.terms.reduce(function (sum, term) { return sum + term.coefficient * answers[term.index]; }, scale.constant);
      var distance = Math.abs(raw - THRESHOLD);
      // Graph coordinate only; never a likelihood, percentile, or accuracy estimate.
      var position = (raw - SCORE_MIN) / (SCORE_MAX - SCORE_MIN) * 100;
      return {
        key: scale.key,
        low: scale.low,
        high: scale.high,
        score: raw,
        letter: raw === THRESHOLD ? "X" : (raw < THRESHOLD ? scale.low : scale.high),
        distance: distance,
        // 45%–55% of the 8–40 scale is the page's review band (23–25 points).
        borderline: position >= REVIEW_ZONE.minPercent && position <= REVIEW_ZONE.maxPercent,
        position: position
      };
    });
    return {
      dimensions: dimensions,
      // Preserve the original PDF's tie convention separately from the cautious display.
      originalType: dimensions.map(function (dimension) {
        return dimension.score > THRESHOLD ? dimension.high : dimension.low;
      }).join(""),
      type: dimensions.map(function (dimension) { return dimension.letter; }).join(""),
      cautiousType: dimensions.map(function (dimension) {
        return dimension.borderline ? "X" : dimension.letter;
      }).join("")
    };
  }

  // Enumerate the letters left unresolved by the page's review zone. Order carries no ranking.
  function candidates(scoreResult) {
    var type = scoreResult && scoreResult.cautiousType;
    if (typeof type !== "string" || !/^[IXE][SXN][FXT][JXP]$/.test(type)) {
      throw new TypeError("Expected a scoring result with a valid cautiousType.");
    }
    var types = [""];
    SCALES.forEach(function (scale, index) {
      var options = type[index] === "X" ? [scale.low, scale.high] : [type[index]];
      var next = [];
      types.forEach(function (prefix) {
        options.forEach(function (letter) { next.push(prefix + letter); });
      });
      types = next;
    });
    return types;
  }

  return Object.freeze({
    SOURCE: SOURCE,
    VERSION: VERSION,
    FORMULAS: FORMULAS,
    REVIEW_ZONE: REVIEW_ZONE,
    validateQuestionBank: validateQuestionBank,
    validateAnswers: validateAnswers,
    score: score,
    candidates: candidates
  });
});
