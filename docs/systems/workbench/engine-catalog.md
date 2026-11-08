---
title: "Engine 页 Customizations catalog（ua.engine）"
type: reference
status: accepted
phase: N/A
updated: 2026-11-06
summary: "左栏 15 节。桌面 Providers 可写凭据并导入，并列出内置预设与 models.dev 云端目录；筛选两边都空时写 No matching providers.，云目录还在读时不写；Models 可增删改与测试，对话框在 level 后有 Description、Cost、Speed；Token Usage 无参读全局用量；Memory 只做 global 的列出、搜索、保存和删除，无 searchMemory 的查询不把旧列表当命中，零条搜索不是空库；Rules 桌面可增删改，网页不实现；Hooks 仍只读；产品验证未做"
---

# Engine 页 Customizations catalog（`ua.engine`）

> 宿主与 TOC 见 [Settings UA 接入](../../reference/code-oss-b2/settings-ua-access.md)。权威表与协议缺口见 [customizations-engine](../../../dev/plans/customizations-engine.md)。传输 RPC 登记见 [engine-protocol-surface §1/§7](../../reference/universe-agent/engine-protocol-surface.md)。

`EnginePreferencesPane` 是 Preferences 子 pane（`ua.engine`），左栏 `WorkbenchList`、右栏一次一节。Providers（凭据状态）与 Models（注册表）分节。本节记 **@ HEAD 代码事实**（E2-1–E2-7 @ `482b611a` 一带；**GC-6** Overview Model 摘要 @ `f583073b` / `d98d888a`）。桌面 Provider 凭据写与 Models 注册表写已接通。Rules 的 Upsert/Delete 已进桌面 connection，网页不实现。**不得**把 Hooks 定义写或 Composer 下拉写成已接通；§8.3 产品验收与 PRD-008 隔离 profile 冒烟仍待。

[PRD-025](../../product/requirements.md#prd-025-engine-设置完整性) / [engine-preferences-completion](../../../dev/plans/engine-preferences-completion.md)（`accepted`）的 **代码完成线已落**；产品验证未做，PRD **不**升 `implemented`。下文表是当前代码，不是「待实施目标」。

列表刷新用代次。新一次刷新开始，或视图已经销毁，晚到的列表不画进当前页。写操作另记下当时已发布的引擎身份和 link id：Models/Skills/Memory 的既有 strict owner 要求非空身份，19 个 catalog mutation 使用下述 published-link 合同，link id 均为大于 0 的安全整数。回来时代次变了、视图已销毁，或身份 / link id 对不上，这次写的成功或失败文案不落到当前页。Connection 页按 profile 的 Test Connection 只在视图已销毁、又开始了一次测试或活动 profile 已换时丢掉结果，不看当前连接的身份 / link id。没有 profile 的测试（Connection 页无选中、Engine 页 Test）测的就是当前连接，另外要求已发布身份 / link id 未变。被丢掉的结果只清掉自己那次的「Testing…」，不另留提示；更新的一次测试正在进行时，旧结果不清它的「Testing…」。`pairing_required` 画 neutral 的本地化引导，不显示引擎原文 reason。

Engine Preferences 子页（`EnginePreferencesPane`）承载 Customizations 产品主面。本节记 **@ HEAD 两栏壳**：四节 list/toggle/写（Skills / Agents / MCP Definitions / Tools）、Overview 摘要、Providers 桌面凭据写、本地导入、内置预设与 models.dev 云端目录、Models 桌面注册表写、Token Usage、Memory、Rules 桌面写、MCP Runtime tab、Plugins probe/列表。**不得**把 Hooks **定义写**写成已接通（[G-ENG-3](../../reference/universe-agent/engine-protocol-surface.md) 仍是只读点位）。[G-ENG-2](../../reference/universe-agent/engine-protocol-surface.md) 的 Upsert/Delete 已进桌面，网页不实现。searchDeep / read / reflect / rebuild / revert / history 不在 Memory 页。产品验收与 PRD-008 隔离 profile 冒烟仍待。

**M7 代码完成线（产品验证未做）：** [PRD-025](../../product/requirements.md#prd-025-engine-设置完整性) E2-1–E2-7 九节六态已挂。HEAD 左栏是 15 节。实施方案见 [engine-preferences-completion](../../../dev/plans/engine-preferences-completion.md)（`accepted`）。本页以下 `@ HEAD` 表只陈述当前代码。没有用户可观察证据不得升 `implemented`。

### Tools 呈现、草稿与写入生命周期

Tools 固定 24px 行使用稳定 identity 和有效局部 splice 刷新，完整 profiles/active profile/pending/mode/count 先提交再一次呈现。首次异步创建列表重放已分配布局；纯重绘保留选择、列表/checkbox DOM 焦点与滚动，不重复选择副作用、ToolInfo RPC 或模板监听。loading、failed、pairing 与断连状态先更新，再呈现行启用态；真正断连清目录，同 scope 普通刷新不能冒充断连吞掉草稿。

同 engine/link、workroot/source 普通刷新保留并按新 baseline 重基各 profile 未提交覆盖（含 submitted 与 late edit），A→B→A 留各自草稿。Save 以返回 profile 为 baseline，仅比较清除提交值仍相同的覆盖，晚编辑保留；失败、无效结果或目标失效不把旧结果画入新目标。保存作废更旧 List，并在原 context 合法时退出 loading。

Save 与 immediate toggle 共享当前面板内 `[stable engine identity, profile id]` 在途预约；SaveAgentProfile 不含 projectPath，workroot/source/link 不能成为绕过同后端预约的命名空间。同 profile 任一方无 identity 保守互斥；不同明确 engine identity 可并行。切选/清稿/刷新/隐藏不释放未结 RPC，实际终态仅身份匹配才退休自身预约。旧结果需 engine/link/workroot/source、目标及 dispose 授权；退休后仅可按当前 reservation 派生 Save 控件，不能带入旧结果、错误或草稿。不宣称跨窗口 CAS。

ToolInfo success 与 catch 同时校验捕获 engine/link/workroot/source、详情 generation、当前选择和 dispose。scope 实变推进 generation，避免往返后同名旧详情复活；同 scope 普通刷新允许合法在途详情，沿用 pairing/disconnect leftover 合同。

此为已通过组件自动层及独立 OV 的代码合同；真实默认窗口和真实引擎 Save 后持久化回读仍待，D1395 保持 open，不升产品 PRD。实施及证据见 [Tools 方案](../../../dev/plans/tools-display-lifecycle.md)。

### Profile 内容有效性与原始正文

D1398 A1源码与同主题文档已在当前 merge HEAD 本地合入（`cca88013437`，基线 `41f2001e0fc`），merge `compile-client` 与 `valid-layers-check` 均 0 错误；这仍不是默认窗口/钉死引擎真实产品签收。全局 push hold 仍在，当前阶段见[本波证据](../../../dev/progress/tools-wiki-wave-2026-11-02-evidence.md)。New使用标准Dialog收集Name与必填多行Instructions，仅Name trim；text opt-in多行复用标准输入/焦点/验证，password仍单行。多行Enter/ShiftEnter留换行，单行Enter沿原提交；有限高度保窄窗按钮可达。真实IME、额外主题和窄窗手测须按实际另列，不因DOM测试通过而称全面UI验收。

`systemPrompt`是最终profile的raw Instructions权威。共同纯内容门要求string，在临时值上先仅去尾<=U+0020，再按PIN Kotlin兼容空白判非空；不改原串、不用JS trim、不解析raw body的frontmatter。metadata伪body不能替代Instructions。Agents创建/Markdown/Model/Tools派生与独立Tools Save/toggle都在最终组装后复用此门，无效时0写且保dirty/pending/选择，不创建或释放保存预约，不用旧prompt回填清空意图，外层不覆盖Instructions原因或取消文案。

AGENTS展示始终有独立、可解析的产品outer，metadata为空也保空outer；Save只拆一层，不按字段相等或递归猜层。删除outer字段按既有空值语义发送，删全仍保空outer；去整头剩普通body清metadata，未闭合头保全文/旧metadata。raw body本身像frontmatter合法，但编辑时保产品outer，不能将“只有产品outer而没有body”的空正文误当合法Instructions。

加载时把原DTO rawbody与格式化赋给真实控件后读回的完整display baseline成对保存，绑定原profile/owner/编辑context；dirty与测试编辑setter只比较既有display baseline，setter不建立/更新pair。Save开始仅整份DOM===display baseline且原context有效才用配对rawbody，仍须最终内容校验；编辑后完整还原baseline也适用。edited/New按控件实际value，允许CRLF/CR→LF但不额外trim或递归解析raw。clear/换目标/owner失效及dispose退休pair/代次，旧RPC success/catch/self-refresh/accepted reload不能借owner往返复活旧raw；正常同context合法reload才可更新pair。PIN读回自身trim，不能承诺首尾空白字节保留。

node saveAgentProfile先沿既有owner门固定原transport，再复制/校验最终profile快照并原样发送同一快照，caller随后改body/数组不能改变已验内容。stale owner优先Cancellation；current owner无效内容在调用前拒绝且不改变连接健康/重连。UI/main门不改变引擎DTO/protobuf，也不修复PIN的多文件事务或外部直接gRPC调用；不自动修删不可加载目录。D1395有效own2 Save来源未定仍独立open。

### Catalog mutation 的跨进程归属

Profile Save/Delete/Reset、Rules Upsert/Delete、MCP Add/Update/Remove/Toggle、Plugins Enable/Reload/Unload/Scan、Triggers Upsert/Delete/Enable/Fire、Clipboard Write/Clear 共 19 个 IDE 方法必须携带独立 `UniverseAgentPublishedLinkOwner` 参数。owner 不进入引擎业务 DTO/protobuf；准确方法名与参数位置见[19 入口合同表](../../../dev/plans/engine-catalog-mutation-ownership.md#2-精确19方法与独立参数位置)。`enablePlugin` 保留 enabled 的 false/undefined 参数位，`scanNewPlugins` 仅传 owner，不添加业务占位参数。

Published-link owner 的 link 为正 safe integer；identity 可省略或为 own data property undefined，与当前 published identity 严格比较，不是通配。额外字段、symbol、accessor、继承字段或非法 link 不可接受。SessionDelete 旧 type/is/assert 入口作为同一实现的兼容 alias；Models/Skills/Memory 原 strict 非空身份与各自 trusted 调用语义保持，不能用新合同放宽。

ChannelClient 只原样转发意图，不能从新 cache 填 owner。主 IPC 在 inner dispatch 与业务 revive 前拒 missing/畸形/失配；node 复制已验标量并捕获原 transport，在调用前及 success/catch 后重核，不会转当前 B 续写。调用者后来修改 owner 对象不能改变已捕获归属；旧 link 晚 success、业务错误或 UNAVAILABLE 不改新 link 健康、能力或重连。19 项无省略 owner 的生产 trusted 兼容分支。

Agents、Tools、MCP、Plugins、Rules、Triggers、Clipboard 七节在意图开始、输入或确认之前捕获 owner 和目标，所有派生入口与 await 后续体保留该意图，并核原选择、操作代次和 dispose。Agents 的 Markdown/Model/Tools 派生保存不能把取消覆盖成后端失败；Tools 原草稿、预约与结果门继续有效。MCP 同捕 server id、origin/scope 和 project workDir，确认后不能取新目录/目标；同 id 不同 origin 的晚回不更新新页。Triggers 的晚 Fire/Delete 与后续刷新不覆盖新选择；Clipboard 对话框 helper 返回后的外层续体也核原 owner、action/render 代次与 dispose。未确认或归属取消不报告后端写失败。

Profile 内容完整性另有[D1398/P1](../../../dev/progress/deferred-gaps.md)：现有 custom profile 的空正文/空白/仅frontmatter保存可使 PIN 先写后 reload 失败，New 又缺非空指令；本轮A已落实内容门及表示修复并通过自动层，且已在 merge 本地合入并通过 compile-client/valid-layers-check；真实窗口/钉死引擎门仍待，不以 owner 门或IDE内容门代 PIN 多文件事务。当前没有实际复现用户资料损坏，不据此归因真实 Save 的来源未定问题。

前 13 个入口为可写路径的 P1 归属缺口；Triggers/Clipboard 六项仅同结构防漏，当前钉死引擎的空业务 scope/session 会先拒绝，保持原业务字段，不为验收填新 session。Config/Permission/raw 域未纳本批，不能据此声称安全；Context/Hooks/Token Usage/Overview catalog 为只读。本批19owner代码及自动层已获独立最终CommitGate PASS，D1397仅本地专题closed；准确范围与运行签收见[D1397 与本波证据](../../../dev/progress/tools-wiki-wave-2026-11-02-evidence.md)，真实窗口 Save 失败的 D1395 独立保持 open。
## 设置页视觉与滚动

2026-11-02 用户参考图适配：浅灰导航240px、导航行32px；内容居中且最大760px，页面标题在白底弱描边分组外。专用 `engineEditorSettings.css` 只覆盖 Skills/Agents/MCP，`engineCatalogSettings.css` 只覆盖目录页。名称与12px说明分层；目录有说明44px、无说明32px、分组28px。Agents master维持24px，MCP Runtime维持52px；列表用真实内容盒计算预算，窄短屏编辑区自然堆叠且保存可达。Skills/MCP Definitions使用右侧32×20开关；Provider enabled仍是只读状态。

Providers凭据与预设分组、Models去重复ID、Rules/Hooks窄列堆叠、技术字段分区展示，均保留原始字段、空值、零值、完整ARIA说明与操作门控。Client原生设置列表只适配表面视觉，不改变虚拟行几何。Connection视觉与宿主边界见[Settings接入](../../reference/code-oss-b2/settings-ua-access.md)。[组件证据](../../../dev/progress/preferences-visual-alignment-evidence/verification.md)包含受控目录渲染，尚无真实引擎默认窗口验收。

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

代码里左栏实为 15 节（`ENGINE_PREFERENCES_NAV_ENTRIES`）：overview、providers、models、tokenUsage、skills、agents、rules、memory、hooks、triggers、clipboard、contextVariables、mcpServers、plugins、tools。Token Usage（“Token Usage”）在 Models 之后，Memory（“Memory”）在 Rules 之后。Triggers、Clipboard、Context Variables 在已连接且非 pairing-hold、列表能力为 `UNKNOWN`（缺字段归一成 `UNKNOWN`）时不发 list，画 `loading` / `loadingKind: 'capability'`（Confirming engine capability…）。无上次成功行则清展示，不画空成功；已有行留下且不再发 list。`UNSUPPORTED`，或 `SUPPORTED` 但 hook 不是函数，仍画 unsupported，不发。pairing-hold 与断连仍先走原路径。Token Usage 与 Memory 没有能力键，方法缺失即为 unsupported。FireTrigger 的 `status` 按引擎 `TriggerGrpcService.fireTrigger` 实际返回的四个值定色：`queued`、`executed` 为 success，`rejected` 与空 status 为 error，`skipped` 和其他值为 neutral（不区分大小写）。结果行只拼非空的 status、eventId、reason，三者都空时显示 “The engine returned no fire status.”。

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

`engineCatalog.ts` 的 `EngineCatalogPaneMode`：`disconnected` \| `unsupported` \| `loading` \| `failed` \| `empty` \| `ready`。判定自上而下、命中即止（`resolveEngineCatalogPaneMode`）。E2-1 **废止** disconnected 整节隐藏：各节在左栏始终可达；「无 Engine」= 右栏零条目、零写按钮，不是把导航藏掉。断连 CTA **只在页级 banner**：Test Engine 次要 + Open Connection 主要；catalog 节 body **只出文案**（不再各节再画 Open Connection）；Agents的断连与KEEP残留body同样遵守此规则，连接入口仍由EnginePreferencesPane页级banner提供；页脚 Test Engine **仅已连接**时出现。状态字停在可见的那颗 Test 旁边。

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

Provider 状态行按内容预算排布：身份（图标、名称与说明）、主状态（Configured / Not configured 与 Enabled / Disabled）、凭据来源、行尾动作依序呈现。宽时仍为 24px；窄宽时中间内容按 24px 轨换行，配置、启用与来源完整显示；本地化或大字令单组超宽时也可折行，不设固定高度。仅名称与说明可省略，名称及来源继续使用托管 hover。两颗行尾动作保留现有 22×22 命中区并始终预留空间，悬停/焦点只改变显隐，不重排。此例外仅限 Provider 状态行，预设目录与其他目录行不变；依据 [PRD-028 验收 3](../../product/requirements.md#prd-028-视觉语言与信息密度)，方案/运行与独立after证据见 [D1381 局部布局](../../../dev/plans/provider-status-row-layout.md)。

Agents 详情列宽至少 560px 时，档案列表约占列宽 34%（夹在 240–340px），与 Instructions / Tools / Model 和 `AGENTS.md` 并排，列表在列内滚动。更窄时编辑器叠在列表下，列表高度落在整行上（分组头与档案行统一 24px 单行，分组头含弱化组内条数计数），避免一行被切进页签。左栏导航行 22px；Agents 计数在档案列表到达后以弱化数字显示，不是实心徽标。Skills 计数在 `ListSkills` 到达后显示技能条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的技能行和同一计数。Tools 计数在 `ListTools` 到达后显示工具条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的工具行和同一计数。Models 计数在 `ListModels` 到达后显示模型条数（不含 provider 分组标题；禁用模型仍算在内）。Providers 计数在 `listProviderStatus` 到达后显示状态行数（禁用的 provider 仍算在内）。下一次列表到达后各自改成新的条数。真断连清掉目录后计数消失。pairing-hold 仍留着上次的行和同一计数。Rules 计数在 Global 与 Project 列表到达后显示规则条数（不含栏标题；禁用规则仍算在内）。Hooks 计数是 hook point 条数，不是各点的 installedCount。MCP Servers 计数是服务器条数，不含来源分组。Plugins 计数是插件条数，不是选中插件的 hook 行，也不把 hookCount 加总。Triggers、Clipboard、Context Variables 在该节打开且列表到达后显示条目条数（Context Variables 把 current 与 inherited 都算进去）。这些分区下一次列表到达后改成新的条数。真断连清掉目录后计数消失；Triggers、Clipboard、Context Variables 当时没打开也归零，且不为此再拉列表。pairing-hold 仍留着上次的行和同一计数。Overview 左栏不另计条数。取消删除不发 `DeleteAgentProfile`。选中档案只显示 `ListAgentProfiles` 已带回的 AGENTS.md（summary、usage、detailLevel、description、systemPrompt），不调用 `SaveAgentProfile`。点选不改写正文、工具或启用状态；Save 才写入。从正文去掉 summary、usage、detailLevel 或 description 后再保存，请求里这些字段是空值，刷新后的列表摘要和正文都不再写回被删掉的旧值。未闭合的 frontmatter 不按删除清字段。D1398候选统一使用独立产品outer，即使字段相等或全空也不省略这一层；只拆产品outer、保原rawbody和display baseline成对语义，详见[Profile内容合同](#profile-内容有效性与原始正文)。整份未改的保存才保原DTO body，edited/New按真实控件值处理，不再按同字段猜层。Skills 分组头与技能行统一 24px 单行（分组头含弱化组内条数计数，左栏仍为全量条数）；未选中技能且没有残留正文时不画正文框，只留选择提示。正文已改脏时，点另一条技能或点来源分组行都留在当前技能上，不重载、不丢掉未保存正文；正文未改时点分组行会卸掉选中并回到选择提示。正文未改时点另一条技能，编辑区先卸掉上一条的正文并关掉 Save，直到这条的 SkillInfo 回来；不会把上一条的正文写到新技能上。同一条技能重新加载时仍留着已显示的正文。
2026-11-02 Engine 设置视觉按用户参考图调整：浅灰导航（32px）、居中最大 760px 内容列、标题与白底分组卡片分层。Tools 的 Profile 与 Save 同组，工具名/说明上下对齐，32×20 开关靠右；带说明 44px、无说明 32px、分组 28px。列表按实际盒子布局，正常高度外层不滚动；详情区低于 320px 时列表固定 160px、外层允许滚动以保留控件可达性。选中详情仍只读，列表说明可省略，完整名称/说明可提示。没有新增搜索/筛选，也没有即时保存；原 canWrite、profile、断连与写入协议不变。Test Engine 仍是独立 utility 行，仅收紧视觉。[方案与验证](../../../dev/plans/engine-tools-settings-usability.md)。

Agents 详情列宽至少 560px 时，档案列表约占列宽 34%（夹在 240–340px），与 Instructions / Tools / Model 和 `AGENTS.md` 并排，列表在列内滚动。更窄时编辑器叠在列表下，列表高度落在整行上（分组头与档案行统一 24px 单行，分组头含弱化组内条数计数），避免一行被切进页签。左栏导航行 32px（2026-11-02 Engine 设置局部视觉例外）；Agents 计数在档案列表到达后以弱化数字显示，不是实心徽标。Skills 计数在 `ListSkills` 到达后显示技能条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的技能行和同一计数。Tools 计数在 `ListTools` 到达后显示工具条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的工具行和同一计数。Models 计数在 `ListModels` 到达后显示模型条数（不含 provider 分组标题；禁用模型仍算在内）。Providers 计数在 `listProviderStatus` 到达后显示状态行数（禁用的 provider 仍算在内）。下一次列表到达后各自改成新的条数。真断连清掉目录后计数消失。pairing-hold 仍留着上次的行和同一计数。Rules 计数在 Global 与 Project 列表到达后显示规则条数（不含栏标题；禁用规则仍算在内）。Hooks 计数是 hook point 条数，不是各点的 installedCount。MCP Servers 计数是服务器条数，不含来源分组。Plugins 计数是插件条数，不是选中插件的 hook 行，也不把 hookCount 加总。Triggers、Clipboard、Context Variables 在该节打开且列表到达后显示条目条数（Context Variables 把 current 与 inherited 都算进去）。这些分区下一次列表到达后改成新的条数。真断连清掉目录后计数消失；Triggers、Clipboard、Context Variables 当时没打开也归零，且不为此再拉列表。pairing-hold 仍留着上次的行和同一计数。Overview 左栏不另计条数。取消删除不发 `DeleteAgentProfile`。选中档案只显示 `ListAgentProfiles` 已带回的 AGENTS.md（summary、usage、detailLevel、description、systemPrompt），不调用 `SaveAgentProfile`。点选不改写正文、工具或启用状态；Save 才写入。从正文去掉 summary、usage、detailLevel 或 description 后再保存，请求里这些字段是空值，刷新后的列表摘要和正文都不再写回被删掉的旧值。未闭合的 frontmatter 不按删除清字段。正文自己以 `---` 开头时，若档案上的 summary、usage、detailLevel、description 与这段正文里的同名字段不一致，编辑器仍把档案字段写成外层 frontmatter，内层正文原样保留；未改就保存不会把正文裁成第一段 `---` 之后，也不会用内层 summary 换掉档案摘要。这些字段已经和正文一致时，编辑器仍只显示这一份正文，不套第二层。Skills 分组头与技能行统一 24px 单行（分组头含弱化组内条数计数，左栏仍为全量条数）；未选中技能且没有残留正文时不画正文框，只留选择提示。正文已改脏时，点另一条技能或点来源分组行都留在当前技能上，不重载、不丢掉未保存正文；正文未改时点分组行会卸掉选中并回到选择提示。正文未改时点另一条技能，编辑区先卸掉上一条的正文并关掉 Save，直到这条的 SkillInfo 回来；不会把上一条的正文写到新技能上。同一条技能重新加载时仍留着已显示的正文。

桌面写入口只在 `canPerformCatalogWriteLive`（`ready` 或 `empty`、已连接、非 pairing-hold）且对应 connection 方法存在时出现。空列表也显示工具栏，以便添加第一条。网页 `UniverseAgentConnectionService` 不实现这些写方法，设置页因此不画表单。工具栏和行尾操作是幽灵图标钮（[UI 设计原则 §5.6](../../architecture/cross-cutting/ui-design-principles.md)）：图标 16px，命中区 22px，悬停用 `toolbar.hoverBackground`。名称在 tooltip 和 aria-label 上，行尾钮在悬停或焦点时出现，未出现时不接收点击。Providers 工具栏是 `desktop-download`（Import from local harnesses）和 `add`（Add provider），行尾是 `edit`、`clear-all`。Models 工具栏是 `add`（Add model），行尾是 `edit`、`circle-slash` 或 `check`、`trash`，有 `testModelProfile` 时再加 `beaker`。行尾 aria-label 带该行名称。添加和编辑走 `IDialogService.input`：Providers 依次是 provider id、protocol、base URL、API key（密码框）；Models 依次是 provider、model id、type、level、Description、Cost、Speed。level 留空仍发 0。Description、Cost、Speed 在编辑时留空会重发已存值（没有则 `''`），非空会去掉首尾空白；新建留空发 `''`。没有 temperature、maxTokens、topP、lanes 或 discovery。每个字段有可见名称。必填、level 或 transport 不齐时对话框留着并写出原因。Providers 里留空的协议、base URL 与 API key 保持当前值。删除、清除凭据、移除和导入确认是锚在那个按钮上的弹出层，按钮保留文字，不用系统原生对话框。对话框按钮也保留文字。设置页本身不放这些输入框。Skills 的 New、Agents 的 New / Reset / Delete、Rules 的 Add / Edit / Delete、Memory 的 Add / Refresh / 行 Delete、Token Usage 的 Refresh、MCP 定义的 Add / Update / Remove、Plugins 的 Scan New / Enable 或 Disable / Reload / Unload、Clipboard 的 Write / Read / Clear、Context Variables 的 Read、MCP Runtime 的 Refresh 也是这套幽灵图标。Skills 与 Agents 的 New 打开带名称标签的输入对话框，空名称留在对话框里，不创建。MCP 的 Add 与 Update 打开同一个输入对话框，依次是 name、transport（`stdio`、`sse` 或 `streamable_http`）、command、url、Arguments（一行一个）、Environment（一行 `KEY=VALUE`）。`stdio` 要 command，另两种要 url；不齐不发 RPC。编辑时 args 与 env 留空保留选中值；新建留空则省略这些键，也不设 enabled。没有 `=` 或 key 为空时，对话框写 “Environment lines must be KEY=VALUE.”，不发 RPC。只改 args 会发送。stdio 编辑只改 URL 仍忽略。字段没有变化不调用 update。`isCompleteMcpAddConfig` 不变。无参 `addServer()` 仍不发 RPC。没有 enabled 文本框。Remove 先确认再删除。正文 Save、Agents 页签、Tools 的 Save、目录 Retry 和断连条上的按钮保留文字。Triggers 的 Add 与 Edit 只在既有 upsert 门通过后打开对话框。字段是 Name、Type（都必填）、Prompt、Interval (ms)、Cron、Target、Enabled。scope 与 scopeId 保持 `''`。名称或类型为空不发 RPC。Add 发 triggerId `''`，空 prompt 与 cron 为 `''`，空 interval 为 0，空 target 为 `{ kind: 'unspecified' }`，pauseReason `''`，runAtEpochMs 为 0。Edit 留空则保留选中项的 prompt、interval、cron、target、pauseReason 和 runAtEpochMs。Target 文本只接受 `self`、`bound:<sessionId>`、`new:<profileId>`；其他非空不发 RPC。没有选中项的 Edit 不发。Enabled 取 checkboxChecked，缺了则 false。Fire、Enable、Disable 不变；Delete 先弹锚定确认（2026-11-06）。Rules 的添加和编辑打开输入对话框：Title 必填，Body，Priority（0–3 的整数；编辑留空保留当前优先级，新建留空发 0），Enabled 复选框（新建默认勾选；没有复选框结果则发 false）。编辑保留 id、globs、appliesTo 和 scope。Global 是 2，Project 是 1，sessionId 是 `''`。请求不带 work_dir 或 agent_home。删除先确认。网页不实现 `upsertProjectRule` / `deleteProjectRule`。Memory 的保存对话框要 content，category 可空。删除先确认。Clipboard 的 Write 打开对话框要 Label 和 Content。Content 为空不发 RPC。Label 可空，发 `''`。请求仍只 TEXT：sessionId `''`、agentId `''`、type CLIPBOARD_TEXT、filePath `''`、url `''`。Read 和 Clear 仍立即执行。

Providers 保存调用 `UpsertProviderCredentials`（`providerId`、`apiKey`、`baseUrl`、`protocol`）。`apiKey` 空白表示保留已有密钥。编辑把 provider id 改成新值时，先写入新 id，再对旧 id 调用 `ClearProviderCredentials`。协议、base URL、API key 留空仍表示保留当前值。密钥只出现在输入对话框里，不回写到设置页。`ProviderStatus` 不包含密钥。清除调用 `ClearProviderCredentials`；宿主环境变量保持原样。`PROVIDER_ENV` / `BUILTIN_ENV` 只说明宿主环境仍可能供钥，upsert 写入引擎凭据库，不改进程环境。成功写入后，引擎把该 provider 视为已配置来源。

状态行下面还有两份目录，不计入左栏 Providers 计数。内置预设与 Singularity `PROVIDER_PRESET_OVERLAYS` 同一批 id 和端点：openai、anthropic、gemini、openrouter、deepseek、zhipu、qwen、deepseek-anthropic，按这份声明顺序，不含空白 Custom 行。自定义仍走工具栏 Add。桌面 `listProviderPresetCatalog?` 在主进程拉取 `https://models.dev/api.json`，内存缓存约一天，不是引擎 RPC，也不带密钥。与内置 id 相同的条目用目录里的名称、URL 和最多五个未弃用模型覆盖预设，协议仍用内置值。其余有 API URL 或 env 的条目按名称排成云端列表。选一条打开添加对话框，预填 id、protocol 和 base URL，不自动写入模型注册表。已配置状态行的编辑仍是「Edit provider」，base URL 留空，因为状态里没有 URL。拉取失败时内置列表仍在，云端状态写明不可用；已有缓存则继续用这份缓存。Refresh 先清缓存再拉。网页没有这个方法，云端行写明目录在桌面加载。筛选框只过滤这两份列表。查询去掉首尾空白后仍非空，且内置与云端过滤后都是零行时，筛选框下写 “No matching providers.”。任一侧还有行、查询为空白，或云端仍在 “Reading the cloud catalog…” 时不写这句。云端状态（桌面才加载、不可用、正在读取）仍留在云端状态行，不换成这句。不另发 RPC。

Import from local harnesses 在主进程读取本机配置。确认框只列名称和来源。用户确认的 `providerId` 会再读一次再 upsert；空的 `providerIds` 表示什么都不导入。`~/.cc-switch/cc-switch.db` 的 `providers`（`id`、`app_type`、`name`、`settings_config`）在库存在时是全量目录，只读打开。库里已经出现的 app 不再读该 app 的现行文件。没有库记录的 app 才回退：`~/.claude/settings.json`、`~/.codex/config.toml` 与 `auth.json`、`~/.gemini/.env`、`~/.grok/config.toml`、`~/.config/opencode/opencode.json`、`~/.openclaw/openclaw.json`、`~/.hermes/config.yaml`、`~/.pi/agent/models.json`。跳过 `codex_oauth_auth.json`、`copilot_auth.json`、`xai_oauth_auth.json`，以及既无密钥也无 base URL 的行。稳定 id 重复导入算更新。结果报告 imported / updated / skipped / modelWrites，错误文本去掉本次发送的密钥。模型写在已钉引擎尚未提供 `UpsertModel` 时记入错误，provider 导入仍算成功。

Models 保存调用 `UpsertModel`。新行 id 为 `provider:modelId`。编辑时 provider 与 model id 都没变则沿用原 id；任一变了就用 `provider:modelId` 写入，再删除旧 id。level 留空发 0，表示沿用已有等级或由引擎默认。Description、Cost、Speed 的留空规则见上面的对话框。保存失败和校验用错误色。Enable / Disable 走 `SetModelEnabled`。Delete 先确认，再走 `DeleteModel`。Test 走已有 `TestModelProfile`，带该行的 provider 与 model id，api key 与 base URL 为空，让引擎使用已存凭据。会话选用仍是 Composer 的 `SwitchModel` / `modelProfileId`。Agent profile 的 `model` / `modelType` / `maxTurns` 仍在 Agents 的 Model 子 tab，字段名是档案默认，不是当前会话的模型。Tools 的勾选写的是这个档案的启用集。MCP 与 Agents 标出当前工作根。Skills 与 Rules 说明项目项跟着打开的工作根。Clipboard 与 Context Variables 是引擎范围，请求里的 session id 仍是空的。不另开 Session 设置页。

Agents 详情列宽至少 560px 时，档案列表约占列宽 34%（夹在 240–340px），与 Instructions / Tools / Model 和 `AGENTS.md` 并排，列表在列内滚动。更窄时编辑器叠在列表下，列表高度落在整行上（分组与无摘要 28px，有摘要 44px），避免一行被切进页签。左栏导航行 22px；Agents 计数在档案列表到达后以弱化数字显示，不是实心徽标。Skills 计数在 `ListSkills` 到达后显示技能条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的技能行和同一计数。Tools 计数在 `ListTools` 到达后显示工具条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的工具行和同一计数。Models 计数在 `ListModels` 到达后显示模型条数（不含 provider 分组标题；禁用模型仍算在内）。Providers 计数在 `listProviderStatus` 到达后显示状态行数（禁用的 provider 仍算在内）。下一次列表到达后各自改成新的条数。真断连清掉目录后计数消失。pairing-hold 仍留着上次的行和同一计数。Rules 计数在 Global 与 Project 列表到达后显示规则条数（不含栏标题；禁用规则仍算在内）。Hooks 计数是 hook point 条数，不是各点的 installedCount。MCP Servers 计数是服务器条数，不含来源分组。Plugins 计数是插件条数，不是选中插件的 hook 行，也不把 hookCount 加总。Triggers、Clipboard、Context Variables 在该节打开且列表到达后显示条目条数（Context Variables 把 current 与 inherited 都算进去）。Memory 在列表或搜索到达后显示文件条数（不含分类标题）。有查询且没有 `searchMemory` 时不把未过滤列表当成命中，也不写 “No memory.”，状态是 “Search is unavailable.”，导航计数消失，直到清空查询后 `listMemory` 再跑。搜索零条写 “No matching memory.”，不是 “No memory.”，导航计数同样消失，直到下一次列表。列表为空仍是 “No memory.”。Token Usage 左栏不另计条数。这些分区下一次列表到达后改成新的条数。真断连清掉目录后计数消失；Triggers、Clipboard、Context Variables 当时没打开也归零，且不为此再拉列表。pairing-hold 仍留着上次的行和同一计数。Overview 左栏不另计条数。取消删除不发 `DeleteAgentProfile`。选中档案只显示 `ListAgentProfiles` 已带回的 AGENTS.md（summary、usage、detailLevel、description、systemPrompt），不调用 `SaveAgentProfile`。点选不改写正文、工具或启用状态；Save 才写入。从正文去掉 summary、usage、detailLevel 或 description 后再保存，请求里这些字段是空值，刷新后的列表摘要和正文都不再写回被删掉的旧值。未闭合的 frontmatter 不按删除清字段。D1398候选统一使用独立产品outer，即使字段相等或全空也不省略这一层；只拆产品outer、保原rawbody和display baseline成对语义，详见[Profile内容合同](#profile-内容有效性与原始正文)。整份未改的保存才保原DTO body，edited/New按真实控件值处理，不再按同字段猜层。Skills 分组与无描述行 28px、有描述 44px；未选中技能且没有残留正文时不画正文框，只留选择提示。正文已改脏时，点另一条技能或点来源分组行都留在当前技能上，不重载、不丢掉未保存正文；正文未改时点分组行会卸掉选中并回到选择提示。正文未改时点另一条技能，编辑区先卸掉上一条的正文并关掉 Save，直到这条的 SkillInfo 回来；不会把上一条的正文写到新技能上。同一条技能重新加载时仍留着已显示的正文。

MCP 定义的回归入口为 `conversation/test/browser/engineMcpSection.test.ts`：真实工具栏 `aria-label` 触发当前 `IDialogService.input`，以公共 `IInput.validate`、请求与实际 BrowserDialogHandler DOM 检查校验、关闭、取消和延迟确认；不依赖已删除的内联 form test API。MCP/Tools 工作根夹具共用正式 resolver，保留 session/engine identity 与 source/access；连接事件传真实 snapshot，列表能力与写能力仍按各自 namespace 显式声明，默认 UNKNOWN 不放行。

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
| Triggers | Add/Edit 在 upsert 门通过后打开对话框 | 非 `self` / `bound:` / `new:` 的 Target 不发 RPC。Fire 的 `rejected` 画 error，`skipped` 画 neutral |
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


## 2026-10-27 Skills 正文保存

桌面 Skills New/Save 已消费正式 protobuf SaveSkillContent。New发create=true；Save发create=false、loaded source与原文（包括空串presence）；user/project可写，bundled只读。引擎按目录实际路径保存且保留逻辑名称与manifest flags，冲突/来源变化/损坏manifest/路径或链接问题拒写。详见[现行协议增量](../../reference/universe-agent/engine-protocol-surface.md#2026-10-27-队列读回与技能正文正式协议)。

保存期间可继续输入；canonical读回更新CAS基线，只有没有继续编辑才替换显示。失败保持草稿，读回失败不能显示已验证保存成功。工具栏增加幽灵图标 Refresh skills，用于显式重读目录元数据及恢复失败后的基线；同引擎新link可恢复，异引擎旧稿不自动重设基线，提示回原引擎。旧引擎UNIMPLEMENTED继续收起New/Save；本轮未替换50061或签收PRD-025真实产品验收。

## 2026-10-28 连接归属与断连草稿修复合同

本节第一阶段在C/F实现并通过634项目标完整套件与原项目noEmit。续查确认main已换引擎、renderer尚未收到snapshot的IPC窗口仍未封闭，现已重开C/F补修，原证据保留为阶段结果；不能声称当前合同完整。具体证据与状态见[并行看板](../../../dev/parallel/active/engine-lifecycle-recovery-2026-10-28.md)，不表示 PRD-025 已完成。

Providers / Models 捕获动作开始时已发布的 engine identity 与 link。输入、确认、预览、RPC 返回、改名后删除及反馈刷新均复核原归属；换引擎、同引擎换 link 或 section dispose 后停止后续操作。node 本地批量导入还须捕获原 transport，不能在每一步重新取新连接续写。原引擎已接受的步骤保留，未开始的步骤取消；归属取消不算 transport 故障、不触发重连，不输出密钥。当前连接的正常业务失败仍按既有方式汇总。

Providers、Models及Skills的写授权还绑定已应用目录的owner。目录仍显示A、连接快照已B或同引擎新link时，旧行的编辑、清除、删除、启停与Test均停止，不用新owner提交旧行数据；新目录真正应用后才恢复相应写入口。目录发布先撤旧行及其授权，同步计数通知或渲染重入后重核generation与owner再开放；普通读取独立于该写门，能够加载新目录。Skills的选择/正文读取也沿所属目录owner，异步选择事件不能重捕新快照给旧行改归属。

完整归属还须贯穿进程：UI传动作开始的IDE内部expectedOwner独立参数，IPC分派前与main实际调用前拒绝缺失、畸形、失配；校验与选transport/调用之间不得await。ChannelClient仅转发，不能用新owner替换旧意图。完成/异常及动态能力变更前再次核验，固定取消不泄密；UI显式消费取消，因为此刻其cache可能仍停在旧A。可信进程内旧调用的兼容与产品IPC fail-closed分开处理，不改变引擎protobuf。

共享owner为`UniverseAgentExpectedOwner`的只读`{ engineIdentityId, linkId }`，identity非空、link为正safe integer。带业务request的方法把owner放在第二个参数，无request的列表方法放第一个；13个受保护方法及调用者边界见[实施方案的方法表](../../../dev/plans/engine-write-ownership.md#统一-ide-expectedowner-合同)。本地导入预览与云端预设目录不选择引擎transport，不因这份合同改为引擎RPC。

可信进程内省略owner与显式`undefined`保持旧调用语义；`null`或其他显式畸形值不能降级为省略。无owner的旧Skills保存仍在main内部捕获原transport、identity与link，用于隔离健康及动态binding副作用：旧link的晚`UNIMPLEMENTED`不能删除新link能力，但不为legacy调用额外强加归属取消错误。产品IPC中缺失或`undefined`的owner始终取消。

Skills 的实时目录与用户编辑状态分开：真断连继续清 RPC 目录和计数，dirty 或保存中正文及原 engine/name/source/raw 基线作为内存残稿保留，正文只读、Save 关闭。原引擎新 link 自动恢复目录也不授权残稿；显式 Refresh 必须验证原技能、来源并成功读正文后才更新 CAS 基线，保留用户正文。foreign 同名项、来源变化、技能缺席和读失败都不能重设基线或丢稿。保存互斥由具体操作持有，旧请求的完成或 finally 不能阻塞新连接恢复、释放新保存的互斥或覆盖新草稿。toggle 的回包、异常及刷新返回同样检查原 engine/link 与 dispose。干净缓存仍清除；不新增持久化或跨面板草稿系统。

## 2026-11-06 失败保留输入、确认与窄宽导航

依据 [交互审查收口](../../../dev/plans/interaction-review-2026-11-06.md) 的 I1.3、I1.4、I2.6、I2.7、I4.1、I4.2 与 I7。只有组件测试，尚未在测试配置的默认窗口里只用键盘走一遍。

- 锚定确认弹层关闭（确认、取消、Esc、点外部）后，焦点回到触发它的按钮。弹层内 Tab / Shift+Tab 在按钮间循环，不跑出弹层。
- Triggers 的 Delete 先弹锚定确认，取消不发 `DeleteTrigger`。
- 对话框或确认弹层开着时，换引擎、换 link、断连、pairing-hold 或列表刷新使这次写作废的，不发 RPC，并在该节写 “The connection changed before this was sent. Try again.”；选中项变了写 “The selection changed before this was sent. Try again.”。适用 Triggers 的 Add / Edit / Delete，Providers 的 Add / Edit / Clear / Import，Models 的 Add / Edit / Delete。视图已销毁时不写。
- Providers、Models、MCP 的新建与编辑在引擎写失败（抛错或 `ok:false`）时，用刚提交的值重开同一对话框，对话框换成错误图标，说明行开头写失败原因。Providers 的 API key 也留在密码框里，原因里的本次密钥仍替换为 `[redacted]`。在重开的对话框里取消时，Providers 与 Models 把失败写进节内状态行；MCP 的节内失败行原本就在。必填、level、transport、env 由对话框的 validate 当场拦住；绕过 validate 的结果照旧写节内，不重开。Provider 改名时旧 id 的清除失败、Model 改名时旧 id 的删除失败也照旧写节内，因为新值已经写入。
- Engine 与 Connection 两页在窄宽单栏时，导航里的方向键只移动焦点，Enter 或单击才进入详情。宽时方向键仍预览该节。同一次点击带来的焦点、选择、打开只激活该节一次，不再重复刷新 Triggers、Clipboard、Context Variables 而作废未返回的写。
- Connection 的 Disconnect 只在连接中或已连接时可点，否则禁用，tooltip 与 aria-label 写 “No engine is connected.”。Forget this Engine 没有选中 profile 时禁用并写 “Select a profile first.”，连接进行中写 “A connection is already in progress.”。两者仍不加确认（待拍板 D3），原生确认框不变。
- Skills 正文已改脏时点另一条技能，仍留在当前技能，正文区上方就地出现一行 “Unsaved changes. Save or discard them to open {0}.” 和 Save、Discard。Save 成功且不再脏后打开那条技能；Discard 把正文还原为已加载内容后打开它。点来源分组行仍只留在原处，不出这行。Agents 还没有这行提示。
