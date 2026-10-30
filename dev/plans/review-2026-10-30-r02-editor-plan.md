---
title: "十六路审查 r02：editor 方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "hold 3，weaken 0。"
---
# 十六路审查 r02：editor 方案

状态：草案。
覆盖需求：无（正文未引用需求编号）。

| 编号 | 判定 | 严重度 |
|:-----|:-----|:-------|
| r02-1 | hold | 中 |
| r02-2 | hold | 中 |
| r02-3 | hold | 中 |

### r02-1

**问题类：** 跨文件内联建议的 `IReference` 只挂在新建 `InlineSuggestionIdentity.onDispose` 上，这份 identity 没被 `addRef`/`removeRef` 降到 0 时，模型引用不会释放。

**不变量：** 每次 `createModelReference` 得到的引用在同一时刻只有一个所有者。建议没进最终状态、或最终状态保住的是另一份 identity 时，引用留在这次 fetch 的 `store` 里，由 `finally` 的 `store.dispose()` 释放。被 `InlineCompletionsState` 以同一份 identity `addRef` 的引用，在 `transaction` 提交之后从 `store` 卸下再绑到那份 identity，留到 `removeRef` 把计数降到 0 再 `dispose`，且只释放一次。卸下之前不要让 `store` 和 `onDispose` 同时持有同一次引用。`ReferenceCollection` 的计数只在 `dispose` 时减少，引用对象被回收不会减计数。

**要动的符号或文件：**

- `InlineCompletionsSource.fetch`。`store` 是这个函数的局部变量。`createStateWithAppliedResults` 的参数里没有 `store`，`InlineSuggestionIdentity` 上也没有「持有哪次 `IReference`」的字段。跨文件的 `modelRef` 放进这次 fetch 的 `store`。取消、版本变化、跳走等 `return false` 不进状态，引用留在 `store`，由 `finally` 释放。
- 状态 `transaction` 提交之后、`finally` 之前，仍在 `fetch` 里做转交。滤掉的项留在 `store`。真正进状态、且状态 `addRef` 的就是这次新建的 identity 时，用 `deleteAndLeak` 把这次引用从 `store` 卸下，再绑到这份 identity 的 `onDispose`。
- `withIdentity` 换成旧 identity 时，这次新建的 `acquire` 留在 `store` 里释放。不要在 `createStateWithAppliedResults` 里判断旧 identity 是否已经持有同一模型的引用。那份信息只在 `fetch` 的局部表里。
- `RenameSymbolProcessor.proposeRenameRefactoring` 若 `return InlineSuggestionItem.create(...)`，新对象接不走跨文件的 `modelRef`。原对象的引用留在 `store`。返回同一个 `suggestItem` 时，按上面的转交处理。

**明确不改什么：**

- `ITextModelService.createModelReference` 的合同，以及 `ReferenceCollection` / `AsyncReferenceCollection`。
- `targetUri` 与当前 `_textModel` 相同的分支（`disposable` 保持为空）。
- `TextModelValueReference.snapshot`。
- provider 列表上已有的 `list.addRef` / `list.removeRef`（`store` 里那份）。
- `accept`、部分接受、`jump` 里成对的 `addRef` / `removeRef`。它们作用在已经进状态的项上，不负责这次 fetch 临时拿来的模型引用。

**怎样本地验证：** 现有 `MockTextModelService.createModelReference`（`src/vs/editor/contrib/inlineCompletions/test/browser/utils.ts`）的 `dispose` 是空的，没有断言计数。在 `src/vs/editor/contrib/inlineCompletions/test/browser/` 给跨文件建议加断言：

- fetch 在拿到引用之后因取消或文档版本变化 `return false`：该引用 `dispose` 一次。
- `createStateWithAppliedResults` 因偏好普通补全或 `semanticId` 重复而没收下该项：`dispose` 一次。
- 项以自己的 identity 进入 `InlineCompletionsState`，状态 `dispose` 之前不 `dispose` 引用，状态 `dispose` 时恰好一次。
- `withIdentity` 复用旧 identity：释放跟着被 `addRef` 的那份 identity；新建后被丢掉的 identity 不能把引用留住，也不能让同一次 `acquire` 被 `dispose` 两次。
- `proposeRenameRefactoring` 返回新对象时，跨文件那次 `acquire` 在 fetch 结束时释放。

用 `scripts/test.sh --run src/vs/editor/contrib/inlineCompletions/test/browser/inlineCompletionsSource.test.ts` 或 `--grep` 跑上述浏览器测试。`scripts/run-unit-custom.sh` 只加载 conversation、sources、universeAgent，不会跑到这份测试。

### r02-2

**问题类：** 内联重命名命令没有等待 `bulkEditService.apply`，命令先成功返回，拒绝没有回到这条命令，`_renameRunnable` 也在 `apply` 落地前被清掉。

**不变量：** 实际执行的 `renameSymbolCommandId` 处理函数在这次 `apply` 落定之后才结束。`apply` 拒绝时，命令的 promise 同样拒绝。每个模型各有一个 `RenameSymbolProcessor`，构造时 `registerCommand` 把新处理函数插到链表头，`CommandService` 只跑最新的一个。较新的模型还活着时，拥有 `_renameRunnable` 的那个 processor 的 `finally` 不会跑。在飞标记放在 `RenameSymbolRunnable` 上，拥有它的 `isRenamePossible` 能看见。标记为真时，另一个 `requestUuid` 不得 `cancel()` 再把 `_renameRunnable` 置空。

**要动的符号或文件：**

- `RenameSymbolProcessor` 构造函数里 `CommandsRegistry.registerCommand(renameSymbolCommandId, …)`。在 `getWorkspaceEdit` 与第二次 `isValid` 都通过之后，`await bulkEditService.apply(workspaceEdit, { reason: source })`。在飞标记写在传入的 `RenameSymbolRunnable` 上，`await` 之前置上，`await` 落定后清掉。现有 `finally` 里「仅当 `this._renameRunnable === renameRunnable` 时置空」留在这次 `await` 之后。执行方的 `this` 若不是拥有这份 runnable 的 processor，不得靠那个 `this` 上的字段去挡住另一个 `requestUuid`。
- 拥有 `_renameRunnable` 的 `isRenamePossible` 读这份 runnable 上的标记。标记为真时返回 `false`，且不改 `_renameRunnable`。计算还没调用 `apply` 时，不同 `requestUuid` 仍可取消并换掉 runnable。

**明确不改什么：**

- `await renameRunnable.getWorkspaceEdit()` 之后、调用 `apply` 之前的 `renameRunnable.isValid(this._codeEditorService)`。
- `sendNesRenameRequest` 里给当前文件盖上的 `versionId`，以及 `ResourceTextEdit` 的这个参数。
- `BulkTextEdits._validateBeforePrepare` / `_validateTasks`：带 `versionId` 且模型版本已经变了就拒绝。`_validateBeforePrepare` 在 `await _createEditsTasks()` 之前。`_validateTasks` 在那次 `await` 之后、单模型路径上到 `task.apply` 之前没有再 `await`。后醒来且带了 `versionId` 的那份，会在 `task.apply` 之前被 `_validateTasks` 拒绝。不要写成两道校验都贴在 `apply` 前、中间没有 `await`。
- `IBulkEditService.apply` 的签名，以及 `rawRename` 的 provider 协议。无 `versionId` 的编辑（`rawRename` 的结果、NES 里其它文件）今天没有这道版本拒绝，锁提前放开时两份都可以落下。修的是锁和 `await`，不是去改批量编辑服务。

**怎样本地验证：** 已有套件 `renameSymbolProcessor - stale rename guards`（`src/vs/editor/contrib/inlineCompletions/test/browser/renameSymbolProcessor.test.ts`）：

- `revalidates the captured editor state after awaiting the workspace edit`
- `stamps NES edits with the version captured when the rename was proposed`

这两条继续保持。同套件补断言：

- 命令处理函数对 `bulkEditService.apply` 的调用是 `await`，且 `_renameRunnable = undefined` 写在该 `await` 之后。
- `apply` 的 promise 拒绝时，命令 promise 拒绝。
- `apply` 尚未落定时，拥有这份 runnable 的 `isRenamePossible` 对另一个 `requestUuid` 返回 `false`，并且 `_renameRunnable` 仍是正在 `apply` 的那份。`isRenamePossible` 是私有的。断言走会读到它的公开路径，或像现有两条那样核对源码字符串里标记与 `await` 的位置。不要假设测试能直接调用私有方法，也不要假设停住 `apply` 的是正在执行命令的那个 processor。

用 `scripts/test.sh --run src/vs/editor/contrib/inlineCompletions/test/browser/renameSymbolProcessor.test.ts` 跑这个文件。不要用 `scripts/run-unit-custom.sh`。

### r02-3

**问题类：** 粘贴过程中点取消，取消回调只 `p.cancel()`，不等这次粘贴结束。版本仍停在粘贴前就 `applyDefaultPasteHandler`。`applyEditAndShowIfNeeded` 在 `await bulkEditService.apply` 返回后若 token 已取消就直接 `return`，已经写下的 provider 编辑留在缓冲里，默认粘贴再叠一份。

**不变量：** 取消回调先等这次粘贴 promise 结束，再看撤销栈。只有版本回到粘贴前、且这次粘贴没有留下 provider 编辑时，才走默认粘贴。provider 编辑已经落下且 token 已取消时，先撤掉这次粘贴推进的撤销元素，再决定要不要默认粘贴。

**要动的符号或文件：**

- `src/vs/editor/contrib/dropOrPasteInto/browser/copyPasteController.ts` 的取消回调。在 `p.cancel()` 之后等待 `p` 结束，再按最终版本和撤销栈调用 `applyDefaultPasteHandler`。
- `src/vs/editor/contrib/dropOrPasteInto/browser/postEditWidget.ts` 的 `applyEditAndShowIfNeeded`。`apply` 已经成功且 token 已取消时，撤掉这次编辑，不要直接 `return` 把编辑留在文档里。

**明确不改什么：**

- 不改默认粘贴在没有 provider 编辑时的现有内容。
- 不改 `bulkEditService.apply` 的选项形状，除了取消路径要能撤掉已经落下的那一次。

**怎样本地验证：** 在 `src/vs/editor/contrib/dropOrPasteInto/test/browser/` 新增断言：provider 编辑尚未结束时取消，默认粘贴发生在该 promise 结束之后；若 provider 编辑已经写入，取消结束后文档里只有一份结果，不是默认粘贴叠在 provider 编辑上。用 `scripts/test.sh --grep` 配上新测试名。

## 审查

2026-10-30 只读审查的结论是须改稿，Critical 无。Important 已改：r02-3 从没有说明的 drop 改回 hold。r02-1 的转交留在 `fetch`，因为 `createStateWithAppliedResults` 拿不到 `store`。r02-2 的在飞标记放在 `RenameSymbolRunnable` 上，因为最新注册的命令处理函数不一定是拥有 `_renameRunnable` 的那个 processor。验证改用 `scripts/test.sh`，不用 `run-unit-custom.sh`。
