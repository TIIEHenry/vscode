# VS Code Agents Instructions

> 本文件是仓库根上的 **Agent 硬规则**。忽略后会做错的条件写在这里；目录角色、模板和命令细节用链接。编码风格与校验命令以 [Copilot Instructions](.github/copilot-instructions.md) 为准，不抄进本文件。

## 什么情况下一步读哪篇

| 情况 | 下一步 |
|:-----|:-------|
| 产品范围、算不算验收 | [产品愿景](docs/product/vision.md) · [产品需求](docs/product/INDEX.md) |
| 文档放哪、知识 / 过程 / 归档 | [文档系统设计](docs/design/document-system.md) |
| 改文档的维护行为、提交前门禁 | [DOCUMENTATION.md](docs/DOCUMENTATION.md) |
| 目录树与页面模板 | [DOCS-SPEC.md](docs/DOCS-SPEC.md) |
| 状态行怎么写 | [formats.md](scripts/wiki/formats.md) |
| 全局知识导航 | [docs/INDEX.md](docs/INDEX.md) |
| 过程导航 | [dev/INDEX.md](dev/INDEX.md) |
| 接续已有任务 | [status.md](dev/progress/status.md) 的**当前段** |
| 用户要看窗口 | [测试配置](docs/guides/test-profile.md) · [钉死引擎](docs/guides/debug-engine.md) |
| 被问怎么验 | [health-gates](dev/progress/health-gates.md) |
| 层、目标环境、DI | [源码组织](.github/instructions/source-code-organization.instructions.md) |
| 开发自动化 Loop / 仓外工位 | [dev/loop/INDEX.md](dev/loop/INDEX.md) · [worktrees](dev/loop/worktrees.md) |
| 其余知识入口（术语、B2 壳对照等） | [docs/INDEX.md](docs/INDEX.md) |

接续已有任务才读 `dev/progress/status.md` 的当前段。

## 产品窗口

只用**默认编辑器窗口**。Agents Window（`src/vs/sessions/`）只作上游界面与实现对照，不属于本项目的产品使用、UI 审查或交付验收。范围正文见 [产品愿景](docs/product/vision.md)。

## 启动

用户说「启动」或「启动一下」时，只按 [Agents 测试配置](docs/guides/test-profile.md) 启动默认编辑器窗口：`~/.universe-agent-studio-test` 的 user-data、extensions、shared-data，命令里带 `--new-window`，不要加 `--agents`。不带 `--new-window` 时，这份配置会把上次的 Agents 窗口恢复出来。只有用户明确要求查看 Agents 对照界面时，才去掉 `--new-window` 并追加 `--agents`；这不属于本项目产品联调。同时按 [钉死引擎](docs/guides/debug-engine.md) 拉起引擎（`vscode-debug-engine/start-engine.sh`，`127.0.0.1:50061`）。`50061` 已经在听就不要再起一份。不要用 `.agents/skills/launch/scripts/launch.sh`，也不要拷 `~/.vscode-oss-dev` 或日常目录 `~/.universe-agent-studio`。`launch.sh` 只用于 [壳冒烟](docs/guides/shell-smoke-verification.md) 这种必须隔离、登录不写回的自动化。壳冒烟不启动这份引擎。

## 分层

`src/vs/` 分层（低 → 高）：`base` → `platform` → `editor` → `workbench`。`code`（桌面）、`server`（远程）与 `sessions` 都在 `workbench` 之上，彼此是产品入口层。`sessions` 可依赖 `workbench`，反向禁止。

目标环境子目录：`common` / `browser` / `node` / `electron-browser` / `electron-utility` / `electron-main`。

工作台：`workbench/{common,browser,electron-browser}` 核心 · `services/` 核心服务 · `contrib/` 功能 · `api/` Extension API。

## 文档系统

当前知识在 `docs/`，过程在 `dev/`，新归档在 `archive/`，历史归档在 `dev/archive/`。设计正文见 [文档系统设计](docs/design/document-system.md)。命令说明见 [scripts/wiki/README.md](scripts/wiki/README.md)。

- **不要**在 `src/vs/` 新建 `docs/` 树。就近 SSOT（如 `src/vs/sessions/` 下既有 `LAYERS.md`、`SESSIONS.md`）不迁走。
- 新建文档前跑 `python3 scripts/wiki/wiki.py check-new <路径> --root .`。路径不得含空格、`#`、`%` 或括号。
- 整页归档用 `python3 scripts/wiki/wiki.py archive <路径> --root .` 预览，再加 `--apply --expect`。不手工搬。
- 开始任务时跑 `python3 scripts/wiki/wiki.py remind --root .`。看到 `[agent]` 就更新文档，或在提交说明最后一段写 `Docs-Reviewed: <名称> <理由>`。看到 `[user]` 先向用户确认。不得 `--no-verify`。
- 会持续变长的登记表按编号或关键词搜索，不整篇读：[deferred-gaps.md](dev/progress/deferred-gaps.md)、[dev/plans/INDEX.md](dev/plans/INDEX.md)、[traceability.md](docs/product/traceability.md)、[reference.md](scripts/wiki/reference.md)。
- 新建计划、决策、收件箱在一级标题下第一行写状态行，写法见 [formats.md](scripts/wiki/formats.md)。存量计划先不批量补。
- 工具生成的计划和报告放 `dev/`，不放 `docs/`。
- 结构变更后跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。commit 前门禁见 [规则 3a](docs/DOCUMENTATION.md)。

## 方案与提交

方案写完必须先走只读审查（[DOCUMENTATION.md 规则 16](docs/DOCUMENTATION.md)）再实施。

只暂存本次主题文件。禁止为干净工作区 restore / stash / reset 别人的未提交改动。禁止 `git add -A` 把无关 WIP 一起暂存。

## 校验

被问怎么验时，只报本地 `compile` / `eslint` / docs-health / `scripts/test.sh` / `scripts/run-unit-custom.sh`。正文见 [health-gates](dev/progress/health-gates.md)。`npm run valid-layers-check` 在 [D8](dev/progress/deferred-gaps.md) 修好前不作合入门禁。托管 CI 已关（[.github/workflows/DISABLED.md](.github/workflows/DISABLED.md)）：不得写成验证缺口，不得建议重开 workflow。

产品壳只适配默认编辑器窗口。自动剧本是 [壳冒烟](docs/guides/shell-smoke-verification.md) 的 `test/scenario/scenarios/editor-shell.cjs`。`src/vs/sessions/test/e2e` 的 `npm test` 打开 Sessions 网页工作台，不是这条联调。选用见 [测试与校验](docs/architecture/cross-cutting/testing.md)。
