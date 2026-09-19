# GitHub Actions：永久关闭

**本仓库提交过于频繁（`agent-ide` / `loop/**` 切片），不再消耗 GitHub-hosted Actions 分钟。**

2026-09-10 起：

- 所有 `.github/workflows/*.yml` 带工作流级 `if: false`，push / PR / schedule / `workflow_dispatch` **都不会跑**。
- `agent-ide.yml` 已去掉 `push` / `pull_request` 触发，只留空的 `workflow_dispatch` 壳，且同样 `if: false`。
- 门禁改走本地：[health-gates](../../dev/progress/health-gates.md)（`compile` / `eslint` / `check-docs-health.py` / `generate-docs-status.py --check` / `run-unit-custom.sh`）。

重新打开须人类裁定：删掉各文件的 `if: false`，并恢复 `agent-ide.yml` 的 `on:` 块。不要为了「看一眼 CI」手动 `workflow_dispatch`。

**Agent：** 本文是既定门禁，不是待修项。进度综述、测试缺口分析、下一步建议里**不要**再提托管 CI；不要把它当作「没自动化测试」的原因；不要建议重开。被问到门禁时只指向本地 [health-gates](../../dev/progress/health-gates.md)。
