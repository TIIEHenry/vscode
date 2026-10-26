---
title: "默认编辑器与引擎的功能缺口"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "默认编辑器对照引擎源码与运行中钉死引擎：RPC 名称覆盖 206/208，但队列读回、产品入口、字段同步与真实联调仍有缺口。本页是分析快照，不签收新增功能。"
---

# 默认编辑器与引擎的功能缺口

> 返回 [引擎参考索引](INDEX.md)。本页为 2026-10-26 分析快照；实施进展见 [协议消费修复方案](../../../dev/plans/engine-protocol-consumption-closeout.md)。产品状态仍以 [产品需求](../../product/requirements.md) 为准。

## 1. 基线与证据边界

- IDE 源码基线：`09f6da72d305`；仅默认编辑器产品链路，Agents Window、Copilot Chat 不计入产品能力。
- 引擎源码：同级 UniverseAgent 的 `f538eb162cd3`；grpc-api/src/main/proto 无工作区改动。其他引擎 WIP 不作为已交付能力。
- 已运行钉死引擎：127.0.0.1:50061。本轮未启动、重编或重启，钉点与证书以仓外 PIN 为准。
- 本轮只读实测：使用本仓 @grpc/grpc-js、钉死证书信任锚与叶证书摘要校验，查询 v1alpha reflection 的 System、Agent、Session、Permission、Tool、Config、Trigger 七个服务。没有业务写调用。
- 未执行：新建会话、发送消息、写设置或默认编辑器端到端验收。队列、并发发送、附件的运行行为沿用仓库 2026-10-11 实测，不称为本轮复测。
- 对照方法：比较 proto 的 package/service/rpc 与 UniverseAgentGrpcServices，再追踪类型、编解码、connection、宿主与默认工作台调用；测试和传输转发不算产品入口。

## 2. 接口数量与运行时差异

引擎当前源码有 21 个业务服务、208 个 RPC。IDE 目录有 207 个方法名，其中 206 个与引擎相同，1 个没有正式 proto。名称覆盖不能换算成产品完成率。

| 接口 | 引擎源码 | 本轮运行时反射 | IDE | 归属 |
|------|----------|----------------|-----|------|
| PermissionService.SetClientToolProfile | 有实现：ALL / READ_ONLY / NONE | 无 | 无目录、类型或调用 | 新引擎已有，IDE 与调试引擎未跟上；不是任意工具勾选集 |
| TriggerService.RegisterSessionEngineTrigger | 有实现：session 级 file_changed / webhook | 有 | 无目录或入口 | 已有钉死引擎可支持的能力；常规 Upsert 不等于该注册接线路径 |
| ConfigService.UpsertModel / DeleteModel / SetModelEnabled | 有 | 三者均无 | 传输与桌面 UI 已接 | 当前调试引擎版本缺口 |
| ToolService.SaveSkillContent | 无 | 无 | 有目录、正文 UI 与 JSON unary 客户端 | 正式协议缺口，不能以客户端方法存在宣称保存可用 |

代码：`src/vs/platform/universeAgent/node/grpc/grpcTransport.ts`、`grpcClient.ts`。外仓对应实现为 grpc-server 下的 PermissionGrpcService.kt、TriggerGrpcService.kt；本轮检查了函数体。

## 3. 功能缺口矩阵

| 能力 | 已有 | 尚缺与边界 |
|------|------|------------|
| 消息队列、生成中继续提交 | 多数队列变更 RPC 已进入传输，部分进入 roster；已有 Send/Enqueue 门禁 | 接通或曾连时 getMessageQueueState 恒空，Enqueue 已主动拒收。引擎无 Get/List/SubscribeQueue；queue_state 在 ChatResponse，未进当前会话投影。应先有可靠读回/恢复合同，再开放排队、重排等体验。Pause 等仍可写是已知残留 |
| 会话工具范围、Agent 选择 | Model 能进发送载荷，Permission 能写，Tools 能看目录 | Tools 不能修改当前会话范围；SetClientToolProfile 未接。Agent 门控检查的 switchAgent 不在正式 connection/proto，选择不绑定 profile。List/SaveAgentProfile 不等于会话绑定 |
| 会话管理、运行控制 | 新建/删除/重命名、Cancel、Fork/Kill、回合编辑/删除、快照等已有链路 | Shelve/Unshelve/Purge/Export、Agent Pause/Resume、Compact/Back/Prune/Reset/Branch、Loop 控制等多停在 catalog + node，未形成默认产品操作入口。须按用户任务选取，而非把全部 RPC 变成按钮 |
| 目标、任务与团队 | Goal 可设/清；Navigator 能读成员和 TaskList | Inbox AutoDrive 任务与计数在引擎态仍空；设置目标不等于有进度投影。Team 写操作未进产品，PRD-022 明确只读，因此不能直接列为当前需求缺陷 |
| Provider、模型与技能 | 凭据写/导入、模型注册表 UI、技能列表/开关、Agent 配置已有 | 模型三条写缺于当前运行时；技能正文保存缺正式 RPC；Provider discovery 新字段未接 |
| 会话级触发器 | Triggers 列表、常规 CRUD/Fire 已有 | 未消费 RegisterSessionEngineTrigger；缺会话文件变化/webhook 的注册入口、watch_paths、dedupe_key_field |
| 高级 Memory、配置与远程子引擎 | global Memory List/Search/Save/Delete、基础 Engine 设置已有 | 深搜、反思、重建、回退、历史，以及远程节点配置和远程会话创建/聊天/恢复等多停在传输层。Hub 连接当前引擎与 RemoteAgentService 管理远程子引擎是不同能力 |
| 会话工作目录与 Preview | 会话工作根解析、Sources 消费方、多根工作区已有实施 | 新建会话未发送新增 work_dir；Preview Code 按项目换入换出仍待后续设计。已修的路径、叶身份条与 Review 根失效问题不重复记成全量缺失 |
| 订阅恢复 | 普通 remote/error 断流有宿主退避；溢出后整条连接重连已有补投 | 同一连接内、或重新 acquire lease 后的溢出自动恢复仍缺；failClosedSessions 会挡普通 reopen。不能照旧文写成“溢出后整条连接重连也无法恢复” |
| 真实联调 | 大量定向测试与部分默认窗口实拍已有 | PRD-008/025/022 等仍有各自真实引擎产品验收门槛。回环免鉴权不能替代 Hub 强制鉴权、中继、配对及重启重连验证 |

主要代码：

- conversationEngineRosterService.ts：enqueueMessageQueueItem、getMessageQueueState、getAutoDriveTasks、getAutoDriveTaskCount。
- conversationLensComposer.ts：submitInput 载荷含 text、modelProfileId、目标 agentId，不含所选 Agent profile 或 Tools 配置。
- conversationLensComposerChrome.ts：工具目录只读、Agent switchAgent 门控。
- sessionViewHost.ts：普通 reopen、failClosedSessions、failClosedRecovery、finishBringUp 补投。
- sessionViewHostReopen.test.ts：已有断连重连补投回归；本轮未重跑。

## 4. 方法名已接，字段仍落后

以下差异已核对引擎 proto 与 IDE 类型/编解码，不计入“两条缺 RPC”。不宣称本表覆盖全部字段。

| 引擎字段 | IDE 现状 | 影响 |
|----------|----------|------|
| CreateSessionRequest.work_dir | Create 类型仅 title/model/clientSessionId；只编码 model/client_session_id | 无法在创建请求里指定初始目录；跟随已有会话目录不是按指定目录创建 |
| ForkRequest.anchor_turn_id、ForkResponse.message | 请求只编码旧六字段；结果只读 success/agent_id | 无法指定从某回合克隆；失败原因未透传 |
| UpsertProviderCredentialsRequest.refresh_models；ProviderStatus.discovered_models / model_sync_error | 只编码旧四字段，状态无新增字段 | 保存 Provider 时不能请求引擎刷新模型，也看不到发现数量/错误；models.dev 预设不是该能力 |
| AgentProfileProto.max_rewinds | 类型与编解码只到 max_turns | 无法显示/配置回退次数；缺省与显式 0 的语义不同，不可沿用 max_turns 零值省略规则 |
| SessionInfoResponse.title | Info 类型和解码无 title | Info 消费方无法得到新增标题；List 已有标题，不能断言会话列表无标题 |

代码：`src/vs/platform/universeAgent/common/universeAgentTypes.ts`、`node/grpc/grpcSessionAttachWire.ts`、`node/grpc/grpcCatalogUnaryWire.ts`。

## 5. 建议顺序与产品边界

以下为分析时的建议顺序；协议消费切片已实施，当前进展见 §7。

1. 先闭合主流程：队列权威读回/恢复、生成中后续输入合同、同连接溢出恢复、默认编辑器真实引擎验收。已有 Send/Enqueue 门禁保持到替代路径有证据。
2. 再接直接可用的能力：同步调试引擎可用版本后接会话工具范围；核对 work_dir、Fork anchor、Provider discovery 等字段；明确 Agent profile 会话绑定。技能保存先补正式协议。
3. 按需求扩展会话归档/导出/压缩、会话触发器、高级 Memory 与远程子引擎。团队指挥操作先定产品与权限合同，IDE 不自建编排权威。

附件、语音、Route、插件市场和网页凭据写不能直接列成当前产品必须补齐的缺陷：现有 PRD 明确不画文件上传，无引擎转写能力不画语音，无 routeIndex 不画 Route，插件市场不做，网页不提供桌面凭据写入口。

当前 D1387 的 Preview open/diff DTO 与具体编辑器组路由属于 IDE 已登记问题，不是引擎少 RPC。D1382/D1386 等已闭项不重开；D1385 的原默认 Copilot 入口前提已撤回，不当作 Conversation 语音缺陷。

协议参考第一个“§7”会话表是过期副本，Rename/Fork/Queue 等仍有旧叙述。判断以该文 §5、当前源码和本轮取证为准，不重复实施已经接通的操作。

## 6. 仓库依据

- [产品需求](../../../docs/product/requirements.md)
- [协议参考](../../../docs/reference/universe-agent/engine-protocol-surface.md)
- [Engine 设置事实](../../../docs/systems/workbench/engine-catalog.md)
- [队列/并发发送/附件既有实测](../../../dev/plans/engine-gap-queue-send-attachments.md)
- [会话工作根方案](../../../dev/plans/session-work-root-and-workbench-scope.md)
- [调试引擎指南](../../../docs/guides/debug-engine.md)

上述分析阶段未改产品状态、未执行实现或测试。运行时结论仅覆盖七个服务的只读反射；后续实现证据见 §7。


## 7. 本轮实施进展

已补齐 §4 的字段契约/编解码/mapper，以及 AgentProfile 编辑保存对 optional maxRewinds 的保持。Create.workDir 仅补请求类型和 bytes；选定目录的新建会话路径还需要 owner/lease/IPC 身份设计。

两条遗漏 RPC 已进入 catalog、node、可选 connection 与 IPC，能力探测已补，工具配置枚举拒绝非法值。由此 IDE 名称覆盖增至 208/208；另有 1 条无正式 proto 的 SaveSkillContent 仍待下阶段替换。默认窗口的会话工具范围、触发器注册入口尚未新增，不能把名称覆盖视作产品交付率。

验证：新增回归对旧实现为 8 项业务失败；当前定向 Node 协议/IPC/Profile 8 套件 203 passing，连接/配对 3 套件 498 passing；实际 Profile 编辑器保存正文/模型 3 passing。另抽查 mapper 套件 10 passing / 1 既有 MCP 元数据期望差异；已用方案提交时的生产 mapper 复现，不改其断言取绿。类型检查使用原 src/tsconfig 的 native tsc --noEmit，未改配置。

用户已确认同时修改 UniverseAgent 与 IDE，队列权威读回、技能正文保存进入下一跨仓切片；本轮不重启钉死引擎，也不开放生成中发送。订阅溢出恢复仍归既有独立草案。
