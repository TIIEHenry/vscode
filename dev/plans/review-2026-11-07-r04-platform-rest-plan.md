---
title: "十六路审查 2026-11-07 r04：platform 其余方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 1、weaken 3、drop 0，已按 2026-11-07 只读审查改稿。git、sed、sort 自动批准缺口只在 Agents 窗口可达，降为中：git 先 cherry-pick 上游 289549a85cd、8c77f19795e 再补本地拒绝规则；sed 解析器识别缩写、引号与续行，并补 --expression、--file 缩写的拒绝规则；sort 补 --output 与合并短选项。子进程监视器与 Windows shell 探测恢复上游的裸调用。同日已实施（未编译、未跑测试），代码审查经一轮修改后可接受。"
---

# 十六路审查 2026-11-07 r04：platform 其余方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无。r04-1 至 r04-3 是 VS Code 聊天终端工具与 agentHost 的命令自动批准规则，只在 Agents 窗口可达；产品里工具与写入请求的批准走引擎权限座位（`docs/product/requirements.md` 第 63 行 PRD-004、第 436 行 PRD-026.3），不读这些规则。r04-4 是 pty host 内部的错误处理；产品需求只在 PRD-027（第 441、450 行）规定终端放在哪里，本条不改变其中任何可观察陈述。

四条都成立，全部进方案。生产改动是 `src/vs/platform/terminal/` 下五个文件（`gitAutoApproveRules.ts`、`sedFileWriteParser.ts`、`sortAutoApproveRules.ts`、`childProcessMonitor.ts`、`windowsShellHelper.ts`），git 部分先 cherry-pick 上游两条提交；r04-2 另在工作台默认表和 agentHost 后备表的 sed 段各加两条拒绝规则。其余只改测试，要登记的文档写在「实施前提与提交步骤」里。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r04-1 | weaken | 高→中 | 成立，行号未漂移。本机 git 2.34.1 在非仓库目录用 `--no-index` 复现：`-O<命令>`、`-iO<命令>`、`--open-files-in-pager=<命令>`、`--op=<命令>` 都经 shell 执行；`git diff --output=/dev/null` 让标准输出为空；手册写明 `-f` 即 `--force`、`-C` 是 `--copy --force`。降级理由是产品默认窗口没有调用方，只在 Agents 窗口可达，见「r04-1 至 r04-3 的可达性」。上游 `main`（本地抓取到 2026-09-19）已有 `8c77f19795e`（git grep 的 pager 选项要确认）和 `289549a85cd`（PowerShell 下 `-C` 区分大小写，否则 `git -c core.pager=… log` 会被当成 `-C` 放行，本地规则在 PowerShell 下已复现放行），本地 HEAD 都没有，缺陷在本地仍成立。上游的 grep 规则还漏三类写法：选项前带引号或反斜杠（发现稿自己的复现写法 `'--open-files-in-pager=…'` 就在其中）、`-pO`、`-WO`、`-rO`、`-3O` 这类合并写法、写在续行之后的参数。核查时另外复现：`git branch` 的合并短选项（`-rd`、`-vD`）、`--move`、缩写 `--del`、`--mo`、`--forc`，以及带引号、反斜杠或续行的 `--output`，都只命中放行，一并纳入。 |
| r04-2 | weaken | 高→中 | 成立，行号未漂移。sed 4.8 对 `/dev/null` 执行 `--i`、`--in`、`--in-plac`、`--in=.bak` 都报「无法编辑：非普通文件」，即按就地编辑处理；按第 27 行求值，这些写法的 `canHandle` 都为 false。上游 `main` 没有改过 `sedFileWriteParser.ts` 和相关 sed 规则。可达性与 r04-1 相同。核查时另外复现：`"--in-place"`、`-"i"`、`\-i` 以及把选项拆在续行两侧的写法同样不被识别；`sed --expr='1e …'`、`sed -n"e"'1e …'`、`sed \-e '1e …'` 都会执行 `e` 命令，却不被工作台默认表第 317 行和 agentHost 后备表第 693 行拒绝，一并纳入。 |
| r04-3 | weaken | 高→中 | `--output` 部分成立，行号未漂移。sort 8.32 下 `--output=/dev/null`、`--o=/dev/null`、`--output /dev/null` 都让标准输出为空；上游 `main` 没有改过 `sortAutoApproveRules.ts`。另复现 `-ofoo`、`-ro <文件>`、`-uo<文件>` 和带引号的 `--output` 同样只命中放行，一并纳入。可达性与 r04-1 相同。发现稿方向里「`--buffer-size` 也补上拒绝」不实施：`commandLineAutoApprover.test.ts` 的 `auto-approves benign forms` 与 `src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts` 的 `handles sort with blocked args` 都要求 `sort --buffer-size=1K input.txt` 自动批准。 |
| r04-4 | hold | 中 | 见下文。默认窗口的集成终端每输入一次都会走到。 |

### r04-1 至 r04-3 的可达性

产品默认窗口里没有会用到这些规则的调用方。Conversation 与引擎接入不经工具服务、终端工具或 agentHost：在 `src/vs/workbench/contrib/conversation`、`src/vs/workbench/browser/parts/conversation`、`src/vs/platform/universeAgent` 里检索 `ILanguageModelToolsService`、`RunInTerminal`、`run_in_terminal`、`CommandLineAutoApprover`、`CommandAutoApprover`、`agentHost/` 都没有结果。默认 Code 产品路径不使用 `ChatWidget` 与 `ChatEditor`（`dev/plans/m5-ui-shell-hardening.md` 第 40 行，`docs/systems/conversation/composer-and-inbox.md` 第 98 行）；终端内联聊天等入口在默认窗口经 `IsSessionsWindowContext` 隐藏（`docs/systems/chat/overview.md` 第 110 行）；让 agentHost 承接终端聊天和编辑器内联聊天的两个设置默认关闭（`src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts` 第 2376–2393 行）。产品愿景把当前范围定为无引擎默认窗产品壳，并且不接扩展市场（`docs/product/vision.md` 第 7、64 行）。

在 Agents 窗口里有两个使用方，门槛不同。工作台的 `RunInTerminalTool` 要求 `chat.tools.terminal.enableAutoApprove` 为 true（默认 true，`src/vs/workbench/contrib/terminalContrib/chatAgentTools/common/terminalChatAgentToolsConfiguration.ts` 第 88–92 行），还要求用户在终端工具确认卡里点过「Enable Auto Approve...」并在警告框里同意（`chatTerminalToolConfirmationSubPart.ts` 第 125–131 行、第 344–347 行；`terminalToolAutoApprove.ts` 第 75–85 行；`runInTerminalTool.ts` 第 1152 行、第 1204–1209 行）。agentHost 的 shell 权限判断只看转发来的 `terminalAutoApproveEnabled` 不为 false（`src/vs/platform/agentHost/node/sessionPermissions.ts` 第 335–337 行，`src/vs/platform/agentHost/browser/agentHostProtocolClient.ts` 第 1807 行），默认开启，也不需要接受警告。两边展开的是同一批平台规则，改平台文件一次就覆盖两边。

### 上游文件与 ADR-007

`gitAutoApproveRules.ts`、`sedFileWriteParser.ts`、`sortAutoApproveRules.ts` 和工作台的 `terminalChatAgentToolsConfiguration.ts` 相对上游快照 `004a1fbb` 没有任何改动，相关提交都在快照之前，是纯上游文件。agentHost 的 `commandAutoApprover.ts` 已有本地改动（+42/−3，不碰 sed 规则）。`childProcessMonitor.ts`、`windowsShellHelper.ts` 的本地改动来自 D720 的 `cbef98ce350` 和之后的 `ac1cab8367f`、`647d0dfd522`。`dev/progress/upstream-min-patch.md` 目前没有列这些文件中的任何一个。

依据是 ADR-007（`dev/decisions/007-upstream-sync.md`）：上游文件上的 diff 是要解释的负债；不能迁回自定义树的补丁降为清单上的一条 hook，并写收缩条件（第 86 行）；A 表只减不无故增，新增要写明依据，即已签收方案或 ADR（第 78 行）；安全修复用 cherry-pick（第 148 行）。这些修补没法迁回自定义树：规则表由上游工作台配置（第 224、330 行）和 agentHost（第 651、705 行）直接展开，sed 解析器由上游 `TreeSitterCommandParser`（`treeSitterCommandParser.ts` 第 72–74 行）和 agentHost（第 178 行）直接实例化，自定义树里没有替换它们的贡献点。所以本方案对上游已修的部分（git grep 的 pager 选项、PowerShell 下的 `-C`）cherry-pick 上游提交原样吸收；其余规则只新增条目，不改上游原有的行；`sedFileWriteParser.ts` 必须就地改函数；r04-4 让三处调用和一条 import 回到上游原文，diff 变小。

`upstream-min-patch.md` 的记法（实施提交时写）：A 表新增小节「终端命令自动批准的上游安全修补」，字段照现有小节。为何留 hook 写上一段的理由；ADR / 方案写 ADR-007 与本方案；收缩条件写「cherry-pick 的两条在合入含 `289549a85cd`、`8c77f19795e` 的上游 tag 后自然消失；本地新增的规则与 `sedFileWriteParser.ts` 的改动在上游发布同类修复后删除，合并时以上游为准」；路径列本方案改到的全部生产与测试文件，包括本来就有本地改动、清单里还没有的 agentHost `commandAutoApprover.ts`。`childProcessMonitor.ts`、`windowsShellHelper.ts` 已有的本地改动在同一提交补一行，收缩条件写「上游接受同类守卫后删除」。

### 规则写法的共同约定

适用于 r04-1、r04-3 的新规则和 r04-2 的两条 sed 拒绝规则：

- 只新增条目，不改上游原有的行，合入上游 tag 时冲突最小。
- 容忍串写作 `(?:\$?['"]|\\\r?\n|\\)*`：选项前、两个连字符之间、选项字母之间都允许出现引号、紧挨引号的 `$`、反斜杠或续行（反斜杠加可选的 `\r` 加换行）。
- 命令或子命令与选项之间用 `[\s\S]*`，不用 `.*`。用 `@vscode/tree-sitter-wasm` 只读解析可知，`find . \`、换行、`  -name x \`、换行、`  -delete` 是同一个 `command` 节点，节点文本原样保留续行和换行；`.` 不匹配换行，`.*\s-` 最多跨过一个换行，所以选项落在第三行时现有规则就失效（上游 `find` 的 `-delete` 拒绝规则对这条命令也放行）。
- 选项字母放进 `(?-i:…)`。PowerShell 下规则不分大小写（工作台 `commandLineAutoApprover.ts` 第 233 行，agentHost `commandAutoApprover.ts` 第 391 行），上游 `289549a85cd` 已用 `(?-i:C)` 处理同类问题；`.npmrc` 的 Electron 42.10.0 与 `remote/.npmrc` 的 Node 24.18.1 都支持正则修饰符，本机 Node 26 实测 `(?-i:C)` 在 `i` 标志下仍区分 `-C` 与 `-c`。
- 以 `^sort\b` 开头的新规则加 `(?!-)`，与第 10 行的放行规则一致，不碰 `Sort-Object …`。
- 不覆盖的写法有两类：选项文本里的变量展开、花括号展开和 ANSI-C 转义（如 `sort --{o,}utput=<文件>`、`sort --$'\x6f'utput=<文件>`、`sed --in${X} …`）；本方案保留原样、仍用 `.*` 的上游行。这两类按「实施前提与提交步骤」登记缺口，方向是在匹配器和 tree-sitter 解析里统一处理，不在每条正则里补。

### r04-1

问题类：`git grep`、`git diff`、`git branch` 的放行规则靠拒绝规则挡住危险参数，拒绝规则只认个别拼写；git 接受的其它拼写直接命中放行，可以经 shell 执行任意 pager 命令、把输出写到任意文件、强制重置或覆盖已有分支。

不变量：

- 上游 `289549a85cd`、`8c77f19795e` 原样吸收；本地规则只补上游没覆盖的写法。
- `git grep` 出现 pager 选项就不自动批准：短选项 `O` 单独写、粘连值或出现在合并短选项串里（包括 `-pO`、`-WO`、`-rO`、`-3O`），从 `--op` 起的任意长参数拼写，选项前带引号或反斜杠（`'--open-files-in-pager=…'`、`"-O"`、`\-O`），以及写在续行之后的这些选项。
- `git diff`、`git log`、`git show` 带 `--output`（`=值` 或空格加值）不自动批准，包括带引号、反斜杠或续行的写法；`--output-format=…`、`--output-indicator-new=…` 仍自动批准。
- `git branch` 出现删除、改名、强制或强制复制就不自动批准：合并短选项串里有 `d`、`D`、`m`、`M`、`f`、`C` 中任一字母（包括 `-f`、`-C`、`-rd`、`-vD`、`-cf`），以及从 `--d` 起的 `--delete` 拼写、从 `--mo` 起的 `--move` 拼写、从 `--forc` 起的 `--force` 拼写。
- 合并短选项串里，带参数的短选项之后的字符是参数值，不当选项：`git grep` 的 `e`、`f`、`A`、`B`、`C`（新版 git 还有 `m`），`git branch` 的 `u`。
- PowerShell 下选项字母区分大小写：`git grep -o …`、`git branch -c <旧> <新>` 仍自动批准；`git -c <配置> …` 不命中放行（上游测试锁定）。
- 现有放行不变：`git status`、`git log --oneline`、`git diff HEAD`、`git diff main`、`git show --format=%B HEAD`、`git ls-files`、`git grep pattern`、`git grep -n -e pattern`、`git grep -C 3 -o pat`、`git branch`、`git branch -a`、`git branch -r`、`git branch -vv`、`git branch --list`、`git branch --sort -committerdate` 仍自动批准。

要动的符号：`gitAutoApproveRules` 表与其中 branch 段的注释。文件：`src/vs/platform/terminal/common/autoApprove/gitAutoApproveRules.ts`（当前第 11–31 行，cherry-pick 后行号会移动）。工作台默认表（`terminalChatAgentToolsConfiguration.ts` 第 224 行）与 agentHost（`commandAutoApprover.ts` 第 651 行）展开同一张表，不用改。

改法：

1. 按顺序 `git cherry-pick -x 289549a85cd 8c77f19795e`。它们改的 `gitAutoApproveRules.ts`、agentHost 的 `commandAutoApprover.test.ts`、工作台的 `commandLineAutoApprover.test.ts` 相对快照没有本地改动，快照到这两条提交之间上游也没改过它们，应能直接套上。`runInTerminalTool.test.ts` 本地改过（相对快照 +172/−16），上游只在 `confirmationRequiredTestCases` 的 `git show --output message.txt HEAD` 之后加三行，上下文与本地一致；若冲突，两边都保留。
2. 在上游两条 grep 拒绝规则之后加两条本地规则。前缀与上游相同（`^git(\s+(-(?-i:C)\s+\S+|--no-pager))*\s+grep\b`），之后接 `[\s\S]*\s`。短选项一条：容忍串、`-`，零个或多个「容忍串、不带参数的 grep 短选项字母（`a I i v w h H E G P F n l L q z c o p W r`）或数字」，最后是 `O`。长参数一条：容忍串、`-`、容忍串、`-`、容忍串、`o`、容忍串、`p`。字母都放进 `(?-i:…)`。上游的字母集合没有 `p`、`W`、`r` 和数字，本机已复现 `-pO`、`-WO`、`-rO`、`-3O` 都经 shell 执行 pager。
3. 在 `git show` 的 `--output` 拒绝规则之后加一条 log、show、diff 共用的规则：前缀同上，子命令写 `(?:log|show|diff)\b`，之后 `[\s\S]*\s`，接容忍串、`-`、容忍串、`-`，`output` 每两个字母之间允许容忍串，最后在可选容忍串之后接 `=`、空白或行尾；字母放进 `(?-i:…)`。只认完整拼写即可：git 2.34.1 把 `--outp`、`--o` 判为与 `--output-indicator-*` 有歧义并拒绝执行。上游第 14、16 行的 log、show 规则保留不动。
4. 在 branch 的上游拒绝规则之后加两条。短选项一条：容忍串、`-`，零个或多个「容忍串或不带参数的 branch 短选项字母（`v q t r l a i c`）」，再接 `d`、`D`、`m`、`M`、`f`、`C` 之一。长参数一条：容忍串、`-`、容忍串、`-`、容忍串，再接 `d`，或接 `m`、`o`，或接 `f`、`o`、`r`、`c`，字母之间允许容忍串。字母放进 `(?-i:…)`。按 git 2.34.1 的 `git branch -h`，以 `d` 开头的长参数只有 `--delete`；`--mo` 是 `--move` 的最短唯一缩写（`--m` 与 `--merged` 有歧义）；`--forc` 是 `--force` 的最短唯一缩写（`--fo`、`--for` 与 `--format` 有歧义）。这两条只看 `branch` 之后的文本，`git -C <路径> branch` 里的全局 `-C` 不受影响。
5. branch 段注释补一行：`-f`、`-C`、`--move` 以及合并、缩写写法同样会强制重置、覆盖或改名分支。grep 段沿用 cherry-pick 进来的上游注释。
6. 第 2–4 步的规则形状已在 node 里与上游两条提交之后的规则一起求值：上游测试里的放行、不匹配、拒绝用例，加上本条列出的拒绝与放行写法，共 73 个命令。PowerShell 方式下全部符合；bash 方式下只有 `GIT -C repo DIFF` 不同，它是上游专为 PowerShell 写的大小写用例。

明确不改什么：

- 不改上游原有的行，包括 cherry-pick 进来的两条 grep 规则和第 14、16 行的 `--output` 规则；它们在续行与展开写法上的缺口按实施步骤登记。
- 不放宽 `git` 前缀：`git -c <配置> …` 仍不命中放行，`GIT_PAGER=… git …` 仍被临时环境变量规则拒绝。
- 不改 `contributeTerminalDenialRules`（`src/vs/platform/agentHost/common/agentHostManagedSettings.ts` 第 188–205 行），它本来就跳过正则键。
- `git branch -c <旧> <新>`（不带强制的复制）、`git branch <新分支>`、`--set-upstream-to` 不在本条拒绝范围内。
- 下面两类保守误判可以接受，只会多要一次确认：`git grep -e -Ofoo` 这类以 `-O` 开头的独立模式参数；`git branch --sort -deltabase` 这类以 `d` 等字母开头、用空格分隔的排序键。
- 保持通过：cherry-pick 带来的 `keeps the Git directory option case-sensitive in PowerShell`、`requires confirmation for Git grep pager options`（agentHost）与 `keeps the Git directory option case-sensitive`、`requires confirmation for Git grep pager options`（工作台）；agentHost 的 `approves allowed git sub-commands`、`denies denied git operations`；工作台的 `should handle git patterns with -C and --no-pager`（它用自己的规则副本，不受默认表影响）；`runInTerminalTool.test.ts` 中 `default auto-approve rules` 下 `confirmation required` 组里的 `git log --output=log.txt`、`git show --format=%B --output=message.txt HEAD`、`git show --output message.txt HEAD`。

本地验证：

- 在 agentHost `commandAutoApprover.test.ts` 的 `denies denied git operations` 增加下列命令并断言为 `denied`：`git grep '--open-files-in-pager=echo X;' -e pat`、`git grep "-O" -e pat`、`git grep \-Ovi -e pat`、`git grep -pOvi -e pat`、`git grep -WOvi -e pat`、`git grep -rOvi -e pat`、`git grep -3Ovi -e pat`、在 `git grep -e pat` 之后用续行写 `-Ovi`、`git diff --output=/tmp/x HEAD`、`git diff HEAD --output /tmp/x`、`git log "--output=/tmp/x"`、`git show \--output=/tmp/x HEAD`、`git diff --` 与 `output=/tmp/x` 拆在续行两侧、`git branch -f main HEAD~1`、`git branch -C a b`、`git branch -rd origin/x`、`git branch -vD x`、`git branch --move a b`、`git branch --mo a b`、`git branch --del x`、`git branch --forc main HEAD~1`。
- 在同文件 `approves allowed git sub-commands` 增加下列命令并断言为 `approved`：`git diff --output-indicator-new=+ HEAD`、`git grep -C 3 -o pat`、`git branch -a`、`git branch -vv`、`git branch --list`、`git branch --sort -committerdate`、`git branch -c old new`。
- PowerShell：在 agentHost 同文件新增一条，用 `{ language: 'powershell' }` 断言 `git grep -o pat`、`git branch -c old new` 为 `approved`，`git branch -C a b`、`git diff --output=/tmp/x HEAD`、`git grep -iOvi -e pat` 为 `denied`；在工作台 `commandLineAutoApprover.test.ts` 的 `default PowerShell rules` 套件加同样五条。
- 在 `runInTerminalTool.test.ts` 的 `confirmationRequiredTestCases` 增加 `git grep '--open-files-in-pager=echo X;' -e pat`、`git diff --output=out.txt HEAD`、`git branch -f main HEAD~1`、`git branch -rd origin/x`。
- 先 `npm run compile-client`，再用 `scripts/test.sh --run` 分别跑 `src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/browser/commandLineAutoApprover.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/electron-browser/runInTerminalTool.test.ts`，最后跑 `npm run eslint`。

### r04-2

问题类：sed 的选项识别只认完整拼写和不带引号的写法。就地编辑的缩写、带引号或反斜杠的写法、拆在续行两侧的写法都不被 `SedFileWriteParser` 识别为写文件，工作台的工作区外写入拦截和 agentHost 的「就地编辑一律确认」因此不生效；`--expression`、`--file` 的缩写和带引号的 `-e`、`-f` 也挡不住，`e` 命令可以直接执行。

不变量（就地编辑识别）：

- `canHandle` 与 `extractFileWrites` 在切分参数之前，先对整条命令在单引号之外删去「反斜杠加可选的 `\r` 加换行」，与 shell 的续行一致。逐个参数删会漏掉反斜杠后接 CR、LF 的写法：`_tokenizeCommand`（第 49–58 行）把转义的 CR 留在参数里，又在其后的 LF 处切开。
- 判断参数是不是选项、是哪个选项时，再去掉引号、紧挨引号的 `$` 和反斜杠。
- 长参数按 GNU 规则还原：`--` 之后到 `=` 之前的名字是某个 sed 长参数的唯一前缀（完全相同优先）时，等同于那个长参数。sed 4.8 的长参数共 18 个：`binary`、`debug`、`expression`、`file`、`follow-symlinks`、`help`、`in-place`、`line-length`、`null-data`、`posix`、`quiet`、`regexp-extended`、`sandbox`、`separate`、`silent`、`unbuffered`、`version`、`zero-terminated`。只有 `in-place` 以 `i` 开头，所以 `--i` 到 `--in-place` 都是就地编辑，可以带 `=后缀`。
- `canHandle` 为真，当且仅当命令以 `sed` 加空白开头，并且有一个参数满足下面任一条件：以单个 `-` 开头、`-` 之后的连续字母里含 `i` 或 `I`（保持第 27 行第一种写法的语义，覆盖 `-ni`、`-i.bak`、`-in`）；或者还原后是 `--in-place`（含 `=后缀`）。
- `extractFileWrites` 对缩写、带引号和续行的写法返回与完整拼写相同的目标；`--expression`、`--file` 的缩写（`--e…`、`--fi…`，用 `=值` 或下一个参数传值）同样算作脚本来源，真正的文件不会被当成脚本吞掉。BSD 的 `-i ''`、`-i '.bak'` 后缀仍按原始参数判断：第 146–165 行看下一个参数是不是 `''`、`""` 或带引号的短后缀，去掉引号之后就分不出来。
- 现有结论不变：`sed "s/foo/bar/" file.txt`、`sed -n "s/foo/bar/p" file.txt`、`echo sed -i file.txt` 仍不是就地编辑；`-i ''`、`-i.bak`、多文件的提取结果不变。

不变量（拒绝规则）：

- `sed` 出现从 `--e` 起的 `--expression` 拼写或从 `--fi` 起的 `--file` 拼写（`=值` 或空格加值，带不带引号、反斜杠、续行）就不自动批准；带引号、反斜杠或续行的短选项串里出现 `e` 或 `f`（如 `-n"e"`、`\-e`）同样不自动批准。
- 现有放行不变：`default sed rules` 的 `auto-approves benign substitutions` 全部用例，以及 `sed -E "s/x/y/" file.txt`、`sed --posix "s/a/b/" file.txt`、`sed --follow-symlinks -n p file.txt`、`sed --debug -n "1p" file.txt`。
- 工作台默认表与 agentHost 后备表新增的两条完全相同。

要动的符号：`SedFileWriteParser.canHandle`（第 20–29 行）、`extractFileWrites`（第 31–34 行）、`_extractFileTargets`（第 95–209 行）、类注释（第 6–16 行），可新增三个私有辅助：删续行、去引号、还原长参数名。文件：`src/vs/platform/terminal/common/autoApprove/sedFileWriteParser.ts`。拒绝规则在两处：工作台 `src/vs/workbench/contrib/terminalContrib/chatAgentTools/common/terminalChatAgentToolsConfiguration.ts` 里 `chat.tools.terminal.autoApprove` 默认值的 sed 段（第 316–328 行），agentHost `src/vs/platform/agentHost/node/commandAutoApprover.ts` 里 `DEFAULT_TERMINAL_AUTO_APPROVE_RULES` 的 sed 段（第 691–704 行）。这两份文件不在本路的审查范围内，分属同轮 r13、r02，协调方式见实施前提。工作台 `TreeSitterCommandParser`（`treeSitterCommandParser.ts` 第 72–74 行、第 199–205 行）与 agentHost `CommandAutoApprover._matchSubCommands`（`commandAutoApprover.ts` 第 351 行）都用这个解析器类，不用改。

改法：

1. 新增删续行辅助：在单引号之外删去「反斜杠加可选的 `\r` 加换行」。`canHandle` 在 `^sed\s+` 检查之前、`extractFileWrites` 在 `_tokenizeCommand` 之前都先调用它。
2. 新增去引号辅助：删去单引号、双引号、紧挨引号之前的 `$` 和反斜杠，只用于判断选项。文件目标仍按现有第 198–204 行只剥外层引号。
3. 新增长参数还原辅助：按不变量里的 18 个名字找唯一前缀，完全相同优先；名字为空、有歧义（例如 `--f`）或找不到时返回未知，sed 本身会拒绝执行这类写法。
4. `canHandle` 保留 `^sed\s+` 检查，用 `_tokenizeCommand` 切分，对 `sed` 之后的每个参数去引号后判断：短选项串看 `i` 或 `I`；以 `--` 开头的按第 3 步还原，结果是 `in-place` 即为真。不再依赖第 27 行的正则。
5. `_extractFileTargets` 对当前参数先去引号再分类。长参数按第 3 步还原后分支：`in-place` 只跳过本参数；`expression`、`file` 带 `=` 时跳过本参数并记下已有脚本来源，不带 `=` 时连同下一个参数一起跳过并记下已有脚本来源；其余情况与现有「其它长参数」分支相同。短选项分支逻辑不变，只是看去引号后的值；BSD 后缀那段（第 146–165 行）继续看原始的下一个参数。
6. 类注释补上缩写、引号与续行写法的例子。
7. 在两张表的 sed 段、现有 `--expression`、`--file` 拒绝规则之后各加两条，内容相同，写法按「规则写法的共同约定」。长参数一条：`^sed\b[\s\S]*\s`，接容忍串、`-`、容忍串、`-`、容忍串，再接 `e`，或接 `f`、容忍串、`i`。短选项一条：`^sed\b[\s\S]*\s`，接容忍串、`-`，零个或多个「容忍串或字母」，再接 `e` 或 `f`。`e`、`f`、`i` 放进 `(?-i:…)`。规则上方加一行注释，说明 GNU sed 接受长参数的唯一缩写，shell 会去掉引号和续行。上游第 317 行与第 693 行保留不动。
8. 第 4 步的判定已用 node 对 27 个命令（含 `sedFileWriteParser.test.ts` 的全部现有用例）和 4 个续行写法求值，结果符合预期。第 7 步的两条规则已用 node 与现有 sed 规则一起求值：9 种原本放行的写法在 bash 与 PowerShell 两种方式下都被拒绝，两份测试里现有的 sed 放行与拒绝用例结果不变。

明确不改什么：

- 不改工作台 `CommandLineFileWriteAnalyzer` 对提取结果的处理（包括提不出目标时不拦截的现状），不改 `chat.tools.terminal.blockDetectedFileWrites` 的默认值 `outsideWorkspace` 和说明文字。
- 不改 agentHost 第 351 行「`canHandle` 为真即拒绝」的语义。
- 不改两张表里上游原有的 sed 规则行；它们在续行与展开写法上的缺口按实施步骤登记。
- 不新增别的命令级写文件解析器。
- 选项文本里的变量展开（`sed --in${X} …`、`sed -${X}i …`）不在本条处理，按实施步骤登记。
- 保持通过：`src/vs/platform/terminal/test/common/autoApprove/sedFileWriteParser.test.ts` 的 `detects supported in-place options`、`does not classify non-in-place commands`、`extracts in-place file targets`；`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/electron-browser/commandLineAnalyzer/commandLineFileWriteAnalyzer.test.ts` 中 `sed in-place editing` 组的全部用例（例如 `sed -i outside workspace - block`、`sed --in-place=.bak inside workspace - allow`、`sed without -i - no file write detected`）；agentHost `commandAutoApprover.test.ts` 的 `handles sed with blocked args`；`commandLineAutoApprover.test.ts` 中 `default sed rules` 的 `auto-approves benign substitutions`、`denies dangerous script forms`。

本地验证：

- `sedFileWriteParser.test.ts`：`detects supported in-place options` 增加 `sed --i "s/a/b/" f`、`sed --in "s/a/b/" f`、`sed --in-plac "s/a/b/" f`、`sed --in=.bak "s/a/b/" f`、`sed "--in-place" "s/a/b/" f`、`sed -"i" "s/a/b/" f`、`sed \-i "s/a/b/" f`、`sed --"in" "s/a/b/" f`、`sed "s/a/b/" -i f`，以及三种续行写法：`sed` 之后用续行再写 `-i`、`-` 与 `i` 拆在续行两侧、`--in` 与 `-place` 拆在续行两侧；`does not classify non-in-place commands` 增加 `sed --posix "s/a/b/" f`、`sed --debug -n "1p" f`、`sed -E "s/(i)/I/" f`、`sed -e "s/a/-i/" f`；`extracts in-place file targets` 增加 `sed --in "s/a/b/" /etc/x`、`sed --in --expr="s/a/b/" /etc/x`、`sed --in --fi=script.sed /etc/x`，三者都得到 `['/etc/x']`，原有的 `bsd` 一项仍是 `['file.txt']`。
- `commandLineFileWriteAnalyzer.test.ts` 的 `sed in-place editing` 组增加两条。`t()` 的第 4 个参数是期望的提示条数（`expectedDisclaimers`）：`t("sed --in 's/foo/bar/' /tmp/file.txt", 'outsideWorkspace', false, 1)` 与 `t("sed --in 's/foo/bar/' file.txt", 'outsideWorkspace', true, 1)`，与现有 `sed -i outside workspace - block`、`sed -i inside workspace - allow` 同形。
- agentHost `commandAutoApprover.test.ts` 的 `handles sed with blocked args` 增加下列命令并断言为 `denied`：`sed --in 's/a/b/' file.txt`、`sed "--in-place" 's/a/b/' file.txt`、在 `sed` 之后用续行再写 `-i 's/a/b/' file.txt`、`sed --e='1e id' file.txt`、`sed --expr='1e id' file.txt`、`sed --fi=script.sed file.txt`、`sed -n"e"'1e id' file.txt`、`sed \-e '1e id' file.txt`。
- 工作台 `commandLineAutoApprover.test.ts` 的 `default sed rules`：`denies dangerous script forms` 增加 `sed --e="1e id" file.txt`、`sed --expr="1e id" file.txt`、`sed --fi=script.sed file.txt`、`sed --"expr"="1e id" file.txt`、`sed -n"e" "s/a/b/" file.txt`、`sed \-e "s/a/b/" file.txt`；`auto-approves benign substitutions` 增加 `sed -E "s/x/y/" file.txt`、`sed --posix "s/a/b/" file.txt`、`sed --follow-symlinks -n p file.txt`、`sed --debug -n "1p" file.txt`。
- `runInTerminalTool.test.ts` 的 `confirmationRequiredTestCases` 增加 `sed --in "s/foo/bar/" file.txt`、`sed --expr="1e id" file.txt`。
- 先 `npm run compile-client`，再用 `scripts/test.sh --run` 分别跑 `src/vs/platform/terminal/test/common/autoApprove/sedFileWriteParser.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/electron-browser/commandLineAnalyzer/commandLineFileWriteAnalyzer.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/browser/commandLineAutoApprover.test.ts`、`src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/electron-browser/runInTerminalTool.test.ts`，最后跑 `npm run eslint`。

### r04-3

问题类：sort 的拒绝规则只认独立的 `-o`、`-S` 短选项。GNU sort 接受的 `--output` 及其缩写、`-o` 粘连字母开头的值、`-o` 出现在合并短选项串里，以及带引号、反斜杠或续行的写法，都只命中第 10 行的放行，可以覆盖或清空任意文件。

不变量：

- sort 出现输出文件选项就不自动批准：短选项串里 `o` 之前只有容忍串或不带参数的 sort 短选项字母（`b d f g h i M n R r V c C m s u z`），不论 `o` 后面是否粘连值（`-o x`、`-o/x`、`-ofoo`、`-ro x`、`-uo/x`）；从 `--o` 起的任意长参数拼写（`--o` 到 `--output`），`=值` 与空格加值都算；带引号、反斜杠、续行的写法和写在续行之后的选项同样算。
- 带参数的短选项 `k`、`t`、`S`、`T` 之后的字符是参数值：`sort -to -k1 in.txt` 以 `o` 为分隔符，`sort -t$'\t' -k2,2 in.tsv` 以制表符为分隔符，都仍自动批准。
- PowerShell 下 `Sort-Object …` 不受新规则影响（新规则以 `^sort\b(?!-)` 开头）；选项字母区分大小写，`sort -Bottom 5` 仍自动批准。剩一个已知代价：把 `sort` 当 `Sort-Object` 的别名、并用小写写 `-bottom`、`-outvariable` 时，会多要一次确认。
- 现有结论不变：`sort input.txt`、`sort --check input.txt`、`sort --check=quiet input.txt`、`sort "--check" input.txt`、`sort --buffer-size=1K input.txt`、`sort<input.txt` 仍自动批准；`-o`、`-S`、`--compress-program` 系列仍被拒绝。

要动的符号：`sortAutoApproveRules` 表（第 9–20 行），在第 14 行之后新增两条并补注释。文件：`src/vs/platform/terminal/common/autoApprove/sortAutoApproveRules.ts`。工作台默认表（第 330 行）与 agentHost（第 705 行）展开同一张表，不用改。

改法：

1. 第 14 行（独立的 `-o`、`-S`）与第 16–19 行（`--compress-program`）保留不动。
2. 在第 14 行之后加短选项一条：`^sort\b(?!-)[\s\S]*\s`，接容忍串、`-`，零个或多个「容忍串或不带参数的 sort 短选项字母」，最后是 `o`；`o` 之后不要求单词边界，`-ofoo` 也会命中。字母放进 `(?-i:…)`。
3. 再加长参数一条：`^sort\b(?!-)[\s\S]*\s`，接容忍串、`-`、容忍串、`-`、容忍串、`o`；`o` 放进 `(?-i:…)`。sort 8.32 的长参数里只有 `--output` 以 `o` 开头，`--o` 已是唯一缩写。
4. 第 12–13 行注释补一句：`-o` 可以粘连值、可以出现在合并短选项串里，`--output` 接受从 `--o` 起的缩写。
5. 两条规则已用 node 求值：两份测试里全部现有 sort 用例加上本条新增写法，共 40 个命令，在 bash 与 PowerShell 两种方式下都符合；PowerShell 下 `Sort-Object -Bottom 5`、`Sort-Object -bottom 5`、`sort -Bottom 5` 放行，`sort -bottom 5` 要确认。

明确不改什么：

- 不拒绝 `--buffer-size`，理由见判定表。`-S` 的粘连与合并写法（`-S1G`、`-uS 1G`）仍会放行，属于资源占用，不在本条。
- 第 14 行和第 16–19 行不动；它们仍用 `.*`，续行与展开写法的缺口按实施步骤登记。
- 不给 sort 加命令级写文件解析器；`treeSitterCommandParser.ts` 第 72–74 行仍只注册 sed，sort 的输出文件靠拒绝规则要求确认。
- 保持通过：`commandLineAutoApprover.test.ts` 中 `default sort rules` 的 `auto-approves benign forms`、`denies blocked options`；agentHost `commandAutoApprover.test.ts` 的 `handles sort with blocked args`；`runInTerminalTool.test.ts` 中 `confirmation required` 组的 `sort -o /etc/passwd file.txt`、`sort -S 100G file.txt`。

本地验证：

- 在 `commandLineAutoApprover.test.ts` 的 `denies blocked options` 增加：`sort --output=/etc/x in.txt`、`sort --o=/etc/x in.txt`、`sort in.txt --output /etc/x`、`sort -ofoo in.txt`、`sort -o/etc/x in.txt`、`sort -ro /etc/x in.txt`、`sort -uo/etc/x in.txt`、`sort "--output=/etc/x" in.txt`、`sort --"output"=/etc/x in.txt`、`sort \-\-output=/etc/x in.txt`、`sort --` 与 `output=/etc/x in.txt` 拆在续行两侧、在 `sort -n` 之后用续行再写 `--output=/etc/x in.txt`；在 `auto-approves benign forms` 增加 `sort -t, -k2 in.csv`、`sort -to -k1 in.txt`、`sort -rn input.txt`、`sort -t$'\t' -k2,2 in.tsv`。
- 在 agentHost `commandAutoApprover.test.ts` 的 `handles sort with blocked args` 增加同样的拒绝与放行用例。
- PowerShell：在工作台 `default PowerShell rules` 套件新增一条，断言 `Sort-Object -Bottom 5`、`Sort-Object Name -Descending`、`sort -Bottom 5` 自动批准，`sort --output=x.txt in.txt`、`sort -ro x.txt in.txt` 不自动批准；agentHost 用 `{ language: 'powershell' }` 加同样五条（后备表第 659 行展开了 PowerShell 规则，`Sort-Object` 在其中）。
- 在 `runInTerminalTool.test.ts` 的 `confirmationRequiredTestCases` 增加 `sort --output=/etc/passwd file.txt`、`sort -ro /etc/passwd file.txt`。
- 先 `npm run compile-client`，再用 `scripts/test.sh --run` 分别跑 `src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/browser/commandLineAutoApprover.test.ts`、`src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/electron-browser/runInTerminalTool.test.ts`，最后跑 `npm run eslint`。

### r04-4

问题类：`ChildProcessMonitor` 与 `WindowsShellHelper` 对套了 `@debounce` 或 `@throttle` 的方法调用 `.catch`。这两个装饰器的包装函数只排定时器、不返回值（`src/vs/base/common/decorators.ts` 第 70–86 行、第 97–127 行），而方法声明写的是 `Promise<void>`，编译器看不出运行时拿到的是 undefined，`.catch` 立即抛 TypeError。

核查结论：行号与发现稿一致，范围内文件没有未提交改动。仓库开着 `experimentalDecorators`（`src/tsconfig.base.json` 第 6 行），包装函数替换原型上的方法。输入路径是 `PtyService.input`（`ptyService.ts` 第 440–449 行）调 `PersistentTerminalProcess.input`（第 889–896 行），再调 `TerminalProcess.input`（`terminalProcess.ts` 第 485–493 行），写完 pty 后在 `handleInput()` 抛出；`traceRpc`（`ptyService.ts` 第 79–83 行）记错误后重新抛出，渲染端 `LocalPty.input`（`localPty.ts` 第 41–46 行）丢弃返回的 promise，拒绝落到 `workbench.ts` 第 99 行的 `unhandledrejection`。输出路径在 `terminalProcess.ts` 第 339 行。node-pty 1.2.0-beta.15 的 `EventEmitter2.fire` 逐个调用监听器且没有 try/catch，第 352–356 行补发 pid 的监听器在首段输出时排在抛错的主监听器之后。上游快照里这三处都是裸调用，`childProcessMonitor.ts` 也不导入 `onUnexpectedError`；本仓 `cbef98ce350` 加了双层 `.catch`，`647d0dfd522` 收成单层，对应登记是 `dev/progress/deferred-gaps.md` 第 1095 行的 D720。没有测试或文档把这个 TypeError 定为预期：扫描测试第 122–134 行只钉代码形状，前提是声明返回 `Promise`。默认窗口的集成终端每输入一次都走这条路径，所以维持中。

不变量：

- 对 `@debounce`、`@throttle` 方法的调用是裸调用，与上游一致：不接返回值，不调用 `.catch`、`.then`，也不 `await`。被装饰方法体返回的 promise 在包装函数的定时器里产生并被丢弃，调用处接不住。
- 被装饰方法体保留现有的错误处理，保证那个被丢弃的 promise 不会拒绝：`_refreshActive` 把 `listProcesses` 与状态更新包在 try/catch 里；`checkShell` 只 `await timeout(300)`（不带取消），`getShellName()` 的拒绝由 `.catch(onUnexpectedError)` 接住。
- `ChildProcessMonitor.handleInput`、`handleOutput` 不抛异常：`TerminalProcess.input`、`processBinary`、node-pty 数据回调都不会因为子进程检测而抛出，`PtyService.input` 的 RPC 不因此失败，Windows 上补发 pid 的数据监听器在第一段输出时就能运行。
- `WindowsShellHelper._startMonitoringShell` 仍是 `private async`，构造函数第 80 行对它的 `.catch(onUnexpectedError)` 保留；这是真 promise，三份扫描测试都锁着它。
- 时序与守卫不变：输入防抖 1000 ms、输出节流 5000 ms，`_refreshGeneration` 与 pid 快照比对、销毁后不写 `hasChildProcesses`；`WindowsShellHelper` 的 500 ms 防抖、300 ms 等待与 `_checkShellGeneration` 守卫。

要动的符号：`src/vs/platform/terminal/node/childProcessMonitor.ts` 的 `handleInput`（第 77–79 行）、`_refreshInactive`（第 106–109 行）和第 8 行 `onUnexpectedError` 的 import；`src/vs/platform/terminal/node/windowsShellHelper.ts` 的 `_startMonitoringShell`（第 89–94 行，只改第 93 行）；扫描测试 `src/vs/platform/terminal/test/node/platformTerminalLeftoverPromiseCatchScan.test.ts` 第 61–74 行、第 76–100 行、第 122–134 行。

改法：

1. `childProcessMonitor.ts`：`handleInput` 与 `_refreshInactive` 改回裸调用 `this._refreshActive();`，删去第 8 行已经用不到的 `onUnexpectedError` import（仓库开着 `noUnusedLocals`）。这三行由此与上游快照 `004a1fbb` 原文一致。`_refreshGeneration`、`dispose` 覆写、`setPid` 里的代数递增保持不动。
2. `windowsShellHelper.ts` 第 93 行改回裸调用 `this.checkShell();`，即上游原文。第 80 行构造函数的 catch 和 `getShellName().then(...)` 之后的 catch 保留。
3. 扫描测试按「本地验证」改断言。

明确不改什么：

- 不新增私有方法，也不改被装饰方法的 `async` 与 `Promise<void>` 签名。上一版用的是这种做法；按 ADR-007，它要新增一个方法、改两个签名，上游 diff 变大。恢复裸调用让 diff 变小，运行时行为与上游一致，被丢弃的 promise 也不会拒绝；复发由扫描测试的新断言挡住。
- 不改 `src/vs/base/common/decorators.ts`：包装函数不返回值是现有合同，仓里大量依赖。
- 不改 `terminalProcess.ts` 第 338、339、352–356、492 行的调用方式，不改 `ptyService.ts` 的 `traceRpc`。
- D720 的其它站点不动：`windowsShellHelper.ts` 构造函数与 `getShellName().then` 的 catch，`commandDetectionCapability.ts`、`terminalAutoResponder.ts`、`shellIntegrationAddon.ts` 的单层 catch。
- 本路范围外的同类写法按实施步骤登记，不在本条改：`src/vs/workbench/contrib/terminal/browser/terminalProfileResolverService.ts` 第 68、71 行对 `@debounce(200)` 的 `_refreshDefaultProfileName`（第 74–75 行）调用 `.catch`。
- 保持通过：扫描测试 `opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / two-arg then / assigned then / already-done / windows electron-main stay skipped`，其中 `child.includes('private _refreshInactive(): void {')`、`!child.includes('this._refreshInactive().catch')`、`processSrc.includes('this._windowsShellHelper?.checkShell();')` 改后仍成立；`src/vs/platform/webContentExtractor/test/node/platformWebContentExtractorLeftoverPromiseCatchScan.test.ts` 第 94 行起那条测试，以及 `src/vs/platform/browserView/test/node/platformBrowserViewLeftoverPromiseCatchScan.test.ts` 第 151 行起那条测试，它们分别在第 135–136 行、第 195–196 行要求 `this._startMonitoringShell().catch(onUnexpectedError);` 存在且没有双层 catch。

本地验证：

- 修改 `platformTerminalLeftoverPromiseCatchScan.test.ts`：
  - `this knife covers eight leftover Promise single-catch sites and zero double-chain sites`：五个文件的单层 catch 总数由 8 改为 5（`childProcessMonitor.ts` 由 2 处变为 0 处，`windowsShellHelper.ts` 由 3 处变为构造函数与 `getShellName().then(...)` 两处），测试名同步改写。
  - `windowsShellHelper leftover _startMonitoringShell / checkShell / getShellName then are Promise single-catch`：保留 `async checkShell(): Promise<void> {` 以及 `_startMonitoringShell`、`then` 两处单层 catch 的断言；把 `assertSingleCatch(source, 'this.checkShell()')` 换成「源码含裸调用 `this.checkShell();`，不含 `this.checkShell().catch`」。
  - `childProcessMonitor leftover _refreshActive fire-and-forgets are Promise single-catch; sync handleInput / _refreshInactive stay skipped`：改为断言裸调用 `this._refreshActive();` 恰好两处，源码不含 `this._refreshActive().catch`，也不含 `onUnexpectedError` 的 import；`handleInput() {`、`private _refreshInactive(): void {`、`private async _refreshActive(): Promise<void> {` 的断言保留；测试名改为说明被装饰的方法只能裸调用。
  - 新增断言：两个文件里每个被 `@debounce(` 或 `@throttle(` 装饰的方法名，源码中都没有 `this.<方法名>().catch`、`this.<方法名>().then` 或 `await this.<方法名>(`。
- 新增 `src/vs/platform/terminal/test/node/childProcessMonitor.test.ts`：从 `src/vs/base/test/common/virtualScheduling/index.ts` 导入 `runWithFakedTimers`（`timeTravelScheduler.ts` 已标注废弃，只是转出口）。在其中构造 `ChildProcessMonitor(process.pid, new NullLogService())`，断言连续调用 `handleInput()`、`handleOutput()` 不抛；随后 `dispose()`，把假定时器推过 1000 ms 与 5000 ms，断言不抛、`onDidChangeHasChildProcesses` 没有触发；套件用 `ensureNoDisposablesAreLeakedInTestSuite`。改动之前第一条断言会因 TypeError 失败。
- 先 `npm run compile-client`，再用 `scripts/test.sh --run` 分别跑 `src/vs/platform/terminal/test/node/platformTerminalLeftoverPromiseCatchScan.test.ts`、`src/vs/platform/terminal/test/node/childProcessMonitor.test.ts`、`src/vs/platform/webContentExtractor/test/node/platformWebContentExtractorLeftoverPromiseCatchScan.test.ts`、`src/vs/platform/browserView/test/node/platformBrowserViewLeftoverPromiseCatchScan.test.ts`，最后跑 `npm run eslint`。

### 实施前提与提交步骤

实施前提：

1. 本方案签收后再实施。ADR-007 要求上游文件上新增的 diff 写明依据，即已签收方案或 ADR。
2. 同轮 r02 方案（`dev/plans/review-2026-11-07-r02-agent-host-plan.md`）也改 agentHost 的 `commandAutoApprover.ts`（`_extractSubCommands` 的重定向分支，新增 `getDirectoryChangeTargets`）和 `commandAutoApprover.test.ts`。本方案在该文件里只往后备表的 sed 段加两条，在测试里加用例，与 r02 不改同一处。两份方案谁后提交，谁在对方提交之后重放改动，并跑这两个文件的全部测试。
3. 先做 r04-1 第 1 步的 cherry-pick，再做其余改动，让上游提交的内容保持原样。

提交步骤：

1. 按 r04-1 至 r04-4 改生产代码与测试。
2. 编译：`npm run compile-client`。`scripts/test.sh --run` 加载的是 `out/` 下的编译产物，不先编译就跑不到新代码；同一提交若还改了 `extensions/`，改用 `npm run compile`。
3. 按各条「本地验证」用 `scripts/test.sh --run <测试文件>` 跑，再跑 `npm run eslint`。
4. 同一提交里改文档：
   - `dev/progress/upstream-min-patch.md`：按「上游文件与 ADR-007」的记法新增 A 表小节，并补记两个监视器文件。
   - `dev/progress/deferred-gaps.md` 新增两行，编号在登记时分配。第一行：终端命令自动批准默认规则的展开与续行绕过。现象：选项文本含变量展开、花括号展开或 ANSI-C 转义时（`sort --{o,}utput=<文件>`、`sort --$'\x6f'utput=<文件>`、`sed --in${X} …`），正则规则与 sed 解析器都看不出选项；用 `.*` 的默认拒绝规则跨不过续行和引号内换行，`find . \`、换行、`  -name x \`、换行、`  -delete` 会被自动批准。范围：工作台 `terminalChatAgentToolsConfiguration.ts` 默认表、agentHost `commandAutoApprover.ts` 后备表，以及本方案保留原样的上游行。方向：工作台 `CommandLineAutoApprover.isCommandAutoApproved`、`isCommandLineAutoApproved` 与 agentHost `CommandAutoApprover._matchSingleCommand`、`_matchesCommandLineRule` 在匹配前于单引号之外删去续行；`TreeSitterCommandParser.extractAutoApprovalSubCommands` 与 agentHost `_extractSubCommands` 把含展开节点的选项词判为不可分析。可达性：只在 Agents 窗口。第二行：`src/vs/workbench/contrib/terminal/browser/terminalProfileResolverService.ts` 第 68、71 行对 `@debounce(200)` 的 `_refreshDefaultProfileName`（第 74–75 行）调用 `.catch`，`dev/progress/conversation-gpt-visual-evidence/window-console.log` 第 7、13 行记有同一个 TypeError；方向同 r04-4，恢复上游的裸调用。
   - 在 `dev/progress/deferred-gaps.md` 第 1095 行的 D720 补一句：`childProcessMonitor` 两处与 `windowsShellHelper` 的 `checkShell` 一处已按本方案恢复为裸调用，原因是被装饰的方法不返回 promise。
   - `dev/plans/INDEX.md`：提交时登记本方案。工作区里第 401 行已有一行尚未提交的登记，提交时核对其中的状态与摘要和本稿一致，再随本方案一起暂存。
5. 跑 docs-health：`python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。
6. 只暂存本主题的文件，不带工作区里别人的改动。

## 审查

2026-11-07 只读审查的结论是须改稿，r04-4 处理 Minor 后可实施。Critical 已改：C1 属实，工作台 `commandLineAutoApprover.ts` 第 233 行与 agentHost `commandAutoApprover.ts` 第 391 行在 PowerShell 下不分大小写，上一版规则会误拒 `Sort-Object -Bottom 5`、`sort -Bottom 5`、`git grep -o`、`git branch -c`；现在新规则在 `^sort\b` 后加 `(?!-)`，选项字母放进 `(?-i:…)`（上游 `289549a85cd` 已这样写，Electron 42 与远端 Node 24 都支持），只剩 PowerShell 下小写别名 `sort -bottom 5` 多要一次确认，已写明，两边的 PowerShell 套件都补了用例。C2 属实，`_tokenizeCommand` 第 49–58 行把续行留在参数里，上一版的逐参数判定会漏掉 `sed \`、换行、`-i`；现在 `canHandle` 与 `extractFileWrites` 切分前先对整条命令在单引号之外删去续行（比逐参数删多挡住反斜杠后接 CR、LF 的写法），`detects supported in-place options` 与 agentHost `handles sed with blocked args` 都补了用例。Important 已改：I1 采纳容忍串 `(?:\$?['"]|\\\r?\n|\\)*`；核查时还发现 `.*` 跨不过续行（tree-sitter 节点文本保留续行，上游 `find … -delete` 分三行写也会放行），新规则一律改用 `[\s\S]*`；变量、花括号与 ANSI-C 展开写成已知限制，并在实施步骤里登记缺口。I2 采纳：写明三份规则文件和工作台配置相对 `004a1fbb` 没有本地改动、属纯上游文件，按 ADR-007 把 git grep 与 PowerShell `-C` 部分改为 cherry-pick 上游 `289549a85cd`、`8c77f19795e`，其余本地补丁只增不改上游行，并写明 `upstream-min-patch.md` 的 A 表记法；r04-4 改为恢复上游的裸调用，不再新增私有方法，理由写在 r04-4 的「明确不改什么」。I3 采纳扩展规则：在工作台默认表与 agentHost 后备表各加两条 sed 拒绝规则，同时覆盖核查时复现的 `sed -n"e"…`、`sed \-e …` 写法。Minor 都已改入：`git grep -eOops` 那条误判例子不成立（`e` 不在前缀字母集合里），改为 `git grep -e -Ofoo`；sed 长参数清单补上 `binary`、`zero-terminated`，共 18 个；`t()` 的第 4 个参数按 `expectedDisclaimers` 写；BSD `-i ''` 的后缀按原始参数判断；点名 `platformWebContentExtractorLeftoverPromiseCatchScan.test.ts` 第 135–136 行与 `platformBrowserViewLeftoverPromiseCatchScan.test.ts` 第 195–196 行，`_startMonitoringShell` 保持 `private async`；`runWithFakedTimers` 改从 `virtualScheduling/index.ts` 导入；运行清单加上 `runInTerminalTool.test.ts`；注明 D720 在 `deferred-gaps.md` 第 1095 行。判定表的判定与严重度没有变化。

## 实施记录（2026-11-07）

用户同意实施并要求不编译。四条都已落到代码，未编译，未跑测试，未跑 eslint 与 docs-health；下面的「验证情况」只是用 node 对正则和解析器做的试算，不能代替测试。共享登记表（`upstream-min-patch.md`、`deferred-gaps.md`、`dev/plans/INDEX.md`）按父 agent 的分工没有改，要登记的内容交给父 agent 统一写。

r04-1 改了 `src/vs/platform/terminal/common/autoApprove/gitAutoApproveRules.ts`、`src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/browser/commandLineAutoApprover.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/electron-browser/runInTerminalTool.test.ts`。与方案的出入：上游 `289549a85cd`、`8c77f19795e` 没有用 `git cherry-pick`，而是按父 agent 的要求用 `git show` 看上游 diff、手工改到工作区；规则文件在加本地规则之前与上游 `8c77f19795e` 逐字节一致（blob `24194721f8c`），两份 auto-approve 测试里上游的导入与四条测试、`runInTerminalTool.test.ts` 里上游的三行用例都照原文写入，提交说明里要写明对应的上游提交。本地新增五条规则：log、show、diff 共用的 `--output`，grep 的短选项串与长参数各一条，branch 的短选项串与长参数各一条。方案说 grep 段只沿用上游注释，实施时在两条本地 grep 规则上方加了两行注释，说明它们补的是引号、续行和更多短选项字母，免得读者以为与上游重复。测试按方案加入；PowerShell 用例在工作台放进 `default PowerShell rules` 套件，在 agentHost 新增两条测试。

r04-2 改了 `src/vs/platform/terminal/common/autoApprove/sedFileWriteParser.ts`、`src/vs/platform/terminal/test/common/autoApprove/sedFileWriteParser.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/electron-browser/commandLineAnalyzer/commandLineFileWriteAnalyzer.test.ts`，以及两张表的 sed 段：`src/vs/workbench/contrib/terminalContrib/chatAgentTools/common/terminalChatAgentToolsConfiguration.ts` 与 `src/vs/platform/agentHost/node/commandAutoApprover.ts` 的 `DEFAULT_TERMINAL_AUTO_APPROVE_RULES`，两边各加两条，内容相同。解析器新增模块级常量 `sedLongOptions` 和三个私有方法 `_removeLineContinuations`、`_unquoteOption`、`_resolveLongOption`；删续行时同时跟踪单引号和双引号，双引号里的续行也删，与 bash 一致。`canHandle` 先用与 HEAD 逐字相同的门槛和正则判断原始文本，命中即为就地编辑，没命中再按参数判断，所以不会比 HEAD 少拦（见下文「代码审查」）。依赖：同轮 r02 要改同一个 `commandAutoApprover.ts` 的 `_extractSubCommands` 与同一个测试文件，本条只动后备表的 sed 段和 `handles sed with blocked args`、git、sort 几条测试，与 r02 不改同一处；r02 在本次改动之后开始，提交时谁后提交谁重放并跑这两个文件的全部测试。

r04-3 改了 `src/vs/platform/terminal/common/autoApprove/sortAutoApproveRules.ts`：上游第 12–14 行与 `--compress-program` 规则未动，在第 14 行后加两条，补充说明另起两行写在这两条规则上方。测试加在工作台 `default sort rules`、`default PowerShell rules`，agentHost `handles sort with blocked args` 和新的 PowerShell 测试，以及 `runInTerminalTool.test.ts`。与方案无出入。

r04-4 改了 `src/vs/platform/terminal/node/childProcessMonitor.ts`（`handleInput`、`_refreshInactive` 恢复裸调用，删去 `onUnexpectedError` 的 import，这三行与上游快照原文一致）、`src/vs/platform/terminal/node/windowsShellHelper.ts`（`_startMonitoringShell` 里恢复裸调用 `this.checkShell();`，`_startMonitoringShell` 仍是 `private async`，构造函数与 `getShellName().then` 的 catch 保留）、`src/vs/platform/terminal/test/node/platformTerminalLeftoverPromiseCatchScan.test.ts`（单层 catch 计数由 8 改为 5，两条测试改断言并改名，新增「被 `@debounce`、`@throttle` 装饰的方法不当 promise 用」一条），并新增 `src/vs/platform/terminal/test/node/childProcessMonitor.test.ts`（从 `virtualScheduling/index.ts` 导入 `runWithFakedTimers`）。与方案无出入。

没做的部分：方案「实施前提与提交步骤」第 4 步的文档登记（`upstream-min-patch.md` A 表小节、`deferred-gaps.md` 两行、D720 补注、`dev/plans/INDEX.md` 核对）按分工交给父 agent；提交本身不在本轮。

验证情况（node 试算，不是测试）：直接读改后的规则文件求值，git 规则 94 个命令、sort 规则 41 个命令在 bash 与 PowerShell 两种方式下都符合预期；两张表的 sed 规则逐字相同，50 个现有与新增命令符合预期；用 Node 26 的类型剥离直接加载改后的 `sedFileWriteParser.ts`，现有三组测试用例与新增的缩写、引号、续行（含 CR、LF）写法全部符合；按 agentHost 的判定顺序模拟了四个改过的测试，数组长度一致、期望值相符；用 `@vscode/tree-sitter-wasm` 确认测试里的续行写法都被解析成单条命令，没有解析错误；按扫描测试的断言逐条复算，全部成立。

之后要跑的本地验证：

1. `npm run compile-client`（同一提交若改了 `extensions/`，用 `npm run compile`）。
2. `scripts/test.sh --run` 依次跑：`src/vs/platform/agentHost/test/node/commandAutoApprover.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/browser/commandLineAutoApprover.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/electron-browser/runInTerminalTool.test.ts`、`src/vs/platform/terminal/test/common/autoApprove/sedFileWriteParser.test.ts`、`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/electron-browser/commandLineAnalyzer/commandLineFileWriteAnalyzer.test.ts`、`src/vs/platform/terminal/test/node/platformTerminalLeftoverPromiseCatchScan.test.ts`、`src/vs/platform/terminal/test/node/childProcessMonitor.test.ts`、`src/vs/platform/webContentExtractor/test/node/platformWebContentExtractorLeftoverPromiseCatchScan.test.ts`、`src/vs/platform/browserView/test/node/platformBrowserViewLeftoverPromiseCatchScan.test.ts`。
3. `npm run eslint`。
4. 文档登记写完后跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。

### 代码审查（2026-11-07）

只读代码审查的结论是须修改，本路两条已按意见改完，仍未编译、未跑测试。

- Critical 1（`canHandle` 先切参数会漏掉 `sed $'s/a/\'/' -i …` 与 `sed "$(echo 'p;#"')" -i …`，agentHost 相对 HEAD 回归）：已改，`canHandle` 先用与 HEAD 逐字相同的 `^sed\s+` 门槛和正则判断原始文本、命中即为真，再走按参数的判断，因此对任何输入都不比 HEAD 少拦；两条写法已补进 `detects supported in-place options` 与 agentHost 的 `handles sed with blocked args`（两个数组各加两项 `'denied'`），node 试算两条都判为就地编辑、tree-sitter 解析无错误，五份测试里的 170 条 sed 命令没有一条 HEAD 拦而新版不拦；上一轮「脚本里出现 ` -i` 不再误判」的方案外变化随之撤回，没有测试锁过它，只同步了上文的实施记录。
- Minor 1（`sortAutoApproveRules.ts` 第 12–13 行改了上游注释）：已改，上游第 12–14 行恢复原文，补充说明另起两行写在两条新规则上方，文件相对 HEAD 只剩新增行。
