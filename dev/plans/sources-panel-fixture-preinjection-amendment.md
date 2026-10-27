---
title: "Sources Panel 方案 §3.4：共同 factory 预注入连接的窄修订"
type: plan
status: implemented
phase: M7
updated: 2026-10-27
summary: "共同factory预注入连接，旧default-false与独立input.dispose按各自实际证据通过；root核新6d一次green后窄scope签收，原设计/review/失败历史保留，fullCompile=false。"
---

# Sources Panel 方案 §3.4：共同 factory 预注入连接的窄修订

> **当前实现验收（2026-10-27）**：共同factory预注入连接，旧default-false与独立input.dispose按各自实际证据通过，root已独立核原始stream/owned/finally并签收本方案为implemented。固定HEAD01c0/source6d/src424397的一次[新验证证据](../progress/sources-stale-render-6d-new-validation-20261027-evidence/INDEX.md)是当前结论；下方原设计、授权、评审与失败叙述保留其历史时点。仅source/真实组件合同，不声称实端Git索引、UI after或fullcompile已验。

以下固定输入/原授权与 §1–§4 保留 **d0 draft 时点历史原文**；仅链接锚点随已采纳标题改名。之后的规则16、采纳与proof身份另见§5，不回写为draft当时已知。

> **固定输入**：Panel 生命周期候选 `44edbd2b5ba562ce6503237069cba0cd763830a4`（parent e949，`src=c478d07f29331d164bf4b80259abee83937cc7c9`），只读其中的 [Panel accepted 方案](sources-panel-diff-view-model-lifetime.md#34-验证先决共同夹具预装连接)；原 plan 18145B / SHA-256 `c41d14021ebc4eb04eae28835d455debb3258019ef3ffdcd1f0c07d4de9b6b4b` 本次不改。
> **本次授权**：root 要求生命周期候选先固定，随后独立交本 docs-only 修订 proposal；本稿仍 draft，原 Astra 规则16、root采纳及独立accepted修订之前不得改共同预注入代码。源码、test、out 均不改，不请求 baseline 接 D HEAD，不追 merge。

## 1. 新事实与证据资格

原 Astra 静态发现：每次 `workbenchInstantiationService` 都创建新的 TestInstantiationService / ServiceCollection，无默认 UA stub、parent 或跨 case DI 缓存。原 helper 先创建真实 SourcesChangesModel、之后才安装 UA 的次序同时影响 resolveModels=true 与默认 false；只修 true 不能使旧 false case 进入业务。root 保持已签约束，并先授权唯一 lane 取得独立实际资格。

baseline 的 `vscode-sources-accept-default-false-probe-20261027-run1` 只临时 emit **精确 c7 原 Pane 测试一个 JS**，运行原 `in-flight Accept does not ApplyHunks after clearInput bumps write generation`。输入原 TS 为 8391 bytes / SHA-256 `6225a728f46004f251a616308f879ba9a0dd8fcbac9307d59d5ba32d62e426c4`，Git blob `9a1d8792656f643fb2a1746d174f074de3ea7173`；三个旧生产输出用已核 run1 来源与 native bytes 连续性判定，没有借本候选生产替旧生产。

实际 reporter 是 **1 test / 0 passes / 1 setup failure**：`Cannot read properties of undefined (reading 'onDidChangeConnection')`。编译后 JS 栈为 SourcesChangesModel `:59` → stubSessionAndChangesModel `:88` → createInstantiationService `:114` → 原 case `:159`。没有到 read-start / clearInput / Apply 或原断言，**业务 red=0，不计入新54或生命周期18**。root 已独立读原 reporter/栈、input=Git c7 和单 native FS bytes/mode/mtime=seal；D 另只读同一原 reporter 与 validation-report，未运行或恢复输出。

baseline 已在 merge 实际创建正式入口 `dev/progress/sources-accept-default-false-probe-20261027-evidence/INDEX.md`，同名目录 28 份原件/driver/分类共 12,168,523 bytes，proof commit 待 baseline 通报；D 未复制证据或追 HEAD，当前用精确仓内路径登记，合入后统一补链接。原临时来源为 `/tmp/vscode-sources-accept-default-false-probe-20261027-run1/{original-default-false.mocha.json,validation-report.json}`。原 report 的 finally 在 `2026-10-27T03:04:01.650720Z` 完成：单 JS 原 bytes/mode/mtime 恢复，其余 12553 files / 2946 dirs 元数据、254 + extra 2 输出资格、freeze 4 / cache 3 保持，仅该授权路径 ctime 差；这是既有报告事实，不是 D 新运行。

旧 default-false setup 实测与 run1 新 input.dispose true setup 失败是两个独立身份，不能互相替代，也都不是业务 red。生命周期候选只 true 的修改仍绑定 44edbd2，不倒写为它已修 default false。

## 2. 唯一合同放宽

只提议修订 Panel accepted 方案 §3.4 第一段的 **仅 resolveModels=true 预stub** 限定。其他 owner/refcount、teardown、await guard、生命周期回归与原 Accept 合同不变。当前计划原段落为：

> 在 `conversationDiffReviewPane.test.ts` 的 `createInstantiationService` 内，仅 `resolveModels === true` 分支于调用 `stubSessionAndChangesModel` **之前** stub 当前传入的 `IUniverseAgentConnection`，使真实 ChangesModel 构造时取得完整连接。默认值 false、旧 helper 正文与安装次序、旧 case / 标题 / header / 断言保持原字节。不得把此新路径修正写成原 setup 已经过业务，也不得把准备性修正算作 Panel VM 生产修复。

提议接受后将上述一段唯一替换为：

> 在 `conversationDiffReviewPane.test.ts` 的共同 `createInstantiationService` factory 内，于调用 `stubSessionAndChangesModel` **之前**预先 stub 当前传入的同一个 `IUniverseAgentConnection`，使真实 ChangesModel 构造时取得完整连接；不再只限 resolveModels=true。`resolveModels=false` 默认值及其原 resolver 行为、旧 helper 正文与其内部安装次序、全部旧 case / 标题 / header / 断言保持原字节。只放宽共同 factory 的预注入范围，不移动/改写旧 helper，不改变任何业务期望、patch builder 或生产代码。原 true / false setup 失败分别保留，修正后须另取实际业务结果，不预称业务 green 或 Panel VM 修复。

这对应未来唯一 test-only 实施差异：将 44 候选中的 `if (resolveModels) { stub connection }` 收为 helper 调用前一次共同预stub；仍向旧 helper 传入同一 connection，旧 helper 之后再次安装同值保持原正文。不能为避免已知 setup 失败而只不跑旧 case，也不能为求绿改其 header、patch、释放门或断言。

## 3. 保护与验证

- 当前 docs proposal 不改原 accepted Panel plan 18145B，亦不改 Accept accepted plan 17436B、原调度 JSON、44 全部源码/测试。原 54 调用、生命周期 18 与旧 71 调用身份分别保持。
- 若原 Astra 规则16与root采纳该窄放宽，下一独立 accepted **文档** commit 才应用 §3.4 该单段替换并持久原稿/proposal/审查身份；其余受审合同逐字保护。再另获源码授权后才改共同预stub，不把 docs accepted 当源码授权。
- 之后的 test-only 源码候选与 Panel 生命周期候选统一绑定独立 peer / 唯一 lane 验证；作者仍只做被授权 AST / lint noemit 静态，不 typecheck、compile、transpile、业务运行、窗口或 out 写入。
- 唯一 lane 按父级精确释放分别记录：原 default-false case 是否真正进入业务及最终原断言结果、新独立 input.dispose case 的业务结果、原54矩阵与生命周期18结果。旧 setup 失败不洗掉，不将旧 case 加入54或承诺业务 green；若到业务后另有失败，按真实来源单独处理，不借此授权修 builder。
- out/freeze/cache 当前未释放；不扩大到生产资源策略、generic widget、lease/local Git反馈、PRD/D1387/宽方案，不新增长期日志。

## 4. 行动与规则16

复用[现看板](../parallel/active/sources-accept-post-read-authorization.md)与[作者检查点](../progress/sources-accept-post-read-authorization-checkpoint.md#共同-factory-预注入连接窄修订-proposal)，不新建平行记录。固定本 draft commit 后由 root 核验，再交原 Astra 规则16只读审查，Critical/Important 当轮改稿，独立accepted后才可另发源码授权。

**规则16尚未发生，proposal为draft。** 先前 Panel a04 的 C0/I0/M0 仅针对旧 true 限定，不能自动覆盖本次明确放宽；44 生命周期源码 peer 也不代替此方案审查。本文不称 setup 已修或旧 case 已过。

## 5. d0 规则16与父级采纳

正式受审 proposal 为 `d0c5f685331b4950b4b9c262a6a0c19bb8be7476`（parent `44edbd2b5ba562ce6503237069cba0cd763830a4`、src `c478d07f29331d164bf4b80259abee83937cc7c9`），本文件原稿 7509 bytes / SHA-256 `8d34097cea4dc5a487d4b151bd8924260a91fb4705566bde624423ca45fa0401` / Git blob `a066c461e7dfb92d3d59e04d686e572edc60659f`。受修订的原 accepted Panel plan 为 18145 bytes / SHA-256 `c41d14021ebc4eb04eae28835d455debb3258019ef3ffdcd1f0c07d4de9b6b4b` / Git blob `75f4e71ca02cc4bd03355c38a933e69c678f8d73`；不可变 d0 对象保留该完整旧稿，本文原段落引文也保持。

原 **Astra / architecture_audit** 正式规则16结论 **Critical 0 / Important 0 / Minor 1**；root 已全文/源链独立核验并采纳。唯一 Minor：原 §3.4 标题“仅新真实模型夹具预装连接”与共同 false 预stub 新正文范围不符，改为“共同夹具预装连接”，同步本稿固定输入中的唯一旧锚点。此为导航措辞，不扩大代码合同；本次连同原提议的 §3.4 第一段替换一起应用，其他原 §1–§5 字节保护，无未采纳意见。

以下为作者收到的原 Astra 审查结论消息中的 Strengths / Assessment 摘录，原结论身份与root采纳分别记录，不把源码peer当方案审查：

```text
Strengths：actual旧case setup1/0/1与true独立/业务red0；同一factory前同一UA预stub且helper/false resolver/case/header/assertions保留；docs接受与源码授权/真实业务资格分离。
Assessment：root核后可独立accepted，Minor非阻断。
```

root 已明确授权本独立 accepted docs commit：应用 d0 提议单段、采纳上述 Minor 标题/相关锚点，其他原 §1–§5 合同逐字保护；只签文档，共同pre-stub源码待root核accepted SHA后另行授权。本次所有src/test仍等于独立I1修订 `5f4f2d132f972af871fb4451c82ef2ab6ee30e61` / src `7d43a2a5f2a74f0ef2a28976fe0067748a028cc1`；44正式代码peer C0/I1/M0中的same-ref夹具修订仍待窄peer，不将其标通过。原Accept plan、原JSON、18选择器及原54/旧调用保持，不编译/emit/业务运行或写out。

root 后续已通报独立 default-false 正式 proof `942d0652065d7aafe085d2e54a95c17bcd4f4c1c`；入口仍为 `dev/progress/sources-accept-default-false-probe-20261027-evidence/INDEX.md`。这是对 §1 原“proof commit待baseline通报”的历史身份追加，原setup 1/0/1、业务red0、未计54/18及恢复资格均保持；不倒写为本draft已知，D不复制原件/追merge。

## 6. f5a 核验后的独立源码授权

本节是 §5 独立accepted文档之后的事件，不回写其当时的源码未授权边界。root 已独立核 `f5a74df01faf7a024ac4f69f4448a0da65f3e186` 全9docs hash、parent/src/status200/原status首条，以及§1–§5反向还原唯一段落/标题后逐字相同的保护资格；采纳该accepted后另明确授权最小test-only实施。当前候选仅将 `conversationDiffReviewPane.test.ts` factory旧helper之前的条件预stub收为一次无条件的同一connection stub，不动任何生产、Panel.test、默认false/resolver分支、helper正文/内部次序、旧case/header/断言或patch builder。

5f4同ref修订已获原Astra窄peer C0/I0/M0及父级采纳，44 I1关闭；它不代替共同pre-stub新候选peer或运行资格。本候选作者只做AST/lint/docs静态，固定SHA后root实核、原Astra窄peer，最后才由唯一lane按父级另行释放旧生产两case资格run2。原default-false与true setup失败/业务未达、54/18未新运行及out冻结保持，不将准备性源码修正称为green/implemented。新授权与保护检查见[当前作者检查点](../progress/sources-accept-post-read-authorization-checkpoint.md#共同-factory-预stub-最小源码候选)。

## 7. 固定6d一次实际验收（2026-10-27）

共同factory预注入连接，旧default-false与独立input.dispose按各自实际证据通过。原Astra固定工具peer C0/I0/M1的四处行号镜像由root授权机械改为491，prep2窄peer C0/I0/M0，root核后单次释放并独立验收；[prepared原稿、active四字段映射、consumed与全部raw](../progress/sources-stale-render-6d-new-validation-20261027-evidence/INDEX.md)分列，不复用旧授权。

5目标项目noEmit checker全0（未请求non-target semantic），lint0error/0fatal/1旧637 warning，dry=actual5JS/0map；新54 Accept+18生命周期逐名start/pass/end各1，完整Pane3/3与Panel142/142、meta各1、hooks11/567平衡，pending/missing/unknown/failures0。旧stale四条原断言保固定source字节/顺序，实际whole-case body pass；没有逐assert运行插桩。

[旧双A1纯业务red](../progress/sources-accept-post-read-authorization-old-red-evidence/INDEX.md)、[run3 A4纯业务red与原default-false实际通过](../progress/sources-accept-qualified-old-red-run3-20261027-evidence/INDEX.md)、[原default-false setup探针失败](../progress/sources-accept-default-false-probe-20261027-evidence/INDEX.md)及[8438旧stale首断言败/后三未达](../progress/sources-accept-a4a-new-validation-20261027-evidence/INDEX.md)全部保持原件，不把旧run改绿。

本方案仅在source/真实组件范围implemented；原设计/旧review/失败历史及生命周期633B唯一例外保持。当前out已恢复旧native256，metadata采用新guard54fe37（相对8b5f仅获准五ctime），freeze4/cache3精确，fullCompileOfFinalSourceTree=false。按root采纳的原Astra最小充分边界，不另要求Sources UI after或未改controller suite；不声称实端Git索引、UI after或全src semantic/fullcompile已验。PRD、宽Sources、D/D1387旧签收与旧J/E波不升，overall goal仍active；consumed release不再授权运行。
