---
title: "十六路审查 2026-11-07 r06：workbench api 与 services 方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 1、weaken 1、drop 0。r06-1 让每次端口转发尝试只看自己打开期间有没有收到关闭事件，过期尝试只释放自己拿到的句柄；r06-2 把编辑器历史的延迟加载从「等待期间有改动就整体跳过」改成把存储条目合并到已有条目之后，合并抛错也会解除挂起。已按 2026-11-07 只读审查改稿；同日已实施（未编译、未跑测试），代码审查可接受。"
---

# 十六路审查 2026-11-07 r06：workbench api 与 services 方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无。r06-1 涉及上游的端口转发与 Ports 视图，产品需求里没有对应条目：PRD-019 只要求 Web 与远程窗口仍以 Conversation 为中心，PRD-024 讲的是远程引擎连接，都不含 VS Code 隧道。r06-2 涉及上游快速打开的最近打开列表（工作区存储键 `history.entries`）：PRD-016.8 讲编辑器区前进后退走哪条导航历史，PRD-029.3 与 PRD-029.4 讲 Preview 编辑器随会话切换，都不含这个列表。r06-2 不改导航栈，PRD-016.8 的行为不受影响。

只改 r06-1 与 r06-2 两条，范围停在 `src/vs/workbench/services/remote/common/tunnelModel.ts` 的 `TunnelModel.doForward` 与构造函数里 `PortsAttributes` 的登记、`src/vs/workbench/services/history/browser/historyService.ts` 的编辑器历史加载与保存，以及各自的测试文件。平台隧道服务、编辑器部件的恢复顺序和各份扫描测试都不动。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r06-1 | weaken | 中→低 | 机制成立，行号没有漂移，但在产品默认窗口里几乎走不到。远程窗口不在产品范围：`docs/product/vision.md` 22 行写明首批范围是本地默认桌面窗口；`product.json` 没有 `extensionsGallery`，内置的远程解析器只有测试用的 `extensions/vscode-test-resolver`。发现稿列的终端输出自动转发，在没有 `remoteAuthority` 时于 `src/vs/workbench/contrib/remote/browser/remoteExplorer.ts` 275–277 行直接返回；内置扩展里调用 `workspace.openTunnel` 的也只有 `vscode-test-resolver`。本地窗口只剩一条路：内置 `tunnel-forwarding` 声明了 `onTunnel`（`extensions/tunnel-forwarding/package.json` 22–24 行），使 Ports 视图出现，并在本地窗口注册隧道提供方（`extensions/tunnel-forwarding/src/extension.ts` 77–107 行）；Forward a Port 的输入校验只查 `forwarded`（`src/vs/workbench/contrib/remote/browser/tunnelView.ts` 1213 行），第一次转发还在建立时可以再提交同一端口。但这个提供方要 GitHub 登录和隧道 CLI（`extension.ts` 24–42、266–280 行）。它按 `appQuality` 写死找 `code-tunnel` 或 `code-tunnel-insiders`（38 行），产品打包时放进 `bin/` 的 CLI 名字取 `tunnelApplicationName`，即 `universe-agent-studio-tunnel`（`build/linux/dependencies-generator.ts` 60 行），两者对不上；本机开发构建解析出的路径也不存在。提供方因此在建出隧道之前就失败。方案见下文。 |
| r06-2 | hold | 中 | 见下文 |

### r06-1

问题类：同一端口的两次转发在 `TunnelModel.doForward` 里重叠时，后一次在开始时推进了转发代数，前一次因此判为过期并按主机和端口强制关掉共享隧道，两次都结束后端口没有转发。

不变量：

- 一次转发尝试只有在它自己等待 `openTunnel` 或 `makeLocalUri` 期间收到同一主机与端口的关闭事件时，才判为过期。同一端口上别的转发尝试开始或结束，都不会让它判为过期。
- 同一端口的两次尝试重叠、期间没有关闭事件时，两次都结束后 `forwarded` 有这个键，而且 `TunnelModel` 没有释放或关闭这次转发用到的隧道。
- 判为过期的尝试不写入 `forwarded`，返回 `undefined`。这是 `a2878a2f8af` 要挡住的「关端口后被慢 open 复活」，保持不变。
- 判为过期的尝试只释放 `openTunnel` 交给它的那一个 `RemoteTunnel` 句柄，不按主机和端口调用 `closeTunnel`。别的持有者的引用，以及关闭事件之后新开或共享的隧道，都不受影响。
- `TunnelModel` 释放时，它创建的 `PortsAttributes` 一起释放。

要动的符号：`TunnelModel.doForward`（730–810 行）里每次尝试的代数基准与写回（747–749 行）、`closedListener`（753–757 行）和过期分支（769–773 行）；只在 747 行出现的 `_forwardGenerationsByKey` 删除；构造函数里创建 `configPortsAttributes` 的那一行（447 行）。文件：`src/vs/workbench/services/remote/common/tunnelModel.ts`。

改法：

1. 删掉 747–749 行的代数表和基准，每次尝试改用一个局部布尔量，记下这次打开期间是否收到过关闭事件，初值为假。753–757 行的监听保留注册位置和匹配条件（同一主机与端口），收到事件时只把本次尝试的布尔量置真；`finally` 里照旧释放监听。监听在进入等待之前同步注册，在过期判断之后才释放，等待期间同一主机与端口的每次关闭事件都会被它看到。所以只看自己的布尔量就保住了 `a2878a2f8af` 的原意，又去掉了尝试之间共享的那张表。
2. 769–773 行的过期判断改为看这个布尔量。分支内保留 `this.inProgress.delete(key)` 与 `return undefined`，把 `await this.tunnelService.closeTunnel(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort)` 换成等待 `tunnel.dispose()`。这里的 `tunnel` 是 `openTunnel` 返回的句柄，由 `AbstractTunnelService.makeTunnel` 生成（`src/vs/platform/tunnel/common/tunnel.ts` 402–427 行）：它只释放一次引用，重复调用无效；平台表项已经被关闭删掉、或已经换成新隧道时，它什么也不做。
3. 447 行改为用 `this._register` 登记 `new PortsAttributes(configurationService)`。`PortsAttributes` 继承 `Disposable`，自己登记了发射器和配置监听（193–205 行），现状下没有人释放它；上游同一行（`004a1fbb165` 的 443 行）也没有登记。`RemoteExplorerService` 在构造函数里直接 `createInstance(TunnelModel)`，从不释放它（`src/vs/workbench/services/remote/common/remoteExplorerService.ts` 170 行），所以这一步在产品运行时没有可见变化，只让测试里的 `TunnelModel` 能完整释放、通过泄漏检查。
4. 三步互不依赖，一起改。`doForward` 的其它分支不动，也不新增任何 `.catch`。
5. 逐条核对边界情况：
   - 没有提供方、两次重叠：桌面窗口注册的 `TunnelService.retainOrCreateTunnel`（`src/vs/workbench/services/tunnel/electron-browser/tunnelService.ts` 89–94 行）把后一次挂到同一表项并加引用计数。期间没有关闭事件，两次的布尔量都是假。前一次恢复后写入 `forwarded`；后一次在 774–777 行看到 `forwarded` 已有这个键，返回已记下的句柄。
   - 有提供方、两次重叠：后一次在 `tunnel.ts` 367–371 行拿到 `undefined`，在 801 行返回；它的监听在 `finally` 里释放，不影响前一次，前一次照常完成。
   - 关闭事件发生在尝试进行中：该尝试的监听把布尔量置真，尝试判为过期，释放自己的句柄；表项已被 `closeTunnel` 删掉时，这次释放什么也不做。
   - 关闭事件之后才开始的尝试：它的监听在事件之后才注册，布尔量保持为假，不会被这次事件判为过期。更早那次过期的尝试只释放它自己的一份引用，不会关掉这次尝试共享或新开的隧道。按现状，过期分支按主机和端口 `closeTunnel`，会把它一起关掉。

明确不改什么：

- 平台层 `AbstractTunnelService` 的 `openTunnel`、`retainOrCreateTunnel`、`closeTunnel`、`createWithProvider` 与 `_factoryInProgress` 都不改。提供方工厂在建时，同一端口的第二次 `openTunnel` 返回 `undefined`，这由 `src/vs/platform/tunnel/test/common/tunnelOpenRetry.test.ts` 的 `provider recursion remains blocked only for the pending port and clears after success` 锁住。有提供方时，后一次重叠请求因此仍拿到 `undefined`。这是上游行为，本条不改成等待复用。
- 保持 `tunnelOpenRetry.test.ts` 中 `shares one open while it is in flight and keeps a fulfilled tunnel`、`releasing one open handle twice preserves the other owner`、`an old open handle cannot release a reopened tunnel`、`a pending tunnel closed before completion cannot release its replacement` 通过。
- 774–777 行：打开成功后发现 `forwarded` 已有这个键时，返回已记下的句柄，不释放本次尝试多拿的那一份平台引用，平台引用计数要等强制关闭才归零。这是上游行为，本条不改。
- `tunnel.ts` 429–441 行的 `tryDisposeTunnel`：对还在建立的隧道调用 `closeTunnel` 时，表项立即删除，但底层隧道要等打开完成、`dispose` 结束之后才释放并发出 `onTunnelClosed`。所以这类关闭的事件通常在尝试越过过期判断之后才到，由构造函数里的 `onTunnelClosed` 处理（524–526、562–568 行）把刚写入的 `forwarded` 项删掉，最终仍不转发。本条不改这个时序。
- `TunnelModel.close`（875–887 行）仍按主机和端口 `closeTunnel`，用户或扩展关闭端口时对所有持有者生效。
- `inProgress` 仍是单个标记：一次尝试结束（包括 801 行的无隧道返回）就删掉这个键，即使同一键还有别的尝试在建。这可能让构造函数里的 `onTunnelOpened` 处理（487–523 行）先用默认属性记下端口。这是上游原有行为，不在本条范围。
- 已转发分支 `mergeAttributesIntoExistingTunnel`、构造函数里的 `onTunnelOpened` 与 `onTunnelClosed` 处理、`forward` 等待恢复完成的逻辑都不改。
- `AutomaticPortForwarding` 只在远程窗口启用、Forward a Port 的输入校验只查 `forwarded`，都不改。
- 扫描测试对本文件的约束保持成立：不新增双层 catch；452–484 行 `tunnels.then(...)` 那一段仍以单层 `.catch(onUnexpectedError)` 收尾；`onUnexpectedError` 的导入保留；不写 `D814` 字样。对应 `src/vs/workbench/services/contextmenu/test/node/contextmenuLeftoverPromiseCatchScanD810.test.ts` 176、210、213、294、311 行与 `src/vs/workbench/services/dataChannel/test/node/dataChannelRemoteAuthenticationLeftoverPromiseCatchScanD814.test.ts` 311 行。这些断言与活码一致，改后仍成立。

本地验证：

- 新增 `src/vs/workbench/services/remote/test/common/tunnelModel.test.ts`。套件调用 `ensureNoDisposablesAreLeakedInTestSuite()`，这是 `eslint.config.js` 913 行 `local/code-ensure-no-disposables-leak-in-test` 的要求。每个用例把 `TunnelModel` 放进本用例的 `DisposableStore` 并在结束时释放；改法第 3 步之后它的 `PortsAttributes` 随之释放，泄漏检查本身就覆盖这一步。假隧道服务在用例结束时等待它的 `dispose()`。
- 用 `TestInstantiationService` 桩出 `TunnelModel` 的构造依赖。`ITunnelService` 用一个继承 `AbstractTunnelService` 的假实现，仿照 `tunnelOpenRetry.test.ts` 的 `RetryTunnelService`，由测试控制建隧道的 promise。要由测试触发关闭事件时，假实现在构造函数里把公开的 `onTunnelClosed` 换成 `Event.any(原来的 onTunnelClosed, 测试发射器的事件)`，不碰私有的 `_onTunnelClosed`。`TunnelModel` 在构造时订阅这个事件，所以先建好假实现再建模型。这样关闭事件的时机不依赖微任务顺序。
- 每个用例包在 `runWithFakedTimers`（`src/vs/base/test/common/virtualScheduling/runWithFakedTimers.ts` 45 行）里。转发成功后 `storeForwarded` 的 `@debounce(1000)`（664 行）会挂一个 1 秒的计时器；`runWithFakedTimers` 在回调结束后把虚拟队列跑完，计时器不会拖到用例之后才触发。`remote.restoreForwardedPorts` 设为假，这个计时器触发时只读一次配置就返回。
- 没有提供方的用例给 `IWorkbenchEnvironmentService` 一个 `remoteAuthority`，并先 `await model.restoreForwarded()`，让 `forward` 不再等待恢复。
- 断言一：没有提供方时，对 `localhost:3000` 连发两次 `forward`，放行建隧道的 promise 后，两次结果都是隧道对象，`model.forwarded` 有 `localhost:3000`，假隧道的 `dispose` 没有被调用，`onClosePort` 没有触发。按现状这条会失败。
- 断言二：用 `setTunnelProvider` 注册由测试控制的 `forwardPort`，连发两次 `forward`。放行后 `forwardPort` 只被调用一次，第一次结果是隧道对象，`forwarded` 有这个键，隧道没有被释放。按现状这条会失败。
- 断言三：一次 `forward` 在建时由测试触发 `localhost:3000` 的关闭事件，放行后结果是 `undefined`，`forwarded` 没有这个键，假隧道的 `dispose` 被调用一次。改前改后都应通过，用来锁住 `a2878a2f8af` 的原意。
- 断言四：第一次 `forward` 在建时触发关闭事件，之后再发第二次 `forward`，两次共享同一表项。放行后第一次返回 `undefined`，第二次返回隧道对象，`forwarded` 有这个键，假隧道的 `dispose` 没有被调用。按现状这条会失败。
- 命令顺序：先 `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`），因为 `scripts/test.sh` 加载的是 `out/` 下的编译产物；再跑 `./scripts/test.sh --run src/vs/workbench/services/remote/test/common/tunnelModel.test.ts`、`./scripts/test.sh --run src/vs/platform/tunnel/test/common/tunnelOpenRetry.test.ts`，以及上面 D810、D814 两份扫描各一次（它们对 `tunnelModel.ts` 的断言应通过，其余断言不归本条）；最后 `npm run eslint`。`scripts/run-unit-custom.sh` 的 conversation、sources、universeAgent 三个域里没有测试创建 `TunnelModel`，这一条不必跑它。

### r06-2

问题类：编辑器组就绪之前编辑器历史只要被加过一条，就绪后的延迟加载就整体跳过，`history.entries` 里上次会话的条目不再并入，下一次保存时被只含本次会话条目的列表覆盖。

不变量：

- 编辑器组就绪之后，启动时 `history.entries` 里的条目，除了就绪前被删除、被排除或被整体清空的，都在 `this.history` 里（受 200 条上限约束）。就绪前对历史的任何增删，都不会让存储条目整体丢失。
- 合并完成时，就绪前加入、且仍在列表里的条目都排在所有并入条目之前，彼此的先后不变。
- 就绪前被 `removeFromHistory` 删掉的条目（参数是编辑器、未类型化输入或删除类文件事件），以及被 `replaceInHistory` 换掉的编辑器，不会因为合并又从已打开编辑器或存储里回来。
- 就绪前移动的文件，存储里以源路径记下的条目改成目标路径再参与合并，不以源路径回来，也不因为源不在当前列表里就丢掉。
- 就绪前调用过 `clearRecentlyOpened()` 时，合并不从已打开编辑器或存储加入任何条目。
- 被 `files.exclude` 或 `search.exclude` 排除的条目不并入，沿用 `includeInHistory`。
- 合并后同一个去重键只出现一次。去重键沿用现在 `loadHistory` 的 `handledEditors`：编辑器输入是「资源字符串/editorId」，未类型化输入是「资源字符串/options.override」。没有资源的编辑器输入不算键，按 `EditorInput.matches` 判断，同样不重复出现。
- 延迟加载还没完成时，`saveState` 不用不完整的列表覆盖 `history.entries`。挂起期间清空过的除外：清空优先，照常写当前列表。
- 合并抛错时，挂起状态照样解除，错误经 `onUnexpectedError` 报告一次；`this.history` 保留已经并入的部分，之后的保存照常写当前列表，不会因为挂起状态卡住而整场会话都不再保存。这与上游 `loadHistory` 抛错时的结果相同。
- 第一次访问时编辑器组已经就绪，行为不变：立即加载，结果与现在相同。
- 延迟加载对一个服务实例只执行一次；服务已销毁时不再合并。

要动的符号：`HistoryService.ensureHistoryLoaded`（1087–1109 行）、`loadHistory`（1111–1168 行）、`removeFromHistory`（1009–1031 行）、`replaceInHistory`（1033–1072 行）、`clearRecentlyOpened`（1074–1079 行）、`saveState`（1201–1221 行）。删除字段 `historyMutationEpoch`（879 行）及其在 928、996、1027、1070、1076 行的递增；它只在 1099–1103 行被读。新增记录挂起状态的私有字段：延迟加载是否挂起、挂起期间的删除记录、挂起期间是否清空过。`moveInHistory`（1000–1007 行）本身不改，它经 `removeFromHistory` 留下的移动记录由合并解释。文件：`src/vs/workbench/services/history/browser/historyService.ts`。

改法：

1. `ensureHistoryLoaded` 在编辑器组未就绪的分支里，把 `this.history` 置为空数组的同时标记延迟加载挂起，删除记录置空，清空标记置假。就绪后的续接仍写成现在这种立即调用的 `async` 函数：`await whenReady` 之后服务未销毁才合并；合并放在 `try` 里，`finally` 里解除挂起状态；这个 promise 只接一层 `.catch(onUnexpectedError)`。不用 `.then(undefined, …)`，不写双层 catch。删掉 `historyMutationEpoch` 及其所有递增。
2. 挂起期间：
   - `removeFromHistory(arg1)` 不论这次在当前列表里删没删到，都把 `arg1` 记进删除记录，因为存储条目这时还没读进来。
   - `replaceInHistory(editor, ...)` 把 `editor` 记进删除记录。替换进来的条目已经在当前列表里，合并时自然去重。
   - `clearRecentlyOpened()` 置清空标记，并丢掉删除记录。
   - `moveInHistory` 经 `removeFromHistory` 把移动事件原样记进删除记录；目标只在源命中当前列表时才加入，与现在一致。只有目标是文件的移动会走到这里（272–274 行）。
   - `removeExcludedFromHistory` 不需要记录，合并时按 `includeInHistory` 过滤。
3. 合并：清空标记为真时什么也不加。否则把 `loadHistory` 改成在现有列表之后追加，而不是先清空再重建：
   - 先把现有条目按去重键登记进 `handledEditors`。
   - 候选依次是已打开的编辑器，然后是 `loadHistoryFromStorage()` 读出的条目。已打开编辑器这一段的顺序与去重规则保持现在 `loadHistory` 的结果（最近活动的在前，同一去重键只取一次），存储条目按存储顺序。
   - 每个候选按记录的先后依次过一遍删除记录：遇到移动事件且源匹配（`editorHelper.matchesEditor(记录, 候选)`）时，把候选的资源换成移动的目标、其余字段不变，再接着比后面的记录；遇到其它记录且匹配时，跳过这个候选。文件事件只匹配未类型化的资源条目（`matchesEditor` 2160–2171 行）；已打开的编辑器跟着改名由编辑器服务负责，这里不处理。
   - 过完记录后，`includeInHistory` 为假的跳过，去重键已登记的跳过，其余用 `addToHistory(候选, false)` 追加并登记它的键。
   - 列表达到 `MAX_HISTORY_ITEMS`（200）就停止追加，不靠 `addToHistory` 末尾的弹出，免得给没有留下的编辑器挂上释放监听。
   - 就绪时第一次访问的路径同样调用改过的 `loadHistory`。这时现有列表为空、没有删除记录，结果与现在相同：已打开编辑器在前，存储条目在后。
4. `saveState` 在延迟加载挂起、且挂起期间没有清空过时直接返回，存储保持启动时的内容；清空过则照常写当前列表。`this.history` 为 `undefined` 时直接返回的现有判断保留。
5. 边界情况：
   - 恢复辅助编辑器窗口时，`EditorParts.restoreParts` 在 `editorParts.ts` 639 行聚焦、641 行才置就绪，历史服务在这之间先删后加当前活动编辑器。改后这一条留在列表第一位，就绪后存储条目追加在它后面。
   - 挂起期间删除的文件：删除类 `FileChangesEvent` 只匹配基于资源的条目，与现在 `removeFromHistory` 的语义相同，存储条目里的同一路径不会回来。
   - 挂起期间先删后加同一编辑器（激活编辑器变化就是这样）：删除记录会挡住存储里的同一资源，但这个编辑器已经在当前列表里，不会丢。
   - 挂起期间把只在存储里的文件 A 移到 A2：合并时存储条目 A 改成 A2，排在 A 原来的位置。上游在加载之后才移动时 A2 会排到最前；这里只保住条目，不追求那个位置。源 A 在当前列表里时，A2 已由 `moveInHistory` 加在前面，改名后的存储条目按去重键跳过。
   - 连续移动 A 到 B、再从 B 到 C：按记录先后依次改名，最后并入 C。移动之后又删除：改名后被删除记录挡住，不并入。
   - 合并抛错：挂起状态在 `finally` 里解除，错误经那一层 `.catch(onUnexpectedError)` 报告，后续行为见不变量。
   - 在挂起窗口里退出：存储保持启动时的列表；挂起期间记下的删除，要等合并之后的下一次保存才写回。这比把不完整的列表写回去更安全。

明确不改什么：

- `EditorParts.restoreParts` 在置就绪之前聚焦（`src/vs/workbench/browser/parts/editor/editorParts.ts` 638–641 行）、多部件时把聚焦转成激活组变化（446–453 行）、主 `EditorService` 在就绪前只经 `onDidChangeActiveGroup` 发激活编辑器事件（`src/vs/workbench/services/editor/browser/editorService.ts` 104–109 行），都不改。修复只在历史服务里。
- `handleActiveEditorChangeInHistory` 先删后加的写法，以及 `isExcludedFromGlobalEditorAggregation` 守卫（205、279、287 行）不改，会话编辑器部件仍不写历史。
- `history.entries` 的键、`StorageScope.WORKSPACE`、`StorageTarget.MACHINE` 与序列化格式不改；只保存资源输入的规则不改。
- 导航栈 `EditorNavigationStack`、最近关闭编辑器，以及 `c8b4c83a504` 加的 `navigatingInRecentlyUsedEditorsStackDepth` 等嵌套计数都不改。
- 扫描测试对本文件的约束保持成立：不碰 186、192 行鼠标前进后退的 `.catch(onUnexpectedError)`；不新增双层 catch；不出现 `.then(undefined,`；`return this.goBack();` 与 `return this.getStack().goForward(filter);` 两句保留；`onUnexpectedError` 的导入保留；不写 `D837`、`D876`、`D883`、`D886`、`D983` 字样。对应 D876（`src/vs/workbench/contrib/customEditor/test/node/customEditorLeftoverPromiseCatchScanD876.test.ts` 211、226、253、256、418 行）以及 D837（`src/vs/workbench/services/userDataProfile/test/node/userDataProfileManagementLeftoverPromiseCatchScanD837.test.ts`）、D883（`src/vs/workbench/contrib/share/test/node/shareLeftoverPromiseCatchScanD883.test.ts`）、D886、D983 里对本文件的编号检查。
- D876 的 184–200、214–215 行，D886（`src/vs/workbench/contrib/dropOrPasteInto/test/node/dropOrPasteIntoLeftoverPromiseCatchScanD886.test.ts`）的 175–179、384–391 行，D898（`src/vs/workbench/contrib/themes/test/node/themesLeftoverPromiseCatchScanD898.test.ts`）的 145–149、305–314 行，D983（`src/vs/base/test/node/baseLeftoverPromiseCatchScanD983.test.ts`）的 294–295 行，仍要求 186、192 行是双层 catch。`e3c3eded87e` 已把这两行收敛成单层（`dev/progress/status.md` 36 行记的服务层收敛），按代码判断这几条在 HEAD 上已经失败，与本方案无关。本方案不为让它们变绿而加回双层 catch，登记见下文「实施步骤」第 1 步。
- 保持 `src/vs/workbench/services/history/test/browser/historyService.test.ts` 中 `getHistory`、`editor dispose clears history listener`、`getLastActiveFile`、`reopen closed editor`、`open next/previous recently used editor (single group)`、`open next/previous recently used editor (multi group)`、`open next/previous recently is reset when other input opens`、`transient editors suspends editor change tracking` 通过。这些用例的编辑器部件由 `createEditorPart` 建好且已就绪，走的是立即加载路径。
- 保持 `src/vs/workbench/contrib/conversation/test/browser/conversationNavigation.test.ts`（suite `Conversation navigation (S2)`，含 532 行 `conversation tab open does not write IHistoryService`）与 `conversationNavigationService.test.ts`（suite `Conversation navigation stack`）通过。两者分别在 107 行和 92 行直接创建 `HistoryService`，部件由 `createEditorParts` 建好并等到就绪，同样走立即加载路径。

本地验证：

- 在 `historyService.test.ts` 加一个建服务的辅助：先往工作区存储写入 `history.entries`（两条资源条目 A、B），再用一个编辑器组服务桩建 `EditorService` 与 `HistoryService`。这个桩的 `isReady` 为假、`whenReady` 是测试控制的 `DeferredPromise`，放行时同时把 `isReady` 改为真；其余成员转给 `createEditorPart` 建好的真实部件（例如用只改写这两个成员的 `Proxy`）。这份文件已在 918 行调用 `ensureNoDisposablesAreLeakedInTestSuite()`，新用例要放行 `whenReady` 并释放所建的服务。
- 断言一：建服务之前先在部件里打开编辑器 C，C 用同文件 `getHistory` 用例里那种实现 `toUntyped`、资源为 `file` 协议的输入，使它会被保存。这样 `HistoryService` 构造函数（106–108 行）在就绪前就先删后加 C。放行 `whenReady` 后，`getHistory()` 依次是 C、A、B（按资源比较）；再调用存储服务的 `testEmitWillSaveState`，存储里的列表含 A、B、C。按现状 A、B 不在，这条会失败。
- 断言二：就绪前调用 `removeFromHistory({ resource: A })`；放行后 A 不在，B 在。
- 断言三：就绪前调用 `clearRecentlyOpened()`；放行后 A、B 都不在。
- 断言四：就绪前调用 `testEmitWillSaveState`，存储里仍是写入的 A、B；放行后再调用一次，列表含 A、B、C。按现状第一次调用就把存储写成只有 C，这条会失败。
- 断言五：就绪前用测试文件服务的 `fireAfterOperation`（`src/vs/workbench/test/common/workbenchTestServices.ts` 537 行）发一次把 A 移到 A2 的 `FileOperationEvent`（`FileOperation.MOVE`，目标是文件，写法同本文件 520 行）；放行后 A 不在，A2 在 C 之后、B 之前。
- 断言六：存储里放一条与 C 同资源、`options.override` 等于 C 的 `editorId` 的条目；放行后这个资源只出现一次。
- 断言七：放行前把 `editorService.getEditors` 换成只抛一次错的实现，并用 `setUnexpectedErrorHandler` 接住错误；放行后错误被报告一次，再调用 `testEmitWillSaveState` 会写出当前列表，说明挂起已经解除。
- 命令顺序：先 `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`），因为 `scripts/test.sh` 加载的是 `out/` 下的编译产物。再跑 `./scripts/test.sh --run src/vs/workbench/services/history/test/browser/historyService.test.ts`，以及 `./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationNavigation.test.ts` 和 `./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationNavigationService.test.ts`。然后跑 `scripts/run-unit-custom.sh`：它第 139 行的 conversation glob 会跑到上面两份，脚本再拿 `dev/progress/test-baseline-failures.txt` 比对，要求没有新增失败。再把 D837、D876、D883、D886、D898、D983 六份扫描各 `./scripts/test.sh --run` 一次，以「实施步骤」第 1 步登记的 HEAD 失败为基线，不得出现新的失败断言。最后 `npm run eslint`。

## 实施步骤

两条共用：

1. 实施前，在 `dev/progress/deferred-gaps.md` 的 D17（非阻塞验证债总账）下补一条记录：首次 SHA `841ea38816d`，属于 baseline 失败；内容是 D876、D886、D898、D983 对 `historyService.ts` 186、192 行的双层 catch 断言与 `e3c3eded87e` 的单层收敛冲突；owner 是维护这几份扫描的会话。实施时若这几份扫描已被别的会话改过，以当时的内容为准，只登记仍然存在的冲突。D17 是现有的总账，不新开编号。
2. r06-1 与 r06-2 互不依赖，可以分开实施、分开提交；每次只暂存本条的源文件和测试文件。
3. 每条按自己「本地验证」里的顺序跑：先 compile，再 `scripts/test.sh`（r06-2 另加 `scripts/run-unit-custom.sh`），最后 eslint。
4. 提交时把本方案登记进 `dev/plans/INDEX.md`。动了文档就跑 docs-health：`python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`，以及 `dev/progress/health-gates.md` 同一节列出的 `python3 scripts/generate-docs-status.py --check` 与 `python3 -m unittest scripts/tests/test_docs_status.py`。

## 核查记录（2026-11-07）

只读核对到 HEAD `841ea38816d`。`tunnelModel.ts`、`mainThreadTunnelService.ts`、`src/vs/platform/tunnel/`、`src/vs/workbench/services/tunnel/`、`remoteExplorer.ts`、`tunnelView.ts`、`extensions/tunnel-forwarding/`、`historyService.ts`、`editorParts.ts`、`editorPart.ts`、`editorGroupView.ts`、`editorPanes.ts`、`editorService.ts`、`localTerminalBackend.ts` 都没有未提交改动。没有编译，没有跑测试。

r06-1：

- 行号与行为。`tunnelModel.ts` 733、746–757、768–773、524–526、562–568 与发现稿一致，`mainThreadTunnelService.ts` 103–113 一致，`tunnel.ts` 367–371、445–453 一致。发现稿引的 `src/vs/platform/tunnel/node/tunnelService.ts` 195–200 是 node 端实现；桌面窗口渲染进程注册的是 `src/vs/workbench/services/tunnel/electron-browser/tunnelService.ts`，89–94 行同样按主机和端口共享并加引用计数，推理不变。
- 来源。代数逻辑由 `a2878a2f8af`（2026-09-25）加入，提交说明是「openTunnel / makeLocalUri 等待期间若隧道已关闭则递增代数并丢弃结果，同时关闭刚打开的 tunnel」。开始时加一只是为每次尝试取一个不同的值，说明里没有要让重叠请求互相作废。改法第 2 步用释放句柄代替按主机和端口关闭：这次尝试是唯一持有者时隧道照样关闭，符合「关闭刚打开的 tunnel」的原意，又不会关掉别人共享的隧道。
- 可达性。远程窗口与自动转发的反证见判定表。本地窗口的细节：`TunnelModel.extensionHasActivationEvent`（530–536 行）因 `tunnel-forwarding` 声明 `onTunnel` 而设置 Ports 视图的上下文键，`ForwardedPortsView.enableForwardedPortsFeatures`（`remoteExplorer.ts` 100–131 行）随之注册视图。`tunnel-forwarding` 在没有 `remoteAuthority` 时注册提供方；`provideTunnel` 先 `setupPortForwardingProcess`，后者以 `createIfNone: true` 取 GitHub 会话，再启动 CLI。CLI 路径按 `appRoot` 与 `appQuality` 解析；`product.json` 没有 `quality`，开发构建解析为仓库目录往上两级处的 `bin/code-tunnel-insiders`，本机不存在。打包产物里的 CLI 名为 `universe-agent-studio-tunnel`，与扩展要找的名字不同。
- 有意如此的依据：没有。`TunnelModel` 没有单元测试；`src/vs/workbench/contrib/remote/test/browser/remoteExplorer.test.ts` 只测 `isCandidateRemappedTunnelLocalEndpoint`；`docs/` 与 `docs/decisions/` 没有相关条目。平台层 `tunnelOpenRetry.test.ts` 锁住的是共享与句柄释放语义，正好支持上面的改法。
- 重复：没有。`dev/plans/review-2026-*.md`（11-07 其它路除外）、`dev/plans/` 其它方案、`dev/progress/deferred-gaps.md`、`archive/`、`dev/archive/` 里没有 `tunnelModel`、`doForward` 或 `a2878a2f8af` 的记录。2026-10-30 r05 的两条隧道问题在 `src/vs/platform/tunnel/node/tunnelService.ts` 与 `sharedProcessTunnelService.ts`，是另外的缺陷。`dev/archive/status-current-session-2026-09-30.md` 提到 Ports 视图的只是样式微动效。

r06-2：

- 行号与行为。`historyService.ts` 1087–1109、904–905、928、1119、1201–1220 与发现稿一致；`editorParts.ts` 446–453、610–642、710–739，`editorPart.ts` 756–759，`editorGroupView.ts` 1129–1140，`editorService.ts` 109、148–167 一致。`loadHistory` 只有 `ensureHistoryLoaded` 一个调用点（1097、1104 行），就绪后没有别处补加载。代数判断由 `c8b4c83a504` 与 `be99dec5203` 加入；上游 `004a1fbb165` 在就绪后无条件 `loadHistory()`，存储条目会并回，但会抹掉等待期间的增删，这正是两个提交想修的问题。
- 可达性。辅助编辑器窗是默认窗口的产品能力（`docs/architecture/cross-cutting/windows.md` 第 3 节）。历史服务在编辑器部件就绪前就已存在：阻塞启动阶段注册的 `LocalTerminalBackendContribution`（`src/vs/workbench/contrib/terminal/electron-browser/terminal.contribution.ts` 26 行）在构造里同步创建 `LocalTerminalBackend`，后者注入 `IHistoryService`（`localTerminalBackend.ts` 53、93、96 行）。主部件在 `create` 里建好网格就完成 `whenReady`（`editorPart.ts` 1165 行）；组构造时同步开始显示活动编辑器（`editorGroupView.ts` 593–595 行），`EditorPanes.doOpenEditor` 同步建窗格并 `setInput`（`editorPanes.ts` 265、476–479 行），`EditorPane.setInput` 第一句就写 `_input`（`editorPane.ts` 117 行）。所以 639 行聚焦时活动窗格一定带着输入，发现稿「读文件比新建窗口快」这个前提总是成立：只要退出时开着辅助编辑器窗口，下次启动必然跳过加载。没有辅助窗口时只有一个部件，聚焦已激活的组不触发事件（`editorPart.ts` 793 行只在组变化时发 `onDidChangeActiveGroup`，`editorParts.ts` 449 行要求多于一个部件），不触发。会话编辑器部件也登记进同一张部件表（`editorParts.ts` 275 行），但要等引擎名册加载后才创建（`conversationSessionWindowService.ts` 560–574、577、622 行），一般晚于就绪；若早于就绪，修复同样覆盖。
- 有意如此的依据：没有。`historyService.test.ts` 的用例都用已就绪的部件，不走延迟路径；`docs/` 与 `docs/decisions/` 没有相关条目。`c8b4c83a504` 的说明是「编辑器组未就绪时晚到的 loadHistory 会覆盖等待期间的增删」，`be99dec5203` 的说明是「避免延迟加载的历史把已经替换或排除的条目清掉」，都没有要求放弃存储条目。
- 重复：没有。同样范围内没有 `historyMutationEpoch`、`ensureHistoryLoaded`、`loadHistory` 或 `history.entries` 的记录。`dev/plans/conversation-session-windows.md` 讲会话部件与 `IHistoryService` 隔离，`dev/plans/preview-category-isolation.md` 讲从历史打开编辑器时切类别，都不是这条缺陷。

## 审查

2026-11-07 按 [DOCUMENTATION.md](../../docs/DOCUMENTATION.md) 规则 16 做了只读审查，结论是须改稿，没有 Critical。改稿时 HEAD 仍是 `841ea38816d`，`tunnelModel.ts` 与 `historyService.ts` 没有未提交改动，三条 Important 对照活码核实后都已改。I1 属实：`PortsAttributes` 继承 `Disposable`（193 行），447 行创建时没有登记，新用例开着泄漏检查（`eslint.config.js` 913 行）就会报；采纳「用 `_register` 包起来」，写成 r06-1 改法第 3 步，并在本地验证里写明泄漏检查与释放顺序。I2 属实：八份扫描都读这两个文件，r06-2 的续接改为在 `try/finally` 里解除挂起、只接一层 `.catch(onUnexpectedError)`，补了「合并抛错」的不变量与用例，两条的「明确不改什么」逐条列出扫描对文件文本的约束，本地验证逐份运行。核实时更正一处前提：D876 第 200 行确实要求恰好两处双层 catch，但 `historyService.ts` 186、192 行早已被 `e3c3eded87e` 收敛为单层，D876、D886、D898、D983 关于这两处的断言在 HEAD 上就会失败；本方案不加回双层 catch，改为在实施步骤第 1 步登记到 D17。D810、D814 对 `tunnelModel.ts` 的断言与活码一致，改后仍成立。I3 属实：`conversationNavigation.test.ts` 107 行与 `conversationNavigationService.test.ts` 92 行直接创建 `HistoryService`，`scripts/run-unit-custom.sh` 139 行的 conversation glob 会跑到它们；已把这两份测试、`run-unit-custom.sh`、compile 与 eslint 写进 r06-2 的本地验证。

Minor 都已处理。关闭事件的桩改为用 `Event.any` 合并公开的 `onTunnelClosed`，不碰私有的 `_onTunnelClosed`。转述里的「不变量 2」没有指明是哪一条，r06-1 与 r06-2 的第二条都改写了措辞，r06-1 那条不再夹带平台行为。774–777 行与 `tunnel.ts` 429–441 行的上游事实写进了 r06-1 的「明确不改什么」。采纳可选建议，用每次尝试的局部布尔量代替代数表，删掉 `_forwardGenerationsByKey`。`@debounce(1000)` 的计时器用 `runWithFakedTimers` 收在用例之内。去重键写明了两种形态的键和无资源输入的判法。挂起期间移动的文件改为按目标路径并入，并补了移动、去重、合并抛错三条用例。

本轮共性意见也已处理：两条的本地验证都写成先 compile、再 `scripts/test.sh` 或 `scripts/run-unit-custom.sh`、最后 eslint，动了文档跑 docs-health；「覆盖需求」改为写明两条为什么都不对应产品需求；实施步骤写明提交时把本方案登记进 `dev/plans/INDEX.md`。

## 实施记录（2026-11-07）

用户同意实施并要求不编译。在 HEAD `841ea38816d` 的工作区上实施；改动前四个目标文件都没有别的会话的未提交改动，提交顺序上不依赖别的会话。没有编译，没有跑测试、eslint 或 docs-health，下面的行号是实施后的当前行号。

r06-1，已实施：

- `src/vs/workbench/services/remote/common/tunnelModel.ts`：447 行用 `this._register` 登记 `PortsAttributes`（改法第 3 步）；`doForward` 删掉 `_forwardGenerationsByKey` 与代数基准，改为每次尝试的局部布尔量 `closedWhileOpening`，只由本次尝试的 `onTunnelClosed` 监听置真（751 行起，改法第 1 步）；过期分支改看这个布尔量，并把 `closeTunnel(host, port)` 换成 `await tunnel.dispose()`（768–773 行，改法第 2 步）。没有新增 `.catch`，`tunnels.then(...)` 那一段与 `onUnexpectedError` 导入不变。
- 新增 `src/vs/workbench/services/remote/test/common/tunnelModel.test.ts`，套件 `TunnelModel overlapping forwards`，四条用例对应本地验证的断言一到四。与方案的出入：假隧道服务另加了一个 `onDidRequestTunnel` 事件，用例先等每次 `forward` 真正走到隧道服务再放行建隧道的 promise，让「重叠」是确定的；有提供方的用例先等第二次 `forward` 返回再放行，并顺带断言它是 `undefined`（平台现状，见「明确不改什么」第一条）。关闭事件按方案用 `Event.any` 合并进公开的 `onTunnelClosed`，每条用例包在 `runWithFakedTimers` 里，模型登记进泄漏检查的 store，假服务在 `finally` 里等待 `dispose()`。

r06-2，已实施：

- `src/vs/workbench/services/history/browser/historyService.ts`：删掉 `historyMutationEpoch` 及其五处递增（`removeExcludedFromHistory` 里随之没用的 `lengthBefore` 一并删掉）；新增三个私有字段（882 行起）；挂起期间 `removeFromHistory`（1012 行）与 `replaceInHistory`（1034 行）记录删除，`clearRecentlyOpened` 置清空标记（1075 行）；`ensureHistoryLoaded`（1088 行起）的续接在 `try/finally` 里解除挂起，只接一层 `.catch(onUnexpectedError)`（1115 行）；`loadHistory`（1120 行起）改为在现有条目之后合并；新增 `toHistoryEntryId`（1200 行）与 `replayRemovalsWhileLoadPending`（1208 行）；`saveState` 加挂起守卫（1264 行）。与方案的出入：`await whenReady` 也放进了 `try`，即使等待本身被拒绝也会解除挂起；已打开编辑器一段先按现有规则单独收集（逆最近活动顺序遍历、同一去重键取首次出现），再与存储条目一起逐个过删除记录与去重，保证立即加载路径的结果与改前相同。例外一处：没有资源的编辑器输入按 `EditorInput.matches` 去重，这条规则在立即加载路径上也生效，同一个（或互相 `matches` 的）无资源编辑器在两个组里打开时，历史从改前的两条变成一条。这符合方案「合并后不重复出现」的去重不变量，但与「立即加载结果与现在相同」那句不完全一致。
- `src/vs/workbench/services/history/test/browser/historyService.test.ts`：新增导入（`errors`、`storage`、`TestStorageService`），新增测试输入 `TestFileEditorInputWithOverride`（922 行）、辅助 `createServicesBeforeEditorGroupsReady`（928 行）及八条用例（981–1131 行）：其中七条对应本地验证的断言一到七，1079 行那条是代码审查后补的，见下文「代码审查」。与方案的出入：方案说 C 用 `getHistory` 用例里那种输入，但那个输入的未类型化形态 `options.override` 是 `'testOverride'`，不等于它的 `editorId`，挂起条目与已打开编辑器的去重键会对不上；所以另写了一个像 `FileEditorInput.toUntyped()`（`src/vs/workbench/contrib/files/browser/editors/fileEditorInput.ts` 438–444 行）那样带 `options.override = editorId` 的输入。断言七用临时替换 `editorService.getEditors` 注入合并失败，并在 `finally` 里还原。断言六里存储中的重复条目先被「先删后加」留下的删除记录挡住，没有走到去重键；用例仍验证该资源只出现一次。

没做的部分：

- 实施步骤第 1 步要在 `dev/progress/deferred-gaps.md` 的 D17 下登记扫描测试的既有红，第 4 步要把本方案登记进 `dev/plans/INDEX.md`。这两张共享登记表由父 agent 统一写，本轮没有改。
- compile、测试、eslint、docs-health 都没有跑。

之后要跑的本地验证：

1. `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`）。
2. `./scripts/test.sh --run src/vs/workbench/services/remote/test/common/tunnelModel.test.ts`
3. `./scripts/test.sh --run src/vs/platform/tunnel/test/common/tunnelOpenRetry.test.ts`
4. `./scripts/test.sh --run src/vs/workbench/services/contextmenu/test/node/contextmenuLeftoverPromiseCatchScanD810.test.ts` 与 `./scripts/test.sh --run src/vs/workbench/services/dataChannel/test/node/dataChannelRemoteAuthenticationLeftoverPromiseCatchScanD814.test.ts`
5. `./scripts/test.sh --run src/vs/workbench/services/history/test/browser/historyService.test.ts`
6. `./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationNavigation.test.ts` 与 `./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationNavigationService.test.ts`
7. `scripts/run-unit-custom.sh`。conversation 域里有大量别的会话尚未提交的测试改动，拿基线比对时要分清哪些失败与本方案有关。
8. D837、D876、D883、D886、D898、D983 六份扫描各 `./scripts/test.sh --run` 一次，以 HEAD 上 D876、D886、D898、D983 关于 goBack、goForward 双层 catch 的既有失败为基线，不得出现新的失败断言。
9. `npm run eslint`
10. docs-health：`python3 scripts/check-docs-health.py`、`python3 scripts/wiki/wiki.py check --root .`、`python3 scripts/generate-docs-status.py --check`、`python3 -m unittest scripts/tests/test_docs_status.py`。

### 代码审查（2026-11-07）

只读代码审查的结论是可接受，只有 Minor，都已处理，仍未编译、未跑测试：

- `tunnelModel.test.ts` 改从 `base/test/common/virtualScheduling/index.js` 导入 `runWithFakedTimers`，不再用已标 `@deprecated` 的 `timeTravelScheduler.js`；`virtualScheduling/index.ts` 第 36 行确有这个导出，相对路径与原导入同深度。
- `historyService.ts` 里与新顺序矛盾的旧注释「Opened editors should always be first in the history」改写成：已打开编辑器排在存储条目之前、在就绪前加入的条目之后（1139–1140 行）。
- 无资源编辑器按 `matches` 去重在立即加载路径上也生效，已写进上面 r06-2 生产代码那一条。
- 补了用例 `an entry added before the editor groups are ready without a removal record still keeps a stored duplicate out`（`historyService.test.ts` 1079 行）：直接调用私有的 `moveInHistory`，让挂起列表里出现一条没有删除记录的目标条目，存储里放同一路径，断言它只出现一次。这条覆盖 `loadHistory` 里先用已有条目登记去重键的那一段（1167–1173 行）；直接调用是为了不让编辑器服务同时移动已打开的编辑器。
