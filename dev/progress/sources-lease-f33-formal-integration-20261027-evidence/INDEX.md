---
title: "Sources 已验基线与固定f33可见叶lease源码正式合源"
type: progress
status: completed
phase: M7
updated: 2026-10-27
summary: "5336双亲a4eb/f33、basea4a，793union/5块重建与实际src90d609精确；Sources四窄implemented保持、lease accepted/全部运行待，54fe旧native不动。"
---

# Sources 已验基线与固定f33可见叶lease源码正式合源

真实merge **`5336c7f82565eb15de5aad3a125ab66cabdc1807`** 的双亲依次是 **`a4eb1dc3e94b9240e6124ccd37e219801fc1aeb9`**、**`f33d16fbc5841119f5baa7ff2788060d39b8bb4f`**，共同祖先 **`a4a70322795c509e8e9b8274cf295a1b65db663a`**。tree **`443af4269bb5893999eb1bc350dee750b4a60604`**，实际src **`90d6092dbbca80114db7f55a75e137bb1d7bef76`**。root的Merkle预测只作输入记录，实际Git树另核匹配；不是用预判替换源码树。root已独立接受此merge，[归属摘要](root-merge-acceptance-summary.json)与原始命令/对象审计分列。本目录是之后独立proof/docs提交，不是第二次merge。

[Sources固定6d一次green与四窄签收](../sources-stale-render-6d-new-validation-20261027-evidence/INDEX.md)及全部旧失败/新实测原件保持：四Sources计划完整ours implemented，旧case的52B stub及原设计不变。lease来自固定f33（其源码为783），原Astra窄source peer C0/I0/M0/root采纳关闭L4 I1；[lease计划](../../plans/conversation-visible-lease-recovery.md)仍accepted，13为静态预期，旧a4a L1 red/新矩阵/原Reveal/非作者after全部runtimeObserved=false。此次无Program/AST/checker/lint/compile/transpile/emit/test/UI/engine，没有新工具准备或执行release；不修B仅objects工位，不跟主目录WIP。

## 固定三路与逐块重建

- [固定输入](fixed-input-identities.json)、[唯一真实merge命令](merge-invocation.json)和[stdout](merge.stdout.log)/[stderr](merge.stderr.log)保留真实exit1，随后[commit结果](merge-commit-result.json)实际exit0。merge前clean；未重试merge、未copy源码代替三路。
- [全路径三方矩阵](premerge-path-matrix.json)：union793，ours-only782、incoming-only6、both-divergent5；788无争议项完整mode/type/blob精确取应取侧，union外22232全部不变。[prospective审计](prospective-merge-tree-audit.json)与[正式树审计](committed-merge-tree-audit.json)固定实际树。相对base仅三src：两lease源码取incoming，Panel.test仅既有ours52B例外；其他src不变。
- 五共享文档中四个实际冲突文件/五块：parallel INDEX1、plans INDEX1、checkpoint1、status2。[canonical命令/退出/hash](canonical-three-way-results.json)、[逐块三侧/解法/外fragment](hunk-resolutions.json)、three-way-inputs/、actual-merge-worktree/、canonical-three-way/、resolved-merge-worktree/全部原bytes保存。canonical外fragment逐字保持，按块resolution重放精确等记录resolved及正式commit blob。
- plans INDEX保incoming lease accepted行与ours四Sources implemented行；parallel分列已完成Sources与待验证lease。checkpoint resolution以ours完整新增tail加incoming完整新增tail开头，再追加本次原首条记录，双方历史不丢；status仅当前summary/首条合并覆盖、仍200行。
- **board自动合并不计冲突解法**：14996B canonical/actual/resolved完全相同，0块；后续proof/docs才收窄Sources历史覆盖范围并明确lease当前pending，[文档修改审计](proof-documentation-edits.json)单列，不能称其为conflict resolution。旧作者阶段原文保留，Sources“下方全部历史”只限Sources，不覆盖lease当前待验证。
- [双方status首条含LF](parent-status-first-entries.json)分别ours986B/SHA `17c10…`与incoming821B/SHA `7cdd…`，完整SHA与原bytes见该JSON和ours/incoming-status-first-entry.txt，并已嵌[检查点](../sources-accept-post-read-authorization-checkpoint.md#sources-lease-f33-formal-integration)。proof/docs覆盖前5336首条另保[789B原件](merge-status-first-entry.txt)/[SHA](merge-status-first-entry.json)，不回写父历史。

root独核了双亲/base/src、全部mode/type/blob、五canonical与15三方raw、5块外fragment重放、两父首条LF/hash及Sources四计划/lease计划原身份；这里只记通报归属，不造另一份reviewer raw。当前89d/docs-only/d78a导航已更新到5336正式合源/lease待验证，旧设计/规则16/5fd I1报告及783修订/窄peer历史原文保留；lease原§1到原EOF逐字等incoming，状态仍accepted。Sources四plan全字节继续等ours，dispatch JSON、旧新证据、PRD/宽Sources/旧J-E波与D1387旧签收不动，overall goal active。

## 当前source与54fe旧native身份

[merge前guard](guard-before-merge.json)和[正式merge后guard](guard-after-merge-commit.json)只用stdlib hashes/lstat及Git对象，不加载旧helper或runpy。后guard4213592B/SHA **`5795e91a5c9be7d333501bf384563747028b38555abb06dcca22039eff44d453`**。当前15500 metadata仍精确等[54fe实际恢复基准](../sources-stale-render-6d-new-validation-20261027-evidence/prep2/guard-after-restore.json) SHA **`54fe37b2f942aa1afc5587d630199809ff4dc8e54bad610f577ffa6db8f60f1e`**，没有新ctime差；旧native256 bytes/modes、freeze4/cache3精确，旧54fe/8b5f/90f8原件不回写。

原256绑定按实际src90d609重绑为 **5 current-source/old-native（Sources4+Pane1）+251未变**；Pane的compile10旧source blob `8678204094b429fd4280dd528a70e83b9fcf5289`/native SHA `74b65707aa69404258e9d3b759f93b5808b21ec4a311e1af953132d5c7729629`连续链保留。新Pane blob为incoming `98ba56dacc166c24d263112940c7aee0a0363357`，不授新source producer credit。

Reveal JS虽在15500 metadata内但不属于原256，另列original-output身份：`out/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.js` 147236B/SHA `49a3a5a11180b3c07bad410cf7c42f701ddd272ac2de4ff857aee3733073be5d`；当前source为incoming blob `93085a7b0b26df11230235f6ac6377052822fb6a`/SHA `ee287ba144f4d7412af3fe8c52f7fb0ae6183c5d443d17f3e605d7838000118c`。此处只读身份，没有准备工具或输出封存；以后若另获一次验证授权，必须单列封存/恢复该原JS，不借原256或旧producer获得fresh credit。fullCompileOfFinalSourceTree=false。

## 原件与文档门禁

[镜像inventory](artifact-inventory.json)保存64份scratch原件/12732126B，逐份bytes/SHA/Git blob；三方/actual/canonical/resolved Markdown镜像用.md.raw，历史marker不当活文档冲突清洗。[proof文档修改](proof-documentation-edits.json)记10个导航/current范围更新，板的自动merge原稿、所有设计与历史保持。

真实merge提交前generator/--check/docs health/fullcached/unstaged全部实际exit0、无排除；health612 Markdown/0error/46原有warnings，见[原始门禁记录](merge-documentation-gates.json)。独立proof的generator/check/health/unstaged实际exit0，health613 Markdown/0error/46条逐项同旧warnings；[完整cached实际exit2](proof-full-cached-diff-check-result.json)，[原stdout](proof-full-cached-diff-check.stdout.log)5339B/SHA `2a77a67bfd14ca963bff20a97385a5f98eaf6a749a3ad5de6c25570bb71323a6`，[35诊断](proof-full-cached-diagnostic-classification.json)仅来自8份actual/canonical原始镜像的历史marker，没有空白诊断。root独读后仅授[当前精确8路径](exact-scoped-exclusion-authorization.json)，[其余Included真实scoped检查](scoped-cached-diff-check-result.json)实际exit0/空流；不继承此前Sources9path例外，也不称完整cached通过。Included/staged审计另记本目录。无push或新lease运行准备。
