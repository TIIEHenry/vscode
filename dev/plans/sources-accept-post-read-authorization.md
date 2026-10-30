---
title: "Sources Accept：读取返回后复核写入授权"
type: plan
status: implemented
phase: M7
updated: 2026-10-27
summary: "两宿主Accept读后当前授权，54新例及完整两宿主模块实际通过；root核新6d一次green后窄scope签收，原设计/review/失败历史保留，fullCompile=false。"
---

# Sources Accept：读取返回后复核写入授权
状态：已完成。
覆盖需求：PRD-009。


> **固定源码基线**：`c7fefd780bd9720f3889e310d4706210189a3fc7`，`src` tree `a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`。不追 main。
> **当前实现验收（2026-10-27）**：两宿主Accept读后当前授权，54新例及完整两宿主模块实际通过，root已独立核原始stream/owned/finally并签收本方案为implemented。固定HEAD01c0/source6d/src424397的一次[新验证证据](../progress/sources-stale-render-6d-new-validation-20261027-evidence/INDEX.md)是当前结论；下方原设计、授权、评审与失败叙述保留其历史时点。仅source/真实组件合同，不声称实端Git索引、UI after或fullcompile已验。
> **既有合同**：[PRD-009 验收 3](../../docs/product/requirements.md#prd-009-changes-与-diff)、[Sources SSOT §4](../../docs/systems/sources/overview.md#4-边界)、[Accept 暂存 hunk](sources-accept-stage-hunk.md)、[ADR-008](../decisions/008-write-git-apply-hunks-empty.md)。本稿恢复已有写门，不新增产品能力或协议。

## 1. 已核问题与证据等级

两宿主在 Accept 起步时调用 `planSourcesDiffAcceptAttempt`，已会拒绝引擎 ref 的 pinned session 与当前 active session 不同。随后等待 `ReadGitFileDiff`，读返回后仅检查宿主身份/存活，再用捕获的旧 sessionId 发 `WriteGitApplyHunks`。active-session 事件只刷新动作外观，不使该等待失效；底层 write helper 查连接与写门，但没有 active-session 身份参数。

| 固定基线源码 | 已核事实 |
| --- | --- |
| `browser/conversationDiffReviewPane.ts:596–648` | `:598` 起步授权；`:620` await FileDiff；`:629` 检查 input / stageAttemptGeneration；`:639–647` 用捕获 sessionId 写入，未重新核对 active session。 |
| `browser/conversationDiffReviewPane.ts:151–154,341–344` | 会话/连接/Changes 变化只更新 actions 与布局。 |
| `browser/sourcesDiffPanelView.ts:612–661` | 同一缺口；`:642` 只比较 currentRef 和 dispose，`:652–660` 继续写旧 sessionId。 |
| `common/sourcesDiffWriteController.ts:206–214` | 既有 planner 按当前 facts 拒绝 pinned/active session 不一致，并解析实际目标 sessionId。 |
| `common/sourcesChangesGitWrite.ts:61–99,339–358` | 当前 write gate 与空 session / argv / patch 门仍有效；helper 本身不核对 active-session 身份。 |

以上路径均相对 `src/vs/workbench/contrib/sources/`。这是精确源码静态链，尚未取得本 scope 的可执行 red 或 UI after；不得写成运行时已复现。

最小触发链：active 为 `s1`，原宿主显示 pinned `s1` 的可 Accept hunk → 点击 Accept，FileDiff 请求 `sessionId=s1` 挂起 → active 切到已 ready 的 `s2`，宿主 input/ref 不变 → 返回合法 diff → 当前代码仍可能向 **旧 `s1`** 发 ApplyHunks。问题不是将 `s1` patch 写入 `s2`，而是写入前已不满足入口的 session 授权。

现有 `conversationDiffReviewPane.test.ts:143` 仅覆盖读期间 clearInput 后零 Apply；`sourcesDiffPanel.test.ts:3421` 起的双宿主夹具与 `:3684` 正例覆盖现拉 diff / cursor hunk / argv，但没有读期间 active-session 变化的授权复核。旧夹具的 header/body count 不一致不等于已知零调用：现有 builder 不校验两者相等。新回归须使用计数正确的 patch，并有真实成功阳性，不能用无效 patch 掩盖问题；builder 的既有失败不在本稿修复。

## 2. 范围与不变量

本 scope 只改默认编辑器的 `ConversationDiffReviewPane` 与 `SourcesDiffPanelView` 的 Accept **读返回后、发写之前**的授权边界及对应测试。两宿主复用 `sourcesDiffWriteController.ts` 的既有 Accept planner，不复制一套 session 规则或引入新公共 API。

- FileDiff 的 sessionId / path、input/ref、光标侧与行从一次 Accept 捕获。返回的 patch 只能用于这次读目标，不能改写 sessionId 后转发。
- 当前门全部开放且当前解析出的 write sessionId 与捕获的 read sessionId 完全相等，才能进入 ApplyHunks；保持固定 argv 与单 cursor hunk。
- `git.stage` / `git.clean` / `git.unstage` 不是 Accept fallback；零 Apply 的路径也须零本地 Git 写。
- 已有 Stage / Commit / Revert / Unstage、打开/Move、Review 已审阅进度、模型提供者和 patch builder 行为不改。
- [D1387 窄方案](sources-open-dispatch-and-conversation-target.md)保持 implemented / closed；PRD 与[宽 Sources Diff 方案](sources-changes-diff.md)不升状态。旧 Accept / reasoning 等红与历史失败保留。
- catalog-ready 后缺 lease 恢复、local Git completion 的 notice 归属是后续独立 scope，不混入本稿。

## 3. 选定授权语义

本次采用**写入前的当前授权**，不建立连续授权 epoch。现有 session API 与 write facts 只有当前身份/门，不包含本次读取所属的 engine/link epoch；不能将事件次数当成授权合同。

| FileDiff 返回、准备写入时的事实 | 合同 |
| --- | --- |
| 同一原宿主/代次仍存活，active 仍为 `s1`，当前门全开 | 正常向捕获的 `s1` 发一条 ApplyHunks。 |
| active 从 `s1` 变为 `s2` 或空 | 零 Apply，不重定向旧 patch；使用既有 session-changed 提示或当前闭态。 |
| active 曾 `s1 → s2 → s1`，写前已回到 `s1` | 若原宿主/代次仍有效且当前门全开，允许写；不新增 session 事件失效 generation。 |
| 当前 disconnected / pairing-hold / catalog 未 ready / read-failed leftover / capability 或 hook 不可用 | 零 Apply，保持当前 actions / 闭态；不拿 await 前的布尔值授权。 |
| 读期间 Session catalog 的 Session/List 失败，写前 readiness 仍 unavailable | 零 Apply；这是会话目录就绪门，不等同于 Git Changes 读失败。 |
| Session/List 从失败恢复为 ready | 若其余门全满足，允许；Git Changes read-failed 门仍须另行通过。 |
| 读期间 Git Changes 读取失败，snapshot 为 `engine-leftover(reason='read-failed')`，写前仍失败 | 零 Apply；这是 Changes 快照写门，不用 catalog readiness 的布尔值代替。 |
| Git Changes 读取恢复、snapshot 已非 read-failed | 若其余门全满足，允许；catalog readiness 仍须为 ready，不因失败历史永久作废。 |
| 同 sessionId 的断连后重连 | 事件本身不取消；写前仍断连则拒绝，当前已恢复且其余门全满足则允许。 |
| 切换 input/ref、clear 或销毁原宿主/原有效代次 | 零 Apply，旧操作不在新宿主写提示或刷新。 |

不同 engine/link 复用相同 session 字符串时，返回 FileDiff 的来源归属是独立边界。本稿不新增 engine/link 身份框架，不声称覆盖跨 engine 字符串碰撞，也不为该边界专造换引擎测试或运行。

## 4. 两宿主实施形状

### 4.1 捕获与宿主存活

保留点击起步的 planner、payload/cursor 门与现拉 FileDiff 行为。捕获实际读请求的 sessionId，不在 await 后从 active session 重新选择目标。

- Pane：保存原 `ConversationDiffReviewInput` 对象与 `stageAttemptGeneration`，保留 setInput / clearInput / dispose 对该局部生命周期代次的失效；读返回时核对仍是原 input、原代次且宿主未销毁。**原 input 自身已 `dispose()`，即使 Pane 仍存活且 `this.input` 仍为原对象，也必须零 Apply**；这一独立负例不能用 Pane.dispose() 代替。
- Panel：保存原 `ISourcesChangeRef` 对象及既有 `renderGeneration`，核对仍为原 ref、原渲染代次且宿主未销毁。clear 后再显示同一个 ref 对象不能通过对象相等绕过原操作失效。
- 这里的 generation 只约束宿主 input/ref 生命周期；不因 active-session 或连接事件而额外递增。父级已实读 Panel `:170–197,230–280,359–364`：renderGeneration 仅随实际 ref/show/clear 的模型生命周期变化，普通 session / connection / Changes / layout 刷新不产生新渲染代次，不应制造无关 churn。

### 4.2 读后写前重验

1. FileDiff 完成后先过上述宿主存活门；失效直接结束，不在后来宿主显示旧错误。
2. 重新读取 `currentWriteFacts()`，以这份 fresh facts 再调用既有 `planSourcesDiffAcceptAttempt`。`blocked` 停止并刷新当前动作闭态；`notice` 使用 planner 的已有提示并停止。
3. 仅 `engine` 结果可继续，而且结果 sessionId 必须等于捕获的 FileDiff sessionId。不同则零 Apply，使用既有 session-changed 提示；不得把旧 patch 转发到新的解析目标。
4. fresh `canWriteAccept` 也必须为 true，沿用它对当前 connection、capability/hook、hold、read-failed、session readiness 的既有判断。planner 的 engine 分支本身不代表这些门全开，不得跳过该事实或只依赖 raw IPC 方法存在。
5. 继续使用现有 builder / 非空 session、固定非空 argv、单 hunk patch 门。调用 `tryWriteSourcesGitApplyHunks` 时仍传入当刻的连接/hold/read-failed/readiness；最终授权检查到调用 hook 之间不插入新的 await。

两宿主都要实际走这条链；只修一个宿主、只加按钮禁用或只写一个未接入的 common helper 都不算实现。是否抽出少量共享结果处理以现有 planner 为准，不新增通用写入服务。

### 4.3 提示与已发写的边界

原宿主仍当前且 session 不匹配时，复用已有 `sourcesGitSessionChangedMessage()`。当前 facts 已是 closed / read-failed / not-ready 时刷新当前动作与闭态，不再增加一条泛化错误造成重复。宿主失效时不向新 input/ref 写提示；本稿不扩到 local Git completion 的 notice 修复。

写请求一旦实际发出，本方案不撤回、取消或回滚引擎操作。保留当前 supported / success / failure 的响应判定和成功刷新路径；响应与 catch 的 UI 写回复用 §4.1 的**同一个宿主存活谓词**，包括 input 自身已 dispose 但 Pane 未销毁的情况，不只比较 input 引用。后续宿主失效只约束原宿主的 UI 写回，不得宣称已发送的写被取消。不得因该请求返回前又切了会话而发补偿写、重放或第二条 Apply。

## 5. 最小可执行 red 与回归矩阵

实施后由唯一 baseline lane 运行；本 accepted 方案提交仍不运行、不改测试或 out。测试必须实例化两种真实宿主并走其实际 `runAccept` / 已有按钮委托 → deferred `readGitFileDiff` → write hook，不能只调用 planner/helper 冒充宿主验证。

复用 `conversationDiffReviewPane.test.ts` 的 deferred read 模式与 `sourcesDiffPanel.test.ts` 的双宿主 DI/mount、cursor 与请求收集；只扩展本 scope 需要的 mutable session、connection/read state 与释放门。不得替换生产 `runAccept`。以显式 read-start Deferred/Promise 确认一条 FileDiff 已进入等待、目标确为 `s1`，再改变事实、释放合法 diff；不用无限 microtask `while (!readInFlight)`，避免起步被 blocked 时饿死 timeout。fixture/模型/事件错误、未抵达读门或无有效 patch 均不算业务 red。

新 fixture 使用 header/body count 相等的单 hunk，例如 `@@ -1,2 +1,2 @@` 配 ` line1`、`-old`、`+new`，cursor 为 new side 第 2 行；保留完整 diff 文件头。先在阳性验证 builder 确能产非空 patch，而且真实宿主确实到达 ApplyHunks，实际请求严格为 `sessionId=s1`、固定 argv 和该单 patch。不得修改旧 case 的 header、断言或预期来清洗已有失败。

| 组 | 两宿主各自必须覆盖的时序与断言 | 旧生产预期 |
| --- | --- | --- |
| A1 主 red | `s1` read pending → active=`s2`、ready、input/ref 不变 → release；Apply=0、local Git=0，原宿主给 session-changed 提示。 | 静态预期仍向旧 `s1` 发 1 次 Apply；必须实际取得两宿主各自业务 red。 |
| A2 正控 | 同样的合法 patch/deferred 门，全程 `s1`；每宿主恰好 1 read、1 Apply、0 local Git，成功刷新符合现行行为。 | 应通过；防止 fake 0-write。 |
| A3 回到同 session | `s1 → s2 → s1` 后 release，原宿主/代次未变、当前门全开；每宿主 1 Apply 到 `s1`。 | 应通过；禁止引入连续授权取消。 |
| A4 宿主失效 | Pane setInput/clearInput/Pane.dispose；另立 input.dispose 负例，保持 Pane 存活且 `this.input` 仍严格等于原 input；Panel ref switch/clear/dispose。包含 clear 后同 input/ref 的生命周期代次变化；release 后均零 Apply，不覆盖后来宿主反馈。 | 既有守卫负控与必要局部代次补齐；input 自身销毁不能只由 Pane.dispose 测试替代，旧过/旧红分开记。 |
| A5 当前门闭合 | pending 时分别转为 disconnected、pairing-hold、capability/hook unavailable；**单独**构造 Session/List 失败→catalog readiness unavailable、以及 Git Changes 读取失败→snapshot `engine-leftover(reason='read-failed')`。各自保持另一门开放，核 fresh facts 后返回零 Apply、0 local Git，当前闭态保留。 | 多项应已被底层门拒绝；两类读取失败不用同一布尔值冒称双覆盖，不把旧通过冒充新增 red。 |
| A6 当前恢复 | 分别构造 Session/List 失败→catalog ready（Changes 门始终开放）、Git Changes read-failed→非 read-failed snapshot（catalog 始终 ready）；另测同 id disconnect→reconnect。各 case 原宿主有效且当前门全开，release 后允许 1 Apply 到原 `s1`。 | 当前授权正控；分别核两类 fresh facts 的恢复，不新增 engine 身份保证。 |
| A7 已发写后变化 | 确认 Apply hook 已调用再切 active/input/ref、销毁 Pane/ref 宿主，或只 input.dispose 而 Pane 与原引用保留，再返回 accepted 或 failed。只有原 1 次请求、0补偿/0 fallback；复用 A4 同一存活谓词限制 notice/刷新等 UI 写回，不把已发写称取消。 | 保持写结果的 supported/success/failure 判定；补齐同一宿主存活保护，不另造 local Git completion scope。 |

请求计数、sessionId、patch/argv、宿主 notice 的小投影是判据，避免打印整个服务/SCM getter 图。不同宿主独立记录结果；不能只将两个 hook 计数相加而遗漏一个入口。

## 6. 文件与验证责任

预计生产面仅 `browser/conversationDiffReviewPane.ts`、`browser/sourcesDiffPanelView.ts`；共享授权继续使用 `common/sourcesDiffWriteController.ts`，若实际需要最小共享收口应在本授权边界内。预计测试面是 `test/browser/conversationDiffReviewPane.test.ts`、`test/browser/sourcesDiffPanel.test.ts`，如改 common planner 则补其已有针对性 suite。

1. **D 作者**：draft → 规则 16 后改稿 → 独立 accepted commit；再写源码与双宿主新测试，不编译/转译/写 out。实施结果交不可变 SHA、全部 Included 路径与哈希。
2. **Astra**：父核验 draft 后按规则 16 只读评审；正式源码另做独立 peer。审查与产品运行分开判定。
3. **baseline 唯一 lane**：优先官方 Electron 的真实 Pane/Panel 组件测试，以固定 c7 旧生产与新测试取得 A1 两宿主业务 red；再按正式接入源码跑新定向 green、完整直接相关 Sources/Pane/Panel suites 及必要静态检查。逐项核 read request 与 ApplyHunks 的 exact sessionId / argv / patch bytes，以及拒绝时零 write / 零 local fallback。旧 builder / wiring / reasoning 失败按原身份保留，不改原断言求绿。source project checker / emit 全由该 lane 按实际错误决定是否扩大，不把全量 compile 或隔离 fake 窗口矩阵当收尾步骤，作者不另开车道。
4. **父级验收**：结合实际 red/green、独立 peer 与可执行边界决定是否还需默认编辑器 after；本稿静态链和单测不能冒充实端 Git 索引或 UI 交付证据。D1387 已签收不重开，也不将其 R3 结果外推到本 scope。

本方案提交前只运行文档状态生成/检查、docs health 与 diff-check；不运行业务、构建、窗口或假窗口。当前 out 冻结保持。

## 7. 行动与评审入口

- [作者检查点：draft 身份、规则16结论与两Minor采纳](../progress/sources-accept-post-read-authorization-checkpoint.md#规则-16-只读审查与父级采纳)
- [本 scope 分工看板](../parallel/active/sources-accept-post-read-authorization.md)
- [文档规则 13 / 16](../../docs/DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿)

**规则 16 状态：已通过方案门。** 原 draft 精确提交 `4b0d3d62e65e54e71d3b1748f100fac7ca5f6ce3` 经父级逐路径/原文保留核验后，原 Astra 只读审查为 **Critical 0 / Important 0 / Minor 2，Assessment：可由 root 核验后按既定流程 accepted；两 Minor 建议当轮明确**。两 Minor 本轮均由父级核验采纳：M1 明确 input 独立销毁负例及读后/写响应共享存活谓词，落 §4.1 / §4.3 / A4 / A7；M2 分开 Session/List 目录 readiness 与 Git Changes read-failed 的构造/恢复，落 §3 / A5 / A6。Strengths、原审查身份与采纳理由保存于上方检查点，不另建或覆盖旧 R3 review。未采纳项：无。该结论只签方案，本 accepted commit 不含实施或运行证据；父级核验后再另发源码实施授权。

## 8. 固定6d一次实际验收（2026-10-27）

两宿主Accept读后当前授权，54新例及完整两宿主模块实际通过。原Astra固定工具peer C0/I0/M1的四处行号镜像由root授权机械改为491，prep2窄peer C0/I0/M0，root核后单次释放并独立验收；[prepared原稿、active四字段映射、consumed与全部raw](../progress/sources-stale-render-6d-new-validation-20261027-evidence/INDEX.md)分列，不复用旧授权。

5目标项目noEmit checker全0（未请求non-target semantic），lint0error/0fatal/1旧637 warning，dry=actual5JS/0map；新54 Accept+18生命周期逐名start/pass/end各1，完整Pane3/3与Panel142/142、meta各1、hooks11/567平衡，pending/missing/unknown/failures0。旧stale四条原断言保固定source字节/顺序，实际whole-case body pass；没有逐assert运行插桩。

[旧双A1纯业务red](../progress/sources-accept-post-read-authorization-old-red-evidence/INDEX.md)、[run3 A4纯业务red与原default-false实际通过](../progress/sources-accept-qualified-old-red-run3-20261027-evidence/INDEX.md)、[原default-false setup探针失败](../progress/sources-accept-default-false-probe-20261027-evidence/INDEX.md)及[8438旧stale首断言败/后三未达](../progress/sources-accept-a4a-new-validation-20261027-evidence/INDEX.md)全部保持原件，不把旧run改绿。

本方案仅在source/真实组件范围implemented；原设计/旧review/失败历史及生命周期633B唯一例外保持。当前out已恢复旧native256，metadata采用新guard54fe37（相对8b5f仅获准五ctime），freeze4/cache3精确，fullCompileOfFinalSourceTree=false。按root采纳的原Astra最小充分边界，不另要求Sources UI after或未改controller suite；不声称实端Git索引、UI after或全src semantic/fullcompile已验。PRD、宽Sources、D/D1387旧签收与旧J/E波不升，overall goal仍active；consumed release不再授权运行。
