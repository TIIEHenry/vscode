---
title: "2026-09-30 十六路方案只读审查"
type: progress
status: active
phase: N/A
updated: 2026-09-30
summary: "十六路方案 2026-09-30 用户签收 accepted，未实施。第二轮无新 Critical。r15-5 为 drop。"
---

# 2026-09-30 十六路方案只读审查

> 规则 15 / 规则 16。审查不改产品源码。一篇方案一个 reviewer，文件互斥。

## 范围

索引：[dev/plans/review-2026-09-30.md](../../plans/review-2026-09-30.md)。每路对照发现稿与 `*-plan.md`，以 HEAD 源码核验锚点、不变量和验证命令。

| 路 | 方案 | 审查 |
|:---|:-----|:-----|
| r01 | [r01-base-plan](../../plans/review-2026-09-30-r01-base-plan.md) | 已改稿：EXDEV 条件、后缀互异、`recovery()` 抛错 |
| r02 | [r02-editor-plan](../../plans/review-2026-09-30-r02-editor-plan.md) | 无新 Important |
| r03 | [r03-sessions-plan](../../plans/review-2026-09-30-r03-sessions-plan.md) | 已改稿：第 2109 行权限、working set 断言、目录标记时机 |
| r04 | [r04-entrypoint-plan](../../plans/review-2026-09-30-r04-entrypoint-plan.md) | 无新 Important |
| r05 | [r05-tooling-plan](../../plans/review-2026-09-30-r05-tooling-plan.md) | 无新 Important |
| r06 | [r06-chat-plan](../../plans/review-2026-09-30-r06-chat-plan.md) | 已改稿：`setValue`、队列检查点、标志范围 |
| r07 | [r07-conversation-plan](../../plans/review-2026-09-30-r07-conversation-plan.md) | 无新 Important |
| r08 | [r08-terminal-debug-plan](../../plans/review-2026-09-30-r08-terminal-debug-plan.md) | 已改稿：三种删除观察 |
| r09 | [r09-contrib-rest-plan](../../plans/review-2026-09-30-r09-contrib-rest-plan.md) | 无新 Important |
| r10 | [r10-workbench-shell-plan](../../plans/review-2026-09-30-r10-workbench-shell-plan.md) | 已改稿：移回 `overwrite: true` |
| r11 | [r11-agent-codex-plan](../../plans/review-2026-09-30-r11-agent-codex-plan.md) | 已改稿：共用解回函数、fork 播种、失败断言 |
| r12 | [r12-agent-host-plan](../../plans/review-2026-09-30-r12-agent-host-plan.md) | 无新 Important |
| r13 | [r13-platform-plan](../../plans/review-2026-09-30-r13-platform-plan.md) | 已改稿：注入对话框，单测不碰 `app` |
| r14 | [r14-copilot-extension-plan](../../plans/review-2026-09-30-r14-copilot-extension-plan.md) | 已改稿：收集范围改成 `*.spec.ts` / `*.spec.tsx` |
| r15 | [r15-copilot-core-plan](../../plans/review-2026-09-30-r15-copilot-core-plan.md) | 已改稿：r15-5 改回 drop |
| r16 | [r16-extensions-plan](../../plans/review-2026-09-30-r16-extensions-plan.md) | 已改稿：status 拒绝夹具改为写坏 index |

## 纪律

- Reviewer 不改文件。产出 Strengths / Critical / Important / Minor / Assessment。
- 父代理核验后再改方案。与 HEAD 或已拍板合同冲突的意见写明不采纳原因。
- Minor 不阻塞。2026-09-30 用户签收：十六份方案 `accepted`，未实施。
