---
title: "Engine Preferences UI 完成方案"
type: plan
status: accepted
phase: M7
updated: 2026-09-02
summary: "把 ua.engine 从四段纵向列表补成完整的 Overview、Provider & Model、Skills、Agents、Rules、Hooks、MCP、Plugins、Tools 九节；Model 走 ConfigService.ListModels 只读注册表，Provider/Rules/Hooks/Agent model.json 在引擎补 RPC 前保持 unsupported 完整态；MCP 运行态与 Plugins 依赖 P1a；Connection 面的 Web 省略与窄宽度也归本方案（A 槽）"
---

# Engine Preferences UI 完成方案

> **需求：** [PRD-025 Engine 设置完整性](../../docs/product/requirements.md#prd-025-engine-设置完整性)。
> **父方案：** [M7 UI 完成波](m7-ui-completion-wave.md)（P 槽 Wave 0 见其 §4）。
> **既有合同：** [设置两套主面](settings-two-surfaces.md) · [Engine catalog](customizations-engine.md) · [M6 引擎波](m6-engine-wave.md)。
> **引擎面：** [engine-protocol-surface §1 / §1b / §2 / §4](../../docs/reference/universe-agent/engine-protocol-surface.md)（2026-09-02 对照 proto 核对）。
> **现状：** `EnginePreferencesPane` 只挂 Skills、Agents、MCP Definitions、Tools 四节，按 `(height - 220) / 4` 固定分高；`IUniverseAgentConnection` 没有 MCP 运行态、Plugins、模型注册表任何方法；capability `plugins / globalRules / projectRules / hooksMetadata` 在 `grpcCapabilityProbe.ts` 固定 `UNSUPPORTED`。

## 1. 目标形态

`ua.engine` 继续使用 `PreferencesEditor` 子 pane，不新增 SettingsScreen。页内改为 vscode 设置密度的两栏：

```text
┌ Engine ─────────────────────────────────────────────┐
│ [Overview]            当前 Engine / capability 摘要 │
│ Provider & Model      Model 注册表 | Provider（unsupported）│
│ Skills                列表 + 正文                    │
│ Agents                profile + AGENTS.md + tools（model 为 unsupported）│
│ Rules                 unsupported 完整态             │
│ Hooks                 unsupported 完整态             │
│ MCP Servers           Definitions | Runtime          │
│ Plugins               列表 + 启停/重载/扫描          │
│ Tools                 当前 profile enablement        │
└──────────────────────────────────────────────────────┘
```

- 左栏使用 `WorkbenchList`，不是卡片栅格。
- 右栏每次只显示一个节，避免现有固定分高继续扩散。
- Provider 与 Model 是一个节内两组，不复用 Copilot `ModelsManagementEditor`。
- Plugins 是 Engine plugin，不是 vscode Extension；无 Browse Marketplace。
- MCP Runtime 放在 MCP 节的第二个 tab，不新建第二套 MCP 页面。
- 九节在任何连接/能力状态下都在左栏可达；节的"不可用"是右栏内容，不是隐藏。「无 Engine 时整页诚实空」（settings-two-surfaces §2、PRD-025 验收 2）在本方案的含义是**零条目、零写按钮**，导航仍可达；E2-1 据此废止 HEAD 的 hide-on-disconnect（`shouldHideCatalogRows` 与 `disconnected pane hides skills section` 测试）。
- Connection Preferences pane（`connectionPreferencesPane*`）也归本方案 A 槽：Web / `unsupported_environment` 下省略 Hub 登录、Direct Address、SAS、Test Engine（E2-1），窄宽度（E2-7）。

## 2. 全局状态机

每节必须覆盖以下状态，判定顺序自上而下、命中即止：

| 状态 | 判定 | UI |
|------|------|----|
| disconnected | `isEngineConnected()=false` | 页级文案复用 `getConnectionPhaseStatusBarText` 的「Engine not connected」+ Open Connection；右栏各节零条目、零写按钮；**废止** `getEngineEmptyCopy` 的「No engines yet」（会被读成真空目录）与「Engine is connected.」——Test 结果与 Overview 连接摘要一律复用同一函数的「Engine · Hub relay / Direct / Loopback」措辞 |
| unsupported | capability `UNSUPPORTED` | 节可打开，显示 capability reason；零假条目、零写按钮 |
| loading | capability `UNKNOWN`（文案「正在确认引擎能力」，复用 `getCatalogUnknownCopy`）**或** list RPC in-flight（文案「正在读取…」） | 节标题与进度提示；保留上次选择，不闪空。两种 loading 文案不得混用 |
| failed | list RPC reject（transport failure） | 显示 transport 错误与 Retry；不把失败画成 0 条。**in-flight 与 failed 互斥**：RPC settle 必须先清 in-flight 再置 failed |
| empty | RPC 成功且列表长度 0 | 该节真空态与合法 New/Add |
| ready | RPC 成功且有条目 | 列表、详情、写操作按能力显示 |

断连后 catalog 页清掉 RPC 缓存并回 disconnected；不得显示「已同步」。**Engine catalog ≠ Navigator / 时间线**：Navigator「断开前快照」是会话面合同，配置页不复用。会话级「已连接」措辞仍只属于 SessionBar。

统一状态组件（E2-1）供九节共用：同一 DOM 结构、同一 `role=status` 播报，Retry 按钮**只在 failed 出现**，reason 文案来自 capability `reason` 或 transport error，不在各节手写。

**落点与编译边界（避免 E2-1 撑破 E2-6 文件）：** 现类型 `EngineCatalogPaneMode = 'disconnected' | 'unsupported' | 'unknown' | 'supported'`（`engineCatalog.ts:10`）被四节直接判别（`engineAgentsSection.ts:400-412`、`engineSkillsSection.ts:326-328`）。E2-1 **新增**六态类型 `EngineSectionState` 与组件文件，**保留**四态别名不删；`shouldHideCatalogRows` 改为恒 `false`；为保证编译与「断连不隐藏」，E2-1 允许对四个 `engine*Section.ts` 做**一次性最小改动**：删 `display:none` 分支、把 `'supported'` 判别改为读新六态（列入 §7 冲突域）。E2-6 再做迁入与四态别名删除，不改状态机语义。

## 3. 各节合同

### 3.1 Overview

- 显示 Engine 名、连接路径（Hub relay / Direct / loopback）、工作目录、capability 摘要。
- Model 摘要只在 `models=SUPPORTED` 且 E2-2 落地后显示注册表已启用模型数；Provider 摘要在 G-ENG-1 前不显示。
- 不显示 Hub access token、地址、ticket 或 session token。
- capability 只显示 `SUPPORTED / UNSUPPORTED / UNKNOWN` 的产品文案，不展示协议枚举。

### 3.2 Provider & Model（按引擎 proto 重写）

引擎没有 Provider CRUD、「凭据是否已配置」查询或模型「上下文上限 / 能力标签」字段。本节按实际存在的 RPC 定义：

**Model 组（`models` capability，P1b 后可用）**

- 数据源：`ConfigService.ListModels(include_disabled=true)` → `ModelEntryProto{ id, type, enabled, level, description, cost, speed, provider, model_id }`。
- 呈现：按 `provider` 分组的只读列表；行显示 `type`、`model_id`、`level`、`cost`、`speed`、启用态；禁用项灰显，不隐藏。分组标题旁一句脚注「provider 名来自模型注册表，不代表已配置凭据」。
- 没有写操作：引擎没有模型注册表写 RPC。不画 Enable/Disable。
- 说明行：会话级模型选择与策略（`SwitchModel` / `Get|SetModelPreferences`）属于 Composer Route/Model 下拉，本节只给一句指向，不画会话级控件。
- Agent profile 没有 `model.json` 写路径（G-ENG-4），本节与 §3.4 都不提供 model 编辑。

**Provider 组（`providerConfig` capability，G-ENG-1 闭合前固定 unsupported）**

- 显示 unsupported 完整态，reason 取 capability `reason`（protocol-surface §2：「Provider 配置键合同未定」）。
- **零引擎数据、零列表**：不在本组重复 provider 名（避免被读成「已配置」）。
- **不画** endpoint / API key 输入、遮罩框或 Test connection 按钮。`TestModelProfile` 与 `ConfigService.Set` 的接入等 G-ENG-1 给出 config key 合同后另立切片；届时 `api_key` 只经 electron-main gRPC 出站，renderer 不持久化、不回显。
- 不得转跳 Copilot Models、不读 `github.copilot` provider 配置。

### 3.3 Skills

沿用已落的 list/toggle/body/New：

- BUNDLED 只读；USER/PROJECT 可编辑。
- toggle 显示「当前对话不会热切换」说明。
- 补删除/重命名入口前必须有对应 Engine API；没有时不画假按钮。

### 3.4 Agents

- 列表、Save/Delete/Reset、`AGENTS.md` 与 `tools.json` 已有路径继续复用。
- 详情用子 tab：Instructions / Tools / **Model（unsupported）**。`SaveAgentProfileRequest.AgentProfileProto` 没有 `model` / `modelType` / `maxTurns`，引擎 mapper 写死 null、`model.json` 永不落盘（G-ENG-4）；Model tab 只显示 unsupported 态，reason「Engine 的 SaveAgentProfile 不承载 model.json」。**禁止**自由文本 + `SaveAgentProfile` 冒充已写入。
- BUILT_IN 不可删除，Reset 与 Delete 不同时出现。

### 3.5 Rules（G-ENG-2 前固定 unsupported）

- 引擎的 `RulesBridge` 是 Desktop/Singularity 进程内接口，本仓 IDE 只经 gRPC，**没有 Local 路径**（本仓无任何 `RulesBridge` 或读 `{AgentHome}/rules` 的代码）。在引擎提供 Rules gRPC 前，本节在任何连接模式下都是 unsupported 完整态，reason 取 capability `reason`。
- 节结构（Global / Project 两组、行含标题、启用态、优先级、范围）作为壳实现，供 G-ENG-2 闭合后接线；**完成线：两组行数恒为 0**。
- 不读取 `.github/copilot-instructions.md` 冒充 UA rule；不把 `PermissionService.GetSessionRules`（权限规则，定义在 `session_service.proto`）当 Instructions。
- 旧文档 `customizations-engine.md` §1/§2 与 `engine-catalog.md` §4/§5 的「Local 可读写 AgentHome」说法已于 2026-09-02 回改。

### 3.6 Hooks（G-ENG-3 前固定 unsupported）

- 左侧 hook 定义、右侧点位表的两栏壳实现；`hooksMetadata=UNSUPPORTED` 时显示「当前 Engine 不提供 Hook metadata」，**完成线：两栏行数恒为 0**（全仓 proto 无 `ListHookPoints`）。
- 不从 `points.md` 抄静态点位，不读 `{AgentHome}/hooks.json`，不出现 vscode task/save-file 事件。
- Plugins 节的 `hook_count` / `PluginHookEntry` 不用来充当 Hooks 节内容。

### 3.7 MCP Servers

- Definitions：沿用 List/Add/Update/Remove/Toggle。
- Runtime（`mcpRuntime` capability，P1a 后可用）：`GetMcpServerStatuses` → 每服务器 `status ∈ DISCONNECTED / CONNECTING / CONNECTED / ERROR`、`error_message`、`last_connected_at`，页脚显示 `checked_at`；选中服务器后 `GetMcpServerTools(server_id)` 列 `name / description`，显示 `total` 与 `cached_at`，Refresh 传 `force_refresh=true`。
- 产品文案用 Disconnected / Connecting / Connected / Error 四态，不自造 stopped/starting；`MCP_STATUS_UNSPECIFIED` 归入 failed 行（显示「状态未知」），不画第五态。
- Definitions 与 Runtime 共享 `server_id`；`mcp=SUPPORTED` 而 `mcpRuntime=UNSUPPORTED` 时 Runtime tab 显示 unsupported，Definitions 照常。禁止把 vscode `IMcpService` 数据混入。

### 3.8 Plugins（`plugins` capability，P1a 后可用）

- `PluginService.List` → `PluginSummary{ id, display_name, version, source, hook_count, status ACTIVE/DISABLED/ERROR, loaded_at }`；行显示名称、版本、`source` 原文（wire 值，不解释）、hook 数、状态。
- 详情 `Info` 显示 `PluginHookEntry{ hook_type, priority, class_name }` 列表；**`hooks` 为空就空表**，禁止用 `hook_count` 造行。
- 写操作：Enable / Reload / Unload 按行，ScanNew 在工具栏；每个按钮只在 Connect 广告了对应方法时出现。Unload **仅当 wire `source === "embedded"`** 时隐藏，不本地猜测。
- ScanNew 结果只按 `ScanNewPluginsResponse.new_plugins` / `skipped_count` 展示；为空诚实显示「未发现新插件」，禁止用 List 长度差宣称扫描结果。
- 写操作被引擎以 `PERMISSION_DENIED`（非 operator）拒绝时按 failed 显示错误，不得显示「已启用 / 已卸载」。
- 无安装市场；`plugins=UNSUPPORTED` 时显示明确原因，不再整节永久隐藏。

### 3.9 Tools

- 保持 Engine `ListTools` + 当前 Agent Profile `tools.json` 的双层语义。
- 切 profile 后刷新 enablement；保存仍走 `SaveAgentProfile`。
- client-tool 运行态与 Engine 内置工具分组显示，不混入 Copilot CLI 工具名。

## 4. 平台前置（P 槽，不由本方案写）

| P 切片 | 本方案依赖 | 未合入时的姿态 |
|--------|------------|----------------|
| P0 | `getConnectionPhase` 在 Web 为 `disconnected`、`connectProfile` 返回 `code: 'unsupported_environment'`、capability 全 `UNSUPPORTED` reason「Web 不支持本机 Engine 连接」；Hub `getAuthStatus` = `unavailable` | E2-1 的 Web 省略逻辑按 phase / reason 判定，桌面不受影响；P0 前不得声称 Web 已诚实 |
| P1a | `getMcpServerStatuses` / `getMcpServerTools`；`listPlugins` / `getPluginInfo` / `enablePlugin` / `reloadPlugin` / `unloadPlugin` / `scanNewPlugins`；capability `mcpRuntime`；`plugins` 真探测 | E2-4 Runtime tab、E2-5 Plugins 显示 unsupported |
| P1b | `listModels`；capability `models` / `providerConfig` | E2-2 Model 组显示 unsupported |

UI 只 import `platform/universeAgent/common/**` 类型；方法签名以 P 槽合入的 `universeAgentConnection.ts` 为准，本方案不重复定义。

## 5. 切片

| 切片 | 内容 | 代码完成线（可观察项） | 依赖 |
|------|------|------------|------|
| E2-1 | 两栏宿主、导航、Overview、统一状态组件（新增六态类型 + 四节最小改动）、**Connection/Engine 在 Web 省略桌面控件（省略只在此刀，E2-7 不重复）** | 九节 id 均可达；`shouldHideCatalogRows` 恒 false、四节 `display:none` 分支删除、hide-on-disconnect 测试改写；断连时零条目零写按钮，页级文案为「Engine not connected」，无「No engines yet」/「Engine is connected.」；Web（P0 后）Connection 页无 Hub 登录 / Direct / SAS / Test，Engine 页无 Test | P0（仅 Web 部分） |
| E2-2 | Model 注册表 + Provider unsupported 组 | **P1b 前**：两组均 unsupported 完整态，Provider 组 DOM 内零凭据 / 测试 / 写控件（统一组件的 Retry 只在 failed）；**P1b 后**：Model 组按 provider 分组只读列表、禁用项灰显、脚注就位 | P1b（仅第二段） |
| E2-3 | Rules + Hooks 壳 | 两 scope 壳与两栏壳；reason 来自 capability；行数恒 0 | — |
| E2-4 | MCP Runtime tab | 四态 + UNSPECIFIED→failed、工具列表、`checked_at`/`cached_at`、Refresh；`mcp` 可用而 `mcpRuntime` 不可用时 Definitions 不受影响 | P1a |
| E2-5 | Plugins | 列表、Info 空表不造行、Enable/Reload/Unload/ScanNew 门控、`PERMISSION_DENIED`→failed | P1a |
| E2-6 | Skills/Agents/Tools 收口 | 现有四节迁入新宿主；迁入前后以下可观察项一致：选中的 skill / profile id、textarea dirty 标志、Tools checkbox 未保存状态、能力门控（Save 显隐）；Agents 加 Model 子 tab（unsupported） | — |
| E2-7 | 响应式与跨面文案（**不含 Web 省略**，那在 E2-1） | Engine 与 Connection pane 以 `dimension.width` 打 `.is-narrow`，<600px 单栏可返回、表单不溢出（= a11y RWD-2）；StatusBar/Connection/Engine 文案一致 | — |

E2-1（桌面部分）、E2-3、E2-6 可在 P 槽任何一刀前开工。E2-2/E2-4/E2-5 的 UI 也不等待 P：先落壳与 unsupported 态，P 合入后只替换数据源。不得用成功 fixture 作为产品默认数据。

## 6. 验证债与状态

测试由 M7 V 槽并行维护，失败记 D17，不阻塞下一 E2 切片。方案升 `accepted` 后开工；以下证据缺失时，状态停在 `accepted` / `in_progress`，不得标 `implemented`：

- 九节键盘可达与窄宽度截图。
- connected / unsupported / transport failed / empty 四套状态。
- MCP Definition 与 Runtime 数据源隔离；`mcp` 可用而 `mcpRuntime` 不可用时 Definitions 不受影响。
- Plugins 无 marketplace 与 vscode Extension 数据。
- Provider 组无任何输入控件；`settings.json` 与 renderer storage 中无 provider 凭据字样。
- Rules / Hooks 壳在断连、unsupported 两态下条目数为 0；Agents Model 子 tab 无可编辑控件。
- Web（P0 后）Connection / Engine 页无桌面连接控件。

## 7. 冲突域

- 主文件：`enginePreferencesPane.ts` 与其 CSS 仅 E2-1/E2-7 写；`engineCatalog.ts` 状态机语义仅 E2-1 写，E2-6 只允许删除四态别名（不改六态判定）。
- 各节独立文件（`engine*Section.ts`、`engineSkillCatalog.ts`、`engineToolProfile.ts`、`engineAgentAgentsMd.ts`）：E2-1 做一次性最小改动（§2 编译边界）后，可在 E2-1 合入后并行；E2-6 必碰这四个文件。
- `connectionPreferencesPane*`、`uaPreferencesPanes.contribution.ts`、`connectionHub.contribution.ts`（除 P0 移出的那一行 import）归本方案。
- `IUniverseAgentConnection` 新能力由 P 槽扩展；UI 不 import `platform/universeAgent/node/**`。
- Engine 相关 StatusBar 文案（`conversationSessionStatus*.ts`）默认归 C，E2-7 需要改动时经看板转交。

## 8. 规则 16

本方案 2026-09-02 经四轮审查后为 `accepted`。

**第一轮（本会话只读审查，2026-09-02）已改入：** Provider/Model 按 proto 重写、Rules 无 Local 路径、MCP Runtime 与 Plugins 字段与 P1a 对齐、平台前置表。

**第二轮（Cursor CLI `cursor-grok-4.6-high` `--mode ask`，2026-09-02）：Approve with changes**（1 Critical + 7 Important + 6 Minor + 4 Cross-doc）。处理：

| 意见 | 处理 |
|------|------|
| C1 Agents Model 子 tab 是假编辑器（`SaveAgentProfile` 不承载 `model.json`） | §3.4 改为 unsupported，登记 G-ENG-4；§3.2、§5 E2-6、§6 同步；`engine-catalog.md` §4/§5 回改 |
| I1 状态机缺 `unknown`、loading/failed 可同时 | §2 重写为判定顺序表，UNKNOWN 并入 loading 并区分文案，in-flight 与 failed 互斥 |
| I2 Provider 组列 provider 名会被读成已配置 | 移到 Model 组脚注；Provider 组零引擎数据 |
| I3 Plugins ScanNew/Info/source 现网实现与 proto 注释不符 | §3.8 只按 wire 值与响应字段展示；`PERMISSION_DENIED` → failed |
| I4 E2-6 完成线不可判定、Model 候选依赖 P1b | §5 改为可观察项；Model 候选随 C1 删除 |
| I5 断连清缓存 vs Navigator 快照 | §2 与 `engine-catalog.md` §5 加「Engine catalog ≠ Navigator」 |
| I6 未废止 hide-on-disconnect；「Engine is connected.」违反 PRD-007 | §1/§2/E2-1 完成线写明废止与文案替换 |
| I7 统一状态组件落点未写 | §2 指定 E2-1 独占扩展 `engineCatalog.ts`；§7 补冲突域 |
| M1–M6 | `PermissionService.GetSessionRules` 改名；UNSPECIFIED → failed；Hooks 行数恒 0；冲突域补四文件；Provider reason 跟 capability；operator DENIED |
| X1/X2 旧文档「Local 可读写 AgentHome」 | `customizations-engine.md` §1/§2、`engine-catalog.md` §4/§5 已回改 |
| X3 父方案「等 P」措辞 | 总方案 Wave 2 改为「壳可先、真数据等 P」 |
| X4 「整页诚实空」vs「九节可达」 | §1 统一为零条目零写按钮、导航可达 |

**第三轮（同配置，附第二轮意见复核；2026-09-02）：Approve with changes**（0 Critical + 1 Important + 4 Minor + 4 Cross-doc）；第二轮 C1、I1–I7、M1–M6、X1–X3 全部 Resolved，X4 未改旧文。处理：

| 意见 | 处理 |
|------|------|
| I1 E2-1 改 `EngineCatalogPaneMode` 会撑破 E2-6 文件 | §2 加「落点与编译边界」：新增六态类型保留四态别名，E2-1 对四节做一次性最小改动并列入冲突域 |
| M1 Retry 与「零 button」冲突 | Retry 只在 failed；E2-2 「零 button」改为零凭据/测试/写控件 |
| M2 断连文案三处不一致、「No engines yet」 | §2 统一复用 `getConnectionPhaseStatusBarText`，废止 `getEngineEmptyCopy` |
| M3 E2-2 完成线未拆 P1b 前后 | 拆两段 |
| M4 / X1 `customizations-engine.md` §3.3 旧句（`model.json` 可编、Local RulesBridge 已有） | 回改为 G-ENG-4 / Desktop 进程内 |
| X2 `settings-two-surfaces.md` / PRD-025 验收 2「整页诚实空」 | 两处加「零条目零写按钮，导航仍可达」 |
| X3 父方案 Web 省略写进 E2-7 | 父方案 / status.md 统一为只在 E2-1 |
| X4 `engine-catalog.md` §2 断连「整节隐藏」未标 HEAD | §2 标 @ HEAD 并指向 §5 / E2-1 废止 |

**第四轮（确认轮；2026-09-02）：Approve**（0 Critical / 0 Important / 2 Minor：父方案与 a11y 的「E2-7 省略」残句、E2-6 删四态别名的写权——均已改入）。**升 `accepted`。**
