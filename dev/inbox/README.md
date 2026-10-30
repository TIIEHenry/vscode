---
title: "待处理项"
type: concept
status: accepted
phase: N/A
updated: 2026-10-30
summary: "拿不准放哪里的观察和请求，一条一文件，处理完写明去向后归档"
---

# 待处理项

拿不准放进当前知识还是计划时，一条一文件写在 `dev/inbox/<类型>/<主题>.md`。

标题下第一行写 `状态：待分诊。`。处理完时写明去向：转成了哪份计划、写回了哪篇知识、和哪条重复，或者不处理的理由。然后把状态改成 `状态：已完成。`，再用 `python3 scripts/wiki/wiki.py archive <路径> --root .` 预览后归档。

写法见 [工具读取的写法](../../scripts/wiki/formats.md#待处理项)。
