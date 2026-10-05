---
title: "未开启工具搜索时保留历史搜索结果"
type: plan
status: draft
phase: N/A
updated: 2026-10-05
summary: "谓词缺省时历史工具搜索保留 toolsMap 里命中的工具；这次请求没有工具搜索且组不出工具时，保留原文，不换成空的 tool_search_output。方案保持 draft。不升 PRD。不宣布 r15 完成。"
---

# 未开启工具搜索时保留历史搜索结果

> **slice_id**：`r15-5-tool-search-history`
> **来源**：[审查 r15](review-2026-09-30-r15-copilot-core.md) 的 r15-5。行号作废，以当前代码为准。已签收全文在 [方案 r15](review-2026-09-30-r15-copilot-core-plan.md)，其中 r15-5 为 drop。本稿不改那篇正文，只补本条现在要落地的合同。
> **本稿是方案，未签收。** 状态保持 `draft`。不升 PRD。不宣布 r15 或十六路审查完成。
> **冲突域**：`extensions/copilot/src/platform/endpoint/node/responsesApi.ts` 的 `buildToolSearchOutputTools` 与 `ChatRole.Tool` 分支，以及 `responsesApiToolSearch.spec.ts`。
> **不改**：连接服务、session actor、Preview、proposed API、`dev/loop/**`、`status.md`、`deferred-gaps.md`、`engine-protocol-surface.md`、人类工位、槽 C。不改 r15-1 到 r15-4 已落地的行为。

## 0. 一句话结论

下一次请求没有开启延迟加载时，历史里的工具搜索结果不得变成 `tools: []`。谓词缺省且名字在 `toolsMap` 里时，这些工具仍放进 `tool_search_output`。这次请求根本没有工具搜索、又组不出工具时，模型看到的是原来的结果文本。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `shouldDeferTools` 为 false 时，`shouldLoadToolFromToolSearch` 被赋成 `undefined` | `responsesApi.ts` `createResponsesRequestBody` |
| `buildToolSearchOutputTools` 的过滤含 `shouldLoadToolFromToolSearch?.(name) === true`。谓词缺省时可选调用得到 `undefined`，每个名字都被丢掉 | 同文件 `buildToolSearchOutputTools` |
| `ChatRole.Tool` 在 `toolSearchCallIds` 命中时一律推 `tool_search_output`，`tools` 用上面的数组。没有 `toolsMap` 时直接用 `[]` | 同文件 `rawMessagesToResponseAPI` |
| 因此合法工具名数组或原来的结果文本会被换成 `tools: []` | 同上 |
| 谓词存在时，非延迟工具本来就不进 `tool_search_output`。只有非延迟名字时结果就是 `tools: []`。这条是开启搜索后的现有行为 | `responsesApiToolSearch.spec.ts` |
| 已签收方案把「未支持模型的 `loadedToolNames === []`」收成 drop。那条断言钉住的就是这次要改的空数组 | [方案 r15](review-2026-09-30-r15-copilot-core-plan.md) 的 r15-5。不改该文 |

## 2. 合同

### 过滤

1. `shouldLoadToolFromToolSearch` 缺省时，保留字符串名字，且该名字不是搜索工具自己，并且 `toolsMap` 里有它。
2. 谓词存在时，仍只保留谓词返回 `true` 的名字。返回 false 或其它值的名字丢掉。解析失败或结果不是数组时仍返回空数组。
3. 组出来的工具形状不变：`type: 'function'`、`defer_loading: true`、`strict: false`。不从顶层 `body.tools` 里删掉已经内联的工具。

### 这次请求没有工具搜索

`shouldLoadToolFromToolSearch === undefined` 就是这次请求没有开启工具搜索（`shouldDeferTools` 为 false）。此时：

1. 过滤之后仍有工具：照旧发 `tool_search_output`，`tools` 是这些命中。随后对同一名字的 `function_call` 仍可以带搜索命名空间。
2. 过滤之后没有工具（没有 `toolsMap`、名字对不上、解析失败，或只剩搜索工具自己）：不要发 `tools: []` 的 `tool_search_output`。这条结果走普通工具结果，原文留在 `function_call_output` 里，模型读得到。
3. 助手侧名叫搜索工具的调用仍写成 `tool_search_call`，不改成名为 `tool_search` 的 `function_call`。
4. 谓词存在时，即使过滤结果为空，仍发 `tool_search_output`。不把「只搜到非延迟工具」改成原文。

不改：从 `previous_response_id` 补出来、历史里已经没有结果文本的那条空 `tool_search_output`。那不是把已有结果换成空数组。

## 3. 明确不做

- 不改 r15-1 到 r15-4（按 index 累积工具参数、缺省 `arguments` 不当字符串、SSE `finish`、解析失败保留原始参数文本）。
- 不改已签收方案 r15 的正文，不把它升成 `implemented`。
- 不改连接服务、session actor、Preview、proposed API。
- 不升 PRD。不宣布 r15 或十六路审查完成。

## 4. 验证

这是 copilot 扩展里的 vitest，不进 `compile-client` 所覆盖的工作台编译，也不进 `scripts/test.sh`。在 `extensions/copilot` 跑：

`npm run test:unit -- --run src/platform/endpoint/node/test/responsesApiToolSearch.spec.ts`

断言：

- 谓词缺省（模型不支持工具搜索）且历史名字在 `toolsMap` 中：`tool_search_output.tools` 含这些名字，不含搜索工具自己和对不上的名字。不是 `[]`。
- 这次请求没有工具（或名字都不在 `toolsMap`）：输入里没有 `tool_search_output`，对应 `function_call_output.output` 是原来的结果文本。
- 搜索已开启且结果全是非延迟工具：仍是 `tool_search_output` 且 `tools` 为 `[]`。

`compile-client` 只在它能编到这份扩展时才跑。锁被占用时不抢第二路，只跑上面的切片。

## 5. 只读自审

本稿写完后在同一会话内自审。没有另开只读 reviewer。因此状态保持 `draft`，不标可签收。实施按本节核对后的合同全文做，不收窄。

- 谓词缺省时一律改回原文，则 `toolsMap` 命中不会出现在 `tool_search_output`，第一条合同看不见。合同只在组不出工具时才保留原文。
- 谓词缺省时一律发 `tool_search_output`，则这次请求没有工具时仍是 `tools: []`。合同禁止这一条。
- 谓词存在且过滤为空时若也改成原文，会改掉「只搜到非延迟工具」的现有 spec。合同保持空 `tool_search_output`。
- 已签收方案把这条收成 drop，是因为旧断言把空数组钉死。本稿不改那篇，避免把已签收正文改口；本切片以本稿为准。
- 给组出来的工具去掉 `defer_loading` 会改 `ToolSearchLoadedTool` 的形状。合同沿用现有形状。
