---
title: "D1383 Tunnel 引用与 provider 重试验证"
type: reference
status: completed
phase: M7
updated: 2026-10-26
summary: "旧生产正文对齐4963799后，新增测试8项行为失败加1次裸拒绝hook；新生产两套件19 passing，两TS定向语义0。全量compile-client未重跑。"
---

# D1383 验证

源 `a9d9babf77fff698375314002ea3599c2f143b23`。产品只覆盖默认编辑器的 `platform/tunnel`。全量 `compile-client` 本轮没有运行；上一轮原始结果仍是 exit 1、55 诊断 / 36 文件，不能当成全仓通过。

## 旧生产身份

esbuild 0.27.2，与 `build/next/transpile.ts` 相同：ES2024、ESM、inline sourcemap、`sourcesContent: false`、`experimentalDecorators`、`useDefineForClassFields: false`，并做 `.ts?esm` → `.js?esm` 替换。对照物是 `git show 4963799b1e95101cc267615cb01b4ebee6939c70:src/vs/platform/tunnel/common/tunnel.ts`。

去掉末尾 `sourceMappingURL` 后，旧 `out/vs/platform/tunnel/common/tunnel.js` 与该转译正文 SHA256 同为 `f1e831881785bea9cf805f57d92c46d27f57add9f76a55cdd2d3cea62c06934c`。整文件 SHA 不同，因为旧文件的 inline source map 更大（55554 字节对转译全文 27186 字节）。当时整文件 SHA256 `c05ce84bcfbdb5d9408a09950e1655e57ce71955332c540c7d0c766bd8976e5b`，mtime `2026-10-26T04:06:43.668Z`。当前源 SHA256 `53c6e8be4397fec766b0ba9e4f0cb046e4315a3a16a248e2b87ae9271e3f3ab0`，与基线源不同。见 [identity.json](identity.json)。

## 旧生产 red

锁内只刷新 `tunnelOpenRetry.test.js`。刷新后旧生产整文件 SHA 与 mtime 未变。测试源 SHA256 `8727f27341aeb4df2af5600902b6f5751ecd35502647ec3cbea252045525674e`，新测试 JS SHA256 `538a0ae17d7b28fcd10956396d0b1c3837c1acf74e48661b0ffa31a35c6f813d`。见 [test-refresh.json](test-refresh.json)。

命令是 `VSCODE_SKIP_PRELAUNCH=1 timeout --foreground -k 20s 180s xvfb-run -a ./scripts/test.sh --no-sandbox --disable-gpu --timeout 15000 --run src/vs/platform/tunnel/test/common/tunnelOpenRetry.test.ts --grep '<14个新标题>'`。进程约 1 秒结束，exit 1。不是加载失败，也不是超时。

[red.log](red.log)：2 passing / 9 failing。八项是行为断言：重复释放提前关掉另一持有者；旧 open 句柄和旧 getExisting 句柄关掉重开后的隧道；pending close 后的旧句柄关掉替换隧道；localhost 与 `0.0.0.0` 两条别名在 getExisting 释放时直接 dispose 底层；打开过程中取得的 existing 句柄不保留独立引用；同步 provider throw 后重试仍是 undefined。两项断言通过：拒绝的 existing 获取保留原错误并可重试；provider Promise 拒绝后调用方收到原错误。后者的根 `afterEach` 另失败一次，原因是未处理的 `provider rejected`（旧裸 `finally`）。这个根 hook 失败让 Mocha 停掉父套件，同进程里后面四项没有跑。

同一旧生产、同一测试 JS，另一次只跑这四项：[red-rest.log](red-rest.log) 4 passing / 0 failing，exit 0。它们是既有门禁：pending 同端口重入、其他端口、`undefined` / 字符串结果、同步 undefined。跑完后旧生产 SHA 仍是上面的基线值。

保留的原三标题不在这次新增 grep 里。其中改写过的 rejection/close/reopen 场景只在新生产完整套件里执行并通过。

## 新生产 green

锁内只刷新 `tunnel.ts`。新生产 SHA256 `5ccceee6d16de0792f650b39038667d62c4c6a0e15f1a8b6eaab4e615bafa073`，mtime `2026-10-26T08:22:04.828Z`。重试测试 JS SHA 保持 `538a0ae1…`。同目录 `tunnel.test.js` 正文已与当前 `tunnel.test.ts` 的同一 esbuild 转译一致，没有刷新。见 [production-refresh.json](production-refresh.json)。

`VSCODE_SKIP_PRELAUNCH=1 timeout --foreground -k 20s 240s xvfb-run -a ./scripts/test.sh --no-sandbox --disable-gpu --timeout 15000 --runGlob '**/platform/tunnel/test/common/*.test.js'`，exit 0。[green.log](green.log) 为 19 passing / 0 failing：`assertCleanState` 1、`Tunnel` `portMapping` 1、`Tunnel open retry` 17。17 项全部出现在输出里，没有未处理拒绝 hook。没有改产品 sandbox，没有连在线引擎或人类配置。

## 类型与 lint

未改 `src/tsconfig.json`。TypeScript 6.0.3 按该项目上下文只取这两个文件的 syntactic/semantic 诊断，`noEmit`，0 条。见 [types.json](types.json)。先前全量日志里的 `tunnelOpenRetry.test.ts` 1 条不在这两份定向结果里；这不是新的全量编译。ESLint 对这两份 TS exit 0，没有报告 error 或 warning；[eslint.log](eslint.log) 只有 Node 对 `NO_COLOR` 的运行时提示。静态检查期间生产 JS SHA 保持 `5ccceee6…`。

## 门禁

`python3 scripts/generate-docs-status.py` 只把方案索引的状态格从 `accepted` 改成 `implemented`。`python3 scripts/check-docs-health.py` 检查 538 份 Markdown，0 errors，46 条既有外链 warnings。`status.md` 151 行。`git diff --check` 通过。

## 未验证

没有第二次全量 `compile-client`。D1382、D1384 的源没有在本轮合入或运行。没有界面实拍；本项没有可见 UI 变化。没有 push，也没有快进人类工位。
