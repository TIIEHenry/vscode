---
title: "可访问性与响应式 UI 完成方案"
type: plan
status: accepted
phase: M7
updated: 2026-09-04
summary: "K1/K2/T1/L1 与 Q5b/Q6/E2-1/E2-7 代码已落；D19(1) 改口无动画节点；W1 未跑；D19(3) Connection Back 仍开；方案仍 accepted"
---

# 可访问性与响应式 UI 完成方案

> **需求：** [PRD-018](../../docs/product/requirements.md#prd-018-键盘可达与辅助功能) · [PRD-019](../../docs/product/requirements.md#prd-019-web--远程窗口一致性)。
> **父方案：** [M7 UI 完成波](m7-ui-completion-wave.md)（P 槽 Wave 0 见其 §4；实施归属见其 §3）。
> **现状：** 四钮默认键位与 F6 Part 循环已有实现（`layoutActions.ts`、`navigationActions.ts:292-313`）；conversation 目录已有透镜 tablist 左右键（`conversationLens.ts:1226-1248`）、过程折 `aria-expanded`、overlay `role=dialog`+`aria-modal`（无 focus trap，根节点 Escape 直接 `close()`），SessionBar `aria-live=polite`；没有 `prefers-reduced-motion` / 高对比度处理，也没有任何按宽度切换的布局规则；`ConversationLens` 没有 `layout()`。**Web 形态：** `IUniverseAgentConnection` / `IUniverseAgentSessionView` 只在 `workbench.desktop.main.ts:60-61` 注册；`IUniverseAgentHubService` 的 electron-browser 注册被 `connectionHub.contribution.ts:6` 静态 import，经 `uaPreferencesPanes.contribution.ts` → `conversation.contribution.ts` → `workbench.common.main.ts` 进入 Web 链；`workbench.web.main.ts` 无 UA 注册，`platform/universeAgent/browser/` 不存在。`contrib/conversation` / `navigator` / `sources` 的生产文件注入 `@IUniverseAgentConnection` 14 处、`@IUniverseAgentSessionView` 1 处。Web 入口下 strict `InstantiationService` 会让 StatusBar / Lens / Navigator 视图在创建时抛错（壳仍在，产品面空），而不是"诚实断连"。

## 1. 范围

本方案覆盖默认桌面窗与 Web/远程窗：

- Navigator、Conversation、Preview、Sources、Panel 的焦点进入/退出。
- Conversation chat tab、split、子代理对话框、轨迹透镜、过程折、Composer。
- permission/question/error/unknown/visualization/reviewNav。
- Connection、Engine Preferences 及其列表、tab、表单和状态。
- 300px 至宽屏、100%–200% zoom、高对比度、减少动态效果。

## 2. 实施归属

本方案是**合同 + 清单**；实施分布在三处，避免多写者改同一文件：

| 切片 | 合同出处 | 实施者 | 落在哪个切片 |
|------|----------|--------|--------------|
| A11Y-1 焦点图 / tablist / dialog（Conversation 部分） | 本方案 §3 | B | [conversation-ui-closeout Q5b](conversation-ui-closeout.md) |
| A11Y-1 四 Part keybindings 复核 | 本方案 §3 | C | 本方案 K1（只复核 `layoutActions.ts`；chat tab 命令由 B 在 `conversation.contribution.ts` 注册） |
| A11Y-2 时间线与座位 ARIA | 本方案 §4 | B | Q5b |
| A11Y-3 Engine/Connection 列表与表单 | 本方案 §3–§4 | A | [engine E2-1/E2-7](engine-preferences-completion.md) |
| A11Y-3 Sources Review / Diff 命令 | 本方案 §3 | C | 本方案 K2 |
| RWD-1 Conversation/Trajectory 窄宽度 | 本方案 §5 | B | Q6 |
| RWD-2 Engine/Connection 窄宽度 | 本方案 §5 | A | E2-7 |
| THEME-1 高对比度 / 200% / reduced motion | 本方案 §6 | C（公共规则文件）；B/A 在自己切片给动画节点挂 class | 本方案 T1 → B Q5b / A E2-7 |
| WEB-1 Web/远程诚实形态 | 本方案 §7 | P（三服务 browser 实现 + 移出 Hub import）+ A（Connection/Engine 页省略桌面控件）+ C（冒烟与复核） | P0 → A E2-1 → 本方案 W1 |

C 对 B/A 实施的切片提供验收清单（§9）并复核，不直接改 B/A 文件。

## 3. 键盘合同

| 表面 | 键盘行为 |
|------|----------|
| 四个产品 Part | 默认 keybinding 可见；F6/Shift+F6 进入循环 |
| chat tabs / split | chat tab 是 Conversation editor group 的 editor tab，**复用** `workbench.action.previousEditor` / `nextEditor`（`Ctrl/Cmd+PageUp/PageDown`）与 editor group 焦点规则，不另绑键位；不新造 DOM tablist |
| 子代理对话框 | 打开后 focus trap（Tab wrap）；Escape 顺序：局部详情 / 标题改名 / 图示 overlay → 对话框 → **不**关根会话；现有 `conversationSubAgentOverlay.ts:149` 根节点直接 `close()`、`conversationVisualizeOverlay.ts:110` `stopPropagation`、SessionBar 改名 Escape 只 cancel，B 在 Q5b 改监听顺序 |
| 对话/轨迹透镜 | `role=tablist/tab/tabpanel`；左右键切换 |
| 过程折 | button + `aria-expanded`；Enter/Space 切换 |
| permission/question | 选项组可方向键移动；提交后焦点回记录，不跳到页面顶 |
| Composer | Tab 进入工具栏；Enter 行为服从 `ua.client.keyboardEnter.behavior`；发送始终有键盘路径 |
| Engine/Connection | 左导航与内容分区可跳转；列表选择不自动触发危险动作 |
| Diff/Review | 行打开、切换已审阅、全部标记已审阅有 command/键盘路径（K2 三命令；不造「宿主移动」） |

## 4. ARIA 与可读名称

- 时间线每行读出角色、Agent、状态与正文摘要（`getConversationTurnAriaLabel` 扩展）；流式行名只在**进入 / 离开** streaming 时改一次「进行中」后缀，**禁止**按 token 增量更新 `aria-label` 或对正文设 `aria-live`（防读屏刷屏）；完整回合朗读复用 vscode Accessible View（`IAccessibleViewService`），不自造第二套 live 区。
- SessionBar 读出会话标题与同步态；连接级与会话级状态不混读。
- permission 与 question 使用不同 role/name；Allow/Skip 不读成答案选项。
- unknown 行读出原始类型名；error 行读出是否可重试。
- visualization 提供文本标题、替代说明与打开全屏动作。
- Review 行读出路径、审阅态和归因；不能只读 ●/○。
- Engine capability 状态与 transport failure 分开读；Engine 统一状态组件用 `role=status`。
- 装饰性 codicon 使用 `aria-hidden=true`。

## 5. 响应式布局

### 宽度档

| 可用宽度 | 行为 |
|----------|------|
| ≥ 900px | 完整双栏/详情并排 |
| 600–899px | 列表与详情可伸缩，次要 metadata 换行 |
| 300–599px | 单栏；详情覆盖列表并提供 Back；Composer 控件允许溢出菜单 |
| < 300px | 保持主输入与返回路径；不承诺完整并排，显示最小可用态 |

- 宽度档由**叶级宿主**的 `layout(dimension)` 打 class（`.is-narrow` < 600px、`.is-compact` < 300px），不用 viewport media query。Conversation 用 `ConversationEditorPane.layout` 的叶宽（多 session 叶时每叶独立；**禁止**用 `ConversationPart` 宽度代表 split 叶，`ConversationLens` 今天无 `layout()` 需由 B 接入）；Engine / Connection 用各 pane `layout(dimension).width`（今天只调 list 高度）。
- 不用横向滚动隐藏主要 CTA。
- SessionBar 标题可截断，但 Conversation/Trajectory tabs、同步态与 Back 仍可达。
- Engine Preferences 在窄宽度切单栏并可返回（A 在 E2-7 实施）；不把九节继续纵向压成固定高度。
- 轨迹 inspector 窄时覆盖表并带 Back；关闭后恢复原选中与滚动（B 在 Q6 实施）。
- zoom 200% 下没有不可关闭的 overlay。

## 6. 主题与动态效果

- 所有新 UI 只用 workbench color token。
- 高对比度下 focus outline、选中、错误、pending 可区分；C 在公共文件 `src/vs/workbench/browser/parts/conversation/media/ua-common.css`（`conversationPart.ts` import 一行）提供 `.hc-black / .hc-light` 下的 UA 状态 token 覆盖。
- `prefers-reduced-motion` 下禁用非必要 shimmer/平滑位移；流式仍用文字状态。公共文件提供 `@media (prefers-reduced-motion: reduce) .ua-motion { transition: none; animation: none }`；**B（Q5b）给 conversation 动画节点挂 `.ua-motion`**——今天 `conversationLens.css` 等仍把 `transition` 绑在选择器上，C 不改这些文件，T1 完成线只到公共文件落地。**A（E2-7）Engine / Connection pane 无 `transition` / `animation` / `@keyframes`，不挂空 `.ua-motion`（D19(1) 改口）。**
- 状态不能只靠红/绿或动画表达。

## 7. Web / 远程

- **前置 P0**（总方案 Wave 0）：`platform/universeAgent/browser/` 三个诚实实现——`IUniverseAgentConnection`（transport `idle`；snapshot **含全部已有 capability 键**且均 `UNSUPPORTED` reason「Web 不支持本机 Engine 连接」；`connect()` 不 throw、返回无 token 的 `{ methods: [], events: [] }`；`connectProfile` 返回 `ok:false` + `code: 'unsupported_environment'`——新增枚举值，**不是** `transport_failed`，否则会冒充传输失败态；`getConnectionPhase` = `disconnected`）、`IUniverseAgentSessionView` 空 lease、**`IUniverseAgentHubService`**（`getAuthStatus` = `unavailable`；`login` / `addDirectAddressProfile` 等 mutating 方法 `ok:false` + 环境码；profiles `[]`；`isEncryptionAvailable()` = `true`）；在 `workbench.web.main.ts` 注册，并把 `connectionHub.contribution.ts` 对 electron-browser 的 import 移到桌面入口。P0 未合入前 Web 产品 contrib 抛错，W1 不开工。
- Web 保持同一 Conversation、四钮、Navigator、Preview、Sources。
- **P0 stub 不会自动隐藏控件。** `ConnectionPreferencesPane` 今天无条件画 Hub 表单 / Direct / SAS / Test（`connectionPreferencesPane.ts:219-250`），`EnginePreferencesPane` 无条件画 Test Engine。**由 A 只在 E2-1 按 `getConnectionPhase` 与 capability reason 省略**这些桌面控件并显示「此环境不支持本机 Engine 连接」；W1 只复核。P0 + W1 合入而 E2-1 未合入时，不得声称 Web 已诚实（属 §10 硬阻塞）。
- Engine 页九节全部 unsupported，reason 同上；Client Settings 仍可用。
- 依赖 electron-main 的密钥、Hub、OS 通知在 Web 诚实省略；Client Settings 的通知走 `INotificationService`，Web 可用。
- 远程工作区路径与 Engine `workDir` 不匹配时沿用 Sources Review note。

## 8. 切片（C 直接实施）

| 切片 | 内容 | 代码完成线 | 依赖 |
|------|------|------------|------|
| K1 | 四 Part keybindings 复核（`layoutActions.ts`）与 Keyboard Shortcuts 可见性；确认 chat tab 切换复用 editor group 命令、不另绑 | 键位登记 [commands §7](../../docs/systems/conversation/commands.md)；C 不改 `conversation.contribution.ts` | — |
| K2 | Sources Review 行命令键盘路径 | 新建 `contrib/sources/browser/sourcesReviewCommands.contribution.ts`（`sources.contribution.ts` 加一行 import，C 拥有）：`sources.review.openSelected`（复用 `openSourcesChangeEntry`）、`sources.review.toggleReviewedSelected`（复用现有 Action `sources.review.markReviewed` / `markUnreviewed` 逻辑）、`sources.review.markAllReviewed`；为拿到选中行，扩展 `ISourcesReviewListHost`（`sourcesReviewHostService.ts`）暴露 `getSelectedEntry()`，实现类是 `SourcesTabsHost`（`sourcesTabsHost.ts:34`）转发到 `sourcesReviewList.ts`（C 在 K2 内改这两处）。**无「宿主移动」命令**（现无对应动作，不造）。改 [commands §5](../../docs/systems/conversation/commands.md)（今天写「Sources 无独立命令」） | — |
| T1 | 公共文件 `browser/parts/conversation/media/ua-common.css`：高对比度选择器写 `.monaco-workbench.hc-black` / `.monaco-workbench.hc-light`（见 `workbench/browser/media/style.css:129`，不是 UA 根 class）、`.ua-motion` + `prefers-reduced-motion` 规则；200% zoom overlay 复核 | 公共文件落地并被 `conversationPart.ts` import；B 挂 conversation 动画 class；A Engine/Connection 无动画节点不挂 | — |
| W1 | Web 冒烟脚本（`scripts/code-web.sh` / server 入口）+ D4 式 V1–V3 断言 + 桌面专属控件省略复核；证据入 `d15-evidence/` | Web 启动、四钮、Conversation 存在；Connection/Engine 页无桌面连接控件（依赖 A E2-1） | **P0**、A E2-1 |
| L1 | 验收清单（§9）交 B/A，并在其切片合入后复核 | 清单逐项有 pass/fail 记录 | B Q5a/Q5b/Q6/CS-2、A E2-1/E2-7、C K2 |

## 9. 验收清单（交 B/A 实施切片使用；kind 名按代码）

对话页 `ConversationTimelineEntryKind`（B Q5a/Q5b）：`user`、`assistant`、`system`、`thinking`、`tool`、`confirmation`（permission 座位）、`question`（独立提问座位，role/name 与 confirmation 不同）、`error`、`unknown`、`visualization`、`reviewNav` 各有可读名称与状态；流式行只在进入/离开 streaming 时改一次名；完整回合可经 Accessible View 朗读。
轨迹 `ConversationTrajectoryKind`（B Q5a；`compacted` 属 Q3）：`system`、`user`、`context`、`compacted`、`message`、`tool`、`subtool`、`thinking` + Q5a 新增 `permission`、`question`、`error`、`unknown` 各有可读名称。
- chat tabs 经 editor group 命令可切（组内最后一 tab 继续 `nextEditor` 会离开 Conversation 到下一 group，属 vscode 既有行为，不判 fail）；透镜 tablist 左右键可切；对话框 trap 根为 `overlay.element`、Tab wrap 与 Escape 顺序正确（B Q5b）。
- 座位提交后焦点回记录（B Q5b）；Composer Tab 进入工具栏、两种 Enter 模式均可发送（B CS-2）。
- Conversation 叶 300px：主输入、Back、透镜 tabs 可达；inspector 覆盖可返回；多叶时每叶独立判定（B Q6）。
- Engine / Connection 300px：左导航可返回，表单不溢出（A E2-7）。
- Web：Connection / Engine 页无桌面连接控件（A E2-1）；Sources Review 三命令可键盘触发（C K2）。
- 高对比度与 reduced-motion 下状态仍可区分（C T1 + B 对 conversation 动画节点挂 class；Engine / Connection 无动画节点，不挂空 `.ua-motion`）。

## 10. 非阻塞验证

axe/Lighthouse、视觉截图、键盘脚本、Web 冒烟失败记 D17，不阻塞后续 UI 切片。以下问题属于实现硬阻塞而不是测试债：

- focus trap 导致用户无法离开 overlay；
- 键盘触发危险动作且没有确认；
- Web 误显示可用的本机连接/密钥 UI（含 P0 已合入但 A E2-1 未省略控件的窗口期被宣称「已诚实」），或 Web 因缺服务无法实例化产品 contrib；
- 200% zoom 下主要关闭/发送操作完全不可达。

## 11. 状态

D14 当前虽标 closed，但只证明四钮与 F6 的一部分；M7 不沿用其「全部可访问性已完成」推论。D15 Web 证据以 P0 + A E2-1 为前置。PRD-018/019 只有在本方案各切片（含 B/A 承接的部分）落地且有相应证据后才升 `implemented`。

## 12. 规则 16

本方案 2026-09-02 经四轮审查后为 `accepted`。

**第一轮（本会话只读审查，2026-09-02）已改入：** Web 注册缺失与 P0 前置、实施归属表、宽度档以宿主 class 而非 viewport 判定、C 直接实施切片与清单分离。

**第二轮（Cursor CLI `cursor-grok-4.6-high` `--mode ask`，2026-09-02）：Approve with changes**（2 Critical + 9 Important + 4 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 P0 漏 `IUniverseAgentHubService`，Hub electron-browser 注册经 common 链进 Web | §7 / 总方案 P0 增 Hub browser 实现并移出 import |
| C2 「Web 不画桌面控件」无实施者 | §2 / §7 归 A E2-1/E2-7；W1 只复核；§10 硬阻塞补窗口期 |
| I1 归属表节号错位 | §2 表改真实节号 |
| I2 `Ctrl/Cmd+PageUp/PageDown` 已被 editor 命令占用 | §3 改为复用 editor group 命令，不另绑 |
| I3 宿主 `layout` 打 class 对 Conversation 不成立、Part 宽 ≠ 叶宽 | §5 改为叶级宿主 `ConversationEditorPane.layout`；Engine/Connection 用 pane width |
| I4 T1 完成线与「C 不改 B/A 文件」冲突 | §6 / T1 改为公共文件 + `.ua-motion`，B/A 挂 class |
| I5 流式 `aria-live` 刷屏 | §4 只在进入/离开 streaming 改名；复用 Accessible View |
| I6 清单 kind 与代码不符 | §9 按 `ConversationTimelineEntryKind` / `ConversationTrajectoryKind` 重列并标切片 |
| I7 P0 `connect*` 拒绝返回形未钉 | §7 写死 `connect()` 无 token 不 throw、`connectProfile` `ok:false` + `unsupported_environment` |
| I8 Escape 顺序与现有吞键 | §3 点名三处监听，B Q5b 改 |
| I9 K2 Sources 无命令、C 无所有权 | K2 列命令 id 与新文件；看板 C 所有权补 `contrib/sources` 命令 contribution |
| M1–M4 | 现状句改「14 处 + 1 处」与「视图抛错、壳仍在」；P0 snapshot 含全部键；T1 文件落点 |

**第三轮（同配置，附第二轮意见复核；2026-09-02）：Approve with changes**（0 Critical + 5 Important + 5 Minor）；第二轮 C1/C2、I1–I9、M1–M4、X1–X4 全部 Resolved。处理：

| 意见 | 处理 |
|------|------|
| I1 `ConversationEditorPane.layout` 不在 B 冲突域 | 看板 B 与 Conversation §10 补 `conversationEditorPane*` |
| I2 K2 命令 id 与现有 Action 不符、无「宿主移动」、import 点与选中行接口无主 | K2 重写：复用 `openSourcesChangeEntry` / `markReviewed` 逻辑，扩展 `ISourcesReviewListHost`，删 moveToHost，`sources.contribution.ts` import 行归 C |
| I3 Accessible View 无完成线 | Conversation Q5b 完成线加接入 `IAccessibleViewService`；§9 加勾选项 |
| I4 trap 边界与 Part 级 sessionBar 冲突 | Q5b 写死 trap 根 = `overlay.element`，overlay 自备透镜 tab / 标题行 |
| I5 §9 漏 `system` | 补 |
| M1 `nextEditor` 末 tab 离开 Conversation | §9 标不判 fail |
| M2 P0 Hub 方法未钉 | 总方案 P0 / protocol-surface 写 mutating `ok:false`、profiles `[]`、`isEncryptionAvailable()=true` |
| M3 高对比度选择器 | T1 改 `.monaco-workbench.hc-*` |
| M4 L1 依赖漏 CS-2 | 补 |
| M5 P0 `isEngineConnected()=false` / `Event.None` | 总方案 P0 写明 |
| X1 父方案 E2-7 含 Web 省略 | 父方案 / status.md 统一为只在 E2-1 |

**第四轮（确认轮；2026-09-02）：Approve**（0 Critical / 0 Important / 3 Minor：§3/§9「宿主移动 / 四命令」残句、K2 实现类 `SourcesTabsHost`、§7「E2-7」残句——均已改入）。**升 `accepted`。**
