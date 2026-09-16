---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-16
| D527 | P3 | **closed** `navigatorTeamList.ts` 两处：`RunOnceScheduler` `void this.refreshTeamData()` 无 catch（`refreshTeamData` 方法体已有 try/catch，D53 leftover）；members `onDidOpen` reveal 残留单层 `.catch(onUnexpectedError)` 升双链。`openInspectPanel` `openView` ~723 已双链，不重做。对齐 D478/D480：方法体内已吞则 catch-path notice/paint 再抛会漏；单层在 `setUnexpectedErrorHandler` warn 再抛时仍漏。未改 leftover-looks-live / pairing-hold / listed-gate。未碰 `navigatorAgentsView.ts`（D521）。未碰 catalog `onOpenConnection` / `OPEN_CONNECTION`。mocha 锁于 `navigatorTeamSubviews.test.ts`：scheduler `refreshTeamData` `memberStatus` throw 且 stub `setTeamSnapshotNote` throw 且 handler 先 warn 再抛 → 0 unhandled（`unhandledRejections []`，`unexpectedWarns [paintBoom, paintBoom]`）；member row-open reveal catch-path notify 再抛且 handler 先 warn 再抛 → 0 unhandled。未扫其它文件。未碰 grpc / pills。未发明 proto。未 compile-client。不得宣称 leftover/pills 完成。不重开 D53/D174/D180/D182/D186/D491/D521。D24 仍开。本行只关本文件 fire-and-forget，leftover 程序未全局完成。 | 工位 J `leftover-d527-navigator-team-catch`；定点 transpile 后 `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/contrib/navigator/test/browser/navigatorTeamSubviews.test.ts` **41/0**（含 `assertCleanState` 1；既有 38 + warn 再抛 2） | 两处双链 catch；warn 再抛 0 unhandled；既有 D53 leftover 测仍绿。未关 D8/D16/D147/D24/D405/D487。不重开 D53/D174/D180/D182/D186/D521。本文件 leftover fire-and-forget 已收；leftover 程序未全局完成。 | navigator / team | closed |
