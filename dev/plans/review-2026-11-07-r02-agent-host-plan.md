---
title: "十六路审查 2026-11-07 r02：agentHost 方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 0、weaken 3、drop 0。三条都只在 Agents 窗口、它创建的定时自动化或接入宿主的远端客户端里可达。已按 2026-11-07 只读审查改稿：r02-1 按原稿；r02-2 改为前缀识别换目录、只认停在提示符且已确认目录的终端，SDK 内置 shell 跨命令与 `write_${shellType}` 免确认改为登记缺口；r02-3 改为每次发送一个取消源。同日已实施（未编译、未跑测试），代码审查经一轮修改后可接受。"
---

# 十六路审查 2026-11-07 r02：agentHost 方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无（三条都在 agentHost 进程里，默认编辑器窗口不经它发起会话，见文末「可达性核对」；产品对审批的要求是 PRD-004 权限座位和 PRD-026 的 Permissions 条目，只约束引擎请求在 Conversation 里的批准，而 Conversation 不经 AHP 实现，所以本稿不实现任何 PRD 验收项）。

只改下面三条 weaken，范围停在 `src/vs/platform/agentHost/` 及其测试。核对基于 HEAD `841ea38816d`，该目录没有未提交改动；审查后复核仍是这一 HEAD。三条共同的降级依据见文末「可达性核对」，实施顺序与登记见「实施与登记步骤」。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r02-1 | weaken | 高→中 | 成立。`classifyFileRedirect`（`commandAutoApprover.ts` 74–92 行）的正则把 `>&` 里的 `&` 留在目的地，`>& /home/u/.bashrc` 得到 `& /home/u/.bashrc`；`_resolveShellRedirectResource`（`sessionPermissions.ts` 607–626 行）把它接成 `<主工作目录>/& /home/u/.bashrc`，包含、受限目录与编辑 glob 判断都放行。打包语法把这条重定向解析为运算符 `>&` 加 `destination` 字段 `/home/u/.bashrc`（见文末「语法树核对记录」）。默认规则允许 `echo`（兜底表 623 行，工作台默认表 `terminalChatAgentToolsConfiguration.ts` 182 行），终端自动批准默认开（`agentHostSchema.ts` 764 行），沙箱默认 Off（`terminalChatAgentToolsConfiguration.ts` 507–515 行）。降级理由：只有 Copilot 的 shell 请求带 `shellLanguage` 并走这条规则，而默认编辑器窗口没有向 agentHost 会话发消息的入口；只在 Agents 窗口、它创建的定时自动化或接入宿主的远端客户端里可达。 |
| r02-2 | weaken | 高→中 | 成立。`cd /home/u && echo hi > .bashrc` 拆成 `cd /home/u`、`echo hi` 和重定向 `.bashrc`；`cd`、`echo` 都被默认允许（`commandAutoApprover.ts` 兜底表 622–623 行，工作台默认表 `terminalChatAgentToolsConfiguration.ts` 181–182 行），`_isShellWriteDestApproved`（`sessionPermissions.ts` 569–584 行）按主工作目录求值后放行。PowerShell 的 `cd..`、`cd\` 也会被共享规则 `cd: true` 生成的 `^cd\b`（`commandAutoApprover.ts` 606–610 行，PowerShell 下不分大小写）允许并换目录。跨命令同样成立：自定义终端工具复用空闲终端时不看目录（`copilotShellTools.ts` 176–193 行），超时只结束等待、不中止命令，随后终端就被放回空闲池（`shellCommandExecution.ts` 263–268 行，`copilotShellTools.ts` 532–541 行）；SDK 内置 shell 是默认路径（自定义工具默认关，`chat.shared.contribution.ts` 1597–1600 行；其沙箱默认 Off，1728–1737 行），而且很可能同样跨调用保留目录：SDK 自带 `write_bash`、`read_bash`、`bash_shutdown`、`list_bash` 这些长驻 shell 辅助工具（`copilotShellTools.test.ts` 358–363 行注释），运行时输出带 `<shellId: …>`（`copilotNonPtyShellTerminals.ts` 37 行），自定义工具照搬的说明写着 shell 与 cwd 被后续同步命令复用（`copilotShellTools.ts` 773 行）。测试 `a relative shell redirect resolves against the primary root (index 0)` 只锁没有换目录的情形，不是反证。稿中「工作台没有这个问题」只对跨命令成立：`CommandLineFileWriteAnalyzer`（`commandLineFileWriteAnalyzer.ts` 64–89 行）用终端当时的 cwd 求值，同一条命令里的 `cd` 它同样看不到，所以本条不以工作台为对齐目标。降级理由只剩可达性，同 r02-1；跨命令那一半在默认配置下也很可能可达，其中 SDK 内置 shell 的部分本方案不修，改为登记缺口。 |
| r02-3 | weaken | 高→低 | 成立。`_abort`（`codexAgent.ts` 5877–5911 行）在 `currentAppTurnId` 为空时直接返回，也不清 `currentTurnId`；`_sendMessage`（5560–5770 行）从入口到 `turn/start` 没有取消检查；`_withHostTurn`（2928–2944 行）让随后到达的 `turn/started` 领走仍留着的 `currentTurnId`；宿主的两次取消核对都在调用 `sendMessage` 之前（`agentSideEffects.ts` 1762、1766 行）。2026-10-24 r03（已实施）只管过期通知和中断时结算批准，r04-1 只改了 Copilot，都不承接本条。降级理由：Codex 在宿主里默认不注册（`chat.agentHost.codexAgent.enabled` 默认 false，`agentHostStarter.config.contribution.ts` 280–283 行，注册条件见 `agentHostMain.ts` 171–189 行）；编辑器窗口还要求 `chat.editor.codex.preferAgentHost` 为真（默认 false，`chat.shared.contribution.ts` 983–986 行，判定见 `src/vs/platform/agentHost/common/agentService.ts` 305–314 行），且默认编辑器窗口没有发消息入口。默认沙箱为 `workspace-write`，沙箱外的提权仍要经审批。 |

### r02-1

问题类：bash 的 `>&文件` 写重定向被解析成工作目录下的假路径，越界写入被自动批准。

不变量：

- bash `file_redirect` 交给 `isWriteDestApproved`、并由 `getWriteRedirectDestinations` 返回的目的地，取自语法树 `destination` 字段节点的文本（整体引号照旧剥掉），不含运算符，也不含 `>&` 里的 `&`。
- `>&`、`<&` 后面是数字节点的文件描述符复制，`>&-`、`<&-` 的关闭，以及 `>&` 后面恰好是字面 `-` 的关闭，都不是写目的地。
- 文本含 `>`、却取不到 `destination` 字段的 `file_redirect`（关闭运算符除外），记为目的地未知的写（`undefined`），整条命令要确认。
- `<>` 仍按写处理。`1<>/etc/passwd` 在 bash 语法里带 ERROR 子节点，运算符子节点是 `<`；写不写仍以节点文本含 `>` 为准，目的地取 `destination` 字段（`/etc/passwd`）。
- PowerShell 的 `redirection` 与无空格的 `generic_token` 重定向继续走 `classifyFileRedirect` 的文本判定，行为不变。

要动的符号：`CommandAutoApprover._extractSubCommands` 里 `capture.name === 'file_redirect'` 的分支（445–451 行）；新增一个只供 bash 使用的模块内函数（例如 `classifyBashFileRedirect`），入参是捕获节点；`classifyFileRedirect` 与 `isSafeRedirectDestination` 保留，供 PowerShell 和单个目的地文本复用。文件：`src/vs/platform/agentHost/node/commandAutoApprover.ts`。

改法：

1. `file_redirect` 捕获改调新函数；`redirection`、`generic_token` 两类捕获仍调 `classifyFileRedirect`。
2. 新函数按顺序判定。节点文本不含 `>` 时为读。运算符子节点是 `>&-` 时为安全。取 `childrenForFieldName('destination')` 并先滤掉其中的 `null`（该方法的返回类型是 `(Node | null)[]`），为空时返回目的地未知的写。运算符子节点是 `>&`，且唯一的目的地节点类型是 `number` 或文本恰为 `-` 时，为安全。其余情况逐个目的地节点处理。
3. 逐个目的地节点：bash 不做遮罩，直接用节点文本。先过 `isSafeRedirectDestination`（覆盖 `/dev/null` 等及其带引号形式），安全就跳过；否则剥掉整体引号后放进 `unsafeWriteDests`。`string` 里带变量、`simple_expansion`、`process_substitution` 这类节点照样以原文进入，由 `_resolveShellRedirectResource` 的动态目的地规则（`sessionPermissions.ts` 597、615 行）拒绝，这里不另判。
4. 语法把 `> a b` 的两个词都放进 `destination`。两个都按写目的地检查，任一不通过就要确认，与工作台 `TreeSitterCommandParser.getFileWrites`（`treeSitterCommandParser.ts` 163–170 行）逐个节点取文件的做法一致。
5. `getWriteRedirectDestinations`、`evaluate` 与 `SessionPermissionManager.isAutoApproveRuleResolvable` 共用 `_extractSubCommands`，不另改。

明确不改什么：

- `_resolveShellRedirectResource` 对动态目的地返回 `undefined` 的规则、`_isShellWriteDestApproved` 的符号链接与多根包含判断不变（2026-10-06 r04 与 2026-10-30 r03 方案已落的行为）。
- 兜底规则表与工作台转发的规则不变；heredoc、herestring 仍不算写。
- 保持 `commandAutoApprover.test.ts` 的 `does not auto-approve commands with write redirections to arbitrary paths`、`input redirections do not block auto-approval`、`write redirections to safe sinks remain auto-approved`、`mixed safe and unsafe redirections still require confirmation`、`does not auto-approve <> read-write redirects or process substitution targets`、`respects the isWriteDestApproved predicate for write redirections`。
- 保持 `sessionPermissions.test.ts` 的 `PowerShell redirects require a literal approved destination`、`CMD delayed-expansion redirect destinations require confirmation`、`requires confirmation when a shell redirect targets a symlink outside the working directory`、`a relative shell redirect resolves against the primary root (index 0)`。

本地验证：

- `src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts` 新增一条。区分修前修后的断言：带谓词时，`echo hi >& /tmp/fake-home/.bashrc` 与 `echo hi >&/tmp/fake-home/.bashrc` 让谓词收到 `/tmp/fake-home/.bashrc`，`echo hi >& out.txt` 让谓词收到 `out.txt`，从不出现以 `&` 开头的字符串；`getWriteRedirectDestinations('echo hi >& /x/y')` 等于 `['/x/y']`。不带谓词时这两条 `>&` 命令都不是 `approved`，这一断言修前也成立，只作回归护栏。
- 同文件新增一条：`echo hi >&-`、`echo hi 2>&-`、`echo hi >& -` 是 `approved` 且不调用谓词（修前会被当成写到 `&-` 或 `& -` 而降成 `noMatch`）；`echo hi >&2`、`echo hi 2>&1` 同样是 `approved`，作回归护栏。
- `src/vs/platform/agentHost/test/node/sessionPermissions.test.ts` 新增一条，命令里嵌了绝对路径，照该文件 745–748 行用 `(isWindows ? test.skip : test)` 跳过 Windows：`echo hi >& ${join(outsideDir, '.bashrc')}` 与 `echo hi >& ../escape.txt` 得到 `undefined`（修前都是 `NotNeeded`），`echo hi >& out.txt` 得到 `NotNeeded`。
- 运行顺序：先 `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`），`scripts/test.sh` 加载的是 `out/` 下的编译产物；再跑 `scripts/test.sh --run src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts` 与 `scripts/test.sh --run src/vs/platform/agentHost/test/node/sessionPermissions.test.ts`，确认新增用例和「明确不改什么」里的既有用例都通过；最后跑 `npm run eslint`。

### r02-2

问题类：命令自己换了目录（同一条命令里的 `cd`，或自定义终端工具复用的终端还留着上一条命令的目录）时，相对写重定向仍按主工作目录求值并被自动批准。

不变量：

- 相对写目的地只在两件事都成立时，才按主工作目录（下标 0）求值并可能放行：命令行里没有改变当前目录的子命令（指向主工作目录本身、且命令名与 `cd` 完全相同的 `cd` 除外）；产出方没有报告这条命令会从别的目录起跑，也没有报告无法确认。
- 绝对写目的地的判定不变，仍按任一根包含、平台受限目录、编辑 glob 与符号链接规则。
- 没有换目录、产出方也没有报告时，`echo hi > out.txt` 仍自动批准；SDK 内置 shell 的请求维持这一现状，跨调用目录问题另行登记。
- 自定义终端工具对模型承诺的「工作目录在多次调用间保持」（`copilotShellTools.ts` 773、819 行）不变，方案不把复用的终端拉回主工作目录。
- 自定义终端工具里，按「从主工作目录起跑」批准的命令，只在一个停在干净提示符、且上一条命令结束后已确认目录为主工作目录的终端里执行；找不到这样的终端就不执行。这条只覆盖经主 shell 工具（`bash`、`powershell`）送入的命令；经 `write_${shellType}` 写入的输入不在保证之内，单独登记。
- 只有宿主可能读到这一事实的请求才查询并登记：自定义 shell 工具、不要求托管审批、不请求越出沙箱、命令文本含 `>`。其它请求不查询，执行时照常复用任一空闲终端或新建终端，不会因为并行调用占走终端而失败。

要动的符号与文件：

- `src/vs/platform/agentHost/node/commandAutoApprover.ts`：`_extractSubCommands` 的返回值增加换目录目标列表；新增公开方法 `getDirectoryChangeTargets(commandLine, options)`。
- `src/vs/platform/agentHost/common/commandLineHelpers.ts`：把模块内 `sameDirectory` 的比较逻辑导出复用，`stripRedundantCdPrefix` 行为不变。
- `src/vs/platform/agentHost/node/sessionPermissions.ts`：`IToolApprovalEvent`（45–53 行）加可选字段；`getAutoApproval` 的 shell 分支（328–366 行）、`isAutoApproveRuleResolvable`（417–436 行）、`_isShellWriteDestApproved`（569–584 行，含 570–571 行注释）。
- `src/vs/platform/agentHost/common/agent.ts`：`IAgentToolPendingConfirmationSignal`（873 行起，`shellLanguage` 在 899 行）加同名可选字段。
- `src/vs/platform/agentHost/node/agentSideEffects.ts`：`_handleToolReady` 组装 `approvalEvent`（1283–1291 行）时透传该字段。
- `src/vs/platform/agentHost/node/agentHostTerminalManager.ts`：`ICommandTracker`（153–162 行）加提示符与目录确认标记；`_handleOsc633Event`（682–781 行）处理现在被忽略的 `PromptStart`，并在 `CommandExecuted`、`CommandFinished`、`Property` 的 `Cwd` 上维护标记；`writeInput`（502–507 行）记下提示符之后有输入；`IAgentHostTerminalManager`（120 行起）新增一个只读方法，例如 `getPromptConfirmedCwd(uri)`。
- 同一接口的三个测试替身同步加方法：`src/vs/platform/agentHost/test/node/testAgentHostTerminalManager.ts`（20 行）、`copilotShellTools.test.ts`（36 行）与 `copilotAgent.test.ts`（321 行）里的 `TestAgentHostTerminalManager`。
- `src/vs/platform/agentHost/node/copilot/copilotShellTools.ts`：`ShellManager` 新增不占用终端的查询方法；`getOrCreateShell`（169–225 行）对记下的 toolCallId 只返回合格终端，找不到时给出可区分的空结果；主 shell 工具的 handler（450–543 行）据此返回失败结果。
- `src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts`：权限处理里自定义 shell 工具的分支（3466–3486 行）与发出 `pending_confirmation` 的位置（3557–3586 行）。

改法：

1. 识别换目录。`_extractSubCommands` 对每个 `command` 捕获取第一个空白分隔的词作命令名，用与允许规则同口径的前缀匹配：bash 用 `/^(cd|pushd|popd)(\W|$)/`，PowerShell 不分大小写用 `/^(cd|chdir|sl|set-location|pushd|push-location|popd|pop-location)(\W|$)/i`。允许规则 `cd: true` 生成的是 `^cd\b`（606–610 行），PowerShell 下不分大小写，所以 `cd..`、`cd\` 这类会被允许的形状都必须被认出来。命中后：命令名与列表里某一项完全相同（PowerShell 不分大小写）且恰好一个字面参数时记这个参数，剥掉整体引号，PowerShell 的 `-Path`、`-LiteralPath` 取其后的参数；命令名只是前缀命中（如 `cd..`、`cd\`、`cd-`）、没有参数、参数多于一个、带其它选项、参数为 `-`、含 `_dynamicRedirectDestRegex` 同类的展开字符，或命令是 `popd`、`Pop-Location` 时记 `undefined`。`builtin cd`、`command cd` 这类包装不在默认允许表里，整条命令本来就要确认，不另识别。`getDirectoryChangeTargets` 返回这份列表；解析失败时返回 `undefined`，调用方按「不允许相对目的地」处理（这时 `shouldAutoApprove` 本来也会要求确认）。
2. 判定是否允许相对目的地。shell 分支在逐个检查写目的地之前算一次：产出方字段不为 `false`，并且每个换目录目标都是绝对路径、与主工作目录比较相同（用 `commandLineHelpers.ts` 导出的比较：去掉末尾分隔符，Windows 与 macOS 忽略大小写）。不满足时，`_isShellWriteDestApproved` 对展开 `~` 之后仍不是绝对路径的目的地直接返回 false；绝对目的地照旧检查。不看先后顺序：换目录出现在重定向之后也按换目录处理，宁可多问一次。570–571 行注释改成与这条规则一致。
3. `isAutoApproveRuleResolvable` 的内联谓词用同一判定，保证「加一条规则就能解决」的提示与实际批准结果一致。
4. 产出方事实。`IAgentToolPendingConfirmationSignal` 与 `IToolApprovalEvent` 加 `shellStartsInPrimaryWorkingDirectory?: boolean`：缺省表示产出方不跟踪，维持现在的假设；`false` 表示已知不在主工作目录或无法确认；`true` 表示已知在。`_handleToolReady` 原样透传。
5. 终端的提示符确认。`ICommandTracker` 加三个标记。前两个的含义是「上一次 `CommandExecuted` 或 `CommandFinished` 之后（还没有命令时从终端创建起算）」：收到过 `PromptStart`（`633;A`）、收到过 `Cwd` 属性（`633;P;Cwd`）。第三个是「上一次 `CommandExecuted` 之后（还没有命令时从终端创建起算）经 `writeInput` 写入过输入」。`CommandExecuted` 与 `CommandFinished` 清前两个，只有 `CommandExecuted` 清第三个；`Cwd` 属性置第二个；`PromptStart` 在没有进行中命令时置第一个，不碰第三个；`writeInput` 置第三个（`sendText`、客户端键入、`write_${shellType}` 都经过它）。提示符不清输入标记，是因为 bash 的 PS1 里嵌着 `633;A`（`shellIntegration-bash.sh` 386–387 行），readline 在 Ctrl+L、窗口缩放、补全列表之后重绘提示符时会再发一次 `A`，但不提交、也不清掉已键入的文本；`CommandFinished` 也不清，是因为命令运行期间预先键入、没被命令读走的文本会留到下一个提示符。代价是写入过输入的终端要等它的下一条命令开始之后才可能重新合格。新方法只在下面全部成立时返回 `managed.cwd`，否则返回 `undefined`：命令检测可用；`activeCommandId` 为空；前两个标记为真；第三个为假。标记与 633 事件的先后无关：bash 在 `__vsc_command_complete` 里先发 `633;D` 再发 `633;P;Cwd`，提示符随 PS1 之后才出（`shellIntegration-bash.sh` 367–377 行）。
6. `ShellManager` 新增按 shell 类型和 toolCallId 查询的方法，不占用终端：存在一个未被占用、未退出的同类型终端，其 `getPromptConfirmedCwd` 与 `workingDirectory` 比较相同（同第 2 步的比较）时为真，并记下该 toolCallId；否则为假。没有空闲终端、只有未确认的终端、刚新建还没出过提示符的终端，都为假。因超时被释放（超时结果不设 `keepShellBusy`，`copilotShellTools.ts` 532–541 行；超时没有下限，451 行）、或经后台与 alt buffer 释放的终端，命令仍在跑或还没回到提示符，第 5 步的方法返回 `undefined`，在下一次提示符之前不合格。新终端的目录要等首个提示符的 `Cwd` 报告确认，`_resolveCwd` 在目录不可达时回落到 `$HOME`（`agentHostTerminalManager.ts` 924–949 行）、shell 启动脚本自行 `cd` 这两种情况都会被这一步挡住。
7. `getOrCreateShell` 遇到记下的 toolCallId 时，重新按第 6 步的条件挑一台合格的空闲终端复用；找不到就不新建终端，返回可区分的空结果，handler 据此返回失败结果、不调用 `sendText`，提示模型重新执行（重新执行会再走一次批准）。记录用完即删，权限被拒和会话处置时同样删除。只有第 8 步查询过的请求会被记下。
8. `CopilotAgentSession` 只对同时满足下面四个条件的请求调用第 6 步的查询，把结果写进信号字段：自定义 shell 工具；不要求托管审批（宿主对它不走自动批准，`agentSideEffects.ts` 1298 行）；不请求越出沙箱（`getAutoApproval` 第 0 步直接返回，`sessionPermissions.ts` 259 行，`isAutoApproveRuleResolvable` 在 421 行返回 false）；命令文本含 `>`（写目的地只来自重定向，写入类运算符都含 `>`，没有 `>` 时宿主读不到这个事实）。满足条件却没有 ShellManager 时报 `false`，因为不填会被宿主当作「不跟踪」而按主工作目录求值；启动器开启自定义终端工具时必定提供 ShellManager（`copilotSessionLauncher.ts` 785–787 行），这只是兜底。其它请求不填，执行时照常复用任一空闲终端或新建终端，并行调用不会因此失败。SDK 内置 shell（`request.kind === 'shell'`）不填，宿主看不到它的终端状态。残留：提供方无法预知宿主会不会自动批准，需要人工确认的含 `>` 命令仍会登记，确认期间那台终端被别的调用占走或离开提示符时，这条命令会失败一次并提示模型重跑。
9. 边界：自定义终端工具开启时，会话里第一条带相对重定向的命令（还没有出过提示符的终端），以及所有终端都忙或都未确认时的命令，相对目的地都要确认；没有 shell integration 的终端走 sentinel 回退，永远不合格。

明确不改什么：

- `stripRedundantCdPrefix` 与 `extractCdPrefix` 行为不变。保持 `commandLineHelpers.test.ts` 的 `rewrites bash command when cd matches working directory`、`does not rewrite when cd target differs`。
- 不改复用终端的目录，也不在命令前补 `cd`，自定义工具的持久会话语义不变。保持 `copilotShellTools.test.ts` 的 `getOrCreateShell reuses an idle shell after the reference is disposed`、`getOrCreateShell creates a new shell when the existing reference is still held`。
- 超时不中止命令、超时后释放引用的行为不变（`shellCommandExecution.ts` 263–268 行，`copilotShellTools.ts` 532–541 行）；新判定只是不把这样的终端算作合格。
- `write_${shellType}`（`copilotShellTools.ts` 573–594 行）仍是 `skipPermission: true`，`formatTerminalText`（`agentHostTerminalManager.ts` 106–115 行）仍把换行换成回车，带换行的输入会直接执行。保持 `copilotShellTools.test.ts` 的 `shell helper tools (read/write/shutdown/list/redirect) are registered with skipPermission: true`。本方案不收紧它，按「实施与登记步骤」单独登记。
- SDK 内置 shell 的请求不填产出方字段，相对目的地仍按主工作目录求值；宿主看不到它的当前目录，本方案不修，按「实施与登记步骤」登记缺口。
- 保持 `sessionPermissions.test.ts` 的 `a relative shell redirect resolves against the primary root (index 0)`、`an absolute shell redirect auto-approves under a non-primary root but confirms outside`、`auto-approves shell commands in default permission mode when terminal auto-approve is enabled`、`auto-approves shell redirects through symlinks that stay inside the working directory`；保持 `agentHostTerminalManager.test.ts` 的 `CWD property dispatches TerminalCwdChanged`、`TerminalCommandDetectionAvailable is dispatched on first OSC 633`；保持 `agentSideEffects.test.ts` 的 `tool_ready forwards the signal shell language into shell approval` 与 `copilotAgentSession.test.ts` 的 `shell permissions carry the tracked shell language when known`。

本地验证：

- `src/vs/platform/agentHost/test/node/sessionPermissions.test.ts` 新增一条，命令里嵌了绝对路径，照 745–748 行跳过 Windows：`cd ${outsideDir} && echo hi > .bashrc`、`cd && echo hi > out.txt` 得到 `undefined`；先照 437 行的写法 `configService.updateRootConfig({ [AgentHostTerminalAutoApproveRulesConfigKey]: { pushd: true, echo: true } })`，再断言 `pushd ${outsideDir} && echo hi > out.txt` 得到 `undefined`（`pushd` 不在默认允许表里，不配规则时修前修后都是 `undefined`，断言区分不了）；`cd ${workDir} && echo hi > out.txt` 与 `cd ${outsideDir} && echo hi > ${join(workDir, 'out.txt')}` 得到 `NotNeeded`；`isAutoApproveRuleResolvable` 对 `cd ${outsideDir} && my-custom-script > out.txt` 为 false；PowerShell 的 `Set-Location ${outsideDir}; Write-Host hi >out.txt` 与 `cd..; Write-Host hi >out.txt` 得到 `undefined`（后者修前是 `NotNeeded`）。
- 同文件新增一条：`echo hi > out.txt` 带 `shellStartsInPrimaryWorkingDirectory: false` 得到 `undefined`，带 `true` 或不带都得到 `NotNeeded`。
- `src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts` 新增 `getDirectoryChangeTargets` 断言：bash 的 `cd /x && echo hi > y` 为 `['/x']`，`cd`、`cd -`、`cd $HOME`、`cd -P /x`、`popd`、`cd..` 各为 `[undefined]`，`echo hi > y` 为 `[]`；PowerShell 的 `Set-Location -Path C:\x` 为 `['C:\x']`，`cd..`、`cd\` 各为 `[undefined]`，`CD ..` 为 `['..']`。
- `src/vs/platform/agentHost/test/node/agentHostTerminalManager.test.ts` 在 `CWD property dispatches TerminalCwdChanged` 旁新增一条，用 633 序列驱动：首个提示符之前 `getPromptConfirmedCwd` 为 `undefined`；收到 `Cwd` 与 `A` 后返回该目录；收到 `C` 后为 `undefined`；收到 `D` 但还没有新的 `Cwd` 与 `A` 时仍为 `undefined`；经 `writeInput` 写入后为 `undefined`，重绘提示符（再收到 `A`）之后仍为 `undefined`；命令运行期间写入的输入在 `D`、`Cwd`、`A` 之后仍让它为 `undefined`，下一条命令的 `C` 之后再收到 `D`、`Cwd`、`A` 才恢复。
- `src/vs/platform/agentHost/test/node/copilotShellTools.test.ts`（替身 `TestAgentHostTerminalManager` 加同名方法）新增一条：空闲终端没有提示符确认的目录时查询为假；空闲终端确认的目录不等于工作目录时为假；没有空闲终端时为假；查询为真并记下 toolCallId 之后，若执行前那台终端不再合格，handler 不新建终端，返回失败结果且没有 `sendText`。再新增一条：两个没有登记的调用并行时，后到的那个新建终端执行，不返回 `shell_unavailable`。
- `src/vs/platform/agentHost/test/node/agentSideEffects.test.ts` 在 `tool_ready forwards the signal shell language into shell approval` 旁新增一条：信号上的 `shellStartsInPrimaryWorkingDirectory` 原样进入 `getAutoApproval` 的事件。
- `src/vs/platform/agentHost/test/node/copilotAgentSession.test.ts` 在 `shell permissions carry the tracked shell language when known` 旁新增一条：含 `>` 的自定义 shell 工具请求的信号带这个字段，被拒后撤销记录；不含 `>` 的、要求托管审批的自定义 shell 工具请求与 SDK 内置 shell 请求都不带，也不查询；没有 ShellManager 时，含 `>` 的自定义 shell 工具请求带 `false`。该文件夹具在 775、961 行传 `shellManager: undefined`，这条用例改用带查询方法的 ShellManager 替身。
- 运行顺序：先 `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`）；再对上面六个测试文件逐个跑 `scripts/test.sh --run <文件>`，确认新增用例和「明确不改什么」里的既有用例都通过；最后跑 `npm run eslint`。

### r02-3

问题类：Codex 回合在 app-server 回报 `turn/started` 之前被取消时，取消不生效，回合照常执行。

不变量：

- 取消发生时还没有认领回合的每一次发送，都不再发出 `turn/start` 或 `thread/compact/start`；首次发送还在物化线程、连接尚未就绪的窗口也包括在内。
- 取消发生时已认领、尚未绑定 app turn 的 host turn，一经 `turn/started` 绑定就立即对该 app turn 发 `turn/interrupt`。
- 取消之后才开始的发送不受影响；交错在途的多次发送各自持有取消源，互不覆盖。宿主两处都以不等待的方式发起发送（`agentSideEffects.ts` 249、1400 行），Codex 的 `chats.sendMessage`（`codexAgent.ts` 4270–4274 行）也不排队，交错是真实情形。
- `currentAppTurnId` 已有值时，`_abort` 的现有行为不变：结算挂起批准并发 `turn/interrupt`。
- 放弃发送时 `sendMessage` 正常返回，不抛错，不发 `ChatError` 或 `ChatTurnComplete`，但补发一次本回合的 `ChatTurnCancelled`，`duration` 为 0、不动计时（这次发送没有开始计时，会话上的计时可能属于别的回合）。会话已拆除或还没绑定 chat 时不补发：拆除会把会话移出 `_sessions`，`_fire` 找不到会话会抛错，chat 已经不在也无处上报。`abort` 不带 turn id，一条迟到的取消可能放弃一个宿主仍在进行的回合；宿主收到 agent 发出的 `ChatTurnCancelled` 时，若它正是当前回合就结束它（`agentSideEffects.ts` 887–892 行，不再调用 `abort`），否则按过期动作丢弃（746–752 行）或由 reducer 忽略（`endTurn` 只结束当前回合），所以对已被宿主取消的回合补发没有副作用。Copilot 同类情形调用 `discardActiveTurn()`（`copilotAgentSession.ts` 1603 行）。
- 每次发送登记的取消源在所有返回路径上都撤销，包括三处提前返回。

要动的符号：`ICodexSession`（509 行起；`currentTurnId` 在 672 行，`currentAppTurnId` 在 678 行）新增两个字段：未认领发送的取消源集合，以及已取消、尚未绑定 app turn 的 host turn id 集合；三处构造（`currentTurnId: undefined` 所在的约 3583、4595、4910 行）初始化为空集合。`CodexAgent._abort`（5877–5911 行）、`_sendMessage`（5560–5770 行）、`_handleTurnStartedNotification`（2946–2961 行）、`_handleTurnCompletedNotification`（2975 行起，清当前回合在 2996 行）、`_handleConnectionLost`（3942 行起，清当前回合在 3982 行）。文件：`src/vs/platform/agentHost/node/codex/codexAgent.ts`。取消源的写法沿用 2026-10-24 r04-1 在 Copilot 的落地：每次发送捕获自己的取消 token，预检之后核对（`copilotAgentSession.ts` 1881–1895、2580–2597 行）。

改法：

1. `_sendMessage` 在第一个 await（5577 行的 `_adoptWorkingDirectoryBeforeSend`）之前算出 `effectiveTurnId`，新建这次发送自己的取消源并放进未认领集合。从这里到函数末尾包一层外层 `try/finally`，`finally` 里把这个取消源移出集合并释放；三处提前返回（物化失败 5600–5611 行、按新工具重建线程失败 5642–5653 行、恢复失败 5668–5680 行）与主体的 `try` 都在这层里面，现有清理临时文件的内层 `finally` 不变。
2. 把 `_abort` 里发 `turn/interrupt` 的请求和失败告警抽成一个按 app turn id 中断的私有方法，供 `_abort` 和第 5 步共用。
3. `_abort` 在结算挂起批准（5894 行）之后、`threadId` 检查（5895 行）与连接检查（5900 行）之前，同步做两件事：取消未认领集合里的每一个取消源；`currentTurnId` 有值而 `currentAppTurnId` 为空时，把 `currentTurnId` 放进已取消未绑定集合。然后照旧：`currentAppTurnId` 有值时走现有中断路径，否则返回。这两件事都在第一个 await 之前完成，所以首次发送还在物化线程、`threadId` 为空或连接未就绪时取消同样生效。
4. `_sendMessage` 在两处认领回合之前核对这次发送自己的 token：compact 分支在 5688–5689 行的 await 之后、5694 行写 `currentTurnId` 之前；普通分支在 5704–5707 行的 await 之后、5712 行写 `currentTurnId` 之前。已取消时不认领、不计时、不发请求；会话未拆除且已绑定 chat 时补发一次本回合 `duration` 为 0 的 `ChatTurnCancelled`；然后正常返回。认领时把这次发送的取消源移出未认领集合；认领之后到发出请求之间没有 await，此后到达的取消由第 3 步记进已取消未绑定集合。
5. `_handleTurnStartedNotification` 在过期通知的提前返回之后、`_withHostTurn` 已把这条 app turn 绑到当前 host turn 时，若该 host turn 在已取消未绑定集合里，就把它移出，用第 2 步的方法对这个 app turn 发 `turn/interrupt`，失败只记告警。绑定本身、`_persistTurnEventId` 与 `mapTurnStarted` 照旧执行；随后状态为 `interrupted` 的 `turn/completed` 按现有路径清 `currentTurnId` 与 `currentAppTurnId`。
6. 现有清当前回合的三处（2996、3982、5739 行）同时把该 host turn 移出已取消未绑定集合；会话处置时清空两个集合。
7. 不读 `turn/start` 响应里的 turn id 来绑定或中断；绑定仍以 `turn/started` 为准，与 2026-10-24 r03-1 的约定一致。
8. `abort(chat)` 不带 turn id，取消对象仍是「这个 chat 当前在途的东西」：一条迟到或重复的 `ChatTurnCancelled` 会取消当时所有未认领的发送，这与现在 Codex 中断当前 app turn、Copilot `_beginAbort` 取消当前 token 的语义一致，本条不改；被这样放弃的回合由第 4 步补发的取消信号在宿主上结束，不会停在进行中。

明确不改什么：

- `IAgentChats.abort` 的签名和 `AgentSideEffects` 的取消处理不变；宿主在 `_sendTurnMessage` 里发送前的两次核对（1762、1766 行）保留。
- `_withHostTurn` 的认领规则不变：只有本回合自己的 `turn/started` 能认领，迟到的旧通知不改当前绑定。保持 `codexCreateChat.test.ts` 的 `a late app-server turn notification does not take over the current turn`。
- `_abort` 结算挂起批准、中断已绑定回合的行为不变。保持 `turn completion, abort and steering cancel parked approvals`。
- 同一 chat 的发送不加排队；默认权限表（436–439 行）不变。

本地验证：

- `src/vs/platform/agentHost/test/node/codex/codexCreateChat.test.ts` 新增 `abort before turn/start keeps the cancelled prompt from reaching the app-server`：会话物化后调用 `agent.chats.sendMessage`，turn id 为 `host-1`，不等它完成就调用 `agent.chats.abort`；发送结束后断言出站请求里没有 `turn/start`，`currentTurnId` 为 `undefined`，`sendMessage` 正常完成，agent 发出且只发出一次 `host-1` 的 `ChatTurnCancelled`。
- 同文件新增 `abort between turn/start and turn/started interrupts the app turn once it starts`：读到 `turn/start` 请求后调用 `abort`，再回复 `turn/start`，然后直接调用 `_handleTurnStartedNotification` 送入 app turn 为 `app-1` 的 `turn/started`（测试对端只转发 `item/tool/call`，推送的通知不会被处理；`turn` 用完整形状，`createAgent` 照 `persists the app-server turn id for restored turn metadata` 带 `sessionStore`，绑定时要写回合映射）；断言 `abort` 之后、`turn/started` 之前已记下这一回合，`turn/started` 之后的下一条出站请求是 `turn/interrupt`，参数为该线程与 `app-1`。
- 同文件新增交错用例：`host-1` 在途时 `abort`，随后发起 `host-2` 且不取消，断言没有 `host-1` 的 `turn/start`、`host-2` 的 `turn/start` 照常发出，取消信号只有 `host-1`；另一变体是 `host-1` 在途时 `abort`、`host-2` 在途时再 `abort`，两次都不发 `turn/start`。
- 同文件新增首次发送用例：会话尚未物化，`sendMessage` 等在 `thread/start` 上时调用 `abort`，再回复 `thread/start`，断言没有 `turn/start`。
- 同文件新增压缩分支用例：`/compact` 发送在认领前被 `abort`，断言没有 `thread/compact/start`。
- 同文件新增 `a send abandoned after its chat was torn down settles without reporting the turn`：在认领前最后一个同步步骤 `_turnStartOptions` 返回后依次 `abort`、拆除会话（`_ensureCurrentLaunchBeforeTurn` 会对已拆除的会话先抛 `CancellationError`，所以拆除要落在它之后），断言 `sendMessage` 正常完成、没有取消信号，且发出了 `thread/unsubscribe`。
- 同文件新增收口断言：上述各场景结束后、以及物化失败的提前返回之后，未认领集合为空。
- 运行顺序：先 `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`）；再跑 `scripts/test.sh --run src/vs/platform/agentHost/test/node/codex/codexCreateChat.test.ts`，确认新增用例与 `a late app-server turn notification does not take over the current turn`、`turn completion, abort and steering cancel parked approvals` 都通过；最后跑 `npm run eslint`。

## 实施与登记步骤

1. 实施前对照当时的 HEAD 按符号重新定位；审查之后工作区仍在变，本稿行号只作参考。三条都只动 `src/vs/platform/agentHost/` 及其测试，不需要等别的会话先提交。
2. r02-1 可以单独先落，审查认可按稿实施。r02-2 可以分两次提交：同一条命令里的换目录识别（改法第 1–3 步）一次；终端提示符确认与自定义终端工具的产出方字段（改法第 4–9 步）一次，后者要连同 `IAgentHostTerminalManager` 的四个实现一起改。r02-3 独立提交。
3. 每次提交前按顺序跑：`npm run compile`（只改 TypeScript 时可用 `npm run compile-client`）；各条「本地验证」列出的 `scripts/test.sh --run <文件>`；`npm run eslint`。
4. 提交时把本方案登记进 `dev/plans/INDEX.md`。
5. 提交时在 `dev/progress/deferred-gaps.md` 登记两条缺口，编号按表内下一个号分配，列按该表的 ID、Priority、Gap、Why Deferred、Exit Condition、Track、Status 填写：
   - SDK 内置 shell 跨调用保留目录。Gap：默认配置（自定义终端工具关闭）下，上一条命令 `cd` 到别处、下一条命令写相对路径时，宿主仍按主工作目录求值并可能自动批准；证据同判定表 r02-2 一行。Why Deferred：宿主看不到 SDK shell 的当前目录，修法要么请 SDK 报告当前目录，要么对 SDK shell 的相对目的地一律要求确认（会改变上游 Agents 窗口的体验），需要先裁决。Exit Condition：选定修法，并在 `sessionPermissions.test.ts` 与 `copilotAgentSession.test.ts` 有断言锁定。建议 Priority P2，Track 为 agentHost shell 自动批准，Status open。
   - `write_${shellType}` 免确认即可执行命令。Gap：自定义终端工具开启时，`write_${shellType}`（`copilotShellTools.ts` 573–594 行）不经确认，文本里的换行被 `formatTerminalText`（`agentHostTerminalManager.ts` 110 行）换成回车，等于无确认执行任意命令，也能在提示符后预先键入半条命令。Why Deferred：现行是照 SDK 内置 helper 的有意设计，由 `shell helper tools (read/write/shutdown/list/redirect) are registered with skipPermission: true` 锁定，收紧会影响交互式 shell 流程，需要先裁决。Exit Condition：裁决记录（保持并写明风险，或把会执行的输入改为走确认）及对应测试。建议 Priority P2，Track 为 agentHost 自定义终端工具，Status open。
6. 文档改动后跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。

## 可达性核对

三条都在 agentHost 进程里。默认编辑器窗口会拉起这个进程：`AgentHostEnablementService` 只在 Web 或 `chat.disableAIFeatures` 为真时关闭（`src/vs/platform/agentHost/browser/agentHostEnablementService.ts` 31–32 行），`AgentHostPrewarmContribution` 在默认窗预热（`src/vs/workbench/services/agentHost/electron-browser/agentHostService.ts` 86–118 行）。`AgentHostContribution` 在两种窗口都按 rootState 注册 `agent-host-<provider>` 会话类型，Copilot CLI 与 Claude 默认在列，Codex 不在（见 r02-3 一行）。

默认编辑器窗口没有向这些会话发消息的入口：

- Chat 视图只在 Agents 窗口注册，`when` 含 `IsSessionsWindowContext`（`src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts` 59–60 行）。
- 打开 Chat 的命令前置条件含 `IsSessionsWindowContext`，执行时在默认窗直接聚焦 Conversation（`src/vs/workbench/contrib/chat/browser/actions/chatActions.ts` 222–226、233–236 行）。
- `openChatSessionWithPrompt` 与 `openChatSession` 在默认窗短路到 Conversation（`src/vs/workbench/contrib/chat/browser/chatSessions/chatSessions.contribution.ts` 1713–1719、1749–1757 行）。
- 编辑器内联聊天的启动条件含 `IsSessionsWindowContext`（`src/vs/workbench/contrib/inlineChat/browser/inlineChatActions.ts` 50–54 行）；即便存在内联会话，`getAutoApproval` 对 `editorInline` 表面的 shell 请求一律要求确认（`sessionPermissions.ts` 288–301 行）。
- 产品 Conversation 不引用 agentHost，文档也禁止用 AHP 实现它（`docs/systems/conversation/stub-and-fixtures.md` 147 行）。Conversation 的分叉只在宿主里复制会话，打开的是产品自己的 `ConversationChatInput`（`src/vs/workbench/contrib/conversation/browser/conversationSessionChatService.ts` 603–637 行），不执行回合。

仍然可达的路径：Agents 窗口（`--agents`，只作上游对照）；Agents 窗口创建的定时自动化，客户端里只有 `src/vs/sessions/contrib/providers/agentHost/browser/agentHostAutomationStore.ts` 发出 `AutomationCreateRequested`，定时触发在 `agentHostAutomationService.ts` 466–474、535–568 行，默认窗预热起来的宿主进程同样会跑；接入同一宿主的远端或 WebSocket 客户端。

会话级自动批准不是这三条的前提：会话等级 `autoApprove` 与 `chat.tools.global.autoApprove`（默认 false，`chat.shared.contribution.ts` 752–753 行）都不参与；r02-1、r02-2 走默认等级下的终端规则，r02-3 走 Codex 自己的审批策略。Claude 的 shell 请求不带 `shellLanguage`（只有 `copilotAgentSession.ts` 3480–3486 行填写），在 `sessionPermissions.ts` 331–334 行直接要求确认，所以 r02-1、r02-2 只影响 Copilot 会话。

## 语法树核对记录

下面的形状来自只读的 `node -e`：加载 `@vscode/tree-sitter-wasm` 0.3.1 的 `tree-sitter-bash.wasm` 与 `tree-sitter-powershell.wasm`，用与 `_extractSubCommands` 相同的查询解析示例命令，没有执行命令，也没有写文件。

- `echo hi >& /home/u/.bashrc`：`file_redirect` 文本为 `>& /home/u/.bashrc`，子节点为 `>&` 和 `word`，`destination` 为 `/home/u/.bashrc`。现行正则捕获到 `& /home/u/.bashrc`，以 `/home/u/proj` 为工作目录时 `path.resolve` 得到 `/home/u/proj/& /home/u/.bashrc`。不带空格的 `>&/home/u/.bashrc` 同理。
- `echo hi >&2` 与 `echo hi 2>&1`：`destination` 是 `number` 节点。`echo hi >&-` 与 `echo hi 2>&-`：只有运算符 `>&-`，没有 `destination`。`echo hi >& -`：`destination` 是文本为 `-` 的 `word`。
- `echo data 1<>/etc/passwd`：根节点有错误，`file_redirect` 子节点为 `file_descriptor`、`<`、`ERROR`、`word`。`echo data <>/tmp/file` 的 `file_redirect` 文本为 `>/tmp/file`。
- `cd /home/u && echo hi > .bashrc`：`command` 捕获为 `cd /home/u` 与 `echo hi`，`file_redirect` 为 `> .bashrc`，`destination` 为 `.bashrc`。
- `echo hi > a b`：`destination` 有两个 `word`（`a` 与 `b`）。
- `echo hi >!APPDATA!\outside.txt`、`echo id > '/tmp/fake-home/.bashrc'`、`echo hello > '/dev/null'`：`destination` 的文本与现行正则的捕获一致，引号形式为 `raw_string`，仍需剥引号。
- PowerShell 的 `cd..; Write-Host hi >out.txt`：`command` 捕获为 `cd..` 与 `Write-Host hi >out.txt`，重定向是 `generic_token` 的 `>out.txt`。`cd\; Write-Host hi > out.txt` 的第一个 `command` 为 `cd\`，`CD ..; …` 的为 `CD ..`。三者都命中 `^cd\b`（不分大小写）。

## 审查

2026-11-07 只读审查（[DOCUMENTATION.md 规则 16](../../docs/DOCUMENTATION.md)）的结论是须改稿，r02-1 可按稿实施；本轮逐条对照工作区现码核实后改稿，判定表的判定与严重度不变，r02-2 只改写了降级理由。Critical 已改：C1 属实，超时只结束等待、不中止命令，终端随即回到空闲池，而目录只在 `633;D` 之后的 `633;P;Cwd` 才更新，原稿按「空闲且记录的目录相同」判定会被「超时 50 毫秒跑 `cd /home/u && sleep 5`，再写相对路径」绕过；现在 r02-2 只认停在干净提示符、且上一条命令结束后已收到目录报告的终端，因超时、后台、alt buffer 释放的终端在下一次提示符之前不合格，执行时找不到合格终端就不执行，并补了终端管理器与 `copilotShellTools.test.ts` 的用例。Important 已改：I1 属实，换目录识别改成与允许规则同口径的前缀匹配，名字不完全相等的 `cd..`、`cd\` 记为未知目标，补 bash 与 PowerShell 用例；I2 属实，SDK 内置 shell 是默认路径且很可能长驻，已改写 r02-2 的降级理由，SDK shell 跨命令那一半写成 deferred-gaps 登记步骤，本轮不改该表；I3 属实，`write_${shellType}` 已在「明确不改什么」点名，最后一条不变量收窄到主 shell 工具，另立登记步骤；I4 属实，r02-3 改成每次发送一个取消源，`_abort` 取消所有未认领的发送，已认领未绑定的回合按 turn 记进集合，补交错用例；I5 属实，标记明确放在 `threadId` 与连接检查之前，补首次发送物化窗口用例。Minor 都已顺手改：`pushd` 用例先配 `{ pushd: true, echo: true }`；两条不带谓词的 `>&` 断言修前也成立，改标为回归护栏，区分靠谓词收到的字符串、`>&-` 类的批准结果和 `sessionPermissions` 级断言；含绝对路径的用例照 745–748 行跳过 Windows；`_resolveCwd` 回落到 `$HOME` 由「首个提示符确认目录」覆盖；`copilotAgentSession.test.ts` 775、961 行夹具不带 ShellManager，新用例改用替身；`childrenForFieldName` 的结果先滤掉 `null`；补压缩分支用例，三处提前返回用外层 `finally` 收口；`agentService.ts` 写全为 `src/vs/platform/agentHost/common/agentService.ts`。共性问题也已处理：本地验证改成先编译、再跑 `scripts/test.sh`、最后跑 eslint，文档改动跑 docs-health；「覆盖需求」写明不对应任何 PRD 的原因；实施步骤写明提交时登记 `dev/plans/INDEX.md`。

## 实施记录（2026-11-07）

按用户「不编译」的要求实施，基于 HEAD `841ea38816d` 和当时的工作区。没有编译，没有跑任何测试，也没有跑 eslint 和 docs-health。`commandAutoApprover.ts` 与 `commandAutoApprover.test.ts` 里已有 r04 的未提交改动（后备表 sed 段的拒绝规则，git、sort、sed、PowerShell 用例），本次只在它们之外的位置增改，没有动 r04 的内容；提交时这两个文件要和 r04 的改动一起看，谁先提交都要保留对方的改动。三条都只动 `src/vs/platform/agentHost/` 及其测试，此外不依赖别的会话。

r02-1，已实施。

- `src/vs/platform/agentHost/node/commandAutoApprover.ts`：新增 `getBashFileRedirectWriteDestinations`，按语法树的运算符子节点和 `destination` 字段判定 bash `file_redirect`（`childrenForFieldName` 的 `null` 先滤掉），`_extractSubCommands` 的 `file_redirect` 分支改调它；PowerShell 的 `redirection` 与 `generic_token` 仍走 `classifyFileRedirect`，并把它的注释改准。新增的 `stripMatchingQuotes` 只给新函数用，`classifyFileRedirect` 原有的剥引号代码没动。
- 测试：`commandAutoApprover.test.ts` 新增 `treats >& with a file word as a write to that file`、`treats >& descriptor duplication and closing as safe`；`sessionPermissions.test.ts` 新增 `checks a >& redirect against its file destination`（跳过 Windows）。
- 与方案无出入。

r02-2，已实施。

- `commandAutoApprover.ts`：新增 `getDirectoryChangeTarget`（bash 与 PowerShell 两条前缀正则、名字不完全相等记 `undefined`）和公开方法 `getDirectoryChangeTargets`，`_extractSubCommands` 的返回值多一项 `directoryChanges`。
- `src/vs/platform/agentHost/common/commandLineHelpers.ts`：`sameDirectory` 改为导出，行为不变。
- `src/vs/platform/agentHost/node/sessionPermissions.ts`：`IToolApprovalEvent` 加 `shellStartsInPrimaryWorkingDirectory`；新增 `_areRelativeShellWriteDestsAllowed`；`_isShellWriteDestApproved` 与 `_resolveShellRedirectResource` 多一个参数，不允许相对目的地时对相对路径返回未批准；`getAutoApproval` 的 shell 分支只在有写目的地时才计算这一判定，`isAutoApproveRuleResolvable` 用同一判定；原 570–571 行的注释已改。
- `src/vs/platform/agentHost/common/agent.ts` 的 `IAgentToolPendingConfirmationSignal` 加同名字段；`src/vs/platform/agentHost/node/agentSideEffects.ts` 的 `_handleToolReady` 透传。
- `src/vs/platform/agentHost/node/agentHostTerminalManager.ts`：`ICommandTracker` 加 `promptSinceCommand`、`cwdSinceCommand`、`inputSinceCommandStart`；`_handleOsc633Event` 新增 `PromptStart` 分支，没有进行中命令时只置 `promptSinceCommand`；`CommandExecuted` 开头清三个标记，`CommandFinished` 开头只清前两个（都在触发完成事件之前）；`Cwd` 属性置 `cwdSinceCommand`；`writeInput` 置 `inputSinceCommandStart`；接口与实现新增 `getPromptConfirmedCwd`。三个测试替身（`testAgentHostTerminalManager.ts`、`copilotShellTools.test.ts`、`copilotAgent.test.ts` 里的 `TestAgentHostTerminalManager`）同步加了这个方法。
- `src/vs/platform/agentHost/node/copilot/copilotShellTools.ts`：`ShellManager` 新增 `checkStartsInWorkingDirectory`、`forgetWorkingDirectoryStart`、`acquireShellForToolCall` 和私有的 `_findShellAtWorkingDirectoryPrompt`，处置时清空记录；主 shell 工具的 handler 改调 `acquireShellForToolCall`，拿不到终端时返回错误码为 `shell_unavailable` 的失败结果，不调用 `sendText`。
- `src/vs/platform/agentHost/node/copilot/copilotAgentSession.ts`：只对自定义 shell 工具、不要求托管审批、不请求越出沙箱且命令含 `>` 的请求调用查询并写进信号，没有 ShellManager 时报 `false`；权限结果不是 `approve-once` 时撤销记录。
- 测试：`sessionPermissions.test.ts` 新增 `requires confirmation for a relative redirect after the command changes directory`（跳过 Windows，`pushd` 先配规则）和 `requires confirmation for a relative redirect when the producer reports another start directory`；`commandAutoApprover.test.ts` 新增 `getDirectoryChangeTargets` 套件两条；`agentHostTerminalManager.test.ts` 新增 `getPromptConfirmedCwd reports the cwd only at a clean prompt after a cwd report`；`copilotShellTools.test.ts` 新增 `checkStartsInWorkingDirectory only accepts an idle shell at a confirmed working-directory prompt`、`primary shell tool runs an approved command only in a shell still at the working-directory prompt` 和 `primary shell tool runs parallel commands without a start requirement in separate shells`；`agentSideEffects.test.ts` 新增 `tool_ready forwards the shell start-directory fact into shell approval`（跳过 Windows，为此导入 `isWindows`）；`copilotAgentSession.test.ts` 新增 `custom shell permissions with a write redirect report whether the shell starts in the working directory; other permissions do not` 和 `custom shell permissions with a write redirect report false without a shell manager`，并给夹具 `createAgentSession` 加了可选的 `shellManager`，两处原来写死的 `shellManager: undefined` 改为透传。
- 与方案的出入：改法第 7 步写的是让 `getOrCreateShell` 对记下的 toolCallId 返回空结果；实际放进新方法 `acquireShellForToolCall`，`getOrCreateShell` 的签名和行为不变，因为它有多处既有调用方和测试，改返回类型会牵连它们。效果与方案相同。

r02-3，已实施。

- `src/vs/platform/agentHost/node/codex/codexAgent.ts`：`ICodexSession` 加 `unclaimedSendCancellations` 与 `cancelledUnboundHostTurnIds`，三处构造初始化；`_sendMessage` 在第一个 await 之前算出 `effectiveTurnId`、登记本次发送的取消源；新增 `_mayClaimTurn`，compact 与普通两处认领之前核对，放弃时若会话未拆除且已绑定 chat，补发本回合 `duration` 为 0 的 `ChatTurnCancelled`；`_abort` 在 `threadId` 与连接检查之前取消所有未认领的发送，并把已认领未绑定的回合记进集合；发 `turn/interrupt` 的代码抽成 `_interruptAppTurn`；`_handleTurnStartedNotification` 在绑定后对已取消的回合补发中断；回合完成、断线、发送出错三处清理标记。
- 测试：`codexCreateChat.test.ts` 新增本套件内的辅助函数 `recordOutboundMethods` 与 `recordCancelledTurnIds`，以及七条用例：`abort before turn/start keeps the cancelled prompt from reaching the app-server`、`abort between turn/start and turn/started interrupts the app turn once it starts`、`abort cancels a send that has not claimed its turn but not a send started after it`、`each abort cancels the sends in flight when it lands`、`abort during first-send materialization keeps the prompt from reaching the app-server`、`abort before compaction starts keeps thread/compact/start from being sent`、`a send abandoned after its chat was torn down settles without reporting the turn`。
- 与方案的出入：改法第 1 步的「外层 `try/finally`」实现为把原 `_sendMessage` 的主体原样挪进新方法 `_sendMessageInSession`，外层 `_sendMessage` 只负责登记取消源并在 `finally` 撤销，三处提前返回都在内层，效果相同，避免整段改缩进。改法第 6 步的「会话处置时清空两个集合」没有单独写：两个集合挂在会话对象上，会话移除后随对象丢弃，在途发送的 `finally` 会撤销自己的取消源。本地验证里「物化失败的提前返回之后未认领集合为空」没有单写用例，由外层 `finally` 在结构上保证；其余场景都断言了集合为空。

没做的部分：方案「实施与登记步骤」第 4、5 步（登记 `dev/plans/INDEX.md`，在 `dev/progress/deferred-gaps.md` 登记 SDK 内置 shell 跨调用保留目录、`write_${shellType}` 免确认两条缺口）按本轮分工由父 agent 统一写，本次没有改这两个文件。

之后要跑的本地验证：

1. `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`），`scripts/test.sh` 加载的是 `out/` 下的编译产物。
2. 逐个跑：`scripts/test.sh --run src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts`、`sessionPermissions.test.ts`、`agentHostTerminalManager.test.ts`、`copilotShellTools.test.ts`、`agentSideEffects.test.ts`、`copilotAgentSession.test.ts`、`copilotAgent.test.ts`、`codex/codexCreateChat.test.ts`（都在 `src/vs/platform/agentHost/test/node/` 下），以及 `src/vs/platform/agentHost/test/common/commandLineHelpers.test.ts`。
3. `npm run eslint`。
4. 登记 INDEX 与 deferred-gaps 之后跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。

代码审查（2026-11-07）。结论是须修改；逐条对照代码核实，处理如下，仍未编译、未跑测试。

- C1：属实（测试对端只转发 `item/tool/call`，推送的 `turn/started` 被丢弃，不带 `sessionStore` 时绑定回合还会在写回合映射处抛错），已照 `persists the app-server turn id for restored turn metadata` 给 `createAgent` 传 `createTestSessionStore()`，改为直接调用 `_handleTurnStartedNotification` 并补全 `turn` 的 `itemsView`、`completedAt`、`durationMs`。
- I1：属实（bash 的 PS1 嵌着 `633;A`，readline 重绘提示符会再发 `A` 却不清已键入的文本），已改为 `PromptStart` 不清输入标记，并取更严的做法只在 `CommandExecuted` 清、`CommandFinished` 也不清，字段改名 `inputSinceCommandStart`，用例第 4 个期望值改为 `undefined` 并补了「命令运行期间键入」与「下一条命令之后恢复」两段，r02-2 改法第 5 步同步。
- I2：属实（查询为真就登记，没有重定向的并行调用会失败），已改为只在自定义 shell 工具、不要求托管审批、不请求越出沙箱且命令含 `>` 时查询并登记，`copilotAgentSession.test.ts` 的用例改名为 `custom shell permissions with a write redirect report whether the shell starts in the working directory; other permissions do not` 并补无重定向、托管审批两种请求，`copilotShellTools.test.ts` 新增 `primary shell tool runs parallel commands without a start requirement in separate shells`，r02-2 不变量与改法第 7、8 步同步并写明「需要人工确认的含 `>` 命令仍会登记」这一残留。
- I3：属实（`abort` 不带 turn id，迟到的取消可能放弃宿主仍在进行的回合，而原实现放弃时什么也不报），已改为 `_mayClaimTurn` 放弃时补发本回合 `duration` 为 0 的 `ChatTurnCancelled`、不动计时，两条既有用例借新辅助函数 `recordCancelledTurnIds` 断言了这一信号，r02-3 不变量与改法第 4、8 步同步。
- M1：记录不改，客户端发来的 xterm 应答与焦点事件被记成输入只会让终端少合格，无头终端自己的光标位置应答直接写 pty、不经 `writeInput`。
- M2：记录不改，`sameDirectory` 按字符串比较，经符号链接进入的工作目录比不上时只是多要一次确认。
- M3：记录不改，批准后没被执行的 toolCallId 留在 `ShellManager` 的登记集合里直到会话处置，等不到 `turn/started` 的已取消回合留到回合完成、断线或发送出错时清理，都不影响判定。
- M4：属实，替身终端管理器不模拟超时后的状态，那一步测到的只是「空闲终端没有提示符确认的目录」，注释已改成这句话。

复审结论可接受，剩下三条 Minor 都已处理：`_mayClaimTurn` 改为只在会话未拆除且已绑定 chat 时补发取消信号，并补用例 `a send abandoned after its chat was torn down settles without reporting the turn`；实施记录 r02-2、r02-3 两段改成与现码一致；含 `>` 的自定义 shell 工具请求在没有 ShellManager 时改报 `false`，并补用例 `custom shell permissions with a write redirect report false without a shell manager`。
