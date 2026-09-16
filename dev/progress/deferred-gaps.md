---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-09-16
| D506 | P3 | **closed** `engineMcpSection.ts`（definitions catalog，非 runtime）八处 `void` 无 catch：Add/Update/Remove 钮 `addServer`/`updateSelectedServer`/`removeSelectedServer`；connection listener / constructor `refresh()`；`showWriteFailed` / list-fail / writeFailed `renderStatus` 的 `onRetry` `refresh()`。方法体已有 try/catch（paint failed / write failed）。与 D478 同型：方法体内已吞则 catch-path render 再抛会漏。单层 catch 在 `setUnexpectedErrorHandler` warn 再抛时仍漏，故再链一层（D480）。未改方法体 leftover / leftover-looks-live。未改 catalog `onOpenConnection`。未改 `toggleServer` 行内未 catch Promise。未改 `engineMcpRuntimePanel.ts`（D501）。mocha 锁于 `engineCatalogSections.test.ts`：constructor refresh `listMcpServers` reject 且 stub `status.render` failed throw 且 handler 先 warn 再抛 → 0 unhandled；Remove 钮 `removeSelectedServer` reject 且 stub `status.render` failed throw 且 handler 先 warn 再抛 → 0 unhandled。未扫其它文件。未碰 grpc / pills。未发明 proto。未 compile-client。不得宣称 leftover/pills 完成。不重开 D174/D180/D182/D186/D501。D24 仍开。本文件 leftover **不是**全局完成。 | 工位 I `leftover-d506-engine-mcp-section`；定点 transpile 后 `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/engineCatalogSections.test.ts` **109/0**（含 `assertCleanState` 1；既有 106 + warn 再抛 2） | 八处双链 catch；warn 再抛 0 unhandled；既有 MCP leftover 测仍绿。未关 D8/D16/D147/D24/D405/D487。不重开 D174/D180/D182/D186/D501。不得宣称 leftover 完成。 | conversation / mcp-definitions | closed |
