---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-07
summary: "人类工位已对齐已推送 MERGE_SHA c1b228caf74；保留本机行动层账。Chat 仍被引擎空壳 ALREADY_EXISTS 挡住。compile 基线 unused 仍红"
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
| **docs-burden S1** | `f363f033` — [docs-burden-reduction](../plans/docs-burden-reduction.md)：`generate-docs-status.py` + plans/traceability 生成列 + `docs-health` 钩子 |
| **docs-burden S3** | `4cd542bc` — [docs-burden-reduction](../plans/docs-burden-reduction.md) §3：glossary 对外可读闭集与维护规则指针 |
| **docs-burden S4** | `623de9cf` — 本文件重写为当前迭代账（catalog 流水归档，见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)） |
| **docs-burden S5** | `222dd61c` — [docs-burden-reduction](../plans/docs-burden-reduction.md) §5：DOCUMENTATION 规则 7 归档候选标准 |
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

### 进行中（2026-09-07 本 wake · 以代码/工位 tip 为准，不信上文「已合入」清单）

人类工位已 merge `c1b228caf74`（先 commit 行动层再三路合）。Direct 接通已通。Chat 仍被引擎空壳 Create（目录在、`session_meta` 空、回 6）挡住；不要再清 `.sessions` 当主线。见 [D26](deferred-gaps.md)。**U2 未开**。**PRD-008 不升 `implemented`**。

1. **集成 tip** 以人类工位 `agent-ide` 为准（含 `c1b228caf74` + 行动层）。下一波：A=D23+D32，B=D33+D27，C=D30+诚实空，D=D31+R8。GFS >800 不拆。
2. 字母槽 leftover 进度句已收进本账，再 cascade：
   - **A**：Sources 写面 `supported && success` 才算 Stage/Commit/Accept；`supported: false` 回落本地 git；Accept 不绑死 SCM。次级面 [D31](deferred-gaps.md)。
   - **B**：`conversation-disconnect-send` 未连不锁 Send；引擎缓存断连先试 enqueue，拒收则留 draft + 明确失败，不 stub echo。
   - **C**：pairing pending 时 SAS 框挂在发起 Connect 的 zone 外侧，避免被 `.connection-zone:not(.is-active-zone)` 吃掉。
   - **D**：retryable error 行 Retry → roster `openContinuationStream`；不经 `lease.post`（[D32](deferred-gaps.md)）。

子 agent 发现的既有代码问题：

| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D23](deferred-gaps.md) | A 槽核实时 | `sessionViewHost.ts` `void sendHeartbeatAck`：resident `write` 无 catch，失败可成未处理 rejection |
| [D33](deferred-gaps.md) | 决策核实时 | `getEngineStatusCommandId` 配对中可能把 chip 指到 Engine 页（号原误写成 D24） |
| [D27](deferred-gaps.md) | 决策核实时 | ListView 0px：编辑态整树重建；1px 垫高未根治 |
| [D31](deferred-gaps.md) | A 槽 Sources | Review 读失败静默、Panel 无写动作、无 Unstage |
| [R8](research-queue.md) | A 槽 Sources | `WriteGitApplyHunks` 空 patches 语义未定 |
| [D32](deferred-gaps.md) | D 槽 error-retry | UI 直开 ContinueGeneration，不经 lease.post |
| [D26](deferred-gaps.md) | merge 账 | 引擎空壳 Create 回 6；不要再清 store |

## 工位表（P0 盘点 · 2026-09-07 · 与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | tip | 脏 | stash | 关仓状态 |
|----|------|------|-----|:--|:------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 同步中 | 0 | 0 | 跟 `agent-ide` |
| A | `vscode-WorkTrees/A` | `loop/A` | 同步中 | `__pycache__` | 0 | leftover `status.md` 先 commit 再 merge |
| B | `vscode-WorkTrees/B` | `loop/B` | 同步中 | 0 | 0 | 同上 |
| C | `vscode-WorkTrees/C` | `loop/C` | 同步中 | `dev/loop` | 0 | 同上；不 add `dev/loop` |
| D | `vscode-WorkTrees/D` | `loop/D` | 同步中 | 0 | 0 | 同上 |
| edit | `Projects/Agents/vscode` | `agent-ide` | `c44f54240f8`+ | `dev/loop` | 0 | 本机最新；推远程 |

## Blockers

无。

## Next

| 项 | 指针 |
|:---|:-----|
| **引擎空壳 Create** | [D26](deferred-gaps.md) — 空 store 首次 Create 仍 `ALREADY_EXISTS` 且不写 meta；不要再清 store |
| **test-baseline 切片 0** | [test-baseline-ci](../plans/test-baseline-ci.md) — D16 账本需先 `npm run compile` 产出 `out/` 再跑三文件单测 |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 — 须 U0 `comm` 空 + U1 完成 + CI 绿 + merge 独占 + A 表冻结；**未满足前不开 U2** |

## 不做

**ADR-007 U2**（第一次上游 tag 合入）、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
