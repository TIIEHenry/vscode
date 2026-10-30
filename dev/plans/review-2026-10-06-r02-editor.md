---
title: "审查 r02：editor"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "运行中切换字面换行折行不会重算；视口 Unicode 高亮把计数加到自己身上，过多时横幅类别会错。"
---
# 审查 r02：editor

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r02-1 中
- 症状：编辑器已打开时切换 `editor.wrapOnEscapedLineFeeds`，含字面 `\n` 的行不会按新设置重算折行；该开关在这次视图模型的寿命内一直停在构造时的值。
- 位置：`src/vs/editor/common/viewModel/viewModelLines.ts` 第 304–349 行
- 引用：`if (equalFontInfo && equalWrappingStrategy && equalWrappingColumn && equalWrappingIndent && equalWordBreak) { return false; }`；后面 `createLineBreaksComputer` 仍传入 `this.wrapOnEscapedLineFeeds`。该字段只在构造函数第 136 行赋值。配置变更走 `viewModelImpl.ts` 第 283 行的 `setWrappingSettings`，参数里没有这个开关。
- 为什么是问题：折行列、字体、`wordBreak` 都没变时，`setWrappingSettings` 直接返回，不重建投影。字面 `\n` 该不该软折行是用户能看见的排版，开关文档写明了效果，运行中改设置却不生效。
- 方向：把该开关纳入 `setWrappingSettings` 的比较与赋值，变化时重建行投影。

## r02-2 中
- 症状：大文件走视口 Unicode 高亮时，各类字符计数始终是 0；一旦 `hasMore`，横幅总是说「非基本 ASCII」，禁用按钮也关错类别。
- 位置：`src/vs/editor/contrib/unicodeHighlighter/browser/unicodeHighlighter.ts` 第 366–368 行
- 引用：`totalResult.ambiguousCharacterCount += totalResult.ambiguousCharacterCount;`（`invisibleCharacterCount`、`nonBasicAsciiCharacterCount` 同样把自己加给自己）。同函数第 363–364 行区间来自 `result`，`hasMore` 也取自 `result`。
- 为什么是问题：累加没用上本段的 `result`。计数停在 0 后，第 95–102 行 `Math.max(...)` 为 0，`nonBasicAsciiCharacterCount >= max` 恒成立，横幅和禁用命令都落在非基本 ASCII 上，即使用户看到的是不可见字符或易混字符过多。
- 方向：三行改为累加 `result` 上对应的计数字段。
