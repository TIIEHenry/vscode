---
title: "绑定叶会话身份：连接重绑、模型回选、浮层/Kill/Reveal"
type: plan
status: accepted
phase: M7
updated: 2026-09-22
summary: "2026-09-19 用户签收。connection 绑 bound；listModels 回选；浮层必参 getBoundSessionId；Kill 自写叶祖先查询；Reveal 对可见叶。本方案不实施 S3w（pill / 叶级 bar 已另路在仓，不升 pills）。不升 PRD-008。"
---

# 绑定叶会话身份：连接重绑、模型回选、浮层/Kill/Reveal

> **slice_id**：`conversation-bound-session`  
> **冲突域 A：** `contrib/conversation/browser` 透镜绑定 / composer catalog / History·Snapshots·Inbox / Kill  
> **冲突域 B（可后并行）：** `contrib/navigator` leftover session 戳 + Reveal  
> **基线：** HEAD `5c910c59a226`  
> **本稿是方案，不是实施。**  
> **不推翻：** [conversation-timeline-session-pills](conversation-timeline-session-pills.md) **S3w 方案 C**（叶级 SessionBar，每扇一份，用户 2026-09-14 签收）。本稿 **不**实施 S3w、不另选 A/B。  
> **不发明：** GetQueue、新 RPC、就地改 `part.sessionKey` 的「主叶换身份」大改（pills 已禁）。

## Problem class

- **症状：** 分栏/浮层看 A，连接一抖时间线变成 B；重连后模型掉回「No model」；子代理对话框里的 History 列出**当前**会话；Kill 杀掉 roster 当前而不是焦点叶。
- **类标签：** **绑定会话 vs roster 当前 混用** + **catalog 刷新当首拉**。
- **复发机制：** 新监听器抄 `getActiveSessionId()`；overlay 不听 `onDidChangeActiveSession`；测 `mountLens()` 不带 `sessionKey`。

## 0. 一句话结论

凡「这个表面已经绑了 session」的路径，一律 `getBoundSessionId()` / 行上的 `sessionId` / lease id。`listModels` 成功后按 **setOptions 前**的 `catalogModelIds[index]` 回选（不发明 `sessionConfig.modelId`）。SessionBar 所有权与主叶跟随 **仍归 pills S3w**，本稿只修不依赖叶级 bar 的身份洞。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `onDidChangeEngineConnection` → `bindSessionView(this.getBoundSessionId())` | `conversationLens.ts` |
| `uaConnection.onDidChangeConnection` → `bindSessionView(this.stubService.getActiveSessionId())` | 同文件，紧邻上一行 |
| `onDidChangeActiveSession`：`boundSessionId !== sessionId` 则 return | 同文件 |
| 生产叶 `ConversationEditorPane.setInput` 带 `sessionKey` | `conversationEditorPane.ts` |
| `loadConnectedComposerCatalogs` 成功 `listModels` 后 `setOptions(..., 0)` + `modelSelectedIndex = 0` + last-good index 0 | `conversationLensComposer.ts` |
| D76 只锁 `switchModel` 空 resolve 回滚 | `conversationLens.test.ts` |
| History / Snapshots `refresh` 用 `roster.getActiveSessionId()` | `conversationEngineHistoryList.ts`；`conversationEngineSnapshotsList.ts` |
| Inbox `render` / Enqueue / Goal / Stop / Retry·Hold 闭包用 **上次 render 的 active**；`beginQueueEdit` 在 `conversationLensComposerChrome.ts`，已用 `getBoundSessionId()` | overlay vs composer chrome |
| History / Snapshots **有** `onDidChangeActiveSession` 并按 **新 active** 重拉；Inbox **无**该监听 | 三 list |
| `tryKillSubAgent`：`roster.getActiveSessionId()` + 该会话 last streaming | `conversationKillEngine.ts` |
| [session-windows.md](../../docs/systems/conversation/session-windows.md) §3：省略 agentId = **该会话**末条 streaming，不发明 `root` | 知识层 |
| Reveal：`openSubAgent(getActiveSessionId(), leftoverAgentId)` | `navigatorReveal.ts` |
| Navigator leftover KEEP 不带 session 戳；换叶后上一会话树可当本会话 leftover | `navigatorAgentsView` / `navigatorTeamList` |
| Maximize / `switchToSession` 已关 History/Snapshots/Visualize；Inbox 关在 `applyActiveSession`。绑定叶跳过 `applyActiveSession` 后 Inbox 仍开，下次 `render` 按 active 重绘。**子代理 overlay** 自己的 Maximize / 切会话不关内层 | `conversationLens.ts` vs overlay |
| pills S3w：bar 脱离透镜、每叶一份（`conversationEditorPane` 的 `leafSessionBar`；`conversationSessionPill.ts`） | 代码在仓。本方案仍不实施 S3w，不升 pills |
| 测 `mountLens()` 常省略 `sessionKey`，锁不住绑定叶 | `conversationLens.test.ts` |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 绑定表面统一 bound/lease/row id；模型回选；Kill/Reveal 跟焦点表面；S3w 不动** | §3 | **选定** |
| B 本波实施 pills S3w | 叶级 bar + reveal 状态机 | **拒绝。** 已签收大刀，冲突域是窗口服务 / Part，不塞进身份修补 |
| C 就地改 `part.sessionKey` 让主叶换身份 | pills 已禁 | **拒绝** |
| D 发明 GetQueue 让 Inbox 跟引擎 | D24 | **拒绝** |
| E 连接事件继续绑 active「好让 StatusBar 对齐」 | 牺牲绑定叶 | **拒绝** |

## 3. 选定设计（A）

1. **S1 连接重绑。** `onDidChangeConnection` → `bindSessionView(this.getBoundSessionId())`。不依赖 connection-dial 的 snapshot/phase 顺序。测必须 `mountLens({ sessionKey: A })` + `switchSession(B)` + 打 **`uaConnection.onDidChangeConnection`**（engine 监听已走 bound，打它假绿）。pairing-hold leftover 早退 `bindSessionView` 不当本测。
2. **S2 模型回选。** `ConversationSessionConfigSelection` **只有** `agentIndex` / `permissionIndex`，**禁止**暗加 `modelId`。在 `setOptions` **之前**快照 `host.catalogModelIds[host.modelSelectedIndex]`；空串 / `['']` / 指数 0 不得当已应用；`indexOf` 进新 ids，没有才 0；last-good 记该 index。须改生产 `setOptions(..., 0)`，并 **新增**「两次成功 `listModels`、用户已选 index≥1 仍是该 id」测。HEAD `conversationComposerCatalog.test.ts` 没有这条；唯一 `modelSelectedIndex = 1` 在 **SUPPORTED throw** 路径——**不要改 D76 / throw 测来锁 index**。Throw 路径继续回 last-good（成功时记的 index）。agent 已按 `getSessionConfig(bound).agentIndex` 回选，保持。
3. **S3 浮层列表身份。** 从**构造它们的透镜**注入必参 `getBoundSessionId: () => string`（overlay 透镜 ≠ 父）。**禁止** `?? roster.getActiveSessionId()` / `?? getActiveSessionId()`。**禁止**把回调写成 `() => lens.getBoundSessionId()`（`boundSessionId==null` 仍回落 roster）。overlay 透镜构造必须带 `sessionKey`，使其 `boundSessionId` 有值。list / restore / delete / retry / hold / enqueue / edit **同一** id。Delete 在 confirm **前**捕获。**选定：bound≠active 则关内层 History / Inbox / Visualize**（与 chrome 关浮层一致），禁止开着按新 active 重拉。现有 History 测 `session change drops leftover…` 是无透镜夹具、切 active **重拉新会话**；生产绑定路径是 **关** History/Inbox/Visualize，不要把该测改成继续重拉。

   `closeSubAgentDialog` **仅**用户关、该 session 从 roster **删除**、或已有合同（面包屑回根 / promote）。删除路径必须 `closeSubAgentDialog(deletedSessionKey)`：无参会走 `resolveSessionKey` → `getActiveConversationEditorPart` → `at(0)`，可能关错叶。HEAD `deleteSession`（SessionBar、Sessions 视图、引擎 roster）都不关 overlay。须监听/包装 roster 删除全入口，对 `deletedSessionKey` 调 `closeSubAgentDialog(key)`；只改 SessionBar 按钮会漏。HEAD 删会话并不关 overlay，这是新行为，测要锁。**禁止** roster 切走就关对话框（对话框应继续显示绑定会话 A）。新 overlay / `filterAgentId` 透镜构造强制 `lensId='conversation'`，不读不写共享 `CONVERSATION_LENS_ID_STORAGE_KEY`；不新开 per-key 持久化；强制 `lensId` 时不要 `store()`，以免改父叶轨迹页。
4. **S4 Kill。** **禁止改、禁止调用** `getActiveConversationEditorPart`（它是仓里唯一现成「DOM → conversation part」API，无命中时 `at(0)`）。**禁止**复用 `resolveSessionKey`。`tryKillSubAgent` **禁止**内部再读 `getActiveSessionId()`，只吃传入的 session。

   自写祖先查询：从焦点元素向上找 **叶** `.conversation-session-leaf`（HEAD `conversationSessionWindowService.ts` 已写 `dataset.sessionKey`），miss → `undefined`。HEAD overlay 挂在 `leaf.sessionWindow.querySelector('.conversation-timeline') || leaf.sessionWindow`（`conversationSessionChat.contribution.ts`）；`createConversationEditorPart.openEditor` 是 `void`，timeline 常还不在，overlay 落在 `sessionWindow` 上——是叶的子孙、**editor part 容器的兄弟**。只 walk part 容器时，焦点在 overlay chrome 恒 miss。`overlay.state.sessionKey` 只在连叶祖先都没有时用（仍不是 `chatId`）。多个 overlay 同时 open：只用叶祖先命中的那一份；否则 no-op。否则 **no-op + 新 notice**（不要复用 disconnected copy），不发 unary。F1/命令面板在 Navigator/Sources 焦点下同样。action（`conversationKillActions.contribution.ts`）把 session 传入。省略 `agentId` 仍走**该 session** 的 last streaming（session-windows §3 不改）。现测把 session 锁成 roster `'s1'` 的必须改。
5. **S5 Navigator（域 B）。** leftover **与活树行**都加 `sessionId`（KEEP 时的 session；活树行打 lease 的 session）。`INavigatorAgentsHierarchyNode` 今日没有 `sessionId`，不能只给 KEEP 行加字段。`onDidOpen` / `revealHierarchyNode` / Team `memberAgentId` / `NavigatorAgentsRevealAction.run` 一律传行戳；禁止只传 `agentId` 再读 `getActiveSessionId()`。

   Reveal 触发面是 Navigator。可见叶钉 `IConversationSessionWindowService.getVisibleSessionKeys()` / `isSessionWindowVisible`，禁止扫 `conversationParts`（含隐藏叶）。`showConversationPart()` 仍可把座位拉出来，但身份不得来自这次 `ConversationPart.focus()`。

   **保留 HEAD 已有分支**（身份改成行戳，不是一律 `openSubAgent`）：`isEngineRootAgentId` → `navigateAgentBreadcrumb(戳, 'default')` 并关该 session 对话框；已有 tab → `navigateAgentBreadcrumb`；否则 `openSubAgent(戳, agentId)`。戳对不上任何可见叶 → notice。不调用 `getActiveConversationEditorPart`，不 `getActiveSessionId()`，不 `switchSession`，不改 `part.sessionKey`，不 `setBoundSessionId` 当开窗。与 [sources-review-open-identity](sources-review-open-identity.md) 一致：两边仍都不改该全局函数。跨会话打开留给 pills `revealSessionWindow`。Team `refreshTeamData`：开始时记下 `sessionId`/`lease`，任一 await 后对不上则丢弃结果（含 catch）。Projects pairing KEEP 只在 `treeNodes` 已有 leftover 时；活画→`sessionList` UNSUPPORTED 走 D406 同款 KEEP（不重开 D406 正文）。

**明确留给 pills S3w（本稿不做）：** 叶级 SessionBar 拆装、共享槽 `reset`、SelectBox 换叶 input、`ensurePrimaryWindow` 跟随改口、`getActiveConversationEditorPart` 的 last-focused 记忆（除 S4 的 Kill no-op）。

## 4. 不变量

- 绑定叶的 lease / 时间线 / 写入不因连接事件换成 roster 当前。
- catalog 成功刷新不是首拉；不得无故回到 No model / No agent。
- 一个 overlay 一张会话目录；Restore/Delete/Retry 的 session id 等于点下去的那一行。
- Kill 省略 id 只杀 **叶祖先命中 / 无叶祖先时 overlay.state.sessionKey** 的会话；杀不准则不发 unary。
- Reveal 只打开产生该行的会话（戳对得上某扇**可见叶** `sessionKey`）。
- 不实施 S3w、不发明 GetQueue、不升 PRD-008。

## 5. 切片

| Slice | 域 | Goal | Files | Exit |
|:------|:---|:-----|:------|:-----|
| **S1** | A | connection 绑 bound | `conversationLens.ts` + **带 sessionKey** 的 lens 测 | 绑定叶不跟 active |
| **S2** | A | setOptions 前快照 ids[index] | `conversationLensComposer.ts` | 生产不再 `setOptions(..., 0)`；**新增**两次成功刷新锁 index；不改 throw/D76 测 |
| **S3** | A | 注入必参 bound；切走关内层；roster 删除全入口 `closeSubAgentDialog(key)` | 三 list + overlay + inbox + composer chrome Hold/edit + roster 删除包装 | 切 active 不串目录；Delete 不换 id；对话框仍 A；无 `?? getActiveSessionId()` |
| **S4** | A | Kill 自写叶祖先查询；禁调用 `getActiveConversationEditorPart` | `conversationKillEngine.ts` + **kill actions contribution** | 焦点不在叶 → no-op + 新 notice；overlay chrome 仍能命中叶；不改 EditorParts |
| **S5** | B | 行戳（KEEP+活树）+ Reveal 对可见叶；保留 root/tab 分支 | `navigatorReveal.ts` · Agents/Team/Projects + 行类型加 `sessionId` | `getVisibleSessionKeys()`；root 走面包屑不 `openSubAgent`；跨会话不 `switchSession` |

测必须带 `sessionKey` 的透镜夹具，禁止只 `mountLens()` 冒充绑定叶。本地 `scripts/test.sh --run` 点名。不跑托管 CI。

## 6. 不做

- pills S3w 全套；就地 `part.sessionKey`
- 虚拟化 seat map（审查 lens #5）——可挂 S3 顺手删 `disposeElement` 条目，**不**单独立项阻塞
- Sessions 层 `canOpenSession` 信任门（`src/vs/sessions`，另一系统）
- 流解码 / Connect bytes / Sources 已审

## 7. 相关

- [conversation-timeline-session-pills](conversation-timeline-session-pills.md) S3w  
- [session-windows.md](../../docs/systems/conversation/session-windows.md)  
- [navigator-engine-segments](navigator-engine-segments.md) · D406 KEEP（同会话）  
- [composer-fake-chrome](composer-fake-chrome.md)（不复活假 model）

## 审查记录

| 轮 | Assessment | 处置 |
|:---|:-----------|:-----|
| 2026-09-18 规则 16 | 改完 Critical 前不可实施 → 已改入 | C1：S2 禁止发明 `modelId`，setOptions 前快照。C2：Kill 不复用 `resolveSessionKey`、不改 `getActiveConversationEditorPart`。C3：roster 切走不关子代理对话框。I4–I8：注入 bound、关内层选定、Reveal 对焦点叶、夹具带 sessionKey、与 sibling 分界。Minor：`beginQueueEdit` 改口。 |
| 2026-09-18 规则 16 第二轮 | 改完 Critical 前不可实施 → 已改入 | 父核 HEAD 后改入 Critical：S5 Reveal 身份改成「KEEP 戳 === 某一扇可见叶 sessionKey」，禁止套用 Kill 的 DOM 命中（Navigator 焦点下 DOM 恒 miss / 之后命中 primary）。Important：S3 注入必参、禁止 fallback roster；`closeSubAgentDialog(deletedSessionKey)`；S4 `tryKillSubAgent` 不内读 `getActiveSessionId()`、无命中用新 notice；S2 锁成功路径 selectedIndex。Minor：overlay 强制 lensId 不 `store()`；Kill overlay 回退只用于 sessionWindow 挂载。 |
| 2026-09-18 规则 16 第三轮 | 改完 Critical 前不可实施 → 已改入 | 父核 HEAD 后改入 Critical：S4 自写 `.conversation-session-leaf` 祖先查询（miss→undefined），**禁止调用** `getActiveConversationEditorPart`（overlay 挂在 sessionWindow，是 part 容器兄弟）。Important：S5 保留 root/tab 分支、可见叶用 `getVisibleSessionKeys()`、活树行也打 sessionId；S3 roster 删除全入口；S2 新增两次成功测、不改 throw/D76。 |
| 2026-09-18 规则 16 第四轮 | **Approve（无 Critical、无 Important）** | 签收门禁通过。Minor 已记：注入回调勿包 `lens.getBoundSessionId()`；Part 级 SessionBar 不在叶内时 Kill no-op；关 overlay 只在 `deleteSession===true` 之后。 |
| 2026-09-18 规则 16 第五轮 | **Approve（无 Critical、无 Important）** | HEAD 未漂移。六条约束仍有源码锚点。可以签收。 |
| 2026-09-18 规则 16 第六轮 | **Approve（无 Critical、无 Important）** | HEAD 仍 `5c910c59a226`。六条约束仍有源码锚点。可以签收。 |
| 2026-09-19 用户签收 | **accepted** | 无 Critical/Important。转入实施。 |
