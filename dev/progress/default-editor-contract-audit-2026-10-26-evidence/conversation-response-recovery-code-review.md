---
title: "Conversation 响应恢复实现独立审查与三项补修复读"
type: reference
status: accepted
phase: M7
updated: 2026-10-27
summary: "保留900f原三I及c2b闭合历史；正式关联运行暴露ack错误隔离回归，增量静态裁定C0/I1，resync两次为旧有界重试合同，旧运行复现另证。"
---

# Conversation 响应恢复实现独立审查与三项补修复读

## 1. 审查身份与证据边界

审查人：非作者 `/root/architecture_audit`（Astra），同一 reviewer 连续审查。初版审查原件为会话中交父代理的完整最终输出；本报告于2026-10-27将其原实质意见落库，并追加不可变修订复读，不把初版历史改写为通过。

| 对象 | 不可变身份 | 结论 |
| --- | --- | --- |
| accepted方案 | `5dd7d97`；此前受审稿SHA256 `262df24edb9db55e2d126dc594d6746d9d77bbd847b581fcdf5c99b06a891cd0` | 方案C0/I0；不等于实现通过 |
| 初版实现 | `900f772bfd139214651a7c15e82678a1a0ef6f69`；src `da5aa1664b65970dc72790749b1101c4534f074f` | Critical 0 / Important 3 / Minor 0；当时不可formal queued |
| 修订实现 | `c2b1266006b7c192fbaaf737e80be25726021fc4`；父为900f；src `43743552d07546d34bf19eab097cd3f197250691` | Critical 0 / Important 0 / Minor 0；原三项源码实质闭合 |
| 报告工位基线 | B由clean `e1150a40a31`仅Git ff至 `19b91119a5524a4d2a339487441eb04543a6534e` | 仅本报告与证据INDEX写入，不合入E产品源码 |

初版逐项读21路径（17 TS、4文档）；复读逐项读900f→c2b的4 TS、4文档差异、相关完整实现及新增回归断言。E受审HEAD/src已用Git核对且工作树clean；两次差异的 `git diff --check` 均通过。审查过程未构建、typecheck、transpile、写out或运行业务测试，也未读取或修改root/E未提交WIP。

运行证据由唯一merge车道另行负责：[最初六项旧业务红](je-preintegration-old-red-verification.md)、[c2b测试配精确旧900f的五项代表红](e-c2b-review-old900f-red-verification.md)。这些都是旧生产业务失败证据，不是c2b运行green；本报告的“闭合”仅指源码及回归设计复读。

## 2. 900f原始独立实现审查

### Strengths

- canonical typed projection、完整snapshot的kind/agent/最长question alias校验已接通，局部结果不落裸字符串map。
- shared binding先占用attempt、安装全部consumer、再同步通知；started/inFlight/blocked/untracked分支明确；untracked完成不按sessionId寻找后来binding清理。
- sidecar-only通知、实际row与pending alias失效、正式scope/incarnation、Question答案/customText/activation草稿，以及document-flow processFold busy接线完整。
- 六条业务测试使用公开roster、真实lease/projection/TimelineHost DOM；同帧重建六项、权威结果九项及双consumer重入有实质断言。未发现新增RPC、持久化或platform→workbench反向依赖。

### Critical

0。

### Important

**I1：timeline-only client-tool成功后丢失blocked身份，可再次发送。**

900f的 `conversationResponseState.ts:89、205` 与 `conversationEngineFrameSource.ts:198`：无pending、仅有 `respondable:true` 工具行时首次响应可以started。accepted helper写入终态并移除respondable；upsert导致语义退休，resolver不再承认候选，旧记录尚未blocked也留不下tombstone。下一次响应成为untracked并继续unary。权威terminal先到存在同一漏洞。

原修复要求：从已确认的旧client-tool身份生成关闭态，不能把普通终态tool全当client-tool；补timeline-only accepted及authoritative terminal先到、旧false/reject/accepted晚到的公开roster回归，重复响应false、RPC次数不增加。

**I2：换链/断连先通知scope，再关闭写门，存在同步重入窗口。**

900f的 `conversationEngineRosterService.ts:229、2081` 与 `conversationEngineFrameSource.ts:266`：resetResponseScopes同步通知listener时，public disconnect尚未写disconnected，identity adoption尚未更新bound identity/清旧sessions。listener重入可取得新scope ticket并立即发送；identity切换时可能把旧目录请求发往新连接。generation只废弃旧票据，挡不住当时新建票据。

原修复要求：先使转换期间写门生效，再发布scope，同时保持旧cache归属；补真实断连及published identity切换通知内三公共API同步重入负控，要求零新增unary。

**I3：同generation baseline改变实际行语义时，仍复用旧attempt。**

900f的 `conversationResponseState.ts:140、187` 与 `conversationEngineFrameSource.ts:178`：有pending时semantic只由pending summary生成。同代baseline保留pending但修改已有question行options/items或工具参数，旧ticket仍current；逐行语义退休仅在patches路径执行。旧false/reject可污染新题目，旧accepted可清理新内容。

原修复要求：baseline也核对已存在interactive行的语义；保留pending-only→合法materialization不退休合同；补baseline行替换×三种旧结果，保留同语义重放busy正控。

### Minor

0。

### Assessment

初版C0/I3/M0，三项均属accepted方案既有合同，须原作者修正后复读；当时不可formal queued。初版旧红不替代上述边界修复，也不代表新实现运行通过。

## 3. c2b不可变修订复读

### Strengths

**I1已闭合。** `conversationResponseSemanticChanged`将已知client-tool进入终态时省略respondable/call chrome与显式内容替换区分；FrameSource和State共用这一比较。State仅从旧已知clientTool记录保留blocked tombstone，核准确现存行、语义、agent及非退休身份。未曾承认的普通terminal tool没有候选或旧记录，仍untracked。accepted仍走原cleanup，关闭状态撤销旧attempt，晚到结果不取得所有权。

**I2已闭合。** public disconnect先写连接关闭标记；真实disconnect先撤掉display override。identity adoption在cache capture前进入计数transition gate，以旧bound identity保存旧bucket，再提交新identity/目录，最后发布scope及session通知，finally离开gate。dispatch开始与begin同步通知返回后均复核实际live连接、transition gate及captured generation/identity/ticket。原先能新建票据的重入窗口已关闭，没有新服务或协议能力。

**I3已闭合。** State保留已materialized行summary，reconcile除pending canonical semantic外逐一比较先前实际行的规范语义；baseline与patch均经过该入口。已有行options/items/args改变使旧incarnation退休；首个materialization在旧rowSummaries为空时允许复用，再保存新行summary供后续比较。同语义baseline重放保留原attempt。

共18项 `response recovery review` 测试已阅读具体触发和断言：

| 原项 | 数量 | 实际公共路径与断言 |
| --- | --- | --- |
| I1 accepted | 1 | 无pending且带callId/callIds的工具；真实host点击→busy→accepted helper去respondable→公开重复respond=false、RPC仍1、post=0 |
| I1 terminal先到 | 3 | 真实host开始后stream terminal；旧false/reject/accepted分别迟到；重复respond=false、终态snapshot不变、RPC仍1、DOM无旧错误 |
| I1普通terminal正控 | 1 | 普通server tool公开响应保持兼容转发1次，无typed byRow所有权、本地snapshot不变 |
| I2断连 | 2 | public disconnect和真实connection disconnect；真实lease scope发生变化的listener内依次调用三公共API，均false、三RPC计数均0、无busy |
| I2 identity | 1 | A/B缓存含同session id，published identity切换；scope listener三API均false且零RPC，并核A保持Live A、B保持Cached B的bucket归属 |
| I3已有行变化 | 9 | question options / question item id-title / clientTool args × 旧false/reject/accepted；pending逐引用不变，先验同语义baseline仍busy，再验替换解除旧busy/清draft，真实新点击建立新attempt，旧结果不改snapshot/不解除新busy/不显示旧错误，当前结果仍就地恢复 |
| I3首次materialize正控 | 1 | pending-only公开响应后baseline首次物化合法行；真实按钮保持busy，二次公开响应仅已处理且RPC仍1，当前false恢复实际行 |

baseline测试夹具同generation递增frameId/version，避免“同语义重放”被重复frame key吞掉。新增测试没有调用State/begin私有替代入口，交互项使用真实TimelineHost与processFold。保留最初六项业务整链及既有同帧/权威结果矩阵。

### Critical

0。原审无Critical，本次未发现新增Critical。

### Important

0。900f原I1/I2/I3均已按原合同实质闭合，未以测试数量或作者摘要替代源码审查。

### Minor

0。

### Assessment

c2b实现peer为C0/I0/M0，可交唯一lane继续整合验证；本报告不自行宣告formal queued、implemented或完成交付。唯一lane仍需按授权顺序真三路合入、完整编译、`response recovery`及完整相关套、新产物身份核验，再进行非作者默认编辑器after。方案生命周期与PRD/D项状态本次不修改。

五项旧900f代表红的准确阶段：I1已到accepted后重复响应，I2已到scope通知中的三API重入，其后缓存归属断言尚未达到；I3在baseline替换后的DOM仍busy处即失败，尚未达到参数化旧结果完成。不得把这些旧红扩写为c2b green或全部late-result运行验证。

## 4. 文档提交范围

只增加本报告及本证据目录INDEX；不改产品、方案、status或并行调度结论，不写out，不push。文档updated为2026-10-27；本次提交前检查限定为diff检查与只读docs health。知识层无新合同需要同步，正式状态更新由父/唯一lane在接入证据时维护。

本报告工位文档门禁：`python3 scripts/check-docs-health.py --max-details 3` exit0，检查589份Markdown，0 errors / 46 link warnings / 0 frontmatter warnings；不将其他工位的73warnings计数沿用到B。暂存两路径后再执行 `git diff --cached --check`。

## 5. 正式集成关联运行后的F1增量审查（2026-10-27）

### 对象、来源与现行裁定

父转达并由reviewer只读日志核对：最终集成 `0008234e2ebe23ca129cd36f8402b2ff71bf2dea` / src `1ee09f7185369bd3090ae7788e1bfc8ea413149a` 的关联运行在FrameSource F1出现20 passing / 3 failing。原日志 `/tmp/vscode-je-formal-E-related-full.log`；唯一lane负责永久运行原件及精确旧5df隔离复现。本次reviewer仍未运行测试、构建、typecheck或transpile。

本节现行增量裁定为 **Critical 0 / Important 1 / Minor 0**：ack异常隔离在E900f搬移代码时退化，是当前E范围内必须修复的回归。第三个afterEach失败是同一泄漏的后果，不另计第二个Important。第2、3节保留当时三项意见与闭合历史；前两轮静态审查漏识别了本项，不能以当时C0/I0覆盖正式运行新暴露的问题。

### 不可变比较结果

| 版本 | FrameSource Git blob | 相关变化 |
| --- | --- | --- |
| `5df17cb7273f490ccd59818dccba479fa80848dc` | `6c5250e20482e36ff7e7144f350781faf46bd02d` | acknowledge末尾为双catch |
| `900f772bfd139214651a7c15e82678a1a0ef6f69` | `1a1e003b16a817bfd0ddfa233acd7e12e14c591d` | onHostFrame迁移为notifyApplied时变单catch |
| `c2b1266006b7c192fbaaf737e80be25726021fc4` | `a243037cd29e1ec50ace17c7af2afbe4069a799c` | 仅改语义比较，单catch仍在 |
| `0008234e2ebe23ca129cd36f8402b2ff71bf2dea` | `a243037cd29e1ec50ace17c7af2afbe4069a799c` | 与c2b逐字相同，非整合冲突引入 |

四版本的 `resyncPending` 字段至 `requestResync` 方法块SHA256均为 `bcfc736085a4f3ceb49949206f4e5fda3b2d9f271712914fdb42649b66e2a0b6`。从resync reject用例起至releaseLease reject用例前的三项相关测试块SHA256均为 `5370cec618feeb09f02b97dc9a5146609fb351ff0e2a0e50b17667050048d1fc`。`src/vs/base/common/errors.ts` 四版本blob均为 `35bb755608e5e9b2983a5d6de61364f8da0573ea`；Electron runner `test/unit/electron/renderer.js` 均为 `53f407094d85d803e55eac5fa9b599e5709c330d`。

### resync两次：旧合同与旧断言冲突，不是E新增重试

`requestResync`第一次reject在catch置followUp，finally清pending后发第二次；第二次reject因followUpFromFailure已置位且无新缺口，不再发第三次。该状态机四版本相同。5df旧lease.onHostFrame遇坏帧也会进入同一方法；E把坏帧恢复入口移到shared binding，没有产生这条拒绝路径的额外第三调用。

既有accepted[方案r08-4](../../plans/review-2026-10-08-r08-conversation-session-plan.md#r08-4hold低)已明确：失败本身触发恰好一次跟进，跟进再失败且无新缺口不继续循环。当前旧测试却把requestResyncCalls写死为一个元素。因此静态判断是旧fixture未对齐已有有界重试合同；是否精确旧生产实际同红，须引用唯一lane运行结果，不能只以本段静态推演冒充旧red。

Astra边界决策：保留已有有界重试生产逻辑，不为使旧断言通过删掉失败跟进。可由原E在该相关测试内对齐两次且无第三次的合同，保留无未处理拒绝、坏帧不落snapshot、不repaint、不ack等全部断言；不新增产品模块或架构方案。

### Important：ack回调迁移丢失第二层错误隔离

旧5df在有效帧应用后的ack链为 `.catch(onUnexpectedError).catch(onUnexpectedError)`；900f新 `EngineSessionViewLease.notifyApplied` 只保留一次catch，c2b与最终集成均未恢复。测试明确将unexpected handler设为第一次记录并throw、第二次记录后返回。当前ack拒绝后第一个handler再抛，链尾没有接收者，所以只有一次unexpectedWarns，并产生新的未处理Promise rejection。它不是“告警次数优化”，也不能改expectedWarns为1来消掉失败。

日志中局部 `unhandledRejections: []` 不代表无泄漏：fixture只监听Node `process.on('unhandledRejection')`，Electron runner还在 `renderer.js:311–318` 监听浏览器 `window.unhandledrejection` 并收集错误，随后 `renderer.js:343–351` 的全局teardown报ack boom。日志与静态链路一致：第二条测试失败和第三条afterEach失败来自同一ack泄漏。

Astra边界决策：由原E在本次搬移路径恢复原有ack错误处理合同，最小修复是补回迁移时丢失的第二catch；不拓展为全仓错误处理框架，也不声称有限双catch能容纳任意永远抛错handler。保留既有warn-then-rethrow用例，必要时在局部fixture增加浏览器与Node双通道观测并在finally恢复监听；不得跳过全局unexpected-error门禁或削弱无泄漏断言。

### 验证交接与Assessment

唯一lane宜分别隔离精确旧5df的resync与ack用例：静态预期是resync同红、ack warn-then-rethrow旧绿；如实跑不同，先核实际模块身份和错误通道，不能推翻日志或直接统一归类既有。修复后需跑完整FrameSource套（包含此前afterEach提前中止而未执行的后续测试），确认无全局unexpected错误，再按唯一lane已有流程完成其余关联回归。其余10套的结果不能替代此ack回归闭合。

本节结论是原E范围内一项必须修复的ack回归，加一处旧resync fixture合同不符；不是三个独立产品缺陷，也不能将三红全部标为既有。报告提交只改本报告及证据INDEX，产品/测试修改仍交原作者。
