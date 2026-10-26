---
title: "Sources 打开分派与准确 Conversation 目标"
type: plan
status: accepted
phase: M7
updated: 2026-10-26
summary: "D1387：真实 Git 已证 Preview 漏 API open/diff DTO、Conversation slot 的准确 concrete group 被改投主组；保留三 owner/两 slot/void 合同，规则16 C0/I0后已写源码切片与回归；作者仅静态校验，唯一车道旧红新绿/非作者after待做"
---

# Sources 打开分派与准确 Conversation 目标

## 1. 问题、证据与签收边界

范围是默认编辑器的 Sources Changes / Review → Preview、Conversation、Panel 打开及移动合同（[PRD-005/009](../../docs/product/requirements.md#prd-009-changes-与-diff)、[ADR-005](../decisions/005-changes-diff-owner.md)、[Sources SSOT](../../docs/systems/sources/overview.md)）。不开发 `src/vs/sessions/`。D1387 保持 open，PRD 状态不升；本方案已通过下方规则16，允许单独方案提交后按范围实施；源码切片与回归已写；当前仅有作者静态校验，无运行或修复后验证。

[真实 Git before](../progress/default-editor-contract-audit-2026-10-26-evidence/d1387-before.md) 有两个不同根、同名文件与不同两侧哨兵，真实内置 Git provider，断连、零 Git RPC、fixture HEAD/index/worktree 未变。J 初轮只读审查及 C1–C6 的结果是 before，不能充当作者实现后的 after。

已证两条独立机制，均在同一已支持的 owner × slot 合同内：

1. **Preview 未执行命令**：Git 的 `vscode.diff` 在 extHost 已转换成资源上的 `_workbench.diff` DTO；`resource.open()` 只查另一个自定义命令 map，因此旧 Sources 分支 resolve<void> 却不打开。Review 错误标已审阅；先有 Beta diff 时打开 Alpha 仍留下 Beta。同 DTO 直接执行能打开相应真 diff，证明资源有效，但这不是 Sources 正常流程通过。
2. **Conversation 的准确目标被拒绝**：Sources 已按活动 session 找到准确 part/group；空组 replace、newTab、同条 reveal 经 `openEditorInSlot → EditorService → findGroup`。Debugger 实际记录 Alpha preferred9 属 untitled[7,9]、Beta preferred10 属 session-102[8,10]，均 `conversationExplicitOpen=false`，group9/10 被改为 main0 后拒绝。无 slot 公共 Open Selected 成功；已有 diff 后 replace 另一条 plan=replace 成功，只有 plan=open 路径失败。

状态附带缺口：公共 Open Selected 真成功后旧打开错误有时仍留着；不得仅拍 diff 忽略错误，也不得用旧错误否定真实可见内容。

设计已由 Astra 两轮只读裁定（2026-10-26）：复用官方 SCM open/diff 分派，局部校正 finder 对有效具体 Conversation 组的承认；三 owner、两 slot 与既有围栏/void 合同保留。可复核摘录随 before 入库。本正式稿的独立规则16结果见§6。

## 2. 不变合同与取舍

| 选择 | 原因与代价 |
|---|---|
| Sources helper 分派官方 API open/diff；custom 保留 resource.open | 复用 `scmViewPane` 已有模式，保留扩展语义；代价是 ICommandService 必须接到全部真实调用方。不得改 extHost map、重建 Git 参数、先 command 再 resource 兜底。 |
| finder 接受 typed 白名单 + 显式有效具体 Conversation 组 | 准确组已经由 Sources 选好；保留公共 slot 算法和 session 身份。代价是公共路由影响面，必须有真实 EditorService 和围栏负控。 |
| 不复制 Sources 私有 slot 算法、不改用 Conversation side token | 前者与共享 helper 漂移；后者重新选择最近活动叶，丢失当前准确 session/group。 |
| 各 API 按自己完成合同处理 | 内置命令/custom.open 是 void；直接 editor、Conversation、Panel 有可观察结果。不能从 void 发明通用可见成功探测器。 |
| 现有 generation 与局部状态通道清打开错误 | 当前成功修复反馈；stale 不覆盖新结果，不清除读失败/写失败。无新全局状态服务。 |

不迁移设置/存储，不重置布局，不改 ADR 的 owner 选择。合法 provider 显式 options 仍优先；可能改变的是此前被错误重定向的准确 Conversation 具体组开始正常生效。其他 excluded part 不得到新授权。第三方 provider 内部吞取消、外部打开和未知 void 结果仍不可由客户端统一识别。

`vscode.changes` 也能被 extHost 预转换，但当前官方 SCM open 分支只特判 open/diff，本轮没有它的公共运行证据。保留现状并明确未支持扩展范围，不泛化执行任意 resource.command，不宣传所有 SCM API 命令已修。

## 3. 生产改动

### 3.1 一次 SCM dispatch 与真实依赖

在 `contrib/sources/browser/sourcesChangeEntryOpen.ts` 的公共依赖包增加必需 `ICommandService`，接入：

- Changes 的正常行/Enter、右键另一种槽（`sourcesChangesList.ts`）；
- Review 正常行/Enter、右键另一种槽（`sourcesReviewList.ts`）；
- `sources.review.openSelected`（`sourcesReviewCommands.contribution.ts`）；
- Preview/Conversation/Panel move 公共动作构造的依赖（`sourcesDiffActions.ts`，含 viewTitle 入口）。

使用既有 `API_OPEN_EDITOR_COMMAND_ID` / `API_OPEN_DIFF_EDITOR_COMMAND_ID` 常量。只在资源携带相应 DTO 时执行 `commandService.executeCommand`；否则且仅否则 `await resource.open(preserveFocus)`。一次用户动作只选择一个分支执行一次，拒绝原样向现有状态处理传播。

保留 DTO 的既有 arguments/optional 槽，open context 放在官方位置：open 第4参数、diff 第5参数。context 提供 `editorOptions.preserveFocus/pinned`（slot=newTab 对旧预览的保留语义照旧）及必要 source；不追加通用布尔。官方 mixin 让 provider 的显式 column/options 优先，测试锁定 pinned:false/preserveFocus:false 等覆盖，不在后续 pin 中反向覆盖它。

### 3.2 slot、打开身份与局部副作用

slot 仍包住同一个 SCM dispatch；newTab 保留旧预览，replace 在真实新目标打开后替换当前，已开相同 input 可以 reveal。不要用 input 对象是否变化作为成功条件。

SCM void 只说明委托正常完成。其后的 identity/pin/close 是有条件的局部副作用：参考 SCM 已有 `EditorResourceAccessor` primary/secondary 与资源 `sourceUri` / multiDiff URI 的匹配，核对实际 input 与宿主；不能把仍留着的 Beta input 写成 Alpha 的 Sources identity。provider 显式目标列、preserveFocus 或后台打开不得导致 pin/close 当前不相干标签。找不到可核对实际 input 时，不做这些副作用；不因此将任意 custom void 改判失败或二次 dispatch。

API DTO 分支用 context 尊重 provider options；custom 分支保持既有 preserveFocus/await/拒绝与 slot 兼容。测试必须分别覆盖不同资源旧 input、同条 reveal、provider 指定列、背景/保焦点、reject，不能只 stub 一个 activeEditor 变化就宣布真实打开。

无 SCM 的直接 Preview diff/file 路径返回 pane/undefined：将 undefined 显式返回 false，不再由 Preview dispatch 无条件 true；用适用于所有 owner 的打开未完成文案，不把它写成 Conversation 载入失败。此规则不外推到 API command/custom void。

### 3.3 finder 只承认有效准确目标

在 `services/editor/common/editorGroupFinder.ts` 局部扩展现有判定，允许输入仍限现有 typed `ConversationChatInput` / `ConversationDiffReviewInput`：

`允许 typed input AND（既有 Conversation token OR 显式具体目标确为当前有效 Conversation 组）`。

具体目标必须同时满足：

- 对象目标与当前 resolved group 为**同一对象**，且这个对象实际存在于 `conversationParts[].groups`；伪造 Proxy/旧对象即使 id 相同也不通过。
- 数字目标是非负具体 id，既有 `getGroup(id)` 确实解析到同一个 resolved group，并属于上述当前真实成员；未解析 id 回退的 active/main 不算显式 Conversation。
- 不借 `excludeFromGlobalEditorAggregation` 授权：该旗还可能属于其他 part。现有 `isGroupInConversationPart` 的旗判断应改成真实成员关系或由局部窄谓词替代，复用既有 explicit-target 检测，不增加导出或测试专用入口。

finder 保留已选的准确 group，不重新选第一叶/最近叶，不新增 session pin，不改变全局聚合。普通 file、untitled、ChatEditorInput、普通可写 Diff 对 token/具体目标仍路由 Preview；无目标的 Conversation input 仍拒绝。主 part 错误目标、其他 excluded part、移除/过期组、伪造对象不获放行；原有 token 正例和根 tab 不可关闭/替换保持。

### 3.4 当前打开错误恢复与完成语义

沿用 `sourcesOpenStatus.ts` 的 Review 共享 generation（list + Open Selected）和 Changes 独立 generation。通过现有 host/status 通道区分当前打开错误与 snapshot 读失败/Changes 写失败；局部记住打开错误所有权，不凭文字相等或无条件 `setStatusMessage(undefined)` 清别的错误。

当前 generation 的 true 清自己的旧 open error；false 写通用打开未完成；reject 写对应错误；stale/旧 generation 不改任何新状态。Review 的 list/右键/Open Selected 都走同一个恢复门；Changes 不修改 Review 进度。保留 read-failed/pairing/KEEP 门、Conversation load fail/pending、Panel false 与已有 stale 行为。

| 返回/拒绝 | Review 完成含义 |
|---|---|
| API open/diff 或 custom.open 正常 resolve<void> | 保留委托完成兼容语义；不把 undefined 当失败，不声明已观察到 pane。真实内容由独立 after 验证。 |
| 上述委托 reject（含实际传播取消） | 不标审阅、不二次 dispatch，现有失败/取消传播保持。 |
| 直接 editorService/slot undefined；Conversation 无 pane/load fail/pending；Panel false | false，不标；适用的打开未完成反馈。 |
| helper 明确返回 stale | 不标审阅、不写打开状态，维持已有结果门。 |
| 旧 open-status generation | 只阻止旧操作写较新的打开状态；不从该代次自行推广成一切旧 void 委托都不标。Review 仍按捕获 entry 与既有 write/pairing 门处理委托完成，不新增 session pin 或通用取消保证。 |

## 4. 精确 red / green 与验证责任

J 只写源码/测试、静态 lint/diff/docs 检查，**不编译/transpile/typecheck/写 out/watch/跑依赖 out 的测试**。父安排唯一 merge 车道按不可变 commit 串行执行；以下均是待执行清单，不计通过。

### 4.1 必须击中旧生产的 red

- **I1**：真实形状的 open/diff DTO（包括 optional 槽），resource.open 模拟旧行为 resolve<void> 的 no-op。旧生产在“command 没有执行”业务断言 red，而不是用 stub.open 被调用当成功。新生产 command 恰一次、resource.open 零次；custom 对照反过来。
- **I2**：复用 `conversationEditorFence.test.ts` 的真实 parts/EditorService harness，通过公共 `findGroup` 与真实 `EditorService.openEditor` 打开允许 typed input 到准确具体对象；旧生产在错误改投/拒绝处 red。数字 id 也覆盖；不能只 mock openEditor 回 pane。
- **状态/直接返回**：当前失败→公共成功清旧 open error，旧成功/失败晚到不覆盖新 generation；直接 Preview undefined 不认 true。保持旧读/写错误并独立断言，不以源码字符串扫描作行为证明。

### 4.2 最小目标测试面

优先扩现有 `sourcesReviewList.test.ts`、`sourcesChangesList.test.ts`、`sourcesDiffRefHelpers.test.ts`、`conversationEditorFence.test.ts` 与必要 `editorService.test.ts` / 既有 slot 测试；仅当一个独立行为套件确实更小清晰时才分新测试文件。不新增测试专用生产 API、不用 any/unknown/never 宽 cast 绕诊断、不镜像生产算法。

| 范围 | 必须的 green / 负控 |
|---|---|
| SCM dispatch | open/diff 两常量、slot/无 slot、preserveFocus true/false、pinned、provider options 优先级和正确参数位；custom resolve/reject、各一次、无兜底。 |
| identity / slot | newTab保留旧、replace另一条、同条reveal；不同资源旧input不记新identity、不pin/close；provider列/后台/保焦点；direct undefined false。 |
| 真实调用方 | Changes/Review 行、Enter、右键另一种、Open Selected、各 move 入口都接 commandService；move 保留缺失 Conversation leaf 不关闭源宿主的既有合同；其他 false/stale 后的既有关闭策略已有测试锁定，本刀不改写为所有失败都保源，不顺手扩独立缺口。 |
| finder 正例 | 允许 typed chat/review + 当前真实对象/有效数字；准确 part/session/group；已有token；隐藏组恢复与根保留。 |
| finder 负控 | file、untitled、ChatEditorInput、普通可写Diff × token/对象/id；无目标；错误main；非Conversation excluded；未解析id；移除组；同id伪造/过期对象。 |
| 完成/恢复 | command/custom reject不mark；Conversation fail/pending、Panel false、stale；当前成功清自己的错误、保留读/写失败；Changes不mark；合法void不冒充pane。 |

### 4.3 非作者真实默认编辑器 after

父另派非作者，使用唯一 merge 新产物与独立空 profile/Xvfb、自建两真实 Git 库，不写用户仓库、不连在线引擎/登录、不实际 stage/revert/checkout。自己的 before 不能当 after。采样源 HEAD、产物摘要及 Debugger 五模块 URL/hash/副本（必要时新增依赖模块）；不宣称全 out 同构建。

1. 两库同名 shared.txt/不同 baseline 与修改哨兵。默认 Preview：Review Alpha 鼠标/Beta 真 Enter、右键另一种、Open Selected；Changes 先种 Beta diff 再开 Alpha（鼠标/Enter），完整 URI + 实际两侧文本 + 宿主 + 焦点 + pin/close/标签 + Reviewed；旧 input 不被改身份。
2. Conversation C1/C2：首次空组 replace、新建 newTab 必须真成功、不留空 split；准确叶/root/只读保持。C3 无 slot公共正对照、C4 replace另一条、newTab/同条reveal继续通过；另一叶最近focus再选目标仍精确。
3. Panel 同行两侧、读态、原Conversation不被误接管；move Preview→Conversation→Panel→Preview 及相关 viewTitle入口，完整身份与源标签关闭行为按既有合同。
4. 失败后正常成功清旧打开错误；stale不覆盖新错误；没有新的假已审阅。无引擎0 RPC，fixture HEAD/index/worktree前后相同。不能以命令参数、getter或DOM个数代内容验收。
5. 迟到/切换此前夹具失败仍是未覆盖；若本波补，用真实公共服务取得依赖后的受控Promise/加载事件，不跨await保留ServicesAccessor、不改Sources私有状态。未跑不宣称异步总合同已闭。

## 5. 顺序、审查与状态

- P：PRD事实→生成状态→SSOT/证据/本方案；父派独立规则16 reviewer，C/I 核验改入后 accepted，单独方案 commit。规则16已通过，单独方案commit后再实施。
- I：仅按 accepted 方案改生产、真实依赖和回归；静态复核/文档门禁，独立实现 commit；计划仍 accepted、D1387 open，不报未跑的 green。
- V：唯一 merge 精确旧生产+新测试 red，再新生产 green/完整相关套/必要全量；非作者真实 after；按证据决定 implemented/closed。全量旧失败另记，不重开已闭 D1382/D1386，不升 PRD-008/009/029。

重要新设计点或边界外问题先报父/Astra，不顺手扩展。全量由父提供的运行记录说明；本作者不借其他主题产物给此主题背书。

## 6. 规则16记录

2026-10-26 独立 reviewer C（非 Sources 作者）完整核对正式稿、两轮 Astra、PRD/SSOT实际diff、SCM/slot/finder/状态源码与before机器证据，最终 **Critical 0 / Important 0**。原I1指出helper明确stale与open-status旧代次不能混成一切旧void不mark；作者已拆表并同步PRD/SSOT，reviewer增量复读正式稿SHA `970bac28c99e456d93e0970af0e361a7d802d2ee42bf6632b545fca5f487759d`确认落实。两Minor提醒保留move既有关闭策略、精确报告docs warning delta。见[规则16原报告](../progress/default-editor-contract-audit-2026-10-26-evidence/d1387-plan-peer-review.md)。

作者核验后标accepted；本段是方案审查与文档门禁，不是实现green。生成状态已同步，docs health 0 errors / 73 warnings，新/改D1387文档专项断链0；status 165行。没有编译/typecheck/transpile/out/依赖out测试，独立新产物after仍待。

## 7. 源码检查点（待集成验证）

方案提交 `133ef4e5cfa06f9905dd83a4570c8d6b0369a317` 后，J 按§3写 Sources 一次API分派/全部真实调用方命令依赖、公开URI匹配后的局部身份副作用、finder准确对象/数字成员判定及局部打开错误恢复。回归包含真实DTO、委托void/reject、公共列表/命令状态恢复，以及真实parts + public findGroup/EditorService/共享slot；pane仅使用既有轻量测试编辑器隔离模型加载，不能作为真实Git两侧通过证据。详见[源码与待运行清单](../progress/default-editor-contract-audit-2026-10-26-evidence/d1387-source-checkpoint.md)。

作者未编译、transpile、typecheck、写out/watch或运行测试；静态结果与独立实现审查后续收录在该检查点。唯一merge的业务旧红/新绿、相关完整套件与非作者三owner真Git after仍待。方案保持accepted、D1387 open，PRD状态不升。
