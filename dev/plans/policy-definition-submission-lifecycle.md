---
title: "Policy definition 提交生命周期"
type: plan
status: implemented
phase: M7
updated: 2026-10-26
summary: "D1379：旧330两生产正文核验后test-only red为11行为失败+1裸拒绝hook；新生产四套件41 passing，五TS定向语义0、ESLint0/0，合同闭合。"
---

# Policy definition 提交生命周期
状态：已完成。
覆盖需求：无（正文未引用需求编号）。


> 基线 `330b68911b5`，工位 J。只覆盖默认编辑器依赖的策略定义提交链路。编译入口为 [59 条诊断日志](../progress/ui-visual-review-2026-10-26-evidence/contracts-compile-client.log)，其中 `policyIpc.test.ts` 的 4 条是同一测试通道签名错误，不等同于生产错误。

## 1. 事实、范围与取舍

- `AbstractPolicyService.updatePolicyDefinitions` 先把 definition 引用写入 `policyDefinitions`，随后才等待 `_updatePolicyDefinitions`。同 identity 的第二次调用会跳过等待；第一次拒绝后，同对象再试也会返回旧值。
- `PolicyConfiguration.updatePolicyDefinitions` 在等待后端前写 `_submittedPolicyDefinitions`。失败后的同语义定义会被上层去重，即使只修 IPC client 也无法重试。默认编辑器 `desktop.main.ts` 注册的 `PolicyChannelClient`、`MultiplexPolicyService` 与配置服务使用此链路。
- `policyIpc.test.ts` 把 `listen<T>` 的返回写成事件函数的 `ReturnType`，实际得到 `IDisposable`，需要正式 `Event<T>` 通道假体。保留现有全集替换、删除公告断言。

采用局部串行提交：请求定义与成功水位分别保存，共享一个 pending Promise；只有成功才推进水位。它保障失败状态真实、重复调用等待同一完成、旧尝试不会在新尝试成功后回写。当前执行的快照先完成，未开始的中间请求可以被最新请求合并，不承诺每个中间版本都送后端；A 已成功、B 已开始后再请求 A，必须补回 A。代价是较早调用可能等待期间新增的定义一起收敛；不增加后台自动重试或 RPC 字段。

只改 `policy/common/policy.ts`、`configuration/common/configurations.ts`，以及 `policy.test.ts`、`policyIpc.test.ts`、`policyConfiguration.test.ts`。不改 `PolicyChannelClient` 的 snapshot/event 协议，不处理 tunnel、respond、grpc、browserSession、keyboard 的其余 5 条诊断，不修改 Sessions Window、UI、Provider、ProcessFold 或样式。

## 2. 实施机制

1. **服务层**：`policyDefinitions` 继续保存请求的定义，保持派生服务读取的现有含义。引用变化推进请求版本；一个 pending Promise 按独立快照串行调用现有 `_updatePolicyDefinitions`，成功才推进成功版本。同 identity 在 pending 期间加入同一次等待，拒绝仍抛出原对象，失败版本保持未完成，下次显式调用可重试。启动快照中没有新定义的无操作调用保持原行为。
2. **配置层**：沿用现有 `isSamePolicyDefinition` 语义比较，分别保存请求定义和成功提交定义。共享一个串行 pending Promise，只提交当前请求与成功表的差异，后端成功后才记录该快照的成功水位；同语义并发调用等待当前工作，不新发重复提交，失败后同语义调用重新提交。B 在 A pending 时到达、随后回到 A 的情况也必须按请求顺序收敛，不能被先前的成功 A 去重。
3. **重入与失败**：先安装 pending，再启动异步提交，避免同步策略事件引起重入时另起提交。当前 Promise 完成或拒绝只清理它自己的 pending 槽。多个参与者收到同一原拒绝，不把排队请求自动变成一次隐藏重试。
4. **配置事件边界**：`initialize()` 成功后只安装一次现有两份监听，避免并发初始化重复订阅。默认配置的动态事件出口消费异步拒绝，通过已有 `logService.error` 记录；失败仍不推进成功水位，也不自动重试，后续同语义事件可以重新提交。dispose 释放已安装监听。
5. **测试通道**：使用 `Event<T>` 返回和泛型 channel 合同，参数保留正式类型，不以 `as unknown as`、`as any`、skip、删断言或假成功消除诊断。

## 3. 受控行为验收

测试使用显式 Promise 屏障与公共入口，不依赖墙钟竞速或源码扫描；仅观察无 unhandled rejection 时越过一个事件循环轮次。

| 套件 | 新覆盖与旧/新生产对照 |
| --- | --- |
| `AbstractPolicyService` | 同对象 pending 第二调用保持未完成；成功后共享结果且不重复更新；拒绝两调用收到同一原 Error，同定义再试真实调用后端；A pending 时 B 不并发提交，先交 A 快照后交 B，两个调用最终读 B；拒绝期间排入 B 不隐藏重试，下一次显式调用提交最新 B |
| `PolicyChannelClient` | 保留旧全集替换/null 删除 2 项；以正式 typed channel 控制 `call`，验证 pending 同 identity、原拒绝与重试，观察客户端值与通道调用次数 |
| `PolicyConfiguration` | 通过 `initialize()` 公共入口验证同语义 pending 的第二次 initialize 不提前成功、不重复提交；后端拒绝后第二次 initialize 同定义真实再提交并生成策略值；受控 A→B→A 请求验证配置层去重不吞回退，最终使用最新定义。成功后只安装一份监听，单次动态变更只处理一次；registry 变更→后端拒绝时无 unhandled 且错误记日志，后续同语义事件真实重试；dispose 后无残留。保留 owner/reference 与动态注册原覆盖 |

运行前由 merge 最小刷新测试，新测试对旧生产先 red，再只刷新新生产 green。旧生产失败点应落在等待、调用次数、拒绝或最终值，而不是测试夹具/环境异常。若公共入口暴露额外既有问题，由 Astra 只读裁决边界后修正，不凭假设扩大协议。

## 4. 验证、文档与完成边界

- J 只做目标 ESLint、`git diff --check`、文档健康/生成列检查；不编译、转译、typecheck、watch 或写 `out/`。merge 是唯一产物/运行流水线。
- merge 定向检查上述 5 个改动 TS；`policyIpc` 旧 4 条只作预计映射，以当前真实检查决定，不推算全仓余量。
- merge 用当前新产物运行上述 3 套件，并回归 `FilePolicyService`、`PolicyConfiguration` 的既有 owner/reference 行为；失败按 [health-gates](../progress/health-gates.md) 分类，不声称全仓通过。
- 策略提交契约写入现有 [platform 概览](../../docs/modules/platform/overview.md)，本方案与 `status.md`、D1379、[本轮看板](../parallel/active/ui-visual-review-2026-10-26.md) 一起落账。方案 commit 与实施 commit 分离，未真实运行保持 D1379 open、方案 accepted（方案状态闭集仅 draft/accepted/implemented），不升 PRD。

## 5. 审查与实施状态

- [x] 规则 16：Astra 于 2026-10-26 只读审查方案、两生产文件及三份现有测试；Strengths 为两层成功水位同修与独立服务假体隔离根因；Critical 0、Important 2 均核验改入（裸 async 动态事件出口记录拒绝；并发 initialize 只安装一次监听），Minor 的中间请求合并措辞已明确。Assessment：上述修改后可独立提交方案并实施。
- [x] 两层提交生命周期与 typed channel 已写；新增 11 项受控回归（服务 5 / IPC 2 / 配置 4），原测试场景保留。J 5 TS 目标 ESLint exit 0（0 errors / 0 warnings），diff-check 通过；未编译、转译、运行测试或写 out。
- Astra 实施静态复核 Critical 0 / Important 0；确认共享 pending、独立快照/成功水位、外层 while 的完成间隙复核、事件拒绝日志与一次监听。快照沿既有 definition 身份合同作字典浅拷贝，不新增支持调用者原地修改 definition 的承诺。文档健康 0 errors / 73 工位既有链接 warnings，generated-status --check 通过。运行验证仍待 merge。
- [x] merge旧330生产身份核验后，新测试red为0 passing/12 failing（11行为断言+1原动态事件裸拒绝hook），无超时/加载异常；仅刷新两生产后官方Electron三完整套件+FilePolicyService共41 passing，五TS正式项目上下文定向语义0、ESLint0errors/0warnings。原owner/reference与错误对象/重试断言保留，D1379 closed；[当前证据](../parallel/active/ui-visual-review-2026-10-26.md#d1379当前运行证据)。尚无本轮global compile，不推算全仓剩余。
