---
title: "Sources Pane cleanup v2 窄源码修订"
type: progress
status: draft
phase: M7
updated: 2026-10-27
summary: "原Astra固定ae902正式窄peer C0/I0/M0 PASSED/root采纳，v1唯一cleanup I1源码关闭；v1/v2门禁原件及ae902历史manifest不改，J等lease业务门，accepted/runtime pending。"
---

# Sources Pane cleanup v2 窄源码修订

> **当前正式源码 peer（2026-10-27）**：原 Astra 固定 `ae902af2497357602cf55b055ef9a98ae2964d43` 的窄 peer **C0/I0/M0 PASSED** 已获 root 亲读采纳，关闭 v1 唯一 cleanup I1；结合 v1 其余审查无未闭源码项，生产/gates/10矩阵保持。这里只签源码，不等 fixture/red/green/实际释放。[root 转发摘要](source-peer-root-transferred-summary.md)非 terminal raw。J 保候选，lease671…/src3dc…当前业务门后由 root 另定真实接入/最终源码 runtime；plan accepted/runtime pending。下方保留 ae902 候选交付时原文，原 [manifest](included-inventory.json)仍只绑定 **ae902 历史 candidate**，不覆盖本次 docs-only 追加，不追改 hash；原门禁/patch/metadata 原件不改。[本次纯文档保护与门禁](source-peer-docs-closure.json)。

固定 parent/v1 `5cbc26d02ec1e301ca9e4209031c36da748b2ca1` / src `051fda78adf7086fb651892a13f8475c454d5bf5`；J 起步重核 clean。root 亲读并采纳原 Astra 的 v1 正式源码 peer **C0 / I1 / M0** 后另授本最窄修订，无新设计或方案 amendment。[方案](../../plans/sources-pane-cancelled-model-resolution.md)仍 accepted/runtime pending；本页所在固定 candidate 先交 root 独核，再交原 Astra 窄源码 peer。

## 审查来源与唯一 I1

以下是 **root 转发的原 Astra 正式审查消息摘要**，不是 terminal raw，也不伪作逐字原报告：

- 生产首 await guard、真实 resolver/provider、显式 completion race 与 4×2+2 矩阵均认可；Critical 0 / Important 1 / Minor 0。
- 唯一 I1：新 helper cleanup 中 await Promise.all(operations) 遇 replacement successor 的 DI/widget setup 拒绝会提前退出，旧 operation 可能尚未 settle，违反 accepted §3 的全部收束合同。root 已亲读并采纳。
- root 亲读 base/common/async.ts:1913 的 Promises.settled，确认其等待全部 operation 成功或拒绝后再抛首错；授权用来修复已有合同。正常预期 provider reject 的源码判断仍不等于运行信用。

v1 的 [INDEX/门禁/manifest/metadata 原件](../sources-pane-cancelled-model-resolution-source-20261027-evidence/INDEX.md)全部不改。v1 的 C0/I1/M0 结论在本页、方案与行动层保留，不以 v2 作者修订自称正式关闭 I1。

## 精确源码范围与保护

仅测试文件原 async import 加 Promises，且把唯一新 cleanup await Promise.all(operations) 改为 await Promises.settled(operations)。全部操作收束后仍传播首错，既有 finally 的 Pane/provider/listener/DOM 清理顺序不变；生产、gates、10 cases、其他 helper 与旧测试不改。

修后 test **49403B / SHA-256 `534e0a2a03999937bd705350b6394884697e607aff5ac95866844693514050a3`**。[完整 v2→v1 逆向 patch](v2-to-v1-inverse.patch)只逆转这两行，[字节证明](source-preservation.json)核到：

1. 逆转两处恢复整个 v1 test；生产和两 host 的 D 代码不变，gates/cases/finally/其余 helper 不变。
2. 从 v2 删除唯一新增 suite、Promises/CancellationTokenSource specifier 及 load-signal import，恢复整个 df44 且等于 D22d test；旧 factory/Accept 与 D 全部静态矩阵完整保留。
3. Pane 生产、Panel 两整文件、Reveal 整测试逐字等于 v1；v1 9 份证据全部 byte-exact、mode/blob 保留。方案 §1–§4 仍 10665B / SHA `a6db032762368957042ccdf3d015adac0723ef24b552410ef82eea591862bb89`。
4. 原 board 完整 v1 前缀保留；status 仍 200 行。这里只修复测试异常收束，不改变知识层设计或产品入口，无需改产品需求/规格。

## 新一次性门禁与 metadata

[验证原输出](validation-results.json)：**修后 test 恰好一次** createSourceFile-only parse，0 诊断/exit0；恰好一次该 test 的 --no-cache --no-fix ESLint exit0，stdout/stderr 空。NODE_DISABLE_COMPILE_CACHE=1，子环境移除 NODE_COMPILE_CACHE。源码随后冻结；未重复生产 AST/lint、未做 Program/checker/compile/transpile/emit/tests/UI/engine/runtime 工具准备或输出写入。

[前](protected-metadata-before.json.gz)/[后](protected-metadata-after.json.gz)独立保存 v2 本轮 J 本地 lstat 15250 项；[比较](protected-metadata-comparison.json)前后相等，排除 atime、symlink 不跟随。仅覆盖 J 的 out/.build/node_modules link 和五个缺失根，不证明 shared target/外部冻结 binding inputs metadata；本轮没有写那些范围，不借 v1 快照冒充 v2 观察。

[文档门禁](documentation-gates.json)只查结构与 whitespace；方案 status 未翻转，[Included 清单](included-inventory.json)逐项记录其他 Included 的 bytes/SHA/blob，清单自身由固定 commit 交付。v2 测试修订与必要主题 docs/新证据同一 scoped commit；不 amend、不 push、不自行合回。保留 lease 唯一 lane 优先/独立 after、四窄完成与全部旧失败历史。源码 peer、匹配产物、旧 red/新 green/必要完整 Pane 运行仍待 root 另授，作者交 SHA 后停。
