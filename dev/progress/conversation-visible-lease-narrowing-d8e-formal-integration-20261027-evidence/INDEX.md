---
title: "Conversation d8e读取根窄修：真三路合源证明"
type: reference
status: active
phase: M7
updated: 2026-10-27
summary: "0ef352真双亲14e/d8e、src62996b35；1104union/1100无争议/外22233精确，五canonical块与双方历史保全；新checker/业务/after待，无新prep，merge metadata54fe保持。"
---

# Conversation d8e读取根窄修：真三路合源证明

实际merge为`0ef3523047eb8825d97b2bc28ef0b05bec0bd977`，双亲严格为`14e20696554e60c820863c0e79a70fa0ac2ad499`与`d8e6f1c1a546bab726d17b5b7cda0c6ba319b3d3`，共同base=`f33d16fbc5841119f5baa7ff2788060d39b8bb4f`。tree=`c69c90c239f71e8ecf78c48f52530dba5d6ab1a7`，实际src=`62996b35d6e417c0b46a1f7e79b632414008b5be`。本目录随后独立纯docs-proof提交，严格以该merge为父，源码不再变。

原Astra对固定E窄修源码peer C0/I0/M0经root采纳；只取Reveal三行公开重读restoredLens/同对象断言、两receiver，原绘制await后才采集retiredLease。正反变换整份f33字节精确，保全部missing gates、其他L4/12新/26旧/defaultQuiet及生产。Reveal80259B/SHA-256 `110f7f43b5808af9a01d3ea0fdf6ab68aa4fa4dc9309e029f7f912405ced8646`、blob`91a05c4b89ff9bd159c471914e24b507ae3fd51d`；Pane15270B/`90c0719d26183f27ae8e4fbcbead63d6f7e6c4aef64c1bbc39a898a65b1501d3`不变。其余src全ours，四Sources plan implemented/52Bstub/全部旧新证据取ours原字节。

[7361首个checker失败原件](../conversation-visible-lease-first-checker-failure-20261027-evidence/INDEX.md)不改：五条TS2339、无emit/tests、run已consumed。d8e作者AST/lint与source peer不证明新checker通过。当前没有新prep、checker/Program/compile/transpile/emit/tests/UI/engine/after或执行release；[lease方案](../../plans/conversation-visible-lease-recovery.md)仍accepted，overall active，fullCompile=false。

合源与完整性证据：

- [固定输入](fixed-input-identities.json)、[premerge mode/type/blob矩阵](premerge-path-matrix.json)：oursChanged1103、incomingChanged5、union1104；shared精确4文档，uncontested1100全精确、范围外22233全不变。仅Reveal为incoming-only。所有三方原文保存于[输入inventory](three-way-inputs-inventory.json)，不追main/B或其他candidate，不checkout/restore/source-copy。
- [实际git merge调用](merge-invocation.json)、[stdout](merge.stdout.log)、[stderr](merge.stderr.log)、[原unmerged index](actual-unmerged-index.txt)及actual-merge-worktree目录原件：`merge --no-ff --no-commit`实际冲突exit1。3文档/5block；board与Reveal自动0块。
- [独立canonical merge-file命令/原件](canonical-three-way-results.json)、[逐块resolution与outside fragments](hunk-resolutions.json)：实际与canonical两侧/外fragment一致，5block精确重放；plan与checkpoint双方尾均ours+LF+incoming，status两summary/首条按scope合并，父首条另保。resolved-merge-worktree原文与合并commit逐文件一致。
- [prospective audit](prospective-merge-tree-audit.json)、[committed audit](committed-merge-tree-audit.json)、[merge commit结果](merge-commit-result.json)：全tree精确一致、真双亲、merge仅5paths。[root独立核验摘要](root-merge-acceptance-summary.json)为消息署名，不伪造review raw。
- [双方父status原首条含LF](parent-status-first-entries.json)、[ours raw](ours-status-first-entry.txt)、[incoming raw](incoming-status-first-entry.txt)、[merge首条](merge-status-first-entry.txt)。proof阶段将三条完整raw/hash分别追加checkpoint；status仍200。plan §1到merged EOF整份字节保护，含§6–§9、无编号首次失败出版与E§10；board/checkpoint历史原文并存。

作者E原件与失败边界：

- [固定六原件inventory](author-artifact-inventory.json)：一次AST-only（createSourceFile1/parse0/无Program）、一次eslint no-cache/no-fix（0error/0warning），显式NODE_DISABLE_COMPILE_CACHE=1；两份docs health JSON与只读baseline overlay脚本、旧aggregate guard按固定bytes/hash/mode镜像，绝不执行。作者docs health为555 Markdown/0error/73既有link warnings，与当前merge健康检查分记。
- [作者.build guard直接报告](author-build-guard-direct-report.txt)来自root转发作者消息，没有独立raw文件；只保存有来源文字，不补造完整traceback。实际manifest比较.build exit1（tool16c9eb），narrowing-preservation/delivery未生成。[旧aggregate/source边界与当前log只读观察](author-build-guard-source-boundary.json)：旧416/f407a3…与末次两次416/787cf7…不同，out14865/25b696…及node_modules47159/fedada…匹配；当前.build/log为2B []/4f53…，两ns1793082885390322213、早于7361 commit。但无任务开始全快照/旧逐项tuple，不能重建完整差异路径集合或归因actor。E工位不等于merge54fe；整份source变换可独立核实，作者aggregate guard不能报通过。

守卫与读取器错误：

- [新source/旧native身份](current-source-old-native-identities.json)、[合源前](guard-before-merge.json)、[commit前](guard-before-merge-commit.json)、[commit后](guard-after-merge-commit.json)：15500 metadata保持54fe，无新ctime；native256仍5新source/旧native+251未变，Reveal新source/旧147236B native单列，无旧producer credit/无fresh输出；freeze4/cache3精确，8owned PID/start alive0。旧consumed prep2与14e全部174 scratch镜像完整未改。
- [既往14e首postcommit guard误SHA拒绝](prior-postcommit-guard-identity-rejection.json)与[真实raw](prior-postcommit-guard-identity-rejection.tool-output.txt)、[随后正确HEAD守卫](prior-postcommit-corrected-live-guard.json)分开保留。
- [本轮首postmerge guard误literal SHA拒绝](postmerge-guard-identity-rejection.json)与[真实raw](postmerge-guard-identity-rejection.tool-output.txt)保留；改为Git实读HEAD直接传参后通过，不记成一次成功。均为执行器身份参数错误，不是产品失败，无report/源/out写入。
- [root提前要求checkpoint含父首条的reader exit1](root-early-checkpoint-reader-failure.json)与[转发raw](root-early-checkpoint-reader-failure.tool-output.txt)署root来源；授权允许后续proof阶段落盘，后续hunk独立重放exit0，非产品/merge失败。[执行器resolution脚本Unicode bytes literal语法拒绝](resolution-publication-script-parse-failure.json)亦保留，解析前拒绝未执行任何mutation。

[当前10文档修改](proof-documentation-edits.json)与[patch](proof-documentation-edits.patch)只校正当前身份、阶段和导航；不抹首失败、旧I1、作者guard失败或任何审查历史。门禁原件、Included清单、inventory/staged audit随本目录提交；完整cached如含raw marker/空白，仅按本轮精确path另请root裁定，不继承旧6/8/9授权，不清洗原bytes。新prep须等待root独立接受merge与proof后另释，本轮不push。

本次门禁实际结果：merge阶段generator/check/health614/0errors/46旧warnings/fullcached/unstaged均exit0；proof阶段generator/check/unstaged均exit0，health615/0errors/46旧warnings。proof完整cached实际exit2，50诊断/7path（30原始conflict markers、20原始patch空白），[lossless原输出](proof-full-cached-check-result.json)8638B/SHA80a6a889…保留；[root精确七路径裁定](exact-scoped-exclusion-authorization.json)仅供scoped检查，不清洗原件、不借旧授权。[Included清单](included-paths.json)、[出版inventory](publication-inventory.json)、[staged审计](publication-staged-audit.json)列本主题全部路径；inventory只排自身与staged审计避循环，审计只自排，三者都在Included并另核自身。
