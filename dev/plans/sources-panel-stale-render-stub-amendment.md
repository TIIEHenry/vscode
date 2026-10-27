---
title: "Sources Panel：旧异步 render stub 合同的唯一例外"
type: plan
status: accepted
phase: M7
updated: 2026-10-27
summary: "root独核b0 accepted后另授权，唯一旧case fakeWidget的createViewModel一行候选已写；设计/lifecycle不改，accepted保持，待父核/原Astra窄peer与另释唯一lane，未验证旧case修复。"
---

# Sources Panel：旧异步 render stub 合同的唯一例外

> **当前阶段（b0核验后）**：root已另行明确授权 §7 的唯一 test-only 行；当前候选已写，尚待父核与原Astra窄 source peer，未运行。下方固定作者输入及 §1–§6 保留 draft / accepted 文档时点叙述与已签设计，不把“仅文档/源码未授权”当作当前候选阶段；现行生命周期方案不再修改。

> 固定作者输入：`eefce63e1541625baa39a4abd1608fc3cdbb8c5b`，`src=d78a48e5feee57fcaf5811c8425859d0a2400af0`；其中 Sources 源码等精确 `a4a70322795c509e8e9b8274cf295a1b65db663a` / 正式合源 `33b9b820701d7cfe20fe36fde56ba1ecfebbada4`。本稿只有文档；不追 main、merge WIP 或 baseline 正在整理的 proof。

## 1. 已发生的失败与静态解释

唯一 lane 的 `/tmp/vscode-sources-accept-a4a-new-validation-20261027-prep2/validation-report.json` 及 `full-sources-panel.stdout.log` 是本次实际原件；baseline 正在独立入库，本稿不复制其 WIP、不虚构正式 proof 路径。项目上下文五文件 noEmit、ESLint、dry、五 JS actual emit 已完成；完整 Pane 为 **3 tests / 3 passes / 0 failures**（2 declared + meta），完整 Panel 为 **142 / 141 / 1**（141 declared + meta）。新增 Accept 54 + lifecycle 18 的 **72 个 unique fullTitle** 每个实际 start/end/pass 各 1，fail/pending/missing 为 0，hook failures 为 0。完整 Panel 仍未通过，不能以新 72 通过代替旧 case 修复资格。

唯一失败的完整身份是：

```text
Sources diff panel superseded async render cannot paint an older file diff
```

raw `:97` 仅记录第一个标题断言的业务 `AssertionError`：actual `''`，expected `'stale-panel-b.ts'`；后面三条断言未达。raw 未记录 `TypeError` 或 `createViewModel` 异常，不能写成运行时捕获到缺方法异常。

以下是固定源码的**静态解释**：`sourcesDiffPanel.test.ts:437–443` 的本地 `fakeWidget` 没有 `createViewModel`；新生产 `sourcesDiffPanelView.ts:805` 调用该方法，`:826–830` 捕获内部失败并返回 false，`renderRef:323–335` 随后清空标题并发布加载失败。这条链与实测现象一致，内部 load 失败没有独立运行观测，修正后是否通过仍须实际复验。不得因此降级生产所有权或修改业务期望。

## 2. 拟议的唯一 test-only 差异

仅在上述旧 case 的本地 `fakeWidget` 对象增加一个成员：

```ts
createViewModel: () => toDisposable(() => { }),
```

既有文件已导入 `toDisposable`，不增加 import、helper 或 API。每次调用返回新的显式可释放 VM 替身；该 fake 的 `setModel` 保持 no-op，所以本 case 需要的 VM 使用合同只是交给生产 owner 后可释放，不需要模拟真实 diff 计算。`toDisposable` 创建受 tracker 观察、幂等释放的对象；这不是完整 `IDiffEditorViewModel` 实现或真实资源回归替身。

生产 `renderDiff:820` 将返回值交给 `diffViewModel` holder；正常 `view.dispose → clearEditors:889` 释放它，转交前失败/失效则由 local 清理 `:783` 释放。VM 不登记到 suite store，不由 `fakeWidget.dispose` 拥有，不从测试手工销毁生产内部 VM。原真实 18 例仍使用真实 widget / 模型 / refs，不能由本 fake 证明或替换。

保持原 case 的完整路径意义：A 的第一次 `renderDiff` 仍被 `staleGate` 挂起；B 仍经真实 Panel 渲染路径取得当前标题；释放 A 后仍由原 generation 守卫拒绝旧渲染。以下全部保持原字节：标题、header、四条原断言、resource/ref、两次 show 的顺序与参数、renderDiff wrapper、staleGate/release 位置、`timeout(0)` 与两次 `timeout(50)`、finally 正文及其他 case 字节。不改 expected，不删除/skip，不加 sleep，不替换 renderDiff/runAccept，不加生产 fallback、epoch 或新 API。

三生产文件、`conversationDiffReviewPane.test.ts`、其余旧 cases / shared helpers、54 + 18 新例、全部旧证据及 dispatch JSON 继续保护。[Accept 方案](sources-accept-post-read-authorization.md)与[共同预注入修订](sources-panel-fixture-preinjection-amendment.md)全文不改；本次仅在[Panel 生命周期方案](sources-panel-diff-view-model-lifetime.md)追加 §3 精确例外段，其余原文逐字保护。

## 3. 已签收的旧 case 保护例外

生命周期方案 §5 第 2 条的“原 cases 与已签 plan 字节保护”和 §3.4 的“全部旧 case / 标题 / header / 断言保持原字节”约束了本次修改，不能以 trivial fixture 为由自行豁免。root 已采纳作者/原 Astra 只读合同提案（C0/I1/M0）的 Important：先明确唯一例外；该预审不是本稿的规则 16。

精确 draft `1dcd047bc0d7f5568eae496b61c644d98ed85732` 已经原 Astra 正式规则 16（C0/I0/M1）；root 核验并采纳唯一 Minor，明确同步现行生命周期合同。本独立 accepted 文档提交已**仅在该方案 §5 编号列表之后、§6 之前原样追加以下一段**，使唯一成员例外对 §3.4 / §5 第 2 条生效；其余原正文逐字保护，另两旧 plan 和 JSON 仍全字节保护：

> **旧 stub 合同唯一例外**：仅 `Sources diff panel superseded async render cannot paint an older file diff` 的本地 `fakeWidget` 允许新增 `createViewModel: () => toDisposable(() => { }),`。本段仅对 §3.4 与 §5 第 2 条的旧 case 字节保护放行这一个成员；原标题/header/四条断言/timing/gate/show/ref/render wrapper/finally 及其余字节、其他 cases/helpers、54+18 和生产合同保持。VM 由现有 Panel holder/local 唯一拥有；原 prep2 失败保留，修复结果另取实际证据。具体边界见 [旧 render stub 窄修订](sources-panel-stale-render-stub-amendment.md)。

上述唯一段落现已同步到现行生命周期方案，避免两份 accepted 合同对同一旧 case 的保护发生歧义。不能把 docs accepted 当作源码或执行授权，不能回写原失败、把静态推断写成 caught TypeError 或声称旧 case 已通过。

## 4. 后续授权与最小验证建议

1. docs-only draft 已获 root 独立核验、原 Astra [规则 16](../../docs/DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿)与 root 采纳；本次只完成独立 accepted 及 §3 精确合同同步，交固定 SHA / 全路径身份再由 root 核验。
2. accepted 后仍须 root **另发仅上述 stub 一行的源码授权**；作者保持源码其余字节，交不可变 SHA，由原 Astra 窄 peer。当前不修改任何 TS，不运行 Program/checker/lint/compile/transpile/emit/test/UI/engine，不写 out/cache/freeze。
3. 唯一 lane 仅在 root 再明确释放后，绑定新固定输入检查与精确 emit，再实际运行两个**完整官方模块**；源/输出身份、全局空闲/所有权、finally 恢复及原件保留沿用已签边界。不得凭本稿自动预约 emit，不要求全量 compile。旧 case 四条原断言及完成状态、完整模块/hook/pending/missing、新 72 的实际结果分别记录；本次原 142/141/1 保留。
4. **最小充分建议**：不另增 old-c7 单 case 兼容运行。本变更只补本地 fake 的可用成员，不改生产或旧期望；新固定输入下原 case 原断言与完整两模块复验足以判断该修正。既有 old-c7 red/setup 失败原件不覆盖；原 Astra 规则 16 已认可此最小建议，任何额外兼容需求仍由 root 另定固定输入与授权，不能自行运行。
5. 其他 plan / PRD / D1387 / 旧波不升级；真实 UI after 是否仍需由父级按已有 scope 决定。本稿不涉及 lease、local Git notice、通用 editor 或引擎实现。

## 5. 行动与审查入口

复用[现看板](../parallel/active/sources-accept-post-read-authorization.md)与[作者检查点](../progress/sources-accept-post-read-authorization-checkpoint.md#stale-render-stub-amendment-accepted)，不新建日志或复制 baseline 原件。本稿 **accepted，仅文档合同**；正式规则 16 与 root 采纳见 §6，不代替后续源码 peer / 实际验证。§1 中 baseline 正在入库的定位保留 draft 时点叙述，本次不追后续 proof HEAD。


## 6. 规则16与root采纳

正式受审输入是 `1dcd047bc0d7f5568eae496b61c644d98ed85732`（parent `eefce63e1541625baa39a4abd1608fc3cdbb8c5b`、src `d78a48e5feee57fcaf5811c8425859d0a2400af0`）；原 draft 本文件 7822 bytes / SHA-256 `03d884496ea1b5f6b537b0472a658ff5d929e3269204082405ae1d42a5d9b5d5` / Git blob `1b75e6c39942e273fbe7ca288d447bafc98e3436`。root 独核全部七文档、保护与 status200/clean 后，原 **Astra / architecture_audit** 正式规则16结论 **Critical 0 / Important 0 / Minor 1**；root 已采纳唯一 Minor，并明确授权本独立 docs-only accepted。

唯一 Minor 原意：同步现行生命周期合同不能保持可选，以免两份 active accepted 合同歧义。本次把 §3 的可选措辞改为已作出的决定，并在生命周期方案指定位置原样追加所提精确一段；原生命周期其他正文、另两 plan / JSON 和全部源码保护。没有未采纳意见，没有以本次文档签收授权源码或运行。

以下是原 Astra 发给作者的正式规则16结果通知原文；按消息保留，不虚构独立报告或 raw 日志路径：

```text
1dcd047b正式规则16已报root C0/I0/M1，可核验后独立accepted。唯一M1：:48“如root决定同步现行生命周期合同”为可选，建议accepted明确实际决策并应用所提精确唯一例外段（§5后§6前准确），避免active旧plan全case保护与amendment许可无现行说明。技术单行toDisposable/唯一holder/local owner、原4assert/gate/timing/72保护、免额外old-c7兼容run均通过。等root采纳/授权再改，不把此peer当源码或运行授权。
```


## 7. b0核验后的唯一单行源码候选

root已独立接收 `b0e5377996c1a167b5b02d56cbd3699cae423a78` 的exact8docs、parent1d/src d78a、FS/hash、生命周期原draft633B段删除即原20120B、两plan/JSON不变及status200/原LF/hash/clean；之后**另行明确授权**实施本方案 §2 的唯一行。当前候选以b0为严格parent，仅在 `sourcesDiffPanel.test.ts` 的指定旧case本地 `fakeWidget` 增加 `createViewModel: () => toDisposable(() => { }),`；不增import/helper/API，不改其他TS字节。

现行生命周期方案、Accept/共同fixture两plan、dispatch JSON及全部旧证据保持b0原字节；去除TS唯一新增行即精确还原b0测试。三production/Pane.test/其余cases/helpers/新72、原四断言/gate/show/ref/timing/wrapper/finally均不变。root最初插入位置reader使用了错误段落边界，后以draft原段逐字remove纠正并通过；这是父读取器定位的纠正，没有作者源码或合同补改。

方案保持accepted，设计不变；此提交只是最小test-only候选，未称旧case已过或完整Panelgreen。待root核固定SHA/全部路径身份，再交原Astra窄source peer；唯一lane的新固定输入检查/精确emit/完整两模块仍须root另行释放。作者本轮连AST/lint也不运行，只做文档生成/health/diff门禁；不Program/checker/compile/transpile/emit/test/UI/engine，不写out/cache/freeze，不追merge新proof或push。原prep2新72过、完整Pane3/3/0与Panel142/141/1、旧首title败/后三未达继续保留。
