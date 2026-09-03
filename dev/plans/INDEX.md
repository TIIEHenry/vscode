---
title: "方案索引"
type: index
status: accepted
phase: N/A
updated: 2026-09-03
summary: "dev/plans 导航：M7 UI 代码完成线已尽（P/A/B/C）；六份方案仍 accepted（缺产品验证）；W1/I6/V 旁路"
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
| [m6-engine-wave.md](m6-engine-wave.md) | `accepted` | A1–A2/B/D 已落；C 已落 Skills/Agents/MCP/Tools 读写主体与正文编辑，九节 UI 余量转 M7；PRD-008 仍须冒烟才升 `implemented` |
| [m7-ui-completion-wave.md](m7-ui-completion-wave.md) | `accepted` | UI 主线代码已落（P0–P2b / E2 / Q / CS / I2–I5 / K/T/L1）；W1 冒烟与 I6 发行标识未完；V 槽测试债非阻塞；不升 `implemented` |
| [engine-preferences-completion.md](engine-preferences-completion.md) | `accepted` | E2-1–E2-7 **代码已落**：九节六态、Web 按 phase/capability 省略桌面控件、窄宽度；Provider/Rules/Hooks 仍 unsupported；产品验证未做 |
| [client-settings-completion.md](client-settings-completion.md) | `accepted` | CS-1–CS-6 **代码已落**（9 键 + 迁移 + 七组无 emptyCopy）；PRD-026 §6 产品验证未做 |
| [conversation-ui-closeout.md](conversation-ui-closeout.md) | `accepted` | Q1–Q6 **代码已落**：Overview、DetailRef 六态、compacted、live fold、四 kind 停止洗白、键盘 ARIA、窄宽度；产品验证未做 |
| [product-identity.md](product-identity.md) | `accepted` | I2–I5 / I3a / I3b **代码已落**；I6 Darwin/Appx 发行标识等发布方；D18 安装包未验 |
| [accessibility-responsive-ui.md](accessibility-responsive-ui.md) | `accepted` | K1/K2/T1/L1 与 B/A 合同切片 **代码已落**；W1 Web 冒烟未跑；D19 残留 |
| [conversation-stream-timeline.md](conversation-stream-timeline.md) | `accepted` | M6 时间线专章：**S1–S6 代码已落** @ `a64caf1c`–`5104678e`；**G2/G3** 上游缺口仍记 §6；PRD-008 未升 `implemented` |
| [sources-changes-diff.md](sources-changes-diff.md) | `accepted` | PRD-009 / ADR-005：Changes 行 → Preview Diff；`ConversationDiffReviewInput` 只读审阅 tab；Panel Diff 视图重宿主；切片 F1–F5（用户免除规则 16） |
| [connection-hub-client.md](connection-hub-client.md) | `accepted` | Hub Client 接入：**H0–H5 已落** @ `058ed9d0`–`83df4497`；**H6** GUA 直连仍 v2；H4a 真 Hub 冒烟 / PRD-024 `implemented` 未签收 |
| [navigator-engine-segments.md](navigator-engine-segments.md) | `accepted` | PRD-022：**N1–N4 已落** @ `87b6ec09`；**N5** 隔离 profile 验收 + 知识层待冒烟；缺口 G-NAV-1 / G-NAV-2 |
| [sources-review-progress.md](sources-review-progress.md) | `accepted` | PRD-023：**R1–R4b 已落** @ `05007b60`–`f1065288`；**R5** 验收 + 知识层待冒烟；缺口 G-REV-1 |
| [chat-compare-split.md](chat-compare-split.md) | `implemented` | PRD-011 并排比对已落；D4 已验 |
| [page-access-schemes.md](page-access-schemes.md) | `implemented` | 切片 1a–5 已落；M7 不重开混合宿主、同 token 与 Navigator 拓扑 |
| [settings-two-surfaces.md](settings-two-surfaces.md) | `implemented` | 两主面边界 + C5/H0–H3 已落；Engine E2 / Client CS 代码完成线见 M7 方案（仍 accepted） |
| [customizations-host-ui.md](customizations-host-ui.md) | `implemented` | H0–H3 donor chrome @ `77d6e7cc` |
| [customizations-engine.md](customizations-engine.md) | `accepted` | E1 已落 Skills/Agents/MCP/Tools 读写主体；九节宿主由 M7 E2-1–E2-7 承接（代码已落） |
| [product-requirements-layer.md](product-requirements-layer.md) | `implemented` | 建立本仓产品需求 SSOT |
| [conversation-trajectory-lens.md](conversation-trajectory-lens.md) | `implemented` | PRD-012 T1–T3 + **T4** @ `5104678e` + **T5** 搜索/虚拟化 @ `94267eef`；Overview / DetailRef / compacted 由 M7 Q1–Q3 承接（代码已落，产品验证未做） |
| [conversation-process-fold.md](conversation-process-fold.md) | `implemented` | PRD-013 P1–P3/P3t @ `19f3e7ba`–`42fa941e` |
| [thinkrail-visualize-port.md](thinkrail-visualize-port.md) | `implemented` | PRD-014 T1–T3 @ `5cad7c3b`–`0eb470f2` |
| [conversation-empty-hero.md](conversation-empty-hero.md) | `implemented` | PRD-015 T1–T6 @ `ea0104c0`–`d4064ba0` · [canvas](conversation-empty-hero.canvas.tsx) |
| [conversation-session-windows.md](conversation-session-windows.md) | `implemented` | PRD-016 S1–S6 @ `569ce371` |
