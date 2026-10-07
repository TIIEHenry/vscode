---
title: "方案 r14：extensions"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 3，drop 0，weaken 2。回收站失败只永久删除失败路径，worker 失败要拒绝保存，worktree 只复制命中的忽略文件；序列化器空字节与 AI 选区降级。"
---

hold 3，drop 0，weaken 2

# 方案 r14：extensions

只改下面三条 hold 和两条 weaken。drop 没有条目。

## r14-1

- 问题类：多个未跟踪文件移入回收站时，只要有一次失败，确认后就会把原始整表交给 `git clean -f`，还留在工作区里的文件被永久删除。
- 不变量：`discardUntrackedChangesToTrash` 生效时，每个路径各自 `useTrash` 删除。全部尝试结束后，只有失败路径可以进入 `repository.clean`；已经移入回收站的路径不在参数里。用户不确认时不调用 `clean`。回收站全部成功时不弹窗、不调用 `clean`。设置关闭，或 `isRemote` / `isLinuxSnap` 为真时，仍对原始整表调用 `clean`，不走回收站。第一个路径就失败时，失败集合可以是整表，确认后仍永久删除这些失败路径。本机 Git 2.34.1 上，`git clean -f -q --` 对已经不存在的路径退出码是 0，同一次调用仍会删掉列表里还在的未跟踪文件；因此要挡的是把还在工作区里的路径放进同一次 `clean`。
- 要动的符号或文件：`extensions/git/src/repository.ts` 的 `Repository._clean`（现第 1640–1674 行）。第 1648–1670 行的单个 `try` 包住 `resources[0]` 和 `resources.slice(1)`，`catch` 里第 1669 行 `this.repository.clean(resources)` 改为只接收失败路径。第 1662–1664 行确认按钮的数量改为失败路径的数量。第 1650–1652 行「用第一个路径探测回收站」的注释改成与逐个归类一致。把「回收站结果 + 是否确认 → 要 clean 的路径」抽成纯函数，供测试调用。
- 明确不改什么：不改 `extensions/git/src/git.ts` 第 2292 行的 `['clean', '-f', '-q']`，不加 `-x` 或 `-d`。不改 `git.discardUntrackedChangesToTrash` 的默认 true（`package.json` 第 4137–4140 行）。不改 `!isRemote && !isLinuxSnap` 这个总开关。不改设置关闭时的 `else` 分支（第 1672–1673 行）对整表 `clean`。不改 `clean()` / `restore()` 里谁被放进 `toClean`（未跟踪与忽略，约第 1590–1594 行、第 1404–1408 行），不改随后的 `checkout`。不改 `closeDiffEditors`。
- 怎样本地验证：现有 `extensions/git/src/test` 没有覆盖 `_clean` 的测试名。`scripts/test-integration.sh --suite git`。新增断言：三个路径里 A、C 回收站成功、B 失败且用户确认时，交给 `clean` 的只有 B；三个都失败且用户确认时，三个都交给 `clean`；用户不确认时不调用 `clean`；设置关闭时不调用回收站删除，`clean` 收到原始整表。断言看纯函数的返回值，不执行真正的 `git clean`。

## r14-2

- 问题类：降为低。`serializeNotebook` 在 `disposed` 为真时返回空字节；若这次调用真的发生，`$saveNotebook` 会把该返回值写进 `.ipynb`。当前激活路径不会把 `disposed` 设为真。
- 反证：`extensions/ipynb/src/ipynbMain.node.ts` 第 11 行构造序列化器，`ipynbMain.ts` 的 `activate` 只把 `registerNotebookSerializer` 的返回值推进 `context.subscriptions`（第 53、67 行），没有推进序列化器本身。`deactivate` 是空函数（`ipynbMain.ts` 第 139 行，node 入口第 14–16 行）。扩展停用只处置 `context.subscriptions`（`src/vs/workbench/api/common/extHostExtensionService.ts` 第 607–609 行）。`registerNotebookSerializer` 的 disposable 只调用 `$unregisterNotebookSerializer`（`extHostNotebook.ts` 第 293–295 行），不调用 `NotebookSerializer.dispose()`。全仓库没有 `NotebookSerializer.dispose()` 的调用点。`disposed` 只在 `notebookSerializer.ts` 第 20 行被设为 true。空字节判断在 `serializeNotebook` 入口；已经进入函数之后才 dispose，不会改走这个返回。`$saveNotebook` 第 366–373 行会把返回的字节原样 `writeFile`，所以空返回一旦被调用就会写成空文件，只是现在没有调用方进入该分支。
- 不变量：node 覆盖、web 覆盖、基类三处在 `disposed` 为真时拒绝 `serializeNotebook`，拒绝值不能是空 `Uint8Array`。`ipynb.experimental.serialization` 为 true 或 false 都一样。拒绝之后 `$saveNotebook` 现有的 `writeFile` 不会执行。`startWorker` 在已 dispose 时抛 `Serializer disposed` 保持不变。
- 要动的符号或文件：`extensions/ipynb/src/notebookSerializer.node.ts` 第 34–36 行，`extensions/ipynb/src/notebookSerializer.web.ts` 第 34–36 行，`extensions/ipynb/src/notebookSerializer.ts` 第 80–82 行。三处都改成拒绝，避免 node/web 在调用 `super` 之前就返回空字节。
- 明确不改什么：不把序列化器加进 `context.subscriptions`，不改 `deactivate`。不改 `extHostNotebook.ts` 的 `$saveNotebook`。不改 `experimental.serialization` 的默认 true。不改反序列化。不改 worker 的成功消息格式。
- 怎样本地验证：`extensions/ipynb/src/test/serializers.test.ts` 里现有的 `Serialize` 测单元格元数据，不覆盖 `disposed`。`scripts/test-integration.sh --suite ipynb`。新增断言：`disposed === true` 时 `serializeNotebook` 拒绝，结果不是长度 0 的 `Uint8Array`。不要断言扩展停用会进入这个分支。

## r14-3

- 问题类：实验序列化的 worker 出错或退出时，已经放进 `tasks` 的保存 Promise 一直不结束。
- 不变量：node 的 `error` 与 `exit`、web 的 `error` 都把当时未完成的 `DeferredPromise` 全部 `error()`，并从 `tasks` 删除。已 `complete` 的任务保持 resolved，不再 `error()`。同一次失败只拒绝一轮：先取出并清空 map，再拒绝，避免 `error` 之后紧接着的 `exit` 重复拒绝。`serializeViaWorker` 返回的 promise 以拒绝结束。web 的 `addEventListener('exit')`（`notebookSerializer.web.ts` 第 54 行）不会成为这条不变量的实现，因为浏览器 `Worker` 没有 `exit` 事件；web 的拒绝挂在第 68–72 行的 `onerror`。node 的 `worker_threads` Worker 才有 `exit`（`notebookSerializer.node.ts` 第 55 行），`error`（第 68 行）和 `exit` 都要走同一处拒绝。
- 要动的符号或文件：`extensions/ipynb/src/notebookSerializer.node.ts` 第 55–72 行与第 75–83 行的 `tasks`；`extensions/ipynb/src/notebookSerializer.web.ts` 第 54–72 行与第 75–83 行。两处抽出同一个「拒绝并清空未完成任务」的函数。
- 明确不改什么：不改 `notebookSerializerWorker.ts` 第 11–18 行和 `notebookSerializerWorker.web.ts` 第 9–14 行的成功 `postMessage`。不改 `experimental.serialization` 的默认 true。不改 `message` 处理里 `task.complete` 后删除 id 的成功路径。不把序列化器加进 `context.subscriptions`，不为了这条去增加 `dispose()` 的调用方。
- 怎样本地验证：没有覆盖 worker `error` / `exit` 的现有测试名。`scripts/test-integration.sh --suite ipynb` 加载 node 入口。新增断言直接调用上述函数：map 里一个未完成、一个已 `complete`，调用后未完成的 promise 为 rejected 且 map 已空，已完成的仍是 resolved。web 与 node 共用这次断言，不要求浏览器发出 `exit`。

## r14-4

- 问题类：`git.worktreeIncludeFiles` 命中子目录里的忽略文件时，祖先目录会被整棵 `force` 拷进刚检出的 worktree，盖掉其中的已跟踪文件。
- 不变量：复制清单只含 gitignore 差集里、glob 命中的文件。`**/.env` 命中 `<root>/src/app/.env` 时，清单只有该文件，没有 `<root>/src` 或 `<root>/src/app`。`foo/**/.env` 命中 `<root>/foo/a/.env` 时，清单只有该文件，没有 `<root>/foo`。仓库根上的 `<root>/.env` 仍只有该文件。同一目录里的已跟踪文件不在清单里。`cp` 的源是这些文件；目标父目录仍用 `mkdir` 创建。新 worktree 里同路径的已跟踪文件保持 `addWorktree` 刚检出的内容。
- 要动的符号或文件：`extensions/git/src/repository.ts` 的 `_getWorktreeIncludePaths`（现第 2049–2093 行：pattern 基目录、向上把祖先放进 `gitIgnoredPaths`、排序后只留最上层路径）和 `_copyWorktreeIncludeFiles` 第 2112 行的 `cp(..., { force: true, recursive: true, verbatimSymlinks: true })`。祖先目录不再进入复制清单。调用点仍是 `_setupWorktree` 第 1994 行，位于 `addWorktree`（第 1977 行）之后。把「仓库根 + 已忽略文件路径 + glob → 源路径清单」抽成纯函数。
- 明确不改什么：不改第 2031–2047 行两次 `findFiles2` 以及「全部命中减去未忽略」的差集。不改 `git.worktreeIncludeFiles` 的默认 `[]`。不改先 `addWorktree` 再复制的顺序。不改第 2116–2126 行失败计数和警告。不改 `_runWorktreeCreatedTasks`。文件复制仍可带 `verbatimSymlinks: true`。
- 怎样本地验证：git 扩展测试里没有 `_getWorktreeIncludePaths` 的测试名。`src/vs/sessions/contrib/providers/agentHost/test/browser/localAgentHostSessionsProvider.test.ts` 的 `createNewSession forwards git.worktreeIncludeFiles as derived session config`，以及 `copilotChatSessionsProvider.test.ts` 的 `Copilot CLI session forwards git.worktreeIncludeFiles for worktree isolation`，只转发配置，不能当作复制行为的验收。`scripts/test-integration.sh --suite git`。新增断言调用纯函数：`**/.env` 与 `<root>/src/app/.env` 的结果只有该文件；`foo/**/.env` 与 `<root>/foo/a/.env` 的结果只有该文件；`<root>/.env` 的结果只有该文件。清单里没有这些文件的祖先目录。

## r14-5

- 问题类：降为低。`findEditScope` 用 `newText` 在全文里找范围；空字符串会得到整篇文档，相同文本会落到另一处，并且 `autoSend` 为 true。当前真正会走到这里的 AI quick fix 插入的是桩代码，空 `newText` 的整篇选区不是这些 fix 的输入。
- 反证：`quickFix.ts` 第 372–383 行只有 `classIncorrectlyImplementsInterface`、`fixClassDoesntImplementInheritedAbstractMember`、`fixMissingFunctionDeclaration` 把 `expand` 设为 `code-action`。这三处在 TypeScript 里分别走 `addMissingDeclarations`、`addMissingMembers`、`addFunctionDeclaration`，文本变更是插入声明。`kind: 'refactor-info'` 只出现在 `copilot.ts` 第 118 行的类型上，仓库里没有构造点。`src/vs/editor/contrib/codeAction/browser/codeAction.ts` 第 305–323 行先 `bulkEditService.apply` 编辑，成功后才执行 command。AI 动作的 command 是 `CompositeCommand`（`quickFix.ts` 第 419–434 行）：先 `ApplyCodeActionCommand`，再 `EditorChatFollowUp`。因此 `findEditScope` 读到的是编辑已经落地的文档；`newText` 在文中唯一时，`indexOf` 落在刚插入的位置，不会变成整篇。第 414 行 `insert(..., '')` 加在 WorkspaceEdit 上，不是 `findEditScope` 读取的 Proto `textChanges`。`changes.length === 0` 的 fix 不会返回 code action，第 165 行 `edits[0]` 的抛错不是这三条的输入。`editorChatGate.ts` 第 23–27 行在非 Agents 窗口直接返回，不会执行第 78–83 行的 `vscode.editorChat.start`。`codeActionController.ts` 第 151–154 行把 `autoSend` 改成 false 的条件是命令 id `inlineChat.start`，这条命令 id 是 `vscode.editorChat.start`，不受那段改写影响。
- 不变量：聊天范围是当前文档上这些 `textChanges` 应用到编辑前文档之后的并集。空 `newText` 只占该编辑自己的起点到终点，不能变成偏移 0 到全文长度。文中另有一份相同 `newText` 时，范围仍是这次编辑的位置。没有属于当前文档的 `textChanges` 时不调用 `vscode.editorChat.start`。`findEditScope` 可以继续用 navtree 扩展终点所在行，扩展的输入是上述并集的终点，不能是 `lastIndexOf` 的结果。`autoSend` 保持 true。
- 要动的符号或文件：`extensions/typescript-language-features/src/languageFeatures/util/copilot.ts` 的 `findEditScope`（现第 160–195 行，其中第 181–188 行的 `indexOf` / `lastIndexOf`）以及第 64–83 行把结果交给 `vscode.editorChat.start` 的路径。范围要在 `quickFix.ts` 提供 code action 时计算（此时文档仍是编辑前，`getFixesForTsCodeAction` 拿得到 `document`），按每段 `newText.length` 与被替换跨度的差把坐标换成应用后的位置，放进 `EditorChatFollowUp` 的参数。第 74 行 `changes.flatMap` 丢掉了文件名，只保留当前 `document` 的 `textChanges`。`refactor-info` 分支若保留，同样不得 `indexOf`；不新增该分支的调用。
- 明确不改什么：不改 `inferFromUsage` 与 `addNameToNamelessParameter` 的 `navtree-function` 路径（`quickFix.ts` 第 384–409 行）。不改三个 fix 的 `fixName`、标题和 `message`。不改 `editorChatGate.ts` 的 Agents 窗口门槛。不改第 82 行的 `autoSend: true`。不改 telemetry。不改 `codeAction.ts` 先应用编辑再执行命令的顺序。
- 怎样本地验证：`extensions/typescript-language-features/src/test/unit/editorChatGate.test.ts` 里现有的 `default Code window does not offer the AI quick fix and does not start Inline Chat`、`Agents window still offers the AI quick fix and starts Inline Chat after telemetry`、`Agents window does not offer the AI quick fix when Copilot Chat is inactive` 只覆盖是否启动聊天，不覆盖范围。`scripts/test-integration.sh --suite typescript` 只加载 `out/test/unit`（`scripts/test-integration.sh` 第 249 行）。新增测试放在 `src/test/unit`。`src/test/smoke/quickFix.test.ts` 的 `suite.skip` 不在这条加载路径里。新增断言：空 `newText` 的范围是该编辑的 start/end，不是文档开头到结尾；文档更早处已有相同 `newText` 时，范围仍是本次编辑的应用后位置；没有当前文档的 `textChanges` 时不调用 `vscode.editorChat.start`；`newText` 唯一时，范围盖住这次插入，navtree 只扩展终点。
