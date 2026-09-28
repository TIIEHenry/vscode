---
title: "主题与 token"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-28
summary: "本仓颜色/尺寸 token 经 IThemeService 落成 --vscode-* CSS 变量；尺寸以 baseSizes.ts 为唯一来源；产品默认主题目标为自有浅/深两套、默认浅色（PRD-028），HEAD 仍是上游 Light/Dark 2026；Modern UI 是实验 chrome，B2 spike 不迁 Desktop ADR-003"
---

# 主题与 token

> 导航：[横切索引](INDEX.md)。布局拓扑见 [Parts / Grid](../../systems/workbench/parts-and-grid.md)。token 的设计用途与密度规则见 [UI 设计原则与规范](ui-design-principles.md)。  
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

尺寸 token 在 `src/vs/platform/theme/common/sizes/baseSizes.ts` 登记（`sizeRegistry` / `sizeUtils`）：字号 `fontSize.*`、字重 `fontWeight.*`、图标 `codiconFontSize*`、圆角 `cornerRadius.*`、间距 `spacing.size*`、描边 `strokeThickness`。它们同样映射成 `--vscode-*`（如 `cornerRadius.large` → `--vscode-cornerRadius-large`），是本仓唯一的尺寸来源；各档位用途见 [UI 设计原则 §3](ui-design-principles.md)。这是 **本仓** 间距/圆角面，与 Desktop ADR-003 不是同一套表。

## 2. Modern UI 是实验 chrome，不是文档壳

`LayoutSettings.MODERN_UI` = `workbench.experimental.modernUI`。打开后 part 走 floating card / margin（`FLOATING_PANEL_MARGIN` 等，实现与 `floatingPanels.css` 对齐）。`IWorkbenchLayoutService.isFloatingPanelsEnabled()` 在 **Agents Window 恒为 false**（该窗自有卡片，禁止套实验 insets）。另有 `MODERN_UI_DENSITY`（`window.density.layout`）和 `MODERN_UI_UPPERCASE_VIEW_HEADERS`。

这只改 **视觉与内容 inset**，不改 `createGridDescriptor` 拓扑，也不等于 Desktop 文档壳。启动 splash（`IPartsSplash.layoutInfo.modernUI`）会记下该实验是否开着，仍是 chrome 提示，不是壳合同。

B2 壳几何走 ADR-052 / IA 映射（[desktop-shell-mapping](../../reference/code-oss-b2/desktop-shell-mapping.md)），不要用 Modern UI 的 card 间距去「近似」文档壳。

## 3. 产品默认主题

**目标**（[PRD-028](../../product/requirements.md#prd-028-视觉语言与信息密度) 验收 1，`accepted`）：产品自带一对浅色 / 深色 color theme，**默认浅色**。配色要求见 [UI 设计原则](ui-design-principles.md) 原则一与 §3.2。

**HEAD**：`workbench.colorTheme` 默认是 `ThemeSettingDefaults.COLOR_THEME_LIGHT`，即上游 `Light 2026`（`themeConfiguration.ts`；主题文件 `extensions/theme-defaults/themes/2026-light.json`，`include` 了 `light_modern.json`）；系统深色偏好默认 `Dark 2026`。产品自有主题未做。`Light 2026` 与 PRD-028 的差距：灰阶带冷色偏（`sideBar.background` `#F3F3F6`、`panel.background` `#FAFAFD`、`widget.border` `#E2E2E5`），用户气泡 `chat.requestBubbleBackground` 是蓝调 `#EEF4FB`，`badge.background` 是实心蓝 `#0069CC`。`Dark 2026` 的灰阶已基本中性。

**落地约束**（具体做法由 PRD-028 的实施方案决定）：

- 配色进主题文件，不进组件 CSS。区域阶差、描边、选中态、徽标、按钮、用户气泡都由主题里的 color id 决定，组件只写 `var(--vscode-…)`。
- 建议以 `Light 2026` / `Dark 2026` 为基底（`include`），只覆盖与 PRD-028 冲突的 id，便于跟随上游更新。
- 主题名遵守 [PRD-010](../../product/requirements.md#prd-010-产品身份) 的产品身份；不复制其他产品的主题命名与色板（[vision](../../product/vision.md) 原则 4）。
- 高对比主题沿用上游 `Default High Contrast` / `Default High Contrast Light`。

## 4. 对 Desktop ADR-003：只对照，spike 不迁

ADR-003 是 **外仓** Desktop 设计 token（色板、间距、字号）。权威在 Desktop 仓；本树 **禁止复制其 px / 色值** 当本仓 SSOT。

[gap-vs-desktop-shell](../../reference/code-oss-b2/gap-vs-desktop-shell.md) 把「ADR-003 token 全量迁 workbench CSS」列为 **仍须外仓/后续交付、本簇不伪造** 的项。B2 spike（T1–T3 拓扑）**不迁移** 本仓 `--vscode-*` 去对齐 ADR-003：新 `ConversationPart` 继续用现有 `registerColor` / CSS 变量即可，壳像素合同另开，不绑在 S1 手术上。

## 5. 相关文档

- [UI 设计原则与规范](ui-design-principles.md) · 需求 [PRD-028](../../product/requirements.md#prd-028-视觉语言与信息密度)
- [Parts / Grid · Modern UI 段](../../systems/workbench/parts-and-grid.md) · [Layout 状态](../../systems/workbench/layout-state.md)
- [B2 缺口](../../reference/code-oss-b2/gap-vs-desktop-shell.md) · [壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)
