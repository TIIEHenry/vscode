---
title: "Preview 两级标签：类别条独占一行，每个类别有自己的编辑器组"
type: plan
status: accepted
phase: M7
updated: 2026-10-05
summary: "PRD-027 / ADR-011 实施，2026-09-28 签收。2026-10-05 P2 组归属与显隐已落，P3 未做，方案保持 accepted。"
---

# Preview 两级标签：类别条独占一行，每个编辑器组属于一个类别

> **v1（2026-09-27，`accepted`）** 只定了 Code | Artifacts | Planning，底层写「独立 EditorGroup（或专属的逻辑分组）」，两条路都留着。HEAD 走了过滤视图，并把类别扩成七个，没有改 PRD。本版按 2026-09-28 用户的选择改写：保留两级标签，类别条独占一行，七个类别写进 PRD。机制由 [ADR-011](../decisions/011-preview-two-level-tabs.md) 定为真实的组归属。v1 的审查记录不再覆盖本版。
>
> **审查记录（规则 16）**：2026-09-28 只读审查，结论 Approve with changes。已吸收：分类不能按 `git:` 一刀切，`EditorInput.resource` 看不到 Diff 的两侧；已打开在隐藏组里的编辑器要先切到那一组的类别；新建的分屏组要继承来源组的类别；P1 不能拆掉 Agents 窗口仅有的切换入口；隐藏组被激活时要先切类别；P0 只改 `isEmpty` 会让「关闭全部」把其他类别的编辑器一起关掉。未采纳「P2 与路由拆成两次合入」：审查说明拆开合入会把刚打开的编辑器藏起来，所以路由和停止强切放进同一切片。
>
> **落地注记（2026-10-05）**：P2 代码已落（组归属与显隐、旧布局迁移、路由与提示点、标题控件不再 `setActiveCategory`、§3.7、七类移动与拖放、§3.3、§3.6）。P3 未做。方案保持 `accepted`。不宣布 PRD-027 完成。

> **决策**：[ADR-009](../decisions/009-preview-category-isolation.md)（Decision 4 仍有效；三类、类别条位置、「或专属的逻辑分组」由 ADR-011 取代）· [ADR-011](../decisions/011-preview-two-level-tabs.md)（2026-09-28 签收，`accepted`）。
> **需求**：[PRD-027](../../docs/product/requirements.md#prd-027-preview-类别隔离与-surface-宿主)。视觉与空态：[PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度)、[UI 设计原则 §5.4 / §6](../../docs/architecture/cross-cutting/ui-design-principles.md)。
> **不推翻**：`INV-TOPO`、[ADR-002](../decisions/002-conversation-session-windows.md)、[ADR-005](../decisions/005-changes-diff-owner.md)、`INV-052-NO-DUAL-HIDE`、四钮无 Panel 钮、[ADR-007](../decisions/007-upstream-sync.md) 的最小挂点。

## 0. 目标与非目标

**目标**：主窗口 Preview 是两级标签。第一级类别条独占顶部一行，七个类别始终在。第二级是当前类别自己的编辑器标签，组的模型语义与上游一致。切换类别只切换显示。

**非目标**：

- 不给 Conversation、辅助窗、模态编辑器、Agents 窗口分类别。
- 不做 Canvas / Planning 的渲染器。没有内容来源的类别只显示空态。
- 不把底部 Panel 的终端、Sources 的 Files | Changes | Review 搬进 Preview。
- 不新造标签控件，不改 `EditorGroupModel` 的活动编辑器、最近使用顺序和固定标签语义。

## 1. 目标行为

与 PRD-027 一致，这里只列实施时要钉死的几点。

1. 类别条在编辑器网格之上，由主 Preview Part 绘制。分屏、`showTabs: single`、`showTabs: none` 时都在。高度不高于 [UI 设计原则](../../docs/architecture/cross-cutting/ui-design-principles.md) 的区域标题条上限（28px）；钮的命中区用该规范的图标按钮尺寸（22–24px），不沿用 HEAD 的 28×26。
2. 主 Preview 的每个组恰好属于一个类别。当前类别的组可见，其余组隐藏且模型保留。当前类别至少留一个组。
3. 用户主动打开会切到该输入的类别。`inactive` 的打开不切，只在目标类别上打提示点，直到用户切过去。
4. 移到别的类别是一次真实的组间移动，不是改内存里的标记。
5. 组归属和上次停留的类别随工作区保存。重载后恢复。

## 2. HEAD 事实

引入提交 `550bcdb0eb1`（三类，过滤视图）。扩成七类的提交 `1b8ee713696`，只改了代码和进度账。

| 事实 | 位置 |
|------|------|
| 七类枚举、全局当前类别、按实例的归属覆盖、`as any` 分类 | `src/vs/workbench/services/editor/browser/previewCategoryService.ts` |
| 过滤视图；用本组数量覆盖全局计数；切类别时发没有 `editor` 的 `EDITOR_OPEN` | `src/vs/workbench/browser/parts/editor/categoryFilteredEditorGroupModel.ts` |
| 主 Part 才套过滤模型；`openEditor` / `openEditors` 无条件切类别 | `editorTitleControl.ts` |
| 类别条由主 `MainEditorPart` 画在网格之上，独占一行；Agents 窗口覆写关掉 | `editorPart.ts`、`sessions/browser/parts/editorPart.ts` |
| `isEmpty`、切类别、关闭后选下一个，三处按类别过滤 | `editorGroupView.ts` |
| 单组且 `isEmpty` 时删掉 `editorpart.state` | `editorPart.ts` `saveState` |
| `removeGroup` 对 `isEmpty` 的组直接 `dispose`，不关编辑器、不确认 | `editorPart.ts` `doRemoveEmptyGroup` |
| 每个组都建水印，空态卡片不判断是不是主 Part；Web 按钮调不存在的 `workbench.action.openSimpleBrowser` | `editorGroupWatermark.ts` |
| Agents 窗口同样注册该服务，主 Part 仍是工作台的 `EditorGroupView` | `src/vs/sessions/sessions.common.main.ts`、`src/vs/sessions/browser/parts/editorParts.ts` |
| 隐藏组但保留模型的现成做法 | `conversationEditorPart.ts` `setGroupHidden` |
| 打开路由与 Conversation 围栏 | `src/vs/workbench/services/editor/common/editorGroupFinder.ts` |
| 工作台主 Part 的唯一构造点；Agents 窗口自己覆写，不走这里 | `editorParts.ts` `createMainEditorPart`；`src/vs/sessions/browser/parts/editorParts.ts` 覆写同名方法 |

由此来的缺陷：

1. 只有一个组时停在空类别，保存会删掉整个编辑器布局。默认布局就是一个组，七类里五个经常是空的。
2. 多个组时，当前类别为空的组会被当成空组销毁：中键点空白，或「关闭组内所有编辑器」。`dispose` 不关编辑器，脏文件变成没有标签的孤儿。
3. `closeEditors` 在 `isEmpty` 时直接返回成功，扩展和程序化关闭被静默跳过。
4. 模型里的活动编辑器可以属于别的类别，面板却是空的。`closeEditor()` 默认关的是这个看不见的编辑器。
5. 后台打开也切类别。批量打开按第二个编辑器的类别切，用户要看的第一个被换掉。
6. 恢复时先显示模型里的活动编辑器，标题控件再按组内第一个编辑器切类别，面板和标签可以不在同一个类别。
7. 过滤后的下标被传给读原始模型的 `isSticky` 等。别的类别里有固定标签时，当前类别的标签宽度和样式是错的。
8. 角标是最后写入的那个组的数量。分屏时来回跳。
9. 每个模型事件都整排重建标签，键盘焦点和滚动位置丢掉。
10. Agents 窗口在单标签或无标签模式下打开 `vscode-terminal:` 编辑器后，文件标签被藏起，没有类别条可以切回来。辅助窗和模态编辑器的空组会画出 Preview 的类别空态。

## 3. 设计

### 3.1 谁来画类别条

新增主 Preview Part（工作台 `createMainEditorPart` 返回它，`MainEditorPart` 的子类）。它在内容区顶部放类别条，下面才是现有的编辑器网格。不用 `Part` 基类的标题区：那个高度是 35px，浮动面板下是 32px，都超过 28px 上限。

类别条的外观沿用现有纯图标钮：`role="tablist"`，名字在 `title` 和 `aria-label`，选中态 2px 下划线，←/→ 移动，Enter / Space 选中。图标改用 codicon，16px，与水印同一套，删掉手绘 SVG。有打开的编辑器时，数字跟在图标右侧；没有打开或一行放不下时不显示。不把类别名放回钮里。

### 3.2 组的归属与显隐

- 归属是 `Map<组 id, 类别>`，存在主 Preview Part 的工作区 memento，键与 `editorpart.state` 并列。组 id 写在组的序列化数据里，重载后仍对得上。
- 分屏、复制组、拖到边缘新建的组不经过 `editorGroupFinder`。主 Preview Part 在 `onDidAddGroup` 里用来源组的类别给新组赋值，没有来源时用当前类别。
- 切到类别 C：先退出最大化（组处于最大化时 `setViewVisible` 会直接返回），再把属于 C 的组设为可见、其余隐藏，然后激活 C 里最近用过的组。不调用 `openEditor`。先显示目标类别，再隐藏其余的，避免网格出现一瞬间所有子视图都隐藏。
- 隐藏格自己的序列化里已经有 `visible: false`。归属表是第二份记录。恢复时先 `applyState`，再按归属表重放显隐，不以网格里残留的 visible 为准。
- 当前类别的组被移走或合并到一个都不剩时，补一个空组。这个组不受 `closeEmptyGroups` 移除；同一类别里多出来的空组仍受该设置约束。
- `closeEmptyGroups` 的判断回到「组里没有编辑器」。组还没按类别拆开之前，另有一处临时限制，见 P0。

### 3.3 分类规则

规则只在 `previewCategoryService` 一处。输入实现一个带类型的接口（`previewCategory: PreviewCategory`），用类型守卫读取，删掉 `as any`。没有声明时再看 URI。看的是用户正在编辑的那一侧：Diff 两侧 scheme 不同时 `EditorInput.resource` 为空，只读它会把工作区 Diff 和历史 Diff 都送进 Code。

| 类别 | 归入 |
|------|------|
| Overview | `walkThrough` |
| Terminal | `vscode-terminal` |
| Web | `vscode-browser`，以及内置浏览器的编辑器类型。不按 `http` / `https` 归类，那会把同 scheme 的文本文档算进 Web。`simple-browser` 不是 scheme |
| Planning | `planning`、`todo`、`project-context` |
| History | `scm-history-item`（历史多文件 Diff）、`vscode-local-history`、在真实提交上打开的 `git:` 文档 |
| Artifacts | `canvas`、`artifact` |
| Code | 其余。包括文件、未命名文件、`scm-multi-diff-source`，以及修改侧是工作区文件或 git ref 为 `''` / `~` / `wt` / `index` 的 Diff |

`git:` 不是历史专属。未暂存改动的原始侧、已暂存改动的修改侧都是 `git:`。所以不能把见到 `git:` 就送进 History。`scm-history-item-change-range` 只给聊天上下文提供文本，没有对应的编辑器，不参与分类。

HEAD 把并不存在的 `git-diff`、`visualize`、`overview`、`landing`、`history`、`timeline` 写进了判断，本版不保留。当前工作区 Diff 留在 Code，与 ADR-005 一致。

### 3.4 路由

改 `editorGroupFinder.ts`，放在现有 Conversation 围栏之后，并且只在目标 Part 是主 Preview 时生效。

1. 输入已经在某个组里打开、现有规则要求就地显示（`revealIfOpened`、`revealIfOpen`、`ForceReveal`、`Singleton`）时，留在那个组，并切到该组的类别再激活。留在隐藏组里又不切类别，编辑器会打开在高度为零的格子上。
2. 否则按 §3.3 得到类别，选该类别最近活动的组；没有就建一个。`SIDE_GROUP` 相对该类别的活动组分屏，新组按 §3.2 继承类别。
3. 调用方点名的组属于别的类别时，改送到输入自己的类别。
4. 不是第 1 条、也不是 `inactive` 的打开：切到该类别。`inactive` 的打开：不切，在目标类别上打提示点。
5. 用户切到有提示点的类别后，清除提示点。

### 3.5 移动与拖放

「移到类别」对七个类别都有菜单项（现在只有 Code / Artifacts / Planning）。执行时把编辑器 `moveEditor` 到目标类别最近活动的组，没有就建，然后切过去。

拖到类别钮上走同一条移动，不再写 `WeakMap`。归属覆盖重载即丢，这是 HEAD 的缺陷，不迁就。

### 3.6 空态

空态只在主 Preview、且当前类别没有任何可见编辑器时画。文案按 PRD-028 的整面空态：不画带边框的卡片。

动作必须是已注册命令，且打开结果按 §3.3 落在本类别。不满足的删掉：

| 类别 | 动作 |
|------|------|
| Terminal | `workbench.action.createTerminalEditor`（在编辑区建终端）。HEAD 的 `workbench.action.terminal.new` 建在底部 Panel，不用 |
| Web | `workbench.action.browser.open`。HEAD 的 `workbench.action.openSimpleBrowser` 全仓不存在，删掉 |
| Code | 现有的打开文件、新建文件，二者都落在 Code |
| Overview、Planning、History、Artifacts | 没有能落在本类别的命令之前，只显示说明，不放按钮 |

### 3.7 隐藏组仍在组列表里

`setGroupViewVisible(false)` 只把格子高度设为 0，组仍留在 `getGroups()` 里，`group.openEditor` 仍会把它激活。组模型不知道类别。主 Preview Part 提供一个「这个组现在可见吗」，下面的入口只用这个回答，不自己判断类别。

两层：

1. **激活隐藏组就先切到它的类别。** 快速打开（`editorQuickAccess.ts`）、打开的编辑器视图（`openEditorsView.ts`）、最近使用编辑器（`historyService.ts`）都直接 `openEditor`，不经过 `editorGroupFinder`。钩子放在主 Preview Part：隐藏组被激活或被打开时，先切到它的类别。这样「关闭编辑器」不会作用在一个看不见的编辑器上。
2. **按序号找组的入口只数可见组。** 否则六个隐藏的空组会占掉 `Ctrl/Cmd+2`…`8`（`editorCommands.ts` 的 `getGroups(GRID_APPEARANCE)[index]`）、`ViewColumn`（`editorGroupColumn.ts`）和扩展看到的标签组（`mainThreadEditorTabs.ts`）。`EditorParts.findGroup` 在有辅助窗时先走跨 Part 的列表，再落到 Part 内的 `findGroup`，两处都要跳过隐藏组。

另外两处不走激活，要单独改：

- `EditorService` 的 `visibleEditorPanes` / `visibleEditors` 现在把每个组的活动编辑器都算可见。跳过不可见的组。
- `layout.ts` 用 `visibleEditors.length === 0` 判断「没有编辑器」，并在 `workbench.secondarySideBar.forceMaximized` 为真时最大化辅助栏。空类别会让它以为编辑区是空的。这个判断改为「主 Preview 里还有没有打开的编辑器」，不看当前类别。该设置默认关，判断仍然是错的。

关闭后激活下一个组、移除组后的合并目标，同样只在可见组里挑。

不改的：打开的编辑器全集、保存全部、关闭确认、布局序列化。隐藏组里的编辑器仍算打开着。

Agents 窗口不建这个 Part，所以上面的钩子不会挂到它身上。

### 3.8 旧布局迁移

没有归属表的旧 `editorpart.state`：里面的组都归 Code，再为另外六个类别各补一个空组并隐藏。不丢已经打开的编辑器。

## 4. 切片

显隐、路由和停止强切必须同一次合入。先藏起别的类别、打开路径却还在 `EditorTitleControl` 里切类别，刚打开的编辑器会落在被藏起来的组里。

| 切片 | 做什么 | 能单独合入 | 验证 |
|------|--------|------------|------|
| **P0** | 两处一起改。`isEmpty` 回到「组里没有编辑器」，修 `saveState` 和 `removeGroup`。组还没按类别拆开之前，`closeAllEditors` 和中键只处理当前类别的编辑器，并且不 `removeGroup`。空类别水印改由独立判断驱动 | 能。这是临时分支，P3 删掉 | 单组、停在空类别、触发保存：`editorpart.state` 还在。当前类别为空时，「关闭全部」不关掉其他类别的编辑器，也不 `dispose` 这个组。只改 `isEmpty`、不改关闭全部，做不到第二条 |
| **P1** | 主 Preview Part 画类别条；工作台 `createMainEditorPart` 返回它。过滤和标签行里的切换器改成只对这个子类生效。Agents 窗口的主 Part 不是这个子类，于是既不过滤，也没有切换器 | 依赖 P0 | 分屏、单标签、无标签都有且只有一条类别条。Agents 窗口打开 `vscode-terminal:` 编辑器后，文件标签还在 |
| **P2** | 同一次合入：归属与显隐（§3.2、§3.8）、`editorGroupFinder` 路由和提示点、标题控件停止 `setActiveCategory`、§3.7 的钩子和序号过滤、七类移动与拖放、分类规则（§3.3）、水印与空态（§3.6） | 依赖 P1。ADR-011 已于 2026-09-28 签收 | `inactive` 打开不切类别。已打开的编辑器被再次打开时，切到它所在的类别并显示。分屏新建的组跟来源组同一个类别。隐藏组不进可见编辑器，里面的脏编辑器仍进关闭确认。重载后类别还在 |
| **P3** | 删除过滤模型、P0 的临时关闭分支、组视图和标题控件里剩余的类别判断、`WeakMap`、整排重建、重复的类别列表 | 依赖 P2 | 固定标签按下标计算，不串组。打开编辑器不重建整排标签。`editorGroupView.ts` 不再出现类别判断 |

P0 与 P1 可以先于 P2 合入。ADR-011 已于 2026-09-28 签收，P2 可以实施。

## 5. 测试

现有 `previewCategoryIsolation.test.ts` 只测过滤模型和切换器，`previewEditorGroupHeader.test.ts` 用读源码字符串做断言。P3 删掉过滤模型后，前者改写成组归属的测试，后者删掉字符串断言。

新增的测试落在 `EditorPart` 这一层，至少覆盖：

1. 单组、当前类别为空、保存状态，布局 memento 仍在。
2. P0：当前类别为空时执行关闭全部，其他类别的编辑器还在，组也不被 `dispose`。P2 之后改为：其他类别的组还在，关闭全部只作用于可见组。
3. `inactive` 打开不改变当前类别；非 `inactive` 打开会切。已经打开在别的类别里的编辑器被再次打开时，切到那个类别并且编辑器可见。
4. 分屏新建的组与来源组同一类别，切走再切回，这个组还在。
5. 带固定标签的组，标签宽度按本组的固定下标。
6. 恢复后，面板里的编辑器和所属类别一致。
7. 可见编辑器集合不含隐藏组；隐藏组里的脏编辑器仍进入关闭确认。`Ctrl/Cmd+2` 聚焦的是第二个可见组，不是隐藏的空组。

浏览器层用 `scripts/test.sh --grep PreviewCategory`。改了 `editorGroupFinder` 再加它已有测试文件的定向运行。文档门禁是 `python3 scripts/check-docs-health.py`。

## 6. 验收对照

PRD-027 的九条验收：第 1、9 条的位置和键盘在 P1；第 2、3、4、5、6、8 条和第 7 条的关闭行为在 P2；第 7 条的保存和退出在 P0 已经止住。P3 不改变行为，只删掉临时分支。
