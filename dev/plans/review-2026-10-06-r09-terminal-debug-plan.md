---
title: "方案 r09：terminal-debug"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 4，drop 0，weaken 1。调试内存按结束偏移去读、带 range 的读写把绝对起点加了两次、短读被补成零；memory 事件区间算反但文件监视仍会刷新；编辑器终端恢复后空 cwd 盖掉进程目录。"
---
# 方案 r09：terminal-debug

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 4，drop 0，weaken 1。

## r09-1（hold）

- 问题类：无 range 的调试内存文件把读取字节数当成结束偏移，非零起点会向适配器要错长度。
- 不变量：`IMemoryRegion.read` 的第二个参数是结束偏移（`debug.ts` 第 326 行）。文件 `read` 的 `pos` 是文件内起点，`length` 是字节数。`DebugMemoryFileSystemProvider.read` 调用 `region.read(pos, pos + length)`。`pos === 0` 时适配器收到的 `count` 仍等于请求的字节数。URI 带 range 时，这个 `pos` 仍是相对该文件的位置；`MemoryRegionView.read` 再加一次 `range.fromOffset`。带 range 的整文件 `readFile` 必须同时按 r09-2 传入相对位置 0，否则 `read(fromOffset, fromOffset + width)` 经过视图会变成从两倍起点读到 `fromOffset + width`。
- 要动的符号或文件：`DebugMemoryFileSystemProvider.read`（`src/vs/workbench/contrib/debug/browser/debugMemory.ts` 第 167 行）。把 `memory.region.read(pos, length)` 改为 `memory.region.read(pos, pos + length)`。
- 明确不改什么：不改 `MemoryRegion.read` 里 `const length = toOffset - fromOffset`（`debugModel.ts` 第 809–811 行）。不改 `MemoryRegionView.read` 对 `range.fromOffset` 的加法（`debugMemory.ts` 第 260–263 行）。不改文件 `read` 写入目标 `Uint8Array` 时用的 `offset`。不改 `variablesView.ts` 第 800 行不带 range 的 `getUriForDebugMemory`。
- 怎样本地验证：没有 `DebugMemoryFileSystemProvider.read` 的现有测试。在 `src/vs/workbench/contrib/debug/test/browser/debugMemory.test.ts` 新增断言：无 range 时从 `pos = 8192` 读 4096 字节，`readMemory` 的 `offset` 为 8192、`count` 为 4096；`pos = 0` 时 `count` 仍为请求字节数。现有 `reads a simple range` 测的是 `MemoryRegion.read(10, 14)`，应保持通过。新断言的套件名或标题必须包含 `MemoryRegion`：现有 `suite('MemoryRegion')` 只构造 `MemoryRegion`，`scripts/test.sh --grep "MemoryRegion"` 匹配的是套件加标题，套件名对不上就跑不到文件提供者。用 `scripts/test.sh --grep "MemoryRegion"` 跑。

## r09-2（hold）

- 问题类：带 range 的调试内存文件在保存和整段读取时，把 URI 里的绝对起点又加进已经包过这段 range 的视图，写入落到两倍起点。
- 不变量：`open` 在 URI 有 range 时已经包了 `MemoryRegionView`（`debugMemory.ts` 第 111–112 行）。视图的 `read` / `write` 把相对位置加上 `range.fromOffset`（第 260–263 行、第 266–268 行）。`writeFile` 与 `readFile` 传给文件 `write` / `read` 的位置是相对该文件的 0。range 为 100–116、内容 16 字节时，底层 `writeMemory` 的 `offset` 为 100。同一条件下 `readMemory` 的 `offset` 为 100、`count` 为 16。这依赖 r09-1 把文件 `read` 的第二参数改成 `pos + length`：相对位置 0、长度为区间宽度时，视图得到 `read(0, width)`，父区域得到 `read(fromOffset, fromOffset + width)`。
- 要动的符号或文件：`DebugMemoryFileSystemProvider.writeFile` 第 136 行，`this.write(fd, offset.fromOffset, content, 0, content.length)` 改为 `this.write(fd, 0, content, 0, content.length)`。`readFile` 第 153 行，`this.read(fd, offset.fromOffset, data, 0, data.length)` 改为 `this.read(fd, 0, data, 0, data.length)`。
- 明确不改什么：不去掉 `MemoryRegionView`。不改 `MemoryRegionView.write` 的 `this.range.fromOffset + offset`。不改文件 `write(fd, pos, …)` 把 `pos` 当作文件内相对位置的约定。不改 `writeFile` / `readFile` 在缺少 range 时抛出 `FileNotFound`。
- 怎样本地验证：没有这两条路径的现有测试。在 `src/vs/workbench/contrib/debug/test/browser/debugMemory.test.ts` 新增断言：URI `range=100:116` 时，`writeFile` 写入 16 字节，`writeMemory` 的 `offset` 为 100；`readFile` 的 `readMemory` 为 `offset = 100`、`count = 16`。`fromOffset` 为 0 的 range 仍写到 0。套件名或标题必须包含 `MemoryRegion`，否则 `scripts/test.sh --grep "MemoryRegion"` 选不中。用 `scripts/test.sh --grep "MemoryRegion"` 跑。

## r09-3（weaken）

反证：`DebugMemoryFileSystemProvider.watch`（`debugMemory.ts` 第 64 行）用 `e.body.offset + e.body.count` 判断重叠，命中后发 `FileChangeType.UPDATED`。它听的是 `session.onDidInvalidateMemory`，不经过 `MemoryRegion.invalidate`。变量视图打开的 URI 不带 range（`variablesView.ts` 第 800 行），解析出的 `offset` 为空，同一 `memoryReference` 的事件会直接标成 UPDATED。`MemoryRegion.onDidInvalidate` 在本仓只有 `MemoryRegionView` 订阅（第 246–250 行）；视图再发出的事件没有订阅者。反向区间会被视图丢掉，文件监视仍会通知编辑器重读。

发现稿标中。降为低。

- 问题类：memory 事件把失效区间算成 `count - offset`，非零起点在 `MemoryRegionView` 上被丢掉；文件监视仍会刷新。
- 不变量：`MemoryEvent.count` 是更新字节数（`debugProtocol.d.ts` 第 426–427 行）。`MemoryRegion` 处理该事件时发出的区间与写入成功路径相同：`fromOffset = e.body.offset`，`toOffset = e.body.offset + e.body.count`。偏移 100、字节数 16 得到 `{ fromOffset: 100, toOffset: 116 }`。`MemoryRegionView` 在 `toOffset > fromOffset` 时继续往外发。协议允许 `offset` 为负；负起点同样用加法，不用 `count - offset`。
- 要动的符号或文件：`MemoryRegion` 构造函数里 `session.onDidInvalidateMemory` 的回调（`src/vs/workbench/contrib/debug/common/debugModel.ts` 第 804 行）。`this.invalidate(e.body.offset, e.body.count - e.body.offset)` 改为 `this.invalidate(e.body.offset, e.body.offset + e.body.count)`。
- 明确不改什么：不改 `DebugMemoryFileSystemProvider.watch` 第 64 行。不改 `MemoryRegion.write` 里 `this.invalidate(offset, offset + written)`（第 848 行）。不改 `MemoryRegionView` 第 246–250 行的夹紧与 `toOffset > fromOffset` 判断。
- 怎样本地验证：`debugMemory.test.ts` 已有 `invalidateMemoryEmitter`，没有对它的断言。在现有 `MemoryRegion` suite 新增断言：`memoryReference` 匹配且 `offset = 100`、`count = 16` 时，`onDidInvalidate` 收到 `{ fromOffset: 100, toOffset: 116 }`；`offset = 0`、`count = 16` 时收到 `{ fromOffset: 0, toOffset: 16 }`。现有 `reads a simple range` 与 `reads a non-contiguous range` 保持通过。用 `scripts/test.sh --grep "MemoryRegion"` 跑。

## r09-4（hold）

- 问题类：适配器返回的字节短于请求且没有不可读尾部时，内存区用 0 填满请求长度并标成整段可读。
- 不变量：`ReadMemoryResponse` 写明，`data` 解码后短于请求的 `count`，且 `unreadableBytes` 为 0 或省略时，可读内存到此结束（`debugProtocol.d.ts` 第 1662 行）。`unreadableBytes` 本身是成功读完后的跳过字节数（第 1658–1661 行）。此路径返回一条 `Valid`，`length` 等于解码后的 `data.byteLength`，缓冲区就是这批字节，末尾没有补上的 0。不另加 `Unreadable` 尾部。`unreadableBytes` 大于 0 时仍按现有逻辑：可读段长度为 `length - unreadable`，短了就补 0，长了就截断，再接一条 `Unreadable`。
- 要动的符号或文件：`MemoryRegion.read`（`src/vs/workbench/contrib/debug/common/debugModel.ts` 第 825–836 行）。在 `unreadable === 0` 且 `data.byteLength < length` 时直接返回上述短 `Valid`，跳过第 827–830 行的补零。
- 明确不改什么：不改 `result === undefined || !result.body?.data` 时把整段标成 `Unreadable` 的提前返回（第 814–816 行）。不改 `unreadableBytes > 0` 时的补零、截断和 `Unreadable` 尾部。不改 base64 解码失败时的 `Error` 返回。
- 怎样本地验证：现有 `reads a simple range` 与 `reads a non-contiguous range` 的模拟数据长度刚好等于 `count - unreadable`，不经过补零。在现有 `MemoryRegion` suite 新增断言：请求长度大于解码字节数，且响应省略 `unreadableBytes` 或写成 0 时，结果只有一条 `Valid`，`length` 等于实际字节数，数据末尾没有 0。`unreadableBytes > 0` 且可读段短一截时，现有补零行为保持不变，并单独断言这一点，避免短读修改把这条一并改掉。用 `scripts/test.sh --grep "MemoryRegion"` 跑。

## r09-5（hold）

- 问题类：编辑器终端序列化把 cwd 写成空串，恢复时在进程报出目录之后又用这个空串盖掉 `_cwd`。
- 不变量：`TerminalInputSerializer._toJson` 在 `instance.cwd` 为非空字符串时写下该字符串；`cwd` 为 `undefined` 或 `''` 时仍写 `''`（`ITerminalEditorInputObject.cwd` 的类型是 `string`，`src/vs/workbench/contrib/terminal/browser/terminal.ts` 第 719–724 行）。`_createProcess` 返回之后，`attachPersistentProcess.cwd` 为 `''` 时不写入 `_cwd`。已经启动的持久进程在 `start()` 里同步发出 `onProcessReady`（`ptyService.ts` 第 880 行），`TerminalProcessManager` 把它转成 `ProcessPropertyType.InitialCwd`（`terminalProcessManager.ts` 第 434–440 行），实例在第 1587–1589 行写上 `_cwd`，然后第 597 行才执行。首次启动时 `_validateCwd` 在 `setupPtyProcess` 之前也会发一次 InitialCwd（`terminalProcess.ts` 第 272 行）。这两次都落在 `await this._createProcess()` 里面。空串不得在这之后盖掉已经写上的目录。保存的 cwd 非空时，在这次 `await` 之后写入 `_cwd`，可以盖过刚才的 InitialCwd。
- 要动的符号或文件：`TerminalInputSerializer._toJson`（`src/vs/workbench/contrib/terminal/browser/terminalEditorSerializer.ts` 第 43 行），`cwd: ''` 改为 `instance.cwd` 非空则用该值，否则 `''`。`TerminalInstance` 里 `_xtermReadyPromise` 回调中 `attachPersistentProcess` 分支（`terminalInstance.ts` 第 596–598 行）：仅当 `attachPersistentProcess.cwd` 非空时赋值给 `_cwd`。
- 明确不改什么：不改 `ProcessPropertyType.InitialCwd` 分支（第 1587–1589 行），也不加「已采用恢复 cwd」标志。`relaunch` 会删掉 `attachPersistentProcess` 再起进程（第 1976–1982 行），不会再走进第 597 行；标志若留在实例上，新进程的 InitialCwd 就不能再写 `_cwd`。`ptyProcess.pid` 为 0 时 `_sendProcessId` 推迟到第一次数据（`terminalProcess.ts` 第 351–356 行），报的仍是同一个 `_initialCwd`（第 429–433 行）；`_validateCwd` 已经在这之前发过这个目录。不改同一分支里的 `_setTitle` 与 `setShellType`（第 598–599 行）。不改 `onProcessReady` 里只写 `_initialCwd` 的第 1545 行。不改 `ProcessPropertyType.Cwd`（第 1584 行）和 `CwdDetection`（第 491 行）对 `_cwd` 的后续更新。不改 `_refreshShellIntegrationInfoStatus` 里 `if (cwd)` 才写目录（第 997–999 行）。不改 pty 布局 `_buildProcessDetails` 的 cwd。
- 怎样本地验证：没有覆盖 `TerminalInputSerializer` 或恢复后 `_cwd` 的现有测试。在 `src/vs/workbench/contrib/terminal/test/browser/` 新增断言：序列化时 `instance.cwd` 为非空字符串则 JSON 的 `cwd` 是该字符串，为 `undefined` 或 `''` 时 JSON 的 `cwd` 为 `''`。`InitialCwd` 已把 `_cwd` 写成进程目录之后，`attachPersistentProcess.cwd` 为 `''` 时 `_cwd` 仍是该目录；为另一条非空路径时 `_cwd` 变成该路径。用 `scripts/test.sh --grep "TerminalInputSerializer"` 跑；新断言的标题或套件名必须能被这个 grep 选中。

## 审查

2026-10-06 只读审查后改稿。无 Critical。Important：r09-5 不再改 `InitialCwd` 分支，也不加恢复标志，避免 `relaunch` 之后新进程写不进 `_cwd`；r09-1、r09-2 的新断言必须能被 `MemoryRegion` grep 选中。Minor：`MemoryEvent.count` 行号改为第 426–427 行，`ITerminalEditorInputObject.cwd` 补上 `terminal.ts`。均已写入正文。
