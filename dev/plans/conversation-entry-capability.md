---
title: "对话入口按广告探测"
type: plan
status: draft
phase: N/A
updated: 2026-10-05
summary: "对话里用 typeof 连接方法决定列表、按钮或选择器是否存在的门闩，改读连接快照 conversationEntryCapability。不进 Engine Overview。不重做 gitWriteCapability。稿仍 draft。不升 PRD。"
---

# 对话入口按广告探测

桌面 `ProxyChannel` 让 `IUniverseAgentConnection` 上每个属性都是函数。`typeof listClipboard === 'function'` 在生产里恒真，引擎没广告或探测为 `UNIMPLEMENTED` 时，Clipboard / Triggers / Context / Snapshots 列表、设备配对动作、插件详情、MCP 工具、会话目标、权限模式和模型切换仍会露出入口。写按钮里已经走能力键的（`writeClipboard`、`fireTrigger`、`readContextVariable`、`restoreSnapshot` 等）不动。`gitWriteCapability` 已落地，不重做，也不改回 `typeof`。

不把这些方法加进 `UniverseAgentCapabilityKey`。Engine Overview 按该键画行。做法对齐 `gitWriteCapability`：连接快照专用字段 `conversationEntryCapability`。不把 158 个可选方法改成必需，不重写 `IUniverseAgentConnection`。

## 合同

- 字段（三态，各自探测）：`listClipboard`（`ClipboardService.List`）、`listTriggers`（`TriggerService.ListTriggers`）、`listContextVariable`（`ContextVariableService.List`）、`listSnapshots`（`AgentService.ListSnapshots`）、`listDevices` / `listPending` / `pairApprove` / `pairReject` / `rotateToken` / `revoke`（`DeviceService` 同名方法）、`getPluginInfo`（`PluginService.Info`）、`getMcpServerTools`（`McpService.GetMcpServerTools`）、`setSessionGoal` / `setPermissionMode`（`PermissionService` 同名方法）、`switchModel`（`ConfigService.SwitchModel`）。`FooService.*` 算广告到该服务上的这些方法。未广告为 `UNSUPPORTED`，不调用 `probeRpc`。广告后 `probeRpc` 返回 `UNIMPLEMENTED` 仍是 `UNSUPPORTED`；`OK` 为 `SUPPORTED`；其它状态为 `UNKNOWN`。一条未实现不连坐另外几条。
- `switchAgent` 没有握手方法名，也不在连接接口上。探测不发 `probeRpc`，提交后记 `UNSUPPORTED`。缺字段或 `UNKNOWN` 时仍看替身是否安装了该方法。
- 四条提交路径（旧 `connect`、明文拨号、设备鉴权拨号、本机跳过鉴权）都在与 `probeGitWriteCapability` 相同的「探测后仍拥有这次拨号」闸之后写入。`disconnect` 与丢掉已发布 transport 时整表回到 `UNKNOWN`。
- 渲染端 `UniverseAgentConnectionSyncCache.applySnapshot` 显式拷贝该字段。缺字段或非法值当成 `UNKNOWN`。不把 `sessionToken` 带进缓存。
- Web 桩整表为 `UNSUPPORTED`。
- 对话入口用 `conversationEntryHookPresent`：`UNSUPPORTED` 没有入口，即使方法是函数；`SUPPORTED` 有入口；`UNKNOWN` 或没有该字段时仍看方法是否安装。调用前若方法不是函数，仍不发出 RPC。
- 改这些生产门闩：Clipboard / Triggers / Context 的列表、Snapshots 的 `listSnapshots`、Connection 面板的设备列表与批准 / 拒绝 / 轮换 / 吊销、插件 `getPluginInfo`、MCP `getMcpServerTools`、Inbox `setSessionGoal`、作曲栏权限模式与模型切换与 `switchAgent`。

## 不做什么

- 不改 `gitWriteCapability`，不改 Sources 的 Stage / Commit / Accept，不改 `readGitSummary` / `readGitFileDiff` / `listFiles` 的 `typeof`。
- 不改 Hooks / Rules / Provider 列表上的 `typeof`。这三处已经先按 Overview 能力键关掉 `UNSUPPORTED`，`typeof` 只是该键不是 `UNSUPPORTED` 时的方法安装退路。
- 不改 `probeEngine()`。那是客户端探测，不是 Connect 广告的 RPC。
- 不改 Preview 编辑器组，不删 `connect()`，不做 ELR-14，不写 ADR，不升 PRD。不改 `dev/loop/**`、`status.md`、`deferred-gaps.md`。

## 验证

- `grpcCapabilityProbe.test.ts`：只广告别的方法时本表为 `UNSUPPORTED` 且不探测这些方法；`ClipboardService.List` 探成 `UNIMPLEMENTED` 时仅 `listClipboard` 为 `UNSUPPORTED`；`DeviceService.*` 且探测 OK 时设备六项为 `SUPPORTED`；`switchAgent` 不发 `probeRpc` 且为 `UNSUPPORTED`。
- `universeAgentConnection.test.ts`：`connect` 后快照带上述结果，能力键里没有 `listClipboard`；未广告的 `ListTriggers` 不在探测列表里；`disconnect` 后为 `UNKNOWN`。
- `universeAgentRendererSync.test.ts`：`conversationEntryHookPresent` 在 `UNSUPPORTED` 时忽略函数；缺字段为 `UNKNOWN` 仍看方法；缓存读到专用字段，非法值当成 `UNKNOWN`。
- `engineClipboardSection.test.ts`：快照把 `listClipboard` 标成 `UNSUPPORTED` 时，方法虽是函数也不发 List，状态为 unsupported。
- `conversationEntryCapability.test.ts`：权限 / 模型 / `switchAgent` 在 `UNSUPPORTED` 时没有入口；缺字段时仍看方法是否安装。

命令：

- Node：`node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/grpcCapabilityProbe.test.ts --run src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts --run src/vs/platform/universeAgent/test/common/universeAgentRendererSync.test.ts`
- Electron：`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --grep "conversation entry capability|UNSUPPORTED clipboard list" --run src/vs/workbench/contrib/conversation/test/browser/conversationEntryCapability.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineClipboardSection.test.ts --run src/vs/platform/universeAgent/test/common/universeAgentRendererSync.test.ts`

## 只读自审

- 不把这些键塞进 `UniverseAgentCapabilityKey`，避免 Overview 多行。
- `UNKNOWN` 回退到方法是否安装，已有对话单测不填该字段仍走今天的 hook。
- 探测失败（非 OK、非 UNIMPLEMENTED）停在 `UNKNOWN`，不把网络错误画成「引擎没有这个 RPC」。
- `switchAgent` 没有协议方法，连接成功后入口关闭；替身不填字段时行为与今天相同。
