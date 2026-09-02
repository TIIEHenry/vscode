---
title: "UniverseAgent 引擎参考索引"
type: index
status: accepted
phase: N/A
updated: 2026-09-02
summary: "本仓消费 UniverseAgent 引擎（外仓）协议面与 Connection Hub 控制面的导航：已知 gRPC / Hub REST / 能力探测 / 协议缺口汇总，以及 R5 接线研究要补的会话面清单；权威在外仓，本目录只登记本仓口径"
---

# UniverseAgent 引擎参考

> 返回 [全局索引](../../INDEX.md)。**权威在外仓 UniverseAgent HEAD**（Kotlin 引擎 + proto）。本目录不复制 proto、不移植类型，只登记「本仓作为 IDE 客户端要消费哪些面、口径是什么、还缺什么」。产品陈述见 [PRD-008](../../product/requirements.md#prd-008-引擎与会话权威)。

## 为什么需要这个目录

`dev/plans/customizations-engine.md` 与 R5 草案 [m6-engine-wave](../../../dev/plans/m6-engine-wave.md) 都枚举了外仓 RPC，但它们是 plan（行动层，完成后就地冻结）。知识层需要一个**稳定落点**登记「引擎面事实」，否则每份新方案都要重新枚举一遍外仓 API，且 plan 之间会漂移。本目录就是那个落点：plan 签收时把确认的 RPC 名回填到这里。

## 页面

| 页 | 内容 |
|----|------|
| [engine-protocol-surface.md](engine-protocol-surface.md) | 已知 gRPC 服务与 RPC、Device Grant 握手、能力探测三态、本仓消费口径、协议缺口、会话面清单 |
| [hub-control-plane-surface.md](hub-control-plane-surface.md) | Connection Hub HTTPS 控制面：AuthSession、设备目录、relay ticket、Hub 失败码 |
| [engine-catalog §](../../systems/workbench/engine-catalog.md) | Engine 页 catalog UI 规格（list/toggle @ HEAD；写 RPC 边界） |

## 红线（摘自 ADR-006 壳不变量、ADR-003 adapter 边界草案与 customizations-engine）

- Agent Host / AHP、`IChatModel`、`copilotChatSessions` **都不是**引擎权威。
- 无引擎时 IDE **不扫**  `{AgentHome}` / `{workDir}/.universe-agent` 当 catalog；Engine 页诚实空 + Test。
- 不在 `src/vs/` 重写 `EngineSkillCatalogService` / `AgentPresetLoader` / `ProjectRuleManager` / `HookRegistry` 等外仓类。
- 传输失败 ≠ 「引擎说你有 0 条」；三态 `SUPPORTED / UNSUPPORTED / UNKNOWN` 与 IDE 传输失败态必须分开。

## 相关

- [customizations-engine](../../../dev/plans/customizations-engine.md) · [settings-two-surfaces](../../../dev/plans/settings-two-surfaces.md)
- [Conversation 会话数据契约](../../systems/conversation/stub-and-fixtures.md)（IDE 侧需要被满足的面）
- [Agent Host 概览](../../systems/agent-host/overview.md)（vscode 侧 harness，非权威）
