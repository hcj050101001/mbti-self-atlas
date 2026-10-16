# 见己 · MBTI 四维探索

直接双击 `index.html` 即可离线使用。给他人转发时只需发送这一个 HTML 文件；无需安装依赖、登录或启动服务器。手机可通过静态网站访问；部分手机的文件预览器不会执行 JavaScript，需要使用完整浏览器。

本工具采用 Eric Jorgenson 的 **OEJTS 1.2，32题固定版**，并非官方 MBTI。中文为项目试译，未经心理测量验证，不能承诺“严格测出”或适用于全部人群。原量表亦不保证信度或准确性。需要正式测评时，请使用 [Myers & Briggs Foundation 的官方入口](https://www.myersbriggs.org/my-mbti-personality-type/take-the-mbti-Instrument/)。

## 使用

1. 阅读说明，按平常的真实状态选择五点选项。
2. 默认选后自动下一题，可关闭；支持数字 1–5、Enter 和上一题。选择英文原题可核对翻译，难以判断的题可标记复核。
3. 32题全部完成才生成结果。先复核，再复制完整结果回到对话；可补充生活实例、下载 TXT 或 JSON。
4. 默认不持久保存。主动勾选后保存到本浏览器 localStorage；共用设备时关闭保存或选择“换一位 / 重新开始”。

## 来源与计算

- [原始题目、计分键、许可 PDF](https://openpsychometrics.org/tests/OJTS/development/OEJTS1.2.pdf)，本地副本 `sources/OEJTS1.2.pdf`。作者 Eric Jorgenson，2015-03-03。
- [开发说明](https://openpsychometrics.org/tests/OJTS/development/)。开发页及在线版包含不同题数叙述；本工具只采用以上32题PDF，不混用其他版本。
- [官方 MBTI 版权与许可](https://www.themyersbriggs.com/en-US/Support/Copyright-and-Permissions)。未复制其专有题库。
- [16Personalities 模型说明](https://www.16personalities.com/articles/our-theory)。未把 NERIS 的分数或 A/T 后缀混入本工具。

每题保留原序号与两极，1最靠左、5最靠右。四维均为8–40分，中点24；原版 >24 取 E/N/T/P，否则取 I/S/F/J。本页同时显示原版规则结果和保留边界的轮廓：距24不超过2分（22–26）显示 X。这是页面阅读约定，不是源量表规则或经过验证的置信区间。原始分数不解释为准确率、概率或常模百分位。

“标记复核”、中间项个数和前台作答时长不参与计分，也不用于判定回答有效性。没有暗中添加题目、删题、权重、人口学阈值、AI判型或认知功能推断。结果报告包含全部32题回答、四维分数、精确公式、版本和来源，便于复算。

中文题目与难译说明在 `sources/items.json`；原始计分元数据在 `sources/oejts-1.2.json`。部分原题涉及生活条件、活动、语言与文化偏好，不保证跨群体测量等值。

## 开发与检查

```powershell
node build.mjs
node --check src/app.js
node --test tests/core.test.cjs tests/app-state.test.cjs
```

`src/template.html`、`src/styles.css`、`src/app.js`、`src/core.js` 和题库由构建脚本嵌入单文件 `index.html`。构建无需任何第三方依赖。只修改源文件后请重新构建。

页面不加载外部脚本、字体、统计或接口。资料链接会打开第三方网站，主动复制/下载会产生你选择分享的完整报告。

## 已执行的验证

2026-10-15：16项自动化测试通过，覆盖四维公式、全部16型极值、每题方向、临界值、缺答拒绝、存储拒绝、清空失败和异步复制回退。浏览器通过本地HTTP跑通32题作答、自动下一题、复核标记、修改后重新计分、刷新恢复、复制结果、JSON下载及清空后刷新。下载文件已重新读取并核对32个答案、四维分数和笔记。390像素窄屏及1280像素桌面布局均检查无横向溢出。

内嵌浏览器安全策略仅允许HTTP/HTTPS，禁止直接验证 `file://`；没有绕过该限制。交付HTML的题库、样式和脚本全部内嵌，无运行时外部依赖，但双击文件模式与各手机浏览器未逐一实测。

## 许可与改编

原题作者 Eric Jorgenson (2015)。原量表及本中文改编按 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 署名、非商业、相同方式共享；本工具整体也以该许可共享。改动包括中文试译、交互界面、边界提示和结果导出，不暗示原作者、OpenPsychometrics 或 MBTI 官方背书。商业使用需要另行处理许可，不能将此版冒充官方或已验证中文量表。

来源核对日期：2026-10-15。
