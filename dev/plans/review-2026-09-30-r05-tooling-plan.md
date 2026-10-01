---
title: "方案 r05：tooling"
type: plan
status: accepted
phase: N/A
updated: 2026-10-01
summary: "2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。收紧浏览器单测文件桥的仓库根边界，模块加载失败和页面崩溃改为非 0 退出，workbench 源码变更重生成扩展点清单，Node 单测把未处理拒绝计入退出码。"
---

# 方案

核查：r05-1、r05-2、r05-3、r05-4 为 hold；r05-5 为 weaken。无 drop。

## r05-1

- 问题类：浏览器单测的文件桥只做前缀替换，仓库外路径和 `..` 会直接进 `fs`。
- 不变量：`massagePath` 的结果必须词法落在 `rootDir` 之内，否则五个远程文件方法都不调用 `fs`。
- 要动的符号或文件：`test/unit/browser/index.js` 的 `massagePath`（现 208–213 行）。`__readFileInTests`、`__writeFileInTests`、`__readDirInTests`、`__unlinkInTests`、`__mkdirPInTests` 已共用它，只改这一处即可。替换随机 URL 前缀之后用 `path.resolve` 归一，再以 `path.relative(rootDir, resolved)` 判断：相对路径以 `..` 开头或仍为绝对路径则抛错。`remoteMethod` 已有的 `catch` 会回 500。无前缀的仓库外绝对路径、前缀后接 `..` 越出仓库根，都拒绝。前缀替换后仍在仓库内的快照路径放行。用词法 `path.resolve`，不用 `realpath`（写入目标可能还不存在）。
- 明确不改什么：不改 URL 前缀门禁和 `localhost` 监听，不改静态文件服务，不改 `test/unit/browser/renderer.html` 的 `fetch` 包装，不改 `test/unit/node/index.js` 里同名的进程内文件助手。
- 本地验证：没有现成测试名。断言不要放进会编进 `out/**/*.test.js` 的浏览器套件。用 `node --test` 测抽出的纯函数：前缀换成 `rootDir` 后的仓内路径放行；`/tmp` 一类无前缀绝对路径拒绝；前缀后接 `..` 越出 `rootDir` 拒绝，且拒绝路径上不调用 `fs`。

## r05-2

- 问题类：浏览器单测动态 `import` 失败被换成空模块，零个 mocha 失败时进程以 0 退出。
- 不变量：某个测试模块加载失败时，这次运行记一条失败，非 debug 退出码为 1。只跑这一个坏文件，或其余用例都通过，都一样。
- 要动的符号或文件：`test/unit/browser/renderer.html` 的 `loadModules`（现 237–240 行的 `resolve({})`）。`FILE_PRE_REQUIRE` 已经发出，tdd 的 `test` 可用。加载失败时注册一条会抛错的 mocha 用例（标题带上模块名），让 `PlaywrightReporter` 走现有 `fail` → `failingTests`。不要只 `resolve({})`。`mocha.run(failCount => resolve(failCount === 0))` 的布尔值目前被丢掉，修复不要依赖去读它。
- 明确不改什么：不改 `mocha.setup` 的 ui / timeout，不改 manual `?m=` 不挂 `PlaywrightReporter` 的调试路径，不把失败只做成 `loadAndRun` 拒绝（该拒绝会被 r05-3 的 `catch` 吃掉，退出码仍可能是 0）。
- 本地验证：没有现成测试名。断言意图：`--browser chromium` 只加载一个不存在的模块时退出码为 1，失败信息含该模块名；同一次运行里其它模块通过时，这次加载失败仍然使退出码为 1。

## r05-3

- 问题类：`page.evaluate` / `loadAndRun` 抛错只被打印，当时没有失败用例时退出码为 0。
- 不变量：非 debug 下，页面脚本抛错且 `failingTests` 仍为空时，`runTestsInBrowser` 返回非空失败信息，进程以 1 退出。
- 要动的符号或文件：`test/unit/browser/index.js` 的 `runTestsInBrowser`。现 305–313 行 `catch` 只 `console.error`。记下该错误；319–327 行在 `failingTests` 非空时仍返回原失败摘要；两者都空才返回 `undefined`。`catch` 之后若存在页面错误且没有失败用例，返回含错误文本的字符串。412–419 行已把非空返回值当成失败并 `process.exit(1)`，这段退出判断不用改。
- 明确不改什么：不改 `isDebug` 时不关浏览器、不 `process.exit` 的分支。不改 392–409 行外层 `catch`（`runTestsInBrowser` 自己抛出时已经会退出 1）。不把 r05-2 的加载失败改道到这里。
- 本地验证：没有现成测试名。断言意图：`page.evaluate` 拒绝且 `failingTests` 为空时返回值非空；已有失败用例时仍返回原来的失败摘要，不丢用例名。

## r05-4

- 问题类：增量 `build-fast` 只在 `extensionPoints.json` 自己变更时才跑 `compile-extension-point-names`，workbench 里 `registerExtensionPoint` 的源码变更不会重写这份清单。
- 不变量：非全量时，变更路径落在 `src/vs/workbench/**/*.ts`（与 `compileExtensionPointNamesTask` 的 `gulp.src` 相同）则本次前置任务包含 `compile-extension-point-names`，并且同一轮增量拷贝带上生成后的 json。
- 要动的符号或文件：`build/next/build-fast.ts` 的 `createBuildFastPrerequisites`。与 `apiProposalsChanged` 对称：workbench `.ts` 变更（含删除，路径仍在 `changedPaths` 里）时把 `compile-extension-point-names` 放进 `tasks`，并把 `EXTENSION_POINTS_OUTPUT`（`src/vs/workbench/services/extensions/common/extensionPoints.json`）放进 `clientChangedPaths`。gulp 在增量转译之前写入 `src`，不把输出路径加进 `clientChangedPaths` 的话，`out/` 里的副本不会在这一轮更新。json 自身变更的现有分支保留。
- 明确不改什么：不把 workbench 变更升成 client `full`，不改 `createBuildPlan` 里 `src/` → incremental 的分车道，不改 `applyIncrementalClientChanges`，不改 `build/lib/compilation.ts` 里 `compileExtensionPointNamesTask` 的输入 glob，不改全量任务列表 `copy-codicons` / `compile-api-proposal-names` / `compile-extension-point-names`。
- 本地验证：已有测试 `regenerates changed or deleted generated metadata`（`build/next/test/build-fast.test.ts`）。保留其中「json 自身变更才触发」的断言。另加测试 `regenerates extension point names when workbench TypeScript changes`：`createBuildFastPrerequisites(false, ['src/vs/workbench/contrib/example.ts'])` 的 `tasks` 含 `compile-extension-point-names`，`clientChangedPaths` 同时含该 ts 与 `src/vs/workbench/services/extensions/common/extensionPoints.json`；`src/vs/base/common/foo.ts` 不加入该任务。命令：`npm test --prefix build`。

## r05-5

由中降为低。未捕获异常那一半不成立。

反证：`test/unit/node/index.js` 121–128 行的两个监听器确实只打印、不自己置失败位，267 行 `runner.run(failures => process.exit(failures ? 1 : 0))` 也只看 mocha 失败数。但 Mocha 10.8.2 的 `Runner#_uncaught`（`node_modules/mocha/lib/runner.js` 938–1023 行）在运行未结束时会把未捕获异常记成当前用例失败。同监听器布局下复现：`setTimeout(0)` 在测试函数返回后抛错，`MOCHA_FAILURES 1`，退出码 1；用例仍在执行时 `setTimeout` 抛错同样是退出码 1。运行状态已是 `STATE_STOPPED` 时，Mocha 在 959–961 行把异常重新抛出，进程退出码为 7，不是 0。`uncaughtException` 监听器没有把这类错误变成通过。

仍然成立的是未处理拒绝。`Runner` 构造函数里的 `unhandled`（同文件 175–196 行）对非 Mocha 错误会卸下自己的监听并 `process.emit('unhandledRejection')`，不调用 `this.uncaught`，失败数不加。本仓监听器只打日志；Node 有 `unhandledRejection` 监听器时不再走默认的非 0 退出。复现：测试函数返回后 `Promise.reject`，日志打两次，`MOCHA_FAILURES 0`，退出码 0。`errors.setUnexpectedErrorHandler` 和末尾「should not have unexpected errors in tests」只收 `vs/base/common/errors.js` 那条路径，收不到这次拒绝。加载期的 `didErr` 在 233 行已还原 `stderr.write`，也不覆盖运行期拒绝。

- 问题类：Node 单测把未处理的 Promise 拒绝只打到控制台，mocha 没有失败用例时退出码仍为 0。
- 不变量：出现过未处理拒绝时，即使 mocha 失败数为 0，退出码也是 1。监听器被 Mocha 再发射打进两次，仍只算同一次拒绝。
- 要动的符号或文件：`test/unit/node/index.js` 的 `unhandledRejection` 监听器（125–128 行）和 267 行 `process.exit`。用布尔记下「出现过未处理拒绝」，退出条件改为 mocha 失败数或该布尔任一为真则 1。不要用监听器进入次数当拒绝次数。
- 明确不改什么：不改 `uncaughtException` 监听器，不把 `setTimeout` 抛错再记一套失败（Mocha 已经记了）。不删这个拒绝监听器去换 Node 默认崩溃。不改 `unexpectedErrors` 那条用例的判定来源。
- 本地验证：没有现成测试名。断言意图：与该文件相同的拒绝监听器下，同步用例里 `Promise.reject`，mocha 失败数为 0 时退出码为 1，且同一次拒绝不会因为再发射变成两次。`setTimeout(0)` 在运行未结束时抛错仍只由 Mocha 记 1 次失败、退出码 1。可用 `node --test` 覆盖抽出的退出码判断，并用 `node test/unit/node/index.js --run <只含 Promise.reject 的夹具>` 看进程退出码。

## 审查

2026-09-30 只读审查。无 Critical、Important、Minor，可按正文实施。剩余风险：r05-1 只做词法边界，符号链接可越出仓库根；r05-3、r05-5 没有现成测试名，加载失败若在进 mocha 之前就退出 1，看不出「失败数为 0」。

2026-09-30 第二轮只读审查。无新的 Critical / Important。

2026-09-30 用户签收。`accepted`。未实施。
