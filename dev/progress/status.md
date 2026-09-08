---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-08
summary: "D16 / D31 F4 仍开。官方三域 glob 已绿。D44–D90 / D92–D119 已闭。通知 acquire throw 已吞；Enqueue 断连+history 可点出 engine_disconnected。A2 仍 blocked。"
---

# Development Progress
> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)（生成列）；方案状态 → [plans INDEX](../plans/INDEX.md)（生成列）；延期 → [deferred-gaps](deferred-gaps.md)。历史槽位 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session

### 已合入（集成基线 `c1b228caf74`，已 push `origin/agent-ide`）
| 切片 | 提交 / 落点 |
|:-----|:------------|
| **GFS-1** | `32f71812` / `32198d0b` — [giant-file-split](../plans/giant-file-split.md)：`grpcClient` mapper 特征测 + facade / mappers / calls 拆分 |
| **GFS-2** | `78bc8bbc` — timeline types / renderer / 门面 |
| **GFS-3** | `c5d791c7` — `conversationLens` 拆 projection / sessionBar / dock / composer / composerChrome |
| **GFS-3 residue** | `533fc6c42d5` — `conversationLensReadingColumn.ts` + `conversationLensSessionBinding.ts`；门面 `conversationLens.ts` **783** 行 |
| **Desktop G6** | `48cd90952` @ UniverseAgentDesktop `loop/merge` — 上游删四处 dead `SessionActor` private；vitest 1419 绿 |
| **GFS-4** | `a4ab1a3e754` — vendored session-core sync from Desktop `0dd3146cd`（PIN `0dd3146cd05efdcce118d0c3c7e19eb28b615f5c`）；`session-actor` 736 + stream 733 + overlay 288 + local-fact 659 + timeline-items 138 + chat-outbox 220 + fold-interface / production-source；均 ≤800；`sessionCore/index.ts` 不 re-export `SessionActor`；G6 四处 dead private 已不在 vendored 树 |
| **lens-assembly honesty** | `72ae9907` — [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) GFS-3 拆后同步 |
| **packaging P0** | `b2b91259` / `9b451a1f` — [packaging-and-release](../plans/packaging-and-release.md) §4.0–4.2 只读证实登记；证据见 [packaging-p0-evidence](packaging-p0-evidence.md) |
| **cross-repo D1** | `fb31d650` — [cross-repo-protocol](../plans/cross-repo-protocol.md) 登记处与 [deferred-gaps](deferred-gaps.md) D1 对齐 |
| **ADR-007 U0** | `1f5ce19a` — [upstream-min-patch.md](upstream-min-patch.md)（371 文件 A/B 清单、`comm` 完备性闸门） |
| **ADR-007 U1** | `1975a1b8ce1` — 只读 fetch + 祖先可用；候选 tag `1.136.0` @ `520fb30b`；详情见 [upstream-min-patch.md](upstream-min-patch.md) 文件头 |
| **docs-burden S1/S3–S5** | `f363f033` / `4cd542bc` / `623de9cf` / `222dd61c` — generate-docs-status、glossary、本文件重写、DOCUMENTATION 规则 7 |
| **agent-ide.yml** | `cc6bfd25` — [test-baseline-ci](../plans/test-baseline-ci.md) 切片 4：compile / eslint / docs-health / unit-custom 四 job |
| **gRPC catalog** | `123625c245b` — `UniverseAgentGrpcServices` 对齐 UA proto `package agentservice`（原 `universeagent.*.v1` 导致 Connect/`GetAuthNonce` UNIMPLEMENTED） |
| **workbench chrome** | `48dc0c5c95e` — Conversation 阅读列 layout / pre-first SessionBar；Navigator connecting 诚实空；Sources 空文案去实现注；Client enum 中文 labels |
| **HistoryFill** | `ed7faece0d6` — 宿主 `fillHistoryGap` 按 Actor `historyResult` 分页+demux；lease dispose-before-resolve 必 `releaseLease`；连接升降换帧源 |
| **first-send Active** | `b818fbf6bcf` 首条 pending 即离 PreFirst；未连不锁发送。相位切换后重测阅读列，PreFirst 不再 `layout(0)` monaco 树 |
| **inbox list XOR** | 切换 Task/Queue 时先关旧 `context-view` 再设 `openPanel`，避免 `aria-pressed` 被 onHide 清掉；透镜测 20ms flush 对齐帧合并，queue hold 后重开列表看 tag |
| **renderer IPC sync** | `UniverseAgentConnectionChannelClient` / Hub Client 缓存 phase·snapshot·profiles；状态栏按 `phase.kind` 开 Connection；Engine 节空能力矩阵不崩。未升 PRD-008（仍缺接通证据） |
| **handshake protobuf** | `GetAuthNonce` / DeviceAuth `Connect` 改 proto3 二进制。pane 内 SAS / recoverTrust 后状态栏 **`Engine · Direct`** 已复证。未升 PRD-008 |
| **session bind 波** | Create 写 `client_session_id` field 4；按 id 单飞；Channel Client 显式 `resumeSession`；roster 不再第二发 Create；ghost/bind 失败应显式占位。E2E（`bc1370cb05d`）：接通 PASS；引擎仍 0 Resume / Create `ALREADY_EXISTS`（空壳 `session_meta`）；UI 仍见 `New session`；无 Chat。见 [D26](deferred-gaps.md) |
| **UI 缺口收口波** | Navigator Team 删六个改引擎命令（PRD-022 验收 6）；Sources Diff 占位壳换真 `DiffEditorWidget`，revert/accept 双门控；对话列顶「断连前快照」（PRD-007 验收 5）；子代理浮层补「对话 \| 轨迹」两页（PRD-012 验收 1）；Inbox 右簇诚实空环；Permission 接 `SetPermissionMode`（失败回滚 + 门禁提示）；轨迹折叠点击跨刷新不失效。Mermaid 扩展 Promise 加 disposed 闸门（释放后渲染导致列表行泄漏）；轨迹检查器首段标题错用 Preview 改回 Summary |
| **settings chrome** | Connection/Engine 两页改用 `InputBox`/`Checkbox`/`WorkbenchList` 左栏与状态色；窄宽两栏；Test Engine 下沉页脚；「回 Client」链入 Preferences tab 条；会话栏图标改 ghost toolbar。无新 RPC / 无新节 |
| **settings chrome follow-up** | Back-to-Client 先取出 Preferences 服务再关 pane（`await` 后 accessor 已失效）；Direct Address Connect 状态写回本区并先标 Connecting…。已随本轮合入 `loop/merge` |

并行 catalog/UI 绑定波流水见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。钉死调试引擎：[debug-engine](../../docs/guides/debug-engine.md)。
[m7-gap-closeout](../plans/m7-gap-closeout.md) 与 [session-view-frame-fanout](../plans/session-view-frame-fanout.md) 的重复 frontmatter 已合并（生成列此前误显 `accepted`，现为 `implemented`）；按规则 3c 改口三处知识层叙述：Test Connection 已走 `probeConnectionProfile`、帧扇出 F1/F2 已落（全局 `onDidApplyFrame` 待删）、子代理 catalog 已由观察 lease 驱动。
### 进行中（2026-09-07 本 wake · 以 merge 代码为准，不信上文「已合入」清单）
集成 tip **本关仓提交**（`loop/merge`；未 push）。Chat 仍被引擎空壳 Create（目录在、`session_meta` 空、回 6）挡住；不要再清 `.sessions` 当主线。见 [D26](deferred-gaps.md)。**U2 未开**。**PRD-008 / PRD-019 不升 `implemented`**。[R8](research-queue.md) **已闭**（[ADR-008](../decisions/008-write-git-apply-hunks-empty.md) 引擎空 `patches` = 成功空操作）。Accept 产品选项 A 见 [sources-accept-empty-success](../plans/sources-accept-empty-success.md)（`draft`；**A1 已落**；**P5 停线**——只批准停线，不批准 A2；A2 须新选定 + 新 Arch-First）。

1. **集成 tip** 以 merge 本关仓提交为准（FileMutationJoin A=`10d8dd3b143`；createScoped B=`9c49eb5b978`；Review 委托 D=`60dbf139ac1`）。`npm run compile` 仍基线 unused 红则 **不 push**。GFS >800 不拆。D22/F3 已撤回。不跑 F4 / 不实施 A2。
2. 本波字母槽已进 merge：**A** `filemutation-join`（无 `diff_stats` 时 omit）；**B** createScoped + SessionsView 夹具 + [D42](deferred-gaps.md) Maximize 已闭；**C** inbox-getqueue-honesty（无 GetQueue）；**D** review-entries + [D43](deferred-gaps.md) layout 扇出已闭。**[D16](deferred-gaps.md) 仍开**。
3. **D15 / W1 笔记（工位 A，未占 工位表）**：`scripts/code-web.sh --browserType none --host 127.0.0.1 --port 18080` 已起；V1 Conversation / V2 四钮 + `UniverseAgentStudio Dev` / V3 Connection·Engine 省略桌面连接控件均 **PASS**。`IUniverseAgentConnection.getConnectionPhase()` = `disconnected`；页内点名「此环境不支持本机 Engine 连接」。证据 [d15-evidence/w1-1556dde3](d15-evidence/w1-1556dde3/)。**D15 可闭**；不升 PRD-019。未跑 compile / F4 / 引擎仓。
4. **A/B leftover 夹具波（未关 D16 / 未降 min_cases）**：statusbar / visualize / lens-ro-uncaught / register-idempotent / conversation glob 795 / hang-fix / [D44](deferred-gaps.md)。勿开切片 1「已归零」。
11. **A 槽 `host-open-catch`（未关 D16 / 未转 listTools / 未发明 heartbeat client_id / 未碰 Create·`.sessions`）**：`openResidentChat` `open.call` 与 `openStream` `subscribeSessionEventStream` 补与 `openContinuation` 同级 catch（warn、不抛、Chat 仍 echo `chatStreamUp` 走 one-shot）。`sessionViewHostChatClose.test.ts` 断言 throw-on-open。父约束未 compile。[D45](deferred-gaps.md) **已闭**。
12. **B 槽 `catalog-rpc-throw-honesty`（未关 D16 / 未转 listTools bytes / 未发明 GetQueue）**：Engine Tools/Agents list throw → `getMode()==='failed'` + error status + 0 行；composer 三 hook throw 仍 No agent / No model / 空 tools。首拉 throw 已锁。成功后再 throw leftover 已由本 wake `d46-catalog-leftover-clear` 收口。未 compile。
13. **D 槽 `review-git-read-throw`（未关 D16 / 未跑 F4 / 未开 A2）**：Review / Changes 挂载后 `readGitChanges` throw 的 status DOM 含 `sourcesGitReadFailureMessage('boom')` / `Unable to read git changes:`。未重做 Open Selected。未发明 WriteGitUnstage。
14. **A 槽 `host-close-stream-dispose-catch`（未关 D16 / 未转 listTools / 未碰 D46·catalog / 未跑 F4）**：核实 `drainIntents` 无 per-intent catch 为真洞——Actor linger / connectionDown / overflow 同批 `closeStream` 后接 `closeChatStream`；生产 `dispose` 走 `call.end()`+`call.cancel()`。只给 `closeStream` 的 `dispose` 补与 open 同级 warn catch，仍 `streams.delete`。测锁 throw-on-dispose 后 Chat 仍关。不包整圈 `drainIntents`。父约束未 compile。
15. **B 槽 `d46-catalog-leftover-clear`（未关 D16 / 未转 listTools / 未发明 GetQueue）**：`engineToolsSection.refresh` / `engineAgentsSection.refresh` catch 先 `clearCatalogPresentation` 再 `failed`。补成功→throw 测：`getMode()==='failed'` 且 `getListEntryCount()===0`。首拉 throw 三测保留。父约束未 compile。[D46](deferred-gaps.md) **已闭**。
16. **D 槽 `review-list-open-diff-dom`（未关 D16 / 未跑 F4 / 未开 A2）**：Review / Changes 列表 `onDidOpen` 在 `getQuickDiffs` throw 后断言 status DOM 为 `sourcesGitDiffOpenFailureMessage('boom')` / `Unable to open diff:`；Review 不标已审。未重做 Open Selected。未重做 git-read throw。未发明 WriteGitUnstage。
17. **A 槽 `host-remaining-dispose-catch`（未关 D16 / 未转 listTools / 未发明 heartbeat client_id / 未碰 Create·`.sessions` / 未跑 F4）**：D47 只包 `closeStream.dispose`。本刀给 `closeResidentChat` / `onEngineConnectionChanged` 三圈 dispose、以及同文件 `openResidentChat` existing / `openContinuation` 旧句柄补与 D47 同级 warn catch，仍 delete / unload / 仍 post `chatStreamDown`·`connectionDown`。不包整圈 `drainIntents`。测锁 linger Chat throw-on-dispose 仍删句柄、断连 event-stream throw 仍卸 Chat 且 post `connectionDown`。父约束未 compile。[D48](deferred-gaps.md) **已闭**。
18. **B 槽 `mcp-skills-leftover-clear`（未关 D16 / 未转 listTools / 未发明 GetQueue）**：`engineMcpSection.refresh` / `engineSkillsSection.refresh` catch 先 `clearCatalogPresentation` 再 `failed`。补成功→throw 测：`getMode()==='failed'` 且 `getListEntryCount()===0`。首拉 / disconnect 测保留。父约束未 compile。[D49](deferred-gaps.md) **已闭**。
19. **D 槽 `changes-stage-commit-dom`（未关 D16 / 未关 D31 / 未跑 F4 / 未开 A2）**：Changes 挂载后选行，Stage Selected / Commit 在 `writeGitStagePaths` / `writeGitCommit` throw 时 `.sources-changes-status` 对齐既有 localize（`Unable to stage:` / `Unable to commit:`）。未改生产。未重做 git-read / open-diff。未发明 WriteGitUnstage。未 compile。
20. **B 槽 `composer-leftover-clear`（未关 D16 / 未转 listTools / 未发明 GetQueue）**：`loadConnectedComposerCatalogs` agent/model catch 成功后再 throw 不再留旧 select / `catalogModelIds`。agent 重置 No agent；model 重置 No model / `['']` / selectedIndex=0。tools catch 已清。首拉 throw 测保留。父约束未 compile。[D50](deferred-gaps.md) **已闭**。
21. **A 槽 `host-write-receipt`（未关 D16 / 未发明 heartbeat client_id / 未碰 Create·`.sessions` / proto / F4 / unused-import / `dev/loop`）**：`handleIntent` 把 `chatStreamWrite.writeId` 传入 `writeChat`；`mark()` 只用 `'accepted' | 'failed'` 并盖 `HOST_WRITE_RECEIPT_SOURCE` / `writeId` / `chatAttemptId`。permission `perm-live` 成功出 `removePendingAction`；resident write throw 出 `pendingRespondFailed`（`hostWriteFailed`）且无未处理 rejection。未包整圈 `drainIntents`。父约束未 compile。[D51](deferred-gaps.md) **已闭**。
22. **D 槽 `unstage-status-dom`（未关 D16 / 未关 D31 / 未跑 F4 / 未开 A2）**：Changes 不走 git-read（该路径无 `scmResource`，Unstage 保持 disabled）。stub `index` 组 + `scmResource`，`CommandsRegistry.registerCommand('git.unstage')`，`ICommandService.executeCommand` throw `'boom'` 后点 Unstage Selected，`.sources-changes-status` 对齐既有 localize（`Unable to unstage:`）。测后注销命令。生产未改（Unstage status DOM 本已挂载）。未发明 WriteGitUnstage。未 compile。
23. **A 槽 `oneshot-chat-receipt`（未关 D16 / 未发明 heartbeat client_id / GetQueue / 未碰 Create·`.sessions` / proto / F4 / unused-import / `dev/loop`）**：D51 已锁 resident `write()`。one-shot `connection.chat()` 原只在 `onResponse` 标 `accepted`；`TestConnection.chat()` 空 resolve、生产 `makeBidiBytesClient` 可 `'end'` 且 0 `'data'`，无 `inputDelivery`，perm-live 座不清。no-resident `writeChat`：`mark` 至多一次；await 后未 mark → `accepted`；catch 未 mark → `failed`。未包整圈 `drainIntents`。测锁无 callback 仍 `removePendingAction`、chat throw 仍 `pendingRespondFailed`（`hostWriteFailed`）。父约束未 compile。[D52](deferred-gaps.md) **已闭**。
24. **D 槽 `stage-commit-ok-false-dom`（未关 D16 / 未关 D31 / 未跑 F4 / 未开 A2）**：`createGitConnection` 钩子可 **返回** `{ supported:true, success:false, errorMessage:'denied' }`（不 throw）。Changes 选行后 Stage Selected / Commit 的 `.sources-changes-status` 对齐既有 localize + `denied`。未改生产（`supported && !success` status 本已挂载）。未重做 throw 测。未发明 WriteGitUnstage。未 compile。
25. **A 槽 `navigator-team-leftover`（未关 D16 / 未跑 F4 / 未开 A2 / unused-import / `dev/loop`）**：`refreshTeamData` 的 `memberStatus` / `taskList` 补 catch；成功后再 throw 清 leftover 行并写失败 note，不断连、不用 stale-note。断连 leftover + stale-note 合同未改。测锁 success→throw。父约束未 compile。[D53](deferred-gaps.md) **已闭**。
26. **B 槽 `snapshots-write-status`（未关 D16 / 未发明 GetQueue / 未碰 F4 / 引擎 / `dev/loop`）**：Snapshots overlay Restore/Delete `ok:false` / throw 画独立 write-status（`Unable to restore:` / `Unable to delete:`），**不**用 `paintStatus`（会 unload 行）；fail 仍不 refresh。测锁 status DOM + 行仍在。[D54](deferred-gaps.md) **已闭**。未 compile。
27. **B 槽 `mcp-write-status`（未关 D16 / 未发明 GetQueue / 未碰 F4 / 引擎 / `dev/loop`）**：MCP Add/Update/Remove `ok:false` / throw 画 catalog write-status（`showWriteFailed`），**不** `clearCatalogPresentation`（会卸行）；fail 仍不 refresh。测锁 status DOM + 行仍在。[D55](deferred-gaps.md) **已闭**。未 compile。
28. **A 槽 `skills-create-status`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / MCP）**：`createSkill` `{ ok:false }` / throw 画 body/toolbar write-status（对齐 Save 的 `.engine-skill-body-status`），不造假行、不改选中、不清 catalog。测锁 status DOM + 行仍在。[D56](deferred-gaps.md) **已闭**。未 compile。
29. **B 槽 `agents-write-status`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26）**：Agents New/Delete/Reset / `saveSelectedProfile` `ok:false` / throw 画 `.engine-catalog-write-status`（不 refresh、不改选中、不卸行）；`saveAgentsMarkdown` 复用 `.engine-agents-editor-status`。未做 Tools enablement。[D57](deferred-gaps.md) **已闭**。未 compile。
30. **B 槽 `tools-write-status`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26）**：Tools `savePendingEnablement` / `toggleTool` 空 id / throw 画 `.engine-catalog-write-status`（不 refresh、不卸行）；失败仍保留 pending enablement dirty map。[D58](deferred-gaps.md) **已闭**。未 compile。
31. **A 槽 `skills-toggle-status`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26）**：`toggleSkill` `setSkillEnabled` `{ ok:false }` / throw 画 `.engine-skill-write-status`（及 body status），不改选中、不清 catalog；refresh 只用来回退 checkbox。[D59](deferred-gaps.md) **已闭**。未 compile。
32. **D 槽 `connection-list-leftover`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26 / D60）**：`refreshEngineDevices` / `refreshEnginePending` catch 不再写成 `[]`；成功后再 throw 保留末次快照并画失败 note（`.connection-hub-devices-status` / pending empty / `hubDirectoryBanner`）。[D61](deferred-gaps.md) **已闭**。未 compile。
33. **B 槽 `mcp-toggle-status`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26）**：`toggleServer` `toggleMcpServer` `{ ok:false }` / throw 画 catalog write-status（`showWriteFailed`），**不** `clearCatalogPresentation`（会卸行）；refresh 只用来回退 checkbox。测锁 status DOM + 行仍在。[D60](deferred-gaps.md) **已闭**。未 compile。未重做 Add/Update/Remove。
34. **A 槽 `hub-rename-throw`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26 / login·changePassword）**：`handleRenameSelectedDevice` 给 `renameDevice` / 成功后 `refreshDirectory` 补与 rotate/revoke 同级 catch，throw 画 `hubDirectoryBanner`。`!result.ok` 原路径未改。测锁 rename throw 画 `.connection-hub-directory-banner`。[D62](deferred-gaps.md) **已闭**。未 compile。
35. **B 槽 `agents-tools-leftover`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26）**：`ensureAgentToolsLoaded` catch 跟踪 `agentToolsLoadFailed`；`renderAgentTools` 画 `toolsStatus` `mode:'failed'` + `getCatalogFailedCopy`，不再把 throw 画成接通 empty。`clearCatalogPresentation` / 成功 load 清旗。测锁 `.engine-agents-tools-panel .engine-catalog-status-widget[data-catalog-mode="failed"]`。[D63](deferred-gaps.md) **已闭**。未 compile。未改 `connectionPreferencesPane.ts`。
36. **A 槽 `hub-login-throw`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26 / 未重做 D62 rename）**：`handleLogin` / `handleChangePassword` 给 `login` / `changePassword` 补与 `!result.ok` 同目标 catch，throw 画 `hubAuthBadge`。`!result.ok` 原路径未改。测锁 login / changePassword throw 画 `.connection-hub-auth-badge`。[D64](deferred-gaps.md) **已闭**。未 compile。
37. **A 槽 `hub-remaining-write-throw`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26 / 未重做 D61 list leftover / D62 rename / D64 login·changePassword）**：`handleTestConnection`（active profile `probeConnectionProfile`）/ `handleLogout` / Hub fallback `revokeDevice` / `confirmDeviceCode` 补与同目标 catch，throw 画 `testStatus` / `hubAuthBadge` / `hubDirectoryBanner` / `hubDeviceCodeStatus`。`!result.ok` 原路径未改。测锁四条 throw。[D65](deferred-gaps.md) **已闭**。未 compile。未改 `handleForget` / `addDirectAddress` / `addHubDeviceProfile` / `handleDisconnect`。
38. **A 槽 `skills-save-write-status`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26 / 未改 create·toggle / leftover refresh）**：`saveSelectedSkillBody` `{ ok:false }` / throw 走 `paintSkillWriteFailed`（既有 `ua.engineSkillBodySaveFailed`），同时画 `.engine-skill-write-status` 与 body-status；不造假行、不改选中、不清 catalog。测锁 status DOM + 行仍在。[D66](deferred-gaps.md) **已闭**。未 compile。
39. **B 槽 `mcp-runtime-tools-leftover`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26 / 未改 `engineMcpSection.ts`）**：`loadTools` catch 在 `tools=[]` 后 `DOM.clearNode(this.toolsList)` 再 hide，仍画 `toolsStatus` `failed`；不调 `clearToolsPresentation()`。测锁成功→throw leftover 工具名消失；首拉 throw 仍 failed。[D67](deferred-gaps.md) **已闭**。未 compile。
40. **A 槽 `catalog-reconnect-stale`（未关 D16 / 未发明 GetQueue / proto / heartbeat `client_id` / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / D26 / D22 / A2 / unused-import）**：Agents connected+SUPPORTED `refresh` 成功在 `setProfiles`/`syncDetailHost` 前 invalidate `agentTools` / `agentToolsLoadFailed`（不消 catalog、不改 UNKNOWN）。Tools 成功 `refresh` 若有选中则清 info 再 `loadToolInfo`（`listTools` throw 仍清 catalog）。测锁 leftover 工具名消失 + toolsStatus failed + catalog ready；详情 failed 无 `Run a command`。[D68](deferred-gaps.md)/[D69](deferred-gaps.md) **已闭**。未 compile。
41. **A 槽 `skills-refresh-reload-body`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / D26 / unused-import / 未改 create·toggle·save / D49 leftover）**：成功 `listSkills` refresh 后若有选中且 `!bodyDirty` 则 `loadSkillBody`。测锁重连后第二次 `getSkillInfo` throw 画 `ua.engineSkillBodyLoadFailed`、无 `# Stale skill body`、catalog 仍 ready。[D70](deferred-gaps.md) **已闭**。未 compile。
42. **B 槽 `agents-refresh-reload-editor`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / D26 / D68 invalidate / UNKNOWN）**：Agents connected+SUPPORTED `refresh` 成功后若 Instructions 页有选中且 `!agentsMarkdownDirty` 则 `void loadAgentsEditorForSelection()`（既有 `saveAgentProfile`）；dirty 不覆盖；Tools 页不重入以免多打 `listTools`。测锁 leftover `Stale agents md` 消失 + editor-status `ua.engineAgentsMdLoadFailed` + catalog ready。[D71](deferred-gaps.md) **已闭**。未 compile。
43. **A 槽 `catalog-refresh-clear-pending`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / D26 / D46 leftover / D68 invalidate / D69 / D71）**：Tools 成功 `refresh` 清 `pendingEnablement` 再 `updateSaveChrome`；Agents 成功 `refresh` 在 D68 invalidate 旁清 `agentToolPending`。测锁重连后 dirty false、catalog/tools 仍 ready。未 compile。[D72](deferred-gaps.md)/[D73](deferred-gaps.md) **已闭**。
44. **A 槽 `connection-hub-refresh-throw`（未关 D16 / 未发明 GetQueue / proto / 未碰 F4 / 引擎 / `.sessions` / `dev/loop` / unused-import / D26 / 未重做 D61 list leftover / D62 rename / D64 login / D65 remaining writes）**：`refreshHubDirectory` 只包 `refreshDirectory` catch，throw 画 `hubDirectoryBanner`（`writeStatus` error）后 return，不调 `refreshEngineDeviceLists`。测锁 Refresh devices throw 画 `.connection-hub-directory-banner`。[D74](deferred-gaps.md) **已闭**。未 compile。
45. **B 槽 `composer-switch-model-empty-rollback`（未关 D16 / 未碰 F4·A2·D26 / proto / `dev/loop`）**：`applySessionModelIndex` await 后 `!result.resolvedModelId.trim()` 走 restore + `showGateNotice`（`conversationLensDockModelFailed`）；未发明 `UniverseAgentSwitchModelResult.ok`。throw 测保留；补 empty resolve 回滚+gate。[D76](deferred-gaps.md) **已闭**。
46. **D 槽 `review-pane-git-action-catch`（未关 D16 / 未关 D31 / 未跑 F4 / 未开 A2）**：Review `runGitAction` catch 后 `showNotice(getErrorMessage(error))`，finally 仍 `updateReviewActions`。未改 `runAccept`。未发明 WriteGitUnstage。源扫锁 catch + showNotice。[D75](deferred-gaps.md) **已闭**。
47. **A 槽 `lens-stale-banner-lease-sync`（未关 D16 / 未碰 D76·composer / sessions / sessionViewHost / proto / F4 / A2 / `dev/loop`）**：`updateSyncChrome` 徽章后用同一 `sync` 刷新 `.conversation-lens-stale-snapshot`。lease 置 `closed` 且不发 `onDidChangeSession` 时横幅可见。PRD-007 `onSessionChanged` 测未改。[D77](deferred-gaps.md) **已闭**。
48. **B 槽 `sessions-roster-engine-connect`（未关 D16）**：Sessions view 补 `onDidChangeEngineConnection` → `refreshList()`。接通后 `getSessions()` 空则列表立即空，不再留 stub 行。[D78](deferred-gaps.md) **已闭**。
49. **D 槽 `host-openstream-throw-sync`（未关 D16 / 未发明 proto / GetQueue / heartbeat `client_id` / 未碰 Create·`.sessions` / lens / sessions view / 未包整圈 `drainIntents`）**：`openStream` catch 在既有 warn 后复用 `postAndDrain` `streamClosed`（`cause: { kind:'error', message }`）。测锁 throw-on-open 折 closed chrome，sync 不再假 live；warn + resident Chat 断言保留。[D79](deferred-gaps.md) **已闭**。未 compile。
50. **A 槽 `lens-retry-error-postbound-catch`（未关 D16）**：`retryError` `postBound` reject → `showPostFailure('failed')`；第五 reason，不映射四因。[D80](deferred-gaps.md) **已闭**。
51. **B 槽 `channel-client-hydrate-catch`（未关 D16）**：Channel Client `hydrate` / `refreshPhaseAndNotify` try/catch；IPC reject 保留末次好缓存、不 fire 半应用 phase。[D81](deferred-gaps.md) **已闭**。
52. **D 槽 `navigator-reveal-throw-notice`（未关 D16 / D21）**：Reveal await 路径 try/catch；`openSubAgent` throw → `INotificationService.error`；void 调用点未改。[D82](deferred-gaps.md) **已闭**。
53. **A 槽 `lens-permission-question-postbound-catch`（未关 D16）**：permission/question `postBound` reject → `showPostFailure('failed')`。[D83](deferred-gaps.md) **已闭**。
54. **B 槽 `hub-client-hydrate-catch`（未关 D16）**：Hub `hydrate` reject 保留预 hydrate 默认、不 fire。[D84](deferred-gaps.md) **已闭**。
55. **D 槽 `promote-subagent-throw-notice`（未关 D16）**：Promote `openExtensionTab` throw → `INotificationService.error`。[D85](deferred-gaps.md) **已闭**。
56. **A 槽 `composer-submit-postbound-catch`（未关 D16）**：`submitDraft` `postBound` reject → `showPostFailure('failed')`。[D86](deferred-gaps.md) **已闭**。
57. **D 槽 `breadcrumb-navigate-throw-notice`（未关 D16）**：`navigateAgentBreadcrumb` try/catch → notice；void 未改。[D87](deferred-gaps.md) **已闭**。
58. **D 槽 `fork-open-tab-throw-notice`（未关 D16）**：`openForkTab` try/catch → notice；首个 await 前 hoist。[D88](deferred-gaps.md) **已闭**。
59. **A 槽 `connection-profile-crud-throw`（未关 D16）**：Add Direct / Disconnect / Forget / ConnectDevice throw 画 status。[D89](deferred-gaps.md) **已闭**。
60. **B 槽 `session-window-primary-bootstrap-catch`（未关 D16）**：先 `ensureLeaf` 再提交 key；in-flight 串行 + 真实 stub；throw 回滚半应用 leaf。[D90](deferred-gaps.md) **已闭**。
61. **D100–D119**（未关 D16）：peek / close / opener / stale / save·delete·cancel·Stop·Goal·Enqueue false notice / reveal / open-beside / primary bootstrap notice；Goal / Enqueue 断连+history 可点；permission/question roster false；SessionBar rename/delete 与 Sessions 侧栏 delete false notice；notifications acquire throw → [] + error。
子 agent 发现的既有代码问题：
| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D23](deferred-gaps.md) | A 槽 | **closed** resident heartbeat write 已 catch |
| [D33](deferred-gaps.md) | B 槽 | **closed** pairingPending 开 Connection/SAS |
| [D27](deferred-gaps.md) | grok 4.6 | **closed**：`provideTurnEditComposer` 先于 `setEditingTurnId`；已删 1px 垫高 |
| [D31](deferred-gaps.md) | D 槽 | Accept A1 已落；P5 停线；A2 须新选定 + Arch-First；git-read / open-diff / Stage·Commit / Unstage throw 与 Stage·Commit **ok:false** status 已挂；Review `runGitAction` catch 见 [D75](deferred-gaps.md)；**仍开**（剩 F4）；不升 PRD |
| [D75](deferred-gaps.md) | D 槽 `review-pane-git-action-catch` | **closed** Review `runGitAction` throw 已 `showNotice`；未关 D16 / D31 F4 |
| [R8](research-queue.md) | B 槽 `r8-empty-patches-close` | **closed**：[ADR-008](../decisions/008-write-git-apply-hunks-empty.md) 引擎仓 `1f07008f` `GitWorkDirWriter.kt` L77–78 空 `patches` = 成功空操作；A1 已拒空送；[D31](deferred-gaps.md) F4 未跑 |
| [D32](deferred-gaps.md) | A 槽 `host-write-retry` | **closed（代码+测已写；compile 待 merge）** Retry 走 `lease.post`；host 映射 Actor `continueGeneration` |
| [D38](deferred-gaps.md) | A 槽 `host-bind-safety` | **closed** `fillHistory` bind/write 已 catch |
| [D39](deferred-gaps.md) | A 槽 `host-bind-safety` | **closed** `requestDetail` bind 已 catch |
| [D40](deferred-gaps.md) | A 槽 `request-detail-fetch-catch` | **closed** `fetchToolDetail` throw 已 catch 回 `{ok:false}`；host `{ok:false}` 原样返回 |
| [D24](deferred-gaps.md) | A 槽 `live-rpc-bytes` | **仍开**：`probeRpc` 已 empty proto；`listTools` 仍 JSON；其余活 JSON 缺本仓 proto 字段号未转 |
| [D25](deferred-gaps.md) | A 槽 `ghost-bind-failed-ui` | **host leftover 已收；行仍开**：List-fail / ghost bind-fail 显示 bind-failed，不造 `sessionNew`；引擎 List 真空未修 |
| [D26](deferred-gaps.md) | A 槽 host / 引擎仓 | host Tree+recover 已收；引擎空壳 Create 回 6 仍开；不要再清 store |
| [D37](deferred-gaps.md) | C 槽 `inbox-getqueue-honesty` | **closed** Retry 仍按 `upload` 转发；无 GetQueue 已诚实化（Queue not listed + fixture 不冒充）；活引擎失败行仍不可见记 D24 |
| [D41](deferred-gaps.md) | C 槽 `inbox-fail-class` | **closed** Inbox `FAILED` 行 class 为 `queue-failed`，`UPLOAD_FAILED` 仍 `upload-failed`；Retry 接线未改 |
| [D28](deferred-gaps.md) | C 槽 `identity-strip-occlusion` | **closed** Connection 模态按身份条底边布局预留；几何测锁不重叠；(2)(3) 仍闭；未改 session bar |
| [D34](deferred-gaps.md) | B 槽 `timeline-hygiene` | **closed** 空/零高树不再读 `lastVisibleElement` |
| [D35](deferred-gaps.md) | B 槽 `timeline-hygiene` | **closed** 删 `getTimelineRowElement` 死第二段 query |
| [D36](deferred-gaps.md) | B 槽 `timeline-hygiene` | **closed** standalone thinking/tool 诚实摘要行，无假 fold |
| [D15](deferred-gaps.md) | A 槽 `d15-web-evidence` | **closed** W1 `code-web.sh` V1–V3 PASS；phase=`disconnected`；不画桌面连接控件；证据 w1-1556dde3 |
| [D42](deferred-gaps.md) | B 槽 `d42-maximize-trajectory` | **closed** merge compile 后 CSS+铺行两测绿 |
| [D43](deferred-gaps.md) | D 槽 leftover | **closed** `ConversationPart.layout` 按叶 host 尺寸再 layout 各 conversation editor part；resize 测已补 |
| [D44](deferred-gaps.md) | B 槽 `d44-preferences-nav-idempotent` | **closed** 已注册 id 跳过；二次调用不抛；生产仍只 contribution 调一次 |
| [D45](deferred-gaps.md) | A 槽 `host-open-catch` | **closed** `openResidentChat` / `openStream` throw-on-open 已 catch；Chat 仍 echo one-shot；未关 D16 |
| [D46](deferred-gaps.md) | B 槽 `d46-catalog-leftover-clear` | **closed** catch 先 `clearCatalogPresentation` 再 `failed`；成功→throw 测 `getMode()==='failed'` 且 `getListEntryCount()===0`；首拉 throw 测保留；未关 D16 / 未转 listTools / 未发明 GetQueue |
| [D47](deferred-gaps.md) | A 槽 `host-close-stream-dispose-catch` | **closed** `closeStream` dispose throw 已 catch；同批 Chat 仍关；未关 D16 |
| [D48](deferred-gaps.md) | A 槽 `host-remaining-dispose-catch` | **closed** `closeResidentChat` / 断连三圈 / open 旧句柄 dispose throw 已 catch；Chat 仍删、`connectionDown` 仍 post；未关 D16 |
| [D49](deferred-gaps.md) | B 槽 `mcp-skills-leftover-clear` | **closed** MCP/Skills catch 先清行再 `failed`；成功→throw 测 `getMode()==='failed'` 且 `getListEntryCount()===0`；首拉 / disconnect 测保留；未关 D16 / 未转 listTools / 未发明 GetQueue |
| [D50](deferred-gaps.md) | B 槽 `composer-leftover-clear` | **closed** agent/model catch 重置 No agent / No model / `catalogModelIds=['']` / selectedIndex=0；成功→throw 测不留上一轮 catalog；首拉 throw 测保留；未关 D16 / 未转 listTools / 未发明 GetQueue |
| [D51](deferred-gaps.md) | A 槽 `host-write-receipt` | **closed** host receipt 用 `accepted`/`failed` + `host-write-accepted` / `writeId` / `chatAttemptId`；permission inflight 成功清座、失败 `pendingRespondFailed`；未关 D16 |
| [D52](deferred-gaps.md) | A 槽 `oneshot-chat-receipt` | **closed** no-resident `writeChat` mark 至多一次；chat resolve 无 callback 仍 accepted / 清座；chat throw 仍 `pendingRespondFailed` `hostWriteFailed`；未关 D16 |
| [D53](deferred-gaps.md) | A 槽 `navigator-team-leftover` | **closed** `memberStatus` / `taskList` throw 已 catch；成功→throw 清 leftover 并写失败 note；断连 leftover + stale-note 未改；未关 D16 |
| [D54](deferred-gaps.md) | B 槽 `snapshots-write-status` | **closed** Restore/Delete `ok:false` / throw 画 overlay write-status，不 unload 行、不 refresh；未关 D16 |
| [D55](deferred-gaps.md) | B 槽 `mcp-write-status` | **closed** Add/Update/Remove `ok:false` / throw 画 catalog write-status，不卸行、不 refresh；未关 D16 |
| [D56](deferred-gaps.md) | A 槽 `skills-create-status` | **closed** `createSkill` `ok:false` / throw 画 body/toolbar write-status，无假行、不改选中、不清 catalog；未关 D16 |
| [D57](deferred-gaps.md) | B 槽 `agents-write-status` | **closed** Agents create/delete/reset / save `ok:false` / throw 画 catalog write-status，不卸行、不 refresh、不改选中；`saveAgentsMarkdown` 复用 editor-status；未关 D16 |
| [D58](deferred-gaps.md) | B 槽 `tools-write-status` | **closed** Tools `savePendingEnablement` / `toggleTool` 空 id / throw 画 catalog write-status，不卸行、不 refresh；pending dirty map 保留；未关 D16 |
| [D59](deferred-gaps.md) | A 槽 `skills-toggle-status` | **closed** `toggleSkill` `ok:false` / throw 画 write-status，不清 catalog、不改选中；refresh 回退 checkbox；未关 D16 |
| [D60](deferred-gaps.md) | B 槽 `mcp-toggle-status` | **closed** `toggleServer` `ok:false` / throw 画 catalog write-status，不卸行；refresh 回退 checkbox；未关 D16 |
| [D61](deferred-gaps.md) | D 槽 `connection-list-leftover` | **closed** `listDevices` / `listPending` throw 保留末次快照并画失败 note，不成静默空；未关 D16 / 未占 D60 |
| [D62](deferred-gaps.md) | A 槽 `hub-rename-throw` | **closed** `renameDevice` / 成功后 `refreshDirectory` throw 画 `hubDirectoryBanner`；未关 D16；未做 login/changePassword |
| [D63](deferred-gaps.md) | B 槽 `agents-tools-leftover` | **closed** Agents Tools 页 `listTools` throw 画 `toolsStatus` `failed`，不再假装 empty；未关 D16 |
| [D64](deferred-gaps.md) | A 槽 `hub-login-throw` | **closed** `login` / `changePassword` throw 画 `hubAuthBadge`；未关 D16；未重做 D62 rename |
| [D65](deferred-gaps.md) | A 槽 `hub-remaining-write-throw` | **closed** `probeConnectionProfile` / `logout` / Hub fallback `revokeDevice` / `confirmDeviceCode` throw 画对应 hook；未关 D16；未重做 D61/D62/D64 |
| [D66](deferred-gaps.md) | A 槽 `skills-save-write-status` | **closed** `saveSelectedSkillBody` `ok:false` / throw 走 `paintSkillWriteFailed`；write-status + body-status 可见；不清 catalog、不改选中；未关 D16 |
| [D67](deferred-gaps.md) | B 槽 `mcp-runtime-tools-leftover` | **closed** `getMcpServerTools` throw 清 leftover 工具名并画 `toolsStatus` `failed`；首拉 throw 仍 failed；未关 D16 |
| [D68](deferred-gaps.md) | A 槽 `catalog-reconnect-stale` | **closed** Agents Tools 页重连后第二次 `listTools` throw 清 leftover 并画 failed；catalog 仍 ready；UNKNOWN 未改；未关 D16 |
| [D69](deferred-gaps.md) | A 槽 `catalog-reconnect-stale` | **closed** Tools 成功 refresh 后 `getToolInfo` throw 重画详情 failed；catalog 仍 ready（非 D46）；未关 D16 |
| [D70](deferred-gaps.md) | A 槽 `skills-refresh-reload-body` | **closed** Skills 成功 refresh 后 `getSkillInfo` throw 重画 body failed；catalog 仍 ready；dirty 不覆盖；未关 D16 |
| [D71](deferred-gaps.md) | B 槽 `agents-refresh-reload-editor` | **closed** Agents Instructions 成功 refresh 后重载 AGENTS.md；dirty 不覆盖；第二次 `saveAgentProfile` throw 画 `ua.engineAgentsMdLoadFailed`；未关 D16 |
| [D72](deferred-gaps.md) | A 槽 `catalog-refresh-clear-pending` | **closed** Tools 成功 refresh 清 `pendingEnablement`；重连后 dirty false、catalog ready；未关 D16 |
| [D73](deferred-gaps.md) | A 槽 `catalog-refresh-clear-pending` | **closed** Agents 成功 refresh 清 `agentToolPending`；重连后 dirty false、catalog/tools ready；未关 D16 |
| [D74](deferred-gaps.md) | A 槽 `connection-hub-refresh-throw` | **closed** `refreshDirectory` throw 画 `hubDirectoryBanner`；未调 `refreshEngineDeviceLists`；未关 D16 |
| [D76](deferred-gaps.md) | B 槽 `composer-switch-model-empty-rollback` | **closed** `switchModel` 空/空白 `resolvedModelId` 回滚 select + gate；throw 测保留；未关 D16 |
| [D77](deferred-gaps.md) | A 槽 `lens-stale-banner-lease-sync` | **closed** lease-only sync `closed` 刷新阅读列 stale banner；未关 D16 |
| [D78](deferred-gaps.md) | B 槽 `sessions-roster-engine-connect` | **closed** Sessions view 接通后 `refreshList()`；空 roster 立即空，不留 stub 行；未关 D16 |
| [D79](deferred-gaps.md) | D 槽 `host-openstream-throw-sync` | **closed** `openStream` throw-on-open 已 `streamClosed`；sync 不再假 live；warn + Chat 仍开；未关 D16 |
| [D80](deferred-gaps.md) | A 槽 `lens-retry-error-postbound-catch` | **closed** `retryError` `postBound` throw 已 `showPostFailure('failed')`；未关 D16 |
| [D81](deferred-gaps.md) | B 槽 `channel-client-hydrate-catch` | **closed** hydrate / refreshPhase IPC reject 已吞；保留已写缓存；不 fire 半应用 phase；未关 D16 |
| [D82](deferred-gaps.md) | D 槽 `navigator-reveal-throw-notice` | **closed** `openSubAgent` throw 已 `INotificationService.error`；void 调用点未改；未关 D16 / D21 |
| [D83](deferred-gaps.md) | A 槽 `lens-permission-question-postbound-catch` | **closed** permission/question `postBound` throw 已 `showPostFailure('failed')`；未关 D16 |
| [D84](deferred-gaps.md) | B 槽 `hub-client-hydrate-catch` | **closed** Hub hydrate IPC reject 已吞；未关 D16 |
| [D85](deferred-gaps.md) | D 槽 `promote-subagent-throw-notice` | **closed** Promote `openExtensionTab` throw 已 notice；未关 D16 |
| [D86](deferred-gaps.md) | A 槽 `composer-submit-postbound-catch` | **closed** `submitDraft` `postBound` throw 已 `showPostFailure('failed')`；未关 D16 |
| [D87](deferred-gaps.md) | D 槽 `breadcrumb-navigate-throw-notice` | **closed** `navigateAgentBreadcrumb` throw 已 notice；未关 D16 |
| [D88](deferred-gaps.md) | D 槽 `fork-open-tab-throw-notice` | **closed** Fork `openForkTab` throw 已 notice；未关 D16 |
| [D89](deferred-gaps.md) | A 槽 `connection-profile-crud-throw` | **closed** Add Direct / Disconnect / Forget / ConnectDevice throw 已画 status；未关 D16 |
| [D90](deferred-gaps.md) | B 槽 `session-window-primary-bootstrap-catch` | **closed** throw 回滚 + in-flight 串行；merge 复测 9/9；未关 D16 |
| [D92](deferred-gaps.md)–[D119](deferred-gaps.md) | B roster+inbox+sessions / D nav / A beside+mru+sessionbar / A·B composer / A notifications | **closed** throw 回滚/notice；peek；closeEditors；opener 回滚；stale；save/delete/cancel/Stop/Goal/Enqueue false 先 notice；reveal acquire；open-beside / primary bootstrap catch error notice；Goal / Enqueue 断连+history 可点；permission/question roster false；SessionBar rename/delete 与 Sessions 侧栏 delete false notice；notifications acquire throw → [] + error；未关 D16 |

## 工位表（P0 盘点 · 2026-09-08 · 与 `git worktree list` 对照）
| 槽 | 路径 | 分支 | tip | 脏 | stash | 关仓状态 |
|----|------|------|-----|:--|:------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `e79691d31fc` | `__pycache__` | 0 | parked；compile unused 仍红，**不 push** |
| A | `vscode-WorkTrees/A` | `loop/A` | `e79691d31fc` | `__pycache__` | 0 | idle |
| B | `vscode-WorkTrees/B` | `loop/B` | `e79691d31fc` | `__pycache__` | 0 | idle |
| C | `vscode-WorkTrees/C` | `loop/C` | `e79691d31fc` | 未提交 `dev/loop` + `__pycache__` | 0 | idle；勿 add `dev/loop` |
| D | `vscode-WorkTrees/D` | `loop/D` | `e79691d31fc` | `__pycache__` | 0 | idle |
| edit | `Projects/Agents/vscode` | `agent-ide` | `a40a95d1e85`+ | `dev/loop` + 过期 progress | 0 | 人类工位；请自行对齐本关仓 docs HEAD |
## Next（Blockers：无）
| 项 | 指针 |
|:---|:-----|
| **引擎空壳 Create** | [D26](deferred-gaps.md) — 空 store 首次 Create 仍 `ALREADY_EXISTS` 且不写 meta；不要再清 store |
| **test-baseline** | D17 名单 0 数据行。**merge** `run-unit-custom.sh` + `check-test-baseline.sh` **passed**（conversation 795 / sources 101 / universeAgent 213）。**D16 仍开**；勿开切片 1；勿降 `min_cases` |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 — 须 U0 `comm` 空 + U1 完成 + CI 绿 + merge 独占 + A 表冻结；**未满足前不开 U2** |
## 不做：**ADR-007 U2**（第一次上游 tag 合入）、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
