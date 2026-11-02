---
title: "Engine catalog 19个写入口的expectedOwner闭环"
type: plan
status: implemented
phase: M7
created: 2026-11-02
updated: 2026-11-02
summary: "19个catalog写入口原始归属全链已通过代码、自动层及独立CommitGate；D1397仅本地专题closed，D1398全局push hold与D1395真实验收open保持。"
---

# Engine catalog 19个写入口的expectedOwner闭环
状态：已完成。负责：agent:codex。范围：19个catalog写入口IDE原始归属全链的本地代码与自动层；Astra最终CommitGate PASS C0/I0/M0、父采纳。仅解除D1397自身阻断，D1398全局push hold、D1395真实验收open与PRD状态保持。

覆盖需求：无（修复已有catalog写入归属硬门，不新增产品能力或远端协议）。

## 1. 问题、已验证基线与有界分类

[D1397/P1](../progress/deferred-gaps.md)最初由Profile Save/Delete/Reset发现：renderer仍缓存A，main已切B而归属通知迟到，UI结果闸和面板预约无法阻止node取当前B transport执行旧意图。接口缺独立owner、IPC只转发、node `_withTransport`在执行时选transport构成完整触发链。父和Astra已确证并撤回push批准；此与真实Save来源未定的P2分开，不声称现场已损坏。

现有A/B主题已真三路集成于`6b3515f2135a383535f25484cd3667cbba97e561`，Node24.18.0完整组合编译0、3JS逐字同/5源码与D1393旧19TS保持，A206/0、B18/0及独立OV保留。见[分层证据](../progress/tools-wiki-wave-2026-11-02-evidence.md)。补充方案先独立审查/文档提交，使基线clean，再由一名源码作者串行实施；本波仍A/B既有成员，不新增成员或letter，integration仍唯一文档/Git/检查通道。

| 分类 | 本方案边界 |
| --- | --- |
| 13个已证P1 | Profile3、Rules2（PIN GLOBAL可写）、MCP4（scope/workDir不是engine owner）、Plugins4（operator role不替代owner）；错误侧有可执行写入路径 |
| 6个同结构防漏 | Triggers4、Clipboard2也缺main发前归属，但当前catalog空scope/session在PIN先INVALID_ARGUMENT；只补归属链，不称已证错写，不补业务session或改变请求内容 |
| 已有保护保持 | Providers/Models、Skills、Memory的strict identity owner不松；Session Delete的published-link owner及可信本地缓存语义保持，D1393不重开 |
| catalog只读 | Context、Hooks、Token Usage、Overview的现有catalog入口无新增写，不纳19写表；相关读取不借此获得写授权 |
| 域外未审 | Config、setPermissionPolicy、其余raw/direct API不在本有界分类内；不得写成已安全或整体catalog所有RPC已闭环 |

只修改本仓IDE owner/caller/IPC/node及对应回归、必要知识行动层；不改business DTO、grpcTransport/grpcClient业务签名、protobuf或PIN/其他仓库。当前真实window/engine仅只读保留own2现场，不为本补方案再Save/Delete/Reset或注入故障；D1395、D1396仍open。

## 2. 精确19方法与独立参数位置

以下均以当前`common/universeAgentConnection.ts`真实签名为基线。新owner类型为`UniverseAgentPublishedLinkOwner`，是IDE独立参数，不塞进request。index为0-based IPC参数位；“第二/三参数”包含原有业务参数。生产未发现必须省略owner的trusted node caller，19入口默认全部强制；如发现例外必须逐caller报父/Astra，不能自行加optional兼容或从最新cache补owner。

| # | 当前正式方法及业务参数 | 新owner位置/index | 分类 |
| --- | --- | --- | --- |
| 1 | `saveAgentProfile(request)` | 第二 / 1 | 已证P1 |
| 2 | `deleteAgentProfile(request)` | 第二 / 1 | 已证P1 |
| 3 | `resetAgentProfile(request)` | 第二 / 1 | 已证P1 |
| 4 | `upsertProjectRule(request)` | 第二 / 1 | 已证P1 |
| 5 | `deleteProjectRule(request)` | 第二 / 1 | 已证P1 |
| 6 | `addMcpServer(request)` | 第二 / 1 | 已证P1 |
| 7 | `updateMcpServer(request)` | 第二 / 1 | 已证P1 |
| 8 | `removeMcpServer(request)` | 第二 / 1 | 已证P1 |
| 9 | `toggleMcpServer(request)` | 第二 / 1 | 已证P1 |
| 10 | `enablePlugin(id, enabled?)` | 第三 / 2 | 已证P1 |
| 11 | `reloadPlugin(id)` | 第二 / 1 | 已证P1 |
| 12 | `unloadPlugin(id)` | 第二 / 1 | 已证P1 |
| 13 | `scanNewPlugins()` | 第一 / 0，无占位request | 已证P1 |
| 14 | `upsertTrigger?(request)` | 第二 / 1 | 结构防漏 |
| 15 | `deleteTrigger?(request)` | 第二 / 1 | 结构防漏 |
| 16 | `setTriggerEnabled?(request)` | 第二 / 1 | 结构防漏 |
| 17 | `fireTrigger?(request)` | 第二 / 1 | 结构防漏 |
| 18 | `writeClipboard?(request)` | 第二 / 1 | 结构防漏 |
| 19 | `clearClipboard?(request)` | 第二 / 1 | 结构防漏 |

方法问号只表示原hook可不存在，不表示新owner可省略。`enablePlugin`因required owner位于第三参数，将中间`enabled?`改为`enabled: boolean | undefined`以保参数位与既有default true语义；生产UI继续显式传true/false，回归锁false及undefined语义。scan只传owner，底层transport仍无业务参数。browser unsupported实现维持unsupported语义，测试/Null实现作最小签名迁移，不新增可写实现。动态`UniverseAgentConnectionChannelClient`的forwarding proxy原样传owner，无需19个手写facade，不在proxy里用此刻cache自动补owner。

## 3. 共同owner、IPC与node执行合同

在`common/universeAgentExpectedOwner.ts`提取`UniverseAgentPublishedLinkOwner`及共同shape/copy/assert实现：正的safe-integer linkId；identity字段可省略，也可为own data property `engineIdentityId: undefined`，二者均以undefined与published值严格比较；有字符串值时须非空。保SessionDelete现有Reflect.ownKeys与own data-descriptor限制，拒额外key/symbol、accessor、继承identity、缺失/非法link；undefined identity与当前published undefined严格相等，绝不是通配符。有/无identity双向变化均失效；connected、非pairing、未dispose及原published transport/link必须有效。复制已验标量供所有await后复核，不持有可被caller突变的owner对象。

`UniverseAgentSessionDeleteOwner`与既有is/assert入口保兼容alias并复用上述实现，不复制第二套同形逻辑。`UniverseAgentExpectedOwner`及其strict validator/assert保持必须非空identity，不用published-link宽验证替换Models/Skills/Memory的旧门，也不扩大旧trusted省略合同。

IPC新增有界published-link方法参数表，准确覆盖上述19项（含index2）并复用到SessionDelete兼容门；现有strict表保持其强度。missing/undefined/null/畸形/陈旧owner均在inner方法查找、业务revive或dispatch前同步固定取消，inner调用数0；校验与inner dispatch间不await。valid owner下原业务校验、unsupported与返回语义保留，不能用owner验证绕过原业务门。

node 19方法同步强制验证并copy owner，复用一个published-link捕获入口和现有OwnedTransport/_runOwnedTransport。入口先验owner/ready/pairing/dispose，固定transport与published标量，再验同一捕获，任何await前后及catch都复核。`isCurrent`也必须包含这一owner的完整归属条件，使旧UNAVAILABLE/异常在健康、重连、能力等副作用之前被隔离；旧结果固定取消，不转发到新B，不泄漏旧底层错误。仅复用strict的`_captureTransportOwner`底层捕获/`_runOwnedTransport`设施，不能沿`_withExpectedOwner(undefined)`走legacy绕过。当前owner的真实业务失败仍按原语义上报。

MCP写的serverId、origin scope与必要project workDir必须来自UI原意图同次捕获；node不再用执行时main新snapshot补project workDir，不跨await重算。原意图拿不到必要project workDir则不发写RPC、诚实取消/不可用，不自造目录；global原字段照旧。owner仅是额外IDE参数，发给transport/远端的request逐字段保持；不把workDir或operator role当作engine owner。

## 4. UI意图和全部派生入口

七个现有UI模块一次收口；进入输入/确认前捕owner及目标快照，直接动作在点击时捕获。已有目标捕id，新建固定创建意图/新目标id；输入只补用户内容，不在await后换owner/目标。缺有效published link就不发写，允许本新族与published缺省identity精确匹配，不从地址或上次cache猜身份。

| 模块 | 必须贯通的入口 |
| --- | --- |
| Agents | promptNewProfile在input前捕的owner传入createProfile（包括传入profile派生创建）；confirmDelete在确认前固定selected id/profile，不能deleteSelectedProfile再取当前选择；直接Save、Reset、Markdown、Model、agent Tools enablement都传原意图owner和payload/target，不在saveSelectedProfile后重捕 |
| Tools | saveToolEnablement及Save/immediate toggle在已有scope/op/reservation捕获点构造owner；保持submitted/late edit、同scope refresh重基、后端目标预约、ToolInfo与有效固定行重绘合同，不用重绘后新snapshot重新授权 |
| MCP | promptAdd、promptUpdate、confirmRemove与直接toggle捕owner和server配置快照/id、origin scope、project workDir；输入/确认后一路传同一快照，不再RPC前读live selectedServer/sessionWorkDir |
| Plugins | Enable/Reload/Unload/Scan均传点击前owner；保持pluginId与enable值、operator role原门，scan(owner)不补空request |
| Rules | promptRule在input前固定owner、scope/existing rule，deleteRule在确认前固定owner/scope/rule；GLOBAL/WORKDIR及原空sessionId保持，不趁机修业务scope |
| Triggers | SetEnabled/Fire/Delete点击时、Upsert输入前捕有效link owner与trigger/草稿；保empty scope/session及原请求，selected草稿不retarget；不补业务session使PIN接受 |
| Clipboard | Write input前捕owner并贯穿input/liveHook；Clear点击capture；保TEXT及原空sessionId/agentId等字段，不新增旁路或业务参数 |

UI所有success/error/catch/follow-up只作用原context/target/dispose，固定CancellationError必须识别为“未确认/连接或目标已变化”，不得冒充backend失败或旧成功；保草稿，不附加新目标refresh。普通当前owner真实失败仍可重试。取消不是证明引擎未执行过任何已发写；main发前owner拒绝的零RPC证据与晚回取消分开。不得新增隐式RPC、lease或重新选择main当前transport的补偿动作。

## 5. 四步执行与验收门

1. **统一公共合同与main边界**：落共享published-link shape/copy/assert及SessionDelete兼容alias，19独立owner签名/精确IPC表，node强制captured transport与pre/post/catch门；已有strict家族与business DTO/proto不变。
2. **接齐七UI模块**：按第4节一次贯通所有直接、输入、确认及派生调用；MCP目标/scope/workDir同捕；取消诚实未确认、保旧草稿与Tools既有生命周期，不拆成19轮逐项发布。
3. **真实字节与组件证明**：复用既有OwnerProtocol/openOwnedByteClient真实双向字节IPC，独立字面量19invokeCases逐项stale rendererA/mainB→B调用0及current A→A1； registry keys/index与独立表双向核对，owner不进入engine DTO。保同wrapper新link、IPC验后切B、caller突变owner、晚success/error/UNAVAILABLE不污染新健康；common/IPC层测missing/null/extra/symbol/accessor/inherited/非法link与缺省identity精确正反。decisive旧red文件仅用旧已存在运行入口与structural owner object，不import新runtime export造成加载假红。13可执行写与6当前业务先拒分别报告，6条不为造绿填scope/session。UI Deferred输入/确认、派生Save链与root/选择变化均证明不转新目标，原Tools/SessionDelete及strict家族回归保留。
4. **唯一通道与解除硬门**：固定源码/产物hash，Node24.18.0按仓库本地compile、聚焦eslint、相关官方browser/Node/common suites与docs working/staged/generated/status≤200/原hooks串行；保首失败、旧red/新green、19逐项零B与正向A1、旧guard家族结果及mode/blob保留。源码与运行独立OV签收、父采纳后才可关闭D1397并解除产品push硬门；知识/方案/行动层与代码同主题提交，未经验真窗口不关闭D1395、不升PRD总状态。

所有编译/测试/工具门仅integration执行，启动前固定单入口核实际外部检查进程；遇外部live不杀、不重起、不以锁文件或timeout当终态。开发者不自跑检查、不改共享账；发现既有问题先报父，需裁决交Astra，不问人类。

## 6. 规则16与当前状态

已完成正式实际文本规则16：独立Astra APPROVED C0/I0/M1，父核验采纳。唯一M1当轮改入第3节，明确identity字段省略与own data property undefined均为严格undefined匹配，保D1393/SessionDelete alias原合同，不循环全文审查。本文accepted表示补充合同签收，不代表实现或D1397关闭；独立方案commit与clean基线交接后，才由本波单一源码作者实施。具体SHA、日志与硬门见[本波看板](../parallel/active/tools-wiki-wave-2026-11-02.md)。

真实Save双来源未定P2及own2合法现场保全不作为19 owner修复的旧红证明，也不拿本补方案替代其调查。自有runtime继续只读；仅在另获明确安全清理授权后处理本波数据，不动既有6项/日常profile/旧37567/外部工位。

### Clipboard 必要窄补充采纳

父/Astra已批准本节写链的必要实现解释：Write对话框返回后，在empty Content提示与提交前，核捕获的owner、原操作代次及disposed；reject/catch提示同样按该资格，旧取消只作未确认，不画到新context。仅落实本方案写入归属，不搬完整Read/list/token生命周期重构。外部F `ad6a35b50bc`候选明确未采、不cherry-pick/搬祖先/覆盖当前WIP，不继承其171项结果；稳定基线后另主题逐提交接续。本窄点不解除D1397、不改原19范围或远端业务字段。

MCP实施期必要窄点同获Astra采纳：选中target为`serverId + origin/scope`，不只id；Update/Remove在确认和RPC晚回的接受门同时核二者（并保持原意图workDir），防同id global↔project把旧成功/清选择误画到新scope。补Deferred确认/RPC late异origin正反测试。Clipboard同owner同context内新动作超越旧Clear自刷新仍属F独立生命周期遗留，不扩D1397；本次owner/context/dispose必要门照常满足。

Clipboard源码复审I1采纳：即使prompt/helper内部已校验，helper返回draft后外层await续体仍须同时重核原owner、原render/action generation与disposed，之后才能提示empty Content或提交；catch/reject同资格。此为已签写链的必要闭合，作者补对应Deferred回归，不扩F完整生命周期。首冻结的22条测试类型/漏参诊断由唯一作者修，原断言与业务字段保持；实现/门禁未完成不解除硬门。

### Candidate1源码复审采纳（不是方案签收撤回）

正式实现candidate1为C0/I4/M1、尚不可READY，父全部采纳：I1 Clipboard helper到外层await须再核完整结果资格；I2 Agents Markdown/Model/Tools派生续体需原owner/profile-selection/dispose并保未确认而非泛backend失败；I3 Triggers Fire/Delete捕原target保护success/catch/follow-up且保正常Delete自刷新；I4 MCP已有workDir门需真实Deferred /A→/B等待与已发RPC晚success/error的直接0错写/0新页污染回归；M1 enablePlugin注释补owner。细节与作者恢复断点记本波看板，冻结/编译/实测及窄复审未通过前不关闭D1397，不扩大F独立生命周期主题。


### 实施窄复审与运行证据

candidate2实际24TS/9delta经Astra窄OV C0/I0/M0 READY，I1–I4/M1均闭合，父采纳源码/测试设计判断。Node24 compile-client0、Node/common747/0及browser九文件445/0；聚焦eslint真实exit1、0errors/12条逐c7上下文字节确认既有warnings，父/Astra批准基线例外，新增0，不称lint全绿。私有新19/0后叠旧6，原19fail经raw actual逐项判18wrongB+1 Add DTO前置；父纠正integration最初15+4误分类，保全过程。c3仅Add合法captured workDir夹具一行获Astra批准、production同c2；完整19业务旧红、Copilot/docs与最终独立运行签收仍待。本文不据阶段绿提前改implemented或关闭D1397。


c3完成同目标精确19新绿/19旧业务wrongB（13可写P1族与6结构mock），真实out11973保持；Node24 client0与Copilot0串行、共享208不变，Node747/0，browser产物388同复用445。变更node test focused lint补跑仍仅1条既有warning，连同未变23文件原11条保留exit1/0errors/12baseline、0新增。最终docs与独立运行OV尚待，不预先翻implemented/关闭D1397。另有D1398独立内容完整性硬门，允许本主题本地保护性提交但不等于全局可push，不纳本方案实现。


### 最终专题签收（本地保护性提交）

Astra最终实际源码、运行、8docs和暂存/原precommit预验综合CommitGate PASS C0/I0/M0，父核验采纳。固定c3的24TS不变；Node24 client/Copilot两目标串行0，完整Node/common747/0、browser源码/388产物同复用445/0，私有同目标新19/0、旧19均具错误侧B1对期待B0的业务断言，保13已证P1族与6结构mock边界、真实out11973不变。聚焦lint真实exit1/0errors/12条基线warning、0新增，父/Astra基线例外不改绿。D1397仅此owner专题本地closed，方案implemented仅代码/自动层；允许精确主题保护性本地commit，D1398/P1全局push hold、D1395来源未定P2与产品PRD不提升，不在此实施新profile内容方案。
