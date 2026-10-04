---
title: "未指定地址并进私网拒绝"
type: plan
status: draft
phase: M7
updated: 2026-10-05
summary: "未勾选 allowPrivateNetwork 时，直连与 Hub 中继在写入 resolvedIp 之前把 IPv4 0.0.0.0/8 与 IPv6 未指定地址 :: 并进既有私网分类器。失败码仍是 private_network_denied。loopback 目标形态不过闸。代码已落，方案仍 draft。不改已签收方案正文。不升 PRD。"
---

# 未指定地址并进私网拒绝

> **slice_id**：`unspecified-address-private-denial`
> **来源**：[引擎链接架构审查](../progress/engine-link-architecture-review-2026-09-28.md) 对已签收方案的补充：BH-01 S1 的分类还缺 `0.0.0.0/8` 与 `::`。Linux 上拨这两个地址会落到本机，等于绕过环回拒绝。
> **本稿是方案，未签收。**
> **实施（2026-10-05）**：分类器与本方案单测已落。方案仍是 `draft`。不升 PRD。
> **冲突域**：`src/vs/platform/universeAgent/node/connectionResolver.ts`、`src/vs/platform/universeAgent/test/node/connectionResolver.test.ts`。
> **不改**：`universeAgentConnectionService.ts`、`pairingOrchestrator.ts`、conversation 状态栏、[bug-hunt 01](bug-hunt-2026-09-24/01-connection-trust.md) 与 [connection-hub-client](connection-hub-client.md) 已签收正文、`deferred-gaps.md`、`status.md`。
> **不发明**失败码、理由字符串、快照字段或开关。沿用 `private_network_denied` 与现有理由 `direct address resolves to private or loopback network without allowPrivateNetwork`。
> **不升** PRD。

## 0. 一句话结论

未勾选 `allowPrivateNetwork` 时，直连字面主机与本次要写入 `resolvedIp` 的全部解析结果，以及 Hub 中继 authority 的解析结果，只要有一个落在 IPv4 `0.0.0.0/8` 或 IPv6 未指定地址，整次拒绝，不返回带该地址的 endpoint。勾选后放行。`target.kind === 'loopback'` 不进入这道闸。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 分类器拒绝 10/8、127/8、172.16/12、192.168/16、169.254/16、`localhost`、`::1`、ULA `fc00::/7`、`fe80::/10`，以及这些 IPv4 的映射形式 | `connectionResolver.ts` `isPrivateOrLoopbackIpv4`、`isIpv6Loopback`、`isPrivateOrLoopbackHost` |
| IPv4 第一段为 0 时返回 false。`::` 十六字节全 0，不是 `::1`，`isIpv6Loopback` 为 false | 同上 |
| 直连字面量在 `resolveHost` 之前用同一函数拒绝 | `resolveDirectAddress` |
| 解析列表里只要有一个命中就拒绝，且不把地址写进失败对象 | `resolveDialAddress` |
| Hub 中继对 authority 的解析结果用同一函数；拒绝发生在写入票缓存之后时删掉该缓存键 | `finishHubRelayEndpoint` |
| `loopback` 调用 `resolveDialAddress(host, false)`，私网结果仍成功 | `resolveLoopback` |
| 缺省 `resolveHost` 原样返回 `[host]` | `ConnectionResolver` 构造 |
| 单测把 `::` 与 `0.0.0.0` 放在 `allowPrivateNetwork: false` 的放行表，并断言 `resolvedIp` 就是它们 | `connectionResolver.test.ts` `direct address allows checked private hosts and public literals` |
| 审查补充仍写分类缺这两类 | `engine-link-architecture-review-2026-09-28.md` 对已签收方案的补充 |

## 2. 合同

分类函数仍是 `isPrivateOrLoopbackHost`。先去掉一对首尾方括号，再去掉 `%zone`，再转小写。不新增函数给调用方。

1. IPv4：第一段为 0 的整个 `0.0.0.0/8` 与今日 10/8、127/8、172.16/12、192.168/16、169.254/16 同一集合。含 `0.0.0.0`、`0.1.2.3`、`0.255.255.255`，以及前导零仍能解析成该段的写法（`000.000.000.000`）。第一段为 1 的 `1.0.0.0` 不在此集合。
2. IPv4 映射：仍按内嵌 IPv4 用同一套规则。`::ffff:0.0.0.0`、`::ffff:0.1.2.3`、`::ffff:0:1` 因此拒绝。`::ffff:8.8.8.8` 仍放行。
3. IPv6 未指定地址是十六字节全 0。`::`、`0::0`、`0:0:0:0:0:0:0:0`、带方括号、带 `%zone` 的同一地址都拒绝。`::1` 仍按环回拒绝。`::2` 与 `0:0:0:0:0:0:0:2` 不在此集合，仍放行。
4. 直连：字面命中时在调用 `resolveHost` 之前返回 `private_network_denied`，`allowRelayFallback: false`，不带 endpoint。主机名解析列表里只要有一个命中，整次同样拒绝，失败 JSON 不含这些地址。
5. `allowPrivateNetwork === true` 时上述地址仍成功，`resolvedIp` 取解析结果第一项（方括号已被去掉）。
6. Hub 中继：authority 解析到这些地址时同样 `private_network_denied`，并且该臂已经写入的票缓存要删掉，下一次 resolve 再签发。目录里的设备地址字段不单独再判。
7. `loopback` 目标即使解析出 `0.0.0.0` 或 `::` 也不因这道闸失败。
8. 不改理由字符串，不改状态栏文案，不改拨号缓存的其它合同。

## 3. 明确不做

- 不把多播、广播、`fec0::/10` 站点本地、文档前缀 `2001:db8::/32` 收进拒绝集。
- 不改 BH-01 与 connection-hub-client 的已签收正文。
- 不改连接服务、配对编排器、对话状态栏。
- 不给 `loopback` 目标补这道闸。

## 4. 验证

`node test/unit/node/index.js --run src/vs/platform/universeAgent/test/node/connectionResolver.test.ts` 在槽内 `npm run compile-client` 之后。这是 Node 单测。

新增或改写的断言：

- `0.0.0.0`、`0.1.2.3`、`0.255.255.255`、`000.000.000.000`、`::`、`[::]`、`0::0`、`0:0:0:0:0:0:0:0`、`::%eth0`、`[::%eth0]`、`::ffff:0.0.0.0`、`[::ffff:0.1.2.3]`、`::ffff:0:1`、`::FFFF:0.0.0.0` 在 `allowPrivateNetwork: false` 时于 `resolveHost` 之前就是 `private_network_denied`。
- 注入的解析结果 `['1.1.1.1','0.0.0.0']`、`['2001:db8::5','::']`、`['8.8.8.8','::ffff:0.1.2.3']` 整次拒绝，失败 JSON 不含这些地址。
- `allowPrivateNetwork: true` 时 `0.0.0.0`、`::`、`[::]`、`0.1.2.3`、`::ffff:0.0.0.0` 仍成功，方括号不留在 `resolvedIp`。
- `1.0.0.0`、`::2`、`0:0:0:0:0:0:0:2` 在未勾选时仍成功。既有公网字面量与 `fec0::1` 保持放行。
- `loopback` 解析结果含 `0.0.0.0` 与 `::` 时仍成功，路径仍是 `loopback`。
- Hub：authority 解析为 `['0.0.0.0','::']` 时两次 resolve 都是 `private_network_denied`，票签发两次。

## 5. 只读自审

本稿在同一会话内写完后自审。没有另开只读 reviewer。因此状态保持 `draft`，不标可签收。实施按本节核对后的合同全文做，不收窄。

- 审查写的是前缀 `0.0.0.0/8`，不是只拒绝 `0.0.0.0` 这一台主机。只拒全零会留下 `0.1.2.3` 这条「本网络」字面量。合同拒绝整段。
- `::` 与 `::1` 不是同一类。未指定地址是十六字节全 0。把「第一字节为 0 的 IPv6」都拒绝会误伤 `::2`。合同只拒绝全零。
- IPv4 映射已经走内嵌四段。给四段规则加上第一段为 0，映射形式跟着拒绝，不必再写一套映射特例。
- 直连字面量必须仍在 `resolveHost` 之前拒绝。Hub 今日只分类解析结果；本稿不把 Hub 改成另一套提前判定，只要求解析结果命中时拒绝并删掉该臂缓存。
- `loopback` 今日把第二参设为 false。本稿不把未指定地址特殊地送进这道闸。
- 失败码与理由字符串已存在。新码会碰到连接服务与状态栏，那两个文件不在本冲突域。
- 单测里把 `::` 与 `0.0.0.0` 当成公网放行，是缺口本身，不是要保留的合同。实施时移出放行表。
