---
title: "UI 缺口并行审查 2026-10-01"
type: progress
status: draft
phase: M7
updated: 2026-10-01
summary: "四路只读审查 UI 缺口已齐：3 条 Critical（Changes 假活写钮、焦点环被抹、PRD-008 配对框不出现）与 Important/Minor 清单。未改产品源码，未开方案，PRD 不升档。"
---

# UI 缺口并行审查 2026-10-01

> 只读审查，不改产品源码。门禁只走本地 [health-gates](health-gates.md)。「不做」项（U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC）不算缺口。

## 范围与方法

四路 reviewer 按片互斥，对照 HEAD 源码而非文档声称。父代理抽查了表中标 ✔ 的锚点（行号与代码一致）。未标 ✔ 的是 reviewer 报告，尚未逐条核验。

| 路 | 片 | 状态 |
|:---|:---|:-----|
| U1 | 会话 / 聊天（conversation、chat、banner、policy） | 已回 |
| U2 | Sessions 壳 / Sources / 侧栏 / 预览 | 已回 |
| U3 | 设置 / 连接 / Customizations / Automations（含 PRD-008 配对） | 已回 |
| U4 | 可访问性 / 响应式 / 视觉一致性 / Web 一致性 | 已回 |

## Critical

| # | 缺口 | 锚点 | PRD / D | 建议 |
|:--|:-----|:-----|:--------|:-----|
| C1 | **Changes 在 loading / 配对时留着可点的写钮**。`activeSessionLoading` 为真时视图直接 `return`，上一会话文件与 Create PR / Merge 钮仍在；服务层用 `lastValue` 冻住分支与 PR；`invokeOperation` 只判 `this.connection`，配对 leftover-looks-live 仍会发 `invokeChangesetOperation` | `sessions/contrib/changes/browser/changesView.ts:440-444` ✔、`983-986`、`1076-1078`；`changesViewService.ts:357-359`（同目录）✔；`sessions/contrib/providers/agentHost/browser/agentHostSessionChangesets.ts:356-393` | PRD-007；对照 D312 | loading / pairing 时禁用并卸写钮、标 leftover，闸住 `invoke` |
| C2 | **透镜 tab 与 SessionBar 钮键盘焦点环被抹掉，无替代**。`:focus` 与 `:focus-visible` 均 `outline: none !important`；同文件 Inbox 已用 `focusBorder`，可照抄 | `workbench/contrib/conversation/browser/media/conversationLens.css:86-88` ✔；`workbench/browser/parts/conversation/media/conversationPart.css:140-147` ✔ | PRD-018、PRD-028#4、D17 | `:focus` 去环，`:focus-visible` 画 `var(--vscode-focusBorder)`（未核全仓是否另有替代环） |
| C3 | **PRD-008 配对框不出现（D8 证据 PARTIAL）**。Connect 只 `await confirmPairing()`；主进程 `showMessageBox` 不绑 `BrowserWindow`；`askPairingMainDialog` 无 dialog 时静默返回 `false`。`promptSasConfirmDialog` 在生产代码里没有调用点。与 `d8-evidence/7cf1474419e` 一致：停在 Waiting for pairing，框未出 | `workbench/contrib/conversation/browser/connectionPreferencesPane.ts:1690-1720` ✔；`platform/universeAgent/electron-main/universeAgentMainService.ts:50-58` ✔（无窗口参数）；`connectionPreferencesPaneSas.ts:134-148`、`168` ✔ | PRD-008；[prd-008-engine-e2e](../plans/prd-008-engine-e2e.md) GC-1b | Connect 挂 `promptSasConfirmInPane`；主进程框必须带当前窗。reviewer 称「页内 SAS 宿主从未挂上」，但 pane 内 `pairingConfirmHost`（`:422,744-746,1000-1015`）有挂载与聚焦逻辑，是否另有挂载点未核，修前须先查 |

## Important

| # | 缺口 | 锚点 | PRD / D | 建议 |
|:--|:-----|:-----|:--------|:-----|
| I1 | 图示卡 leftover Stub 文案：live 图示无 title 时写「Stub: diagram / comparison」，解析失败写「Stub: error」 | `workbench/contrib/conversation/browser/conversationVisualizeCard.ts:51` ✔、`81-83` ✔ | PRD-014、PRD-007 | live 用 Diagram / Comparison / Error |
| I2 | 提问座位假 pending：答案 key 无效且无 payload 时只留「Input needed」，无选项、无诚实空态 | `workbench/contrib/conversation/browser/conversationQuestionSeat.ts:74-82` | PRD-004、PRD-021 | 画「无法作答」+ preview |
| I3 | sideChat 不画 pill，点击不导航（被当 miss） | `workbench/contrib/conversation/browser/resolveConversationTimelineLink.ts:92` | PRD-003.6；D465 | 协议有条目后按 §3.3b 画 pill；D465 已声明先修订 §3.3 |
| I4 | 策略遮罩：焦点停在 overlay 上时，非 card 目标的按键全被 `preventDefault`，首个 Tab 被吞；焦点进 card 后可用 | `sessions/contrib/policyBlocked/browser/sessionsPolicyBlocked.ts:57-73` ✔ | PRD-018 | `overlay.focus()` 改为聚焦 card 首个可聚焦钮，并做 Tab 回环（reviewer 原称 Sign In 不可达，父代理核后降级） |
| I5 | Banner / 反馈失败无错误态：无 widget 时只写日志，按钮复原 | `sessions/contrib/sessionInputBanners/browser/sessionInputBanners.ts:437-439`；`sessions/contrib/agentFeedback/browser/agentFeedbackService.ts:968-971` | — | banner 失败文案 |
| I6 | Sessions Part 焦点未接到对话：F6 / 四钮进对话落空 | `sessions/browser/workbench.ts:2035-2037` ✔（TODO）；已有 `SessionView.focus`、`SessionsPart.focusSession` | PRD-018 | `focusPart(SESSIONS_PART)` 改调 `focusSession(active)` |
| I7 | GitHub 预览假可写：同时标 `Readonly` 与 `FileReadWrite`，`writeFile` 抛 `NoPermissions` | `sessions/contrib/fileTreeView/browser/githubFileSystemProvider.ts:80-83` ✔、`328-329` | PRD-007 | 去掉 `FileReadWrite` |
| I8 | GitHub 树截断装完整：忽略 API `truncated` | 同文件 `200-237` | PRD-007；sources P4 | `truncated` 时状态行写「未列全」 |
| I9 | Changes 无失败态：hydrate 失败后 loading 落下，只画「Changed files will appear here.」 | `changesView.ts:819-824`、`1007-1008` | PRD-007 | 失败文案与空成功分开 |
| I10 | GitHub Files 树入口关掉：auxiliary bar 未定故不注册视图，FS 已挂 | `sessions/contrib/fileTreeView/browser/fileTreeView.contribution.ts:13-14` | — | 有 workspace 则注册，否则收掉入口 |
| I11 | 写失败无用户面：`invokeOperation` 无连接直接 return、无 catch；`git.sync` 失败无提示 | `changesView.ts:398-400`；`sessions/contrib/files/browser/files.contribution.ts:120-124` | PRD-007 | 失败 notice；无连接时钮 disabled |
| I12 | Changes 行 ARIA 过瘦，只有 basename | `changesView.ts:1524-1526` | PRD-018 | aria 带路径与状态 |
| I13 | Sessions 动画未接 T1：71 个文件有动画，9 个有 reduced-motion，`.ua-motion` 为 0 | 代表 `sessionsList.css`（19）、`chatInput.css`（16） | PRD-018 | 挂 `.ua-motion` 或本地 `prefers-reduced-motion: reduce` |
| I14 | 全局 `input` / `textarea` 的 `:focus-visible` 被 `outline: none` 掐掉；标题栏 widget `:focus` 无环 | `sessions/browser/media/style.css:117-122`；`sessions/contrib/sessions/browser/media/sessionsTitleBarWidget.css:62-65` | PRD-018、028#4 | 补 `focusBorder` |
| I15 | 发送钮 22×22 低于 24px 触控目标，wrapper 与 inner 都 `outline: none` | `sessions/contrib/chat/browser/media/chatInput.css:372-407` | PRD-018 | ≥ 24px，wrapper 加 `:focus-visible` 环 |
| I16 | 证据对不齐：约 150 张未跟踪截图不是键盘 / axe / Web 证据，`live_workbench_batch85.png` 4.6KB 白屏；D17 仍开 | `screenshots/`、`tactile_*`、`live_*` | PRD-018、D17 | 不凭截图关 PRD-018 |
| I17 | I6 发行标识未完（D12 / D18 open）：`product.json` 仍是开发期 `studio.universeagent.app` 与两个 UUID；无 Appx `Publisher` / `PublisherDisplayName`（`resources/win32/appx/AppxManifest.xml:18,23` 仍是上游 Microsoft 值） | `product.json:28-30` ✔ | I6；D12、D18 | 第一次面向用户打包前由发布方填正式 id；换 id 不迁 secret |
| I18 | Sessions Customizations 仍带 Copilot 脸：左 nav 含 Plugins / Tools / Automations / HarnessSettings；Overview 有 sparkle「Customize Your Agent」；默认 `~/.copilot`；空态写 Copilot | `sessions/contrib/chat/browser/aiCustomizationWorkspaceService.ts:97-107`；`aiCustomizationWelcomePagePromptLaunchers.ts:189-205`；`configuration.contribution.ts:41`；`aiCustomizationListWidget.ts:1024,1905` | [settings-two-surfaces](../plans/settings-two-surfaces.md) | Sessions 对齐 donor：去营销 / 市场 / Automations 左 nav（默认窗五节已对） |
| I19 | Engine Triggers / Clipboard / Context Variables 键盘与 ARIA 不足：行只有 click，无 `tabIndex` / 方向键；Clipboard、Context 无 `aria-*`。History 在 SessionBar，不在 Engine 十二节 | `workbench/contrib/conversation/browser/engineTriggersSection.ts:319-327` | PRD-018 | 行改可聚焦 list + 读屏名；History 进设置页须单独立项 |

## Minor

- `sessions/contrib/chat/browser/branchChatSessionAction.ts:52,108` 已注册但 `when:false`，`run` 仍抛错。
- 提问 Submit 缺必填项时静默；`@` listbox 缺 `aria-activedescendant`；`sessions/contrib/chat/browser/newChatWidget.ts:131` 读全局 activeSession。
- 空态无 `aria-live`（Sessions 全层仅 4 处 `aria-live`）。
- `sessions/contrib/applyCommitsToParentRepo/browser/applyChangesToParentRepo.ts:72` 菜单恒 `false`（F1 仍在）。
- `changesView.ts:82` 违反 SESSIONS.md「contrib 不依 provider 内部」（eslint TODO）。
- 硬编码 `font-size` 约 148 处；aquarium、`mobileOverlayViews` 硬编码色；`conversationLens.css:3241` 的 `caret-color: rgb(...)`。
- Generate X 仍开无工作区 Chat（`workbench/contrib/chat/browser/aiCustomization/customizationCreatorService.ts:67`）；Client TOC 留 emptyCopy 兜底（D20 300px 未目视）；aquarium / chatDebug / onboarding 属 Sessions 彩蛋。
- `outline: none` 在 `src/vs/sessions` css 中 65 处（32 文件），`:focus-visible` 58 处（27 文件）；7 个文件有前者无后者。

## 已核对、不报

- Q5a 停洗白、Q6 `is-narrow`、Accessible View、提问座位、`requestDetail`、composer `@` chip（D464）均在 HEAD。
- r03 方案与 sources-architecture P6 / P7 与 HEAD 对上。D31 仍开，属默认窗，本轮未代验。
- `sessions.web.main.ts:210-211` 的 `TODO` + `NullAgentFeedback`、SSH / WSL 为 Null：Sessions 窗诚实降级，不是 Conversation Web 缺口。PRD-019 / W1 / D15 保持 accepted 正确。
- D467（隐藏叶回收）为有意延期，不在本轮重开。
- PRD-018 / PRD-019 与 [a11y 方案](../plans/accessibility-responsive-ui.md) 仍 `accepted`，与「代码已落、手测 / axe 未做」一致，本文不改其状态。

## U3 补充

- PRD-008 的阻塞点是 C3：下次 D8 复跑前先让配对框出现并点 Verified on Engine，全 PASS 之前不升档。不得用回环或 fixture 冒充 Engine。
- Engine 十二节与 Client 设置的结构符合 settings-two-surfaces；缺口集中在 Sessions 侧的 Copilot 残留（I18）与行级可达性（I19）。

## 下一步

1. Critical / Important 逐条核验后再决定是否进 [deferred-gaps](deferred-gaps.md) 或开方案。
2. 本文只是发现稿。不登记 D 编号、不改任何 PRD 状态，待用户拍板。
3. 验证只用本地 `npm run compile`、eslint、`scripts/test.sh`（点名相关测）。
4. 收口方案：[ui-gap-closeout-2026-10-01](../plans/ui-gap-closeout-2026-10-01.md)（draft）。条目取舍以该方案核验节为准。
