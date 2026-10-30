---
title: "Conversation lease：L5 switch-input 的 successor Lens 夹具"
type: plan
status: draft
phase: N/A
updated: 2026-10-28
summary: "仅拟修同一L5 switch-input case的old/successor观测对象；原生产与其余用例不变，规则16待审，source/tools/新包/runtime均未授权。"
---

# L5 switch-input 的 successor Lens 夹具
状态：草案。
覆盖需求：无（正文未引用需求编号）。


本稿仅为 **draft / 规则16待审**，不实施。依据为[本轮实测及恢复接收](../progress/conversation-visible-lease-new-runtime-outcome-20261028-evidence/INDEX.md)及其中署名 root receipt；主 lease 与 hidden-delete/official-budget 两方案仍 accepted。原 once 已消费且永久不重跑，sole lane 已正式归还，`currentlyAuthorizedRuntimeOwner=null`。

## 1. 问题与已核事实

唯一 new run 完整执行40 unique tests，39 pass/1 fail/0 pending，238 hook start/end精确配对。失败为同一 case `L5 switch input during real catalog pending cannot revive the captured owner`，真实帧 `conversationSessionWindowReveal.test.js:908:18`，断言 `only the current input listener may reconcile` 得到 `0 !== 1`。这是 official actual1；driver actual0只表示 `accounted-official-outcome` 完整记账和恢复，`businessNewFullQualified=false`。失败体不称 leak-clean，当前 successor lease 后续断言未执行。

root 与原 Astra 已独核真实 EditorPanes 对不同 input 的路径：`clearInput → Pane.teardownLens → Dispose old Lens → ensureLens successor`。原夹具计数留在被释放的 old Lens；switch 后 `oldLens` 已 disposed，`currentLens !== oldLens`。这构成一个夹具观测对象错误，不以本次结果证明 successor lease 已通过，也不改生产来迎合旧对象的计数。

## 2. 唯一拟改范围

仅拟修改现有 L5 的 `action='switch input'` **同一 case** 的观测、断言与匹配的test-only frame emission布置，保留 case/title/动作、真实 EditorPanes 和 EngineRoster catalog 事件链。保留切换前捕获的 `oldLens`；按真实切换结果获取 Pane 当前的 `successorLens`，分别观测两个实例的实际 bind 调用，包装继续调用原方法，不用 fake Lens、手动 acquire/dispose observer lease 或直接改生产私有状态替代真实链。

1. 切换前固定 old Lens 与计数基线；通过既有真实不同 input 切换路径执行动作。
2. 切换后明确断言 old Lens disposed、successor 为 Pane 当前实例且与 old 不同。old 和 successor 使用独立计数，不能把 successor 的调用记到 old 或反向复用闭包。
3. **ready前**，在catalog仍loading/pending时建立计数基线：明确核successor自身missing lease、visible、unsuspended、live、nonpairing，且bound/input身份一致。若任何前提不成立，应在该前提明确失败，不能跳过或按预期补数据。随后由既有`completeCatalog`发出的**同一次真实ready事件**触发reconcile，不在已ready仍missing的状态补设基线。
4. **ready后**核catalog ready与visible/unsuspended/live/nonpairing、bound/input身份等门仍成立；old 的 bind 增量必须为 **0**，successor 自身 bind 增量必须为 **1**。核successor已取得当前lease及其身份、当前input与真实frame断言，确认实际动作到达该frame；不继续要求已绑定successor仍missing，不将old的0改为1，不把successor断言删成“对象存在”。

### 2.1 Successor frame的agent attribution

root对现helper606–649、Pane118、`RevealEngineSessionView.emitLease`132–135及`passesTrajectoryAgentFilter`222–232的独核发现另一个必须在本case明确的前提：真实switched input调用`getConversationChatResource(primaryId, 'successor')`，令`filterAgentId='successor'`；现emission的user与confirmation均无agentId，过滤器会保留无agent user而隐藏无agent confirmation。不能直接盲加现`assertEngineFramePaints`并期望pending-seat通过。

本稿选择同一test文件内的最小test-only emission适配：通过既有helper/SessionView emission边界传**optional `agentId`**，默认不变；仅该L5 successor frame传`'successor'`，为user与confirmation两turn提供匹配attribution。其他所有调用原样，保持真实switched input及其filter，保留`assertEngineFramePaints`的pending-seat paint及其他实际frame断言，不移除过滤、不弱化断言、不改生产。optional参数的具体落点与时序由固定source-only候选/root核/原Astra source peer审查，本稿不预授源码修改。[准确署名输入及两次只读路径错误](../progress/conversation-visible-lease-new-runtime-outcome-20261028-evidence/root-l5-frame-input-and-additional-read-errors.json)不是runtime结果。

观测安装时序必须覆盖被断言的实际调用；若当前真实 setInput/ensureLens 的顺序使某次调用发生在安装之前，source-only 候选须明确区分初始化与本次 ready reconciliation，并给 root/原 Astra审查。不能把已发生的调用补记，也不能通过额外等待凑数。

## 3. 必须保持的合同

- `clearInput` 与 `dispose` 两分支及其 old bind 增量0原断言不变；其余12条 new、26条 original、meta、40 unique选择与238 hooks全保留，不改 title、注册、skip、hook或expected。
- 所有生产 Pane及其他 TypeScript不变；唯一同test文件的helper optional参数扩展只服务该case，默认和其他调用保持；原 fixture A 的 hidden-delete 一行及相关完整逆证、旧256 source/native pairs与原 native保持。
- 不增加等待、超时或重试，不削弱断言；official专属180、其他阶段45、原TERM5/KILL5及 qualified restoration 合同保持，不用延时掩盖观测错误。
- 本稿不授 AST、lint、compile、tests、emit、out写、UI、engine或新业务；`Mgreen=false`、`fullCompile=false`，独立非作者真实默认编辑器 after 待，I build/after/ready=false，C/F held，PRD/宽 Sources/D1387不升级。

## 4. 后续独立门禁与数据谱系

规则16由 root 与原 Astra 对固定本稿只读审查后，root才可另授 source-only 候选。候选须给完整正逆、仅该 case 的有限diff和生产/其他分支与用例保护，经 root固定核及原 Astra source peer；本文不预授其工具或测试。

未来仅能准备**唯一新的 packet**，另走工具审查、whole-package peer和独立 runtime 授权。直接恢复前态绑定本次 `guard-after-restore.json` **20161773B / SHA-256 `336c2ebee511ef8bb667e0fb8e549a7630f798d6ab4bd49b3bf31090ca148a56`**，以及新 root recovery receipt **13284B / SHA-256 `0bcdb02972350363a58d07480da5f3f28d1776d8b3148942d2638e6d9f0ad4f8`** 的完整身份；位置与metadata见证据入口。原P consumed，不新加结果、不重放。

本轮真实 latest 为 **driver0 / official1 / accounted-official-outcome / newFullQualifiedfalse**。祖先9e/6dd的 driver1/official-15按历史原文保存；不得为兼容旧接口把本轮改称1/-15，也不能静态假定现B旧 `latest=-1/-15` 硬条件可直接重用。后续工具/新包须按真实新谱系另外绑定并接受审查，当前不授工具实现、不扩大本测试修正范围。

后续验收仍需新授权下完整40/238、两target自然CDP loaded=disk=dry=WAL emit、qualified2out恢复、全部保护、真实host终态及有限quiet/两锁闭合，再由root接受；通过前不授业务green/compile/after。

## 5. 当前交付状态

- [x] 本稿及本轮事实入口已写；旧失败与准备/reader错误分列。
- [ ] root固定核与原 Astra规则16审查、父核后改稿。
- [ ] 独立 source-only 授权、候选/保护/root核与原 Astra source peer。
- [ ] 新工具/packet/whole peer/runtime逐项另授；原P永久不重跑。
