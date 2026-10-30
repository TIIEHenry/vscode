---
title: "十六路审查 r05：platform 其余发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样 platform 下除 agentHost、universeAgent 外的存储、密钥、文件、配置、IPC、权限与销毁，记录 5 条可证实问题。"
---

# 十六路审查 r05：platform 其余发现
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围是 `src/vs/platform` 中除 `agentHost`、`universeAgent` 以外的子目录。抽样了存储、密钥、文件、配置、IPC、权限和销毁。下面 5 条都来自这次打开的源码。

### r05-1

- 严重度：高
- 症状：macOS 上以 `~/` 书写的沙箱允许路径和拒绝路径按字面量参与匹配。家目录下本应放行的读取匹配不到；写在工作区允许范围内的 `~/` 拒绝写也匹配不到，写检查仍会放行。

```971:974:src/vs/platform/sandbox/common/terminalSandboxEngine.ts
	private async _resolveFileSystemPath(path: string): Promise<string[]> {
		const expandedPath = this._os === OperatingSystem.Linux ? this._expandHomePath(path) : path;
		if (!this._isAbsoluteFileSystemPath(expandedPath)) {
			return [expandedPath];
```

```1021:1031:src/vs/platform/sandbox/common/terminalSandboxEngine.ts
	private _expandHomePath(path: string): string {
		const userHome = this._userHome?.path;
		if (!userHome) {
			return path;
		}
		if (path === '~') {
			return userHome;
		}
		if (path.startsWith('~/')) {
			return this._pathJoin(userHome, path.slice(2));
		}
		return path;
```

```329:336:src/vs/platform/sandbox/common/terminalSandboxReadAllowList.ts
		case TerminalSandboxReadAllowListOperation.Ssh:
			switch (os) {
				case OperatingSystem.Macintosh:
				case OperatingSystem.Linux:
				default:
					return [
						'~/.ssh',
					];
```

```681:685:src/vs/platform/sandbox/common/terminalSandboxEngine.ts
		} else if (this._os === OperatingSystem.Macintosh) {
			allowWritePaths = (await this._resolveFileSystemPaths(await this._updateAllowWritePathsWithWorkspaceFolders(macFileSystemSetting.allowWrite, commandRuntimeAllowWritePaths))).filter(path => path !== configFilePath);
			allowReadPaths = await this._resolveFileSystemPaths(await this._updateAllowReadPathsWithAllowWrite(macFileSystemSetting.allowRead, allowWritePaths, commandRuntimeAllowReadPaths));
			denyReadPaths = await this._resolveFileSystemPaths(this._updateDenyReadPathsWithHome([...(macFileSystemSetting.denyRead ?? []), configFilePath]));
			denyWritePaths = macFileSystemSetting.denyWrite ? await this._resolveFileSystemPaths(macFileSystemSetting.denyWrite) : undefined;
```

```765:774:src/vs/platform/sandbox/common/terminalSandboxEngine.ts
	private async _hasFileSystemAccess(permission: TerminalSandboxFileAccessPermission, path: string, accessPaths: ITerminalSandboxFileSystemAccessPaths): Promise<boolean> {
		const resolvedPaths = await this._resolveFileSystemPath(path);
		if (permission === 'write') {
			if (this._os === OperatingSystem.Windows && this._matchesAnyFileSystemPath(resolvedPaths, accessPaths.denyReadPaths)) {
				return false;
			}
			if (this._matchesAnyFileSystemPath(resolvedPaths, accessPaths.denyWritePaths ?? [])) {
				return false;
			}
			return this._matchesAnyFileSystemPath(resolvedPaths, accessPaths.allowWritePaths);
```

- 为什么是问题：macOS 与 Linux 共用 `~/` 允许表，家目录拒绝读用的是已经展开的绝对路径。`~/` 在 macOS 上不是绝对路径，解析时直接返回字面量，既写入沙箱配置，也用于 `checkFileAccess`。允许项对不上真实路径，落在家目录拒绝范围内的读取仍然被拒绝。拒绝写若写成 `~/...`，又落在以绝对路径放行的工作区下面，拒绝匹配失败后写检查按 `allowWrite` 放行。
- 方向：macOS 解析文件系统规则时同样调用 `_expandHomePath`。

### r05-2

- 严重度：高
- 症状：沙箱运行时信息第一次解析失败，或与另一次调用重叠时，后续调用把未完成的初始化当成已完成。家目录可以不进入拒绝读列表，命令包装也会因可执行路径仍为空而失败，并且不会再解析。

```619:628:src/vs/platform/sandbox/common/terminalSandboxEngine.ts
	private async _resolveRuntimeInfo(): Promise<void> {
		if (this._runtimeResolved) {
			return;
		}
		this._runtimeResolved = true;
		const runtimeInfo = await this._host.getRuntimeInfo();
		this._appRoot = runtimeInfo.appRoot;
		this._execPath = runtimeInfo.execPath;
		this._runAsNode = runtimeInfo.runAsNode ?? false;
		this._userHome = await this._host.getUserHome();
```

```940:946:src/vs/platform/sandbox/common/terminalSandboxEngine.ts
	private _updateDenyReadPathsWithHome(configuredDenyRead: string[] | undefined): string[] {
		// TODO: On Windows, deny read on home directory.
		if (this._os === OperatingSystem.Windows) {
			return [...new Set(configuredDenyRead ?? [])];
		}
		const userHome = this._userHome ? this._getUriPath(this._userHome) : undefined;
		return [...new Set([...(configuredDenyRead ?? []), ...(userHome ? [userHome] : [])])];
	}
```

```282:284:src/vs/platform/sandbox/common/terminalSandboxEngine.ts
		if (!this._execPath) {
			throw new Error('Executable path not set to run sandbox commands');
		}
```

- 为什么是问题：标记在 `await` 之前就写成完成，失败时没有清掉，重叠的调用看到标记后直接返回。此时 `_userHome` 仍为空，家目录不会加入拒绝读，`checkFileAccess` 对家目录读取返回允许。`_execPath` 仍为空时 `wrapCommand` 抛错，下一次调用也不会再向宿主要运行时信息。
- 方向：共享同一次初始化 promise，失败时清掉标记，让调用方等待这一次完成或在下一次重试。

### r05-3

- 严重度：中
- 症状：本地转发端口在探测之后、`listen` 之前被占用时，隧道创建停住，注释里的端口 0 重试不会执行。

```67:69:src/vs/platform/tunnel/node/tunnelService.ts
		// If there is no error listener and there is an error it will crash the whole window
		this._errorListener = () => { };
		this._server.on('error', this._errorListener);
```

```95:105:src/vs/platform/tunnel/node/tunnelService.ts
		this._server.listen(localPort, this.defaultTunnelHost);
		await this._barrier.wait();
		address = <net.AddressInfo>this._server.address();

		// It is possible for findFreePortFaster to return a port that there is already a server listening on. This causes the previous listen call to error out.
		if (!address) {
			localPort = 0;
			this._server.listen(localPort, this.defaultTunnelHost);
			await this._barrier.wait();
			address = <net.AddressInfo>this._server.address();
		}
```

```61:61:src/vs/platform/tunnel/node/tunnelService.ts
		this._listeningListener = () => this._barrier.open();
```

- 为什么是问题：`listen` 失败时发出 `error`，不发出 `listening`。错误回调是空的，barrier 只在 `listening` 时打开。`waitForReady` 停在第一次 `await this._barrier.wait()`，后面根据 `address` 为空改听端口 0 的分支到不了。
- 方向：在 `error` 上结束等待并改听端口 0，让失败也能离开 barrier。

### r05-4

- 严重度：中
- 症状：共享进程隧道在 `startTunnel` 把对象放进表之前收到 `setAddress` 时，地址被丢掉。之后连接一直等这个地址。

```69:77:src/vs/platform/tunnel/node/sharedProcessTunnelService.ts
	async createTunnel(): Promise<{ id: string }> {
		const id = String(++SharedProcessTunnelService._lastId);
		return { id };
	}

	async startTunnel(authority: string, id: string, tunnelRemoteHost: string, tunnelRemotePort: number, tunnelLocalHost: string, tunnelLocalPort: number | undefined, elevateIfNeeded: boolean | undefined): Promise<ISharedProcessTunnel> {
		const tunnelData = new TunnelData();

		const tunnel = await Promise.resolve(this._tunnelService.openTunnel(authority, tunnelData, tunnelRemoteHost, tunnelRemotePort, tunnelLocalHost, tunnelLocalPort, elevateIfNeeded));
```

```91:92:src/vs/platform/tunnel/node/sharedProcessTunnelService.ts
		tunnelData.setTunnel(tunnel);
		this._tunnels.set(id, tunnelData);
```

```25:33:src/vs/platform/tunnel/node/sharedProcessTunnelService.ts
	async getAddress(): Promise<IAddress> {
		if (this._address) {
			return this._address;
		}
		if (!this._addressPromise) {
			this._addressPromise = new DeferredPromise<IAddress>();
		}
		return this._addressPromise.p;
	}
```

```102:107:src/vs/platform/tunnel/node/sharedProcessTunnelService.ts
	async setAddress(id: string, address: IAddress): Promise<void> {
		const tunnel = this._tunnels.get(id);
		if (!tunnel) {
			return;
		}
		tunnel.setAddress(address);
	}
```

- 为什么是问题：`createTunnel` 先把 id 交给调用方，`TunnelData` 要等 `openTunnel` 返回后才进入 `_tunnels`。这段时间里的 `setAddress` 发现表中没有该 id 就返回。连接转发时 `getAddress` 仍在等地址；解析结果若没有下一次回调，转发停在这里。`destroyTunnel` 会记下尚未入表的 id，`setAddress` 没有对应的暂存。
- 方向：创建 id 时就把 `TunnelData` 放进表，让 `setAddress` 在 `startTunnel` 完成前生效。

### r05-5

- 严重度：低
- 症状：spdlog 加载或创建失败后，日志继续进内存数组，不再落盘，也不会再尝试创建。

```33:36:src/vs/platform/log/node/spdlogLog.ts
	} catch (e) {
		console.error(e);
	}
	return null;
```

```91:110:src/vs/platform/log/node/spdlogLog.ts
	private async _createSpdLogLogger(name: string, filepath: string, rotating: boolean, donotUseFormatters: boolean): Promise<void> {
		const filecount = rotating ? 6 : 1;
		const filesize = (30 / filecount) * ByteSize.MB;
		const logger = await createSpdLogLogger(name, filepath, filesize, filecount, donotUseFormatters);
		if (logger) {
			this._logger = logger;
			setLogLevel(this._logger, this.getLevel());
			for (const { level, message } of this.buffer) {
				log(this._logger, level, message);
			}
			this.buffer = [];
		}
	}

	protected log(level: LogLevel, message: string): void {
		if (this._logger) {
			log(this._logger, level, message);
		} else if (this.getLevel() <= level) {
			this.buffer.push({ level, message });
		}
	}
```

- 为什么是问题：创建函数失败时返回 `null`，不抛错。只有拿到 logger 才清空 `buffer`。此后 `_logger` 一直是空，`log()` 仍往数组里追加。创建 promise 在构造时赋值一次，失败后没有下一次创建。
- 方向：创建失败后停止追加缓冲，并允许下一次再创建 logger。

## 实际打开的文件

- `src/vs/platform/sandbox/common/terminalSandboxEngine.ts`
- `src/vs/platform/sandbox/common/terminalSandboxReadAllowList.ts`
- `src/vs/platform/sandbox/common/terminalSandboxMxcRuntime.ts`
- `src/vs/platform/sandbox/common/terminalSandboxCommandRules.ts`
- `src/vs/platform/sandbox/common/terminalSandboxRuntimeConfigurationPerOperation.ts`
- `src/vs/platform/sandbox/common/terminalSandboxService.ts`
- `src/vs/platform/sandbox/common/settings.ts`
- `src/vs/platform/networkFilter/common/domainMatcher.ts`
- `src/vs/platform/secrets/common/secrets.ts`
- `src/vs/platform/encryption/electron-main/encryptionMainService.ts`
- `src/vs/platform/storage/common/storage.ts`
- `src/vs/platform/storage/electron-main/storageMain.ts`
- `src/vs/platform/files/node/diskFileSystemProvider.ts`
- `src/vs/platform/files/common/fileService.ts`
- `src/vs/platform/state/node/stateService.ts`
- `src/vs/platform/backup/electron-main/backupMainService.ts`
- `src/vs/platform/tunnel/node/tunnelService.ts`
- `src/vs/platform/tunnel/node/sharedProcessTunnelService.ts`
- `src/vs/platform/tunnel/common/tunnel.ts`
- `src/vs/platform/log/node/spdlogLog.ts`
