---
title: "默认编辑器阅读宽度与节奏取样（2026-10-27）"
type: reference
status: accepted
phase: M7
updated: 2026-10-27
summary: "20组隔离长文与5组混合状态取样：字号/布局保留，组内外节奏和窄摘要为设计试验候选；开关/动作边界已有证据，不冒充用户研究或真实流式验证。"
---

# 结论与适用边界

[方案](../../plans/chatgpt-visual-language.md#11-v0v1v2-运行取样2026-10-27) · [测量矩阵](20261027-reading-matrix.json) · [源码/输出](20261027-reading-source.json) · [实际加载](20261027-reading-runtime.json) · [fresh对照](20261027-reading-fresh.json) · [复现探针](20261027-reading-probe.cjs)。本轮只分析默认编辑器，未改产品代码、未编译共享输出、未启动/停止引擎，未提交。

## 来源

- 使用仓库 `launch` 技能与[壳冒烟指南](../../../docs/guides/shell-smoke-verification.md)；空 seed、独立 user-data/extensions/shared-data、`--new-window --enable-smoke-test-driver --skip-prelaunch`，没有 `--agents`。自建 Xvfb `:0`，窗口/显示进程在本地 launch/display JSON 登记。不会接管旧进程1444798/37053与其P7TRNm临时profile。
- 初次空profile探针观察到自动连接既有Loopback；未触发发送、任务或写RPC，随后关闭自己的窗口。原因是主服务默认自动发现。最终通过既有 `UNIVERSE_AGENT_HOME`（`localEngineDiscovery.ts`）指向独立空目录，真实窗口显示 `Engine not connected`；仅使用本地 `untitled` / `visualize` fixture，无引擎读写。空profile本身不等于无引擎，后续同类探针必须带此env。
- HEAD/dirty工作区与摘要记录在 source JSON；本轮未持编译锁，`lsof` 核实两把编译锁无持有者后也没有改写输出。四份关键TS用内存esbuild变换可复现当前out代码（只排除inline source-map，保留static-block选项；不冒称全量编译/typecheck通过）；CDP七份已加载JS（含四份关键Conversation文件与布局模块）与对应out摘要相同。inline sourcemap无sourcesContent，单凭时间不能证明来源，故另做上述内存对照。
- Lens CSS源/out字节相同。CDP样式文本中Unicode按浏览器Windows-1252解码呈现，恢复字节后与out精确相同；原始文本摘要不同，不隐去差异或称原始文本相同。未注入/覆盖CSS。
- 实际主题根类分别为产品Light/Dark。完整include链：产品Light→2026-light→light_modern→light_plus→light_vs；产品Dark→2026-dark→dark_modern→dark_plus→dark_vs，各文件摘要在source JSON。主题经真实主题服务加载，非仅拼初始palette。
- 缩放 `window.zoomLevel:0`，DPR=1、visualViewport.scale=1。通过自建显示内的原生窗口尺寸调整到1440/1024×1000，并核对innerWidth与各Part尺寸；弃用首轮仅emulation的中间矩阵。全部最终时间线scrollTop=0；截图停在顶部，内容超过屏高时不声称下方均在首屏。
- `.build/visual-review-20261027/` 是前轮既有图片/测量，缺少这次完整来源绑定；本轮不复用为after或当前验收。最终20组图片与完整测量在本地 `.build/visual-v0-v2-20261027/`，不进git。矩阵与小型来源记录随本checkpoint保留。

## 20组结果

每组均为同一中英长回答，真实生产renderer/frame callback；含H1/H2/H3、列表/嵌套项、路径、引用、代码块与表格。数据是fixture，不代表引擎回复质量。没有手动设Conversation为752或拖sash；独立fresh 1200×800对照测到默认Part752、右列400。后续1440/1024往返保留该分配，因此以下不是两种窗口的独立初次默认比例。

| 配置（浅深结果相同） | Part / 单叶 / 阅读容器 / 助手正文 px | 结论 |
| --- | --- | --- |
| 1440或1024，单组，Preview空 / 未命名编辑器 | 752 / 752 / 720 / 696 | Preview有无内容没有改变Conversation宽度 |
| 1440或1024，双组，Preview空或仅隐藏Preview | 752 / 376 / 366 / 342（每叶） | Sources仍占同一右列，只关Preview只释放竖向高度，未增加阅读宽度 |
| 1440，双组，Preview与Sources均隐藏 | 1392 / 696 / 686 / 662（每叶） | 现有布局开关可释放横向预算 |
| 1024，双组，Preview与Sources均隐藏 | 976 / 488 / 478 / 454（每叶） | 不需要放大字体即可扩大阅读列，代价是暂不并置成品/材料 |

外层Part最低450并不保证每个分组叶450；本次双组叶376是正常可见配置。窄列中代码横滚、表格换行属于保留信息的适配手段，未发现它们突破容器，不能单凭横滚给bug标签。没有覆盖全部用户布局、字体缩放、高对比或小于300叶宽。

## 阅读节奏判断

实际计算值：H1 18px/24.3px；H2/H3均13px/17.55px、600；正文13px/19.5px；H2/H3段前10.4px、段后4.55px。浅深单组图可区分标题/正文/列表/代码头与表格，未出现支持整体增大字号的反例。H2/H3同字号符合已选token，本轮不再把此静态事实单独列作“层次失败”。

双组同样内容更长、正文换行更多，这是并行阅读和并置Preview/Sources的空间代价。优先评估现有开关的发现性与布局使用场景；没有证据支持自动折叠空Preview、改默认比例或强制叶最小450。旧短Stub截图的块间大留白不推广为长回答通病。本fixture没有思考/工具/权限卡的混合过程，也没有用户定位效率测量，不能据此签收状态归组或块间节奏优化。

关键截图：本地 `light-1440-single-empty-preview.png`、`dark-1024-double-empty-preview.png`、`light-1440-double-right-hidden.png`、`fresh-control.png`；均在 `.build/visual-v0-v2-20261027/`。父agent与作者已实际查看前两张；暂无经本轮证实、需要立即实施的产品视觉缺陷。

## 复现与清理

1. 在已有输出工位建空seed与独立engine-home，按launch技能启动自己的虚拟显示与隔离窗口，传上述env/flags；保存launch.json。不要复用本记录PID、端口或X窗口号。
2. 设置 `READING_EVIDENCE_DIR` 为该本地目录，更新探针中自有DISPLAY/X窗口号；运行 `rtk node dev/progress/ui-visual-review-2026-10-26-evidence/20261027-reading-probe.cjs`。探针只替内存fixture，执行真实主题/会话分组/Preview/Sources/未命名编辑器命令，不发消息或引擎RPC。生成matrix.json与截图。
3. 重查源码/输出和实际加载摘要；不能复制旧source JSON作为新来源。源码复现只比较四关键文件，不代替共享输出完整性或所有壳模块验证。
4. 只关闭本次launch PID及本次Xvfb，核对进程身份和旧PID存活；[清理记录](20261027-reading-source.json) 已保留；仅终止匹配本次临时profile的主进程与自建Xvfb，旧PID1444798仍存活。第三方日常profile与既有引擎保持原状。

## 审查与检查

续轮独立只读review为 Critical 0 / Important 0 / Minor 1；Minor已清理source JSON探索性比较字段并补最终static-block选项说明，四项最终匹配均为true。reviewer实际查看浅色单组与深色双组图片、核对20组宽度/scrollTop/断连状态。docs-health 0 errors / 37既有warnings，目标diff-check通过。本证据不提升PRD、不标产品实施完成。


## 混合状态与操作边界补样（V3–V5）

[五组混合测量](20261027-reading-mixed.json) · [补样探针](20261027-reading-mixed-probe.cjs)。本地截图与launch在 `.build/visual-v3-v5-20261027/`，没有重跑前20组。沿用空seed、独立 `UNIVERSE_AGENT_HOME`、Xvfb与来源绑定；所有场景均实际显示断连、DPR1/scale1。新增五份关键源码在内存变换后与out代码一致，五份CDP已加载JS与out摘要相同；CSS源/out摘要与前轮一致。完整范围与启动记录见source JSON的 `mixedCheckpoint`。

场景为浅色待确认正常/窄叶、失败+取消正常/窄叶，以及深色待确认窄叶。正常叶752px；双叶场景主叶375.5px（窗口1440/1024×1000，细分隔/取整差异不写成绝对376）。fixture包含两条用户、两条助手、思考、明确completed read、running或failed validate、pending或cancelled write，以及仅pending场景才有的confirmation。旧回答不是最新回合，供操作行复验。数据仅存内存，不执行工具、权限答复、模型或消息写入。

| 对象 | 常态职责 / 实际观察 | 判断 |
| --- | --- | --- |
| 过程折 | 收起后仍显示 `1 waiting`，或 `1 failed` / `1 cancelled`；窄叶摘要文本可截断，但计数保留，ARIA包含完整步骤与结果。展开明确完成有check、失败有error、取消有circle-slash | 状态结果可辨，保留折叠摘要和可展开线索 |
| 助手正文 | fixture说明检查结果与下一步；该文案由取样者给定，不能据此证明产品自动生成重复解释 | 评估呈现归组，不拿fixture文字重复作产品bug |
| 权限座位 | 给出写入对象、待确认总数、Input needed与Allow/Skip；collapsed窄叶中两个72×26px按钮均完整在时间线viewport内 | 保留对象和主/次动作；本轮未点击Allow/Skip，不重复测试前轮权限结算功能 |
| Inbox | 保留会话待确认计数与定位入口；点击只做定位，焦点留在入口，座位仍可见；本fixture座位已在视口内，scrollTop保持0 | 证实可点与目标可见，未覆盖“目标离屏时滚动定位”的完整反例，不扩大为导航全通过 |
| 旧动作行 | 常态opacity0、最新动作opacity1；旧回合hover后opacity1，94×24px，底边到下一timeline item顶边留20px，五场景均无相交。聚焦第一个旧动作再Tab到Regenerate，操作行保持可见；四动作ARIA完整 | 本样本没有遮挡或键盘不可达反例，保留既定显隐合同 |
| 布局开关 | 1024窗口标题栏Conversation/Preview/Sources各22×22px、常显；实际ARIA与hover分别包含Ctrl+Shift+Alt+C/P/S。`layoutActions.ts`注册f1命令，`titlebarPart.ts`从keybinding服务取提示并将三项排除overflow | 入口/命名/键盘路径存在；没有真实用户任务结果，不称已容易发现，也不先断言藏太深 |

**真实进行中边界**：离线fixture的 `running` / `pending` 不画实时spinner或Cancel，这是生产 `showLiveChrome` 约束，`conversationProcessFold.ts:1042–1071`已静态追踪。本轮没有伪造连接来补live chrome，因此真实流式强制展开、Cancel、运行中权限交叠只记未运行验证；不要把离线样本的无spinner写成视觉回归。

**深色边界**：已有20组产品深色长文加本次窄叶混合样本，真实主题根类与完整include链已绑定。当前Conversation计算背景为rgb(25,26,27)，用户卡同底加8%描边、权限卡低对比表面；截图可区分正文、过程、权限动作及输入。没有量化所有合成对比度或覆盖HC，不能签收全部深色可访问性。外部ChatGPT深色S0/S5仍未取得，不妨碍本次产品分析交付。

### 视觉试验方向（本轮不实施）

1. **同一回合内的归组节奏优先**。当前expanded样本最后一条工具底边到回答正文起点为50px；待确认样本回答正文末端到权限卡约72px，其中包含最新动作行。跨回合旧回答末端到下一用户卡约74px。这些是盒间距离，不是应直接改成的CSS值；相近停顿可能弱化“同一轮过程→结论→权限”的归属，属于审美候选。建议未来只做一组可回滚A/B：A保留现状，B只在同回合内使用现有间距token收紧过程/回答/权限的间隔，保留回合之间间距、24px动作命中区、状态与边界。用完全相同fixture比较正常/窄叶、展开/收起、浅深色；不能压到旧动作覆盖下一项，键盘焦点与待确认必须可见。若归组没有更清楚或显得拥挤，撤回B。
2. **窄叶过程摘要的信息排序**。现有实现已经保证关键计数和完整ARIA，本轮不列截断为缺陷。可另做短摘要文案试验：保留步骤数和失败/取消/待确认计数，把低频动词对象串放入既有展开详情或完整提示。以是否能先辨结果、是否仍能找到具体工具为检查项；不得丢完整可访问名称、不增加新面板、不扩行高。本实验涉及摘要呈现合同，实施前须走PRD/规格顺序，不能直接在CSS隐藏信息。

两项均是可讨论的设计试验，不是已签收的实现变更；不以“没有功能缺陷”否定审美优化，也不把喜欢某个版本说成效率提升。布局开关先保留，后续真实任务反馈才能回答用户能否发现以及何时需要布局预设。

### 最终分析审查与收尾

V3–V5补样及方案§12最终只读审查 Critical 0 / Important 0 / Minor 0；reviewer实际查看浅深混合窄叶截图并核五组JSON/20px旧动作间隔/50px与72px归组距离。补样自有Electron与Xvfb均已退出，剩余自有Electron为0，旧PID1444798仍存活，既有引擎未动；完整记录在source JSON的 `mixedCheckpoint.cleanup`。最终docs-health 0 errors / 37既有warnings，主题diff-check通过。只暂存本主题证据文件，未提交；分析交付完成，未来设计试验/真实流式/用户研究/外部登录取样各自另验，不把它们作为本次分析未完成项。


## C1/C2 单候选A/B原型（2026-10-27续轮）

[原型测量](20261027-reading-ab.json) · [原型探针](20261027-reading-ab-probe.cjs)。仅一个C1-B和一个C2-B；A为当前生产样式，C1-B仅改临时间距，C2-B仅改临时可见摘要/提示，分别与A比较，没有把两项合并来掩盖代价。浅/深×正常752px叶/窄375.5px叶×展开/收起共8个相同pending场景，各A/C1-B/C2-B截图；加一组窄深色失败+取消的A/C2-B反例，共26个截图/记录。没有再做布局矩阵、引擎操作或产品实现。

### 原型身份与来源

重新读取当前AGENTS、进度、UI规范和方案；Lens/Timeline CSS源与out逐字节一致且与前轮摘要一致。source JSON的 `abCheckpoint` 记录当前HEAD、dirty diff、两CSS实际加载恢复字节、五份关键源码的内存转译匹配、五份已加载JS/out摘要和完整主题include链。空seed/独立engine-home、DPR1/scale1、原生窗口1440/1024×1000；每次截图时间线置顶。只启动自己的虚拟显示和临时profile，无引擎连接，无共享输出刷新。

C1归属是**fixture侧显式关系表**：`fixture-round-2`包括mix-think/read/check/write/a2/confirm，实际标记的边是fold:mix-think和mix-a2；先核对ID存在与fixture侧round映射，再加原型专用data属性。不是CSS相邻选择器，也不是按最后一个user去猜归属。输入的turnId未由该fixture投影保留，故不能声称生产有同回合ID可直接使用；关系表只为控制本次视觉试验。当前生产 `ConversationTimelineItem` / `ConversationTimelineHostRoot` 未公开跨过程/回答/权限三者的统一round合同，未来实施必须先核准身份来源。

### 两个候选的具体定义与结果

| 项 | A | 唯一候选B | 实测与结论 |
| --- | --- | --- | --- |
| C1同回合外间距 | 所有普通article margin-bottom 32px，user为24px | 仅fixture映射中“过程末端→本轮回答”和“本轮回答→本轮权限”两条边，margin-bottom用现有 `spacing.size120`（12px）；其余article、内部行距、文字、动作、状态完全沿用A | 展开工具末端→回答50→30px；回答正文末端→权限72→52px（含原有动作行），跨回合旧回答→新user卡始终74px。浅深、正常窄、展收的正文/按钮盒尺寸保持。作者与父agent实际查看A/B，B让本轮结果与权限更紧密、阅读停顿仍清楚；推荐作为后续实现方案的视觉目标，尚非生产完成 |
| C2结果优先摘要 | `Stub · 4 steps · …动词对象串`，结果计数独立显示 | 可见步骤串只写 `Stub · 4 steps`；waiting/failed/cancelled计数原样；header完整ARIA不变，将完整名称放title；展开工具对象原样 | B消除摘要截断，但所有样本header高度23.39→46.78px，结果计数换到第二行；失败+取消反例相同。违反“不抬行高”，且折叠时不再直接看到对象；否决这个B。当前A已有结果计数与完整ARIA，不为文案简洁追加布局补丁或第二变体 |

C1牺牲的是组内呼吸空间，保留了30px/52px实际内容距离与原有22×22px动作按钮命中区；不是把实际内容距离直接设12px。原型组内token为12px，其他容器自身padding/动作行仍在。C1没有更改两条user卡位置及前一助手→下一user的74px节奏；比较的是归组效果，不宣称用户速度提高。

原型检查记录显示动作按钮22×22px、旧动作行容器94×24px（含顶部2px），底边与下一item顶边仍留20px且不相交；键盘Tab到Regenerate；权限按钮仍72×26px。C2在展开详情中read README.md、validate README links、write README.md对象仍在，不能据此抹去折叠对象损失。collapsed子工具可能仍有layout盒但不显示，矩阵的toolToAnswer对此记null，不将负距离当碰撞。

### 可直接查看的对照图

图片仅留本地 `.build/visual-ab-20261027/`，不提交。每个路径均在同一主题/宽度/状态/滚动位置取样：

- C1浅色正常展开：`light-normal-expanded-A.png` ↔ `light-normal-expanded-C1-B.png`。
- C1深色窄叶收起：`dark-narrow-collapsed-A.png` ↔ `dark-narrow-collapsed-C1-B.png`。
- C2否决反例：`dark-narrow-collapsed-A.png` ↔ `dark-narrow-collapsed-C2-B.png`。

原型style/data属性与摘要文字已在探针结束恢复A，source JSON记录temporaryStyleAbsent/groupMarksAbsent/summaryPrototypeAbsent均true。自有Electron3901140与Xvfb3901013已核身份后关闭，剩余自有Electron0、Xvfb无活命令；旧PID1444798仍存活，既有引擎未动，记录见source JSON的 `abCheckpoint.cleanup`。最终规则16只读review为Critical 0 / Important 0 / Minor 1，Minor已据矩阵把22×22px动作按钮与94×24px旧动作行容器区分；reviewer实际看三张对照/反例图并核26项数值。docs-health 0 errors / 37既有warnings，主题diff-check通过。原型交付完成，未改生产代码或共享输出、未提交。
