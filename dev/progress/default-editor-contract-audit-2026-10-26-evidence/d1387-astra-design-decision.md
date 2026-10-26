---
title: "D1387 Astra 两轮设计裁定记录"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "只读裁定原文：同一Sources打开合同内两独立机制；规则16仍须针对正式方案另审，不是实现预签"
---

# 设计裁定原文

以下两份只读原文由父调度 Astra 产出，作为 D1387 方案来源留存，不替代正式方案规则16或独立 after。

## 第一轮

# D1387 预留：Sources 打开合同只读设计决定

日期：2026-10-26。角色：Astra 只读设计决策。当前结论供 J 写正式方案；不是规则 16 审查，更不是实施预签。

**推荐一块内聚实施范围：修复默认编辑器 Sources Changes / Review 的打开分派，保留 Preview / Conversation / Panel 三 owner、newTab / replace 和现有 Review 完成语义。Preview 漏分派已经证实；Conversation owner×slot 是必须先补证、不能静默划为非目标的同合同独立机制问题。** 不改 extHost SCM 通用 API，不创建新引擎 RPC，不倒灌 D1382、不并 D1386，不开发 `src/vs/sessions/`。

## Strengths

1. J 的真实 Git 审计闭环足够确认 Preview 缺陷：两个独立本地 Git 仓库、同名不同内容的 shared.txt；正常 Review 点击/Enter 不开 diff 却 Reviewed 1/1；Changes 打开 Alpha 留下 Beta；执行同一资源携带的 DTO 实际显示对应两侧文本。正对照证明输入和提供者有效，不能算 Sources 产品链路通过。
2. 本次读了 RTK、AGENTS、docs/DOCUMENTATION、当前 status、指定的 `/home/clarence/Projects/UniverseSoftware/skills/principled-design/SKILL.md`、PRD-005/009、Sources overview、ADR-005、真实实现与测试。原则取舍是：先满足已签正确性和诚实状态，再复用就近机制，保留有真实需求的 owner 配置，不为少写代码改变用户选择。
3. 本次 cwd HEAD 为 `4fb712274ee129c9a175c4e763406595bcf815d6`；只读比较以下 6 份当前源码与 merge 工作树字节相等：sourcesChangeEntryOpen.ts、editorOpenSlot.ts、editorGroupFinder.ts、editorCommands.ts、extHostSCM.ts、scmViewPane.ts。没有把 merge 最新 out 冒称 J 原窗口已加载模块。
4. 已直接读取 `noop-scm-resource.json` / `changes-retains-beta.json` 并看过 04 失败、24 正对照截图。J 原证据与已加载源摘要仍以 `/home/clarence/Projects/Agents/vscode-WorkTrees/J/.build/review-real-git-audit/review.md`、`source-manifest.json` 和 `loaded/` 为准；extension-host SCM 是静态源码对照，并非 renderer Debugger 捕获。

## Critical

无。当前证据不支持数据损坏、真实 Git 写入、越权、跨会话引擎读取等 Critical 结论。

## Important

### I1. 已确认的分派缺口；不要修到 extHost

机制链（路径均相对本仓根）：

- `contrib/sources/browser/sourcesChangeEntryOpen.ts:97-100` Preview await 后直接 true；`:150-160` 和 `:207-224` 均调用 resource.open。
- `api/browser/mainThreadSCM.ts:161-162` 只转发 `$executeResourceCommand`。
- `api/common/extHostSCM.ts:486-493` 对 vscode.open/diff/changes 预转换 DTO，其他命令才进 resource command map；`:463-467` 无 map 命令直接 resolve(undefined)。
- `contrib/scm/browser/scmViewPane.ts:1710-1727` 已有明确复用模式：API_OPEN_EDITOR_COMMAND_ID / API_OPEN_DIFF_EDITOR_COMMAND_ID 经 commandService.executeCommand，其他资源走 resource.open。

**决定**：在 Sources 公共打开路径按上述已存在常量和分派规则处理 open/diff DTO，一次用户操作只选择一个分支执行一次。将 ICommandService 作为正常依赖接入 Changes、Review 和 Open Selected 等真实调用点，不能只给测试夹具补服务。不要修改 `$executeResourceCommand` 来让同一 DTO 在两端都可能执行；不要绕过资源命令重建 Git diff 参数；不要先 command 再 resource.open 作“兜底”。自定义 resource.open 继续使用原参数、await 和拒绝传播合同。

上下文要遵守 `browser/parts/editor/editorCommands.ts:434-442`：通过等价 open context 传 editorOptions（preserveFocus/pinned），维持提供者显式 options 的原有优先级，不能把 preserveFocus 布尔追加到 API DTO 当通用参数。`_workbench.diff` 的 context 在第 5 参数，`_workbench.open` 在第 4 参数；转换器提供 optional 槽，不可把缺槽的手写测试 DTO 当生产事实。

slot 必须仍包住同一 dispatch：newTab 保留旧预览、replace 替换当前/已开则 reveal。识别并记录实际打开 input 的代码不能把“仍是 Beta”当成 Alpha，再给旧 input 写新的 Sources identity 或 pin/close 错误标签。可复用 SCM 同文件 `:1731` 起的 EditorResourceAccessor/URI 匹配保护做本地身份与 pin 副作用约束；这不是声称自定义命令具有统一显示结果契约。不能用“activeEditor 对象没变”判失败：同一真实 diff 重复 reveal 是合法成功；preserveFocus 也不应强迫焦点改变。

`vscode.changes` 也被 extHost 预转换，但官方 SCM 这个分支只特判 open/diff。本次真实 Git证据是 diff，不能写成所有 API SCM 命令已修。J 正式方案需显式交代 changes 的现状及是否真实可达；若要扩大支持，先建立该公共输入的行为合同与针对性反例，不能靠泛化 execute 任意 command 顺手扩展。当前决定不以它阻断已证实的 Git diff 修复，也不把它写成已验。

### I2. Conversation 是已支持配置，根因与 I1 不同，必须完成前置补证

PRD-009:211/217、ADR-005 和 sourcesDiffConfiguration.ts:26-50 都承诺三 owner；Sources overview:32-34 明确 slot 适用于编辑器 owner。因此只把 default Preview 修绿，不能交付“Sources 打开合同闭合”。

当前静态链已经清楚：

1. `sourcesChangeEntryOpen.ts:243-277` 按 active session 找到准确 part，创建审阅 input 并找到/新增其 side group；带 slot 时调用 openEditorInSlot，不带 slot 时直接 targetGroup.openEditor。
2. `services/editor/browser/editorOpenSlot.ts:63-96`，typed replace 已有活动标签时直接 group.replaceEditors；空组或 newTab 则 editorService.openEditor(input, options, concreteGroup)。
3. `services/editor/common/editorGroupFinder.ts:152-155` 接受 concrete group；但 `:48-54` 的 conversationExplicitOpen 只承认 CONVERSATION_* token。准确的 conversation group 属 excluded part，先被改成 main activeGroup；`:60-62` 再拒绝审阅 input，恰与 J 错误文本一致。side group 在此之前已创建，所以可留下空 split。

这是强静态归因，**还不是该原窗口完整模块身份与正负对照的运行确认**。J 原报告明确未捕获这些路由模块，不可将静态链直接改写成已完整复现同根。结论类别：**同一个 Sources 打开合同内、另一根因的高置信候选；前置验证后应同波修复，现阶段不能称同根或明确非目标。**

若前置 probe 确认，优先考虑修正既有 finder 的“显式目标”判定：只有已允许的 ConversationChatInput / ConversationDiffReviewInput，且显式具体 group（对象或有效 id）确属现存 conversation part，才保留该准确目标；继续接受既有 token。可复用本文件已有 `isExplicitGroupTarget` 和现存 membership helper，但不能把所有 excluded part 都自动认成 conversation。普通文件、untitled、ChatEditorInput、普通可写 Diff 依然回 Preview；缺失/失效/错误 part 的目标依然失败或按原围栏处理。需公共 finder 与真实 EditorService 测试证明精确 group 被保留，不能只 stub openEditor 回 pane。

最接近的替代：在 Sources 内用确定的 targetGroup 直接实现 typed newTab/replace（复用 planEditorOpen），避免再经过 finder。这可缩小通用路由改动，但复制 slot 算法并绕开一层 routing，未来与共享 helper 漂移；只有独立审查证明 finder 的 concrete-group 限制是明确、不可更改的既有合同，才选该方案并写出原因。**不选**改成 CONVERSATION_SIDE_GROUP token：它会重新依赖全局活动 part，破坏当前按 sessionKey 精确选叶的合同。不选删除 slot/强制 owner=preview，也不选普遍让 typed input 绕过 editorService。

### I3. 完成语义必须按实际 API 分层，不能发明布尔成功协议

`ISCMResource.open` 是 Promise<void>；`editorCommands.ts:459-501/522-550` 的 API handler await 后不返回 pane；`extHostApiCommands.ts` 声明 ApiCommandResult.Void。`editorGroupView.ts:1307-1311` 又可因取消返回 undefined，该信息经命令层被丢失。由此：

| 可观测结果 | 本次要求 |
|---|---|
| 内置命令或 custom resource.open reject（包括实际传播的 cancellation） | 不 mark；不做第二次 dispatch；保留既有失败显示/取消处理，不吞错变 true |
| 直接 editorService/openEditorInSlot 返回 undefined | 该调用有 pane/undefined 合同，可以返回 false；不得再无条件 true。若纳入本刀，Review/Changes 的 onFalse 文案须适用于该真实失败，不能误称 Conversation 载入失败 |
| Conversation pane 不存在、load fail/pending；Panel false；stale | 维持现有不 mark 和 generation/load-state 行为，不能用 Promise resolved 覆盖 |
| 命令完成且返回 undefined | 这是合法 void，不能以 undefined 判失败，更不能把它当可见 pane 的证据。分派修复可维持既有“委托操作正常完成”的兼容语义；真实可见 diff 成功另由公共 UI 验收证明 |
| 任意 custom provider 成功 resolve<void>、内部吞取消/外部打开、未知结果 | 不从 activeEditor 的偶然变化发明通用成功检测。不声称可以区分所有这些状态；不改变 provider API，不靠私有钩子让测试假装能观察 |

**决定**：本波交付承诺是消除已证实“根本未执行真实命令却当完成”的 Sources 自造空操作，并保留各 owner 已有可观测 false/stale/reject 门。它不承诺为所有第三方命令新增可见完成保证。若正式方案宣称“任何取消或未知结果都不会自动标审”，必须先解决 void 丢失结果的契约问题并重新评审；不得用一个既有编辑器快照、command 返回布尔或固定等待时间伪造保证。测试名称、PRD说明与报告需体现此限制。直接 editor 路径能够识别 undefined，可在同一 helper 内修正，但不要将它外推到 command void。

## J 前置只读 probe（先于正式方案封口）

保持隔离默认编辑器、自己创建的 alpha/beta 两个真实 Git 仓库和本地 roster，断连且零 Git RPC；不触碰用户仓库，不写产品源码，不编译，不登录。使用独立空 profile 的公开设置改变 owner / slot；正常产品行点击、Enter、上下文另一种打开、Open Selected/move 命令为主，诊断直调只能标正对照。

| 步骤 | 正常公共入口 / 状态 | 需要记录 | 对照与可裁定结论 |
|---|---|---|---|
| C1 | owner=conversation、slot=replace；Alpha 活动叶尚无 diff，Review 行鼠标首次开 | 输入 type、part.sessionKey、目标 group id、打开前后 group 数、错误、reviewed、两侧文本 | 预测进入空组 open 分支；若报同错误，捕获 finder 路由决定 |
| C2 | 清理自己新建的空 side group或新独立窗口，owner=conversation、slot=newTab；Beta Review focus+Enter | 同 C1，同时确认 Beta active/sessionKey 与 URI | 预测同一 finder 路；排除只在 Alpha/鼠标失败 |
| C3 | 同一真实资源，通过不传 slot 的 Open Selected，或已支持的 move-to-conversation | 准确目标 part、真实 baseline/modified、只读、root 仍在、reviewed | 绕过 helper 的公共正对照；若失败则候选归因尚不完整，继续定位，不能直接修 finder |
| C4 | 先 C3 得到真实 diff，再 normal replace 打开另一条；再 newTab/reveal 同条 | 标签保留/替换、精确组、两侧身份、焦点、计数 | 区分 replaceEditors 分支与 open 分支；已开同输入无需对象变化才能成功 |
| C5 | 在 Sources 操作时另一 conversation 叶最近聚焦；再选目标活动会话 | active session、part.sessionKey、所有叶 group/input | 确认准确叶选择，不靠 token 回退到第一叶/最近叶 |
| C6 | owner=preview 与 panel 各正常打开同一真实行 | owner、两侧实际哨兵、错误和计数 | Preview 已知失败作负对照；Panel 是独立宿主，不能把其通过当 Conversation 修复 |

必须 Debugger 捕获本轮实际加载的 sourcesChangeEntryOpen.js、editorOpenSlot.js、editorGroupFinder.js、editorService.js、conversationEditorRouting.js 的 URL、内容摘要与副本；对比当时磁盘源/产物，不把稍后编译车道变化当已加载变化。保留真实行 resource/command，不替换 open 实现。若诊断使用观察包装，只记录并原样转发一次，退出时撤销；不保留 ServicesAccessor 跨 await，不通过私有 Sources 字段造成功。C1-C4 是完成归因最小门槛；C5/C6 是合同边界补证。

## 最小实施、red/green 与实际验收

1. **单个 D1387 主题，两条已证明机制**：Sources 本地 SCM dispatch 与经 C1-C4 确认的 conversation owner×slot 路由。共享 helper、真实依赖注入、身份副作用、错误/Reviewed 门一起交付；Panel 无证据不重构。J 先写正式 plan，规则16独立 reviewer 之后才能实施。
2. **red 必须击中生产缺口**：构造真实 DTO 形状（含 optional 参数位），resource.open 是旧实现会 resolve 的 no-op，commandService 记录一次执行；旧代码必须在“DTO 未分派”断言失败。自定义 resource.open 对照仍且仅执行一次。不能靠“stub open 被调用”就说实际 diff 已开。
3. **green 最小自动覆盖**：open/diff 两常量、带 slot/无 slot；preserveFocus true/false；newTab/replace/已开 reveal；命令 reject 不 mark；custom resolve/reject 兼容；已知 direct undefined、Panel false、Conversation fail/pending、stale 不 mark。Review 正常行/Enter、右键另一种和 Open Selected 的依赖都真实接通；Changes 不写 review 进度。
4. **Conversation red/green**：公共 findGroup/EditorService，准确 concrete group + review input 的现有错误作 red；green 命中同一 session/group。负控普通文件、untitled、ChatEditorInput、可写 Diff、无显式目标、非 conversation excluded part，保持围栏；根 tab 不可替换/关闭。已有 conversationEditorFence.test.ts 只测 token，不足以证明具体目标组有效。尽量扩现有测试，不新增测试专用生产开口。
5. **真实默认编辑器验收必须重做**：两个真实 Git 仓库同名文件、不同两侧哨兵；Review Alpha 鼠标/Beta Enter；Changes Alpha 鼠标/Enter（先种 Beta diff）；三个 owner；newTab/replace；无 slot Open Selected 与 move 往返。断言完整 URI + 原始/修改文本 + 宿主/会话 + 标签行为 + focus + reviewed，不只 command 参数或 DOM diff 个数。0 Git 写入、fixture HEAD/index 未变、断连时 0 engine RPC。
6. **迟到/切换**：J 旧延迟夹具失败仍记未覆盖。正式验收若补测，须在公共命令或真实公共服务获得依赖后使用受控 Promise/真实加载事件，不持有过期 accessor、不修改产品私有状态。记录 dispatch 发起与实际 diff 两侧身份，验证迟到不污染另一条 identity/status；未跑则不宣布 async 总合同闭合，不顺手发明 session pin。
7. 编译/测试只由既定 merge 车道运行。root 已告知新 full source 6f82 基线 45/27；本报告未运行或验证该结果，不可写全绿，也不能把旧 J loaded scope 升成新 source 端到端。D1382通知合同保持闭合；D1386/C Voice已有独立范围，不拿其新加载行为给 D1387 背书。

## Minor

- 当前 PRD-005:80 与 Sources overview:28/53 写 `resource.open → Git diff`，已被真 Git 证据否定。正式方案/实施须按规则10a先校正产品事实，再同步系统打开链路描述；不是改 ADR-005 的产品选择，也不能把 PRD-009/008 提前升 implemented。
- helper 注释“Boolean results only from Conversation and Panel”与 Preview true 已不一致；改时按实际分支语义写清楚。
- `View changes (1 files)` 和旧 IdentityStrip 截图不是本波新增问题。

## Assessment

**设计方向可采用；实施方案尚未写/未审，不能开工签收。** I1 足够开正式方案；I2 由 J 完成上述公共前置补证后再定最终修复落点。推荐保留一块内聚 D1387，而不是为了易测缩成 Preview-only；它包含两个独立机制，文档不得叫“同一根因”。若 C3 正对照失败或模块身份不合，先继续只读归因，再回 Astra 裁定，不问人类。

取舍：就近官方 command 分派减少兼容性和升级成本；正确 concrete-group routing 保住用户已选择的 owner/slot 与会话身份；代价是新增依赖及一组跨路由围栏测试。取消/未知成功不能从 void 变出来，保留该明确限制比添加通用观察框架可靠。没有本次测量，不能宣称操作效率提高多少。

本阶段仅写本 /tmp 报告：未改产品/仓库文档、未 commit、未编译/transpile/typecheck/写 out、未启动设备或应用、未运行测试、未登录/联网调用/Grok。已检查的是静态代码、已有审计材料与两张截图；J 下一轮 probe 和正式 red/green/真实 after 均未运行。

## 最终落点

# D1387 最终设计落点：Sources 打开分派与明确 Conversation 组路由

2026-10-26，Astra 只读原则决策。本补充收束 `/tmp/vscode-sources-open-astra-decision.md`，供 J 写正式方案；不代替规则16独立审查，不授权跳过方案进入实施。

**决定：可以且应当将「Sources API open/diff 分派」与「finder 保留显式、有效、准确的 Conversation 具体组」写成一块 D1387 正式方案。两个独立根因均已证实，属于同一个已支持的 Sources owner×slot 打开合同。三 owner 与两 slot 保留。未发现与此推荐相矛盾的证据。**

## Strengths

- J C1–C6 完成了初稿要求的前置门槛。已读 `/tmp/vscode-sources-owner-slot-probe-delivery.md`，直接核对 observations-trace.json 的 routing/plans、observations-wide-public-control.json、source-manifest.json，并查看宽窗口真实 Beta diff 截图。
- 实际断点：Alpha preferred concrete9 属 untitled[7,9]，Beta concrete10 属 session-102[8,10]；两者均 explicit=false，excluded 检查将 group9/10 改投 main0。错误文本、空 side group、Review 不增长与该路由一致。
- 公共正对照排除了资源、模型、会话选择和审阅控件本身不可用：无 slot 的 sources.review.openSelected 在 Beta group10 显示真实 BETA baseline/modified、双侧只读、保留 root8，Review 0/2→1/2。正常 replace 打开尚未打开的 other.txt 实际 plan=replace 并成功；newTab、首次空组 replace、同条 reveal 实际 plan=open 才失败。这是分支因果证据，不能把“旧 pane 仍在”当成功。
- C5 先聚焦 Alpha 再从 Beta 公共入口选择，目标仍准确；C6 Panel 真正显示 Alpha 两侧且 Beta Conversation 不被接管。Preview I1 在新窗口仍复现。
- 本轮独立从五份 Debugger 副本解码 inline source map sourcesContent，其 TS SHA 都命中 J manifest，且与当前 cwd 五份源码相同。确认的是这五模块及其本次加载身份，不是整 out 同一构建。审计无源码替换、无 resource.open 替换；J 记录 fixture before==after、0 engine RPC 与清理。未重新启动窗口重跑。

## Critical

无。未发现需要扩大为数据损坏、越权或真实写入的证据。

## Important

### 1. 正式方案的准确实施边界

| 部分 | 推荐落点与约束 | 不应采用的替代 |
|---|---|---|
| Preview SCM dispatch | Sources 公共打开 helper 复用 scmViewPane.ts 的 API_OPEN_EDITOR_COMMAND_ID / API_OPEN_DIFF_EDITOR_COMMAND_ID 分支；ICommandService 经真实调用方注入；一次 dispatch；其他资源保持 resource.open | 修改 extHost 通用 map；command 后再 resource.open；绕过真实 DTO 重建 diff；执行所有任意 command 的泛化 |
| Conversation concrete group | editorGroupFinder.ts 的显式 Conversation 打开判定，增加有效具体目标且当前 resolved group 确属现存 conversationParts 的情况；输入仍须为现有允许的 typed ConversationChatInput / ConversationDiffReviewInput | 改为 CONVERSATION_SIDE_GROUP 导致重新选择活动叶；删除 slot；Sources 内复制 slot 算法；普遍 typed input 直接绕过 editorService |
| slot、身份、副作用 | 共用原 helper 与 planEditorOpen；保留 newTab/replace/reveal、preserveFocus、正确 opened identity、pin/close 的目标限制 | 把仍留着的 Beta 标成 Alpha；用 activeEditor 对象改变当成功条件；失败后再 dispatch |
| Review/Changes 状态 | 保留已知 false/stale/reject 与 Conversation load 状态合同；失败后真实成功须清掉当前打开错误；Changes 不改审阅进度 | 用 void 当布尔；凭旧错误文案否认真实可见 diff；成功后旧“无法打开”继续误导用户 |

finder 的推荐条件是**允许输入 AND（原有 Conversation token OR 显式具体目标对应有效 Conversation 组）**。这里的“有效”不是 `getPart(group).excludeFromGlobalEditorAggregation`：当前 helper `isGroupInConversationPart` 只看该旗，不能不加核对直接复用为新的放行条件；其他 excluded part 不是 Conversation 授权。优先用现成 conversationParts/groups 成员关系及实际 resolved group 判定。对象目标应为当前有效组，不能只因伪造/过期对象携带相同 id 就放行；数字目标须由既有 getGroup 解析得到有效组，不能将未解析 id 回退后的 main/active 组当显式 Conversation。是否调整该 helper 或局部新增谓词，由正式方案说明最小复用面，不改全局聚合规则。

这只校正“准确指定一个已存在允许宿主”的路由承认方式，不新增第三种 owner、不放开文件围栏、不让 finder 推断会话归属。Sources 已按 active session 找 part，继续由它选准确组；finder 不重新选第一叶/最近焦点叶，也不新增 session pin。

### 2. I3 完成语义保持，不发明成功探测器

内置 open/diff handler 和 custom resource.open 返回 void；正常 resolve(undefined) 不等于失败，也不能证明可见 pane。命令 reject（包括真正传播的 cancellation）不标 Review，不二次分派；Conversation false/pending/fail、Panel false、stale 仍不标。直接 editorService/openEditorInSlot 的 pane/undefined 返回有独立意义，可返回 false，不能将这条规则套在命令 void 上。

D1387 修复的是 Sources 自己漏执行内置命令的已证空操作，以及明确目标组被重定向造成的已证拒绝。维持自定义 provider 委托完成的兼容语义；不承诺识别自定义命令吞取消、外部打开或所有未知结果。真实可见成功由实际宿主/两侧模型/操作验收证明。不得新建全局“命令已显示”观察框架或私有测试钩子。

正式方案将 direct Preview 返回 undefined 的修正列为 helper 内相邻完整性处理是合理的，但需同时采用适用的失败文案与针对性测试，不能把所有 false 都写成 Conversation 模型加载失败。这不能成为扩展通用命令完成协议的理由。

### 3. 成功后的旧错误残留需同波按现有状态合同处理

J C4 已观察公共 Open Selected 真成功后旧路由错误有时残留，C5刷新才恢复。它不推翻打开成功证据，却属于本波用户可见完成反馈。正式方案应确认并保证：同一当前 open generation 成功清除自己的上一次打开错误；失败显示对应错误；stale 不覆盖新的状态。不清理无关读失败/写失败，不引入新状态服务。用现有 settleSourcesOpenStatus/host status 通道完成；公共失败→成功恢复测试锁住。此项无需独立架构主题，但不能在验收时只截 diff 忽略仍显示“Unable to open”。

### 4. 必须的 red/green 与真实 after

| 层面 | 必须观察的内容 |
|---|---|
| I1 red/green | 生产 DTO 形状；open/diff 常量各一次 command、零 resource.open；custom 分支零 command、一次 resource.open；slot/无slot、preserveFocus true/false、pinned、提供者 options 优先级；reject 不标；正确参数位，不能用追加布尔冒充 open context |
| I2 red/green | 实际 public findGroup/EditorService + 允许 typed input + 有效具体对象；旧代码应在错误投主组/拒绝处 red。green 命中同一 part/group；数字 id 亦覆盖，因为 PreferredGroup 公共合同支持它且本次新判定会涉及它。不要把 numeric 测试写成 J 已运行 |
| 围栏负控 | 普通文件、untitled、ChatEditorInput、普通可写 Diff，针对 token/具体目标仍不进入 Conversation；无目标的 Conversation input、主 part 错误目标、非 Conversation excluded part、失效 group、伪造/过期对象不能获新放行。已有 token 正例不退化 |
| slot 与恢复 | 首次空组 replace、newTab、已开同条 reveal、replace 未开另一条、隐藏 group 恢复；准确叶/root保留；不多建空 split；先失败再正常成功清旧打开错误，stale 不覆盖新状态 |
| 真实默认编辑器 | 同一自建 alpha/beta 真 Git、同名不同内容，Review鼠标/Enter/右键另一种/Open Selected，Changes先种Beta再开Alpha；三owner与两slot、两侧全文哨兵及完整URI、只读审阅/root、焦点与标签行为、Reviewed；move往返需补，因为新依赖不能漏真实调用方 |
| 不变边界 | 无引擎0 RPC；fixture HEAD/index/worktree未改；不把Panel通过当Conversation通过；不把command参数或DOM控件数量当真实内容；不借D1386新产物给本次加载身份背书 |

C1–C6 是故障归因的 before，不能替代修复后的 after。真实 after 必须显示原来失败的 C1/C2/newTab/reveal 成功，并显示原来通过的无slot、typed replace、Panel 继续通过。源/产物/加载身份按最终实际验证范围采样。

### 5. 竞争方案与代价

选择 finder 局部修正优于 Sources 私有 slot 分支：错误发生在通用路由拒绝已准确指定的允许宿主，修正能保留既有 helper、精确会话目标和共享 slot 语义。代价是公共路由影响面，必须以具体对象/数字目标以及围栏负控覆盖；不是仅加两行就可以省略验证。当前运行证据已经满足初稿将此优选落地的条件，没有理由继续复制 Sources 局部分支绕过 finder。

选择就近官方 SCM 分派优于改 extHost：保留既有 API/扩展语义，局部升级成本低，代价是把 ICommandService 接到所有真正调用路径并维护 slot/identity 副作用。`vscode.changes` 的现状继续明确列边界；没有该输入公共运行证据，不宣传“所有SCM API命令已全支持”，不自动泛化。

## Minor

- 正式方案按规则10a更新已被证据推翻的 `resource.open 就会打开 Git diff` 产品事实/系统描述；不改变 ADR-005 的 owner 选择，不提前升 PRD-009/008 implemented。
- 候选措辞应改为“已证实两个独立机制”；继续记录 C1–C6 的实际 scope。旧截图名、计数已为2/2、已有pane均不是新操作成功证明。
- 初稿的“布尔仅来自Conversation/Panel”注释修正要求仍有效；保持输出区分 fulfilled command 与可见内容。

## Assessment

**同意进入 D1387 正式方案编写，优选 finder 修正已可确定，无需再等候人类或重复做相同前置实验。** 这不是对尚未存在的方案预签；J 写完后必须走规则16独立只读审查，Critical/Important 消除后才可实施。仍不得只修 Preview 后宣布闭合。

本轮只读复核并写本 /tmp 补充，无源码/仓库文档变更、无 commit、无编译/transpile/typecheck/out、无应用/设备启动、无用户仓库操作或新测试运行。普通输入围栏负控、numeric/失效组、move往返、迟到命令和真实 after 尚未执行；引擎真实行/写操作不在本次证据范围。root 告知当前 merge 后修 f75 尚未 full，最后原 full 仍是6f82的45/27；本轮未独立运行该编译，不报全绿、不冒称本修复已验证。
