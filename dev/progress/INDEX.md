---
title: "进度索引"
type: index
status: accepted
phase: N/A
updated: 2026-10-26
summary: "行动层进度入口；含 D388 第二次 gulp 绿证据；D390 直接 CLI 仍 OOM（dest 未写）；ELR S1–S4 与 bug-hunt 01 S2 已落，Sources 架构 P7 已落且方案仍 accepted；2026-10-16 视觉审查发现稿"
---

# 进度

| 文件 | 说明 |
|------|------|
| [upstream-min-patch.md](upstream-min-patch.md) | ADR-007 上游侵入面 A/B 清单与 comm 完备性闸门 |
| [status.md](status.md) | 当前快照（≤200 行） |
| [D1386 叶级身份条源码检查点](default-editor-contract-audit-2026-10-26-evidence/d1386-source-checkpoint.md) / [运行](default-editor-contract-audit-2026-10-26-evidence/d1386-verification.md) | 11条业务断言旧红/新绿、完整IdentityStrip40过、Lens绑定8过；四TS语义0，独立默认编辑器after待到，accepted/open |
| [D1385 首次录音授权运行](default-editor-contract-audit-2026-10-26-evidence/d1385-verification.md) | 修后测试旧生产5个业务断言红，新action完整两套182过；保留初轮夹具错误/源API诊断及C自槽补修。新波fullcompile45/27失败，与旧46/28分列 |
| [D1383 Tunnel 验证](default-editor-contract-audit-2026-10-26-evidence/verification.md) | 旧生产 red、新生产 19 passing、两 TS 定向语义 0。该证据写入时全量未跑 |
| [D1382 ReviewNav 自动回归](default-editor-contract-audit-2026-10-26-evidence/d1382-verification.md) | 旧生产3过/7败、新生产37过；后续[独立默认编辑器after](default-editor-contract-audit-2026-10-26-evidence/d1382-independent-after.md)已到，按ReviewNav通知合同implemented/closed，限制保留 |
| [D1384 远端配置验证](default-editor-contract-audit-2026-10-26-evidence/d1384-verification.md) | 旧生产 16 项断言失败、4 项旧通过、1 项超时不计；新生产 21 过、远端 17 过。全量 46/28 |
| [review-docs-loop.md](review-docs-loop.md) | 15m 审查循环日志（文档漂移 / 未闭缺口） |
| [health-gates.md](health-gates.md) | Loop 集成门禁命令（本仓） |
| [deferred-gaps.md](deferred-gaps.md) | Loop 延期缺口 SSOT |
| [research-queue.md](research-queue.md) | Loop 待研究队列 SSOT |
| [packaging-p0-evidence.md](packaging-p0-evidence.md) | packaging-and-release §4.0–4.2 只读证实（工位 B / loop/B）；无窗 P1 子集见 [D388](../roadmap/active/d388-packaging-p1-asar-machine.md) |
| [d388-packaging-p1-asar-evidence.md](d388-packaging-p1-asar-evidence.md) | D388 无窗断言：空 `.map` 已复原；第二次 gulp exit 0；asar 见两包 `package.json`；首次红记录保留 |
| [d390-packaging-p2-vscode-web-evidence.md](d390-packaging-p2-vscode-web-evidence.md) | D390 无窗排除面：首败+8192/env+直接 CLI 16g/32g 均红；dest 未写；不关 D390/D391/D392 |
| [d390-packaging-p2-vscode-web-machine](../roadmap/active/d390-packaging-p2-vscode-web-machine.md) | D390 无窗 vscode-web 排除面合同（实施 blocked；dest 未写） |
| [worktree-pool.md](worktree-pool.md) | 仓外 `vscode-WorkTrees` 工位表 |
| [钉死引擎调试](../../docs/guides/debug-engine.md) | 仓外 HeadlessServer，不是 Loop 槽 |
| [bug-hunt-2026-09-24](bug-hunt-2026-09-24/INDEX.md) | 2026-09-24 十六路只读扫描；方案在 `dev/plans/bug-hunt-2026-09-24/` |
| [ui-gap-review-2026-10-01.md](ui-gap-review-2026-10-01.md) | 2026-10-01 四路只读 UI 缺口审查（3 Critical、19 Important）；发现稿，不登记 D、不升 PRD |
| [visual-review-2026-10-16.md](visual-review-2026-10-16.md) | 2026-10-16 对照 UI 设计原则审查工作区未提交的视觉改动（5 条需要改、3 条建议改）；静态审查未截图，发现稿，不登记 D |
| [sources-architecture-review-2026-09-28.md](sources-architecture-review-2026-09-28.md) | Sources 只读架构审查 8 条（SAR-1…8）。方案 [sources-architecture](../plans/sources-architecture.md) 仍 accepted；P7 已在 loop/merge 落 |
| [engine-link-architecture-review-2026-09-28.md](engine-link-architecture-review-2026-09-28.md) | 引擎链接只读架构审查 9 条（ELR-1…9）。ELR-1/ELR-2 的 S1–S4 与 bug-hunt 01 S2 已落；试连超时绕过 SAS 仍开 |
