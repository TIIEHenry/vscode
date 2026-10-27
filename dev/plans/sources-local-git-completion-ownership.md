---
title: "Sources：本地 Git 完成反馈的宿主归属"
type: plan
status: accepted
phase: M7
updated: 2026-10-27
summary: "固定a227源码peer C0/I1/M0经root采纳，唯一I1仅两test转发改await真实handler后return undefined；两test各一次AST/no-cache lint，待root核/窄peer；plan accepted/runtime pending，lease运行优先。"
---

# Sources：本地 Git 完成反馈的宿主归属

> 固定方案输入：`736171b1abc34e36e4991709240625827b566396`，`src=90d6092dbbca80114db7f55a75e137bb1d7bef76`。缺口最初只读审于精确 `5336c7f82565eb15de5aad3a125ab66cabdc1807`，本稿再次核实两宿主及 common controller 在两提交间逐字相同。固定 `be99a17cb83fad139bb440902195f90414fcda19` draft 已经原 Astra 正式规则16审查，root 采纳 C0/I0/M2 并独立授权本次 accepted 文档修订（§6）；该文档签收时未授权实施；root 独核固定7e2e后已另授权 §7 的最小源码候选，当前仍不运行、不追 main/merge 新尖端，不接入或修改 lease 工具。

## 1. 独立范围与证据等级

[Accept 读后授权](sources-accept-post-read-authorization.md)、[Panel VM 生命周期](sources-panel-diff-view-model-lifetime.md)、[共同 fixture 预注入](sources-panel-fixture-preinjection-amendment.md)、[旧 render stub 合同](sources-panel-stale-render-stub-amendment.md)四窄方案已 implemented，其固定 6d 的真实组件验证与全部旧失败历史保持；本稿不重开这些方案。[可见叶 lease 恢复](conversation-visible-lease-recovery.md)仍 accepted，source peer/正式合源不等于运行完成，旧 red/新矩阵/Reveal/独立 after 继续按其原门禁；lease 运行优先。

本稿只处理默认编辑器两种 Diff 宿主内**已发出的本地 Git 命令**完成后，对 notice、Revert/Unstage collapse 及 finally 动作刷新的归属。当前只有固定源码可达性证据，尚无本 scope 的真实组件旧业务 red、新 green 或 UI/Git 实端证据。不得把已有 Sources 72 green、lease 静态 peer 或本稿审查签收写成此修复已验证。

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

成功分支的 hide notice 和 collapse 赋值、catch 的错误 notice、finally 的 update 必须各自受**同一**谓词保护。try/catch 内 return 后 finally 仍会运行，故 finally 自身必须复核；不能把“没有可见变化”冒充没有写回。owner 已失效时不触碰后来绑定、空宿主或 disposed 宿主的反馈 DOM/状态，不代其清旧错误，也不写旧 collapse。R5 只签覆盖的反馈写入为0，并结合固定源码分支证明 finally 无可写反馈；DOM setter 零计数不能推出 private update 调用次数为0或内部 collapse 写入次数为0，collapse 行为另由 R3 独立证明。

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
| R5 finally 零回写 | 公共生命周期转换 settle 后，保留实际动作按钮的 style 与 notice 节点，含已 detached 的原引用；在实际写入对象的 style.display / textContent 公开入口观察 completion 窗口。先按下文校准，再清日志、release 命令；失效 owner 覆盖的反馈写入须为0，并有固定源码 finally 分支证明。安装、捕获或清理失败均为资格未达。 |
| P1 当前 owner | clean、unstage、local Stage 的成功/失败都走真实按钮；当前成功仍清 notice，clean/unstage 对应 collapse，失败仍显示原错误且动作不误收起；local Stage 本来不 collapse。 |
| P2 同 owner 反序与 Stage 重叠 | 保留同一绑定两个合法 local 命令反序 release 的正控，继续原 completion 顺序反馈；另须至少在 Panel 同一 ref 上先让 clean/unstage pending，再点实际 Stage DOM 按钮，合法走 local Stage 并完成，最后 release 原 clean/unstage，其完成反馈仍有效。该公开路径实际递增 _stageGeneration，不私改字段或调用 private 方法，也不新增并发仲裁。 |
| P3 仅会话/门变化 | 命令已发、绑定不变，只切 active session，或改变 readiness/connection/读状态并通知公共事件；完成仍按原绑定反馈，closed chrome仍关闭；恢复后不重发/不取消。此为不引入二次授权的正控。 |

R5 的校准须证明观察安装在**实际被写入的对象**上，记录包含**同值赋值**，并将原 setter 正常转发。两宿主 update 在按钮引用存在时均写 display（固定 Pane :385–421 / Panel :403–450）；生命周期 settle 后保留上述真实引用，以当前 owner 或独立已知写入先证明安装、正常转发与同值捕获，再清日志开启 completion 观察窗口，finally 恢复 descriptor。不限定一种具体 instrumentation；仅 MutationObserver 或 DOM 值未变不足以签零写。结论限于已覆盖反馈写入为0与固定源码分支证明；不从 setter 日志推断 private update 调用次数或内部 collapse 写入次数，后者由 R3 的独立行为断言覆盖。

R1–R3 各以两真实宿主独立取证，不合并计数掩盖单入口。Revert=workingTree、Unstage=index，local Stage 使用确实落到 local 的合法 SCM 环境，0 engine unary须记录；不得改 planner 来制造入口。旧源码 red 以固定 736 为 pre-localGit 源码输入，并使用与后续新修复相同的一组新测试；这不代表当前 native 已匹配，必须先由唯一 lane 按 §4 建立匹配依赖/组件产物资格，再另行精确释放取得；若实际结果推翻静态预期，保留原件并退回判断，不改原断言求绿。所有 deferred 在 finally 释放，真实 disposable tracker保持开启，body与meta/hooks/pending/missing分列。

## 4. 实施、验证与验收门禁

1. 固定 be99 draft 已经 root 独立核验七文档身份/全文与保护项，原 Astra 按[规则16](../../docs/DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿)正式只读审查为 C0/I0/M2；root 已采纳两项 Minor，并独立授权本次 accepted 文档修订。§6 记录落实结果；独立 accepted commit 7e2e 已获 root 固定身份核验；后续另授权的源码候选及静态边界见 §7，设计输入预审不代替正式审查。
2. 作者获源码授权后只交两 host 完成反馈门与必要新真实组件回归/主题文档，不自行编译、转译、emit、测试或修改任何旧证据。正式源码另有原Astra独立peer，尤其核同一谓词、finally与ABA，以及未引入session/attempt取消语义。
3. 唯一 lane后续须先按精确 pre-localGit 基线源码，建立与该源码**匹配的依赖和组件产物**，再用同组新 tests 取得纯 localGit 旧业务 red → 新修复 green；不能直接使用当前54fe旧native冒称736基线，不能借现有源码或旧72运行绿补足产物资格。具体临时emit/依赖身份协议须另审、另由root release；不改workspace源码来切old/new，finally恢复原旧native。本方案不订未经审查的运行次数、编译额度或emit范围，当前不做准备/emit。获明确释放后再按固定输入/所有权/全局空闲/恢复边界，运行**完整官方Conversation Pane与Sources Panel两个模块**，保留actual reporters、meta/hooks/pending/missing、每项业务断言及owned-process/finally restoration原件；不要求全量compile或新造验证平台。
4. 完整两模块/meta/hooks及恢复资格足够时，本窄反馈归属不强制额外UI after；只能签 source/真实组件完成反馈合同，**不能称真实Git索引或全UI验收**。lease既定独立after仍必需，其运行/验收优先级与待办不变。
5. 四Sources implemented、lease accepted及其全部runtime pending、PRD/D1387/宽Sources/旧波保持；本稿不借局部签收提升其他状态或抢占运行lane。draft/accepted文档阶段原只允许generator/health/diff与只读保护核验；本次独立源码授权新增四changed TS的createSourceFile-only AST与--no-cache lint，边界见§7，仍不Program/checker/compile/typecheck/transpile/emit/tests/runtime/UI/engine/out/cache/freeze。

## 5. 预研裁定来源与行动入口

root在只读研究后独立核两 `runGitAction`，转述并采纳原 **Astra / architecture_audit** 裁定：现码归属缺口 C0/I1/M0 **仅静态**，上述最小合同本身 C0/I0/M0。Pane input+stageAttemptGeneration、Panel ref+renderGeneration、success/catch/finally同门、同owner completion顺序与session/readiness不失效，以及真实DOM/公共CommandsRegistry测试和条件UI-after边界均来自该消息裁定。本稿按root消息记来源，不编造独立审查报告或raw文件；它们只是最初 draft 的设计输入，正式规则16另见 §6。

复用[Sources看板中的独立local Git子scope](../parallel/active/sources-accept-post-read-authorization.md#local-git-completion-accepted)与[作者检查点](../progress/sources-accept-post-read-authorization-checkpoint.md#local-git-completion-accepted)；不另建日志，不改lease运行工具。


## 6. be99 正式规则16与独立 accepted 修订（2026-10-27）

正式审查对象为 `be99a17cb83fad139bb440902195f90414fcda19`，parent `736171b1abc34e36e4991709240625827b566396`、`src=90d6092dbbca80114db7f55a75e137bb1d7bef76`，plan blob `27ddd8efb4805c58eff7e5d6116149066bbb3024`。root 已独核七文档的 mode/bytes/hash、完整方案、board/checkpoint 追加边界、status 200 行及源树/保护项，再交原 **Astra / architecture_audit** 只读正式审查。审查来源为原 reviewer 消息与 root 转述；没有独立报告文件，不虚构 raw/report 路径。

- **Strengths**（root 转述原文）：“execute前同步捕获，Pane stageAttemptGeneration/Panel renderGeneration异构正确、sameobject ABA/alive/finally明确，handler同步重入/throw不改发送对象；sameownercompletion/sessionreadiness语义保；真实load/DOM/公共registry red矩阵、54fe旧native非736producer及后续临时匹配产物独立release、条件after边界清楚。”
- **Critical / Important**：0 / 0。
- **Minor**：2；root 全部采纳，落实如下。
- **Assessment**：root 核验后采纳并独立授权 accepted 文档修订；不是实现或运行权限。

| 意见 | 本次落实 |
| --- | --- |
| M1：R5 的 setter 零计数需要观察资格与结论边界 | §2/§3 明确实际节点及 detached 原引用、style.display / textContent 实际写入入口、同值写捕获/原样转发的先行校准、生命周期 settle 后清日志围 completion、finally 恢复 descriptor；失败为资格未达。只签覆盖的反馈写入为0与固定 finally 源码分支，不推断 private update 调用次数或内部 collapse 写次数；R3 独立验证 collapse。 |
| M2：两个 local 反序不足以证明 Panel 不误用 _stageGeneration | P2 保留原反序正控，另加同 ref clean/unstage pending → 真实 Stage DOM 按钮合法 local 完成 → 原命令完成仍有效；由公开 Stage 路径实际递增该字段，不私改字段/调 private，不扩并发合同。 |

本节记录 **accepted 文档** 的7e2e签收时点，当时尚无 localGit 源码候选或本 scope 业务 red/green。root 后续独立源码授权与候选见 §7；唯一运行 lane 仍等待明确授权，四 Sources implemented、lease accepted/全部 runtime pending、lease 优先和独立 after 门不变。


## 7. D 最小源码候选与作者静态边界（2026-10-27）

root 独核并接受固定 `7e2ee718e682721e61d5ef4fb1c5f6ccd9f082b9` 后另行授权 D 从 clean7e2e 实施本独立 scope；与 lease 工具准备并行，lease 运行仍最高优先。这里只交源码候选与静态原件，不合回 merge，不动 HEAD7361/lease 工具或共享输出。

生产仅两 `runGitAction`：Pane 在 execute 前捕获 input + stageAttemptGeneration，包含实例/未disposed/store alive；Panel 捕获 ref + renderGeneration/store alive。成功 notice/collapse、catch notice、finally update 同 isCurrent 门；命令 id/resource/次数、入口 planner、Accept、runStage 前置、VM/lease 与其余源码逐字保护，无新字段/epoch、attempt仲裁、session重授权、取消或重发。

两既有 test 文件在原suite内各追加独立 `Local Git completion ownership` suite及必要imports；移除这些新增片段后各自完整还原7e2e父文件。现有旧72/所有旧test/helper/assertions不改。每文件8模板，常量循环静态展开 Pane60 / Panel54，**114仅源码计数，未注册/执行/通过**。真实模型、resolver、DiffEditorWidget及完整progress通过公开DI建立；public registry handler记录id/resource对象与次数，用started/result/returned Deferred隔离实际DOM按钮触发与有界完成窗口。公共setInput/show/clear/dispose与同对象恢复，Pane另input.dispose；不调private runGitAction、不伪造load/paintChrome、不强写私有字段。

R1/R2/R3分别保留clean/unstage核心行为断言；R4/R5覆盖三local动作的resolve/reject与所有生命周期；P1成功清旧错误/失败显错及local Stage不collapse，P2保留反序并加入同ref pending clean→真实local Stage完成→原clean反馈有效，P3仅session/connection/readiness/pairing/read-failed变化不撤销已发命令，闭态chrome仍闭、恢复不重发。R5源码仅在生命周期settle后，保留实际style/notice及detached原引用，先校准同值写捕获/正常转发，再清日志围completion，finally逐项恢复descriptor；安装/捕获/清理失败都使资格未达。当前校准/组件fixture均未运行，反馈写0与collapse行为仍未实证；setter0不推private invocation或内部collapse写次数。

[作者静态原件](../progress/sources-local-git-completion-source-20261027-evidence/INDEX.md)：四changed TS一次createSourceFile-only parseDiagnostics各0；同四文件一次ESLint --no-cache/不fix exit0、0errors/1既有Panel test:637 warning，Node禁compilecache。未创建Program/checker，未typecheck/compile/transpile/emit或跑业务。out/.build/node_modules递归lstat与72.node前后摘要精确一致，六保护plan/JSON及旧证据/工具不动；D元数据不提供736匹配native producer credit。

固定候选commit交root独立身份核验，再原Astra源码peer。plan仍 **accepted / runtime pending**；匹配旧/新依赖与组件临时产物协议、同组新tests旧业务red→新green、完整两官方模块/meta/hooks/restoration仍另审/另释。无需预约lane或准备工具，不能借静态case/旧72绿签运行；lease最高优先及其独立after门保持，不升PRD/D旧项/宽Sources/旧波。


## 8. a227 正式源码 peer 与 I1 窄修订（2026-10-27）

§7及[原作者静态原件](../progress/sources-local-git-completion-source-20261027-evidence/INDEX.md)保持a227候选时点。原 **Astra / architecture_audit** 对固定 `a22776d0f63d117d876f7c66c8d223ebd04eb4aa` 正式源码peer为 **C0/I1/M0**：生产owner门及新增真实组件矩阵无其他发现；唯一I1是两新fixture的命令转发静态返回合同。审查来源为reviewer原消息及root核验/采纳，没有独立raw报告文件。

声明依据是 CommandsRegistry.getCommand 返回默认 `ICommand`，其 handler 的R默认为void；IInstantiationService.invokeFunction返回R，而测试fixture泛型executeCommand<T>声明为Promise<T | undefined>。直接return invokeFunction的静态返回不能据此满足任意T。**本轮没有运行checker，不把该静态合同判断记成实际TypeScript诊断。**

root独立核验并采纳I1后，另授权D以clean a227为parent窄修：`conversationDiffReviewPane.test.ts`旧:482、`sourcesDiffPanel.test.ts`旧:4499各将 `return instantiation.invokeFunction(command.handler, ...args);` 精确替为 `await instantiation.invokeFunction(command.handler, ...args);` 下一行 `return undefined;`。真实注册handler仍完整await，reject继续传播，成功保持无值；无cast/any/helper。两test反向替换后逐字等a227，两生产整文件、所有其他fixture/用例/断言及旧114静态矩阵均保持，不更改完成归属合同。

[本次独立静态原件](../progress/sources-local-git-completion-source-20261027-evidence/i1/INDEX.md)保两test各一次createSourceFile-only parseDiagnostics0与一次ESLint --no-cache/不fix exit0、0errors/1既有Panel637 warning；NODE_DISABLE_COMPILE_CACHE=1。只做AST/无缓存lint与docs/只读保护；原a227证据全部不可变，out/.build/node_modules及72.node元数据前后精确一致。未Program/checker/compile/transpile/emit/tests/out/cache/engine/UI/after，不动54fe/B，不push或合merge。

本次仍是修订候选，固定新SHA先root独核再原Astra窄peer，尚未预记I1正式关闭。plan仍 **accepted / runtime pending**；114仅静态源码计数，所有本scope旧业务red/新green/完整两模块和匹配临时产物资格仍另审/另释，lease运行最高优先与独立after门保持。
