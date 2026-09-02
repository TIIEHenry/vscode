---
title: "Agent IDE 产品需求"
type: demand
status: accepted
phase: N/A
updated: 2026-09-02
summary: "PRD-001–PRD-016 默认窗产品壳已接受；PRD-003/004/007 增流式、提问座位、两层连接态验收；PRD-005 收进 Changes/Review 列表；PRD-002 Route 以 PRD-015 为准；PRD-009 Diff 归属已接受；PRD-017–021 accepted（017 存储落点 / 020 上限已裁定）；PRD-008 接线方案已签收、本条仍 blocked 待接通证据；产品身份排引擎波后；PRD-022 Navigator 引擎段 / PRD-023 Sources Review 审阅进度与归因 accepted；PRD-024 Connection Hub 远程引擎连接 proposed（H0 @2026-09-02）"
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
- **用户可观察陈述**：会话标题条显示当前会话标题；用户可以在至少两个本地会话之间切换；无 History / Snapshots 能力时这些控件不出现。Route 控件的位置与无引擎行为以 [PRD-015](#prd-015-conversation-空会话与输入面) 为准（Active 态在 SessionBar，无引擎时为诚实空或 stub 选项，不伪装成已接到引擎策略表）。
- **产品验收标准**：
  1. 切换会话后，时间线换成该会话的内容。
  2. 没有云端或引擎会话权威时，不出现「已同步远程会话」之类文案。
  3. 导航区里可以有配套会话列表，但它不是中心工作区。
  4. History / Snapshots 在无能力时整槽省略；不与 Route 混用同一条「不出现」规则。
- **依赖或未决**：真实会话权威依赖引擎（PRD-008），本条只约束无引擎时的本地上下文。会话跨重启是否保留见 [PRD-017](#prd-017-本地会话持久化)。2026-09-02 修订：原文「无 Route 能力时不出现」与 PRD-015「Active 态 Route 在 SessionBar」冲突，以 PRD-015 为准。

### PRD-003 时间线与输入

- **状态**：`accepted`
- **用户价值**：用户能阅读对话过程，并继续输入下一句。
- **用户可观察陈述**：时间线是当前会话的对话列表，角色可辨、可以滚动；输入区可以打字并发送，发送后用户这句话出现在当前会话时间线。
- **产品验收标准**：
  1. 时间线不是两行写死的说明文案。
  2. 发送后新回合留在当前会话，而不是跳到 Chat 插件。
  3. 若出现助手回复，必须能看出这是本地占位回复，而不能看起来像已经接上引擎。
  4. 引擎接通后，助手回合可以**流式增量**出现在时间线；尚未完成的回合可辨（有进行中标识），完成后与历史回合外观一致；用户在流式期间展开或收起的过程折、切换的透镜不因新增量而重置。无引擎时不出现任何流式或进行中态。
  5. 用户发送后，这句话先以「发送中」占位出现在**发起它的窗口**，被引擎确认后变为正式回合；发送未被受理时给出明确失败文案，不静默、不写「已发送」。
- **依赖或未决**：真实助手回合依赖 PRD-008。思考/工具过程折见 PRD-013，不把它们画成与助手正文同级的气泡。空会话居中输入、Inbox 分簇、SessionConfig 显隐见 [PRD-015](#prd-015-conversation-空会话与输入面)。验收 4–5 的实施见 [conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md)（2026-09-02 增补）。

### PRD-004 权限座位

- **状态**：`accepted`
- **用户价值**：用户能在对话里批准或跳过一次工具/写入请求，并留下记录。
- **用户可观察陈述**：权限请求出现在时间线里；用户点 Allow 或 Skip 后按钮消失，该条记录仍在列表中。
- **产品验收标准**：
  1. 待处理请求可见 Allow / Skip。
  2. 处理后不再留可点按钮。
  3. 无引擎时只改变本地状态，不声称已向远端授权。
  4. 引擎向用户**提问**（Ask-user：单选 / 多选 / 自定义答案）与权限请求是两种座位：提问座位显示问题与选项，用户作答后按钮消失、问题与答案留在记录里；提问不能被画成 Allow / Skip，权限也不能被画成问题。
  5. 引擎接通后，Allow / Skip / 作答必须真正送达引擎；送达失败时座位回到可操作态并说明原因，不得显示「已授权 / 已回答」。
- **依赖或未决**：真实引擎权限请求依赖 PRD-008。验收 4–5 见 [conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md)（2026-09-02 增补；提问座位对照 Desktop ADR-018 的 question ≠ permission 分家）。

### PRD-005 Preview 与 Sources

- **状态**：`accepted`
- **用户价值**：用户需要看文件时，能在配套区域打开预览、文件列表和变更列表，而不把编辑器当成主流程。
- **用户可观察陈述**：窗口右侧配套区域上方是 Preview，下方是 Sources，Sources 有 **Files | Changes | Review** 三个 tab。Files 是工作区文件的只读列表投影；Changes 是 SCM 变更资源的列表投影，可以在列表里 stage / unstage 并在底部一行 commit；Review 是同一变更集的只导航列表，面板顶有说明该面只读；审阅进度与归因见 [PRD-023](#prd-023-sources-review-审阅进度与归因)。Files 行点击在 Preview 打开文件本体；Changes / Review 行点击打开该文件的 Diff，归属与移动规则见 [PRD-009](#prd-009-changes-与-diff)。各 tab 顶有文件名 / 路径子串筛选。
- **产品验收标准**：
  1. Files 列表是只读投影，不是再造一棵与资源管理器对等的主工作区；资源管理器仍是导航区文件树的权威。
  2. Changes 的 stage / unstage / commit 走 SCM 提供者（git）已有命令，不另造 SCM 状态。
  3. 本条只管三个列表与 Files 的打开；Diff 的打开位置、移动与审阅能力全部属 PRD-009，本条不重复验收。
  4. Review 不显示假 review comment 或假评审状态；无 SCM 提供者时三个 tab 诚实空。
- **依赖或未决**：Diff 归属见 PRD-009。HEAD 的 Changes / Review 行在有 SCM 资源时已经经 `ISCMResource.open()` 在 Preview 打开 Diff（即 ADR-005 的默认归属），「移到对话窗口 / 底部」与默认归属设置待 `sources-changes-diff` plan；Review 引擎见 PRD-008。2026-09-02 修订：把已落地的 Changes / Review 列表投影收进本条；原文只写 Files，代码先于需求，属规则 10a 的补录。

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
  2. 无可用能力时，History / Snapshots 不画假按钮；Route 按 [PRD-015](#prd-015-conversation-空会话与输入面) 允许诚实空或带 Stub 标识的本地选项，但不得暗示已接到引擎策略表。
  3. 文档与 UI 都不把未完成的引擎或 Diff 写成已齐。
  4. 连接态分两层、各说各的：**连接级**（是否接到引擎）显示在状态栏 / Engine 页；**会话级**（当前会话的订阅是否同步）显示在会话标题条，取值为「未连接 / 同步中 / 已连接 / 降级（附原因）/ 已断开（附原因）」五者之一。只有会话级「已连接」可以使用「已连接」措辞；不得用任一层的状态冒充另一层。
  5. 会话订阅断开后，时间线保留断开前的内容只读可见，并在列顶明示「显示为断开前快照」；不得显示「已同步」，也不得把断开后的内容换回本地占位会话。
- **依赖或未决**：无。验收 4–5 见 [conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md)（2026-09-02 增补）。

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
- **用户可观察陈述**：每个 chat 页（含子代理对话框）有不可关闭的「对话 | 轨迹」两页；默认停在对话。会话切换在窗口 chrome，不随 tab 复制。对话页是压缩过的阅读面。轨迹页是同一 chat 的详细列表：对话里隐去或折掉的相关项（注入、chip、环境、完整工具段、压缩分段）必须出现。长工具/思考段可用与对话页相同的过程折 chrome 收起以便分析，但不得把注入 / SYSTEM / compacted / 用户正文折进过程区而消失。
- **产品验收标准**：
  1. 两页都在、都不可关；默认着陆对话；切换后页 chrome 与阅读列一起变，输入 Dock 仍在列底。
  2. 对话页时间线不含上下文注入卡、环境/系统提示词全文、工具 schema 目录；用户回合只显示用户正文。
  3. 轨迹页能看到至少：一条 context 注入、一条带附带 block/chip 的用户消息、一条环境/系统（SYSTEM）记录；选中一行可打开局部检查器（不占用 Bottom Panel）。
  4. 连续思考/工具在轨迹上可用过程折（与 PRD-013 同一套 overlay）；默认**展开**（分析用）；注入 / chip / SYSTEM / compacted 行始终在折外。
  5. 有父子工具时，subtool 相对父工具再缩进。
  6. pending 权限或新 Diff **不**自动切到轨迹。
  7. 无引擎、该会话也无 fixture 记录时，轨迹写诚实空态，不造假 Run，不空白标签页。
  8. 轨迹不是 Copilot Chat / ChatEditor / Bottom Panel inspect。
- **依赖或未决**：活数据依赖 PRD-008。过程折是显示优化，见 [PRD-013](#prd-013-conversation-过程折)；记录身份仍是各行，折壳不是列表键。「对话 | 轨迹」挂在每个 chat 页，见 [PRD-016](#prd-016-conversation-session-窗口与-chat-tab)。「对话 | 轨迹」已随 PRD-016 S1–S6 落在每个 chat 页 / 子代理对话框的页 chrome（`ConversationEditorPane`）。

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

- **状态**：`accepted`
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

- **状态**：`accepted`
- **用户价值**：用户在中间对话区用 tab 管理同一会话的根对话和 fork；点开子代理先在窗口内对话框里看，需要时再打开为 tab，并能沿 agent 层级跳转；必要时拆列或并排另一个会话；藏起中间区不会丢掉会话。
- **用户可观察陈述**：默认窗口中间 Conversation 里，每个会话是一扇窗口，有一条默认根 tab（不可关闭）。用户 Fork 在同一会话加一张 tab。Agent 拉起的子代理仍在该会话里；用户点击后在当前窗口内弹出居中对话框（父对话在底下仍可见，不是新 tab）。对话框可铺满当前窗口（仍不是 tab）；「打开为 tab」才变成一张延伸 tab。对话框和子代理 tab 顶部都有 agent 层级面包屑；点击某一级切到该 agent（对话框里替换预览内容或关掉对话框回到根；已是 tab 时替换当前延伸 tab）。每扇窗口有一键关闭根会话以外全部 tab 的按钮。用户 split 后同一扇窗口出现两列，每列自己的 tab。窗口并列展示的是另一个会话；藏起后回到单窗口，再打开该会话仍按原样显示。整块 Conversation 只能隐藏、不能关闭。前进后退有按钮也响应鼠标侧键；默认可在后退时关掉延伸 tab 或关掉对话框。文件仍在右边 Preview。
- **产品验收标准**：
  1. 中间可见 chat tab（有延伸或 split 时）；不是 Preview 里的 Chat 编辑器标签。
  2. 默认根 tab 没有关闭；隐藏 Conversation 或隐藏某会话窗口后再打开，该会话的 tab 还在。
  3. 用户 Fork 不产生第二个根会话；新内容作为同一会话的 tab（引擎未接时不假装已 fork）。
  4. 子代理未点击时不出现新 tab、不弹对话框；点击后窗口内居中对话框打开且仍只有根 tab（父对话未卸）；叶内铺满后仍只有根 tab；「打开为 tab」后才出现延伸 tab。
  5. 对话框与子代理 tab 顶有面包屑；点击祖先切到该 agent（对话框替换预览或关对话框；已是 tab 时当前延伸 tab 被替换，不叠新 tab）。每扇窗口能一键关掉根以外全部 tab。
  6. 用户 split 后仍是同一会话、同一扇中间窗口；不把 fork 拆进 Preview。
  7. 窗口并列是第二个会话（第二扇中间叶）；隐藏该窗后只剩一个会话窗口；再打开该会话窗口回来。两扇窗共用右边同一个 Preview，不是 Agents 窗口里的双会话孪生。
  8. Conversation 聚焦时 ←→ 与鼠标 4/5 在 chat tab / 对话框之间导航；Preview 聚焦时仍是文件历史。默认后退关闭延伸 tab 或关掉对话框，不关根 tab。
  9. 「对话 | 轨迹」是每个 tab / 对话框内的透镜，不是与 chat tab 平级的第三条。
- **依赖或未决**：活 fork / 子代理 catalog 依赖 PRD-008。形态见 [ADR-002](../../dev/decisions/002-conversation-session-windows.md)（`accepted`）。方案见 [conversation-session-windows](../../dev/plans/conversation-session-windows.md)（S1–S6 `implemented`；S3c 对话框 chrome 已写）。不改变 Agents 窗口 [PRD-011](#prd-011-chat-并排比对)。本条修正 [PRD-012](#prd-012-conversation-轨迹透镜)：「对话 | 轨迹」是每个 chat 页 / 子代理对话框的页 chrome；[PRD-002](#prd-002-会话上下文) SelectBox 仍是窗口 chrome。窗口并列共享同一个 Preview / Sources / Panel，不是 ADR-001 的双 session 孪生。「文件仍在右边 Preview」的唯一例外是用户显式移入的 Diff 审阅页，见 [PRD-009](#prd-009-changes-与-diff)。

### PRD-009 Changes 与 Diff

- **状态**：`accepted`
- **用户价值**：用户能在 Sources Changes 里看到 Agent 改过的文件，点开文件级 Diff 审阅；Diff 默认开在 Preview，但用户可以把它挪到正在对话的中间窗口或底部，不必为了审阅离开对话。
- **用户可观察陈述**：Sources 的 Changes 列表列出工作区变更；点击一行在 Preview 打开该文件的 Diff。每个已打开的 Diff 都能由用户显式「移到对话窗口」或「移到底部」，也能移回 Preview；用户可以把默认归属改成三者之一。移入对话窗口的 Diff 是该会话窗口里的一张可关闭延伸 tab，只用于审阅；普通文件仍只在 Preview 打开。
- **产品验收标准**：
  1. 点击 Changes 行，Diff 出现在 Preview（End 上格），不是替换中心 Conversation，也不自动撑开已收起的 Sources。
  2. 对已打开的 Diff 执行「移到对话窗口」后，它成为当前会话窗口的一张延伸 tab，原对话根 tab 仍在且仍不可关闭；关闭该 Diff tab 不影响对话；后退可关掉它。
  3. 对话窗口里的 Diff 是审阅面：能看、能 revert / accept 变更、能「在 Preview 打开」进入可编辑状态；不能在对话窗口内直接编辑文件正文。
  4. 「移到底部」后 Diff 出现在底部 Panel 的产品 Diff 视图中；Panel 因用户动作显示不算违反四钮互斥；再「移到 Preview / 对话窗口」能回去。
  5. 焦点在 Conversation 时，从 Changes 或任何默认路径打开 Diff 仍落 Preview；只有用户显式动作或已设的默认归属才把 Diff 送进对话窗口或底部。
  6. 无引擎时 Changes 来自本地 SCM 诚实枚举；没有仓库或没有变更时写空态，不造假变更，不出现「Agent 改了 N 个文件」之类文案。
- **依赖或未决**：形态见 [ADR-005](../../dev/decisions/005-changes-diff-owner.md)。「Agent 改过的文件」这层归因（哪些变更来自哪一轮）依赖 PRD-008；本条只约束 Diff 的打开与移动。本仓不再沿用外仓 ADR-047「Diff 只在底部 Panel」的单一归属。

## 未决或阻塞

### PRD-008 引擎与会话权威

- **状态**：`blocked`
- **用户价值**：用户的对话、工具执行和权限应来自真实 Agent 引擎，而不是本地占位会话/占位回复。
- **用户可观察陈述**：用户发送后由引擎产生助手回合与工具请求；会话列表来自引擎诚实枚举。
- **产品验收标准**：未决。在引擎接线方案接受之前，本条不算成功，也不许占位界面冒充已接通。
- **依赖或未决**：引擎未接入本产品；禁止用内置 Chat 会话模型顶替引擎权威。**接线方案已于 2026-09-02 签收**：[m6-engine-wave](../../dev/plans/m6-engine-wave.md) + [ADR-003](../../dev/decisions/003-engine-adapter-boundary.md) + [conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md)（均 `accepted`）；本条保持 `blocked` 直到 M6-A2 接通并有隔离 profile 启动冒烟证据，届时补验收标准并升 `implemented`。

### PRD-010 产品身份

- **状态**：`proposed`
- **用户价值**：窗口名称、图标与发行身份应是本产品，而不是上游 Code - OSS 默认身份。
- **用户可观察陈述**：用户能从窗口标题与图标认出 Agent IDE。
- **产品验收标准**：未决。本批不改产品名称与图标。
- **依赖或未决**：**已裁决 @2026-09-02**：产品名 **UniverseAgentStudio**；图标复用 UniverseAgentDesktop / Singularity 现有资产。落地排在引擎波（PRD-008 接通）之后，见 [D12](../../dev/progress/deferred-gaps.md)。扩展分发仍未决（且明确排除完整市场分发）。

## 非功能需求（2026-09-02 新增；同日签收 `accepted`）

以下四条约束贯穿 PRD-001–016。它们回答「产品在重启、键盘、Web、大会话四种情形下应该怎样」，此前需求正文对这些完全沉默，实现只能各自猜。**签收裁定（2026-09-02，用户委托）：** 四条均 `accepted`；各条「依赖或未决」里原待裁定的事项按下文写死；实施分别登记为 [D13 / D14 / D15](../../dev/progress/deferred-gaps.md) 与 [D10](../../dev/progress/deferred-gaps.md)，**都不阻塞 M6 引擎波**。

### PRD-017 本地会话持久化

- **状态**：`accepted`
- **用户价值**：用户重启后还能找到昨天的本地会话，而不是每次从空白开始。
- **用户可观察陈述**：无引擎时，本地会话（标题、回合、权限记录）与 Conversation 的 session 窗口布局在重启后恢复；界面明确它们是本机存储，不写「已同步」。引擎接通后，会话权威切换到引擎，本地副本只作缓存并如此标注。
- **产品验收标准**：
  1. 重启后会话列表、当前会话与各会话回合与重启前一致。
  2. Conversation 显隐、session 窗口叶与 chat tab 结构恢复（PRD-016 验收 2 的跨重启版）。
  3. 无引擎时不出现远端同步文案；引擎接通后本地缓存不得冒充引擎回报。
- **依赖或未决**：HEAD 的 `IConversationRosterService` 是纯内存（只有透镜选择持久化到 `StorageScope.WORKSPACE`）。**存储落点已裁定（2026-09-02）**：无引擎时本地会话（标题、回合、权限记录）存 `IStorageService` **`StorageScope.WORKSPACE` + `StorageTarget.MACHINE`**（随工作区、不随 Settings Sync 漫游，天然满足「不写已同步」）；session 窗口布局沿用 PRD-016 已有的 Layout 持久化。**引擎接通后不迁移**：UA 会话权威在引擎，本地存储只保留 stub 会话与「最后一次 UA 快照」缓存（供 PRD-007 断连只读），并以 `source: local | engine-cache` 标注，缓存不得冒充引擎回报。实施挂 [conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md) 帧源之上（在 S3 之后、作为独立切片，登记 [D13](../../dev/progress/deferred-gaps.md)）。

### PRD-018 键盘可达与辅助功能

- **状态**：`accepted`
- **用户价值**：不用鼠标也能在四个区域之间切换、在 Conversation 的 tab / 对话框 / 透镜之间移动。
- **用户可观察陈述**：四钮各有默认快捷键；Conversation、Preview、Sources 都进入 F6 / Shift+F6 的 part 焦点循环；chat tab、子代理对话框、「对话 | 轨迹」透镜、过程折、权限座位均可键盘操作并有可读的 aria 名称。
- **产品验收标准**：
  1. `workbench.action.toggleConversation` / `toggleSources` / `toggleEditorVisibility` / Navigator 各有默认键位且在 Keyboard Shortcuts 里可见。
  2. 隐藏 Conversation 后仅靠键盘能回到对话（PRD-001 验收 3 的键盘版）。
  3. 屏幕阅读器能读出会话标题、回合角色、权限请求状态。
- **依赖或未决**：HEAD 只有 `workbench.action.chat.open`（Open Conversation，`Ctrl+Alt+I` / mac `Cmd+Ctrl+I`）能靠键盘显示并聚焦 Conversation；四钮 toggle、split、关非根均无默认键位。新键位须避开已占用的 Open Conversation 键与上游 `Ctrl/Cmd+B`（Navigator）。**裁定（2026-09-02）**：具体键位由实施切片在 `contrib/conversation` / `contrib/sources` 的 keybinding 注册处选定并写入 [commands](../systems/conversation/commands.md) §7，产品层只约束「有默认键位、Keyboard Shortcuts 可见、不与上游冲突」；实施登记 [D14](../../dev/progress/deferred-gaps.md)，排在 M6-B 之后（StatusBar / 四钮命令面在 M6-B 定稿后再加键位，避免两次改动）。

### PRD-019 Web / 远程窗口一致性

- **状态**：`accepted`
- **用户价值**：通过 `server` / Web 入口打开时，看到的仍是同一个 Agent IDE，而不是退化成上游编辑器。
- **用户可观察陈述**：Web 与远程窗口的默认中心同样是 Conversation，四钮与 Sources 存在；某个能力在该形态不可用时诚实省略，不画假控件。
- **产品验收标准**：
  1. Web 入口启动后 PRD-001 验收 1–3 成立。
  2. 依赖桌面进程的能力（如本机引擎进程）在 Web 下省略或明示不可用。
- **依赖或未决**：`contrib/conversation` / `contrib/sources` 注册在 `workbench.common.main.ts`，理论上 Web 共用；尚无任何 Web 冒烟证据。**裁定（2026-09-02）**：本条是验证义务而非新功能；验收 1 的 Web 冒烟（`scripts/code-web.sh` 或 `server` 入口 + D4 式 V1–V3 断言）登记 [D15](../../dev/progress/deferred-gaps.md)，在 M6-A2 合入后跑一次（届时同时验证验收 2「本机引擎进程在 Web 下省略」）。ADR-003 已保证 gRPC 只在 `platform/universeAgent/node`，Web 形态下 `IUniverseAgentConnection` 必须诚实报 `disconnected`，不得在 Web 画连接控件。

### PRD-020 规模与性能上限

- **状态**：`accepted`
- **用户价值**：长会话不卡输入，轨迹页记录上千条仍可滚动与检索。
- **用户可观察陈述**：对话与轨迹列表在回合 / 记录数达到既定上限（**已裁定 2026-09-02**：对话 1,000 回合、轨迹 5,000 记录）时仍保持可滚动、输入不阻塞；超限时诚实提示而非静默截断。
- **产品验收标准**：
  1. 上述规模下发送一条消息到出现在时间线 ≤ 200 ms（本机、无引擎）。
  2. 轨迹页在上限规模有搜索与虚拟化（PRD-012 T5）。
- **依赖或未决**：上限数值按初值写死，不再等裁定。**HEAD：** 轨迹页 T5 搜索、虚拟化、`CONVERSATION_TRAJECTORY_RECORD_LIMIT = 5000` 诚实截断已实施（[D10](../../dev/progress/deferred-gaps.md) 已闭；Overview 瀑布条仍 Deferred）。验收 1 的 200 ms 须在 [conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md) S2 三类帧增量落地后，用 1,000 回合 fixture 测一次并记入 D10 退出记录。

### PRD-021 未知内容与错误的诚实呈现

- **状态**：`accepted`
- **用户价值**：引擎发来 IDE 尚不认识的内容块或一条错误时，用户看到的是它本来的样子，而不是被静默丢掉或被冒充成别的东西。
- **用户可观察陈述**：时间线里出现「未知内容」行时，行上标明来源类型名并显示有界的原文预览（截断处有标记）；出现「错误」行时显示错误标题，只有引擎声明可重试的错误才有重试按钮。两种行都不进过程折，也不被画成助手正文或工具卡。
- **产品验收标准**：
  1. 未知块不消失、不被归并进相邻的助手回合或工具行；类型名逐字来自引擎。
  2. 错误行的重试按钮只在引擎标记可重试时出现；不可重试的错误只显示说明。
  3. 无引擎时不构造假未知块或假错误来演示这两种行。
- **依赖或未决**：活数据依赖 PRD-008。对应 session-core `unknown` / `error` 两种记录（Desktop ADR-307 诚实降级镜像）。实施见 [conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md) §3.3。2026-09-02 随该方案签收新增。

## 引擎接通后的配套面（2026-09-02 新增）

以下两条给「壳已落、内容等引擎」的两处面板补产品陈述。此前 Navigator 的 Projects / Agents / Team 与 Sources Review 只有容器与诚实空态，引擎接通后该显示什么没有需求正文，M6 序列也未排它们。两条随对应方案过规则 16 三轮后于 2026-09-02 签收为 `accepted`（用户授权「架构由本会话裁定」）。

### PRD-022 Navigator 引擎段

- **状态**：`accepted`
- **用户价值**：引擎接通后，用户能在左侧导航区看清「我在哪个项目的哪个会话、这个会话里有哪些 Agent 在跑、团队成员和任务到哪一步」，并从这里定位到对话里对应的位置，而不必在对话时间线里翻找。
- **用户可观察陈述**：Navigator 的 Projects 段按引擎 → 工作目录 → 会话三层只读显示引擎会话（引擎提供工作目录时按它分组，否则全部会话挂在引擎当前工作目录下），本地最近文件夹仍是独立一组；点会话行切换当前会话。Agents 段显示当前会话的 Agent 层级树（类型、状态、模型、回合数）与工具活动列表；点「Reveal in Conversation」在对话窗口内打开该子代理。Team 段显示当前会话里每个 manager 的成员与任务板；成员状态与任务状态按引擎字面显示。Agents / Team 任一行「Inspect」在底部 Inspect Panel 显示该项字段详情。三段全部只读，没有 Kill / 新建成员 / 发消息等指挥操作。
- **产品验收标准**：
  1. 无引擎时三段与今天一致（Projects 本地文件夹、Agents / Team 诚实空），不出现「正在读取」。
  2. 引擎接通后 Projects 里点会话与 Sessions 列表、SessionBar 是同一个当前会话，不出现第二份当前会话。
  3. 引擎 fork 出子代理后 Agents 树更新；Reveal 打开的是 PRD-016 的居中子代理对话框（该子代理已开成延伸 tab 时聚焦该 tab；根 Agent 时聚焦根 tab），不是 Preview tab、不是新根会话。
  4. 引擎不提供 Agent 树或 Team 能力时，对应段写「当前引擎不提供 …」，不用空列表冒充「没有 agent / 没有团队」；当前会话只有根 Agent 时写「只有根 Agent」而不是「no agents」。
  5. 引擎断开后三段保留断开前内容并标明「显示为断开前快照」；不写「已同步」。
  6. 三段与 Inspect Panel 里没有任何会改变引擎状态的按钮。
- **依赖或未决**：活数据依赖 PRD-008（M6-A2 之后）。方案见 [navigator-engine-segments](../../dev/plans/navigator-engine-segments.md)（`accepted` @2026-09-02；N1–N5 全排 M6-A2 后）。按工作目录分组依赖引擎补 `SessionSummary.work_dir`（缺口 G-NAV-1）；重连后团队整体状态依赖引擎补 `ListTeams`（缺口 G-NAV-2）。Agent 树只读会话视图（由 M6-A2 host 填充）；成员与任务经引擎连接层的三个只读查询取得（实现在 M6-A1 / A2，导航区不直接碰协议）；团队整体状态仅在会话视图已有 team id 时查询。根 Agent 对应对话窗口的根 tab；非根子代理 / 成员的对话 id 逐字等于引擎 `agent_id`。指挥类操作（Kill / StartMember / MessageMember / TaskUpdate）不在本条，需另立需求与权限座位设计。Desktop 侧这三段同样是 not-wired 空 chrome，本条无外仓需求可继承。

### PRD-023 Sources Review 审阅进度与归因

- **状态**：`accepted`
- **用户价值**：用户审阅一批变更时能记住「哪些已经看过、还剩哪些」，引擎接通后还能看出「哪些是这一轮 Agent 改的」并一键回到对话里那一步；Review 不再只是 Changes 去掉按钮的复印件。
- **用户可观察陈述**：Sources Review 列出与 Changes 相同的变更集，每行带审阅状态（未审阅 / 已审阅）；从 Review 行打开 Diff 即标为已审阅，也可手动标记或全部标记；文件内容再变化时该行回到未审阅。面板顶显示「已审阅 x / y」并可只看未审阅。引擎接通且能匹配到当前工作区时，被 Agent 改过的行带「Turn n · agent」归因标签，点击回到对话里对应的工具行；助手回合改了文件后，该回合下方出现「查看更改（N 个文件）」入口，点击打开 Sources Review 并预填这些路径。Review 仍然只导航：没有 stage / discard / commit，也没有评审意见或批准状态。
- **产品验收标准**：
  1. 审阅状态只保存在本窗口内存里：重载窗口后全部回到未审阅；不写本机存储，不回写引擎；审阅状态（已审阅 / 未审阅）不出现在会话时间线——「查看更改」是导航行，不是审阅状态。
  2. 审阅状态不影响 Changes 的 stage / commit，也不阻止发送；文案只用「已审阅 / 未审阅」，不用「已验证 / 已批准」。
  3. 从未连接引擎时没有归因标签、没有「查看更改」入口、没有任何「Agent 改了 N 个文件」文案；审阅状态功能仍完整可用。已连接后断开时，此前已出现的归因标签与「查看更改」入口保留、点击仍可用（走本地 SCM），但不再新增。
  4. 引擎工作目录与当前工作区不同（或远程引擎无共享文件系统）时，面板顶写明列表来自本地 SCM、未做归因；不改用引擎侧的变更列表。
  5. 归因标签是装饰：列表的成员与顺序仍由本地 SCM 决定，Agent 未改过的本地改动不带标签也不带「未归因」占位。
  6. 面板顶的只读说明不再写「review 引擎未接线」——Review 的产品定义里不存在 review 引擎。
- **依赖或未决**：审阅进度 = 验收 1、2 与验收 3 的前半句，无引擎即可实施；归因标签 = 验收 5；「查看更改」= 用户陈述与验收 3 后半句；工作目录不匹配 = 验收 4；文案 = 验收 6。归因与「查看更改」依赖 PRD-008（M6-A2 之后）及 [conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md) S2 / S4。方案见 [sources-review-progress](../../dev/plans/sources-review-progress.md)（`accepted` @2026-09-02；R1 / R2 / R4a 无引擎可开）。对照 Desktop ADR-043（Review 只导航、审阅进度 scope-local、不做门禁）与 UI-INV-09 / UI-REVIEW-01，作为 `source` 引用；本仓分叉：审阅进度放在 Review 而非 Changes。历史会话的归因依赖引擎在 `GetHistory` 里带归一化的文件改动载荷（缺口 G-REV-1）。PRD-005 用户陈述中「review 引擎未接线」一句已随本条签收改口。

### PRD-024 远程引擎连接（Connection Hub）

- **状态**：`proposed`
- **用户价值**：用户在 IDE 里用 Hub 账号找到自己的 Engine 设备并安全连接，不装 VPN、不填 IP；首配需人工核对一次短码，之后零交互。
- **用户可观察陈述**：Connection 页能登录 Hub、列出设备（离线 / Engine 异常 / 可用三态）、对可用设备发起连接；首配弹出 8 字符 SAS 需与 Engine 端核对，无「跳过」；连接成功后状态栏显示引擎名与路径（「Engine · Hub relay」/「Engine · Direct」）——**连接级不使用「已连接」措辞**，该词按 [PRD-007](#prd-007-诚实降级) 验收 4 仅归会话标题条；Hub 登录过期与 Hub 不可达文案不同。手填 DirectAddress（host:port）走同一套 TLS pin + Device Grant，不签 relay ticket。
- **产品验收标准**：
  1. 未登录 / 登录过期 / 不可达三种 Hub 态文案互不混用。
  2. `NOT_SERVING` 设备无连接按钮。
  3. SAS 对话框无跳过，取消不写 trust。
  4. 错误 pin 握手失败、正确 pin 成功、nonce 主机名不妨碍握手（S21）。
  5. 重启 IDE 后已配对设备重连无 SAS。
  6. 状态栏文案集合中不含「已连接 / connected」字样；Hub 登录态为真但引擎未连时，状态栏仍为「Engine not connected」且会话标题条不出现「已连接」。
  7. Web 形态不画连接控件。
- **可测方式**：①②③⑥⑦ 单测（pane / StatusBar 文案表 + 负向断言）；④ mock TLS 单测；⑤ 隔离 profile 重启冒烟（真 Hub）。
- **依赖或未决**：活数据依赖 [PRD-008](#prd-008-引擎与会话权威)（M6-A1/A2）；上游 Hub 部署与 Engine `--hub --enroll`。v1 中继 + DirectAddress；HubDevice 经 Hub 的 GUA / 公网 IPv4 自动直连（ADR-374 Phase 3）**不在 v1**，见 [connection-hub-client](../../dev/plans/connection-hub-client.md) 切片 H6。方案 @2026-09-02 `accepted`；H1–H5 代码 @ HEAD；H4a 真 Hub 冒烟为升 `implemented` 证据门槛。

## 明确排除（不是需求）

以下不是 `PRD-NNN`，不得在追踪表里标成待办需求：

- 整仓迁移 UniverseAgentDesktop 产品文档
- 把 Agents Window 当作默认产品壳
- 复制 Cursor / Codex trade dress
- Open VSX / Marketplace 完整扩展分发
- 在 `docs/product/` 重写 M0–M4 实现切片
