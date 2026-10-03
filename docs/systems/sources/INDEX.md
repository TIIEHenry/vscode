---
title: "Sources 系统索引"
type: index
status: accepted
phase: N/A
updated: 2026-10-02
summary: "End 列下格：SOURCES_PART + contrib/sources 的 Files | Changes | Review。Files 挂资源管理器同一棵工作区树，不占活动栏图标；Changes / Review 仍是列表投影。PRD-005 仍 accepted。Diff 归属属 PRD-009 / ADR-005。sources-architecture 保持 accepted；P7 已落：命令 id 在 sources common，Diff 守卫只比 type id 与 scheme，归因按路径取记录且每会话超过 500 条丢掉最旧的一条"
---

# Sources

> 返回 [全局索引](../../INDEX.md) · 设计正文见 [系统概览](overview.md) · 需求见 [PRD-005](../../product/requirements.md#prd-005-preview-与-sources)

默认 Code 窗口 End 列下格的配套区域。`browser/parts/sources/` 提供 Part 与 tab / content 两个槽，`contrib/sources/` 填 **Files | Changes | Review**。Files 在本页挂资源管理器同一棵工作区树，列表模式只把树换成当前目录的一级，面包屑仍在；不注册活动栏图标，也不换掉侧栏。Changes / Review 仍是列表投影。Changes / Review 的列表权威、回退和 leftover 以 [系统概览 §4](overview.md) 为准：接通、roster 会话非空、hook 在、且引擎列表非空时才是引擎 `ReadGit*`；无 hook、`supported:false`、空列表、空 session 或断连才回退 SCM。已画出引擎行后再失 hook（仍 connected）保持引擎行。打开按 `sources.diff.defaultOwner` 分派，默认 Preview。stage / commit 在接通且会话非空时走引擎写面；unstage 始终是 `git.unstage`。

## 涉及分层

- `workbench/browser/parts/sources/sourcesPart.ts` — `SourcesPart`（`Parts.SOURCES_PART`）、`ISourcesPartService`（`tabHost` / `contentHost` 槽 + 注册事件）
- `workbench/contrib/sources/` — `SourcesTabsHost`、Files 资源管理器宿主、Changes / Review 列表、筛选框、字符串；`common/` 放变更投影模型与 git 命令常量
- `workbench/browser/layout.ts` — `setSourcesHidden`、`Conversation ∨ (Editor ∨ Sources)`
- `extensions/git` — Changes 调用的 `git.stage` / `git.unstage` / `git.commit`

## 页面

| 页 | 回答什么 |
|----|----------|
| [overview.md](overview.md) | 三个 tab 的数据来源、打开路径、诚实空文案、与 Diff / Review 引擎的边界 |

## 相关文档

- [Parts/Grid](../workbench/parts-and-grid.md) · [companion-contribs](../workbench/companion-contribs.md)（SCM / files 配套面）
- [ADR-005 Diff 归属](../../../dev/decisions/005-changes-diff-owner.md) · [sources-changes-diff plan](../../../dev/plans/sources-changes-diff.md) · [sources-review-open-identity](../../../dev/plans/sources-review-open-identity.md)（打开身份，`accepted` @2026-09-19） · [diff-footprint](../../reference/code-oss-b2/diff-footprint.md)
- [Conversation 系统](../conversation/INDEX.md)
- [Sources 架构审查 2026-09-28](../../../dev/progress/sources-architecture-review-2026-09-28.md)：只读审查 8 条；引擎 Diff 模型在 HEAD 不可解析（已运行时证实）。实施方案 [sources-architecture](../../../dev/plans/sources-architecture.md) 保持 accepted；P7 已在 loop/merge 落
