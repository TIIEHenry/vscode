---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-16
| D525 | P3 | **closed** `sourcesFilesList.ts` 两处 fire-and-forget 无 catch：`RunOnceScheduler` 的 `refresh()`；`list.onDidOpen` 的 `openEditor`。`refresh()` 方法体已有 try/catch（吞 fetchChildren）；catch-path `setStatusMessage` 再抛会漏。`onDidOpen` 无内层 try/catch，`openEditor` reject 会漏。本刀两处补 `.catch(onUnexpectedError).catch(onUnexpectedError)`（对齐 D478 方法体已吞 / D480：单层在 handler warn 再抛时仍漏）。未改 explorer model / leftover presentation helpers。未改 Changes/Review/Diff panel。mocha 锁于 `sourcesFilesList.test.ts`：scheduler `refresh` collect throw 且 stub `setStatusMessage` throw 且 handler 先 warn 再抛 → 0 unhandled（`unhandledRejections []`，`unexpectedWarns [paintBoom, paintBoom]`）；`onDidOpen` `openEditor` reject 且 handler 先 warn 再抛 → 0 unhandled（无 paint 路径）。接线扫描锁 scheduler / onDidOpen 双链。未扫其它文件。未碰 grpc / pills / catalog `onOpenConnection`。未发明 proto。未 compile-client。不得宣称 leftover/pills 完成。不重开 D174/D180/D182/D186/D215。D24 仍开。本行只关本文件 fire-and-forget，leftover 程序未全局完成。 | 工位 H `leftover-d525-sources-files-refresh`；定点 transpile 后 `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/contrib/sources/test/browser/sourcesFilesList.test.ts` **5/0**（含 `assertCleanState` 1；既有 2 + warn 再抛 2） | 两处双链 catch；warn 再抛 0 unhandled；既有 leftover 测仍绿。未关 D8/D16/D147/D24/D405/D487。不重开 D174/D180/D182/D186。本文件 leftover fire-and-forget 已收；leftover 程序未全局完成。 | sources / files | closed |
