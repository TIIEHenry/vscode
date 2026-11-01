---
title: "功能缺口审查 2026-11-01"
type: reference
status: draft
phase: M7
updated: 2026-11-01
summary: "六路只读复查默认编辑器窗口的功能缺口（协议消费、Conversation 主流程、Engine/Client 设置、连接与订阅、配套面与工作根、PRD 验收）。新发现：Navigator Projects 删除会话不确认、生成中队列编辑无法保存、溢出降级露内部码、Overview 模型行误写原因、Preview 空态承诺无来源内容、023.4 提示在工作根模式下永不出现。协议层缺口归 EIR 稿，不重复。发现稿，不切实施，不改 PRD。"
---

# 功能缺口审查 2026-11-01
状态：草案。负责：agent:kiro。
覆盖需求：PRD-002、PRD-007、PRD-008、PRD-015、PRD-022、PRD-023、PRD-024、PRD-025、PRD-027、PRD-028、PRD-029。

> **范围：** 只看默认编辑器窗口。Agents Window 与 Copilot Chat 不计入。以磁盘为准（含未提交 WIP）。IDE `agent-ide` HEAD `e0640256333`；引擎 `UniverseAgent` `027ab7ed03`（11-01 换钉的版本）。
> **方法：** 六路只读子代理并行：A 协议消费、B Conversation 主流程、C Engine/Client 设置、D 连接与订阅、E 配套面与工作根、F PRD 验收与方案落地。没有编译、跑测试、连引擎或开窗口。
> **核实口径：** 标 ✓ 的条目父 agent 回到源码复核过；未标的是子代理结论，本稿未逐条复核。
> **前文：** [功能缺口审查 2026-10-16](review-2026-10-16-feature-gaps.md)（G 编号）· [10-26 功能缺口快照](../../docs/reference/universe-agent/ide-engine-feature-gaps.md) · 同日另一会话的未跟踪草稿：引擎交互审查 EIR（`dev/progress/engine-interaction-review-2026-11-01.md`）与 UI 组件审查（`dev/reviews/2026-11-01-ui-components/README.md`）。两份入库后再改成链接。
> **分工：** 协议层（字段、枚举、编解码、只停在传输层的 RPC）以 EIR 稿为准，本稿只在 §5 做映射。键盘与视觉以 UI 组件审查为准。托管 CI 已关是既定选择，不列为缺口。

## 1. P1：主流程断点或不可逆操作

| # | 缺口 | 影响的验收 | 证据 | 与旧结论 |
|:--|:-----|:-----------|:-----|:---------|
| F1 ✓ | Navigator Projects 会话行的 Delete（垃圾桶图标）直接调 `roster.deleteSession`，不走删除确认。其他三处删除都走 `confirmDeleteConversationSession` | PRD-002.6；PRD-022.6（三段无改引擎状态的按钮） | `navigatorProjectsList.ts:196-207`、`:554-566`；对照 `conversationLensSessionBar.ts:707`、`conversationSessionsView.ts:358` | 新发现 |
| F2 ✓ | 默认窗口自己产生不了队列条目：生成中 Send 关闭，Inbox 的 Enqueue 恒关，已连接时 roster enqueue 返回 false。队列列表、Pause/Clear、行编辑只在别的客户端写入时才有内容，「生成中继续提交」这条主流程走不通 | PRD-015.5、015.6 与 10-27 队列补充 | `conversationLensComposerChrome.ts:819-823`；`conversationInboxOverlay.ts:298-300`；`conversationEngineRosterService.ts:640-652` | 仍开（10-26 快照 §8；有意暂缓，等 EIR-11 / D1388 的生成中输入合同） |
| F3 | Composer 的 Agent 恒只读（`switchAgent` 不在合同与 proto），空会话也选不了 Agent profile；Tools 只读，`SetClientToolProfile` 已进传输但没有入口 | PRD-015.3（空会话可改 Agent）；PRD-015 陈述（Tools） | `conversationLensComposerChrome.ts:1081-1089`；`universeAgentTypes.ts:63-64`；workbench 无 `setClientToolProfile` 调用 | 仍开（G6 的回滚误导已改成只读；能力缺口未变） |
| F4 | 换到另一个工作目录或引擎的会话时，Preview Code 不换入换出；回到原会话也不激活上次的编辑器。`onDidChangeActiveWorkRoot` 已广播，Preview 没有消费方 | PRD-029.3、029.4（`proposed`） | `agentSessionContext.ts:61-62`、`:113-126` | 仍开（G19；等 PRD-027 P3，G20） |

## 2. P2：缺闭环、文案误导或入口缺失

| # | 缺口 | 影响的验收 | 证据 | 与旧结论 |
|:--|:-----|:-----------|:-----|:---------|
| F5 ✓ | 生成中能 Hold 一条队列行并进入编辑，但保存被生成中门禁挡住：`updateSendEnabled` 和 `submitDraft` 都先判生成中，再分派 `queueEdit`。队列行通常正是在生成中停留，用户只能等这一轮结束 | PRD-015.6 | `conversationLensComposerChrome.ts:819-832`；`conversationLensComposer.ts:388-397`；`conversationInboxOverlay.ts:735-811` | 新发现 |
| F6 ✓ | 订阅溢出后会话条显示 "Session degraded: mailbox_overflow"，内部码原样上屏 | PRD-007.4；PRD-028.11（原始码进详情） | `conversationSessionView.ts:152-176` | 新发现 |
| F7 | 溢出的 degraded 态不出「断开前快照」条幅；会话级没有手动恢复入口，只能去 Connection 页断开重连或重开会话 | PRD-007.5 | `conversationLensReadingColumn.ts:244-252`（WIP 文件）；workbench 无 resync / reopen 命令 | 新发现 |
| F8 ✓ | Overview 模型行在引擎 models 能力为 UNSUPPORTED 时写 "this client has no model profile API yet"，把引擎不支持说成客户端缺 API。同文件 `formatOverviewRegistryUnavailable` 有正确文案但没用上 | PRD-025.2（状态文案互不冒充） | `engineOverviewSection.ts:67-72`、`:115-120`、`:193-200` | 新发现 |
| F9 ✓ | FireTrigger 结果只有 `status` 为空串才画 error，引擎返回非空的拒绝或跳过 status 时仍画 neutral | PRD-025 Triggers | `engineTriggersSection.ts:597-598` | 部分闭合（G15） |
| F10 | Overview 能力行仍是八个键，缺 Triggers、Clipboard、Context Variables、`mcpRuntime`、`providerConfig`；Provider 行仍省略 | PRD-025 未逐条要求 | `engineOverviewSection.ts:122-131`、`:330` | 仍开（10-16 P2、G-ENG-1） |
| F11 | 写闸方案 S3、S4 未做。Agents、Tools、ProviderModel 在换链时静默丢弃结果，没有方案要求的「未发送 / 未确认」可见文案；Agents Create 在途不禁用；两页 Test Connection 可能停在「Testing…」 | PRD-025.6、025.8 | [engine-write-gate-unification](engine-write-gate-unification.md) §5；`engineAgentsSection.ts:686-710`；`engineToolsSection.ts:348` | 仍开（推断，未逐行核） |
| F12 ✓ | Preview 空态文案承诺了没有来源的内容：History 写会话轨迹检查点会保存在这里，但检查点不往 Preview 打开任何编辑器；Terminal 写 Agent 运行的命令会出现在这里，但 Agent 终端默认在底部 Panel；Artifacts 写 Agent 产出会收集在这里，仓内没有产生方 | PRD-007；PRD-027.6 | `editorGroupWatermark.ts:382-393`；`previewCategoryService.ts:225-262` | 新发现 |
| F13 ✓ | Planning 已有内容来源（命令 Open Planning Todos），但 Planning 空态不给操作 | PRD-027.6 | `editorGroupWatermark.ts:413-433`（default 返回空）；`planning.contribution.ts:29-42` | 新发现 |
| F14 ✓ | 会话工作根存在时 `getWorkDirMismatchNote` 一律返回 undefined；`access === 'none'` 不做归因，面板顶也不写列表来自本地 SCM、未做归因。PRD-023.4「不改用引擎侧变更列表」与 PRD-029.1「只能经引擎读取的目录仍能列出」字面冲突，需要先定以哪条为准 | PRD-023.4 对 PRD-029.1 | `sourcesReviewAttributionService.ts:120-136`、`:288-293` | 新发现 |
| F15 | 会话命令只有传输：Compact、Back、Prune、Reset、Branch、Shelve、Unshelve、Purge、Export、Loop 三操作、Agent Pause/Resume。按用户任务挑选，不全做成按钮 | 无直接验收号 | workbench 无调用 | 仍开（G7） |
| F16 ✓ | 已连接时 Inbox 的 Task / AutoDrive 恒空、计数 0，Todo 无读取；Goal 只能设和清，读回只是本端写过的镜像，重连或别的客户端设的目标读不回 | PRD-015.5（允许诚实空） | `conversationEngineRosterService.ts:521-524`、`:686-699` | 仍开（G18） |
| F17 ✓ | Fork 不能选回合 anchor，roster 不传 `anchorTurnId`，省略时引擎用当前回合 | PRD-016 周边 | `conversationEngineRosterService.ts:1189-1205`；`universeAgentTypes.ts:1246-1249` | 仍开（10-26 快照 §4） |
| F18 | 新建会话不能指定工作目录，`SwitchWorkDir` 也无入口 | PRD-029 依赖段写明另开方案 | `navigatorProjectsList.ts:543`；`conversationStubService.ts:133-134` | 仍开（范围外，列出备查） |
| F19 | 「切换类别」「Move Editor to X Category」两组命令没写 `f1: true`，可能进不了命令面板；右键子菜单和拖到类别钮可用 | PRD-027.4 | `editorCommands.ts:1745-1752`、`:1806-1813` | 新发现（推断，未查 MenuId.CommandPalette） |

## 3. 只缺验证证据（代码已在）

- **PRD-008**：仓里没有连引擎的启动剧本，`editor-shell.cjs` 不启动引擎；验收正文仍写「未决」。换钉到 `027ab7ed03` 后真实黄金路径未重跑。
- **壳冒烟**：`editor-shell.cjs` 在当前 HEAD 没有运行记录，最后一次全过是 10-05 的本地产物。剧本只断言 Conversation 可见，不查标题条、时间线、权限座位、输入区与收件箱行；V5（隐藏后选会话回来）、V7（Reload 恢复）、四钮默认键位没进剧本。vision 的「启动冒烟待验证」据此仍成立。
- **订阅恢复**：四种情形代码都能自动恢复，[D405](../progress/deferred-gaps.md) 的 V-S1–V-S3、V-S4b-1、V-S5 真实手测未跑。
- **连接**：H4a 真 Hub 冒烟未做，PRD-024.1–024.5（含重启免 SAS）没有真实证据。
- **配套面**：N5（PRD-022）、R5（PRD-023）、F4（PRD-009）冒烟未做；PRD-027.3、027.4、027.7 的重载与关闭行为、PRD-029.7、029.8、029.10、029.11 没有真实窗口证据。
- **其他**：PRD-020.1 bench 已在、无结果；D20（Settings 300px）；D18 安装包；D17 a11y 手测；D1388 真实引擎行编辑；换钉后 Models 写、SaveSkillContent、GetQueue 的业务验收未做。

## 4. 文档与代码偏差

| # | 文档写法 | 代码或事实 |
|:--|:---------|:-----------|
| DD1 ✓ | [requirements](../../docs/product/requirements.md) PRD-015 的 10-27 队列补充写「真实引擎行编辑暂不开放」；[D1388](../progress/deferred-gaps.md) 写 GetQueue 切片「仍关闭真实行激活」 | readState 为 ready 且可写时，队列行已可 Hold→Edit→Release（`conversationInboxOverlay.ts:735-811`；`conversationLensComposer.ts:512-627`）。需要用户定：按代码改需求，还是在真实验收前把入口关回去 |
| DD2 | [10-26 快照](../../docs/reference/universe-agent/ide-engine-feature-gaps.md) §3「订阅恢复」行写同连接与重新 acquire 后的溢出恢复仍缺 | 已由 `641b1f86959`、`ae8297add7f` 修复（`sessionViewHost.ts:2025-2095`、`:376-400`） |
| DD3 | 同页 §8 写名称覆盖 210/210 | 引擎 `5420ee9831`（10-29）新增 `GetPermissionMode` 后为 210/211 |
| DD4 ✓ | EIR 稿把 `GetPermissionMode` 归到 `ce39cc4967`（10-28） | `git log -S` 指向 `5420ee9831`（10-29） |
| DD5 | PRD-027 依赖段写 Planning 目前还没有内容来源 | 已有 Open Planning Todos（`planning.contribution.ts:29-42`） |
| DD6 | [traceability](../../docs/product/traceability.md) PRD-028 行写 visual-audit-remediation「代码未落」 | V0–V5 都有提交（如 `1141c448902`、`fe6245c8a00`）；欠的是 §4 整体截图验收 |
| DD7 | [方案索引](INDEX.md) engine-write-gate 行写 S3–S5 未做 | 方案正文写 S5 已落（`2e7ebf38f6f` 等）；S1、S2 也已不在工作区差异里 |
| DD8 | session-availability-and-delete-confirm 仍写「执行中」 | S1–S5 与 D1304 代码已落，缺活窗验证记录 |

## 5. 协议层映射（以 EIR 稿为准）

| 本轮发现 | EIR | 产品影响 |
|:---------|:----|:---------|
| `GetPermissionMode` 未接，权限选择框显示本地最后接受值，重连或别的客户端改过后不回读，错的方向偏不安全 | EIR-5 | Permission 座位显示可能与引擎实际不符 |
| Chat 臂权限回答把 allow 编成 0，引擎 `PERMISSION_ALLOW = 3` ✓ | EIR-1 | 已连接时走 unary `Respond`（`conversationLensSessionBinding.ts:290-297`），默认窗口当前不受影响 |
| 模型写入按方法存在放行，桌面恒真 | EIR-3 | 换钉后引擎已实现三条写，IDE 仍未按探测结果开关 |
| `HistoryEntry.turn_id`、RemoteAgent 安全字段、`retain_binding`、SubAgent `depth` 未读 | EIR-13、EIR-14、EIR-10 | 当前无产品调用方 |
| 队列快照遇未知枚举整包失败 | EIR-15 | 潜在：新枚举值会关掉全部队列写 |
| 只停在传输层：`SetClientToolProfile`、`RegisterSessionEngineTrigger`、`Create.workDir`、Fork anchor、Provider `refresh_models` / `discovered_models`、`max_rewinds` 显示、`SessionInfo.title` | 功能适配矩阵 | 见 F3、F17、F18；Provider discovery 与 max_rewinds 不在 PRD-025 要求内 |

## 6. 已闭合的旧缺口

- G1 生成中 Send：已禁用（`conversationLensComposerChrome.ts:819-823`）。
- G2 队列读不回、写打在看不见的队列上：GetQueue 读回，写操作只在有行且 readState 为 ready 时可用。
- G3 / D1 MCP 表单、G4 Triggers 与 Clipboard 对话框、G16 能力未知不拉列表：都已在 HEAD。
- G5 Files / Changes / Review 工作根统一：都走 `getWorkRoot`，只在钩子缺失时兜底。
- G14 溢出后 fail_closed 长挡 reopen：宿主 `failClosedRecovery` 已修，只剩 D405 证据。
- G17 condemn 后能力快照不清：`_closeoutAuthenticatedLink` 已重置。
- SaveSkillContent 无正式 proto：已改为正式 RPC。
- D1388 Edit→Release 顺序：代码已等显式接受，失败保留草稿与 hold（真实验收见 §3）。
- 钉死引擎缺 Models 三条写：按 `027ab7ed03` 源码判断应已解决，未做运行时验证。

## 7. 核对后不是缺口

- 附件上传 UI、语音、Route、Team 写操作（PRD-022.6）、Hook 定义写、model discovery、高级 Memory：PRD 明确排除。
- Kill 只有 F1 命令、没有主动 Continue：[conversation-failure-and-mutation](conversation-failure-and-mutation.md) §1 已定为不改动。
- H6 GUA 直连：PRD-024 写明不在 v1。同时连接多个引擎：PRD-029 写明不在本条。
- 状态栏文案守住 PRD-024.6。遗留函数 `getConversationEngineStatusText(true)` 仍能产出 "Engine connected"，但没有调用方（`conversationSessionStatus.ts:99-104`）。
- PRD-026 九个键都有真实消费点，七组都不空。

## 8. 建议顺序

发现稿保持 `draft`，不切实施、不改 PRD 状态。若要落地，建议：

1. F1 补删除确认。改动小，防的是不可逆删除。（2026-11-01 已在工作区修复，见 §9）
2. 在当前 HEAD 跑一次 `editor-shell.cjs`，再按[钉死引擎](../../docs/guides/debug-engine.md)对 `027ab7ed03` 走一遍真实黄金路径，补 PRD-008 的剧本与证据。
3. DD1 先由用户定队列行编辑的开放口径，再与 F2、F5 和 EIR-11 一起设计生成中输入合同。
4. F3 需要产品决定：Tools 是否接 `SetClientToolProfile`（引擎只给 ALL / READ_ONLY / NONE 三档，不是逐工具勾选）；Agent 选择要等引擎有会话绑定合同。
5. F6–F14 的文案与提示类问题可以合成一刀。§4 的文档偏差一次改完。

## 9. 落地（2026-11-01）

提交：F1 `7d0e264e49e`，F6 `19eb5b3f345`，F8 / F9 `3e625f480ec`，F12 / F13 / F19 `bc74159a9ea`，写闸 S4 补丁 `3506f333bfe`。

并行修复记录见 [看板](../parallel/active/feature-gaps-fix-2026-11-01.md)。

- F1：Projects 会话行 Delete 走 `confirmDeleteConversationSession`，确认后重查写闸与会话是否还在。2026-11-01 用户裁定保留 Projects 的 Delete 与 New session，改写 PRD-022.6：Agents / Team / Inspect 不提供指挥类操作，Projects 允许这两个会话生命周期操作，不可用时禁用并说明原因。现已补齐断线、配对挂起、会话未就绪时的原因提示与 New session 禁用态，见 navigator-engine-segments V-N7。
- F6：会话状态徽标改走 `describeSyncChrome`，已知码给一句说明，原始原因进 `title` 与 `aria-description`。断连快照条在他人 WIP 文件里，未改。
- F8：Overview 模型行在 UNSUPPORTED 时写 "Unavailable — engine has no model registry."。
- F9：FireTrigger 按引擎实际返回的 `queued` / `executed` / `rejected` / `skipped` 定色，空字段不再拼进结果行。
- F11：写闸 S4 在 HEAD 已由 `49fb56e72f3` / `02dd1477fd1` 落地；本轮补「旧结果不清新一次测试的 Testing…」。S3 未做。
- F12、F13：Preview 空态说明只写真实来源；Planning 空态加 Open Planning Todos。
- F19：类别切换与移动命令进命令面板，归 “Preview” 分组。
