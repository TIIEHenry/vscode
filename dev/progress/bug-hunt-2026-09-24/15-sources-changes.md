---
title: 潜在缺陷：Sources 变更
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: Changes 会把相对路径接到错误仓库根上打开，Files 在嵌套与换工作区后列表失真，统一 diff 预览会丢掉以加号或减号开头的行。
---

# 潜在缺陷：Sources 变更

## 结论

扫描范围内有 7 条用户可见缺陷：多根工作区打开变更会落到第一个仓库的同名路径，相对路径里的 `..` 能跳出仓库根，统一 diff 预览丢掉形如文件头的增删行，Files 在已展开目录上会重复列出嵌套文件，增删工作区文件夹后 Files 不刷新，引擎读失败会把仍在显示的本地 SCM 行的暂存和提交关掉，固定 SCM 打开的编辑器时可能钉住当前焦点页。与 `dev/progress/deferred-gaps.md` 无同条。

## 发现

### BH-15-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts` `getPrimaryRepository` 约 468–472 行，`getGitResourceRoot` 约 702–707 行；相邻 `src/vs/workbench/contrib/scm/common/scmService.ts` `getRepository` 约 427–441 行会按资源选最近仓库，本列表没有用它。提交框写的也是这个 `activeRepository`（`runCommit` 约 870–886 行）
- 行为：仓库根取 `scmService.repositories` 的第一项，没有 SCM 时取工作区第一个文件夹。引擎变更的相对路径经 `sourcesGitChangeResource` 接到这个根上。提交说明和本地 `acceptInputCommand` 也只打到这个仓库。
- 为何是缺陷：多文件夹工作区里，另一个仓库的 `src/a.ts` 会打开或显示成第一个仓库里的同名文件。提交说明写进第一个仓库，列表上其余仓库的变更并不在这次提交里。
- 触发：至少两个 SCM 仓库或两个工作区文件夹，引擎 `ReadGitChanges` 给出相对路径，用户在 Changes 里打开该行或提交。
- 已知：无
- 修复方向：用变更路径或会话工作区根去匹配 `getRepository`，提交框只绑定当前选中行所在仓库。

### BH-15-2

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/sources/common/sourcesChangesGitRead.ts` `sourcesGitChangeResource` 约 128–135 行。`URI.joinPath`（`src/vs/base/common/uri.ts` 约 360–370 行）对非 Windows `file` 使用 `posix.join`，会把 `..` 折到根外
- 行为：非绝对路径一律 `URI.joinPath(rootUri, path)`，不限制在仓库根内。打开走 `entry.resource`（`sourcesChangeEntryOpen.ts` `resolveSourcesChangeRef` 约 71–83 行）。
- 为何是缺陷：路径 `../` 跳出仓库后，点击变更会打开仓库外的文件，而不是该变更在仓库内的文件。
- 触发：引擎条目的 `path` 含 `..` 或绝对路径段，且存在 `rootUri`。
- 已知：无
- 修复方向：拼接后若结果不是仓库根的子路径，则不要把它当作可打开的工作区文件。

### BH-15-3

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/sources/common/sourcesChangesGitRead.ts` `parseSourcesGitUnifiedDiff` 约 179–186 行；写入预览模型在 `src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts` `applySourcesGitFileDiffIfNeeded` 约 84–100 行
- 行为：循环里凡是以 `diff `、`index `、`--- `、`+++ ` 开头的行都丢弃，不区分文件头和 hunk 正文。hunk 内新增行若正文以 `++ ` 开头，整行是 `+++ `，被当成文件头丢掉；删除行正文以 `-- ` 开头时同样被丢掉。
- 为何是缺陷：预览两侧少了这些行，用户看到的 diff 和引擎返回的统一 diff 不一致。Accept 仍携带原始 `unifiedDiff`，界面和将要应用的补丁对不上。
- 触发：打开一条需要 `ReadGitFileDiff` 的引擎行，且 hunk 里有上述正文。
- 已知：无
- 修复方向：只在进入第一个 `@@` 之前跳过文件头；hunk 内按首字符 `+` / `-` / 空格还原正文。

### BH-15-4

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/sources/common/sourcesFilesModel.ts` `collectFromItem` 约 62–66 行。相邻 `src/vs/workbench/contrib/files/common/explorerModel.ts` `fetchChildren` 约 337–366 行：嵌套启用时，被嵌套的文件留在 `children` 里，只从返回列表拿掉，并挂到父文件的 `nestedChildren`
- 行为：目录已经 `_isDirectoryResolved` 时，Files 直接展开 `item.children`，再对文件的 `nestedChildren` 递归。未解析时才走 `fetchChildren`，后者不会把嵌套文件再放进顶层。
- 为何是缺陷：资源管理器一旦展开过该目录，Sources Files 会把同一个嵌套文件列两次。过滤和打开都对着重复行。
- 触发：`explorer.fileNesting.enabled`，目录已解析，父文件带 `nestedChildren`，然后打开 Sources Files 或触发其刷新。
- 已知：无
- 修复方向：已解析目录也走 `fetchChildren`，或跳过 `nestedParent` 已设置的子项。

### BH-15-5

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/sources/browser/sourcesFilesList.ts` 构造函数约 121–126 行只听文件变化和 `explorer.sortOrder` / `explorer.fileNesting`。相邻 `src/vs/workbench/contrib/files/common/explorerModel.ts` 约 43–45 行在工作区文件夹变化时重设 `roots` 并触发 `onDidChangeRoots`，Files 列表没有订阅
- 行为：首次刷新之后，增删工作区文件夹不会 `scheduleRefresh`。列表仍是上一次 `collectSourcesFileEntries` 的结果。
- 为何是缺陷：新文件夹的文件不出现，已移除文件夹的文件还在。点旧行会打开已经不在工作区里的路径。
- 触发：Sources Files 已经画过列表，再添加或移除工作区文件夹，期间没有别的文件变更事件。
- 已知：无
- 修复方向：监听工作区文件夹变化或 Explorer `onDidChangeRoots`，与文件变更一样调度刷新。

### BH-15-6

- 严重度：medium
- 置信度：中
- 位置：`src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts` `refresh` 的 catch 约 609–620 行；`isSourcesGitWriteClosed` 约 389–390 行把 `leftoverListFailed` 加进暂存、取消暂存和提交门闩
- 行为：`tryLoadGitEntries` 抛错时，无论当前行是否来自引擎 git-read，都置 `leftoverListFailed`。此前若是本地 SCM 列表（`usingGitRead === false`），行仍留在界面上，但 Stage / Unstage / Commit 被关掉。
- 为何是缺陷：引擎读失败之后，用户看到的仍是本地源代码管理变更，行上的暂存和提交却不可用，本地 `git.stage` 也不会执行。
- 触发：上一次成功刷新走了 SCM 回落并画出本地行，下一次 `readGitChanges` 或 `readGitSummary` 抛错。
- 已知：无。D442 关的是引擎 git-read 失败后仍像活写面；这里是本地 SCM 行被同一旗标关掉
- 修复方向：只有 `usingGitRead` 的 leftover 才置 `leftoverListFailed`；SCM 回落列表保持本地暂存和提交。

### BH-15-7

- 严重度：low
- 置信度：中
- 位置：`src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts` `openSourcesChangeInPreview` 约 124–129 行。相邻 `src/vs/workbench/api/browser/mainThreadSCM.ts` `MainThreadSCMResource.open` 约 161–162 行把 `preserveFocus` 原样交给扩展命令
- 行为：有 `scmResource` 时先 `open(preserveFocus)`，若 `pinned` 则对 `editorService.activeEditorPane` 执行 `pinEditor`，不用刚打开的那份输入。
- 为何是缺陷：保持焦点打开时，活动编辑器往往仍是原来的页。固定操作会钉住它，Sources 刚打开的 diff 仍是预览页，随后会被下一次打开替换。
- 触发：Changes 里对带 SCM 资源的行使用固定打开（`pinned: true` 且 `preserveFocus: true`）。
- 已知：无
- 修复方向：钉住本次 `open` 打开的编辑器输入，而不是当前活动页。

## 看过但未立条

- `sourcesGitChangeGroupId` 对空 `index_state` 返回空组、不发明暂存组，测试锁了这个合同，属有意 fail-closed。
- `parseSourcesGitUnifiedDiff` 只还原 hunk、不补全文，注释写明不发明省略的文件正文。
- Changes 的 pairing-hold、no-hook leftover、list-fail 保留行，以及 Stage / Commit / Unstage / FileDiff 关门，对应已关的 D244、D273、D283、D312、D327、D342、D367、D442、D444、D459，不另立。
- Files `fetchChildren` 抛错保留 leftover 并画失败文案，是已关的 D215。
- 引擎条目没有 `scmResource` 时 Unstage 显示不可用，是有意诚实态，不是假按钮。
- `SourcesListFilterBox` 只在 `input` 时发当前值；页签左右键会真正切换，Enter / Space 在自动激活模式下只是聚焦，没有单独的选错页。

## 未读完

- 排除的 `sourcesReview*`、`sourcesDiff*`、`conversationDiffReview` 未逐行看，只在打开路径上读了 `watchSourcesDiffPanelComparison` 与会话 diff 失败文案的调用点。
- Git 扩展里 SCM 资源命令在 `preserveFocus` 时是否偶尔仍会激活新编辑器，没有读完；BH-15-7 因此标中等置信度。
- `sourcesChangesList.test.ts` 与 `sourcesFilesList.test.ts` 只抽查了与上述路径相关的断言，没有通读。
