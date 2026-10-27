---
title: "Sources Panel：Diff ViewModel 与文本引用生命周期"
type: plan
status: draft
phase: M7
updated: 2026-10-27
summary: "独立窄draft：修复Panel隐式Diff ViewModel无owner及detach/VM/refs释放顺序；精确旧红揭示真实泄漏，先决DI夹具仅新真实模型路径，规则16前不实施。"
---

# Sources Panel：Diff ViewModel 与文本引用生命周期

> **固定作者输入**：`b2e31763207201841c5a7fb47b6859eab90fe134`，`src=3ce82089efd4230dc020c5401b2f4e9bc0b1475a`；不追 main / merge。该提交的 Accept 4 例增量已由 root 核验，原 Astra 窄 peer C0/I0/M0，原 A7 Minor 关闭；不是本方案的规则 16 审查。
> **当前授权**：root 只授权独立 draft 与必要文档 commit；不改生产、测试、已签 Accept 方案或 out。draft 提交后先由 root 核验，再交原 Astra 只读规则 16，改稿并另交 accepted commit 后才可另行授权实施。 方案阶段只读精确 Git 对象，不请求 baseline 接入 D HEAD；其祖先含 ab43 / b2 源码，正式代码 gate 另行决定，后续以统一 Panel 实施候选做 peer 与绑定验证。
> **既有边界**：默认编辑器窗口；[Sources SSOT](../../docs/systems/sources/overview.md)、[Accept 当前授权方案](sources-accept-post-read-authorization.md)与既有 Pane 实现为参照。本稿只修 Panel 模型资源所有权，不增加产品能力或更改 Accept 的授权/响应合同。

## 1. 已核问题与证据等级

baseline 唯一 lane 的 `vscode-sources-accept-ab43-old-red-20261027-run1` 使用精确 c7 生产 3 文件与 ab43 测试 2 文件临时 emit 后运行，finally 恢复原 5 输出。下表是已发生的 reporter 事实，由 root 独立解析并核验 5 inputs 对 Git、5 输出恢复对封存 bytes/mode/mtime；不是本作者新运行或对 b2 全矩阵的结果。

| 原执行组 | 实际达到与结果 | 可证明 / 不可证明 |
| --- | --- | --- |
| A1 两宿主主 red | 2 tests / 0 passes / 2 failures；每宿主 read 1 后旧 s1 Apply 1，合法 patch、refresh 1，违反零 Apply 断言。 | 两宿主读后写前授权业务红成立；失败保留，不受本生命周期修复回写。 |
| A2 / A3 阳性组合 | 实际只执行并通过 Pane A2、Pane A3、Panel A2 共 3 个业务 case；Panel A2 的 afterEach 报 3 个未释放 disposable，另有 console meta failure。 | 仅 **3 个业务阳性通过**；Panel A3 未达，不得称 4/4、整组通过或完整 matrix green。 |
| 独立 Pane input.dispose | 1 test / 0 passes / 1 failure；初始化 ChangesModel 时 connection 为 undefined。 | setup 失败，未到 FileDiff / input.dispose / Apply 业务；不算 input.dispose 业务 red 或 green。 |

baseline 已在 merge 工位实际创建正式入口 `dev/progress/sources-accept-post-read-authorization-old-red-evidence/INDEX.md`，baseline 已提交 proof `d51ce65f86605b47f31c8d99bfbd98fd9f43564d`（parent `93da1c80`、src a2c 保持，D 未同步该提交）。该目录含 `primary-a1.mocha.json`、`positive-a2-a3.mocha.json`、`independent-input-dispose-a4.mocha.json`、`validation-report.json`、`result-classification.json`、`artifact-inventory.json` 等 54 份镜像 / 15,022,205 bytes；baseline 通报各 SHA / bytes 核验一致。D 未复制该目录或同步 merge，当前只以精确仓内路径登记，合入后由 baseline 统一补正式链接。原临时来源仍是 `/tmp/vscode-sources-accept-ab43-old-red-20261027-run1/`，原件不覆盖。输出恢复只允许原 5 文件 ctime 差；其余恢复资格以原报告为准，本稿不另跑/写 out 复核。

### 1.1 Panel 生产所有权缺口

以下行号属于 b2 / ab43 的同字节生产文件；c7 的 renderDiff 对应 `:774`、clearEditors 对应 `:824` 起，该生命周期区域没有随 Accept 修复改变。

| 源码 | 已核链路 |
| --- | --- |
| `sources/browser/sourcesDiffPanelView.ts:122–126,789–796` | Panel 只登记 widget / text-model wrapper / ref，没有 Diff ViewModel owner；将普通 `SourcesDiffEditorModel` 交给 `widget.setModel(editorModel)`。 |
| `editor/browser/widget/diffEditor/diffEditorWidget.ts:503–513,532–538` | 普通 model 会隐式 createViewModel 并创建 RefCounted，setDiffModel 再 clone 到 widget；传入的初始 ref 没有对应释放。 |
| `editor/browser/widget/diffEditor/utils.ts:446–509` | 初始 refCount=1，clone 增加引用，只有降到 0 才销毁真实 VM。 |
| `sources/browser/sourcesDiffPanelView.ts:273–277,782–783,824,846–851` | renderRef 先清 bodyDisposables；双 ref / 单 ref 又在该 store 中登记。clearEditors 先释放 model / ref 再销毁 widget，不能保证文本模型仍在被使用时不被释放；host dispose 也没有显式统一 teardown。 |
| `sources/browser/conversationDiffReviewPane.ts:102,814–818,865–874` | 已签 Pane 显式持有 `IDiffEditorViewModel`，先 detach widget，再清 VM 与 refs；仅作本地实现参照，不把 Pane 结果外推为 Panel 已修。 |

前缀分别相对 `src/vs/workbench/contrib/` 与 `src/vs/`。原泄漏栈是 Panel renderDiff → DiffEditorWidget.setModel → createViewModel → `DiffEditorViewModel`；另两个泄漏为其 autorun 的 `_DisposableStore`、diff provider 事件订阅的 `FunctionDisposable`。测试中的 Panel 自身已经 `store.add`，不是漏登记宿主。Astra 独立只读定界为既有**生产 VM owner 缺陷（Important）**，root 亲读相同链后采纳；该判断不替代本新方案规则 16。

### 1.2 独立 Pane 夹具先决错误

`conversationDiffReviewPane.test.ts:187` 的新真实模型路径进入 `createInstantiationService(..., true)`，再由 `:129` 调 `stubSessionAndChangesModel`。旧 helper 在 `:102` 先创建真实 `SourcesChangesModel`，到 `:109` 才 stub `IUniverseAgentConnection`；`sources/common/sourcesChangesReadModel.ts:56–64` 构造器同步订阅 `connection.onDidChangeConnection`，因此注入 undefined 即抛。传入的连接对象 `:175` 本身有 `Event.None`，不是缺字段。旧 c7 helper 同样先 `:96` create、后 `:103` stub；本次不得为清此失败改旧默认路径、旧 case 或其断言。

## 2. 范围与不变量

生产面仅 `sourcesDiffPanelView.ts` 中模型创建、资源所有权、替换/清空/销毁与异步 model-ref 收束；最多所需既有类型 import，不新建公共服务或通用 VM 框架。

- Panel 每个真实 diff render 的 VM 有且只有一个显式、可释放的宿主 owner；text resolver refs 的最终 owner 唯一且清楚。
- 替换、clear、同 ref 重新 show、host dispose 都满足 **detach widgets → dispose widgets / VM → release text refs**；refs 不得因 bodyDisposables 或默认字段注册顺序提前释放。
- 真实新文件的单 CodeEditorWidget 路径也先 detach，再释放其 modified ref；不能只修双模型路径。
- await resolver 时失效/销毁的操作只释放自己取得的 refs，不发布 widget / VM、不复活已销毁 host、不清后来的 owner。
- Accept 的 `runAccept`、currentWriteFacts、planner、session/门/代次语义、patch/argv、响应判断及原 54 case 的已有调用正文保持原字节。仅 active/connection/Changes/layout 通知仍不重建 render 代次。
- 不改 generic `DiffEditorWidget` / `RefCounted`，不在测试中捞取未知内部 VM 并额外 dispose，不跳过/豁免 disposable tracker，不放宽 afterEach 或业务断言。
- 不修改现 Pane 生产、打开/Move、Stage/Commit/Revert/Unstage 业务逻辑、lease 或 local Git completion 反馈；D1387、旧 J/E R3、PRD 与宽 Sources 方案的签收边界保持。
- 原 Accept plan 17436 bytes，SHA-256 `5d5c2a72fcb9d555b15d0442d0c7d47ae9238998cea2eb25b4b7917af8362e61` 保持；本方案独立 draft，不把它实质改写为生命周期方案，也不将其标 implemented。

## 3. 选定实施形状

### 3.1 显式 VM 与唯一 refs owner

以下 ownership 形状已向原 Astra 做设计咨询并获确认，与其独立定界一致；**这是写 draft 的设计输入，不是本稿规则 16 通过**。参照已签 Pane，Panel 增加私有 `MutableDisposable<IDiffEditorViewModel>`。完成并核验当前双 resolver refs 后，保留现 `SourcesDiffEditorModel` 作为双 refs 的唯一最终 owner；用实际 widget 的 `createViewModel` 显式创建 VM，交宿主 holder 后 `widget.setModel(viewModel)`。不能继续触发 plain-model 的隐式 VM 分支，也不直接依赖 widget 私有 `_diffModelSrc`。

从 bodyDisposables 移除同 originalRef / modifiedRef 的重复登记；双 refs 只由 `SourcesDiffEditorModel` 释放，单文件 ref 只由已有 modifiedModelRef holder 释放。bodyDisposables 只保留本 render 的光标/焦点等事件订阅。这是资源归属修正，不能仅调 clearEditors 内几行却遗留 renderRef 的 `bodyDisposables.clear()` 提前释放同 refs。尚未完成 owner 转交的局部 refs 由当前 async 操作在失败/失效路径自行释放；转交后不得再在 catch/finally 释放第二次。

### 3.2 一个 teardown 覆盖所有同步出口

统一 clearEditors 的语义，renderRef 的 replace / clear / 同 ref 重渲与 host dispose 都调用它。顺序是：

1. 停止本 render 的 cursor/focus 订阅，清 acceptCursor，避免 detach 事件重写旧 cursor。
2. 对仍存在的 DiffEditorWidget 和 CodeEditorWidget 调 `setModel(null)`，使真实编辑器先脱离文本模型。
3. 销毁旧 widget，随后销毁宿主持有的 Diff ViewModel。
4. 最后清 `SourcesDiffEditorModel` / modifiedModelRef，使 resolver refs 释放；bodyDisposables 此时已无 refs 可提前释放。

不能只信 `_store` 字段注册顺序。Panel host 明确在 `super.dispose()` 前调用同一幂等 teardown，其他 render 清理不会再重复释放 refs。renderRef 原有先清 body 后清 editor 的代码必须与本顺序一起收束；不遗漏单文件路径。若观察到异步 VM 内部短暂引用，须按真实 owner 与已有 Pane 形状解决，不以测试延时掩盖未释放的根 VM。

### 3.3 await 中止后的局部资源

host dispose 入口先使 renderGeneration 失效，再进入统一 teardown，最后 super.dispose；clearEditors 本身不无条件递增 renderGeneration，避免破坏 renderRef 刚捕获的有效代次。双 refs 两次 await、单 ref await 返回后、任何 refs / VM / widget 写入字段之前，沿用 captured generation 核对并补 host `_store.isDisposed` 核对；失效时只销毁本操作的局部 refs。original 已到而 modified 尚 pending 时发生 dispose，无论 modified 最后成功还是拒绝，都须恰好释放已获得的 original；modified-only 迟到同样释放，不转入 body / model holder。host dispose 即使没有下一次 show/clear，也必须阻断迟到 resolver 发布，不能只在最初 await 前查 alive。保留现有 activeRender / load signal / settle / service attach 合同，不制造 session epoch，不用重置 Accept 逻辑实现资源取消。

构造 widget / 显式 VM 或接入发生异常时，已经交给 owner 的对象走统一 teardown，未交出的 refs 走局部释放，不能留下 VM、丢失 ref 或清掉后来一代资源。具体最小 try/catch 收口以实现 peer 核对为准，不预授权修改通用 editor。

### 3.4 验证先决：仅新真实模型夹具预装连接

在 `conversationDiffReviewPane.test.ts` 的 `createInstantiationService` 内，仅 `resolveModels === true` 分支于调用 `stubSessionAndChangesModel` **之前** stub 当前传入的 `IUniverseAgentConnection`，使真实 ChangesModel 构造时取得完整连接。默认值 false、旧 helper 正文与安装次序、旧 case / 标题 / header / 断言保持原字节。不得把此新路径修正写成原 setup 已经过业务，也不得把准备性修正算作 Panel VM 生产修复。

本项与 Panel 生命周期一起接受方案审查，accepted 后再作为必要 test-only 修正实施；本 draft 不改测试。后续先证明独立 case 确已进入 FileDiff，再记录其业务 red / green。

## 4. 生命周期回归与实际判据

新回归使用真实 Panel、DiffEditorWidget、IModelService 文本模型与 resolver refs。可以在现有真实 resolver / diff provider 的公开注入边界记录 acquire/release、订阅收束及 model-dispose 事件，并转发给真实对象；不能替换生产 widget、手工销毁其内部 VM、用源码字符串顺序扫描充当回归。测试验证用户可触发的生命周期与资源结果，不镜像实现字段。

| 场景 | 实际操作与最小判据 |
| --- | --- |
| 首次 show 后 replace | 真实 show 比较 A 成功，再 show B；B 真完成并保留可用模型，A 的 widget 已 detach、VM/provider 订阅已收束、每个 A resolver ref 恰好释放 1 次；afterEach tracker 无泄漏。 |
| clear | show 成功后 service.clear；编辑器无 model、旧 refs 释放、旧订阅收束；不能只删除 DOM。 |
| host dispose | show 成功直接 panel.dispose，既不先 service.clear 也不捞内部 VM；先 detach 再释放 refs，所有 owner 经正常路径结束；重复 dispose 不重复释放。 |
| 同 ref 重新 show | 用完全同一个 ref 对象再次 show，确认真实新 render 完成；旧代资源释放、新代正常可用，不用引用相等跳过生命周期。 |
| diff ↔ 单文件切换 | 真 diff 切到没有 original 的 CodeEditor，再切回；每次旧 widget 先 detach，双/单 refs 各恰好释放，当前模型仍能读取；最终 clear/dispose 无泄漏。 |
| 双 ref 第二次 await 后 clear / dispose | 显式 deferred resolver，在 original 已得、modified 未完成时失效；分别让 modified 成功或拒绝，释放门后所有实际获得的局部 refs 各释放 1 次；不发布旧 widget/VM、不影响后来有效 render。 |
| modified-only await 后 clear / dispose | 单文件 resolver pending 时失效，再让它完成；迟到 ref 释放 1 次、不发布 CodeEditorWidget、不复活 host。等待用显式 started/complete 与提前结束拒绝，不无限微任务轮询。 |

释放顺序从真实行为观察：resolver 的释放观察点确认旧 widget 的公开 `getModel()` 已为 null，VM 持有的 provider/event 订阅已结束，再转发真实 ref.dispose；独立 keeper 只用于检查当前 render 不被过早销毁，不能把旧 refs 永久 pin 到 suite store 掩盖释放。disposable tracker 保持启用，以真实 afterEach 捕获剩余 VM/store/listener。模型自身若另有合法外部 owner，不强求当场销毁；判据是 Panel 持有的每份 ref 恰当释放、当前模型存活、最终全 owner 归零后无残留。

已存在的 54 个 Accept 真实宿主 case 仅可复用其**确实可执行**的部分，保持原调用/fixtures/断言；它们不能取代上述替换/clear/dispose/ref 释放观测。旧 run1 的 Panel A2 afterEach 是已发生的生产泄漏 red；独立生命周期用例如需旧源码 red，由唯一 lane 按精确 b2 生产与新增测试另行取证，未运行前不宣称已覆盖。禁止将 run1 的 3 阳性写成 4/4。

## 5. 实施与验证门禁

1. D 只交 docs draft → root 核固定输入、全部路径/原首条留存 → 原 Astra 规则 16 只读审查 → root 核验并改稿 → **独立 accepted commit**。在此之前不实施或修 fixture。
2. 后续 root 单独授权源码后，实施只碰 Panel 生命周期、上述真实模型路径预 stub、必要新生命周期测试与主题文档；Accept runAccept / 原 cases 与已签 plan 字节保护。交不可变 SHA 与每个 Included path hash，作者仅允许被释放的静态检查，不另开编译/运行 lane。
3. 原 Astra 对源码做独立 peer：特别核 body store / 双 ref wrapper / 单 ref holder 的唯一 owner、同步 teardown、迟到 resolver / 异常与 host dispose；不借先前 Accept C0/I0/M0 免审生产生命周期改动。
4. baseline 唯一 lane 在父级明确释放的 checker / emit / 官方 Electron 边界下验证：先核新 fixture 确到业务，补齐原阳性 4 个的实际完成状态；验证新生命周期用例及 54 个实际可执行矩阵，再按变化选直接相关 Panel / Pane suites。run1 原件与失败保留；新结果单独按新身份记录。没有权限时不编译、不 emit、不写 out，不把全量 compile 当收尾仪式。
5. 父级依据真实结果与 peer 决定签收，不以 plan accepted、AST/lint、旧 R3 或已过的 3 个业务 case 冒充完整运行 green。out/freeze/cache 继续冻结，不能在 draft 或 accepted 方案阶段释放。PRD、D1387 与宽方案不升状态。

## 6. 文档与审查入口

- [复用作者检查点与原 status 首条](../progress/sources-accept-post-read-authorization-checkpoint.md#panel-生命周期-draft-与-b2-status-首条)
- [复用行动看板：实测验证先决](../parallel/active/sources-accept-post-read-authorization.md)
- [Accept 候选历史与 b2 四例窄 peer](../progress/sources-accept-post-read-authorization-checkpoint.md)
- [文档规则 13 / 16](../../docs/DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿)

**规则 16 尚未发生，方案仍 draft。** 本文的 Astra 生产缺陷定界和旧候选窄 peer 均有各自对象，不等于该方案已通过。提交前只做文档生成/健康/diff 与保护字节检查；源码、测试、构建和业务执行均不在本轮授权。
