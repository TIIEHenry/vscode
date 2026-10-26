---
title: "Engine 页 Customizations catalog（ua.engine）"
type: reference
status: accepted
phase: N/A
updated: 2026-10-26
summary: "左栏 15 节。桌面 Providers 可写凭据并导入，并列出内置预设与 models.dev 云端目录；筛选两边都空时写 No matching providers.，云目录还在读时不写；Models 可增删改与测试，对话框在 level 后有 Description、Cost、Speed；Token Usage 无参读全局用量；Memory 只做 global 的列出、搜索、保存和删除，无 searchMemory 的查询不把旧列表当命中，零条搜索不是空库；Rules 桌面可增删改，网页不实现；Hooks 仍只读；产品验证未做"
---

# Engine 页 Customizations catalog（`ua.engine`）

> 宿主与 TOC 见 [Settings UA 接入](../../reference/code-oss-b2/settings-ua-access.md)。权威表与协议缺口见 [customizations-engine](../../../dev/plans/customizations-engine.md)。传输 RPC 登记见 [engine-protocol-surface §1/§7](../../reference/universe-agent/engine-protocol-surface.md)。

`EnginePreferencesPane` 是 Preferences 子 pane（`ua.engine`），左栏 `WorkbenchList`、右栏一次一节。Providers（凭据状态）与 Models（注册表）分节。本节记 **@ HEAD 代码事实**（E2-1–E2-7 @ `482b611a` 一带；**GC-6** Overview Model 摘要 @ `f583073b` / `d98d888a`）。桌面 Provider 凭据写与 Models 注册表写已接通。Rules 的 Upsert/Delete 已进桌面 connection，网页不实现。**不得**把 Hooks 定义写或 Composer 下拉写成已接通；§8.3 产品验收与 PRD-008 隔离 profile 冒烟仍待。

[PRD-025](../../product/requirements.md#prd-025-engine-设置完整性) / [engine-preferences-completion](../../../dev/plans/engine-preferences-completion.md)（`accepted`）的 **代码完成线已落**；产品验证未做，PRD **不**升 `implemented`。下文表是当前代码，不是「待实施目标」。
Engine Preferences 子页（`EnginePreferencesPane`）承载 Customizations 产品主面。本节记 **@ HEAD 两栏壳**：四节 list/toggle/写（Skills / Agents / MCP Definitions / Tools）、Overview 摘要、Providers 桌面凭据写、本地导入、内置预设与 models.dev 云端目录、Models 桌面注册表写、Token Usage、Memory、Rules 桌面写、MCP Runtime tab、Plugins probe/列表。**不得**把 Hooks **定义写**写成已接通（[G-ENG-3](../../reference/universe-agent/engine-protocol-surface.md) 仍是只读点位）。[G-ENG-2](../../reference/universe-agent/engine-protocol-surface.md) 的 Upsert/Delete 已进桌面，网页不实现。searchDeep / read / reflect / rebuild / revert / history 不在 Memory 页。产品验收与 PRD-008 隔离 profile 冒烟仍待。

**M7 代码完成线（产品验证未做）：** [PRD-025](../../product/requirements.md#prd-025-engine-设置完整性) E2-1–E2-7 九节六态已挂。HEAD 左栏是 15 节。实施方案见 [engine-preferences-completion](../../../dev/plans/engine-preferences-completion.md)（`accepted`）。本页以下 `@ HEAD` 表只陈述当前代码。没有用户可观察证据不得升 `implemented`。

## 1. 节与能力键

| Engine 页节 | 能力键 | `IUniverseAgentConnection.getCapabilitySnapshot()` 来源 |
|-------------|--------|-----------------------------------------------------------|
| Overview | （聚合） | 连接 phase / `workDir` / transport；capability 摘要；Model 行读 `models` |
| Providers | `providerConfig` | `listProviderStatus?`；内置预设在本地；桌面另有 `listProviderPresetCatalog?`（models.dev，不是引擎 RPC）、`upsertProviderCredentials?` / `clearProviderCredentials?` 与本地导入 |
| Models | `models` | Connect 广告 + `ConfigService.ListModels` probe（P1b）。桌面另有 `upsertModel?` / `deleteModel?` / `setModelEnabled?`。会话选用在 Composer |
| Token Usage | （无独立键） | `getGlobalUsage?` 无参。缺方法是 unsupported，不是零快照。不是 `getSessionUsage` / `Agent.Usage` |
| Skills | `skills` | Connect 广告 + `ToolService.ListSkills` probe |
| Agents | `agentProfiles` | Connect 广告 + `AgentService.ListAgentProfiles` probe |
| Rules | `globalRules` / `projectRules` | `listProjectRules?` 列 Global(2)/Project(1)。桌面另有可选 `upsertProjectRule?` / `deleteProjectRule?`（IPC allowlist，node 转发）。网页连接不实现写方法 |
| Memory | （无独立键） | `listMemory?` / `searchMemory?` / `saveMemory?` / `deleteMemory?`。scope 恒 `global`。searchDeep / read / reflect / rebuild / revert / history 不在此页 |
| Hooks | `hooksMetadata` | connection `listHookPoints?` 只读点位；Definitions 栏无 RPC |
| MCP Servers | `mcp` / `mcpRuntime` | Definitions：`McpService.ListMcpServers`。Runtime：`GetMcpServerStatuses` / `GetMcpServerTools`（P1a） |
| Plugins | `plugins` | `PluginService.List` 真探测（P1a）；无 marketplace |
| Tools | `tools` | Connect 广告 + `ToolService.ListTools` probe |

禁止用 Copilot 盘或 `{AgentHome}` 扫盘顶替任何一节。

代码里左栏实为 15 节（`ENGINE_PREFERENCES_NAV_ENTRIES`）：overview、providers、models、tokenUsage、skills、agents、rules、memory、hooks、triggers、clipboard、contextVariables、mcpServers、plugins、tools。Token Usage（“Token Usage”）在 Models 之后，Memory（“Memory”）在 Rules 之后。Triggers、Clipboard、Context Variables 在已连接且非 pairing-hold、列表能力为 `UNKNOWN`（缺字段归一成 `UNKNOWN`）时不发 list，画 `loading` / `loadingKind: 'capability'`（Confirming engine capability…）。无上次成功行则清展示，不画空成功；已有行留下且不再发 list。`UNSUPPORTED`，或 `SUPPORTED` 但 hook 不是函数，仍画 unsupported，不发。pairing-hold 与断连仍先走原路径。Token Usage 与 Memory 没有能力键，方法缺失即为 unsupported。FireTrigger 返回 `status`/`reason` 表示被拒时仍画 neutral，也未接错误态。

| Engine 页节 | 能力键 | 数据 |
|-------------|--------|------|
| Overview | （聚合，无独立键） | 连接路径 / workDir / 各能力摘要；不暴露 secret |
| Providers | `providerConfig` | `listProviderStatus?`；内置预设与桌面云端目录见 §3。网页无写方法则不画凭据框 |
| Models | `models` | `ListModels`；桌面注册表写见 §3。会话选用在 Composer |
| Token Usage | （无独立键） | `getGlobalUsage()` 无参；micros 原样显示；无 24h/7d |
| Skills | `skills` | Connect 广告 + `ToolService.ListSkills` 运行时 probe（`grpcCapabilityProbe.ts`） |
| Agents | `agentProfiles` | Connect 广告 + `AgentService.ListAgentProfiles` probe |
| Rules | `globalRules` / `projectRules` | `listProjectRules?`；桌面写见 §3（G-ENG-2）。网页不实现写 |
| Memory | （无独立键） | scope 恒 `global`。列表 category `''`；搜索 limit 50。无 searchMemory 的查询清列表并写 “Search is unavailable.”。零条写 “No matching memory.”。列表为空仍是 “No memory.”。无 memory-enabled 开关 |
| Hooks | `hooksMetadata` | `listHookPoints?` 只读点位（G-ENG-3 Definitions 无 RPC） |
| MCP Servers | `mcp` + `mcpRuntime` | Definitions = `ListMcpServers`；Runtime tab = `GetMcpServerStatuses` / `GetMcpServerTools`（P1a） |
| Plugins | `plugins` | Connect 广告 + `PluginService.List` probe（P1a）；无 marketplace |
| Tools | `tools` | Connect 广告 + `ToolService.ListTools` probe |

禁止用 Copilot 盘或 `{AgentHome}` 扫盘顶替任何 catalog。Hooks 只读列表来自引擎 RPC；无 hook 时仍完整 unsupported。不画 hook 定义写表单。Rules 写只在桌面方法存在时出现。Provider 密钥不进 `settings.json`，也不在渲染进程留存。

## 2. 渲染模式（六态 @ HEAD）

`engineCatalog.ts` 的 `EngineCatalogPaneMode`：`disconnected` \| `unsupported` \| `loading` \| `failed` \| `empty` \| `ready`。判定自上而下、命中即止（`resolveEngineCatalogPaneMode`）。E2-1 **废止** disconnected 整节隐藏：各节在左栏始终可达；「无 Engine」= 右栏零条目、零写按钮，不是把导航藏掉。断连 CTA **只在页级 banner**：Test Engine 次要 + Open Connection 主要；catalog 节 body **只出文案**（不再各节再画 Open Connection）；页脚 Test Engine **仅已连接**时出现。状态字停在可见的那颗 Test 旁边。

| 模式 | 条件 | UI |
|------|------|-----|
| `disconnected` | `!isEngineConnected()` | 页级 banner 复用 `getConnectionPhaseStatusBarText` + Test / Open Connection；节级只出文案；零条目零写按钮 |
| `unsupported` | 已连接且能力 `UNSUPPORTED` | 节标题在；**零假条目**；`getCatalogUnsupportedCopy`（可带 `reason`） |
| `loading` | 已连接且能力 `UNKNOWN`（「正在确认引擎能力…」）**或** list in-flight（「正在读取…」） | 两种 loading 文案不得混用 |
| `failed` | list RPC reject | transport 错 + Retry；**不得**画成 0 条。in-flight 与 failed 互斥 |
| `empty` | RPC 成功且列表长度 0 | 真空态；允许合法 New/Add |
| `ready` | RPC 成功且有条目 | 列表 / 详情 / 写控件 |

写入口仅 `canPerformCatalogWrite`（`empty` \| `ready`）。`canShowCatalogRows` 仅 `ready`。`shouldHideCatalogRows` 已 deprecated，不得再当 hide-on-disconnect。MCP / Skills / Agents 写成功后 `refresh()` 仅在 list listed 时回刷 Added/Created/Saved 等成功文案（D201 同胞）。Agents markdown Save 二次回刷同样闸 `listed`，不用 mode（D223）。Plugins Enable / Disable / Reload / Unload / scanNew 同样仅 `listed === true` 才回刷 Enabled./Disabled./Reloaded./Unloaded. / lastScan（D216 / D222）；不得用 `canPerformCatalogWrite(this.mode)` 代理。

写按钮的主次：页脚 / 页级 Test Engine、节内 Save（Skills 正文、Agents 的 `AGENTS.md` / Tools / Model、Tools profile）、catalog `failed` 的 Retry 都是 **secondary**，只有真正的主 CTA（页级 Open Connection 一类）保持 primary。MCP Update / Remove、Rules Edit / Delete、Memory Delete 在禁用时把原因写进 `title` 与 `aria-label`：未连或 pairing-hold 写 `Engine not connected`，已连但写入口未开写 `… cannot be changed right now.`，MCP 未选中服务器写 `Select a server first.`。可点时 title 回到动作名。只改提示与视觉层级，不改 `canPerformCatalogWrite` 门。

`catch → emptyList()` **禁止**。断连后 catalog 清 RPC 缓存并回 disconnected；不得标「已同步」。Navigator「断开前快照」不适用于本页。MCP Definitions leftover（pairing-hold KEEP / capability UNKNOWN / list-fail）保行并关行 toggle chrome（`canWrite()` disable + splice），无需重选。

## 3. @ HEAD 已落地

| 节 | 传输（`platform/universeAgent`） | Engine UI（`contrib/conversation/browser`） | 备注 |
|----|-----------------------------------|---------------------------------------------|------|
| **Skills** | 读：`ListSkills` · `SkillInfo` · `SetSkillEnabled`。写：`IUniverseAgentConnection.saveSkillContent?`（common 契约 @ `f3f2d366`；node gRPC `SaveSkillContent` @ `45fa7a35`/`040c823d`） | `EngineSkillsSection`：bundled/user/project 分组 + 启用开关（旁冻结句 `getSkillToggleFreezeNotice`）+ 选中 skill **textarea**（`getSkillInfo` 读正文）；USER/PROJECT 在 `saveSkillContent` 存在且 `supported` 时 **Save**（文字按钮）；BUNDLED 只读；断连/`UNSUPPORTED` 不渲染正文区。New 是幽灵图标，打开输入对话框要名称，空名称不创建 | list/toggle @ `8bfc299e`；**正文 UI** @ `f3f2d366`/`3e986bde`；**node 传输** @ `45fa7a35`/`040c823d`；**新建 UI** @ `e6167c45`/`9255e363` |
| **Agents** | `ListAgentProfiles` · `SaveAgentProfile` · `DeleteAgentProfile` · `ResetAgentProfile` | `EngineAgentsSection`：project/user/built_in 分组列表；`supported` 时写工具栏 New、Reset、Delete 是幽灵图标。New 打开输入对话框要名称，空名称不创建。选中 profile 有 **`AGENTS.md` textarea + Save**（`engineAgentAgentsMd.ts`，Save 仍是文字）。Model 子 tab 写 `model` / `modelType` / `maxTurns`（空 max turns = 引擎默认；0 与非整数不发出）。不是 Provider/Model 注册表选择器。内置档案只读。删除非内置档案前先警告确认 | list @ `4833c008`；写 RPC + 写入口 @ `7f10e65c` / `f49615a1`；**`AGENTS.md` 全文编辑器** @ `9419f583`/`3756d04e`（断连/`UNSUPPORTED` 不渲染）；Model 三字段走已有 Save/List |
| **MCP Servers** | `ListMcpServers` · `ToggleMcpServer` · `AddMcpServer` · `UpdateMcpServer` · `RemoveMcpServer` | `EngineMcpSection`：global/project 分组 + 启用 checkbox；`supported` 时 Add、Update、Remove 是幽灵图标。Add 与 Update 打开输入对话框。缺 name、transport，或 stdio 缺 command、sse / streamable_http 缺 url，不发 RPC。与选中项相同的 Update 不发 RPC。Remove 先确认再删除 | list + toggle @ `4833c008`；定义写 @ `7f10e65c` / `f49615a1` |
| **Tools** | `ListTools` · `SaveAgentProfile`（profile `tools.json`）。`ToolInfo` 已进 catalog；选中行 `getToolInfo` 只读详情 | `EngineToolsSection`：`ListTools` 目录 + profile 下拉（user/project，不含 built_in）+ 启用 checkbox + 只读详情；经 `engineToolProfile.ts` 写 `disabledTools` / `enabledTools` | list @ `4833c008`；profile 启用集 @ `7f10e65c` / `f49615a1` |
| **Overview** | 读 snapshot；`models=SUPPORTED` 时 `listModels()` 取已启用数（GC-6） | `EngineOverviewSection`：连接路径 / workDir / 能力八行显示快照三态（Supported / Unsupported / Unknown）/ Model 计数。不暴露 token / 地址 / ticket | E2 壳；Provider 行不画 |
| **Providers** | `listProviderStatus?` · 桌面 `listProviderPresetCatalog?` · `upsertProviderCredentials?` · `clearProviderCredentials?` | `EngineProvidersSection`：状态行显示品牌图标、协议与 base URL 摘要、配置药丸，以及只读启用外观（点击不发启用 RPC），下面是内置预设和云端目录。写方法存在时工具栏、状态行尾和预设行尾是幽灵图标：导入、添加、编辑、清除。添加和编辑打开输入对话框。云端刷新只在桌面出现。密钥只走主进程 gRPC | G-ENG-1 |
| **Models** | `ListModels` · 桌面 `upsertModel?` · `deleteModel?` · `setModelEnabled?` · 可选 `testModelProfile?` | `EngineModelsSection`：按 provider 分组。写方法存在时工具栏与行尾是幽灵图标：添加、编辑、启用或停用、删除；Test 另要 `testModelProfile`。添加和编辑打开输入对话框，level 之后是 Description、Cost、Speed。Manage Models… 打开此节 | P1b + 注册表写 |
| **Token Usage** | `getGlobalUsage?` 无参 | `EngineTokenUsageSection`：Input tokens、Output tokens、Thinking tokens、Cache read tokens、Cache write tokens、Request count、Total cost (micros)、Currency。micros 原样显示。无 24h/7d。Refresh 是幽灵图标。缺方法是 unsupported，不是零快照。`getSessionUsage` / `Agent.Usage` 不是这页 | 左栏不另计条数 |
| **MCP Runtime** | `GetMcpServerStatuses` · `GetMcpServerTools` | `EngineMcpRuntimePanel`（MCP 节 Runtime tab）。Refresh 是幽灵图标 | P1a；能力键 `mcpRuntime` |
| **Plugins** | `PluginService.List` / `Info` / `Enable` / `Reload` / `Unload` / `ScanNew` | `EnginePluginsSection`：列表 + Hooks 表（行数随引擎；无 marketplace）。Scan New、Reload、Unload 不变。选中项 status 为 `active` 时同一幽灵按钮是 Disable（`Codicon.debugPause`，aria “Disable {name}”），调用 `enablePlugin(id, false)`，成功文案 “Disabled.”。disabled、error 或 unknown 仍是 Enable，调用 `enablePlugin(id, true)`。pairing-hold KEEP leftover 关掉这些按钮（disable，不重选；D428） | P1a |
| **Rules** | `listProjectRules?` · 桌面 `upsertProjectRule?` / `deleteProjectRule?` | `EngineRulesSection`：Global(2) / Project(1)。写方法存在时 Add、Edit、行 Delete 是幽灵图标。网页不实现写方法 | G-ENG-2 |
| **Memory** | `listMemory?` · `searchMemory?` · `saveMemory?` · `deleteMemory?` | `EngineMemorySection`：scope 恒 `global`。列表 category `''`。搜索 query、keywords `[]`、limit 50。Add、Refresh、行 Delete 是幽灵图标。无 memory-enabled 开关。searchDeep / read / reflect / rebuild / revert / history 不在此页。有查询且没有 `searchMemory` 时清掉已显示的文件，状态是 “Search is unavailable.”，不另写错误行，也不写 “No memory.”。搜索成功且零条写 “No matching memory.”。列表为空仍是 “No memory.” | 缺 list 方法是 unsupported |
| **Hooks** | `listHookPoints?` | `EngineHooksSection`：只读点位列表；无定义写 | G-ENG-3 |

Agents 详情列宽至少 560px 时，档案列表约占列宽 34%（夹在 240–340px），与 Instructions / Tools / Model 和 `AGENTS.md` 并排，列表在列内滚动。更窄时编辑器叠在列表下，列表高度落在整行上（分组头与档案行统一 24px 单行，分组头含弱化组内条数计数），避免一行被切进页签。左栏导航行 22px；Agents 计数在档案列表到达后以弱化数字显示，不是实心徽标。Skills 计数在 `ListSkills` 到达后显示技能条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的技能行和同一计数。Tools 计数在 `ListTools` 到达后显示工具条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的工具行和同一计数。Models 计数在 `ListModels` 到达后显示模型条数（不含 provider 分组标题；禁用模型仍算在内）。Providers 计数在 `listProviderStatus` 到达后显示状态行数（禁用的 provider 仍算在内）。下一次列表到达后各自改成新的条数。真断连清掉目录后计数消失。pairing-hold 仍留着上次的行和同一计数。Rules 计数在 Global 与 Project 列表到达后显示规则条数（不含栏标题；禁用规则仍算在内）。Hooks 计数是 hook point 条数，不是各点的 installedCount。MCP Servers 计数是服务器条数，不含来源分组。Plugins 计数是插件条数，不是选中插件的 hook 行，也不把 hookCount 加总。Triggers、Clipboard、Context Variables 在该节打开且列表到达后显示条目条数（Context Variables 把 current 与 inherited 都算进去）。这些分区下一次列表到达后改成新的条数。真断连清掉目录后计数消失；Triggers、Clipboard、Context Variables 当时没打开也归零，且不为此再拉列表。pairing-hold 仍留着上次的行和同一计数。Overview 左栏不另计条数。取消删除不发 `DeleteAgentProfile`。选中档案只显示 `ListAgentProfiles` 已带回的 AGENTS.md（summary、usage、detailLevel、description、systemPrompt），不调用 `SaveAgentProfile`。点选不改写正文、工具或启用状态；Save 才写入。从正文去掉 summary、usage、detailLevel 或 description 后再保存，请求里这些字段是空值，刷新后的列表摘要和正文都不再写回被删掉的旧值。未闭合的 frontmatter 不按删除清字段。正文自己以 `---` 开头时，若档案上的 summary、usage、detailLevel、description 与这段正文里的同名字段不一致，编辑器仍把档案字段写成外层 frontmatter，内层正文原样保留；未改就保存不会把正文裁成第一段 `---` 之后，也不会用内层 summary 换掉档案摘要。这些字段已经和正文一致时，编辑器仍只显示这一份正文，不套第二层。Skills 分组头与技能行统一 24px 单行（分组头含弱化组内条数计数，左栏仍为全量条数）；未选中技能且没有残留正文时不画正文框，只留选择提示。正文已改脏时，点另一条技能或点来源分组行都留在当前技能上，不重载、不丢掉未保存正文；正文未改时点分组行会卸掉选中并回到选择提示。正文未改时点另一条技能，编辑区先卸掉上一条的正文并关掉 Save，直到这条的 SkillInfo 回来；不会把上一条的正文写到新技能上。同一条技能重新加载时仍留着已显示的正文。

桌面写入口只在 `canPerformCatalogWriteLive`（`ready` 或 `empty`、已连接、非 pairing-hold）且对应 connection 方法存在时出现。空列表也显示工具栏，以便添加第一条。网页 `UniverseAgentConnectionService` 不实现这些写方法，设置页因此不画表单。工具栏和行尾操作是幽灵图标钮（[UI 设计原则 §5.6](../../architecture/cross-cutting/ui-design-principles.md)）：图标 16px，命中区 22px，悬停用 `toolbar.hoverBackground`。名称在 tooltip 和 aria-label 上，行尾钮在悬停或焦点时出现，未出现时不接收点击。Providers 工具栏是 `desktop-download`（Import from local harnesses）和 `add`（Add provider），行尾是 `edit`、`clear-all`。Models 工具栏是 `add`（Add model），行尾是 `edit`、`circle-slash` 或 `check`、`trash`，有 `testModelProfile` 时再加 `beaker`。行尾 aria-label 带该行名称。添加和编辑走 `IDialogService.input`：Providers 依次是 provider id、protocol、base URL、API key（密码框）；Models 依次是 provider、model id、type、level、Description、Cost、Speed。level 留空仍发 0。Description、Cost、Speed 在编辑时留空会重发已存值（没有则 `''`），非空会去掉首尾空白；新建留空发 `''`。没有 temperature、maxTokens、topP、lanes 或 discovery。每个字段有可见名称。必填、level 或 transport 不齐时对话框留着并写出原因。Providers 里留空的协议、base URL 与 API key 保持当前值。删除、清除凭据、移除和导入确认是锚在那个按钮上的弹出层，按钮保留文字，不用系统原生对话框。对话框按钮也保留文字。设置页本身不放这些输入框。Skills 的 New、Agents 的 New / Reset / Delete、Rules 的 Add / Edit / Delete、Memory 的 Add / Refresh / 行 Delete、Token Usage 的 Refresh、MCP 定义的 Add / Update / Remove、Plugins 的 Scan New / Enable 或 Disable / Reload / Unload、Clipboard 的 Write / Read / Clear、Context Variables 的 Read、MCP Runtime 的 Refresh 也是这套幽灵图标。Skills 与 Agents 的 New 打开带名称标签的输入对话框，空名称留在对话框里，不创建。MCP 的 Add 与 Update 打开同一个输入对话框，依次是 name、transport（`stdio`、`sse` 或 `streamable_http`）、command、url、Arguments（一行一个）、Environment（一行 `KEY=VALUE`）。`stdio` 要 command，另两种要 url；不齐不发 RPC。编辑时 args 与 env 留空保留选中值；新建留空则省略这些键，也不设 enabled。没有 `=` 或 key 为空时，对话框写 “Environment lines must be KEY=VALUE.”，不发 RPC。只改 args 会发送。stdio 编辑只改 URL 仍忽略。字段没有变化不调用 update。`isCompleteMcpAddConfig` 不变。无参 `addServer()` 仍不发 RPC。没有 enabled 文本框。Remove 先确认再删除。正文 Save、Agents 页签、Tools 的 Save、目录 Retry 和断连条上的按钮保留文字。Triggers 的 Add 与 Edit 只在既有 upsert 门通过后打开对话框。字段是 Name、Type（都必填）、Prompt、Interval (ms)、Cron、Target、Enabled。scope 与 scopeId 保持 `''`。名称或类型为空不发 RPC。Add 发 triggerId `''`，空 prompt 与 cron 为 `''`，空 interval 为 0，空 target 为 `{ kind: 'unspecified' }`，pauseReason `''`，runAtEpochMs 为 0。Edit 留空则保留选中项的 prompt、interval、cron、target、pauseReason 和 runAtEpochMs。Target 文本只接受 `self`、`bound:<sessionId>`、`new:<profileId>`；其他非空不发 RPC。没有选中项的 Edit 不发。Enabled 取 checkboxChecked，缺了则 false。Fire、Enable、Disable 和 Delete 不变。Rules 的添加和编辑打开输入对话框：Title 必填，Body，Priority（0–3 的整数；编辑留空保留当前优先级，新建留空发 0），Enabled 复选框（新建默认勾选；没有复选框结果则发 false）。编辑保留 id、globs、appliesTo 和 scope。Global 是 2，Project 是 1，sessionId 是 `''`。请求不带 work_dir 或 agent_home。删除先确认。网页不实现 `upsertProjectRule` / `deleteProjectRule`。Memory 的保存对话框要 content，category 可空。删除先确认。Clipboard 的 Write 打开对话框要 Label 和 Content。Content 为空不发 RPC。Label 可空，发 `''`。请求仍只 TEXT：sessionId `''`、agentId `''`、type CLIPBOARD_TEXT、filePath `''`、url `''`。Read 和 Clear 仍立即执行。

Providers 保存调用 `UpsertProviderCredentials`（`providerId`、`apiKey`、`baseUrl`、`protocol`）。`apiKey` 空白表示保留已有密钥。编辑把 provider id 改成新值时，先写入新 id，再对旧 id 调用 `ClearProviderCredentials`。协议、base URL、API key 留空仍表示保留当前值。密钥只出现在输入对话框里，不回写到设置页。`ProviderStatus` 不包含密钥。清除调用 `ClearProviderCredentials`；宿主环境变量保持原样。`PROVIDER_ENV` / `BUILTIN_ENV` 只说明宿主环境仍可能供钥，upsert 写入引擎凭据库，不改进程环境。成功写入后，引擎把该 provider 视为已配置来源。

状态行下面还有两份目录，不计入左栏 Providers 计数。内置预设与 Singularity `PROVIDER_PRESET_OVERLAYS` 同一批 id 和端点：openai、anthropic、gemini、openrouter、deepseek、zhipu、qwen、deepseek-anthropic，按这份声明顺序，不含空白 Custom 行。自定义仍走工具栏 Add。桌面 `listProviderPresetCatalog?` 在主进程拉取 `https://models.dev/api.json`，内存缓存约一天，不是引擎 RPC，也不带密钥。与内置 id 相同的条目用目录里的名称、URL 和最多五个未弃用模型覆盖预设，协议仍用内置值。其余有 API URL 或 env 的条目按名称排成云端列表。选一条打开添加对话框，预填 id、protocol 和 base URL，不自动写入模型注册表。已配置状态行的编辑仍是「Edit provider」，base URL 留空，因为状态里没有 URL。拉取失败时内置列表仍在，云端状态写明不可用；已有缓存则继续用这份缓存。Refresh 先清缓存再拉。网页没有这个方法，云端行写明目录在桌面加载。筛选框只过滤这两份列表。查询去掉首尾空白后仍非空，且内置与云端过滤后都是零行时，筛选框下写 “No matching providers.”。任一侧还有行、查询为空白，或云端仍在 “Reading the cloud catalog…” 时不写这句。云端状态（桌面才加载、不可用、正在读取）仍留在云端状态行，不换成这句。不另发 RPC。

Import from local harnesses 在主进程读取本机配置。确认框只列名称和来源。用户确认的 `providerId` 会再读一次再 upsert；空的 `providerIds` 表示什么都不导入。`~/.cc-switch/cc-switch.db` 的 `providers`（`id`、`app_type`、`name`、`settings_config`）在库存在时是全量目录，只读打开。库里已经出现的 app 不再读该 app 的现行文件。没有库记录的 app 才回退：`~/.claude/settings.json`、`~/.codex/config.toml` 与 `auth.json`、`~/.gemini/.env`、`~/.grok/config.toml`、`~/.config/opencode/opencode.json`、`~/.openclaw/openclaw.json`、`~/.hermes/config.yaml`、`~/.pi/agent/models.json`。跳过 `codex_oauth_auth.json`、`copilot_auth.json`、`xai_oauth_auth.json`，以及既无密钥也无 base URL 的行。稳定 id 重复导入算更新。结果报告 imported / updated / skipped / modelWrites，错误文本去掉本次发送的密钥。模型写在已钉引擎尚未提供 `UpsertModel` 时记入错误，provider 导入仍算成功。

Models 保存调用 `UpsertModel`。新行 id 为 `provider:modelId`。编辑时 provider 与 model id 都没变则沿用原 id；任一变了就用 `provider:modelId` 写入，再删除旧 id。level 留空发 0，表示沿用已有等级或由引擎默认。Description、Cost、Speed 的留空规则见上面的对话框。保存失败和校验用错误色。Enable / Disable 走 `SetModelEnabled`。Delete 先确认，再走 `DeleteModel`。Test 走已有 `TestModelProfile`，带该行的 provider 与 model id，api key 与 base URL 为空，让引擎使用已存凭据。会话选用仍是 Composer 的 `SwitchModel` / `modelProfileId`。Agent profile 的 `model` / `modelType` / `maxTurns` 仍在 Agents 的 Model 子 tab，字段名是档案默认，不是当前会话的模型。Tools 的勾选写的是这个档案的启用集。MCP 与 Agents 标出当前工作根。Skills 与 Rules 说明项目项跟着打开的工作根。Clipboard 与 Context Variables 是引擎范围，请求里的 session id 仍是空的。不另开 Session 设置页。

Agents 详情列宽至少 560px 时，档案列表约占列宽 34%（夹在 240–340px），与 Instructions / Tools / Model 和 `AGENTS.md` 并排，列表在列内滚动。更窄时编辑器叠在列表下，列表高度落在整行上（分组与无摘要 28px，有摘要 44px），避免一行被切进页签。左栏导航行 22px；Agents 计数在档案列表到达后以弱化数字显示，不是实心徽标。Skills 计数在 `ListSkills` 到达后显示技能条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的技能行和同一计数。Tools 计数在 `ListTools` 到达后显示工具条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的工具行和同一计数。Models 计数在 `ListModels` 到达后显示模型条数（不含 provider 分组标题；禁用模型仍算在内）。Providers 计数在 `listProviderStatus` 到达后显示状态行数（禁用的 provider 仍算在内）。下一次列表到达后各自改成新的条数。真断连清掉目录后计数消失。pairing-hold 仍留着上次的行和同一计数。Rules 计数在 Global 与 Project 列表到达后显示规则条数（不含栏标题；禁用规则仍算在内）。Hooks 计数是 hook point 条数，不是各点的 installedCount。MCP Servers 计数是服务器条数，不含来源分组。Plugins 计数是插件条数，不是选中插件的 hook 行，也不把 hookCount 加总。Triggers、Clipboard、Context Variables 在该节打开且列表到达后显示条目条数（Context Variables 把 current 与 inherited 都算进去）。Memory 在列表或搜索到达后显示文件条数（不含分类标题）。有查询且没有 `searchMemory` 时不把未过滤列表当成命中，也不写 “No memory.”，状态是 “Search is unavailable.”，导航计数消失，直到清空查询后 `listMemory` 再跑。搜索零条写 “No matching memory.”，不是 “No memory.”，导航计数同样消失，直到下一次列表。列表为空仍是 “No memory.”。Token Usage 左栏不另计条数。这些分区下一次列表到达后改成新的条数。真断连清掉目录后计数消失；Triggers、Clipboard、Context Variables 当时没打开也归零，且不为此再拉列表。pairing-hold 仍留着上次的行和同一计数。Overview 左栏不另计条数。取消删除不发 `DeleteAgentProfile`。选中档案只显示 `ListAgentProfiles` 已带回的 AGENTS.md（summary、usage、detailLevel、description、systemPrompt），不调用 `SaveAgentProfile`。点选不改写正文、工具或启用状态；Save 才写入。从正文去掉 summary、usage、detailLevel 或 description 后再保存，请求里这些字段是空值，刷新后的列表摘要和正文都不再写回被删掉的旧值。未闭合的 frontmatter 不按删除清字段。正文自己以 `---` 开头时，若档案上的 summary、usage、detailLevel、description 与这段正文里的同名字段不一致，编辑器仍把档案字段写成外层 frontmatter，内层正文原样保留；未改就保存不会把正文裁成第一段 `---` 之后，也不会用内层 summary 换掉档案摘要。这些字段已经和正文一致时，编辑器仍只显示这一份正文，不套第二层。Skills 分组与无描述行 28px、有描述 44px；未选中技能且没有残留正文时不画正文框，只留选择提示。正文已改脏时，点另一条技能或点来源分组行都留在当前技能上，不重载、不丢掉未保存正文；正文未改时点分组行会卸掉选中并回到选择提示。正文未改时点另一条技能，编辑区先卸掉上一条的正文并关掉 Save，直到这条的 SkillInfo 回来；不会把上一条的正文写到新技能上。同一条技能重新加载时仍留着已显示的正文。

单测：`engineCatalogSections.test.ts` · `enginePreferencesPane.test.ts` · `engineAgentAgentsMd.test.ts` · `engineAgentModel.test.ts` · `engineSkillsSection.test.ts` · `engineToolProfile.test.ts`（能力三态、断连路径、Skills 正文 Save 形状、AGENTS.md 保存与写 RPC 形状、Model 三字段、左栏导航）。

单测：`engineCatalogSections.test.ts` · `engineOverviewSection.test.ts` · `enginePreferencesPane.test.ts` · `engineSkillsSection.test.ts` · `engineAgentAgentsMd.test.ts` · `engineAgentModel.test.ts` · `engineToolProfile.test.ts`。

## 4. 仍未落地（本文不得写「已接」）

| 操作 | RPC / 面 | 状态 |
|------|----------|------|
| Provider 凭据 / 本地导入 / 预设目录 | 桌面 Upsert/Clear、harness 导入、内置预设与 models.dev 云端目录已进 UI | 密钥不回显、不进 `settings.json`。云端目录不是引擎 RPC。网页无写方法，也无云端列表 |
| Singularity 其余引擎设置 | Model groups、Prompts / input templates、Environment variables、Galaxy、Gateway、Engine storage、skill store、provider 启用开关、provider 连接测试、model discovery、openai-responses chips、hook 定义写、新的 `ua.client.*` | Engine 页没有这些节，不画空页。设备配对在 Connection 的 Devices。Provider 内置预设与 models.dev 云端目录已在 Providers。密钥不进 `settings.json`，也不进渲染进程 |
| Agent profile 模型目录选择器 | Model 子 tab 只写 profile 的 `model` / `modelType` / `maxTurns` | 注册表仍在 Models；不升 PRD-025 |
| Rules 写的网页实现 | 桌面 `upsertProjectRule?` / `deleteProjectRule?` 已进 node | 网页 `UniverseAgentConnectionService` 不实现。不扫 Copilot / AgentHome。请求不带 `work_dir` / `agent_home` |
| Hooks 定义写 | 无 RPC | 点位只读列表已接；不把定义写标成已接 |
| Memory 其余 RPC | searchDeep / read / reflect / rebuild / revert / history | 不在 Memory 页。`getSessionUsage` / `Agent.Usage` 也不是 Token Usage 页 |
| Composer 下拉 | AgentProfile / Model / Permission / Tools | Composer 已拉 catalog 填表（`loadConnectedComposerCatalogs`）。进 `submitInput` 的只有 Model（`modelProfileId`）；Agent 下拉只读且选择即回滚，Tools 只读；Permission 走 `setPermissionMode`，Model 变更可走 `switchModel?`。Route 省略 |
| Plugins marketplace | — | 不做 |
| 产品验证 / 隔离 profile 冒烟 | PRD-025 § / PRD-008 | 未做；不升 `implemented` |
| Agent profile `model.json` 文件编辑器 | 不单独编辑磁盘文件 | 三字段经 Model 子 tab 的 `SaveAgentProfile`；空 max turns 省略（引擎默认） |
| 完整插件市场 | — | Plugins 只接 Engine `PluginService`，无 marketplace |
| Composer 选择进发送载荷 | `submitInput` / `SwitchModel` | Agent / Tools / Model **只读填表**（`conversationComposerCatalog.ts`）。Model 选中 catalog id 进 `submitInput.modelProfileId`（Chat `SessionInput.model_profile_id`；诚实空不带）。下拉变更可走已有 `switchModel?`。Agent / Tools 选择不进发送载荷。Permission 接通后走 `setPermissionMode`。Route 省略（无引擎 `routeIndex`） |

## 5. 十五节与差距（代码已落后仍缺的协议）

| 节 | HEAD UI | 仍缺 |
|----|---------|------|
| Overview | 已有；GC-6 Model 计数；Provider 行已隐藏 | 产品验证 |
| Providers | 桌面凭据写、本地导入、内置预设与 models.dev 云端目录。启用状态只读，用可见的 Enabled / Disabled 文字，不画开关 | 不发启用 RPC，无连接测试。云端目录不依赖引擎重编译。钉死引擎未重新编译时，模型注册表写仍不在已钉进程上；产品验证未做 |
| Models | 桌面注册表写与 Test；对话框含 Description、Cost、Speed | 无 discovery、temperature、maxTokens、topP、lanes。`UpsertModel` / `DeleteModel` / `SetModelEnabled` 要引擎重新编译后才在已钉进程上存在。会话选用在 Composer |
| Token Usage | `getGlobalUsage()` 无参；八项原样显示；Refresh 是幽灵图标 | 无 24h/7d。`getSessionUsage` / `Agent.Usage` 不是这页 |
| Skills / Agents / Tools | 已有 list/toggle/写；Agents Model 子 tab 写三字段 | Composer 下拉；不是模型注册表选择器。无 skill store |
| Rules | 桌面 Upsert/Delete；网页不实现 | 不扫 Copilot / AgentHome。请求不带 `work_dir` / `agent_home` |
| Memory | scope 恒 `global` 的列出、搜索、保存、删除 | 无 memory-enabled 开关。searchDeep / read / reflect / rebuild / revert / history 不在此页 |
| Hooks | 只读点位 | G-ENG-3 Definitions / 写 |
| Triggers | Add/Edit 在 upsert 门通过后打开对话框 | 非 `self` / `bound:` / `new:` 的 Target 不发 RPC。Fire 被拒仍画 neutral |
| Clipboard | Write 要 Label 和 Content；Read / Clear 立即 | 仍只 TEXT。空 Content 不发 |
| Context Variables | 打开才拉；Read 是幽灵图标 | 请求里的 session id 仍是空的 |
| MCP Servers | Definitions + Runtime；对话框含 args 与 env | 无 enabled 文本框。无参 `addServer()` 不发 RPC |
| Plugins | list + 启停/重载/扫描；`active` 时按钮为 Disable | marketplace（明确不做） |

| M7 节 | HEAD | 数据姿态 |
|-------|------|----------|
| Overview | 壳已挂 | 聚合连接路径、workDir、capability；Model 摘要仅在 `models=SUPPORTED`；不暴露 secret |
| Providers | 桌面写、导入与预设目录已挂 | `listProviderStatus?` 加 Upsert/Clear；内置预设在本地，云端目录走桌面 `listProviderPresetCatalog?`；不跳 Copilot Models。Enabled / Disabled 是可见的只读文字，不画开关、不发启用 RPC；无连接测试 |
| Models | 桌面注册表写已挂；对话框含 Description、Cost、Speed | `ListModels` 加 Upsert/Delete/SetModelEnabled；不跳 Copilot Models。无 discovery |
| Token Usage | 无参 `getGlobalUsage?` | 缺方法是 unsupported，不是零快照。不是会话用量 |
| Skills | 已有 | 两栏宿主，保留 list/toggle/body/New。无 skill store |
| Agents | 已有 | Instructions / Tools / Model。Model 写 `model` / `modelType` / `maxTurns`；内置与断连只读。不升 PRD-025 |
| Rules | 桌面写已挂 | 网页不实现 Upsert/Delete；不扫 Copilot rules |
| Memory | List / Search / Save / Delete | scope 恒 `global`。其余 Memory RPC 不在此页 |
| Hooks | 只读点位 | Definitions 无 RPC；点位表不抄静态点位 |
| Triggers | 列表动作已挂 | Add/Edit 字段见 §3。scope 与 scopeId 保持空串 |
| Clipboard | Write / Read / Clear 已挂 | Write 才开对话框。请求仍只 TEXT |
| Context Variables | List / Read 已挂 | 不另开 Session 设置页 |
| MCP Servers | Definitions + Runtime tab | Runtime 走 `mcpRuntime`，不混 vscode `IMcpService`。args / env 见 §3 |
| Plugins | probe + 列表已挂 | `active` 走 `enablePlugin(id, false)`。Engine `PluginService`，无 marketplace |
| Tools | 已有 | 保留 profile enablement，分开 client-tool 运行态 |

**断连语义（与 Navigator 不同）：** Engine catalog 断连即清 RPC 缓存、各节回 disconnected；Navigator 段保留「断开前快照」是会话面合同。

UI 可先交付 unsupported/failed，不等待全部 RPC；没有真实数据与产品验证证据时仍不得升 `implemented`。

## 6. 与 Composer 下拉

`Permission` 接通后走 `setPermissionMode`。接通且能力 `SUPPORTED` 时，Agent / Tools / Model **只读填 catalog**（`listAgentProfiles` / `listTools` / `listModels`）。Model 选中 id 进 `submitInput.modelProfileId`；下拉变更可走 `switchModel?`。Agent / Tools 选择不进发送载荷。Route **不画**（无引擎 `routeIndex`）。Engine 页写路径仍是 catalog 权威。

## 相关

- [engine-protocol-surface](../../reference/universe-agent/engine-protocol-surface.md) · [customizations-engine](../../../dev/plans/customizations-engine.md) · [stub-and-fixtures §6](../conversation/stub-and-fixtures.md)（诚实降级）
