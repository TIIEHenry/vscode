---
title: "跨仓协议提案：引擎缺口 → 本仓解锁映射"
type: plan
status: accepted
phase: N/A
updated: 2026-09-05
summary: "按提案性质拆：引擎仓须给新面或扩已有消息（G-ENG-1/2/3 新面；G-ENG-4、G3、G-REV-1 扩已有消息）vs 确认 Desktop session-core（G2）；每行有闭合条件；映射本仓 UI/PRD 解锁；附 docs-only 切片 D1 修正登记处过时句；不推翻 M7 本波不做引擎仓新增 RPC / 不为 G-ENG 画表单。2026-09-05 第二轮对抗审查后签收"
---

# 跨仓协议提案：引擎缺口 → 本仓解锁映射

> **缺口登记：** [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md) 管 **G-ENG / G-NAV / G-REV**（以及 fanout 登记的 vendored 缺口 **G-CORE-1**，该表不由本稿独占）。**G2 / G3 登记处是** [conversation-stream-timeline §6](conversation-stream-timeline.md)，**不是** surface §4。RPC 名以外仓 proto 为准；本稿不复述、不发明字段。  
> **签收裁定（2026-09-05）：** (1) G3 的剩余工作是「`GetHistory` / L2 项带 `DetailRef`」，性质是**扩已有消息**，与 G-REV-1 同栏——不再放「确认已有面」栏，否则「`FetchToolDetail` 已有 + P2a 已绑」会被读成 G3 已闭；(2) 每行缺口必须有**闭合条件**（引擎仓哪种回复 / 哪个合并才算闭；「不做」也是闭，闭后改本仓 PRD 文案）；(3) G-ENG-1 的论据改为真实凭据面：钉死工位凭据来自**引擎宿主环境变量**（`start-engine.sh` 从 `~/.claude/settings.json` 导出 `ANTHROPIC_*`），`agent-home/config.json` **没有** key 字段——debug-engine §4 / README 该句过时，本稿 D1 切片修正；(4) 本稿附一个 **docs-only 切片 D1**，修正被本稿点名为「过时」的登记处原句，不能只在本稿宣布「以本稿为准」。
> **对照：** [engine-preferences-completion](engine-preferences-completion.md) · [navigator-engine-segments](navigator-engine-segments.md) · [sources-review-progress](sources-review-progress.md) · [conversation-stream-timeline](conversation-stream-timeline.md) §6 G2/G3 · [m7-gap-closeout](m7-gap-closeout.md) · [m7-ui-completion-wave](m7-ui-completion-wave.md) §2 / §6 · [debug-engine](../../docs/guides/debug-engine.md) §5 · [PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性)。
> **定位：** 跨仓提案清单 + 本仓解锁映射。**不是**本仓偷偷发明 RPC，**不是**本迭代去改引擎仓。

## 0. 目标 / 非目标

**目标**

1. 按提案性质把已登记、UI 只能写 unsupported 的缺口写成清单（每行标「待引擎仓确认」）：**引擎仓须给新面**（G-ENG-1/2/3）、**扩已有消息**（G-ENG-4 `AgentProfileProto` 字段、G-NAV-1/2、G-REV-1、**G3** `GetHistory`/L2 带 `DetailRef`）vs **确认 Desktop session-core**（G2 typed arm）。G2/G3 **不是** surface §4 行，但 G3 的性质是扩消息。
2. 每条缺口写清：现状、引擎须给出什么（提案级，不写本仓将实现该 RPC）、**闭合条件**（哪种引擎回复或合并算闭；「不做」也算闭）、本仓闭合后解锁哪条 UI / PRD、优先级。
3. 约定跨仓流程：本仓登记落点、引擎仓谁开 issue/PR（建议，不假装已开）、何时换钉 [debug-engine](../../docs/guides/debug-engine.md)。

**非目标**

| 不做 | 依据 |
|------|------|
| 本仓 `src/` 发明或实现外仓 RPC / proto 字段 | ADR-003；surface「RPC 名以外仓 proto 为准」 |
| 本迭代改引擎仓、或把 M7 收口波改成「去补 RPC」 | [m7-ui-completion-wave §6](m7-ui-completion-wave.md)「引擎仓侧新增 RPC（G-ENG-1/2/3）；本波只登记缺口并交付 unsupported 态」与 [m7-gap-closeout](m7-gap-closeout.md) 非目标「不为 G-ENG 画表单」是**当前实施波约束**；本稿是跨仓提案，**不推翻**那条「本波不做」 |
| 在 G-ENG-1/2/3/4 闭合前为 Provider / Rules / Hooks / Agents Model 子 tab 画表单或假编辑器 | [m7-ui-completion-wave §2 / §6](m7-ui-completion-wave.md)；[engine-preferences-completion](engine-preferences-completion.md) §3.2 / §3.4 / §3.5 / §3.6 |
| 把 G-CONV-1 / P2a `FetchToolDetail` 传输通道再登记成新缺口 | surface §1b / §4：P2a 已绑定；G-CONV-1 已闭 |
| 独立 CreateSkill RPC、会话级 `SwitchModel`、`SubscribeToolDetail` / `FetchToolUsageDetail` / 手动 `Compact`、Navigator v2 写操作 | 不在用户点名范围；M7 明确不纳入或另立 PRD |
| 假装引擎仓 issue / PR 已开 | §3 只写建议 |

**仍成立的实施波约束：** [m7-ui-completion-wave §6](m7-ui-completion-wave.md)「引擎仓侧新增 RPC（G-ENG-1/2/3）；本波只登记缺口并交付 unsupported 态」与 [m7-gap-closeout](m7-gap-closeout.md)「不为 G-ENG 画表单」——直到对应登记行闭合，本仓继续诚实 unsupported。

## 1. 优先级（建议排序）

排序依据：用户九节空态（Provider / Rules / Hooks）与真发消息凭据优先；G2/G3 为 Conversation 活数据质量（中）；NAV / REV 按产品——树与审阅主路径已诚实降级，补的是分组 / 重连标题 / 历史归因。

| 序 | 缺口 | 档 | 理由 |
|----|------|----|------|
| 1 | **G-ENG-1** Provider 配置键合同 | **高** | Engine 九节 Provider 组永远空态。真实凭据面是**引擎宿主环境变量**（钉死工位 `start-engine.sh` 从 `~/.claude/settings.json` 导出 `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL`；`agent-home/config.json` 只有 `modelId` / `permissions` / `rateLimit` / `defaultProvider`，**无 key 字段**）。IDE 既看不到「哪些 provider 已配凭据」，也不能从 Engine 页配置；提案对象是「已配置 / 未配置」查询与写入合同，**不是**让 IDE 改 `config.json` |
| 2 | **G-ENG-2** Rules Remote gRPC | **高** | Rules 整节恒 unsupported（[PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性) 验收 1 以空态满足，不是已接通） |
| 3 | **G-ENG-3** Hook 点位表 | **高** | Hooks 整节恒 unsupported，与 Rules 同属九节空态 |
| 4 | **G-ENG-4** Agent profile `model.json` 写路径 | **中高** | 不是整节真空，是 Agents Model **子 tab** 空态；闭合前禁止假编辑器 |
| 5 | **G2** visualize typed arm / DetailRef 全文 | **中** | [PRD-014](../../docs/product/requirements.md#prd-014-conversation-图示卡visualize) 活数据；壳与 stub 卡已落，引擎 admitted 全文通道未闭合 |
| 6 | **G3** `GetHistory` / L2 项带 `DetailRef` | **中** | 传输 RPC **已有**（`FetchToolDetail`，P2a 已绑）；缺的是**历史项 / L2 消息携带可交给它的 `DetailRef`**——这是扩已有消息，与 G-REV-1 同性质。「RPC 已有」**不是**闭合 |
| 7 | **G-NAV-1** 每会话 `work_dir` | **产品** | [PRD-022](../../docs/product/requirements.md#prd-022-navigator-引擎段) Projects 按项目分组；未补前单组，树结构已建对 |
| 8 | **G-NAV-2** 重连后 `team_id` | **产品** | Members / Tasks 不依赖 `team_id`；缺的是重连后节标题团队状态 |
| 9 | **G-REV-1** 历史 `file_mutation` | **产品** | [PRD-023](../../docs/product/requirements.md#prd-023-sources-review-审阅进度与归因) 本连接归因已落；历史会话零归因 |

**提案性质（两栏，对应 §3.2 两个史诗）：**

| 栏 | 缺口 | 登记处 |
|----|------|--------|
| **引擎仓须给新面或扩已有消息** | 新面：G-ENG-1/2/3。扩已有消息：G-ENG-4（`AgentProfileProto` 字段）；G-NAV-1/2、G-REV-1（surface §4）；**G3**（`GetHistory` / L2 项带 `DetailRef`） | G-ENG / G-NAV / G-REV → [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md)；G3 → [conversation-stream-timeline §6](conversation-stream-timeline.md)（登记处不变，栏位变） |
| **确认 Desktop session-core** | G2（admitted `visualize` typed arm；若引擎侧走 `DetailRef` 全文则并入 G3 那条扩消息） | [conversation-stream-timeline §6](conversation-stream-timeline.md)；**不在** surface §4 |

**G3 单独说明（避免两个方向的误读）：** [engine-protocol-surface §1b](../../docs/reference/universe-agent/engine-protocol-surface.md) 已绑定 `AgentService.FetchToolDetail`（P2a，`subscribe=false`），所以 G3 **不是缺一条新 RPC**；但 `GetHistory` / L2 项今天**不带**可交给该 RPC 的 `DetailRef`，所以 G3 **也不是已闭**。闭合条件是引擎仓在历史 / L2 消息上给出 `DetailRef`（或明确「不做」）。[conversation-stream-timeline §6](conversation-stream-timeline.md) G3 行仍写「DetailRef 按需通道 IDE 侧未实施」，与 HEAD 不符——**D1 切片改该原句**（§5），不是本稿宣布「以本稿为准」了事。

## 2. 缺口表

每行「需要引擎给什么」均为**提案级**，标 **待引擎仓确认**。提案性质见 §1 两栏：G-ENG / G-NAV / G-REV 是引擎仓须给新面或扩已有消息；G2/G3 是确认已有面或 Desktop session-core。本仓对应动作是：缺口闭合后另立解锁切片（§5），把 capability 从固定 `UNSUPPORTED` 改为探测，并替换已有壳的数据源。每行的**闭合条件**见 §2.1。**没有一行写成「本仓将实现该 RPC」。**

字段名只复用 surface / 已签收方案已写出的说法；未写出的服务名、RPC 名、config key **不编造**。

| 缺口 | 现状（本仓 @ HEAD） | 需要引擎给什么（提案级 · **待引擎仓确认**） | 本仓解锁（UI / PRD） | 优先级 |
|------|---------------------|-----------------------------------------------|----------------------|--------|
| **G-ENG-1** | `providerConfig` 固定 `UNSUPPORTED`，reason「Provider 配置键合同未定」。引擎已有通用 `ConfigService.Get` / `Set` / `Watch`；`TestModelProfile` 在 **`AgentService`**（不在 ConfigService），且本仓 adapter 的 Config 服务目前只绑 `ListModels`——「复用已有 Get/Set/Test」在 adapter 上**无生产路径**。**没有** Provider 列表 / 凭据已配置查询。Engine 页 Provider 组完整 unsupported；Overview 的 Provider 行今日用 `ListModels` 的 provider 去重数填（文案已注明「不代表已配凭据」，[m7-gap-closeout](m7-gap-closeout.md) GC-6 要回退这一点）。凭据实际来自引擎宿主环境变量，不走 IDE。 | 给出 **provider 已配置 / 未配置查询**与「写入但不回显」语义；是否复用已有 `ConfigService.Get`/`Set` + `AgentService.TestModelProfile`，由引擎仓定。**不**在本稿发明 key 名或新 RPC 名。 | [PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性) 验收 3 从「空态满足」变为可接线（验收 3/4 今日已被空态满足，**不是**解锁成功条件；成功条件见 §2.1）；[engine-preferences §3.2](engine-preferences-completion.md) Provider 组；Overview Provider 摘要改为真实「已配凭据」而非模型注册表去重数。闭合前 **零输入控件**。 | 高 |
| **G-ENG-2** | `RulesBridge` 是 Desktop/Singularity **进程内**接口（list/create/update/delete/preview/health × global / workDir）。**Remote gRPC 不存在**。`globalRules` / `projectRules` 固定 `UNSUPPORTED`。Rules 节壳在、两组行数恒 0。 | **Rules Remote gRPC**（服务名与 RPC 名待引擎仓确认；本稿不自造 `ListRules` 一类名字）。对齐范围收到**本仓壳已有字段 + 远程可达**（[engine-preferences §3.5](engine-preferences-completion.md)：Global / Project 两组，行含标题、启用态、优先级、范围；IDE 经 gRPC 可达的 list / 写）。**不要**扫 `{AgentHome}/rules`。Desktop `RulesBridge` **12 面**是进程内形状，**不是**本稿绑死的 gRPC 合同；哪些面上远程由引擎仓定。 | [PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性) 验收 4（不把 Copilot instructions 当 UA 权威）；[engine-preferences §3.5](engine-preferences-completion.md) Rules 节从空壳接线。闭合前 **不画假行、不扫本机 AgentHome**。 | 高 |
| **G-ENG-3** | 钉死引擎 proto 无 `ListHookPoints`（本仓零 `.proto`，以引擎仓为准）；`hooksMetadata` 固定 `UNSUPPORTED`。Hooks 节两栏壳、行数恒 0。不从 `points.md` 抄静态点位，不读 `{AgentHome}/hooks.json`。 | `ListHookPoints`（surface §4 已写此名）**或**握手带版本化点位表——这是 G-ENG-3 **闭合条件**；点位表必须由引擎**运行时**给出（随引擎版本变化），引擎仓把 `points.md` 静态抄成常量返回**不算闭合**。Hooks **定义列**写路径**超出** surface §4，另询引擎仓是否需要；**不是** G-ENG-3 闭合条件。本稿不另发明写 RPC 名。 | [PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性) 验收 4（无 metadata 不抄静态点位）；[engine-preferences §3.6](engine-preferences-completion.md) Hooks 节。Plugins 节的 `hook_count` / `PluginHookEntry` **不得**充当本节省。闭合前两栏行数恒 0。 | 高 |
| **G-ENG-4** | `SaveAgentProfileRequest.AgentProfileProto` 无 `model` / `modelType` / `maxTurns`（surface §4 已写这三项缺失），引擎 mapper 写死 `modelType = null` / `maxTurns = 0`，`model.json` 永不落盘。Agents Model 子 tab 仅 unsupported。 | 让 `SaveAgentProfile`（及对称读）**承载** surface 已点名的 `model` / `modelType` / `maxTurns`（或引擎仓给出等价写路径）。待引擎仓确认字段是否进现有 `AgentProfileProto`。 | [engine-preferences §3.4](engine-preferences-completion.md) Agents Model 子 tab；[engine-catalog §4](../../docs/systems/workbench/engine-catalog.md)。闭合前 **禁止**自由文本 + `SaveAgentProfile` 冒充已写入。 | 中高 |
| **G-NAV-1** | `SessionSummary` / `SessionInfoResponse` **无** `work_dir`。Projects 用 connection `workDir`（`ConnectResponse.work_dir`）单组挂全部会话。N1 树已落。 | 每会话带 `work_dir`（surface / [navigator-engine-segments §7](navigator-engine-segments.md) 已写缺在 `SessionSummary` / `SessionInfoResponse`）。**不要**用 `AgentService.SwitchWorkDir` 探测。 | [PRD-022](../../docs/product/requirements.md#prd-022-navigator-引擎段)「引擎提供工作目录时按它分组」；N1 只改分组函数，与当前工作区根一致的组置顶并标「当前工作区」。 | 产品 |
| **G-NAV-2** | 无 `ListTeams(session_id)`；`team_id` 只在不落库事件 / 写响应出现。重连后 `liveTeamId` 空 → 不调 `TeamInfo`，节标题省略团队状态。Members / Tasks 仍可用。 | `ListTeams(session_id)` **或**在 `AgentInfo` 上带 `team_id`（[navigator-engine-segments §7](navigator-engine-segments.md) 已写这两种选项）。待引擎仓二选一或给等价持久面。 | [PRD-022](../../docs/product/requirements.md#prd-022-navigator-引擎段) Team 节标题在重连后仍能显示整体状态（ACTIVE / COMPLETED / ABORTED）。Members / Tasks **不**阻塞于此条。 | 产品 |
| **G-REV-1** | L3 `tool_runtime_snapshot.payload.file_mutation_payload` **不落库**；L2 `ToolCallBlock` 的 path 在工具专有 `arguments_json`（**禁止**当 admitted correlation 解析）。归因 / reviewNav 仅限本连接（含重播种）。R1–R4b 已落。 | `GetHistory` 工具项带归一化 `file_mutation_payload` **或** `DetailRef(kind=DIFF)`（[sources-review-progress §6](sources-review-progress.md) 已写这两种选项）。待引擎仓确认落在 History 哪条臂。 | [PRD-023](../../docs/product/requirements.md#prd-023-sources-review-审阅进度与归因) 历史会话归因；重开历史后 Review chip / 「查看更改」不再只覆盖本连接。闭合前 header 不写归因总数、chip 缺席不占位。 | 产品 |
| **G2** | `visualize` 只是 `tool` 行；`resultPreview` / `argPreview` 有界；`canvasRefs` 不承载 mermaid 正文。对话页 stub 卡已落（[thinkrail-visualize-port](thinkrail-visualize-port.md)）；活引擎仍 fixture / 有界 preview。登记处是 [conversation-stream-timeline §6](conversation-stream-timeline.md)，**不在** surface §4。 | session-core **typed arm**，**或**经已有 `DetailRef` / `FetchToolDetail` 取全文（stream-timeline §6 已写这两种归属）。待引擎仓 + Desktop session-core 确认 admitted `visualize` 如何给出 diagram / comparison 全文。本稿 **不**发明新 visualize RPC 名。 | [PRD-014](../../docs/product/requirements.md#prd-014-conversation-图示卡visualize) 活数据图示卡（`visualization` kind，不进过程折）。闭合前：tool 行 + 「打开完整结果」；**不**把截断 preview 当图。 | 中 |
| **G3** | `AgentService.FetchToolDetail(session_id, tool_call_id, detail_kind, ref_id, offset/length)` **引擎 proto 已有**；本仓 P2a `requestDetail` + Q2 六态 **已绑定**。仍 open 的是：`GetHistory` / L2 项**不带** `DetailRef`，历史轨迹无法按需取全文；`truncated=true` 仍是 partial。[conversation-stream-timeline §6](conversation-stream-timeline.md) 仍写「IDE 侧未实施」（D1 改）。登记处是该稿 §6，**不在** surface §4。 | **扩已有消息，不是新 RPC。** 引擎仓在 `GetHistory` 工具项 / L2 `ToolCallBlock` 上带可交给已有 `FetchToolDetail` 的 `DetailRef`；编码规则由 session-core 定（stream-timeline §6）。`SubscribeToolDetail` 终端 tail **不**在本提案（M7 明确不纳入）。 | [PRD-012](../../docs/product/requirements.md#prd-012-conversation-轨迹透镜) 轨迹局部检查器全文；长工具输出；并与 G2 共用 DetailRef 取图示正文。闭合前不把 preview 当全文。 | 中 |

**刻意不列入本表（避免和「已闭 / 本波不做」搅在一起）：** G-CONV-1（P2b + Q3 已消费）；独立 CreateSkill（新建 UI 已落，独立 RPC 仍缺但非九节空态）；`SaveSkillContent` 传输（已闭）；`plugins` probe（M7 P1a 已闭）。

### 2.1 闭合条件（每行必须有；「不做」也是闭）

一行缺口只有三种终态：**已合并**（引擎仓 proto / 实现合入、钉死工位可换到含它的 PIN）、**改用已有面**（引擎仓指出等价已有 RPC / 字段，本仓登记处改口并绑定）、**不做**（引擎仓明确拒绝 → 本仓把对应 PRD 文案从「引擎提供时…」改成「不提供」，unsupported 态成为产品终态）。「引擎仓没回复」「本稿签收」「本仓 UI 已诚实空态」都**不是**闭合。

| 缺口 | 算闭合的引擎回复 | 不算闭合 |
|------|-----------------|----------|
| G-ENG-1 | 引擎给出「provider 已配置 / 未配置」可查询面 + 写入面（不回显明文），并合入；或明确「凭据永远只走宿主环境，不做」 | 只给 `config.json` 键名（那里没有凭据）；本仓 Overview 继续用 `ListModels` 去重数冒充 |
| G-ENG-2 | Rules Remote gRPC list + 写 面合入，字段覆盖本仓壳已有列；或「不做」 | 引擎仓复述进程内 `RulesBridge` 形状但无远程面 |
| G-ENG-3 | 运行时 `ListHookPoints` 或握手点位表合入；或「不做」 | 静态抄 `points.md` 为常量 |
| G-ENG-4 | `AgentProfileProto` 含 `model` / `modelType` / `maxTurns` 且 mapper 落盘 `model.json`；或给等价写路径；或「不做」 | 只加字段不落盘（今日 `maxTurns` 写死 `0`） |
| G-NAV-1 | `SessionSummary` / `SessionInfoResponse` 带 `work_dir`；或「不做」 | 让本仓用 `SwitchWorkDir` 探测 |
| G-NAV-2 | `ListTeams(session_id)` 或 `AgentInfo.team_id` 持久面；或「不做」 | 只在不落库事件里带 `team_id`（今日已是如此） |
| G-REV-1 | `GetHistory` 工具项带归一化 `file_mutation_payload` 或 `DetailRef(kind=DIFF)`；或「不做」 | 让本仓解析 `arguments_json` |
| G2 | session-core admitted `visualize` typed arm 合入 Desktop 并 sync 到本仓；或引擎经 `DetailRef` 给全文（并入 G3 路径）；或「不做」 | 有界 preview 加长 |
| G3 | `GetHistory` / L2 项带 `DetailRef` 且 `FetchToolDetail` 能解；或「不做」 | 「`FetchToolDetail` 已有」「P2a 已绑」 |

任一行到达终态：先改登记处（surface §4 或 stream-timeline §6）该行，再按 §5 立解锁切片或改 PRD 文案。本稿不跟踪终态，只定义它。

## 3. 跨仓流程

### 3.1 本仓登记落点（已有，不另起 SSOT）

| 落点 | 职责 |
|------|------|
| [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md) | **G-ENG / G-NAV / G-REV 缺口登记 SSOT**（同表还承载 fanout 的 **G-CORE-1**，本稿不独占该表）。引擎仓确认或合并后，回填该行「阻塞 / 备注」，同步 §1 / §1b / §2 / §7。 |
| [conversation-stream-timeline §6](conversation-stream-timeline.md) | **G2 / G3 登记处**。**不在** surface §4。确认后回填该稿 §6，并同步 surface §5 visualize / DetailRef 行。**D1 切片**先修正该稿 §6 G3 行「IDE 侧未实施」与 §12 / 摘要里「`compacted` emit 绑在 G2/G3」的过时句（G-CONV-1 已闭，`compacted` 投影 S6 已落）。 |
| [engine-protocol-surface §1 / §1b](../../docs/reference/universe-agent/engine-protocol-surface.md) | 已知 RPC 与本仓消费面。新 RPC **合入引擎仓并被本仓 adapter 绑定之后**才加行。G3 传输面已在 §1b（P2a）。 |
| 本稿 | 优先级与解锁映射。不重复枚举 RPC；外仓改名只改 surface。 |

### 3.2 引擎仓 issue / PR（建议 · 未开）

**截至签收日（2026-09-05），不声称 UniverseAgent 引擎仓已有对应 issue 或 PR。**

建议（待本仓协议负责人与引擎仓维护者当面确认后执行，不是已发生的事实）：

1. **谁开 issue：** 本仓协议面维护者（消费方）在 **UniverseAgent 引擎仓**开跟踪 issue，**不要**在本仓开「实现该 RPC」的实施 ticket 冒充引擎工作。
2. **怎么拆：** 建议 **两个史诗**，不要一篇史诗把九行都写成「实现 RPC」：
   1. **引擎仓须给新面或扩已有消息**：G-ENG-1/2/3 新面；G-ENG-4 扩 `AgentProfileProto`；G-NAV-1/2、G-REV-1 扩 Session / History 消息；**G3** 扩 `GetHistory` / L2 项带 `DetailRef`（标「非新 RPC，`FetchToolDetail` 已有；缺的是消息上的 ref」，以免引擎仓重做 RPC **或**把「RPC 已有」当已闭）。登记处按行：G-ENG/NAV/REV → surface §4；G3 → stream-timeline §6。
   2. **确认 Desktop session-core**（登记 [conversation-stream-timeline §6](conversation-stream-timeline.md)）：G2 typed arm。这是 Desktop `packages/session-core` 写者的工作，须与 [session-view-frame-fanout](session-view-frame-fanout.md) G-CORE-1、[giant-file-split](giant-file-split.md) GFS-4 **同一写者串行**（三稿都改同一 vendored 树）。
   两篇史诗正文链到本仓对应登记处与本稿，避免两仓各写一份字段清单。
3. **谁开 PR：** 引擎仓维护者在引擎仓改 proto / 实现。本仓 **不**提「把 proto 拷进 `src/vs/`」的 PR。
4. **确认门槛：** 引擎仓回复「做 / 不做 / 改用已有面」之前，本仓解锁切片不得开工；对应登记行保持开放。
5. **回填：** 引擎仓合并或确认后，本仓先改对应登记处（surface §4 或 stream-timeline §6），再立解锁切片。

### 3.3 换钉 debug-engine 的触发条件

钉死工位操作 SSOT 在仓外 `vscode-debug-engine/`（[debug-engine](../../docs/guides/debug-engine.md)）。**换钉不是提案起草的下一步。**

| 触发 | 不触发 |
|------|--------|
| 本仓协议对不上当前钉（adapter / probe 与引擎对不上） | 本稿落盘、优先级改口、引擎仓 **尚未合并** 的讨论 |
| 要吃进**已签收且已合并**的引擎 RPC，本仓解锁切片准备绑定 | 只为「看看缺口」升 PIN |
| 换钉步骤见仓外 README；换完更新 `PIN`，**不要**把新 SHA 抄进 `debug-engine.md` | 把调试钉当成产品「已接通」或抬升 [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) |

真发消息的凭据仍走钉死工位的宿主环境（`start-engine.sh` 从 `~/.claude/settings.json` 导出 `ANTHROPIC_*`），直到 G-ENG-1 闭合且本仓解锁切片落地。debug-engine §4 与仓外 README 里「须改 `agent-home/config.json`」是过时句，D1 一并改。

## 4. UI：缺口闭合前继续 unsupported

闭合前本仓 **继续** 既有诚实空态，**禁止假编辑器**：

| 面 | 闭合前姿态（已拍板，本稿不改） |
|----|--------------------------------|
| Provider 组 | 完整 unsupported；零引擎数据、零 endpoint / API key / Test。`api_key` 将来只经 electron-main gRPC 出站（[engine-preferences §3.2](engine-preferences-completion.md)） |
| Rules / Hooks | 节可达；行数恒 0；不扫 Copilot / `points.md` / AgentHome |
| Agents Model 子 tab | unsupported；禁止自由文本假装写入 `model.json` |
| Projects | 单 `workDir` 组；不画「已切目录」 |
| Team 标题 | `liveTeamId` 空则省略团队状态；Members / Tasks 照常 |
| Review 历史 | 无历史 chip / 无「Agent 改了 N 个文件」占位 |
| visualize / DetailRef | 有界 preview + 「打开完整结果」；`truncated=true` → partial |

[m7-ui-completion-wave §6](m7-ui-completion-wave.md)「本波只登记缺口并交付 unsupported 态」与 [m7-gap-closeout](m7-gap-closeout.md) 非目标表（G-ENG-1/2/3/4、G-NAV-1/2、G-REV-1；不为 G-ENG 画表单）对 **当前实施波** 仍然有效。

## 5. 切片

| 切片 | 内容 | 依赖 | 本仓是否写引擎 RPC |
|------|------|------|-------------------|
| **本稿（文档）** | 优先级、解锁映射、闭合条件、跨仓流程 | 无 | 否 |
| **D1 登记处修正（docs-only，签收后即可开）** | (a) [conversation-stream-timeline §6](conversation-stream-timeline.md) G3 行：删「IDE 侧未实施」，改为「传输已绑（P2a）；缺 `GetHistory`/L2 项上的 `DetailRef`」；同稿摘要 / §12 不再把 `compacted` emit 绑在 G2/G3；(b) [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md) G-ENG-1 行备注改凭据面为宿主环境变量；(c) [debug-engine §4](../../docs/guides/debug-engine.md) 「真发消息须改 `agent-home/config.json`」改为「设置 Claude Code 环境或 `ANTHROPIC_API_KEY`，`start-engine.sh` 会导出」，仓外 README 同句同改；(d) surface §4 表引言注明该表同时承载 G-CORE-1 | 本稿签收 | 否 |
| **引擎仓工作** | 确认提案 → proto / 实现 → 合并 | 引擎仓维护者；issue 尚未开 | **不适用（不在本仓）** |
| **本仓解锁切片（另立，未开）** | 按缺口：capability 探测、adapter 绑定已**存在于引擎仓**的 RPC、替换壳数据源、登记处回填 | **对应引擎仓已合并或已确认** + 对应登记行改口（surface §4 或 stream-timeline §6）；每条缺口一份 plan，不塞进 M7 gap-closeout | **否**——只消费，不实现 |

本仓现阶段 **只做文档与优先级**。不得把「解锁 Provider 表单」排进当前 M7 实施波。解锁切片命名与工位在引擎仓合并后再立，避免空转。

## 6. 验收（本稿自身）

本稿是提案清单，签收本身不等于任何缺口闭合。下表前四项在**仓内可检**，后三项是措辞约束。

| 项 | 通过标准 |
|----|----------|
| 每行有闭合条件 | §2.1 九行都写出「算闭合的引擎回复」与「不算闭合」；缺口行到终态前，surface §4 / stream-timeline §6 对应行保持开放（`rg` 可查） |
| D1 落地 | stream-timeline §6 G3 行不再含「IDE 侧未实施」；debug-engine §4 不再含「须改 `agent-home/config.json`」；surface §4 G-ENG-1 备注含「宿主环境变量」——三条 `rg` 断言 |
| 事实与 HEAD 对齐 | 本稿引用的 adapter 事实（`TestModelProfile` 属 `AgentService`；Config 服务只绑 `ListModels`；Overview Provider 行用 `ListModels` 去重数）在实施 D1 时复核一次；不符则改本稿 |
| 无「本仓将实现该 RPC」 | §2 / §5 每条引擎面都标「待引擎仓确认」或「本仓只消费」；G3 写明扩消息、非新 RPC、非已闭 |
| 两栏 / 两个史诗 | 新面或扩消息（含 G3）vs 确认 Desktop session-core（G2）；G2 与 G-CORE-1 / GFS-4 同写者串行 |
| 不推翻本波约束 | §0 两处都链 [m7-ui-completion-wave §6](m7-ui-completion-wave.md) 与 [m7-gap-closeout](m7-gap-closeout.md)；「本波不做引擎仓新增 RPC / 不为 G-ENG 画表单」仍成立 |
| 不发明字段、不假装 issue 已开 | 除 surface 或已签收方案已出现的名字外，无新 proto 字段 / 新 RPC 名；§3.2 写明截至 2026-09-05 未开 |

## 相关

- [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) · [universe-agent INDEX](../../docs/reference/universe-agent/INDEX.md)
- [engine-preferences-completion](engine-preferences-completion.md) · [m7-ui-completion-wave](m7-ui-completion-wave.md) · [m7-gap-closeout](m7-gap-closeout.md)
- [navigator-engine-segments](navigator-engine-segments.md) · [sources-review-progress](sources-review-progress.md) · [conversation-stream-timeline](conversation-stream-timeline.md)
- [debug-engine](../../docs/guides/debug-engine.md) · [PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性)

## 7. 审查记录（规则 16）

**2026-09-04：** 只读 reviewer（Cursor Task `generalPurpose`，inherit）。**Approve with changes**。Critical：无。Important 当轮改入：

| 意见 | 处理 |
|------|------|
| I1 §0 / §3.2「一篇史诗 + 九行」把新面与确认混装 | §0 目标 1、§1 两栏、§2 引言、§3.1 / §3.2 拆成两个史诗：引擎仓须给新面或扩已有消息（G-ENG-1/2/3，G-ENG-4 扩字段）vs 确认已有面或 Desktop session-core（G2/G3）。写明 G2/G3 登记处是 stream-timeline §6，不是 surface §4 |
| I2 G-ENG-2「语义对齐 Desktop 进程内桥」绑死 RulesBridge 12 面 | 对齐范围收到本仓壳已有字段 + 远程可达；12 面不是 gRPC 合同 |
| I3 Hooks 定义写路径并进 G-ENG-3 | 标成超出 surface §4、另询是否需要；**不是** G-ENG-3 闭合条件 |

Minor（可改已改）：§0 两处与 §4 都链 [m7-ui-completion-wave §6](m7-ui-completion-wave.md) 与 [m7-gap-closeout](m7-gap-closeout.md)；G3 加 stream-timeline §6「IDE 侧未实施」以 surface §1b / 本稿为准。未改：档名「产品」、G-ENG-4「对称读」锚点。

**2026-09-05 第二轮（对抗性，Cursor CLI · grok-4.6，结论 Reject）→ 复核改入后签收：**

| 意见 | 复核 | 处理 |
|------|------|------|
| C1 G3 放「确认已有面」栏 → 「`FetchToolDetail` 已有 + P2a 已绑」会被读成已闭；被点名过时的 SSOT 原句不改 | 属实 | G3 移到「扩已有消息」（§0 / §1 两栏 / §2 行 / §3.2 史诗 1）；§2.1 明写「RPC 已有」不算闭；新增 D1 docs-only 切片改 stream-timeline §6 原句 |
| C2 G-ENG-1 论据建在「真发消息改 `config.json`」上，而钉死工位凭据来自宿主环境（`start-engine.sh` ← `~/.claude/settings.json`），`config.json` 无 key 字段 | 属实（已实读 `config.json` 与 `start-engine.sh`） | 文首裁定 (3)；§1 序 1 理由、§2 G-ENG-1 行、§3.3 末段改口；D1 (b)(c) 改 surface / debug-engine / 仓外 README |
| C3 §6 自指即绿，九行无否证条件 | 属实 | 新增 §2.1 闭合条件表（三种终态；「不做」也是闭）；§6 前四项改为 `rg` 可检 |
| I1 §2 内链「§4」应为 §5 | 属实 | 改 |
| I2「HEAD 不显示 Provider 摘要」不成立：Overview 用 `ListModels` 去重数填 Provider 行 | 属实（`engineOverviewSection.ts` `formatOverviewProviderSummary`） | §2 G-ENG-1 行改口，并指 GC-6 回退 |
| I3 `TestModelProfile` 在 `AgentService` 不在 ConfigService；本仓 Config 只绑 `ListModels` | 属实（`grpcTransport.ts`） | §2 G-ENG-1 行改口：「复用已有 Get/Set/Test」无 adapter 生产路径 |
| I4 G2 与 G-CORE-1 / GFS-4 同写 Desktop session-core，未排串行 | 属实 | §3.2 史诗 2、§6 |
| I5 §3.1 独占 surface §4，与 fanout「G-CORE-1 回填 §4」冲突 | 属实（surface §4 今日尚无 G-CORE-1 行） | 文首、§3.1 注明不独占；D1 (d) |
| I6 PRD-025 验收 3/4 已被空态满足，不能当解锁成功条件；G-ENG-3「握手点位表」可塞静态表 | 属实 | §2 G-ENG-1 行、§2 G-ENG-3 行、§2.1 |
| I7 stream-timeline 摘要 / §12 仍把 `compacted` emit 绑在 G2/G3 | 属实 | D1 (a) |
| Minor `maxTurns` 写死 `0` 不是 null；「全仓 proto 无 ListHookPoints」空成真 | 属实（`GrpcAgentProfileMappers.kt:39-40`） | §2 G-ENG-4 / G-ENG-3 行改口 |
| Minor 删 §3.2 / §3.3 / §4 / §6 | 不采纳 | §3.2 是「谁开 issue」的合同，§4 是闭合前姿态的单点引用，保留；§6 已改成可检 |

**签收裁定：** 本稿 `accepted`。可立即开工的只有 D1（docs-only）；解锁切片仍以 §2.1 终态为前置。G2 的 Desktop 写者排在 G-CORE-1 与 GFS-4 之后。
