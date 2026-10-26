---
title: "Conversation 审阅导航随工作根刷新"
type: plan
status: implemented
phase: N/A
updated: 2026-10-26
summary: "D1382已闭合：自动37过、五TS语义0，独立默认编辑器after C0/I0；真实Review行、根失效、并列叶与命令参数通过，保留实拍限制。"
---

# Conversation 审阅导航随工作根刷新

## 事实与范围

基线为 C 工位 `4963799b1e95`。产品范围仅默认编辑器；`src/vs/sessions/` 不参与实施或验收。相关合同见 [Conversation 系统](../../docs/systems/conversation/INDEX.md)、[透镜与轨迹](../../docs/systems/conversation/lens-and-trajectory.md)、[会话工作根方案](session-work-root-and-workbench-scope.md)。

`ConversationReviewNavService` 是 delayed singleton。默认 `ConversationLens` 构造时订阅其 `onDidChange`，回调通过 `applySessionViewTimeline(..., { sidecarOnly: true })` 重算已绑定会话的审阅行。服务 getter 每次读 `IAgentSessionContext.getWorkRoot`，但现有通知只有 mutation、settle、活动会话和连接变化。

`AgentSessionContext.getWorkRoot` 即时读 roster、workspace 与 SCM 根；`onDidChangeSession`、工作区目录变化和仓库增减都能改变结果。透镜自己的 roster session 通知只刷新标题、Inbox、门闩及轨迹，不重算 Conversation 的审阅 sidecar；工作区与 SCM 通知也没有上层重建透镜。因此静止的活动叶或非活动并列叶会保留旧审阅路径或旧行，直到另一次无关通知发生。这是合入前的源码可达链。merge 随后对旧生产得到 7 项路径断言失败，刷新生产后通过，见[自动证据](../progress/default-editor-contract-audit-2026-10-26-evidence/d1382-verification.md)。

原 [compile 日志](../progress/ui-visual-review-2026-10-26-evidence/policy-visual-compile-client.log) 中本域还有 18 条当前静态诊断；本稿只覆盖 ReviewNav 的可选 DI 参数、ReviewNav/ReviewEntry 工作根替身及 AgentSessionContext 的两个 WorkspaceFolder 替身。其余 ComposerPicker、Lens switchModel、SessionSplit API 漂移留给各自内聚合同，不由类型错误推断运行故障。

## 设计与取舍

| 选择 | 因果与边界 |
| --- | --- |
| 采用现有 ReviewNav 全局失效事件 | 会话 workDir、工作区目录、SCM 增减后，所有已绑定透镜从 getter 重读自己的会话；同时覆盖非活动并列叶，不持有第二份 root 真相。沿用现有全局通知的代价是少量未受影响透镜也会重算 sidecar。 |
| `IAgentSessionContext` 改为必需 DI 参数 | 生产注册已有该服务；取消可选构造参数恢复 singleton 构造合同。接口中既有可选 `getWorkRoot` 及 legacy fallback 保留，本轮不扩大跨模块 API。 |
| 构造时解析可选工作根提供者，再注册连接变化通知 | Context 本身使用 delayed descriptor，事件订阅只缓存 early listener，不保证已实例化。先读取非事件成员 `getWorkRoot`，只保留每次调用真实方法的 callback，保证 Context 的连接提交监听先注册；不读取无关 getter、不缓存根、不用事件驱动初始化。 |
| 订阅 session 的活动及 session 事件，workspace folders、SCM add/remove | 活动会话通知保持既有行为；session 事件覆盖活动/非活动 workDir；目录及仓库通知覆盖环境变化。仅订阅 active-work-root 会漏掉非活动并列叶，因此不选。所有订阅进本服务 DisposableStore。 |
| 不新增 all-session-work-root 事件 | 新事件需要跨模块定义枚举、缓存与通知范围，当前依赖已能提供完整输入变化，额外公共 API 没有收益。 |

保持 root 解析与路径归因规则，尤其不改变 `materializeReviewNavRecords` 的 SCM/workspace gate。本轮观察到 SCM 子根已经被 Context 识别为 local、ReviewNav 仍要求 workspace root 的另一归因缺口；它与通知生命周期分开，记录为未改项，不在本稿宣称解决。

## 实施范围

- 生产：`contrib/conversation/browser/conversationReviewNavService.ts`。
- 回归：`test/browser/conversationReviewNavService.test.ts` 用正式类型替身及真实 `AgentSessionContext`；`conversationReviewEntry.test.ts` 的 service 替身补齐必需 DI；两套测试共用 `test/browser/conversationReviewNavTestHarness.ts`，不让公共 API 为夹具迁就；`browser/agentSessionContext.test.ts` 的两个 workspace folder 改用正式 `WorkspaceFolder`。harness 需要实例化 browser 服务，因此落在 browser 测试层，不能放 common。
- 文档：本稿、方案索引、当前状态、D1382 与透镜系统规格。原工作根方案保持历史，不改其设计决策。
- 不动导航栈、split/close 生产 API、不复活 `getId` 或 `switchModel`，不改引擎协议、Sources 行归因或 UI 布局。

## 验证合同

每个行为测试在初始 mutation + settle 后订阅 `onDidChange`，在回调里读取 `getReviewNavForSession`，与透镜入口一致；禁止只在变更后主动调用 getter。每项断言实际路径/行内容，事件计数仅作辅助。

1. **非活动会话 workDir 变化**：真实 Context 的 session 事件转发后，非活动 session 的审阅路径随 session root 改变，活动会话不切换。
2. **工作区目录增加/移除**：有匹配 SCM root 时，工作根持续为 local，绑定会话的审阅行随 workspace gate 出现/移除；既有 mutation/settle 不重发。SCM 根优先意味着仅改变 workspace folders 不会将一个有仓库列表的 engine 根变成 local，不以错误夹具假设验证。
3. **SCM 增加/移除**：每个事件独立使 getter 的可见行或路径发生变化；包含 active root 不变、另一个绑定会话 root 改变的场景，避免误靠 active-root 事件通过。
4. **销毁**：dispose 后 session/workspace/SCM 事件不再转发；服务公开事件订阅也释放。
5. **保持**：late mutation 在 settle 后仍映射 assistant turn；显式 session root 优先于 connection root；legacy fallback 与 engine 路径测试保留。

正式注册为 `new SyncDescriptor(AgentSessionContext, [], true)`。`InstantiationService` 对 `onDid*` 的访问在服务尚未初始化时只缓存 early listener，因此不能把 DI 参数已传入当成 Context 已构造。ReviewNav 构造时先解析 `session.getWorkRoot` 能力，非事件属性访问才同步初始化 delayed Context；保存的 callback 每次仍调用真实 Context 方法，不冻结工作根。随后才注册 ReviewNav 的 connection 通知。连接通知到达时，Context 先提交 link/workDir，再由 ReviewNav 通知消费者。测试用真实 `InstantiationService` + delayed `SyncDescriptor`，并覆盖直接实例：活动会话与非活动绑定会话的连接 fallback 根均在回调中读到新值。session 通知虽先于 active-root publish，getter 本身直接读已经更新的 roster，不依赖后一个事件。

C 工位只做静态 diff、ESLint 与文档检查，禁止编译、transpile、typecheck、写 out、watch 或运行测试。merge 集成者串行：先仅刷新测试产物对旧生产运行新行为项取得 red，再刷新生产运行 ReviewNav、ReviewEntry、AgentSessionContext 三套；同时检查正式编译/DI。实际默认编辑器中检查已有审阅行在目录/仓库变化后刷新、并列非活动叶同步刷新及点击目标，无截图或交互证据不宣称 UI 已验。方案在运行证据完整前保持 `accepted`。

## 只读审查

2026-10-26 `/root/tunnel_retry_contracts` 只读审查：Strengths 为输入变化闭合、getter 单一真相及非活动叶覆盖；Critical 0、Important 0。Minor 要求登记两套测试共用的正式替身 harness，并沿既有父看板与缺口账记录 D1382；已纳入。本稿可接受，先独立提交方案，再实施。运行及实际默认编辑器界面证据齐备前不升 `implemented`。

同日实施静态核查发现 delayed DI 反例，reviewer 复读 `InstantiationService` 的 early-listener 实现后补审：接受构造时解析可选工作根提供者、只缓存调用能力的最小机制；Important 要求移除原「DI 自然保证先构造」假设并补真实 delayed 回归，已写入上文。harness 因实例化 browser 服务移到 `test/browser/`；workspace 变更测试按 SCM 优先的真实解析规则验行增减，不假设它能覆盖已有 SCM 根。

## 实施记录

2026-10-26 C 已按上文写入生产 `conversationReviewNavService.ts`、正式替身 `conversationReviewNavTestHarness.ts`，以及 ReviewNav、ReviewEntry、AgentSessionContext 三套直接测试。delayed 回归先 `createInstance(ConversationReviewNavService)`，再对 Context 做一次非事件读取：ReviewNav 若未在连接订阅前解析 `getWorkRoot`，Context 的连接监听会排在后面，回调仍读到旧根。方案保持 `accepted`，D1382 保持 open。本工位未编译、未跑测试、未做默认编辑器实拍。

2026-10-26 merge 将 `37aa2956b77` 三路合入 `b5f69d4`。旧生产正文对齐 `4963799b1e95` 后，新行为为 3 passing / 7 failing；只刷新生产后三套直接测试加相邻审阅挂载共 37 passing。五份改动 TS 在未改的 `src/tsconfig` 上定向语义 0。J 的静态 after 为 Critical 0 / Important 0。默认编辑器实拍仍未做，方案不升 `implemented`，D1382 不闭合。全量 compile-client 未跑。


## 独立 after 与范围内闭合

2026-10-26 非作者 D 在隔离默认编辑器中完成真实 Review 行、工作区/SCM 增删、连接回退、非活动并列叶、点击及 Enter 的 `sources.review.showForPaths` 参数检查，ReviewNav 范围 Critical 0 / Important 0。四主题、225/226px 并列叶与612px单叶有截图和 DOM；见[原始 after 与签收注记](../progress/default-editor-contract-audit-2026-10-26-evidence/d1382-independent-after.md)。自动37过与五TS语义0沿用先前运行，未重复。D1382 closed，本稿 implemented。上文“未实拍/仍accepted”的过程记录保留为当阶段事实。

加载模块与后续磁盘 JS 整文件摘要不同，仅去 source map 正文一致，不扩大为整棵 out 同构建。实拍使用本地 Stub/内存SCM与通知夹具，没有真实 git diff，没有折叠展开后再根失效，没有独立720px叶宽，只测浅色按钮对比。SCM子根/workspace gate归因未改；芯片归属另记D1386 Important/open，`1 files`独立Minor。本轮唯一全量仍为source `3e63f9e` 的 exit1、46诊断/28文件，未再全量。
