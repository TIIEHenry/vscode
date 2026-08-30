---
title: "主题与 token"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "本仓颜色/尺寸 token 经 IThemeService 落成 --vscode-* CSS 变量；Modern UI 是实验 chrome，B2 spike 不迁 Desktop ADR-003"
---

# 主题与 token

> 导航：[横切索引](INDEX.md)。布局拓扑见 [Parts / Grid](../../systems/workbench/parts-and-grid.md)。  
> 本仓实现：`src/vs/platform/theme/`（`colorRegistry` / `sizeRegistry` / `IThemeService`）· `src/vs/workbench/common/theme.ts`（chrome 色）· `src/vs/workbench/services/themes/browser/workbenchThemeService.ts`。  
> Desktop 合同 **ADR-003** 在外仓，本页只对照，**不抄 px / 不迁 token**。

Workbench 的「看起来像什么」和「格子怎么排」是两条轴。颜色与间距走主题服务；Part 显隐与尺寸走 [layout-state](../../systems/workbench/layout-state.md)。B2 文档壳合同走 Desktop token（ADR-003），不要把本仓实验 chrome 当成那份合同。

## 1. 颜色 token → CSS 变量

标识符在 `registerColor(id, defaults, description)` 登记（`colorUtils.ts`，经 `colorRegistry` 再导出）。`id` 是点号字符串，例如 `tab.activeBackground`、`sideBar.background`。默认值按 `ColorScheme`（light / dark / hcDark / hcLight）给，或引用另一个 token / 变换（`transparent`、`oneOf`）。

`IThemeService`（`themeService.ts`）提供：

| 面 | API |
|----|-----|
| 颜色主题 | `getColorTheme()` → `IColorTheme.getColor(id)`；`onDidColorThemeChange` |
| 文件图标 / 产品图标 | `getFileIconTheme()` / `getProductIconTheme()` 及对应 change 事件 |
| 参与者 | `registerThemingParticipant`：主题切换时往 `ICssStyleCollector` 补规则 |

解析后的色写入 DOM CSS 变量。`asCssVariableName`：**`.` → `-`，前缀 `--vscode-`**。例：`editorSuggestWidget.background` → `--vscode-editorSuggestWidget-background`。组件用 `asCssVariable(id)`（即 `var(--vscode-…)`），不要手写 hex。

落地：`WorkbenchThemeService.updateDynamicCSSRules` 调 `generateColorThemeCSS`（`colorThemeCss.ts`），选择器 `.monaco-workbench`，把 `getColorRegistry()` 里每个已解析色和 `getSizeRegistry()` 里每个尺寸写成变量，再套上 theming participant 规则。

`src/vs/workbench/common/theme.ts` 登记 **chrome** 色（tabs、statusBar、activityBar、panel、sideBar、titleBar 等），不是 Monaco 语法高亮。`WORKBENCH_BACKGROUND` 按 scheme 给硬编码回退，注释标为 not customizable。扩展主题通过同一 registry 覆盖可定制 id。

尺寸 token（`sizeRegistry` / `sizeUtils`）同样映射成 `--vscode-*`（如 `corner.radius` → `--vscode-corner-radius`）。这是 **本仓** 间距/圆角面，与 Desktop ADR-003 不是同一套表。

## 2. Modern UI 是实验 chrome，不是文档壳

`LayoutSettings.MODERN_UI` = `workbench.experimental.modernUI`。打开后 part 走 floating card / margin（`FLOATING_PANEL_MARGIN` 等，实现与 `floatingPanels.css` 对齐）。`IWorkbenchLayoutService.isFloatingPanelsEnabled()` 在 **Agents Window 恒为 false**（该窗自有卡片，禁止套实验 insets）。另有 `MODERN_UI_DENSITY`（`window.density.layout`）和 `MODERN_UI_UPPERCASE_VIEW_HEADERS`。

这只改 **视觉与内容 inset**，不改 `createGridDescriptor` 拓扑，也不等于 Desktop 文档壳。启动 splash（`IPartsSplash.layoutInfo.modernUI`）会记下该实验是否开着，仍是 chrome 提示，不是壳合同。

B2 壳几何走 ADR-052 / IA 映射（[desktop-shell-mapping](../../reference/code-oss-b2/desktop-shell-mapping.md)），不要用 Modern UI 的 card 间距去「近似」文档壳。

## 3. 对 Desktop ADR-003：只对照，spike 不迁

ADR-003 是 **外仓** Desktop 设计 token（色板、间距、字号）。权威在 Desktop 仓；本树 **禁止复制其 px / 色值** 当本仓 SSOT。

[gap-vs-desktop-shell](../../reference/code-oss-b2/gap-vs-desktop-shell.md) 把「ADR-003 token 全量迁 workbench CSS」列为 **仍须外仓/后续交付、本簇不伪造** 的项。B2 spike（T1–T3 拓扑）**不迁移** 本仓 `--vscode-*` 去对齐 ADR-003：新 `ConversationPart` 继续用现有 `registerColor` / CSS 变量即可，壳像素合同另开，不绑在 S1 手术上。

## 4. 相关文档

- [Parts / Grid · Modern UI 段](../../systems/workbench/parts-and-grid.md) · [Layout 状态](../../systems/workbench/layout-state.md)
- [B2 缺口](../../reference/code-oss-b2/gap-vs-desktop-shell.md) · [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)
