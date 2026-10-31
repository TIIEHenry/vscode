---
title: "Conversation emitter 隔离：固定源码审查与修订"
type: progress
status: accepted
phase: M7
updated: 2026-10-27
summary: "v1 C0/I4/M1、v2 C0/I1/M0原件保留；v3残余I2窄源码peer C0/I0/M0/root采纳，24快照与重放精确；仅源码层完成，整包/最终pins/运行未授。"
---

# Conversation emitter 隔离：固定源码审查与修订

本页记录[已接受方案](../../plans/conversation-visible-lease-harness-and-emitter-isolation.md)的 B 工具源码准备和独立审查。固定源码输入是70ee31f9da6e42603a0cd57e1cf0e5d0141999f5，src3dc1205763451e60e70c1a8a84465613990aa526；本次文档提交不改变该源码子树。

原 Astra 正式 v1 C0/I4/M1 未过，I2 的 link/symlink 补充单列、不增 I5。v2 关闭 I1/I3/I4/M1 和 link 补充，仍因私有选项副本可被 encoding getter 改写 flag，得到 C0/I1/M0 未过。v3 唯一代码变化是将该副本 flag 的 writable/configurable 同时设为 false；原 Astra 窄审 C0/I0/M0，root 独核采纳，关闭剩余 I2。历史失败报告与索引不覆盖。

| 固定版本 | 原始索引 bytes / SHA-256 | 结论 |
| --- | --- | --- |
| v1 | 15569 / 7067b2770de2e641fd6f8fa43ad194f3ed50f5c803bf53e558f2f9183c5c3a9e | C0/I4/M1，未过；[原文](review/original-astra-source-v1-final-forwarded.txt)、[link补充](review/original-astra-source-v1-link-addendum-forwarded.txt) |
| v2 | 16116 / 1d165cd2d4af9b38e586815243968e4c4d59c12907868cb16c0bbaf097d43f8a | C0/I1/M0，未过；[原文](review/original-astra-source-v2-final-forwarded.txt) |
| v3 | 15971 / b6dae3d4fbfcd588678402dc120b354c695b4d91da3eb5e506d07df5c5c1f062 | 窄源码审查 C0/I0/M0；[原文](review/original-astra-source-v3-final-forwarded.txt) |

## 修复和验证边界

- 私有 control/audit/唯一 Reveal 写入使用捕获的 openSync、Buffer 完整短写循环、所需 fsync 和 close。普通 scratch 与两项精确 reporter 操作仍调用原 API；不临时撤隔离，不宽放 control/out。
- readFile 三类入口的写性 flag、Node26 disposable 创建与返回 disposer、hardlink 的 cwd/真实类型以及 symlink 的 canonical parent/target 语义均纳入源码保护。仓库与 scratch 跨设备的原相对 hardlink 示例会 EXDEV；同设备旧 consumed 的 file-URL 反例仅为静态推导，没有执行。
- 审计自身失败进入独立 marker/fatal 路径。辅助 report/revoke/save 错误保持整体失败，但不跳过实际 exit 记账、各 scope 清理、独立资格审计和已合格恢复；真正的 owned-quiet/资格校验仍是恢复前提。
- v2 的24项中恰好5项修改、19项不变；v3 恰好2项修改、22项不变。root 与原 reviewer 分别逐字核 whole/index/hash、逐行重放和 unified diff。根目录24项仍等 v1，旧 v1/v2 快照及各索引未改。
- 只做 Node --check 与 Python ast.parse 纯语法操作；原始 stdout/stderr/exit 留在 syntax。早轮 inline AST 标明原来源，另保真实 Python 子进程语法证据。没有导入候选、执行 getter/link 探针、运行 checker/lint/emitter/compiler/tests/UI 或新增诊断 invocation。

## 证据落位和后续顺序

[source-files.json](source-files.json)将完整24份 v3 原始快照映射到 source-v3 下的 .raw 文件，所有 bytes/SHA 保持；后缀只用于明确这些是文本证据。indices 保存三份固定原索引，derivation 保存 v2/v3 的24份逐行及 unified 差异，可从 v3 在内存逆向重建 v2/v1。原索引中的绝对路径保持原样，不能把本目录当成重绑完成的运行包。

[root 采纳记录](root/source-acceptance.json)、[v2 字节/重放核验](root/root-v2-byte-and-replay-audit.json)、[v3 字节/重放核验](root/root-v3-byte-and-replay-audit.json)分别注明来源。review 文件首段是 root 转发标签，其后为原 reviewer 全文；这些消息不是 terminal raw。syntax 是既有纯解析原件，不由读档生成新的执行成绩。[本次文档区间保护](root/documentation-preservation.json)只证明本轮文档操作区间，不补旧连续性，不将全 metadata 核验表述为所有内容独立 hash。

当前 **rootPromotion=false、whole-package closure=NOT_DONE、final pins=NOT_DONE、release=false、activation=false、prepared invocations=0**。临时源码目录是 /tmp/vscode-conversation-visible-lease-work-root-mount-isolated-diagnostics-20261027-prep1；根24尚未提升到 v3，没有 stage/runtime 目录。本页源码审查通过不授整包或运行资格。

后续须另释放整包准备：绑定届时 HEAD 与当前起点、完成工具/manifest/hash/pins closure、独立整包 peer；之后仍须单独 execution release/activation 与一次消费。不能直接运行本证据中的源码，不能把文档提交后的 HEAD 自动写回已固定 v3 索引。旧8033实际 official1、全 .build 保护 FAILED、业务 old-red/new-full 和非作者默认编辑器 after 未达均保持；整体方案/lease accepted、Sources 已签四窄和产品状态不变。
