---
title: "Engine 写入归属与 Skills 断连草稿并行修复"
type: progress
status: in_progress
phase: M7
updated: 2026-10-28
summary: "S1已固定；S2独立C200/F133全过与原项目0诊断，首失败保留，运行车道已归还，公共证据/docs及主题提交准备，产品merge仍hold"
---

# Engine 生命周期并行修复

## 真实基线与归属

- 固定产品基线：`d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`，集成分支 `agent-ide`。
- 父 agent 只调度、记录与决策协调；源码、验证及 git 集成由子 agent 执行。
- `merge` 槽由另一活跃任务 `01a17877-4c48-73b2-8082-3250b8a46434` 使用，含 lease/Sources 在途文档与证据。本波不覆盖、不暂存其改动；集成前重新核对实时归属。
- C/F 接受其after完成前共享依赖只读：不install/upgrade/rebuild/clean，不写共享或包内缓存；各槽临时目录、out及Node缓存私有。I仅为外部after工位候选，未视为已占用，本波不使用I。
- C/F 原工作区干净，旧 `loop/C`、`loop/F` 分支完整保留；用新分支指向固定基线，未 reset、stash 或清理其他工作。
- 两份已审方案独立提交为 `425940ed354` 与 `c38973b3301`，C/F 经 Git 快进到共同文档头 `c38973b33015f1e70ce3bca643595f0021515b20` 后开始并行实施；其源树仍与固定 d91 完全相同。
- 阶段一实现提交为 C `2f35686b611c60355c42d58a11c2e6d8638ba7cb`、F `2b604cb9cff686eb1b47e7b54f45007e42e304c0`，共同parent为 `c38973b3301`。两提交、完整634通过及原项目检查作为阶段证据保留。
- 续轮从真实IPC代码确认 main已切B、renderer仍缓存A 的窗口；Astra裁定原“新引擎零旧写”合同尚未闭合。C/F由merge-queued重开为occupied，撤下最终合入候选，不新增字母槽、不改写原提交、不动外部merge。
- 编译只由 `integration_executor` 执行；实施 agent 不启动编译或 transpile。C 固定基线的原项目 `npm run typecheck-client -- --incremental false` 已 exit 0、0 TS；首轮缺 Electron 类型文件的环境诊断单独保留，补前置后同源复跑通过。见[基线证据](../../progress/engine-lifecycle-recovery-2026-10-28-evidence/verification.md)。

## 冲突域矩阵

| 域 | 槽位 / 分支 | 唯一实施者 | 边界 | 当前状态 |
|:---|:---|:---|:---|:---|
| Providers/Models及共享归属合同 | C / `fix/c-engine-write-ownership-20261028` | `providers_implementation` | shared owner类型/interface/IPC/node与平台测试、Provider/Model UI | occupied：S2 C a3最终200/noEmit0/lint0e4既有w，首失败保留；源测冻结，等待文档/证据与主题commit |
| Skills归属与正文恢复 | F / `fix/f-skills-draft-recovery-20261028` | `skills_ipc_implementation` | 仅Skills UI/tests及自有plan；平台/node仍由C唯一写入 | occupied：S2 F a2最终133/noEmit0/lint0e0w；a1两fixture原件保留，源测冻结，等待文档/证据与主题commit |
| 编译与集成 | C，后续使用唯一 merge 槽 | `integration_executor` | 单路验证、主题提交、无损合并 | S2最终运行结束、owned全quiet/双锁释放并明确归还；现仅Python证据封装/门禁，refs另约，外部merge仍hold |

两实施域仍不共享生产写者：全部公共owner、IPC及C/F node方法由C唯一实现；F只接Skills UI。C先交固定shared contract依赖，F用真实Git三路合并接收后再接UI，不复制源码冒充同步，不把依赖同步称产品合入。公共需求、规格、索引与进度由父维护；每域本波最多一次实际集成合入。

## 已核实缺陷与架构决定

1. Providers/Models 的对话框、确认、改名后的删除及批量导入未绑定开始时的 engine/link。A 中开始的操作可能在 B 继续写入；node 导入每一步重新取当前 transport，单修 UI 不足。捕获原身份与 transport，异步边界及后续破坏性步骤复核；换引擎、同引擎换 link 或 dispose 后停止续写，不回滚 A 已接受的写入，旧结果不刷新或覆盖 B。
2. Skills 真断连清目录时同时清除 dirty 正文与 CAS 基线。目录与计数仍清空；未保存草稿及原 engine/name/source/基线作为只读编辑状态独立保留。回原引擎必须显式 Refresh 并验证来源及当前正文后恢复；异引擎同名项不得重设旧稿基线。toggle 的成功、业务失败、异常与刷新返回均检查归属。

架构裁定：`direction_review`（Astra）已只读核实上述范围。实施方案仍各自遵守规则 16，只读审查后才进入源码变更。

## 运行中发现与处理

- C/F 原有 out 均陈旧，不能当作 d91 runtime；执行者固定真实依赖源码后，通过官方 transpileFile 刷新私有产物并保留 source/out 身份。node 旧新阶段用同一精确 ESM hook 替换本地 harness reader，仅固定假数据；生产原字节不变，不读取真实用户凭据。
- `/tmp` 分区 ENOSPC 发生于准备快照时，候选尚未启动，不算业务红。仅迁本轮 scratch 到 C 私有 `.build`，Node/Electron 临时目录与缓存均私有；不清其他任务文件。
- F 原生产配新26例实际3过23个业务 AssertionError。首轮新实现首例通过，但 afterEach 报选择事件重入栈溢出，其余25例未运行；该轮不能称 green。owner 将恢复选择改为只在目标索引确有变化时写入，26例逐字保留，补修独立复核C0/I0/M0；只刷新新生产后26/0、完整89/0。原失败证据保留，无重复旧红。
- 两域独立静态复核 C0/I0，C 的同一 transport 换 link 诊断分支盲点已追加第13项 node 回归；静态结论不替代运行结果。
- C 原 browser34/34业务红，原 node 完整480项中469过11业务红；新 browser focused34/0、完整65/0，新 node 完整480/0（含13项新增）。同一精确fake-reader hook与fixture隔离两阶段，旧service原字节保留；计数与阶段区别以短证据为准，不伪报旧失败后未达路径。
- C/F原项目noEmit均0诊断，主题lint均0errors；C新增重复import已合并，测试体逐字不变。只刷新其browser test后完整65/0、原项目0诊断、lint3既有warnings，未重复node/F/旧红。两域共634项完整套件通过，不扩大为全仓compile或真实引擎产品验收。

## IPC归属补修：当前执行合同

真实链路为异步snapshot缓存 → ChannelClient多参数转发 → IPC直接调用当前main服务。UI捕获方法引用只绑定receiver；main在通知尚未抵达renderer时已可切transport，没有阻止旧A请求写B的因果屏障。

- 使用IDE内部独立参数 `expectedOwner = { engineIdentityId, linkId }`，不进业务request/protobuf，不新建引擎RPC。renderer必须传动作开始的owner，ChannelClient不能自动换成最新owner。
- 本波IPC入口拒绝缺失、畸形或失配owner；main在选择transport到实际调用之间同步核验，完成/异常后重核，固定取消不泄密，也不污染新连接健康或能力。只有可信进程内旧调用可保留可选参数兼容。
- Skills目录、来源/CAS恢复与canonical读回也绑定原owner；旧UNIMPLEMENTED不能删除新link的动态binding。UI显式消费取消，不能因缓存仍为A就重新显示旧成功/失败。
- 核心新回归刻意扣住B snapshot，让真实ChannelClient仍缓存A，而main已B；必须断言B零transport调用。补同transport新link、晚拒绝、晚UNIMPLEMENTED、新CAS读回与missing/malformed owner。
- 两份方案实质修订后分别只读审查、独立提交，再开始共享合同与UI实现；仍只由唯一执行者编译。Memory D1391、Terminal D1390留后批复用，不扩成第三模块。
- 补修方案已分别独立提交：C `0e3310ee67482b9502503747826f0ef3aa78c863`、F `541e5186bfed8215bb1cfc9851270f0853295f49`；均为纯文档，原阶段源码不变。当前C只实施shared合同与平台回归，F仍仅准备测试，不提前修改UI。
- F准备具体核实两处必须覆盖的控制流：写后Refresh的选中正文读取为异步，后续取消必须撤回旧成功提示；目录恢复触发的selection重入读取也必须继承本次Refresh owner，不能在监听器中重捕当前连接。它们属于已接受的读取/取消合同，不新增第三模块。
- S1未冻结前的Astra只读检查确认真实renderer调用面仍仅Providers/Models、Skills、Composer、Overview四文件；另发现IPC若在owner验证前对全部参数`reviveArgs`，损坏marshalled owner可能先抛`SyntaxError`，须固定取消且不分派。该提前反馈已交C修正，不作冻结源码审查或运行通过结论。
- Astra补充裁定：legacy无owner的Skills保存用内部transport/identity/link捕获隔离晚回健康与动态binding副作用，不改变正常legacy可调用条件或强加取消错误。同transport新link的晚`UNIMPLEMENTED`也不得删新binding；可信进程内省略与显式`undefined`同义，`null`等畸形严格取消，产品IPC缺失owner始终拒绝。实施与回归仍待冻结复核。
- 外部merge已到 `c6ded6c918c4f69b0e89037e85b8f49ddc5512b4`、src仍为 `3dc1205763451e60e70c1a8a84465613990aa526`，其源码未移交。外部任务于2026-10-27 18:43 UTC明确报告old前置失败、未到业务测试，相关进程退出及两锁释放；不能作业务旧红。我方已协调接唯一通道至19:05 UTC，执行者仍须fresh核实际锁/进程，不据另一任务消息直接开跑。
- S1首轮冻结为四生产文件与三测试文件（含两个新文件）；新增测试静态展开node96、IPC14、helper2，共112项。按冻结输入装配raw `2f35686`与新测试及私有运行闭包，正式C0/I0与父明确授权后才实际执行，静态用例数不作为通过计数。
- S1首轮已获正式C0/I0/M0并实际运行：旧598为508过/88业务红/2pairing夹具失败，新602为600过/同2夹具失败；13真实字节IPC已实证B误调用。fixture resolver把缺trust也返回ok，未进入真正pairing，C仅补node测试；新未绿、quality未跑，首失败与分类更正原件保留，详见[S1证据](../../progress/engine-lifecycle-recovery-2026-10-28-evidence/ipc-shared-verification.md)。
- pairing夹具补修窄审C0/I0/M0后，旧完整node576为500过/76业务红，两pairing到达最终owner断言；新完整602通过。随后原项目noEmit报3个新node测试TS2345，停在quality/lint未跑；Model夹具实际缺必填字段须补合法payload、Save收窄literal，仍只改node测试并保留全部原件，复验后才固定shared提交。
- 合法请求补修窄审C0/I0/M0后再次完整旧node576=500过/76业务红、新602通过；原项目noEmit0诊断、7TS lint0errors/2warnings。最终node测试SHA `fd7d797aa398522f80eddd366b4ac226bfc0595d6d4dfc1307b743e370d833a2`、其余六源测不变，231项新source/out身份核验一致。19:03:47 UTC实际无运行进程、两锁释放，父已向外部明确归还通道；后续只做证据封装/文档门禁/Git，不自动保留下一轮编译令牌。
- S1实现固定提交`7821dea60cf64fd35f1c998e5a015ee884ab336a`（src `ecba119506d5d19ae3c62b5dfa5867e0b4b8e13b`），20主题路径一起提交，C clean。F用真实三路merge为`a99b2bfc4b94aa157ed62d957844344ce810e82e`，parents为原F541e与C7821、src `471867fcb9173b45133ae27257c840471f14aa25`；仅INDEX/status文档冲突，无源码冲突，F源测/新版plan三保护、C平台七文件及原归档全保，F clean。该次只接依赖，不重跑/冒称S2或产品验证；C/F已分别获源码S2令，平台不再交叉改写。
- S2提前架构裁定：C写成功后可等原owner读回再发布反馈，私有refresh须区分applied/failed/discarded，不能吞取消后当普通void完成画成功。保留Provider普通list失败清action、Model已完成写反馈可与list failed并存的既有差异；Model结果归属/generation门独立于含ready/empty的canWrite，不能为反馈把failed升ready。旧代取消不清新UI，pending沿既有loading禁写，不新增全局互斥；冻结后仍需正式源码复核与真实用例。
- S2首冻结C静态新增67例、F40例，均未运行。C先获C0/I0/M0，F首审发现I1后Astra交叉核C同类路径也成立，C追加结论C0/I1/M0，原C0/I0只作历史，两首冻结均撤候选资格：旧A目录ready而snapshot已quiet变B/同engine新link，旧行点击会把旧数据与当前B owner一起送main，S1会合法接受这个错误重绑。修法为各目录已应用owner约束写门/动作capture，旧rows/count同步通知窗口先撤旧授权，通知/渲染重入后重核generation/owner再开放；补旧行操作零RPC与正式新目录恢复。C只补Provider/Model源测、F只补Skills源测，S1平台与C其余四文件冻结保持；既有取消/草稿/token/三态反馈不弱化。
- 只读合入预检发现：相对当前merge，六源码路径无同路径冲突，但merge已有51条源码变更，交叠C/F已验依赖闭包3/6项；实际集成必须重新验证。共享文档三路保留，merge status已200行，须保留历史并归档腾行。

- 调度更正：20:03 UTC核实C/F已completed，此前send_message未启动补修；已分别followup_task，20:07 UTC实时列表确认两域running。此前‘正补’不作执行证据，新源码冻结与复审仍待。外部20:03 UTC明确释放I静态窗口：仅I static reservation成立、ready/build/after仍false，不能推导产品merge源码或编译通道移交。外部接下来可做纯docs/evidence Python门禁及scoped commit；本波Node/Git前再协调。

S2最终五轮证据已归档，24,857,106字节/2,748成员、23,872份快照完整prepare与五份禁止运行manifest经独立Astra C0/I0/M0核验；六仓内目的地均拒绝。公共docs在C/F同路径落位，F两条独有status与旧Skills入口保留；只读scope为C22/F18主题路径，尚未stage/commit，Git窗口需外部显式协调。见[S2归档与边界](../../progress/engine-lifecycle-recovery-2026-10-28-evidence/ipc-ui-verification.md#归档与输入重建)。

## 验收与提交

- [x] 固定基线类型检查获得当前结果，并区分既有诊断与本波新增诊断。
- [x] 两份方案分别只读审查、修订、独立提交后实施。
- [x] 阶段一Providers/Models已观察换代、改名与批量导入回归通过；不据此宣称覆盖通知尚未抵达的IPC窗口。
- [x] 阶段一Skills断连保稿、显式Refresh/CAS与已观察换代回归通过；不据此宣称覆盖跨进程迟通知窗口。
- [x] 唯一执行者运行有业务断言的旧生产红 / 新生产绿；原项目与lint检查单独收取，不将定向通过称为全量通过。
- [x] 独立源码复核（含F重入补修）与两槽原项目noEmit、主题lint通过；PRD-025仍accepted。
- [x] S1共享owner/IPC/node与平台回归完成独立源码复核、旧业务红/新完整602、原项目noEmit及lint；所有首失败原件保留。
- [x] 固定S1依赖提交并真三路合入F，保留F新版方案、原UI与两域证据。
- [x] IPC补修方案审查、共享合同依赖、C/F UI接线及两独立树新业务红绿、相关完整套件和质量验证；不作为组合树产品验收。
- [x] 两树generator零变更、docs-health0errors，新增改动链接失败0；仅保留46/73既有warning，12公共路径同字节、冻结源测和F历史保持。
- [ ] 记录独立复核、文档门禁、精确提交 SHA、实时 merge 归属及安全同步结果。

## 下一批已确认问题

- [D1390](../../progress/deferred-gaps.md) Engine Terminal 关闭/error 终态与 Promise 拒绝处理，按完整生命周期处理。
- [D1391](../../progress/deferred-gaps.md) Memory 异步动作的原 engine/link 归属，下一批优先独立处理。
- [D1392](../../progress/deferred-gaps.md) 文档工具单测硬编码 28 个 PRD、固定基线实际 29；6 过/1 既有失败的对照已记录，不掩盖为全绿。

以上只是已核实后续任务，不是完成声明；后续调度继续核对当前代码与外部状态。
