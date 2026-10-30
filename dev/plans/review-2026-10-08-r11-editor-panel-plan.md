---
title: "方案 r11：editor-panel"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 0，drop 0，weaken 1。桥探测未确认时不把本地新建终端当成已选命令。不伪造已连接。不升 implemented，不升 PRD。"
---
# 方案 r11：editor-panel

状态：执行中。
覆盖需求：无（正文未引用需求编号）。


hold 0，drop 0，weaken 1。

## r11-1（weaken，低）

问题类：Terminal 空态在桥探测未结束或被拒绝时，把「尚未确认」写成已选的本地新建终端命令。

不变量：引擎已连接且这次连接上 `isBridgeAvailable()` 得到 true 时，空态「New Terminal」的键位查询与点击都使用 `previewUniverseAgentPtyEditorCommandId`。探测还在飞，或同一次连接上最近一次探测被拒绝时，点击不执行 `previewTerminalLocalCommandId`。探测得到 false，或引擎未连接时，键位与点击都使用 `previewTerminalLocalCommandId`，且未连接时不调用 `isBridgeAvailable()`。断开后，在飞探测返回的 true 不得把按钮改回引擎命令。实例 dispose 后，在飞探测不得再 `render()`。键位查询的 command id 与点击执行的 command id 保持同一个。

要动的符号或文件：`EditorGroupWatermark` 的 `bridgeAvailable`、`queryBridgeAvailable`、`getCategoryActions`，以及 `render` 里空态按钮的 click（`src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts`）。构造时已连接会先 `queryBridgeAvailable()` 再立刻 `render()`；`onDidChangeConnection` 的已连接分支只调用 `queryBridgeAvailable()`；`catch` 把拒绝写成 `result = false` 后赋给 `bridgeAvailable`。测试在 `src/vs/workbench/test/browser/parts/editor/editorGroupWatermark.test.ts`。

怎么改：把桥状态分成未知、已确认可用、已确认不可用。现有的 `false` 只留给已确认不可用。构造时若已连接，以及连接变为已连接时，先标未知再探测。未知期间不要调用 `previewTerminalEmptyStateCommand(connected, false)` 来生成可执行的本地命令。按钮可以留下，点击等待当前这次探测；没有在飞查询时再查一次，结束后按当时的连接和结果执行。`queryBridgeAvailable` 的 `catch` 保持未知，不把 `bridgeAvailable` 设为 false，也不把这次拒绝当成同一次连接的最终结果。拒绝之后，同一次连接上的下一次点击再查。`onDidChangeCategory` 与 `onDidUpdateKeybindings` 引起的 `render()` 只按未知态重画，不在每次重画时再打 `isBridgeAvailable()`。探测 resolve 为 true 或 false 之后，仍写入该状态并 `render()`，让键位与点击落到同一条命令。断开时仍同步作废 generation，落到未连接的本地命令并 `render()`。

明确不改：`previewTerminalEmptyStateCommand` 在已连接且已确认可用时返回 `previewUniverseAgentPtyEditorCommandId`、其余已确认情况下返回 `previewTerminalLocalCommandId`。`UniverseAgentPtyChannel.call` 的 `isBridgeAvailable`。`WebUniverseAgentPty.isBridgeAvailable`。`universeAgentPtyTerminal.ts` 里 `previewUniverseAgentPtyEditorCommandId` 的建终端实现。未连接不探测、过期 generation 忽略迟到的 true、dispose 后不 `render()`。Code、Web 及其它分类的空态动作。快捷键注册表。

怎样本地验证：保留 `terminal empty state command resolves consistently for keybinding lookup and execution`、`stale async isBridgeAvailable result is ignored when connection drops or generation advances`、`isBridgeAvailable is not called when disconnected`、`watermark disposal while isBridgeAvailable is in flight does not trigger render`。同一套件新增两条断言。其一：引擎已连接且 `isBridgeAvailable` 仍 pending 时，点击空态按钮不执行 `previewTerminalLocalCommandId`；该 promise 随后 resolve true 后，键位查询与点击都是 `previewUniverseAgentPtyEditorCommandId`。其二：同一次连接不发出 `onDidChangeConnection`，第一次 `isBridgeAvailable` reject，之后的点击再查并 resolve true，该次点击执行 `previewUniverseAgentPtyEditorCommandId`。

反证：探测成功时 `queryBridgeAvailable` 末尾会把结果写入 `bridgeAvailable` 并 `render()`。`terminal empty state command resolves consistently for keybinding lookup and execution` 在 `await Promise.resolve()` 之后断言引擎命令，成功返回后按钮会改绑。桌面 `UniverseAgentPtyChannel.call` 的 `isBridgeAvailable` 是 `Promise.resolve(true)`，不进入 `catch`。Web `WebUniverseAgentPty.isBridgeAvailable` 按合同 `Promise.resolve(false)`，同样不进入 `catch`。分类切换和快捷键更新会用当前标志再画一次，成功的在飞探测结束时仍会再 `render()`。按钮上的键位是 `lookupKeybinding(action.id)` 的标签，注册表里的引擎命令绑定保持原样。错绑限于探测未完成，以及 IPC 拒绝之后不再重查；严重度从中降为低。
