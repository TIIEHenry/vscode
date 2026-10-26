---
title: "D1382 ReviewNav 工作根失效自动回归"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "旧生产正文对齐496后，新行为3过/7败；新生产37过，五TS语义0。方案仍accepted，默认编辑器实拍未做。"
---

# D1382 自动回归

源合入 `b5f69d4d608445bc12df653c8b013141fff61a4f`，父提交 `c6ef5346127a4b05a88e4ecb5b4ef08ee1099b02` 与 `37aa2956b777f3ac972e9e6564370eb112e6521b`。产品只覆盖默认编辑器的 ReviewNav。全量 `compile-client` 本轮没有运行；上一轮原始结果仍是 exit 1、55 诊断 / 36 文件，不能当成全仓通过。D1383 的 19 项没有重跑。

## 旧生产身份

esbuild 0.27.2，与 `build/next/transpile.ts` 相同：ES2024、ESM、inline sourcemap、`sourcesContent: false`、`experimentalDecorators`、`useDefineForClassFields: false`，并做 `.ts?esm` → `.js?esm` 替换。对照物是 `git show 4963799b1e95101cc267615cb01b4ebee6939c70:src/vs/workbench/contrib/conversation/browser/conversationReviewNavService.ts`。

去掉末尾 `sourceMappingURL` 后，旧 `out/vs/workbench/contrib/conversation/browser/conversationReviewNavService.js` 与该转译正文 SHA256 同为 `7366bfc47b5159e4a3db7f3bab07e11d04a4433aaa543bcdfe1be4994247b8ce`。整文件 SHA 不同，因为 inline source map 不同。当时整文件 SHA256 `8fa8fbd8f1f8135065c75bff117f87771733d52f9a4da133bfcfd61e81c0a361`，mtime `2026-10-26T04:06:46.113Z`。基线源 SHA256 `a0d7aa95c545e587fe80abaa6c937ba09c1d10aa22a971a3492968c26118f3b3`。合入后的源 SHA256 `8fb2ac3053f844f0458c9b3c9213602300de8fd12a048c2c5d6ceb5766aab4dd`，与基线不同。见 [d1382-identity.json](d1382-identity.json)。

改动 TS 共 5 个：生产 `conversationReviewNavService.ts`，测试 `agentSessionContext.test.ts`、`conversationReviewEntry.test.ts`、`conversationReviewNavService.test.ts`，以及新 harness `conversationReviewNavTestHarness.ts`。

## 旧生产 red

只转译上述四份测试和 harness，生产 JS 的 SHA256 与 mtime 保持不变。见 [d1382-test-refresh.json](d1382-test-refresh.json)。

命令是 `VSCODE_SKIP_PRELAUNCH=1 timeout --foreground -k 20s 180s xvfb-run -a ./scripts/test.sh --no-sandbox --disable-gpu --timeout 15000 --run src/vs/workbench/contrib/conversation/test/browser/conversationReviewNavService.test.ts --grep '<五个新标题>'`。进程 exit 1。测试体 14ms，不是加载失败，也不是超时。

[d1382-red.log](d1382-red.log) 为 3 passing / 7 failing。通过的是直接 Context 的活动与非活动连接通知，以及 dispose。七项失败都是 `AssertionError`：

- 非活动会话 workDir 变化后回调 `seen` 仍为 `[]`。
- 工作区目录增加、移除后回调 `seen` 仍为 `[]`。
- 非活动会话的 SCM 增加、移除后回调 `seen` 仍为 `[]`。移除时期望读到 `sources-git-unrooted:/src/a.ts`。
- delayed DI 的活动与非活动连接通知仍读到 `file:///home/test/project/src/a.ts`，期望是 `file:///home/test/other/src/a.ts`。

直接构造的 Context 在连接通知时已经先提交根，所以这两项在旧生产上通过。dispose 断言的 session、工作区与 SCM 监听在旧生产上本来就没有登记，所以该项也通过。七项失败才是这次新增行为。

## 新生产 green

只转译生产 `conversationReviewNavService.ts`。新整文件 SHA256 `27704b8313bfffc6e03a373f02b4cdf46289b25bc7a56cfbb7ab046840270701`，正文 SHA256 `14942b9c1ccaaa3d059963b14afd17a996376f9f6405b82c7b839ec5fbb5fe5a`，mtime `2026-10-26T08:41:10.798Z`。四份测试产物的 SHA256 没有变化。见 [d1382-prod-refresh.json](d1382-prod-refresh.json)。

`VSCODE_SKIP_PRELAUNCH=1 timeout --foreground -k 20s 240s xvfb-run -a ./scripts/test.sh --no-sandbox --disable-gpu --timeout 15000`，运行 ReviewNav、ReviewEntry、AgentSessionContext 三套，以及相邻的 browser `conversationReviewEntry` 挂载两例。官方 Electron 与隔离 Xvfb，没有改产品 sandbox，没有连在线引擎或人类配置。

[d1382-green.log](d1382-green.log) 为 **37 passing / 0 failing**：清理检查 1、ReviewNav 12、ReviewEntry 15、AgentSessionContext 7、审阅挂载 2。12 条 ReviewNav 含原先失败的 7 条。`ConversationLensProjection` 用替身提供审阅服务，这次没有跑它。

## 类型与 ESLint

五份改动 TS 放在未修改的 `src/tsconfig.json` 项目里，只取这些文件的 syntactic/semantic 诊断，`noEmit`。TypeScript 6.0.3。默认 Node 堆约 4GB 时进程 exit 134，这是堆上限，不是类型诊断。同一命令以 `NODE_OPTIONS=--max-old-space-size=8192` 重跑，诊断 0。见 [d1382-types.json](d1382-types.json)。这不是全量 compile。

ESLint `--no-cache` exit 0：0 errors / 4 warnings。四条都是 `agentSessionContext.test.ts` 第 6、8、15、17 行既有的 `local/code-import-patterns`。本轮 diff 没有新增这四条 import。见 [d1382-eslint.log](d1382-eslint.log)。

## 门禁

`python3 scripts/generate-docs-status.py` 报告 already up to date，`--check` 为 generated status: OK。`python3 scripts/check-docs-health.py` 检查 540 份 Markdown，0 errors，46 条既有外链 warnings。`status.md` 153 行。见 [d1382-docs-health.log](d1382-docs-health.log)、[d1382-generated-status.log](d1382-generated-status.log)。

## 未闭合

J 的静态 after 在 `/tmp/vscode-d1382-grok-peer-review.md`，读到的结论是 Critical 0、Important 0，并且写明它自己不闭合 D1382。默认编辑器窗口没有启动。未实拍的点是：已有审阅行在工作区目录或 SCM 仓库变化后是否更新、非活动并列叶是否一起更新、更新后的点击目标。自动测试不代替这次实拍。方案保持 accepted，D1382 保持 open。没有启动 `src/vs/sessions` 窗口或它的网页 e2e。
