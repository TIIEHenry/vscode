---
title: "Sources 系统概览：Files | Changes | Review"
type: overview
status: accepted
phase: N/A
updated: 2026-10-02
summary: "SOURCES_PART 槽 + SourcesTabsHost；Files 只读文件夹树或当前标签目录的一级列表；Changes/Review 接通走 readGit* 否则 SCM；Accept 定为暂存光标 hunk（方案未实施前无载荷不显示）；Diff 默认 Preview。Sources 变更读收成 ISourcesChangesModel；Changes 与 Review 投影同一快照，会话事实走 IAgentSessionContext。Accept 仍无载荷不显示。P3 身份跟着条目走已落。P6 与 P7 已落；方案 sources-architecture 仍 accepted。"
---

# Sources 系统概览

> 导航：[系统索引](INDEX.md)。需求：[PRD-005](../../product/requirements.md#prd-005-preview-与-sources)。Diff：[PRD-009](../../product/requirements.md#prd-009-changes-与-diff) · [ADR-005](../../../dev/decisions/005-changes-diff-owner.md)（`accepted`；ADR-004 已 superseded）· 实施 plan [sources-changes-diff](../../../dev/plans/sources-changes-diff.md)。

## 1. 结构

```text
SOURCES_PART（End 列下格；minimum 尺寸与 hide 关闭控件在 Part）
├── tabHost      ← SourcesTabsHost 画 Files | Changes | Review tab strip
└── contentHost  ← 当前 tab 的面板：filter 输入 + Files 树/当前级列表 / Changes·Review 列表
```

`SourcesTabsContribution`（`workbench.contrib.sourcesTabs`，`AfterRestored`）等 `ISourcesPartService` 的两个槽都注册后挂 `SourcesTabsHost`。tab 状态在 `common/sourcesTabs.ts`：`SourcesTabId = files | changes | review`，默认 Files，`nextSourcesTab` 循环。

## 2. 三个 tab

| tab | 模型（`common/`） | 视图（`browser/`） | 数据源 | 行点击 | 列表操作 |
|-----|-------------------|--------------------|--------|--------|----------|
| Files | `sourcesFilesModel.ts` | `sourcesFilesList.ts` · `sourcesFilesTree.ts` · `sourcesFilesLevel.ts` | 只读。默认是搜索投影的文件夹树，父行只是相对路径分段。列表模式列 Preview 当前标签里该文件所在目录的一级：工作区目录用 `fileService.resolve`，引擎文件用投影里同一父路径的兄弟。`sources.files.viewMode` 记住树或列表 | 文件行按 `sources.editorOpenMode` 打开；文件夹行不打开编辑器，也不带动资源管理器 | 树 / 列表切换 |
| Changes | `sourcesChangesGitRead.ts::tryLoadSourcesGitChangeEntries` · `sourcesChangesModel.ts::collectSourcesChangeEntries` | `sourcesChangesList.ts` | 接通且 `readGitChanges` hook 在且 `IAgentSessionContext.getActiveSessionId()` 非空：`readGitChanges` / `readGitSummary`（引擎行 `sessionId` 是该次 ReadGitChanges 的会话；leftover 写入沿用条目上的 sessionId）；空 session / 断连 / 首拉无 hook / `supported:false` / `supported:true` 且 `entries=[]`：`ISCMService` 各仓库资源组（快照保持 `scm`）。已引擎行 leftover 后再失 hook（仍 connected）保引擎行，不切 SCM、不画 `sourcesGitLocalOnlyMessage()` | `openSourcesChangeEntry`：按 `sources.diff.defaultOwner` 分派 — `preview`（默认）有 `scmResource` → `ISCMResource.open()`（git = `vscode.diff` → **Preview Diff**）；git 行且无本地 original 时再 `readGitFileDiff`（同样要非空 session）；无 SCM 时 `openEditor` 文件本体；`conversation` → `ConversationDiffReviewInput`；`panel` → `SourcesDiffPanelView` | 行内 / 选中 **stage** / **unstage**（`scm` 快照的 stage 只走 `git.stage`，0 次 `writeGitStagePaths`；`origin: engine` 的 stage 用条目 `gitPath` 与 `sessionId` 写 `writeGitStagePaths`，活动会话不一致、没有 `sessionId` 或 `gitPath === ''` 时不写也不退回 `git.stage`；unstage 始终是 `git.unstage`，仅在有 `scmResource` 且组可 unstage 时，0 次 `writeGitStagePaths`）；底部 **commit**（`scm` 快照只走 `acceptInputCommand` / `git.commit`，0 次 `writeGitCommit`；`engine-live` 与 leftover 只用快照或条目 `sessionId` 调 `writeGitCommit`，未接受、unsupported 或抛错只写状态行，不退回本地提交） |
| Review | 投影同一份 `ISourcesChangesModel` 快照 | `sourcesReviewList.ts` | 同 Changes | 同 Changes（`openSourcesChangeEntry`）；Review 行打开成功才标已审阅 | 窗口内存审阅进度（●/○，`ISourcesReviewProgressService`）；Mark reviewed / Mark all /「仅未审阅」；`sources.review.showForPaths` path-set；引擎接通后归因 chip（`onDidFileMutation` sidecar，按路径取记录，同一会话超过 500 条丢掉最旧的一条）；**无** stage/commit/写回 SCM |

行点击的标签槽和资源管理器分开。资源管理器单击文件默认在当前组新开标签（`explorer.editorOpenMode`，默认 `newTab`）。Sources 的 Files / Changes / Review 在打开到编辑器组时默认替换当前标签（`sources.editorOpenMode`，默认 `replace`）；文件已经在该组打开时改为切到那个标签。右键保留没被选成默认的那一种。Ctrl/Alt 单击和 Open to the Side 仍是分屏，不读这两项。目标是 Panel 时没有编辑器标签，不受 `sources.editorOpenMode` 影响。没传 `slot` 的移动动作保持原来的打开方式。Sources 打开编辑器时压住资源管理器的自动定位，导航树不跟着跳；之后再点到那个标签，仍按 `explorer.autoReveal` 定位。

三个面板顶部都有紧凑 filter（`sourcesListFilterBox.ts` / `common/sourcesFilterModel.ts::filterSourcesEntries`，按文件名 / 路径子串）。空态节点 `flex: 1` 居中，JS 设 `display: ''` 好让 CSS 生效。Changes 行内描述是父目录（`sourcesChangesPresentation.ts`），分组名只出现在该组第一行的组头并带数量；休息态是状态字母，stage / unstage 在行悬停或焦点时出现，全部 stage / unstage 在组头。选中项工具条只在选中了可 stage / unstage 的行时出现。底部 commit 是多行说明加按钮。`sourcesGitLocalOnlyMessage()` 画在提交条上的状态点（`.sources-changes-provenance`），不另占一行；失败文案仍在 `.sources-changes-status`。Diff 宿主标题统一底边与 4px 8px 内边距；无 ref / 打开失败时藏 Panel 头与 Conversation「Open Diff in Preview」。

## 3. 诚实空文案

| 情形 | 文案（`*Strings.ts`） |
|------|------|
| Files 无工作区 | `No workspace files.`（搜索投影为空时的空态，不是资源管理器） |
| Files `fetchChildren` throw | `Unable to read workspace files: …`（首拉画空态失败文案；成功后再 throw 保 leftover 行并画 `.sources-files-status.is-error`，不装空成功） |
| 筛选无匹配 | `No matching files.` / `No matching changes.` |
| Changes/Review 首拉 `readGit*` throw | 空区写 `Unable to read git changes: …`，**不**写 `No changes.` / `No changes to review.`；底栏失败色 + `role=status` |
| 无 SCM 提供者 | Changes / Review 空列表；不造假变更 |
| Review | 有变更时 hint `Review progress stays in this window.`；无仓库时只留空态、不画 hint；**无假 review comment** |

## 4. 边界

- **不是** Explorer：树权威在 Sidebar。Files 的树只把已经投影出来的相对路径画成只读文件夹树。列表模式只列当前 Preview 标签文件的那一层目录，文件夹行不能再点进去，也不做拖放 / 新建 / 重命名。从 Sources 打开文件不联动资源管理器。
- **不是** SCM 视图：接通后列表权威是引擎 `ReadGit*`（须非空 `IAgentSessionContext.getActiveSessionId()` **且** 非空 `entries`）；空 session / 断连 / 首拉无 hook / `supported:false` / 空引擎列表才投影本地 SCM。已活画引擎行后再失 `readGitChanges`（仍 connected）保 leftover，不把 SCM 装成权威（[D273](../../../dev/progress/deferred-gaps.md)）。`ReadGitChanges` / `ReadGitSummary` throw 与读失败同级（`sourcesGitReadFailureMessage`），不把 Summary 失败画成「无摘要」仍用引擎 entries。stage / commit 写出同样要非空 session；unstage 仍走 git 扩展命令。Review / Panel **Accept** 的产品语义（2026-09-25）是暂存光标所在 hunk：点击时现拉 `ReadGitFileDiff`，客户端切出单个 hunk，`argv` 为 `git apply --cached --whitespace=nowarn`。两侧 diff 会同步移动光标；Accept 只认仍聚焦的那一侧。点 Accept 时焦点已离开编辑器，沿用最后一次仍聚焦的那一侧记下的行。对侧同步过来的光标不改 hunk。从未聚焦过才退回修改侧当前位置。见 [sources-accept-stage-hunk](../../../dev/plans/sources-accept-stage-hunk.md)。该方案落地前，无真实载荷不得显示 Accept，不得把整段 `unified_diff` 或 monaco 两侧当 `patches`，不得把 `git.stage` 当 Accept 成功。空 `patches` 仍由宿主拒送。
- **Diff 归属**（[ADR-005](../../../dev/decisions/005-changes-diff-owner.md) / [sources-changes-diff](../../../dev/plans/sources-changes-diff.md) **F1–F3 已落**）：Changes / Review 行点击经 `openSourcesChangeEntry` 解析 `ISourcesChangeRef`，按 `sources.diff.defaultOwner`（默认 `preview`）分派。**默认**有 SCM 资源时走 `ISCMResource.open()`（git = `vscode.diff` → Preview 里的 `DiffEditorInput`）；无 SCM 资源时 `openEditor` 打开文件本体。用户显式动作（`sources.diff.moveToConversation` / `moveToPanel` / `moveToPreview`）或 `defaultOwner=conversation|panel` 可把同一 change 移入 Conversation 只读审阅 tab（`ConversationDiffReviewInput` 开 `CONVERSATION_SIDE_GROUP`，`matches()` 含 original + `groupId`）或底部 Panel 产品 Diff 视图（`SourcesDiffPanelView`，重宿主；`renderRef` 用代数闸丢弃过期 await）。git-read 首拉失败空列表藏 Commit 行，不画「No changes.」。Sources 自身不做 inline diff（选项 C 已否决）。F4 隔离 profile 冒烟待验。
- **HEAD 已知偏差（2026-09-28 审查）**：`ReadGitFileDiff` 写出的 `sources-git-diff:` 模型没有注册内容提供者。Preview、Conversation、Panel 都经 `createModelReference` 取模型，三处都会解析失败，所以本地拿不到原始版本的引擎行在 HEAD 上打不开 Diff；带载荷的 Accept 也因此显示不出来。修复与 [sources-accept-stage-hunk](../../../dev/plans/sources-accept-stage-hunk.md) 的 S0 同一切片，方案见 [sources-architecture](../../../dev/plans/sources-architecture.md) P1（2026-09-28 签收，未实施）。审查记录见 [Sources 架构审查](../../../dev/progress/sources-architecture-review-2026-09-28.md) SAR-1。
- **不自动撑开**：打开 Diff / 文件不得把已收起的 Sources 下格撑开（companion-contribs §5）。
- **Review**：只导航面（Desktop ADR-043 / UI-INV-09 口径；本仓审阅进度在 Review 不在 Changes）；审阅进度窗口内存（R1 @ HEAD）；归因 chip 与 Conversation「查看更改」行依赖引擎 `onDidFileMutation` join（R3 / R4 @ HEAD；历史会话经 G-REV-1 `file_mutation` 走同一事件）。**无** review comment、approve、写回引擎或 git。

## 5. 与 PRD-005 验收的对应

| 验收 | 落点 |
|------|------|
| 1 Files 只读投影；Explorer 仍是权威 | §2 Files · §4 |
| 2 stage / unstage / commit 走 SCM 提供者命令 | §2 Changes · `sourcesChangesGit.ts` |
| 3 Diff 归 PRD-009 | §4 |
| 4 Review 无假评审；无 SCM 时诚实空 | §3 |

## 6. 测试与验证

`contrib/sources/test/browser/`：`sourcesTabs`、`sourcesFilesModel`、`sourcesFilesList`、`sourcesFilesListStrings`、`sourcesFilterModel`、`sourcesChangesModel`、`sourcesChangesList`、`sourcesChangesGitRead`、`sourcesReviewModel`、`sourcesReviewListStrings`、`sourcesReviewProgress`、`sourcesReviewList`、`sourcesReviewShowForPaths`。
