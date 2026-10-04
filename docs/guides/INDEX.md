---
title: "指南索引"
type: index
status: accepted
phase: N/A
updated: 2026-10-05
summary: "辅助指南导航：构建运行、docs 写作、方案只读审查、壳冒烟、交互测试配置、钉死引擎调试"
---

# 指南索引

> 返回 [全局索引](../INDEX.md)

本目录只放**上手与写作**指南。分层设计见 `docs/modules/`，跨层协作见 `docs/systems/`，全景与横切见 `docs/architecture/`。

| 指南 | 说明 |
|------|------|
| [快速开始](getting-started.md) | 从本仓库安装、构建、启动 Code - OSS；完整贡献流程指向上游 wiki |
| [文体指南](doc-style-guide.md) | frontmatter、INDEX 与概览、禁止 `src/vs/` 文档树、链接不复制 |
| [多 Agent 方案设计](multi-agent-design-workflow.md) | 方案定稿前探索；写完须只读审查改稿；worktree 池与文件互斥 |
| [壳冒烟验证](shell-smoke-verification.md) | 隔离 profile 启动、Playwright over CDP、V1–V8 场景与 EH 探针、证据落盘 |
| [Agents 测试配置](test-profile.md) | 「启动 / 启动一下」用 `~/.universe-agent-studio-test`，并同时拉起钉死引擎 `127.0.0.1:50061` |
| [钉死引擎调试](debug-engine.md) | 仓外隔离 HeadlessServer。IDE 用同一个 `UNIVERSE_AGENT_HOME` 发现 UDS 或 pinned TCP，不再扫固定端口；手填 Direct Address 仍走 Device Grant |

## 相关文档

| 文档 | 说明 |
|------|------|
| [术语表](../glossary.md) | 分层、服务、进程等术语 SSOT |
| [测试与校验](../architecture/cross-cutting/testing.md) | 单测、集成测、typecheck、layer check |
| [维护规则](../DOCUMENTATION.md) | LLM 文档门禁与 ADR 约定 |
| [结构规范](../DOCS-SPEC.md) | 目录、模板、健康检查 |
