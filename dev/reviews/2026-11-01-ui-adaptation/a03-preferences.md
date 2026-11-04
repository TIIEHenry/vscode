---
title: "a03 Engine / Connection 首选项的适配"
type: reference
status: active
phase: M7
updated: 2026-11-01
summary: "Engine 与 Connection 首选项面板及 Client Settings 外框在窄宽（RWD-2）、矮高度、宽屏和缩放下的问题；路径相对 src/vs/workbench/contrib/conversation/browser/"
---
# a03 Engine / Connection 首选项的适配

路径未写前缀时相对 `src/vs/workbench/contrib/conversation/browser/`。判据和共性根因见 [README](README.md)。

基线：两个面板都按 `layout(dimension).width` 打类，阈值来自 `engineSectionChrome.ts:60-61`：`is-narrow` < 600、`is-compact` < 300、`is-mid` 为窄但不紧凑，窄档导航与详情互换并显示 Back。宽度来自首选项编辑器的 body 宽，不是窗口宽。Engine 的 nav / detail 尺寸优先量 DOM（`enginePreferencesPane.ts:442-474`）。各节的输入对话框都走 `IDialogService.input`，尺寸与关闭归上游；SAS 确认内联在面板里，不是浮层。下面只列问题。

## a03-1 方案与代码已分叉：Connection 有左导航和 Back，Engine 有 15 节

状态：成立。优先级 P2（文档）。

观察（作者：agent:context-gatherer）：

- [可访问性方案](../../plans/accessibility-responsive-ui.md) 第 58、87、124 行写 Connection「单栏分区表单、无左导航 / Back、不套 Engine nav 模式」。
- 代码里 Connection 有 `navList`（`connectionPreferencesPane.ts:465、533`），窄档有 Back（551-556），CSS 是 210px 左导航加窄档互换（`media/connectionPreferencesPane.css:63-70、181-203`），一次只显示一个分区。D1353 也按导航加 Back 描述。
- 方案第 86 行与 `dev/plans/engine-preferences-completion.md:19` 写九节，代码注册 15 节（`enginePreferencesPane.ts:236-250`）。
- `engine-preferences-completion.md:170` 的 E2-7 与代码一致。

验收若按方案 §5 / §9 的 Connection 描述执行，会把导航和 Back 判成不符。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `connectionPreferencesPane.ts:462-560`、`connectionPreferencesPane.css:141-203` |

**方案**：改方案 §3 表、§5、§9 里 Connection 的句子为「窄宽导航与详情互换并带 Back」，并把「九节」改成实际节数。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D15：方案「九节」改为不写死节数；Connection 认可现行「左导航 + 窄宽 Back」，同刀改可访问性方案第 58、87、124 行与 D19(3)。

## a03-2 Engine 窄档 is-mid 规则把导航压成 280px 高

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`media/enginePreferencesPane.css:328-331` `.is-mid:not(.is-showing-detail) .engine-preferences-nav { flex: 0 1 280px; width: min(100%, 280px) }`。这条有 5 个类，比 350-357 行 `.is-narrow .engine-preferences-nav { flex: 1 1 auto }` 的 4 个类更具体。窄档 body 是 `flex-direction: column`（337-339），`flex-basis: 280px` 作用在高度上；注释说本意是限宽。15 项 × 22px = 330px，高窗口里导航只显示约 12 行，下方大块空白。Connection 有同样的规则，但只有 5 项，看不出来。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `enginePreferencesPane.css:326-357` |

**方案**：is-mid 只限宽，例如 `flex: 1 1 auto; max-inline-size: 280px`。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。Connection 首选项里同一条规则（`connectionPreferencesPane.css` 的 is-mid nav）一并改。

## a03-3 Agents 节把整节钉成视口高度并 overflow: hidden

状态：成立。优先级 P1；Save 不可达则 P0。固定高度已确认；Save 可达性待运行时核对。

观察（作者：agent:context-gatherer）：`engineAgentsSection.ts:547-548` 在视口高度 > 0 时写 `container.style.height = viewportHeight px; overflow = 'hidden'`。编辑区 `.engine-agents-detail` 是 `flex: 1 1 auto; min-height: 0; overflow: auto`（`media/enginePreferencesPane.css:1381-1387`），textarea `min-height: 160px`（1624-1632）。矮窗口时标题、状态、工具条与列表先占高度，编辑区和 Save 只能在剩下的小盒子里内部滚动，外层 detail 滚动帮不上。方案 §5 禁止「纵向压成固定高度」。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 固定高度成立 | 读 `engineAgentsSection.ts:509-562` |

要看什么：pane 高约 400、200% 缩放下打开一个 agent 编辑，量 `.engine-agents-detail` 的 `clientHeight`，Save 能否滚到。

**方案**：堆叠模式改 `height: auto`，交给 detail-body 外层滚动；只在分栏时限高，并给编辑区最小高度。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。与可访问性方案 §5「不把各节纵向压成固定高度」一致。`engineCatalogSections.test.ts` 两处断言 `style.height === '480px'`，随之改。Save 不可达没有证实，按 P1 处理。

## a03-4 列表只交视口高度、不写容器高度

状态：待核对。优先级 P1（出现空白行）/ P2（只是嵌套滚动）。

观察（作者：agent:context-gatherer）：`engineSkillsSection.ts:324` `list.layout(Math.max(120, listHeight), width)`，`listHeight` 是整块 detail 视口高。`engineToolsSection.ts:344`、`engineMcpSection.ts:478` 同样。这几个文件里没有 `listContainer.style.height`，CSS 只有 `min-height: 100px`（`media/enginePreferencesPane.css:1302-1305`）。Agents 节会显式写容器高度。Connection 同理（`connectionPreferencesPane.ts:1135-1138`，CSS 612-617）。可能出现虚拟列表外的空白行，或列表等于整块视口把编辑区推到第二屏、滚轮被列表截住。ListView 会不会给容器设高度没查。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `connectionPreferencesPane.ts:1134-1146` |

要看什么：Skills 20 条以上、pane 高 500 时，`.engine-skills-list` 实际高度与 `renderHeight` 是否一致，下方有无空白行，编辑区是否要先滚出列表才能看到；Connection 设备多于 10 台时同样看。

**方案**：节内显式写 `listContainer.style.height = min(内容高, 视口预算)`，与 Agents 节一致。

签收：待用户。

## a03-5 Connection 的 nav / detail 尺寸是常量估算

状态：成立。优先级 P2。数值偏差已确认；可见影响待运行时核对。

观察（作者：agent:context-gatherer）：`connectionPreferencesPane.ts:1108-1132` 按 20px 内边距、nav 220 估算，从不量 DOM。CSS 实际是 pane 内边距 28px（`media/connectionPreferencesPane.css:29`）、紧凑档 10px、nav 210 加 20 间距、卡片 16px 内边距加 1px 边框、`max-width: 760px`。1400px 宽时 TS 算 detail 1132，CSS 实际 760。目前列表没开横向滚动或动态行高，偏差多半只影响 `renderWidth`。Connection 28px 内边距、Engine 20px，与 [r03-9](../2026-11-01-ui-components/r03-preferences-session-chrome.md) 的面板分叉同源。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 数值成立 | 读 `connectionPreferencesPane.ts:1108-1132`、`connectionPreferencesPane.css:24-30` |

要看什么：设备名很长、pane 600–900 时设备行右侧是否被截。

**方案**：照 Engine 改为量 `scrollBody` 与 `navHost`，删掉魔数。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。照 Engine 已有的量 DOM 写法改。小订正：nav 宽给的是 210，不是 220，结论不变。

## a03-6 Connection 模态的身份条预留只平移宿主，模态高度仍按整窗算

状态：待核对。优先级 P1。

观察（作者：agent:context-gatherer）：`connectionPaneIdentityStripReservation.ts:108-119` 把模态宿主 `top` 设为预留值（≤60px 且 ≤ 视口 25%），CSS 同步改 `height`（`media/connectionPreferencesPane.css:16-22`）。模态尺寸由 `browser/parts/editor/modalEditorPart.ts:667-718` 按主容器尺寸算，默认 80% 居中，最大化取可用高减内边距，没扣预留。预留只在 Connection 的 `layout()` 末尾调用（1070），宿主上的类与 inline `top` 不移除，Engine pane 不调用。模态底边可能出窗口最多约 60px；切到 Engine 后预留可能残留。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 读 `connectionPreferencesPane.css:16-22`；`modalEditorPart.ts` 未读 |

要看什么：800×400 CSS px、身份条可见时打开 Connection 并最大化，比较 `.modal-editor-resizable` 的 `getBoundingClientRect().bottom` 与 `innerHeight`；再切到 Engine，看宿主 `top` 是否残留。

**方案**：把预留传给模态布局的可用高度；离开 Connection 时清掉宿主 inline 样式。

签收：待用户。

## a03-7 Rules / Hooks 两列网格按 pane 宽判窄

状态：待核对。优先级 P2；主要按钮被裁则 P1。

观察（作者：agent:context-gatherer）：`media/enginePreferencesPane.css:1237-1242` `grid-template-columns: 1fr 1fr`，只有 380-383 行在 `.is-narrow`（pane < 600）下改成单列。pane 600 到约 730 时 section 内容宽 296 到约 420，每列 140–200px。`1fr` 最小值是 min-content，长作用域名或按钮可能撑宽后被 pane 的 `overflow-x: hidden` 裁掉。Overview 按 detail 宽 < 400 自行堆叠（`engineOverviewSection.ts:186`），Connection 字段行用容器查询 480，各节口径不一。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `enginePreferencesPane.css:1237-1242、380-383` |

要看什么：pane 宽 620 时 Rules / Hooks 两列里的长路径和按钮是否被裁。

**方案**：改用 detail-body 容器查询，或在 section 的 `layout(width)` 里打类；列用 `minmax(0, 1fr)`。

签收：待用户。

## a03-8 Client Settings 窄档 700，Engine / Connection 600

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`media/uaClientSettingsChrome.css:6-10` 注释写 SettingsEditor2 在 <700 时用 `narrow-width`。Engine / Connection 用 600。编辑器宽 600–699 时，在 Client Settings 与 Engine / Connection 之间切换，一边单栏，另一边双栏且 detail 只有 330–430px。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 未读 CSS |

**方案**：统一阈值，或在方案里写明两套是有意的。属于 README「待用户确认 1」。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D3：不改阈值。Engine / Connection 600 与上游设置编辑器 700 并存是有意的，在可访问性方案里写明。

## a03-9 宽屏时卡片外的 banner、Test 行与卡片不对齐

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：Engine detail-body 有 `max-width: 760px`（`media/enginePreferencesPane.css:279-286`），断连 banner 与 `.engine-test-row`（390-400）是 pane 直接子元素，没有 `max-width`，1400px 时拉满。Connection 卡片 760，header 640、字段行 560、输入框与按钮 480，设置行分隔线止于 560，卡片内宽 726。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `enginePreferencesPane.css:278-400`、`connectionPreferencesPane.css:141-160、299-345、721-731` |

**方案**：banner 与 Test 行跟卡片同 `max-width`；`.ua-setting-row` 去掉 560 上限，只限控件宽。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。ui-design-principles 没有 560 / 760 的宽度合同，这是对齐修正，不算新视觉。

## a03-10 Engine 确认气泡最宽 320px，没按视口收

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：`media/enginePreferencesPane.css:1172-1182` `.engine-confirm-popover { width: max-content; max-width: 320px }`。视口小于约 336 CSS px 时（640px 窗口加 200% 缩放），按钮可能出视口。与 [r03-6](../2026-11-01-ui-components/r03-preferences-session-chrome.md)（关闭后焦点）不同。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `enginePreferencesPane.css:1171-1182` |

要看什么：320 CSS px 宽视口里触发删除确认，按钮是否完整可见，Esc 能否关闭。

**方案**：`max-width: min(320px, calc(100vw - 16px))`。

签收：待用户。

## a03-11 窄档导航视图加 SAS 待确认时导航可能被挤没

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：窄档导航视图下，`syncPairingConfirmHostParent()` 把 SAS 宿主挂到 pane 根上（`connectionPreferencesPane.ts:1805-1813`），宿主 `flex-shrink: 0`。nav `overflow: hidden`，`getNavHeight` 保底 80（1116-1121）。pane 高约 300 时导航可能只剩一两行。SAS 按钮可滚到。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `connectionPreferencesPane.ts:1805-1823` |

要看什么：400×300 的 pane 里触发配对，导航行是否可见，SAS 两个按钮是否可达。

**方案**：窄高时把 SAS 宿主放进可滚的 detail，或给 nav `min-height`。

签收：待用户。

## a03-12 高对比加窄屏时详情区没有外框

状态：成立；是否预期待用户。优先级 P2。

观察（作者：agent:context-gatherer）：Engine 窄档 `border: none`（`media/enginePreferencesPane.css:1809-1814`，4 个类）比高对比的 `border-color: contrastBorder`（1802-1807，3 个类）更具体。Connection 窄档 `border: 0`（`connectionPreferencesPane.css:773-778`），高对比规则只改 `border-color`。status.md 记的是「窄屏移除外层卡片，高对比保留 contrastBorder」，没说窄屏高对比是否保留框。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `enginePreferencesPane.css:1802-1822`、`connectionPreferencesPane.css:757-778` |

**方案**：用户确认后二选一：高对比窄屏补外框；或在知识文档写明窄屏不画框。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D16：窄屏去掉卡片内衬与底色，高对比主题下保留 1px `contrastBorder` 外框。
