---
title: "UI 适配审查（2026-11-01）"
type: plan
status: draft
phase: M7
updated: 2026-11-02
summary: "默认编辑器窗口在不同宽高、窗口布局、主题与减弱动效下的静态审查，五路并行：静态没有确认 P0；P1 集中在窄宽截断、矮高度下 CTA 被裁、窗口最小宽度、高对比状态不可辨；宽度阈值有六套。未做运行时验证。"
---
# UI 适配审查（2026-11-01）

状态：执行中。范围：默认编辑器窗口的 Conversation、Sources、Navigator、Engine / Connection 首选项、窗口外框与布局集成，在宽度、高度、布局设置、主题和减弱动效变化下的表现。负责：agent:kiro。

## 范围与方法

「适配」在本次指四类条件：

- 容器宽高：叶宽、侧栏 / 辅助栏 / 面板宽高、窗口尺寸、200% 缩放后的 CSS 视口。
- 布局设置：侧栏左右、面板位置、辅助栏与面板最大化、Zen、标题栏形态、编辑器页签换行。
- 主题：浅色、深色、hc-black、hc-light、系统强制颜色。
- 动效：`prefers-reduced-motion` 与 `workbench.reduceMotion`。

判据取 [可访问性与响应式方案](../../plans/accessibility-responsive-ui.md) §5（RWD-1 / RWD-2）、§6（THEME-1）、§9 验收清单，以及 [产品愿景](../../../docs/product/vision.md) 体验原则 6。Agents Window（`src/vs/sessions/`）不在范围内。

本次是只读静态审查：

- 五路 `agent:context-gatherer` 并行读源码给出观察。第四路首次被限流，重派一次。
- `agent:kiro` 回到源码逐条核对关键证据。核对过的写在各条核对表里；没核对的标明沿用观察。
- 没有启动窗口，没有跑测试。凡要靠运行时确认的，判定写「待核对」并写明要看什么。

已在 [UI 组件审查](../2026-11-01-ui-components/README.md) 登记的问题不重复列。相关但不同的，在条目里写明关系。

## 分路表

| 路号 | 范围 | 文件 |
|---|---|---|
| a01 | Conversation 中心：叶宽档、SessionBar、Composer、时间线、浮层、Trajectory inspector | [a01-conversation-center.md](a01-conversation-center.md) |
| a02 | Sources 与 Navigator：页签条、列表行、矮高度、底部面板 Diff | [a02-sources-navigator.md](a02-sources-navigator.md) |
| a03 | Engine / Connection 首选项与 Client Settings 外框（RWD-2） | [a03-preferences.md](a03-preferences.md) |
| a04 | 窗口外框与工作台布局：Part 最小尺寸、侧栏位置、最大化、编辑器页签 | [a04-window-shell.md](a04-window-shell.md) |
| a05 | 横向：主题 token、高对比、减弱动效、缩放 | [a05-theme-motion.md](a05-theme-motion.md) |

## 结论摘要

优先级：P0 是该条件下主路径不可用或主要 CTA 不可达；P1 是内容被裁、不可返回、状态不可辨；P2 是一致性与细节。静态没有确认 P0；有两条在运行时核实后会升为 P0（a01-3、a03-3）。

| 优先级 | 编号 | 问题 | 判定 |
|---|---|---|---|
| P1 | a01-3 | Composer 自增高上限按视口 36vh，矮叶里会把时间线挤到 0，底栏可能被裁 | 待核对（核实 Send 被裁则 P0） |
| P1 | a01-4 | SessionBar 在 300–449px 仍是文字 tabs，标题和同步态可能被挤到 0；`min-width: 8ch` 写在不收缩的子元素上，不生效 | 8ch 成立；挤压待核对 |
| P1 | a02-1 | Files 页把 6 个 Explorer 动作不分宽度停到标题栏且不收缩，最窄 Sources 宽度下三个页签只剩省略号 | 成立 |
| P1 | a02-3 | Files / Changes / Review 行的文件名盒 `flex-shrink: 0`，长名被父级硬裁，没有省略号 | 成立 |
| P1 | a02-5 | Review 行的归属 chip 先占宽，400px 时文件名约剩 2px | 成立 |
| P1 | a02-6 | Sources 压到最小高度 120px 时 Changes 列表 0 行，多行提交信息会把 Commit 推出可视区 | 列表 0 行成立；Commit 待核对 |
| P1 | a03-3 | Agents 节把整节钉成 detail 视口高度并 `overflow: hidden`，矮窗口里编辑区与 Save 只剩很小的盒子 | 成立（Save 不可达则 P0） |
| P1 | a03-4 | Skills / Tools / MCP / Connection 列表只交视口高度、不写容器高度 | 待核对 |
| P1 | a03-6 | Connection 模态的身份条预留只平移宿主，模态高度仍按整窗算，底边可能出窗口 | 待核对 |
| P1 | a04-1 | 各 Part 最小宽之和约 870px，Electron 窗口最小宽 400，窄窗口时网格溢出；侧栏在右时导航先被裁 | 成立 |
| P1 | a05-1 | Navigator「当前会话」竖条被未提交改动删掉，高对比下没有替代，浅深色下与选中行同色 | 成立（涉及未提交改动） |
| P1 | a05-3 | 21 个文件 53 处 `toolbar.*` fallback 写死白色半透明，高对比下 token 为空走 fallback，hc-light 上按下与勾选态不可见 | fallback 成立；勾选态待核对 |
| P1 | a05-8 | 高对比焦点轮廓与组件 `:focus { outline: none }` 特异度相同，靠加载顺序决定 | 待核对 |
| P2 | a01-1 | `@container conversation-reading (max-width: 599px)` 与叶档 450 并存 | 成立 |
| P2 | a01-2 | Trajectory inspector 覆盖阈值 600，按表格宽算 | 成立 |
| P2 | a01-5 | 450–899px 时 Composer 次要控件藏在横向滚动后，More 只在 <450 出现 | 待核对 |
| P2 | a01-6 | Inbox 队列面板 `min-width: 320px` 大于 300px 叶 | 成立 |
| P2 | a01-7 | Composer 弹出菜单高度用固定 px，没有按视口封顶 | 待核对 |
| P2 | a01-8 | 宽度 0 时 `data-conversation-width="min"` 而类全关；`applyWidth` 无 0 守卫 | 成立（潜在） |
| P2 | a01-9 | 叶宽与阅读列 ResizeObserver 两个来源写同一组宽度类 | 待核对 |
| P2 | a01-10 | 时间线 Markdown 图片没有 `max-width`；表格部分不成立 | 待核对 |
| P2 | a01-11 | 时间线 `content-visibility` 120px 占位在窄档滚动时跳动 | 待核对 |
| P2 | a01-12 | ProcessFold 测不到宽时回退 400px | 待核对 |
| P2 | a01-13 | 每个叶的 SessionBar 都留 32px 右内边距 | 待核对 |
| P2 | a02-2 | 页签条用隐藏滚动条的横向滚动兜底溢出 | 待核对 |
| P2 | a02-4 | 父路径从尾部截断，丢掉近端目录 | 成立 |
| P2 | a02-7 | Changes / Review 空态与错误态不能滚动 | 待核对 |
| P2 | a02-8 | 底部面板 Diff 在矮面板下正文只剩 0–3 行，提示条不可滚 | 成立 |
| P2 | a02-9 | 两个 Diff 视图不读 `useInlineViewWhenSpaceIsLimited` / 断点设置 | 成立 |
| P2 | a02-10 | Projects 行 `is-compact` 没有任何 CSS；悬停出动作时行内跳动 | 成立（涉及未提交改动） |
| P2 | a02-11 | Projects 树 `layout` 高度可能为负 | 待核对 |
| P2 | a02-12 | Review 进度头的「Mark all reviewed」按钮可被压窄 | 待核对 |
| P2 | a02-13 | compact 档隐藏 Unreviewed 文字后可读名称来源不明 | 待核对 |
| P2 | a03-1 | 方案写 Connection 无左导航、九节；代码有导航 + Back、15 节 | 成立（文档） |
| P2 | a03-2 | Engine 窄档 `is-mid` 规则在纵向 flex 下把导航压成 280px 高 | 成立 |
| P2 | a03-5 | Connection 的 nav / detail 尺寸用常量估算，与 CSS 盒模型差 8–406px | 成立 |
| P2 | a03-7 | Rules / Hooks 两列网格按 pane 宽判窄，宽档里 detail 可能只有 296px | 待核对 |
| P2 | a03-8 | Client Settings 窄档 700，Engine / Connection 600 | 成立 |
| P2 | a03-9 | 宽屏时 banner、Test 行、设置行分隔线与 760px 卡片不对齐 | 成立 |
| P2 | a03-10 | Engine 确认气泡固定最宽 320px，没按视口收 | 待核对 |
| P2 | a03-11 | 窄档导航视图加 SAS 待确认时导航可能被挤没 | 待核对 |
| P2 | a03-12 | 高对比加窄屏时详情区没有外框 | 成立（是否预期待用户） |
| P2 | a04-2 | 窗口缩放时先让出空间的列随侧栏左右翻转 | 排序成立；往返效果待核对 |
| P2 | a04-3 | Sources 分隔线写死在左边，侧栏在右时落错一侧 | 成立 |
| P2 | a04-4 | 「最大化辅助栏」不隐藏 Conversation，也不加宽辅助栏 | 成立 |
| P2 | a04-5 | 面板「已最大化」等于「右列已隐藏」，手动关掉右列后按钮显示还原，点了会重开右列 | 成立 |
| P2 | a04-7 | 面板竖放时插在 Conversation 与 Preview / Sources 之间 | 待核对（产品意图） |
| P2 | a04-8 | wrapTabs 判断加入新建页签按钮宽度，可能更早退回单行滚动 | 待核对（涉及未提交改动） |
| P2 | a04-9 | 身份条 z-index 6 高于区域隐藏按钮的 5 | 待核对 |
| P2 | a05-4 | 未提交的 5% 悬停底特异度低于列表组件注入的悬停规则，不生效 | 悬停成立；选中前景待核对（涉及未提交改动） |
| P2 | a05-5 | 5% / 9% 中性底在浅深色下对底约 1.1–1.2:1，选中对悬停约 1.07–1.09:1 | 待核对（涉及未提交改动） |
| P2 | a05-6 | 新建页签按钮新增焦点规则用 focusBorder 与祖先写法高对比选择器 | 成立（涉及未提交改动） |
| P2 | a05-7 | Changes 文件夹头选中、焦点、悬停同色；新分隔线浅深色下透明 | 成立（涉及未提交改动） |
| P2 | a05-9 | 高对比下选中与错误都是 2px 实线内描边，只靠颜色区分 | 成立 |
| P2 | a05-10 | `ua-common.css` 的表面与阴影 token 使用次数为 0，各处手写 2–25% 九种比例 | 成立 |
| P2 | a05-11 | 子代理浮层阴影写死黑色；三处浮层在高对比下仍有 fallback 阴影 | 成立 |
| P2 | a05-12 | 四处各自的 `prefers-reduced-motion` 规则不尊重 `workbench.reduceMotion: off`（显式开启动效） | 成立 |
| P2 | a05-13 | 减弱动效下 spinner 两条规则意图相反，`conversationLens.css` 那条不生效 | 成立 |
| P2 | a05-14 | 全局减弱动效作用域漏掉 Diff 审阅面、挂在 workbench 根上的 Visualize 浮层、侧栏会话列表 | 成立 |
| P2 | a05-15 | hc-black 下几处手写主按钮可能没有边界 | 待核对 |
| P2 | a05-16 | `forced-colors` 只覆盖 Composer 与两类 chip | 待核对 |
| P2 | a05-17 | r02-7 那 13 条之外又有 4 条祖先写法高对比选择器 | 成立 |
| — | a04-6 | 四钮只在标题栏，native 标题栏下无界面入口 | 不成立：外观菜单、F1、快捷键都有 |
| — | a05-2 | Sources 页签选中态在高对比下不可见 | 已登记为 [r02-6](../2026-11-01-ui-components/r02-sources-navigator.md)，补充根因见 a05 |

## 共性根因

- **宽度阈值有六套。** 方案 §5 写 `.is-narrow` < 600、`.is-compact` < 300。代码里 Conversation 叶档是 900 / 450 / 300（`conversationNarrowLayout.ts`），阅读列容器查询是 599（a01-1），Trajectory inspector 是 600 且按表格宽（a01-2），Engine / Connection 是 600 / 300（`engineSectionChrome.ts:60-61`），Connection 字段行容器查询是 480，Client Settings 是 700（a03-8），Sources 是 600 / 300，过滤框停靠也是 600。方案与 [lens-and-trajectory](../../../docs/systems/conversation/lens-and-trajectory.md) 对 Conversation 的阈值也不一致（600 对 450）。
- **flex 默认值把截断做错。** 名称盒 `flex-shrink: 0` 加父级 `overflow: hidden`，省略号永远不出（a02-3、a02-10）。保底宽度写在不收缩的子元素上，父级照样缩到 0（a01-4）。纵向 flex 里用 `flex-basis` 限宽，结果限的是高（a03-2）。会挤占主信息的次要元素用 `flex-basis: auto`，主信息用 `flex: 1` 即 basis 0（a02-5）。
- **按视口而不是宿主取尺寸。** Composer 上限 36vh（a01-3），弹层用 `100vw` 封顶（a01-6、a01-7），模态预留只改宿主不改模态尺寸（a03-6）。并列叶、分屏、模态里，视口和宿主差得很远。
- **常量估算代替测量。** Connection 的 nav / detail 尺寸（a03-5）、Trajectory 回退 704（a01-2）、ProcessFold 回退 400（a01-12）。Engine 面板已改为优先量 DOM，可以照做。
- **高对比 token 为空时 fallback 假定深色底。** `toolbar.hoverBackground`、`toolbar.activeBackground`、`widget.shadow` 在 hcDark / hcLight 下注册为 `null`（`platform/theme/common/colors/editorColors.ts:338-359`），主题 CSS 不输出这些变量，于是 `var(..., rgba(255,255,255,.1))` 生效（a05-3、a05-11）。祖先写法 `:is(.hc-black, .hc-light) .monaco-workbench …` 永不匹配，现共 17 条（a05-17）。
- **减弱动效有三套机制。** `.ua-motion` 加媒体查询、`productAccessibility.css` 按 Part 作用域、各文件自己的媒体查询。三者对 `.monaco-enable-motion` 的处理和覆盖范围不一致（a05-12、a05-13、a05-14）。
- **默认窗口没有窄窗口策略。** Agents Window 有窄桌面抽屉（`src/vs/sessions/browser/layoutPolicy.ts`），默认窗口没有。Part 最小宽之和远大于窗口最小宽，溢出后由网格裁边（a04-1）。

## 涉及未提交改动的条目

a02-10、a04-8、a05-1、a05-4、a05-5、a05-6 落在当前工作树未提交的文件里（Navigator 列表 CSS、编辑器页签三件）。a05-7 的 Changes 列表 CSS 已在 `b5ec35bd101` 提交，不再是未提交改动（2026-11-01 签收时订正）。这些改动不是本次做的，本次没有动它们。改动的作者在提交前处理更合适。

## 待用户确认

1. **宽度阈值以哪套为准。** 方案写 600，Conversation 代码和知识文档写 450。要么改方案，要么改代码，并把 a01-1、a01-2、a03-8 收到同一口径。
2. **默认窗口要不要窄窗口策略**（a04-1）。可选：按优先级自动收起右列或侧栏；或者接受与上游同样的溢出，只把 Electron 窗口最小宽抬到 Part 最小宽之和。
3. **a03-12 高对比窄屏是否保留详情外框。**
4. **a04-4、a04-5、a04-7 是否是有意形态**：最大化辅助栏保留 Conversation；面板最大化等于隐藏右列；竖放面板夹在 Conversation 与右列之间。

## 下一步

- 先对 P1 中「成立」的条目分组写修复方案，放在本目录的 `plan-<主题>.md`，写 `覆盖问题：`，按 [DOCUMENTATION.md 规则 16](../../../docs/DOCUMENTATION.md) 走只读审查后再改代码。建议分组：Sources 行与页签截断（a02-1、a02-3、a02-5）；矮高度 CTA（a01-3、a02-6、a03-3）；高对比 fallback 与选择器（a05-3、a05-17，可与 r02-7 合并）。
- 「待核对」各条需要启动默认编辑器窗口逐项量。启动方法见 [测试配置](../../../docs/guides/test-profile.md)。各条写了要量的元素与尺寸。
- 校验沿用 [health-gates](../../progress/health-gates.md)。

## 签收（2026-11-01）

签收人：agent:kiro（用户委托）。判定为成立、已知、不成立的 39 条逐条只读复核到 HEAD `38c867b5268` 与工作区现状，对照了可访问性方案、parts-and-grid.md、lens-and-trajectory.md、navigator-tabs-access.md 与 ui-design-principles.md。判定为待核对的 25 条没签，要先在默认编辑器窗口按各条「要看什么」量过。没有跑测试。

| 结果 | 条目 |
|:-----|:-----|
| 签 | a01-8、a02-3、a02-9、a03-2、a03-3、a03-5、a03-9、a04-3、a04-6（确认不修）、a05-2（已知，归并 r02-6 / r02-7）、a05-12、a05-17（订正为 20 条） |
| 签（收窄） | a01-2、a01-6、a02-5、a02-8、a03-1、a05-1、a05-3、a05-6、a05-7、a05-11、a05-13、a05-14 |
| 不签，等用户决定 | a01-1、a03-8（待确认 1，阈值口径）；a04-1（待确认 2）；a03-12（待确认 3）；a04-4（待确认 4）；a01-4（标题与同步态谁先让位）；a02-1（窄档动作放哪）；a02-4（是否偏离上游截断）；a02-6（矮高度谁让位）；a02-10（Projects 窄档形态，现方案与 navigator-tabs-access.md 冲突）；a03-1 的 Connection 部分（认可现行左导航还是回退）；a04-2（缩放时谁先让宽）；a05-1 的浅深色部分与 a05-10（是否改 chatgpt-visual-language §20 的中性底口径）；a05-4（新注册颜色还是改产品主题）；a05-9（高对比线型） |
| 不签，并入别处 | a04-5：与 2026-10-30 r09-1 同一改动，那份补齐后一起签 |

a05-6 与 UI 组件审查里几条曾写「中性阴影焦点」的方案，都与已接受的 ui-design-principles 原则四（键盘焦点 1px `focusBorder`、输入框不用大阴影表达聚焦）和原则六（阴影只给浮层）冲突。原用户裁定 2 已被 D1 取代；a05-6 与相关焦点方案按 D1 使用 1px `focusBorder`，本审查只保留高对比祖先选择器与悬停 fallback 的修正。

## 按设计原则的决定（2026-11-01）

用户委托 agent:kiro 按设计原则决定上表「不签，等用户决定」的各项，决定写在 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md)，各条签收行已按决定改写。结果：39 条里签 27、签（收窄）11，只剩 a04-5 不签（并入 2026-10-30 r09-1）。「待用户确认」4 项的答案：1 按 D3（Conversation 450 / 300，首选项 600，上游 700 不动）；2 按 D17（临时收起辅助栏、右列、侧栏，另写方案）；3 按 D16（高对比保留外框）；4 按 D17（辅助栏最大化保留 Conversation、面板最大化保持合同，竖放面板位置不在本次决定内，a04-7 仍待核对）。待核对的 25 条不变。
焦点相关的原用户裁定 2 已被 D1 取代：a05-6 不改现有 `focusBorder`，只修高对比祖先选择器并入 a05-17，以及悬停 fallback。
