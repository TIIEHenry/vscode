---
title: "Development Progress"
type: progress
status: active
phase: M6
updated: 2026-09-02
summary: "C 槽 I3b：hicolor 进 deb/rpm、electron 元数据改本产品；三平台完整 gulp 打包未跑（D17）。其余：R5/ADR-003 accepted；PRD-017–020 accepted；D8 豁免门禁。"
---

# Development Progress

## Current Session

- **C 槽 I3b 品牌打包接线（本工位，`loop/C` @ `c9f4417c`）：** `gulpfile.vscode.linux.ts` 把 I3a `resources/linux/icons/hicolor/{16..512}` 打进 **deb/rpm**（snap 仍只放 `snap/gui` 单图，`prime: -usr/share/icons`）；rpm spec `%install/%files` 同步列出。`electron.ts` `companyName`/`copyright`/`darwinHelpBookFolder`/`darwinHelpBookName` 改 `product.nameLong`。desktop / VisualElements `ShortDisplayName` / Inno 位图路径 / `manifest.json` name 已由 I2+I3a 对齐，本 slice 未重写。未跑完整 gulp 三平台打包 → [D17](deferred-gaps.md)。
- **B 槽 Q5 键盘 / question（本工位）：** question 投影不再因 `multiSelect`/`allowCustom` 关掉提交座位；checkbox + 自定义输入走 `questionRespond` 的 `selectedLabels[]`/`customText`。visualize / 子代理 overlay 打开抢焦点并 Tab 循环。Conversation 获焦时 `Ctrl+\\` / `Ctrl+PageDown` 作用于 chat tab / split，不打到 Preview。chat tablist 左右键只切同组 tab；子代理 Escape 先关局部 inspector，再关对话框，不关根会话。
- **集成 HEAD：** `4a607cc2` — **agent-ide**（loop/B R5 签收、loop/C Diff F1–F2、loop/D S1 scaffold 已并入；**主仓工作树 `src/` 尚未 checkout 到该 HEAD**，见下条 Blockers「工作树同步」；开新波前各槽须 rebase 到本次裁决 commit 之后）。
- **已闭里程碑：** 壳层 PRD-001–016 / M5 / D1–D7 / **D11**；R6 closed @ [ADR-005](../decisions/005-changes-diff-owner.md)；**R5 closed**：[m6-engine-wave](../plans/m6-engine-wave.md) + [ADR-003](../decisions/003-engine-adapter-boundary.md) `accepted` @2026-09-02。
- **Loop 阻塞裁决（2026-09-02，用户委托「你来裁决」）：** loop 卡在四件只有人类能拍的事——① R5 两稿规则 16 已过却「待人类签收」，压住 M6 全波 + PRD-008 + stream-timeline S4–S6；② PRD-017–020 `proposed` 待签收，其中 PRD-017 存储落点、PRD-020 上限「待用户裁定」；③ D8 `valid-layers-check` 环境红挂在集成门禁里，每轮 closeout 都产生无法闭合的红项；④ D9 terminal 行需人工。**裁决**：R5 签收 `accepted` 并同批并入 stream-timeline §9；M6-A 拆 **A1 platform（与 S1–S3 并行）/ A2 contrib 接线（S3 + A1 后）**；PRD-017–020 全部 `accepted`（017 落点 `WORKSPACE`+`MACHINE`、不迁移；020 上限 1,000 / 5,000 写死；实施登记 D13 / D14 / D15 / D10，不阻塞 M6）；D8 降 P3 并豁免为门禁（[health-gates](health-gates.md) 改 `compile` + `eslint`）；D9 降 P3 出 Blockers。ADR-003 两处实施期选定（宿主进程、权限应答臂）由 M6-A2 补进其审查记录，不再等人类。
- **文档补齐波（2026-09-02，主仓）：** 新建 [systems/conversation](../../docs/systems/conversation/INDEX.md)（6 页）与 [systems/sources](../../docs/systems/sources/INDEX.md)、[reference/universe-agent](../../docs/reference/universe-agent/INDEX.md)、[壳冒烟验证指南](../../docs/guides/shell-smoke-verification.md)、[ADR-006 壳不变量](../decisions/006-shell-invariants.md)（追溯登记）；PRD-005 收进 Changes/Review、PRD-002 Route 以 PRD-015 为准、PRD-007 验收 2 对齐、新增 **PRD-017–020** 非功能需求（起草 `proposed`，同日裁决 `accepted`）；修正 agent-ui / parts-and-grid / chat INDEX / glossary 中「PRD-015 未实施」「D4/D5 open」「Changes 不走 Diff」等过时陈述；DOCUMENTATION 规则 3c（状态翻转后扫知识层）、规则 4 / 7 改指 status + evidence / `dev/archive/`；`check-docs-health.py` 纳管两新系统。Cursor CLI 只读审查 **Approve with changes**，3 Critical + 8 Important 已改入。
- **Connection Hub 接入方案（2026-09-02，主仓）：** 新建 [connection-hub-client](../plans/connection-hub-client.md) **`accepted`**——对照上游 `connection-hub` 三稿 + ADR-261/318/374/375 + proto、Desktop `apps/desktop/src/main/engine/**`（ADR-025/026/027）与 Singularity `ConnectionResolver` / `HubApiClient`，结论：IDE 扮演 **Client 设备**，接入 = M6-A1 gRPC 宿主上增「Hub 解析 + Device Grant」拨号臂；v1 中继 + DirectAddress、GUA 直连留 v2；refresh 加密持久化（main 侧 `IEncryptionMainService` + `IApplicationStorageMainService`；与 Desktop ADR-026 不同，因 access 默认 15 min + I4 自动重连）；**宿主 = electron-main** 已写入 ADR-003 审查记录；切片 H0→H1/H2→H3→H4a/H4b→H5→H6。规则 16：用户授权 Cursor CLI Grok，CLI 被账单拦截，改 Grok Build CLI 四轮（一轮作废；事实 14 条全部有锚点，PRD-024 措辞撞 PRD-007 验收 4 等有效意见已改入），用户委托「架构你定」据此签收。
- **stream-timeline S1 主仓增量（2026-09-02，未提交，待合入 `agent-ide`）：** 在 HEAD `0649602d`（loop/D 脚手架）之上：`common/sessionView/index.ts` 补 `applyViewFrame` / `createEmptyReplica` / `emptySessionViewSnapshot` 等值导出（HEAD 仅类型）；`conversationViewFrame.ts` 加 `stub` 标记、`DetailPatch` / `details` sidecar、`overlayAttributionKey`、`IConversationViewFrameSource`；`IConversationRosterService.acquireSessionView`（同 token）；新文件 `conversationSessionView.ts`（`stubTurnsToSnapshot` / `projectSnapshotToEntries` / `entriesToLegacyTurns` / `diffProjections`）、`conversationStubFrameSource.ts`、`conversationSessionView.test.ts`（11 测绿）；boundary 测加 `sessionView` 自包含断言。附带修复：`conversationLens.test.ts` 夹具（`TestLayoutService`，原 73 测无法启动）、`getVisibleTimelineIndices` 越界防御。基线对照确认 Lens 11 / IdentityStrip 1 / StubService 3 个失败为 HEAD 既有 → [D16](deferred-gaps.md)。**注意**：主仓工作树在 `src/` 上曾落后 HEAD，本次已对非本地改动路径 `git checkout HEAD --`；提交时只 `git add` 上述 9 个路径。
- **M6 时间线专章签收（2026-09-02）：** [conversation-stream-timeline](../plans/conversation-stream-timeline.md) `accepted` — 显示写源 `SessionEventStream` L1–L4；fold 复用 Desktop `session-core`（`view/**` → `platform/universeAgent/common/sessionView`，Actor → `node/sessionCore`）；同 token 增量加 `acquireSessionView`；attribution sidecar 解 role / agent；stub 改帧源；`TimelineTree` 三类帧增量。Cursor CLI Grok 两轮（Reject → Approve with changes）全部改入。对 m6 / ADR-003 的增量修订见其 §9 — **已随 R5 签收同批并入**（同日）。

## Blockers

- **PRD-008：** `blocked` 仅因**尚无接通证据**；方案面已全部签收（[m6-engine-wave](../plans/m6-engine-wave.md) / [ADR-003](../decisions/003-engine-adapter-boundary.md) / [stream-timeline](../plans/conversation-stream-timeline.md) 均 `accepted`）。解除 = M6-A2 合入 + 隔离 profile 启动冒烟。**不再有人类待决项。**
- 非阻塞、只记账：[D8](deferred-gaps.md)（`valid-layers-check` 豁免期）· [D9](deferred-gaps.md)（terminal 行待人工）。
- **工作树同步（操作性，src 提交前须先处理）：** 2026-09-02 `agent-ide` 引用在主仓被推进（`c0dfee3d` → `4a607cc2`，含 loop/C F1–F2 与 loop/D S1 scaffold），但主仓工作树 `src/` / `scripts/` 仍是旧内容，`git status` 把 F1–F2 / S1 新增文件显示为**删除**。索引已在裁决 commit 前用 `git reset`（mixed）同步到 HEAD；工作树未动。**在主仓 `git add -A` / `git commit -a` 会回退这些合并。** 处理：对非本地在途修改的路径 `git checkout HEAD -- <path>`；主仓另有在途改动（`.eslint-ignore` / `eslint.config.js` / `build/filters.ts` / `dev/plans/navigator-engine-segments.md` 等），不得覆盖。裁决 commit 只含 13 个文档文件，均按 HEAD 内容对齐（为 HEAD 的超集）。

## Next（后续开发任务排期，2026-09-02 裁决后）

**Wave 1 三槽并行（冲突域互斥，每域 1 写者）**；Wave 2 在 D 与 A 都终态合入后开。**任务源明确，禁止 Discovery / Wave 0。**

| 序 | 任务 | 类型 | 产出 / Exit | 工位 |
|:---|:-----|:-----|:------------|:-----|
| W1-D | **stream-timeline S1 → S2 → S3**（串行同槽）：~~S1~~ **S1 done @2026-09-02**（脚手架 = loop/D `a1cd9897`/`0649602d` 已在 HEAD；**帧源 / 投影 / `acquireSessionView` 接线 / 值导出 barrel / sidecar 契约 / 11+2 单测在主仓工作树未提交**，见 Current Session）→ S2 三类帧增量 + 双写 → S3 发送链 / SyncChrome / shim。§7 需求改动（PRD-003/004/007 + PRD-021）已落 | 实施 | 各切片单测绿；`npm run compile` + `npm run eslint` 绿；HEAD 三会话 fixture 可见行不变（S1 已验：fixture → snapshot → entries → legacy turns 逐项等价）；Lens 全绿前提 = [D16](deferred-gaps.md) | **D**（域：`contrib/conversation/**`、`platform/universeAgent/{common/sessionView,node/sessionCore}/**`、`conversationViewFrame.ts`、`scripts/sync-*`、`.eslint-ignore`）。**主仓与 loop/D 在 S1 上已重叠一次**：S2 开工前主仓增量须先合入 `agent-ide`，之后 D 域单写者 |
| W1-A | **M6-A1 platform adapter**（[m6 §8](../plans/m6-engine-wave.md#8-切片顺序)）：`platform/universeAgent/{common,node,electron-browser}` 连接契约 + gRPC 客户端 + Connect + `GrpcCapabilityProbe` + Session/History/Stream/Chat 传输原语 + ProxyChannel；mock channel 单测；宿主进程选定写 ADR-003 审查记录。**不改 `contrib/`**，不碰 D 的三处 | 实施 | 单测：token + 活 channel → connected、pairing-pending → false、probe UNIMPLEMENTED → UNSUPPORTED、transport failed 单列；compile + eslint 绿 | **A**（域：`platform/universeAgent/**` 除 D 的三处、`package.json` 依赖、`build/`） |
| W1-C | **sources-changes-diff F1–F5**（[plan](../plans/sources-changes-diff.md) `accepted`，用户免规则 16） | 实施 | 各切片单测绿；D4 式验收 Changes 行 → Preview Diff、移到对话窗口 / 底部往返 | **C**（域：`contrib/sources/**`、editor 围栏、Panel Diff 视图） |
| W2-a | **M6-A2 contrib 接线**（入口 = W1-D S3 与 W1-A 均合入 `agent-ide`）：引擎实现类替换 stub 同 token；stream-timeline **S4 / S5**；`submitDraft` / `appendStubEchoAssistant` / `deleteSession` 已连接语义；权限应答臂选定写 ADR-003 | 实施 | m6 §8 A2 验证全绿；隔离 profile 冒烟 hello → live → 断连快照；**PRD-008 升 `implemented`** | A 或 D（单写者） |
| W2-b | **D13 PRD-017 持久化**（入口 = S3 合入）：`WORKSPACE` + `MACHINE`；stub 会话 + UA 断连快照缓存；重启验收 | 实施 | [D13](deferred-gaps.md) Exit | D（与 W2-a 不同槽时须错开 `conversationStubService.ts`；否则串行） |
| W3 | **M6-B page-access 切片 5**（UI 合同）→ **M6-C customizations E1** → **M6-D trajectory T4**（= S6）；随后 **D14** 键位（M6-B 后）、**D15** Web 冒烟（A2 后）、**D10** T5（M6-D 后） | 实施 | 各方案 blocked 行转 `implemented`；D4 式隔离 profile 验收 | 按域分槽 |
| W3-r | ~~规则 16 只读审查~~ **已签收 @2026-09-02**（Cursor CLI `cursor-grok-4.6-high` 三轮，用户授权「架构由本会话裁定」）：[navigator-engine-segments](../plans/navigator-engine-segments.md)（PRD-022）与 [sources-review-progress](../plans/sources-review-progress.md)（PRD-023）均 `accepted`；PRD-022/023 `accepted`、PRD-005 Review 句改口、m6 §11 增量已并入。**可立即开：sources-review R1 / R2 / R4a**（域 `contrib/sources/**`：`sourcesReviewList.ts` / strings / `sourcesTabsHost.ts` + 新文件；不碰 `sourcesChangeEntryOpen.ts`）。navigator N1–N5 与 review R3 / R4b 排 W2-a（含 m6 §11 增量）之后；R4b 另需 S2 | 实施 | R1 单测绿 + `IStorageService` 负向；R2 文案 + `overview.md` 改口；R4a 命令单测 | C（review R1/R2/R4a）；navigator 任一（A2 后） |
| W3-h | **connection-hub-client H0 → H1**（[plan](../plans/connection-hub-client.md) `accepted` @2026-09-02）：H0 = PRD-024 `proposed` + traceability + glossary（**等 W3-r 合入** `requirements.md` 后开，同文件单写者）；H1 = vendor Desktop `deviceGrant/**` + `hub/**`（SYNC 脚本）+ 四个 store + `hubDirectoryClient`，KAT-1/2 单测；**可与 W1-A 并行**（不同文件）。H2（pinned channel + DeviceAuth）起等 W1-A 合入；H4b 等 M6-B | docs → 实施 | H0 健康检查 0 warning；H1 KAT-1/2 + 合同负例绿 | H0 主仓 / H1 A 域新槽 |
| W4 | **D12 PRD-010 产品身份**（UniverseAgentStudio）— M6 闭后开 plan | plan → 实施 | 窗口标题 / 图标可识别 | 任一 |
| — | ~~R5 签收~~ / ~~PRD-017–020 签收~~ / ~~D8 作为门禁~~ / ~~D9 列 Blockers~~ — **均已于 2026-09-02 裁决关闭** | — | ✅ | — |

**closeout 提醒**：Wave 1 三槽合入后 `worktree-pool.md` 更新 HEAD；D8 豁免期内 closeout 门禁 = `compile` + `eslint`（[health-gates](health-gates.md)）。

**不做**（requirements.md 明确排除）：整仓迁移 Desktop 文档、Agents Window 当默认壳、Cursor/Codex trade dress、完整扩展分发。
