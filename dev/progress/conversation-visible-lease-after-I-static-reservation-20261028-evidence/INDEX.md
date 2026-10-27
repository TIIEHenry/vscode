---
title: "Conversation lease：I 静态保全签收"
type: reference
status: accepted
phase: N/A
updated: 2026-10-28
summary: "I 单次c6 ff与原物保全获qualified只读签收；两executor失败不追改，build/after/ready仍false。"
---

# I 静态保全签收

[主lease §12.11](../../plans/conversation-visible-lease-recovery.md#1211-i静态保全签收与after旧工具只读路由2026-10-28)只追加后续事实，原规范、§1–12.10全文和历史失败保持；方案仍 accepted。本次出版基于 merge `5f36ed8809300700cfebf9c140d3e938327c024b`、src `3dc1205763451e60e70c1a8a84465613990aa526`，没有产品代码或运行工具适配。

[最终handoff](reservation/final-static-reservation-handoff.json)1445B/SHA-256 `4aec86106f533a654a66eeff3a139c0313e19d9c8f10f8768ed56f06999545c3`、[qualified只读签收](reservation/evidence/qualified-readonly-static-reservation-acceptance.json)24514B/SHA-256 `5f61a95fe47e61b9025f6cb988fe7aa794fbf47a75dedd48730d76fdb358d6e2`及[最终引用索引](reservation/final-ref-index.json)68527B/SHA-256 `dc49d4e8af74bfb3817aa58f8651113a3c5ae3b5be7573085c16dfd35b513277`分别保持原字节。root独核该索引222 regular/623990618B和1 electron link后接受 **static reservation only**，并向外线程明确释放静态窗口；该索引不含自身和随后handoff，不是新运行基线。

## 原物、归档与私有端

I 从 `24a3850cc46c680799309adfc9bc093ae653ff27` 恰一次固定ff到 `c6ded6c918c4f69b0e89037e85b8f49ddc5512b4`，src为上述3dc。完整旧src15032项先归档，127个changing旧Git blobs/5577268B及19 Git前态均保全。旧out14852项与.build122项用同一/home文件系统rename保留于 `vscode-WorkTrees/I-lease-after-preserved-20261028-reservation1/{out,.build}`，不是worktree。14974项完整pathset/每regular字节、mode/dev/inode/mtime及descendant ctime保持；仅两根rename ctime变化明确记账，原symlink文本与同深度resolve保持。

两份大原件继续在预留根 `/sdd/tmp/vscode-conversation-visible-lease-after-I-20261028-reservation1/`，**仓内没有复制471255040B归档**：

| 外部原件（相对预留根） | bytes | SHA-256 |
|---|---:|---|
| `preservation/source-and-git-before/src.tar` | 187238400 | `c78bd4ac9c435452ed870670ff3870dae86e197e48bbd6f23ed1b5d58f30f91b` |
| `preservation/old-out-and-build.archive` | 284016640 | `9d2bd2c68d8996de0a888256fd12eed1c929bf92be3ad2147a4720172bc6e4e3` |

TAR浮点秒时间最多有已观察的358ns(src)/347ns(out-build)舍入；完整原mtimeNs/ctimeNs在[精确src sidecar](reservation/preservation/src-complete-before-inventory.json.raw.gz)和[out/build sidecar](reservation/preservation/out-build-complete-before-inventory.json.raw.gz)中。root首reader误要求TAR纳秒同一而exit1，纠正reader0接受归档bytes/mode/uid/gid/link text与精确sidecar的联合保全；不把reader错误写成候选或归档字节失败，不重写任何原件。

预留根的preservation及已签证据原件已封口，writable仍是后阶段私有输出区，整个RES不作永久不可变声明。I/out与I/.build分别指向预留根的`writable/out`和`writable/build-state`；前者空、尚无新native构建。typings为独立实体拷贝（非hardlink，bytes相等、dev/inode身份独立），electron直接链接固定外部端。原四dependency aliases不动；`build/npm/gyp/node_modules`仍不存在，没有安装。七个实际只读共享目标是merge的`node_modules`、`build/node_modules`、`build/rspack/node_modules`、`build/vite/node_modules`，以及固定外部foundry-local-sdk、主仓build/node_modules/esbuild、外部Electron。它们的79021项pathset/metadata与根身份前后精确，内容SHA沿用已接受old prep2 context/external closure，没有重复5GB内容哈希；C/F/J责任是root转交的会话授权摘要，不是原始消息或ACL强制证据。

## 两次失败与独立只读签收

[原executor](reservation/static-reservation-executor.py.raw)13936B/SHA4872dd…恰调用一次、[actual exit1](reservation/evidence/static-reservation-executor-actual-result.json)：原物rename及私有alias已完成后，clean-status断言把两个授权symlink当作不允许的untracked而停，ff0。没有重跑、改ignore/excludes/index flags、回滚或重建alias。

root亲读原Astra实际停点窄C0/I0/M0并独核后另授[独立delta](reservation/static-reservation-delta-executor-20261027.py.raw)16870B/SHA0c8e1547…；[完整diff](reservation/static-reservation-delta-complete-unified.diff)、[字节修改表](reservation/static-reservation-delta-byte-modification-table.json)及独立authority保持。delta恰一次、[actual exit1](reservation/evidence/delta-executor-actual-result.json)：[唯一ff实际exit0](reservation/wal/041-single-ff-actual-result.json)后，严格raw=blob检查在LICENSE.txt停。两个executor的actual1/raw/WAL仍原字节；不存在补造的050成功记录，qualified只读签收没有把原执行器改写为成功。

[全25239逐项raw/index/Git mode/有效attr清单](reservation/evidence/postfailure-all-target-raw-index-modes-and-attrs.json.raw.gz)和[26项独立资格](reservation/evidence/postfailure-26-specific-eol-qualified-readonly.json)区分实际working bytes与Git blob：25212 raw精确、1 gitlink仅index身份、26明确CRLF。26项working/cached attrs均恰`{text:auto,eol:crlf}`，无filter/encoding/ident；blob无CR、双方无NUL、working无bareCR，双向CRLF↔LF比较及各自SHA精确。没有blanket normalize或文件改写；所有25239 index及Git mode精确。完整status为`?? .build\0?? out\0`，两alias的原WAL dev/inode/fullMode/link text/canonical target精确；称tracked clean加两个精确授权untracked aliases，**不称全worktree clean**。

[独立readonly collector](reservation/postfailure-independent-readonly-collector.py.raw)process exit0但其[原21MB结果](reservation/evidence/postfailure-independent-readonly-complete.json.raw.gz)误把有限exactProtectedEntries当22根完整库存，产生false extras；原source/result/raw保持。其[勘误authority映射](reservation/evidence/closed-root-corrected-authority-mapping.json)、[正确闭集核对](reservation/evidence/closed-root-corrected-readonly-result.json)按旧8 roots descendants-only（根仅pathset）、新增3 root-inclusive、context5后态guard/原context、external5原closure及P443后态库存分别比较，22完整pathset/原manifest所列metadata全精确；这是reader错误而非实际改动，没有新baseline或5GB重hash。

[1092 parent分类](reservation/evidence/postfailure-parent-differences-classified-readonly.json.raw.gz)既有目录仅30项size/mtime/ctime变化，dev/inode/fullMode/uid/gid/type/link不漂，1060新增listed真dir；19 Git中8非允许leaves精确，两reflog各仅一条24a→c6追加、ORIG_HEAD24a/branchc6正确。3238旧原件、consumed P443、v1/v2/v3/frozen review/唯一syntax、font、四aliases及typings/Electron端点均通过针对性只读复核。root与原Astra的两次窄裁定见[归因摘要](review-and-root-attribution.json)，摘要不是terminal raw或原review消息字节。

## after13旧工具只读路由事实

[原输入SSOT的R3 archive13表](../lease-after-inputs-20261027-evidence/INDEX.md#r3-固定工具来源与-loaded-边界)及主lease§3.1/§5/§12.4仍为合同；[root转交direct FINAL概要](after13-root-forwarded-direct-final-summary.txt)只记录既有工具的遗留事实，非新方案、适配源码或执行资格。13不是完整闭包：runtimeRepo/Playwright仍固定merge，launcher仍固定主仓launch.sh，common/gate仅J/E，旧compile10、两个Lens emitters、J完成→E顺序不能借给lease，也不能做全局merge→I替换。

fake engine是旧E单会话/List立即/空history/Create；setup是同会话split；driver inspect会自行acquire/dispose observer lease。这些不满足既有accepted双s1/s2各公开pin/真实own lease、三transport lifetimes、2004 hold/全session frames延迟及hidden/restore，仍待另授适配。旧unary脚本的session/requestIDs、11704/923ms及成功资格不移植。旧main观察只验PID/home/noagents，旧cleanup有vscode-r3-/E假设，旧asset collector对matchesFrozenNativeBytes=false不强制失败；公开ready/active、三目录argv/new-window/startticks、新freeze逐renderer raw/真实I/out路径与未知残留拒删等按现有合同另门，main仍manifest-only，不能强制import造loaded。

[当前边界](current-boundaries.json)：I只有静态保全签收，build/after/ready全部false，merge/source继续held。下一old prep3仍待独立fresh准备/闭包/whole peer/root release；old精确red、完整恢复/root接收后才另授new完整40（39＋meta）/238hooks/loaded/恢复，随后另授非作者真实默认编辑器after。没有新runtime包、Node/compile/UI或after工具准备/运行，没有main/C/F/J集成，不升级plan/PRD/旧波。此前old prep2失败、source-v3签收与8033 whole-build FAILED均保持。

本出版完整staged `git diff --cached --check`实际2：27条diagnostics来自8份冻结原样副本（6个旧Git blob、git-files/1与原delta diff）。原Astra本次窄审C0/I0/M1经root采纳，Minor明确既存原件whitespace可接受；不改raw/attrs，不称full0。封口外锚为`/sdd/tmp/lease-after-I-static-reservation-publication-20261028/staged-diff-check.stdout.raw`，6950B/SHA-256 `8b497935e4a2c8d02f9930dbbe6b9d5a74a4d931f95414e0c6c4683dcd5784d5`；逐条归因为同PUB的`staged-whitespace-raw-evidence-attribution.json`，12901B/SHA-256 `84a9965265826c860224802140f1e9470256bb1de73839b52aab527f863659d4`。作者集合精确定义为source-publication-index的261 Included减copy-map中193raw＋29gzip的222个regular repositoryPath，余39，包含全部publication文件。最终39作者实际cached检查及最终index/tree绑定只外放PUB的final2记录，不复制回仓内形成自引用循环。

[copy-map](copy-map-and-original-identities.json)明确222仓内lossless/gzip副本、1 link-text-only记录与2 bulk外部原件，gzip逐件双SHA/解压回放精确；所有代码为惰性.raw。publication/仅存本出版阶段Python文档门禁/原件保护/范围预算与自有打包器解析期失败归因；两份gate receipt原封套末尾literal backslash-n错误亦原样留.raw、有效companion不改actual0/raw，未复跑任何旧runtime/syntax；可审stage不等于commit授权。
