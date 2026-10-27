---
title: "Conversation setup A 8033：真实三路接入证明"
type: reference
status: active
phase: M7
updated: 2026-10-27
summary: "e92f604真双亲acf1aa/8033、base d8e/srcfa6f7fe9；1402无争议/外22233与7块双canonical重放精确；仅A静态peer接入，实际B诊断待，46fc旧native与历史保护。"
---

# Conversation setup A 8033：真实三路接入证明

实际merge为`e92f60426b1b7f731b46f793aab0301ff55a4d67`，严格双亲`acf1aa064a0460d900bf37bc46df6a6e9cc4365a`与`8033a3c23ba2b0550e817c9cc4fdebf4d12a4478`，真实base=`d8e6f1c1a546bab726d17b5b7cda0c6ba319b3d3`。tree=`4af8bc589dca3d40f18781aa9ccbbfcdff8f00a5`，src=`fa6f7fe9f339963dd9f4190f44aa17e45f6ad731`。merge实际只16路径，本目录未入merge；随后独立pureproof/docs准备，等待root检查与单独proof commit授权，不push或同步main。

仅Reveal取incoming：81494B / SHA-256 `404034f9dd15c2cf6143c44b624b0dbb398da25b27f16d962a2f01bef982388d` / mode100644/typeblob/`c7710eb939872d378394c7084ccf95bb50f4b4c2`。其余全部src、Pane、Sources四窄implemented、52Bstub与旧新原件均ours。fb708源码peer C0/I1/M0/root采纳的静态arity I1完整保留，未运行checker、不称实际TS2554；8033唯一默认参数窄修经原Astra C0/I0/M0/root独核采纳关闭I1。这里只认A静态peer与真实三路接入，实际B诊断待独立授权/准备/审查，无新checker/业务red/green/after信用，lease accepted/overall active、fullCompile=false。

固定输入与合源：

- [固定ref/tree身份](fixed-input-identities.json)、[完整union矩阵](premerge-path-matrix.json)、[范围外逐项矩阵](outside-union-paths.json)：oursChanged1398、incomingChanged16、union1408，共6 shared docs、1402无争议与外22233逐项mode/type/blob精确。1402 expected tuples SHA-256 `734b2d26a249ec2b3e4af5bc4d16e799d26f29e5de3acd1c667eb3ee3384e723`，与root独立读固定父Git objects的值相同。全部shared及唯一incoming源码的三方raw见[原件inventory](three-way-inputs-inventory.json)；原Git objects固定全部其他路径。
- [实际merge调用](merge-invocation.json)、[stdout](merge.stdout.log)、[stderr](merge.stderr.log)、[原unmerged index](actual-unmerged-index.txt)与actual-merge-worktree原件：真实`merge --no-ff --no-commit` exit1，6docs/7blocks；Reveal自动0冲突。不whole-ours消冲突、不source-copy同步、不引入localGit候选。
- [default canonical](canonical-three-way-results.json)、[独立diff3 canonical](canonical-diff3-results.json)与[逐块resolution](hunk-resolutions.json)保每个两侧choice、base、full block、outside及resolution raw。default与实际两侧/outside逐字同；diff3仅共同LF/其他共同前后缀边界被默认merge移到outside，逐块正规化亦精确。两种canonical分别完整重放到同一resolved文件。board/lease/checkpoint精确为whole ours+LF+incoming相对base独立新增尾，保所有双方尾与原lease§1–§10；索引保四Sources implemented及incoming新入口。status summary/首条只当前静态A/B待，父原文另存。
- [prospective audit](prospective-merge-tree-audit.json)、[committed audit](committed-merge-tree-audit.json)、[实际merge结果](merge-commit-result.json)：真双亲、tree与prospective全同、源码唯一Reveal。逆唯一默认值重构整份fb708；逆完整helper与两call重构整份d8e与ours，均整文件精确。incoming新增9文件精确，其中after8文件只是只读输入，绝非after执行。

方案与历史：

- [完整accepted9a9a诊断方案raw](accepted9a9a-diagnostics-plan.raw)、[到incoming实际diff](accepted9a9a-to-incoming-diagnostics-plan.patch)：incoming原作者在开头与§2/§4/§6更新授权时态并追加§7/§8，不能假称9a9a整文为incoming前缀；原合同§1/§3/§5精确。merge中diagnostic plan完整incoming exact；pureproof阶段只补当前A静态接入身份/导航及A已完成的静态清单，原source§7/§8整字节保留。
- [双方父status首条元数据](parent-status-first-entries.json)、[ours完整含LF](ours-status-first-entry.txt)、[incoming完整含LF](incoming-status-first-entry.txt)、[merge首条](merge-status-first-entry.txt)、[proof当前首条](proof-status-first-entry.txt)。ours1052B/38a3cb13…与incoming1197B/2a1b8f8f…及merge930B/a63af7e4…已完整含LF追加[checkpoint](../sources-accept-post-read-authorization-checkpoint.md#8033-a静态peer真实三路接入与当前边界2026-10-27)，status仍200行。
- [peer/root消息署名](peer-and-root-attribution.json)区别规则16与源码两种I1，保fb708原I1和8033关闭。root独立actual Git核真双亲/tree/src/1402/外22233/零额外路径/source/after8输入与diagnostic plan exact；该消息时尚未核7块重放或最终proofscope，不虚写已接受。[未来B只读输入边界](future-b-read-only-input-boundary.json)不是准备好的工具或执行释放。
- [旧f33首checker五TS2339](../conversation-visible-lease-first-checker-failure-20261027-evidence/INDEX.md)、[d8e单次旧L1 setup失败及原件](../conversation-visible-lease-d8e-old-l1-failure-20261027-evidence/INDEX.md)、原E.build guard实际失败与全部审查历史不改。d8e fixed prerequisiteEvidence旧误叙述与后续纠正并存；general boundary=false只认expected old-red boundary not established，保实际pass/fail/stack/map，只有实际stack/controlflow定位才称未到，否则unknown。旧647和fb708静态674不是未来map行号权威。

保护与执行器读取错误：

- [premerge guard](guard-before-merge.json)、[precommit](guard-before-merge-commit.json)、[postcommit](guard-after-merge-commit.json)：15500 live metadata精确实际46fc，256 source/native pairs、额外旧Reveal147236B/49a3a5…、freeze4/cache3、257scratch/125mirrors、旧f33 174files/28784500B不变，28owned PID/start全quiet，X117 socket/lock absent。只延续既有Reveal ctime `1793092686521596622`，未触任何out/native。
- [当前source/旧native overlay](current-source-old-native-identities.json)保旧46fc snapshot的旧source溯源不回写，另加当前8033/e92f604/topSrc/source mode/blob/hash；全部256pairs不变。旧`nativeMetadataExact54fe`仅历史溯源，当前ctime以46fc为准；native原producer credit不变，没有fresh native或fullCompile信用。
- [diff3边界初比断言拒绝](observed-executor-boundary-reader-rejection.json)、[两次过强前缀读取断言拒绝](observed-executor-preservation-reader-rejections.json)保实际exit1与stderr：分别错误假设diff3和default分块相同、9a9a全文为incoming前缀、ours全文以base为前缀；均为执行器读取假设错误，纠正依据和新精确检查分列，不归产品/driver/merge失败。[更早缩写9a9a歧义reader exit128](prior-read-only-input-reader-error-attribution.json)只有既往消息归因，无新raw不伪造。

[7份当前文档变更说明](proof-documentation-edits.json)、[实际patch](proof-documentation-edits.patch)仅补静态A接入/当前身份与导航、父首条和待B边界；merge阶段generator/check/health618/0errors/46旧warnings、unstaged与完整cached均实际exit0，原件见merge-documentation-gates.json与merge-full-cached-check-result.json。后续pureproof门禁、完整cached原输出、任何本轮精确path裁定、Included/inventory/staged audit随本目录单独列示；不继承任何既往exclusion，不清洗raw，尚不提交本proof。

本次pureproof门禁与出版清单：

- [首轮文档门禁原件](proof-documentation-gates.json)与[最终文档门禁](proof-final-documentation-gates.json)：generator/check/health619 Markdown、0errors/46既有warnings/unstaged均实际exit0。完整cached[首轮原件](proof-full-cached-check-result.json)exit2/149诊断/37paths，原stdout28458B/SHA681afabf…；纳入该stdout真实空白后[第二轮lossless结果](proof-final-full-cached-check-result.json)exit2/176诊断/38paths，原stdout33031B/SHAc21b5397…，其中119原冲突marker、54原patch及其stdout空白、3raw片段EOF空行。首份stdout不改，第二轮只用base64无损编码避免镜像空白无限递归；不是删诊断或声称完整cached通过。
- [精确path裁定](exact-scoped-exclusion-authorization.json)只接受root本轮实际38path清单，绝不继承旧排除；[scoped实际检查](proof-scoped-cached-check-result.json)独立记录，完整失败原件始终保留。该裁定只用于检查，不是proof commit或B准备授权。
- [Included全路径](included-paths.json)、[出版inventory](publication-inventory.json)、[staged audit](publication-staged-audit.json)列本主题全部scope。inventory只排自身和staged audit避免循环，staged audit只自排；三者都在Included并另核自身。proof单独以e92f604为父准备，所有source/current native、旧证据与scope外路径不改。
- [freeze前只读保护](guard-before-proof-freeze.json)再次核当前source overlay、旧46fc/source-native/原件与owned quiet；无新Program/checker/AST/lint/compile/transpile/emit/tests/UI/engine/after/B工具准备或执行。
