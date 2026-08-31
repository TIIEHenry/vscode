---
title: "VS Code 文档总览"
type: concept
status: accepted
phase: N/A
updated: 2026-08-31
summary: "docs/ 人类向导航：产品需求、架构知识库；行动层见 dev/"
---

# 系统文档

本文档树同时承载本仓 **Agent IDE 产品需求**（[`product/`](product/INDEX.md)）与**实现真相**（[`architecture/`](architecture/overview.md)、[`systems/`](systems/workbench/INDEX.md)、[`modules/`](INDEX.md#分层模块)）及本地协作文档。上游 VS Code 用户手册仍在 [VS Code wiki](https://github.com/microsoft/vscode/wiki) 与 [vscode-docs](https://github.com/microsoft/vscode-docs)，不是 Agent IDE 产品需求 SSOT。

## 如何阅读

| 角色 | 推荐阅读 |
|------|----------|
| 产品 / 规划 | [产品需求](product/INDEX.md) → [愿景](product/vision.md) → [需求](product/requirements.md) |
| 架构 / Agent | [架构概览](architecture/overview.md) → [分层规则](architecture/cross-cutting/layers.md) → [B2 壳分析](reference/code-oss-b2/INDEX.md) |
| 改文档壳 / Agent UI | [Parts/Grid](systems/workbench/parts-and-grid.md) → [Agent UI](systems/chat/agent-ui.md) → [四钮映射](reference/code-oss-b2/desktop-shell-mapping.md) |
| 分层开发 | [全局索引](INDEX.md) → 对应 `docs/modules/<layer>/` |
| 测试 / 校验 | [测试与校验](architecture/cross-cutting/testing.md) → [Copilot Instructions](../.github/copilot-instructions.md) |

## 文档结构

```
docs/
├── product/           ← 产品需求 SSOT（愿景、需求、追踪）
├── architecture/      ← 全局架构
├── systems/           ← 跨层系统
├── modules/           ← 分层导航
├── guides/            ← 指南
└── reference/         ← 参考（含 code-oss-b2 分析簇）
```

## 规范

- 索引由人工维护；结构变更后运行 `python3 scripts/check-docs-health.py`
- 维护规则见 [DOCUMENTATION.md](DOCUMENTATION.md)
- 结构模板见 [DOCS-SPEC.md](DOCS-SPEC.md)

## 完整索引

[docs/INDEX.md](INDEX.md)

---

*最后更新：2026-08-31*
