---
title: "M0 拓扑手术：默认编辑器窗口壳"
type: plan
status: in_progress
phase: M0
updated: 2026-08-30
summary: "默认 workbench 窗口：ConversationPart 占中心、EditorPart 挪 End 列；T1–T3 验收；四钮宿主在 titlebar layout controls"
---

# M0 拓扑手术

> **决策依据**：外仓 [ADR-061](https://github.com/TIIEHenry/UniverseAgentDesktop/blob/main/dev/decisions/061-code-oss-base-and-editor-window-shell.md)（`accepted`）。  
> **代码事实**：[spike-t1-t3-code-facts.md](../../docs/reference/code-oss-b2/spike-t1-t3-code-facts.md) · [desktop-shell-mapping.md](../../docs/reference/code-oss-b2/desktop-shell-mapping.md)  
> **分支**：`agent-ide`（本 fork）

## 目标

在**默认编辑器窗口**（`workbench.desktop.main`）完成 S1 拓扑手术，使布局与 Desktop 壳合同对齐；`vs/sessions`（Agents Window）仅作 donor，不作产品壳入口。

### 目标布局

```text
┌──────────┬──────────┬─────────────────────────┬──────────────────┐
│ Activity │ Sidebar  │   ConversationPart      │  EditorPart      │
│  (通高)  │ (Nav)    │   (中心，非 EditorInput)│  (End 上格)      │
│          │          │                         ├──────────────────┤
│          │          │                         │  Sources 占位    │
│          │          │                         │  (End 下格)      │
├──────────┴──────────┴─────────────────────────┴──────────────────┤
│ Panel（Bottom）                                                    │
├────────────────────────────────────────────────────────────────────┤
│ StatusBar                                                          │
└────────────────────────────────────────────────────────────────────┘
```

- **中心**：新建 `ConversationPart`（非 `EditorInput` / Custom Editor / EditorGroup tab）。
- **End 列**：现有 `EditorPart` 整体上移；下格为 Sources **占位** Part（无真实语义）。
- **保留**：Activity、Sidebar、Panel、StatusBar、原生 titlebar。
- **四钮宿主**：titlebar 右上 layout controls 位（`workbench.layoutControl.*` 同族），非 Activity 底四钮。

## T1–T3 验收标准

替代原 spike Go/Kill 门闸；三项全部通过即 M0 完成。

### T1 — Grid 接受非 editor 的中心 Part

| 条件 | 说明 |
|------|------|
| 中心叶 | 默认 `Layout.createGridDescriptor` 中心叶为 `ConversationPart`，不再是 `EDITOR_PART` |
| Editor 位置 | `EditorPart` 叶位于 End 列；文件仍经 `IEditorService.openEditor` 打开，tabs 出现在 End 列 |
| 非 Chat 偷换 | 中心 DOM 对应新 Part；打开的 URI **不是** `ChatEditorInput` |
| 存在性参照 | Agents Window 已证 `SerializableGrid` + 自定义 Part 可作中心；S1 须在默认 `Layout` 内复现 |

### T2 — `EditorPart` 可整体隐藏

| 条件 | 说明 |
|------|------|
| API | `Layout.setEditorHidden` 对 End 列 `EditorPart` 生效 |
| 单独关闭 Preview | 四钮「只关 Preview、Sources 也关、Conversation 开」时，**不**被强制弹出 Panel |
| 互斥修正 | 原 editor↔panel 互斥（藏 editor 且 panel/aux 不可见 → 强制开 Panel）须改绑；End 列 Part 计入 workbench 可见性 |

### T3 — 中心 Part 可隐藏 + NO-DUAL-HIDE

| 条件 | 说明 |
|------|------|
| Conversation 显隐 | 新 Part 支持 `setPartHidden`；可独立于 Editor 隐藏 |
| NO-DUAL-HIDE | **Conversation ∨ Editor（End 列）至少一个可见**（延续 INV-052-NO-DUAL-HIDE；Workbench = Preview∨Sources） |
| 无脏状态 | 禁止「Conversation 关、Preview 关、只剩被强制打开的终端 Panel」 |

## 实施顺序

与 [spike-t1-t3-code-facts.md §建议验证顺序](../../docs/reference/code-oss-b2/spike-t1-t3-code-facts.md) 一致：

1. **T1 拓扑** — 改 `createGridDescriptor` / `arrangeMiddleSectionNodes`：中心叶换 `ConversationPart`，`EditorPart` 挪 End；先不接四钮。
2. **T3 互斥** — 为新 Part 接 `setPartHidden`；将 editor↔panel 互斥改为 **Conversation ∨ End** 公式。
3. **T2 / T3 演示** — 验证 Preview 单独关、Conversation 单独关；确认 NO-DUAL-HIDE。
4. **EH 冒烟** — 拓扑稳定后再做 Extension Host 表面分级冒烟（便宜活，不阻塞 T1–T3）。

> 另一代理正在改 `src/vs/workbench`；本方案与实施 commit 分离，行动层先行。

## 不做范围（M0）

| 排除项 | 说明 |
|--------|------|
| 引擎迁移 | 不接 UniverseAgent 引擎、gRPC、adapter |
| 会话权威 | Desktop 会话真相仍在外仓；本里程碑只做壳拓扑 |
| Sources 真实语义 | End 下格仅占位；不实现 ADR-051 展开语义 |
| `vs/sessions` 改动 | Agents Window 只读参照；禁止把它当产品壳或反向 import |
| 四钮 UI 完整产品化 | M0 可先证显隐 API；titlebar layout controls 扩展可后切片 |
| Copilot / entitlement | 遵循 INV-NO-COPILOT |

## 验证方式

| 阶段 | 命令 / 动作 | M0 状态 |
|------|-------------|---------|
| 编译 | `npm run compile`（或 fork 等价 compile 目标） | **deferred** — 本轮未跑 |
| 分层 | `npm run valid-layers-check` | **deferred** — 拓扑 PR 合入后 |
| 启动演示 | 默认窗口启动后目视确认布局与 T1–T3 | **deferred** — 待 Sources/四钮 + compile 后补 |
| EH 冒烟 | 装扩展探针；更新 [eh-surface-matrix](../../docs/reference/code-oss-b2/eh-surface-matrix.md) | **deferred** — 无探针本轮 |
| 文档 | `python3 scripts/check-docs-health.py` → 0 error | slot B 本 pass |

### 验收勾选（勿提前通过）

- [ ] **编译** — `npm run compile` 绿
- [ ] **启动 T1–T3** — 中心 Conversation、End Editor tabs、互斥无脏 Panel
- [ ] **EH 探针** — 至少 layout 类 + LSP 类各一（矩阵「待实测」→「已实测」）
- [x] **T1–T3 代码拓扑** — `fc6089a3`：Conversation 中心 + Editor End + `Conversation∨Editor`（**未** 含 Sources/四钮）
- [ ] **Sources + 四钮** — slot A 合入后勾选

> `status: in_progress` — fable review 与 merge 集成在后续；本计划 **不得** 在此标 `done`/`completed`。

## 相关文档

- [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md)
- [desktop-shell-mapping](../../docs/reference/code-oss-b2/desktop-shell-mapping.md)
- [spike-t1-t3-code-facts](../../docs/reference/code-oss-b2/spike-t1-t3-code-facts.md)
- 外仓 ADR-061（只读决策 SSOT）
