---
title: "Conversation lease：固定3fc单次隔离诊断与恢复证据"
type: reference
status: active
phase: M7
updated: 2026-10-27
summary: "driver0/official1、meta过/L1到676；A真实前置与B本次失败路径隔离/限定恢复经原Astra C0/I0/M0及root采纳，永久consumed，无业务或after信用。"
---

# 固定3fc单次隔离诊断

本次发布固定父3fc83b388a0977b36ecc8add7863d1f9a2a46eac / source tree 3dc1205763451e60e70c1a8a84465613990aa526的唯一诊断及文档。没有产品代码改动；[主lease方案](../../plans/conversation-visible-lease-recovery.md)和[fixture/emitter窄plan](../../plans/conversation-visible-lease-harness-and-emitter-isolation.md#11-固定3fc单次隔离诊断及当前验收2026-10-27)仍accepted。Sources四窄、产品/PRD/旧D/旧波不升。

## 本次结果与可接受范围

唯一调用为rtk proxy /usr/bin/python3.10 -B /tmp/vscode-conversation-visible-lease-work-root-mount-isolated-diagnostics-20261027-prep2/validate.py；实际driver exit0，108.01秒。checker、lint、dry、emit-reveal均exit0，diagnostic-L1官方exit1；无watchdog、signal、auxiliary或mandatory失败。driver0表示已记录并收束官方结果，不能把L1 fail改写为测试通过。

- 官方2 tests：meta pass1、L1 fail1、pending0；10 hook start与10 hook end。主AssertionError为“catalog ready must restore this visible Pane lease without hide/reveal”。[官方Mocha](prep2/diagnostic-L1.mocha.json)、[原stdout](prep2/diagnostic-L1.stdout.log)、[原stderr](prep2/diagnostic-L1.stderr.log)、[事件](prep2/diagnostic-L1.observed-events.json)独立保留。
- A真实fixture前置链已越过Pane-open，到本次fresh JS645:14，经[inline map](prep2/fresh-Reveal.inline-source-map.json)及[映射报告](prep2/fresh-Reveal-source-map-report.json)准确落到冻结Reveal源676:11的lease断言；不同于旧8033 setup失败。只接受前置链到达，没有精确a4a业务old-red信用。
- B仅验收本次official-fail路径的隔离、记录、stop、quiet及限定恢复。[总报告](prep2/diagnostic-report.json)136151B / SHA-256 ef1271dfa71a9c9716fb4801fd4279209e9ae4dfe808459c3019845be92a0d40。12份guard为各阶段前后10加初始/最终2；5份poststage和独立[poststream证据](prep2/stage-emit-reveal/control/poststream-guard.evidence.json)另列。
- dry/emit各一次实际reporter mkdir和一次write定向各自scratch，data均为[]、2B；完整options、result、stack、PID/start/token见[dry report](prep2/dry-emitter-report.json)、[emit report](prep2/emit-reveal-emitter-report.json)及两份fs-audit原件。原.build/log仍[] / 2B，mtime与ctime均1793100181156749660，不回写或repair日志。
- parent PID3952876的真实grant持久化先于outWriter PID3957235的唯一deadline内WAL intent；[journal](prep2/emit-reveal-out-write-journal.jsonl)恰1 intent、1 completed，partial0/protocol0。[资格证明](prep2/emit-reveal.parent-write-qualification.json)与[恢复审计](prep2/restoration-scope-audit.json)分别保留。
- 仅Reveal发射254747B / SHA-256 dbbfdd84f16399d877f67e736204ba60fc7df71b63273bb2ba2218bb8001a9ea，25个owned PID/start quiet/reaped后仅恢复Reveal旧bytes/mode/mtime。Pane未发射、未写入、未恢复；共享compile锁可用，X117已不存在。[双目标CDP观察](prep2/diagnostic-L1.loaded-assets.json)中Pane和Reveal各自精确；1130 loaded / 10038 manifest-only不代表coverage。

失败体按原utils控制流跳过computeLeakingDisposables；hooks平衡与owned quiet不证明leakfree。保护边界采样不证明每个syscall或全部异常注入。正式业务old-red/new-green、固定新13、完整Reveal及非作者真实默认编辑器after均未获信用；本次诊断永久consumed，不重跑。

## 恢复起点与来源

[最终恢复guard](prep2/guard-after-restore.json) SHA-256 715f604de0029670e213bf808f20a9b18184d303257d273142003cc5dd119f25是当前出版及后续工作的实际起点，不能倒用历史821快照吸收差异。out15500中仅Reveal合格ctime从1793100193532575159变为1793113874206815079；Reveal旧147236B / SHA-256 49a3a5a11180b3c07bad410cf7c42f701ddd272ac2de4ff857aee3733073be5d的bytes/mode/mtime精确。Pane42101B / SHA-256 74b65707aa69404258e9d3b759f93b5808b21ec4a311e1af953132d5c7729629完整精确。

src15716、.build6778、node_modules48773全元数据tuple，context97079、external23442内容hash，current native256加Reveal、freeze4/cache3、旧prep1与历史原件均保持。出版区间另做[before只读保护](review/publication-protection-before.json)及after只读保护，沿用715基准，不执行候选guard/helper。后续结果、门禁和最终Included路径见publication-content-index.json；该文件自排除自身的内容hash，由外部交付其hash，避免自引用循环。

冻结Reveal输入为81721B / SHA-256 8a9c3245ae661b68e160c6a1c0d79924159618da7b342c5b09cd46caa1f35e61，source blob feb55eeed2013c948ae487bdba8217887d2fc0b5；真实incoming ref仍4f2648d936508e300475c9cd52e5855a58c7ed93。[source-inputs](prep2/source-inputs.json)、[source boundary](prep2/source-boundary.json)、[当前绑定](prep2/current-source-old-native-overlay.json)、[v3到实际包重放](prep2/derivation/tool-v3-to-actual-package-replay-index.json)不改原内部绝对路径。11份实际可执行工具文本在prep2以.raw惰性保存，不执行镜像。

## 授权时态与审查归因

[冻结审计锚](prep2/package-final-audit.json)80421B / SHA-256 269e868fa5ad5915d32f7b37c1210db31ad521b367348e1c269c027438b770a8保持审查时false / prepared0；178 immutable pins不变，原131工具绑定加18 manifest-only绑定为149。root后续只独立授权更改release的state、executionAuthorized、activationAuthorized、authorizedBy、authorizationMessage五字段：[before原件](review/execution-release.before.raw.json)、[after原件](review/execution-release.after.raw.json)、[精确diff](review/execution-release.activation-diff.json)。其他字段与冻结invocations0不追改。

实际[one-shot consumed](prep2/execution-consumed.json)、[外层调用原结果](review/driver-invocation.actual-result.json)、[stdout raw](review/driver-invocation.stdout.raw)、[stderr raw](review/driver-invocation.stderr.raw)另证consumed1。[独立单次授权](review/root-single-execution-authorization-forwarded.json)与[出版授权](review/root-topic-publication-authorization.json)不是同一权限，也不允许重试。

- 原Astrawhole-package静态审查C0/I0/M0、root采纳：[完整内容转录](review/original-astra-whole-package-final-root-forwarded.format-normalized.txt)4705B / SHA-256 4dbd331d0d5f0c9204c1ea825d107bee1343f014672dbca9f2fa5db8f04e9427；这是root-forwarded complete-content transcription、format normalized，[归因](review/original-astra-whole-package-review-provenance.json)明确不是原消息逐字字节快照或terminal raw。
- 实际单次验收C0/I0/M0及root结合5945e7独核采纳见[root转述摘要](review/original-astra-actual-outcome-root-summary.json)与[root执行后独核](review/root-post-execution-verification-forwarded.json)；前者是root paraphrase，不能冒称原Astra逐字报告。root独核reader schema/path错误按原记录保存，不归成候选缺陷。
- [源码v1 C0/I4/M1、v2 C0/I1/M0及v3窄审](../conversation-emitter-isolation-source-review-20261027-evidence/INDEX.md)保持原结论。[旧8033官方1及whole .build FAILED](../conversation-visible-lease-setup-diagnostics-8033-outcome-20261027-evidence/INDEX.md)仍为失败，不由当前通过的隔离/恢复路径覆盖。

## 完整原件、选中出版与未出版边界

[消费后完整package inventory](review/postrun-package-inventory.json)含557条：397 regular files / 642854201B、160 nonregular（含根）。prepared181当前117256740B，比原117254296B增加2444B仅因已授权release；新run216 regular / 525597461B。原/tmp prep1、prep2及review均保留，没有删除、清理、重命名或回填。

- 选中138份package原件 / 67385792B完整复制，包含所有阶段raw流、28.7MB实际loaded-assets、唯一poststream、20.16MB最终guard、WAL/控制/资格/source maps、fresh JS、11工具源码及lineage/authority。加复制时review增量和四份历史docs，共171份原件 / 68395040B；[逐原件source→published映射](copied-originals.json)列绝对来源、原metadata、bytes与SHA。八条被替换summary/首bullet含LF另存history/lines；后续出版保护与门禁增量由最终content index单列。
- [259份未出版原件manifest](not-published-originals.json)共575468409B只列原绝对路径、metadata/hash与理由；这些完整bytes没有入Git，仍只在/tmp原路径。主要为重复大guard/meta、静态上下文/依赖/二进制/旧accepted原件、派生native provenance、cache/crash/RTK数据与dry重复JS；不得称为全部原件已入库。
- [原runtime交付index](review/run-outcome-delivery-index.json)210105B / SHA-256 d157c18a92f399b61236d256ed49ad73adbf03d0bd140e6f004b3b0996435dfd覆盖其捕获时package557与review24；其自身和后来review增量分别列外部边界，不追改旧index。
- 源码、Markdown与unified diff只加.raw后缀，bytes不变；本地.gitattributes对prep2/review/history设-text，保护Git blob。原unified context markers与全部bytes保持；临时Git index完整cached检查exit0，选中原件无尾空白，不需要任何路径例外。初次出版reader错误地预期非空findings而断言失败，与实际git检查0/空输出分列，见gates中的reader记录及纠正；不清洗原bytes。

本提交只运行文档generator、--check、docs health及diff/只读保护与git操作，未再执行checker、lint、compiler、syntax或test。下一步须另授权、另准备业务包；新Pane发射、old/new切换、phase/test selection/restoration或判定扩展均属语义工具变更，必须源码peer和整包peer，不得仅扩manifest复用本包许可。本次不准备新工具或新方案。
