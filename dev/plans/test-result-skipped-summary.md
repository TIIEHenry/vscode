---
title: "五域测试报告 skipped 汇总完整性"
type: plan
status: draft
phase: M7
created: 2026-11-02
updated: 2026-11-02
summary: "独立处理 D17 中其余三域遗漏 JUnit 根 skipped 的报告债；统一五域既有 max 规则，保留阈值、名单、官方入口与产品验收边界。"
---

# 五域测试报告 skipped 汇总完整性
状态：执行中。负责：agent:sources_final_integration。E工具候选实际23方法/192成功subtest及新旧真实XML预期拒绝已收，独立E OV PASS C0/I0/M0；必要文档/提交门与本地提交、C组合仍待。

覆盖需求：无（维护既有测试报告门槛，不增加产品能力，不提升产品需求验收状态）。

## 1. 来源、固定输入与目标

本方案承接 [D17](../progress/deferred-gaps.md) 已独立登记的报告完整性债，不作全量方向发现，不重新打开上一波 Sources 测试合同。固定分析基线为 C 的正常本地组合提交 `c5416b217b0454fe1655cd30f2a16b5ef995096d`；实际源码为 [check-test-baseline.sh](../../scripts/check-test-baseline.sh)、[run-unit-custom.sh](../../scripts/run-unit-custom.sh)、[既有 Python 回归](../../scripts/tests/test_unit_custom_sources.py) 与[基线文件](../progress/test-baseline-failures.txt)。

现行权威入口和报告合同见[测试与校验](../../docs/architecture/cross-cutting/testing.md#本地自定义五域与严格报告比较)，门禁政策及引用见 [health-gates](../progress/health-gates.md)。上一波 Sources 两域的根汇总规则已采用；其他三个域仍被明确保留为 testcase-only，本次改变必须经本独立方案及只读审查采用，不能借修测试静默翻转旧约定。

目标是把既有 skipped 门槛忠实应用于五域真实报告：`conversation`、`sources`、`sourcesNode`、`universeAgent`、`universeAgentNode`。既有阈值、实际 testcase 下限、failure/error 名单差集和失败退出均保留。

## 2. 已核实的真实输入

五份官方报告原件位于 `/sdd/tmp/vscode-integration-20261102/sources-clipboard-wave/C-EF-final/`，文件名为 `actual-linux-x64-<domain小写>-results.xml`。该目录的 `normal-unit-custom.log` 保留正常官方入口输出。本轮只读直接解析原 XML，未修改、补写或重新生成报告。

| 域 | 根 tests | 实际 testcase | 根 skipped | testcase 子 skipped | 旧有效值 | 新规则有效值 | min_cases / max_skipped |
|:---|---:|---:|:---|---:|---:|---:|:---|
| conversation | 3104 | 3099 | 5 | 0 | 0 | 5 | 799 / 1 |
| sources | 778 | 773 | 5 | 0 | 5 | 5 | 89 / 0 |
| sourcesNode | 59 | 59 | 缺省 | 0 | 0 | 0 | 59 / 0 |
| universeAgent | 1013 | 1013 | 缺省 | 0 | 0 | 0 | 190 / 0 |
| universeAgentNode | 836 | 836 | 缺省 | 0 | 0 | 0 | 418 / 0 |

全部五份为 `testsuites` 根、failure/error 均为零，嵌套套件没有 skipped 汇总。后三域本次根属性是缺省，不能记成实际存在 `skipped="0"`。根 tests 不是 testcase 计数，不能用其补齐下限。Conversation 原 XML SHA-256 为 `a5b83f3cd74232bef966f9fd945f31510f3010f550599b0935c66e7e44833b50`；验证者须冻结五份原件的摘要并在重放后复核，不凭本文摘要替代原件。

Conversation 五项 pending 的分类以原日志及当前源码为依据：

- 一项 `PRD-020 turn fixture bench`：`conversationPrd020Bench.test.ts` 在未设置 `PRD020_BENCH` 时显式 skip；本切片不启用 bench。
- 四项 `Preferences status styles` 的 `provider actions keep focus, hit targets and layout at narrow widths`，分别为 UniverseAgentStudio Light、UniverseAgentStudio Dark、High Contrast Dark、High Contrast Light；`preferencesStatusStyle.test.ts` 在 `!document.hasFocus()` 时 skip。本切片不强造焦点，不修改此环境前提。

因此不能将这五项统称五项焦点用例，更不能把旧比较器的有效值零当真实焦点通过。Sources 的五项 Files 焦点 pending 仍是另一项既有欠证。

已完成的只读诊断只包含：直接解析五份 XML；把当前脚本的原字节内嵌 Python 以 `XML_*` 指向上述原件、以 C 原基线执行。后者实际 exit 1，首错为 `sources has 5 skipped testcase(s), above max_skipped=0`。没有运行 wrapper、产品编译或产品测试，没有执行新候选，也没有取得新合同的验收结果。

## 3. 唯一工具实施范围与不变输入

| 路径 | 授权的后续修改 |
|:---|:---|
| `scripts/check-test-baseline.sh` | 只将既有根 skipped 解析及 max 计算应用于五域，保持其他比较流程与退出行为 |
| `scripts/tests/test_unit_custom_sources.py` | 参数化五域 skipped 合同，明确替换旧三域忽略根汇总的测试，保留入口及其他比较回归 |

仅上述两个工具/回归路径可由后续实施者修改。本方案自身由方案作者维护。`scripts/run-unit-custom.sh`、`dev/progress/test-baseline-failures.txt`、官方 `scripts/test.sh`、`test/unit/` runner/reporter、依赖及配置必须原字节不动；不增加 helper 文件、模块、依赖或通用报告框架，不修改产品源码或产品测试。

真实基线保持：`min_cases` 为 Conversation 799、Sources 89、Sources Node 59、UA 190、UA Node 418；`max_skipped` 为 1、0、0、0、0。现有 failure 名单为空。不得新增失败名单、降低 case 下限、抬高 skip 上限，也不改基线注释来重新解释当前失败。Conversation 五项不能通过把上限从 1 提到 5 放行。

基线缺失、五文件缺失检查、XML 解析、failure/error 识别、classname/name 键、新增失败与 stale 名单差集、全局 fail-fast 次序，以及 wrapper 既有 runner 路由、清报告、Sources Node 非零退出传播策略均保持。不把本切片扩为其他 runner 退出码重构、所有 JUnit 字段一致性审计或切片 5 政策翻转。

## 4. 五域统一语义与已裁结构

每个域继续遍历真实 testcase，分别计数及收集 failure/error。随后对该域唯一根节点读取 `skipped`：缺省为字符串 `"0"`；存在时须完整匹配 ASCII `[0-9]+`，空串、符号、负数、小数、文字、空白、换行和非 ASCII 数字均失败关闭。有效 skipped 为 `max(testcase 的 skipped 子节点数, 根 skipped 整数)`。

不相加根和子数量，不累加嵌套套件，不从根 tests 推导 testcase 或 skip，不从 stdout 名称猜计数，不改官方 XML。根小于子时保留子数量，根大于子时保留根数量。Sources 两域在此规则下语义不变。

2026-11-02，agent:astra_aria_reporting_arch 已独立裁决 APPROVE，root 明确采纳选项 A：

- 采用选项 A：在当前五域同一循环中撤去 Sources 专属条件，复用现有根解析块；代码只有一个消费点，不产生重复实现。
- 不采用选项 B 的小内嵌 helper：当前单一循环可直接复用，无需新抽象。不新增 helper、模块、通用策略表或框架。

裁决确认五域统一规则、两路径工具范围、旧兼容测试显式替换与有限验证，未改变测试阈值、runner 或产品范围。架构意见不等于实施授权；本定稿还须另行独立只读方案审查，父调度核验并采纳后才可实施。

## 5. 既有回归合同的明确替换

`test_other_domains_keep_their_original_root_summary_policy` 当前明确允许 Conversation/UA/UA Node 的根 `"5"`、负数、文字与 Unicode 数字；它锁住上一波的范围冻结，不是无意遗漏。本次经新方案采用五域合同后，点名替换为三域根统计和非法值失败关闭控制，不能只删旧测试或修改 expected 换绿。

`test_other_domains_still_enforce_child_skip_limits` 当前以非法根加超限子 skipped 证明旧子计数。新合同下非法根应先拒绝，故该测试改为合法缺省/零根下的子超限控制；非法根由专门合法性矩阵覆盖。

现有 Sources 根专属测试可参数化到全部五域，保持 Sources 原正负覆盖。真实基线阈值及空名单断言必须保留。为区分 max 与求和，仅允许在临时合成回归夹具中明确设置测试用阈值，不能改真实基线或真实 XML；临时夹具通过不得称为正式五域通过。

## 6. 有限正负控制与真实 XML 重放

| 检查 | 必须证明 |
|:---|:---|
| 五域根缺省和 `"0"` | 均按零处理；继续执行 case/failure/skip 门槛 |
| 五域上限与超限 | Conversation 根 1 接受、2 和 5 拒绝；其余四域根 0 接受、1 拒绝；真实 Sources 根 5 仍拒绝 |
| 根大于子、子大于根、两者相等 | 有效值取 max；根零不能隐藏子 skip；相同根/子不重复相加 |
| 五域根合法性 | 空串、`-1`、`+1`、`1.0`、文字、首尾空白、换行、阿拉伯及全角数字均拒绝；合法 ASCII 非负整数接受后仍受阈值限制 |
| 嵌套套件 | 根缺省或零且嵌套套件声明 skip 时不累加；真实 testcase 子 skipped 仍计数 |
| case 与失败集合 | min_cases 原值不动；下限不足、新 failure/error、stale 名单继续拒绝；合法基线失败匹配的既有策略保持 |
| XML 与 wrapper 原控制 | 缺失、空、坏 XML 失败关闭；保留五域路由、结果根优先级、旧报告清理、缺源及未路由文件、打印分支、Sources Node 非零退出等既有控制 |

验证由本聊天唯一 integration 串行执行；实施者不另启产品测试、编译或 lint。先冻结两个候选文件及不变输入、五份原 XML 和旧 checker，执行 shell 语法与完整既有 Python 回归文件，不只挑新测试。stub 回归仅证明真实脚本的控制分支，不替产品 runner 或焦点验收。

前后对照必须使用相同原 XML 与原基线：旧 checker 的首错为 Sources 5 超 0，新 checker 按当前域次序应首先报 Conversation 5 超 1，并非新引入产品失败。需保留原退出码和错误信息，不能吞 exit 或把预期拒绝写成正式门禁通过。全局 fail-fast 后没有执行到的域不能称为比较器通过。

Sources 原件的 5 超 0须单独确认：直接解析未改原件得根 5/子 0，结合保持的上限零；候选脚本的独立合成 Sources 根 5 控制须实际拒绝。UA 两域原件根缺省、有效值零由逐域解析佐证，五域候选统计分支由参数化回归覆盖。逐域解析不是生产比较器逐域通过；本方案不增加生产 helper，也不把未实际调用的诊断 helper 写成通过。不得为拼出一个真实全绿五域组合改写、替换或筛掉 Conversation/Sources XML。完成后复核原件、基线、wrapper、官方 runner 与依赖摘要保持。

这是工具切片，不为本切片单独重编译产品或重新跑未变的五个产品域；若与其他产品切片组合，组合需要的 fresh 编译/正式 runner 仍只走唯一串行管道，成绩各自说明范围。已有 23 项脚本回归和五域运行属于历史输入，不自动变成本候选的新通过。

## 7. 工位、文档责任与采用顺序

本稿只新增在 C；编码工位、分支、基线及验证 owner 由 root 在方案门通过后明确，不移动现有工作树或 refs。编码前重查相关工具/测试路径占用；当前只读观察 main、A/B/C/D/E/F、merge 的 checker、wrapper、基线和整个 `scripts/tests/` 均无相关 WIP，这不是外部工作树写权。

旧 Sources 候选 `8fc3acf146b0f7e99c48eb62ea4d3cb63bacb209`、Hub 候选 `badd324391ed49b051f4c5ca6fde8bacd16ebaca`、E `106da215b5f7f7e62f95c5825017a741a22ae8a8`、F `ad6a35b50bc655c8209e125dee6c1544d2b687f7` 引用保持；不导入外部 ui-adaptation/evoflow wrapper 的 17→14 文件列表差异，不接管其他聊天的 wiki 目标，不 fetch/push 或改共享 main/merge。

顺序为：完成本稿及 Astra 结构裁决 → root 派另一独立只读方案审查 → root 核验意见并改稿、明确采用及实施授权 → 独立实施者只改两工具/回归路径 → 唯一 integration 运行有限验证 → 独立 OV / CommitGate → 另授本地正常提交。方案提交与实施提交分开，不能以架构审查代替最终 OV。

必要知识同步由 integration 窄改，不由本方案作者改其他路径：`testing.md` 将“只对 Sources 两域”更新为五域合同，保留历史时点和焦点边界；`health-gates.md` 更新对应引用措辞，不复制第二套命令/规则；D17 只更新本项报告完整性债及关闭证据，status/索引按仓库规则维护。不会关闭 D17 整行，也不抬 PRD、真实 UI/Engine/Hub/OS Clipboard 的验收状态。

## 8. 停止条件与完成边界

出现同路径外部 WIP、需改真实阈值/名单、需改变已采纳 Sources 语义、需改官方 runner/依赖、需要产品改动或无授权结构扩展时，停止实施回 root/Astra 裁范围，保留原件。若根格式或报告结构与固定输入不同，先记录实际差异，不用宽松转换或伪造 XML 掩盖。

本项关闭条件为：新合同获独立方案审查和 root 采用；两个限定路径实施；有限正负矩阵通过；未改原 XML 的新旧重放得到准确预期拒绝；不变输入保持；integration 完成必要文档同步；独立 OV / CommitGate 签收。

工具回归全过与真实报告被准确拒绝，只能证明报告统计债闭合。Conversation 的一项 opt-in bench 与四项焦点 pending、Sources 五项焦点 pending、其他真实窗口/Engine/Hub/OS Clipboard 欠证和既有 56 条 lint 诊断继续分别记账；不强造焦点、不启 bench、不宣称正式五域或严格 lint 全绿。

## 9. E 槽实施候选冻结（2026-11-02）

agent:test_root_skips_e 按 root 的明确授权，在正常方案提交 `116033c4bbed7d38d5ee3912e6e23412003da10d` 上的 `codex/test-root-skips-E` 实施；写入前工作区 clean，原方案 SHA-256 精确为 `454ac9cad4af68ec7b07df4b473fe96bc07373e8967ab2526a14e6bb593f560c`。本节仅记录实施候选，不变更前八节合同、方案状态或验收结论。

- `scripts/check-test-baseline.sh` 仅撤去 Sources 两域条件并退一层缩进，原 `[0-9]+` fullmatch、缺省零和 `max` 计算在同一五域循环复用；未增加 helper 或调整其余流程。
- `scripts/tests/test_unit_custom_sources.py` 保留前 16 项既有控制方法；末尾七项改为五域矩阵，明确替换两个旧三域兼容测试。静态展开为 181 个 subtest：根合法边界与前导零 26、根/子双向及相等的临时门槛控制 40、缺省/零根下子超限 10、非法根 75、嵌套汇总忽略 10、缺省/零根为零 10、嵌套 testcase 子 skipped 仍计数 10。总方法数仍为 23，尚未运行，不能写成通过数量。
- 夹具仅增加把 testcase 放进既有嵌套 suite 的可选分支，用于区分“忽略嵌套汇总”与“仍遍历嵌套 testcase”；默认 XML 形状和既有 runner 路由夹具不变。临时门槛调整只替换临时基线的 `max_skipped` 行，不触碰 min_cases 或真实基线。
- 前 16 项继续覆盖官方入口 argv、Sources 文件集合与真实阈值/空名单、failure/error、case 下限及子 skip、缺失/空/坏 XML、Sources Node 非零退出、旧报告清除及失败、结果根优先级和回落、缺源/未路由源、print 分支、Sources 五 pending 拒绝以及新失败/合法名单/stale 差集。

候选工具摘要：checker 为 `e228e19dd79efc7c58d3687edac5792aa8094e45b7b2a6624d9bcb6dfae5283d`，Python 回归为 `87370c8fb6b28f524ebcd52759074baf296a007d90a6456548fd52f0860afb32`。wrapper 仍为 `c72c391658470184792c1c4f4458da2b81eafb53d6092f6b1ca9abee2a997a57`，真实基线仍为 `b1bb4c51d4b4972c087befa7d6136ef1ca5714d9e9cd540739de60e69f2554ed`，与实施前读值一致；官方 runner、依赖、配置、产品源码、真实报告及其他 refs 均未写入。

实施者未运行 shell 语法检查、Python 回归、产品编译/测试、lint 或文档门禁，也未暂存或提交。下一步由唯一 agent:sources_final_integration 冻结输入，依 §6 串行运行完整 23 方法回归及新旧真实 XML 重放，保留预期拒绝的原退出码，再同步公共知识与行动层文档并交独立 OV / CommitGate；本候选不自行宣告验收完成。


## 10. E 工具候选实际验证（2026-11-02）

候选固定 `codex/test-root-skips-E@116033c4bbed7d38d5ee3912e6e23412003da10d`；checker SHA e228e19dd79efc7c58d3687edac5792aa8094e45b7b2a6624d9bcb6dfae5283d、Python SHA87370c8fb6b28f524ebcd52759074baf296a007d90a6456548fd52f0860afb32。作者只§9追加的交接正文SHA057ce7cd已在运行前冻结并保留原字节，当前仅由integration追加本执行记录与状态，不改已签收合同。wrapper SHA c72c3916、真实baseline SHA b1bb4c51及官方runner/依赖原输入保持。

唯一integration在固定本聊天flock、Node24和短私有0700 TMP下执行：checker shell语法exit0；完整既有Python文件按标准unittest discovery执行23方法/0failure/0error，实际addSubTest事件192个全成功，其中原16方法有11个、扩展后7方法181个。原16方法名称和AST逐项保持；作者“23方法+181subtests”静态数只对应后7，不能替代运行192或写成181个方法。审计result只记录addSubTest后委托标准父类，不改变测试执行或断言。

对相同五份未改正式XML与原真实baseline，隔离旧checker首错Source5>0、exit1；新checker首错Conversation5>1、exit1。原五XML在复制及重放后逐SHA一致；Source原件根5/子0、原上限零另有直接解析记录，独立全合成Source0控制exit0/Source5控制exit1，证明仍严格拒绝。合成控制与真实五XML分根存放，未改写或替换真实报告拼绿；fail-fast没执行到的域不称比较器通过，UA根缺省不写成原件显式零。此工具切片未compile或重跑未变的五个产品域。

原件在 `/sdd/tmp/vscode-integration-20261102/aria-reporting-wave/E-validation/r1/`：`frozen-source-manifest.json`、`frozen-source.diff`、`author-frozen-plan.raw`、`checker-shell-syntax.log/.exit`、`full-python-audited.log/.exit`、`actual-unittest-methods-subtests.json`、`original-controls-continuity.json`、`real-five-old.log/.exit`、`real-five-new.log/.exit`、`synthetic-sources-0.log/.exit`、`synthetic-sources-5.log/.exit`、`real-report-replay-and-causal-proof.json`与`actual-commands.json`。根目录批次session8781已终态；静态源码与运行独立OV均PASS C0/I0/M0，不代必要文档Gate、正常本地提交或C组合验收。

工具报告完整性债仅在E候选自动层通过，尚待本地提交与组合签收；D17整行、Conversation实际pending、Sources五focus与56继承lint、真实默认窗口/读屏/Engine/Hub/OS Clipboard/PRD边界继续保留。本阶段未暂存或提交实现。F消费失败是另一slice原始运行事实，不由本工具修订或本方案改断言。
