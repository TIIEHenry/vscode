# VS Code Agents Instructions

> 本文件是本仓库的 **Agent 开发向导**。编码风格与校验命令以 [Copilot Instructions](.github/copilot-instructions.md) 为准。

## 新会话必读

1. 本文件 — 项目全貌与文档入口
2. [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) — 文档维护规则
3. [dev/progress/status.md](dev/progress/status.md) — 当前迭代状态

## 文档导航

| 文档 | 说明 |
|:-----|:-----|
| [产品需求](docs/product/INDEX.md) | Agent IDE 愿景、需求与追踪 SSOT |
| [文档索引](docs/INDEX.md) | 全局导航 |
| [文档规范](docs/DOCS-SPEC.md) | 目录结构与模板 |
| [维护规则](docs/DOCUMENTATION.md) | frontmatter、commit 门禁；**方案写完须 Opus 5.0 审查**（规则 16） |
| [架构概览](docs/architecture/overview.md) | 分层全景 |
| [术语表](docs/glossary.md) | 核心术语 SSOT |
| [B2 壳 / Agent UI 分析](docs/reference/code-oss-b2/INDEX.md) | 对照 Desktop 文档壳的本仓实现真相 |
| [编码/校验](.github/copilot-instructions.md) | TypeScript、测试、分层 |
| [源码组织](.github/instructions/source-code-organization.instructions.md) | 层、目标环境、DI |
| [开发自动化 Loop](dev/loop/INDEX.md) | `/loop @dev/loop/loop-prompt.txt`（AgenticLoopDev submodule） |
| [dev/loop/worktrees.md](dev/loop/worktrees.md) | 仓外并行 worktree 工位（`$REPO-WorkTrees`） |

## 架构摘要

`src/vs/` 分层（低 → 高）：`base` → `platform` → `editor` → `workbench` → `sessions`。`code`（桌面）与 `server`（远程）是入口层。`sessions` 可依赖 `workbench`，反向禁止。

目标环境子目录：`common` / `browser` / `node` / `electron-browser` / `electron-main`。

工作台：`workbench/{common,browser,electron-browser}` 核心 · `services/` 核心服务 · `contrib/` 功能 · `api/` Extension API。

就近 SSOT：`src/vs/sessions/` 下既有规格（`LAYERS.md`、`SESSIONS.md` 等）不迁走。

## 文档系统要点

- 知识库在 `docs/`，行动层在 `dev/`
- **不要**在 `src/vs/` 新建 `docs/` 树
- 结构变更后运行 `python3 scripts/check-docs-health.py`
- commit 前门禁见 [DOCUMENTATION.md 规则 3a](docs/DOCUMENTATION.md)

## 校验（按影响面选用，勿当作收尾仪式）

详见 [.github/copilot-instructions.md](.github/copilot-instructions.md)：优先最小针对性测试；`scripts/test.sh`；分层变更才跑 `npm run valid-layers-check`。
