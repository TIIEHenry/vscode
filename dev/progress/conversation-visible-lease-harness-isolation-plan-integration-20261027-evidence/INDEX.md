---
title: "Conversation fixture / emitter窄方案：真实三路接入证明"
type: reference
status: active
phase: M7
updated: 2026-10-27
summary: "80dc02严格双亲3a14/ea92、base8033/srcfa6；1931矩阵/1927无争议/外22242、四docs五块双canonical全文重放精确；只方案接入，原诊断/全.build FAILED不改，A片候选未接入、B准备/运行待授。"
---

# Conversation fixture / emitter窄方案：真实三路接入证明

实际merge为80dc02d8a98e1190dd9039c810431c3105786588，严格双亲3a14d6ed28c03f54668ae06ea47f45bc23b8f171与固定ea92e8da62ab9c12da0681867114acbe187c1004，真实base为8033a3c23ba2b0550e817c9cc4fdebf4d12a4478，tree为87926c712ca2ea60686a20a70ab933133c5df5f4。全部src保持ours fa6f7fe9f339963dd9f4190f44aa17e45f6ad731；incoming的src f49b只是其base来源，本次未替换。第一亲实际只五docs，proof未进merge。本目录及六份当前文档另行准备并暂存，等待root检查和单独proof commit授权，未提交proof、未push或同步main。

[新accepted方案](../../plans/conversation-visible-lease-harness-and-emitter-isolation.md)整篇24338B / SHA-256 734fc7a49cb68187bcecc09a2c7fa2c45533a2794fff3bd383cd1b9957e6940c与固定incoming逐字相同；从第1节至第5节前亦整字节等于reviewed db02。原Astra b349 C0/I1/M1 → db02窄验C0/I0/M0 → root020951采纳 → ea92仅accepted与规则16签收，不由方案状态取得工具或运行许可。原reviewer署名/全文来自incoming文本与root直接消息，未取得原终端transcript，不伪造。

[当前授权边界](current-authorization-boundary.json)：固定4f264源码候选已另获A片授权、原Astra C0/I0/M0经root02ff独核采纳，但未接入本次srcfa6。merge状态首条沿用先前“源码待授”时态，已在原merge/canonical原样保留；本独立docs澄清当前候选已peer未接入，B准备和运行待另授。incoming plan当时的历史授权叙述整篇不改。无新运行成绩，旧lease accepted、Sources四窄implemented、产品/PRD/overall active不升。

## 固定输入、实际合源与完整重放

- [固定ref/tree](fixed-input-identities.json)、[fresh union全矩阵](premerge-path-matrix.json)、[范围外逐项矩阵](outside-union-paths.json)：oursChanged1930、incomingChanged5、shared4、union1931、无争议1927、外22242。[prospective完整树](prospective-complete-tree-audit.json)和[committed完整树](committed-complete-tree-audit.json)逐项mode/type/blob精确；incoming未改的所有路径及全部src均ours，无额外追踪路径。
- [三方raw inventory](three-way-inputs-inventory.json)、[reviewed db02整篇](reviewed-db02-plan.raw)、[canonical实际调用与退出](canonical-merge-results.json)、[真实merge调用](merge-invocation.json)、[stdout](merge.stdout.log)、[stderr](merge.stderr.log)、[原unmerged index](actual-unmerged-index.txt)：真实merge --no-ff --no-commit固定ea92 exit1，四docs/五blocks；四份实际冲突全文等于default canonical。default/diff3各自exit1/1/1/2是冲突计数。
- [逐块resolution与完整重放](conflict-resolution-and-replay.json)列两种canonical每块full/ours/incoming、diff3 base、所有outside片段、resolution raw及完整replayed。default和diff3独立解析，不假定两种分块边界相同；diff3用自己的outside锚定完整目标，十块各有完整resolution，八份全文重放均等于实际resolved文档。
- board/checkpoint保完整ours前缀；[独立尾LF边界](independent-tail-leading-lf-boundary.json)明确incoming相对base独立tail分别3212→3211B、95380→95379B，前导2LF→1LF，是canonical共同LF边界归并，所有非前导LF内容whole exact。不能声称原tail所有前导LF亦原封；default每块resolution确实为完整block ours+LF+完整block incoming，两种全文重放仍精确。原长篇计划/审查/生成失败史均保留。
- plans INDEX新增incoming独有accepted行并保ours六行/四Sources implemented，未用incoming旧accepted行降级。status当时只变ours第7/12行，仍200行。[ours父首条含LF](ours-status-first-entry.txt)、[incoming父首条含LF](incoming-status-first-entry.txt)、[merge首条含LF](merge-status-first-entry.txt)、[当前proof首条含LF](proof-status-first-entry.txt)独立保存。
- [完整cached merge diff](merge-staged-complete.diff.raw)、[身份](merge-staged-diff-identity.json)、[提交进程](merge-commit-process.json)、[commit object](merge-commit-object.raw)、[双亲/范围核验](merge-commit-verification.json)保普通commit actual0。未amend、未whole-ours消冲突、未source-copy同步。[root冲突审查归因](root-fixed-conflict-review-attribution.json)记c514b4/092b0c actual0直接消息，未冒充原终端raw或最终publication接受。

## 原失败、原件与本区间保护

[原8033结果及原件](../conversation-visible-lease-setup-diagnostics-8033-outcome-20261027-evidence/INDEX.md)不改：固定3497/srcfa6，driver0 / protocol accounted-official-outcome / official1 / out恢复complete分列。实际Pane-open setup先败，缺IConversationWorkRootMount，674业务断言未达，expected old-red boundary not established；原Astra两份C0/I1/M0经root采纳合C0/I2/M0。外层全.build保护FAILED，不能以driver0/out恢复覆盖。createCompile→reporter.writeBuildLog→.build/log静态链与时序仅支持高置信解释，没有syscall/PID或逐阶段writer快照，不称唯一writer、确切次数或dry实写。

[原件before](preservation-before.json)核五历史目录797文件/223012410B与215非普通entry。合并前后[前guard](guard-before-merge-commit.stdout.json)、[后guard](guard-after-merge-commit.stdout.json)及对应process均actual0，保inline stdlib/Git只读原文与stderr：所有原件bytes/SHA/mode/mtime/ctime、路径集合和旧结果proof280文件精确；out15500、native256、freeze4/cache3、旧新28owned PID/start quiet、X117无socket/lock。src15715/node_modules48772全metadata精确；.build6777仍只已知.build/log漂移：内容[]/2B/mode33204，mtime/ctime 1793092674886086457 → 1793100181156749660。本出版区间未再漂移，原运行whole保护仍false，不回写log或扩恢复例外。Reveal唯一已授权ctime历史为1793092686521596622 → 1793100193532575159，旧Pane未写、未伪恢复。

[执行边界与错误](execution-boundary-and-read-errors.json)另存一次functions.exec封装SyntaxError原文字：Markdown反引号位于JS模板导致调用拒绝，未启动nested shell或落盘，修正封装后继续；不是产品、Git、driver或guard失败。另有两次tail reader读取失败：feef71因base rstrip误去自身终止LF、board误算3213而断言exit1；3dc45f因未使用的board标题查找不适用checkpoint而ValueError exit1。均保存失败输入/空stdout/stderr和部分已写产物清单；修为先证incoming整份base前缀，再以完整base字节长度切尾，得3212/95380。未触源码/out，不归Git/driver/guard失败。真实merge/canonical冲突退出与实际官方失败分列，旧generator/reader错误原件保持。无新Program/checker/AST/lint/compile/transpile/emit/tests/UI/engine/after，没有B工具准备/activation/release、fresh native或fullCompile信用。

## 独立proof / docs交付边界

[六文档整篇重放](publication-documentation-edits.json)及[实际patch](publication-documentation-edits.patch)只补真实merge身份、证据导航和当前授权时点；incoming方案整篇、父结果proof/packages不改。双方历史首条、完整方案和审查原稿均保留。

merge三门禁actual0：full cached diff --check无排除、generate-docs-status --check、docs-health（0 errors/47 link warnings，含当时未出版的本INDEX）。原始stdout/stderr与process见merge-gate-*。proof阶段先保完整cached实际输出；任何仅针对lossless evidence原文的检查排除须root就本次精确路径另授，绝不继承旧排除或把完整失败洗成通过。独立proof commit仍待另授。

出版闭包由[Included](included-paths.json)、[inventory](publication-inventory.json)和[staged audit](publication-staged-audit.json)列全scope；inventory只排自身和staged audit避免循环，staged audit只自排，两者仍在Included并另报身份。最终门禁、完整cached原输出、root精确path裁定和freeze前保护以本目录实际文件为准，不提前声称root已接受。

本轮proof完整cached首轮actual2：128诊断/36paths，原stdout24630B/SHA863bf3bd4f7618afd560289fc263bf9abc744cad89d8b35e7ef4e0c2ceb41af8不改；纳入该raw后第二轮[完整结果](proof-final-full-cached-check-result.json)actual2：132诊断/37paths，stdout25262B/SHAc87a17e738a3f16672c9b5948fcb05811e1cbbbc97f127fcaefe55b2c74b89a1，以base64无损保存避免原空白诊断递归。120 conflict-marker + 4 EOF空行 + 8 trailing whitespace均来自本目录lossless原文，无六文档诊断。[root精确37path裁定](exact-scoped-exclusion-authorization.json)仅用于本固定report、逐路径排除；root32bdac/fe0f8f独核actual0的消息署名和原文保留，不伪造终端raw。完整失败、原raw保持；[scoped实际结果](proof-scoped-cached-check-result.json)独立列示，不把scoped通过等同full通过或proof commit许可。

[freeze前guard](guard-before-proof-freeze.stdout.json)actual0（54dc3b→fce37b），八份完整重放与每份raw、六文档whole replay、方案整篇、797+215原件和旧proof280精确；srcfa6/out/native/全metadata/ownedquiet同前，original whole.build protection=false保持。最终门禁输出见proof-final-gate-*；Included/inventory/audit为冻结scope，不代表root已接受或授权提交。

最终文档门禁：generated-status actual0，docs-health 622 Markdown / 0 errors / 46既有link warnings；exact37 scoped cached check actual0且stdout/stderr均空。完整cached仍为actual2，原report及120+4+8诊断保持。六文档status仍200行、四Sources implemented/lease accepted不变。proof仅冻结并交root，不执行普通proof commit。
