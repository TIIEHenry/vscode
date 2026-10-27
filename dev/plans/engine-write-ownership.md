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

原基线为 `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`。C `2f35686b611c60355c42d58a11c2e6d8638ba7cb` 与 F `2b604cb9cff686eb1b47e7b54f45007e42e304c0` 及其后续已验证修正保留为阶段里程碑，不能改写为未做，也不能将其解释为已经证明跨 IPC 的“新引擎零旧写”。本方案规则16复审已C0/I0/M0通过，frontmatter回到 `accepted`；实施运行状态为 `occupied`，由行动层记录。尚待独立方案提交，当前不开始源码或编译。plan状态闭集为draft/accepted/implemented，不以修改解析器表示任务进行中。

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

Skills 的 `_bindSaveSkillContent` 传入并保留第二个 owner 参数；`_invokeSaveSkillContent` 固定同一 transport/link，完成后及 catch 内先验 owner，再处理健康或 `UNIMPLEMENTED`。旧 link 的 `UNIMPLEMENTED` 不得删除新 link 的方法 binding、降级新能力或修改健康；正常当前 link 的 `UNIMPLEMENTED` 保留原能力降级语义。

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
- **Assessment**：可实施。普通 Models caller 与 local preview 非 strict 边界已在本次明确签收，不沿用旧审查。独立方案提交后按 shared contract → F 真实 merge → UI 阶段实施；当前尚未修改源码或运行新验证，不另抢编译令牌。

**阶段一审查保留**（2026-10-28）：独立 Astra 对原方案及当时源码只读审查，Strengths 为 UI 异步边界、node 固定 transport 与脱敏取消；Critical 0、Important 0、Minor 3 均采纳。该结论适用于当时 UI 已观察换代与 node 导入链，不覆盖本次新确证的 main B / renderer A IPC 到达窗口。

## 原阶段实施与验证里程碑

方案独立提交为 `425940ed354`，以共同文档头 `c38973b3301` 开始实施，C 阶段 tip 为 `2f35686b611c60355c42d58a11c2e6d8638ba7cb`。UI 原 engine/link、node 导入原 transport/serial/identity 及取消健康隔离已实现。原 d91 browser 配新 34 例得到 34 业务红；原 node 完整 480 例为 469 过、11 业务红。旧新 node 用同一精确模块 hook 提供固定假数据，旧 service 原字节保持，不读取真实用户文件。

新 browser focused 34 及完整 65 通过，node 完整 480 通过（含 13 新增）；同一 transport 新 link 的旧导入拒绝不污染健康、不重连、不续写，新代仍可成功导入。原项目 noEmit 0 诊断，四 TS ESLint 0 errors / 3 既有 warnings。重复 import 已合并，测试体逐字不变；随后完整 65、原项目与 lint 复验通过，未重复 node/F/旧红。原独立 Astra C0/I0，详见 [验证证据](../progress/engine-lifecycle-recovery-2026-10-28-evidence/providers-verification.md)。

上述为阶段通过记录，不作为本次 shared/IPC 合同的验证证据。当前 C/F 同波重开、尚未合入产品分支；未跑全仓 compile 或真实引擎默认窗口联调，不升 PRD-025，主工位 WIP 保持。
