---
title: "Sources Changes → 文件级 Diff：默认 Preview，可移对话窗口 / 底部"
type: plan
status: accepted
phase: N/A
updated: 2026-09-02
summary: "PRD-009 实施：Changes/Review 行 → Preview Diff；ConversationDiffReviewInput 只读审阅 tab（围栏白名单第二类）；Panel 产品 Diff 视图重宿主；默认归属设置；切片 F1–F5"
---

# Sources Changes → 文件级 Diff

> **决策**：[ADR-005](../decisions/005-changes-diff-owner.md)（`accepted` @2026-09-02）。  
> **需求**：[PRD-009](../../docs/product/requirements.md#prd-009-changes-与-diff)（`accepted`）；修正 [PRD-016](../../docs/product/requirements.md#prd-016-conversation-session-窗口与-chat-tab)「文件仍在右边 Preview」的唯一例外。  
> **不推翻**：[ADR-002](../decisions/002-conversation-session-windows.md) 围栏 / 关闭拦截器 / A3 聚合豁免；INV-052-NO-DUAL-HIDE；四钮无 Panel 钮。  
> **审查记录**：用户 2026-09-02 明示免除规则 16 只读审查（「你定就行 不需要其他 review」）。本方案直接 `accepted`；切片按下表开。

## 0. 目标与非目标

**目标**：用户从 Sources Changes / Review 点一行，Diff 在 Preview 打开；每个已打开的 Diff 能被用户显式「移到对话窗口」「移到底部」「移回 Preview」；用户可设默认归属。对话窗口里的 Diff 只读审阅，不编辑正文。

**非目标**（本方案不做）：

| 不做 | 原因 |
|------|------|
| Sources Changes 内嵌 inline diff（ADR-047 保留约束） | ADR-005 拒绝 C |
| Panel 区第三个 EditorPart / tab 拖进 Panel | ADR-005：Panel 走重宿主 |
| 「Agent 改过的文件」按回合归因 | 依赖 PRD-008 |
| multi-diff（整批变更一页） | 后续切片；本方案单文件 Diff |
| 对话窗口内可写 Diff | A3 聚合豁免绕过脏编辑器确认 / hot exit |
| 改 `extensions/git` | 原始内容 URI 走 workbench `IQuickDiffService`，不碰扩展 |

## 1. HEAD 事实（实施起点）

| 事实 | 位置 |
|------|------|
| Changes / Review 行点击：有 `scmResource` 走 `ISCMResource.open()`（git 扩展 `vscode.diff` → 主 `EDITOR_PART` `DiffEditorInput`）；否则 `openEditor(resource, ACTIVE_GROUP)` 开普通文件 | `contrib/sources/browser/sourcesChangesList.ts` `openSourcesChangeEntry` |
| 围栏：`isBlockedFromConversationGroup` 对一切非 `ConversationChatInput` 返回 true；`handleGroupResult` 把被拦 input 改落 `mainPart.activeGroup` | `contrib/conversation/common/conversationEditorRouting.ts` · `services/editor/common/editorGroupFinder.ts` |
| Conversation EditorPart：`excludeFromGlobalEditorAggregation = true`；`allowDropIntoGroup: false`；`showTabs` 由 editor 数决定 | `browser/parts/editor/conversationEditorPart.ts` |
| 「关闭根以外全部 tab」与 `closeChildOnBack` 都按 `instanceof ConversationChatInput && !isDefaultRoot` 判定 | `conversationSessionChatService.ts` `closeNonRootTabs` · `conversationNavigationService.ts` |
| EditorPane 注册模式：`registerEditorPane(descriptor, [SyncDescriptor(Input)])` + `registerEditorSerializer` | `contrib/conversation/browser/conversationEditor.contribution.ts` |
| 原始内容 URI：`IQuickDiffService.getQuickDiffs(uri)` → `QuickDiff.originalResource`（provider 中立） | `contrib/scm/common/quickDiff.ts` |
| stage / unstage 走 `git.stage` / `git.unstage` 命令 | `contrib/sources/common/sourcesChangesGit.ts` |
| Panel 互斥：`enforceAgentShellVisible` 只看 Conversation / Editor / Sources 三 part；Panel maximize 期间跳过 | `browser/layout.ts` |
| 设置注册模式 | `contrib/conversation/common/conversationNavigation.ts` |

## 2. 形态

### 2.1 一个 change 引用，三种宿主

```text
ISourcesChangeRef { modified: URI; original: URI | undefined; groupId: string; scmResource?: ISCMResource }
        │
        ├─ Preview（默认）      → 主 EDITOR_PART 标准 DiffEditorInput（可写 modified 侧，HEAD 习惯不变）
        ├─ 对话窗口            → ConversationDiffReviewInput（只读）→ CONVERSATION_GROUP 延伸 tab
        └─ 底部                → Panel 视图 SourcesDiffPanelView 内嵌 DiffEditorWidget（readOnly）
```

`original` 由 `IQuickDiffService.getQuickDiffs(modified)` 取第一条 `originalResource`；没有 quick diff（未跟踪 / 无 SCM）时 `original = undefined`，对话窗口与底部显示「新文件，无对照版本」并直接渲染 modified 只读；Preview 退回普通 `openEditor`（HEAD 行为）。

### 2.2 `ConversationDiffReviewInput`（新，`contrib/sources/browser/conversationDiffReviewInput.ts`）

- scheme `conversation-diff-review`，path 编码 `modified` + `original`；`typeId` `workbench.editors.conversationDiffReviewInput`。
- `capabilities`：`Readonly`；**不**声明 `CannotClose`；不实现 dirty。
- `matches`：按 `modified.toString()` 相同视为同一 tab（防同文件重复开）。
- EditorPane `ConversationDiffReviewPane`：内嵌 `DiffEditorWidget`（`readOnly: true`、`originalEditable: false`、`renderSideBySide` 跟随 `diffEditor.renderSideBySide`）。顶栏动作：**Open in Preview**（`openEditor(DiffEditorInput, ACTIVE_GROUP)` 落主 part）· **Stage / Unstage**（复用 `git.stage` / `git.unstage`，按 `groupId` 用 `isSourcesChangeStageable/Unstageable`）· **Discard changes**（`git.clean`，走 vscode 原确认对话框，不自造）· **Move to Panel**。
- 序列化：`IEditorSerializer` 存两 URI；恢复时若文件已无变更仍恢复（内容由 `ITextModelService` 解析，失败则显示诚实空「对照版本已不存在」）。

### 2.3 围栏放宽（`conversationEditorRouting.ts`）

```text
isBlockedFromConversationGroup(input):
  ChatEditorInput                       → true（不变）
  ConversationChatInput                 → false（不变）
  ConversationDiffReviewInput           → false（新：白名单第二类）
  其它 EditorInput / resource           → true（不变）
```

- 白名单只判 **input 类型**，不判「谁打开」：默认路径不会构造 `ConversationDiffReviewInput`，所以 ADR-002 围栏第 4 条（焦点在 Conversation 时打开文件仍进 Preview）自然成立；不需要在 finder 里加「显式动作」标志。
- 新增共享谓词 `isConversationExtensionTab(input)` = `(ConversationChatInput && !isDefaultRoot) || ConversationDiffReviewInput`；`closeNonRootTabs`、`countCloseableNonRootTabs`、导航服务 `closeChildOnBack` 与 `applyConversationPartOptions` 的 `showTabs` 计数统一改用它。
- `ConversationDiffReviewInput` 要求目标为 Conversation 组：非 `CONVERSATION_GROUP` / 非 Conversation 组时 finder 抛错（与 `ConversationChatInput` 同分支），不静默掉进 Preview。

### 2.4 Panel 产品 Diff 视图（`contrib/sources/browser/sourcesDiffPanel.ts`）

- `ViewContainerLocation.Panel` 注册 ViewContainer `workbench.view.sourcesDiff`（标题 "Diff"），单视图 `SourcesDiffPanelView`；`hideIfEmpty: true`，无 change 时容器不出现在 Panel tab 条。
- 视图内：顶部一行文件名 + 与 2.2 相同的动作组（Open in Preview · Stage / Unstage · Discard · **Move to Conversation**），下方 `DiffEditorWidget` readOnly。一次只承载一个 change（重开即替换）。
- 「移到底部」：`closeEditor(当前 Diff tab)` → `sourcesDiffPanelService.show(changeRef)` → `viewsService.openView(id, focus)`。Panel 因此显示是用户动作；不改 `enforceAgentShellVisible`。
- 不触碰 `SOURCES_PART` 高度（ADR-047 保留：不自动撑开已收起下格）。

### 2.5 「移到…」动作与默认归属

| 动作 ID | 出现位置 | 行为 |
|---------|----------|------|
| `sources.diff.moveToConversation` | Preview Diff tab 右键 / 编辑器标题菜单（`when: resourceScheme == 'file' && isInDiffEditor`）；Panel 视图顶栏 | 关当前宿主 → `openEditor(ConversationDiffReviewInput, CONVERSATION_GROUP)` |
| `sources.diff.moveToPanel` | Preview Diff tab 菜单；对话窗口审阅 pane 顶栏 | 关当前宿主 → Panel 视图 show |
| `sources.diff.moveToPreview` | 对话窗口审阅 pane 顶栏（即 Open in Preview）；Panel 视图顶栏 | 关当前宿主 → `openEditor(DiffEditorInput, ACTIVE_GROUP)` |

设置 `sources.diff.defaultOwner: 'preview' | 'conversation' | 'panel'`（默认 `preview`），注册在 `contrib/sources/common/sourcesDiffConfiguration.ts`。**只**影响 `openSourcesChangeEntry`（Changes / Review 行点击）；SCM 视图、`git.openChange`、扩展 `vscode.diff` 不读该设置，保持 vscode 习惯。

`openSourcesChangeEntry` 改为：解析 `ISourcesChangeRef` → 按 `defaultOwner` 分派；`preview` 分支保持 HEAD 路径（`scmResource.open()` 优先），保证不回归。

### 2.6 tab 拖动

Conversation EditorPart 现为 `allowDropIntoGroup: false`。本方案 **不**放开拖动（与 Modal 同姿态）；「移到…」只走命令 / 菜单。若后续要拖，另开切片并补 drop 侧围栏。

## 3. 切片

| ID | 名称 | 内容 | 验收（单测 / 冒烟） |
|----|------|------|---------------------|
| **F1** | 审阅 input + 围栏白名单 | `ConversationDiffReviewInput` / `ConversationDiffReviewPane` / serializer；`isBlockedFromConversationGroup` 第二类白名单；`isConversationExtensionTab` 谓词并替换 `closeNonRootTabs` / `countCloseableNonRootTabs` / `closeChildOnBack` / `showTabs` 计数 | `conversationEditorRouting.test.ts`：审阅 input 不被拦、普通文件 / `ChatEditorInput` 仍被拦；`editorGroupFinder` 测：焦点在 Conversation 时 `openEditor(file)` 与 `SIDE_GROUP` 仍进 main，`CONVERSATION_GROUP` + 文件仍改落 main，`CONVERSATION_GROUP` + 审阅 input 进 Conversation 组，审阅 input 无点名抛错；`conversationSessionChat.test.ts`：`closeNonRootTabs` 关掉审阅 tab、根 tab 仍在；`conversationNavigation.test.ts`：后退关掉审阅 tab；`conversationEditorAggregation.test.ts`：审阅 tab 不进 `IEditorService.editors` |
| **F2** | Changes 行 → Diff + 默认归属 | `ISourcesChangeRef` + `IQuickDiffService` 取 original；`sources.diff.defaultOwner` 设置；`openSourcesChangeEntry` 三分派（`preview` 分支等价 HEAD）；三条 `sources.diff.moveTo*` 命令 + Preview Diff 标题菜单项 | `sourcesChangesModel.test.ts`：ref 解析、无 quick diff 时 `original=undefined`；`openSourcesChangeEntry` 测：默认落 `ACTIVE_GROUP`、`conversation` 时以 `CONVERSATION_GROUP` 打开审阅 input、无 original 时 preview 退回普通 `openEditor`；冒烟 V-F2：点 Changes 行 → Preview 出 Diff，Conversation / Sources 显隐不变，Panel 不弹 |
| **F3** | Panel 产品 Diff 视图 | ViewContainer + `SourcesDiffPanelView` + `ISourcesDiffPanelService`（`show(ref)` / `clear()`）；`moveToPanel` / 视图顶栏 `moveToConversation` / `moveToPreview` 往返 | 视图单测：`show` 后 `hideIfEmpty` 解除、`clear` 后容器隐藏；冒烟 V-F3：Preview → Panel → Conversation → Preview 一圈，每步只剩一个宿主有该 Diff；Panel 显示后四钮状态不变；隐藏 Panel 不触发 `enforceAgentShellVisible` 改动其它 part |
| **F4** | D4 式隔离 profile 验收 | 复用 `dev/progress/d4-evidence/*/run-v1-v8.sh` 模式加 V-F1–V-F5（见 §4）；证据目录 `dev/progress/d4-evidence/diff-<sha>/` | 五条全 PASS；`npm run compile` 绿；相关域单测绿 |
| **F5** | 知识层 | `parts-and-grid` §5 插入面表加「`ConversationDiffReviewInput` 经显式动作进 Conversation 组」一行、INV-TOPO 推论「文件永远进 Preview」加例外句；`editor-part-tabs` §4 围栏句；`companion-contribs` §5 表「本仓今天」列更新；`agent-ui` Sources 行「Diff 深查看 … 未接线」改为已落；`traceability` PRD-009 证据列 | `check-docs-health.py` 0 error；本仓新增 warning 0 |

依赖：F1 → F2 → F3 → F4 → F5。F1 与 F3 可并行（F3 不依赖围栏），但 F3 的「Move to Conversation」要等 F1。

**工位冲突域**：F1 触 `conversationEditorRouting.ts` / `conversationSessionChatService.ts` / `conversationNavigationService.ts`（与 R5 引擎 adapter 不重叠）；F5 触 `parts-and-grid.md` / `agent-ui.md`（当前有其它工位未提交改动，F5 须在其落地后再做）。

## 4. 冒烟脚本（F4）

| ID | 场景 | 断言 |
|----|------|------|
| V-F1 | fresh profile，有 git 变更的 sample workspace；点 Changes 第一行 | 主 `EDITOR_PART` active editor 是 diff（`isInDiffEditor`）；`conversation` / `sources` 可见性与点击前相同；`panel` false |
| V-F2 | 对该 Diff 执行 `sources.diff.moveToConversation` | 主 part 无该 diff；Conversation 组 editor 数 = 2（根 + 审阅）；根 tab 无关闭钮；审阅 pane `readOnly`；`IEditorService.editors` 不含审阅 input |
| V-F3 | Conversation 后退（`closeChildOnBack` 默认 true） | 审阅 tab 关闭；根 tab 仍在；`conversation` 仍 true |
| V-F4 | 重新移入 → `sources.diff.moveToPanel` → `moveToPreview` | 每步恰一个宿主持有该 Diff；Panel 出现在 moveToPanel 后、moveToPreview 后 Panel 视图为空且容器隐藏；四钮状态全程不变 |
| V-F5 | `sources.diff.defaultOwner = conversation` 后点 Changes 行；再切 `panel` 点一行 | 分别直接进 Conversation 组 / Panel 视图；`git.openChange` 命令仍落主 part |
| V-F6 | 焦点在 Conversation 审阅 tab 时 Ctrl+P 打开文件 | 文件进主 `EDITOR_PART`，Conversation 组 editor 数不变 |
| V-F7 | 无 git 仓库 workspace | Changes 空态 "No source control repository."；无假变更；`defaultOwner=conversation` 时无行可点、Conversation 组仍只有根 |

## 5. 风险

| 风险 | 处理 |
|------|------|
| `IQuickDiffService` 对某些 provider 返回多条 quick diff（如 git + 其它扩展） | 取 `id === 'git'`（或 `isSCM`）优先，否则第一条；测试覆盖 |
| 审阅 pane 用 `ITextModelService.createModelReference(original)` 需 git 扩展的 `git:` 内容 provider 已激活 | 点 Changes 行时 SCM 已有资源 → provider 必已激活；恢复态（重启）若 provider 未就绪显示诚实空并重试一次 |
| `showTabs` 计数改用共享谓词后，根 + 1 审阅 = 显示 tab 条 | 与 fork 延伸 tab 行为一致；无额外 UI |
| 用户在 Preview 手动把两个 Diff 都移进 Conversation | 允许多张审阅 tab；`matches` 按 modified 去重同文件 |
| A3 豁免：审阅 tab 不进工作集 / hot exit | 只读无丢失；重启靠 serializer 恢复 |
| Panel 视图与扩展 Panel 视图（D9 待实测）并存 | F4 顺带把 `viewsContainers.panel` 探针行改「已实测」，闭 D9 一行 |
| `git.clean` 是破坏性操作 | 沿用 git 扩展自带确认，不加第二层；不在审阅 pane 里做批量 discard |

## 6. 验收勾选（勿提前通过）

- [ ] F1 单测绿；围栏三向测试（file / ChatEditorInput / 审阅 input）
- [ ] F2 Changes 行默认落 Preview Diff；设置三态分派
- [ ] F3 Panel 视图往返
- [ ] F4 V-F1–V-F7 隔离 profile 证据
- [ ] F5 知识层四页 + traceability；`check-docs-health` 0 error
- [ ] PRD-009 → `implemented`（须 F4 证据）

## 相关

- [ADR-005](../decisions/005-changes-diff-owner.md) · [PRD-009](../../docs/product/requirements.md#prd-009-changes-与-diff)
- [conversation-session-windows](conversation-session-windows.md) §3.2 围栏 / §3.8 A3
- [companion-contribs §5](../../docs/systems/workbench/companion-contribs.md) · [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md)
- [deferred-gaps D9](../progress/deferred-gaps.md)
