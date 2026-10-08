---
title: "审查 r03：agent-host"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "四条，最重为中：未就绪的 branch changeset 会挡住 session 变更计数，列表芯片为空。"
---

## r03-1 中
- 症状：branch changeset 仍是 computing、session changeset 已经 ready 时，未打开会话的列表芯片没有变更计数。
- 位置：`src/vs/platform/agentHost/node/agentHostChangesetService.ts` 第 328–334 行
- 引用：`getChangesetState(buildBranchChangesetUri(sessionUri)) ?? this._stateManager.getChangesetState(buildSessionChangesetUri(sessionUri))`
- 为什么是问题：`register` 写入的初始状态是 `{ status: Computing, files: [] }`（`agentHostChangesetStateCache.ts` 第 89 行），对象本身为真。`??` 因此停在 branch 上。`computeChangesSummaryFromLiveState` 只在 `status === Ready` 时汇总（第 129 行），computing 得到的是 undefined。非 git 目录上 branch 计算走「git diff 不可用则保持原状态」（第 1241–1259 行），而 `_restoreStaticChangesetStatus` 在状态已是 Computing 时直接返回（第 1368–1369 行），branch 一直停在 computing。session 计算才会落到 edit tracker 并变成 Ready，summary 又只在 branch 成功路径写入。session 已 Ready 时 `getListMetadataKeys` 只请求 summary 键（第 272–273 行），diff blob 不在这次 metadata 里，芯片为空。
- 方向：branch 处于 Ready 才用它的文件列表，否则改用 Ready 的 session changeset。

## r03-2 中
- 症状：进程重启后，只存了 session diff blob 的未打开会话列表芯片没有计数。
- 位置：`src/vs/platform/agentHost/node/agentHostChangesetService.ts` 第 338–353 行
- 引用：`parsePersistedStaticChangesets(sessionUri, { branchRaw, legacyRaw })`；`restored.branch ?? restored.session`
- 为什么是问题：session 计算持久化的键是 `META_CHANGESET_SESSION`（`persistKeyFor` 第 71–74 行，写入在第 1308 行）。legacy `diffs` 只在 branch 成功时覆盖（第 1310–1314 行）。这次 parse 没有传入 session 键；`sessionRaw` 缺省时 `restored.session` 只等于 legacy blob（第 231–232 行）。branch 与 legacy 都缺时第 340–341 行直接返回，新增的 `?? restored.session` 走不到。非 git 会话重启后内存里的 changeset 没了，磁盘上只剩 session blob，芯片为空。
- 方向：把 `metadata[META_CHANGESET_SESSION]` 作为 `sessionRaw` 传入，仅有这份 blob 时也汇总出芯片计数。

## r03-3 低
- 症状：同一文件的两条 diff 被断言成正确快照，按 id 去重会让这条测试失败。
- 位置：`src/vs/platform/agentHost/test/node/agentHostChangesetService.test.ts` 第 244–252 行
- 引用：`{ id: 'file:///wd/a.ts', diff: { added: 100, removed: 50 } }, { id: 'file:///wd/a.ts', diff: { added: 3, removed: 1 } }`
- 为什么是问题：用例输入里 `file:///wd/a.ts` 出现两次。`_publishChangesetDiffs` 对每条有 uri 的 edit 直接 `files.push`（第 1402–1417 行），快照里留下两条相同 id。断言要求这两条都在，变更列表会把同一文件显示两次；这些文件若再进 `summariseDiffs`，`files: diffs.length`（第 105 行）会把同一文件算两遍。
- 方向：断言同一 id 只保留一条，后一次 diff 覆盖前一次；没有 uri 的条目仍然丢弃。

## r03-4 低
- 症状：名为走活代理的测试由 fetch 替身自己调用 bridge，代理转发断开时仍然通过。
- 位置：`src/vs/platform/agentHost/test/node/copilotSessionLauncher.test.ts` 第 242–253 行
- 引用：`await connection?.chat({ vendor: 'acme', modelId: body.model, input: body.input })`
- 为什么是问题：`resolveByokSessionConfig` 收到的是手写 `mockHandle`（第 235–239、262 行）。测试把 `globalThis.fetch` 换成替身，替身再调用 `registry.getServingConnection().chat`，并把 `vendor` 写成 `'acme'`。第 278 行 `captured?.vendor === 'acme'` 由这个替身满足，请求没有经过 `ByokLmProxyService`。代理不再把 `/responses` 转到 bridge 时，这条测试仍然通过。
- 方向：用真实 proxy 的 `start()` 提供 handle，让 `fetch` 打到代理，由代理调用 bridge。
