/*
 * Open Extended Jungian Type Scales, version 1.2 (OEJTS1.2).
 * Original questionnaire and scoring: https://openpsychometrics.org/tests/OJTS/development/OEJTS1.2.pdf
 * Questionnaire license: CC BY-NC-SA 4.0.
 * A score describes this questionnaire's preference scale, not a probability.
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MBTICore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SOURCE = "https://openpsychometrics.org/tests/OJTS/development/OEJTS1.2.pdf";
  var VERSION = "OEJTS1.2";
  var FORMULAS = Object.freeze({
    IE: "30-Q3-Q7-Q11+Q15-Q19+Q23+Q27-Q31",
    SN: "12+Q4+Q8+Q12+Q16+Q20-Q24-Q28+Q32",
    FT: "30-Q2+Q6+Q10-Q14-Q18+Q22-Q26-Q30",
    JP: "18+Q1+Q5-Q9+Q13-Q17+Q21-Q25+Q29"
  });
  var SCALES = [
    { key: "IE", low: "I", high: "E" },
    { key: "SN", low: "S", high: "N" },
    { key: "FT", low: "F", high: "T" },
    { key: "JP", low: "J", high: "P" }
  ];

  // A partial response is still a dense, 32-entry array; only null means unanswered.
  // Do not use Array#every here: it skips holes in a sparse array.
  function validateAnswers(answers, complete) {
    if (!Array.isArray(answers) || answers.length !== 32) return false;
    for (var i = 0; i < 32; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(answers, i)) return false;
      var value = answers[i];
      if (value === null && !complete) continue;
      if (!Number.isInteger(value) || value < 1 || value > 5) return false;
    }
    return true;
  }

  function score(answers) {
    if (!validateAnswers(answers, true)) {
      throw new TypeError("Expected a complete, dense array of 32 integer answers from 1 to 5.");
    }
    // Q uses the source's one-based item numbers to keep transcription reviewable.
    function Q(number) { return answers[number - 1]; }
    var rawScores = [
      30 - Q(3) - Q(7) - Q(11) + Q(15) - Q(19) + Q(23) + Q(27) - Q(31),
      12 + Q(4) + Q(8) + Q(12) + Q(16) + Q(20) - Q(24) - Q(28) + Q(32),
      30 - Q(2) + Q(6) + Q(10) - Q(14) - Q(18) + Q(22) - Q(26) - Q(30),
      18 + Q(1) + Q(5) - Q(9) + Q(13) - Q(17) + Q(21) - Q(25) + Q(29)
    ];
    var dimensions = SCALES.map(function (scale, index) {
      var raw = rawScores[index];
      var distance = Math.abs(raw - 24);
      return {
        key: scale.key,
        low: scale.low,
        high: scale.high,
        score: raw,
        letter: raw === 24 ? "X" : (raw < 24 ? scale.low : scale.high),
        distance: distance,
        // This ±2 review zone is a page convention, not a validated confidence interval.
        borderline: distance <= 2,
        // Graph coordinate only; never a likelihood, percentile, or accuracy estimate.
        position: (raw - 8) / 32 * 100
      };
    });
    return {
      dimensions: dimensions,
      // Preserve the original PDF's tie convention separately from the cautious display.
      originalType: dimensions.map(function (dimension) {
        return dimension.score > 24 ? dimension.high : dimension.low;
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
    validateAnswers: validateAnswers,
    score: score,
    candidates: candidates
  });
});
