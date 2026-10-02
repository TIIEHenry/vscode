---
title: "Engine 页 Customizations catalog（ua.engine）"
type: reference
status: accepted
phase: N/A
updated: 2026-10-02
summary: "HEAD 九节壳已挂：四节写路径 + Overview/Model/MCP Runtime/Plugins；Provider/Rules/Hooks 只读列表已接（无写表单）；产品验证未做"
---

# Engine 页 Customizations catalog（`ua.engine`）

> 宿主与 TOC 见 [Settings UA 接入](../../reference/code-oss-b2/settings-ua-access.md)。权威表与协议缺口见 [customizations-engine](../../../dev/plans/customizations-engine.md)。传输 RPC 登记见 [engine-protocol-surface §1/§7](../../reference/universe-agent/engine-protocol-surface.md)。

`EnginePreferencesPane` 是 Preferences 子 pane（`ua.engine`），左栏 `WorkbenchList` 九节、右栏一次一节。本节记 **@ HEAD 代码事实**（E2-1–E2-7 @ `482b611a` 一带；**GC-6** Overview Model 摘要 @ `f583073b` / `d98d888a`）。**不得**把 Provider 凭据写、Rules/Hooks 写表单或 Composer 下拉写成已接通；§8.3 产品验收与 PRD-008 隔离 profile 冒烟仍待。

[PRD-025](../../product/requirements.md#prd-025-engine-设置完整性) / [engine-preferences-completion](../../../dev/plans/engine-preferences-completion.md)（`accepted`）的 **代码完成线已落**；产品验证未做，PRD **不**升 `implemented`。下文表是当前代码，不是「待实施目标」。
Engine Preferences 子页（`EnginePreferencesPane`）承载 Customizations 产品主面。本节记 **@ HEAD 九节两栏壳**：四节 list/toggle/写（Skills / Agents / MCP Definitions / Tools）、Overview 摘要、Model 只读注册表、MCP Runtime tab、Plugins probe/列表。**不得**把 Provider / Rules / Hooks **写表单**写成已接通（[G-ENG-1/2/3](../../reference/universe-agent/engine-protocol-surface.md) 只读列表已接）；产品验收与 PRD-008 隔离 profile 冒烟仍待。

**M7 代码完成线（产品验证未做）：** [PRD-025](../../product/requirements.md#prd-025-engine-设置完整性) E2-1–E2-7 九节六态已挂。实施方案见 [engine-preferences-completion](../../../dev/plans/engine-preferences-completion.md)（`accepted`）。本页以下 `@ HEAD` 表只陈述当前代码。没有用户可观察证据不得升 `implemented`。

## 1. 节与能力键

| Engine 页节 | 能力键 | `IUniverseAgentConnection.getCapabilitySnapshot()` 来源 |
|-------------|--------|-----------------------------------------------------------|
| Overview | （聚合） | 连接 phase / `workDir` / transport；capability 摘要；Model 行读 `models` |
| Provider & Model | `providerConfig` / `models` | Provider：connection `listProviderStatus?` 只读列表（无凭据输入）。Model：Connect 广告 + `ConfigService.ListModels` probe（P1b） |
| Skills | `skills` | Connect 广告 + `ToolService.ListSkills` probe |
| Agents | `agentProfiles` | Connect 广告 + `AgentService.ListAgentProfiles` probe |
| Rules | `globalRules` / `projectRules` | connection `listProjectRules?` 只读 Global(2)/Project(1)；无 Upsert/Delete |
| Hooks | `hooksMetadata` | connection `listHookPoints?` 只读点位；Definitions 栏无 RPC |
| MCP Servers | `mcp` / `mcpRuntime` | Definitions：`McpService.ListMcpServers`。Runtime：`GetMcpServerStatuses` / `GetMcpServerTools`（P1a） |
| Plugins | `plugins` | `PluginService.List` 真探测（P1a）；无 marketplace |
| Tools | `tools` | Connect 广告 + `ToolService.ListTools` probe |

禁止用 Copilot 盘或 `{AgentHome}` 扫盘顶替任何一节。
| Overview | （聚合，无独立键） | 连接路径 / workDir / 各能力摘要；不暴露 secret |
| Provider & Model | `models` / `providerConfig` | Model = `ListModels`；Provider = `listProviderStatus?` 只读（G-ENG-1 无写表单） |
| Skills | `skills` | Connect 广告 + `ToolService.ListSkills` 运行时 probe（`grpcCapabilityProbe.ts`） |
| Agents | `agentProfiles` | Connect 广告 + `AgentService.ListAgentProfiles` probe |
| Rules | `globalRules` / `projectRules` | `listProjectRules?` 只读列表（G-ENG-2 无写表单） |
| Hooks | `hooksMetadata` | `listHookPoints?` 只读点位（G-ENG-3 Definitions 无 RPC） |
| MCP Servers | `mcp` + `mcpRuntime` | Definitions = `ListMcpServers`；Runtime tab = `GetMcpServerStatuses` / `GetMcpServerTools`（P1a） |
| Plugins | `plugins` | Connect 广告 + `PluginService.List` probe（P1a）；无 marketplace |
| Tools | `tools` | Connect 广告 + `ToolService.ListTools` probe |

禁止用 Copilot 盘或 `{AgentHome}` 扫盘顶替任何 catalog。Rules / Hooks / Provider 只读列表来自引擎 RPC；无 hook 时仍完整 unsupported。不画凭据/规则写表单。

## 2. 渲染模式（六态 @ HEAD）

`engineCatalog.ts` 的 `EngineCatalogPaneMode`：`disconnected` \| `unsupported` \| `loading` \| `failed` \| `empty` \| `ready`。判定自上而下、命中即止（`resolveEngineCatalogPaneMode`）。E2-1 **废止** disconnected 整节隐藏：九节在左栏始终可达；「无 Engine」= 右栏零条目、零写按钮，不是把导航藏掉。断连 CTA **只在页级 banner**：Test Engine 次要 + Open Connection 主要；catalog 节 body **只出文案**（不再各节再画 Open Connection）；页脚 Test Engine **仅已连接**时出现。状态字停在可见的那颗 Test 旁边。

| 模式 | 条件 | UI |
|------|------|-----|
| `disconnected` | `!isEngineConnected()` | 页级 banner 复用 `getConnectionPhaseStatusBarText` + Test / Open Connection；节级只出文案；零条目零写按钮 |
| `unsupported` | 已连接且能力 `UNSUPPORTED` | 节标题在；**零假条目**；`getCatalogUnsupportedCopy`（可带 `reason`） |
| `loading` | 已连接且能力 `UNKNOWN`（「正在确认引擎能力…」）**或** list in-flight（「正在读取…」） | 两种 loading 文案不得混用 |
| `failed` | list RPC reject | transport 错 + Retry；**不得**画成 0 条。in-flight 与 failed 互斥 |
| `empty` | RPC 成功且列表长度 0 | 真空态；允许合法 New/Add |
| `ready` | RPC 成功且有条目 | 列表 / 详情 / 写控件 |

写入口仅 `canPerformCatalogWrite`（`empty` \| `ready`）。`canShowCatalogRows` 仅 `ready`。`shouldHideCatalogRows` 已 deprecated，不得再当 hide-on-disconnect。MCP / Skills / Agents 写成功后 `refresh()` 仅在 list listed 时回刷 Added/Created/Saved 等成功文案（D201 同胞）。Agents markdown Save 二次回刷同样闸 `listed`，不用 mode（D223）。Plugins Enable / Reload / Unload / scanNew 同样仅 `listed === true` 才回刷 Enabled./Reloaded./Unloaded. / lastScan（D216 / D222）；不得用 `canPerformCatalogWrite(this.mode)` 代理。

`catch → emptyList()` **禁止**。断连后 catalog 清 RPC 缓存并回 disconnected；不得标「已同步」。Navigator「断开前快照」不适用于本页。MCP Definitions leftover（pairing-hold KEEP / capability UNKNOWN / list-fail）保行并关行 toggle chrome（`canWrite()` disable + splice），无需重选。

## 3. @ HEAD 已落地

| 节 | 传输（`platform/universeAgent`） | Engine UI（`contrib/conversation/browser`） | 备注 |
|----|-----------------------------------|---------------------------------------------|------|
| **Skills** | 读：`ListSkills` · `SkillInfo` · `SetSkillEnabled`。写：`IUniverseAgentConnection.saveSkillContent?`（common 契约 @ `f3f2d366`；node gRPC `SaveSkillContent` @ `45fa7a35`/`040c823d`） | `EngineSkillsSection`：bundled/user/project 分组 + 启用开关（旁冻结句 `getSkillToggleFreezeNotice`）+ 选中 skill **textarea**（`getSkillInfo` 读正文）；USER/PROJECT 在 `saveSkillContent` 存在且 `supported` 时 **Save**；BUNDLED 只读；断连/`UNSUPPORTED` 不渲染正文区 | list/toggle @ `8bfc299e`；**正文 UI** @ `f3f2d366`/`3e986bde`；**node 传输** @ `45fa7a35`/`040c823d`；**新建 UI** @ `e6167c45`/`9255e363` |
| **Agents** | `ListAgentProfiles` · `SaveAgentProfile` · `DeleteAgentProfile` · `ResetAgentProfile` | `EngineAgentsSection`：project/user/built_in 分组列表；`supported` 时写工具栏 **New / Delete / Reset** + 选中 profile **`AGENTS.md` textarea + Save**（`engineAgentAgentsMd.ts`）。Model 子 tab 写 `model` / `modelType` / `maxTurns`（空 max turns = 引擎默认；0 与非整数不发出）。不是 Provider/Model 注册表选择器。内置档案只读。删除非内置档案前先警告确认 | list @ `4833c008`；写 RPC + 写入口 @ `7f10e65c` / `f49615a1`；**`AGENTS.md` 全文编辑器** @ `9419f583`/`3756d04e`（断连/`UNSUPPORTED` 不渲染）；Model 三字段走已有 Save/List |
| **MCP Servers** | `ListMcpServers` · `ToggleMcpServer` · `AddMcpServer` · `UpdateMcpServer` · `RemoveMcpServer` | `EngineMcpSection`：global/project 分组 + 启用 checkbox；`supported` 时写工具栏 **Add / Update / Remove** | list + toggle @ `4833c008`；定义 CRUD @ `7f10e65c` / `f49615a1` |
| **Tools** | `ListTools` · `SaveAgentProfile`（profile `tools.json`）。`ToolInfo` 已进 catalog；选中行 `getToolInfo` 只读详情 | `EngineToolsSection`：`ListTools` 目录 + profile 下拉（user/project，不含 built_in）+ 启用 checkbox + 只读详情；经 `engineToolProfile.ts` 写 `disabledTools` / `enabledTools` | list @ `4833c008`；profile 启用集 @ `7f10e65c` / `f49615a1` |
| **Overview** | 读 snapshot；`models=SUPPORTED` 时 `listModels()` 取已启用数（GC-6） | `EngineOverviewSection`：连接路径 / workDir / 能力摘要 / Model 计数。不暴露 token / 地址 / ticket | E2 壳；Provider 行不画 |
| **Provider & Model** | `ListModels` + `listProviderStatus?`（只读） | `EngineProviderModelSection`：Model 注册表 + Provider 只读行；零凭据输入 | P1b；G-ENG-1 |
| **MCP Runtime** | `GetMcpServerStatuses` · `GetMcpServerTools` | `EngineMcpRuntimePanel`（MCP 节 Runtime tab） | P1a；能力键 `mcpRuntime` |
| **Plugins** | `PluginService.List` / `Info` / `Enable` / `Reload` / `Unload` / `ScanNew` | `EnginePluginsSection`：列表 + 行工具栏 + Hooks 表（行数随引擎；无 marketplace）。pairing-hold KEEP leftover 关掉 Enable / Reload / Unload / Scan（disable，不重选；D428） | P1a |
| **Rules / Hooks** | `listProjectRules?` / `listHookPoints?` | `EngineRulesSection` / `EngineHooksSection`：只读列表；无写控件 | G-ENG-2 / G-ENG-3 |

Agents 详情列宽至少 560px 时，档案列表约占列宽 34%（夹在 240–340px），与 Instructions / Tools / Model 和 `AGENTS.md` 并排，列表在列内滚动。更窄时编辑器叠在列表下，列表高度落在整行上（分组与无摘要 28px，有摘要 44px），避免一行被切进页签。左栏导航行 22px；Agents 计数在档案列表到达后以弱化数字显示，不是实心徽标。Skills 计数在 `ListSkills` 到达后显示技能条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的技能行和同一计数。Tools 计数在 `ListTools` 到达后显示工具条数（不含分组行）；真断连清掉目录后计数消失。pairing-hold 仍留着上次的工具行和同一计数。取消删除不发 `DeleteAgentProfile`。选中档案只显示 `ListAgentProfiles` 已带回的 AGENTS.md（summary、usage、detailLevel、description、systemPrompt），不调用 `SaveAgentProfile`。点选不改写正文、工具或启用状态；Save 才写入。从正文去掉 summary、usage、detailLevel 或 description 后再保存，请求里这些字段是空值，刷新后的列表摘要和正文都不再写回被删掉的旧值。未闭合的 frontmatter 不按删除清字段。正文自己以 `---` 开头时，若档案上的 summary、usage、detailLevel、description 与这段正文里的同名字段不一致，编辑器仍把档案字段写成外层 frontmatter，内层正文原样保留；未改就保存不会把正文裁成第一段 `---` 之后，也不会用内层 summary 换掉档案摘要。这些字段已经和正文一致时，编辑器仍只显示这一份正文，不套第二层。Skills 分组与无描述行 28px、有描述 44px；未选中技能且没有残留正文时不画正文框，只留选择提示。正文已改脏时，点另一条技能或点来源分组行都留在当前技能上，不重载、不丢掉未保存正文；正文未改时点分组行会卸掉选中并回到选择提示。正文未改时点另一条技能，编辑区先卸掉上一条的正文并关掉 Save，直到这条的 SkillInfo 回来；不会把上一条的正文写到新技能上。同一条技能重新加载时仍留着已显示的正文。

单测：`engineCatalogSections.test.ts` · `enginePreferencesPane.test.ts` · `engineAgentAgentsMd.test.ts` · `engineAgentModel.test.ts` · `engineSkillsSection.test.ts` · `engineToolProfile.test.ts`（能力三态、断连路径、Skills 正文 Save 形状、AGENTS.md 保存与写 RPC 形状、Model 三字段、九节导航）。

单测：`engineCatalogSections.test.ts` · `engineOverviewSection.test.ts` · `enginePreferencesPane.test.ts` · `engineSkillsSection.test.ts` · `engineAgentAgentsMd.test.ts` · `engineAgentModel.test.ts` · `engineToolProfile.test.ts`。

## 4. 仍未落地（本文不得写「已接」）

| 操作 | RPC / 面 | 状态 |
|------|----------|------|
| Provider 凭据 / endpoint / Test | `listProviderStatus?` 只读；Upsert/Clear 未进 UI | **零**输入控件 |
| Agent profile 模型目录选择器 | Model 子 tab 只写 profile 的 `model` / `modelType` / `maxTurns` | 注册表仍在 Provider & Model；不升 PRD-025 |
| Rules / Hooks 写 | Upsert/Delete 未进 UI | 只读列表已接；不扫 Copilot / AgentHome |
| Composer 下拉 | AgentProfile / Model / Permission / Tools | Engine 页 list **不等于** Composer 已填引擎选项；Route 省略 |
| Plugins marketplace | — | 不做 |
| 产品验证 / 隔离 profile 冒烟 | PRD-025 § / PRD-008 | 未做；不升 `implemented` |
| Agent profile `model.json` 文件编辑器 | 不单独编辑磁盘文件 | 三字段经 Model 子 tab 的 `SaveAgentProfile`；空 max turns 省略（引擎默认） |
| 完整插件市场 | — | Plugins 只接 Engine `PluginService`，无 marketplace |
| Composer 选择进发送载荷 | `submitInput` / `SwitchModel` | Agent / Tools / Model **只读填表**（`conversationComposerCatalog.ts`）。Model 选中 catalog id 进 `submitInput.modelProfileId`（Chat `SessionInput.model_profile_id`；诚实空不带）。下拉变更可走已有 `switchModel?`。Agent / Tools 选择不进发送载荷。Permission 接通后走 `setPermissionMode`。Route 省略（无引擎 `routeIndex`） |

## 5. 九节与差距（代码已落后仍缺的协议）

| 节 | HEAD UI | 仍缺 |
|----|---------|------|
| Overview | 已有；GC-6 Model 计数；Provider 行已隐藏 | 产品验证 |
| Provider & Model | Model 只读注册表；Provider 只读列表 | G-ENG-1 凭据写 / Test |
| Skills / Agents / Tools | 已有 list/toggle/写；Agents Model 子 tab 写三字段 | Composer 下拉；不是模型注册表选择器 |
| Rules | 只读列表 | G-ENG-2 写 |
| Hooks | 只读点位 | G-ENG-3 Definitions / 写 |
| MCP Servers | Definitions + Runtime | 无 |
| Plugins | list + 启停/重载/扫描 | marketplace（明确不做） |
| M7 节 | HEAD | 数据姿态 |
|-------|------|----------|
| Overview | 壳已挂 | 聚合连接路径、workDir、capability；Model 摘要仅在 `models=SUPPORTED`；不暴露 secret |
| Provider & Model | Model + Provider 只读已挂 | **Model** = `ListModels`；**Provider** = `listProviderStatus?`；不跳 Copilot Models |
| Skills | 已有 | 两栏宿主，保留 list/toggle/body/New |
| Agents | 已有 | Instructions / Tools / Model。Model 写 `model` / `modelType` / `maxTurns`；内置与断连只读。不升 PRD-025 |
| Rules | 只读列表 | 无 Upsert/Delete；不扫 Copilot rules |
| Hooks | 只读点位 | Definitions 无 RPC；点位表不抄静态点位 |
| MCP Servers | Definitions + Runtime tab | Runtime 走 `mcpRuntime`，不混 vscode `IMcpService` |
| Plugins | probe + 列表已挂 | Engine `PluginService`，无 marketplace |
| Tools | 已有 | 保留 profile enablement，分开 client-tool 运行态 |

**断连语义（与 Navigator 不同）：** Engine catalog 断连即清 RPC 缓存、各节回 disconnected；Navigator 段保留「断开前快照」是会话面合同。

UI 可先交付 unsupported/failed，不等待全部 RPC；没有真实数据与产品验证证据时仍不得升 `implemented`。

## 6. 与 Composer 下拉

`Permission` 接通后走 `setPermissionMode`。接通且能力 `SUPPORTED` 时，Agent / Tools / Model **只读填 catalog**（`listAgentProfiles` / `listTools` / `listModels`）。Model 选中 id 进 `submitInput.modelProfileId`；下拉变更可走 `switchModel?`。Agent / Tools 选择不进发送载荷。Route **不画**（无引擎 `routeIndex`）。Engine 页写路径仍是 catalog 权威。

## 相关

- [engine-protocol-surface](../../reference/universe-agent/engine-protocol-surface.md) · [customizations-engine](../../../dev/plans/customizations-engine.md) · [stub-and-fixtures §6](../conversation/stub-and-fixtures.md)（诚实降级）
