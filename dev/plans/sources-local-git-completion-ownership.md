---
title: "Sources：本地 Git 完成反馈的宿主归属"
type: plan
status: draft
phase: M7
updated: 2026-10-27
summary: "两宿主local Git完成后无owner复核是静态缺口；仅拟用现有input/ref与生命周期代次保护notice/collapse/finally，真实DOM与公共命令门验证待授权，不扩已完成Sources或lease。"
---

# Sources：本地 Git 完成反馈的宿主归属

> 固定方案输入：`736171b1abc34e36e4991709240625827b566396`，`src=90d6092dbbca80114db7f55a75e137bb1d7bef76`。缺口最初只读审于精确 `5336c7f82565eb15de5aad3a125ab66cabdc1807`，本稿再次核实两宿主及 common controller 在两提交间逐字相同。当前只授权 docs draft；不实施、不运行、不追 main/merge 新尖端，不接入或修改 lease 工具。

## 1. 独立范围与证据等级

[Accept 读后授权](sources-accept-post-read-authorization.md)、[Panel VM 生命周期](sources-panel-diff-view-model-lifetime.md)、[共同 fixture 预注入](sources-panel-fixture-preinjection-amendment.md)、[旧 render stub 合同](sources-panel-stale-render-stub-amendment.md)四窄方案已 implemented，其固定 6d 的真实组件验证与全部旧失败历史保持；本稿不重开这些方案。[可见叶 lease 恢复](conversation-visible-lease-recovery.md)仍 accepted，source peer/正式合源不等于运行完成，旧 red/新矩阵/Reveal/独立 after 继续按其原门禁；lease 运行优先。

本稿只处理默认编辑器两种 Diff 宿主内**已发出的本地 Git 命令**完成后，对 notice、Revert/Unstage collapse 及 finally 动作刷新的归属。当前只有固定源码可达性证据，尚无本 scope 的真实组件旧业务 red、新 green 或 UI/Git 实端证据。不得把已有 Sources 72 green、lease 静态 peer 或下面的预审意见写成此修复已验证。

当前 merge native 仍为 `54fe` 恢复的旧产物，Sources4 现源/native 不匹配真实存在；`736171b1` 只是精确 pre-localGit 源码身份，不能把目前旧 native 标成该源码的已编译基线。D 工位元数据连续性也不提供 merge 运行的 producer credit。后续旧 red 的产物资格须先满足 §4，当前不准备任何工具或 emit。

以下路径相对 `src/vs/workbench/contrib/sources/`，行号属于固定 5336/736 同字节源码：

| 点位 | 当前实际行为 |
| --- | --- |
| `browser/conversationDiffReviewPane.ts:700–718` | `runGitAction` 取 facts/plan，await `executeCommand(plan.commandId, plan.scmResource)`；成功清 notice 并可写 collapse，catch 写 notice，finally 更新动作，均无完成时 owner 复核。 |
| `browser/sourcesDiffPanelView.ts:720–738` | Panel 同链；没有原 ref、render 代次或 disposed 复核。 |
| `common/sourcesDiffWriteController.ts:241–259` | 入口已拒 writeClosed 或无 SCM；固定 command/resource；仅 clean/unstage 产 collapse，本地 Stage 不 collapse。 |
| `common/sourcesChangeRef.ts:134–156` | 按打开时 group/resource 解析 SCM；没有完成时把请求重定向到新 ref。 |
| 两宿主 `runStage` 的 local 分支（Pane551–553 / Panel574–576） | 进入 local 前已有 Stage owner 守卫；命令进入等待后仍落入上述未保护的 `runGitAction`。 |

三条静态可达序列须分别实际取证：

1. A 真加载成功，Revert/Unstage 点击已进入 command Deferred → public setInput(B)/show(B) 或 clear → A reject。当前 catch 会把 A 错误写到 B 或已清空宿主。
2. A 的旧命令挂起 → B 真加载，B 自己的命令失败形成可见错误 → A resolve。旧成功直接清掉 B 的当前错误。
3. A 的 clean/unstage 挂起 → 打开**不同 modified URI** 的 B → B 同类命令先 resolve 并正常 collapse → A 最后 resolve，把单一 collapse holder 覆盖成 A URI。controller29–41/101–107 对 B 不认 A 的 collapse，finally 可能使 B 对应按钮重新出现。不得仅用旧内部字段值变化代替这个实际 DOM 结果。

这些不是“Git 把 A 写到 B”的证据：已发命令参数一次固定，缺口在完成反馈。入口 closed/read-failed/pairing/not-ready 门以及后续 chrome 的 closed 隐藏仍存在；仅 session/readiness 变化不自行构成绑定失效。

## 2. 选定的最小完成归属合同

生产面预计只改上述两处 `runGitAction`，沿用现有 controller、命令 id/参数、发送次数、错误处理及本地 Stage 不 collapse 的语义。不得改 `runAccept`、engine write、VM/refs、lease、Git 扩展命令实现或 Sources planner；不增加 API、服务、计时器或新 epoch。

在 `executeCommand` 之前同步捕获本次宿主绑定及**已有**生命周期代次，构造同一 `isCurrent`，只用于本次命令完成后的反馈写回：

| 宿主 | 必须同时满足的当前谓词 | 不可替换为 |
| --- | --- | --- |
| Pane | store 未 disposed；捕获 input 是 `ConversationDiffReviewInput` 且未 `input.isDisposed()`；`this.input === input`；捕获 `stageAttemptGeneration` 仍等当前值。 | `renderGeneration`：input.loadGeneration 可被复用，不能挡同 input 重用的 ABA。 |
| Panel | store 未 disposed；`this.currentRef === capturedRef`；捕获 `renderGeneration` 仍等当前值。 | `_stageGeneration`：Stage 自身会递增，不能因此作废同绑定的其他合法 local 完成。 |

不为 local 调用递增这些字段。固定源码中 Pane 的 `stageAttemptGeneration` 仅在 setInput/clearInput/dispose（:218/:287/:279）递增，既有 Accept :609–611 已合法共用该 owner 谓词；此处只复用机制，不改 Accept。Panel `renderGeneration` 在 dispose :206 / renderRef :282 赋值，show/clear 沿现有 render 生命周期分配代次；`_stageGeneration` :536 则由 Stage 自增，语义不同。仅比较对象指针不足以覆盖 clear 后恢复原同一对象。这些是源码读证，不是本轮运行验证。

成功分支的 hide notice 和 collapse 赋值、catch 的错误 notice、finally 的 update 必须各自受**同一**谓词保护。try/catch 内 return 后 finally 仍会运行，故 finally 自身必须复核；不能把“没有可见变化”冒充没有写回。owner 已失效时不触碰后来绑定、空宿主或 disposed 宿主的反馈 DOM/状态，不代其清旧错误，也不写旧 collapse。

以下行为刻意保持现有合同：

- 命令已经发出就继续完成；不取消、回滚、补偿、重放或重发，不二次授权，不将结果改发给当前新会话。
- 同 owner、同绑定内多个 local 命令继续按原 completion 顺序处理；不加 latest-attempt 仲裁、按钮禁用或并发 epoch。
- 仅 active session、connection、readiness/读状态变化不使 owner 谓词失效；当前绑定仍在时保留命令原反馈语义，chrome 仍按 fresh facts 体现闭态。恢复 readiness 不需要重放旧命令。
- 已完成的 collapse 仍沿现有 modified URI 规则保留/清理；本稿仅阻止**迟到的失效 owner**新写入，不重定义同 URI 的既有 collapse 策略。

## 3. 真实组件回归与旧业务 red 判据

在现有 Sources 组件测试面新增独立 local-completion suite，保护既有四方案/72例/旧 assertions/helpers。真实实例化 Pane/Panel、DiffEditorWidget、IModelService/resolver 与完整 progress 依赖；采用合法 SCM group/resource 的公开 DI 边界。先证明比较真实加载成功、相关 DOM 按钮可见/可用，再走实际 DOM `click()` 委托，**不直接调用 private `runGitAction`**，不替换生产方法，不使用 throwOnLoad + paintChrome / forceClick 伪造可用起点。

命令使用公共 `CommandsRegistry.registerCommand` handler，记录实际 id、SCM resource 对象与次数，handler 内显式 started/release Deferred；ICommandService 必须真实转发到该注册 handler，不能吞掉调用。通过 started 门确认原命令确已进入等待，再用公共 `pane.setInput` / `pane.clearInput` / `panelService.show` / `clear` / host.dispose / input.dispose 变更绑定。完成观察用有界异步 flush/DOM 条件；不无限微任务轮询、不靠加长 sleep 掩盖错误。fixture/load/命令未抵达或 timeout 不是业务 red。

| 组 | 每个宿主的操作与判据 |
| --- | --- |
| R1 旧失败跨 owner | A 按钮触发 local 命令 pending → B 真加载或 clear → reject A；B/空宿主 notice 保持原状态，command 固定到 A 且仅1次，0 engine unary。旧源码须实际在最终 notice 断言出现业务 red。 |
| R2 旧成功不清新错误 | A pending → B 真加载并由 B 自己的公共命令 reject 产生 sentinel-B 错误 → resolve A；B 的 sentinel 不变，A/B各1次命令，0重发。 |
| R3 不覆盖 B collapse | A pending → 不同 URI 的 B 同类 clean/unstage 先 resolve → 先断言 B 对应按钮已隐藏 → resolve A → B 仍隐藏。原 SCM 条目可保持直到公共刷新，测试依赖实际宿主 collapse，不手工设 holder。 |
| R4 生命周期 | 分别 setInput/show replacement、clear、clear 后原同一 input/ref 恢复、host.dispose；Pane 另有仅 input.dispose、Pane仍活且 input 引用不变。old resolve/reject 各自不写回；同对象重用前须真实恢复 load 成功。 |
| R5 finally 零回写 | 与 R1/R4 隔离公共生命周期本身的合法更新后，在真实反馈 DOM 的文本/样式公开边界观察完成后的写入；无效 owner 的 success/catch/finally 均为0。若 MutationObserver 只报告值变化不足以证明零写，须在公开 DOM setter 边界记录并原样转发；不替换私有 update 方法充当行为证明。 |
| P1 当前 owner | clean、unstage、local Stage 的成功/失败都走真实按钮；当前成功仍清 notice，clean/unstage 对应 collapse，失败仍显示原错误且动作不误收起；local Stage 本来不 collapse。 |
| P2 同 owner 反序 | 同一绑定发两个合法 local 命令，以反序 release；保留既有 completion 顺序反馈，不把先发后回作废。 |
| P3 仅会话/门变化 | 命令已发、绑定不变，只切 active session，或改变 readiness/connection/读状态并通知公共事件；完成仍按原绑定反馈，closed chrome仍关闭；恢复后不重发/不取消。此为不引入二次授权的正控。 |

R1–R3 各以两真实宿主独立取证，不合并计数掩盖单入口。Revert=workingTree、Unstage=index，local Stage 使用确实落到 local 的合法 SCM 环境，0 engine unary须记录；不得改 planner 来制造入口。旧源码 red 以固定 736 为 pre-localGit 源码输入，并使用与后续新修复相同的一组新测试；这不代表当前 native 已匹配，必须先由唯一 lane 按 §4 建立匹配依赖/组件产物资格，再另行精确释放取得；若实际结果推翻静态预期，保留原件并退回判断，不改原断言求绿。所有 deferred 在 finally 释放，真实 disposable tracker保持开启，body与meta/hooks/pending/missing分列。

## 4. 实施、验证与验收门禁

1. 当前仅独立 docs draft，固定 SHA/全路径身份给 root 核验，再由原 Astra 按[规则16](../../docs/DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿)只读审查；root采纳实改、独立 accepted 后，仍须另发源码授权。设计输入预审不代替本稿规则16。
2. 作者获源码授权后只交两 host 完成反馈门与必要新真实组件回归/主题文档，不自行编译、转译、emit、测试或修改任何旧证据。正式源码另有原Astra独立peer，尤其核同一谓词、finally与ABA，以及未引入session/attempt取消语义。
3. 唯一 lane后续须先按精确 pre-localGit 基线源码，建立与该源码**匹配的依赖和组件产物**，再用同组新 tests 取得纯 localGit 旧业务 red → 新修复 green；不能直接使用当前54fe旧native冒称736基线，不能借现有源码或旧72运行绿补足产物资格。具体临时emit/依赖身份协议须另审、另由root release；不改workspace源码来切old/new，finally恢复原旧native。draft不订未经审查的运行次数、编译额度或emit范围，当前不做准备/emit。获明确释放后再按固定输入/所有权/全局空闲/恢复边界，运行**完整官方Conversation Pane与Sources Panel两个模块**，保留actual reporters、meta/hooks/pending/missing、每项业务断言及owned-process/finally restoration原件；不要求全量compile或新造验证平台。
4. 完整两模块/meta/hooks及恢复资格足够时，本窄反馈归属不强制额外UI after；只能签 source/真实组件完成反馈合同，**不能称真实Git索引或全UI验收**。lease既定独立after仍必需，其运行/验收优先级与待办不变。
5. 四Sources implemented、lease accepted及其全部runtime pending、PRD/D1387/宽Sources/旧波保持；本稿不借局部签收提升其他状态或抢占运行lane。文档draft阶段只允许generator/health/diff，不AST/lint/Program/checker/emit/tests/runtime/UI/engine/out/cache/freeze。

## 5. 预研裁定来源与行动入口

root在只读研究后独立核两 `runGitAction`，转述并采纳原 **Astra / architecture_audit** 裁定：现码归属缺口 C0/I1/M0 **仅静态**，上述最小合同本身 C0/I0/M0。Pane input+stageAttemptGeneration、Panel ref+renderGeneration、success/catch/finally同门、同owner completion顺序与session/readiness不失效，以及真实DOM/公共CommandsRegistry测试和条件UI-after边界均来自该消息裁定。本稿按root消息记来源，不编造独立审查报告或raw文件；它们不是此draft的正式规则16。**本稿仍draft，规则16尚未发生。**

复用[Sources看板中的独立local Git子scope](../parallel/active/sources-accept-post-read-authorization.md#local-git-completion-draft)与[作者检查点](../progress/sources-accept-post-read-authorization-checkpoint.md#local-git-completion-draft)；不另建日志，不改lease运行工具。
