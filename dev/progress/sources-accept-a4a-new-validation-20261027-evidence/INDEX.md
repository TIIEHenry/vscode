---
title: "Sources Accept a4a 新源码一次实测与恢复证据"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "新54 Accept+18生命周期逐名实过；完整Conversation3/3、Panel141/142旧stale败，5JS恢复旧native、仅5ctime新基准，fullCompile=false。"
---

# Sources Accept a4a 新源码一次实测与恢复证据

固定执行HEAD **`eefce63e1541625baa39a4abd1608fc3cdbb8c5b`**，sourceRef **`a4a70322795c509e8e9b8274cf295a1b65db663a`**，src **`d78a48e5feee57fcaf5811c8425859d0a2400af0`**。root在接收[真实合源证明](../sources-accept-a4a-formal-integration-20261027-evidence/INDEX.md)后，固定工具与输入、独立审查并只释放一次执行；[实际driver报告](prep2/validation-report.json) exit1，两个完整模块均已完成且finally恢复完成。**新增72条全部实际通过，完整Panel仍有一条旧测试失败。** 本目录的后续proof/docs提交不再执行checker、emit、测试或native activation。

## 两次准备与一次授权

- **prep1未执行**：[原inventory](prep1/preparation-inventory.json)为25文件/519493B（不含inventory自身），SHA `1bf32a5f95d751d332a417256d86754a869ef215d8be96e942f6261e88f007f1`。原Astra只读peer C0/I2/M0及root采纳见[归属摘要](prep2/prep1-blocked-peer-summary.json)：checker3/linter1/reporter2实际LF使JS不可解析、runpy早于工具/HEAD/source身份校验。原JS、14pins及release=false均保留，未为证明历史错误而运行。较早准备generator未闭合括号的SyntaxError仅有[观测摘要](prep1/preparation-observed-failure-summary.json)，不虚构raw stderr。
- **prep2准备**：[原44-file inventory](prep2/preparation-inventory.json)为618582B（不含inventory自身），13316B/SHA `7cdd73bc4f0604f3ff349c576f8c3e2325b8edad63cf5a5345d52ada2006bda4`。六处LF转义、1172B身份块机械前移与早调用详见[路径矩阵](prep2/prep1-to-prep2-path-matrix.json)、[机械patch](prep2/prep1-to-prep2-core-mechanical-diff.patch)及[静态资格](prep2/static-qualification.json)。ownership10969B与run_owned2479B仍精确等run3。root只允许纯语法5个`node --check`，[5组raw stdout/stderr和命令](prep2/syntax-checks/validation.json)全部exit0；Python仅ast.parse，没有借纯语法授权运行prepared工具。随后原Astra C0/I0/M0与root独核接受修订；这是审查归属摘要，不冒充raw reviewer文件。
- **一次实际release**：[授权身份映射](prep2/execution-authorization-identity.json)保留授权前[sealed release](prep2/prepared-state/execution-release.json)1948B/SHA `e2f5004be1ea049a1c6455714fa4bf8c1212bd786b599f29332fe1bececffac2`与[sealed inventory](prep2/prepared-state/preparation-inventory.json)。**原prepared inventory中的`execution-release.json`行现在只映射sealed original**，不能声称逐行仍对应active release。后来[active release](prep2/execution-release.json)3467B/SHA `6922f196ad3762b903b5b2ea66ad21b51a1a010c0c7083793ef69e5a824d791c`明确归属root `2026-10-27T05:06:40.137973Z`的一次授权；[consumed marker](prep2/execution-consumed.json)已存在，不可重跑。14pins未变，127工具/config绑定与5份源码副本由[input manifest](prep2/input-manifest.json)、[source inputs](prep2/source-inputs.json)固定。

## 实际六阶段

[driver raw stdout](prep2/driver.stdout.log) / [stderr](prep2/driver.stderr.log)、[完整stage/PID-start生命周期](actual-six-stages-and-owned-process-lifecycle.json)与原[validation-report](prep2/validation-report.json)保留真实命令、环境、开始/结束、exit、stdout/stderr SHA、deadline与cleanup；没有重试。两完整模块各自为独立官方Electron进程，无grep。

| 阶段 | exit | 实际结果 |
| --- | ---: | --- |
| 项目上下文checker | 0 | 10316 roots /11250 program files；5目标syntactic/semantic、config/global/options、non-target syntactic均0；noEmit=true、emitInvoked=false、writeAttempts=0。non-target semantic未请求，不称全项目语义干净。 |
| ESLint | 0 | 5文件，0error/0fatal、1warning：Panel.test:636 `local/code-no-in-operator`；cache=false、fix=false。 |
| dry | 0 | 真实repository createCompile/ESBuildTranspiler/streamToPromise；5 JS、0 standalone map、0 out写。 |
| 临时emit | 0 | 恰5 JS实际写入：3生产（含未变controller）+2test、0 standalone map；五份bytes/SHA精确等dry。 |
| 完整Conversation | 0 | 官方3tests/3passes/0failures/0pending（2声明case+1官方meta），hooks 11/11无失败。 |
| 完整Sources Panel | 1 | 官方142tests/141passes/1failure/0pending（141声明case+1官方meta），hooks 567/567无失败。 |

[checker report](prep2/source-checker-report.json)、[lint report](prep2/eslint-report.json)、[真实emitter options](prep2/emitter-options.json)、[dry report](prep2/dry-emitter-report.json)、[emit report](prep2/emit-emitter-report.json)、[实际write journal](prep2/out-write-journal.jsonl)、[sealed originals](prep2/sealed-originals.json)逐项留存。`dry-generated/`与`emit-generated/`各五份输出及`sealed-originals/`五份原JS均原字节镜像。Pane/Panel/controller本次producer只在临时stage有效；controller虽字节恰等旧hash仍确实由本次producer生成。当前out已恢复旧native，不称fresh或fullcompile。

## 72条逐名运行资格与唯一旧失败

[72逐名资格](actual-new72-per-name-qualification.json)是从实际reporter导出的72 unique fullTitle：54 Accept（独立Conversation1+Panel文件53）与18生命周期，每条实际testStart/pass/testEndObserved各1、failure/pending/missing/unknown0。`testEnd`从不作为pass；[expected54](prep2/expected-accept-fullTitles.txt)、[expected18](prep2/expected-lifetime-fullTitles.txt)与[expected72](prep2/expected-new72-fullTitles.txt)仅为静态预期，运行资格来自raw事件。

- Conversation：[官方full JSON](prep2/full-conversation-pane.mocha.json)、[raw官方stream stdout](prep2/full-conversation-pane.stdout.log)、[观察事件](prep2/full-conversation-pane.observed-events.json)、[qualification](prep2/full-conversation-pane.qualification.json)、[stderr](prep2/full-conversation-pane.stderr.log)。
- Panel：[官方full JSON](prep2/full-sources-panel.mocha.json)、[raw官方stream stdout](prep2/full-sources-panel.stdout.log)、[观察事件](prep2/full-sources-panel.observed-events.json)、[qualification](prep2/full-sources-panel.qualification.json)、[stderr](prep2/full-sources-panel.stderr.log)。

唯一失败fullTitle为 **`Sources diff panel superseded async render cannot paint an older file diff`**。raw直接见AssertionError，首strict-equal的actual为空串、expected为`stale-panel-b.ts`，临时emitted Panel.test.js:449；后续断言未达。这是旧body失败，非新增72、load/setup或hook失败，不能称完整Panel绿。D/原Astra只读定位旧fakeWidget缺新createViewModel是静态解释，和raw直接证据分列；尚未修复。后续单点docs-only夹具例外先独立规则16，不修改本次三份accepted计划、测试或原报告。

[reporter adapter](prep2/reporter.cjs)保留未改官方full-json-stream与Mocha JSON，并观察pending/testEnd/hooks；本次均完整收尾，没有watchdog partial分支。root初猜事件名`test`、实读`testStart`纠正后独核72通过，归于父读取器schema摘要，不伪作runner失败。

## 所有进程退出后恢复旧native

[guard-before](prep2/guard-before.json)、[emit后out metadata](prep2/guard-after-emit-out-metadata.json)、[实际guard-after-restore](prep2/guard-after-restore.json)及[恢复基准说明](current-restoration-baseline.json)分别保留。32 unique PID/start全部quiescent，6stage均完成cleanup，12 adopted reaps、0signals/0watchdog；kill分支未运行。finally在`2026-10-27T05:08:24.020977Z`完成，5原JS bytes/mode/mtime精确恢复，**仅5个ctime授权差**；其他12549文件/2946目录完整metadata、256旧native bytes/mode、freeze4/cache3均精确。

新guard SHA **`8b5f45b3207be166685bc342025d899c3d237c955847681a41c4f1b9e48c4a04`** 是下一次适用metadata基准。原run3 guard SHA `90f8cd36c22c0503061c8c6df9c1fe6654053043fad1b7857e80a62875955aa1`不重写，二者仅上述5ctime不同。4个a4a新source仍配恢复后的旧native，252其余source/native pair不变；`fullCompileOfFinalSourceTree=false`。不能继续无例外地拿旧run3 metadata守卫判断这次5ctime，也不能运行旧snapshot的旧source断言来验证新source。root在`05:12:34.447518Z`独核当前全部15500metadata等于新guard、32PID/start在`/proc`匹配存活0，详见[父独立复核归属摘要](parent-independent-review-summary.json)。

runtime profile/cache大目录保留原scratch，不入Git；[metadata inventory](runtime-profile-cache-metadata-only.json)原值来自实际driver报告。两份xvfb stderr仍原字节镜像。原run1/probe/run2/run3、正式merge proof/inventories全部不改。

## 持久化与文档边界

[精确artifact inventory](artifact-inventory.json)记录123份scratch→repository镜像、19152383B及逐份bytes/SHA/Git blob；提交前另将每份与staged Git核对。inventories保留历史语义，原件无格式清洗。[原status首条LF与文档变更](publication-documentation-edits.json)保留eefce的原首条SHA `f3e833b8b08c28f3c5c49dc7a233cb9ce42b530b98c07fd56c2e6cb6979c7428`与六份原文；status仍200行。overview、当前看板与三plan INDEX摘要同步当前实际结果，三份Sources plan正文/dispatch JSON/source不变、仍accepted，不升PRD/旧波，overall active。

[本次proof授权归属](publication-authorization-summary.json)仅限原件与同主题docs scoped commit。generator/生成检查、docs health与未暂存diff检查均实际exit0，health608 Markdown/0errors/46条逐项等旧warnings。首次全cached实际exit2/36diagnostics，原始patch的标准空格context与两份原输入EOF空行导致；[原stdout](publication-full-cached-diff-check.stdout.log)4825B/SHA `0719dd0f4fa59ac68aa73104aea49b87fca0cb4ad97a42fbed82019d3d9513a8`保留。暂存该raw后第二次全cached仍exit2，共70diagnostics（增加raw日志自身34处空格）；[lossless UTF8/base64结果](publication-full-cached-with-raw-log-staged-result.json)保存9587B stdout/SHA `fca1c2334bb6be20151db6148a12802fea79e04119f53ed9621246ac6d4740d5`，避免再造递归raw日志。root只授[精确7路径排除](publication-exact-scoped-exclusion-authorization.json)，原件不改、其余全部Included的[真实scoped cached检查](publication-scoped-cached-diff-check-result.json)实际exit0、空stdout/stderr；不声称完整cached通过。[本次publication只读guard](publication-current-restoration-verification-result.json)于05:23:11.662879Z再次确认15500 metadata等于8b5f45基准、256 native/freeze4/cache3全等、32PID/start匹配存活0，未调用prepared代码。一次只读JSON预览把整数字段当集合的[格式化失败摘要](publication-observed-helper-failure-summary.json)归于publication辅助读取器，非runner失败。最终门禁与staged全路径摘要见[publication validation](publication-validation.json)。无push、窗口或引擎启动。
