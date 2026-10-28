---
title: "跨叶 Composer 收尾设计及源码复核"
type: reference
status: accepted
phase: M7
updated: 2026-10-28
summary: "Astra判定及修后源码C0/I0/M2；运行与默认窗口验证边界独立保留。"
---

# 行内 turnEdit Composer 归属：收尾设计裁定

日期：2026-10-28。范围：人类工位现有未提交 WIP 的跨叶输入 DOM 归属。只读源码与文档审查；未改仓库、未构建、未运行测试、未启动 UI。唯一写入是本临时报告。按 root 授权提供收尾设计签收依据，不把静态结论写成运行验证。

## Decision

**采纳最小实例归属修复。初审的共享引用阻断已被 mainUI 最新源码修正；最终源码复核 C0/I0，测试仍待唯一 merge 槽执行。最新接线与证据边界见文末最终复核，该节覆盖下文的初审时点。** 保留既有行内 turnEdit 和“每个 Lens/叶一张 Composer”的合同。把当前模块全局 DOM 引用改为该 TimelineRenderer 的实例字段，由它所属的 TimelineHost 提供实例方法转发。Chrome 进入、退出以及 queueEdit 切换只操作自己的 `host.timelineTree`。不引入全局 Map、全局编辑协调服务、sessionId 注册表，不改 queue、协议或提交语义。

本裁定使用用户指定 `/home/clarence/Projects/UniverseSoftware/skills/principled-design/SKILL.md`：事实归属和生命周期须明确，先守正确性，再取最小实现路径。多叶拥有不同输入上下文是现有合同；用全局 DOM 换少几行代码破坏了这个边界。沿已有实例链修复，代价小于另加所有权键和全局清理规则。

## Findings

### Critical：0

未发现需要扩大本次方案的 Critical。未实测数据写错或引擎行为，不能宣称这些已发生。

### Important：1，合入阻断

`src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts:52–55` 的 `pendingTurnEditComposer` 与 `provideTurnEditComposer` 是模块级共享状态。`:364–370` 的用户编辑行直接 append 该节点。真实 DOM 的 append 会搬走已有节点。

每个 `ConversationTimelineHost` 在 `conversationTimelineHost.ts:197` 各建自己的 Renderer，并独立持有 `editingTurnId`；`:420–443` 只修改本时间线编辑状态。`conversationLensComposerChrome.ts:433–434` 则把本叶 Composer 写入全局后重画本叶；`:458–459`、`:483–484` 清全局，未带所有者身份。

成立的序列：A 进入编辑 → B 进入编辑 → A 的用户编辑行重建。B 覆盖全局指针，A 便把 Composer B 搬进 A 的编辑行；A 自己的 Composer 还可能随旧行清空脱离文档。B 的输入节点及绑定 B 的事件处理器出现在 A 阅读上下文，至少造成输入错位/消失与上下文误导；后续用户操作可能作用于 B，但这只是风险推导，尚未实测。A 退出或进入 queueEdit 也会清除 B 所需的全局引用，B 之后重建可得空编辑宿主。

这不是原有模块 API 的历史行为：HEAD 的该导出是 no-op；当前 WIP 才加入共享引用与行内 append。因此应作为本 WIP 收尾阻断修复。

### Minor：1，记录粒度

现有规格和方案已经容纳行内编辑，无需新架构或新 PRD。为了避免“一张 Composer”被误读成全窗口一张，收尾记录应明确它是每个 Lens/叶的 XOR，跨叶可以各自编辑。该澄清不改变用户行为，不扩大功能范围。

## 最小实现落点

推荐固定为以下路径（实例 getter 回调也是等价方案，但本刀不需要扩构造参数）：

1. `conversationTimelineRenderer.ts`：移除模块全局与模块导出函数；把 DOM 引用放到 `ConversationTimelineRenderer` 的 private 实例字段，并提供小型实例 setter，例如 `setTurnEditComposer(composer)`。编辑行仅 append `this` 持有的节点。继续先 mount Composer，再调既有 `scheduleHeightUpdate`，避免把空编辑宿主拿去首轮测量。
2. `conversationTimelineHost.ts`：提供 `setTurnEditComposer`，仅转发给自己的 Renderer。只存一份 DOM 引用，Host 不复制第二份状态。dispose 时清本 Renderer 引用即可；不要通过该动作移除其他叶 DOM。现有 `setEditingTurnId`、行重建与 `getTurnEditHost` 保持归属和语义。
3. `conversationLensComposerChrome.ts`：删掉从 Renderer 导入模块函数，三处改为 `host.timelineTree.setTurnEditComposer(...)`。进入时先设置本叶 Composer 再 `setEditingTurnId(turnId)`；退出/queueEdit 时先清本叶引用再清编辑 turn id。保留 `syncComposerPlacement`、断开 DOM 恢复、草稿恢复和发送门闩合同。

生产所有权链已经存在：`conversationEditorPane.ts:151` 为 pane 建带 `sessionKey` 的 Lens → `conversationLensReadingColumn.ts:76` 为 Lens 建并注册 TimelineHost，`:82` 的用户行事件回调本 Lens → `conversationLens.ts:695–704` 调 Chrome → TimelineHost → 自己的 Renderer。这里不需要依赖 active session、DOM 邻居或“最后进入编辑的叶”。

生命周期核验点：`conversationLensSessionBinding.ts:227–239` 的 `applyActiveSession` 已调用本 host 的 `exitComposerEdit`；`conversationEditorPane.ts:133–145` teardown 释放本 Lens；`conversationTimelineHost.ts:588–601` dispose 释放本时间线。修复需保证这些路径只清本实例，不另造跨叶状态。

代价：三份生产文件的小型字段/方法/调用点调整，关联 fixture 按编译需要补方法，增加双叶回归。保留同一 Composer 及事件绑定，DOM 数量不增加，Renderer 构造器与既有多处测试无需新增位置参数。setter 的进入/退出顺序须由生产回归锁住，这是本选择的主要维护成本。

## 必要回归：只由唯一 merge 验证槽执行

首选在 `src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts` 的 T5 Edit XOR 周围新增真实组件回归，复用该文件 `mountLens`（约547行）和既有 `two leaves bound to different sessionKeys render their own sessions`（约2155行）的共享 stubService、不同 sessionKey 模式。不能用两个 plain host 对象加手造 editHost 替代生产 Renderer；现有 `conversationLensComposerChrome.test.ts` 仅补充放置边界。

必须覆盖：

1. 同一文档下挂 A/B 两份真实 Lens/TimelineHost，绑定不同会话。保存各自 Composer/textarea 的对象引用，给草稿和编辑内容不同标记。点击各自真实用户卡，顺序 A→B。
2. 在两叶仍编辑时，通过真实 `setTurns`/`applyEntries` 对该用户 root 产生可观察的内容修订，先重建 A，再重建 B；或用其他确实重建用户行的现有生产路径。断言编辑宿主对象已换，证明发生重建。**不要只调用 `refreshPresentation()`：`rootReadsPresentation`（Host:1362–1367）排除了 user，不能触发本风险。** 不要直接手动 append Composer 来“制造通过”。
3. 每一步均用对象恒等验证 A 行内仍是 A Composer、B 行内仍是 B Composer；各叶恰一个输入，`isConnected` 为真、正文标记正确，另一叶不包含对方节点。只有总数等于2不足以证明归属。
4. A 退出后重建 B：A 原对象回 A 的 compose 簇，B 仍为 B 行内原对象；再覆盖 A dispose/移除或合法切会话后 B 重建。分别验证清引用与生命周期不能干扰 B。
5. 保留当前单叶 T5 用户卡进入/Exit、发送同一 Composer、无0px警告、queueEdit dock XOR 与 Chrome disconnected recovery 回归。无需改 queue 本身，只确认既有行为未被这次调用点替换破坏。

真实默认编辑器补证：若收尾声明产品交互已验收，应在唯一验证槽管理的隔离默认编辑器中打开两叶，经真实点击进入 A/B 编辑，使用本地 fixture 的真实投影更新触发用户行重建，核两叶 DOM 对象身份、输入可见/可聚焦与退出/关叶后另一叶保持。可用本地 fixture，不需真引擎，也不向生产服务发写入。记录 fixture 限制与实际加载源码/输出来源；两个 Lens 的浏览器组件测试不能被称为整个默认窗口已验。若本轮只跑组件回归，明确保留 UI 未实测边界。

## 方案与文档归属

`docs/systems/conversation/composer-and-inbox.md` §2 已规定 compose/turnEdit/queueEdit 复用同一 Composer；当前 turnEdit 明确移进用户行，队列编辑留列底。`dev/plans/conversation-empty-hero.md` §3.2/T5 规定 XOR；`dev/plans/chatgpt-visual-language.md:51` 已明确行内 Composer、不留第二输入。`docs/product/vision.md` 则限定默认编辑器窗口。因此修复属于落实现有合同，不需要重做架构选择或新产品需求。

建议在现有 `chatgpt-visual-language.md` 追加一个窄的“收尾：行内 Composer 实例归属”条目：写本缺陷、上述三文件实例方案、双叶断言、代价及实际验证结果；Composer 规格只补一句“单 Composer 的范围是所在 Lens/叶，进入、重绘、退出和销毁不得搬移或清除其他叶输入”。status 按实际完成和证据记录，不提升整个方案/PRD状态。遵守 DOCUMENTATION 规则3a/13/16，本报告提供该窄修复的独立只读设计审查依据；若后续改成全局协调、改变每叶编辑策略或修改 queue，已超出本签收范围，须另审。

**收尾接受条件：** 全局可变 DOM 引用消失；生产链仅访问所属实例；双叶重建/退出/销毁回归通过；单叶既有合同保持；文档诚实区分源码、组件测试与默认窗口证据。当前只完成设计审查，未宣称以上检查已通过。


## 最终源码 peer 复核（mainUI 最小修复之后）

**最终 decision：接线接受，Critical 0 / Important 0 / Minor 2（均不阻断源码签收）；验证未执行，不等于合入验收通过。** 本节覆盖前文“当前 WIP 仍有 Important”的初审时点。mainUI 选择把设置 DOM 合并进现有 `setEditingTurnId`，比初审建议的独立 Host setter 更少调用次序负担，符合相同归属合同。

已独立读取 `/tmp/vscode-closeout-composer-owner-20261028/ownership-only.diff`、四份实际当前源码和 `before.json`；四份备份 SHA256 与清单均相符。

- Host 当前 `setEditingTurnId(turnId, composer?)` 在编辑状态判等与行重画前调用自己的 Renderer setter。`!turnId` 清引用，有新 composer 则更新，非空 turnId 且省略 composer 时保留该实例原节点。后者兼容现有同叶从 u1 切 u2 的测试，不会获得其他 Renderer 的节点。生产进入 turnEdit 总是显式传 `host.composer`，退出和 queueEdit 总是传 undefined turnId。因此可接受；不要求另加 Host setter 或构造参数。
- Renderer private `turnEditComposer` 取代模块全局；模块导出已删除。用户行仅 append `this.turnEditComposer`，顺序仍在高度更新前。Chrome 三处改走其自己的 TimelineHost，其他草稿/queue/输入放置逻辑未改。
- Host dispose 当前源码新增 `this.renderer.setTurnEditComposer(undefined)`，只清自己引用。备份对照确认这也是本轮增量。
- `conversationTimelineApplyTree.test.ts` 创建两份真实 DOM 下的 `ConversationTimelineHost`，实际创建各自 Renderer，使用相同 turnId `u1` 并传不同 node。`applyEntries` 修改 user 文本会经 Host 的 changed root、ItemHost `render(auto)`，用户行不满足 `tryIncremental`，所以真实走 `fullRender`。回归在两次 patch 后检查节点恒等与各Host数量，A退出后B patch、A dispose后B patch也检查B仍为原node。原“只重画目标/切换受影响行”两条测试保留原断言，只把全局注入改为显式参数，没有弱化。

Minor 1：证据范围应准确。新增回归是**真实双 TimelineHost / Renderer 的 DOM 行为测试**，Composer 是带 class 的占位 div，不是实际 Lens 的 textarea；足以针对模块全局串叶缺陷形成有效回归，但不等于双Lens输入/焦点或真实默认窗口已验。dispose 场景先退出A再dispose，不能写成“编辑中直接销毁A已覆盖”；没有真实会话退订或切换操作，也不能称退订已覆盖。若仅做本次窄修复，可保留这些边界，并运行既有 Lens T5/Chrome相关测试。若要声称完整生命周期/产品交互验证，须补实际对应场景。建议以后强化时在每次patch后立即断言，另加编辑中直接dispose分支；本源码修复不必为这类覆盖扩展而扩大功能。

Minor 2：提供的 `ownership-only.diff` 比本次读取的 Host 最新源码少 dispose 清字段一行，证据归档时需重生成该限定diff，避免最终差异与审查文件不一致。该行已在本次直接源码与备份差异复核，不构成未审代码。

原 Important 在**源码层**已解决。设计签收限四文件实例归属修复及现有plan窄收尾说明，不包含其他并行WIP。唯一merge槽仍需执行对应回归并记录结果；本reviewer没有构建、测试、UI或外部写入证据。
