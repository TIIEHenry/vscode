---
title: "视觉设计只读审查 2026-10-16"
type: progress
status: draft
phase: M7
updated: 2026-10-16
summary: "对照 UI 设计原则审查 agent-ide 工作区未提交的视觉改动：5 条需要改（Tools 双行、500 字重、发丝线三档、只读分支芯片假可点、文件夹芯片名实不符），3 条建议改，1 条可接受。静态审查，未截图。不登记 D、不改 PRD。"
---

# 视觉设计只读审查 2026-10-16

> 只读审查，不改产品源码。基准是 [UI 设计原则与规范](../../docs/architecture/cross-cutting/ui-design-principles.md)（下文 § 均指该页）。门禁只走本地 [health-gates](health-gates.md)。

## 范围与方法

- 对象：`agent-ide` 工作区 2026-10-16 未提交改动里影响视觉的部分，包括 `conversationLens.css`、`enginePreferencesPane.css`、过程折、身份条、Engine 首选项的 Tools / Triggers / MCP 分节、Navigator Projects 树，以及 Sources Files / Tabs。只改存储键或请求参数、不改外观的部分，不在本文范围内。
- 方法：只读 diff 与源码，逐条对照规范。下表锚点都是当前工作区行号，父 agent 已逐条核对。
- 未做：没有启动窗口截图。§8 要求的浅色和深色截图、键盘走查、窄宽（`.is-narrow`）截断检查都还没做。

## 已符合

差异统计用 `chat.linesAddedForeground` / `chat.linesRemovedForeground`（§5.1）；错误回合不再用红色铺底，红色只留在标题上；`file_edit` 卡不投影；Triggers 图标钮命中区 22px，并补齐 `:focus-visible`、高对比描边和 `.monaco-reduce-motion`（原则四、原则七）；这批改动没有新增 `transform` 或 `filter` 反馈。

## 需要改

| # | 问题 | 锚点 | 规范 | 建议 |
|:--|:-----|:-----|:-----|:-----|
| V1 | Tools 列表仍是双行：分组头 28px，无说明的行 28px，有说明的行 44px。分组头仍全大写、11px、600 字重。CSS 注释仍写「48px line box」 | `engineToolsSection.ts:73-75`、`:95`；`enginePreferencesPane.css:769-775`、`:826` | §4 目录类列表行 24px；§5.3 单行、分组头正常大小写加弱化计数（2026-10-11 用户选定） | 归 [cursor-visual-alignment](../plans/cursor-visual-alignment.md) S9，实施时一并同步 `engine-catalog.md` 的行高描述 |
| V2 | 过程折工具名改成了 500 字重 | `conversationLens.css:1778` | 原则二字重只用 400 / 600；§5.1 普通步骤字重与说明文字同级 | 改 400 |
| V3 | 发丝线透明度出现三档：`file_edit` 卡 10%，错误回合 12%，规范值 8% | `conversationLens.css:1788` 起、`:4130` 起 | §3.2 低对比描边 8% | 统一 8% |
| V4 | 引擎工作根下分支芯片只读（不弹菜单、chevron 已藏），但仍是 `<button>`，`cursor: pointer` 与悬停底色照旧 | `conversationIdentityStrip.css:95-109`；`conversationIdentityStrip.ts:310` | §7 反模式：看起来可点却不能操作 | 只读态加类，去掉 hover 与 pointer |
| V5 | 文件夹芯片显示会话工作根的目录名，点开却是重开窗口的文件夹菜单，读屏名仍是 "Workspace folder: …" | `conversationIdentityStrip.ts:269-273`、`:350` | §6 诚实降级；PRD-018 读屏名须与可见内容一致 | 引擎工作根下改为只读，或让菜单与读屏名跟随工作根；属行为取舍，待用户定 |

## 建议改

| # | 问题 | 锚点 | 规范 | 建议 |
|:--|:-----|:-----|:-----|:-----|
| V6 | Triggers 动作改成 6 个纯图标钮：Add 是幽灵图标；Enable（对勾）与 Disable（斜线圆）同时常驻，难以分辨；Delete 紧挨 Fire，中间没有分隔 | `engineTriggersSection.ts:141-156` | §5.6 次按钮如 `+ New` 用小号描边钮；§5.3 分组头右端至多一个次按钮 | Add 改 `+ New` 次按钮；Enable / Disable 合成随状态切换的一个按钮；Delete 前加分隔或移进 `…` |
| V7 | 错误回合内衬 `6px 10px`、`file_edit` 卡内衬 `4px 8px`，再加 1px 描边，图标和文字比相邻回合或步骤右移约 9–11px，阅读列左缘断开 | `conversationLens.css:1788` 起、`:4130` 起 | 原则三对齐 | 用负 `margin-inline` 抵消；若是有意为之，写进 §5.1 |
| V8 | 统计格式固定为 `+N −M`，新增文件也会出现红色的 `−0` | `conversationProcessFold.ts:533`、`:539` 起 | §5.1 增删数字是这一行唯一的彩色，零值没有信息 | 零值保持弱化色，只给非零数字上色 |

## 可接受

- Navigator 工作目录行在主标签后加「· current session」（`navigatorProjectsTree.ts:69`），与已有的「· current workspace」同一模式。它会随切换会话跳动，当前会话行本身已有选中态。按 §5.3 更适合放在同一行右侧作弱化元信息，不阻塞。

## 存量（不在本批改动里）

- `conversationLens.css:2635`、`:2659`、`:4581` 另有 500 字重，与 V2 同属原则二偏差。

## 下一步

1. 本文只是发现稿，不登记 D 编号，不改任何 PRD 或方案状态，待用户拍板。
2. V1 随 [cursor-visual-alignment](../plans/cursor-visual-alignment.md) S9。V2–V4、V8 见 [visual-review-2026-10-16-plan](../plans/visual-review-2026-10-16-plan.md)，`draft`，未实施。V5、V6、V7 仍须用户先定。
3. 修完按 §8 补截图、键盘走查和窄宽检查。验证只用本地 `npm run compile`、eslint、`scripts/test.sh`（点名相关测试）。
