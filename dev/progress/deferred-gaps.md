---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-16
| D511 | P3 | **closed** `conversationEngineSnapshotsList.ts` 七处单层 `.catch(onUnexpectedError)` 升级为双链（D486 已补单层；本刀对齐 D480：单层在 `setUnexpectedErrorHandler` warn 再抛时仍漏）。listeners/show 的 `refresh()` 四处；`restoreThenRefreshList`；`deleteThenRefreshList`；行内 `deleteSnapshot`。方法体不改。未改 leftover-looks-live / pairing-hold / listed-gate 写闸。mocha 锁：show `refresh` `listSnapshots` reject 且 stub `paintListFailed` throw 且 handler 先 warn 再抛 → 0 unhandled（`unhandledRejections []`，`unexpectedWarns [paintBoom, paintBoom]`）；Restore `restoreSnapshot` reject 且 `paintWriteStatus` throw 同锁；Delete `deleteThenRefreshList` reject 且 paint throw 同锁；`deleteSnapshot` confirm reject 且 handler 先 warn 再抛 → 0 unhandled。未扫其它文件。未碰 grpc / pills / catalog `onOpenConnection`。未发明 proto。未 compile-client。不得宣称 leftover/pills 完成。不重开 D174/D179/D180/D182/D186/D486。D24 仍开。本行只关本文件 fire-and-forget，leftover 程序未全局完成。 | 工位 G `leftover-d511-snapshots-double-catch`；定点 transpile 后 `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationEngineSnapshotsList.test.ts` **43/0**（含 `assertCleanState` 1；既有 40 + warn 再抛 2） | 七处双链 catch；warn 再抛 0 unhandled；既有 leftover 测仍绿。未关 D8/D16/D147/D24/D405/D487。不重开 D486。本文件 leftover fire-and-forget 已收；leftover 程序未全局完成。 | conversation / snapshots | closed |
