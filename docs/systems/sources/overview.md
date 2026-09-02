---
title: "Sources 系统概览：Files | Changes | Review"
type: overview
status: accepted
phase: N/A
updated: 2026-09-02
summary: "SOURCES_PART 槽 + SourcesTabsHost；Files 只读投影、Changes SCM 列表 + stage/unstage/commit、Review 只读列表；Changes/Review 行 openSourcesChangeEntry 按 sources.diff.defaultOwner 分派（默认 Preview Diff）；三宿主 moveTo* 已落（F1–F3）；诚实空文案"
---

# Sources 系统概览

> 导航：[系统索引](INDEX.md)。需求：[PRD-005](../../product/requirements.md#prd-005-preview-与-sources)。Diff：[PRD-009](../../product/requirements.md#prd-009-changes-与-diff) · [ADR-005](../../../dev/decisions/005-changes-diff-owner.md)（`accepted`；ADR-004 已 superseded）· 实施 plan [sources-changes-diff](../../../dev/plans/sources-changes-diff.md)。

## 1. 结构

```text
SOURCES_PART（End 列下格；minimum 尺寸与 hide − 控件在 Part）
├── tabHost      ← SourcesTabsHost 画 Files | Changes | Review tab strip
└── contentHost  ← 当前 tab 的面板：filter 输入 + WorkbenchList
```

`SourcesTabsContribution`（`workbench.contrib.sourcesTabs`，`AfterRestored`）等 `ISourcesPartService` 的两个槽都注册后挂 `SourcesTabsHost`。tab 状态在 `common/sourcesTabs.ts`：`SourcesTabId = files | changes | review`，默认 Files，`nextSourcesTab` 循环。

## 2. 三个 tab

| tab | 模型（`common/`） | 视图（`browser/`） | 数据源 | 行点击 | 列表操作 |
|-----|-------------------|--------------------|--------|--------|----------|
| Files | `sourcesFilesModel.ts` | `sourcesFilesList.ts` | 工作区文件的**平铺**只读投影（不是树） | `IEditorService.openEditor` → Preview | 无 |
| Changes | `sourcesChangesModel.ts::collectSourcesChangeEntries` | `sourcesChangesList.ts` | `ISCMService` 各仓库资源组的资源 | `openSourcesChangeEntry`：按 `sources.diff.defaultOwner` 分派 — `preview`（默认）有 `scmResource` → `ISCMResource.open()`（git = `vscode.diff` → **Preview Diff**），无 SCM 时 `openEditor` 文件本体；`conversation` → `ConversationDiffReviewInput`；`panel` → `SourcesDiffPanelView` | 行内 / 选中 **stage** / **unstage**（`git.stage` / `git.unstage`，仅对 git 可 stage / 已 staged 组，`sourcesChangesGit.ts`）；底部 **commit** 行写 SCM input 并跑 `provider.acceptInputCommand` 或 `git.commit` |
| Review | `sourcesReviewModel.ts::collectSourcesReviewEntries` | `sourcesReviewList.ts` | 与 Changes **同一批** SCM 资源 | 同 Changes（`openSourcesChangeEntry`）；Review 行打开成功才标已审阅 | 窗口内存审阅进度（●/○，`ISourcesReviewProgressService`）；Mark reviewed / Mark all /「仅未审阅」；`sources.review.showForPaths` path-set；引擎接通后归因 chip（`onDidFileMutation` sidecar）；**无** stage/commit/写回 SCM |

三个面板顶部都有紧凑 filter（`sourcesListFilterBox.ts` / `common/sourcesFilterModel.ts::filterSourcesEntries`，按文件名 / 路径子串）。

## 3. 诚实空文案

| 情形 | 文案（`*Strings.ts`） |
|------|------|
| Files 无工作区 | `No workspace files. Flat Explorer list projection—not a file tree or Chat.` |
| 筛选无匹配 | `No matching files.` / `No matching changes.` |
| 无 SCM 提供者 | Changes / Review 空列表；不造假变更 |
| Review | header hint `Read-only. Review progress is kept for this window only.`；**无假 review comment** |

## 4. 边界

- **不是** Explorer：树权威在 Sidebar；Files 不做拖放 / 新建 / 重命名。
- **不是** SCM 视图：不维护自己的 staged 状态；stage / unstage / commit 全部是 git 扩展命令的调用面。
- **Diff 归属**（[ADR-005](../../../dev/decisions/005-changes-diff-owner.md) / [sources-changes-diff](../../../dev/plans/sources-changes-diff.md) **F1–F3 已落**）：Changes / Review 行点击经 `openSourcesChangeEntry` 解析 `ISourcesChangeRef`，按 `sources.diff.defaultOwner`（默认 `preview`）分派。**默认**有 SCM 资源时走 `ISCMResource.open()`（git = `vscode.diff` → Preview 里的 `DiffEditorInput`）；无 SCM 资源时 `openEditor` 打开文件本体。用户显式动作（`sources.diff.moveToConversation` / `moveToPanel` / `moveToPreview`）或 `defaultOwner=conversation|panel` 可把同一 change 移入 Conversation 只读审阅 tab（`ConversationDiffReviewInput`）或底部 Panel 产品 Diff 视图（`SourcesDiffPanelView`，重宿主）。Sources 自身不做 inline diff（选项 C 已否决）。F4 隔离 profile 冒烟待验。
- **不自动撑开**：打开 Diff / 文件不得把已收起的 Sources 下格撑开（companion-contribs §5）。
- **Review**：只导航面（Desktop ADR-043 / UI-INV-09 口径；本仓审阅进度在 Review 不在 Changes）；审阅进度窗口内存（R1 @ HEAD）；归因 chip 与 Conversation「查看更改」行依赖引擎 `onDidFileMutation` join（R3 / R4 @ HEAD；历史会话见 G-REV-1）。**无** review comment、approve、写回引擎或 git。

## 5. 与 PRD-005 验收的对应

| 验收 | 落点 |
|------|------|
| 1 Files 只读投影；Explorer 仍是权威 | §2 Files · §4 |
| 2 stage / unstage / commit 走 SCM 提供者命令 | §2 Changes · `sourcesChangesGit.ts` |
| 3 Diff 归 PRD-009 | §4 |
| 4 Review 无假评审；无 SCM 时诚实空 | §3 |

## 6. 测试与验证

`contrib/sources/test/browser/`：`sourcesTabs`、`sourcesFilesModel`、`sourcesFilesListStrings`、`sourcesFilterModel`、`sourcesChangesModel`、`sourcesChangesList`、`sourcesReviewModel`、`sourcesReviewListStrings`、`sourcesReviewProgress`、`sourcesReviewList`、`sourcesReviewShowForPaths`。
