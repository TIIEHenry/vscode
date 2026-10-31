---
title: "Sources Pane v1/v2 正式源码审查：root 转发摘要"
type: reference
status: accepted
phase: M7
updated: 2026-10-27
summary: "root转发原Astra固定5cbc C0/I1/M0与ae902 C0/I0/M0 PASSED并采纳，唯一cleanup I1源码关闭；非terminal raw，runtime与真实接入待lease业务门后另定。"
---

# Sources Pane v1/v2 正式源码审查：root 转发摘要

## 来源边界与固定对象

本文件根据 root 在当前会话向 J 直接转发的原 Astra 正式审查结论与 root 采纳指令整理。它是 **root-transferred summary**，不是 terminal raw、不是原 reviewer message 的逐字副本，也不主张或伪造原 message bytes/SHA。此文落盘不替代原审查消息，作者不新增独立 reviewer 结论。

| 对象 | 正式结论与 root 采纳 |
| --- | --- |
| v1 `5cbc26d02ec1e301ca9e4209031c36da748b2ca1` | 原 Astra **C0/I1/M0**；root 亲读采纳唯一 cleanup I1，生产 guard/真实 resolver/provider/显式 race/4×2+2 矩阵均认可。 |
| v2 `ae902af2497357602cf55b055ef9a98ae2964d43` / src `1d33f3bfd598fa1c6be2c7800f7444dc5c1571b9` | 原 Astra 正式窄 peer **C0/I0/M0 PASSED**，root 亲读并采纳；v1 唯一 I1 在源码层关闭。 |

## 原审查关键结论摘要

v1 新 helper cleanup 的 await Promise.all(operations) 在 replacement successor 的 DI/widget setup 拒绝时可能提前退出，未等待旧 operation settle，违反 accepted §3 的全部收束合同。root 另授的 v2 差异仅为原 async import 添加 Promises，并将该 await 换为 Promises.settled(operations)。

原 Astra 的 v2 窄 peer 核到 test **49403B / SHA-256 `534e0a2a03999937bd705350b6394884697e607aff5ac95866844693514050a3`**，差异精确为上述两处。base/common/async.ts:1913–1928 逐个接住拒绝，等待全部完成后再抛记录的错误；现 finally 在全 settle 后清 Pane/provider/listener/DOM。生产、gates、10 项矩阵不变。结合 v1 其余已认可项，无未闭源码审查项。

上述 PASSED 只代表固定源码审查，不等于 fixture 资格、旧 red、新 green、真实组件运行或实际释放结果。正常预期 provider reject 的源码判断不能转为运行信用。v1 C0/I1/M0 及其原件保留，不回写为原来已过。

## root 采纳与队列

root 已采纳原 Astra v2 正式 C0/I0/M0 PASSED。原 Astra 同时赞同 J 保持固定候选，先由 lease 的固定 baseline（root 简写 **671… / src 3dc…**）完成当前业务门；之后由 root 另定 Sources 的真实三路接入与匹配最终源码的 runtime。此处仅保留 root 提供的简称，不补造其完整对象 ID。

J 状态为 `occupied / 固定候选等lease业务门`；[plan](../../plans/sources-pane-cancelled-model-resolution.md)保持 **accepted / runtime pending**，不标 implemented 或 runtime passed。四窄 Sources 完成、lease 唯一运行 lane 优先和独立 after 合同不变。此次授权只补主题文档，不做源码/static/runtime/工具准备，也不触碰输出/cache；交 docs-only 固定 SHA 后停止等 lease gate。

## 历史原件与本次文档边界

- v1 九份原件完整保持；v2 原门禁、manifest、inverse patch、metadata 与保护数据不改。
- [v2 manifest](included-inventory.json)继续绑定 ae902 历史 candidate；不追改历史 hash，也不将新文档伪列为当时 Included。本次 docs-only Included 与保护门禁单列在[文档收口记录](source-peer-docs-closure.json)。
- 全部 source bytes 不变，方案 §1–§4 设计字节不变。只更新必要计划/索引/board/status/工位池、v2 evidence 入口与本摘要。
- 当前 /tmp 空间紧张的环境提示不当作业务候选失败；不删除任何原件。本次无需临时副本。后续若本主题需要临时交付/保护，使用 `/home/clarence/.codex/tmp/` 下独有目录，避免额外大副本。
