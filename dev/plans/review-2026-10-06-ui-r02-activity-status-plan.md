---
title: "方案 r02：activity-status"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 2，drop 3，weaken 0。空文进度要露出；同 id 横幅按新文案重建并释放上一份链接。"
---

hold 2，drop 3，weaken 0

## r02-2（hold）

- 问题类：状态栏条目 `showProgress` 为真且 `text` 为空时，转圈画在已隐藏的标签容器里，进度不出现。
- 不变量：`StatusbarEntryItem.update` 仍先写 `this.label.showProgress`，再在文案变化时写 `this.label.text`。`labelContainer` 在 `entry.text` 非空或 `entry.showProgress` 为真时 `show`，两者都没有时 `hide`。文案没变但 `showProgress` 变了，也要走这一次显隐。`StatusBarCodiconLabel` 仍把进度图标插在该容器的第一个子节点，动画节点在进度种类不变时不重建。
- 要动的符号或文件：`StatusbarEntryItem.update`（`src/vs/workbench/browser/parts/statusbar/statusbarItem.ts` 第 91–105 行）。显隐条件从只看 `entry.text`（第 100–104 行）改为同时看 `entry.showProgress`，并且在 `showProgress` 相对 `this.entry` 发生变化时也执行，不能只包在第 97 行的文案比较里。
- 明确不改什么：不改 `StatusBarCodiconLabel.showProgress` / `text`（第 303–345 行）。不改 aria、命令、beak、kind、颜色的更新分支。不改 `progressService.ts` 第 177–179 行「没有标题也没有消息就换下一条」。
- 怎样本地验证：没有覆盖 `StatusbarEntryItem.update` 显隐的测试。在 `src/vs/workbench/test/browser/parts/statusbar/statusbarItem.test.ts` 新增断言：`text` 为 `''` 且 `showProgress` 为 `true` 时 `labelContainer.style.display` 不是 `none`，容器内有进度图标；上一次已是空文、再把 `showProgress` 从 `false` 改为 `true` 时容器变为可见；从有文案改成空文但 `showProgress` 仍为真时容器保持可见；`text` 为 `''` 且 `showProgress` 为 `false` 时容器为 `display: none`。`scripts/test.sh --run src/vs/workbench/test/browser/parts/statusbar/statusbarItem.test.ts`。

## r02-3（hold）

- 问题类：同一横幅 id 再次 `show` 时只把横幅重新打开，文案、图标和操作仍是第一次建出来的节点。
- 不变量：`id` 相同且展示字段一致时，只 `setVisibility(true)` 并返回，不替换 `this.item`，不 `clearNode`，不 `clear` 内容用的 `DisposableStore`。展示字段是 `message`、`icon`、`actions`、`ariaLabel`、`closeLabel`。`message` 两边都是字符串时用 `===`，两边都是 `MarkdownString` 时用 `markdownStringEqual`，类型不同视为有变。`icon` 两边都是 `undefined` 视为相同；同为 `ThemeIcon` 时比 `id`；同为 `URI` 时比 `toString()`；其余组合视为有变。`actions` 缺省与 `[]` 都视为没有链接；否则按长度以及每项 `href` 和字符串 `label` 比较，`label` 不是字符串时视为有变。任一展示字段不同则重建：先把 `focusedActionIndex` 置为 `-1`，再 `clear` 内容 `DisposableStore`，再走第 188 行之后的 `clearNode` 与重建，最后 `this.item = item`。已可见时 `setVisibility(true)` 不会清下标（第 145–147 行只在可见性翻转时清），所以下标要在 `clearNode` 之前写成 `-1`。仅 `onClose` 函数身份不同、展示字段相同时不重建，关闭仍调用第一次 `show` 捕获的 `onClose`。`hide` 只改可见性，不 `clear` 这个 store。
- 要动的符号或文件：`BannerPart.show`（`src/vs/workbench/browser/parts/banner/bannerPart.ts` 第 181–232 行）和 `close`（第 94–107 行）。同 id 的提前返回改为展示字段比较。新建一个挂在 part 上的 `DisposableStore`，本次 `show` 里的 `Link`、`ActionBar`、`close` 用的 `Action` 登记到这个 store，不再直接 `_register` 到 part。重建前和 `close` 里现有的 `clearNode` 之前 `clear` 这个 store。比较放在 `BannerPart` 的私有方法上。
- 明确不改什么：不改 `hide`（第 173–179 行）的 id 判断和只隐藏。不改焦点移动的下标算法（第 109–171 行）和三条横幅键位。不改 `IBannerService` 的方法表，不加 `update`。
- 怎样本地验证：没有 `BannerPart.show` 的测试。在 `src/vs/workbench/test/browser/parts/banner/bannerPart.test.ts` 新增断言：同一 id 第二次 `show` 更换 `message` 后，消息节点的文本是第二次的字符串，且第一次登记的 `Link` 已 dispose；更换 `actions` 后，`messageActionsContainer` 里链接的 `href` 与文本是第二次的；同一 id、展示字段相同（含 `icon: undefined`，以及 `actions` 缺省与 `[]`）、中间 `hide` 过再 `show`，横幅重新可见且消息文本仍是第一次的；横幅已可见时更换 `message`，`focusedActionIndex` 回到 `-1`。`scripts/test.sh --run src/vs/workbench/test/browser/parts/banner/bannerPart.test.ts`。
