---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-16
| D518 | P3 | **closed** `connectionPreferencesPane.ts` 八处 fire-and-forget 无 `void`：Login `handleLogin`；Logout `handleLogout`；Refresh devices `refreshHubDirectory`；Direct Connect `handleConnectDirectAddress`；Direct Add `handleAddDirectAddress`；profile Connect `handleConnectSelectedProfile`；Disconnect `handleDisconnect`；Forget `handleForgetSelectedProfile`。方法体已有 try/catch（Direct Connect / profile Connect 经 `connectProfileWithPairing`）；catch-path paint 再抛会漏。本刀八处补 `void` + `.catch(onUnexpectedError).catch(onUnexpectedError)`（对齐 D507 / D480：单层在 handler warn 再抛时仍漏）。未改方法体 leftover / leftover-looks-live。未碰 catalog `onOpenConnection` / `OPEN_CONNECTION`。未改 device-row Connect（`handleConnectDevice`）。未改 D507 九处。mocha 锁：八处 catch-path paint throw 且 handler 先 warn 再抛 → 0 unhandled（`unhandledRejections []`，`unexpectedWarns [paintBoom, paintBoom]`）。未扫其它文件。未碰 grpc / pills / engineOverview/enginePreferences OPEN_CONNECTION leftover。未发明 proto。未 compile-client。不重开 D174/D180/D182/D186/D507。D24 仍开。不得宣称 leftover/pills 完成。 | 工位 G `leftover-d518-connection-pane-no-void`；定点 transpile 后 `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/connectionPreferencesPane.test.ts` **153/0**（含 `assertCleanState` 1；既有 144 + warn 再抛 8） | 八处 void+双链 catch；warn 再抛 0 unhandled；既有 leftover / D507 测仍绿。未关 D8/D16/D147/D24/D405/D487。不重开 D174/D180/D182/D186/D507。本行只关本文件无 void 入口，leftover 程序未全局完成。 | conversation / connection-preferences | closed |
