---
title: "Sources 旧stale stub固定6d正式合源证据"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "3029真实双亲合入6d唯一52B stub行；175union/7块重建与8b5f旧native守卫精确，8438完整旧1败原件保持，尚无新验证。"
---

# Sources 旧stale stub固定6d正式合源证据

真实merge **`3029d800e3941130dd62a3a8e85deb33c3fff848`** 的双亲依次为 **`8438ef3f197367a493ab48232012c5a37c64f797`**、**`6d848eacc578dea0c5c6f39721b00047f9c12469`**，共同祖先 **`eefce63e1541625baa39a4abd1608fc3cdbb8c5b`**。tree=`b169bcc0ad8e3f364d9cd24c1021c54afe1e0e92`，src=`4243970658ddd668d1f89e0a97d7f41ba94d3300`。source merge与本目录proof各自提交；本次没有Program/checker/lint/compile/transpile/emit/test/UI/engine，也没有准备或运行新执行release。

[8438一次实测/完整失败/恢复原件](../sources-accept-a4a-new-validation-20261027-evidence/INDEX.md)全部保持：新54 Accept+18生命周期实际逐名通过、完整Conversation3/3、完整Panel142/141过1旧stale首断言败，后三原断言未达。唯一stub行静态source peer C0/I0/M0已由root采纳，**尚未新运行，不能称旧case已通过**。四窄plan仍accepted，PRD/宽Sources/D1387旧签收/旧波不升。

## 真实三路与精确解法

- [原始merge命令与退出](merge-invocation.json)、[stdout](merge.stdout.log)/[stderr](merge.stderr.log)、[双亲提交结果](merge-commit-result.json)保留仅一次`merge --no-ff --no-commit 6d`的真实冲突exit1、随后commit exit0；没有重试merge或copy源码同步。
- [175路径三方矩阵](premerge-path-matrix.json)与[正式Git树审计](committed-merge-tree-audit.json)：171无争议项取预期侧完整mode/type/blob；union外22522项全同。相对8438恰9路径，唯一src路径为Panel.test。
- 四份共同文档有七块冲突：[canonical命令](canonical-merge-file-results.json)、[逐块原文/解法/片段SHA](hunk-resolutions.json)、`three-way-inputs/`、`actual-conflicted-worktree/`、`canonical-three-way/`、`resolved-worktree/`保留原bytes。解法严格由冲突外fragment与记录resolution重建；所有外fragment原bytes/顺序不变。两父checkpoint独立追加块完整并存，当前status仍200行。
- [双亲status首条含原末尾LF](parent-status-first-entries.json)逐字保留于[当前检查点](../sources-accept-post-read-authorization-checkpoint.md#stale-render-6d-formal-integration)。三方输入/actual/canonical/resolved Markdown镜像均为`.md.raw`，作为历史原件保留，不能把marker当活文档冲突。
- [52B插入证明](single-test-insertion-proof.json)：旧stale case本地fakeWidget仅在byte offset22220新增`createViewModel: () => toDisposable(() => { }),`整行；删该行即逐字还原原TS。原标题/header/四断言/timing/gate/show/ref/render wrapper/finally、其他cases/helpers和54+18均原样。三production、Pane.test及其余src全部不变。新Panel.test blob=`1eb53d2f64343c465b02bebb99724b9a76a35561`，SHA=`414409d77aa0079fbe0fcc61eabb4be61a075bfc85ec392e83530e5aedafaaa6`。
- 新[amendment](../../plans/sources-panel-stale-render-stub-amendment.md)与现行lifecycle全文精确incoming；lifecycle相对8438仅633B单点例外，SHA=`4f3b7d48a8586f84f5b4c1eb3369df6ac27229f72c99aac82531e48673910337`。另两plan/dispatch JSON与全部旧证据/inventories不变。

root对8438与精确6d/Astra的接收见[归属摘要](parent-independent-acceptance-summary.json)；root随后独立重算父Git对象→三方原件→canonical diff3→七块解法并接收正式3029，见[正式合源独核摘要](root-formal-merge-acceptance-summary.json)。这些是父通报归属，不冒充独立raw日志。root的cache target/metadata与插入offset读取纠正也只归于读取器，非runner或native变化。proof复制辅助脚本曾因把parallel INDEX的board链接误作amendment链接而assert0，[实际观测摘要](publication-observed-helper-failure-summary.json)保留；随后按真实row结构更新，从3029 Git原文补齐六docs beforeText审计，未影响源码或原件。

## 新source与8b5f实际恢复旧native

[合源前guard](guard-before-source-merge.json)、[prospective source分界](guard-prospective-source-tree.json)、[正式提交后guard](guard-after-source-merge-commit.json)独立使用stdlib metadata/hash与精确Git身份，无runpy或旧snapshot源码断言。提交后guard SHA **`0a99707f0153413b352f91d2ae7d6d0295f709db3bf1d2faf27998dd3c4a5006`**。三次全部15500 out metadata精确等[本次实际恢复基准](../sources-accept-a4a-new-validation-20261027-evidence/prep2/guard-after-restore.json) SHA **`8b5f45b3207be166685bc342025d899c3d237c955847681a41c4f1b9e48c4a04`**，256旧native bytes/mode、freeze4/cache3均精确；本次没有任何新的ctime差。

只有Panel.test currentSourceBlob/SHA更新到6d，`authorizedA4aTo6dTestSourceChange`逐项明记；row classification沿用旧基线的分组来源，当前身份以currentSourceBlob/SHA及该单独映射为准。四个变更source仍配旧native、252其余pair不变，没有新source producer credit，`fullCompileOfFinalSourceTree=false`。原run3 `90f8cd…`元数据/source断言不再无例外适用，原guard不重写。

## 只读复核与后续门

在merge工位，以下只复核Git/文件身份与metadata，输出JSON写到scratch，不执行业务验证：

```bash
rtk proxy python3 dev/progress/sources-stale-render-6d-formal-integration-20261027-evidence/verify-integration-tree.py 3029d800e3941130dd62a3a8e85deb33c3fff848 /tmp/sources-6d-tree-audit.json
rtk proxy python3 dev/progress/sources-stale-render-6d-formal-integration-20261027-evidence/verify-current-native.py HEAD /tmp/sources-6d-native-guard.json
```

树审计默认复核原3029文档；`--worktree-docs`只适用于尚未追加proof文档的原merge状态。native守卫只适用于当前未新验证的source/8b5f out阶段，后续实际恢复基准变化必须另绑定。

root采纳原Astra条件性最小充分验收边界：以后另获授权的固定5目标checker/noEmit、no-cache/no-fix lint、5JS dry=emit、完整官方Pane3/Panel142（旧stale四原assert均完整通过）、72逐名/hooks/meta/pending/missing/owned/finally恢复全部合格且root核原件后，本source/真实组件窄scope不额外要求default-editor after或未改controller suite；不称实端Git索引/UI after已验。当前未执行，不提前翻转四窄plan状态或准备release。

## 原件与门禁

[镜像inventory](artifact-inventory.json)记录64份scratch→repo原件、14842267B，逐份bytes/SHA/Git blob；提交前另外核对实际staged Git。[proof文档变更](proof-documentation-edits.json)保留六份3029原文及status首条原LF/hash，source merge的冲突外内容不因后续proof覆盖而失去可重建性。

source merge提交前generator/check/docs health/full cached/unstaged diff均实际exit0，没有排除；health609 Markdown/0error/46条逐项等8438既有warnings。独立proof generator/check/unstaged也实际exit0，health610 Markdown/0error/46条逐项等旧warnings。proof完整cached实际exit2，恰49个历史冲突marker，见[原始stdout](proof-full-cached-diff-check.stdout.log)8612B/SHA `f6670b7ecb44a2ef70078745377c2e36bda372920452b20f91c996d8e7ddaadc`与[实际结果](proof-full-cached-diff-check-result.json)。root独读原件后仅授[8精确raw路径排除](proof-exact-scoped-exclusion-authorization.json)，[其余Included真实scoped检查](proof-scoped-cached-diff-check-result.json)实际exit0、空stdout/stderr；原件不清洗，不继承旧proof七路径例外，也不称完整cached通过。最终摘要见[publication validation](publication-validation.json)。无push/main ff/reset/restore/stash/clean或额外运行。
