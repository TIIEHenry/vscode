---
title: "Client Settings UI 完成方案"
type: plan
status: accepted
phase: M7
updated: 2026-09-03
summary: "把 ua.client 七个空 TOC 分组补成真实本地配置（9 键），键注册与消费点同切片落地；CS-6 代码完成线已落，PRD-026 仍待 §6 产品验证"
---

# Client Settings UI 完成方案

> **需求：** [PRD-026 Client 设置完整性](../../docs/product/requirements.md#prd-026-client-设置完整性)。
> **父方案：** [M7 UI 完成波](m7-ui-completion-wave.md)（Wave 3 B4；执行槽 **B**，因为全部消费点都在 Conversation 文件里）。
> **宿主合同：** [page-access-schemes](page-access-schemes.md) · [settings-two-surfaces](settings-two-surfaces.md)。
> **前置：** [conversation-ui-closeout](conversation-ui-closeout.md) Q5a/Q5b 落好四 kind、座位与时间线结构后开工。
> **现状：** `registerUaClientSettings()` 的 `properties` 为空；`settingsLayout.ts` TOC 已有 Display、Chat Input、Startup、Keyboard Enter、Notifications、Permissions、Client Tools 七组（各带 `emptyCopy`），但没有真实 UA 配置。`settingsUaToc.test.ts:253` 目前断言不存在任何 `ua.client.*` 键。

## 1. 原则

1. Client Settings 继续使用完整 `SettingsEditor2`；不自研设置页。
2. 只登记 IDE 本地偏好；Engine catalog、Provider 凭据、Connection profile 不进入 `settings.json`。
3. 每个可见分组必须至少有一个真实消费点；没有消费点的条目不注册，也不留 placeholder。**键的注册与其消费点在同一切片合入**，不存在「先注册、后接线」的窗口。
4. 安全敏感设置只改变 IDE 侧默认展示/询问方式，不能越过 Engine 权限。
5. 设置更改尽量即时生效；需要新会话生效的项目必须在说明中写明。
6. 全部键 `scope: ConfigurationScope.WINDOW`（显式写在 `registerUaClientSettings`）；enum 键提供 `enumDescriptions`：`conversationDensity` = 「舒适：默认行距」/「紧凑：更小行距与过程折间距」；`keyboardEnter.behavior` = 「Enter 发送，Shift+Enter 换行」/「Enter 换行，Shift+Enter 发送」。

## 2. 配置闭集

以下 9 键是 M7 初始闭集；实施审查可删减，但不得换成空占位。「现状」列标明消费点今天是否已有代码。

| 分组 | 键 | 类型 / 默认 | 消费行为 | 现状 |
|------|----|-------------|----------|------|
| Display | `ua.client.display.conversationDensity` | `comfortable \| compact` / comfortable | 时间线与过程折根节点切 `.density-compact` class，CSS 调行距 | 新增消费点（`conversationLens.ts` / `conversationLens.css`） |
| Chat Input | `ua.client.chatInput.restoreDrafts` | boolean / true | 按 workspace + session 恢复未发送草稿 | 今天草稿只是 `conversationLens.ts:199/779` 内存 Map；本切片**新增**持久化 |
| Chat Input | `ua.client.chatInput.autoFocus` | boolean / true | 两条路径聚焦 Composer：`ConversationPart.focus()`（`conversationPart.ts:125-132`，今天直接 `querySelector('textarea…')` 聚焦，**不经** `focusDockInput`；`switchToSession` → `showConversationPart` → `conversationPartService.focus()` 也走这里）与 `ConversationEditorPane.focus()`（`conversationEditorPane.ts:100-102`，走 `focusDockInput`） | 两处都已聚焦，加开关。`conversationPart.ts` 的 `focus()` 不在 B 所有权，CS-1 经看板转交该函数一处：**只加读 `IConfigurationService`，沿用现有 `querySelector` 聚焦，禁止 Part 反向 import `ConversationLens`**（Part 不依赖 contrib）；开关只闸 `textarea.focus()`，**不得**让 `Part.focus()` 整体 return（Sessions / Navigator 的「回到会话」只调 `conversationPartService.focus()`，CS-4 的 pending 定位依赖它继续执行） |
| Startup | `ua.client.startup.restoreLastSession` | boolean / true | 启动时恢复 `activeSessionId`；关闭或 id 失效则仍加载会话列表、active 落第一项 | **两处**读设置：stub roster（`conversationStubService.ts:121-128`，失效回落 `conversationStubModel.ts:202`）与引擎缓存 `restoreEngineCacheFromStorage` 的 `engineCache.activeSessionId`（`conversationEngineRosterService.ts:248-262`）；只改 stub 则引擎工作区无效 |
| Keyboard Enter | `ua.client.keyboardEnter.behavior` | `send \| newline` / send | `send`：Enter 发送、Shift+Enter 换行；`newline`：Enter 换行、Shift+Enter 调用现有 `submitDraft()`。不新增 command | `conversationLens.ts:769` 已有 `Enter && !shiftKey` 发送，改读设置 |
| Notifications | `ua.client.notifications.permissionRequests` | boolean / true | **非活动会话**出现 permission / question 座位时经 `INotificationService` 发窗内通知，点击切到该会话并定位座位 | 新增消费点；**宿主为单一 workbench contribution** `conversationNotifications.contribution.ts`（新建，B），禁止在 per-leaf `ConversationLens` 或 overlay lens 内订阅（会重复弹） |
| Notifications | `ua.client.notifications.turnCompleted` | boolean / false | **非活动会话**收到 `onDidTurnSettle` 时经 `INotificationService` 通知；**仅引擎会话**（本地 stub 不产生 settle，不伪造） | 新增消费点（事件在 `platform/universeAgent/common`，renderer 可达） |
| Permissions | `ua.client.permissions.openPendingOnFocus` | boolean / true | 「回到会话」= `switchToSession` 完成或 `ConversationPart.focus` 时，若 `countPendingConfirmations()>0` 则调用已有 `scrollToFirstPendingConfirmation`（`conversationLens.ts:1465-1479`）；不自动批准 | 定位函数与 count 已有，加开关；该函数今天只找 `confirmation` 座位，CS-4 **扩展到 question 座位**（Q5a 落地后 question 进座位；`countPendingConfirmations` 已含 question 的 pendingActions） |
| Client Tools | `ua.client.clientTools.showToolInvocationDetails` | boolean / true | 过程折内 **tool 行**（含 client-tool 行）是否展开 `payload` 参数/结果详情；关闭时只显示工具名与状态 | `conversationProcessFold.ts:160-211` 已渲染 payload，加开关 |

**「非活动会话」定义（裁定）：** `sessionId !== roster.getActiveSessionId()`，**或** `layoutService.isVisible(Parts.CONVERSATION_PART) === false`。窗口失焦不算非活动（避免与 OS 通知语义混淆）。活动且可见的座位不弹通知。

**通知语义（裁定）：** 「通知」指 vscode `INotificationService` 窗内 toast，Web 同样可用；不做 OS 级桌面通知（依赖 electron-main，a11y 方案 §7 已列为 Web 诚实省略项）。

**已删除的键（无真实消费点或前提不实，2026-09-02 两轮审查）：**

- `ua.client.clientTools.advertiseWorkspaceTools`：`grpcClient.ts:832` 形式配对时 `supported_tools = []`，IDE 目前不向 Engine 广告任何 workspace tool；广告路径是 platform 工作。
- `ua.client.permissions.confirmBeforeExternalOpen`：Conversation 不经 `IOpenerService.open` 打开外部 URL（仅 `ViewPane` 构造透传）；外链信任沿用 `workbench.trustedDomains`。
- `ua.client.display.showAgentIdentity`：`ConversationIdentityStrip` 是 engine · folder · branch 条，不是 Agent 标签；时间线行头没有 agentId 渲染。行级 Agent 标签存在后再补。
- `ua.client.startup.openConversation`：与 `LayoutStateKeys.CONVERSATION_HIDDEN` 的工作区持久化状态打架（默认 `false` 但恢复上次显隐），且消费点在 `layout.ts` 不属任何 M7 槽；Conversation 默认可见已由 PRD-001 保证。

`conversation.navigate.closeChildOnBack` 保持现有键，不重复注册；在 UA Keyboard/Navigation 相关位置通过说明链接指向原设置。Client Tools 键由 `showInvocationDetails` 改名 `showToolInvocationDetails`，因为投影后的 `ConversationTimelineEntry` 不区分 client-tool 与引擎工具（无 `respondable` 字段），开关作用于全部 tool 行；描述文案写明这一点。

## 3. 安全与权威边界

- `ua.client.permissions.*` 不得生成 Allow、Skip 或 Engine grant；只能改变定位。
- Client Tools 显示开关只影响时间线呈现；工具是否可用仍由 Engine capability 和每次权限策略决定。
- Connection host、Hub URL、refresh token、Engine API key 继续由 Connection/Engine 服务存储。
- `restoreDrafts` 正文使用 `StorageScope.WORKSPACE + StorageTarget.MACHINE`（与 D13 roster 同策略），不经 Settings Sync 漫游；设置键本身可漫游。草稿键为 `conversation.drafts.v1`（与 `conversation.roster.v1` / `conversation.lensId` 不撞键），条目键为 `${sessionId}/${chatId}`——根叶与子代理 overlay 各自的 `ConversationLens` 实例不共用草稿，避免互相覆盖；**deleteSession 或 roster 中消失的 id 同步从草稿存储移除**（内存 Map 今天已 `drafts.delete`，持久化跟随）。

## 4. TOC 与搜索

- 七组继续使用现有 `ua.client.<group>.*` pattern；`emptyCopy` 在组内有键后不再显示。
- 不增加 `ua.client.display.placeholder`。
- Setting description 必须说明作用域与生效时机（即时 / 下次打开 Conversation / 下次启动）。
- Connection / Engine / Customizations 仍是导航链接，不注册 dummy setting。
- 默认窗继续剥离 Copilot Chat TOC；Agents Window 保持其 donor 设置。

## 5. 切片（执行槽 B；编号 CS-* 以区别总方案 Wave 内的 C1）

| 切片 | 内容 | 代码完成线 |
|------|------|------------|
| CS-1 | 注册 Display + Chat Input 三键并接消费点（密度 class、草稿持久化 + 删除清理、autoFocus 两处开关含经看板转交的 `conversationPart.ts#focus`）；**同一提交把 `settingsUaToc.test.ts:253` 改为「当次已注册键」的闭集精确白名单**（保留 `:249-252` 对 `ua.connection.*` / `connection.host|port` / `placeholder` 的负向断言；禁止 `startsWith('ua.client.')` 正向放行）。**CS-2 … CS-5 每次追加键时更新同一断言**，白名单随切片增长而不是一次写满 9 键 | Display / Chat Input 组有真实键且即时生效；registry 无 placeholder/connection/engine key |
| CS-2 | Startup + Keyboard Enter | `restoreLastSession` 在 stub 与引擎缓存两处接通；两种 Enter 模式都保留无鼠标发送（Shift+Enter → `submitDraft()`）；白名单 +2 |
| CS-3 | Notifications | 新建 `conversationNotifications.contribution.ts` 单例宿主；非活动会话 toast（按 §2 定义，permission 与 question 均覆盖）；toast 点击 = `switchSession` + `showConversationPart` 后调用从 lens 抽出的共享定位助手（`scrollToFirstPendingConfirmation` 今天是 lens private，CS-3 先抽成可注入助手）；引擎会话 turn settle toast；活动可见座位不弹；零自动授权；白名单 +2 |
| CS-4 | Permissions | `openPendingOnFocus` 两条锚点路径调用 `scrollToFirstPendingConfirmation`，且该函数扩展到 question 座位；白名单 +1 |
| CS-5 | Client Tools | tool 行 payload 显隐；白名单 +1（至此 9 键） |
| CS-6 | 设置迁移与窄宽度 | 未知旧值回默认；Settings 搜索、键盘、窄宽度可用；七组 `emptyCopy` 均不再出现。**代码完成线已落（2026-09-03，worktree B）**：`IConfigurationMigrationRegistry` 回默认 / 删已删键；`settingsUaToc.test.ts` 改为七组列出已注册键。§6 产品验证未做，不升 PRD-026 |

CS-1 对 `settingsUaToc.test.ts` 的改动是方案点名的断言替换，不记 D17。其余切片测试失败记 D17；除无法编译、启动崩溃、安全边界破坏外，不阻塞下一切片。本方案不依赖 P 槽；依赖 B 自己的 Q5a/Q5b。

## 6. 状态与验证

代码落地与产品验证分开记录。以下证据齐全后才能把 PRD-026 升 `implemented`：

- 七组在默认窗 Settings 可搜索、可修改，`emptyCopy` 不再出现。
- 重载后设置仍生效，草稿正文不进入 Settings Sync；删除会话后草稿存储无残留。
- `send/newline` 两种 Enter 模式都保留无鼠标发送方式。
- 关闭通知后没有后台旁路；活动会话不重复弹 toast；本地 stub 会话无 turn-completed toast。
- `settings.json` 无 Connection profile、Engine 凭据或 token。

## 7. 规则 16

本方案 2026-09-02 经四轮审查后为 `accepted`。

**第一轮（本会话只读审查，2026-09-02）已改入：** 删除两个无消费点键、通知语义写死为 `INotificationService`、草稿持久化标为新增、C1 包含测试断言更新。

**第二轮（Cursor CLI `cursor-grok-4.6-high` `--mode ask`，2026-09-02）：Approve with changes**（2 Critical + 7 Important + 6 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 消费点全在 B 文件，A/B 双写 | 执行槽改为 B（总方案 Wave 3 B4）；键注册与消费同切片；看板所有权 `uaClientSettings*` / TOC / 测试归 B |
| C2 `showAgentIdentity` 前提不实（IdentityStrip 非 Agent 标签） | 删键 |
| I1 `openConversation` 与 `CONVERSATION_HIDDEN` 持久化打架、消费点无主 | 删键 |
| I2 「非活动会话」未定义 | §2 写死判定 |
| I3 `turnCompleted` 依赖 `onDidTurnSettle` 只在引擎会话点火 | §2 写明仅引擎会话，stub 不伪造 |
| I4 `showInvocationDetails` 无法只关 client-tool | 改名 `showToolInvocationDetails`，作用于全部 tool 行并写明 |
| I5 草稿随会话删除 | §3 / CS-1 完成线加清理 |
| I6 `autoFocus` 第三路径缺失 | §2 列三条路径，`switchToSession` 为新增 |
| I7 未写 `scope` | §1.6 全部 WINDOW 并显式写出 |
| M1–M6 | a11y 引用改 §7；Enter newline 路径写明不新增 command；白名单闭集精确匹配；`enumDescriptions`；pending 锚点并入 §2；PRD-026 验收 2 正文改口 |

**第三轮（同配置，附第二轮意见复核；2026-09-02）：Approve with changes**（0 Critical + 5 Important + 5 Minor）；第二轮 C1/C2/I1–I5/I7 Resolved，I6 NotResolved（本轮 I1）。处理：

| 意见 | 处理 |
|------|------|
| I1 `autoFocus` 调用链不实：Part.focus 不经 `focusDockInput`，`conversationPart.ts` 非 B 所有权 | §2 改为两条路径 + 看板转交 `conversationPart.ts#focus` 一处 |
| I2 `restoreLastSession` 只改 stub，引擎缓存路径无效 | §2 / CS-2 写两处读设置 |
| I3 toast 宿主 per-lens 会重复弹 | 新建单例 `conversationNotifications.contribution.ts` |
| I4 定位只找 confirmation，question 缺 | CS-4 扩展 `scrollToFirstPendingConfirmation` 到 question |
| I5 白名单一次写满 9 键会迫使无消费点注册 | 白名单随切片增长，每刀更新同一断言 |
| M2 「定位逻辑新增」不实 | 改为加开关接已有函数 |
| M3 多 lens 实例草稿互覆 | 条目键 `${sessionId}/${chatId}` |
| M5 `enumDescriptions` 文案 | §1.6 给出 |
| X1 `page-access-schemes.md:954` 仍允许 placeholder | 该行标注已被 PRD-026 / 本方案取代 |

**第四轮（确认轮；2026-09-02）：Approve**（0 Critical / 0 Important / 3 Minor：Part.focus 不得反向 import lens、`autoFocus` 只闸 textarea、toast 点击定位助手——均已改入 §2 / CS-3）。**升 `accepted`。**
