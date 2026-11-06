---
title: "设计审查 2026-11-04 p3：会话作用域与会话状态归属"
type: plan
status: accepted
phase: N/A
updated: 2026-11-06
summary: "叶子只认自己的会话 id；权限与模型选择收到按会话串行的一处；两份会话列表都留并抽共享行（p3-3a）；attribution 改用 ItemAttribution（p3-3b）；共享接口留在 conversation/common，不改 roster token。"
---

# 设计审查 2026-11-04 p3：会话作用域与会话状态归属

状态：执行中。
签收：签（收窄）。签收人：agent:cursor（用户委托），日期：2026-11-05。p3-3 与 attribution 类型已拍板，切片已补写为 p3-3a 与 p3-3b，过规则 16 只读审查后才实施，见「待定项」。
覆盖需求：无（正文未引用需求编号）。

叶子里的读写用该叶的会话 id。全局活动会话只留给名单、状态条、启动恢复和命令面板这类没有叶子的入口。权限模式和模型选择按会话 id 收成一份，两套视图订阅同一份。不新 RPC，不新快照字段。

本稿是方案，不是实施。行号对应当前工作区。这些路径上已有无关未提交改动；实施只改本切片符号，不把别人的 diff 卷进提交，也不为清工作区做 stash / restore / reset。

编码约束：服务走构造注入，非服务参数在前；订阅和子对象放进 `DisposableStore` / `_register`；用户可见文案走 `nls`，不拼接。`workbench/browser` 可以依赖 `contrib/conversation/common`（`editorParts.ts` 已经在引 `conversationChatInput.ts`），不要从 `browser/parts` 去引 `contrib/conversation/browser`。

## 冲突域

| 切片 | 会碰的文件 |
|:-----|:-----------|
| p3-1 | `conversationLens.ts`、`conversationLensSessionBar.ts`、`conversationSessionWindowService.ts`（只删 `focusin` 里的第二笔 `switchSession`）；`.eslint-plugin-local` 与 `eslint.config.js`。不改 `editorParts.ts` 的 `mapPartToInstantiationService`。`conversationLeafSessionBar.ts` 保持「活动 id 已是目标则不调用」。History / Inbox / Snapshots 的未注入回退不改 |
| p3-2 | `conversationLens.ts`、`conversationLensComposer.ts`、`conversationLensComposerChrome.ts`、`conversation.contribution.ts`；新增会话选择服务。与 [r11-3](review-2026-10-30-r11-conversation-plan.md) 同一套 epoch 符号 |
| p3-3a | `conversationSessionsViewStrings.ts`（新增共享行 chrome 纯函数）、`conversationSessionsView.ts`（`SessionsRenderer` 与无障碍供给改读共享行）、`navigatorProjectsList.ts`（`ProjectNodeRenderer` 的状态回调与 `rebuildTree` 的 `sessionDetail` 改读共享行）。删除确认已在 `conversationDeleteSessionConfirm.ts`，不重写；树与列表各自的容器、排序、过滤不碰 |
| p3-3b | `services/agentSession/common/agentSessionContext.ts`（`IAgentSessionViewLease.attribution` 类型与文件头注释）、`contrib/sources/browser/sourcesReviewAttributionService.ts`（删两处 `as ReadonlyMap<string, IReviewItemAttribution>` 断言）。生产实现 `contrib/conversation/browser/agentSessionContext.ts` 只随类型编译，不改方法体。与 p3-5 同改 `services/agentSession/common/agentSessionContext.ts`，排在 p3-5 之后，不并行 |
| p3-4 | `navigator` 生产文件里指向 `conversation/browser` 的 import；`navigatorStubView.ts`、`navigatorStub.css`、`navigator.contribution.ts`。roster 接口整份搬迁见该条，不进 `workbench/services` |
| p3-5 | `services/agentSession/common/agentSessionContext.ts`；`contrib/conversation/browser/agentSessionContext.ts`；把该方法当可选的测试替身 |

p3-1 与 p3-2 都改 `conversationLens.ts`，p3-2 排在 p3-1 的透镜切片之后。p3-3 与 p3-4 都改 `navigatorProjectsList.ts`，p3-4 的 import 下沉先做，p3-3 再抽行。p3-5 与前几条不共用文件，可并行。

## 切片顺序

1. p3-1a 已绑定透镜不再用活动会话填 id；会话栏三条回退改走绑定 id。不新增 DI 作用域
2. p3-1b 窗口服务获焦只留一笔写回。叶栏保持相等则不调用。History / Inbox / Snapshots 的未注入回退不改
3. p3-1c eslint 规则，允许名单等于 1b 之后仍合法的调用方。files 排除 `*.test.ts`
4. p3-2 会话选择服务（待定项 1 已选新服务）。2a 与 2b 同一次合入：两份透镜都订阅之前，不单独合入只持有 map 的 2a
5. p3-5 会话上下文方法改为必填并补齐替身。attribution 类型已选 `ItemAttribution`（待定项 3），改法见 p3-3b，本片不动
6. p3-4 共享符号下沉与 Navigator 的 Stub 改名。decorator id 不改
7. p3-3a 两份都留并抽共享行，排在 p3-4 的 import 下沉之后；p3-3b attribution 改型排在 p3-5 之后。两片都过规则 16 后再实施

## 与已签收合同

- [ADR-003](../decisions/003-engine-adapter-boundary.md) 决策 4：公开类型仍是 `IConversationRosterService`，decorator id 仍是 `'conversationStubService'`，`IConversationStubService` 仍是别名。决策 6：禁止把 roster 接口定义在 `workbench/services`。所以「共享接口下沉到 `services/agentSession`」不采纳。`IAgentSessionContext` 继续当 Sources / Navigator 用的薄门面。
- [conversation-bound-session](conversation-bound-session.md)：已经绑定的表面用绑定 id，禁止再包一层 `getBoundSessionId()` 把空值退回 roster。本稿收的是它没改掉的回退和叶子里剩下的 `getActiveSessionId()`。
- [conversation-timeline-session-pills](conversation-timeline-session-pills.md) 与 [session-windows](../../docs/systems/conversation/session-windows.md)：叶获焦仍 `switchSession`，让名单和命令面板的全局活动会话跟上焦点叶。本稿不删这笔写回。
- [2026-10-26-leaf-session-root-identity](2026-10-26-leaf-session-root-identity.md)：已绑定身份条用该叶的工作根；真正未绑定的宿主才沿用活动根。本稿不删未绑定这条。
- [r09 方案](review-2026-10-11-r09-conversation-plan.md) 的 r09-2 已落地，残留由 [r11-3](review-2026-10-30-r11-conversation-plan.md) 承接。r11-3 已签收、未实施。活码仍在进入在飞判断之前把 rollback 写成被盖掉的乐观值（`conversationLensComposerChrome.ts:1514-1515`，`inFlight` 在 `:1521`）。过期且仍可写的成功在 `:1340` 直接 `continue`，不把 `sentModelId` 写入 confirmed。本稿只搬存放处，不实现 r11-3 的目标代数。
- [engine-write-gate-unification](engine-write-gate-unification.md) 的写闸不在本稿。

## p3-1 叶子会话作用域

问题类：同一套 UI 有时读叶子绑定的会话，有时读 roster 的全局活动会话；焦点叶再把全局活动会话写成自己，另一叶里没绑住的读就会跟着变。

核实过的证据：

`contrib/conversation` 下生产 `.ts`（不含 `test/`、不含 `*.test.ts`）里，`getActiveSessionId(` 79 处、24 个文件；`getBoundSessionId(` 110 处、12 个文件；单词 `boundSessionId` 25 处、5 个文件（`conversationLens.ts` 9，含 `:332` 注释；`conversationIdentityStrip.ts` 10；`conversationLensComposer.ts` 3；`conversationLensReadingColumn.ts` 2；`conversationEditorPane.ts` 1）。

| 事实 | 位置 |
|:-----|:-----|
| 构造时 `boundSessionId = slots.sessionKey` | `conversationLens.ts:343` |
| `getBoundSessionId` 在字段为空时返回 `stubService.getActiveSessionId()` | `conversationLens.ts:449-450` |
| `listSessionId` 有字段时只返回字段 | `conversationLens.ts:458-462` |
| 会话栏 host 上 `getSessionBarSelectId` 可选 | `conversationLensSessionBar.ts:79` |
| 选择框、刷新选项、删除用 `getSessionBarSelectId?.() ?? getActiveSessionId()` | `conversationLensSessionBar.ts:407`、`:426`、`:705` |
| `ConversationLens` 不实现 `getSessionBarSelectId` | `conversationLens.ts` 仅有 `:449` 的回退 |
| 生产叶栏实现了该方法，返回叶的 `sessionKey` | `conversationLeafSessionBar.ts:163-165` |
| 生产透镜两处创建都不把 `sessionBar` 槽交给透镜：编辑器页只给 tablist / timeline / dock | `conversationEditorPane.ts:152-157` |
| `setInput` 从资源解析 `sessionKey`，再 `ensureLens` 与 `setBoundSessionId` | `conversationEditorPane.ts:115-117` |
| 子代理 overlay 给的是 `lensTablist`，并带 `sessionKey` | `conversationSubAgentOverlay.ts:218-225` |
| 因此生产两叶的栏 host 是叶栏，三条 `??` 在这条路径上不走到活动会话。回退留给「透镜自己当栏 host」和没实现该方法的调用 | 同上 |
| 窗口服务读全局活动会话 7 处 | `conversationSessionWindowService.ts:255`、`:556`、`:560`、`:604`、`:688`、`:801`、`:899` |
| `:602` 的 `focusin` 先 `setFocusedLeaf`，`:604` 再比一次活动 id 并 `switchSession`。`setFocusedLeaf` 末尾 `:688` 已经在活动 id 不同时写过。写回成功后第二笔因 id 已相等而走不到。会话不在目录里时引擎 `switchSession` 不改活动 id（`conversationEngineRosterService.ts:403-429` 落下），两笔都是空操作 | 同文件 `:602-607`、`:674-690` |
| 叶栏在 reveal 之后只在活动 id 不是目标时 `switchSession(sessionId)`。`revealSessionWindow` 在没有 grid、或叶不可见时返回 `cancelled: false` 且不 `focusLeaf` | `conversationLeafSessionBar.ts:176-178`；`conversationSessionWindowService.ts:348-351`、`:401-402`、`:417-418` |
| 已连接且会话在目录里时，活动 id 相同的 `switchSession` 仍 `requestAgentTreeRefresh` 并 `persistEngineAwareRoster`。`focusLeaf` 成功时 `setFocusedLeaf` 已经写过 | `conversationEngineRosterService.ts:415-424`；`conversationSessionWindowService.ts:688-690` |
| 身份条只在 `boundSessionId` 为空时读活动 id | `conversationIdentityStrip.ts:244` |
| 生产 Inbox、History、Snapshots 都传入 `() => host.listSessionId()` | `conversationLensDock.ts:187`；`conversationLensSessionBar.ts:156`、`:162` |
| 未注入回调时 History、Snapshots、Inbox 才读活动 id。`mountList(connection)` 不传回调 | `conversationEngineHistoryList.ts:249-250`；`conversationEngineSnapshotsList.ts:353-354`；`conversationInboxOverlay.ts:218-222`；`test/browser/conversationEngineHistoryList.test.ts:526` |
| 未绑定透镜的 `listSessionId` 仍读活动 id | `conversationLens.ts:462` |
| live tree 只绑定活动会话；没有焦点 part 时 `resolveSessionKey` 退回活动 id | `conversationSessionChatService.ts:92-93`、`:818-828` |
| `editorParts.ts:303-309` 的子服务在 `editorPart.create`（`:274`）之后才放进查找表。组在 `create` 里已经拿了 part 自己的 `scopedInstantiationService`（`editorPart.ts:200`、`:744`）。组在 `editorGroupView.ts:220` 再建自己的 `scopedInstantiationService`，编辑器页在 `:237` 由该服务创建。透镜从页的 `paneInstantiationService` 创建（`conversationEditorPane.ts:152`）。`:305` 注入不到透镜。该表只给 `getScopedInstantiationService` | `conversationSessionChatService.ts:831-832` |
| 构造参数 `sessionKey` 已写入 `super()` 的 memento id。`this.sessionKey` 在 `super()` 返回后才赋值。`scopedInstantiationService` 是 `readonly`，`super()` 之后不能改写 | `conversationEditorPart.ts:45-61`；`editorPart.ts:175` |
| overlay 由会话 chat 服务创建，用的是聊天服务自己的 `instantiationService` | `conversationSessionChatService.ts:135` |

同类修补仍在加：`afbe92c5a46`（快照按发送时的活动会话）、`002b1a9f4f3`（Accessible View 按当前活动会话朗读）、`a12e2d6b907`（绑定会话已离开名单时不再显示活动会话标题）、`c46fcf75fe4`（lease 与绑定会话不一致时不投影）、`3a1a1d9ffc0`（阅读列跟绑定会话）。

调用点要删掉的是 `conversationLensSessionBar.ts` 的 3 处 `?? getActiveSessionId()`。`conversationLeafSessionBar.ts:176` 的比较留下。`conversationInboxOverlay.ts`、`conversationEngineHistoryList.ts`、`conversationEngineSnapshotsList.ts` 的未注入回退留下。`conversationLensReadingColumn.ts` 里那一处是参数类型上的 `getActiveSessionId(): string`（`:206`），不是调用；会话 id 走 `resolveReadingColumnSessionId`。`conversationLens.ts` 的 2 处、`conversationIdentityStrip.ts` 的 1 处留给未绑定宿主，文件留在允许名单。「字段已设置时不读」靠 `getActiveSessionId` 的调用计数，返回值仍是 A 锁不住先读再返回。`conversationTurnContentAdapter.ts` 的 2 处保留：`:320` 在没有焦点 part 时退回活动 id，`:325-326` 用活动 id 判断要不要 `switchSession(hit.sessionKey)`。`conversationSessionChatService.ts` 的 2 处也留在允许名单：live tree，以及没有焦点 part 时的 `resolveSessionKey`。

不变量：

- 构造时带了 `sessionKey` 的透镜，`getBoundSessionId()` 等于该字段，不读 roster 活动 id。
- 叶栏的选择、删除、标题使用叶的 `sessionKey`。共享栏函数不再写 `?? getActiveSessionId()`。
- 叶获焦仍由 `setFocusedLeaf` 在活动 id 不同时 `switchSession` 一次。`focusin` 里不再写第二笔。
- 叶栏在 reveal 得到 `cancelled: false` 之后，仅当活动 id 还不是参数 `sessionId` 时 `switchSession(参数)`。已经相同则不再调用，避免再打一笔 agent tree 刷新和 roster 持久化。没有 grid、叶不可见的那些返回仍靠这道比较写回。
- 没有叶子的入口可以读全局活动会话：roster 自身、`AgentSessionContext` 门面、会话列表、状态条、启动恢复、命令面板上的快照 / Accessible View / Fork / Reveal / 通知。这些命令在真正发出时再读，避免把 await 之前的 id 用到发送之后（`afbe92c5a46`、`002b1a9f4f3` 的方向）。
- 叶子里的控件在手势开始时钉住作用域 id，await 之后仍用这个 id，不用后来的活动会话。
- 未绑定身份条仍可沿用活动根。绑定之后只认绑定 id。
- live tree 仍只观察活动会话。不在本条改成每叶一条 lease。

要动的符号与文件：

- 不新增 `ISessionScope`，不改 `EditorPart` 构造函数。生产透镜的会话 id 继续来自构造参数 `slots.sessionKey`（编辑器页从 input 解析后传入，overlay 从 `state.sessionKey` 传入）。会话 part 的构造参数 `sessionKey` 在 `super()` 期间已经可用，并写进 memento id。
- `ConversationLens.getBoundSessionId`：字段已设置时只返回字段，且该分支不调用 `getActiveSessionId`。未绑定仍可读活动 id，所以这个文件留在 eslint 允许名单。`ConversationLens` 补上 `getSessionBarSelectId`，有字段时返回字段，没有时不读 roster。
- `createSessionSelectBox`、`refreshSessionSelectOptions`、`deleteActiveSession` 去掉 `?? getActiveSessionId()`。
- `setFocusedLeaf` 保留写回；`focusin` 监听去掉自己的 `switchSession`。
- `ConversationLeafSessionBar.switchLeafSession` 保持现有比较：活动 id 已经等于参数时不调用 `switchSession`。id 用参数。不把这笔写回挪进 `focusLeaf`，也不改成无条件调用。
- History、Snapshots、Inbox 的 `resolveSessionId` 保持现状：已注入回调时只用回调的返回值；没注入时仍读活动 id。生产三条都传入 `() => host.listSessionId()`。未绑定透镜的这个回调在字段空时仍读活动 id。`test/browser/conversationEngineHistoryList.test.ts:526` 的 `mountList(connection)` 不传回调，走活动 id（默认夹具 `'sess-1'`）。空 id 只出现在回调已经注入且返回空的时候：History 用回调返回值，Inbox 在 `conversationInboxOverlay.ts:220` 用 `?? ''`。不要把未注入回退改成返回空。

改法：

1. **p3-1a。** 两处生产创建保持传入 `sessionKey`。`getBoundSessionId` 在字段已设置时返回字段，该分支不调用 `getActiveSessionId`。未绑定分支可以继续读活动 id，调用留在本文件。栏的三处 `?? getActiveSessionId()` 改为：host 提供 `getSessionBarSelectId` 就用它；否则在 `listSessionId()` 有绑定字段时用它；仍没有则不选中、不删除。`ConversationLens.getSessionBarSelectId` 只返回绑定字段，有字段与无字段都不读 roster。
2. **p3-1b。** `focusin` 删除第二笔 `switchSession`。叶栏保持 `:176-178`：没有 grid 和叶不可见、`focusLeaf` 不会跑的那些 `cancelled: false` 返回上，活动 id 还不是目标时 `switchSession(参数)`；已经是目标 id 时不再调用。Inbox、History、Snapshots 不改 `resolveSessionId`。阅读列、身份条、时间线点击不改调用。
3. **p3-1c。** 在 `.eslint-plugin-local` 增加规则。`index.ts:14-17` 注册同目录每个 `*.ts`，只跳过 `index.ts` 与 `utils.ts`；新文件避开这两个名字。`eslint.config.js` 若覆盖整个 `contrib/conversation/browser`，files 必须排除 `*.test.ts`。同目录的 `conversationSessionsView.test.ts` 含 `getActiveSessionId(`，`conversationEngineHistoryList.test.ts` 也在这个目录，两者都不在允许名单。规则只看 `getActiveSessionId` 的调用表达式，不看类型签名。允许名单：roster 接口与两处实现、`conversationStubModel.ts`、`browser/agentSessionContext.ts`、`conversationLens.ts`、`conversationIdentityStrip.ts`、`conversationTurnContentAdapter.ts`、`conversationSessionWindowService.ts`、`conversationSessionChatService.ts`、`conversationSessionsView.ts`、`conversationSessionStatusBar.ts`、`uaClientSettingsStartup.contribution.ts`、`conversationCreateSnapshotActions.contribution.ts`、`conversationAccessibleView.ts`、`conversationNotifications.contribution.ts`、`conversationOpenPendingOnFocus.contribution.ts`、`conversationRevealItem.contribution.ts`、`conversationForkEngine.ts`、`conversationLeafSessionBar.ts`、`conversationInboxOverlay.ts`、`conversationEngineHistoryList.ts`、`conversationEngineSnapshotsList.ts`。删掉三处调用之后的 `conversationLensSessionBar.ts` 不在名单里。不另写扫源码文本的测试。允许名单按文件放行，锁不住「绑定分支不再读」；那条靠 1a 的调用计数。

明确不改什么：

- 不删 `setFocusedLeaf` 的 `switchSession`。名单高亮和命令面板仍跟焦点叶。
- 不把叶栏改成无条件 `switchSession`。活动 id 已经是目标时再调，会在已连接且会话在目录里时多打一笔 `requestAgentTreeRefresh` 与 `persistEngineAwareRoster`。
- 不改 History、Snapshots、Inbox 在未注入回调时读活动 id。生产行为保持「回调里的 `listSessionId()`」。
- 不改 `ensurePrimaryWindow` 不跟随 roster 的合同（`session-windows` 与 pills）。`:255`、`:556`、`:560`、`:801`、`:899` 仍是窗口服务在没有叶、恢复布局或删空之后决定开哪一扇，留在允许名单。
- 不把 `bindLiveTreeLease` 改成每叶一条。
- 不改 `getActiveConversationEditorPart`，不改 `part.sessionKey`。
- 时间线点击若要切到另一会话，仍是显式 `switchSession(hit.sessionKey)`（`conversationTurnContentAdapter.ts:325-326`）。命中行提供 id。活动会话只用来判断要不要切，也用来在没有焦点 part 时解析来源（`:320`）。
- 不改 `editorParts.ts`，不加 `ISessionScope`。

本地验证：

- `conversationLeafSessionBar.test.ts`、`conversationSessionWindowSideBySide.test.ts`：两叶时 A 的栏和透镜 id 仍是 A，roster 活动 id 可以是 B。这条只锁返回值。
- 新增：字段已设置时，`getBoundSessionId`、`listSessionId`、`getSessionBarSelectId` 对 `getActiveSessionId` 的调用次数为 0。先读活动 id 再返回字段，这条失败。未绑定分支仍允许调用。
- 新增：`focusin` 到另一叶只发生一次 `switchSession`。没有 grid、或叶不可见且活动 id 还不是目标时，叶栏选择仍 `switchSession` 到该参数。活动 id 已经是该参数时，`switchLeafSession` 不再调用 `switchSession`。
- History / Inbox / Snapshots 的生产路径不变：已注入回调只用回调，未注入仍读活动 id。跑 `ConversationEngineHistoryList`、`ConversationEngineSnapshotsList`，以及 `conversationInboxOverlay.test.ts` 里标题以 `ConversationInboxOverlay` 开头的 suite。`scripts/test.sh --grep` 用这些 suite 名，不要只写「History」。
- 保持 `conversationIdentityStrip.test.ts` 里未绑定宿主仍跟活动根、绑定叶不跟另一叶的用例，包括 `D1386 bound leaf does not borrow a window root when its root API is absent`。
- `scripts/test.sh --grep "openSessionBeside creates two conversation editor parts|Conversation session window side-by-side|D1386 bound leaf|ConversationEngineHistoryList|ConversationEngineSnapshotsList|ConversationInboxOverlay"`，或 `scripts/test.sh --run` 指向上述文件。改动文件 `npx eslint`。

风险与回退：允许名单里的 `conversationLens.ts` 仍能在新代码里直接读活动会话，eslint 不会响。绑定路径靠调用计数。回退是恢复栏上三条 `??` 和 `focusin` 的第二笔 `switchSession`。1a 可单独提交。1b 只删 `focusin` 的第二笔，`conversationSessionWindowService.ts` 留在允许名单，1c 不依赖 1b。没有 1a 时不要合 1c：`conversationLensSessionBar.ts` 的三处调用还在，它又不在允许名单里。叶栏与 History / Inbox / Snapshots 留在名单里，1c 不要求删它们的调用。

## p3-2 权限与模型选择的归属

问题类：每个 `ConversationLens` 各存一份会话权限和模型，子代理 overlay 与编辑器页各有一份透镜，同一会话的两次选择各发各的引擎调用，另一视图看不到。

核实过的证据：

| 事实 | 位置 |
|:-----|:-----|
| 实例字段 `sessionConfigBySessionId`、`modelProfileIdBySessionId` | `conversationLens.ts:292-293` |
| 生产透镜两份：编辑器页、子代理 overlay | `conversationEditorPane.ts:152`；`conversationSubAgentOverlay.ts:218` |
| epoch 用模块级 `WeakMap`，键是 host | `conversationLensComposerChrome.ts:1162-1163` |
| `getSessionConfig` / `setSessionConfig` 读写 host 上的 map | `conversationLensComposerChrome.ts:999-1008` |
| 注释写明每个会话最多一笔在飞的 `setPermissionMode` / `switchModel`，实际按 host 隔离 | `conversationLensComposerChrome.ts:1229`、`:1298` |
| 选择类型只有 `agentIndex` 与 `permissionIndex` | `conversationLensComposerChrome.ts:115-118` |

行为变化：同一 `sessionId` 只有一份配置和一套 epoch。编辑器页改了模型或权限，overlay 上同一会话的下拉跟着变；反过来也一样。两视图同时改同一会话时，后一次进入已经在飞的那一轮，不再各发一笔。视图关掉之后，已发出的结果仍写进这份状态；已 dispose 的视图不改 DOM。下一个打开的视图读到的是这份已有状态，不用自己的下标 0 去覆盖。不同 `sessionId` 仍并行。

代数保持活码，不提前做 r11-3。`applySessionModelIndex` 仍在 `:1514-1515` 把 rollback 写成当时的 `previous`，然后才看 `inFlight`（`:1521`）。过期且可写的成功仍在 `:1340` `continue`。`conversationLensDisposeGate.test.ts` 里 `overlapping switchModel failure does not restore the dropdown to the earlier index` 与 `overlapping switchModel success does not keep the earlier modelId` 的预期保持今天的结果，只是断言改读共享状态里的该 `sessionId`。r09-2 不再另做一遍。r11-3 落地时再改代数，不跟本片绑在一次提交里。

不变量：

- 共享 epoch 的初值来自第一份已经接受的状态。新 host 不得用自己的 `modelSelectedIndex`（`conversationLensComposerChrome.ts:140`，`sessionModelEpoch` 在 `:1210-1211` 用它当 confirmed 初值，`applySessionModelIndex` 在 `:1486` 用它当 `previous`）去创建或覆盖共享 rollback。各视图的下标只是显示，由共享状态推下来。
- 除此之外，连点、空槽、过期成功的走向与搬迁前的活码相同。
- `submitDraft` 仍读已落下的 `catalogModelIds[modelSelectedIndex]`，发送公式不动。
- 不把 `modelId` 加进 `ConversationSessionConfigSelection`（[conversation-bound-session](conversation-bound-session.md) 已禁止）。

要动的符号与文件：`getSessionConfig`、`setSessionConfig`、`applySessionModelIndex`、`drainSessionModel`、`sessionPermissionEpoch`、`sessionModelEpoch`、两份 `WeakMap`。文件见冲突域。宿主是待定项 1。推荐新的 `IConversationSessionChoiceService`，按 `sessionId` 保存选择和 epoch，并提供 `onDidChangeSessionChoice`。透镜改为注入它，删掉两个实例字段。

改法（待定项 1 已选 A）：

1. **p3-2a。** 服务持有现在 host 上的两张 map 和两套 epoch。`sessionModelEpoch` 在该 `sessionId` 已有记录时直接返回，不用后来的 host 的 `modelSelectedIndex` 当 confirmed 或 rollback。还没有记录时，用调用方当时的下标记一笔，之后只由 `applySessionModelIndex` / `drainSessionModel` 按活码更新。两处 drain 的判断改读写服务，分支各自保持现状。`drainSessionModel`：`:1330` 过期且不可写，`:1340` 过期且可写时 `continue`，不写 confirmed。`drainSessionPermission`：过期且可写、`result.ok` 时先把 `confirmedIndex` 写成 `sentIndex` 再 `continue`（`:1256-1259`）；catch 里过期且可写则 `:1285` `continue`。不要把模型的 `:1340` 当成权限分支。host 只负责把事件画到自己的下拉；画之前看 host 未 dispose，且画的 `sessionId` 仍是该视图的绑定 id。
2. **p3-2b。** 编辑器页透镜与 overlay 透镜都订阅同一服务。catalog 刷新回选时，以服务里该会话已接受的 id 为准；服务还没有时保持今天的回选（[conversation-bound-session](conversation-bound-session.md) S2：`setOptions` 前快照，不把成功刷新写成下标 0）。
3. 两份透镜都接上服务之前，2a 与 2b 不分开合入。只合 2a 时两份透镜仍各写各的实例字段，上文「同一 `sessionId` 只有一份」不会出现。
4. 订阅现有 `onDidChangeConnection`。载荷已是 `UniverseAgentConnectionSnapshot`（`universeAgentConnection.ts:439`），`linkId` 在 `universeAgentTypes.ts:1684`。与上一份已记下的 `linkId` 不同时（含从有到无）清空这两张 map，避免上一台引擎的 id 留在下拉里。同一事件也会因相位、`pairingPending`、`agentTreeFetchFailed` 发出，这些更新可以保持同一个 `linkId`（`universeAgentConnectionService.ts` 的 `_publishConnectionPhase`、`_setAgentTreeFetchFailed`，以及 pairing 在 `:1299-1302` 的 `_fireSnapshotChanged`）。`linkId` 未变时不清 map，避免 pairing 刷新清掉该会话的模型和权限。不新字段。

明确不改什么：

- 不改 `switchModel` / `setPermissionMode` 的参数形状。
- 不把选择写入 `conversation.roster.v1`。
- 不改 `:1514-1515` 与 `:1340`。r11-3 另片做。
- 不改空槽、leftover、单次失败回滚用例的预期。
- 不改写闸。

本地验证：

- 改 `conversationLensDisposeGate.test.ts` 中上述两条 overlapping 用例，以及该文件里已有的 leftover model 用例，断言改到服务上的同一 `sessionId`。
- 新增：两个 host 绑定同一 `sessionId`。第一个已经接受非 0 下标，第二个以自己的下标 0 打开；共享 rollback 仍是第一个的 id，第二个下拉被画成这个 id。第一个 `switchModel` 挂起时第二个再选，只按最后一次目标再发，两套下拉停在同一 id。
- 新增：第一个 host dispose 之后结果才回来，服务里的 id 已更新，第二个 host 的下拉是这个 id。
- 新增：同一 `linkId` 上的相位或 pairing 刷新不清该会话的模型和权限；`linkId` 变化后这两张 map 为空。
- `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationLensDisposeGate.test.ts`。若用 `--grep`，写该文件里的完整标题：`overlapping switchModel failure does not restore the dropdown to the earlier index`、`overlapping switchModel success does not keep the earlier modelId`、`leftover model keeps the accepted value and does not show an unsent newer target`、`leftover model with an empty resolved id rolls back and does not paint a failure notice`、`selecting the empty model does not send switchModel and a stale failure does not force index 0`。短词 `leftover model` 还会命中 engine overview 与 provider 的标题。改动文件 `npx eslint`。

风险与回退：服务是单例，测试之间要在 teardown 清掉 session 状态，否则串用例。回退是把 map 和 `WeakMap` 移回 host，两视图恢复各写各的。2a 与 2b 一次回退。

## p3-3 两份会话列表

问题类：Projects 树里嵌了一份会话，Sessions 视图是会话列表本身；两边各自画行，删除确认已经共用。

核实过的证据：

| 事实 | 位置 |
|:-----|:-----|
| Projects 把 `getSessions()` 放进项目树，并传入活动 id 与副标题 | `navigatorProjectsList.ts:742-748` |
| 行图标用 `sessionRosterGlyph` | `navigatorProjectsList.ts:247` |
| 副标题、语气、图标来自会话列表字符串 | `navigatorProjectsList.ts:49` |
| Projects 按行上的 `sessionId` 删除，确认函数与 Sessions 相同 | `navigatorProjectsList.ts:645-657`；`conversationDeleteSessionConfirm.ts` |
| Sessions 视图 id | `conversationSessionsView.ts:46` |
| 行渲染 | `conversationSessionsView.ts:116` 起的 `SessionsRenderer` |
| Sessions 的删除取的是活动会话，不是列表焦点行 | `conversationSessionsView.ts:354` |
| 规格已写明栏、Sessions 标题、Projects 行共用一个确认函数 | [session-windows](../../docs/systems/conversation/session-windows.md) |

归属已按待定项 2 选 A：两处都留，抽共享行。不抽组件、不合并视图。下面两片补写于 2026-11-06，按符号对 HEAD 核过；行号以符号为准。

补写的核实证据（与上表互补）：

| 事实 | 位置 |
|:-----|:-----|
| 共享纯函数已有一半：`resolveSessionRosterTone`、`sessionRosterGlyph`、`formatSessionRosterSubtitle`、`formatSessionRosterAriaLabel` 都在同一文件，Projects 与 Sessions 都从这里引 | `conversationSessionsViewStrings.ts`；`navigatorProjectsList.ts` 的 import 与 `conversationSessionsView.ts` 的 import |
| Projects 行在渲染时按 `sessionId` 现算语气与待确认数，行的 `detail` 在建树时用 `formatSessionRosterSubtitle` 现算，两处各算一遍语气 | `ProjectNodeRenderer.renderElement` 与它的 `getSessionStatus` 回调；`NavigatorProjectsView.rebuildTree` 的 `sessionDetail` 闭包 |
| Projects 行内状态图标在渲染里手拼 glyph 与旋转类，待确认数直接写数字；行菜单 Open / Delete 的启用与理由在菜单构造里按 live 与 `getRowActionUnavailableReason()` 现算 | `ProjectNodeRenderer.renderElement`、`ProjectNodeRenderer.showContextMenu`、`NavigatorProjectsView.getRowActionUnavailableReason` |
| Sessions 行自己拼图标（`applySessionRosterIcon`），右端副标题不是全量副标题：待确认时只写数字，否则只在 idle 且有访问时间时写相对时间；无障碍标签走 `formatSessionRosterAriaLabel`，悬停是另一套行 | `SessionsRenderer.renderElement`、`SessionsRenderer.sessionHover`、`SessionsAccessibilityProvider.getAriaLabel` |
| Sessions 的行内 More 只开菜单，菜单里只有 Open beside 且恒启用；标题上的删除由 `CONVERSATION_SESSIONS_DELETE_ENABLED_KEY` 这个 context key 启用，拒绝理由走通知，不写在按钮上 | `SessionsRenderer.renderTemplate`、`ConversationSessionsView.updateDeleteEnabledContextKey`、`ConversationSessionsView.deleteActiveSession` 与 `rejectDeleteBeforeConfirm` |
| 写动作不可用的理由文案已经共用一处：`conversationSessionHoldReason(pairingHold, readiness)`，Projects 的不可用理由与 Sessions 的拒绝通知都从它取句 | `conversationSessionAvailability.ts` |
| `IAgentSessionViewLease.attribution` 仍是 `ReadonlyMap<string, unknown>`，文件头注释写明不类型化是为免依赖审阅 chip 类型 | `services/agentSession/common/agentSessionContext.ts` 的 `IAgentSessionViewLease` |
| 平台已有 `ItemAttribution`，且 roster 的 lease 同名字段已经是 `ReadonlyMap<string, ItemAttribution>`；生产实现只是透传内层 lease 的这个字段 | `platform/universeAgent/common/conversationViewFrame.ts` 的 `ItemAttribution` 与 `IConversationSessionViewLease`；`contrib/conversation/browser/agentSessionContext.ts` 的 `AgentSessionViewLease.attribution` |
| Sources 消费时把该字段断言回自己的子集，两处 `as ReadonlyMap<string, IReviewItemAttribution>`；子集字段 `role` / `agentId` / `agentPath` / `toolCallId` 与 `ItemAttribution` 同名同型 | `contrib/sources/browser/sourcesReviewAttributionService.ts` 的 `resolveRevealItemId` 调用与 `buildChipMapForEntries`；`contrib/sources/common/sourcesReviewAttribution.ts` 的 `IReviewItemAttribution` |

不变量（两条都保留的前提下）：

- Projects 删的是该行的会话。Sessions 标题上的删除删的是活动会话。抽共享行时不得把这两个目标合成一个。
- 确认文案仍走现有 `confirmDeleteConversationSession`。
- 高亮仍是 `getActiveSessionId()`，与叶获焦写回的那一个 id 相同。
- 两处今天看得见的行文案不变：Projects 的 `detail` 仍是全量副标题，Sessions 右端仍是今天那条紧凑副标题（待确认写数字、否则 idle 且有访问时间时写相对时间、其余为空并隐藏）。抽共享行是把两条文案的算法收到一处算，不是把 Sessions 的右端换成全量副标题。
- 行内按钮的启用不合成一份：Projects 菜单里的 Open / Delete 与新建仍按 Projects 的 live 判断启用，Sessions 的 More 与标题删除仍按今天的恒启用与 context key。共享的只是理由文案的来源（`conversationSessionHoldReason`），不新造第二套理由句，也不把 Sessions 标题删除的启用改成要求已连接。

### p3-3a 共享行

要动的符号与文件：

- `conversationSessionsViewStrings.ts` 新增一个纯函数与它的返回类型（实施时取名 `resolveSessionRosterRowChrome` 与 `SessionRosterRowChrome`）：入参是会话、`turns`、待确认数、是否活动会话；返回 `tone`、glyph、是否旋转、全量副标题、Sessions 用的紧凑副标题、待确认数、无障碍标签。内部只组合本文件已有的 `resolveSessionRosterTone`、`sessionRosterGlyph`、`formatSessionRosterSubtitle`、`formatSessionAccessedLabel`、`formatSessionRosterAriaLabel`，不新增 `nls` 文案。已有的这些导出不删，测试与两处调用方仍可直引。
- `conversationSessionsView.ts`：`SessionsRenderer.renderElement` 与 `SessionsAccessibilityProvider.getAriaLabel` 改读这个返回；`applySessionRosterIcon` 改为收 `tone` 与 glyph（或直接读返回），CSS 类后缀仍用本视图自己的类名。`sessionHover` 的语气与状态句改从同一返回取，它独有的工作目录、消息数、待确认句几行留在这里，不进共享行。
- `navigatorProjectsList.ts`：`ProjectNodeRenderer` 的 `getSessionStatus` 回调改返回共享行（构造点在 `NavigatorProjectsView.ensureTree`，在那里按 `sessionId` 取会话、轮次与待确认数后调共享函数；取不到会话时退回今天的 idle 且待确认为 0）；`renderElement` 的状态图标、旋转与待确认数改读共享行，状态元素的 CSS 类仍用 Navigator 自己的类名。`rebuildTree` 的 `sessionDetail` 闭包改取共享行的全量副标题，不再在闭包里再算一遍语气。
- 行内按钮：Projects 的 `getRowActionUnavailableReason` 与 Sessions 的 `rejectDeleteBeforeConfirm`、`sessionNotReadyNotice` 保持今天的取句路径（都走 `conversationSessionHoldReason`），本片只核对两处不再另写同义理由句；启用布尔各自保留（见不变量），不抽成共享函数。

改法：

1. 先在 `conversationSessionsViewStrings.ts` 落共享行函数，并给它在 `conversationSessionsViewStrings.test.ts` 里加纯函数用例（见本地验证）。这一步不改任何渲染，单独提交可回退。
2. Sessions 一侧改读共享行：渲染、图标、无障碍三处同改一个提交。紧凑副标题的公式原样搬进共享函数，`subtitle.hidden` 的判空不变。
3. Projects 一侧改读共享行：状态回调、`renderElement` 与 `sessionDetail` 同改一个提交。树节点的 `detail`、`active` 与 aria 拼法不变，`buildNavigatorProjectsTree` 不改签名。
4. 顺序排在 p3-4 的 import 下沉之后：p3-4 先把 Navigator 对 `conversation/browser` 的 import 收过一轮，本片再改这份 import 的绑定名，避免两片在同一 import 行上互相覆盖。本片新增的共享符号仍在 `conversationSessionsViewStrings.ts`，不为抽行新开文件。

明确不改什么：

- 不合并两个视图，不把 Projects 的会话行搬进 Sessions 的列表控件，也不反过来；分组（`groupSessionsForRoster`）、过滤、排序、行高与 CSS 类名各自保留。
- 不改 `getSessions()` 的数据源，不另存一份会话目录，不改删除确认文案与删除目标。
- 不改 Sessions 行内 More 的菜单内容（仍只有 Open beside），不给它加删除，不把标题删除搬进行内。
- 不改写闸与理由文案本身：`conversationSessionHoldReason`、`conversationSessionAvailability.ts` 与 `conversationDeleteSessionConfirm.ts` 不动。

本地验证：

- 新增纯函数用例（`conversationSessionsViewStrings.test.ts`，suite `ConversationSessionsView strings`）：等待语气压过运行与失败；待确认大于 0 时紧凑副标题是数字、全量副标题带待确认句；idle 且有访问时间时紧凑副标题是相对时间、运行或失败时紧凑副标题为空；活动会话的无障碍标签带活动标记。断言写期望字符串与语气值，不写通过条数。
- `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationSessionsViewStrings.test.ts`
- `scripts/test.sh --grep "NavigatorProjectsView"` 与 `scripts/test.sh --grep "ConversationSessionsView"`。锚点用这两个 suite 名；副标题没有单独的测试名，不要用「副标题」当 `--grep`。
- 改动文件 `npx eslint`：`conversationSessionsViewStrings.ts`、`conversationSessionsView.ts`、`navigatorProjectsList.ts` 及改过的测试。

风险与回退：最大的风险是把 Sessions 紧凑副标题误换成全量副标题、或把 Projects 行状态在建树与渲染两个时刻算出不同语气。纯函数用例先钉住两条文案公式；渲染时刻仍按渲染时的轮次与待确认数算，不把建树时的结果缓存进行。按步回退：第 3 步可单独 revert 回现算语气，第 2 步同理，第 1 步的纯函数无人调用时可留可删。

### p3-3b attribution 改用 `ItemAttribution`

问题类：`IAgentSessionViewLease.attribution` 用 `unknown` 兜底，真正消费它的 Sources 在两处把值断言回自己的子集；平台其实已有同形状的 `ItemAttribution`，roster 的 lease 也已经用它。

不变量：

- 只改类型，不改运行时的 map 内容、键与产生方。stub 与引擎两条 frame 来源产出的 attribution 原样透传。
- Sources 仍只读它需要的子集字段；`IReviewItemAttribution` 不删、不改字段，也不搬进 services。
- services 依赖 platform 的方向不变：`agentSessionContext.ts` 已经 type-only 引 platform 的 `SessionViewSnapshot`，这次同向加一条 type-only 引用，不引 workbench 或 contrib。

要动的符号与文件：

- `services/agentSession/common/agentSessionContext.ts`：`IAgentSessionViewLease.attribution` 改为 `ReadonlyMap<string, ItemAttribution>`，type-only 引 `platform/universeAgent/common/conversationViewFrame.ts` 的 `ItemAttribution`；文件头那句「values stay untyped so this service does not depend on review chip types」改成指向平台类型，不再说不类型化。
- `contrib/sources/browser/sourcesReviewAttributionService.ts`：删 `resolveRevealItemId` 调用处与 `buildChipMapForEntries` 里两处 `as ReadonlyMap<string, IReviewItemAttribution>` 断言，直接把 `lease.attribution` 传给收子集 map 的函数（`ItemAttribution` 与子集同名同型的字段保证这步是纯类型收窄，不是改值）。若编译器在这一步报错，先核对是不是别的值真的不是这个 map，不许用新的断言绕回去。
- `contrib/conversation/browser/agentSessionContext.ts` 不改方法体：`AgentSessionViewLease.attribution` 的返回类型随接口变，内层本来就是 `ReadonlyMap<string, ItemAttribution>`，透传一行不动。

改法：

1. 排在 p3-5 之后实施：p3-5 同改这份 `agentSessionContext.ts` 的可选方法签名，两片不并行改同一文件。先改 services 的类型与注释，再删 Sources 的两处断言，一个提交。
2. 在仓库里搜显式构造 `IAgentSessionViewLease` 的对象与 `as IAgentSessionContext` 的替身，核对它们的 `attribution` 值在新类型下仍成立。`new Map()` 这种空 map 不用改；写了具体条目的替身要让条目满足 `ItemAttribution`（`role` 必填），不许为了过编译把条目改成断言。

明确不改什么：

- 不改 `IReviewItemAttribution` 与 Sources 的 chip 逻辑，不把 chip 类型引进 services。
- 不改 lease 的 `snapshot` 形状、不新 RPC、不给快照加字段。
- 不动 Navigator 一侧：它读的是 roster lease 的同名字段，今天已经是 `ItemAttribution`，不在这片里。

本地验证：

- `npx eslint` 打 `agentSessionContext.ts`（两处同名文件）、`sourcesReviewAttributionService.ts`。
- `scripts/test.sh --grep "Sources - review attribution"` 与 `scripts/test.sh --run src/vs/workbench/contrib/conversation/browser/agentSessionContext.test.ts`（该文件在 browser 目录并列，`--run` 写它的实际路径）。
- 编译以类型错误为准：`flock` 排队跑 `npm run compile-client` 后，上面两份测试再跑；若只跑转译不查类型，这片等于没验。

风险与回退：风险只在类型层：某处替身其实塞了不满足 `ItemAttribution` 的值，改型后编译报错。处理是把那处替身的值改对或让它走空 map，不恢复 `unknown`、不加新断言。回退是把 `:18` 改回 `ReadonlyMap<string, unknown>` 并恢复两处断言，一个提交可退。

## p3-4 跨 contrib 依赖与 Stub 命名

问题类：Navigator 生产代码依赖 conversation 的 browser 模块；conversation 与 sources 双向依赖；roster 的生产接口写在 stub 文件里；Navigator 的容器注册还叫 Stub。

核实过的证据：

Navigator 生产代码（不含 test）从 `conversation/browser` 引出 18 条 import、23 个绑定名。其中 3 个绑定是类型：`SessionRosterTone` 是值 import 里的行内 `type`（`navigatorProjectsList.ts:49`），`ConversationStubSession`（`navigatorProjectsTree.ts:11`）与 `IConversationRosterService`（`navigatorSessionLeaseHolder.ts:8`）是整句 `import type`。值绑定 20 个。文件：`navigatorProjectsList.ts` 6 条、`navigatorAgentsView.ts` 4 条、`navigatorTeamList.ts` 3 条、`navigatorProjectsTree.ts` 1 条、`navigatorReveal.ts` 3 条、`navigatorSessionLeaseHolder.ts` 1 条。另外 `navigator/common/navigatorAgentHierarchy.ts` 从 `conversation/common` 引 `isEngineRootAgentId`，不在这 18 条里。

conversation 生产代码引 sources：`conversationReviewEntry.ts:19-20`、`conversationLensReadingColumn.ts`（`SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND`）、`conversationReviewNavService.ts`（`getWorkspaceFolderRoots`）。sources 生产代码引 `conversation/common`：核查点名的 `sourcesChangesList.ts:34`、`sourcesChangesReadModel.ts:16`、`sourcesChangeEntryOpen.ts:25` 都在；同方向还有 `conversationDiffReviewPane.ts`、`sourcesDiffPanelView.ts`、`sourcesReviewList.ts`。没有文件级的互相 import 环。依赖是双向的：conversation/browser 指向 sources，sources 指向 conversation/common。

| 事实 | 位置 |
|:-----|:-----|
| `IConversationRosterService` 接口 | `conversationStubService.ts:91` |
| decorator id `'conversationStubService'` | `conversationStubService.ts:44` |
| 同一文件还装着 stub 实现和夹具方法 | [stub-and-fixtures](../../docs/systems/conversation/stub-and-fixtures.md) |
| `registerNavigatorStubContainer` | `navigator.contribution.ts:54` |
| 视图 id 与样式文件名仍带 Stub | `navigatorStubView.ts`、`navigator.contribution.ts:6` 的 `navigatorStub.css` |

`local/code-layering` 不把同层 contrib 互引当成错误。要收的是 browser UI 被 Navigator 当公共库用，以及接口和 stub 实现写在一个文件里。

不变量：

- decorator id 字符串保持 `'conversationStubService'`。不注册第二个 roster token。
- 视图容器的 id、`storageId` 不改，避免已保存的侧栏布局对不上。
- `IAgentSessionContext` 仍是 Sources 读会话事实的门面，不把 `IConversationRosterService` 搬进 `services/agentSession`。

要动的符号与文件：`registerNavigatorStubContainer` 改名为容器注册（行为不变）；`navigatorStubView.ts`、`navigatorStub.css` 去掉 Stub 文件名，更新引用。import 下沉见改法。

改法：

1. **p3-4a。** Navigator 里已经有 common 对应物的符号改引 common。`getConversationSessionReadiness` / `isConversationSessionNotReady` 改从 `conversation/common/conversationSessionReadiness.ts` 引。`navigatorProjectsTree.ts` 已经是 `import type`，不用再改。这一片不搬 roster 接口。
2. **p3-4b。** 写闸原因句和配对保持仍在 browser，因为它们带 dock 文案和连接相位。若待定项之外还要 Navigator 完全不引 browser，把这两段里没有 DOM 的判断和 nls 字符串挪到 `conversation/common`，browser 再导出原名。默认不做，除非 4a 之后仍要把 browser import 清零。清零不是本条的完成条件。
3. **p3-4c。** 改名：函数、`navigatorStubView.ts`、`navigatorStub.css`。不改容器 id。
4. **p3-4d。** roster 接口与 decorator 从 `conversationStubService.ts` 挪到 `conversation/common` 的新文件，id 字符串照旧。`ConversationStubService` 类留在 browser。这一片的前提是接口引用的回合、队列、轨迹类型里，被接口签名用到的那部分已经在 common，或先移到 common 且不带 DOM。移不动的类型留在 browser，接口就继续留在 browser，4d 不做。不把接口拆成第二份「给 Navigator 的子集」而让实现漂移。

明确不改什么：

- 不改 decorator id，不删 `IConversationStubService` 别名。
- 不改 conversation 对 sources 的三条生产 import。审阅归因和打开路径的类型在 sources，conversation 继续引它们。
- 不改 sources 对 `conversationChatInput` / 就绪度探针的依赖方向。

本地验证：

- `npx eslint` 覆盖改过 import 的 Navigator 与 conversation 文件。
- `scripts/test.sh --grep "NavigatorProjectsView|navigatorReveal bound session|ConversationStubService"`。`Navigator projects row chrome` 是 CSS suite，不拿来当这条的选择器。
- 4d 若做了，再跑 `conversationStubService.test.ts` 与 `conversationEngineRosterService.test.ts` 的目录用例（`scripts/test.sh --grep` 用文件内已有的会话列表 / `switchSession` 标题）。

风险与回退：4d 会改大量 import 路径。做不动就停在 4a 和 4c，接口留在 stub 文件，在该文件头注明接口是生产契约、类是 stub 实现。回退按片 revert。

## p3-5 会话上下文上的可选方法

问题类：`IAgentSessionContext` 把就绪度和工作根做成可选方法，好让旧测试替身能编译；attribution 用 `unknown`，调用处再断言。

核实过的证据：

| 事实 | 位置 |
|:-----|:-----|
| type-only 引用 `SessionViewSnapshot` | `agentSessionContext.ts:8`。services 依赖 platform，方向符合分层 |
| 注释说明 attribution 不类型化，以免依赖审阅 chip | `agentSessionContext.ts:11-14` |
| `attribution: ReadonlyMap<string, unknown>` | `agentSessionContext.ts:18` |
| `getEngineSessionReadiness?` 注释写明只为测试替身 | `agentSessionContext.ts:33-37` |
| `getSessionWorkDir?`、`getWorkRoot?`、`getActiveWorkRoot?` 同样可选 | `agentSessionContext.ts:40-44` |
| 生产实现四个方法都有 | `contrib/conversation/browser/agentSessionContext.ts:108`、`:113`、`:124`、`:190` |
| 平台上已有 `ItemAttribution` | `platform/universeAgent/common/conversationViewFrame.ts:185` |
| Sources 自己的审阅子集 `IReviewItemAttribution`，lease 处断言过去 | `sourcesReviewAttribution.ts:16-21`；`sourcesReviewAttributionService.ts:161` |
| 身份条用可选调用读工作根 | `conversationIdentityStrip.ts:262-263` |
| `D1386 bound leaf does not borrow a window root when its root API is absent` 构造的对象没有 `getWorkRoot` | `conversationIdentityStrip.test.ts:1319-1327` |
| 部分测试把只含 `getActiveSessionId` 的对象断言成该接口 | 例如 `sourcesChangesList.test.ts` 里 `as IAgentSessionContext` |

不变量：

- 生产 `AgentSessionContext` 的方法体不改语义：就绪度仍走 `getConversationSessionReadiness(this.roster)`，工作根仍走 `resolveAgentWorkRoot`。
- 不新 RPC，不给快照加字段。
- `SessionViewSnapshot` 继续 type-only 从 platform 引入。
- 工作根三个方法保持可选。绑定叶在方法不存在时不借窗口根；未绑定叶仍可以显示工作区文件夹名。

要动的符号与文件：只把 `getEngineSessionReadiness` 改为必填。替身补上这个方法。没有连接信息时返回 `'ready'`，与 [stub-and-fixtures](../../docs/systems/conversation/stub-and-fixtures.md) 里「缺省视为就绪」一致。不要用 `'ready'` 去冒充「已连接但目录还在加载」的用例。

改法：

1. **p3-5a。** `getEngineSessionReadiness` 去掉 `?`。生产类已经实现，只改签名。`getSessionWorkDir`、`getWorkRoot`、`getActiveWorkRoot` 保持可选。核查方向里「四个方法都改必填」与已落地的身份条合同冲突，不采纳工作根这一半。
2. **p3-5b。** 缺 `getEngineSessionReadiness` 的替身补上这个方法。能用 `AgentSessionContext` 的测试可以改用它。`conversationIdentityStrip.test.ts:1320` 是显式 `const legacy: IAgentSessionContext`，去掉 `?` 后这里会编译失败，必须补上 `getEngineSessionReadiness`，同时继续不提供 `getSessionWorkDir`、`getWorkRoot`、`getActiveWorkRoot`，以保住 `D1386 bound leaf does not borrow a window root when its root API is absent`。`as IAgentSessionContext` 不去掉缺失方法，例如 `sourcesChangesList.test.ts:1189`，去掉 `?` 后仍然编译通过。

attribution 放哪见待定项 3，改法见 p3-3b。本片不改 `:18` 的类型。

明确不改什么：不改 `IReviewItemAttribution`，不把 sources 的 chip 类型引进 services，不改 lease 的 `snapshot` 形状，不改身份条的 `?.()`。

本地验证：在仓库里搜 `as IAgentSessionContext` 和显式标注的 `IAgentSessionContext` 对象，给缺 `getEngineSessionReadiness` 的替身补上。`sourcesChangesList.test.ts:1189` 这类断言编译失败覆盖不到。`npx eslint`，以及 `scripts/test.sh --grep "D1386 bound leaf does not borrow a window root"`。改过的 sources 替身用该文件里已有的 suite 名，而不是整份 `sourcesChangesList.test.ts` 的全部用例硬塞进一次 grep。显式标注缺方法会编译失败；`as` 断言要靠这次搜索补。

风险与回退：替身若在「已连接、目录未完成」的用例里返回 `'ready'`，会把未就绪打绿。回退是恢复 `?`。

## 待定项

2026-11-05 用户拍板，三项都按推荐：1 选 A，新建 `IConversationSessionChoiceService`；2 选 A，两份列表都留，抽共享行；3 选 A，改用 `ItemAttribution`。p3-2 按正文实施。2 和 3 的切片已补写为 p3-3a 与 p3-3b，先过规则 16 只读审查再实施，签收按「收窄」计。下面的选项留作记录。

### 1. 会话选择放在哪

- **A. 新的 `IConversationSessionChoiceService`（推荐）。** 选择和 epoch 是客户端串行状态，不是引擎目录，也不是 stub 夹具。roster 的两套实现不用各写一遍。与 ADR-003「catalog 不进 roster」一致。
- **B. 放进 `IConversationRosterService`。** 调用方少一个服务。stub 与引擎 roster 都要实现，接口继续变宽，测试双倍。

不变量和「两视图看到同一值」在 A、B 下相同。切片按 A 写；改选 B 时把同一组方法放到 roster 上。

### 2. 两份会话列表

- **A. 两处都留，抽出共享的行语气、图标、副标题和按钮启用理由（推荐）。** Projects 回答「这个工作根下有哪些会话」，Sessions 回答「全部会话」。删除目标保持现状：行删行上的 id，Sessions 标题删活动会话。
- **B. 只留 Sessions。** Projects 树不再列会话。侧栏里看会话要换视图。
- **C. 只留 Projects 树。** 去掉 Sessions 视图。今天 Sessions 的排序、过滤和「删活动会话」要改道或删掉。

已选 A。切片见 p3-3a，过规则 16 审查前不实施。

### 3. `IAgentSessionViewLease.attribution` 的值类型

- **A. 改成平台已有的 `ItemAttribution`（推荐）。** 类型在 `conversationViewFrame.ts`，services 依赖 platform 已经成立。Navigator 活动列表今天要的就是这个类型。Sources 仍可只读自己的子集字段，不必把 `IReviewItemAttribution` 放进 services。
- **B. 维持 `ReadonlyMap<string, unknown>`。** 边界最窄，调用处继续断言。
- **C. 在 `agentSessionContext.ts` 再定义一个只含 role / agentId / toolCallId 的类型。** 与 `ItemAttribution`、`IReviewItemAttribution` 并列第三份，不推荐。

已选 A。p3-5 不依赖这一项；`:18` 的改法见 p3-3b，随 p3-3 一起审查，排在 p3-5 之后实施，之前不改。

## 审查

2026-11-04 只读审查后改过本稿。Critical：不把 `ISessionScope` 登记在 `editorParts.ts:303`，那份子服务到不了编辑器页的透镜；p3-2 只搬存放处，不把 r11-3 尚未落地的代数写成现状。Important：eslint 允许名单留下仍含合法调用的文件；叶栏在 `focusLeaf` 不会跑的 reveal 返回上，活动 id 还不是目标时仍 `switchSession(参数)`，已经是目标 id 时不再调（2026-11-05 收窄，见「审查处理」）；共享 epoch 不用后打开视图的下标当 rollback；工作根方法保持可选，以保住 `D1386 bound leaf does not borrow a window root when its root API is absent`；Navigator 的值绑定按 20 个计，`navigatorProjectsTree.ts` 已是 `import type`。

## 审查处理

2026-11-05 对照活码处理上一轮意见。`status` 仍是 `draft`。上一节是 2026-11-04 的记录；叶栏写回以本节和 p3-1 正文为准。

### 维持（Strengths，核验成立）

- 生产计数维持：`getActiveSessionId(` 79 / 24，`getBoundSessionId(` 110 / 12，单词 `boundSessionId` 25 / 5。
- 透镜与栏的行号维持：构造 `:343`，空字段回退 `:449-450`，`listSessionId` `:458-462`，栏上三处 `??` 在 `:407`、`:426`、`:705`，叶栏 `:163-165`。
- 窗口服务 7 处活动 id 与 `focusin` / `setFocusedLeaf` 双写维持。引擎 `switchSession` 在会话不在目录里时不改活动 id，维持。
- 「不要把 `ISessionScope` 登记在 `editorParts.ts:303-309`」维持。透镜仍从组的 `paneInstantiationService` 创建。
- 权限 epoch 仍按 host 的 `WeakMap`；rollback 仍在 `inFlight` 之前；过期可写成功仍 `continue`。与 r11-3 分开，不新 RPC，不加 `modelId`。维持。
- Navigator 18 条 import、值绑定 20、类型绑定 3。decorator id 仍是 `'conversationStubService'`。维持。类型绑定的写法见 Minor。
- p3-3 在待定项 2 之前不抽组件；p3-5 不改工作根可选。切片按共享文件排序。维持。

### Critical

- **采纳。** `conversationEditorPart.ts:45-61` 已把构造参数 `sessionKey` 写进 `super()`。不可用的是 `this.sessionKey`。已删「`sessionKey` 在 `super()` 期间还不可用」，不再把「构造期拿不到会话 id」写成不改 `EditorPart` 的理由。留下的理由是 `scopedInstantiationService` 为 `readonly`，以及 `:303-309` 的晚注入到不了透镜。

### Important

- **采纳。** 叶栏保持 `:176-178` 的比较。无 grid / 叶不可见的 `cancelled: false` 仍在活动 id 不同时 `switchSession(参数)`。已经是目标 id 时不再调用，避免 `conversationEngineRosterService.ts:421-424` 在 id 相同时仍刷新 agent tree 并持久化。与「获焦只写一次」对齐。验证加上「已是目标 id 则零调用」。
- **采纳。** History / Inbox / Snapshots 的未注入回退不改。生产都传入 `() => host.listSessionId()`；未绑定透镜的 `listSessionId` 仍读活动 id。`test/browser/conversationEngineHistoryList.test.ts:526` 不传回调，走活动 id。空 id 只在回调已注入且返回空时出现。验证写上 `ConversationEngineHistoryList`、`ConversationEngineSnapshotsList`、`ConversationInboxOverlay`，并写明生产行为不变。
- **采纳。** 允许名单仍整文件放过 `conversationLens.ts`。1a 增加调用计数：字段已设置时 `getBoundSessionId`、`listSessionId`、`getSessionBarSelectId` 对 `getActiveSessionId` 的次数为 0。两叶 id 仍是 A 只锁返回值。
- **采纳。** 清 map 的条件改成前后 `linkId` 不同。相位、pairing、agent tree 失败发的是同一 `onDidChangeConnection`，`linkId` 可以不变。验证增加「同一 `linkId` 不清、`linkId` 变化才清」。
- **采纳。** 切片顺序与改法写明 2a 与 2b 同一次合入。两份透镜接上服务之前，只持有 map 的 2a 不单独合入。
- **采纳。** `conversationIdentityStrip.test.ts:1320` 的显式标注必须补 `getEngineSessionReadiness`，并继续不提供工作根方法。验证改为搜索 `as IAgentSessionContext`（`sourcesChangesList.test.ts:1189` 去掉 `?` 仍编译）和显式标注。D1386 的 `--grep` 保留，不再把它当成漏补清单。

### Minor

- **采纳。** 四个方法的行号改为 `:108`、`:113`、`:124`、`:190`。`:107` 是空行。
- **采纳。** `SessionRosterTone` 改为值 import 里的行内 `type`。整句 `import type` 只留给 `ConversationStubSession` 与 `IConversationRosterService`。18 / 20 / 3 的计数不变。
- **采纳。** 规则注册按 `.eslint-plugin-local/index.ts:14-17` 写成每个 `*.ts`，只排除 `index.ts` 与 `utils.ts`。files 覆盖 `contrib/conversation/browser` 时排除 `*.test.ts`。
- **采纳。** p3-2 的选择器改为 `scripts/test.sh --run` 指向 `conversationLensDisposeGate.test.ts`；`--grep` 用该文件的完整用例名。短词 `leftover model` 会命中 engine overview 与 provider。`scripts/run-unit-custom.sh` 跑三域门禁、不接收单文件，所以不把它写成这个选择器。
- **采纳。** 待定项 4 删去。非活动叶的 live tree 已在 p3-1 不变量和「明确不改什么」里写成默认不做。待定项 1–3 仍留给用户。
- **采纳。** `editorGroupView.ts:220` 写成组的 `scopedInstantiationService`，编辑器页创建写在 `:237`，透镜仍落到 `conversationEditorPane.ts:152`。

没有不采纳的意见。

同轮复审又改了三处，都对照活码采纳：`:108` 不再把「返回空」写成未注入夹具的行为，`:526` 是未注入、走活动 id；1c 的合入前提从「没有 1b」改为「没有 1a」，三处 `??` 在 1a 删；`drainSessionPermission` 与 `drainSessionModel` 分开写行号，权限过期可写会先记 `confirmedIndex`（`:1256-1259`），模型 `:1340` 的 `continue` 不写 confirmed。
