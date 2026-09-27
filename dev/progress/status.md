---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-28
summary: "2026-09-28：UI 视觉审查与连续优化：信息密度与微间距体系重构、全工作台按压微动效（active tactile feedback）、以面代线消解 1px 细线、子代理浮层与架构图毛玻璃模态、Preview 与 Sources 空态页面补全。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session

1. **首选项遮罩预留与边界收拢**：收紧身份条视口判定阈值，防止工作台停靠身份条导致首选项遮罩高度被裁切；补充 ConnectionPreferencesPane 停靠身份条 fail-closed 单测（Commit `03678fb1a5b`）。
2. **Preview 类别空态 UI 补全**：为各类别（Overview, Terminal, Code, Web, Planning, History, Artifacts）补齐专属快捷动作按钮、图标与快捷键徽标；注入 `ICommandService` 调度真实命令；配置 active 按压（scale 0.97）与微间距；扩展 EditorGroupWatermark 单元测试（Commit `81619096a9a`）。
3. **全仓按压微动效与触感交互（Tactile Feedback）**：为全局 `action-bar` 图标、编辑器标签操作、会话身份条（标题重命名、新建会话、更多、快照、历史）、Trajectory 时间线记录与全景分段、Sources（变更列表行、文件列表行、待审切换）、首选项（连接与引擎按钮/卡片/标签）统一落地 active 按压动效（scale 0.90~0.99）与 4pt 间距体系（Commit `870fe003a6a`）。
4. **活动栏、子代理浮层与会话控件按压与毛玻璃质感**：为活动栏（Activity Bar）图标与指示器配置 active 按压（scale 0.90/0.94）与柔和边界；子代理浮层（SubAgent Overlay）升级 12px 圆角、毛玻璃模糊与柔和半透明描边；落地会话 Diff 展开切换、折叠按钮、Tool 取消/回复按钮与身份条芯片 active 触感动效（Commit `d43b71d5015`）。
5. **快速选择、通知弹窗、命令中心与状态栏按压触感和圆角层级**：快速选择（Quick Input）升级 12px 悬浮圆角并为列表行/动作按钮注入 active 触感反馈（scale 0.985/0.90）；通知弹窗（Toasts/Center）统一 8px 圆角与柔和阴影；标题栏命令中心注入按压微缩放；状态栏消除生硬焦点边框并增加 4px 微圆角与按压动效（Commit `0eccceaaf24`）。
6. **轨迹表与检查器微间距、源码空态信噪比及架构图全屏模态**：轨迹表（Trajectory Table）与检查器升级 8px 圆角、半透明描边与柔和阴影，增加全景导航折叠开关按压微动效；源码（Changes / Review / Stub）空态重构为舒适居中排版与呼吸内衬；架构图（Visualize）全屏模态升级 12px 圆角与毛玻璃背景（Commit `dc8de2645c9`）。
7. **基础 UI 部件触感与视觉质感升级**：为编辑器面包屑项与类型切换按钮添加 active 按压（scale 0.96）与柔和底边；模态对话框（Dialog Box）升级 12px 圆角、毛玻璃与半透明边框；悬浮窗（Hover Widget）升级 8px 圆角、柔和阴影与复制/操作按钮触感；树列表行（Tree Row）与面板头部按钮增加 active 触感反馈与柔和过滤框；消除输入框生硬外描边（Commit `15d5b6fe9b8`）。
8. **终端标签、查找浮窗与设置/输入器触感优化**：终端标签行（Terminal Tabs Row）与单标签项目注入 active 按压微动效（scale 0.985/0.95）；代码编辑器查找浮窗（Find Widget）升级 12px 圆角、半透明柔和边界与按钮触感反馈；设置编辑器（Settings TOC Rows）与快捷键表格行（Keybindings Rows）增加 active 触感反馈；会话底栏模型/权限下拉选择器补充 active 按压缩放（Commit `82b2d0a93fc`）。
9. **代码补全、参数提示、Peek 引用预览与行内聊天按压触感与柔边升级**：代码补全浮窗（Suggest Widget）与参数提示（Parameter Hints）升级 12px 悬浮圆角与半透明柔和描边（color-mix 8%），为候选列表行（scale 0.985）与更多/翻页/关闭按钮（scale 0.90）注入 active 按压触感；代码引用预览（Peek View）为可点击标题（scale 0.98）、工具操作项（scale 0.90）与列表行增加按压动效；行内聊天浮窗（Inline Chat）与行内触发灯泡按钮统一 12px/8px 圆角、柔和边框与按钮触感动效（Commit `02d50252774`）。
10. **编辑器标签与面板交互触感微动效补全**：为多编辑器标签页（Editor Tabs）及新建标签按钮注入 active 按压触感（scale 0.97 / 0.90）；同步覆盖 Modern UI Pill 标签微动效；为问题面板（Markers Panel）快速修复与行内操作按钮（scale 0.90）及表格行（scale 0.99）、评论面板（Comments Panel）操作按钮、调试控制台（REPL）懒加载展开按钮补齐触感反馈（Commit `e58e522a613`）。
11. **源代码管理（SCM）与调试工具栏/视图触感与柔边升级**：源代码管理（SCM View）的行内/头部操作按钮增加 active 触感反馈（scale 0.90）、历史记录分支芯片增加按压（scale 0.94）、输入框消解硬边焦点光晕；调试工具栏（Debug Toolbar）与悬浮框（Debug Hover）升级 12px 悬浮圆角与柔和描边（color-mix 8%），所有调试操作图标（scale 0.90）与配置下拉（scale 0.97）注入按压触感（Commit `423be41b708`）。
12. **会话聊天状态胶囊、输入栏柔边与选择器触感动效**：会话状态状态胶囊（Chat Pills）注入 active 按压触感（scale 0.95）与动作列表项触感（scale 0.985）；会话输入栏（New Chat Input Area）统一 12px 分层大圆角、8% 柔和描边与半透明聚焦光晕；会话底栏工作区与配置选择器（Session Chat Pickers）注入 active 按压缩放（scale 0.94）（Commit `f0e29bfbc7e`）。
13. **标题栏窗口控制、账户菜单、会话侧栏列表与文件同步触感动效**：标题栏窗口控制按钮（最小化/最大化/关闭）注入 active 按压微动效（scale 0.92），操作工具栏注入 scale 0.90 触感；标题栏账户芯片按钮注入 scale 0.92 按压与面板操作项触感；会话侧栏列表项（Session List Row）注入 scale 0.985 微缩放，列表操作按钮与标题栏操作注入 scale 0.90 触感；文件变更同步按钮注入 scale 0.92 触感（Commit `00ddf6ade30`）。
14. **侧栏与面板标题栏、插件、设置与终端交互项触感微动效**：全局 Part 标题栏动作按钮与侧边栏/辅助栏动作图标注入 active 按压反馈（scale 0.90）与 4px 微圆角；复合面板标题栏（Pane Composite Part）操作项与全局操作项补充 scale 0.90 触感；自定义树视图与面板过滤控制项注入 scale 0.90 触感；插件视图（Extensions Viewlet）消息按钮（scale 0.92）、关闭按钮（scale 0.90）、搜索操作项及扩展操作按钮（scale 0.94/0.90）补充触感动效；扩展详情页导航栏标签注入 scale 0.96 按压；终端标签列表删除按钮与行操作项注入 scale 0.90 触感；设置编辑器头部标签（scale 0.96）、搜索栏控制项（scale 0.90）、齿轮工具栏（scale 0.90）与列表操作项（scale 0.90）补齐触感微动效；快捷键编辑器搜索与行操作项统一 scale 0.90 触感（Commit `47a04852982`）。
15. **搜索视图、笔记本单元格工具栏、端口与上下文菜单触感微动效**：全局上下文菜单项（Menu Item）增加 active 按压触感（scale 0.98）；搜索视图（Search View）的替换折叠按钮（scale 0.92）、详情展开按钮（scale 0.90）、替换全部操作按钮（scale 0.90）、结果列表行（scale 0.985）与行内操作图标（scale 0.90）统一触感体系；笔记本编辑器（Notebook）顶部与单元格插入工具栏按钮（scale 0.92）、单元格标题栏工具项（scale 0.90）、全局笔记本工具栏（scale 0.92）与内核/语言标签（scale 0.95）增加按压反馈；端口转发视图（Ports View）表格行（scale 0.99）与操作图标（scale 0.90）补齐微动效（Commit `3b2dc05647c`）。
16. **会话侧栏动作、自动化卡片、定制工具栏与主机选择触感动效**：会话侧栏底部动作项（scale 0.95）与“New”紧凑新建按钮（scale 0.94）注入 active 按压微动效；AI 定制工具栏折叠头（scale 0.98）与展开箭头（scale 0.90）增加触感；自动化卡片（Automations Card）升级 8px 悬浮圆角与 active 缩放（scale 0.985），卡片操作按钮注入 scale 0.90 触感，全部标记已读注入 scale 0.94 触感；变更视图（Changes View）标题动作（scale 0.90）、操作按钮（scale 0.95）、文件列表行（scale 0.985）与行操作栏（scale 0.90）补齐微动效；新建会话提示选项卡片注入 scale 0.97 按压；执行脚本单选选项与弹窗操作按钮注入 scale 0.95 触感；远程主机选择底部抽屉项（scale 0.985）、关闭按钮（scale 0.90）、重新发现（scale 0.98）及标题栏主机选择药丸（scale 0.95）与连接按钮（scale 0.90）统一触感体系（Commit `155549c4d3a`）。
17. **下拉选框、数据表格、评审组件与欢迎页触感微动效及 Preview DI 健壮性**：下拉标签（scale 0.92）、自定义下拉列表行（scale 0.985）与数据表格行（scale 0.99）升级 4px 微圆角与 active 按压反馈；代码审查小部件（Review Widget）点赞反应按钮（scale 0.92）与标题栏动作项（scale 0.90）注入触感动效；交互式编辑器（Interactive Editor）运行按钮注入 scale 0.90 按压；欢迎页（Getting Started）分类卡片（scale 0.985）升级 8px 悬浮圆角，最近项链接（scale 0.96）、删除按钮（scale 0.90）与操作步骤行（scale 0.99）补齐触感体系；修复 EditorGroupWatermark 构造参数 DI 标记以保障 createInstance 单参数构造与全量编译通过（Commit `646de1313be`）。
18. **输入框操作栏、分段切换、单选组、图标选择器与视图空态触感微动效**：输入框内置操作栏图标（scale 0.90）、分段图标切换单元（Segmented Toggle Cell，scale 0.92）、单选按钮组（Radio Buttons，scale 0.96）与图标选择器（Icon Select Box，scale 0.90）统一 4px 圆角与 active 触感体系；编辑器占位与错误空态操作按钮（scale 0.96）、单标签页标题栏操作按钮（scale 0.90）、全局视图空态引导操作按钮（Views Welcome Buttons，scale 0.96）与 Sources 标题栏动作图标（scale 0.90）补齐微动效；全局顶部横幅操作链接（scale 0.94）与操作图标（scale 0.90）、测试管理器操作图标（scale 0.90）及设置项操作按钮（scale 0.96）全面落地触感反馈（Commit `5be72802049`）。
19. **会话变更视图、输入横幅、自动化弹窗、反馈与账户部件触感微动效**：CI 状态小部件折叠头（scale 0.985）、展开箭头（scale 0.90）、检查项列表行（scale 0.985）与行内操作图标（scale 0.90）统一触感；变更编辑器差异统计徽标（scale 0.96）、分支选择器（scale 0.95）、头部操作按钮与下拉项（scale 0.95）及变更动作项（scale 0.95）补齐微动效；文件视图空态操作按钮（scale 0.96）、无代理空态链接（scale 0.96）与空文件编辑器操作按钮（scale 0.96）升级触感；会话输入横幅导航按钮（scale 0.90）、横幅操作按钮（scale 0.95）与关闭按钮（scale 0.90）注入微动效；自动化表单分支插槽（scale 0.94）与弹窗确认按钮（scale 0.96）补齐微动效；阻塞会话工具栏（scale 0.90）、代理主机工具栏（scale 0.96）、账户/更新/Copilot状态按钮（scale 0.92/0.95）、主机选择抽屉关闭按钮（scale 0.90）与选项（scale 0.985）、GitHub 引用项与动作（scale 0.985/0.90）及代理反馈切换与操作按钮（scale 0.90/0.96）全面落地触感体系（Commit `f92addc4815`）。
20. **会话顶栏、子代理药丸、确认卡片与聊天欢迎页触感微动效**：会话顶栏与 Lens 会话条/窗口导航按钮（scale 0.90）统一触感体系；子代理“打开会话”药丸卡片（scale 0.96）与子代理确认占位按钮（scale 0.96）注入 active 触感反馈；工具确认卡片标题按钮（scale 0.985）、确认轮播工具标签（scale 0.96）与前后导航箭头（scale 0.90）升级触感；问题轮播选项列表行（scale 0.985）与总结项单选卡片（scale 0.985）补齐微动效；聊天欢迎页提示卡片（scale 0.96）与操作按钮（scale 0.96）、代码块操作栏（scale 0.90）与行内锚点小部件（scale 0.96）全面落地触感体系（Commit `e2a6dfaecd4`）。
21. **会话进程折叠、轨迹检查器、输入工具条与聊天卡片触感微动效**：会话进程折叠与思考折叠头（scale 0.97）、工具折叠头部按钮（scale 0.97）、轨迹检查器重试与返回按钮（scale 0.95）、确认操作按钮（scale 0.96）与消息队列项（scale 0.985）全面升级触感；会话叶隐藏控件（scale 0.90）与子代理浮层操作按钮（scale 0.92）补齐微动效；Diff 审查工具栏按钮（scale 0.96）注入按压反馈；聊天发送按钮（scale 0.92）、语音/麦克风控制按钮（scale 0.92）与附件操作按钮（scale 0.90）升级触感；聊天大卡片操作图标（scale 0.92）、计划审查操作与图标按钮（scale 0.96/0.92）、引导提示项（scale 0.92）、思考 Diff 按钮（scale 0.96）、目标横幅关闭（scale 0.90）、输入通知关闭与操作按钮（scale 0.90/0.96）、模型选择器切片（scale 0.95）、代理主机选择器插槽（scale 0.94）、模型反馈调查列表行与药丸按钮（scale 0.985/0.94）以及上下文用量小部件与操作栏（scale 0.92/0.97）全面落地触感体系。
22. **源码控制下拉、扩展列表、笔记本单元格状态、合并冲突与搜索过滤触感微动效**：源码控制（SCM）按钮下拉项（scale 0.97）与仓库/历史选择器（scale 0.95）补齐微动效；扩展视图列表行（scale 0.985）注入按压缩放；笔记本单元格状态栏命令项（scale 0.95）增加悬浮与按压反馈；合并编辑器（Merge Editor）冲突动作链接（scale 0.95）与接受切换方块（scale 0.92）升级触感；搜索视图过滤按钮（scale 0.92）补齐动效；设置编辑器新扩展按钮（scale 0.96）、建议标签（scale 0.95）与目标标签选项（scale 0.96）全面落地触感体系。
23. **源文件空态对齐、时间线树高度防塌缩与层级/调试/测试触感微动效**：源文件列表空态（.sources-files-empty）对齐居中卡片布局与舒适边距（80px min-height、24px 16px padding、12.5px font-size 与 1.5 line-height），与变更和审查列表保持完全一致；会话时间线树（conversation-timeline-tree）增加高度测量防塌缩保护，对于未完成初次布局或未挂载节点避免以 1px 覆盖动态高度，增加 3 帧缓冲重试并保留委托默认高度，tree.updateElementHeight 增加零高度防护与异常捕获；调用层级与类型层级树行项（scale 0.985）补齐微动效；调试调用栈行项（线程、会话、栈帧，scale 0.985）、断点项（scale 0.985）、断点开关方块（scale 0.92）与监视/变量表达式行项（scale 0.985）升级触感；标记与问题视图树行项（scale 0.985）与过滤器按钮（scale 0.92）补齐动效；测试管理器树行项（scale 0.985）与覆盖率单测切换器（scale 0.96）注入微动效；评论面板树行项（scale 0.985）、大纲符号树行项（scale 0.985）、REPL 调试控制台输出行（scale 0.985）与来源链接（scale 0.95）以及面包屑下拉选择器列表行项（scale 0.985）全面落地触感体系。
24. **时间线树行、自定义视图复选框、通知中心按钮与菜单栏下拉触感微动效**：通用时间线视图（Timeline Tree View）行节点（scale 0.985）与自定义视图树行节点（Custom View Tree Node Item，scale 0.985）及复选框（scale 0.92）补齐微动效；通知中心与通知 Toast 工具栏操作图标（scale 0.90）、操作按钮（scale 0.96）及通知列表行（scale 0.99）注入触感按压；窗口顶部菜单栏标题项（scale 0.96）与默认下拉组合操作项（scale 0.96）全面落地触感体系。
25. **资源管理器、已打开编辑器、快速输入复选框/动作及Chat/Agent组件触感微动效**：文件资源管理器（File Explorer）列表行项（scale 0.985，重命名编辑态安全豁免）与已打开编辑器（Open Editors）行项（scale 0.985）及关闭/保存动作图标（scale 0.90）注入微动效；快速输入（Quick Input）全选与列表复选框（scale 0.92）、列表行/树行内操作图标与自定义开关（scale 0.90）升级触感并防护多层触发；Chat 编辑覆盖浮层动作标签（scale 0.95）与行内解释气泡浮层（Explanation Widget）头部（scale 0.99）、阅读指示/开关/关闭/回复按钮（scale 0.90）与条目行（scale 0.985）补齐动效；Agent 会话列表（Agent Sessions Viewer）行项（scale 0.985）、标题/分节工具栏图标（scale 0.90）与审批操作按钮（scale 0.96）注入微动效；Chat 会话选择器（scale 0.96）、Chat 视图标题操作栏（scale 0.90）、Prompt 时间线吸顶标题（scale 0.97）与 Gutter 跳转/Diff 按钮（scale 0.96）、PR 卡片标题与富文本链接（scale 0.97）、Chat 确认部件列表行与按钮（scale 0.985/0.96/0.92）、Plan 审查评论条目与移除按钮（scale 0.985/0.90/0.96）、终端工具进度操作项与显示链接（scale 0.90/0.96）、代码块漏洞折叠头（scale 0.985）与思考折叠头部（scale 0.96）全面落地触感体系。
26. **面板折叠头、复合部件、标题栏工具条及会话空态触感优化**：会话设置欢迎对话框操作按钮（scale 0.96）与 Open in VS Code 标题栏小部件（scale 0.95）注入微动效；Agent 会话操作部件（Action Widget）列表行项（scale 0.985）升级触感反馈；屏幕阅读器检测提示按钮与取消图标（scale 0.96/0.90）补齐动效；侧边栏/面板手风琴折叠头（Pane Header，scale 0.992）增加平滑按压微动效；面板复合部件栏选项卡（Panel Composite Tabs，scale 0.96）与空面板引导动作按钮（scale 0.96）补齐触感；标题栏相邻与更新工具条图标（scale 0.90）统一微动效；会话代理面包屑项（Conversation Agent Breadcrumb Item，scale 0.96）与架构图对比卡片（Visualize Option Card，scale 0.985）注入触感微动效；统一会话历史空态（.conversation-sessions-empty）为居中卡片（min-height 80px、padding 24px 16px、font-size 12.5px、line-height 1.5），与 Sources 变更/审查/文件空态完全对齐。


> **后注（2026-09-21 · UA 工具结果 metadata_json 入站，ADR-395 S4）**：ChatSync `decodeToolResultEvent` 解 field 6 `metadata_json` → 域模型 `metadataJson` → demux `parseMetadataJson`（fail-closed `{}`）→ view-patch 并行 `toolCallMetadataMap`（vendored sessionView 本体不动）→ `ItemAttribution.metadata` → 时间线 `file_edit` 行 diff stats 徽章 + `parseUnifiedDiff`/`DiffEditorPool` 展开区（折叠行与独立行两路）。测：node 三套 11+26+10 全绿；transpile/eslint/layers 0；browser 测试已写未跑（需浏览器 runner）。**注意**：① UA envelope `ToolResultBlock` 尚无 metadata 字段，主时间线需等 UA S5（envelope 持久化+回放）供数，当前仅 ChatSync 聚合路径有值；② 本 commit `378b9e6c` 的 `sessionViewHost.ts` 误带入了并发会话的 fail-closed 修复 hunk（`git add` 覆盖了 `apply --cached` 的部分暂存）——该修复已随本 commit 推送，配套 reopen 测已随 `b6264a3cb06` 入库（11/0）；③ L3 `tool_call_lifecycle` 的 `metadata_json` 不解码是有意选择（注释已注明 envelope 路线）。

### 已合入（`MERGE_SHA` 见关仓；compile-client 0）
| 切片 | 提交 |
|:-----|:-----|
| **A SessionStream / L2** | 16/23/30–32/34–39/44/46/50–52；envelope leftover |
| **catch** | D677–D751、D753–D782、D784–D821、D823–D829、D834–D835、D837、D839–D841、D843–D844、D847、D850–D851、D854–D858、D860–D868、D871、D875–D876、D881、D883、D886、D895、D898、D917、D922、D939、D943、D955、D964、D972、D974、D978、D980、D983、D1015、D1032、D1254、D1258、D1278、D1294、D1295（D752 仍不入库） |
| **UA chrome** | 人类 `agent-ide`：Maximize Inbox 文档流、pairing-hold 禁 Connect、Diff SIDE_GROUP、live SAS/Stop 可达、本地 health-gates 门禁说明 |
| **四份方案** | 活流 decoder/thinking 已与 SessionStream 波重叠，Chat 11/13/20 与 recover 仍开；拨号 / 绑定叶 / Sources 打开身份未实施。跟踪 [D944](deferred-gaps.md) |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **loop** | leftover 未完成。关仓代码尖 `dd33706fb00` 已合进人类工位，本地文档与工作区提交仍在。A/B/E/F/G/H/I/J `idle`。C `blocked`（仅脏 `dev/loop` gitlink，不入库）。D `occupied`（`592fa2cddbb` 保留本地合并，未推）。D752 不入库。 |

子 agent 发现（扫描笔记；D724 在延期表已 closed，D736 / D739 / D740 为 skipped，都不是当前阻塞）：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/Watch/Resolve/Pty 仍 JSON |
| setRemoteEnvironment | `await` 的是 `Promise[]`，不会等各 host；应 `Promise.all`，不是 leftover |
| D736 extensions | 合法 leftover <4（veto PromiseLike.then、latency openEditor）；extensions 跳过。veto then 回调抛错会未处理；openEditor 可裸拒 |
| extHostTask fetch | `fetchPromise.then` / `Promise.all(...).then` 只 resolve，reject 挂起外层 Promise（D724 文件未动） |
| CodeMain.startup | `main()` try/catch 接不住 `startup()` async reject（D740 未凑刀） |
| native loadURL | `openChildWindow` `window.loadURL` 无 catch（D739 native 仅 1 点） |
| treeView tooltip | `treeView.ts` resolve.then reject 不拒外层 tooltip Promise |
| breadcrumbs catch | 自定义 catch 会 fire-on-error，不能直接改 D480 双链 |
| createEditorInset | 协议 `$createEditorInset: Promise<void>` vs `$disposeEditorInset: void` |
| theme leftover | D751 已双链；assigned/two-arg/Watch 仍跳过 |
| localTerminalBackend revive | `localTerminalBackend.ts` revive `.then` 只 `r()`，reject 挂起 `Promise.all` |
| notebook custom catch | `notebookEditorModel.setSaveDelegate().catch(log)`；stickyScroll `init().catch(console.error)` |
| userDataProfile | `onProfileAwareDidUpdateExtensionMetadata` 缺括号；`replace('/\\s+/', '_')` 替换字面量 |
| terminalContrib | 赋值 `_osBackend` reject 挂起后续 await；chat `Promise.all(getCodeBlockInfo)` leftover reject 未处理 |
| dialogs | `showSaveDialog` 在 `pickResource` reject 时外层挂起；`onDidAccept` reject 卡住 resolving；`updateItems` reject 留 `busy`；`preferredHome` 把 Promise 打成 `[object Promise]` |
| TextMate progress | debug progress `new Promise` 永不 settle |
| workspace Resolve | `resolveCanonicalUris` / `resolveAuthority` `.then().finally()` leftover reject 仍未处理（Resolve 跳过） |
| host restart | browser `restart()` 未 return/await `reload()`，调用方提前 resolve |
| variableResolver | `columnNumber` 抛 `Error`，`lineNumber`/`selectedText` 抛 `VariableError` |
| timeline handleRequest | 空 `catch` 吞掉 provider 失败 |
| workingCopy whenReady | 赋值 `resolveBackupsToRestore()` / leftover `limiter.queue` reject 可未处理 |
## 槽位（2026-09-26 关仓）

| 槽 | 状态 | HEAD |
|:---|:-----|:-----|
| merge | `parked` | 推送后的 `origin/agent-ide`（含本槽位账；代码尖 `dd33706fb00`） |
| A B E F G H I J | `idle` | 同推送后的 `MERGE_SHA`，干净 |
| C | `blocked` | `34b6ca17caa`，仅脏 `dev/loop` |
| D | `occupied` | `592fa2cddbb`，未推 |
| edit（人类 `agent-ide`） | 已合并 | 含 `9128b870dbe` 与本地 `1fe23f074bd`、`e1a637e8aa8` |

## Next
| 项 | 指针 |
|:-----|:-----|
| **loop** | D24 仍开。不得宣称 leftover/pills 完成（pill 与叶级 SessionBar 代码在仓，方案未升 `implemented`）。四份修补见 [D944](deferred-gaps.md) |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
