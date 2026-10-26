---
title: "D1385 默认产品范围最终裁定"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "Astra最终只读纠正：默认CopilotChat宿主不可达；保留安全兼容修复，原UI验收未满足并停止，accepted/open。"
---

原报告按字节正文保存；其 `/tmp` / `.build` 引用是原运行位置，不是新的执行步骤。本目录保存的最终裁定、UI 核验及关键机器记录互相参见：

- [范围裁定](d1385-default-window-scope-decision.md) / [独立核验](d1385-default-window-ui-boundary.md)
- [初探](d1385-ui-probe.json) / [完整 gate](d1385-ui-final-gates.json) / [openView 精确更正](d1385-ui-open-view-correction.json) / [清理复核](d1385-ui-cleanup-verification.json)

原报告正文 SHA256：`8ce8414ce57978e387fcc48903587b0c51be3325044dca3420ddf24e145c498b`。以下为原文；原 UI 验收未满足，不计为产品 after 通过。

---

# D1385 默认窗口可达性纠正与范围裁定

2026-10-26；只读。遵循已读 principled-design、AGENTS、产品愿景、PRD-015/016及已落M5壳合同。本轮重新读取当前源码、D真实probe/fixture记录与集成验证记录；未改源码、仓库文档或out，未编译、启动窗口、登录、使用设备/网络。

## 明确推荐

**纠正我此前“默认编辑器保留的 Copilot Chat 可达入口”判断。当前支持的默认窗口产品路径不产生 ChatViewPane/ChatEditor 的 ChatWidget，D1385要求的真实默认pane/editor UI验收不能成立。停止为该验收寻找或人为制造宿主，不新增合法路径。**

保留已经合入并有针对性真实控制器回归证据的冷授权/取消安全修复，准确归类为保留的共享/上游兼容实现维护。保留测试与原红绿证据，但不宣称默认产品语音能力、默认pane/editor UI验收完成或PRD implemented。D1385本轮仍open、方案仍accepted且明确注明“原产品可达性前提失效，非等待账户/设备；停止当前产品UI验收”，不要偷偷closed或改implemented。

后续动作是文档事实纠正与任务范围收束，之后回到Sources等已证真实产品问题；不是继续做语音接入。新加默认Chat路径会违反已落M5/INV-NO-COPILOT和本轮用户边界，不属于补验收。

## 先前判断为何错误

最初检查到了 `agentsVoice.startVoiceInChat` 注册、按钮/keybinding自身没有Sessions-only限制、ChatViewPane中存在语音bridge，便认定默认工作台可达。这省略了宿主注册/打开/恢复链，**命令注册和handler可被测试调用，不等于默认产品UI可达**。

这不是后续代码改了路由：已用 `git show 5cc987d8ea50` 核对，最初checkpoint的ChatWidgetService已经有相同default拒绝门闩，已implemented M5也已写明默认产品不使用ChatWidget/ChatEditor。因此这是本次审计前提遗漏，应明确修正，不能归因于D环境或测试profile。

先前对连接准入、owner生命周期与discard顺序的局部控制流判断仍有独立红绿证据；错误可达性不推翻这些局部缺陷，也不赋予它们产品交付含义。

## 当前事实与公开入口链

本次merge HEAD观察为 `d4725424a23`，代码来自 `f75bf218941`（之后主要文档checkpoint）。以下均在merge source核对。

| 路径 | 当前实现 | 判定 |
| --- | --- | --- |
| 正常Chat pane | `chatParticipant.contribution.ts:51–66` 的descriptor.when必须 `IsSessionsWindowContext` | default无可见/可打开pane；不是登录缺失 |
| 全局New Chat Editor | `chatActions.ts:649–655` 的 `openNewChatEditorSession` 在default直接 `focusConversationPart` 后return | 不产生ChatEditor |
| 历史 Move Chat into Editor Area | `chatMoveActions.ts:36–55`，ID `workbench.action.chat.openInEditor`，f1=false；default转Conversation并return | 不是隐蔽兼容编辑器入口 |
| 既有会话 Open as Editor | `agentSessionsActions.ts:946`起，menu/keybinding有Sessions门闩，`runWithSessions`仍default转Conversation | 有历史session也不能打开默认ChatEditor |
| 会话正常opener | `agentSessionsOpener.ts:188–193` 的 `openSessionDefault`，default转Conversation后undefined | 不因已有session绕过 |
| Widget服务 | `chatWidgetService.ts:27–28` 的 `canOpenChatViewOrEditor`只返回isSessionsWindow；`revealWidget:90`和`openSession:127`均先拒绝default | 即使从服务调用打开，也不能变出合法宿主 |
| 会话URI/EditorResolver | `chat.shared.contribution.ts:2669–2720`，所有content-provider scheme仅在Sessions注册ChatEditor resolver | 普通URI打开、扩展session URI不能作为本产品入口 |
| 工作区/历史编辑器恢复 | 实际注册的是 `ChatEditorInputWorkbenchSerializer`（shared contribution:3134）；`chatEditorInput.ts:524–552`在default canSerialize=false、deserialize=undefined | 旧序列化Chat标签不支持default恢复；不能直接调未注册的delegate绕过 |

M5已implemented合同 `dev/plans/m5-ui-shell-hardening.md:19,37`明确：默认Code产品路径不再打开ChatEditorInput/QuickChat/Copilot AgentHost编辑器；ChatWidget/ChatEditor源码保留给Agents Window、donor、测试和兼容面，默认产品路径不使用。M3也明确做过命令/还原/resolver藏或转。PRD-016的叶内chat tab是Conversation自身宿主，不是这些ChatEditor。

低层 `IEditorService.openEditor(直接createInstance的ChatEditorInput)` 仍能渲染，不构成公开产品动作。API是否public不等于该调用链是受支持用户路径。保留EditorPane类/直接serializer delegate/手工instantiation说明组件可构造；不能用来抵消上表的有意门闩。没有证据支持另造session、重写storage或给默认profile注入typed input作为验收前置。

## D运行证据及边界

已读取：

- `D/.build/d1385-independent-ui/probe.json`：页面为merge/out的默认workbench-dev，widgets为空，页面产品正文为Conversation，无Chat pane；命令列表有 `agentsVoice.startVoiceInChat`，正好证明“注册≠有宿主”。D最初口头概述为openView返回undefined，后续 `open-view-correction.json` 精确记录为null；本裁定采用修正值。
- probe加载action摘要 `8668ea87d321488bbdec3e4b193ad6984d914a3b9b9bd139e4ebf213c13633bc`，controller `691dfab95e8346717b3a06eb810c2a5640f02e0a388f493a04138c3766902645`，对应此次取消补修输出；因此不能解释成只是在看旧action。
- `component.json`明确是后续组件fixture：直接创建真实ChatEditorInput→IEditorService，以及手工实例化/渲染ChatViewPane，scope中人为给chat/entitled为true；得到两个真实ChatWidget与Voice Mode按钮。这证明组件可以渲染，**不证明默认pane/editor可达，也不是实际账户资格**。D已明确区分，且尚未进行voice动作。

补充已读 `final-gates.json` / `open-view-correction.json`：isSessionsWindow=false，openView精确null，D记录revealWidget/openExistingSession为undefined，serializer canSerialize=false、deserialize=undefined；voice events为空。fixture已dispose/关闭，仅剩editor缓存的invisible ChatWidget并明确excluded。真实Conversation Message textarea上Ctrl+Shift+Space前后voice派发均为0。这是产品入口负证据，不是语音交互成功。

此前父可能允许过这种明确标界的组件fixture，它作为附加组件证据可以保存；本轮明确不允许它替代原默认产品UI目标。建议停止追加fixture动作、保存已有构造与eligibility修改清单，并按原规范清理本次临时窗口/profile，不改仓库和门闩。D应交“默认宿主不可达的事实复核”，不能交“原默认UI after通过”。

## Strengths

- D没有为得到窗口把isSessionsWindow改true、没有启动Sessions/登录，也报告了openView与widgets的真实负结果。
- C/merge安全补修已有独立可复查证据：`d1385-cancel-verification.md`记录旧69ac action +新真实controller测试的abort0/release1/ptt_end1业务红；仅新action后abort1/release0/ptt_end0，完整183 passing、目标TS/lint通过。它们是命令/真实控制器+fake I/O的边界验证，值得保留。
- M5的公共路由、service、resolver与restore门闩一致，当前负结果符合产品设计，而非应当修掉的故障。

## Critical

没有新增已证实Critical。没有真实语音发送/泄漏或账户访问证据。

## Important

1. **纠正文档中的错误可达性陈述。** PRD-015验收7本波新增“默认编辑器保留的Copilot Chat Voice Mode是独立兼容入口”、composer-and-inbox §5同义句、D1385方案summary/范围及进度账都由错误前提扩出来，应改为：本产品Conversation仍无voice能力；保留的Chat/voice共享实现有局部安全维护，但默认产品Chat宿主按M5关闭。不能把这句话当作本波新签收一个Copilot入口，因为没有对应产品设计变更，且与M5/愿景冲突。
2. **原UI验收未完成，且不能用fixture改写为完成。** 保留原验收要求及无法满足的原因，D1385不closed、方案不implemented、PRD不升级；不要把183 passing换算成真实默认toolbar/快捷键路由证明。
3. **停止范围漂移。** 不去启用pane、恢复resolver、改serializer、给Conversation接假/真麦克风、改enabled默认值、加匿名/测试entitlement生产逻辑、开Sessions或要求人类账户。此类操作是新产品能力/违背产品边界，不是为已写代码补证。

## Minor

组件fixture证据可保留为诊断附件，其title/summary必须写清“直接构造宿主，非默认产品路径”；原探测与fixture截图不能混成一条产品步骤。无须为了这些附件再跑全套组件UI。

## 计划与账务处置

推荐父在本轮做一笔纯文档纠正，按仓库规则落SSOT，不只留/tmp：

1. PRD-015删改本波错误“默认保留可达入口”表述，仍保留“不画无capability麦克风”的原产品合同。系统文档从Conversation能力描述中撤回该入口，链接到共享兼容维护方案/证据即可。
2. D1385方案保留已经实施/验证的代码事实、原验收线与本次前提纠正，不伪称原目标达成。当前frontmatter继续accepted，summary显式“组件修复已验证；默认产品宿主前提失效；产品UI验收停止”，D1385仍open。此处accepted表示历史设计状态，不是默认入口获产品签收；正文必须写清。实质改写按规则16只读审查，先文档纠正，不派新语音实现。
3. status/deferred-gap把“等待D证明实际保留入口”改成“已核默认公开入口按M5关闭，原UI前提失效；共享实现修复保留，移出当前产品执行队列”。不是缺账号/设备、不是请人类解决，也不继续重复探测。
4. 如果以后需要正式终结这个误归类产品任务，应另做明确范围处置/追踪决定，记录原目标为何撤回、保留哪些兼容维护与测试，不能通过本次quietly closed或改implemented冒充交付。当前不新增这个未来动作的实现/自动化任务，也不把它作为Sources扫描阻碍。

保留代码的代价是共享兼容层继续带有小状态机及回归维护成本；已有针对性证据支持其修正真实局部语义，直接删除会丢掉安全防护且引入未验证回退。保留不代表默认产品需要或已经交付语音。停止新增入口的收益是守住Conversation产品边界和把时间用于真实产品缺陷；代价是本波D1385原产品UI目标不能完成，必须明记而非藏掉。

## Assessment / 未验

**最终判定：默认产品可达前提不成立；局部安全兼容修复保留；原默认UI验收未满足；停止追加语音宿主工作，返回Sources真实问题。**

没有可交给D执行的合法默认pane/editor创建步骤。登录或换账户不会改变硬窗口门闩。未完整遍历任意第三方扩展自建UI或任意诊断代码注入，那些不是本产品受支持路径；不得用这一理论可能性无限延长验收。

本轮没有运行183套件、任何UI动作、编译/typecheck/out刷新、真实麦克风/WebSocket、账户或系统权限。运行结果均引自现有集成记录或D报告，未冒称复跑。仅写本/tmp裁定；父/C/D已收到核心纠正。
