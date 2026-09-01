---
title: "Agent IDE 产品需求"
type: demand
status: accepted
phase: N/A
updated: 2026-09-01
summary: "PRD-001–PRD-016：默认窗产品壳已接受；轨迹/过程折/visualize 已接受；空会话与 session 窗口/tab 拟议；Agents 窗口 Chat 并排已接受；引擎、Diff、产品身份未决或阻塞"
---

# Agent IDE 产品需求

> 需求唯一正文。原则见 [vision.md](vision.md)。追踪见 [traceability.md](traceability.md)。

状态约定：`accepted` = 产品陈述已接受，代码可能已落但启动冒烟未完成，不得当成验证结论。`implemented` = 用户可观察行为已交付且有验证证据。`blocked` = 已知缺口，等待未决决策。`proposed` = 尚未接受。

## 已接受的现行壳需求

### PRD-001 以 Conversation 为中心

- **状态**：`accepted`
- **用户价值**：打开产品就能在对话里工作，不必先找到聊天插件。
- **用户可观察陈述**：用户打开默认桌面窗口时，中心工作区是 Conversation，不是右侧 Chat，也不是一张 Chat 编辑器标签。
- **产品验收标准**：
  1. 默认窗口中心可见会话标题条、时间线、输入区。
  2. 用户不能把中心 Conversation 理解成 Copilot Chat 标签页。
  3. 用户可以临时隐藏 Conversation；隐藏后仍能用四钮回到对话，而不是被送到 Chat 侧栏。
- **依赖或未决**：无。启动冒烟待验证，故保持 `accepted`。

### PRD-002 会话上下文

- **状态**：`accepted`
- **用户价值**：用户知道自己在哪个会话里，并能在多个会话之间切换。
- **用户可观察陈述**：会话标题条显示当前会话标题；用户可以在至少两个本地会话之间切换；无 History / Route / Snapshots 能力时这些控件不出现。
- **产品验收标准**：
  1. 切换会话后，时间线换成该会话的内容。
  2. 没有云端或引擎会话权威时，不出现「已同步远程会话」之类文案。
  3. 导航区里可以有配套会话列表，但它不是中心工作区。
- **依赖或未决**：真实会话权威依赖引擎（PRD-008），本条只约束无引擎时的本地上下文。

### PRD-003 时间线与输入

- **状态**：`accepted`
- **用户价值**：用户能阅读对话过程，并继续输入下一句。
- **用户可观察陈述**：时间线是当前会话的对话列表，角色可辨、可以滚动；输入区可以打字并发送，发送后用户这句话出现在当前会话时间线。
- **产品验收标准**：
  1. 时间线不是两行写死的说明文案。
  2. 发送后新回合留在当前会话，而不是跳到 Chat 插件。
  3. 若出现助手回复，必须能看出这是本地占位回复，而不能看起来像已经接上引擎。
- **依赖或未决**：真实助手回合依赖 PRD-008。思考/工具过程折见 PRD-013，不把它们画成与助手正文同级的气泡。空会话居中输入、Inbox 分簇、SessionConfig 显隐见 [PRD-015](#prd-015-conversation-空会话与输入面)。

### PRD-004 权限座位

- **状态**：`accepted`
- **用户价值**：用户能在对话里批准或跳过一次工具/写入请求，并留下记录。
- **用户可观察陈述**：权限请求出现在时间线里；用户点 Allow 或 Skip 后按钮消失，该条记录仍在列表中。
- **产品验收标准**：
  1. 待处理请求可见 Allow / Skip。
  2. 处理后不再留可点按钮。
  3. 无引擎时只改变本地状态，不声称已向远端授权。
- **依赖或未决**：真实引擎权限请求依赖 PRD-008。

### PRD-005 Preview 与 Sources Files

- **状态**：`accepted`
- **用户价值**：用户需要看文件时，能在配套区域打开预览和文件列表，而不把编辑器当成主流程。
- **用户可观察陈述**：窗口右侧配套区域上方是 Preview，下方是 Sources 的文件列表；点击列表中的文件会在 Preview 打开。
- **产品验收标准**：
  1. Files 列表是只读投影，不是再造一棵与资源管理器对等的主工作区。
  2. 资源管理器仍是导航区文件树的权威。
  3. 本条不包含 Changes / Diff 完成（见 PRD-009）。
- **依赖或未决**：无。

### PRD-006 默认无 Copilot / Chat 冒充

- **状态**：`accepted`
- **用户价值**：用户不会把 Copilot Chat 或右侧栏当成产品 Conversation。
- **用户可观察陈述**：新工作区默认不打开右侧栏；Chat 视图即使能被命令打开，也只是对照，不是产品对话。
- **产品验收标准**：
  1. 第一次打开默认桌面窗口时，右侧栏默认关闭。
  2. 打开 Chat 不会把中心 Conversation 换成 Chat 视图。
  3. 默认命令/启动路径不把用户带进 Chat 编辑器标签作为主对话。
- **依赖或未决**：无。命令/还原路径的卫生已有代码，启动路径待验证。

### PRD-007 诚实降级

- **状态**：`accepted`
- **用户价值**：能力缺失时用户看到空或省略，而不是假数据。
- **用户可观察陈述**：没有队列/任务权威时，收件箱不显示假任务列表；没有引擎时，界面不显示已连接引擎。
- **产品验收标准**：
  1. Queue / Tasks 要么整槽省略，要么诚实空（例如 “No queue”）。
  2. 无可用能力时，History / Route / Snapshots 不画假按钮。
  3. 文档与 UI 都不把未完成的引擎或 Diff 写成已齐。
- **依赖或未决**：无。

## 待验证说明

PRD-001 至 PRD-007 的代码已在 M0–M3 合入，但 D4 启动冒烟（T1–T3 与 M3 目视）仍阻塞于 compile。因此这些需求保持 `accepted`，不升 `implemented`。验证证据只写在 [traceability.md](traceability.md)。

## Agents 窗口需求

以下需求作用于 Agents 窗口的对话区，不改变上文默认窗产品壳的任何陈述。

### PRD-011 Chat 并排比对

- **状态**：`accepted`
- **用户价值**：用户在同一个会话里 fork 出分支、或查看子 agent 对话时，能把两个对话并排放在一起对照比较，而不是在标签间来回切换。
- **用户可观察陈述**：在 Agents 窗口中，fork 一个对话或把子 agent 对话打开到侧边时，新对话出现在原对话旁边并排显示，原对话保持可见；点击任一侧后该侧成为当前对话，相关状态（会话头的对话高亮、输入区）跟随聚焦切换；由比对触发的并排最多两个。
- **产品验收标准**：
  1. fork 后原对话仍然可见，新分支与其并排，两侧都可以继续阅读与输入。
  2. 把子 agent 对话打开到侧边时，同样形成并排，且不覆盖原对话。
  3. 已经有两个并排时再次触发比对，不出现第三个并排面板；新的比对对象落在非聚焦的一侧，该侧被替换的对话退为可回切的标签，不丢失。
  4. 聚焦在两侧之间切换时，当前对话标识与相关组件状态跟随更新，两侧输入区各自独立、互不串扰。
  5. 并排布局在重新打开该会话后恢复。
  6. 用户手动拖拽对话标签形成的并排不受本条上限约束。
- **依赖或未决**：仅对支持多对话的会话生效；并排上限后续放开为多个时不推翻本条陈述。

## 默认窗扩展

### PRD-012 Conversation 轨迹透镜

- **状态**：`accepted`
- **用户价值**：用户能检查模型实际收到的上下文（注入、附件 chip、环境/系统提示词、工具调用），而不把对话页变成检查器。
- **用户可观察陈述**：默认窗口 Conversation 标题条有不可关闭的「对话 | 轨迹」两页；默认停在对话。对话页是压缩过的阅读面。轨迹页是同一会话的详细列表：对话里隐去或折掉的相关项（注入、chip、环境、完整工具段、压缩分段）必须出现。长工具/思考段可用与对话页相同的过程折 chrome 收起以便分析，但不得把注入 / SYSTEM / compacted / 用户正文折进过程区而消失。
- **产品验收标准**：
  1. 两页都在、都不可关；默认着陆对话；切换后标题条与阅读列一起变，输入 Dock 仍在列底。
  2. 对话页时间线不含上下文注入卡、环境/系统提示词全文、工具 schema 目录；用户回合只显示用户正文。
  3. 轨迹页能看到至少：一条 context 注入、一条带附带 block/chip 的用户消息、一条环境/系统（SYSTEM）记录；选中一行可打开局部检查器（不占用 Bottom Panel）。
  4. 连续思考/工具在轨迹上可用过程折（与 PRD-013 同一套 overlay）；默认**展开**（分析用）；注入 / chip / SYSTEM / compacted 行始终在折外。
  5. 有父子工具时，subtool 相对父工具再缩进。
  6. pending 权限或新 Diff **不**自动切到轨迹。
  7. 无引擎、该会话也无 fixture 记录时，轨迹写诚实空态，不造假 Run，不空白标签页。
  8. 轨迹不是 Copilot Chat / ChatEditor / Bottom Panel inspect。
- **依赖或未决**：活数据依赖 PRD-008。过程折是显示优化，见 [PRD-013](#prd-013-conversation-过程折)；记录身份仍是各行，折壳不是列表键。

### PRD-013 Conversation 过程折

- **状态**：`accepted`
- **用户价值**：用户能扫一眼这一轮做了哪些思考和工具，再按需展开细节；同一套折也可用来分析轨迹上的长工具段。
- **用户可观察陈述**：连续的思考与工具收在可折叠过程区：外层摘要 → Thinking → 缩进工具行。这是显示 overlay，不是另一套列表身份。对话页默认收起；轨迹页可复用，默认展开。用户正文、权限座位、注入 / SYSTEM / compacted **不进**过程区。
- **产品验收标准**：
  1. 至少两层缩进可见：外层过程区 → Thinking → 工具行。
  2. 对话页外层默认收起；轨迹页同一 chrome 默认展开。
  3. 用户消息、助手散文、权限座位、轨迹上的 context/SYSTEM/compacted 都在折外。
  4. 无引擎时折内文案带 Stub，不出现假耗时。
  5. 折壳不是 Copilot Chat 列表行，也不是 `groupIdentity`。
- **依赖或未决**：活数据连续段依赖 PRD-008。分组按 Desktop ADR-046（平行 span overlay）。视觉对照 ThinkRail，不搬 React。两页共用 overlay 辅助函数，宿主 DOM 可以两套。`visualization` 折外，见 [PRD-014](#prd-014-conversation-图示卡visualize)。

### PRD-014 Conversation 图示卡（visualize）

- **状态**：`accepted`
- **用户价值**：用户能在对话时间线直接阅读架构图、路线图和方案对比，而不只是看 mermaid 源码或打开编辑器预览。
- **用户可观察陈述**：`visualize` 工具结果在 Conversation 时间线以图示卡呈现：`type=diagram` 为主题感知的 mermaid 图（可全屏 overlay 查看）；`type=comparison` 为并排方案卡（pros / cons / Recommended）。卡是折外主阅读面，不是过程折里的工具行，也不是轨迹检查表行。
- **产品验收标准**：
  1. 种子会话可见路线图卡（如冻结 / 进行中 / 未立项 flowchart）和至少一张 comparison 卡；标题/选项含 Stub，不冒充引擎。
  2. 图示卡无 You/Agent 气泡头；不是 Copilot Chat 列表行。
  3. 全屏为 Conversation overlay（Close + Reset），不是 mermaid preview editor tab。
  4. 扩展缺失时诚实降级为 fence + Stub 文案。
  5. 过程折（PRD-013）不把 `visualization` 收进 span；轨迹（PRD-012）不投影 `visualization`。
- **依赖或未决**：活数据依赖 PRD-008。引擎 admitted `visualize` **只**映射为 `visualization` kind，不进 `tool`/`reasoning` span。方案见 [thinkrail-visualize-port](../../dev/plans/thinkrail-visualize-port.md)。

### PRD-015 Conversation 空会话与输入面

- **状态**：`proposed`
- **用户价值**：空会话时用户能在安静画布上配好会话并开始说话；对话开始后输入不换一套控件，Inbox 也不挡阅读。
- **用户可观察陈述**：空会话（尚无可见消息）时，身份条（文件夹 · 引擎 · 分支）在居中输入卡上方；输入卡上可改 Agent、Model、Permission、Tools、Route；没有 Inbox / Goal / Stop。发出第一条消息后，同一张输入卡落到列底；身份条只出现在阅读列顶部（不在 SessionBar、不在输入工具栏）；Agent 不再出现在输入行；Route 出现在 SessionBar；Inbox 在输入卡上方左右分簇（左 Task · MessageQueue · Goal，右 Stop · 上下文环）。用户回合展示为纯文本卡片；点卡片才进入编辑。同一时刻只有一个输入。
- **产品验收标准**：
  1. 空会话没有 Inbox 浮层，也没有把输入永远钉在列底当成唯一布局。
  2. Init 与 During 共用一张 Composer：底栏同一高度；`+` 浅底圆、语音无底、发送实心圆；其余底栏控件无背景。
  3. Agent 只在空会话可改；首条发送后从输入行消失，不进 SessionBar。Route 只在空会话出现在输入行；首条发送后只在 SessionBar。
  4. Model、Permission、Tools 在 During 仍留在输入行。不画第二行「锁定 SessionConfig」卡片。
  5. Inbox 左簇 Task 在 MessageQueue 左侧；两列表互斥展开；无权威时整槽省略或诚实空，不造假任务。MessageQueue **列表与行交互**跟 Singularity MessageQueue 设计稿，不另造一套。
  6. 列表内编辑与队列编辑复用同一 Composer（含 Exit）；展示态用户卡没有按钮。
  7. 语音钮在发送左侧。语音转写队列不是 MessageQueue。
  8. 输入面不是 Copilot `ChatInputPart` 的一排 picker，也不是 Singularity 2×2 Material 配置卡。
- **依赖或未决**：活队列 / 路由策略 / AgentProfile 数据依赖 PRD-008。无引擎时 Route 与 Agent 用诚实空或 stub 选项，不假装已接到引擎策略表。MessageQueue 列表 UI SSOT = Singularity [message-queue-bar](../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md)（槽位仍以本仓 Inbox 为准）。方案见 [conversation-empty-hero](../../dev/plans/conversation-empty-hero.md)。

### PRD-016 Conversation session 窗口与 chat tab

- **状态**：`proposed`
- **用户价值**：用户在中间对话区用 tab 管理同一会话的根对话和 fork；点开子代理先在同窗整面看，需要时再最大化成 tab，并能沿 agent 层级跳转；必要时拆列或并排另一个会话；藏起中间区不会丢掉会话。
- **用户可观察陈述**：默认窗口中间 Conversation 里，每个会话是一扇窗口，有一条默认根 tab（不可关闭）。用户 Fork 在同一会话加一张 tab。Agent 拉起的子代理仍在该会话里；用户点击后在同一扇窗口里整面打开（钻入，不是新 tab），最大化才变成一张 tab。子代理 tab 顶部有 agent 层级面包屑；点击某一级切到该 agent，当前子代理 tab 被替换。每扇窗口有一键关闭根会话以外全部 tab 的按钮。用户 split 后同一扇窗口出现两列，每列自己的 tab。窗口并列展示的是另一个会话；藏起后回到单窗口，再打开该会话仍按原样显示。整块 Conversation 只能隐藏、不能关闭。前进后退有按钮也响应鼠标侧键；默认可在后退时关掉延伸 tab 或退出钻入。文件仍在右边 Preview。
- **产品验收标准**：
  1. 中间可见 chat tab（有延伸或 split 时）；不是 Preview 里的 Chat 编辑器标签。
  2. 默认根 tab 没有关闭；隐藏 Conversation 或隐藏某会话窗口后再打开，该会话的 tab 还在。
  3. 用户 Fork 不产生第二个根会话；新内容作为同一会话的 tab（引擎未接时不假装已 fork）。
  4. 子代理未点击时不出现新 tab、不钻入；点击后同窗整面打开且仍只有根 tab；最大化后才出现延伸 tab。
  5. 子代理 tab 顶有面包屑；点击祖先切到该 agent，当前延伸 tab 被替换（不叠新 tab）。每扇窗口能一键关掉根以外全部 tab。
  6. 用户 split 后仍是同一会话、同一扇中间窗口；不把 fork 拆进 Preview。
  7. 窗口并列是第二个会话；隐藏该窗后只剩一个会话窗口；再打开该会话窗口回来。
  8. Conversation 聚焦时 ←→ 与鼠标 4/5 在 chat tab / 钻入之间导航；Preview 聚焦时仍是文件历史。默认后退关闭延伸 tab 或退出钻入，不关根 tab。
  9. 「对话 | 轨迹」是每个 tab / 钻入页内的透镜，不是与 chat tab 平级的第三条。
- **依赖或未决**：活 fork / 子代理 catalog 依赖 PRD-008。形态见 [ADR-002](../../dev/decisions/002-conversation-session-windows.md)。方案见 [conversation-session-windows](../../dev/plans/conversation-session-windows.md)。不改变 Agents 窗口 [PRD-011](#prd-011-chat-并排比对)。

## 未决或阻塞

### PRD-008 引擎与会话权威

- **状态**：`blocked`
- **用户价值**：用户的对话、工具执行和权限应来自真实 Agent 引擎，而不是本地占位会话/占位回复。
- **用户可观察陈述**：用户发送后由引擎产生助手回合与工具请求；会话列表来自引擎诚实枚举。
- **产品验收标准**：未决。在引擎接线方案接受之前，本条不算成功，也不许占位界面冒充已接通。
- **依赖或未决**：引擎未接入本产品；禁止用内置 Chat 会话模型顶替引擎权威。

### PRD-009 Changes 与 Diff

- **状态**：`blocked`
- **用户价值**：用户需要在配套区域审阅 Agent 改过的文件。
- **用户可观察陈述**：Sources 有 Changes；文件级 Diff 有明确打开位置。
- **产品验收标准**：未决。在 Diff owner 选定之前，本条不算成功。
- **依赖或未决**：本仓 Diff 深查看仍落在编辑器区域，对照合同要底部面板；这是未选分叉，不是「已实现但待验证」。

### PRD-010 产品身份

- **状态**：`proposed`
- **用户价值**：窗口名称、图标与发行身份应是本产品，而不是上游 Code - OSS 默认身份。
- **用户可观察陈述**：用户能从窗口标题与图标认出 Agent IDE。
- **产品验收标准**：未决。本批不改产品名称与图标。
- **依赖或未决**：产品身份与扩展分发尚未决策。

## 明确排除（不是需求）

以下不是 `PRD-NNN`，不得在追踪表里标成待办需求：

- 整仓迁移 UniverseAgentDesktop 产品文档
- 把 Agents Window 当作默认产品壳
- 复制 Cursor / Codex trade dress
- Open VSX / Marketplace 完整扩展分发
- 在 `docs/product/` 重写 M0–M4 实现切片
