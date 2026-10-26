---
title: "D1387 custom newTab 窄例外方案增量审查"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "规则16独立只读复核J两份实质澄清稿，C0/I0；API取消预pin、custom保留预pin窄例外及诚实成本、有序DTO身份和完整原范围均保留；不签源码与运行"
---

# D1387 custom newTab 窄例外方案增量审查

Reviewer `/root/sources_audit`，非 J 作者。本轮只读 J 文档与相关既有合同，没有修改 J、产品、merge、out，没有编译/typecheck/transpile或运行应用/测试。D 仅新增本审查报告。审的是 custom newTab 实质澄清的可实施边界，不对当前未提交源码 WIP 作通过结论。

审稿精确身份（2026-10-26）：

- `dev/plans/sources-open-dispatch-and-conversation-target.md`，frontmatter `review`，SHA-256 `9cc2e07b6a638568d0d13dab5e4e25de7fba31e8ca3a85e228ff5c6a55c6cbf8`。
- `docs/systems/sources/overview.md`，SHA-256 `be5574b08e00fd1077a29d26bca0fd327b81ded6b157aba5eeab708f2054acc2`。

完整核对上述两稿及其相对 J HEAD 的文档 diff；重读 PRD-005/009、原方案规则16、[独立实现审查](d1387-implementation-peer-review.md)及父转达的最新 Astra 裁决。实际 `git diff --check`（仅两文档）通过。没有把旧静态结果或 before 当当前运行结果。

## Strengths

- §3.2 明确分开 API 与 custom。API 不预pin旧标签，context 的默认 pinned新input维持常规newTab；provider显式 column/pinned/preserveFocus 优先，包括 pinned:false，不能由 Sources 后置 pin 反向覆盖。API另列、后台或reject的当前无关标签不得被Sources预处理pin/close。
- custom 的接口确实只有 `open(preserveFocus): Promise<void>`，不能注入pinned/column。保留仅 custom+newTab 的既有旧preview预pin，避免真实替换后无法恢复旧标签；同时明确 no-op/reject/另组/外部也可能留下该pin，不再承诺custom零pin副作用。例外只发生于分派前的旧preview保留，不授权分派后误标identity、pin新input或关闭旧input。
- API diff 必须用实际DTO的有序original+modified，API open须单资源类型和DTO URI；单侧sourceUri/quickDiff不能冒认同文件另一比较。旧active比较不能遮住另一组真实新比较。custom仅成对multiDiff URI或已记同scmResource/groupId可信身份；不足保留void完成且不做后置副作用，没有改成失败或二次dispatch。
- 三owner、两slot、同条reveal、全部真实调用方、准确Conversation对象/数字目标与围栏负控、当前打开错误恢复、helper stale与status-generation区分、Review write/pairing门及move既有策略均保留。没有缩成Preview-only，也未把所有false/stale改成保留源宿主。
- 回归清单区分API真实官方handler的options优先级、custom预pin成本与后置零副作用；拒绝以一个activeEditor stub变化当真实打开。原最小业务red、完整相关套和非作者两库三owner真实after要求未删。
- PRD-005将Diff归属交PRD-009；PRD-009验收7保留owner/slot，验收8明确provider完成语义。两者未承诺custom零pin，本轮澄清没有升产品状态或悄悄变更产品层。真实内容仍必须由两侧文件验证。

## Critical

0。未发现需要阻断本实质澄清的设计错误。

## Important

0。原实现审查 I1/I2 仍待源码补修与验证；本次只确认补修设计准确，不把它们标成实现已解决。最新裁决对原报告的补充是：取消预pin限API，custom newTab保留本文明示的窄例外与成本；“custom信息不足不做identity/pin/close”只指分派后动作。

## Minor

1. 审时frontmatter是review，§1/§5/§7仍用“已过规则16/保持accepted”，§6仅旧C审查。作者签收时应补本轮reviewer、审稿SHA与结论来源，区分历史首次门禁与本次实质澄清；§6的73warnings/status165行仅为当时历史日志，不是本轮门禁。作者完成这些状态文字整理后再生成状态列与提交，不可把本报告当运行结果。
2. API显式pinned:false可以覆盖newTab常规保留意图，当前正文已明确provider优先；实际handler测试与after应按最终有效options断言，不能又按“newTab总保留旧preview”覆盖provider选择。custom保留成本也须分别报告，不能把API零pin与custom预pin合并成一句总承诺。

## Assessment

**本次规则16 C0/I0，可按本精确澄清稿签收并继续完整D1387补修。** 两项Minor交作者当轮整理，不要求人类决策。方案是否已提交、源码是否正确、业务red/green、完整套件与真实after仍需后续不可变证据；D1387保持open，不升PRD、不声明产品验证通过。
