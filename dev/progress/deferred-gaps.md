---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-16
| D513 | P3 | **closed** `conversationSessionChatService.ts` 两处 `void` 无 catch：`mountSubAgentOverlay` 的 `promoteSubAgentDialog` / `navigateAgentBreadcrumb`。本文件无其它 `void this.<async>`。两方法体已有 try/catch（`notificationService.error`）。与 D478 同型：方法体内已吞则 catch-path notice 再抛会漏。单层 catch 在 `setUnexpectedErrorHandler` warn 再抛时仍漏，故再链一层（D480 / D500）。未改方法体 leftover / leftover-looks-live / pairing-hold。未改 overlay / 其它 conversation UI。mocha 锁：overlay pop-out promote 在 `openExtensionTab` throw 且 notice 再抛且 handler 先 warn 再抛 → 0 unhandled；overlay breadcrumb 在 `openEditor` throw 且 notice 再抛且 handler 先 warn 再抛 → 0 unhandled（`unhandledRejections []`，`unexpectedWarns [paintBoom, paintBoom]`）。未扫其它文件。未碰 grpc / pills。未发明 proto。未 compile-client。不得宣称 leftover/pills 完成。不重开 D85/D87/D149/D174/D180/D182/D186。D24 仍开。本行只关本文件 fire-and-forget，leftover 程序未全局完成。 | 工位 I `leftover-d513-session-chat-service`；定点 transpile 后 `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationSessionChat.test.ts` **43/0**（含 `assertCleanState` 1；既有 40 + warn 再抛 2） | 两处双链 catch；warn 再抛 0 unhandled；既有 leftover 测仍绿。未关 D8/D16/D147/D24/D405/D487。不重开 D85/D87/D149/D174/D180/D182/D186。本文件 leftover fire-and-forget 已收；leftover 程序未全局完成。 | conversation / session-chat | closed |
