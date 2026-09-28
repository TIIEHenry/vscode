---
title: "UI 设计原则与规范"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-28
summary: "综合 Apple 美学与工程信息密度：以面代线消解 1px 细线牢笼、微间距体系、分层圆角、双轨信噪比与 PC 端零形变触感（治理 UI 错位）规范"
---

# UI 设计原则与规范

> 导航：[横切索引](INDEX.md) · [主题与 token](theming.md) · [布局拓扑](../../systems/workbench/parts-and-grid.md) · [产品愿景](../../product/vision.md)。  
> 适用范围：工作台壳（Workbench Shell）、Conversation Part、Sources Part、Navigator、自定义窗格与卡片布局（`src/vs/sessions/` 及 `src/vs/workbench/contrib/*`）。

---

## 1. 设计哲学：美感与密度的统一

传统 IDE（特别是 VS Code 早期设计）重度依赖 2015 年扁平化时代的**「1px 细线网格思维（The 1px Hairline Grid Cage）」**：以大量高对比度的 1px 实线（`border-right`、`border-bottom`、Sash 分割线、Tab 下划线）来界定空间。这导致屏幕被细铁丝网切割成无数僵硬方块，产生严重的视觉噪音与疲劳感，界面机械且缺乏深度。

本产品的 UI 参照 **Cursor、Zed、IntelliJ IDEA (New UI)** 以及 **Apple 人机界面指南（HIG）**：
- **Apple 美感的核心**：并非低密度的留白，而是 **清晰（Clarity）、内容克制（Deference）、空间层次（Depth）** 与有机的微圆角、材质光感。
- **专业 IDE 的核心**：高信息密度、低跳转成本、舒适的扫读节奏与精准的微间距。
- **设计愿景**：**以面代线、微距透气、圆角收敛、双轨节律、Chrome 隐退**。

---

## 2. 六大核心设计原则

### 原则一：以面代线（Surfaces over Lines）
- **消解 70% 的 1px 硬线条**：区域（Sidebar / Conversation / Sources / Editor）之间禁止默认绘制高对比度 1px 实线边框。
- **背景微阶差（Luminance Steps）**：不同功能分区依靠 2%~4% 的背景色明度差自然下沉或凸显：
  - 侧边与辅助翼（Navigator / Sources）：色调略深、沉潜为基底（如 `--vscode-sideBar-background`）。
  - 中心舞台（Conversation）：主画布明亮平整，拥有主场地位。
  - 浮动卡片与输入容器（Dock / Cards）：轻度提亮，带有极轻的漫反射阴影（`box-shadow: 0 4px 16px var(--vscode-widget-shadow)`）。
- **微光半透明边（Subtle Alpha Borders）**：若因对比度必须有边界（如浮动面板、聚焦输入框），禁止使用实色白/灰线，统一采用低透明度叠加：
  - 深色模式标准描边：`border: 1px solid rgba(255, 255, 255, 0.06)` 或 `color-mix(in srgb, var(--vscode-foreground) 8%, transparent)`。
  - 避免多重边框嵌套（如在外层 Card 有 border 的情况下，内层容器又画一层 1px border）。

### 原则二：消除生硬焦点描边线（No Harsh Focus Outlines）
- **杜绝输入框与面板的刺眼描边**：原生 VS Code 在聚焦态习惯使用 1px/2px 高对比实色高亮蓝框（`outline: 1px solid var(--vscode-focusBorder)`），容易造成界面的机械感与视觉割裂。
- **现代化柔和聚焦反馈**：
  - **输入框与编辑区**：一律设置 `outline: none !important;`，通过微漫反射光晕（`box-shadow: 0 4px 16px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.16))`）配合轻度透明边框（`color-mix(in srgb, var(--vscode-foreground) 20%, transparent)`）表达活跃态，质感贴近 Apple / Zed / Cursor。
  - **工具栏与轻量按钮**：聚焦时不出现描边线，通过平滑的背景高亮（`background-color: var(--vscode-toolbar-hoverBackground)`）提供视觉回馈。
  - **无障碍边界（A11y/High Contrast）**：在高对比模式（`.hc-black`, `.hc-light`）下，显式保留 `outline: 1px solid var(--vscode-contrastActiveBorder)`，确保符合 WCAG 无障碍标准。

### 原则三：微间距体系（Micro-Spacing & Optical Breathability）
高密度不等于无节制的贴边紧挨。界面感觉「挤」通常是因为**元素与边界 0 padding 粘连**。
- **4pt 基准微间距尺度**：
  - `2px` / `4px`：微紧凑级——Icon 与 Label 间隙、Tag/Badge 内边距、极窄列表项。
  - `6px` / `8px`：组件紧凑级——按钮内边距、Tool Call 胶囊折叠头、列表行内间隙。
  - `12px` / `16px`：容器透气级——对话卡片外边距、输入框与四周间隙、弹窗内部留白。
- **密在组件内，留白在组群间**：表格、代码行、文件树内部保持极高密度；组与组、卡片与卡片之间留出 8px~12px 微间距，赋予视觉呼吸感。

### 原则四：分层圆角系统（Continuous Radius Hierarchy）
彻底消除原生 VS Code 随处可见的 `0px` 刀锋直角，建立统一的三级圆角阶梯：
- **Small (`4px ~ 6px`)**：
  - 用于：按钮（Button）、输入框（Input）、状态徽标（Badge）、下拉选项（Dropdown Items）、小标签（Chips）。
- **Medium (`8px ~ 10px`)**：
  - 用于：消息气泡（Chat Turn Bubbles）、Tool Call 执行卡片、代码块容器、Diff 对比块。
- **Large (`12px ~ 16px`)**：
  - 用于：底部悬浮输入框（Composer Dock）、模态面板、Quick Pick 弹窗、History Overlay。
- **Pill (`999px`)**：
  - 用于：会话药丸（Session Pill）、轻量开关胶囊、分支状态指示器。

### 原则五：双轨密度与信噪比治理（Dual Density Rhythm）
- **双轨阅读节奏**：
  - **工程密集区（Tree / Sources / Diff / Editor）**：等宽字体、紧凑行高（`1.35 ~ 1.4`）、单屏高容量。
  - **智能对话区（Conversation / Thinking / Markdown）**：现代无衬线字体（SF Pro / Inter / PingFang SC）、自然行高（`1.5 ~ 1.6`）、良好字间距，确保长文阅读不疲劳。
- **次级信息幽灵化（Progressive Disclosure）**：
  - 辅助操作图标（复制、折叠、删除）、滚动条滑块、Sash 分割线默认低透明度或隐藏；
  - 仅在用户鼠标悬停（Hover）或获得焦点（Focus）时平滑浮现，避免屏幕常态充斥大量干扰元素。

### 原则六：结构外壳隐退（De-emphasize the Chrome）
- **Titlebar 与工作区融为一体**：尽量消除 Titlebar 底部的厚实黑线，使标题区与主体内容自然过渡。
- **Sash（窗格拖拽分割线）无形化**：常态下不绘制实体 1px 细线；Hover 或拖拽时以柔和半透明光条指示热区，不污染常态视线。

### 原则七：PC 桌面端按压零形变与 UI 错位治理（Desktop Tactile & Zero Layout Shift）
- **PC 端交互模型界定**：
  PC 桌面端（Mouse & Keyboard Desktop IDE）依靠高精度鼠标光标点选，与移动端触控屏（Mobile Touch）存在本质差异。触屏因手指肉垫物理遮挡需要局部缩放提供触觉代偿，但在 PC 桌面端，**所有交互项在按压（`:active`）时绝对不需要、且严禁使用任何 `transform: scale(...)` 缩放效果**。
- **治理目标：主要修复 UI 错位视觉问题（Visual Misalignment & Layout Shift）**：
  在 PC 桌面端滥用 `transform: scale` 缩放会直接引发一系列严重的界面错位与视觉抖动缺陷：
  1. **亚像素抖动与文字/图标边缘模糊（Subpixel Blur）**：CSS 缩放会导致浏览器/Electron 合成层发生非整数像素重绘与栅格化漂移，使得图标边缘发虚、文字边缘发毛，破坏高 DPI 屏幕下的精细质感。
  2. **绝对/弹性定位网格脱节与布局错位（Layout Shift & Misalignment）**：在工具栏、导航标签、列表树行等连续排列的元素中，单项缩放会破坏严丝合缝的像素网格对齐，造成视觉重心偏移、相邻边界跳变及微距塌陷（UI 错位）。
  3. **鼠标点击热区脱焦与误触风险（Hitbox Displacement）**：当鼠标在按钮边缘点击时，元素缩小会导致物理包围盒缩入光标内部，触发意外的 `mouseleave` 或双击中断，产生不稳定的操作反馈。
  4. **悬浮气泡与浮动菜单锚点走位（Popup/Anchor Desynchronization）**：依赖触发按钮几何坐标定位的 Hover Widget、ContextMenu 或 QuickPick，在按钮缩放时可能因锚点瞬间位移产生浮层闪烁或错位跳动。
- **PC 端合规触感反馈体系（Compliant Desktop Tactile Feedback）**：
  - **几何绝对静止（Zero Layout Shift / Zero Deformation）**：所有桌面端按钮、图标、选项卡与列表项在 `:active` 态必须保持盒模型稳定，严禁执行 `transform: scale(...)`。若存在继承或既有缩放样式，显式声明 `transform: none !important;`。
  - **明度与背景微阶差（Luminance Feedback）**：
    - 工具栏与轻量图标：`:hover` 使用 `var(--vscode-toolbar-hoverBackground)`，`:active` 使用 `var(--vscode-toolbar-activeBackground)` 或 `color-mix(in srgb, var(--vscode-foreground) 10%~14%, transparent)`。
    - 实体按钮（Monaco Button）：`:active` 采用 `filter: brightness(0.92)` 或加深背景色，呈现自然的按压受力感。
    - 列表项与树行：`:active` 采用轻度背景着色 `var(--vscode-list-activeSelectionBackground)`，禁止缩放整行。
  - **材质与微光反馈（Subtle Depth Feedback）**：主按钮可叠加微弱的内阴影（`box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18)`）或微调透明度（`opacity: 0.88`），传达平整下沉感而不产生空间位移。
  - **清脆瞬时过渡（Snappy Transitions）**：过渡仅针对 `background-color`、`opacity` 与 `box-shadow`（如 `transition: background-color 0.08s ease, opacity 0.08s ease;`），不加入 transform 缓动，确保鼠标点击反馈清脆、敏捷。


---

## 3. 设计 Token 与 CSS 映射约定

| 意图 | 规范 CSS 变量 / 表达式 | 禁止写法 |
|------|------------------------|----------|
| **卡片/面板描边** | `1px solid color-mix(in srgb, var(--vscode-foreground) 8%, transparent)` 或 `var(--vscode-agentsCard-border, transparent)` | `1px solid #333`、高对比度实色灰线 |
| **分割线** | 优先用背景明度阶差；必须有线时用 `1px solid color-mix(in srgb, var(--vscode-foreground) 6%, transparent)` | `1px solid var(--vscode-contrastBorder)`（高对比模式除外） |
| **外层容器圆角** | `border-radius: var(--vscode-cornerRadius-large, 12px)` 或 `8px` | `border-radius: 0px` |
| **小部件圆角** | `border-radius: var(--vscode-cornerRadius-small, 4px)` | `border-radius: 0` |
| **输入框悬浮阴影**| `box-shadow: 0 4px 16px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.16))` | 无阴影全平铺硬框 |
| **Sash 拖拽指示** | 伪元素常态透明，`:hover` 时显示低透明度微光 | 常态常驻 1px 实线 |
| **PC 按压反馈** | `background-color: var(--vscode-toolbar-activeBackground)` 或 `color-mix(in srgb, var(--vscode-foreground) 10%, transparent)`；`transform: none` | `transform: scale(...)`、非等比微缩、空间位移 |

---

## 4. 自定义布局（Custom Layouts）合规与反模式清单

在维护 `src/vs/sessions/`、`src/vs/workbench/parts/*` 及各类自定义视图、卡片时，严格执行以下准则：

### 4.1 违规反模式（Anti-Patterns）
1. ❌ **铁丝网框套框**：父容器带 1px border，子项列表带 1px border，每一行又带 `border-bottom: 1px solid`。
2. ❌ **硬直角机械感**：非全屏铺满的卡片、弹窗或按钮使用 `border-radius: 0`。
3. ❌ **零边距粘连**：文本或小图标直接紧贴外层边框（`padding: 0`），导致视觉窒息。
4. ❌ **常驻高亮割裂线**：用实线深色/浅色细条在面板中央横切或竖切。
5. ❌ **PC 端按压缩放形变与视觉错位**：给桌面端按钮、列表行、操作图标添加 `transform: scale(...)`。PC 端鼠标点选精度高，任何缩放会导致亚像素重绘文字模糊、边界跳变、点击热区边缘抖动以及浮层坐标脱节（UI 错位）。

### 4.2 正确合规写法（Compliant Patterns）
1. ✅ **面分界**：通过给相邻 Part 设置不同浅阶背景色（如 `var(--vscode-sideBar-background)` vs `var(--vscode-editor-background)`），去除中间的 `border-right` 或 `border-left`。
2. ✅ **呼吸内边距**：卡片内部至少保留 `8px` 或 `12px` 的内衬，确保文字边缘与边界有舒适呼吸空间。
3. ✅ **柔和悬浮感**：浮动 Dock、Quick Pick、浮动卡片统一配置 Medium 或 Large 圆角，并辅以柔和阴影。
4. ✅ **幽灵工具栏**：图标按钮平时无背景色、无边框（`border: none; background: transparent;`），Hover 时填充 `var(--vscode-toolbar-hoverBackground)` 与 `border-radius: 4px`。
5. ✅ **PC 端零形变色彩/明度触感**：`:active` 统一通过背景色提亮/加深、微透明度或微内阴影表达点击回馈，严格禁止 `transform: scale`，彻底杜绝 UI 错位与视觉抖动。

---

## 5. 审查与健康检查

所有修改 UI 与布局样式的 PR / 会话必须遵循本规范进行自检：
1. 是否无意中添加了冗余的 1px 实线？
2. 是否保持了 4pt 间距倍数与分层圆角层级？
3. 在深色与浅色主题下是否有良好的视觉阶差而非依赖死板线条？
4. 是否通过 `python3 scripts/check-docs-health.py` 验证文档链条有效性。
