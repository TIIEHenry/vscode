---
title: "其余设置页参考图视觉统一"
type: plan
status: accepted
phase: N/A
updated: 2026-11-02
summary: "Connection、Client 与其余 Engine 页按用户 ChatGPT 设置参考图统一视觉，保留业务、权限、保存和连接协议。"
---

# 其余设置页参考图视觉统一
状态：代码与组件验证完成，真实引擎默认窗口待验；owner agent:codex。

覆盖需求：PRD-025、PRD-026、PRD-028（用户2026-11-02要求的设置页局部视觉适配）。

## 范围与目标

用户已明确其余设置页并要求并行实施。延续[Tools方案](engine-tools-settings-usability.md)：浅灰导航、居中760px白色内容列、标题在卡片外、弱描边分组、名称/说明分层、右侧状态与控件、主题token与可见键盘焦点。不增加搜索/筛选/批量功能，不更改RPC、能力门、凭据、CAS、会话归属与保存时机。仅默认编辑器产品窗口；不修改sessions入口。

```text
浅灰导航 |       页面标题
         |       分组标题 / 既有操作
         |       ┌ 名称                    控件/状态 ┐
         |       │ 简短说明                         │
         |       └──────────────────────────────────┘
```

Connection按表单任务分组，短设置左文右控件，长地址/凭据输入保留独占行。Client Settings只做.ua-client-settings作用域内背景、边界、字体层级、控件描边与圆角适配；不改变虚拟行外高、绝对定位、transform、固定标题行、TOC delegate、表单DOM或搜索布局。保留上游搜索、编辑器虚拟化与控件语义。目录页带说明行可采用44px双行，不把所有数据换成开关；Provider enabled仍只读。Agents/Skills编辑面与MCP列表给各自预算，宽屏可分栏，窄短屏可滚动且Save可达。Token Usage键值对齐；技术长串拆为名称、摘要与元信息。Hooks不支持定义写，静态空定义栏不占一半宽。

## 分工与文件边界

- A：Connection TS/CSS与对应测试；导航32px、内容居中、量实际DOM、表单与卡片对齐。不触共享Engine样式/文档。
- B：Skills/Agents/MCP TS（含MCP Runtime Panel）与对应测试；专用新样式 `engineEditorSettings.css`，由父统一引入。修正列表和编辑器预算，保留草稿/选择/焦点/能力状态；不得直接改共享 `enginePreferencesPane.css`。
- C：其它Engine数据页TS与对应测试；专用新样式 `engineCatalogSettings.css`，由父统一引入。Providers凭据与预设分组，Models去重复ID且仅弱化信息而非可用动作，Rules/Hooks按内容宽堆叠，Memory/Plugins/Triggers/Clipboard/Context Variables分层，Overview/Token Usage键值对齐。只改变格式化呈现，不改变原始值、请求与运行状态。
- 父：共享Engine壳、窄导航280px纵向限制、Client设置样式、规范/索引/进度、审查与组合校验。保留Tools已实现内容。

## 校验与断言替换

各路先保留本次前源码副本，独占自己的源文件。共用out的转译和Electron测试由父统一安排，子agent只做静态检查或自己的定向eslint，避免输出被互相覆盖。无commit/push/stash/reset。

- Connection测试未找到22px导航行断言，不做机械替换。`detail body inline size ...480px container threshold` 与模态400/480px高度属于布局夹具，原样保留；业务断言保留。
- `engineSkillsSection.test.ts` 含 `heights.every(height => height === '24px')` 的行高用例：改为分组28/无描述32/带说明44，原工具/描述语义不改。用例名为 `Skills: description stays beside the checkbox and the editor stays closed until a skill is selected`。Agents master列表维持现有24px行高，不改其整行取模helper。`engineCatalogSections.test.ts` 的 `Agents: name-only rows stay one line tall and a wide column keeps the editor beside the list` 保留分栏480px高度；`Agents: a narrow column stacks the editor under whole profile rows` 原 `section.getDomNode().style.height === '480px'` 改为空串（自然高度），保留列表整行及编辑器顺序。
- Triggers/Clipboard/Context Variables原整行协议拼接文本断言可改为对应分区文本；原始字段、空值、零值和状态仍保留。格式化函数如被其它消费者使用，不改其契约，页面另行分层。
- 其余已存在测试不删除、不跳过；新增真实布局/键盘测试覆盖可达性、长文本、首屏状态和焦点。
- 聚焦scripts/test.sh、相关eslint；必要时compile；docs-health/wiki/check与generated status。组件渲染检查浅/深/高对比、宽/窄/短，截图不冒充真实引擎验收。

## 审查

只读reviewer提出Client虚拟行不能仅CSS改高、替换断言须逐条具名两项Important；已按实际源码核验收窄并补入上文，待最终Assessment。

规则16审查：review_settings_visual（同会话只读subagent，当前无Cursor Task工具）C0/I4，有条件通过。四项均核验写入：逐条具名断言；实际内容盒预算与滚动归属；B/C样式必须限定各自页面不影响Tools；Client虚拟化限制。Models只去重复展示，不省略不同ID；技术元数据保留0/空值/原始状态。

A视觉语义补充：Direct Address既有private/loopback复选框改为复用Toggle胶囊开关，保留checked/label/说明/请求。`connectionPreferencesPane.test.ts` 的 `direct address zone pre-fills default local engine and enables allowPrivateNetwork` 仅role期望checkbox→switch；默认host/port/name/aria-checked断言不改。

组合校验补充：`preferencesStatusStyle.test.ts` 四主题read-only/writable provider siblings的旧夹具直接将Providers挂pane，而真实生产padding已移入detail。仅补真实detail/detail-body层级及新专用CSS加载，保持原rowInsidePane/包含/碰撞/动作/焦点全部断言。Tools刷新时稳定id重画可能广播相同选择，去重同工具selection避免重复getToolInfo，不改详情请求归属。

具名视觉断言追加：`engineSkillsSection.test.ts` 的 `skill toggle action names describe the next enablement state` 两处role选择器checkbox→switch，动作ARIA名称期望不变。`preferencesStatusStyle.test.ts` 四主题read-only/writable provider siblings的旧24px高度/24倍数断言改为实际高度≥40px（新设置尺度，自然换行），其完整文本、无碰撞、逐项包含、动作尺寸、宽度来回切换稳定性与长翻译增长断言全保留。Tools仅在程序重画期间抑制selection副作用；显式再次选中仍重查状态以保留pairing-hold诚实提示。

## 实施与验证结果

A/B/C并行代码已组合。修复了窄屏导航纵向限制、Client作用域虚拟几何保护、MCP初始ready开关、程序切换Connection分区导航同步，以及Tools重画时重复详情读取（显式重选仍可重查）。完整Engine相关832过；Connection/状态样式/Client设置269过、4pending；20目标文件类型0诊断；eslint0错误17警告。47张生产组件受控数据截图无横向溢出或页面错误，包含宽窄短/深色/高对比取样。[准确范围与原日志](../progress/preferences-visual-alignment-evidence/verification.md)。未full compile、未真实引擎默认窗口验收、未提交推送；计划仍accepted，PRD不升。

## 用户截图追补：完整宿主顶部与未连接条

2026-11-02 用户指出分段切换内缩不对称，以及未连接提示贴左边、操作贴右边。原因是ActionBar actions-container继承width/height:100%再叠加padding，以及Engine清掉pane padding后banner仍为水平0。修补仅布局：UA Connection/Engine宿主明确ActionBar自然尺寸、border-box与统一分段内缩/高度，顶部返回与切换垂直居中；两类pane均沿用同一header间距。Engine banner恢复与header相同24px水平安全边距，窄屏16px、compact避免重复累加；动作换行仍在安全边界内。不改状态文案、业务按钮、权限或连接。用真实ActionBar组件及生产CSS量四边内缩、中心线、宽窄断连条动作边界；不再仅挂pane截图遗漏外层header。只读追补审查review_settings_visual C0/I0通过后实施。

追补实施完成：真实ActionBar四主题×三宽盒测量通过；EnginePreferences与状态样式50过4pending，eslint0错0警告。完整外层布局夹具取样已附证据。未真实引擎窗口验收。
