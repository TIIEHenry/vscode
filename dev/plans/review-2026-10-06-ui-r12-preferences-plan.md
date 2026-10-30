---
title: "方案 r12：preferences"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 3、drop 1、weaken 1。只读列表仍可编辑删除，AI 开关在仍应显示时被摘掉，空态漏 Clear Filters；禁用 AI 仅命令路径会翻转勾选。"
---
# 方案 r12：preferences

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 3，drop 1，weaken 1

## r12-1（hold）

- 问题类：策略锁定或 Agents 窗口只读时，数组、对象、布尔对象、include/exclude 仍能双击编辑或点铅笔、删除。
- 不变量：`hasPolicyValue` 或 `isAgentsWindowReadOnly` 为真时，这四类控件不进入编辑、不提供删除或重置动作、不拖拽改序、不显示添加按钮。`ListSettingWidget.isReadOnly` 与 `isEditable` 相反。`ObjectSettingDropdownWidget` 在 `isReadOnly` 时同样藏起添加按钮。include/exclude 继续把该标志传给 `setValue`。复杂对象渲染器继续固定 `isReadOnly: true` 且 `showAddButton: false`。文本、枚举、布尔复选框、复杂对象「在 settings.json 中编辑」按钮维持现有禁用。写入仍由下层拒绝：`configurationEditing.validate` 在 `policyValue !== undefined` 时抛 `ERROR_POLICY_CONFIGURATION`；Agents 窗口 `configurationService.updateValue` 在策略值或 `agentsWindowReadOnlyKeys` 命中时抛错。
- 要动的符号或文件：`ListSettingWidget`（`settingsWidgets.ts`）。覆写 `isReadOnly`，返回 `!this.isEditable`。`addDragAndDrop` 在 `isReadOnly` 时直接返回，行不可拖。`SettingArrayRenderer.renderValue`（`settingsTree.ts` 第 1494 行）的 `setValue` 增加 `isReadOnly: dataElement.hasPolicyValue || dataElement.isAgentsWindowReadOnly`。`SettingObjectRenderer.renderValue`（第 1640 行）给 `objectDropdownWidget.setValue` 传入同一个 `isReadOnly`。`ObjectSettingDropdownWidget.setValue` 在 `options.isReadOnly` 时把 `showAddButton` 设为 false。`IBoolObjectSetValueOptions` 增加 `isReadOnly`。`SettingBoolObjectRenderer.renderValue`（第 1740 行）传入该标志。`ObjectSettingCheckboxWidget` 只读时禁用复选框，第 1420 行与第 1452 行的 `mousedown` 不翻转、不调用 `onValueChange`。
- 明确不改什么：不改 `SettingsEditor2.onDidChangeSetting` 与 `updateChangedSetting`。不改 `configurationEditing.ts` 第 512 行的策略校验，不改 `src/vs/sessions/services/configuration/browser/configurationService.ts` 第 179–185 行的拒绝。不改 `ExcludeSettingWidget` / `IncludeSettingWidget` 里已经空实现的 `addDragAndDrop`。不改 `SettingIncludeExcludeRenderer.renderValue` 第 1825 行已有的 `isReadOnly` 参数。不改 `SettingComplexObjectRenderer.renderValue` 第 1398–1402 行。不改 `AbstractSettingRenderer` 对文本框、下拉框、布尔复选框的 `setEnabled` / `disable`。
- 怎样本地验证：没有覆盖这些控件只读的测试。`scripts/test.sh --run src/vs/workbench/contrib/preferences/test/browser/settingsTree.test.ts`。新增断言：`ListSettingWidget.setValue` 传入 `isReadOnly: true` 后，条目动作列表为空，双击不调用编辑，行不是 `draggable`；不传该标志时铅笔与删除仍在。`ObjectSettingDropdownWidget.setValue` 传入 `isReadOnly: true` 后动作列表为空且添加按钮不可见；`SettingComplexObjectRenderer` 仍传 `isReadOnly: true` 与 `showAddButton: false`。`ObjectSettingCheckboxWidget` 只读时点击复选框不发出 `onDidChangeList`，未只读时点击会发出 `change`。

## r12-2（hold）

- 问题类：Sessions 窗口里，AI 结果开关已经在搜索栏上且仍满足显示条件时，再次刷新会把它摘掉并取消勾选。
- 不变量：`updateAiSearchToggleVisibility` 仅在 `alreadyVisible && !canShowToggle` 时 `pull(0)`、去掉 `with-ai-toggle`、把 `checked` 设为 false。`!alreadyVisible && canShowToggle` 时仍 `push` 到 index 0 并加上 `with-ai-toggle`。已显示且 `canShowToggle` 仍为真时不改动作栏、不改 `checked`。非 Sessions 窗口、搜索栏尚未建好时仍在函数开头返回。`canShowToggle` 仍是 `ShowAISearchToggle && EnableNaturalLanguageSearch && !sentiment.hidden && !sentiment.disabled`。`onDidChangeConfiguration` 与 `onDidChangeSentiment` 仍调用这个函数。
- 要动的符号或文件：`SettingsEditor2.updateAiSearchToggleVisibility`（`settingsEditor2.ts` 第 541–545 行）。`else if (alreadyVisible)` 改为 `else if (alreadyVisible && !canShowToggle)`。
- 明确不改什么：不改 `disableAiSearchToggle`。不改 `toggleAiSearch`（见 r12-4）。不改第 534–540 行的插入。不改 `pull` 的下标 0（开关仍由第 535 行插在最前）。不改搜索结果模型与 `onDidToggleAiSearch`。
- 怎样本地验证：没有覆盖 `updateAiSearchToggleVisibility` 的测试。`settingsEditor2.test.ts` 的 suite `SettingsEditor2` 只覆盖已导出的搜索辅助函数。`scripts/test.sh --run src/vs/workbench/contrib/preferences/test/browser/settingsEditor2.test.ts`。把「已显示且仍可显示则保持，已显示但不可显示则移除，未显示且可显示则插入到 0」抽成与 `getSettingsSearchSuggestions` 同级的纯函数再断言这三支；配置变更或 sentiment 变更只负责调用，不在测试里实例化整页编辑器。

## r12-4（weaken）

反证：鼠标点禁用开关不会翻转。`toggle.css` 第 30–34 行让 `.monaco-custom-toggle.disabled` 为 `pointer-events: none`；`settingsEditor2.css` 第 381–383 行把它改回 `pointer-events: initial`，事件能落到控件上。`Toggle` 的点击处理（`toggle.ts` 第 171–177 行）与按键处理（第 183–185 行）在 `enabled` 为 false 时返回。`ToggleActionViewItem.updateEnabled` 在动作禁用时调用 `toggle.disable()`。`ActionRunner.run`（`actions.ts` 第 182–184 行）在 `action.enabled` 为 false 时返回。快捷键 `settings.action.toggleAiSearch` 的 `when` 是 `CONTEXT_AI_SETTING_RESULTS_AVAILABLE`（`preferences.contribution.ts` 第 504 行），`disableAiSearchToggle` 会把该上下文键设为 false。仍成立的是第 1037–1043 行：`enabled === false` 时只做 `aria.status`，随后仍执行 `checked = !checked`。`Action.checked` 的赋值会 `onDidChange`（`actions.ts` 第 154–157 行），第 933–935 行无条件进入 `onDidToggleAiSearch`，从而把 `searchResultModel.showAiResults` 设成新的勾选值。命令面板的前置条件只有 `CONTEXT_SETTINGS_EDITOR`（第 500 行），禁用期间仍能调用 `toggleAiSearch`。

- 问题类：尚无 AI 结果、开关处于禁用时，命令 `toggleAiSearch` 仍翻转勾选并按已开启重绘。
- 不变量：`showAiResultsAction.enabled === false` 时 `toggleAiSearch` 只播报 `noAiResults` 并返回，`checked` 不变，`onDidToggleAiSearch` 不运行。`enabled === true` 且开关在栏中时仍翻转 `checked`。开关不在栏中时仍直接返回。快捷键 `when` 仍是 `CONTEXT_AI_SETTING_RESULTS_AVAILABLE`。`.monaco-custom-toggle.disabled` 保持 `pointer-events: initial`。
- 要动的符号或文件：`SettingsEditor2.toggleAiSearch`（`settingsEditor2.ts` 第 1039–1042 行）。`enabled` 为 false 时在 `aria.status` 之后 `return`。
- 明确不改什么：不改 `settingsEditor2.css` 第 381–383 行。不改 `Toggle` 的点击与按键。不改 `updateAiSearchToggleVisibility`。不改 `onDidToggleAiSearch` 在勾选真正变化后的重绘。不改命令 id、快捷键与前置条件。
- 怎样本地验证：没有 `toggleAiSearch` 的测试。`scripts/test.sh --run src/vs/workbench/contrib/preferences/test/browser/settingsEditor2.test.ts`。新增断言：动作在栏中且 `enabled` 为 false 时调用后 `checked` 仍为 false，且不把 `showAiResults` 设为 true；`enabled` 为 true 时 `checked` 从 false 变为 true；动作不在栏中时 `checked` 不变。判定可与 r12-2 一样抽成纯函数，避免实例化整页编辑器。

## r12-5（hold）

- 问题类：只用 `@ext:`、`@feature:`、`@id:` 或 `@lang:` 滤成 0 条时，空态只有 “No Settings Found”，没有 Clear Filters。
- 不变量：`renderResultCountMessages` 在 `tagFilters`、`extensionFilters`、`featureFilters`、`idFilters` 任一 `size > 0`，或 `languageFilter` 有值时，把 `clearFilterLinkContainer.style.display` 设为 `initial`；这些都空时设为 `none`。这与 `triggerSearch` 第 2203 行进入过滤模型的维度相同。0 条时根节点仍加 `no-results`，计数文案仍是 “No Settings Found”。点击链接仍走 `clearSearchFilters`。`@ext:`、`@id:`、`@lang:` 已是 `getSettingsSearchSuggestions` 里的前缀，点击会剥掉。`@feature:` 的建议是完整词（如 `@feature:scm`），不是 `@feature:` 前缀；`clearSearchFilters` 同时按 `@feature:` 前缀剥词，否则不在建议列表里的特征过滤点了链接仍留在查询里。`@tag:` 与 `@modified` 继续靠现有 `tagFilters` 与建议前缀。
- 要动的符号或文件：`SettingsEditor2.renderResultCountMessages`（`settingsEditor2.ts` 第 2474–2477 行）的 `display` 条件。`SettingsEditor2.clearSearchFilters`（第 883–890 行）增加对 `` `@${FEATURE_SETTING_TAG}` `` 前缀的剔除，与现有 `suggestions.some(word.startsWith)` 并列。
- 明确不改什么：不改 `parseQuery`。不改 `triggerSearch` 第 2169–2206 行如何填过滤集合、何时 `createFilterModel`。不改 `no-results` 类名与 `settingsEditor2.css` 第 274–281 行空态显隐。不改建议列表 `getSettingsSearchSuggestions` 的条目。不改 `categoryFilter`。
- 怎样本地验证：没有覆盖这条 `display` 或 `clearSearchFilters` 的测试。`scripts/test.sh --run src/vs/workbench/contrib/preferences/test/browser/settingsEditor2.test.ts`。把显示条件抽成纯函数，新增断言：仅 `extensionFilters`、仅 `featureFilters`、仅 `idFilters`、仅 `languageFilter`、仅 `tagFilters` 非空时结果为显示；五者皆空时为隐藏。`clearSearchFilters` 对 `@ext:publisher.name`、`@id:files.autoSave`、`@lang:cpp`、`@feature:scm`、`@feature:not-in-suggestions` 都剥掉过滤词并保留普通检索词；无过滤词的查询保持原样。
