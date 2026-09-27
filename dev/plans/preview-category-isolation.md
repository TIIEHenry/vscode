---
title: "Preview 类别隔离与 Surface 宿主：Code | Artifacts | Planning"
type: plan
status: accepted
phase: N/A
updated: 2026-09-27
summary: "PRD-027 实施：Preview 标题栏增加受控类别切换条；底层 EditorGroup 分流隔离；解决 Canvas/Planning 与代码文件混杂的 Tab 混乱；切片 C1–C5"
---

# Preview 类别隔离与 Surface 宿主


> **审查记录（规则 16）**：2026-09-27 完成只读架构审查，针对 Group 显隐机制（复用 `EditorPart.setGroupViewVisible` / `gridWidget.setViewVisible`）、空分类占位（`closeEmptyGroups: false`）、恢复还原以及跨组路由围栏完成核验与吸收，评定为 **Approve with changes** 并改稿入盘。状态升为 `accepted`。

> **决策**：[ADR-009](../decisions/009-preview-category-isolation.md)（`accepted` @2026-09-27）。  
> **需求**：[PRD-027](../../docs/product/requirements.md#prd-027-preview-类别隔离与-surface-宿主)（`proposed`）。  
> **不推翻**：`INV-TOPO`（中心仍是 Conversation）；[ADR-002](../decisions/002-conversation-session-windows.md)；[ADR-005](../decisions/005-changes-diff-owner.md)；`INV-052-NO-DUAL-HIDE`；四钮无 Panel 钮。

## 0. 目标与非目标

**目标**：
在 End 上格 Preview（`Parts.EDITOR_PART`）引入轻量级类别切换控件（`Code` | `Artifacts` | `Planning`），将代码文件、交互制品（Canvas）和规划任务隔离到独立的 EditorGroup 上下文中。确保代码文件的标签栏保持纯净，实现原产品设计「用分类避免混乱」的心智目标。

**非目标**（本方案不做）：
- 在 VS Code 窗口顶层自研全局 AppTabBar。
- 把 Conversation 改造进 Preview 分类中（坚守 `INV-TOPO`）。
- 更改 Sources（End 下格）或底部 Panel 的现有功能定位。
- 在当前切片直接实现 Canvas 渲染引擎本体（Canvas 引擎按独立方案推进，本方案负责其 Surface 宿主与 Tab 隔离）。

## 1. HEAD 事实（实施起点）

| 事实 | 位置 | 说明 |
|------|------|------|
| `MainEditorPart` 绑 `Parts.EDITOR_PART` | `src/vs/workbench/browser/parts/editor/editorPart.ts` | 位于 End 列上格，拥有完整的 `EditorGroupsModel` 与分屏能力 |
| Header 常驻与空占位符 | `src/vs/workbench/test/browser/parts/editor/previewEditorGroupHeader.test.ts` | HEAD 已锁定 Preview 空态时依然保留标题栏与空占位 Tab |
| `EditorTitleControl` / `MultiEditorTabsControl` | `src/vs/workbench/browser/parts/editor/editorTitleControl.ts` | 负责渲染组内 Tab 栏与组动作 |
| 路由与围栏 | `src/vs/workbench/services/editor/common/editorGroupFinder.ts` | 已有 `PreferredGroup` 与 Conversation 围栏机制 |

## 2. 交互与形态设计

### 2.1 Preview 标题栏结构

```text
┌─ Preview ──────────────────────────────────────────────────────────┐
│ [ Code (3) ]   [ Artifacts (1) ]   [ Planning ]        ─  □  ×    │
├────────────────────────────────────────────────────────────────────┤
│ [index.ts]  [utils.ts]  [preview.css]                              │
├────────────────────────────────────────────────────────────────────┤
│ 1  import { ... }                                                  │
│ 2                                                                  │
└────────────────────────────────────────────────────────────────────┘
```

1. **Category Switcher 槽位**：置于 Preview 标题栏最左侧或 Tabs 栏上方（与组标题动作并列，保持原生 VS Code 极简风格）。
2. **分类状态指示**：
   - 激活分类高亮并带有底部指示条；
   - 非空分类显示已打开项数量计数 pill（如 `Code (3)`、`Artifacts (1)`）；
   - 空分类点击可显示优雅的空引导占位。
3. **切换行为**：
   - 单击某一分类，平滑切换到该分类对应的 EditorGroup 集合；
   - 正在编辑的代码文件光标、撤销栈完全保留。

## 3. 技术架构与路由围栏

### 3.1 类别模型与 EditorGroup 显隐机制

1. **类别枚举与映射**：
   ```typescript
   export const enum PreviewCategory {
       Code = "code",
       Artifacts = "artifacts",
       Planning = "planning"
   }
   ```
   `IPreviewCategoryService` 在 `MainEditorPart` 内部维护类别与 EditorGroup 的归属映射：
   `categoryGroupMap: Map<PreviewCategory, Set<GroupIdentifier>>`。

2. **显隐切换与几何管理**：
   - 充分复用 `EditorPart` 既有保护方法 `setGroupViewVisible(groupView: IEditorGroupView, visible: boolean)`（底层直接驱动 `this.gridWidget.setViewVisible`）。
   - 切换分类时：
     1. 将当前分类下的所有已分配 `groupView` 执行 `setGroupViewVisible(g, false)`；
     2. 将目标分类下的 `groupView` 执行 `setGroupViewVisible(g, true)`；
     3. 激活目标分类的主组并获得焦点；
     4. 触发 UI 渲染与重排，无缝切换且零 DOM 销毁。

3. **空分类保护与占位符**：
   - 为各分类创建的根组配置 `closeEmptyGroups: false`，避免类别下无文件时 EditorGroup 被 VS Code 默认逻辑销毁。
   - 空分类激活时，复用 HEAD 已验证的空占位 Tab（`renderEmptyPlaceholderTab`）与优雅引导，不破裂布局。

### 3.2 输入路由围栏（Routing Fences）与 PreferredGroup

扩展 `editorGroupFinder.ts` 与 `IEditorResolverService`：
1. **类型白名单与分流**：
   - 普通代码与文本文件（`file://`、`untitled://`、`vscode-diff://` 等）定向至 `PreviewCategory.Code` 的当前活动组；
   - 具备 `isArtifactInput = true`（或 `canvas://`）的输入定向至 `PreviewCategory.Artifacts` 组，并自动触发分类切换至 `Artifacts`；
   - 规划任务类输入定向至 `PreviewCategory.Planning` 组。
2. **防污染防御**：
   - 若用户当前处于 `Artifacts` 分类，但触发了外部文件打开（如时间线点击代码引用），系统将文件分配给 `Code` 组，并在分类栏 `Code` 标签上显示微提示点，不破坏当前用户的制品阅读心智。

## 4. 切片计划（C1–C5）

| 切片 | 职责 | 产出物 | 门禁 |
|:-----|:-----|:-------|:-----|
| **C1** | 类别数据模型与服务定义 | `IPreviewCategoryService`、分类枚举、事件与持久化状态 | 单测：分类切换、状态保持 |
| **C2** | Preview 标题栏切换控件 UI | `PreviewCategorySwitcher` 组件，挂入 `EditorTitleControl` | 单测 + 像素断言 |
| **C3** | EditorGroup 映射与组可见性管理 | 实现类别与 EditorGroup 的多组隔离切换 | 组拆分/合并/切换无泄漏 |
| **C4** | 路由围栏与 PreferredGroup 扩展 | 拦截非法跨类输入，实现自动分类路由 | 围栏单测覆盖 |
| **C5** | 集成验证与冒烟测试 | 端到端验证多分类并存、重启恢复与无障碍键盘可达性 | 完整 test-suite PASS |

## 5. 验收标准与测试矩阵

1. **分类隔离验证**：打开 3 个代码文件和 1 个模拟 Artifact，验证切换分类时各自 Tab 栏完全独立，互不显示对方的 Tab。
2. **状态保全验证**：在 `Code` 组编辑文本（保留脏态），切到 `Artifacts` 后再切回，光标位置、选中区域与未保存内容完好无损。
3. **四钮一致性**：点击 titlebar 的 Preview 按钮隐藏 Preview，再重新展开，当前选中的类别与活跃文件状态正确还原。
4. **INV-TOPO 坚守**：断言 Preview 的任何分类都不会被 ChatEditorInput 或 Conversation 输入侵占。
