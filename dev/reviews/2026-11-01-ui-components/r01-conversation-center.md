---
title: "r01 Conversation 中心组件"
type: reference
status: active
phase: M7
updated: 2026-11-01
summary: "Lens、Composer、时间线、问题座位与各类浮层的交互和视觉问题；路径相对 src/vs/workbench/contrib/conversation/browser/"
---
# r01 Conversation 中心组件

路径未写前缀时相对 `src/vs/workbench/contrib/conversation/browser/`。审查背景、判据和共性根因见 [README](README.md)。

## r01-1 Visualize 浮层按 Tab 会关闭，按 Escape 不关闭

状态：成立。优先级 P0。

观察（作者：agent:context-gatherer）：`conversationVisualizeOverlay.ts:120-127` 用 `addDisposableListener(overlay, 'keydown', …)` 收原始事件，再比较 `e.keyCode === KeyCode.Escape`。`KeyCode.Escape` 是 9，等于 DOM 的 Tab。结果是：按 Tab 走关闭分支，`handleConversationOverlayTab` 的焦点圈定永远轮不到；按 Escape（DOM 27）不命中。本文件没有别的 Escape 处理。只有 Visualize 嵌在 SubAgent 浮层里时，`conversationSubAgentOverlay.ts:180-185` 用 `event.key === 'Escape'` 调 `lens.tryCloseVisualizeOverlay()`，才能关掉。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `keyCodes.ts` 枚举（Tab=2、Enter=3、Escape=9）、`dom.ts` 中 `addDisposableListener` 不包装事件；`grep` 确认本文件只有这一处 Escape；测试 `conversationVisualizeOverlay.test.ts:153` 派发 `keyCode: KeyCode.Escape`（即 DOM Tab），所以测试通过但不代表真实按键 |

方案：改用 `addStandardDisposableListener`，与同目录 `conversationEngineHistoryList.ts` 一样先调用 `handleConversationOverlayTab` 再判 Escape；测试改为派发 `key: 'Escape', keyCode: 27`，并补一条「Tab 不关闭浮层」。

签收：签。签收人：agent:codex，日期：2026-11-01。

## r01-2 会话改名框 Enter 不提交、Escape 不取消、Tab 走取消

状态：成立。优先级 P0。

观察（作者：agent:context-gatherer）：`conversationLensSessionBar.ts:127-135` 同样用原始事件比较 `KeyCode.Enter`（3）和 `KeyCode.Escape`（9）。真实按键下：Enter（13）不命中，输入框停在编辑态，只有失焦（第 137-140 行）才提交；Escape（27）不命中；Tab（9）命中取消分支，丢掉已输入的名字。同一文件第 217-220 行的更多菜单用的是 `addStandardDisposableListener`，注释也写明了换算。改名框还没有输入法组字保护，修好按键后中文输入法确认候选词的 Enter 会直接提交。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读第 127-140、214-226 行；`conversationLens.test.ts` 第 3102、3128、3149、3174、3209 行派发 `keyCode: KeyCode.Enter / KeyCode.Escape`，同样把错误写进了期望 |

方案：换成 `addStandardDisposableListener`；Enter 分支复用 `conversationComposerIme.ts` 的组字判断；上述五个测试改派发 DOM 值，并补「Tab 不丢弃改名」。

签收：签。签收人：agent:codex，日期：2026-11-01。

## r01-3 另外四处原始 keyCode 比对

状态：收窄。优先级 P2。

观察（作者：agent:context-gatherer）：`conversationComposerAt.ts:146-150` 的添加弹层筛选框想让 Escape 冒泡、其他键截停，实际放行的是 Tab。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 收窄 | 代码写法确实错，但用户可见影响有限，逐处如下 |

- `conversationComposerAt.ts:146-150`：文档级捕获监听 `registerComposerPopupEscape`（`conversationContextViewEvent.ts:46`）用的是标准事件，先于筛选框收到 Escape，弹层照常关闭。错的只是 Tab 会冒泡出筛选框。
- `conversationComposerAt.ts:209-213`：`keyup` 上比较 `KeyCode.Tab`（2），真实 Tab（9）永不命中，Tab 接受建议后仍会触发一次 `refreshComposerAtSuggest`。有 `atMentionSuppressed` 兜底，是否会重开建议框未实测。
- `conversationEngineHistoryList.ts:152-161`、`conversationEngineSnapshotsList.ts:227-236`：浮层上的原始监听先调 `handleConversationOverlayTab`（内部自己换算），Tab 在那里就返回了；Escape 由第 163、238 行的文档级标准监听处理。这里的 `KeyCode.Escape` 分支是死代码，不影响行为。

方案：随 r01-1 一并改成标准事件，删掉两处死分支。可以加一条 ESLint 局部规则或 review 检查：原始 `KeyboardEvent` 不得与 `KeyCode.*` 比较。

签收：签（收窄）。签收人：agent:codex，日期：2026-11-01。

## r01-4 问题选项的键盘焦点和「已选中」同一底色

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：`media/conversationLens.css:4580-4601`，`[role="radio"]:focus` 与 `[role="checkbox"]:focus` 是 `outline: none; background-color: var(--vscode-list-hoverBackground)`，而 `[aria-checked="true"]` 用的是同一个背景色。焦点停在已选项上看不出变化；停在未选项上像是选中了。没有 `:focus-visible` 规则，也没有高对比规则。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读第 4567-4630 行；`grep question-option` 在 `hc-black` / `hc-light` 规则里无结果 |

方案：`:focus` 不再改底色，改为 `:focus-visible` 上的中性阴影焦点（写法见 [README](README.md) 用户裁定 2），与选中底色可以叠加区分；高对比用 `contrastActiveBorder` 轮廓。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D1）：`:focus` 不改底色；`:focus-visible` 画 1px `focusBorder` 内描，与选中底叠加区分；高对比用 `contrastActiveBorder`。不用中性阴影焦点。

## r01-5 问题座位自定义答案在输入法组字时按 Enter 会提交

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：`conversationQuestionSeat.ts:358-364` 只判断 `e.key === 'Enter'` 就 `submit()`，没有 `isComposing` / keyCode 229 / `compositionend` 之后的保护。Composer 已经有这套保护（`conversationComposerIme.ts`、`conversationLensDock.ts`），这里没有复用。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读第 354-365 行。各平台输入法在确认候选词时上报的 `key` 不同，Linux IBus / fcitx 下是否一定误提交未实测；代码缺保护这一点成立 |

方案：抽出 Composer 的组字判断给问题座位和改名框（r01-2）共用。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md)）：收窄：问题座位直接调用现有 `isComposerImeBlockedEnter`，本地记 `compositionend` 时间戳；不从 Composer 抽共用（`conversationLensDock.ts` 有他人未提交改动）。补一条组字单测（isComposing、keyCode 229、compositionend 后 500ms）。

## r01-6 删除 Composer 引用 chip 后焦点落到 body

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：`conversationComposerAt.ts:312-324` 的删除按钮点击后调用 `renderComposerRefChipRow`，后者在第 285 行 `reset(host.composerRefRow)`，正被聚焦的按钮随之销毁，之后没有 `.focus()`。键盘用户连续删除时每删一个都要重新找位置。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读第 305-324 行与 `renderComposerRefChipRow` 开头 |

方案：重绘后把焦点放到同一位置的下一个 chip 的删除按钮；没有剩余 chip 时回到 `dockTextarea`。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md)）：补齐方案：重绘后焦点给同一位置的下一枚 chip 的删除钮；删的是最后一枚时给前一枚；一枚不剩时回到 `dockTextarea`。验证：`conversationComposerAt` 相关单测连续删三枚，断言每次 `document.activeElement`。

## r01-7 改名框与自定义答案框聚焦只用 25% 前景色描边

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`media/conversationLens.css:266-268`（`.conversation-lens-session-title-input:focus`）与 `4623-4626`（`.conversation-lens-question-custom:focus`）都是 `outline: none; border-color: color-mix(in srgb, var(--vscode-foreground) 25%, transparent)`。同文件的添加 / 调参筛选框用的是 `--vscode-focusBorder`。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读两段规则。Composer 本身（第 3868-3891 行）也用 20% 描边，但那是大容器加阴影，高对比下另有 `contrastActiveBorder` 轮廓；这两个小输入框没有阴影，高对比规则未找到 |

方案：按用户裁定 2 不用 `--vscode-focusBorder`。两处改为中性阴影焦点（写法见 [README](README.md)），描边加深并加 2px 扩展阴影，让小输入框在浅色主题下也能看出聚焦；高对比补 `contrastActiveBorder` 轮廓。Composer 现有的阴影聚焦符合裁定，不改。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D1）：两处聚焦把描边换成 `focusBorder`，不加外圈阴影；高对比补 `contrastActiveBorder` 轮廓。

## r01-8 Visualize 浮层以 fixed 铺满整窗

状态：收窄。优先级 P2。

观察（作者：agent:context-gatherer）：`media/conversationVisualize.css:164-167` 是 `position: fixed; inset: 0; z-index: 2600`，而 SubAgent 浮层限制在会话叶内（`position: absolute; inset: 0; z-index: 5`）。多叶并排时 Visualize 可能盖住其他叶和整个工作台。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 收窄 | 同文件第 186-190 行 `.part.conversation .conversation-visualize-overlay { position: absolute; inset: 0; z-index: 20 }` 覆盖了 fixed。在默认窗的 Conversation 部件里浮层限在宿主容器内，观察不成立。只有 Lens 挂在 `.part.conversation` 之外（例如 `conversationEditorPane.ts` 的编辑器标签宿主）时才会铺满整窗，这条路径是否在产品里出现未核 |

方案：确认编辑器标签宿主是否属于产品路径；若属于，把第 164 行的基础规则也改成 `absolute`，由宿主提供定位上下文。参照 [session-windows](../../../docs/systems/conversation/session-windows.md) 的浮层要求。

签收：签（收窄）。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md)）：不实施。`ConversationEditorPane` 在 Conversation Part 的叶内，Visualize 宿主总是时间线槽位，浮层被 `.part.conversation` 规则限在宿主内；只有证实 `ConversationChatInput` 能打开到主编辑区时再重开。

## r01-9 时间线流式输出时的读屏播报

状态：待核对。

观察（作者：agent:context-gatherer）：`conversationTimelineHost.ts:123` 设 `role="log"`，第 155 行设 `role="feed"`，流式期间没有 `aria-busy`。`log` 隐含 `aria-live="polite"`，逐 token 重绘可能反复播报。

要看什么：用 Orca 在一次流式回复中听播报次数；确认是否需要在流式期间设 `aria-busy="true"`、结束后清除。`conversationTimelineFollow.ts` 的滚动锚定本次没有读。

## r01-10 Conversation 部件内的动效缺减弱处理

状态：不成立。

观察（作者：agent:context-gatherer）：Visualize、SubAgent、身份条的过渡没有本地 `monaco-reduce-motion` 覆盖；加载转圈只受系统媒体查询控制。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 不成立 | `src/vs/workbench/browser/media/productAccessibility.css:78-91` 对 `.part.conversation` 及其全部后代统一设 `transition-duration / animation-duration: 0.01ms !important`，并有意保留加载转圈。`workbench.reduceMotion` 默认跟随系统，所以系统偏好也会生效。本地缺覆盖不影响结果 |

## r01-11 Lens 字号与圆角未走令牌

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`media/conversationLens.css` 有 85 处 `font-size: <n>px`，令牌写法 28 处。圆角混用字面量和令牌，其中 `--vscode-cornerRadius-medium` 有两种回退值。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | `grep` 计数：px 字号 85 处；`cornerRadius-medium, 6px` 4 处、`cornerRadius-medium, 8px` 2 处 |

方案：不单独开大改。改到哪段样式就把该段字号换成 `--vscode-fontSize-*`，`cornerRadius-medium` 回退值统一为一个。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D14）：只做整份字号替换（13/12/11/10 → body1/label1/label2/label3）和 `cornerRadius-medium` 回退值统一为 6px。

## r01-12 浮层无障碍缺口的账本状态

状态：已知。

观察（作者：agent:context-gatherer）：[deferred-gaps](../../progress/deferred-gaps.md) 中 D1335、D1337、D1338、D1341、D1342、D1344 六行都是 `open`，但行文是「原……现……」，描述的修法在代码里已经能看到：Visualize 关闭按钮有 `ariaLabel`（`conversationVisualizeOverlay.ts:99`），关闭后有 `restoreConversationOverlayFocus`（第 131-136 行），收件箱队列行有键盘激活（`conversationInboxOverlay.ts:902-908`）。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 已知 | 按编号 `grep` 六行，末列均为 `open`；本次不改账本 |

要看什么：由账本负责人确认这六行是在等运行时验证还是漏了关闭。r01-1 修好前，D1341 对 Visualize 的 Escape 关闭验证无法通过。
