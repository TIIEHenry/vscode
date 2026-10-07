---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-10-07
summary: "2026-10-07：编辑器壳剧本可按命令断言开关与 Sources。2026-10-06 行为与视觉审查方案仍 draft。浏览器归属、遮罩色和追问工作态仍 draft。不升 PRD。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。2026-09-30 会话流水 → [归档](../archive/status-current-session-2026-09-30.md) · 2026-10-05 归档 → [归档](../archive/status-current-session-2026-10-05.md)。
## Current Session
- **审查与修复 Wave 12（Slot A conversation / Slot B sessions，提交 32358af552c）**：
  - **Slot A（conversation 会话叶窗切换早退修复与回合编辑退出 composer 挂载防护）**：
    `ConversationLeafSessionBar.switchLeafSession` 移除目标等于当前会话时的早退逻辑，确保正确处理聚焦、取消阻塞中的 in-flight reveal 并同步 `rosterService.switchSession`；`ConversationSessionWindowService` 增加聚焦叶冗余 reveal 过滤保护；
    `ConversationLensComposerChrome.syncComposerPlacement` 修复退出回合编辑模式时因行内容器销毁导致瞬时 `!isConnected` 而误跳过挂载的问题，确保原子挂回 `composerCluster` / `dockRoot`；
    单测 `conversationSessionWindowReveal.test.ts`（25 项全绿）与 `conversationLens.test.ts`（138 项全绿）。
  - **Slot B（sessions 多聊天删除缓存同步与新建会话工作区继承恢复）**：
    `CopilotChatSessionsProvider.deleteChat` 在持久化多聊天场景下，同步清理 `_sessionCache`、`_newSessions` 与 `_sessionGroupCache`，使分组缓存失效并触发群组变更事件通知，杜绝界面残留与空指针隐患；
    `SessionsService.openNewSession` 恢复 `inheritWorkspaceFromActiveSession` 选项支持，支持按需继承活动会话的工作区根路径并对齐草稿；恢复 `sessionsManagementService.test.ts` 中两个被 skip 的继承单测；
    单测 `copilotChatSessionsProvider.test.ts`（94 项全绿）与 `sessionsManagementService.test.ts`（118 项全绿）。
  - 经 merge 槽集成编译（`compile-client` 0 errors）与双领域全量单测通过（375 passed，0 failed），单编译锁串行无冲突，已快进同步至 agent-ide，槽 A/B/merge 已对齐（提交 32358af552c）。
- **审查与修复 Wave 11（Slot A storage & policy / Slot B copilot tools & conversation，提交 f6606f16e4b）**：
  - **Slot A（storage 启动恢复抢修、并发 flush 回调精确结算与托管策略瞬态保护）**：
    `SQLiteStorageDatabase.connect()` 在首次连接前执行 `restoreRecoveryDatabaseIfMissing`，主库缺失时优先校验并原子重命名恢复 `.recovery-temp`（次选 `.recovery-replace`），防止异常中断后遗留恢复库被覆盖或回退至空库；
    `Storage.flushPending()` 快照当批待写入数据与等待中的 `whenFlushedCallbacks`，刷盘完成时精确结算当前批次，避免并发写入时回调滞留或受后批失败牵连；
    `FileManagedSettingsService` 增加瞬态 ENOENT 保护，首次缺失保留上一代策略并调度重试读取，防止配置原子替换时白名单短暂全开。
    单测 `storage.integrationTest.ts`（36 项）与 `fileManagedSettingsService.test.ts`（25 项）全绿。
  - **Slot B（copilot 命令免确认白名单净化与会话链路修复）**：
    从 `noConfirmationCommandsWithoutArgs` 彻底移除具有副作用的 `git.stash`、`git.stashPop`、`git.stashStaged`，保留只读的 `git.stashView`，强制要求弹窗确认；
    单测 `vscodeCmdTool.spec.ts` 4 项全绿；保持 thinking 轮次标题并在投影中改写活动会话链接；视口内含可见用户轮次时不置顶用户提示。
  - 修复 storage 模块 TypeScript TS2454 / TS6133 / TS2341 编译报错，补齐备份文件存在性断言，重构 flushPending Promise 生命周期。
  - 经 merge 槽集成编译（`compile-client` 0 errors，`compile-copilot` 0 errors）与全量针对性单测通过（共 123 项通过，0 失败），单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐（提交 38196081a1e）。
- **审查与修复 Wave 10（Slot A conversation / Slot B sessions，提交 9b688de6f87）**：
  - **Slot A（conversation 多消费者 Lease 基线快照回放与权威缓存投影）**：`SharedEngineHostBinding` 补齐次级消费者
    `addConsumer` 时回放基线快照与 cursor；权威缓存投影收归 `SharedEngineHostBinding.getCachedProjection`，
    修复多视图或次级绑定覆盖清空缓存投影问题；优化连接与暂存态下读取缓存投影的判定门禁。
    单测 `conversationEngineRosterService.test.ts` 与 `conversationEngineFrameSource.test.ts` 共 163 项全绿。
  - **Slot B（sessions 单个聊天删除前置确认门禁与草稿级联销毁防护）**：修复 `deleteChat` 当 `chatIds.length <= 1`
    时直接调用 `deleteSession` 绕过确认对话框缺陷，添加前置确认门禁；未提交草稿删除时仅清理本地缓存，
    阻断级联销毁父会话历史；修复 `RemoteNewSession.setPermissionLevel` 抛异常导致 Cloud 会话崩溃的缺陷。
    单测 `copilotChatSessionsProvider.test.ts` 共 92 项全绿。
  - 经 merge 槽集成编译（0 errors）与合并单测（254 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **编辑器壳剧本**：窗口驱动可以按命令 id 执行。剧本核对 Sources 当前标签和可见面板，并确认标题栏开关与命令留在编辑器窗口。
- **2026-10-06 审查**：行为十六路与视觉十六路的发现和方案已写入，frontmatter 仍 `draft`，未实施。浏览器页归属、对话框遮罩色、追问工作态聚焦仍是 draft。
- **UI 审查 Wave 8（r15 Debug 调试 / r16 Themes 主题，提交 47816a1adc5）**：
  - **r15（Debug 调试浮动条与悬停）**：`DebugToolBar.setCoordinates` 在标题栏显隐变动事件驱动下重置 `_yRange`，
    确保自定义标题栏显隐时浮动条吸顶与下移纵向区间正确重新计算；`DebugHoverWidget` 补齐 `beforeRender`
    异步时序计数保护，在异步 Promise 完成时标记 `isUpdatingTree = false` 并调用 `layoutTreeAndContainer()`。
    更新单测 `debugToolBar.test.ts`（2 项通过）与 `debugLeftoverPromiseCatchScanD744.test.ts`（11 项通过）。
  - **r16（Themes 默认主题对齐与对比度）**：更新 `COLOR_THEME_LIGHT_INITIAL_COLORS` 与 `COLOR_THEME_DARK_INITIAL_COLORS`
    启动占位色对齐 Universe 默认主题；更新 `2026-dark.json` 的 `disabledForeground`、`input.placeholderForeground`
    （`#8C8C8C`）与 `list.invalidItemForeground`（`#B89500`）提升暗色对比度。更新单测 25 项全绿。
  - 经 merge 槽（47816a1adc5）集成编译（0 errors）与针对性单测（36 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **UI 审查 Wave 7（r13 Terminal 终端 / r14 Markers & Search 问题与搜索，提交 56c4d04e83f）**：
  - **r13（Terminal 终端面板与编辑器）**：`DecorationAddon._updateClasses` 拷数组清 class 避免 token 残留；
    `TerminalTabsChatEntry` 显隐变化驱动 `TerminalTabbedView` 即时重排列表高度；
    `TerminalGroup._removeInstance` 用 `hadFocusOnExit` 保护焦点转交；
    `TerminalEditor` 的 `mousedown` 锁定本页实例；分栏/列表 `hasText` 在 63px 统一对齐并吸附。单测 13 项全绿。
  - **r14（Markers & Search 问题表视图与搜索）**：`MarkersTable.revealMarkers` 未选中时查可见行有效下标防越界；
    `SearchView.cancelSearch` 抽离 `cancelSearchWithFocus` 保证语义与文本均取消且按需聚焦；
    `MarkersFileDecorations` 补齐装饰开关与可见性双向配置监听。单测 27 项全绿。
  - 经 merge 槽（56c4d04e83f）集成编译（0 errors）与合并单测（40 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **UI 审查 Wave 6（r11 Welcome 欢迎页 / r12 Preferences 设置，提交 08cb8a490b5）**：
  - **r11（Welcome 欢迎页与入门引导）**：`GettingStartedPage.layout` 避免排版重建媒体与步骤 disposables；
    `walkthroughRestoreFolderMatches` 防空工作台 URI 崩溃；窄窗 `toSide` 侧组聚焦拦截并轻提示；
    `GettingStartedIndexList` 保持早退 `itemCount`。针对性单测 28 项全绿通过。
  - **r12（Preferences 设置编辑器与小部件）**：`ListSettingWidget`、`ObjectSettingDropdownWidget`、
    `ObjectSettingCheckboxWidget` 在策略与只读下禁用改序/添加/编辑；Renderers 向下透传只读；
    AI 搜索开关按状态机保持显示稳定。针对性单测 15 项全绿通过。
  - 经 merge 槽（08cb8a490b5）集成编译（0 errors）与合并单测（39 passed）通过，单编译锁串行无冲突，已快进至 agent-ide，槽 A/B 已对齐。
- **UI 审查 Wave 5（r09 Chat 浏览器 / r10 Chat 组件，提交 3161988b7f3）**：
  - **r09（Chat 浏览器会话与快捷输入）**：`AgentSessionRenderer.renderApprovalRow` 在审批行高度随折行变动时补发 `onDidChangeItemHeight`；`QuickChat` 改为监听 `onDidLayoutActiveContainer` 确保容器宽度写回后再排版，并在 sash 拖拽时取样实时宽度。单测全绿。
  - **r10（Chat 组件输入与附件）**：`ImplicitContextAttachmentWidget` 重绘时清理旧节点防残留；`ToolConfirmationSubPart` 工具确认 JSON 解析失败保留展开链接；`ChatInputPart` 设定最小宽度 20px 并在紧凑溢出时保护输入框；`DefaultChatAttachmentWidget` 诊断/命令/调试芯片点击阻止冒泡至容器聚焦。单测全绿，全工程 `compile-client` 0 errors。
  - 经 merge 槽集成编译与针对性单测 100% 通过（单编译锁串行），已快进同步至 agent-ide，槽 A/B 已对齐。
- **UI 审查 Wave 4（r03 次侧栏 / r07 会话区 编辑器宿主，提交 c48e3c0a52b）**：
  - **r03（Auxiliary Bar 次侧栏）**：次侧栏标题关闭按钮取消活动栏位置（`when: config.workbench.activityBar.location == default`）限制，在活动栏处于 top/bottom/hidden 时均保持一致可用并补齐单测。
  - **r07（Conversation Part 会话编辑器宿主）**：会话编辑器在首次 0×0 降级后，通过宿主 ResizeObserver 在客户区尺寸变正后即时补触发 layout 调度，首次回退记录为 (0, 0) 避免误跳过后续 800×600 布局，宿主尺寸非正时严格跳过，补齐针对性单元测试。
  - 经 merge 槽（c48e3c0a52b）集成编译与单测 100% 通过（单编译锁无并发冲突），已快进同步至 agent-ide，槽 A/B 已对齐。
- **UI 视觉与交互修复（r01/r02/r04/r05/r06/r08 并行波次合入）**：
  - **r01 & r02（标题栏/状态栏/横幅）**：标题栏读屏跟随当前会话名，状态栏空文本进度恢复默认显示，横幅同 id 重新显示时正确重建 DOM 并绑事件。
  - **r08（Sessions 紧凑桌面/抽屉）**：修复抽屉 z-index 与顶部导航条定位、抽屉折叠零槽（0 宽度）、折叠态侧边栏隐藏重定向至抽屉折叠。
  - **r06（Views 视图与树控件）**：空树消息隐藏与清除（正确销毁 Markdown DisposableStore 并清空缓存值）、欢迎区无内容焦点安全转移至容器、常量视图按 id 匹配折叠。
  - **r04（Editor Part 编辑器区域）**：分类条布局原点（top + reserved 统一高度防重复扣减）、终端空态键位与点击命令保持一致（含 sequence 防异步竞态、断开即时重绘与销毁保护）、并排视图尺寸约束随水平/垂直方向动态按主/交叉轴计算并在配置变更时触发事件。
  - **r05（Notifications 通知与弹窗）**：窄窗展开依据实际容器宽度动态测高、消息变长动态补充展开动作（流式防抖保焦点）、无障碍视图拷贝保护原动作引用与 keepOpen、右上铃铛根据注意力与免打扰四态上下文键驱动、列表空白处双击安全容错。
  - 所有模块均通过 worktree 分槽并行开发（Slot A / Slot B）、Grok CLI 审查通过、独立单测全绿，已安全合入 loop/merge 并快进至 agent-ide（提交 1d1c20a329b）。
- **打开文件**：资源管理器单击默认新开固定标签；Sources 单击和 Enter 默认替换当前标签。右键只留另一种。Preview 标签条有 `+`。Sources Files 是完整资源管理器树，不再是只读投影。从 Sources 打开或新建文件不带动资源管理器定位。
- **对话阅读面**：用户回合不显示 You，助手默认不显示 Agent；非 default 代理名在首行 11px。用户气泡无描边、无投影，焦点是 1px focusBorder，高对比仍用 contrastBorder。读屏名仍在文章 aria-label。轨迹角色词保留，不再全大写。Inspector 区段标题 12px、600，状态徽标淡底。不升 PRD-028。
- **一拖二**：宿主按发起 lease 裁剪 `localPendingSends`，baseline 补齐 attribution；已决 permission 不再和待决座位叠成两次点击。
- **合入的 4 个提交**：浏览器单测模块加载失败改为非 0 退出；`ResolveTurn` / `ResolveAnchor` / `PtyStream` / `WatchConfig` 改 proto bytes；渲染进程跳过只能在 Node 加载的会话令牌测试；选择器把 `id` 放在 `class` 前。
- **D24**：仍开。`Connect`、`WatchConfig`、`ResolveTurn`、`ResolveAnchor`、`PtyStream` 已是 proto bytes。仍走 JSON 的只有 `SaveSkillContent`（本仓 JSON 客户端已挂；引擎 proto 方法仍缺）。对照引擎 proto 确认后按 [cross-repo-protocol](../plans/cross-repo-protocol.md) §3.1–§3.2 提需求。本仓不发明字段号，不改引擎仓。这次还没开 issue。
- **十六路审查**：hold 切片已有对应提交在 `7cf1474419e`。方案 frontmatter 仍 `accepted`，不升 `implemented`。
- **PRD-008**：仍 `blocked`。`d8-evidence/7cf1474419e` 为 PARTIAL：回环曾显示 `Engine · Loopback`（不算通过）；Direct Address 停在 `Waiting for pairing`，主进程配对框未出现。
- **PRD-028 密度**：Sessions roster、轨迹表、Engine 首选项导航都是 22px 单行。轨迹表类型列是图标加正常大小写。阅读面不再显示 You / Agent，用户气泡无描边无投影。Composer 仍是 16px 圆角加投影。其余验收未齐。本条不升 `implemented`。
- **槽 F**：轨迹 Overview 从形状加文字方块改成 12px 分段条。点击定位不变。不升 PRD-028。
- **槽 E**：Sessions Changes 在 `pairingPending` 时卸掉标题栏写钮，并在确认前拦住 `invokeChangesetOperation`。文件列表仍可留着。不升 PRD-007 / PRD-008。
- **槽 G**：Fix CI、处理评论、提交反馈在会话聊天不存在时弹出错误，不再只写日志后把按钮恢复成无事发生。Changes 菜单的 Fix Checks 同一句。不升 PRD。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **loop** | 已合入自动化重读、定制树分组、账号 Loading、评审解析、策略遮罩、浏览器认领、空 GitHub 树、加载前卸文件夹。C 仅脏 `dev/loop` gitlink，不入库，不 `checkout -B`。 |
| **2026-10-06** | `efa6bdefcb8` 已快进到 `agent-ide`。在 `60d3f146086` 之上合入 r15-4 断点条件输入扣 Mode 容器宽度。merge 槽 `npm run compile` 0 errors。未 push。A/H 对齐。B 留有未跟踪 `tmp/`。C/D/E/F/G/I/J 未动。 |
## Next
| 项 | 指针 |
|:-----|:-----|
| **loop** | D24 不因 `SaveSkillContent` 再切刀。不得宣称 leftover / pills 完成。打开身份 S1–S4 已落，方案仍 accepted，见 [D944](deferred-gaps.md) |
| **十六路审查** | 2026-09-30 切片已落，方案仍 [accepted](../plans/review-2026-09-30.md)，不升 implemented。2026-10-06 行为与视觉方案仍 [draft](../plans/review-2026-10-06.md)，未实施 |
| **PRD-008** | `d8-evidence/7cf1474419e` PARTIAL。下次要先让主进程配对框出现并点 Verified on Engine。全 PASS 之前不升档 |
| **Sources** | [sources-architecture](../plans/sources-architecture.md) P6/P7 已落，方案仍 accepted。Accept hunk S1 已落，不升 PRD-009 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI。本仓不发明、不实现外仓 RPC，不改引擎仓。对照引擎 proto 确认没有该方法、或只能靠发明字段号才能改 bytes 之后，按 [cross-repo-protocol](../plans/cross-repo-protocol.md) §3.1–§3.2 提需求。§3.4 只报已有面的 bug。
