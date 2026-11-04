---
title: "UI 组件交互与视觉审查（2026-11-01）"
type: plan
status: draft
phase: M7
updated: 2026-11-02
summary: "默认编辑器窗口 Conversation、Sources、Navigator、首选项与会话外框的静态审查：键盘主路径三处坏（原始 keyCode 比对、待配对行无键盘激活），焦点与高对比若干缺口，控件尺寸与令牌不一致。未做运行时验证。"
---
# UI 组件交互与视觉审查（2026-11-01）

状态：执行中。范围：默认编辑器窗口的 Conversation 中心、Sources、Navigator、Engine / Connection 首选项与会话外框。负责：agent:kiro。

## 范围与方法

只看默认编辑器窗口。Agents Window（`src/vs/sessions/`）不在范围内，依据见 [产品愿景](../../../docs/product/vision.md)。视觉判据取愿景的体验原则 6：底色中性，强调色只给焦点、选中、链接和进行中；不用彩色徽标；空态一两句话说清为什么空、下一步做什么；键盘焦点始终可见。

本次是只读的静态审查：

- 观察由三路 `agent:context-gatherer` 读源码给出。
- `agent:kiro` 逐条回到源码核对，并补查了观察里没有确认的部分（`KeyCode` 枚举值、监听器类型、主题类挂载位置、全局减弱动效规则）。
- 没有启动窗口，没有跑测试。凡是要靠运行时才能确认的，判定写「待核对」，并写明要看什么。

## 分路表

| 路号 | 范围 | 文件 |
|---|---|---|
| r01 | Conversation 中心：Lens、Composer、时间线、问题与确认座位、Visualize / SubAgent / History / Snapshots 浮层 | [r01-conversation-center.md](r01-conversation-center.md) |
| r02 | Sources 与 Navigator：页签、列表、行内筛选框 | [r02-sources-navigator.md](r02-sources-navigator.md) |
| r03 | Engine / Connection 首选项、SAS 配对确认、身份条、会话胶囊 | [r03-preferences-session-chrome.md](r03-preferences-session-chrome.md) |

## 结论摘要

优先级：P0 是键盘主路径不可用，P1 是焦点不可见、读屏或高对比缺口，P2 是一致性与令牌问题。

| 优先级 | 编号 | 问题 | 判定 |
|---|---|---|---|
| P0 | r01-1 | Visualize 浮层按 Tab 会关闭，按 Escape 不关闭 | 成立 |
| P0 | r01-2 | 会话改名框 Enter 不提交、Escape 不取消、Tab 走取消 | 成立 |
| P0 | r03-1 | Connection 待配对行能聚焦但不能用键盘选中，点击后焦点丢失 | 成立 |
| P1 | r01-4 | 问题选项的键盘焦点和「已选中」同一底色 | 成立 |
| P1 | r01-5 | 问题座位自定义答案在输入法组字时按 Enter 会提交 | 成立 |
| P1 | r01-6 | 删除 Composer 引用 chip 后焦点落到 body | 成立 |
| P1 | r02-1 | Navigator 列表没有键盘可达的上下文菜单 | 成立 |
| P1 | r02-2 | 五个行内筛选框 Escape 只清空，不能把焦点交还列表 | 成立 |
| P1 | r02-6 | Sources 页签悬停与选中外观相同，高对比下选中指示也不出现 | 成立 |
| P1 | r02-7 | 13 条 `:is(.hc-black, .hc-light) .monaco-workbench …` 高对比规则永不匹配 | 成立 |
| P1 | r03-2 | 高对比主题下 Connection 输入框聚焦没有可见变化 | 成立 |
| P1 | r03-4 | SAS 配对确认框：无可读名称、两个主按钮、关闭后焦点不还原 | 成立 |
| P1 | r03-5 | 直连地址校验失败只写状态行，不标到字段 | 成立 |
| P2 | r01-3 | 另外四处原始 keyCode 比对，用户可见影响有限 | 收窄 |
| P2 | r01-7 | 改名框与自定义答案框聚焦只用 25% 前景色描边 | 成立 |
| P2 | r01-11 | Lens 字号与圆角未走令牌，`cornerRadius-medium` 回退值不一 | 成立 |
| P2 | r02-4 | Review 归属 chip 用徽标色 | 成立 |
| P2 | r02-5 | 五个行内筛选框高度、圆角、静止描边、高对比、动效各不相同 | 成立 |
| P2 | r02-9 | Navigator 不在全局减弱动效规则的覆盖范围内 | 成立 |
| P2 | r02-10 | 单击 / 双击打开在相邻列表之间不一致 | 成立 |
| P2 | r02-11 | Navigator 空态文案不说原因和下一步 | 成立 |
| P2 | r02-12 | `sources-stub-empty` 是死样式 | 成立 |
| P2 | r02-13 | Sources / Navigator 字号 51 处写死 px，令牌 0 处 | 成立 |
| P2 | r03-3 | Connection 返回按钮回到 28px，与精修后的 24px 不一致 | 成立 |
| P2 | r03-9 | Engine 与 Connection 两个首选项面板的行距、圆角、按钮尺寸已分叉 | 成立 |
| P2 | r03-11 | 「Allow private networks」标签与说明没有关联到复选框 | 成立 |
| — | r01-12 | D1335 / D1337 / D1338 / D1341 / D1342 / D1344 修法已在代码里，账本仍是 open | 已知 |
| — | r01-10、r03-12 | Conversation 部件内动效缺减弱处理 | 不成立 |
| — | r03-8 | 彩色状态点与状态底色违反原则 6 | 不成立（用户裁定） |
| P2 | r01-8 | Visualize 浮层基础规则是 fixed，仅在 Conversation 部件外的宿主里铺满整窗 | 收窄 |
| — | r01-9、r02-3、r02-8、r03-6、r03-7、r03-10 | 需要运行时确认 | 待核对 |

## 共性根因

- **原始 DOM 事件和 `KeyCode` 枚举混用。** `addDisposableListener` 把原始 `KeyboardEvent` 交给回调，`e.keyCode` 是 DOM 值（Tab 9、Enter 13、Escape 27）。`KeyCode` 枚举里 Tab 是 2、Enter 是 3、Escape 是 9（`src/vs/base/common/keyCodes.ts`）。所以原始事件上的 `e.keyCode === KeyCode.Escape` 实际匹配 Tab。只有 `addStandardDisposableListener` 或手动 `new StandardKeyboardEvent(e)` 才会换算。同一文件里两种写法并存，例如 `conversationLensSessionBar.ts` 第 127 行用原始事件，第 217 行用标准事件。r01-1、r01-2、r01-3 都是这一类。
- **单测把错误写进了期望。** `conversationVisualizeOverlay.test.ts:153` 派发 `{ keyCode: KeyCode.Escape }`，也就是 DOM 的 Tab；`conversationLens.test.ts` 第 3102、3128、3149、3174、3209 行同理。这些测试会通过，却证明不了真实按键。修复时要改成派发 DOM 值（或 `key: 'Escape'`），否则测试会在修好后反而失败。
- **高对比选择器写成祖先形式。** 主题类和 `monaco-workbench` 都加在同一个元素 `layoutService.mainContainer` 上（`workbenchThemeService.ts:120、640`，`workbench.ts` 中 `this.mainContainer.classList.add(...workbenchClasses)`）。`:is(.hc-black, .hc-light) .monaco-workbench …` 要求高对比类在祖先上，因此永不匹配。正确写法是 `.monaco-workbench:is(.hc-black, .hc-light) …`，本仓多数文件已经这样写。
- **筛选框和列表焦点样式按面板复制。** 行内筛选框的 TS 有五份近乎相同的副本，CSS 有四种写法，键盘行为和外观因此各自漂移（r02-2、r02-5）。

## 用户裁定（2026-11-01）

1. **彩色状态点不算违反原则 6。** 身份条引擎状态点的绿 / 黄 / 红、离线与失败文字色、Connection 状态行的彩色底都保留。r03-8 判为不成立。
2. **（2026-11-01 已被 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D1 取代：键盘焦点仍用 1px `focusBorder`。原因是下面这套中性阴影在白底上对比约 1.3–1.9:1，达不到 3:1，并与规范原则四、六冲突。以下原文保留。）焦点不用彩色焦点框，可以用阴影。** 本次审查各条方案里新增或改动的焦点样式，一律不用 `--vscode-focusBorder` 描边或轮廓，改用下面的中性阴影焦点。受影响的方案：r01-4、r01-7、r02-4、r02-5、r03-2。

中性阴影焦点的写法（数值是起点，实施时在浅色和深色产品主题里目测调整）：

```css
/* 静止描边保持前景 8% 左右；聚焦时 */
border-color: color-mix(in srgb, var(--vscode-foreground) 30%, transparent);
box-shadow: 0 0 0 2px color-mix(in srgb, var(--vscode-foreground) 12%, transparent);
outline: none;
```

高对比主题不用阴影，仍用 `1px solid var(--vscode-contrastActiveBorder)` 轮廓。这是本次的假设：高对比主题的 `widget.shadow` 通常为空，阴影看不见，而原则 6 要求焦点始终可见。

## 待用户确认

1. **裁定 2 是否推广到现有控件：已决，不推广。** D1 已取代裁定 2；现有按钮、页签、列表行、菜单项的 `:focus-visible` 普遍用 `--vscode-focusBorder` 轮廓（例如 `sourcesTabs.css:283`、`conversationIdentityStrip.css` 的 chip、两个首选项面板的按钮），这些现有轮廓符合规范并保留。受影响的审查方案按 D1 改用 1px `focusBorder`，不另开全产品统一计划。
2. **是否把两条裁定写进 [产品愿景](../../../docs/product/vision.md) 原则 6。** 愿景属于需要用户确认才能改的文档，本次没有改。

## 下一步

- 先对 P0 三条写修复方案，放在本目录的 `plan-<主题>.md`，写明 `覆盖问题：`，按 [DOCUMENTATION.md 规则 16](../../../docs/DOCUMENTATION.md) 走只读审查后再改代码。
- 「待核对」各条需要启动默认编辑器窗口逐项操作，方法见各条的「要看什么」。
- 校验沿用 [health-gates](../../progress/health-gates.md)：`compile`、`eslint`、`scripts/run-unit-custom.sh` 跑受影响的单测。

## 签收复核（agent:kiro，2026-11-01）

27 条待签条目已由 agent:codex 在各分路文件里全部签成「签」或「签（收窄）」。agent:kiro 受用户委托做同一轮签收审查，逐条只读复核到 HEAD `38c867b5268`，结论有出入的条目如下。分路文件里 agent:codex 的签收行原样保留，等用户决定以哪份为准。没有跑测试。

| 条目 | agent:codex | agent:kiro | 理由 |
|:-----|:-----|:-----|:-----|
| r01-4、r01-7、r02-4、r02-5、r03-2（非高对比部分） | 签 | 不签 | 方案按用户裁定 2 改「中性阴影焦点」，与已接受的 [ui-design-principles](../../../docs/architecture/cross-cutting/ui-design-principles.md) 原则四（键盘焦点 1px `focusBorder`；输入框聚焦换 `focusBorder`、不用大阴影）、§3.2 焦点一行和原则六（阴影只给浮层）冲突。上面「待用户确认」只提到 vision.md，漏了这份规范。按愿景原则 5，先改规范再实施。r03-2 的高对比部分可以先签。 |
| r02-4 | 签 | 不签 | 另与原则一冲突：芯片常态无底无框，方案给 6% 底；芯片用 `cornerRadius.small`、10px 只给计数徽标，方案没处理圆角和字号。 |
| r02-5 | 签 | 不签 | 另与 Sources overview.md「三个 tab 用同一套 22px 圆角输入」冲突（方案统一 24px），并推翻已实施的 control-detail-polish A（会话筛选框聚焦改用 `focusBorder`）。 |
| r02-10、r02-11、r03-9 | 签 | 不签 | 方案原文就写着先由用户定：单击打开规则、空态文案与需求改动、两个首选项面板以哪边为基准。 |
| r02-13 | 签 | 不签 | 只写「随 r02-5 一起换」，没有可执行范围；计数现为 53 处，不是 51。 |
| r01-6 | 签 | 不签 | 方案缺：删掉最后一枚但前面还有 chip 时焦点落到哪里，以及本地验证用哪条单测。补齐后可签，不需要产品决定。 |
| r01-8 | 签（收窄） | 不签，建议改判 | 前提「编辑器标签宿主在 `.part.conversation` 外」与 parts-and-grid.md 矛盾：`ConversationEditorPane` 在 Conversation Part 的叶内，Visualize 宿主总是时间线槽位。方案是「先确认再决定」，不是改法。 |
| r01-5 | 签 | 签（收窄） | 在问题座位里直接调用现有 `isComposerImeBlockedEnter`，本地记 `compositionend` 时间戳；排除「从 Composer 抽出共用」，它会改到有他人未提交改动的 `conversationLensDock.ts`。补一条组字单测。 |
| r01-11 | 签 | 签（收窄） | 只签把 `cornerRadius-medium` 的 8px 回退值改成 6px；「改到哪段就换字号」原则二早已规定，不是有范围的方案。 |
| r02-1 | 签 | 签（收窄） | 只给已有行内动作的 Agents 活动列表与 Projects 列表加右键 / Shift+F10，菜单等于行内动作；Team、Inspect 与层级树没有行内动作，菜单内容要另定。 |
| r02-2 | 签 | 签（收窄） | 只签空框 Escape 还焦点、DownArrow 进列表；排除「Enter 打开第一项」：Review 打开会标已审阅，会话行打开会切会话，是新交互。第六份副本 `explorerInlineFilterBox.ts` 要写明纳不纳入。 |
| r02-6 | 签 | 签（收窄） | 只签高对比选择器（与 r02-7 同一改动）；非高对比下悬停与选中外观（字重 600 或底部 2px）是新视觉，要用户选。 |
| r02-7 | 签 | 签（收窄） | 排除「拒绝 `^:is(.hc-` 开头」的检查：contrib 下有 75 行合法地以 `:is(.hc-` 开头，只能精确匹配祖先形式。 |
| r02-9 | 签 | 签（收窄） | 只加 Navigator 各视图根类，不用 `.part.sidebar` 这类容器选择器（侧栏里还有上游 Explorer）。 |
| r03-1 | 签 | 签（收窄） | 只签手写行补 Enter / Space、容器改 `listbox` 加行 `option` 与 `aria-selected`、重建后还焦点；排除改用 WorkbenchList（行外观与高度会变）。 |
| r03-5 | 签 | 签（收窄） | 只签 `aria-invalid`、`aria-describedby` 与聚焦第一个出错字段；排除 `validationOptions` 气泡（新视觉，且会改掉测试依赖的文案）。 |

结论一致的：r01-1、r01-2（测试清单还漏了 `conversationLens.test.ts` 里另一处 `KeyCode.Escape` 派发）、r01-3、r02-12、r03-3、r03-4、r03-11。

## 按设计原则的决定（2026-11-01）

用户委托 agent:kiro 按设计原则决定上面复核里的分歧，决定写在 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md)。分路文件里每条受影响条目的签收行下面加了一行「决定」，写明按哪一条、怎么改；agent:codex 的签收行保留。结果：

- 27 条都可以实施，但改法以「决定」行为准：焦点类（r01-4、r01-7、r03-2）按 D1 用 `focusBorder`；r02-2、r02-5 按 D11；r02-4 按 D13；r02-6 按 D12；r02-10 按 D9；r02-11 按 D10；r01-11、r02-13 按 D14；r03-9 按 D15。
- r01-6 补齐了焦点去向与验证；r01-8 不实施。
- r01-1、r01-2、r01-3、r02-12、r03-3、r03-4、r03-11 按原方案。

上面原「待用户确认」两项：第 1 项已由 D1 决定为不推广，现有 `focusBorder` 轮廓保留；第 2 项不改愿景。原裁定 2 的中性阴影只保留作历史记录，受影响条目按 D1 使用 1px `focusBorder`。
