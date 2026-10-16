(function () {
  'use strict';
  const Core = window.MBTICore;
  const Bank = window.QUESTION_BANK;
  const items = Bank.items;
  const STORAGE_KEY = 'self-atlas.oejts12.zh.v1';
  const APP_VERSION = '1.0.0';
  const main = document.getElementById('main');
  const dialog = document.getElementById('infoDialog');
  const dialogContent = document.getElementById('dialogContent');
  const labels = ['很像左边', '偏向左边', '中间 / 都像', '偏向右边', '很像右边'];
  const metadata = {
    IE: { name: '与外界的互动', low: '内向', high: '外向', lowText: '本次回答偏向独处、倾听和独立活动。可以结合社交后自己的实际感受来理解。', highText: '本次回答偏向交流、群体活动和向外表达。可以结合不同社交场景来理解。', prompt: '与人相处之后，你通常想继续交流，还是需要一段独处？' },
    SN: { name: '关注信息的方式', low: '实感', high: '直觉', lowText: '本次回答偏向具体事实、细节和已有经验。并不意味着缺乏想象力。', highText: '本次回答偏向可能性、整体含义和理论。并不意味着忽视现实。', prompt: '学习新事物时，你更自然地从具体实例入手，还是先寻找整体规律？' },
    FT: { name: '判断时的侧重', low: '情感', high: '思考', lowText: '本次回答偏向感受、关怀和人际考虑。并不意味着不善于逻辑思考。', highText: '本次回答偏向理性分析、公正和一致的标准。并不意味着缺少共情。', prompt: '遇到有争议的决定时，你最先想到的理由是什么？请举一个真实例子。' },
    JP: { name: '安排生活的方式', low: '判断', high: '知觉', lowText: '本次回答偏向计划、准备和明确安排。并不等同于更自律或更优秀。', highText: '本次回答偏向灵活、临场调整和保留选择。并不等同于没有责任心。', prompt: '没有外部期限要求时，你通常提前定好安排，还是保留调整空间？' }
  };
  function freshState() { return { version: APP_VERSION, answers: Array(32).fill(null), flags: [], index: 0, view: 'welcome', autoNext: true, english: false, remember: false, notes: '', startedAt: null, completedAt: null, activeMs: 0 }; }
  let state = freshState();
  let recovered = false;
  let storageWorking = true;
  let filter = 'all';
  let pendingNext = null;
  let toastTimer = null;
  let activeStart = null;
  let pointerChoice = false;
  let returnToReview = false;
  let sessionEpoch = 0;
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
  function save() {
    checkpoint();
    if (!state.remember) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageWorking = true; }
    catch (_) { if (storageWorking) notice('浏览器未能保存进度；请保持页面打开，并及时导出结果。'); storageWorking = false; }
  }
  function load() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (!text) return;
      const draft = JSON.parse(text);
      if (draft.version !== APP_VERSION || draft.remember !== true || !Core.validateAnswers(draft.answers)) return;
      state.answers = draft.answers;
      state.flags = Array.isArray(draft.flags) ? [...new Set(draft.flags.filter(n => Number.isInteger(n) && n >= 1 && n <= 32))] : [];
      state.index = Number.isInteger(draft.index) && draft.index >= 0 && draft.index < 32 ? draft.index : 0;
      state.autoNext = draft.autoNext !== false;
      state.english = draft.english === true;
      state.remember = true;
      state.notes = typeof draft.notes === 'string' ? draft.notes.slice(0, 2000) : '';
      state.startedAt = typeof draft.startedAt === 'string' && Number.isFinite(Date.parse(draft.startedAt)) ? draft.startedAt : null;
      state.completedAt = typeof draft.completedAt === 'string' && Number.isFinite(Date.parse(draft.completedAt)) && count() === 32 ? draft.completedAt : null;
      state.activeMs = Number.isFinite(draft.activeMs) && draft.activeMs >= 0 ? Math.min(draft.activeMs, 31536000000) : 0;
      recovered = count() > 0;
    } catch (_) { storageWorking = false; }
  }
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
      <div class="intro-grid"><div><div class="section-kicker">开始前，给自己三个提醒</div><div class="principles"><div class="principle"><span class="principle-num">01</span><div><strong>选平常的自己，不是理想的自己</strong><p>结合平时多个场景回答，尽量避免只依据今天的心情或一段特殊经历。</p></div></div><div class="principle"><span class="principle-num">02</span><div><strong>没有正确答案，也没有更好的类型</strong><p>两侧都像可以选中间；不理解或难以判断时，先标记“待复核”。</p></div></div><div class="principle"><span class="principle-num">03</span><div><strong>完成之后，再看整体</strong><p>所有题目均可修改。复制完整结果给我时，会一并带上原始答案和边界提示。</p></div></div></div></div>
      <aside class="boundary-note"><h3>一份透明的探索工具</h3><p>这是开放的荣格类型量表，不是官方 MBTI®。原作者不保证其信度或准确性；本中文试译也未经心理测量验证，不能承诺适用于所有文化与年龄。</p><p>适合能理解题意的成人自我探索。结果不用于诊断、招聘筛选或能力评价。需要正式 MBTI 时，请使用官方授权测评与反馈流程。</p><a href="https://www.myersbriggs.org/my-mbti-personality-type/take-the-mbti-Instrument/" target="_blank" rel="noopener noreferrer">了解官方 MBTI 测评 ↗</a></aside></div>
    </section>`;
  }
  function question() {
    const q = items[state.index];
    const value = state.answers[state.index];
    const flagged = state.flags.includes(q.id);
    main.innerHTML = `<section class="view">${steps(1)}<div class="assessment-layout">
      <div class="assessment-top"><span><strong id="progressCount">已答 ${count()} / 32</strong><span class="muted"> · 不必着急</span></span><button class="text-button" data-dialog="palette">答题总览 <span aria-hidden="true">▦</span></button></div>
      <div class="progress" role="progressbar" aria-label="答题进度" aria-valuemin="0" aria-valuemax="32" aria-valuenow="${count()}"><span style="width:${count() / 32 * 100}%"></span></div>
      <article class="question-card"><div class="question-meta"><span class="question-number">QUESTION ${pad(q.id)} <small class="muted">/ 32</small></span><div class="question-tools"><button data-action="english" aria-pressed="${state.english}">${state.english ? '收起英文' : '英文原题'}</button><button data-action="flag" aria-pressed="${flagged}">${flagged ? '● 已标记待复核' : '⚑ 标记待复核'}</button></div></div>
      <h1 class="question-title" data-focus>平常的你，更接近哪一边？</h1><p class="question-help">按真实倾向选择，两个描述没有优劣之分。</p>
      <fieldset class="scale-fieldset"><legend class="sr-only">第 ${q.id} 题：${esc(q.leftZh)}，还是${esc(q.rightZh)}？</legend><div class="poles"><div class="pole left">${esc(q.leftZh)}${state.english ? `<span class="pole-en" lang="en">${esc(q.leftEn)}</span>` : ''}</div><span class="versus" aria-hidden="true">or</span><div class="pole right">${esc(q.rightZh)}${state.english ? `<span class="pole-en" lang="en">${esc(q.rightEn)}</span>` : ''}</div></div>
      <div class="choices">${labels.map((label, i) => `<label class="choice"><input type="radio" name="answer" value="${i + 1}" ${value === i + 1 ? 'checked' : ''} aria-label="${i + 1}，${label}"><span class="choice-circle" aria-hidden="true">${value === i + 1 ? '✓' : i + 1}</span><span class="choice-text">${label}</span></label>`).join('')}</div></fieldset>
      <p class="question-footnote">不确定或情境不适用？可以标记后再想一想；中间选项不等于无效答案。</p></article>
      <div class="question-bottom"><label class="settings-line"><input type="checkbox" id="autoNext" ${state.autoNext ? 'checked' : ''}><span>选后自动下一题</span></label><div class="bottom-actions"><button class="button secondary" data-action="prev" ${state.index === 0 ? 'disabled' : ''}>← 上一题</button><button class="button primary" data-action="next">${returnToReview ? '返回复核' : state.index === 31 ? '检查全部答案' : value === null ? '暂时跳过 →' : '下一题 →'}</button></div></div>
      <p class="draft-line">${state.remember && storageWorking ? '● 进度自动保存在此设备' : '○ 仅保留在当前页面，关闭或刷新会丢失'} · <button class="text-button" data-dialog="privacy">管理保存方式</button></p>
      <p class="keyboard-hint"><kbd>1</kbd> — <kbd>5</kbd> 选择　<kbd>Enter</kbd> 下一题　<kbd>←</kbd> 上一题　·　自动跳题可随时关闭</p>
    </div></section>`;
  }
  function updateSelection(value, allowAdvance) {
    cancelNext();
    state.answers[state.index] = value;
    state.completedAt = null;
    save();
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
    const uncertain = result.dimensions.filter(d => d.borderline);
    const neutral = state.answers.filter(n => n === 3).length;
    const candidates = Core.candidates(result);
    const prompt = (uncertain.length ? uncertain : result.dimensions).map(d => metadata[d.key].prompt).join('\n');
    main.innerHTML = `<section class="view">${steps(3)}<div class="result-intro"><div class="result-profile"><div class="eyebrow">YOUR PREFERENCE ATLAS</div><h1 class="sr-only" data-focus>你的偏好轮廓：${result.cautiousType}</h1><div class="result-type" aria-label="偏好轮廓 ${result.cautiousType}">${result.cautiousType.split('').map(letter => `<span class="letter-tile ${letter === 'X' ? 'unclear' : ''}" aria-hidden="true">${letter}</span>`).join('')}</div><h2 class="result-subtitle">${uncertain.length ? '有些偏好，值得继续观察。' : '这是你此刻的偏好轮廓。'}</h2><p class="result-lead">${uncertain.length ? `有 ${uncertain.length} 个维度接近中点，暂以 X 留白。<br>不急着从几个字母中，决定自己是谁。` : '四个维度都落在本页面的中点复核区之外。<br>这反映本次回答的倾向，不证明类型永远不变。'}</p></div>
      <div class="result-summary-box"><h3>先看分数，再读字母。</h3><p>按原量表规则得到 <strong>${result.originalType}</strong>。原规则把恰好 24 分分到 I / S / F / J，本页不会把这一规则当作明确偏好。</p><p>本页将距中点 ≤ 2 分的维度标为 X，提醒你结合真实经历复核。这是透明的阅读约定，<strong>不是经过验证的置信区间</strong>，也不表示你拥有某个固定的“混合类型”。</p><div class="result-facts"><span class="fact">已完成 32 / 32</span><span class="fact">中间选项 ${neutral} 题</span><span class="fact">待复核 ${state.flags.length} 题</span></div></div></div>
      <div class="dimension-grid">${result.dimensions.map(d => { const m = metadata[d.key]; return `<article class="dimension-card"><div class="dimension-title"><h3>${m.name}</h3><span class="score-tag">${d.score} 分 · ${d.letter === 'X' ? '恰在中点' : `偏 ${d.letter}`}</span></div><div class="dimension-poles"><span><b>${d.low}</b> ${m.low}</span><span>${m.high} <b>${d.high}</b></span></div><div class="track" role="img" aria-label="${d.key} 原始分数 ${d.score}，范围8到40，中点24"><span class="track-marker" style="left:${d.position}%"></span></div><div class="track-labels"><span>8</span><span>24 · 中点</span><span>40</span></div><p class="dimension-meaning">${d.borderline ? '<span class="boundary-tag">建议复核</span>该维度接近分界，不宜据此确定一侧。可以结合下方反思问题继续观察。' : d.score < 24 ? m.lowText : m.highText}</p></article>`; }).join('')}</div>
      <p class="score-explainer">所有分数范围均为 8–40，24 为分界。横向位置只是原始分数的线性展示，不是人群百分位、准确率或成为某类型的概率。单次回答无法估计个体测量误差。</p>
      ${uncertain.length ? `<div class="candidate-box"><strong>可以进一步对照的组合</strong> · 仅展开 X 的两种方向，不按可能性排序<div class="candidate-list">${candidates.map(type => `<span class="candidate-chip">${type}</span>`).join('')}</div></div>` : ''}
      <div class="result-lower"><div class="panel"><h3>补上真实生活里的你</h3><p>${esc(prompt).replace(/\n/g, '<br>')}</p><label class="note-field">可选：记录一两个例子，或解释难以判断的题目<textarea id="reflection" maxlength="2000" placeholder="例如：在熟人中我常主动说话，但大型陌生聚会后需要独处……">${esc(state.notes)}</textarea></label><p style="margin:9px 0 0;font-size:10px">不参与计分；只随你主动复制或下载的结果分享。请避免填写敏感身份信息。</p></div>
      <div class="panel export-panel"><div class="eyebrow" style="color:#c4d4bc">KEEP THE WHOLE PICTURE</div><h3 style="margin-top:14px">把完整结果，带回对话。</h3><p>复制内容包含四维分数、原始答案、待复核题号、反思笔记及来源。粘贴给我，就能继续做有依据的分析。</p><button class="button primary" data-action="copy">复制完整结果 <span aria-hidden="true">↗</span></button><div class="actions"><button class="button secondary" data-action="downloadText">下载文本</button><button class="button secondary" data-action="downloadJson">下载 JSON</button></div><p class="export-note">没有服务器接收答案。你点击复制或下载后，才会生成相应内容。不要只分享四个字母。</p></div></div>
      <div class="result-bottom"><button class="button secondary" data-action="review">返回检查答案</button><button class="button secondary" data-dialog="method">查看来源与计算过程</button><button class="button ghost" data-action="reset">换一位 / 重新开始</button></div>
    </section>`;
  }
  function render() { ({ welcome, question, review, results }[state.view] || welcome)(); }
  function methodContent() {
    return `<h2>每一道题，都能找到出处。</h2><p>本工具固定采用 Eric Jorgenson 于 2015 年 3 月 3 日发布的 <strong>Open Extended Jungian Type Scales 1.2（OEJTS 1.2）</strong>：32 道双极题，每维 8 道。保留原顺序、两端英文、1–5 回答格式和计分公式，不混用网站在线测试中的其他题数版本。</p>
      <h3>它与官方 MBTI、16Personalities 的关系</h3><p>OEJTS 是开放的荣格类型替代量表，不是 Myers-Briggs 官方题库。官方 MBTI 题目与材料受许可限制；16Personalities 也使用自己的 NERIS 模型，不能将它的分数或 A/T 后缀混入本量表。</p>
      <h3>能支持什么，不能证明什么</h3><p>开发者根据自报已知类型的人群筛选题项。这不能等同于独立的官方 MBTI 效标验证。原 PDF 明确不保证信度或准确性；这里的中文为项目试译，未完成专业回译、中文常模或跨文化等值验证。更完整的解释需要生活实例，正式 MBTI 结果还应通过其反馈流程核实。</p>
      <h3>回答选项与计分键</h3><p>每题 Qn 是题号 n 的答案：1 = 很像左边，2 = 偏向左边，3 = 中间 / 都像，4 = 偏向右边，5 = 很像右边。没有“标准正确答案”。缺题时不出结果，不自动填补。</p>
      <div class="formula">${Object.entries(Core.FORMULAS).map(([key, formula]) => `<div><code>${key} = ${formula}</code></div>`).join('')}</div>
      <p>四维分数均在 8–40。原规则：IE &gt; 24 为 E，否则 I；SN &gt; 24 为 N，否则 S；FT &gt; 24 为 T，否则 F；JP &gt; 24 为 P，否则 J。字母排成 I/E、S/N、T/F、J/P 的通常次序，F/T 轴的低分一侧是 F。</p>
      <p>页面新增：距 24 不超过 2 分（22–26）的维度用 X 提醒复核；这个范围是页面阅读规则，不来自原量表，也不是统计置信区间。原规则结果同时保留，避免隐藏差异。中间选项数、作答时长和标记数只描述过程，不据此宣称回答有效或无效。</p>
      <h3>适用范围与共享许可</h3><p>面向能理解题意的成人自我探索。部分原题涉及外出、说话方式或工作习惯，可能受身体条件、文化与生活阶段影响；难以判断可标记并在结果中说明。不能承诺所有人的测量等值，也不据此评价能力、品德或心理健康。</p><p>原题作者：Eric Jorgenson。题库与本中文改编按 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a> 非商业、署名、相同方式共享。中文翻译、界面与边界提示为本项目改编；不得声称原作者或 MBTI 官方为其背书。核对日期：2026-10-15。</p>
      <ul class="source-list"><li><a href="${Core.SOURCE}" target="_blank" rel="noopener noreferrer">01 · OEJTS 1.2 原始题目、计分键与许可（PDF） ↗</a><small>题目与算法的一手来源，32题固定版本。</small></li><li><a href="https://openpsychometrics.org/tests/OJTS/development/" target="_blank" rel="noopener noreferrer">02 · OpenPsychometrics 开发说明 ↗</a><small>开发背景与限制；页面的不同题数叙述不作为本工具的题库。</small></li><li><a href="https://www.themyersbriggs.com/en-US/Support/Copyright-and-Permissions" target="_blank" rel="noopener noreferrer">03 · The Myers-Briggs Company：版权与许可 ↗</a></li><li><a href="https://www.myersbriggs.org/my-mbti-personality-type/take-the-mbti-Instrument/" target="_blank" rel="noopener noreferrer">04 · Myers & Briggs Foundation：正式测评入口 ↗</a></li><li><a href="https://www.16personalities.com/articles/our-theory" target="_blank" rel="noopener noreferrer">05 · 16Personalities：模型说明 ↗</a></li></ul>
      <details><summary>查看全部中英文题目（建议作答后查看）</summary><div class="source-table-wrap"><table class="source-table"><thead><tr><th>题号</th><th>左侧（1）</th><th>右侧（5）</th></tr></thead><tbody>${items.map(q => `<tr><td>${q.id}</td><td>${esc(q.leftZh)}<span class="en" lang="en">${esc(q.leftEn)}</span></td><td>${esc(q.rightZh)}<span class="en" lang="en">${esc(q.rightEn)}</span></td></tr>`).join('')}</tbody></table></div></details>
      <details><summary>查看翻译与普适性说明</summary>${Bank.translationNotes.map(note => `<p><strong>${note.id ? `第 ${note.id} 题` : '全部题目'}：</strong>${esc(note.note)}</p>`).join('')}</details>`;
  }
  function openDialog(kind) {
    cancelNext();
    if (kind === 'method') dialogContent.innerHTML = methodContent();
    else if (kind === 'privacy') dialogContent.innerHTML = `<h2>你的回答，留在你的浏览器里。</h2><p>本页面不加载统计脚本、外部字体或远程服务，不会自动上传回答、笔记和结果。点击外部资料链接才会打开相应网站。</p><h3>当前保存方式</h3><label class="settings-line"><input type="checkbox" id="rememberDialog" ${state.remember ? 'checked' : ''}><span>在此设备保存进度与笔记</span></label><p>开启后，数据保存在本浏览器的 localStorage 中，直到你关闭此选项或选择“换一位 / 重新开始”。这不是加密保险箱，共用设备请关闭。关闭后只保留当前页面内存中的回答，刷新或关闭页面就会丢失。</p><p>浏览器可能限制本地 HTML 的持久存储；如保存失败，页面会提示。不会在不同浏览器、设备或文件地址之间自动同步。</p><h3>主动分享</h3><p>“复制完整结果”和下载会包含全部答案及你填写的笔记，请自行决定分享对象。另存的报告文件和已复制的内容不会因页面重置而被删除。</p><button class="button secondary" data-action="reset">清空本工具数据 / 换一位</button>`;
    else if (kind === 'palette') dialogContent.innerHTML = `<h2>你的答题进度</h2><p>已答 ${count()} / 32 · 绿色表示已答，橙色小点表示待复核。点击题号跳转。</p><div class="palette-grid">${items.map(q => `<button class="${state.answers[q.id - 1] !== null ? 'answered' : ''} ${state.flags.includes(q.id) ? 'flagged' : ''} ${q.id - 1 === state.index ? 'current' : ''}" data-question="${q.id - 1}" aria-label="第${q.id}题，${state.answers[q.id - 1] !== null ? '已答' : '未答'}${state.flags.includes(q.id) ? '，待复核' : ''}">${q.id}</button>`).join('')}</div><button class="button primary" data-action="review">进入答案复核 →</button>`;
    else return;
    dialog.setAttribute('aria-label', kind === 'method' ? '来源与计分' : kind === 'privacy' ? '隐私说明' : '答题总览');
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function confirmReset() {
    cancelNext();
    dialogContent.innerHTML = '<h2>开始一份全新的回答？</h2><p>这会清空本工具在当前页面与此浏览器中保存的答案、笔记和进度，方便下一位使用。已经下载的报告不受影响。如需保留当前结果，请先导出。</p><div class="confirm-actions"><button class="button secondary" data-action="cancelReset">先保留</button><button class="button primary" data-action="confirmReset">清空并重新开始</button></div>';
    dialog.setAttribute('aria-label', '清空并重新开始');
    if (!dialog.open) dialog.showModal();
  }
  function setRemember(value) {
    state.remember = value;
    if (value) {
      save();
      if (storageWorking) notice('已开启此设备的进度保存。');
      else {
        state.remember = false;
        notice('无法开启保存：浏览器拒绝了存储。进度仅保留在当前页面。');
      }
    }
    else {
      try { localStorage.removeItem(STORAGE_KEY); notice('已移除本地草稿；当前页面中的回答仍然保留。'); }
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
  function resultPayload() {
    save();
    const result = Core.score(state.answers);
    return {
      schema: 'self-atlas-result-v1', appVersion: APP_VERSION, instrument: 'OEJTS 1.2', translation: '中文试译 1.0（未经心理测量验证）', author: 'Eric Jorgenson (2015)', source: Core.SOURCE,
      license: 'CC BY-NC-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      startedAt: state.startedAt, completedAt: state.completedAt, activeSeconds: Math.round(state.activeMs / 1000),
      originalType: result.originalType, midpointAwareType: result.type, cautiousType: result.cautiousType,
      dimensions: result.dimensions.map(d => ({ key: d.key, low: d.low, high: d.high, score: d.score, midpoint: 24, min: 8, max: 40, distanceFromMidpoint: d.distance, borderline: d.borderline })),
      scoringFormulas: Core.FORMULAS, reviewRule: '|score - 24| <= 2 is shown as X; a display convention, not a validated confidence interval',
      responseScale: Object.fromEntries(labels.map((label, i) => [i + 1, label])),
      answers: state.answers.map((value, i) => ({ id: i + 1, value })), flaggedItemIds: [...state.flags].sort((a, b) => a - b), midpointAnswerCount: state.answers.filter(n => n === 3).length,
      reflection: state.notes, limitations: ['Not the official MBTI instrument.', 'Chinese translation is unvalidated.', 'No individual accuracy, confidence, percentile, diagnosis or employment inference.']
    };
  }
  function reportText() {
    const p = resultPayload();
    const scores = p.dimensions.map(d => `${d.key}（低侧 ${d.low} / 高侧 ${d.high}）：${d.score} 分；距24中点 ${d.distanceFromMidpoint} 分${d.borderline ? '；在页面复核区' : ''}`).join('\n');
    return `【见己 · OEJTS 1.2 完整结果】\n这是开放荣格类型量表的中文试译结果，不是官方 MBTI。\n\n保留边界的偏好轮廓：${p.cautiousType}\n仅将精确中点留白的轮廓：${p.midpointAwareType}\n原量表规则结果：${p.originalType}（原规则24归I/S/F/J）\n\n${scores}\n每维范围8–40，中点24。距中点≤2用X提醒复核，是页面自定义规则，不是统计置信区间。没有准确率、概率或常模百分位。\n\n完成时间：${p.completedAt}\n前台作答与复核时间约：${p.activeSeconds} 秒（仅描述过程，不用于判定有效性）\n已答：32/32；中间选项：${p.midpointAnswerCount}题\n待复核题号：${p.flaggedItemIds.join('、') || '无'}\n回答编码：1很像左边 / 2偏向左边 / 3中间或都像 / 4偏向右边 / 5很像右边\n原始答案（原PDF顺序Q1–Q32）：\n${p.answers.map(a => `Q${a.id}=${a.value}`).join(', ')}\n\n我的补充实例与说明：\n${p.reflection || '未填写'}\n\n请结合原始答案、临界维度、待复核题与生活实例分析；不要仅凭四字母定型，不要推导认知功能堆栈、疾病、能力或职业胜任力。\n\n原作者：Eric Jorgenson (2015)\n来源：${p.source}\n许可：CC BY-NC-SA 4.0（${p.licenseUrl}）\n版本：${p.instrument} / ${p.translation} / 页面${p.appVersion}\n\n【结构化数据，供复算】\n${JSON.stringify(p, null, 2)}`;
  }
  async function copyReport() {
    const copyEpoch = sessionEpoch;
    const text = reportText();
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (copyEpoch !== sessionEpoch) return;
      notice('完整结果已复制，回到对话粘贴即可。');
    } catch (_) {
      if (copyEpoch !== sessionEpoch) return;
      dialogContent.innerHTML = '<h2>复制完整结果</h2><p>浏览器未允许直接复制。内容已选中，请按 Ctrl+C（Mac 为 ⌘C），或长按选择复制。</p><textarea id="manualCopy" class="copy-box" readonly aria-label="完整结果"></textarea><div class="confirm-actions"><button class="button primary" data-action="selectReport">全选内容</button></div>';
      document.getElementById('manualCopy').value = text;
      dialog.setAttribute('aria-label', '手动复制结果');
      if (!dialog.open) dialog.showModal();
      const box = document.getElementById('manualCopy'); box.focus(); box.select();
    }
  }
  function download(content, extension, mime) {
    const blob = new Blob([extension === 'txt' ? '\uFEFF' : '', content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `见己-OEJTS12-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    notice('已生成报告文件；请查看浏览器的下载记录。');
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.dialog) { openDialog(button.dataset.dialog); return; }
    if (button.dataset.question !== undefined) { if (dialog.open) dialog.close(); openQuestion(Number(button.dataset.question), button.dataset.fromReview === 'true'); return; }
    if (button.dataset.filter) { filter = button.dataset.filter; review(); return; }
    const action = button.dataset.action;
    if (!action) return;
    if (['prev', 'next', 'english', 'flag', 'review'].includes(action)) cancelNext();
    if (action === 'start') {
      if (!state.startedAt) state.startedAt = new Date().toISOString();
      recovered = false;
      if (state.completedAt && count() === 32) setView('results');
      else if (count() === 32) setView('review');
      else { if (state.answers[state.index] !== null) state.index = state.answers.indexOf(null); setView('question'); }
    } else if (action === 'prev') { if (state.index > 0) openQuestion(state.index - 1, returnToReview); }
    else if (action === 'next') nextQuestion();
    else if (action === 'english') { state.english = !state.english; save(); question(); }
    else if (action === 'flag') {
      const id = state.index + 1;
      state.flags = state.flags.includes(id) ? state.flags.filter(n => n !== id) : [...state.flags, id];
      save(); question(); notice(state.flags.includes(id) ? '已标记，最后可以集中复核。' : '已取消待复核标记。');
    } else if (action === 'review') { if (dialog.open) dialog.close(); filter = 'all'; returnToReview = false; setView('review'); }
    else if (action === 'firstMissing') openQuestion(state.answers.indexOf(null), true);
    else if (action === 'finish') { if (count() < 32) return; checkpoint(); state.completedAt = new Date().toISOString(); setView('results'); }
    else if (action === 'reset') confirmReset();
    else if (action === 'cancelReset') dialog.close();
    else if (action === 'confirmReset') {
      try { localStorage.removeItem(STORAGE_KEY); }
      catch (_) { storageError('浏览器未允许清除本地草稿，因此没有开始新的回答。请先清除此页面的站点数据，再换人使用，避免刷新后恢复上一位的回答。'); return; }
      sessionEpoch++;
      cancelNext(); state = freshState(); activeStart = null; recovered = false; returnToReview = false; filter = 'all'; dialog.close(); dialogContent.innerHTML = ''; setView('welcome');
    } else if (action === 'copy') copyReport();
    else if (action === 'selectReport') { const box = document.getElementById('manualCopy'); box.focus(); box.select(); }
    else if (action === 'downloadText') download(reportText(), 'txt', 'text/plain;charset=utf-8');
    else if (action === 'downloadJson') download(JSON.stringify(resultPayload(), null, 2), 'json', 'application/json;charset=utf-8');
  });
  document.addEventListener('pointerdown', event => { pointerChoice = !!event.target.closest('.choice'); });
  document.addEventListener('change', event => {
    const target = event.target;
    if (target.name === 'answer') { updateSelection(Number(target.value), pointerChoice); pointerChoice = false; }
    else if (target.id === 'autoNext') { cancelNext(); state.autoNext = target.checked; save(); }
    else if (target.id === 'remember' || target.id === 'rememberDialog') setRemember(target.checked);
  });
  document.addEventListener('input', event => { if (event.target.id === 'reflection') { state.notes = event.target.value.slice(0, 2000); save(); } });
  document.addEventListener('keydown', event => {
    pointerChoice = false;
    if (state.view !== 'question' || dialog.open || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || (target.tagName === 'INPUT' && target.type !== 'radio')) return;
    if (/^[1-5]$/.test(event.key)) { event.preventDefault(); updateSelection(Number(event.key), true); }
    else if (event.key === 'Enter' && target.tagName !== 'BUTTON') { event.preventDefault(); nextQuestion(); }
    else if (event.key === 'ArrowLeft' && target.tagName !== 'INPUT' && state.index > 0) { event.preventDefault(); openQuestion(state.index - 1, returnToReview); }
  });
  document.getElementById('homeButton').addEventListener('click', () => setView('welcome'));
  document.getElementById('closeDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  document.addEventListener('visibilitychange', () => { cancelNext(); checkpoint(); save(); });
  window.addEventListener('pagehide', () => { cancelNext(); save(); });
  window.addEventListener('beforeunload', event => { if (count() > 0 && (!state.remember || !storageWorking) && !state.completedAt) { event.preventDefault(); event.returnValue = ''; } });
  load(); render();
})();
