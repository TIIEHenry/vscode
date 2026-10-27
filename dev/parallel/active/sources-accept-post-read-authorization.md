---
title: "Sources Accept 读后授权：分工与门禁"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "仅A Accept读后写前当前授权，原draft经Astra规则16 C0/I0/M2、两Minor实改后accepted；源码实施待父授权，baseline唯一验证、未运行。"
---

# Sources Accept 读后授权：分工与门禁

本看板仅跟踪[独立方案](../../plans/sources-accept-post-read-authorization.md)的推进，不重复 Sources 长期 SSOT。固定基线 `c7fefd780bd9720f3889e310d4706210189a3fc7` / `src=a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`，不追 main；原 draft 为 `4b0d3d62e65e54e71d3b1748f100fac7ca5f6ce3`，经父核验与 Astra 规则16 C0/I0/M2、两Minor实改后为 accepted 方案阶段；源码实施仍待父级下一步授权，未实施或运行。

| 角色 | 范围 | 当前门禁 |
| --- | --- | --- |
| D / sources_audit | 仅两宿主 Accept 读后写前当前授权的方案，规则16后才实施 | 交独立 accepted 纯文档 SHA；input独立销毁与两类read失败分控已入稿；仍不改源码/测试/out或运行。 |
| root | scope 与合同选择、draft路径/原文保留核验、安排独立评审 | 已核8路径draft及C0/I0/M2，授权实改两Minor/独立accepted；下一次源码授权待，不以旧波签收代本scope验证。 |
| Astra / architecture_audit | 当前授权取舍、规则16只读方案审查，实施后独立源码 peer | 精确draft规则16 C0/I0/M2已交；current授权与Panel代次边界通过，两Minor本轮实改；正式源码peer未发生。 |
| baseline_executor | 唯一源码 checker / emit / 官方 Electron 业务验证 lane | 尚未接本 scope 运行；accepted方案与不可变源码后再按授权取得旧red/新green。 |

推进顺序：draft独立commit/父核验/规则16已完成 → 两Minor实改与独立accepted方案commit → 父核验并另发源码授权 → D实施与新测试 → 独立源码peer / 唯一lane旧red新green → 父级验收。不得把方案通过代替后续源码/业务门禁。

旧 J/E R3 是已局部签收的独立波，D1387 closed / 两窄方案 implemented 保持；其证据与失败不改。本 scope 不升级 PRD 或宽 Sources Diff 方案，也不重开 open/Move 修复。catalog-ready 后缺 lease 恢复、local Git 迟到结果的 notice 归属留后续独立候选；不同 engine 复用同 session 字符串的读归属仅记边界。

[作者检查点与空间/ff事实来源](../../progress/sources-accept-post-read-authorization-checkpoint.md)保留原 status 首条，B 的 ENOSPC 来自父通报、空间恢复原因不明、D 单次 ff 成功。本 scope 不碰 B 的失败 checkout，不写原 out/freeze/cache 或旧封存证据。
