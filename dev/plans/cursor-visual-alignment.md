---
title: "壳与对话观感向 Cursor 靠齐（保留 IDE 密度）"
type: plan
status: draft
phase: N/A
updated: 2026-10-16
summary: "对照 Cursor 截图与 HEAD 实拍收壳与会话观感。S1–S4、S6（Preview 空态去框、Sources 标题栏并入 tab 条）已落地；S7 只补了原生菜单判断。S8 已收 Sources 读失败只出现一次，读代理树时用 .is-loading 藏闪电，会话不可用固定原因与输入控件保留已落地。一行 Composer、会话切换菜单、目录列表与 Markdown 预览未做。方案仍 draft，不升 PRD-028。"
---

# 壳与对话观感向 Cursor 靠齐（保留 IDE 密度）

需求：[PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度)（`accepted`，2026-10-11 用户选定见该条「依赖或未决」）。系统规格：[UI 设计原则与规范](../../docs/architecture/cross-cutting/ui-design-principles.md)、[主题与 token](../../docs/architecture/cross-cutting/theming.md)、[Composer 与 Inbox](../../docs/systems/conversation/composer-and-inbox.md)、[Conversation 透镜与轨迹](../../docs/systems/conversation/lens-and-trajectory.md)。相邻方案：[自有界面视觉审查问题收口](visual-audit-remediation-2026-10-05.md)（焦点环、Sources 行高等，本稿不重做）、[时间线重构](conversation-timeline-refactor.md) D3（置顶提示）。

实施进度（2026-10-16）：S1–S4、S6（Preview 空态键帽去框、Sources 标题栏动作并入 tab 条）已落地。S7 只补了 `hasNativeContextMenu` 为真时 Profile 选择器留下原生下拉。S8 已落地（Sources 读失败只出现一次、Navigator 读代理树时藏闪电、会话不可用补充固定原因说明且底栏控件与 SessionBar 导航保留禁用态）。S5、会话切换改菜单、History / Snapshots / Inbox 铬、产品遮罩色、S9、S10 未做。不升 PRD-028。

## 1. 对照基线

参照物是用户 2026-10-11 给的四张 Cursor Agents 窗口截图。HEAD 是同日 `~/.universe-agent-studio-test` 默认编辑器窗口实拍；窗口 08:45 启动，早于 09:09 的 CSS 构建，发送钮仍是旧的蓝色，以重载后为准。Cursor 一列是截图取样；HEAD 一列先写主题值，取样不同时括注。

| 方面 | Cursor | HEAD |
|------|--------|------|
| 表面层级 | 三档：chrome（侧栏、标题栏、主列顶行）约 `#F3F3F3`；画布约 `#F8F8F8`；输入类卡片（用户提问、Composer）约 `#FCFCFC`，带约 `#EBEBEB` 细线 | chrome 两种值：活动栏、侧栏、状态栏、会话头 `#F3F3F3`，标题栏、面板、标签条、Preview 类别条 `#FAFAFA`（标题栏截图取样约 `#EAEAEA`，与主题值不符，S1 前查明）。画布与 Composer 都是白色，卡片只能靠描边和投影区分 |
| 标题栏 | 只有菜单、侧栏开关、前进后退，与下面各列同色，不成独立横条 | 居中大号 Command Center 搜索框（白底描边）；右侧是产品四钮（Navigator / Conversation / Preview / Sources） |
| 左侧导航 | 无活动栏；文字导航 22px 行，图标细线灰色，选中是极淡的整行底 | 48px 活动栏，24px 图标；选中由 `activityBar.activeBackground`（`#D6D6D6`）画整格底和 8px 圆角底 |
| 会话头 | 标题常规字重带小图标；操作收在 `…` | 「Conversation / Trajectory」灰底药丸选中加粗，会话名加粗，右侧六个常驻图标 |
| 用户提问 | 占满阅读列宽、像输入框的卡片；读回复时顶部有它的吸顶副本 | 右对齐灰气泡；未贴底时顶部已有覆盖式置顶提示（D3） |
| 身份 / 环境 | 「This Computer ⌄」以弱化文字放在 Composer 下方 | 「Engine · Loopback」描边芯片，下方一条横线 |
| Composer | 进行中会话空稿时一行：`+`、占位文字、模型名、发送；有内容才两行 | 始终两行：输入行加底栏 |
| 右侧配套区 | 只列已打开项；未展开时是文字清单，Changes 带绿红增删数 | 七个类别图标钮常驻（PRD-027 / ADR-011，不改）；空态是加粗标题、说明、带边框的键帽 |

Cursor 在侧栏里本身就是 IDE 密度（22px 行、时间常显在行右）。它显得干净，靠的是表面层级少、chrome 退后、线条少，并没有把东西做大。靠齐观感不需要放松密度。

同日增补的三份输入：HEAD 另一张实拍（会话不可用、Sources 读文件失败、Navigator 加载中同屏）、会话切换下拉实拍、Cursor Customize（Skills）页与 Markdown 预览截图。

| 方面 | Cursor | HEAD |
|------|--------|------|
| 弹出层 | 8px 级圆角、细边、淡投影；行是图标、名称、同行弱化说明；当前值用对勾；高亮行是中性灰 | 会话切换与 Ctrl+P 的高亮行是实心蓝（`quickInputList.focusBackground` `#0069CC`，前景 `#FFFFFF`）。右键菜单的悬停和键盘高亮走 `list.hoverBackground`，合并浅色主题里已是 `#00000014`；`menu.selectionBackground` `#0069CC1A` 只在按下时出现。History / Snapshots 当前 12px 圆角在 `conversationLens.css:442`、`:539`，Inbox 列表 8px。浅色 `widget.shadow` 是 `#00000000`，写 `var(--vscode-widget-shadow, rgba(...))` 的浮层都没有投影。另一会话 WIP 的 Composer 选择器走工作台菜单，浅色下同样无投影 |
| 会话切换 | — | 上游 `SelectBox`（`conversationLensSessionBar.ts:303-330`），每行只有标题。名单映射丢掉了列表 RPC 上的 `turnCount`、`lastAccessedAt`（`conversationEngineRosterService.ts:1927-1933`），多条 Untitled session 无法区分 |
| 错误态 | — | Sources 同一句原始错误（`7 PERMISSION_DENIED: Path traversal detected: …`）在顶部状态行（`.sources-files-status`）和居中空态（`.sources-files-empty`，`sourcesFilesList.ts:185`、`:188`）各出一次，整段红字，第二处被状态栏截断；文案直接拼 `getErrorMessage(error)`（`sourcesFilesListStrings.ts:29`） |
| 会话不可用 | — | Composer 上方只有一行 Session unavailable（`conversationLensDockStrings.ts:11`），没有原因与操作，颜色比上方引擎行还深；会话名、New、Delete、Ask、No agent、No model 整排置灰 |
| 加载态 | — | Navigator 是闪电图标加 Reading agent tree…。文案在 `navigatorAgentTreeEmptyState.ts:31`，Team 与 Agents 共用；闪电图标是 `.navigator-stub-empty::before`（`navigatorStub.css:26-34`），空态也用这一个伪元素 |
| 目录列表 | 分组头 `User 29`，组体一块淡底，行是图标块、名称、单行说明、`…`，超过 5 行收成 `Show 24 more` | 左栏导航是 22px。Agents 档案行是 28px / 44px（`engineAgentsSection.ts:81-84`），Connection 设备行是 36px（`connectionPreferencesPane.ts:328-330`）。导航计数是全量，不含分组行 |
| 按钮 | 主按钮近黑药丸，次按钮小描边，文本按钮无框 | 主按钮实心蓝（`button.background` `#0069CC`） |
| 筛选 | 整宽圆角搜索药丸；芯片一行，选中是灰底 | Navigator 过滤框白底描边；各处选中样式不一 |
| Markdown 预览 | Frontmatter 渲染成属性表；标题层级与列表悬挂缩进清楚 | `markdown.preview.frontMatter` 默认已是 `table`（`<th>` 加 `<td>`，没有类型图标，`yamlPreamble.ts:149-152`）。预览和源文件已是标题栏命令（`markdown-language-features/package.json:525-538`），不是面包屑上的分段控件 |

## 2. 密度与合同底线（本稿不得突破）

- 行高、标题条高、Composer 底栏高、阅读列宽仍按 [UI 设计原则 §4](../../docs/architecture/cross-cutting/ui-design-principles.md#4-密度上限)。元信息常显，不收进悬停。
- 产品四钮留在标题栏（[ADR-006](../decisions/006-shell-invariants.md)、PRD-001 验收 3），不关 `workbench.layoutControl.enabled`。
- 状态栏与条目保留：[PRD-007](../../docs/product/requirements.md#prd-007-诚实降级) 验收 4 与 [PRD-024](../../docs/product/requirements.md#prd-024-远程引擎连接connection-hub) 要求连接级状态在状态栏。浅色主题状态栏已是 `#F3F3F3`，本稿不改。
- 活动栏保留，只改视觉样式（用户选定）。
- PRD-015：Composer 控件集不变（Tools、Permission、Agent 仅空会话、Model、放大输入、发送）；空会话（PreFirst）草稿至少两行。
- 置顶提示的判定与交互按 D3：贴底时不显示，从视口最后一个可见行往回找用户回合，是可聚焦按钮，带复制，点击只定位。
- Preview 七类别条不改（PRD-027 / ADR-011）。
- 键盘可达与焦点可见不退步（PRD-018、PRD-028 验收 4）。
- 目录类列表与弹出层行都是 24px 单行（用户选定单行，不用 Cursor 的双行）。
- 错误态收敛不等于藏信息：原始错误码与路径仍可从提示或详情取到（PRD-007 诚实降级）。
- 焦点、选中、链接、进行中指示仍用强调色；只把主按钮改成中性。

## 3. 切片与冲突域

工作区里另一会话有未提交的 Cursor 式 Composer 改动（`conversationLens.css`、`conversationLensComposerChrome.ts`、`conversationLensSessionBar.ts`、`conversationLensDock.ts`、`conversationLensCssScan.test.ts`、`conversationLens.test.ts`、`composer-and-inbox.md`，以及 PRD-028、UI 设计原则 §10 里描述这批代码的句子）。S2–S5、S7、S8 都碰这些文件（S7 还要接手 WIP 新建的 `conversationComposerPicker.ts`），那批改动合入之前不开，开工时以合入后的 HEAD 重新核对选择器与测试。S1、S6、S9 的非 Sources 部分、S10 不碰它们，可以先做。

| 切片 | 范围 / 独占文件 | 依赖 | 完成证据 |
|:-----|:----------------|:-----|:---------|
| S0 文档 | PRD-028、`ui-design-principles.md`、`theming.md`、`lens-and-trajectory.md` 指针、`traceability.md`、`conversation-reading-surface.md` 注记 | — | 本稿同轮已改 |
| S1 主题三档、活动栏、弹出层与主按钮配色 | `universe-agent-studio-{light,dark}.json`；`workbenchThemeService.ts` 的 `COLOR_THEME_{LIGHT,DARK}_INITIAL_COLORS`；`services/themes/test/common/workbenchThemeService.test.ts`；`--vscode-button-background` 的 CSS 消费方，加上 `registerColor` 默认值和 `asCssVariable(buttonBackground)`。指示类改引用（改动随文件归属落到对应切片） | — | 浅 / 深 / 两种高对比前后截图；主题测试；消费方核对表 |
| S2 Conversation 画布 token | 新文件 `contrib/conversation/browser/conversationColors.ts`；`workbench/browser/parts/conversation/media/conversationPart.css`；Conversation 各样式表中画布用 `editor.background` 的选择器（见 §4 S2）；S1 的初始色表 | S1；另一会话 WIP 已合入 | 截图无白缝；CSS 扫描测试 |
| S3 对话头与身份条 | SessionBar 样式（`conversationLens.css` 会话头段）、`conversationIdentityStrip.css` | S2 | 截图；窄宽 300 / 450px |
| S4 用户回合卡与置顶提示 | `conversationTimelineRenderer.ts`、`conversationUserBubbleCollapse.ts`、`conversationTimelineHost.ts` 置顶层、`conversationPinnedUserPrompt.ts` 及其测试、`conversationLens.css` 用户回合与置顶段、`conversationTimeline.css`；测试 `conversationLensCssScan.test.ts`、`conversationLens.test.ts`、`conversationTimelineRenderer.test.ts` | S2 | 截图；单测；键盘与读屏走查 |
| S5 Composer 进行中空稿一行 | `conversationLensDock.ts`、`conversationLensComposerChrome.ts`、`conversationLens.css` Composer 段 | S2；另一会话 WIP 已合入 | 截图；状态单测 |
| S6 Preview 空态与 Sources 标题栏 | `editorGroupWatermark.ts`（只传 `KeybindingLabel` 样式）；`sourcesFilesExplorer.ts` / `.css`、`sourcesTabsHost.ts`、`sourcesTabs.css` | 无；与视觉审查 V4 文件不重叠 | 截图；键盘与读屏；窄宽 |
| S7 产品弹出层统一与会话切换 | 参照输入布局里 Profile 已在用的工作台菜单（`attachComposerPicker`），不另做 dialog。会话切换改接这套菜单，并把 `turnCount` / `lastAccessedAt` 从列表 RPC 传到名单。History、Snapshots、Inbox 只对齐同一套菜单的圆角、细边、投影和行高。原生菜单设置下留下 `SelectBox` | S1；另一会话 WIP 已合入 | 截图；键盘、读屏；CSS 扫描 |
| S8 错误、不可用与加载态 | `sourcesFilesList.ts`、`sourcesFilesListStrings.ts` 及对应测试；`conversationLensDock.ts`、`conversationLensDockStrings.ts`、`conversationLensSessionBar.ts`（不可用说明，不藏 Permission / Model / Tools）；`navigatorAgentTreeEmptyState.ts`、`navigatorStub.css`、`navigatorTeamList.ts`、`navigatorAgentsView.ts` 与 `navigatorTeam.test.ts`。两处按 UI 设计原则 §6 第 5、6 条实现，不新建跨 contrib 的共享组件 | S3（同在 SessionBar）；另一会话 WIP 已合入 | 截图；单测锁住「错误只出一次」与文案；读屏 |
| S9 目录列表、筛选芯片与搜索框 | `enginePreferencesPane.ts` / `.css` 与 `engineToolsSection.ts`、`engineTriggerList.ts`、`engineClipboardList.ts`、`engineContextVariableList.ts`、`engineAgentsSection.ts`；`connectionDeviceList.ts` 与一份不跟 V3 重叠的新样式；Navigator 过滤框（`contrib/navigator/browser/`）；透镜切换与 `sourcesTabs.css` 的选中样式。Sources Staged / Changes 分组头等 V4 合入后再做。`connectionPreferencesPane.css` 等 V3 | S1；Sources 部分等视觉审查 V4；设备行样式等 V3 或改用新文件；透镜切换部分等 S3 | 截图；导航 22px、目录行 24px；导航计数仍是全量；键盘与读屏 |
| S10 Markdown 预览 | 新建产品内置扩展，只贡献 `markdown.previewStyles`（`extensions/*/package.json` 会打进本地内置扩展，`build/lib/extensions.ts:420-428`，不必改 `product.json` 外置清单）。去表格框线、长值换行、JSON 的 `<code>` 用弱化等宽字。类型图标要改 `yamlPreamble.ts` 或加 `markdown.previewScripts`，未选 §7 第 3 条的上游改动之前不做 | §7 第 3 条只决定要不要做类型图标 | 截图（含长 frontmatter、JSON 值、有序列表、行内代码） |

S0 提交按规则 3b、13 拆开：本稿的决策段落随方案提交；PRD-028、UI 设计原则 §10、`composer-and-inbox.md` 中描述另一会话未提交代码的句子用 `git add -p` 留给那批代码一起提交。

## 4. 实施要点

### S1 主题三档与活动栏样式

浅色主题按三档收拢。色值是起点，以前后截图定稿；组件 CSS 不写色值。

- chrome 档 `#F3F3F3`：`titleBar.activeBackground` / `inactiveBackground`、`panel.background`、`editorGroupHeader.tabsBackground`、`tab.inactiveBackground`、`tab.unfocusedActiveBackground` / `unfocusedInactiveBackground`，与已是 `#F3F3F3` 的侧栏、活动栏、状态栏、会话头连成一片，标题栏不再成独立横条。每列顶部的标题条（会话头、Preview 类别条、编辑器标签条）都归这一档；`previewCategoryBar.css:28` 与 `conversationNavigation.css:34` 已引用 `editorGroupHeader.tabsBackground`，随主题值一起变，不改 CSS。
- 画布档：编辑器保持 `editor.background` `#FFFFFF`；Conversation 画布在 S2 换独立 token。
- 输入卡档：`input.background` 保持 `#FFFFFF`。Cursor 取样是 `#FCFCFC`，这里有意取白，画布变灰后卡片自然更亮。
- 分隔线：S1、S2 之后 Navigator、Conversation、Preview、Sources 两两相邻都不同色，按原则五不画线，各 `*.border` 维持透明。
- 标题栏取样 `#EAEAEA` 与主题 `#FAFAFA` 不符：先用 DevTools 查是不是失焦色、Command Center 区域或另有覆盖，再定值。
- Command Center 改幽灵样式：`commandCenter.background` 与标题栏同色，`commandCenter.border` 透明，悬停用 `commandCenter.activeBackground`。保留它，快速打开是 IDE 密度的一部分。

活动栏只调颜色：`activityBar.activeBackground` 从 `#D6D6D6` 调浅到约 `#E6E6E6`（整格底与 8px 圆角底都由它画，`activitybarPart.ts:821-828`、`activityaction.css:116-127`）；`activityBar.inactiveForeground` 从 `#606060` 调浅到约 `#7A7A7A`，选中项仍用 `activityBar.foreground`。非高对比主题下竖条层是 `border-left: none`（`activityaction.css:93`），`activityBar.activeBorder` 不起作用，保持 `#000000`，现有测试断言不动。键盘焦点仍用 `activityBar.activeFocusBorder`。

弹出层与主按钮（同在主题文件，所以并进本切片）：

- 弹出层高亮：`quickInputList.focusBackground` 改中性灰（前景色约 8%），`quickInputList.focusForeground` / `focusIconForeground` 改成前景色。`2026-light.json:245` 的 `focusForeground` 是 `#FFFFFF`，底改灰、字不改就会白字灰底，主题测试同时锁住前景。Ctrl+P 和今天的会话切换下拉走这组 id（`defaultStyles.ts:206-208`，`quickInputService.ts:244-250`）。会话切换改接 Profile 的菜单之后，它的高亮改走 `list.hoverBackground`。右键菜单和这套菜单的悬停、键盘高亮都来自 `list.hoverBackground`（`defaultStyles.ts:247-248`，`menu.ts:711-720`），合并浅色主题里已是 `#00000014`（`workbenchThemeService.ts:415`），保持不动。`menu.selectionBackground` 只画按下态（`menu.ts:1161-1162`），改成同一中性灰，避免按下闪蓝。
- 弹出层边与影：`menu.border`、`editorWidget.border` 统一成同一中性细边；`widget.shadow` 从透明改为淡值，让浮层投影出现。它同时还被当成遮罩：快照遮罩 `conversationLens.css:522`、子代理遮罩 `conversationSubAgentOverlay.css:35`、对话框遮罩 `dialog.css:20`。这两处产品遮罩改成独立遮罩色，不复用阴影色，跟 S7 一起改（文件在 WIP 冲突域）。对话框遮罩按 [modal-mask-no-glass](modal-mask-no-glass.md) 另行处理，本稿不改 `dialog.css`。`listFilterWidget.shadow` 默认就是 `widgetShadow`（`listColors.ts:111-112`），淡阴影可以留，截图核对。编辑器滚动阴影是 `scrollbar.shadow`，不是这个 id。
- 主按钮：`button.background` / `button.border` 改中性近黑（约 `#1F1F1F`），`button.hoverBackground` 浅一档，`button.foreground` 白；深色主题反过来（近白底、近黑字）。焦点、选中、链接、进度条不动。`checkbox.*`、`badge.background`、`progressBar.background` 不引用它，不用改。
- 核对表不只看 CSS 里的 `--vscode-button-background`。还要列 `registerColor` 默认值引用 `buttonBackground` 的颜色：`agentsGradient.tintColor`、`agentsUpdateButton.downloadingBackground` / `downloadedBackground`（`sessions/common/theme.ts:67-105`），`chat.inputWorkingBorderColor1/2/3`（`chatColors.ts:106-118`），`inlineEdit.gutterIndicator.primaryBorder` / `successfulBorder`（`inlineEdits/theme.ts:70-109`）。以及 `asCssVariable(buttonBackground)`：工作区信任页选中色（`workspaceTrustEditor.ts:727`）、浮动菜单底（`floatingMenu.ts:40`）。梯度、进行中描边、行内编辑指示改去 `focusBorder` 或 `progressBar.background`。扩展里的突出安装钮是主按钮，可以留下。这些指示类没改完之前，不合入主按钮配色。改动落在各文件所属的切片里，S1 交核对表。

同步更新 `COLOR_THEME_LIGHT_INITIAL_COLORS`（测试要求它等于合并后的主题，否则启动首帧闪旧色）和主题测试里写死的 `panel.background` 等断言。深色主题取 `Dark 2026` 现有灰阶做同构的三档，测试里「深色只覆盖四个键」的断言随之放宽；具体值以深色截图定。高对比主题沿用上游，不覆盖。

### S2 Conversation 画布 token

- 新登记颜色 `conversation.background`：浅色、深色默认引用 `editor.background`，高对比默认引用 `editor.background`（未覆盖的主题外观不变）。产品浅色主题给 `#F8F8F8`，深色给比编辑器亮一档的灰，并进初始色表。
- 链路逐处换成 `var(--vscode-conversation-background, var(--vscode-editor-background))`：Part 底色 `conversationPart.css:15`；`conversationLens.css` 中画布与阅读列的选择器；置顶层底色与渐隐 `conversationTimeline.css:102`、`:110`；身份条 `conversationIdentityStrip.css:21`。不换的白名单：浮层（`conversationLens.css:443`、`:540`）、Diff 回退（`:4530`）、代码块与内嵌编辑器。
- 上游 `editorPart.ts:1115`、`editorGroupView.ts:2220` 会给 Conversation 内嵌 EditorPart 写内联 `editor.background`。先确认透镜根元素能完全盖住；盖不住时在产品 CSS 里限定 `.part.conversation` 覆盖，不改上游。
- 回退：截图比对后，若灰画布与白色 Preview 编辑器并排显得割裂，产品主题把 `conversation.background` 设回 `#FFFFFF`，其他切片不受影响。

### S3 对话头与身份条

- 会话名改常规字重；透镜切换选中态用前景色加淡底，不加粗，同一行不再有两处 600。
- 右侧图标常态 `descriptionForeground`，悬停或焦点转前景色；显隐规则不变（上一级、下一级常驻，其余窄于 450px 收进 `…`）。
- 身份条引擎芯片去描边，改为弱化文字加状态点；去掉身份条下方分隔线。引擎离线 / 失败的状态色保留。

### S4 用户回合卡与置顶提示

- 卡片：已落盘的用户回合去掉 `conversation-lens-turn--user-align-end`，占满阅读列宽、文字左对齐；底色 `input.background`，描边 `color-mix(in srgb, var(--vscode-foreground) 8%, transparent)`，`cornerRadius.large`，不投影，内衬 8–12px，左右间距用逻辑属性（`padding-inline` 等）。长文沿用 `conversationUserBubbleCollapse.ts` 的折叠。悬停描边加深一档。键盘焦点沿用现有防双环规则（`conversationTimeline.css:79-81`），高对比沿用 `contrastBorder` 规则（`conversationLens.css:2268-2297`）。
- 编辑：点卡、Enter / Space 进入 `turnEdit` 是 HEAD 已有行为（`conversationTimelineRenderer.ts:391-421`，带 `writesEnabled` 门闩），本切片不改。乐观行（`pending`）仍写 Sending…、不可点。
- 置顶提示：判定纯函数 `resolvePinnedUserPromptState`、可聚焦按钮、复制钮、点击只 `revealTurn` 全部不变。只改观感，让它与新卡片一致：内层不再复用 `.conversation-lens-turn-body--user-bubble`（`conversationTimelineHost.ts:161`），换独立类名，避免卡片样式串进来；底色用画布 token；写死的 44px（`conversationTimelineHost.ts:140`、`:1075`，`conversationTimeline.css:35`，`conversationLens.css:813`）改为按置顶层实测高度设 `scroll-padding-top`。
- 产品主题里的 `chat.requestBubbleBackground` 不再被用户回合消费；确认无其他消费方后，从产品主题删掉这项覆盖，并改 `theming.md`。
- 同步改 `lens-and-trajectory.md` 的用户卡、置顶提示两行与「贴列右缘」一句，以及 summary；改测试里对 `border: none`（`conversationLensCssScan.test.ts:269-276`）和右对齐类名（`conversationLens.test.ts:1743`、`:3370`）的断言。

### S5 Composer 进行中空稿一行

- 条件：会话进行中（列底 Dock，不是 PreFirst）、`composerPolicy` 为 `compose`、草稿为空且没有引用芯片、叶宽不小于 450px。满足时输入框与底栏合成一行：起始侧是 Tools，接着是输入框（占满剩余宽度），结束侧依次是 Permission、Model、放大输入、发送。Agent 在进行中本来就不出现。任一条件不满足回到两行。
- PreFirst 不变：居中、至少两行（52px），Agent 照常出现。
- 行数切换时保持阅读列贴底状态：贴底则切换后仍贴底，非贴底不跳动。
- 另一会话 WIP 的边框与投影写死了 `rgba`。本切片改成 token：静息描边与用户回合卡同一公式（前景色 8%），聚焦不改成蓝色描边，只把已有投影略加深（§7 第 2 条已选定；高对比主题仍用对比描边）。投影用 `--vscode-widget-shadow` 派生的极淡值。开工时按合入后的选择器再对一次行号。

### S6 Preview 空态与 Sources 标题栏

- Preview 空态：标题与说明的字号字重 HEAD 已合规（`editorgroupview.css:515-527`，上游 CSS，不动）。只去键帽框：在 `editorGroupWatermark.ts:451` 给 `KeybindingLabel` 传透明的 `keybindingLabelBorder`、`keybindingLabelBottomBorder`、`keybindingLabelBackground`，不改 CSS。只作用于 Preview 类别空态，普通编辑器组水印不变。
- Sources：Files 下那一行是 Files ViewPane 的标题栏，带标题和六个动作（New File、New Folder、Refresh、Collapse、Tree、List，`sourcesFilesExplorer.ts:473-590`）。隐藏这个标题栏，把六个动作挪到 tab 条右侧的 `filterSlot`（`sourcesTabsHost.ts:160`），只在 Files tab 激活时显示，省出一行。动作保留 tooltip、aria 名称和键盘可达。

### S7 产品弹出层统一与会话切换

- 参照（2026-10-11 用户选定）：输入布局里 Profile（Agent、Model）点开的就是对的弹出层。实现是 `attachComposerPicker` 打开的工作台菜单（`conversationComposerPicker.ts`）：24px 行、当前值打勾、和应用程序菜单同一套。不替换它，也不另做 `role="dialog"` 浮层。Permission 已经走同一函数，一并保留。Tools 列表仍是自己的浮层，维持 `composer-and-inbox.md` 的 240px 与 9 个及以上才搜索（`conversationLensComposerChrome.ts:224`）。
- 接入：History、Snapshots、Inbox 去掉 12px 圆角与写死的 `rgba` 投影，圆角、细边、投影、行高对齐这套菜单。行号以合入后的文件为准（当前 12px 在 `conversationLens.css:442`、`:539`）。
- 会话切换：改接同一套菜单，不另做带搜索框的选择器。这套菜单没有搜索框，会话切换也不加。选项主文仍是 `session.title`，不把别的文字写进 `<option>`（`getSessionSelectLabel` 读的是选项原文，`conversationLens.test.ts:528-533`；标题按钮也显示 `title`，`conversationLensSessionBar.ts:354-355`）。菜单行上可以在标题旁放弱化元信息：优先 `turnCount`，没有则用 `lastAccessedAt`，两个都没有就不显示。列表 RPC 上已有这两个字段（`universeAgentTypes.ts:100-109`），roster 映射时丢掉了，而且多数行 `turns` 是空数组（`conversationEngineRosterService.ts:1927-1933`），不能从回合里编首条消息来替换标题。当前会话用菜单自己的对勾。键盘沿用菜单。触发钮保留 `aria-label` Switch session 与 `aria-expanded`。`refreshSessionSelectOptions` 与 `suppressSessionSelect` 的语义照搬，提交的仍是选中下标。
- `hasNativeContextMenu` 为真时不挂这套菜单，留下原生 `SelectBox`（`createSessionSelectBox` 已把 `useCustomDrawn` 设成 `!hasNativeContextMenu`，`conversationLensSessionBar.ts:314-315`）。`attachComposerPicker` 现在在捕获阶段拦住按下和方向键，不看这个设置（`conversationComposerPicker.ts:94-131`）。复用到会话切换之前先补上这条判断，Profile 自己的三个控件也一起补。
- 上游菜单与快速选择的圆角、行高不改 CSS（§9）。快速选择行保持 22px。颜色只靠 S1 的主题 id。

### S8 错误、不可用与加载态

- Sources 文件列表：树模式读失败时，空态和状态行各写一遍（`sourcesFilesList.ts:504-512`）；列表模式只留空态并清掉状态行（`:671-672`）。改成有列表内容时只用顶部状态行，没有内容时只用居中空态。呈现为错误图标，加一行前景色说明（只对能确定的错误码给专门文案，其余用通用说明），加一个操作（重试）。原始 `getErrorMessage(error)` 进 tooltip 与可展开的详情，文字不再整段 `errorForeground`。保证不被状态栏截断（换行，容器可滚动）。同一切片改掉锁住原文的断言：`sourcesFilesList.test.ts:274`、`:308`、`:337`，`sourcesFilesListStrings.test.ts:24`。
- 会话不可用：在现有 “Session unavailable” 上补一句固定原因，对应 `isEngineConnected() && isEngineSessionReady()===false`（`conversationLensComposerChrome.ts:752-754`）。名单失败的 `catch` 把异常丢掉了（`conversationEngineRosterService.ts:1952-1964`），没有可展示的原始原因，不用 `getErrorMessage`。颜色用 `descriptionForeground`。Permission、Model、Tools 保持禁用和现有诚实空文案，不省略（PRD-015 验收 4）。SessionBar 上一级、下一级按合同常驻禁用。会话名保持前景色。`composer-and-inbox.md` 补上这句固定文案和「控件仍留在输入行」。
- Navigator 加载：空态容器继续用 `.navigator-stub-empty`（Agents / Team 的 DOM 查询靠这个类）。读代理树时再加 `.is-loading`，只让 `.navigator-stub-empty.is-loading::before` 藏起闪电图标；其它空态图标不动。文案仍是 “Reading agent tree…”。进度用视图自己的 `ViewPane.getProgressIndicator()`（`viewPane.ts:667-683`）；`NavigatorTeamView` 与 `NavigatorAgentsView` 都是 `ViewPane`。加载失败仍是失败文案，不加 `.is-loading`。
- 文案进各自的 `*Strings.ts`，带 `localize`；单测锁住「同一错误只出现一处」「原始错误码不在可见正文里」「不可用时 Permission / Model / Tools 仍在且禁用」。

### S9 目录列表、筛选芯片与搜索框

- 目录列表：按 [UI 设计原则 §5.3](../../docs/architecture/cross-cutting/ui-design-principles.md#53-工程表格与列表轨迹表sourcesnavigator首选项列表) 改 Engine 首选项各分区与 Connection 设备列表。分组头加弱化计数与至多一个次按钮，组体淡底容器，内容行收成 24px 单行（图标块、名称、同行说明、悬停 `…`）。左栏导航保持 22px。导航计数继续用全量条数、不含分组行（[engine-catalog](../../docs/systems/workbench/engine-catalog.md)）；「再显示 N 个」不改变这个计数，展开状态在分区内记住。设备列表不得为了只显示 5 行而藏起当前设备。键盘：↑↓ 在行间移动，「再显示 N 个」可聚焦。`connectionPreferencesPane.css` 是视觉审查 V3 的文件，等 V3 合入再改；在此之前设备行的新样式写到不与 V3 重叠的新文件。行高合同（Agents 28 / 44px、设备 36px）在代码改动的同一笔里同步 `engine-catalog.md`，代码未改前不改那篇的 HEAD 描述。Tools 分节 2026-10-16 工作区已从 48px 收到 28 / 44px，仍是双行、分组头仍全大写，见 [视觉审查 2026-10-16](../progress/visual-review-2026-10-16.md) V1。
- 筛选芯片：透镜切换、Sources tab、Engine 首选项分类改用 §5.7 的同一选中样式（中性淡底、不加粗）。透镜切换的 `role="tablist"` 与方向键行为不变。
- 搜索框：Navigator 过滤框去常驻描边，聚焦时按原则四出描边；Engine 首选项若有搜索，改成整宽圆角药丸。
- Navigator 视图标题的全大写不在本切片改，见 §6。

### S10 Markdown 预览与编辑器标题

- 属性表：Frontmatter 保持默认 `table`。样式去掉表格框线，长值换行，已有的 JSON `<code>`（`yamlPreamble.ts:195-196`）用弱化等宽字。只贡献 `markdown.previewStyles` 加不出类型图标；要图标就改 `yamlPreamble.ts` 的 `<th>` 输出或加 `markdown.previewScripts`，那是 §7 第 3 条，默认不做。
- 排版：按 [UI 设计原则 §5.8](../../docs/architecture/cross-cutting/ui-design-principles.md#58-文档预览markdown)。正文用 `fontSize.body1`（13px），标题用现有 heading 字号，不新造介于 13px 和 18px 之间的字号。阅读列约 760px 居中，列表悬挂缩进，行内代码与对话正文一致。
- 不在面包屑行加 `Preview / Source` 分段控件。预览和源文件已经是标题栏命令。分段控件要改上游标题布局，§9 不允许。

## 5. 验证

- 按 [UI 设计原则 §8](../../docs/architecture/cross-cutting/ui-design-principles.md#8-审查与验证)：每个切片在同一窗口尺寸下保存浅色、深色、高对比浅、高对比深的前后截图，存到 `dev/progress/cursor-visual-alignment-evidence/`；只用键盘走一遍；叶宽 300 / 450px 检查截断；窗口缩放 125% 抽验一次。
- S1：`scripts/test.sh --grep "<workbenchThemeService 套件名>"`，初始色等于合并主题；三档 id 同值断言。
- S2：扩展 `conversationLensCssScan.test.ts`，画布选择器不再直接用 `editor.background`，按 §4 S2 的白名单豁免。
- S4：置顶判定单测不变且全绿；新增卡片类名、置顶层独立类名、`scroll-padding-top` 跟随实测高度的断言；乐观行不可编辑仍成立。
- S5：PreFirst / 进行中空稿 / 有字 / 引用芯片 / 窄叶五种状态的布局类名；切换前后贴底保持。
- S6：Files tab 下动作在 tab 条、其他 tab 不出现；Tab 键能到达每个动作。
- S1 增补：主题测试锁住 `quickInputList.focusBackground` 与 `focusForeground` 都不是强调色或白色，`menu.selectionBackground` 的按下态不是强调色，`list.hoverBackground` 仍是中性灰，`widget.shadow` 非透明，`button.background` 为中性。附消费方核对表，含 `registerColor` 默认值和 `asCssVariable(buttonBackground)`。截图包含快照遮罩和子代理遮罩，确认它们不是一层淡影。
- S7：CSS 扫描锁住各浮层不写死 `rgba` 投影、圆角为 `cornerRadius.large`。Profile 的三个控件仍走 `attachComposerPicker`。会话切换单测覆盖：打开的是同一套菜单、选项原文仍是标题、菜单行元信息是 `turnCount` 或 `lastAccessedAt`、当前项对勾、没有额外搜索框、`aria-expanded`。`hasNativeContextMenu` 为真时 Profile 和会话切换仍是原生 `<select>`。Tools 搜索仍从 9 个开始。
- S8：见 §4 S8 末条；另截一张会话不可用、Sources 读失败、Navigator 加载同屏的前后对比。不可用时 Permission / Model / Tools 仍在。
- S9：目录行 24px、导航行 22px、导航计数仍是全量、「再显示 N 个」的展开与键盘焦点、当前设备不被藏起；透镜 tablist 方向键回归。
- S10：长 frontmatter、JSON 值、嵌套列表、行内代码、浅深两色截图。不要求类型图标，除非 §7 第 3 条选定改上游。
- 本地门禁按 [health-gates](../progress/health-gates.md)：`npm run compile-client`（大切片收尾 `npm run compile`）、`npm run eslint`、`scripts/run-unit-custom.sh`；主题测试不在 unit-custom 范围，单独用 `scripts/test.sh --grep` 跑；文档改动后 `python3 scripts/check-docs-health.py`。

## 6. 不做

- 不关四钮、不隐藏状态栏、不删状态栏条目、不去掉活动栏。
- 不改置顶提示的判定、可聚焦性、复制与点击行为（D3）。
- 不改 Preview 七类别条；不学 Cursor 只列已打开项。
- 不复制 Cursor 的图标、商标与像素级外观（PRD-028 验收 9）；不换 codicon。
- 不改选择器提交的下标，也不改选项原文。会话切换可以在原文旁边加 `turnCount` 或 `lastAccessedAt`。Tools 的搜索阈值和 240px 高度不动。S7 在另一会话 WIP 合入后再动。
- 不改上游菜单、快速选择、SelectBox 的 CSS 与结构，只走主题 id。快速选择行保持 22px。
- 不关上游视图头的全大写。`workbench.experimental.modernUIUppercaseViewHeaders` 只有 Modern UI 打开时才生效（`modernUI.contribution.ts:190`）。平时的大写在 `sidebarpart.css:32-34`，这个设置关不掉。原则二仍是上游视图头沿用上游。
- 不在 Markdown 面包屑行加 Preview / Source 分段控件。预览和源文件已经是标题栏命令。
- 不学 Cursor 侧栏底部的 Getting Started 引导卡（营销式卡片，见反模式第 1 条）。
- 不改编辑、发送、队列、Stop 的行为合同。
- 上游 CSS 只按 [UI 设计原则 §9](../../docs/architecture/cross-cutting/ui-design-principles.md#9-与上游组件的边界) 动；活动栏与标题栏只走主题 id。

## 7. 待用户确认

1. 活动栏是否同时开 `workbench.activityBar.compact`（图标和栏宽变小）。它改的是尺寸，超出「只改视觉样式」，未确认前不做。若做，用 `IConfigurationRegistry.registerDefaultConfigurations` 在自有 contribution 里登记（先例 `sessions/contrib/configuration/browser/configuration.contribution.ts:39`），不改上游默认值。
2. ~~Composer 聚焦描边是否改成中性色、不变蓝。~~ **2026-10-11 用户选定**：不画蓝色焦点框，发丝线不动，只把已有投影略加深；高对比主题仍用对比描边。设置钮淡底、28px 发送钮、12px 浮层圆角与 12.5px 字号同日回到现行规范。
3. Markdown 属性表要不要加类型图标。默认不做：内置扩展只贡献 `markdown.previewStyles` 就能去掉框线并改等宽字，本地构建会带上 `extensions/*/package.json`（`build/lib/extensions.ts:420-428`），不必改 `product.json`。类型图标要改上游 `yamlPreamble.ts` 或加 `markdown.previewScripts`，按 [ADR-007](../decisions/007-upstream-sync.md) 增加同步冲突面。未确认前不做图标。

## 8. 风险与回退

| 风险 | 防护 / 回退 |
|:-----|:-----------|
| 标题栏与侧栏同色后，窗口拖动区域不明显 | 标题栏高度与拖动区不变；截图检查菜单、四钮、搜索框仍可辨，必要时标题栏比侧栏亮 1% |
| 灰画布与白色编辑器并排割裂 | S2 回退：`conversation.background` 设回白色 |
| 上游内联 `editor.background` 在 Conversation 里留白缝 | 限定 `.part.conversation` 的产品 CSS 覆盖；不改上游 |
| 置顶层高度变化后 `scroll-padding-top` 不准，定位被遮 | 按实测高度设置，并对 `revealTurn` 与焦点滚动各加一条断言 |
| Composer 行数切换造成时间线跳动 | 切换前记录贴底状态并在布局后恢复；S5 可单独回退 |
| 与另一会话未提交的 Composer 改动冲突 | S2–S5 等那批改动合入后再开 |
| 深色主题只做了浅色的镜像，层级反了 | 深色单独取样定值，分别检查画布、chrome、卡片的明暗顺序 |
| 主按钮改黑后，梯度、进行中描边、行内编辑指示和信任页选中色跟着变黑 | S1 核对表包含 CSS 变量、`registerColor` 默认值和 `asCssVariable(buttonBackground)`；指示类改去 `focusBorder` 或 `progressBar.background` 之前不合入主按钮配色 |
| `widget.shadow` 非透明后，拿它当遮罩的地方变成很淡的一层 | 快照遮罩和子代理遮罩改独立遮罩色；对话框遮罩不在本稿；`listFilterWidget.shadow` 截图核对。编辑器滚动阴影是 `scrollbar.shadow`，不在这张表里 |
| 会话切换换掉 `SelectBox` 后丢失原生菜单模式与读屏行为 | `hasNativeContextMenu` 为真时留下原生 `SelectBox`；选项原文仍是标题 |
| 错误文案按类别归类不准，把别的错误说成权限问题 | 只对能确定的错误码给专门文案，其余用通用说明并保留详情 |

## 9. 只读审查与改稿

2026-10-11 用户选定：输入布局里 Profile 点开的弹出层是对的。它是 `attachComposerPicker` 的工作台菜单，不是另一套对话框。S7 改为保留它，会话切换改接同一套，不再加搜索框。

2026-10-11 增补稿经第二名只读 reviewer（`generalPurpose`）审查。父 agent 逐条核验 HEAD 后改稿。审查员把 Composer 选择器的弹出层角色记成 `dialog`（`conversationComposerPicker.ts:180`）；当前文件用的是工作台菜单，捕获阶段拦截在 `:94-131`。其余文件行号与 HEAD 相符。

- **Critical，全部采纳**：右键悬停色是 `list.hoverBackground`（已是中性灰），`menu.selectionBackground` 只画按下态；S1 改按下态和快速选择高亮，不把菜单悬停当成还是淡蓝。主按钮核对表补上 `registerColor` 默认值和 `asCssVariable(buttonBackground)`，梯度、进行中描边、行内编辑指示没改完不合入。会话切换不再用首条消息替换标题；元信息用名单上被丢掉的 `turnCount` 或 `lastAccessedAt`。
- **Important，采纳**：S5 删掉「聚焦色待确认」。稿面选定是不画蓝色焦点框、只加深投影，与原则四的 Composer 例外和 §5.2 一致；审查员按审查提示写成 `focusBorder`，那条提示对不上稿面，不采纳。§6 改为允许会话切换的行元信息，不允许改选项原文和提交；Tools 的 9 与 240px 不动。`hasNativeContextMenu` 为真时留下原生 `SelectBox`。验收 11 不再省略 Permission / Model / Tools。S8 写上 Sources 旧断言和 Navigator 的三个文件，加载态不拿掉所有空态的闪电图标，进度用 `ViewPane.getProgressIndicator()`。`widget.shadow` 的真实消费方改成快照遮罩、子代理遮罩和列表筛选阴影；编辑器滚动阴影不是它。目录列表 24px 不改导航 22px 和全量计数，不藏当前设备，`connectionPreferencesPane.css` 等 V3。原则一把筛选芯片和分组头次按钮划出「一律无框」。愿景原则 6 改成主按钮中性、强调色不给主操作。S10 默认只贡献预览样式；类型图标和面包屑分段切换拿掉。全大写开关只有 Modern UI 打开才生效，改入 §6 不做。`quickInputList.focusForeground` 的白字锁进主题测试。
- **Important，部分采纳**：审查员要求 `composer-and-inbox.md` 把 Tools 搜索改成 6、浮层最高改成 320px。用户没有改这条合同，Tools 保持 9 和 240px。审查员称筛选芯片违反反模式 9；反模式 9 说的是无数据的状态芯片，筛选芯片是选择控件，不采纳这一条，只在原则一为它和分组头次按钮开口。`engine-catalog.md` 的 28 / 44px 与 36px 是 HEAD 描述，代码未改前不改写成 24px，S9 实施时再同步。
- **Minor，采纳**：History / Snapshots 的 12px 行号改成 `:442`、`:539`，并写明开工前再对一次。

2026-10-11 首稿经一名只读 reviewer（`generalPurpose`）审查，父 agent 逐条核验 HEAD 后改稿：

2026-10-11 首稿经一名只读 reviewer（`generalPurpose`）审查，父 agent 逐条核验 HEAD 后改稿：

- **Critical，全部采纳**：首稿 S2 关 `workbench.layoutControl.enabled` 会去掉产品四钮（`layoutActions.ts` 的 `LayoutControlMenu`，ADR-006:28），已删。首稿 S4 要新做吸顶层，而 HEAD 已有 D3 置顶提示（`conversationPinnedUserPrompt.ts`、`conversationTimelineHost.ts`），且首稿的 `aria-hidden`、点击进编辑、顶边判定与 D3 冲突；已改为只改造观感，判定与交互不动。首稿 S5 单行漏了 Permission、未区分 PreFirst（PRD-015 验收 3、4，`composer-and-inbox.md` §1 的两行 52px）；已限定在进行中会话并列全控件。
- **Important，采纳**：主题初始色与主题测试进 S1；画布链路补 `conversationPart.css`、置顶层、身份条与上游内联色；分隔线改为不画（三列互不同色）；活动栏竖条在非高对比下本就不画，改为只调 `activeBackground` 与 `inactiveForeground`，紧凑模式转待确认；标签条与类别条明确归 chrome 档；Sources 改为整条 Files 标题栏并入 tab 条；Preview 空态只去键帽且不动上游 CSS；文档同步（UI 设计原则 §10 主题行、`lens-and-trajectory.md` 指针、`traceability.md`、阅读面方案注记）；S0 与 WIP 的提交拆分；Composer 写死 `rgba` 改 token、中性聚焦转待确认；§1 表措辞与取样来源；验证补高对比、缩放与 WIP 内测试。
- **Important，部分采纳**：reviewer 建议本轮就把 `lens-and-trajectory.md` 的用户卡、置顶行改成新行为。该文写的是 HEAD 实现，代码未改前改写会成不实陈述；本轮只加指针，正文随 S4 改。
- **不采纳**：reviewer 称截图只有两张，实际用户给了四张，reviewer 只收到其中两张。
- **Minor**：状态栏不改已写入 §2；`conversation.background` 高对比默认值、RTL 逻辑属性、CSS 扫描白名单、`chat.requestBubbleBackground` 去留已写入对应切片。docs-health 当前的 16 个 error 来自另一会话未入索引的 `review-2026-10-11-*` 方案，与本稿无关，但 S0 提交前须等其入索引。
