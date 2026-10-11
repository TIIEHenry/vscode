---
title: "审查 r07：workbench-shell"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "4 条；createOnly 在没有文件提供者时仍会覆盖已打开的可写文本。"
---

## r07-1 高
- 症状：带 `createOnly` 的写入在磁盘创建失败、且该 URI 没有文件提供者时，会把已经打开的可写文本整篇换成请求内容。
- 位置：`src/vs/workbench/services/agentHost/common/agentHostResourceService.ts` 第 162–175 行
- 引用：

```ts
if (params.createOnly) {
    await this._fileService.createFile(uri, buf, { overwrite: false });
} else {
    await this._fileService.writeFile(uri, buf);
}
} catch (err) {
    if (this._fileService.hasProvider(uri)) {
        throw err;
    }
    if (await this._writeVirtual(uri, buf)) {
        return;
    }
    throw err;
}
```

`_writeVirtual`（第 349–357 行）在模型可写时调用 `setValue`，不看 `createOnly`，也不看模型里是否已有内容。
- 为什么是问题：`createOnly` 只传给了 `createFile`。创建抛错且 `hasProvider` 为假时，同一段缓冲会进虚拟写入。能解析到可写文本模型时，原有内容被替换，调用方却得到成功。有提供者时会把错误抛回去，这条缺口只留在没有提供者的分支。
- 方向：没有提供者时，`createOnly` 直接失败，不要 `setValue`。

## r07-2 中
- 症状：同一条资源权限请求在拒绝之后，`allow` / `allowAlways` 仍会授出读或写；`allowAlways` 还会把授权写进设置，之后的访问不再询问。
- 位置：`src/vs/workbench/services/agentHost/common/agentHostResourceService.ts` 第 504–534 行
- 引用：

```ts
allow: () => this._resolve(request, 'memory'),
allowAlways: () => this._resolve(request, 'persist'),
deny: () => {
    this._dropPending(request);
    deferred.error(new CancellationError());
},
```

`_resolve`（第 515–534 行）先 `_inMemoryGrants.set`，`persist` 时再 `_persistGrant`，然后 `deferred.complete()`。中间不看这条请求是否已经 `deny`。
- 为什么是问题：`deny` 只把等待中的 promise 拒绝并从队列拿掉，没有作废两个授权回调。拒绝之后再走到 `allow` 或 `allowAlways`，内存授权已经加上；后者还会把 `rw` 或 `r` 写进 `chat.agentHost.localFilePermissions`。等待方已经收到取消，后续 `check` / `read` / `write` 仍会放行。
- 方向：请求一旦拒绝或完成，`allow` 和 `allowAlways` 直接返回。

## r07-3 中
- 症状：会话编辑器的标签按创建序号存进工作区，下次启动或另一个窗口保存时，会装进别的会话，或把当前会话里未标脏的标签关掉换掉。
- 位置：`src/vs/workbench/browser/parts/editor/conversationEditorPart.ts` 第 58–61 行
- 引用：

```ts
const id = ConversationEditorPartImpl.COUNTER++;
super(
    editorPartsView,
    `workbench.parts.conversationEditor.${id}`,
```

`createConversationEditorPart` 第 272 行调用 `editorPart.create(host)`，没有关掉恢复。`EditorPart.createContentArea` 第 1132 行在 `options` 为空时把 `_willRestoreState` 设为真。该类没有覆盖 `saveState` / `loadState`。
- 为什么是问题：构造函数收到了 `sessionKey`，记忆键却是进程内递增序号，每个窗口都从 1 再计。同一工作区里两个窗口的第一块会话编辑器共用 `memento/workbench.parts.conversationEditor.1`。`onDidChangeMementoState`（`editorPart.ts` 第 1696–1702 行）在外部存储变化时 `applyState`；`doPrepareApplyState`（第 1658–1661 行）会强制关掉不需要确认的编辑器，再按对方的网格重建。重启后谁先创建，谁拿到上一轮序号 1 的标签，和会话对不上。
- 方向：会话编辑器不要按序号恢复网格；要恢复就用 `sessionKey` 做键。

## r07-4 中
- 症状：网页工作台的存储初始化失败后，默认配置档会停在初始化；其它失败则窗口继续开，但这份存储不会在关闭时写回。
- 位置：`src/vs/workbench/services/storage/browser/storageService.ts` 第 94–129 行
- 引用：

```ts
await this.applicationStorage.init();

this.updateIsNew(this.applicationStorage);

this.applicationStoragePromise.complete({ indexedDb: applicationStorageIndexedDB, storage: this.applicationStorage });
```

默认配置档的 `createProfileStorage`（第 122–129 行）一直 `await this.applicationStoragePromise.p`。`doInitialize`（第 78–83 行）用 `Promises.settled` 同时等这四路。
- 为什么是问题：`init()` 拒绝时 `complete` 不会执行，默认配置档那一路既不成功也不失败，`doInitialize` 不返回。工作区或共享库初始化拒绝时，`web.main.ts` 第 613–617 行捕获错误后仍返回这个服务，并且没有登记 `close()`。窗口继续跑，关闭时这条存储不会按成功路径写回。
- 方向：`init()` 失败时完成或拒绝 `applicationStoragePromise`；初始化失败不要把未登记关闭的服务交出去继续用。
