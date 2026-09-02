---
title: "M7 UI 完成波：产品面闭集与非阻塞验证"
type: plan
status: accepted
phase: M7
updated: 2026-09-02
summary: "以 UI 完成为主线：P 槽承接 platform/universeAgent 合同（Web 断连含 Hub、MCP 运行态/Plugins、DetailRef、模型注册表、compacted）；A=Engine/Connection，B=Conversation→Client Settings 消费点，C=品牌/键位/主题/Web 冒烟；测试债旁路记录，不阻塞后续 UI 切片"
---

# M7 UI 完成波

> **产品输入：** 用户于 2026-09-02 明确要求「测试不要阻塞开发，UI 方面都要完成」。
> **需求：** [PRD-010](../../docs/product/requirements.md#prd-010-产品身份)、
> [PRD-018](../../docs/product/requirements.md#prd-018-键盘可达与辅助功能)、
> [PRD-019](../../docs/product/requirements.md#prd-019-web--远程窗口一致性)、
> [PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性)、
> [PRD-026](../../docs/product/requirements.md#prd-026-client-设置完整性)，以及 Conversation 既有 PRD。
> **并行看板：** [m7-ui-completion](../parallel/active/m7-ui-completion.md)。
> **引擎面依据：** [engine-protocol-surface §1b / §2 / §4](../../docs/reference/universe-agent/engine-protocol-surface.md)（2026-09-02 对照 `UniverseAgent/grpc-api/src/main/proto` 核对）。

## 1. 目标

M7 不再以「先补全部测试再继续」组织工作，而是以用户可见 UI 闭集为主线：

1. Engine 设置页覆盖全部已选产品节，并为所有能力提供统一六态：disconnected、loading（含 capability `UNKNOWN` 的「正在确认引擎能力」）、unsupported、failed、empty、ready（定义见 [engine-preferences-completion §2](engine-preferences-completion.md)）。
2. Client Settings 七个 UA 分组不再只是空 TOC，每个可见分组均有真实设置或被诚实省略。
3. Conversation 补齐轨迹 Overview、完整详情入口、compacted 与 live 过程呈现。
4. 产品身份、键盘、ARIA、窄宽度、Web/远程表现完成。
5. Navigator、Sources、Diff、Connection Hub 已有 UI 不重写，只补跨面一致性和缺失状态。

## 2. 非阻塞验证政策

| 类别 | 对开发的影响 | 处置 |
|------|--------------|------|
| 单测、视觉回归、E2E、性能、可访问性扫描失败 | **不阻塞下一个 UI 切片开工** | 记入 [D17](../progress/deferred-gaps.md)，由 V 槽并行修复 |
| 既有基线失败 | 不阻塞 | 与本切片新增失败分开记录；不得借机扩大改动 |
| 方案**逐条点名**的断言替换（须写明测试文件、旧断言、新期望；目前只有 `settingsUaToc.test.ts:253` 负向 `ua.client.*` → 白名单一项） | 不算债 | 由该切片自己改；不记 D17。未在方案点名的红测一律记 D17，不得事后追认 |
| 变更无法编译、Workbench 无法启动 | **阻塞该冲突域合入** | 当前写者立即修复；其他不冲突槽继续 |
| 数据损坏、权限绕过、密钥泄漏 | **全局硬阻塞** | 停止相关切片并修复 |
| `local/code-layering` / boundary 测证明生产分层破坏 | **阻塞该冲突域合入**（与 [health-gates](../progress/health-gates.md) 一致） | 修正依赖方向后再合 |
| 缺少真实 Engine / Hub / Web 环境 | 不阻塞 UI | 用诚实状态与测试连接接口开发；不把 UI 标为已验证 |

测试未通过时，方案切片可以继续进入下一刀，但对应 PRD / plan 不得升 `implemented`。详细门禁见 [health-gates](../progress/health-gates.md)。

## 3. 三个 UI 槽、一个平台槽与一个验证槽

审查（2026-09-02，两轮）发现：三份 UI 子方案都依赖 `platform/universeAgent/**` 的新合同，而 UI 槽不拥有该目录；Web 形态今天没有 `IUniverseAgentConnection` / `IUniverseAgentSessionView` 注册，`IUniverseAgentHubService` 的 electron-browser 注册却经 common 链进 Web；Client Settings 的消费点全部落在 Conversation 文件里。因此增设 **P 槽**，并把 Client Settings 的执行从 A 移到 B。

| 槽 | 主线 | 方案 | 冲突域（完整清单以看板为准） |
|----|------|------|--------|
| P | platform/universeAgent 合同 | 本方案 §4 Wave 0 + 各子方案「平台前置」小节 | `platform/universeAgent/**`（common / node / electron-browser / **browser**）、`workbench.web.main.ts` 与 `workbench.desktop.main.ts` 的 UA 注册行、`connectionHub.contribution.ts` 中的 electron-browser import（P0 一次性移出） |
| A | Engine / Connection 设置面 | [engine-preferences-completion](engine-preferences-completion.md) | `enginePreferencesPane*`、`engine*Section*`、`engineCatalog.ts` 等 Engine 目录文件、`connectionPreferencesPane*`、`uaPreferencesPanes.contribution.ts`、`connectionHub.contribution.ts`（除 P0 的 import 行） |
| B | Conversation / Trajectory → Client Settings 消费点 | [conversation-ui-closeout](conversation-ui-closeout.md) → [client-settings-completion](client-settings-completion.md) | `contrib/conversation` timeline、trajectory、process fold、座位、对话框、`conversationLens*` 与其 CSS、roster/stub 服务、`conversationIdentityStrip*`、`conversationStubFrameSource.ts`、`uaClientSettings*`、`settingsLayout.ts` UA 段、`settingsUaToc.test.ts` |
| C | 产品身份 / 键位 / 主题 / Web 冒烟 / 可达性清单 | [product-identity](product-identity.md) → [accessibility-responsive-ui](accessibility-responsive-ui.md) | `product.json`、`product.ts` 回退、`userDataPath.ts`、`resources/**`、`build/**` 品牌产物、`workbench/browser/media/code-icon.svg`、`layoutActions.ts` 四钮键位、`browser/parts/conversation/media/ua-common.css`、`contrib/sources/**` 的 Review 命令 contribution、迁移入口 contrib、Web 冒烟脚本与 `d15-evidence/` |
| V | 非阻塞验证与回归修复 | 各方案验收表 + D17 | 测试、evidence；不得抢 P/A/B/C 生产文件 |

**可达性方案的实施归属：** A11Y-1/A11Y-2/RWD-1 归 B（Q5b/Q6）；Web 下省略桌面连接控件归 A 的 **E2-1**，RWD-2 归 A 的 E2-7；C 对这些切片只出验收清单并复核，不写 B/A 文件。C 直接实施：产品身份、四钮键位复核、`prefers-reduced-motion` / 高对比度公共规则文件、Sources Review 命令、Web 冒烟。

## 4. 切片顺序

### Wave 0：平台合同（P 槽，串行）

P 槽单写者，按以下顺序；每刀合入后对应 UI 槽即可从 unsupported 态切到真实数据源，不必等 Wave 0 全部完成。IDE 方法名以 [protocol-surface §1b](../../docs/reference/universe-agent/engine-protocol-surface.md) 的「P 切片 / IDE 方法」列为准。

| 切片 | 内容 | browser 断连实现同步 | 解锁 |
|------|------|----------------------|------|
| **P0** Web 诚实断连 | 新建 `platform/universeAgent/browser/`，以 **`registerSingleton`** 注册（**禁止**在 `workbench.web.main.ts` 调 `registerMainProcessRemoteService`）：`IUniverseAgentConnection`（`isEngineConnected()=false`；transport `idle`；所有 `Event` 为 `Event.None`；snapshot **含全部已有 capability 键**且均 `UNSUPPORTED` reason「Web 不支持本机 Engine 连接」；`connect()` 不 throw、返回无 token 的 `{ methods: [], events: [] }`；`connectProfile` 返回 `ok:false`、`code: 'unsupported_environment'`（新增于 `ConnectionFailureCode`，非 `transport_failed`）；`getConnectionPhase` = `disconnected`；其余方法 reject 为 `unsupported_environment`）、`IUniverseAgentSessionView` 空 lease、**`IUniverseAgentHubService`**（`getAuthStatus` = `unavailable`；`login` / `addDirectAddressProfile` 等 mutating 方法一律 `ok:false` + 环境码；profiles = `[]`；`isEncryptionAvailable()` = `true`，避免画「重启后再登录」冒充密钥环问题；不回显凭据）。在 `workbench.web.main.ts` 注册三者；把 `connectionHub.contribution.ts` 对 `electron-browser/universeAgentHubService` 的静态 import 移到 `workbench.desktop.main.ts` | 本刀即建立 | C WEB-1、D15 Web 冒烟；A E2-1 据 phase/capability 省略桌面控件 |
| **P1a** MCP 运行态 + Plugins | `IUniverseAgentConnection` 增 `getMcpServerStatuses` / `getMcpServerTools` / `listPlugins` / `getPluginInfo` / `enablePlugin` / `reloadPlugin` / `unloadPlugin` / `scanNewPlugins`；capability 增 `mcpRuntime`（IDE 推导），`plugins` 由 `PluginService.List` 真探测 | 同一提交补 browser 方法（拒绝）与新键 `UNSUPPORTED` | A E2-4、E2-5 |
| **P2a** DetailRef 通道 | lease 增 `requestDetail(ref): Promise<DetailFetchOutcome>`（`{ ok: true, truncated, totalBytes? } \| { ok: false, reason: 'unavailable' \| 'failed', message? }`）；`DetailPatch` 增 `truncated?` / `totalBytes?`；`IUniverseAgentSessionView` 与 electron-browser 代理同步；host 端 `DetailRef` → `AgentService.FetchToolDetail`（`subscribe=false`），**成功时先 `upsertDetail(ref, body = response.content, truncated, totalBytes)` 再 settle Promise**（保证 Promise ok 时 `details.get(ref)` 已有体），`success=false` → failed，方法未广告 / `UNIMPLEMENTED` → unavailable。**stub 帧源（`contrib/conversation/browser/conversationStubFrameSource.ts`）的本地 `requestDetail` 由 B 在「Q2 接通」实施**（接口来自本刀，B 不改 platform） | 同一提交：browser lease `requestDetail` 恒 `unavailable` | B Q2 接通 |
| **P1b** 模型注册表 | `listModels` 绑定 `ConfigService.ListModels`；capability 增 `models`、`providerConfig`（后者 G-ENG-1 闭合前固定 `UNSUPPORTED`） | 同上 | A E2-2 |
| **P2b** compacted 事实 | host demux **只从 L2** 取行身份：`branch_reason='compact'` 行、以及 `EnvelopeRangeReplaced(reason=COMPACT)`（**单独出现即成立**，`BRANCH_NOTICE` 若随行只作补充，不作为必要条件）两条路径 → `ItemAttribution.branchReason: 'compact'` + `ItemAttribution.compacted: { anchorTurnId, foldedLeafTurnId, compactBranchTurnId, summary? }`（来自 `CompactedSpanBlock` / `SummaryBlock`）。`ContextCompactedEvent`（仅 Chat 流）只在 Chat 臂已打开时作可选 token 富化，不订阅、不当显示源 | 同上（browser stub 不产生 compacted） | B Q3 |

P 槽不写任何 UI；类型变更同步 `engine-protocol-surface.md` §1b/§2 与 `universeAgentConnection.test.ts` 契约测试。

子方案切片编号：Engine `E2-*`、Conversation `Q*`、Client `CS-*`、产品身份 `I*`、可达性 `K*/T*/W*/L*`。下表的 A1/B1/C1 只是 Wave 内的槽序号，不是子方案切片号。

### Wave 1：结构闭集（P0 合入前即可开工）

- **A1** = E2-1 + E2-3：Engine pane 改为左导航 + 右详情，挂齐九节，新节先以 unsupported / disconnected 态存在；废止 hide-on-disconnect；**Connection / Engine 页在 Web（P0 后）按 phase / reason 省略桌面连接控件——省略只在 E2-1 这一刀，E2-7 不重复**。
- **B1** = Q1 + Q2 壳：轨迹 Overview 与 Detail 宿主；Q2 壳只有 preview / unavailable 两态（loading 与 stub `requestDetail` 需 P2a 接口，归 Q2 接通）。
- **C1** = I2 + I3a：`product.json` 映射（含 `userDataPath.ts` 开发态目录名、`product.ts` 回退）、品牌源入仓 + 生成脚本；K1 键位复核；可达性验收清单初稿（L1）。

### Wave 2：交互闭集（壳可先，真数据等对应 P 刀）

- **A2** = E2-2 / E2-4 / E2-5 / E2-6：Model 注册表、MCP Runtime、Plugins 先落壳与 unsupported 态，P1b / P1a 合入后只替换数据源；Skills/Agents/Tools 迁入宿主；Agents Model 子 tab 为 unsupported（G-ENG-4）。
- **B2** = Q3 / Q4 / Q5a / **Q2 接通**：compacted（P2b 后接通）、live process fold、轨迹四 kind + 对话页停止把 error/unknown/question 洗成 assistant、DetailRef full / partial / failed 与 stub `requestDetail`（P2a 后）。
- **B3** = Q5b / Q6：Conversation 键盘与 ARIA（A11Y-1/2）、窄宽度与跨面 reveal（RWD-1）。
- **C2** = T1 / K2 / I4 / I5：公共 reduced-motion / 高对比度规则文件、Sources Review 命令、About/Welcome/CLI 文案、迁移入口。

### Wave 3：收口与 Web

- **A3** = E2-7：Engine/Connection 窄宽度（RWD-2）与 StatusBar/Connection/Engine 文案一致（Web 省略已在 E2-1，此处不重复）。
- **B4** = CS-1 … CS-6：Client Settings 注册与消费点（依赖 Q5a/Q5b 落好的时间线与座位结构）。
- **C3** = W1 + I3b + L1 复核：Web 冒烟（依赖 **P0 + E2-1**）、三平台品牌产物接线、可达性清单逐项核对（含 CS-2 的 Enter 两模式）。
- 跨面：Conversation / Navigator / Review reveal 不因窄宽度、隐藏 Part 或 Web 形态失效；品牌名、图标、协议、数据目录与窗口标题一致。

Wave 之间不等待 V 槽全绿；只有 §2 的硬阻塞项会暂停相关冲突域。

## 5. 完成定义

M7 UI 完成必须同时满足：

1. 五份子方案的切片与 Wave 0 五刀均落地。**按面分别判定：** Engine 九节具备 [engine-preferences §2](engine-preferences-completion.md) 六态；Connection 页以 `ConnectionPhase` 五 kind 为准、Web / `unsupported_environment` 下省略桌面连接控件（不套 catalog 六态）；Conversation 轨迹详情具备 preview / loading / full / partial / unavailable / failed 六态；Client 七组各有真实键与消费点（本地设置，无引擎态）；Navigator / Sources / Diff 只要求诚实省略与不失效，不另造 unsupported。
2. 不以假数据填补 Engine 能力；缺 RPC 时显示明确的 unsupported，不隐藏成空白页。**Provider 凭据、Rules、Hooks、Agent profile `model.json` 在引擎补齐 G-ENG-1/2/3/4 前保持 unsupported，不画表单。**
3. 默认窗无 Copilot marketing、ChatEditor 主路径或第二套 Settings 皮肤。
4. 键盘可达、ARIA 与窄宽度行为有实现；测试是否全绿不改变「代码已落」事实，但决定能否升 `implemented`。
5. Web 入口能实例化 Conversation / Navigator / Sources / Connection 并显示诚实断连态；Connection / Engine 页在 Web 不画 Hub 登录、Direct Address、SAS、Test Engine（P0 + E2-1）。
6. `dev/progress/status.md` 与 [traceability](../../docs/product/traceability.md) 区分「代码已落」和「已有验证证据」。

## 6. 明确不纳入

- H6 HubDevice GUA 自动直连；它是网络路径 v2，不是 UI 完成前置。
- 完整插件市场、Skill 商店、Open VSX 分发。
- 用静态 fixture 冒充已连接 Engine。
- 为追求测试全绿停止不冲突 UI 槽。
- 引擎仓侧新增 RPC（G-ENG-1/2/3）；本波只登记缺口并交付 unsupported 态。
- 会话级模型策略（`SwitchModel` / `Get|SetModelPreferences`）UI；它属于 Composer Route/Model 下拉，另立切片。
- `SubscribeToolDetail` 终端 tail 流、`FetchToolUsageDetail`、`AgentService.Compact` 手动触发。
- Agent profile `model.json` 编辑器（G-ENG-4）。

## 7. 规则 16

本方案与五份子方案创建时为 `review`，2026-09-02 经四轮审查后均为 `accepted`。

**第一轮（本会话只读审查，2026-09-02）已改入：** P 槽与 Wave 0、可达性实施归属、Provider/Model 与引擎 proto 对齐、DetailRef 与 compacted 的平台前置、Web 注册缺失。

**第二轮（Cursor CLI `cursor-grok-4.6-high` `--mode ask`，7 路并行：总方案/看板、Engine、Client、Conversation、产品身份、可达性、跨文档一致性；2026-09-02）：** 总方案/看板一路 **Approve with changes**（1 Critical + 8 Important + 5 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 P0 漏 `IUniverseAgentHubService`；`connectionHub.contribution.ts` 静态 import electron-browser 注册经 common 链进 Web | Wave 0 P0 增 Hub browser stub 并移出该 import；看板 P 冲突域点名该文件；protocol-surface §1b/§2 同步 |
| I1 Client 消费点落在 B 文件，A/B 双写 | Client Settings 执行整体移到 B（Wave 3 B4 = CS-1…CS-6）；A 只做 Engine/Connection |
| I2 无主文件（Connection pane、Hub contribution、IdentityStrip、stub 帧源、Sources 命令） | §3 与看板所有权补齐：Connection 面归 A，IdentityStrip / stub 帧源 / roster 归 B，Sources Review 命令 contribution 归 C |
| I3 P2a「stub 源同步实现」落在 contrib | 改为「stub `requestDetail` 由 B 在 Q2 实施」 |
| I4 P2b 元数据载体未定 | 写死 `ItemAttribution.branchReason` + `compacted{…}` 字段闭集；行身份只来自 L2 |
| I5 P1a/P1b/P2a 不同步 browser 实现 | Wave 0 表加「browser 断连实现同步」列 |
| I6 「预告断言不记 D17」可被滥用 | §2 限定为逐条点名的断言替换；health-gates 加同一行 |
| I7 §5.1 不可判定 | 按面分别写判定标准 |
| I8 跨层破坏门禁与 health-gates 不一致 | §2 拆为 secret/数据全局硬门 + 分层破坏阻塞冲突域 |
| M1–M5 | INDEX 摘要提 P 槽；§6 补 `FetchToolUsageDetail` / `Compact`；protocol-surface 用 P1a/P1b；D15 track 改 M7；P2b「范围」= 三个 turn id |

其余六路意见分别记入各子方案「审查记录」。

**第三轮（同配置 7 路，附第二轮意见复核；2026-09-02）：** 总方案/看板一路 **Approve with changes**（0 Critical + 1 Important + 6 Minor），第二轮 C1/I1–I8 全部 Resolved。处理：

| 意见 | 处理 |
|------|------|
| I1 §5.1 把 catalog 六态套到 Connection | §5.1 改为 Connection 以 `ConnectionPhase` 为准 + Web 省略控件 |
| M1 「§1.1」不存在 | 改指 engine-preferences §2 |
| M2 P2a 成功态未写 body 回填顺序 | P2a 写明先 `upsertDetail(content)` 再 settle |
| M3 P0 未禁 `registerMainProcessRemoteService`；Hub 无 `connect` | P0 写明 `registerSingleton`；Hub 方法按接口列出（`login` / `addDirectAddressProfile` / `isEncryptionAvailable` / profiles） |
| M4 `conversationEditorPane*`、`sources.contribution.ts` import 点无主 | 看板 B 补前者；C 拥有后者的一行 import |
| M5 status.md 裁定句分层未限冲突域 | 改口 |
| M6 P2b 路径二合取条件 | 改为 RangeReplaced 单独成立 |
| 跨路 Web 省略写进 E2-1 与 E2-7 两刀 | Wave 1 A1 / Wave 3 A3 / status.md 统一：省略只在 E2-1，W1 依赖 P0 + E2-1 |
| 跨路 Q2 接通无 Wave 座位 | Wave 2 B2 加 Q2 接通；看板 Q2 拆壳 / 接通两行 |

**第四轮（确认轮，同配置 7 路；2026-09-02）：** 总方案/看板一路 **Approve**（0 Critical / 0 Important / 2 Minor：§5.5「E2-1/E2-7」残句、P2b 合取句在 protocol-surface 与 closeout 的残留——均已改入）。七路合计 6 Approve + 1 Approve with changes（Conversation 一项 Important：Q2 壳无 P2a 姿态三处不一致，已文本对齐）。**据此六份方案同日升 `accepted`**；这项文档门禁不改变 §2 的测试非阻塞政策。
