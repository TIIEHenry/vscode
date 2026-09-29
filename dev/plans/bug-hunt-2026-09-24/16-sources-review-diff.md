---
title: "Review 写请求钉住打开时的会话，搬家只动本宿主，迁移先留住目标文件"
type: plan
status: accepted
phase: M7
updated: 2026-09-29
summary: "Accept/Stage 只用打开时的 sessionId；面板搬家不用活动编辑器；迁移先确认再整份替换。2026-09-28：S1 的会话值改由变更模型条目拷入；S4 的测试放进 sources-architecture P5。2026-09-29：S2、S3、S5 已在槽 A 落地，状态仍为 accepted。"
---

# Review 写请求钉住打开时的会话，搬家只动本宿主，迁移先留住目标文件

> **本稿是方案，不是实施。**
> **冲突域：** `src/vs/workbench/contrib/sources/` 下文件名含 Review、Diff、conversationDiff 的生产文件，以及 `src/vs/workbench/contrib/universeAgentMigration/common/codeOssMigration.ts` 与 `src/vs/workbench/contrib/universeAgentMigration/electron-browser/universeAgentMigration.contribution.ts`。
> **不改** `sourcesChanges/`、`sourcesFiles/`（另一路 15）。
> 与 [sources-review-open-identity](../sources-review-open-identity.md) 重复的 Panel 完成信号只交叉引用，不另起实施切片。

## 核查

对照 [扫描文](../../progress/bug-hunt-2026-09-24/16-sources-review-diff.md) 与 HEAD。

| 条目 | 判定 | 理由 |
|:-----|:-----|:-----|
| BH-16-1 | 成立 | `getGitSessionId`（`conversationDiffReviewPane.ts` 约 298 行、`sourcesDiffPanelView.ts` 约 405 行）读 `roster.getActiveSessionId()`。`runAccept` / `runStage` 在点击时调用它。补丁来自输入或 `currentRef` 上的 `unifiedDiff`。活动会话变化会 `updateReviewActions` / `updateWriteActions`，按钮还在。`sourcesGitApplyHunksRequest` / `sourcesGitStagePathsRequest` 原样带上这个 `sessionId`。 |
| BH-16-2 | 成立 | `copyIfExists` 约 94 行 `fileService.copy(..., true)`。`FileService.doMoveCopy` 约 826–828 行在覆盖时先 `del` 目标再写入。`runMigrateFromCodeOss` 约 54–55 行不看目标是否已有 `settings.json`。允许列表三条都走这条覆盖。拷贝在删除之后失败时，目标已经不在。 |
| BH-16-3 | 成立 | `resolveActiveSourcesChangeRef` 约 98–111 行：活动编辑器能解析成 diff 就用那份，`getCurrentRef()` 只在其后。ViewTitle 与 EditorTitle 共用 `moveActiveDiffToConversation` / `moveActiveDiffToPreview`（`sourcesDiffActions.ts` 约 41–50、96–105 行）。`closeActiveDiffHost` 先关活动编辑器。面板上的另一份 ref 留下。 |
| BH-16-4 | 成立 | `show` 约 39–43 行先 `set(true)` 再 `fire` 再 `openView`。视图 `when` 是 `ctxHasChange`，上下文变化同步加视图。正文未就绪时 `renderRef` 约 303–308 行 `settle(..., false)`。`finally` 约 370–372 行用 `loadedOk` 收尾；世代被抢时约 330–332 行早退，`loadedOk` 仍是 false。`watch` 只采纳第一次 settle。`openSourcesChangeEntry` 约 57–60 行因此抛出 Unable to load this comparison，已审标记不会打上。不另起切片，见 [sources-review-open-identity](../sources-review-open-identity.md) S1。 |
| BH-16-5 | 成立 | `tryLoadGitEntries` 返回后约 711 行已有 `refreshSeq` 检查，停在 git 读取里的旧轮次不会走到 prune。洞在 `ensureEntryKeys`：约 436–444 行 await 之后无条件换 `entryKeys` 并 `pruneMissingKeys`。`refresh` 约 770–772 行在这次 prune 之后才看序号，过期则 return，不把列表画回去。慢的 `resolveKey` 窗口里，后完成的旧轮次会删掉新轮次已记下的已审键。 |
| BH-16-6 | 成立 | `updatePathFilterBanner` 约 537 行把 `pathFilter.length` 填进 Showing {0} files from this turn。`filterReviewEntries` 约 20–22 行按 URI 交集过滤列表。选中路径多于对得上的变更时，横幅数字大于可见行数。 |

## Problem class

- **症状：** 会话切走后 Accept / Stage 把打开时那份补丁或路径写进当前活动会话；面板标题搬家关的是编辑器里另一份 diff；命令面板迁移盖掉已有设置，拷贝失败后目标文件没了；Review 横幅按选中路径计数，已审圆点会被过期刷新清掉。Panel 第一次打开被记成失败属于已有打开身份方案。
- **类标签：** **点击时再读活动会话** + **面板标题借用活动编辑器** + **覆盖先删目标** + **过期刷新写回已审集合** + **横幅用输入长度当可见行数**。
- **复发机制：** 写请求的 `sessionId` 与补丁不在同一次打开时钉死；搬家函数不区分菜单宿主；`copy(..., true)` 把平台的先删后写当成迁移的替换；`refreshSeq` 放在 prune 之后。

## 0. 一句话结论

Accept / Stage 只用打开 diff 时记下的 `sessionId`，活动会话已变就拒绝并提示，不发写请求。ViewTitle 搬家只取面板 `getCurrentRef()`，EditorTitle 才取活动编辑器。迁移在目标已存在时先确认；先把来源拷到临时位置，成功后再换成目标，失败则目标仍是原文件。已审 prune 只允许当前 `refreshSeq` 做。横幅数字用过滤后的可见行数。Panel 完成信号沿用 [sources-review-open-identity](../sources-review-open-identity.md) S1，本稿不另起切片。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 两处 `getGitSessionId` 都是 `roster.getActiveSessionId()` | `conversationDiffReviewPane.ts`；`sourcesDiffPanelView.ts` |
| 活动会话、连接变化会刷新 Accept / Stage 可见性，不关掉已打开的 diff | 同上 `onDidChangeActiveSession` / `onDidChangeConnection` |
| Accept 补丁来自 `sourcesGitApplyHunksPatches`（输入或 ref 的 `unifiedDiff` / WeakMap），不是来自当前会话 | `sourcesChangeRef.ts`；两处 `getApplyHunksPatches` |
| Stage 路径来自打开时的 modified / SCM，`sessionId` 仍是点击时的活动会话 | `runStage`；`sourcesDiffLocalWritePath` |
| `sourcesGitApplyHunksRequest` / `sourcesGitStagePathsRequest` 原样放入 `sessionId` | `sourcesChangesGitWrite.ts` |
| 空 session 或空 patches 不调 Apply hook；Stage 空 session 不调 hook | `hasSourcesGitApplyHunksPayload`；`canSendSourcesGitStagePaths` |
| 允许列表只有 `settings.json`、`keybindings.json`、`snippets/` | `codeOssMigration.ts` `MIGRATION_PROFILE_FILES` / `MIGRATION_PROFILE_DIRECTORIES` |
| `copyIfExists` 固定 `overwrite: true`；命令入口不读 `getDestSettingsResource` | `copyIfExists`；`runMigrateFromCodeOss` |
| 覆盖拷贝在写入前 `del(target, { recursive: true })` | `fileService.ts` `doMoveCopy` |
| 一次性提议看目标是否已有 settings；命令面板不看 | `shouldOfferCodeOssMigration`；`maybeOffer` |
| 搬家解析先活动编辑器 diff，再面板 ref | `sourcesDiffRefHelpers.ts` `resolveActiveSourcesChangeRef` |
| 现有测把「编辑器是 diff 时搬家走编辑器、不是 diff 才走面板」锁成绿 | `sourcesDiffRefHelpers.test.ts` |
| `show` 先改上下文并 `fire`，再 `await openView` | `sourcesDiffPanelService.ts` |
| 正文未就绪 settle false；世代不符的 `finally` 也 settle false；watch 只取第一次 | `sourcesDiffPanelView.ts` `renderRef` / `settleSourcesDiffPanelComparison` |
| Panel 打开失败抛 `sourcesDiffPanelComparisonLoadFailedMessage`，throw 则不标已审 | `sourcesChangeEntryOpen.ts`；`markReviewedAfterSuccessfulOpen` |
| 该完成信号已由打开身份方案占住 | [sources-review-open-identity](../sources-review-open-identity.md) S1 |
| git 读取返回后有序号检查；`ensureEntryKeys` 在 await 后 prune；序号检查在 prune 后 | `sourcesReviewList.ts` `refresh` / `ensureEntryKeys` |
| `pruneMissingKeys` 删掉不在本次集合里的已审键并 `onDidChange` | `sourcesReviewProgressService.ts` |
| 横幅 `{0}` 是 `pathFilter.length`；列表是 URI 交集 | `updatePathFilterBanner`；`filterReviewEntries` |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 打开时钉 sessionId；ViewTitle 只用面板 ref；迁移先确认再整份替换；prune 前对序号；横幅用可见行数** | 见 §3 | **选定** |
| B 切会话就关掉已打开的 diff | 用户还在看的对比消失 | **拒绝** |
| C 写请求改走「当前活动会话的补丁」而不是打开时那份 | 屏幕上的 hunk 与写入内容再次分叉 | **拒绝** |
| D 发明新的写 RPC 或给 `sessionId` 加「来源会话」字段 | 请求形状已有 `sessionId` | **拒绝** |
| E 迁移始终静默覆盖，只在失败时提示 | 目标里多出来的设置和 snippets 仍会被换掉 | **拒绝** |
| F 重做 Panel 完成信号 / 再分配一套 generation | 与打开身份 S1 重复 | **拒绝。** 只交叉引用 |
| G 横幅改成只写「本回合路径」但不给出过滤后行数 | 用户仍无法对上列表 | **拒绝** |

## 3. 选定设计（A）

1. **S1 写请求钉住打开时的 sessionId（BH-16-1）。** 不变量：Conversation Diff 在 `setInput` 成功进入可写态时记下 `roster.getActiveSessionId()`；Diff Panel 在 `renderRef` 对**这一份** `ref` 画到可写态时记下。记在这次输入 / 这次 `currentRef` 旁，不进 `matches()`。

   **2026-09-28：** 记下的值改为打开时从变更条目拷入的 `sessionId`（[sources-architecture](../sources-architecture.md) P3）。`setInput` / `renderRef` 不再为了填这个字段调用 `getActiveSessionId()`。点击时与活动会话不一致则拒绝，这条不变。`runAccept` / `runStage` 只读这份。点击时 `getActiveSessionId()` 与记下的值不同，或记下的值为空：不调用 `tryWriteSourcesGitApplyHunks` / `tryWriteSourcesGitStagePaths`，也不走其后的 `git.stage` 回退；notice 说明会话已变。相同则原样传入现有 `sessionId` 参数。补丁与路径仍来自打开时的输入 / ref。活动会话变化仍可 `updateReviewActions` / `updateWriteActions`，但可见的 Accept / Stage 在会话不符时不得发出写请求。
2. **S2 迁移先留住目标（BH-16-2）。** 不变量在 `copyIfExists` 与 `runMigrateFromCodeOss`。确认扫描包括这次会写到的每一个 profile home：默认 `User/` 以及 `migrateCodeOssUserData` 对 `User/profiles/<id>/` 再跑的同一允许列表。任一这些目标已存在才询问；取消则零拷贝。只查默认 `User/` 下三个路径不算确认。
   确认后（或目标不存在）的顺序：把来源写到目标目录**之外**的临时文件；这一步失败则目标原文件保持不动，临时文件删掉。临时文件完整之后再换成目标。换成不得调用 `fileService.copy` / `move` 且 `overwrite: true`（`doMoveCopy` 约 826–828 行会先 `del`）。换成失败时，目标路径上仍是替换前的字节。禁止在来源尚未完整落到临时文件时就去掉目标。`snippets/` 按目录整份替换，不合并。允许列表不变。`shouldOfferCodeOssMigration` 的提议条件不改。
3. **S3 搬家按菜单宿主取 ref（BH-16-3）。** `sourcesDiffActions.ts` 的 Move to Conversation / Open in Preview 各有一个 `run()`，菜单 id 不在参数里。两个命令改成显式宿主参数：`moveActiveDiffToConversation(host)` / `moveActiveDiffToPreview(host)`，`host` 为 `'viewTitle' | 'editorTitle'`。ViewTitle 的菜单项传入 `'viewTitle'`，只读 `sourcesDiffPanelService.getCurrentRef()`，没有则返回。EditorTitle 的菜单项传入 `'editorTitle'`，只走 `resolveSourcesChangeRefFromEditor`。禁止两处继续共用无宿主的 `resolveActiveSourcesChangeRef`。`closeActiveDiffHost` 只关闭本次选中的那一宿主：选的是面板就 `clear()`，选的是编辑器才关活动编辑器。`moveActiveDiffToPanel` 仍从活动编辑器取 ref。groupId 优先序留在 [sources-review-open-identity](../sources-review-open-identity.md) S2，本稿不改 `findScmResourceForUri`。
4. **BH-16-4 不另起切片。** 正文未就绪不得 settle；被新一代取代的渲染不得把 watch 收成失败；`show()` resolve 不等于加载成功。这些属于 [sources-review-open-identity](../sources-review-open-identity.md) S1 的 Panel 完成信号。本稿不改 `renderGeneration` 的分配方式，不增加第二条完成事件。
5. **S4 过期刷新不得 prune（BH-16-5）。** 不变量：`ensureEntryKeys` 在开始 await 之前和写回 `entryKeys` / 调用 `pruneMissingKeys` 之前都读 `refreshSeq`。与进入时的序号不同则直接返回，不 `clear`、不 prune。`refresh` 在 await 之后的现有检查保留。约 711 行 git 读取后的检查保持，不把那一窗口再修一遍。

   **2026-09-28：** 这条过期轮次约束的测试放进 [sources-architecture](../sources-architecture.md) P5。P5 同时把清理收成「同一会话、同一来源、读成功」的那一桶，并停掉无已审记录时的整表 `stat`。不要只加序号判断、把换会话的成功读继续拿来清空全部已审。
6. **S5 横幅用可见行数（BH-16-6）。** 不变量：`updatePathFilterBanner` 的 `{0}` 等于 `filterReviewEntries` 在同一 `allEntries`、同一文本过滤、同一 `pathFilter`、`unreviewedOnly === false` 下的长度。路径过滤为空时横幅仍隐藏。文案键 `sourcesReviewList.pathFilterCount` 保留，只改填入的数字。

## 4. 不做

- 改 `sourcesChanges/`、`sourcesFiles/`
- 另起 Panel 加载世代或改写 [sources-review-open-identity](../sources-review-open-identity.md) S1
- 改 `findScmResourceForUri` 的 groupId 优先序（该方案 S2）
- 切会话时关闭已打开的 diff
- 发明写协议字段或新的 Apply / Stage RPC
- 合并 snippets，或拷贝 `globalStorage` / `state.vscdb` / `workspaceStorage`
- 改 `shouldOfferCodeOssMigration` 的一次性提议条件（`maybeOffer` 先写 `universeAgent.migration.offered` 仍不是丢数据）
- 重开 GitHub Actions

## 5. 验证

本地、点名现有文件。门禁沿用 [health-gates](../../progress/health-gates.md)：`scripts/test.sh` 点名下表。不跑托管 CI。

| 切片 | 现有测试 | 要加的断言 |
|:-----|:---------|:-----------|
| S1 | `src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts`（已挂 `ConversationDiffReviewPane` 与 `SourcesDiffPanelView` 的 `runAccept`） | 打开时 session 为 A，点击前活动会话变为 B：`writeGitApplyHunks` / `writeGitStagePaths` 不被调用，notice 出现。活动会话仍是 A：请求里的 `sessionId` 是 A，补丁或路径仍是打开时那份 |
| S2 | `src/vs/workbench/contrib/universeAgentMigration/test/common/codeOssMigration.test.ts` | 目标已有 `settings.json` 与仅存在于目标的 `snippets` 文件：未确认时目标字节不变。确认后先有完整临时副本，替换成功后目标等于来源、目标多出的 snippet 不保留。临时拷贝失败时目标原文件仍可按原内容读到 |
| S3 | `src/vs/workbench/contrib/sources/test/browser/sourcesDiffRefHelpers.test.ts`（`move falls back to panel when focused editor is not a diff` 与编辑器 diff 优先的用例） | 活动编辑器是文件 A 的 diff、面板是文件 B：ViewTitle 搬家关掉并送走的是 B，A 的编辑器还在。EditorTitle 仍送走 A。须改写今日锁住「只要活动编辑器是 diff 就不用面板」的断言 |
| BH-16-4 | 不在本稿加断言。完成信号的用例留在 [sources-review-open-identity](../sources-review-open-identity.md) S1 点名的 `sourcesReviewList.test.ts` / `sourcesWiringScan.test.ts` | — |
| S4 | `src/vs/workbench/contrib/sources/test/browser/sourcesReviewList.test.ts`（`ensureEntryKeys keeps prior keys while resolveKey is pending`） | 旧 `refresh` 停在 `ensureEntryKeys` 的 await 时，新 `refresh` 先完成并 `markReviewed`；旧轮次恢复后该键仍在，`pruneMissingKeys` 未删它，列表进度不被旧轮次画回去 |
| S5 | `src/vs/workbench/contrib/sources/test/browser/sourcesReviewList.test.ts`（`filterReviewEntries` 路径用例） | `pathFilter` 5 条、交集 1 行时横幅 `{0}` 为 1，列表长度 1 |

## 6. 实施注记（2026-09-29，槽 A）

状态仍是 **accepted**。本注记只覆盖 S2、S3、S5。S1 不在本切片（会话值由 [sources-architecture](../sources-architecture.md) P3 从变更条目拷入）。S4 不在本切片（测试在 sources-architecture P5）。

- **S2：** `findExistingMigrationTargets` 扫描默认 `User/` 以及来源中的 `User/profiles/<id>/`，允许列表仍是 `settings.json`、`keybindings.json`、`snippets/`。任一目标已存在且未确认时，`migrateCodeOssUserData` 返回 0，不拷贝。`runMigrateFromCodeOss` 在拷贝前确认；取消则直接返回。确认后传入 `confirmOverwrite: async () => true`。`copyIfExists` 先把来源拷到目标目录之外的临时目录并核对整棵树，再用 `move(..., false)` 换成目标，不调用 `overwrite: true`。`snippets/` 整份替换。临时拷贝失败则删掉临时文件，目标字节不动。`shouldOfferCodeOssMigration` 未改。
- **S3：** `moveActiveDiffToConversation(host)` / `moveActiveDiffToPreview(host)`，`host` 为 `'viewTitle' | 'editorTitle'`。ViewTitle 与 EditorTitle 拆开注册。ViewTitle 只读 `getCurrentRef()`，没有则返回，关闭时只 `clear()`。EditorTitle 只走 `resolveSourcesChangeRefFromEditor`，关闭时只关活动编辑器。`moveActiveDiffToPanel` 仍从活动编辑器取 ref。无宿主的 `resolveActiveSourcesChangeRef` 已去掉。
- **S5：** `updatePathFilterBanner` 的 `{0}` 改为同一 `allEntries`、同一文本过滤、同一 `pathFilter`、`unreviewedOnly === false` 下 `filterReviewEntries` 的长度。路径过滤为空时横幅仍隐藏。文案键 `sourcesReviewList.pathFilterCount` 不变。未改 `writeSessionId` / `sourcesChangesWriteSessionId`。
