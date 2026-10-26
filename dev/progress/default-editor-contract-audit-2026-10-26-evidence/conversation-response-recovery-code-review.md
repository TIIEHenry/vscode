---
title: "Conversation 响应恢复实现独立审查与三项补修复读"
type: reference
status: accepted
phase: M7
updated: 2026-10-27
summary: "保留VM/SCM失败与fccde混合旧红；64a4完整组级progress夹具定向C0/I0/M0，准确生命周期旧红/compile7及39项、新freeze待。"
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

## 6. ack补修复读与另四旧失败定界（2026-10-27）

### ack不可变补修：Strengths / Critical / Important / Minor / Assessment

受审提交 `5f28071f4cafeb850ae014c92ce8bcfab75b1875`，父 `de1c958d1f0b036df93d2ad2e3a4bf334cea3f6d`，src `371cbc7bc25cea3bb2353343dd10e8a8a7e4d246`，共4路径（FrameSource、其测试、方案实施记录、status）。reviewer通过Git核身份与diff check，只读产品及测试；本轮B写报告前HEAD为 `d8da659a63cf1966e7b5364fcfc664af4da39821`、src仍 `fdca9564aba38ab5da3878a2eb3d9ae1c93d79d1`、工作树clean，未同步或猜测其他工位前进来源。

**Strengths：**生产仅在notifyApplied准确补回第二个 `.catch(onUnexpectedError)`，保留通知顺序及ack cursor/payload。测试保留两次unexpectedWarns；新增process/window双通道旁听，只记录事件并在finally移除，不preventDefault、不替换或阻挡runner处理。额外断言该有效帧只发送一次准确ack。resync生产不动，旧fixture改为恰好两次，再经过额外事件循环确认无第三次，原坏帧不应用、不ack、snapshot不变及无未处理拒绝断言保留。

**Critical 0 / Important 0 / Minor 0。** §5的ack Important在该不可变补修源码上闭合；恢复的是旧warn-then-rethrow合同，不扩张为无限次throw的通用防护。**Assessment：**可交唯一lane复验，此结论不等于5f280运行green，也不提前宣告整个E或默认编辑器after完成。§5原回归与此前漏审历史保留。

### 唯一lane精确旧生产对照：实跑与静态分开

reviewer收到唯一lane结果并只读其JSON原件；执行者仍是baseline，而非本reviewer。producer均为精确 `5df17cb7273f490ccd59818dccba479fa80848dc` / src `7fa3c86d152420afeb66c6038bd961bb6d5b8f4b`。Frame对照3模块，另三完整套采用受影响17路径旧生产/测试组合；新State在旧ref不存在，临时移除后恢复。JSON记录touched outputs与86份native SHA均恢复。执行当时工作区HEAD已为 `71ba410c4f3e00fadf595b2e8c1b123beaac8546` / src `5ebb6ea96b6a130943d08368509ae8ef3016785a`，但未消费该工作区源码；native基线仍绑定0008234/src1ee09f，不能称新HEAD已编译。

| 精确旧对照 | 实际结果 | 与正式native失败关系 |
| --- | --- | --- |
| FrameSource resync reject | 0过1败：2次实际、1次旧期望 | 证实既有fixture冲突 |
| FrameSource ack warn-then-rethrow | 1过0败 | 结合源码双catch→单catch，证实E迁移回归 |
| TimelineProjection完整套 | 15过2败 | allowed/pending及THINKING/preview两处与正式运行相同 |
| TimelineRenderer完整套 | 29过1败 | 同一首次CTA查询null.click，与正式运行相同 |
| StreamScripts完整套 | 32过1败 | 同一无pend question的undecided/pending，与正式运行相同 |

当轮原件 `/tmp/vscode-je-formal-old5df-frame.json` SHA256 `edf70728563bd6a67785319791c859aa88614a80911b13285bbe0fa913a1aecb`、`/tmp/vscode-je-formal-old5df-related.json` SHA256 `1377e7cd1f88428b3623b4b74e26fdd44ae39314db051d52bd11b00fa35345f0`；其runs数组含精确命令、各log SHA及恢复身份。永久运行原件由唯一lane另行入库，本报告不虚构尚未交付的仓内路径。

### 另四失败的具体因果与修正边界

比较版本仍为§5四个不可变ref。三个测试文件与DSL四版本逐字同blob：TimelineProjection test `d668ef56fcbbd58c0e5bd177e719d6b0060932a0`；TimelineRenderer test `b0f62dee9da9262083a6314bf108e335b66d6a4d`；streamScripts `276732b87d60488ba8cc5764e20ac8d160d775dd`；streamScript `a7488a19bcbba70f481706a7b6464ae015e6c154`。不是仅凭测试名称或“非本scope”归类。

**1. pending removal changes the confirmation entry status：旧fixture错误。** 测试一开始就用status allowed生成带decision allow的timeline，并给pending summary也写decision allow，却期待pending覆盖已承认终态。`timelineItemToEntry`的permission分支始终先决定allow/deny、然后才检查pending；四版分支SHA256均 `336f8fa6f601ea273dff204bd8a859a00ca46a2aad638e161d808cedb4f6915c`，E只附加response state，并未改变状态优先级。

允许原E作trivial fixture纠正：从无decision且有pending开始，A=pending；B移除pending但仍无decision→undecided，保留cached/fresh等价、只有目标entry换引用而user引用稳定；C加入明确allow→allowed。另保留“allow决定已存在但pending尚未移除仍为allowed”的负控。不得为了旧测试让pending复活已决定座位，也不能只把第一条expected改allowed后丢掉缓存失效验证。

**2. question-valid-flag-without-options-is-not-submit-safe：旧脚本缺pending事实。** 脚本只发送question timeline，没有pend；DSL文档明确pending需独立pend op，question分支也只upsert timeline。无answered且无真实pending的question状态本来是undecided，E只是把完全相同的exact/最长prefix解析提取到common。该测试原意是验证无options的题目不能提交，不是凭answerKeysValid发明待决身份。

允许原E补真实 `pend q1 as question` 以继续验证pending但answerKeysValid=false、没有Submit/响应回调为0；保留或追加无pend→undecided的负控。生产pending身份规则不变，不只改expected掩盖测试缺事实。

**3. repainting a respondable client tool stays disabled until a retryable failure：旧renderer夹具走错入口。** 测试node固定 `variant:'turn'`，工具因此进入standalone fallback；该函数只画诚实摘要，本来没有Respond CTA。正式process-fold节点才传onRespondClientTool与in-flight回调。standalone函数四版本SHA256均 `923b1a2686c54ab8dea4f34f5f362a544971946875605b705e6b823219d7cf6c`。失败在第一次null.click，尚未执行它声称覆盖的忙碌/重试断言；不是E typed busy导致按钮被移除。

允许原E用projectProcessFoldSpans生成正式process-fold节点或真实TimelineHost构造此夹具；先断言CTA存在再click，完整保留首次发一次、重绘disabled/aria-busy、第二click抑制、retryable恢复并显示错误/nonretryable隐藏CTA及保留错误的断言。不要向standalone只读fallback追加产品按钮来迎合夹具。

**4. persisted reasoning keeps the joined thinking preview on the reading line：既有生产投影/摘要差异，不能当普通fixture修掉。** reasoning分支四版SHA256均 `5538e88fb19b57891e8e77b9cf3f39889b83d6f3cdd0d4668b1187e42931dcf7`：`text = summary.title ? summary.title : preview`，因此标题THINKING压过非空collapsedPreview，而payload仍存完整preview。正式process fold的expanded正文用 `thinkingBodyText = payload ?? text`，故不能宣称整段思考正文丢失；但内层 `formatThinkingSummary`读取turn.text，摘要确会继续显示通用标题。外层步骤名另有payload fallback，不能拿它证明内层摘要正确。轨迹模型reasoning已经preview优先。

[现有规格](../../../docs/systems/conversation/lens-and-trajectory.md)说明思考行摘要应为自身文字。原测试保留对preview文本及cache/agent/turn/payload的验证具有意义，不能把expected改THINKING冒充恢复门禁，也不能只验payload就宣称摘要问题消失。Astra及父已定界：独立保留为既有生产差异及旧红，不纳入E unary恢复新回归，不借本波打开新产品模块；冻结波后由主任务整体分析。前三fixture修正只改测试，reviewer不改产品或方案。

### 本轮交接

父已转原E按上述前三项具体夹具/负控修正，reasoning原红保留；提交不可变修订后再定向复读。当前仅ack补修静态C0/I0/M0，不预先宣告尚未修订的夹具或完整E运行通过。首次失败、精确旧复现和未来新green须各自保留来源。


## 7. 三项旧夹具修订定向复读（2026-10-27）

### 不可变身份与范围

受审提交 `9e79c26ad11156d691f25a64be8164205ebb475f`，父 `5f28071f4cafeb850ae014c92ce8bcfab75b1875`，src `2232d14ecec6f2b0b795993a47f88c2fe47d4a8f`。Git完整diff仅TimelineProjection.test、TimelineRenderer.test、streamScripts.ts三个测试文件及既有plan/status，共5路径，无生产路径、runner、DSL断言器改动。conversation/browser生产树与父同为 `e5402ee034e67152c39a683481c4d5d091643e68`。reviewer开始时B为clean `5bbeeb57dbebaf56a3800b8690e9b856436984e3` / src `fdca9564aba38ab5da3878a2eb3d9ae1c93d79d1`，只通过Git读受审源码；未checkout作者代码、未编译/typecheck/transpile、未写out、未运行业务测试。

### Strengths

- **Projection：**真实无decision+pending起步，撤回pending得undecided，再写明确allow才得allowed；每段cached/fresh等价。A→B、B→C均检查目标entry换引用及无关user引用稳定；明确allow与pending并存负控仍为allowed。没有把旧断言简单统一改成终态，保留了本测试应覆盖的缓存失效与终态优先级。
- **StreamScripts：**同一真实帧序列覆盖无pend→undecided、pend→pending、unpend→undecided；三个阶段均保留answerKeysValid=false、子问题id，且无Submit文本，pending阶段还检查不可提交原因。已读DSL实现：`lacks`检验DOM行文本，status/answerKeysValid检验投影字段，不把它夸大为点击/回调测试。DSL本身没有点击或回调计数接口，本波不扩基础设施；原QuestionSeat `invalid answer keys and no payload show an honest empty state` 仍逐字保留无radio/checkbox/button及零callback的DOM断言，未放宽生产校验。
- **Renderer：**使用真实 `projectProcessFoldSpans` 生成span、公开 `ensureProcessFoldExpanded` 展开，并走正式process-fold variant；已读该生产分支，它实际接入noteClientToolResponse与in-flight查询，没有伪造按钮或绕过hold。首次断言CTA存在后点击一次；重绘仍检查disabled、aria-busy和第二click不多发；retryable恢复可点并显示原错误、再次发送；nonretryable仍隐藏CTA并显示错误。新增standalone fallback无CTA/零callback负控，产品fallback保持只读。所有旧行为断言继续存在，没有skip或runner过滤。

### Critical / Important / Minor / Assessment

**Critical 0 / Important 0 / Minor 0（仅本次三个夹具修订定向范围）。** 修订遵守§6既有合同和边界，可交唯一lane正式合源与复验。生产不变与静态复读不能替代新native运行；本结论不宣称三相关套或整个E全绿。

reasoning原测试从起始tab到结束 `});`（不含末尾换行）在父与受审提交逐字相同，SHA256均 `c72b6abdcd4b0317eb7f1aa17fe7e3a4ef34457ea37da54c3ebc73c19a8e3026`；含末尾换行时均为 `afe2f6dd7c84a17db4f7e5800bf0b535127c3a4e9f8af5fcdc97b738226112d3`。`row.text`与rendered turn仍期待完整 `hmm\nthen this`，排除THINKING，cache/payload/agent/turn断言保留；没有改预期、skip或删除。§6既有生产投影/摘要差异仍为独立旧红，本波不修、不关闭，唯一lane后续报告须明确保留这条已精确旧复现的问题。

### 旧运行永久证据补记与交接

§6提交后，唯一lane交付永久证据提交 `130087b692411f20365343d170bcb4f3cd7e67ad`。本reviewer已直接读取该提交同目录的 `je-formal-old5df-frame.json`、`je-formal-old5df-related.json` blob，SHA256分别仍为§6的 `edf70728563bd6a67785319791c859aa88614a80911b13285bbe0fa913a1aecb`、`1377e7cd1f88428b3623b4b74e26fdd44ae39314db051d52bd11b00fa35345f0`，与当时暂存原件一致。配套日志和完整72artifact校验由唯一lane报告承载；本reviewer未重复执行这些运行，也不将旧模块隔离对照称为整旧native build。

后续由唯一lane按已定流程合不可变9e79及报告，进行第三次实际完整编译、相关全套和身份freeze。此前原失败、精确旧对照与未来新运行继续分别记账；只有当前报告及证据INDEX由B提交，产品、测试、plan/status均不在本reviewer写集。


## 8. 最终after前的固定主线基线决策（2026-10-27）

### 决策与准确身份

**决定：在D最终after之前真三路吸收明确已提交的 `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`，完成实际合并peer、第四次完整编译及下述相关回归，再冻结给D。** 本轮只固定这一笔，不持续追踪其后main漂移，不读取或吸收主工作区42项WIP。它是最终交付的基线对齐，外部queue/skills模块仍归原提交，不计作本波新增coder或产品模块。后续若主线再变，另轮集成与复验；禁止把未合入新源码的旧green挪作新基线证据。

父报告当前已验证身份为 `08b1272fc3cb7ad2fdc256be60262818b92f4a20` / src `f19df7bd512b99d0485355c84708498781e37e56`；三轮完整编译最后0/0TS，J29/E44/目标6/Roster189通过，E11相关套255过1条精确旧reasoning失败，J386历史实跑与路径/native连续性分别保留。本reviewer此次核src身份、读取静态提交；上述运行由唯一lane报告，未由reviewer重跑，D仍未freeze/after。

Git独立核d91的唯一父为 `5df17cb7273f490ccd59818dccba479fa80848dc`，该差集**实际89路径**，15生产源文件、59个node测试文件、4个browser测试文件及文档；与5df→08b127差集仅5路径相交：Roster生产/测试及 `dev/plans/INDEX.md`、`dev/progress/deferred-gaps.md`、`dev/progress/status.md`。此计数修正请求中88的概数，不揣测外部提交者来源。

### 为什么现在吸收

d91在同一个Roster中加入QueueReader，bind开始撤销queue ready、bind成功再发布真实engineSessionId，并通过 `_onDidChangeSession` **同步**通知；connection identity/link、lease generation、active session与live/capability一起决定queue epoch。它与E已经修复的断线/身份切换期间重入响应、通知顺序共用真实服务对象，即便不同hunk也不是独立可跳过的组合。d91还改变公共能力键、gRPC client/codec、node service与IPC allowlist。只对f19df做after再稍后合d91，会让最后after不再覆盖正式集成树；若坚持旧基线，必须把交付明确停在不含d91的独立分支，后续main集成仍需同样peer/编译/回归/after，不能凭旧after豁免。因此本轮固定对齐成本更小，证据也更直接。

只读旧式 `git merge-tree 5df 08b127 d91`（未写index或工作源码）显示3处文本冲突标记，仅位于plan INDEX和status；Roster生产/测试可自动合并。**无文本冲突不等于合同安全**；实际merge候选仍须独立复读后才开第四轮编译。

### 实际合并必须保留的合同

1. **E响应门禁先于通知。** `setEngineConnected`先提交公开test/display gate再做cache/scope通知；真实disconnect在adopt前撤销覆盖flag；identity adoption用 `responseWriteTransitions` 包住旧缓存归属、新identity/catalog落定、response scope reset及通知。`dispatchEngineResponse`仍先begin占有attempt，再复查真实live/generation/identity/current；忙碌只复用同attempt，旧成功/失败不清新座位。FrameSource双catch与原三项修复不能退回。
2. **Queue bind事实不伪造。** bind入口先清queueBoundLease再sync；listed/pending成功且monitor仍当前才存lease并sync。读scope必须保留published identity/link、lease generation、本地session和绑定返回的真实engineSessionId、live与capability；不可拿本地id或历史bound集合代替。QueueReader先提交scope/epoch/readState再同步通知，旧epoch结果和旧mutation完成不能回写新scope；断开保留stale，换具体identity清旧缓存。
3. **两种写入所有权各自完整。** queue mutation仍以reader ready和真实id派发，显式ok才接受，完成后仅当前epoch刷新；不得为了合并将E响应切回普通queue mutation，也不得让queue新通知绕开E transition/live gate。新增通知处重点核disconnect、identity switch、bind失败与active session切换的重入行为。现有真实queue行编辑关闭、Send/Enqueue关闭及独立D1388不得借合并打开。
4. **测试与文档保留双方事实。** Roster保留E回归和外部queue新测试/能力mock，不整文件选ours/theirs；plan INDEX保留E行并采外部方案真实implemented状态，status保留两边归属/运行身份，deferred保留D1388。d91共享status包含其他窗口进度文本不代表其未提交产品WIP已入树，不据此签收这些产品路径。

### 最小必要新基线验证

- **先身份与peer，后一次实际完整编译。** 真三路记录父/merge-base/result/src、5交集逐块处理、89外部路径与J/E侧保留证明；实际Roster候选定向peer无C/I后，唯一lane执行第四次完整compile。不要用静态解析、旧out或单模块替换充作完整新编译。
- **Browser业务：** 合并后的完整Roster（原189与新增queue测试）、E44及目标6与完整11相关套可按用例去重但保留覆盖身份；只允许已精确旧复现的reasoning原红，不预写其他失败为既有。外部QueueReader、InboxOverlay、EngineSkillsSection完整套单独记外部基线复验。J29在新native重跑；J386旧实跑仅以原身份和既有源/native连续证明保留，不冒称本轮重新执行386。
- **Node/公共能力：** d91实际改动的59个node测试文件是一组直接受影响范围，覆盖真实bytes client、共享codec wire5、SaveSkillContent迁移、GetQueue IPC/connection等；额外跑未改的 `grpcCapabilityProbe.test.ts` 与common `universeAgentRendererSync.test.ts`，检查新增能力键的旧unknown/unsupported消费者兼容。复用既有runner/正式产物，不扩大到无关全仓测试或重开引擎开发。
- **最终D after：** 在第四轮通过并重新freeze后使用同一src/out运行既定J/E矩阵。若实际合并有C/I，交原E处理本波交互并重审，不另开coder；外部独立问题按准确归属记录，不能修改预期或隐藏新红。

### D临时夹具的最小兼容与freeze增量

经父授权只读D自有ignored准备目录 `/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/e-response-after-preparation-20261027/`；这些是**可变临时准备文件，不是不可变产品source**，读取时未运行、未修改、未启动窗口/server。读取范围为fake完整gate/RPC注册/控制循环，phase-route与freeze模板，matrix及静态准备记录。读取时SHA256：

| 准备文件 | SHA256 |
| --- | --- |
| fake-uds-engine.cjs | `bd9549f634bec1695bb9cf57b69b99ec422dd23f32ae64bb264798da83abfcef` |
| phase-route.json | `5c5372f70a4e482ef5cfe6b7361dec3deee8e70a0483e002ee9c6c8d76d88650` |
| matrix.json | `bdfa2e9564856dea5acb6bfed33dbfb0cf2c84399eb5488b1f7e7f3175c8b101` |
| e-final-freeze.template.json | `1036b6190ca2f1ff1da7f789f2e3690153d45be5261a5e4eb154c68886474026` |
| preparation-static-verification.json | `72706a266c114128f804ebad243c2ebc018f82234eb6a295aef423990698a041` |

fake第95行逐项精确广告，没有 `AgentService.*`、GetQueue或SaveSkillContent。已读d91 `probeAdvertisedSupport`：未广告直接UNSUPPORTED，不发空探测；QueueReader `canRead`又要求SUPPORTED，所以**现有广告保持即可，不需要新增queue/skill handler或测试协议**。不要添加默认空成功以消音，不把queue unsupported当空队列成功。E after只验证真实响应链在unsupported queue下共存，不宣称队列读写或技能保存验收。J先在own空0700 engineHome零RPC完成，随后才允许fake UDS，保持已有阶段合同。

原E16/J18 freeze列表保持并去重；建议追加以下最终source/native hash mandatory项（前缀均 `out/vs/`，不是声称每项已runtime加载）：

- `workbench/contrib/conversation/browser/`：`conversationEngineQueueReader.js`、`conversationMessageQueueModel.js`、`conversationInboxOverlay.js`、`conversationTimelineRenderer.js`、`conversationConfirmationSeat.js`、`conversationQuestionSeat.js`、`conversationLensProjection.js`、`conversationLensReadingColumn.js`；实际加载的 `media/conversationLens.css`也固定。
- `platform/universeAgent/common/`：`conversationResponseState.js`、`universeAgentCapabilities.js`、`universeAgentRendererSync.js`、`universeAgentConnectionIpcChannel.js`。
- `platform/universeAgent/node/`：`grpcCapabilityProbe.js`；其 `grpc/` 下 `grpcClient.js`、`grpcProtoCodec.js`、`grpcQueueSkillWire.js`、`grpcTransport.js`。

QueueReader是Roster新的直接runtime import；responseState也是E核心真实依赖，不能只固定其importer而遗漏。可复用完整out manifest收敛记录，只补mandatory和实际加载证据；renderer/main加载证明与“文件存在且hash固定”分别记。engineSkillsSection若D不打开，不要求伪造loaded证明；它仍属于第四轮编译及外部自动测试的身份范围。

本节为**基线选择与合并条件**，不对尚未提供的实际合源结果签C0/I0，不复用§7局部夹具结论代替它。实际候选到达后继续定向只读复读。


## 9. 固定d91真实合源候选定向peer（2026-10-27）

### 身份与读取范围

受审不可变merge为 `9cc56b5595cdc680020cc832fe390c592a55c25c`，第一父 `5f180399790eb57c8eb68692f379caa8033c4d4f`、第二父 `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`，src `92801b513611ed3ae1ba36862a58131c609f6aa2`；reviewer已独立Git核身份。B开始为clean `a075db2e1bd3fdfc4440196e7226ff130f61009f` / src `fdca9564aba38ab5da3878a2eb3d9ae1c93d79d1`。本轮通过Git读取实际Roster生产相对两父的完整diff、合成通知路径、两侧测试diff与块，核E核心/ack/夹具和外部QueueReader字节连续；不以无冲突或保留门禁代替语义审查。

唯一lane称358路径mode/type/blob门禁通过、107旧artifact原字节保留并追加至115、旧90native未改；这属于其原执行证据，本reviewer未重新运行业务/编译或冒称复跑该门禁。本reviewer另已读候选自带的 `je-formal-main-d91-conflict-resolutions.json` 五交集与rationale，原件SHA256 `d183fd30bfbc403260042e053b79dd74bf6b2549ce763949940ad9e019598884`；其base/ours/theirs/result和四patch供合源追溯。无产品、测试、out写入。

### Strengths：实际合成合同

- **断线与身份变更的通知次序保留。** 真实Roster `setEngineConnected`（237行）先写test/display gate，才capture/super事件及scope reset；`onUaConnectionChanged`（1745行）先对真实disconnect撤override、再adopt identity，断线路径完成response reset后才显式调用末尾的queue bind/sync。identity adoption（2102行）仍在 `responseWriteTransitions` 的try/finally内保存旧owner缓存、提交新identity/catalog、恢复新owner缓存、reset scope和发布session通知。新增queue通知没有被插到这段关键提交顺序之前；super通知导致的同步bind也在既有公开门关闭后发生。
- **响应所有权与queue写入没有混用。** `dispatchEngineResponse`（1328行）保留真实phase/pairing/live与transition门、generation/identity捕获、begin占用及begin后current复查；cleanup与失败完成仍只作用于当前attempt。外部 `dispatchQueueMutation`（1467行）另用reader epoch、显式ok和当前scope刷新；没有把三类响应改回普通queue mutation，也没有将queue ready当成响应pending身份。
- **bind/scope同步通知保留事实屏障。** `syncQueueReader`（1773行）仍采published identity/link、monitor generation、本地active id、当前lease绑定返回的真实id、live和capability；`bindLiveTreeObservationLease`（1785行）清queueBoundLease后才sync，listed/pending bind成功保留原monitor/current筛选后才赋lease并sync。QueueReader与第二父逐字相同，update先落scope/epoch/readState再通知，异步read/mutation均受当前epoch资格限制。断线、pairing与unsupported不靠旧ready放行。
- **旧补修与双方测试没有回退。** responseState、FrameSource、SessionView及FrameSource/Projection/Renderer/streamScripts相关测试与第一父逐字一致，保留原三I补修、ack双catch与5f280/9e79全部边界，reasoning原红仍在。QueueReader生产/测试与第二父逐字一致。Roster相对第一父仅加入已审d91 queue hunks；相对第二父仅加入E响应hunks，两边实现均未整文件覆盖。

### 测试连续性与审查限度

静态逐块比对：第二父145个顶层literal test块在结果中全部存在且逐字一致；第一父153个顶层literal test块全部存在，仅6个原queue测试按d91引入readback能力/ready或unsupported断言、刷新等待和读回记录，E新增9个顶层literal块逐字一致。此为源码块计数，**不是运行用例总数**，不拿它代替循环生成的189/190等runner计数。

另对第一段 `response recovery` literal测试起至既有 `accepted engine allow and deny...` 测试前的完整28,822字节区段比较，包含循环生成的响应回归，候选与第一父逐字相同，SHA256 `832effc7ee910d92ed23a8d109f7cb03f3ba8d6acac83f6e05c4fcd380c0f5f7`。因此没有因文本合成丢掉重入/身份/草稿/终态测试；queue新增bind真实id用例和原拒绝/no-unhandled断言也保留。没有新增skip、改runner过滤或为合并弱化预期。

### Critical / Important / Minor / Assessment

**Critical 0 / Important 0 / Minor 0（本次实际三路合并合同定向范围）。** 可以进入§8约定的第四次实际完整编译、最小相关回归和最终重新freeze。此结论只关闭“实际merge尚未peer”的条件，不把尚未执行的新native验证或D after记为green，不扩大为外部队列/技能模块完整产品验收。reasoning旧生产差异继续单独保留。

已先将短C/I闭合结论发给父与唯一lane；本报告与证据INDEX为唯一写集。reviewer没有执行compile/typecheck/transpile、业务测试、服务器或UI，也没有改D准备夹具。


## 10. D真实after的Conversation→Preview按钮缺陷定界（2026-10-27）

### 发现与根因：Critical 0 / Important 1 / Minor 0

D在冻结src `92801b513611ed3ae1ba36862a58131c609f6aa2` 的真实默认编辑器after中报告：Preview/Review/Changes真实Git打开、准确Conversation叶及若干Move已通过，但真实pane的Open Diff in Preview按钮无效；从普通Review创建的Beta shared比较也重复失败。父报告运行使用第四轮实际compiled产物；reviewer不把报告的运行变成自己的执行。本次直接读取同src的不可变 `9cc56b5595cdc680020cc832fe390c592a55c25c` 源码及D以下原件，未运行UI/业务。

D目录 `/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1387-after-sources-audit-20261026/steps/` 的 `M01-conversation-to-preview-real-button.json` SHA256为 `cfacdccb67f43702d1a6a849a4ec05078428b3a9efe8d836034d010db87f3860`，`M01-normal-beta-conversation-preview-button.json` 为 `f0cdc242a77401ef58054614d6e770d59d8ad66f3a2a481dfa2e456fda11944a`。已读action/state：真实button动作后global activeEditor=null、activeGroup=0、main所有组仍空，visualize真实comparison group11仍保留Alpha other或Beta shared；不是仅以无参命令自测推断产品失败。D完整矩阵与图像原件由D继续保管，本reviewer只核上述JSON和源码，不代签未读矩阵。

源码闭合：`conversationDiffReviewPane.ts:199`忽略pane已拥有的真实input/group，无参执行 `sources.diff.moveToPreview`；`sourcesDiffActions.ts:72–77`不接调用源；`sourcesDiffRefHelpers.ts:142–146`只读全局activeEditor，空即undefined返回。`IConversationEditorPart`在公共 `editorGroupsService.ts:533–535`明确 `excludeFromGlobalEditorAggregation: true`。因此准确Conversation宿主存在而全局聚合为空是合法架构状态，**真实可见按钮丢来源并静默不工作是产品Important，不是driver失败，也不能用全局命令无active时允许no-op来豁免。** 已有helper测试把ConversationInput直接放进mock全局active（`sourcesDiffRefHelpers.test.ts:496–510`），没有覆盖真实默认宿主边界。

本结论不推翻§9的限定Roster合并peer：这是D实际UI揭示的J已accepted三owner/Move合同未满足。D1387继续open、J after不全通过；其他已完成case保留其各自证据，E after尚未启动。原J负责补修，不新开coder、RPC、服务、全局串行队列或Agents界面。

### 方案决策：显式调用来源，共用捕获与存活校验

原J先在[既有方案](../../plans/sources-open-dispatch-and-conversation-target.md)追加本轮合同与回归、独立文档commit，按规则16只读审查C/I闭合后才实现。现有accepted方案没有定义显式pane调用源，这属于需要明确的公共命令边界增量；不是新产品计划或新增owner。

1. **pane提供自己已经知道的来源。** 在点击时捕获准确 `ConversationDiffReviewInput` 对象、实际 `IEditorGroup` 对象以及判别明确的来源kind，通过既有命令传到helper；可附注册Conversation part/sessionKey用于校验。host sessionKey、编辑器group对象/id与Sources ref的SCM groupId/content sessionId须分开，不能混作同一身份。无参命令仍保持现有全局入口适用范围，不为修按钮去改全局聚合或猜最近叶。
2. **入口校验真实宿主，不把参数当授权事实。** 在当前公开conversationParts中确认同一个part和group对象，确认当前pane/input对应且input仍是该组真实成员、未dispose。只匹配URI、同数值group id或 `.matches` 不足以区分多叶同一比较。显式context存在但无效时终止，不回退global active、当前session或另一个同内容tab。具体结构由J在addendum选择，但必须用现有公开成员/生命周期边界，不做新的服务或可伪造的全局缓存。
3. **resolve与close绑定同一份同步捕获。** 不能只给resolve传显式input，却让captureMoveHostClose继续读global active。来源有效才分派一次；await后关闭前重新核注册part/group对象与精确input成员，已删除/替换/同id重建的来源不关闭任何替代对象。正常异步打开把全局焦点移到Preview，并不自动使原input失效；若原对象仍存活在原组，可精确关闭原对象，不要求重新成为global active。使用公开group.closeEditor或能够证明同一宿主的现有服务。
4. **保留既有打开代数与provider合同。** 完整original/modified/SCM组身份、provider显式options、single-dispatch、void委托和局部歧义fence保持。已accepted §4.2明确其他false/stale后的既有关闭策略已锁定，本刀不改成“所有失败都保源”；当前helper确实在false/stale及非缺leaf异常后走既有close。新“来源失效不误关”与既有“缺Conversation leaf保源”须单独列出，不能借错误恢复偷偷统一改整个Move事务策略。如需改变失败关闭合同，须另列实质设计变更审查。
5. **反馈只归当前调用。** 真实有效按钮不能再静默吞掉无来源；派发异常沿既有通知/局部状态通道表达，当前成功清本次打开错误，旧异步结果不得盖掉新input/pane的状态。不用新global状态服务，也不清独立读失败或写失败。stale来源是拒绝旧调用，不能借重试转向新叶。

### 必要回归与补修顺序

- **真实公共正例：** 默认Conversation part不参与全局聚合，global active为空时，真实pane按钮→已注册command→helper→公开EditorService/group，完整双侧确实进入Preview、按既有pin合同，恰好关闭来源比较并保留chat root。另测global active是无关Preview时仍只移动点击的Conversation比较。仅helper mock/global active赋值或只验命令字符串不够。
- **多叶隔离：** A/B Conversation同名文件、同modified不同original、乃至同tuple不同input对象；点B只使用B的input/group/身份，A及不相关Preview保持。焦点/最近session切到A不能把B的显式调用改归A。
- **失效负控：** 显式input已移除/dispose、pane已换input、part/group已移除、同group id新对象、plain object伪group、非Conversation/错误input类型；派发前零打开零关闭，不fallback。await期间来源成员替换/part关闭不得关新input；合法来源仍存活但焦点改变则允许精确关闭原来源。
- **结果与恢复：** 公共handler的throw/拒绝、当前重试成功、旧完成晚到与多pane错误隔离；保留旧false/stale/void与缺leaf例外的独立测试，不用新的expected抹掉旧行为。保留其余Preview/Panel move正例、SCM参数/pin/identity与Sources重叠歧义回归。更新旧wiring-scan的无参字符串断言去核新的真实context传递，不能只删scan换绿。

顺序为原J方案增量→独立只读审查→原J实现/公共回归→唯一lane准确旧红与新native必要测试/身份重新freeze→D重跑M01及受影响Move/Panel/错误恢复，保留本次真实失败原件。不得用正在进行的D旧产物after直接签新修复。reviewer本轮仅报告与INDEX写入，不改作者方案/产品/tests/out，不执行编译/typecheck/transpile、业务或UI。


## 11. M01显式来源方案增量规则16（2026-10-27）

### 受审身份与范围

不可变受审提交 `b882e8f5ce40336b457d972f7af04be4e637ab06`，父 `4173b3fea640124a50cbdaa6aa7ceb7892274641`，仅5文档，src仍 `92801b513611ed3ae1ba36862a58131c609f6aa2`。直接读取完整diff、重点方案§3.5/§4.4及Sources SSOT新M01段，并核对当前公开EditorTabsControl、IEditorCommandsContext与旧move实现。方案SHA256为 `e08503f6ddb42170a50012b1e24585e07aa516a4d52ef1c8a26a0c485795bd23`；SSOT为 `f58434b9c83c455de553bfb9ebe98bc13f0eccde9a9800c4add28067f01f3606`，与交付一致。draft仅表达本轮增量待审，原accepted/实现/运行历史没有被抹掉。

本reviewer还读取D永久证据提交 `ee1892ee8cd3499ec9af0b1fd8ca66124524fb0c` 中的 `d1387-j-partial-after-2026-10-27.md`（SHA256 `914eb41e05ec0ee723965377157d25ab461fbbefc32d345dab538d973746df6f`）。其报告明确实际consumer `ce6d977a4316c1f903869089638a2cd7262dc7db`、native producer `8b4ddaa99a8cc88ed645407ee42075a8497c4f34`、同src928；14实际UI过、1隔离过、2仅车道连续性、M01部分失败；101采样零引擎、自有句柄已清、E未启动。此永久报告补足§10临时证据的身份来源，不把其矩阵/tar的D自校验宣称成reviewer逐包重验，也不把已经真实成立的旧freeze改写为从未冻结。

B本轮开始clean `7b63babf11ac58b1095f05030f1f5e985aaaa5b9` / src `fdca9564aba38ab5da3878a2eb3d9ae1c93d79d1`；只读方案/产品/已提交证据，写集仍仅本报告与INDEX。

### Strengths

- Pane本地typed来源与可序列化上游IEditorCommandsContext分开；真实input/group/Pane对象进入registered command，禁止把Pane对象塞进扩展宿主上下文。ref与close共用一次捕获，不拼两次global active。
- 注册Conversation part/sessionKey、group对象、精确input成员与Pane对应关系均有入口及关闭前的真实校验；显式无效来源不fallback。SCM组、内容session与宿主sessionKey区分清楚，多叶同tuple不凭URI或matches认领。
- await后正常焦点变化与来源替换分开；精确原对象仍live可关原来源，原group/part/input/Pane失效时不关替代对象。未改全局聚合、finder围栏、目标slot或provider优先级。
- 原true/false/stale/void与非leaf异常关闭策略、缺leaf保源例外逐项保留；不借修来源把所有Move改成失败保源。Pane局部反馈绑定input/group/render与move尝试代次，只清自己的move错误，其他加载/读写notice保留；旧完成不污染新Pane，catch自身异常与无unhandled负控保留。
- 回归明确真实默认EditorParts/Conversation part、真实pane按钮、registered command与公共helper链，包含global空/无关Preview、多叶同tuple、源替换/失效、两类成功/错误恢复及原M01真Git重验；旧mock全局active不再充当真实入口覆盖。

### Critical 0 / Important 0 / Minor 1

**M1：原生标题上下文需补足真实参数形状与可证明的时间边界。** 本增量同步覆盖现有EditorTitle/EditorTitleContext入口是合理的：它们已经挂同一Move命令，不能只修pane按钮而让显式被点tab被global抢走。但实现不能把“groupId/editorIndex”理解为固定第一参数或index必填。当前 `editorTabsControl.ts` 的标题toolbar context是 `{ groupId }`；EditorTitleContext在617–619行用 `menuActionOptions.arg`先给资源URI，再forward `{ groupId, editorIndex }`。`IEditorCommandsContext.editorIndex`本来可选，原类型须保持。

独立accepted方案提交前将以下兼容细化写入§3.5/§4.4及必要SSOT说明：从受支持的命令参数形状取得native context，不改官方位置、不把资源URI当对象来源；无index只同步取**该明确group**当时的active input，显式非法/越界index直接无目标，不能fallback全局或列表。获得input/group对象后与其余来源一样只用这份capture。native序列化数字只能表达handler入口时的对象解析，不能证明命令入队前的原对象代次；不得把“传groupId”宣传为与typed Pane原对象同等的跨时间身份保证。capture后仍须严格对象/成员复验，两种native形状均须有公共handler回归。无需新增服务、统一resolver或修改上游context接口。

该项是现方案已承诺原生兼容的精确化，未发现需阻断其主体设计的C/I。后续实现peer重点检查真实参数位置、无index与非法index分支，不能只根据计划文字签代码。

### Assessment

**规则16结论C0/I0/M1：可签收主体方案；原J核验并补M1后独立提交accepted文档，再按父调度实施。** 本次不签任何产品修复、旧红新绿或新after；§10产品Important仍open，直到实际源码、唯一lane验证和D新freeze复验闭合。单独accepted提交可以引用本报告并明确M1已落实；如果另改失败关闭代数、扩大上下文resolver或跨模块架构，须重新定向审查。

审查已先发短结论给父与原J。不可变文档diff-check通过；reviewer未改方案/产品/测试/D文件，未编译/typecheck/transpile/out/业务/UI。


## 12. M01显式来源实现定向peer（2026-10-27）

### 身份与边界

受审不可变实现 `d04697351413f2e83a4745c3ab2b7fc37a03ea0c`，父为已纳入§11原生参数细化的accepted方案 `265b1fe8e01f88725169696976f6cc463a8b61dd`，src `abc5ee767c00513c8737e424d4c807469f837fe9`。此次10路径包括3生产、2测试与5文档。reviewer读取生产完整diff、helper捕获/关闭链、新测试完整源码、既有no-unhandled改动与未变更的node wiring scan，并对照accepted §3.5/§4.4；未执行编译、typecheck、transpile、业务测试、UI或out写入。B起点clean `3f299c3dc5b18c47209e6ccb23ba40a2fe0765e4`，src仍 `fdca9564aba38ab5da3878a2eb3d9ae1c93d79d1`，仅写本报告和INDEX。

### Strengths

- **显式来源贯通真实命令。** Pane在点击时传准确input/group/pane对象；registered Action接收并转交args、返回helper结果。helper一次捕获同时提供ref与close；typed来源与native context都不再借global active抢认另一叶。native toolbar `{ groupId }`和context menu的URI后置context均可识别，无index只取命名组active，非法index拒绝、不fallback；无参旧程序入口保留。
- **关闭前身份复验落实。** typed来源须属于真实注册Conversation part，检查group对象注册、精确editor成员、未dispose、同part/sessionKey及同pane/input；await后复验再用原group.closeEditor(originalEditor)。改变全局焦点仍可关准确来源，替换input/part/group/pane则不关替代对象。没有改global聚合、provider优先级或另建resolver/服务。
- **原关闭代数与错误归属保持。** true/false/stale/void及非leaf异常仍走既有close，缺leaf保源；当前无效来源在派发前终止。独立move notice不清加载/读写notice，反馈受input、render及move attempt代次和dispose约束；setInput/clearInput/dispose使旧完成失效。按钮保留外层双catch；原no-unhandled负例改为命令失败后notice渲染自身抛出，仍覆盖catch路径异常。
- **回归设计经过真实公共入口。** 新文件的4个真实入口用真实EditorParts、EditorService、已注册Pane与CommandsRegistry handler；两叶同tuple不同SCM组，核B双侧/组身份、只关B、保留A/root与无关Preview。其余受控测试覆盖来源失效、await替换、结果与旧完成。新增context/result仅type import，旧生产不存在这些类型不会造成运行时缺export。上述是源码覆盖判断，作者所报38项不是本reviewer运行结果，且下列夹具错误阻止4入口实际到达业务断言。

### Critical 0 / Important 2 / Minor 0

**I1：既有wiring scan仍要求已经删除的旧按钮调用，构成确定校验回归。** 不可变实现中 `src/vs/workbench/contrib/sources/test/node/sourcesWiringScan.test.ts:192` 仍断言源码包含 `void this.commandService.executeCommand('sources.diff.moveToPreview')${doubleCatch}`，而生产 `conversationDiffReviewPane.ts:203` 已改成 `void this.runMoveToPreview().catch(onUnexpectedError).catch(onUnexpectedError)`。197行的naked-call排除也仍只检查旧executeCommand。这是直接源码与精确字符串断言不匹配，非已执行测试结果；§10及accepted回归要求本就明确需要更新扫描，不能留给集成lane删掉换绿。原J须最小适配真实按钮runMoveToPreview的双catch、排除其裸调用，并保留方法内传准确context到registered command的约束；不得弱化原no-unhandled负例。

**I2：4个真实入口夹具构造SourcesChangesModel前未提供IAgentSessionContext，尚未证明原M01业务旧红。** 新 `sourcesDiffMoveSource.test.ts:167–174` 注册connection等依赖后直接createInstance(SourcesChangesModel)，缺session；该model构造器 `common/sourcesChangesReadModel.ts:60,65–66` 即订阅session事件。唯一lane在准确旧src928生产+不可变d046新test的4入口筛选实跑为 **0 passing / 4 failing，全部TypeError读取undefined.onDidChangeActiveSession**；栈位于native model.js:60与test.js:243，尚未到点击/命令/身份断言。reviewer已读其raw `/tmp/vscode-m01-old928-red.log`，SHA256 `e210829103ebf6c0c9916be7ff30287a721e8f2010d7f5410d493b85b7a2b724`，未代跑。原J须补真实夹具所需session依赖、保留真实Pane/公共handler和业务expected，再交不可变修订给唯一lane；不能把这4个失败记为产品旧红，也不能改生产或预期以掩盖夹具错误。

lane报告本轮finally已恢复154 native、3份旧生产与test输出存在性，HEAD/src/clean未变；这是执行lane的恢复声明，本reviewer没有再次逐产物复核。lane尚未合d046或开始第五轮完整编译；lane随后以不可变 `2df7ff7eda332de5aa8d5edf94e715a5fab78148` 将该运行落入中央验证报告/库存和 `m01-old928-d046-first.log` 等原件；reviewer另核该提交的永久log SHA与上述raw相同。长期证据以该提交为准，临时路径不充当唯一来源。

### Assessment

**d046当前C0/I2/M0，退原J补修，不签green。** 本轮未发现额外确定生产合同缺陷，但生产静态合理不能代替可运行回归。两项先发父/原J/唯一lane；修订须保留真实旧红→新native最小及完整相关套→重新freeze→D真实M01/受影响Move复验的顺序。§10原产品Important、D1387与新after继续open；此前D旧after的其他有效结果保留，不借本次peer或作者AST/lint把它们扩成新修复验证。


## 13. M01两项测试补修定向复读（2026-10-27）

受审修订 `a22237822e4a9feff58a89a0d78fd12669a65ca4`，父 `d04697351413f2e83a4745c3ab2b7fc37a03ea0c`，src `8e6e9bb4b63ae2b65cf6e023fa99ad48fae9ed88`。reviewer已独立Git核身份、完整5路径diff、公开IAgentSessionContext、scan切片函数与生产runMoveToPreview；2测试+3行动文档之外无变更。3生产文件与既有 `sourcesDiffPanel.test.ts` no-unhandled负控blob逐一与父相同，§12生产静态范围不扩展，也未改旧AcceptPatchbuilder扫描或原失败预期。

**Critical 0 / Important 0 / Minor 0（两I源码补修范围）。**

- **I1源码闭合。** node scan改为精确要求按钮runMoveToPreview双catch；既有sliceSourcesPrivate先断言方法存在，再截到下一个private方法，限定核原input捕获、instanceof守卫、typed source中的input/group/Pane原对象和实际await command携source委托。新增裸runMove调用排除并保留旧裸executeCommand排除、其余动作双catch与Accept扫描。不是删断言或放宽为不依赖生产的恒真检查；实际node运行仍归唯一lane。
- **I2源码闭合。** 4个真实入口在createInstance(SourcesChangesModel)之前注册IAgentSessionContext，提供全部必需公开成员：active session、engine readiness、pairing、两事件及显式拒绝未用lease入口；与真实model构造器订阅匹配。只加5行stub，不换掉真实SourcesChangesModel、EditorParts/Conversation parts、Pane、CommandsRegistry handler，也不改入口选择、business expected、等待或结果断言；未绕到direct helper。此处只证明已修已知缺依赖，是否出现下一层运行问题须实际重跑，不推定4业务旧红已经成立。

测试SHA256独立核对：MoveSource `3e559440a02345efa67593097b98f2ee5b1e8b9ef76d553209f8f1cb82786c88`；WiringScan `bfe051c197f7e17df0dcefca79996fc8365afbb6700fd0e4f3fc70b77dea6753`。3份作者行动文档明确首跑为4 fixture TypeError、业务旧红0，并撤回“旧src必到业务断言”的先行断言；§12及lane `2df7ff7` 原件保留不改。

**Assessment：允许唯一lane继续准确旧928+新4入口实际重跑；静态两I已闭，不等于测试green或M01产品闭合。** 后续新38/完整相关套、实际编译及重新freeze/D真实after仍按父调度。此次未运行AST/lint或业务，不把作者AST0/lint无新增告警变成本reviewer结果；未compile/typecheck/transpile/out/UI。B起点clean `88910e7b5da02d75df09dceacc9f3ea54e7e0486`，src fdca不变，只写原报告和INDEX；先行短结论已交父与唯一lane。


## 14. M01第五轮编译四诊断补修定向复读（2026-10-27）

受审不可变 `0da326c052fdaac3d6ff9e2118ba95b001868f1f`，父 `a22237822e4a9feff58a89a0d78fd12669a65ca4`，src `d5eca6c1557b921827c2585104d54871936212ae`，6路径仅2生产、1测试、3行动文档。reviewer直接读diff、原hasKey实现、完整CommandService、基座服务注册与NullExtensionService；未compile/typecheck/transpile/out/业务/UI。

唯一lane第五次完整编译原件已落提交 `a57b22f1d375d527f086879259f461b482341891`；reviewer读取其中 `m01-fifth-native-build.log` 并核与临时raw逐字相同，SHA256 `55c4be8fcb08c029dbf646e5b7c54d81b33624dfd8a845ef30a026f07089f7f3`。四诊断为Action TS7030缺return、helper TS2339在object上读kind、测试TS2322返回Promise<void>不符泛型命令接口、TS2345把void传给Move结果观察。此为lane实际编译失败，§13静态通过没有使它成为green；a222已实际成立的4项Preview缺失业务旧红保留，但新harness不能继承其运行结论。

### Critical 0 / Important 0 / Minor 0

- **Action语义保持。** 只在已识别缺Conversation leaf、完成notification后显式return undefined，与旧async落尾结果相同；其他异常仍throw，notification自身若抛仍拒绝。未调整缺leaf保源或true/false/stale/void/非leaf异常关闭代数。
- **kind判别保持正式输入合同。** 对非null object用Reflect.get读取kind并比较准确literal，提供窄类型谓词代替原hasKey不能收窄object的写法；仍由后续原isConversationPaneSource核input/group/pane，并对携conversationPane kind但无效的来源拒绝，不fallback。合法plain对象及继承属性读取保持，未新增broad cast或把kind存在当成完整来源资格，ref/close共用捕获及live复验未变。
- **新测试真实命令链与结果观察成立。** 基座workbenchInstantiationService已注册NullLogService和TestExtensionService；后者继承NullExtensionService，whenInstalledExtensionsRegistered与activateByEvent均返回resolve Promise。真实CommandService的Instantiation依赖也由基座提供；注册命令路径经其_tryExecuteCommand实际invokeFunction(handler, ...args)，构造/执行不缺新fixture服务。代理await公开executeCommand的原结果后，对Move结果以runtime检查只接受boolean/stale/undefined，再计calls、complete done并原样return result；其他命令也原样传结果，拒绝继续传播。没有把Registry默认void强转成成功、预先complete或只检查字符串。四入口业务expected、真实model/parts/Pane、准确双侧/组/根保留断言均未改。

Pane、Panel no-unhandled负控、WiringScan三blob逐一与父相同；旧Accept扫描保持。三份受改TS SHA256独立核验：Actions `0057a1546f0f77eca716c70ee0a5b13c657e010436d5319eaa335042c3dcfdbc`；Helper `84dd59d318a28b8645a132a6861ab82297f6b77d301a52e4fc3011d7914fad52`；MoveSource test `86e90709a2ac0453c4b464f404e8cb41cd961963d2578a86b6313367d98a39ca`。

**Assessment：本次静态C/I闭合，可按父调度继续新harness配精确旧928三生产的4入口重跑，并在原件接入后进行第六次实际完整编译。** 新旧harness运行身份分记，不能复用a222四红；failed compile5当前out身份与此前freeze不同，临时替换的finally恢复由唯一lane记录。本reviewer不预言编译通过，不把作者AST/lint当成编译，也不签新38/完整套或D after完成。B本轮起点clean `04ea96be19dc57cd128dfbea0206ca539587fb53`，src fdca不变；仅原报告与INDEX，先行短C/I已交父和lane。


## 15. 第六轮实际编译后的Pane视图模型泄漏定界（2026-10-27）

### 实际运行与可声明边界

唯一lane运行JSON记录source/native producer `bb41f815236afc5073df1699a0c97c696d7ee028`，src `d5eca6c1557b921827c2585104d54871936212ae` 与0da326精确一致，compile6实际exit0；本reviewer未编译，独立读以下raw与身份JSON：

| 原始运行日志（/tmp/） | 实际结果与边界 | SHA256 |
| --- | --- | --- |
| `vscode-m01-sixth-M01-focused.log` | 24 passing / 2 failing：23受控及首个真实button empty-global业务本体通过，随后afterEach失败；余14未到达，非38green | `338cec2c2afc644c96d6642b8bacdeb735964d81e45fdeac6d1680fa3d121896` |
| `vscode-m01-sixth-J-complete-11.log` | 410 passing / 2 failing：同一首真实入口之后同6资源泄漏与console连带失败，非完整相关套通过 | `9b1a842572d7465220dcc9cf66c566ac8c0926edd8c9f676c012233b9f164f97` |
| `vscode-m01-sixth-J-wiring-scan.log` | 23 passing / 1 failing：新Move双catch/context扫描实过；失败仍为原Accept builder的 `!source.includes("parseSourcesGitUnifiedDiff")`，不得改预期遮掩 | `503fb7a16fd6138f6f1315fc4c40ca95276cc16bc719617e112ff19d5c3fe258` |

两个浏览器失败分别是6 undisposed disposables，以及leak输出触发Unexpected console output；不能算两项独立产品断言。泄漏为2个DiffEditorViewModel及各自DisposableStore/FunctionDisposable，创建栈均指向DiffEditorWidget.setModel→ConversationDiffReviewPane.renderDiff。focused JSON明确outFrozen=false；新freeze/UI未执行。临时原件由唯一lane继续落中央报告/库存，本报告不复制其大包或代签恢复检查。

### 独立根因与最小修复：Critical 0 / Important 1 / Minor 0

**I1为产品Pane的视图模型所有权缺口，不是仅测试少等一个tick。** 已直接读0da源码：Pane在renderDiff持有两个text model reference，却把raw `{ original, modified }`交给widget.setModel；clearEditors已执行setModel(null)、清widget及原/改text refs，测试finally也确实dispose拥有真实parts的store。widget `diffEditorWidget.ts:509–513` 对raw model创建view model及初始RefCounted；`setDiffModel:533`再存一份clone。`utils.ts:470,492–509`显示初始计数1、clone加1，仅归零才dispose；setModel没有交回或释放初始base，detach/清widget撤clone仍不能归零。534–538行零延迟定时器只释放额外prev clone，等待它不能补上遗失base的释放。两个真实A/B Pane与2组VM子资源相符；测试泄漏检查暴露的是实际对象链，不应在fixture里窥私有VM替产品补清。

**最小正确处理由当前Pane明确拥有VM。** 使用现有公开createViewModel，登记到Pane注册的MutableDisposable<IDiffEditorViewModel>，再把VM交widget；参考现有TextDiffEditor自行创建、保存和释放_previousViewModel的合同。clearEditors先detach widget并清理widget，再释放Pane自有VM，最后释放text model references；setInput更换、clearInput、dispose共用既有清理入口。保留renderDiff在两个异步reference成功之后的input/token/renderGeneration/disposed筛选，失效仅释放该次局部refs；创建并登记VM之后不引入新的await，避免旧完成清掉新代次。VM只拥有自身diff计算/监听，不替代文本引用所有权；同tuple两个Pane各有自己的VM，关B不能销毁A仍渲染的text model。modified-only、load失败和取消路径不得虚造VM或提前释放仍在显示的模型。

父已明确接受上述判定并授权原J局部实施；**仍属原M01生命周期补修，不新增产品契约、resolver/服务或全局DiffEditorWidget改造，无需另开方案/重复规则16。** 若实现扩大到全局widget引用计数或跨Pane共享owner，则超出本判定，须重新审查。禁止关闭leak检查、压console、mark singleton、测试手工释放产品私有VM、用超时碰运气，或删真实parts/Pane覆盖。

原J不可变补修尚待；后续peer需核创建/异常/代际及清理顺序，唯一lane再实际验证首真实入口无泄漏并完成其余14及相关套。§14 C0/I0仅静态类型补修，不抹掉本轮新实际Important；M01/D1387仍open。reviewer本轮仅报告+INDEX，未运行native、未改产品/tests/D或out。


## 16. Pane自有diff view model补修定向peer（2026-10-27）

受审不可变 `a166d422747b1e123109d0f7cec527821c06b04c`，父 `0da326c052fdaac3d6ff9e2118ba95b001868f1f`，src `1ec396de28fa1b72295648f08366056d5a2119ca`。仅Pane、MoveSource test及3行动文档，未扩大到全局widget。reviewer独立核父/src、完整代码diff、创建/清理上下文、测试fixture与dispose观察；Pane SHA256 `e40ac060e2cc52e986b5326604858473e2a2128862e158ada7de45ac262e9f2a`，test `5c0012d0814870c9aff596a764ae3cd0b4029c7d6192766347e3285558ab4f3b`，与作者交付同。

### Critical 0 / Important 0 / Minor 0

**§15 I1源码实质闭合。** Pane注册自己的MutableDisposable<IDiffEditorViewModel>，公开createViewModel所得真实对象先登记，再setModel(viewModel)，不再丢失raw model隐式创建的VM。clearEditors保留先清cursor监听、detach widgets、清widgets，随后清Pane自有VM，最后清原/改text references；setInput换入、clearInput、dispose共用此入口。MutableDisposable在正常清理后为空，super.dispose不会再次释放同一个已清VM。

**异步与模型边界保持。** 两次await取得text references后的disposed/input/token/renderGeneration检查逐字不变，失效/解析失败只清此次局部refs并返回，不写VM字段。guard后创建并登记VM至widget.setModel之间没有新await，未引入旧完成覆盖新VM的窗口。无original的modified-only路径仍只用CodeEditorWidget，不创建VM；既有失败路径也不虚造VM。DiffEditorViewModel持有模型供计算而不负责dispose原/改文本，Pane先detach再清VM与最后释放各自reference，不将同tuple两Pane合成一个共享VM owner，关B不主动销毁A的文本。创建成功后若setModel等同步步骤抛出，VM已经登记给Pane，仍可由既有clear/dispose收回，未形成无主返回值。

**新增回归是观察产品释放，不是测试补释放。** `real Pane comparison view models release on replacement, clear and dispose`用真实Pane与真实双侧model；spy公开createViewModel取得实际返回VM，再spy其公开dispose，依次要求换input、clearInput、Pane.dispose各调用原VM.dispose一次，并核clear后无control。sinon.spy保留原方法执行，测试没有直接调用VM.dispose、mark singleton、关闭leak或吞console；finally只恢复spy。fixture compare参数默认false，原反馈用例仍为原modified-only设置；原4入口与其余38场景expected不改，新增1场景使作者源码集合为39，不代表39已运行。

Actions、Helper、全局DiffEditorWidget、Panel no-unhandled负控和WiringScan blob均逐一与父相同；Move完成/关闭代数及旧Accept扫描不变。作者AST/lint和文档门禁属其声明，本reviewer未重跑AST/lint/编译/native/UI；本次不可变diff-check通过。

### Assessment

**定向C0/I0/M0允许继续父调度的验证；不签运行green。** 原始24/2与410/2泄漏失败及23/1旧scan边界完整保留于§15。新增生命周期测试应由唯一lane配精确旧0da Pane实际验证旧释放断言失败，再对新src实际完整编译与39项、完整相关套复验；原4入口业务旧红来自各自原harness身份，不能混作新生命周期旧红。实际无泄漏、余14及新freeze/D after仍待。

B起点clean `5972836d932ff0cbde50c970b672743e0eee8563`，src fdca不变；只写原报告+INDEX，短C/I已交父/原J/唯一lane。本补修保持§15父授权局部生命周期范围，不需要新的方案或全局架构设计。


## 17. a166生命周期旧跑的SCM夹具失败与依赖复核（2026-10-27）

§15三个第六轮raw/JSON现已永久落入唯一lane提交 `fb214e7e06c7e23ede11003bfdb1d5b4f86a7db8` 的同证据目录。reviewer独立Git读取其中 `m01-sixth-M01-focused.log`、`m01-sixth-J-complete-11.log`、`m01-sixth-J-wiring-scan.log`，三SHA256均与§15所列完全相同；长期原件以该提交为准。

随后唯一lane以精确旧0da Pane及a166新增生命周期test实际执行selector `real Pane comparison view models release`，**0 passing / 1 failing，生命周期业务旧红0**。reviewer已读 `/tmp/vscode-m01-old0da-a166-lifecycle.log` 及JSON，raw SHA256 `51ce0aea9498f185b9853269bba12235ae0f686f4ad3757000c461a408c44f43`；失败为 `this.scmService.onDidAddRepository is not a function`，native SourcesChangesReadModel.js:62→feedbackPane test.js:400→case:439，尚未创建VM或到replacement disposal断言。不是释放行为旧红；clear/dispose后续断言也未到达。

**本轮新增C0/I1/M0，I1限定测试夹具依赖。** feedbackPane将ISCMService覆写为只提供repositories=[]的mock，而真实SourcesChangesModel构造器必调onDidAddRepository和onDidRemoveRepository。此前38项运行在首真实入口的afterEach即abort，后面的反馈helper尚未执行；不能把24已过扩成此helper已经可运行，也不能用§16限定VM源码peer推导夹具通过。§16生产所有权静态结论保留，此运行问题必须由原J补。

独立读完整SourcesChangesModel、connection helper、session stub、Pane构造及workbench基座后，最小建议为同一SCM stub补两个公开Event.None事件，并保留repositories=[]和真实model/scheduler。空repo不触发provider的资源/组订阅；connection helper已提供连接事件、phase/snapshot/isEngineConnected/capabilities，session有active/pairing/readiness及两事件；workspace.getWorkspace、model/resolver由基座提供，diffProvider已显式stub。当前断开连接/无read hook路径不调用engine RPC或acquireSessionView。未发现第二个确定缺失依赖，但此静态核对不保证后续运行全过；不得删除真实model、绕过refresh、屏蔽leak/console或补产品私有dispose。

lane JSON记录source `fb214e7e06c7e23ede11003bfdb1d5b4f86a7db8` / src d5eca，current compile6的163输出存在性/mode/SHA、对应source及旧Pane均已finally恢复，HEAD/src/clean不变；此为其执行声明，不是reviewer逐产物复跑。a166未合、第七次完整编译未开始、未freeze/UI。已将两事件与完整依赖检查建议交原J/父；待新immutable修订定向peer后由唯一lane再跑，所有旧失败原件保留。


## 18. 完整空仓SCM夹具修订定向复读（2026-10-27）

受审不可变 `fccde4afb3eeca0b9264b732efef6b5e31e4b380`，父 `a166d422747b1e123109d0f7cec527821c06b04c`，src `898787fffa49d6aa28e67eb917b8f899d95d5a8c`。4路径仅1测试及3行动文档；独立Git核src变更列表仅MoveSource test，全部生产与a166相同。test SHA256 `2011e14ecdd055a745f403e480afd00ffb9abfd799d3e9c6b5f249dfcee49df6`，Pane仍 `e40ac060e2cc52e986b5326604858473e2a2128862e158ada7de45ac262e9f2a`。

**Critical 0 / Important 0 / Minor 0（§17夹具I1源码闭合）。** feedbackPane用完整空仓literal并satisfies ISCMService替换不完整mock：必需onDidAddRepository/onDidRemoveRepository均Event.None，repositories=[]、repositoryCount=0、两个getRepository输入形状皆返回undefined；未用registerSCMProvider显式抛错，不伪造成功。直接与当前公开接口逐项核对，没有broad cast把缺成员藏起来。真实SourcesChangesModel构造与scheduler/refresh、真实Pane与VM仍运行；未删真实依赖、吞构造错误、关闭leak/console或代替产品dispose。

构造所需connection/session事件与两SCM事件齐备；空仓refresh读取空repositories、基座workspace folders以及已有连接/session facts，仍遵循§17已独立读过的真实路径。原connection stub断开、无read hook，不触发engine RPC/lease；模型resolver、diffProvider和interaction由原fixture/基座提供。未发现另一确定依赖遗漏；这是静态依赖核查，未到达的实际运行仍须执行，不能预先保证39项通过。

原4真实Move入口之前的完整源码区与a166逐字一致；从新增生命周期test开始直至文件末的完整区也逐字一致，全部39场景expected、replacement/clear/dispose观察、finally恢复spy和反馈负控未改。Pane所有权补修与Move关闭代数不受此次fixture修订影响，§16生产静态结论继续有效。

§17生命周期首轮夹具失败现有永久原件 `65cf42e3dfebd6cead138669c2c2762ca12dc3cb`。reviewer直接Git核其中 `m01-old0da-a166-lifecycle.log` SHA256 `51ce0aea9498f185b9853269bba12235ae0f686f4ad3757000c461a408c44f43` 与§17临时raw相同；其0 passing/1 TypeError、生命周期业务红0历史保留，不改成通过。

**Assessment：允许唯一lane用本次test配精确旧0da Pane重新验证生命周期业务旧红，再按父调度第七次实际完整编译和39项/完整相关套。** 新运行结果未到时，不把原Move四红当生命周期旧红，不把完整fixture静态合同当运行green；新freeze/D after仍待。作者AST/lint未由reviewer重跑；B起点clean `18828520a95670cc4aa212552fb01cbc0929ed49`、src fdca不变，仅原报告+INDEX，无compile/typecheck/transpile/out/native/UI。


## 19. 生命周期混合旧红的进度服务定界与补修复读（2026-10-27）

### fccde实际结果：已达业务断言，但夹具仍有独立错误

唯一lane以fccde新test配精确旧0da Pane实跑0 passing / 2 failing。reviewer直接读 `/tmp/vscode-m01-old0da-fccde4afb3ee-lifecycle.log` 与JSON，raw SHA256 `5f10852bcf649322992f992cacfa06a54d38409177a304ded066b12894dfd213`；source为 `65cf42e3dfebd6cead138669c2c2762ca12dc3cb` / src d5eca。首失败准确为 `replacing input must release its comparison view model`（false !== true），已经创建VM并到替换释放业务断言；第二afterEach失败为unexpected TypeError读undefined.show，clear/dispose后续断言未达。应记录**1条真实业务AssertionError与独立夹具错误并存，非干净纯业务旧红**；JSON的保守lifecycleOldBusinessRed=false不代表业务断言从未到达，也不能把mixed结果包装成满足门禁的纯红。

独立读恢复后的native与不可变TS确认：native DiffEditorWidget.js:350对应TS:404 `_editorProgressService.show(true, 1000)`，位于新model初始化的isInitializingDiff autorun，从setDiffModel事务触发；这是缺IEditorProgressService，**不是旧悬置VM在widget销毁后异步回调的次生错误**。真实EditorGroupView:222通过child ServiceCollection提供组级EditorProgressIndicator，原4真实入口有此组级DI；feedbackPane直接createInstance(ConversationDiffReviewPane)没有真实组级注入，而workbench基座注册的IProgressService是另一接口，不能替代它。§18闭合SCM接口的静态结论保留，此新增运行事实不得隐藏。

扩展静态依赖复核覆盖DiffEditorWidget、DiffEditorViewModel、双CodeEditorWidget与diff子组件：context/instantiation/codeEditor/accessibilitySignal、VM diffProvider、theme/notification/accessibility/language config/features、interaction、menu/keybinding/contextMenu等由基座或显式fixture提供；未发现当前生命周期路径另一确定缺口。clipboard仅作为内联viewzone交互参数，本case未触发复制，不据此承诺所有未执行交互都通过。未找到可导出的正式Null/TestEditorProgressService；standalone同名职责类不导出且不宜为fixture导入其全局注册。既有chat CodeBlockPart:745采用完整局部IEditorProgressService实现，show返回公共emptyProgressRunner，showWhile await原promise，可沿此模式补fixture。

**本次新增C0/I1/M0，I1限定组级progress夹具。** 最小补齐完整公开接口，保留真实widget/model、业务expected及unexpected/leak门禁；showWhile要真实等待并保留reject，不能吞错误。父已授权原J本地补修，仍无新产品合同/方案；补后由唯一lane再以旧0da实际重跑，未合fccde或启动compile7，不为让旧producer“干净”而删测试/关检查。当前163输出恢复声明由lane保管，reviewer不代跑native或逐产物恢复。


### 64a4进度接口修订：Critical 0 / Important 0 / Minor 0

受审不可变 `64a4e46b5fa27d48920789aa4b66e7340dfa833b`，父 `fccde4afb3eeca0b9264b732efef6b5e31e4b380`，src `ab952ce1fc0bd279754f747460bea9a8dc97f216`，仅1test+3行动docs。reviewer独立读完整test diff并核父/src/hash。新增6行仅导入公开progress模块并在direct feedbackPane注册完整satisfies IEditorProgressService：brand、show返回正式emptyProgressRunner、showWhile async await原promise。没有catch吞拒绝，没有禁用diff autorun、伪造diff完成或屏蔽unexpected；公共空runner覆盖total/worked/done，足以支持真实widget进度清理，不是返回undefined的新空mock。

**本节progress夹具I1源码闭合。** 此变更提供真实编辑器组在产品中本已提供的组级依赖，不改全局注册或生产，也未引入standalone模块副作用。§19上半部扩展依赖核查仍适用，未发现当前路径另一确定缺失接口；实际尚未走到的行为继续由lane验证，不能仅凭补齐DI签完整green。

受改test SHA256 `83653d3619affa62557b4c431cba6000cbe1e329943826c411fd9ca85695f75c`；Pane仍 `e40ac060e2cc52e986b5326604858473e2a2128862e158ada7de45ac262e9f2a`，src路径diff证实全production不变。真实4 Move入口区及从lifecycle test至文件末分别与fccde逐字一致，39项expected、Spy原方法执行及finally恢复、leak/unexpected门禁均保留。没有为了让旧producer失败干净而移除业务或错误断言。

**Assessment：定向C0/I0/M0，可继续64a4新test配精确旧0da Pane实际旧红；正式原件接入后按父调度完整compile7、新39/相关套。** fccde混合结果完整保留为“1业务assert+独立progress fixture error”，不改写为此前纯红；新准确结果未到前仍不签纯生命周期旧红。B起点clean `1d30f1ff5c67b0717a108a11a5a466665dbc50df`，仅本报告与INDEX，src fdca不变；无compile/typecheck/transpile/out/native/UI，短C/I已交父/原J/唯一lane。
