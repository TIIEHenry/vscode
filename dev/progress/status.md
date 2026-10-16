---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-10-16
summary: "2026-10-16：多工位并行合入第八批（Slot A: 视觉靠齐向 Cursor 靠齐 S1-S10 全量实施与会话追问卡去毛玻璃方案状态收归 implemented；Slot B: Sources Git 写能力、IPC 白名单与删明文连接方案状态全面收归 implemented）。transpile-client 0 错误，文档门禁全绿。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。2026-09-30 会话流水 → [归档](../archive/status-current-session-2026-09-30.md) · 2026-10-05 归档 → [归档](../archive/status-current-session-2026-10-05.md) · Wave 28 → [归档](../archive/status-wave-28-2026-10-13.md) · Wave 29 → [归档](../archive/status-wave-29-2026-10-16.md)。
## Current Session
- **多工位并行实施与视觉收归 Wave 2026-10-16（第八批）**：
  - **Slot A: 视觉靠齐 S1–S10 与会话追问卡去毛玻璃方案状态收归 (提交 b3cbd2ffefa)**：更新 `cursor-visual-alignment.md` 为 `implemented`，确认 S1–S10（主题三档、画布 token、对话头与身份条、用户卡与置顶提示、空稿单行 Composer、Sources 动作吸附 tab 与 Preview 去框、Picker 菜单与圆角阴影收归、错误与加载态去重、列表筛选芯片 24px 单行、Markdown 居中阅读列与属性表去框）及对话框独立半透明遮罩全部落地；更新 `sessions-chat-composer-glass.md` 为 `implemented`，确认 `cd93865b15a` 修复聚焦描边并补齐测试；同步更新 `INDEX.md`；扫描测试与单测全绿。
  - **Slot B: Sources Git 写能力、IPC 白名单与删明文连接方案状态收归 (提交 ed593b55bf2)**：更新 `sources-git-write-capability.md` 为 `implemented`（确认 `c7d53074df5` 落地）、更新 `connection-ipc-allowlist.md` 为 `implemented`（确认 `143c96bef91` 落地）、更新 `remove-legacy-plaintext-connect.md` 为 `implemented`（确认 `87865dbf5bb` 落地）；同步更新 `INDEX.md`；能力探测测试 16 passing 全绿。
- **多工位并行实施与视觉收归 Wave 2026-10-16（第七批）**：
  - **Slot A: 对话框遮罩改用独立半透明底色并对齐扫描测试与方案 (提交 b6cca021418)**：修改 `dialog.css` 中 `.monaco-dialog-modal-block.dimmed` 为明确的 `background: rgba(0, 0, 0, 0.45);`，解决默认浅色主题下因 `--vscode-widget-shadow` 过于透明导致的遮罩失效；对齐更新 `modalMaskGlassScan.test.ts` 扫描测试断言并全部通过；对齐 `modal-mask-no-glass.md` 与 `INDEX.md` 为 `implemented`。
  - **Slot B: 架构审查落地事实与能力探测方案状态全面对齐 (提交 bd67572e78b)**：更新 `review-2026-10-16-architecture.md` 总结与 §7，明确记录具体缺陷 B1–B4、B6、B7 和 D1–D4 已在 `architecture-2026-10-16-concrete.md`（4fa4f3eab56、99bd6829c11、1a4c4295b45、83ef402a254、68308db93b5、cc6e17a9d8f）全部落地；对齐 `sources-files-list-capability.md`（b6bccf8ff2c）与 `unspecified-address-private-denial.md`（afda5a04283）为 `implemented`；同步更新 `INDEX.md`。
- **多工位并行实施与视觉收归 Wave 2026-10-16（第六批）**：
  - **Slot A: Markdown 预览排版与属性表无边框规范对齐 (S10，提交 693ec548c89)**：`body` 约束约 760px 居中（`max-width: 760px; margin: 0 auto; box-sizing: border-box;`）；正文字号收归 `13px`；H1 保留 600，H2~H6 统一收敛为 400 并保持阶差；列表悬挂缩进（`padding-left: 2em;`）；行内代码统一为中性浅灰底、`cornerRadius.xSmall`（3px）及等宽字；Frontmatter 表去掉内外表格框线，长值换行，JSON `<code>` 弱化等宽呈现；单测与 CSS 扫描全绿通过。
  - **Slot D: 审查发现稿与规划状态全面对齐 (提交 b73029ec955)**：将 `visual-review-2026-10-16-plan.md`（V2–V4、V8）与 `conversation-entry-capability.md` 标记为 `implemented`；对齐 `review-2026-10-16-feature-gaps.md`、`cursor-visual-alignment.md` 与 `INDEX.md` 落地记录；文档检查 0 error 全绿。
- **多工位并行实施与视觉收归 Wave 2026-10-16（第五批）**：
  - **Slot A: Composer 进行中空稿单行布局与卡片 token (S5，提交 a86e019d72b)**：实现纯函数判定 `isComposerSingleLine`（进行中会话、空稿无提及芯片、未放大、宽度 ≥ 450px），切换 `.is-single-line` 并使用 CSS flex 重排控件（Tools、输入、Permission、Model、放大、发送）；PreFirst 居中态保持两行；高度变化前后保持阅读列贴底状态；边框与投影收归 token；单测 `conversationLensComposer.test.ts`、`conversationLensCssScan.test.ts` 46 passing 全绿。
  - **Slot D: 目录列表、筛选芯片与搜索框视觉规范对齐 (S9，提交 6c1d33127fd)**：透镜切换 tablist、Sources 页签与 Engine 首选项筛选芯片统一 24px 行高及内边距，选中态改用中性淡底 `var(--vscode-toolbar-hoverBackground)` 且不加粗；Navigator 过滤输入框去常驻静态描边，聚焦出标准焦点环；Engine 偏好设置过滤框收敛为药丸胶囊；分节列表统一 24px 单行并补弱化计数；单测与 CSS 扫描 174 passing 全绿。
  - **Slot B: 拦截 Triggers 与 Clipboard 空载荷并收紧 UNKNOWN 列表门禁 (G4, G15, G16，提交 f342680627e)**：拦截 Triggers Add/Edit、Clipboard Write 空载荷；简化 FireTrigger 执行状态色调；对 UNKNOWN 能力门禁保持禁用；单测 `engineTriggersSection.test.ts` 等全绿。
- **多工位并行实施与视觉收归 Wave 2026-10-16（第四批）**：
  - **Slot A: 会话不可用固定原因与输入底栏控件保留 (S8，提交 dfb39029655)**：会话不可用时 gate row 呈现 `Session unavailable — The engine is connected, but the active session is not ready.`，使用 `var(--vscode-descriptionForeground)` 消除整段红底报错；保留 Permission、Model 与 Tools 底栏控件在空态/禁用态，SessionBar 导航保留禁用；单测 `conversationComposerCatalog.test.ts` 35 passing 全绿。
  - **Slot D: Sources Files 标题栏动作并入 Tab 条与 Preview 空态去框 (S6，提交 9689d96793b)**：隐藏 Files ViewPane 独立标题栏垂直空间，将新建文件/目录、刷新、折叠、树/列表模式等 6 个动作按钮吸附并入 Sources Tab 筛选栏（激活 Files 时显示，切换 Changes/Review 时隐藏）；单测 `sourcesTabs.test.ts`、`sourcesFilesListMode.test.ts` 等 54 passing 全绿。
  - **Slot B: 会话切换下拉框接通 attachComposerPicker (S7，提交 6c69a831e30)**：为 sessionSelectBox 接入 `attachComposerPicker`，根据 `hasNativeContextMenu` 判定保留原生 select 或接入工作台菜单样式；菜单项通过 Keybinding 弱化呈现会话元信息（优先 turnCount，无则回退至 lastAccessedAt），保持 session.title 原文字符串不动；单测 `conversationComposerPicker.test.ts`、`conversationLensSessionBar.test.ts` 与 `conversationLens.test.ts` 全绿。
- **多工位并行实施与视觉收归 Wave 2026-10-16（第三批）**：
  - **Slot A: 弹出层与浮动面板圆角阴影收归 (S7，提交 0808165ae06)**：History/Snapshots 面板与 Inbox 浮层圆角收归为 8px token（`var(--vscode-cornerRadius-large, 8px)`），阴影收归为 `var(--vscode-widget-shadow)`，消除硬编码 12px 与 rgba 投影；单测 `conversationLensCssScan.test.ts` 30 passing 全绿。
  - **Slot D: Navigator 加载态与 Sources 错误呈现去重 (S8，提交 c64a22ff72b)**：读代理树时加 `.is-loading` 抑制闪电图标；Sources 列表有内容时仅状态行显示错误，空态时居中显示错误，原始错误移至 tooltip 与展开详情；单测与子视图用例 185 passing 全绿。
  - **Slot F: 缺口修复方案实施状态对齐 (提交 0e6934b544f)**：对齐 `engine-gap-queue-send-attachments.md` 与 `conversation-failure-and-mutation.md` 至 `implemented`，文档门禁 0 error 全绿。
- **多工位并行实施与架构缺陷修复 Wave 2026-10-16（第二批）**：
  - **Slot F: ProjectRule 全局探测增加 GLOBAL scope 载荷（提交 4ceec227b19，G16、B3）**：
    - `grpcTransport.ts` 与 `grpcClient.ts` 扩充 `probeRpc` 接受可选 `request` 参数；
    - `grpcCapabilityProbe.ts` 为 `globalRules` 和 `projectRules` 传入 `PROJECT_RULE_SCOPE_GLOBAL`（scope 2）载荷，杜绝因 UNSPECIFIED scope 导致引擎拒绝为 INVALID_ARGUMENT 而使规则能力沦为 UNKNOWN；
    - 单测 `grpcCapabilityProbe.test.ts`（16 passing）全绿。
  - **Slot D: 会话工作根完整收口（提交 27adee81b35，G5、S2）**：
    - `sourcesFilesExplorer.ts:listsEngineDirectory` 废弃 `getSessionWorkDir`，改用 `getWorkRoot`。无自身 workDir 但继承连接远程 workDir 的会话能正确渲染引擎文件树；
    - `sourcesFilesList.ts` 与 `sourcesChangesList.ts` 统一通过 `session.getWorkRoot(sessionId).workDir` 解析；
    - 单测 `sourcesFilesList.test.ts` 与 `sourcesChangesList.test.ts`（114 passing）全绿。
  - **Slot B: Tools/Agents 接入工作根刷新与 Triggers 门禁完善（提交 1a4c4295b45，B3、G15、G16）**：
    - `engineToolsSection.ts` 与 `engineAgentsSection.ts` 注入 `IAgentSessionContext`，监听 `onDidChangeActiveSession` 与 `onDidChangeActiveWorkRoot` 并携带 `projectPath` 刷新；
    - `engineTriggersSection.ts` 落地 G15 执行状态语义（对 `FAILED`、`REJECTED`、`ERROR` 及被拒 reason 渲染 `error` 色调）与 G16 操作级门禁（UNKNOWN/UNSUPPORTED 时写操作按钮保持禁用并提示）；
    - 单测 `engineToolsSection.test.ts` 与 `engineTriggersSection.test.ts`（59 passing）全绿。
  - **Slot F: 文档事实偏差修复与 GFS 行数快照更新（提交 cc6e17a9d8f，D2、D3、GFS）**：改写 sources overview 消除提供者缺失偏差；更新 engine-protocol-surface hunk 暂存为 S1 已落；刷新 GFS 门面行数快照（954/1322/3404/2773 行）；更新 lens 与 session-work-root 事实；
  - **多工位并行实施与架构缺陷修复 Wave 2026-10-16（第一批）**：
    - **PRD-029 会话工作根与 Workbench 双层状态落地 S1–S4（提交 4615d3aa990）**：`agentWorkRoot.ts` 状态机、`agentSessionContext.ts`、Navigator/Sources 树过滤与评审归属；
    - **Slot F 引擎能力复位（提交 4fa4f3eab56，B1、G17）**：Profile 切换与断链时清理能力快照与探测标志；
    - **Slot D 视觉规范对齐与边界测试修复（提交 68308db93b5，V2–V4、B6、B7）**：400 字重、8% hairlines、只读分支 Chip；
    - **Slot B MCP 嵌入表单与空载荷拦截（提交 05a17c38879，B3）**；
    - **Slot A Composer Agent 选择器与生成中禁用发送（提交 2e785907611）**；
    - **Slot B 路径盘符规范化与缺字段文件变更计数（提交 83ef402a254，B4、G8）**；
    - **Slot D 过程折与时间线零值增删统计弱化（提交 ad333e998fa，V8）**；
    - **Slot F diff 文本模型 URI 引入会话隔离（提交 99bd6829c11，B2）**。
  - **门禁验证**：
    - 单编译锁（`flock -x /tmp/vscode-compile.lock`）转译 10012 文件 0 errors；
    - 针对性回归单测（16 node + 149 browser passing）全部通过；
    - `python3 scripts/check-docs-health.py` 0 errors。
- **远程删除在途不打开邻居窗（2026-10-12）**：焦点会话（含主会话）已不在名册时，`onDidChangeActiveSession` 不再 `revealSessionWindow`。`onDidDeleteSession` 卸叶后若没有可见叶，再打开仍在名册里的活动会话，不为刚删掉的 id 开窗。未改 `deleteEngineSession` / `rollbackEngineSessionDelete`。`compile-client` 0 errors；`conversationSessionWindowService.test.ts` 8 passing。目录刷新不发删除事件的缺口记 [D1297](deferred-gaps.md)。不宣称产品完成。
- **编辑器叶输入最大化转发（2026-10-11）**：`ConversationLeafSessionBar.setInputMaximized` 转到该页已有的 `ConversationLens.setInputMaximized`。History / Snapshots 即将打开仍走这条。未改透镜方法。`compile-client` 0 errors；`conversationEditorPane.test.ts` 4 passing。最大化不关叶上 History / Snapshots 记 [D1296](deferred-gaps.md)。不宣称产品完成。
- **Engine Providers / Models 分节（2026-10-11）**：左栏拆成 Providers（只读凭据状态）和 Models（只读注册表）。去掉注册表分组上的凭据脚注。Manage Models… 打开 Models。不画凭据写表单，不升 PRD-025。单测 61 passing。`check-docs-health.py` 0 errors。
- **壳与会话观感（2026-10-11）**：产品主题收成 chrome `#F3F3F3`、画布浅色 `#F8F8F8` / 深色 `#191A1B`、输入白；主按钮浅色近黑、深色近白。用户回合占满阅读列。方案 [cursor-visual-alignment](../plans/cursor-visual-alignment.md) 仍 `draft`。`compile-client` 0 errors；`WorkbenchThemeService` 25 passing（node runner）；`conversationLensCssScan.test.ts` 29 passing。进行中一行 Composer、会话切换菜单、目录列表与 Markdown 预览未做。13 个 `trajectory-*.png` 删除仍不进提交。
- **工位关仓（2026-10-11）**：产品尖端 `7825da47599`。槽表在 [worktree-pool.md](worktree-pool.md)。未 push `origin/main`。未为关仓重编译。C 仍只脏 `dev/loop`。人类工位的 13 个 `trajectory-*.png` 删除不进提交。
- **默认启动编辑器窗口（2026-10-10）**：`docs/guides/test-profile.md` 的「启动」命令带 `--new-window`，不再带 `--agents`。不带 `--new-window` 时，测试配置会恢复上次的 Agents 窗口。
- **编辑器壳标题行（2026-10-10）**：Conversation 的 Hide、会话条和透镜条改为 28px，命中区 24px，与 Preview 类别条同高。当前类别没有编辑器时，不另画「Preview: Group N」占位行，拆分、隐藏和关闭组收到类别条右侧。
