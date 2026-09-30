---
title: "审查 r13：platform"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "platform 层在状态文件损坏、密钥解密失败、热退出备份改名失败和同步本地备份清理时会丢掉已有数据，代理凭据第二次认证会被直接取消。"
---

# 发现

## r13-1 高
- 症状：`state` 文件能读出来但不是合法 JSON 时，下一次 `setItem` / `setItems` 会用内存里的空对象盖掉原文件，窗口状态和热退出元数据等已写入的内容丢失。
- 位置：`src/vs/platform/state/node/stateService.ts` 第 25–26 行、第 52–60 行、第 134–141 行
- 引用：
```
25|	private storage: StorageDatabase = Object.create(null);
26|	private lastSavedStorageContents = '';
52|	private async doInit(): Promise<void> {
53|		try {
54|			this.lastSavedStorageContents = (await this.fileService.readFile(this.storagePath)).value.toString();
55|			this.storage = JSON.parse(this.lastSavedStorageContents);
56|		} catch (error) {
57|			if ((<FileOperationError>error).fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
58|				this.logService.error(error);
59|			}
60|		}
134|		const serializedDatabase = JSON.stringify(this.storage, null, 4);
135|		if (serializedDatabase === this.lastSavedStorageContents) {
136|			return;
137|		}
138|
139|		// Write to disk
140|		try {
141|			await this.fileService.writeFile(this.storagePath, VSBuffer.fromString(serializedDatabase), { atomic: { postfix: '.vsctmp' } });
```
- 为什么是问题：`JSON.parse` 抛错时，第 54 行已经把损坏内容记进 `lastSavedStorageContents`，第 55 行的赋值没有发生，`storage` 仍是第 25 行的空对象。之后任意一次状态写入都会走到第 134 行，空对象序列化结果和损坏原文不同，第 141 行把原文件换成几乎为空的 JSON。启动后第一次保存窗口状态或备份工作区列表就会触发。
- 方向：解析失败时不要把原文记成“已保存内容”，也不要在内存仍为空时覆盖磁盘文件。

## r13-2 高
- 症状：读取已保存密钥时，只要解密抛错，这条密钥会从应用存储里删掉；密钥环暂时锁住或 `safeStorage` 失败后，凭据无法再读回来。
- 位置：`src/vs/platform/secrets/common/secrets.ts` 第 151–157 行
- 引用：
```
151|			} catch (e) {
152|				this._logService.error(e);
153|				const fullKey = secretStorageKey(key);
154|				this._logService.trace('[secrets] deleting invalid secret for key:', fullKey);
155|				this.removeValueFromStorage(key, fullKey, storageService);
156|				this._logService.trace('[secrets] deleted invalid secret for key:', fullKey);
157|				return undefined;
```
- 为什么是问题：`get` 把解密异常一律当成无效密文并调用 `removeValueFromStorage`。`EncryptionMainService.decrypt` 会把 `safeStorage.decryptString` 的失败原样抛出，密钥环未解锁或后端暂时不可用同样进这个 `catch`。删除是持久化的，之后密钥环恢复，`get` 也只能返回 `undefined`。
- 方向：只在密文本身无法解析时删除；密钥环或解密服务暂时失败时保留原值并向上返回错误。

## r13-3 高
- 症状：工作区或文件夹的热退出备份还在，但目标路径已经不存在，并且备份目录改名失败时，这次启动会把该备份从元数据里去掉，未保存编辑不再被恢复。
- 位置：`src/vs/platform/backup/electron-main/backupMainService.ts` 第 66 行、第 182–186 行、第 217–219 行、第 283–293 行
- 引用：
```
66|		this.storeWorkspacesMetadata();
182|					if (workspace.configPath.scheme !== Schemas.file || await Promises.exists(workspace.configPath.fsPath)) {
183|						result.push(workspaceInfo);
184|					} else {
185|						// If the workspace has backups, but the target workspace is missing, convert backups to empty ones
186|						await this.convertToEmptyWindowBackup(backupPath);
217|					} else {
218|						// If the folder has backups, but the target workspace is missing, convert backups to empty ones
219|						await this.convertToEmptyWindowBackup(backupPath);
288|		try {
289|			await Promises.rename(backupPath, newEmptyWindowBackupPath, false /* no retry */);
290|		} catch (error) {
291|			this.logService.error(`Backup: Could not rename backup folder: ${error.toString()}`);
292|			return false;
293|		}
```
- 为什么是问题：目标工作区或文件夹缺失时，校验只调用 `convertToEmptyWindowBackup`，不看它的返回值。改名失败时函数在第 292 行返回 `false`，既不把原工作区留在结果里，也不把空窗口备份放进 `emptyWindows`。`initialize` 随后在第 66 行把这份变短的列表写回状态。备份文件仍在旧目录，但之后没有任何列表再指向它。
- 方向：改名失败时保留原备份条目，不要把未完成的转换写进元数据。

## r13-4 中
- 症状：本地同步备份超过保留天数、且未过期的份数少于 10 时，清理会删掉较新的过期备份，留下更旧的那些。
- 位置：`src/vs/platform/userDataSync/common/userDataSyncLocalStoreService.ts` 第 125–131 行
- 引用：
```
125|				const all = stat.children.filter(stat => stat.isFile && /^\d{8}T\d{6}(\.json)?$/.test(stat.name)).sort();
126|				const backUpMaxAge = 1000 * 60 * 60 * 24 * (this.configurationService.getValue<number>('sync.localBackupDuration') || 30 /* Default 30 days */);
127|				let toDelete = all.filter(stat => Date.now() - this.getCreationTime(stat) > backUpMaxAge);
128|				const remaining = all.length - toDelete.length;
129|				if (remaining < 10) {
130|					toDelete = toDelete.slice(10 - remaining);
131|				}
```
- 为什么是问题：文件名是 `YYYYMMDDTHHMMSS`，默认 `sort()` 得到从旧到新的顺序，`filter` 保持这个顺序。`remaining < 10` 时 `slice(10 - remaining)` 从删除列表前面拿掉最旧的几份，真正删掉的是列表后部、也就是较新的过期备份。例如 12 份全部超过保留期时，`remaining` 为 0，`slice(10)` 删掉最新的 2 份，留下最旧的 10 份。设置同步服务启动时的 `cleanUp` 会走到这里。
- 方向：需要凑满 10 份时，从删除列表里保留较新的过期备份，只删更旧的多余份数。

## r13-5 中
- 症状：`http.proxy` 或代理环境变量里带了用户名密码，且第一次认证失败后，第二次代理登录被直接取消，不会再弹出凭据对话框。
- 位置：`src/vs/platform/native/electron-main/auth.ts` 第 86 行、第 119 行、第 163–169 行
- 引用：
```
86|		event?.preventDefault();
119|		callback?.(credentials?.username, credentials?.password);
163|		if (newHttpProxy?.indexOf('@') !== -1) {
164|			const uri = URI.parse(newHttpProxy!);
165|			const i = uri.authority.indexOf('@');
166|			if (i !== -1) {
167|				if (authInfo.attempt > 1) {
168|					this.logService.trace('auth#doResolveProxyCredentials (proxy) - exit - ignoring previously used config/envvar credentials');
169|					return undefined; // We tried already, let the user handle it.
```
- 为什么是问题：代理地址含 `@` 时，第一次用配置或环境变量里的账号。Electron 再次发出 `login` 且 `attempt > 1` 时，第 169 行直接返回，后面的已存凭据和 `showProxyCredentialsDialog` 都不会执行。第 86 行已经 `preventDefault`，第 119 行再用空的用户名和密码回调，这次认证请求被取消。用户无法在对话框里改成正确的代理密码。
- 方向：配置里的代理账号失败后，继续走已存凭据或登录对话框，不要在第二次尝试时返回空凭据。
