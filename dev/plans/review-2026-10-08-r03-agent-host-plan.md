---
title: "方案 r03：agent-host"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 4，drop 0，weaken 0。未就绪的 branch 不挡住 Ready 的 session 计数，冷列表读已有 session blob。不升 implemented，不升 PRD。"
---
# 方案 r03：agent-host

状态：执行中。
覆盖需求：无（正文未引用需求编号）。


hold 4，drop 0，weaken 0。

## r03-1（hold，中）

问题类：branch changeset 仍是 Computing 时，列表芯片不会改用已经 Ready 的 session changeset，计数为空。

不变量：未打开会话先用已持久化的 `META_CHANGES_SUMMARY`。没有这份合计时，只有 `status === Ready` 的 branch changeset 提供活文件列表；branch 缺失、仍是 Computing 或是 Error 时，改用 Ready 的 session changeset。Ready 的 branch 即使文件列表为空也优先于 session。两边都不是 Ready 时，继续走持久化 blob。多文件夹已经写入的全目录合计不被 primary-only 的 session 文件覆盖。

要动的符号或文件：`AgentHostChangesetService.computeListEntryChanges`（`src/vs/platform/agentHost/node/agentHostChangesetService.ts`）。选择活状态时先看 `ChangesetStatus.Ready`，再调用现有的 `computeChangesSummaryFromLiveState`。`getChangesetState(buildBranchChangesetUri(...)) ?? getChangesetState(buildSessionChangesetUri(...))` 不再把 Computing 对象当成可用来源。

怎么改：branch 状态对象存在但不是 Ready 时，不要停在它上面。改成「Ready 的 branch，否则 Ready 的 session」。选出的 Ready 状态仍交给 `computeChangesSummaryFromLiveState`；得到合计后仍调用 `persistChangesSummary`。`META_CHANGES_SUMMARY` 的解析保持在这次选择之前返回。

明确不改：不改 `getListMetadataKeys` 在 session changeset 已 Ready 时只请求 `CHANGES_SUMMARY_METADATA_KEYS` 的决定。不改 `_tryComputeGitDiffs` 对非 git 返回空、branch 计算因此走保留路径这件事，也不让 branch 计算落入 edit tracker。不改多文件夹在 git diff 不可用时仍调用 `_updateMultiFolderChangesSummary`。不改 `_restoreStaticChangesetStatus` 对 Computing 直接返回。不改 `register` / `registerChangeset` 的 Computing 初值。

怎样本地验证：`scripts/test.sh --grep "all-folder chip survives idle eviction|single-folder summary stays branch-derived"`。这两条现有测试保持通过：`all-folder chip survives idle eviction (evicted-but-warm): not clobbered to primary-only`、`single-folder summary stays branch-derived (characterization: byte-for-byte unchanged)`。在 `src/vs/platform/agentHost/test/node/agentHostChangesetService.test.ts` 新增断言：会话状态已不在，branch changeset 停在 Computing，session changeset 为 Ready 且带有文件，metadata 里没有 `META_CHANGES_SUMMARY`、branch blob 和 legacy blob；`computeListEntryChanges` 返回 session 文件的合计。同一测试再断言 Ready 的 branch 优先于另一份 Ready 的 session，以及 metadata 里已有的 `META_CHANGES_SUMMARY` 优先于两边的活状态。

## r03-2（hold，中）

问题类：进程重启后，只持久化了 session diff blob 的未打开会话，列表芯片读不到计数。

不变量：冷列表在 branch blob、session blob、legacy blob 三者都缺时才返回无计数。只有 `META_CHANGESET_SESSION` 时，芯片等于这份 blob 的合计，并写回 `META_CHANGES_SUMMARY`。branch blob 仍优先于 session blob。未提供 session blob 时，legacy `diffs` 仍只作为 session 的回退。打开会话的恢复路径继续同时读三份键。

要动的符号或文件：`AgentHostChangesetService.computeListEntryChanges` 里读取 `metadata[META_CHANGESET_BRANCH]`、`metadata[META_LEGACY_DIFFS]` 并调用 `parsePersistedStaticChangesets` 的那一段（`src/vs/platform/agentHost/node/agentHostChangesetService.ts`）。把 `metadata[META_CHANGESET_SESSION]` 作为 `sessionRaw` 传入。常量 `META_CHANGESET_SESSION` 已在 `src/vs/platform/agentHost/common/agentHostChangesetService.ts`。

怎么改：提前返回的条件改成 branch、session、legacy 三份原始值都是 `undefined`。解析时传入 `{ branchRaw, sessionRaw, legacyRaw }`。合计仍用 `computeChangesSummaryFromPersistedDiffs(restored.branch ?? restored.session)`，成功后仍 `persistChangesSummary`。

明确不改：不改 `parsePersistedStaticChangesets` 里 `sessionRaw` 缺省时回退 legacy 的顺序。不改 `persistKeyFor`，session 计算仍写 `META_CHANGESET_SESSION`。不在 session 计算成功时覆写 `META_LEGACY_DIFFS`；legacy 仍只在 branch 成功路径写入。不改 `ChangesetSessionCoordinator.onSessionRestored`，它已经把 `sessionRaw` 传进去。不改 `CHANGESET_DB_METADATA_KEYS`，冷会话本来就会读到 session 键。

怎样本地验证：在 `src/vs/platform/agentHost/test/node/agentHostChangesetService.test.ts` 新增断言：没有活的会话状态和 changeset 状态，metadata 只有 `META_CHANGESET_SESSION` 一份 diff JSON，没有 branch、legacy 和 summary。`computeListEntryChanges` 返回该 blob 的 additions、deletions 与文件数，并把同一合计写入 `META_CHANGES_SUMMARY`。再断言 branch blob 与 session blob 同时存在时采用 branch 的合计；三份键都缺时返回 `undefined`。

## r03-3（hold，低）

问题类：`_publishChangesetDiffs` 把同一文件 id 的两条 diff 都留下，测试把这个重复快照断言成正确结果。

不变量：同一个 changeset 里，`after.uri` 或否则 `before.uri` 相同的条目只留一条，后一次整条 diff 覆盖前一次，不把 added/removed 相加。没有 uri 的条目仍然丢弃。目录 `changesets` 仍由 `buildDefaultChangesetCatalog` 决定，不从文件条数推导。

要动的符号或文件：`AgentHostChangesetService._publishChangesetDiffs`（`src/vs/platform/agentHost/node/agentHostChangesetService.ts`），以及 `src/vs/platform/agentHost/test/node/agentHostChangesetService.test.ts` 的 `restoreStaticChangeset catalogue counts only emitted unique files`。

怎么改：在组装 `files` 时按上述 id 覆盖，再把覆盖后的列表交给 `ChangesetContentChanged`。测试期望改为只保留后一次 `file:///wd/a.ts`（added 3、removed 1）和 `file:///wd/b.ts`（added 1、removed 0）。无 uri 的那条（added 20、removed 10）仍不出现。

明确不改：不改 `dedupeSessionFileDiffs` 的先到先得，也不在这里调用它；多根 turn 合并仍是 git 源优先于 edit tracker。不改 changeset reducer 对 `ChangesetContentChanged` 整表替换的行为。不改 `summariseDiffs` 用 `diffs.length` 计数的公式。不改已经只期望 `a.ts` 与 `b.ts` 各一条的 `restoreStaticChangeset` 测试。

怎样本地验证：`scripts/test.sh --grep "restoreStaticChangeset catalogue counts only emitted unique files"`。该测试断言快照里 `file:///wd/a.ts` 只有一条且 diff 为 added 3、removed 1，`file:///wd/b.ts` 仍在，无 uri 的条目不在，`catalogue` 仍等于 `buildDefaultChangesetCatalog` 的结果。按发布后的文件列表做合计时，文件数是 2，而不是把同一 id 算成 3。

## r03-4（hold，低）

问题类：名为走活代理的测试用 fetch 替身自己调用 bridge，代理不再转发时这条测试仍然通过。

不变量：`resolveByokSessionConfig` 拿到的 handle 来自 `ByokLmProxyService.start()`。测试对合成出的 `provider.baseUrl + /responses` 发起的 `fetch` 打到这个代理，由代理从 `/v/<vendor>/responses` 解析 vendor 并调用 bridge。`captured.vendor` 不得由测试替身写死。

要动的符号或文件：`src/vs/platform/agentHost/test/node/copilotSessionLauncher.test.ts` 的 `synthesized provider config routes through a live proxy to the bridge`。`startProxy` 改为真实的 `ByokLmProxyService.start`。去掉该测试里替换 `globalThis.fetch`、以及替身里 `connection.chat({ vendor: 'acme', ... })` 的写法。生产侧符号保持 `resolveByokSessionConfig` 与 `ByokLmProxyService._handleResponses` 不动。

怎么改：用 `ByokLmProxyService` 的 `start()` 提供 handle，让 `resolveByokSessionConfig` 把 `providerBaseUrl` 和 `nonce` 写进会话配置。测试再向该 baseUrl 的 `/responses` 发送带 `Bearer <nonce>.<sessionId>` 的请求。bridge 的 `chat` 只负责记录代理交来的请求。端口使用代理实际绑定的地址，不再写死 `127.0.0.1:1`。套件注释里「最后这条测试对活的 ByokLmProxyService 发 POST」与该测试正文对齐。

明确不改：不改 `ByokLmProxyService` 的路由、鉴权和 SSE 转发。不改同文件里用 `countingProxy` 且注释已说明不用真代理的其它 `resolveByokSessionConfig` 测试。不改 `src/vs/platform/agentHost/test/node/byokLmProxyService.test.ts` 的 `forwards a Responses request to the bridge and returns JSON by default`，那条继续单独覆盖代理转发。

怎样本地验证：`scripts/test.sh --grep "synthesized provider config routes through a live proxy to the bridge|forwards a Responses request to the bridge and returns JSON by default"`。前者不再替换 `globalThis.fetch`；`captured.vendor` 为 `acme`、`captured.modelId` 为 `claude`，且响应正文含 `hello from byok`。代理若不再调用 bridge 的 `chat`，前者失败。后者保持通过。
