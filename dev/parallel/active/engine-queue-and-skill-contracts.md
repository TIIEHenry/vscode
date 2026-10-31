---
title: "队列与技能跨仓实施看板"
type: progress
status: completed
phase: N/A
updated: 2026-10-27
summary: "父窗口唯一写入/编译，独立reviewer只读，保留两仓既有WIP。"
---

# 队列与技能跨仓实施看板

方案：[实施方案](../../plans/engine-queue-and-skill-contracts.md)。

| 任务 | Owner | 状态 |
| --- | --- | --- |
| 跨仓合同与独立评估 | root + review_protocol_closeout（只读） | completed |
| 引擎proto/实现/聚焦测试 | root（唯一写入车道） | completed |
| IDE wire/恢复/界面与回归 | root（唯一写入与out车道） | completed |
| 规格、行动层与scoped commit | root | completed |

不使用实现子agent，不碰其他主题WIP；IDE编译锁 /tmp/vscode-compile.lock，引擎 /tmp/universeagent-gradle.lock。

实施证据见方案末节；真实队列行编辑保持关闭并登记后续，生成中Send/Enqueue与50061真实联调未签收。
