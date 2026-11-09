---
title: "十六路审查 2026-11-07 r14：contrib 其余方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 2、weaken 0、drop 0。r14-1 用记录结果归属的状态对象，让搜索编辑器补放残留搜索时只写本面板最近一次搜索的结果；r14-2 先挡住载入期间的替换，再让被内容代数拒绝的替换在原偏移重读，并把多文件消费改成全有或全无。2026-11-07 已过只读审查并改稿；同日已实施（未编译、未跑测试），代码审查可接受。"
---

# 十六路审查 2026-11-07 r14：contrib 其余方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无（两条修的是上游自带的搜索编辑器与输出日志编辑器。`docs/product/requirements.md` 的需求条目规定的是本产品新增的会话、引擎、Sources、设置、窗口与视觉等能力，没有覆盖这两个编辑器的条目；最接近的 PRD-029.8 只要求会话目录加入工作区后 Explorer、Search 能看到它，不涉及搜索编辑器把结果写回哪个输入，也不涉及日志编辑器）。

只改 r14-1 与 r14-2 两条：r14-1 停在 `src/vs/workbench/contrib/searchEditor/browser/`（改 `searchEditor.ts`，另加一个状态对象小文件），r14-2 停在 `src/vs/workbench/contrib/output/common/outputChannelModel.ts`，不碰扩展端、输出面板门控与搜索模型。

核对基于 HEAD `841ea38816d` 的工作区。两份引用文件及所在目录都没有未提交改动，发现稿引用的行号与当前文件一致。审查之后改稿时重新核对，HEAD 与这些目录都没有变化，下文行号仍然有效。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r14-1 | hold | 中 | 见下文 |
| r14-2 | hold | 低 | 见下文。默认窗口的触发比稿件写的窄一处、宽一处，严重度不变 |

### r14-1

问题类：搜索编辑器在 `setInput` 补放输入上残留的 `ongoingSearchOperation` 时，把面板当前的 `searchModel.searchResult` 写进这个输入，不核对这份结果是不是那次搜索产生的。面板在补放之前已替同组另一个输入搜过，或者输入是从别的组移过来的，写进去的就是别人的命中，已保存的输入还会被标脏。

核查与可达性：

- 机制成立。A 的搜索在 B 显示期间结束时，`onSearchComplete` 第 647–649 行因 `isStaleCompletion()` 返回，第 655–659 行的清理没有走到，A 上留着已经完成的 operation。B 的 `doRunSearch` 调用同一个 `searchModel.search`（第 133 行，一个面板只建一份）。`SearchModelImpl.search` 一开始就把查询换成 B 的，`PlainTextSearchHeadingImpl` 的 `query` 设置器随即 `clearQuery()`，旧的文件夹匹配作废。切回 A 时第 792 行让两个序号相等，第 651 行放行，第 677 行序列化的是 B 的结果，第 684 行写进 A 的结果模型，第 694 行把带 `backingUri` 的 A 标脏。
- 前提是 A 的搜索在 B 发起搜索之前已经结束。B 发起时 A 还在跑，第 552 行先取消它，A 的 operation 以取消错误结束，补放的 `.then` 不会执行，不会写错结果。
- 同组复用同一个面板：`EditorPanes.doInstantiateEditorPane`（`editorPanes.ts` 第 409–422 行）按描述符返回已有面板，切换输入前的 `clearInput` 只清输入与视图状态，不取消搜索。
- 默认编辑器窗口可达。`searchEditor.contribution.ts` 注册面板（第 107–116 行）、解析 `*.code-search`（第 120–149 行）和「New Search Editor」（第 304–317 行，`f1: true`）都没有窗口条件。搜索视图标题栏的「Open New Search Editor」（第 599–617 行）挂在搜索视图上，搜索视图容器（`search.contribution.ts` 第 53–60 行）没有设 `windowEnablement`，按 `views.ts` 第 140–144 行默认属于编辑器窗口。
- 默认窗口的 `files.autoSave` 默认是 `off`（`files.contribution.ts` 第 270 行，Agents 窗口才是 `afterDelay`）。错配结果要等用户保存或自己开了自动保存才会写进 `.code-search` 文件；这时 `SearchEditorInput.save` 写出的是 A 的查询头加上结果区里 B 的命中。
- 查重：`df294508e62`（2026-09-25）只挡「补放之后又开始新搜索」，`c4bac4ad5a4` 管 `setInput` await 之后输入已被换走。既有审查稿与方案、`dev/progress/deferred-gaps.md`、`archive/`、`dev/archive/` 里没有这条；D695、D851 只管 Promise 的 catch 链。没有测试或文档把「补放时写入面板当前结果」定为预期。

不变量：

- 补放路径（`onSearchComplete` 收到的 `searchSeq` 与 `operation` 都为空）只在「输入上此刻的 `ongoingSearchOperation` 非空，且就是本面板最近一次调用 `searchModel.search` 得到的那个 operation」时，才序列化 `this.searchModel.searchResult`，并写结果模型、追加消息、`setDirty`、`setMatchRanges`。
- 本面板调用 `searchModel.search` 之前先把归属置空，拿到新 operation 之后再记下；`search` 同步抛错时归属保持为空。
- 归属条件与第 651 行的序号条件，在第 677 行序列化之前（第 663 行 await 之后）重新成立；不成立就不写。第 677 行取了快照之后不再要求归属。
- 输入上的 operation 已经为空，说明同一个 operation 已由别的完成路径处理，补放静默返回，不写也不提示。
- 归属不符时不改结果模型、不标脏、不改匹配范围、不追加消息；清掉输入上的这个 operation，免得每次切回都再补放一次；显示「Run Search」提示。
- 同一面板里 A 的搜索在别的输入显示期间结束，之后面板没有再调用 `searchModel.search`，切回 A 仍把 A 的结果写进去。这是补放路径原本要做的事。
- 面板自己发起的那次搜索的完成路径（`searchSeq` 与 `operation` 有值）不变，仍按第 632、670 行的序号和 `isStaleCompletion()` 丢弃过期完成。

要动的符号：

- 新增状态对象（例如 `SearchResultOwner`）：记下本面板 `searchModel.searchResult` 当前属于哪一次 operation。只依赖 `ISearchComplete` 类型，不碰 DOM 与服务，方便单测。
- `SearchEditor` 新增一个持有它的字段。
- `SearchEditor.doRunSearch`：第 622 行前后两处调用。
- `SearchEditor.onSearchComplete` 的补放分支：第 651 行之后与第 670 行之后两处判断。
- `SearchEditor.setInput` 的补放段（第 794–802 行）不改。
- 文件：`src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts`；新增 `src/vs/workbench/contrib/searchEditor/browser/searchEditorResultOwner.ts`（文件名可调）。

改法：

1. 状态对象只有四个操作：`searchStarting()` 把归属置空；`searchStarted(operation)` 记下归属；`owns(operation)` 在 operation 非空且等于归属时为真；`decideAttached(attached)` 返回三种结果之一：输入上已经没有 operation（已由别的完成路径处理）、operation 不属于本面板、operation 属于本面板。
2. `doRunSearch` 在第 622 行调用 `searchModel.search` 之前调用 `searchStarting()`，在第 629 行给 `startInput.ongoingSearchOperation` 赋值的同一同步段里调用 `searchStarted(operation)`。`search` 同步抛错时归属保持为空，旧 operation 不会再被当成面板当前结果的来源。第 614 行因序号不符提前返回、没有调用 `searchModel.search` 的那次运行不动归属。
3. `onSearchComplete` 的补放分支在第 651 行守卫之后、第 655 行清理之前，把 `input.ongoingSearchOperation` 读进局部常量交给 `decideAttached`：没有 operation 就静默返回；不属于本面板就把输入上的这个 operation 清掉，调用 `toggleRunAgainMessage(true)` 后返回；属于本面板才继续往下走。这一刻输入一定是当前输入且配置没变，第 647 行已经判过。补放回调本身不传任何新参数。
4. 补放分支在第 666、670 行的检查之后、第 674 行关闭引用窗口和第 677 行序列化之前再判一次：第 651 行的序号条件不成立（等待期间面板又开始了搜索）就静默返回；`owns(局部常量)` 不成立就调用 `toggleRunAgainMessage(true)` 后返回。第 678 行 await 之后只保留现有的 `isStaleCompletion()`：第 677 行已经取了快照，之后面板再搜不改变写进去的内容。
5. 同一面板、A 一直是当前输入时，A 自己的完成和补放挂在同一个 operation 上。前者先执行，在第 657 行清掉输入上的 operation；补放读到空，按第 3 步静默返回，不再重复写一遍、重复标脏。
6. 输入从别的组移过来时，本面板的归属是别的 operation 或为空，按第 3 步给出提示。拆分编辑器走 `SearchEditorInput.copy()`，新输入不带 operation，不进入补放路径。

明确不改什么：

- `setInput` 第 794–802 行的补放段逐字不变，包括 `newInput.ongoingSearchOperation.then(complete => {` 这一行和整段回调；`onSearchComplete` 的参数表也不变。`src/vs/workbench/services/dialogs/test/node/dialogsLeftoverPromiseCatchScanD795.test.ts` 第 182 行断言这一行存在；`src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD851.test.ts` 第 99–104 行的 `ongoingThenCall` 与第 173 行断言整段回调只带一层 `.catch(onUnexpectedError)`。
- 不在 `searchEditor.ts` 里写任何 `Dxxx` 字样，也不新增 `.catch(onUnexpectedError)` 链。约 40 份 `*LeftoverPromiseCatchScan*.test.ts` 读这个文件，其中多份断言文件里没有这类标记（例如 `configurationLeftoverPromiseCatchScanD955.test.ts` 第 313 行、`searchEditorLeftoverPromiseCatchScanD851.test.ts` 第 133 行），还有多份按次数断言 `triggerSearch` 那几处 catch。
- 不改一个面板一份 `SearchModelImpl` 的结构，不改 `SearchModelImpl.search`、`cancelSearch` 与 `serializeSearchResultForEditor`。
- 不改 `_searchSeq` 的递增位置，不改第 614、632、670 行的序号检查与 `_openAttachmentSearchSeq` 守卫。
- 不改 `setInput` 的 `isStale` 守卫，也不改第 772 行进入时是否显示「Run Search」的判定式。
- 不改被新搜索取消的旧 operation：补放的 `.then` 不执行，`.catch(onUnexpectedError)` 照旧吞掉取消错误。
- 归属不符时不清空 A 结果区原有的文本。清空会经 `onDidChangeModelContent`（第 283–287 行）把 A 标脏；只给出「Run Search」。
- 不改 `.code-search` 的保存格式和 `SearchEditorInput.save`。

本地验证：

- 新增 `src/vs/workbench/contrib/searchEditor/test/browser/searchEditorResultOwner.test.ts`，按面板的调用顺序驱动状态对象：A 搜索（`searchStarting()`、`searchStarted(op1)`）之后，`decideAttached(op1)` 是属于本面板；接着 B 搜索（`searchStarting()`、`searchStarted(op2)`），`decideAttached(op1)` 是不属于本面板，`owns(op1)` 为假；新建的状态对象（输入从别的组移入）对 `op1` 是不属于；`decideAttached(undefined)` 是已处理；只调用 `searchStarting()`、没有 `searchStarted`（模拟 `search` 同步抛错）之后，对此前的 `op1` 是不属于。
- 单测不覆盖的接线有三处：`doRunSearch` 里两次调用的位置；`onSearchComplete` 里两次判断的位置；不属于时清掉输入上的 operation 并调用 `toggleRunAgainMessage(true)`。搭一个 `SearchEditor` 面板要有搜索输入控件、包含与排除控件、结果代码编辑器和可用的搜索服务，本条不把面板级用例作为门禁。这三处只由 `npm run compile` 与 `npm run eslint` 保证类型与调用存在，位置是否正确由实施提交的审查对照本节行号确认。
- 可选的面板级用例：仿 `src/vs/workbench/contrib/conversation/test/browser/conversationEditorPane.test.ts`（用 `TestEditorGroupView` 建面板、`pane.create(parent)`、`setInput`）建 `SearchEditor`，向实例化服务注入能手动完成的 `ISearchService.textSearchSplitSyncAsync` 与 `INotebookSearchService.notebookSearch`，按「A 搜索、切到 B、A 完成、B 搜索、切回 A」断言 A 的结果模型没有 B 的命中、A 没有被标脏、消息区出现「Run Search」。
- 保持通过：`src/vs/workbench/contrib/searchEditor/test/browser/searchEditorModelResolve.test.ts` 的 `a rejected search editor resolve is not reused; the next resolve starts again` 与 `a rejection does not clear a replacement already stored for that slot`；`searchEditorLeftoverPromiseCatchScanD851.test.ts` 全部用例；`dialogsLeftoverPromiseCatchScanD795.test.ts` 的 `splash leftover remaining overflow stayed in dialogs leftover remaining and did not overflow into preferences/workspaces/searchEditor/imageCarousel`。
- 顺序：先 `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`，见 `dev/progress/health-gates.md`），因为 `scripts/test.sh --run` 加载的是 `out/` 下的编译产物；再用 `scripts/test.sh --run` 跑新增测试文件、`searchEditorModelResolve.test.ts` 和上面两份扫描测试；最后 `npm run eslint`。

### r14-2

问题类：输出通道的替换读到的切片被轮询加一的内容代数拒绝后，整次替换被放弃，轮询顺带排进来的追加从替换起点重读，把新内容接在旧内容后面。多文件聚合在部分文件被拒时，已接受文件的偏移照样前移，替换或追加都会丢掉那一段。

核查与可达性：

- 机制成立。`FileOutputChannelModel.update` 第 730–737 行先 `reset(till)`；`replaceContent` 第 643 行 `getContent` 取号后，第 650 行 `getReplaceEdits` 要等编辑器 worker。这期间第 199–207 行的轮询见到 etag 不同，就加一代数并 `_onDidAppend`：`this.etag` 只在消费成功时更新，`281589a56b1` 起轮询不再顺手更新它（第 201 行注释）。第 656 行 `consume()` 返回 false，替换整次跳过；追加先等 `replacePromise`，再从 `till` 读到新内容，在第 624–625 行接到旧内容后面，之后没有路径再发起替换。上游 `45a35b80493` 的 `doWatch` 发现变化时同步更新 etag，`consume` 不做代数拒绝，替换总会生效。
- 多文件部分接受：`MultiFileContentProvider.getContent` 返回的 `consume`（第 380–390 行）对每个文件都调用 `consume()`，第 385 行任一为 false 就整体返回 false，但已经返回 true 的文件偏移已经前移。
- 查重：r11-3（`dev/plans/review-2026-10-11-r11-debug-scm-plan.md`，由 `281589a56b1` 落地）只规定三个写入点在 `consume()` 为 false 时跳过写入，并给 `loadModel` 补了重读循环；替换被拒之后由谁补、多文件部分接受时已接受文件的偏移，都没有写。本条只承接 r11-3 的这两处剩余，不重开它已落的部分。
- 默认窗口的触发比稿件写的窄一处。输出面板由 `windowEnablement: WindowEnablement.Sessions`（`output.contribution.ts` 第 295、317 行）和测试 `Output panel view is gated to Agents Window` 锁在 Agents 窗口；「Developer: Open Log...」（第 657–721 行）没有窗口条件，只列日志通道，打开后 `loadModel` 开始轮询。仓内 `extensions/` 的内置扩展都没有对输出通道调用 `replace()`，本地 `.build/builtInExtensions` 里按 `product.json` 下载的三个扩展不创建输出通道。扩展这条路要经「Install from VSIX...」装上的第三方扩展，对自己的日志通道调用 `replace()`，且用户正开着这条日志。
- 也宽一处，稿件没有列：「Open Log...」能打开「Window」日志，它按 `windowLogGroup` 聚合、来源是数组，走 `MultiFileOutputChannelModel`。同组 logger 晚注册或注销时，`logs.contribution.ts` 第 164、175 行调用 `updateChannelSources`，`MultiFileOutputChannelModel.updateChannelSources`（第 763–771 行）走同一个 `replaceContent`。它先停止再重启轮询，重启后的第一次轮询约在 500ms 之后；替换拖过这段时间，或者停止前已在飞的 `stat` 恰好在替换期间返回，才会被拒。被拒后再叠上多文件部分接受：被拒的文件从起点重读，整段接在旧内容后面（它若原本就在旧内容里就重复一遍），已接受文件这次读到的新字节丢掉。
- 两条路都窄，后果只在编辑器显示，日志文件不受影响，下一次替换或清空会拉回正确内容，严重度维持低。

不变量：

- 替换只在本次文本模型已由 `loadModel` 放好初始内容之后发起。载入还在进行时（第 517 行已经建了模型、第 520–532 行的循环还没放好内容），`doUpdate` 不发起替换；载入循环按当前来源与偏移读全量，结果不缺这次替换。
- 一次没被取消、所属通道模型未释放、文本模型未被换掉或释放的替换，结束时文本模型等于从替换起点读到并消费成功的那段内容。替换不得退化成把这段内容追加到旧内容之后。
- 替换进行期间，除替换自己以外没有读者推进偏移：追加在等 `replacePromise`，载入被第一条挡在替换之外，后来的清空或替换会先取消这一次。所以替换被拒后从原偏移重读，读到的仍是替换起点之后的内容。
- `consume()` 返回 false 时不写模型，也不移动任何偏移。多文件聚合要么所有文件一起前移，要么一个都不动。
- 读取取号到 `consume()` 之间不包含 `computeMoreMinimalEdits`。被拒之后 `this.etag` 仍是旧值，之后每一轮轮询都会再加一代数；差异计算若留在这段窗口里，大输出会一直被拒，排在后面的追加也一直等 `replacePromise`。
- 替换在飞时排进来的追加仍先等 `replacePromise`，之后只读替换已消费偏移之后的字节。
- 令牌已被 `cancelModelUpdate` 取消、通道模型 `_store` 已释放、`this.model` 已不是这次的文本模型或该模型已释放，三者任一成立时替换不再重读、不写模型。通道模型释放时 `modelUpdateCancellationSource` 只被释放，令牌不会被取消（`CancellationTokenSource.dispose` 默认不取消，`cancellation.ts` 第 128 行），所以要单独判断 `_store.isDisposed`。

要动的符号：

- `AbstractFileOutputChannelModel` 新增字段（例如 `placedModel`），记下初始内容已由 `loadModel` 放好的那个文本模型：在 `loadModel` 第 530 行 `placed = true` 的同一同步段里记下，在第 537–542 行 `onWillDispose` 回调里与 `this.model = null` 一起清掉。
- `AbstractFileOutputChannelModel.doUpdate`：在第 566 行 `!this.model` 判断旁边加上「`this.model` 不是 `placedModel` 就返回」。清空与替换照旧先 `cancelModelUpdate()`。
- `FileContentProvider.getContent`：返回值在 `consume` 之外加一个无副作用的预检（例如 `canConsume`），条件与 `consume` 相同：未消费过、代数相同、未释放、`endOffset === readOffset`。两个无操作分支的预检返回 true。
- `MultiFileContentProvider.getContent` 返回的 `consume`：先对所有文件预检，全部通过才逐个 `consume()` 并 `logEntries.push`；任一不通过就返回 false，不调用任何文件的 `consume()`。
- `AbstractFileOutputChannelModel.replaceContent`：读取与消费放进循环，消费成功后再算编辑。
- 文件：`src/vs/workbench/contrib/output/common/outputChannelModel.ts`。`IContentProvider.getContent` 的签名不变。

改法：

1. 先加载入闸。审查指出的竞态成立：`OutputService.onDidUpdateChannelSources`（`outputServices.ts` 第 557–562 行）同步调用 `MultiFileOutputChannelModel.updateChannelSources`，不等 `loadModelPromise`；`loadModel` 在第 517 行先建模型、再进第 520–532 行的循环，第 566 行的 `!this.model` 挡不住载入期间的替换。每次 `getContent` 都在第 229 行抬代数、在第 243 行比代数，替换循环与载入循环会互相作废、来回重读；若其中一边先消费成功，另一边从已推进的偏移读到空串，`getReplaceEdits` 第 664–665 行会把整份模型删掉。加闸之后，单文件 `update`（第 724–739 行）与多文件 `clear`（第 773–782 行）本来就等 `loadModelPromise`，`onDidContentChange` 的监听在放好内容之后才登记，这些路径不受影响；只有载入期间的 `updateChannelSources` 不再发起替换。它的 `reset()` 已经抬了代数，载入循环这一轮的读取被拒，下一轮按新的来源从头读，放进去的就是新来源的全量。`update` 的回调若恰好落在紧跟着开始的新一轮载入期间，闸同样挡住。
2. 再改多文件聚合的消费，使被拒时不移动任何文件的偏移。预检与逐个消费之间没有 await，单线程下这一步不会被轮询插进来。这一步是第 3 步的前提：不做的话，多文件替换被拒后重读，已接受的文件读到空串，替换会把模型换成只剩被拒文件的内容，比现在更糟。
3. `replaceContent` 改成循环：`getContent()` 返回后先判不变量最后一条的三个退出条件，任一成立就返回；然后立刻 `consume()`。成功就带着这段内容跳出循环；被拒就回到循环开头重读，偏移没动，仍从替换起点读。循环语义与 `loadModel` 第 520–532 行的 `while (!placed)` 一致。
4. 跳出循环后再 `getReplaceEdits`。算完先判三个退出条件，成立就返回、不写模型；这时偏移虽已前移，但会让这三个条件成立的一方都会自己重置偏移：`update` 的 `reset(till)` 或 `resetToEnd()`、`updateChannelSources` 的 `reset()`、文本模型 `onWillDispose` 里的 `reset()`；通道模型释放后不再读。`getReplaceEdits` 抛错时也先判这三个条件，不成立才用 `model.getFullModelRange()` 构造整段替换，不让已消费的内容在模型里缺席：`TextModel.getFullModelRange` 在 `textModel.ts` 第 1168–1169 行先断言模型未释放，模型已释放时调用会抛错。内容为空串时仍走 `getReplaceEdits` 现有的整段删除。
5. `modelUpdateInProgress` 仍在写入完成（或编辑为空）之后置回 false，提前返回的路径保持现状。

活性与边界：

- 活性：循环每一轮都要等一次读文件，不会空转占住主线程。有了第 1 步的闸，替换进行期间能让它被拒的只剩两种：轮询见到文件在上次成功消费之后又变了（`this.etag` 仍是旧值时每轮轮询都会抬代数），以及文件变短时的 `reset(0)`。轮询约 500ms 一次，一次读取通常远短于这个间隔，下一轮重读就会成功。读取若长期慢于轮询间隔而文件又在持续变化，循环会一直重读；这和 `loadModel` 的重读循环、被拒后靠下一轮轮询重试的追加是同一性质，本条不加次数上限。
- 文件在读取阶段变短：`doWatch` 第 202–204 行的 `reset(0)` 让这次读取被拒，重读从 0 开始，替换结果就是变短后的整份文件；`_onDidReset` 排进来的追加等替换结束后读到空串。
- 文件在差异计算阶段（已经消费之后）变短：替换仍写入已消费的那段旧内容，`reset(0)` 之后排队的追加再从 0 读整份文件接在后面。上游在这个时序下同样出错，本条不处理；`onDidContentChange` 在替换进行中跳过清空的判断（第 556–558 行）保持不变。

明确不改什么：

- 不改 `doWatch` 在 etag 变化时抬代数（`e5fbc1ca4bc` 引入），不改轮询时不更新 `this.etag`（第 201 行注释，r11-3），不改 500ms 轮询，不改文件变短时 `reset(0)` 再 `_onDidReset`。
- 不把 `consume()` 改成返回拒绝原因。审查给的另一个方向是区分拒绝原因；第 1 步的闸已经去掉替换期间唯一会推进偏移的另一个读者，剩下的拒绝都该从原偏移重读，不必改 `IContentProvider` 和三个调用点。
- 不改单文件 `consume` 的判定条件；不改 `appendContent` 先等 `replacePromise`、`consume()` 为 false 时不写；`loadModel` 只多记一处「已放好」，重读循环本身不改。多文件聚合改成全有或全无之后，追加与载入在多文件上自然不再丢段，代码不动。
- 不改 `isVisible()` 的含义，也不改 `MultiFileOutputChannelModel.updateChannelSources` 里停止轮询、`updateFiles`、`reset()`、发起替换、重启轮询的顺序；载入期间它仍会启动轮询，这是现状。
- 不改 `FileOutputChannelModel.update` 替换前的 `reset(till)` / `resetToEnd()`。
- 不改扩展端 `ExtHostOutputChannel.replace`（`extHostOutput.ts` 第 63–70 行）的写入与 `$update` 顺序，不改 `OutputChannelBackedByFile` 与 `DelegatedOutputChannelModel`。
- 不改输出面板与四个面板命令在默认窗口的门控，也不改「Developer: Open Log...」在默认窗口可用。保持 `src/vs/workbench/contrib/output/test/browser/output.contribution.test.ts` 的 `Output panel view is gated to Agents Window` 与 `Output panel commands do not run outside the Agents Window`。
- 保持 `src/vs/workbench/contrib/output/test/browser/outputChannelModel.test.ts` 的 `skips appending a file read that lost its content generation` 和 `Logs Parsing` 下的解析测试。

本地验证：

- 在 `outputChannelModel.test.ts` 新增用例。读文件桩要按 `options.position` 截取、按资源分别保存内容：现有用例的桩（第 161–168 行）返回整段内容，`TestFileService.readFile` 也不看 `position`、所有资源共用一份内容，不能直接复用。`IEditorWorkerService` 要桩成 `computeMoreMinimalEdits` 原样返回传入的编辑：工作台测试默认注入的 `TestEditorWorkerService` 返回 `undefined`，`getReplaceEdits` 会得到空数组，替换在测试里看不出来。这些用例都从 `loadModel`、`update`、`updateChannelSources`、`dispose` 这些入口进，接线就在用例里。
- 回归用例（改动前失败，改动后通过）：
  - 单文件替换被拒：`FileOutputChannelModel` 载入 `old\n` 后，把文件改成 `old\nnew\n` 并换 etag，调用 `update(OutputChannelUpdateMode.Replace, <old\n 的字节长度>, true)`；挂住这次读取，等至少一轮轮询结束再放开。断言模型最终等于 `new\n`，`new` 只出现一次，不含 `old`。改动前这条得到 `old\nnew\n`。
  - 多文件部分接受：`MultiFileOutputChannelModel` 两个来源，内容用日志行格式（`YYYY-MM-DD HH:MM:SS.mmm [info] ...`），因为 `combineLogEntries` 只保留能解析的日志行。两份文件都追加新行后，挂住其中一份的读取，期间只让这一份的轮询加一代数（另一份的 stat 桩仍报上次消费时的 etag），制造部分接受；放开后两份新行在模型里各出现一次。改动前未挂住的那份新行会丢。
  - 多文件替换：对 `updateChannelSources` 加入第三个来源的替换做同样的挂起，挂住要超过约 500ms，等重启后的第一次轮询；第三个来源的时间戳要与前两份交错，否则接在末尾和按时间合并看起来一样。断言替换后的模型等于三个来源按时间合并的结果，没有接在旧内容后面。
- 载入闸的用例（审查要求）：`MultiFileOutputChannelModel` 两个来源，挂住 `loadModel()` 的读取；此时调用 `updateChannelSources` 加入第三个来源；放开后断言模型等于三个来源按时间合并的结果、每行只出现一次、没有被整段删空；放好内容之前 `computeMoreMinimalEdits` 桩没有被调用（替换没有在载入期间发起）；放开后一段时间内读文件次数不再增长（没有来回重读）。改动前这条在「`computeMoreMinimalEdits` 没有被调用」上失败；只加循环、不加闸时会来回重读或删空。
- 循环守卫（改动前后都应通过，只防新循环出错，不能证明 r14-2 已修）：
  - 取消：替换的读取挂住期间，按扩展端 `clear()` 的方式调用 `update(OutputChannelUpdateMode.Clear, <当时文件字节长度>, true)`；放开后替换不写模型，模型保持为空，之后只出现清空之后再写进文件的字节。
  - 释放：替换的读取挂住期间 dispose 通道模型；放开后读文件次数不再增长，循环不会在释放后一直重读。
- 顺序：先 `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`），因为 `scripts/test.sh --run` 加载的是 `out/` 下的编译产物；再 `scripts/test.sh --run src/vs/workbench/contrib/output/test/browser/outputChannelModel.test.ts` 与 `scripts/test.sh --run src/vs/workbench/contrib/output/test/browser/output.contribution.test.ts`；最后 `npm run eslint`。

## 实施前提与提交

1. 方案提交与实施提交分开（`docs/DOCUMENTATION.md` 规则 13）。本稿签收后、方案提交时把它登记进 `dev/plans/INDEX.md`，并跑 docs-health：`python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`，以及 `dev/progress/health-gates.md` docs-health 一栏另列的 `python3 scripts/generate-docs-status.py --check` 与 `python3 -m unittest scripts/tests/test_docs_status.py`。本轮只改本稿，不动 INDEX。
2. 实施前先在当时的 HEAD 上编译，并跑一遍要动到的测试文件和读 `searchEditor.ts` 的扫描测试，记下基线。按读码（本次未运行），其中已有几条与源码不符：`splashUpdateCarouselCustomEditorSearchLeftoverPromiseCatchScan.test.ts` 的 `searchEditor leftover ongoingSearchOperation then is Promise double-chain` 仍断言旧的三参数 `onSearchComplete` 签名和两层 catch；`chatPlanReviewLeftoverPromiseCatchScanD856.test.ts`、`chatWidgetLeftoverPromiseCatchScanD861.test.ts`、`agentSessionsControlLeftoverPromiseCatchScanD866.test.ts`、`chatLeftoverPromiseCatchScanD943.test.ts` 仍断言 `this.triggerSearch({ delay })` 带两层 catch，而 `bab03390c09` 已把两层收成一层。这些红按 `health-gates.md`「既有基线失败」处置，标明 baseline SHA，不归因给本条，也不在本条里改；D17 里还没有记的，由实施方按该文件记到 D17 下，不新开编号。
3. r14-1 与 r14-2 改的文件不相交，可以分两个实施提交，各自先编译、再跑测试、最后 eslint（见各条「本地验证」）。两条都不碰 conversation、sources、universeAgent，`scripts/run-unit-custom.sh` 不是这两条的验证入口。
4. 实施只改代码与测试，不改 `docs/`。实施中若改了文档，再跑第 1 步的 docs-health。提交前按 `AGENTS.md` 跑 `python3 scripts/wiki/wiki.py remind --root .`，按提示更新文档，或在提交说明末段写 `Docs-Reviewed:`。

## 审查

2026-11-07 只读审查的结论是须改稿。Critical 已改：C1 指出 r14-2 的替换循环会和 `loadModel` 的重读循环互相作废，或在对方消费之后读到空串、把整份模型删掉；核实属实（`outputServices.ts` 第 557–562 行同步调用 `updateChannelSources`，`outputChannelModel.ts` 第 517 行先建模型，第 229、243 行抬代数与比代数，第 664–665 行空串整段删除）。r14-2 新增改法第 1 步的载入闸，不变量、要动的符号、活性与边界、明确不改什么随之调整，并补了载入期间调用 `updateChannelSources` 的用例；没有采用「区分拒绝原因」，理由写在「明确不改什么」。Important 已改：I1 核实 `dialogsLeftoverPromiseCatchScanD795.test.ts` 第 182 行断言 `newInput.ongoingSearchOperation.then(complete => {` 存在，r14-1 改为补放回调与 `onSearchComplete` 参数表都不动，改从输入上读 operation 做归属判断，并写明不加任何 `Dxxx` 标记、不新增 catch 链。I2 已改：r14-1 把归属簿记放进可单测的状态对象，按面板调用顺序写用例，列出单测不覆盖的三处接线，另给可选的面板级用例；r14-2 的用例本来就从模型的入口进，写明了这一点。Minor 已改：r14-2 第 4 步改为先判退出条件、再调用 `getFullModelRange()`（`textModel.ts` 第 1168–1169 行）；文件变短的两种时序和活性写进「活性与边界」；r14-1 在调用 `searchModel.search` 之前先把归属置空；归属复查移到第 674 行关闭引用窗口与第 677 行序列化之前；取消与释放两条用例标成循环守卫。「D851 的替换文字」一条因补放回调不再改动而不需要处理。审查之外一并处理：本地验证改为先编译、再跑测试、最后 eslint；「覆盖需求」写明不对应的原因；新增「实施前提与提交」，写明方案提交时登记 `dev/plans/INDEX.md`。

## 实施记录（2026-11-07）

用户同意实施并要求不编译。两条 hold 都已落到代码，没有 drop 条目。改动基于 HEAD `841ea38816d` 的工作区；改动前 `contrib/searchEditor` 与 `contrib/output` 两个目录都没有别人的未提交改动，改的文件都是先读再做针对性替换，没有整文件重写。工作区里别的会话的未提交改动（例如 `dev/plans/INDEX.md`、`src/vs/workbench/test/browser/` 下的几份测试）一处没碰，本条实施也不依赖它们。

r14-1，已实施：

- `src/vs/workbench/contrib/searchEditor/browser/searchEditorResultOwner.ts`（新增）：状态对象 `SearchResultOwner`，四个操作 `searchStarting`、`searchStarted`、`owns`、`decideAttached`；三种结果用 `AttachedSearchDecision`（`Handled`、`NotOwned`、`Owned`）表示。只依赖 `ISearchComplete` 类型。
- `src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts`：导入状态对象，新增字段 `searchResultOwner`；`doRunSearch` 在调用 `searchModel.search` 之前调 `searchStarting()`，在给 `startInput.ongoingSearchOperation` 赋值的同一同步段里调 `searchStarted(operation)`；`onSearchComplete` 在补放守卫之后、清理之前读输入上的 operation 交给 `decideAttached`，在第二处序号检查之后、关闭引用窗口和序列化之前复查序号与 `owns`。改动纯增量（28 行），`setInput` 的补放段与 `onSearchComplete` 参数表逐字未动，没有新增 catch 链或 `Dxxx` 字样。改动后这两处判断在 `searchEditor.ts` 的第 659–671 行与第 692–700 行。
- `src/vs/workbench/contrib/searchEditor/test/browser/searchEditorResultOwner.test.ts`（新增）：按面板调用顺序驱动状态对象的五条用例，覆盖方案「本地验证」列出的五种情形。
- 与方案的出入：没有。可选的面板级用例没有做，原因是方案已把它列为非门禁，且不编译无法确认那套搭建能跑；单测不覆盖的三处接线照方案由编译、eslint 与提交审查把关。

r14-2，已实施：

- `src/vs/workbench/contrib/output/common/outputChannelModel.ts`：`FileContentProvider.getContent` 的返回值加无副作用预检 `canConsume`，与 `consume` 共用同一个判定，两个无操作分支返回 true；`MultiFileContentProvider.getContent` 的 `consume` 改为先全部预检、全部通过才逐个消费并登记日志条目；`AbstractFileOutputChannelModel` 新增 `placedModel`，在 `loadModel` 放好内容时记下、在 `onWillDispose` 里清掉，`doUpdate` 在模型还没放好内容时返回；`replaceContent` 改成先读再立刻认领、被拒就重读的循环，认领之后再算编辑；新增 `isReplaceAbandoned` 统一判断令牌取消、通道模型释放、文本模型换掉或释放。
- `src/vs/workbench/contrib/output/test/browser/outputChannelModel.test.ts`：新增 suite `Output channel model replace`，六条用例：三条回归用例（单文件替换被拒、多文件部分接受、加入新来源后的多文件替换），一条载入闸用例，两条标了 `(loop guard)` 的循环守卫（清空、释放）。读文件桩按资源与 `options.position` 截取，`computeMoreMinimalEdits` 桩成原样返回传入的编辑，并用来数调用次数。原有 suite 与 r11-3 的用例未改。
- 与方案的出入：差异计算抛错时，除按方案先判退出条件、再退回整段替换外，还用 `onUnexpectedError` 报出这个错误。原来这类错误会让 `replacePromise` 以未处理的拒绝结束，退回整段替换之后不再拒绝，报一次可以保留可见性；取消类错误 `onUnexpectedError` 本身会忽略。新用例沿用 r11-3 用例的真实计时写法，六条合计约多出 10 秒。

没有做的部分：没有登记 `dev/plans/INDEX.md` 与 D17（按分工由父 agent 统一写）；没有建立测试基线（不编译跑不了）。

未编译、未跑测试、未跑 eslint 与 docs-health。之后要跑的本地验证，按顺序：

1. `npm run compile`（只看这两条的 TypeScript 时可用 `npm run compile-client`）。
2. `scripts/test.sh --run src/vs/workbench/contrib/searchEditor/test/browser/searchEditorResultOwner.test.ts`、`scripts/test.sh --run src/vs/workbench/contrib/searchEditor/test/browser/searchEditorModelResolve.test.ts`、`scripts/test.sh --run src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD851.test.ts`、`scripts/test.sh --run src/vs/workbench/services/dialogs/test/node/dialogsLeftoverPromiseCatchScanD795.test.ts`。
3. `scripts/test.sh --run src/vs/workbench/contrib/output/test/browser/outputChannelModel.test.ts`、`scripts/test.sh --run src/vs/workbench/contrib/output/test/browser/output.contribution.test.ts`，以及读 `outputChannelModel.ts` 的扫描测试：`src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScan.test.ts`、`outputLeftoverPromiseCatchScanD844.test.ts`、`outputLeftoverPromiseCatchScanD864.test.ts`。
4. `npm run eslint`。
5. 方案稿改过，跑 docs-health：`python3 scripts/check-docs-health.py`、`python3 scripts/wiki/wiki.py check --root .`。

跑测试时按读码已知的既有红（本次未运行，不归因给本条）：「实施前提与提交」第 2 步列出的 splash 与 D856、D861、D866、D943 几份扫描测试；另外 `src/vs/workbench/contrib/debug/test/node/debugOutputExtensionsLeftoverPromiseCatchScan.test.ts` 仍断言输出模型两处 `loadModelPromise.then` 带两层 catch，`src/vs/workbench/contrib/logs/test/node/logsLeftoverPromiseCatchScanD764.test.ts` 仍断言 `DelegatedOutputChannelModel` 旧的单行两层 catch 写法，`fbfb084b5d6` 已把这些收成一层并改成多行。本次没有改动这几段被断言的代码。

### 代码审查（2026-11-07）

只读代码审查的结论是可接受，只有 Minor，处理如下：

- 多文件部分接受用例在旧代码上不一定变红：已改。`second.statEtag = undefined` 从 `release()` 之后挪到等到期望内容之后，整个读取与重试期间第二份文件的轮询都不抬代数，旧代码上只有它被单独前移、`two-d` 丢掉，用例稳定变红；新代码上重试成功之后它的 etag 已是新值，复位不再触发多余的读取。
- `updateChannelSources` 在载入期间仍重启轮询：不改。本稿「明确不改什么」保留了这个现状，本轮改动只到方案列出的符号。它让尚未消费过的来源（etag 仍是空串）在载入期间每轮轮询都抬代数，来源多、日志大时载入会被作废几次。后续可另立一条：给 `AbstractFileOutputChannelModel` 加一个受保护的「已放好内容」判断，`MultiFileOutputChannelModel.updateChannelSources`（第 796–804 行）只在已放好时重启轮询，`loadModel` 放好内容后本来就会调用 `watch()`。
- `searchEditor.ts` 补放读的是回调触发时输入上的 operation：不改。它与挂接时不同，只可能是同一输入又发起了新搜索；在本面板里会先被第 655 行的序号守卫挡下，跨面板则要求同一输入同时是两个面板的当前输入，拆分走 `SearchEditorInput.copy()` 不会出现，保留现状。
