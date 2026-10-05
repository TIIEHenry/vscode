---
title: "2026-10-05 自有界面视觉审查"
type: progress
status: completed
phase: M7
updated: 2026-10-06
summary: "并行审查 Agent IDE 自有界面：八项已确认视觉问题及一项待实测疑点，排除 VS Code 原生界面。"
---

# 2026-10-05 自有界面视觉审查

> 按 [文档维护规则 15](../../../docs/DOCUMENTATION.md#规则-15并行看板) 记录本轮并行审查。本轮只读产品源码，不实施修复。

## 范围与分工

| 路 | 范围 | 状态 |
|:---|:-----|:-----|
| Sessions | 自有 Sessions 网页工作台、手机布局 | 已审 |
| Conversation | 编辑器壳中的 Conversation / Agent UI 自有区域 | 已审 |
| 其他自有页面 | Engine / Connection / Client 设置、Customizations、语音导览等 | 已审 |
| 横切核验 | 对照 PRD-028 视觉规范、当前运行画面与共用壳 CSS | 已审 |

## 判定

- 排除 VS Code 原生控件和没有本仓定制的上游界面。
- 历史 `screenshots/` 仅作线索；每条发现须有当前源码或运行画面支撑。
- 问题写明触发条件、用户可见后果与代码位置；与现有延期账重复的标已知。

## 结果

| 优先级 | 发现与复现 | 当前证据 |
|:-------|:-----------|:---------|
| P2 | **Sessions Web 窄桌面窗口裁掉主内容。** Chrome/Linux 390×844 时仍按桌面分栏排版，中央 “Connect a host to get started” 标题超出右边界且无横向滚动；同一宽度的 Part 构建却按 `<640` 选手机 Part。 | [实拍](../../../screenshots/visual-audit-2026-10-05-sessions-narrow.png)；`src/vs/sessions/browser/layoutPolicy.ts:42–54`、`src/vs/sessions/browser/parts/sessionsParts.ts:47–49`。仅复现于窄桌面浏览器，不把它写成实际手机失效。 |
| P2 | **Conversation 回合的方向键焦点不可见。** 焦点在 `article`，浅色主题下轮廓、边框和阴影均无；读长时间线时无法看出当前回合。 | [实拍](../../../screenshots/visual-audit-2026-10-05-timeline-focus.png)；`src/vs/workbench/contrib/conversation/browser/conversationTimelineHost.ts:1173`、`browser/media/conversationTimeline.css:69–72`。运行 DOM：`active=true`、`outline:none`。 |
| P2 | **Visualize 展开按钮的 Tab 焦点不可见。** `:focus-visible=true` 时按钮与父卡均无轮廓或阴影。 | [实拍](../../../screenshots/visual-audit-2026-10-05-visualize-focus.png)；`src/vs/workbench/contrib/conversation/browser/media/conversationVisualize.css:18–23,63–68`。 |
| P2 | **Sessions 手机顶栏按钮的键盘焦点不可见。** iPhone 13 仿真下 Tab 到 Open sessions，实测 `:focus-visible=true`、`outline:none`、背景透明；账号钮同类。 | `src/vs/sessions/browser/parts/mobile/mobileChatShell.css:57–64,135–142`；`mobileTitlebarPart.ts:132`。 |
| P2 | **Connection 的 Light+ 选中分区文字近乎消失。** 选分区后把焦点移到右侧表单，选中行背景为 `#E4E6F1`，标签仍是 `#FFF`，对比度约 1.24:1。 | [实拍](../../../screenshots/visual-audit-2026-10-05-connection-light-plus.png)；`src/vs/workbench/contrib/conversation/browser/media/connectionPreferencesPane.css:102–109`。运行 DOM 计算色值与当前源码一致。 |
| 待实测 | **Customizations 窄模态疑似溢出。** 两栏最小宽 150+400=550px，宿主可缩到 400px；但 SplitView 的实际行为和内容态尚未运行核验，不能先判定为已复现 P2。 | `src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagement.ts:163–165`、`aiCustomizationManagementEditor.ts:519–537`；`src/vs/workbench/browser/parts/editor/modalEditorPart.ts:208,671–672`。仅源码推断，无实拍。 |
| P3 | **Sources 标签的键盘焦点只显示灰色悬停底。** Tab 到 Changes 时实测 `:focus-visible=true`，但没有 `focusBorder` 轮廓或阴影。 | `src/vs/workbench/contrib/sources/browser/media/sourcesTabs.css:190–194`；隔离窗口计算样式为 `outline:none`、`boxShadow:none`。 |
| P3 | **Sources Changes / Review 文件行仍是 28px。** 比 [PRD-028](../../../docs/product/requirements.md#prd-028-视觉语言与信息密度) 的 22px 上限高 6px，长列表每屏可见项更少。 | `src/vs/workbench/contrib/sources/common/sourcesChangesPresentation.ts:11`、`src/vs/workbench/contrib/sources/browser/media/sourcesChangesList.css:154–160`、`sourcesReviewList.ts:65`。属于已接受需求的未完成项。 |
| P3 | **Customizations 首次打开仍播放淡入上移。** 系统未开启减少动态、IDE 的 `workbench.reduceMotion=on` 时，160ms 入场动画仍播放。 | `src/vs/workbench/contrib/chat/browser/aiCustomization/media/aiCustomizationManagement.css:3667–3689` 只检查系统媒体查询；`src/vs/platform/accessibility/browser/accessibilityService.ts:86–87` 设置 `.monaco-reduce-motion`。 |

## 已登记差距与边界

- [UI 规范 §10](../../../docs/architecture/cross-cutting/ui-design-principles.md#10-head-与本规范的差距2026-09-28) 已记录 Visualize 浮层毛玻璃、Conversation Composer 的 16px 圆角和投影，以及整面空态的大图标；本轮实拍或源码确认仍在，但不重复记为新缺陷。
- 实拍来自本仓当前 `out/` 的隔离 Sessions Web 与编辑器壳；Customizations 的窄模态项仅做当前源码推导，V0 须测 pane 实宽与全部内容态后才能决定是否实施。
- 本轮排除 VS Code 原生表面，未对全部主题、缩放倍率和屏幕阅读器做穷举测试。

## 后续

- [自有界面视觉审查问题收口](../../plans/visual-audit-remediation-2026-10-05.md) 已于 2026-10-06 经独立 reviewer 与 Cursor CLI 的 Grok 4.6 只读复核后签收 `accepted`；八项已确认问题分切片，Customizations 窄模态先补实测。产品代码尚未实施。
- Grok 复核另发现旧响应式方案 / D19(3) 把 Connection 窄宽写成单栏滚动、无 Back，而 HEAD 已有窄宽导航与 Back。这是既存合同漂移；本轮 V3 只修选中行颜色，不改导航合同，也不重宣 D19(3) 验收。
