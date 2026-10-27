---
title: "Sources Accept 读后授权：分工与门禁"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "仅A Accept读后写前当前授权，D写draft、Astra独立审查、baseline唯一验证；旧J/E局部签收保持，未实施/运行。"
---

# Sources Accept 读后授权：分工与门禁

本看板仅跟踪[独立方案](../../plans/sources-accept-post-read-authorization.md)的推进，不重复 Sources 长期 SSOT。固定基线 `c7fefd780bd9720f3889e310d4706210189a3fc7` / `src=a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`，不追 main；当前是 draft 方案阶段，未实施或运行。

| 角色 | 范围 | 当前门禁 |
| --- | --- | --- |
| D / sources_audit | 仅两宿主 Accept 读后写前当前授权的方案，规则16后才实施 | 交纯文档 draft 不可变 SHA；不改源码/测试/out，不编译或开窗口。 |
| root | scope 与合同选择、draft路径/原文保留核验、安排独立评审 | 先核 draft，再交 Astra；不以旧波签收代本 scope 验证。 |
| Astra / architecture_audit | 当前授权取舍、规则16只读方案审查，实施后独立源码 peer | s1→s2→s1按写前当前门；不引入session/engine epoch。正式规则16待父核后进行。 |
| baseline_executor | 唯一源码 checker / emit / 官方 Electron 业务验证 lane | 尚未接本 scope 运行；accepted方案与不可变源码后再按授权取得旧red/新green。 |

推进顺序：draft 独立 commit → 父核验 → Astra 规则 16 → D 实改 Critical / Important → 独立 accepted 方案 commit → D 实施与新测试 → 独立源码 peer / 唯一 lane 的旧生产 red 与新 green → 父级验收。不得把其中一步代替后续步骤。

旧 J/E R3 是已局部签收的独立波，D1387 closed / 两窄方案 implemented 保持；其证据与失败不改。本 scope 不升级 PRD 或宽 Sources Diff 方案，也不重开 open/Move 修复。catalog-ready 后缺 lease 恢复、local Git 迟到结果的 notice 归属留后续独立候选；不同 engine 复用同 session 字符串的读归属仅记边界。

[作者检查点与空间/ff事实来源](../../progress/sources-accept-post-read-authorization-checkpoint.md)保留原 status 首条，B 的 ENOSPC 来自父通报、空间恢复原因不明、D 单次 ff 成功。本 scope 不碰 B 的失败 checkout，不写原 out/freeze/cache 或旧封存证据。
