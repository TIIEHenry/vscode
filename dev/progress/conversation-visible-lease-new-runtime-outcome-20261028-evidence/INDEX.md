---
title: "Conversation lease：唯一 new runtime 实际结果与恢复接收"
type: reference
status: accepted
phase: N/A
updated: 2026-10-28
summary: "唯一new40/238完整，39过1败/L5旧Lens观测I1；driver0仅accounted、official1/newFullfalse；qualified2out与保护获root接收，lane归还，窄draft待审。"
---

# 唯一 new runtime：实际失败与恢复接收

固定 merge `c5eeabbb7e14d783640ed80960a732978ed7a180`、src `c1267f27d022ecaa417ef9065825fb53bacc21ea`。root采纳原 Astra actual FINAL，正式接收完整记账、qualified恢复与全部保护，**不接业务绿**。[root recovery receipt](root-recovery-acceptance.receipt.json)为baseline按root明确授权写下的准确署名记录，13284B/SHA-256 `0bcdb02972350363a58d07480da5f3f28d1776d8b3148942d2638e6d9f0ad4f8`；不是原 Astra或root终端raw。主lease/fixture-budget两plan仍accepted；本轮不升级PRD、宽Sources或D1387。

## 实际结果与未达边界

唯一entry经同PID bootstrap执行，真实host/entry/outer/driver均0，`driverAccountedOutcomeComplete=true`、`diagnosticProtocolStatus=accounted-official-outcome`；**official actual1，businessNewFullQualified=false，Mgreen=false，fullCompile=false**。业务从04:29:22.965733至04:33:38.396397UTC；六阶段为checker/lint/dry/emit-Pane/emit-Reveal/official，actual `[0,0,0,0,0,1]`，无official watchdog。

[原Mocha](official.mocha.json)及[原qualification](official.qualification.json)记录40 unique、39pass/1fail/0pending，test start/end完整、238hook start/end逐title精确配对，无缺失未知。唯一败为L5 `switch input during real catalog pending cannot revive the captured owner`；`only the current input listener may reconcile` 实际0/expected1，generated真实帧908:18。root和原Astra独核为夹具仍统计已disposed的old Lens；真实不同input由EditorPanes先clearInput→Pane teardown/Dispose old→ensureLens successor，currentLens!=old。当前successor lease后继断言**未执行**，不能据39pass推剩余业务通过。失败体因utils泄漏检查规则不授leak-clean；238hooks/owned cleanup分别记账。

两target自然CDP scriptParsed/getScriptSource，loaded bytes=disk=sealed dry=emit WAL；qualified completed writes2、union2/restore2、partial0。原sealed bytes/mode/mtime全回，仅两qualified ctime差异；root独核out15500/repo71267、256pairs、原6759、151绑定tools、freeze4/cache3、pins623及main65/index/HEAD/src/clean。新直接恢复基线为原P `guard-after-restore.json` **20161773B/SHA `336c2ebee511ef8bb667e0fb8e549a7630f798d6ab4bd49b3bf31090ca148a56`**；business-report **644417B/SHA `f2a9e63beedad8931c0203966a5549c135d632fe1848f9fbadab648aba39df08`**。完整身份均见[原件身份表](original-artifact-fullidentities.json)，不复制20MB guard进仓或新包。

## Host归因、尾部闭合与lane

真实host terminal由原会话owner `/root/baseline_executor` 对session59223的空write_stdin观察：chunk93e988、actual exit0；wrapper窗口04:33:20.242Z–04:33:39.654Z。root跨agent调用实际报 `write_stdin failed: Unknown process id 59223`，是session归属边界，不是候选错。root收到原owner实际structured结果并独核entry identity后采用，`observedBy=/root`仅表示接收审查，**不是root native poll**，不是physical raw artifact，也不从entry stdout推host0。[原host receipt](host-tool-terminal.receipt.json)完整保留source observer/call/result、record writer和准确归因；2632B/SHA `e6aeaaa7bff370e185ad05204c81b2f1a62775ae9405a16913a8aaea36433594`。

唯一tail actual0/chunk91a50d；[原external final](external-final-quiet-and-two-lock-release.json)25487B/SHA `e99d148d7e77d58aa4f86c61eb0516cf482417df1f2e2983c5fde94aaf9b1394`。04:36:03.424440及03.525009两次有限样本中，48个实际记录PID/start均absent；两个精确锁文件仍存在，均无matching kernel lock rows或visible FD。473个无关proc FD目录不可读，不能扩大为全局或持续quiet。B driver自有33身份与entry-tail动态48不是同一人口或固定通用常数。原authority8053B/SHA `92869b073188394caf48ac70eae036c58bf564f28efc19ee242b31b742159c46`与entry245637B/SHA `de2fca971eb816b463512ab96e491621ed5b1bca3c64cf2dd45a63c7456b4741`完整身份保持。

root据独核与原Astra裁定正式归还sole runtime lane：`currentlyAuthorizedRuntimeOwner=null`、`formalLaneReturned=true`、原once永久consumed/noRetry。没有新compile/test/UI/engine/C/F授权；I build/after/ready=false，非作者真实默认编辑器after待。

## F至QL的完整历史，不改原件

[分包计数与路径](package-counts-and-separate-lineages.json)及[完整原件身份](original-artifact-fullidentities.json)固定这些祖先；摘要不是raw。P固定为 `/sdd/tmp/vscode-conversation-visible-lease-new-business-20261028-prep2`，D为其`-review`，Q是D/fresh-runtime-preflight而非新sibling。

| 阶段 | 原实际事实与后继边界 |
| --- | --- |
| V31 / E1_23 / N57 | provenance-v2、原entry静态及v2来源独立保留；entry无signal authority，非runtime通过。 |
| F80 | fresh静态包、准备路径读取失败与后来root sourceDerivations读错均原样保留；prepared源不执行。 |
| S4_10 / Q10 | S4非执行compile4/4实际0；Q一次reader/recorder/host1，ENOTCONN原失败；没有业务执行。 |
| O80 / S2_10 | 新recovery overlay源码与完整双向谱系另审；S2仅entry/wrapper非执行compile2/2实际0，不给新业务信用。 |
| W48 / Q2_10 | transient-reader窄修另审；Q2仍host/reader/recorder1、freshSuccessfalse，唯一拒绝为已精确归属的Android esbuild服务链，非泛化名称白名单。原完整扫描/两锁/FD边界保持；477 visibility-only限制与原46FD错误另记。 |
| L118 | qualified-preflight leaf原assembly0；editor e31dda PermissionError1、原sealer ba2a89 SyntaxError1主体未执行；corrected-v2调用0。manifest覆盖/漏candidate.scope两静态Important在执行前发现并v3修正，原Astra/root最终C0/I0/M0、v3 seal e16486 actual0；五inherited Minor仍约束。 |
| S3_10 | 仅entry/wrapper内建非执行compile恰2/2，compiler/recorder/host0；无候选exec/import/AST/pyc/retry，leaf校验通过。[final anchor](syntax2.anchor.json)。 |
| QL10 | limited qualification一次host/reader/recorder0、qualificationSuccess=true/qualificationOnly=true；12保护和8有限观察通过。固定四PID/start Android链精确argv/cwd/exe含deleted exe独立资格，不称idle或连续globalquiet，不改原Q2实际1。[final anchor](preflight-qualification.anchor.json)。 |

[L final anchor](qualified-preflight-leaf.anchor.json)绑定当前effective qualifier35153B/4f29d8、recorder26096B/013942、bindings72698B/5901ea；五Minor为entry不signals、entry0不足须真实host+tail0+authority、None为partial、成功预算非硬quota、旧PARTIAL_SYNTAX4仅历史label。原6759保护行始终独立；separate301=`[31,23,57,80,10,10,80,10]`，后W48/Q2_10成359；L118/S3_10/QL10与consumed P/D-A另列，不做隐含union。

## 可复核外部闭包与错误归因

新独占根 `/sdd/tmp/vscode-conversation-visible-lease-new-business-20261028-prep2-actual-outcome-recovery-20261028T044300Z` 保存P当前**1115项**与D含A当前**110项**完整postrun metadata/hash库存、历史分根完整库存、全部关键原件fullidentity、source15716基线与父docs。原prepared P767/pins623、原D77→Q后87→初始A93只是历史时点，不能代当前库存。包的`complete-inventory.json`、`outcome-recovery.index.json`及`outcome-recovery.anchor.json`按自引用排除规则闭合；anchor自己的最终fullidentity由实际工具结果外递，不猜self hash。成功验收16MiB非硬quota，超限或失败保留并停；不改chmod/追加旧P/D/L/S3/QL，不复制大guard。

[10项reader/preparation错误归因](reader-and-preparation-error-attribution.json)完整保留root F key1、resource/board猜路径2、baseline Q len(integer)1、Astra O empty-diff1/W字段KeyError1、L editor1/sealer1、root跨agent poll错误及db6e3e猜reporter事件名导致后半reader1。纠正后的b59433按实际`testStart/testEndObserved/hookStartObserved/hookEndObserved`核40/238；这些错误不计业务失败，也不抹原Q/Q2 actual1。另有root c862ed/beb319两次猜源路径rg exit2，实际common input/trajectory定位后纠正；[补充归因与L5 frame输入](root-l5-frame-input-and-additional-read-errors.json)另存，不改原10项ledger或已固定root receipt。新draft据真实successor filter拟仅该case optional agentId emission，保留pending-seat frame断言。root17b965只读git遗漏GIT_OPTIONAL_LOCKS=0的[环境偏差](root-readonly-git-environment-deviation.json)另存，报告未改源/暂存，后续环境已恢复。只在会话存在的输出作准确署名记录，不补造raw。root工具077c34/db6e3e/b59433/9f6832→8fc199归属与完成边界见receipt。

[出版copy-map](publication-copy-map.json)说明本目录必要小原件副本与派生记录；完整原件身份仍指/sdd原物，仓内副本不替代持久数据根。门禁和最终source/index/main保护、固定diff/Included清单在新外根出版记录中；本轮仅准备，不stage/commit/push/amend/mainff。

下一步仅[同一L5 successor-Lens窄draft](../../plans/conversation-visible-lease-l5-successor-lens-fixture.md)待root固定核/原Astra规则16。未来直接谱系须绑定新336c2e恢复与本次root receipt；历史9e/6dd的driver1/-15不改，不能把本轮driver0/official1改写或假定旧B latest硬条件可直接复用。source-only候选、工具、新packet及runtime均另外授权。原完整compile未来设计也不因完整记账与恢复被提前释放；M业务资格尚未成立，after与I/C/F继续held。

## 收尾提交门禁（2026-10-28）

本次仅收拢既有七份进度/索引/方案文档、L5 draft及本目录十五份证据，共23路径；保留官方39过/1败、恢复接收及未达到的后继断言，不实施L5或升级方案。提交前已逐文件保存原件、大小和SHA，核定只涉及`dev/`；源码树仍为`c1267f27d022ecaa417ef9065825fb53bacc21ea`，没有编译、转译、out写入或新业务运行。

实际文档健康检查637份Markdown、0 errors/46 warnings，generated-status与diff-check通过，status为200行。文档单测实际6过/1败：`test_head_requirements_fixture_parses_all_prds`固定期望28，当前读取29；测试、requirements与parser均逐字等提交前HEAD，不归因于本次文档检查点，不称全部门禁通过。仅准确路径暂存和正常提交；其他工位及人类WIP保持，不push。
