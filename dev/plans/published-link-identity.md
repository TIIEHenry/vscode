---
title: "已发布链路的引擎身份"
type: plan
status: draft
phase: N/A
updated: 2026-10-05
summary: "ELR-8：连接快照增加可选 engineIdentityId 与 linkId。换链路时 SessionViewHost 先断开再连，roster 按引擎身份分桶。全应用仍是一条连接。稿仍 draft。不升 PRD。不改 ADR-003 正文。"
---

# 已发布链路的引擎身份

审查 [ELR-8](../progress/engine-link-architecture-review-2026-09-28.md) 写的是：连接快照看不出当前是哪一台引擎。换 profile 时 `SessionViewHost` 没有「先断开」的边沿，会把引擎 A 的 session id 拿到引擎 B 上 `Resume`。`conversation.roster.v1` 的 `engineCache` 也没有引擎键。

全应用仍是 main 进程里的一条 `IUniverseAgentConnection`。不改成按窗口各连一台。这条不变量写在本稿，不改已签收的 [ADR-003](../decisions/003-engine-adapter-boundary.md) 正文（Decision 3 仍是一窗一 session）。ADR 等签收。

## 合同

快照增加两个可选字段。没有就缺省，不把上一台引擎的值留下，也不把 `sessionToken` 放回快照。

- `engineIdentityId`：当前已提交链路的引擎身份。设备鉴权拨号用握手核对过的 profile trust。明文拨号只在 profile 已有 trust 时带上同一字段。旧 `connect()` 与本机跳过鉴权没有身份，缺省。
- `linkId`：已发布链路的单调正整数。`_applyConnectedCommit` 在换了 transport、换了 profile、身份变了，或上一份已发布链路已经清掉时加一。同一 transport、同一 profile、同一身份再次提交不加。只改相位（含传输失败后的 `connecting` / `transport_lost`）不加。`disconnect`、丢掉已发布 transport、dispose 都清掉这两个字段。

渲染端 `UniverseAgentConnectionSyncCache.applySnapshot` 显式拷贝。空身份、非正整数或非安全整数的 `linkId` 当成缺省。下一份快照缺字段时不得沿用上一份。

身份或 `linkId` 相对 `SessionViewHost` 上一次看到的已发布快照发生变化时，先按断开处理：停掉旧流，给已有 lease 送 `connectionDown`。然后再看新快照。仍连接才按新快照 `connectionUp`。配对未完成的快照只断开，不在配对中重新绑定。

session id 缓存：

- 新快照的身份与缓存所属身份不同时，先清掉 `engineSessionByLocal`，不得 `Resume` 旧引擎的 session id。这包括「有身份 → 另一身份」「有身份 → 身份缺省的已连接链路」「身份缺省 → 有身份」。
- 身份相同（两边都是同一个非空 id）时，链路代号变了仍先停流，但保留 session id，允许在同一台引擎上 `Resume`。
- 两边都没有身份时，沿用「身份未知」这一份缓存，不把它写进任何有身份的桶。
- 只改相位、代号和身份都没变时，不额外制造断开边沿。

roster 的 `engineCache` 仍是无键遗留，只表示身份未知。新增 `engineCaches`，键是 `engineIdentityId`。

- 快照有身份：只读、只写该键。不得读无键遗留，不得读或覆盖别的键。
- 快照没有身份：只读、只写无键遗留。不得读出任何有身份的桶，也不得把这份缓存写进别人的桶。
- 身份相对 roster 当前桶发生变化时，先把内存里的引擎会话写回旧桶，再换桶。连上 B 时不得把 A 的会话当成 B 的会话。

## 不做什么

- 不按窗口连接，不删除 `connect()`，不改 `listFilesCapability`、`conversationEntryCapability`、`gitWriteCapability` 的合同，不改 Preview 组显隐。
- 不改 ADR-003 正文，不升 PRD。
- 不改 `dev/loop/**`、`status.md`、`deferred-gaps.md`、`engine-protocol-surface.md`。

## 验证

- 换 profile 后快照的 `linkId` 变了，`engineIdentityId` 是新的；相位变成 `connecting` 时代号和身份不变；断开后两个字段都不在快照上。切换过程中的快照不得仍带着上一台的身份。
- `SessionViewHost` 在身份变化时先停掉旧流，再绑定；不会 `Resume` 旧引擎的 session id。同一身份只换代号时仍可 `Resume` 该引擎上一次的 session id。
- roster 按身份读写。已连上的身份不会显示无键遗留或另一台引擎的桶；写回时不覆盖别的桶。

命令：

- Node：`node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts --run src/vs/platform/universeAgent/test/node/sessionViewHostEngineBind.test.ts --run src/vs/platform/universeAgent/test/common/universeAgentRendererSync.test.ts`
- Electron：`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --grep "engine cache buckets" --run src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts`
- 编译只走槽 B：`flock /tmp/vscode-loop-compile.lock npm run compile-client`。锁被占用时不抢。

## 只读自审

- 不把连接改成按窗口。快照字段是可选的，旧替身不填时行为与今天的布尔连接边沿一致。
- 同一引擎断开再连会换 `linkId`，但身份相同，session id 仍可恢复。这不是把 A 的 id 拿到 B 上。
- 无身份链路与有身份链路不共用 session id，也不共用 roster 桶。
- 本刀由实施任务要求同轮落代码。方案保持 draft，不标成可签收，不改 ADR-003。
