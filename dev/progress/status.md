---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-10-02
summary: "2026-10-02：队列编辑与载入正文相同只退出，不再重写队列项。不升 PRD。D24 仍只剩 SaveSkillContent。PRD-008 仍 blocked。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。2026-09-30 会话流水 → [归档](../archive/status-current-session-2026-09-30.md)。
## Current Session

- **队列编辑**：去掉空白后与载入时要提交的正文相同（含合法引用尾块按同一规则重组），只退出编辑。不调用 `updateMessageQueueItemContent`，也不弹出失败。保存钮在这份正文未改时禁用。正文有变化仍保存。不升 PRD。
- **受阻指示器**：已经报过的 NeedsInput，后来才拿到审批 id，仍是同一次输入。不再因此重新亮起，也不把看过或忽略过的会话放回来。换成另一条审批仍会再出现。不升 PRD。
- **Agents AGENTS.md 引号**：保存时双引号字段按 JSON 字符串还原。换行、引号和反斜杠不再变成转义原文；本身带引号的值写出时也会加引号。单引号字段和缺字段清空不变。不升 PRD。
- **受阻会话 Fix CI 行**：草稿、已关闭或已合并的拉取请求不再显示失败计数、pending 计数和 Fix CI。点了也只说明是草稿或未打开，不发送。打开且非草稿时，已成功的检查不算进 pending。不升 PRD。
- **Agents 模型**：保存 Model 只写 `model` / `modelType` / `maxTurns`。空字段仍是显式空值，用来清掉档案上的旧值。不再把已加载的 AGENTS.md 解析后叠回去，以 `---` 开头的正文不会被裁成后半段，摘要里的换行也不会被改成转义。不升 PRD。
- **Dock 闸门**：空闲卸掉 `role` 之后，再进入配对保持或 KEEP leftover 列表失败，闸门重新可见却不再是 `status`，和初次挂载不一致。重新标上 `status`，并清掉错误色和 title。粘住的发送失败仍是 `alert`，不被配对文案盖掉。不升 PRD。
- **Overview Model**：首拉 `listModels` 还停在 Reading models… 时进入 pairing-hold，不再把这行占位当成 leftover。摘要收起，只留断连说明，也不再打第二次 `listModels`。已经数过的末次计数仍留着。不升 PRD。
- **权限座位**：不可重试的送达失败仍保持 pending，但不再标 Input needed，也不再画 Allow / Skip。摘要改为不能再次送出，错误原因留在座位上，不写成 Allowed / Skipped。可重试失败仍留按钮。不升 PRD。
- **Inbox 队列行**：只有未在编辑的 PENDING 标 Queued。失败行只写原因并留 Retry，上传只写百分比，正在发送写 Sending…，编辑中只写 Editing。不再把这些状态前缀成 Queued。不升 PRD。
- **Skills 换技能**：正文未改时点另一条，编辑区先清空上一条正文并关掉 Save，直到这条的 SkillInfo 回来。加载中保存不会把上一条写到新技能上。同一条重新加载仍留着已显示的正文。未保存时点另一条或来源分组行仍留在当前技能。不升 PRD。
- **Agents AGENTS.md**：删掉 summary、usage、detailLevel 或 description 后再保存，这些字段按空值清掉，列表摘要和正文不再写回旧值。未闭合的 frontmatter 不清字段。模型、工具和启用状态仍随档案带上。不升 PRD。
- **Direct Address**：端口须为 1–65535。空、0 或超出范围时，Add 与 Connect 只提示 “Enter a valid host and port.”，不写 profile，也不开始连接。不升 PRD。
- **时间线焦点**：更早的行不再把 `content-visibility` 和 `contain-intrinsic-block-size` 写成内联样式。键盘焦点停在屏外行时，样式表的 `:focus-within` 能把它展开，不再被 120px 占位夹住。最近三根、流式、编辑和待确认座位仍用 `--cv-visible`。不升 PRD。
- **上一级**：父级已经是延伸标签时，聚焦它所在的列，不在当前列再开一张。从延伸标签退上来时关掉正在离开的那张；对话框只关掉。父级还没有标签时，仍用父级替换当前延伸标签。不升 PRD。
- **Review 右键打开**：右键「Open in New Tab」或「Replace Current Tab」打开成功后标已审阅，和单击、Open Selected 一样。打开失败、返回 false 或过期时不标，并写出同一条打开失败状态。Changes 右键打开仍不标。不升 PRD。
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
- **新会话输入框**：空会话卡片仍用 `agentsChatInput`。附件、Agent 芯片、页脚模式 / 权限 / 分支、工作区行和语音按钮复用编辑器 view item。GitHub、附加文件夹和附加仓库仍是会话胶囊。`session.loading` 没有取消，发送钮不变成停止。相关单测已过。窗口在测试配置里看过菜单。未推远程。
- **启动**：交互「启动」用 `~/.universe-agent-studio-test`，并拉起钉死引擎 `127.0.0.1:50061`。`launch.sh` 只用于壳冒烟。仓库根 `/.sessions/` 不入库。
- **会话条**：上一级留在会话栏，退一层父代理。下一级在它旁边，弹出直接子代理；根上没有 parent 的 fork 也算孩子。两钮窄宽都不收进 More。编辑器来回和关掉延伸标签在该叶编辑器区，不关子代理对话框。上一级会等会话栏控件出现后再放进去。
- **打开文件**：资源管理器单击默认新开固定标签；Sources 单击默认替换当前标签。Preview 标签条有 `+`。Sources Files 可在只读文件夹树和当前标签所在目录的一级列表之间切换。从 Sources 打开标签不带动资源管理器定位。
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
