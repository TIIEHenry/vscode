---
title: "文档文体指南"
type: guide
status: accepted
phase: N/A
updated: 2026-08-30
summary: "本仓库 docs/ 与 dev/ 的写作约定：frontmatter、INDEX 与概览、禁止在 src/vs 建文档树、用链接引用不复制"
---

# 文档文体指南

结构模板见 [DOCS-SPEC.md](../DOCS-SPEC.md)，LLM 维护与提交门禁见 [DOCUMENTATION.md](../DOCUMENTATION.md)。本文只写**落盘时怎么写**，不重复那两份的决策树。

## 语言

- 正文用**中文**。
- 标识符、路径、命令、类型名保持**英文**：`workbench`、`IInstantiationService`、`scripts/test.sh`。
- 用户可见的产品 UI 文案若需引用，保持源码中的英文（或已本地化的原文），不要擅自翻译成文档里的「另一种官方名称」。

## Frontmatter

`docs/` 与 `dev/` 下每个**新建** Markdown 必须以 YAML frontmatter 开头，字段与 [DOCUMENTATION.md §2](../DOCUMENTATION.md) 一致：

```yaml
---
title: "人类可读的标题"
type: architecture | concept | decision | reference | roadmap | plan | progress | demand | index | guide | spec | overview
status: draft | review | accepted | implemented | completed | archived | active | proposed | in_progress | deprecated
phase: N/A
updated: YYYY-MM-DD
summary: "一行描述"
---
```

- 每次编辑必须更新 `updated`。
- 豁免：`AGENTS.md`、根 `README.md`、名为 `SKILL.md` 的文件。
- **不要**给 `src/`、`extensions/`、`test/` 里的上游存量 `.md` 补 frontmatter。

健康检查：`python3 scripts/check-docs-health.py`（可选 `--strict-frontmatter`、`--strict-links`）。链接检查只校验文档目标；源码深链不计入。

## INDEX 与概览

| 文件 | 职责 |
|------|------|
| `INDEX.md` | **导航**：表格、链接、一句话上下文。不写大段设计、不贴分层图正文。 |
| `overview.md` / 系统正文 | **叙述**：目标、协作、契约。每个概念只在一处展开。 |
| 模块 `docs/modules/<m>/INDEX.md` | 指向源码根、依赖方向、关键入口、所属系统；长规格用链接。 |

对照 [DOCS-SPEC.md](../DOCS-SPEC.md)：

- 上游或源码旁的介绍仍可能叫 `README.md`。
- `docs/` 里新增指南不要再额外建 `README.md`（已有 `docs/README.md`、`dev/README.md` 除外）。

四层定位（不要写错目录）：

| 区域 | 写什么 |
|------|--------|
| `docs/modules/` | 单层导航 |
| `docs/systems/` | 跨层协作 |
| `docs/architecture/` | 全景与横切 |
| `dev/` | 行动层（plan / ADR / status），不属于知识库 |

## 禁止在 `src/vs/` 建文档树

**不要**新建 `src/vs/<layer>/docs/`。分层设计写在 `docs/modules/<layer>/` 与 `docs/systems/`。

已有就近规格（例如 `src/vs/sessions/LAYERS.md`、`SESSIONS.md`）继续当 SSOT：模块 INDEX **必须链过去**，不要把正文搬进 `docs/`。

## 链接，不要复制

- 先搜已有文档与就近 SSOT，用相对链接引用。
- 术语定义只写在 [glossary.md](../glossary.md)；其他文件用词条名 + 链接。
- 编码/校验命令以 [.github/copilot-instructions.md](../../.github/copilot-instructions.md) 为权威，指南里只摘已核对命令并回链。
- 贡献、平台排错以 [How to Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute) 为准，不要在 `docs/` 复制 wiki 长文。
- 结构变更后手动更新相关 INDEX（含 [docs/INDEX.md](../INDEX.md)），再跑健康检查。

过时文档移入 `dev/archive/`，设置 `status: archived`，不删除。
