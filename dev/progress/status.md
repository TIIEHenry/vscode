---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-10-03
summary: "2026-10-02：Sources Files 列表模式只把树换成当前目录的一级列表，面包屑和标题操作保留。Part 宽至少 600px 时三个 tab 的筛选收到标题栏。不升 PRD。D24 仍只剩 SaveSkillContent。PRD-008 仍 blocked。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。2026-09-30 会话流水 → [归档](../archive/status-current-session-2026-09-30.md)。
## Current Session

- **Sources 列表与筛选**：Files 标题栏增加「按树查看 / 按列表查看」。列表模式仍是同一棵资源管理器，只把树换成面包屑所在目录的一级；文件夹单击进入该目录，文件打开方式不变，面包屑点到工作区外回到工作区根。模式存在工作区存储 `sources.files.listMode`，设置里仍没有 `sources.files.viewMode`。Sources 部分宽至少 600px 时，当前 tab 的筛选框在 Files / Changes / Review 和隐藏按钮之间，三个 tab 同一套 22px 输入，文字各自保留；更窄时筛选回到面板。不升 PRD。
- **Sources Files**：Files 页挂资源管理器同一棵树，标题是工作区名，带新建文件、新建文件夹、刷新和全部折叠，下面是面包屑。不注册活动栏图标，侧栏仍是主视图。单击和 Enter 仍按 `sources.editorOpenMode`（默认替换当前标签）。从这里打开或新建文件不带动侧栏定位。设置里不再提供 `sources.files.viewMode`。隔离窗口里看过两侧树、刷新、打开、新建和两个右键。不升 PRD。
- **子代理原列**：下一级或时间线打开已经在另一列的延伸标签时，聚焦那一列，不把同一张标签再开进当前活动列，也不改开对话框。没有标签时仍开对话框。不升 PRD。
- **引擎芯片**：StatusBar `status.conversation.engine` 与身份条共用 `getConversationEngineChipTone`。未连接、closed、pairingPending 是警告色；failed 是错误色，即使文案已经是 Waiting for pairing。连接中和已连接保持普通色。不升 PRD。
- **Files 列表**：Preview 当前标签没有资源、是 untitled，或资源没有文件提供者（例如 `sources-git-diff`）时，列表模式只显示 “Open a file to list its folder.”。不再 `fileService.resolve` 那个虚拟路径，也不把失败画成 “Unable to read workspace files”。有提供者的工作区文件和引擎投影文件仍列所在目录的一级。不升 PRD。
- **Agents 选中**：点一条档案只显示 `ListAgentProfiles` 已带回的 AGENTS.md，不调用 `SaveAgentProfile`。点选不再用残缺档案重写正文、工具和启用状态。Save 才写入。不升 PRD。
- **回合编辑**：去掉空白后与载入时要提交的正文相同（含合法引用尾块按同一规则重组），只退出编辑。不调用 `updateUserTurnText` / `EditMessage`，也不弹出失败。发送钮在这份正文未改时禁用。正文有变化仍保存。不升 PRD。
- **轨迹预览**：表的一行预览和检查器 Summary 对用户行去掉合法的 `<<<conversation-refs>>>` 尾块。只有尾块时表上是 “(empty)”。助手行和非法多标记保留原文。搜索仍匹配记录原文。不升 PRD。
- **轨迹 Overview**：分段只来自与表相同的最近窗口，上限已经丢掉的更早记录不再是可点的段。点击仍定位到该段首条；工具栏搜索若把它滤掉，会清掉搜索再定位。搜索已经能看见它时不动搜索框。不升 PRD。
- **Goal**：去掉空白后与当前目标相同，只关掉输入。不调用 `setSessionGoal`，也不把输入条画成 “Retry failed — could not post.”。清空仍取消已有目标。不升 PRD。
- **Skills 正文**：未保存时点来源分组行留在当前技能，不重载、不丢掉正文。未改时点分组行仍卸掉选中，回到选择提示。不升 PRD。
- **Review path-set 横幅**：勾上「仅未审阅」后，“Showing N files” 与列表行一致，已审行不再算进去。进度 “Reviewed x / y” 和 Mark all 仍按文本加 path-set，不因这颗开关改分母。不升 PRD。
- **待确认定位**：Inbox 芯片、回到会话和通知 Show 不再平滑 `scrollIntoView`。时间线立刻滚到该根；座位在窗口外（含更早的可应答工具）会先挂上再滚。座位不是最后一根时解开贴底，下一帧和尺寸变化不会把视口拽回底部。座位就是最后一根时跟随保持。不升 PRD。
- **Accept hunk**：对话审阅和底部 Panel 的两侧 diff 会同步移动光标。Accept 只认仍聚焦的那一侧；点按钮时焦点已离开编辑器，沿用最后一次聚焦侧记下的行。对侧同步过来的光标不再改块。从未聚焦过才退回修改侧。不升 PRD。
- **会话标题**：去掉空白后与当前标题相同，只收起输入，不调用改名，也不把输入条画成 “Retry failed — could not post.”。空白标题收起并说明不能为空。配对等待时即使输入框已打开也不提交。不升 PRD。
- **受阻会话 Fix CI**：列表里点 Fix CI，拉取请求没加载、已经没有失败检查、会话聊天没接住、或发送被拒绝 / 抛错时弹出 “Couldn't fix CI checks…”。取消不弹。发出去才标记已请求修复。进行中的再点不会再发一次。不升 PRD。
- **输入历史**：多行草稿或已召回的多行正文里，↑ 不在首行、↓ 不在末行时只移动光标，不再换成另一条历史。召回后光标停在该方向的边上，下一次同向键才能继续翻。带修饰键的方向键不翻。不升 PRD。
- **前台发送**：新建会话和会话内追问在调用返回前失败时弹出 “Couldn't send: …”。取消不弹，正文留在输入框。后台发送已经返回之后的失败仍只弹一次；交给后台之前就失败时补弹 “Couldn't send in the background: …”。不升 PRD。
- **编辑器来回**：后退和前进按导航栈记下的列打开。侧列审阅还开着时，从聊天列退回去留在侧列；再前进回到聊天列，不把根对话塞进侧列。不升 PRD。
- **新建会话 Enter**：补全列表可见但没有聚焦项、当前项不会改文字、或关闭了 Enter 接受时，Enter 仍发送。有可接受的当前项时 Enter 仍交给补全。不升 PRD。
- **Composer @**：没有匹配会话时 Enter 不再被列表吃掉，仍按键盘设置发送或换行。有当前项时 Enter 仍只选中，不发送。方向键与 Escape 不变。不升 PRD。
- **窄宽 More**：History、Snapshots、新建、删除收进 More 后，新建和删除跟栏上写钮同一道闸。pairing-hold 或 KEEP leftover 时这两项禁用，点了不会创建、删除，也不弹出失败。不升 PRD。
- **输入条失败**：Fix CI 读到的拉取请求还没加载，或 Reveal CI / Reveal Comments 失败时弹出错误。日志仍在。不升 PRD。
- **后台发送**：`sendNewChatRequest` / `sendRequest` 的 `background` 在提供者失败时弹出 “Couldn't send in the background: …”。取消不弹。调用方已经返回。前台失败仍只抛给调用方，由 composer 弹。不升 PRD。
- **提问座位**：必填单选是空白时，Submit、自定义框 Enter、或点选即提交会写出 “Can't submit — a required choice is empty.”，不调用 `onRespond`。改到非空选项后提示消失。写闸关掉时仍不解释、不提交。不升 PRD。
- **Composer @**：匹配会话 listbox 打开时，当前项写在仍聚焦的输入框和 listbox 的 `aria-activedescendant` 上。方向键只移动高亮，没有匹配项时也不再掉进输入历史。Escape 关掉并清掉这些属性。不升 PRD。
- **反馈提交**：聊天没有调用 `onRequestAccepted`，或 `acceptInput` 抛错时，弹出错误。评论留在 Accepted。已经接住的排队发送不报这句。不升 PRD。
- **新会话输入框**：空会话卡片仍用 `agentsChatInput`。Copilot 仍是描边套件胶囊，标签来自本机 Agent Host，不读引擎连接。桌面文件夹和 Issue/PR 用编辑器次级选择器尺寸（22px、无静息描边、无箭头）。语音仍走 `NewChatVoiceController`，圆形、按下色和断开绿色对齐编辑器麦克风。GitHub、附加文件夹和附加仓库仍是会话胶囊。页脚不变。手机类别行不动。这次没有重开窗口。未推远程。
- **启动**：交互「启动」用 `~/.universe-agent-studio-test`，并拉起钉死引擎 `127.0.0.1:50061`。`launch.sh` 只用于壳冒烟。仓库根 `/.sessions/` 不入库。
- **会话条**：上一级留在会话栏，退一层父代理。下一级在它旁边，弹出直接子代理；根上没有 parent 的 fork 也算孩子。两钮窄宽都不收进 More。编辑器来回和关掉延伸标签在该叶编辑器区，不关子代理对话框。上一级会等会话栏控件出现后再放进去。
- **打开文件**：资源管理器单击默认新开固定标签；Sources 单击和 Enter 默认替换当前标签。右键只留另一种。Preview 标签条有 `+`。Sources Files 是完整资源管理器树，不再是只读投影。从 Sources 打开或新建文件不带动资源管理器定位。
- **对齐**：人类工位、`loop/merge` 与字母槽 A–J 都在 `7fe2d92631e`。未推远程。C 槽只有 `dev/loop` gitlink 脏，不入库，不 `checkout -B`。
- **一拖二**：宿主按发起 lease 裁剪 `localPendingSends`，baseline 补齐 attribution；已决 permission 不再和待决座位叠成两次点击。
- **合入的 4 个提交**：浏览器单测模块加载失败改为非 0 退出；`ResolveTurn` / `ResolveAnchor` / `PtyStream` / `WatchConfig` 改 proto bytes；渲染进程跳过只能在 Node 加载的会话令牌测试；选择器把 `id` 放在 `class` 前。
- **D24**：仍开。`Connect`、`WatchConfig`、`ResolveTurn`、`ResolveAnchor`、`PtyStream` 已是 proto bytes。仍走 JSON 的只有 `SaveSkillContent`（引擎 proto 无该 RPC，不新增）。
- **十六路审查**：hold 切片已有对应提交在 `7cf1474419e`。方案 frontmatter 仍 `accepted`，不升 `implemented`。
- **PRD-008**：仍 `blocked`。`d8-evidence/7cf1474419e` 为 PARTIAL：回环曾显示 `Engine · Loopback`（不算通过）；Direct Address 停在 `Waiting for pairing`，主进程配对框未出现。
- **PRD-028 密度**：Sessions roster、轨迹表、Engine 首选项导航都是 22px 单行。轨迹表类型列是图标加正常大小写，表头无大写无底色；Engine 导航计数是弱化数字。Overview 已是 12px 分段条（文字在 tooltip 与 aria）。默认主题与其余验收未齐。本条不升 `implemented`。
- **槽 F**：轨迹 Overview 从形状加文字方块改成 12px 分段条。点击定位不变。不升 PRD-028。
- **槽 E**：Sessions Changes 在 `pairingPending` 时卸掉标题栏写钮，并在确认前拦住 `invokeChangesetOperation`。文件列表仍可留着。不升 PRD-007 / PRD-008。
- **槽 G**：Fix CI、处理评论、提交反馈在会话聊天不存在时弹出错误，不再只写日志后把按钮恢复成无事发生。Changes 菜单的 Fix Checks 同一句。不升 PRD。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **loop** | A–J 与 merge、agent-ide 在 `7fe2d92631e`。C 仅脏 `dev/loop` gitlink，不入库，不 `checkout -B`。 |
## 槽位（2026-10-02）

| 槽 | 状态 | HEAD |
|:---|:-----|:-----|
| merge、A–J | `idle` | `7fe2d92631e` |
| C | `idle` | 同尖；仅脏 `dev/loop` gitlink，不入库 |
| edit（人类 `agent-ide`） | 与 loop 槽同尖 | `7fe2d92631e` |
## Next
| 项 | 指针 |
|:-----|:-----|
| **loop** | D24 不因 `SaveSkillContent` 再切刀。不得宣称 leftover / pills 完成。打开身份 S1–S4 已落，方案仍 accepted，见 [D944](deferred-gaps.md) |
| **十六路审查** | 切片已落，方案仍 [accepted](../plans/review-2026-09-30.md)，不升 implemented |
| **PRD-008** | `d8-evidence/7cf1474419e` PARTIAL。下次要先让主进程配对框出现并点 Verified on Engine。全 PASS 之前不升档 |
| **Sources** | [sources-architecture](../plans/sources-architecture.md) P6/P7 已落，方案仍 accepted。Accept hunk S1 已落，不升 PRD-009 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
