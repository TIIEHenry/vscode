---
title: "十六路审查 2026-11-07 r09：conversation 引擎、连接与会话名册方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 2、weaken 0、drop 0。r09-1 让新建会话在名册已按时间分组时带上本机建好的时刻、落进 Today，前提是新会话补 workDir 与名册测试 mock 的未提交改动先提交；r09-2 让快照删除结果按发送时的列表代次判定，并写明确认期间浮层被关掉时照发、不画、下次打开重列。2026-11-07 规则 16 审查须改稿，已改；同日已实施（未编译、未跑测试），代码审查可接受。"
---

# 十六路审查 2026-11-07 r09：conversation 引擎、连接与会话名册方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：PRD-002（验收 5）。r09-1 对应这一条：验收 5 要求会话列表组内按最近访问时间从新到旧，刚建好的会话在引擎上已有访问时间，只是客户端没记下。r09-2 不对应产品需求：PRD-002.4 与 PRD-007.2 只规定无能力时省略 Snapshots，快照删除后的结果提示与重列由系统文档 `docs/systems/conversation/lens-and-trajectory.md` 第 107 行约定，需求条目里没有这项验收。

只改 r09-1 与 r09-2 两条。范围停在 `src/vs/workbench/contrib/conversation/browser/` 的 `conversationEngineRosterService.ts`、`conversationStubModel.ts`（只改注释）、`conversationEngineSnapshotsList.ts`，`test/browser/` 下对应的两个测试文件，以及 `docs/systems/conversation/commands.md` 第 63 行所在段；不改协议、主进程、引擎仓，也不改 S2 在快照浮层 `show()` 里加的点外关闭监听。

核查基线是 HEAD `841ea38816d` 加上工作区未提交改动；2026-11-07 改稿时按符号复核过一遍，HEAD 没变。与本稿相关的未提交改动有三批：`new-session-workdir-hydration.md` 的实现与测试（`adoptEngineSession` 改为返回记录、`hydrateNewSessionWorkDir`、名册测试 mock 的 `getSessionInfo`）；`interaction-review-2026-11-06.md` 第 3、9 条与 SessionBar More 同序的实现（会话列表只在活动会话变化时滚动、删除落点 `nextShownId` 与 `orderSessionsForRoster`、名册测试 mock 的 `setListSessions` 收 `lastAccessedAt`）；S2，即 `ui-interaction-visual-review-2026-11-07.md` §3.2 的实现（快照浮层的 `aria-controls`、`setOnUserWillOpen`、点外关闭、重绘保焦）。`conversationEngineSnapshotsList.ts` 仍在被 S2 修改，文中行号是改稿时工作区的行号，实施时以符号为准。本路只读核对，没有编译，也没有跑测试。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r09-1 | hold | 中 | 见下文 |
| r09-2 | hold | 低 | 见下文 |

### r09-1

核查：`adoptEngineSession`（`conversationEngineRosterService.ts` 1040–1054 行；HEAD 在 1039 行起，直接把新对象拼进 `engineSessions`，行为相同）新建的记录只有 id、标题、空回合与来源。名册里从 `listSessions` 写入访问时间的只有 `doRefreshEngineCatalog`（2182、2190 行），其余出现处都是拷贝已有值。目录刷新只由 `setEngineConnected`（265 行）和 `onUaConnectionChanged`（1877 行）发起；主进程 `createSession`（`universeAgentConnectionService.ts` 1393–1411 行）不调用 `_fireSnapshotChanged`，渲染端 `UniverseAgentConnectionChannelClient` 只转发主进程的快照事件。仓外钉死引擎 `vscode-debug-engine/universe-agent` 建会话时就写访问时间（`SessionManager.kt` 352–353 行，毫秒）；`SessionGrpcService.kt` 的 `list` 有 `shelveOps` 时走 `toProtoSummary`（981 行写 `setLastAccessedAt(lastActiveAt)`，运行中会话的 `lastActiveAt` 取 `entry.lastAccessedAt`，966 行），没有时走 `buildLegacyRuntimeList`（939 行），`info` 在 275 行写同一个值。所以默认配置下名册一定按时间分组，新行一定进 Earlier 末尾。新行成为活动会话后，会话列表会滚到它：HEAD 的 `updateActiveSession`（`conversationSessionsView.ts` HEAD 614–630 行）每次刷新都 `reveal` 活动行；`interaction-review-2026-11-06.md` 第 3 条的未提交改动改成只在活动会话变化时 `reveal`（工作区 734–736 行）。SessionBar 窄宽 More 菜单在 HEAD 按目录顺序列出（HEAD 308 行），新行同样排最后；同一批未提交改动改成按 `orderSessionsForRoster` 排（工作区 378 行）。PRD-002.5 要求组内按最近访问时间从新到旧，新会话在引擎上已有访问时间；验收里「没有访问时间的会话排在 Earlier 末尾」与 `commands.md` 第 63 行说的是真正缺时间的行，本条不改这条规则。`new-session-workdir-hydration.md` 实施边界第 3 条「有效返回只补该记录 workDir」是那份方案的范围限定；测试 `new bind hydrates only its original record workDir: <outcome>` 给的 Info 结果一律是 `lastAccessedAt: 0`，没有断言新行不带时间。旧审查稿、`dev/progress/deferred-gaps.md`、`archive/` 与 `dev/archive/` 里没有同一缺陷。

实施前提：

- `new-session-workdir-hydration.md` 那批未提交改动先提交。本条要改的建记录语句（1043 行 `record = { id: sessionId, title, turns: [], source: 'engine-cache' };`）就是那批改动新写的，那批没提交时无法只暂存本条的 hunk；下面第五条不变量和 `new bind hydrates only its original record workDir: <outcome>` 也只在那批改动里。
- 名册测试 mock 的 `setListSessions` 收 `lastAccessedAt`、`listSessions` 回传该字段（`conversationEngineRosterService.test.ts` 的 `MockUniverseAgentConnection`）先提交。这段在 `interaction-review-2026-11-06.md` 那批未提交改动里；HEAD 的 mock 不回传访问时间。本条的用例要用它，但不把它暂存进本条提交。
- 本条不依赖 `orderSessionsForRoster`、删除落点与会话列表滚动的未提交改动，断言只用 HEAD 已有的 `groupSessionsForRoster`。那批改动先提交的话，删除落点和 SessionBar More 菜单也会随本条把新行排进 Today。

问题类：引擎目录带访问时间时，本窗口刚建好的会话写进名册却不带访问时间，于是被分进 Earlier、排到列表最后，列表滚到底部选中它，直到下一次重新拉目录才回到 Today。

不变量：

- 绑定成功后由 `adoptEngineSession` 新建的记录，只要名册在插入前已有至少一行带正的有限 `lastAccessedAt`，就在放进 `engineSessions`、触发第一次 `onDidChangeSession` 之前带上正的 `lastAccessedAt`，`groupSessionsForRoster` 把它分进 Today。
- 插入前名册里没有任何带时间的行时，新记录不带 `lastAccessedAt`，列表仍按 PRD-002 验收 5 的「全无时间不分组」保持平铺。
- `adoptEngineSession` 找到同 id 的已有记录时，不改它的 `lastAccessedAt`。
- 下一次 `doRefreshEngineCatalog` 仍整表采用 `listSessions` 的值：本地写入的时刻被引擎值替换，引擎没给值时这一行回到不带时间。
- 新行的 `workDir` 补全仍只由 `hydrateNewSessionWorkDir` 负责，它的写入集合、守卫与事件不变。

要动的符号：`ConversationEngineRosterService.adoptEngineSession` 中新建记录的分支；`ConversationStubSession.lastAccessedAt` 的字段注释（`conversationStubModel.ts` 104 行）。文件：`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts`、`src/vs/workbench/contrib/conversation/browser/conversationStubModel.ts`、`src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts`、`docs/systems/conversation/commands.md`。

改法：

1. 在 `adoptEngineSession` 里，没找到同 id 记录、准备新建时，先看当前 `engineSessions` 是否有一行的 `lastAccessedAt` 是正的有限数，判法与 `doRefreshEngineCatalog` 2182 行相同。有，则新记录带 `lastAccessedAt: Date.now()`；这是毫秒值，`sessionAccessedAtMs`（`conversationSessionsViewStrings.ts` 127–132 行）把不小于 `1e12` 的值按毫秒读。没有，则照旧不带这个字段。
2. 这个字段必须在记录放进 `engineSessions`、调用 `_onDidChangeSession.fire(sessionId)` 之前写好。这样会话列表和 SessionBar 第一次读 `getSessions()` 时新行已经在 Today；随后 `activateEngineSession` 引起的选中与滚动落在 Today 那一行，不会先滚到底部再跳回顶部。
3. 找到已有记录的分支保持原样，不补也不改时间。
4. 持久化沿用 `adoptEngineSession` 里已有的 `persistEngineAwareRoster()`，不另加调用；持久化的拷贝路径已经带上 `lastAccessedAt`。
5. `doRefreshEngineCatalog` 不加合并逻辑，下一次拉目录时整表替换，以引擎值为准。
6. 不取 `getSessionInfo` 结果里的 `lastAccessedAt` 或 `createdAt`。`getSessionInfo` 是可选接口，缺了就补不上；它的结果晚于新行第一次画出，新行会先出现在列表底部再跳到顶部，而 `interaction-review-2026-11-06.md` 第 3 条的改动提交后，数据刷新不再滚动，跳到顶部的选中行可能留在视口外；它的守卫还和 `workDir` 绑在一起。
7. 本机时钟与引擎时钟的偏差只影响过渡期。引擎时钟比本机快时，新行可能排在 Today 里几条刚在引擎上访问过的行之后；偏差跨过本机零点时，新行可能落进 Yesterday。下一次拉目录换成引擎值后按引擎时钟排。不取「已有最大时间再加一」这类值，免得写出晚于本机时钟的时间，让副标题显示成将来。
8. 改 `ConversationStubSession.lastAccessedAt` 的注释：值来自 `SessionSummary.last_accessed_at`；本窗口刚建、还没重新拉目录的引擎会话，在名册已有带时间的行时暂用本机建好的时刻。同样的意思补进 `commands.md` 第 63 行所在段。

明确不改什么：

- `groupSessionsForRoster`、`sortRosterBucket` 与 PRD-002 验收 5 的分组排序规则不变；`orderSessionsForRoster` 提交后也不改。保持 `ConversationSessionsView strings` 里的 `roster groups by access time and stays flat when no session has one`、`roster groups sort newer access first and keep undated input order`，以及 `ConversationSessionsView` 里的 `date groups have 42px headers, 30px rows and the last session remains reachable`。
- `hydrateNewSessionWorkDir` 不改。保持 `new bind hydrates only its original record workDir: <outcome>` 的全部 16 个结果。
- 新建后不调用 `refreshEngineCatalog`：它会清绑定与待处理选择，见 `new-session-workdir-hydration.md` 实施边界第 4 条。保持源码扫描守卫 `engine roster fire-and-forget voids double-catch onUnexpectedError`（测试文件 6191–6207 行）：`refreshEngineCatalog` 的双 catch 调用仍恰好两处，`monitorPendingEngineSessionBind` 的调用写法不变。
- 切换会话或发送消息时不在本地改已有行的访问时间，已有行仍等下一次拉目录。
- 名册里没有任何带时间的行时（引擎不报时间，或本连接里的行都是刚建、还没重新拉过目录），新行不带时间，列表保持平铺；平铺时新行排在末尾的现状不在本条。
- 会话列表的滚动规则不变。`interaction-review-2026-11-06.md` 那批提交后，保持 `ConversationSessionsView` 里的 `switching the active session still moves selection and focus to it`。
- 本地 stub 名册（未接通引擎）的会话不带时间，不改。
- 新行副标题会和其它带时间的行一样显示相对时间（会话列表、Projects 与 SessionBar），这是预期结果，不另改文案。
- 保持 `connected createSession catalogs New session only after host Create/Resume, not acquireLease`、`connected empty list defers Create to host lease and adopts clientSessionId on bind` 与 `persisted engine cache keeps session workDir across list refresh and roster restart`；前两条的列表不带时间，新记录仍不带时间。`interaction-review-2026-11-06.md` 那批提交后，再保持 `deleting the active session lands on the next row the Sessions list shows`。

本地验证：

- 新增用例都放在 `src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts` 的 suite `ConversationEngineRosterService (M6-A2)`，照 `connected createSession catalogs New session only after host Create/Resume, not acquireLease` 的写法，`createSession()` 后由 `whenEngineSessionReady` 放行新会话；分组断言只用 HEAD 已有的 `groupSessionsForRoster`。
  - 名册已有带时间的行：`setListSessions` 给两行带 `lastAccessedAt`（一行三天前，一行一分钟前）。断言新 id 第一次触发 `onDidChangeSession` 时读到的记录已带 `lastAccessedAt`，取值落在放行前后两次 `Date.now()` 之间；`groupSessionsForRoster(service.getSessions())` 第一项是 `today` 分组头，第二项是新 id。
  - 名册没有带时间的行：各行都不带 `lastAccessedAt`。断言新记录也不带，`groupSessionsForRoster` 的结果里没有分组头。
  - 同 id 记录已存在：放行之前，经 `as unknown as` 往 `engineSessions` 放一条与待绑定 id 相同、带已知 `lastAccessedAt` 的记录，写法参照 `new bind hydrates only its original record workDir: switch` 往 `engineSessions` 加行。断言放行后这条记录的 `lastAccessedAt` 不变，名册里该 id 只有一条。
  - 下次拉目录给了引擎值：接第一条用例，`setListSessions` 为新 id 给另一个 `lastAccessedAt`，经 `as unknown as` 调 `refreshEngineCatalog` 再 `awaitEngineCatalogRefresh`，写法参照 `persisted engine cache keeps session workDir across list refresh and roster restart`。断言记录的 `lastAccessedAt` 等于引擎值。
  - 下次拉目录没给值：同上，但新 id 不带 `lastAccessedAt`，其余行仍带。断言记录不带 `lastAccessedAt`，`groupSessionsForRoster` 把它排在 Earlier 末尾。
- 运行顺序：
  1. `npm run compile-client`。`scripts/test.sh` 加载的是 `out/` 下的编译产物，不先编译就测不到改动；按 `dev/progress/health-gates.md`，局部 TypeScript 改动可以用它代替全量 `npm run compile`。
  2. `scripts/test.sh --run` 依次跑 `src/vs/workbench/contrib/conversation/test/browser/` 下的 `conversationEngineRosterService.test.ts`、`conversationSessionsViewStrings.test.ts`、`conversationSessionsView.test.ts`，或跑 `scripts/run-unit-custom.sh`。
  3. `npx eslint` 检查改动的 `conversationEngineRosterService.ts`、`conversationStubModel.ts` 与 `conversationEngineRosterService.test.ts`，或跑 `npm run eslint`。
  4. 改了 `commands.md`，再跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。

### r09-2

核查：稿中情形在当前工作区仍成立，行号随 S2 的未提交改动漂移，现为：`refresh` 在 453 行递增代次，连接事件刷新在 270–277 行，`snapshotWriteOrigin` 532–540 行，`snapshotWriteTargetStill` 543–548 行，`snapshotWriteResultCurrent` 551–556 行，`deleteSnapshot` 的确认框在 623–628 行、确认后的检查在 629–641 行、发送在 642 行，`deleteThenRefreshList` 的结果判定在 669 行。`UniverseAgentConnectionSnapshot.linkId` 的注释写明只改相位时不换 id（`universeAgentTypes.ts` 1680–1684 行）。主进程在同一链接上会因传输恢复（`_withTransport` 把 `transportState` 置回 `ok`、相位回到 `connected`，2604–2617 行）、`agentTreeFetchFailed` 翻转或代理树能力降级发快照事件；这些恰在确认框打开的几秒内出现属于少见情形，所以严重度维持低。浮层在默认编辑器窗口的 SessionBar 上，属于产品范围。类注释（116–124 行）只把身份、链接、会话定为确认后的发送闸，结果闸另比「更新的 renderGeneration」，没有讨论确认期间的刷新；`docs/systems/conversation/lens-and-trajectory.md` 第 107 行写明行 Delete 确认成功后浮层保持打开并再拉 `listSnapshots`，本条情形与之相悖。现有测试 `restore return does not paint success or refresh when renderGeneration moved` 锁的是写请求在途期间的刷新，不是确认期间；没有测试覆盖确认期间的刷新。`deferred-gaps.md` 的 D54、D179、D486、D511 与提交 `578fa94e73a` 都不涉及这一情形；`interaction-review-2026-11-06.md` 的待拍板 D3 只讨论确认框的形式。

确认期间浮层被关掉的情形：S2 在 `show()` 里加了 document 级 `mousedown` 点外关闭（346–361 行），只排除 `.monaco-dialog-box` 与 `.context-view`。自定义对话框的遮罩 `.monaco-dialog-modal-block` 是对话框盒子的祖先，不在排除范围内（`dialog.ts` 138–146 行），在遮罩上按下会关掉浮层；随后若点确认，`deleteSnapshot` 只核身份、链接、会话与写闸，删除照发，结果因浮层已关不画、不刷新。默认编辑器窗口的 `window.dialogStyle` 默认是 `native`（`desktop.contribution.ts` 291–297 行），只有设成 `custom` 或冒烟驱动时才用自定义对话框（`dialog.contribution.ts` 114–118 行）；原生模态框打开时窗口收不到鼠标事件，所以默认配置下走不到这条路径。另一条在 HEAD 就有的路径是绑定会话在确认期间被切走，浮层由 `onDidChangeActiveSession` 的监听关掉（278–287 行），删除同样照发。自定义对话框打开时按 Escape 不会走到发送：对话框在 window 捕获阶段先记下 Escape 按下（`dialog.ts` 401–410 行），浮层的 document 捕获监听随后关掉浮层（262–269 行），松开时对话框按取消关闭（551–561 行），确认结果是未确认。

实施前提与协调：

- `conversationEngineSnapshotsList.ts` 与 `test/browser/conversationEngineSnapshotsList.test.ts` 里有 S2 和测试迁移的未提交改动，优先等它们提交。并行实施时只用 `git add -p` 暂存本条的 hunk（`deleteSnapshot` 的发送 origin、类注释、本条新增用例），不暂存 `show()`、`close()`、`setOnUserWillOpen`、`paintSnapshots` 保焦、文件尾部 `ConversationEngineSnapshotsList (browser dispose gate)` 套件等别人的 hunk。新增用例放在 `delete confirm still sends when the published identity, link, and session stay` 附近，避开别人的 hunk。
- 遮罩不在排除名单这一点交给 S2 的实施方：S2 方案 §3.2 第 1 步写的是忽略「模态确认对话框内的点击」，遮罩属于自定义对话框，现行选择器没有覆盖。补不补进排除名单由 S2 决定，本方案不改 `show()` 的监听。S2 收口时仍没处理的，由实施本条的一方按登记表规则在 `dev/progress/deferred-gaps.md` 登记，本稿不预占编号。

问题类：快照删除在确认框期间遇到一次同链接的列表刷新时，删除照常发出，结果却按点击时的列表代次判为过期，浮层既不写结果也不重列，已删的快照留在列表上，它的 Restore 与 Delete 仍可点。

不变量：

- 删除结果的判定基准 `SnapshotWriteOrigin.generation` 等于发送那一刻的 `renderGeneration`，也就是确认返回、发送前检查全部通过、调用 `deleteThenRefreshList` 之前那一刻的值。
- 确认后的发送闸不变：只看点击时记下的引擎身份、链接、会话是否仍相同（`snapshotWriteTargetStill`），以及 `canSendDelete`、hook 与会话 id。确认期间只发生列表刷新时，删除照常发出。
- 确认期间浮层被关掉时（自定义对话框遮罩上按下、绑定会话切走），确认过的删除仍按发送闸发出；结果不画、不刷新；下次打开浮层时重新列出，列表以引擎为准。
- 删除请求发出之后，代次再变化、浮层关闭，或身份、链接、会话变化，结果仍不画、不刷新。
- 确认期间刷新过、随后删除成功时，写 `Deleted.`，再拉一次 `listSnapshots`，新列表不再含该快照；这次再拉失败时不留 `Deleted.`。
- 确认期间刷新过、随后删除失败或抛错时，写现有的 `Unable to delete: …`，不刷新。

要动的符号：`ConversationEngineSnapshotsList.deleteSnapshot` 中传给 `deleteThenRefreshList` 的 origin；类注释里讲 Restore 与 Delete 代次的那几句（119–123 行）。`SnapshotWriteOrigin` 的形状、`snapshotWriteOrigin`、`snapshotWriteTargetStill`、`snapshotWriteResultCurrent`、`deleteThenRefreshList`、`restoreSnapshot` 与 `show()` 里的点外关闭监听都不改。文件：`src/vs/workbench/contrib/conversation/browser/conversationEngineSnapshotsList.ts`、`src/vs/workbench/contrib/conversation/test/browser/conversationEngineSnapshotsList.test.ts`。

改法：

1. `deleteSnapshot` 仍在弹确认框之前用 `snapshotWriteOrigin()` 记下点击时的身份、链接、会话，供确认后的 `snapshotWriteTargetStill` 使用。
2. 确认返回后的检查与顺序不变：已 dispose、未确认、`snapshotWriteTargetStill(origin)` 不成立、`canSendDelete` 或 hook 或会话 id 不满足，任一出现就返回，不发送。
3. 全部通过之后、调用 `deleteThenRefreshList` 之前，组一个发送 origin：身份、链接、会话沿用点击时的 origin（上一步刚核过相同），`generation` 取此刻的 `this.renderGeneration`，把它传给 `deleteThenRefreshList`。取值与调用之间不得有 await；`deleteThenRefreshList` 在第一个 await 之前同步发出 `remove.call`，所以这个代次就是发送时的列表基准。
4. 确认期间的刷新在发送时还没返回，发送 origin 取的就是这次刷新的代次。刷新先返回，会先画出列表，删除结果随后按同一代次判为当前，写 `Deleted.` 并重列；删除先返回，会写 `Deleted.` 并发起新一次刷新，旧刷新被它自己的代次检查丢弃。两种顺序最后都画出新列表。
5. 不在发送闸里加「浮层是否打开」的判断。用户已经在确认框里点了删除；浮层被关是遮罩按下或会话切走的副作用，不是撤回删除。浮层已关时，发送 origin 取到的是关闭之后的代次，`snapshotWriteResultCurrent` 因 `open` 为假返回，结果不画、不刷新。代价是这次结果（包括失败）不提示，用户下次打开浮层时从列表看到实际状态。
6. 改类注释：Delete 结果所用的列表代次在确认之后、发送时取；确认期间浮层被关掉时删除照发、结果不画；Restore 没有确认，点击即发送，仍用点击时的代次。
7. 不采用 Triggers 那种「代次变了就不发送并写未发送文案」的做法：快照浮层的发送闸已由类注释和测试 `delete confirm still sends when the published identity, link, and session stay` 定为身份、链接、会话；本条只修结果基准，不改发送闸。

明确不改什么：

- 确认期间身份、链接或会话变了就不发送。保持 `delete confirm does not send when the session or published link changed` 与 `delete confirm still sends when the published identity, link, and session stay`。
- 写请求在途期间的过期判定不变。保持 `restore return does not paint success or refresh when renderGeneration moved`、`restore return after the overlay closes does not paint success or refresh`、`delete return does not paint success or refresh when the link or session changed`。
- 取消、失败、抛错都不刷新。保持 `cancelled delete confirm does not send or refresh`、`failed delete does not refresh list`、`delete throw does not refresh list`。
- 成功后先写成功文案再重列，重列失败不留成功文案。保持 `successful delete refreshes via listSnapshots and keeps overlay open`、`delete success does not keep delete-success when subsequent listSnapshots fails`。
- Restore 路径不变。
- 确认期间的刷新已经把这条快照列没了（例如在别处被删）时，删除仍按现行发送闸发出，引擎回失败就写 `Unable to delete: …`；不新增「行还在才发送」的判断。
- S2 在 `show()` 里加的点外关闭监听和它的排除名单不改；浮层关闭期间的删除结果不另用通知提示。
- 确认框仍用 `IDialogService.confirm`。`interaction-review-2026-11-06.md` 的待拍板 D3 若改为锚定弹层，同一规则作用于弹层返回之后，仍在发送时取代次。

本地验证：

- 新增用例都放在 `src/vs/workbench/contrib/conversation/test/browser/conversationEngineSnapshotsList.test.ts` 的 suite `ConversationEngineSnapshotsList`、`delete confirm still sends when the published identity, link, and session stay` 附近，写法参照 `restore return does not paint success or refresh when renderGeneration moved`：连接桩带 `onDidChangeConnection` 发射器，`getConnectionSnapshot` 固定返回 `publishedSnapshot('eng-start', 4)`，`mountList` 传 `confirmResult: true`。
  - 确认期间刷新后删除成功：`onConfirm` 里发一次同一链接的快照；`listSnapshots` 前两次返回 `snap-1`，第三次返回 `snap-2`；`deleteSnapshot` 返回 `{ ok: true }`。断言 `deleteSnapshot` 只调用一次，参数是 `sess-1` 与 `snap-1`；`listSnapshots` 共三次；`snap-1` 行不存在，`snap-2` 行存在；写状态行是 `Deleted.`。改动前这条失败：只有两次列表，`snap-1` 仍在，写状态行为空。
  - 确认期间刷新后删除失败：同上，`deleteSnapshot` 返回 `{ ok: false, message: 'gone' }`。断言写状态行含 `Unable to delete: gone`，`listSnapshots` 只有两次。
  - 确认期间刷新后删除成功、随后的重列抛错：第三次 `listSnapshots` 抛错。断言写状态行不是 `Deleted.`，浮层正文出现 `Failed to read engine snapshots — …`，`listSnapshots` 共三次。改动前这条也失败（只有两次列表）。
  - 删除在途期间代次变化：确认期间不发事件，`deleteSnapshot` 挂起，挂起期间发一次同链接快照，再以 `{ ok: true }` 结束。断言写状态行不是 `Deleted.`，`listSnapshots` 只有两次（打开一次、在途期间的刷新一次）。改动前后都应通过，用来防止把基准挪到结果返回之时。
  - 删除在途期间浮层关闭：`deleteSnapshot` 挂起，挂起期间调用 `list.close({ restoreFocus: false })`，再以 `{ ok: true }` 结束。断言 `listSnapshots` 只有一次，`isOpen()` 为假，写状态行不是 `Deleted.`。改动前后都应通过。
  - 确认期间浮层被关掉：`onConfirm` 里调用 `list.close({ restoreFocus: false })`，模拟遮罩按下或会话切走，不依赖 S2 的排除名单。断言 `deleteSnapshot` 调用一次，`listSnapshots` 只有一次，`isOpen()` 为假，写状态行不是 `Deleted.`；随后 `list.show()`，第二次 `listSnapshots` 返回 `snap-2`，`snap-1` 行不存在。改动前后都应通过，用来锁住照发、不画、下次打开重列。
- 运行顺序：
  1. `npm run compile-client`。`scripts/test.sh` 加载的是 `out/` 下的编译产物，不先编译就测不到改动；局部 TypeScript 改动按 `dev/progress/health-gates.md` 可以用它代替全量 `npm run compile`。
  2. `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationEngineSnapshotsList.test.ts` 与 `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationEngineSnapshotsListAria.test.ts`，或跑 `scripts/run-unit-custom.sh`。
  3. `npx eslint src/vs/workbench/contrib/conversation/browser/conversationEngineSnapshotsList.ts src/vs/workbench/contrib/conversation/test/browser/conversationEngineSnapshotsList.test.ts`，或跑 `npm run eslint`。
  4. r09-2 不改系统文档，docs-health 随下一节的方案登记一起跑。

## 实施顺序与提交

1. 两条分开实施、分开提交。r09-2 不依赖别的批次，可以先做，按上文只暂存本条的 hunk；r09-1 等它的两项实施前提都提交之后再做。
2. 每次只暂存本条的文件与 hunk（`git add -p`），不用 `git add -A`，不为干净工作区 restore、stash 或 reset 别人的未提交改动。
3. r09-1 同步 `conversationStubModel.ts` 的字段注释与 `docs/systems/conversation/commands.md` 第 63 行所在段。r09-2 只改类注释；`lens-and-trajectory.md` 第 107 行已写明期望行为，不改系统文档。
4. 提交时把本方案登记进 `dev/plans/INDEX.md`，并按 `scripts/wiki/formats.md` 更新本稿状态行。
5. 提交前跑 `python3 scripts/wiki/wiki.py remind --root .`，按提示更新文档，或在提交说明最后一段写 `Docs-Reviewed`；再跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`，不留新的错误。

## 审查

2026-11-07 只读审查的结论是须改稿，没有 Critical。Important 三条都已改。I1：核实 S2 未提交的点外关闭只排除 `.monaco-dialog-box` 与 `.context-view`，自定义对话框的遮罩按下会在确认期间关掉浮层，删除随后照发；r09-2 已写明这条路径的可达范围（默认原生对话框走不到，绑定会话切走是 HEAD 就有的另一条路径，Escape 会取消对话框而不发送）和行为（照发、不画、不刷新、下次打开重列），保留照发的理由是用户已在确认框里点了删除，且类注释与 `delete confirm still sends when the published identity, link, and session stay` 把发送闸定为身份、链接、会话；补了对应不变量与用例（用 `close()` 模拟关闭，不依赖 S2 的排除名单），把遮罩排除交给 S2，写明只暂存本条 hunk，行号改为当前工作区的行号。I2：核实 `hydrateNewSessionWorkDir`、`orderSessionsForRoster` 与名册测试 mock 的 `lastAccessedAt` 都只在未提交改动里；r09-1 写明两项实施前提，断言改用 HEAD 的 `groupSessionsForRoster`，并分开写 HEAD 与工作区里会话列表的滚动和 SessionBar More 菜单的排序。I3：两条的本地验证都改为先 compile、再跑测试、再跑 eslint，改文档的再跑 docs-health；r09-1 为「同 id 已有记录不改时间」和「下次拉目录整表替换」补了三条用例，r09-2 为「发出后浮层关闭不画」和「重列失败不留成功文案」补了用例；运行清单加了 `conversationSessionsView.test.ts`。Minor 都已顺手改：行号改到当前工作区（会话列表 734–736 行、SessionBar More 菜单 378 行，并注明 HEAD 行号）；引擎 List 的引用改为主路径 `toProtoSummary` 的 981 行；补了本机与引擎时钟偏差只影响过渡期的说明；在覆盖需求和核查里写清 PRD-002.5 与 r09-1 的关系，并写明 r09-2 为什么不对应需求；把源码扫描守卫 `engine roster fire-and-forget voids double-catch onUnexpectedError`（6191–6207 行）列入保持通过。另按共性意见补了「实施顺序与提交」，写明提交时登记进 `dev/plans/INDEX.md`。判定与严重度不变。

## 实施记录（2026-11-07）

用户同意实施并要求不编译。两条都已按方案落到工作区；没有编译，也没有跑测试、eslint 或 docs-health。HEAD 仍是 `841ea38816d`，改动直接做在当前工作区内容上。

r09-1，已实施：

- `src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts`：`adoptEngineSession` 新建记录的分支先看 `engineSessions` 里是否已有正的有限 `lastAccessedAt`，有则新记录带 `lastAccessedAt: Date.now()`；字段在放进 `engineSessions`、触发第一次 `onDidChangeSession` 之前写好。找到已有记录的分支不变。加了一句注释，说明只在名册已按时间分组时写、下次拉目录会替换。
- `src/vs/workbench/contrib/conversation/browser/conversationStubModel.ts`：`ConversationStubSession.lastAccessedAt` 的注释补上本窗口新建会话的过渡值。
- `src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts`：导入 `type ConversationStubSession` 与 `groupSessionsForRoster`；在 `connected createSession catalogs New session only after host Create/Resume, not acquireLease` 之后加 suite 内辅助函数 `adoptNewEngineSession` 和五条用例：`a new engine session adopted into a dated catalog carries a local access time and groups under Today`、`a new engine session adopted into an undated catalog stays undated and the list stays flat`、`adopting a new engine session onto an existing roster row keeps that row access time`、`the next catalog list replaces a new engine session local access time with the engine value`、`the next catalog list without an engine value leaves a new engine session undated at the end of Earlier`。r10 在两个宿主夹具里补的 `editingQueueItemId: 'q1'` 保持原样。
- `docs/systems/conversation/commands.md`：在会话列表分组那段（第 63 行）末尾补一句新建会话的过渡访问时间；按 `docs/DOCUMENTATION.md`「每次编辑必须更新 `updated`」把 `updated` 改为 2026-11-07。r07 在第 27 行加的例外说明保持原样。`updated` 这一行和别的会话的改动在同一个 hunk 里，暂存时注意。
- 依赖：方案写的两项实施前提都还没提交。本条直接改在 `new-session-workdir-hydration.md` 那批未提交改动之上（`adoptEngineSession` 返回记录、`hydrateNewSessionWorkDir`），用例用到 `interaction-review-2026-11-06.md` 那批未提交的 mock 改动（`setListSessions` 收 `lastAccessedAt`、`listSessions` 回传它）。本条改的建记录语句是补 workDir 那批新写的，所以本条的生产改动不能单独暂存：要么和那批一起提交，要么等那批先提交后再暂存本条。
- 与方案的出入：五条用例共用 suite 内的辅助函数 `adoptNewEngineSession`，方案逐条描述用例，没写辅助函数。`commands.md` 那句多写了「引擎没给就回到没有访问时间」，与第四条不变量一致。

r09-2，已实施：

- `src/vs/workbench/contrib/conversation/browser/conversationEngineSnapshotsList.ts`：`deleteSnapshot` 在确认后的检查全部通过之后，传给 `deleteThenRefreshList` 的 origin 改为 `{ ...origin, generation: this.renderGeneration }`，取值与调用之间没有 await，并加了一句注释；类注释写明 Delete 在发送时取代次、确认期间列表刷新或浮层被关掉时仍照发，Restore 仍用点击时的代次。S2 在 `show()`、`close()`、`setOnUserWillOpen`、`paintSnapshots` 里的未提交改动保持原样，点外关闭监听没动。
- `src/vs/workbench/contrib/conversation/test/browser/conversationEngineSnapshotsList.test.ts`：在 `delete confirm still sends when the published identity, link, and session stay` 之后加六条用例：`delete confirmed after a same-link refresh paints success and lists again`、`delete failure after a same-link refresh during the confirm paints the failure and does not list again`、`delete success after a same-link refresh during the confirm does not keep success when the next list fails`、`delete return after an in-flight same-link refresh does not paint success or list again`、`delete return after the overlay closes does not paint success or list again`、`delete confirmed after the overlay closed still sends, does not paint, and the next open lists again`。文件尾部别人的 `ConversationEngineSnapshotsList (browser dispose gate)` 套件保持原样。
- 依赖：同一生产文件和测试文件里有 S2 与测试迁移的未提交改动。本条的三处 hunk（类注释、`deleteSnapshot` 的发送行、六条用例）都不与它们相邻，可以用 `git add -p` 单独暂存。
- 与方案的出入：「确认期间刷新过、随后删除失败时写失败文案」有一个既有边界。确认期间发起的刷新若在失败写出之后才返回，`paintSnapshots` 会清掉写状态行；Restore 失败遇到刷新时也一样，这是写状态行与刷新之间既有的竞态，本条没改。新增用例的桩让这次刷新先于发送完成，锁的是常见顺序。
- 遮罩排除：S2 的点外关闭仍只排除 `.monaco-dialog-box` 与 `.context-view`。按方案，S2 没处理时由实施方在 `dev/progress/deferred-gaps.md` 登记；共享登记表由父 agent 统一写，登记内容已交给父 agent。

没做的部分：无。方案状态行与 frontmatter 按要求未改；`dev/plans/INDEX.md` 与 `deferred-gaps.md` 的登记由父 agent 统一写。

之后要跑的本地验证：

1. `npm run compile-client`，或全量 `npm run compile`。`scripts/test.sh` 加载 `out/` 下的产物，不先编译测不到改动。
2. `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts`
3. `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationSessionsViewStrings.test.ts`
4. `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationSessionsView.test.ts`
5. `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationEngineSnapshotsList.test.ts`
6. `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationEngineSnapshotsListAria.test.ts`；第 2 至 6 步也可以用 `scripts/run-unit-custom.sh` 一起跑。
7. `npx eslint` 检查 `conversationEngineRosterService.ts`、`conversationStubModel.ts`、`conversationEngineSnapshotsList.ts` 与两个测试文件，或跑 `npm run eslint`。
8. `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。

### 代码审查（2026-11-07）

只读代码审查的结论是可接受，只有 Minor，都已处理。`conversationEngineSnapshotsList.ts` 里 `deleteSnapshot` 发送行的注释原来写确认期间的刷新已经移动了列表，可多数确认期间并没有刷新，已改为「确认框打开期间可能发生过刷新」。`conversationEngineRosterService.test.ts` 的辅助函数 `adoptNewEngineSession` 里，`whenEngineSessionReady` 桩原来每次调用都覆盖同一个放行函数，已改为把待绑定会话的 resolver 存进数组、放行时一起放行。既有竞态（确认期间发起的刷新晚于失败文案返回时会清掉失败文案）与遮罩排除的登记由父 agent 处理。改动仍未编译、未跑测试，要跑的本地验证同上。
