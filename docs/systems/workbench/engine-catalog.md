---
title: "Engine 页 Customizations catalog（ua.engine）"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "M6-C E1 @ HEAD（`9419f583`）：Skills list/toggle；Agents/MCP/Tools List + MCP toggle；Agents Save/Delete/Reset、MCP CRUD、Tools 写路径、AGENTS.md 全文编辑器已落；Skill 正文/新建、MCP 运行态、Plugins 仍待"
---

# Engine 页 Customizations catalog（`ua.engine`）

> 宿主与 TOC 见 [Settings UA 接入](../../reference/code-oss-b2/settings-ua-access.md)。权威表与协议缺口见 [customizations-engine](../../../dev/plans/customizations-engine.md)。传输 RPC 登记见 [engine-protocol-surface §1/§7](../../reference/universe-agent/engine-protocol-surface.md)。

Engine Preferences 子页（`EnginePreferencesPane`）承载 Customizations 产品主面。本节记 **@ HEAD（`9419f583`/`3756d04e`）已落地的 list/toggle、写路径与 Agents `AGENTS.md` 全文编辑器**；不得把未合入的 Skill 正文/新建 UI、MCP 运行态探针或 Plugins 节写成已接通。

## 1. 节与能力键

| Engine 页节 | 能力键 | `IUniverseAgentConnection.getCapabilitySnapshot()` 来源 |
|-------------|--------|-----------------------------------------------------------|
| Skills | `skills` | Connect 广告 + `ToolService.ListSkills` 运行时 probe（`grpcCapabilityProbe.ts`） |
| Agents | `agentProfiles` | Connect 广告 + `AgentService.ListAgentProfiles` probe |
| MCP Servers | `mcp` | Connect 广告 + `McpService.ListMcpServers` probe |
| Tools | `tools` | Connect 广告 + `ToolService.ListTools` probe |
| Rules / Hooks / Plugins | `globalRules` / `projectRules` / `hooksMetadata` / `plugins` | 本 slice **未**接 Engine 页 list；probe 仍 `UNSUPPORTED`（`probe not implemented in M6-A1`） |

`projectRules` · `hooksMetadata` · `plugins` · `globalRules` 仍无 Engine 页 catalog 列表；禁止用 Copilot 盘或 `{AgentHome}` 扫盘顶替。

## 2. 渲染模式（四态）

各 catalog 节共用 `engineCatalog.ts` 的 `EngineCatalogPaneMode`（Skills 经 `engineSkillCatalog.ts` 再导出）。**写入口**（Save/Delete/CRUD、`tools.json` 开关）仅在 `supported` 且 `canPerformCatalogWrite(mode)` 为真时展示；断连 / `UNSUPPORTED` / `UNKNOWN` / 传输失败时 **不得**出现写工具栏或可点写控件。

| 模式 | 条件 | UI |
|------|------|-----|
| `disconnected` | `!isEngineConnected()` | **整节隐藏**（`display: none`）；Engine 页其它非 catalog 分组仍可见 |
| `unsupported` | 已连接且能力 `UNSUPPORTED` | 节标题在；**零假条目**；状态句「当前引擎无 … API」（可带 `reason`） |
| `unknown` | 已连接且能力 `UNKNOWN` | 同左，文案「正在确认引擎能力…」 |
| `supported` | 已连接且能力 `SUPPORTED` | 调 list RPC；传输失败单独句「无法从引擎加载 …」，**不得**当空 catalog |

`catch → emptyList()` **禁止**（customizations-engine §2 / PRD-007）。断连后不得缓存上次 RPC 列表并标「已同步」。

## 3. @ HEAD 已落地（list / toggle / 写）

| 节 | 传输（`platform/universeAgent`） | Engine UI（`contrib/conversation/browser`） | 备注 |
|----|-----------------------------------|---------------------------------------------|------|
| **Skills** | `ListSkills` · `SetSkillEnabled` · `SkillInfo`（正文未在本页切片） | `EngineSkillsSection`：bundled/user/project 分组 + 启用开关；开关旁冻结句（`getSkillToggleFreezeNotice`） | E1 list/toggle @ `8bfc299e` |
| **Agents** | `ListAgentProfiles` · `SaveAgentProfile` · `DeleteAgentProfile` · `ResetAgentProfile` | `EngineAgentsSection`：project/user/built_in 分组列表；`supported` 时写工具栏 **New / Delete / Reset** + 选中 profile **`AGENTS.md` textarea + Save**（`engineAgentAgentsMd.ts`） | list @ `4833c008`；写 RPC + 写入口 @ `7f10e65c` / `f49615a1`；**`AGENTS.md` 全文编辑器** @ `9419f583`/`3756d04e`（断连/`UNSUPPORTED` 不渲染） |
| **MCP Servers** | `ListMcpServers` · `ToggleMcpServer` · `AddMcpServer` · `UpdateMcpServer` · `RemoveMcpServer` | `EngineMcpSection`：global/project 分组 + 启用 checkbox；`supported` 时写工具栏 **Add / Update / Remove** | list + toggle @ `4833c008`；定义 CRUD @ `7f10e65c` / `f49615a1` |
| **Tools** | `ListTools` · `SaveAgentProfile`（profile `tools.json`） | `EngineToolsSection`：`ListTools` 目录 + profile 下拉（user/project，不含 built_in）+ 启用 checkbox；经 `engineToolProfile.ts` 写 `disabledTools` / `enabledTools` | list @ `4833c008`；profile 启用集 @ `7f10e65c` / `f49615a1` |

单测：`engineCatalogSections.test.ts` · `engineAgentAgentsMd.test.ts` · `engineSkillsSection.test.ts` · `engineToolProfile.test.ts`（能力三态、断连路径、AGENTS.md 保存与写 RPC 形状）。

## 4. 未落地（本文不得写「已接」）

| 操作 | RPC / 面 | 状态 |
|------|----------|------|
| Agent profile `tools.json` / `model.json` 独立 UI | `SaveAgentProfile` 附件 | `AGENTS.md` 正文 @ `9419f583` 已落；`tools.json` 经 Tools 节；`model.json` 仍无独立编辑器 |
| MCP **运行态** | `GetMcpServerStatuses` · `GetMcpServerTools` | 不在 Engine 页；后续运行态切片 |
| Skill 新建 / 正文编辑 | 写盘 + `ListSkills` 刷新或 `SkillInfo` | UI **未**在本 slice |
| Rules / Hooks / Plugins Engine 节 | `RulesBridge` · `ListHookPoints` · `PluginService.*` | probe / 列表 **未**接 Engine 页 |
| Composer 下拉 | Route / AgentProfile / Model / Permission / Tools | 仍待 catalog / 策略 RPC 切片 |

## 5. 与 Composer 下拉

`Route` / `AgentProfile` / `Model` / `Permission` / `Tools` 选项在 Composer 仍待 catalog / 策略 RPC 切片；Engine 页 list 与写路径接通 **不等于** Composer 已填引擎选项（见 [engine-protocol-surface §5](../../reference/universe-agent/engine-protocol-surface.md)）。

## 相关

- [engine-protocol-surface](../../reference/universe-agent/engine-protocol-surface.md) · [customizations-engine](../../../dev/plans/customizations-engine.md) · [stub-and-fixtures §6](../conversation/stub-and-fixtures.md)（诚实降级）
