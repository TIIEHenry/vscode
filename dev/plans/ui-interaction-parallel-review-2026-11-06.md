---
title: "2026-11-06 默认窗口并行 UI 与交互审查收口"
type: plan
status: accepted
phase: N/A
updated: 2026-11-06
summary: "五路并行审查默认编辑器窗口的 Conversation、Composer/Inbox/SessionBar、Sessions/Navigator、Engine/Connection/Settings 与 Sources/Trajectory/壳层；分三个实施切片修复交互阻塞、焦点与状态一致性、设置尺寸与减少动效合同。"
---

# 2026-11-06 默认窗口并行 UI 与交互审查收口

状态：执行中。负责：agent:gemini。
覆盖需求：PRD-028。

## 1. 背景与范围

本方案汇总 2026-11-06 对默认编辑器窗口五条 UI 轨道的并行审查结论，并按用户确认的四个推进项（写入方案并经规则 16 只读审查、修复 P0/P1 交互与焦点阻塞缺陷、收敛视觉与状态一致性、对齐设置尺寸与 Reduced-Motion 动效合同）组织实施切片。

依据规范：
- [UI 设计原则与规范](../../docs/architecture/cross-cutting/ui-design-principles.md)
- [GPT 视觉复刻与产品密度边界](../../docs/decisions/ui-gpt-visual-replication-2026-11-04.md)
- [审查待定项决定 D18](../../docs/decisions/ui-review-decisions-2026-11-01.md)

不改 PRD 状态，不新增后端协议或虚假能力入口，不触碰 VS Code 文件管理器与代码编辑器的原生字号、行高与焦点表现。

---

## 2. 切片 S1：P0/P1 交互阻塞与键盘焦点闭环

### 2.1 Trajectory 表格键盘激活与 Overview 分段条导航
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/conversationTrajectory.ts:501-511` 在 `this.tableScroll` 上监听 `keydown`（`Enter`/`Space`），调用 `this.resolveTrajectoryRecordRow(e.target as HTMLElement)`。由于 `WorkbenchList` 将 DOM 焦点保持在 `.monaco-list` 容器上，`e.target` 不是内部 `.conversation-lens-trajectory-record-row`，导致键盘按 `Enter`/`Space` 恒无法选中记录。
  2. `conversationTrajectory.ts:700-716` 的 Overview 分段条为最多 200 个 `<button class="conversation-lens-trajectory-overview-segment">` 默认设置 `tabIndex = 0`，且设置了 `role="listitem"` 覆盖原生 `button` 角色，缺少 roving `tabIndex` 与左右方向键导航。
- **修改方案**：
  1. 在 `conversationTrajectory.ts` 的 `keydown` 处理中，当 `resolveTrajectoryRecordRow(e.target)` 为空且焦点在 `this.list` 内时，回退读取 `this.list.getFocusedElements()[0]`，若为 `record` 则激活该记录，若为 `fold` 则切换折叠状态。
  2. 移除 Overview 分段 `<button>` 上的 `role="listitem"`（外层 `overviewTrack` 使用 `role="toolbar"`），实施 roving `tabIndex`（选中段或首段为 `0`，其余为 `-1`），支持 `ArrowLeft` / `ArrowRight` / `Home` / `End` 在分段间移动焦点。

### 2.2 Navigator `Projects` 组头点击误建会话、虚拟树重排与筛选框进树
- **现状证据**：
  1. `src/vs/workbench/contrib/navigator/browser/navigatorProjectsList.ts:671-674` 在 `openTreeNode` 中对 `node.kind === 'workdir'` 直接调用 `this.createSessionInCurrentWorkDir()`。因为 `WorkbenchObjectTree` 单击可折叠父节点切换展开状态时也会触发 `onDidOpen`，用户单击项目组头折叠/展开时会意外新建会话并把焦点切走。
  2. `navigatorProjectsList.ts:536-540` 构造 `NavigatorProjectsInlineFilterBox` 时未传入第 4 个参数 `focusList`，按 `DownArrow` 或 `Escape` 无法把焦点移入树中。
  3. `navigatorProjectsList.ts:564-580, 891-901, 977-990` 仅在 `layoutBody` 中调用 `this.tree.layout(...)`，当 `rebuildTree()` 异步改变 `filterBox` / `recentsStatus` / `filterEmpty` 显隐后未重算虚拟树高度。
- **修改方案**：
  1. 在 `openTreeNode` 中，当 `node.kind === 'workdir'` 且 `browserEvent` 为鼠标/指针点击行（`dom.isMouseEvent(browserEvent)`）时，不触发 `createSessionInCurrentWorkDir()`（仅保留显式行尾 `+` 按钮、右键菜单与键盘 `Enter` 在组头新建或按树展开语义处理；具体将 `openTreeNode` 的 `workdir` 分支限制为非鼠标点击或仅由显式动作触发，避免单击折叠误触）。*注：为兼容键盘测试，检查 `navigatorProjectsTree.test.ts` / `navigatorProjectsList.test.ts` 对 `openTreeNode` 的既有断言，仅在 `dom.isMouseEvent(browserEvent)` 时跳过 `workdir` 自动新建，让鼠标单击只做展开/折叠，行尾 `+` 按钮负责鼠标新建。*
  2. 向 `NavigatorProjectsInlineFilterBox` 传入 `target => this.focusTreeFromFilter(target)`。
  3. 记录 `lastBodyHeight` / `lastBodyWidth`，在 `updateFilterBoxVisibility`、`applyRecentsStatus`、`applyFilterToTree` 显隐变化后调用 `relayoutTree()`。

### 2.3 提问座位（`ConversationQuestionSeat`）初始预选与选项视觉线索
- **现状证据**：
  - `src/vs/workbench/contrib/conversation/browser/conversationQuestionSeat.ts:283-319` 与 `conversationConfirmationSeat.ts:55-66`：构造时 `wireConversationSeatOptionKeys` 立即执行 `apply(initialIndex)`。当 `initialDraft` 无该题选择时，`findIndex` 返回 `-1`，`Math.max(0, -1)` 传入 `0`，在 `implicitMulti === false` 时直接将第 0 项写入 `selections` 并设 `aria-checked="true"`；而在 `implicitMulti === true` 时，`selected` 已置为 `0`，导致键盘首次聚焦第 0 项时 `if (selected !== i)` 为假，无法通过聚焦选中第 0 项。
- **修改方案**：
  - 在 `wireConversationSeatOptionKeys`（或 `conversationQuestionSeat.ts` 传入的选项）中支持 `initialIndex: -1`（未选中态）：roving `tabIndex` 仍停在第 0 项（`tabIndex = 0`），但仅当 `initialIndex >= 0` 时才在初始化时调用 `apply(initialIndex)` 并设 `aria-checked="true"`。

### 2.4 过程折收起态 `inert` 防 Tab 泄漏与合并 `file_edit` 卡状态保留
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts:50-56`：`setProcessFoldCollapsed` 只切换 `.conversation-process-fold--collapsed`（`grid-template-rows: 0fr`），未设 `panel.inert = collapsed`，导致收起状态下内部的思考/工具/文件路径按钮仍留在顺序 `Tab` 链中。
  2. `conversationProcessFold.ts:172-184, 311-319` 与 `conversationProcessFoldModel.ts:247-298`：当折叠内仅有 `thinking` 节点处于流式（`turn.streaming === true`）且 `showLiveChrome === true` 时，外层折叠头未显示 `Codicon.loading` 与 `· Loading` 后缀。
  3. `conversationProcessFold.ts:799-885`：`renderFileEditCard()` 在工具处于 `pending` / `running` / `failed` / `cancelled` 时未在文件行渲染状态图标或响应按钮。
- **修改方案**：
  1. 在 `setProcessFoldCollapsed(panel, collapsed)` 中设置 `panel.inert = collapsed`，并在 `conversationLens.css` 的 `.conversation-process-fold-motion.conversation-process-fold--collapsed > *` 增加 `visibility: hidden;`。
  2. 在 `resolveProcessFoldHeaderIcon`、`syncFoldExecuting` 与 `summarizeProcessStepParts` 中计入流式 `thinking` 节点（`processFoldSpanHasExecutingTurn`）。
  3. 在 `renderFileEditCard()` 中，当单条 `turn` 处于非 `completed` 状态（`pending` / `running` / `failed` / `cancelled`）或需要权限响应时，在对应 `.conversation-file-edit-line` 渲染状态图标与 `appendProcessFoldToolRespond()`。

### 2.5 Inbox 队列弹层、SessionBar 改名、置顶提示与回合编辑焦点闭环
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/conversationInboxOverlay.ts:524-585`：队列弹层无 `Escape` 关闭并回焦 `queueChip`、打开时不聚焦弹层内首个可聚焦项、`refreshOpenListPanel()` 重建列表时丢焦点。
  2. `src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts:178-190, 726-766`：打开 History 时不关闭已打开的 Snapshots（反之亦然）；标题改名按 `Enter` / `Escape` 结束时未把焦点还给 `host.sessionTitleButton`。
  3. `src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts:349-356, 395, 471-473`：窄叶 `…` 菜单在会话不可用时未禁用 `Tool options` 并写明原因；进行中会话误显示 `Agent` 只读行；菜单项键盘激活关闭时未恢复焦点。
  4. `src/vs/workbench/contrib/conversation/browser/conversationTimelineHost.ts:178-181, 201-205, 1266` 与 `conversationComposerAt.ts:293`：点击置顶用户提示跳转后未调用 `focusRecord` 导致置顶隐藏后失焦，且 `aria-label` 未包含 `previewText`；在输入框按 `Escape` 关闭 `@` 建议或历史浏览时未 `stopPropagation()` 导致外层 `stream` 抢焦。
- **修改方案**：
  1. 为 `ConversationInboxOverlay` 补齐 `Escape` 关闭并回焦 `queueChip`、重绘时保持焦点标识。
  2. 在 `conversationLensSessionBar.ts` 的 `engineHistoryList.setOnWillShow` 与 `engineSnapshotsList.setOnWillShow` 中互斥关闭对方及 `sessionMoreContextView` / `inboxOverlay`；在 `closeSessionTitleEditor` / `cancelSessionTitleEdit` 中若输入框持焦则回焦 `sessionTitleButton`。
  3. 在 `conversationLensComposerChrome.ts` 的 `toggleMoreContextView` 中仅在 `host.isPreFirst()` 时显示 `Agent` 行，并在 `isComposerKeepLeftoverListFailed(host)` 时禁用 `Tool options` 菜单项且附上 `holdReason`；在 `onHide` 中恢复焦点到 `moreButton.element`。
  4. 在 `conversationTimelineHost.ts` 的 `updatePinnedUserPrompt` 中将 `previewText` 拼入 `aria-label`，点击后若原焦点在置顶按钮内则调用 `focusRecord`；在 `conversationComposerAt.ts` 与 `conversationLensDock.ts` 处理 `Escape` 时调用 `e.stopPropagation()`。

---

## 3. 切片 S2：视觉、状态一致性与焦点框清理

### 3.1 Sources 选中态与错误文案颜色
- **现状证据**：
  1. `src/vs/workbench/contrib/sources/browser/media/sourcesTabs.css:263-276`：`.sources-tab:hover` 与 `.sources-tab.selected` 均使用 `var(--vscode-toolbar-hoverBackground)`，未选 tab 悬停时与选中 tab 完全同色。
  2. `sourcesChangesList.css:98-100, 529-531`、`sourcesReviewList.css:338-340, 353-366`、`sourcesDiffPanel.css:110-113`、`conversationDiffReviewPane.css:108-110` 将整段错误文字设为 `var(--vscode-errorForeground)`；`.sources-review-attribution-chip`（`sourcesReviewList.css:231-263`）使用实心 `--vscode-badge-background`。
- **修改方案**：
  1. 按 `ui-design-principles.md:281`（§5.7「选中是中性淡底、不加粗」）及 `conversationLensCssScan.test.ts:1112-1113` 合同，保持 `.sources-tab.selected` 为 `background-color: var(--vscode-toolbar-hoverBackground); font-weight: 400;`，将未选悬停 `.sources-tab:not(.selected):hover` 调浅为 `color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 60%, transparent)`（`.sources-tab.selected:hover` 升为 `var(--vscode-toolbar-activeBackground, color-mix(in srgb, var(--vscode-foreground) 10%, transparent))`），从而在不破坏扫描合同的前提下区分悬停态与选中态。
  2. 保留 `sourcesWiringScan.test.ts:487-488, 640, 655, 684-689` 锁定的 `.sources-review-status.is-error`、`.sources-changes-status.is-error`、`.sources-files-status.is-error`、`.sources-diff-panel-action-notice.is-error`、`.conversation-diff-review-notice.is-error` 选择器名称，将这几个容器的正文颜色改为 `var(--vscode-foreground)`，语义红色 `var(--vscode-errorForeground)` 只保留在状态图标（`::before`）上；将 `.sources-review-attribution-chip` 改为淡底/幽灵芯片并补 `:hover` 与 `.sources-review-state:hover:not(:disabled)`。

### 3.2 状态栏引擎警告底色与重复错误/空态横条
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/conversationSessionStatusBar.ts:156` 将未连接/配对等待的引擎状态栏项 `kind` 设为 `'warning'`，触发整块 `statusBarItem.warningBackground`（违反 D18 V2「状态栏不再用 warning 底」）。
  2. `src/vs/workbench/contrib/navigator/browser/navigatorAgentsView.ts:894` 与 `navigatorTeamList.ts:744, 854` 在收到空数组（`0` 条记录）时也把 `hadActivitySnapshot` / `hadTeamSnapshot` 设为 `true`，导致随后断线或报错时顶部 `.navigator-stub-note` 与居中 `.navigator-stub-empty` 同时显示（违反 §6.5 & 反模式 10）。
  3. `src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts:1205-1221`、`enginePluginsSection.ts:950-966` 在单次写操作失败时同时写入 `this.catalogWriteStatus` 和 `this.status.render({ mode: 'failed' })`，导致同一错误在同一分区内出现两次。
- **修改方案**：
  1. 在 `conversationSessionStatusBar.ts:156` 中对 `'warning'` 态不传 `kind: 'warning'`（`getConversationEngineChipTone` 仍保持 `'warning'` 供身份条和单测 `conversationSessionStatus.test.ts:51` 使用，只在 `createEngineEntry` 构造状态栏项时将 `'warning'` 映射为 `undefined` 标准底色，按 D18 V2 去掉状态栏整块 warning 底）。
  2. 在 `navigatorAgentsView.ts` 与 `navigatorTeamList.ts` 中，仅当实际缓存列表非空（`this.activityEntries.length > 0`、`this.memberEntries.length > 0`、`this.taskEntries.length > 0`）时才在断线/错误/空过滤时保留顶部 `.navigator-stub-note`；列表为空时只显示单处状态说明。
  3. 在 `engineMcpSection.ts` 与 `enginePluginsSection.ts` 的 `showWriteFailed` 中，当目录列表已加载时只更新 `this.catalogWriteStatus`，不再同时把 `this.status` 翻成重复的错误横幅。

### 3.3 实心主按钮收敛与实心蓝徽标清理
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts:385`：`HubDevicesRenderer` 为设备列表每一行渲染实心主按钮 `new Button(row, defaultButtonStyles)`，与下方的 `Confirm` 主按钮同屏并存（违反原则一「一个视图至多一个实心主按钮」）。
  2. `src/vs/workbench/contrib/conversation/browser/media/conversationLens.css:4916-4926`：`.conversation-lens-turn-honest-status` 使用实心 `--vscode-badge-background`。
  3. `src/vs/workbench/contrib/conversation/browser/engineConfirmPopover.ts:44`：`cleanupAnchor()` 在点击外部关闭（`onDOMEvent`）时仍无条件调用 `options.anchor.focus()`，抢走外部被点控件的焦点。
- **修改方案**：
  1. 将 `HubDevicesRenderer` 的行内 `"Connect"` 按钮改为 `{ ...defaultButtonStyles, secondary: true }`。
  2. 将 `.conversation-lens-turn-honest-status` 改为弱化文字加 12% `color-mix` 淡底。
  3. 在 `engineConfirmPopover.ts` 中为 `cleanupAnchor(restoreFocus: boolean)` 增加布尔参数，点击外部关闭时传 `false`。

### 3.4 产品自有表面普通主题 `focusBorder` 外圈收敛
- **现状证据**：
  - 普通主题下仍有多处未被扫描锁定的产品自有样式绘制 `focusBorder` 外圈或蓝色聚焦框：
    - 4 个内联筛选框：`conversationSessionsInlineFilter.css:82`、`navigatorProjectsInlineFilter.css:80`、`navigatorAgentsInlineFilter.css:68`、`navigatorTeamInlineFilter.css:68`。
    - `conversationSessions.css:55-76`（缺少非高对比 `.focused` 行 `outline: none !important` 及 `.focused:not(.selected)` 的淡底反馈）与 `navigatorTeamList.css:64-66`（`[aria-pressed="true"]:focus-visible` 与常态无视觉差异）。
    - `agentInspect.css:46-49, 128-131` 与 `navigatorStub.css:154-158`（未作用域化的 `.monaco-list-row.selected` 使用了浅色下反白的 `--vscode-list-activeSelectionForeground`，且静态键值行仍有 `:hover` 变色）。
    - `sourcesPart.css:38-41`（普通主题 `.part.sources .monaco-list:focus-visible .monaco-list-row.focused` 强制画 `1px solid var(--vscode-list-focusOutline, var(--vscode-focusBorder)) !important`）。
    - `enginePreferencesPane.css:789,1615`、`connectionPreferencesPane.css:139,420,695,774` 与 `uaClientSettingsChrome.css:114`。
- **修改方案**：
  - 普通主题（`:not(.hc-black):not(.hc-light)`）下移除上述未锁定控件的 `focusBorder` 外圈，改用 `var(--vscode-toolbar-hoverBackground)`、中性 `color-mix` 描边加深（输入框聚焦 `16%–20%` 前景混色）或行背景表达 `:focus-visible`；高对比主题（`:is(.hc-black, .hc-light)`）保留 `contrastActiveBorder` / `contrastBorder`。
  - **保留扫描锁定项**：`conversationLensCssScan.test.ts` 第 `158`（`.conversation-timeline-item:focus-visible`）、`447`（`.conversation-lens-turn-body--user-bubble:focus-visible`）、`1018`（`.conversation-lens-trajectory-overview-segment:focus-visible`）、`1123`（`.engine-preferences-nav .monaco-list:focus-visible .monaco-list-row.focused`）、`1200`（`.conversation-lens-turn-actions .monaco-button:focus-visible`）为既有扫描显式锁定的 5 条规则，保持原样不破坏 `conversationLensCssScan.test.ts` 门禁。
  - 修复 `agentInspect.css` 与 `navigatorStub.css` 的选中行前景色为 `var(--vscode-foreground)`，并为静态行（`.agent-inspect-list .monaco-list-row`、`.navigator-projects-list .monaco-list-row:has(.is-note)`、只读 `.conversation-lens-turn-body--user-bubble:not(.conversation-lens-turn-body--clickable)`）禁用 `:hover` 变色。

---

## 4. 切片 S3：设置尺寸对齐、浮层规格与 Reduced-Motion 动效合同

### 4.1 Connection 设备行高度与浮层尺寸、菜单类名对齐
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts:355` 的 `HubDevicesDelegate.getHeight()` 返回 `32`，按钮高 `28px`，但 `src/vs/workbench/contrib/conversation/browser/media/connectionDeviceList.css:8` 写死 `.connection-hub-device-row { height: 24px; line-height: 24px; }`，导致 28px 按钮溢出 24px 容器。*（注：`enginePreferencesPane.ts:61` 的 `NAV_ROW_HEIGHT = 22` 是 2026-11-05 按 D18 V8 专门签收的实施检查点并有 `conversationLensCssScan.test.ts:479` 与 `enginePreferencesPane.test.ts:427` 锁定，本方案保持 D18 V8 的 22px 决定不翻案，只修设备行内部容器与按钮溢出。）*
  2. `src/vs/workbench/contrib/conversation/browser/media/conversationLens.css:497, 513, 594, 610, 3640-3656` 与 `conversationInboxOverlay.ts:541`：History、Snapshots、Inbox 浮层宽度为 `420px` / `480px`、高度 `360px` / 无上限，超出规范 §5.5 的 `宽 200–360px、最高 320px`。
  3. `src/vs/workbench/browser/media/uaRoundedMenus.css:7-77, 159` 未包含 `.conversation-composer-picker-menu`，且第 159 行对 `.conversation-lens-dock-more-item[role="menuitemradio"]` 强制 `padding-left: 28px`，导致 SessionBar `More` 会话切换行左内衬多缩进 20px。
  4. `src/vs/workbench/contrib/conversation/browser/media/conversationLens.css:913-925`：置顶用户提问卡片 `.conversation-timeline-pinned-user-inner` 与画布同色且无边框，违反原则九；`conversationTimelineRenderer.ts:364, 528, 1061` 展开用户气泡、Visualize 卡或错误详情时未调用 `onProcessFoldLayout`，导致在底部自动跟随时画面被强制拉回最底。
- **修改方案**：
  1. 将 `connectionDeviceList.css` 中 `.connection-hub-device-row` 设为 `min-height: 24px; height: 100%; display: flex; align-items: center;`（既满足 `conversationLensCssScan.test.ts:1146` 的 `height: 24px` 扫描，又让 32px 虚拟行与 28px 按钮垂直居中不溢出）。
  2. 将 History、Snapshots 与 Inbox 队列面板的宽高收敛到 `max-width: min(360px, calc(100vw - 24px)); max-height: 320px;`，并在 `conversationInboxOverlay.ts:541` 将内联宽度上限钳制在 `360px`（`Math.min(360, Math.max(200, columnWidth))`）。
  3. 在 `uaRoundedMenus.css` 中将 `.conversation-composer-picker-menu` 纳入圆角菜单选择器，并将第 159 行限定为 `:not(.conversation-lens-session-more-session)`。
  4. 为 `.conversation-timeline-pinned-user-inner` 补齐 `8%` 前景低对比描边（高对比 `contrastBorder`）与 `cornerRadius.large`；在 `conversationTimelineRenderer.ts` 中展开/收起用户长文、Visualize 卡与错误详情时调用 `this.onProcessFoldLayout?.(turn.id)`。

### 4.2 Reduced-Motion 与 `<= 100ms` 动效合同收口
- **现状证据**：
  1. `src/vs/workbench/browser/parts/conversation/media/ua-common.css:136-141` 仅在 `@media (prefers-reduced-motion: reduce)` 下关闭 `.ua-motion` 过渡/动画，缺少 `.monaco-workbench.monaco-reduce-motion .ua-motion` 规则。
  2. `src/vs/workbench/contrib/conversation/browser/media/conversationLens.css:1806, 5419` 将子元素选择器误写为同级 `.conversation-process-fold-tool-icon.codicon-loading`（缺少后代空格），且 `.monaco-reduce-motion` 块（`:5302`）漏掉了 `.conversation-process-fold-chevron.ua-motion` 与 loading 旋转动画关闭。
  3. `src/vs/workbench/contrib/conversation/browser/media/conversationSessions.css:57` 的 `.monaco-list-row` 100ms 过渡缺少 `.monaco-reduce-motion` 与 `@media (prefers-reduced-motion: reduce)` 关闭规则；`navigatorProjectsList.css:350` 漏掉 `.navigator-projects-session-status.is-running::before`。
  4. `src/vs/workbench/browser/parts/editor/media/editorgroupview.css:600` 的 `.preview-category-empty-action-button` 过渡为 `0.12s`（120ms > 100ms；第 603–611 行已有 reduced-motion 规则），且 `editorgroupview.css:670-695` 残留与 `previewCategoryBar.css` 冲突的重复 `.preview-category-bar` / `.preview-category-switcher` 块。
- **修改方案**：
  1. 在 `ua-common.css` 补 `.monaco-workbench.monaco-reduce-motion .ua-motion { transition: none; animation: none; }`。
  2. 在 `conversationLens.css` 修正 `.conversation-process-fold-tool-icon .codicon-loading` 选择器（同时保留原选择器兼容扫描），并将 `.conversation-process-fold-chevron.ua-motion` 及 loading 动画纳入 `.monaco-reduce-motion` 与 `prefers-reduced-motion`。
  3. 在 `conversationSessions.css` 补 `.monaco-list-row` 的 reduced-motion `transition: none`，在 `navigatorProjectsList.css` 补 `.is-running::before` 的 `animation: none`。
  4. 在 `editorgroupview.css` 将第 600 行 `.preview-category-empty-action-button` 的 `0.12s` 改为 `100ms`，并移除第 670–695 行与 `previewCategoryBar.css` 冲突的重复类别条规则。

---

## 4A. 切片 S4：ChatGPT 图标风格扩展与四路视觉样式补齐（2026-11-06）

### 4A.1 扩展 `uaRoundedIcons.css` 作用域 SVG Mask（ChatGPT 1.5px–2px 圆头线性图标语言）
- **现状证据**：
  1. `src/vs/workbench/browser/media/uaRoundedIcons.css` 目前仅被 `conversationLens.ts`、`conversationSessionsView.ts`、`navigatorProjectsList.ts` 3 个入口导入，且只覆盖了 7 个局部选择器（Composer `+`/`…`/send/warning/tune/select-chevron、Projects `+`/`…`/folder、Sessions `…`）。
  2. Composer 发送按钮（`uaRoundedIcons.css:46-55`）使用 `stroke-width="1.5"` 与宽翼展箭头，在 28px 实心圆钮内显细弱；Tool options（`uaRoundedIcons.css:68-77`）路径画的是竖向叉子/扳手轮廓而非 ChatGPT 风格的水平滑块（sliders）；输入框右上角展开/收起（`conversationLensComposerChrome.ts:850`）仍显示 VS Code 文件树的 `codicon-expand-all` / `codicon-collapse-all` 双层方框。
  3. 对话阅读面（助手动作行 `codicon-copy` / `codicon-refresh` / `codicon-trash` / `codicon-list-tree`、代码块复制 `codicon-copy`、过程折与身份条及回到底部的 `codicon-chevron-right` / `codicon-chevron-down`、合并文件编辑卡 `codicon-file`、停止/取消 `codicon-debug-stop`、搜索/清除 `codicon-search` / `codicon-close`、SessionBar 与视图标题栏的 `codicon-add` / `codicon-ellipsis` / `codicon-trash` / `codicon-history` / `codicon-layers` / `codicon-remove`、活动栏顶层产品视图图标 `codicon-comment-discussion` / `codicon-project` / `codicon-agent` / `codicon-organization` / `codicon-files` / `codicon-account` / `codicon-settings-gear`）仍为 1px 尖角 Codicon。
  4. `navigatorAgentsView.ts`、`navigatorTeamList.ts`、`sourcesTabsHost.ts`、`enginePreferencesPane.ts`、`connectionPreferencesPane.ts`、`activitybarPart.ts` 未导入 `uaRoundedIcons.css`（`sourcesChangesList.ts`、`sourcesReviewList.ts`、`sourcesFilesList.ts` 也未导入 `uaRoundedMenus.css`）。
- **修改方案**：
  1. 保持所有 TS 文件中的 `Codicon.xxx` 与 DOM `.codicon.codicon-xxx` 类名、`font-size` token、`aria-*` 和 `title` 不变（100% 兼容 40+ 浏览器单测与 CSS 扫描）；不新增未在 `vscode-known-variables.json` 注册的自定义 CSS 变量。
  2. 在 `uaRoundedIcons.css` 的 `@media (forced-colors: none)` + `.monaco-workbench:not(.hc-black):not(.hc-light)` 作用域下（高对比和系统强制颜色模式自动回退原生 Codicon）：
     - 将 Composer 发送钮 `.conversation-lens-dock-send-button.codicon-arrow-up::before` 升级为紧凑加粗 `stroke-width="2"` 圆头上箭头；
     - 将 Composer Tool options `.conversation-lens-dock-tune .codicon-tools::before` 升级为双轨水平圆钮滑块（sliders）轮廓；
     - 为输入框右上角展开/收起（`.conversation-lens-dock-maximize-input-button.codicon-expand-all::before` / `.codicon-collapse-all::before`）提供对角双向圆头箭头 mask；
     - 为产品自有表面（`.part.conversation`、`.conversation-sessions-list`、`.conversation-sessions-inline-filter`、`.navigator-projects-list`、`.navigator-projects-inline-filter`、`.navigator-agents-inline-filter`、`.navigator-team-inline-filter`、`.navigator-agents-hierarchy-tree`、`.navigator-agents-activity-list`、`.navigator-team-list`、`.navigator-team-tasks-list`、`.part.sidebar > .composite.title .title-actions`、`.part.sidebar .pane-header .monaco-action-bar`、`.conversation-lens-dock-add-popup`、`.conversation-lens-dock-more-popup`、`.conversation-lens-dock-tune-popup`、`.part.sources`、`.engine-preferences-pane`、`.connection-preferences-pane`、`.preview-category-switcher`）覆盖高频通用动作与状态图标的 1.5px 圆头 SVG mask（通用 `::before` 使用 `width: 1em; height: 1em;` 以自适应 12px/16px/20px 字号）：`codicon-add`、`codicon-ellipsis`、`codicon-close`、`codicon-remove`、`codicon-search`、`codicon-copy`、`codicon-refresh`、`codicon-trash`、`codicon-edit`、`codicon-check`、`codicon-chevron-down`、`codicon-chevron-right`、`codicon-chevron-up`、`codicon-chevron-left`、`codicon-folder`、`codicon-root-folder`、`codicon-file`、`codicon-history`、`codicon-layers`、`codicon-list-tree`、`codicon-list-flat`、`codicon-list-ordered`、`codicon-target`、`codicon-bell`、`codicon-warning`、`codicon-error`、`codicon-info`、`codicon-circle-slash`、`codicon-debug-stop`；
     - 为 `.activitybar` 顶层容器图标（`codicon-comment-discussion`、`codicon-project`、`codicon-agent`、`codicon-organization`、`codicon-files`、`codicon-account`、`codicon-settings-gear`）提供匹配的 20px（`width: 1em; height: 1em;`）圆头线性 SVG mask。
  3. 在 `navigatorAgentsView.ts`、`navigatorTeamList.ts`、`sourcesTabsHost.ts`、`enginePreferencesPane.ts`、`connectionPreferencesPane.ts`、`activitybarPart.ts`、`previewCategorySwitcher.ts` 中补齐 `uaRoundedIcons.css` 导入；在 `sourcesTabsHost.ts` 中补齐 `uaRoundedMenus.css` 导入，并为 `sourcesChangesList.ts:1075`、`sourcesReviewList.ts:791`、`sourcesFilesList.ts:437` 的 `showContextMenu` 加上 `getMenuClassName: () => 'ua-rounded-menu'`。

### 4A.2 图标坏码点与菜单图标位 Bug 修复
- **现状证据**：
  1. `src/vs/workbench/contrib/conversation/browser/media/connectionPreferencesPane.css:483`：`.connection-status.is-success::before` 使用了未分配码点 `content: '\ea5e'`（`codiconsLibrary.ts` 从 `0xea60` 开始），渲染为空白缺字框。
  2. `src/vs/workbench/contrib/navigator/browser/navigatorProjectsList.ts:328`：工作目录节点（`element.kind === 'workdir'`）的菜单只有 1 个动作 `New session in ...`，却传入了 `'ua-rounded-menu ua-project-session-menu'`，导致 `uaRoundedMenus.css:97-114` 的 `:first-child` 规则给「新建会话」画上了「外部链接箭头」图标；同时 `.ua-session-menu`（`uaRoundedMenus.css:79-96`）漏掉了第 2 项 `Delete` 的垃圾桶图标。
- **修改方案**：
  1. 将 `connectionPreferencesPane.css:483` 的 `content: '\ea5e'` 修正为 `content: '\eab2'`（`codicon-check`），并在 `@media (forced-colors: none)` 下提供 1.5px 圆头对勾 mask。
  2. 在 `navigatorProjectsList.ts:328` 中，当 `sessionId` 存在时传 `'ua-rounded-menu ua-project-session-menu'`，当为 `workdir` 节点时传 `'ua-rounded-menu ua-project-workdir-menu'`；在 `uaRoundedMenus.css` 中为 `.ua-project-workdir-menu` 的 `:first-child` 配置 `+`（`\ea60` + 1.5px 圆头加号 mask），并为 `.ua-session-menu` 的 `:nth-child(2)` 补齐垃圾桶图标（`\ea81` + 1.5px 圆头垃圾桶 mask）。

### 4A.3 遗留 `focusBorder` 外圈、表面层次与边框缺失收口
- **现状证据**：
  1. **产品自有表面普通主题遗留 `focusBorder` 外圈（未锁定项）**：
     - `conversationLens.css`：`:298`（`.conversation-lens-session-title-input:focus-visible`）、`:1184`（`.conversation-lens-trajectory-search:focus` 的 `box-shadow: 0 0 0 1px`）、`:1458`（`.conversation-lens-trajectory-inspector-close:focus-visible`）、`:1853`（`.conversation-process-fold-header:focus-visible` 等）、`:2061`（`button.conversation-process-fold-tool-header:focus-visible`）、`:2451`（`.conversation-lens-turn-header-trajectory .monaco-button:focus-visible`）、`:2507`（`.conversation-process-fold-trajectory-jump:focus-visible`）、`:2567`（`.conversation-process-fold-tool-cancel:focus-visible`）、`:2604`（`.conversation-process-fold-tool-respond:focus-visible`）、`:2871`（`.conversation-code-block-copy:focus-visible`）、`:3092`（`.conversation-lens-confirmation-seat:focus-visible, .conversation-lens-question-seat:focus-visible`）、`:3471`（`.conversation-lens-inbox-chip:focus-visible` 等）、`:3741`（`.queue-bar-action:focus-visible`）、`:3784`（`.queue-item:focus-visible`）、`:4585`（`.conversation-lens-dock-tune-filter:focus`）、`:4693`（`.conversation-lens-dock-add-filter:focus`）、`:5077`（`.conversation-lens-turn-error-details-toggle:focus-visible`）、`:5595`（`.conversation-file-edit-path:focus-visible`）。
     - `conversationSessionWindow.css:76, 118-129`：分栏活动叶顶部 `box-shadow` 使用 `var(--vscode-focusBorder)`，`.conversation-session-leaf-hide:focus-visible` 在普通主题画 `focusBorder` outline 且在 HC 下未用 `contrastActiveBorder`。
     - `conversationPart.css:57-80`：区域隐藏按钮 `.part.conversation > .conversation-region-chrome .title-actions .action-label` 缺少普通主题 `:focus-visible` 静默表面与 HC `contrastActiveBorder` 规则。
     - `preferencesEditor.css:143`：顶部 `Connection | Engine` 切换页签 `.action-label:focus-visible` 在普通主题仍画 `focusBorder` outline。
  2. **表面层次与容器边界缺失**：
     - `extensions/theme-defaults/themes/universe-agent-studio-light.json:13-15` 将 `sideBar.background`、`sideBarTitle.background`、`sideBarSectionHeader.background` 设为了 `#FAFAFA`（第三种浅色表面），与 `theming.md:50`、`ui-design-principles.md:50,340` 及 `workbenchThemeService.test.ts:247` 规定的 `#F6F6F6` 冲突，且 `activityBar.activeBackground` 为 `#E9E9E9`（规范与 initial colors 为 `#E6E6E6`）。
     - `extensions/theme-defaults/themes/universe-agent-studio-dark.json` 缺少与浅色主题对称的 `"button.secondaryBackground": "#00000000"`、`"button.secondaryBorder": "#FFFFFF1F"`、`"menu.selectionBorder": "#00000000"`（同步更新 `workbenchThemeService.test.ts:257-284` 的键名列表断言）。
     - `src/vs/workbench/browser/parts/activitybar/media/activityaction.css:118-125`：`.active-item-indicator:before` 在 `48×44px` 项上使用 `top/bottom/left/right: 8px; border-radius: 8px;` 形成 `32×28px` 扁块，且缺少未选中项 `:hover` 淡底；按规范 `36×36px` 圆角底（`modernUI/browser/media/activityBar.css:270-280`）应对齐为 `top: 4px; bottom: 4px; left: 6px; right: 6px; border-radius: var(--vscode-cornerRadius-xLarge, 12px);` 并补 `:hover` 淡底。
     - `src/vs/workbench/browser/media/uaRoundedMenus.css:70`：菜单悬停/键盘高亮仅 `4%` 前景混色，低于规范 §5.5 的 `8%`。
     - `src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css:1374`：`.monaco-workbench .engine-preferences-pane input[type="search"]` 因属性选择器权重（`0,3,1`）压过了 `engineCatalogSettings.css:82` 的 `.engine-provider-catalog-filter`（`height: 32px`）。
     - `src/vs/workbench/contrib/conversation/browser/media/conversationLens.css:5019, 5672`：提问座位自定义输入框 `.conversation-lens-question-custom` 与 `.conversation-diff-fallback` 边框 fallback 为 `transparent`，在与容器同底色时失去轮廓（违反原则九）。
- **修改方案**：
  1. 在普通主题（`:not(.hc-black):not(.hc-light)`）下将上述未锁定的 `focusBorder` 外圈改为 `outline: none` + `var(--vscode-toolbar-hoverBackground)`（或中性 `16%–20%` 前景混色描边），高对比主题（`:is(.hc-black, .hc-light)`）统一使用 `var(--vscode-contrastActiveBorder, var(--vscode-focusBorder))`；保持 `conversationLensCssScan.test.ts` 与 `navigatorProjectsListCss.test.ts:59` 显式锁定的规则不变。
  2. 将 `universe-agent-studio-light.json` 的 `sideBar.background` / `sideBarTitle.background` / `sideBarSectionHeader.background` 对齐为 `#F6F6F6`、`activityBar.activeBackground` 对齐为 `#E6E6E6`；在 `universe-agent-studio-dark.json` 补齐 `button.secondaryBackground`、`button.secondaryBorder`、`menu.selectionBorder`，并同步修正 `workbenchThemeService.ts` 中 `COLOR_THEME_LIGHT_INITIAL_COLORS['button.secondaryBackground'] = '#00000000'` 与 `COLOR_THEME_DARK_INITIAL_COLORS['conversation.background'] = '#121314'` 及 `workbenchThemeService.test.ts` 的键名列表断言。
  3. 将 `activityaction.css:118-125` 的选中/聚焦/悬停指示器统一为 `top: 4px; bottom: 4px; left: 6px; right: 6px; border-radius: var(--vscode-cornerRadius-xLarge, 12px);` 并为未选中 `:hover` 独立声明 `content: ""; position: absolute;` 与淡底（保持 `.action-item:focus:not(.clicked):not(.checked) .active-item-indicator:before` 选择器独立以匹配 `activitybarCssScan.test.ts:71`）；将 `uaRoundedMenus.css:70` 的菜单高亮提升为 `8%` 前景混色；在 `engineCatalogSettings.css:82` 将选择器提权为 `.monaco-workbench .engine-preferences-pane .engine-providers-section input.engine-provider-catalog-filter`（不改动 `enginePreferencesPane.css:1374` 以保留 Memory 搜索框的 24px 胶囊样式与 `conversationLensCssScan.test.ts:1124` 合同）；为 `.conversation-lens-question-custom` 与 `.conversation-diff-fallback` 补齐 `color-mix(in srgb, var(--vscode-foreground) 12%, transparent)` / `8%` 边框回退。

---

## 5. 规则 16 只读审查记录（2026-11-06）

- **S1–S3 审查结论**：Critical 0，Important 3，Minor 2。已全部核验并改入本方案正文：
  1. **Important 1（`.sources-tab.selected` 合同）**：核对 `conversationLensCssScan.test.ts:1112-1113` 与 `ui-design-principles.md:281`，已改为保持 `.sources-tab.selected` 的 `var(--vscode-toolbar-hoverBackground)` 与 `font-weight: 400`，通过调浅未选 `:not(.selected):hover` 与加深 `.selected:hover` 区分悬停与选中。
  2. **Important 2（`focusBorder` 扫描锁定项）**：核对 `conversationLensCssScan.test.ts:158, 447, 1018, 1123, 1200`，已在 §3.4 明确保留这 5 条扫描锁定规则，仅收敛其余未锁定控件的普通主题 `focusBorder`。
  3. **Important 3（`sourcesWiringScan.test.ts` 错误选择器）**：核对 `sourcesWiringScan.test.ts:487-488, 640, 655, 684-689`，已在 §3.1 明确保留全部 `.is-error` 选择器名称，仅将正文色改为 `var(--vscode-foreground)`、语义色留在 `::before` 图标。
  4. **Minor 1–2**：已在 §4.1 补充 `.connection-hub-device-row` 的 `display: flex; align-items: center;`，并在 §4.2 注明 `editorgroupview.css:603-611` 已有 reduced-motion 块，不重复添加。
- **S4（§4A）审查结论**：Critical 0，Important 3，Minor 2。已全部核验并改入 §4A 正文：
  1. **Important 1（`engineCatalogSettings.css:82` 选择器提权）**：改用 `.monaco-workbench .engine-preferences-pane .engine-providers-section input.engine-provider-catalog-filter` 提权，不改 `enginePreferencesPane.css:1374`，以保留 Memory 24px 胶囊搜索框与 CSS 扫描合同。
  2. **Important 2（`workbenchThemeService.ts` 初始占位色表对齐）**：同步修正 `COLOR_THEME_LIGHT_INITIAL_COLORS['button.secondaryBackground'] = '#00000000'` 与 `COLOR_THEME_DARK_INITIAL_COLORS['conversation.background'] = '#121314'`。
  3. **Important 3（`activityaction.css` `:hover` 伪元素生成与扫描顺序）**：为 `:hover:not(.checked)` 补齐 `content: ""; position: absolute;` 与 `4px/6px` 几何，并保持 `.action-item:focus:not(.clicked):not(.checked) .active-item-indicator:before` 独立成块。
  4. **Minor 1–2**：在 `uaRoundedIcons.css` 纳入侧栏视图标题栏与 `.context-view` 弹层作用域，并将通用 `::before` 宽高设为 `1em` 以自适应 12px/16px/20px 字号。

---

## 6. 验证门禁（本地门禁）

遵循 [health-gates](../progress/health-gates.md)：
1. `npm run transpile-client` / `npm run compile-client` 零错误。
2. 相关 Node / Chromium 单测与 CSS 合同扫描（`conversationLensCssScan.test.ts`、`sourcesWiringScan.test.ts`、`navigatorProjectsListCss.test.ts`、`uaCommonMotionContract.test.ts`、`previewEditorGroupHeader.test.ts` 等）。
3. 修改文件的 ESLint 与 `git diff --check`。
4. 文档门禁：`python3 scripts/generate-docs-status.py`、`python3 scripts/check-docs-health.py`、`python3 scripts/wiki/wiki.py check --root .`。

## 7. S1–S3 实施与验证检查点（2026-11-06）

- **S1（交互阻塞与键盘焦点闭环）**：
  - `conversationTrajectory.ts`：表格 `keydown` 在 `resolveTrajectoryRecordRow` 为空时回退读取 `this.list.getFocusedElements()[0]`，支持 `Enter`/`Space` 激活聚焦记录或切换聚焦折叠块；Overview 分段条改用 `role="toolbar"`、移除 `<button>` 上冗余 `role="listitem"`，并实现 roving `tabIndex` 与 `ArrowLeft`/`ArrowRight`/`Home`/`End` 键盘导航。
  - `navigatorProjectsList.ts`：向 `NavigatorProjectsInlineFilterBox` 传入 `focusTreeFromFilter`；记录 `lastBodyHeight`/`lastBodyWidth` 并在状态或过滤显隐变更后调用 `relayoutTree()`；`openTreeNode` 在鼠标单击 `workdir` 组头时仅做展开/折叠，不误触发 `createSessionInCurrentWorkDir()`。
  - `conversationProcessFold.ts` & `conversationLens.css`：`setProcessFoldCollapsed` 同步设置 `panel.inert = collapsed`，并在 `.conversation-process-fold-motion.conversation-process-fold--collapsed > *` 增加 `visibility: hidden`；`renderFileEditCard` 为非完成态 `file_edit` 行补齐状态类名、状态图标与 `appendProcessFoldToolRespond`。
  - `conversationInboxOverlay.ts`、`conversationLensSessionBar.ts`、`conversationLensComposerChrome.ts`、`conversationTimelineHost.ts`、`conversationComposerAt.ts`、`conversationLensDock.ts`：队列弹层补 `Escape` 关闭回焦与重绘保焦；History 与 Snapshots 打开时互斥关闭对方及 More/Inbox 弹层；SessionBar 标题改名结束回焦 `sessionTitleButton`；窄叶 `More` 菜单为 `Tool options` 补齐 `isComposerKeepLeftoverListFailed` 禁用与原因说明；置顶提示点击跳转后保持焦点；`@` 建议框与输入历史 `Escape` 增加 `stopPropagation()`。
- **S2 & S3（视觉状态一致性、尺寸与 Reduced-Motion 合同）**：
  - `sourcesTabs.css`、`sourcesReviewList.css`、`sourcesPart.css`：未选 tab `:hover` 调浅为 `60%` 混色、`.selected:hover` 升为 `toolbar-activeBackground`，保持 `.sources-tab.selected` 的 `toolbar-hoverBackground` 与 `400` 字重扫描合同；Review 归属芯片改为 12% 淡底并补 `:hover`；Sources 列表普通主题焦点行移除 `focusBorder` 外圈，HC 保留 `contrastActiveBorder`。
  - `conversationSessionStatusBar.ts`、`connectionPreferencesPane.ts`、`engineConfirmPopover.ts`、`agentInspect.css`、`navigatorStub.css`、`navigatorAgentsView.ts`、`navigatorTeamList.ts`：状态栏引擎项对 `'warning'` 使用标准底色（仅 `'error'` 保留错误底）；Connection 设备行内 `Connect` 改为 `secondary` 次按钮，待配对行补 `Enter`/`Space` 键盘选择；`showEngineConfirmPopover` 点击外部关闭不强抢焦点；`AgentInspect` 与 `NavigatorAgents` 选中行前景色改为 `--vscode-foreground` 且静态行禁用悬停背景；切换 `Agents`/`Team` 子视图时若未聚焦行则 `focusFirst()`。
  - `connectionDeviceList.css`、`uaRoundedMenus.css`、`ua-common.css`、`conversationSessions.css`、`navigatorProjectsList.css`、`conversationLens.css`、`conversationTimelineRenderer.ts`：设备行支持 `min-height: 24px; height: 100%; display: flex; align-items: center;`；`.conversation-composer-picker-menu` 纳入圆角菜单样式且排除 SessionBar 会话行的 28px 左内衬；History/Snapshots/Inbox 浮层收敛至 `360px × 320px`；置顶用户提示补 8% 低对比描边；用户气泡、Visualize 卡与错误详情展开切换通知 `onProcessFoldLayout`；补齐 `.monaco-reduce-motion` 与 `prefers-reduced-motion` 动效关闭规则。
- **验证结果**：
  - `npm run transpile-client` 0 errors。
  - Node CSS 合同扫描：`conversationLensCssScan.test.ts`、`uaCommonMotionContract.test.ts`、`navigatorProjectsListCss.test.ts`、`navigatorStubCss.test.ts`、`agentInspectCss.test.ts`、`navigatorTeamStatusFilterCss.test.ts` 共 **67 passing / 0 failing**。
  - 组件行为单测：`conversationTrajectoryUi.test.ts`（15 passing）、`conversationProcessFold.test.ts`（49 passing）、`conversationTimelineRenderer.test.ts`（31 passing）、`conversationQuestionSeat.test.ts`（24 passing）、`conversationSessionStatus.test.ts`（17 passing）、`navigatorProjectsList.test.ts`（51 passing）全绿通过。
  - 修改文件 ESLint **0 errors**，`git diff --check` 通过，文档门禁 `generate-docs-status.py`、`check-docs-health.py`、`wiki.py check --root .` 全部 0 errors。


## 8. S4 实施与验证检查点（2026-11-07）

- **与 §4A 正文的三处偏离（实施时核对后改）**：
  1. §4A.3 第 2 条要求把浅色侧栏改回 `#F6F6F6`、活动栏选中底改回 `#E6E6E6`。核对 [chatgpt-visual-language §25](chatgpt-visual-language.md) 后确认 `#FAFAFA` 侧栏与 `#E9E9E9` 选中底是用户按 GPT 参考图选定的值，过时的是 `theming.md` 与主题单测。因此保留主题 JSON，改为把 `workbenchThemeService.ts` 初始占位色（浅 `sideBar` / `sideBarSectionHeader` `#FAFAFA`、`activityBar.activeBackground` `#E9E9E9`、`button.secondaryBackground` `#00000000`；深 `conversation.background` `#121314`）、`workbenchThemeService.test.ts` 与文档对齐到主题。改前该单测已有 2 红，改后 25/0。
  2. §4A.3 第 3 条的活动栏指示器几何不改：`contrib/modernUI/browser/media/activityBar.css:270-290` 已在非 Modern UI 下以更高权重给出 4px/6px 内缩、`cornerRadius-xLarge` 与 `:hover` 底，并随 `workbench.common.main.ts` 常驻加载。
  3. §4A.1 通用图标集去掉 `codicon-list-ordered`（16 视框内画不出可辨的序号），其余照列。
- **已落地**：
  - 图标层：`uaRoundedIcons.css` 以 `--ua-rounded-icon`（已登记 `vscode-known-variables.json`）按类名绑定 28 个通用图标与 8 个活动栏容器图标（`codicon-conversation-sessions-view-icon` 等注册 id），由一条 `:where()` 零权重作用域规则与一条活动栏规则绘制，`:not(.monaco-custom-toggle, .codicon-modifier-spin)` 排除开关与转圈；发送箭头改 2px 紧凑、Tool options 改双轨滑块、展开/还原改对角箭头。导入补到 `navigatorAgentsView.ts`、`navigatorTeamList.ts`、`sourcesTabsHost.ts`（另加 `uaRoundedMenus.css`）、`enginePreferencesPane.ts`、`connectionPreferencesPane.ts`、`activitybarPart.ts`、`previewCategorySwitcher.ts`；Sources 三处右键菜单加 `ua-rounded-menu`。
  - 菜单与坏码点：Connection 成功条 `\ea5e`→`\eab2` 并加圆头对勾；Projects 工作目录菜单改用 `ua-project-workdir-menu`（`+` 图标），Sessions 菜单补第 2 项垃圾桶；菜单键盘/悬停高亮 4%→8%。
  - 焦点与边界：`conversationLens.css` 17 处未锁定 `focusBorder` 外圈改为普通主题背景或中性 20–25% 描边、高对比 `contrastActiveBorder`；`conversationSessionWindow.css` 活动叶顶线改中性、隐藏按钮去外圈；`conversationPart.css` 区域隐藏按钮补 `:focus-visible`；`preferencesEditor.css` 顶部页签去外圈。时间线条目、用户气泡、轨迹概览段、回合动作四条扫描锁定的外圈未动。Engine 供应商过滤框选择器提权保持 32px；提问自定义输入与 diff 回退补低对比边框。
- **验证**：`npm run transpile-client` 0 errors；Node 扫描（conversationLensCssScan、activitybarCssScan、navigatorProjectsListCss、workbenchThemeService、sourcesWiringScan、两份 enginePreferencesPaneCss、conversationRegionChromeCss、uaCommonMotionContract、titlebarToolbarCss、auxiliaryBarPartCss）144/1，唯一失败是 `status.md` 已记的 `conversationRegionChromeCss` 28px→36px 并行 WIP；浏览器单测 `preferencesStatusStyle` + `engineProviderModelSection` + `engineMemorySection` 185/0，`navigatorProjectsList` + Sources 三列表 + `conversationSessionsView` 81/1，唯一失败是既有 `multiEditorTabsControl` afterEach layout。改动 TS ESLint 0 errors；改动 CSS stylelint 无新增；`git diff --check` 通过。未做默认窗口浅深主题与高对比实拍验收。
