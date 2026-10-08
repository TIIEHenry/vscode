---
title: "审查 r02：storage-policy"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "2 条，最重是缺文件重试会取消监听防抖并提前清空已加载的托管设置。"
---

## r02-1 中
- 症状：已经加载过的企业托管设置，会在文件替换还没落定的空窗里被清成空对象，限制随之卸掉。
- 位置：`src/vs/platform/policy/common/fileManagedSettingsService.ts` 第 111–115 行
- 引用：`this._isRetryingMissingFile = true` 之后调用 `this.scheduleRefresh(100)`
- 为什么是问题：文件监听调用不带延迟的 `scheduleRefresh()`（第 57 行），同一个 `ThrottledDelayer`（第 42 行，默认 500ms）把一轮写入收成一次读取。`scheduleRefresh`（第 73 行）每次 `trigger` 都会取消尚未触发的超时。进行中的 `refresh` 若先读到 `FILE_NOT_FOUND`，会先把重试标记设上，再把监听已经排好的那次读取改到 100ms 后。这次读取看到标记已为真，文件仍缺失就走到第 116–120 行，把 `_rawManagedSettings` 和 `_managedSettings` 换成 `{}` 并发出变更。空窗长于 100ms 时，上一份已生效的限制被卸掉；若替换的文件事件已经进了被取消的那次防抖，后面没有新事件就不会再把文件读回来。
- 方向：宽限重试不要改写监听已经排上的防抖，确认文件仍不存在后再清空。

## r02-2 低
- 症状：宽限重试读到文件还在、但不是 JSON 对象之后，下一次短暂缺失会直接清空上一份托管设置。
- 位置：`src/vs/platform/policy/common/fileManagedSettingsService.ts` 第 101–105 行
- 引用：非对象分支只把 `_rawManagedSettings` / `_managedSettings` 设回 `previousRaw` / `previous`
- 为什么是问题：这次读取说明文件已经重新出现。解析成对象时会把 `_isRetryingMissingFile` 置回 false（第 97 行），其它读错误也会（第 124 行），非对象分支不动这个标记。标记保持 true 时，下一次 `FILE_NOT_FOUND` 走第 116–120 行直接清空，不再排 100ms 宽限。先缺文件、再读到数组或 `null`、随后又缺一次，就会卸掉仍应保留的上一份限制。
- 方向：读到非对象时清掉缺文件重试标记，让下一次缺失重新宽限一次。
