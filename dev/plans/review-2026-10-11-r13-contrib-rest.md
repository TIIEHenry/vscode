---
title: "审查 r13：contrib-rest"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "5 条；同一配置目标下后启动的 MCP 沙箱会带上此前各服务器的工作目录写权限。"
---
# 审查 r13：contrib-rest

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r13-1 高

- 症状：后启动的沙箱 MCP 服务器拿到此前其它服务器工作目录的写权限，同一配置目标还共用一份会被覆盖的沙箱设置文件。
- 位置：`src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts` 第 385–397 行，第 401–407 行，第 430–437 行
- 引用：

```385:397:src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts
	private async _updateSandboxConfig(tempDir: URI, configTarget: ConfigurationTarget, sandboxConfig?: IMcpSandboxConfiguration, launchCwd?: string): Promise<string> {
		const normalizedSandboxConfig = this._withDefaultSandboxConfig(sandboxConfig, launchCwd);
		let configFileUri: URI;
		const configTargetKey = ConfigurationTargetToString(configTarget);
		if (this._sandboxConfigPerConfigurationTarget.has(configTargetKey)) {
			configFileUri = URI.parse(this._sandboxConfigPerConfigurationTarget.get(configTargetKey)!);
		} else {
			configFileUri = URI.joinPath(tempDir, `vscode-${configTargetKey}-mcp-sandbox-settings-${this._sandboxSettingsId}.json`);
			this._sandboxConfigPerConfigurationTarget.set(configTargetKey, configFileUri.toString());
		}
		await this._fileService.createFile(configFileUri, VSBuffer.fromString(JSON.stringify(normalizedSandboxConfig, null, '\t')), { overwrite: true });
		return configFileUri.path;
	}
```

```401:407:src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts
	private _withDefaultSandboxConfig(sandboxConfig?: IMcpSandboxConfiguration, launchCwd?: string): IMcpSandboxConfiguration {
		const mergedAllowWrite = new Set(sandboxConfig?.filesystem?.allowWrite ?? []);
		for (const defaultAllowWrite of this._getDefaultAllowWrite(launchCwd ? [launchCwd] : undefined)) {
			if (defaultAllowWrite) {
				mergedAllowWrite.add(defaultAllowWrite);
			}
		}
```

```430:437:src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts
	private _getDefaultAllowWrite(directories?: string[]): readonly string[] {
		for (const launchCwd of directories ?? []) {
			const trimmed = launchCwd.trim();
			if (trimmed) {
				this._defaultAllowWritePaths.push(trimmed);
			}
		}
		return this._defaultAllowWritePaths;
	}
```

- 为什么是问题：`_defaultAllowWritePaths` 在第 85 行以 `['~/.npm']` 起步，`_getDefaultAllowWrite` 把每次的 `launchCwd` 再推进这个进程级数组。`_withDefaultSandboxConfig` 把整个数组合并进 `filesystem.allowWrite`。设置文件按配置目标只保留一份，并用 `overwrite: true` 重写。同一用户级或同一工作区目标里，后启动的沙箱进程因此可以写前面每个服务器的工作目录，超出该服务器自己的 `sandbox.filesystem.allowWrite`。
- 方向：每次启动用本次工作目录和该服务器自己的 allowWrite 写独立设置文件，不要把历史工作目录留在默认列表里。

## r13-2 高

- 症状：MCP 输入密钥解析失败后被换成新密钥，已加密的输入秘密无法再解开，下一次保存还会把密文从存储里清掉。
- 位置：`src/vs/workbench/contrib/mcp/common/mcpRegistryInputStorage.ts` 第 37–58 行，以及第 174–179 行
- 引用：

```37:58:src/vs/workbench/contrib/mcp/common/mcpRegistryInputStorage.ts
	private readonly _getEncryptionKey = new Lazy(() => {
		return McpRegistryInputStorage.secretSequencer.queue(async () => {
			const existing = await this._secretStorageService.get(MCP_ENCRYPTION_KEY_NAME);
			if (existing) {
				try {
					const parsed: JsonWebKey = JSON.parse(existing);
					return await crypto.subtle.importKey('jwk', parsed, MCP_ENCRYPTION_KEY_ALGORITHM, false, ['encrypt', 'decrypt']);
				} catch {
					// fall through
				}
			}

			const key = await crypto.subtle.generateKey(
				{ name: MCP_ENCRYPTION_KEY_ALGORITHM, length: MCP_ENCRYPTION_KEY_LEN },
				true,
				['encrypt', 'decrypt'],
			);

			const exported = await crypto.subtle.exportKey('jwk', key);
			await this._secretStorageService.set(MCP_ENCRYPTION_KEY_NAME, JSON.stringify(exported));
			return key;
		});
	});
```

```174:179:src/vs/workbench/contrib/mcp/common/mcpRegistryInputStorage.ts
		} catch (e) {
			this._logService.warn('Error unsealing MCP secrets', e);
			this._record.value.secrets = undefined;
		}

		return {};
```

- 为什么是问题：已有密钥只要 JSON 解析或 `importKey` 失败，就会生成新密钥并写回同一个 `mcpEncryptionKey`。旧密文从此解不开。`_unsealSecrets` 接着把内存里的 `secrets` 置成 `undefined` 并返回空映射。之后 `setPlainText`、`setSecrets` 或 `clear` 把 `_didChange` 设为真，`onWillSaveState`（第 78–86 行）会把这份没有密文的记录写回 `mcpInputs`。
- 方向：导入失败时保留原密钥和原密文，不要换钥，也不要把 `secrets` 置空后参与下一次保存。

## r13-3 高

- 症状：内联聊天读不到修改前内容时，把非新建文件的拒绝基线记成空字符串，拒绝审查会把文件内容恢复成空。
- 位置：`src/vs/workbench/contrib/inlineChat/browser/inlineChatEditReviewSession.ts` 第 237–250 行，第 270–280 行
- 引用：

```237:250:src/vs/workbench/contrib/inlineChat/browser/inlineChatEditReviewSession.ts
	private async _createExternalEditEntry(edit: IChatExternalEdit, telemetryInfo: IModifiedEntryTelemetryInfo): Promise<void> {
		let initialContent = this._initialContents.get(edit.uri);
		if (initialContent === undefined) {
			initialContent = await this._readBeforeContent(edit);
			if (this._store.isDisposed) {
				return;
			}
			this._initialContents.set(edit.uri, initialContent);
		}

		// A created file must be tracked as such: rejecting it deletes the file, whereas a
		// `Modified` entry would only restore empty content and leave the file behind.
		const editKind = edit.editKind === 'create' ? ChatEditKind.Created : ChatEditKind.Modified;
		await this._getOrCreateEntry(edit.uri, telemetryInfo, initialContent, true, editKind);
```

```270:280:src/vs/workbench/contrib/inlineChat/browser/inlineChatEditReviewSession.ts
	private async _readBeforeContent(edit: IChatExternalEdit): Promise<string> {
		if (!edit.beforeContentUri) {
			return '';
		}

		try {
			return (await this._fileService.readFile(edit.beforeContentUri)).value.toString();
		} catch (error) {
			this._logService.warn(`Failed to read pre-edit content for ${edit.uri}.`, error);
			return '';
		}
	}
```

- 为什么是问题：同函数注释写明，`Modified` 条目按 `initialContent` 恢复，空内容会把文件恢复成空文件并留在磁盘上。没有 `beforeContentUri`，或读取抛错时，`_readBeforeContent` 都返回 `''`。非 `create` 的外部编辑仍以 `ChatEditKind.Modified` 和这份空基线建条目。用户拒绝这次审查时，原文件内容被写成空。
- 方向：读不到修改前内容时不要建立可拒绝的 Modified 条目，让这次外部编辑失败并保持原文件。

## r13-4 高

- 症状：云端编辑会话删除失败仍记为恢复成功；文件若已回到工作区且不在当前变更列表里，下次自动恢复会再次删除它，且不确认。
- 位置：`src/vs/workbench/contrib/editSessions/browser/editSessionsStorageService.ts` 第 172–183 行
- 引用：

```172:183:src/vs/workbench/contrib/editSessions/browser/editSessionsStorageService.ts
	async delete(resource: SyncResource, ref: string | null) {
		await this.initialize('write', false);
		if (!this.initialized) {
			throw new Error(`Unable to delete edit session with ref ${ref}.`);
		}

		try {
			await this.storeClient?.deleteResource(resource, ref);
		} catch (ex) {
			this.logService.error(ex);
		}
	}
```

```561:575:src/vs/workbench/contrib/editSessions/browser/editSessions.contribution.ts
			for (const { uri, type, contents } of changes) {
				if (type === ChangeType.Addition) {
					await this.fileService.writeFile(uri, decodeEditSessionFileContent(editSession.version, contents!));
				} else if (type === ChangeType.Deletion && await this.fileService.exists(uri)) {
					await this.fileService.del(uri);
				}
			}

			await this.workspaceStateSynchronizer?.apply();

			this.logService.info(`Deleting edit session with ref ${ref} after successfully applying it to current workspace...`);
			await this.editSessionsStorageService.delete('editSessions', ref);
			this.logService.info(`Deleted edit session with ref ${ref}.`);

			this.telemetryService.publicLog2<ResumeEvent, ResumeClassification>('editSessions.resume.outcome', { hashedId: hashedEditSessionId(ref), outcome: 'resumeSucceeded' });
```

- 为什么是问题：`delete` 吞掉删除错误后正常返回。调用方仍写「Deleted」并上报 `resumeSucceeded`。已登录且开启自动恢复时，`autoResumeEditSession` 会再次调用 `resumeEditSession(undefined, true, ...)`（第 198–203 行）。`willChangeLocalContents` 在目标不在当前 SCM 变更集时直接返回 false（第 662–665 行），删除不会进入覆盖确认。文件若又存在于磁盘上，第 564–565 行会再次 `del`。
- 方向：删除失败要抛出并让这次恢复失败，未删除成功的会话不要在下次启动时再套用删除。

## r13-5 中

- 症状：Linux 上把密码存储从 gnome / gnome-keyring 迁到 gnome-libsecret 时，迁移标记在写入完成前就落盘，失败后不再重试。
- 位置：`src/vs/workbench/contrib/encryption/electron-browser/encryption.contribution.ts` 第 32–45 行
- 引用：

```32:45:src/vs/workbench/contrib/encryption/electron-browser/encryption.contribution.ts
	private async migrateToGnomeLibsecret(): Promise<void> {
		if (!isLinux || this.storageService.getBoolean('encryption.migratedToGnomeLibsecret', StorageScope.APPLICATION, false)) {
			return;
		}
		try {
			const content = await this.fileService.readFile(this.environmentService.argvResource);
			const argv = parse<{ 'password-store'?: string }>(content.value.toString());
			if (argv['password-store'] === 'gnome' || argv['password-store'] === 'gnome-keyring') {
				this.jsonEditingService.write(this.environmentService.argvResource, [{ path: ['password-store'], value: 'gnome-libsecret' }], true);
			}
			this.storageService.store('encryption.migratedToGnomeLibsecret', true, StorageScope.APPLICATION, StorageTarget.USER);
		} catch (error) {
			console.error(error);
		}
	}
```

- 为什么是问题：需要迁移时，`jsonEditingService.write` 没有等待结束，下一行就把 `encryption.migratedToGnomeLibsecret` 存成 true。函数开头读到该标记就直接返回。argv 里的 `password-store` 可以仍是 `gnome` 或 `gnome-keyring`。
- 方向：等 argv 写入成功后再写迁移标记，写入失败则不要标记完成。
