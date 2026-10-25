---
title: "审查 r12：contrib-rest"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；MCP 会对任意 HTTPS 直接抓取，沙箱建议会删掉拒绝规则并提示已更新，工具列表、任务依赖和网页下载会把失败当成完成。"
---

## r12-1 高

- 症状：打开 MCP 资源时，任意 `https:` 地址都会由本机内容提取器直接抓取，并当作该资源的文件内容返回。
- 位置：`src/vs/workbench/contrib/mcp/common/mcpTypesUtils.ts` 第 107–118 行
- 引用：

```107:118:src/vs/workbench/contrib/mcp/common/mcpTypesUtils.ts
export function canLoadMcpNetworkResourceDirectly(resource: URL, server: IMcpServer | undefined) {
	let isResourceRequestValid = false;
	if (resource.protocol === 'http:') {
		const launch = server?.connection.get()?.launchDefinition;
		if (launch && launch.type === McpServerTransportType.HTTP && launch.uri.authority.toLowerCase() === resource.host.toLowerCase()) {
			isResourceRequestValid = true;
		}
	} else if (resource.protocol === 'https:') {
		isResourceRequestValid = true;
	}
	return isResourceRequestValid;
}
```

- 为什么是问题：`http:` 必须与该 MCP 服务器启动地址的主机一致，`https:` 在服务器未匹配、主机不同时也返回允许。`mcpResourceFilesystem.ts` 第 281–289 行在提取成功时直接把抓到的正文当成资源内容，不再向 MCP 服务器读取。资源 URI 或恶意服务器因此能让编辑器用用户网络去读任意 HTTPS 地址。
- 方向：直接抓取只允许落到该服务器自己的主机，其余地址仍走 MCP `readResource`。

## r12-2 高

- 症状：用户确认「更新 mcp.json 沙箱配置」后，原有的 `deniedDomains`、`denyRead`、`denyWrite` 可能被整段删掉，界面仍提示已经更新成功。
- 位置：`src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts` 第 210–231 行
- 引用：

```210:231:src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts
			if (suggestedAllowedDomains.length === 0 && suggestedAllowWrite.length === 0) {
				return data;
			}

			didChange = true;
			const nextSandboxConfig: IMcpSandboxConfiguration = {};
			if (currentAllowedDomains.size > 0) {
				nextSandboxConfig.network = {
					...existingSandbox?.network,
					allowedDomains: [...currentAllowedDomains]
				};
			}
			if (currentAllowWrite.size > 0) {
				nextSandboxConfig.filesystem = {
					...existingSandbox?.filesystem,
					allowWrite: [...currentAllowWrite],
				};
			}
			return {
				...data,
				sandbox: nextSandboxConfig,
			};
```

- 为什么是问题：建议列表只要非空就把 `didChange` 设为真，并换成只含有允许项的新 `sandbox`。允许域名或允许写入为空时，对应的 `network` 或 `filesystem` 整段消失，拒绝名单一并丢失。`mcpServer.ts` 第 1022–1024 行在 `updated === true` 时弹出 “Updated sandbox configuration … in mcp.json”。沙箱因此比用户确认的内容更宽，并被写成已执行。
- 方向：写回时保留未改动的拒绝名单和其他沙箱字段，只有允许列表真正变了才提示成功。

## r12-3 中

- 症状：MCP 网关在服务器未能就绪时，对「列出工具」返回空数组，调用方收到的是成功结果。
- 位置：`src/vs/workbench/contrib/mcp/common/mcpGatewayToolBrokerChannel.ts` 第 212–220 行
- 引用：

```212:220:src/vs/workbench/contrib/mcp/common/mcpGatewayToolBrokerChannel.ts
	private async _listToolsForServer(serverId: string): Promise<readonly MCP.Tool[]> {
		const server = this._getServerById(serverId);
		if (!server) {
			this._logService.warn(`[McpGateway][ToolBroker] listToolsForServer: unknown server '${serverId}'`);
			return [];
		}
		if (!await this._shouldUseCachedData(server)) {
			this._logService.debug(`[McpGateway][ToolBroker] Server '${serverId}' not ready, skipping tool listing`);
			return [];
		}
```

- 为什么是问题：服务器未知、宽限期内没有启动成功，都和「这个服务器没有工具」使用同一个空数组。`mcpGatewayToolBrokerChannel.test.ts` 第 180–186 行把「从未启动成功」断言成 `[]`，并断言第二次调用不再等待。调用方会把失败看成该服务器当前没有可用工具。
- 方向：未就绪或启动失败要作为错误返回，空列表只表示服务器已经就绪且确实没有工具。

## r12-4 中

- 症状：依赖任务解析失败后，父任务仍继续执行；没有命令的父任务以退出码 0 结束。
- 位置：`src/vs/workbench/contrib/tasks/browser/terminalTaskSystem.ts` 第 577–601 行
- 引用：

```577:601:src/vs/workbench/contrib/tasks/browser/terminalTaskSystem.ts
					} else {
						this._log(nls.localize('dependencyFailed',
							'Couldn\'t resolve dependent task \'{0}\' in workspace folder \'{1}\'',
							Types.isString(dependency.task) ? dependency.task : JSON.stringify(dependency.task, undefined, 0),
							dependency.uri.toString()
						));
						this._showOutput();
					}
				}
			}

			return Promise.all(promises).then((summaries): Async.MaybePromise<ITaskSummary> => {
				for (const summary of summaries) {
					if (summary.exitCode !== 0) {
						return { exitCode: summary.exitCode };
					}
				}
				if ((ContributedTask.is(task) || CustomTask.is(task)) && (task.command)) {
					if (this._isRerun) {
						return this._reexecuteCommand(task, trigger, alreadyResolved!, thisRun);
					} else {
						return this._executeCommand(task, trigger, alreadyResolved!, thisRun);
					}
				}
				return { exitCode: 0 };
			});
```

- 为什么是问题：解析失败的依赖没有进入 `promises`，后面的退出码检查看不到这次失败。父任务有命令时仍会跑命令；父任务只由依赖组成时直接得到 `{ exitCode: 0 }`。输出通道里有一行日志，任务结果仍是成功。
- 方向：任一依赖解析失败就让父任务以失败结束，不要再执行后续命令。

## r12-5 中

- 症状：网页版把文件夹或大文件下载到用户所选目录时，写入失败只写日志，下载进度正常结束。
- 位置：`src/vs/workbench/contrib/files/browser/fileImportExport.ts` 第 873–876 行
- 引用：

```873:876:src/vs/workbench/contrib/files/browser/fileImportExport.ts
			} catch (error) {
				this.logService.warn(error);
				cts.cancel(); // `showDirectoryPicker` will throw an error when the user cancels
			}
```

- 为什么是问题：同一 `catch` 吃掉目录选择器取消，也吃掉下载过程中的写入失败。`withDownloadDirectory` 在第 1108–1109 行会把非取消错误抛出，这里接住后 `doDownloadBrowser` 正常返回，外层进度不再报错。用户会看到下载结束，目标目录里却是不完整的文件。
- 方向：用户取消可以安静结束；写入失败要通知用户，并标明已经落下的部分文件。
