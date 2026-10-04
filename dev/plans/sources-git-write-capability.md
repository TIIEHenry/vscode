---
title: "Sources Git 写能力按广告探测"
type: plan
status: draft
phase: N/A
updated: 2026-10-05
summary: "Stage / Commit / Accept 不再把桌面代理上的函数当成引擎已提供 WriteGit*。三项写能力跟 sessionList 一样放在连接快照专用字段，不进 Engine Overview。稿仍 draft。不升 PRD-009。"
---

# Sources Git 写能力按广告探测

桌面 `ProxyChannel` 让 `IUniverseAgentConnection` 上每个方法都是函数。`typeof writeGitStagePaths === 'function'` 在生产里恒真，引擎没广告或探测为 `UNIMPLEMENTED` 时，Changes 的 Stage / Commit 和 Diff 的 Accept 仍会走引擎写。读路径 `readGitChanges` 已经用能力快照；写路径没有。

不把这三项加进 `UniverseAgentCapabilityKey`。Engine Overview 按该键画行。做法对齐 `sessionListCapability`：连接快照专用字段 `gitWriteCapability`。

## 合同

- 探测 `GitService.WriteGitStagePaths`、`GitService.WriteGitCommit`、`GitService.WriteGitApplyHunks`。`GitService.*` 算广告到这三个方法。未广告为 `UNSUPPORTED`，不调用 `probeRpc`。广告后 `probeRpc` 返回 `UNIMPLEMENTED` 仍是 `UNSUPPORTED`；`OK` 为 `SUPPORTED`；其它状态为 `UNKNOWN`。三条各自探测，一条未实现不连坐另外两条。
- 四条提交路径（旧 `connect`、明文拨号、设备鉴权拨号、本机跳过鉴权）都在与 `probeSessionListCapability` 相同的「探测后仍拥有这次拨号」闸之后写入。`disconnect` 与丢掉已发布 transport 时三项回到 `UNKNOWN`。
- 渲染端 `UniverseAgentConnectionSyncCache.applySnapshot` 显式拷贝该字段。缺字段或非法值当成 `UNKNOWN`。不把 `sessionToken` 带进缓存。
- Web 桩三项为 `UNSUPPORTED`。
- Sources 的 Stage、Commit、Accept 用 `sourcesGitWriteHookPresent`：`UNSUPPORTED` 没有 hook；`SUPPORTED` 有 hook；`UNKNOWN` 或没有该字段时仍看方法是否安装，单测替身不用填快照。
- 不新增 RPC，不改引擎仓，不改 `SaveSkillContent` 的 JSON 编码。不改 `readGitSummary` / `readGitFileDiff` / `listFiles` 的 `typeof` 判断。不改对话目录。

## 验证

- `grpcCapabilityProbe.test.ts`：只广告 `ReadGitChanges` 时三项写为 `UNSUPPORTED` 且不探测写方法；`GitService.*` 且探测 OK 时三项 `SUPPORTED`；只把 `WriteGitStagePaths` 探成 `UNIMPLEMENTED` 时仅该项 `UNSUPPORTED`。
- `universeAgentConnection.test.ts`：`connect` 后快照带上述结果，能力键里没有 `writeGitStagePaths`；`disconnect` 后为 `UNKNOWN`。
- `universeAgentRendererSync.test.ts`：缓存读到专用字段；缺字段为 `UNKNOWN`。
- `sourcesChangesGitWrite.test.ts`：`UNSUPPORTED` 即使方法是函数也没有 hook；`UNKNOWN` 仍看方法。
- `sourcesChangesList.test.ts`：代理上有 `writeGitStagePaths` / `writeGitCommit`，快照写能力为 `UNSUPPORTED` 时 `canWriteStage` / `canWriteCommit` 为 false。

命令：

- Node（`universeAgentConnection.test.ts` 在 Electron 里属 D17，动态 import 失败后被跳过，断言不会跑到）：`node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/grpcCapabilityProbe.test.ts --run src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts --run src/vs/platform/universeAgent/test/common/universeAgentRendererSync.test.ts`
- Electron 只跑本切片的浏览器与 common 文件：`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --grep "git write capability|sourcesGitWriteHookPresent|UNSUPPORTED git write" --run src/vs/workbench/contrib/sources/test/browser/sourcesChangesGitWrite.test.ts --run src/vs/workbench/contrib/sources/test/browser/sourcesChangesList.test.ts --run src/vs/platform/universeAgent/test/common/universeAgentRendererSync.test.ts`

## 只读自审

- 不把写能力塞进 `UniverseAgentCapabilityKey`，避免 Overview 多行，也避免改 `contrib/conversation` 的能力夹具。
- `UNKNOWN` 回退到方法是否安装，已有 Sources 单测不填该字段仍走今天的 hook。
- 探测失败（非 OK、非 UNIMPLEMENTED）停在 `UNKNOWN`，不把网络错误画成「引擎没有这个 RPC」。
