---
title: "Sources 文件列表按广告探测"
type: plan
status: draft
phase: N/A
updated: 2026-10-05
summary: "Sources 文件列表的 listFiles 门闩改读连接快照 listFilesCapability。不进 Engine Overview。不重做 conversationEntryCapability 与 gitWriteCapability。稿仍 draft。不升 PRD。不宣布 ELR-13 全部完成。"
---

# Sources 文件列表按广告探测

桌面 `ProxyChannel` 让 `IUniverseAgentConnection` 上每个属性都是函数。`typeof listFiles === 'function'` 在生产里恒真，引擎没广告 `FileService.ListFiles` 时，Sources 文件列表仍会走引擎。`conversationEntryCapability` 与 `gitWriteCapability` 已落地，不重做，也不改回 `typeof`。本刀只改文件列表这一项，不宣布 ELR-13 全部完成。

不把 `listFiles` 加进 `UniverseAgentCapabilityKey`。Engine Overview 按该键画行。做法对齐 `gitWriteCapability`：连接快照专用字段 `listFilesCapability`，三态，不带 reason。不把可选方法改成必需，不重写 `IUniverseAgentConnection`。

## 合同

- 探测 `FileService.ListFiles`。`FileService.*` 算广告到这个方法。未广告为 `UNSUPPORTED`，不调用 `probeRpc`。广告后 `probeRpc` 返回 `UNIMPLEMENTED` 仍是 `UNSUPPORTED`；`OK` 为 `SUPPORTED`；其它状态为 `UNKNOWN`。
- 四条提交路径（旧 `connect`、明文拨号 `_dialPlain`、设备鉴权拨号 `_dialDeviceAuth`、本机跳过鉴权 `_connectLocalSkipAuth`）都在与 `probeConversationEntryCapability` 相同的「探测后仍拥有这次拨号」闸之后写入，经 `_applyConnectedCommit`。`disconnect` 与丢掉已发布 transport 时回到 `UNKNOWN`。
- 渲染端 `UniverseAgentConnectionSyncCache.applySnapshot` 显式拷贝该字段。缺字段或非法值当成 `UNKNOWN`。不把 `sessionToken` 带进缓存。
- Web 桩为 `UNSUPPORTED`。
- `sourcesFilesList.ts` 与 `sourcesFilesExplorer.ts` 用同一个 `sourcesFilesListHookPresent`：`UNSUPPORTED` 不走引擎列表，即使方法是函数；`SUPPORTED` 走；`UNKNOWN` 或没有该字段时仍看方法是否安装。调用前方法不是函数则不发 RPC。

## 不做什么

- 不改 `conversationEntryCapability`，不改 `gitWriteCapability`，不改 Sources 的 Stage / Commit / Accept，不改 `readGitSummary` / `readGitFileDiff` 的 `typeof`。
- 不改 Hooks / Rules / Provider 列表上的 `typeof`。
- 不改 Preview 编辑器组，不删 `connect()`，不写 ADR，不升 PRD。不改 `dev/loop/**`、`status.md`、`deferred-gaps.md`、`engine-protocol-surface.md`。

## 验证

- `grpcCapabilityProbe.test.ts`：只广告别的方法时 `listFilesCapability` 为 `UNSUPPORTED` 且不探测 `ListFiles`；`FileService.ListFiles` 探成 `UNIMPLEMENTED` 时为 `UNSUPPORTED`；`FileService.*` 且探测 OK 时为 `SUPPORTED`；其它状态为 `UNKNOWN`。能力键里没有 `listFiles`。
- `universeAgentConnection.test.ts`：`connect` 后快照带上述结果，能力键里没有 `listFiles`；未广告的 `ListFiles` 不在探测列表里；`disconnect` 后为 `UNKNOWN`。
- `universeAgentRendererSync.test.ts`：`sourcesFilesListHookPresent` 在 `UNSUPPORTED` 时忽略函数；缺字段为 `UNKNOWN` 仍看方法；缓存读到专用字段，非法值当成 `UNKNOWN`。
- `sourcesFilesList.test.ts`：快照把 `listFilesCapability` 标成 `UNSUPPORTED` 时，方法虽是函数也不发 `listFiles`，改走工作区搜索。

命令：

- Node：`node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/grpcCapabilityProbe.test.ts --run src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts --run src/vs/platform/universeAgent/test/common/universeAgentRendererSync.test.ts`
- Electron：`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --grep "sources files list capability|UNSUPPORTED listFiles" --run src/vs/workbench/contrib/sources/test/browser/sourcesFilesList.test.ts --run src/vs/platform/universeAgent/test/common/universeAgentRendererSync.test.ts`

## 只读自审

- 不把 `listFiles` 塞进 `UniverseAgentCapabilityKey`，避免 Overview 多一行。
- `UNKNOWN` 回退到方法是否安装，已有文件列表单测不填该字段仍走今天的 hook。
- 探测失败（非 OK、非 UNIMPLEMENTED）停在 `UNKNOWN`，不把网络错误画成「引擎没有这个 RPC」。
- `SUPPORTED` 仍要在调用前确认方法是函数，避免快照与替身不一致时发出 RPC。
- 本刀不覆盖 `readGitSummary` / `readGitFileDiff` 与 Hooks / Rules / Provider，ELR-13 仍有剩余 `typeof` 门闩。
