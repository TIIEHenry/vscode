---
title: "恢复信任改为新的一次配对尝试"
type: plan
status: draft
phase: M7
updated: 2026-10-05
summary: "ELR-3 剩余半边：身份就绪时 confirmRecoverTrust 先重新观测、中继各续一次票、再握手，指纹一致且拿到 session_token 才写信任。身份未就绪仍按连接服务测试锁住的批准即写信任。不改连接服务。不升 PRD-024。"
---

# 恢复信任改为新的一次配对尝试

> **slice_id**：`recover-trust-new-attempt`
> **来源**：[引擎链接架构审查](../progress/engine-link-architecture-review-2026-09-28.md) ELR-3。超时已是 `transport_failed`，确认框已在 main。本稿只补「批准之后仍把试连叶写进信任」这一半。
> **本稿是方案，未签收。**
> **冲突域**：`src/vs/platform/universeAgent/node/pairingOrchestrator.ts`、`src/vs/platform/universeAgent/test/node/pairingOrchestrator.test.ts`。审查现状句可改 `dev/progress/engine-link-architecture-review-2026-09-28.md` 里 ELR-3 那一条。
> **不改**：`universeAgentConnectionService.ts`、`universeAgentConnection.test.ts`、conversation 窗格、协议文档、`deferred-gaps.md`、`status.md`。
> **不发明** RPC、快照字段或失败码。沿用已有 `fingerprint_mismatch`、`sas_mismatch`、`observe_failed`、`hub_ticket_failed`、`pairing_superseded`、`signer_unavailable`。
> **不升** PRD-024 / PRD-008。

## 0. 一句话结论

用户批准恢复信任之后，客户端身份就绪时不得把进入 `recover_trust` 时记下的叶证书写入 `EngineTrustRecord`。必须重新观测；新叶指纹与用户刚确认的不一致就失败并清掉这次恢复。中继端点在重新观测前、重新握手前各续一张票。新握手返回 `session_token` 才写入**刚观测到的**叶。返回 `pairing_nonce` 则不写信任，快照改为带 SAS 的 `grant_pending`，下一次确认走已有的 `confirmSas`。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 试连超时在 `GetAuthNonce` 之后是 `transport_failed`，不进 `recoverTrust`，不写信任 | `pairingOrchestrator.ts` `runProvisionalHandshake` |
| 试连 `Connect` 意外返回 `session_token` 才进入 `recover_trust`，不安装 token | 同函数 `authenticated` 分支；`startPairing` 把当时的 `leafDer` 放进 `recoverContext` |
| `confirmRecoverTrust` 在对话框批准或 `userConfirmed` 之后立刻 `engineTrustStore.put` 与 profile `active`，不再观测、不再握手 | `confirmRecoverTrust` |
| `confirmPairing` 只在返回快照相位为 `grant_pending` 时留在配对；其它成功相位调用 `connectProfile`。相位不是 `recover_trust` 时下一次确认调用 `confirmSas` | `universeAgentConnectionService.ts` `confirmPairing`（本切片不改） |
| 连接服务测试用不可用的客户端身份种下 `recoverContext`，断言批准后 `trustPuts === 1`，并且 `confirmPairing({ userConfirmed: true })` 随后因 resolver 未配置失败 | `universeAgentConnection.test.ts`（禁止修改） |
| `startPairing` 在身份不是 `ready` 时直接失败，生产路径不会带着未就绪身份进入 `recover_trust` | `startPairing` |

## 2. 合同

1. 没有 `recoverContext`：仍是 `no_recover_trust`。不写信任。
2. 未注入确认钩子、对话框拒绝、或 `userConfirmed !== true` 且钩子返回 false：仍是 `recover_cancelled`，清掉恢复上下文。此路径不观测、不拨号。
3. 确认进行中被 `dispose`、`abandonRecoverTrust` 或新的 `startPairing` 取代：`pairing_superseded`。不写信任，不清掉**别人**已经换上的上下文。
4. 客户端身份不是 `ready`（`encryption_unavailable` 或 `corrupt`）：保持今日行为，用进入恢复时的叶写信任，快照 `idle`，不带 `sessionToken`。这是连接服务测试锁住的夹具路径。不在此路径观测或拨号。
5. 身份 `ready` 时：
   - 存储的 endpoint 带非空 `relayTicketId`：先 `renewDialEndpoint`，用**新** endpoint 做观测；观测后再续一次，握手只用第二张新票。任一续票失败：返回该失败，不写信任，保留恢复上下文。
   - 不带票：不调用 `renewDialEndpoint`，观测和握手都用原来的 endpoint。
   - 观测抛错或返回失败：不写信任，保留恢复上下文。
   - 用 `deriveEngineLeafFingerprintHex(新 leafDer)` 与用户确认的 `leafSha256Hex` 比较，不信观测结果自报的十六进制。不一致：`fingerprint_mismatch`，清掉恢复上下文，不写信任。
   - 握手失败：返回握手失败码，不写信任，保留恢复上下文。
   - 握手 `authenticated`：写入新叶，profile `active`，快照 `idle`，`sessionTokenInstalled` 仍为 false，返回里带这次的 `sessionToken`。清掉恢复上下文。
   - 握手 `pairing_pending`：校验 SAS（与 `startPairing` 相同，引擎 SAS 非空且不符则 `sas_mismatch` 并清上下文）。通过则不写信任，把新叶、nonce、SAS 放进 `activeContext`，`activeContext.endpoint` 仍是**原来的** endpoint（好让随后的 `confirmSas` 自己再续票）。快照相位 `grant_pending` 且带 `sasCode`。清掉恢复上下文。
6. `establishedVia` 仍由 `createEngineTrustRecord` 写成 `sas`。不新增值。

## 3. 明确不做

- 不把超时重新接回恢复信任。
- 不移动确认框，不改 `confirmPairing` 对 `grant_pending` 与 `connectProfile` 的分支。
- 不在身份未就绪时偷偷改成失败关闭。那会让禁止修改的连接服务测试变红，而生产 `startPairing` 本来就进不了这条。
- 不改 IPC、快照类型、能力探测。

## 4. 验证

`scripts/test.sh --run src/vs/platform/universeAgent/test/node/pairingOrchestrator.test.ts` 在 `npm run compile-client` 之后。

新增断言：

- 身份就绪：意外 token 进入恢复时信任写入次数为 0；批准后第二次观测指纹不符则不写信任，再次确认是 `no_recover_trust`。
- 身份就绪：第二次观测一致且握手返回 `session_token` 才写一次信任，并返回该 token；再确认是 `no_recover_trust`。
- 中继：批准后的续票恰好两次，观测用第一次，握手用第二次，都不是试连那张票。
- 握手失败不写信任，相位仍是 `recover_trust`。
- 握手改为配对 nonce 时不写信任，相位 `grant_pending` 且带 SAS；接着 `confirmSas` 才写信任。
- 身份未就绪：批准后不观测、不拨号，仍写一次信任。
- 既有超时不进恢复、取消、未注入钩子、意外 token 不安装，保持通过。

## 5. 只读自审

- 调用方只把 `grant_pending` 留在配对。配对 nonce 若返回 `awaiting_sas_confirm`，会立刻 `connectProfile`，跳过 SAS。所以交接相位必须是 `grant_pending`。
- 身份未就绪分支是本切片相对审查方向的收窄，原因写在 §2.4，不是把生产身份就绪路径也收窄。
- 指纹以 DER 重算为准，避免观测对象自报的十六进制和叶证书不一致时仍写入。
- 失败码都是编排器或握手里已经返回过的字符串，连接服务未知码会落到 `transport_failed`，与今日 `pairing_superseded` 相同。
