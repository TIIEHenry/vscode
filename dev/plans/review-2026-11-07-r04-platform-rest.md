---
title: "十六路审查 2026-11-07 r04：platform 其余发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "读了 platform 其余部分 10-30 后的提交与此前未审的终端自动批准规则，4 条：git、sed、sort 自动批准漏挡执行或写文件，子进程监视器每次输入输出抛 TypeError。"
---

# 十六路审查 2026-11-07 r04：platform 其余发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本次范围是 `src/vs/platform/` 中除 `agentHost/`、`universeAgent/` 以外的部分。先逐个读了 2026-10-30 以后四个提交（`a4886c2f2da`、`ab5fb0a0af6`、`647d0dfd522`、`a319b6c2aa5`）改到的生产文件活码，以及唯一的未提交改动（`actions.ts` 新增一个菜单 ID）；这批改动主要是把双层 `.catch` 收成单层、补 `isDisposed` 守卫。随后抽查了 userDataSync、storage、Windows 更新、tunnel 在 10 月的修复，确认旧条目 2026-10-06 r06-4、r06-5 已在活码里修掉，又读了此前各轮都没覆盖的 `terminal/common/autoApprove/` 自动批准规则。共 4 条：三条在自动批准规则，严重度高；一条在子进程监视器，严重度中。文中提到的命令行为都在本机用只读方式核对过（输出到 `/dev/null`、只用 `echo`，或只读手册），没有改动任何文件。

### r04-1

- 严重度：高
- 症状：用户开启终端自动批准之后，agent 提出的下面三类 git 命令不经确认就执行。`git grep -O'<任意命令>' -e <模式>` 会用 shell 运行这段命令；`git diff --output=<任意路径> …` 会覆盖目标文件；`git branch -f <分支> <提交>` 与 `git branch -C <源分支> <已有分支>` 会改写已有分支。
- 代码：`src/vs/platform/terminal/common/autoApprove/gitAutoApproveRules.ts` 第 11–31 行。这张表由 `src/vs/workbench/contrib/terminalContrib/chatAgentTools/common/terminalChatAgentToolsConfiguration.ts` 第 224 行并入 `chat.tools.terminal.autoApprove` 的默认值，`src/vs/platform/agentHost/node/commandAutoApprover.ts` 第 651 行也并入了它。

```11:31:src/vs/platform/terminal/common/autoApprove/gitAutoApproveRules.ts
export const gitAutoApproveRules: Readonly<Record<string, boolean>> = {
	'/^git(\\s+(-C\\s+\\S+|--no-pager))*\\s+status\\b/': true,
	'/^git(\\s+(-C\\s+\\S+|--no-pager))*\\s+log\\b/': true,
	'/^git(\\s+(-C\\s+\\S+|--no-pager))*\\s+log\\b.*\\s--output(=|\\s|$)/': false,
	'/^git(\\s+(-C\\s+\\S+|--no-pager))*\\s+show\\b/': true,
	'/^git(\\s+(-C\\s+\\S+|--no-pager))*\\s+show\\b.*\\s--output(=|\\s|$)/': false,
	'/^git(\\s+(-C\\s+\\S+|--no-pager))*\\s+diff\\b/': true,
	'/^git(\\s+(-C\\s+\\S+|--no-pager))*\\s+ls-files\\b/': true,

	// git grep
	// - `--open-files-in-pager`: This is the configured pager, so no risk of code execution
	// - See notes on `grep` in the terminal auto-approval configuration.
	'/^git(\\s+(-C\\s+\\S+|--no-pager))*\\s+grep\\b/': true,

	// git branch
	// - `-d`, `-D`, `--delete`: Prevent branch deletion
	// - `-m`, `-M`: Prevent branch renaming
	// - `--force`: Generally dangerous
	'/^git(\\s+(-C\\s+\\S+|--no-pager))*\\s+branch\\b/': true,
	'/^git(\\s+(-C\\s+\\S+|--no-pager))*\\s+branch\\b.*\\s-(d|D|m|M|-delete|-force)\\b/': false,
};
```

- 为什么是问题：这张表的放行规则要靠后面的拒绝规则挡住危险参数，现在漏了三处。
  - 第 23 行无条件放行 `git grep`，第 21 行注释认为 `--open-files-in-pager` 只会打开已配置的 pager。git 允许把 pager 直接写进参数（`-O<pager>` 或 `--open-files-in-pager=<pager>`），有匹配时用 shell 运行这段字符串，并把匹配到的文件名追加在后面。本机 git 2.34.1 运行 `git grep '--open-files-in-pager=echo PAGER-RAN-VIA-SHELL;' -e Copyright -- <一个文件>`，终端打印出了 `PAGER-RAN-VIA-SHELL`。
  - 第 14、16 行只给 `log`、`show` 加了 `--output` 拒绝。第 17 行放行的 `git diff` 同样接受 `--output=<file>`：`git diff HEAD -- <有改动的文件>` 输出 12 行，加上 `--output=/dev/null` 后标准输出为空。
  - 第 30 行只拒绝 `-d`、`-D`、`-m`、`-M`、`--delete`、`--force`。git 手册写明 `-f` 就是 `--force`（把已有分支重置到另一个提交），`-C` 是 `--copy --force`（覆盖已有分支），这两个短参数只会命中第 29 行的放行。

  工作台的 `CommandLineAutoApprover.isCommandAutoApproved`（`commandLineAutoApprover.ts` 第 90–121 行）先查拒绝表、再查允许表；`CommandLineAutoApproveAnalyzer`（第 109 行、第 132–136 行）在每个子命令都命中允许规则时判为自动批准。引号里的 `;` 不会被 tree-sitter 拆成新的子命令，bash 下只有变量赋值和声明会被判为不可分析（`treeSitterCommandParser.ts` 第 106–123 行）。`chat.tools.terminal.enableAutoApprove` 默认开启（配置文件第 88–92 行），`isTerminalAutoApproveAllowed`（`terminalToolAutoApprove.ts` 第 75–85 行）另外要求用户接受过一次开启提示。用 node 按第 12–30 行逐条求值，上面四种写法都只命中放行规则；作为对照，`git log --output=/tmp/x` 命中拒绝规则。
- 方向：`git grep` 拒绝 `-O` 与 `--open-files-in-pager`（含粘连写法和 `=` 写法），`git diff` 补上 `--output` 拒绝，`git branch` 的拒绝规则补上 `-f` 和 `-C`。

### r04-2

- 严重度：高
- 症状：用 `--in-place` 的缩写做就地编辑，例如 `sed --in 's/a/b/' /home/user/.bashrc` 或 `sed --i "1i <文本>" /home/user/.bashrc`，不会被识别为写文件。默认规则放行 `sed`，命令不经确认就改写工作区外的文件。
- 代码：`src/vs/platform/terminal/common/autoApprove/sedFileWriteParser.ts` 第 20–29 行。工作台 `src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/treeSitterCommandParser.ts` 第 72–74 行只注册了这一个命令级写文件解析器，第 199–205 行先调用 `canHandle`，返回 true 才取写入目标；`src/vs/platform/agentHost/node/commandAutoApprover.ts` 第 178 行也用同一个解析器。

```20:29:src/vs/platform/terminal/common/autoApprove/sedFileWriteParser.ts
	canHandle(commandText: string): boolean {
		// Check if this is a sed command
		if (!commandText.match(/^sed\s+/)) {
			return false;
		}

		// Check for -i, -I, or --in-place flag
		const inPlaceRegex = /(?:^|\s)(-[a-zA-Z]*[iI][a-zA-Z]*\S*|--in-place(?:=\S*)?|(-i|-I)\s*'[^']*'|(-i|-I)\s*"[^"]*")(?:\s|$)/;
		return inPlaceRegex.test(commandText);
	}
```

- 为什么是问题：GNU sed 用 getopt_long 解析长参数，没有歧义的缩写都会被接受。sed 的长参数里只有 `--in-place` 以 `i` 开头，所以从 `--i`、`--in` 到 `--in-plac` 都是就地编辑，`--in=.bak` 是带备份后缀的就地编辑。本机 GNU sed 4.8 运行 `sed --in 's/x/y/' /dev/null` 和 `sed --i 's/x/y/' /dev/null`，都报「无法编辑 /dev/null: 非普通文件」，说明已经按就地编辑处理；`sed --bogus-xyz …` 则报「未识别的选项」。第 27 行正则的第一种写法要求 `-` 后面直接跟字母，`--in` 的第二个字符是 `-`，匹配不上；第二种写法要求完整拼出 `--in-place`。`canHandle` 因此返回 false，`getCommandFileWrites` 拿不到写入目标，`CommandLineFileWriteAnalyzer` 对工作区外写入的拦截（`commandLineFileWriteAnalyzer.ts` 第 132–188 行；`chat.tools.terminal.blockDetectedFileWrites` 默认 `outsideWorkspace`，见配置文件第 414–423 行）不会生效。配置文件第 316 行放行 `sed`，第 317–328 行的拒绝规则只看 `-e`、`-f`、`--expression`、`--file` 和脚本里的 `e`、`r`、`R`、`w`、`W` 命令，`1i` 插入命令不在其中。配置文件第 311–312 行的注释写明就地编辑靠写文件检测拦截，这个前提在缩写写法下不成立。用 node 求值第 27 行和这些拒绝规则：`sed -i …`、`sed --in-place …` 的 `canHandle` 为 true；`sed --in …`、`sed --i …`、`sed --in=.bak …` 为 false，而且都不被拒绝。同目录 `sortAutoApproveRules.ts` 第 16–19 行已经按「GNU 接受长参数缩写」处理了 `--compress-program`，这里没有同样处理。
- 方向：`canHandle` 把 `--` 后接 `in-place` 的任意非空前缀（可以带 `=后缀`）都当成就地编辑。

### r04-3

- 严重度：高
- 症状：`sort --output=<工作区外文件> <输入>`、`sort --o=<文件> <输入>`、`sort <输入> --output <文件>` 不经确认就覆盖目标文件；输入是 `/dev/null` 时目标文件被清空。
- 代码：`src/vs/platform/terminal/common/autoApprove/sortAutoApproveRules.ts` 第 9–20 行。配置文件第 330 行把这张表并入默认值，`src/vs/platform/agentHost/node/commandAutoApprover.ts` 第 705 行也并入了它。

```9:20:src/vs/platform/terminal/common/autoApprove/sortAutoApproveRules.ts
export const sortAutoApproveRules: Readonly<Record<string, boolean>> = {
	'/^sort\\b(?!-)/': true,

	// - `-o`: Writes output to a file.
	// - `-S`: Can request enough memory to cause denial of service.
	'/^sort\\b.*\\s-(o|S)\\b/': false,

	// GNU sort accepts unique long-option abbreviations. `--co` is the shortest unique
	// abbreviation for `--compress-program`; deny it and every longer spelling. Ignore
	// shell quote and escape syntax within the prefix since the shell removes it.
	'/^sort\\b.*\\s(?:\\$?[\'"]|\\\\)*-(?:\\$?[\'"]|\\\\)*-(?:\\$?[\'"]|\\\\)*c(?:\\$?[\'"]|\\\\)*o/': false,
};
```

- 为什么是问题：第 14 行只拒绝短参数 `-o`（以及 `-S`）。`-o` 的长参数 `--output`，以及它的 GNU 缩写（sort 的长参数里只有 `--output` 以 `o` 开头，写 `--o` 就够），都只命中第 10 行的放行。第 16–19 行已经为 `--compress-program` 处理了长参数缩写，`--output` 没有对应规则。工作台的命令级写文件解析只有 sed 一个（`treeSitterCommandParser.ts` 第 72–74 行），`sort --output` 的目标不会进入写文件检测，工作区外写入的拦截同样不生效。本机 GNU sort 8.32 运行 `printf 'b\na\n' | sort` 输出 2 行，加上 `--output=/dev/null` 或 `--o=/dev/null` 后标准输出为空。用 node 求值第 10、14、19 行：`sort -o …` 被拒绝；`sort --output=…`、`sort --o=…`、`sort in.txt --output …` 都被放行，而且都不被拒绝。
- 方向：拒绝规则覆盖 `--output` 及其缩写（从 `--o` 起，`=` 写法和空格写法都要挡）；`-S` 的长参数 `--buffer-size` 同样补上。

### r04-4

- 严重度：中
- 症状：终端每输入一次，pty host 都抛出 `TypeError: Cannot read properties of undefined (reading 'catch')`。Pty Host 日志里每次记一条 `[RPC Response] PtyService#input` 错误，渲染端 `LocalPty.input` 拿到一个没人处理的拒绝。终端有输出时，同一个 TypeError 还会从 node-pty 的数据回调和节流定时器里抛出，成为未捕获异常。Windows 上 pid 要等首段输出才拿到的分支里，第一段输出不会补发 pid。
- 代码：`src/vs/platform/terminal/node/childProcessMonitor.ts` 第 77–89 行、第 106–109 行；`src/vs/base/common/decorators.ts` 第 70–86 行；`src/vs/platform/terminal/node/terminalProcess.ts` 第 485–493 行、第 339 行、第 349–357 行；同类写法在 `src/vs/platform/terminal/node/windowsShellHelper.ts` 第 93 行、第 96–97 行。

```77:89:src/vs/platform/terminal/node/childProcessMonitor.ts
	handleInput() {
		this._refreshActive().catch(onUnexpectedError);
	}

	/**
	 * Output was triggered on the process.
	 */
	handleOutput() {
		this._refreshInactive();
	}

	@debounce(Constants.ActiveDebounceDuration)
	private async _refreshActive(): Promise<void> {
```

```106:109:src/vs/platform/terminal/node/childProcessMonitor.ts
	@throttle(Constants.InactiveThrottleDuration)
	private _refreshInactive(): void {
		this._refreshActive().catch(onUnexpectedError);
	}
```

```70:86:src/vs/base/common/decorators.ts
		return function (this: any, ...args: any[]) {
			if (!this[resultKey]) {
				this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
			}

			clearTimeout(this[timerKey]);

			if (reducer) {
				this[resultKey] = reducer(this[resultKey], ...args);
				args = [this[resultKey]];
			}

			this[timerKey] = setTimeout(() => {
				fn.apply(this, args);
				this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
			}, delay);
		};
```

```485:493:src/vs/platform/terminal/node/terminalProcess.ts
	input(data: string, isBinary: boolean = false): void {
		this._logService.trace('node-pty.IPty#write', data, isBinary);
		if (isBinary) {
			this._ptyProcess!.write(Buffer.from(data, 'binary'));
		} else {
			this._ptyProcess!.write(data);
		}
		this._childProcessMonitor?.handleInput();
	}
```

- 为什么是问题：`_refreshActive` 声明返回 `Promise<void>`，但套了 `@debounce`。`debounce` 的包装函数只排定时器，没有返回值；仓库开着 `experimentalDecorators`（`src/tsconfig.base.json` 第 6 行），包装函数会替换原型上的方法。运行时 `this._refreshActive()` 的结果是 `undefined`，第 78 行和第 108 行的 `.catch` 立即抛 TypeError。类型检查只看声明类型，编译不会报。
  - 输入：`TerminalProcess.input` 先写 pty，再调 `handleInput()`。异常经 `PersistentTerminalProcess.input`（`ptyService.ts` 第 889–896 行）抛出 `PtyService.input`（第 440–449 行）；`traceRpc`（第 79–83 行）记下错误后重新抛出，RPC 返回失败。渲染端 `LocalPty.input`（`localPty.ts` 第 41–46 行）不处理返回的 promise。`processBinary` 走的是同一个 `input`。
  - 输出：`onData` 回调最后一行调 `handleOutput()`（第 339 行）。`_refreshInactive` 套了 `@throttle`，每个 5 秒窗口里的第一次调用同步执行，异常从回调抛出；窗口内的后续调用由定时器补跑一次，异常抛在定时器里。pty host 经 `src/bootstrap-fork.ts` 第 156–167 行装了只打印、不退出的 `uncaughtException` 处理，所以进程不崩，但每次都留下错误。
  - Windows：pid 为 0 时，补发 pid 的监听器注册在主 `onData` 监听器之后（第 352–356 行）。node-pty 1.2.0-beta.15 的 `EventEmitter2.fire` 逐个调用监听器，没有 try/catch。第一段输出时主监听器抛错，补发 pid 的监听器这一次不会运行，`setPid` 与 `_sendProcessId` 要等下一段不走同步分支的输出。

  子进程检测本身仍在防抖定时器里执行，检测结果不受影响；出错的是每次输入、输出都会抛异常。`windowsShellHelper.ts` 第 93 行对同样套了 `@debounce` 的 `checkShell` 调 `.catch`，因为在 async 函数里，异常变成拒绝，被构造函数第 80 行的 `.catch` 记成一条错误，每个 Windows 终端一次。`src/vs/platform/terminal/test/node/platformTerminalLeftoverPromiseCatchScan.test.ts` 第 128–130 行要求 `childProcessMonitor.ts` 里这两处 `.catch` 必须存在，并禁止裸调用。`dev/progress/deferred-gaps.md` 的 D720 把这两处改成双层 `.catch`，11-04 的 `647d0dfd522` 又收成单层，两次都没有核对被调用方的运行时返回值。
- 方向：对套了 `@debounce` 或 `@throttle` 的方法直接调用、不接返回值，或者改用会返回真实 promise 的 `Delayer`、`Throttler`；同时改掉扫描测试里钉死 `.catch` 的断言。

## 打开过的文件

范围内，读过活码：

- `src/vs/platform/terminal/common/autoApprove/gitAutoApproveRules.ts`
- `src/vs/platform/terminal/common/autoApprove/sedFileWriteParser.ts`
- `src/vs/platform/terminal/common/autoApprove/sortAutoApproveRules.ts`
- `src/vs/platform/terminal/common/autoApprove/powershellAutoApproveRules.ts`
- `src/vs/platform/terminal/common/autoApprove/cmdDelayedExpansion.ts`
- `src/vs/platform/terminal/common/autoApprove/autoApproveParseSafety.ts`
- `src/vs/platform/terminal/node/childProcessMonitor.ts`
- `src/vs/platform/terminal/node/windowsShellHelper.ts`
- `src/vs/platform/terminal/node/terminalProcess.ts`
- `src/vs/platform/terminal/node/ptyService.ts`
- `src/vs/platform/terminal/node/ptyHostMain.ts`
- `src/vs/platform/terminal/node/ptyHostService.ts`
- `src/vs/platform/terminal/common/capabilities/commandDetectionCapability.ts`
- `src/vs/platform/terminal/common/capabilities/naiveCwdDetectionCapability.ts`
- `src/vs/platform/terminal/common/xterm/shellIntegrationAddon.ts`
- `src/vs/platform/terminal/test/node/platformTerminalLeftoverPromiseCatchScan.test.ts`
- `src/vs/platform/windows/electron-main/windowImpl.ts`
- `src/vs/platform/lifecycle/electron-main/lifecycleMainService.ts`
- `src/vs/platform/native/electron-main/nativeHostMainService.ts`
- `src/vs/platform/native/electron-main/auth.ts`
- `src/vs/platform/policy/common/nativeManagedSettingsIpc.ts`
- `src/vs/platform/keyboardLayout/electron-main/keyboardLayoutMainService.ts`
- `src/vs/platform/webContentExtractor/electron-main/webPageLoader.ts`
- `src/vs/platform/webContentExtractor/electron-main/webContentExtractorService.ts`
- `src/vs/platform/browserView/electron-main/browserViewInspector.ts`
- `src/vs/platform/userDataProfile/common/userDataProfileStorageService.ts`
- `src/vs/platform/update/electron-main/abstractUpdateService.ts`
- `src/vs/platform/tunnel/common/tunnel.ts`

范围内，只看了 2026-10-01 以后的提交 diff：

- `src/vs/platform/actions/common/actions.ts`（未提交改动）
- `src/vs/platform/dialogs/common/dialogs.ts`
- `src/vs/platform/browserView/electron-main/browserViewEmulator.ts`
- `src/vs/platform/browserView/electron-main/browserViewMainService.ts`
- `src/vs/platform/browserView/node/playwrightTab.ts`
- `src/vs/platform/launch/electron-main/launchMainService.ts`
- `src/vs/platform/windows/electron-main/windowsMainService.ts`
- `src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts`
- `src/vs/platform/extensionManagement/common/extensionTipsService.ts`
- `src/vs/platform/log/common/fileLog.ts`
- `src/vs/platform/log/common/logIpc.ts`
- `src/vs/platform/log/node/spdlogLog.ts`
- `src/vs/platform/meteredConnection/common/meteredConnectionIpc.ts`
- `src/vs/platform/meteredConnection/electron-browser/meteredConnectionService.ts`
- `src/vs/platform/update/common/updateIpc.ts`
- `src/vs/platform/update/electron-main/updateService.snap.ts`
- `src/vs/platform/update/electron-main/updateService.win32.ts`
- `src/vs/platform/update/electron-main/windowsMutex.ts`
- `src/vs/platform/update/electron-main/windowsUpdateCachePath.ts`
- `src/vs/platform/storage/common/storage.ts`
- `src/vs/platform/userDataSync/common/abstractSynchronizer.ts`
- `src/vs/platform/userDataSync/common/settingsSync.ts`
- `src/vs/platform/userDataSync/common/formattingOptionsCache.ts`
- `src/vs/platform/userDataSync/common/userDataAutoSyncService.ts`
- `src/vs/platform/userDataSync/common/userDataSyncAccount.ts`
- `src/vs/platform/userDataSync/common/userDataSyncIpc.ts`
- `src/vs/platform/userDataSync/common/userDataSyncLocalStoreService.ts`
- `src/vs/platform/userDataSync/common/userDataSyncService.ts`
- `src/vs/platform/userDataSync/common/userDataSyncServiceIpc.ts`
- `src/vs/platform/webWorker/browser/webWorkerServiceImpl.ts`

范围外，只为核对调用路径：

- `src/vs/base/common/decorators.ts`
- `src/bootstrap-fork.ts`
- `src/tsconfig.base.json`
- `src/vs/workbench/contrib/terminal/electron-browser/localPty.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/common/terminalChatAgentToolsConfiguration.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/treeSitterCommandParser.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/terminalToolAutoApprove.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/commandLineAnalyzer/autoApprove/commandLineAutoApprover.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/commandLineAnalyzer/commandLineAutoApproveAnalyzer.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/commandLineAnalyzer/commandLineFileWriteAnalyzer.ts`
- `node_modules/node-pty/lib/eventEmitter2.js`
