import { test as base, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Every test gets a clean BrowserContext, including its localStorage.
const test = base.extend({
  appErrors: [async ({ page, context }, use) => {
    const errors = [];
    const watch = observedPage => {
      observedPage.on('pageerror', error => errors.push(error.message));
      observedPage.on('dialog', async dialog => {
        if (dialog.type() === 'beforeunload') await dialog.accept();
        else await dialog.dismiss();
      });
    };
    watch(page);
    context.on('page', watch);
    await use(errors);
    expect(errors, 'The built application must not throw uncaught browser errors').toEqual([]);
  }, { auto: true }],
});

const questionNumber = page => page.locator('.question-number');
const answer = (page, value) => page.getByRole('radio', { name: new RegExp(`^${value}，`) });
const next = page => page.locator('button[data-action="next"]');

async function expectNoHorizontalOverflow(page) {
  const { content, viewport } = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(content, 'The page should fit the viewport without horizontal scrolling').toBeLessThanOrEqual(viewport + 1);
}

async function start(page, { remember = false, automatic = false, url = '/' } = {}) {
  await page.goto(url);
  await expectNoHorizontalOverflow(page);
  if (remember) {
    await page.getByRole('checkbox', { name: /在此设备保存进度/ }).check();
    await expect(page.getByRole('status')).toContainText('已开启此设备的进度保存');
  }
  await page.getByRole('button', { name: '开始认识自己' }).click();
  await expect(questionNumber(page)).toContainText('QUESTION 01');
  if (!automatic) await page.getByRole('checkbox', { name: '选后自动下一题' }).uncheck();
  await expectNoHorizontalOverflow(page);
}

async function openReview(page) {
  await page.getByRole('button', { name: /答题总览/ }).click();
  await page.getByRole('button', { name: '进入答案复核 →' }).click();
  await expect(page.getByRole('heading', { name: '给答案一次回看的机会。' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

async function complete(page, options) {
  await start(page, options);
  for (let number = 1; number <= 32; number++) {
    await expect(questionNumber(page)).toContainText(`QUESTION ${String(number).padStart(2, '0')}`);
    if (number === 2) await page.getByRole('button', { name: '⚑ 标记待复核' }).click();
    await answer(page, 1).check();
    await next(page).click();
  }
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: '查看我的偏好轮廓 ↗' }).click();
  await expect(page.getByRole('heading', { name: '你的偏好轮廓：ESTJ' })).toBeAttached();
  await expectNoHorizontalOverflow(page);
}

async function setFold(page, id, open) {
  const fold = page.locator(`#${id}`);
  if ((await fold.evaluate(node => node.open)) !== open) await fold.locator('summary').click();
  await expect(fold).toHaveJSProperty('open', open);
}

test('32 answers produce a local interpretation, and review changes update it', async ({ page, browserName }) => {
  await complete(page);
  await expect(page.locator('.letter-tile')).toHaveCount(4);
  await expect(page.getByRole('img', { name: 'JP 原始分数 20，范围8到40，中点24，刻度位置 37.5%' })).toBeVisible();
  await expect(page.locator('.dimension-summary').getByText('原始分 20 / 40 · 刻度位置 37.5%', { exact: true })).toBeVisible();
  await expect(page.locator('.dimension-summary .track')).toHaveCount(4);
  await expect(page.locator('.result-summary-box')).toBeVisible();
  await expect(page.getByRole('button', { name: '复制摘要', exact: true })).toBeVisible();

  const tops = await page.evaluate(() => {
    const top = selector => document.querySelector(selector).getBoundingClientRect().top;
    return [top('.result-type'), top('.dimension-summary'), top('.result-summary-box'), top('#result-overview')];
  });
  expect(tops[0]).toBeLessThan(tops[1]);
  expect(tops[1]).toBeLessThan(tops[2]);
  expect(tops[2]).toBeLessThan(tops[3]);

  const nav = page.locator('.result-nav a');
  await expect(nav).toHaveCount(4);
  for (const id of ['result-overview', 'result-dimensions', 'result-interactions', 'result-scenes']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
    await expect(page.locator(`#${id}`)).toHaveJSProperty('open', false);
  }
  await expect(page.locator('#result-reflection')).toHaveCount(0);
  await expect(page.locator('.note-panel')).toHaveCount(0);
  await expect(page.getByText('补上真实生活里的你')).toHaveCount(0);
  await expect(page.locator('.dimension-card')).toHaveCount(4);
  await expect(page.locator('.dimension-card .reading-block')).toHaveCount(12);
  await expect(page.getByText('通常表现', { exact: true })).toHaveCount(4);
  await expect(page.getByText('可以发挥的地方', { exact: true })).toHaveCount(4);
  await expect(page.getByText('压力下留意', { exact: true })).toHaveCount(4);
  await expect(page.locator('.interaction-card')).toHaveCount(3);
  await expect(page.locator('.scene-card')).toHaveCount(3);
  await expect(page.locator('.scene-item')).toHaveCount(6);
  for (const title of ['工作与学习', '关系与沟通', '压力与恢复']) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeHidden();
  }

  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  for (const id of ['result-overview', 'result-dimensions', 'result-interactions', 'result-scenes']) {
    await setFold(page, id, true);
  }
  for (const title of ['工作与学习', '关系与沟通', '压力与恢复']) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
  await setFold(page, 'result-scenes', false);
  await expect(page.locator('#result-scenes .scene-card')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: '工作与学习', exact: true })).toBeHidden();
  if (viewport) await page.setViewportSize(viewport);

  await page.getByRole('link', { name: '场景建议', exact: true }).click();
  await expect(page).toHaveURL(/#result-scenes$/);
  await expect(page.locator('#result-scenes')).toHaveJSProperty('open', true);
  await expect(page.locator('#result-scenes')).toBeInViewport();
  await expect(page.getByRole('heading', { name: '工作与学习', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  if (browserName === 'chromium') {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  }
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.getByRole('button', { name: '复制摘要', exact: true }).click();
  if (browserName === 'chromium') {
    await expect(page.getByRole('status')).toContainText('已复制摘要');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('偏好轮廓：ESTJ');
    expect(text).toContain('IE I/E 原始分');
    expect(text).toContain('SN S/N 原始分');
    expect(text).toContain('FT F/T 原始分');
    expect(text).toContain('JP J/P 原始分');
    expect(text).toContain('非官方 MBTI，中文试译，未经心理测量验证。');
    expect(text.split('未经心理测量验证').length - 1).toBe(1);
    expect(text).not.toMatch(/下载|上传/);
  } else {
    await expect(page.getByRole('status')).toContainText(/已复制摘要|未能写入剪贴板|不能写入剪贴板/);
  }
  expect(requests.every(url => url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost'))).toBe(true);

  await page.getByRole('button', { name: '返回检查答案' }).click();
  await page.locator('.review-item').first().click();
  await expect(answer(page, 1)).toBeChecked();
  await answer(page, 5).check();
  await page.getByRole('button', { name: '返回复核' }).click();
  await expect(page.locator('.review-item').first()).toContainText('5 · 很像右边');
  await page.getByRole('button', { name: '查看我的偏好轮廓 ↗' }).click();
  await expect(page.getByRole('heading', { name: '你的偏好轮廓：ESTX' })).toBeAttached();
  await expect(page.getByRole('img', { name: 'JP 原始分数 24，范围8到40，中点24，刻度位置 50.0%' })).toBeVisible();
  await expect(page.getByText('原始分 24 / 40 · 刻度位置 50.0% · 中间带 45%–55%')).toBeVisible();
  await expect(page.getByRole('heading', { name: '这份解读能做什么，不能做什么' })).toBeVisible();

  await expect(page.getByRole('textbox', { name: /可选：记下让你想到的具体例子/ })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByText('继续观察')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /复制完整结果|下载 JSON|下载文本/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下载 PNG 图片' })).toBeVisible();
  await expect(page.getByRole('button', { name: '打印 / 保存 PDF' })).toBeVisible();
});

test('system share sends the local summary and falls back to copy', async ({ page }) => {
  await page.addInitScript(() => {
    window.__shares = [];
    window.__copies = [];
    window.__shareMode = 'ok';
    const share = data => {
      if (window.__shareMode === 'abort') {
        const error = new Error('abort');
        error.name = 'AbortError';
        return Promise.reject(error);
      }
      if (window.__shareMode === 'unavailable') {
        const error = new Error('unsupported');
        error.name = 'NotSupportedError';
        return Promise.reject(error);
      }
      window.__shares.push({ title: data.title, text: data.text, url: data.url, files: data.files });
      return Promise.resolve();
    };
    const canShare = () => window.__shareMode !== 'cannot';
    const clipboard = { writeText: async text => { window.__copies.push(text); } };
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
  });
  await complete(page);
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.getByRole('button', { name: '分享摘要', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已交给系统分享');
  const shared = await page.evaluate(() => window.__shares[0]);
  expect(shared.title).toBe('见己 · 四维探索');
  expect(shared.text).toContain('偏好轮廓：ESTJ');
  expect(shared.text).toContain('原始分');
  expect(shared.text).toContain('非官方 MBTI，中文试译，未经心理测量验证。');
  expect(shared.url).toBeUndefined();
  expect(shared.files).toBeUndefined();
  expect(await page.evaluate(() => window.__copies)).toEqual([]);

  await page.evaluate(() => { window.__shareMode = 'cannot'; });
  await page.getByRole('button', { name: '分享摘要', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('摘要已复制到剪贴板');
  const copied = await page.evaluate(() => window.__copies[0]);
  expect(copied).toContain('偏好轮廓：ESTJ');
  expect(copied).toContain('非官方 MBTI，中文试译，未经心理测量验证。');

  await page.evaluate(() => { window.__shareMode = 'abort'; window.__copies.length = 0; });
  await page.getByRole('button', { name: '分享摘要', exact: true }).click();
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => window.__copies.length)).toBe(0);
  expect(await page.evaluate(() => window.__shares.length)).toBe(1);
  expect(requests.every(url => url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost'))).toBe(true);
  await expect(page.locator('a[download], input[type="file"]')).toHaveCount(0);
});

test('missing answers cannot produce results and keyboard review filters retain focus', async ({ page }) => {
  await start(page);
  await answer(page, 2).check();
  await page.getByRole('button', { name: '⚑ 标记待复核' }).click();
  await openReview(page);
  await expect(page.getByText('还有 31 道题未作答，请补全后查看结果。')).toBeVisible();
  await expect(page.getByRole('button', { name: '查看我的偏好轮廓 ↗' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下载 JSON', exact: true })).toHaveCount(0);

  const missing = page.getByRole('button', { name: '未作答 · 31' });
  await missing.focus();
  await missing.press('Enter');
  await expect(page.getByRole('button', { name: '未作答 · 31' })).toBeFocused();
  await expect(page.locator('.review-item')).toHaveCount(31);
  const flagged = page.getByRole('button', { name: '待复核 · 1' });
  await flagged.focus();
  await flagged.press('Enter');
  await expect(page.getByRole('button', { name: '待复核 · 1' })).toBeFocused();
  await expect(page.locator('.review-item')).toHaveCount(1);
  await expect(page.locator('.review-item')).toContainText('2 · 偏向左边');
  await page.getByRole('button', { name: '继续完成未答题 →' }).click();
  await expect(questionNumber(page)).toContainText('QUESTION 02');
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
});

test('native radio arrows select answers without navigating, and English retains keyboard focus', async ({ page }) => {
  await start(page);
  await answer(page, 2).focus();
  await answer(page, 2).press('Space');
  await answer(page, 2).press('ArrowRight');
  await expect(answer(page, 3)).toBeChecked();
  await expect(answer(page, 3)).toBeFocused();
  await expect(questionNumber(page)).toContainText('QUESTION 01');
  await answer(page, 3).press('ArrowLeft');
  await expect(answer(page, 2)).toBeChecked();
  await expect(questionNumber(page)).toContainText('QUESTION 01');
  const english = page.getByRole('button', { name: '英文原题', exact: true });
  await english.focus();
  await english.press('Enter');
  await expect(page.getByRole('button', { name: '收起英文', exact: true })).toBeFocused();
  await expect(page.locator('.pole-en')).toHaveCount(2);
  await page.getByRole('button', { name: '收起英文', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: '英文原题', exact: true })).toBeFocused();
  await expect(page.locator('.pole-en')).toHaveCount(0);
});

test('automatic advance waits, and disabling it or opening a dialog cancels the pending jump', async ({ page }) => {
  await start(page, { automatic: true });
  // Measure real browser time from the native change event to the next rendered
  // question. No fake clock and no calls into the application's timer functions.
  const advanceTiming = page.evaluate(() => new Promise(resolve => {
    document.addEventListener('change', () => {
      const started = performance.now();
      const observer = new MutationObserver(() => {
        if (!document.querySelector('.question-number')?.textContent.includes('QUESTION 02')) return;
        clearTimeout(deadline);
        observer.disconnect();
        resolve(performance.now() - started);
      });
      const deadline = setTimeout(() => { observer.disconnect(); resolve(-1); }, 5_000);
      observer.observe(document.querySelector('main'), { childList: true, subtree: true });
    }, { once: true, capture: true });
  }));
  await answer(page, 2).check();
  const elapsed = await advanceTiming;
  expect(elapsed, 'Automatic advance should preserve the 520 ms reading pause').toBeGreaterThanOrEqual(480);
  expect(elapsed).toBeLessThan(3_000);
  await expect(questionNumber(page)).toContainText('QUESTION 02', { timeout: 2_000 });

  await answer(page, 3).check();
  await page.getByRole('checkbox', { name: '选后自动下一题' }).uncheck();
  await page.waitForTimeout(650);
  await expect(questionNumber(page)).toContainText('QUESTION 02');
  await page.getByRole('checkbox', { name: '选后自动下一题' }).check();
  await answer(page, 4).check();
  await page.getByRole('button', { name: /答题总览/ }).click();
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: '关闭对话框' }).click();
  await expect(questionNumber(page)).toContainText('QUESTION 02');
});

test('remembered answers and settings survive refresh; unsaved answers do not', async ({ page }) => {
  await start(page, { remember: true });
  await answer(page, 4).check();
  await page.getByRole('button', { name: '⚑ 标记待复核' }).click();
  await page.getByRole('button', { name: '英文原题', exact: true }).click();
  await next(page).click();
  await page.reload();
  await expect(page.getByText(/发现此设备上保存的进度：已答 1 \/ 32 题/)).toBeVisible();
  await page.getByRole('button', { name: '继续上次作答' }).click();
  await expect(questionNumber(page)).toContainText('QUESTION 02');
  await expect(page.getByRole('checkbox', { name: '选后自动下一题' })).not.toBeChecked();
  await expect(page.locator('.pole-en')).toHaveCount(2);
  await page.getByRole('button', { name: '← 上一题' }).click();
  await expect(answer(page, 4)).toBeChecked();
  await expect(page.getByRole('button', { name: '● 已标记待复核' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '见己，回到介绍页' }).click();
  await page.getByRole('checkbox', { name: /在此设备保存进度/ }).uncheck();
  await expect(page.getByRole('status')).toContainText('已移除本地草稿');
  await page.reload();
  await expect(page.getByRole('button', { name: '开始认识自己' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /在此设备保存进度/ })).not.toBeChecked();
});

test('clearing in another tab cannot be undone by stale navigation or page exit', async ({ page, context }) => {
  await start(page, { remember: true });
  await answer(page, 5).check();
  const clearingPage = await context.newPage();
  await clearingPage.goto('/');
  await clearingPage.getByRole('button', { name: '换一位 / 重新开始' }).click();
  await clearingPage.getByRole('button', { name: '清空并重新开始', exact: true }).click();
  await expect(clearingPage.getByRole('button', { name: '开始认识自己' })).toBeVisible();

  // These actions used to write the old in-memory answers back into localStorage.
  await page.getByRole('button', { name: '见己，回到介绍页' }).click();
  await Promise.all([page.waitForEvent('close'), page.close({ runBeforeUnload: true })]);
  await clearingPage.reload();
  await expect(clearingPage.getByRole('button', { name: '开始认识自己' })).toBeVisible();
  await expect(clearingPage.getByRole('button', { name: '继续上次作答' })).toHaveCount(0);
  await expect(clearingPage.getByRole('checkbox', { name: /在此设备保存进度/ })).not.toBeChecked();
});

test('disabling persistence in another tab cannot be undone by a stale save', async ({ page, context }) => {
  await start(page, { remember: true });
  await answer(page, 4).check();
  const otherPage = await context.newPage();
  await otherPage.goto('/');
  await otherPage.getByRole('checkbox', { name: /在此设备保存进度/ }).uncheck();
  await expect(otherPage.getByRole('status')).toContainText('已移除本地草稿');
  await page.getByRole('button', { name: '见己，回到介绍页' }).click();
  await Promise.all([page.waitForEvent('close'), page.close({ runBeforeUnload: true })]);
  await otherPage.reload();
  await expect(otherPage.getByRole('button', { name: '开始认识自己' })).toBeVisible();
  await expect(otherPage.getByRole('checkbox', { name: /在此设备保存进度/ })).not.toBeChecked();
});

test('newer answers from one tab survive edits and exit from a stale tab', async ({ page, context }) => {
  await start(page, { remember: true });
  await answer(page, 5).check();
  const newerPage = await context.newPage();
  await newerPage.goto('/');
  await newerPage.getByRole('button', { name: '继续上次作答' }).click();
  await expect(questionNumber(newerPage)).toContainText('QUESTION 02');
  await answer(newerPage, 4).check();
  await answer(page, 2).check();
  await Promise.all([page.waitForEvent('close'), page.close({ runBeforeUnload: true })]);
  await newerPage.reload();
  await newerPage.getByRole('button', { name: '继续上次作答' }).click();
  await expect(questionNumber(newerPage)).toContainText('QUESTION 03');
  await newerPage.getByRole('button', { name: '← 上一题' }).click();
  await expect(answer(newerPage, 4)).toBeChecked();
  await newerPage.getByRole('button', { name: '← 上一题' }).click();
  await expect(answer(newerPage, 5)).toBeChecked();
});

test('a storage write failure is visible and never pretends progress was saved', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () { throw new DOMException('Storage denied', 'QuotaExceededError'); };
  });
  await page.goto('/');
  await page.getByRole('checkbox', { name: /在此设备保存进度/ }).click();
  await expect(page.getByRole('checkbox', { name: /在此设备保存进度/ })).not.toBeChecked();
  await expect(page.getByRole('status')).toContainText(/无法|未能|失败|拒绝/);
  await page.getByRole('button', { name: '开始认识自己' }).click();
  await page.getByRole('checkbox', { name: '选后自动下一题' }).uncheck();
  await answer(page, 2).check();
  await expect(page.locator('.draft-line')).toContainText('仅保留在当前页面');
  await page.reload();
  await expect(page.getByRole('button', { name: '开始认识自己' })).toBeVisible();
});

test('publish HTML runs independently without loading other assets or exposing source files', async ({ page, request }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/publish/index.html');
  await page.getByRole('button', { name: '开始认识自己' }).click();
  await expect(questionNumber(page)).toContainText('QUESTION 01');
  expect(requests.every(url => url.endsWith('/publish/index.html'))).toBe(true);
  expect((await request.get('/src/app.js')).status()).toBe(404);
  expect((await request.get('/package.json')).status()).toBe(404);
});

test('double-click file delivery works offline through complete scoring', async ({ page, context }) => {
  await context.setOffline(true);
  const fileUrl = pathToFileURL(fileURLToPath(new URL('../../index.html', import.meta.url))).href;
  await complete(page, { url: fileUrl });
  await expect(page.getByText('已完成 32 / 32', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'IE 原始分数 28，范围8到40，中点24' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'SN 原始分数 16，范围8到40，中点24' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'FT 原始分数 28，范围8到40，中点24' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'JP 原始分数 20，范围8到40，中点24' })).toBeVisible();
});


test('printing welcome and question pages keeps their content visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#appVersion')).toHaveText('1.4.0');
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: '开始认识自己' })).toBeVisible();
  await expect(page.locator('.site-header')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: '开始认识自己' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(questionNumber(page)).toBeVisible();
  await expect(next(page)).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
});


test('reports are local, available only after completion, downloadable and printable', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await start(page);
  await expect(page.getByRole('button', { name: '下载 PNG 图片' })).toHaveCount(0);
  for (let number = 1; number <= 32; number++) { await answer(page, 1).check(); await next(page).click(); }
  await expect(page.getByRole('button', { name: '下载 PNG 图片' })).toHaveCount(0);
  await page.getByRole('button', { name: '查看我的偏好轮廓 ↗' }).click();
  await expectNoHorizontalOverflow(page);
  const report = page.locator('.print-report');
  await expect(report).toBeHidden();
  await expect(report).toContainText('偏好轮廓：ESTJ');
  await expect(report).toContainText('应用版本：1.4.0');
  await expect(report).toContainText('原始分 28 / 40 · 刻度位置 62.5%');
  await expect(report).toContainText('非官方 MBTI，中文试译，未经心理测量验证');
  await expect(report).not.toContainText('待复核');
  await page.evaluate(() => {
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) { window.__downloadLink = this; window.__linkMounted = this.parentNode === document.body; }
      return click.call(this);
    };
  });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '下载 PNG 图片' }).click()]);
  expect(await page.evaluate(() => window.__linkMounted && !window.__downloadLink.isConnected)).toBe(true);
  expect(download.suggestedFilename()).toMatch(/^jianji-ESTJ-\d{4}-\d{2}-\d{2}\.png$/);
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  expect(png.length).toBeGreaterThan(1000);
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(1080);
  await page.evaluate(() => {
    window.__originalTitle = document.title;
    window.print = () => { window.__printed = document.title; };
    const setTimer = window.setTimeout;
    window.setTimeout = (callback, delay, ...args) => {
      if (delay === 60000) { window.__restoreByTimeout = callback; return 0; }
      return setTimer(callback, delay, ...args);
    };
  });
  const printButton = page.getByRole('button', { name: '打印 / 保存 PDF' });
  await printButton.click();
  expect(await page.evaluate(() => window.__printed)).toMatch(/^jianji-ESTJ-\d{4}-\d{2}-\d{2}$/);
  await expect(page).toHaveTitle(/^jianji-ESTJ-\d{4}-\d{2}-\d{2}$/);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page).toHaveTitle(await page.evaluate(() => window.__originalTitle));
  await printButton.click();
  await page.evaluate(() => document.dispatchEvent(new Event('pointerdown')));
  await expect(page).toHaveTitle(await page.evaluate(() => window.__originalTitle));
  await printButton.click();
  await page.evaluate(() => window.__restoreByTimeout());
  await expect(page).toHaveTitle(await page.evaluate(() => window.__originalTitle));
  await page.emulateMedia({ media: 'print' });
  await expect(report).toBeVisible();
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.result-intro')).toBeHidden();
  await expect(page.locator('.report-download')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await expect(report).toBeHidden();
  expect(requests.every(url => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
});


test('iOS falls back to file sharing or a long-press image', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { value: 'iPhone' });
    navigator.canShare = data => !!data.files;
    navigator.share = async data => { window.__sharedFile = data.files[0].name; };
  });
  await complete(page);
  await page.getByRole('button', { name: '下载 PNG 图片' }).click();
  await expect.poll(() => page.evaluate(() => window.__sharedFile)).toMatch(/^jianji-ESTJ-\d{4}-\d{2}-\d{2}\.png$/);
  await page.evaluate(() => { navigator.canShare = () => false; });
  await page.getByRole('button', { name: '下载 PNG 图片' }).click();
  await expect(page.getByRole('dialog', { name: '保存报告图片' })).toBeVisible();
  await expect(page.getByAltText('见己报告，长按保存')).toHaveAttribute('src', /^data:image\/png;base64,/);
});
