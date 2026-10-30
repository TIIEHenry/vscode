---
title: "方案 r07：conversation-part"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "drop 1，weaken 1。会话编辑器宿主量到 0 时仍跳过，尺寸变正后补一次 layout，禁止把 0 写进去。"
---
# 方案 r07：conversation-part

状态：草案。
覆盖需求：无（正文未引用需求编号）。


drop 1，weaken 1。

## r07-2 低（weaken，原中）

- 反证：`ConversationPart.layout`（`conversationPart.ts` 第 145–153 行）在部件可见时仍同步调用 `layoutConversationEditorParts`（第 161–176 行），`hostWidth <= 0 || hostHeight <= 0` 时 `continue`（第 170–172 行）。本文件没有 `ResizeObserver`。另有一条扇出：`ConversationSessionWindowService.layoutVisibleLeaves`（`conversationSessionWindowService.ts` 第 711–723 行）在 `fireVisibleWindowsChange`（第 740–742 行）里对已经量到正尺寸的宿主再 `part.layout`。`ensureLeaf` 在 `await part.whenReady` 之后，`tryBootstrapPrimaryWindow`、`openSessionBeside`、`runReveal` 会走到这次扇出。藏起再显示会话区时，`Layout.setConversationHidden(false)`（`layout.ts` 第 2046–2050 行）先去掉 `noconversation`，再 `workbenchGrid.setViewVisible`，会再次进入 `ConversationPart.layout`。`layoutContents` 已用 `size()` 给 `.content` 写上显式宽高，随后读 `clientWidth` 会强制回流。注释里的「flex 尚未分到像素」不等于这次读数是 0 之后，浏览器会在没有新的 layout 或可见性事件时自行把宿主撑开。读到 0 表示宿主当时不在已显示且已有尺寸的盒子里（未挂上、`.conversation-session-leaf-hidden` 的 `display: none`，或内容区本身仍是 0）。隐藏叶跳过，是为了避免把上次的正尺寸写成 0。
- 问题类：两次扇出在宿主客户区为 0 时都直接放弃，没有在该宿主稍后变为正客户区时补 `part.layout`；编辑器组按显式像素绘制，会停在首次回退尺寸或上一次正尺寸。
- 不变量：禁止对会话编辑器调用宽或高非正的 `layout`。`EditorParts.createConversationEditorPart`（`editorParts.ts` 第 273–275 行）在 `part.whenReady` 之前仍做首次 layout：宿主 `clientWidth` / `clientHeight` 为正就用该值，否则 `layout(800, 600, 0, 0)`，以免 `Grid.getNeighborViews` 抛出 `Can't call getNeighborViews before first layout`（`grid.ts`）。首次若走了 800×600 回退，记下的「上次测量」是 0，不是 800 和 600；宿主后来变为正客户区时必须再 `layout(clientWidth, clientHeight, 0, 0)`，即使数值碰巧仍是 800×600。同一宿主的客户区与上次已应用的测量相同则不再调用。客户区保持 0 的隐藏叶不收到 `layout`。`part.layout` 不回写 host 的 `clientWidth` / `clientHeight`（宿主尺寸来自 flex；`EditorGroupView.layout` 写的是内部 `editorContainer.style.width` / `height`，`editorGroupView.ts` 第 2261–2264 行；宿主 `.conversation-editor-part-container` 为 `overflow: hidden`）。
- 要动的符号或文件：`EditorParts.createConversationEditorPart`（`src/vs/workbench/browser/parts/editor/editorParts.ts`）。首次 `editorPart.layout` 之后，在该会话的 `DisposableStore` 上对 `host`（即 `getContainer()` 的 parent，`.conversation-editor-part-container`）注册一个 `ResizeObserver`。`disposeConversationEditorPart` 已 `deleteAndDispose` 这个 store，观察者随叶销毁断开。回调里两个客户区都为正、且与上次测量不同时，调用 `editorPart.layout(host.clientWidth, host.clientHeight, 0, 0)` 并记下这次测量。`ConversationPart.layoutConversationEditorParts` 与 `ConversationSessionWindowService.layoutVisibleLeaves` 继续作为同步快路径，保留 `<= 0` 则跳过；这两处不再各建一个 `ResizeObserver`。
- 明确不改什么：不把 0 传进 `part.layout`。不删除 800×600 回退。不改 `EditorPart.layout` 的浮动面板边距扣减。不改 `EditorGroupView.layout` 的像素写入。不改 `conversationPart.css`、`conversationSessionWindow.css`、`conversationLens.css` 的定位与留白。不改 `layoutVisibleLeaves` 里给叶栏打宽度类的循环。
- 怎样本地验证：没有覆盖 `layoutConversationEditorParts` 的测试。`src/vs/workbench/test/browser/parts/conversation/conversationPart.test.ts` 的 suite `ConversationPart` 只覆盖槽、隐藏钮名称和 focus。`scripts/test.sh --run src/vs/workbench/test/browser/parts/conversation/conversationPart.test.ts` 保持通过。在能调用 `createConversationEditorPart` 的 browser 测试中新增断言，并用只记录 `observe` 回调的 `ResizeObserver` 桩触发它：宿主客户区为 0 时仍立刻 `layout(800, 600, 0, 0)`；此后不再调用 `ConversationPart.layout` 与 `fireVisibleWindowsChange`，只把宿主客户区改为正数并运行已注册回调，编辑器 part 收到 `layout(该宽, 该高, 0, 0)`；回调见到 0 时不调用 `layout`；客户区与上次已应用的测量相同时不再调用 `layout`。`conversationSessionWindowSideBySide.test.ts` 里的本地函数 `layoutConversationEditorParts` 是测试帮手，继续手动 `part.layout(800, 600)`。
