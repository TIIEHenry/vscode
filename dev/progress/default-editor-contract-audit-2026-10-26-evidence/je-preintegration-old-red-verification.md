---
title: "J/E 不可变候选正式接入前旧业务红"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "1ac新测对65d宿主4真红、并发2有业务误记但混有hasListeners夹具错误；900f新测对ad80旧链6真DOM红，34native身份已恢复，未正式合源/新绿/after。"
---

# J/E 正式接入前旧业务验证

> 以下是旧red采样历史。后续E900f实现peer C0/I3/M0退回occupied补修、当前不可formal queued；J八处listener夹具修订/两旧red复跑待，现行来源与边界见[补修阶段](je-peer-rework-2026-10-27.md)。原始日志与采样计数不改。

本轮只消费不可变 Git：J `1ac1fdc4ae2db39f4e2c3a49e014bcc629b40419` 的 Changes 测试、精确旧 helper `65d2288036fdad74ab607e231d3db758fa397aa8`，以及 E `900f772bfd139214651a7c15e82678a1a0ef6f69` 的 roster 测试。未读取作者 WIP，未正式合入字母源码。源码 HEAD 始终为纯文档 `8781acd0b2dccbc46fec5ede3022fbe1f1ee6dc5`，src 始终为实际[全量编译过的 ad80/030def](main-180fc-baseline-verification.md)。两次开始前全局 compile/typecheck/transpile 车道扫描均无匹配。

## J 宿主与并发旧实现

[实际 runner](j-1ac-host-overlap-old65d-red-runner.py)只临时转译两份 JS：新 Changes 测试 SHA256 `45cf248ffa6588cefeb10bc1c36e371e5bf7d256549481ac56f42a3fcc7b2be9`、旧65d helper SHA256 `f13693e1de22a0a2b60e966ced1bcdef0d79a9257195b8637fa2cc474bccad37`；其余使用 ad80 原生产物。没有加载1ac新helper，不把此输出组合称为已正式合源或整out同构建。

- `delegated host official` 实际加载 file/diff × newTab/replace **4项，0 passing / 4 failing，exit1**；[原日志](j-1ac-host-old65d-red.log)中四项都到真实 `EditorParts` / `CategorizedMainEditorPart` / `EditorService` 与官方 handler 后的业务身份断言。A仍active、B实际inactive且不在visible panes，旧代码把A原identity错写为index、SCM严格引用false，B实际input的identity却undefined。这四项是业务旧红，没有scan/加载/类型/timeout代替。
- `Sources overlap same tuple .*settles first` 实际加载g1/g2两种结算顺序，**0 passing / 2 failing，exit1**；[原日志](j-1ac-overlap-old65d-red.log)实际出现最后settle的g2/g1覆盖原old身份，SCM严格引用false。但同一个断言另有**测试夹具错误**：`listening: harness.events.hasListeners`取到方法对象，期望却是false（实际为 `[Function: hasListeners]`），须原作者改成正确调用并重新交不可变候选。这两项保留实际业务误记事实，**不作为无夹具问题的干净red门禁或未来green证明**；已转父与独立reviewer，不在merge削改测试。

[两轮命令、源/JS、恢复与34份native身份](j-1ac-host-overlap-old65d-red-identity.json)保留运行前后SHA。原R1/R2、14根因与357历史套均未重复执行或覆盖。1ac新29项全部green仍待最终接入后实际运行。

## E unary恢复旧实现

[实际 runner](e-900f-business-old-ad80-red-runner.py)先对不可变新roster测试做 `createSourceFile` AST解析0诊断，并核无新 `conversationResponseState` runtime import、无新增begin API调用；只把可选lease投影透传给真实host/projection。selector `response recovery business` 展开并实际加载permission/question/clientTool × false/reject **6项，0 passing / 6 failing，exit1**，见[完整原日志](e-900f-business-old-ad80-red.log)。

permission/question四项已经完成各自false/reject，实际roster → FrameSource lease → projectSnapshotToEntries → TimelineHost/renderer DOM未出现 `wire refused` / `wire rejected` 的座位就地错误，准确业务断言失败。clientTool两项先在正式document-flow process-fold CTA忙碌断言失败：`aria-disabled`实际false、应true；它们尚未走到各自false/reject完成，**不声称这两项已验证完成回调后的错误恢复**。六项都是实际DOM业务缺陷，未用缺模块、TypeError、加载、类型或timeout计红。

[身份JSON](e-900f-business-old-ad80-red-identity.json)逐字比较7个旧核心TS（roster、FrameSource、SessionView、renderer、host、QuestionSeat、ProcessFold）：`09f6da72d3056c0c28d4bfaa8b0ceb6dc809b62a`与ad80全部相同；对应7个旧原生JS运行前后未变化。本次只临时换新roster测试JS，没有刷新任何E生产或新ResponseState helper。

## 输出恢复与后续门槛

所有临时JS均在finally以开始前原始字节回写；两轮独立复核均 **34份已登记native输出SHA零变化**，E另核7核心旧JS不变，HEAD/src/worktree clean不变。此恢复只证明明确采样范围，不把整个out冒称同构建、也不把此前65d虚拟pack重新变成live。原日志ANSI、空白与尾空格按[7份原件清单](je-preintegration-old-red-artifact-inventory.json)逐字保留。

旧red采样时J/E完整源码均由父确认交付queued；后续E实现peer未过已退回occupied，现行阶段见文首。J夹具补修与最终独立codepeer签收仍待。正式P2须先核明确的最新已提交main基线，按真三路保留双方再串行接入不可变候选，实际完整compile-client、J全部29与原完整相关套、E response recovery/完整roster及全部相关套新green后，才给非作者最终产物冻结通知与after。当前无新green、无freeze/after、无主ff重试/root out/push，D1387与PRD状态不提升。

文档收尾：生成状态`--check`通过，[本轮health原日志](je-preintegration-old-red-docs-health.log)为0 errors / 46既有链接warnings、580 Markdown，status178行；原始日志排除后的diff空白门禁通过。
