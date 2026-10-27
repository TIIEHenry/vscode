---
title: "Sources Panel：旧异步 render stub 合同的唯一例外"
type: plan
status: draft
phase: M7
updated: 2026-10-27
summary: "prep2新72例全过、完整Panel仍有1旧标题断言失败；仅提议该case fakeWidget补createViewModel可释放替身，旧合同例外待规则16/root签收，未授权源码或运行。"
---

# Sources Panel：旧异步 render stub 合同的唯一例外

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

三生产文件、`conversationDiffReviewPane.test.ts`、其余旧 cases / shared helpers、54 + 18 新例、全部旧证据及 dispatch JSON 继续保护。[Accept 方案](sources-accept-post-read-authorization.md)、[Panel 生命周期方案](sources-panel-diff-view-model-lifetime.md)、[共同预注入修订](sources-panel-fixture-preinjection-amendment.md)本 draft 全文不改。

## 3. 必须先签收的旧 case 保护例外

生命周期方案 §5 第 2 条的“原 cases 与已签 plan 字节保护”和 §3.4 的“全部旧 case / 标题 / header / 断言保持原字节”约束了本次修改，不能以 trivial fixture 为由自行豁免。root 已采纳作者/原 Astra 只读合同提案（C0/I1/M0）的 Important：先明确唯一例外；该预审不是本稿的规则 16。

拟在本稿经规则 16、root 采纳改稿后独立 accepted；如 root 决定同步现行生命周期合同，**仅在该方案 §5 编号列表之后、§6 之前追加以下一段**，其余原正文逐字保护，另两旧 plan 和 JSON 仍全字节保护：

> **旧 stub 合同唯一例外**：仅 `Sources diff panel superseded async render cannot paint an older file diff` 的本地 `fakeWidget` 允许新增 `createViewModel: () => toDisposable(() => { }),`。本段仅对 §3.4 与 §5 第 2 条的旧 case 字节保护放行这一个成员；原标题/header/四条断言/timing/gate/show/ref/render wrapper/finally 及其余字节、其他 cases/helpers、54+18 和生产合同保持。VM 由现有 Panel holder/local 唯一拥有；原 prep2 失败保留，修复结果另取实际证据。具体边界见 [旧 render stub 窄修订](sources-panel-stale-render-stub-amendment.md)。

此段现在只是明确 patch 提议，尚未应用。不能把 docs accepted 当作源码或执行授权，不能回写原失败、把静态推断写成 caught TypeError 或声称旧 case 已通过。

## 4. 后续授权与最小验证建议

1. 当前仅交 docs-only draft 固定 SHA / 全路径身份给 root；由原 Astra 按[规则 16](../../docs/DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿)只读审查，root 核验并采纳实改后，才独立 accepted。当前不自行签收、不应用旧 plan patch。
2. accepted 后仍须 root **另发仅上述 stub 一行的源码授权**；作者保持源码其余字节，交不可变 SHA，由原 Astra 窄 peer。当前不修改任何 TS，不运行 Program/checker/lint/compile/transpile/emit/test/UI/engine，不写 out/cache/freeze。
3. 唯一 lane 仅在 root 再明确释放后，绑定新固定输入检查与精确 emit，再实际运行两个**完整官方模块**；源/输出身份、全局空闲/所有权、finally 恢复及原件保留沿用已签边界。不得凭本稿自动预约 emit，不要求全量 compile。旧 case 四条原断言及完成状态、完整模块/hook/pending/missing、新 72 的实际结果分别记录；本次原 142/141/1 保留。
4. **最小充分建议**：不另增 old-c7 单 case 兼容运行。本变更只补本地 fake 的可用成员，不改生产或旧期望；新固定输入下原 case 原断言与完整两模块复验足以判断该修正。既有 old-c7 red/setup 失败原件不覆盖；若规则 16 发现额外兼容需求，由 root 另定固定输入与授权，不能自行运行。
5. plan / PRD / D1387 / 旧波不升级；真实 UI after 是否仍需由父级按已有 scope 决定。本稿不涉及 lease、local Git notice、通用 editor 或引擎实现。

## 5. 行动与审查入口

复用[现看板](../parallel/active/sources-accept-post-read-authorization.md)与[作者检查点](../progress/sources-accept-post-read-authorization-checkpoint.md#stale-render-stub-amendment-draft)，不新建日志或复制 baseline 原件。本稿 **draft，规则 16 尚未发生**；预审 C0/I1/M0 只支持写此提案，不代替正式方案审查或后续源码 peer / 实际验证。
