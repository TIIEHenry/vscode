---
title: "D1387 比较身份补修源码独立审查"
type: reference
status: review
phase: M7
updated: 2026-10-26
summary: "J89f3e5a六路径补修静态核查：原API预pin及单侧身份问题已按澄清落实，28项回归源码有意义；同tuple双组的实际宿主选择风险待Astra裁决，不签实现C0/I0或运行通过"
---

# D1387 比较身份补修源码独立审查

审查者 `/root/sources_audit`，非 J 作者。审稿不可变提交 `89f3e5a6a1782b928bb0bdc2c90c5fec8f7fdc68`，父为已过[独立规则16澄清](d1387-custom-newtab-plan-review.md)的 `a76d062f297ebc36f1a852ee260e2a667644de36`，原完整实现在 `23f8701c8d2`。完整阅读本次六路径diff、两份TS全文及四份文档变化，并结合原26文件[独立实现审查](d1387-implementation-peer-review.md)、官方API handler、Sources move/write-ref链。没有修改 J、产品、merge、out，没有编译/typecheck/transpile、运行测试或启动窗口。D仅新增本报告。

精确TS SHA-256：

- `sourcesChangeEntryOpen.ts`：`f13693e1de22a0a2b60e966ced1bcdef0d79a9257195b8637fa2cc474bccad37`。
- `sourcesChangesList.test.ts`：`418d9f2fff2bc3b90387b19f79dd8b12a53e968f525746d25540493803cd8693`。

实际检查 `git diff --check 89f3e5a^ 89f3e5a` 通过；本轮新增测试diff没有发现新增any/unknown/never宽cast、skip/only或TS诊断抑制。这是静态核查，不是类型或业务测试通过。

## Strengths

- helper:163 的预pin严格限 `!isApiScmOpenCommand && slot===newTab`，API no-op/reject不先pin无关旧preview；custom窄例外及no-op/reject/另组成本保留，没有删掉custom真实newTab保留旧preview语义。API仍由官方context提供默认pinned，provider显式options优先，后置不反向pinAPI新input。
- API diff的实际DTO original/modified有序双侧都匹配，API open排除Diff/side-by-side并校核单资源URI。支持实际URI组件和open字符串；不借quickDiff或sourceUri单侧改identity。custom仅成对multiDiff元数据或已记同resource/group可信身份；不足保留void、无额外dispatch、不做后置identity/pin/close。
- 28项新增用例确为业务场景：4项API newTab resolve/reject零旧pin/close；2项真实官方handler的column/options优先级；2项官方handler接真实EditorGroupModel，分别证明默认新input pinned保旧和provider pinned:false可替换旧preview；8项newTab/replace×no-op/reveal/背景/当前比较身份；1项API file不冒认同URI Diff；9项custom三slot×no-op/reject/未知背景成本；1项custom真实组模型保旧；1项已有可信身份reveal。
- 新回归的预pintrace、identity WeakMap、组模型实际preview/tab状态、官方handler输出均可观测，未复制生产匹配算法。HEAD/index同modified的负控与不同quickDiff原始侧专门击中旧单侧OR；旧生产R1/R2的精确red应由唯一车道实跑，不用类型失败充数。
- 真实handler与模型测试没有mock被测handler/mixin/EditorGroupModel；其mock editorService只收集公共打开请求或将真实model作为宿主，这可证明相应层的options/preview规则，不能证明真实renderer pane/文件两侧。文档如实保留唯一车道完整套与非作者after义务，没有借作者静态lint升格运行结论。三owner、两slot、全部调用方、finder/fence与状态恢复沿原完整实现保留。

## Critical

0。未发现推翻当前完整D1387方向的缺陷。

## Important / 待裁决的宿主风险

原I1（API预pin）及I2（单侧比较误配）在该源码层已按澄清修补，仍待运行。另发现独立于“不同original”负控的实际宿主歧义，已报父并转Astra，**未定级前不能签整体I0**：

`sourcesChangeEntryOpen.ts:280–294` 仍依次查activePane、动作发起组active、所有visible panes；第一个完整URI匹配即返回。它读取DTO两侧，未读取其column来区分宿主。若组A旧active input为 O→M，provider明确column指向组B且在那里打开另一input的同一 O→M，A仍active（例如preserveFocus/background），则第一个匹配仍是A。helper:170会把新row的groupId/scmResource写到A旧input；B实际目标没有被该次记身份。若同URI在多个SCM组，后续B中的move由 `resolveSourcesChangeRefFromEditor` 退回无记忆的URI查找，可能因多组歧义丢失准确group归属。

这是代码路径上的条件性风险，不是本审查已经运行观察到的产品失败。API postpin为0，且同条matches时replace通常不会关旧input；不能据此推断“宿主身份不重要”，也不能直接声称已发生错误写操作。

现有8项身份矩阵的 `background comparison` 在测试:295–299使用旧HEAD、新index不同original；因此旧active不匹配且能走到visible正确背景pane。`same comparison`只在同一组复用previous，没覆盖“相同完整tuple、不同group/input、显式provider目标另组”。真实handler优先级测试验证column传给editorService，但不把这个column结果接回身份候选选择，不能关闭此风险。

建议Astra核实官方column解析、相同DiffInput是否可能跨组独立实例及准确host识别，裁定需补准确目标解析或多候选保守不做副作用，还是在有证据的既有约束下作为限制。必要业务回归应以真实官方handler把明确column解析到B，A/B各有独立同tuple input且A仍active，断言旧A identity不改、B有正确新identity、无无关pin/close，包含newTab/replace及公开move-ref正控。不要只把旧original改不同来使新测试容易通过，也不改void完成兼容语义。

## Minor / 验证边界

本次未另列必须改稿的Minor。作者报告的两TS语法0/lint0错误仍为静态记录；本审查没有复跑其lint、类型、28项测试或整套，不把唯一车道同时进行的旧23f red/最终green推成这个新风险已闭。原完整业务red、真正新生产green、相关完整套、全量编译与新冻结产物来源、非作者实际窗口after必须逐项以该车道最终证据说明。

## Assessment

原两项补修与有意义回归源码已静态落实；**新同tuple双组宿主风险待Astra定级/处理，当前不签整体实现通过或C0/I0**。父安排下一裁决/执行，审查者释放并发槽，不改产品、不提前启动after。D1387保持open，完整目标不缩小，不声称全量compile0或整个out同构建。

后续：父转达Astra确认该宿主风险为Important/must-fix；J先改方案，D两轮规则16又指出并解决Sources重叠时will无操作关联的Important。精确稿件与第二轮方案C0/I0见[宿主观测与重叠保护独立审查](d1387-host-observation-plan-review.md)。这是后续方案结论，不追改上面的历史源码审查，也不说明新算法已实施或运行。
