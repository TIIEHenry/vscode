---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-07
summary: "FileMutationJoin / createScoped / Review 委托已修。D16 仍开。B 槽 statusbar 注册已幂等。D42 铺行路径已改。A2 仍 blocked。"
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

### 进行中（2026-09-07 本 wake · 以 merge 代码为准，不信上文「已合入」清单）

集成 tip **本关仓提交**（`loop/merge`；未 push）。Chat 仍被引擎空壳 Create（目录在、`session_meta` 空、回 6）挡住；不要再清 `.sessions` 当主线。见 [D26](deferred-gaps.md)。**U2 未开**。**PRD-008 / PRD-019 不升 `implemented`**。[R8](research-queue.md) **已闭**（[ADR-008](../decisions/008-write-git-apply-hunks-empty.md) 引擎空 `patches` = 成功空操作）。Accept 产品选项 A 见 [sources-accept-empty-success](../plans/sources-accept-empty-success.md)（`draft`；**A1 已落**；**P5 停线**——只批准停线，不批准 A2；A2 须新选定 + 新 Arch-First）。

1. **集成 tip** 以 merge 本关仓提交为准（FileMutationJoin A=`10d8dd3b143`；createScoped B=`9c49eb5b978`；Review 委托 D=`60dbf139ac1`）。`npm run compile` 仍基线 unused 红则 **不 push**。GFS >800 不拆。D22/F3 已撤回。不跑 F4 / 不实施 A2。
2. 本波字母槽已进 merge：
   - **A**：`filemutation-join` — 无 `diff_stats` 时 omit optional `diffStats`。unit-custom XML 脚本仍在。**[D16](deferred-gaps.md) 仍开**。
   - **B**：`create-scoped` — harness 补 `IStatusbarService.createScoped`，S1a uniqueness 已绿、未缩断言。DiffReview afterEach 已修。本刀 `sessions-openpending-harness`：SessionsView 四行 + OpenPending 无 pending 夹具对齐 untitled+visualize seed，未缩断言；**[D16](deferred-gaps.md) 仍开**。本 wake **`d42-maximize-trajectory`**：Maximize 只藏 `.conversation-lens-timeline`；铺行路径改为忽略 0 尺寸 ResizeObserver / `layout(0)` 卸行，T5a 铺行测 `revealRecord('untitled-u1')`（无 `display:block`）。[D42](deferred-gaps.md) **已闭**（merge compile 后 CSS+铺行 2/2）。未关 D16 / 未占 D22·D26·A2。
   - **C**：`inbox-getqueue-honesty` — catalog / connection **无** GetQueue / ListQueue，未发明 RPC。接通 / 断连缓存 Inbox 文案「Queue not listed」，stub fixture 不得冒充引擎队列；测锁 overlay / roster / stub。[D37](deferred-gaps.md) **仍闭**；缺 list-queue 记 [D24](deferred-gaps.md)。勿 add `dev/loop`。本 wake leftover：lens visualize / T5a reveal / trajectory 座名 / process fold 夹具；maximize 整槽已交 [D42](deferred-gaps.md)（B 槽已闭）。**勿 add `dev/loop`**。
   - **D**：`review-entries` — 测改 `function ()` 把 mocha host 交给 `toResource`。A2 P5 停线仍在。**[D16](deferred-gaps.md) 仍开**。本 wake leftover：**S4/S5** 首次 layout 已落；[D43](deferred-gaps.md) **已闭**（`ConversationPart.layout` 按叶 host 扇出 + resize 测）。未关 D16 / 未占 D26·D22·F4·A2。
3. **D15 / W1 笔记（工位 A，未占 工位表）**：`scripts/code-web.sh --browserType none --host 127.0.0.1 --port 18080` 已起；V1 Conversation / V2 四钮 + `UniverseAgentStudio Dev` / V3 Connection·Engine 省略桌面连接控件均 **PASS**。`IUniverseAgentConnection.getConnectionPhase()` = `disconnected`；页内点名「此环境不支持本机 Engine 连接」。证据 [d15-evidence/w1-1556dde3](d15-evidence/w1-1556dde3/)。**D15 可闭**；不升 PRD-019。未跑 compile / F4 / 引擎仓。
4. **A 槽 `statusbar-leftover`（未关 D16 / 未改名单）**：D17 leftover Conversation Session StatusBar 簇。生产相位文案 / pairingPending 闸门未改。测夹具去掉二次 `registerAction2`（与 `conversation.contribution` 撞 `showConversationPart`）、roster 改 `Event.None`、切换测 Emitter 入 store。未缩断言。
5. **A 槽 `visualize-leftover`（未关 D16 / 未改名单 / 未降 min_cases）**：D17 Lens visualize 两行。默认 360px 虚窗不再保证 comparison 已挂 DOM。两测在查询前 `revealVisualizeTurn(..., 'visualize-v2')`，未缩「无 Agent header」/ collapse 合同。未改生产 visualize。
6. **B 槽 `statusbar-register-idempotent`（未关 D16）**：`registerConversationSessionStatusBar` 见已注册的 `workbench.action.showConversationPart` 则返回，二次调用不抛。生产仍只在 `conversation.contribution` 调一次。未发明新命令。

子 agent 发现的既有代码问题：

| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D23](deferred-gaps.md) | A 槽 | **closed** resident heartbeat write 已 catch |
| [D33](deferred-gaps.md) | B 槽 | **closed** pairingPending 开 Connection/SAS |
| [D27](deferred-gaps.md) | grok 4.6 | **closed**：`provideTurnEditComposer` 先于 `setEditingTurnId`；已删 1px 垫高 |
| [D31](deferred-gaps.md) | D 槽 | Accept A1 已落；P5 停线；A2 须新选定 + Arch-First；剩 F4；不升 PRD |
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
| [D44](deferred-gaps.md) | B 本波 | **仍开** `registerUaPreferencesNavigationActions` 与 contribution 二次注册会撞 id；未改 |

## 工位表（P0 盘点 · 2026-09-07 · 与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | tip | 脏 | stash | 关仓状态 |
|----|------|------|-----|:--|:------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | 本关仓提交 | `__pycache__` | 0 | parked；compile 基线 unused 仍红，**不 push** |
| A | `vscode-WorkTrees/A` | `loop/A` | 对齐本关仓提交 | `__pycache__` | 0 | idle |
| B | `vscode-WorkTrees/B` | `loop/B` | 对齐本关仓提交 | `__pycache__` | 0 | idle |
| C | `vscode-WorkTrees/C` | `loop/C` | 对齐本关仓提交 | 未提交 `dev/loop` + `__pycache__` | 0 | idle；勿 add `dev/loop` |
| D | `vscode-WorkTrees/D` | `loop/D` | 对齐本关仓提交 | `__pycache__` | 0 | idle |
| edit | `Projects/Agents/vscode` | `agent-ide` | `a40a95d1e85`+ | `dev/loop` + 过期 progress | 0 | 人类工位；请自行对齐本关仓提交 |

## Blockers

无。

## Next

| 项 | 指针 |
|:---|:-----|
| **引擎空壳 Create** | [D26](deferred-gaps.md) — 空 store 首次 Create 仍 `ALREADY_EXISTS` 且不写 meta；不要再清 store |
| **test-baseline** | D17 名单 29 行 leftover 已删尽（visualize 3/3）。**D16 仍开**；勿开切片 1「已归零」 |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 — 须 U0 `comm` 空 + U1 完成 + CI 绿 + merge 独占 + A 表冻结；**未满足前不开 U2** |

## 不做

**ADR-007 U2**（第一次上游 tag 合入）、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
