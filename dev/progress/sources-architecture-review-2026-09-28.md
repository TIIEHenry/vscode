---
title: "Sources 架构审查（2026-09-28）"
type: progress
status: draft
phase: M7
updated: 2026-09-28
summary: "SOURCES_PART 与 contrib/sources 只读架构审查，8 条（SAR-1…8）。最重：引擎 Diff 的 sources-git-diff 模型没有内容提供者，三种宿主都解析失败。实施方案 sources-architecture 于 2026-09-28 签收，未实施。"
---

# Sources 架构审查（2026-09-28）

> **范围**：`src/vs/workbench/browser/parts/sources/` 与 `src/vs/workbench/contrib/sources/`（`common/`、`browser/`、测试），以及它们直接依赖的 text model resolver、Explorer 模型、layout 与 conversation 接口。只读审查，没有改产品代码。实施方案：[sources-architecture](../plans/sources-architecture.md)（2026-09-28 签收，未实施）。
> **基线**：HEAD `1145bce61de`，下文行号以此为准。以 `common/`、`browser/`、`test/` 开头的路径都在 `src/vs/workbench/contrib/sources/` 下；其余路径相对 `src/vs/`，另有注明的除外。
> **对照**：[Sources 系统概览](../../docs/systems/sources/overview.md) · [ADR-005](../decisions/005-changes-diff-owner.md) · [sources-review-open-identity](../plans/sources-review-open-identity.md) · [sources-accept-stage-hunk](../plans/sources-accept-stage-hunk.md) · [bug-hunt 15](bug-hunt-2026-09-24/15-sources-changes.md) / [16](bug-hunt-2026-09-24/16-sources-review-diff.md) 与[对应方案](../plans/bug-hunt-2026-09-24/INDEX.md)。
> **编号**：SAR-N（Sources Architecture Review）。字段沿用 bug-hunt：严重度、置信度、位置、现状、影响、已知、方向。

## 用词

下列说法不在 [glossary](../../docs/glossary.md) 里。本文正文用左列，代码与旧文里的叫法见中列。

| 本文写法 | 代码 / 旧文 | 含义 |
|----------|-------------|------|
| 引擎读 | git-read、`ReadGit*` | 经引擎 `ReadGitChanges` / `ReadGitSummary` / `ReadGitFileDiff` 读变更 |
| 本地 SCM 回退 | SCM fallback、local-only | 引擎列表不可用时，改为投影本地 `ISCMService` |
| 保留旧行 | leftover、KEEP | 读失败、断连或接口消失后，继续显示上一次成功读到的行 |
| 配对等待 | pairing-hold | 连接阶段已是 connected，但仍在配对确认，按不可写处理 |
| 列表读失败态 | list-fail、`leftoverListFailed` | 引擎读抛错后仍显示保留旧行的状态；此时写入与 `ReadGitFileDiff` 打开都关闭 |

## 结论

骨架是对的：Part 只提供 tab 与 content 两个槽，contrib 在两个槽都注册后挂载三个列表；`common/` 没有反向依赖 `browser/`；Diff 归属按 `sources.diff.defaultOwner` 分派，与 ADR-005 一致。

问题在于领域状态没有归属。引擎连接状态、引擎读与本地 SCM 回退之间的仲裁、写闸门、变更身份，全部长在 Changes 列表、Review 列表和两个 Diff 宿主这四个视图类里，已经复制成多份并开始分叉（SAR-2、SAR-4、SAR-6）。已有方案在其中一份上修，另一份照旧。

最高风险是 SAR-1，已在运行时证实：引擎 Diff 在 Preview、Conversation、Panel 三处都打不开，而 sources 套件 254 条单测全绿。它现在恰好挡住了一个违反 overview §4 的 Accept 载荷，所以修复必须与 accept-stage-hunk 的 S0 同一切片。

8 条里，SAR-1 与 SAR-8 在既有文档里完全没有记录；其余 6 条的主体也未见记录，但与 bug-hunt 15/16、open-identity、accept-stage-hunk 有局部重叠，重叠处写在各条「已知」里。

## 发现

### SAR-1 引擎 Diff 模型没有内容提供者，三种宿主都打不开

- 严重度：high
- 置信度：高（运行时已证实，见「验证」）
- 位置：`browser/sourcesChangeEntryOpen.ts` 的 `applySourcesGitFileDiffIfNeeded`、`sourcesGitDiffModelUri`、`writeSourcesGitDiffModel`（L74-126）。取模型的三处：Preview 经 `workbench/common/editor/textResourceEditorInput.ts` L170；Conversation 在 `browser/conversationDiffReviewPane.ts` L562-563；Panel 在 `browser/sourcesDiffPanelView.ts` L693-694。抛错点在 `workbench/services/textmodelResolver/common/textModelResolverService.ts` L91-98。
- 现状：`ReadGitFileDiff` 的结果被拆成两侧文本，用 `sources-git-diff:` URI 直接写进 `IModelService`。全仓没有为这个 scheme 注册 `ITextModelContentProvider` 或文件系统提供者。三种宿主都经 `ITextModelService.createModelReference` 取模型；它对未注册的 scheme 先尝试激活文件系统提供者，失败后抛 `Unable to resolve resource`，不会去 `IModelService` 里找已有模型。
- 影响：Preview 打开失败；Conversation 与 Panel 显示 "Unable to load this comparison."。引擎 Diff 这条路径在 HEAD 上整条不可用。
- 触发：本地 quickDiff 给不出原始版本的引擎行，即 `needsSourcesGitFileDiff` 为真（`common/sourcesChangesGitRead.ts` L83-88）。包括本地没有对应文件的远端引擎行，以及本地未跟踪的新文件。
- 测试为何没发现：`test/browser/sourcesChangesList.test.ts` L192-225 桩掉了 `openEditor` 与 `modelService`，只断言传给 `openEditor` 的 URI 含 `sources-git-diff`。Panel 与 Conversation 的测试从未渲染这种 URI。
- 附带的生命周期问题：成功路径上的模型从不释放，每打开一个文件就留下一对模型，直到窗口关闭。失败路径的 `disposeSourcesGitDiffModels`（L203-212）按 path 与 indexState 销毁模型；同一文件连开两次时，被取代的旧请求会在 Panel 那边被记成失败（BH-16-4），然后把新请求正在用的同名模型一并销毁。
- 已知：否。已签收的 open-identity 方案 S3 写「model URIs：`sources-git-diff:`（`createModelReference` 继续用这个）」，建立在同一个错误假设上。accept-stage-hunk 的「HEAD 要先拆的传递」一节写 Accept「按钮能显示」；按本条，HEAD 上带载荷的变更引用都会加载失败，两个宿主随之隐藏写按钮，按钮实际显示不出来。这不改变 S0 的必要性。
- 方向：在 `browser/sourcesDiff.contribution.ts` 注册该 scheme 的内容提供者，背后放一个按引用计数持有模型的 store，由 store 而不是打开函数决定模型何时销毁。补一条走真实 `TextModelResolverService` 的测试。
- 顺序约束：一旦 Diff 能加载，Accept 就会出现，并把整段 `unifiedDiff` 当 `patches`、`argv` 传空数组（`browser/sourcesDiffPanelView.ts` L591-600，`browser/conversationDiffReviewPane.ts` L470-479）。这违反 overview §4，也正是 accept-stage-hunk S0 要拆的东西。S0 必须先落，或与本条同一切片落。

### SAR-2 变更读仲裁与写闸门没有唯一持有者

- 严重度：high
- 置信度：高
- 位置：`browser/sourcesChangesList.ts` 的 `refresh`（L664-762）与 `isSourcesGitWriteClosed`（L518-520）；`browser/sourcesReviewList.ts` 的 `refresh`（仲裁段 L710-795）；`browser/sourcesTabsHost.ts` L153-161；`browser/sourcesReviewCommands.contribution.ts` L37-92；`common/sourcesReviewHostService.ts` L13-25；`common/sourcesChangesGitWrite.ts` L41-43、L257-274；`test/node/sourcesWiringScan.test.ts` L23-34。
- 现状：Changes 与 Review 两个视图类各自维护一份相同的状态：是否在用引擎读（`usingGitRead`）、保留旧行、列表读失败态（`leftoverListFailed`）、刷新序号，以及三段相同的配对等待分支。两个 Diff 宿主和 Review 命令拿不到这份状态。
- 已出现的后果：
  1. 同一缺陷有两份，现有方案只修一份。BH-15-6（本地 SCM 回退的行被一次引擎读抛错关掉写入）在 Review 里有同一段逻辑：`sourcesReviewList.ts` L787-792 只要已有行就置 `leftoverListFailed`，不看这些行是不是引擎读来的。之后 `isSourcesGitFileDiffOpenSkipped`（L365-374）为真，`onDidOpen` 在 L599-601 直接返回，本地 SCM 行点击无反应，已审标记也关闭。bug-hunt 15 号方案 S5 只改 Changes。
  2. Diff 宿主把 `leftoverListFailed` 硬编码为 `false`（Panel L481、L488、L531、L597；Conversation L374、L381、L416、L476）。D443「列表读失败态拒绝 Accept」在唯一有 Accept 的地方从不生效；宿主里的 Stage 也绕过了列表那一侧的关闭。
  3. Review 的 Open Selected 命令经 `ISourcesReviewListHost` 伸进视图读私有闸门，再把打开与标记流程复刻一遍。这个接口暴露了 `isSourcesGitFileDiffOpenSkipped`、`isSourcesGitWriteClosed`、`readGitFileDiff`、`setStatusMessage` 等视图内部。
  4. 两个列表在 `SourcesTabsHost` 构造时一起创建，与当前 tab、与 Sources 是否可见都无关，并订阅同一组事件。每次触发两边各发一次 `ReadGitChanges`，有条目时再各发一次 `ReadGitSummary`。Review 还订阅归因服务（L328），引擎每批文件变更都让它多刷一轮。`ReadGitSummary` 的返回值两边都丢弃（`common/sourcesChangesGitRead.ts` L337 之后无人读取），只用它的抛错当失败信号。
- 维护成本：闸门函数用最多 5 个带默认值的位置布尔参数表达状态（`isSourcesGitWriteLive`、`tryWriteSourcesGitApplyHunks` 等），参数传错顺序编译器不报错。`sourcesWiringScan.test.ts` 约 150 处源码文本断言，要求两个视图文件都包含 `tryLoadSourcesGitChangeEntries` 等标识符，等于把这份重复写成了测试契约。
- 已知：部分。BH-15-6 只记了 Changes；Review 同胞、Diff 宿主的闸门缺口、重复请求与 `ReadGitSummary` 被丢弃，未见记录。
- 方向：抽一个 `ISourcesChangesModel` 服务，作为变更条目、仲裁、保留旧行、失败态和条目身份的唯一持有者，状态用判别联合表达（例如 `scm`、`engine-live`、`engine-leftover{reason}`）。Changes 与 Review 只做投影；Diff 宿主与命令从同一服务读闸门；写闸门改成接收状态对象的单一函数。接线扫描改为行为测试。BH-15-6 的修复落在模型上，两个 tab 同时生效。

### SAR-3 Files 经 Explorer 的共享模型遍历整个工作区

- 严重度：high
- 置信度：高（代码路径）；真实工作区上的耗时未测
- 位置：`common/sourcesFilesModel.ts` 的 `collectSourcesFileEntries` / `collectFromItem`（L29-71）；`browser/sourcesFilesList.ts` L126-129 与 `refresh`（L185-237）；相邻的 `workbench/contrib/files/browser/views/explorerViewer.ts` L1446-1462、`workbench/contrib/files/common/explorerModel.ts` L328-333；`workbench/browser/workbench.ts` L353-361。
- 现状：对每个未解析目录顺序 `await item.fetchChildren()`，把整个工作区压平成一张表。启动时执行一次，此后每次 `onDidFilesChange` 再执行一次。没有取消，文件频繁变更时多轮遍历会叠在一起，旧轮的结果只是被序号丢弃。所有 Part 在 `workbench.ts` L353-361 无条件创建，Sources 收起时这套遍历照样运行。
- 为何范围失控：`ExplorerItem.isExcluded` 只由 Explorer 树的过滤器在评估到某一项时设置。`node_modules` 不在默认 `files.exclude` 里，会被整棵遍历；Explorer 视图从未渲染时，连 `.git` 也不会被标记排除。
- 副作用：`fetchChildren` 把结果合并进 Explorer 的共享模型，Explorer 因此在内存里常驻整棵树。代码还读取带下划线的内部字段 `_isDirectoryResolved`。任何一个不可读目录都让整张表进入失败态。
- 已知：部分。BH-15-4（嵌套文件列两次）与 BH-15-5（增删工作区文件夹不刷新）是同一数据源上的正确性缺陷，15 号方案 S3、S4 在现有遍历上修补；规模问题未见记录。
- 方向：改用 `ISearchService` 的文件搜索（遵循 exclude 与 gitignore，可设上限、可取消），不改写 Explorer 的模型。换数据源后，BH-15-4、BH-15-5 不再需要单独修。

### SAR-4 条目变成变更引用时丢身份，读与写的路由各自判定

- 严重度：medium
- 置信度：高
- 位置：`common/sourcesChangeRef.ts` 的 `ISourcesChangeRef`（L12-19）与 `sourcesDiffLocalWritePath`（L86-95）；`browser/sourcesChangesList.ts` 的 `canWriteStage`（L538-547），以及 `runOnEntries`、`runResourceAction`、`tryStagePaths`（L948-1032）。
- 现状：变更引用（`ISourcesChangeRef`）不带 `gitPath`、`indexState`，也不带打开时的会话。拿到引擎 Diff 之后，`modified` 换成 `sources-git-diff:`，Diff 宿主 Stage 时 `sourcesDiffLocalWritePath` 返回空串。这些分别是 open-identity S3 与 bug-hunt 16 号方案 S1（BH-16-1，写请求跟随切换后的会话）的范围。
- 既有方案没覆盖的一点：引擎已连接、但 `ReadGitChanges` 返回空列表时，列表走本地 SCM 回退。`canWriteStage()` 不看列表来源，Stage 仍先发给引擎，路径取 `entry.gitPath ?? entry.resource.fsPath`，对本地 SCM 行就是本地绝对路径（L954、L974）。引擎工作目录与本地仓库不是同一份 checkout 时（远端引擎、另一个 worktree），写入失败；结果为 `failed` 时不回落到 `git.stage`，用户在 Sources 里暂存不了眼前看到的本地变更。
- 已知：部分。身份与会话见上；commit 只落第一个仓库是 BH-15-1，已由 09-25 裁定收口。读与写路由不一致，未见记录。
- 方向：写路由跟随条目来源：引擎行走引擎写，本地 SCM 行走本地命令。条目、变更引用与 Diff Input 携带同一份身份（来源、`gitPath`、`groupId`、会话），与模型 URI 分开；这份身份由 SAR-2 的模型产出，不由各视图各自拼。

### SAR-5 Review 进度的身份与生命周期

- 严重度：medium
- 置信度：高
- 位置：`browser/sourcesReviewProgressService.ts` 的 `resolveKey`（L78-84）、`getScopeKeyId` 与 `resolveContentHash`（L99-115）、`pruneMissingKeys`（L86-97）、文件变更监听（L35-42）、`invalidateResource`（L117-138）；`browser/sourcesReviewList.ts` 的 `ensureEntryKeys`（L446-460）。
- 现状与影响：
  1. 进度 key 由本地 SCM 根、URI 与本地 etag 组成，失效只靠本地 `IFileService.onDidFilesChange`。行来自远端引擎时，文件在引擎侧改了，「已审」不会失效。
  2. 每轮刷新都用当前条目集调用 `pruneMissingKeys`。远端引擎断连、回退后本地没有对应变更，或切到另一个会话，全部已审标记就被清掉。Review 顶部的提示是 "Review progress stays in this window."，与这一行为不符。
  3. 没有任何已审条目时，每个变更文件也会先 `stat` 再比较前缀。一次 `git checkout` 或依赖安装就是成千上万次 I/O。
- 已知：部分。BH-16-5（过期轮次在 await 之后清理）由 16 号方案 S4 处理；正常轮次因条目集变化而清理、远端内容变化不失效、`stat` 开销，未见记录。
- 方向：引擎行的失效以引擎侧信号为准（例如归因服务已经消费的 `onDidFileMutation`），不只靠本地文件监听。清理只在「同一会话、同一来源、读成功」的轮次执行，或改为按会话分桶保存。`invalidateResource` 先查前缀，没有命中就不 `stat`。

### SAR-6 Diff 宿主与打开路径各有两份，协作靠模块级隐式通道

- 严重度：medium
- 置信度：高
- 位置：`browser/sourcesDiffPanelView.ts`（766 行）与 `browser/conversationDiffReviewPane.ts`（644 行）；`browser/sourcesChangeEntryOpen.ts` L128-201 与 `browser/sourcesDiffRefHelpers.ts` L47-77；模块级容器 `common/sourcesChangeRef.ts` L21、`browser/sourcesDiffPanelView.ts` L69、`browser/sourcesChangeEntryOpen.ts` L27。
- 现状：
  1. 两个宿主的 Stage、Accept、Revert、Unstage 逻辑基本重复，而且已有差异。Panel 在 Revert、Unstage 成功后用显式标记立刻隐藏按钮（L171-176）；Conversation 只对引擎 Stage 有这个标记，Revert、Unstage 之后只在 `finally` 里按实时 SCM 状态重算，而它不订阅 SCM 变化，git 扩展异步刷新状态之前按钮会留着。Panel 找不到实时 SCM 匹配时回退到打开时带来的 `scmResource`，Conversation 不回退。
  2. 行点击的分派与 Move 命令是两套「按归属打开」。前者对有 SCM 资源的行走 `scmResource.open()`，并检测 Conversation 与 Panel 的加载失败；后者一律走 `openEditor`（Preview 的 Diff 固定 pinned），也不检测加载失败。
  3. 跨模块协作靠三个模块级容器：挂在 EditorInput 上的 Accept 补丁 `WeakMap`；Panel 加载结果的 `WeakMap`（打开函数等它，视图去兑现它）；从不清理的 `ReadGitFileDiff` 请求序号 `Map`。最后一个判定请求过期后并不中止，而是返回不带引擎 Diff 的变更引用，于是被取代的那次打开仍会执行，打开文件本体，可能盖掉新一次打开的 Diff。
- 已知：部分。BH-16-3（搬家按菜单宿主取引用，16 号方案 S3）与 BH-16-4（Panel 加载结果误判失败，归 open-identity S1）；accept-stage-hunk S0 会拆掉补丁的 `WeakMap`。宿主重复、两套打开实现与请求序号的行为，未见记录。
- 方向：抽一个与 UI 无关的写动作控制器（数据来自 SAR-2 的模型），两个宿主只负责渲染。用一个 `open(ref, owner, options)` 服务统一行点击与 Move，把「这次比较是否画上」做成它的返回值（open-identity S1 已要求 `Promise<boolean>`），去掉模块级容器。

### SAR-7 跨 contrib 耦合与平台契约

- 严重度：medium
- 置信度：高
- 位置：sources 侧 6 个文件从 `workbench/contrib/conversation/browser/conversationStubService.ts` 取 `IConversationRosterService`，从同目录 `conversationSessionStatus.ts` 取 `isConversationPairingHold`；conversation 侧 5 个文件 import sources，其中 `workbench/contrib/conversation/browser/conversationLensReadingColumn.ts` L18；`workbench/services/editor/common/editorGroupFinder.ts` L13-14 与仓根 `eslint.config.js` L1907-1914；`browser/sourcesReviewAttributionService.ts` L30-37、L43、L74-76。
- 现状：
  1. Sources 只需要当前引擎会话 id、会话是否就绪、是否处于配对等待这三样，却依赖 Conversation 的 roster 服务。反方向，conversation 为了一个命令 id 常量 import 了 `sourcesReview.contribution.js`，把整组 `registerAction2` 与 `registerSingleton` 的副作用一起带进来。两个 contrib 互相依赖。
  2. 核心服务 `editorGroupFinder.ts` 依赖 `contrib/sources/common/conversationDiffReviewInput.js`。这是 eslint 有意放行的，但说明这份类型与 id 实际上是编辑器路由的核心 API，却由 sources 持有。
  3. 平台接口上的 `onDidFileMutation` 声明为 `Event<void>`，归因服务用 `as unknown as` 强转成带载荷的事件，代码注释说明这是临时态。归因记录 `buckets` 按会话只增不减，Review 每轮刷新都对每个条目扫描全部记录。
- 已知：eslint 放行与强转注释是作者已知的；依赖方向与记录增长，未见记录。
- 方向：把会话上下文收进一个独立服务（放在 services 或 platform 层，conversation 与 sources 都只依赖它）；把 `ConversationDiffReviewInput` 的类型与 id 移到编辑器路由所在的共享位置；命令 id 常量放进 `common/`；给 `onDidFileMutation` 正式的载荷类型，归因记录设上限或按路径建索引。

### SAR-8 Part 的 focus 写死了 contrib 的 DOM

- 严重度：low
- 置信度：高
- 位置：`workbench/browser/parts/sources/sourcesPart.ts` 的 `focus`（L128-133）；`browser/sourcesTabsHost.ts` L209；`browser/media/sourcesTabs.css` L115-125。
- 现状：`focus()` 在内容槽里找第一个 textarea、input、列表或按钮，范围覆盖三个面板。非当前面板是 `display: none`，选中 Changes 或 Review 时会先命中 Files 面板里的输入框，focus 静默失败。回退选择器 `.sources-tab.active` 永远匹配不到，因为 tab 用的是 `selected` 类，最终总是聚焦 Files tab。
- 影响：`layout.focus()` 在 Conversation 隐藏时把焦点交给 Sources，侧栏换边后也会把焦点还给原来的 Part（`workbench/browser/layout.ts` L1416-1428、L2181-2216）。这两处在非 Files tab 下都失效。
- 已知：否。
- 方向：让 contrib 通过 `ISourcesPartService` 注册 focus 委托，由当前 tab 的面板自己决定焦点；Part 不再引用 contrib 的类名。

## 与既有记录的关系

| 本文 | 既有记录 | 关系 |
|------|----------|------|
| SAR-1 | open-identity S3；accept-stage-hunk S0 | S3 假设该 scheme 可解析，需要改口；S0 须先于本条或与本条同一切片 |
| SAR-2 | BH-15-6，15 号方案 S5 | S5 只修 Changes；Review 同胞与 Diff 宿主闸门未覆盖 |
| SAR-3 | BH-15-4、BH-15-5，15 号方案 S3、S4 | 换数据源可一并解决 |
| SAR-4 | open-identity S3；BH-16-1，16 号方案 S1；BH-15-1 | 读与写路由不一致为新增 |
| SAR-5 | BH-16-5，16 号方案 S4 | 正常轮次清理、远端失效、`stat` 开销为新增 |
| SAR-6 | BH-16-3、BH-16-4；open-identity S1；accept-stage-hunk S0 | 宿主重复、两套打开、请求序号为新增 |
| SAR-7 | `eslint.config.js` 放行说明 | 依赖方向与记录增长为新增 |
| SAR-8 | — | 新增 |

## 建议顺序

实施方案是 [sources-architecture](../plans/sources-architecture.md)，2026-09-28 用户签收。未实施。切片顺序以那份方案 §6 为准，对应关系如下。

1. P1 = SAR-1 与 accept-stage-hunk S0 同一切片。open-identity S3 关于 `createModelReference` 的那句已勘误。
2. P4 = SAR-3，可与 P1 并行。BH-15-4、BH-15-5 随 Files 改文件搜索关闭。
3. P2 = SAR-2。15 号方案 S5 的判定落在这个模型上，两个 tab 同时生效。
4. P3 = SAR-4，与 open-identity S2、S3 的身份字段以及 16 号方案 S1 的会话钉扎同一条数据。
5. P5 = SAR-5，含 16 号方案 S4 的过期轮次约束。P8 = SAR-8。二者与 P3 按冲突域并行。
6. P6 = SAR-6，open-identity S1 与 S4 的唯一实施位置。P7 = SAR-7。二者并行。

## 看过但未立条

- `common/` 没有 import `browser/`。Part 以单例服务注册、contrib 在两个槽都注册后挂载，与 VS Code 其余 Part 的做法一致。
- Diff 归属按 `sources.diff.defaultOwner` 分派，与 ADR-005 一致。
- 空态与失败文案集中在 `*Strings.ts` 与 `common/sourcesChangesGitRead.ts`，读失败不装成空成功（D215、D244、D245 已关）。
- 多数异步渲染路径有代数或序号守卫。问题在于守卫各写各的（SAR-2、SAR-6），不在于缺守卫。
- `SourcesDiffPanelView` 的模型引用同时进 `bodyDisposables` 与 `SourcesDiffEditorModel`；`ReferenceCollection` 的 dispose 只生效一次，不会重复减计数（BH-16 已记）。
- `editorGroupFinder.ts` 反向依赖 contrib 是 eslint 明文放行的既定设计，本文只就归属提建议（SAR-7）。

## 验证

- SAR-1 用临时探针测试证实。测试源码放在 `/tmp`，用 `typescript.transpileModule` 转译进 `out/`，以 `./scripts/test.sh --run` 运行，使用 `workbenchInstantiationService` 提供的真实 `TextModelResolverService`。两条用例都通过：先用 `IModelService.createModel` 写入 `sources-git-diff:` 模型，`createModelReference` 仍抛 `Unable to resolve resource sources-git-diff:`；为该 scheme 注册内容提供者之后，同一模型可以解析。探针跑完已删除，仓库未改动。
- `./scripts/test.sh --glob '**/vs/workbench/contrib/sources/test/**/*.test.js'` 在 HEAD 上 254 passing、0 failing。
- 其余各条来自代码阅读，没有在运行中的 workbench 里复现；SAR-3 没有测量真实工作区上的耗时。

## 未读完

- CSS 只查了与 focus、面板显隐有关的规则。
- `workbench/browser/layout.ts` 只读了 Sources 显隐、尺寸与焦点相关的分支。
- conversation 侧只读了 import sources 的位置，没有读 `conversationReviewEntry.ts`、`conversationReviewNavService.ts` 的实现。
- 测试文件只读了与上述结论相关的用例与桩。
