---
title: "B2 改造前：本仓分析文档缺口"
type: reference
status: accepted
phase: N/A
updated: 2026-08-30
summary: "对照 Desktop B2/S1 spike：首波分层导航不够；必须补 UI 框架、Agent UI 宿主、壳映射与 T1–T3 代码事实"
---

# B2 改造前：本仓分析文档缺口

对照 `code-oss-base-agent-ide.md` + `code-oss-b2-topology-spike.md`。首波 `docs/modules/*` / `docs/systems/*` 只解决「仓库怎么分层」，**不够**做 S1 拓扑手术。

## 1. 方案要求本仓必须能回答的问题

| 问题 | 为何必须 | 首波文档 | 本簇补齐 |
|------|----------|----------|----------|
| 默认窗口 grid 的锚点是不是 `EDITOR_PART`？ | spike T1：非 editor 中心 Part | overview 一笔带过 | [parts-and-grid](../../systems/workbench/parts-and-grid.md) — **M0 已答**：中心 = `CONVERSATION_PART` |
| `EditorPart` 能不能整体隐藏？约束是什么？ | T2；spike 写「传统不可藏」需用代码核验 | 无 | [parts-and-grid](../../systems/workbench/parts-and-grid.md) §显隐 · [T1–T3](spike-t1-t3-code-facts.md) |
| 有没有现成的非 Editor 中心 Part？ | 避免把 Conversation 做成 `ChatEditor`/`EditorInput` | sessions 导航未对照 B2 | [agent-ui](../../systems/chat/agent-ui.md) · [映射](desktop-shell-mapping.md) |
| Chat 有哪些宿主？哪个违反 INV-TOPO？ | 禁止 Conversation = Custom Editor / editor tab | chat overview 列了宿主未标红线 | [agent-ui](../../systems/chat/agent-ui.md) |
| 哪段 UI 绑 Copilot / entitlement？ | INV-NO-COPILOT | 无 | [agent-ui](../../systems/chat/agent-ui.md) §Copilot |
| 四钮 `RegionId` 怎么投影到 Parts？ | INV-052-MAP | 无 | [desktop-shell-mapping](desktop-shell-mapping.md) |
| Activity 通高 / Panel 不钻 Activity 是否已成立？ | ADR-052 几何 | 无 | [parts-and-grid](../../systems/workbench/parts-and-grid.md) §几何 |
| 布局类 EH 贡献点会打在哪几个 Part？ | INV-EH-SURFACE | extension-api 总览 | [eh-surface-notes](eh-surface-notes.md) · [eh-surface-matrix](eh-surface-matrix.md) |
| Agents Window 与默认 Code 窗口是不是两套壳？ | 选错宿主会假通过 | sessions/workbench 分述未对比 | [映射](desktop-shell-mapping.md) §两套窗口 |

## 2. 本仓已有、不要再抄的 SSOT

| 主题 | 权威 | 本簇做法 |
|------|------|----------|
| Sessions 分层/模型 | `src/vs/sessions/*.md` | 只链 |
| Chat 目录地图 | `chatCodeOrganization.md` | 只链 |
| 编码/校验 | `.github/copilot-instructions.md` | 只链 |
| Desktop 产品壳 | UniverseAgentDesktop IA / spec / ADR-052 | 只映射，不改外仓合同 |

## 3. 仍须外仓/spike 交付、不在本簇伪造的

- `eh-surface-matrix.md` 的 **探针实测**（装 2–3 枚扩展）— 本文只有贡献点地图
- 四钮演示录屏、diff footprint、Go/Kill
- UniverseAgent adapter / session-core（spike §4.2 明确不做）
- ADR-003 token 全量迁 workbench CSS

## 4. 结论（改造顺序）

1. **先读** Parts/Grid + 两套窗口差异，再动 `Layout.createGridDescriptor`。
2. **Conversation 宿主**只能是新 Part 或（经论证后）Sessions Part 语义移植；**禁止** `ChatEditor` / `ChatEditorInput` 占中心。
3. **EditorPart 保留**，只挪位；文件 tab 合法（INV-TOPO 禁的是对话变 tab）。
4. Agent **产品面**按 Desktop Conversation 自研接线；本仓 `ChatWidget` 最多当实现 donor，会话真相不得用 `IChatModel`/Copilot entitlement。
