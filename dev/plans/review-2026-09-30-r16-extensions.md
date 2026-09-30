---
title: "审查 r16：extensions"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "GitHub 登录写回会盖掉其他窗口的会话；worktree rebase、按选区暂存和 blame 行号会写错 Git 状态或标错提交。"
---

# 发现

## r16-1 高
- 症状：本窗口正在走 GitHub 网页登录、授权还没返回时，另一个窗口登录或退出并写入了密钥串。本窗口登录成功后，密钥串被登录开始前的会话列表盖掉：另一个窗口新加上的账号从密钥串消失，或另一个窗口刚刚退出的令牌被写回去。
- 位置：`extensions/github-authentication/src/github.ts` 第 736–749 行
- 引用：

```736:749:extensions/github-authentication/src/github.ts
			const sessions = await this._persistedSessionsPromise;
			const scopeString = sortedScopes.join(' ');
			const token = await this._githubServer.login(scopeString, signInProvider, options?.extraAuthorizeParameters, loginWith);
			const session = await this.tokenToSession(token, scopes);
			this.afterSessionLoad(session);

			const sessionIndex = sessions.findIndex(s => s.account.id === session.account.id && arrayEquals([...s.scopes].sort(), sortedScopes));
			const removed = new Array<vscode.AuthenticationSession>();
			if (sessionIndex > -1) {
				removed.push(...sessions.splice(sessionIndex, 1, session));
			} else {
				sessions.push(session);
			}
			await this.storeSessions(sessions);
```

- 为什么是问题：`sessions` 在 `login()` 之前就取好了。`login()` 会等用户在浏览器里完成授权。这段时间另一个窗口改密钥串会触发 `checkForUpdates`（第 578–580 行），把 `_persistedSessionsPromise` 换成刚读到的新数组，但这里仍在旧数组上 `push`/`splice`。`storeSessions`（第 696–699 行）把这份旧数组整份写回密钥串，并把它设成此后的内存状态。`removeSession`（第 887–893 行）同样先取数组再 `storeSessions`，退出和另一次密钥串更新交错时也会把已删除的令牌写回去。
- 方向：写密钥串之前重新读取当前会话，只在那份结果上合并或删除本次会话。

## r16-2 中
- 症状：在链接的 worktree，或工作区里 `.git` 是 gitfile 的 submodule 中 rebase 时，源代码管理的按钮仍是 Commit，点下去执行的是 `git commit`，不会 `git rebase --continue`。本次提交之后剩余补丁不会被重放，仓库停在 rebase 中途；状态栏也不会标出 rebase。合并和 cherry-pick 同样不会被认出来。
- 位置：`extensions/git/src/repository.ts` 第 3137–3164 行
- 引用：

```3137:3164:extensions/git/src/repository.ts
	private async getRebaseCommit(): Promise<Commit | undefined> {
		const rebaseHeadPath = path.join(this.repository.root, '.git', 'REBASE_HEAD');
		const rebaseApplyPath = path.join(this.repository.root, '.git', 'rebase-apply');
		const rebaseMergePath = path.join(this.repository.root, '.git', 'rebase-merge');

		try {
			const [rebaseApplyExists, rebaseMergePathExists, rebaseHead] = await Promise.all([
				new Promise<boolean>(c => fs.exists(rebaseApplyPath, c)),
				new Promise<boolean>(c => fs.exists(rebaseMergePath, c)),
				new Promise<string>((c, e) => fs.readFile(rebaseHeadPath, 'utf8', (err, result) => err ? e(err) : c(result)))
			]);
			if (!rebaseApplyExists && !rebaseMergePathExists) {
				return undefined;
			}
			return await this.getCommit(rebaseHead.trim());
		} catch (err) {
			return undefined;
		}
	}

	private isMergeInProgress(): Promise<boolean> {
		const mergeHeadPath = path.join(this.repository.root, '.git', 'MERGE_HEAD');
		return new Promise<boolean>(resolve => fs.exists(mergeHeadPath, resolve));
	}

	private isCherryPickInProgress(): Promise<boolean> {
		const cherryPickHeadPath = path.join(this.repository.root, '.git', 'CHERRY_PICK_HEAD');
		return new Promise<boolean>(resolve => fs.exists(cherryPickHeadPath, resolve));
	}
```

- 为什么是问题：链接 worktree 和 gitfile 形式的 submodule 里，`repository.root` 下的 `.git` 是文件，不是目录。`REBASE_HEAD`、`rebase-merge`、`MERGE_HEAD`、`CHERRY_PICK_HEAD` 实际在 `rev-parse --git-dir` 给出的目录（`dotGit.path`）里。这里拼出来的路径不存在，`getRebaseCommit` 进 `catch` 返回 `undefined`。`commit` 只在 `this.rebaseCommit` 为真时走 `rebaseContinue()`（第 1432–1441 行），否则调用普通 `git commit`。按钮是否显示 Continue 也只看 `rebaseCommit` / `mergeInProgress`。
- 方向：到 `dotGit.path` 下读取这些状态文件，不要用 `repository.root` 拼 `.git`。

## r16-3 中
- 症状：用「暂存选定范围」时，若选区终点在某一行的第 0 列（点行号选中上一整行，或从第 0 列按住 Shift 向下选），下一整行里的改动也会被写进索引。取消暂存选定范围同样会多撤下一行。
- 位置：`extensions/git/src/staging.ts` 第 61–64 行
- 引用：

```61:64:extensions/git/src/staging.ts
	const lineRanges = selections.map(s => {
		const startLine = textDocument.lineAt(s.start.line);
		const endLine = textDocument.lineAt(s.end.line);
		return new Range(startLine.range.start, endLine.range.end);
```

- 为什么是问题：选区终点列号为 0 且终点行大于起点行时，终点那一行没有任何被选中的字符，选中的是它前面的行。这里用 `s.end.line` 取整行，把终点行整行放进行范围。`git.stageSelectedRanges`（`commands.ts` 第 1788–1800 行）和 `git.unstageSelectedRanges`（第 2089–2113 行）都用这个范围去和 diff 求交，再 `applyLineChanges` 后 `repository.stage` 写索引。
- 方向：终点列号为 0 且终点行大于起点行时，行范围只收到终点行的前一行。

## r16-4 中
- 症状：同一文件里有两段互不重叠、但展开成整行后叠在同一行上的选区时，「暂存选定范围」只暂存重叠的那几行，其余已选行的改动留在工作区。取消暂存选定范围也只处理重叠部分。
- 位置：`extensions/git/src/staging.ts` 第 75–80 行
- 引用：

```75:80:extensions/git/src/staging.ts
		const [last, ...rest] = result;
		const intersection = l.intersection(last);

		if (intersection) {
			return [intersection, ...rest];
		}
```

- 为什么是问题：选区先被扩成整行（第 61–64 行）。例如一行里前半段的选区，和从同一行后半段拖到后面几行的选区，字符上不相交，扩成整行后在这一行相交。相邻行走的是并集（第 82–85 行），相交却只留下交集，两边多出来的行被丢掉。随后 `stageSelectedRanges` / `unstageSelectedRanges` 按这个缩小后的范围更新索引。
- 方向：相交的行范围与相邻行一样取并集，不要取交集。

## r16-5 中
- 症状：文件里光标之前有至少两处未提交改动，且前面的增行（或变长的修改）把折算行号拉到后一处改动的起始行之前时，光标所在未改行的 blame 会标成更早的另一处提交，或对不上任何提交而不显示。
- 位置：`extensions/git/src/blame.ts` 第 32–51 行
- 引用：

```32:51:extensions/git/src/blame.ts
	for (const change of changes) {
		// Do not process changes after the line number
		if (lineNumber < change.modified.startLineNumber) {
			break;
		}

		// Map the line number to the original line number
		if (change.kind === TextEditorChangeKind.Addition) {
			// Addition
			lineNumber = lineNumber - lineRangeLength(change.modified.startLineNumber, change.modified.endLineNumberExclusive);
		} else if (change.kind === TextEditorChangeKind.Deletion) {
			// Deletion
			lineNumber = lineNumber + lineRangeLength(change.original.startLineNumber, change.original.endLineNumberExclusive);
		} else if (change.kind === TextEditorChangeKind.Modification) {
			// Modification
			const originalRangeLength = lineRangeLength(change.original.startLineNumber, change.original.endLineNumberExclusive);
			const modifiedRangeLength = lineRangeLength(change.modified.startLineNumber, change.modified.endLineNumberExclusive);

			if (originalRangeLength !== modifiedRangeLength) {
				lineNumber = lineNumber - (modifiedRangeLength - originalRangeLength);
			}
```

- 为什么是问题：循环先改 `lineNumber`，再用改过的值和下一段的 `modified.startLineNumber` 比较。下一段的起点仍是修改后文件上的行号。例如文件开头插入 10 行，第 15 行处删了 3 行，光标在修改后的第 20 行：处理完插入后行号变成 10，10 小于 15，循环直接 `break`，删除没有加回去，映射结果是 10 而不是 13。第 549 行用这个结果去对 blame 区间，装饰和悬停就会显示错误提交。
- 方向：是否越过后续 hunk 只用修改后文件上的原始行号判断，行号折算单独累计。
