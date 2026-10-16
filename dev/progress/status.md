---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-10-16
summary: "2026-10-16：多工位并行合入 S1–S4 会话工作根、Slot F 能力复位、Slot D 视觉与边界、Slot B MCP/触发器、Slot A Composer 代理选择器、Slot B 盘符与文件变更计数、Slot D 零值统计、Slot F 会话隔离 Diff URI；第二批合入 Slot F ProjectRule 全局探测 (G16/B3)、Slot D 会话工作根完整收口 (G5/S2)、Slot B Tools/Agents 工作根跟随与 Triggers 门禁完善 (B3, G15, G16)。10012 文件 transpile-client 0 错误，测试全绿。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。2026-09-30 会话流水 → [归档](../archive/status-current-session-2026-09-30.md) · 2026-10-05 归档 → [归档](../archive/status-current-session-2026-10-05.md) · Wave 28 → [归档](../archive/status-wave-28-2026-10-13.md) · Wave 29 → [归档](../archive/status-wave-29-2026-10-16.md)。
## Current Session
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
