---
title: "Sources 系统索引"
type: index
status: accepted
phase: N/A
updated: 2026-09-02
summary: "End 列下格：SOURCES_PART + contrib/sources 的 Files | Changes | Review 列表投影；PRD-005 系统规格；Diff 归属属 PRD-009 / ADR-005"
---

# Sources

> 返回 [全局索引](../../INDEX.md) · 设计正文见 [系统概览](overview.md) · 需求见 [PRD-005](../../product/requirements.md#prd-005-preview-与-sources)

默认 Code 窗口 End 列下格的配套区域。`browser/parts/sources/` 提供 Part 与 tab / content 两个槽，`contrib/sources/` 填 **Files | Changes | Review** 三个列表投影。它是配套，不是第二个主工作区：文件树权威仍在 Sidebar Explorer，SCM 状态权威仍在 git 扩展，点击任一行都在 Preview 打开。

## 涉及分层

- `workbench/browser/parts/sources/sourcesPart.ts` — `SourcesPart`（`Parts.SOURCES_PART`）、`ISourcesPartService`（`tabHost` / `contentHost` 槽 + 注册事件）
- `workbench/contrib/sources/` — `SourcesTabsHost`、三个列表、筛选框、字符串；`common/` 放纯投影模型与 git 命令常量
- `workbench/browser/layout.ts` — `setSourcesHidden`、`Conversation ∨ (Editor ∨ Sources)`
- `extensions/git` — Changes 调用的 `git.stage` / `git.unstage` / `git.commit`

## 页面

| 页 | 回答什么 |
|----|----------|
| [overview.md](overview.md) | 三个 tab 的数据来源、打开路径、诚实空文案、与 Diff / Review 引擎的边界 |

## 相关文档

- [Parts/Grid](../workbench/parts-and-grid.md) · [companion-contribs](../workbench/companion-contribs.md)（SCM / files 配套面）
- [ADR-005 Diff 归属](../../../dev/decisions/005-changes-diff-owner.md) · [sources-changes-diff plan](../../../dev/plans/sources-changes-diff.md) · [diff-footprint](../../reference/code-oss-b2/diff-footprint.md)
- [Conversation 系统](../conversation/INDEX.md)
