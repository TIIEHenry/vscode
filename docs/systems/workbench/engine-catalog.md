---
title: "Engine 页 Customizations catalog（ua.engine）"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "M6-C E1 list-only @ HEAD：Skills list/toggle 与 Agents/MCP/Tools List RPC、能力键 agentProfiles/mcp/tools/skills、三节诚实空/UNSUPPORTED；写路径（SaveAgentProfile、MCP CRUD、tools.json）待槽 A"
---

# Engine 页 Customizations catalog（`ua.engine`）

> 宿主与 TOC 见 [Settings UA 接入](../../reference/code-oss-b2/settings-ua-access.md)。权威表与协议缺口见 [customizations-engine](../../../dev/plans/customizations-engine.md)。传输 RPC 登记见 [engine-protocol-surface §1/§7](../../reference/universe-agent/engine-protocol-surface.md)。

Engine Preferences 子页（`EnginePreferencesPane`）承载 Customizations 产品主面。本节只记 **@ HEAD（`ad4be0ea`）已落地的 list/toggle 消费面**；不得把槽 A 未合入的写 RPC / CRUD UI 写成已接通。

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

各 catalog 节共用 `engineCatalog.ts` 的 `EngineCatalogPaneMode`（Skills 经 `engineSkillCatalog.ts` 再导出）：

| 模式 | 条件 | UI |
|------|------|-----|
| `disconnected` | `!isEngineConnected()` | **整节隐藏**（`display: none`）；Engine 页其它非 catalog 分组仍可见 |
| `unsupported` | 已连接且能力 `UNSUPPORTED` | 节标题在；**零假条目**；状态句「当前引擎无 … API」（可带 `reason`） |
| `unknown` | 已连接且能力 `UNKNOWN` | 同左，文案「正在确认引擎能力…」 |
| `supported` | 已连接且能力 `SUPPORTED` | 调 list RPC；传输失败单独句「无法从引擎加载 …」，**不得**当空 catalog |

`catch → emptyList()` **禁止**（customizations-engine §2 / PRD-007）。断连后不得缓存上次 RPC 列表并标「已同步」。

## 3. @ HEAD 已落地（list / toggle）

| 节 | 传输（`platform/universeAgent`） | Engine UI（`contrib/conversation/browser`） | 备注 |
|----|-----------------------------------|---------------------------------------------|------|
| **Skills** | `ListSkills` · `SetSkillEnabled` · `SkillInfo`（正文未在本页切片） | `EngineSkillsSection`：bundled/user/project 分组 + 启用开关；开关旁冻结句（`getSkillToggleFreezeNotice`） | E1 list/toggle @ `8bfc299e` |
| **Agents** | `ListAgentProfiles`（`project_path` 可选） | `EngineAgentsSection`：project/user/built_in 分组，只读列表（name + summary） | list-only @ `4833c008` |
| **MCP Servers** | `ListMcpServers` · `ToggleMcpServer` | `EngineMcpSection`：global/project 分组 + 启用 checkbox | list + toggle；**无** Add/Update/Remove |
| **Tools** | `ListTools` | `EngineToolsSection`：引擎工具目录只读列表（name · category · description） | list-only；**无** profile `tools.json` 编辑 |

单测：`engineCatalogSections.test.ts` · `engineSkillsSection.test.ts`（能力三态与断连路径）。

## 4. 未落地（槽 A 写入路径 — 本文不得写「已接」）

| 操作 | RPC / 面 | 状态 |
|------|----------|------|
| Agent profile 读/写/删 | `SaveAgentProfile` · `DeleteAgentProfile` · `ResetAgentProfile` | 传输 **未**进 `IUniverseAgentConnection`；Engine 页 **无** CRUD |
| MCP 定义 CRUD | `AddMcpServer` · `UpdateMcpServer` · `RemoveMcpServer` | 同上 |
| Profile 工具启用集 | `SaveAgentProfile` → `{profileDir}/tools.json` | 同上；`ListTools` 只是目录，不是开关 |
| Skill 新建 / 正文编辑 | 写盘 + `ListSkills` 刷新或 `SkillInfo` | UI **未**在本 slice |

## 5. 与 Composer 下拉

`Route` / `AgentProfile` / `Model` / `Permission` / `Tools` 选项在 Composer 仍待 catalog / 策略 RPC 切片；Engine 页 list 接通 **不等于** Composer 已填引擎选项（见 [engine-protocol-surface §5](../../reference/universe-agent/engine-protocol-surface.md)）。

## 相关

- [engine-protocol-surface](../../reference/universe-agent/engine-protocol-surface.md) · [customizations-engine](../../../dev/plans/customizations-engine.md) · [stub-and-fixtures §6](../conversation/stub-and-fixtures.md)（诚实降级）
