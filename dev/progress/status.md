---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-07
summary: "2026-09-07 wake：status 工位表已过期（merge 实际 bb4a7a9b395，不是 f1568462a5f）。A/B/C 占用三大 slice；D idle；一路编译留给 merge；文档「已完成」不当证据"
---

# Development Progress

> **当前迭代账**（规则 3a）。产品状态 → [traceability](../../docs/product/traceability.md)（生成列）；方案状态 → [plans INDEX](../plans/INDEX.md)（生成列）；延期 → [deferred-gaps](deferred-gaps.md)。历史槽位 catalog 流水 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。

## Current Session

### 已合入（历史账 · **不要把本表当 merge tip**；集成基线现为 `bb4a7a9b395`）

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
| **handshake protobuf** | `GetAuthNonce` / DeviceAuth `Connect` 改 proto3 二进制（不再 `JSON.stringify`）。钉死引擎已收合法请求并进入 pairing；SAS 确认框未弹。未升 PRD-008 |
| **UI 缺口收口波** | Navigator Team 删六个改引擎命令（PRD-022 验收 6）；Sources Diff 占位壳换真 `DiffEditorWidget`，revert/accept 双门控；对话列顶「断连前快照」（PRD-007 验收 5）；子代理浮层补「对话 \| 轨迹」两页（PRD-012 验收 1）；Inbox 右簇诚实空环；Permission 接 `SetPermissionMode`（失败回滚 + 门禁提示）；轨迹折叠点击跨刷新不失效。Mermaid 扩展 Promise 加 disposed 闸门（释放后渲染导致列表行泄漏）；轨迹检查器首段标题错用 Preview 改回 Summary |
| **settings chrome** | Connection/Engine 两页改用 `InputBox`/`Checkbox`/`WorkbenchList` 左栏与状态色；窄宽两栏；Test Engine 下沉页脚；「回 Client」链入 Preferences tab 条；会话栏图标改 ghost toolbar。无新 RPC / 无新节 |
| **settings chrome follow-up** | Back-to-Client 先取出 Preferences 服务再关 pane（`await` 后 accessor 已失效）；Direct Address Connect 状态写回本区并先标 Connecting…。钉死引擎 `:50061` 已起，握手仍挂、SAS 未弹 |

并行 catalog/UI 绑定波（A–D 槽）已合入 tip；逐条流水见 [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)，不在本账复述。

八份治理方案签收与 Wave 排期见 [看板](../parallel/active/verification-governance-plans.md)。钉死调试引擎：[debug-engine](../../docs/guides/debug-engine.md)。

[m7-gap-closeout](../plans/m7-gap-closeout.md) 与 [session-view-frame-fanout](../plans/session-view-frame-fanout.md) 的重复 frontmatter 已合并（生成列此前误显 `accepted`，现为 `implemented`）；按规则 3c 改口三处知识层叙述：Test Connection 已走 `probeConnectionProfile`、帧扇出 F1/F2 已落（全局 `onDidApplyFrame` 待删）、子代理 catalog 已由观察 lease 驱动。

### 进行中（2026-09-07 本 wake · 以代码/工位 tip 为准，不信上文「已合入」清单）

文档工位表停在 `f1568462a5f`，**已过期**。当前磁盘：

| 槽 | 实际 tip | 本 wake |
|----|----------|---------|
| 主工作区 `agent-ide` | 本地仍 `f85a512fdd0`（有未提交进度文档） | **请自行对齐**到 `c1b228caf74`。loop 不代 merge/pull |
| merge `loop/merge` | `c1b228caf74` | 已并入人类 `f85a512fdd0`；已 push `origin/agent-ide` 与 `origin/loop/merge`。compile 基线 unused 仍红 |
| A `loop/A` | `b384a1dcf9e` | 已是 merge 祖先；P6 被脏 `status.md` 挡住，未 cascade |
| B `loop/B` | `58f44d73ce8` | 同上 |
| C `loop/C` | `4ae77bdc6b6` | 同上（另有脏 `dev/loop`） |
| D `loop/D` | `583b004a8b0` | 同上 |

本 wake 已派（父只调度，禁用 grok CLI，决定用 Grok 4.6）：

1. **MERGE_SHA** `c1b228caf74`：P2 收 C/A/B/D + 类型合成 + 人类 `agent-ide` `f85a512fdd0`。both-sides PASS。已 push `origin/agent-ide` 与 `origin/loop/merge`。
2. P3：两条过时 stash 已 drop，list 空。P6 字母槽未 ff（脏 leftover `status.md`）。merge 已与远程同 SHA，字母槽未 `idle`。
3. 下一波仍按冲突域（A=D23+D32，B=D24+0px，C=D30+诚实空，D=D31+R8）。GFS >800 不拆。U2 不开。

**禁止本 wake**：U2、SwitchMode Plan、空转等 loop、多路编译、删 loop。

子 agent 发现的既有代码问题：

| ID | 来源 | 问题 |
|:---|:-----|:-----|
| [D23](deferred-gaps.md) | A 槽核实时 | `sessionViewHost.ts` `void sendHeartbeatAck`：resident `write` 无 catch，失败可成未处理 rejection |
| [D24](deferred-gaps.md) | 决策核实时 | `getEngineStatusCommandId` 配对中可能把 chip 指到 Engine 页 |
| — | 决策核实时 | ListView 0px：编辑态 1px 垫高未根治；inactive lens hidden 仍报 0px |
| [D31](deferred-gaps.md) | A 槽 Sources | Review 读失败静默、Panel 无写动作、无 Unstage |
| [R8](research-queue.md) | A 槽 Sources | `WriteGitApplyHunks` 空 patches 语义未定 |
| [D32](deferred-gaps.md) | D 槽 error-retry | UI 直开 ContinueGeneration，不经 lease.post |
| — | A 槽 Inbox | 接通入队成功后无 GetQueue，列表仍空；`engine-protocol-surface` Enqueue 句过时 |

## 工位表（P0 盘点 · 2026-09-07 · 与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | tip | 脏 | stash | 关仓状态 |
|----|------|------|-----|:--|:------|:---------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `c1b228caf74` | 0 | 0 | 已 push，与 `origin/agent-ide` 同 SHA。compile 基线 unused 仍红 |
| A | `vscode-WorkTrees/A` | `loop/A` | `b384a1dcf9e` | `status.md` + `__pycache__` | 0 | 祖先已合入；P6 未 cascade |
| B | `vscode-WorkTrees/B` | `loop/B` | `58f44d73ce8` | `status.md` | 0 | 同上 |
| C | `vscode-WorkTrees/C` | `loop/C` | `4ae77bdc6b6` | `status.md` + `dev/loop` | 0 | 同上 |
| D | `vscode-WorkTrees/D` | `loop/D` | `583b004a8b0` | `status.md` | 0 | 同上 |
| edit | `Projects/Agents/vscode` | `agent-ide` | `f85a512fdd0` | 进度文档等 | 0 | 请自行对齐 `c1b228caf74` |

## Blockers

无。

## Next

| 项 | 指针 |
|:---|:-----|
| **test-baseline 切片 0** | [test-baseline-ci](../plans/test-baseline-ci.md) — D16 账本需先 `npm run compile` 产出 `out/` 再跑三文件单测 |
| **U2 闸门** | [ADR-007](../decisions/007-upstream-sync.md) Decision 5 — 须 U0 `comm` 空 + U1 完成 + CI 绿 + merge 独占 + A 表冻结；**未满足前不开 U2** |

## 不做

**ADR-007 U2**（第一次上游 tag 合入）、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC、会话级模型策略 UI、F3 同窗共享 lease（[D22](deferred-gaps.md)）。
