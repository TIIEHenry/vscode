---
title: "方案 r02：storage-policy"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 2，drop 0，weaken 0。缺文件宽限不再改写监听防抖，非对象读取清掉重试标记。不升 implemented，不升 PRD。"
---
# 方案 r02：storage-policy

状态：执行中。
覆盖需求：无（正文未引用需求编号）。


hold 2，drop 0，weaken 0。

## r02-1（hold，中）

问题类：已加载过的托管设置，会在替换空窗里被缺文件宽限提前确认成缺失并清空。

不变量：曾经成功加载后，在确认文件持续不存在之前，`_rawManagedSettings` 与 `_managedSettings` 保持上一份，且不发出变成空对象的变更。文件监听已经排上的那次读取保持其防抖，不被这次宽限取消或改期。确认仍是 `FILE_NOT_FOUND` 之后才清成 `{}` 并发出变更。从未成功加载时，文件不存在仍得到空对象。

要动的符号或文件：`FileManagedSettingsService.scheduleRefresh` 与 `refresh`（`src/vs/platform/policy/common/fileManagedSettingsService.ts`），以及字段 `_isRetryingMissingFile`。监听入口仍是构造函数里的 `onDidChangeFile(() => this.scheduleRefresh())`。`FILE_NOT_FOUND` 且已成功加载、当前不在重试中的分支不再调用 `scheduleRefresh(100)`。

怎么改：宽限计时与 `ThrottledDelayer` 分开。监听继续只调用不带延迟的 `scheduleRefresh()`，由默认 500ms 把一轮写入收成一次读取。第一次在上述条件下读到 `FILE_NOT_FOUND` 时保留 `previousRaw` / `previous`，并用单独的计时到期后再读一次；这次读取仍缺失才清空并清除重试标记。宽限到期前若监听又调用了 `scheduleRefresh()`，那次读取按原防抖发生。重叠的宽限读取与监听读取继续用 `_refreshGeneration` 丢掉过期结果。

明确不改：不改 `Delayer.trigger` / `ThrottledDelayer` 的取消语义；不改 `normalizeManagedSettings`；不改托管设置的 IPC 与 channel client；不改非法 JSON、`FILE_TOO_LARGE` 及其它非 `FILE_NOT_FOUND` 读失败时保留上一份的行为；不改真实删除且不再出现时最终清空；不改 `FilePolicyService`。

怎样本地验证：现有 `clears managed settings and fires when the file is deleted`、`reads managed-settings.json on startup`、`fires event when file changes`、`returns empty object when file does not exist`、`retains settings when file becomes malformed JSON`、`retains settings when file becomes a JSON array`、`retains settings when read fails with FILE_TOO_LARGE` 仍通过。在 `src/vs/platform/policy/test/common/fileManagedSettingsService.test.ts` 用 `runWithFakedTimers` 新增：已加载后，进行中的刷新读到 `FILE_NOT_FOUND`，同时监听已排上默认防抖；文件在 100ms 之后、该防抖触发之前写回新的 JSON 对象。断言托管设置变为这份新内容，且 `onDidChangeManagedSettings` 不曾先交到空对象。另断言文件删除后不再出现时，清空发生在宽限确认之后，而不是第一次 `FILE_NOT_FOUND` 当次。

## r02-2（hold，低）

问题类：宽限期间读到非 JSON 对象后重试标记仍为真，下一次缺失会跳过宽限直接清空。

不变量：读到非对象（含数组与 `null`）之后 `_isRetryingMissingFile` 为 false，与解析成对象以及其它读错误一致。该次读取仍把 `_rawManagedSettings` / `_managedSettings` 留在上一份，不发变更。此后的下一次 `FILE_NOT_FOUND` 重新进入宽限：先保留上一份，确认仍缺失后再清空。

要动的符号或文件：`FileManagedSettingsService.refresh` 里「不是 JSON 对象」的分支（`src/vs/platform/policy/common/fileManagedSettingsService.ts`）。在保留 `previousRaw` / `previous` 的同时把 `_isRetryingMissingFile` 置为 false。

怎么改：非对象表示这次已经读到文件，只是内容不能当作托管设置。清掉缺文件重试标记，让下一次缺失按 r02-1 的宽限重新计时，而不是走「标记已为真则直接清空」的分支。

明确不改：不把非对象写入当前托管设置；不在该分支清空已加载内容；不改对象成功分支和其它读错误分支里已经会清标记的赋值；不改 `isObject`。

怎样本地验证：现有 `retains settings when file becomes a JSON array` 仍通过。同一测试文件新增：先成功加载，再让一次读取 `FILE_NOT_FOUND` 从而使重试标记为真，随后文件内容变为 JSON 数组或 `null`。断言两份设置仍是加载时的上一份，且没有清空事件。再删除文件，断言这一次缺失不会当次把设置清成 `{}`，而是进入与 r02-1 相同的宽限，确认仍缺失后才清空。
