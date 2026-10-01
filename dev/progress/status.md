---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-10-02
summary: "2026-10-02：新建会话输入框在补全没有可接受项时，Enter 仍发送，不再变成换行。不升 PRD。D24 仍只剩 SaveSkillContent。PRD-008 仍 blocked。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。2026-09-30 会话流水 → [归档](../archive/status-current-session-2026-09-30.md)。
## Current Session

- **新建会话 Enter**：补全列表可见但没有聚焦项、当前项不会改文字、或关闭了 Enter 接受时，Enter 仍发送。有可接受的当前项时 Enter 仍交给补全。不升 PRD。
- **Composer @**：没有匹配会话时 Enter 不再被列表吃掉，仍按键盘设置发送或换行。有当前项时 Enter 仍只选中，不发送。方向键与 Escape 不变。不升 PRD。
- **窄宽 More**：History、Snapshots、新建、删除收进 More 后，新建和删除跟栏上写钮同一道闸。pairing-hold 或 KEEP leftover 时这两项禁用，点了不会创建、删除，也不弹出失败。不升 PRD。
- **输入条失败**：Fix CI 读到的拉取请求还没加载，或 Reveal CI / Reveal Comments 失败时弹出错误。日志仍在。不升 PRD。
- **后台发送**：`sendNewChatRequest` / `sendRequest` 的 `background` 在提供者失败时弹出 “Couldn't send in the background: …”。取消不弹。调用方已经返回。前台失败仍只抛错，不在这里弹。不升 PRD。
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
