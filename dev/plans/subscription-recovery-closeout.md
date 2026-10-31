---
title: "订阅恢复与错误态缺口收口"
type: plan
status: implemented
phase: M7
updated: 2026-10-28
summary: "四类订阅恢复在58972组合源码fresh后通过当前官方定向回归与八TS语义/lint；D1389代码及自动层关闭，D405/V-S5真实手测保留。"
---

# 订阅恢复与错误态缺口收口

> **2026-10-28 最终复核**：唯一 merge 固定 `58972a2f679b125f97fd488e823961491dee4bc3`，当前八份订阅 TS 已 fresh；包含三份订阅测试的官方 Electron 13 文件合计 **521/0**，UniverseAgent 四 Node suite **58/0**。八 TS 定向语义 0、ESLint 0 error / 0 warning。D1389 仅代码与自动层关闭，本方案 implemented；D405 / V-S5 真实窗口与引擎手测仍 open，不升 PRD。完整选择、命令、exit 和源码/产物身份见[本次结果](../progress/session-closeout-2026-10-28-evidence/README.md#最终组合树验证2026-10-28)。下文“暂保持 accepted”是开始时审计结论，保留其历史。

> **2026-10-28 收尾复核**：下文的 71/104/41/17 与相邻 52 是历史运行摘要；本次未找到对应原始日志，且当前 reopen 测试与保留旧产物不等，不据此签收当前源码。方案暂保持 accepted，由唯一 merge 对最终提交 fresh 后运行并保存来源与结果；见[独立审计](../progress/session-closeout-2026-10-28-evidence/subscription-static-audit.md)。AHP / UniverseAgent 是平台共用合同，Automation 两 TS 为保留 Sessions 兼容修复，不计默认编辑器自动化产品交付。D405 / V-S5 真实引擎手测仍 open。

## 1. 基线与范围

2026-10-26 只读审查确认四类现行缺口。本稿一次覆盖其共同合同：**恢复成功不得留下旧快照冒充可用状态，恢复失败必须可观察且可重试**。

- AHP 普通 snapshot 重连只应用成功快照，漏掉恢复失败资源。
- AHP replay 重连的 root-missing 被 `AgentSubscriptionManager` 忽略。
- UniverseAgent mailbox 溢出后只有断连补投，没有同连接或重新 acquire 的自动恢复。
- Automation catalogue 的 `onDidError` 只记日志，不驱动 observable，也不重新 acquire。

不改 AHP wire protocol，不手改 vendored `sessionCore/**`，不新增设置，不提升 PRD-007 / PRD-008。D405 的真实窗口与引擎手测仍是独立门槛，自动测试绿不代替手测。

## 2. AHP 重连失败收口

### 2.1 普通 snapshot 与 fresh-initialize 分开处理

普通 snapshot 重连在应用返回快照后，以 **active subscriptions ∪ root** 为期望集合，与返回快照取差集并调用 `markSubscriptionsMissing`。root 比较使用 `isAhpRootChannel`，兼容 `ahp-root://` 与 URI 归一化的 `ahp-root:`。普通路径沿用 `preservePending=false`：成功快照清 pending；缺失资源清 pending 且不进入 `_drainAfterReconnect` 重放。

fresh-initialize 不得在分组补订阅前对 managed 资源取差集或清 pending。现有 Session → Chat/其他资源恢复及 `preservePending=true` 不变；root 不属于 active managed 集合，须单独检查 fresh initialize 是否返回 root，缺席时标 Error。现有 fresh 仅返回 root 后成功补订阅并重放 pending 的测试必须保持绿。

### 2.2 root-missing

`AgentSubscriptionManager.markSubscriptionsMissing` 遇到 root URI 时对 `_rootState.setError`，普通资源保持现有清理 pending 与 setError。root 后续有效快照仍由既有 `handleSnapshot` 清错并发出 change。

### 2.3 回归

- `agentHostProtocolClient.test.ts`：普通 snapshot 漏 session/root，断言 Error 与不向缺失资源重放旧乐观动作；fresh 缺 root 不保留旧 root；既有 fresh managed 恢复/pending 重放保持。
- `agentSubscription.test.ts`：root-missing 暴露 Error；后续 root snapshot 恢复。

## 3. Automation catalogue 当前代重建

`AgentHostAutomationStore` 将 catalogue 引用与监听封装为可替换 `DisposableStore`，由 `MutableDisposable` 持有，并维护当前代 `_catalog` 与统一失效信号。`onDidError` 立即发出当前代失效信号、记日志，并以 30 秒 `disposableTimeout` 重新 acquire；projection、ready autorun 和后续 `_waitForCatalog` 都读取当前代。重新 acquire 复用 `AgentSubscriptionManager` 对 Error entry 的驱逐与新订阅语义；失败继续重试，成功由新快照驱动既有 projection。

同一 store 同时最多一个 retry timer；dispose 后旧回调无效，旧代 Error/Change 不得影响新 projection。旧等待器按原代 Error 结束，新等待器监听新代，不得永久挂在已替换订阅上。migration retry 与 subscription retry 各自职责不变。不新增 UI 文案或回退到 legacy authority。

测试扩充 `TestAutomationConnection` 的错误注入与订阅计数，覆盖：已加载 → Error 后 projection 清空 → 30 秒重试恢复；再次失败继续重试；旧代事件隔离；替换后的 catalogue 等待；dispose 后不再 acquire。

## 4. UniverseAgent 溢出 recovery

按 `session-subscription-lifecycle.md` S5 的宿主侧方向实施，保留现有 Actor 合同：第一次 `connectionUp` 可只清 `subscriptionFailed`，必要时第二次才开流。

### 4.1 调度、fire 与成功清债

- reopen timer 值区分 `reopen` / `recovery`，每 session 同时最多一个。
- mailbox 溢出登记 fail-closed 与 recovery 债务，取消旧 timer 并武装 recovery；调度时不查 attempt，因为溢出回调发生在 Actor 关流之前。
- fire 检查连接、lease 与 `attemptId===null`；先摘 fail-closed 闩，再 `postAndDrain(connectionUp)`，仍无 attempt 时补第二次。Actor 标志已被其他路径清除时一次 Up 即可，不重复第二次。
- lease 全释放或连接 down 取消 timer、保留债务；重新 acquire 可重新武装，重连沿用 `finishBringUp` 补投。open 同步 throw 后普通 S2 仍可武装。
- recovery fire、`finishBringUp` 与普通 S2 共用同一清债判定：只有当前 attempt 确实打开且没有重入产生新债务时才清。保留并守卫 `openStream` 成功返回后的清理点，使 S2 成功同样清债；同步回调再次溢出、attempt 失效或新债务已产生时不得误清。补“fire 同步 throw → S2 成功 → 清债”和“开流回调重入溢出 → 新债务保留”顺序测。

### 4.2 退避、attempt 计时与 live 边界

沿用 1s–30s 指数退避与 jitter，不新增次数上限。恢复计时绑定具体 attempt；首事件到达时记录注入时钟时间，不像普通 S2 立即归零。该 attempt 存活达到 30s 后才允许归零，不足 30s 的关流/再溢出保留 attempt。down、末 lease 释放和 dispose 清理对应计时 bookkeeping，旧流时间戳不得影响新 epoch。

宿主只能保证被 fail-closed 吞掉的第一次 Up 不画 live；其余沿用 Actor 当前“先广播 live、再 openAttempt”的顺序，不宣称绝对消除嵌套二次溢出造成的瞬时 live。二次溢出必须保留 recovery 债务并能再次恢复，且有顺序测试覆盖。

### 4.3 回归

更新旧“溢出无 timer”期望，覆盖同连接恢复、重新 acquire、断连重连、一次 Up 成功、同步 throw、lease/down 取消、恢复流不足/达到 30s 的退避及重入二次溢出。既有普通 S2 行为保持不变。

## 5. 文档与验证

更新 `session-subscription-lifecycle.md`（含 S4b 旧合同、V-S4b-1、首个事件归零例外和待拍板①②）、`docs/reference/universe-agent/engine-protocol-surface.md`、`docs/systems/agent-host/overview.md`、`deferred-gaps.md` 与 `status.md`。D405 保持 open，不宣称手测完成。

新增测试先在旧生产输出取得业务红，再最小刷新输出取得绿。分别运行 UniverseAgent/AHP common Node 测试、AHP protocol 与 Automation Electron 测试；触及文件 ESLint；编译锁内一次 `npm run compile-client`；`generate-docs-status.py`、`check-docs-health.py` 与 `git diff --check`。环境阻断须单列，不改写为通过。

## 6. 实施验证（2026-10-27）

- 旧生产输出：AHP root/普通 snapshot/fresh root 三项业务红；Automation 三条恢复场景业务红；UA 六条恢复场景业务红。均为行为断言失败，不是加载或超时。
- 新生产输出：AHP common **71 passing**、protocol **104 passing**；Automation **41 passing**；UA reopen **17 passing**；相邻 EngineBind **26**、Actor **14**、ChatClose **12** 均通过。触及的八份生产/测试 TS ESLint 无诊断。
- `compile-client` 已进入 compile-src，唯一诊断是其他 WIP `conversationStubModel.ts:478` TS18048；本次文件无诊断，不宣称全量编译通过。初次 ENOSPC 后将旧 `out/` 保留到 `/tmp/vscode-subscription-recovery-out` 再复跑。
- docs-health **0 errors / 37 既有 warnings**。D405 与 V-S5 手测仍 open；不提升 PRD，不宣称真实引擎验收完成。

## 审查记录（规则 16）

2026-10-27 一名只读 reviewer，Assessment 初为 Request changes。Critical：差集漏 root、fresh 不得提前清 managed pending 且 fresh root 要单查。Important：live 绝对保证超出宿主能力、清债须防重入且计时绑定 attempt、Automation 需统一当前代与等待器。Minor：文档全路径、S4b/V-S4b-1 同步、一次 Up 分支。均已核验并改入 §2–§5；无未采纳的 Critical/Important。

## 7. 当前组合源码验证（2026-10-28）

- 当前组合源为 `58972a2f679b125f97fd488e823961491dee4bc3`；49 TS 与 1 CSS 同锁逐次刷新，50 份源码/产物 hash 在测试后复查无漂移。八份订阅源及测试包含在此范围，不使用遗留 out 签收。
- 官方 Electron 三份订阅测试包含于13文件 **521 passing / 0 failing / 0 pending，exit 0**；UniverseAgent reopen 16、EngineBind 25、ActorLoop 6、ChatClose 11，共 **58 passing**。这些是本次实际数量，不沿用 §6 的历史摘要。
- Node 五文件整体 **97 passing / 2 failing，exit 1**；另两败为 CSS 源码扫描，与已保存 10/27 原始日志的同两标题/断言一致，本轮未重跑旧 HEAD 对照；未修扫描、未称整体 Node 全绿。
- 49目标定向语义0诊断（含八订阅TS）；49份 ESLint **0 error / 44 warning，exit 0**，其中八订阅TS **0 warning**。完整源码全量语义、fullCompile、本轮新引擎与真实窗口验收均未执行；不替代 D405 / V-S5。
