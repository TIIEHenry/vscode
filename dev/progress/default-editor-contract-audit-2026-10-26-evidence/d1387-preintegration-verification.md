---
title: "D1387 不可变 Sources 源码叠加验证检查点"
type: progress
status: active
phase: M7
updated: 2026-10-26
summary: "65d虚拟noEmit0、完整Electron357过；wiring23过1既有红、lint0错误/56警告；R1/R2精确旧生产各4业务红，尚未正式合源或冻结after。"
---

# D1387 不可变源码叠加验证

> 本文65d及932031均为带时间的历史采样。后续main180fc已真三路接入ad80/src030def并实际完整compile-client0，原生emit已替换全部30旧pack JS，旧pack非live；最新基线与范围见[180fc验证](main-180fc-baseline-verification.md)。未接J/E候选或发freeze。

65d验证采样时，集成源码为 `09f6da72d3056c0c28d4bfaa8b0ceb6dc809b62a`，`src` 子树 `932031c34525449d4010265f914f7074abad2c05`；本检查点只提交文档与验证证据，未正式合入 J 源码。唯一 merge 车道从不可变 Git 提交取出 Sources 主题源码并刷新 `out/`，没有读取 J 未提交文件或写入人类工位产物。最新虚拟主题 ref 为 `65d2288036fdad74ab607e231d3db758fa397aa8`，对应 **完整 10 文件 Electron 357 passing / exit 0、完整虚拟 TypeScript Program noEmit 0 诊断 / exit 0**。

**这不是最新集成源码的实际 `compile-client`，也不是独立界面 after。** 同比较 tuple 出现在多个宿主组时的准确归属仍有独立 Important，澄清稿在 D 的规则 16 审查中，尚无该边界的生产补修；不将当前 357 绿当作该边界已闭。65d 验证采样时，E unary 失败恢复为另一个已授权独立模块，当时 draft / 规则 16 改稿、仍 occupied；该历史采样保持原样，最新阶段见下一节。正式合源须等两模块 queued / 书面范围后按 wave guard 串行；不发冻结通知，不关闭 D1387、不提升产品 PRD。

## 父级独立核验与最新调度状态

记录时间：**2026-10-26 15:12:55 UTC**。父 `/root` 已独立实算纯文档提交 `3760f3cd459fbbf1f9a8314c9528c1b22ee7f8c1`：51 份仓内 artifact SHA256 与 30 份 live out SHA256 均 **0 mismatch**，`HEAD:src` 精确等于 `932031c34525449d4010265f914f7074abad2c05` 绿树。此前 51 份原始证据、采样时 draft、325/3 基线与虚拟范围保持原样；本次只补当前文档，没有新编译、类型检查、转译或 out 写入。

E 的 accepted 方案已在独立工位提交为 `5dd7d97d45b7dfa8827b5cb36f60e85fb61a4f8a`；受审稿为 **SHA256** `262df24edb9db55e2d126dc594d6746d9d77bbd847b581fcdf5c99b06a891cd0`，并非 Git ref。该提交方案正文记录同一 Astra 增量复读 C0/I0，以及新增 Minor 的 blocked / 明确前置返回已纳入合同。父已通知 E 开始完整实现，已在自己槽位 14 条源码路径实施，仍 occupied；E 另发现真实 processFold 的 document-flow 分支也需接正式 busy 投影，已纳入完整模块。**本集成线尚未合入 E 方案或代码**，不把方案 accepted 算作已实施/已验证。

Sources 的新并发意见由 Astra 判为 I1，已采纳同 service / API 完整 tuple 与 custom wildcard 重叠的 sticky 歧义门。随后 D 两轮宿主规则16报告 `7c84e0167e3`（父 `75c3f82994e`）已到，第二轮方案 C0/I0；父进一步通知 J 已独立提交 accepted 方案 `bf50c66b8b970a4e29a1e92f0d3968232e2d6987`，其中 §6 引 D 两轮 C0/I0，实际 matches 方向与历史措辞已改；J 正在自己槽位实施宿主生产和回归。尚无该宿主边界已接入的新生产，当前 357 绿不覆盖该边界，不发 freeze。正式代码合并仍等 J/E 两模块 queued / 书面范围后串行执行。

本轮主工位只读采样先见 `09f6…` 上独立视觉/协议主题 WIP，随后外部 HEAD 前进至 `18cd4bd…`、`3d522e7…`，最后一次采样有 24 条状态路径且该 HEAD 不是 3760 的祖先。本执行者未写主工位源码/out，不要求整理或丢弃其 WIP；仅允许对显式新文档 SHA 尝试一次 `merge --ff-only`，拒绝即停止同步并原样保留，不能报告主工位 clean 或已同步。

主工位不可变已提交 `3d522e76b9985181fa4bdfc654d52c9951f87aed` 相对 09f6 仅 9 份文档，`HEAD:src` 同为 932031；这只核已提交树，不表示其含视觉 WIP 的文件系统源码已绿。仅取该提交真三路合入 `da0d263a1f18c7b79f8983764e1d0356d9c44ee5`，外部 control-detail-polish / engine-protocol-consumption 两方案和索引保留；未取 root WIP。D 的两轮宿主规则16报告 `7c84e0167e3` 真三路接入 `6c75c2ca02694ad794532043c291326d997dda92`，其[历史源码审查](d1387-comparison-gate-code-review.md)和[两轮方案审查](d1387-host-observation-plan-review.md)保持原文。等价两边保留门禁分别 **65 / 117 条路径全 PASS**，见[完整 merge-base/逐路径 blob 门禁](d1387-parent-doc-merges.json)和[主文档 merge 原日志](d1387-main-committed-docs-merge.log)、[D merge 原日志](d1387-D-host-reviews-merge.log)。所有既有 51 份 artifact 与 30 份 live out 身份不变；新合入的仅是文档，不是 bf50 宿主生产或 E 实现。

单次主工位同步实际记录于 `2026-10-26T15:23:56.178016+00:00`：对显式文档检查点 `a7123fb10a5e301210de49d545fb35a67bbea747` 执行 `git merge --ff-only`，Git **exit 128：无法快进，终止**。当次 main HEAD 为 `180fcdbb4ec9fda12a15c3daa6fa48a5e4e742c1`，执行前后 HEAD、全部采样 WIP 文件 SHA、暂存区 diff SHA 和 status **完全相同**；未重试、未覆盖，也未访问/刷新主工位 out。见[原始拒绝日志](d1387-main-ff-attempt.log)与[一次执行及逐文件保留身份](d1387-main-ff-attempt.json)。main 保留独立主题 WIP，不能称 clean 或已同步；merge 的已提交源码树仍为 932031，纯文档分支可继续由父调度，波未完成。

后续每轮编译 / typecheck / transpile 前先核全局活跃进程；发现其他主题已有运行时，记录具体 PID/session 并轮询等待，车道空闲再执行，不杀外部任务、不重复启动。本次纯文档阶段没有新增编译必要性。

## 来源与可复核流程

[最新 30 模块来源/产物身份](d1387-65d-virtual-output-identity.json)逐条记录源码路径、不可变 ref、源码 SHA256、刷新前/后输出 SHA256；包含全部 17 个主题变动路径和 18 个 after 模板生产模块的并集。未改的模板模块先逐字核对 J ref 与 09f6 基线一致。主题 17 路径与 de22 编译合同修复 27 路径无交集；虚拟完整程序在 09f6 其余源码之上精确覆盖这 17 份源码，并保留真实 tsconfig 选项，仅使用 noEmit / skipLibCheck / 非 incremental。没有修改 tsconfig 或压制诊断。

转译沿用仓库 `build/next/transpile.ts` 的 ESM / es2024 / experimentalDecorators / useDefineForClassFields:false / inline map / sourcesContent:false，并修正 `.ts?esm`。源码和 Git 分支保持原样，`out/` 明示为虚拟叠加范围，不冒称整目录来自同一完整编译。全量正式 emit 后必须重新核对实际加载正文、产物身份并重验，不能复用本 pack SHA 声称最终编译一致。[最终当前状态](d1387-65d-preintegration-state.json)实核 30 份 live out SHA，`outFrozen:false`。

测试均用官方 Electron / Node runner；[完整 Electron 命令](d1387-65d-complete-electron-command.json)列出 Changes、Review、DiffRefHelpers、DiffPanel、GitDiffContent、ReviewCommands、ReviewShowForPaths、Conversation fence、shared slot、EditorService 十份完整文件。新用例保留 `editorCommands.setup`、`CommandsRegistry` 真实 handler、`workbenchInstantiationService`、真实 `EditorGroupModel`、`DiffEditorInput` 和 `IOpenerService` mock，未降为 tuple-only 测试。源码扫描使用从 09f6 / J ref 取出的 [40 个实际 Git blob 虚拟源根](d1387-65d-wiring-source-identity.json)，避免误扫 merge 尚未合入的旧源码。

执行 helper 原文同时留存：[精确旧生产红测](d1387-old23f-red-runner.py)、[65d pack 刷新](d1387-65d-install-immutable.py)、[完整虚拟 noEmit](d1387-65d-virtual-noemit.cjs)、[虚拟扫描源根](d1387-prepare-wiring.py)、[不可变文本 lint](d1387-65d-lint-immutable.mjs)。其中硬编码路径和 09f6 HEAD / clean guard 是本次实际执行记录，不是任意当前树可直接运行的通用命令；复用时须先核实书面 source/out 范围，保持唯一编译车道及隔离工位。

## 精确旧生产 red 与后续 green

| 实际执行 | 结果与判定 | 原始证据 |
| --- | --- | --- |
| 原两机制：555c 旧生产 + J23f 新测试 | 0 过 / 14 业务红；12 DTO 断言、2 准确 Conversation 目标被旧 finder 拒绝，已在此前入库 | [原记录](d1387-original-causes-red.md) |
| R1：精确 23f helper + 89f 新测试 | 0 过 / 4 败、exit 1；open/diff × resolve/reject 均多出 pre-pin 业务断言 | [日志](d1387-r1-old23f-red.log) / [源码与恢复身份](d1387-r1-old23f-red-identity.json) |
| 初次 R1/R2 组合旧实现运行 | 4 个 R1 失败编号后，进入 R2 整 identity 断言范围而日志未再推进，外层 180s guard、exit 124；**不计为 R2 业务红** | [原日志](d1387-r1r2-old23f-red.log) / [恢复身份](d1387-r1r2-old23f-red-identity.json) |
| R2：精确 23f helper + 4f7 新投影断言 | 0 过 / 4 败、exit 1；错误改记旧比较身份，漏记后台新比较。replace 两项没有 pre-pin 仍错误，独立证明比较身份根因 | [日志](d1387-r2-old23f-red-4f7.log) / [源码与恢复身份](d1387-r2-old23f-red-4f7-identity.json) |
| 89f focused green：原 14 + R1 四项 + R2 四项 | 22 passing、exit 0 | [日志](d1387-89f-focused-green.log) / [命令](d1387-89f-focused-green.json) |
| 89f 首次完整十文件 | 16 过 / 2 败、exit 1；首个官方 handler 业务断言已过，但测试体内 setup 遗留 46 个全局注册，leak / console hook 各失败，未计产品回归或完整 green | [日志](d1387-89f-complete-electron.log) / [命令](d1387-89f-complete-electron.json) |
| 89f 其余九份完整文件，独立查余项 | 248 过 / 1 败、exit 1；workingTree move 夹具缺完整可信比较身份；不以拆跑代替十文件验收 | [日志](d1387-89f-independent-nine-electron.log) / [命令](d1387-89f-independent-nine-electron.json) |
| 4f7 生命周期修复后完整十文件 | 356 过 / 1 败、exit 1；官方 handler 与真实组模型四项全过，无 leak / console 失败，仅同一 move 夹具失败 | [日志](d1387-4f7-complete-electron.log) / [命令](d1387-4f7-complete-electron.json) |
| **65d 完整十文件** | **357 passing、exit 0**；补 custom fixture 成对 multiDiff URI，保留 move group/resource 断言；原 14、R1/R2、真实 handler/model、状态恢复和围栏均包含在完整套内 | [日志](d1387-65d-complete-electron.log) / [命令](d1387-65d-complete-electron-command.json) |

89f / 4f7 / 65d 八份主题生产文件逐字一致；[源码连续性](d1387-65d-red-source-continuity.json)也证明 65d 的 R1 正文与 89f、R2 正文与 4f7 逐字相同。65d 只加准确 id / 非空窄化、行为状态断言和完整夹具，不重复已证明的旧实现红测。旧红 runner 均在 finally 恢复原 out 字节，前/安装/恢复 SHA 见各 identity；所有业务失败和 guard 原始记录保留。

## 类型、源码扫描与 lint

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 89f 完整虚拟 noEmit | 6 诊断，全在新测试：Conversation getPart 参数三条、root 可空一条、API diff 两侧 resource 可空两条 | [日志](d1387-89f-virtual-noemit.log) / [诊断身份](d1387-89f-virtual-noemit.json) |
| **65d 完整虚拟 noEmit** | **0 诊断、exit 0**，准确 id 与 assert 窄化，未加抑制或宽泛类型断言 | [日志](d1387-65d-virtual-noemit.log) / [覆盖来源与结果](d1387-65d-virtual-noemit.json) |
| 89f 虚拟 wiring | 22 过 / 2 败、exit 1：既有 Accept patch-builder 全局字符串禁止断言，以及已过时的 Review direct setter 字符串 pin | [日志](d1387-89f-wiring.log) / [命令](d1387-89f-wiring.json) / [40 源身份](d1387-89f-wiring-source-identity.json) |
| 精确 09f6 旧 wiring 测试 + 实际 09f6 源码 | 23 过 / 1 败、exit 1，原样复现 Accept patch-builder；生产 sourcesGitHunkPatch 与 89f / 65d 相同。测试 out 以 SHA 恢复 | [日志](d1387-wiring-baseline-existing-red.log) / [来源与恢复](d1387-wiring-baseline-existing-red.json) |
| **65d 虚拟 wiring** | **23 过 / 1 既有败、exit 1**；仅上述 Accept patch-builder，未顺手改无关生产。Review setter 扫描映射真实 `statusIsError` 行为断言，完整 Electron 也通过 | [日志](d1387-65d-wiring.log) / [命令](d1387-65d-wiring-command.json) |
| 4f7 / 65d 全部 17 个主题源码 lintText | 均 0 errors / 56 warnings、exit 0；按 file/rule/severity/message 计数、忽略行位移，新增和减少均 0。未把所有警告冒称 09f6 既有 | [4f7 日志](d1387-4f7-eslint.log) / [65d 日志](d1387-65d-eslint.log) / [实际 delta](d1387-65d-eslint-delta.json) / [命令](d1387-65d-eslint-command.json) |

## 基线与证据保留

既有 [编译合同基线](compile-baseline-verification.md)仍为实际 `compile-client` **45 → 3 → 0、exit 0**，20 文件 Electron **325 过 / 3 既有败**、Node 10 过、Astra C0/I0；三红已用精确 c968 旧测试复现。这里的 357 是 Sources 虚拟主题十文件结果，不能覆盖或改写 325/3 的基线与 D17 事实。正式两模块集成后仍须实际全量 compile-client，之后再绑定最终源树/loaded JS 给非作者默认编辑器 real-Git after。

[原始证据清单](d1387-preintegration-artifact-inventory.json)逐条记录原路径、仓库路径、字节数和 SHA256，51 份日志/命令/身份/helper 均 byte-for-byte 复制。原日志的 ANSI、空白和尾空格保留；源码、Markdown、JSON 仍做正常 diff-check，日志只豁免空白检查，不静默清洗。没有 push，没有写其他工位产物；此文档检查点不推进方案/缺口/PRD 完成状态。

65d 采样时文档门禁实际为 docs health **0 errors / 46 link warnings**、generated status **OK**；status 172 行。见[健康检查原日志](d1387-65d-docs-health.log)、[生成列检查](d1387-65d-generated-status-check.log)与[门禁命令](d1387-65d-docs-gates-command.json)。未改方案状态或生成列，无需改产品规格。

后续纯文档合并与本次拒绝记录的门禁仍为 docs health 0 errors / 46 link warnings，generated status OK；status 175 行，见[本次健康原日志](d1387-parent-sync-docs-health.log)。本轮没有新编译或产物写入。
