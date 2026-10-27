---
title: "Sources Pane：取消后停止后续模型解析"
type: plan
status: draft
phase: M7
updated: 2026-10-27
summary: "固定3fc83b3源码裁定C0/I1/M0后独立窄draft：首original await后复核owner/input/token/generation，失效释放且不申请modified；规则16与实施授权待。"
---

# Sources Pane：取消后停止后续模型解析

> **纯文档 draft，规则 16 待。** 范围仅默认编辑器的 Sources `ConversationDiffReviewPane`，不含 Agents Window。原 Astra 源码裁定经 root 采纳，不等于本稿已审或可实施；本轮未改源码/测试/工具，未做 AST、lint、compiler/Program、emit、测试或 out/cache 写入。先按 [DOCUMENTATION 规则 16](../../docs/DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿)交原 reviewer，独立 accepted 与源码授权均待。

## 1. 固定源码与审查来源

审计基线 `3fc83b388a0977b36ecc8add7863d1f9a2a46eac`，src tree `3dc1205763451e60e70c1a8a84465613990aa526`；以下行号按该对象。原 Astra / `architecture_audit` 的 actual-code `FINAL_ANSWER` 由 root 在本会话直接转发并采纳，**不是 terminal raw，也不是本稿规则 16 审查**。root 转发的原句：

> 真实 Important 遗漏，C0/I1/M0。应另立 Pane 的窄修复plan，保留已implemented Panel plan及历史。

作者已亲读源码与测试，确认以下机制，不以历史 implemented 或 green 作为证明：

| 固定来源 | 已有合同与缺口 |
| --- | --- |
| [Pane](../../src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts) `:783–806` | `:791` await original 后，`:792` 无条件申请 modified；`:799–802` 才检查 owner/input/token/generation。refs 到 `:805–806` 才转给实例 holder。clearInput/dispose `:282,:293` → clearEditors `:865–874` 接不到局部 original。 |
| [EditorPanes](../../src/vs/workbench/browser/parts/editor/editorPanes.ts) `:449–464,487–502`；[LongRunningOperation](../../src/vs/platform/progress/common/progress.ts) `:184–216` | 新操作先取消旧 token 并 clearInput；隐藏活动 Pane 也 stop/clearInput；stop 的 disposables 调用 CancellationTokenSource.cancel。这是实际关闭/替换/取消链。 |
| [TextModelResolverService](../../src/vs/workbench/services/textmodelResolver/common/textModelResolverService.ts) `:58–67,186–200,242–249`；[AsyncReferenceCollection](../../src/vs/base/common/lifecycle.ts) `:719–735` | 文件/remote 文件与虚拟 provider 异步解析；createModelReference 不接收 token。成功引用须调用方释放，失败由 resolver 回收内部 acquisition。 |
| [本地 ref](../../src/vs/workbench/contrib/sources/common/sourcesChangeRef.ts) `:68–80`；[FileDiff 选择](../../src/vs/workbench/contrib/sources/common/sourcesChangesGitRead.ts) `:97–101` | SCM/QuickDiff original 保留 provider URI，modified 保留 entry.resource；这些真实路径可触发异步文件/provider 解析。引擎路径在 [open](../../src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts) `:121–151` 先读 FileDiff、缓存双侧；[模型 provider](../../src/vs/workbench/contrib/sources/browser/sourcesDiff.contribution.ts) `:27–29` 只读缓存，不能称第二次模型解析必然新增引擎 RPC。 |
| Pane `:243–267`；[load signal](../../src/vs/workbench/contrib/sources/browser/sourcesDiffLoadSignal.ts) | render 返回后还有失效检查，再发携带 resource/generation/ok 的成功或失败 load 事件；取消或旧 owner 不应发旧 generation 的结果。 |
| [Pane 测试](../../src/vs/workbench/contrib/sources/test/browser/conversationDiffReviewPane.test.ts) `:159,:224`；[Panel](../../src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts) `:789–795,831–832` | Pane 两项具名测试均针对 Accept，无首模型 await 门。Panel 已逐 await 复核并 finally 释放；[现生命周期测试](../../src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts) `:3406–3604` 只 defer modified。本稿仅用其合同对照，不增加 Panel 实现或运行要求。 |

首 original pending → 关闭/替换/取消 → original 迟到成功 → 旧代码仍申请 modified，original 继续局部持有 → 等第二解析收束才释放 original、结束旧 setInput。真实影响是多余解析、引用占用和收束拖延；已有 catch 与第二 await 后守卫仍能清理并阻止陈旧安装，因此不称永久泄漏或旧画面必然覆盖。

## 2. 最小改法与保留范围

未来只改 `conversationDiffReviewPane.ts` 的 renderDiff 首 await 边界及 `conversationDiffReviewPane.test.ts` 必要回归。首 original 成功返回后，完整沿用当前第二 await 后的失效条件：`this._store.isDisposed || this.input !== input || token.isCancellationRequested || generation !== this.renderGeneration`。任一成立即 dispose original、return false，不再申请 modified。

当前 owner 有效则继续现路径；保留第二 await 后检查、原 original/modified 拒绝清理及 widget/VM 安装。每份实际取得的 ref 恰当释放一次，旧 render 只清自己的局部资源，不能清 successor。不改 generation 规则或公共 API，不引入新生命周期服务。 保留 setInput `:243–267` 外层完整失效检查与 load 事件代码；renderDiff false 不会转入 modified-only fallback，故无须扩大外层修改。

不强取消已发出的 createModelReference，也不要求“modified 已合法发出后才关闭”时立即释放 original；该路径仍按现有 await 收束清理合同处理。排除 modified-only、Panel、provider、引擎、打开/Move、Accept/Stage/local Git 写入、lease/Reveal/WorkRootMount/emitter 与运行工具。

已 implemented 的 [Panel 生命周期](sources-panel-diff-view-model-lifetime.md)、[共同 factory 修订](sources-panel-fixture-preinjection-amendment.md)、[旧 stub 修订](sources-panel-stale-render-stub-amendment.md)及 [Accept 读后授权](sources-accept-post-read-authorization.md)四方案和历史原文保持，不重开其完成范围。

## 3. 真实 resolver 回归设计

以下仅为静态可行设计，尚未写或运行。通过公开 setInput/clearInput/dispose、CancellationTokenSource 驱动真实 Pane，不直接调用 renderDiff 或改私有存活标志。

- 复用现 factory 的 `resolveModels=true` 分支及真实 diff provider/interaction/progress 依赖。先获取真实 ITextModelService，再薄包装记录 createModelReference 调用与成功 ref 的转发 dispose；新辅助夹具就近放本测试文件，不改旧 factory 默认参数或 Accept 用例/断言。
- 向真实 resolver 注册测试独有 scheme 的 content provider。original provider 用显式 started/release Deferred 控制真正解析，成功返回真实 IModelService model，失败拒绝 provider Promise；不伪造 resolved model。原稿 provider 拒绝时没有成功 ref 交给 Pane，不虚构一次 dispose；不把 refs 长期 pin 到 suite store。
- original 已 started 才失效。主回归可为 modified 设置独立 started/release 门；放开 original 后，让“旧 setInput 完成”和“意外 modified started”两个显式 Promise 竞争，应先完成旧操作。旧代码若启动 modified，以业务断言失败，finally 再放开 modified；不用超时或无限微任务轮询充当 red。
- 使用独立 URI，调用真实 allocateSourcesDiffLoadGeneration/input.assignLoadGeneration；操作前订阅 onDidSourcesDiffLoad，按旧 resource/generation 精确过滤。观察 Pane.getControl、真实 code-editor service 公开列表和模型 URI。replacement 先完成有效 successor，再放旧门，确认当前控件/内容/refs 不受影响。
- finally 放开全部自有门并等待已启动操作收束，再清理 Pane/provider/监听；保留现 disposable tracker。未到 started、DI/provider/释放错误均不能算业务 red；模型另有合法 owner 时不要求立即销毁，判据是本 Pane 持有的每份 ref 正确释放及最终清理。

前四种失效各覆盖 original 迟到 success/reject，共 8 项；另 2 项当前 owner 正控，共 10 项设计用例，实际展开以后续固定源码为准。

| 场景 | 必须观察的结果 |
| --- | --- |
| clearInput | pending 中公开 clearInput；success 不申请 modified、original dispose=1、旧 setInput 完成；reject 不申请 modified且正常收束。均无旧 widget 或旧 success/failure load 事件。 |
| dispose | pending 中公开 dispose；迟到 success/reject 沿同一合同处理，不复活宿主或向已销毁控件/事件写回，最终无资源泄漏。 |
| replacement | 同 Pane 打开并先完成有效 successor；旧 success/reject 不申请旧 modified、不发旧事件、不改新控件/内容/refs；successor 只发自身正确结果。 |
| token-only | 同一 Pane、同一 input 对象及 load generation 保持，只 cancel 当前 token；不 clear/dispose/rebind。success 仍须停止 modified、dispose original=1；reject 正常收束。均无旧 widget/旧 load 事件，不能以输入变化掩盖 token 遗漏。 |
| 当前 owner 正常双 ref | 两侧真实解析，实际 diff 使用正确模型；准确一次本 generation ok=true，当前 refs 在 clear 前不释放，clear/dispose 后各释放一次。 |
| 当前 owner modified reject | original 真成功、modified provider 真拒绝；original dispose=1、无成功 modified ref/无 widget；比较 fail，准确一次本 generation ok=false，setInput 不形成未处理拒绝。 |

主业务 red 预期是失效后仍申请 modified；迟到 reject、正常双 ref 与 modified reject 正控保护现有清理及结果发布。上述预期不能记成已获旧 red/新 green。

## 4. 队列与实施基线

J 本轮从 clean `loop/J` / `468d805ef929298de9113f72665a3de0bdf4742a` 重证为审计基线祖先，一次 `git merge --ff-only 3fc83b388a0977b36ecc8add7863d1f9a2a46eac` 成功，再开 `fix/j-sources-pane-cancelled-model-resolution-20261027`；未动 D/E/merge/main。这是 docs 起点，不是未来可直接覆盖其他候选的实施基线。

D 未合候选 tip `22d39579e8e3efc2dd62c4f6c98ba8070f493979` 含 `a22776d0f63d117d876f7c66c8d223ebd04eb4aa` local Git feedback 实现与 `ae7d0873feedbed1457f38748a6a5e8be0114ee0` 测试 await 修订。root 已核其独立方案 accepted、源码 peer/lexical 输入采纳、运行待；不计入本基线、不复制其方案或迁移/重置 D。root 固定 diff 核到两宿主生产各只改 runGitAction 一个 hunk，renderDiff/clearInput/dispose 与本基线逐字相同；方法分离不能预判合并/测试无冲突，D 两测试有大量新增。后续须由 root 先排 D 集成顺序，真实三路保留全部测试，按届时固定 HEAD 重核本 scope 再授源码，不能直接以 3fc83b3 实施覆盖 D。

顺序：不可变 draft → root 核路径/字节与 src 未变 → 原 Astra 规则 16 → root 改入 Critical/Important、独立 accepted → 处理集成顺序并另授源码 → 固定源码 peer → 唯一 lane 另授旧 red/新 green 与必要完整 Pane 套。lease 运行优先，本稿不抢 lane。

本轮不准备 checker/emit/运行工具，不做源码静态或运行验证。后续只按实际变化选择新 resolver 矩阵、完整 Pane 与必要关联检查，保留既有 Accept；不要求新增 Panel 运行、全量 compile、UI 或引擎 Git 实端。其他历史证据不转作本稿信用。

## 5. 文档交接状态

- [x] 固定源码/原审查来源与真实事件、resolver 夹具可行性已核；J 安全 ff 与独立 docs 分支已建立。
- [ ] 本稿规则 16 Strengths / Critical / Important / Minor / Assessment 待；源码裁定不代替方案审查。
- [ ] root 采纳、独立 accepted、D 集成次序及实施基线待；源码/验证未授或未执行。

Included 为本方案、[方案索引](INDEX.md)、[当前看板](../parallel/active/sources-accept-post-read-authorization.md)、[工位池](../progress/worktree-pool.md)和 [status](../progress/status.md)。仅行动层 draft，无需改知识层设计；提交门禁只查文档生成状态/结构健康与字节路径，不充当源码验证。
