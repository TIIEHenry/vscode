---
title: "Skills 断连草稿保留与异步归属恢复"
type: plan
status: accepted
phase: N/A
updated: 2026-10-28
summary: "保留首阶段断连草稿与89项通过证据，重开修复main已换引擎而renderer仍旧快照的IPC窗口；读写贯穿原expected owner，取消撤CAS授权并保稿。"
---

# Skills 断连草稿保留与异步归属恢复

## 当前重开范围

首阶段实现已提交 `2b604cb9cff686eb1b47e7b54f45007e42e304c0`，完整 Skills 89 项、原项目 noEmit 和主题 lint 通过的证据原样保留。2026-10-28 续查确认该阶段只阻止 renderer 已观察到的换代，未封闭 **main 已切 B、renderer 仍缓存 A** 的跨进程窗口；修订方案已通过独立复审并接受，实施任务重开、继续进行中，不能用原89项或C/F合计634项通过证明完整“新引擎零旧请求”。原提交不改写、不覆盖，现有C/F两槽继续本波任务，不新增字母槽或宣称波次结束。

实际原因是 `UniverseAgentConnectionChannelClient` 异步接收连接快照；调用经 `ProxyChannel` 送到当前 main service，捕获 remote 方法引用不会绑定原引擎。现行 `listSkills()`、`getSkillInfo(request)`、`setSkillEnabled(request)`、`saveSkillContent(request)` 都没有传 renderer 当初的连接归属。main 在处理时可选择 B 的 transport：写入可能落到 B，目录或正文读取也可能把 B 内容误记成 A 的 raw CAS 基线。修复必须同时覆盖 renderer、IDE IPC 和 main，不能只增加 UI 回包检查。

## 问题与依据

默认编辑器 Engine Preferences 的 Skills 是本方案唯一产品入口。以 `d91a7a8d361` 为源码基线，`engineSkillsSection.ts` 的 `applyDisconnectedRefresh()` 在真实断连时调用 `clearCatalogPresentation()`；该方法同时清目录、正文和比较基线。用户正在编辑 USER / PROJECT 技能时，普通连接中断会销毁未保存文字。现有新连接恢复测试只直接切 `published link`，没有经过 `connected=false`，未覆盖这个触发序列。

`toggleSkill()` 还没有 New / Save 已有的连接归属检查。旧引擎发出的启用请求在切换连接后返回，会继续刷新当前引擎并在当前节写出旧操作的成功或失败。dispose 后晚回也缺少同等检查。

产品依据是 [PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性) 的 Skills 补充验收；正文比较写入与刷新约定沿用 [队列与技能正文方案](engine-queue-and-skill-contracts.md) 及 [Engine catalog](../../docs/systems/workbench/engine-catalog.md#2026-10-27-skills-正文保存)。实时目录真断连清空、计数消失的既有合同继续成立；未保存正文不等于 RPC 目录缓存。

## 修复合同

### 1. 未保存正文独立于实时目录

- 清实时目录、选中行及计数时，若当前正文已编辑，保留正文、原引擎 identity、技能名、来源以及已加载的原文比较基线。残稿与当前引擎目录分开持有，不能因新引擎出现同名技能就改归属。
- 保存调用在途时也保留当前正文：用户可能在提交后把文字改回旧基线，此时 `bodyDirty=false` 仍不能证明当前正文已保存。旧保存结果和规范化读回不能越过断连代次改写残稿。
- 保存互斥归属具体操作 token，而不是跨连接的全局 boolean。断连、连接归属失效或 dispose 先保留当前正文，再使旧保存脱离当前编辑器互斥与结果资格；旧 RPC 可以继续在传输层 pending，但不能阻止新 link 的显式 Refresh 或后续保存。每个保存的 `finally` 只能释放自己的当前 token，旧请求 settle 不能解开新请求的锁。
- 断连、配对保持、能力 UNKNOWN / UNSUPPORTED、列表失败、原技能缺席或来源变化时，残稿保持只读，Save 关闭，正文旁说明恢复路径。目录清空不伪造实时条目，不为保稿保留计数。
- 未编辑的干净缓存仍按既有断连合同清除；真正 dispose 释放本组件内存。只保当前面板的在内存稿，不新增 storage、磁盘写入、跨窗口草稿或后台恢复。

### 2. 只有原引擎显式 Refresh 可以恢复写入

- 原引擎的新 link 连接成功只恢复目录，不自动授权残稿，也不自动用新正文替换残稿。当前正文保持只读，Save 关闭。
- 点现有 **Refresh skills** 后，必须在同一具体引擎 identity 下验证目录中原技能名和来源，再成功调用 `getSkillInfo` 取得该来源的当前原文，才更新比较基线并开放写入。刷新不覆盖残稿正文；正文与新基线相同则按真实比较清 dirty。
- 技能消失、来源变化、读取失败、配对保持、连接再次改变或组件 dispose 时，不恢复写入，也不丢稿。随后回到原引擎再次显式刷新可以重试。
- 异引擎即使有完全相同的技能名、来源及正文，也不能为原稿重设基线或开启 Save。选择其他技能或来源分组不能丢弃残稿。继续使用现有正文状态区域与幽灵刷新按钮，不改布局、密度、CSS 或主题 token。
- 编辑器撤销旧操作资格不等于取消引擎端写入。若同一引擎的旧写请求在重连后的比较基线读取之后才实际生效，后续写仍使用引擎 CAS 诚实拒绝冲突；保留新草稿并要求再次显式 Refresh，不把旧结果当成当前保存成功，也不以本地 token 保证跨连接 RPC 的服务器执行顺序。

### 3. 启用开关的异步结果归属

- `toggleSkill()` 发请求前捕获具体 published engine identity 与 link；无明确连接身份不发写请求。
- `ok:true`、`ok:false` 和异常路径均须在回包后及刷新后重验同一连接和未 dispose。旧连接结果不触发新引擎列表刷新、不重涂当前状态，也不改变当前选择或正文。
- 同一有效连接中的成功仍刷新目录并显示 Updated；失败仍恢复权威勾选状态并显示失败。现有请求形状、权限与能力门控不变。

### 4. 贯穿IPC的原expected owner

共享合同由C唯一维护：`common/universeAgentExpectedOwner.ts` 导出 `UniverseAgentExpectedOwner`，其值为只读 `{ engineIdentityId: string; linkId: number }`。owner是IDE内部独立参数，不放入技能业务request/protobuf，不新增引擎RPC，也不由ChannelClient在发送时替换成最新快照。

| Skills调用路径 | 调用形状与owner来源 |
|:---|:---|
| New输入与创建 | 输入打开前捕获owner并沿创建路径传递；`saveSkillContent(request, owner)`，不在确认后重捕另一代owner |
| 正文Save | 从本次保存开始及已授权正文捕获相同owner，`saveSkillContent(request, owner)`；来源/raw比较语义不变 |
| 保存后canonical读取 | `getSkillInfo(request, owner)`沿用该次Save最初owner，不能因保存返回而重捕当前快照 |
| 启用开关 | `setSkillEnabled(request, owner)`使用动作开始时owner，随后目录刷新仍属于该动作，不允许迁往另一代 |
| 目录自动读取与手动Refresh | `listSkills(owner)`使用该次读取开始时owner；读owner只要求明确published身份及读可用状态，不依赖`canWrite()`或pane已为ready，初次loading仍可读取 |
| 选中正文与显式恢复 | `getSkillInfo(request, owner)`使用该次读取owner；显式Refresh的目录与正文恢复保持同一owner，仍验证残稿原engine/name/source后才更新raw CAS |

对本波renderer IPC路径，C负责在分派前拒绝缺失、畸形或与main当前published归属失配的owner；main方法再次校验并捕获transport，校验到实际调用之间不得await。完成、异常、健康状态更新与动态binding降级之前再次复核。只有可信进程内旧调用可保留optional-owner兼容；renderer旧调用不得凭参数缺失回退为当前引擎写入。F不编辑这些共享实现。

`saveSkillContent` 的动态own-property绑定须贯穿owner。旧link的`UNIMPLEMENTED`不得删除新link的binding；`listSkills/getSkillInfo`同样受main owner门约束。F继续沿用能力三态与正文来源门，不把main取消误判为当前引擎API永久不可用。

### 5. main取消到达而renderer仍旧快照时的保稿

跨IPC的失配使用固定、无秘密的`CancellationError`，F以现有`isCancellationError`识别重建后的name/message，不仅依赖`sameWriteLink()`。必须在普通业务失败、成功提示、自动刷新或规范化正文应用之前处理该取消。

- 当前操作被取消时撤销它的结果资格；正文dirty、保存中或已暂停的稿逐字保留为只读残稿，标记比较基线待重读、关闭Save与当前写入口。取消不能把残稿归属改成新引擎，也不能把未验证正文标为已保存。
- 显示中性的请求/连接失效及原引擎显式Refresh恢复路径；不画普通Save/Create/Toggle失败或旧成功，不从该取消自动发起刷新，不宣称服务器未写入或已回滚。A在失效前已接受的写仍按首阶段CAS合同处理。
- 目录、初次正文或canonical读取取消后不接受任何数据、不重设CAS，不因renderer仍缓存A就留下可写chrome。显式恢复必须在真实快照满足原engine归属、且同一新owner下目录与正文验证都成功后进行。
- 每个读取仍受原generation、selection、revision与dispose约束。旧取消若已不属于当前读取/保存token，不得暂停后来新操作、清空新稿或改其提示；旧`finally`只能释放自身token。取消处理本身不能制造第三次并发保存窗口。
- 首阶段选择恢复的幂等判断、空草稿保留、原来源约束和26项回归保持；取消分支不得绕过这些状态机。

## 文件边界与实施

F生产修改仍限定 `src/vs/workbench/contrib/conversation/browser/engineSkillsSection.ts`；F回归限定同域 `test/browser/engineSkillsSection.test.ts`。复用当前正文owner/比较基线及C发布的共享owner类型，避免建立全局草稿服务或把技能放进roster。C唯一负责owner类型、connection接口、IPC分派、C/F node guard、Skill动态binding与平台回归；F不抢这些文件。没有引擎protobuf/RPC变化，不改Sources、visible lease、引擎端或其他主工位WIP。

重开修订先由Astra按规则16分别只读复审并独立提交。C先产出固定共享合同提交；父指定执行者通过真实三路Git合并将该依赖带入F，保留F原实现与原证据，不复制源码文件冒充同步，也不把依赖同步称为产品合入。共享合同未到F前，F不开始生产接线；之后C/F只在各自UI域并行，编译仍唯一车道。

文档先写产品补充验收，再同步 Engine catalog 的行为正文；方案、实施与验证分阶段提交。公共索引、状态和并行看板由父调度统一协调，实施 agent 不交叉编辑。

## 验证合同

所有编译、转译、typecheck 与产物更新只由父指定的唯一编译执行者在编译车道持 `/tmp/vscode-compile.lock` 执行。本槽只改源码、测试和本方案，不启动第二路构建。

1. 对 USER 与 PROJECT 真正经过 `setConnected(false)`：目录 / 计数清空，原稿逐字保留，正文只读且 Save 关闭，断连保存不发 RPC。原引擎换新 link 后仍不能直接保存；显式 Refresh 成功后正文不变，下一次保存携带重新读取的 raw CAS 基线。
2. 保存期间继续输入、改回旧基线、真实掉线：晚到的保存成功、失败与规范化读回均不能覆盖残稿或为新连接授权。旧 save 始终 pending 时，真实断连 → 原引擎新 link → 显式 Refresh 必须成功恢复；启动新 save 后再使旧 save 分别成功、业务拒绝、reject，新 save 的互斥不能被旧 `finally` 释放，第三次并发保存仍拒绝，新稿与比较基线不被旧结果改写。再模拟旧服务器写晚于恢复读取而生效，当前新写收到 CAS 拒绝时保持草稿，可再次 Refresh 恢复。
3. 异引擎同名技能、原技能缺席、来源变化与 SkillInfo 失败不能恢复；回原引擎再次刷新成功可恢复。清空正文也是合法未保存稿，不能因空串丢失。
4. Deferred 开关请求分别以 `ok:true`、`ok:false`、reject 在切引擎 / 同引擎换 link 后返回：当前列表读取次数、选择、正文和状态不被晚结果改变；dispose 后同等无副作用。有效同连接成功 / 失败旧覆盖继续成立。
5. 保留既有 `disconnect clears RPC catalog rows` 与 `leftover body stays after pairing re-select, then true disconnect clears` 的干净 bundled 缓存断言，不把它们改成保留所有缓存。完整 `EngineSkillsSection (E1)` 套件验证不回退已有 dirty 选择、能力三态、配对保持、CAS 和异常清理。
6. 唯一车道先以旧生产源码 / 新回归验证业务断言红，再以修复后生产源码验证绿；记录 source / out 身份、命令与真实结果。运行定向 ESLint 与原 project 约束检查；不把局部检查称为全仓编译通过。
7. 新一阶段以首阶段 `2b604cb9cff`（C为`2f35686b611`）配新测试证明IPC窗口业务红，而非重复d91已证明的断连缺口。C平台回归刻意扣住B快照通知，使用真实ChannelClient/IPC让renderer仍读A、main已B，分别调用本波Skill读写；断言B的transport调用数为0，而非只断言Promise拒绝。补missing/malformed owner、同transport新link、旧拒绝不污染健康、旧`UNIMPLEMENTED`不删新binding及可信进程内兼容。
8. F DOM回归逐项记录New/Save/toggle/list/选中读取/恢复/canonical传递的owner，证明动作或读取中间即使快照getter变新，也不偷换后续请求的owner。初次pane loading允许有owner的目录读取；缺完整owner不发RPC。原确认取消及正常同owner的成功、业务失败仍保持。
9. 在renderer快照仍A时返回跨IPC形状的固定取消，分别覆盖New、Save、toggle、目录和正文/canonical读取：保留正在编辑及空草稿，readonly为真、Save关闭、无旧成功/普通业务失败提示、无自动刷新，raw CAS不被改成B正文。真实同源通知后只能用显式Refresh验证原engine/name/source并恢复，异引擎同名项仍不能授权。
10. 旧读取/保存取消或旧`finally`晚于新owner恢复、新保存开始时到达，不得暂停新操作或释放新锁；旧Canonical的取消同样不能改新稿。保留首阶段完整89项并运行扩展后的完整Skills套件；平台与F验证分开记真实source/out身份，不把首阶段634通过沿用为IPC硬化通过。

新增只读残稿状态需由运行测试核对可见正文、只读属性、Save 门控和真实 Refresh 点击路径。未执行真实默认窗口联调时明确记录，不据源码或自动测试提升 PRD-025 总状态。

## 只读审查与当前状态

2026-10-28 Astra 独立规则 16 首轮只读审查为 Critical 0 / Important 1。已核实并改入 I1：原 `bodySaveInFlight` 同时阻止恢复读取与新保存，旧 `finally` 又无条件释放；本方案改为具体保存 token 的归属、失效与独占释放，新增旧 RPC 始终 pending 时的恢复和旧 settle 不释放新锁验收，并写明服务器旧写晚生效仍由 CAS 拒绝冲突。

同日 Astra 修订复审为 **Critical 0 / Important 0 / Minor 0**，确认 §1 token 独占释放与旧 pending 脱离当前互斥、§2 不误称取消服务器旧写并依 CAS 拒绝、验证 2 的 old pending → 重连 Refresh → new save → old success / refusal / reject → 第三写仍被拦完整覆盖 I1，方案可实施。复审时尚未改生产或运行测试；方案以 `c38973b3301` 独立提交后才进入实施。

## 2026-10-28 实施与首轮运行发现

F 已实现目录与只读残稿分离、原引擎显式 Refresh 的来源 / 原文验证、保存 operation token 独占释放，以及开关写结果的连接归属检查；同域测试新增 `disconnected draft ownership` 26 项动态用例。Astra 对冻结源码只读复核为 Critical 0 / Important 0 / Minor 0，静态审查不替代运行验收。

唯一编译执行者在 `d91` 旧生产与冻结新测试组合中实际得到 **3 passing / 23 failing**，23 项均为正文保留、恢复门控、RPC 次数或状态文字的业务 AssertionError。只刷新新生产后的首轮仅第一个业务用例通过，随后 unexpected-error hook 报 `Maximum call stack size exceeded`，其余 25 项未执行，不能称新实现已绿。原始日志保留于 C 工位 `.build/engine-lifecycle-validation-20261028/F/old-focused.log`、`new-focused.log` 及相应 result JSON。

已按栈核实本次实现的重入问题：`List` 的 `Trait._set()` 即使索引相同也会发事件；残稿无可恢复行时 `restoreSkillSelection()` 无条件 `setSelection([])`，选择监听器又调用恢复，形成递归。修正让恢复只在当前索引与目标不同的时候写选择（空选择与单行都做幂等判断），不抑制真正的用户选择，也不删除或弱化任何用例。26例逐字保留，补修独立复核C0/I0/M0。

## 首阶段验证与集成边界

唯一车道只刷新补修后新生产，新增26项及完整 `EngineSkillsSection (E1)` **89 passing / 0 failing**，含官方meta；未重复已成立的旧红。原项目noEmit 0诊断，两TS ESLint 0 errors / 0 warnings。最终生产SHA256 `9d5f00350454f439c2e767e4aaa51968a9a100941d6bc81be984343bf0bd3b24`，测试SHA256 `9c107bb93461bd6eddea91fc731a673fef60ff2daf88340b87367e669393f4a2`。命令、原失败与source/out身份见[验证证据](../progress/engine-lifecycle-recovery-2026-10-28-evidence/skills-verification.md)。

上述实现与自动验证只证明首阶段断连/已观察换代合同，未证明通知滞后的IPC窗口；实施任务已重开，不作为最终合入候选。未执行真实引擎默认窗口联调，不升PRD-025；没有新增持久化或跨窗口恢复，不覆盖其他在途WIP。

## IPC硬化修订审查与实施状态

2026-10-28，Astra已裁定main已B/renderer仍A窗口确属本波当前安全合同缺口，并批准读owner独立于`canWrite`、固定取消识别、撤CAS授权保稿及原owner canonical读取语义。本稿据此修订，并完成规则16独立只读复审：

- **Strengths**：真实延迟快照IPC的因果与首阶段证据界限明确；七类调用的owner来源完整，读owner独立于`canWrite`，canonical与Refresh保持原owner；取消识别、撤CAS授权、只读保稿以及旧取消/旧`finally`不干扰新token均有明确合同，且没有误称服务器未写入；C为唯一共享writer、真实三路依赖合并、F文件边界与唯一编译车道明确；真实IPC的B transport调用数为0及DOM owner/取消覆盖完整。
- **Critical 0 / Important 0**。
- **Minor 1，已修正**：`generate-docs-status.py`的plan状态闭集仅为`draft`、`accepted`、`implemented`，不以任务执行状态扩展parser。本方案frontmatter由重开时误用的`in_progress`（父协调生成器时临时改为`draft`）修正为已复审接受的`accepted`；正文同步表述为方案已接受、实施任务重开。任务的占用/进行中状态留在行动层进度和看板，不改parser。
- **Assessment**：行为与架构合同通过；机械元数据修正后，可按父调度独立提交方案。C固定共享契约提交通过真实Git三路合并到F后，才开始源码接线。本次修正不需要新增架构复审。

本次复审修订时只改本方案，F源码、原89项测试、out及首阶段提交均未改动，尚未编译、测试或提交。共享合同仍待C固定提交及Git依赖同步；后续实际进度见行动层，不以该复审时点宣称IPC缺口已修复。
