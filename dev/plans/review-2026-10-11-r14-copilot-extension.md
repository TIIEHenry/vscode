---
title: "审查 r14：copilot-extension"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "5 条；云端删除失败仍会删掉本地会话并丢掉云端任务映射。"
---
# 审查 r14：copilot-extension

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r14-1 高
- 症状：会话窗口删除云端副本失败后，本地 SQLite 会话已经删掉，本地到云端任务的映射也被清掉，云端会话还在，但再也没有 id 可以重试。
- 位置：`extensions/copilot/src/extension/chronicle/vscode-node/remoteSessionExporter.ts` 第 666–690 行
- 引用：

```ts
try {
    this._sessionStore.deleteSession(sessionId);
} catch {
    // Best effort
}
const wasCloudSynced = this._cloudSessions.has(sessionId);
if (cloudEnabled && wasCloudSynced) {
    const cached = this._cloudSessions.get(sessionId)!;
    try {
        await this._cloudClient.deleteSession(cached.cloudTaskId);
    } catch {
        // Best effort — don't block the caller
    }
}
this._cloudSessions.delete(sessionId);
```

- 为什么是问题：`CloudSessionApiClient.deleteSession`（同扩展 `chronicle/node/cloudSessionApiClient.ts` 第 286–300 行）失败时返回 `'error'`，不抛异常。上面的 `catch` 接不住这个返回值，返回值本身也被丢掉。本地库先删，随后 `_cloudSessions.delete` 一定会走，并经 `CloudSessionIdStore.delete` 把 `cloudSessions.json` 里的 `cloudTaskId` 写掉。命令面板那条删除（同文件第 591–616 行）会数 `cloudErrors`，但 `case 'error'` 之后同样无条件 `this._cloudSessions.delete(session.id)`；若用户选了同时删本地，本地副本也已经先删掉。
- 方向：只有云端结果是 `deleted` 或 `not_found` 时才删本地会话和映射。

## r14-2 高
- 症状：会话元数据文件只要读不出来或不是合法 JSON，下一次读取会把它覆盖成几乎只剩 `origin: 'other'` 的存根，worktree 路径和检查点引用一起没了。
- 位置：`extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts` 第 457–552 行
- 引用：

```ts
const metadata = await this.readSessionMetadataFile(sessionId);
if (metadata) {
    return metadata;
}
this._cache[sessionId] = {};
if (createMetadataFileIfNotFound) {
    await this.updateSessionMetadata(sessionId, { origin: 'other' });
}
```

```ts
} catch {
    diskFileExisted = false;
    // File doesn't exist yet — check if the directory exists.
    try {
        await this.fileSystemService.stat(dirUri);
    } catch {
        if (!createDirectoryIfNotFound) {
            this._cache[sessionId] = { ...updates, writtenToDisc: true };
            this._updateFolderIndex(sessionId, this._cache[sessionId]);
            this.updateGlobalStorage();
            return;
        }
        await this.fileSystemService.createDirectory(dirUri);
    }
}
```

```ts
const cacheExisting = diskFileExisted ? {} : (this._cache[sessionId] ?? {});
const merged: ChatSessionMetadataFile = { ...cacheExisting, ...existing };
```

```ts
const content = new TextEncoder().encode(JSON.stringify(merged, null, 2));
await this.fileSystemService.writeFile(fileUri, content);
```

- 为什么是问题：`readSessionMetadataFile` 把读失败和 `JSON.parse` 失败都当成没有文件，缓存写成 `{}`。`getWorktreeProperties`（第 247–249 行）用默认参数调用 `getSessionMetadata`，于是会再调用 `updateSessionMetadata`。后一次读取同样失败时，目录往往还在（同目录还有 `events.jsonl`），不会提前 return，于是用空缓存加上 `{ origin: 'other' }` 直接 `writeFile` 盖掉原文件。这次写入本身也是直接 `writeFile`，中途中断留下的残缺 JSON 会在下次读取时走同一条覆盖路径。
- 方向：解析失败时保留原文件，不要把读失败当成「文件不存在」再写回去。

## r14-3 高
- 症状：云同步一批事件已经从内存缓冲区取出，上传遇到瞬时错误后不会放回，这段会话事件不会再试。
- 位置：`extensions/copilot/src/extension/chronicle/vscode-node/remoteSessionExporter.ts` 第 1291–1384 行
- 引用：

```ts
const batch = this._eventBuffer.splice(0, this._getMaxEventsPerFlush());
```

```ts
} else if (result.reason === 'rate_limited') {
    requeueOnRateLimit.push(...slot.entries);
    flushFailed = true;
} else {
    hadTransientError = true;
}
```

- 为什么是问题：`submitSessionEvents` 在网络错误或非 403 的 HTTP 失败时返回 `{ ok: false, reason: 'error' }`（`cloudSessionApiClient.ts` 第 202–209 行），不抛异常。限流分支会把 `slot.entries` 放回缓冲区，外层 `catch`（第 1453–1456 行）也会把整批 `unshift` 回去；`reason === 'error'` 只把 `hadTransientError` 设为 true，事件已经 `splice` 走，不会再进入后续 flush。
- 方向：瞬时失败时把该 slot 的 entries 放回缓冲区，再按现有退避重试。

## r14-4 高
- 症状：`cloudSessions.json` 一次读失败之后被当成空映射，下一次变更会把这份空映射写回磁盘，原有的本地会话到云端任务 id 映射被盖掉。
- 位置：`extensions/copilot/src/extension/chronicle/node/cloudSessionIdStore.ts` 第 39–54 行、第 145–156 行
- 引用：

```ts
async load(): Promise<void> {
    if (this._loaded) {
        return;
    }
    this._loaded = true;
    try {
        const raw = await fsp.readFile(this._filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, CloudSessionIds>;
        for (const [key, value] of Object.entries(parsed)) {
            if (value && typeof value.cloudSessionId === 'string' && typeof value.cloudTaskId === 'string') {
                this._map.set(key, value);
            }
        }
    } catch {
        // File doesn't exist or is corrupted — start fresh
    }
}
```

```ts
await fsp.writeFile(this._filePath, JSON.stringify(data), 'utf-8');
```

- 为什么是问题：`_loaded` 在读成功之前就设成 true，瞬时读错误和解析失败都不再重试，内存 Map 保持空白。`set` / `delete` 会 `_schedulePersist`，`_persist` 用当前 Map 直接 `writeFile` 覆盖同一路径。文件其实还在、只是这次没读上来时，下一次映射变更会把完整文件写成空对象或只含新条目的对象。
- 方向：读成功后再标记已加载；解析失败不要用空 Map 回写，写入改为临时文件替换。

## r14-5 中
- 症状：工作区录制和 inline edit 日志在落盘失败后，已经从内存队列清掉的记录不会再写，重试也是空操作。
- 位置：`extensions/copilot/src/extension/workspaceRecorder/vscode-node/safeFileWriteUtils.ts` 第 93–121 行
- 引用：

```ts
private _getTextAndClear(): string {
    const text = this._newEntries.map(l => '\n' + l).join('');
    this._newEntries.length = 0;
    return text;
}

async flushAsync(): Promise<void> {
    if (this._newEntries.length === 0) { return; }

    if (this._lock) { throw new BugIndicatingError('Locked!'); }
    this._lock = true;
    try {
        const text = this._getTextAndClear();
        if (text === '') { return; }

        await appendFile(this.filePath, text, { encoding: 'utf8' });
    } finally {
        this._lock = false;
    }
}
```

- 为什么是问题：`flushAsync` 和 `flushSync` 都先清空 `_newEntries` 再 `appendFile`。`appendFile` 抛错后条目已经不在队列里，再次 `flushAsync` 看到长度为 0 直接返回。`WorkspaceRecorderImpl._scheduleFlush`（`workspaceRecorder.ts` 第 287–295 行）和 `LogContextRecorderImpl._scheduleFlush`（`logContextRecorder.ts` 第 177–185 行）都直接调用这次 flush，没有把失败的文本放回去。录制内容包含文档正文（`setContent`）。
- 方向：追加成功后再清空队列；失败时把这次文本放回 `_newEntries`。
