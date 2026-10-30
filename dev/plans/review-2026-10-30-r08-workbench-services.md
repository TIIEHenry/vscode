---
title: "十六路审查 r08：workbench services 发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样审查 workbench/services 的配置写入、扩展存储、授权名单与远程配置文件关联，证实 5 条。"
---
# 十六路审查 r08：workbench services 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。


抽样范围是 `src/vs/workbench/services` 下的配置 JSON 写入、扩展存储迁移、账号授权名单、Agent Host 路径规范化，以及远程用户配置文件关联。下面 5 条都来自本次读到的实现。

### r08-1

**严重度：** 高

**症状：** 用空 `path` 替换整个 JSON 文件时，新文本比原文短，文件尾部会留下旧内容，写出损坏的 JSON。

**代码：**

```89:104:src/vs/workbench/services/configuration/common/jsonEditingService.ts
	private getEdits(model: ITextModel, configurationValue: IJSONValue): Edit[] {
		const { tabSize, insertSpaces } = model.getOptions();
		const eol = model.getEOL();
		const { path, value } = configurationValue;

		// With empty path the entire file is being replaced, so we just use JSON.stringify
		if (!path.length) {
			const content = JSON.stringify(value, null, insertSpaces ? ' '.repeat(tabSize) : '\t');
			return [{
				content,
				length: content.length,
				offset: 0
			}];
		}
```

```76:84:src/vs/workbench/services/configuration/common/jsonEditingService.ts
	private applyEditsToBuffer(edit: Edit, model: ITextModel): boolean {
		const startPosition = model.getPositionAt(edit.offset);
		const endPosition = model.getPositionAt(edit.offset + edit.length);
		const range = new Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endPosition.column);
		const currentText = model.getValueInRange(range);
		if (edit.content !== currentText) {
			const editOperation = currentText ? EditOperation.replace(range, edit.content) : EditOperation.insert(startPosition, edit.content);
			model.pushEditOperations([new Selection(startPosition.lineNumber, startPosition.column, startPosition.lineNumber, startPosition.column)], [editOperation], () => []);
```

同仓库里整文件替换用的是原文长度：

```249:254:src/vs/workbench/services/configuration/common/configurationEditing.ts
		// Without jsonPath, the entire configuration file is being replaced, so we just use JSON.stringify
		const content = JSON.stringify(value, null, formattingOptions.insertSpaces && formattingOptions.tabSize ? ' '.repeat(formattingOptions.tabSize) : '\t');
		return [{
			content,
			length: modelContent.length,
			offset: 0
		}];
```

**为什么是问题：** `applyEditsToBuffer` 把 `offset + length` 当作被替换区间的结尾。空 `path` 分支把 `length` 设成新字符串的长度。新文本更短时，区间覆盖不到文件末尾，尾部旧字节留在新 JSON 后面。

**方向：** 空 `path` 的替换长度用当前模型的全文长度。

### r08-2

**严重度：** 中

**症状：** 在设置编辑器里定位一个尚未写入文件的设置时，默认值会立刻保存到磁盘；这个文件里其它未保存的修改也会一起落盘。

**代码：**

```31:36:src/vs/workbench/services/configuration/common/jsonEditing.ts
export interface IJSONEditingService {

	readonly _serviceBrand: undefined;

	write(resource: URI, values: IJSONValue[], save: boolean): Promise<void>;
}
```

```39:41:src/vs/workbench/services/configuration/common/jsonEditingService.ts
	write(resource: URI, values: IJSONValue[]): Promise<void> {
		return Promise.resolve(this.queue.queue(() => this.doWriteConfiguration(resource, values))); // queue up writes to prevent race conditions
	}
```

```66:68:src/vs/workbench/services/configuration/common/jsonEditingService.ts
			if (hasEdits) {
				return this.textFileService.save(model.uri);
			}
```

```121:131:src/vs/workbench/services/configuration/common/jsonEditingService.ts
	private async resolveAndValidate(resource: URI, checkDirty: boolean): Promise<IReference<IResolvedTextEditorModel>> {
		const reference = await this.resolveModelReference(resource);

		const model = reference.object.textEditorModel;

		if (this.hasParseErrors(model)) {
			reference.dispose();
			return this.reject<IReference<IResolvedTextEditorModel>>(JSONEditingErrorCode.ERROR_INVALID_FILE);
		}

		return reference;
	}
```

```674:680:src/vs/workbench/services/preferences/browser/preferencesService.ts
		if (!setting && edit) {
			let defaultValue = (type === 'object' || type === 'array') ? this.configurationService.inspect(settingKey).defaultValue : getDefaultValue(type);
			defaultValue = defaultValue === undefined && isOverrideProperty ? {} : defaultValue;
			if (defaultValue !== undefined) {
				const key = settingsModel instanceof WorkspaceConfigurationEditorModel ? ['settings', settingKey] : [settingKey];
				await this.jsonEditingService.write(settingsModel.uri!, [{ path: key, value: defaultValue }], false);
				setting = settingsModel.getPreference(settingKey);
```

**为什么是问题：** 接口的第三个参数是 `save`。实现没有这个参数，只要缓冲发生了编辑就调用 `textFileService.save`。设置编辑器在设置还不存在、只是要把默认值放进模型里供光标进入时传入 `false`。`resolveAndValidate` 收到 `checkDirty === true`，函数体不读取它，脏文件上的其它未保存编辑会随这次保存写盘。

**方向：** 实现按 `save` 决定是否保存，并在要求检查时拒绝仍为脏的文件。

### r08-3

**严重度：** 高

**症状：** 扩展存储从旧 id 迁到新 id 时，文件移动失败后源 state 已经清掉，并且被记成迁移完成，下次不再搬运那批文件。

**代码：**

```51:70:src/vs/workbench/services/extensions/common/extensionStorageMigration.ts
			const value = extensionStorageService.getExtensionState(fromExtensionId, global);
			if (value) {
				extensionStorageService.setExtensionState(toExtensionId, value, global);
				extensionStorageService.setExtensionState(fromExtensionId, undefined, global);
			}

			// Migrate stored files
			const fromPath = getExtensionStorageLocation(fromExtensionId, global);
			const toPath = getExtensionStorageLocation(toExtensionId, global);
			if (!uriIdentityService.extUri.isEqual(fromPath, toPath)) {
				try {
					await fileService.move(fromPath, toPath, true);
				} catch (error) {
					if ((<FileSystemProviderError>error).code !== FileSystemProviderErrorCode.FileNotFound) {
						logService.info(`Error while migrating ${global ? 'global' : 'workspace'} file storage from '${fromExtensionId}' to '${toExtensionId}'`, getErrorMessage(error));
					}
				}
			}
			logService.info(`Migrated ${global ? 'global' : 'workspace'} extension storage from ${fromExtensionId} to ${toExtensionId}`);
			storageService.store(storageMigratedKey, true, storageScope, StorageTarget.MACHINE);
```

**为什么是问题：** 源 state 在 `move` 之前就被写成 `undefined`。`move` 抛错时只记一条 info，随后无条件把 `extensionStorage.migrate...` 写成 `true`。文件留在旧目录，新 id 下看不到，重试条件也不再成立。

**方向：** `move` 失败时不要写下迁移完成标记，并保留源 state，直到文件迁移成功。

### r08-4

**严重度：** 高

**症状：** 两对不同的认证提供方和账号，只要拼出来的存储键相同，就共用一份扩展授权名单。一份名单上的允许或拒绝会作用到另一对身份。MCP 服务器授权用同样的拼法。

**代码：**

```61:69:src/vs/workbench/services/authentication/browser/authenticationAccessService.ts
		const allowList = this.readAllowedExtensions(providerId, accountName);
		const extensionData = allowList.find(extension => extension.id === extensionKey);
		if (!extensionData) {
			return undefined;
		}
		// This property didn't exist on this data previously, inclusion in the list at all indicates allowance
		return extensionData.allowed !== undefined
			? extensionData.allowed
			: true;
```

```72:78:src/vs/workbench/services/authentication/browser/authenticationAccessService.ts
	readAllowedExtensions(providerId: string, accountName: string): AllowedExtension[] {
		let trustedExtensions: AllowedExtension[] = [];
		try {
			const trustedExtensionSrc = this._storageService.get(`${providerId}-${accountName}`, StorageScope.APPLICATION);
			if (trustedExtensionSrc) {
				trustedExtensions = JSON.parse(trustedExtensionSrc);
			}
```

```132:134:src/vs/workbench/services/authentication/browser/authenticationAccessService.ts
		// Filter out trusted extensions before storing - they should only come from product.json, not user storage
		const userManagedExtensions = allowList.filter(extension => !extension.trusted);
		this._storageService.store(`${providerId}-${accountName}`, JSON.stringify(userManagedExtensions), StorageScope.APPLICATION, StorageTarget.USER);
```

```148:150:src/vs/workbench/services/authentication/browser/authenticationMcpAccessService.ts
			const trustedMCPServerSrc = this._storageService.get(`mcpserver-${providerId}-${accountName}`, StorageScope.APPLICATION);
			if (trustedMCPServerSrc) {
				trustedMCPServers = JSON.parse(trustedMCPServerSrc);
```

**为什么是问题：** 键是 `providerId` 与 `accountName` 用 `-` 直接拼接，两边都没有转义。`isAccessAllowed` 只根据这份名单返回是否放行。`providerId = "a"`、`accountName = "b-c"` 与 `providerId = "a-b"`、`accountName = "c"` 得到同一个键 `a-b-c`，读写的是同一份允许或拒绝记录。MCP 的键 `mcpserver-${providerId}-${accountName}` 同样可以撞车。

**方向：** 存储键使用不会出现在两段内容里的分隔，或对两段分别编码。

### r08-5

**严重度：** 中

**症状：** 为当前窗口以外的本地配置文件创建远程配置文件时，关联列表记下的是当前配置文件的 id。之后按这份列表做的改名和孤立远程配置文件清理都找不到新建的那个。

**代码：**

```134:141:src/vs/workbench/services/userDataProfile/common/remoteUserDataProfiles.ts
	async getRemoteProfile(localProfile: IUserDataProfile): Promise<IUserDataProfile> {
		await this.whenInitialized();

		if (!this.remoteUserDataProfilesService) {
			throw new ErrorNoTelemetry('Remote profiles service not available in the current window');
		}

		return this.getAssociatedRemoteProfile(localProfile, this.remoteUserDataProfilesService);
	}
```

```150:157:src/vs/workbench/services/userDataProfile/common/remoteUserDataProfiles.ts
		let profile = remoteUserDataProfilesService.profiles.find(p => p.id === localProfile.id);
		if (!profile) {
			profile = await remoteUserDataProfilesService.createProfile(localProfile.id, localProfile.name, {
				transient: localProfile.isTransient,
				useDefaultFlags: localProfile.useDefaultFlags,
			});
			this.setAssociatedRemoteProfiles([...this.getAssociatedRemoteProfiles(), this.userDataProfileService.currentProfile.id]);
		}
```

```198:216:src/vs/workbench/services/userDataProfile/common/remoteUserDataProfiles.ts
	private async cleanUp(): Promise<void> {
		const associatedRemoteProfiles: string[] = [];
		for (const profileId of this.getAssociatedRemoteProfiles()) {
			const remoteProfile = this.remoteUserDataProfilesService?.profiles.find(p => p.id === profileId);
			if (!remoteProfile) {
				continue;
			}
			const localProfile = this.userDataProfilesService.profiles.find(p => p.id === profileId);
			if (localProfile) {
				if (localProfile.name !== remoteProfile.name) {
					await this.remoteUserDataProfilesService?.updateProfile(remoteProfile, { name: localProfile.name });
				}
				associatedRemoteProfiles.push(profileId);
				continue;
			}
			if (remoteProfile) {
				// Cleanup remote profiles those are not available locally
				await this.remoteUserDataProfilesService?.removeProfile(remoteProfile);
			}
		}
```

**为什么是问题：** `createProfile` 使用的是 `localProfile.id`。紧接着写入关联列表的是 `currentProfile.id`。`getRemoteProfile` 可以传入另一个本地配置文件。`cleanUp` 只遍历关联列表里的 id 做名称同步，以及删除本地已经不存在的远程配置文件。新建配置文件的 id 不在列表里时，这两件事都不会发生在它身上。

**方向：** 关联列表写入刚创建的 `profile.id`。

## 实际打开的文件

- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/configuration/common/jsonEditingService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/configuration/common/jsonEditing.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/configuration/common/configurationEditing.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/preferences/browser/preferencesService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/extensions/common/extensionStorageMigration.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/authentication/browser/authenticationAccessService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/authentication/browser/authenticationMcpAccessService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/userDataProfile/common/remoteUserDataProfiles.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/agentHost/common/agentHostResourceService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/secrets/browser/secretStorageService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/storage/browser/storageService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/textfile/browser/textFileService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/workingCopy/common/storedFileWorkingCopy.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/workspaces/common/workspaceTrust.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/authentication/browser/dynamicAuthenticationProviderStorageService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/userDataSync/browser/userDataSyncInit.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/services/filesConfiguration/common/filesConfigurationService.ts`
