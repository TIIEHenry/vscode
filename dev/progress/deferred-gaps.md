---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-16
| D509 | P3 | **closed** `enginePluginsSection.ts` 四处写路径 `void` 无 catch：Scan New `scanNew()`；Enable `enableSelected()`；Reload `reloadSelected()`；Unload `unloadSelected()`。方法体已有 try/catch（`showWriteFailed`）。与 D478 同型：方法体内已吞则 catch-path render 再抛会漏。单层 catch 在 `setUnexpectedErrorHandler` warn 再抛时仍漏，故再链一层（D480 / D500）。未改 refresh / loadInfo（D502 已双链）。未碰 catalog `onOpenConnection`。mocha 锁：Scan/Enable/Reload/Unload 点击 RPC reject 且 status.render failed throw 且 handler 先 warn 再抛 → 0 unhandled（`unhandledRejections []`，`unexpectedWarns [paintBoom, paintBoom]`）。未扫其它文件。未碰 grpc / pills。未发明 proto。未 compile-client。不得宣称 leftover/pills 完成。不重开 D174/D180/D182/D186/D502。D24 仍开。本行只关本文件写路径 fire-and-forget，leftover 程序未全局完成。 | 工位 D `leftover-d509-engine-plugins-writes`；定点 transpile 后 `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/enginePluginsSection.test.ts` **39/0**（含 `assertCleanState` 1；既有 34 + warn 再抛 4） | 四处双链 catch；warn 再抛 0 unhandled；既有 leftover / D502 refresh·loadInfo 测仍绿。未关 D8/D16/D147/D24/D405/D487。不重开 D174/D180/D182/D186/D502。本文件写路径 leftover fire-and-forget 已收；leftover 程序未全局完成。 | conversation / plugins | closed |
