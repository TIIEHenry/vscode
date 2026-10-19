---
title: "UI 设计原则与规范"
type: architecture
status: accepted
phase: N/A
updated: 2026-10-20
summary: "视觉语言参考 Cursor / ChatGPT、信息密度参考 IntelliJ IDEA（PRD-028）：中性底色与强调色约束、排版分层、平台 token 为唯一尺寸来源、密度上限、焦点可见、以面代线、阴影只给浮层（Composer 极淡投影例外）且不用毛玻璃、2026-10-11 用户回合改 Cursor 式卡、主按钮中性近黑、弹出层 / 按钮层级 / 筛选条 / 文档预览 / 目录列表分组规范、行内与工具栏操作以幽灵图标钮为先、错误与会话不可用态（方案仍 draft，S1–S4 已落地）、PC 按压零形变、两级空态；对话阅读面与工程表格组件规范；Agents 窗口追问卡、对话框遮罩和引导页遮罩已去掉毛玻璃，§10 其余差距仍在；2026-10-15 外部密度对照不改本节"
---

# UI 设计原则与规范

> 导航：[横切索引](INDEX.md) · [主题与 token](theming.md) · [布局拓扑](../../systems/workbench/parts-and-grid.md) · [产品愿景](../../product/vision.md) 原则 4、6 · 需求 [PRD-028](../../product/requirements.md#prd-028-视觉语言与信息密度)（`accepted`） · 外部对照：[对话界面密度](../../reference/external-chat-ui-density.md)（不改本节）。  
> 适用范围：工作台壳、Conversation、Sources、Navigator、Preview 类别条、Engine / Connection 首选项，以及 `src/vs/sessions/`、`src/vs/workbench/contrib/*` 下的自定义视图与卡片。上游组件（Monaco 编辑器、设置编辑器、扩展视图等）只在产品主题与 token 层对齐，见 §9。  
> 2026-09-28 按用户选定的方向改写（默认浅色；生成中的 Stop 留在 Inbox 右簇），同日随 PRD-028 由用户签收。

---

## 1. 设计方向

| 参照 | 取什么 | 不取什么 |
|------|--------|----------|
| Cursor / ChatGPT | 中性灰阶、克制用色、靠排版分层、chrome 退后、对话正文好读、次要操作悬停才出现 | 商标、图标、像素级外观 |
| IntelliJ IDEA | 紧凑行高、元信息常显、表格化的工程视图、键盘优先、焦点清晰、空态一行字 | 竖排工具窗文字、专有图标 |

- **两轨密度**：对话区像 ChatGPT 一样好读，但更紧凑（正文 13px、行高 1.5）；工程区（树、表格、Diff、编辑器、轨迹、Sources）按 IDEA 密度。
- **明确不用**：毛玻璃、营销式卡片栅格、大面积强调色、全大写标签、装饰性大插图、按压缩放。
- **外部对照**：2026-10-15 对 Cursor、ChatGPT、Claude 的取样见 [外部对话界面密度对照](../../reference/external-chat-ui-density.md)。那一页只记录哪些结构收得进本节的密度上限，2026-10-16 用户签收为只读记录，不改本节，也不改 PRD-028。

---

## 2. 原则

### 原则一：中性底色，强调色克制

- 底色是中性灰阶，不带明显冷暖色偏。区域之间靠 2%–4% 的明度差分层：侧栏与配套区一档，中心 Conversation 主画布一档，画布上的输入类卡片（Composer、用户回合卡）比画布再亮一档，浮层再一档。色值写在产品主题里（[theming §3](theming.md)），组件 CSS 只引用 `--vscode-*`。
- 强调色（`focusBorder`、`textLink.foreground`、`progressBar.background`）只用于：键盘焦点、选中态、链接、进行中指示。
- 主按钮（`button.background`）是中性近黑实心，深色主题近白，一个视图内至多一个（2026-10-11 用户选定，与发送钮同一观感）。按钮层级见 §5.6。
- 语义色（错误 / 警告 / 成功）只落在状态本身：图标、文字或细描边，不做大面积底色。
- 徽标与标签用弱化文字色，必要时加 10%–14% 淡底，不用实心强调色填充。上游计数徽标（`badge.*`、`activityBarBadge.*` 等）保留实心样式，由产品主题改为中性或低饱和色。
- 用户回合卡用输入框底色加低对比描边（§3.2），不用强调色。
- 次按钮、芯片、下拉默认幽灵样式：常态无底无框，悬停出 `toolbar.hoverBackground`。例外是分组头上至多一个次按钮，以及筛选芯片的未选态，这两处可以是低对比描边（§5.6、§5.7，2026-10-11 用户选定）。它们不是无数据的状态芯片（反模式 9）。
- 行内与工具栏操作优先用幽灵图标钮：一个动作一个图标，可见文字留在 tooltip 与 aria 名称上（§5.6，2026-10-19）。
- `color-mix` 只用来从已有 token 派生透明度层级；禁止写死 hex。

### 原则二：以排版分层，不以框分层

- 层级手段的优先顺序：字重，颜色（`foreground` / `descriptionForeground` / `disabledForeground`），间距，背景明度差，最后才是描边。前一种能解决就不用后一种。
- 字号只用平台字号 token（§3.1），一个区域内不超过三档；禁止写死 px 与半像素字号（如 9.5 / 11.5 / 12.5px）。字重只用 400 与 600。
- 产品自有表面不用全大写：视图标题、表头、区段标题、角色标签用正常大小写（英文用 Title Case 或 Sentence case）。上游视图头的大写沿用上游，暂不改。
- 字体：UI 用 `var(--vscode-font-family)`（系统字体栈，含中文回退）；代码与数字列用 `var(--monaco-monospace-font)`。不指定 SF Pro、Inter 等不保证存在的字体。
- 行高：工程区 1.35–1.4；对话正文 1.5（`compact` 1.35）。

### 原则三：IDE 级密度

- 密度上限见 §4。上限的意思是"不得更松"，不是"必须等于"。
- 密在组件内，留白在组群间：行内 2–6px，组与组之间 8–12px；列表行之间不加卡片间距。
- 元信息常显但降噪：时间、计数、增删行数、状态等数据常显，用 11–12px 弱化色；复制、重试、删除等操作在悬停或焦点时出现。
- 需要第二行信息时，优先放在同一行右侧作弱化元信息，而不是把行加高。
- 截断：标题与路径可以省略并配 tooltip；主操作按钮文字不截断，放不下时退化为图标加 tooltip。
- 状态芯片：无数据时优先省略；已接受需求要求常驻的控件（如 Inbox 的 Stop、Goal）以禁用态弱化显示，不画描边框。
- 对齐：图标、计数徽标与文字混排时用 `display: inline-flex; align-items: center` 对齐中心线；按钮、标签、图标项用 `box-sizing: border-box`，避免 padding 与固定宽高叠加把相邻元素顶开。

### 原则四：焦点始终可见

- 键盘焦点：`:focus-visible` 显示 1px `--vscode-focusBorder` 焦点环（`outline-offset` 按控件取 -1px 或 1px）。鼠标点击可以不显示。
- 输入框：聚焦时描边换成 `--vscode-focusBorder`（可降到 60% 透明度），不用大阴影表达聚焦。Composer 卡片是例外：发丝线不动，只把已有投影略加深；高对比主题仍用对比描边。
- 列表、树、表格：选中态分两种，有焦点用 `list.activeSelectionBackground`，无焦点用 `list.inactiveSelectionBackground`；键盘焦点行沿用上游 `list.focusOutline`。
- 非高对比主题下，禁止写 `outline: none` 而不给替代焦点样式。高对比主题保留 `contrastActiveBorder` / `contrastBorder`；浮层（菜单、对话框、通知、下拉、重命名框）补齐 `:is(.hc-black, .hc-light)` 边框。

### 原则五：以面代线

- 区域之间优先用背景明度差，不画高对比 1px 实线；确需分隔时用低对比描边（§3.2）。
- 不套框：外层已有描边，内层不再描边；列表行之间不画分隔线。表格行可用极淡分隔线或斑马纹，二选一。
- Sash 常态不可见，悬停或拖拽时显示淡色指示；标题栏与内容之间不加粗线。

### 原则六：阴影只给浮层，不用毛玻璃

- 阴影（`--vscode-widget-shadow`）只用于浮层：菜单、悬浮提示、快速选择、下拉、通知、对话框。文档流里的卡片（时间线卡片、用户回合卡、权限座位、空态、设置卡）不投影。Conversation Composer 是唯一例外：低对比描边加极淡投影，高对比主题不投影（PRD-028 验收 7，2026-10-11 用户选定）。
- 禁止 `backdrop-filter`（毛玻璃）；模态遮罩只用半透明底色，不做模糊。
- 圆角按 token 分档（§3.1），不再使用 10 / 14 / 16px 等表外值。

### 原则七：PC 按压零形变

- 按压（`:active`）不用 `transform: scale` 或位移；浮层开合不用缩放缓动，只用透明度，必要时加不超过 4px 的平移。
- 反馈只换颜色：图标按钮用 `toolbar.hoverBackground` / `toolbar.activeBackground`；实体按钮用 `button.hoverBackground` 或由它派生的更深一档。不用 `filter`，它会让元素单独合成图层，可能引起文字发虚。
- 过渡只作用于 `background-color`、`color`、`border-color`、`opacity`，时长不超过 100ms；`.monaco-reduce-motion` 下去掉过渡。
- 原因：桌面端的缩放会造成亚像素发虚、相邻元素错位、点击热区缩到光标内侧、依赖锚点的浮层漂移。截至 2026-09-28，`:active` 缩放已在全仓清零（[status](../../../dev/progress/status.md) 第 67–87 项）。

---

## 3. Token（唯一尺寸来源）

平台在 `src/vs/platform/theme/common/sizes/baseSizes.ts` 登记尺寸 token；CSS 变量名是 `--vscode-` 加上点号换成横杠的 id（`fontSize.body1` 即 `--vscode-fontSize-body1`）。机制见 [theming §1](theming.md)。组件 CSS 写 `var(--vscode-…, 回退值)`，回退值与下表一致。

### 3.1 尺寸

| 类别 | token | 值 | 用途 |
|------|-------|----|------|
| 字号 | `fontSize.body1` | 13px | 正文、UI 默认、对话正文、输入框 |
| | `fontSize.label1` | 12px | 次级文字、表格单元、tab、区段标题 |
| | `fontSize.label2` / `fontSize.body2` | 11px | 元信息（时间、计数、增删行数）、表头、徽标文字 |
| | `fontSize.label3` | 10px | 仅计数徽标 |
| | `fontSize.heading3` / `fontSize.heading2` | 13 / 18px | 区段标题 / 页面标题（少用），配 600 |
| 字重 | `fontWeight.regular` / `fontWeight.semiBold` | 400 / 600 | 只用这两档 |
| 图标 | `codiconFontSize` / `codiconFontSize.compact` | 16 / 12px | 默认图标 / 行内小图标 |
| 圆角 | `cornerRadius.xSmall` | 2px | 行内代码、小色块 |
| | `cornerRadius.small` | 4px | 按钮、输入框、芯片、下拉项、行悬停底 |
| | `cornerRadius.medium` | 6px | 时间线卡片、代码块、Diff 块、权限座位 |
| | `cornerRadius.large` | 8px | 浮层、用户回合卡 |
| | `cornerRadius.xLarge` | 12px | 仅模态对话框 |
| | （表外） | 20px | 仅 Conversation Composer 卡片（2026-10-11 用户选定），别处不得沿用 |
| | `cornerRadius.circle` | 9999px | 会话 pill、计数徽标、发送钮 |
| 间距 | `spacing.size20` … `spacing.size240` | 2–24px | 组件内 2–8；组间 8–12；容器内衬 8–12；24 以上只给整面空态与空会话的居中留白 |
| 描边 | `strokeThickness` | 1px | 描边与焦点环 |

### 3.2 颜色写法

| 意图 | 写法 | 禁止 |
|------|------|------|
| 区域底色 | `sideBar.background` / `editor.background` / `panel.background`，阶差由主题给 | 组件里写死 hex |
| 低对比描边、分隔线 | `color-mix(in srgb, var(--vscode-foreground) 8%, transparent)`（分隔线 6%） | 实色高对比灰线；非高对比主题下用 `contrastBorder` |
| 次级文字 | `--vscode-descriptionForeground` | 用 `opacity` 叠出次级色（对比度不可控） |
| 徽标 / 标签 | 语义色文字，加 `color-mix(in srgb, <语义色> 12%, transparent)` 淡底 | 实心强调色徽标 |
| 用户回合卡 | `--vscode-input-background` 底，加 8% 低对比描边，与 Composer 同一观感 | 强调色底；投影 |
| 主按钮 | `button.background`（产品主题给中性近黑，深色近白）/ `button.foreground` | 强调色实心主按钮 |
| 弹出层高亮行 | `quickInputList.focusBackground`、`menu.selectionBackground`（产品主题给中性灰） | 实心强调色整行填充 |
| 悬停 / 按压 | `toolbar.hoverBackground` / `toolbar.activeBackground` | `transform`、`filter` |
| 焦点 | `--vscode-focusBorder` | 非高对比主题下 `outline: none` 且无替代 |
| 阴影 | `--vscode-widget-shadow`，仅浮层 | 文档流卡片投影、`backdrop-filter` |

---

## 4. 密度上限

下表给"不得更松"的上限。HEAD 列只作对照，收敛由 PRD-028 的实施方案承接。

| 元素 | 上限 / 目标 | HEAD（2026-09-28） |
|------|-------------|--------------------|
| 产品列表 / 树 / 表格行 | 22px；第二行信息改为同行右侧 | Projects 会话树与菜单行同高，24px。轨迹表、Engine 首选项导航仍是 22px 单行。轨迹表类型列是图标加正常大小写，表头 11px、无大写、无底色；来源芯片是淡底。Engine 导航计数是同行弱化数字。Overview 是高 12px 的分段条，文字在 tooltip 与 aria 名称 |
| 目录类列表行 | 24px 单行 | 2026-10-11 用户选定。导航行仍是 22px。Agents 档案行 HEAD 是 28 / 44px，设备行是 36px，随方案改 |
| 产品自有弹出层行 | 24px | 上游快速选择保持 22px，上游菜单行已是 24px，都不改 CSS |
| 区域标题条（SessionBar、透镜条、Sources tab 条、Preview 类别条） | 不高于 28px，同一行控件等高 | Conversation 标题条与 Hide Conversation 为 28px，命中区 24px，底边与 Preview 类别条对齐；Preview 类别钮 24px |
| 上游 Part 标题、编辑器 tab、状态栏 | 沿用上游，不另加高 | 沿用 |
| 图标按钮 | 图标 16px，命中区 22–24px 方形 | — |
| Composer 底栏 | 控件 24px，底栏不高于 28px | 控件 24px、底栏 28px |
| 对话正文 | 13px / 行高 1.5（`compact` 1.35） | 相同 |
| 相邻回合间距 | `comfortable` 不大于 12px；`compact` 不大于 4px | 12px / 4px |
| 阅读列 | 时间线、轨迹、Composer 同列，最大宽 720px | 相同 |

---

## 5. 组件规范

### 5.1 对话阅读面（Conversation 时间线）

- **用户回合**：Cursor 式卡片（2026-10-11 用户选定）。占满阅读列宽、文字左对齐，外观像输入框（`cornerRadius.large`、输入框底色、低对比描边、无阴影）；长文按现有规则折叠。点卡进入现有回合编辑（[composer-and-inbox](../../systems/conversation/composer-and-inbox.md) `turnEdit`），发送中的乐观行不可点。阅读列顶部的置顶提示（[lens-and-trajectory](../../systems/conversation/lens-and-trajectory.md)，时间线重构 D3）与卡片同一观感，判定与交互不变。不显示 "YOU" 标签。
- **助手回合**：不放头像，不显示 "AGENT" 标签，正文直接起排。多代理会话需要区分来源时，在回合首行用 11px 弱化字显示代理名。
- **读屏**：回合角色的读屏名称由 `getConversationTurnAriaLabel` 提供（[lens-and-trajectory §1](../../systems/conversation/lens-and-trajectory.md)），去掉可见标签不影响 PRD-018。
- **过程折**（PRD-013）：摘要是一行弱化文字（chevron 加摘要）；展开后每个思考 / 工具步骤占一行：图标、动作、目标，有数据时再加元信息（增删行数、耗时）。普通步骤不画卡片框，字重与说明文字同级。只有 `file_edit` 升级成无投影的发丝线圆角卡（`cornerRadius.large`）。增删数字是这一行里唯一的彩色，分别用 `chat.linesAddedForeground` / `chat.linesRemovedForeground`。阻塞或错误用发丝线描边，不用红色铺底；红色只留在错误标题上。
- **权限 / 提问座位**（PRD-004）：`cornerRadius.medium` 淡底卡片，无阴影；标题一行、按钮一行，主按钮唯一；有键位时在按钮旁显示快捷键提示。
- **代码块与 Diff 块**：`cornerRadius.medium`，紧凑头部（语言或文件名加操作，11–12px）。
- **回合操作**：复制、重试等在悬停或焦点时出现，不常驻。

### 5.2 Composer 与 Inbox

- **Composer**：20px 圆角、低对比描边加极淡投影（高对比主题不投影）；聚焦只加深已有投影，不改成蓝色描边（2026-10-11 用户选定）。会话进行中且草稿为空时，输入框和底栏收成一行，控件集不变；有内容、有引用芯片、叶宽小于 450px（`.is-narrow`）或空会话（PreFirst）时两行。
- **底栏**：发送是唯一的实心圆钮（`cornerRadius.circle`）；Tools、Permission、Agent、Model 与其他开关都是幽灵样式，无底无框，悬停出底色（与 PRD-015 验收 2 一致；PRD-028 验收 8 补充"无描边"）。
- **Inbox**：生成中的 Stop 留在右簇，不与发送钮合并（2026-09-28 用户确认）；芯片为幽灵或淡底样式，无数据的芯片按原则三处理。行为合同见 [composer-and-inbox](../../systems/conversation/composer-and-inbox.md)。

### 5.3 工程表格与列表（轨迹表、Sources、Navigator、首选项列表）

- 行高 22px；表头用正常大小写、11px 弱化色、无底色；类型列是图标加正常大小写文字，不用粗体大写。
- 数字右对齐，用等宽字体；列按数据是否存在出现。轨迹记录（`ConversationTrajectoryRecord`）目前没有时间戳、耗时与 token 数，不造这些列。
- 选中态用有焦点 / 无焦点两种颜色（原则四），不用深灰整行底。
- Navigator 的 Projects 树：单行 24px，与菜单项同高。消息数、路径等放在同行右侧弱化显示。轨迹表仍是 22px。
- 轨迹 Overview（[lens-and-trajectory §3.2](../../systems/conversation/lens-and-trajectory.md)）：改为一条细分段条（高不超过 12px），类型用颜色加形状区分，文字进 tooltip 与 aria 名称，不只靠颜色；点击定位行为不变。
- Inspector：区段标题用正常大小写、12px、600；状态徽标用淡底。
- 目录类列表（Engine 首选项的技能 / 工具 / MCP / 目录，Connection 设备列表，Sources 的 Staged / Changes 分组）：分组头是正常大小写的组名加弱化计数（如 `User 29`），右端放至多一个次按钮（如 `+ New`）。组体是一整块比所在底色略深一档的淡底容器（`cornerRadius.medium`），行之间不画分隔线（原则五），也不逐行套框，悬停行出 `toolbar.hoverBackground`。内容行是 24px 单行：16px 图标放在 20px 中性淡底方块里，名称后接同行弱化说明并截断，行尾 `…` 操作悬停或焦点时出现。超过 5 行时只显示前 5 行，下面是文本按钮「再显示 N 个」；导航上的计数仍是全量条数、不含分组行，不随折叠变化。设备列表不得为了只显示 5 行而藏起当前设备。（2026-10-11 用户选定单行，不用 Cursor 的双行。）

### 5.4 Preview 类别条

七个类别（[editor-part-tabs §6](../../systems/workbench/editor-part-tabs.md)）是纯图标钮，选中态是 2px 下划线，每个钮必须有 tooltip 与 aria 名称。打开了编辑器时，11px 弱化数字跟在图标右侧；没有打开的编辑器，或一行放不下，不显示数字。类别条独占 Preview 顶部一行，不和编辑器标签挤在同一行（[ADR-011](../../../dev/decisions/011-preview-two-level-tabs.md)）。图标是 16px codicon，命中区 24px；有计数时钮变宽，不再用盖在图标上的角标。

### 5.5 弹出层（菜单、下拉、选择器、列表浮层）

适用：上游菜单、SelectBox 下拉、快速选择、建议与悬浮提示（经主题对齐），以及产品自有浮层。输入布局里 Profile（Agent、Model）点开的工作台菜单是选择类弹出层的参照（2026-10-11 用户选定）：24px 行、当前值打勾，不另做一套对话框。会话切换用同一套。History、Snapshots、Inbox 对齐它的圆角、细边、投影和行高。

- 容器：`menu.background` 底，1px `menu.border` 中性细边，`cornerRadius.large`（8px），淡投影来自 `--vscode-widget-shadow`（产品主题给非透明的淡值，组件不写死 `rgba`），内衬 4px；宽 200–360px。Profile 菜单和会话切换用菜单自己的高度。History、Snapshots、Inbox 最高 320px，超出滚动。Tools 列表保持最高 240px。
- 行：产品自有浮层高 24px，`cornerRadius.small`，左右内衬 8px；16px 图标、13px 名称，说明是同一行的 12px 弱化字；快捷键是弱化文字，不画键帽。上游快速选择保持 22px，上游菜单行已是 24px，都不改 CSS。
- 状态：悬停与键盘高亮是中性灰底（前景色约 8%），不用实心强调色；当前值在行尾用对勾标出，不填充整行；禁用行用 `disabledForeground`；高对比主题保留描边。右键菜单的悬停和键盘高亮用 `list.hoverBackground`（合并浅色主题里已是中性灰）；`menu.selectionBackground` 只用于按下态，也改成中性灰。
- 结构：Profile 菜单和会话切换不加搜索框。Tools 列表仍是 9 个及以上才搜索。分组标题 11px 弱化字、正常大小写；分隔线 6%；空结果一行弱化字。
- 动效：只用透明度，不超过 100ms，不缩放（原则七）。

### 5.6 按钮层级

- 主按钮：中性近黑实心（`button.background`），一个视图内至多一个。
- 次按钮：小号描边按钮（低对比描边、无底），如 `+ New`。
- 文本按钮：无底无框，如「再显示 N 个」「+ 添加属性」。
- 行内与工具栏操作：优先幽灵图标钮（原则一）。图标 16px，命中区 22–24px 方形；常态无底无框，悬停与按压只用 `toolbar.hoverBackground` / `toolbar.activeBackground`。每个钮有 tooltip 和 aria 名称。行尾操作在悬停或焦点时出现，未出现时不接收点击。输入对话框的字段有可见名称，校验留在对话框里。动作能排开时一动作一图标；一行放不下时才收成行尾 `…`。确认框和输入对话框的按钮保留文字。Engine Preferences 的 Triggers、Providers、Models、Skills、Agents、MCP、Plugins、Clipboard、Context Variables 工具栏按此绘制。Providers、Models、Skills、Agents、MCP 的新建和编辑用输入对话框。正文保存、页签和状态按钮保留文字。图标见 [engine-catalog](../../systems/workbench/engine-catalog.md)。

### 5.7 搜索与筛选条

- 搜索框：整宽圆角药丸（`cornerRadius.circle`），淡底无描边，前置搜索图标；聚焦时描边按原则四出现。面板内的小搜索框（Navigator 过滤等）同样无常驻描边。
- 筛选芯片：一行药丸芯片，未选是低对比描边，选中是中性淡底、不加粗；范围选择芯片在最前，后接一条竖分隔线；放不下时右端渐隐，行尾放筛选图标。透镜切换（Conversation / Trajectory）、Sources tab、Engine 首选项分类用同一套选中样式。

### 5.8 文档预览（Markdown）

- 阅读列居中，最大宽约 760px。正文用 `fontSize.body1`（13px），标题用现有 heading 字号，不新造介于 13px 和 18px 之间的字号。H1 600，以下标题 400 并逐级减弱。
- 有序 / 无序列表悬挂缩进；行内代码浅灰底、`cornerRadius.xSmall`、等宽字体，与对话正文的行内代码同一观感。
- Frontmatter 以两列属性表显示（HEAD 的 `markdown.preview.frontMatter` 默认已是 `table`）：左列键名，右列值，长值换行，JSON 值用弱化等宽字；不画表格框线。类型图标要改上游表格 HTML，默认不加。
- 预览与源文件切换用现有标题栏命令，不在面包屑行另做分段控件。

---

## 6. 空态（两级）

1. **面板内空态**（列表、树、Sources 各 tab、Navigator、设置搜索无结果等）：一行 12px 弱化说明，可带一个文本链接或幽灵按钮。不放插图、不画卡片、不设最小高度；在可用区域垂直居中，或贴顶留 8–12px，同一区域内保持一致。
2. **整面空态**（Preview 各类别、空会话、空编辑器）：不画带边框的卡片。可以有一个 16–24px 的弱化图标或产品标识，下面是纯文本的"动作名 + 快捷键"列表，至多一个主操作。
3. **不截断**：空态文字与操作在最窄可用宽度下不出现省略号；放不下时只保留图标加 tooltip，或换行。
4. **诚实降级**（PRD-007）：说明为什么空、下一步做什么，不写假数据。
5. **错误态**（PRD-028 验收 11）：同一区域只显示一次。一个语义色状态图标，加一行前景色说明（出了什么事）和至多一个操作（重试、打开设置等）；原始错误码、路径放进 tooltip 或可展开的详情。不整段语义色文字，不在同一面板里同时出顶部横条和居中空态。
6. **会话不可用**：在原本放输入的位置用现有连接状态说明原因。PRD-015 要求留在输入行的 Permission、Model、Tools 保持禁用和现有诚实空文案，不省略。SessionBar 上一级、下一级以禁用态保留。标题文字保持正常颜色。加载中用视图顶部的细进度条加一行文字；不要拿掉空态自己的图标。

---

## 7. 反模式清单

1. 毛玻璃；文档流卡片投影；营销式卡片栅格；带大图标的空态卡片。
2. 实心强调色徽标；强调色底的用户气泡；一个视图里多个实心主按钮；弹出层里实心强调色的高亮行。
3. 产品自有表面的全大写标签。
4. 写死 px 字号、半像素字号；表外圆角（10 / 14 / 16px）。
5. 非高对比主题下取消焦点且无替代样式。
6. 按压缩放、`filter` 反馈、`transform` 过渡。
7. 框套框；列表行分隔线；常驻高对比分割线。
8. 按钮或空态文字被截断。
9. 无数据仍以描边框常驻的状态芯片。
10. 整段语义色的错误文字；同一错误在一个面板里出现两次；把原始错误码当说明；会话不可用时整排置灰。

---

## 8. 审查与验证

改 UI 样式时按 §7 自检，另做三件事：浅色与深色主题各截一张图；只用键盘 Tab / 方向键走一遍，确认焦点始终可见；叶宽小于 450px（`.is-narrow`）时检查截断。文档结构变更后跑 `python3 scripts/check-docs-health.py`。

---

## 9. 与上游组件的边界

上游组件先通过产品主题与 token 对齐，不逐个改 CSS。每改一个上游文件都会增加上游同步冲突面，与 [ADR-007](../../../dev/decisions/007-upstream-sync.md)「上游只留最小 hook」相悖。确需改上游 CSS 时，只改本规范直接要求的项（焦点、缩放、毛玻璃、表外圆角），不做观感微调。

---

## 10. HEAD 与本规范的差距（2026-09-28）

按 PRD-028 验收顺序列出，收敛由实施方案承接。

| 项 | HEAD |
|----|------|
| 默认主题 | 产品自有 `UniverseAgentStudio Light` / `Dark` 已是默认。chrome 浅色 `#F3F3F3`，会话画布 `conversation.background` 浅色 `#F8F8F8`、深色 `#191A1B`，输入卡保持白；主按钮浅色近黑、深色近白。其余切片仍由 [cursor-visual-alignment](../../../dev/plans/cursor-visual-alignment.md) 承接。上游基线：`Light 2026` 的 `chat.requestBubbleBackground` 是蓝调 `#EEF4FB`，`badge.background` 是实心蓝 `#0069CC` |
| 强调色 | 实心蓝徽标（如 "Input needed"、"UNAVAILABLE"）。轨迹来源芯片已改为 `textLink` 12% 淡底。Files 视图欢迎页有两颗满宽主按钮（上游） |
| 字号 | Conversation 样式目录共 12 种写死字号（含 9.5 / 11.5 / 12.5px）；`conversationLens.css` 84 处写死，字号 / 间距 / 圆角 token 合计只用 11 处 |
| 圆角 | 12 / 14 / 16px 残留 13 处（10 个文件）；Conversation 样式目录另有 3px、10px |
| 行高 | 见 §4 HEAD 列 |
| 焦点 | 全仓 78 处 `outline: none !important`（39 个文件，含编辑器隐藏 textarea 等合法用例），需逐处确认有替代焦点样式 |
| 全大写 | 对话阅读面不再显示 YOU / AGENT。轨迹角色列、Inspector 区段标题与状态徽标不再 `text-transform: uppercase`。轨迹表头、类型列与 Overview 标题已是正常大小写。图示选项徽标与 Engine 技能 / 目录分组标签仍全大写，不在 [阅读面方案](../../../dev/plans/conversation-reading-surface.md) |
| 空态 | Preview 类别空态无边框，标题与说明用字号 token，按钮可换行并有键盘焦点。其他表面的大图标居中卡片仍在 |
| 阴影与毛玻璃 | Agents 窗口跟在聊天背景上的追问卡已是不透明 `--session-view-background`，不再 `backdrop-filter`，也不再投影；会话里和新建里的输入聚焦只把描边换成 `focusBorder`（高对比仍用对比描边）。对话框遮罩与引导页遮罩不再 `backdrop-filter`，半透明底色仍在，对话框与引导卡的浮层投影保留（[modal-mask-no-glass](../../../dev/plans/modal-mask-no-glass.md)，方案仍 `draft`）。图示浮层与子代理浮层不再 `backdrop-filter`，半透明底色仍在；图示推荐项不再投影。用户回合占满阅读列、左对齐，底色 `input.background`，前景色 8% 细边，不投影；置顶提示用独立类，底色是画布 token。阅读列身份条的引擎芯片去描边，离线 / 失败保留状态色。Conversation Composer 卡片参照 Cursor：圆角 20px、带很淡的投影（高对比仍无投影），聚焦只加深已有投影，不改成蓝色描边；宽于阅读列 32px。发送钮 24px，实心前景色圆加反色图标，悬停与按压由前景色派生（原则七的例外），禁用时 0.25 透明度；底栏其余控件是无底的圆形幽灵钮。工具行选择器用 `fontSize.label1`。Permission / Agent / Model、Tools 与 More 浮层用 `cornerRadius.large`、行用 `cornerRadius.small`，阴影走 `widget-shadow`。首屏（PreFirst）上方的身份条靠左对齐卡片，芯片去描边，引擎离线 / 失败芯片保留状态色。输入框光标跟 `input.foreground`。轨迹搜索聚焦仍用 `box-shadow`。其余验收未齐 |
| Inbox | 空队列 / 空 Goal / 未生成的 Stop 为幽灵芯片（无描边）。队列名是 `list-ordered` 图标，状态文案在旁；空 Goal 是 `target` 图标，文字在 tooltip。待确认用链接色。队列列表在 context-view 里，空态一行 |
| 轨迹 Overview | 高 12px 分段条；形状加颜色，文字在 tooltip 与 aria。时间刻度瀑布条仍未做 |
| 死 CSS | `uaClientConversationChrome.css` 中的 `body.ua-client-*` 与 `.conversation-lens-density--compact` 已无代码设置，与 `.density-compact` 重复 |

---

## 11. 相关文档

- 需求：[PRD-028](../../product/requirements.md#prd-028-视觉语言与信息密度) · [产品愿景](../../product/vision.md)
- 外部对照：[对话界面密度](../../reference/external-chat-ui-density.md)（2026-10-15 取样，2026-10-16 用户签收；不改本节）
- [主题与 token](theming.md)
- [Conversation 透镜与轨迹](../../systems/conversation/lens-and-trajectory.md) · [Composer 与 Inbox](../../systems/conversation/composer-and-inbox.md) · [EditorPart 与 Preview 类别](../../systems/workbench/editor-part-tabs.md)
