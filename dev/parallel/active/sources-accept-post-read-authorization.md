---
title: "Sources Accept 读后授权：分工与门禁"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "仅A Accept当前授权，ab43源码peer C0/I0/M1、父采纳A7补4成54；生产/accepted方案不变，仅静态，待父核/窄peer与唯一lane，out冻结。"
---

# Sources Accept 读后授权：分工与门禁

本看板仅跟踪[独立方案](../../plans/sources-accept-post-read-authorization.md)的推进，不重复 Sources 长期 SSOT。固定基线 `c7fefd780bd9720f3889e310d4706210189a3fc7` / `src=a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`，不追 main；原 draft 为 `4b0d3d62e65e54e71d3b1748f100fac7ca5f6ce3`，经父核验与 Astra 规则16 C0/I0/M2、两Minor实改后为 accepted 方案阶段；父级独立核验 accepted `5c0916b71070c5f75742fcbd831cd8c31be0bd34` 后已明确授权实施；两生产宿主+两测试候选 ab43 已经父核与 Astra 正式源码 peer C0/I0/M1；父级采纳 A7 覆盖 Minor，本轮只补测试与必要文档，静态计数共 54。该增量仍待父核/窄 peer；作者不运行任何业务测试。

| 角色 | 范围 | 当前门禁 |
| --- | --- | --- |
| D / sources_audit | 仅两宿主 Accept 读后写前当前授权的方案，规则16后才实施 | ab43生产不动，补已发写后active独变accepted/failed双宿主4例共54；原50/旧71调用/旧patch保留，仅AST/lint，不写out/运行业务。 |
| root | scope 与合同选择、draft路径/原文保留核验、安排独立评审 | 已核draft/规则16/accepted及ab43，采纳源码peer唯一A7 Minor并授权补4；待核新增量后再请Astra窄peer；业务仅baseline lane，不借旧波验收。 |
| Astra / architecture_audit | 当前授权取舍、规则16只读方案审查，实施后独立源码 peer | 精确draft规则16 C0/I0/M2后，ab43正式源码peer C0/I0/M1已交；唯一A7覆盖Minor经父核采纳，本轮补4，当前增量待窄peer。 |
| baseline_executor | 唯一源码 checker / emit / 官方 Electron 业务验证 lane | 父级已授权临时5JS绑定c7旧生产3+ab43测试2做两主red/四阳性；本次补例不改变其固定输入。实际结果独立记录，后续green需另获释放。 |

推进顺序：draft/父核/规则16/两Minor实改/独立accepted → 父核5c并授权源码 → ab43两宿主与50新例候选 → 父核及Astra源码peer C0/I0/M1 → 父采纳A7 Minor、D补4成54 → 父核增量/Astra窄peer → 唯一lane旧red新green → 父级验收。不得把作者静态检查代替源码peer或业务门禁。

旧 J/E R3 是已局部签收的独立波，D1387 closed / 两窄方案 implemented 保持；其证据与失败不改。本 scope 不升级 PRD 或宽 Sources Diff 方案，也不重开 open/Move 修复。catalog-ready 后缺 lease 恢复、local Git 迟到结果的 notice 归属留后续独立候选；不同 engine 复用同 session 字符串的读归属仅记边界。

[作者检查点与空间/ff事实来源](../../progress/sources-accept-post-read-authorization-checkpoint.md)保留原 status 首条，B 的 ENOSPC 来自父通报、空间恢复原因不明、D 单次 ff 成功。本 scope 不碰 B 的失败 checkout，不写原 out/freeze/cache 或旧封存证据。
