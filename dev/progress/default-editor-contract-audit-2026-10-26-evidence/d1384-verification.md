---
title: "D1384 远端用户配置重试运行证据"
type: reference
status: implemented
phase: M7
updated: 2026-10-26
summary: "旧生产16项断言失败、4项旧通过、1项超时不计；新生产21过、远端17过。四TS与本轮11TS语义0。全量46诊断/28文件。"
---

# D1384 运行证据

源合入 `3e63f9e6f40e3c3c3dca1a55f47a978ddb02ed1a`，父提交 `8ae96f74878b232e94e9313bafebb4b35a59c874` 与 `c4b9332f9c0e9a028f190bdcf3f6d3bb9cd09f05`。方案提交 `f3006a5f30ed81e6b8e3e7f73e9a7344df523d6e`。产品只覆盖默认编辑器的 `RemoteUserConfiguration`。没有改作者逻辑，没有改 scan 计数或双 catch。D1383 的 19 项和 D1382 的 37 项没有重跑。

## 旧生产身份

esbuild 0.27.2，与 `build/next/transpile.ts` 相同：ES2024、ESM、inline sourcemap、`sourcesContent: false`、`experimentalDecorators`、`useDefineForClassFields: false`，并做 `.ts?esm` → `.js?esm` 替换。对照物是 `git show 4963799b1e95101cc267615cb01b4ebee6939c70:src/vs/workbench/services/configuration/browser/configuration.ts`。基线源 SHA256 `273e2bb3522d07d8fa299d4e0ad60ce2e41aa2f830b83a30de4b878ea1d14e59`。

当时磁盘上的 `out/vs/workbench/services/configuration/browser/configuration.js` 整文件 SHA256 `e44252c5a808d99eb4d96ff39ecfe91ce53f4fef9604da1dafcdd926b8ec36e8`，正文 SHA256 `391b5980e1c5a4211a51b41c175c337cf17bc5acd6a9c5a73f26280636f1c610`，mtime `2026-10-26T04:06:44.983Z`，151970 字节。它与当前 esbuild 转译正文不一致。差异是旧的 class 降形：`const _DefaultConfiguration = class`、`let` 别名、类后静态赋值。去掉这些之后还剩类结束处的一个分号。同一次 04:06 编译里的 tunnel 与 ReviewNav 产物能对上当前 esbuild，所以这是该文件的静态字段降形，不是另一条转译管线。red 没有拿这批磁盘字节当旧生产。

red 基线是把 `4963799b1e95` 的源按上述配置转译后写入该路径。整文件 SHA256 `e204bdb9a6f67173ecc51a98c72ac34451edae772d5832fdea42706c1385c6b9`，正文 SHA256 `2ccf7508e852fa956602c279d216f6f7bbac39b51220fc59bb4218542667f662`，mtime `2026-10-26T08:54:26.644Z`。见 [d1384-install-496.json](d1384-install-496.json)。

## 旧生产 red

只转译三份测试，生产 JS 仍是上面的 496 转译。见 [d1384-test-refresh.json](d1384-test-refresh.json)。两份 node scan 读仓库 TypeScript，不当作旧生产行为 red。

`RemoteUserConfiguration` 用官方 Electron 与隔离 Xvfb。第一进程 3 passing / 9 failing，测试墙钟 15s。其中 7 项是 `AssertionError`，1 项是 15000ms 超时，1 项是 `afterEach` 裸拒绝 `retry connection unavailable`，这把同进程后续用例停掉。超时是 `a synchronous environment throw is observed once and reload can recover`，不计为行为 red。另起进程跑完剩余 10 条：1 passing / 9 failing，9 项都是 `AssertionError`，13ms。

旧生产上已经通过的 4 条：空缓存首次快返、有内容缓存首次快返、`initialize + initialize` 共享成功重试、`null` 环境保持缓存终态。行为断言失败 16 条，包括文件初始化等待、首次后台拒绝、另外两对成功共享、三对原始拒绝共享、`undefined`/`null` 保留、旧 waiter、文件初始化恢复、四条 pending 销毁，以及已销毁的首次后台。不把 21 条都写成 red。日志：[d1384-red.log](d1384-red.log)、[d1384-red-rest.log](d1384-red-rest.log)。

## 新生产 green

只转译生产 `configuration.ts`。当时整文件 SHA256 `f85b24a1bc4369e17cee0cc490ba4829f851fabef7eaf65b779a6aa805c53b3f`，正文 SHA256 `da67db2c0fc97e1f3320bb758bd0ce67c19709c837cebd48225708606f4601ca`，mtime `2026-10-26T08:56:32.681Z`。源 SHA256 `c49baef44a7b675bc4c8f5b1bf87c2948643ebb1fc1c8bc9951a2ddda51fe9e6`。三份测试产物的 SHA256 没有变化。见 [d1384-prod-refresh.json](d1384-prod-refresh.json)。

官方 Electron 隔离 Xvfb：`RemoteUserConfiguration` 21 passing，21ms，[d1384-green.log](d1384-green.log)。`WorkspaceConfigurationService - Remote Folder` 17 passing，153ms，[d1384-green-remote.log](d1384-green-remote.log)。官方 node runner 一次跑两份 scan，15 passing，9ms，[d1384-green-scan.log](d1384-green-scan.log)。scan 只锁源结构：D747 余下六项双链守卫，D827 的 `CancellationError` 导入行。

## 全量编译与定向语义

本轮只跑了一次 `npm run compile-client`，source HEAD `3e63f9e6f40e3c3c3dca1a55f47a978ddb02ed1a`，`2026-10-26T09:01:25Z` 到 `2026-10-26T09:01:55Z`，exit 1。`compile-src` 结束时为 46 errors。解析出的 `error TS` 为 46 条 / 28 个文件。见 [d1384-compile-client.log](d1384-compile-client.log)。原先 `policy-visual-compile-client.log` 的 55/36 没有改。对照结果是消失 9 条、新增 0 条。消失的包括 `configuration.ts:534` TS2339、`remoteUserConfiguration.test.ts:162` TS2352、`tunnelOpenRetry.test.ts` TS2352、五条 D1382 审阅诊断，以及旧日志里的 `conversationRosterStorage.ts:210` TS7006。四份 D1384 文件和本轮 11 份文件都没有出现在这 46 条里。

编译写出的 `configuration.js` 整文件 SHA256 `780c90743f303d58b580cb98e2b6afe674f4644a9fedd9adc014e09c3cd91cc7`，mtime `2026-10-26T09:01:49.813Z`，149199 字节。这是 gulp/tsgo 产物，与 green 所用的 esbuild 正文不同。之后在同一把锁里只做了定向 noEmit 和四份输出的 esbuild fresh，没有第二次全量编译。

TypeScript 6.0.3，未改 `src/tsconfig.json`，一次 `createProgram`，只取目标文件的 syntactic/semantic，`noEmit`，堆 8192MB。四 TS 0 条，本轮 11 TS 0 条，source HEAD 仍是 `3e63f9e6`。见 [d1384-types.json](d1384-types.json)。fresh 把四份输出写回 green 当时的 esbuild 字节。最终生产整文件 SHA256 回到 `f85b24a1bc4369e17cee0cc490ba4829f851fabef7eaf65b779a6aa805c53b3f`，正文 `da67db2c0fc97e1f3320bb758bd0ce67c19709c837cebd48225708606f4601ca`，mtime `2026-10-26T09:04:46.865Z`。见 [d1384-postcompile-fresh.json](d1384-postcompile-fresh.json)。

ESLint `--no-cache` 对四份 TS exit 0：0 errors，6 warnings，都是两份 scan 测试里既有的 `local/code-no-unexternalized-strings`。见 [d1384-eslint.log](d1384-eslint.log)。

## 静态检查

C 对 J 的只读 after：Critical 0，Important 0，方案仍是已签合同，没有新设计。两条 Minor 不阻断：

- `disposed initial background work neither publishes nor reports its late rejection` 只断言 `reports` 为空且 `watchCalls === 0`。它调用了 `rejected(configuration.reload())`，没有断言错误是 `CancellationError`。`rejected()` 把完成和拒绝收成同一种结果，reload 若意外成功，这条仍会过。另外四条 pending 销毁测试检查了取消。生产入口的 `throwIfDisposed` 覆盖这条调用。
- `null` 终态测试核对了三次缓存读取和 `calls === 1`，没有订阅 `onDidInitialize`。生产在没有环境时于发事件之前返回 `undefined`。

J 对 C 的 D1382 静态 after 也是 Critical 0 / Important 0，三条 Minor 不阻断，不闭合 D1382：回调在能力检查后仍用可选 `getWorkRoot`；保留的晚到变更测试在事件后读 getter，新测试在 `onDidChange` 里读路径；工作区测试的单条 `seen` 是通知次数。默认编辑器实拍仍未做，不用本次检查代签。

## 未验证

没有默认编辑器窗口，也没有 Sessions 窗口。没有 push，没有快进人类工位。D1382 仍 open。
