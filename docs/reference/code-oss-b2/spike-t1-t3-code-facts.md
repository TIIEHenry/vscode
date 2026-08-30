---
title: "B2 Spike T1–T3：对照本仓代码的事实"
type: reference
status: accepted
phase: N/A
updated: 2026-08-30
summary: "S1 三个硬测试点：M0 已在默认 Layout 落地 Conversation 中心叶 + Editor End 列 + Conversation∨Editor 互斥；Sources/四钮仍缺"
---

# Spike T1–T3：代码事实

spike 原文：`code-oss-b2-topology-spike.md` §3.3。本页 **不**代替 Go/Kill，只写当前树能观察到的事实。

## T1 — grid 接受非 editor 的中心 Part

| 窗口 | 事实 | 结论 |
|------|------|------|
| 默认 `Layout.createGridDescriptor` | 中心叶为 `Parts.CONVERSATION_PART`；`EDITOR_PART` 在 End 列 | **M0 已落地** |
| Agents Window | `SESSIONS_PART` 已是非 editor 中心；叶不是 editor group | 样例仍有效；默认窗口未 import sessions |
| `Parts` 枚举 | 已有 `CONVERSATION_PART` | 默认窗口 `createGridDescriptor` 已编入 |

**Kill-driver 收窄：** 难的不是 Grid 类，是默认 `Layout` 里数十处「中间 = editor」的 focus / neighbor / maximize / 序列化。样例代码在 `src/vs/sessions/browser/`（`sessionsPart.ts`、sessions 自己的 layout host），不能直接 import 进 workbench（反向分层禁止）。

S1 最小证明：默认 Code 窗口启动后，中心 DOM 对应新 Part，文件仍走 `IEditorService.openEditor` 出现在 **End 列 tabs**，且 URI 不是 `ChatEditorInput`。

## T2 — `EditorPart` 可整体隐藏

| 来源 | 事实 |
|------|------|
| `Layout.setEditorHidden` | **已实现**；`EDITOR_HIDDEN` + `setViewVisible(editorPartView, false)` |
| 约束 | 隐藏 editor 且 Conversation 不可见且 aux 未 maximize → **强制显示 Conversation**（不再弹出 Panel） |
| Zen Mode | 仍不藏 Conversation；产品语义待后续 |
| Sessions LAYOUT | Editor **可独立于** Sessions Part 隐藏 |

**结论：** T2 在 API 上 **不是从零**。默认窗口的风险是 **互斥对象错了**（绑 Panel 而非 Conversation/Sources）。四钮「只关 Preview、Sources 也关、Conversation 开」时，现逻辑会把 Panel 顶出来——演示会脏。S1 要改互斥或保证 End 下格 Part 计入「workbench 可见」。

## T3 — 中心 Part 可隐藏 + NO-DUAL-HIDE

| 来源 | 事实 |
|------|------|
| 默认窗口 | `ConversationPart` + `setConversationHidden`；命令 `workbench.action.toggleConversation` |
| `SessionsPart` | 自有 `_visible` / grid；LAYOUT 写明 Sessions 与 Editor 可独立显隐 |
| `INV-052-NO-DUAL-HIDE` | Desktop：Conversation ∨ Workbench ≥ 1 |
| 本仓默认 | Conversation ∨ Editor ≥ 1 |

**结论：** T3 公式已改绑。Panel 最大化改为藏 Conversation（中心叶），不再藏 Editor。四钮 chrome 尚未接入 titlebar；Sources 下格 Part **slot A 实现中**（HEAD `fc6089a3` 无）。

## M0 剩余（代码 + 验证）

| 项 | HEAD `fc6089a3` | 负责 |
|----|-----------------|------|
| Sources 占位 Part（End 下格） | 未合入 | slot A |
| titlebar layout controls 四钮 | 未合入 | slot A |
| 编译 / 启动 T1–T3 演示 | **未跑** | merge 后 |
| EH 探针冒烟 | **未跑** | merge 后；矩阵见 [eh-surface-matrix](eh-surface-matrix.md) |

## 建议的 spike 验证顺序（与代码硬度一致）

**代码面（T1–T3 拓扑）已在 `fc6089a3` 落地**；下列为 **验证** 顺序，本轮 defer：

1. ~~在隔离 fork 改 `createGridDescriptor`~~ — **已做**（Conversation 中心 + Editor End）。
2. ~~接 `setPartHidden` + Conversation∨Editor 互斥~~ — **已做**。
3. **待做**：Sources 占位 Part（slot A）+ titlebar 四钮（slot A）。
4. **待验证**：Preview 单独关、Conversation 单独关（启动演示；compile 未跑）。
5. EH 冒烟放在拓扑 + Sources/四钮稳定之后（[eh-surface-matrix](eh-surface-matrix.md)，全部待实测）。

## 相关文档

- [parts-and-grid](../../systems/workbench/parts-and-grid.md)
- [desktop-shell-mapping](desktop-shell-mapping.md) · [diff-footprint](diff-footprint.md)
