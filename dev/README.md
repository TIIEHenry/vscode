---
title: "dev/ — 开发规划与决策目录"
type: concept
status: accepted
phase: N/A
updated: 2026-09-02
summary: "行动层：plan、ADR、progress；与 docs/ 知识库分离"
---

# dev/ — 开发规划与决策目录

本目录存放**开发过程**文档，与 `docs/`（技术架构）分离。

## 快速导航

| 你想做什么 | 去哪里 |
|:----------|:------|
| 当前迭代状态 | [`progress/status.md`](progress/status.md) · [`progress/INDEX.md`](progress/INDEX.md) |
| 方案与计划 | [`plans/INDEX.md`](plans/INDEX.md) |
| 架构决策 | [`decisions/INDEX.md`](decisions/INDEX.md) |
| 阶段日志 | [`progress/status.md`](progress/status.md) |
| 任务清单 | [`plans/INDEX.md`](plans/INDEX.md) · [`parallel/INDEX.md`](parallel/INDEX.md) |
| 并行看板 | [`parallel/`](parallel/) |

## 与 `docs/` 的区别

| 目录 | 内容 | 生命周期 |
|:-----|:-----|:---------|
| `docs/` | 架构、分层、系统协作 | 随实现持续维护 |
| `dev/` | 排期、决策、进度 | 行动中更新，完成后归档 |

维护规则见 [`docs/DOCUMENTATION.md`](../docs/DOCUMENTATION.md)。
