---
title: "Development Progress"
type: progress
status: active
phase: M6
updated: 2026-09-02
summary: "2026-09-02 用户委托裁决解禁：R5 m6-engine-wave + ADR-003 accepted（M6-A1 可开、A2 待 S3+A1）；PRD-017–020 accepted（D13–D15）；D8 豁免为门禁降 P3；D9 出 Blockers；Blockers 仅剩 PRD-008 待接通证据。可并行：S1–S3（D）/ M6-A1（A）/ Diff F1–F5（C）"
---

# Development Progress

## Current Session

- **集成 HEAD：** `4a607cc2` — **agent-ide**（loop/B R5 签收、loop/C Diff F1–F2、loop/D S1 scaffold 已并入；**主仓工作树 `src/` 尚未 checkout 到该 HEAD**，见下条 Blockers「工作树同步」；开新波前各槽须 rebase 到本次裁决 commit 之后）。
- **已闭里程碑：** 壳层 PRD-001–016 / M5 / D1–D7 / **D11**；R6 closed @ [ADR-005](../decisions/005-changes-diff-owner.md)；**R5 closed**：[m6-engine-wave](../plans/m6-engine-wave.md) + [ADR-003](../decisions/003-engine-adapter-boundary.md) `accepted` @2026-09-02。
- **Loop 阻塞裁决（2026-09-02，用户委托「你来裁决」）：** loop 卡在四件只有人类能拍的事——① R5 两稿规则 16 已过却「待人类签收」，压住 M6 全波 + PRD-008 + stream-timeline S4–S6；② PRD-017–020 `proposed` 待签收，其中 PRD-017 存储落点、PRD-020 上限「待用户裁定」；③ D8 `valid-layers-check` 环境红挂在集成门禁里，每轮 closeout 都产生无法闭合的红项；④ D9 terminal 行需人工。**裁决**：R5 签收 `accepted` 并同批并入 stream-timeline §9；M6-A 拆 **A1 platform（与 S1–S3 并行）/ A2 contrib 接线（S3 + A1 后）**；PRD-017–020 全部 `accepted`（017 落点 `WORKSPACE`+`MACHINE`、不迁移；020 上限 1,000 / 5,000 写死；实施登记 D13 / D14 / D15 / D10，不阻塞 M6）；D8 降 P3 并豁免为门禁（[health-gates](health-gates.md) 改 `compile` + `eslint`）；D9 降 P3 出 Blockers。ADR-003 两处实施期选定（宿主进程、权限应答臂）由 M6-A2 补进其审查记录，不再等人类。
- **文档补齐波（2026-09-02，主仓）：** 新建 [systems/conversation](../../docs/systems/conversation/INDEX.md)（6 页）与 [systems/sources](../../docs/systems/sources/INDEX.md)、[reference/universe-agent](../../docs/reference/universe-agent/INDEX.md)、[壳冒烟验证指南](../../docs/guides/shell-smoke-verification.md)、[ADR-006 壳不变量](../decisions/006-shell-invariants.md)（追溯登记）；PRD-005 收进 Changes/Review、PRD-002 Route 以 PRD-015 为准、PRD-007 验收 2 对齐、新增 **PRD-017–020** 非功能需求（起草 `proposed`，同日裁决 `accepted`）；修正 agent-ui / parts-and-grid / chat INDEX / glossary 中「PRD-015 未实施」「D4/D5 open」「Changes 不走 Diff」等过时陈述；DOCUMENTATION 规则 3c（状态翻转后扫知识层）、规则 4 / 7 改指 status + evidence / `dev/archive/`；`check-docs-health.py` 纳管两新系统。Cursor CLI 只读审查 **Approve with changes**，3 Critical + 8 Important 已改入。
- **M6 时间线专章签收（2026-09-02）：** [conversation-stream-timeline](../plans/conversation-stream-timeline.md) `accepted` — 显示写源 `SessionEventStream` L1–L4；fold 复用 Desktop `session-core`（`view/**` → `platform/universeAgent/common/sessionView`，Actor → `node/sessionCore`）；同 token 增量加 `acquireSessionView`；attribution sidecar 解 role / agent；stub 改帧源；`TimelineTree` 三类帧增量。Cursor CLI Grok 两轮（Reject → Approve with changes）全部改入。对 m6 / ADR-003 的增量修订见其 §9 — **已随 R5 签收同批并入**（同日）。

## Blockers

- **PRD-008：** `blocked` 仅因**尚无接通证据**；方案面已全部签收（[m6-engine-wave](../plans/m6-engine-wave.md) / [ADR-003](../decisions/003-engine-adapter-boundary.md) / [stream-timeline](../plans/conversation-stream-timeline.md) 均 `accepted`）。解除 = M6-A2 合入 + 隔离 profile 启动冒烟。**不再有人类待决项。**
- 非阻塞、只记账：[D8](deferred-gaps.md)（`valid-layers-check` 豁免期）· [D9](deferred-gaps.md)（terminal 行待人工）。
- **工作树同步（操作性，src 提交前须先处理）：** 2026-09-02 `agent-ide` 引用在主仓被推进（`c0dfee3d` → `4a607cc2`，含 loop/C F1–F2 与 loop/D S1 scaffold），但主仓工作树 `src/` / `scripts/` 仍是旧内容，`git status` 把 F1–F2 / S1 新增文件显示为**删除**。索引已在裁决 commit 前用 `git reset`（mixed）同步到 HEAD；工作树未动。**在主仓 `git add -A` / `git commit -a` 会回退这些合并。** 处理：对非本地在途修改的路径 `git checkout HEAD -- <path>`；主仓另有在途改动（`.eslint-ignore` / `eslint.config.js` / `build/filters.ts` / `dev/plans/navigator-engine-segments.md` 等），不得覆盖。裁决 commit 只含 13 个文档文件，均按 HEAD 内容对齐（为 HEAD 的超集）。

## Next（后续开发任务排期，2026-09-02 裁决后）

**Wave 1 三槽并行（冲突域互斥，每域 1 写者）**；Wave 2 在 D 与 A 都终态合入后开。**任务源明确，禁止 Discovery / Wave 0。**

| 序 | 任务 | 类型 | 产出 / Exit | 工位 |
|:---|:-----|:-----|:------------|:-----|
| W1-D | **stream-timeline S1 → S2 → S3**（串行同槽）：S1 session-core 同步脚本 + `common/sessionView` / `node/sessionCore` + 帧契约 + stub 帧源 + boundary 测 + `code-layering` error → S2 三类帧增量 + 双写 → S3 发送链 / SyncChrome / shim。§7 需求改动（PRD-003/004/007 + PRD-021）已落，直接开 S1 | 实施 | 各切片单测绿；`npm run compile` + `npm run eslint` 绿；HEAD 三会话 fixture 可见行不变 | **D**（域：`contrib/conversation/**`、`platform/universeAgent/{common/sessionView,node/sessionCore}/**`、`conversationViewFrame.ts`、`scripts/sync-*`、`.eslint-ignore`） |
| W1-A | **M6-A1 platform adapter**（[m6 §8](../plans/m6-engine-wave.md#8-切片顺序)）：`platform/universeAgent/{common,node,electron-browser}` 连接契约 + gRPC 客户端 + Connect + `GrpcCapabilityProbe` + Session/History/Stream/Chat 传输原语 + ProxyChannel；mock channel 单测；宿主进程选定写 ADR-003 审查记录。**不改 `contrib/`**，不碰 D 的三处 | 实施 | 单测：token + 活 channel → connected、pairing-pending → false、probe UNIMPLEMENTED → UNSUPPORTED、transport failed 单列；compile + eslint 绿 | **A**（域：`platform/universeAgent/**` 除 D 的三处、`package.json` 依赖、`build/`） |
| W1-C | **sources-changes-diff F1–F5**（[plan](../plans/sources-changes-diff.md) `accepted`，用户免规则 16） | 实施 | 各切片单测绿；D4 式验收 Changes 行 → Preview Diff、移到对话窗口 / 底部往返 | **C**（域：`contrib/sources/**`、editor 围栏、Panel Diff 视图） |
| W2-a | **M6-A2 contrib 接线**（入口 = W1-D S3 与 W1-A 均合入 `agent-ide`）：引擎实现类替换 stub 同 token；stream-timeline **S4 / S5**；`submitDraft` / `appendStubEchoAssistant` / `deleteSession` 已连接语义；权限应答臂选定写 ADR-003 | 实施 | m6 §8 A2 验证全绿；隔离 profile 冒烟 hello → live → 断连快照；**PRD-008 升 `implemented`** | A 或 D（单写者） |
| W2-b | **D13 PRD-017 持久化**（入口 = S3 合入）：`WORKSPACE` + `MACHINE`；stub 会话 + UA 断连快照缓存；重启验收 | 实施 | [D13](deferred-gaps.md) Exit | D（与 W2-a 不同槽时须错开 `conversationStubService.ts`；否则串行） |
| W3 | **M6-B page-access 切片 5**（UI 合同）→ **M6-C customizations E1** → **M6-D trajectory T4**（= S6）；随后 **D14** 键位（M6-B 后）、**D15** Web 冒烟（A2 后）、**D10** T5（M6-D 后） | 实施 | 各方案 blocked 行转 `implemented`；D4 式隔离 profile 验收 | 按域分槽 |
| W4 | **D12 PRD-010 产品身份**（UniverseAgentStudio）— M6 闭后开 plan | plan → 实施 | 窗口标题 / 图标可识别 | 任一 |
| — | ~~R5 签收~~ / ~~PRD-017–020 签收~~ / ~~D8 作为门禁~~ / ~~D9 列 Blockers~~ — **均已于 2026-09-02 裁决关闭** | — | ✅ | — |

**closeout 提醒**：Wave 1 三槽合入后 `worktree-pool.md` 更新 HEAD；D8 豁免期内 closeout 门禁 = `compile` + `eslint`（[health-gates](health-gates.md)）。

**不做**（requirements.md 明确排除）：整仓迁移 Desktop 文档、Agents Window 当默认壳、Cursor/Codex trade dress、完整扩展分发。
