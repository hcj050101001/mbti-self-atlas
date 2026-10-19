/*
 * Local, deterministic interpretation rules for the OEJTS 1.2 result page.
 * These texts are explanatory prompts, not a diagnosis, a probability, or a
 * validated type description.
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MBTIInterpretation = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DIMENSIONS = Object.freeze({
    IE: Object.freeze({
      name: "与外界的互动", low: "I", high: "E", lowLabel: "内向", highLabel: "外向",
      lowText: "本次回答偏向独处、倾听和独立活动。可以结合社交后自己的实际感受来理解。",
      highText: "本次回答偏向交流、群体活动和向外表达。可以结合不同社交场景来理解。",
      balancedText: "在独处与交往之间，你可能更看场景和当天状态。可以回想：哪些活动结束后让你更有能量？",
      prompt: "与人相处之后，你通常想继续交流，还是需要一段独处？"
    }),
    SN: Object.freeze({
      name: "关注信息的方式", low: "S", high: "N", lowLabel: "实感", highLabel: "直觉",
      lowText: "本次回答偏向具体事实、细节和已有经验。并不意味着缺乏想象力。",
      highText: "本次回答偏向可能性、整体含义和理论。并不意味着忽视现实。",
      balancedText: "你可能在具体细节与整体可能性之间来回切换。可以留意：新任务里你先抓住的是事实，还是方向？",
      prompt: "学习新事物时，你更自然地从具体实例入手，还是先寻找整体规律？"
    }),
    FT: Object.freeze({
      name: "判断时的侧重", low: "F", high: "T", lowLabel: "情感", highLabel: "思考",
      lowText: "本次回答偏向感受、关怀和人际考虑。并不意味着不善于逻辑思考。",
      highText: "本次回答偏向理性分析、公正和一致的标准。并不意味着缺少共情。",
      balancedText: "做判断时，你可能同时考虑感受与原则，比例取决于事情本身。可以回想一次两难决定。",
      prompt: "遇到有争议的决定时，你最先想到的理由是什么？请举一个真实例子。"
    }),
    JP: Object.freeze({
      name: "安排生活的方式", low: "J", high: "P", lowLabel: "判断", highLabel: "知觉",
      lowText: "本次回答偏向计划、准备和明确安排。并不等同于更自律或更优秀。",
      highText: "本次回答偏向灵活、临场调整和保留选择。并不等同于没有责任心。",
      balancedText: "你可能既享受计划，也需要留出调整空间。可以留意：什么样的安排让你最安心？",
      prompt: "没有外部期限要求时，你通常提前定好安排，还是保留调整空间？"
    })
  });

  var ORDER = Object.freeze(["IE", "SN", "FT", "JP"]);

  var STRENGTHS = Object.freeze({
    balanced: Object.freeze({ label: "中间带", text: "两侧得分接近，单次回答不足以判定方向。" }),
    slight: Object.freeze({ label: "轻微", text: "有一点倾向，但还很灵活，换一个场景可能就会不同。" }),
    clear: Object.freeze({ label: "明显", text: "倾向比较清楚，通常能在多个场景中感觉到。" }),
    strong: Object.freeze({ label: "很强", text: "倾向很强，但它描述的是偏好，不是能力或固定标签。" })
  });

  var INTERACTION_PAIRS = Object.freeze([
    Object.freeze({
      keys: Object.freeze(["SN", "FT"]),
      title: "信息与判断：你怎样把观察变成决定",
      texts: Object.freeze({
        "low,low": "你更容易先接住具体事实与人的感受，再作决定。优势是贴近现场；压力下可能忽略长期模式或一致标准。",
        "low,high": "你倾向于依据具体证据和一致标准判断。优势是可检验；压力下可能低估情绪与人际成本。",
        "high,low": "你倾向于先看可能性与人的处境，再作决定。优势是看见潜力；压力下可能忽略执行细节。",
        "high,high": "你倾向于从整体模式与原则出发判断。优势是抓住结构；压力下可能离具体经验太远。"
      })
    }),
    Object.freeze({
      keys: Object.freeze(["IE", "JP"]),
      title: "能量与节奏：你怎样安排一天",
      texts: Object.freeze({
        "low,low": "你常先在心里想清楚，再按计划推进。留出独处和准备时间，通常能发挥得更好。",
        "low,high": "你偏好保留空间、按状态调整，同时需要独处恢复。完全排满的日程可能让你疲惫。",
        "high,low": "你从互动中获得能量，也喜欢把安排定下来。注意给自己留一点不被打断的缓冲。",
        "high,high": "你在交流与变化中比较自在，计划更像起点而非约束。需要交付时，外部节点会有帮助。"
      })
    }),
    Object.freeze({
      keys: Object.freeze(["IE", "FT"]),
      title: "关系中的关心方式",
      texts: Object.freeze({
        "low,low": "你常以安静、具体的方式关心别人，未必直接说出来。对方不一定能自动读懂。",
        "low,high": "你更习惯用分析或解决问题来表达关心，可能需要说明“我在意你”本身。",
        "high,low": "你容易在交流中直接回应情绪，也承担较多关系里的情绪劳动。记得区分哪些是自己的责任。",
        "high,high": "你会把关心放进讨论与建议里。先确认对方需要倾听还是方案，会更贴合。"
      })
    })
  ]);

  var GENERIC_QUESTIONS = Object.freeze([
    "回想最近一周：哪些场景让你觉得自己更像左边，哪些更像右边？",
    "在压力很大或很放松时，你的表现会和这次回答不同吗？",
    "有没有一个你欣赏的人，他的偏好与你相反？你如何看待这种差异？"
  ]);

  var CAVEATS = Object.freeze([
    "以上文字由页面内置的固定规则根据分数生成，不是 AI 推断，也不是心理诊断或能力评价。",
    "刻度位置是原始分在 8–40 量表上的线性位置，不是人群百分位、准确率或成为某类型的概率。",
    "中文题目为未经心理测量验证的试译；X 只表示 45%–55% 中间带，不表示“混合类型”，也不表示人格无法判断。"
  ]);

  function fail(message) { throw new TypeError("Invalid scoring result: " + message); }

  function validate(scoreResult) {
    if (!scoreResult || typeof scoreResult !== "object" || !Array.isArray(scoreResult.dimensions)) fail("missing dimensions");
    if (scoreResult.dimensions.length !== ORDER.length) fail("expected four dimensions");
    scoreResult.dimensions.forEach(function (dimension, index) {
      var key = ORDER[index];
      if (!dimension || dimension.key !== key) fail("unexpected dimension order");
      if (!Number.isInteger(dimension.score) || dimension.score < 8 || dimension.score > 40) fail("invalid score for " + key);
      if (typeof dimension.position !== "number" || !Number.isFinite(dimension.position)) fail("invalid position for " + key);
      if (typeof dimension.distance !== "number" || !Number.isFinite(dimension.distance)) fail("invalid distance for " + key);
      if (typeof dimension.borderline !== "boolean") fail("invalid borderline flag for " + key);
    });
    if (typeof scoreResult.cautiousType !== "string" || !/^[IXE][SXN][FXT][JXP]$/.test(scoreResult.cautiousType)) fail("invalid cautiousType");
    if (typeof scoreResult.originalType !== "string" || !/^[IE][SN][FT][JP]$/.test(scoreResult.originalType)) fail("invalid originalType");
  }

  function sideOf(dimension) {
    return dimension.borderline ? "balanced" : dimension.score > 24 ? "high" : "low";
  }

  function strengthOf(dimension) {
    if (dimension.borderline) return "balanced";
    if (dimension.distance <= 4) return "slight";
    if (dimension.distance <= 9) return "clear";
    return "strong";
  }

  function directionLabel(key, side) {
    var meta = DIMENSIONS[key];
    if (side === "balanced") return "中间带";
    return side === "low" ? meta.low + " · " + meta.lowLabel : meta.high + " · " + meta.highLabel;
  }

  function interpretationText(key, side, strength) {
    var meta = DIMENSIONS[key];
    if (side === "balanced") return meta.balancedText;
    var base = side === "low" ? meta.lowText : meta.highText;
    return base + " " + STRENGTHS[strength].text;
  }

  function scoreLine(dimension) {
    var line = "原始分 " + dimension.score + " / 40 · 刻度位置 " + dimension.position.toFixed(1) + "%";
    return dimension.borderline ? line + " · 中间带 45%–55%" : line;
  }

  function buildSummary(result, dimensions, balancedCount, candidateCount) {
    var resolvedCount = dimensions.length - balancedCount;
    var summary = [];
    if (balancedCount === 0) {
      summary.push("四个维度都位于 45%–55% 的中间带之外，因此本次回答可以读作 " + result.cautiousType + "。这只是此刻的偏好轮廓，不是固定人格。");
    } else if (resolvedCount === 0) {
      summary.push("四个维度都落在 45%–55% 的中间带内，因此本次回答没有足够依据判定任何一侧。");
    } else {
      summary.push(resolvedCount + " 个维度有较明确方向，" + balancedCount + " 个位于 45%–55% 中间带，暂时用 X 表示。");
    }
    var counts = { strong: 0, clear: 0, slight: 0 };
    dimensions.forEach(function (dimension) { if (dimension.strength !== "balanced") counts[dimension.strength] += 1; });
    if (resolvedCount > 0) {
      var parts = [];
      if (counts.strong) parts.push(counts.strong + " 个很强");
      if (counts.clear) parts.push(counts.clear + " 个明显");
      if (counts.slight) parts.push(counts.slight + " 个轻微");
      summary.push("在已有方向的维度中，" + parts.join("、") + "。强度只描述这次回答偏离中点的幅度，不代表能力高低。");
    }
    if (balancedCount > 0) {
      summary.push("若把每个中间带的两种方向都算上，会展开为 " + candidateCount + " 种四字母组合；这里不排序、不预测，也不把它们当作可能性评分。");
    }
    summary.push("原量表在恰好 24 分时归入低侧字母；本页把 23–25 分都视为中间带，并保留原规则结果 " + result.originalType + " 供对照。");
    return summary;
  }

  function buildInteractions(dimensionsByKey) {
    var interactions = [];
    INTERACTION_PAIRS.forEach(function (pair) {
      if (interactions.length >= 2) return;
      var first = dimensionsByKey[pair.keys[0]];
      var second = dimensionsByKey[pair.keys[1]];
      if (first.side === "balanced" || second.side === "balanced") return;
      interactions.push({ title: pair.title, text: pair.texts[first.side + "," + second.side] });
    });
    return interactions;
  }

  function buildReflection(scoreResult, dimensions) {
    var sourceDistance = {};
    scoreResult.dimensions.forEach(function (dimension) { sourceDistance[dimension.key] = dimension.distance; });
    var questions = [];
    function add(question) {
      if (questions.length < 3 && questions.indexOf(question) === -1) questions.push(question);
    }
    dimensions.forEach(function (dimension) { if (dimension.side === "balanced") add(DIMENSIONS[dimension.key].prompt); });
    dimensions.slice().sort(function (a, b) {
      return sourceDistance[a.key] - sourceDistance[b.key];
    }).forEach(function (dimension) {
      if (dimension.side !== "balanced") add(DIMENSIONS[dimension.key].prompt);
    });
    GENERIC_QUESTIONS.forEach(add);
    return questions;
  }

  function interpret(scoreResult) {
    validate(scoreResult);
    var dimensionsByKey = {};
    var dimensions = scoreResult.dimensions.map(function (dimension) {
      var side = sideOf(dimension);
      var strength = strengthOf(dimension);
      var item = {
        key: dimension.key,
        name: DIMENSIONS[dimension.key].name,
        side: side,
        directionLabel: directionLabel(dimension.key, side),
        strength: strength,
        strengthLabel: STRENGTHS[strength].label,
        text: interpretationText(dimension.key, side, strength),
        scoreLine: scoreLine(dimension)
      };
      dimensionsByKey[dimension.key] = item;
      return item;
    });
    var balancedCount = dimensions.filter(function (dimension) { return dimension.side === "balanced"; }).length;
    var candidateCount = Math.pow(2, balancedCount);
    var interactions = buildInteractions(dimensionsByKey);
    var headline = balancedCount === 0
      ? "你的回答整体偏向 " + scoreResult.cautiousType
      : "你的回答目前呈现为 " + scoreResult.cautiousType;
    return Object.freeze({
      headline: headline,
      summary: Object.freeze(buildSummary(scoreResult, dimensions, balancedCount, candidateCount)),
      dimensions: Object.freeze(dimensions),
      interactions: Object.freeze(interactions),
      reflection: Object.freeze(buildReflection(scoreResult, dimensions)),
      caveats: CAVEATS,
      candidateCount: candidateCount
    });
  }

  return Object.freeze({
    DIMENSIONS: DIMENSIONS,
    interpret: interpret
  });
});
