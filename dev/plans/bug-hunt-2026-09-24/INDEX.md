---
title: "2026-09-24 缺陷扫描方案"
type: index
status: accepted
phase: M7
updated: 2026-09-24
summary: "自有代码十六路扫描后的方案已签收。目录与配置 0 条，无方案。开放项随文保留，未实施。"
---

# 2026-09-24 缺陷扫描方案

扫描文在 [bug-hunt-2026-09-24](../../progress/bug-hunt-2026-09-24/INDEX.md)。看板在 [bug-hunt-2026-09-24](../../parallel/active/bug-hunt-2026-09-24.md)。

| 方案 | 说明 |
|------|------|
| [01-connection-trust.md](01-connection-trust.md) | 解析后拒私网、探测不烧拨号票、握手失败码 |
| [02-hub.md](02-hub.md) | 改密、撤设备、目录与 hydrate |
| [03-session-view-host.md](03-session-view-host.md) | 思考块回合号、lease owner、断线详情 |
| [04-session-actor.md](04-session-actor.md) | 重连不开流、历史单飞、重新生成闩 |
| [05-mailbox-seq.md](05-mailbox-seq.md) | 序号索引不再按 64 丢行；铸行失败保留待办 |
| [06-view-patch.md](06-view-patch.md) | 压缩事实数字角色；树刷新 dirty。host / join 不改 |
| [07-grpc-session-stream.md](07-grpc-session-stream.md) | GetHistory 游标用 field 3 的原始 bigint |
| [08-grpc-file-git-shell.md](08-grpc-file-git-shell.md) | 上传 oneof、空 chunk、空 argv |
| [10-conversation-windows.md](10-conversation-windows.md) | 取消的 reveal、副窗回滚、活树父级 |
| [11-conversation-timeline.md](11-conversation-timeline.md) | 按会话登记透镜、工具角色只读行 |
| [12-conversation-roster-composer.md](12-conversation-roster-composer.md) | 回合代理、模型 id、Inbox 查找 |
| [13-engine-preferences.md](13-engine-preferences.md) | 忘记配置、直连、配对码、MCP |
| [14-navigator.md](14-navigator.md) | Team 刷新代数、筛选、最近文件夹 |
| [15-sources-changes.md](15-sources-changes.md) | 越界不收录、hunk 前言、Files 刷新 |
| [16-sources-review-diff.md](16-sources-review-diff.md) | 钉住 sessionId、迁移不先删、搬家宿主 |

`09` 扫描无发现，没有方案。
