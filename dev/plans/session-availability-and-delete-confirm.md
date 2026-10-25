---
title: "会话就绪度单一判定、删除会话确认与会话列表排序"
type: plan
status: accepted
phase: M7
updated: 2026-10-25
summary: "2026-10-24 设计评审的缺口：删除会话无确认；会话未就绪在 13 处各判一遍，门闩、Agent 座、失败提示与时间线空态说法互相矛盾；门闩整块黄底；会话列表组内不排序。S1 删除确认（先取会话、确认、再过写闸）；S2 只依赖 roster 的就绪度判定，原因只由门闩写一次，时间线写中性短语，控件按未连接 / 未就绪 / 引擎不支持三分；S3 门闩回到 §6 错误态；S4 组内排序；S5 读屏名回英文。覆盖 composer-agent-picker 的「不另写已连接但不能切换」。不改协议、不改引擎。已过只读审查。"
---

# 会话就绪度单一判定、删除会话确认与会话列表排序

> 需求：[PRD-002](../../docs/product/requirements.md#prd-002-会话上下文) 验收 5–6 · [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级) 验收 6 · [PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度) 验收 11（不改需求，代码回到规范）。
> 系统规格：[composer-and-inbox](../../docs/systems/conversation/composer-and-inbox.md) §1 · [lens-and-trajectory](../../docs/systems/conversation/lens-and-trajectory.md) §1 · [session-windows](../../docs/systems/conversation/session-windows.md) · [commands](../../docs/systems/conversation/commands.md) §3 · [stub-and-fixtures](../../docs/systems/conversation/stub-and-fixtures.md) §2 · [UI 设计原则](../../docs/architecture/cross-cutting/ui-design-principles.md) §6。
> 出处：2026-10-24 用户请求按 principled-design 评审当前 UI，评审结论列出删除无确认、三处说法矛盾、空与不可用不分、门闩违规、列表不排序；用户随即要求「用 grok 来实现，需要改文档你来」。

## 背景

2026-10-24 用测试配置开默认窗口、连钉死引擎做设计评审，观察到：

1. 删除会话点一下就删引擎会话。`deleteActiveSession`（`conversationLensSessionBar.ts` 约 627 行）、More 菜单删除（同文件约 266 行）和 `ConversationSessionsView.deleteActiveSession`（`conversationSessionsView.ts` 约 321 行）都没有确认，只在失败时回滚。Snapshots 的删除（`conversationEngineSnapshotsList.ts` 约 476–495 行）已经走 `IDialogService.confirm`，同类操作不一致。
2. 同一时刻：身份条是在线绿点，Preferences 写 Transport Healthy；门闩写 `Session unavailable — The engine is connected, but the active session is not ready.`；Agent 座写 `Needs an engine connection`。另一条刚才还显示 `root check` 的会话，切回来后时间线写 `No messages yet`。
3. 门闩 `.is-warning`（`conversationLens.css` 约 2933–2957 行）是黄底、黄框、600 字重、整句警告色，违反 UI 设计原则 §6 第 5、6 条与反模式 10。
4. Sessions 列表组内保持引擎顺序，`1 day / 3 wks / 2 wks / 1 day` 交错（`groupSessionsForRoster`，`conversationSessionsViewStrings.ts` 约 138–169 行）。
5. 下一级按钮的读屏名是中文 `下一级`（`conversationLensSessionBarStrings.ts:28`）。

根因与 [架构设计审查 2026-10-16](review-2026-10-16-architecture.md) 一致：派生状态没有唯一所有者。「已连接且 `isEngineSessionReady()` 为 false」在 conversation 下 13 处各写一遍，每处自己挑文案。`isEngineSessionReady()`（`conversationEngineRosterService.ts:157-172`）把「目录未拉完 / 正在绑定」和「绑定失败 / 会话不在目录」合成一个 false，界面分不出加载中和不可用。

时间线现状（只读审查核实）：`bindSessionView`（`conversationLensSessionBinding.ts:159-166`）在未就绪且换了会话时清空时间线；`isPreFirst`（`conversationLensProjection.ts:108-127`）只要 `getTurns` 为空、租约与已画行也为空就进 PreFirst，PreFirst 隐藏时间线并把门闩挪进居中区（同文件约 239–247 行）。所以未就绪时：roster 没缓存回合的会话落到 PreFirst，roster 有缓存回合的会话落到 Active，时间线被清空后露出 `No messages yet`。

## 决定

- **原因只写一次。** 会话未就绪的原因只由门闩写（PreFirst 在居中区，Active 在输入卡上方）。时间线空态在未就绪时只写中性短语，不带语义图标，不重复原因句（UI 设计原则 §6 第 5 条、反模式 10）。
- **PreFirst 保持。** 未就绪、roster 也没有缓存回合时仍进 PreFirst：居中区里没有「空会话」的文字，原因由居中区里的门闩给出。不改 `isPreFirst`。
- **控件三分。** 输入行里写出原因的控件（Agent 座、Permission、Model 的不可用文案与提示）：未连接或配对保持写 `Needs an engine connection`；会话加载中或不可用写短语 `Loading session…` / `Session unavailable`；会话就绪而引擎没有对应 hook 写 `Not supported by this engine`。这推翻 [composer-agent-picker](composer-agent-picker.md) §2「不另写已连接但不能切换」：生产引擎的 `switchAgent` 恒为不可用，改完后每个已连接会话在 PreFirst 的 Agent 座都写 `Not supported by this engine`。这是本次有意的结果。
- **加载态细进度条当时不在本刀。** UI 设计原则 §6 第 6 条要求加载中有视图顶部细进度条。本刀只给文字。进度条与 Navigator / Sources 归一后来由 [D1304](../progress/deferred-gaps.md) 落地，见文末。
- **范围。** 纳入 conversation 透镜、SessionBar、Sessions 视图、Inbox、Snapshots、引擎动作的 13 处。Navigator（`navigatorProjectsList.ts`、`navigatorAgentsView.ts`、`navigatorTeamList.ts`）、Sources 经 `IAgentSessionContext`（`sourcesChangesList.ts`、`sourcesReviewList.ts`、`conversationDiffReviewPane.ts`、`sourcesDiffPanelView.ts`、`sourcesChangesReadModel.ts`）只管读写闸、不写这几句原因，当时不动，同登记 D1304，已由文末落地。`conversationSessionChatService.ts:95` 语义不同（未连接也算），不纳入。

## S1 删除会话确认（PRD-002 验收 6）

- 新建 `conversationDeleteSessionConfirm.ts`（conversation browser），导出 `confirmDeleteConversationSession(dialogService: IDialogService, title: string): Promise<boolean>`。调用 `dialogService.confirm`：`type: 'warning'`，message `Delete session "{title}"?`，detail `This permanently deletes the session and its messages. This cannot be undone.`，`primaryButton: '&&Delete'`。标题为空时用 SessionBar 现有的显示名（`displayedSessionTitle` 的同一规则）。
- 定序（SessionBar 与 Sessions 视图相同）：
  1. 过写闸：pairing-hold 或会话未就绪，照旧拒绝（见 S2 的失败提示），不弹确认。
  2. 断连但有连接历史（`!isEngineConnected() && hasEngineConnectionHistory()`）照 `createNewSession` 的先例在确认前短路，提示 `engine_disconnected`，不弹确认。
  3. 取 sessionId 与标题（SessionBar 用 `getSessionBarSelectId?.() ?? getActiveSessionId()`，Sessions 视图用 `getActiveSessionId()`）。
  4. `await confirmDeleteConversationSession(…)`。取消：直接返回，不写草稿、不动 `pendingDeleteDraftMap`、不 `showPostFailure`、不发通知。
  5. 确认后重新过 1、2 两步，并检查该 id 仍在 `getSessions()` 里；不满足时按原拒绝路径处理（id 已不在则静默返回）。
  6. 用第 3 步的 id 走原有写草稿与 `deleteSession` 路径，失败回滚不变。
- `deleteActiveSession` 两处改为 async。SessionBar 按钮、More 菜单与 `ConversationSessionsDeleteSessionAction.runInView` 的调用改成 `void x.deleteActiveSession().catch(onUnexpectedError)` 或 `return` 这个 promise。
- 注入：`IConversationLensSessionBarHost` 加 `readonly dialogService: IDialogService`。`ConversationLens`（`conversationLens.ts` 约 307–321 行）与 `ConversationLeafSessionBar`（`conversationLeafSessionBar.ts` 约 82–93 行）按现有 `@IXxx public readonly` 习惯注入。`ConversationSessionsView` 构造函数加 `@IDialogService private readonly dialogService`。
- 不加撤销，不改引擎删除 RPC，不改 `deleteEngineSession` 的乐观删除与回滚，不改按钮位置。

## S2 会话就绪度单一判定（PRD-007 验收 6）

### roster

- `IConversationRosterService`（`conversationStubService.ts`）加可选 `getEngineSessionReadiness?(): ConversationSessionReadiness`。类型 `'ready' | 'loading' | 'unavailable'` 定义在新模块里并由 stub service 引用（避免循环时放 `conversationStubModel.ts`）。
- `ConversationEngineRosterService` 按 `isEngineSessionReady()` 现有分支顺序拆：未连接 → `ready`；`engineSessionBindFailed` → `unavailable`；`!listCompleted || pendingEngineBindSessionId` → `loading`；当前 id 为空或占位 id → `unavailable`；不在 `engineSessions` → `unavailable`；否则 `ready`。`isEngineSessionReady()` 改为 `getEngineSessionReadiness() === 'ready'`，外部行为不变。`ConversationStubService` 不实现。

### 判定模块 `conversationSessionAvailability.ts`

只依赖 roster 的结构类型，适配现有各种窄 host：

```ts
export type ConversationSessionReadiness = 'ready' | 'loading' | 'unavailable';
export interface IConversationSessionReadinessSource {
	isEngineConnected?(): boolean;
	isEngineSessionReady?(): boolean;
	getEngineSessionReadiness?(): ConversationSessionReadiness;
}
export function getConversationSessionReadiness(roster: IConversationSessionReadinessSource | undefined): ConversationSessionReadiness;
export function isConversationSessionNotReady(roster: IConversationSessionReadinessSource | undefined): boolean;
export function conversationSessionHoldReason(pairingHold: boolean, readiness: ConversationSessionReadiness): string | undefined;
export function conversationSessionShortStatus(readiness: ConversationSessionReadiness): string | undefined;
```

- `getConversationSessionReadiness`：roster 缺省 → `ready`；`isEngineConnected?.() !== true` → `ready`；有 `getEngineSessionReadiness` → 用它；否则 `isEngineSessionReady?.() === false` → `unavailable`；否则 `ready`。缺 `isEngineSessionReady` 视为就绪，保持 D460 / D462 语义（`conversationLensSessionBinding.ts:83-90` 注释）。
- `isConversationSessionNotReady` = 上式不是 `ready`，与原「KEEP leftover」判定等价。
- `conversationSessionHoldReason`：`pairingHold` → 现有 `Engine not connected`；`loading` → 新 `Loading session…`；`unavailable` → 现有整句 `Session unavailable — The engine is connected, but the active session is not ready.`；其余 `undefined`。
- `conversationSessionShortStatus`：`loading` → `Loading session…`；`unavailable` → 现有 `Session unavailable`。
- 新字符串放 `conversationLensDockStrings.ts`。

### 换判定来源（只换来源，不改哪些按钮何时可点）

13 处全部改用 `isConversationSessionNotReady(roster)`，写出原因处改用 `conversationSessionHoldReason`：

`conversationLensSessionBar.ts:413-417`、`conversationEngineSnapshotsList.ts:302-305`、`conversationLensComposerChrome.ts:663`（`isComposerStreaming`）与 `:893-896`、`conversationSessionsView.ts:293-296`、`conversationLensReadingColumn.ts:~188`、`conversationLensSessionBinding.ts:102-105` 与 `:159`、`conversationInboxOverlay.ts:308-311`、`conversationCreateSnapshotActions.contribution.ts:~41`（roster 可能为 undefined）、`conversationKillEngine.ts:~99`、`conversationForkEngine.ts:~38`、`conversationLensComposer.ts:~348`。

### 失败提示

- `ConversationComposerPostFailureReason` 加 `'session_not_ready'`，文案 `Session not ready — not sent. Draft kept.`（`conversationLensDockStrings.ts`，与现有 `postFailed*` 并列）。
- `rejectKeepLeftoverListFailWrite`（`conversationLensSessionBinding.ts:107-113`）改报 `session_not_ready`。把「pairing-hold 或 KEEP leftover」合在一个 if 里的调用点拆开：pairing-hold 仍报 `engine_disconnected`，未就绪报 `session_not_ready`。已知点：`conversationLensSessionBar.ts` 约 524、572、630 行，`conversationInboxOverlay.ts` 约 355、648 行；Sessions 视图的通知（`conversationSessionsView.ts:306-327`）未就绪时改用 `conversationSessionHoldReason` 的整句，不写 `engine disconnected`。

### 门闩

- `showGateStatus` 的 KEEP leftover 分支（`conversationLensComposerChrome.ts:746-749`）：`loading` → 门闩文字 `Loading session…`，`setGateWarning(false)`；`unavailable` → 现有整句，`setGateWarning(true)`。

### 输入行控件

- Agent 只读座（`conversationLensComposerChrome.ts` 约 978–999 行；窄宽 More 菜单里的当前 Agent 说明 `getSelectedAgentName` 约 308–317 行同一规则）：未连接或 pairing-hold → `conversationLensDockAgentUnavailable`（`Needs an engine connection`）；未就绪 → `conversationSessionShortStatus`；就绪但 `isSessionSwitchAgentAvailable` 为 false → 新 `Not supported by this engine`（定义在 `conversationLensComposerChrome.ts` 现有 Agent 字符串旁）。`textContent`、`aria-label`、`title` 一致。
- Permission 与 Model（字符串 `conversationLensComposerChrome.ts:93-104`，使用处约 925–945、1266–1287 行，窄宽 More 约 368–372 行）：只替换「已连接但缺 `setPermissionMode` / `switchModel` hook」与「未就绪」两种情况的文案，分别写 `Not supported by this engine` 与短语；未连接仍是 `Needs an engine connection`。控件的可见值、启用条件和显隐不变（PRD-015 验收 4）。

### 时间线空态

- `conversationTimelineHost.ts` 的 `.conversation-lens-timeline-empty`（约 146–148 行）加 setter `setEmptyStateKind(kind: 'empty' | 'loading' | 'unavailable')`。`empty` → `No messages yet`；`loading` → 不写文字（空白，避免闪出错误说法）；`unavailable` → 一行弱化字 `Messages not loaded`，不带图标。
- 透镜在已有刷新点按 `getConversationSessionReadiness(stubService)` 调它：`updateConversationPhase`（`conversationLensProjection.ts` 约 224 行起）与 `bindSessionView` 之后；不新造轮询或事件。只在没有可画回合时可见；KEEP leftover 保住的同一会话旧回合不受影响。

## S3 门闩样式回到错误态规范（PRD-028 验收 11）

- `.conversation-lens-dock-gate-row.is-warning`：去掉 `background-color`、整圈 `border`、额外 `padding`、`border-radius` 与 label 的 `font-weight: 600`；label 用 `var(--vscode-foreground)`、400；只有 `.conversation-lens-dock-gate-icon` 用 `var(--vscode-editorWarning-foreground)`。门闩默认规则的 `border-bottom` 6% 分隔线保留。高对比规则保留对比色文字，去掉已无意义的 `background-color: transparent` 覆盖可以保留不动。
- `conversationLensCssScan.test.ts:232-246` 现有断言要求 `.is-warning` 含 `inputValidation-warningBackground` 与 `warningBorder`，改为反向断言：`.is-warning` 不含 `background-color`、不含 `font-weight: 600`；图标规则含 `editorWarning-foreground`。

## S4 会话列表组内排序（PRD-002 验收 5）

- `groupSessionsForRoster`：每个桶内按 `sessionAccessedAtMs` 降序，稳定排序；无时间的会话放在 Earlier 末尾，彼此保持输入顺序。全无时间时保持现状（平铺、输入顺序）。
- 只有 `conversationSessionsView.ts`（约 515、547 行）调用它。Projects 树与 SessionBar 下拉、More 列表（`conversationLensSessionBar.ts` 约 200、267 行）仍按引擎顺序，不在本刀。

## S5 读屏名

- `conversationLens.sessionBarDownAgent` 默认文案改为 `Down to child agent`。拼接逻辑不变；`conversationNavigation.test.ts:681` 引用常量，不需要改。

## 不做

- 不改协议、不改引擎仓，不发明会话摘要字段。会话标题回退为首条用户消息不做：`SessionSummary` 没有这个字段。
- 不查、不修本次观察到的绑定失败本身（切换测试会话后 `engineSessionBindFailed`）。
- 不改新建 / 删除按钮的位置与间距，不加撤销。
- 不改 Preview 空态宽度、状态栏重复项、`isPreFirst`。
- 加载态细进度条、Navigator 与 Sources 的就绪判定归一：当时登记 D1304，已落地，见文末。

## 受影响的既有测试

- `deleteActiveSession` 的同步调用 15 处：`conversationLens.test.ts:3482/3545/3566`，`conversationSessionsView.test.ts:846/894/925/1006/1055/1071/1092/1103`，`conversationLensDisposeGate.test.ts:2986/3016/3042`，`conversationComposerEditDraft.test.ts:117/132`。改成 `await`。
- `TestDialogService.confirm` 默认 `{ confirmed: false }`（`testDialogService.ts:33-41`）：期望删除成功的用例先 `setConfirmResult({ confirmed: true })`。`as unknown as` 强转的假 host 补 `dialogService`。
- Agent 座文案：`conversationLens.test.ts` 约 1172–1183（窄宽 More）、1691、1728，`conversationLensDisposeGate.test.ts` 约 3511–3522，`conversationComposerCatalog.test.ts` 中断言 `Needs an engine connection` 且场景为「已连接」的用例，按新三分改期望。
- 断言 `engine_disconnected` / `Message not sent — engine disconnected` 且场景为 KEEP leftover 的用例改为 `session_not_ready`。
- `conversationLensCssScan.test.ts:232-246` 反转（S3）。

## 验证

- 编译：`flock -x /tmp/vscode-compile.lock npm run compile-client`；本次改动行 0 个新 TS 错误（基线另有既有错误，按改动行比对）。
- eslint：`npx eslint <改动文件>`。
- 单测（`scripts/test.sh --run <file>`）：
  - 新增 `conversationSessionAvailability.test.ts`：roster 缺省、未连接、三种 readiness、缺 `getEngineSessionReadiness` 时的退路、缺 `isEngineSessionReady` 视为就绪、两个原因函数。
  - 新增 `conversationDeleteSessionConfirm.test.ts` 或并入 SessionBar / Sessions 视图测试：取消不删、不提示、不写草稿；确认后删除；写闸关或断连有历史时不弹确认；确认期间 id 消失则不删。
  - roster：`getEngineSessionReadiness` 各分支，`isEngineSessionReady` 不变。
  - `conversationLensComposerChrome.test.ts`：门闩 loading 无 `is-warning`、unavailable 有；Agent 座、Permission、Model 三分文案。
  - `conversationTimelineHost.test.ts`：空态三种。PreFirst 与 Active 两条路径各一例（Active：roster 有缓存回合、换会话后未就绪，空态是 `Messages not loaded`；PreFirst：门闩在居中区、时间线隐藏）。
  - `conversationSessionsViewStrings.test.ts`：乱序输入的组内顺序、无时间排 Earlier 末尾、全无时间不分组、同时间保持输入顺序。
  - 回归：`conversationLens.test.ts`、`conversationComposerCatalog.test.ts`、`conversationSessionsView.test.ts`、`conversationLensDisposeGate.test.ts`、`conversationComposerEditDraft.test.ts`、Inbox 与 Snapshots 相关测试、`conversationLensCssScan.test.ts`、`conversationNavigation.test.ts`。
- 活窗：测试配置开默认窗口。删除：点删除看到确认框，取消后会话仍在。排序：Sessions 组内时间从新到旧。未就绪：本机 `session-10x` 测试会话切换后会进入绑定失败，可用来截门闩、Agent 座和时间线空态；若复现不了，单测覆盖为准并在 status 写明活窗未复现。
- `python3 scripts/check-docs-health.py`。

## 只读审查与改稿

## D1304 落地（2026-10-25）

- **进度条宿主。** 会话页自建，不用叶编辑器组的 `IEditorProgressService`。组指示在活动编辑器变化时 `stop().hide()`，会话加载要留到就绪度离开 `loading`。`ConversationEditorPane` 在 `.conversation-editor-page` 顶部放一条 2px `ProgressBar`（`infinite`），只在 `getConversationSessionReadiness(roster) === 'loading'` 时显示。文字仍是门闩那一行 `Loading session…`，进度条不另写一句。`unavailable` 不画条。
- **写闸。** Navigator 三处 `isKeepLeftoverListFailWrite` 改为 `getConversationSessionReadiness(roster) !== 'ready'`。Sources 的 Changes、Review、Diff 与 `sourcesChangesReadModel` 把 `IAgentSessionContext` 经 `conversationSessionReadinessProbe` 送进同一个函数。`IAgentSessionContext.getEngineSessionReadiness?()` 可选，由 `AgentSessionContext` 转发 roster。原因句不改。

2026-10-24 初稿经只读 reviewer 审查：Critical 两条（PreFirst 下时间线空态不显示；不可用时门闩与空态双重报错），Important 七条（加载态进度条；13 处清单不全；判定签名套不上窄 host；PRD-007 验收 6 比方案宽、失败提示仍写 engine disconnected；推翻 composer-agent-picker 未声明；删除定序与竞态；既有测试回归点未列）。已全部改入上文：原因只由门闩写一次，时间线写中性短语，PreFirst 保持；判定改为只依赖 roster 的结构类型；控件三分并纳入 Permission / Model 与失败提示；删除改为先取 id、确认、再过闸；进度条与 Navigator / Sources 归一当时登记 D1304（已落地，见上节）；回归点逐条列出。Minor：门闩分隔线是 `border-bottom`、316 行是 More 菜单的当前 Agent 说明、确认函数与新字符串落点、S4 调用方、Agent 短语与门闩整句的区分、traceability PRD-028 行、活窗步骤——已在上文改正。
