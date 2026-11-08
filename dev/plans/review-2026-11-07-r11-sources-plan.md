---
title: "十六路审查 2026-11-07 r11：contrib/sources 方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 5、weaken 0、drop 0；方案覆盖手动刷新卡死定时刷新、重画撤销收起状态、整文件 diff 上 Accept 按错坐标切 hunk、变更记录被挤掉后丢审阅标记、Review 选中在非标完场景被搬到无关行。2026-11-07 规则 16 只读审查后改稿：Accept 只对 Git 索引原文改用文件行坐标，审阅标记防重复，Review 保留 DOM 焦点交接，收起记录按资源根区分。同日已实施（未编译、未跑测试），代码审查可接受。"
---

# 十六路审查 2026-11-07 r11：contrib/sources 方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：PRD-005、PRD-009、PRD-023。r11-1、r11-2 对应 PRD-005 对 Changes 的陈述（顶部刷新；按分组和相对路径展开 / 收起）；r11-3 对应 PRD-009.3（接受光标所在的一块改动，即把它暂存进索引）；r11-4、r11-5 对应 PRD-023 的陈述（文件内容再变化时才回到未审阅；手动标记作用于用户选中的行）。本稿只修实现偏离这些陈述的地方，不新增需求，也不改这三条的状态。

只改下面五条，范围停在 `src/vs/workbench/contrib/sources/` 及其测试；实施时同步 `docs/systems/sources/overview.md` 里对应的句子，不改引擎、Git 扩展和打开路径。行号按 2026-11-07 改稿时的工作区（含他人未提交改动）核对，实施时按符号定位。实施前提、统一的本地验证顺序和行号对照写在五条之后。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r11-1 | hold | 中 | 见下文，对应 PRD-005。`sourcesChangesReadModel.ts` 没有未提交改动，95–98、126–144、180–182 行与稿一致。2026-11-03 的 `9966cf79734` 给 `runScheduledRefresh` 的收尾加了代次判断，手动 `refresh()` 推进代次却不收尾；`flushScheduledRefresh` 在生产代码里只被两个列表的 `refreshScheduler` 代理引用，代理只被 `void` 掉。`review-2026-10-16-architecture.md` 第 70 行只把这段记成手写的 Throttler，`architecture-2026-10-16-concrete.md` 第 98 行把引入 Throttler 列为不在本稿，没有已签收方案承接。测试只有两次手动刷新重叠（`a slower ReadGitChanges must not replace a newer snapshot after the fast read lands`），没有手动刷新与定时刷新重叠。 |
| r11-2 | hold | 中 | 见下文，对应 PRD-005。`rememberGroups`（`sourcesChangesList.ts` 1395–1440 行，来自 `b5ec35bd101`）在每次 `renderFromSnapshot`（1252 行）把不在「已展开」集合里的分组和目录加回去。已签收的 `sources-changes-idea-panel.md` 第 26 行要求「快照刷新后按 identity 保留仍存在的展开状态」，并要求节点身份含仓库 / 资源根；现码两条都不满足，目录 id（1413、1449 行）只有分组 id 和相对路径。overview 第 43 行只写收起后的锚点行为。测试里的收起用例都是收起后立即断言，或先重新展开再筛选，没有锁定重画后全部展开。 |
| r11-3 | hold | 高 | 见下文，对应 PRD-009.3。会话工作目录等于本地仓库根时，引擎行是 `file:` 资源、不带 `scmResource`；`resolveSourcesChangeRef` 取 Git 扩展 primary quick diff 的原文（`extensions/git/src/quickDiffProvider.ts` 第 74 行 `toGitUri(uri, '')`，即索引版本；`quickDiffService.ts` 40–51 行 primary 排第一），`needsSourcesGitFileDiff` 为假，打开的是整文件 diff。Accept 是否显示只看 kind、indexState、写路径和会话（Pane 495 行、Panel 522 行），切片却按 hunk 正文拼接行数（`sourcesGitHunkPatch.ts` 144–161 行）。Accept 测试的 hunk 用例全部用 `sources-git-diff:` 模型（`engineAcceptRef`）。`review-2026-10-24-r08-sources-navigator-plan.md` 的 r08-2 只处理 hunk 正文模型，本条承接整文件 diff。默认 owner 是 `preview`，靠未提交改动把身份带到 Preview 再移动（`sourcesDiffRefHelpers.ts` 45–54 行），或把 owner 设成 `conversation` / `panel` 即可走到；后果是把用户没选的那段写进索引。 |
| r11-4 | hold | 低 | 见下文，对应 PRD-023。`latestMutation` 是容量 1000 的 `LRUCache`（`sourcesReviewProgressService.ts` 94、97 行），只在 `set` 时更新新近度；记录被挤掉后 `engineContentHash` 返回空串，`ensureEntryKeys`（`sourcesReviewList.ts` 519–534 行）经 `noteRefreshedKey` 删掉已审标记。`sources-architecture.md` P5 验收（第 280 行）写的是「新的 `onDidFileMutation` 后变为未审」，被挤掉不是新变更。`bounded mutation retention evicts oldest entries when capacity is exceeded` 只断言 hash 变空。 |
| r11-5 | hold | 低 | 见下文，对应 PRD-023。`spliceKeepingFocus`（`sourcesReviewList.ts` 939–970 行，未提交；agent:gemini 正按 `ui-interaction-visual-review-2026-11-07.md` §5.2 第 5 项改写并加了 DOM 焦点交接）在焦点行离开非空列表时，不论原因都按旧下标设焦点，原本选中时也设选中（961–966 行）；换会话、文字筛选、行已提交都会走到，`getSelectedEntry()`（384–386 行）随后把这一行交给两条 F1 命令。未审阅模式下标完后选中跟过去，是未提交测试 `Unreviewed only moves list focus to the next row, or the previous one at the end, when an opened row is marked reviewed` 与 overview 第 33 行锁定的行为，方案保留这一种，只改其它原因；发现稿「不搬选中」的方向在这一种情形下不采用。 |

### r11-1

问题类：手动刷新推进了读取代次却不负责运行标记的收尾，与它重叠的定时刷新返回后 `refreshRunning` 永远停在真，之后所有排定的刷新都被吞掉，直到切换会话。

不变量：

- 定时、会话切换、手动三种来源的读取都由同一个运行方法发起；`refreshWithGeneration` 只由它调用。
- 任何一次读取结束时，如果它仍是最新代次，`refreshRunning` 回到假；被更新代次取代的读取结束时不动 `refreshRunning`，由最新那次收尾。
- 读取进行中到来的 `scheduleRefresh` 不丢：最新一次读取结束后，期间有过请求且模型未释放时，再排一次去抖读取，且只排一次。
- 只有最新代次能落快照，`land` 的代次判断不变。
- 手动刷新仍立即发读，不等去抖，也不等进行中的旧读取；旧读取的结果不落地。会话切换仍立即发读。

要动的符号：`SourcesChangesModel.refresh`（180–182 行）、`SourcesChangesModel.runScheduledRefresh`（126–144 行，可改名为统一的运行方法），字段 `refreshRunning`、`refreshAgain`、`readGeneration`。文件：`src/vs/workbench/contrib/sources/common/sourcesChangesReadModel.ts`。

改法：

1. 公开的 `refresh()` 不再直接调用 `refreshWithGeneration(++this.readGeneration)`，改为调用与定时器回调、`scheduleRefresh` 和 `flushScheduledRefresh` 的会话切换分支相同的运行方法：置 `refreshRunning` 为真，清 `refreshAgain`，取新代次，等待 `refreshWithGeneration`，在 `finally` 里只有代次仍是最新时才把 `refreshRunning` 放回假，并按 `refreshAgain` 补排一次。`refresh()` 返回这次运行的 Promise，调用方 `await model.refresh()` 的语义不变。
2. 手动刷新开始时清掉 `refreshAgain` 是对的：此前到来的请求都早于这次读取，由它覆盖。手动读取进行中再到来的 `scheduleRefresh` 照旧置 `refreshAgain`，由最新那次运行在收尾时补排。
3. 边界：`holdPairing` 提前返回、读取抛错、读取被取代后返回，都走同一个 `finally`。模型已释放时不补排。已经排定、尚未触发的去抖定时器不取消，保持现有读取次数；它触发时同样走这个运行方法，代次更新的那次负责收尾。
4. `scheduleRefresh` 与 `flushScheduledRefresh` 的分支结构不改，只是都指向同一个运行方法。

明确不改什么：

- 250ms 去抖、会话切换立即读、`readChangesHook` / `readSummaryHook` 在代次过期时返回 `superseded` 的短路、`land` 的代次判断。
- Refresh 按钮入口（`src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts` 663–668 行）不改；`flushScheduledRefresh` 不新增生产调用方。
- 保持通过：`sourcesChangesList.test.ts` 的 `a slower ReadGitChanges must not replace a newer snapshot after the fast read lands`（2559 行）、`local git.stage success schedules refresh; failure does not`（3557 行）、`local git.unstage success schedules refresh; failure does not`（3611 行）；`sourcesReviewList.test.ts` 的 `Changes and Review share one git read per connection change`、`Changes and Review publish the new session together before an old read's late success`、`Changes and Review publish the new session together before an old read's late failure`、`does not leak unhandled rejection when refresh catch-path paint throws and onUnexpectedError warn-then-rethrows`、`does not leak unhandled rejection when Changes list refresh catch-path paint throws and onUnexpectedError warn-then-rethrows`。

本地验证：

- 在 `src/vs/workbench/contrib/sources/test/browser/sourcesChangesList.test.ts` 的 `a slower ReadGitChanges must not replace a newer snapshot after the fast read lands` 旁新增用例，名字带 `ReadGitChanges`，例如 `manual refresh overlapping a scheduled ReadGitChanges keeps later scheduled reads`，按两种放行顺序各生成一条。步骤：先让构造时排定的首拉跑完；把接下来的两次 `readGitChanges` 分别挂在两道闸门上；调用 `model.scheduleRefresh()` 并等过 250ms 去抖，确认定时那次读取已发出；调用 `model.refresh()`，确认手动那次读取已发出；再按「先放定时、后放手动」或「先放手动、后放定时」放开两道闸门，等两次读取都结束。断言此时没有自动多发读取。然后调用 `model.scheduleRefresh()` 并等过 250ms，断言又发出了一次不挂闸门的 `readGitChanges`，快照是它读到的条目。改前这一次读取不会发出。
- 再加一条，名字同样带 `ReadGitChanges`，例如 `ReadGitChanges requested during an overlapping manual refresh runs once after both reads settle`：同样把定时和手动两次读取都挂住，在手动读取进行中调用一次 `model.scheduleRefresh()`，两道闸门按任一顺序放开后，恰好自动再发一次读取。
- 跑 `scripts/test.sh --grep "ReadGitChanges|schedules refresh|share one git read|publish the new session|refresh catch-path"`，前后步骤见「本地验证顺序」。

### r11-2

问题类：Changes 的展开状态只用「已展开」集合表示，`rememberGroups` 把「不在集合里」当成「第一次出现」，每次重画都把用户收起的分组和目录重新加回；展开状态的键里也没有资源根。

不变量：

- 用户收起的分组或目录（点分组头或目录行、左方向键、Collapse All Folders），只要它的 id 仍在全量快照里，模型刷新、筛选框输入、Git 命令注册引起的重画都不改变它的收起状态。
- 从未收起过的分组和目录默认展开，包括第一次出现的 id。
- 收起记录按目录树作用域区分：作用域是这次绘制解析出的资源根，没有资源根时是活动会话的 `workDir`。同一相对路径在不同作用域下不共享收起状态，与 `sources-changes-idea-panel.md` 第 26 行「节点 identity 至少包含 groupId、仓库 / 资源根、相对路径」一致。
- 某个 id 从全量快照里消失后（包括作用域变了），它的收起记录被清掉；之后再出现按第一次出现处理，默认展开。
- 筛选只影响可见行与计数，不清理收起记录。
- 收起和展开只改视图状态，不发 Git 读取。

要动的符号：`SourcesChangesList` 的字段 `expandedGroupIds`、`expandedFolderIds`（547–548 行，改为只记收起的两个集合，例如 `collapsedGroupIds`、`collapsedFolderIds`），另加两个字段存这次绘制的资源根和作用域键；新增生成目录 id 与分组收起键的私有方法。方法：`renderFromSnapshot`（1199 行起；1252 行调用 `rememberGroups`；1253–1258 行按全量快照清勾选）、`getGitResourceRoot`（1268–1275 行）、`isGroupExpanded`（1314–1316 行）、`toggleGroup`（1318–1325 行）、`toggleFolder`（1327–1334 行）、`folderHeaders`（1336–1344 行）、`rememberGroups`（1395–1440 行；目录 id 在 1413 行；两处「不在就加入」在 1414–1416 与 1429–1431 行）、`folderIdsForEntry`（1442–1452 行；目录 id 在 1449 行）、`getVisibleEntries`（1454–1476 行）、`setAllFoldersExpanded`（1485–1501 行）、`handleCollapseOrExpandFocusedRow`（1123–1189 行；1162 行直接读目录展开集合）、`dispose`（763–764 行）。文件：`src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts`。没有资源根时，作用域键用 `src/vs/workbench/services/agentSession/common/agentWorkRoot.ts` 第 26 行的 `normalizeAgentWorkDirKey` 规范化 `workDir`。

改法：

1. 把两个「已展开」集合换成两个「已收起」集合。展开判定一律写成「不在收起集合里」：`isGroupExpanded`、`folderHeaders` 的 `collapsedIndex` 与 `expanded` 字段、`getVisibleEntries` 的分组与目录判断、`rememberGroups` 生成目录头时的 `expanded` 字段、`handleCollapseOrExpandFocusedRow` 第 1162 行。
2. `renderFromSnapshot` 在调用 `rememberGroups` 之前算一次资源根与作用域键，存进字段：资源根取 `getGitResourceRoot()`；作用域键在有资源根时是它的 `toString()`，没有时是活动会话 `getWorkRoot?.(sessionId)?.workDir` 经 `normalizeAgentWorkDirKey` 的结果，都没有时为空串。到下一次绘制之前，`rememberGroups`、`folderIdsForEntry`、`isGroupExpanded`、`toggleGroup`、`setAllFoldersExpanded` 都读这两个字段，不在点击或切换会话时重算，免得同一次绘制里的 id 前后不一致。
3. 目录 id 改成分组 id、作用域键、相对路径三段，由一个私有方法生成，`rememberGroups` 与 `folderIdsForEntry` 共用，相对路径都用字段里的资源根经 `sourcesChangeParentDirectory` 算。分组的收起键是分组 id 加作用域键。`isGroupExpanded`、`toggleGroup` 与渲染委托 `ISourcesChangesRendererDelegate`（178 行）的签名仍收分组 id，在内部换成这个键。
4. `toggleGroup` / `toggleFolder` 改为在收起集合里加入或删除。`setAllFoldersExpanded(true)` 从收起集合删掉当前 `folderCounts` 与 `groupCounts` 对应的键，`setAllFoldersExpanded(false)` 把它们加入；作用范围仍是当前筛选下可见的分组与目录，与现在一致。
5. `rememberGroups` 删掉两处「不在集合就加入」，只按筛选后的 `entries` 计算目录头、计数和首行锚点。
6. 在 `renderFromSnapshot` 里按全量快照 `allEntries`（不是筛选后的 `entries`）、用第 2 步存下的资源根和作用域键，算出当前存在的分组收起键与目录 id，把收起集合里不在其中的删掉。这一步放在按 `allEntries` 清勾选（1253–1258 行）旁边。作用域变化时，上一作用域的键都不在新快照里，会在这一步被清掉。
7. `dispose` 清空两个收起集合。
8. 实施时在 overview 第 43 行补一句：收起的分组和目录在刷新、筛选后保持收起；切到另一个仓库根或工作目录时重新默认展开。

明确不改什么：

- 收起后留锚点行，锚点行 Enter 与右方向键展开、Space 勾选、右键不弹菜单（overview 第 43 行原有内容）。保持 `Enter on a collapsed folder or group anchor expands it instead of opening the hidden file`、`Space and arrows on a collapsed group row toggle its checkbox and expansion`、`row context menu offers Stage only where the row write action is supported`。
- 首次渲染全部展开，保持 `renders IDEA-style folder rows with counts, checkboxes, and collapse behavior`。
- 勾选不 splice、勾选时收起状态不变，保持 `selection preserves row identity, selection, focus index, scroll and collapsed folders with zero splices`、`collapse, expand and filter rebinding remove stale element projection subscriptions`。
- 勾选按全量快照清理，保持 `checked leaves survive a filter that hides them and return when the filter clears`。
- 目录与分组计数跟当前筛选结果；Collapse All 与 Expand All 只作用于当前可见的分组与目录。
- 多个仓库里同一相对路径合成一个目录头，是现有投影（`rememberGroups` 只用一个资源根算相对路径）；本条只让收起记录跟着目录头的身份走，不拆目录头。
- agent:gemini 正在做的第 5 项改动（勾选框的 `tabIndex`、收起分组的高亮、`updateSelectionToolbar()` 只算可见项）不受影响，先后顺序见「实施前提与收尾」。

本地验证：

- 在 `sourcesChangesList.test.ts` 的 `checkbox selection projection` 套件（4608 行起）里新增用例（用 `createSelectionFixture`、`folderCheckbox`、`typeFilter`、`listIndexOf`）：收起目录 `nested` 后输入筛选 `a.ts` 再清空，断言 `nested` 仍收起（`folderHeaders` 里 `nested` 的 `expanded` 为假，行数与收起时相同）；让模型再落一次快照（触发夹具的连接变化并等过去抖，或给夹具暴露模型的 `refresh`），断言仍收起；`toggleGroup('workingTree')` 收起分组后再刷新，分组仍收起、只剩一行锚点；点 Collapse All Folders 后刷新仍全部收起，点 Expand All Folders 后刷新全部展开。
- 同一套件补一条作用域用例：两个会话的工作根分别是两个仓库（让 `getGitResourceRoot()` 分别解析到 `/repo-a` 与 `/repo-b`），两边都有 `src/nested/b.ts`。在 A 下收起 `nested`；切到 B 并等快照落地，断言 `nested` 展开；再切回 A，断言 `nested` 也是展开。夹具需要可切换的会话桩（`getActiveSessionId`、`getWorkRoot`、`onDidChangeActiveSession`）和按会话返回条目的 `readGitChanges`。
- 再补一条：某目录的文件全部从快照里消失、之后又出现时，该目录默认展开（夹具的 `readGitChanges` 改为读一个可变列表）。
- 跑 `scripts/test.sh --grep "checkbox selection projection|IDEA-style folder rows"`；改了 overview 再跑 docs-health。前后步骤见「本地验证顺序」。

### r11-3

问题类：Accept 总把光标当成 hunk 正文拼接模型里的行号，本地仓库下打开的整文件 diff（索引对工作区）也照此切片，于是暂存另一段改动，或报 “Git accept is not available.”。

不变量：

- Accept 发出的 hunk，是在提供光标的那个编辑器的坐标里包含光标行的那一段。
- 原文是 Git 扩展给出的索引版本时，光标是文件行：新侧落在 `@@` 新侧起点到起点加行数之前，旧侧落在 `@@` 旧侧起点到起点加行数之前；该侧行数为 0 的 hunk 不命中。「索引版本」指 scheme 为 `git:`、query 里 JSON 的 `ref` 是空串的资源（`extensions/git/src/uri.ts` 第 33 行起的 `toGitUri`；primary quick diff 在 `quickDiffProvider.ts` 第 74 行以空串 ref 调用它）。判定只看原文侧，修改侧的 scheme 不参与。
- 原文缺失（只渲染修改侧）时不显示 Accept；原文是 `git:` 但 `ref` 不是空串（例如 secondary quick diff 的 `HEAD`），或 query 里解析不出 `ref` 时，同样不显示。这些情形点击路径都不发 `ReadGitFileDiff`、不发 `WriteGitApplyHunks`。
- 其余组合保持现行行为，按 hunk 正文拼接后的行数计数：两侧都是 `sources-git-diff:` 的引擎 FileDiff 模型，以及测试夹具里的 `inmemory:` 两侧和两个 `file:`（原文路径带 `.git` 后缀）。
- 文件行坐标下修改侧有未保存修改时，不发 `WriteGitApplyHunks`，显示现有的 `sourcesDiffAcceptUnavailableMessage()`。
- patch 字节仍只来自点击时现拉的 `ReadGitFileDiff`（index_state 为 `Unstaged`）；argv 固定；切片函数不读编辑器正文。

要动的符号：

- `src/vs/workbench/contrib/sources/common/sourcesGitHunkPatch.ts`：新增坐标类型（例如 `SourcesGitAcceptCursorBasis`，取值为 hunk 正文与文件行两种）；`sourcesGitHunkPatchAtCursor`（115 行）增加这个参数，缺省为 hunk 正文以保持现有调用；文件行分支写在这个函数里，用已有的 `parseHunkHeader`（186–199 行）与 `lineInHunk`（206–211 行）；更新 108–114 行的文档注释。
- `src/vs/workbench/contrib/sources/browser/sourcesGitDiffContent.ts`：在 `SOURCES_GIT_DIFF_SCHEME`（第 10 行）旁新增一个只收原文 URI 的判定函数，返回文件行、hunk 正文或「不提供」，Pane 与 Panel 共用。解析 `git:` 的 query 放在这里，不放进 `common` 的切片文件。
- `src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts`：`currentWriteFacts`（451 行起，495 行的 `hasApplyHunksPayload`）、`runAccept`（602 行起，659 行调用切片）；构造函数注入 `ITextFileService`。
- `src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts`：`currentWriteFacts`（483 行起，522 行）、`runAccept`（629 行起，683 行）；构造函数注入 `ITextFileService`。

改法：

1. 判定函数：原文缺失返回「不提供」；原文 scheme 是 `'git'` 时解析 query 的 JSON，`ref === ''` 返回文件行，其它情况返回「不提供」；其余 scheme 返回 hunk 正文。`sourcesDiffActions.ts` 第 55 行的 `previewDiffTitleWhen` 已按字面量 `'git'` 判断 scheme，这里沿用同一写法。
2. 两个宿主的 `currentWriteFacts`：`hasApplyHunksPayload` 在现有条件之外要求判定结果不是「不提供」。Pane 用 `input.original`，Panel 用 `ref.original`。
3. 两个宿主的 `runAccept`：发 `ReadGitFileDiff` 之前，用捕获的 input 或 `stagedRef` 的原文求出判定，「不提供」就返回，与现有的早退同级。读回之后、构造 patch 之前，判定是文件行且 `ITextFileService.isDirty(修改侧 URI)` 为真时，显示 `sourcesDiffAcceptUnavailableMessage()` 并返回，不发 Apply。然后把坐标传给 `sourcesGitHunkPatchAtCursor`。读后写前授权（`isCurrent`、`planSourcesDiffAcceptAttempt`、会话一致）的顺序不变。
4. `sourcesGitHunkPatchAtCursor` 的文件行分支：遍历 hunk 时按所认一侧取 `parseHunkHeader` 的起点和行数，用 `lineInHunk(起点, 行数, cursorLine)` 判命中；坏头仍返回 undefined；空串、`(no changes)`、二进制的提前返回不变；第一个 `@@` 之前的文件头照旧拼在选中的 hunk 前面。
5. 守住源码扫描。`test/node/sourcesWiringScan.test.ts` 28–42 行的 `assertAcceptClickContract` 要求两个宿主的 `runAccept` 仍含 `readGitFileDiff`、`SOURCES_GIT_APPLY_CACHED_ARGV`、`SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE`、`sourcesGitHunkPatchAtCursor`、`scheduleRefresh`、`isPairingHold`、`hasSourcesGitApplyHunksPayload`，且不含 `getValue`、`getLineContent`、`parseSourcesGitUnifiedDiff`、`git.stage`、`SOURCES_GIT_STAGE_COMMAND`、`sourcesGitApplyHunksPatches` 与子串 `-R`（注释里也不能有）；所以判定函数放在 `runAccept` 外面，脏检查只用 `isDirty`。122–128 行一带的 `assertAcceptPatchBuilderContract` 要求切片文件里 `sourcesGitHunkPatchAtCursor` 恰好一个函数声明、不从 `sourcesChangesGitRead` 做非类型导入、不调用被禁的那几个函数。
6. 现有夹具基于 `workbenchInstantiationService`，已带 `ITextFileService` 的测试实现（Pane 测试 118–119 行的 `createInstantiationService`、Panel 测试 329 行的 `stubDiffHonestyServices`、`sourcesDiffMoveSource.test.ts` 172 与 283 行）；不是这样构造宿主的夹具按需 stub。
7. 实施时同步 overview §4 的 Accept 段（第 60 行）：写明 Git 索引原文用文件行坐标、其余沿用 hunk 正文坐标、原文缺失或不是索引版本时不显示 Accept、文件行坐标下修改侧有未保存修改时不发 Apply。

明确不改什么：

- 打开路径不改：有本地原文时不读 `ReadGitFileDiff`，本地仓库下仍显示整文件 diff（`needsSourcesGitFileDiff`、`applySourcesGitFileDiffIfNeeded`）。
- 读后写前授权的基线不改（overview 第 63 行）：`sourcesDiffPanel.test.ts` 的 `Accept post-read authorization` 用例组（3606 行起，53 条，ref 两侧是 `inmemory://`）、`conversationDiffReviewPane.test.ts` 的 `Accept post-read authorization input.dispose with live Pane and identical input sends no ApplyHunks`（165 行，`inmemory://`）与 `in-flight Accept does not ApplyHunks after clearInput bumps write generation`（230 行，两个 `file:`）、`sourcesDiffPanel.test.ts` 的 `does not leak unhandled rejection when Accept click catch-path notice throws and onUnexpectedError warn-then-rethrows`（2389 行，两个 `file:`）。这些原文都不是 `git:`，按上面的判定继续走现行计数，测试不用改。230 行用例在 276–278 行用不设上限的微任务循环等读取开始，任何让它的读取不再发出的改动都会卡住 Electron 测试进程，所以不改它的 URI，也不收紧「其余组合」。
- 移动时带上引擎身份不改，保持 `move to conversation copies gitPath onto the input and matches keeps groupId`、`resolveSourcesChangeRefFromEditor keeps identity copied onto the input`。
- `canOfferSourcesGitAcceptHunk` 的 kind 与 indexState 规则不改，保持 `Accept offer uses kind and indexState`、`conflict labeled workingTree hides Accept`（4101 行）、`untracked row hides Accept`、`fully staged row labeled workingTree hides Accept`（4134 行）、`StagedAndUnstaged still shows Accept`、`groupId index with Modified Unstaged still shows Accept`。4101、4134 两条的原文是 `file:`，仍因 kind 或 indexState 隐藏 Accept，断言的含义不变。
- hunk 正文坐标的结果不变：`sourcesGitHunkPatch.test.ts` 的现有用例全部保持（含 `both sides select by the diff-model body line, not the @@ file line`、`keeps the file header and only the hunk under the cursor`、`omitted hunk counts mean 1 and an explicit 0 stays 0`），以及 `sourcesDiffPanel.test.ts` 的 `eligible Modified WORKTREE row shows Accept on both diff hosts`、`Accept click reads Unstaged diff and applies only the cursor hunk`、`cursor outside every hunk reads once per host and does not apply`、`binary diff does not apply`、`missing cursor does not read or apply`、`write closed Accept sends no ReadGitFileDiff and no Apply`。
- 光标侧选取规则不改，保持 `a synced caret on the unfocused side does not steal the hunk line`、`Accept uses the focused side, else the last focused side, else the modified caret`。
- `SOURCES_GIT_APPLY_CACHED_ARGV` 与 `SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE` 不改。
- 远程窗口不在现行产品范围（`docs/product/vision.md` 第 22 行），不为它另做验证；判定只看原文侧，规则本身不依赖修改侧的 scheme。

本地验证：

- 在 `src/vs/workbench/contrib/sources/test/browser/sourcesGitHunkPatch.test.ts` 新增用例：三段 hunk 分别在文件第 3–9、12–18、100–106 行，每段 7 行正文。文件行坐标下，新侧第 15 行切出第二段，第 100 行切出第三段，第 50 行为 undefined；旧侧按 `@@` 旧侧起点与行数同理；某侧行数为 0 的 hunk 在该侧不命中。缺省坐标下第 15 行仍切出第三段，作为两种坐标不同的对照。
- 在 `src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts` 的 Accept 用例组（`mountAcceptHunkHosts`，3956 行起）新增：ref 的修改侧是 `file:`，原文是 `URI.from({ scheme: 'git', path: '/project/src/a.ts.git', query: JSON.stringify({ path: '/project/src/a.ts', ref: '' }) })`，两个宿主都显示 Accept；`pinAcceptCursor` 到第 12 行，Apply 的 patch 等于用文件行坐标对 `acceptCursorUnifiedDiff` 切第 12 行的结果，含 `@@ -10,2 +11,3 @@`、不含 `@@ -1,3 +1,4 @@`；光标在第 5 行时 0 次 Apply，并显示不可用提示。
- 同一用例组新增：原文是 `ref` 为 `HEAD` 的 `git:`，或原文缺失时，Accept 隐藏，点击 0 次读取、0 次 Apply；`ITextFileService.isDirty` 返回真时 0 次 Apply，并显示不可用提示。
- 跑 `scripts/test.sh --grep "Sources - git hunk patch|Sources diff panel|Conversation diff review pane|Sources - Diff ref helpers"`；源码扫描在 `test/node/sourcesWiringScan.test.ts`，用 `scripts/run-unit-custom.sh` 跑 sources 域覆盖。前后步骤见「本地验证顺序」。

### r11-4

问题类：引擎行最新一条变更记录被 1000 条上限的 LRU 挤掉后，重算出的 hash 变成空串，`noteRefreshedKey` 据此删掉了内容并未改变的已审标记。

不变量：

- 同一身份（origin、sessionId、scopeKeyId、path）最多留一份已审标记。
- 引擎行的已审标记只因以下原因消失：同一会话、同一路径来了新的 `onDidFileMutation`（`invalidateEngineMutation`）；用户取消标记；它所在的桶在一次成功读取里已不含该行（`pruneMissingKeys`）。
- 重算出的引擎键 `contentHash` 为空串、且这个空串键本身没有存过时，不删除同一身份下 `contentHash` 非空的已存标记。
- 引擎键 `contentHash` 为空串、而同一身份已有标记时，再标已审不新增第二份；取消标记一次就回到未审。
- 本地 SCM 行不变：重算的 etag 不同就去掉已审。
- `latestMutation` 的容量和按写入新近度淘汰不变。

要动的符号：`SourcesReviewProgressService.noteRefreshedKey`（175–193 行）、`SourcesReviewProgressService.remember`（231–246 行），`engineContentHash`（312–331 行）的注释。文件：`src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts`。下面几个调用方不改，但它们决定了两处要一起改：`markReviewedAfterSuccessfulOpen`（`sourcesReviewListModel.ts` 88–101 行）打开成功后直接 `markReviewed`，之后不调用 `noteRefreshedKey`；`markReviewed` 触发的 `repaint` 不经过 `ensureEntryKeys`；`SourcesReviewList.markEntryUnreviewed`（`sourcesReviewList.ts` 596–604 行）用 `getReviewedKey` 只取同一身份的第一份标记删除。

改法：

1. `noteRefreshedKey`：`key.origin === 'engine'`、`key.contentHash === ''` 且 `!keep`（空串键没有存过）时，跳过同一身份下 `contentHash` 非空的已存标记：不删，也不触发 `onDidChange`。`keep` 为真时照现有逻辑去重，只留空串键这一份。
2. `remember`：`key.origin === 'engine'`、`key.contentHash === ''`，且已有同一身份的标记时，不新增，返回 false。这样记录被挤掉后再打开同一行（`markReviewedAfterSuccessfulOpen`）、点 Mark reviewed 或 Mark all（`SourcesReviewList.markEntriesReviewed`，575–594 行），都不会在旧标记旁边再加一份空串标记。
3. 其余分支保持：引擎键 hash 非空且与已存不同、SCM 键 hash 不同，仍删除旧标记；SCM 键不走第 1、2 步。
4. 边界：打标时就没有记录（已存 hash 为空）而重算也为空时，两个键相同，照旧保留。打标之后来了新变更时，`invalidateEngineMutation` 在事件到达时已经删掉标记，不依赖本条。只做第 1 步不做第 2 步时，同一身份会留两份标记，第一次取消标记只删掉一份，行仍显示已审，要等下一次模型刷新的 `ensureEntryKeys` 才收拢。
5. 在 `engineContentHash` 的注释里写明：返回空串只表示找不到记录，可能从未有过，也可能被挤掉，调用方不能把它当成内容变化。

明确不改什么：

- `DEFAULT_MAX_MUTATIONS`、`LRUCache` 与 `setMutationCapacityForTest`。保持 `bounded mutation retention evicts oldest entries when capacity is exceeded`，挤掉后 `resolveKey` 的 hash 仍是空串。
- 新变更使标记失效，保持 `injected session roots match absolute mutations without invalidating another session`。
- SCM 行的 etag 失效，保持 `noteRefreshedKey drops the mark when the recomputed hash differs`。
- 引擎根行重载后保留，保持 `engine-root row records progress and keeps it after reload`。
- 桶清理，保持 `pruneMissingKeys clears keys for resources no longer listed`、`pruneMissingKeys leaves other origin and session buckets`，以及 `sourcesReviewList.test.ts` 的 `refresh stats only entries that are already reviewed`。
- `markReviewedAfterSuccessfulOpen`、`markEntriesReviewed`、`markEntryUnreviewed`、`getReviewedKey`、`markUnreviewed` 不改。

本地验证：

- 在 `src/vs/workbench/contrib/sources/test/browser/sourcesReviewProgress.test.ts` 的 `bounded mutation retention evicts oldest entries when capacity is exceeded`（368 行）旁新增用例（用 `createService` 与 `mutationEmitter`）：容量设为 2；A 收到一条变更后 `resolveKey` 得到非空 hash 并 `markReviewed`；B、C 各来一条变更把 A 的记录挤掉；再对 A `resolveKey`（hash 为空串）并 `noteRefreshedKey`，断言 `isEntryReviewed(A)` 与 `isReviewed(打标时的键)` 仍为真，且没有触发 `onDidChange`。接着用这个空串键调用 `markReviewed` 与 `markAllReviewed`（模拟重新打开与 Mark all），断言 `isReviewed(空串键)` 为假、A 仍只有打标时那一份；然后 `markUnreviewed(getReviewedKey(A))` 一次，断言 `isEntryReviewed(A)` 为假。
- 同一文件再加一条：A 已审、记录被挤掉后，A 再来一条变更，断言 A 变回未审。
- 跑 `scripts/test.sh --grep "Sources - review progress"`，前后步骤见「本地验证顺序」。

### r11-5

问题类：Review 列表在焦点行因任何原因离开非空列表时，都按旧下标把焦点和选中设到别的行，包括换会话、文字筛选和刷新后行已消失，F1 的两条「对选中项」命令随后作用在用户没选过的行上。

不变量：

- 只有下列条件同时成立，才把焦点交给接替原位置的行，原本选中时选中一并跟过去：上一次和这一次绘制时「仅未审阅」都开着；两次绘制之间快照所属会话没变（`scm` 快照算同一个，引擎快照比较 `state.sessionId`）；原焦点行的身份仍在这次的全量条目 `allEntries` 里，且对应条目现在已审。
- 其它原因让焦点行离开列表时，不设焦点、不设选中，交给列表按身份保留的结果（原行不在就清空）；此时 `getSelectedEntry()` 返回 undefined，`Open Selected Review Change` 与 `Toggle Reviewed for Selected` 什么都不做。
- 仍在列表里的行按身份保留焦点与选中，与现在相同。
- DOM 焦点交接不变：splice 之前 DOM 焦点在列表里时，之后仍在列表里（列表非空），或交给「仅未审阅」开关或筛选框（列表清空），不掉到 `document.body`。这一段是 agent:gemini 改写时加的，本条保留。

要动的符号：`SourcesReviewList.spliceKeepingFocus`（939–970 行：945–953 行是列表清空分支，955–960 行是原焦点行仍在的分支，961–969 行是原焦点行离开的分支，其中 961–966 行设焦点、选中和 `reveal`，967–969 行 `list.domFocus()`）、`SourcesReviewList.renderSnapshot`（857–932 行，927 行调用），新增两个私有字段记住上一次绘制时的「仅未审阅」状态与快照会话。文件：`src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts`。

改法：

1. `renderSnapshot` 在调用 `spliceKeepingFocus` 前，用上一次绘制记下的两个值、本次的 `unreviewedOnly` 与快照会话，算出这次是否允许交接，并把这个判断交给 `spliceKeepingFocus`。
2. `spliceKeepingFocus` 只改原焦点行离开的那一支：允许交接、原行身份仍在 `this.allEntries`、对应条目已审，才执行 `setFocus`、`setSelection`（原本选中时）和 `reveal`；不论是否交接，末尾在 `hadFocus` 为真且 DOM 焦点已不在列表里时的 `list.domFocus()` 照常执行，不能在它前面返回。列表清空分支与原行仍在分支不动。
3. 每次 `renderSnapshot` 结束前都更新这两个记录，包括列表尚未创建、走 `ensureList().splice` 的那一支。
4. 交接条件里的「会话没变」不能省：`sourcesChangeEntryIdentity`（`sourcesChangesModel.ts` 81–83 行）不含 `sessionId`，同一项目两个会话里的同一文件身份相同，只看身份会把换会话误判成刚标完。
5. 更新 `spliceKeepingFocus` 的注释，写明只有未审阅模式下标为已审这一种原因会移动焦点和选中，其它原因只交接 DOM 焦点；实施时在 overview 第 33 行 Review 那一格补一句：换会话、筛选或文件已不在变更里而让焦点行离开时，不把焦点和选中移到别的行。

明确不改什么：

- 未审阅模式下打开的行标为已审后，焦点与选中移到接替行，末行时移到新的末行。保持 `Unreviewed only moves list focus to the next row, or the previous one at the end, when an opened row is marked reviewed`（`sourcesReviewList.test.ts` 3637 行），overview 对此的描述不变。
- agent:gemini 按 `ui-interaction-visual-review-2026-11-07.md` §5.2 第 5 项加的 DOM 焦点交接（列表清空时交给「仅未审阅」开关或筛选框，非空时 `list.domFocus()`）不改，那边为此补的测试保持通过。
- `identityProvider` 仍用 `sourcesChangeEntryIdentity`（779 行）。同一文件在另一会话快照里身份相同时按身份保留选中，是现有行为，不在本条。
- 换会话清掉路径筛选，保持 `switching the active session clears the turn path filter`（3660 行）。
- 两条命令在有选中时的行为不变，保持 `getSelectedEntry and markAllReviewed forward through the registered host`、`openSelected does not mark reviewed during pairing-hold when write door is still open`。

本地验证：

- 在 `src/vs/workbench/contrib/sources/test/browser/sourcesReviewList.test.ts` 的 `Unreviewed only moves list focus...` 旁新增用例（用 `mountReviewList`，3624 行）：「仅未审阅」关着时选中第二行，在筛选框输入让它被筛掉，断言 `list.getSelection()` 与 `list.getFocus()` 都为空、`getSelectedEntry()` 为 undefined；随后调用 `toggleReviewedSelected()`，审阅进度服务没有收到 `markReviewed` 或 `markUnreviewed`。「仅未审阅」开着、被筛掉的是未审行时重复一遍，结果相同。
- 新增用例：快照从会话一的 a、b、c 换成会话二的 x、y、z，原先选中 b，并把 DOM 焦点放在 b 行的 `button.sources-review-state` 上。换后断言没有选中行、列表焦点为空，且 `document.activeElement` 在 `.sources-review-list` 里，不是 `document.body`。夹具里 `mutableChangesModel`（788 行）的 `onDidChange` 目前是 `Event.None`，需要加一个可触发的 Emitter，或像 `Changes and Review publish the new session together before an old read's late success` 那样用真实模型。
- 新增用例，专门覆盖交接条件里的会话一项：「仅未审阅」开着，会话一的引擎快照有 a、b、c，选中 b（它在会话一里未审）；换成会话二的引擎快照，三个文件身份相同，b 在会话二里已审，因此被隐藏。断言换后没有选中行，选中没有移到 c。现有 `reviewedSetProgressService`（3594 行）只按资源记已审，这条要一个按会话区分的桩，例如以 `sessionId` 加资源串为键判断 `isEntryReviewed`。
- 新增用例：「仅未审阅」开着、会话不变，选中行所在文件在下一次快照里已不在（例如已提交），断言选中被清空，不移到别的行。
- 跑 `scripts/test.sh --grep "Sources - review list model|Sources - review showForPaths|Sources - review commands"`；改了 overview 再跑 docs-health。前后步骤见「本地验证顺序」。

## 实施前提与收尾

1. `sourcesChangesList.ts` 与 `sourcesReviewList.ts` 正由 agent:gemini 实施 `dev/plans/ui-interaction-visual-review-2026-11-07.md` §5.2 第 5 项（Changes 勾选框的 `tabIndex`、收起分组的高亮、`updateSelectionToolbar()` 只算可见项；Review 清除路径筛选与标完最后一条时的焦点交接）。r11-2 与 r11-5 等那批改动提交后再实施；要提前做，先与 agent:gemini 约定先后。实施时按符号定位，行号以「行号对照」里的改稿时值为准，不照抄初稿。r11-5 必须保留那边加的 `hadFocus` 判断、列表清空时把焦点交给「仅未审阅」开关或筛选框、非空时的 `list.domFocus()`。
2. r11-1、r11-4 的生产改动不碰上面两个文件；r11-1 的用例加在 `sourcesChangesList.test.ts`，r11-3 改的 Pane 与 Panel 也都有他人未提交改动。实施前先看 `git status` 与 `git diff`，按测试名和符号定位，只暂存本主题的改动，不动别人的未提交改动。
3. 认领实施时在状态行补 `负责：agent:<名字>`（`scripts/wiki/formats.md` 第 57 行：多个 Agent 同时工作时必写）。本轮状态行保持「状态：草案。」，签收另行处理。
4. 实施时同步 `docs/systems/sources/overview.md` 的三处：第 43 行（r11-2）、第 60 行 Accept 段（r11-3）、第 33 行 Review 那一格（r11-5）；改完跑 docs-health。
5. 提交时把本方案登记进 `dev/plans/INDEX.md`。

## 本地验证顺序

每条的本地验证都按同一顺序跑：

1. `npm run compile`；只改 TypeScript 时可用 `npm run compile-client`（`dev/progress/health-gates.md` 第 56 行）。`scripts/test.sh` 加载的是 `out/` 下的编译产物，不先编译就测不到改动。
2. 各条列出的 `scripts/test.sh --grep "…"`。
3. `npm run eslint`。
4. 改了 overview 时跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。
5. 合入前用 `scripts/run-unit-custom.sh` 跑 sources 域，其中包括 `test/node/sourcesWiringScan.test.ts` 的源码扫描。

## 行号对照

审查之后其他会话仍在改同一工作区，下表是初稿引用、改稿时已漂移的行号。

| 文件 | 符号 | 初稿行号 | 改稿时行号 |
|:-----|:-----|:---------|:-----------|
| `sourcesChangesList.ts` | `expandedGroupIds`、`expandedFolderIds` 字段 | 539–540 | 547–548 |
| `sourcesChangesList.ts` | Refresh 按钮点击 | 656–661 | 663–668 |
| `sourcesChangesList.ts` | `dispose` 清两个集合 | 756–757 | 763–764 |
| `sourcesChangesList.ts` | `handleCollapseOrExpandFocusedRow`（读目录展开集合处） | 1116–1182（1155） | 1123–1189（1162） |
| `sourcesChangesList.ts` | `renderFromSnapshot`、`rememberGroups` 调用、按全量快照清勾选 | 1192、1245、1246–1251 | 1199、1252、1253–1258 |
| `sourcesChangesList.ts` | `isGroupExpanded`、`toggleGroup`、`toggleFolder`、`folderHeaders` | 1307、1311、1320、1329 | 1314、1318、1327、1336 |
| `sourcesChangesList.ts` | `rememberGroups`（两处「不在就加入」） | 1388–1433（1407–1409、1422–1424） | 1395–1440（1414–1416、1429–1431） |
| `sourcesChangesList.ts` | `getVisibleEntries`、`setAllFoldersExpanded` | 1447–1469、1478–1494 | 1454–1476、1485–1501 |
| `sourcesReviewList.ts` | `getSelectedEntry` | 375–377 | 384–386 |
| `sourcesReviewList.ts` | `ensureEntryKeys` 重算与 `noteRefreshedKey` | 510–525 | 519–534 |
| `sourcesReviewList.ts` | `renderSnapshot`（调用 `spliceKeepingFocus` 处） | 848–923（918） | 857–932（927） |
| `sourcesReviewList.ts` | `spliceKeepingFocus`（已被 agent:gemini 改写） | 925–944 | 934–970 |
| `docs/systems/sources/overview.md` | Accept 读后写前授权 | 审查引第 61 行 | 第 63 行 |

`sourcesChangesReadModel.ts`、`sourcesGitHunkPatch.ts`、`sourcesReviewProgressService.ts`、Pane、Panel，以及 `sourcesChangesList.test.ts`、`sourcesDiffPanel.test.ts`、`sourcesGitHunkPatch.test.ts`、`sourcesReviewProgress.test.ts` 里初稿引用的行号没有变；`sourcesReviewList.test.ts` 的行号按改稿时的值写在正文里。

## 审查

2026-11-07 只读审查（规则 16）的结论是须改稿，r11-1 改完用例后可实施。改稿时逐条对照了当时的工作区，包括他人尚未提交的改动。Critical 三条都属实，已改。r11-3 一条：初稿的 scheme 白名单会让 `Accept post-read authorization` 用例组的 53 条（ref 是 `inmemory://`）、`conversationDiffReviewPane.test.ts` 165 与 230 行、`sourcesDiffPanel.test.ts` 2389 行失败，230 行还会卡在 276–278 行的微任务循环里，这些都是 overview 第 63 行（审查所引第 61 行）的基线；采纳审查给的第一种做法，改成只在原文是 Git 索引版本时用文件行坐标、原文缺失时隐藏 Accept、其余组合保持现行计数，基线用例不用改，4101、4134 两条也不会变成空过。r11-4 一条：初稿只放宽 `noteRefreshedKey`，记录被挤掉后重新打开同一行会经 `remember` 再加一份空串标记，第一次取消标记只删掉一份；改为 `noteRefreshedKey` 只在空串键没有存过时跳过删除，并让 `remember` 在同一身份已有标记时不再加空串键，用例补上了「第一次取消就回到未审」的断言。r11-5 一条：`spliceKeepingFocus` 已被 agent:gemini 改写并加了 DOM 焦点交接，初稿「否则直接返回」会跳过 967–969 行的 `list.domFocus()`；改为只跳过设焦点、选中和 `reveal`，保留 DOM 焦点交接，写成与那边协调的实施前提，并在用例里断言 DOM 焦点仍在列表里。Important 三条都属实，已改。r11-2：目录与分组的收起键加入目录树作用域（资源根，没有时用会话 `workDir`），并补跨仓库用例。r11-5：补「只看未审、两个会话、同一身份」的用例和按会话区分的审阅桩。r11-1：两次读取都挂住，按两种顺序放行，用例名带 `ReadGitChanges`。

Minor 的处理：行号漂移已加「行号对照」一节，正文行号改成改稿时的值。r11-3 的加固已并入：`git:` 原文要求 `ref` 为空串；判定只看原文侧，远程窗口不在现行产品范围（`docs/product/vision.md` 第 22 行），不另做验证；`sourcesWiringScan.test.ts` 28–42 行与 122–128 行一带的扫描约束写进了改法第 5 步。overview 第 43 行的同步写进 r11-2 改法第 8 步和实施前提。「负责：agent:」本轮没有加，因为状态行按要求保持「状态：草案。」，改为在实施前提里要求认领时补上。覆盖需求改为 PRD-005、PRD-009、PRD-023 并写明对应关系；审查只提了前两条，r11-4、r11-5 属于 PRD-023 的审阅进度，一并列出。共性问题也已处理：新增「本地验证顺序」（先编译，再跑测试，再跑 eslint，改了文档再跑 docs-health），覆盖需求不再用循环理由，实施前提写明提交时登记 `dev/plans/INDEX.md`。五条的判定与严重度都没有变化。

## 实施记录（2026-11-07）

用户同意实施并要求不编译。五条都已按本稿落到代码、测试和文档，在当前工作区上直接改，别的会话尚未提交的改动原样保留。没有编译，没有跑测试、eslint 和 docs-health。

依赖：r11-5 建在 agent:gemini 按 `ui-interaction-visual-review-2026-11-07.md` §5.2 第 5 项改写、尚未提交的 `spliceKeepingFocus` 上（`hadFocus` 判断、列表清空时把焦点交给「仅未审阅」开关或筛选框、非空时 `list.domFocus()`），这些都保留，只在原焦点行离开的分支里加了交接条件。r11-2 改的 `sourcesChangesList.ts` 同样有那批未提交改动（键盘收起、右键 Stage 等），`handleCollapseOrExpandFocusedRow` 读目录展开集合的那一处已随本条换成收起集合。提交时 r11-2、r11-5 要与那批改动一起提交，或排在它之后。

r11-1：`src/vs/workbench/contrib/sources/common/sourcesChangesReadModel.ts` 把 `runScheduledRefresh` 改名为 `runRefresh`，定时器回调、会话切换分支、`flushScheduledRefresh` 和公开的 `refresh()` 都经它发起读取；`refreshWithGeneration` 只由它调用，去抖定时器不取消。用例加在 `sourcesChangesList.test.ts`：`manual refresh overlapping a scheduled ReadGitChanges keeps later scheduled reads` 与 `ReadGitChanges requested during an overlapping manual refresh runs once after both reads settle`，各按「scheduled first」「manual first」两种放行顺序生成一条，两次读取都挂在闸门上。与方案无出入。

r11-2：`src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts` 把 `expandedGroupIds`、`expandedFolderIds` 换成只记收起的 `collapsedGroupKeys`、`collapsedFolderIds`，新增字段 `treeRoot`、`treeScope` 和方法 `updateTreeScope`、`groupStateKey`、`folderId`、`pruneCollapsedIds`；`rememberGroups` 去掉两处「不在就加入」，`rememberGroups` 与 `folderIdsForEntry` 都用这次绘制存下的资源根，目录 id 带作用域；`renderFromSnapshot` 在 `rememberGroups` 前更新作用域，之后按全量快照清理收起记录。用例加在 `checkbox selection projection` 套件：给 `createSelectionFixture` 的返回值加了 `refresh`（触发连接变化并等读取完成），新增 `collapsed folders and groups stay collapsed across filter input and model refreshes`、`a collapsed folder that leaves the snapshot and comes back starts expanded`、`collapse records follow the tree scope, so the same folder under another session work root starts expanded`。与方案的出入：作用域用例没有配 SCM 仓库，两个会话的资源根都解析不出来，作用域落在会话 `workDir` 一支；资源根那一支没有单独的用例。overview 第 43 行已补句。

r11-3：`src/vs/workbench/contrib/sources/common/sourcesGitHunkPatch.ts` 新增类型 `SourcesGitAcceptCursorBasis`（取值 `hunkBody`、`fileLine`），`sourcesGitHunkPatchAtCursor` 增加缺省为 `hunkBody` 的第四个参数，文件行分支写在同一个函数里；`src/vs/workbench/contrib/sources/browser/sourcesGitDiffContent.ts` 新增 `sourcesGitAcceptCursorBasis(original)`；`conversationDiffReviewPane.ts` 与 `sourcesDiffPanelView.ts` 注入 `ITextFileService`，`currentWriteFacts` 的 `hasApplyHunksPayload` 要求判定不是「不提供」，`runAccept` 在读之前判定、读之后对文件行坐标做脏检查，再把坐标传给切片函数。用例：`sourcesGitHunkPatch.test.ts` 新增 `file-line basis selects by the @@ range of the caret side`；`sourcesDiffPanel.test.ts` 给 `mountAcceptHunkHosts` 加了 `modifiedDirty` 选项（用 `instantiationService.stub(ITextFileService, 'isDirty', ...)`），新增 Git 索引原文上按文件行 Apply、按正文行不 Apply、`HEAD` 原文与缺失原文隐藏 Accept、修改侧未保存不 Apply 共五条。与方案无出入；两个宿主 `runAccept` 里新增的内容已对照 `sourcesWiringScan.test.ts` 的禁止词检查过。overview 第 60 行已补句。

r11-4：`src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts` 的 `noteRefreshedKey` 在空串键没有存过时不删同一身份下 hash 非空的标记，`remember` 在同一身份已有标记时不再加空串键，`engineContentHash` 补了注释。与方案的出入：两处共用的判断抽成了私有方法 `isMissingEngineRecord`。用例加在 `sourcesReviewProgress.test.ts`：`an evicted engine mutation record keeps the reviewed mark, adds no second mark, and one unmark clears it` 与 `a new engine mutation after an evicted record still clears the reviewed mark`。

r11-5：`src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts` 新增字段 `lastPaintUnreviewedOnly`、`lastPaintSessionKey`；`renderSnapshot` 算出交接条件，每次结束前更新这两个记录；`spliceKeepingFocus` 增加第三个参数，只有允许交接、原行仍在全量条目里且已审时才设焦点、选中和 `reveal`，末尾的 `list.domFocus()` 照常执行。用例加在 `sourcesReviewList.test.ts`：新增按会话区分的审阅桩 `sessionReviewedProgressService` 和可切换快照的 `mountSwitchableReviewList`，用例为文字筛选两种模式各一条、换会话并断言 DOM 焦点仍在列表、同一文件在切换后的会话里已审、选中文件已不在变更里，共五条。与方案无出入。overview 第 33 行已补句，overview 的 `updated` 改为 2026-11-07。

没有做的部分：无。本稿要求的登记由父 agent 统一处理：提交时把本方案登记进 `dev/plans/INDEX.md`。

之后要跑的本地验证（按「本地验证顺序」）：

1. `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`）。
2. `scripts/test.sh --grep "ReadGitChanges|schedules refresh|share one git read|publish the new session|refresh catch-path"`
3. `scripts/test.sh --grep "checkbox selection projection|IDEA-style folder rows"`
4. `scripts/test.sh --grep "Sources - git hunk patch|Sources diff panel|Conversation diff review pane|Sources - Diff ref helpers|Sources - git diff content provider"`
5. `scripts/test.sh --grep "Sources - review progress"`
6. `scripts/test.sh --grep "Sources - review list model|Sources - review showForPaths|Sources - review commands"`
7. `npm run eslint`
8. `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`
9. 合入前 `scripts/run-unit-custom.sh`，覆盖 `test/node/sourcesWiringScan.test.ts` 与 `test/node/sourcesLeftoverCatchScan.test.ts` 的源码扫描。

### 代码审查（2026-11-07）

只读代码审查的结论是可接受，只提了 Minor，四条都已处理；仍然没有编译，没有跑测试、eslint 和 docs-health。

1. 换会话用例里会话二改成只有 `x.ts` 一行，原先聚焦的行节点因此被释放并移出文档（用例先断言这一点），去掉 `spliceKeepingFocus` 末尾的 `list.domFocus()` 时焦点会落到 `document.body`，用例随之失败。
2. 资源根一支已补上用例：原来的作用域用例改成按 `work directory` 与 `resource root` 两种配置各生成一条，用例名里的 `work root` 相应换成这两个词，后一种给两个会话各配一个与其 `workDir` 相同的 SCM 仓库根，两种都断言这次绘制实际用的作用域（仓库根的 URI 字符串，或规范化后的 `workDir`）。
3. `sourcesGitDiffContent.test.ts` 新增 `Accept cursor basis: only a Git index original counts file lines, and an unreadable git query offers no Accept`，覆盖原文缺失、hunk 正文模型、索引原文、`HEAD`、缺 `ref`、查询不是 JSON、查询为 `null` 七种原文，上面第 4 步的过滤词已加上它所在的套件。
4. overview 第 7 行的 `summary` 删掉了过时的「方案未实施前无载荷不显示」和与之重复的「Accept 仍无载荷不显示」，末尾补了 2026-11-07 的三项行为：收起状态保留、Review 只在标完时移交焦点、Accept 在 Git 索引原文上按文件行定位。
