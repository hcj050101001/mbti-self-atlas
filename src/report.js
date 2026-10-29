(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MBTIReport = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const disclaimer = '非官方 MBTI，中文试译，未经心理测量验证';
  const attribution = 'OEJTS 1.2 作者：Eric Jorgenson · CC BY-NC-SA 4.0';
  function create(answers, core, interpretation, config, date) {
    const result = core.score(answers);
    const reading = interpretation.interpret(result);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      title: '见己 · 四维探索', date: day,
      appVersion: String(config.appVersion), translationVersion: String(config.translationVersion),
      type: result.cautiousType,
      dimensions: result.dimensions.map((d, i) => ({
        key: d.key, low: d.low, high: d.high, score: d.score, position: d.position,
        name: reading.dimensions[i].name, lowLabel: interpretation.DIMENSIONS[d.key].lowLabel, highLabel: interpretation.DIMENSIONS[d.key].highLabel, direction: reading.dimensions[i].directionLabel,
        expression: reading.dimensions[i].expression, upside: reading.dimensions[i].upside, watch: reading.dimensions[i].watch
      })),
      summary: reading.overall.slice(0, 3), disclaimer, attribution
    };
  }
  function filename(report) { return `jianji-${report.type}-${report.date}.png`; }
  return Object.freeze({ create, filename, disclaimer, attribution });
});
