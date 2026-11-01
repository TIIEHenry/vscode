---
title: "Sources Changes 的 IDEA 式目录面板"
type: plan
status: accepted
phase: implementation
updated: 2026-11-01
summary: "在保留 Sources 横向 Files/Changes/Review 入口与现有 Git/引擎写入合同的前提下，把 Changes 内容区改成带目录树、计数、勾选与常驻操作栏的 IDE 风格面板。"
---

# Sources Changes 的 IDEA 式目录面板

状态：执行中。范围：Sources Changes 内容区。负责：agent:codex。

覆盖需求：PRD-005.2、PRD-005.3；左侧全局 Project/Commit/Code 工具窗口不在本轮范围。

## 目标

Changes 面板按 SCM 分组和相对路径展示变更，目录可展开 / 收起，目录与分组显示文件数，文件和目录提供稳定的勾选命中区。顶部工具栏提供刷新、展开 / 收起和批量 stage / unstage；现有单击打开 Diff、右键切换打开方式、Commit、引擎写入门闩和失败状态保持不变。

## 产品边界

- 保留 Sources 的 Files / Changes / Review 横向 tab，不把 IDEA 截图中的 Project、Commit、Code、Pull Requests 竖条直接移植成新的全局入口。
- Changes 仍以 `ISourcesChangesModel` 快照为唯一数据源；不从文件系统重新扫描，也不改变 engine-live、engine-leftover、SCM fallback 或写入 session 合同。
- 过滤先作用于文件条目，再构造可见目录树；目录计数只统计当前过滤结果中的文件。
- 目录勾选是当前快照内的批量 stage / unstage 选择，不把勾选状态伪装成 Git stage 状态。刷新或条目消失后清理失效选择。
- 节点 identity 至少包含 `groupId`、仓库 / 资源根、相对路径和叶子资源 URI；同路径跨仓库、跨 SCM group 或同名目录不得合并。快照刷新后按 identity 保留仍存在的展开状态，条目消失的目录自动清理。
- 三态只反映当前节点后代中可见且可写的叶子：全部可写叶子已勾选为 checked，部分勾选为 mixed，没有可写叶子为 unchecked 且禁用。engine session 不一致、配对等待、读失败 leftover 和 SCM unstage-only 叶子不能被批量 stage 误发；没有可写叶子时沿用现有写入原因。
- 空态、读取失败、配对等待、未就绪和禁用原因继续使用现有状态行与 aria / title 文案。

## 交互与视觉

- 根分组行显示 `Changes N files` / `Staged Changes N files`，带三态勾选框和展开箭头。
- 目录行显示文件夹图标、相对路径、当前过滤结果计数和三态勾选框；文件行显示文件图标、文件名、父目录、状态字母与可用的行内 stage / unstage。
- 文件与目录行保持 IDE 紧凑密度，行高复用现有 Sources 行高；文本截断、悬停、键盘焦点和选中背景遵循工作台变量。
- 工具栏常驻于内容区顶部：刷新、全部展开、全部收起、Stage Selected、Unstage Selected。没有可用动作时按钮保留位置但诚实禁用并写原因。
- Space 切换当前文件或目录勾选，Enter 打开文件；左右箭头展开 / 收起目录，Shift + Space 作用于当前目录可见后代。

## 实施切片

1. 把当前平面 entries 适配为带 group / folder / file 节点的可压缩树模型，保留 `ISourcesChangeEntry` 作为文件叶子并为节点提供稳定 identity。
2. 新增文件 / 目录三态勾选状态，批量操作只读取当前快照中仍存在的叶子；保留列表选择作为键盘打开焦点，避免破坏现有测试与打开合同。
3. 把现有 stage / unstage 行为接到目录、分组和工具栏，继续走 `runResourceAction` 与现有写入门闩，不新增写路径。
4. 调整 Sources Changes CSS 与无障碍标签，覆盖加载、空态、失败、窄宽度、长路径和按钮禁用状态。
5. 树迁移保留 `SourcesChangesList` 的打开、右键、键盘和选择语义：树节点通过同一打开 helper 处理叶子，工具栏读取树的 checked leaves；现有直接读取 `list.element()` 的测试改为测试树适配层提供的可观察叶子快照，不改变读写断言。
6. 刷新按钮只调用 `changesModel.refresh()`，展开 / 收起只改视图状态，不新增 git read 或绕过 generation / stale 保护。
7. 更新 Changes 组件测试，覆盖目录构造、过滤计数、三态勾选、展开 / 收起、批量 stage / unstage 和既有打开行为；跑 Sources 专项测试、ESLint、compile-client 与文档健康检查。
8. 实施完成后同步 `docs/product/requirements.md`、`docs/systems/sources/overview.md`、必要时 `dev/plans/INDEX.md`，再跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。

## 不做

- 不改 Sources tab 的产品入口，不新增 Activity Bar 图标。
- 不改变 Changes 与 Review 的共享快照、Diff owner、打开位置或写入能力判断。
- 不实现 IDEA 截图中的 Commit 工具窗口、Pull Requests 工具窗口或全局竖向导航。

## 验收

- 变更条目按分组和目录形成可展开树；每个目录和分组计数与当前过滤结果一致。
- 勾选文件、目录和根分组能正确联动三态；批量 stage / unstage 的请求集合与勾选叶子一致。
- 点击文件仍按原 Sources 打开合同打开 Diff；打开失败、读取失败、会话切换和配对等待不改变既有安全门闩。
- 无仓库、无变更、过滤无匹配和读取失败仍显示原有诚实空态。
- 现有 Sources Changes 读写与打开测试保持通过，并新增树与勾选专项覆盖。
