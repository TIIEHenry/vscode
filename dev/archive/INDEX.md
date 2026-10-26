---
title: "归档索引"
type: index
status: accepted
phase: N/A
updated: 2026-10-26
summary: "dev/archive 登记表：过时文档只移入不删除；健康检查跳过本目录"
---

# 归档

过时的 plan / progress / 分析文档按 [DOCUMENTATION.md 规则 7](../../docs/DOCUMENTATION.md) 移入本目录，`status: archived`，并在下表登记。`scripts/check-docs-health.py` 跳过本目录，归档文件内的链接不再要求有效。

| 文件 | 原路径 | 归档日期 | 取代者 / 原因 |
|------|--------|----------|---------------|
| [status-wave-2026-10-16-retained-2026-10-26.md](status-wave-2026-10-16-retained-2026-10-26.md) | `dev/progress/status.md` 2026-10-16 第十二批至第一批 | 2026-10-26 | [status.md](../progress/status.md) 保持 ≤200 行，历史完整保留 |
| [status-2026-10-11-12-retained-2026-10-26.md](status-2026-10-11-12-retained-2026-10-26.md) | `dev/progress/status.md` 2026-10-11–12 五条历史记录 | 2026-10-26 | [status.md](../progress/status.md)（当前迭代账保持 ≤200 行，历史完整留存） |
| [status-current-session-slot-catalog-2026-09-05.md](status-current-session-slot-catalog-2026-09-05.md) | `dev/progress/status.md` §Current Session | 2026-09-05 | [status.md](../progress/status.md)（docs-burden S4 当前迭代账） |
| [status-current-session-2026-09-30.md](status-current-session-2026-09-30.md) | `dev/progress/status.md` §Current Session | 2026-10-01 | [status.md](../progress/status.md)（对齐 `7cf1474419e`） |
| [status-current-session-2026-10-05.md](status-current-session-2026-10-05.md) | `dev/progress/status.md` §Current Session | 2026-10-06 | [status.md](../progress/status.md)（超过 200 行上限归档） |
| [status-wave-28-2026-10-13.md](status-wave-28-2026-10-13.md) | `dev/progress/status.md` Wave 28 | 2026-10-13 | [status.md](../progress/status.md)（当前调度留在 200 行内） |
| [status-wave-29-2026-10-16.md](status-wave-29-2026-10-16.md) | `dev/progress/status.md` Wave 29 | 2026-10-16 | [status.md](../progress/status.md)（当前条目留在 200 行内） |
