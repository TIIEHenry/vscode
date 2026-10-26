---
title: "825三路合成的独立实拍checkpoint"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "source330b689真实默认窗口：Critical0/Important2，D1380未知Stub投影与D1381 Provider窄行碰撞open；组件测试绿不等于视觉全过。"
---

# 实拍结论与证据

Astra独立审查source `330b68911b5a5d11fbac276c90ad3180bec69397` 的fresh merge/out，**Critical0 / Important2**，不签整轮全绿。完整本地报告与截图/测量位于 `/home/clarence/Projects/Agents/vscode/.build/visual-review-astra/followup825/`；`review.md`、`probe.json`与`fresh-manifest.json`绑定来源。截图不入git，reviewer未修改源码/out。Provider两文件语义并集本身无C/I，保留两侧合同。

D1380：既有测试帧源修改Stub工具为缺失toolStatus后，真实展开仍出现完成勾。`conversationSessionView.ts:247` 在renderer前默认completed，legacy缓存又省略明确completed，需保留正式五态和历史roundtrip语义的根因修。证据 `fold-light-300-unknown-expanded.png`、`unknown-frame-evidence.json`；明确完成反例 `fold-light-300-completed-expanded.png`。由D独立工位方案/审查/实现，当前open。

D1381：真实340px Provider行中badge父宽66/48px而配置pill宽88/109px，内容侵入Enabled/Disabled兄弟。整行scrollWidth==clientWidth不能反证碰撞，现有样式测试缺兄弟几何断言。证据 `provider-light-340-overlap.png`、`provider-dark-760.png`、`provider-overlap.json`。完整真实主题/生产Section与现有DI，只替连接读数据，无CSS override或写RPC；C独立工位修复，当前open。

已观察通过：Dark/Light过程折300/720px的混合/取消摘要、明确完成反例与Enter折叠；真实Sources树在Dark/Light/Light+的选择/失焦/返回配色；Connection四主题/两宽的fixture状态正文、语义指示与HC描边；Provider宽行24px与只读文案/焦点动作。Provider窄行由Important阻断，未知Stub链未闭合。未连接引擎/登录/凭据/写RPC，未额外实拍所有utility列表或session roster；本轮287 Electron+14 Chrome是另一来源的组件运行证据。原计划回到accepted待剩余边界真实闭合，不提升PRD。

本地 `cleanup.json` 确认Astra自建Electron3336354/Xvfb3324113已清理。merge测试进程也已退出；系统既有Xvfb :98不属本轮，保留。
