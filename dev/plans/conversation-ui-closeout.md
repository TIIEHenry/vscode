---
title: "Conversation UI 收口方案"
type: plan
status: accepted
phase: M7
updated: 2026-09-02
summary: "补齐轨迹 Overview、DetailRef 六态（经 P2a requestDetail 合同接 FetchToolDetail）、compacted（经 P2b，行身份只来自 L2）、live 过程折、轨迹 permission/question/error/unknown 独立 kind 并停止对话页把它们洗成 assistant；A11Y-1/2 与 RWD-1 的 Conversation 部分在 Q5b/Q6 实施"
---

# Conversation UI 收口方案

> **父方案：** [M7 UI 完成波](m7-ui-completion-wave.md)（P 槽 Wave 0 见其 §4）。
> **既有需求：** [PRD-003](../../docs/product/requirements.md#prd-003-时间线与输入)、
> [PRD-004](../../docs/product/requirements.md#prd-004-权限座位)、
> [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级)、
> [PRD-012](../../docs/product/requirements.md#prd-012-conversation-轨迹透镜)、
> [PRD-013](../../docs/product/requirements.md#prd-013-conversation-过程折)、
> [PRD-020](../../docs/product/requirements.md#prd-020-规模与性能上限)、
> [PRD-021](../../docs/product/requirements.md#prd-021-未知内容与错误的诚实呈现)。
> **引擎面：** [engine-protocol-surface §1b](../../docs/reference/universe-agent/engine-protocol-surface.md)（`FetchToolDetail`、compact 事件）· [stream-timeline §6 G2/G3](conversation-stream-timeline.md)。
> **现状：** 时间线、流式帧、搜索/虚拟化、轨迹表与过程折已落。Overview 瀑布条、DetailRef 全文、`compacted` emit、live 过程折收口仍未闭合。`IConversationSessionViewLease` 没有 `requestDetail`，`details` 是 `ReadonlyMap<string,string>`；`ItemAttribution` 没有 `branchReason` 生产者；轨迹投影把 `error` 降成 `message`、把 `permission / question` 丢弃、把 `unknown` 归为 `context`（`conversationTrajectoryModel.ts:205-213`）；**对话页** `projectSnapshotToEntries` 已产出独立 `error / unknown / question` entry，但 `entryToRenderableTurn` 把非 stub kind 一律洗成 `kind:'assistant'` + `stubEcho:true`（`conversationSessionView.ts:360-388`），树只吃 `ConversationStubTurn`。`ConversationTrajectoryRecord` 无 `turnId`；`ConversationStubTurn` 不带 `streaming`。

## 1. 目标

Conversation 收口不重写三槽，不引入 ChatWidget。完成面包括：

1. 轨迹页有 Overview 时间条、记录表与局部详情三层。
2. 长工具输入/输出通过 DetailRef 按需打开；上游未提供全文时诚实显示有界 preview。
3. `compacted` 是轨迹独立记录，不进入过程折。
4. live reasoning/tool 使用现有过程折 chrome，执行中状态、追加内容与完成切换不重置展开态。
5. question、permission、unknown、error、reviewNav、visualization 各有独立呈现与窄宽度行为；轨迹页为前四类建立独立 kind；**对话页停止把它们洗成 assistant / Stub**（PRD-021）。
6. Conversation 范围内的键盘、ARIA、窄宽度合同（[a11y 方案](accessibility-responsive-ui.md) A11Y-1/A11Y-2/RWD-1）在本方案 Q5b/Q6 内实施，C 槽复核。
7. Web 下 Conversation 的可用性依赖总方案 P0；桌面 Q 切片不等 P0，但不得声称 Web Conversation 已可用。

## 2. 轨迹 Overview

Overview 位于轨迹 toolbar 与记录表之间，可折叠，默认展开。它是 `ConversationTrajectoryRecord[]` 的**派生 view-model**，不另造第二份事件模型：

- Q1 先把 `TimelineItemView.turnId` 拷进 `ConversationTrajectoryRecord.turnId?`（同一份模型加一个字段，投影时不再丢弃）；Overview 按 `turnId` 分段。无 `turnId` 的记录（stub extras）按记录顺序单独成段。
- 段类型取自记录 kind：`user`、`message`（assistant）、`thinking`、`tool/subtool`、`system/context`、`compacted`，以及 Q5a 新增的 `permission/question`、`error/unknown`。Q1 落地时后两组尚不存在，Overview 只画当时已有 kind，不预留假段。
- 颜色只使用 workbench token；同时提供形状/文字，不能只靠颜色。
- 点击段定位对应轨迹记录；虚拟化列表通过现有 reveal API 滚动。
- **等宽写死**：`TimelineItemSummary` 有意省略 duration，Overview 永不按耗时定宽，不造假时间。
- 段数超过 200 时按 `turnId` 聚合为 turn 段（200 是 UI 密度阈值，与 PRD-020 的 200 ms 无关）。

## 3. DetailRef 与详情宿主

- 轨迹详情继续在 Conversation 内局部 inspector，不占 Panel。
- 详情状态与判定（六态）：

| 状态 | 判定 |
|------|------|
| preview | 记录只有有界 preview，`details` 无该 ref 且尚未请求 |
| loading | UI 已调用 `requestDetail(ref)`、Promise 未 settle（**本地 in-flight**，不依赖 lease 事件）；lease 无 `requestDetail` 时永不进入 |
| full | `details.get(ref)` 有体且未标 `truncated`——来源可以是 `requestDetail` 成功回填，也可以是帧源随 baseline 预填（帧源合同：只有全文才 `upsertDetail` 且不带 `truncated`；stub visualize 的预填即属此类） |
| partial | outcome `ok:true` 且 `truncated=true`；显示已取字节数与 `totalBytes`（缺 `totalBytes` 时显示「部分内容，总长未知」）；不标 Full |
| unavailable | 无 DetailRef、lease 无 `requestDetail`（P2a 未合入 / browser stub）、或 outcome `{ ok:false, reason:'unavailable' }`（方法未广告 / `UNIMPLEMENTED`） |
| failed | outcome `{ ok:false, reason:'failed' }`（`success=false` 或传输错误）；保留 preview 与 Retry |

- P2a 合同（总方案 Wave 0）：lease `requestDetail(ref: DetailRef): Promise<DetailFetchOutcome>`；`DetailPatch` 增 `truncated?` / `totalBytes?`；host 把 `DetailRef` 映射到 `AgentService.FetchToolDetail(session_id, tool_call_id, detail_kind, ref_id, subscribe=false)`，成功先 `upsertDetail` 再 settle。UI 只读 `details` 与 outcome，不 import node，**不改 `platform/universeAgent/**`**。**stub 帧源的本地 `requestDetail`（`conversationStubFrameSource.ts`）由本方案「Q2 接通」在 P2a 接口合入后实施**（Q2 壳期间该文件不动，接口尚不存在）。
- 结果按 `detailRef` 缓存于 lease；切会话释放 lease 即清除未完成请求。
- Visualization 的完整 payload 可从详情打开图示 overlay；没有完整 payload 时保留工具行和诚实提示。
- 详情文本必须有最大 DOM 体积；超限继续用虚拟化/分段查看。`SubscribeToolDetail` 流不在本方案；禁止在 `FetchToolDetail` 请求里设 `subscribe=true`。

## 4. compacted

- **行身份只来自 L2**（P2b）：host demux 处理两条路径——`MessageEnvelope.branch_reason='compact'` 行；`EnvelopeRangeReplaced(reason=COMPACT)`（单独出现即成立，随行的 `BRANCH_NOTICE` 只作补充，不是必要条件）。两者都投影为 `ItemAttribution.branchReason='compact'` + `ItemAttribution.compacted{ anchorTurnId, foldedLeafTurnId, compactBranchTurnId, summary? }`（`CompactedSpanBlock` / `SummaryBlock`）。`ContextCompactedEvent` 只在 `AgentService.Chat` 流上，**不是显示源**；仅当 Chat 臂已打开时可作 token 前后数的可选富化。UI 消费 attribution，不解析 envelope。
- `projectSnapshotToTrajectory` 现有的 `branchReason==='compact'` 跳过分支改为 emit `compacted` 记录；**Q3 完成线：P2b 未投影则零 compacted 行**（不伪造）。
- 行显示范围（anchor → folded leaf 三个 turn id）、原因与 summary；无 summary 时显示类型与范围，不生成模型未提供的说明。
- `compacted` 始终在过程折外，也不伪装成 SYSTEM 或 assistant。
- 点击可在局部 inspector 查看范围元数据；token 前后数只在富化存在时显示；不声称能恢复已丢弃全文。

## 5. live 过程折

沿用 `projectProcessFoldSpans` 和现有 id（span id = `fold:${firstId}`）。本节 Q4 **不是** [conversation-process-fold](conversation-process-fold.md) 的旧 P4/P5：旧 P4「turnId 连续段替换 fixture」仍 blocked on PRD-008，本方案不承接。

- 同一 turn 的 reasoning/tool live 行进入同一 span。**展开态只在 span id 不变时保留**；L3 overlay（id `overlay:${blockId}`）与 L2 行零关联（session-core 声明），禁止为保展开去推断 overlay↔L2 对应，overlay 是段首时 span id 变化、展开态重置属于合同内行为。
- live 信号源写死：`ConversationTimelineEntry.streaming` 与 tool `status` 必须经 `entryToRenderableTurn` 传到渲染层（今天被丢弃），过程折据此显示 loading 与状态文本；完成后换成完成/失败状态。
- 执行中详情高度受限并可内滚；折叠后只显示稳定摘要。
- sticky breadcrumb 只在展开且内容超出可视区时出现。
- 无引擎 stub 不出现 loading、耗时或 live 字样（stub 源永不置 `streaming`，已有测试守卫）。

## 6. 行类型完成矩阵

| 类型 | 对话页 | 轨迹页 | 折叠规则 |
|------|--------|--------|----------|
| user / assistant | 正文 | 记录 + detail | 折外 |
| reasoning / tool | 过程折 | 过程折，默认展开 | 折内 |
| permission / question | 可操作座位或已决记录；**Q5a 停止 `entryToRenderableTurn` 洗白**，question 进**独立提问座位**（非 Allow/Skip）、不标 Stub | **Q5a 新增 kind**：记录 + 请求/答案摘要（今天被丢弃） | 折外 |
| error / unknown | 独立诚实行；**Q5a 停止洗白**，error 保留可重试标记、unknown 读原始类型名，不标 Stub | **Q5a 新增 kind**（今天分别降为 message / context） | 折外 |
| compacted / system / context | 对话页省略或既有规则 | 独立记录 | 折外 |
| visualization | 图示卡 | 工具记录 + detail | 对话折外 |
| reviewNav | 查看更改导航行 | 不重复投影 | 对话折外 |

Q5a 扩展 `ConversationTrajectoryKind` 时同步：`getTrajectoryKindLabel` 穷尽 switch 补四 kind；搜索 haystack 纳入新 kind 文本；`collectTrajectoryTurnIdsFromSnapshot` 不再跳过 permission/question；四 kind 计入 `CONVERSATION_TRAJECTORY_RECORD_LIMIT = 5000` 的截断与诚实提示；过程折白名单 `thinking|tool|subtool` 使新 kind 默认打断 span（补注释）。知识层同步改 [lens-and-trajectory](../../docs/systems/conversation/lens-and-trajectory.md) 投影表与 [conversation-trajectory-lens §3.3](conversation-trajectory-lens.md) 闭集（HEAD 写「permission/question 不进轨迹」）。PRD-012 禁止的是自动切页与进过程折，不是轨迹出现权限记录。

## 7. 平台前置（P 槽，不由本方案写）

| P 切片 | 本方案依赖 | 未合入时的姿态 |
|--------|------------|----------------|
| P2a | lease `requestDetail(ref): Promise<DetailFetchOutcome>`、`DetailPatch.truncated/totalBytes`、`IUniverseAgentSessionView` 与 electron-browser 代理同步、host `FetchToolDetail` 映射 | **Q2 壳**：有界 preview；`details` 已有未标 `truncated` 的体 → full；无 DetailRef / 无法取 → unavailable；**无 loading、无 stub `requestDetail`**。**Q2 接通**（loading / partial / failed / stub `requestDetail`）等 P2a 合入后开工 |
| P2b | `ItemAttribution.branchReason` + `compacted{…}` 生产者（L2 两条路径） | Q3 零 compacted 行 |

## 8. 切片

| 切片 | 内容 | 代码完成线 | 依赖 |
|------|------|------------|------|
| Q1 | Overview 派生 view-model + toolbar | 记录含 `turnId?`；按 turn 分段；200 段聚合用**带 `turnId` 的测试夹具**验收（stub 投影不写 `turnId`，产品 stub 路径每条单独成段、不验收聚合）；等宽写死；只画已有 kind | — |
| Q2 壳 | DetailRef inspector 宿主 + preview / unavailable 两态（帧源预填全文按 full 显示） | 三态判定与 §7 一致：有界 preview 显示 preview；`details` 有未 truncated 体显示 full；无 DetailRef / 无法取显示 unavailable；不引用 P2a 接口、不改 platform | — |
| Q2 接通 | loading（本地 in-flight）/ full / partial / failed 与 Retry；stub 帧源本地 `requestDetail` | `truncated=true` 显示 partial 与字节数；`ok:false` 分 unavailable / failed | P2a |
| Q3 | compacted UI | 独立记录、折外、可检查范围元数据；P2b 未投影时零行 | P2b |
| Q4 | live process fold 收口（非旧 P4/P5） | `streaming` / tool `status` 传到渲染层；span id 不变时展开态保留；执行中内滚；sticky；stub 无 live 字样 | — |
| Q5a | 行类型 | 轨迹新增四 kind（`getTrajectoryKindLabel` / `getConversationTurnRoleLabel`（`conversationTrajectoryList.ts:83-99` 穷尽 switch）/ haystack / reveal / 5000 一并）；对话页停止 `entryToRenderableTurn` 洗白——**树改为消费 `ConversationTimelineEntry`（或扩展 turn 类型）**，两个分支都要求 entry / turn 携带 `retryable` / `typeName` / `rawContent` / question `items` + `answerKeysValid`（今日 `ConversationTimelineEntry` 无 `answerKeysValid`，`timelineItemToEntry` 须一并拷入，不再丢弃 `summary.items`）；error 行按 `retryable` 显示重试；unknown 行读 `typeName`；**question 进独立提问座位**（`ConversationQuestionSeat`，与 permission 的 `ConversationConfirmationSeat` 不同 role/name，**禁止复用 Allow/Skip**，PRD-004.4）；不标 Stub；知识层两页同步 | — |
| Q5b | 键盘与 ARIA（= a11y A11Y-1 / A11Y-2） | chat tabs 复用 editor group 既有命令、透镜 tablist 左右键；对话框 focus trap **根 = `overlay.element`**（overlay 内自备透镜 tab / 标题行，不再写 Part 级 sessionBar，否则 trap 边界包不住）+ Tab wrap + Escape 顺序（详情 / 改名 / 图示 → dialog → 不关根会话，修正 `conversationSubAgentOverlay.ts:149` 与 `conversationVisualizeOverlay.ts:110` 的吞键）；所有 entry kind（含 `system`）可读名称 / 状态；流式行名只在进入 / 离开 streaming 时改一次，不按 token 更新 live；**接入既有 `IAccessibleViewService`** 朗读完整回合，不新造 live 区 | Q5a |
| Q6 | 窄宽度与跨面导航（= a11y RWD-1） | `ConversationEditorPane.layout` 以叶宽打 `.is-narrow`（不用 Part 宽）；300px 主输入 / Back / 透镜 tabs 可达；inspector 覆盖可返回；Navigator/Review reveal、隐藏 Part、split/overlay 不丢定位 | — |

Q1、Q2 壳、Q4、Q5a/Q5b、Q6 不依赖 P；Q3 先落壳与降级态（零 compacted 行），P2b 合入后只替换数据源；**Q2 接通在 P2a 合入前不开工**（接口尚不存在），合入后只在壳上加 loading / partial / failed 与 stub `requestDetail`，不重做宿主。

## 9. 验证债

测试由 V 槽并行处理。失败不阻塞下一 Q 切片，但以下任何一项未证实前，不得把相关 PRD 升 `implemented`：

- live 增量不重置过程折、透镜、滚动 hold（span id 不变的前提下）。
- DetailRef 失败不丢 preview；`truncated=true` 显示为 partial 而非 Full。
- compacted 不进入过程折；P2b 未合入时零 compacted 行。
- 5,000 条轨迹仍可搜索与定位（含四新 kind）；Overview 200 段以上聚合。
- 窄宽度下 inspector 覆盖/返回可用，输入 Dock 不出现第二份。
- 轨迹 permission / question / error / unknown 四类 kind 不再被丢弃或降级；对话页这些行无 `stubEcho`、无 assistant 角色。

## 10. 冲突域

`conversationLens.ts`、`conversationTrajectory*.ts`、`conversationTimelineTree.ts`、`conversationProcessFold*`、`conversationConfirmationSeat*`、新建 `conversationQuestionSeat*`、`conversationSubAgentOverlay*`、`conversationVisualize*`、`conversationSessionView.ts`、`conversationStubFrameSource.ts`、`conversationStubModel.ts`、`conversationEditorPane*`、`conversationEditor.contribution.ts`、`conversationAccessibility.ts` 与 `media/conversationLens.css` 由 B 槽串行修改。Engine Settings 不得顺手改这些文件；a11y 方案对这些文件只出清单。`platform/universeAgent/**` 归 P。

## 11. 规则 16

本方案 2026-09-02 经四轮审查后为 `accepted`。

**第一轮（本会话只读审查，2026-09-02）已改入：** DetailRef 通道与 `FetchToolDetail` 对齐并加 partial 态、compacted 数据来源与 P2b 对齐、轨迹四 kind 扩展、可达性切片归属。

**第二轮（Cursor CLI `cursor-grok-4.6-high` `--mode ask`，2026-09-02）：Approve with changes**（2 Critical + 8 Important + 5 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 六态所需的 loading/failed 与 `truncated` 在合同里不存在 | §3 写六态判定表；P2a 合同写为 `requestDetail → Promise<DetailFetchOutcome>` + `DetailPatch.truncated/totalBytes`；Q2 拆壳 / 接通 |
| C2 对话页 `entryToRenderableTurn` 把 error/unknown/question 洗成 assistant+Stub | Q5a 完成线与 §6 明写停止洗白；§9 加负向断言 |
| I1 `ContextCompactedEvent` 只在 Chat 流 | §4 行身份只来自 L2，Chat 事件仅可选富化 |
| I2 compact 还可能以 RangeReplaced 形态出现 | §4 / P2b 写两条路径；Q3 完成线「P2b 未投影则零行」 |
| I3 overlay→L2 展开态与 span id 规则冲突 | §5 只在 span id 不变时保留，禁止 overlay↔L2 关联 |
| I4 live 标志在 `entryToRenderableTurn` 被丢 | §5 / Q4 写死信号源 |
| I5 借用旧 P4/P5 编号 | §5 声明 Q4 非旧 P4/P5，旧 P4 仍 blocked |
| I6 Overview 无 `turnId` 可用；「Overview model」措辞 | §2 Q1 拷 `turnId` 进记录；改称派生 view-model；200 与 PRD-020 无关 |
| I7 四 kind 对 label / haystack / reveal / 5000 的影响未列 | §6 逐项列出并同步两页知识层 |
| I8 Q5 过载 | 拆 Q5a / Q5b，窄宽度并入 Q6 |
| M1–M5 | Q2 拆完成线；partial 缺 `totalBytes` 文案；禁 `subscribe=true`；等宽写死；§1.7 Web 依赖 P0 |

**第三轮（同配置，附第二轮意见复核；2026-09-02）：Approve with changes**（0 Critical + 2 Important + 3 Minor）；第二轮 C1/C2/I1–I8 全部 Resolved。处理：

| 意见 | 处理 |
|------|------|
| I1 Q2 壳引用 P2a 尚不存在的接口（stub `requestDetail`、loading） | Q2 壳缩为 preview / unavailable；loading 与 stub `requestDetail` 移到 Q2 接通；写明不改 platform |
| I2 停止洗白后树仍吃 `ConversationStubTurn`，缺 `retryable` / `typeName` / question `items`；禁止复用 Allow/Skip | Q5a 完成线写死树消费 entry（或扩 turn 类型）、投影保留 `items`、独立 `ConversationQuestionSeat` |
| M1 200 段聚合在 stub 路径不可触发 | Q1 用带 `turnId` 夹具验收 |
| M2 帧源预填体算 preview 还是 full | §3 写死：有体且未标 `truncated` 即 full（帧源合同） |
| M3 `getConversationTurnRoleLabel` 穷尽 switch | Q5a 点名 |
| X2 `conversation-process-fold.md` P5 状态 | 该方案 P5 行标「由 M7 Q4 承接」 |
| X3 a11y 要求 permission / question 不同 role | Q5a 独立提问座位 |
| a11y 跨路：`conversationEditorPane*` 无主、Accessible View 无完成线、trap 根节点 | §10 / 看板补文件；Q5b 加 Accessible View 与 trap 根 |

**第四轮（确认轮；2026-09-02）：Approve with changes**（0 Critical / 1 Important / 3 Minor）。I1：§7 未合入姿态、Q2 壳完成线、§8 末句三处对 Q2 壳的说法不一致——已统一为「壳 = preview / 预填 full / unavailable，无 loading、无 stub `requestDetail`；接通等 P2a」。M1 process-fold Implemented 句、M2 看板 `conversationQuestionSeat*`、M3 `answerKeysValid` 拷入——均已改入。改入后无开工阻塞项，**升 `accepted`。**
