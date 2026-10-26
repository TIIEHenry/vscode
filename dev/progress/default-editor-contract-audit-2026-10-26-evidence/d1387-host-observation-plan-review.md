---
title: "D1387 宿主候选观测与 Sources 重叠保护方案独立审查"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "两轮规则16：首稿C0/I1指出will无操作关联；Astra采纳后以同service sticky歧义、custom wildcard及同步DTO捕获解决，增量稿C0/I0可实施，保留两项Minor；不签源码、运行或after"
---

# D1387 宿主候选观测与 Sources 重叠保护方案独立审查

审查者 `/root/sources_audit`，非 J 作者。仅只读 J 的方案、Sources SSOT 及有关源码；本轮没有改 J、主工位、merge、产品源码或 out，没有编译、typecheck、transpile、运行业务测试或启动窗口。D 仅记录审查证据。此前完整比较身份补修的条件性宿主风险见[源码独立审查](d1387-comparison-gate-code-review.md)；此前 API/custom 预 pin 合同审查见[规则16报告](d1387-custom-newtab-plan-review.md)。

## 1. 精确受审稿

两轮受审路径均为 `dev/plans/sources-open-dispatch-and-conversation-target.md` 与 `docs/systems/sources/overview.md`，审查读取的是 J 工位尚未提交的文档，不把其 HEAD 当作这些 WIP 的内容身份。

| 稿件 | plan SHA-256 | Sources SSOT SHA-256 |
|---|---|---|
| 第一轮宿主观测稿 | `8de7de8c0b8cacaab65d44525851bc0b8d94d761f857033b1d0593889b464e70` | `fd67b9a7a5545ff38f6664cc7dca762c979cf8a8f7dcc5de383c94edda95f61e` |
| 第二轮增量稿 | `7f1d87afc2c5058105afe91125175b5556d915ef00ab387bad97ddc2ff8ea45f` | `07fcba33bd8da9f9dc46e4d56b487056e1ddfe7f89fa63033bab2cfbc4dd6f59` |

受审时 J HEAD 为 `65d2288036fdad74ab607e231d3db758fa397aa8`；`sourcesChangeEntryOpen.ts` SHA-256 仍为 `f13693e1de22a0a2b60e966ced1bcdef0d79a9257195b8637fa2cc474bccad37`，即先前 `89f3e5a6a17` 的生产实现。这两轮都审查拟实施边界，不审查新算法源码。

## 2. 第一轮规则16

### Strengths

- 完整 tuple 与实际宿主分离：provider 在 B 后台打开同 tuple 时，不再以旧 active A 的扫描顺序认领。
- `editorGroupView.ts:1209` 发出请求 input 的 will 事件，`:1274` 随后采用组模型返回的规范成员；方案允许复用既有 `matches` 成员，避免只用 `includes(event.editor)` 拒绝合法 reveal。
- await 后核对 `getGroup(id)` 同对象、真实全部 tabs、完整比较及成员未 dispose；will 未落实、多宿主与 fallback 歧义均不猜。无观测才走 all-parts/all-tabs 唯一候选，不能裸 active 补宿主或再次解析 column 造组。
- 真实官方 handler、组模型与公开服务事件的测试义务覆盖 B inactive tab、规范成员 reveal、多 SCM 身份、后续 move-ref，以及 API file/diff × newTab/replace，未用永久跳过多匹配代替有效 B 正例。

### Critical

0。

### Important

**I1：await 期间匹配 will 的唯一成员不能证明属于本次 dispatch。** `common/editor.ts:1232` 的 `IEditorWillOpenEvent` 只有 editor/groupId；`EditorService:567/583` 在最终 `group.openEditor` 前可能 await resolver/text input，`:182–183` 仅转发组事件，没有 operationId。

本次 R1 代表 g1/resource1，等待期间最终 ABORT 或正常 void no-op；另一路 R2 此时把同 tuple、g2/resource2 真正打开到 B。R1 的局部监听可能唯一看到 R2 的 B。await 后 B 的组对象、完整 tuple、真实成员全部成立，首稿算法仍可能把 B 改记为 g1。finally 释放限制了时间窗，不能提供因果关联。这是静态可达时序，未运行复现。

该意见已报父；父随后转达 Astra 确认 Important/must-fix，采用局部 Sources 重叠歧义保护，不撤回有效 B 宿主观测主方向，不要求建立通用 void 可见成功或跨窗口关联框架。

### Minor

1. 规范成员匹配明确使用 `actual === event.editor || actual.matches(event.editor)`，沿组模型 actual 对 candidate 的方向。
2. §5 与 §7 的旧 accepted/已过规则16文字明确为历史检查点，避免与本轮 frontmatter draft 混读。

### Assessment

第一轮 **C0 / I1**，未签整体可接受；须由作者结合父/Astra 决策改稿后增量复读。

## 3. 第二轮增量规则16

### Strengths

- §3.2(1) 在 listener/dispatch 前一次同步捕获 command id/参数；key、实际分派和匹配均用该捕获，避免 await 后重读可变 command。API file 与 diff 采用不同类型、有序完整 URI 身份及结构化编码，query/fragment 不丢失。
- §3.2(2–3) 明确模块内 `WeakMap<IEditorService, Set<record>>`、同步登记、同 key 双方冲突；custom 作为 wildcard 与同服务所有活动 Sources API/custom 冲突。歧义只影响后置副作用，不阻止、串行或重派 provider 调用，具备具体可实现的登记与冲突规则。
- 每条操作的 ambiguous 终身粘性直到自己的 finally；另一方先 resolve/reject 不解锁尚 pending 者，尚活动的歧义记录继续参与第三操作冲突，避免 settle 顺序与三调用交叠漏洞。
- §3.2(3–4/7) 明确 scope 是 dispatch await 加紧接的同步归属决策，后置动作开始前 finally 清理本记录/listener。ambiguous 跳过全部后置 metadata、新 input pin、replace close；void true、原拒绝与 custom 预 pin 窄例外保持，不回滚既有预 pin，也不回溯已完成的后置动作。
- 新回归义务包含 g1 pending ABORT/no-op 与 g2 真开 B 的两种完成顺序、三调用传递、custom wildcard 两启动顺序、不同 tuple/type 和不同服务正控、reject 清理后顺序恢复，以及 await 期间可变 DTO。均要求业务副作用断言、dispatch 恰一次及受控公共 Promise 屏障，不只是重复算法状态。
- §3.2(5–6) 保留第一轮有效 B/规范成员/组对象/全部 tabs/歧义 fallback 边界；§3.2 后段与 SSOT 明确不保证非 Sources 外部同 tuple 的因果归属或任意窗口并发安全。没有把局部保护夸大为通用并发保证，也未暗改官方 API/custom void 合同。

### Critical

0。

### Important

0。第一轮 I1 在此受审稿的方案层已按父转达的 Astra 裁定解决。这个结论不意味着算法已经实施或回归已经通过。

### Minor

两项第一轮 Minor 在本次精确 SHA 中仍未实质改入，继续非阻塞记录：

1. plan:72 仍写“事件input本身或与之matches的唯一真实成员”，未写 actual 对 event 的明确方向；实施应遵循 `actual === event.editor || actual.matches(event.editor)`，不要倒置。
2. plan:150/151/172 仍含“规则16已通过”“计划仍accepted”“方案保持accepted”，未直接标为历史检查点。plan:160 已正确解释当前 draft；建议作者核验报告、改状态时同时对齐旧段落。旧稿历史与本轮新边界的区分不影响本轮算法可接受结论。

### Assessment

第二轮 **C0 / I0**，可接受这版具体实施边界；作者核验后可按规则16完成方案记录、单独文档提交，再实施。仍需新源码独立审查、唯一 merge 车道精确业务 red/green 与完整相关套、最终编译/产物冻结及非作者真实默认编辑器 after。三 owner、两 slot、全部真实入口与 move、Review 完成/错误和 Conversation 围栏范围保持；D1387 不凭方案审查关闭，PRD 状态不升。

后续：作者核验改入两Minor并以`bf50c66`单独提交方案后，`1ac1fdc`实现已另经[宿主观测源码独立审查](d1387-host-observation-code-review.md)，核心静态C0/I0可进入唯一车道formalqueued，另有监听断言漏方法调用的测试M1待原作者修；不追改本节受审SHA与当时Minor，也不代表运行/after通过。

## 4. 本报告文档门禁

仅新增本报告，并由先前源码审查追加后续审查入口；不更改 J 的受审稿、plan 状态或父维护的状态/索引账。D 的文档健康检查新增报告前后均 exit 0、0 errors / 46 warnings，warning 集合不变；本报告及所改旧报告的 frontmatter/本地链接新增问题为 0，`git diff --check` 通过。此门禁不是编译、类型或产品运行验证。
