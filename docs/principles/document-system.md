# 文档系统设计原则

本页写本仓在文档系统上要执行的原则。目录、命令和检查范围见 [文档系统](../design/document-system.md)。取舍记录见 [接入 Wiki 文档检查](../decisions/wiki-adoption.md)。

## 知识与过程分开

`docs/` 保存当前仍然适用的目标、边界、规则和设计。`dev/` 保存计划、进度、路线图、并行记录、报告和调研。AI 工具生成的计划、报告和调研写入 `dev/`。

已经接受、尚未实现的需求仍放在 [`docs/product/`](../product/INDEX.md)。计划做到哪一步，不改变需求条文是否有效。源码与需求不一致时，在对应计划里记下差距和处理依据。

已结束的过程，以及整篇不再承担当前职责的文档，归档到 `archive/`，并保持原来的相对路径。已经在 [`dev/archive/`](../../dev/archive/INDEX.md) 的历史文件留在原地。

## 一份当前正文

同一主题在同一适用范围里指定一份当前正文。[`docs/INDEX.md`](../INDEX.md)、[`dev/INDEX.md`](../../dev/INDEX.md) 和模块索引从各自的任务链到这份正文。

[`AGENTS.md`](../../AGENTS.md) 放忽略后会直接做错的硬规则，以及什么情况下去读哪一篇。入口里复述的每条硬规则都链回它的正文。入口句子和正文在同一次改动里一起改。链接能打开，只说明路径还在；两处的意思是否仍然一致，要对照阅读。

## 长期知识原位维护

`docs/product/`、`docs/architecture/`、`docs/systems/`、`docs/modules/`、`docs/guides/`、`docs/reference/` 和 [术语表](../glossary.md) 在原路径更新。入口见 [`docs/INDEX.md`](../INDEX.md)。普通修订由 Git 保留历史。一次普通更新不把整页送去归档。

仍约束当前行为的新决策写在 `docs/decisions/`，文件名用主题。[`dev/decisions/`](../../dev/decisions/INDEX.md) 里已有的决策留在原地。两处都算决策位置。某份旧决策被替代，或整篇失效之后，再按归档流程处理那一份。

## 入口只放硬规则与阅读条件

开工从 [`AGENTS.md`](../../AGENTS.md) 进入，再按 [开发规范](../standards/development.md) 读维护规则和当前迭代状态。控件尺寸、调用顺序和某一层的实现约束写在模块或系统文档里。

会持续变长的登记，例如延期缺口和迭代状态，按编号或关键词读取命中的行。[`status.md`](../../dev/progress/status.md) 的行数上限是 200，由 `scripts/check-docs-health.py` 检查。

## 模块文档不进 src/vs

分层导航写在 `docs/modules/`，跨层协作写在 `docs/systems/`。`src/vs/` 下不新建 `docs/` 树，以免与上游合并冲突。已经放在源码旁的规格继续留在原地，例如 [`LAYERS.md`](../../src/vs/sessions/LAYERS.md)。模块索引链接过去。

## 检索范围与访问权限分开

根目录 `.ignore` 让日常 `rg` 排除 `/archive/` 与 `/dev/archive/`，用来减少历史全文干扰。读文件、带 `--no-ignore` 的搜索，以及归档和迁移检查，仍然可以到达这些目录。需要历史时，用 `rg --no-ignore` 并写明目录。

## 检查通过只覆盖所查的那一项

`wiki.py check` 与 `check-docs-health.py` 通过，表示它们登记的结构、链接、行数或生成列满足条件。正文是否与代码、需求一致，要另做对照。方案写完后的只读审查以 [规则 16](../DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿) 为正文。工具明确不判断的部分见 [检查内容和边界](../../scripts/wiki/reference.md#检查内容和边界)。
