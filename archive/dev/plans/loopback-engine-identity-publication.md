---
title: "本地引擎连接发布可信身份"
type: plan
status: implemented
phase: M7
updated: 2026-11-05
summary: "补齐 loopback 提交的 engineIdentityId，使 Composer 在既有 owner 校验下读取真实模型目录；不放宽信任或发送门控。"
---

# 本地引擎连接发布可信身份

状态：已完成。负责：agent:codex。代码与本方案限定实测完成；持续 goal 和其他验收边界另记。

覆盖需求：PRD-008。补齐既有本地连接合同，不提升产品验收状态。

## 已确认的问题

真实默认 editor 首轮显示 MODEL_PROFILE_REQUIRED / No model；同配置公开 ListModels 返回 enabled Local。修复前核验的 source 与 out 中，`_connectLocalSkipAuth` 都未向 `_applyConnectedCommit` 传 engineIdentityId，而 Composer 的 `readComposerModelOwner` 要求 identity 与 linkId 齐全，缺失时不调用 ListModels。这是连接发布合同缺口，不是已证实的 Provider 请求失败。

`connectWithoutDeviceAuth` 的返回类型与 wire 没有 engine identity，不能凭空读字段或用地址代替。既有 GetAuthNonce 返回真实 engineIdentityId 与证书指纹。Terra 已在 clean 027ab 生产预包、同一隔离 TCP endpoint 上实际验证：公开 nonce RPC 成功，返回 32 字节 nonce、非空引擎身份，指纹与实际证书 DER SHA256 相同；未建立 Grant 或发模型请求。

相关合同：[本机拨号提交](../../../dev/plans/loopback-link-commit.md)、[本地信任锚](../../../dev/plans/local-engine-trust-anchor.md)、[当前接入证据](../../../dev/progress/sglang-provider-validation-2026-11-05.md)。

## 最小实现

生产改动限 `src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`，必要时抽取就近纯 helper；不改 ConnectResult/proto、Composer owner 检查、远程 DeviceAuth 流程或模型目录断言。

1. 保留现有属主/权限校验的 UDS 或 pinned TCP transport，以及 skip-auth 探测和配对处理。取得 captured transport、建立当前 attempt 后，在同一 transport 上调用 GetAuthNonce；不能另拨未经锚定的连接。
2. 复用 `mintClientIdentityMaterial()`，每次 local dial 仅在内存生成一次合法客户端 challenge 输入：raw Ed25519 公钥及其 SHA256 id。只发送公钥和客户端 id，不调用持久 identity store、signer、DeviceAuth Connect 或 Grant；不新增 keyring 依赖。这个临时客户端 id 绝不能作为引擎 identity 发布。
3. GetAuthNonce 的每个 await 后沿用 `_afterLoopbackProbe` / epoch 检查，过期或已被接管时只释放本 attempt，不覆盖赢家。
4. 拒绝空/纯空白 engine identity 与空 nonce。TCP 复用 `assertObservedFingerprintMatchesNonce`，与该 transport 所用 target 的 expectedLeafSha256Hex 对照；不接受响应自述值作为 pin。UDS 依据已验证的 owner-only socket 信任锚取得身份，不冒称完成了 TLS 指纹验证。
5. 身份和全部能力探测完成后，仅在最终 `_applyConnectedCommit` 同时发布真实 engineIdentityId、新 linkId 与 capabilities；保留既有订阅接管/退出处理。缺失、RPC 失败、指纹不符不得发布 connected owner，沿现有本地失败/重发现路径收口，不增加新的 IPC 失败码。
6. 不沿用上一 link 的 identity。后续重连在新的有效信任锚上取得不同真实身份时作为新 link 发布，旧 expectedOwner 必须拒绝；不把一次旧连接失败变为永久拒绝所有后续有效引擎。

## 验证

- 主要回归放 `test/node/localEngineDiscovery.test.ts` 的真实 ConnectionService 装配：UDS/TCP 都发布响应身份与 link，并能通过该 expectedOwner 读取 Local catalog；请求确为合法临时客户端公钥/hash，且不调用持久 store。
- 无/空身份、空 nonce、TCP 指纹不符/格式错误、GetAuthNonce 失败均不发布 connected owner；等待 nonce 期间 disconnect/用户 profile 接管不被迟到 resolve 或 reject 覆盖。UDS 没有 TLS 指纹仍成功；持久 store 的方法全部设为抛错，证明本地路径不依赖它。
- 重新连接不同有效身份后，旧 owner 被拒绝，新 owner 可读；保留 `universeAgentConnection.test.ts` 已有拨号接管、当前 owner 与旧 owner 拒绝合同。
- 先在新断言中复现旧 local 发布缺身份，再实施；禁止临时改回共享源码取得红证据。使用冻结旧 out 或先写测试的原源码阶段即可。
- Node 24，唯一编译/测试通道；完成对应正式编译和上述 Node 套件，并保留相关 Composer catalog 既有空槽合同。
- 再做一次修复后的隔离默认 editor 原四步采样，记录真实 model options/选中 id、工具结果和 reload。必须补日常 shared-data 的运行前保护基线及实际 client 来源证据；不将读取目录成功替代真实模型调用或四步结果。

## 审查与状态

2026-11-05 Sol fixture 独立只读审查 C0/I0，父窗口核对公开 nonce、纯内存 identity helper、现有 fingerprint helper 与最终 commit 合同后采纳。Minor 的迟到 resolve/reject、store 抛错、malformed fingerprint 和无 TLS 字段 UDS 回归纳入验证。对当前 PIN 的公开 nonce 支持已有真实证据；UDS 的身份发布以服务装配回归验证，若未做真实 UDS 引擎采样须单列限制。

实现与本地验证已完成：旧生产 out 上新增 UDS/TCP 身份断言均失败，整套 29 passing / 2 failing；修复后两套 Node 测试 746 passing，官方 Electron Composer 40 passing，Node24 正式 compile-client exit0。生产只改连接服务，测试只改 localEngineDiscovery；TCP pin 在打开 transport 前捕获，身份仅校验 trim 非空，发布保留原响应值。实现独立复审 C0/I0；nonce 期间 Unavailable 后再 resolve 的直接新用例为非阻塞后续建议，当前已有 arm/condemned 守卫。

真实默认 editor 初次修复后已确认 Local 选中、No queue、file_read 成功；最终回复未显示另定位为数字排序键问题并独立修复。a4 带观察点的真实 SGLang Local/OpenAI Chat 原四步已全部通过，包含完成回复与 reload，身份缺口的代码与本方案TCP实测完成。仍不声称真实UDS、无观察器路径或全部PRD验收。

Chromium Composer 单跑 37 passing / 2 failing，失败是原测试使用 process.on；Electron 正式 runner 的 40/0 不抹去该宿主差异。ESLint exit0，3 条既有 warning；详细日志与来源清单见[验证记录](../../../dev/progress/sglang-provider-validation-2026-11-05.md)。不据本地绿测提升真实引擎或 PRD 状态。

返回 [方案索引](../../../dev/plans/INDEX.md) · [钉死引擎](../../../docs/guides/debug-engine.md)。
