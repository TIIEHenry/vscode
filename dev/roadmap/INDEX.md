---
title: "Roadmap 索引"
type: index
status: active
phase: N/A
updated: 2026-09-12
summary: "行动层 roadmap 入口；D390 planned（无窗 vscode-web，未实施）；D389 planned（prepare-deb 三次 sysroot blocked）；D388 已闭（未提交）"
---

# Roadmap

任务勾选在 [`active/`](active/)。方案 HOW 仍以 [`plans/INDEX.md`](../plans/INDEX.md) 为源；本目录只拆可验收 checkbox。

| 切片 | 状态 | 说明 |
|:-----|:-----|:-----|
| [D388 packaging-p1-asar-machine](active/d388-packaging-p1-asar-machine.md) | `closed`（第二次 gulp exit 0；asar 两包已扫；未提交） | 无窗 P1 子集：gulp + asar + remote 排除；WT 池 dest 独占；不关 D18/D20（两行）/D12 |
| [D389 packaging-p3-linux-deb-machine](active/d389-packaging-p3-linux-deb-machine.md) | `active` / deferred-gaps `planned`（实施 blocked：prepare-deb 三次 sysroot TimeoutError） | 无窗 Linux-deb 子集：dest 身份锁绿；prepare-deb 三次 exit 1；八档进树/进包未跑；不关 D18/D20（两行）/D12 |
| [D390 packaging-p2-vscode-web-machine](active/d390-packaging-p2-vscode-web-machine.md) | `active` / deferred-gaps `planned`（方案已收，未实施） | 无窗 vscode-web 排除面：dest 独占；产物树无 `@grpc/grpc-js`；不关 D389/D18/D20（两行）/D12 |
