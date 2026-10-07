---
title: "审查 r14：extensions"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "未跟踪文件会被整批永久删除，笔记本保存会写空或挂起，worktree 会整目录覆盖，AI 修复选区会被全文搜索带偏"
---

## r14-1 高
- 症状：丢弃多个未跟踪文件时，只要其中一次移入回收站失败，确认后会把整份列表永久删除，包括已经进回收站、以及还没试过、本来可以进回收站的文件。
- 位置：`extensions/git/src/repository.ts` 第 1648–1670 行
- 引用：`await workspace.fs.delete(Uri.file(resources[0]), { useTrash: true });` 之后的 `resources.slice(1)` 也在同一个 `try` 里；`catch` 里确认后执行 `await this.repository.clean(resources)`。`extensions/git/src/git.ts` 第 2292 行的 `clean` 参数是 `['clean', '-f', '-q']`。
- 为什么是问题：注释写的是用第一个路径探测回收站是否可用。第一个路径已经删除成功后，后面某个路径失败仍会走永久删除，并且 `clean` 收到的是原始整表。默认 `git.discardUntrackedChangesToTrash` 为 true。已经移走的路径和尚未移走的路径被一起 `git clean -f`，未移走的文件不可恢复。
- 方向：回收站失败时只永久删除这一次失败的路径，已经进回收站的路径不要再交给 `git clean`。

## r14-2 高
- 症状：笔记本序列化器在已 dispose 时仍把保存结果交成空字节，桌面默认实验序列化路径也会这样返回。
- 位置：`extensions/ipynb/src/notebookSerializer.node.ts` 第 33–36 行
- 引用：`if (this.disposed) { return new Uint8Array(0); }`。基类 `extensions/ipynb/src/notebookSerializer.ts` 第 80–82 行、网页实现 `extensions/ipynb/src/notebookSerializer.web.ts` 第 34–36 行同样返回空字节。`ipynb.experimental.serialization` 默认 true。
- 为什么是问题：`serializeNotebook` 的返回值就是要落盘的笔记本内容。扩展停用或序列化器先被 dispose、保存仍在进行时，会把 `.ipynb` 写成空文件。
- 方向：已 dispose 时拒绝这次保存，不要返回空字节数组。

## r14-3 中
- 症状：实验序列化保存交给 worker 后，worker 退出或出错时保存 Promise 一直不结束。
- 位置：`extensions/ipynb/src/notebookSerializer.node.ts` 第 55–83 行
- 引用：`exit` 只把 `this.worker` 置空并打日志；`error` 只打日志。`serializeViaWorker` 把 `DeferredPromise` 放进 `this.tasks` 后 `return deferred.p`，这两处都没有 `error()` 或删掉未完成任务。网页实现 `extensions/ipynb/src/notebookSerializer.web.ts` 第 54–83 行同样。
- 为什么是问题：默认走 worker 保存。worker 在序列化时抛错退出后，这次保存不会成功也不会失败，笔记本一直停在保存中。
- 方向：worker 退出或出错时拒绝所有未完成的保存任务。

## r14-4 中
- 症状：配置了 `git.worktreeIncludeFiles` 时，新建 worktree 会把匹配文件的祖先目录整棵强制拷进去，覆盖刚检出的文件。
- 位置：`extensions/git/src/repository.ts` 第 2069–2112 行
- 引用：向上走到 pattern 基目录并把该目录放进 `gitIgnoredPaths`；排序后只留最上层路径。复制时 `cp(sourceFile, targetFile, { force: true, recursive: true, verbatimSymlinks: true })`。
- 为什么是问题：无固定前缀的 glob（例如 `**/.env`）会把仓库根下的第一层目录当成要复制的路径；有前缀时基目录自己也会被加进集合并成为最上层路径。`cp` 会复制该目录里的已跟踪文件，并以 `force` 盖掉新 worktree 里刚检出的内容，工作区不再是目标提交的干净检出。
- 方向：只复制 glob 命中的忽略文件，不要把祖先目录整棵 `force` 拷进 worktree。

## r14-5 中
- 症状：TypeScript AI quick fix 用插入文本在全文里找范围，空文本会选中整个文档并自动发送。
- 位置：`extensions/typescript-language-features/src/languageFeatures/util/copilot.ts` 第 165–194 行
- 引用：`const startIndex = text.indexOf(firstEdit.newText);` 与 `const endIndex = text.lastIndexOf(lastEdit.newText);`。空字符串时 `indexOf` 为 0、`lastIndexOf` 为全文长度。同文件第 78–83 行把该范围交给 `vscode.editorChat.start`，且 `autoSend: true`。`edits` 为空时第 165 行读取 `edits[0]` 会直接抛错。
- 为什么是问题：删除类编辑的 `newText` 为空，范围变成整篇文档并自动发给编辑聊天。非空文本则命中文件里更早或更晚的另一处相同字符串，聊天改的不是这次修复的位置。
- 方向：用编辑自身的起止位置计算范围，不要在全文里搜索 `newText`。
