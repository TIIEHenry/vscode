---
title: "D1387 正式方案规则16独立审查"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "C最终C0/I0；原I1的stale/status-generation文案已改入并增量复读，两Minor保留；尚无实现或新产物验证"
---

# D1387 正式方案规则16独立只读审查

2026-10-26；reviewer C `/root/voice_cold_start`，非 Sources 作者。只读 J，不改 J 文件、不编译/typecheck/transpile/out/启动/单测。本报告只写 /tmp。

正式稿：/home/clarence/Projects/Agents/vscode-WorkTrees/J/dev/plans/sources-open-dispatch-and-conversation-target.md，读时 SHA256 `63b04c56a664edbf3149358d07123882b14395cf2ffdd67bddf78f52c7e4512f`，status draft。

完整读取 Astra 初稿 `/tmp/vscode-sources-open-astra-decision.md` 与最终 `/tmp/vscode-sources-open-astra-final.md`、正式稿全部136行及 d1387-before；核对当前 PRD005/009、Sources overview/INDEX、editor-part-tabs、B2 diff-footprint 的实际 diff。另读真实 finder/EditorService slot链、SCM官方分派、API handler context mixin、Sources helper/status/move，以及 sourcesDiffRefHelpers.test.ts:126–164。直接查机器 source manifest、routing/plans trace、wide-control、fixture-before-after；这些是 J 的 before 证据，不是本 reviewer 重新运行。

## Strengths

- 两根因被准确分开：Preview 漏执行主线程 API DTO；Conversation 准确具体组在 finder excluded 分支被改投 main。机器 trace 的9/10→0与open/replace分支、公共无slot真diff正对照相符；五份已加载源摘要保留，未把before写成after。
- finder条件保留typed输入围栏，采用当前conversationParts/groups严格成员：对象必须同一实例、数字必须有效getGroup解析且等于resolved group；不借excluded旗放行。包含token正例、普通输入、无目标/错误main、其他excluded、未解析id、过期/伪造同id对象负控，并要求public findGroup+真实EditorService。
- SCM分派复用官方两个常量，open第4/diff第5context，DTO optional槽完整；provider显式options保留优先。全部真实调用方包含move/viewTitle，command与resource.open互斥各一次，不改extHost、不fallback、不泛化changes。
- slot/input身份与副作用收敛到实际匹配宿主；同条reveal不用对象变化判失败；provider目标列/背景/保焦点不得污染当前Beta的身份、pin或close。direct pane/undefined 与 command/custom void严格区分，未知void不发明可见成功探测器。
- 当前generation成功仅清自己open error，读/写错误保留；false/stale/reject与Review load/pending/Panel false都明确。三owner×两slot、真实两库两侧哨兵、完整URI/宿主/焦点/标签/Reviewed、move往返和原C1/C2新产物成功都在非作者after矩阵中；原before不能代签。
- PRD先改事实再系统与正式稿，不动ADR owner选择、不升PRD、不重开D1382/D1386，源码实现与唯一验证车道仍后置。

## Critical

0。未发现范围内须阻断的方案错误。

## Important

I1（已改入，见增量复读；当前 open Important 0）：原 §3.4表把 helper 显式返回 `'stale'` 与 open-status 旧 generation 混成“均不标”，超出了当前实现/已签完成语义。实际 ReviewList:666–697、OpenSelected:60–102 先经 markReviewedAfterSuccessfulOpen（仅opened===true才resolveKey并按捕获entry及write/pairing门mark），open-status代次只闸随后状态写入。请拆为：helper `'stale'` 不mark；旧open-status代次不写较新状态，不能据它推断void委托未可见或一律禁止旧委托mark。本轮保留原mark语义，不新造session pin/通用可见成功协议。J已主动指出同一问题；这是须精确改稿的合同澄清，非要求新增生产策略。表外“旧generation不改任何新状态”与PRD“结果过期”也须按各自通道说明，防实施者把status计数器顺手变成全局mark授权。

除此项未发现实质设计冲突。尚未实施/运行，不能据本review提前宣称red/green或独立after通过。

## Minor

1. 实施时须持续区分两种close：§3.2是SCM slot当前input匹配后的局部身份/pin/replace副作用；不是改写`moveActiveDiffTo`捕获源宿主的关闭政策。已核当前move resolve false/stale仍走closeHost，只有缺失Conversation leaf保源，126–164明确false时panel清理/editor关闭。正式稿§4.2已明确保留，因此非阻断、无要求扩写失败保源；建议将既有测试作为回归点直接保留，不借此次辅助重构改变。
2. 文档健康结果需按实际delta记录。当前新改文档链接是否0断链由J专项结果支撑；我没有运行其health，不能将全树9/73等warning笼统称既有基线，也不以其他主题46替代。此项属交付准确性提醒，不是源码/产品设计阻断。

## Assessment

最终 C0/I0；I1已由作者按既有合同改入并由本reviewer增量复读，规则16通过。作者可完成门禁、标accepted并单独方案commit，然后按范围实施；不要求新策略。保留两条非阻断落实提醒，最终闭合仍须唯一merge旧生产真实业务red→newgreen及非作者三owner真Gitafter。未对数字组/伪造成员、move往返、迟到命令、实际新产物或全量编译作已运行断言。


## 增量复读：I1已落实

J按反馈将§3.4拆为两行：helper明确返回stale不mark/不写打开状态；旧open-status代次只阻状态，不自行扩成一切旧void委托不mark，明确捕获entry+write/pairing门、无session pin。PRD009验收8已写“明确返回过期”，Sources overview表写“helper返回stale”。本reviewer直接重读三处实际文件及其stale/generation邻文，现与生产分层和Astra I3一致；当前Important0，原I1保留为审查历史，不要求新行为。

最终复读正式稿 SHA256 `970bac28c99e456d93e0970af0e361a7d802d2ee42bf6632b545fca5f487759d`。该复读仍纯静态；J尚未accepted/commit/实施时采样，不构成新green。前述move关闭边界与docs warning分类提醒保留为非阻断Minor。
