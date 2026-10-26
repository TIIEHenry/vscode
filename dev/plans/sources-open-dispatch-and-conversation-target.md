---
title: "Sources 打开分派与准确 Conversation 目标"
type: plan
status: draft
phase: M7
updated: 2026-10-27
summary: "D1387 M01增量待规则16：Conversation真实Pane按钮丢来源导致Move no-op；拟显式input/group/Pane来源与注册part快照、关闭前复核及局部错误恢复，保留原完成/关闭代数"
---

# Sources 打开分派与准确 Conversation 目标

## 1. 问题、证据与签收边界

**2026-10-27 M01增量审查边界**：原accepted范围与已签收实现历史保留；本轮仅新增§3.5/§4.4及对应SSOT说明，frontmatter暂置draft等待原Astra规则16（plan生成器只接受draft/accepted/implemented）。父明确冻结验证source tree `92801b513611ed3ae1ba36862a58131c609f6aa2`、native producer `8b4ddaa`，当前纯docs后继`4173b3fea640124a50cbdaa6aa7ceb7892274641`；J从clean且祖先成立的`24a3850`仅Git fast-forward至该后继，没有复制或刷新out。D真实默认编辑器after发现Conversation内真实“Open Diff in Preview”按钮无操作，普通Review直接创建的Beta shared比较同样复现；这不是仅move生成input的特殊情况。D报告当时全局activeEditor为空、全局group0，而真实Conversation comparison11仍在、Preview为空、无UI错误。原件在D自有`.build/d1387-after-sources-audit-20261026/steps/M01-*`，J仅按父转交事实与当前源码核对，没有复跑窗口或更改D材料。Astra已将其裁定为原三owner/Move合同内Important，必须定向补修；本稿不宣称M01或其余after已全闭合。

范围是默认编辑器的 Sources Changes / Review → Preview、Conversation、Panel 打开及移动合同（[PRD-005/009](../../docs/product/requirements.md#prd-009-changes-与-diff)、[ADR-005](../decisions/005-changes-diff-owner.md)、[Sources SSOT](../../docs/systems/sources/overview.md)）。不开发 `src/vs/sessions/`。D1387 保持 open，PRD 状态不升；原方案与custom预pin澄清已有下方规则16，本轮§3.2同tuple宿主/并发歧义澄清也经D规则16 C0/I0签收，独立方案`bf50c66`后新边界源码及29项回归已写。原两项Important补修`89f3e5a6a17`与测试harness`4f7e49d`/`65d2288`已交唯一车道；D/Astra后确认的同tuple另组后台宿主与并发归因补修仍须唯一车道运行、新源码独立peer及非作者after。本作者没有运行或修复后验证。

[真实 Git before](../progress/default-editor-contract-audit-2026-10-26-evidence/d1387-before.md) 有两个不同根、同名文件与不同两侧哨兵，真实内置 Git provider，断连、零 Git RPC、fixture HEAD/index/worktree 未变。J 初轮只读审查及 C1–C6 的结果是 before，不能充当作者实现后的 after。

已证两条独立机制，均在同一已支持的 owner × slot 合同内：

1. **Preview 未执行命令**：Git 的 `vscode.diff` 在 extHost 已转换成资源上的 `_workbench.diff` DTO；`resource.open()` 只查另一个自定义命令 map，因此旧 Sources 分支 resolve<void> 却不打开。Review 错误标已审阅；先有 Beta diff 时打开 Alpha 仍留下 Beta。同 DTO 直接执行能打开相应真 diff，证明资源有效，但这不是 Sources 正常流程通过。
2. **Conversation 的准确目标被拒绝**：Sources 已按活动 session 找到准确 part/group；空组 replace、newTab、同条 reveal 经 `openEditorInSlot → EditorService → findGroup`。Debugger 实际记录 Alpha preferred9 属 untitled[7,9]、Beta preferred10 属 session-102[8,10]，均 `conversationExplicitOpen=false`，group9/10 被改为 main0 后拒绝。无 slot 公共 Open Selected 成功；已有 diff 后 replace 另一条 plan=replace 成功，只有 plan=open 路径失败。

状态附带缺口：公共 Open Selected 真成功后旧打开错误有时仍留着；不得仅拍 diff 忽略错误，也不得用旧错误否定真实可见内容。

设计已由 Astra 两轮只读裁定（2026-10-26）：复用官方 SCM open/diff 分派，局部校正 finder 对有效具体 Conversation 组的承认；三 owner、两 slot 与既有围栏/void 合同保留。可复核摘录随 before 入库。本正式稿的独立规则16结果见§6。

## 2. 不变合同与取舍

| 选择 | 原因与代价 |
|---|---|
| Sources helper 分派官方 API open/diff；custom 保留 resource.open | 复用 `scmViewPane` 已有模式，保留扩展语义；代价是 ICommandService 必须接到全部真实调用方。不得改 extHost map、重建 Git 参数、先 command 再 resource 兜底。 |
| finder 接受 typed 白名单 + 显式有效具体 Conversation 组 | 准确组已经由 Sources 选好；保留公共 slot 算法和 session 身份。代价是公共路由影响面，必须有真实 EditorService 和围栏负控。 |
| 不复制 Sources 私有 slot 算法、不改用 Conversation side token | 前者与共享 helper 漂移；后者重新选择最近活动叶，丢失当前准确 session/group。 |
| 各 API 按自己完成合同处理 | 内置命令/custom.open 是 void；直接 editor、Conversation、Panel 有可观察结果。不能从 void 发明通用可见成功探测器。 |
| 现有 generation 与局部状态通道清打开错误 | 当前成功修复反馈；stale 不覆盖新结果，不清除读失败/写失败。无新全局状态服务。 |

不迁移设置/存储，不重置布局，不改 ADR 的 owner 选择。合法 provider 显式 options 仍优先；可能改变的是此前被错误重定向的准确 Conversation 具体组开始正常生效。其他 excluded part 不得到新授权。第三方 provider 内部吞取消、外部打开和未知 void 结果仍不可由客户端统一识别。

`vscode.changes` 也能被 extHost 预转换，但当前官方 SCM open 分支只特判 open/diff，本轮没有它的公共运行证据。保留现状并明确未支持扩展范围，不泛化执行任意 resource.command，不宣传所有 SCM API 命令已修。

## 3. 生产改动

### 3.1 一次 SCM dispatch 与真实依赖

在 `contrib/sources/browser/sourcesChangeEntryOpen.ts` 的公共依赖包增加必需 `ICommandService`，接入：

- Changes 的正常行/Enter、右键另一种槽（`sourcesChangesList.ts`）；
- Review 正常行/Enter、右键另一种槽（`sourcesReviewList.ts`）；
- `sources.review.openSelected`（`sourcesReviewCommands.contribution.ts`）；
- Preview/Conversation/Panel move 公共动作构造的依赖（`sourcesDiffActions.ts`，含 viewTitle 入口）。

使用既有 `API_OPEN_EDITOR_COMMAND_ID` / `API_OPEN_DIFF_EDITOR_COMMAND_ID` 常量。只在资源携带相应 DTO 时执行 `commandService.executeCommand`；否则且仅否则 `await resource.open(preserveFocus)`。一次用户动作只选择一个分支执行一次，拒绝原样向现有状态处理传播。

保留 DTO 的既有 arguments/optional 槽，open context 放在官方位置：open 第4参数、diff 第5参数。context 提供 `editorOptions.preserveFocus/pinned`（slot=newTab 对旧预览的保留语义照旧）及必要 source；不追加通用布尔。官方 mixin 让 provider 的显式 column/options 优先，测试锁定 pinned:false/preserveFocus:false 等覆盖，不在后续 pin 中反向覆盖它。

### 3.2 slot、打开身份与局部副作用

slot 仍包住同一个 SCM dispatch；newTab 保留旧预览，replace 在真实新目标打开后替换当前，已开相同 input 可以 reveal。不要用 input 对象是否变化作为成功条件。

SCM void 只说明委托正常完成。分派后的 identity、pin 新 input、replace 关闭旧 input 都须核对实际比较与宿主；不能把仍留着的 Beta input 写成 Alpha 的 Sources identity。API diff 必须按资源 command DTO 的实际 original / modified 有序双侧匹配，不能用 quickDiff original 或 sourceUri 单侧替代；API open 只匹配相应单资源 input 与 DTO URI，不命中包含同 URI 的另一个 Diff。custom 只依据成对 multiDiff URI 或已记录的同一 scmResource / groupId 可信身份。找不到可核对实际 input 时，不做这些分派后副作用；仍保留合法 void 完成，不二次 dispatch，也不发明可见成功探测器。

API DTO 分支只用 context 的 pinned 默认值保留 newTab 旧 preview，不预先 pin 当前旧标签；provider 的显式 column、pinned / preserveFocus 等 options 仍优先，包括 pinned:false。provider 另列、后台打开或 reject 不得因 Sources 的预先处理 pin/close 当前不相干标签。相同修改 URI 的 HEAD→worktree 与 index→worktree 是不同比较；先前 active 旧比较不能遮住 provider 在另一组实际打开的新比较。

**custom newTab 保留既有预pin窄例外。** custom.open 只有 preserveFocus 参数和 void 完成合同，不能注入 pinned / column；若先让未固定的新 input 替换旧 preview，事后 pin 无法找回被替换的旧标签。因此仅 custom + newTab 在调用前仍 pin 动作发起组的旧 preview，以维持原有保留语义。custom no-op、reject、另组或外部打开时也可能已 pin 这个旧 preview，这是既有兼容成本，不宣称零 pin 副作用。该例外不适用于 API，不授权分派后凭单侧 URI 写 identity、pin 新 input 或关闭旧 input；custom 的 preserveFocus / await / 拒绝传播与单次调用保持。

**宿主候选观测与Sources重叠歧义保护（本轮规则16已签收、待实施）。** 完整比较身份只能证明内容相同，不能证明provider选了哪个宿主。A/B两个组可以各持独立input且有相同有序双侧或单资源URI；provider显式column并以`inactive:true`或`activation:PRESERVE`在B打开时，A仍可active。不能按active→requested→visible的先后次序认领A，也不能只把所有多匹配永久跳过，遗漏已有准确provider目标支持。D本轮指出候选事件没有operationId：R1等待期间可能收到另一个Sources R2对同tuple的will，即使只有一个最终input也不能天然归因R1；Astra定级Important，须加入下面有界保护。本轮局部实现如下：

1. 在任何listener注册或SCM dispatch前，同步捕获一次resource command id与参数数组，保持原参数值/optional槽及provider options；完整身份匹配器、并发key和实际`executeCommand`都用同一份捕获，不在await后重读可变`resource.command`/arguments。API file key是类型+完整单URI，API diff key是不同类型+有序original/modified完整URI tuple，包含query/fragment，以结构化序列编码避免分隔符碰撞。custom仍只调用自己的open一次，匹配仍限成对multiDiff或已有resource/group可信身份，不能用其command造API key。
2. 用模块内`WeakMap<IEditorService, Set<本次观察记录>>`保存同一服务实例的活动Sources委托；不新增服务或全局队列。开始单次SCM dispatch的观察scope时同步登记，再注册现有`IEditorService.onWillOpenEditor`局部listener。相同完整API key的两个活动记录相互标记`ambiguous=true`；不同API tuple/file-diff类型互不冲突。所有custom都按wildcard与同服务全部活动API/custom冲突，因为无法约束其真实打开目标。只标记歧义，不阻止、串行化或重派任何dispatch。
3. ambiguous是每次操作自己的粘性事实：一次重叠后直到该操作自己的`finally`退出都不能改回false，另一方先resolve/reject并移除不得替仍pending的一方解锁。三操作传递重叠中，尚活动的歧义记录仍参与后续冲突登记；新记录与它直接同key或wildcard冲突时也永久标歧义。finally仅移除本记录并及时dispose本listener，空集合可从WeakMap移除；reject原样传播且不能泄漏登记/监听。登记/监听scope覆盖单次SCM dispatch的await及紧接的同步宿主核对，在本次后置动作开始前finally清理；不把已经完成的委托和后续await close混成新一轮可追溯归因。
4. listener只收集本scope中匹配的请求input与group id/当前group对象，作为候选证据；不宣称事件天然属于这次委托，不从事件发起打开或驱动另一个控制流。await正常完成时，若本记录ambiguous则跳过全部后置identity、新input pin及replace close；仍返回合法void的true。custom既有newTab预pin成本保留，不回滚，也不把它计为被允许的后置pin。
5. 未被Sources重叠污染时，重新用`getGroup(id)`验证候选group仍为同一有效对象，检查其全部`editors`中的真实成员仍未dispose且完整身份匹配。will不是成功：没有实际成员不能写身份。`EditorGroupModel`会把新请求input规范成已开的同`matches`实例，所以只允许`actual === event.editor || actual.matches(event.editor)`的唯一真实成员（由actual对event方向匹配）；不能要求每次input对象变化，也不能把临时请求对象当已开标签。重复同group/成员去重后，仅一个可验证候选宿主可优先于其他旧active同tuple；相关will存在但最终无有效成员或有多个候选时，不回退认旧active/requested。
6. 只有未ambiguous且完全没有相关will观测时，才从当前`editorGroupsService.parts[].groups`的全部`editors`查找可信fallback，不限visible pane或active tab；每个group须`getGroup(id)`同对象有效。仅一个完整身份候选可用于原已开reveal/custom可信记录兼容路径；零个或多个候选不猜。没有可验证的组服务时不从裸activeEditor补造宿主。不得再次调用可能创建组的`columnToEditorGroup`推算目标，provider实际解析/路由仍由原handler负责。
7. 仅对上述未歧义且核对完成的真实成员写本次Sources resource/group identity，custom按原合同pin新成员，replace只有实际宿主仍为动作发起组才关闭仍在该组的旧input。API provider显式pinned/column/inactive/activation等保持优先；custom newTab预pin窄例外原样保留，不借观测扩大custom可信比较身份。无可用候选/歧义只省略这些后置副作用，void完成仍true、reject仍原样。

这项保护只约束同一IEditorService实例内Sources委托之间可能混淆的重叠；非Sources同tuple外部打开仍没有operationId，不能宣称已证明其因果归属或任意窗口并发安全。官方API/custom的void合同不能暗改；真实inactive成功本来就可返回undefined，也不能把pane返回值当万能归因解法。不开全局串行、不拦截EditorService、不新增RPC。

测试分别覆盖 API open/diff 与 custom、newTab / replace、不同资源与同 modified 不同 original 的旧 input、同条 reveal、provider 指定列与背景/保焦点、reject。API options 优先级须经过真实官方 handler；custom 预pin成本与没有可信身份时的后置零副作用分别断言，不能只 stub 一个 activeEditor 变化就宣布真实打开。

本轮必须增加真实官方handler与组模型/公开EditorService事件归属回归：API file/diff × newTab/replace，A/B同category、相同完整tuple、独立input与不同SCM资源/组身份；provider明确指定B并用`inactive:true`或`activation:PRESERVE`保留A active，断言A原identity与tab不动、B实际新/规范成员得到本次identity，后续move-ref仍归准确SCM组/resource。覆盖B inactive tab不在visible pane、已开B成员reveal、will后未开/组被移除或同id替换、多个实际观测与无观测多候选。fallback歧义必须metadata/pin/close全不改且voidtrue，不能用“永远跳过多匹配”代替B正例；custom成对/既有可信身份与预pin成本继续独立覆盖。断言用小投影避免失败报告遍历SCM getter/服务图，官方startup setup保持一次性suite生命周期与per-test leak检测。

并发回归另须用受控公共Promise屏障证明：R1的g1同tuple委托pending且最终ABORT/no-op，R2的g2在B真正打开成功；R1先settle和R2先settle都不能让R1把B写成g1，R2允许因重叠一并跳过metadata，各dispatch一次且无后置pin/close。覆盖同key三操作传递重叠、custom-wildcard×API/custom两种启动顺序、custom原预pin成本、不同API tuple（含file/diff类型）并发正控、不同IEditorService实例隔离、reject后finally清理并使下一次顺序打开恢复正常，以及resource.command/arguments在await期间变化仍按同步捕获DTO的key/分派/匹配一致。不能仅以单项最终input唯一来替代Sources重叠检查。

无 SCM 的直接 Preview diff/file 路径返回 pane/undefined：将 undefined 显式返回 false，不再由 Preview dispatch 无条件 true；用适用于所有 owner 的打开未完成文案，不把它写成 Conversation 载入失败。此规则不外推到 API command/custom void。

### 3.3 finder 只承认有效准确目标

在 `services/editor/common/editorGroupFinder.ts` 局部扩展现有判定，允许输入仍限现有 typed `ConversationChatInput` / `ConversationDiffReviewInput`：

`允许 typed input AND（既有 Conversation token OR 显式具体目标确为当前有效 Conversation 组）`。

具体目标必须同时满足：

- 对象目标与当前 resolved group 为**同一对象**，且这个对象实际存在于 `conversationParts[].groups`；伪造 Proxy/旧对象即使 id 相同也不通过。
- 数字目标是非负具体 id，既有 `getGroup(id)` 确实解析到同一个 resolved group，并属于上述当前真实成员；未解析 id 回退的 active/main 不算显式 Conversation。
- 不借 `excludeFromGlobalEditorAggregation` 授权：该旗还可能属于其他 part。现有 `isGroupInConversationPart` 的旗判断应改成真实成员关系或由局部窄谓词替代，复用既有 explicit-target 检测，不增加导出或测试专用入口。

finder 保留已选的准确 group，不重新选第一叶/最近叶，不新增 session pin，不改变全局聚合。普通 file、untitled、ChatEditorInput、普通可写 Diff 对 token/具体目标仍路由 Preview；无目标的 Conversation input 仍拒绝。主 part 错误目标、其他 excluded part、移除/过期组、伪造对象不获放行；原有 token 正例和根 tab 不可关闭/替换保持。

### 3.4 当前打开错误恢复与完成语义

沿用 `sourcesOpenStatus.ts` 的 Review 共享 generation（list + Open Selected）和 Changes 独立 generation。通过现有 host/status 通道区分当前打开错误与 snapshot 读失败/Changes 写失败；局部记住打开错误所有权，不凭文字相等或无条件 `setStatusMessage(undefined)` 清别的错误。

当前 generation 的 true 清自己的旧 open error；false 写通用打开未完成；reject 写对应错误；stale/旧 generation 不改任何新状态。Review 的 list/右键/Open Selected 都走同一个恢复门；Changes 不修改 Review 进度。保留 read-failed/pairing/KEEP 门、Conversation load fail/pending、Panel false 与已有 stale 行为。

| 返回/拒绝 | Review 完成含义 |
|---|---|
| API open/diff 或 custom.open 正常 resolve<void> | 保留委托完成兼容语义；不把 undefined 当失败，不声明已观察到 pane。真实内容由独立 after 验证。 |
| 上述委托 reject（含实际传播取消） | 不标审阅、不二次 dispatch，现有失败/取消传播保持。 |
| 直接 editorService/slot undefined；Conversation 无 pane/load fail/pending；Panel false | false，不标；适用的打开未完成反馈。 |
| helper 明确返回 stale | 不标审阅、不写打开状态，维持已有结果门。 |
| 旧 open-status generation | 只阻止旧操作写较新的打开状态；不从该代次自行推广成一切旧 void 委托都不标。Review 仍按捕获 entry 与既有 write/pairing 门处理委托完成，不新增 session pin 或通用取消保证。 |

### 3.5 M01：Conversation Pane 的 Move 显式来源（本轮增量，待规则16）

#### 已核源码与问题边界

`conversationDiffReviewPane.ts:198–200`的真实按钮无参数调用`sources.diff.moveToPreview`；`sourcesDiffActions.ts::registerHostedDiffMove.run`忽略命令上下文；`sourcesDiffRefHelpers.ts::resolveMoveHostRef('editorTitle')`只读全局`editorService.activeEditor`，`captureMoveHostClose`又独立读一次全局input/pane/group。`EditorParts.getGloballyAggregatedParts/activePart`明确排除Conversation part，因而真实按钮虽在comparison Pane内，命令可看到空全局active或另一个Preview。现有把Conversation input直接放到mock全局active的测试仍有价值，却不能证明真实Pane入口。

本轮修调用来源和来源存活验证，不改Conversation全局聚合、finder授权、目标owner/slot选择或SCM委托观测。Panel→Preview、Preview→Conversation、Panel→Conversation已由D报告真实正例；这些与既有viewTitle语义须保留。SCM group字符串`ref.groupId`、内容的`ref.sessionId`、Conversation宿主`part.sessionKey`是三种不同身份，不得互换。PRD-005/009既有三owner/Move合同不变，不新增需求或升产品状态。

#### 单次来源捕获与关闭

1. **Pane发明确来源**：按钮在点击时从真实`this.input`与`this.group`同步取得来源；只接受`ConversationDiffReviewInput`，以窄typed来源kind连同原input对象、原`IEditorGroup`对象及原Pane对象交给现有registered command。Pane已有公开`input/group`，不能把资源URI、数字id或“最近活动Conversation”代替实际来源。该本地typed参数与可序列化的上游`IEditorCommandsContext`分开，不把Pane对象塞入后者或发到extension host。
2. **命令转交而非丢弃上下文**：`registerHostedDiffMove`把该明确来源传给公共helper；同一入口同步解析ref与关闭目标，得到一次内部capture，不能两次读global active来拼来源。若从原生EditorTitle/EditorTitleContext进入，按真实`IEditorCommandsContext`的groupId/editorIndex在入口解析被点击编辑器一次，再捕获实际input/group对象；保留原生context可序列化合同，不复用会按URI/全局active/最近列表兜底的通用resolver。无显式参数的既有程序调用可保留原global来源兼容路径；一旦提供明确上下文却无效，必须直接无目标返回，不再fallback到global、其他叶或Panel。
3. **Conversation存活身份**：入口从当前`editorGroupsService.conversationParts`中查到确实含原group对象的注册part，捕获该part对象及当时`sessionKey`；要求`getGroup(group.id) === group`、part仍为真实注册成员、`part.groups`确含同一group、input未dispose且`group.editors.includes(input)`。Pane来源还要求`pane.group === group`、`pane.input === input`且该group的实际active Pane就是原Pane，禁止伪造同id group、同URI/matches的另一input或过期Pane。用严格对象成员判定，不从excluded旗、相同tuple或内容sessionId推断宿主。
4. **ref与close共用capture**：从上述实际input调用既有`resolveSourcesChangeRefFromEditor`，保留完整URI、准确SCM资源/组及内容身份。capture同时绑定原input/group/part/sessionKey及必要Pane身份；成功分派后的全局焦点改变或另一个叶变active不能改写该关闭目标。close前再次核验真实part/同sessionKey、同group对象、未dispose的严格input成员，以及Pane仍指同input；来源失效则只跳这次关闭，不关闭同id重建组、同URI的新input、别叶或全局active。优先对已核原group调用公开`closeEditor(originalInput)`；若继续用editorService，须先证明它解析的仍是这一group，不能仅按id关闭。
5. **失效与既有完成代数分开**：入口明确来源无效时零dispatch/零close/零pin/零identity，不借此制造新的失败后关闭策略。合法capture已分派后，继续保留现有helper的boolean/`'stale'`/undefined及API/custom委托void语义：open-before-close，原true/false/`'stale'`完成后的关闭规则不改，缺Conversation leaf异常仍保源，其他异常仍按既有规则尝试关捕获源；只是每次close受上述来源仍live的复核约束。不得改成所有失败都保源，也不增加串行、全局cancel、session重选或新服务。Panel viewTitle的既有ref/clear策略不在本增量重设计。

#### Pane局部反馈

Pane按钮的async操作捕获自己input/组、当前render代次及局部move尝试代次；registered action对这个内部来源透传既有helper结果，使Pane能区分当前true/false/`'stale'`/无目标，不将合法API/custom void resolve当失败。当前true只清自己上次move错误；当前false或可归属的无目标用既有通用“打开未完成”信息，reject用既有打开失败信息。仅原Pane仍存活、同input/组/render代次且尝试仍当前时可更新该Pane notice；`'stale'`、旧attempt、clearInput/dispose/换input后不写新Pane，错误也不被归到另叶或当前Preview。不得顺带清比较载入、读/写失败或其他notice；局部错误所有权沿用现有状态通道，必要时加局部来源标记，不引入全局状态服务。

已有EditorTitle/ViewTitle通知策略继续保留，内部Pane的错误在本Pane显示，不新增重复toast。仍处理catch-path自身抛错，不能删掉已有“无unhandled rejection”负控；该负控可改接真实失败路径，但不能只靠`onUnexpectedError`代表用户可见反馈。

## 4. 精确 red / green 与验证责任

J 只写源码/测试、静态 lint/diff/docs 检查，**不编译/transpile/typecheck/写 out/watch/跑依赖 out 的测试**。父安排唯一 merge 车道按不可变 commit 串行执行；以下均是待执行清单，不计通过。

### 4.1 必须击中旧生产的 red

- **I1**：真实形状的 open/diff DTO（包括 optional 槽），resource.open 模拟旧行为 resolve<void> 的 no-op。旧生产在“command 没有执行”业务断言 red，而不是用 stub.open 被调用当成功。新生产 command 恰一次、resource.open 零次；custom 对照反过来。
- **I2**：复用 `conversationEditorFence.test.ts` 的真实 parts/EditorService harness，通过公共 `findGroup` 与真实 `EditorService.openEditor` 打开允许 typed input 到准确具体对象；旧生产在错误改投/拒绝处 red。数字 id 也覆盖；不能只 mock openEditor 回 pane。
- **状态/直接返回**：当前失败→公共成功清旧 open error，旧成功/失败晚到不覆盖新 generation；直接 Preview undefined 不认 true。保持旧读/写错误并独立断言，不以源码字符串扫描作行为证明。

### 4.2 最小目标测试面

优先扩现有 `sourcesReviewList.test.ts`、`sourcesChangesList.test.ts`、`sourcesDiffRefHelpers.test.ts`、`conversationEditorFence.test.ts` 与必要 `editorService.test.ts` / 既有 slot 测试；仅当一个独立行为套件确实更小清晰时才分新测试文件。不新增测试专用生产 API、不用 any/unknown/never 宽 cast 绕诊断、不镜像生产算法。

| 范围 | 必须的 green / 负控 |
|---|---|
| SCM dispatch | open/diff 两常量、slot/无 slot、preserveFocus true/false、pinned、provider options 优先级和正确参数位；custom resolve/reject、各一次、无兜底。 |
| identity / slot | API newTab以默认pinned新input保留旧、provider显式options仍优先；custom newTab预pin窄例外与no-op/reject/另组成本；同modified不同original/不同资源旧input不记新identity；未歧义时A/B同tuple的B候选/真实成员优先、inactive tab与规范实例reveal、准确move-ref；will未落实/失效组/多候选及无观测多候选均后置零副作用；provider列/inactive/activation；direct undefined false。 |
| Sources重叠歧义 | 同service同API key双方sticky ambiguous直到各自finally；g1 pending最终ABORT/no-op与g2真开B的两settle顺序、三操作传递；custom wildcard×API/custom两启动顺序及预pin成本；不同API tuple/type和不同service正控；reject清理后顺序恢复；同步捕获DTO用于key/分派/匹配。只保护Sources间已定义重叠，不声称外部同tuple因果安全。 |
| 真实调用方 | Changes/Review 行、Enter、右键另一种、Open Selected、各 move 入口都接 commandService；move 保留缺失 Conversation leaf 不关闭源宿主的既有合同；其他 false/stale 后的既有关闭策略已有测试锁定，本刀不改写为所有失败都保源，不顺手扩独立缺口。 |
| finder 正例 | 允许 typed chat/review + 当前真实对象/有效数字；准确 part/session/group；已有token；隐藏组恢复与根保留。 |
| finder 负控 | file、untitled、ChatEditorInput、普通可写Diff × token/对象/id；无目标；错误main；非Conversation excluded；未解析id；移除组；同id伪造/过期对象。 |
| 完成/恢复 | command/custom reject不mark；Conversation fail/pending、Panel false、stale；当前成功清自己的错误、保留读/写失败；Changes不mark；合法void不冒充pane。 |

### 4.3 非作者真实默认编辑器 after

父另派非作者，使用唯一 merge 新产物与独立空 profile/Xvfb、自建两真实 Git 库，不写用户仓库、不连在线引擎/登录、不实际 stage/revert/checkout。自己的 before 不能当 after。采样源 HEAD、产物摘要及 Debugger 五模块 URL/hash/副本（必要时新增依赖模块）；不宣称全 out 同构建。

1. 两库同名 shared.txt/不同 baseline 与修改哨兵。默认 Preview：Review Alpha 鼠标/Beta 真 Enter、右键另一种、Open Selected；Changes 先种 Beta diff 再开 Alpha（鼠标/Enter），完整 URI + 实际两侧文本 + 宿主 + 焦点 + pin/close/标签 + Reviewed；旧 input 不被改身份。
2. Conversation C1/C2：首次空组 replace、新建 newTab 必须真成功、不留空 split；准确叶/root/只读保持。C3 无 slot公共正对照、C4 replace另一条、newTab/同条reveal继续通过；另一叶最近focus再选目标仍精确。
3. Panel 同行两侧、读态、原Conversation不被误接管；move Preview→Conversation→Panel→Preview 及相关 viewTitle入口，完整身份与源标签关闭行为按既有合同。
4. 失败后正常成功清旧打开错误；stale不覆盖新错误；没有新的假已审阅。无引擎0 RPC，fixture HEAD/index/worktree前后相同。不能以命令参数、getter或DOM个数代内容验收。
5. 迟到/切换此前夹具失败仍是未覆盖；若本波补，用真实公共服务取得依赖后的受控Promise/加载事件，不跨await保留ServicesAccessor、不改Sources私有状态。未跑不宣称异步总合同已闭。

### 4.4 M01增量验证映射（待运行）

| 边界 | 必须的行为证据 |
|---|---|
| 真实入口旧red | 新回归必须点击真实`ConversationDiffReviewPane`按钮，经真实registered command→公共helper→真实默认EditorParts/Conversation part/group；全局active为空时仍应打开该Pane的准确比较到Preview并只关闭源比较。旧冻结src928的生产必须在未dispatch/Preview缺失/源未关闭的业务断言red，不能以stub command记录参数或把Convo塞进global active替代。 |
| 全局干扰与多叶 | global active为无关Preview，A/B两个Conversation owner含同名或同完整tuple、独立input/SCM身份；点击B只移动B，A及无关Preview身份、根tab与组不变。原生EditorTitle和EditorTitleContext显式group/index也覆盖被点来源，已有viewTitle Panel正例不变。 |
| 入口失效负控 | disposed input、Pane已clear/换input、input不再是严格组成员、group移除/同id重建、part注销/同sessionKey另part、来源kind与input类型不符，均不能fallback到global或另一叶；零额外open/close/pin/metadata。明确上下文失效与无上下文兼容路径分别断言。 |
| await后关闭复核 | 通过公开command/open依赖受控Promise，在目标已合法开始打开后移组/注销part、替换原input、同URI新input、源Pane换input；目标结果按原合同返回，失效源不被close。只改变global焦点/激活另一叶而原来源仍live时仍关闭原捕获比较，不能误关新active。 |
| 完成/错误/恢复 | 分别锁原true/false/`'stale'`、缺leaf异常保源、其他reject既有关闭及API/custom void完成语义；新增检查局部错误当前失败→当前成功恢复，旧失败/旧成功不覆盖新attempt或换input后的Pane，不清其他读写/载入notice，无unhandled rejection。不得用“全部失败保源”取巧。 |
| 既有覆盖与产物 | 保留J原29项、完整386/原R1/R2与三owner/slot/finder/错误恢复相关套及当前已有source-scan；source scan不作M01业务red。作者只源码/AST/lint/docs，唯一lane在正式不可变实施SHA上最小旧红→新绿、完整相关套/必要全编译，再发更新freeze；旧src928/native8b4保持冻结到父调度，不让作者写out。 |
| 非作者真实after | D在新freeze复看M01：普通Review直接建的Beta比较及move创建的Conversation比较各点真实按钮，记录两侧全文/完整URI、源/目标part/group/sessionKey、准确SCM组/resource、只关源比较/根保留、Preview内容与错误恢复；补A/B同tuple隔离。原已过方向按需要连续性核验，不用命令参数或getter替代真实diff。 |

实施候选路径限`conversationDiffReviewPane.ts`、`sourcesDiffActions.ts`、`sourcesDiffRefHelpers.ts`及对应`Sources - Diff panel`/`Sources - Diff ref helpers`公共回归，必要时复用现有真实Conversation harness；若需超出此边界先报父/Astra。写完本增量即交原Astra只读规则16，C/I核验改入并独立方案commit之后才改生产。

## 5. 顺序、审查与状态

- P（原方案历史检查点）：PRD事实→生成状态→SSOT/证据/本方案；父派独立规则16 reviewer，C/I 核验改入后 accepted，单独方案 commit。规则16已通过，单独方案commit后再实施。
- I（原源码历史检查点）：仅按 accepted 方案改生产、真实依赖和回归；静态复核/文档门禁，独立实现 commit；计划仍 accepted、D1387 open，不报未跑的 green。
- I 补修：J原实现`23f8701c8d2`经D独立实现审查后，Astra确认API预pin与单侧URI误配两项Important；§3.2的custom预pin窄例外先按规则16澄清、单独文档提交，再补修与增加真实handler/组模型回归。当前澄清签收不代表实现通过。
- I 宿主补修：D/Astra确认`89f3e5a6a17`完整tuple匹配仍可能按旧active优先误认宿主，D再指出事件缺operationId的并发归因Important；本轮候选观测、同service Sources重叠歧义fence、await后真实成员核对与全tabs唯一fallback先只改文档进review，非作者规则16 C/I解决、独立方案`bf50c66`后已写生产与29项回归源码。`65d2288`原模块357过/虚拟TS0是唯一merge已运行结果，不证明本轮新边界；作者不重跑或借此升状态。
- V：唯一 merge 精确旧生产+新测试 red，再新生产 green/完整相关套/必要全量；非作者真实 after；按证据决定 implemented/closed。全量旧失败另记，不重开已闭 D1382/D1386，不升 PRD-008/009/029。

重要新设计点或边界外问题先报父/Astra，不顺手扩展。全量由父提供的运行记录说明；本作者不借其他主题产物给此主题背书。

## 6. 规则16记录

2026-10-27 M01增量首稿：§3.5/§4.4与SSOT待原Astra只读规则16，尚无本增量C/I结论，禁止开生产切片。J实际文档门禁health 0errors/73warnings，与同步4173后的fresh基线逐条added=[]、removed=[]；generated-status与diff通过，status197行。初次生成器因plan状态review不在draft/accepted/implemented闭集中exit1，已改draft后重新生成并验证通过；未改生成器或手写生成列。HEAD:src仍精确`92801b513611ed3ae1ba36862a58131c609f6aa2`，本次仅文档，没有编译/typecheck/transpile/out/业务测试/窗口运行。以下规则16结论均为原实现边界历史，不签本增量。

2026-10-26，本轮同tuple宿主候选观测首稿经D只读审查为C0/I1，并发归因Important经Astra确认must-fix；作者补入同service Sources重叠sticky ambiguity、custom wildcard、同步捕获DTO与外部并发非保证边界后，D增量规则16为 **Critical 0 / Important 0**。正式两轮报告提交`7c84e0167e3f5fef3db1e7dea5cd6f96ca3393c4`，见[宿主观测规则16报告](../progress/default-editor-contract-audit-2026-10-26-evidence/d1387-host-observation-plan-review.md)。第一稿plan/SSOT SHA256为`8de7de8c0b8cacaab65d44525851bc0b8d94d761f857033b1d0593889b464e70` / `fd67b9a7a5545ff38f6664cc7dca762c979cf8a8f7dcc5de383c94edda95f61e`；最终受审稿为`7f1d87afc2c5058105afe91125175b5556d915ef00ab387bad97ddc2ff8ea45f` / `07fcba33bd8da9f9dc46e4d56b487056e1ddfe7f89fa63033bab2cfbc4dd6f59`。作者已只读核验报告，并实改两Minor：actual对event的matches方向、旧accepted/规则16措辞的历史归属；恢复accepted后以`bf50c66`单独提交方案，再实施。此前审查不替代本轮签收，本轮也不签源码/运行/after；方案签收时生产仍为`89f3e5a6a17`。 该次作者文档门禁为health 0errors/75warnings，较受审稿fresh74仅新增D已提交但J尚未合入的同仓宿主报告链接；不跨槽复制。生成状态与diff检查通过，status170行；原73/74及D报告46为各自历史/工位结果，不替代本次实施记录。

2026-10-26 独立 reviewer C（非 Sources 作者）完整核对正式稿、两轮 Astra、PRD/SSOT实际diff、SCM/slot/finder/状态源码与before机器证据，最终 **Critical 0 / Important 0**。原I1指出helper明确stale与open-status旧代次不能混成一切旧void不mark；作者已拆表并同步PRD/SSOT，reviewer增量复读正式稿SHA `970bac28c99e456d93e0970af0e361a7d802d2ee42bf6632b545fca5f487759d`确认落实。两Minor提醒保留move既有关闭策略、精确报告docs warning delta。见[规则16原报告](../progress/default-editor-contract-audit-2026-10-26-evidence/d1387-plan-peer-review.md)。

作者核验后标accepted；本段是原方案提交时的历史方案审查与文档门禁，不是实现green。原方案工位当时生成状态已同步，docs health 0 errors / 73 warnings，新/改D1387文档专项断链0、status165行；这些不是本轮补修门禁。没有编译/typecheck/transpile/out/依赖out测试，独立新产物after仍待。

2026-10-26，本轮D独立 reviewer `/root/sources_audit` 只读审查§3.2及SSOT实质澄清，结果 **Critical 0 / Important 0**，原报告提交`cbac43bfde8`，见[本轮规则16报告](../progress/default-editor-contract-audit-2026-10-26-evidence/d1387-custom-newtab-plan-review.md)。受审方案SHA256为`9cc2e07b6a638568d0d13dab5e4e25de7fba31e8ca3a85e228ff5c6a55c6cbf8`，SSOT为`be5574b08e00fd1077a29d26bca0fd327b81ded6b157aba5eeab708f2054acc2`；作者已只读核验报告、接受Minor并对齐§1/5/7、恢复accepted，明确旧73warning仅为历史。该审查签收API不预pin、provider options优先、custom newTab预pin兼容成本及完整身份后置gate；不签收未运行源码。PRD-005/009原文没有custom零pin承诺，无需改产品陈述或升状态。

## 7. 源码检查点（待集成验证）

方案提交 `133ef4e5cfa06f9905dd83a4570c8d6b0369a317` 后，J原实现`23f8701c8d2`写 Sources 一次API分派/全部真实调用方命令依赖、局部身份副作用、finder准确对象/数字成员判定及局部打开错误恢复。D独立实现审查指出预pin和单侧URI匹配仍违反实际目标归属，两项Important须补；本轮按§3.2补修。原回归包含真实DTO、委托void/reject、公共列表/命令状态恢复，以及真实parts + public findGroup/EditorService/共享slot；pane仅使用既有轻量测试编辑器隔离模型加载，不能作为真实Git两侧通过证据。原切片详见[源码与待运行清单](../progress/default-editor-contract-audit-2026-10-26-evidence/d1387-source-checkpoint.md)，新增API handler/组模型与完整比较身份回归另按本轮实际证据记账。

作者未编译、transpile、typecheck、写out/watch或运行测试；静态结果与独立实现审查后续收录在该检查点。唯一merge的业务旧红/新绿、相关完整套件与非作者三owner真Git after仍待。此为原源码历史检查点的accepted/open状态，不作为本轮新边界通过证明；D1387 open、PRD状态不升。

本轮澄清独立提交`a76d062f297`后，J补修源码只取消API预pin、改DTO有序双侧/单资源类型及custom可信身份匹配，保留custom预pin窄例外；新增28个官方handler/真实组模型/比较身份与custom兼容负控用例源码。仅本轮静态语法0错误、ESLint0错误且测试29警告相对原23f逐项不变；详见同一[源码检查点本轮段](../progress/default-editor-contract-audit-2026-10-26-evidence/d1387-source-checkpoint.md#本轮独立审查后的补修2026-10-26)。这是源码补修完成线，不是I1/I2运行通过或after签收。

宿主/并发澄清独立提交`bf50c66b8b970a4e29a1e92f0d3968232e2d6987`后，J已按§3.2写候选观测、真实有效组/规范成员核对、全tabs唯一fallback与同service sticky ambiguity registry；command id/args同步捕获，custom预pin窄例外、void/reject语义保留。新增29项官方真实默认宿主、同tuple并发与custom wildcard、完整key/服务隔离、异常清理、候选负控和DTO变化回归源码。最终3TS AST语法0诊断，ESLint0错误/29旧警告相对bf50逐项不变；[本轮源码与待运行清单](../progress/default-editor-contract-audit-2026-10-26-evidence/d1387-source-checkpoint.md#宿主观测与-sources-重叠补修2026-10-26j)记录精确hash与selector。唯一车道须旧65d生产配新测试业务red，再新生产green/完整相关套/语义；新源码独立peer及非作者真实after未到，仍accepted/open，不借原357过升状态。
