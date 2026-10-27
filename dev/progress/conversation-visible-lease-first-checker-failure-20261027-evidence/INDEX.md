---
title: "Conversation 可见叶 lease：首次 checker 失败原件"
type: reference
status: active
phase: M7
updated: 2026-10-27
summary: "f33/src90d609单次driver/checker exit1：Reveal新L4语义5条TS2339；其余六阶段/after未运行。prep1/prep2与激活全保，两JS未写/metadata54fe精确，lease accepted。"
---

# Conversation 可见叶 lease：首次 checker 失败

本次只发布原件与当前文档，严格父`736171b1abc34e36e4991709240625827b566396`、`src=90d6092dbbca80114db7f55a75e137bb1d7bef76`不变。Sources四窄implemented与旧证据保持；[lease方案](../../plans/conversation-visible-lease-recovery.md)仍accepted，overall active。[真实合源证明](../sources-lease-f33-formal-integration-20261027-evidence/INDEX.md)不由本次失败重写。

唯一driver在2026-10-27 08:07:49.253463–08:08:13.104478 UTC实际exit1、phase=stopped-no-retry；checker实际exit1，watchdog=false、stderr空。TS6.0.3读取实际src项目10316 roots/11250 program files，Pane语法/语义0，Reveal语法0/语义5条TS2339。config/global/options/非目标语法均0；非目标语义未请求，不声称全src semantic clean。noEmit=true、emitInvoked=false、forbiddenWriteAttempts=0、fullCompile=false。

| 原JSON零基line:character | 一基line:column | never上缺失属性 |
| --- | --- | --- |
| 808:45 | 809:46 | sessionId |
| 817:26 | 818:27 | onDidApplyFrame |
| 828:40 | 829:41 | snapshot |
| 835:36 | 836:37 | snapshot |
| 849:35 | 850:36 | snapshot |

lint、dry、emitReveal、old-L1+meta、emitPane、fullReveal六阶段均未到达。业务旧red、新13矩阵green、原Reveal、title/meta/hooks和非作者默认编辑器窗口after未运行，不能写成0 passing。原Astra/root归因于新L4公开restore前的undefined属性路径窄化保留，建议下一作者test-only引入公开restoredLens/同identity并替换两处读根；这只是署名意见，本lane未接新候选、未改源码、未复跑，不改方案合同。

原始运行与封存：

- [driver报告](prep2/validation-report.json)、[checker完整报告](prep2/source-checker-report.json)、[stdout](prep2/checker.stdout.log)、[stderr](prep2/checker.stderr.log)、[消费记录](prep2/execution-consumed.json)；[失败摘要](first-checker-failure-summary.json)只读派生。
- [174份镜像inventory](artifact-inventory.json)：prep1当前52、prep2当前122，保留bytes/SHA/Git blob/source mode；不执行镜像工具。prep1原inventory 51 rows/self除外，原schema无mode；prep2原109文件包108 rows/self除外、含mode，当前122含激活与实际失败文件。[成员与false release映射](preparation-membership-and-release-mapping.json)按各原schema验证，source/mirror mode另核，不改写旧清单冒充active。
- prep1原工具peer C0/I1/M0/root采纳：finally不能因漂移恢复从未写过的Pane或给两路径统一ctime例外。prep2将parent单输出/PID-start-command合格spawn、原journal不存在与可信同phase intent/completed作为restorable subset依据；complete、partial/uncertain、notAdmitted、restorepaths与ctime分开，缺失/损坏/越界证据非零，未写路径bytes/mode/mtime/ctime精确、不得repair。原Astra frozen-runtime与final-package静态peer C0/I0/M0/root采纳。[消息归因](peer-and-root-attribution.json)为署名摘要，不伪造原review报告。
- prep1五份变更JS各node --check一次，Python仅ast.parse；prep2仅变更binding再一次node --check、五份未变JS继承结果，原reporter不重跑。[prep1语法记录](prep1/syntax-checks/validation.json)、[prep2语法记录](prep2/syntax-checks/validation.json)、[driver派生](prep2/driver-derivation.json)及所有patch完整保留。
- prep2 inline sealing reader的runtime-* glob误把静态JSON当目录而AssertionError：[原tool输出](prep2/preparation-observed-reader-failure.tool-output.txt)、[归因](prep2/preparation-observed-reader-failure-summary.json)。root要求将同bytes/mode文件移至[preparation-evidence/runtime-surface-delta.json](prep2/preparation-evidence/runtime-surface-delta.json)，[迁移记录](prep2/preparation-static-metadata-relocation.json)保留，driver不变；不是产品/runtime/guard失败。
- activation独立授权，仅改state/executionAuthorized/authorizedBy/authorizationMessage四字段：[原false release](prep2/prepared-state/execution-release.json)、[原inventory](prep2/prepared-state/preparation-inventory.json)、[原pins](prep2/prepared-state/pinned-files.json)封存；[active release](prep2/execution-release.json)、[四字段patch](prep2/release-activation-four-field.patch)、[activation证明](prep2/release-activation.json)。21 runtime pins/其余字段精确；root另行明确“运行driver一次”，只消费一次。

保护与出版：

- [执行前guard](prep2/guard-before.json)、[finally guard](prep2/guard-after-restore.json)、[恢复范围审计](prep2/restoration-scope-audit.json)：completed/partial-or-uncertain/journal/restore/authorized-ctime差异全空。两JS未写、bytes/mode/mtime/ctime保持，restorationWriteAuthorized=false。cleanup先于restore，8个实际owned PID/start采样，signals/residual/remaining为空，root独核alive0；无Xvfb/test/UI/engine。
- 15500 live metadata与54fe基准精确；native256为5新source/旧native与251未变，Reveal旧JS在256外单列、无旧producer credit；freeze4/cache3精确。出版另做[只读守卫](publication-final-protection-guard.json)，不执行准备好的guard/helper，不写out/cache/freeze。
- [父status原首条含LF](parent-status-first-entry.txt)、[身份](parent-status-first-entry.json)、[文档修改证明](documentation-edits.json)、[patch](documentation-edits.patch)、[固定输入](fixed-input-identities.json)。原plan §1–§9与checkpoint旧正文前缀逐字保护，当前cover优先；无编号证据附记仅追加失败事实。
- 出版脚本两次读取错误也独立留证：[prep1 inventory无mode](publication-observed-reader-failure-summary.json)及其[tool原文](publication-observed-reader-failure.tool-output.txt)、[历史YAML summary匹配多行](publication-observed-doc-reader-failure-summary.json)及其[tool原文](publication-observed-doc-reader-failure.tool-output.txt)。均非scratch工具或产品运行，不改原件；分别按原schema/首frontmatter定界修正。
- [Included精确清单](included-paths.json)、[出版inventory](publication-inventory.json)、[staged审计](publication-staged-audit.json)完整列本主题。inventory自排除自身与staged审计以避循环，Included仍列二者；staged审计自排除，仅在最终只读核验中再验证自身。

完整cached检查保留实际stdout/stderr/result；本次任何原始patch/log诊断逐路径交root独立裁定，旧合源8/9路径排除不继承，原bytes不得清洗。文档门禁仅generator/--check/health与diff检查，本提交不push、不合D localGit、不做E修补或main同步。

本次出版门禁实际结果：generator与--check均exit0；docs health检查614份Markdown、0 errors/46既有links warnings，unstaged diff check exit0。完整cached原首次exit2/35条/5path；暂存raw stdout后完整cached exit2/70条/6path，均trailing whitespace。root逐路径独核[授权精确六原件排除](exact-scoped-exclusion-authorization.json)，仅用于scoped cached check，完整失败事实和raw bytes保持。[最终完整cached原输出](publication-final-full-cached-check-result.json)以lossless base64保存10357B/SHA3010d797…，避免新增日志递归制造尾空白；首4936B raw日志仍原样入库。
