---
title: "方案索引"
type: index
status: accepted
phase: N/A
updated: 2026-09-02
summary: "dev/plans 导航：M6 引擎波 accepted（A1–A2/B/D 代码已落；C E1 部分：Skills list/toggle + Agents/MCP/Tools List）；stream-timeline S1–S6 代码已落（G2/G3 上游缺口仍 open）；connection-hub H0–H5 已落/H6 v2；navigator N1–N4 已落/N5 待冒烟；sources-review R1–R4b 已落/R5 待冒烟；trajectory T4 + T5 搜索虚拟化已落（Overview/DetailRef/compacted emit 仍 Deferred）；PRD-008 仍 accepted"
---

# 方案

方案文档放在本目录。完成后就地保留；任务排期与勾选见 [dev/progress/status.md](../progress/status.md) **Next** 段。

| 方案 | 状态 | 摘要 |
|------|------|------|
| [m0-topology-surgery.md](m0-topology-surgery.md) | `implemented` | M0 壳代码已落；compile/演示/EH deferred |
| [m1-shell-followon.md](m1-shell-followon.md) | `implemented` | M0 之后三切片：四钮 chrome、Conversation 透镜、Sources Files 投影 |
| [m2-product-shell.md](m2-product-shell.md) | `implemented` | 无引擎产品壳剩余面：透镜产品化、Chat/Aux 卫生、文档诚实 |
| [m3-shell-closeout.md](m3-shell-closeout.md) | `implemented` | 可选壳收尾已落：ChatEditor 默认路径藏/转、Navigator stub 会话列表 |
| [m4-validation-wave.md](m4-validation-wave.md) | `implemented` | D3/D4/D5 closed；D3 valid-layers 环境红仍记 D2 脚注 |
| [m5-ui-shell-hardening.md](m5-ui-shell-hardening.md) | `implemented` | 切片 1–5 @ 18b5e8d7；D4/D5 closed；valid-layers environment-blocked（Node v26.7.0） |
| [m6-engine-wave.md](m6-engine-wave.md) | `accepted` | R5 签收：**A1–A2 / B / D 代码已落**；**C E1 部分**（Skills list/toggle + Agents/MCP/Tools **List**；Save/CRUD/tools.json 未落）；PRD-008 仍须冒烟才升 `implemented` |
| [conversation-stream-timeline.md](conversation-stream-timeline.md) | `accepted` | M6 时间线专章：**S1–S6 代码已落** @ `a64caf1c`–`5104678e`；**G2/G3** 上游缺口仍记 §6；PRD-008 未升 `implemented` |
| [sources-changes-diff.md](sources-changes-diff.md) | `accepted` | PRD-009 / ADR-005：Changes 行 → Preview Diff；`ConversationDiffReviewInput` 只读审阅 tab；Panel Diff 视图重宿主；切片 F1–F5（用户免除规则 16） |
| [connection-hub-client.md](connection-hub-client.md) | `accepted` | Hub Client 接入：**H0–H5 已落** @ `058ed9d0`–`83df4497`；**H6** GUA 直连仍 v2；H4a 真 Hub 冒烟 / PRD-024 `implemented` 未签收 |
| [navigator-engine-segments.md](navigator-engine-segments.md) | `accepted` | PRD-022：**N1–N4 已落** @ `87b6ec09`；**N5** 隔离 profile 验收 + 知识层待冒烟；缺口 G-NAV-1 / G-NAV-2 |
| [sources-review-progress.md](sources-review-progress.md) | `accepted` | PRD-023：**R1–R4b 已落** @ `05007b60`–`f1065288`；**R5** 验收 + 知识层待冒烟；缺口 G-REV-1 |
| [chat-compare-split.md](chat-compare-split.md) | `implemented` | PRD-011 并排比对已落；D4 已验 |
| [page-access-schemes.md](page-access-schemes.md) | `implemented` | 切片 1a–4 已落；切片 5 blocked PRD-008 |
| [settings-two-surfaces.md](settings-two-surfaces.md) | `implemented` | C5 + donor H0–H3 已落；E1 blocked PRD-008 |
| [customizations-host-ui.md](customizations-host-ui.md) | `implemented` | H0–H3 donor chrome @ `77d6e7cc` |
| [customizations-engine.md](customizations-engine.md) | `accepted` | Engine catalog：**E1 部分已落**（Skills list/toggle；Agents/MCP/Tools **List** + MCP toggle）；Save/CRUD/tools.json 未落 |
| [product-requirements-layer.md](product-requirements-layer.md) | `implemented` | 建立本仓产品需求 SSOT |
| [conversation-trajectory-lens.md](conversation-trajectory-lens.md) | `implemented` | PRD-012 T1–T3 + **T4** @ `5104678e` + **T5** 搜索/虚拟化 @ `94267eef`；Overview / DetailRef 全文 / `compacted` emit 仍 Deferred |
| [conversation-process-fold.md](conversation-process-fold.md) | `implemented` | PRD-013 P1–P3/P3t @ `19f3e7ba`–`42fa941e` |
| [thinkrail-visualize-port.md](thinkrail-visualize-port.md) | `implemented` | PRD-014 T1–T3 @ `5cad7c3b`–`0eb470f2` |
| [conversation-empty-hero.md](conversation-empty-hero.md) | `implemented` | PRD-015 T1–T6 @ `ea0104c0`–`d4064ba0` · [canvas](conversation-empty-hero.canvas.tsx) |
| [conversation-session-windows.md](conversation-session-windows.md) | `implemented` | PRD-016 S1–S6 @ `569ce371` |
