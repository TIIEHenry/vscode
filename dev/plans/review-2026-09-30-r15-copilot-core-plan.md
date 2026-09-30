---
title: "方案 r15：copilot-core"
type: plan
status: accepted
phase: N/A
updated: 2026-09-30
summary: "2026-09-30 用户签收。未实施。并行工具按 index 归并且不撞已有 id 流；function_call 缺参、SSE 已完成事件收尾、Anthropic 非法参数各补一条不丢数据的路径。未开启延迟加载时的空 tool_search_output 保持现有 spec。"
---

# 方案 r15：copilot-core

只改下面四条。r15-5 第二轮改回 drop：`responsesApiToolSearch.spec.ts` 约第 257–259 行把未支持工具搜索时的 `loadedToolNames` 钉成 `[]`，并写明历史 `tool_search_output` 不得重新声明未延迟的工具。那些工具已经在顶层 `body.tools` 里。把过滤改成 `toolsMap.has(name)` 会让这条 spec 失败，并带上 `defer_loading: true`。验证都在 `extensions/copilot` 里跑 `npm run test:unit -- --run <下面点名的 spec>`。`scripts/test.sh` 与 `scripts/run-unit-custom.sh` 不加载这些 vitest 文件。

## r15-1（weaken）

问题类：无 `id` 的工具参数续传被追加到最后一个调用上，和 `tool_calls[].index` 脱节。

反证：`StreamingToolCalls.update` 在 `toolCall.id` 与最后一项已有 id 不同时会新建槽（`extensions/copilot/src/platform/networking/node/stream.ts` 第 120–122 行）。`stream.sseProcessor.spec.ts` 的 `multiple tool calls` 里两次 `edit_file` 的 `tool_calls[].index` 都是 `0`，靠不同 `id` 分开；每段无 `id` 的参数都紧跟在自己的开头块之后，落到 `toolCalls.at(-1)` 是对的。只按 `index` 取槽、index 已存在就复用，会把第二次调用的参数并进第一次。

不变量：有 `id` 且对不上已有调用时仍新建一条，即使 `index` 与已有调用相同。无 `id` 时，追加到**最后一个存储 index 等于该 `index` 的槽**；没有这样的槽才新建。多个调用共用同一个 index 时，无 `id` 片段仍进该 index 的最近一条（与 `multiple tool calls` 一致）。`index === 0` 是合法槽，不能当空值。

要动：`extensions/copilot/src/platform/networking/node/stream.ts` 的 `StreamingToolCall`（记下看到的 `index`）与 `StreamingToolCalls.update`。

不改：`getToolCalls` 的返回形状；`SSEProcessor` 里 `choice.index`（那是 completion choice）；`IToolCall` 的字段定义；`defaultChatResponseProcessor` 的接线。

验证：保留 `multiple tool calls` 的快照结果。新增断言：先建 index 0（带 id），再建 index 1（带 id），再来一条无 id、`index` 为 0 的 `arguments` 片段，片段只进第一条，第二条的 arguments 不变。再断言同一条 `delta.tool_calls` 里无 id 的 index 0 与 index 1 续传各进各的槽。

## r15-2（hold）

问题类：`function_call` 只有 `name`、`arguments` 缺省时，`_removeCR` 对非字符串调用 `replace`，整次补全失败。

不变量：`arguments` 不是字符串时按空字符串拼接，已积累的参数保持原样；随后真正的参数字符串仍追加在后面。空字符串参数保持空字符串，不抛错。

要动：`extensions/copilot/src/platform/networking/node/stream.ts` 的 `APIJsonDataStreaming.append` 里 `function_call` 分支。

不改：`_removeCR` 的参数类型（仍只接受字符串）；第 518 行进入该分支的条件；`processSSE` 的 try/finally。

验证：在 `stream.sseProcessor.spec.ts` 的 `SSEProcessor` 套件新增一条流：第一包 `function_call` 只有 `name`、没有 `arguments`，后面若干包带 `arguments`，最后 `finish_reason` 为 `function_call`。断言处理器正常结束，函数名正确，参数是后续片段的拼接。已有带 `"arguments":""` 的 function_call 用例保持通过。

## r15-3（weaken）

问题类：SSE 事件要等空行才 `dispatchEvent`，body 结束后 `dataBuffer` 里已拼好的终态事件不再发出。

反证：`feed` 只在遇到 CR/LF 时调用 `processLine`（`extensions/copilot/src/util/vs/base/common/sseParser.ts` 第 103–116 行）。没有换行的尾巴停在 `buffer`，还不是事件。上游 `src/vs/base/common/sseParser.ts` 同样没有收尾方法；`src/vs/base/test/common/sseParser.test.ts` 都在喂了 `\n\n` 之后才断言派发。现有 `processResponseFromChatEndpoint terminal events`（如 `maps response.incomplete with reason=content_filter to ContentFilter + Copyright`）的 body 以 `data: …\n\n` 结束，空行到达时已经派发。把无换行的半行送进回调后，`JSON.parse` 失败会 `feed.reject`（`responsesApi.ts` 第 985–986 行，`messagesApi.ts` 第 739–740 行）。

不变量：流已经用空行派发过的事件只出现一次。收尾只派发 `dataBuffer` 里已经拼完、尚未发出的事件。`buffer` 里没有换行的半行保持不派发。

要动：在上游 `src/vs/base/common/sseParser.ts` 增加只由调用方主动触发的 `finish()`：仅当 `dataBuffer !== ''` 时调用现有 `dispatchEvent`。不改 `feed` / `processLine`。工作台现有调用不调它。copilot 副本由 `extensions/copilot/script/setup/copySources.ts` 从上游整树覆盖，文件头写明不要改副本；`finish()` 加在上游后再按该脚本更新副本。`processResponseFromMessagesEndpoint` 与 `processResponseFromChatEndpoint` 在 `for await` 读完 body 之后调用 `parser.finish()`。

不改：`feed` / `processLine` 的按行与空行派发；两个回调里的 `JSON.parse` 错误处理。不要只改副本、把上游留成没有 `finish()`。

验证：在 `responsesApi.spec.ts` 的 `processResponseFromChatEndpoint terminal events` 增加一条 body：`response.completed` 的 `data:` 行以单个换行结束、后面没有空行。断言仍得到一条 completion。同一条以 `\n\n` 结束的 body 仍只得到一条。`messagesApi` 的同样两条断言必须让响应带 `text/event-stream`：`processResponseFromMessagesEndpoint` 只有 content-type 含该值才走 `SSEParser`，`createFakeStreamResponse` 的 header 为空会进非流式分支。用 `createNonStreamingHeaders('text/event-stream')` 加 `Response.fromText`（或等价的带该 content-type 的流）。单换行得到一条 completion，`\n\n` 仍只一条，无换行半截 `data:` 不产生 completion。`oaiLanguageModelServer.ts` 只 `feed` 不 `finish()` 的路径不在本条。

## r15-4（hold）

问题类：重放给 Anthropic 的助手工具调用在 `arguments` 不是合法 JSON 时，`input` 被写成 `{}`，原文消失。

不变量：`JSON.parse` 成功且结果是对象时，`input` 就是该对象。解析失败时 `input` 仍是对象，且能还原原始字符串，并与成功的 `{}` 区分开。`tool_use` 的 `id`、`name` 与后面的 `tool_result` 配对不变。

要动：`extensions/copilot/src/platform/endpoint/node/messagesApi.ts` 的 `rawMessagesToMessagesAPI` 里助手 `toolCalls` 循环（当前第 341–351 行）。解析失败时放入带固定字段的对象，字段值是原始 `toolCall.function.arguments`（字段名在实现里定死一处，例如 `unparsedArguments`）。

不改：解析成功的对象路径；`responsesApi.ts` 里 `tool_search_call` 的 `JSON.parse`（约第 444 行）；`tool_result` 的组装。

验证：在 `messagesApi.spec.ts` 的 `rawMessagesToMessagesAPI` 套件新增一条：`arguments` 为 `'{truncated'`。断言对应 `tool_use.input` 是对象、含该原始字符串、并且不是 `{}`。同套件另加一条 `arguments: '{"path":"/tmp/test.txt"}'`，断言 `tool_use.input` 深层相等 `{ path: '/tmp/test.txt' }`。现有出现这串参数的用例没有读 `tool_use.input`，不能当成这条回归。

## r15-5（drop）

`converts tool_search history for unsupported models`（`responsesApiToolSearch.spec.ts` 约第 222–259 行）使用 `gpt-4o`（`supportsToolSearch === false`），期望 `loadedToolNames` 为 `[]`。注释写明：当前没有工具被延迟，历史 `tool_search_output` 不得重新声明它们。这些名字已经在顶层 `body.tools`。谓词缺省时滤成空数组与这条 spec 一致。第 75 行是 `shouldDeferTools` 的计算，谓词赋值在第 130 行，调用在第 468 行。本条不改 `buildToolSearchOutputTools`。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：r15-5 的 drop 与 HEAD 不符（谓词缺省时搜索结果被滤成空数组），已收回 hold。Minor：`finish()` 加在上游再复制；messages 响应用 `text/event-stream`；成功 JSON 另加 `tool_use.input` 断言。均已写入正文。

2026-09-30 第二轮。无 Critical。Important：r15-5 改回 drop。`responsesApiToolSearch.spec.ts` 约第 257–259 行把未支持工具搜索时的 `loadedToolNames` 钉成 `[]`，工具已在顶层 `body.tools`。改成 `toolsMap.has(name)` 会让这条 spec 失败。Minor：反证里的 `src/vs/base/common/sseParser.ts` 改称上游。已写入正文。

2026-09-30 用户签收。`accepted`。未实施。
