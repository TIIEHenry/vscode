---
title: "Panel 与 Auxiliary Bar"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-31
summary: "PANEL_PART 默认底栏（可左右）与 alignment/maximize；AUXILIARYBAR_PART = Secondary Side Bar；Desktop 不进四钮、INV-052-NO-RIGHT-RAIL 默认关、EH aux 冲突"
---

# Panel 与 Auxiliary Bar

> 导航：[系统索引](INDEX.md)。框架拓扑与显隐总表：[parts-and-grid](parts-and-grid.md)。  
> Desktop 投影：[壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)。EH 落点：[eh-surface-notes](../../reference/code-oss-b2/eh-surface-notes.md)。  
> 实现：`src/vs/workbench/browser/parts/panel/panelPart.ts`（`PanelPart`）· `src/vs/workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts`（`AuxiliaryBarPart`）· `src/vs/workbench/browser/layout.ts`（`setPanelHidden` / `setAuxiliaryBarHidden` / `setPanelAlignment` / maximize）。

本页只写默认 Code 窗口里 **底栏 Panel** 与 **对侧栏 Auxiliary Bar** 的职责、几何和 Desktop/EH 合同。Grid 根拓扑、Part 枚举、以及 **Conversation ↔ Editor 互斥** 见 [parts-and-grid](parts-and-grid.md) §2 / §4，此处不复述。

## 1. `PANEL_PART`：底栏（默认可左右）

`Parts.PANEL_PART`（`workbench.parts.panel`）是 `AbstractPaneCompositePart`，插入面是 `ViewContainerLocation.Panel`。终端、问题、输出等 contrib / 扩展容器挂在这里，**不是** editor tab。

| 项 | 本仓事实 |
|----|----------|
| 默认位置 | `LayoutStateKeys.PANEL_POSITION` 默认 `Position.BOTTOM`；可由 `workbench.panel.defaultLocation` 改 |
| 可搬到 | `setPanelPosition`：`BOTTOM` / `TOP` / `LEFT` / `RIGHT` |
| 首选尺寸 | `PanelPart.preferredHeight` ≈ 主容器高度 40%；竖放时走宽度 |
| 运行时 hidden | `PANEL_HIDDEN`（CSS `LayoutClasses.PANEL_HIDDEN`） |
| 用户面 | `TogglePanelAction`；标题条 composite bar 常开（`CompositeBarPosition.TITLE`） |

水平位置（底/顶）时，中心枝是纵向 `[ ConversationPart, PANEL ]`（或 panel 在上）。`EDITOR_PART` 在 End 列，与 Sidebar / Aux / Activity 同一 middle 水平串。竖放（左/右）时 Panel 与中心枝 / End Editor 变成 **水平邻居**。

## 2. Panel alignment 与 Activity

`PanelAlignment` = `'left' | 'center' | 'right' | 'justify'`（`LayoutStateKeys.PANEL_ALIGNMENT`，默认 `'center'`）。**只对水平 Panel 生效**；竖放时 `setPanelAlignment` 会先把位置打回 `BOTTOM`。

`arrangeMiddleSectionNodes` / `adjustPartPositions` 用 alignment 决定 Sidebar / Aux **是 End Editor 的兄弟**（与 Panel 同宽、不撑满 middle 高）还是 **通高叶**（Panel 只在 Conversation 中心枝底下，侧栏绕开 Panel）：

- `center`：两侧栏都贴 End Editor → Panel 横跨中心 + End 宽度，**不钻到 Activity 底下**。
- `left` / `right` / `justify`：Panel 可伸到某一侧栏底下；Activity 仍是 middleSection **更外层**水平邻居。

这与 [parts-and-grid](parts-and-grid.md) §3、ADR-052「Bottom Panel 不钻 Activity」同几何：Activity 上接 TitleBar、下接 StatusBar；默认底 Panel 与 **Conversation 中心枝** 同枝，不是 Activity 的孩子。

对齐变更会 `setAuxiliaryBarMaximized(false)`——alignment 需要 Editor 可见。

## 3. Maximize

两套 maximize，对象不同：

| API | 效果 | 限制 |
|-----|------|------|
| `toggleMaximizedPanel` / `isPanelMaximized` | 藏 **`CONVERSATION_PART`**（中心叶），Panel 吃掉中心面积；藏 Panel 前会先 unmaximize | 水平 Panel **仅** `alignment === 'center'`；非 center 时 grid **不支持** maximize（`setPanelAlignment` 会先关掉） |
| `setAuxiliaryBarMaximized` / `toggleMaximizedAuxiliaryBar` | 记下 Sidebar / Editor / Panel / Conversation 可见性后全部藏掉，Aux 独占；退出时按记下的状态恢复 | 改 Panel alignment 会强制退出 |

`workbench.panel.opensMaximized`（always / never / remember last）只在「允许 maximize」时生效。

**Conversation ∨ Editor** 不变量（aux maximize 例外）与 `setEditorHidden` / `setConversationHidden` 对称顶开，见 [parts-and-grid](parts-and-grid.md) §4。

## 4. `AUXILIARYBAR_PART` = Secondary Side Bar

产品名是 **Secondary Side Bar**（`toggleSecondarySideBar` / `isSecondarySideBarVisible`），不是「第三 Activity」。`Parts.AUXILIARYBAR_PART`（`workbench.parts.auxiliarybar`）同样是 pane composite，`ViewContainerLocation.AuxiliaryBar`。

- **对侧**：Sidebar 在左则 Aux 在右，反之亦然（`setSideBarPosition` 给 Aux 容器打相反的 `left`/`right` class）。
- **可独立藏**：`setAuxiliaryBarHidden` 不顶开 Editor/Panel（与 Sidebar 同类）；maximize 才会挤掉 Editor。
- **本仓出厂（默认编辑器窗口）**：`workbench.secondarySideBar.defaultVisibility` 出厂 `'hidden'`（`workbench.contribution.ts` + main splash `themeMainServiceImpl.ts`），与 **INV-052-NO-RIGHT-RAIL** 对齐；`AUXILIARYBAR_HIDDEN` 运行时默认亦为 `true`。Copilot `ChatViewContainer` 仍注册在 `AUXILIARYBAR_PART` 作 donor，但 **`isDefault: false`**，不会在工作区首开自动占满右栏。Agents Window 仍用 `agentsWindow: { default: 'visibleInWorkspace', readOnly: true }`，不受产品壳默认影响。
- 尺寸按 Sidebar 量级（最小宽 170）；composite bar 样式跟 `workbench.activityBar.location` 走。

**禁止的偷换：** 把 Aux 当 Conversation。壳映射已标为选项 C：右栏配套，语义反了。

## 5. Desktop 合同：不进四钮、禁右 rail

对照 [desktop-shell-mapping](../../reference/code-oss-b2/desktop-shell-mapping.md) §2–§3：

| Desktop | 本仓 | 合同 |
|---------|------|------|
| Bottom Panel | `PANEL_PART` | **保留**；Diff 深查看按 ADR-047。**不进四钮**（ADR-047 / ADR-052 决策 3）。四钮是 Nav / Conv / Prev / Src，没有 Panel 钮 |
| 右缘 rail | `AUXILIARYBAR_PART` | **INV-052-NO-RIGHT-RAIL → 产品壳默认关**（出厂 `hidden`）。扩展仍可往 Aux 注册；用户或命令显式打开 Chat 时右栏才出现 |

Panel 与四钮正交：用户仍可用 View 菜单 / 快捷键开终端，但不占用 Activity 底栏四钮槽。

## 6. EH：`viewsContainers` aux 冲突

[eh-surface-notes](../../reference/code-oss-b2/eh-surface-notes.md) 贡献点落点：

| 贡献点 | 落到 | 改壳后 |
|--------|------|--------|
| `viewsContainers.panel` / `views`（panel） | `PANEL_PART` | 底栏仍在；顺序/默认开 **有限承诺**（与 ADR-047 Diff 并存） |
| `views`（aux） / 往 AuxiliaryBar 打的容器 | `AUXILIARYBAR_PART` | 产品壳默认关右 rail 时，aux 视图 **无处去或被塞进 Sidebar** → **不承诺** |
| `viewsContainers.activitybar` | Activity + Sidebar | 与四钮抢槽；不是本 Part 的职责，但扩展常成套贡献 |

布局类扩展爱往 Aux 打——这是 EH 矩阵要记的面，不是「关了就等于没冲突」。

## 7. 相关文档

- [parts-and-grid](parts-and-grid.md) — 拓扑、Editor∨Panel 互斥、S1 手术面
- [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md) — 四钮、INV-052-NO-RIGHT-RAIL、禁止 Aux=Conversation
- [eh-surface-notes](../../reference/code-oss-b2/eh-surface-notes.md) — 贡献点 → Part
- `src/vs/workbench/browser/parts/{panel,auxiliarybar}/`
