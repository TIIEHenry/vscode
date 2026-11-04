---
title: "设计审查 2026-11-04 p6：测试放置、源码扫描测试与过程证据"
type: plan
status: draft
phase: N/A
updated: 2026-11-04
summary: "把 conversation 并列测试收进 test/browser 并进 unit-custom；源码文本扫描改成规则或往返；D17 装载白名单清零；连接 stub 抽共享 builder；新证据不入库。规则分级等待拍板。"
---

# 设计审查 2026-11-04 p6：测试放置、源码扫描测试与过程证据

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本稿只写方案。统计对着当前 `agent-ide` HEAD `20a1875017e` 与工作区活码。工作区里已有别人的未提交改动（含 D17 名单抽文件、conversation 源码与测试）。实施时只改本片点名的文件，不还原、不暂存别人的改动。

不发明新 RPC，不发明新快照字段。测试 helper 不是服务，不新增 `createDecorator`。新文件沿用 Microsoft 版权头。用户可见字符串走 `nls`；本篇测试 helper 与检查脚本没有用户可见字符串。新建的 `Emitter` 由调用方放进该测试已有的 `DisposableStore`，helper 不长期持有。

## 冲突域与切片顺序

| 切片 | 碰的路径 | 依赖 |
|------|----------|------|
| p6-1 测试放置 | `src/vs/workbench/contrib/conversation/browser/*.test.ts`（59 个，搬走或删除）；30 个 `test/browser/<stem>.beside.test.ts`；新 `test/browser/conversationSessionsFocus.test.ts`（含焦点测试里的样式表 URL）；只改已有 `test/browser/conversationSessionsView.test.ts` 的过滤断言，并在确认重复后删并列的 pinned 测试；`scripts/run-unit-custom.sh` 的 conversation glob；`docs/architecture/cross-cutting/testing.md` 的焦点示例命令；`scripts/check-test-placement.py`（新）与 `dev/progress/health-gates.md` 的检查命令随最后一批搬走再合入；必要时 `dev/progress/test-baseline-failures.txt` 的 `min_cases` 与失败行；`dev/progress/deferred-gaps.md` 的 D17 账 | 无。不改 p6-4 那 8 个 stub 函数体。并列的 `browser/engineMcpRuntimePanel.test.ts` 只改名为 beside；[p1](review-2026-11-04-p1-capability-write-gate-plan.md) 写明它那一波不搬这份并列测试，两片不改同一路径 |
| p6-2 源码扫描 | `src/vs/platform/universeAgent/test/node/*Wire*.test.ts` 为主；另见 §p6-2 的目录批次。可能新增 `.eslint-plugin-local/` 规则并在 `eslint.config.js` 挂上 | 与 p6-3 相交的只有名单上的 `grpcQueueSkillWire.test.ts`、`grpcSessionWrites.test.ts`。这两份等 p6-3 判定完 runner 再改断言 |
| p6-3 D17 名单 | 工作区未提交的 `test/unit/electron/d17-ua-node-unloadable.json`；`test/unit/electron/renderer.js` 的 glob 分支与 `isD17UnloadableUniverseAgentNodeTest`；`scripts/run-unit-custom.sh` 的 universeAgent 收集（位置参数，不走 glob）；上述 17 个 `src/vs/platform/universeAgent/test/node/<name>.test.ts`；它们 import 到的生产文件（仅当判定允许改生产）；`dev/progress/test-baseline-failures.txt` 头部；`dev/progress/health-gates.md` 里「十一份」和并不存在的 `--excludeRunGlob` 那句 | 先调查再改。名单抽取的未提交 diff 视为已有接线，不回退，不另建第二份名单 |
| p6-4 连接 stub | `src/vs/workbench/contrib/conversation/test/common/conversationConnectionTestStub.ts`；`test/browser/` 下 8 个仍自带可变 stub 的测试 | 与 [p1](review-2026-11-04-p1-capability-write-gate-plan.md) 的顺序见该节。p1 要改其中 `engineMcpRuntimePanel.test.ts` 与 `engineCatalogSections.test.ts` |
| p6-5 新证据 | `docs/DOCUMENTATION.md` 规则 4、规则 7 第 4 条；`docs/principles/document-system.md` 加一句指针 | 历史重写见待定项，默认不做 |
| p6-6 流程负担 | 无实施切片，见待定项 | 等拍板 |

p6-1 与 p6-4 可以并行：p6-1 对同名 section 测试只新增 `*.beside.test.ts`，不改已有 `test/browser/engine{Tools,Plugins,Preferences,ProviderModel,McpRuntime}*` 的函数体。p6-2 的 wire 批次与 p6-1、p6-4、p6-5 并行。p6-3 的调查与其它片并行；改那两个 Wire 测试文件之前要等判定。

## 与已有合同

- [引擎写入结果闸门](engine-write-gate-unification.md) §6 写明：`browser/` 下与源码并列的测试当时有 59 个，与 `test/browser/` 同名的两份各管不同面，该波不搬。本次仍是 59 个。p6-1 不推翻「各管不同面」，不把两份断言收成一份。搬的是放置。该句的「本波不搬」只约束写闸那一波，不禁止以后的放置切片。
- [health-gates](../progress/health-gates.md) 现行表：普通红测记 [D17](../progress/deferred-gaps.md)，不挡下一刀 UI。同文写明 [test-baseline-ci](test-baseline-ci.md) 切片 5（新增失败挡合入）还没翻转这张表。`scripts/check-test-baseline.sh` 对名单外失败已经会退出 1。两份文本都算已签收。本篇按 health-gates 的「切片 5 未落地」执行：要让比较脚本变绿，就修，或把 `classname::name` 写进名单并在 D17 记首次 SHA。不把切片 5 的「加行必须另开 PR、挡合入」提前当成现行政策。
- [测试基线](test-baseline-ci.md) 选定的门是失败集合 ⊆ 名单、用例数 ≥ `min_cases`、skipped ≤ `max_skipped`。p6-1 抬 `min_cases`、不抬 `max_skipped`。
- [文档负担收敛](docs-burden-reduction.md) 已做：状态列生成、四份手写账、术语、归档标准。它不做 accepted 时限、规则 16 分级、禁止把通过条数写进叙述。p6-6 只补这三件，且全部待定。§5 第 4 条「证据目录不因过程多而归档」仍然有效；p6-5 不归档、不默认改历史。
- [架构概览](../../docs/architecture/overview.md) 写单元测试在 `src/vs/*/test/`。[测试与校验](../../docs/architecture/cross-cutting/testing.md) 同样把 unit 放在 `src/vs/*/test/`，并写明隐藏 Electron 没有原生焦点，`:focus` 类断言要在 browser runner 里跑，`this.skip()` 只表示环境前提。产品愿景没有测试放置条款。
- `valid-layers-check` 在 [D8](../progress/deferred-gaps.md) 豁免期内不作合入门禁。它不查 import path（[ADR-003](../decisions/003-engine-adapter-boundary.md)）。p6-2 不把结构约束加进 `build/lib/layersChecker.ts`，也不把 `npm run valid-layers-check` 当验收。
- 托管 CI 已关。本篇不把 workflow 当缺口，不建议重开。`.github/workflows/pr-linux-test.yml`、`pr-darwin-test.yml`、`pr-win32-test.yml` 第一行已是 `if: false`，文件里仍留着 `test-browser` 那一步，只说明历史入口。

## p6-1 测试放置

问题类：conversation 有 59 个测试跟源码放在同一 `browser/` 目录，unit-custom 的 Electron glob 收不到，本地门禁不跑它们。

证据：

- `src/vs/workbench/contrib/conversation/browser/*.test.ts` 共 59 个。`src/vs/` 里路径不含 `test` 段的 `*.test.ts` 也只有这 59 个。`contrib/sources`（28）、`contrib/navigator`（16）、`platform/universeAgent`（135）的测试都在 `test/` 下。
- Electron 发现用 `test/unit/electron/renderer.js:90` 的 `'**/test/**/*.test.js'`。工作区 `:198` 取出 pattern，`:199` 才对 `loadFn._out` 做 glob。有 `opts.run` 时从 `:189` 进入分支，`:195` `return`，看不到 `:200` 的 `excludeRunGlob`。HEAD 的 glob 在 `:216`（未提交 diff 把内联名单收成一行，这段上移）。并列文件编译到 `out/.../browser/*.test.js`，匹配不上 `**/test/**`。
- Node runner `test/unit/node/index.js:60` 的 glob 同样是 `'**/test/**/*.test.js'`，`:63` 再排除 `browser`、`electron-browser`、`electron-main`、`electron-utility`。并列的 browser 测试两边都不进。
- `scripts/run-unit-custom.sh` 的 conversation 行是 `--glob '**/vs/workbench/contrib/conversation/test/**/*.test.js'`。工作区这条在 `:106`，HEAD 在 `:116`（未提交的名单抽取让文件变短，行号上移）。sources 行同理，只收 `test/`。
- browser runner `test/unit/browser/index.js:135` 默认 `'**/*.test.js'`，`:120` 只排除 `node` 与 electron 各层。并列的 `browser/*.test.js` 会收。`package.json:14` `test-browser`、`:15` `test-browser-no-install` 走这个 runner。
- 59 个里 32 个与 `contrib/conversation/test/browser/` 同名，27 个没有同名文件。32 个里只有 2 个文件的 `test(` / `suite(` 标题有交集：`conversationPinnedUserPrompt.test.ts` 共用 2 个标题，`conversationSessionsView.test.ts` 共用 1 个。其余 30 个同名文件标题不相交。
- `conversationPinnedUserPrompt.test.ts` 并列份只有这两条，输入和期望与 `test/browser` 里同名测试相同（并列 `:25`、`:34`；`test/browser` `:127`、`:136`）。suite 名不同：并列是 `conversationPinnedUserPrompt (browser unit)`，`test/browser` 是 `ConversationPinnedUserPrompt`。
- `conversationSessionsView.test.ts` 的同名标题是 `inline filter keeps the active session visible when its title does not match`（并列 `:112`，`test/browser` `:650`）。并列在 `:128` 之后多断言了 more 按钮和状态图标，`test/browser` 那条停在标签文本。并列 `:153` 起按主题生成焦点颜色测试。`:159` 判断 `!document.hasFocus()`，`:160` 调用 `this.skip()`。注释写明隐藏 Electron 跑不了，要 browser runner。这 59 个文件里只有这一处 `this.skip()`。
- 基线头 `dev/progress/test-baseline-failures.txt:3` 是 `max_skipped: conversation=1`。`:2` 是 `min_cases`（含 `universeAgentNode=418`），不是跳过上限。这 5 条主题测试在隐藏窗口里会 skip。放进 conversation glob 会超过 1。

不变量：

- 27 个无对照文件的 suite、标题、断言原样留下，只改相对 import。
- 30 个标题不相交的同名文件，两份断言都留。不合并、不删。
- pinned 两条若实施时 diff 仍相同，只留 `test/browser` 那份。
- sessions 过滤那条保留并列多出来的 more 与图标断言，加进已有测试，不留第二份同名测试。
- 5 条焦点主题测试仍只在有真实焦点的 browser runner 里当真断言。它们不进入 unit-custom 的 conversation 计数，也不用 `this.skip()` 去换 `max_skipped`。
- 搬家不改产品行为，不改生产 `.ts`。

要动的符号与文件：

- 搬走或删除上述 59 个并列测试。27 个无对照的保持文件名，放到 `src/vs/workbench/contrib/conversation/test/browser/`。模块 import 从 `./foo.js` 改为 `../../browser/foo.js`（以各文件现有相对路径为准，实施时逐文件改，不批量替换字符串）。这条替换只动 import。样式表 URL 另改，见下一条。
- 30 个标题不相交的同名文件改为 `test/browser/<stem>.beside.test.ts`。suite 名不变。
- 删除并列的 `conversationPinnedUserPrompt.test.ts`（确认重复之后）。
- `test/browser/conversationSessionsView.test.ts` 的那条过滤测试补上并列 `:128` 起的两条 DOM 断言。5 条焦点测试拆到新文件 `test/browser/conversationSessionsFocus.test.ts`。并列 `:165` 用 `new URL('./media/conversationSessions.css', import.meta.url)` 挂样式表，不是 `import`。拆出去之后改成 `new URL('../../browser/media/conversationSessions.css', import.meta.url)`。`./foo.js` 那条替换改不到这条 URL。
- [测试与校验](../../docs/architecture/cross-cutting/testing.md)「验证真实焦点样式」的示例命令（`:72-75`）仍指向 `browser/conversationSessionsView.test.ts`。`--run` 改成 `src/vs/workbench/contrib/conversation/test/browser/conversationSessionsFocus.test.ts`。该页现有的 `rtk proxy` 前缀和 `--grep 'selected session text follows'` 保持。
- `scripts/run-unit-custom.sh` 的 conversation 调用加上 `--excludeRunGlob '**/conversationSessionsFocus.test.js'`。这条调用用的是 `--glob`，会走到工作区 `renderer.js:200` 的排除。`--excludeRunGlob` 对 `opts.run` 无效（`:189` 进入分支，`:195` 返回）。conversation 这条不要改成位置参数。
- 新 `scripts/check-test-placement.py`：`src/vs` 下任一 `*.test.ts` 的路径段里没有恰好名为 `test` 的一段则退出 1。脚本本身，以及 `dev/progress/health-gates.md` 里的那一行命令，随最后一批搬走再合入。前面几批只搬当时可以搬的文件，不把检查放进那些提交。`browser/` 里还留着并列测试时，命中不是 0，检查不能当那一批的绿。

改法：

1. 先 diff 两个标题相交的文件，按不变量删或补。再搬当时可以搬的文件，改 import，并改焦点测试的样式表 URL。
2. 放置检查只在最后一批合入。那一批把仍留在 `browser/` 的并列测试搬走（含此前让路、别人已经提交的文件），同时加入 `scripts/check-test-placement.py` 和 health-gates 的一行。该提交的命中应为 0。更早的提交不以这条为门禁。
3. `npm run transpile-client`（已有 watch 则不必再开一份），然后用重复的 `--run` 让 `scripts/test.sh` 跑全部新位置文件（焦点文件除外）。
4. 基线：焦点文件被 exclude 之后，跑 `scripts/run-unit-custom.sh`。conversation 的 testcase 总数若高于头里的 `min_cases`（现为 799），把头里的 conversation 下限改成这次实测总数。下限只升。`max_skipped` 保持 conversation=1。本片不加 `it.skip` / `this.skip`。
5. 红测分两档。导入路径、DOM 挂载、browser 与 Electron 的环境差，由本片修，不记 D17。修完仍是产品行为失败的，在 D17 写首次 SHA，并把 `classname::name` 加进 `test-baseline-failures.txt`。比较脚本要这行才绿。不改 health-gates 的「不挡下一刀 UI」。

明确不改什么：

- 不合并写闸方案点名的两份「各管不同面」。`engineMcpSection.test.ts` 等同名 section 测试走 beside 改名。
- 不改 `test/unit/electron/renderer.js` 的默认 glob，不改 Node、browser runner 的默认 glob。
- 不改 `package.json` 的 `test-browser`。
- 不重开已停用的 `pr-*-test.yml`。
- 不抬 `max_skipped`。
- 不碰 `src/vs/sessions/`。

本地验证：

- `python3 scripts/check-test-placement.py`
- `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/<搬迁或 beside 文件>`（焦点文件不用这条）
- 焦点文件按 [测试与校验](../../docs/architecture/cross-cutting/testing.md)：`node test/unit/browser/index.js --browser chromium-chrome --run src/vs/workbench/contrib/conversation/test/browser/conversationSessionsFocus.test.ts --grep 'selected session text follows'`。`test/unit/browser/index.js:242` 在没有 `--debug` 时以 headless 启动。5 条若因 `hasFocus()` 为假而 skip，这次不算通过；同一命令加上 `--debug` 再跑，直到 5 条执行且不 skip。不把 skip 记成通过，也不因此去抬 `max_skipped`。
- 收尾：`scripts/run-unit-custom.sh`。conversation 失败集合 ⊆ 名单，条数 ≥ 更新后的 `min_cases`，skipped ≤ 1。

风险与回退：

- 相对 import 改错会在 transpile 或装载时失败，单文件 `--run` 能看出来。回退是把该文件移回原路径。
- 新文件进入 Electron 后可能成批变红。环境差本片修；产品红按上面的 D17 规则登记。不把 browser runner 的绿当成 Electron 门的绿。
- 若漏了 `--excludeRunGlob`，5 条焦点 skip 会让 `max_skipped` 失败。这就是信号，不去抬上限。
- 别人正改着的并列测试（工作区里的 `src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.test.ts`）本片先不动，等那份改动提交后再搬。不 stash。检查脚本等这次让路的文件也搬走再合入。

## p6-2 源码文本扫描测试

问题类：一批测试用 `readFileSync` 读 `.ts` 源码，再断言里面有没有某个标识符。源码一改名，测试就红，于是出现专门「对齐现行形态」的提交，合同却没有变成行为。

证据：

- 口径分四类。清理范围是四类的并集，不是「213 处加上 36 处」。19 个文件、36 处，以及其中 16 个文件、21 处，按「参数不含 `.ts`、同文件变量被赋成 `.ts` 路径」对不上活码，不作为批次边界。实施时按这四类重数，数字变了就改批次。只重数第 2 类，补不上第 3、第 4 类里的文件。
  1. 字面量：`readFileSync` 的参数文本含 `.ts`。`src/` 下这样的测试是 73 个文件、213 处。文件名不含 `Scan` 或 `Leftover` 的是 65 个文件、135 处。
  2. 直接赋值：参数文本不含 `.ts`，同文件把变量赋成带 `.ts` 的表达式。排除文件名含 `Scan` 或 `Leftover` 之后是 14 个文件、29 处，不在上面的 213 里。其中零字面量 12 个文件、16 处。`conversationImportBoundaries.test.ts:99`、`:114`、`:125` 在这 12 个里。若干 Wire 的 `clientPath`，以及 `previewEditorGroupHeader.test.ts` 的间接读，在这 14 个里；后者另有字面量调用，所以不在 12 个里。
  3. `candidates.find`：`.ts` 在数组元素或路径常量里，`readFileSync` 的参数是 `find` 得到的变量，该变量的赋值表达式本身不含 `.ts`。排除 `Scan` / `Leftover` 文件名后是 10 个文件、11 处，全部没有字面量参数。`grpcTeamUnaryWire.test.ts:297` 读 `sourcePath`，`:313` 读 `clientPath`，`.ts` 在上面的 `candidates` 数组里。这个文件名含 `Wire`，不在下面那 61 个字面量文件里。其余 9 个是 `postEditWidget.test.ts`、`renameSymbolProcessor.test.ts`、`pluginListWidgetRefreshCatch.test.ts`、`sessionsUniverseAgentConnectionRegistration.test.ts`、`changesViewService.test.ts`、`agentHostSessionChangesets.test.ts`、`mobileTitlebarButtonSemanticsD1360.test.ts`、`aiCustomizationCatalogRefresh.test.ts`、`aiCustomizationTreeGroups.test.ts`。
  4. 目录遍历：参数文本不含 `.ts`，也不是第 2 类赋值。同文件用 `readdirSync` 或递归收集，用 `endsWith('.ts')` 留下文件，再 `readFileSync`。`universeAgentImportBoundaries.test.ts:82` 读 `filePath`，`:107` 读 `path.join(sessionViewDir, name)`。另一路是调用别的文件里的收集函数：`conversationImportBoundaries.test.ts:70`，以及 `conversationProcessFoldImportBoundaries.test.ts:39`、`conversationTrajectoryImportBoundaries.test.ts:37`、`conversationVisualizeImportBoundaries.test.ts:47`，都调用 `collectConversationProductionFiles`（`conversationImportBoundaryScan.ts:27` 用 `endsWith('.ts')`，`:38` 起 `readdirSync`）。后三份只有目录遍历，不在第 2 类的 14 个里，也没有字面量参数。
- 字面量那 65 个里，61 个文件名含 `Wire` 且路径在 `platform/universeAgent`。这 61 个文件全都已经调用了 `encode*` / `decode*` / `map*`。例：`src/vs/platform/universeAgent/test/node/grpcBackUnaryWire.test.ts:108` 读 `grpcBackUnaryWire.ts` 查 `JSON.stringify` 与函数名；`:123` 读 `grpcClient.ts` 查 `back` 方法正文。同文件 `:94` 起已经 `decodeBackResponse`。
- 字面量、且不是 Wire 文件名的还有 4 个：`grpcClientCalls.test.ts`（`:72`、`:133`）、`universeAgentConnectionIpcChannel.test.ts:334`（读 `app.ts`、`hub.ts`、session view 服务）、`webWorkerExtensionHost.test.ts:265`（还读另一份 scan 测试）、`previewEditorGroupHeader.test.ts:95`。
- 文件名含 `Scan` 或 `Leftover` 的字面量扫描是 8 个文件、78 处。其中 `src/vs/workbench/contrib/sources/test/node/sourcesWiringScan.test.ts` 占 56 处。
- 对齐提交：`b99dc5cdf52`（universeAgent 扫描对齐现行形态）、`be3535b403a`（conversation 过期扫描对齐）、`a5044687652`（conversation 测试腐化对齐现行语义）。

不变量：

- 编解码的对外结果不变。删的是「源码里必须出现某标识符」。
- 已经存在的 import 禁令不放宽，只换承载方式。包括 `conversationImportBoundaries.test.ts` 里「rewrite 不得 import 连接 / RPC」，另外三份 conversation boundary 测的禁令，以及 `universeAgentImportBoundaries.test.ts` 的两条：workbench 与 sessions 生产代码不得 import `platform/universeAgent/node`，`common/sessionView` 不得 import 父目录。
- 不新增 RPC，不新增快照字段，不改 `layersChecker.ts`。

要动的符号与文件：按下面三档。每档再按目录拆提交。

分类方法（每处只进一档，实施时按证据里的四类并集重跑）：

| 档 | 判定 | 替代 |
|----|------|------|
| (a) 结构 | 断言 import 路径、分层、禁用 API、main 里必须有某次 `registerChannel` | 能写成 import 图的，加到 `.eslint-plugin-local/`，在 `eslint.config.js` 里与 `local/code-layering`（`.eslint-plugin-local/code-layering.ts`）并列。`local/code-layering` 只按目录名 `common` / `node` / `browser` 等分层（`code-layering.ts:63-78`，挂载在 `eslint.config.js:400-421`），不代替路径禁令。已由它覆盖的分层断言可以删测试。路径禁令先搬进新规则，规则没接上之前不删测试。`universeAgentImportBoundaries.test.ts` 仍在，进这一档：`:72` 是 workbench 与 sessions 生产代码不得 import `platform/universeAgent/node`（[ADR-003](../decisions/003-engine-adapter-boundary.md) 的 platform 级 boundary 测），`:82` 与 `:107` 用 `readFileSync` 扫生产文件；`:98` 起禁 `common/sessionView` 的父目录 import，而 `eslint.config.js:394` 把 `common/sessionView/**` 排除在 `local/code-layering` 之外。`conversationImportBoundaries.test.ts` 与另外三份只做目录遍历的 conversation boundary 测同样进这一档 |
| (b) wire | 文件名含 `Wire`，且同文件已调用编解码函数 | 删 `readFileSync`。缺的输入输出用现有 `encode*` / `decode*` / `map*` 补往返。不读 `grpcClient.ts` 的方法源码 |
| (c) 其余 | CSS 片段、`.catch` 文本、wiring 清单、读另一份测试文件 | 有对应行为的改成调用生产函数或挂上生产 CSS 的 DOM 断言。没有行为对应的删除 |

改法：

1. S2a，universeAgent 里文件名含 `Wire`、且命中上面四类里任一类的文件。字面量那 61 个都在里面。`grpcTeamUnaryWire.test.ts` 没有字面量 `.ts` 参数，靠 `candidates.find` 命中，与这 61 个同一批，不留到 S2c。按文件名排序，每批约 10 个文件，一批一个提交。每批的替代覆盖：该文件已有的 encode/decode 往返保持；被删的标识符断言若对应一种字节或字段，就加一条函数往返，不新增生产函数。`grpcQueueSkillWire.test.ts` 与 `grpcSessionWrites.test.ts` 在 D17 名单上，等 p6-3 判定 runner 后再进批。
2. S2b，结构档。先处理 `universeAgentImportBoundaries.test.ts`（`:72` 的 `universeAgent/node` 路径禁令，`:98` 的 sessionView 父目录禁令）、`conversationImportBoundaries.test.ts`、`conversationProcessFoldImportBoundaries.test.ts`、`conversationTrajectoryImportBoundaries.test.ts`、`conversationVisualizeImportBoundaries.test.ts`，以及它们共用的 `conversationImportBoundaryScan.ts`。再处理 `universeAgentConnectionIpcChannel.test.ts:334` 起那条注册断言（`:333` 是测试标题，`readFileSync` 在 `:334` 到 `:336`）。路径禁令进 eslint 的新规则，不塞进 `local/code-layering`。规则没接上之前不删这些测试。`app.ts` 里 channel 注册若只是「这几行文本还在」，改成对已导出的 channel 名和构造函数做类型级或很小的组装测试；组装测试要不起新进程。做不到就保留这一处并在提交说明写原因，不把整文件的源码扫描扩回去。
3. S2c，文件名含 `Scan` 或 `Leftover` 的，加上四类里还没进 S2a、S2b 的调用。直接赋值里归这里的是 `sessionViewHostPorts.test.ts`、`sessionViewHostPostDiscipline.test.ts`、`universeAgentHubChannelClientHydrateCatch.test.ts`、`universeAgentSessionViewChannel.test.ts`、`previewEditorGroupHeader.test.ts`（Wire 的 `clientPath` 已归 S2a）。`candidates.find` 里归这里的是上面点名的那 9 个非 Wire 文件。`sourcesWiringScan.test.ts` 单独一批：每条扫描先写它想钉住的行为，有行为就改断言，没有就删。leftover `.catch` 扫描改成调用那个会失败的路径并断言错误被接住；接不住的生产行为不在本片修，记 D17。`webWorkerExtensionHost.test.ts:265` 到 `:266` 那种「再读一份扫描测试确认它还在」直接删（`:263` 只是标题）。CSS 扫描在已有 DOM 测试覆盖同一选择器时删除；没有覆盖的，改到挂生产 CSS 的测试里断言计算样式，不读 `.ts`。

明确不改什么：

- 不改生产编解码函数的字段布局。
- 不用 `valid-layers-check` 验收，不把它重新设成门禁。
- 不在本片删除 D17 名单（那是 p6-3）。
- 不改 conversation 并列测试的位置（那是 p6-1）。

本地验证：

- Node 层文件：`node test/unit/node/index.js --run <文件>`。这个 runner 不把 `--grep` 传给 mocha，所以按文件跑，不靠 grep 缩小。
- 不在 D17 名单上、Electron 能装载的文件，再加 `scripts/test.sh --run <同一文件>`。
- 新 eslint 规则：`npx eslint` 打到一条故意违规的 import 上必须报，打到允许的 import 上必须过。然后 `npm run eslint` 看挂载没有误伤。
- `webWorkerExtensionHost.test.ts` 与 `previewEditorGroupHeader.test.ts` 在 `browser/` 下，用 `scripts/test.sh --run <文件>`。不要只跑 Node runner：Node 的默认排除含 `browser`（`test/unit/node/index.js:63`），而且这两份有 DOM。
- 其余结构档与 Scan 档：在 `test/node` 的用 `node test/unit/node/index.js --run <文件>`。sources 那批归 unit-custom 的 sources 域，收尾带上 `scripts/test.sh --glob '**/vs/workbench/contrib/sources/test/**/*.test.js' --tfs sources`。

风险与回退：

- 往返覆盖不到「死代码里仍有 `JSON.stringify`」。这是本片接受的缺口：合同改成函数行为。回退是恢复该文件的 `readFileSync` 断言。
- 一批 10 个文件仍可能很大。单文件装载失败就从该批拆出去，不混在一个修不完的提交里。
- eslint 规则写宽会把上游合法 import 打红。规则只挂本仓要禁的目录（先 `contrib/conversation` 与 `platform/universeAgent`），用一条反例和一条正例钉住再扩大。

## p6-3 D17 白名单

问题类：Electron 的测试发现不按层排除，`universeAgent/test/node` 被扫进 renderer。其中 17 个文件动态 import 失败，runner 用名单把这种失败吞掉。目标是这份失败名单清零。

证据：

- HEAD `test/unit/electron/renderer.js:124` 到 `:142` 写死 17 个 basename。工作区未提交 diff 把同一 17 个抽到 `test/unit/electron/d17-ua-node-unloadable.json`，`renderer.js:125` 与 `scripts/run-unit-custom.sh:20` 改为读这个文件。17 个名字都能对上 `src/vs/platform/universeAgent/test/node/<name>.test.ts`。
- 吞掉条件在工作区 `renderer.js:127` 起的 `isD17UnloadableUniverseAgentNodeTest`：路径含 `/universeAgent/test/node/`、basename 在名单里、错误信息含 `Failed to fetch dynamically imported module`。其它 `*.test` 装载失败仍然中止。
- `origin/main` 的 `test/unit/electron/renderer.js:90` 是同一个 `'**/test/**/*.test.js'`，`initLoadFn` 里没有这份名单（main 的 `importModules` 从 `:121` 开始）。agent-ide 才有白名单。
- 该目录 `*.test.ts` 127 个。名单 17 个，其余 110 个留在 Electron 那一趟（`run-unit-custom.sh` 里 `kept_node` 为空会直接失败）。
- `out/` 里 `**/test/node/**/*.test.js` 现为 783 个，与源码 `src/**/test/node/**/*.test.ts` 的 783 个一致。不能按 `test/node` 整层排除，否则 Electron 会丢掉这 783 个，而不只是 17 个。核查稿里的 713 与当前 `out/` 不符，以 783 为准。
- HEAD `dev/progress/health-gates.md` 的 unit-custom 行写「十一份」，并写 universeAgent 用 `--excludeRunGlob` 排除。HEAD `scripts/run-unit-custom.sh` 并不传这个参数：它把剩下的文件当成位置参数交给 `scripts/test.sh`。工作区这条在 `:108`，HEAD 在 `:118`。位置参数变成 `opts.run`，在 glob 排除之前就返回。工作区未提交的 health-gates 改成指向 json，不再写十一，也还没有改掉「脚本在用 `--excludeRunGlob`」这个与活码不符的说法。基线头 `:2` 的机器字段是 `universeAgentNode=418`；`:7` 的注释写「D17 那 11 个……418 条」。代码名单是 17。十一是过期注释，不是剩余工作量。
- 静态 import 只是起点，不是判定。直接引了 `node:` 或 `@grpc/grpc-js` 的有 `connectionResolver.test.ts`、`deviceAuthHandshake.test.ts`、`deviceGrantCrypto.test.ts`、`grpcClientSessionToken.test.ts`、`grpcSessionWrites.test.ts`、`localEngineDiscovery.test.ts`、`observeCandidateLeaf.test.ts`、`pairingOrchestrator.test.ts`、`universeAgentChannel.test.ts`、`universeAgentConnection.test.ts`（`node:crypto`，文件约 17331 行）、`universeAgentHubService.test.ts`。`connectionProfileStore.ts:6` 生产文件自己 `import { randomUUID } from 'node:crypto'`。`grpcClient.ts:6` 是 `import type` 的 `@grpc/grpc-js`，编译后可能被擦掉。`connectionIpcSecretBoundary.test.ts`、`connectionProfileStore.test.ts`、`grpcQueueSkillWire.test.ts`、`hubControlPlane.test.ts`、`hubDirectoryClient.test.ts`、`hubSessionStore.test.ts` 的测试文件头部没有这些说明符，失败可能在下游模块。未在 Electron 里实测 cause。

不变量：

- 110 个能在 Electron 装载的 `universeAgent/test/node` 测试继续进 Electron 那一趟。
- 失败名单以外的动态 import 失败仍然中止 runner。
- Node runner 继续跑今天名单上的文件，直到某个文件被修到 Electron 能装载并从此只走 Electron。一个文件不要两套都「算过」却只有一边在跑：修到能装载的，从 Node 专跑集合去掉，改回 Electron 收集。
- 不按整个 `test/node` 排除。
- 不改 `min_cases` / `max_skipped` 的机器语义。集合在 Electron 与 Node 之间搬动之后，用实测条数改头部数字，不手填。

要动的符号与文件：见冲突域表。判定之后才知道生产文件改不改。

调查步骤（p6-3a，只跑不改生产）：

1. 确认工作区 json 与 HEAD 内联名单一致。不一致就停，先问是谁改了名单。
2. 对 17 个文件各跑一次 `scripts/test.sh --run src/vs/platform/universeAgent/test/node/<name>.test.ts`，把动态 import 的完整错误保留下来（不只第一行 `Failed to fetch`）。再跑 `node test/unit/node/index.js --run <同一路径>`，确认 Node 侧是绿还是本身就红。
3. 从报错模块往下看静态 import，直到 `node:`、原生 `.node`、或只在 Node 里能解析的包。记录「测试文件自己的 import」和「第一份真正装载失败的模块」。
4. 对照 110 个不在名单上的文件：若它们的图里也有同样的 `node:` 说明符却能装载，这个说明符就不是原因，继续往下看。

判定：

- 能修：Electron `--run` 装载成功，且用例结果与 Node `--run` 一致。从 json 删除该 basename，并把它放回 Electron 收集、移出 Node 专跑。优先改测试（注入假对象、避免顶层拉起 Node 专有模块）。为了让测试被 renderer fetch 到而去改生产 import 时，必须能说明桌面运行的行为不变；说不清就不要改生产。
- 修不了：原因在 Electron renderer 的动态 `import()` 装不了这条 Node 模块图，而且去掉依赖就不再测到生产代码。文件留在 Node runner。把它挡在 `import()` 之前，两处都要挡，因为选文件有两条路：
  - `run-unit-custom.sh` 把 `UA_FILES` 当位置参数传给 `scripts/test.sh`（工作区 `:108`）。这走 `opts.run`，工作区 `renderer.js:189` 进入该分支，`:195` 返回，`:200` 的 `excludeRunGlob` 碰不到。收集函数必须继续把这些 basename 放进 Node 那一趟，不放进 `UA_FILES`。
  - 不带 `--run` 的 `scripts/test.sh` 用默认 glob。排除要写在 glob 分支里、`import()` 之前（工作区 `:198` 之后、装载之前），只匹配 `universeAgent/test/node/` 下这些 basename。不能只靠调用方传 `--excludeRunGlob`，无参数全量不会传。
- 名单清零指删掉 `isD17UnloadableUniverseAgentNodeTest`：装载失败不再被吞。修不了的 basename 可以仍留在一份「Node 专跑」列表里，供上面两处在 import 之前使用。这份列表的语义是「不要选进 Electron」，不是「fetch 失败了就当通过」。17 个原样留在吞错函数里，不算清零。全部能修时，连这份 Node 专跑列表和两处读取一起删掉。
- 调查期间不删吞错函数。没有 17 行 cause 记录，不开 p6-3b。

改法（p6-3b）：按判定逐个提交。一个文件一个提交，避免约 17331 行的 `universeAgentConnection.test.ts` 和只有几十行的 wire 测试捆在一起。先接上两处 import 之前的排除，再删吞错函数。全部完成后用实测更新 `test-baseline-failures.txt` 的 `min_cases`（`:2` 的 universeAgent 与 universeAgentNode）和 `:7` 那句「11 个」。`health-gates.md` 改成与活码一致：unit-custom 靠收集时拆文件，无参数 Electron 靠 glob 分支排除；两处都不吞装载失败。删掉「用 `--excludeRunGlob` 排除 universeAgent」这句，脚本今天没有这个参数。

明确不改什么：

- 不排除 `out/**/test/node/**`。
- 不改 main 分支上的 runner 来「对齐」（本仓在 agent-ide 上工作）。
- 不把 Node 专跑改成 skip。skip 会撞 `max_skipped: universeAgentNode=0`。
- 不发明新的传输或快照字段来绕开装载。

本地验证：

- 每个文件的 Electron `--run` 与 Node `--run` 如上。显式 `--run` 一个修不了的文件仍会装载失败。这只证明「点名要跑就会去装载」，不能证明门禁没把它选进去。
- 清零后故意把一个不在 Node 专跑列表里的 `universeAgent/test/node` 文件改成坏 import，`scripts/test.sh --run` 必须仍因装载失败中止。
- `scripts/test.sh --glob '**/vs/platform/universeAgent/test/node/*.test.js'`：修不了的 basename 不被装载，这一趟不因它们中止。不在 Node 专跑列表里的那 110 个仍被装载。
- `scripts/run-unit-custom.sh`：`UA_FILES` 不含 Node 专跑 basename，Node 那一趟的个数与列表一致；universeAgent 仍包含其它 `test/node` 文件（`kept_node` 检查还在）；两条的条数与更新后的 `min_cases` 一致，失败集合 ⊆ 名单。

风险与回退：

- 只改 glob 分支、不改 `UA_FILES` 收集，unit-custom 仍会把修不了的文件当位置参数传进去并中止。两处要在同一提交里接上，再删吞错函数。
- 排除写宽会让 110 个文件从 Electron 消失，`min_cases` 或 `kept_node` 会红。排除只匹配 Node 专跑列表里剩下的 basename。
- 生产 import 为测试而改，可能改变桌面主进程的装载。说不清行为就走 Node 专跑。回退是恢复该文件的 import 与名单项。
- 工作区 json 抽取若被别人改写，本片在其之上删项，不把数组抄回两个源文件。

## p6-4 测试 stub

问题类：`contrib/conversation/test/browser` 里有 11 个 `function createConnectionStub`。3 个已经是一行转发。其余 8 个各自抄了一大段连接实现，选项和默认值不同。

证据：

- 一行转发到 `createConversationConnectionTestStub`（`conversationConnectionTestStub.ts:53`）：`connectionPreferencesPane.test.ts:145`、`conversationIdentityStrip.test.ts:164`、`conversationSessionStatusBar.test.ts:26`。
- 可变 stub：`engineSkillsSection.test.ts:43`（默认未连接，`skillsSupport` 默认 `UNSUPPORTED`）、`engineToolsSection.test.ts:59`（默认连接，`toolsSupport` 默认 `SUPPORTED`）、`engineCatalogSections.test.ts:73`、`enginePreferencesPane.test.ts:55`（位置参数：`connected`、`overrides`、`options`）、`engineProviderModelSection.test.ts:43`、`enginePluginsSection.test.ts:61`、`engineMcpRuntimePanel.test.ts:69`、`engineRulesHooksSection.test.ts:46`。
- 静态 helper 现为 `Partial<IUniverseAgentConnection>` 覆盖，`isEngineConnected` 恒为 false，`onDidChangeConnection` 为 `Event.None`（`conversationConnectionTestStub.ts:59`、`:72`）。section 测试要的是可切换的连接、能力项和若干 setter，静态 helper 盖不住。
- 上述 8 个文件里，`engineToolsSection.test.ts`、`enginePluginsSection.test.ts`、`enginePreferencesPane.test.ts`、`engineProviderModelSection.test.ts`、`engineMcpRuntimePanel.test.ts` 同时有并列的同名测试。p6-1 只给并列份改名为 `*.beside.test.ts`，不改这 8 个文件的函数体。

不变量：

- 每个文件的默认 `connected`、能力 support、未覆盖方法的返回值与现在相同。不统一成一份默认值。skills 默认未连接、tools 默认连接，抽完仍是这样。
- 调用点的函数名可以留下薄包装，避免每个 `createConnectionStub({...})` 都改参数形状。`enginePreferencesPane` 的三参数签名保持。
- 3 个一行转发保持不动。
- 不改生产 section 类的构造函数。

要动的符号与文件：

- 在 `conversationConnectionTestStub.ts` 增加一个可变 builder（名字实施时取 `createMutableConversationConnectionTestStub`）。参数含：`connected`、`pairingPending`、`looksLive`、能力快照补丁、方法覆盖。返回连接对象以及 `setConnected`、`setPairingPending`、`setLooksLive`、换 `linkId`、触发 `onDidChangeConnection` 所需的句柄。
- 8 个文件的 `createConnectionStub` 改为调用 builder，只保留该文件特有的默认值、能力 setter 和 RPC 覆盖。
- 文件里现有的 `new Emitter` 若已交给测试的 `DisposableStore`，builder 把 Emitter 交回调用方，由原注册点 `store.add`。不把 Emitter 藏在 helper 里不释放。

改法：

1. 先读每个 stub 的 dispose 点，再抽 builder。一个文件一个提交，顺序任意。
2. 薄包装留在各文件，默认值写在包装里，不写进 builder 的默认参数。

与 p1 分区控制器的顺序：

- 工作区有未跟踪的 [p1](review-2026-11-04-p1-capability-write-gate-plan.md)。它要在 `engineMcpRuntimePanel.test.ts` 和 `engineCatalogSections.test.ts` 补断言，验证命令还会 `--run` 本条其余几份 section 测试。相交面是这 8 个测试文件，不是生产 `engine*Section.ts`。
- p6-4 只抽测试 helper，不改 `new Section(...)` 的参数。
- p1 只要改这 8 个文件里的任何一处（补断言也算），p6-4 等那一片提交后再抽。不并行编辑同一个文件。p1 还没改这些测试时，p6-4 可以先抽；之后 p1 在薄包装之外加断言，不重写 builder。
- p6-1 不编辑这 8 个函数体。p1 写明它那一波不搬并列的 `browser/engineMcpRuntimePanel.test.ts`。p6-1 只把那份并列测试改名为 beside，不改 p1 点名的 `test/browser/engineMcpRuntimePanel.test.ts`。
- beside 新文件若从并列测试复制了自己的 stub，那是 p6-1 的文件，p6-4 不追进去重抽。

明确不改什么：

- 不改 3 个一行转发的文件。
- 不改 `IUniverseAgentConnection` 的生产接口。
- 不把 catalog 大 stub 的多能力默认收成 skills 或 tools 的默认。
- 不改生产分区类。那是 p1 的范围。

本地验证：

- 每抽一个文件就 `scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/<该文件>`。行为应与抽之前一致，所以跑整文件，不用新的 grep 名。
- 8 个都抽完后同样的 `--run` 再跑一遍。`npx eslint` 打这 8 个文件和 helper。

风险与回退：

- 默认值收错会让「未连接」测试变成已连接。每个提交只动一个文件，红了就看该文件的默认参数。回退该提交。
- Emitter 没交回 store 会让 `ensureNoDisposablesAreLeakedInTestSuite` 失败。这就是该文件的验收红，不另记 D17。
- 与 p1 抢文件时按上面的顺序让路，不在脏函数体上重抽。

## p6-5 过程证据入库

问题类：`dev/progress/` 里路径含 `evidence` 的已跟踪文件约占 822 MiB。仓库已经出现过磁盘满。新的大文件继续入库，会把历史和工位一起撑大。

证据：

- `git ls-files` 路径含 `evidence` 的共 5487 个。其中 5485 个在 `dev/progress/`。另外 2 个是源码：`test/mcp/src/evidenceTools.ts`、`test/scenario/src/evidence.ts`，不是证据目录。
- 这 5487 个的表观大小 861672912 字节（约 821.8 MiB），块分配约 833.5 MiB。2 个源码文件很小，体积几乎都在 `dev/progress/`。
- [DOCUMENTATION.md](../../docs/DOCUMENTATION.md) 规则 4 现在要求阶段日志写在 `dev/progress/<topic>-evidence/`（验收证据 + README）。规则 7 第 4 条要求这些目录不因「过程多」而归档。
- `9a21537865d` 的提交说明是保全 ENOSPC 同步现场。磁盘满已经发生过。
- [文档系统设计原则](../../docs/principles/document-system.md) 把过程放在 `dev/`，没有写大二进制可以长期留在 Git 里。
- [文档负担收敛](docs-burden-reduction.md) §5 只规定证据目录不归档，没有规定体积。

不变量：

- 已入库的历史文件本片不删、不搬、不改写 Git 历史。
- 规则 7「证据目录不当过时文归档」保持。
- 2 个名为 evidence 的源码文件不在这条规则里。
- 没有验证证据仍不得把 PRD 标成 `implemented`（规则 10a）。证据可以是仓库外路径加哈希，不必须是 Git 里的大文件。

要动的符号与文件：

- `docs/DOCUMENTATION.md` 规则 4：新建证据只在 `dev/progress/<topic>-evidence/README.md` 写日期、命令、仓库外位置、sha256。截图、日志、大 JSON 不 `git add`。README 本身应是短文本。
- 同文规则 7 第 4 条加一句：新建的大文件不入库；已入库目录仍不因过程多而归档。
- `docs/principles/document-system.md`「知识与过程分开」加一句指针，链到规则 4，不把规则再写一遍。

改法：

1. 只改上面三处句子。
2. 不移动现有 `*-evidence/` 目录。
3. 仓库外放到哪一台机器的哪个绝对路径，由当次 README 写明。本片不规定统一的家目录。

明确不改什么：

- 不跑 `git-filter-repo`，不 `filter-branch`。见待定项。
- 不把现有证据目录归档到 `archive/` 或 `dev/archive/`。
- 不改 `docs-burden-reduction.md` 的归档标准。
- 不把 CI artifact 写成现行出口。托管 CI 已关，没有这条通道。

本地验证：

- `python3 scripts/check-docs-health.py`
- `python3 scripts/wiki/wiki.py check --root .`
- 抽查规则 4 与原则页的链接能打开，两处说法一致：大文件不入库，摘要在 README。

风险与回退：

- 规则改完若实施提交仍把大文件加进来，规则没有机器门。本片不加体积门禁；那会误伤已经跟踪的 5485 个文件。回退是把规则 4 的句子改回去。
- 仓库外文件丢失后，Git 里只剩哈希，复现不了现场。README 要写清位置。这是本片接受的代价。

## 待定项

下面各项不由本稿替用户定。未拍板前不改对应规则，不开实施提交。

### 已入库证据要不要改写历史

- A（推荐，默认）：不动历史。只约束 p6-5 的新增。已有 822 MiB 留在 Git 里。
- B：用 `git-filter-repo` 从历史里去掉 `dev/progress/` 下的大证据文件。这会改写所有 SHA。已有 worktree、已推送分支、文档里的提交链接都会失效。要所有工位重克隆。本稿不执行。

### accepted 要不要设时限

现状：已跟踪的 `dev/plans/*.md` 去掉 `INDEX.md` 后 354 篇，frontmatter 为 draft 155、accepted 103、implemented 96。`INDEX.md` 自身是 `accepted`，不是方案，没有算进去。工作区里未跟踪的审查稿不计入。文档负担收敛不管期限，并写明 implemented 的方案默认不归档。

最近 300 个提交（至 `20a1875017e`）里，标题以 `docs` 开头的 148 个，以 `feat` 开头的 6 个。用 `git diff-tree -c -r` 看这 300 个提交的路径，改到 `dev/plans/INDEX.md` 或 `dev/progress/status.md` 的是 185 个（INDEX 85，status 178）。核查时的 187 与这次差 2，按这次的命令重算。

- A：不设时限。
- B（推荐）：accepted 满 90 天，且文中点名的路径此后没有实施提交，不自动改 `status`。由人决定保持、拆开或退回 draft。句子写在 `docs/DOCUMENTATION.md` 规则 13 旁。不写进 `generate-docs-status.py`。
- C：到期自动退回 draft。不推荐。仍在用的合同会被打回。

### 规则 16 要不要按改动规模分级

现状：新方案或实质改写都要只读审查（`docs/DOCUMENTATION.md` 规则 16）。

- A：维持一律审查。
- B（推荐）：不改行为、不改契约、不改切片、不改待定项的措辞或链接修订，不派 reviewer。其余仍走规则 16。以 diff 为准，作者不能把行为改动称作措辞。不按行数免审。
- C：少于若干行就免审。不推荐。短 diff 也可以改合同。

### 测试通过数要不要禁止写进文档

现状：方案和基线注释里常写「N 通过 / M 失败」。基线头 `test-baseline-failures.txt:7` 的「11 个」已经和代码里的 17 个对不上。文档负担收敛没有这条。

- A：不限制。
- B（推荐）：在 `docs/guides/doc-style-guide.md` 加一句，并在 `docs/DOCUMENTATION.md` 规则 4 用一句话链过去。叙述不写通过条数、失败条数、skipped 条数。写命令、`--run` 或 `--grep`、结果文件路径。`min_cases` 与 `max_skipped` 仍写在基线头里，因为 `scripts/check-test-baseline.sh:62` 读 `min_cases`，`:66` 读 `max_skipped`。不回溯改旧文。
- C：基线头也不许写数字。不推荐。那是比较脚本的输入。

## 审查

2026-11-04 第一轮只读审查之后改过一版。Critical：p6-3 不能只在 glob 分支排除。`run-unit-custom.sh` 用位置参数，`renderer.js` 从 `:189` 进入 `opts.run`，`:195` 返回，不看 `excludeRunGlob`。Node 专跑要在收集 `UA_FILES` 时拿掉，无参数全量才在 glob 分支拿掉，然后再删吞错函数。Important 已改进行号与计数：glob 在工作区 `:199`（HEAD `:216`）；`max_skipped` 在基线 `:3`，`min_cases` 在 `:2`。该轮把间接 `readFileSync` 记成 19 个文件、36 处，本轮「审查处理」已改为四类口径。焦点命令对齐 testing.md，headless 下 skip 不算通过；两个 browser 层扫描测试用 `scripts/test.sh`；p1 方案文件已在工作区，p6-4 在它改那 8 个测试文件时让路。

## 整篇不改

- 不改生产 RPC、快照字段、连接服务的公开行为。
- 不重开 GitHub Actions，不把关闭写成缺口。
- 不把 `valid-layers-check` 恢复为门禁。
- 不执行待定项里的历史改写和规则分级。
- 不更新 `dev/plans/INDEX.md`。索引由父 agent 统一改。

## 审查处理

2026-11-04 第二轮只读审查。逐条对过活码。frontmatter `status` 仍是 `draft`。

### 核对成立，未改对应段落

- 放置与 runner 的主计数、主行号，以及 59 / 32 / 27，与活码一致。5 条焦点测试仍共用并列 `conversationSessionsView.test.ts:160` 的一处 `this.skip()`。
- D17 的 17 个 basename、`universeAgent/test/node` 的测试放置、stub 的 11 处与 skills / tools 默认值、证据体积、顶层方案篇数，抽查后仍与本稿证据段一致。不发明生产 RPC 或快照字段。
- p6-1 与 p6-4 的文件切分、p6-2 等 p6-3 再改那两个 Wire 测试、p1 改那 8 个测试文件时 p6-4 让路，原文保留。
- 待定四项仍不替用户拍板。切片 5 按 health-gates 当未落地。不重开 workflow。与写闸「本波不搬」、文档负担收敛的归档标准不冲突。
- 文体：中文正文、标识符英文、frontmatter、一级标题下的状态行、`覆盖需求` 行、相对链接。没有把规则整段抄进方案。这条没有要求改句子。

### 采纳

- **Critical.** `universeAgentImportBoundaries.test.ts` 写入结构档和不变量。删掉「没有单独的测试文件在扫 `universeAgent/node` 的 import 禁令；不要假设旧方案里的 boundary 测还在」。活码 `:72` 就是 workbench 与 sessions 不得 import `platform/universeAgent/node`，`:82`、`:107` 用 `readFileSync` 扫生产文件；`:98` 起还有 sessionView 父目录禁令。参数文本没有 `.ts`，文件名不含 `Scan` / `Leftover`，不在字面量 213 里，也不在直接赋值的 14 个文件里。`local/code-layering` 只按 `common` / `node` / `browser` 目录名分层（`code-layering.ts:63-78`，`eslint.config.js:400-421`），`eslint.config.js:394` 还排除了 `common/sessionView/**`。规则没接上之前不删这份测试。
- **Important，间接扫描口径.** 19 个文件、36 处和其中 16 个文件、21 处，按原稿口径复现不了。排除 `Scan` / `Leftover` 文件名后，直接赋值是 14 个文件、29 处，零字面量 12 个文件、16 处。同一口径漏掉 `candidates.find`：`grpcTeamUnaryWire.test.ts:297`、`:313` 的 `.ts` 在数组元素里，`readFileSync` 的参数是 `sourcePath` / `clientPath`。这个 Wire 文件没有字面量 `.ts` 参数，不在 61 个里。目录遍历同样在口径外：`universeAgentImportBoundaries.test.ts`，以及只调用 `collectConversationProductionFiles` 的三份 conversation boundary 测。清理范围改为四类并集。S2a 包含 `grpcTeamUnaryWire.test.ts`。只重数第 2 类不再当作补漏。
- **Important，放置检查的提交顺序.** `check-test-placement.py` 和 health-gates 那一行随最后一批搬走再合入。更早的提交不以 0 命中为门禁。工作区里的 `browser/conversationSessionWindowService.test.ts` 仍先让路，检查脚本等它也搬走再合入。
- **Important，焦点样式 URL 与测试指南.** 并列 `:165` 的 `new URL('./media/conversationSessions.css', import.meta.url)` 写入要改的路径，拆到 `conversationSessionsFocus.test.ts` 后改为 `../../browser/media/conversationSessions.css`。`docs/architecture/cross-cutting/testing.md:72-75` 列入 p6-1，`--run` 改到新文件，该页现有的 `rtk proxy` 前缀保留。
- **Minor，`opts.run` 的返回行.** `:189` 是分支入口，`return` 在 `:195`。这条路仍然看不到 `:200` 的 `excludeRunGlob`。p6-1、p6-3 和第一轮审查记录里的同一句一并改了。
- **Minor，基线脚本行号.** `scripts/check-test-baseline.sh:62` 读 `min_cases`，`:66` 读 `max_skipped`。

### 不采纳

无。本轮意见与 HEAD、已签收的 ADR-003、写闸「本波不搬」和 health-gates「切片 5 未落地」都不冲突。
