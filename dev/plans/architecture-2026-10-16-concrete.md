---
title: "架构审查 2026-10-16：可单独实施的缺陷"
type: plan
status: draft
phase: M7
updated: 2026-10-16
summary: "换 profile 复位 agent tree 探测，diff URI 带会话，设置列表跟活动工作根刷新，路径键只统一盘符。扫描测试与 chat 边界按真实路径判定。Q1–Q7 与 B5 不在本稿。未实施。不升 PRD。"
---

# 架构审查 2026-10-16：可单独实施的缺陷

> **触发：** [架构设计审查 2026-10-16](review-2026-10-16-architecture.md) B1–B4、B6、B7 与 §4 文档偏差。功能缺口 G17 与 B1 同一类，收在第一节。
> **不选定** 该审查 §6 的 Q1–Q7。不升 PRD。

## 1. 换 profile 后的 agent tree 与能力快照（B1、G17）

`fetchAgentTree` 遇 `UNIMPLEMENTED` 把 `_agentTreeProbeUnsupported` 设为 true，并改写 `_capabilities.agentTree`（`universeAgentConnectionService.ts:745-759`）。`isAgentTreeUnsupported` 看到这个旗标就返回 true（`:768-769`）。`disconnect` 把旗标、`_agentTreeFetchFailed` 和 `_capabilities` 清掉，四个专用能力字段设成 `UNKNOWN`（`:1312-1322`）。`_dropPublishedTransport` 把 `_capabilities` 换成空快照，不清 `_agentTreeProbeUnsupported`（`:2872-2890`）。`_applyConnectedCommit` 写入新探测的 `_capabilities`，把 `_agentTreeFetchFailed` 设为 false，不清 `_agentTreeProbeUnsupported`（`:2972-2984`）。`_closeoutAuthenticatedLink` 在 `:3353-3356` 先把 `this._transport` 置空。grace 分支在 `:3362-3372` 返回，不调用 `_markTransportFailed`。非 grace 才在 `:3374` 调用它。`_markTransportFailed` 在非传输失败码时什么都不做；传输失败时改相位。两种情况都不清能力快照（`:2371-2386`）。

**不变量：** 一次新的已连接提交之后，agent tree 是否支持只看这次提交写入的 `_capabilities.agentTree`。上一份 profile 的 `UNIMPLEMENTED` 旗标不得把下一份引擎挡在 `fetchAgentTree` 之外。condemn 之后、下一次提交之前，渲染端读到的能力与 `disconnect` 之后一样，是空快照加各专用字段的 `UNKNOWN`，而不是上一台引擎的表。

**要动的符号：**

- `_applyConnectedCommit` 在写入 `input.capabilities` 之前把 `_agentTreeProbeUnsupported` 设为 false。
- 清空发生在丢掉当前 transport 之前，而且只在这份 transport 仍是 `this._transport` 时做。`_dropPublishedTransport` 在 `:2875` 读到当前 transport、`:2876` 确认它存在之后、`:2880` 置空之前清。`_closeoutAuthenticatedLink` 在 `this._transport === transport` 的分支里、`:3354` 置空之前清。grace 分支不调用 `_markTransportFailed`，所以不能把清空放在那个函数里。清掉的是 `_agentTreeProbeUnsupported`、`_agentTreeFetchFailed`、`_fetchToolDetailUnsupported`、`_advertisedMethods`，以及与 `disconnect` `:1318-1322` 相同的空快照和四个 `UNKNOWN`。
- 不把连接服务改成不可变链路对象。

**验证：** `universeAgentConnection.test.ts`。引擎 A 的 `fetchAgentTree` 返回 UNIMPLEMENTED 之后直接换 profile 并提交引擎 B：旗标为 false，B 的 `fetchAgentTree` 会发出。`disconnect` 的现有复位断言保持。condemn 结算后、下一次 `_applyConnectedCommit` 之前，快照里的 `agentTree` 为 `UNKNOWN`。

## 2. diff URI 带会话（B2）

`sourcesGitDiffModelUri` 在 `sources/browser/sourcesGitDiffContent.ts:73-78`。path 是 `/${side}/${encodeURIComponent(path)}/${encodeURIComponent(indexState)}`，没有会话。模块级 `sourcesGitDiffContentStore` 以这个 URI 为键（`:71`）。打开行在 `sourcesChangeEntryOpen.ts:111-112` 用 `entry.gitPath` 与 `entry.indexState` 组 URI。`ISourcesChangeEntry.sessionId` 已由 `stampSourcesEngineEntries` 写上。

**不变量：** 两个 `sessionId` 不同、相对路径和 indexState 相同的引擎行，对应两个 URI，store 里的文本互不覆盖。没有 `sessionId` 的 SCM 行使用空会话键，与任一非空会话键分开。

**要动的符号：** `sourcesGitDiffModelUri` 增加 `sessionId: string`。放在 URI 的 query `session` 上，path 形状保持。`applySourcesGitFileDiffIfNeeded` 传入 `entry.sessionId ?? ''`。store 仍以完整 URI 为键。

**明确不改：** 不新造 scheme。不改 [sources-review-open-identity](sources-review-open-identity.md) 的打开顺序。

**验证：** `sourcesGitDiffContent.test.ts`。同一 path 与 indexState、不同 sessionId 的两次 `begin` / 写入，后一次不改变前一个 URI 的文本。`sourcesChangesList.test.ts:777-778` 与 `:3418-3419` 的三参数调用改成带上该行的 `sessionId`；没有会话的调用传 `''`。

## 3. 设置列表跟当前工作根（B3）

`EngineMcpSection` 在 `onDidChangeConnection` 时 `refresh`（`engineMcpSection.ts:290-293`），构造时 `:296` 也会 `refresh`。写操作当时才读 `sessionWorkDir`，而它读的是 `getActiveWorkRoot().workDir`（`:170-172`；调用点 `:415`、`:451`、`:488`、`:663`、`:785`）。活动会话换了，列表可以仍是上一份工作根的项目服务器。`onDidChangeActiveWorkRoot` 在 `IAgentSessionContext` 上是可选的。

`activeComposerProjectPath` 读窗口的 `getActiveWorkRoot`（`conversationLensComposer.ts:199-211`）。底栏的 `agentIndex` 读绑定会话（`:85-86`、`:121`、`:149`、`:231`）。

**不变量：** MCP 列表在下一次绘制前使用的工作根，等于紧接着的 Add / Update / Toggle 会放进请求的那个 `workDir`。绑定在会话 S 上的 Composer 拉档案时，项目路径来自 `getWorkRoot(S)`；该方法不存在时保持今天的 `getActiveWorkRoot`。

**要动的符号：** `EngineMcpSection` 订阅已注入的 `onDidChangeActiveSession`。`onDidChangeActiveWorkRoot` 存在时也订阅。回调走现有 `refresh`。`engineMcpSection.test.ts:136-146` 的桩今天只有 `getActiveWorkRoot`，新用例要补上这个事件。`activeComposerProjectPath` 在 host 能给出绑定会话 id、且 `getWorkRoot` 存在时用那份 `workDir`。

**明确不改：** 不改存储落在 WORKSPACE 还是 PROFILE。不把 Files 改成 `getWorkRoot`（仍归 [session-work-root-and-workbench-scope](session-work-root-and-workbench-scope.md)）。

**验证：** `engineMcpSection.test.ts`：活动工作根从 A 变到 B 后再刷新，下一次 `listMcpServers` 的 `workDir` 是 B。透镜测试：绑定会话的 workDir 与活动工作根不同时，`listAgentProfiles` 的 `projectPath` 是绑定会话那份。

## 4. 路径键的盘符（B4）

`normalizeAgentWorkDirKey` 把反斜杠换成斜杠并去掉末尾斜杠，不改大小写（`agentWorkRoot.ts:26-31`）。`normalizeReviewPath` 就是它（`sourcesReviewAttribution.ts:64-66`）。`reviewMutationPathKey` 对 `URI.fsPath` 再走一遍这个函数（`:129-134`）。Windows 上 `URI.fsPath` 的盘符是小写，原始 `workDir` 可以是大写盘符，于是 `isWorkDirCompatible` 与 `engineReviewPathKey` 对不上。

**不变量：** 同一路径的原始 `workDir` 与 `URI.file(workDir).fsPath` 经过 `normalizeAgentWorkDirKey` 后相等。盘符以外的大小写保持原样。

**要动的符号：** `normalizeAgentWorkDirKey` 在规范化斜杠之后，若结果以 `[A-Za-z]:` 开头，把这两个字符里的字母改成小写。`/` 开头的 POSIX 路径不经过这一步。

**验证：** `agentWorkRoot.test.ts:64` 今天断言 `normalizeAgentWorkDirKey('C:\\proj\\')` 等于 `'C:/proj'`。这条改成 `'c:/proj'`。新增：`C:/proj` 与对 `URI.file('C:/proj').fsPath` 的规范化结果相同；`/Proj/A` 与 `/proj/a` 仍不相等。`projectKey` 使用这个键（`agentWorkRoot.ts:101-102`），Files 列表模式把它存进存储键（`sourcesFilesExplorer.ts:78-79`）。Windows 上已存的 `C:` 键在本切片之后对不上 `c:`。不迁移旧键。

## 5. 扫描测试与导入边界（B6、B7）

`conversationEngineFrameSourceScan.test.ts:328` 要求源码含 `reparent(newParent: HTMLElement): void`。`:332` 还要求 `append(newParent, this.element)`。实现是 `reparent(parent: HTMLElement)` 与 `append(parent, this.element)`（`conversationSubAgentOverlay.ts:90`、`:96`）。

**要动的符号：** 这两条断言改成现签名和现调用。不改 `reparent` 的行为。

`extractImportPaths` 只匹配 `from` 后面的说明符（`conversationImportBoundaryScan.ts:52-59`）。`isForbiddenChatImport` 用 `includes('contrib/chat/')` 判断（`conversationImportBoundaries.test.ts:28-31`）。相对说明符里没有这段字面量，白名单分支不会看到它们。fork 文件 `:29-30` 的 `import('...').Type` 没有 `from`，现扫描看不见。

**不变量：** 判定前把相对说明符按源文件目录解析成仓库内的 `src/vs/...` 路径。解析后落在 `contrib/chat/` 且不在 `chatContentParts/` 前缀下的导入，测试失败。`import('...')` 类型引用和 `from` 导入同一标准。

**要动的符号：** 匹配前做这次解析，并让扫描看见 `import('...')`。解析后会失败的生产导入：`conversationForkActions.contribution.ts` 的 `chatForkActions.js`、`chatShellRouting.js`、`chatSessionsService.js`、`chatUri.js`，以及 `:30` 的 `chatSessionsService.js` 类型引用；`conversationKillActions.contribution.ts` 与 `conversationCreateSnapshotActions.contribution.ts` 的 `chatShellRouting.js`。content parts 导入仍允许。`IConversationTurnContentAdapter` 只渲染回合，没有 fork。

路径解析与把上述导入移出 conversation 生产文件放在同一次改动里。引擎 fork 继续走已有的 `tryConnectedEngineFork`。chat 回退仍由本来拥有 `ForkConversationAction` 与 `IChatSessionsService` 的 chat 文件执行，conversation 生产文件不再 import 它们，也不再写 `import('...chatSessionsService.js')`。不新增白名单项，不新建适配器，不允许整个 `contrib/chat/`。找不到已经允许的落点时，解析与迁移都不单独落地。

**验证：** 两条 `reparent` 断言在现签名下通过。边界测试在解析后仍能看见 content parts 允许项，且上述三个生产文件不再出现 `contrib/chat/` 下、content parts 以外的导入，包括没有 `from` 的类型引用。

## 6. 文档

实施时改叙述，不改这些方案的 `status`。

- [giant-file-split](giant-file-split.md) 摘要里的门面 783 行、以及「每文件 ≤800」读起来像已经满足。核对 `wc -l`：`conversationLens.ts` 954，`conversationLensComposerChrome.ts` 1067，`grpcClient.ts` 3404，`grpcClientMappersCatalog.ts` 2773。摘要改成这四个数，并写明 800 上限尚未达到。
- [lens-and-trajectory](../../docs/systems/conversation/lens-and-trajectory.md) 第 79 行写对话页时间线、overlay、座位与轨迹页共用 `passesTrajectoryAgentFilter`。时间线在调用这条过滤之前，会为 permission 行和工具行从 `pendingActions` 借 `agentId`（`conversationSessionView.ts:386-424`、`:444-456`）。轨迹直接调用该过滤（`conversationTrajectoryModel.ts:198`）。overlay 仍把 `filterAgentId` 交给透镜（`conversationSubAgentOverlay.ts:211`）。替换句写成：时间线、overlay、座位与轨迹页仍用这条过滤；时间线在过滤前为 permission 行和工具行借 `agentId`。不在本稿合并两套投影。
- [conversation overview](../../docs/systems/conversation/overview.md) 第 74 行写：只借 `chatContentParts/**` 渲染函数，经 `IConversationTurnContentAdapter` 单点入参；`chatShellRouting.ts` 把默认窗的 Chat 入口转到本 Part。fork、kill、snapshot 三份贡献文件还直接引用 chat 的 action、会话服务或 `chatShellRouting`。在 §5 落地前，在这句后面补上这三份文件的直接引用。保留句中已有的 content parts 与 `chatShellRouting` 转向。§5 落地后，再按那时的导入改这一句。
- [session-work-root](session-work-root-and-workbench-scope.md) §1 第 30 行仍列 `sourcesGitNormalizedRoot` 与 `sourcesFilesNormalizedRoot`。仓库里已没有这两个函数。`sourcesChangesGitRead.ts:168` 现在是 `sourcesGitChangeResource`，走 `normalizePath`（`:169-170`）。仍在用的是 `sourcesFilesWorkDirIsWorkspaceRoot`（`sourcesFilesEngineRead.ts:51`）、`normalizeReviewPath` 与 `isWorkDirCompatible`（`sourcesReviewAttribution.ts`）、`normalizeNavigatorWorkDirKey`、`normalizeAgentWorkDirKey`。`normalizeEnginePath`（`sourcesFilesEngineRead.ts:205`）是文件私有的斜杠规范化，不写进这句。不改该方案的实施切片。
- 不改 `sessionCore/SYNC.md`。`writeSyncDoc`（`scripts/sync-universe-agent-session-core.ts:269-284`）用固定模板整文件覆盖。自 `a4ab1a3e754` 之后有 24 个提交改过该目录（核对命令 `git log --oneline a4ab1a3e754..HEAD -- src/vs/platform/universeAgent/node/sessionCore`）。协议面 G-CORE-2 已点本地提交 `37a13e74d7b`，钉点仍是 `0dd3146cd`。实施时在该协议行补上这笔数和核对命令，保留已有的 `37a13e74d7b`。不决定分叉还是先改上游。

## 7. 不在本稿

- Q1 不可变链路对象、Q2 按窗口连接、Q3 异步原语放哪、Q4 扫描测试是否还算证据、Q5 首选项是否独立 contrib 以及 sessionCore 是否正式分叉、Q6 工作根存哪一级、Q7 Files 是否改读 `localRoot`。
- A1–A5 的大方向：单一投影器、拆连接接口、迁 contrib、引入 `Throttler`。
- B5 窗口通道权限。产品仍是全应用一条连接。收紧到调用方窗口会变成按窗口连接，等 Q2。
