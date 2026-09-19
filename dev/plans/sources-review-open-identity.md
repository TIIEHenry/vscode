---
title: "Sources 打开身份：已审、闸门、写路径、Conversation 组"
type: plan
status: accepted
phase: M7
updated: 2026-09-19
summary: "2026-09-19 用户签收。S1 一条序列；reveal 读已打开 tab；fail 仍交 pane 不 mark。不重开 A2。不改 fileMutationJoin。"
---

# Sources 打开身份：已审、闸门、写路径、Conversation 组

> **slice_id**：`sources-review-open-identity`  
> **冲突域：** `src/vs/workbench/contrib/sources/{browser,common}`（**不**改 `editorGroupFinder` / `handleGroupResult`）  
> **基线：** HEAD `5c910c59a226`（Diff `SIDE_GROUP` + `matches()` 已落）  
> **本稿是方案，不是实施。**  
> **不推翻：** [ADR-005](../decisions/005-changes-diff-owner.md)；[sources-changes-diff](sources-changes-diff.md) F1–F3；Accept **A1** 空载荷隐藏（[sources-accept-empty-success](sources-accept-empty-success.md)）；[ADR-008](../decisions/008-write-git-apply-hunks-empty.md)。  
> **禁止：** A2、`WriteGitApplyHunks`、发明 `WriteGitUnstage`、解析 `arguments_json` 当 path（G-REV-1）。

## Problem class

- **症状：** 比较加载失败，Review 行已变成已审；同文件 staged+unstaged 打开未暂存行却出现 Unstage；引擎 FileDiff 后 Stage 的 argv 是 `''`；在 Sources 点 Conversation Diff，开到第一扇会话窗。
- **类标签：** **「视图出现」冒充打开成功** + **URI-only 查找丢掉 groupId** + **虚拟 URI 当写路径** + **active conversation part 回退 at(0)**。
- **复发机制：** `openEditor` resolve 与 pane `setInput` 吞错仍当成功；`findScmResourceForUri` 按 Git 组登记序（index 先于 workingTree）。

## 0. 一句话结论

标已审只等 **这次打开的比较真正画上**（Sources 内 `onDidLoad` / pane 三态终态，**一条序列**），不靠 `openEditor` / `show()` resolve、不靠 `_onDidChangeControl`、不改 `EditorGroupView`。闸门 prefer `input.groupId` + 打开时带上的 identity（含 Panel）。Input **拆开** write identity 与 model URI。Conversation Diff：用 roster sessionKey 找到叶，在该 part 上算出 side group，再 **`targetGroup.openEditor(input, options)`**。没有该叶 → **失败**（notice / throw），**禁止** `at(0)`，**禁止**回 Preview。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `markReviewedAfterSuccessfulOpen` 在 tab/panel「打开」成功后调用 | `sourcesReviewListModel.ts` |
| `ConversationDiffReviewPane.setInput` / `renderRef` 比较失败 **不 throw**；`EditorGroupView.doShowEditor` 吞 pane 错仍 resolve | pane + editor group |
| Panel `show()` 等 `openView`，不等 `renderRef` | `SourcesDiffPanelService` |
| 空 `unifiedDiff` 在 open 前 throw——保的是打开前失败不标已审（`sourcesGitEmptyFileDiffMessage`），不是 A1 空 Accept | 既有测 |
| `findScmResourceForUri` 按 URI 命中**第一**个 SCM 组；Git 登记序 merge→index→workingTree | `sourcesChangeRef.ts` |
| pane `updateReviewActions` 用 `match?.groupId \|\| input.groupId`，可覆盖 stored workingTree | `conversationDiffReviewPane.ts` |
| 双门：Revert 仅 workingTree/untracked；Unstage 仅 index | 产品 / 既有 chrome |
| `applySourcesGitFileDiffIfNeeded` 成功后 `modified` 换成 `sources-git-diff:/modified/...` | `sourcesChangeEntryOpen.ts` |
| `sourcesDiffLocalWritePath` 对虚拟 URI 回 `''`；Stage `{ argv: [''] }` | 同文件 + pane `runStage` |
| `openSourcesChangeInConversation` / `openSourcesChangeRefInConversation` 都 `openEditor(..., CONVERSATION_SIDE_GROUP)`；finder 对该 token 仍调 `getActiveConversationEditorPart()`（Sources 焦点 → `at(0)`） | `sourcesChangeEntryOpen.ts`；`sourcesDiffRefHelpers.ts`；`editorGroupFinder.ts` |
| `ConversationDiffReviewInput` 构造只收 `modified, original, groupId`，两处 `createInstance` 丢掉 `scmResource` / `gitPath`；`ISourcesChangeRef` 有可选 `scmResource`，`resolveSourcesChangeRef` 不拷 `entry.gitPath` | Input + ref |
| Panel `getWriteContext` 同样 `findScmResourceForUri` 后 `match?.groupId \|\| ref.groupId` | `sourcesDiffPanelView.ts` |
| `findGroup({ direction })` 可复用已有邻居（含隐藏分列），Preview `SIDE_GROUP` 有 lock/hidden 检查 | editor group finder |
| 多根：列表 `getGitResourceRoot` 用第一 repo；chip `workDir` 另拼 | Changes/Review list vs attribution |
| D31 F4 手测仍开；不是本方案 Exit | [deferred-gaps D31](../progress/deferred-gaps.md) |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 加载成功才已审；URI+groupId；gitPath 线程；Conversation 叶解析** | §3 | **选定** |
| B 比较失败也标已审「用户打开过」 | — | **拒绝。** 违反「成功打开该 change」 |
| C 开 A2 / ApplyHunks | 空 Accept 之后的写 | **拒绝。** P5 停线；须新 Arch-First |
| D 发明 WriteGitUnstage | — | **拒绝** |
| E 本波重做多根 workDir / mutation join | 碰到 `fileMutationJoin` 与对面方案 S3 | **拒绝本波。** 记相关 |

## 3. 选定设计（A）

1. **S1 已审。** 冲突域留在 sources：pane/panel 在比较真正画上后发加载结果。**禁止**把 `openEditor` / Panel `show()` 的 resolve、或 `_onDidChangeControl`（失败也会 fire）当 loaded。失败画 pane 自己的 `"Unable to load this comparison."`（**不是** `sourcesGitDiffOpenFailureMessage`）。**不**改 `EditorGroupView`。

   **失败完成式。** `markReviewedAfterSuccessfulOpen` 的 `open()` 收成 `() => Promise<boolean>`。仅 `true` 标已审；`false` 由 **list / commands 消费点**写 Review 列表 status（`sourcesReviewList.ts` / `sourcesReviewCommands.contribution.ts` 今日只在 **throw** 时 `sourcesGitDiffOpenFailureMessage`；`false` 不进 catch）。Preview 仍 `scmResource.open()` / `openEditor` resolve → `true`（ADR-005）。须**改写** `sourcesWiringScan.test.ts`：今日 L146–157 / L201–214 只扫 `markReviewedAfterSuccessfulOpen` + `catch` + `sourcesGitDiffOpenFailureMessage`（`open()` 仍 void、resolve 就 mark 也会绿）；L252–253 / L276 仍锁 `renderGeneration` / `generation !== this.renderGeneration`，会逼实施留双计数。扫描改为锁 boolean 消费 + 调用点 generation，不再锁 pane 私有 `renderGeneration`。

   **一条序列，禁止 OR。** HEAD 完成时机相反，禁止「先 `await openEditor`/`show()` 再等 pane 事件」：
   - Conversation：`editorPanes.ts` L464–466 `openEditor` **await `setInput`**。loaded 若在 `setInput` 里 fire，调用方在 await **之后**订阅会错过。L430–446：`inputMatches && !forceReload` **跳过 `setInput`**，不会再画、不会再发 loaded（S4 ① 同 identity reveal 必走这里）。pane `setInput` dispose/cancel/generation 早退是 **bare `return`**（`conversationDiffReviewPane.ts` L173–175、L193–195），`renderDiff` mismatch 同样先 `return false` 再被吃掉。`editorGroupView.ts` L1296–1298：`cancelled` → `undefined`，Promise **照样 resolve**。
   - Panel：`show()` 只 `await openView`（`sourcesDiffPanelService.ts` L39–44）；view 侧 `void renderRef`（L131–134）。header 未就绪 / `!ref` / generation 不匹配都是无信号 return（L219–221、L226–231、L237–239、L248–250）。

   选定（不可选另一条）。**「调用点」= `openSourcesChangeInConversation` / Panel `show()`**（今日仍 `Promise<void>`），**不是** list / commands。list 的 `markReviewedAfterSuccessfulOpen`（`sourcesReviewList.ts` L513–525；`sourcesReviewCommands.contribution.ts` L49–74；wrapper `sourcesReviewListModel.ts` L88–96）只消费 boolean。
   1. **调用点分配本次 `generation`，搭在本次 `ConversationDiffReviewInput` 实例上**（新字段，**不进** `matches()`：`conversationDiffReviewInput.ts` L71–75 只比 modified/original/groupId）。**禁止**改 `editorPanes.ts` / 给 `setInput` 加死参（HEAD 四参，唯一调用方 `editorPanes.ts` L464）。**禁止** pane 私有 `++this.renderGeneration`（L171）。Panel：generation 搭在这次 `show(ref)` 的 ref / 同源包装上，传入**这一次** `renderRef`（HEAD `renderRef(ref)` 无 generation 参，`sourcesDiffPanelView.ts` L213）。
   2. **open / `show()` 之前**由**同一调用点**订 Sources 级 `onDidLoad({ resource, generation, ok })`（只认本次 generation）。禁止 list 订。
   3. `await` 打开 API。
   4. **`(await openEditor) === undefined` → 立刻 `false`，禁止再读三态。** HEAD reveal **成功**返回 pane：`editorPanes.ts` L430–446 在 L441 后再 `inputMatches` 则 `{ cancelled: false }`，`editorGroupView.ts` L1296–1298 因此交出 **pane**，不是 `undefined`。reveal 块里唯一的 `undefined` 是 L446 `cancelled: !inputMatches`（等 pending 时 tab 已换成别的 change）。禁止「这是 reveal，undefined 仍读三态」——会把后一次 tab 的 `ok` 标成这次已审。HEAD 后一次打开先 `clearInput`（L461；pane L218–219）再 `setInput`；被取消的那次 pane L173–175 / L193–195 **bare return、不 fire**；`doSetInput` 标 `cancelled`（L468–469）。
   5. 已收到本次 `{generation, ok}` → 用之（`ok===false` → 这次 `false`）。HEAD Conversation 比较失败 **不 throw**、仍交 pane（`conversationDiffReviewPane.ts` L197–205；`editorGroupView.ts` 只 `cancelled` 才 `undefined`）。**禁止** `return pane != null`。
   6. **仅当 `openEditor` 返回 pane、且本次 generation 没有 `onDidLoad`** 才走 reveal：读 **已打开那一扇 tab 的已落下三态**，**不**用新 Input 上的 generation 去对号。HEAD `openSourcesChangeInConversation` 每次 `createInstance` 新 Input（`sourcesChangeEntryOpen.ts` L153–158）；generation 不进 `matches()` → 再点同一 change **必**走 `editorPanes.ts` L430–446 跳过 `setInput`。主路径：Changes 先开（`sourcesChangesList.ts` **不** mark）→ Review 再点同一行（`sourcesReviewList.ts` L513–525）——这是第一次有资格 mark 的点击，比较已可见且已加载，必须能 `true`。三态挂在 **pane / 已打开的 Input** 上：`setInput` **入口**落入 `pending`，L197–210 画完才 `ok`/`fail`。reveal 看到该 tab 已是 `ok` → 这次 `true`；已是 `fail` → `false`；仍 `pending` / 从未落下 → `false`。新 Input 的 generation 只服务 **这次真正跑了 `setInput`** 的路径。**禁止**读现有 `comparisonLoadFailed`。
   7. 再否则（pane 已 dispose、从未落下、Panel `renderRef` 早退）**立刻 `false`**。禁止 `Event.toPromise(onDidLoad)` 挂死。

   **Panel：`show()` 只 join 会画完的那一次 `renderRef`，resolve ≠ 成功。** HEAD `show()` 先 `_onDidChangeRef.fire` 再 `await openView`（`sourcesDiffPanelService.ts` L39–44）。首次绘制是 `sourcesDiffPanelView.ts` L187 `void this.renderRef(this.currentRef)`：`show()` L42 fire 时 view 还不存在，L131–134 listener 接不住。实施若 `openView` 后再调且不拆 L187 → 二次 `renderRef`（generation 冲掉第一次）；若只改 listener → 首次 `show()` join 不到 L187。选定：**去掉另一条 `void renderRef`**，首次与再次都只 join **同一** 次会走到 L253–263（fail 画出）或 L266–273（成功画出 header / `updateWriteActions`）的 `renderRef`。`renderRef` 是 `Promise<void>`（L213）。await 结束读 **这次 generation 的三态 / `onDidLoad` 的 `ok`**：`ok` → `true`；`fail` / 早退 / generation 不匹配 → `false`。禁止把 `renderRef` resolve 当 `true`。禁止第二条完成信号、禁止二次 `renderRef`、禁止用 `onDidLoad` 代替这次 await。

   **`Promise<boolean>` 生产点写死：** `openSourcesChangeInConversation` 与 `show()` 产出 boolean，穿过 `openSourcesChangeEntry` 返回值。list / commands **只读** `true|false`，禁止在 list 层再订 pane 事件、禁止在 list 层跑步骤 1–7。

   并发：后一次 `setInput` 用**调用点分配的**新 generation，前一次早退不得把 A 行标成 B。旧测 `markReviewedAfterSuccessfulOpen marks only after open resolves` **必须改写成锁 boolean**。
2. **S2 闸门。** prefer 序写死：`input.groupId` + 打开时带上的 `scmResource`/`gitPath`。`findScmResourceForUri` 必须带 `groupId`，不得用第一 URI 命中覆盖 stored `workingTree`。同一序覆盖：`updateReviewActions` / `runGitAction` / `resolveSourcesChangeRefFromEditor`（Move）/ Panel `getWriteContext`（`sourcesDiffPanelView.ts`）。FileDiff 行没有 `scmResource` 时走 S3 identity，不再 URI 扫一遍。
3. **S3 写路径。** `ConversationDiffReviewInput` / `ISourcesChangeRef` **显式拆**：
   - **identity/write**：`gitPath` 或 file URI + `groupId` + 可选 `scmResource`
   - **model URIs**：`sources-git-diff:`（`createModelReference` 继续用这个）
   `resolveSourcesChangeRef` 必须写入 `gitPath`（从 `entry.gitPath`）。两处构造（`openSourcesChangeInConversation` 与 Move/`openSourcesChangeRefInConversation`）把 identity 传进 Input。**第三处：** `applySourcesGitFileDiffIfNeeded` HEAD 只拷 `modified/original/groupId/scmResource`、把 `modified` 换成 `sources-git-diff:`——必须显式拷 `gitPath`（及 identity 其余字段），否则 FileDiff 行 Stage argv 仍是 `''`。pane resolve 模型 URI；Stage **只**读 identity。空则 disable + status，**不**调 `tryWriteSourcesGitStagePaths`。不改 `sourcesGitStagePathsRequest` 的空串原样上线合同（挡在调用点）。禁止从 `arguments_json` 补 path。`matches()` 保持 original+`groupId`，identity 含 `gitPath` 时也带上，不要退回只比 `modified`。
4. **S4 Conversation 组（找叶 + 对该叶 group.openEditor）。** 解析序写死：`conversationParts.find(p => p.sessionKey === roster.getActiveSessionId())`（与 `IConversationSessionChatService.getConversationPart` 同一 Map，不必新 API）。没有该叶 → **失败**（notice / throw），**禁止**回 Preview。**禁止** `at(0)`。**禁止改、禁止调用** `getActiveConversationEditorPart`。禁止先 `focus()` 再传 token。

   **选定打开 API：`targetGroup.openEditor(input, options)`**（HEAD `conversationSessionChatService` 开已有 tab 已是这条）。**禁止** `IEditorService.openEditor(input, options, groupInstance)`：`isConversationPreferredGroup` **只**认 token；Conversation part `excludeFromGlobalEditorAggregation` → `handleGroupResult` 把组改落到 `mainPart.activeGroup`，随后审阅 input 抛 `Conversation chat input requires CONVERSATION_GROUP or a conversation editor group`。有叶也会打不开。不扩 `conversationExplicitOpen` / finder（超出本稿冲突域）。**禁止** Sources/Move 再传 `CONVERSATION_SIDE_GROUP` token。叶内 `conversationEditorPart.sideGroup.openEditor` 仍把 token 交给**全局** `getActiveConversationEditorPart`，并不绑 `this` part——「叶内可用 token」仅在 DOM 已在该叶内时成立；**禁止** `foundLeaf.sideGroup.openEditor` 当 Sources 路径。

   **Sources/Move 算组顺序写死：** ① 先扫该叶全部组，同 identity Diff → `targetGroup.openEditor` reveal；② 再 `part.findGroup({ direction }, chatRoot, false)`（hidden → `part.setGroupHidden(candidate, false)` 再复用）；③ 仍无邻居才对 **chat 根** `addGroup`。source = **含 default `ConversationChatInput` 的那组**（HEAD `conversationEditorPart.ts` 也用 `groups.at(0)` 当 root，列被搬走后 `at(0)` 会分叉，禁止只写 `at(0)`）。**禁止**以侧列 / `part.activeGroup` 为 source（HEAD `findGroup({ direction }, part.activeGroup)` 在 source 已是侧列时 `direction` 无邻居就会第三列）。Chat 根不当 Diff 宿主。`direction` 用 `preferredSideBySideGroupDirection`，这是 `IEditorPart.findGroup`，不是 `editorGroupFinder.findGroup`。禁止无参 `showSplitColumn()`。禁止对 hidden 列 `addGroup`。**Sources/Move 的 Conversation 路径**禁止 `IEditorService.openEditor`（组实例或 `group.id`）——数字 id 同样进 `handleGroupResult`。Preview / `ACTIVE_GROUP` 不在这条禁令里（ADR-005）。

   必须改写锁旧接线的测：`sourcesChangesList.test.ts` `openedGroup === CONVERSATION_SIDE_GROUP`；`sourcesWiringScan.test.ts` 断言 open/helpers **包含**该 token；`sourcesDiffRefHelpers.test.ts` 若 stub 的是 `IEditorService.openEditor`，S4 改 `group.openEditor` 后一并改写。**不**做 list URI join workDir；**不**改 `fileMutationJoin`。

## 4. 不变量

- 已审 ⟺ 该 change 的比较内容对用户可见且加载成功。
- Revert/Unstage 跟打开行的 index 态，不跟「同路径另一组」。
- 写路径是真实文件 / `gitPath`；虚拟 diff URI 不是 argv。
- Conversation Diff 开在 **roster 当前 sessionKey 对应的叶** 旁；没有该叶则失败，不偷 `at(0)`，不回 Preview。
- 不改 `fileMutationJoin`、不接活 L2 mutation、不解析 `arguments_json`。
- 不启动 A2；不发明 Unstage RPC；不关 D31 仅因本刀合入。

## 5. 切片

| Slice | Goal | Files | Exit |
|:------|:-----|:------|:-----|
| **S1** | loaded 才已审 | review model + pane/panel + `openSourcesChangeEntry`（**产出** boolean）+ list/commands（**只消费**） | 一条序列：`openSourcesChangeInConversation`/`show()` 分配 generation → 同处订 `onDidLoad` → await → **`undefined` 一律 false** → 本次事件否则 **返回 pane 且无本次 loaded 才**读已打开 tab 三态；Panel 只 join 画完那次 `renderRef`（**resolve ≠ true**）；仅 true 标已审；Preview 仍 resolve→true；测必须锁：① 真实走到 L430–446，**spy 未调 `setInput`**，已打开 tab 三态 `ok` → mark；② `undefined` 不 mark；③ **首次 `setInput` fail 仍交 pane**（`conversationDiffReviewPane.ts` L197–205 不 throw；`editorGroupView.ts` 只 cancelled 才 `undefined`）→ **false / 不 mark**；reveal 已落下 `fail` → false（禁止 `return pane != null`）；④ 两次打开：前一次必须 **走完 L207–210 并发出 `{genA, ok:true}`**。后一次必须 **改 `matches()` 字段**（modified/original/groupId，S3 后含 gitPath）才会走 L461，只改 generation 会进 ①。后一次必须 **`openEditor` 仍交 pane**（不准塌成 ②/`undefined`），且 **不得再发 `{ok:true}`**——第二次走完 L197–204 得 `{genB, ok:false}` / 三态 `fail` → `false`。禁止只做「A 成功再开 B」却让 B 也 L207–210 成功（步骤 5 本就该 true，误吃 `{genA, ok}` 仍绿）。L173–195 早退是步骤 4，**不能**当本条夹具。⑤ list 不订 `onDidLoad`；⑥ Panel fail L253–263 / success L266–273；⑦ 改写 wiringScan |
| **S2** | prefer input.groupId | `sourcesChangeRef.ts` + pane + Move helper + **`sourcesDiffPanelView.ts`** | 同文件两行：打开 workingTree → Revert 可见、Unstage 不出现；Panel 无 scmResource 的引擎行不 URI 抢 index |
| **S3** | identity ≠ model URI | Input/ref + **`applySourcesGitFileDiffIfNeeded` 拷 gitPath** + 两处构造 + Stage | FileDiff 后 Stage 用 gitPath；空不发；`matches()` 仍含 groupId（及 gitPath） |
| **S4** | roster sessionKey 找叶 → `targetGroup.openEditor`；source=ConversationChatInput 根 | open 两条路径（+ 改写 SIDE_GROUP 锁绿测） | Sources 焦点开到 **active sessionKey** 的叶旁；无叶失败；**Conversation 路径**禁 `IEditorService.openEditor`（组实例或 group.id）；不改 `getActiveConversationEditorPart` |

本地 `scripts/test.sh --run` 点名 sources* 测。不跑 F4 冒烟当 Exit。不跑托管 CI。

## 6. 不做

- A2 / ApplyHunks / 升 PRD-009/023 `implemented`
- 活 L2 mutation 解码（[live-stream-bytes-decode](live-stream-bytes-decode.md) S3）
- 绑定叶 SessionBar（pills S3w）
- D31 F4 证据目录

## 7. 相关

- [sources-changes-diff](sources-changes-diff.md) · [sources-review-progress](sources-review-progress.md) · [ADR-005](../decisions/005-changes-diff-owner.md)
- [session-windows.md](../../docs/systems/conversation/session-windows.md) `CONVERSATION_SIDE_GROUP`
- [sources-accept-empty-success](sources-accept-empty-success.md) A1 / P5

## 审查记录

| 轮 | Assessment | 处置 |
|:---|:-----------|:-----|
| 2026-09-18 规则 16 | 不可开实施 → Critical/Important 已改入 | C1：已审改 sources 内 loaded，删 open() reject。C2：Input 拆 identity/model。I3：叶解析写死 roster sessionKey，禁 at(0)。I4：S4 拿掉 workDir/join。I5：finder 用 Conversation hidden，不抄 Preview lock。I6：闸门 prefer 序写进 pane/Move。Minor：失败文案是 pane 自己的那句。 |
| 2026-09-18 规则 16 第二轮 | 不可开实施 → Critical/Important 已改入 | 父核 HEAD 后改入 Critical：S4 找到叶后必须 `openEditor(groupInstance)`，Sources/Move **禁止**再传 `CONVERSATION_SIDE_GROUP`（否则 finder 仍 `at(0)`）。Important：无叶只失败不回 Preview；finder 选定 `showSplitColumn` 再复用（禁 hidden `addGroup`）；S2 含 Panel `getWriteContext`；S3 两处构造传入 `gitPath`/`scmResource`；S1 钉死 loaded 通道、改写 open-resolves 测。Minor：`getConversationPart` 已是同一 Map；`matches()` 可带 gitPath。 |
| 2026-09-18 规则 16 第三轮 | 不可开实施 → Critical/Important 已改入 | 父核 HEAD 后改入 Critical：打开改 `targetGroup.openEditor`（`IEditorService.openEditor(..., groupInstance)` 会被 `handleGroupResult` 弹到 mainPart 再抛）；hidden 复用写在 Sources/Move 找叶路径，用 `part.setGroupHidden`，禁无参 `showSplitColumn()`。Important：`applySourcesGitFileDiffIfNeeded` 拷 gitPath；改写 SIDE_GROUP 锁绿测；S1 conversation/panel open 内部等 loaded；「已是聊天 tab」在 Sources 算组处生效。 |
| 2026-09-18 规则 16 第四轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：S1 失败完成式收成 `open(): Promise<boolean>`（总是结束；仅 true 标已审；禁止挂死 / 禁止失败仍 mark / 禁止再靠 reject）。Minor：算组顺序先同 identity Diff；Move 测 stub 改 `group.openEditor`。 |
| 2026-09-18 规则 16 第五轮 | 改完 C/I 前不可实施 → 已改入 | 父核 HEAD 后改入 Critical：S1 loaded 通道选定 Sources 级 `onDidLoad`（open 前可订）；conversation 读这次 input 终态（含 reveal 短路）；Panel 等 `renderRef`。Important：cancel/generation 早退 = 这次 false；S4 `findGroup`/`addGroup` source = chat 根。Minor：冲突域不再含 finder；禁 `openEditor(..., group.id)`。 |
| 2026-09-18 规则 16 第六轮 | Approve with changes | 父核 HEAD 后改入 Critical：S1 收成一条无 OR 序列（open 前订 → await → 本次事件否则三态否则立刻 false）；Panel 禁止用 `onDidLoad` 代替 `await renderRef`。Important：generation 由调用点分配并传入 pane/panel；三态 `pending\|ok\|fail` 禁止读 `comparisonLoadFailed`；boolean 由 conversation/panel 产出、list 只消费。Minor：chat 根锁 ConversationChatInput 组；禁令限 Conversation 路径。 |
| 2026-09-18 规则 16 第七轮 | Approve with changes | 父核 HEAD 后改入 Critical：cancelled/undefined（非 reveal）立刻 false，禁止再读三态。Important：generation 搭 Input 实例（不进 matches）/ show ref，不改 editorPanes；「调用点」= conversation open / `show()` 不是 list；S1 测锁 cancel / generation 往返 / list 不订事件 / Panel 早退；`show()` 只 await 这一次 `renderRef`，删「或同源 boolean」。Minor：false 文案；失败 reveal 沿用 fail。 |
| 2026-09-18 规则 16 第八轮 | Approve with changes | 父核 HEAD 后改入 Critical：reveal 读已打开 tab 的已落下三态（Review 点已开的 Conversation Diff 必须能 mark；不用新 Input generation 对号）。Important：Panel `renderRef` resolve ≠ 成功，load-fail → false；改写 wiringScan 的 `catch`/`renderGeneration` 锁。 |
| 2026-09-18 规则 16 第九轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：S1 测必须经 L430–446 reveal 夹具，禁止只 stub `open()=>true`；Panel load-fail 必须 join 到 L253–263 那次 `renderRef`，并锁 load-success → true。 |
| 2026-09-18 规则 16 第十轮 | Approve with changes | 父核 HEAD 后改入 Critical：`undefined` 一律 false（reveal 成功返回 pane；reveal 块里 undefined 是 tab 已换）。Important：测必须 spy 未调 `setInput`；Panel success 锁 L266–273；去掉另一条 `void renderRef`，只 join 画完那次。 |
| 2026-09-18 规则 16 第十一轮 | Approve with changes | 父核 HEAD 后改入 Critical：S1 测锁 Conversation fail 仍交 pane → 不 mark（禁止 `return !!pane`）。Important：两次打开 generation 往返，前一次 loaded 不得标后一次。 |
| 2026-09-18 规则 16 第十二轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：④ 夹具必须是前一次已发出 `{genA, ok}` 再换 identity，不能用 L173 早退当「前一次 loaded」。 |
| 2026-09-18 规则 16 第十三轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：④ 后一次须改 `matches()`、仍交 pane、第二次 L197–204 `{genB, false}`，禁止 B 也成功画完。 |
| 2026-09-18 规则 16 第十四轮 | **Approve（无 Critical、无 Important）** | HEAD 与 R13 完成式对齐。可以签收。 |
| 2026-09-19 用户签收 | **accepted** | 无 Critical/Important。转入实施。 |
