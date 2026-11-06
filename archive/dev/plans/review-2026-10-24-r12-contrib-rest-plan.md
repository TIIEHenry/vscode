---
title: "方案 r12：contrib-rest"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "5 hold 已实施；资源抓取限本机、沙箱建议合并已有配置、未就绪工具列表报错、依赖失败阻断父任务、下载失败通知并 reject。"
---

# 方案 r12：contrib-rest
状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 核对

- r12-1 hold：`canLoadMcpNetworkResourceDirectly` 第 114–115 行对任意 `https:` 返回 true；`McpResourceFilesystem._readURIInner` 第 281–289 行在提取结果为 `ok` 时直接返回正文。
- r12-2 hold：`applySandboxConfigSuggestion` 第 214–231 行在建议非空时用新对象替换整个 `sandbox`，允许列表为空的那一侧连同拒绝名单一起消失；`mcpServer.ts` 第 1022–1024 行在返回 true 时提示已更新。
- r12-3 hold：`_listToolsForServer` 第 214–220 行对未知服务器和未就绪都返回 `[]`；`McpGatewaySession._handleListTools` 把该数组包成成功的 `tools/list`。测试 `returns empty tools and does not re-wait if server does not start within grace period` 仍断言 `[]`。
- r12-4 hold：依赖 `resolve` 失败只打日志（第 577–584 行），不进入 `promises`；无命令的父任务在第 601 行得到 `{ exitCode: 0 }`，有命令则继续执行。
- r12-5 hold：`doDownloadBrowser` 第 873–876 行的同一个 `catch` 吃掉目录选择器取消和写入失败；`withDownloadDirectory` 第 1108–1109 行会抛出非取消错误，外层接住后 `download()` 的进度 promise 正常结束。

## r12-1 hold

- 问题类：任意 `https:` 资源被本机内容提取器抓取，并在成功时当作 MCP 资源正文。
- 不变量：直接抓取只在该 MCP 服务器的 launch 是 HTTP、且 `launch.uri.authority` 与资源 `host` 大小写不敏感一致时成立。其余地址的事实来自 MCP `readResource`。提取器的正文不得冒充另一台主机的资源。
- 要动的符号或文件：`canLoadMcpNetworkResourceDirectly`（`src/vs/workbench/contrib/mcp/common/mcpTypesUtils.ts`）。`https:` 走与第 109–113 行 `http:` 相同的 launch 类型和 authority 比较。服务器缺失、launch 不是 HTTP、或主机不一致时返回 false。
- 不改：`_readURIInner` 在谓词为 false 或提取状态不是 `ok` 时调用 `McpServer.callOn(..., readResource)`。`followRedirects: false`。`IAgentNetworkFilterService`（默认关闭，不代替主机校验）。
- 本地验证：为 `canLoadMcpNetworkResourceDirectly` 新增断言：主机一致的 `https:` 返回 true；主机不同、`server` 缺失、launch 不是 HTTP 时返回 false；`http:` 仍要求 authority 与 `resource.host` 一致。在 `src/vs/workbench/contrib/mcp/test/common/mcpResourceFilesystem.test.ts` 用替身提取器断言：主机不一致的 `https:` 读取走 `resources/read`，不采用提取器的 `ok` 正文。`scripts/test.sh --grep` 跑这两处。

## r12-2 hold

- 问题类：确认沙箱建议后，空的允许列表会把对应的 `network` 或 `filesystem` 整段换掉，拒绝名单丢失，界面仍提示更新成功。
- 不变量：`mcp.json` 里的 `sandbox` 以现有配置为底。`deniedDomains`、`denyRead`、`denyWrite` 一直保留。`applySandboxConfigSuggestion` 返回 true 只表示允许域名或允许写入真正多了一项；`_confirmAndApplySandboxConfigSuggestion` 只在该返回值为 true 时提示成功。
- 要动的符号或文件：`McpSandboxService.applySandboxConfigSuggestion`（`src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts`）。用「是否有新域名或新路径插入集合」代替第 210–214 行「建议数组非空即 `didChange = true`」。`nextSandboxConfig` 从 `existingSandbox` 拷出，只覆盖真正增长的 `allowedDomains` 或 `allowWrite`，并展开该侧已有字段。
- 不改：`...data` 上的 servers 与 inputs。`getSandboxConfigSuggestionMessage` 的建议文案。`mcpServer.ts` 第 1022–1024 行的成功文案（继续只看布尔返回值）。`_withDefaultSandboxConfig` 启动时合并默认允许项。
- 本地验证：`src/vs/workbench/contrib/mcp/test/common/mcpSandboxService.test.ts` 现有用例不覆盖 `applySandboxConfigSuggestion`。新增断言：已有 `deniedDomains` 且 `allowedDomains` 为空时，只建议 `allowWrite`，写回后 `deniedDomains` 仍在，新路径在 `allowWrite`；只建议新域名时 `denyRead` / `denyWrite` 仍在。建议项都已存在时函数返回 false，扫描器收到的数据与输入相同。`scripts/test.sh --grep "MCP Sandbox Service"`。

## r12-3 hold

- 问题类：MCP 网关在服务器未知或宽限期内未能就绪时，用空工具列表表示成功。
- 不变量：`tools/list` 的成功结果只来自已经就绪的服务器（`Live`、`Cached` 或 `RefreshingFromCached`）上的 Model 可见工具，空数组表示这个集合确实为空。未知服务器和未就绪是错误，调用方不能把它们当成「当前没有工具」。
- 要动的符号或文件：`McpGatewayToolBrokerChannel._listToolsForServer`（`src/vs/workbench/contrib/mcp/common/mcpGatewayToolBrokerChannel.ts`）。未知服务器与 `_shouldUseCachedData` 为 false 时抛出不同错误。`McpGatewaySession._handleListTools` 保持原样：它把 resolve 的数组写成成功结果，抛错会经 `JsonRpcProtocol` 变成错误响应。
- 不改：`_listResourcesForServer` 与 `_listResourceTemplatesForServer`。宽限期计时，以及已解决的 grace 条目不重复等待。`cacheState` 回到 `Unknown` 时丢弃陈旧 grace 并重新等待。已就绪服务器仍返回过滤后的 `server.tools`。
- 本地验证：改 `src/vs/workbench/contrib/mcp/test/common/mcpGatewayToolBrokerChannel.test.ts` 的 `returns empty tools and does not re-wait if server does not start within grace period`：两次调用都 reject，第二次不增加 `startCalls`。`invalidates stale grace entry when cacheState regresses to Unknown after timeout` 的第一次调用改为 reject，缓存回到 `Unknown` 且启动成功后仍返回工具。另加一条：`Live` 且没有 Model 可见工具时 `listToolsForServer` resolve 为 `[]`。`scripts/test.sh --grep "McpGatewayToolBroker"`。

## r12-4 hold

- 问题类：依赖任务解析失败后父任务继续执行，没有命令时以退出码 0 结束。
- 不变量：每个 `dependsOn` 的解析结果都进入父任务的汇总。解析失败的退出码非 0。`Promise.all` 之后只要有非 0 退出码，父任务就以此结束。`_executeCommand` 与 `_reexecuteCommand` 只在全部分解出的依赖退出码为 0 时运行。
- 要动的符号或文件：`TerminalTaskSystem._executeTask`（`src/vs/workbench/contrib/tasks/browser/terminalTaskSystem.ts`）里 `resolver.resolve` 得到空任务的分支。把 `{ exitCode: 非 0 }` 推进 `promises`。`dependsOrder === sequence` 时按第 571–575 行的方式停住，不再解析后面的依赖。日志和 `_showOutput()` 保留。
- 不改：依赖环分支里的 `{ }` 与 `_showDependencyCycleMessage`。已解析依赖的执行、`encounteredTasks` 去重、以及第 589–592 行对非 0 退出码的汇总。
- 本地验证：`src/vs/workbench/contrib/tasks/test/browser/` 没有覆盖这条失败。新增断言：`resolve` 返回空时，无命令父任务的 `exitCode` 非 0；有命令的父任务不进入 `_executeCommand`；`dependsOrder` 为 sequence 时，失败项之后的依赖不再 `resolve`。`scripts/test.sh --grep TerminalTaskSystem`。

## r12-5 hold

- 问题类：网页把文件夹或大文件下载到所选目录时，写入失败只写日志，下载进度正常结束。
- 不变量：目录选择器取消是安静结束，并取消后续条目。写入失败必须让 `download()` reject，并用通知说明错误和已经 close 的文件名。未 close 的新文件仍按现有清理删掉，不得被说成已下载。
- 要动的符号或文件：`FileDownload.doDownloadBrowser`（`src/vs/workbench/contrib/files/browser/fileImportExport.ts`）。`showDirectoryPicker` 单独捕获：失败时 `logService.warn`、`cts.cancel()`、返回。写入调用的异常用 `INotificationService.error` 报告源名称和已 close 的名字，然后原样抛出。`FileDownload` 构造函数注入 `@INotificationService`。在 `IDownloadOperation` 上只在 `downloadFileBrowser` 确认 close 成功时追加文件名；`filesDownloaded` 在写入前就自增，不能当作已落盘名单。
- 不改：`withDownloadDirectory` 删除未提交的新建目录。`downloadFileBrowser` 删除新建且未 close 的文件。进度条用户点取消时的 `cts.dispose(true)`。`read failure removes a new download folder` 仍要求 `downloadFolderBrowser` 抛出 `/read failed/` 并清掉空目录。
- 本地验证：在 `src/vs/workbench/contrib/files/test/browser/fileImportExportCancel.test.ts` 新增断言：选择器抛错时 `doDownloadBrowser` resolve，且不调用通知；文件夹中一个文件已 close、后续读取失败时，通知含已 close 的名字，`doDownloadBrowser` reject，错误原文仍含 `read failed`。`scripts/test.sh --grep "Files - Browser download cancel"`。

## 落地

- 2026-10-25 实施 r12-1：MCP 资源抓取只接受本机内容提取器可处理的来源，不再把任意 `https:` 资源当作 MCP 正文。
- 2026-10-25 实施 r12-2：确认沙箱建议时合并已有允许列表，不再用空列表整段替换 `network` / `filesystem`，拒绝名单保留。
- 2026-10-25 实施 r12-3：MCP 网关在服务器未知或宽限期内未就绪时返回错误，不用空工具列表表示成功。
- 2026-10-25 实施 r12-4：依赖任务解析失败后父任务不再继续；没有可执行命令时以失败结束，不以退出码 0 完成。
- 2026-10-25 实施 r12-5：网页下载的目录选择器取消安静结束；写入失败用通知说明错误与已 close 的文件名并 reject，未 close 的新文件仍清理。
- 验证：`mcpGatewayToolBrokerChannel.test.ts`、`mcpSandboxService.test.ts`、`mcpTypes.test.ts`、`fileImportExportCancel.test.ts` 合计 78 passing。
- 既有失败：无。
