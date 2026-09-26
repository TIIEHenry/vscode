---
title: "Sources 变更：越界路径、diff 丢行、Files 重复与失真、本地写被误关"
type: plan
status: accepted
phase: M7
updated: 2026-09-25
summary: "BH-15-2 至 BH-15-6 成立。2026-09-25：多根写操作落到所属仓库；引擎行仅在 workDir 等于本地根时可打开。BH-15-7 驳回。"
---

# Sources 变更：越界路径、diff 丢行、Files 重复与失真、本地写被误关

本稿是方案，不是实施。

**冲突域：** `sources.contribution`、`sourcesChangeEntryOpen`、`sourcesChangesList`、`sourcesFilesList`、`sourcesFilesListStrings`、`sourcesListFilterBox`、`sourcesTabsHost`，以及 common 下 `sourcesChangeRef`、`sourcesChangesGit`、`sourcesChangesGitRead`、`sourcesChangesGitWrite`、`sourcesChangesModel`、`sourcesFilesModel`、`sourcesFilterModel`、`sourcesTabs`。

不要改 `sourcesReview*` / `sourcesDiff*` / `conversationDiffReview`（另一路）。

与 [sources-review-open-identity](../sources-review-open-identity.md) 重复的只交叉引用，不另起实施切片。

**2026-09-25 产品与架构裁定（取代「多根保持开放」）：** 打开 diff 与逐行 Stage 落到该行自己的仓库。提交落到唯一有暂存改动的仓库，并标出仓库名；没有暂存或两个以上仓库都有暂存时禁用提交。引擎行用会话已有的 `workDir`：规范化后恰好等于一个本地仓库根（或无 SCM 时等于一个工作区文件夹）才可当本地文件打开；对不上就列出、不可打开，不猜第一仓。引擎行的 Stage / Commit 走 `sessionId`，不退回本地 `acceptInputCommand`。不给 git RPC 加 workDir 字段。本裁定取代下文「不改 `getGitResourceRoot` / `runCommit` 选仓」。S1 根内判定仍以新的 `getGitResourceRoot` 为界。

## 核查

| 条目 | 判定 | 理由 |
|:-----|:-----|:-----|
| BH-15-1 | 成立 | `getPrimaryRepository`（`sourcesChangesList.ts` 约 468–472）取 `repositories` 第一项；`getGitResourceRoot`（约 702–708）用它或 `folders[0]`；`runCommit`（约 870–926）把说明和 `acceptInputCommand` 打到这个 `activeRepository`。相对路径经 `sourcesGitChangeResource` 接到这个根上。2026-09-25 文首裁定收口，不再延期。 |
| BH-15-2 | 成立 | `sourcesGitChangeResource`（`sourcesChangesGitRead.ts` 约 128–135）对非绝对路径 `URI.joinPath`；`URI.joinPath`（`uri.ts` 约 360–370）在非 Windows `file` 上走 `posix.join`，`..` 可以折到根外。绝对路径直接 `URI.file`，也不比对根。打开用 `entry.resource`（`resolveSourcesChangeRef` 约 71–83）。 |
| BH-15-3 | 成立 | `parseSourcesGitUnifiedDiff`（约 179–186）在进入 hunk 之前无条件丢掉以 `diff ` / `index ` / `--- ` / `+++ ` 开头的行。hunk 正文因此少行。`applySourcesGitFileDiffIfNeeded`（`sourcesChangeEntryOpen.ts` 约 88–99）把丢掉行之后的两侧写入预览，Accept 仍带原始 `unifiedDiff`。 |
| BH-15-4 | 成立 | 已解析目录走 `item.children`（`sourcesFilesModel.ts` 约 62–66），嵌套文件仍留在该 map 里；文件分支再递归 `nestedChildren`（约 53–56）。`ExplorerItem.fetchChildren`（`explorerModel.ts` 约 337–366）只从返回列表拿掉被嵌套文件，不从 `children` 删除。同一文件列两次。 |
| BH-15-5 | 成立 | `SourcesFilesList` 构造（`sourcesFilesList.ts` 约 121–126）只听文件变化和 `explorer.sortOrder` / `explorer.fileNesting`。`ExplorerModel`（约 43–45）在工作区文件夹变化时重设 `roots` 并触发 `onDidChangeRoots`。`IExplorerService` 不暴露该事件。列表不刷新。 |
| BH-15-6 | 成立 | `refresh` 的 catch（`sourcesChangesList.ts` 约 609–620）只要 `tryLoadGitEntries` 抛错就置 `leftoverListFailed`，不看 `usingGitRead`。`isSourcesGitWriteClosed`（约 389–390）把该旗关进 Stage / Unstage / Commit。此前若是 SCM 回落（`usingGitRead === false`），行仍是 `lastGoodEntries`，本地 `git.stage` 在 `runResourceAction`（约 761–762）早退。D442 锁的是引擎 git-read 成功后再抛错。 |
| BH-15-7 | 驳回 | `openSourcesChangeInPreview`（约 124–129）确实在 `pinned` 时钉 `activeEditorPane`。Git 默认命令是 `vscode.diff` / `vscode.open`，登记时只 `toInternal`，不进 `_resourceStatesCommandsMap`（`extHostSCM.ts` 约 486–492）。`$executeResourceCommand`（约 463–470）因此直接返回，不会打开编辑器。原生 SCM 对这两条命令走 `command.id`（`scmViewPane.ts` 约 1710–1728），`open` + `pinEditor` 只在 else（约 1729–1736）。Sources 这条路径没有「刚打开的预览 diff」可被钉错。 |

## Problem class

- **症状：** 引擎相对路径可以打开仓库外的文件；统一 diff 预览少了形如文件头的增删行，和将要应用的补丁不一致；Files 把已嵌套文件列两次，增删工作区文件夹后列表仍是旧的；引擎读失败后，仍显示的本地 SCM 行不能暂存或提交。
- **类标签：** **根外 URI 当工作区文件** + **文件头规则吃掉 hunk 正文** + **已解析目录不走嵌套过滤** + **文件夹变化不调度刷新** + **list-fail 旗标误关 SCM 回落写面**。
- **复发机制：** 打开只信 `entry.resource`；解析不区分文件头与 hunk；Files 收集把 `children` 和 `nestedChildren` 加在一起；刷新订阅不含工作区文件夹；`leftoverListFailed` 不区分引擎 leftover 与本地 SCM 行。

## 0. 一句话结论

引擎变更的资源必须落在本次使用的仓库根之内，否则不要当可打开的工作区文件。统一 diff 只在第一个 `@@` 之前跳过文件头。已解析目录与未解析目录共用 `fetchChildren` 的可见子项。工作区文件夹变化后调度 Files 刷新。只有当前行来自引擎 git-read 时，读失败才置 `leftoverListFailed`。多根仓库按文首 2026-09-25 裁定在本稿收口，不再另起切片。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 仓库根是第一个 SCM 仓库，否则工作区第一个文件夹 | `sourcesChangesList.ts` `getPrimaryRepository` / `getGitResourceRoot` |
| 提交框同步并提交这个 `activeRepository` | 同文件 `syncCommitInputFromRepository` / `runCommit` |
| 多根第一 repo 与 chip `workDir` 分叉已记在打开身份方案，该波拒绝重做 list URI join | [sources-review-open-identity](../sources-review-open-identity.md) §1、选项 E、S4 |
| 非绝对路径 `URI.joinPath(root, path)`；绝对路径 `URI.file` | `sourcesChangesGitRead.ts` `sourcesGitChangeResource` |
| `joinPath` 规范化，不检查是否仍在根下 | `uri.ts` `URI.joinPath` |
| 打开的 modified 是 `entry.resource` | `sourcesChangeRef.ts` `resolveSourcesChangeRef` |
| 文件头跳过发生在 `inHunk` 判断之前 | `parseSourcesGitUnifiedDiff` |
| 预览写两侧；`unifiedDiff` 仍是引擎原串 | `applySourcesGitFileDiffIfNeeded` |
| 已有测只锁普通 hunk（` keep` / `-old` / `+new`），不锁正文以 `++ ` 或 `-- ` 开头的行 | `sourcesChangesGitRead.test.ts` |
| 已解析目录展开 `children`；未解析才 `fetchChildren` | `sourcesFilesModel.ts` `collectFromItem` |
| 嵌套启用时，被嵌套文件留在 `children`，返回列表不含它们，并挂到父文件 `nestedChildren` | `explorerModel.ts` `fetchChildren` |
| Files 列表不订阅工作区文件夹变化；`IExplorerService` 无 `onDidChangeRoots` | `sourcesFilesList.ts` 构造；`files.ts` `IExplorerService` |
| Explorer 在 `onDidChangeWorkspaceFolders` 里同步 `setRoots` 再 fire | `explorerModel.ts` 构造 |
| catch 一律 `leftoverListFailed = true`，再画 `lastGoodEntries` | `sourcesChangesList.ts` `refresh` |
| 该旗关闭 Stage / Unstage / Commit，并让 `runResourceAction` 在本地 `git.stage` 之前返回 | `isSourcesGitWriteClosed` / `runResourceAction` |
| D442 夹具是先画引擎行再让 `readGitChanges` 抛错 | `sourcesChangesList.test.ts` `list-fail leftover closes Stage / Commit` |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 根内资源、hunk 内保留正文、可见子项只列一次、文件夹变化刷新、list-fail 只关引擎 leftover** | §3 | **选定** |
| B 本稿重做多根第一仓库根 / 提交框绑定选中行 | 提交不按选中行 | **拒绝按选中行。** 2026-09-25 文首改为所属仓库 / 唯一暂存仓，不猜第一仓 |
| C 路径越界时改写成根内某个替代路径 | 会打开错误文件 | **拒绝。** 只规范化并拒绝越界 |
| D 继续按整行前缀丢弃 `+++ ` / `--- ` | 预览与 `unifiedDiff` 继续分叉 | **拒绝** |
| E 已解析目录跳过 `nestedParent` 已设置的子项，不调用 `fetchChildren` | 与资源管理器过滤双实现 | **拒绝。** 已解析也走 `fetchChildren` |
| F 给 `IExplorerService` 新加 `onDidChangeRoots` | 超出冲突域 | **拒绝。** 听已有的工作区文件夹事件，刷新仍走现有 250ms 调度 |
| G SCM 回落 leftover 也保持 `leftoverListFailed` | 本地暂存/提交继续被关掉 | **拒绝。** D442 只覆盖引擎 git-read leftover |
| H 按 BH-15-7 去钉「刚打开的预览」 | HEAD 上 Git 默认命令的 `open()` 不打开编辑器 | **拒绝** |

## 3. 选定设计

1. **BH-15-1 由 2026-09-25 文首裁定接手。** 打开身份方案仍不做 list URI join、不改 `fileMutationJoin`。仓库选择改文首规则：本地行用该行自己的 SCM 仓库；引擎行只用与 `workDir` 严格相等的根。S1 根内判定以改后的 `getGitResourceRoot` 为界，不放宽。

2. **S1 根内资源（BH-15-2）。** `sourcesGitChangeResource` 在已有 `rootUri` 时，先按今天的绝对 / 相对规则拼出候选 URI，再规范化。判定用 `isEqualOrParent(候选, rootUri)` 的返回值，不另写一套只比路径的比较。scheme 不同、或 `file` 的 query / fragment 对不上，该函数为 false，候选按越界处理。
   越界时：`collectSourcesGitChangeEntries` **不收录**该条，条目上不留这个 URI；打开路径没有可点的 `entry.resource`，因此不会 `openEditor` 或 `getQuickDiffs`。`workDir` 对不上已选根时：行可以列出，但不生成 `entry.resource`，禁止 `URI.file(path)` 猜第一仓或工作区根。路径逃出已经选定的根才丢弃。提交只在恰好一个仓库有暂存时启用，并标出该仓库名；引擎行的 Stage / Commit 只走 `sessionId`。不改协议字段。不改 `sourcesReview*`。

   **不变量：** 有根时，可打开的 `resource` 的路径规范化之后仍在该根之下。越界候选不可打开。`gitPath` 仍是引擎给出的原字符串。

3. **S2 hunk 正文（BH-15-3）。** `parseSourcesGitUnifiedDiff` 在第一个 `@@` 之前，文件头（`diff ` / `index ` / `--- ` / `+++ `）以及其它前言行一律跳过，与今日 `if (!inHunk) continue` 相同。进入 hunk 之后，以 `+` 开头的行只进 modified，以 `-` 开头的行只进 original，以空格开头的行两侧都进，各自去掉这一个前缀。`\` 开头的行维持跳过。空串两侧仍空。`applySourcesGitFileDiffIfNeeded` 继续把引擎原串放进 `unifiedDiff`，预览两侧改为这份解析结果。

   **不变量：** 第一个 `@@` 之后，正文里以 `+` / `-` / 空格开头的行都出现在对应一侧。Accept 载荷仍是原 `unifiedDiff`，不是两侧拼回去的文本。

4. **S3 嵌套只列一次（BH-15-4）。** `collectFromItem` 对目录一律 `await item.fetchChildren(sortOrder)`，包括 `_isDirectoryResolved === true`。文件分支仍只递归该文件自己的 `nestedChildren`。不要在已解析分支改读 `children.values()`。

   **不变量：** `explorer.fileNesting.enabled` 且目录已解析时，每个 `resource` 在 `collectSourcesFileEntries` 的结果里只出现一次。未启用嵌套时，子项集合与今天 `fetchChildren` 的非嵌套分支一致。

5. **S4 文件夹变化刷新（BH-15-5）。** `SourcesFilesList` 订阅 `IWorkspaceContextService.onDidChangeWorkspaceFolders`，与文件变化一样 `scheduleRefresh`。不扩展 `IExplorerService`。现有 `RunOnceScheduler`（250ms）在 Explorer 同步 `setRoots` 之后才 `refresh`，读到的是新的 `explorerService.roots`。

   **不变量：** 增删工作区文件夹后，下一次刷新的根集合等于当时的 `explorerService.roots`。没有文件夹事件时，不额外刷新。

6. **S5 list-fail 只关引擎 leftover（BH-15-6）。** `refresh` 的 catch 仅当进入 catch 时 `usingGitRead === true` 才置 `leftoverListFailed`。此时行仍是引擎 leftover，Stage / Unstage / Commit / FileDiff 关门与 D442 相同。`usingGitRead === false` 时不置该旗（保持 false），继续画 `lastGoodEntries` 和 `sourcesGitReadFailureMessage`，本地 `git.stage` / `git.unstage` / `acceptInputCommand` 仍走今天 SCM 回落成功时的那条路径。空列表（`lastGoodEntries.length === 0`）维持失败态，不把空列表画成成功。

   **不变量：** `leftoverListFailed === true` 意味着可见行来自引擎 git-read leftover。SCM 回落行在随后的读失败里仍可本地暂存和提交。引擎 leftover 的 0 `writeGitStagePaths` / 0 `writeGitCommit` / 0 `git.unstage` 不变。

## 4. 不做

- 不猜第一仓，不按选中行决定提交目标，不给 git RPC 加 workDir（多根规则见文首 2026-09-25）
- 改 `sourcesReview*`、`sourcesDiff*`、`conversationDiffReview`
- 改 `extensions/git`、`extHostSCM`、`scmViewPane` 的打开命令
- 为 BH-15-7 改 `pinEditor`
- 给越界路径造一个根内替代 URI，或新增协议字段
- 把预览两侧拼回当作 Accept 载荷
- 给 `IExplorerService` 增加 `onDidChangeRoots`
- 重开 GitHub Actions

## 5. 验证

本地 `scripts/test.sh --run` 点名下列文件。不要重开托管 workflow。

| 现有路径 | 该加的断言 |
|:---------|:-----------|
| `src/vs/workbench/contrib/sources/test/browser/sourcesChangesGitRead.test.ts` | 有根时，规范化后不在根下的相对路径不作为可打开 `resource`。绝对路径同样：不在该根下则不可打开。根内相对路径仍等于 `URI.joinPath`。`parseSourcesGitUnifiedDiff`：第一个 `@@` 之后，新增行正文以 `++ ` 开头、删除行正文以 `-- ` 开头时，两侧各自保留该正文。文件头 `--- ` / `+++ ` 在 `@@` 之前仍不进两侧。空串不变。 |
| `src/vs/workbench/contrib/sources/test/browser/sourcesFilesModel.test.ts` | 嵌套启用、目录 `_isDirectoryResolved`、父文件带 `nestedChildren` 且被嵌套文件仍在 `children` 时，收集结果每个 `resource` 只出现一次。 |
| `src/vs/workbench/contrib/sources/test/browser/sourcesFilesList.test.ts` | 列表画完后触发工作区文件夹变化（期间无 `onDidFilesChange`），下一次刷新使用新的 `explorerService.roots`。 |
| `src/vs/workbench/contrib/sources/test/browser/sourcesChangesList.test.ts` | 既有 `list-fail leftover closes Stage / Commit` 仍绿（引擎行 leftover，写关）。另加：先 SCM 回落画出带 `scmResource` 的本地行（`usingGitRead` 为 false），再让 `readGitChanges` 抛错：行仍在，`leftoverListFailed` 为 false，强制点击仍执行 `git.stage`（或现有 unstage 命令），且 `writeGitStagePaths` 调用次数与今天 SCM 回落成功路径一致。 |

`sourcesFilesListStrings.test.ts` 无新文案则不必改。分层未动，不跑 `npm run valid-layers-check`。
