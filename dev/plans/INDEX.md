---
title: "方案索引"
type: index
status: accepted
phase: N/A
updated: 2026-09-02
summary: "dev/plans 导航：M4/M5 implemented；M6 引擎波 accepted @2026-09-02（M6-A1 ReadyToImplement；A2 待 S3+A1）；stream-timeline S1–S3 可开；sources-changes-diff accepted（F1–F5 待开）；切片 5/E1/T4 随 M6-B/C/D；navigator-engine-segments / sources-review-progress accepted（PRD-022/023；review R1/R2/R4a 可开，其余排 M6-A2 后；m6 §11 增量）；connection-hub-client accepted（Hub 接入，H0/H1 可开）"
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
| [m6-engine-wave.md](m6-engine-wave.md) | `accepted` | R5（2026-09-02 用户委托裁决签收；stream-timeline §9 已并入）：platform UA adapter + 同 token roster；history 经 session-core fold；切片 **A1 platform（可与 S1–S3 并行）→ A2 contrib 接线（含 S4/S5）→ B page-access 5 → C E1 → D T4（= S6）** |
| [conversation-stream-timeline.md](conversation-stream-timeline.md) | `accepted` | M6 时间线专章（规则 16 两轮 Grok CLI 审查后签收）：SessionEventStream L1–L4 显示写源；session-core fold（view→common / Actor→node）；同 token `acquireSessionView`；attribution sidecar；stub 帧源；三类帧增量；**S1–S3 ReadyToImplement**（PRD-003/004/007 增补 + PRD-021 已落）；S4–S6 已并入 m6 M6-A2 / M6-D |
| [sources-changes-diff.md](sources-changes-diff.md) | `accepted` | PRD-009 / ADR-005：Changes 行 → Preview Diff；`ConversationDiffReviewInput` 只读审阅 tab；Panel Diff 视图重宿主；切片 F1–F5（用户免除规则 16） |
| [connection-hub-client.md](connection-hub-client.md) | `accepted` | UniverseAgent Connection Hub 接入（规则 16 Grok CLI 四轮 @2026-09-02）：IDE 为 Client 设备；`platform/universeAgent/node` 增 Hub 解析 + Device Grant 拨号臂（Desktop Main 模块为 donor）；宿主 = electron-main（入 ADR-003）；v1 中继 + DirectAddress、直连 v2；切片 H0→H1/H2→H3→H4a/H4b→H5→H6；H0 可开、H1 可与 M6-A1 并行 |
| [navigator-engine-segments.md](navigator-engine-segments.md) | `accepted` | PRD-022（规则 16 三轮 Grok 审查后签收）：Projects = Engine → work_dir → Session 只读树；Agents Hierarchy 只读 lease `liveAgentTree`（Tree 含首拉归 A2 host）；Activity = lease timeline ∪ overlay tool 项；Team = 同一棵树发现 manager → connection team unary；`IAgentInspectService`；根 `'default'` 例外、非根 chatId ≡ agent_id；v1 只读；**N1–N5 全排 M6-A2 后**；m6 §11 增量；缺口 G-NAV-1 / G-NAV-2 |
| [sources-review-progress.md](sources-review-progress.md) | `accepted` | PRD-023（规则 16 三轮 Grok 审查后签收）：Review = 只导航面 + 窗口内存审阅进度（repoRoot+uri+etag）+ A2 `onDidFileMutation` 归因 chip + settle 后物化「查看更改」导航行 + Review path-set；PRD-005 Review 句已改口；**R1 / R2 / R4a ReadyToImplement**（无引擎，`contrib/sources/**`）；R3 / R4b 随 M6-A2 + S2；m6 §11 增量；缺口 G-REV-1 |
| [chat-compare-split.md](chat-compare-split.md) | `implemented` | PRD-011 并排比对已落；D4 已验 |
| [page-access-schemes.md](page-access-schemes.md) | `implemented` | 切片 1a–4 已落；切片 5 blocked PRD-008 |
| [settings-two-surfaces.md](settings-two-surfaces.md) | `implemented` | C5 + donor H0–H3 已落；E1 blocked PRD-008 |
| [customizations-host-ui.md](customizations-host-ui.md) | `implemented` | H0–H3 donor chrome @ `77d6e7cc` |
| [customizations-engine.md](customizations-engine.md) | `accepted` | Engine 页 catalog 权威与协议缺口；E1 blocked PRD-008 |
| [product-requirements-layer.md](product-requirements-layer.md) | `implemented` | 建立本仓产品需求 SSOT |
| [conversation-trajectory-lens.md](conversation-trajectory-lens.md) | `implemented` | PRD-012 T1–T3 @ `b08ca9de`–`3e2ac61f`；T5a reveal @ `f66c36c9` |
| [conversation-process-fold.md](conversation-process-fold.md) | `implemented` | PRD-013 P1–P3/P3t @ `19f3e7ba`–`42fa941e` |
| [thinkrail-visualize-port.md](thinkrail-visualize-port.md) | `implemented` | PRD-014 T1–T3 @ `5cad7c3b`–`0eb470f2` |
| [conversation-empty-hero.md](conversation-empty-hero.md) | `implemented` | PRD-015 T1–T6 @ `ea0104c0`–`d4064ba0` · [canvas](conversation-empty-hero.canvas.tsx) |
| [conversation-session-windows.md](conversation-session-windows.md) | `implemented` | PRD-016 S1–S6 @ `569ce371` |
