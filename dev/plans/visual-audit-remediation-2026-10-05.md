---
title: "自有界面视觉审查问题收口"
type: plan
status: accepted
phase: M7
updated: 2026-10-06
summary: "按八项已确认视觉问题和一项待实测疑点分切片收口；Sessions 窄桌面单栏与真机 phone 状态分离。"
---

# 自有界面视觉审查问题收口

> 发现和实拍见 [2026-10-05 自有界面视觉审查](../parallel/active/visual-audit-2026-10-05.md)。产品合同是 [PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度) 的验收 3、4、7，以及 [UI 设计原则](../../docs/architecture/cross-cutting/ui-design-principles.md) §2、§4、§8。[可访问性与响应式 UI 完成方案](accessibility-responsive-ui.md) §5 的宽度档约束 Conversation 叶与 Preferences pane，**不是** Sessions 壳的断点；Sessions 窄桌面单栏是本稿新增的壳策略，不改变叶级现行断点。
>
> 这份方案只收审查中确认的自有界面问题；不重做 VS Code 原生部件。与 [UI 缺口收口](ui-gap-closeout-2026-10-01.md) S-B 的焦点环文件集不重叠；该方案的其他诚实态和配对切片也不搬进来。已在 UI 设计原则 §10 登记的 Composer 投影、Visualize 毛玻璃与整面空态大图标仍由 PRD-028 后续切片承接，本稿不重复实施。

## 1. 目标与完成线

1. 390px 宽的桌面浏览器能完整看到 Sessions 主内容，并能打开、关闭导航；桌面 `<600px` 使用独立单栏状态，不进入 `phone` 生态。桌面 `≥600px` 保持既有显隐选择，只有布局实测容不下主内容时才临时收起次级 Part。初始窄宽和宽窗缩窄两条路径一致，放宽后原来的桌面显隐选择恢复。真机 `<640px` 手机断点与行为保持原样。
2. Conversation 回合、Visualize 展开按钮、Sessions 手机顶栏和 Sources tab 的键盘焦点有可见的 1px `focusBorder` 环；鼠标点击不强制画环，高对比主题保留对比色环。
3. Connection 在 Light+ 下，失焦的选中分区文字保持可读；活动和失焦选中态都用各自背景相配的前景色。现状实测对比度 1.24:1，不作验收值。
4. Sources Changes / Review 文件行及其内嵌操作收至 22px，虚拟列表委托高度与 CSS 一致，行内名称、状态、操作不裁切。
5. `workbench.reduceMotion=on` 即使系统媒体查询为 `no-preference`，也停止 Customizations 的首次入场动画。
6. Customizations 窄模态先补实测。若 **pane 实宽** 400–549px 确有横向溢出，则进入单栏并保持分区和详情可返回；若各内容态在这个区间均无溢出，从本稿撤掉该修复，不据常量推论硬改。

本稿不改 PRD 状态；各切片代码落地不等于 PRD-028 `implemented`。产品主题、整个对话阅读面和全部主题的完整验收不在本稿宣称完成。

## 2. 切片与冲突域

| 切片 | 范围 / 独占文件 | 依赖 | 完成证据 |
|:-----|:----------------|:-----|:---------|
| V0 窄模态核验 | 隔离窗口只读检查 Customizations；不写产品源码 | — | pane 实宽 400、500、549、550px；welcome、已选分区、详情和内嵌编辑器的边界及 scrollWidth/clientWidth |
| V1 Sessions 窄宽 | `sessions/browser/layoutPolicy.ts`、`workbench.ts`、`workbenchFactory.ts`、`singlePaneWorkbench.ts`、`paneCompositePartService.ts`、`parts/{sessionsParts,customViewGridParts}.ts`、窄桌面导航宿主；逐项审计 phone 消费方 | — | 初始 390px、宽→窄→宽、实际手机；single-pane 开/关和自定义视图打开时的 DOM/截图；phone 上下文与行高未误变 |
| V2 焦点环 | `conversationTimeline.css`、`conversationVisualize.css`、`mobileChatShell.css`、`sourcesTabs.css` | — | Light+、产品浅色和深色主题的键盘焦点 DOM/截图；高对比抽验 |
| V3 选中态与动态 | `connectionPreferencesPane.css`、`aiCustomizationManagement.css` | — | Light+ 与产品浅 / 深主题的活动及失焦选中行对比度；减少动态开启时 `animation-name:none` |
| V4 Sources 密度 | `sourcesChangesPresentation.ts`、`sourcesChangesList.css`、`sourcesReviewList.ts`、`sourcesReviewList.css` | — | 文件行与委托均 22px，长文件名、归因芯片、操作钮仍可用 |
| V5 Customizations 窄宽 | `aiCustomizationManagementEditor.ts` 及同目录 CSS；不改通用 `modalEditorPart.ts` | V0 证实溢出才开 | 400、500、550px 下主要内容与返回操作可见，无页面级横向滚动 |

各切片可按文件集并行，但同一切片只有一个写者。V1 单独占 Sessions 布局冲突域；V2 中 Sessions 手机 CSS 与 V1 不共享文件，但合入后仍须对首次窄宽、运行时缩放和实际手机一起回归。V0 未证实前不启动 V5。实施按 [多 Agent 方案设计工作流](../../docs/guides/multi-agent-design-workflow.md) 的冲突域和工位规则，每波最多三个实施切片。

## 3. 实施要点

### V1 Sessions 窄宽

- `layoutPolicy.ts` 保留真机 `<640px` 的 `phone` 分类与 `IsPhoneLayoutContext` 语义，另加只由桌面宿主宽度 `<600px` 触发的 `compactDesktop` 状态。它只控制 Sessions 壳单栏与导航呈现，不给根节点加 `.phone-layout`，不切换手机手势、sheet、账号/文件贡献、Agent Host 选择器或 76px 会话行。Conversation 叶现行 450px 窄档独立判定，Preferences 各 pane 也各自判定；不把 [旧 §5](accessibility-responsive-ui.md#5-响应式布局) 的叶级数字当作壳合同。
- 桌面 `≥600px` 先保留用户现有显隐选择与既有布局。V1 开工时实测 600、639、700、800、899px 的主列矩形及各 Part 最小宽；只有实际布局容不下主列时，按主列→当前显式打开的详情→导航的优先级临时收起较低优先级 Part，并在放宽后恢复。不得无证据地把整个 600–899px 档改成固定两栏或默认隐藏辅助栏；若 600px 上仍裁切，记录发生阈值与收纳行为。
- 工厂和首次 `layout()` 共用宿主尺寸来源，不能一处读 `document.body`、一处读 `parent`。`workbenchFactory.ts` 用传入的 `parent` 与布局方法相同的测量函数；全屏时都取全屏宿主。`dockDetailPanel=true` 时即使初始宿主宽度小于 600px，也构造可在单栏暂时隐藏 docked 节点的 `SinglePaneWorkbench`，放宽后恢复 docked 拓扑。`sessionsParts.ts`、`customViewGridParts.ts`、`paneCompositePartService.ts` 不再只凭构造瞬间的 body 宽度把窄桌面选为手机 Part；桌面 Part 提供可运行时切换的紧凑导航入口，手机 Part 仍只服务真机 phone。测试令 body 与 parent 宽不同。
- `layout()` 的过渡检测同时跟踪 `viewportClass` 与 `compactDesktop`，不能只比较 `_previousViewportClass`。进入 `compactDesktop` 时在一次布局事务中处理**全部**可见 Part：先记下 editor、sidebar、auxiliary bar、panel、sessions 与 custom view grid 的桌面显隐选择；普通会话面显示 Sessions 为整列，隐藏其余并排 Part；custom view grid 若当前打开则独占整列，并提供窄桌面自己的返回会话操作。`SinglePaneWorkbench` 的 docked editor/detail 节点在单栏暂时隐藏，不另挤最小宽度。紧凑导航可复用手机导航的视图模型，但用桌面入口、独立的壳 CSS 与焦点管理，不直接挂手机标题栏、底栏 sheet 或 `.phone-layout`。
- 初始窄桌面在 `renderWorkbench` 调用 `_applyPersistedPartVisibility()` 前读取 `_PART_VISIBILITY_KEY` 到**待恢复快照**，不把桌面多栏可见态应用到单栏；`_loadPartVisibility()` 对真机 phone 的现有跳过行为不变，但不能对 `compactDesktop` 也返回 `{}`。宽→窄则从进入前的真实状态取快照。回到桌面普通布局后恢复快照（包括 editor 与 custom view grid）；无快照才用默认值。整段响应式切换抑制 `set*Hidden` 的持久化写入，窄桌面导航抽屉也不覆盖桌面偏好；用户后来主动更改桌面显隐时再正常保存。
- V1 对 `IsPhoneLayoutContext`、`isPhoneLayout()` 与 `.phone-layout` 的全部消费点做静态审计并抽验行为，至少包括 `sessionsList.ts`、`account.contribution.ts`、`files.contribution.ts`、`agentHostSessionConfigPicker.ts`、`codeReview.contributions.ts`、`mobileAwareDialogHandler.ts`。这些点在窄桌面应继续取桌面语义；需要改动的消费方纳入 V1 同一冲突域。窄桌面导航按钮和返回操作也须有键盘焦点环。
- 验收覆盖桌面 390px 初启、599/600px、600/639/700/800/899px 的真实主列边界、900→390→900、真机 599/600/639/640px、`dockDetailPanel` 开/关、已有会话与无 Host 空态、custom view 打开后缩窄再返回。`dockDetailPanel=true` 下单测 390px 初启→900px 放宽恢复 docked 拓扑。复原后的桌面导航、当前会话、editor/自定义视图与打开页面不丢；DOM 主内容矩形须处于宿主内，`IsPhoneLayoutContext`、会话行高和窗口存储显隐值均与各自模式预期一致。

### V2 键盘焦点

- 时间线文章是真实 roving-tabindex 目标；把现有 `:focus, :focus-visible { outline:none!important }` 拆开：鼠标焦点仍无环，后写且至少同特异性的 `:focus-visible` 用 `1px solid var(--vscode-focusBorder) !important` 画内缩环。检查用户气泡自己的焦点边框不会与文章环叠成双环。方向键逐回合读时当前行可见。
- Visualize 展开按钮的既有 `:focus-visible { outline:none }` 改为按钮自身的焦点环，父卡 `:focus-within` 不额外画第二圈。Sources tab 的 `:focus, :focus-visible { outline:none }` 同样拆开、后写键盘环；选中 tab 在聚焦时仍可分辨。逐控件核对最终 computed outline，而不是只验证选择器文本。
- Sessions 手机顶栏按钮与标题的后写 `:focus-visible` 必须盖过 `.monaco-workbench ... :focus { outline:none !important }`。使用同等或更高特异性并按需 `!important`；高对比主题用 `contrastActiveBorder`。不以 hover 灰底代替焦点环。
- 这里的结果以键盘实测和计算样式验收；不新增只镜像 CSS 字符串的扫描测试。

### V3 Connection 与减少动态

- Connection 选中标签不能无条件取 `list.activeSelectionForeground`，同时选中行背景也不能无条件取 `toolbar.activeBackground`。列表有焦点时用 `list.activeSelectionBackground` + `list.activeSelectionForeground`；失焦时用 `list.inactiveSelectionBackground` + `list.inactiveSelectionForeground`（后者未配置时退回 `foreground`）。高对比主题保留既有边标并用其对比 token。检查 Light+、产品浅色、产品深色的**实际像素**对比度，不能靠局部写死白 / 黑覆盖用户主题。V3 只修当前导航行的配色，不改变 Connection 窄宽导航或 Back；HEAD 的窄宽导航与旧 [响应式方案 §5](accessibility-responsive-ui.md#5-响应式布局) / D19(3) 的「单栏滚动、无 Back」有既存合同漂移，不能借 V3 宣称这条旧验收通过。
- Customizations 入场动画同时响应工作台根上的 `.monaco-reduce-motion` 和系统 `prefers-reduced-motion`。不关闭普通模式下的淡入；核对根类位于编辑器祖先上，避免选择器写错层级。

### V4 Sources 密度

- 将 Changes 文件行常量、CSS 高度和 Review 虚拟列表委托统一为 22px；分组标题仍单独占 22px，不能把合并行的委托高度误设为 22px。Changes 文件按钮和 Review 状态钮的 24px 命中盒缩到行内能容纳的尺寸；Review 状态钮 `::after` 的 24px 行高也同步收紧。图标、11px 元信息和长路径的省略仍可见。
- 列表虚拟化、滚动定位和多选命中要按新高度核验。空态、提交输入区及 Sources Files 原生资源管理器树不在此切片改动。

### V5 Customizations 窄模态（条件切片）

- V0 若证实 SplitView 在 pane 实宽 400–549px 下把详情推出可见区，改 Customizations 自有 pane：按 `layout(dimension).width` 切单栏，不改通用 `modalEditorPart.ts`。使用 `SplitView.setViewVisible()` 隐藏一侧视图——隐藏项对 SplitView 的 `minimumSize` 贡献变为 0（`splitview.ts` `ViewItem.minimumSize`）；可见内容视图仍有 400px 最小宽。每次模式或导航目标改变后重排 SplitView，不能只用 CSS 隐藏 DOM 而让 150+400px 约束继续占位。
- 单栏新增独立的「返回分区」操作与导航状态，不复用现有返回 Overview / 条目列表的 Back。无选中分区时显示左侧分区列表；从持久化的 `selectedSection` 直接打开时可先显示详情，但必须有可见返回分区入口。切换时将键盘焦点移到当前可见的分区行或可程序聚焦的详情标题；验收确认隐藏的 SplitView 子视图内不再保留焦点。
- 进入单栏前保存当前分区、详情与侧栏宽度；返回宽布局后令两侧视图均可见并恢复选中项和用户拖过的宽度。只有双栏实际可用且两侧都显示时才把 sash 改动写入 `sidebarWidth`，避免窄布局的零宽覆盖偏好。列表、内嵌编辑器收到非负且不超过可见 pane 的布局宽度。
- V0 若四种内容态都无实测溢出，在审查看板写明 pane 实宽、两栏边界、`scrollWidth/clientWidth` 与返回路径作为反证，再关闭 V5；单张 welcome 截图不足以撤项。

## 4. 验证与升级边界

- 每个切片先跑其已有的最小针对性测试或运行脚本。V1 的布局判定与运行时切换需要有能发现回归的测试；V4 的虚拟行高需要真实列表滚动检查。CSS 切片用键盘、DOM 计算样式和浅 / 深主题截图验收，不为一条颜色声明新增镜像测试。
- 视觉验收使用本仓隔离 profile 的编辑器壳和 Sessions Web；不把 `src/vs/sessions/test/e2e` 当作默认编辑器壳剧本。`workbench.reduceMotion` 需在系统减少动态关闭时单独测试。
- 整体验收记录在本轮审查看板或 `dev/progress/` 证据目录；实施前后对照同一主题与同一宽度。未实测的 V5 不计完成。改代码后按 [文档门禁](../../docs/DOCUMENTATION.md#规则-3a提交前文档门禁) 更新 `dev/progress/status.md`；用户可见合同若变化，再按产品需求顺序更新知识层。
- 本稿不改引擎或 VS Code 原生组件，不重开托管 CI，不以 PRD-028 的局部修复宣称整条需求完成。

## 5. 风险与回退

| 风险 | 防护 / 回退 |
|:-----|:-----------|
| 宽窗运行时缩窄未进入紧凑状态，或误启 phone 消费方 | V1 同时核对工厂、双状态过渡与 phone 消费方，宽→窄→宽及真机回归；回退整组壳布局，不单独回退 CSS |
| 键盘环被旧 `outline:none!important` 覆盖，或同一回合画双环 | 运行时读取 `:focus-visible` 的 computed outline，截图看相邻回合；按控件局部回退 |
| 主题覆盖后失焦文字再次变浅 | 用实际背景和前景 token 配对，在 Light+ / 产品浅深主题复核，不写常量色 |
| 行高减小后按钮或标签裁切 | 同时改 delegate、CSS 与内嵌控件，长路径和多选滚动回归；V4 可独立回退 |
| Customizations 单栏改动丢掉选中或保存错误宽度 | V0 先证实；V5 保留 selection / savedWidth，窄→宽回归；未证实则不实施 |

## 6. 方案审查

2026-10-06 独立只读审查：Strengths 为审查发现有切片与验证入口、V0 先实测，以及 V1–V3 的运行时证据；Critical 无。Important 指出 `dockDetailPanel=true` 且初始窄窗时会固定构造普通工作台，放宽后无法恢复 docked 拓扑；已核对 `workbenchFactory.ts` 与 `singlePaneWorkbench.ts`，在 §3 V1 补构造路径及 390→900px 专项验收。Minor 指出 V3 表格证据窄于正文、V5 详情标题需可聚焦且隐藏视图不能留焦；也已改入切片。该轮 Assessment 为方案方向可行、先保持 `draft`，随后再做 Grok 复核。

同日按用户要求尝试 Grok CLI 默认 `grok-4.7`，返回 `402 Payment Required`，未产生审查意见；Cursor CLI 的 Grok 4.7 首轮无结果后中止。改用 Cursor CLI `cursor-grok-4.6-high --mode=ask --trust` 完成只读复核，结论为 3 Critical、5 Important，要求先改 V1。逐项处理如下：

| Grok 意见 | 核验与处理 |
|:----------|:-----------|
| C1：叶级 §5 的 600px 档被误写成 Sessions 壳合同 | **采纳**。引言与 V1 改为独立桌面壳策略；Conversation 叶现行 450px 档不受影响。 |
| C2：窄桌面进入 `phone` 会误启手机上下文、76px 行高、sheet 和贡献门控 | **采纳**。增加 `compactDesktop` 独立状态，`IsPhoneLayoutContext` 保留真机语义；V1 纳入消费方审计。 |
| C3：Connection 当前导航与旧 §5 / D19(3) 合同冲突 | **事实成立，范围分开**。V3 只改当前导航行的颜色，不改变窄宽导航或 Back，也不宣称旧 D19(3) 得到重新验收；既存合同漂移须另行处理，不阻塞本稿的配色修复。 |
| I1：手机 600–639px 会被新断点改成双栏 | **采纳**。真机 `<640px` phone 分类保持现状；600px 只用于窄桌面壳。 |
| I2：600–899px 一律收辅助栏缺实测依据 | **采纳**。改为逐宽测量主列与 Part 最小宽，仅在实际容不下时临时收纳。 |
| I3：V1 文件集漏 `isPhoneLayout` 消费方 | **采纳**。V1 明列关键消费方，逐点审计；实际需改的文件同属 V1。 |
| I4：§5 旧「今天」描述滞后 HEAD | **采纳其事实，不沿用旧基线**。本稿仅把 §5 作为历史叶级方案链接；V1 以当前源码、当前系统规格与实测为基线。 |
| I5：初始窄窗当前 `_loadPartVisibility()` 会丢弃存储值 | **采纳**。V1 点名 `renderWorkbench`、`_applyPersistedPartVisibility()` 与 `_loadPartVisibility()` 的读取和应用顺序。 |

Critical 与 Important 均已核验并处理。本稿签收为 `accepted`，只授权上述切片，未宣称任何产品代码已落。
