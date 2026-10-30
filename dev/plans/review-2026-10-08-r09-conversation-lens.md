---
title: "审查 r09：conversation-lens"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "2 条，最重是回合编辑尚未退出时，已脱离文档的 composer 不会再挂回，输入区会从界面上消失。"
---
# 审查 r09：conversation-lens

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r09-1 中
- 症状：回合编辑还开着时，composer 一旦不在文档里，就不会再出现在原回合或底栏，直到退出编辑。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts` 第 457–470 行
- 引用：`if (!host.composer.isConnected) { return; }`
- 为什么是问题：同一函数把 composer `appendChild` 进回合编辑宿主（第 464 行）。宿主被时间线拆掉或滚出虚拟行后，composer 一起脱离文档。编辑面仍判定为活着时，这里直接 return，不挂回宿主，也不像编辑结束后那样走到第 473 行的 `ensureComposerInCluster`，并且不预约下一帧。节点自己变不回 connected，之后的同步还是 return，输入区一直不在界面上。
- 方向：脱离文档时，编辑宿主仍在文档中就挂回去，否则先收回簇里再等下一帧。

## r09-2 低
- 症状：读不到回合列表时，回合编辑仍被当成进行中，底栏收回和编辑态结束都不会发生。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts` 第 425–426 行
- 引用：`?.some(entry => entry.id === host.editingTurnId && entry.kind === 'user') ?? true`
- 为什么是问题：队列编辑在名册读不到时视为编辑面结束（第 418–419 行）。回合编辑在 `getTurns` 缺失或返回空值时，可选链得到 `undefined`，`?? true` 却当成用户回合还在。`syncComposerPlacement` 因此留在回合编辑分支：composer 已不在文档里就按 r09-1 丢掉，编辑宿主还没挂上就每帧再调自己（第 468–469 行），都走不到收回底栏。同文件第 528 行对 `getTurns()` 直接 `.find`，空结果会当成没有这轮。
- 方向：读不到回合时与 `.some()` 为 false 一样，视为编辑面已结束。
