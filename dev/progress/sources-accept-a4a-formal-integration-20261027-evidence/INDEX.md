---
title: "Sources Accept a4a 正式合源证据"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "33b9以真实双亲接入精确a4a；226路径与4冲突块重建、run3冻结native分界可复核，尚无checker/新compile/新green。"
---

# Sources Accept a4a 正式合源证据

真实 merge commit **`33b9b820701d7cfe20fe36fde56ba1ecfebbada4`** 的双亲依次为 `0165822eff368314d8fd0017e1137b56113e5bb5`、`a4a70322795c509e8e9b8274cf295a1b65db663a`；共同祖先 `5c0916b71070c5f75742fcbd831cd8c31be0bd34`。merge tree=`87e2ee5450e50e5edf34772bcfccafe62ce25109`，`src`=`d78a48e5feee57fcaf5811c8425859d0a2400af0`。本目录作为后续独立 proof/docs commit 接入，**不表示新源码已经 checker、编译、emit 或运行变绿**。

## 源码与三路保留

- [集成总证明](integration-proof.json)、[提交身份和实际命令](merge-commit-result.json)、[实际 merge stdout](merge.stdout.log) / [stderr](merge.stderr.log) 保留唯一一次 `merge --no-ff --no-commit a4a` 的冲突退出1及随后真实双亲提交；没有重试实际 merge。
- [226路径三方输入矩阵](premerge-path-matrix.json) 与 [提交树逐项证明](committed-merge-tree-audit.json)：223无争议项取预期侧的精确mode/type/blob，union外22236项不变；相对016仅13路径，其中4源码精确等a4a，controller不变。
- [冲突块解法](hunk-resolutions.json) 记录3文档/4块的ours/base/incoming/resolution原文、SHA与选择。每一块外fragment保持原bytes及顺序；双方进度INDEX入口完整保留。输入、canonical diff3与实际冲突文件均原bytes镜像，以`.md.raw`保存避免把历史原件当新活文档。
- [双亲原status首条](parent-status-first-entries.json) 含完整末尾换行与SHA，亦在[检查点](../sources-accept-post-read-authorization-checkpoint.md#a4a-formal-source-integration)保留；当前status为200行。Accept原plan/dispatch、incoming Panel生命周期与共同fixture两份合同均精确保留，未升级plan/PRD/旧波状态。
- [预览参数失败摘要](preparation-failure-summary.json)保留`merge-file --label`不受支持exit129，之后改用`-L`；[首次只读树审计失败摘要](prospective-audit-first-failure-summary.json)保留混合inventory无`label`字段导致KeyError及修正。两者均明确是观测结果摘要，不伪造raw stderr；不抹成初次通过。

## 新source与冻结旧native

[合源前guard](guard-before-merge.json)、[prospective source分界guard](guard-prospective-tree.json)、[提交后guard](guard-after-merge-commit.json)共同指向run3实际恢复基准[guard-after-restore](../sources-accept-qualified-old-red-run3-20261027-evidence/guard-after-restore.json)，其SHA-256为`90f8cd36c22c0503061c8c6df9c1fe6654053043fad1b7857e80a62875955aa1`。12554文件/2946目录完整metadata、256 native bytes/mode、freeze4与cache3逐项不变。252 source/native pair保持原样；**4新source与旧native明确分记，没有新source producer credit**。旧审计`snapshot()`仍要求旧source，未改写该历史守卫，也未拿它误断新source。

[run1](../sources-accept-post-read-authorization-old-red-evidence/INDEX.md)、[原default-false探针](../sources-accept-default-false-probe-20261027-evidence/INDEX.md)、[run2](../sources-accept-qualified-old-red-run2-20261027-evidence/INDEX.md)、[run3](../sources-accept-qualified-old-red-run3-20261027-evidence/INDEX.md)与原inventory/driver完整保留。A1双业务旧红、run3独立input.dispose A4旧红成立；四正控仅跨run累计body到达，Panel A3的VM/meta hooks仍失败，不能称干净4/4。新完整54与18生命周期suite均未运行，overall goal仍active。

## 只读复核入口

在merge工位运行，所有命令以`rtk`开头。以下脚本只做Git/文件身份与metadata核对，不执行语义checker或产物写入：

```bash
rtk proxy python3 dev/progress/sources-accept-a4a-formal-integration-20261027-evidence/verify-integration-tree.py 33b9b820701d7cfe20fe36fde56ba1ecfebbada4
rtk proxy python3 dev/progress/sources-accept-a4a-formal-integration-20261027-evidence/verify-frozen-native.py HEAD
```

[树重建脚本](verify-integration-tree.py)从三方输入和逐块解法重建merge tree；默认不要求当前proof文档等于原merge文档，`--worktree-docs`仅适用于原merge文档尚未追加proof的状态。[native分界脚本](verify-frozen-native.py)只复用旧审计`outmeta`/`meta`函数，以run3实际恢复metadata与a4a四source身份分别核验。[精确镜像inventory](artifact-inventory.json)记录scratch路径、仓内路径、bytes、SHA；不覆盖旧证据。

merge提交前生成状态、生成检查、docs health、cached/unstaged diff-check均exit0；[原始门禁日志与命令身份](merge-documentation-validation.json)对应606 Markdown/0errors/46条与run3完全相同的既有warnings。proof提交的门禁另记于publication-validation.json。[root独立核验摘要](parent-independent-review-summary.json)另存且明确不冒充raw日志。proof的全cached检查实际exit2，只有6份历史actual/canonical `.md.raw`的28个冲突marker；经root明确仅授权这6个精确路径后，[scoped检查](proof-scoped-cached-diff-check-result.json)实际exit0，其余全部Included覆盖，未改原件，也不声称全cached通过。root独立接收后才能另释checker/5文件emit/完整两宿主suite；本次未启动窗口或引擎，未push。
