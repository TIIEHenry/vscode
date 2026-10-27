---
title: "Engine Providers 与 Models 写操作连接归属"
type: plan
status: accepted
phase: N/A
updated: 2026-10-28
summary: "重开 C/F 的主进程归属合同：调用者显式传 expectedOwner，IPC 先于分派拒绝失效意图，node 固定 transport，UI 静默消费取消；原阶段验证保留。"
---

# Engine Providers 与 Models 写操作连接归属

## 当前范围与阶段边界

本方案在默认编辑器的 Engine Preferences Providers/Models 修复上，补齐同波 C/F 共用的 IDE 调用归属合同。实施槽仍为 `vscode-WorkTrees/C`，不新占槽。C 是 shared type、connection interface、IPC、node service 与平台测试的唯一 writer；F 仅修改 Skills UI 与 browser 测试，具体草稿恢复行为仍以 [Skills 方案](skills-disconnect-draft-recovery.md) 为准。Memory 后移，不混入本波；不改 Sources、visible lease 或其他在途主题。

原基线为 `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`。C `2f35686b611c60355c42d58a11c2e6d8638ba7cb` 与 F `2b604cb9cff686eb1b47e7b54f45007e42e304c0` 及其后续已验证修正保留为阶段里程碑，不能改写为未做，也不能将其解释为已经证明跨 IPC 的“新引擎零旧写”。本方案规则16复审已C0/I0/M0通过，独立方案提交为 `0e3310ee67482b9502503747826f0ef3aa78c863`，frontmatter 为 `accepted`；运行与合入状态由行动层记录。S1共享合同与平台回归已完成独立源码复核、最终完整602项及原项目noEmit/lint；固定依赖为 `7821dea60cf64fd35f1c998e5a015ee884ab336a`，F 已以真实三路 merge `a99b2bfc4b94aa157ed62d957844344ce810e82e` 接收，C/F 已分别完成各自 S2 树内验证；产品 merge 仍 hold。plan状态闭集为draft/accepted/implemented，当前整个方案尚未完成，维持accepted。

现行产品约束见 [PRD-025](../../docs/product/requirements.md#prd-025-engine-设置完整性)，系统接线见 [Engine catalog](../../docs/systems/workbench/engine-catalog.md)。本波保持“新引擎零旧写”，不通过缩小该合同结束工作；不增加引擎 RPC、protobuf 字段、设置项或密钥持久化，不升 PRD 总状态。

## 已确证的 IPC 触发链

阶段一的 UI 检查只能看 renderer 已收到的 snapshot。实际路径存在以下窗口：

1. renderer 缓存已发布的 A identity/link；用户在 A 打开 Provider/Model 输入、清除确认、导入，或 Skills 编辑/保存。
2. main 已切到 B 或同引擎的新 link，但 `onDidChangeConnection` 推送尚未送达 renderer。
3. UI 仍看到 A，原有 `ownsProviderWrite`、`ownsModelWrite` 或 `sameWriteLink` 通过；现行调用没有把 A owner 传入 IPC。
4. `UniverseAgentConnectionChannelClient` 用 `ProxyChannel.toService` 转发参数，IPC allowlist 只检查方法名后交给 inner channel；node 的单次写、Test、Skills 读写通过执行时的 `_transport` 发往 B。node 导入虽绑定了开始执行时的 transport/link，也可能一开始就捕获 B。
5. main 对旧意图的拒绝回到 UI 时，renderer 还可能缓存 A，因此仅再次比较 UI owner 也不足以阻止错误提示；必须显式识别并消费固定取消。

源码核对位置以 C `2f35686` 为准：`common/universeAgentConnectionChannelClient.ts:83–92` 的异步缓存与 forwarding、`common/universeAgentConnectionIpcChannel.ts:404–412` 的 allowlist 后分派、`node/universeAgentConnectionService.ts:1535–1536` 的 Test、`:1797–1806` 的 Skills 读写、`:2205–2242` 的 Provider/Model/导入入口。Skills 的动态 `_bindSaveSkillContent` / `_invokeSaveSkillContent` 在 `:3421–3466`：只接收 request，且旧 `UNIMPLEMENTED` 可能删除新 link 的 binding。捕获 renderer 方法不会固定引擎；forwarding proxy 已绑定 receiver，这不是 `this` 丢失。

## 统一 IDE expectedOwner 合同

在 `common/universeAgentExpectedOwner.ts` 定义共享的 `UniverseAgentExpectedOwner`：只读非空 `engineIdentityId: string` 与正的 safe-integer `linkId: number`，并集中同步形状验证与归属比较。它是 IDE 内部参数，不属于任一引擎业务 request。UI 仍可复用现有 published identity/link 读取函数捕获 owner；禁止从 transport 地址、草稿名称或最后一次缓存值伪造 identity。

带业务 request 的方法统一为 `(request, expectedOwner?)`；无业务 request 的 engine-bound list 方法统一为 `(expectedOwner?)`，owner 是第一个参数，不增加空占位 request。问号只为可信进程内旧调用兼容：renderer 经 IPC 调用下表受保护方法时，owner 缺失、畸形或与 main 当前 published owner 不符均固定取消，不能回落到无 owner 路径。显式提供但畸形的 owner 在进程内也不能降级。legacy 无 owner 的进程内调用保留原有结果和 transport 语义。

| 方法 | connection interface 当前位置 | owner 参数位 | 本波用途与调用者 |
|:-----|:------------------------------|:-------------|:-------------------|
| `upsertProviderCredentials` | `:2170` | 第二个 | Provider 添加、编辑和改名新 id |
| `clearProviderCredentials` | `:2175` | 第二个 | 明确清除、改名后的旧 id 清除 |
| `upsertModel` | `:2178` | 第二个 | Model 添加、编辑、改名新 id |
| `deleteModel` | `:2181` | 第二个 | 明确删除、改名后的旧 id 删除 |
| `setModelEnabled` | `:2184` | 第二个 | Model 启用、停用 |
| `testModelProfile` | `:761` | 第二个 | Test，也绑定动作 owner |
| `importHarnessProviders` | `:2195` | 第二个 | 原 owner 进入 node 后再固定整批 transport/link |
| `listProviderStatus` | `:2164` | 第一个 | C 列表、写后读回；导入内部读使用同一已捕获 transport |
| `listModels` | `:2158` | 第一个 | C 列表、写后读回；同时迁移 Composer、Overview 的普通 renderer 读取 |
| `setSkillEnabled` | `:1211` | 第二个 | F toggle |
| `saveSkillContent` | `:1216` | 第二个 | F New、Save、CAS；动态 binding 必须继续转发该参数 |
| `listSkills` | `:1209` | 第一个 | F 目录、显式恢复验证、写后刷新 |
| `getSkillInfo` | `:1213` | 第二个 | F 正文读取、恢复基线和保存后的 canonical readback |

严格 IPC 方法表集中维护参数位，避免 allowlist、验证和回归各自遗漏方法。`previewHarnessProviderImport` 只读本地名称/来源，没有 engine transport，UI 持同一 owner 跨预览与确认，实际 `importHarnessProviders` 必须严格传原 owner。`listProviderPresetCatalog` 也不是 engine RPC，不加入本波 engine owner 方法表。它们不能替 actual import 重新选择目标 owner。

`listModels` 的额外 renderer 调用点已核实为 `conversationLensComposer.ts:269` 与 `engineOverviewSection.ts:278`。Astra 已批准 C 对这两处作最小迁移：在读取开始时显式捕获并传入 owner，按原 generation 加 owner 核验结果并消费取消；缺 owner 时保留诚实不可用状态。不在 ChannelClient 上偷偷用“此刻最新 cache”填 owner，否则对话框原意图仍会被改绑。其余业务 request 字段、返回值、Web unsupported 行为保持。

## IPC 与 node 原子执行边界

`UniverseAgentConnectionIpcChannel.call` 对受保护方法先同步取得并验证 owner，再校验 main 的 published identity/link、connected 与 pairing 状态，最后立即调用 inner channel；校验必须发生在 inner target 的方法查找/分派之前。通过 target 的本地同步 snapshot/connected 接口或等价本地断言完成校验，不新增 renderer 可调用的校验 RPC，不从 renderer cache 决定 main 当前 owner。目标服务的 dispose/transport 检查仍在 node 方法入口执行。

这一步特别覆盖：A 的 `saveSkillContent` 请求到达 B，而 B 不支持该方法、动态 binding 已不存在。旧 owner 必须先被固定取消，不能先变成 `Method not found` 或触发 B 的 unsupported 处理。合法当前 owner 仍按既有 unsupported 语义返回。IPC 检查与 inner 调用之间不允许 await；node 在执行前再独立验证，不能只依赖 IPC。

node 受保护方法在入口同步验证 expected owner、服务未 dispose、connected、非 pairing、当前 transport 与 published transport 一致，随后捕获 transport、identity 与 published link serial。校验后立即调用已捕获 transport；任何 await 后都不得重新选择新 owner 或新 transport。读操作只依赖可读连接状态及 owner，不依赖 UI 的写控件/dirty/loading 门；写与 Test 继续沿用能力和可写门。

复用 C 已有 `_withTransport(operation, ownsOperation)` 隔离陈旧完成/异常的健康、重连副作用。该 wrapper 不替调用方实现归属取消：owner-aware 入口在成功、业务拒绝和 catch 后都要先复核，失效时抛固定、无秘密内容的 `CancellationError`，不拼接原异常。当前 owner 的业务失败保留既有结果、脱敏和诊断，其他 RPC 的全局语义不变。

Skills 的 `_bindSaveSkillContent` 传入并保留第二个 owner 参数；`_invokeSaveSkillContent` 固定同一 transport/link，完成后及 catch 内先验 owner，再处理健康或 `UNIMPLEMENTED`。旧 link 的 `UNIMPLEMENTED` 不得删除新 link 的方法 binding、降级新能力或修改健康；正常当前 link 的 `UNIMPLEMENTED` 保留原能力降级语义。Astra 在 S1 补充裁定：可信进程内 omitted 与显式 `undefined` 同为省略，`null` / `{}` 等显式畸形仍取消；legacy 无 owner 的 Save 也以开始时 main transport、published identity/link 的标量隔离晚回副作用，但不额外强加 expected-owner 取消或新的入口条件。旧 link 晚成功原样返回，晚错误按既有旧 transport 替换分支原样抛出；当前 legacy 结果/错误及 `UNIMPLEMENTED → {ok:false,reason:'UNIMPLEMENTED'}` 保持。可变 owner 入参不作为晚回判断依据，node 保留其已验证时 main owner 的标量。

node 导入沿用已有 node-only 本地 reader 注入，不读真实用户文件。expected owner 要在本地目录读取和首个 RPC 之前匹配，再绑定原 transport/serial/identity；各次 list/credential/model 调用的 await 前后复核。当前 owner 的失败保持计数与脱敏聚合，失效立即逃出逐项 catch，停止后续写入。原引擎已经接受的写入保留，不做跨引擎回滚；整体取消不泄露 API key 或底层旧异常。

## UI 与读回归属

1. C/F 动作在开始时捕获 published owner，输入、确认、预览之后仍传该原值，不在提交时重新捕获。Provider/Model 改名的第二步、导入全过程、Model 启停与 Test 均使用同一 owner。
2. 成功、业务拒绝、异常与刷新后仍核验 owner、当前连接及 section dispose；换引擎、同引擎新 link、离开再切回均使旧动作失效。提示也属于原 owner。
3. catch 必须先使用 `isCancellationError` 识别固定取消并静默消费，再走正常业务失败提示；该 helper 可识别跨 IPC 重建 Error 的固定 name/message。即使 UI 仍缓存 A，也不显示 Canceled/MethodNotFound、不宣称成功、不启动旧操作刷新。F 同时保留草稿、暂停原保存授权，待同源通知与用户显式 Refresh 按 Skills 方案恢复，不自动采纳 B 的基线。
4. C 的写后列表刷新及 F 的目录、恢复基线、保存 canonical readback 都显式绑定原 owner；不能在旧动作的 await 后用当前连接补做读取。readback 取消/失效后不改新页数据、保存授权或 dirty 比较基线。普通目录读取捕获请求起点 owner，与动作 generation/写 operation token 分开。
5. Provider 当前 owner 的保存失败仍按本次 API key 脱敏。F 的正文、source、expectedContent 和独立保存 operation token/CAS 合同不变；owner 只是额外的连接归属门，不能替换磁盘 CAS。

## 实施顺序与独占写入

1. **方案门禁**：本次仅修订方案，交独立 Astra 规则 16 只读复审；Critical/Important 当轮改入，父核验后由 executor 独立提交方案。未收到复审与提交令不改源码或运行验证。
2. **固定 shared contract**：C 先独占修改 common owner type/validation、connection interface、IPC、node 的全部 C/F 受保护方法及平台回归；不混入 C/F UI。由唯一 executor 做所需红绿和原 project 检查、独立提交该最小 contract，记录完整 commit id。此阶段尚不能声称端到端完成或合入产品。
3. **F 接收依赖**：F 用真实三路 `git merge` 接收该固定提交；不得复制文件、制造等价提交或把接收依赖称为产品合入。F 不直接修改 shared 文件。合并冲突交父调度，保留双方主题。
4. **UI 并行**：依赖固定后，C 仅实施 Provider/Model/Test/import、必要的 Composer/Overview caller 与 browser 回归；F 仅实施 Skills UI 与 browser 回归。shared 修正仍只有 C 写入，并以新的固定依赖按真实 merge 传递。
5. **验收与集成**：平台、C、F 的新验证都归属具体源码与产物身份；全部所需回归通过并完成独立复核后，才排唯一 merge 槽。C/F 原有提交与通过日志保留为阶段证据，不重写历史。

预期 shared 源码面为 `common/universeAgentExpectedOwner.ts`、`common/universeAgentConnection.ts`、`common/universeAgentConnectionIpcChannel.ts` 与 `node/universeAgentConnectionService.ts`；测试扩展既有 node connection 与 IPC channel 套件，必要时增加同目录纯 common 校验用例。UI 面由上述调用者和各自 browser 测试构成。ChannelClient 默认只透明转发调用者参数；除证明不丢参数外，不为它增加 owner 注入行为。不修改 gRPC client、proto 或生成产物。

## 验证矩阵

| 行为 | 受控边界 | 必须证明 |
|:-----|:---------|:---------|
| 13 个受保护 IPC 方法 | owner missing、畸形、stale，main B / renderer A | 逐方法固定取消；inner 分派及新 transport 调用均为零；合法 owner 原样到达 |
| 无 request 的 list 方法与取消识别 | owner 第一个参数；取消 Error 经 IPC 重建 | 实际 ChannelClient → allowlist → ProxyChannel → service 不丢参数、不从新 cache 覆盖；UI 识别固定 name/message，而非仅 instanceof |
| Provider/Model 添加、编辑、清除、删除、改名 | 延迟输入/确认，或 upsert 后 main 换代而推送挂起 | B 零旧写；改名第二步停止；UI 缓存仍 A 也无取消错误提示/旧刷新 |
| Model 启停、Test 与所有读回 | main 已新 link，renderer 尚旧 cache；请求成功/业务拒绝/异常晚回 | 不执行旧 Test 或读回 B；无旧提示/列表/基线污染；正常路径仍反馈 |
| Node 批量导入 | 初始到达已失配；provider list、credential、model await 中换代 | 初始失配零 RPC；已接受原写保留；后续停止；无秘密取消，原计数/脱敏业务错误保持 |
| Skills save/toggle/list/info | New、CAS Save、恢复目录/正文、canonical readback 各处 main 换代 | 新引擎零旧写；旧读不开放授权/改基线；固定取消经 IPC 可识别且 F 草稿保留 |
| Skills 动态 binding | B binding 缺失；同 transport 新 link，旧 `UNIMPLEMENTED`/`UNAVAILABLE` 晚回 | 先取消而非 MethodNotFound；不清新 binding/能力、不污染健康、不重连，新代仍可操作 |
| 同 transport 换 link、dispose、pairing/disconnect | 发前及发后屏障 | owner/link 而非对象指针决定失效；固定取消，无新代健康副作用 |
| legacy 进程内无 owner 与当前正常 owner | 归属始终不变 | 原参数、结果、确认取消、业务失败/unsupported、能力门、脱敏保持；显式畸形 owner 不降级 |
| Composer/Overview 与原 C/F browser 回归 | strict listModels caller 迁移及读 owner 不依赖 canWrite | 普通读取可用；loading/dirty 不误挡合法读；原阶段完整套保留 |

新 IPC 竞态用真实 ChannelClient/allowlist/ProxyChannel 路径与可挂起 snapshot 推送证明，不能只直接调用 fake action。node 用公开连接/重连发布真实 identity/link，覆盖同 transport 对象新 link；不通过私有 cast 伪造当前 owner。先在冻结旧生产上验证新增业务红，再验证新生产绿，既有阶段红绿不冒充新 IPC 红绿。

所有 typecheck、转译、out 写入和测试由 `integration_executor` 单路执行并持 `/tmp/vscode-compile.lock`；本 agent 没有编译令牌。后续 Node 运行禁止复用共享 cache，执行者采用隔离产物及明确 source/out 身份，不读取真实用户文件。使用现有 `scripts/test.sh --run ... --grep ...` 与 node unit runner；最终按影响面执行原 project noEmit、主题 ESLint、`git diff --check` 与文档门禁，记录真实命令、exit、源码/产物身份，不扩大成全仓构建或真实引擎联调通过。

## 文档与合入

- 本次实质改写必须满足 [文档维护规则 16](../../docs/DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿)，复审与方案独立提交之后才开实施。
- 父统一维护公共 PRD、Engine catalog、进度、看板和生成索引；本 agent 只写本方案。frontmatter 状态变化须由父运行 `generate-docs-status.py`，不手改生成列；行为文档按 PRD-025 → Engine catalog → 方案顺序同步，不升 PRD 状态。
- 新验证证据继续落 `dev/progress/engine-lifecycle-recovery-2026-10-28-evidence/`。原阶段日志完整保留，新共享合同、UI 和集成各记明确边界；`status.md` 保持不超过 200 行。
- 合入仅经获独占的 merge 槽；其他 WIP 不覆盖、不暂存、不重置。只提交主题路径，不 push，不称固定依赖 merge 为产品交付。

## 规则 16 审查状态

**本次重开**（2026-10-28）：独立 Astra `direction_review` 对实质修订作规则 16 只读复审，未改文件或执行编译。

- **Strengths**：13 项严格方法与参数位单表、真实 IPC 因果链、先于动态 lookup 校验、固定 transport 与 await 后 owner 检查、Skills 旧 `UNIMPLEMENTED` 保护、C/F 唯一 shared writer 与阶段证据边界完整。
- **Critical**：0。
- **Important**：0。
- **Minor**：0。
- **Assessment**：可实施。普通 Models caller 与 local preview 非 strict 边界已在本次明确签收，不沿用旧审查。审查时尚未修改源码或运行新验证；独立方案提交后已进入 shared contract 阶段，随后由 F 真实 merge 接收，再做 UI 接线；运行验证仍由唯一 executor 执行。

**阶段一审查保留**（2026-10-28）：独立 Astra 对原方案及当时源码只读审查，Strengths 为 UI 异步边界、node 固定 transport 与脱敏取消；Critical 0、Important 0、Minor 3 均采纳。该结论适用于当时 UI 已观察换代与 node 导入链，不覆盖本次新确证的 main B / renderer A IPC 到达窗口。

## S1共享合同检查点

**S1共享合同检查点（2026-10-28）**：四生产文件与三平台测试已冻结，正式源码审查及pairing夹具、合法请求类型两次补修窄审均C0/I0/M0。最终node测试SHA为`fd7d797aa398522f80eddd366b4ac226bfc0595d6d4dfc1307b743e370d833a2`，其余六路径保持首轮冻结。旧完整node576得到500过/76业务红，原IPC14业务红保留；新相关完整602通过，原项目noEmit0诊断，7TS ESLint0errors/2warnings。首轮fixture失败、首次3个测试类型诊断与分类更正均保留，详见[S1验证记录](../progress/engine-lifecycle-recovery-2026-10-28-evidence/ipc-shared-verification.md)。这是共享依赖阶段，不作为UI接线、真实引擎默认窗口或产品合入通过结论。

## S2 UI 接线检查点

**S2 实施中（2026-10-28）**：C 只修改 `engineProviderModelSection.ts`、`conversationLensComposer.ts`、`engineOverviewSection.ts` 与各自 browser 套件；共享 S1 七路径保持固定，F 的 Skills UI 不在本工位修改。Provider/Model 的添加、编辑、清除/删除确认、改名两步、启停、Test 和实际导入均传动作起点 owner；本地预览与 cloud preset catalog 保持非 engine-bound。普通列表读取独立捕获请求起点 owner，不依赖写控件或 loading 门。

S2 的独立顺序裁定采用私有 `{ kind: applied | failed | discarded, generation }` 读取结果。写成功后等待原 owner 读回，`discarded`（固定取消、owner/generation/dispose 或不可读）不发布本动作成功；Provider 仅在 `applied` 后反馈，Model 的 `applied` 与当前普通 `failed` 均保留已确认写入反馈。Model 最终反馈按不依赖 pane ready 的连接/owner/generation 门复验，普通 list 错误继续保留原 failed/leftover UI，不升级成写入失败。旧 pending 不阻新 generation，旧取消不得清新页结果。

新增 browser 用例覆盖 owner 参数轨迹、本地与 IPC 重建取消、所有写后读回的 pending/取消、普通列表 loading 读、未通知换代的旧结果、普通错误反馈差异和新 generation 进展。新 owner helper 仅为 type import，旧对照使用 raw `2f35686` UI 配冻结新测试。DOM void 入口用局部 browser/process rejection 监听与业务轨迹证明取消被消费；Composer 的返回 Promise 则直接 await 正常 resolve。首冻结曾获源码初审 C0/I0/M0，随后独立追加审查发现 I1 并撤回候选资格，旧结论仅保留为历史；当时未进入新旧运行验证。所有运行与提交仍交唯一 executor。

**S2 I1 补修（2026-10-28）**：首冻结遗漏了目录数据 owner 与最新连接 snapshot 的区别：A 行仍 ready 而 snapshot quiet 换到 B 或同引擎新 link 时，旧行入口可能捕获新 owner。补修在 Provider/Model 分别记录已应用目录 owner；写门要求目录 owner 与当前 published owner 一致，行回调显式保留原目录 owner，toolbar 也从已应用目录捕获。普通 list 请求仍独立捕获 owner，写后读回三态和 Model 普通读取失败的结果反馈门不依赖目录 ready。

目录替换先撤写授权与旧行监听，画只读行后才发布计数；同步计数通知前后复验 generation/owner，再把新目录 owner 与新行操作一同发布，status/chrome 渲染后再次复验。清空目录同样先撤授权和 DOM，计数通知置最后，不在通知后清掉新代内容。I1 新增 16 个 browser 用例：六类旧行动作跨异引擎/同引擎新 link 的 12 项拒绝及新目录恢复，另四项覆盖 Provider/Model 计数观察者 quiet 换代与通知重入，逐一点击旧行/toolbar、核零写入/输入/预览/确认，并验证正式新目录恢复全部操作。此前 67 项新增保留。

I1 补修静态阶段展开 Provider/Model 声明业务 139 项（原 64 业务 + S2 原 59 + I1 16）；历史“完整 65”含 official clean-state meta 1，不重写原日志。Composer Catalog 声明 39 项（业务 38 + live 源码扫描 1），Overview 业务 21；三文件同次运行总声明 199，只共享一项 official meta，预期运行总数 200。这是运行前的文本展开计数；当时待二次冻结与独立窄审，运行结果及后续测试补修分别记在下方，不升方案状态，不新增 wave。

**S2 首次运行与测试类型补修（2026-10-28）**：C `freeze-a1` 旧完整三文件 200 项得到 117 通过 / 83 业务 AssertionError，新完整 200 项通过；随后原 project noEmit 出现六条主题测试诊断并停止，尚未运行该 attempt 的 lint。原日志 `/sdd/tmp/vscode-expected-owner-s2-20261028-C-freeze-a1/stage-quality/noemit.log` SHA256 为 `6252cf6c26113b603fbe7be36bedea26575ae4432780212497bdb563dd56a675`，保留失败，不将 runtime 通过写为全部 quality 通过。

本次仅补 `conversationComposerCatalog.test.ts` 三个 snapshot fixture 必需的 `capabilities` 字段，并让两处零写入断言比较数组内容快照，防止 Node assert 的断言签名把仍会在后续异步动作中增长的原数组永久缩窄成 `never[]`。业务断言的预期值、owner/取消/旧行/反馈条件与 83 项回归保持；实际测试 JavaScript 会多出 fixture 字段及数组浅拷贝，不声称字节不变。该次补修中生产三文件、Overview 测试与 S1 七文件保持冻结，完整声明数仍 199 + 共享 official meta 1；后续 a2/a3 的实际结果记在下方。

**S2 a2 质量结果与 lint 窄补修（2026-10-28）**：唯一 executor 报告 C `freeze-a2` 新完整 200 项通过、原 project noEmit 0 诊断；六 TS 的 ESLint 为 0 errors / 11 warnings，原件 `/sdd/tmp/vscode-expected-owner-s2-20261028-C-freeze-a2/stage-quality/lint.log` 保留。本 agent 仅静态读取 messages 与源码 provenance，不运行 Node、转译、typecheck、lint 或测试。

逐行及五行上下文对照 raw `2f35686` 与固定 HEAD `7821dea6`：生产 Provider/Model 的两处 `querySelectorAll` 分别沿用旧第 533/1254 行，Composer 的两处 `prefer-const` 沿用旧第 873/1080 行，四项既有警告保留。Overview 的重复 `engineSectionChrome` 导入也已存在于旧第 27 行；本轮按明确要求合并导入，如实记为既有修复。另六项本主题新增警告仅涉及 Provider/Overview 的四处 browser cancellation 监听目标及 Provider 动作夹具的两处 `in`。监听改用与本测试 `document` 同属主窗口的 `mainWindow`，保留原 listener、事件名、安装/移除时机与 process 监听；联合动作对象复用 `hasKey` 按原字段存在性缩窄，输入/确认路径与值保持。测试声明、全部业务断言与预期值不变，Composer 字节不变；生产与 S1 继续冻结。本次两测试的最终字节已由 C a3 重验证；a2 不作为这些新字节的验证证据，也不升方案状态。

**S2 a3 最终树内验证（2026-10-28）**：唯一 executor 实际运行旧完整 200 项，得到 117 通过 / 83 业务 AssertionError、0 fixture failure；新完整 200 项通过。旧失败中 53 项停在最早的 owner 参数缺失断言，另外 30 项为其余业务断言，不能据标题把这 53 项计为已触达后续取消、保留或读回状态。Composer live 源码扫描明确绑定当前源码，不能算 raw `2f35686` 运行证据；它与 official meta 均排除在业务计数外。原 project noEmit 0 诊断，六 TS ESLint 0 errors / 4 已核实既有 warnings；a1 六条测试类型诊断及 a2 首次 lint 原件继续保留。

a3 摘要为 `/sdd/tmp/vscode-expected-owner-s2-20261028-C-freeze-a3/C-a3-validation-summary.json`，SHA256 `dc70f29ee4851b74d81741fdeb11a3161f1e6b4472c822a007cb6fc7d6e6a8a7`；20:56:07 UTC owned 进程已全 quiet、双锁释放，父已归还外部通道。验证时 plan SHA256 为 `65e43cc2d7a0b99ac74dd6bb9d5763a7dc80dfd2f534de7cbfe9eba2bc078d71`；该完整旧版已排他保存到 `/sdd/tmp/vscode-expected-owner-s2-20261028-C-plan-closeout/plan-before-runtime-closeout.md`。本次只补运行后的文档记录，不能把新 plan 身份回写为验证时身份，三生产、三测试与 S1 七文件保持验证 pins。C/F 为各自独立树内验证，没有新增 C UI → F merge；产品 merge 仍 hold，整个方案继续 `accepted`，不升 PRD-025，不称产品集成或真实引擎默认窗口验收通过。

## 原阶段实施与验证里程碑

方案独立提交为 `425940ed354`，以共同文档头 `c38973b3301` 开始实施，C 阶段 tip 为 `2f35686b611c60355c42d58a11c2e6d8638ba7cb`。UI 原 engine/link、node 导入原 transport/serial/identity 及取消健康隔离已实现。原 d91 browser 配新 34 例得到 34 业务红；原 node 完整 480 例为 469 过、11 业务红。旧新 node 用同一精确模块 hook 提供固定假数据，旧 service 原字节保持，不读取真实用户文件。

新 browser focused 34 及完整 65 通过，node 完整 480 通过（含 13 新增）；同一 transport 新 link 的旧导入拒绝不污染健康、不重连、不续写，新代仍可成功导入。原项目 noEmit 0 诊断，四 TS ESLint 0 errors / 3 既有 warnings。重复 import 已合并，测试体逐字不变；随后完整 65、原项目与 lint 复验通过，未重复 node/F/旧红。原独立 Astra C0/I0，详见 [验证证据](../progress/engine-lifecycle-recovery-2026-10-28-evidence/providers-verification.md)。

上述为阶段通过记录，不作为本次 shared/IPC 合同的验证证据。当前 C/F 同波重开、尚未合入产品分支；未跑全仓 compile 或真实引擎默认窗口联调，不升 PRD-025，主工位 WIP 保持。
