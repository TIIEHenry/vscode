---
title: "十六路审查 r01：base 发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样审查 src/vs/base 的状态、销毁、持久化与竞态，确认 5 条可复现的行为问题。"
---
# 十六路审查 r01：base 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。


抽样范围是 `src/vs/base` 下与状态所有权、销毁、持久化、错误被吞掉和竞态相关的实现。下面每条都能对上这次读到的代码。

### r01-1

- 严重度：高
- 症状：IndexedDB 读键值失败或事务被中止时，调用方拿到的是已读到的一部分 Map，Promise 仍然成功。
- 代码：

```104:109:src/vs/base/browser/indexedDB.ts
	close(): void {
		if (this.pendingTransactions.length) {
			this.pendingTransactions.splice(0, this.pendingTransactions.length).forEach(transaction => transaction.abort());
		}
		this.database?.close();
		this.database = null;
	}
```

```207:215:src/vs/base/browser/indexedDB.ts
			// Error handlers
			const onError = (error: Error | null) => {
				console.error(`IndexedDB getKeyValues(): ${toErrorMessage(error, true)}`);

				resolve(items);
			};
			cursor.onerror = () => onError(cursor.error);
			transaction.onerror = () => onError(transaction.error);
		}).finally(() => this.pendingTransactions.splice(this.pendingTransactions.indexOf(transaction), 1));
```

- 为什么是问题：`getKeyValues` 的 Promise 只有 `resolve`。游标或事务出错时，它把当时的 `items` 当成完整结果返回。`close()` 会 `abort()` 挂起的事务，同样走进这条成功路径。调用方无法区分「库是空的」和「只读到一半」，若按这份 Map 回写，未读到的键会被丢掉。
- 方向：读失败或事务中止时拒绝 Promise，不要提交半截 Map。

### r01-2

- 严重度：中
- 症状：`Throttler.queue` 在已有任务执行时再入队，后一个 Promise 在任务失败时永远不结束；销毁时则变成成功的 `undefined`。
- 代码：

```250:274:src/vs/base/common/async.ts
		if (this.activePromise) {
			this.queuedPromiseFactory = promiseFactory;

			if (!this.queuedPromise) {
				const onComplete = () => {
					this.queuedPromise = null;

					if (this.cancellationTokenSource.token.isCancellationRequested) {
						return;
					}

					const result = this.queue(this.queuedPromiseFactory!);
					this.queuedPromiseFactory = null;

					return result;
				};

				this.queuedPromise = new Promise(resolve => {
					this.activePromise!.then(onComplete, onComplete).then(resolve);
				});
			}

			return new Promise((resolve, reject) => {
				this.queuedPromise!.then(resolve, reject);
			});
		}
```

- 为什么是问题：外层 Promise 只把 `resolve` 交给 `.then(resolve)`。排队任务返回的 Promise 一旦拒绝，这里没有 `reject`，`queuedPromise` 一直挂起，中间那个拒绝也没有人接。`dispose()` 取消后 `onComplete` 直接 `return`，同一个 `.then(resolve)` 会用 `undefined` 完成，调用方会以为任务已经成功。
- 方向：排队任务的拒绝和取消都要传到返回的 Promise。

### r01-3

- 严重度：中
- 症状：`IterativePagedModel` 里两个调用方等同一页时，先发起的那次取消会让后一次也失败，这一页不会进入 `items`。
- 代码：

```394:416:src/vs/base/common/paging.ts
		// If already loading, return the cached promise
		if (this.loadingPromise) {
			await this.loadingPromise;
			return;
		}

		const pagePromise = this.pager.getNextPage(cancellationToken);

		this.loadingPromise = pagePromise
			.then(page => {
				this.items.push(...page.items);
				this._hasNextPage = page.hasMore;

				// Clear the loading promise before firing the event
				// so that event handlers can trigger loading the next page if needed
				this.loadingPromise = null;

				// Fire length update event
				this._onDidIncrementLength.fire(this.length);
			}, err => {
				this.loadingPromise = null;
				throw err;
			});
```

- 为什么是问题：进行中的加载只有一份，但 `getNextPage` 用的是第一个调用方的 `cancellationToken`。该 token 取消后，共享的 `loadingPromise` 拒绝，`items` 不追加。后加入的调用方只是 `await` 这份 Promise，自己的 token 仍然有效，却收到同一次取消。
- 方向：共享加载不要绑定单个调用方的取消令牌。

### r01-4

- 严重度：中
- 症状：流已经因背压把数据放进缓冲并返回未完成的 Promise 后，`destroy()` 丢掉这些数据，写方的 Promise 也不结束。
- 代码：

```266:272:src/vs/base/common/stream.ts
		else {
			this.buffer.data.push(data);

			// highWaterMark: if configured, signal back when buffer reached limits
			if (typeof this.options?.highWaterMark === 'number' && this.buffer.data.length > this.options.highWaterMark) {
				return new Promise(resolve => this.pendingWritePromises.push(resolve));
			}
		}
```

```451:464:src/vs/base/common/stream.ts
	destroy(): void {
		if (!this.state.destroyed) {
			this.state.destroyed = true;
			this.state.ended = true;

			this.buffer.data.length = 0;
			this.buffer.error.length = 0;

			this.listeners.data.length = 0;
			this.listeners.error.length = 0;
			this.listeners.end.length = 0;

			this.pendingWritePromises.length = 0;
		}
	}
```

- 为什么是问题：超过 `highWaterMark` 的 `write()` 已经把块放进 `buffer.data`，并让调用方等待 `pendingWritePromises`。这些 Promise 只在 `flowData()` 里被 resolve。`destroy()` 清空缓冲和等待列表，不 resolve 也不 reject，已交给流的块消失，写方一直挂着。
- 方向：销毁时拒绝仍在等待的写 Promise，并明确这次缓冲不会被消费。

### r01-5

- 严重度：中
- 症状：异步查找控制器销毁后，防抖中的查找仍会执行；`endSession` 与后续销毁叠在一起。
- 代码：

```299:299:src/vs/base/browser/ui/tree/asyncDataTree.ts
	private taskQueue = new ThrottledDelayer(250);
```

```310:323:src/vs/base/browser/ui/tree/asyncDataTree.ts
		this.disposables.add(toDisposable(async () => {
			if (this.activeSession) {
				await this.findProvider.endSession?.();
			}
		}));
	}

	protected override applyPattern(_pattern: string): void {
		this.renderMessage(false);

		this.activeTokenSource?.cancel();
		this.activeTokenSource = new CancellationTokenSource();

		this.taskQueue.trigger(() => this.applyPatternAsync());
	}
```

```387:397:src/vs/base/common/lifecycle.ts
	dispose() {
		if (this._isDisposed) {
			return;
		}
		if (!this._fn) {
			throw new Error(`Unbound disposable context: Need to use an arrow function to preserve the value of this`);
		}
		this._isDisposed = true;
		markAsDisposed(this);
		this._fn();
	}
```

```1123:1128:src/vs/base/browser/ui/tree/abstractTree.ts
	dispose() {
		this._history = undefined;
		this._onDidChangePattern.dispose();
		this.enabledDisposables.dispose();
		this.disposables.dispose();
	}
```

- 为什么是问题：`applyPattern` 把查找放进 250ms 的 `ThrottledDelayer`，但 `dispose()` 不取消 `activeTokenSource`，也不 dispose `taskQueue`。定时器到点后 `applyPatternAsync` 看到的 token 仍有效，会在控制器已经销毁时调用 `find`。`endSession` 包在 async 函数里，`FunctionDisposable.dispose` 只调用 `_fn()`，不等待返回的 Promise，注释要求的「先结束会话再销毁」不会发生。
- 方向：销毁时取消当前 token、停掉 `taskQueue`，并在其余拆卸之前完成 `endSession`。

## 实际打开的文件

- `src/vs/base/browser/indexedDB.ts`
- `src/vs/base/browser/ui/scrollbar/scrollableElement.ts`
- `src/vs/base/browser/ui/tree/abstractTree.ts`
- `src/vs/base/browser/ui/tree/asyncDataTree.ts`
- `src/vs/base/common/async.ts`
- `src/vs/base/common/cancellation.ts`
- `src/vs/base/common/errors.ts`
- `src/vs/base/common/event.ts`
- `src/vs/base/common/jsonRpcProtocol.ts`
- `src/vs/base/common/lifecycle.ts`
- `src/vs/base/common/paging.ts`
- `src/vs/base/common/sseParser.ts`
- `src/vs/base/common/stream.ts`
- `src/vs/base/common/worker/webWorker.ts`
- `src/vs/base/node/pfs.ts`
- `src/vs/base/node/zip.ts`
- `src/vs/base/parts/ipc/common/ipc.ts`
- `src/vs/base/parts/ipc/node/ipc.net.ts`
- `src/vs/base/parts/storage/common/storage.ts`
- `src/vs/base/parts/storage/node/storage.ts`
