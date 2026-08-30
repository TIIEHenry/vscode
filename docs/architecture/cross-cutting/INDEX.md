---
title: "横切关注点索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "全局横切：分层、测试、主题、IPC、DI、贡献点、启动、窗口、内置扩展"
---

# 横切关注点

> 返回 [架构概览](../overview.md) · [全局索引](../../INDEX.md)

| 文档 | 说明 |
|------|------|
| [分层规则](layers.md) | `base` → `platform` → `editor` → `workbench` → `sessions` / `code` / `server`；目标环境子目录 |
| [测试与校验](testing.md) | 单测、集成测、typecheck、layer check 的入口与选用原则 |
| [B2 壳/Agent UI 分析](../../reference/code-oss-b2/INDEX.md) | 对照 Desktop 文档壳：Parts/Grid、四钮映射、T1–T3 |
| [主题与 token](theming.md) | workbench 颜色/CSS vs Desktop ADR-003（只对照，不迁 token） |
| [IPC](ipc.md) | 进程通道、channel、main / shared / ext host / remote |
| [依赖注入](instantiation.md) | `createDecorator`、`registerSingleton`、构造注入 |
| [贡献模型](contributions.md) | Registry、WorkbenchPhase、contrib vs 扩展 |
| [启动路径](startup.md) | 桌面 / Web / server / sessions 窗口如何进 workbench |
| [窗口模型](windows.md) | 主窗、辅助窗、Sessions 窗、Web embedder |
| [内置扩展](builtin-extensions.md) | `extensions/` 与 workbench 的边界 |
