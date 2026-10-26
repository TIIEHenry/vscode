---
title: "Conversation 响应失败后恢复准确座位"
type: plan
status: accepted
phase: M7
updated: 2026-10-27
summary: "三类 unary 准确恢复方案 accepted；初版900f源码独立审查C0/I3，E按原合同补修闭态身份、通知前写门与baseline行语义，复审/新green/after待。"
---

# Conversation 响应失败后恢复准确座位

## 1. 事实、需求与范围

E 从 clean `8e1db6684bf` 实核无独有提交后，仅 ff 到 `09f6da72d30`。该提交源码树 `932031c34525449d4010265f914f7074abad2c05` 已由唯一 merge 车道真实 `compile-client` exit0；Electron325过/3精确旧红及Node10过见[编译合同证据](../progress/default-editor-contract-audit-2026-10-26-evidence/compile-baseline-verification.md)。这些不是本模块运行结果。

产品仅默认编辑器。已有 [PRD-004 验收5](../../docs/product/requirements.md#prd-004-权限座位) 明确送达失败时座位恢复可操作并说明原因；本稿实现该既有要求，不新增 RPC、协议字段或产品能力。client-tool 的既有 in-flight/失败语义见 D1359，accepted cleanup 的身份/显式成功边界见 D1356/D1357（[延期账](../progress/deferred-gaps.md)）；不把这些文档枚举当本次整链已完成，也不重复建同义 D 项。

源码实核的触发链：

- `conversationQuestionSeat.ts:130–202` 把 selections/customText 放在本次构造局部，发送前置 submitted 并禁用；重绘无法恢复用户已选答案。
- `conversationTimelineRenderer.ts:248–264、609–661` 记录 permission/question/client-tool in-flight，只有 respondFailure、终态或消息变化解除。当前 noteFreshDecision/noteClientToolResponse 在已有 failure 时不建立新 hold，重试遇重绘还会提前恢复可操作。
- `conversationEngineRosterService.ts:1246、1288、1326` 三种 unary 在 accepted 时本地 cleanup；`1030–1043` 的失败只广播 session/action/error。通用通知不带准确 request，也不进入 `respondFailures`。
- `conversationEngineFrameSource.ts:179–205、565–586` 的本地 cleanup 通道先比较 timeline/pendingActions，再更新 sidecar。`pendingRespondFailed` 本就是 snapshot no-op，直接把它送进当前方法会被提前返回吞掉。
- 既有 `conversationEngineRosterService.test.ts` 的拒绝用例只验证 pending 保留；没有把真实 renderer 的点击、忙碌和失败后重试连到实际 roster。

因此 `{ok:false}` 或 reject 且引擎没有额外发 respondFailure 时，请求仍 pending，界面却已禁用。方案已 accepted，以下是待实现/待验证合同。

## 2. 不变边界与决策

| 选择 | 依据及代价 |
| --- | --- |
| roster 准确响应路径调用已捕获 binding 的局部结果入口 | 已知 action/request/kind；不依赖泛化失败广播编排，不新增全局服务。完成回调不再凭 sessionId 查找 binding。 |
| canonical identity、binding scope、request incarnation、attempt 四层所有权 | kind 只留在票据里仍会被裸 id 投影抹掉；正式局部 sidecar 必须把身份一直带到实际行。 |
| shared binding 原子占用唯一在途 attempt | 单 renderer hold 不能阻止双叶或同步通知重入；先登记、再通知、最后才调用 unary。 |
| 复用 roster `connectionGeneration` / published identity 与现有帧 generation | 旧连接和同帧 remove→re-add 均可失效；不另造协议连接代次，不靠最终 snapshot 相等判生命周期。 |
| 正式局部 response projection 承载 busy/failure/incarnation | 复用 `ConversationRespondFailure` / `pendingRespondFailed` 的错误语义；不向裸 id 发布本地结果，不修改权威 snapshot、cursor、frameId 或 host ack。 |
| 问题草稿按正式 incarnation 与问题结构留在 renderer | 仅内存，不写 settings/storage/引擎。失败与行回收保留；同 id 新请求即使最终结构相同也清空。 |

三类响应一次只走已有 unary，不补 Chat-arm/post。accepted 的 permission/question/client-tool cleanup helper及 client-tool 显式 `ok:true` 规则保留；malformed 结果仍按各自现行 accepted 合同处理，不借本稿泛化整个 queue wrapper。断连、pairing、unknown session、缺 hook 的既有写门保持；普通非响应 action 不接新局部投影。D1356/D1357/D1359 的范围与状态不变，不重复建 gap。

## 3. 正式身份与局部接口

以下为实施所需的正式类型/方法合同，名称可以按仓库风格调整，身份和顺序不可省略。共享类型放现有 conversation common 合同；resolver 可放同模块的纯 helper，不新增服务或 RPC。

```ts
type ResponseKind = 'permission' | 'question' | 'clientTool';
interface ResponseIdentity {
  readonly kind: ResponseKind;
  readonly requestId: string; // canonical、非空且无首尾空白
  readonly agentId?: string; // 已承认值；缺失不是任意 agent 的通配符
}
interface ResponseSeatState {
  readonly identity: ResponseIdentity;
  readonly incarnation: number;
  readonly revision: number;
  readonly rowIds: readonly string[];
  readonly pendingAliases: readonly string[]; // 完整 changedIds，如 pending:<requestId>
  readonly inFlight: boolean;
  readonly failure?: ConversationRespondFailure;
}
interface ResponseProjection {
  readonly scope: object; // 仅本机 opaque token；binding/连接代次/帧 generation 变即换
  readonly revision: number;
  readonly byRequest: ReadonlyMap<string, ResponseSeatState>;
  readonly byRow: ReadonlyMap<string, string>; // 真实投影行 id → canonical key
}
// key = JSON.stringify([kind, requestId, agentId ?? null])，不拼分隔符、不写裸 id。
// ticket 封装捕获的 binding 实例、scope、canonical key、incarnation、attempt。
beginResponse(...): { kind: 'started'; ticket: ResponseTicket }
  | { kind: 'inFlight' } | { kind: 'blocked' } | { kind: 'untracked' };
completeResponse(ticket, outcome): void;
```

`IConversationSessionViewLease.responseProjection` 暴露只读局部投影，engine lease 正式提供；`ConversationEntryProjectionOptions.responseProjection` 接收它。`ConversationTimelineEntry` / `entriesToLegacyTurns` 把本行的 canonical identity、scope、incarnation、revision、busy/failure 带给真实 renderer；Lens → TimelineHost options 同时提供当前 lease 投影 getter，供空列表、行回收与 scope 替换清理。不得只传 sessionId/lease 对象引用，或在测试里直改 renderer 私有表。

### 3.1 canonical 请求到实际座位的唯一映射（I1）

FrameSource、projection 和局部 cleanup 共用同一 resolver。先在当前未过滤 snapshot 与 attribution 上确定 canonical 请求及所有实际行，再做 agent filter；不能只看当前叶可见行而漏掉冲突。

1. `permission` 对应 permission summary；`question` 对应 question summary；`clientTool` 只对应 `tool && respondable === true`。requestId/callId 必须是非空无 padding 的准确值；不 trim 后发布新身份。pending action 同 id 必须唯一且 kind 符合。client-tool 允许既有 helper 支持的仍可响应 exact timeline-only 请求，其余类别依据真实 pending，不为未知 id 发明座位。
2. permission 与 client-tool 的响应/cleanup 身份采用 exact id；client-tool 不接受工具名、前缀或另一个 `toolCallId` 作为 callId alias。question displayId 先按现行规则在**全部** pending ids 中 exact 优先、否则最长 `${requestId}:` 前缀解析，再核该 pending 的 question kind 与 agent；不能先按 kind 过滤而错误落到更短前缀。question 同请求的多个合法显示行可共享一份 busy/failure，各自 draft 另核题目结构。
3. `rowIds` 是按上述规则真实投影出的 interactive 行：exact 行、已承认的 question child aliases，或当前确会出现的 pending-only seat（id=requestId）。`pendingAliases` 包含其 `pending:<canonical requestId>`。只作 prefix 覆盖而实际不是同 kind 的行不取得本地结果。permission 的 prefix 展示惯例不扩成新的响应/cleanup 别名。
4. canonical pending、候选 timeline summary、timeline item.agentId 与 attribution.agentId 中存在的已承认 agent 必须一致；缺失可借已有明确 pending agent 解析，不能盖掉冲突的已声明值。同 id 的 timeline/pending kind 冲突、agent 冲突、重复/歧义映射，均返回 untracked/conflicted，拒绝本地 busy/failure/clear/cleanup，不向裸 id 或任何猜测 alias 发布结果。冲突后来出现也退休旧 incarnation，不能只在 begin 时检查。
5. `respondFailures` 的旧裸字符串 map 保留既有 stream/fixture 兼容入口；**局部 unary 结果只进入 typed response projection**。生产 projection 有该正式投影时不再用 `.get(displayId) ?? .get(requestId)` 回退。host `pendingRespondFailed` 按 patch 当时的唯一 resolver 映射到当前 incarnation；无法唯一映射则不赋给任何座位。无正式投影的既有 stub/fixture 路径也先做同一 kind/agent 唯一解析，再读取 legacy failure，不能保留跨 kind 双读漏洞。stream terminal/non-retryable 仍高于本地 retry。

同一解析结果服务 failure、clear、busy 及 accepted cleanup 的校验。每次变动的 `changedIds` 为变动前后 `rowIds ∪ pendingAliases`，包含真实 question child id 和 pending alias；不能只发 canonical requestId 或 `'sync'` 假装准确行已失效。projection cache、entry equality/row reuse 都比较正式 response state revision/scope/incarnation，避免 sidecar 变化被旧 entry 缓存吞掉。

### 3.2 共享 binding 的原子开始与完成（I2 / Minor）

roster 先过既有 session/连接/能力写门，捕获当前 binding 对象及 `connectionGeneration`/published identity，再同步 `beginResponse`；登记与 unary 不跨 await：

| 次序 / 返回 | 共享状态与调用结果 |
| --- | --- |
| 1. resolver 有效，尚无本 incarnation attempt | 先把唯一 attempt 写入 shared binding 在途表；令 busy=true，清**本请求本 incarnation**的 retryable failure；保留草稿。non-retryable/terminal 不可开始。 |
| 2. 对所有 held consumers 安装同一新 revision | 全部 consumer sidecar 更新完成后才逐个同步触发 `onDidApplyFrame`；任一 listener 重入都已看见 shared busy，不能再创建 attempt。 |
| 3. 返回 started ticket 后 | 同步通知可能触发换链/移除；roster 先再验 ticket 仍 current，失效则不再发送。仍有效才调用一次已有 unary；同步 throw 与异步 reject 进入同一 captured ticket 完成路径。 |
| 同请求第二叶 click / Enter / 同步 listener 重入，返回 inFlight | 返回既有“已处理”语义并抑制第二次 unary；不制造 transport error、不清第一 attempt、不发布新失败。不能把它当 untracked 后继续转发。 |
| terminal/non-retryable，返回 blocked | 明确前置拒绝，不发 unary、不落入 untracked 兼容转发；保留关闭座位与错误。 |
| 无有效票据，返回 untracked | 保留既有 unary 转发/返回兼容，不建假 busy/failure。**其完成回调不调用按 sessionId 查询的 applyRespondCleanup，也不碰后来同名 binding**；未知或冲突请求没有本地结果所有权。 |

当前 started ticket 的 accepted 仍用原 helper 生成 patches，但只作用于票据所捕获且仍有效的 binding/incarnation；先验同一 resolver，无权时直接 no-op，不能按 sessionId 重新取得 binding。`{ok:false}`/reject 用既有错误字符串提取，记录 `cause: commandFailed` 的现有语义和 `{ retryable: true, error }`，将该 attempt 从 busy 变为 failed。它只表示本次未获 accepted，不推断引擎终态。完成前重核 binding live、scope、incarnation、attempt、roster generation/identity 与服务未 disposed；任一不符，不 cleanup、不发失败、不解除新 attempt。

authoritative stream non-retryable/terminal 立即退休或关闭对应 attempt；后到 transport 失败不能降格成 retryable。可重试 stream failure 至少终结当前 attempt，并按同一 typed 状态恢复座位；后到该 attempt callback 不得覆盖更新的 stream 结果。重复结果幂等。不按 session 批量解除其它请求。无关普通帧既不改变 incarnation，也不撤销 busy。

### 3.3 incarnation、sidecar-only 与同步通知（I3）

Shared binding 维护递增 request incarnation。有效 host frame 经 `applyViewFrame` 接受后，用正式的顺序 patch 处理过程维护身份生命周期，不能只在最终 replica 上做 JSON 比较。每个 `removePendingAction`、移除该请求所属 interactive timeline 表示、终态/non-retryable、kind/agent/问题或工具语义替换，使相应旧 incarnation/attempt 退休；仍须展示的 non-retryable 错误以不可再 begin 的关闭状态保留；同帧重新 upsert 相同 id 和相同结构也分配新 incarnation。新建 pending-only 座位随后 materialize 合法 timeline 行不算新请求；仅 ordinary title/chrome 更新和无关 frame 不退休，问题/工具语义签名须列明字段并由回归固定。

语义签名包含 kind、准确 requestId、已解析 agent；question 包含 items 的 id/title/options/multiSelect/allowCustom、ask-level options/flags/answerKeysValid；permission 包含 permissionKind/argPreview/optionsPreview；client-tool 包含 toolName/准确 call identity/argPreview/respondable。状态变 terminal 单独退休；orderKey、frameId、无关 timeline 行及相同内容重放不构成新 incarnation。

baseline 用真实 generation、canonical 请求语义和**已存在交互 timeline 行**核对：generation 改则整体换 scope；同 generation、同请求同语义保留 incarnation；pending summary 未变而已有 question options/items 或 tool args 改变仍须退休旧 attempt。pending-only 请求首次 materialize 合法行不退休；不能把每个无关 baseline 重放都当新请求。roster 在现有 `connectionGeneration` 或 published identity 变化处同步通知 FrameSource 切 connection scope，使旧 busy/draft 即使没有新 host frame 也失效；发布 scope 前先关闭 disconnected 写门，或先提交新 identity/目录并以 transition gate 阻止新 begin，旧 cache 先按旧 owner 保存；不用另一套连接代次源。binding 替换、最后 consumer release、服务 dispose 同样使旧票据无效。

每次 authoritative apply 和局部 begin/complete 都先原子得到新 snapshot 与 response projection，再把新 projection 安装到**所有** live consumers，最后发通知。snapshot、legacy failure、typed state、scope/incarnation 分开判断：任一局部状态变即通知，即使整帧 remove→re-add 后 timeline/pending JSON 完全相同也必须通知旧/新 rowIds 与 pending aliases。重复相同结果可无通知。local sidecar-only 不推进 host cursor、不伪造 frame、不发送 host ack；真实 host 帧仍走原 acknowledge 合同。

晚加入 lease 取得当前 typed busy/failure/incarnation；现存两叶立即一致。旧 binding 无消费者后不能把结果投给后来同 sessionId 的 binding。consumer 不再各自独立推断 incarnation；必须从 shared binding 已定的新 projection 安装，避免 fan-out 顺序造成两个叶的身份不同。

## 4. 座位忙碌与问题草稿

生产 renderer 的 engine 座位以正式 projection 的 `inFlight` 为 busy SSOT，保留 DOM 的 disabled/aria-busy 与即时提交保护，但不能用 renderer 私有 hold 取代共享占用。新 attempt 的 busy 优先于上一失败对象；开始重试已经原子清掉自己的 retryable failure。permission、question、client-tool 同一合同，terminal/non-retryable 不可点。failure 显示在对应座位；现有通用失败通知不在此扩写。旧 stub/无 engine projection 消费者可保持现有局部交互合同，真实整链与双叶回归必须走正式共享入口。

为 `ConversationQuestionSeat` 增加正式初始草稿与变化回调：按 question item id 保存 selectedLabels、customText 及多组单选显式激活状态。renderer draft key 是 **response scope + canonical key + incarnation + 问题结构签名**，不同合法 display alias 还须核自身结构；不只用 turn.id/text、sessionId 或 lease 引用。seat 重建恢复多选、非首选单选与 custom text 不自动发送，不把 roving tabindex 默认首项当用户选择。

TimelineHost 在每次 apply/空列表清理前从正式 getter 同步当前 scope/incarnation，再做行复用；renderer 检测旧 key 消失/退休便清理旧 hold/draft，不能等本请求再次可见才解除。entry state revision 变化使现存行实际刷新。相同 lease/generation 的同帧 remove→re-add，即使最终题目和 id 相同，新的 incarnation 也强制丢弃旧答案及旧 busy；旧 Promise 完成无效。generation/connection scope 改变同样清空。一次错误重绘、行回收及同请求无关帧不丢草稿。所有测试通过同一正式 options/projection 提供身份，不能加只测入口或手动清 renderer 表绕过链路。

## 5. 实施文件与并行边界

生产主要为 `conversationEngineRosterService.ts`、`conversationEngineFrameSource.ts`、`conversationTimelineRenderer.ts`、`conversationQuestionSeat.ts`；`conversationViewFrame.ts` 及同模块纯 resolver 定义正式局部合同，`conversationSessionView.ts` / `conversationLensProjection.ts` 与 TimelineHost/types/`conversationLensReadingColumn.ts` 传递 typed identity/incarnation/busy/failure。仅确需共享的正式类型进入现有 conversation 模块；不新增公共服务、RPC 字段、存储键、CSS视觉系统或 Sessions 产品入口。

回归复用 `conversationEngineRosterService.test.ts`、`conversationEngineFrameSource.test.ts`、`conversationTimelineRenderer.test.ts`、`conversationQuestionSeat.test.ts`/现有 stream harness；若真实整链组合让现有巨大 suite 更难读，可以新增同 browser 层的响应恢复 suite 与最小正式 mock 复用，不将 browser 夹具塞 common。保留既有 D1356/1357/1359 断言与清理检查，不删 skip 测试、不用宽 cast/字符串扫描代行为。

本波冻结 J=Sources补修、E=本模块；D 仅非作者审查/验收，merge=唯一编译/运行/产物写入，父仅调度。不得加第三 coder/新模块；任一模块 merge-queued 后不得扩大波次。J 当前仍 occupied，旧23f不是补修完成线。E 不改 Sources/finder/fence 文件；共享文档仅真三路保留双方事实，禁止整文件选边。

## 6. 验证合同与证据

E 不执行运行项，只写正式源码/回归、静态 lint/AST无checker/diff/docs检查；不编译、transpile/typecheck/out/watch 或运行依赖out测试。唯一 merge 先新测试+精确旧生产 red，再最终新生产 green、完整相关套/必要 compile；运行记录须绑定不可变源、测试和实际JS摘要。父已转达初版六项旧业务red的有限结果，见§9；不将clientTool的busy断言失败写成已达完成回调。

| 验证 | 必须可观察的断言 |
| --- | --- |
| 核心业务 red/green | 真实 roster + EngineFrameSource lease + projectSnapshotToEntries + actual renderer，鼠标/键盘点 permission/question/client-tool → busy → 受控 unary false/reject（不额外注入 stream failure）→同一座位错误与重试恢复；第二次响应仅增加一次 RPC，post/Chat=0。旧代码必须在错误缺失或仍禁用的业务断言失败。 |
| sidecar-only | snapshot timeline/pending逐值相等而 typed failure/busy/incarnation 与 onDidApplyFrame 真改变；changedIds 同时含真实 question child row 及 pending alias；双 lease与晚加入 lease一致，不靠 getter 或手动刷新假装通知到达。 |
| 准确身份（I1） | 两请求并行仅失败那个恢复；permission/question/client-tool 同裸 id、question displayId 与另一 kind requestId 碰撞、最长 prefix 指向异 kind、timeline/pending 同 id kind/agent 冲突均不写任何猜测座位/裸 key。每类 failure/clear/busy 精确刷新真实 row+pending alias；accepted 同样隔离。跨 session、binding释放重建及 untracked unary 后新 binding 同 id 均不串 cleanup。 |
| 生命周期 | 失败晚于新attempt、terminal/nonretryable、remove→same-id re-add、换connectionGeneration/identity、dispose、baseline generation变更时均不覆盖新状态；普通无关帧不解除当前busy。accepted原cleanup、未知/跨语义client-tool及显式ok边界仍绿。 |
| 共享原子 busy（I2） | 同请求两可见叶同时 click/Enter（第二事件按 JS 顺序紧随首个），及首个 begin 通知 listener 同步重入 roster，均只有一次 RPC；第二叶也 disabled/aria-busy，无新失败。故障重试遇强制无关重绘保持 busy；旧 failure 不解除新 attempt。本次 retry 失败只恢复本请求。 |
| 问题草稿与正式失效（I3） | 第二选项/多选/customText/implicit多组激活 → submit → failure与重绘 →值保持，retry payload精确原值且重建不自动 RPC。相同 lease+generation 同一帧 remove→same-id re-add、最终 snapshot/题目逐值相等时仍真实通知并清旧 draft/busy；旧 Promise false/reject/accepted 均不控制新座位。authoritative generation / roster connectionGeneration 或 identity 改变也清；无关 frame 与同代同语义 baseline 保留。 |
| 既有写门 | disconnected/pairing/缺hook/未知session不发unary，terminal/nonretryable不复活；permission Skip仍granted:false。 |

另派非作者在唯一 merge 新产物冻结后，用独立空profile默认编辑器与受控连接服务做真实 after：三类座位实际点击/键盘、忙碌、就地失败、重试次数、答案值及双请求隔离；记录实际加载模块/源映射摘要、主题/宽度/焦点，不以只有通知或pending保留代完整恢复。断连/换链负控通过公共服务驱动；无在线引擎结果不得声称真实远端交付。若未跑矩阵项，明确未验证，不升PRD004/008或关闭旧D项。

## 7. 规则16审查记录与交付顺序

### 7.1 首轮独立原意见与逐项改入

2026-10-26，非作者 `/root/architecture_audit`（Astra）对首稿 SHA256 `82c0523c6a66e3f3933da4f686fa1567fe78371eeb6f80a6cd682ad7a0d401e7` 的正式规则16结论：**Critical 0 / Important 3，暂不能 accepted/实施**。原意见由父 `/root` 完整转达；当时没有独立仓库报告文件，因此本节留证，不虚构外部报告链接。

**Strengths**：已识别完整恢复链、双 sidecar 早退、retry 旧 failure 和问题 draft；局部复用现有能力，无新增 RPC/global service；旧代码业务 red、新代码 green 与非作者 after 的边界清楚。

| 原级别 / 原实质意见 | 本轮采纳与可复读定位 |
| --- | --- |
| I1：裸 string respondFailures key 与 question 的 timeline id/request alias 双读使票据 kind 无法防止投影后跨 kind 同 id 污染；须明确 canonical 到实际行/alias、冲突拒绝和准确 changedIds | 全采纳。§3 正式 typed projection；§3.1 唯一 resolver、kind/agent 冲突拒绝、局部不写裸 key、生产取消无校验双读、legacy 路径先验映射，before/after row+pending alias 通知；§6 I1 负控。 |
| I2：renderer hold 仅单叶；shared binding 必须先于同步通知/RPC 原子登记同 incarnation 唯一 attempt/busy，第二叶/重入抑制二发且不报新失败 | 全采纳。§3.2 started/inFlight/untracked 与原子状态序列；§3.3 所有 consumer 先装状态再 fan-out 通知；§4 renderer 只消费正式 busy；§6 双叶连续点击与同步 listener 重入负控。 |
| I3：session+lease 无法识别同 lease/generation 同帧 remove→same-id re-add、最终结构相同；incarnation 必须经正式 projection/options 到 renderer，snapshot 相等仍通知并清 hold/draft | 全采纳。§3 正式 scope/incarnation 字段与 getter；§3.3 顺序退休/再生、generation/connection scope、原子通知及 entry/cache 失效；§4 draft key 与空列表同步；§6 I3 负控。 |
| Minor：无票据保留 unary forwarding，但完成回调不能按 sessionId 找新 binding cleanup | 全采纳。§3.2 untracked 不拥有本地完成动作；started 也仅捕获 binding 的有效 ticket 可调用原 helper。 |

**Assessment**：三 Important 是现有合同落地所需，不是新产品范围；D1356/1357/1359 原边界保留、不重复 gap。本轮仅改 draft，未自行降级任何意见；须同一 Astra 增量复读确认 C/I 已闭合，才可 accepted。

### 7.2 同 Astra 增量复读结论

2026-10-26，父 `/root` 转达同一非作者 `/root/architecture_audit`（Astra）对修订稿 SHA256 `262df24edb9db55e2d126dc594d6746d9d77bbd847b581fcdf5c99b06a891cd0` 的正式结论：**Critical 0 / Important 0，原 I1/I2/I3 与 Minor 实质闭合**。Strengths 明确确认 typed projection/full-snapshot resolver/exact-最长prefix+kind/agent拒绝/真实rows-aliases缓存revision；shared唯一占用→全部consumer先装状态→同步通知→再验票→一次RPC；顺序patch incarnation/connection-frame scope经正式投影让snapshot相等也通知并清draft/busy。

唯一新增 Minor：terminal/non-retryable 必须由显式 blocked 或明确前置 return 承载，不能误落 untracked 而继续转发。作者核验这是原“不可开始”合同的落地细化，已在 §3 接口与 §3.2 状态表增加 blocked，§6 既有写门负控覆盖不发 unary；非新设计阻塞。方案据此标 accepted，尚无本模块运行/after 证据，不升 implemented/关闭 gap。

### 7.3 后续顺序

1. 增量复读已通过 C0/I0；本轮 accepted 方案独立提交后实施。
2. C/I 闭合并 accepted 后独立方案 commit；再在 E 按本合同实施。代码、必要系统规格/方案事实、行动账与本主题回归一起 scoped commit，不 push。
3. 唯一 merge 串行合入及 red/green、相关套/类型/必要全量、非作者 after，再按证据决定 implemented。只记录已有问题、不因文档进度认完成。源码实施、运行/after均待。

- [x] 规则16增量复读确认Critical/Important闭合；本轮accepted方案独立提交。
- [x] 三类响应准确结果通道、shared busy/incarnation与问题草稿及整链回归源码随本轮实施提交；运行/after待。
- [ ] 唯一merge业务旧红/新绿、完整相关回归及源/产物身份。
- [ ] 非作者默认编辑器after与文档/状态门禁。

## 8. E 实施交接（仅源码与静态证据）

accepted 方案提交 `5dd7d97` 后在 E 实施，未取 root 外部视觉/协议 WIP，未改 Sources/finder/fence、协议或 Sessions。新增 common `conversationResponseState.ts` 是现有 renderer-facing 局部合同与纯 resolver/状态表；正式 `lease.responseProjection` 经 Lens/entry/TimelineHost 到 renderer。FrameSource 顺序处理 request 生命周期，并在通知前安装所有消费者状态；roster 三种 unary 捕获票据投影结果，unknown 转发的 callback 无本地 cleanup。关闭请求显式 blocked，连接 scope 失效保留仍有效的权威 non-retryable 关闭态；authoritative generation 新请求按新身份重建。QuestionSeat 增加草稿与初始 roving index；真实 document-flow `conversationProcessFold.ts` CTA 直接消费正式 busy，覆盖其绕开 renderer hold 的既有路径。

回归源码落在 `conversationEngineRosterService.test.ts`（真实 host/renderer/lease/roster 整链）、`conversationEngineFrameSource.test.ts`（捕获 binding 释放重建）与独立 `conversationResponseState.test.ts`（canonical/alias/agent/缓存）。没有依赖 out 的测试执行结果。E 只做 TypeScript `createSourceFile` parse（无 checker、无 emit）、ESLint、diff/docs 静态门禁；静态结果为17个TS文件parse 0 errors、ESLint 0 errors / 17 warnings，`git diff --check`通过；docs health 0 errors / 73既有warnings（对首稿新增0/移除0），status172行。原始静态JSON位于`/tmp/vscode-response-recovery-E-eslint.json`与`/tmp/vscode-response-recovery-E-implementation-docs-health.json`；这些不是green或after证据。

唯一 merge 运行合同：

- 旧 red 用新测试 JS 加**精确 `09f6da72d30` 旧生产**，selector `response recovery business`；测试 harness 只把可选 `lease.responseProjection` 透传已有 projection/options，旧实现可忽略，不调用新增 begin API、不运行时 import 新 ResponseState support。因此 red 必须落真实 DOM busy/就地错误/可重试业务断言，不能以 missing API、模块加载/类型/timeout 计红。记录旧核心源/JS、测试JS摘要与产物身份。
- 新 green 先跑 `rtk proxy scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts --grep 'response recovery'`，再跑该文件完整 suite；matrix 包括三类×false/reject、双叶同步 click/reentry、late leaf、同帧 pending/timeline remove→re-add×false/reject/accepted、同代 baseline保留与跨代清空、无票据迟到accepted、不复活blocked、implicit多组activation与权威stream优先×三种迟到结果。snapshot相等/noack/答案payload/RPC次数/post=0均须实际通过。
- 完整相关 browser 套：`conversationEngineFrameSource.test.ts`、`conversationResponseState.test.ts`、`conversationSessionView.test.ts`、`conversationTimelineProjection.test.ts`、`conversationTimelineRenderer.test.ts`、`conversationTimelineHost.test.ts`、`conversationQuestionSeat.test.ts`、`conversationProcessFold.test.ts`、`conversationProcessFoldToolDetails.test.ts`、`conversationStreamToDom.test.ts`、`conversationStreamScripts.test.ts`；必要 `compile-client` 仅该 lane 执行。已有 D1356/1357/1359 的身份/显式ok/cleanup边界不得删断言以变绿。
- 新产物冻结并核实际 JS/源摘要后，父派非作者默认编辑器 after；仍按 §6 的实际座位点击/键盘、busy、错误、重试、答案与准确隔离，不拿这里的源码矩阵充运行证据。

## 9. 初版源码独立审查与原合同补修（2026-10-27）

初版不可变实现为 `900f772bfd139214651a7c15e82678a1a0ef6f69`（src tree `da5aa1664b65970dc72790749b1101c4534f074f`）。父 `/root` 转达原 Astra 的独立 code review **Critical 0 / Important 3**，该候选不可正式排队。以下是原合同内修正，保留900f失败历史，不重开方案签收、不自称意见已获独立闭合；修订候选待同一 Astra 复审。

| 原 Important | 本轮修订与新增公共边界回归源码 |
| --- | --- |
| I1：仅timeline `respondable:true`、无pending的clientTool，accepted终态丢respondable后记录被退休，重复begin落untracked并二发；权威terminal先到也有同漏洞 | FrameSource与State共用语义变化判断，已知clientTool终态省略respondable/cleanup省略call chrome属于生命周期；仅从旧已知身份保存blocked tombstone，显式替换语义/移除/agent冲突仍退休，不将普通terminal tool识别为clientTool。真实host点击→unary accepted→重复公共respond返回false/RPC仍1；另有权威terminal→旧false/reject/accepted迟到三项与普通terminal兼容转发正控。 |
| I2：disconnect/identity switch先发scope reset，监听器同步respond可在旧写门/目录创建新票据，单使旧generation失效不足 | public disconnect先提交关闭状态；真实connection disconnect先移除display override；identity adoption先开启response transition gate，旧catalog按旧owner落盘，再提交新identity/目录并发scope。dispatch开始与通知后都核实际live连接及transition gate。真实held lease scope listener内同步调用permission/question/clientTool三公共API，disconnect两入口和published identity switch均断言三false/零unary；新旧identity cache用相同session id固定owner不串写。 |
| I3：同代baseline沿用pending summary，已有question/tool行语义替换未退休，旧结果可污染/清理新行 | State保存已materialized行summary，reconcile比较规范语义，覆盖baseline和patch共同入口。pending-only首次materialize允许沿用；同语义baseline继续busy。真实host question options / question item id-title / clientTool args三变化×旧false/reject/accepted共9项：pending逐引用不变、替换后旧busy/draft解除、新点击建新attempt、旧完成不改snapshot/不解除新busy、当前结果仍准确投影。另有公共边界首次materialize正控。 |

父转达唯一merge的初版旧业务red共6项：permission/question四项已到unary settle后缺inline失败；clientTool两项先在processFold busy断言失败，**不能称已达完成回调**。E未运行这些测试，不改已有运行记录；精确旧生产仍是 `09f6da72d30`，与下列三Important的旧900f red分开。

### 9.1 唯一lane精确旧900f与新候选验证

本次新增18项全部在 `conversationEngineRosterService.test.ts`，总selector为 `response recovery review`；测试经真实public roster、held EngineFrameSource lease/正式projection，交互项使用真实TimelineHost/renderer/processFold，不调用新增State/begin测试入口。

| 精确test名或grep | 旧900f预期业务断言落点 / 正控 |
| --- | --- |
| `response recovery review I1 timeline-only clientTool accepted remains blocked after respondable is removed` | 真实点击及accepted cleanup后，重复public respond应false且RPC仍1；旧900f会返回true并二发。包括cleanup省略call id chrome。 |
| `response recovery review I1 timeline-only clientTool authoritative terminal supersedes late`（3项） | terminal先到即重复应false，晚到false/reject/accepted均不改终态/RPC仍1。 |
| `response recovery review I1 ordinary terminal tool stays untracked on the public response boundary` | 正控：普通terminal仍走unknown兼容转发一次，无typed ownership/本地cleanup，不能靠把所有terminal都blocked通过I1。 |
| `response recovery review I2 public disconnect closes writes before synchronous scope notice` | 旧900f通知中的三响应返回true/新增unary；修订须三false/零unary。 |
| `response recovery review I2 published identity switch closes writes before synchronous scope notice and preserves cache owners` | 旧900f在旧目录仍可respond；修订须三false/零unary、A/B缓存owner准确。与public disconnect分别作最小旧red代表。 |
| `response recovery review I2 connection disconnect closes writes before synchronous scope notice` | 真实connection入口正控：通知确发生、三false/零unary。 |
| `response recovery review I3 same-generation baseline question options retires old false while pending stays unchanged` | 旧900f在baseline替换后的真实按钮仍busy，不能新建替换attempt；此业务断言作question最小旧red代表。 |
| `response recovery review I3 same-generation baseline clientTool args retires old accepted while pending stays unchanged` | 同上，tool args代表；后续assert固定旧accepted不清理新snapshot。完整I3矩阵另含question items、三旧结果共9项。 |
| `response recovery review I3 pending-only first baseline materialization preserves the live attempt` | 正控：首次合法行落位仍busy，二次public respond仅返回已处理不二发；当前false准确恢复新行。9项矩阵各自另验同语义baseline replay仍busy。 |

先在唯一lane以修订测试JS+精确旧900f生产做上述代表性业务red，再统一最终生产跑 `response recovery`、完整roster及§8全部相关套、必要compile与独立默认编辑器after。missing API/module、type、timeout不计业务red。E未编译/typecheck/transpile、未写out、未跑依赖out测试。

本轮静态门禁：4个改动TS `createSourceFile` parse为0语法诊断（无checker/emit）；ESLint 0 errors / 5既有warnings，原始JSON `/tmp/vscode-response-recovery-E-review-fixes-eslint.json`；`git diff --check`通过。生成状态核对OK；docs health为0 errors / 73既有warnings，对上一实现检查新增0/移除0，原始JSON `/tmp/vscode-response-recovery-E-review-fixes-docs-health.json`；status173行。最终不可变身份随提交交接给出；方案仍accepted，不升PRD/不关闭旧D项。

2026-10-27，父转达正式J/E三路集成 `24a3850`（src `fdca9564`）后唯一baseline首轮full `compile-client` 实际exit1，仅一条诊断：本文件回归夹具所发terminal summary在test:3643把 `respondable` 写成false，而正式领域合同为 `respondable?: true`。原日志/身份由baseline保留于 `/tmp/vscode-je-formal-native-build.log` / `.json`，不以本段代运行证据。E仅将夹具改为解构省略respondable，准确模拟权威终态移除标记；全部18项与原断言保留，无宽cast或领域类型放宽。该trivial类型修正由唯一lane复验，E不编译/typecheck/transpile/out/跑业务。
