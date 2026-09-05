---
title: "PRD-020 无引擎回合 fixture 时延基准"
type: plan
status: accepted
phase: N/A
updated: 2026-09-05
summary: "本机、无引擎：1,000 回合 fixture 上测产品发送链（Dock 提交 → 该探针文案的 user 行出现，含 16 ms 帧合并）；appendUserTurn 只作诊断钟；记 p50/p95；证据落 prd-020-perf-evidence；升 PRD-020 前先把操作化写进 requirements 验收 1；不重开 D10；超限提示另切片。2026-09-05 第二轮对抗审查后签收"
---

# PRD-020 无引擎回合 fixture 时延基准

> **需求：** [PRD-020](../../docs/product/requirements.md#prd-020-规模与性能上限) 验收 1（`accepted`）：对话 1,000 回合、轨迹 5,000 记录规模下，发送一条消息到出现在时间线 ≤ 200 ms（**本机、无引擎**）。验收 2（轨迹搜索 / 虚拟化）已随 [PRD-012](../../docs/product/requirements.md#prd-012-conversation-轨迹透镜) T5 @ `94267eef` 落地；[D10](../progress/deferred-gaps.md) **已 closed**。  
> **前置（均已落，不再当本方案开工条件）：** [conversation-stream-timeline](conversation-stream-timeline.md) **S2** `applyEntries` 三类帧 @ `01c95143`；S3 shim / `lease.post` @ `03d4fb56`。D10 退出记录仍写「S2 后用 1,000 回合 fixture 测验收 1 并记本行」——测的是这条债，不是重开 T5。  
> **不推翻：** 轨迹 `CONVERSATION_TRAJECTORY_RECORD_LIMIT = 5000` 与 `limitNotice`（[lens-and-trajectory §3.2](../../docs/systems/conversation/lens-and-trajectory.md)）；Overview 瀑布条仍 Deferred。  
> **规则 16：** 2026-09-04 第一轮只读审查；2026-09-05 第二轮对抗性审查（Reject：钟漏 16 ms 帧合并、用测试 API 冒充「发送」）复核改入后**签收**（见文末）。  
> **签收裁定（2026-09-05）：** (1) 通过线的钟是**产品发送链**——Dock 提交 → 该探针文案的 user 行（pending 或正式）出现在对话时间线；`appendUserTurn` 钟降为**诊断钟**，只记录不判定。(2) 钟内必须包含产品的 **16 ms 帧合并**（`ConversationSessionViewFrameCoalescer`，patches 走 `setTimeout(16)`，只有 baseline 同步）；bench **禁止**手动 flush 或绕过 coalescer。(3) 升 PRD-020 之前，先按规则 10a 把本稿 §3 的操作化写进 `requirements.md` 验收 1（B3），否则 p50 再好也不得升 `implemented`。

## 0. 一句话结论

用 **Electron 单测夹具**（与 `conversationLens.test.ts` 同一套 `mountLens` + stub roster）稳定造 1,000 回合会话，在已 layout 的对话页上从 **Dock 提交**（与用户按 Enter 同一条产品链）开钟，轮询直到带该探针文案的 user 行出现在时间线 DOM（自然经过 16 ms 帧合并）；丢掉首屏 / 预热样本后报 **p50 / p95**。证据写入 `dev/progress/prd-020-perf-evidence/`（**不是** Settings 300px 的 D20，也不是 `d20-evidence`）。跑通后只在 D10 **补一节退出记录**，**不**把 D10 翻回 `open`。

## 1. 目标 / 非目标

**目标**

1. 给出可重复跑的本机时延证据，闭合 PRD-020 **验收 1**。闭合口径 = §3 本操作化（产品发送链 Dock 提交 → 探针 user 行；不是每样本 ≤ 200、不是 5,000 轨迹进钟），且该操作化须先写进 requirements 验收 1（B3）。
2. 种子工厂同时能稳定造 **1,000 对话回合** 与 **5,000 轨迹记录**（轨迹规模给验收 2 / 超限切片复用，不进 200 ms 钟）。
3. 证据目录、SHA、机器摘要、原始样本、p50/p95、通过判定写死，后人只跑一条命令即可复现。

**非目标**

| 不做 | 原因 |
|------|------|
| 引擎流式端到端 perf；stub echo **助手行**出现的时延 | PRD-020 验收 1 写死「无引擎」；钟的终点是 **user 行**出现（pending 行即算，见 §3），stub `setTimeout(0)` 之后的正式 user 行 + echo 助手行不进钟 |
| 把 CI 全绿当目标；改 `.github/workflows/chat-perf.yml`；默认 `scripts/test.sh` 必跑本 bench | 200 ms 是**本机**验收；上游 `chat-perf.yml` 是 Copilot mock-LLM + 生产包对比回归，场景与门禁都不可照搬 |
| 把 1,000 回合写进生产 `createSeedSessions()` | `untitled` 现为 7 条 fixture（D16 已有「种子数不对」债）；污染默认窗与现有单测 |
| 重开 D10 为 `open`；重做 T5 搜索 / 虚拟化 / Overview | D10 已 closed；Overview 仍 Deferred，不在本钟 |
| 用本钟测超限诚实提示 | 轨迹超限 UI 已有合同测（见 §6）；对话回合尚无 `CONVERSATION_TURN_LIMIT`。超限另切片，不进 200 ms |
| Playwright / 隔离 profile 活窗、内存泄漏、与 baseline 构建对比 | 验收 1 是 renderer 时间线 apply，不是发行包对比 |

## 2. HEAD 事实锚点（写入时核对）

| 事实 | 位置 |
|------|------|
| PRD-020 上限写死：对话 1,000 / 轨迹 5,000；验收 1 = 本机无引擎 ≤ 200 ms；验收 2 = T5 搜索与虚拟化 | `docs/product/requirements.md` PRD-020 |
| D10 **closed**：T5 搜索 / 虚拟化 / `limitNotice` 已落；退出条件仍含「S2 后用 1,000 回合 fixture 测验收 1 并记本行」 | `dev/progress/deferred-gaps.md` D10 行 |
| D20 **open**、且占用：Settings 默认窗 300px 目视，与 PRD-020 无关 | 同上 D20 行 |
| 生产 seed 只有 `untitled`（7 回合：user / thinking / tool ×2 / assistant / confirmation）与 `visualize`；**无** 1,000 回合工厂 | `conversationStubModel.ts` `createUntitledFixtureTurns` / `createSeedSessions` |
| `ConversationStubModel` 已能 `constructor(initialSessions)` 与 `replaceSessionCatalog`；`createTestFrameSourceCallback` **已**把 `model` 交给测试，缺的是 catalog 替换后的 `frameSource.refresh`（今日 `refresh` 在 `ConversationStubFrameSource` 上；回调的 `onSessionChanged` 只 fire 事件） | `conversationStubModel.ts:226,251` · `conversationStubService.ts:148-152` · `conversationStubFrameSource.ts:94` |
| `appendUserTurn`：model push → `notifySessionChanged` → `frameSource.refresh` → lease `reconcile` → **patches** 帧 → `onDidApplyFrame` | `conversationStubService.ts:285-290` · `conversationStubFrameSource.ts:94-103, 211-225, 270-273` |
| 透镜**不是**同步 `applyEntries`：`lease.onDidApplyFrame → coalescer.push`；`ConversationSessionViewFrameCoalescer` 对 patches 用 `setTimeout(FRAME_COALESCE_MS = 16)` 合并后才 `applySessionViewTimeline`；只有 baseline 同步 flush | `conversationLens.ts:1567-1568` · `conversationSessionViewFrameCoalescer.ts:10, 24-44` |
| HEAD 单测多数在 `appendUserTurn` 后 `await flushTimelineHeightUpdates()`（20 ms `setTimeout`）再查 DOM——正是这 20 ms 盖过了 16 ms 合并；`:1055-1067` 那条是同步查任意 `[data-kind="user"]`（无 `data-turn-id`、无 layout） | `conversationLens.test.ts:93-95, 1055-1067` |
| 产品发送链：Dock `submitDraft` → `postBound` → `lease.post({ kind:'submitInput', text })` → stub `writeSubmitInput`：**同步**写 `localPendingSends` + `refresh`（→ patches → 16 ms 后出现 `kind:'user', pending:true` 行，id `send:<opId>`），`setTimeout(0)` 后才 `appendUserTurn` + echo | `conversationLens.ts` `submitDraft` / `postBound` · `conversationStubFrameSource.ts:126-152` · `conversationSessionView.ts:238-249` |
| 测试里模拟用户发送已有工具：`dispatchDockKeydown(textarea, KeyCode.Enter)` | `conversationLens.test.ts:340-342` |
| 轨迹 extras **只** merge 给无引擎的 `untitled`（system / context / 用户 chip / 一条 subtool），数量个位数 | `conversationTrajectoryModel.ts` `shouldMergeTrajectoryFixtureExtras` / `mergeUntitledTrajectoryFixtures` |
| 1 回合 ≈ 1 条投影记录（`confirmation` / `visualization` / `reviewNav` 不进轨迹） | `projectTurnsToTrajectory` |
| 轨迹 5,000 上限 + 超限提示：**已有**纯函数测与 UI 测，用 `Array.from({ length: LIMIT + N })` **内存数组**，不是 1,000 回合 roster | `conversationTrajectory.test.ts:409` · `conversationTrajectoryUi.test.ts:287` |
| 对话页树是 `WorkbenchObjectTree`（虚拟化）；user 行带 `data-kind="user"` 与 `data-turn-id` | `conversationTimelineTree.ts` |
| 轨迹虚拟化是另一棵 `WorkbenchList`，与对话树不是同一棵 | `conversationTrajectory.ts` · trajectory-lens T5 |
| 上游 `chat-perf.yml`：`workflow_dispatch`、7 次 run、p 分位对比、Copilot `scripts/chat-simulation/**`、xvfb、生产包 | `.github/workflows/chat-perf.yml` — **只借鉴「预热 + 重复 + 写 JSON」**，不借鉴场景与门禁 |
| 聚焦单测：`scripts/test.sh --grep …`（Electron `test/unit/electron/index.js`） | `.github/copilot-instructions.md` · `scripts/test.sh` |
| 对话页**没有** `CONVERSATION_TURN_LIMIT`；超限诚实提示目前只存在于轨迹 | `rg` @ 2026-09-04 |

## 3. 测量定义（验收 1 钟）

**闭合 PRD-020 验收 1 = 本操作化：** **Dock 提交**（用户按 Enter 的同一条产品链）→ 带该探针文案的 user 行（pending 或正式）出现在对话时间线 DOM；通过线是 **p50 ≤ 200 ms**；钟内规模是 **1,000 对话回合**；钟内**包含** 16 ms 帧合并；**5,000 轨迹记录不进钟**。不是每个样本都 ≤ 200 ms，不是把 5,000 轨迹灌进同一口钟，不是测试 API `appendUserTurn`（那是诊断钟，§3.3）。

**主钟：产品发送链（唯一通过线）**

```text
T0  performance.now()
    dock textarea.value = uniqueProbeText；dispatchDockKeydown(textarea, Enter)
      → ConversationLens.submitDraft → postBound → lease.post({ kind:'submitInput', text })
      → ConversationStubFrameSource.writeSubmitInput：
          localPendingSends 写入 + refresh → lease.reconcile → patches 帧
      → coalescer.push（setTimeout 16 ms）→ applySessionViewTimeline → applyEntries
      → 树渲染（虚拟化；须滚底使新行进入 DOM）
T1  轮询首次 query 到
      .conversation-lens-turn[data-kind="user"] 且其 body 文本 === uniqueProbeText
      （pending 行 id 为 send:<opId>，正式行 id 为 turn.id；两者任一出现即停表）
耗时 = T1 − T0
```

| 项 | 裁定 |
|----|------|
| 起点 | 派发 Enter keydown **之前**的 `performance.now()`。`submitDraft` 是 async；bench 不 await 它，只轮询 DOM |
| 终点 | 带探针文案的 user 行出现在**对话页**时间线 DOM，pending 或正式皆可（用户看到的就是这一行）。探针文案唯一（`prd020-probe-<trial>-<n>`），按**文本相等**匹配；禁止用「任意一条 user 行」或 `getTurns().length` 冒充 |
| 轮询 | 用 `requestAnimationFrame` 轮询（每帧查一次），上限 1,000 ms；查到即停。**禁止**手动 flush coalescer、禁止 stub 掉 `setTimeout`、禁止把 `FRAME_COALESCE_MS` 改小或注入同步 coalescer——16 ms 是产品路径的一部分，本来就该算在 200 ms 里。也**禁止**在 T0 之后、T1 之前调 `layoutReadingColumn`（用户不会） |
| 容器 | mount 后必须 layout 到非零尺寸（`LENS_LAYOUT_WIDTH × LENS_LAYOUT_HEIGHT`），并断言 `slots.timeline.clientHeight > 0`——D16 已证明高度 0 时 `querySelector` 也能命中，那不是「出现在时间线」 |
| 排除 | Electron / mocha 启动；`transpile` / `compile`；第一次 `mountLens` + 第一次把 1,000 回合 `applyEntries` 进树（**首屏**）；预热样本（§3.1） |
| 不含 | `setTimeout(0)` 之后的正式 user 行替换 pending、stub echo 助手行；gRPC；轨迹页切换；搜索框 |
| 规模 | 每次开钟前（含 2 次预热）对话回合数 **恰好 1,000**，`localPendingSends` 为空。每个样本结束后在钟外 `await` 至 stub 的 `setTimeout(0)` + 16 ms 合并落定（pending 已替换为正式 user + echo 两行），再 `deleteTurn` 删掉这两行，开钟前回合数恒为 1,000（禁止累积成 1,002…1,026） |

### 3.3 诊断钟：`appendUserTurn`（记录，不判定）

同一夹具再跑一组 `appendUserTurn(sessionId, probe)` → 该 `data-turn-id` user 行出现（同样经 coalescer，同样 rAF 轮询）。写进 `results.json` 的 `diagnostic.appendUserTurnMs`，用来拆分「Dock / lease / pending 投影」与「帧合并 + 树渲染」两段开销；**不参与 `pass` 判定**，不写进 PRD 文案。

### 3.1 重复与分位

| 项 | 值 |
|----|----|
| 预热（丢弃） | 2；每次预热同样走 §3 主钟路径，样本丢弃；**预热后也钟外等落定并删探针两行** |
| 计入样本 | 11（奇数，p50 为第 6 个有序值）；每次开钟前回合数恒为 1,000 |
| p50 | 有序样本的中位数 |
| p95 | 线性插值（NIST）：`index = 0.95 × (n − 1)`，在相邻样本间插值 |
| 本机通过线 | **p50 ≤ 200 ms**（对应 PRD「一条消息」的典型时延） |
| 记录但不单独否决 | p95；若 p95 > 400 ms，证据标「尾延迟偏高」 |

单次尖峰不改 PRD 数字。p50 超 200 ms → 本切片 **FAIL**，证据照写，**不**把 PRD-020 升 `implemented`，**不**重开 D10。

### 3.2 环境钉死（证据必写）

- 本机；无引擎（`isEngineConnected() === false`）；`ConversationStubService` 不是 `ConversationEngineRosterService`。
- 记录：`git rev-parse HEAD`、`uname -srm`、CPU 型号 / 逻辑核数、是否在 worktree、`scripts/test.sh` 完整命令行。
- 不在共享 CI runner 上把 200 ms 当红线。

## 4. Fixture

### 4.1 为什么不能循环 `appendUserTurn` 造 1,000 回合

每次 `appendUserTurn` 都会 `refresh` + 事件。用它当种子会先付 1,000 次树更新，且慢、不稳定。种子必须 **一次写入 catalog**，只对**探针那一次** Dock 提交开钟。

### 4.2 工厂（测试树，不进生产 seed）

新文件（实施时）：

`src/vs/workbench/contrib/conversation/test/browser/conversationPrd020ScaleFixture.ts`

| 导出 | 行为 |
|------|------|
| `PRD020_CONVERSATION_TURN_COUNT = 1000` | 与 PRD 字面一致 |
| `PRD020_TRAJECTORY_RECORD_COUNT = 5000` | 同上 |
| `createPrd020ConversationTurns(count)` | 偶数下标 `user`、奇数 `assistant`（`stubEcho: true`），文案短且含 `Stub:`，id 稳定：`prd020-t-0001` … |
| `createPrd020TrajectoryRecords(count)` | 纯 `ConversationTrajectoryRecord[]`（`kind: 'message'`，id `prd020-r-0001` …），供轨迹页 `setRecords` / 超限切片；**不**经 `untitled` extras |
| `createPrd020ScaleSession(turnCount)` | `{ id: 'prd020-scale', title: 'PRD-020 scale (Stub)', turns, source: 'local' }` |

**禁止**把 `prd020-scale` 加进 `STUB_TRAJECTORY_FIXTURE_SESSION_IDS` / `createSeedSessions`。轨迹 5,000 条走工厂数组，与 T5 `Array.from` 同构、可复现。

1,000 回合 **不能**投影出 5,000 条轨迹（1:1，且 confirmation 还不进轨迹）。两套规模分开造，不要用「把 extras 偷偷 merge 进 untitled」凑数。

### 4.3 注入 roster

HEAD：`createTestFrameSourceCallback()` **已**把 `model` 交给测试（`conversationStubService.ts:148`）。缺的是 catalog 替换后的 `frameSource.refresh`：今日 `refresh` 在 `ConversationStubFrameSource` 上（`:94`）；回调给出的 `onSessionChanged` 只 fire 事件，**不** refresh。`notifySessionChanged`（`:279`）才是 refresh + fire，但是 private。

**优先补 refresh 挂钩，不要先造第三条生产 API：**

1. **首选：** bench 走已有 `createTestFrameSourceCallback().model.replaceSessionCatalog`，并补一条测试专用、能对 `activeId` 调 `frameSource.refresh`（或与 `notifySessionChanged` 同语义）的窄钩子。
2. **不要先做：** 给 `ConversationStubService` 再加 `replaceSessionCatalogForTests`，或给生产构造加可选 `initialSessions`。若挂钩仍不够，实施时再判，仍须测试专用、不进产品契约。

注入后：`switchSession('prd020-scale')` → `mountLens` 已存在则可只 `layout`；新 mount 则构造后立刻 layout。首屏 `applyEntries(1000)` **在钟外**（切会话触发 baseline，同步 flush）。

**与同批方案的顺序（签收裁定）：** B0 要改 `conversationStubService.ts` 的测试钩子，而 [test-baseline-ci](test-baseline-ci.md) 切片 1（D16 账本落地）独占该文件——**B0 等切片 1 合入**。B1 只读 `conversationTimelineTree.ts` / `conversationLens.ts` 的 DOM，不改它们；[giant-file-split](giant-file-split.md) GFS-2/3 若先合入，B1 只需跟 import 路径；若 B1 先合入，GFS 不得改 `data-kind` / `data-turn-id` 选择器。

### 4.4 落点：test 还是 scripts/

| 产物 | 路径 | 职责 |
|------|------|------|
| 种子工厂 + mocha bench | `contrib/conversation/test/browser/` | 唯一能看到 `ConversationLens` / 树 DOM 的环境；与现有 `mountLens` 同构 |
| 薄包装 | `scripts/prd-020-turn-fixture-bench.sh` | 设 `PRD020_BENCH=1`，调 `scripts/test.sh --grep`，把 mocha 打印的 JSON 拷进证据目录 |
| 默认生产 / 默认单测 | 不改 | 无 env 时 bench 用 **`this.skip()`**（mocha 记为 skipped，进 JUnit `<skipped/>`），**不得**写成空 `return` 假绿；test-baseline-ci 的 `max_skipped` 阈值须把本 suite 计入（B1 合入时同 PR 改基线文件头） |

**不**做独立 `node` 脚本直接 `require` lens：无 Electron / `workbenchInstantiationService` 就没有时间线 DOM，测不到「出现在时间线」。

## 5. 运行方式与证据

### 5.1 命令

```bash
# 本机（需已能跑 conversation browser 单测的同一前置：compile / electron）
PRD020_BENCH=1 scripts/test.sh --grep 'PRD-020 turn fixture bench'
```

或：

```bash
./scripts/prd-020-turn-fixture-bench.sh
```

包装脚本负责：检查 `PRD020_BENCH`、调用上面的 `test.sh`、把 stdout 里一块 `BEGIN_PRD020_BENCH_JSON` … `END_PRD020_BENCH_JSON` 写到证据文件。失败时 **exit 非 0**（方便本机看到 FAIL），但 **不**接入任何 GitHub workflow。

### 5.2 证据目录（另起名，避开 D20）

**`dev/progress/prd-020-perf-evidence/`**

| 不用 | 原因 |
|------|------|
| `d20-evidence/` | [D20](../progress/deferred-gaps.md) 已占用：Settings 300px 目视 |
| `d20-perf-evidence/` | 仍带 `d20`，易与 Settings 债混淆 |
| 只写 `d10-evidence/` 当唯一落点 | D10 是 T5 缺口行，已 closed；本钟是 PRD-020 验收 1。D10 **节**里链过来即可 |

单次运行子目录：`prd-020-perf-evidence/<UTC-YYYYMMDD-HHMM>-<shortSHA>/`

必含：

- `results.json` — §3.2 字段 + `samplesMs`（主钟）+ `p50` + `p95` + `pass`（主钟 p50≤200）+ `definition` 原文（与 §3 一致，含「Dock 提交 → 探针 user 行，含 16 ms 帧合并」）+ `warmupDiscarded` + `diagnostic.appendUserTurnMs`（§3.3，不参与判定）+ `timelineClientHeight`（须 > 0）
- `README.md` — 命令、机器、是否通过、一句话结论
- mocha 原始 log（可选 `mocha.log`）

`results.json` 由 **bench 测试进程写出**（`fs.writeFileSync` 到 `process.env.PRD020_EVIDENCE_DIR`，缺省则打 JSON 块到 stdout 由包装脚本落盘）。不要手抄毫秒数。

### 5.3 与上游 chat-perf 的借鉴边界

**可借鉴：** 预热次数、多次 run、分位、JSON 产物、`workflow_dispatch` 式「人来了再跑」。  
**禁止搬进本仓门禁：** `extensions/copilot`、`scripts/chat-simulation/**`、`--production-build`、baseline 构建对比、leak-check job、把本 bench 挂到 `on: push`。

## 6. 超限诚实提示（本方案不测进 200 ms）

PRD-020 用户可观察陈述还有「超限时诚实提示而非静默截断」。HEAD 分叉：

| 面 | HEAD | 本方案 |
|----|------|--------|
| 轨迹 > 5,000 | `applyTrajectoryRecordLimit` 留最近段 + `.conversation-lens-trajectory-limit-notice`；单测已覆盖 LIMIT+5 / +42 | **不**纳入 B1 钟。工厂 `createPrd020TrajectoryRecords(5000)` 可供日后手跑；超限 UI **不重写** |
| 对话 > 1,000 | **无**回合上限常量，也无对话页 notice | **B2（另切片，默认不排）**：若产品要对话超限提示，先在 PRD / 代码加 `CONVERSATION_TURN_LIMIT` 再测。B1 在恰好 1,000 时追加第 1,001 条探针，**预期行仍出现**（与今日实现一致） |

B1 失败阈值只认 §3.1。超限文案、截断策略、轨迹搜索在 5,000 上的手感 **不是**本钟。

## 7. 与 D10 的闭合关系

D10 表行保持 **`closed`**。

B1 证据落地后（**另一次文档提交**，不在本稿；即 B3）：

0. **先钉操作化（规则 10a 第 1 步）：** 在 `requirements.md` PRD-020 验收 1 末尾追加一句「操作化：本机无引擎，1,000 回合会话，从 Dock 提交到带该文案的 user 行出现在时间线（含帧合并），11 样本 p50 ≤ 200 ms；见 [prd-020-turn-fixture-bench §3](../../dev/plans/prd-020-turn-fixture-bench.md)」。没有这一句，下面任何升格都不成立——需求正文写的是「发送一条消息」，证据必须能对上它。
1. 在 `deferred-gaps.md` **追加**一节 `## D10 PRD-020 验收 1 补记（YYYY-MM-DD）`，链到 `prd-020-perf-evidence/<run>/`，抄 p50 / p95 / SHA / 通过与否。
2. **不**改 D10 的 Status 列；**不**把 Priority / Track 改回 open。
3. 若 p50 > 200 ms：补记写 FAIL + 数字；缺口若要跟进，**新开** D 行——编号取 `deferred-gaps.md` 表里的**下一空号**（D21 已被 [m7-gap-closeout](m7-gap-closeout.md) 摘要预留但尚未入表，不要硬写 D21 或 D22），主题写 PRD-020 验收 1 超阈，不要复活 D10。
4. 升 PRD-020 为 `implemented` 须：步骤 0 已落 **且** 主钟 `pass: true` **且** 验收 2 已在 T5。升格是知识层另步，走规则 10a / 3c；[docs-burden-reduction](docs-burden-reduction.md) S1 落地后，traceability 产品状态列由脚本刷新，不手改。

## 8. 切片

| # | 内容 | 验证 | 默认排期 |
|---|------|------|----------|
| B0 | `conversationPrd020ScaleFixture.ts` + `createTestFrameSourceCallback` 换 catalog + refresh 挂钩（不先造第三条生产 API）；工厂单测：1,000 turns、5,000 records、id 稳定、文案含 Stub | mocha 无 DOM 即可 | **等 test-baseline-ci 切片 1 合入**（同文件互斥）；与 B1 同 PR |
| B1 | `conversationPrd020Bench.test.ts`：mount 对话页并 layout 到非零尺寸 → 注入 1,000 回合 → 首屏丢弃 → 预热 2（钟外落定 + 删探针）→ 测 11 × **Dock 提交**主钟（rAF 轮询到探针 user 行；每次开钟前恒为 1,000）→ 附 §3.3 诊断钟 → 写证据。无 env `this.skip()` | `PRD020_BENCH=1 scripts/test.sh --grep 'PRD-020 turn fixture bench'`；主钟 p50≤200 本机 PASS | **本方案主切片** |
| B1s | `scripts/prd-020-turn-fixture-bench.sh` 包装 + `prd-020-perf-evidence/` README 模板（无数字）+ test-baseline 基线文件头 `max_skipped` 计入本 suite | 包装能落 `results.json` | 随 B1 |
| B2 | 对话回合超限诚实提示（新产品行为） | 先改 PRD / 代码再测 | **不排**；见 §6 |
| B3 | requirements 验收 1 追加操作化句（§7 步骤 0）+ D10 补记 + 视结果决定是否升 PRD-020 | 改 `requirements.md` 一句 + `deferred-gaps.md`（及规则 3c 扫到的口吻） | 证据产生后 |

## 9. 验收

**B1 完成当且仅当：**

1. 未改生产 seed；无 env 时 bench `this.skip()`（不是空 return）。
2. 本机按 §5.1 跑通，`results.json` 含 §3 定义原文、11 个主钟样本、p50、p95、HEAD SHA、`timelineClientHeight > 0`、诊断钟数值。
3. 主钟 p50 ≤ 200 ms → 证据 `pass: true`；否则 `pass: false` 且数字诚实。
4. 钟的起点 / 终点与 §3 一致（Dock Enter → 带探针文案的 user 行出现即停表，含 16 ms 帧合并），不是 `appendUserTurn` / 不是「任意 user 行」/ 不是轨迹行 / 不是 5,000 轨迹进钟；bench 源码里不得出现对 coalescer、`setTimeout`、`FRAME_COALESCE_MS` 的任何 stub / 改写。通过线只认 p50，不要求每个样本 ≤ 200 ms。
5. 未把本 bench 挂进 `chat-perf.yml` 或默认 CI。
6. **B3 完成当且仅当** requirements 验收 1 已含操作化句，且 PRD-020 状态变更（若有）走规则 10a。

**本方案文档完成 ≠ B1 完成。** 本稿只定合同。

## 10. 风险

| 风险 | 处理 |
|------|------|
| 1,000 行树首屏很慢 | 首屏在钟外；若 mount 超时，bench `this.timeout` 提到 60s，与测量阈值无关 |
| 虚拟化导致新行不在 DOM | 开钟前保持滚底（用户发消息时的常态）；终点必须是带探针文案的 user 行；1,000 ms 内查不到记夹具失败，不得改查 `getTurns().length` 冒充「出现在时间线」 |
| 为了过线绕开 16 ms 合并 | §3 / §9 明禁；证据 `definition` 原文写明含帧合并；p50 若稳定落在 16–30 ms 区间反而是路径正确的证据 |
| D16 conversation 单测基线红 | bench **独立文件 / 独立 suite 名**，不塞进 `conversationLens.test.ts` |
| 有人用 `untitled` extras 凑 5,000 | 工厂拒绝依赖 `mergeUntitledTrajectoryFixtures` |
| 把 FAIL 写成「环境问题」藏掉 | `pass` 只由 p50 与 200 ms 比较；环境写在 JSON 里但不改判定 |

## 11. 自检（改稿当轮 Read）

| 检查 | 结果 |
|------|------|
| frontmatter：title / type: plan / status: accepted / phase: N/A / updated: 2026-09-05 / summary | 有；无 `origin: multi-party-design-review` |
| 目标 / 非目标；200 ms 本机；CI 非目标 | §1；闭合口径指向 §3 |
| 测量定义：闭合验收 1 = 本操作化（Dock 提交、含 16 ms 合并、p50≤200、1,000 进钟、5,000 不进钟；appendUserTurn 仅诊断） | §3 首句 · §3.3 |
| 预热 2 次也钟外落定 + 删探针；开钟前恒为 1,000 | §3 规模行 · §3.1 · B1 |
| 查到带探针文案的 user 行即停表（pending 或正式） | §3 T1 / 终点 |
| 容器非零高度断言 | §3 容器行 · §5.2 |
| 升格前先钉 requirements 操作化句 | §7 步骤 0 · B3 · §9.6 |
| catalog：已有 `createTestFrameSourceCallback` 交 model；缺 refresh；不先造第三条生产 API | §2 · §4.3 · B0 |
| fixture 1,000 / 5,000；test 工厂 + 可选 scripts 包装 | §4 |
| 证据目录避开 D20 | `prd-020-perf-evidence` |
| 超限可分切片 | §6 B2 不排 |
| D10 保持 closed，只补记 | §7 |
| 切片 + 验收 | §8–§9 |
| HEAD 锚：trajectoryUi `:287`；lens `:1055-1067` 是同步查任意 user 行的角色头测（不是本钟的先例）；coalescer `:10, 24-44`；lens `:1567-1568` | §2 |
| HEAD：S2 已落、生产 seed 无大规模工厂、轨迹超限已有测、Dock post 先 pending 再 setTimeout(0) | 与 §2 一致 |

## 12. 审查记录（规则 16）

**2026-09-04：** 只读审查（父会话派 `generalPurpose`；不改文件）。**无 Critical**。Important 当轮全部改入；Minor 已改入。`status` 保持 `draft`，未签收、不得实施。

| 意见 | 处理 |
|------|------|
| I1 §3 未一句话钉死「闭合验收 1 = 本操作化」 | §3 首句固定：`appendUserTurn`、p50≤200 ms、1,000 对话回合进钟、5,000 轨迹不进钟；排除 Dock / 每样本≤200 / 5,000 进钟。§1 / §9 对齐。**（第二轮 C2 推翻「排除 Dock」：主钟改为 Dock 产品链，见下）** |
| I2 预热 2 次未要求钟外删探针，开钟前回合数可能不是 1,000 | §3 规模行 + §3.1 + B1：预热与计入样本均钟外删探针，开钟前恒为 1,000 |
| I3 「catalog 未暴露」与 HEAD 不符；`createTestFrameSourceCallback` 已交 model | §2 / §4.3 / B0：改口为缺 `frameSource.refresh`；优先补 refresh 挂钩，不先造 `replaceSessionCatalogForTests` / 构造 `initialSessions` |
| M1 `conversationTrajectoryUi.test.ts` 行号 285 → 287 | §2 改 `:287`（`Array.from({ length: LIMIT + N })` 在该行） |
| M2 lens「发送后见 user 行」锚 `:477` / `:1059` → `:1059–1061` | §2 改（`appendUserTurn` → echo → query user 行） |
| M3 查到 `data-turn-id` 即停表未写死 | §3 T1 / 终点 / 布局 / §9：查到即停，未查到才继续等剩余 rAF |

**2026-09-05 第二轮（对抗性，Cursor CLI · grok-4.6，结论 Reject）→ 复核改入后签收：** 第一轮「无 Critical」不成立；两条 Critical 经 HEAD 复核属实。

| 意见 | 复核 | 处理 |
|------|------|------|
| C1 钟漏了产品 16 ms 帧合并：lens 订 `coalescer.push`，patches 走 `setTimeout(16)`；原稿「至多 2 rAF」与 16 ms 无序，且明禁 20 ms 等待——字面执行会红，绕过 coalescer 会假绿 | 属实（`conversationSessionViewFrameCoalescer.ts`、`conversationLens.ts:1567-1568`；HEAD 单测靠 `flushTimelineHeightUpdates` 20 ms 盖过） | §3 重写：rAF 轮询到 1,000 ms，16 ms 合并在钟内，禁止 flush / stub / 改常量；§2 增两行锚点；§9.4、§10 |
| C2 用测试 API `appendUserTurn` 冒充 PRD「发送一条消息」，且可凭 p50 升 `implemented` | 属实（产品链是 `submitDraft → postBound → lease.post → writeSubmitInput`） | 主钟改为 Dock 提交 → 探针 user 行（pending 即算）；`appendUserTurn` 降为 §3.3 诊断钟；§7 步骤 0 / B3 / §9.6：升格前先把操作化写进 requirements 验收 1 |
| I1 与 test-baseline-ci 互斥缺顺序；无 env 空 return 假绿 | 属实 | §4.3：B0 等切片 1；§4.4 / §9.1：`this.skip()`，`max_skipped` 计入 |
| I2 `:1059-1061` 锚点夸大（无 layout、无 `data-turn-id`、查任意 user 行） | 属实 | §2 / §11 改口 |
| I3 GFS-2/3 互斥；高度 0 时 `querySelector` 也命中 | 属实 | §4.3 顺序；§3 容器行 + `timelineClientHeight` 入证据 |
| Minor 下一 D 号不是 D22 | 部分属实（D21 被 m7 摘要预留未入表） | §7.3 改「下一空号」 |
| Minor 删 5,000 工厂 / p95 / 包装脚本 | 不采纳 | 5,000 工厂给 B2 与轨迹复用、p95 记录尾延迟、包装脚本落证据，都不增加通过线复杂度 |

**签收裁定：** 主钟 = 用户动作到用户可见，含产品自己的 16 ms 合并；任何让钟变快的测试技巧都是作弊。实施顺序：test-baseline 切片 1 → B0 + B1 + B1s（同 PR）→ B3。

门禁：[DOCUMENTATION.md 规则 16](../../docs/DOCUMENTATION.md)
