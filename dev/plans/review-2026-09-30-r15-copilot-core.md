---
title: "审查 r15：copilot-core"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "聊天补全流会把并行工具参数拼错、function_call 缺字段会直接中断，SSE 收尾与工具搜索结果也会丢掉。"
---

# 发现

## r15-1 中
- 症状：同一次聊天补全里模型并行调用多个工具时，后到的参数片段会被接到最后一个工具上。前一个工具的参数变空或变短，后一个工具的参数被拼进另一段 JSON，工具要么解析失败，要么用错参数执行。
- 位置：`extensions/copilot/src/platform/networking/node/stream.ts` 第 110–123 行
- 引用：
```
110|	update(choice: ExtendedChoiceJSON): ICopilotToolCallStreamUpdate[] {
111|		const updates: ICopilotToolCallStreamUpdate[] = [];
112|		choice.delta?.tool_calls?.forEach(toolCall => {
113|			let currentCall: StreamingToolCall | undefined;
114|			if (toolCall.id) {
115|				currentCall = this.toolCalls.find(call => call.id === toolCall.id);
116|			}
117|			if (!currentCall) {
118|				currentCall = this.toolCalls.at(-1);
119|			}
120|			if (!currentCall || (toolCall.id && currentCall.id && currentCall.id !== toolCall.id)) {
121|				currentCall = new StreamingToolCall();
122|				this.toolCalls.push(currentCall);
123|			}
```
- 为什么是问题：`IToolCall`（`extensions/copilot/src/platform/networking/common/openai.ts` 第 275–278 行）把 `index` 定为关联键，续传片段通常只有 `index` 和 `arguments`、不再带 `id`。这里没有读 `index`。没有 `id` 时一律落到 `toolCalls` 的最后一项。同一个 `delta.tool_calls` 里若同时出现 index 0 和 index 1 的续传，或 index 0 的续传出现在 index 1 已经建档之后，两段参数都会追加到最后一次调用上。`defaultChatResponseProcessor` 用的就是这个 `SSEProcessor`。
- 方向：按 `toolCall.index` 取累积槽，只在该 index 尚不存在时新建。

## r15-2 中
- 症状：流式 `function_call` 的第一包只带函数名、不带 `arguments` 时，整次补全在拼参数处抛错，已收到的文本和后续参数都到不了界面。
- 位置：`extensions/copilot/src/platform/networking/node/stream.ts` 第 39–54 行
- 引用：
```
39|		if (choice.delta?.function_call && (choice.delta.function_call.name || choice.delta.function_call.arguments)) {
40|			const str = APIJsonDataStreaming._removeCR(choice.delta.function_call.arguments);
41|			this._text.push(str);
42|			this._newText.push(str);
43|		}
44|	}
45|
46|	flush(): string {
47|		const delta = this._newText.join('');
48|		this._newText = [];
49|		return delta;
50|	}
51|
52|	private static _removeCR(text: string): string {
53|		return text.replace(/\r$/g, '');
54|	}
```
- 为什么是问题：第 518–523 行在 `name` 或 `arguments` 任一存在时就 `append(choice)`。条件把「只有 name」放进这个分支，接着无条件调用 `_removeCR`。`arguments` 为 `undefined` 时 `text.replace` 抛出 TypeError。这个异常不在 JSON 解析的 try 里，`processSSE` 的 finally 只负责关掉流，请求以失败结束。
- 方向：`arguments` 缺省时按空字符串拼接，不要对缺省字段调用 `_removeCR`。

## r15-3 中
- 症状：Responses 或 Anthropic Messages 的流在最后一个事件后直接结束、没有多出一个空行时，`response.completed` 或 `message_stop` 停在解析器里。这一轮没有完成对象，界面上的回复停住，已经流出来的工具调用也进不了最终消息。
- 位置：`extensions/copilot/src/util/vs/base/common/sseParser.ts` 第 123–135 行
- 引用：
```
123|		if (offset < chunk.length) {
124|			this.buffer.push(chunk.subarray(offset));
125|		} else {
126|			this.endedOnCR = chunk[chunk.length - 1] === Chr.CR;
127|		}
128|	}
129|	/**
130|	 * Processes a single line from the SSE stream.
131|	 */
132|	private processLine(line: string): void {
133|		if (!line.length) {
134|			this.dispatchEvent();
135|			return;
```
- 为什么是问题：事件只在读到空行时 `dispatchEvent`。类里没有在流结束时把 `buffer` 里的半行和 `dataBuffer` 里已完成的事件再派发一次。`processResponseFromMessagesEndpoint`（`extensions/copilot/src/platform/endpoint/node/messagesApi.ts` 第 744–746 行）和 `processResponseFromChatEndpoint`（`extensions/copilot/src/platform/endpoint/node/responsesApi.ts` 第 990–992 行）都是 `feed` 到 body 结束就返回。连接在最后一条 `data:` 之后关掉、或最后一块没有换行时，终态事件被留下。
- 方向：在 body 读完后把剩余缓冲按一行处理并派发未发出的事件。

## r15-4 中
- 症状：把含工具调用的助手消息再发给 Anthropic 时，参数不是合法 JSON 就变成空对象。模型下一轮看到的调用和上一轮真正执行的参数对不上，工具结果像是另一次调用的输出。
- 位置：`extensions/copilot/src/platform/endpoint/node/messagesApi.ts` 第 341–351 行
- 引用：
```
341|						let parsedInput: Record<string, unknown> = {};
342|						try {
343|							parsedInput = JSON.parse(toolCall.function.arguments);
344|						} catch {
345|							// Keep empty object if parse fails
346|						}
347|						content.push({
348|							type: 'tool_use',
349|							id: mapToolCallId(toolCall.id),
350|							name: toolCall.function.name,
351|							input: parsedInput,
```
- 为什么是问题：用户在参数还没写完时停下，或流被截断后历史里留下半截 `arguments`。重放时 `JSON.parse` 失败，`input` 固定为 `{}`，原始字符串不再出现在 `tool_use` 里。对应的 `tool_result` 仍是按真实参数执行的结果，下一轮请求里调用和结果错位。
- 方向：解析失败时保留原始参数文本或明确的失败标记，不要改写成空对象。

## r15-5 中
- 症状：历史里已有的工具搜索结果，在下一次未开启延迟加载的请求中变成空的 `tool_search_output`。模型以为搜索没有找到工具，随后那些调用也带不上搜索命名空间。
- 位置：`extensions/copilot/src/platform/endpoint/node/responsesApi.ts` 第 533–539 行
- 引用：
```
533|function buildToolSearchOutputTools(resultText: string, toolsMap: Map<string, OpenAiFunctionTool>, shouldLoadToolFromToolSearch: ((name: string) => boolean) | undefined): ToolSearchLoadedTool[] {
534|	let toolNames: unknown;
535|	try { toolNames = JSON.parse(resultText); } catch { return []; }
536|	if (!Array.isArray(toolNames)) { return []; }
537|
538|	return toolNames
539|		.filter((name): name is string => typeof name === 'string' && name !== CUSTOM_TOOL_SEARCH_NAME && toolsMap.has(name) && shouldLoadToolFromToolSearch?.(name) === true)
```
- 为什么是问题：第 75 行 `shouldDeferTools` 在非 Agent/MessagesProxy、子代理，或请求里没有工具搜索时为 false。第 130 行于是把 `shouldLoadToolFromToolSearch` 设成 `undefined`。第 468 行仍会把历史中的搜索工具结果交给这个函数。谓词缺省时 `undefined === true` 把每个名字都滤掉，合法的工具名数组变成 `tools: []`，原来的结果文本不再发送。
- 方向：谓词缺省时保留 `toolsMap` 里命中的工具；未启用搜索时不要把原结果替换成空的 `tool_search_output`。
