---
title: "进度索引"
type: index
status: accepted
phase: N/A
updated: 2026-09-12
summary: "行动层进度入口；含 D388 第二次 gulp 绿证据；D390 直接 CLI 仍 OOM（dest 未写）"
---

# 进度

| 文件 | 说明 |
|------|------|
| [upstream-min-patch.md](upstream-min-patch.md) | ADR-007 上游侵入面 A/B 清单与 comm 完备性闸门 |
| [status.md](status.md) | 当前快照（≤200 行） |
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
