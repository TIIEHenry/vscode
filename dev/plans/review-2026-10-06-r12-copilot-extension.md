---
title: "审查 r12：copilot-extension"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "终端提交信息可被引号拆开执行；补丁移动会覆盖已有目标；stash 与安装更新等命令免确认。"
---

## r12-1 高
- 症状：生成提交说明后，带引号或反引号的文本会在终端里变成可执行的 shell。
- 位置：`extensions/copilot/src/extension/conversation/vscode-node/conversationFeature.ts` 第 305–308 行
- 引用：`commitMessage.replace(/"/g, '\\"').replace(/\\/g, '\\\\').replace(/\$/g, '\\$')` 然后 `git commit -m "${sanitizedMessage}"`，`sendText(message, false)`
- 为什么是问题：引号先被换成 `\"`，下一步又把所有反斜杠加倍，刚加上的转义被拆掉。`say "hi"` 会变成 `git commit -m "say \\"hi\\""`，双引号提前结束。消息里若再有换行，换行会直接送给终端并执行引号后面的内容。反引号完全没转义，在双引号里仍会做命令替换。
- 方向：先转义反斜杠，再转义引号、美元符和反引号，并去掉换行后再送进终端。

## r12-2 高
- 症状：`apply_patch` 把文件移动到已存在的路径时，目标文件被直接覆盖。
- 位置：`extensions/copilot/src/extension/tools/node/applyPatchTool.tsx` 第 124–126 行
- 引用：`workspaceEdit.renameFile(path, movePath, { overwrite: true })`
- 为什么是问题：解析补丁时只确认源文件存在，移动前不检查目标是否已是另一个文件。`overwrite: true` 会删掉目标上的原内容。工作区内自动批准时，确认卡也不会展示这次覆盖。
- 方向：目标已存在且不是同一文件时拒绝移动，或先让用户看到将被覆盖的文件。

## r12-3 高
- 症状：模型可以不经确认执行 stash、弹出 stash、下载并安装更新。
- 位置：`extensions/copilot/src/extension/tools/node/vscodeCmdTool.tsx` 第 24–60 行
- 引用：注释写明免确认名单是「read-only / have no side effects」，名单里却有 `git.stash`、`git.stashPop`、`git.stashStaged`、`update.downloadUpdate`、`update.installUpdate`、`update.restartToUpdate`；第 167–168 行在无参数时直接返回，不带 `confirmationMessages`
- 为什么是问题：这些命令会改工作区或安装并重启更新。无参数调用走免确认分支，工具确认卡不会出现。`git.stashPop` 还可能改掉未提交的工作区内容。
- 方向：把会改 Git 状态或安装更新的命令移出免确认名单。

## r12-4 中
- 症状：记忆文件做字符串替换时，新文本里的 `$&`、`$'`、`` $` ``、`$$` 会被改写。
- 位置：`extensions/copilot/src/extension/tools/node/memoryTool.tsx` 第 628 行
- 引用：`const newContent = content.replace(params.old_str, params.new_str);`
- 为什么是问题：`String.prototype.replace` 在替换串里把 `$` 当模式。例如把 `world` 换成 `cost $& end` 会写成 `cost world end`，`$'` 会变成匹配后面的原文。记忆里的价格、shell 或模板字符串会被静默写错。
- 方向：用切片拼接，或把替换串传给函数，原样写入 `new_str`。

## r12-5 中
- 症状：新建 notebook 时，从 Markdown 代码块抽出的正文被立刻丢掉，围栏仍进入文件。
- 位置：`extensions/copilot/src/extension/tools/node/createFileTool.tsx` 第 107–112 行
- 引用：`content = codeBlock.code` 之后又 `content = removeLeadingFilepathComment(options.input.content, ...)`
- 为什么是问题：注释说明要处理带语言标记的代码块，回调也把代码写入 `content`。下一行改回原始 `options.input.content`，抽出的正文没有参与后续 `processFullRewriteNewNotebook`。模型若把 notebook 内容包在代码围栏里，围栏会进到新建的 notebook。
- 方向：对抽出的 `content` 做 `removeLeadingFilepathComment`，不要再用原始输入覆盖。
