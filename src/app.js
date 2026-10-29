(function () {
  'use strict';
  const Core = window.MBTICore;
  const Bank = window.QUESTION_BANK;
  const items = Bank.items;
  const STORAGE_KEY = 'self-atlas.oejts12.zh.v1';
  const Config = window.APP_CONFIG || {};
  const APP_VERSION = Config.appVersion || 'development';
  const STORAGE_SCHEMA_VERSION = Config.storageSchemaVersion || 2;
  const main = document.getElementById('main');
  const persistenceNotice = document.createElement('p');
  persistenceNotice.id = 'storageConflict'; persistenceNotice.className = 'notice-inline'; persistenceNotice.hidden = true;
  persistenceNotice.setAttribute('role', 'alert');
  main.before(persistenceNotice);
  const dialog = document.getElementById('infoDialog');
  const dialogContent = document.getElementById('dialogContent');
  const labels = ['很像左边', '偏向左边', '中间 / 都像', '偏向右边', '很像右边'];
  const SUMMARY_DISCLAIMER = '非官方 MBTI，中文试译，未经心理测量验证。';
  const translationHints = new Map((Array.isArray(Bank.translationNotes) ? Bank.translationNotes : []).flatMap(note => Number.isInteger(note.id) ? [[note.id, note.note]] : []));
  function browserNavigator() { return typeof navigator === 'undefined' ? null : navigator; }
  function canWebShare() { const nav = browserNavigator(); return !!(nav && typeof nav.share === 'function'); }
  function summaryText() {
    const result = Core.score(state.answers);
    const lines = ['见己 · 四维探索', `偏好轮廓：${result.cautiousType}`];
    result.dimensions.forEach(dimension => lines.push(`${dimension.key} ${dimension.low}/${dimension.high} 原始分 ${dimension.score}/40 · 刻度位置 ${dimension.position.toFixed(1)}%`));
    lines.push(SUMMARY_DISCLAIMER);
    return lines.join('\n');
  }
  async function writeClipboard(text) {
    const nav = browserNavigator();
    if (!nav || !nav.clipboard || typeof nav.clipboard.writeText !== 'function') {
      notice('此浏览器不能写入剪贴板。摘要仍在本页，没有生成文件。');
      return false;
    }
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch (_) {
      notice('未能写入剪贴板。摘要仍在本页，没有生成文件。');
      return false;
    }
  }
  function freshState() { return { answers: Array(32).fill(null), flags: [], index: 0, view: 'welcome', autoNext: true, english: false, remember: false, startedAt: null, completedAt: null, activeMs: 0 }; }
  let state = freshState();
  let recovered = false;
  let storageWorking = true;
  let filter = 'all';
  let pendingNext = null;
  let toastTimer = null;
  let activeStart = null;
  let pointerChoice = false;
  let returnToReview = false;
  let storageSnapshot = null;
  let storageSession = null;
  let storageRevision = 0;
  let persistenceInvalidated = false;
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function count() { return state.answers.filter(Number.isInteger).length; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function cancelNext() { if (pendingNext !== null) { clearTimeout(pendingNext); pendingNext = null; } }
  function checkpoint() {
    const now = Date.now();
    if (activeStart !== null) state.activeMs += Math.max(0, now - activeStart);
    activeStart = !document.hidden && ['question', 'review'].includes(state.view) ? now : null;
  }
  function notice(text) {
    const box = document.getElementById('toast');
    box.textContent = text;
    box.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('visible'), 3200);
  }
  function newSessionId() { return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function saveStatusText() { return state.remember && storageWorking ? '● 进度自动保存在此设备' : persistenceInvalidated ? '○ 保存会话已失效；当前回答仅保留在此页面' : '○ 仅保留在当前页面，关闭或刷新会丢失'; }
  function updateSaveStatus() { const status = main.querySelector('[data-save-status]'); if (status) status.textContent = saveStatusText(); }
  function invalidatePersistence(quiet = false) {
    state.remember = false;
    persistenceInvalidated = true;
    cancelNext();
    persistenceNotice.textContent = '此页面的保存会话已失效：其他页面已清空、关闭保存或更新了草稿。当前回答仅保留在此页面，不会覆盖其他页面的数据。请刷新页面载入最新草稿；若草稿已被清空，需要重新开始一份回答。';
    persistenceNotice.hidden = false;
    if (!quiet) {
      dialogContent.innerHTML = '<h2>此页面的保存会话已失效</h2><p class="notice-inline" role="alert">其他页面已清空、关闭保存或更新了草稿。当前回答仅保留在此页面，后续操作不会覆盖其他页面的数据。</p><p>请刷新页面载入最新草稿；若草稿已被清空，需要重新开始一份回答。</p><div class="confirm-actions"><button class="button secondary" data-action="cancelReset">保留此页面的回答</button></div>';
      dialog.setAttribute('aria-label', '保存会话已失效');
      if (!dialog.open) dialog.showModal();
    }
    // Do not redraw: a storage event may arrive during another interaction.
    for (const id of ['remember', 'rememberDialog']) { const checkbox = document.getElementById(id); if (checkbox) checkbox.checked = false; }
    updateSaveStatus();
  }
  function save() {
    checkpoint();
    if (!state.remember) return false;
    try {
      // storage events are asynchronous; always verify the persisted identity before writing.
      if (localStorage.getItem(STORAGE_KEY) !== storageSnapshot) { invalidatePersistence(); return false; }
      const revision = storageRevision + 1;
      const text = JSON.stringify({ ...state, storageSchemaVersion: STORAGE_SCHEMA_VERSION, appVersion: APP_VERSION, sessionId: storageSession, revision });
      localStorage.setItem(STORAGE_KEY, text);
      storageSnapshot = text; storageRevision = revision; storageWorking = true;
      updateSaveStatus();
      return true;
    }
    catch (_) { if (storageWorking) notice('浏览器未能保存进度；请保持页面打开，关闭或刷新后这份回答会丢失。'); storageWorking = false; updateSaveStatus(); return false; }
  }
  function patchState(patch) {
    Object.assign(state, patch);
    save();
  }
  function load() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      storageSnapshot = text;
      if (!text) return;
      const draft = JSON.parse(text);
      const legacy = draft.storageSchemaVersion === undefined && draft.version === '1.0.0';
      if ((!legacy && draft.storageSchemaVersion !== STORAGE_SCHEMA_VERSION) || draft.remember !== true || !Core.validateAnswers(draft.answers) || (!legacy && (typeof draft.sessionId !== 'string' || !draft.sessionId || !Number.isSafeInteger(draft.revision) || draft.revision < 1))) {
        incompatibleDraft(); return;
      }
      storageSession = legacy ? newSessionId() : draft.sessionId;
      storageRevision = legacy ? 0 : draft.revision;
      state.answers = draft.answers;
      state.flags = Array.isArray(draft.flags) ? [...new Set(draft.flags.filter(n => Number.isInteger(n) && n >= 1 && n <= 32))] : [];
      state.index = Number.isInteger(draft.index) && draft.index >= 0 && draft.index < 32 ? draft.index : 0;
      state.autoNext = draft.autoNext !== false;
      state.english = draft.english === true;
      state.remember = true;
      state.startedAt = typeof draft.startedAt === 'string' && Number.isFinite(Date.parse(draft.startedAt)) ? draft.startedAt : null;
      state.completedAt = typeof draft.completedAt === 'string' && Number.isFinite(Date.parse(draft.completedAt)) && count() === 32 ? draft.completedAt : null;
      state.activeMs = Number.isFinite(draft.activeMs) && draft.activeMs >= 0 ? Math.min(draft.activeMs, 31536000000) : 0;
      recovered = count() > 0;
    } catch (error) {
      if (error instanceof SyntaxError || error.name === 'SyntaxError' || error.name === 'TypeError') incompatibleDraft();
      else storageWorking = false;
    }
  }
  function incompatibleDraft() {
    for (const id of ['remember', 'rememberDialog']) { const checkbox = document.getElementById(id); if (checkbox) checkbox.checked = false; }
    dialogContent.innerHTML = '<h2>保存的草稿无法载入</h2><p class="notice-inline" role="alert">此草稿使用了不兼容的存储格式，或内容已经损坏。原数据仍保留在此设备，没有被覆盖。</p><p>请使用兼容版本打开，或确认不再需要后清空并重新开始。</p><div class="confirm-actions"><button class="button secondary" data-action="cancelReset">保留原草稿</button><button class="button primary" data-action="reset">清空并重新开始</button></div>';
    dialog.setAttribute('aria-label', '草稿格式不兼容');
    if (!dialog.open) dialog.showModal();
  }
  function renderKeepingFocus(selector) { render(); const target = main.querySelector(selector); if (target) target.focus({ preventScroll: true }); }
  function setView(view, focus = true) {
    cancelNext(); checkpoint(); state.view = view; checkpoint(); save();
    render();
    if (focus) {
      const heading = main.querySelector('[data-focus]');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  function steps(current) {
    return '<div class="steps" aria-label="测评步骤">' + ['阅读说明', '回答问题', '检查答案', '偏好轮廓'].map((label, i) => `${i ? '<span class="step-line" aria-hidden="true"></span>' : ''}<span class="step ${i === current ? 'active' : i < current ? 'done' : ''}" ${i === current ? 'aria-current="step"' : ''}><i aria-hidden="true">${i < current ? '✓' : i + 1}</i>${label}</span>`).join('') + '</div>';
  }
  function welcome() {
    const answered = count();
    main.innerHTML = `<section class="view">
      <div class="hero"><div>
        <div class="eyebrow">THE OPEN PERSONALITY EXPLORER</div>
        <h1 data-focus>认识你的偏好，<br><em>不急着定义你。</em></h1>
        <p class="hero-copy">从日常里更自然的自己出发，探索 MBTI 对应的四个偏好维度。让每个答案有出处，让每个结论留有余地。</p>
        <div class="instrument-label">OEJTS 1.2 · 32 题完整版本 · 中文试译</div>
        ${answered ? `<div class="resume-note">${recovered ? '发现此设备上保存的进度' : '你已有一份进行中的回答'}：已答 ${answered} / 32 题。<br>共用设备时，请确认这份回答属于你。</div>` : ''}
        <div class="actions"><button class="button primary" data-action="start">${answered ? (state.completedAt ? '查看我的结果' : '继续上次作答') : '开始认识自己'}<span class="arrow" aria-hidden="true">↗</span></button>${answered ? '<button class="button ghost" data-action="reset">换一位 / 重新开始</button>' : '<button class="button ghost" data-dialog="method">先了解测评</button>'}</div>
        <p class="hero-foot">无需登录 · 不限时 · 支持键盘与手机作答</p>
        <label class="settings-line hero-settings"><input type="checkbox" id="remember" ${state.remember ? 'checked' : ''}><span>在此设备保存进度，以便下次继续。<br><small>共用设备建议关闭；默认仅在当前页面内保留。</small></span></label>
      </div><div class="atlas" role="img" aria-label="由内外倾向、信息、判断和生活方式组成的四维偏好图案"><span class="atlas-note top">FOUR DIMENSIONS · ONE YOU</span><div class="atlas-grid"><div class="petal"><span>I / E</span></div><div class="petal"><span>S / N</span></div><div class="petal"><span>F / T</span></div><div class="petal"><span>J / P</span></div></div><div class="atlas-center" aria-hidden="true">✳</div><span class="atlas-star" aria-hidden="true">✧</span><span class="atlas-note bottom">每一种偏好，都有它的位置</span></div></div>
      <div class="stats-row"><div class="stat"><span class="stat-value">32</span><span class="stat-label">完整原版题目<span>保留原顺序与五点选项</span></span></div><div class="stat"><span class="stat-value">04</span><span class="stat-label">连续偏好维度<span>展示原始分数与边界</span></span></div><div class="stat"><span class="stat-value">Local</span><span class="stat-label">浏览器内计算<span>你的答案不会自动上传</span></span></div></div>
      <div class="intro-grid"><div><div class="section-kicker">开始前，给自己三个提醒</div><div class="principles"><div class="principle"><span class="principle-num">01</span><div><strong>选平常的自己，不是理想的自己</strong><p>结合平时多个场景回答，尽量避免只依据今天的心情或一段特殊经历。</p></div></div><div class="principle"><span class="principle-num">02</span><div><strong>没有正确答案，也没有更好的类型</strong><p>两侧都像可以选中间；不理解或难以判断时，先标记“待复核”。</p></div></div><div class="principle"><span class="principle-num">03</span><div><strong>完成之后，再看整体</strong><p>所有题目均可修改。结果页会按内置规则给出四维解读、维度互动与场景建议，供你结合真实经历核对。</p></div></div></div></div>
      <aside class="boundary-note"><h3>一份透明的探索工具</h3><p>这是开放的荣格类型量表，不是官方 MBTI®。原作者不保证其信度或准确性；本中文试译也未经心理测量验证，不能承诺适用于所有文化与年龄。</p><p>适合能理解题意的成人自我探索。结果不用于诊断、招聘筛选或能力评价。需要正式 MBTI 时，请使用官方授权测评与反馈流程。</p><a href="https://www.myersbriggs.org/my-mbti-personality-type/take-the-mbti-Instrument/" target="_blank" rel="noopener noreferrer">了解官方 MBTI 测评 ↗</a></aside></div>
    </section>`;
  }
  function question() {
    const q = items[state.index];
    const value = state.answers[state.index];
    const flagged = state.flags.includes(q.id);
    const translationHint = translationHints.get(q.id);
    const translationHintHtml = translationHint ? `<p class="translation-hint"><span class="translation-hint-label">难译提示 · 试译</span>${esc(translationHint)}</p>` : '';
    main.innerHTML = `<section class="view">${steps(1)}<div class="assessment-layout">
      <div class="assessment-top"><span><strong id="progressCount">已答 ${count()} / 32</strong><span class="muted"> · 不必着急</span></span><button class="text-button" data-dialog="palette">答题总览 <span aria-hidden="true">▦</span></button></div>
      <div class="progress" role="progressbar" aria-label="答题进度" aria-valuemin="0" aria-valuemax="32" aria-valuenow="${count()}"><span style="width:${count() / 32 * 100}%"></span></div>
      <article class="question-card"><div class="question-meta"><span class="question-number">QUESTION ${pad(q.id)} <small class="muted">/ 32</small></span><div class="question-tools"><button data-action="english" aria-pressed="${state.english}">${state.english ? '收起英文' : '英文原题'}</button><button data-action="flag" aria-pressed="${flagged}">${flagged ? '● 已标记待复核' : '⚑ 标记待复核'}</button></div></div>
      <h1 class="question-title" data-focus>平常的你，更接近哪一边？</h1><p class="question-help">按真实倾向选择，两个描述没有优劣之分。</p>
      ${translationHintHtml}
      <fieldset class="scale-fieldset"><legend class="sr-only">第 ${q.id} 题：${esc(q.leftZh)}，还是${esc(q.rightZh)}？</legend><div class="poles"><div class="pole left">${esc(q.leftZh)}${state.english ? `<span class="pole-en" lang="en">${esc(q.leftEn)}</span>` : ''}</div><span class="versus" aria-hidden="true">or</span><div class="pole right">${esc(q.rightZh)}${state.english ? `<span class="pole-en" lang="en">${esc(q.rightEn)}</span>` : ''}</div></div>
      <div class="choices">${labels.map((label, i) => `<label class="choice"><input type="radio" name="answer" value="${i + 1}" ${value === i + 1 ? 'checked' : ''} aria-label="${i + 1}，${label}"><span class="choice-circle" aria-hidden="true">${value === i + 1 ? '✓' : i + 1}</span><span class="choice-text">${label}</span></label>`).join('')}</div></fieldset>
      <p class="question-footnote">不确定或情境不适用？可以标记后再想一想；中间选项不等于无效答案。</p></article>
      <div class="question-bottom"><label class="settings-line"><input type="checkbox" id="autoNext" ${state.autoNext ? 'checked' : ''}><span>选后自动下一题</span></label><div class="bottom-actions"><button class="button secondary" data-action="prev" ${state.index === 0 ? 'disabled' : ''}>← 上一题</button><button class="button primary" data-action="next">${returnToReview ? '返回复核' : state.index === 31 ? '检查全部答案' : value === null ? '暂时跳过 →' : '下一题 →'}</button></div></div>
      <p class="draft-line"><span data-save-status>${saveStatusText()}</span> · <button class="text-button" data-dialog="privacy">管理保存方式</button></p>
      <p class="keyboard-hint"><kbd>1</kbd> — <kbd>5</kbd> 选择　<kbd>Enter</kbd> 下一题　·　选项内方向键切换答案，题目区域 <kbd>←</kbd> / <kbd>→</kbd> 翻题</p>
    </div></section>`;
  }
  function updateSelection(value, allowAdvance) {
    cancelNext();
    state.answers[state.index] = value;
    patchState({ completedAt: null });
    main.querySelectorAll('input[name="answer"]').forEach(input => {
      input.checked = Number(input.value) === value;
      input.closest('.choice').querySelector('.choice-circle').textContent = input.checked ? '✓' : input.value;
    });
    document.getElementById('progressCount').textContent = `已答 ${count()} / 32`;
    const progress = main.querySelector('.progress');
    progress.setAttribute('aria-valuenow', count());
    progress.firstElementChild.style.width = count() / 32 * 100 + '%';
    main.querySelector('[data-action="next"]').textContent = returnToReview ? '返回复核' : state.index === 31 ? '检查全部答案' : '下一题 →';
    if (state.autoNext && allowAdvance) pendingNext = setTimeout(() => { pendingNext = null; nextQuestion(); }, 520);
  }
  function openQuestion(index, fromReview = false) { state.index = index; returnToReview = fromReview; setView('question'); }
  function nextQuestion() {
    cancelNext();
    if (returnToReview || state.index === 31) { returnToReview = false; filter = 'all'; setView('review'); }
    else { state.index++; setView('question'); }
  }
  function review() {
    const missing = 32 - count();
    const visibleItems = items.filter(q => filter === 'missing' ? state.answers[q.id - 1] === null : filter === 'flagged' ? state.flags.includes(q.id) : true);
    main.innerHTML = `<section class="view">${steps(2)}<div class="review-header"><div class="eyebrow">A MOMENT TO REFLECT</div><h1 data-focus>给答案一次回看的机会。</h1><p>${missing ? `还有 ${missing} 道题未作答，请补全后查看结果。` : '32 道题已全部完成。你可以修改任何答案，也可以直接生成偏好轮廓。'}<br>标记“待复核”只是一条提醒，不会扣分或改变题目权重。</p></div>
      <div class="assessment-layout"><div class="review-toolbar"><div class="filter-tabs" aria-label="答案筛选"><button data-filter="all" class="${filter === 'all' ? 'active' : ''}" aria-pressed="${filter === 'all'}">全部 · 32</button><button data-filter="missing" class="${filter === 'missing' ? 'active' : ''}" aria-pressed="${filter === 'missing'}">未作答 · ${missing}</button><button data-filter="flagged" class="${filter === 'flagged' ? 'active' : ''}" aria-pressed="${filter === 'flagged'}">待复核 · ${state.flags.length}</button></div><span class="review-count">点击任一题，返回修改 ↗</span></div>
      <div class="review-list">${visibleItems.length ? visibleItems.map(q => { const answer = state.answers[q.id - 1]; const flagged = state.flags.includes(q.id); return `<button class="review-item ${flagged ? 'flagged' : ''}" data-question="${q.id - 1}" data-from-review="true"><span class="review-item-num">${pad(q.id)}</span><span class="review-item-main"><span class="review-item-title">${esc(q.leftZh)} / ${esc(q.rightZh)}</span><span class="review-item-answer">${answer === null ? '尚未作答' : `${answer} · ${labels[answer - 1]}`}${flagged ? '　⚑ 待复核' : ''}</span></span><span class="muted" aria-hidden="true">↗</span></button>`; }).join('') : '<div class="empty-state">这里没有需要处理的题目。<br>可以切换到“全部”查看答案。</div>'}</div>
      <div class="review-sticky"><p>${missing ? '未答题不会被自动填成中间选项。' : state.flags.length ? `仍有 ${state.flags.length} 题标记待复核，结果会如实保留这些标记。` : '这不是考试。真实，比“选得好”更重要。'}</p><button class="button primary" data-action="${missing ? 'firstMissing' : 'finish'}">${missing ? '继续完成未答题 →' : '查看我的偏好轮廓 ↗'}</button></div></div></section>`;
  }
  function results() {
    if (!Core.validateAnswers(state.answers, true)) { state.view = 'review'; review(); return; }
    const result = Core.score(state.answers);
    const reading = window.MBTIInterpretation.interpret(result);
    const readings = {};
    reading.dimensions.forEach(item => { readings[item.key] = item; });
    const uncertain = reading.dimensions.filter(d => d.side === 'balanced');
    const neutral = state.answers.filter(n => n === 3).length;
    const overallCopy = reading.overall.map(paragraph => `<p>${esc(paragraph)}</p>`).join('');
    const dimensionCards = result.dimensions.map(d => {
      const item = readings[d.key];
      return `<article class="dimension-card"><div class="dimension-title"><h3>${esc(item.name)}</h3><span class="score-tag">${d.score} 分 · ${esc(item.directionLabel)}</span></div><p class="dimension-strength"><span class="strength-tag ${item.strength}">${esc(item.strengthLabel)}</span><span>${esc(item.strengthNote)}</span></p><div class="reading-block"><div class="reading-label">通常表现</div><p class="reading-text">${esc(item.expression)}</p></div><div class="reading-block"><div class="reading-label">可以发挥的地方</div><p class="reading-text">${esc(item.upside)}</p></div><div class="reading-block"><div class="reading-label">压力下留意</div><p class="reading-text">${esc(item.watch)}</p></div></article>`;
    }).join('');
    const interactionCards = reading.interactions.length
      ? `<div class="interaction-grid">${reading.interactions.map(item => `<article class="interaction-card"><div class="interaction-keys">${esc(item.keys.join(' × '))}</div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join('')}</div>`
      : '<p class="interaction-empty">本次回答没有两个维度同时离开 45%–55% 中间带，因此不生成互动组合；这比硬凑一组描述更接近现有信息。</p>';
    const sceneCards = reading.scenes.map(scene => `<article class="scene-card"><h3>${esc(scene.title)}</h3>${scene.items.map(item => `<div class="scene-item"><div class="scene-label">${esc(item.name)} · ${esc(item.label)}</div><p>${esc(item.text)}</p></div>`).join('')}</article>`).join('');
    const summaryCards = result.dimensions.map(d => {
      const item = readings[d.key];
      return `<article class="dimension-summary-card"><div class="dimension-title"><h3>${esc(item.name)}</h3><span class="score-tag">${d.score} 分 · ${esc(item.directionLabel)}</span></div><div class="dimension-poles"><span><b>${esc(d.low)}</b></span><span><b>${esc(d.high)}</b></span></div><div class="track" role="img" aria-label="${esc(d.key)} 原始分数 ${d.score}，范围8到40，中点24，刻度位置 ${d.position.toFixed(1)}%"><span class="track-marker" style="left:${d.position}%"></span></div><div class="track-labels"><span>8</span><span>24</span><span>40</span></div><p class="score-line">${esc(item.scoreLine)}</p></article>`;
    }).join('');
    const lead = uncertain.length
      ? `${uncertain.length} 个维度位于 45%–55% 中间带，以 X 留白。先看四个维度的分数和一段短摘要；详细解读、维度互动和场景建议可以展开。`
      : '四个维度都落在 45%–55% 中间带之外。先看四个维度的分数和一段短摘要；详细解读、维度互动和场景建议可以展开。这反映本次回答的倾向，不证明类型永远不变。';
    const shareButton = canWebShare() ? '<button class="button secondary" data-action="shareSummary">分享摘要</button>' : '';
    main.innerHTML = `<section class="view">${steps(3)}<div class="result-intro"><div class="result-profile"><div class="eyebrow">YOUR PREFERENCE ATLAS</div><h1 class="sr-only" data-focus>你的偏好轮廓：${esc(result.cautiousType)}</h1><div class="result-type" aria-label="偏好轮廓 ${esc(result.cautiousType)}">${result.cautiousType.split('').map(letter => `<span class="letter-tile ${letter === 'X' ? 'unclear' : ''}" aria-hidden="true">${esc(letter)}</span>`).join('')}</div><h2 class="result-subtitle">${esc(reading.headline)}</h2><p class="result-lead">${lead}</p></div>
      <div class="dimension-summary">${summaryCards}</div>
      <div class="result-summary-box"><h3>先看整体，再按需要展开。</h3>${reading.summary.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}<div class="result-facts"><span class="fact">已完成 32 / 32</span><span class="fact">中间选项 ${neutral} 题</span><span class="fact">待复核 ${state.flags.length} 题</span></div></div>
      <div class="result-actions"><button class="button secondary" data-action="copySummary">复制摘要</button>${shareButton}<p class="result-share-note">摘要只含四字母、四个维度的原始分和刻度位置，以及一句固定说明。复制或系统分享都在本机完成，不下载文件，也不上传。</p></div></div>
      <nav class="result-nav" aria-label="结果页章节"><a href="#result-overview">整体</a><a href="#result-dimensions">四个维度</a><a href="#result-interactions">维度互动</a><a href="#result-scenes">场景建议</a></nav>
      <details class="result-section result-fold" id="result-overview"><summary><span class="fold-heading"><span class="section-kicker">整体</span><span class="fold-title">把四个维度放在一起看</span></span></summary><div class="fold-body"><h2 id="result-overview-title">把四个维度放在一起看</h2><p class="section-intro">以下四段由你的四个维度方向和强度按固定句式组合；同一组分数会得到同一段文字。</p><div class="overview-copy">${overallCopy}</div></div></details>
      <details class="result-section result-fold" id="result-dimensions"><summary><span class="fold-heading"><span class="section-kicker">四个维度</span><span class="fold-title">四个维度分别看</span></span></summary><div class="fold-body"><h2 id="result-dimensions-title">四个维度分别看</h2><p class="section-intro">每张卡片先给出方向和强度，再从通常表现、可以发挥的地方、压力下留意三个角度展开。</p><div class="dimension-grid">${dimensionCards}</div><p class="score-explainer">所有分数范围均为 8–40，24 为分界。横向位置只是原始分数的线性展示，不是人群百分位、准确率或成为某类型的概率。单次回答无法估计个体测量误差。X 仅表示刻度位置在 45%–55% 之间，不是一种人格类型。</p></div></details>
      <details class="result-section result-fold" id="result-interactions"><summary><span class="fold-heading"><span class="section-kicker">维度之间</span><span class="fold-title">维度之间：组合起来的样子</span></span></summary><div class="fold-body"><h2 id="result-interactions-title">维度之间：组合起来的样子</h2><p class="section-intro">两个维度都离开中间带时，才会生成一组组合描述；最多显示三组，按偏离中点的幅度排序。</p>${interactionCards}</div></details>
      <details class="result-section result-fold" id="result-scenes"><summary><span class="fold-heading"><span class="section-kicker">放回生活</span><span class="fold-title">放回生活：工作、关系与恢复</span></span></summary><div class="fold-body"><h2 id="result-scenes-title">放回生活：工作、关系与恢复</h2><p class="section-intro">每个场景给出两个与你本次方向相关的具体做法，不需要全部照做。</p><div class="scene-grid">${sceneCards}</div></div></details>
      <section class="result-section caveat-panel" id="result-caveats"><div class="section-kicker">边界说明</div><h2>这份解读能做什么，不能做什么</h2><ul>${reading.caveats.map(caveat => `<li>${esc(caveat)}</li>`).join('')}</ul></section>
      <div class="result-bottom"><button class="button secondary" data-action="review">返回检查答案</button><button class="button secondary" data-dialog="method">查看来源与计算过程</button><button class="button ghost" data-action="reset">换一位 / 重新开始</button></div>
    </section>`;
  }
  function render() { ({ welcome, question, review, results }[state.view] || welcome)(); }
  function methodContent() {
    return `<h2>每一道题，都能找到出处。</h2><p>本工具固定采用 Eric Jorgenson 于 2015 年 3 月 3 日发布的 <strong>Open Extended Jungian Type Scales 1.2（OEJTS 1.2）</strong>：32 道双极题，每维 8 道。保留原顺序、两端英文、1–5 回答格式和计分公式，不混用网站在线测试中的其他题数版本。</p>
      <h3>它与官方 MBTI、16Personalities 的关系</h3><p>OEJTS 是开放的荣格类型替代量表，不是 Myers-Briggs 官方题库。官方 MBTI 题目与材料受许可限制；16Personalities 也使用自己的 NERIS 模型，不能将它的分数或 A/T 后缀混入本量表。</p>
      <h3>能支持什么，不能证明什么</h3><p>开发者根据自报已知类型的人群筛选题项。这不能等同于独立的官方 MBTI 效标验证。原 PDF 明确不保证信度或准确性；这里的中文为项目试译，未完成专业回译、中文常模或跨文化等值验证。更完整的解释需要生活实例，正式 MBTI 结果还应通过其反馈流程核实。</p>
      <h3>回答选项与计分键</h3><p>每题 Qn 是题号 n 的答案：1 = 很像左边，2 = 偏向左边，3 = 中间 / 都像，4 = 偏向右边，5 = 很像右边。没有“标准正确答案”。缺题时不出结果，不自动填补。</p>
      <div class="formula">${Object.entries(Core.FORMULAS).map(([key, formula]) => `<div><code>${esc(key)} = ${esc(formula)}</code></div>`).join('')}</div>
      <p>四维分数均在 8–40。原规则：IE &gt; 24 为 E，否则 I；SN &gt; 24 为 N，否则 S；FT &gt; 24 为 T，否则 F；JP &gt; 24 为 P，否则 J。字母排成 I/E、S/N、T/F、J/P 的通常次序，F/T 轴的低分一侧是 F。</p>
      <p>页面新增：原始分换算为 8–40 刻度上的位置，落在 45%–55%（整数分 23–25）的维度用 X 提醒复核；这个范围是页面阅读约定，不来自原量表，也不是统计置信区间。原规则结果同时保留，避免隐藏差异。中间选项数、作答时长和标记数只描述过程，不据此宣称回答有效或无效。</p>
      <p>结果页的整体叙述、四维分述、维度互动和场景建议，由页面内置的固定规则根据四维分数组合生成，不调用 AI、不上传答案，也不改变计分。它提供观察角度，不是心理诊断、能力评价或经过验证的类型描述。</p>
      <h3>适用范围与共享许可</h3><p>面向能理解题意的成人自我探索。部分原题涉及外出、说话方式或工作习惯，可能受身体条件、文化与生活阶段影响；难以判断可标记并在结果中说明。不能承诺所有人的测量等值，也不据此评价能力、品德或心理健康。</p><p>原题作者：Eric Jorgenson。题库与本中文改编按 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a> 非商业、署名、相同方式共享。中文翻译、界面与边界提示为本项目改编；不得声称原作者或 MBTI 官方为其背书。核对日期：2026-10-15。</p>
      <ul class="source-list"><li><a href="${Core.SOURCE}" target="_blank" rel="noopener noreferrer">01 · OEJTS 1.2 原始题目、计分键与许可（PDF） ↗</a><small>题目与算法的一手来源，32题固定版本。</small></li><li><a href="https://openpsychometrics.org/tests/OJTS/development/" target="_blank" rel="noopener noreferrer">02 · OpenPsychometrics 开发说明 ↗</a><small>开发背景与限制；页面的不同题数叙述不作为本工具的题库。</small></li><li><a href="https://www.themyersbriggs.com/en-US/Support/Copyright-and-Permissions" target="_blank" rel="noopener noreferrer">03 · The Myers-Briggs Company：版权与许可 ↗</a></li><li><a href="https://www.myersbriggs.org/my-mbti-personality-type/take-the-mbti-Instrument/" target="_blank" rel="noopener noreferrer">04 · Myers & Briggs Foundation：正式测评入口 ↗</a></li><li><a href="https://www.16personalities.com/articles/our-theory" target="_blank" rel="noopener noreferrer">05 · 16Personalities：模型说明 ↗</a></li></ul>
      <details><summary>查看全部中英文题目（建议作答后查看）</summary><div class="source-table-wrap"><table class="source-table"><thead><tr><th>题号</th><th>左侧（1）</th><th>右侧（5）</th></tr></thead><tbody>${items.map(q => `<tr><td>${q.id}</td><td>${esc(q.leftZh)}<span class="en" lang="en">${esc(q.leftEn)}</span></td><td>${esc(q.rightZh)}<span class="en" lang="en">${esc(q.rightEn)}</span></td></tr>`).join('')}</tbody></table></div></details>
      <details><summary>查看翻译与普适性说明</summary>${Bank.translationNotes.map(note => `<p><strong>${note.id ? `第 ${note.id} 题` : '全部题目'}：</strong>${esc(note.note)}</p>`).join('')}</details>`;
  }
  function openDialog(kind) {
    cancelNext();
    if (kind === 'method') dialogContent.innerHTML = methodContent();
    else if (kind === 'privacy') dialogContent.innerHTML = `<h2>你的回答，留在你的浏览器里。</h2><p>本页面不加载统计脚本、外部字体或远程服务，不会自动上传回答和结果。点击外部资料链接才会打开相应网站。</p><p>结果页的「复制摘要」只把四字母、四个维度分数和一句固定说明写入本机剪贴板。若浏览器提供系统分享，同一段文字会交给系统分享面板。这两种操作都不生成文件，也不把答案上传。</p><h3>当前保存方式</h3><label class="settings-line"><input type="checkbox" id="rememberDialog" ${state.remember ? 'checked' : ''}><span>在此设备保存进度</span></label><p>开启后，数据保存在本浏览器的 localStorage 中，直到你关闭此选项或选择“换一位 / 重新开始”。这不是加密保险箱，共用设备请关闭。关闭后只保留当前页面内存中的回答，刷新或关闭页面就会丢失。</p><p>浏览器可能限制本地 HTML 的持久存储；如保存失败，页面会提示。不会在不同浏览器、设备或文件地址之间自动同步。</p><h3>解读如何生成</h3><p>结果页的整体叙述、四维解读、维度互动和场景建议，由本页面内置的固定规则根据分数在本地组合生成，不会把答案发送给任何服务。X 只表示刻度位置处于 45%–55% 中间带，不是一种人格类型，也不代表测量结论。</p><button class="button secondary" data-action="reset">清空本工具数据 / 换一位</button>`;
    else if (kind === 'palette') dialogContent.innerHTML = `<h2>你的答题进度</h2><p>已答 ${count()} / 32 · 绿色表示已答，橙色小点表示待复核。点击题号跳转。</p><div class="palette-grid">${items.map(q => `<button class="${state.answers[q.id - 1] !== null ? 'answered' : ''} ${state.flags.includes(q.id) ? 'flagged' : ''} ${q.id - 1 === state.index ? 'current' : ''}" data-question="${q.id - 1}" aria-label="第${q.id}题，${state.answers[q.id - 1] !== null ? '已答' : '未答'}${state.flags.includes(q.id) ? '，待复核' : ''}">${q.id}</button>`).join('')}</div><button class="button primary" data-action="review">进入答案复核 →</button>`;
    else return;
    dialog.setAttribute('aria-label', kind === 'method' ? '来源与计分' : kind === 'privacy' ? '隐私说明' : '答题总览');
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function confirmReset() {
    cancelNext();
    dialogContent.innerHTML = '<h2>开始一份全新的回答？</h2><p>这会清空本工具在当前页面与此浏览器中保存的答案和进度，方便下一位使用。清空后无法恢复。若要留下记录，请先在结果页复制摘要。</p><div class="confirm-actions"><button class="button secondary" data-action="cancelReset">先保留</button><button class="button primary" data-action="confirmReset">清空并重新开始</button></div>';
    dialog.setAttribute('aria-label', '清空并重新开始');
    if (!dialog.open) dialog.showModal();
  }
  function setRemember(value) {
    if (value) {
      if (persistenceInvalidated) { invalidatePersistence(); return; }
      try {
        const current = localStorage.getItem(STORAGE_KEY);
        if (current !== storageSnapshot) { invalidatePersistence(); return; }
        if (current !== null && !storageSession) { incompatibleDraft(); return; }
        if (!storageSession) storageSession = newSessionId();
        state.remember = true;
        if (save()) notice('已开启此设备的进度保存。');
        else if (persistenceInvalidated) return;
        else throw new Error('Storage unavailable');
      } catch (_) {
        state.remember = false;
        storageWorking = false;
        notice('无法开启保存：浏览器拒绝了存储。进度仅保留在当前页面。');
      }
    }
    else {
      try {
        if (localStorage.getItem(STORAGE_KEY) !== storageSnapshot) { invalidatePersistence(); return; }
        localStorage.removeItem(STORAGE_KEY);
        if (localStorage.getItem(STORAGE_KEY) !== null) throw new Error('Draft was not removed');
        storageSnapshot = null; storageSession = null; storageRevision = 0; state.remember = false;
        notice('已移除本地草稿；当前页面中的回答仍然保留。');
      }
      catch (_) {
        state.remember = true;
        storageError('浏览器拒绝清除草稿，保存选项尚未关闭。旧回答可能仍在此设备上；请先在浏览器设置中清除此页面的站点数据，再交给下一位使用。');
      }
    }
    render();
    const checkbox = document.getElementById('rememberDialog');
    if (checkbox) checkbox.checked = state.remember;
  }
  function storageError(message) {
    dialogContent.innerHTML = `<h2>本地草稿尚未清除</h2><p class="notice-inline" role="alert">${esc(message)}</p><p>当前回答仍予以保留。处理完成后可以重新尝试；关闭此提示不会清除已保存的数据。</p><div class="confirm-actions"><button class="button secondary" data-action="cancelReset">保留当前回答</button></div>`;
    dialog.setAttribute('aria-label', '本地草稿清除失败');
    if (!dialog.open) dialog.showModal();
  }
  const actionHandlers = {
    start() {
      if (!state.startedAt) state.startedAt = new Date().toISOString();
      recovered = false;
      if (state.completedAt && count() === 32) setView('results');
      else if (count() === 32) setView('review');
      else { if (state.answers[state.index] !== null) state.index = state.answers.indexOf(null); setView('question'); }
    },
    prev() { if (state.index > 0) openQuestion(state.index - 1, returnToReview); },
    next: nextQuestion,
    english() { patchState({ english: !state.english }); renderKeepingFocus('[data-action="english"]'); },
    flag() {
      const id = state.index + 1;
      const flagged = state.flags.includes(id);
      patchState({ flags: flagged ? state.flags.filter(n => n !== id) : [...state.flags, id] });
      renderKeepingFocus('[data-action="flag"]'); notice(flagged ? '已取消待复核标记。' : '已标记，最后可以集中复核。');
    },
    review() { if (dialog.open) dialog.close(); filter = 'all'; returnToReview = false; setView('review'); },
    firstMissing() { openQuestion(state.answers.indexOf(null), true); },
    finish() { if (count() < 32) return; checkpoint(); state.completedAt = new Date().toISOString(); setView('results'); },
    async copySummary() {
      if (!Core.validateAnswers(state.answers, true)) return;
      if (await writeClipboard(summaryText())) notice('已复制摘要。只在本机剪贴板，没有生成文件。');
    },
    async shareSummary() {
      if (!Core.validateAnswers(state.answers, true)) return;
      const text = summaryText();
      const nav = browserNavigator();
      const payload = { title: '见己 · 四维探索', text };
      if (nav && typeof nav.share === 'function') {
        try {
          if (typeof nav.canShare === 'function' && !nav.canShare(payload)) {
            const unavailable = new Error('share unavailable');
            unavailable.name = 'NotSupportedError';
            throw unavailable;
          }
          await nav.share(payload);
          notice('已交给系统分享。页面不会上传这段摘要。');
          return;
        } catch (error) {
          if (error && error.name === 'AbortError') return;
        }
      }
      if (await writeClipboard(text)) notice('此环境无法系统分享，摘要已复制到剪贴板。');
    },
    reset: confirmReset,
    cancelReset() { dialog.close(); },
    confirmReset() {
      try {
        const current = localStorage.getItem(STORAGE_KEY);
        if (current !== null && current !== storageSnapshot) { invalidatePersistence(); return; }
        localStorage.removeItem(STORAGE_KEY);
        if (localStorage.getItem(STORAGE_KEY) !== null) throw new Error('Draft was not removed');
      }
      catch (_) { storageError('浏览器未允许清除本地草稿，因此没有开始新的回答。请先清除此页面的站点数据，再换人使用，避免刷新后恢复上一位的回答。'); return; }
      storageSnapshot = null; storageSession = null; storageRevision = 0; persistenceInvalidated = false;
      persistenceNotice.hidden = true; persistenceNotice.textContent = '';
      cancelNext(); state = freshState(); activeStart = null; recovered = false; returnToReview = false; filter = 'all'; dialog.close(); dialogContent.innerHTML = ''; setView('welcome');
    }
  };
  const ACTION_WITH_CANCEL = new Set(['prev', 'next', 'english', 'flag', 'review']);
  document.addEventListener('click', event => {
    const foldLink = event.target.closest && event.target.closest('a[href^="#result-"]');
    if (foldLink && typeof foldLink.getAttribute === 'function') {
      const fold = document.getElementById(foldLink.getAttribute('href').slice(1));
      if (fold && fold.tagName === 'DETAILS') fold.open = true;
    }
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.dialog) { openDialog(button.dataset.dialog); return; }
    if (button.dataset.question !== undefined) { if (dialog.open) dialog.close(); openQuestion(Number(button.dataset.question), button.dataset.fromReview === 'true'); return; }
    if (button.dataset.filter) { filter = button.dataset.filter; renderKeepingFocus(`[data-filter="${filter}"]`); return; }
    const action = button.dataset.action;
    if (!action) return;
    if (ACTION_WITH_CANCEL.has(action)) cancelNext();
    const handler = actionHandlers[action];
    if (handler) handler();
  });
  document.addEventListener('pointerdown', event => { pointerChoice = !!event.target.closest('.choice'); });
  document.addEventListener('change', event => {
    const target = event.target;
    if (target.name === 'answer') { updateSelection(Number(target.value), pointerChoice); pointerChoice = false; }
    else if (target.id === 'autoNext') { cancelNext(); patchState({ autoNext: target.checked }); }
    else if (target.id === 'remember' || target.id === 'rememberDialog') setRemember(target.checked);
  });
  document.addEventListener('keydown', event => {
    pointerChoice = false;
    if (state.view !== 'question' || dialog.open || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || (target.tagName === 'INPUT' && target.type !== 'radio')) return;
    if (target.tagName === 'INPUT' && target.type === 'radio' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    if (/^[1-5]$/.test(event.key)) { event.preventDefault(); updateSelection(Number(event.key), true); }
    else if (event.key === 'Enter' && target.tagName !== 'BUTTON') { event.preventDefault(); nextQuestion(); }
    else if (event.key === 'ArrowRight' && target.tagName !== 'BUTTON') { event.preventDefault(); nextQuestion(); }
    else if (event.key === 'ArrowLeft' && target.tagName !== 'INPUT' && state.index > 0) { event.preventDefault(); openQuestion(state.index - 1, returnToReview); }
  });
  document.getElementById('homeButton').addEventListener('click', () => setView('welcome'));
  document.getElementById('closeDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  document.addEventListener('visibilitychange', () => { cancelNext(); checkpoint(); save(); });
  window.addEventListener('pagehide', () => { cancelNext(); save(); });
  window.addEventListener('storage', event => {
    if (!state.remember || (event.key !== STORAGE_KEY && event.key !== null)) return;
    try { if (localStorage.getItem(STORAGE_KEY) !== storageSnapshot) invalidatePersistence(true); }
    catch (_) { storageWorking = false; updateSaveStatus(); notice('无法核对本地草稿；当前页面暂时不能保存进度。'); }
  });
  window.addEventListener('beforeunload', event => { if (count() > 0 && (!state.remember || !storageWorking) && !state.completedAt) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('details.result-fold').forEach(fold => {
      fold.dataset.printOpen = fold.open ? 'true' : 'false';
      fold.open = true;
    });
  });
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('details.result-fold').forEach(fold => {
      if (fold.dataset.printOpen !== 'true') fold.open = false;
    });
  });
  load(); render();
})();
