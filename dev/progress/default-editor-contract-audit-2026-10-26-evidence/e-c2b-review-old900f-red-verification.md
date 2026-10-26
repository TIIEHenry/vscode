---
title: "E三项实现审查缺陷的五个精确旧900f业务红"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "c2b新测试对完整旧900f十四生产模块，5代表实际0过5纯业务AssertionError；15输出/34native身份全部恢复；修订独立peer仍待，不formal合源/完整emit/freeze。"
---

# 三项实现缺陷的精确旧实现业务红

E在原实现peer **C0/I3/M0** 后交不可变修订 **`c2b1266006b7c192fbaaf737e80be25726021fc4`**（父为完整 **`900f772bfd139214651a7c15e82678a1a0ef6f69`**）。新18项`response recovery review`回归仍待最终新green/独立复读签收；本轮只运行作者方案§9.1与父指定的5个代表旧业务red，没有将作者静态检查或代码交付当作已修复证明。原peer报告尚未入库的来源边界见[补修阶段](je-peer-rework-2026-10-27.md)。

[实际runner](e-c2b-review-old900f-red-runner.py)从不可变Git取旧900f相对独立accepted方案5dd7的**全部14份生产TS**，包括旧State、FrameSource、roster、正式projection/renderer/seat/processFold通道，再只配c2b新roster测试。旧producer完整src树为`da5aa1664b65970dc72790749b1101c4534f074f`，新测试AST解析0诊断、没有运行时import新State测试support；旧900f生产来源、全部源SHA、15份实际JS身份和精确OR selector均在[身份JSON](e-c2b-review-old900f-red-identity.json)。未读取作者WIP或合入其新生产源码。

开车时正式源码HEAD为`8f610de2494dc8af55f1e25f66e0e21a4182bb83`、src为`7fa3c86d152420afeb66c6038bd961bb6d5b8f4b`；该main5df源码尚未由本lane新emit。独占`/tmp/vscode-compile.lock`并先核全局compile/typecheck/transpile进程0匹配，持锁覆盖临时转译、测试及恢复；实际UTC `2026-10-26T16:16:23.328104+00:00`至`2026-10-26T16:16:26.116929+00:00`。

## 五个实际业务失败

[完整原日志](e-c2b-review-old900f-red.log)实际加载下面5个代表，**0 passing / 5 failing、exit1，5个均为纯业务AssertionError**，无missing API/module、TypeError、加载/类型/扫描/timeout充数。

| Important / 实际测试 | 实际旧实现断言落点 | 未到达部分 |
| --- | --- | --- |
| I1 timeline-only clientTool accepted | 真实点击、accepted cleanup后重复公共`respondClientTool`返回true，应false | 随后的RPC次数断言未执行，不把“已测RPC2次”当日志事实 |
| I2 public disconnect | 真scope同步通知内permission/question/clientTool公共响应返回`[true,true,true]`，应全部false | 后续零unary断言未达 |
| I2 published identity switch/cache owners | adoption同步通知内三公共响应也返回`[true,true,true]`，应全部false | 后续RPC/engine-cache owner断言未达，本轮不声称已验证缓存归属 |
| I3 same-generation baseline question options / old false | 同语义replay仍busy正控通过；改变已materialized row后DOM仍`aria-disabled:true`，应false；pending引用不变 | 参数化旧false尚未完成，不声称其完成回调已执行 |
| I3 same-generation baseline clientTool args / old accepted | 同样在语义替换后真实process-fold CTA仍busy而应解除，pending引用不变 | 参数化旧accepted尚未完成，不声称其cleanup已执行 |

它们击中原900f三Important的实际公共/DOM缺陷，与此前[new900f测试对ad80初始旧链6红](je-preintegration-old-red-verification.md)属于不同生产基线。没有复跑全18项或将“代表5红”写成完整矩阵结果；新候选green仍须实际运行全部`response recovery`、完整roster及正式方案相关套。

## 输出恢复与当前阶段

15份临时输出均已恢复原身份：14个原存在输出以备份原字节回写，新State输出`out/vs/platform/universeAgent/common/conversationResponseState.js`运行前不存在，结束后仍不存在（只删除本次创建的临时文件）。同时明确的**34份ad80 native采样SHA全部恢复**，HEAD/src/worktree clean前后不变；不把这份旧900f混合测试输出称为正式合源、整out与当前main源码同构建或最终freeze。

E c2b已交付但**独立Astra复读仍待，当前不可formal queued**。J4d49已具备[静态peer C0/I0/M1闭合与2纯并发旧红](j-4d49-overlap-old65d-red-verification.md)，整波仍等待E的Critical/Important闭合。后续只在候选/peer均接受后真三路正式接入并一次统一完整emit/相关全套/独立默认编辑器after。本轮无全量emit/新green/freeze，无main WIP/root out写入、主ff重试或push，方案与PRD不升级。

[本轮原始清单](e-c2b-review-old900f-red-artifact-inventory.json)按字节保留runner、实际命令、日志及源/输出/恢复身份，ANSI和尾空格不清洗。

文档收尾：生成状态`--check`通过，[health原日志](e-c2b-review-old900f-docs-health.log)0 errors / 46既有链接warnings、587 Markdown，status185行；排除原始`*.log`后的diff空白门禁通过。
