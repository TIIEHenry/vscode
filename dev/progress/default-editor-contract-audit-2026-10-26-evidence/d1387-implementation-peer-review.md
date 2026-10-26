---
title: "D1387 实现独立只读审查"
type: reference
status: review
phase: M7
updated: 2026-10-26
summary: "审查J23f8701c8d2完整实现：两根因与状态恢复方向成立；Astra确认newTab预pin及单侧URI误配两项Important须补修，未执行编译、测试或真实after"
---

# D1387 实现独立只读审查

审查者 `/root/sources_audit`，非 J 原作者。只读范围为 J 不可变提交 `23f8701c8d2a6bd4b47c2e098c62a5bb89649c84` 相对 `133ef4e5cfa06f9905dd83a4570c8d6b0369a317` 的全部 26 文件，另核官方 SCM 分派、API handler、slot、Sources identity/write-ref 与状态服务。D 工作树只新增本报告；未修改产品、J、merge、out，未编译/typecheck/transpile/运行依赖 out 测试，未启动应用。下文是静态代码审查与待运行回归设计，不是 red/green 或产品 after。

## Strengths

- 主基线 `c968c0627e76b9d94dd0c179b96f8dd1634e54c9` 仍有两个原缺陷；J 已有独立方案提交与完整实现，不能依据主状态账再造重复实现。正式方案的[规则16记录](d1387-plan-peer-review.md)确有 C0/I0 与修改后增量复读；这证明方案门禁，不代替实现验证。
- API open/diff 两个常量各用原 DTO 一次执行，context 分别位于第4/5参数；custom 只委托 resource.open，reject 没有 fallback。Changes、Review、Open Selected 与 move 依赖均接入 ICommandService。direct Preview 的 pane/undefined 与合法 SCM void 完成分开。
- finder 的新增授权限 typed chat/review、有效对象/数字准确目标与当前 conversationParts/groups 严格成员关系；没有借 excluded 旗放大授权、改选最近叶或复制 Sources slot 算法。新增测试使用真实 parts、public findGroup 与真实 EditorService，也有共享 slot 正例和普通输入/伪造/过期/外国 excluded 负控。
- Review/Changes 分别保存 open 状态，当前成功只清自己的打开错误，旧 generation 不改新状态；Review captured-entry/write/pairing 门及 move 既有关闭策略保留。测试源不把 void 等同已观察 pane；源码检查点明确未运行。

## Critical

0。未发现需推翻两根因完整实现方向的问题。

## Important

### I1：newTab 在知道 provider 目标和完成结果前 pin 当前不相干 preview

`sourcesChangeEntryOpen.ts:158–165` 捕获当前 activeGroup 后，只因 slot=newTab 就先 `group.pinEditor(previous)`，然后才 dispatch。provider DTO 明确指定另一列、preserveFocus/后台打开，或 command 随后 reject 时，这个 pin 已经发生。它没有经过后置资源/宿主匹配，也无法由 provider 的 pinned:false 撤回。与[方案](../../plans/sources-open-dispatch-and-conversation-target.md)§3.2“不让 provider 显式目标列、保焦点或后台打开 pin/close 当前不相干标签”冲突。

现有 `a provider-selected background input...` 测试只用 replace；12个 API DTO 矩阵不传 editorGroupsService；reject 测试也只用 replace。因此这些测试源均不能覆盖预pin分支。

待运行回归：当前组有未pin Beta；API DTO column=2、pinned:false、preserveFocus:true，目标是另一组 Alpha，slot=newTab。分别让委托正常完成与 reject，断言 Beta pin/close 各0、identity不变，单次 dispatch/custom0；再用真实同组 newTab 正控证明需要保留的旧 preview 仍保留。当前 J 代码会在 execute 前调用 Beta pin，属于业务 red，不能用诊断或扫描替代。具体修补策略由 Astra 裁定；不得靠删 newTab 保留语义解决。

### I2：只命中一个 URI 会把同文件另一比较误写成新 Sources identity

`sourcesChangeEntryOpen.ts:247–250` 将 input 两侧 URI 与 ref.modified/sourceUri/multiDiff任一URI交叉 OR；`253–258` 优先取现有 active pane/requested active input。对于相同 modified URI M、不同 original A/B 的两个比较，即使旧 A→M 仍显示、委托 void 后未显示 B→M，M 命中已足够把旧 input 写成新 groupId/scmResource。由 `sourcesDiffRefHelpers.ts::resolveSourcesChangeRefFromEditor` 可见，记下的 groupId 后续决定 move/write-ref 的 SCM 组归属，不能把此误配看成无关视觉标记。

现有负控仅用不同资源 `/alpha/shared.ts` 和 `/beta/shared.ts`，未覆盖同 modified/不同 original（含 staged/workingTree）的实际比较身份。初报为待Astra判定风险；父随后转达 Astra 确认为 Important，修补决定见下节。本审查没有运行该场景。

待运行回归：用真实 DiffEditorInput 旧 A→M，预记旧 workingTree identity；新资源 API diff DTO 为 B→同M，另一个 groupId/scmResource，void 委托不换 pane。断言旧 identity 保留且无后置 pin/close；实际 B→M 正控与同 A→M reveal 正控都应保留正确 identity。对 API diff 应以实际 DTO 的完整两侧校核，不能拿可能不同的 quickDiff 单侧代比较身份；custom 未知结果继续保持合法 void 兼容语义，无新通用可见成功探测器。

### Astra 补修裁决（父转达，2026-10-26）

两项均为 Important，须在完整 D1387 内补修。API 分支无需预pin：默认 pin 新input可保留旧preview，provider显式 pinned:false 仍优先。API identity 以 DTO 实际目标校核：diff 的有序 original+modified 均匹配；open 的正确资源类型/URI匹配；ref.quickDiff 与 sourceUri 单侧不能替代显式 DTO。custom 只依据成对 multiDiff 身份或已有完整可信 identity；信息不足保持合法 void 完成，但不做 identity/pin/close。

补修及回归要覆盖 newTab/replace、旧active与新背景另组、HEAD/index同modified、provider options、reject/no-op负控，保留同组 newTab/同条reveal正控。这个裁决是实现选择，不是代码补修或测试通过记录。

## Minor / 验证边界

- API 12项测试验证 tuple 保留和 context 位置，executeCommand 被 stub，不运行官方 `mixinContext`。它们不能独自证明最终 provider column/options 优先级；唯一 merge 车道仍需真实 API handler 或等价公共行为测试，尤其 pinned:false/preserveFocus:false 对 context 默认值的覆盖。
- J 源码检查点如实记录作者仅 ESLint/语法解析、没有 program/typechecker/emit；其0 errors/56 warnings不是类型通过。原基线全量45/27也不是 J 引入回归的证据。唯一 merge 运行须标明不可变源码、测试与产物身份。
- 当前范围完整交付应保留26文件的两机制、全部真实调用方与状态恢复，补 I1/I2 后运行完整相关套。不能缩为 Preview-only，也不扩大 move 的失败保源策略或第三方 void 可见成功合同。

## 真实 after 准备与 freshness

已只读检查 C 的独立准备及 J before 脚本：`/tmp/vscode-d1387-after-preparation.md`、C `.build/d1387-independent-after/` 与 J `.build/review-real-git-audit/owner-slot-probe/`。原准备的两真实 Git 库及 baseline/fixture校核可复用，但执行前须核实并取得明确所有权；不能依据旧准备报告假设 fixture/进程仍有效。当前采样没有任何 `/proc/*/cwd` 位于 J；有 Codex 进程 cwd 在主 vscode，此检查不足以证明无人通过 `git -C J` 操作，故没有碰 J。

准备脚本 guard 的 reportedBy 仍硬编码旧 `/root/finalize_review_checkpoint`，lease createdBy 仍是旧作者；新非作者执行须在自己的独立目录修正这些身份并记录，不能伪装旧 agent 通知。未收到唯一 merge 新产物冻结通知前，不启动窗口。

冻结清单至少包括 helper、finder、slot、EditorService、Conversation routing 五core，以及 Changes/Review/Open Selected/move/status、editorCommands、SCM main thread 等实际依赖；逐个记录源HEAD、JS SHA/mtime、Debugger实际加载URL/源码副本/inline sourcesContent SHA。只称已捕获模块的来源一致，不称整个out同构建。

after保持独立空profile、空extensions/shared-data、自建两Git库、默认编辑器、离线0 Git RPC，不使用用户测试profile或在线引擎。按正式方案依次检查 Preview 所有入口及Beta→Alpha、Conversation首次replace/newTab/同条reveal/准确叶、Panel、move往返/各标题入口、失败→真实成功清自己的错误、完整URI与真实两侧文本、root/readonly/focus/pin/close/Reviewed；fixture HEAD/index/worktree前后不变，清理只自己已验证进程和profile。

实际界面核查采用已读取的 `frontend-design`、`pc-web-ui-interaction`（及 states-feedback）与仓库[UI规范](../../../../docs/architecture/cross-cutting/ui-design-principles.md)：真实鼠标与键盘各走主路径，焦点和选中分开核对，错误仅在所属区域显示且恢复不清其他错误，不悬停检查状态，记录主题/窗口与叶宽/输入方式；浅深色与窄宽截图只用于相关可见性检查，不扩大为视觉改造。隔离自动化才使用已读完整 `launch` 技能，跳过prelaunch仅限唯一lane明确冻结的新产物。

## Assessment

建议保留完整实现进入唯一 merge 车道，按 Astra 已给裁决补修 I1/I2，再执行精确旧生产+新测试 red、新生产 green、完整相关套与非作者真实 after。当前 **C0 / I2待补修**，不能签为实现通过或关闭 D1387。D 本报告不改行动账、方案状态、PRD或生成列；父集成时补索引引用与本轮真实验证记录。
