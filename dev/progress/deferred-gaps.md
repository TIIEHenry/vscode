---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-16
| D516 | P3 | **closed** `enginePreferencesPane.ts` 两处 `void this.runEngineTest()` 无 catch：banner Test Engine 点击；footer Test Engine 点击。`runEngineTest` 方法体已有 try/catch（`writeStatus`）。与 D478 同型：方法体内已吞则 catch-path paint 再抛会漏。单层 catch 在 `setUnexpectedErrorHandler` warn 再抛时仍漏，故再链一层（D480 / D514）。未改方法体 leftover / leftover-looks-live。未改 `OPEN_CONNECTION` 命令 lambda（不加 catch）。mocha 锁：banner `probeEngine` reject 且 catch-path `writeStatus` throw 且 handler 先 warn 再抛 → 0 unhandled（`unhandledRejections []`，`unexpectedWarns [paintBoom, paintBoom]`）；footer 同路径 → 0 unhandled。未扫其它文件。未碰 grpc / pills。未发明 proto。未 compile-client。不得宣称 leftover/pills 完成。不重开 D174/D180/D182/D186/D407/D411。本刀只闭本文件 `runEngineTest` void catch。D24 仍开。 | 工位 D `leftover-d516-engine-preferences-test`；定点 transpile 后 `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/enginePreferencesPane.test.ts` **21/0**（含 `assertCleanState` 1；既有 18 + warn 再抛 2） | 两处双链 catch；warn 再抛 0 unhandled；既有 leftover / probe 测仍绿。未关 D8/D16/D147/D24/D405/D487。不重开 D174/D180/D182/D186/D407/D411。未碰 OPEN_CONNECTION。本文件 leftover fire-and-forget 已收；leftover 程序未全局完成。 | conversation / engine-preferences | closed |
