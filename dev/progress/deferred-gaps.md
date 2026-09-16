---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-16
| D504 | P3 | **closed** `engineRulesSection.ts` 三处 `void this.refresh()` 无 catch：connection listener / constructor；failed `onRetry`。`refresh()` 方法体已有 try/catch（paint failed）。与 D478 同型：方法体内已吞则 catch-path render 再抛会漏。单层 catch 在 `setUnexpectedErrorHandler` warn 再抛时仍漏，故再链一层（D480 / D500）。未改 refresh 方法体 leftover / leftover-looks-live。未改 catalog `onOpenConnection`。未改 hooks。mocha 锁：constructor refresh `listProjectRules` reject 且 status.render failed throw 且 handler 先 warn 再抛 → 0 unhandled（`unhandledRejections []`，`unexpectedWarns [paintBoom, paintBoom]`）。未扫其它文件。未碰 grpc / pills。未发明 proto。未 compile-client。不得宣称 leftover/pills 完成。不重开 D174/D180/D182/D186。D24 仍开。本行只关本文件 fire-and-forget，leftover 程序未全局完成。 | 工位 D `leftover-d504-engine-rules`；定点 transpile 后 `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/engineRulesSection.test.ts` **5/0**（含 `assertCleanState` 1；既有 3 + warn 再抛 1） | 三处双链 catch；warn 再抛 0 unhandled；既有 leftover 测仍绿。未关 D8/D16/D147/D24/D405/D487。不重开 D174/D180/D182/D186。本文件 leftover fire-and-forget 已收；leftover 程序未全局完成。 | conversation / engine-rules | closed |
