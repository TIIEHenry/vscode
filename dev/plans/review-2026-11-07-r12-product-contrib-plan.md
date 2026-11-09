---
title: "十六路审查 2026-11-07 r12：navigator 与产品贡献面方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 1、weaken 1、drop 0；Team 视图标题栏 Refresh 的前置条件键改为随花名册会话事件重算，直接在 navigator 那批未提交改动上实施，提交时与它同提交或排在其后；MCP 服务器实例销毁后不再把迟到的空校验结果写进工具缓存。已过规则 16 只读审查并改稿；2026-11-07 已实施（未编译、未跑测试），代码审查可接受。"
---

# 十六路审查 2026-11-07 r12：navigator 与产品贡献面方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：PRD-022。

r12-1 对应 PRD-022 的 Team 段：标题栏手动 Refresh 是该需求方案 [navigator-engine-segments](navigator-engine-segments.md) 在 N4 Team 一行（173 行）写明已落的「受状态保护的手动 Refresh」，本条修它在会话已就绪后仍保持禁用；不改 PRD-022 的验收条目与状态。r12-2 不对应产品需求：它修的是上游 `McpService` 的工具缓存，产品里的 MCP 由引擎管理，`docs/product/requirements.md` 416 行写明 Engine 的 MCP 定义与运行态不读取 vscode `IMcpService`。

只改 r12-1 与 r12-2 两条。r12-1 停在 `NavigatorTeamView` 会话事件处理里的一处调用、`navigatorTeamSubviews.test.ts` 的一条新测试和 `activity-and-sidebar.md` 的一句话，`navigatorTeamList.test.ts` 只核实不改；r12-2 停在 `McpServer._setServerTools` 的写缓存条件和 `mcpServer.test.ts`。不碰花名册服务、MCP 缓存类、自动启动规则、标题栏 Inspect 的前置条件和引擎侧 MCP。

核对基准是 HEAD `841ea38816d` 加上工作区的未提交改动，行号按审查后改稿时的工作区。与本稿有关、带别人未提交改动的文件有：`navigatorTeamList.ts`、`navigatorTeamList.test.ts`、`navigatorTeamSubviews.test.ts`、`navigatorAgentsView.ts`、`navigatorAgentsSubviews.test.ts`、`conversationEngineRosterService.ts`、`docs/reference/code-oss-b2/navigator-tabs-access.md`、`docs/product/requirements.md`、`src/vs/platform/actions/common/actions.ts`（只多一行无关的 `MenuId`）和 `dev/plans/INDEX.md`。MCP 相关文件没有未提交改动。本路只读核对，没有编译、没有跑测试。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r12-1 | hold | 中 | 成立，以工作区为基准。`navigatorTeamRefreshAvailable` 只在构造、活动会话变化、引擎连接变化、连接快照推送时重算（`navigatorTeamList.ts` 312–326、334–341、352–354 行）；会话事件只走 `syncKeepLeftoverListFailInspect`，它只重算 `ua.engineConnected`（1187–1199 行）。花名册连上时先发连接事件、再列目录（`conversationEngineRosterService.ts` 1876–1877 行），列目录前把 `listCompleted` 置 false（2155 行；启动恢复缓存时 2299 行也置 false），这期间就绪度是 `loading`（184–186 行）；列完后活动会话 id 不变就只发 `onDidChangeSession`（1063–1067、2193–2208 行）。启动时带缓存这条路径，两次重算都读到 `loading`，与监听注册先后无关。断线重连这条路径取决于花名册与视图谁先订阅连接事件（花名册是延迟单例，`conversation.contribution.ts` 48 行）；视图先订阅时，下一次连接推送会把键算对。发现稿说「断开再连上能恢复」只在这种先后下成立，不影响结论。测试只锁挂载瞬间的取值（`navigatorTeamSubviews.test.ts` 276–330 行，`navigatorTeamList.test.ts` 161–180 行），没有锁「列完仍灰」。D457（`dev/progress/deferred-gaps.md` 478 行）要求 Refresh 的键随会话事件重算，当时 Team 的 Refresh 用 `ua.engineConnected`；10-29 的 `e48af5ae75c` 换成新键后没接上。HEAD 上同一命令 id 注册了两次，模块加载就抛错（见正文实施前提）；工作区未提交改动删掉旧的那份之后，问题才以本条的形态出现。工作区未提交改动还让标题栏 Inspect 也用这个键（1346 行），那是另一处设计，不在本条。已有方案与缺口表都没有承接。 |
| r12-2 | weaken | 低→提示 | 代码行为成立。`_getValidatedTools` 在实例已销毁时返回空数组（`mcpServer.ts` 1164–1173 行，`c9016d48b50` 加入），`_setServerTools` 只比代数就写缓存（1210–1217 行）。缓存由 `McpService` 持有，保存状态时落盘（`mcpService.ts` 56–57 行，`mcpServer.ts` 166–175 行），同 id、同 nonce 的新实例读成 Cached 且零工具（`mcpServer.ts` 339–343、463–474 行）。降级理由是可达性和后果。默认编辑器窗口里的产品 MCP 由引擎管理：Engine 设置页 MCP Servers 节走引擎 RPC；`docs/product/requirements.md` 416 行写明 MCP 定义与运行态不读取 vscode `IMcpService` 作为 UA 运行态；`docs/reference/code-oss-b2/settings-ua-access.md` 94 行把本地 `mcp.json` 当作 donor 里的普通文件；`contrib/conversation` 与 `platform/universeAgent` 都不引用 `IMcpService`。上游 `McpService` 仍随 `workbench.common.main.ts` 250–251 行加载，`chat.mcp.access` 与 `chat.mcp.autostart` 默认是 all 与 newAndOutdated（`chat.shared.contribution.ts` 1070、1204 行），所以用户自己的 `mcp.json` 服务器会被发现，能经代码透镜或命令启动，空缓存写得出来。后果只落在两处非产品面：一是上游聊天发请求时的自动启动（`chatServiceImpl.ts` 1849–1856 行）；上游聊天不是产品对话面，默认窗口里打开 Chat 视图的命令直接返回（`docs/systems/chat/widget-parts.md` 191 行）。二是 MCP 网关，它把 Cached 当作就绪（`mcpGatewayToolBrokerChannel.ts` 344–348 行），只经扩展 API `vscode.lm.startMcpGateway` 创建，仓内调用方只有内置 Copilot 的 CLI 会话（`extensions/copilot/src/extension/chatSessions/copilotcli/node/mcpHandler.ts` 84 行）。默认窗口自己的 MCP 界面只是少了「N tools」透镜（`mcpLanguageFeatures.ts` 388–397 行只在工具数大于 0 时显示），手动启动一次就用实时列表覆盖缓存。触发还要求在那几次 `json.validate` 往返期间移除定义（500ms 节流后销毁，`mcpService.ts` 59、200–208 行），之后再以同 id、同 nonce 加回。测试、文档和已签收方案都没有锁定或承接这一点；10-30 的 r12 方案改的是信任、elicitation 和资源退订。 |

### r12-1

问题类：Team 视图标题栏 Refresh 的前置条件键 `navigatorTeamRefreshAvailable` 不随花名册的会话事件重算；引擎连上、目录列完、活动会话 id 不变时，这个键停在列目录期间算出的 false，Refresh 一直禁用。

实施前提：

- 等 navigator 那批未提交改动提交后再实施，或者把本条交给那批改动的作者，合进同一提交。HEAD 的 `navigatorTeamList.ts` 把 `NAVIGATOR_TEAM_REFRESH_COMMAND_ID` 注册了两次：HEAD 1180–1200 行那份用 `ua.engineConnected`、调用 `refresh()`，1223–1243 行那份用 `navigatorTeamRefreshAvailable`、调用 `refreshTeamTree()`。`registerAction2` 遇到已注册的 id 会抛错（`src/vs/platform/actions/common/actions.ts` 735–737 行），所以这个模块在 HEAD 上加载就失败，在 HEAD 上实施本条没有意义，测试也加载不起来。工作区的未提交改动删掉了前一份，并改好了 `navigatorTeamList.test.ts`。
- 那批改动提交之前，`navigatorTeamList.ts` 和 `navigatorTeamSubviews.test.ts` 里混着别人的未提交改动，单独提交本条会把它们一起带进去，违反只暂存本主题文件的规则。
- 2026-11-07 实施时，用户选择不等那批改动提交，直接在它上面实施（见文末实施记录）。提交时本条与那批改动同一提交，或排在它之后提交，并且只按块暂存本条的改动。

不变量：

- 花名册发出 `onDidChangeSession` 后，Team 视图在同一次分发里重算 `navigatorTeamRefreshAvailable`，结果等于此刻 `isRefreshAvailable()` 的值。连接已建立且未配对挂起时，让就绪度变成 `ready` 的那次会话事件把键置真，让就绪度离开 `ready` 的那次会话事件（D457 的 KEEP leftover list-fail）把键置假，都不另等活动会话变化或连接快照推送。
- 这个键能否跟上，不再取决于花名册与视图谁先订阅 `uaConnection.onDidChangeConnection`。花名册让就绪度改变的几条路径之后都会发 `onDidChangeSession`：目录列完（`conversationEngineRosterService.ts` 2208 行）、列表失败（2225 行）、绑定失败（1796、1983、2027 行之后的 1811、1984、2042 行）。连接代次、引擎身份或删除作用域已被取代时，这些路径提前返回、不发事件（2205–2207、2212–2214、1797–1799 行），由取代它的那一次再发；本条不改这些提前返回。
- Team 标题栏 Refresh 的前置条件键在构造、活动会话变化、引擎连接变化、会话变化、连接快照推送五处都重算。
- `refreshTeamTree()` 在调用 `requestAgentTreeRefresh` 之前仍自己检查 `isRefreshAvailable()`（`navigatorTeamList.ts` 592–598 行）；配对挂起或会话未就绪时，即使前置条件一时过期，也不发请求。
- `ua.engineConnected` 的计算方式和重算时机不变。

要动的符号：`NavigatorTeamView.syncKeepLeftoverListFailInspect`（`navigatorTeamList.ts` 1187–1199 行，唯一调用处是构造函数 327–333 行订阅的 `onDidChangeSession`）、`NavigatorTeamView.updateRefreshAvailability`（607–609 行）。文件：`src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts`；测试 `src/vs/workbench/contrib/navigator/test/browser/navigatorTeamSubviews.test.ts`（新增）、`src/vs/workbench/contrib/navigator/test/browser/navigatorTeamList.test.ts`（只核实）；文档 `docs/systems/workbench/activity-and-sidebar.md` 103 行。

改法：

1. 在 `syncKeepLeftoverListFailInspect` 里，紧跟现有的 `updateEngineConnectedContextKey()` 调用 `updateRefreshAvailability()`，放在 `isConversationSessionNotReady` 提前返回之前，让变成就绪和离开就绪两个方向都重算。最前面的已销毁提前返回保留。只加这一处，其余四处事件处理的调用不增不减。
2. 核实那批改动提交后的状态，不改别人的测试：`navigatorTeamList.ts` 只剩一份 Refresh 注册，前置条件是 `NAVIGATOR_TEAM_REFRESH_AVAILABLE_KEY`，处理函数调用 `refreshTeamTree()`；`navigatorTeamList.test.ts` 的 `ViewTitle exposes a read-only Refresh action that reloads the live tree` 给连接桩 `connected` 阶段（工作区 167–170 行），断言该键为 true（176 行）且前置条件等于这个键（177 行）。任何一项对不上，就停下来找那批改动的作者对齐，不在本条里改。
3. 边界：如果提交时 Refresh 的前置条件已改回 `ua.engineConnected`，那个键本来就在 `syncKeepLeftoverListFailInspect` 里重算，第 1 步可以不做；下面「本地验证」的新测试照写，只把读取的键换成实际使用的那个。
4. 文档：`activity-and-sidebar.md` 103 行仍写 Refresh 用视图自己的 `ua.engineConnected`，与工作区不符。按实际保留的键改写这一句：Refresh 的前置条件是 `navigatorTeamRefreshAvailable`（非配对挂起、连接阶段为 connected、引擎已连接、会话就绪），活动会话、引擎连接、会话与连接快照的变化都会重算它；「点下去先 `requestAgentTreeRefresh`，再排一次列表刷新」保留。若那批改动提交时已改过这一句，只核对措辞。
5. 提交时把这份方案登记进 `dev/plans/INDEX.md`，见文末「实施与提交」。

明确不改什么：

- 不改花名册服务。`setEngineConnected` 只在值变化时发事件（`conversationStubService.ts` 874–880 行）；`doRefreshEngineCatalog` 在列目录前把 `listCompleted` 置 false；`activateEngineSession` 只在 id 变化时发活动会话事件；每次连接推送都重新列目录。这些都保持原样。
- 不改 `isRefreshAvailable()` 的四个合取，不改 `updateEngineConnectedContextKey()`，也不把两个键并成一个。p1 方案（`dev/plans/review-2026-11-04-p1-capability-write-gate-plan.md` 第 3 节）要把 `ua.engineConnected` 的三个合取搬成共享函数，本条不碰那几行。
- 不锁定、也不改标题栏 Inspect 的前置条件。HEAD 里 Team 与 Agents 的标题 Inspect 都没有前置条件；工作区未提交改动给 Team 加上 `navigatorTeamRefreshAvailable`（`navigatorTeamList.ts` 1346 行），给 Agents 加上 `ua.engineConnected`（`navigatorAgentsView.ts` 1401 行）。已签收的 `docs/reference/code-oss-b2/navigator-tabs-access.md` 97 行写 Agents 无引擎时标题 Inspect 只 `openView`（无选中），128 行写 Team 无引擎时也有标题 Inspect，这两处前置条件会在断开时把它置灰。这个冲突由那批改动的作者在提交时对齐文档或调整前置条件。新测试不断言 Inspect 的前置条件；若 Team Inspect 最终仍绑这个键，第 1 步会顺带让它也随会话事件更新，但这不是本条的合同。
- 不改行级 Inspect、Enter、单击只选中的行为，不改 `inspectFocusedTitleAction()` 与 `isTeamRowActionLive()` 的早退。
- 保持通过：`navigatorTeamSubviews.test.ts` 的 `ViewTitle registers Members, Tasks, and Inspect actions for Team`（248 行，含「恰好一个 Refresh」）、`Refresh requests the live tree only when Team is connected and ready`（276 行）、`Refresh stays unavailable during pairing hold or session readiness transition`（293 行）、`KEEP leftover list-fail closes member/task row-open and Inspect without connection event`（2452 行）、`session readiness flip updates ua.engineConnected`（2541 行）；`navigatorTeamList.test.ts` 的 `ViewTitle exposes a read-only Refresh action that reloads the live tree`（161 行）、`Refresh does not request a tree reload while pairing is pending`（182 行）；`navigatorAgentsSubviews.test.ts` 的 `KEEP leftover list-fail closes Inspect / Reveal / row-open and Refresh chrome without connection event`（520 行）。

本地验证：

- 在 `navigatorTeamSubviews.test.ts` 新增测试 `session readiness flip updates Team Refresh availability without connection or active-session events`，写法照 `session readiness flip updates ua.engineConnected`（2541 行）：用同样可翻转就绪度的花名册，起始 `engineSessionReady = false`，连接桩给 `connected` 阶段且 `pairingPending: false`。挂载后断言 `NAVIGATOR_TEAM_REFRESH_AVAILABLE_KEY` 为 false，并且 Refresh（`NAVIGATOR_TEAM_REFRESH_COMMAND_ID`）标题菜单项的 `precondition` 在视图的 scoped context 里不匹配。然后把就绪改为 true，只调用 `createTestFrameSourceCallback().onSessionChanged(活动会话 id)`（它只发 `onDidChangeSession`，`conversationStubService.ts` 460 行），不发活动会话事件、不推连接快照，断言键变为 true、前置条件匹配。再翻回 false，断言键和前置条件一起变假。现有代码在第二步失败，这条测试就是 r12-1 的复现。前置条件匹配的写法参考 `navigatorAgentsSubviews.test.ts` 494、581 行。不断言 Inspect。
- 跑法。`scripts/test.sh --run` 加载 `out/` 下的编译产物，所以先编译：
  1. `npm run compile`；只改了局部 TypeScript 时可用 `npm run compile-client`（见 [health-gates](../progress/health-gates.md)）。
  2. `./scripts/test.sh --run src/vs/workbench/contrib/navigator/test/browser/navigatorTeamSubviews.test.ts --run src/vs/workbench/contrib/navigator/test/browser/navigatorTeamList.test.ts --run src/vs/workbench/contrib/navigator/test/browser/navigatorAgentsSubviews.test.ts`，覆盖新测试和上面「保持通过」列出的全部用例。navigator 不在 `scripts/run-unit-custom.sh` 的域里。
  3. `npm run eslint`。
  4. 改了 `activity-and-sidebar.md`，再跑 `python3 scripts/check-docs-health.py` 和 `python3 scripts/wiki/wiki.py check --root .`。

### r12-2

问题类：MCP 服务器实例在校验 `tools/list` 结果的等待期间被销毁时，`_getValidatedTools` 用空数组代替校验结果，`_setServerTools` 把这个空数组连同当前 nonce 写进共享工具缓存，盖掉该定义 id 原来的缓存。

不变量：

- 已销毁的 `McpServer` 实例不向 `_primitiveCache` 写工具列表。销毁之前发出、销毁之后才落定的刷新，不改变该定义 id 的缓存条目：原来有，tools 与 nonce 保持原样；原来没有，仍然没有。
- 未销毁的实例照旧：只有最新一次刷新（回调里 `epoch === this._toolsRefreshEpoch`）写缓存，写入 `_getValidatedTools` 的真实结果，包括全部工具都因 schema 不合法被剔除时的空数组。
- 以同一 id、同一 `cacheNonce` 重新加入的服务器，`cacheState` 只取决于销毁前已有的缓存，不会因为迟到的刷新变成 Cached 且零工具。
- 已销毁实例上的 `_normalizeTool` 与 `_getValidatedTools` 仍然短路：不再调用 `json.validate`，也不对已销毁的服务器弹无效工具提示（`warnInvalidTools`，`mcpServer.ts` 1189 行）。

要动的符号：`McpServer._setServerTools` 中 `toolsPromise.then` 回调里写缓存的条件（`src/vs/workbench/contrib/mcp/common/mcpServer.ts` 1210–1222 行，条件在 1215 行）。测试：`src/vs/workbench/contrib/mcp/test/common/mcpServer.test.ts`。

改法：

1. 在回调里 `await this._getValidatedTools(tools)` 之后，把写缓存的条件由「代数相等」改为「代数相等且 `this._store.isDisposed` 为假」。判断只放在 await 之后这一处：销毁可能发生在进入 `_getValidatedTools` 之前（入口短路返回空数组），也可能发生在等待 `json.validate` 期间（第二处短路返回空数组），两种情况都由这一处挡住。
2. 回调的返回值仍是 `{ data, nonce }`，`_tools.fromServerPromise` 照旧设置。已销毁的实例已经不在 `McpService.servers` 里，这个值只会被仍拿着旧实例的等待方读到（例如 `startServerAndWaitForLiveTools`），本条不改它们。
3. 不要为了保留迟到的真实结果，去掉 `c9016d48b50` 在 `_normalizeTool`（1093–1096 行）和 `_getValidatedTools`（1165–1167、1171–1173 行）加的销毁短路。去掉之后，已销毁的服务器会继续调用 `json.validate`，并可能弹无效工具提示。跳过写入、让缓存停在销毁前的状态，就是本条要的结果。
4. 两处原文保持不动：`_setServerTools` 的签名行（1210 行）和回调入口 `const toolPromiseSafe = toolsPromise.then(async tools => {`（1212 行）。D772 扫描在 `leftover start / stop / open / toolUpdate / entry.promise then are Promise single-chain` 里按原文匹配签名（`mcpLeftoverPromiseCatchScanD772.test.ts` 192 行），在 `opener / Action2.run / assigned then / two-arg then / returned Promise / Watch / Resolve / Pty / Connect / D145 stay skipped` 里按原文匹配回调入口（267–268 行）。新条件只写在回调体内现有的 `if (epoch === this._toolsRefreshEpoch)` 上。
5. 上游清单：`mcpServer.ts` 是上游文件。ADR-007（`dev/decisions/007-upstream-sync.md`）Decision 2 把 `contrib/…|mcp|…` 上的顺手补丁归为 B 类（86 行），并要求新出现的上游改动归入 A 表或列入 B 表（109 行）。`mcpServer.ts` 相对基线 `004a1fbb` 早已有改动，`dev/progress/upstream-min-patch.md` B 表的 `src/vs/workbench/contrib/mcp/**` 一行（280 行）按前缀覆盖它，所以本条不新增侵入文件，完备性闸门的 `comm` 不会多出漏项，清单不用新增条目。改动只在 `c9016d48b50` 已经改过的这个回调里加一个条件，不新增函数或文件。考虑过让文件更接近上游的另一种改法：回退 `c9016d48b50` 在 `_normalizeTool`、`_getValidatedTools` 的销毁短路，迟到结果就会照常写入真实校验结果；但那样已移除的服务器又会调用 `json.validate`、可能弹无效工具提示，还要推翻那次提交的销毁守卫，所以不采用。该行写的 5 个文件与「MCP 命令与 Servers 视图」已落后于实际（相对基线该目录有 40 个文件改动），这是 `c9016d48b50` 一类既有补丁造成的，留给清单的月度核对，本条不改。
6. 提交时把这份方案登记进 `dev/plans/INDEX.md`，见文末「实施与提交」。

明确不改什么：

- 不改 `_setServerPrompts` 与 `_setServerMetadata`。prompts 回调里没有异步校验，迟到落定时写的是服务器真实返回的数据。
- 不改 `McpServerMetadataCache`（`get`、`store`、`onWillSaveState` 写 `mcpToolCache`、LRU 容量）。不改 `McpService.updateCollectedServers` 的 500ms 节流和对已移除定义的 `dispose`，也不在服务器移除时清它的缓存。
- 不改 `cacheState` 的推导、`autostart` 只启动 Unknown 与 Outdated 的规则，也不改网关 `_ensureServerReady` 把 Cached 当作就绪。
- 不改引擎侧 MCP（`EngineMcpSection`、`EngineMcpRuntimePanel`），不改 `dev/progress/upstream-min-patch.md`。
- 保持通过：`mcpLeftoverPromiseCatchScanD772.test.ts` 的 `leftover start / stop / open / toolUpdate / entry.promise then are Promise single-chain` 与 `opener / Action2.run / assigned then / two-arg then / returned Promise / Watch / Resolve / Pty / Connect / D145 stay skipped`；`mcpServer.test.ts` 的 `non-quiet error start settles and the next queued start runs`、`quiet error start rejects with UserInteractionRequiredError`；`mcpGatewayToolBrokerChannel.test.ts` 的 `does not start server when cache state is live`、`starts server when cache state is unknown`。

本地验证：

- 在 `mcpServer.test.ts` 的套件 `Workbench - MCP - McpServer` 新增测试 `late tool validation after dispose keeps the cached tools`。夹具要能拿到传给 `McpServer` 的 `McpServerMetadataCache`（给 `createServer` 加可选参数，或在新测试里自建缓存实例）。`ICommandService.executeCommand` 在命令是 `json.validate` 时记下调用，并返回一个由测试控制、先挂起的 Promise。注册一个首次启动就是 Running 的 delegate，它返回的 `TestMcpMessageTransport` 用 `setResponder('tools/list', …)` 按请求 id 回一个工具；`initialize` 的响应已经带 `tools` 能力（`mcpRegistryTypes.ts` 39–57 行）。启动前在缓存里给该定义 id 预置 `{ tools: [一个工具], nonce: definition.cacheNonce }`。启动服务器，等到 `json.validate` 被调用后执行 `server.dispose()`，再让挂起的 Promise 以空诊断结束并清空微任务。断言缓存里该 id 的 `tools` 仍是预置列表、`nonce` 未变。
- 同一套件再加对照测试 `tool validation on a live server stores the validated tools`：不销毁、走完同样流程，缓存写成新返回的那个工具，证明前一条确实走到了写缓存那一行。
- 跑法。`scripts/test.sh --run` 加载 `out/` 下的编译产物，所以先编译：
  1. `npm run compile`；只改了局部 TypeScript 时可用 `npm run compile-client`（见 [health-gates](../progress/health-gates.md)）。
  2. `./scripts/test.sh --run src/vs/workbench/contrib/mcp/test/common/mcpServer.test.ts --run src/vs/workbench/contrib/mcp/test/common/mcpGatewayToolBrokerChannel.test.ts --run src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD772.test.ts`，覆盖两条新测试和上面「保持通过」列出的全部用例。Electron 单测入口按 `**/test/**/*.test.js` 收文件（`test/unit/electron/renderer.js` 90 行），`test/node` 下的扫描测试也这样跑。mcp 不在 `scripts/run-unit-custom.sh` 的域里。
  3. `npm run eslint`。
  4. r12-2 本身不改文档；提交时登记 `dev/plans/INDEX.md` 的那一处按「实施与提交」跑 docs-health。

## 实施与提交

- 两条互不依赖。r12-2 现在就能实施；r12-1 按它的实施前提，等 navigator 那批未提交改动提交，或交给那批改动的作者。
- 提交时把这份方案登记进 `dev/plans/INDEX.md`，写法照同目录已有的审查方案行（例如 10-30 r12 方案那一行）。两条分开提交时，由先提交的那次登记，后一次只更新这一行的摘要。改过 INDEX 后跑 `python3 scripts/check-docs-health.py` 和 `python3 scripts/wiki/wiki.py check --root .`。
- 只暂存本条涉及的文件，不用 `git add -A` 把别人的未提交改动一起带进去。

## 审查

2026-11-07 只读审查的结论是须改稿，r12-2 可按稿实施。没有 Critical。Important 两条都属实，已改。I1：HEAD 的 `navigatorTeamList.ts` 把 `NAVIGATOR_TEAM_REFRESH_COMMAND_ID` 注册了两次（HEAD 1180–1200、1223–1243 行），`registerAction2` 遇到重复 id 抛错（`actions.ts` 735–737 行），模块在 HEAD 上加载即失败；工作区未提交改动删掉了前一份，并已改好 `navigatorTeamList.test.ts`（167–170、176–177 行）。r12-1 因此加了实施前提（等 navigator 那批改动提交，或交给它的作者），改法第 2 步由「改测试断言」改为「核实」，核对基准的文件清单补上了这个测试文件。I2：HEAD 里 Team 与 Agents 的标题 Inspect 都没有前置条件，是工作区未提交改动加上的（`navigatorTeamList.ts` 1346 行、`navigatorAgentsView.ts` 1401 行），与已签收的 `navigator-tabs-access.md` 97、128 行不一致；问题类、不变量第 3 条、新测试和文档步骤都改为只锁 Refresh，Inspect 的去留写进「明确不改什么」，交给那批改动的作者。Minor 全部已改：行号按当前工作区重新定位；不变量 1 写明「连接已建立且未配对挂起」的前提，不变量 2 改为说明花名册提前返回时不发事件、由取代它的那一次再发；r12-2 第 4 步补上 D772 在 267–268 行对回调入口的原文匹配，并把该测试列入保持通过；两条的运行清单与「保持通过」对齐，补跑 `navigatorAgentsSubviews.test.ts` 和 `mcpGatewayToolBrokerChannel.test.ts`；`activity-and-sidebar.md` 103 行改为必改，验证里加了 docs-health；r12-2 补了 ADR-007 B 表说明（第 5 步）；新测试都给了标题。另按共性意见调整：本地验证改为先编译、再跑 `scripts/test.sh`、再跑 eslint，改了文档再跑 docs-health；「覆盖需求」写明 r12-1 对应 PRD-022、r12-2 不对应的理由；实施步骤写明提交时登记 `dev/plans/INDEX.md`。判定与严重度没有变化。

## 实施记录（2026-11-07）

用户同意实施，并要求不编译。两条都已按方案落到工作区，没有提交。

r12-1，已实施：

- 生产代码：`navigatorTeamList.ts` 的 `NavigatorTeamView.syncKeepLeftoverListFailInspect` 在 `updateEngineConnectedContextKey()` 之后、`isConversationSessionNotReady` 提前返回之前调用 `updateRefreshAvailability()`（当前 1192 行）。其余四处事件处理没有改。
- 测试：`navigatorTeamSubviews.test.ts` 新增 `session readiness flip updates Team Refresh availability without connection or active-session events`（当前 2570 行起）。只断言 `NAVIGATOR_TEAM_REFRESH_AVAILABLE_KEY` 和 Refresh 标题菜单项的前置条件，不断言 Inspect。
- 核实（改法第 2 步）：工作区 `navigatorTeamList.ts` 只剩一份 Refresh 注册，前置条件是 `NAVIGATOR_TEAM_REFRESH_AVAILABLE_KEY`、处理函数调用 `refreshTeamTree()`（1362–1382 行）；`navigatorTeamList.test.ts` 167–170、176–177 行与方案一致。这个测试文件没有改。
- 文档：`activity-and-sidebar.md` Team 一行（103 行）改为写 `navigatorTeamRefreshAvailable` 及其重算时机，保留「点下去先 `requestAgentTreeRefresh`，再排一次列表刷新」。按 `docs/DOCUMENTATION.md` 67 行「每次编辑必须更新 `updated`」，同时把该页 frontmatter 的 `updated` 改为 2026-11-07，这是方案里没写的一处。
- 依赖：按用户说明，没有等 navigator 那批未提交改动提交，也没有交给它的作者，直接在当前工作区实施。本条落在那批改动之上：HEAD 里重复的 Refresh 注册要靠那批改动删掉，`navigatorTeamList.test.ts` 的前置条件断言也是那批改动改的。`navigatorTeamList.ts` 与 `navigatorTeamSubviews.test.ts` 里本条只新增上面两处，其余差异都属于那批改动。提交时要么与那批改动同一提交，要么在它之后提交，并且只暂存本条的两处改动（按块暂存），不能单独先于它提交。
- Inspect 的前置条件按「明确不改什么」没有动（Team 1347 行、Agents `navigatorAgentsView.ts` 1401 行仍是那批改动的写法）。

r12-2，已实施：

- 生产代码：`mcpServer.ts` 的 `McpServer._setServerTools` 回调里，写缓存条件改为 `epoch === this._toolsRefreshEpoch && !this._store.isDisposed`（1215 行）。签名行（1210 行）和回调入口 `const toolPromiseSafe = toolsPromise.then(async tools => {`（1212 行）原文没动；`_normalizeTool`、`_getValidatedTools` 的销毁短路保留。
- 测试：`mcpServer.test.ts` 新增 `RunningToolsDelegate`（74 行，首次启动即 Running，按请求 id 回 `tools/list`）；`createServer` 加可选的 `cache` 参数（165 行，不传时行为不变）；辅助函数 `setupPendingToolValidation`（183 行）在子容器上 `stub(ICommandService)`，让 `json.validate` 挂起到测试放行，并给定义 `test-server` 预置 nonce 为 `'a'` 的缓存工具；两条新测试 `late tool validation after dispose keeps the cached tools`（238 行）和对照 `tool validation on a live server stores the validated tools`（254 行）。新增 import：`DeferredPromise`、`timeout`、`MCP`、`McpToolVisibility`。
- 与方案的出入：方案写「给 `createServer` 加可选参数，或在新测试里自建缓存实例」，两者都用了：辅助函数自建缓存，再传给 `createServer`。`ICommandService` 在单个测试里用子容器的 `stub` 替换，没有改 `setup()` 里共用的桩。
- 上游清单：按改法第 5 步，没有改 `dev/progress/upstream-min-patch.md`。

没有做的：

- 本路没有改 `dev/plans/INDEX.md`。INDEX 已有本路发现稿与本方案两行登记（另一会话加的，未提交）；提交时只按块暂存这两行，不带进 INDEX 里的其他未提交改动。
- 没有编译，没有跑测试，没有跑 eslint 和 docs-health。

之后要跑的本地验证（`scripts/test.sh --run` 加载 `out/` 下的编译产物，先编译）：

1. `npm run compile`；只改了局部 TypeScript 时可用 `npm run compile-client`。
2. `./scripts/test.sh --run src/vs/workbench/contrib/navigator/test/browser/navigatorTeamSubviews.test.ts --run src/vs/workbench/contrib/navigator/test/browser/navigatorTeamList.test.ts --run src/vs/workbench/contrib/navigator/test/browser/navigatorAgentsSubviews.test.ts`
3. `./scripts/test.sh --run src/vs/workbench/contrib/mcp/test/common/mcpServer.test.ts --run src/vs/workbench/contrib/mcp/test/common/mcpGatewayToolBrokerChannel.test.ts --run src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD772.test.ts`
4. `npm run eslint`
5. `python3 scripts/check-docs-health.py` 和 `python3 scripts/wiki/wiki.py check --root .`

最需要编译或测试确认的点：

- `mcpServer.test.ts` 的两条新测试第一次真正走完 MCP 握手、`tools/list` 和 `json.validate`（现有两条测试在握手完成前就结束了）。要确认 `TestMcpMessageTransport` 的 `initialize` 响应（固定 id 1）与处理器的首个请求 id 对得上、`tools/list` 响应被正确解析、`timeout(0)` 足够让校验后的微任务跑完，以及测试末尾没有未释放的 disposable。
- 类型：`stub(ICommandService, …)` 里的泛型箭头 `<R>(id: string): Promise<R | undefined>` 返回 `Promise<undefined>`；预置缓存用对象字面量按未导出的 `ValidatedMcpTool` 做上下文检查（`_icons: []`、`visibility` 用按位或）；`setResponder` 回调的返回值要能赋给 `MCP.JSONRPCMessage`。
- r12-1 的新测试在没有本条生产改动时应当在「变为就绪」那一步失败；在当前工作区上，要确认它与那批 navigator 未提交改动一起编译、通过。

代码审查（2026-11-07）：只读代码审查的结论是可接受，只有 Minor，都已处理。

- `mcpServer.test.ts` 销毁用例里的 nonce 断言在没修时同样通过，因为错误写入的 nonce 也是 `'a'`。已换成 `assert.deepStrictEqual(cache.get(definition.id)?.tools.map(tool => tool.serverToolName), ['cached_tool'])`（251 行）。`serverToolName` 是 `ValidatedMcpTool` 的 `string` 字段，预置工具里写的就是 `'cached_tool'`；没修时缓存工具会被写成空数组，这条断言会失败。
- 「实施前提」补了一条：用户选择直接在 navigator 那批未提交改动上实施，提交时与它同一提交或排在它之后，按块暂存。实施记录里关于 INDEX 的说法改为：INDEX 已有本路两行登记（另一会话加的，未提交），提交时只按块暂存这两行。
- 提交前核对，改稿时的结果：`navigatorTeamList.ts` 1192 行 `syncKeepLeftoverListFailInspect` 里的 `this.updateRefreshAvailability();` 还在；`navigatorTeamSubviews.test.ts` 的新测试 `session readiness flip updates Team Refresh availability without connection or active-session events` 还在 2570 行起。两个文件仍混着另一会话的未提交改动，提交时按块暂存前再看一次。
