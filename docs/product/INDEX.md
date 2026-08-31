---
title: "产品需求层入口"
type: index
status: accepted
phase: N/A
updated: 2026-08-31
summary: "本仓 Agent IDE 产品需求导航：愿景、需求、追踪；外仓只作历史出处"
---

# 产品需求

本目录是本仓 **Agent IDE 产品需求 SSOT**。回答：为谁解决什么问题、交付什么结果、怎样算成功。

系统如何组成见 [架构概览](../architecture/overview.md) 与 [systems](../systems/workbench/INDEX.md)。怎样实施见 [dev/plans](../../dev/plans/INDEX.md)。当前做到哪里见 [status](../../dev/progress/status.md)。

## 权威范围

1. 已迁入本目录并标为 `accepted` / `implemented` / `blocked` / `proposed` 的陈述，以本仓为准。
2. UniverseAgentDesktop 的 `docs/product/` 只是迁移来源与历史出处，不是本仓持续演进的前置依赖。
3. 不得通过链接整篇隐式继承外仓规范。外仓与本仓冲突时，已接受的本仓需求优先；冲突在 [traceability.md](traceability.md) 留出处。
4. [B2 壳分析](../reference/code-oss-b2/INDEX.md) 只写本仓实现真相，不再充当产品需求权威。

## 推荐阅读顺序

1. [vision.md](vision.md) — 用户、问题、价值、原则、范围
2. [requirements.md](requirements.md) — `PRD-NNN` 需求正文
3. [traceability.md](traceability.md) — 需求到规格、方案、证据

## 文档职责

| 文件 | 回答 | 禁止承载 |
|------|------|----------|
| [vision.md](vision.md) | 为什么做、给谁用、原则与边界 | 需求 ID、验收步骤、排期 |
| [requirements.md](requirements.md) | 交付什么、怎样算成功 | 类名、文件切片、验证命令 |
| [traceability.md](traceability.md) | 需求连到哪份规格/方案/证据 | 复制需求或设计正文 |

## 生命周期

- 新产品行为：先改对应 `PRD-NNN`，再改系统规格，再改实施方案。
- 历史 M0–M4 方案保留当时完成线；现行需求以本目录为准，历史方案只回链。
- 过时产品文档移入 `dev/archive/`，不删除。

## 相关入口

- 全局索引：[docs/INDEX.md](../INDEX.md)
- 维护规则：[DOCUMENTATION.md](../DOCUMENTATION.md)
- 结构模板：[DOCS-SPEC.md](../DOCS-SPEC.md)
