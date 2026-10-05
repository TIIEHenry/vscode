---
title: "2026-10-05 自研架构并行审查"
type: progress
status: completed
phase: M7
updated: 2026-10-05
summary: "自研架构并行只读审查及 Grok 复核：原四项之外，确认断连身份丢失导致 roster 切错缓存桶；配对保持相位另有契约疑点。"
---

# 2026-10-05 自研架构并行审查

> 按 [文档维护规则 15](../../../docs/DOCUMENTATION.md) 记录并行范围与结论。本轮只读审查产品实现，不改产品代码。

## 范围与分工

| 审查路 | 范围 |
|:---|:---|
| Sessions 接入 | 只看本仓新增或改造的 Sessions 接入；上游 Agents Window 基线视为原生，不纳入发现 |
| Workbench 产品面 | Conversation、Sources、Navigator 等自研工作台接入与服务生命周期 |
| 跨边界 | `platform/universeAgent`、引擎协议、进程边界、存储与工作区契约 |
| 综合核验 | 对照 ADR、产品规格、延期账与现有扫描，复核证据和去重 |

结论以源码中的具体触发路径、后果和行号为准；已登记的延期项单列，不当成新发现。

## 结论

### P1：Hub 注销与刷新并发时，本地登录态可被恢复

`HubSessionStore.refreshIfNeeded` 的网络请求完成后直接调用 `applyAuthSession`（[`hubSessionStore.ts`](../../../src/vs/platform/universeAgent/node/hubSessionStore.ts) 353–372 行）；`UniverseAgentHubService.logout` 可在等待期间清除同一存储（[`universeAgentHubService.ts`](../../../src/vs/platform/universeAgent/node/universeAgentHubService.ts) 199–214 行）。刷新结果若后到，会重新写入内存 access token 和持久化 refresh secret。`InMemoryHubSessionStore` 同样没有注销代际检查。Hub 服务端是否仍接受该 token 取决于服务端时序，但本地 `signedOut` 状态已被打破。顺序清除测试未覆盖该交错；未见对应延期项。

### P2：Sessions 分栏恢复可能一直等待目录完成

本仓 `8e2ccb29a82` 将恢复结束条件收窄为保存的聊天全到齐，或 `chatCatalogApplied` 为 true（[`chatGroupsView.ts`](../../../src/vs/sessions/browser/parts/chatGroupsView.ts) 411–423 行）。Agent Host 应用 SessionState 时，若存在普通 peer chat 而根能力尚未到达，会暂不置位；根能力随后独立更新只设置 `_agentCapabilities`，不会重试置位（[`baseAgentHostSessionsProvider.ts`](../../../src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts) 1243–1270、2992–2999 行）。保存的聊天已删除且 SessionState 不再更新时，空分栏保留，`_restorePending` 阻止持久化新布局（`chatGroupsView.ts` 893–894 行）。现有测试手动置位，未覆盖该事件顺序。

### P2：删除最后一个 Engine 会话后仍显示旧对话

[`conversationEngineRosterService.ts`](../../../src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts) 1573–1616 行删除末行并发出 bind-failed 哨兵；[`conversationSessionWindowService.ts`](../../../src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts) 118–128 行忽略该哨兵，且没有订阅会话删除。已绑定旧会话的 Lens 收到活动会话变化后只关 overlay（[`conversationLens.ts`](../../../src/vs/workbench/contrib/conversation/browser/conversationLens.ts) 322–327 行），保留旧 lease 和时间线；标题可能回退成 bind-failed 占位。目录和中央内容由此不一致。已知 [D467](../../progress/deferred-gaps.md) 仅指**隐藏**的已删叶不回收；这里是**可见**旧叶。

### P3：损坏的连接配置阻断整个配置列表

[`connectionProfileStore.ts`](../../../src/vs/platform/universeAgent/node/connectionProfileStore.ts) 165 行把持久化 JSON 数组逐项强转后传给 `validateProfile`；68 行直接读取 `input.profileId`。例如存储值为 `[null]` 时，`list/get/put/remove` 都会抛错，无法从界面恢复其他有效配置。损坏的 `trust.leafDer` 也可在反序列化时抛错。这是持久化输入的容错缺口，未见对应延期项。

## 排除与验证

- `src/vs/sessions` 上游 Agents Window 基线、远端 Agent Host 上游重试路径不列发现。
- [D467](../../progress/deferred-gaps.md) 已知的隐藏叶长期持有、[D8](../../progress/deferred-gaps.md) 已知分层检查环境失败不重复立条。
- 静态检索未发现生产代码中 `workbench → sessions`、renderer → `platform/universeAgent/node` 或非 provider contrib → provider 的反向 import。
- 产品代码只读；未运行产品测试。最终文档结构检查 `python3 scripts/check-docs-health.py` 为 0 error、6 个既有 warning。

## Grok 独立复核（2026-10-05）

使用本机 Grok CLI 默认 `grok-4.7`，只读审查引擎连接、身份与 roster 权威边界。首轮达到轮次上限后，续同一 Grok 会话只让它基于已读源码收束；第二轮 Conversation / Sessions 审查遇 `402 Payment Required`，**没有审查结论**。下列仅记录首轮返回并由本会话源码核验的内容。

### P2：断连时清除已发布身份，使只读会话目录切到未知桶

[`universeAgentConnectionService.ts`](../../../src/vs/platform/universeAgent/node/universeAgentConnectionService.ts) 1298–1327 行主动断连时清除已发布的 `engineIdentityId` / `linkId`；已提交链路异常收尾也在 3345–3375 行清除。`_buildSnapshot` 只在字段仍存在时带身份（2713–2730 行），renderer 明确不沿用缺失身份（[`universeAgentRendererSync.ts`](../../../src/vs/platform/universeAgent/common/universeAgentRendererSync.ts) 282–299 行）。[`ConversationEngineRosterService.adoptSnapshotEngineIdentity`](../../../src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts) 1908–1922 行于是把当前会话写回原引擎桶，清空内存，再按身份缺省读取无键遗留桶。无遗留桶时 roster 变空；有遗留桶时可显示另一份旧列表。该行为已被 [`conversationEngineRosterService.test.ts`](../../../src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts) 4520–4584 行的断连断言固定。

这与 [ADR-003 Decision 8](../../decisions/003-engine-adapter-boundary.md) 的「断连保留 UA 快照只读」以及 [PRD-007 验收 5](../../../docs/product/requirements.md) 的断连前内容只读可见方向冲突。审查时未在延期账或 2026-09-24 缺陷扫描找到这条。修订须区分「当前已发布链路身份已清」与「最后一次展示的引擎身份」；后者只供只读缓存选桶，不得冒充仍已连接。

### 契约疑点：生产配对快照达不到 pairing-hold 的相位条件

[`isConversationPairingHold`](../../../src/vs/workbench/contrib/conversation/browser/conversationSessionStatus.ts) 55–59 行要求 `pairingPending && phase === connected`；主进程 `_startProfilePairing` 在置 `pairingPending = true` 时将相位设为 `connecting`（`universeAgentConnectionService.ts` 3081–3093 行），等待 grant 时也如此（1237–1241 行），成功重连前已清掉 pending（1262 行）。因此当前生产路径不能满足该判断。延期账 D277–D310 多项已关闭切片使用 `connected + pairingPending` 合成状态验证缓存保留，不能证明真实配对路径。此处确定存在生产状态与消费端条件不一致；配对期间的最终用户后果需以 main → renderer → roster 联调确认，不直接等同于上一条断连失忆。
