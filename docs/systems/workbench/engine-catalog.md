---
title: "Engine 页 Customizations catalog（ua.engine）"
type: reference
status: accepted
phase: N/A
updated: 2026-09-04
summary: "九节两栏 @ HEAD：Overview / Provider & Model / Skills / Agents / Rules / Hooks / MCP / Plugins / Tools；六态；GC-6 Model 摘要已落；Overview Provider 行 G-ENG-1 前省略；PRD-025 待产品验证"
---

# Engine 页 Customizations catalog（`ua.engine`）

> 宿主与 TOC 见 [Settings UA 接入](../../reference/code-oss-b2/settings-ua-access.md)。权威表与协议缺口见 [customizations-engine](../../../dev/plans/customizations-engine.md)。传输 RPC 登记见 [engine-protocol-surface §1/§7](../../reference/universe-agent/engine-protocol-surface.md)。

`EnginePreferencesPane` 是 Preferences 子 pane（`ua.engine`），左栏 `WorkbenchList` 九节、右栏一次一节。本节记 **@ HEAD 代码事实**（E2-1–E2-7 @ `482b611a` 一带；**GC-6** Overview Model 摘要 @ `f583073b` / `d98d888a`）。**不得**把 Provider 凭据、Rules/Hooks 列表或 Composer 下拉写成已接通；§8.3 产品验收与 PRD-008 隔离 profile 冒烟仍待。

[PRD-025](../../product/requirements.md#prd-025-engine-设置完整性) / [engine-preferences-completion](../../../dev/plans/engine-preferences-completion.md)（`accepted`）的 **代码完成线已落**；产品验证未做，PRD **不**升 `implemented`。下文表是当前代码，不是「待实施目标」。

## 1. 节与能力键

| Engine 页节 | 能力键 | `IUniverseAgentConnection.getCapabilitySnapshot()` 来源 |
|-------------|--------|-----------------------------------------------------------|
| Overview | （聚合） | 连接 phase / `workDir` / transport；capability 摘要；Model 行读 `models` |
| Provider & Model | `providerConfig` / `models` | Provider：G-ENG-1 前无 RPC，节内恒 unsupported 完整态。Model：Connect 广告 + `ConfigService.ListModels` probe（P1b） |
| Skills | `skills` | Connect 广告 + `ToolService.ListSkills` probe |
| Agents | `agentProfiles` | Connect 广告 + `AgentService.ListAgentProfiles` probe |
| Rules | `globalRules` / `projectRules` | 无 Rules gRPC（G-ENG-2）；节壳在，列表恒不接线 |
| Hooks | `hooksMetadata` | 无 Hook RPC（G-ENG-3）；节壳在，两栏恒不接线 |
| MCP Servers | `mcp` / `mcpRuntime` | Definitions：`McpService.ListMcpServers`。Runtime：`GetMcpServerStatuses` / `GetMcpServerTools`（P1a） |
| Plugins | `plugins` | `PluginService.List` 真探测（P1a）；无 marketplace |
| Tools | `tools` | Connect 广告 + `ToolService.ListTools` probe |

禁止用 Copilot 盘或 `{AgentHome}` 扫盘顶替任何一节。

## 2. 渲染模式（六态 @ HEAD）

`engineCatalog.ts` 的 `EngineCatalogPaneMode`：`disconnected` \| `unsupported` \| `loading` \| `failed` \| `empty` \| `ready`。判定自上而下、命中即止（`resolveEngineCatalogPaneMode`）。E2-1 **废止** disconnected 整节隐藏：九节在左栏始终可达；「无 Engine」= 右栏零条目、零写按钮 + Open Connection，不是把导航藏掉。

| 模式 | 条件 | UI |
|------|------|-----|
| `disconnected` | `!isEngineConnected()` | 页级 / 节级复用 `getConnectionPhaseStatusBarText` + Open Connection；零条目零写按钮 |
| `unsupported` | 已连接且能力 `UNSUPPORTED` | 节标题在；**零假条目**；`getCatalogUnsupportedCopy`（可带 `reason`） |
| `loading` | 已连接且能力 `UNKNOWN`（「正在确认引擎能力…」）**或** list in-flight（「正在读取…」） | 两种 loading 文案不得混用 |
| `failed` | list RPC reject | transport 错 + Retry；**不得**画成 0 条。in-flight 与 failed 互斥 |
| `empty` | RPC 成功且列表长度 0 | 真空态；允许合法 New/Add |
| `ready` | RPC 成功且有条目 | 列表 / 详情 / 写控件 |

写入口仅 `canPerformCatalogWrite`（`empty` \| `ready`）。`canShowCatalogRows` 仅 `ready`。`shouldHideCatalogRows` 已 deprecated，不得再当 hide-on-disconnect。

`catch → emptyList()` **禁止**。断连后 catalog 清 RPC 缓存并回 disconnected；不得标「已同步」。Navigator「断开前快照」不适用于本页。

## 3. @ HEAD 已落地

| 节 | 传输（`platform/universeAgent`） | Engine UI | 备注 |
|----|-----------------------------------|-----------|------|
| **Overview** | 读 snapshot + 可选 `listModels()` | `EngineOverviewSection`：Connection / workDir / Transport；Model 行在 `models=SUPPORTED` 时取已启用数（GC-6）；capability 产品文案。**不**暴露 token / 地址 / ticket | Provider 行 G-ENG-1 前**不画**（E2 §3.1）；不出现 Unavailable 假摘要、不出现 provider 名或计数 |
| **Provider & Model** | `listModels()`（`include_disabled=true`） | `EngineProviderModelSection`：Provider 组零列表零输入、CONNECTED+SUPPORTED 也折成 unsupported。Model 按 `provider` 分组只读列表；禁用灰显；无 Enable/Disable | 脚注「provider 名来自模型注册表，不代表已配置凭据」。会话级 SwitchModel **不**画在本页 |
| **Skills** | `ListSkills` · `SetSkillEnabled` · `saveSkillContent?` | 分组 list + 开关 + USER/PROJECT textarea + Save；BUNDLED 只读；connected 且 `SUPPORTED` 时 New | list/toggle @ `8bfc299e`；正文 @ `f3f2d366`；node 传输 @ `45fa7a35`；新建 @ `e6167c45` |
| **Agents** | `ListAgentProfiles` · `Save` / `Delete` / `Reset` | 分组 list + New/Delete/Reset + `AGENTS.md` textarea + Save | 写入口 @ `7f10e65c` / `f49615a1`；`AGENTS.md` @ `9419f583`。profile `model.json` **无**独立编辑器（G-ENG-4） |
| **Rules** | **无** list/CRUD 方法 | `EngineRulesSection`：Global / Project 壳；已连接一律 unsupported 完整态（capability 或「无 API」） | 行数完成线 = 0；不扫 Copilot rules |
| **Hooks** | **无** metadata RPC | `EngineHooksSection`：Definitions / Hook points 壳；已连接一律 unsupported | 不抄 `points.md`、不读 `{AgentHome}/hooks.json` |
| **MCP Servers** | 定义：`List` / `Toggle` / `Add` / `Update` / `Remove`。运行态：`getMcpServerStatuses` / `getMcpServerTools` | Definitions tab + Runtime tab | 定义 CRUD @ `f49615a1`；Runtime @ E2-4 / P1a。不混 vscode `IMcpService` |
| **Plugins** | `listPlugins` · `enablePlugin` · `reloadPlugin` · `unloadPlugin` · `scanNewPlugins` | `EnginePluginsSection`：列表 + 启停/重载/扫描（方法存在且 `canWrite` 才画） | P1a 真探测；**无** Browse Marketplace |
| **Tools** | `ListTools` · `SaveAgentProfile`（`tools.json`） | 目录 + profile 下拉 + 启用 checkbox | profile 启用集 @ `7f10e65c` / `f49615a1` |

单测：`engineCatalogSections.test.ts` · `engineOverviewSection.test.ts` · `enginePreferencesPane.test.ts` · `engineSkillsSection.test.ts` · `engineAgentAgentsMd.test.ts` · `engineToolProfile.test.ts`。

## 4. 仍未落地（本文不得写「已接」）

| 操作 | RPC / 面 | 状态 |
|------|----------|------|
| Provider 凭据 / endpoint / Test | 无（G-ENG-1） | 节内 unsupported；**零**输入控件 |
| Agent profile `model.json` 独立 UI | `SaveAgentProfile` 不承载 | G-ENG-4；不得用自由文本冒充已写入 |
| Rules / Hooks 列表与写 | 引擎补 gRPC 前无 | 壳在、行数恒 0 |
| Composer 下拉 | Route / AgentProfile / Model / Permission / Tools | Engine 页 list **不等于** Composer 已填引擎选项 |
| Plugins marketplace | — | 不做 |
| 产品验证 / 隔离 profile 冒烟 | PRD-025 § / PRD-008 | 未做；不升 `implemented` |

## 5. 九节与差距（代码已落后仍缺的协议）

| 节 | HEAD UI | 仍缺 |
|----|---------|------|
| Overview | 已有；GC-6 Model 计数；Provider 行已隐藏 | 产品验证 |
| Provider & Model | Model 只读注册表；Provider unsupported | G-ENG-1 凭据合同 |
| Skills / Agents / Tools | 已有 list/toggle/写 | Composer 下拉；Agents Model 子 tab 仍 unsupported |
| Rules | unsupported 壳 | G-ENG-2 |
| Hooks | unsupported 壳 | G-ENG-3 |
| MCP Servers | Definitions + Runtime | 无 |
| Plugins | list + 启停/重载/扫描 | marketplace（明确不做） |

**断连语义（与 Navigator 不同）：** Engine catalog 断连即清 RPC 缓存、各节回 disconnected；Navigator 段保留「断开前快照」是会话面合同。

UI 可先交付 unsupported/failed，不等待全部 RPC；没有真实数据与产品验证证据时仍不得升 `implemented`。

## 6. 与 Composer 下拉

`Route` / `AgentProfile` / `Model` / `Permission` / `Tools` 选项在 Composer 仍待 catalog / 策略 RPC 切片；Engine 页 list 与写路径接通 **不等于** Composer 已填引擎选项（见 [engine-protocol-surface §5](../../reference/universe-agent/engine-protocol-surface.md)）。

## 相关

- [engine-protocol-surface](../../reference/universe-agent/engine-protocol-surface.md) · [customizations-engine](../../../dev/plans/customizations-engine.md) · [stub-and-fixtures §6](../conversation/stub-and-fixtures.md)（诚实降级）
