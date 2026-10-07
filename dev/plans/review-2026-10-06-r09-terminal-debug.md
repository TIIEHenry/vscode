---
title: "审查 r09：terminal-debug"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "调试内存按错误区间读写，短读被补成零，memory 事件失效区间算反；编辑器终端恢复后 cwd 被空串盖掉。"
---

## r09-1 中
- 症状：查看调试内存时，文件偏移不是 0 的读取会向适配器要错长度，后续页变成空或少一截。
- 位置：`src/vs/workbench/contrib/debug/browser/debugMemory.ts` 第 161–167 行
- 引用：`const ranges = await memory.region.read(pos, length);`，而 `MemoryRegion.read` 把第二个参数当结束偏移：`const length = toOffset - fromOffset`（`src/vs/workbench/contrib/debug/common/debugModel.ts` 第 809–812 行）。接口约定是 `read(fromOffset, toOffset)`（`src/vs/workbench/contrib/debug/common/debug.ts` 第 326 行）。
- 为什么是问题：文件读的 `pos` 是起点、`length` 是字节数。从偏移 8192 读 4096 字节会变成 `read(8192, 4096)`，实际长度是 `4096 - 8192`。变量视图打开内存时 URI 不带 range（`variablesView.ts` 第 800 行），走的就是这条 `MemoryRegion.read`。起点为 0 的第一页碰巧算对，再往下读就会截断或得到负长度。
- 方向：调用处改成 `region.read(pos, pos + length)`。

## r09-2 高
- 症状：带 `range` 的调试内存文件在保存时，字节写到两倍起始偏移，调试目标里另一段内存被改掉。
- 位置：`src/vs/workbench/contrib/debug/browser/debugMemory.ts` 第 127–136 行
- 引用：`await this.write(fd, offset.fromOffset, content, 0, content.length);`。`open` 在有 range 时包一层 `MemoryRegionView`（第 111–112 行），视图再加一次起点：`this.parent.write(this.range.fromOffset + offset, data)`（第 266–268 行）。`readFile` 同样把 `offset.fromOffset` 传进 `read`（第 153 行）。
- 为什么是问题：视图的偏移是相对区间起点的。文件代表的就是这段 range，写入位置却用了绝对的 `fromOffset`。range 为 100–116 时，实际写入地址是 200。读也会先把绝对起点再加一次，再叠上 r09-1 的结束偏移错误。
- 方向：有视图时文件位置用相对偏移 0，不要把 URI 里的绝对 `fromOffset` 再传进去。

## r09-3 中
- 症状：适配器报告某一段内存已变化时，非零起始偏移的失效区间是反的，这块视图不会刷新。
- 位置：`src/vs/workbench/contrib/debug/common/debugModel.ts` 第 802–805 行
- 引用：`this.invalidate(e.body.offset, e.body.count - e.body.offset);`。同一类方法在写入成功时用的是 `this.invalidate(offset, offset + written)`（第 848 行）。协议里 `count` 是更新的字节数（`src/vs/workbench/contrib/debug/common/debugProtocol.d.ts` 第 424–427 行）。
- 为什么是问题：偏移 100、长度 16 会变成 `invalidate(100, -84)`。`MemoryRegionView` 只在 `toOffset > fromOffset` 时继续往外发（`debugMemory.ts` 第 246–250 行），反向区间被丢掉，界面仍显示旧字节。同文件的文件监视用的是 `offset + count`（第 64 行），和这里不一致。
- 方向：事件路径改成 `invalidate(e.body.offset, e.body.offset + e.body.count)`。

## r09-4 中
- 症状：适配器少返回字节且没有不可读尾部时，内存视图把缺口显示成 0x00。
- 位置：`src/vs/workbench/contrib/debug/common/debugModel.ts` 第 825–836 行
- 引用：`if (data.byteLength < dataLength) { const pad = VSBuffer.alloc(dataLength - data.byteLength); pad.buffer.fill(0); data = VSBuffer.concat([data, pad], dataLength); }`，随后在 `unreadable` 为 0 时按完整 `length` 返回 Valid。
- 为什么是问题：协议写明，`data` 短于请求长度且 `unreadableBytes` 为 0 或省略时，应视为可读内存到此结束（`debugProtocol.d.ts` 第 1662 行）。这里用 0 填满请求长度，十六进制视图会把目标里并不存在的零当成内存内容。
- 方向：短读且没有 `unreadableBytes` 时按实际字节数返回，缺口标成不可读或结束，不要补零。

## r09-5 中
- 症状：编辑器里的终端在窗口恢复后，当前工作目录变成空，外壳集成状态里不再显示目录。
- 位置：`src/vs/workbench/contrib/terminal/browser/terminalInstance.ts` 第 590–598 行
- 引用：`await this._createProcess();` 之后执行 `this._cwd = this.shellLaunchConfig.attachPersistentProcess.cwd;`。序列化固定写成 `cwd: ''`（`src/vs/workbench/contrib/terminal/browser/terminalEditorSerializer.ts` 第 43 行）。进程就绪时刚把 `_cwd` 设成真实初始目录（同文件第 1587–1589 行）。
- 为什么是问题：恢复走 `attachPersistentProcess`，就绪事件里的目录先写上，随后又被空字符串盖掉。`cwd` 为空时外壳集成状态直接跳过目录（第 997–999 行），直到下一次目录变更事件才回来。
- 方向：序列化保存真实 cwd；恢复时不要用空的 `attachPersistentProcess.cwd` 覆盖进程已经报上来的目录。
