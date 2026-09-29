---
title: "Sources 架构收口"
type: plan
status: accepted
phase: M7
updated: 2026-09-29
summary: "2026-09-28 用户签收。SAR-1…8：引擎 Diff 内容提供者与 Accept S0 同一切片；变更读收到一个模型；Files 改文件搜索。P6 与 P7 已在 loop/merge 实施（2026-09-29）。P7：命令 id 在 sources common；Diff 守卫只比 type id 与 scheme；归因按路径取记录且每会话最多 500 条。方案保持 accepted。"
---

# Sources 架构收口

> **slice_id**：`sources-architecture`
> **基线**：HEAD `32f3e9187c9`（[审查](../progress/sources-architecture-review-2026-09-28.md) 基线 `1145bce61de` 的后继）。用词沿用审查文的「用词」表。
> **本稿是方案，不是实施。** **签收（2026-09-28）：** 规则 16 第六轮 Approve。用户签收，`accepted`。P6 与 P7 已在 loop/merge 实施（2026-09-29）。方案保持 accepted。
> **不推翻**：[ADR-005](../decisions/005-changes-diff-owner.md)；[sources-accept-stage-hunk](sources-accept-stage-hunk.md) 的产品语义与 S1；[sources-review-open-identity](sources-review-open-identity.md) S1 的完成式与 S4 的落点；[bug-hunt 15](bug-hunt-2026-09-24/15-sources-changes.md) 文首的多根裁定与 S1、S2；[ADR-008](../decisions/008-write-git-apply-hunks-empty.md)。
> **冲突域与波次**见 §6。同一波次每个冲突域只有一个写者。

## 0. 一句话结论

Sources 的变更权威收成一个模型：条目、来源、会话、读状态、写闸门都从这里读出。Changes 与 Review 只投影。引擎 Diff 的 `sources-git-diff:` 由内容提供者解析，模型文本的生命周期跟 `createModelReference` 的引用计数走；打开函数不再销毁模型。Accept 在 [sources-accept-stage-hunk](sources-accept-stage-hunk.md) S1 落地前保持隐藏。Files 改为可取消、有上限、走 exclude 与 gitignore 的文件搜索，不再遍历 Explorer 的共享模型。

## 1. 与既有方案

| 既有 | 本稿 |
|:-----|:-----|
| accept-stage-hunk **S0** | 唯一实施位置是 **P1**。拆掉带着走的 `unifiedDiff` 载荷，Accept 隐藏。S1（切 hunk、现拉 diff、固定 argv）仍属那份方案，P1 不做 |
| accept-stage-hunk **S1** | 排在 P1 之后。S1 未落时，Diff 已经能打开也不得显示 Accept |
| open-identity **S1**、**S4** | 完成式与落点不改，生产点仍是 `openSourcesChangeInConversation` 与 `show()`。**P6** 只让行点击和 Move 都调用 `openSourcesChangeEntry`，由它转进这两个生产点。外层返回 `boolean \| 'stale'`：只有 `=== true` 标已审，只有 `=== false` 写失败状态。P1 的 diff 文本代数不是 S1 的加载 generation |
| open-identity **S2** | 闸门优先序不改。身份字段改由模型产出，**P3** 把它们拷进变更引用与 Diff Input |
| open-identity **S3** | identity / model URI 拆分保留。model URI 仍是 `sources-git-diff:`。`createModelReference` 能解析，是因为 **P1** 注册了内容提供者。只 `IModelService.createModel` 再指望 resolver 找到模型，这条在 HEAD 上不成立。勘误写在那份方案 S3 |
| bug-hunt 15 **S5**（BH-15-6） | 判定保留：列表读失败态只在保留的行来自引擎读时置上。落点改到 **P2** 的模型，Changes 与 Review 同时生效 |
| bug-hunt 15 **S3、S4**（BH-15-4、BH-15-5） | **P4** 换数据源后不再在 Explorer 遍历上打补丁 |
| bug-hunt 16 **S1**（BH-16-1） | 写请求仍钉住打开时的会话，点击时会话变了就拒绝，引擎行不退回 `git.stage`。记下的值是模型写在条目上的 `sessionId`，打开时拷进 Input。`setInput` / `renderRef` 不再为了填这个字段去读 roster 的当前会话 |
| bug-hunt 16 **S4**（BH-16-5） | 过期轮次不得清理已审，这条保留，测试放进 **P5**。P5 另加：只清理同一会话、同一来源、读成功的那一桶 |
| bug-hunt 15 文首多根裁定 | 不重开选仓。引擎行的 Commit 仍不退回 `acceptInputCommand`。空引擎列表回退之后的提交是 SCM 行，走本地命令，由 **P3** 把今天 `runCommit` 里「引擎未接受再落本地」从 SCM 状态上拆开 |

## 2. 审查条目落点

| 条目 | 切片 |
|:-----|:-----|
| SAR-1 引擎 Diff 无法解析 | P1 |
| SAR-2 读仲裁与写闸门各持一份 | P2 |
| SAR-3 Files 遍历 Explorer | P4 |
| SAR-4 变更引用丢身份；读写路由不一致 | P3 |
| SAR-5 已审身份与生命周期 | P5 |
| SAR-6 两套 Diff 宿主、两套打开、模块级容器 | P6 |
| SAR-7 跨 contrib 与归因记录 | P7 |
| SAR-8 Part focus 选错面板 | P8 |

## 3. HEAD 事实

对照 `32f3e9187c9`。审查稿里「`onDidFileMutation` 声明为 `Event<void>`」在这个 HEAD 上已经不成立。

| 事实 | 位置 |
|:-----|:-----|
| `ReadGitFileDiff` 的两侧文本用 `sources-git-diff:` 写入 `IModelService`。全仓没有这个 scheme 的 `ITextModelContentProvider` | `sourcesChangeEntryOpen.ts` `applySourcesGitFileDiffIfNeeded` |
| `TextModelResolverService` 对未注册 scheme 在激活文件系统提供者失败后抛 `Unable to resolve resource`，不会改用已经放进 `IModelService` 的模型 | `textModelResolverService.ts` |
| Preview、Conversation、Panel 都走 `createModelReference` | `textResourceEditorInput.ts`；`conversationDiffReviewPane.ts`；`sourcesDiffPanelView.ts` |
| 打开失败时 `disposeSourcesGitDiffModels` 按 URI 销毁模型。同一 path 与 indexState 的新请求正在用的模型会被旧请求的失败路径拆掉 | `sourcesChangeEntryOpen.ts` |
| 序号失配时 `applySourcesGitFileDiffIfNeeded` 返回还没换成引擎 Diff 的引用，调用方继续打开 | 同文件，`sourcesGitFileDiffReadSeqByKey` |
| 带着走的 `unifiedDiff` 经字段或 `WeakMap` 变成 Accept 的 patches，两个宿主的 `runAccept` 传空 argv | `sourcesChangeRef.ts`；两个 Diff 宿主 |
| Changes 与 Review 各自持有 `usingGitRead`、保留旧行、`leftoverListFailed`、`refreshSeq`，并各调一次 `tryLoadSourcesGitChangeEntries`。`ReadGitSummary` 的抛错与 `ReadGitChanges` 同级失败；列表把返回的 summary 丢掉 | 两个列表的 `refresh`；`sourcesChangesGitRead.ts` |
| Changes 的读失败只要进了 catch 就置 `leftoverListFailed`。Review 在已有行时置这个旗，不看来源；行数为 0 时反而不置 | `sourcesChangesList.ts` catch；`sourcesReviewList.ts` catch |
| 两个 Diff 宿主把 `leftoverListFailed` 写成常量 `false` | `sourcesDiffPanelView.ts`；`conversationDiffReviewPane.ts` |
| `ISourcesReviewListHost` 露出 `isSourcesGitFileDiffOpenSkipped`、`isSourcesGitWriteClosed`、`readGitFileDiff` | `sourcesReviewHostService.ts` |
| 写闸门是带默认值的位置布尔：`isSourcesGitWriteLive(connected, pairingHold, leftoverListFailed, engineSessionReady)` | `sourcesChangesGitWrite.ts` |
| 引擎已连接但 `ReadGitChanges` 得到空列表时，列表走本地 SCM 回退。`tryStagePaths` 仍先走引擎，路径是 `gitPath ?? resource.fsPath` | `sourcesChangesList.ts` `canWriteStage` / `tryStagePaths` |
| `ISourcesChangeRef` 没有 `gitPath`、`indexState`、来源、会话。换成 `sources-git-diff:` 之后 `sourcesDiffLocalWritePath` 对没有 `scmResource` 的引用返回空串 | `sourcesChangeRef.ts` |
| 已审 key 是本地 SCM 根 + URI + etag。`ensureEntryKeys` 对每个条目 `resolveKey`，`resolveContentHash` 对 `file` scheme 做 `stat`。`invalidateResource` 先 `stat` 再看前缀。`pruneMissingKeys` 用当前条目集删掉其余 key | `sourcesReviewProgressService.ts`；`sourcesReviewList.ts` |
| 平台 `onDidFileMutation` 已是 `Event<IFileMutationRecord>`（`universeAgentTypes.ts`）。sources 里另有一份同名接口，`diffStats` 的数字是可选的，归因服务用 `as unknown as` 接上。`buckets` 按会话只追加 | `universeAgentConnection.ts`；`sourcesReviewAttribution.ts`；`sourcesReviewAttributionService.ts` |
| `editorGroupFinder.ts` 依赖 `contrib/sources/common/conversationDiffReviewInput.js`，eslint 点名放行。`conversationEditorRouting.ts` 也引用这个 guard。`conversationLensReadingColumn.ts` 为了一个命令 id 引用 `sourcesReview.contribution.js` | 见路径；`eslint.config.js` |
| `SourcesPart.focus` 在内容槽里找第一个 textarea、input、列表或按钮。隐藏面板是 `display: none`。回退选择器 `.sources-tab.active` 对不上 tab 上的 `selected` | `sourcesPart.ts`；`sourcesTabsHost.ts`；`sourcesTabs.css` |
| sources 套件单测在审查基线上 254 通过。审查用真实 `TextModelResolverService` 证实：只 `createModel` 不能解析 `sources-git-diff:`，注册内容提供者之后可以 | 审查文「验证」 |

## 4. 选定设计

### 4.1 P1：内容提供者，与 Accept S0 同一切片

P1 一次合入两件事，顺序写进同一个变更：先按 accept-stage-hunk 的 S0 拆掉带着走的 apply 载荷，再注册内容提供者。S0 的行为以那份方案的「HEAD 要先拆的传递」和 S0 行准，这里只写 Diff 模型这一侧，避免另写一套拆法。

拆完之后 `hasSourcesGitApplyHunksPayload` 仍在。两个宿主的 patches 为空，Accept 隐藏，0 次 `WriteGitApplyHunks`。`parseSourcesGitUnifiedDiff` 继续只负责两侧展示文本。原始 `unifiedDiff` 不再放进 `ISourcesChangeRef`，也不再进 `WeakMap`。

内容缓存 `SourcesGitDiffContentStore` 放在 `contrib/sources/browser`。它保存每个 URI 的文本和代数，不拥有 `ITextModel`。

`ReferenceCollection.acquire` 在已有引用时只加计数，不会再调用 `provideTextContent`。所以已经打开的 diff 要靠 `put` 自己更新模型，不能等下一次解析。`put` 只接受不旧于当前代数的文本。若 `IModelService.getModel` 已有该 URI 且模型未 dispose，`put` 立刻 `updateModel`。更旧的代数不写入、也不 `updateModel`。

`sourcesDiff.contribution.ts` 向 `ITextModelService.registerTextModelContentProvider` 注册 scheme `sources-git-diff`。`provideTextContent` 只服务「还没有活引用」的那次解析（含销毁尚未完成、模型还在 `IModelService` 里的窗口）：

1. store 没有该 URI 的文本 → 返回 `null`。
2. 已有未 dispose 的模型 → 文本不同则 `updateModel`，返回这个模型。再 `createModel` 会抛 `Cannot add model because it already exists!`。
3. 否则 `createModel(value, null, resource)` 并返回该模型。language 传 `null`，与今天的 `writeSourcesGitDiffModel` 相同。创建之后返回 `null` 会让 resolver 抛 `Unable to resolve text model content for resource`，这一步必须返回模型。

`TextResourceEditorModel.dispose` 会 `destroyModel`。引用计数就是 resolver 的 `ReferenceCollection`：最后一个 `createModelReference` 的引用释放时模型销毁。打开函数、失败路径、store 都不再调用 `destroyModel`。`disposeSourcesGitDiffModels` 删除。

`ReadGitFileDiff` 的序号失配时：不 `put`，三个宿主都不打开，也不退回打开文件本体。这一次 `openSourcesChangeEntry` 返回 `'stale'`，不 throw，也不返回 `false`。

HEAD 上 `markReviewedAfterSuccessfulOpen` 在 `await open()` 正常结束后就标已审（`sourcesReviewListModel.ts`）。函数今天是 `Promise<void>`。P1 若只把失配改成正常 return，Review 列表和 Open Selected 会把没打开的行标成已审。因此 P1 同一变更改这三处：`openSourcesChangeEntry` 的返回类型变成 `Promise<boolean | 'stale'>`；`markReviewedAfterSuccessfulOpen` 与 Review 列表、Open Selected 只在结果 `=== true` 时标已审。`'stale'` 不标已审，也不写 `sourcesGitDiffOpenFailureMessage`。今天仍然能 resolve 的打开在 P1 返回 `true`，已审行为与 HEAD 相同。比较没画上却返回 `false`、以及按 `false` 写失败状态，留到 P6，不在 P1 做。这套代数只决定哪一次 diff 文本生效，不是 open-identity S1 的加载 generation。

URI 形状保持 `sources-git-diff:/<original|modified>/<path>/<indexState>`。

P1 不做 accept-stage-hunk S1，不做 open-identity 的 S1/S4 完成式，不把模型引用计数再做一份放进 store。

### 4.2 P2：变更模型

新增 `ISourcesChangesModel`（`contrib/sources/common`，Delayed singleton）。Changes 与 Review 订阅它的快照，不再各自调用 `tryLoadSourcesGitChangeEntries`。

```ts
type SourcesChangesReadState =
	| { kind: 'scm' }
	| { kind: 'engine-live'; sessionId: string }
	| { kind: 'engine-leftover'; sessionId: string; reason: 'pairing-hold' | 'no-hook' | 'read-failed' };

interface ISourcesChangesSnapshot {
	readonly generation: number;
	readonly settled: boolean;
	readonly state: SourcesChangesReadState;
	readonly entries: readonly ISourcesChangeEntry[];
	readonly failureMessage?: string;
}
```

`failureMessage` 在状态旁边，不进判别联合，也不进写闸门。初始快照是 `generation: 0`、`settled: false`、`state: { kind: 'scm' }`、条目空、无 `failureMessage`。`settled === false` 时两个列表画 Loading…，不画 `No changes.`，也不画 `No changes to review.`。

每次读开始时 `generation` 加一。任何一个 await 之后，若代数已经不是这一次，丢弃结果：不替换快照，也不算成功读，`settled` 保持上一份的值。后返回的旧 `ReadGitChanges` 不得盖住较新的快照。每一份真正落地的快照，无论成功还是抛错，都把 `settled` 写成 `true`。首拉抛错因此能画出失败文案，而不是停在 Loading…。

迁移：

- 配对等待且已有引擎行 → `engine-leftover` / `pairing-hold`，沿用 `shouldKeepSourcesGitReadPairingHoldLeftover`。
- 仍连接、hook 消失、已有引擎行 → `engine-leftover` / `no-hook`，沿用 `shouldKeepSourcesGitReadNoHookLeftover`。
- 非空引擎列表 → `engine-live`。
- 空 session、断连、首拉无 hook、`supported: false`、空引擎列表 → `scm`，条目来自 `collectSourcesChangeEntries`。
- 上面四支都清掉 `failureMessage`。只有读抛错写入它。诚实文案按状态投影，不从空的 `failureMessage` 推断：`pairing-hold` 用 `sourcesGitReadPairingHoldMessage()`；`no-hook` 用 `sourcesGitReadUnavailableNoHookMessage()`。`scm` 且条目非空时用 `sourcesGitLocalOnlyMessage()`，覆盖空 session、断连、首拉无 hook、`supported: false`、空引擎列表。Changes 把这句画在来源点，Review 画在 `.sources-review-status`。`no-hook` 保留的引擎行不用 local-only 这句。
- 读抛错：进入 catch 时上一份快照是 `engine-live` 或 `engine-leftover` 且仍有行 → `engine-leftover` / `read-failed`，行保留，`failureMessage` 为 `sourcesGitReadFailureMessage`。上一份是 `scm`（含初始快照和本地 SCM 回退）→ 保持 `scm`，不进入 `read-failed`，条目保留上一份 SCM 行；首拉则条目仍空。同一次写入 `failureMessage`。有行时不把列表画成空成功。无行时不画 `No changes.`，也不画 `No changes to review.`。无行且有 `failureMessage` 时藏起 Commit 行（overview §4 的首拉失败）。有 SCM 行时，失败文案本身不关本地 stage / commit；会话目录未就绪等其余闸门事实仍可关。

引擎条目的 `origin` 是 `engine`，`sessionId` 是产生这批行的那次 `ReadGitChanges` 的会话。保留旧行时沿用这些行上的 `sessionId`，不用刷新当时的活动会话覆盖。SCM 条目的 `origin` 是 `scm`，没有 `sessionId`。`gitPath`、`groupId`、`indexState`、`kind` 随条目一起由模型给出。P3 只拷贝，不再定义第二份。

`ReadGitSummary` 仍由模型调用一次。它的抛错继续与 `ReadGitChanges` 同级（overview §4）：Summary 失败不得把引擎条目画成成功。返回值继续不画成摘要 UI。两次列表刷新变成一次读。

重读的触发是连接变化、活动会话、会话目录、SCM 仓库与资源组，各订一次。筛选框、Review 进度、归因 `onDidChange` 只重绘投影，不发起引擎读。Sources 部分隐藏时模型仍按这些触发重读一次：闸门在部分收起时也要是新的。这和 P4 的 Files 不同，Files 在不可见时不搜索。

写闸门改成一个接收状态对象的函数，调用点不再传位置布尔：

```ts
isSourcesChangesWriteClosed(state: SourcesChangesReadState, facts: {
	phaseConnected: boolean;
	pairingPending: boolean;
	engineConnected: boolean;
	engineSessionReady: boolean;
}): boolean
```

`engineConnected` 取 `isEngineConnected()`，与今天 `isSourcesKeepLeftoverWrite` 的 connected 实参相同，不用 `phase.kind === 'connected'` 代替。关闭条件与今天对齐，且只看 `state` 与连接事实，不看 `failureMessage`：配对等待（`phaseConnected` 且 `pairingPending`）；`read-failed`；`engineConnected && !pairingPending && !engineSessionReady`。`scm`（含带 `failureMessage` 的本地回退）与 `engine-live` 在其余事实允许时不关。FileDiff 打开跳过与今天的 `shouldSkipSourcesGitFileDiffOpen` 对齐：`read-failed`，或配对等待下的引擎保留旧行。带失败文案的 `scm` 不跳过 FileDiff 打开。两个 Diff 宿主和 Review 命令读模型上的这两个结果，不再写死 `false`，也不再经 `ISourcesReviewListHost` 读视图私有字段。宿主接口去掉 `isSourcesGitFileDiffOpenSkipped`、`isSourcesGitWriteClosed`、`readGitFileDiff`。

`isSourcesGitWriteLive` 的四布尔签名删除，测试改打状态对象。`sourcesWiringScan.test.ts` 里要求两个视图文件都出现 `tryLoadSourcesGitChangeEntries` 的文本断言，改成行为断言：一次刷新只发出一次 `ReadGitChanges`。

会话三事实（当前会话 id、会话目录是否就绪、是否配对等待，外加活动会话与会话变化事件）收成 `IAgentSessionContext`，接口放在 `workbench/services/agentSession/common`。conversation contrib 用现有 roster 与 `isConversationPairingHold` 做实现并注册 singleton。sources 的这 6 个生产文件改依赖该接口，不再引用 `conversationStubService.ts`：`sourcesChangesList.ts`、`sourcesReviewList.ts`、`sourcesDiffPanelView.ts`、`conversationDiffReviewPane.ts`、`sourcesReviewCommands.contribution.ts`、`sourcesReviewAttributionService.ts`。P7 不再搬这层。

### 4.3 P3：身份跟着条目走

P2 已经把 `origin`、`sessionId`、`gitPath`、`groupId`、`indexState`、`kind` 写在条目上。`resolveSourcesChangeRef` 和 `applySourcesGitFileDiffIfNeeded` 换成 `sources-git-diff:` 的那次拷贝都带上这些字段。model URI 与这些字段分开，与 open-identity S3 的拆分一致。P3 不改 `sourcesReviewList.ts`。

列表上的 stage、unstage、commit 都先看 §4.2 的写闸门。闸门关闭时直接返回：0 次 `git.stage`、`git.unstage`、`acceptInputCommand`、`git.commit` 和引擎写。`read-failed`、配对等待、会话目录未就绪都走这里，包括带 `scmResource` 的 Unstage。

闸门打开之后：Unstage 始终是 `git.unstage`（overview §4），本仓没有 unstage 的引擎 RPC，也不发明 `WriteGitUnstage`。两种来源都只在条目有 `scmResource` 且该组可 unstage 时调用它。没有 `scmResource` 的引擎行不发 unstage。

- `origin: 'engine'` 的 stage：引擎写，`sessionId` 用条目上的值。点击时 `IAgentSessionContext.getActiveSessionId()` 与条目不一致，或条目没有 `sessionId`：不发写请求，不走 `git.stage`。notice 说明会话已变。路径用 `gitPath`。空串不是路径：`gitPath === ''` 不发，也不用 `resource.fsPath` 顶上。`??` 不会把空串换成 `fsPath`，这里仍要显式拒绝空串。
- `state.kind === 'scm'` 的 stage：本地 `git.stage`。不调用 `writeGitStagePaths`。空引擎列表回退也是这种快照。
- `state.kind === 'scm'` 的 commit：不调用 `tryWriteSourcesGitCommit`。走本地 `acceptInputCommand` / `git.commit`。选哪个仓库仍是 bug-hunt 15 文首那一节的事（唯一有暂存改动的仓库；没有或两个以上则禁用）。P3 不新写选仓，也不把今天的 `getPrimaryRepository()` 写成那条规则。不按当前行选仓。
- `engine-live` 的 commit：只调用 `tryWriteSourcesGitCommit`，会话用快照上的 `sessionId`。结果为未接受、unsupported，或调用抛错：写状态行，不调用 `acceptInputCommand`，也不调用 `git.commit`。
- `engine-leftover` 不单独关写。关写的只有 §4.2 的三件：配对等待、`read-failed`、会话目录未就绪。`no-hook` 时写 hook 还在，则 stage / commit 仍用保留行上的 `sessionId` 发引擎写；写 hook 不在则不发，也不退回 `git.stage` / `acceptInputCommand`。`runCommit` 只在写闸门关闭时直接返回。

`sourcesDiffLocalWritePath` 对引擎行读 `gitPath`，对本地 SCM 行读 `scmResource`。虚拟 URI 不进 argv。

Diff 宿主记下的会话就是打开时拷进 Input 的 `sessionId`（§1 对 bug-hunt 16 S1 的改口）。选仓规则不改；改的是 SCM 快照不再先打引擎，以及引擎提交失败不再落到 `acceptInputCommand`。

### 4.4 P4：Files 改文件搜索

`collectSourcesFileEntries` 不再调用 `ExplorerItem.fetchChildren`，不再读 `_isDirectoryResolved`。`ISearchService.fileSearch` 在任一 `folderQueries` 出错时整次 Promise reject，已扫到的匹配不会出现在 resolve 的结果里。因此每个工作区文件夹单独一次 `fileSearch`，用 `Promise.allSettled` 合并。一个文件夹 reject 只丢掉那一个文件夹；其余 fulfilled 的结果留下。全部 reject 时沿用 `resolveSourcesFilesCollectResult`：保留上一份成功结果并画失败。

每次查询：

- `type: QueryType.File`
- 该文件夹自己的一条 `folderQueries`
- `excludePattern` 用 `getExcludes`（合并 `files.exclude` 与 `search.exclude`）。只传 `files.exclude` 时，默认配置仍会把 `node_modules` 搜进来
- `disregardIgnoreFiles: false` 与 `disregardParentIgnoreFiles: false` 写在这条 `IFolderQuery` 上。这两个字段不在 `IFileQuery` 上；省略或放在查询顶层时，`folderQuery.disregardIgnoreFiles !== false` 会让 ripgrep 加上 `--no-ignore`，`disregardParentIgnoreFiles !== false` 会加上 `--no-ignore-parent`
- 不跟 `explorer.excludeGitIgnore` 的默认 `false` 走
- `maxResults` 取配置 `search.maxResults` 的正整数；配置为 `null`（不限）时用 `DEFAULT_MAX_SEARCH_RESULTS`（20000）。任一调用 `limitHit`，或合并后的条数超过这个上限，合并列表截到上限，状态行说明未列全。不把截断画成完整成功
- 新一轮刷新取消上一轮每个文件夹的 `CancellationToken`。序号失配的结果不落地

Sources 部分不可见，或当前 tab 不是 Files：不启动搜索。期间的文件变化与工作区文件夹变化合成一次脏标记，等 Files 面板可见时跑一轮。可见时的触发仍是文件变化、`onDidChangeWorkspaceFolders`、exclude / gitignore 相关配置。BH-15-4（嵌套列两次）与 BH-15-5（文件夹增减不刷新）随数据源关闭，不另做「已解析目录也 `fetchChildren`」的补丁。

### 4.5 P5：已审按桶保留

`ISourcesReviewProgressKey` 增加 `origin` 与 `sessionId`。`buildSourcesReviewProgressKey` 把它们编进 key。进度仍是窗口内存。

- 未审条目不 `stat`。`ensureEntryKeys` 在没有任何已审记录时不为列表做 I/O。
- 标已审时才记下 `contentHash`。本地 SCM 行是 etag。引擎行是该路径在该 `sessionId` 上最新一条 `IFileMutationRecord` 的 `` `${turnId}\0${toolCallId}` ``；还没有记录时 `contentHash` 为空串。刷新时用同一格式重算，对不上则不再算已审。
- 之后的刷新只为仍然已审的路径重算 `contentHash`。
- 本地 `onDidFilesChange`：没有已审 key 落在该资源上就返回，不 `stat`。引擎行不因本地文件事件失效。
- 引擎行的失效订阅平台 `onDidFileMutation`（已是带载荷的事件）。同一会话、同一路径有新记录则去掉已审。不扫描归因 `buckets`。
- `pruneMissingKeys` 只删除「这一轮成功读到的那一桶」里、不在本轮条目中的 key。桶是条目上的 `origin` + `sessionId`（P2 已经写在条目上）。成功读指模型落地了一份 `settled === true`、没有 `failureMessage` 的 `engine-live` 或 `scm` 快照。`settled === false` 与 `engine-leftover` 都不清理。断连、换成另一会话、回退到本地 SCM 且本地没有对应行，都不动另一桶。
- 代数用 P2 的 `generation`。`ensureEntryKeys` 在开始 await 之前、写回 key 之前、调用 `pruneMissingKeys` 之前都读它。与进入时不同则返回，不 `clear`、不 prune。这是 bug-hunt 16 S4，包括 await 之前的那一次检查。模型丢弃的过期读不会变成这里的成功读。

提示文案 `Review progress stays in this window.` 因此与断连、换会话后的行为一致：标记留到窗口结束，或留到同一桶的成功读确认条目已经不在。

### 4.6 P6：一个打开入口，一个写动作控制器

外层是 `openSourcesChangeEntry(entry, deps, options): Promise<boolean | 'stale'>`。行点击与 Move 只调用它，不各自打开编辑器。`'stale'` 是 truthy，禁止用 `if (result)` 判断打开成功。

函数内部按这个顺序：

1. P1 的 `ReadGitFileDiff` 与 store 代数。失配时返回 `'stale'`，不进入宿主，也不把这次当成 S1 的 `false`。list / commands 对 `'stale'` 直接忽略：不写状态、不标已审。只有 `=== true` 标已审，只有 `=== false` 写打开失败状态。这套代数只决定 diff 文本，不是下面的加载 generation。
2. 按 `sources.diff.defaultOwner` 或显式 Move 的 `owner`（ADR-005）进入宿主。boolean 的生产点仍是 open-identity S1 写死的 `openSourcesChangeInConversation` 与 Panel `show()`，它们只返回 `boolean`。list、commands、Move 不订 `onDidLoad`，不跑 S1 的步骤 1–7。Preview 有 `scmResource` 时仍走 `ISCMResource.open()`，resolve 为 `true` 的规则仍是 S1。
3. Conversation 的组选择仍是 S4，代码留在 `openSourcesChangeInConversation` 里。Move 不传 `CONVERSATION_SIDE_GROUP`，也不调用 `IEditorService.openEditor`。

S1 的加载 generation、reveal、`undefined`、失败仍交出 pane、Panel 只 join 画完的那一次 `renderRef`，都留在这两个生产点。P6 不删除这套 generation，也不另做一套。P6 删的是 Panel 加载结果的 `WeakMap`：生产点把 boolean 交回 `openSourcesChangeEntry`。P1 已经去掉 Accept 的 `WeakMap` 和 `sourcesGitFileDiffReadSeqByKey`。

Stage、Accept、Revert、Unstage 的可否与请求组装放进一个与 DOM 无关的控制器，读 P2 的写闸门和 P3 的身份。闸门关闭时宿主也不发这些动作，包括 `read-failed` 下的 `git.unstage`。今天宿主的 `isSourcesDiffWriteHold` 只有配对等待和会话目录未就绪，P2 替换 `canSend*` 里写死的 `leftoverListFailed: false` 盖不住这条强制 Unstage。两个宿主只根据控制器的结果画按钮。Revert、Unstage、引擎 Stage 成功后，两个宿主都用同一显式标记收起按钮。

### 4.7 P7：依赖方向与归因索引

P2 已把会话三事实抽到 `IAgentSessionContext`。P7 做剩下的三件：

1. `SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND` 挪到 `contrib/sources/common`。`conversationLensReadingColumn.ts` 引用 common 里的常量，不再引用会执行 `registerAction2` / `registerSingleton` 的 `sourcesReview.contribution.js`。
2. scheme、type id、editor id 和 `isConversationDiffReviewInput` 挪到 `workbench/common/editor/`。guard 只比较 type id 与 scheme。`ConversationDiffReviewInput` 类与序列化留在 sources，改为使用这组常量。`editorGroupFinder.ts` 与 `conversationEditorRouting.ts` 改引新位置。eslint 对 `contrib/sources/common/conversationDiffReviewInput.js` 的放行删除。finder 对 `conversationEditorRouting.js` 的放行保留。
3. 删除 sources 侧的 `IFileMutationRecord`，归因与其测试改用 `universeAgentTypes.ts` 的那份；夹具里 `diffStats` 的三个数字写全。去掉 `as unknown as`。`buckets` 改为会话 → 路径 → 记录，并设每会话上限 500，超出丢最旧的一条，路径索引同步去掉。Review 刷新按路径取记录，不再对每个条目扫描该会话的全量数组。

### 4.8 P8：焦点由当前面板委托

`ISourcesPartService` 增加 `setFocusDelegate(delegate: (() => boolean) | undefined)`。`SourcesTabsHost` 注册委托：把焦点放进当前 `selected` tab 对应的可见面板；面板里没有可聚焦控件时，聚焦该 tab 按钮（`selected`，不是 `active`）。`SourcesPart.focus` 只调用委托。委托缺失或返回 false 时，Part 聚焦自己的根节点。Part 不再查询 textarea、input、列表或按钮，也不再引用 `.sources-tab`。

## 5. 不变量

- 无内容提供者的 `sources-git-diff:` 不得被当成已经能 `createModelReference`。
- P1 合入后、accept-stage-hunk S1 合入前，Accept 不显示，带着走的整段 diff 不进 `patches`。
- 列表读失败态只关闭引擎保留旧行上的写与 FileDiff 打开。`scm` 快照上的 `failureMessage` 不关闭本地 stage / commit。无行的失败文案不画成 `No changes.` 或 `No changes to review.`。
- 引擎行的写使用条目上的 `gitPath` 与 `sessionId`。本地绝对路径不发给引擎写。
- 模型的销毁只来自最后一个文本模型引用的释放。
- 序号失配的 `ReadGitFileDiff` 不打开，并且不把 S1 的 `false` 交给 Review 状态行。
- Files 不写入 Explorer 模型。
- 已审标记在换会话、断连时保留。清理只发生在同一桶的成功读。
- Diff 默认归属仍是 Preview（ADR-005）。

## 6. 切片、冲突域、波次

| 切片 | 冲突域 | 主要文件 | 依赖 |
|:-----|:-------|:---------|:-----|
| **P1** | `sources-diff-model` | `sourcesChangeEntryOpen.ts`、`sourcesChangeRef.ts`、`sourcesDiff.contribution.ts`、两个 Diff 宿主里拆 S0 载荷的部分、新的 store 与真实 resolver 测试、`sourcesReviewListModel.ts` 的 `markReviewedAfterSuccessfulOpen`、Review 列表与 Open Selected 对 `'stale'` 的消费 | 无 |
| **P2** | `sources-changes-model` | 新的 `ISourcesChangesModel`、`sourcesChangesGitWrite.ts`、两个列表、两个 Diff 宿主里写死的 `leftoverListFailed: false`、`sourcesTabsHost.ts`、`sourcesReviewHostService.ts`、Review 命令、`IAgentSessionContext` 与 conversation 侧实现、接线扫描 | P1。与 P1 都改两个 Diff 宿主，不并行 |
| **P3** | `sources-change-identity` | `sourcesChangeRef.ts`、`sourcesChangeEntryOpen.ts` 里换成 `sources-git-diff:` 时的身份拷贝、`sourcesChangesList.ts` 的 stage / unstage / commit、两个 Diff 宿主的 Stage 身份 | P2。不改 `sourcesReviewList.ts` |
| **P4** | `sources-files` | `sourcesFilesModel.ts`、`sourcesFilesList.ts`、对应测试 | 无。可与 P1 并行 |
| **P5** | `sources-review-progress` | `sourcesReviewProgress.ts`、`sourcesReviewProgressService.ts`、`sourcesReviewList.ts` 的 key / prune | P2。`origin` 与 `sessionId` 已在 P2 的条目上，不依赖 P3 |
| **P6** | `sources-diff-open` | `sourcesChangeEntryOpen.ts`、`conversationDiffReviewInput.ts`（S1 的 generation 加在这个 Input 上）、`sourcesDiffRefHelpers.ts`、`sourcesDiffActions.ts`、两个 Diff 宿主 | P1、P2、P3。与 open-identity S1、S4 同一变更 |
| **P7** | `sources-boundaries` | 命令 id 的 common 模块、`workbench/common/editor` 的 guard、`ConversationDiffReviewInput` 改为引用新常量、`conversationDiffReview.contribution.ts`、`conversationNavigationService.ts`、`editorGroupFinder.ts`、`conversationEditorRouting.ts`、`conversationLensReadingColumn.ts`、`eslint.config.js`、归因服务与 `sourcesReviewAttribution.ts`、pane 与 actions 里 editor id 的 import | P6。与 P6 都改 Input 类和 Diff 宿主的 import，不并行 |
| **P8** | `sources-part-focus` | `sourcesPart.ts`、`sourcesTabsHost.ts`、焦点测试 | P2（`sourcesTabsHost.ts` 在 P2 还要改闸门委托） |

```text
波次 1：P1 ∥ P4
波次 2：P2
波次 3：P3 ∥ P5 ∥ P8
波次 4：P6
波次 5：P7
```

波次 3 的三个域不共享文件：P3 改 `sourcesChangeEntryOpen.ts` 的身份拷贝，不改 `sourcesReviewList.ts` 与 `sourcesTabsHost.ts`。P8 不改变更引用。P5 不改 `sourcesTabsHost.ts` 与 `sourcesChangeEntryOpen.ts`。P7 排在 P6 之后：S1 要在 `ConversationDiffReviewInput` 上加 generation，P7 又让这个类改用挪走的常量，并把 editor id 的 import 从 pane 与 actions 上换掉。

## 7. 测试

本地 `./scripts/test.sh --run`，点名 `contrib/sources/test` 与本切片新增的用例。不跑托管 CI。F4 隔离 profile 冒烟仍记 [D31](../progress/deferred-gaps.md)，本稿不代跑，不升 PRD-009 / PRD-023 为 `implemented`。

| 切片 | 要锁住的行为 |
|:-----|:-------------|
| P1 | 真实 `TextModelResolverService`：只 `createModel` 时 `createModelReference('sources-git-diff:')` 抛无法解析；`put` 且提供者已注册后解析到的文本与写入一致。已有引用未释放时，更新的 `put` 改变该模型的文本，且不再次 `createModel`。第二个引用存在时，旧请求的失败路径不销毁该模型。序号失配不打开编辑器，返回 `'stale'`。Review 列表与 Open Selected 对 `'stale'` 不调用 `markReviewed`，也不写打开失败文案。同一切片里今天仍能 resolve 的打开返回 `true` 并照旧标已审。两宿主 patches 为空，Accept 不可见，0 次 `WriteGitApplyHunks` |
| P2 | 一次连接变化只发一次 `ReadGitChanges` 与一次 `ReadGitSummary`。后返回的旧读不替换较新快照。首拉抛错后 `settled === true`，可见的是失败文案，不是 Loading…。引擎读成功后再抛错：两个 tab 都是 `read-failed`，写与 FileDiff 打开都关。此前是 `scm`（含初始空快照）：抛错后 `failureMessage` 存在、状态仍是 `scm`，有行时 `git.stage` 仍被调用；无行时不出现 `No changes.` 与 `No changes to review.`，Commit 行隐藏。断连、空 session、`supported: false`、首拉无 hook、空引擎列表且仍有本地行时，Changes 与 Review 都出现 `sourcesGitLocalOnlyMessage()`。`no-hook` 且写 hook 仍在时，写闸门不关，状态文案是 `sourcesGitReadUnavailableNoHookMessage()`。保留旧行上的 `sessionId` 不改成当前活动会话。筛选不触发引擎读。Diff 宿主读到的 `read-failed` 与模型一致 |
| P3 | 空引擎列表回退后的本地 SCM 行 stage 走 `git.stage`，0 次 `writeGitStagePaths`；这次 commit 调用 `acceptInputCommand` 或 `git.commit`，0 次 `writeGitCommit`。引擎行 stage 使用 `gitPath` 与条目 `sessionId`；`gitPath === ''` 不发，活动会话已变则 0 次写、0 次 `git.stage`。引擎行 unstage 只调用 `git.unstage`，0 次 `writeGitStagePaths`；没有 `scmResource` 时 0 次命令。`read-failed`、配对等待、会话目录未就绪时，有 `scmResource` 也是 0 次 `git.unstage`。`engine-live` 的 commit 在引擎返回未接受时 0 次 `acceptInputCommand`。`no-hook` 且 `writeGitCommit` 仍在时，commit 会调用它。`sources-git-diff:` 的 modified 不进 argv。P3 不新增选仓测试 |
| P4 | 每个文件夹一次 `fileSearch`。该条 `IFolderQuery` 上 `disregardIgnoreFiles` 与 `disregardParentIgnoreFiles` 都是 `false`，查询带 `getExcludes`。一个文件夹 reject 时，另一个文件夹的结果仍入列。`limitHit` 或合并超过上限时状态行说明未列全。取消的一轮不覆盖新结果。工作区文件夹增减会再搜。不调用 `fetchChildren` |
| P5 | 已审集合为空时，文件变化与整表刷新的 `stat` 次数为 0。引擎行的 `contentHash` 是 `` `${turnId}\0${toolCallId}` ``；新的 `onDidFileMutation` 后变为未审，只改本地文件则保持已审。换会话的成功读不删除上一会话的 key。`ensureEntryKeys` 在 await 之前看到代数变化就返回；停在 `resolveKey` 上的旧轮次返回后不 prune |
| P6 | 行点击与 Move 都只调用 `openSourcesChangeEntry`，返回类型是 `boolean \| 'stale'`。Move 的测试里不出现第二个 `openEditor`。比较未画上时生产点返回 `false` 且不标已审，并写打开失败状态。diff 代数失配返回 `'stale'`：`=== 'stale'` 不写打开失败状态、不标已审；禁止用 `if (result)` 把 `'stale'` 当成已审。后完成的旧请求不盖住新一次的状态行。open-identity S1 的夹具仍打在 `openSourcesChangeInConversation` 与 `show()` 上（reveal、`undefined`、失败仍交出 pane、加载 generation 往返、Panel 画完的那一次 `renderRef`）。失配时这两个生产点不被调用。Revert 成功后 Conversation 与 Panel 都收起按钮。`read-failed` 时两个宿主 0 次 `git.unstage` |
| P7 | `conversationLensReadingColumn.ts` 的 import 路径不含 `sourcesReview.contribution`。`editorGroupFinder.ts` 的 import 路径不含 `contrib/sources`。归因在同一路径上按路径取记录；第 501 条写入后该会话仍只保留 500 条。生产代码不再出现 `onDidFileMutation as unknown as` |
| P8 | 当前 tab 为 Changes 或 Review 时，`SourcesPart.focus()` 的目标在该可见面板内（或该 tab 按钮上），不落在 Files 面板的 input 上 |

## 8. 不做

- accept-stage-hunk S1 的 hunk 切分与显示 Accept
- 新 proto、新 RPC、改引擎仓
- 重开 bug-hunt 15 的多根提交选仓，或给 git RPC 加 workDir
- 为 Files 做拖放、新建、重命名
- 把 `ReadGitSummary` 的返回值画成新的摘要 UI
- 在 store 里再做一套与 resolver 平行的模型引用计数
- 升 PRD-009 / PRD-023 为 `implemented`，或代跑 D31

## 9. 审查记录

| 轮 | Assessment | 处置 |
|:---|:-----------|:-----|
| 2026-09-28 规则 16 | 不可开实施 | 已改入。Critical：`failureMessage` 与读状态分开，SCM 回退的失败文案不进入 `read-failed`，初始快照显式写成未落地的 `scm`。Important：`put` 在已有引用时直接 `updateModel`；Files 按文件夹 `allSettled`，ignore 旗标写在 `IFolderQuery`；模型代数挡住过期读，P5 在 await 前也核对；`origin` / `sessionId` 改由 P2 写在条目上，P5 不依赖 P3；P6 保留 S1 的两个生产点，只收外层入口；SCM commit 不先打引擎，引擎 commit 失败不落 `acceptInputCommand`。Minor 已一并写入：`provideTextContent` 必须返回模型、P2 依赖列与宿主文件、Review 的 `No changes to review.`、`disregardParentIgnoreFiles`、引擎 `contentHash` 用 `turnId` + `toolCallId` |
| 2026-09-28 规则 16 第二轮 | Approve with changes | 上一轮七条已接住。本轮 Important 已改入：落地快照（含首拉抛错）写 `settled: true`；`no-hook` 不单独关写；Unstage 只走 `git.unstage`；diff 代数失配返回 `'stale'`，list 不把它当成 S1 的 `false` |
| 2026-09-28 规则 16 第三轮 | Approve | 第二轮四处已接住，与 open-identity 的 2026-09-28 段一致。无新的 Critical / Important。用户签收前仍是 draft，不开切片 |
| 2026-09-28 规则 16 第四轮 | Approve with changes | 无 Critical。Important 已改入：外层签名改为 `Promise<boolean \| 'stale'>`，只有 `=== true` / `=== false` 分别标已审和写失败；列表 unstage 先看写闸门；P7 改到 P6 之后，避免同时改 Input 类和 editor id 的 import。Minor 已写入：关门用 `isEngineConnected()`；pairing-hold / no-hook / local-only 文案按 reason 投影；P3 文件列表含 `sourcesChangeEntryOpen.ts` 的身份拷贝；P3 不新写选仓、不把 `getPrimaryRepository()` 当成 15 文首 |
| 2026-09-28 规则 16 第五轮 | 不可开实施 | 已改入。Critical：P1 同一变更改 `markReviewedAfterSuccessfulOpen` 与两个消费点，`'stale'` 不标已审；P1 仍把今天能 resolve 的打开返回 `true`，`false` 留到 P6。Important：`sourcesGitLocalOnlyMessage()` 覆盖全部带行的 SCM 回退，Review 写在状态行。open-identity 里「只读 true\|false」改为以 `===` 和 `'stale'` 为准。Minor：宿主 `read-failed` 时 0 次 `git.unstage` 放进 P6；P7 文件补上 contribution 与 navigation service |
| 2026-09-28 规则 16 第六轮 | Approve | 第五轮三处已接住。无新的 Critical / Important。用户签收前仍是 draft，不开切片 |
| 2026-09-28 签收 | accepted | 用户签收。未实施。 |
| 2026-09-29 | P6 已在 loop/merge 实施 | 当时 P7 未做。方案保持 accepted。 |
| 2026-09-29 | P7 已在 loop/merge 实施 | 命令 id、Diff 守卫与归因路径索引已落。打开成功仍只认 `=== true`。方案保持 accepted。 |
