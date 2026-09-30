---
title: "方案 r16：extensions"
type: plan
status: accepted
phase: N/A
updated: 2026-09-30
summary: "2026-09-30 用户签收。未实施。五条均 hold：登录写回须合并当时的会话列表，gitfile 仓库的 rebase/merge/cherry-pick 须读 git-dir，暂存选区按行边界取并集，blame 用修改后行号判断是否越过 hunk。"
---

# 方案 r16：extensions

核查对照发现稿：hold 5，drop 0，weaken 0。只改下列行为。

## r16-1

- 问题类：GitHub 网页登录或退出在让出事件循环之前拿住会话数组，写密钥串时整份盖掉其他窗口已经改过的列表。
- 不变量：`createSession` 的非 Microsoft 分支在 `login` 与 `tokenToSession` 都完成之后，才读取当时的 `_persistedSessionsPromise`，只在这份结果的副本上按「账号 id + 排序后的 scopes」替换或追加本次会话，再交给 `storeSessions`。`removeSession` 的持久会话分支同样在副本上按会话 id 删除，而且 `await` 期间若 `checkForUpdates` 已经把字段换成新的 promise，跟到字段上仍指向的那一次，不用 await 开始时抓住的旧 promise。取到数组、改副本、调用 `storeSessions` 这三步之间不再 `await`。`storeSessions` 仍在 `setToken` 之前同步把 `_persistedSessionsPromise` 设成这份副本。字段在 `login` / `tokenToSession` 让出期间已被 `checkForUpdates` 换成新数组时，写回用这份新数组：其中另一窗口刚加上的账号留下来，其中另一窗口已经删掉的令牌不会被登录开始前的旧数组写回去。
- 要动的符号或文件：`extensions/github-authentication/src/github.ts` 的 `GitHubAuthenticationProvider.createSession`（现第 736–749 行，`sessions` 取在 `login` 之前）和 `removeSession` 的持久会话分支（现第 887–893 行）。两处共用一个私有读取：循环跟随 `_persistedSessionsPromise`，直到 await 完的那个 promise 仍是字段当前值，再 `slice()` 出副本。匹配条件保持现有的 `findIndex`（登录看账号 id 与排序后的 scopes，退出看会话 id）。
- 明确不改什么：不改 Microsoft 分支 `createMicrosoftSession`（令牌不进密钥串）。不改 `checkForUpdates` 的增删比较和事件。不改 `readSessions` 在数字账号 id 或会话被丢掉时调用 `storeSessions` 的迁移（约第 689 行）。不在这个读取里调用 `readSessions` 或 `storeSessions`。不改 `storeSessions` 先更新 promise 再 `setToken` 的顺序。不改 `afterSessionLoad` 不 await。不改退出时瞬时会话的提前返回（约第 877–885 行）。不改登录成功事件的形状 `{ added: [session], removed, changed: [] }`。密钥串仍是整份 `setToken`，不加跨进程锁，写入前也不主动 `readSessions()`。两段窗口不在这次处理：`setToken` 进行中与另一窗口同时写完的后写覆盖；对方 `setToken` 已经落盘，但本窗口 `secrets.onDidChange` 还没派发、`_persistedSessionsPromise` 因此还是旧数组。
- 本地验证：`scripts/test-integration.sh --suite github-authentication --grep "GitHub session persistence"`。mocha 用套件名加测试名匹配，这条会跑到同套件里现有的 `does not loop when Codespaces secret storage drops hydrated account data`。`GitHub Microsoft-brokered sessions` 不在这个 grep 里，另跑 `scripts/test-integration.sh --suite github-authentication --grep "GitHub Microsoft-brokered sessions"`。在 `extensions/github-authentication/src/test/github.test.ts` 的 `GitHub session persistence` 里新增：`login` 的 await 期间把 `_persistedSessionsPromise` 换成含另一账号的新数组，完成后 `setToken` 的 JSON 同时含该账号和本次新会话。另一条：`removeSession` 等待的那次 promise 在 await 期间被换成「已不含另一令牌」的列表，写回结果既不含被退出的 id，也不含那个已被另一窗口删掉的令牌。

## r16-2

- 问题类：链接 worktree 和 gitfile 形式的 submodule 把 rebase、merge、cherry-pick 状态文件拼在工作树根的 `.git` 下面，那个路径不是目录，状态读不到。
- 不变量：`REBASE_HEAD`、`rebase-apply`、`rebase-merge`、`MERGE_HEAD`、`CHERRY_PICK_HEAD` 都从 `this.repository.dotGit.path`（`rev-parse --git-dir` 的绝对路径）往下读。链接 worktree 里 `.git` 是 gitfile、状态文件只在 per-worktree git-dir 时，`getRebaseCommit` 仍返回 `REBASE_HEAD` 里的提交，`isMergeInProgress` / `isCherryPickInProgress` 仍为真。普通仓库 `.git` 是目录时，`dotGit.path` 就是该目录，结果与现在一致。`REBASE_HEAD` 内容不是本仓库提交时，`getCommit` 失败仍进现有 `catch` 并返回 `undefined`。
- 要动的符号或文件：`extensions/git/src/repository.ts` 的 `getRebaseCommit`、`isMergeInProgress`、`isCherryPickInProgress`（现第 3137–3165 行）。五处 `path.join(this.repository.root, '.git', …)` 改为 `path.join(this.repository.dotGit.path, …)`。抽一个文件内函数拼这个路径并导出给测试，不放进 `api/git.d.ts`。
- 明确不改什么：不改用 `dotGit.commonPath`（链接 worktree 的这五个文件在 per-worktree git-dir，不在 common dir）。不改 `commit()` 的分支：只有 `rebaseCommit` 为真时走 `rebaseContinue()`，否则仍 `repository.commit`。不给 cherry-pick 加 Continue 或 `cherry-pick --continue`。不改 `actionButton.ts`、`statusbar.ts`、`package.json` 的 when / enablement。不改 `commands.ts` 里 `getCommit('REBASE_HEAD')` / `getCommit('MERGE_HEAD')`。不改 `fs.exists` / `readFile` 的写法，不改「目录不存在或读失败就当没有 rebase」的 `catch`。不改公开 `RepositoryState`。
- 本地验证：`scripts/test-integration.sh --suite git --grep "git dir operation state"`。这条 grep 跑不到 `git smoke test`，回归另跑 `scripts/test-integration.sh --suite git --grep "reflects working tree changes"`。新测试先断言路径函数：root 为工作树、`dotGit.path` 为 `/repo/.git/worktrees/wt` 时，五个文件名都落在该 git-dir 下，不落在 `root/.git` 下。再用临时仓库 `git worktree add`。空的 `rebase-merge` 目录加上 `REBASE_HEAD` 时，本机 Git 2.34.1 的 `git status -z -uall` 仍退出 0，有无 `head-name` 都一样，`repository.status()` 不会因此 reject。成功路径可以仍放 `head-name`，并放内容为本仓库真实提交的 `REBASE_HEAD`（工作树根的 `.git` 保持 gitfile）。若要保留 status 拒绝夹具，另起一份：把 worktree git-dir 的 `index` 写成非法短内容，使 `git status -z -uall` 退出 128；该提交的 `git show` 仍成功，这样第 2921 行的赋值发生在 status 抛错之前。`getHEADRef` / `getSubmodules` / `getInputTemplate` 会吞掉这次失败。按 `smoke.test.ts` 激活 `vscode.git` 后，用 API `git.openRepository(Uri.file(worktreeRoot))` 打开 worktree 根，不要打开主仓库，也不要靠命令 `git.openRepository`（它只返回 `Promise<void>`）。`model.openRepository` 不 await 初次 `status()`（`model.ts` 第 745–746 行），`rebaseCommit` 要到 `status()` 里的 `_updateModelState`（`repository.ts` 第 2921 行）才赋值。所以对返回的 `Repository` 先 `await repository.status()`，再断言 `state.rebaseCommit` 的 hash 等于该提交。无效哈希在同一次 `status()` 之后必须仍是 `undefined`，不能单独当通过。`status()` 被拒绝时，断言仍读已经赋上的 `state.rebaseCommit`（第 2921 行之后的 `getStatus` 失败不会清掉该字段），并写明这条与「status 成功」是分开的夹具。公开 `RepositoryState` 没有 `isMergeInProgress` / `isCherryPickInProgress`，不改 `git.d.ts`。三处都走同一个已导出的路径函数。另加会在现状失败的断言：worktree 的 git-dir 里放 `MERGE_HEAD`、`CHERRY_PICK_HEAD`（工作树根的 `.git` 仍是 gitfile），直接调用与这两个方法相同的存在性判断，期望为真；同一组文件若只放在 `root/.git` 下则期望为假。只检查路径字符串、不执行这两个方法，不算这条不变量通过。

## r16-3

- 问题类：选区终点在下一行第 0 列时，「暂存选定范围」把终点那一整行也算进暂存范围；取消暂存同样多撤一行。
- 不变量：`toLineRanges` 在终点 `character === 0` 且 `end.line > start.line` 时，行范围的末行是 `end.line - 1`，不调用 `lineAt(s.end.line)` 把终点行整行纳入。终点列号大于 0 时仍扩成终点行整行。同一行上的光标（`end.line === start.line`）仍扩成该行整行。`Selection.start` / `end` 已是文档顺序，不看 anchor / active。
- 要动的符号或文件：`extensions/git/src/staging.ts` 的 `toLineRanges` 里把选区扩成整行的那一段（现第 61–64 行）。`git.stageSelectedRanges` 与 `git.unstageSelectedRanges` 继续调用 `toLineRanges`，调用点不改。
- 明确不改什么：不改 `applyLineChanges`、`intersectDiffWithRange`、`getModifiedRange`。不改 `commands.ts` 里 `stageSelectedChanges`（约第 1788–1800 行）和 `unstageSelectedRanges`（约第 2089–2113 行）的求交、反转和 `repository.stage`。相邻行合并留在 r16-4。
- 本地验证：`scripts/test-integration.sh --suite git --grep "toLineRanges"`。新增 `extensions/git/src/test/staging.test.ts`。行号与 `Selection` / `Range` 一样是 0-based，不按 r16-5 的 1-based diff 行号解读。断言：`Selection(5, 0, 8, 0)` 得到 `start.line === 5` 且 `end.line === 7`；`Selection(5, 0, 5, 4)` 与 `Selection(5, 0, 5, 0)` 的 `start.line` 和 `end.line` 都是 5。

## r16-4

- 问题类：多段选区扩成整行后只要相交，`toLineRanges` 只留下交集，交集以外已选的行不会被暂存或取消暂存。
- 不变量：按起始行排序之后，两个行范围相交时保留并集（`Range.union`：起点取更早的 start，终点取更晚的 end，一方包住另一方时留下较大的那个）。相邻行（`l.start.line === last.end.line + 1`）仍合并成一段。既不相交也不相邻的范围仍分成多段。最后的 `reverse` 保持。
- 要动的符号或文件：`extensions/git/src/staging.ts` 的 `toLineRanges` 归并（现第 75–80 行）。相交分支改为 `return [l.union(last), ...rest]`。`union` 与现有 `intersection` 同是本文件已经从 `vscode` 引入的 `Range` 上的方法，扩展不要从 `src/vs` 再引一份。
- 明确不改什么：不相交的范围禁止调用 `union`（它会把中间空行补上）。不改第 82–85 行的相邻合并。不改排序和末尾 `reverse`。不改 `commands.ts` 里 `selectedLines.reduce` 用 `||` 取第一段相交 diff 的写法。
- 本地验证：同一条 `scripts/test-integration.sh --suite git --grep "toLineRanges"`。坐标都是 0-based。断言：`Selection(5, 0, 5, 3)` 与 `Selection(5, 6, 8, 4)` 字符上不相交，扩成整行后并集为 `start.line === 5` 且 `end.line === 8`，不是只剩第 5 行。`Selection(1, 0, 1, 2)` 与 `Selection(2, 0, 2, 2)` 并成 `start.line === 1`、`end.line === 2`。`Selection(1, 0, 1, 2)` 与 `Selection(4, 0, 4, 2)` 仍是两段。`Selection(5, 0, 8, 2)` 包住 `Selection(6, 0, 6, 2)` 时，并集为 `start.line === 5`、`end.line === 8`。

## r16-5

- 问题类：blame 把已经折算过的行号拿去和下一段 hunk 的修改后起始行比较，净增行会让后面的删除或变长修改被跳过，光标所在未改行标成更早的提交或对不上任何提交。
- 不变量：循环是否 `break` 只比较入参的修改后行号与 `change.modified.startLineNumber`。增行、删行、变长修改的折算累加到另一个局部变量，不写回这个比较用的行号。因此前面的净插入不会让折算值掉到后一个 hunk 的修改后起点之前从而 `break`；前面的净删除把折算值抬高时，也不会把修改后文件里位于光标之后的 hunk 算进去。delta 公式保持：增行减去修改后长度，删行加上原始长度，修改仅在两边长度不同时减去（修改后长度 − 原始长度）。`changes` 仍假定按 `modified.startLineNumber` 升序，这个顺序由 diff 送出，本函数不排序。
- 要动的符号或文件：`extensions/git/src/blame.ts` 的 `mapModifiedLineNumberToOriginalLineNumber`（现第 27–59 行）。导出该函数供测试引用。调用点第 549 行继续传入 `lineNumber + 1` 和 `allChanges`。
- 明确不改什么：不改 `lineRangesContainLine` 对工作区改动和已暂存改动标成「未提交」的短路（约第 534–546 行）。不改第 549 行的 `+ 1`。不改装饰、悬停和 `_getBlameInformation`。不改 diff 的产生（`extHostTextEditors` / quick diff 的 `changes2`）。不把返回值钳到大于 0。
- 本地验证：`scripts/test-integration.sh --suite git --grep "mapModifiedLineNumberToOriginalLineNumber"`。新增测试直接调用该函数。下面的行号是 `TextEditorChange` 的 1-based，不是 `Selection` 的 0-based。断言：修改后第 1–10 行是插入（modified start 1、end exclusive 11），第 15 行处删除 3 行（modified start 与 end exclusive 都是 15，original 长度为 3），修改后第 20 行折成 13。只有这段插入时，第 20 行仍折成 10。另断言：修改后第 10 行处删除 5 行（modified start 与 end exclusive 都是 10，original 长度为 5），第 14 行起插入 4 行（modified start 14、end exclusive 18），光标在修改后第 12 行时结果是 17。错误实现会先得到 17，再用 17 与 14 比较从而减掉这 4 行，得到 13。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：r16-2 的 `rebase-merge` 夹具补上 `head-name`；`isMergeInProgress` / `isCherryPickInProgress` 用与方法相同的存在性判断验收。不采纳「验收没等 status」：正文已要求 `await repository.status()`。不采纳「Microsoft 套件没进 grep」：正文已另跑 `GitHub Microsoft-brokered sessions`。

2026-09-30 第二轮。无 Critical。Important：空 `rebase-merge` 加 `REBASE_HEAD` 时本机 Git 2.34.1 的 `git status -z -uall` 仍退出 0，有无 `head-name` 都一样。status 拒绝夹具改为写坏 worktree git-dir 的 `index`（退出 128），`git show` 该提交仍成功。已写入正文。

2026-09-30 用户签收。`accepted`。未实施。
