---
title: "设计审查 2026-11-04 p2：上游侵入收拢为扩展点"
type: plan
status: accepted
phase: N/A
updated: 2026-11-05
summary: "把编辑器路由、会话叶可见性、聊天打开、水印和主题样式从上游文件收成注册点；布局中心列与会话窗启用逻辑保持不动。"
---

# 设计审查 2026-11-04 p2：上游侵入收拢为扩展点

状态：执行中。
签收：签。签收人：agent:cursor（用户委托），日期：2026-11-05。待定项的决定见文末「待定项」。
覆盖需求：无（正文未引用需求编号）。

本稿是方案，不是实施。不改生产代码。

依据：[ADR-007](../decisions/007-upstream-sync.md) 对上游只留最小 hook；清单在 [upstream-min-patch.md](../progress/upstream-min-patch.md)。壳不变量见 [ADR-006](../decisions/006-shell-invariants.md)、[parts-and-grid](../../docs/systems/workbench/parts-and-grid.md)、[editor-part-tabs](../../docs/systems/workbench/editor-part-tabs.md)、[layout-state](../../docs/systems/workbench/layout-state.md)。产品窗只是默认编辑器窗口，见 [vision](../../docs/product/vision.md)。

相对基线 `004a1fbb` 的行数用 `git diff --numstat 004a1fbb -- <path>` 量过。行号是工作区活码，含未提交改动。

**不推翻：** ADR-002 的第四类 `IConversationEditorPart`；ADR-006 的中心叶与 `Conversation ∨ (Editor ∨ Sources)`；[sources-architecture](sources-architecture.md) P7 已把 Diff 守卫收成 type id 与 scheme（`editorGroupFinder.ts` 第 11 行已引 `workbench/common/editor/conversationDiffReviewInput.js`）。那一层不动。

**要改的已签收句：** P7 第 228 行写明 finder 对 `conversationEditorRouting.js` 的放行保留。p2-1 删掉这处放行。`sourcesWiringScan.test.ts` 第 627、637 行现在锁着 finder 与 eslint 里的这处引用，要一起改。

**不发明：** 新 RPC、新快照字段。

**代码约束：** 新服务用 `createDecorator` 与 `registerSingleton`。注册返回 `IDisposable`，贡献模块立刻登记。`workbench/services` 与 `browser/parts` 不 import `contrib`。不新增用户可见文案；搬走的句子继续走现有 `nls.localize`。

## 冲突域与顺序

| 切片 | 文件 | 依赖 |
|:-----|:-----|:-----|
| p2-1 路由 | `editorGroupFinder.ts`、`editorParts.ts`、`conversationEditorPart.ts`、`eslint.config.js`、`conversationEditorRouting.ts`、`conversationEditor.contribution.ts`、`sourcesWiringScan.test.ts` | 无。先做，因为 p2-2 也改 `editorParts.ts` |
| p2-2 叶可见性 | `editorParts.ts`、`editorGroupsService.ts`、`conversationSessionWindowService.ts` 及其测试 | 等 p2-1。`conversationSessionWindowService.ts` 工作区已有未提交改动，本切片等那份落地或只在干净工位做，不混提交 |
| p2-5 水印 | `editorGroupWatermark.ts`、`categorizedMainEditorPart.ts`、`previewEditorTab.ts` 与水印测试；新的产品贡献文件 | 与 p2-1 无共享文件，可并行。两条核心调用与水印类同一提交，且 `browser/parts` 不 import 贡献 |
| p2-6 样式与主题 | `style.ts`、`productAccessibility.css`、新建 `productShell.contribution.ts`、`workbench.common.main.ts`、`sessions.common.main.ts`、`themes.contribution.ts`、`workbenchThemeService.ts`、`themeConfiguration.ts`、两个 `theme_picker*.ts` | 与 p2-1 无共享文件。6a 先建模块并让两个入口加载。6b 往同一模块加主题覆盖，不和 6a 并行改这个新文件 |
| p2-4 打开出口与设置画像 | `chatShellRouting.ts`、打开 chat 的调用点、`settingsEditor2.ts`、`settingsLayout.ts`、`aiCustomization/aiCustomizationManagementEditor.ts` | 4a 只注册在 conversation 贡献上，可与 6a 并行。4c 的画像服务写进 p2-6 的 `productShell.contribution.ts`，等 6a 建好该文件。`openChatSessionWithPrompt` 与 Editor 位置的 `BugIndicatingError` 本波不动 |
| p2-3 布局 | 不改 `layout.ts` | 工作区该文件已有未提交改动（`focusPart` 两处断言已去掉）。本条只评估 |
| p2-7、p2-8 | 已拍板不改：p2-7 保留 `when`，p2-8 冻结 `src/vs/sessions` | — |

`layout.ts` 未提交 diff 只做了一件事：构造时记下 `IConversationPartService` / `ISourcesPartService`，`focusPart` 改为直接 `focus()`，不再 `as unknown as`。后续切片不要把这两处改回去。

## p2-1 编辑器组路由不再 import contrib

问题类：工作台核心为了知道「这个 input 能不能进 Conversation 组」以及「新建会话叶时打开哪一个默认根」，直接 import 了 conversation contrib。

核实过的证据：

- `editorGroupFinder.ts:14` import `conversationEditorRouting.js`。同一处 import 用在两段：`handleGroupResult` 第 48–64 行，以及 `doFindGroup` 组尚未解析时的第 266–276 行。第 60–63 行抛 `Conversation chat input requires CONVERSATION_GROUP or a conversation editor group`。第 269–271 行抛 `Conversation chat input requires an explicit conversation group target`。`conversationEditorFence.test.ts:322` 锁的是后一句。第 274–276 行对 blocked input 一律改到 `mainPart.activeGroup`，不要求活动组已经在排除聚合 part。
- `editorParts.ts:38` import `ConversationChatInput`。`createConversationEditorPart` 第 311–316 行自己 `createInstance` 默认根并 `openEditor`。
- `conversationEditorPart.ts:20` import `isConversationExtensionTab`。`applyConversationPartOptions` 第 111 行用它决定标签条显隐。
- `eslint.config.js` 有意放行。工作台目标第 1866–1873 行放行 `conversationChatInput.js` 与 `conversationEditorRouting.js`。服务目标第 1907–1913 行只放行 `conversationEditorRouting.js`。注释写明这是故意打破「核心不认识 contrib」。
- [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md) 写明 `browser/parts` 不 import contrib。现状与这句话不一致。
- 相对基线：`editorGroupFinder.ts` +200/−23，`editorParts.ts` +198/−22，`conversationEditorPart.ts` +137/−0，`eslint.config.js` +131/−2（eslint 里不全是这一处）。

不变量：

- 文件、untitled、`ChatEditorInput` 在未点名 Conversation 组时仍进主 Preview。`ConversationChatInput` 与 `ConversationDiffReviewInput` 无点名仍拒绝，不掉进 Preview。
- `createConversationEditorPart` 返回后，该叶活动组里仍有 `isDefaultRoot === true` 的根。现有导航测试靠这个。
- 有延伸标签或可见组多于一个时，Conversation 叶仍显示标签条。判定仍是「非默认根的 chat input，或 Diff 审阅 input」。
- 未注册路由时，chat input 与 Diff 审阅 input 不按 Conversation 类放行，也不抛「必须点名 Conversation 组」。文件、untitled、`ChatEditorInput` 点名 Conversation 组时仍回主 Preview。未注册只跳过默认根，不跳过这道围栏。
- 注册挂在 `conversationEditor.contribution.ts` 顶部的 `import '../common/conversationEditorRouting.js'`。该文件今天不引路由模块。`workbench.common.main.ts:233` 引的是 `conversation.contribution.js`，后者第 31 行才引 editor contribution。不能靠 `conversationNavigationService.ts:18` 的副作用。`conversationEditorFence.test.ts:28` 与 `conversationEditorAggregation.test.ts:28` 已经 import 这份 contribution，注册放在这里它们才会带上围栏和默认根。

要动的符号与文件：

- 新增 `src/vs/workbench/services/editor/common/editorGroupRoute.ts`：`registerEditorGroupRoute` / `getEditorGroupRoute`。路由对象提供 `classify` 与 `createDefaultRoot`。放在 `services/editor/common`，finder 与 `editorParts` 都能读，且不进 `IEditorGroupsService` 方法表。`workbenchTestServices.ts` 里两处 `createConversationEditorPart` stub 不用跟着加方法。
- `conversationEditorRouting.ts` 在模块求值时注册。`classify` 复用现有三个谓词，但返回值是三态，不是「可进组」布尔。`createDefaultRoot` 仍 `createInstance(ConversationChatInput, getDefaultConversationChatResource(sessionKey), { isDefaultRoot: true })`。`conversationEditor.contribution.ts` 增加对这个模块的 import，注册才进产品入口和已 import 该 contribution 的测试。
- `classify` 的三态两处都要问。只改第 48–64 行时，第 269–276 行仍 import contrib，eslint 放行也删不掉。`doFindGroup` 第 176–181 行在 `CONVERSATION_GROUP` 上已经把组定到会话叶，会话叶 `excludeFromGlobalEditorAggregation === true`（`conversationEditorPart.ts:26`）。
- `exclusive`：已注册的 chat input 与 Diff 审阅。组尚未解析（`undefined` 或 `ACTIVE_GROUP`，第 266–271 行）时抛 `requires an explicit conversation group target`。组已经解析时，第 60–63 行只在「未点名且目标组不在 conversation part」时抛 `requires CONVERSATION_GROUP or a conversation editor group`；目标组已经在会话叶里不抛，也不改道到 Preview。第 48–50 行的 `conversationExplicitOpen` 只在 `exclusive` 且点名或显式会话组目标时为真。为真时，第 52–54 行不把排除聚合 part 里的组拨回主 Preview。
- `foreign`：已注册且被挡（文件、untitled、`ChatEditorInput`）。不抛错。组尚未解析时走第 274–276 行：被挡本身就把候选组改到 `mainPart.activeGroup`，活动组在辅助窗也回主 Preview。组已经解析时走第 56–59 行：点名 Conversation 组，或目标组落在排除聚合 part，才改到主 Preview。
- 未注册：两处都不抛，也没有 `exclusive`，所以 `conversationExplicitOpen` 为假。第 52–54 行仍把落在排除聚合 part（含会话叶）的组拨回主 Preview。因此点名 `CONVERSATION_GROUP` 的 chat input 与 Diff 不会留在第 176–181 行定下的会话叶上。组尚未解析时按第 274–276 行进主 Preview。不能把未注册只套进第 56–59 行：那一行只改被挡的 input，chat input 与 Diff 不是被挡。
- 只做成布尔「不可进组就送回 Preview」会把已注册、未点名的 chat input 从抛错改成改道。抛错和改道是两条路，两处都留在 finder，finder 仍不 import contrib。`conversationEditorPart.applyConversationPartOptions` 问路由是否为延伸标签；未注册时按「没有延伸标签」处理。
- `EditorParts.createConversationEditorPart` 改为调用路由的 `createDefaultRoot`。未注册则不打开默认根。

分切片的改法：

本条单独一次提交。

1. 加上注册表。`conversationEditorRouting.ts` 末尾注册。行为与现在相同，只是核心不再点名模块。
2. finder 第 48–64 行和第 266–276 行都改为按 `classify` 的三态走。第 60–63 行与第 269–271 行的两句抛错都留下，文案不改。第 52–54 行的排除聚合拨回留下，只是 `conversationExplicitOpen` 改问 `exclusive`。第 274–276 行的「被挡就回主 Preview」留下。Preview 类别路由（围栏之后）不动。那一段属于已落地的 [preview-category-isolation](preview-category-isolation.md)，本条不改写。
3. `createConversationEditorPart` 用 `createDefaultRoot`。打开失败仍 `onUnexpectedError`。
4. 删掉 eslint 两段放行及旁边解释注释。`conversationChatInput.js` 与 `conversationEditorRouting.js` 都不再出现在核心层的 restrictions 里。这修改 P7 已签收的「放行保留」。同步改 `sourcesWiringScan.test.ts:627` 与 `:637`：finder 不得再包含 `conversationEditorRouting`，eslint 不得再包含该放行。第 626 行 Diff 守卫仍须留在 `common/editor/conversationDiffReviewInput`。

明确不改什么：

- 不把 `ConversationChatInput` 类下沉到 `workbench/common`。P7 下沉的是 Diff 的 type id，因为 sources 与 conversation 都要。chat input 只有 conversation 用。Diff 的 type id / scheme 边界不动。
- 不改 `CONVERSATION_GROUP` / `CONVERSATION_SIDE_GROUP` 的数值。
- 不改 [sources-open-dispatch-and-conversation-target](sources-open-dispatch-and-conversation-target.md) 已经承认的具体组目标。
- 不改围栏白名单的成员：仍然只有 chat input 与 Diff 审阅 input。

本地验证：

- `scripts/test.sh --grep "conversationEditorRouting|CONVERSATION_GROUP \\+ file|CONVERSATION_GROUP \\+ diff|isDefaultRoot|sourcesWiringScan"`
- 文件：`conversationEditorRouting.test.ts`、`conversationEditorFence.test.ts`、`conversationEditorAggregation.test.ts`、`conversationSessionSplit.test.ts`、`conversationNavigation.test.ts`、`conversationNavigationService.test.ts`、`sourcesWiringScan.test.ts`。
- 聚合测试第 155–159 行仍要求默认根 `isDefaultRoot === true`。它已经 import editor contribution；注册必须由那份 contribution 带上，不要另在测试里补 import 凑合。
- 改动文件跑 eslint。`valid-layers-check` 在 D8 修好前不是合入门禁；本条以这两段放行被删掉、且核心文件不再出现上述 import 为准。

风险与回退：注册没挂到 `conversationEditor.contribution.ts` 时，已经 import 该 contribution 的测试会丢默认根。未注册不抛第 269 行和第 60 行那两句，点名 `CONVERSATION_GROUP` 的 chat input 改由第 52–54 行回主 Preview。文件围栏仍应把文件送回主 Preview。回退就是恢复三处 import 与 eslint 放行。

预计减少的冲突面：三处 contrib import（finder、editorParts、conversationEditorPart 各 1 行）和 eslint 两段放行（约 15 行注释加规则）。finder 里围栏分支还在，只是不再认识 contrib 模块。`editorGroupFinder.ts` 相对基线的 +200 行大部分是 Preview 类别，本条不去掉。

## p2-2 会话叶可见性由宿主上报

问题类：`EditorParts` 用 DOM 类名判断哪一片 Conversation 叶可见、哪一片是主叶。类名字符串写在另一侧。

核实过的证据：

- `editorParts.ts` 第 196–324 行是 Conversation part 的创建、销毁和活动叶选择。
- `getActiveConversationEditorPart` 四处 `closest('.conversation-session-leaf')`：第 218、226、233、240 行。第 219、227、234、241 行再看 `conversationSessionLeafHiddenClass` / `conversationSessionLeafPrimaryClass`。
- 这两个 class 常量在 `conversationPart.ts:22-23`。叶容器的类名字符串在 `conversationSessionWindowService.ts:573`：`append(..., $('.conversation-session-leaf'))`。隐藏类在第 638 行 toggle。主叶 / 次叶类在第 577–579、623–633 行。
- `IConversationEditorPart` 在 `editorGroupsService.ts:533-556`。服务方法在第 730、736、742–743、748、753 行。
- 辅助 part 在 `auxiliaryEditorPart.ts:202` `registerPart`，模态 part 在 `modalEditorPart.ts:293`。`createAuxiliaryEditorPart` 与 `createModalEditorPart` 的声明在 `editorParts.ts:180` 与 `:343`，这两处函数体不调用 `registerPart`，也不读 Conversation 叶的 CSS 类。Conversation 叶已经在 `editorParts.ts:273` `registerPart`，多出来的是类名探测和默认 input。
- 相对基线 `editorParts.ts` +198/−22，`editorGroupsService.ts` +63/−0。接口本身按 ADR-007 留在 A 表，不删。

不变量：

- 焦点在某可见叶内时，`getActiveConversationEditorPart` 返回该叶。
- 焦点不在任何叶内时，用 `focusedConversationLeaf`，但该叶已隐藏则不用。
- 再否则主叶，再否则任意可见叶。与现在四段顺序一致。
- 隐藏叶不接收 `CONVERSATION_GROUP`。`conversationSessionSplit.test.ts` 里「从不落到隐藏组」仍成立。
- CSS 类还在叶容器上，样式选择器不变。变的是 `EditorParts` 不再读这些类。

要动的符号与文件：

- `IConversationEditorPart` 增加宿主上报：`setLeafHostState(state: { visible: boolean; primary: boolean })`，以及只读的 `leafVisible` / `leafPrimary`。默认 `visible: true`、`primary: false`，避免创建后、上报前被当成隐藏。
- `setLeafHostState` 写在 `createConversationEditorPart` 返回之后、`await part.whenReady` 之前。工作区里创建调用是 `conversationSessionWindowService.ts:609`，等待是第 612 行。第 573–579 行只创建容器并写上 primary / secondary 类，那时还没有 part，不能在那里上报。用刚刚写上的 primary 与 `leaf.hidden`。第 623–638 行每次改主次或隐藏类之后立刻再报，中间不 `await`。该文件已有未提交改动，行号会移；锚点是「创建返回之后、`whenReady` 之前」，不是写死的行号。
- 真服务在 `createConversationEditorPart` 返回后调用 `setLeafHostState`。凡是把假 part 交回这个真服务的 stub 都要补上 `setLeafHostState`、`leafVisible`、`leafPrimary`，漏了会在上报时抛错。`conversationSessionWindowService.test.ts` 有五处，不只第 89 行：第 89、158、229、299、364 行。同形的还有 `conversationSessionWindowLayout.test.ts:41-46`、`conversationSessionWindowSideBySide.test.ts:216`（第 549 行在返回 part 之前就抛，不用补）、`conversationSessionWindowReveal.test.ts:251` 与 `:1425`。`conversationLifecycleAndRefresh.test.ts` 的假 part 不经过这个服务，不用补。
- `getActiveConversationEditorPart` 改为读这些字段，删掉四处 `closest` 和对 `ConversationEditorPartImpl` 的容器强转。
- `editorParts.ts:30` 对 `conversationPart.js` 两个 class 常量的 import 删除。

分切片的改法：

等 p2-1 提交后再做。一次提交。行为变化：活动叶的来源从 DOM 类变成宿主上报。类名写错但上报正确时，路由跟上报走，样式仍跟类名走。两边必须在同一段同步代码里更新。

明确不改什么：

- 不把 `ConversationEditorPartImpl` 搬出 `parts/editor`。ADR-007 把 Part 挂点留在 A 表。
- 不删 `createConversationEditorPart`、`conversationParts`、`setFocusedConversationLeaf`。
- 不改叶的网格、最多两叶、隐藏叶保留模型。那些属于会话窗口，不在本条。

本地验证：

- `scripts/test.sh --grep "getActiveConversationEditorPart|hidden group|conversation-session-leaf|Conversation session window layout"`
- 文件：`conversationSessionWindowService.test.ts`、`conversationSessionWindowLayout.test.ts`、`conversationSessionWindowSideBySide.test.ts`、`conversationSessionWindowReveal.test.ts`、`conversationSessionSplit.test.ts`、`conversationEditorPartLayout.test.ts`。
- 这些窗口测试里有的已有未提交改动。实施时只加本条断言，不回退别人的改动。

风险与回退：默认 `visible: true`。隐藏之后漏报，这片叶仍算可见，`getActiveConversationEditorPart` 可以把它交出去，`editorGroupFinder.ts:176-181` 的 `CONVERSATION_GROUP` 就会继续落到已隐藏的叶上。反向漏报（可见叶被报成隐藏，或该报的可见没报上）才会让焦点落到另一片可见叶，或找不到目标。回退恢复 `closest`。

预计减少的冲突面：`editorParts.ts` 里活动叶函数约 35 行 DOM 探测，以及第 30 行 class import。第 257–324 行的创建、布局和 `registerPart` 留下。相对基线 +198 行不会整段消失。

## p2-3 布局里哪些段值得收

问题类：`layout.ts` 里 Conversation / Sources 标识很多。核查认为中心列就是产品壳，不能全抽。本条只判断哪几段有收益。

核实过的证据：

- 工作区 `layout.ts` 里，大小写敏感的 `conversation` / `Conversation` 与 `sources` / `Sources` 出现 195 次、分布在 157 行。`CONVERSATION_PART`、`SOURCES_PART` 不在这 157 行里。不区分大小写是 276 次、200 行。本条判断用前一个数。核查稿写的约 80 处更窄。多出来的是 `sourcesPartView`、`setSourcesHidden` 这类布局字段。
- 相对基线 +564/−123。文件在 [upstream-min-patch](../progress/upstream-min-patch.md) A 表「默认窗拓扑」。收缩条件是拓扑稳定后只留注册行。
- 互斥公式已经在 `layoutService.ts:56` 的 `forceShownAgentShellPart`。`setEditorHidden` 从 `layout.ts:2018` 开始。第 2018–2134 行是 `setEditorHidden` / `setConversationHidden` / `setSourcesHidden` / `enforceAgentShellVisible` / `ensureAgentShellMinimumVisible`，负责写状态、改 CSS 类、调 grid。第 2039 行是 `setEditorHidden` 中段对 `enforceAgentShellVisible` 的调用，不是这段的起点。
- 禅模式在 `toggleZenMode`：进入时第 1543–1555 行记下 editor / sources / conversation 可见性并强制 Conversation 可见、藏 End 列；退出时第 1631 行之后按快照恢复。这与 [layout-state](../../docs/systems/workbench/layout-state.md) 和 [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md) 一致。
- 工作区未提交改动已去掉 `focusPart` 两处 `as unknown as`（约原第 1340 行）。`IConversationPartService.focus` 在 `conversationPart.ts:181`。

收益与风险：

| 段 | 判断 |
|:---|:-----|
| `createGridDescriptor`、中心叶、`conversationPartView` / `sourcesPartView` | 不抽。这是 A 表要留的拓扑。抽走会把 ADR-006 的中心叶变成可替换策略，合并时更容易被上游 grid 改回去。 |
| 三个 `set*Hidden` 与 `enforceAgentShellVisible` | 不抽。公式已经在 `layoutService.ts`。setter 必须碰 grid 与 CSS 类，搬到 contrib 仍然要回调 layout，hook 不会更短，INV-052 的回归面变大。 |
| `toggleZenMode` 里记下 editor / sources / conversation，并强制 Conversation 可见、藏 Editor 与 Sources | 可以抽，本波不抽。产品行是第 1543–1545 行与第 1553–1555 行。第 1549–1551 行藏 Panel / Aux / Sidebar 是上游禅模式，抽的时候留下。退出恢复从第 1631 行起；第 1619–1629 行是上游对 Panel / Aux / Sidebar 的恢复。抽成策略后 layout 仍要提供 `setPartHidden`，冲突行数下降有限。快照字段 `wasVisible.conversation` / `sources` 留在 layout state，不能挪。见「待定项」。 |

明确不改什么：本条不改 `layout.ts`，也不改 `LayoutStateKeys`。

本地验证：不产生代码，无测试。若以后做禅模式那一刀，再跑 layout 显隐测试，并人工走一次进入 / 退出禅模式，确认 End 列恢复进入前的样子。

预计减少的冲突面：本波 0 行。禅模式那一刀若做，离开 `toggleZenMode` 的产品显隐是进入侧第 1543–1545 行与第 1553–1555 行（6 行），加上退出侧第 1631–1641 行。第 1549–1551 行与第 1619–1629 行留下。文件相对基线的 +564 行几乎还在。

## p2-4 打开 chat 的单一出口，以及设置页窗口画像

问题类：默认窗要把「打开 Chat 编辑器」改成聚焦 Conversation，这个判断复制在多处 chat 上游文件里。设置页用 `isSessionsWindow` 和 `ua.client` 前缀决定紧凑布局，逻辑写在设置编辑器里。

核实过的证据：

`isDefaultCodeWindow` 定义在 `chatShellRouting.ts:12-14`，只是 `!isSessionsWindow`。生产调用 24 处，不含测试、不含定义本身，也不含同文件第 18 行 `shouldRouteChatEditorToConversation` 对它的转发（没有生产调用方，只有 `chatShellRouting.test.ts` 第 77、81 行）。`conversationForkActions.contribution.ts:102` 只是布尔转发，不是动作守卫。

| 位置 | 处数 | 在做什么 |
|:-----|:-----|:---------|
| `agentSessionsActions.ts` 978、1020、1056 | 3 | 聚焦 Conversation 后 return |
| `chatActions.ts` 233、650、689、848、878 | 5 | 同上 |
| `agentSessionsOpener.ts:189`、`chatMoveActions.ts:51` | 2 | 同上 |
| `chatSessions.contribution.ts` 1714、1754 | 2 | 同上。1714 仅在有 `chatOptions` 时聚焦 |
| `agentSessionsActions.ts` 99、126、1122、1287、1324 | 5 | 默认窗直接 return，不聚焦 |
| `chatSessions.contribution.ts:1750-1751`、`chat.contribution.ts:312-313` | 2 | 默认窗且位置是 Editor 时抛 `BugIndicatingError` |
| `conversationForkActions.contribution.ts` 34、79、102；`conversationKillActions.contribution.ts:81`；`conversationCreateSnapshotActions.contribution.ts:173` | 5 | 在自有树里，反向判断「只在默认窗执行」 |

前 19 处在 `contrib/chat`，是上游冲突面。后 5 处在 `contrib/conversation`，不是。

`openChatSession` 第 1750–1757 行：Editor 位置先抛错；其它位置聚焦 Conversation 并 return，不调用后面的 session 创建。`chatShellRouting.test.ts` 第 85 行起锁着：默认窗 Editor 抛 `BugIndicatingError`，且 import store 的 `set` 未被调用。

设置：

- `settingsEditor2.ts` 的 `environmentService.isSessionsWindow` 共 10 处：第 437、451、485、539、947、1049、1754、2304、2473、2578 行。
- `isUaClientSettingsView` 在第 110–118 行：会话窗恒为 false；否则仅当查询是纯 `ua.client.` id 过滤，或空查询且类别为 `ua` / `ua/` 前缀。
- 目录过滤在 `settingsLayout.ts`（相对基线 +168/−1，文件内 `isSessionsWindow` 与 `ua.client` 共 15 处）。`settingsEditor2.ts` 相对基线 +569/−201，不全是窗口判断。
- `aiCustomizationManagementEditor.ts` 用 `workspaceService.isSessionsWindow` 15 处（第 468、605、612、639、664、990、1037、1086、1227、1243、1403、1416、1565、2498、2772 行）。整文件 +490/−90，本条只动这些判断。

已有合同：[m5-ui-shell-hardening](m5-ui-shell-hardening.md) 第 102 行把 `chatShellRouting.ts` 定为唯一窗口路由与聚焦 helper，第 169 行禁止 `contrib/conversation` import 该文件。第 90 行禁止把待发送 prompt 静默丢掉后只聚焦 Conversation。第 89 行是另一条禁令：不得先创建或迁移 session，再发现默认窗不能开 Editor。ADR-006 相关节第 60 行把 `layout.ts`、`chatShellRouting.ts`、`conversationImportBoundaries.test.ts` 并列成三条不变量的代码落点，不是单把该文件写成 `INV-NO-COPILOT` 的落点。本条不删这个文件，也不改那份 ADR。装饰器不放在 `chatShellRouting.ts`，否则 conversation 贡献为了注册实现必须 import 它。[settings-two-surfaces](settings-two-surfaces.md) 已定 Client 与 Engine 两套设置面。本条不重开宿主。`isUaClientSettingsView` 的真值表不变，`settingsEditor2.test.ts` 第 68–94 行三个用例继续锁。

不变量：

- 除 `openChatSessionWithPrompt` 外，默认窗执行「打开 chat」时，可见结果仍是聚焦 Conversation（不可见则先显示）。不创建 `ChatEditorInput`。
- `openChatSessionWithPrompt`（第 1714–1718 行）保持现状：有 `chatOptions` 才聚焦，并且总是 return，不发送。无参 `openInstead()` 收不了这个分支。它和 m5「不得丢掉待发送 prompt」已经不一致；本波不改这个函数，也不把它收进出口。
- 会话窗这些命令仍走原来的 chat 打开路径。
- 5 处「默认窗直接 return」继续读 `chatShellRouting.isDefaultCodeWindow`，不改读设置画像。它们不是打开。
- 自有树里 5 处反向判断保持只在默认窗执行。
- 设置紧凑布局的条件与现在的 `isUaClientSettingsView` 相同。

要动的符号与文件：

- 新增 `IProductChatOpenRoute`（`createDecorator`），放在 `workbench/services` 下，不放在 `chatShellRouting.ts`。只由 `conversation.contribution.ts` 注册。`openInstead(): boolean` 为真表示这是默认窗。会话窗不加载这份贡献，保持未注册。这和 4c、6a、6b 相反：那三处两个窗口都要加载。
- `focusConversationPart(accessor): boolean`。现在是 `void`（`chatShellRouting.ts:22-29`）。返回值就是 `openInstead()` 的结果：真表示 helper 已经显示并聚焦 Conversation，调用方 `return`；假表示不聚焦，调用方继续原来的 chat 打开。未注册时不抛，用可选获取，不要必选 `accessor.get`。未注册返回 false，不聚焦。
- 除第 1714 行外，现在写成 `if (isDefaultCodeWindow(accessor)) { focusConversationPart(accessor); return; }` 的调用改成 `if (focusConversationPart(accessor)) { return; }`。chat 文件不直接 `get` 这个服务，也不再各写一遍 `isDefaultCodeWindow`。调用方要能 `return`，所以布尔必须从 helper 传出来。
- 5 处纯 return 不动，继续 `isDefaultCodeWindow`。
- 设置画像服务 `IProductWindowProfile`：`isSessionsWindow`、`isClientSettingsView(query, categoryId)`。`isSessionsWindow` 仍读 `IWorkbenchEnvironmentService.isSessionsWindow`，不按「有没有加载 conversation 贡献」推断。`isUaClientSettingsView` 的函数体原样搬进 `productShell.contribution.ts`（见 p2-6）。`settingsEditor2.ts` 与 `settingsLayout.ts` 改为问服务。`src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts` 的 15 处改为问 `isSessionsWindow`。不把注册挂在 `uaClientSettings.contribution.ts` 上：那份文件只由 `conversation.contribution.ts:12` 加载，会话窗没有这条链。会话窗会构造 `SettingsEditor2`（`sessions.common.main.ts:211` 加载 `preferences.contribution`）。服务不在时，`get` 会在会话窗抛错。

分切片的改法：

1. p2-4a：改 `focusConversationPart` 的签名与转调，以及除第 1714 行以外已经调用它的打开点。产品入口注册了服务之后，默认窗仍聚焦并 return，会话窗仍走原来的 chat 打开。`chatShellRouting.test.ts:236-251` 在默认窗调用 helper、不注册该服务，并断言 focus 发生。4a 必须让这条测试注册 `openInstead() === true` 的实现，否则失败。不能用「行为不变」盖住这条测试。`BugIndicatingError` 两处与 `openChatSessionWithPrompt` 留在原地。
2. p2-4c：设置与 Customizations 改读画像。注册写在 p2-6 的 `productShell.contribution.ts` 里，等 6a 建好该文件。`isUaClientSettingsView` 从 `settingsEditor2.ts` 删掉，测试改为从新模块 import，断言数据不变。`settingsEditor2.test.ts` 只测这个纯函数，不构造 `SettingsEditor2`。

没有 p2-4b。5 处纯 return 不并进画像。

明确不改什么：

- 不改 `IsSessionsWindowContext` 的定义（`contextkeys.ts:37`）。菜单 `when` 仍用它。
- 不改 Copilot `package.json` 的 `when`。那是 p2-7。
- 不把 chat 贡献整棵迁出。ADR-007 只允许薄门闩。
- 不删 `chatShellRouting.ts`。删了要改 ADR-006 的落点，本方案不动那份 ADR。
- 不改 `openChatSessionWithPrompt` 第 1714–1718 行。

本地验证：

- `scripts/test.sh --grep "openChatSession|isDefaultCodeWindow|isUaClientSettingsView"`
- 文件：`chatShellRouting.test.ts`、`settingsEditor2.test.ts`。
- 4a 之后，`openChatSession fails fast for default-window Editor` 仍抛 `BugIndicatingError`（待定项 1 已选保持抛错）。`openChatSessionWithPrompt does not load or send in the default Code window` 仍不加载、不发送。

风险与回退：服务没注册时，`focusConversationPart` 返回 false，不聚焦。会话窗本来就不注册，这是预期。默认窗若漏了 conversation 贡献上的注册，会短暂走出 chat 打开，并且 `chatShellRouting.test.ts:236-251` 在补上测试内注册之前会失败。回退恢复 helper 里的直接聚焦，签名回到 `void`。

预计减少的冲突面：打开判断从十多处调用点收进 `focusConversationPart` 一次转调。调用点留下 `if (focusConversationPart(accessor)) { return; }`，不再各写 `isDefaultCodeWindow`。`chatShellRouting.ts` 相对基线 +29/−0，留下。5 处纯 return 的冲突行不去掉。`settingsEditor2.ts` 的 +569 行不整文件消失；挪走的是第 110–118 行和 `settingsLayout.ts` 里约 168 行新增里的窗口分支。Customizations 15 处判断离开该文件，+490 行里的其它本叉逻辑不动。

## p2-5 水印的提示项和命令解析

问题类：空态水印为了在引擎已连接且 Pty 桥可用时换一条命令，注入了 Universe Agent 连接与 Pty，并把 Preview 各类空态文案写在上游水印类里。

核实过的证据：

- `editorGroupWatermark.ts:22-23` import `IUniverseAgentConnection` 与 `IUniverseAgentPty`。构造函数第 136–137 行注入。同文件第 91–106 行 `executePreviewTerminalEmptyState` 自己 `accessor.get` 这两个服务，不经过构造注入。
- 生产调用这两处仍在核心层：`categorizedMainEditorPart.ts:295`（`handleEmptyGroupDoubleClick`，空组双击）和 `previewEditorTab.ts:74`（Terminal 类 `+` 按钮）。它们 import 的是水印模块里的这个函数，自己不 import 连接或 Pty。
- 第 83–107 行 `previewTerminalEmptyStateCommand` / `executePreviewTerminalEmptyState`：已连接且 `isBridgeAvailable()` 为真时用 `previewUniverseAgentPtyEditorCommandId`，否则 `workbench.action.createTerminalEditor`。空态按钮、双击、`+` 按钮都走这条命令选择。
- 第 166–169 行在第一次 `render()`（第 171 行）之前：Preview 空态且已连接就调用 `queryBridgeAvailable`。`bridgeAvailable` 初值是 `false`（第 183 行）。已连接时第 205 行先把它写成 `undefined` 再探测。第 399–409 行只在值为 `undefined` 时不给按钮命令；值为 `false` 且已连接时给出的是本地命令。第 491–493 行在已有 command id 时直接执行并 return，不会进第 247 行的等待。第 183–245 行：拒绝不等于确认不可用；代次对不上不写结果。
- 第 330–354 行 `getCategoryIconClass` 是类别图标。第 357–433 行是七个 Preview 类别的标题、说明和按钮（按钮上的 icon 字符串在 `getCategoryActions` 里）。文案归属见 [editor-part-tabs](../../docs/systems/workbench/editor-part-tabs.md)，本条只搬家，不改句子。图标方法随文案走，不留在水印类里。
- 相对基线 +348/−8。测试 `editorGroupWatermark.test.ts` 直接 stub 连接和 Pty，并锁命令 id（例如第 202–208 行桥可用时执行 Pty 命令）。

不变量：

- 未连接、桥不可用、探测抛错：空态按钮、双击（`categorizedMainEditorPart.ts:295`）和 Terminal `+` 按钮（`previewEditorTab.ts:74`）都走本地 `workbench.action.createTerminalEditor`。三条调用同一条核心函数。
- 已连接且桥可用：走 Pty 编辑器命令。探测被拒绝时按钮不换成 Pty 命令，下一次点击重新探测。
- 代次：连接变化或 dispose 后，旧探测的结果不得 `render`。
- 七个类别的标题、说明、按钮 id 与图标字符串保持原样。
- 非 Preview 的普通空窗快捷键列表（Show All Commands 等）留在水印类里，不进贡献。

要动的符号与文件：

- 在 `services/editor/common` 或 `browser/parts/editor` 加一个注册表 `registerEditorGroupWatermarkTips`。贡献提供：终端空态命令解析，以及按 `PreviewCategory` 返回标题、说明、类别图标和动作。未注册时命令 id 用本地 `workbench.action.createTerminalEditor`，类别空态用现在的默认分支。
- `executePreviewTerminalEmptyState` 留在 `browser/parts`（水印模块或同目录的核心文件）。`categorizedMainEditorPart.ts:295` 与 `previewEditorTab.ts:74` 继续调用这个函数，不改为 import 贡献。函数体改为问注册表，不再 `accessor.get` 连接和 Pty，因此第 22–23 行的平台 import 删掉。调用方继续 import 这个函数，并不要求水印模块留着那两行 import。让 `browser/parts` import `contrib` 违反本文代码约束和 [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md) 第 39 行。
- 新文件 `src/vs/workbench/contrib/conversation/browser/previewEmptyState.contribution.ts`，由已 import 的 conversation 贡献链带上。把第 76–107 行的命令选择（含 `executePreviewTerminalEmptyState` 里的连接与 Pty 探测）、第 166–169 行在第一次 `render` 之前的探测启动，以及第 183–298 行的探测和 `onDidChangeConnection` 整段（含第 205 行把桥标成未知、第 292–296 行重连后重新探测并 `render`）搬入。不要停在第 290 行的断开分支。第 166–169 行若留在水印类，构造注入删掉之后已连接的第一帧会用初值 `false` 画出本地 New Terminal，第一次点击走第 491–493 行，不等探测。搬完后，已连接时第一次 `render` 之前桥仍是 `undefined`，按钮没有 command id，点击仍进等待。第 330–354 行的类别图标和第 357–433 行的标题、说明、按钮原样搬入。水印类只把贡献返回的 icon class 画上去。`nls.localize` 的 key 保持不变，避免已有语言包对不上。
- `EditorGroupWatermark` 删掉两个构造注入和第 22–23 行的平台 import。点击与渲染改为问贡献。

分切片的改法：

一次提交，含水印类、`categorizedMainEditorPart.ts`、`previewEditorTab.ts` 和贡献。行为变化只在贡献未加载时：Terminal 空态、双击和 `+` 按钮不再探测引擎，只用本地命令。产品入口会加载贡献。会话窗不加载 conversation 贡献；它的 editor part 标明自己不是 Preview（`sessions/browser/parts/editorPart.ts:24-26` 不画类别条），不走这条类别空态。

明确不改什么：

- 不改 `MenuId.EditorGroupWatermarkToolbar` 的工具条。
- 不改 [cursor-visual-alignment](cursor-visual-alignment.md) 里键帽样式的结论。那是另一处只传 `KeybindingLabel` 样式、不动 CSS 的改动。
- 不改空态文案的承诺是否真实。那是别的审查条，本条只搬位置。

本地验证：

- 探针代次、拒绝、点击等待的用例从 `editorGroupWatermark.test.ts` 拆到贡献测试，断言原命令 id。
- 水印测试改为 stub 贡献：贡献返回某 id 时，键位查找和点击执行该 id。
- `scripts/test.sh --grep "EditorGroupWatermark|previewTerminal|bridgeAvailable"`

风险与回退：贡献注册晚于第一帧，或漏搬第 166–169 行，已连接的空态会先画本地命令，第一次点击不等探测。注册放在 import 时，水印构造时贡献已在，并且第一次 `render` 之前桥已被标成未知。回退恢复两个注入。

预计减少的冲突面：`editorGroupWatermark.ts` 相对基线 +348 行里，探测、类别图标与类别文案大约 250 行离开该文件。快捷键表和渲染骨架留下。第 22–23 行平台 import 消失，并且 `executePreviewTerminalEmptyState` 不再引用连接和 Pty。两个调用方不新增这两行 import。

## p2-6 样式入口与默认主题常量

问题类：全局样式文件多了两行产品 CSS import。默认主题常量被改成产品主题名，测试把这个名字锁死。产品接口上没有 `configurationDefaults` 可读。

核实过的证据：

- `style.ts:7-8` 相对基线新增 `productAccessibility.css` 与 `ua-common.css`。`git diff 004a1fbb` 只有这两行。
- 默认窗 `workbench/browser/workbench.ts:6` 与会话窗 `sessions/browser/workbench.ts:6` 都 import `style.js`。`sessions.main.ts:68` 加载会话 workbench。删掉 `style.ts` 这两行，两条入口的样式表一起掉。
- `productAccessibility.css` 是新文件，128 行，只有 `style.ts:7` 这一处 import。
- `ua-common.css` 203 行，A 表已登记。另一处 import 是 `conversationPart.ts:7`。`layout.ts:30` 静态 import `conversationPart.js`，所以默认窗还有这条入口。会话树不引 `conversationPart`，也不引 `ua-common.css`。会话窗的这张表只从 `style.ts:8` 进来。
- 高对比只加在 `.preferences-editor` 的焦点、选中和列表选中：`ua-common.css` 第 61–62、79–80、89–90 行。`.part.editor` 只缩小 letterpress：第 169–170 行。同文件还有 conversation / sources 的高对比规则，那些留在原文件。
- `ThemeSettingDefaults.COLOR_THEME_DARK` / `LIGHT` 在 `workbenchThemeService.ts:42-43`，相对基线从 `Dark 2026` / `Light 2026` 改成 `UniverseAgentStudio Dark` / `Light`。测试第 217–220 行锁这两句，并断言不是 `Light 2026` / `Dark 2026`。
- 启动占位色用常量比较：`workbenchThemeService.ts`（browser）第 154 行。对不上则 `defaultColorMap` 为 undefined，首帧没有这张色表。
- `getDefaultColorThemeSettingsIdForColorScheme`（common 第 198–208 行）按色板返回这两个常量。`isNewDefaultThemeNotificationEligible` 第 111 行用常量判断「是不是默认主题」。`themes.contribution.ts` 第 592、607 行用常量筛「新默认主题」并选中当前色板那一条；同一动作的接受处理在第 635–636 行把 `PREFERRED_LIGHT_THEME` / `PREFERRED_DARK_THEME` 写成这两个常量。第 706–707、725 行用常量做说明和钉选。`theme_picker.ts` 与 `theme_picker_small.ts` 把常量写进入门页 checkbox。常量恢复成 `Light 2026` / `Dark 2026` 之后，若第 635–636 行仍写常量，接受新主题会把首选写成上游名。
- 两个窗口加载同一份主题服务和同一份主题贡献：默认窗 `workbench.common.main.ts:98` 与 `:401`，会话窗 `sessions.common.main.ts:94` 与 `:377`。`sessions.desktop.main.ts:15` 与 `sessions.web.main.ts:15` 都先 import `sessions.common.main.js`。覆盖若只挂在 conversation 贡献上，只出现在默认窗。
- `IProductConfiguration`（`base/common/product.ts`）有 `onboardingThemes`，没有 `configurationDefaults`。全仓没有 `product.configurationDefaults` 的读取点。`product.json` 的 `onboardingThemes` 已经写了 Universe 主题 id（第 208–227 行），那是入门页数据，不是设置默认值。
- 主题 schema 在 `themeConfiguration.ts:145` 求值时登记。`workbench.common.main.ts:98` import `workbenchThemeService.js`，从而拉入这份 schema，早于第 401 行的 `themes.contribution.ts`。会话窗对应点是 `sessions.common.main.ts:94`，早于第 377 行的同一份 `themes.contribution.ts`。`registerDefaultConfigurations` 写在这两处主题服务 import 之后时，属性已在，走 `configurationRegistry.ts` 第 536–539 行立刻改默认。写在主题服务 import 之前才会先存起来，等 schema 登记时再套用。两条都生效。产品覆盖放在两个入口都 import、且位于主题服务 import 之后的模块里。
- 会话窗加载设置贡献：`sessions.common.main.ts:211` 是 `preferences.contribution.js`，默认窗是 `workbench.common.main.ts:219`。`uaClientSettings.contribution.ts` 只由 `conversation.contribution.ts:12` 加载。`workbench.common.main.ts:233` 才加载 conversation 贡献。会话入口没有这条链。
- 相对基线 `workbenchThemeService.ts`（common）+386/−212。大头是 `COLOR_THEME_*_INITIAL_COLORS` 色表，和两行常量缠在同一文件里，但不等于这两行。

不变量：

- 用户没改过主题时，默认窗和会话窗的暗色有效默认仍是 `UniverseAgentStudio Dark`，亮色仍是 `UniverseAgentStudio Light`。高对比两个默认仍是 `Default High Contrast` 与 `Default High Contrast Light`。会话窗不因「不加载 conversation 贡献」退回 `Dark 2026` / `Light 2026`。
- 首帧占位色仍是现在这张表（例如暗色 `activityBar.background` 为 `#191A1B`）。不允许先闪上游 `Dark 2026` 的色再换。
- 主题选择器里钉选的仍是这两个 Universe 主题，不是 `Dark 2026`。
- `.preferences-editor` 的高对比焦点 / 选中、`.part.editor` 的 letterpress 尺寸与透明度不变。
- `ua-common.css` 的规则文本不改。

要动的符号与文件：

- 新建 `src/vs/workbench/browser/productShell.contribution.ts`，作为两个窗口都会加载的产品壳模块。6a 在这里 import 搬迁后的 `productAccessibility.css` 和现有的 `ua-common.css`。6b 在同一文件调用 `registerDefaultConfigurations`。4c 在同一文件 `registerSingleton(IProductWindowProfile)`。不放进 `conversation.contribution.ts`，会话窗不加载那份贡献。`IProductChatOpenRoute` 不放这里：会话窗不注册它，才不会把 chat 打开改道到 Conversation。
- p2-6a：删 `style.ts` 两行 import。`workbench.common.main.ts` 在第 98 行之后、`sessions.common.main.ts` 在第 94 行之后各 import 这个模块。`ua-common.css` 留在 `parts/conversation/media/`，因为 `conversationPart.ts:7` 和 `conversationLensCssScan.test.ts` 第 75–76 行写死了这条路径。默认窗经 `conversationPart` 会再加载一次，同一模块只求值一次。会话窗没有 `conversationPart`，只靠这个新模块。
- p2-6b：两个常量恢复为 `Dark 2026` / `Light 2026`。`productShell.contribution.ts` 调用 `registerDefaultConfigurations`，覆盖 `workbench.colorTheme`、`workbench.preferredDarkColorTheme`、`workbench.preferredLightColorTheme`。两个入口都已 import 该模块，覆盖才同时出现在默认窗和会话窗。`getDefaultColorThemeSettingsIdForColorScheme` 改为返回覆盖后的有效默认，高对比两支仍返回原常量。占位色查找（browser 第 154 行）、通知资格（第 111 行）、钉选（第 592、607、706–707、725 行）、接受新主题时写下的首选（第 635–636 行）、两个 theme picker 改为问这个函数或已注册的产品主题 id，不再问恢复后的常量。第 635–636 行若仍写常量，接受新主题会把首选写成 `Light 2026` / `Dark 2026`。
- p2-6c（同一条的第二片，建议做）：把现在的 Universe 色表移到产品贡献，并在主题服务构造前 `registerInitialColorTheme(themeId, colors)`。核心文件里的 `COLOR_THEME_*_INITIAL_COLORS` 恢复基线内容，只在设置 id 等于上游默认名时使用。产品 id 命中注册表。注册点同样要进两个入口，不能只挂 conversation 贡献。

分切片的改法：

1. 6a 一次提交。外观不变：两张样式表仍由默认窗和会话窗的启动图加载，只是不再经过 `style.ts`。会话窗加载 `style.ts`、主题服务和设置贡献，不加载 conversation 贡献。6a 不能把 CSS 只挂在 conversation 贡献上。
2. 6b 与 6c 分两次提交，都改 `productShell.contribution.ts`，排在 6a 之后。6b 单独落地时，占位色查找必须已经改成按有效主题 id 取表现在的色表，否则常量一恢复，首帧对不上 `UniverseAgentStudio Dark`。第 635–636 行必须改成写产品主题 id。6c 再把色表本体移走，核心文件恢复上游色值。

明确不改什么：

- 不给 `IProductConfiguration` 加 `configurationDefaults`。本叉没有读取点，加字段是另一处上游类型。
- 不改高对比主题的两个常量。
- 不改 [review-2026-10-06-ui-r16-themes-plan](review-2026-10-06-ui-r16-themes-plan.md) 里的提示时机。本条只保证资格判断仍把「停在产品默认主题」当成默认主题。那份方案仍是草案，实施时不要和它抢 `decideNewDefaultThemeNotification`。
- 不改 `ua-common.css` 里 conversation / sources 的规则。

本地验证：

- `scripts/test.sh --grep "ThemeSettingDefaults|COLOR_THEME_DARK_INITIAL|ua-common.css keeps balanced"`
- 文件：`workbenchThemeService.test.ts`、`conversationLensCssScan.test.ts`。
- 第 217–220 行四条都改：217–218 锁定亮色常量是 `Light 2026`，219–220 锁定暗色常量是 `Dark 2026`。第 225–227 行在不加载产品贡献的主题单测里仍是「属性默认等于常量」。第 231–239 行用常量去 manifest 里找主题文件，并断言 path 是 `./themes/universe-agent-studio-light.json` 与 `universe-agent-studio-dark.json`。常量恢复后，这里会去找 `Light 2026` / `Dark 2026`，断言失败。这两处查找改成字面量 `UniverseAgentStudio Light` / `UniverseAgentStudio Dark`，不要再读恢复后的常量。另加一个加载贡献的用例：覆盖之后暗色有效默认是 `UniverseAgentStudio Dark`，亮色是 `UniverseAgentStudio Light`，占位色 `activityBar.background` 仍是 `#191A1B`。
- 没有现成的整窗视觉测试。实施时看一次默认窗冷启动：首帧不是上游 Dark 2026 的活动栏蓝边，设置页高对比焦点框仍在。

风险与回退：6a 若只删 `style.ts` 两行、不在 `sessions.common.main.ts` 补上模块，会话窗丢掉 `productAccessibility.css` 和 `ua-common.css`。6b 若覆盖只挂在 conversation 贡献上，会话窗的有效默认退回 `Dark 2026` / `Light 2026`。6b 若漏改第 154 行，已保存 Universe 主题的用户首帧没有占位色。漏改第 635–636 行，接受新主题会把首选写成上游名。4c 若把 `IProductWindowProfile` 只挂在 `uaClientSettings.contribution.ts` 上，会话窗构造 `SettingsEditor2` 时服务不存在。6c 恢复上游色表时，通知逻辑和色表在同一 diff 里，禁止整段 checkout 该文件。回退恢复两行常量与 `style.ts` 的 import，并去掉两个入口上的新 import。

预计减少的冲突面：`style.ts` 的 +2 行整段消失。`workbench.common.main.ts` 与 `sessions.common.main.ts` 各增加一行 import。`productAccessibility.css` 128 行离开 `workbench/browser/media/`。`ua-common.css` 203 行仍在 A 表。6b 只让两行常量回到上游，色表 diff 还在。6c 做完后，`workbenchThemeService.ts` 里这张色表回到基线；文件里其余通知逻辑仍可能留下，不以「+386 行全部消失」计。

## p2-7 Copilot 门闩（已拍板保留 `when`，不改代码）

问题类：扩展清单用 `isSessionsWindow` 把大量命令和菜单限制在会话窗。有人会想改成核心按窗口类型过滤贡献，再把扩展改回原样。

核实过的证据：

- `extensions/copilot/package.json` 中 `isSessionsWindow` 162 处。`main` 上同一文件 17 处。`git diff main` 含该词的新增行 149、删除行 4。新增行主要是 `when` / `enablement` 末尾加上 `&& isSessionsWindow`。
- `isAgentSessionsWorkspace`：相对 `main`，copilot 树新增行 62，`typescript-language-features` 新增行 15（含 `editorChatGate.ts` 一类「仅会话工作区允许」）。`extensions/git/src/repository.ts` 的三处在 `main` 上已经存在（`main` 为第 371、381、958 行；工作区行号后移到 377、387、965）。git 扩展不是本叉加上的。
- `extensionEnablementService.ts` 的 `_isDisabledBySessionsWindow` 第 669–670 行：不是会话窗就 `return false`。第 679–682 行对内置 chat 扩展的例外只在会话窗里执行。这与默认窗启不启用 chat 无关。
- 该文件相对基线的 diff 是 `onUnexpectedError` 和 `ExtensionsManager` 的初始化重试，不是这个谓词。不要借本条去改它。
- 默认窗真正禁用内置 chat 的路径是另一段：`ensureChatExtensionInitialDisabledState` 第 156–159 行在会话窗直接 return，在默认窗才跑迁移。那是基线上就有的逻辑，本条不动。

这会改默认窗行为，选项见「待定项」。已选 A：不改 `package.json`，也不改启用服务。

预计减少的冲突面：若选「核心过滤并还原扩展」，copilot `package.json` 相对 `main` 的约 149 行 `when` 可以回到上游。代价是默认窗重新出现这些命令，除非核心过滤与这 149 条逐条等价。本波按 0 行计。

## p2-8 sessions 对 Universe Agent 的依赖（已拍板冻结，不改代码）

问题类：Agents Window 的 Changes 与 Agent Host changeset 注入了本仓连接服务。愿景把这个窗口排除在产品使用之外。

核实过的证据：

- [vision](../../docs/product/vision.md) 第 35 行：Agents Window 只作对照，不属于产品使用、UI 审查或交付验收。第 65 行：不把它升为生产入口。
- `agentHostSessionChangesets.ts:25` import `IUniverseAgentConnection`。抽象类构造第 292 行保存 `_uaConnection`。`invokeOperation` 第 432–433 行用 `isChangesWritePairingHold(this._uaConnection)` 喂给 `changesetInvokeBlock`。两个子类在第 550、596 行注入。
- `changesViewService.ts:17` import，第 103 行注入。第 238–243 行：`pairingHoldObs` 初值读快照，`onDidChangeConnection` 再写，`writesHeldObs` 为加载中或配对挂起。
- `changesWriteHold.ts` 实际路径是 `src/vs/sessions/contrib/changes/common/changesWriteHold.ts`。第 12–17 行只看 `pairingPending === true`，不要求 phase 已连接。
- 测试锁着：`changesViewService.test.ts:519` 起 `writes held while loading or pairing hold`（第 529–531 行配对挂起时 `writesHeldObs` 为真）。`agentHostSessionChangesets.test.ts:441-444` 锁 `changesetInvokeBlock` 的三态；第 459–462 行锁源码里 `changesetInvokeBlock` 出现在 `confirm` 与 `invokeChangesetOperation` 之前。
- 已落地的 [sessions-window-connection-registration](../../archive/dev/plans/sessions-window-connection-registration.md) 之所以在 `sessions.desktop.main.ts` / `sessions.web.main.ts` 侧载连接服务，是因为这两处构造函数已经注入它。写闸来自 [ui-gap-closeout-2026-10-01](../../archive/dev/plans/ui-gap-closeout-2026-10-01.md)。撤掉注入等于撤回这两份已落地行为的前提。

选项见「待定项」。已选 C 冻结：不改 `src/vs/sessions`。

预计减少的冲突面：选「撤掉依赖」时，上述两个生产文件去掉连接 import 与注入，`sessions.*.main.ts` 的侧载也可以一起拿掉，Changes 与 changeset 回到不认识本仓连接的形状。选「冻结」则本波 0 行，冲突留在下次合上游 sessions 时。

## 待定项

2026-11-05 用户拍板，四项都按推荐：1 选 A，继续抛错；2 选 A，保留 `package.json` 里的 `when`；3 选 C，冻结 `src/vs/sessions`；4 选 A，禅模式本波不抽。对应切片都按正文「本波不动」执行。下面的选项留作记录。

核对补充：Editor 位置在默认窗的命令面板里点不到。`chatSessions.contribution.ts` 的 `openNewSessionEditor.<type>` 前置条件含 `IsSessionsWindowContext`；只有 `electron-browser/chat.contribution.ts` 里给评测用、没有前置条件的 `CommandsRegistry` 命令能经 `executeCommand` 走到抛错。

### 1. 默认窗打开 Chat 的 Editor 位置，继续抛错还是改道

现在两处（`chatSessions.contribution.ts:1750-1751`、`electron-browser/chat.contribution.ts:312-313`）抛 `BugIndicatingError`，并且在任何 session 副作用之前。测试锁着抛错且 import store 未写入。

- 选项 A：保持抛错。调用方是编程错误。推荐。它不增加一条静默路径，测试不用改语义。
- 选项 B：改成与其它位置一样，聚焦 Conversation 并 return。用户从命令面板点到 Editor 位置时不再看到开发期错误。这是行为变化，要改 `chatShellRouting.test.ts` 第 85 行那条。

已选 A，p2-4a 不动这两处。

### 2. 要不要在核心按窗口类型过滤 chat 扩展，换回扩展原样

- 选项 A：保持 `package.json` 里的 `when`。推荐。这是 ADR-006 允许的薄门闩，不改默认窗已经藏起的命令。`_isDisabledBySessionsWindow` 帮不上这个忙。
- 选项 B：核心在默认窗丢掉 chat 扩展的菜单与命令贡献，再把 copilot `package.json` 相对 `main` 的约 149 行还原。默认窗行为会变，除非过滤与这 149 条逐条相同。本方案不设计这套过滤。
- 选项 C：默认窗直接禁用内置 chat 扩展。这和基线上「未完成 chat 设置才禁用」不是一回事，会改默认窗扩展启用，本波不做。

### 3. sessions 里的连接注入

- 选项 A：撤掉 `IUniverseAgentConnection` 注入，配对写闸一并去掉，并撤回连接侧载。Agents Window 的 Changes 在配对等待时又能发出写。与愿景「不做该窗口验收」一致，但推翻两份已落地方案。
- 选项 B：改成 provider 能力字段，sessions 不 import 连接服务。仍是这些上游文件上的本叉逻辑，只是多一层类型。没有新的产品能力。不推荐。
- 选项 C：冻结。`src/vs/sessions` 以后只合上游，不在本波为它做抽象。现有注入留着，直到某次上游合并碰到这些文件再处理。推荐。愿景不验收这个窗口，不值得为它再加扩展点。

### 4. 禅模式那一段要不要抽

- 选项 A：本波不抽。推荐。离开 `toggleZenMode` 的是进入侧第 1543–1545 行与第 1553–1555 行，加上退出侧第 1631–1641 行。快照和 grid 仍留在 `layout.ts`。本项与 p2-3「本波不抽」是同一个选择，不挡住其余切片。
- 选项 B：另开一刀，把进入 / 退出时对 Conversation 与 End 列的显隐交给一个策略。要单独写测试，并且不得改 `wasVisible` 的存储位置。

## 审查

2026-11-04 只读审查的结论是须改稿。已改入：p2-1 的注册挂在 `conversationEditor.contribution.ts`，未注册时文件围栏仍在，并改 P7 放行与 `sourcesWiringScan` 两处断言；p2-2 在 `createConversationEditorPart` 返回之后才上报，假 part 要补方法；p2-4 不让 conversation import `chatShellRouting.ts`，`openChatSessionWithPrompt` 与 5 处纯 return 本波不动；p2-5 连接监听含重连分支；p2-6 写明 schema 在 `workbench.common.main.ts:98` 已经登记，测试第 217–220 行四条都改。辅助 part 与模态 part 的 `registerPart` 改记到各自文件。禅模式只把产品显隐算进可抽范围。

## 审查处理

对照活码之后，本轮审查意见全部采纳。没有与 HEAD 或已签收合同冲突、核验后不成立的条目。frontmatter `status` 仍是 `draft`。

### Strengths

采纳为已核对事实，正文不为此改写。行号、numstat、围栏、24 处调用、设置计数、禅模式产品行、`wasVisible` 留在 layout、P7 放行要删、m5 不让 conversation import `chatShellRouting.ts`、sessions 连接注入留在待定项，都与工作区一致。

### Critical

1. 采纳。`executePreviewTerminalEmptyState`（`editorGroupWatermark.ts:91-106`）自己 `accessor.get` 连接和 Pty。调用方是 `categorizedMainEditorPart.ts:295` 与 `previewEditorTab.ts:74`。p2-5 改为：函数留在 `browser/parts`，两条调用继续走它，函数改问注册表，不再取连接和 Pty。贡献注册实现。`browser/parts` 不 import contrib。双击不变量走的就是这条路径。
2. 采纳。会话窗经 `sessions.main.ts:68` → `sessions/browser/workbench.ts:6` 加载 `style.ts`。`productAccessibility.css` 只有这一处 import。`ua-common.css` 的另一处是 `conversationPart.ts:7`，会话树不引它。`sessions.common.main.ts:94` 加载主题服务，`:377` 加载 `themes.contribution.ts`，`:211` 加载设置贡献。`conversation.contribution.ts:12` 才加载 `uaClientSettings.contribution.ts`，会话入口没有这条链。6a/6b/4c 改为新建 `productShell.contribution.ts`，由 `workbench.common.main.ts` 与 `sessions.common.main.ts` 在主题服务 import 之后加载。不挂在 conversation 贡献上。`IProductChatOpenRoute` 仍只挂 conversation 贡献：会话窗不注册它，chat 打开才不会被改道。

### Important

1. 采纳。`classify` 写成三态，`handleGroupResult` 第 48–64 行和 `doFindGroup` 第 266–276 行都问。已注册、组尚未解析时保留第 269–271 行的抛错；组已解析时保留第 60–63 行的抛错。`foreign` 走第 56–59 行与第 274–276 行。未注册不抛，并靠第 52–54 行把落在会话叶上的组拨回主 Preview。布尔「不可进组就送回 Preview」会让已注册的 chat input 不再抛错。
2. 采纳。`focusConversationPart` 从 `void` 改为返回 `openInstead()` 的布尔，调用方用这个返回值 `return`。未注册可选获取、返回 false、不聚焦。`chatShellRouting.test.ts:236-251` 必须在测试里注册 `openInstead() === true`，4a 不再写成「行为不变」。m5 禁止丢掉待发送 prompt 的句子改为第 90 行；第 89 行是另一条禁令。
3. 采纳。假 part 名单补上服务测试五处（第 89、158、229、299、364 行）、`conversationSessionWindowLayout.test.ts:41-46`，以及 side-by-side、reveal 里交回真服务的 stub。grep 与文件名单加上 layout 测试。风险补上：默认 `visible: true` 时，隐藏漏报会让已隐藏叶继续接 `CONVERSATION_GROUP`。
4. 采纳。`themes.contribution.ts:635-636` 写入首选主题，与第 592、607 行同一个动作。常量恢复后这两行必须改写产品主题 id。`workbenchThemeService.test.ts:231-239` 改为用 Universe 主题 id 的字面量查找 manifest，不再读恢复后的常量。

### Minor

1. 采纳。禅模式收益与待定项 4 改成同一组行号：进入侧第 1543–1545 行与第 1553–1555 行，退出侧第 1631–1641 行。去掉「大约 10 行」和「大约 20 行」。
2. 采纳。`setEditorHidden` 的区间改为从 `layout.ts:2018` 起，到第 2134 行。第 2039 行标明是函数中段。
3. 采纳。`getCategoryIconClass`（`editorGroupWatermark.ts:330-354`）随标题和按钮文案搬进贡献，不留在水印类。
4. 采纳。`layout.ts` 的 195 次 / 157 行注明是大小写敏感的 `conversation` / `Conversation` 与 `sources` / `Sources`。`CONVERSATION_PART`、`SOURCES_PART` 不在内。不区分大小写是 276 次、200 行。判断仍用前一个数。
5. 采纳。ADR-006 第 60 行改为三条不变量的代码落点并列，不再写成 `chatShellRouting.ts` 单是 `INV-NO-COPILOT` 的落点。不删该文件的结论保留。
6. 采纳。待定项开头写明 1–3 留给用户，第 4 项与 p2-3「本波不抽」是同一个选择，不挡其余切片。

### Assessment

采纳。Critical 两条和 Important 四条已写入机制、测试名单和行号。

### 复审

改稿后对照活码又看了一遍。两处不成立的写法已改掉，不另作不采纳。

1. 采纳。三态不能只覆盖 `editorGroupFinder.ts:48-64`。`doFindGroup` 第 266–276 行是另一条路：组尚未解析时，已注册的 chat input 与 Diff 抛 `requires an explicit conversation group target`（`conversationEditorFence.test.ts:322`），被挡的 input 一律回主 Preview。未注册若只套第 56–59 行，点名 `CONVERSATION_GROUP` 的 chat input 会留在第 176–181 行定下的会话叶上。现已写明两处都问三态，第 52–54 行在没有 `exclusive` 时仍把排除聚合 part 拨回主 Preview。
2. 采纳。水印第 166–169 行在第一次 `render` 之前启动探测，`bridgeAvailable` 初值是 `false`，已连接时先写成 `undefined`。漏搬这三行，第一帧画出本地命令，点击走第 491–493 行不等探测。搬迁范围已含这三行。原先「这两处不改，平台 import 删不掉」和后文「删掉第 22–23 行」矛盾，已改成：调用方继续调用核心函数，函数不再取连接和 Pty，所以那两行 import 删掉。
