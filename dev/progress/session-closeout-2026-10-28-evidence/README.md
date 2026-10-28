---
title: "2026-10-28 收尾核对证据"
type: reference
status: accepted
phase: M7
updated: 2026-10-28
summary: "主工位WIP来源与订阅静态审计；运行结果由唯一merge追加，历史数字不代当前验证。"
---

# 收尾证据

用户要求收尾，停止新增功能；主工位当前 UI 与订阅恢复整文件保留，唯一 merge 负责集成和运行。源快照基于 `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`，包含收尾开始时的未提交路径与字节身份，不作为最终运行证明。

- [开始时主工位清单](initial-main-inventory.json)：只记录当时路径，不锁住后来作者合法完成的补充。初始暂存证据随后由原作者补齐 Esc 三份，最终 Included 以提交为准。
- [订阅静态独立审计](subscription-static-audit.md)：八 TS 与旧产物不能完整对应，原始红绿日志未找到；当前需 fresh 后运行。Automation 仅属 Sessions 保留兼容，默认编辑器共用范围为 AHP / UniverseAgent；D405 / V-S5 真实引擎手测仍未完成。

已知 StubModel TS18048 为本 UI WIP 引入，收尾补显式 session 守卫；跨叶 Composer 全局归属风险交 Astra 判定并由子代理最小修复。修复与当前定向验证、合并后状态及未合入工位结论由最终收尾记录补充，未执行项不写成通过。

- [Astra 设计及源码复核](composer-design-and-peer.md)：修后 C0/I0/M2，当前尚未运行。双 Host 组件回归不冒充双 Lens 默认窗口。
- [完整归属修复差异](composer-ownership-only.diff.gz)与[前后来源](composer-ownership-identities.json)：包含 dispose 清引用；限定差异不代完整主题 diff。
- Esc 原始小日志：[red](popup-red.log.gz)、[green](popup-green.log.gz)、[lint](popup-lint.log)、[types](popup-types.log)，与[原截图摘要](popup-artifact-hashes.json)保留。三份原作者正式 Esc 报告/探针/结果在 UI 证据目录；不重跑历史矩阵。

原始日志/patch 的上下文空白保留于 gzip，解压逐字节等上一提交原件；[压缩身份](raw-artifact-compression.json)记录原件与归档 SHA。原 ae8297add7f 提交前 cached whitespace check 实际失败，随后误继续提交，未将其计作通过；本补修独立提交，不 amend、不改业务源码。
