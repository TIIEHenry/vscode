# GitHub Actions：永久关闭

**本仓库提交过于频繁（`agent-ide` / `loop/**` 切片），不再消耗 GitHub-hosted Actions 分钟。**

2026-09-10 起：

- 所有 `.github/workflows/*.yml` 带工作流级 `if: false`，push / PR / schedule / `workflow_dispatch` **都不会跑**。
- `agent-ide.yml` 已去掉 `push` / `pull_request` 触发，只留空的 `workflow_dispatch` 壳，且同样 `if: false`。
- 门禁改走本地：[health-gates](../../dev/progress/health-gates.md)（`compile` / `eslint` / `check-docs-health.py` / `generate-docs-status.py --check` / `run-unit-custom.sh`）。

重新打开须人类裁定：删掉各文件的 `if: false`，并恢复 `agent-ide.yml` 的 `on:` 块。不要为了「看一眼 CI」手动 `workflow_dispatch`。
