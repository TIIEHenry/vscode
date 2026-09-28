---
title: "潜在缺陷：连接与信任边界"
type: progress
status: draft
phase: M7
updated: 2026-09-28
summary: "扫了连接解析、配对、TLS pin、拨号与渲染端相位缓存；6 条高置信发现，其中 3 条已登记为 D944。"
---

# 潜在缺陷：连接与信任边界

## 结论

点名范围内读了拨号、信任记录、配对编排、pin 通道和渲染端相位缓存。高置信问题有 6 条：3 条是已签收但未实施的拨号代际方案（D944），另外 3 条是私网拒绝被字面量绕开、测试连接吃掉一次性中继票据、以及非传输类握手失败被画成 pin 失败。有意的 fail-closed（指纹不符拒写信任、空 SAS 不返回成功配对）没有立条。

## 发现

### BH-01-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`，`disconnect` 约 1000–1020 行，`_connectProfileRaw` 约 743–769 行，`confirmPairing` 约 908–956 行
- 行为：`disconnect` 把 `_userDisconnecting` 置位后在方法结束时立刻清掉，飞行中的 `connectProfile` 不受代际约束。`_connectProfileRaw` 在 `resolve` 之前就把 `_activeProfileId` 写成这次的 profile；解析失败时不关已经接通的 transport。`confirmPairing` 确认的是编排器里的那份 profile，拨号却用当前的 `_activeProfileId`。
- 为何是缺陷：后完成的旧拨号会把已断开或已换走的连接再写成接通；换 profile 失败后界面 id 已是新的，RPC 仍打在旧 transport 上。确认配对也可能把信任写进 A，随后去连 B。
- 触发：连接尚未返回时点断开，或先连上 A 再连 B 且 B 在解析阶段失败，或配对确认与另一次 `connectProfile` 交叠。
- 已知：已知，D944（`connection-dial-generation` 未实施）。
- 修复方向：只在本次拨号全部 await 结束且代际仍匹配时提交 token、相位和 transport，失配只关本拨号捕获的那根。

### BH-01-2

- 严重度：high
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`，`_connectProfileRaw` 里 `handshake.kind === 'pairing_pending'` 约 854–872 行；`confirmPairing` 约 917–930 行；`src/vs/platform/universeAgent/node/pairingOrchestrator.ts`，`isFirstPairingProfile` 约 123–127 行
- 行为：已有 trust 的 TLS 拨号若拿到 `pairing_nonce`，只把快照标成 `pairingPending` 并带上握手里的 SAS，不调用 `_startProfilePairing`，也不 `verifyPairingSas`。`confirmPairing` 只认编排器快照；编排器要求 `trust === null` 且 `state === 'pairingPending'`。
- 为何是缺陷：引擎要求重新配对时，界面能画出 SAS，点确认却得到「没有等待确认的配对」，信任不会更新，用户停在半配对。展示的 SAS 也没有和本地推导比对。
- 触发：已配对 profile 的正式 DeviceAuth 返回 `pairing_nonce` 而没有 `session_token`，用户按提示确认。
- 已知：已知，D944。
- 修复方向：只在 `pairing_pending` 之后清掉该 profile 的 trust，再走现有 `startPairing` 与 `verifyPairingSas`，确认时读配对上下文 id 而不是已接通 id。

### BH-01-3

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`，`_connectProfileRaw` 的 `!endpoint.tls` 分支约 791–797 行，`connect` 约 654–686 行；`src/vs/platform/universeAgent/node/grpc/grpcClient.ts`，`connect` 约 1156–1167 行
- 行为：解析结果没有 TLS 计划时（loopback 始终如此）调用 `this.connect({ clientId, protocolVersion: '1' })`。`GrpcUniverseAgentClient.connect` 用 JSON 键 `client_id` / `protocol_version` / `work_dir` 打 `System.Connect`。同文件的 DeviceAuth 路径已经用 `encodeDeviceAuthConnectRequest` 编 proto 字段 1/2/9/10/12。
- 为何是缺陷：引擎按 proto 的 Connect 不会按 JSON 键给出能力列表。探测把未广告的方法标成 `UNSUPPORTED`，连接看起来成功，技能、工具、会话列表等面被画成不支持。
- 触发：对 loopback profile，或任何 `tls === null` 且解析成功的拨号，点连接。
- 已知：已知，D944（非 TLS Connect 仍走 JSON；D24 是更大的无号方法账，本条只指已有 encoder 的 Connect）。
- 修复方向：这条路径改用与 DeviceAuth 相同的 Connect 字节（省略 field 12），再按 `decodeConnectResponse` 做能力探测。

### BH-01-4

- 严重度：high
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/connectionResolver.ts`，`isPrivateOrLoopbackHost` 约 70–97 行，`resolveDirectAddress` 约 244–250 行；默认 `resolveHost` 约 147 行。生产接线 `src/vs/platform/universeAgent/electron-main/universeAgentMainService.ts` 约 35–40 行没有注入 `resolveHost`
- 行为：未勾选 `allowPrivateNetwork` 时，只拒绝字面 `localhost`、`127.0.0.1`、`::1` 以及 10/8、172.16/12、192.168/16、127/8。不看链路本地、IPv6 唯一本地地址，也不做 DNS。拨号地址用的是主机字符串本身，真正的解析发生在 gRPC 拨号时。失败文案却写「resolves to private or loopback」。
- 为何是缺陷：产品把私网直连做成默认拒绝。上述形式不会得到 `private_network_denied`，直连会继续建立。用户以为未允许私网就不会拨到这类地址。
- 触发：Direct Address 的主机是链路本地、IPv6 唯一本地，或不是上述字面私网 IP 的名字，且未勾选允许私网，然后连接。
- 已知：否。
- 修复方向：在真正用于拨号的地址上判断私网与环回，拒绝面与文案一致；主机名要在解析之后再判。

### BH-01-5

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/connectionResolver.ts`，`ticketCache` 与 `readCachedTicket` 约 394–448、609–618 行；`src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`，`probeConnectionProfile` 约 964–977 行，`_probeResolvedEndpoint` 约 2309–2351 行，`_connectProfileRaw` 的 `forceNewTicket` 约 743–750 行
- 行为：Hub 中继票据按 hub 与设备缓存在过期前复用。只有 `reconnect`（调用方传入或 transport 已是 `failed`）才 `forceNewTicket`。测试连接走 `resolve` 且不强制新票据，然后用该 authority 建 TLS 并调用 `GetAuthNonce`。票据是一次性 claim，用过仍留在缓存里。
- 为何是缺陷：测试显示成功之后，同一次进程里再点连接会拿到已经建立过 TLS 的同一张票据，中继拒绝，连接失败。在票据 TTL 内重试，只要 transport 还不是 `failed`，就会继续命中这张票据。
- 触发：已配对的 Hub 设备上先 Test，再 Connect；或两次普通连接落在同一张未过期票据上。
- 已知：否。D944 只要求重连强制新票据，没有覆盖探测把票据用掉。
- 修复方向：探测使用独立票据且不写入拨号缓存；成功建立过的票据立即从缓存删除。

### BH-01-6

- 严重度：medium
- 置信度：高
- 位置：`src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`，`_connectProfileRaw` 约 846–851 行；`src/vs/platform/universeAgent/node/deviceAuthHandshake.ts`，`runDeviceAuthHandshake` 的失败码约 28–33、111–116、137–141 行。`_isReconnectHaltCode` 约 2114–2119 行把 `pin_mismatch` 当成停止重连
- 行为：握手失败时，除了 `transport_failed`，其余一律写成 `pin_mismatch`。这包含 `identity_mismatch`、`fingerprint_malformed` 和 `signer_unavailable`。相位因此是 pin 失败，自动重连被停掉。
- 为何是缺陷：引擎身份与已存信任不一致，或本机签名器不可用时，界面仍像证书钉变了。用户会按换证去忘记并重配，重连也不会再试。指纹不符映射成 pin 失败是合理的，身份和签名器不是。
- 触发：已配对 TLS 拨号时，AuthNonce 的 `engine_identity_id` 与 profile 信任记录不同，或 `createSigner` 在握手签名阶段失败。
- 已知：否。
- 修复方向：身份不符与签名器不可用保留各自的失败码和文案；只有叶子指纹不符才用 `pin_mismatch` 并停止重连。

## 看过但未立条

- 临时 Connect 超时进入 `recoverTrust`：`pairingOrchestrator.ts` 约 84–90、489–495 行，注释与代码一致，窗格在调用 `confirmPairing` 之前自己做确认。连接服务里 `confirmSas` / `confirmRecoverTrust` 恒为 true（约 530–533 行）是第二道闸，注释写明对话框归窗格。**2026-09-28 后注：** 这条判定已被[引擎链接架构审查](../engine-link-architecture-review-2026-09-28.md) ELR-3 推翻。引擎对未知客户端的 Connect 立即返回 `pairing_nonce`，超时不能证明已有 Grant；Desktop ADR-031 也只在意外拿到 token 时才进入恢复信任。
- Hub 撤销后 profile `state: 'revoked'` 仍留着 trust，`ConnectionResolver.resolve` 不读 `profile.state`。同一次解析会看目录里的 `device.revoked`（约 580–588 行），目录已标撤销时拨号失败。本地状态单独不构成第二条通路。`connection-dial-generation` 把「撤销清 trust」明确放在本波之外，deferred-gaps 没有单独的 D 号。
- `ConnectionProfileStore.put`（约 126–129 行）是读改写，两次交叠可能丢掉一份 profile。没有看到必现的用户路径，不立条。
- IPv6 直连把地址拼成 `` `${resolvedIp}:${port}` ``（连接服务约 772、2311 行）。主机含冒号时端口进了地址，连接失败。属于可回避的边角，不单独立条。
- `ClientIdentityStore.getState` 在没有落盘身份时现造一把密钥且不写入（约 91–95 行）。生产拨号走 `getOrCreateIdentity`，没有调用方，没有用户可见后果。
- `EngineTrustStore` 只在配对成功时 `put`，忘记 profile 不删这份记录。拨号读的是 profile 上的 trust 副本，残留记录不会单独把引擎标成已信任。
- 渲染端 `UniverseAgentConnectionChannelClient` 先 `applySnapshot` 再异步拉 phase（约 60–62、137–148 行）。成功包乱序覆盖属于 D944 的 S4，断连瞬间仍显示 connected 是该方案明确不做的部分（D81 保持关闭），不另立。

## 未读完

点名的生产文件都读过。`universeAgentConnectionService.ts` 后半的会话与目录 RPC 只核对了它们是否经 `_withTransport` / 重连闸，没有逐个业务方法审契约。`browser/universeAgentConnectionService.ts` 是 Web 拒绝实现，`electron-browser` 只注册 channel client。`deviceGrant/SYNC.md` 只说明上游同步，没有行为。测试只用来对照意图（私网字面量、票据 TTL、SAS 确认在窗格），没有把测试缺陷写成发现。
