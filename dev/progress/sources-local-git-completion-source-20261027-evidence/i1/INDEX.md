---
title: "Sources local Git：a227 I1命令转发窄修订静态原件"
type: reference
status: active
phase: M7
updated: 2026-10-27
summary: "原Astra a227源码peer C0/I1/M0经root采纳，仅两test命令转发改await handler后return undefined；各一次AST/no-cache lint，未checker/运行，待窄peer。"
---

# a227 I1：命令转发窄修订

固定 parent `a22776d0f63d117d876f7c66c8d223ebd04eb4aa`，parent src `debf0168b4b1a863464a60437af5f08ac29fe0af`。原 Astra / architecture_audit 正式源码 peer 为 **C0/I1/M0**；root 独核并采纳唯一 I1，另授权本窄test-only修订。来源为原 reviewer 消息及root采纳，无独立报告文件。[原a227作者静态原件](../INDEX.md)全部保持，不改写其结果或身份。

I1属于静态声明合同：CommandsRegistry.getCommand 返回默认 `ICommand`（R=void），invokeFunction 保留返回R；fixture 的泛型 executeCommand 则承诺 `Promise<T | undefined>`。原直接 return 不能据此满足任意T。这里只按采纳意见，在两个既有fixture各改为 `await instantiation.invokeFunction(command.handler, ...args);` 后 `return undefined;`，真实异步handler仍被等待，reject继续传播，成功保持无值；不加cast/any/helper。**没有运行checker，不记实际TypeScript诊断。**

| 原件 | 内容 |
| --- | --- |
| [commands.json](commands.json) | 两test实际AST/no-cache lint命令与exit code、权限与未达flags。 |
| [ast-only.json](ast-only.json) | 各一次createSourceFile-only实际stdout，parseDiagnostics均空，Node禁compilecache。 |
| [eslint-no-cache.json](eslint-no-cache.json) | 实际stdout字段含原始末尾空行；exit0、0errors、1旧Panel637 warning。 |
| [source-scope.json](source-scope.json) | 两精确替换及反向还原父文件证明；两生产整文件与其余所有源码/用例/断言不变。 |
| [metadata-before.json](metadata-before.json) / [metadata-after-checks.json](metadata-after-checks.json) | 实际只读guard stdout；out/.build/node_modules递归lstat与72.node摘要精确一致。 |

原套114仅静态展开，模板、用例及断言均未改或运行。源码修订待root核固定commit→原Astra窄peer；plan accepted/runtime pending，旧业务red/新green/完整两模块及匹配产物资格另审另释，lease运行最高优先、独立after不变。未Program/checker/compile/transpile/emit/tests/out/cache/engine/UI/after，不合merge、不push、不动54fe或B。
