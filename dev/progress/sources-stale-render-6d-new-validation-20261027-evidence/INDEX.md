---
title: "Sources 固定6d一次新验证与四窄方案验收"
type: progress
status: completed
phase: M7
updated: 2026-10-27
summary: "六stage实际全0；新54+18逐名、完整Pane3/3与Panel142/142及旧stale本体通过，root独核四窄plan implemented；54fe恢复旧native，历史不改/fullCompile=false。"
---

# Sources 固定6d一次新验证与四窄方案验收

执行父HEAD **`01c0addecff0b3ddd98afc1259c00a9f0ceaa3ba`**，sourceRef **`6d848eacc578dea0c5c6f39721b00047f9c12469`**，src **`4243970658ddd668d1f89e0a97d7f41ba94d3300`**。root接收[正式合源](../sources-stale-render-6d-formal-integration-20261027-evidence/INDEX.md)与原Astra固定工具审查后，先核激活再另发单次执行指令；[实际driver报告](prep2/validation-report.json)和exec session17665均实际exit0，06:34:04–06:35:04 UTC执行一次，无重试。

## 准备原稿、窄修订与单次授权

- [prep1原inventory](prep1/preparation-inventory.json)覆盖63成员/1249582B，连自身64文件/1261090B全保。[保护证明](prep2/prep1-preservation-proof.json)核原路径/bytes/mode不变；原规则16工具peer C0/I0/M1及四处错误486行号原稿保留。两次静态helper读取/封包失败只保观测归属摘要，不虚构raw stderr，不是业务失败。
- root采纳M1并另授权prep2机械修订：三JSON内四镜像第二条title assertion行号486→491，数组均为486/491/492/493；第一条/其余断言文本、顺序、case hash与运行逻辑不变。[四处修订表](prep2/legacy-line-metadata-corrections.json)、[metadata-only patch](prep2/mechanical-diffs/four-line-metadata-only.patch)、[全63成员delta](prep2/prep1-to-prep2-file-delta.json)和[20运行surface矩阵](prep2/runtime-path-matrix.json)分列，13原字节/7仅路径或派生绑定。driver/binding反向literal后逐字等prep1，guard/四coreJS/owner/projector/createCompile不变。
- [prep2 prepared inventory](prep2/prepared-state/preparation-inventory.json)12975B/SHA `f9d2162d9fe052411a35c7b0ce4caeba9e0eb14ddd574978f6330f600a7eca8d`，71成员/831451B；[14pins](prep2/pinned-files.json)未变。[语法报告](prep2/syntax-checks/validation.json)仅新binding一次纯node --check实际0/空流，四coreJS以原prep1精确hash继承结果、没有重跑。原Astra窄复核C0/I0/M0和root独核关闭M1；这是[父通报归属](root-independent-run-acceptance-summary.json)，不冒充独立reviewer raw文件。
- [激活映射](prep2/release-activation.json)保留[prepared release](prep2/prepared-state/execution-release.json)1959B/SHA `e9a23867011b3fb0359535c7c4276f2c81c52bd1d6eb5b4834f0c2ea9a63e5f2`与[active release](prep2/execution-release.json)3106B/SHA `ea40bc98b2e53423a4a7430b910597bf88a56537e226ce419217be1231d4b017`，恰四授权字段变化。原inventory及pins的旧release行只映射sealed prepared original；其余70行原路径精确，不能把active说成原inventory逐行相同。[consumed marker](prep2/execution-consumed.json)已写，本release失效，不复用旧prep1或旧a4a授权。

## 实际六阶段与逐名资格

[driver stdout](prep2/driver.stdout.log)/[stderr](prep2/driver.stderr.log)、[六stage与owned PID/start生命周期](actual-six-stages-and-owned-process-lifecycle.json)保留真实命令、环境、时序、exit、raw SHA与45+5+5 deadline。所有stage各执行一次、exit0、watchdog=false，无signals；所有owned先quiescent/reap再finally恢复。root独立核43 unique PID/start在/proc匹配活0，见[归属摘要](root-independent-run-acceptance-summary.json)。

| 实际阶段 | 结果 |
| --- | --- |
| 项目上下文checker | 10316 roots；5目标syntactic/semantic及config/global/options/nonTargetSyntactic全0，noEmit/emitInvoked=false/forbiddenWriteAttempts0；non-target semantic未请求，不称全src语义验证。 |
| ESLint | 五文件0error/0fatal/1旧warning：Panel.test:637 local/code-no-in-operator，原636代码连续；cache=false/fix=false。 |
| dry与actual emit | 仓库createCompile/ESBuildTranspiler/streamToPromise；dry五JS与actual五JS逐份bytes/SHA相同，actual3production+2test、0 standalone map，无第六out路径。 |
| 完整Conversation | 官方3/3过、0fail/0pending（2声明+meta1）；11 hook starts/ends逐title平衡。 |
| 完整Panel | 官方142/142过、0fail/0pending（141声明+meta1）；567 hook starts/ends逐title平衡。 |

[checker](prep2/source-checker-report.json)、[lint](prep2/eslint-report.json)、[emitter options](prep2/emitter-options.json)、[dry](prep2/dry-emitter-report.json)、[emit](prep2/emit-emitter-report.json)、[write journal](prep2/out-write-journal.jsonl)和[sealed originals](prep2/sealed-originals.json)均原件；dry-generated/emit-generated/sealed-originals各五份JS镜像保原bytes。未改controller虽实际重emit，不外推controller suite结果。

[72逐名实际资格](actual-new72-per-name-qualification.json)：54 Accept（Pane1+Panel53）及18生命周期每个unique fullTitle实际start/body-pass/testEndObserved各1，failure/pending/missing/unknown0。全145官方case、各meta与hooks独立核对；静态expected54/18/72从不作为运行计数，testEnd不替代pass。

完整模块原件：[Pane raw stream](prep2/full-conversation-pane.stdout.log)、[official JSON](prep2/full-conversation-pane.mocha.json)、[events](prep2/full-conversation-pane.observed-events.json)、[qualification](prep2/full-conversation-pane.qualification.json)；[Panel raw stream](prep2/full-sources-panel.stdout.log)、[official JSON](prep2/full-sources-panel.mocha.json)、[events](prep2/full-sources-panel.observed-events.json)、[qualification](prep2/full-sources-panel.qualification.json)。stderr原件保留：dry/emit各156B仅DEP0180 fs.Stats弃用；两Electron各78B仅rtk无自动hook提示，非业务失败。

旧 `Sources diff panel superseded async render cannot paint an older file diff` 实际whole-case start/pass/end各1。[固定source及整例结果](legacy-stale-source-and-whole-body-qualification.json)绑定四条原断言字节、顺序和控制流；没有逐assert运行插桩，不能把source行号说成每条独立runtime观察。[8438原首title实际失败/后三未达](../sources-accept-a4a-new-validation-20261027-evidence/INDEX.md)、[旧双A1业务red](../sources-accept-post-read-authorization-old-red-evidence/INDEX.md)、[run3 A4业务red及原default-false通过](../sources-accept-qualified-old-red-run3-20261027-evidence/INDEX.md)、[旧default-false setup失败](../sources-accept-default-false-probe-20261027-evidence/INDEX.md)全部不改。

## 恢复身份与验收范围

[before guard](prep2/guard-before.json)精确8b5f实际恢复旧native基线；[after emit metadata](prep2/guard-after-emit-out-metadata.json)仅精确五JS；[after restore guard](prep2/guard-after-restore.json)4185498B/SHA **`54fe37b2f942aa1afc5587d630199809ff4dc8e54bad610f577ffa6db8f60f1e`**是当前适用15500-entry metadata基准。与旧8b5f仅原五路径ctimeNs不同；五JS原bytes/mode/mtime、其他12549files与2946dirs全metadata、256旧native bytes/modes、current source256、freeze4/cache3均精确。旧8b5f与run3 90f8原guard原字节保留，不能再直接要求当前ctime等旧值。当前四current-source/old-native配对明确，fullCompileOfFinalSourceTree=false，不能给当前out fresh/fullcompile credit。

root采纳原Astra条件性最小充分验收边界且已独核满足，只有[Accept当前授权](../../plans/sources-accept-post-read-authorization.md)、[Panel生命周期](../../plans/sources-panel-diff-view-model-lifetime.md)、[共同factory预注入](../../plans/sources-panel-fixture-preinjection-amendment.md)、[旧stub唯一例外](../../plans/sources-panel-stale-render-stub-amendment.md)四窄plan accepted→implemented。[允许段patch](four-plan-allowed-edits.patch)/[反向字节保护](four-plan-allowed-edits.json)证明各旧设计/审查/失败章节及lifecycle633B例外不改，dispatch JSON全字节保护。只签source/真实组件合同；不另要求Sources UI after或未改controller suite，不声称实端Git索引、UI after、全srcsemantic或fullcompile已验。PRD/宽Sources/其他D与D1387旧签收/旧J-E波保持，overall goal仍active，无lease准备/集成。

## 原件和本次文档提交

[artifact inventory](artifact-inventory.json)记186份scratch→repo原件/20398372B，包含prep1原64与prep2原122；runtime profile/cache/crash内容仅[metadata](runtime-profile-metadata.json)，不清洗/覆盖旧run。[父status首条](parent-status-first-entry.txt)943B含原LF/SHA `5c2d9469209c190af6c1c085035a4f69031663ab806c0d51a0f6216888b486fe`保留于[检查点](../sources-accept-post-read-authorization-checkpoint.md#fixed-6d-new-validation-accepted)。本次只持久化证据/四窄签收/必要导航，不运行新Program/AST/lint/checker/compile/transpile/emit/test/UI/engine。[文档门禁](final-documentation-gate-results.json)、Included清单与[提交前只读源/native/proc保护](publication-read-only-source-native-proc-guard.json)分列。完整cached第一次实际exit2/37诊断/8路径，保[first raw stdout](full-cached-diff-check.stdout.log)6653B/SHA39423842；按root要求逐字staged后第二次仍无排除实际exit2/60诊断/9路径，[lossless base64结果](second-full-cached-diff-check.json)保存9708B原stdout，新增仅first raw自身23处trailing whitespace。root独读后仅授[当前精确9路径例外](exact-scoped-exclusion-authorization.json)，未继承旧排除；[其余Included真实scoped检查](scoped-cached-diff-check-result.json)实际exit0/空stdout-stderr，不能称完整cached通过。
