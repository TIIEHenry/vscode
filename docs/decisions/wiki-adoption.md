# 接入 Wiki 文档检查
状态：当前有效。

## 背景

本仓的当前知识已经分在 `docs/` 的产品、架构、系统、模块、指南、对照和术语里，过程材料在 `dev/`。`PRD-NNN`、追踪矩阵、`dev/decisions/` 里的顺序号决策、带 frontmatter 的存量计划，以及 `scripts/check-docs-health.py`，都在使用。

Wiki 检查工具可以检查已登记的链接和身份，在新建时拦住含空格、`#`、`%` 或括号的路径，在归档时按原相对路径移动并改写链接，并在开始任务时汇总执行中的计划。接入要让这些能力可用，同时让现有路径和编号继续有效。

## 替代方案

### 一次搬完全部旧文档

把存量决策、`dev/archive/`、计划的状态和 frontmatter 一次改成工具的默认布局。

未采用。现行索引、追踪矩阵和源码旁规格都指向现在的路径。整批搬迁会改写大量链接，并和上游合并、工作区里别人的未提交改动叠在一起。工具可以登记已有目录和编号，现行文档留在原处维护。

### 继续只用旧的健康检查

只运行 `scripts/check-docs-health.py`，不接入 Wiki 工具。

未采用。健康检查覆盖必备入口、模块与系统索引、`status.md` 行数和生成列。新建路径是否安全、归档时要改哪些链接、开始任务时有哪些执行中的计划，由 Wiki 工具检查。两套检查一起跑。编译和单测的命令清单仍以 [health-gates](../../dev/progress/health-gates.md) 与 [编码约定](../../.github/copilot-instructions.md) 为准。

## 决定

- `docs/` 是当前知识，原位维护。现有的 `docs/product/`、`docs/architecture/`、`docs/systems/`、`docs/modules/`、`docs/guides/`、`docs/reference/` 和 `docs/glossary.md` 留在原路径。
- `dev/` 是过程，包含 `plans`、`progress`、`roadmap`、存量 `decisions`、`parallel`、`reports` 和 `loop`。
- 新归档根是 `archive/`，保持原相对路径。历史归档仍在 `dev/archive/`，不搬迁。归档先运行 `python3 scripts/wiki/wiki.py archive <路径> --root .` 预览，再运行同一命令并加上 `--apply --expect <plan_sha256>`。移动和改链接由这条命令完成。
- 模块文档继续放在 `docs/modules/` 与 `docs/systems/`。`docs/wiki.json` 的 `modules` 与 [文档索引](../INDEX.md) 的分层表是同一批：`path` 是源码目录，`entry` 是 `docs/modules/<名称>/INDEX.md`。`src/vs/` 下不新建 `docs/` 树，以免和上游合并冲突。已有的就近规格（`src/vs/sessions/*.md`）不迁走，模块索引链接过去。
- 仍约束当前行为的新决策写在 `docs/decisions/`，文件名写主题，不用全局顺序号。存量 `dev/decisions/` 不批量搬家。两处都算决策位置，直到某份旧决策被替代或整篇失效。
- 已有 frontmatter 不批量删除。计划、决策和收件箱条目在一级标题下第一行写 `状态：…。`，写法以 [工具读取的写法](../../scripts/wiki/formats.md) 为准。frontmatter 为 `implemented` 或 `completed` 的计划写 `状态：已完成。`。按 [DOCUMENTATION.md 规则 7](../DOCUMENTATION.md#规则-7过时--归档)，已实施的方案仍留在 `dev/plans/`，不批量归档。`remind` 报 `plan-finished-not-archived` 是提醒，方案留在原地。
- 需求编号继续用 `PRD-NNN`。追踪矩阵仍是 `docs/product/traceability.md`。需求追踪已开。状态行用英文值 `accepted`、`implemented`、`proposed`、`blocked`。`blocked` 是本仓工具副本额外认的需求状态。测试引用扫描只覆盖对话测试和导航测试。
- 多项计划并行时，`dev/progress/status.md` 仍是当前迭代汇总，不重写某一份计划的步骤。行数上限 200 仍由 `scripts/check-docs-health.py` 检查。
- 一次审查放在 `dev/reviews/<开始日期>-<主题>/`。方案写完必须经只读审查，正文是 [DOCUMENTATION.md 规则 16](../DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿)。
- 提交门禁在本地执行。命令正文在 [health-gates](../../dev/progress/health-gates.md)。
- 不修改 `git config core.hooksPath`。本机钩子放在 `.git/hooks/`：`pre-commit` 运行 `check --staged`，`commit-msg` 运行 `remind --staged`。别的 clone 要自己放同样的两个可执行文件。提交时不加 `--no-verify`。开始任务时运行 `python3 scripts/wiki/wiki.py remind --root .`。提交前的工作区检查仍运行 `python3 scripts/wiki/wiki.py check --root .` 和 `python3 scripts/check-docs-health.py`。钩子读的是暂存快照。
- 新建文档前运行 `python3 scripts/wiki/wiki.py check-new <路径> --root .`。路径不得含空格、`#`、`%` 或括号。
- 日常 `rg` 通过根目录 `.ignore` 排除 `/archive/` 与 `/dev/archive/`。需要历史时用 `rg --no-ignore` 定向搜索。
- AI 工具生成的计划、报告和调研写入 `dev/`。
- 只暂存本次相关文件。别人的未提交改动留在工作区。
- 产品只使用默认编辑器窗口。启动规则以 [AGENTS.md](../../AGENTS.md) 为准。
- `remind.watch` 覆盖 conversation、sources、document-system、chat、navigator、sessions。`check` 对账 Wiki 规则名：说明页反引号里的连字符名称对上 `wiki.py` 的 `Finding`。`dev/loop/.runtime` 是运行时板，文档健康检查不把它当知识页。

操作步骤见 [文档系统](../design/document-system.md)。原则见 [文档系统设计原则](../principles/document-system.md)。开工顺序见 [开发规范](../standards/development.md)。

## 后果

读者找仍有效的决定时，要同时看 `docs/decisions/` 和 `dev/decisions/`。新的归档出现在 `archive/`；查历史时 `archive/` 与 `dev/archive/` 都算在内。

需求追踪已开。编号仍是 `PRD-NNN`。状态行用英文值 `accepted`、`implemented`、`proposed`、`blocked`。`blocked` 是本仓工具副本额外认的需求状态。测试引用扫描只覆盖 `src/vs/workbench/contrib/conversation/test/*.ts` 和 `src/vs/workbench/contrib/navigator/test/*.ts`。

计划在状态行下写 `覆盖需求：`。编号取该文件里已经出现、并且在需求标题里存在的 `PRD-NNN`；没有这种编号时写明正文未引用。这一行不判断句子是在交付还是在说明不升需求。`remind.plans` 覆盖 `dev/plans/*`、`dev/reviews/*/README.md` 和 `dev/reviews/*/plan-*.md`。frontmatter 为 `implemented` 或 `completed` 的计划写 `状态：已完成。`。按 [DOCUMENTATION.md 规则 7](../DOCUMENTATION.md#规则-7过时--归档)，已实施的方案仍留在 `dev/plans/`，不批量归档。`remind` 报 `plan-finished-not-archived` 是提醒，方案留在原地。决策状态行扫描 `docs/decisions/*` 和 `dev/decisions/*`。存量决策的状态行已按 frontmatter 写入；`superseded` 写成 `状态：被替代。`。

本机 Git 钩子在 `.git/hooks/`，不改 `core.hooksPath`。别的 clone 运行 `scripts/wiki/install-hooks.sh`。脚本看到钩子已经调用 `wiki.py` 就不覆盖。提交时不加 `--no-verify`。开始任务时运行 `remind`。提交前的工作区检查仍是 `check --root .` 与 `check-docs-health.py`。

现行文档里已经存在的越出仓库的链接、断链和断锚记在 `docs/wiki-baseline.json`。`check` 放过基线里的这些错误，基线以外的新错误仍失败。工作区遍历额外跳过 `out`、`.build`、`dist`、`coverage`、`.cache`、`test-results`、`.vscode-test`，避免每次检查走进构建目录。

`verify` 只承担配置里登记的文档检查。编译和单测仍按 health-gates 与编码约定选取。检查通过只说明所查的机器条件成立；方案是否可进入实施，仍按规则 16 做只读审查。
