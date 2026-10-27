---
title: "Local Git 完成归属：后续组件验证输入只读分析"
type: reference
status: accepted
phase: M7
updated: 2026-10-27
summary: "固定c5候选与46fc恢复native的984节点文本图、旧964不可重放纠正及实际d8e加载事实分记；保原混合输入/63与196静态预期，五target/无第六仅待验假设，无新准备或运行释放。"
---

# Local Git 完成归属：后续组件验证输入只读分析

本页记录本轮只读 Git 对象、固定源码文本/常量及既存原件分析，来源为 D 直接报告与 root 直接采纳为未来输入事实的消息。root 只另授权本页及必要导航/行动层落盘；**没有准备或运行工具、期望 manifest、AST/lint/checker/Program/emit/tests/UI，也没有新 release、运行 raw 或 actual results**。本页不是新验证协议；[accepted plan §3–4](../../../plans/sources-local-git-completion-ownership.md#3-真实组件回归与旧业务-red-判据)合同完整且保持原文，方案继续 accepted/runtime pending。lease 最高优先及独立非作者 after 必需。

## 1. 固定对象与 producer 对应

- 当前候选：`28f90f804d34a634bf1eb582dbfc2457b6015df3`，src `2597bca4abae7eef9ba5fbc561a3b571bf97d968`。ae7d 窄源码 peer C0/I0/M0/root 采纳关闭 a227 唯一源码 I1，仅源码声明合同签收，没有实际 checker 诊断或通过结果；[历史签收](../../sources-accept-post-read-authorization-checkpoint.md#local-git-completion-i1-accepted)。
- plan 指定 pre-localGit：`736171b1abc34e36e4991709240625827b566396`，src `90d6092dbbca80114db7f55a75e137bb1d7bef76`。
- 已接受 Sources 对象 `a4eb1dc3e94b9240e6124ccd37e219801fc1aeb9`、执行父 HEAD `01c0addecff0b3ddd98afc1259c00a9f0ceaa3ba`、sourceRef `6d848eacc578dea0c5c6f39721b00047f9c12469`，三者 src 均 `4243970658ddd668d1f89e0a97d7f41ba94d3300`。原五 target 源码逐份与736完全相同；[原 input manifest](../../sources-stale-render-6d-new-validation-20261027-evidence/prep2/input-manifest.json)、[真实 emit 报告](../../sources-stale-render-6d-new-validation-20261027-evidence/prep2/emit-emitter-report.json)及 [6d 运行与恢复边界](../../sources-stale-render-6d-new-validation-20261027-evidence/INDEX.md)保持原件。

下表路径相对 `src/vs/workbench/contrib/sources/`。它列待后续协议绑定的输入事实，不授予安装、再生成或运行权限；old-red 必须使用与 new-green 相同的28f90新测试，不能换回旧测试求红。

| 精确文件 | old-red sourceRef / blob | new-green sourceRef / blob |
| --- | --- | --- |
| `browser/conversationDiffReviewPane.ts` | 736 / `c55809409e8b6ecffe132f536489c7b594603132` | 28f90 / `d4a0f497691ce903fc169138cdbec6c111035f12` |
| `browser/sourcesDiffPanelView.ts` | 736 / `f200b341ac85ce74796088f1ef205d0d1dacea34` | 28f90 / `ec52d61d903784e422679b53e2f9414a25b37a01` |
| `common/sourcesDiffWriteController.ts` | 736 / `10c6d88446b2a2ce72f81e92e6233d5975d6eff2` | 28f90 / 同一 blob |
| `test/browser/conversationDiffReviewPane.test.ts` | 28f90 / `7e95bb3c162a02511b4fff084b86ff3af2336ad5` | 28f90 / 同一新测试 |
| `test/browser/sourcesDiffPanel.test.ts` | 28f90 / `c6c90e81e2eb4f3175718c29692600c59fe107bb` | 28f90 / 同一新测试 |

原6d实际 emit 五份产物均在旧原件的 `prep2/emit-generated/vs/workbench/contrib/sources/`，路径如下；dry 与 actual emit 当轮逐份 bytes/SHA 相同。这是旧运行 producer 事实，不能当本scope新结果。

| 相对产物路径 | bytes | SHA-256 |
| --- | ---: | --- |
| `browser/conversationDiffReviewPane.js` | 106034 | `13e77495b563723ab39c667b9d7b0dc591e7301de225df0631d31027c3726847` |
| `browser/sourcesDiffPanelView.js` | 105921 | `a5446e8ec66827c82c75e31a3b759f035a7adf61e93bc62041c7d135d79af30b` |
| `common/sourcesDiffWriteController.js` | 27186 | `98b705105bf94df14c87d9c8a9cd7d0ab8e3c2ba1436085db6f287a9105671f8` |
| `test/browser/conversationDiffReviewPane.test.js` | 39356 | `6ebd9cd01fe19ece917086eb58a377ac4232638ed79e96d3d61dcbc284aa4935` |
| `test/browser/sourcesDiffPanel.test.js` | 600370 | `efd24e617a47ddfba08c607cdfd67ce6b27e94376201077fd5e9538edf85330a` |

前三份对应源码已证明与736精确匹配；后两份仅旧测试，没有新增114，不能拿来验证本scope。54fe 是恢复后的旧 native 身份，**不是736三生产＋28f90两新测试这一混合输入的 producer**。原 [binding](../../sources-stale-render-6d-new-validation-20261027-evidence/prep2/binding.mjs)硬绑五输入同为6d、expected HEAD=01c0、源码等 workspace，旧 release 已 consumed；不能原样用于混合输入或把实际合源 HEAD 冒写成28f90。后续每文件 sourceRef/blob、依赖/产物与实际 expected HEAD 的绑定须另审、另释，不改 workspace 源码切 old/new。

## 2. 依赖差异与尚未证明的闭包

6d→736 的全 src 差异只有 `conversation/browser/conversationEditorPane.ts` 与 `conversation/test/browser/conversationSessionWindowReveal.test.ts`；736→28f90 仅两 Sources host 与两新 test。原256 source/native绑定逐份对736核验，只有 Conversation Pane 的 source blob 改变：

| 项 | 固定身份 |
| --- | --- |
| 原6d/compile10 Pane source blob | `8678204094b429fd4280dd528a70e83b9fcf5289` |
| 736/28f90 lease Pane source blob | `98ba56dacc166c24d263112940c7aee0a0363357` |
| 原旧 Pane native | `out/vs/workbench/contrib/conversation/browser/conversationEditorPane.js` |
| 原旧 Pane native SHA-256 | `74b65707aa69404258e9d3b759f93b5808b21ec4a311e1af953132d5c7729629` |

原五 target运行不能给这份lease源码fresh producer credit。原256重绑到736时是 Sources4＋Pane1 的5组 current-source/old-native，另251组未变；Reveal原JS另列、不属256，见[正式合源的source/native说明](../../sources-lease-f33-formal-integration-20261027-evidence/INDEX.md#当前source与54fe旧native身份)。

本轮核了两模块/host直接 imports，但**没有证明运行时实际加载闭包**。后续若闭包不含lease Pane，可明确作为scope外旧native；若包含，必须另立匹配资格，不能暗增第六target或把旧native算新源码产物。构建七文件（compilation/util/tsb index/transpiler/tsconfigUtils/src两tsconfig）及官方 index/renderer/fullJsonStreamReporter 在6d、736、28f90间均精确相同；这仍不替代未来执行环境的包、依赖和实际入口绑定。

## 3. 最小旧业务 red 代表标题

两个 host、clean/unstage两命令各取R1 replace、R2、R3，静态得到以下12个完整标题。它们是源码标题输入事实，**不是实际注册、启动、失败或通过数**；本页不创建期望manifest、不决定运行组数或释放选择器。

```text
Conversation diff review pane Local Git completion ownership R1 clean old failure after replace leaves current notice unchanged
Conversation diff review pane Local Git completion ownership R1 unstage old failure after replace leaves current notice unchanged
Conversation diff review pane Local Git completion ownership R2 clean old success preserves the new owner's public command error
Conversation diff review pane Local Git completion ownership R2 unstage old success preserves the new owner's public command error
Conversation diff review pane Local Git completion ownership R3 clean old success preserves the different URI current collapse
Conversation diff review pane Local Git completion ownership R3 unstage old success preserves the different URI current collapse
Sources diff panel Local Git completion ownership R1 clean old failure after replace leaves current notice unchanged
Sources diff panel Local Git completion ownership R1 unstage old failure after replace leaves current notice unchanged
Sources diff panel Local Git completion ownership R2 clean old success preserves the new owner's public command error
Sources diff panel Local Git completion ownership R2 unstage old success preserves the new owner's public command error
Sources diff panel Local Git completion ownership R3 clean old success preserves the different URI current collapse
Sources diff panel Local Git completion ownership R3 unstage old success preserves the different URI current collapse
```

若取R1完整clear分支，再各host加以下clean/unstage两后缀，共另4项、合计16：`R1 clean old failure after clear leaves current notice unchanged`、`R1 unstage old failure after clear leaves current notice unchanged`，前缀分别仍是上述两host的 `Local Git completion ownership`。local Stage 的失效与当前正控已在完整新套，不冒充R1–R3的clean/unstage collapse代表。

| 组 | 业务红到达条件与预期失败点（固定28f90测试行号） |
| --- | --- |
| R1 | A真实按钮命令pending，B真实load/clear已settle；late-A reject后notice比较失败，Pane:602 / Panel:4623。 |
| R2 | B自己的真实命令已reject并确认sentinel-B，late-A成功后保存B错误的比较失败，Pane:617 / Panel:4638。 |
| R3 | 不同URI的B命令先成功，先确认B真实按钮collapse，再late-A成功后按钮被重新暴露的断言失败，Pane:630 / Panel:4651。 |

fixture/load、DiffEditorWidget/模型URI、按钮可见可用、公共handler started/returned、bounded flush或timeout失败均为资格未达，不能计业务red。固定handler在started前已检查参数数与resource对象；**目标业务断言先败时，后置 `h.assertCalls` 与零engine unary断言未达**，须逐项保留此边界，不能把green后置断言或静态数组当旧red的实际次数/零unary观测。若实际结果推翻静态预期，保原件并退回判断，不改断言求绿。

## 4. 新完整官方模块的静态推导与观测要求

固定新套位于 Pane:286、Panel:4312，各8个test模板；常量循环得到：

| 组 | Pane静态展开 | Panel静态展开 |
| --- | ---: | ---: |
| R1 / R2 / R3 | 4 / 2 / 2 | 4 / 2 / 2 |
| R4/R5 | 3动作×5失效×2结果=30 | 3动作×4失效×2结果=24 |
| P1 | 3×2=6 | 3×2=6 |
| P2反序 / Stage交错 | 4 / 2 | 4 / 2 |
| P3 | 5变化×2结果=10 | 5变化×2结果=10 |
| 本scope静态新增 | 60 | 54 |

| 完整官方模块 | 既有声明 | 新声明 | 声明合计 | 加官方meta1 | hook start/end各自预期 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Conversation Pane | 2 | 60 | 62 | **63** | **251** |
| Sources Panel | 141 | 54 | 195 | **196** | **783** |

旧声明数来自[原逐名输入](../../sources-stale-render-6d-new-validation-20261027-evidence/prep2/expected-fullTitles.json)并与新增段保护关系核验；不是新注册。每业务case有全局setup/teardown及disposable setup/teardown共4hook，官方meta2hook，再加root after-all1，故为 `4×声明数＋3`。官方meta完整标题：

```text
Tests are using suiteSetup and setup correctly assertCleanState - check that registries are clean at the start of test running
```

依据为固定 `test/unit/electron/renderer.js`:323–358、`src/vs/base/test/common/utils.ts`:53–62及原observed-events；原实际Pane3/Panel142和hook11/567只保历史，不是本轮结果。后续完整两个官方模块仍须保actual official JSON/stream与observer原件，逐完整title核start/pass/end各1，failure/pending/missing/unknown0，meta独立通过、hook逐title平衡；testEnd不替代pass，旧72与新114分列，旧stale整例及四原断言保持。静态63/196或114不能替代实际注册/启动/通过。

真实load和DOM：实际DiffEditorWidget及original/modified URI正确，按钮connected/visible/enabled后走真实 `.click()`，公共registry真实handler pending并保固定resource对象；禁止private runGitAction、伪造load/paintChrome或改planner制造入口。

R5须保留current及detached实际DOM；生命周期settle后安装实际style.display/textContent accessor，先证明同值捕获、原setter转发与值恢复，清日志后release，最终覆盖setter零写、notice不变且finally完整恢复descriptor。安装/校准/清理失败均资格未达；setter零不能推出private update调用零或内部collapse写零，R3独证collapse。现有test whole-body通过只能按固定控制流推知断言到达，不能冒称已有逐setter/逐assert独立raw观测。

P2既保反序completion原语义，也保每host两条真实Stage交错：clean pending→实际local Stage开始/完成→Stage及Revert仍可见→原clean resolve/reject反馈有效，命令仅clean、stage且零engine unary。Panel公开Stage路径实际递增 `_stageGeneration`，local完成归属按renderGeneration的固定源码共同核；不私改字段，不把同owner新Stage当旧owner失效。

## 5. 尚需补的输入、规模与恢复边界

现plan不缺行为设计；后续仍须另审/另释：每文件混合source/blob与匹配依赖/产物、实际合源expected HEAD、包/构建/runner绑定、实际闭包、old/new原件资格及恢复基准。旧五target工具的授权、consumed marker、63/196等本页静态计数均不授新执行权限。

对象规模参考是五个唯一JS输出路径、0 standalone map；原仓库createCompile＋ESBuildTranspiler＋streamToPromise与inline map路径可作为既存协议输入，**不是本页批准的emit范围、编译额度或调用次数**。原六阶段约60秒：checker23.6秒、lint2.4秒、dry2.1秒、emit1.7秒、旧完整Pane2.8秒/Panel7.2秒；watchdog45＋5＋5仅历史预算参考，不能保证新增114耗时或自动延长期限。

原恢复集合是五JS原bytes/mode/mtime、其余12549files/2946dirs全metadata、256旧native、freeze4/cache3；owned PID/start全部quiescent/reap后才finally恢复，仅明确授权路径ctime可变。**新恢复基准必须在lease验证结束后由root另定并接受**，不能预设仍直接等54fe，不能用D工位输出metadata冒充唯一lane producer。若后续closure需额外文件，须另审清楚，不暗增第六target。全srcsemantic/fullcompile、真实Git索引/全UI不在当前窄合同；lease独立非作者after仍必需，四Sources implemented、PRD/D/宽Sources/旧波不变。


<a id="static-closure-c5-46fc"></a>

## 6. 固定 c5 / 46fc 的候选静态图与计数纠正（2026-10-27）

本节是 D / `sources_audit` 的只读文本分析；root 只采纳为未来 **candidate static input** 并另授权本节及必要行动层持久化，尚未独核下述节点计数。固定 D clean HEAD 为 `c5a2986a32b44c7f327429ea43f457c00702b425`，src 仍 `2597bca4abae7eef9ba5fbc561a3b571bf97d968`，五份 TS 与28f90相同。native 只读根为 `/home/clarence/Projects/Agents/vscode-WorkTrees/merge`，不是 D 工位的 out；以下 native 身份与原6d的五份 fresh outputs 分开，不给新 candidate producer credit。

### 6.1 精确起点、边集与口头 964 纠正

[static-closure.json](static-closure.json) 是非可执行的静态数据：五入口的 c5 sourceRef/blob/bytes/SHA-256、当时 native bytes/SHA-256、source overlay import 列表、984份 native 的逐文件身份及完整 lexical import 边集（6407条匹配，含不追踪的非相对 JS import）、按入口到关键模块的 BFS parent witnesses、scratch输入身份及单独的 old-L1 observed/manifest-only事实。它不含源码、测试期望 manifest、运行工具或新 runtime 原件。JSON 为 632159B，SHA-256 `e4d09cee81c8d1b2a605884e25551a017adc6c90a25c7d47ab4955f2aeff520c`；独立重放应先核文件身份，再按其规则和每节点 import 元组重建边及计数。

**署名纠正（D / sources_audit）**：初次直接口头报告 native 每根 `621/558/36/948/961`、overlay `622/558/37/954/963`、overlay union **964**；该次 scanner 原代码和边集未保留，当前不能重放，不赋完整性信用。root此前仅采纳静态方向为候选，没有独核或接受964为完整闭包。以下改用已落盘的明确扫描规则及边集，实际文本计数为：

| 起点（相对 `out/vs/workbench/contrib/sources/`） | 全 native 图（含起点） | 五根 c5 TS overlay 图（含起点） |
| --- | ---: | ---: |
| `browser/conversationDiffReviewPane.js` | 643 | 644 |
| `browser/sourcesDiffPanelView.js` | 584 | 584 |
| `common/sourcesDiffWriteController.js` | 36 | 37 |
| `test/browser/conversationDiffReviewPane.test.js` | 971 | 974 |
| `test/browser/sourcesDiffPanel.test.js` | 981 | 983 |
| 去重 union | 982 | **984** |

两图均没有 missing relative `.js` target，也没有 `out/vs/workbench/contrib/conversation/browser/conversationEditorPane.js` 或 `out/vs/workbench/contrib/conversation/browser/conversationEditor.contribution.js`。当时读取的984份 native 的 lstat 字段（type/mode/uid/gid/size/mtimeNs/ctimeNs）逐份与下述46fc guard精确相同；这只绑定该次文本读取，不把984当实际加载数，不证明完整当前 TS、bootstrap 或运行闭包。

五份 source 路径均精确相对 `src/vs/workbench/contrib/sources/`；对应 native 为同路径去 `src/`、加 `out/`、末尾 `.ts` 换 `.js`（其余字符不改）：

| 五个精确 source 起点 | source bytes / c5 Git blob | source SHA-256 | native bytes / SHA-256 |
| --- | --- | --- | --- |
| `browser/conversationDiffReviewPane.ts` | 34747 / `d4a0f497691ce903fc169138cdbec6c111035f12` | `c0444b934541d3d698ab4ae0843004982239007cbc59493a86f58afdc76609a4` | 104038 / `79b5c7f0bededd758837b2cd138ae8065b82148ce76dcd3cad8911b09832d528` |
| `browser/sourcesDiffPanelView.ts` | 34444 / `ec52d61d903784e422679b53e2f9414a25b37a01` | `cd8fd7aca2732b4f0186d41f2c76e15decef20658f07084cbd2fed746555a4b8` | 98207 / `437050db9832f549a4db2d738c1763f976afac8b45438bffac885887543100e0` |
| `common/sourcesDiffWriteController.ts` | 10800 / `10c6d88446b2a2ce72f81e92e6233d5975d6eff2` | `e5b3e580ac5f563656b37a0a73b074f0f614dd955096c07e9a507ece9884d902` | 27186 / `98b705105bf94df14c87d9c8a9cd7d0ab8e3c2ba1436085db6f287a9105671f8` |
| `test/browser/conversationDiffReviewPane.test.ts` | 36410 / `7e95bb3c162a02511b4fff084b86ff3af2336ad5` | `2202ac65c0e8189d8ac404c696ebe5c59558ef443b1072fb4c154236b0287e07` | 24579 / `43744061622832077f62be39ff4cfb5a6e78681aad264e74f6bf0fd4ae9fe577` |
| `test/browser/sourcesDiffPanel.test.ts` | 211429 / `c6c90e81e2eb4f3175718c29692600c59fe107bb` | `e8c86c58a452ad9c4dd6efbaa02208357bc72c91844e666c16b266e7c1f8ed7e` | 500052 / `a1daf2f12181a2e5c77295867340995323bb5e48606ec141682081fd0b8dafc9` |

JSON 的 `nativeEmbeddedSingleSource` 另记录原 inline-map 内嵌源身份：四份 host/test 都不等于 c5 source，只有 controller 相等。该比较不授予 fresh emit 或 producer 资格，也不把旧native内嵌源换称当前源码。

### 6.2 可独立重放的文本规则与限制

以下为 JSON 中 `scanner.staticRegex` 的原样 Python 正则；只读 UTF-8 文本，不调用 AST、Program、checker、编译器或 JavaScript：

```text
(?:^|\n)\s*(?P<kind>import|export)\s+(?:(?P<bindings>[\w$*{},\s]+?)\s+from\s*)?(?P<quote>['"])(?P<specifier>[^'"]+)(?P=quote)
```

- 逐原文匹配 `import` / `export` 的字面 specifier，并记录 `kind`、specifier及关键字所在1-based行号；**不剥离注释/字符串**，不宣称具备语法解析器精度。native 节点 import 元组列固定为 `[line, kind, specifier]`；完整模式及列定义也在 JSON。
- 仅当 specifier 以 `.` 开始且以 `.js` 精确结束，取 `posixpath.normpath(posixpath.join(posixpath.dirname(nativePath), specifier))` 为相邻 native 路径；相对路径以每个 `out/...js` 文件为基准。没有扩展名补猜、`.ts`/`.d.ts`转换、目录 `index` 回退、query/fragment剥离、alias/package/条件导出解析或symlink canonicalization。裸包、`.css`及其他非相对JS匹配仍保在边数据中，不入追踪图。
- 对五入口分别 BFS，包含起点、按规范化路径去重；每份实际 native 的静态列表形成全 native 图。另做一次 overlay：**只替换全部五根**的 import 列表为固定 c5 TS 文本列表，余下邻接关系仍取当时 native JS；不是全仓当前 TS 图，也不是生产 emit 图。
- TS overlay 不做类型擦除，所有匹配均保留，含 `import type` 和 `{ type ... }`。JSON标注 `declarationTypeOnly` / `containsInlineTypeBinding`，例如 Pane host 的 `sourcesDiffRefHelpers.js` declaration-type edge、两test的 `universeAgentTypes.js` type edge。它们是模块级静态边，不能据此声称运行时会加载这些模块。替换根列表也不证明未来编译器生成边与现有native根列表完全相同；两张图及各根身份必须分开核。
- 对984份 native 及五份 c5 TS 原文再扫以下 **literal-first-argument** deferred `import` / `require` 模式，结果均0条；只记录、不递归追踪。此结果不覆盖 computed/template/variable import、任意封装loader或unsupported语法，也不扫描未进上述图的其他文件：

```text
\b(?P<kind>import|require)\s*\(\s*(?P<quote>['"])(?P<specifier>[^'"]+)(?P=quote)
```

模块注册表、DI构造、Editor registry、命令副作用、runner/bootstrap及其加载边、外部包、运行时条件和函数调用不由上述图判定。当前 source roots 与旧native依赖混合，不能推导依赖对未来 old/new 混合产物的完整兼容性。**无到 lease Pane 的该类静态路径，仅支持保持五target为候选假设；实际 loaded 及构造/调用仍待单独观测。**

### 6.3 固定源码的构造/夹具/入口选择边界

以下行号均固定 c5 Git 对象；可读源码链接只作导航，其固定身份以 JSON 的 roots / `sourceEvidenceIdentities` 为准：

- [Sources Pane host](../../../../src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts):97 是 `ConversationDiffReviewPane extends EditorPane`，constructor131–155；[Pane test](../../../../src/vs/workbench/contrib/sources/test/browser/conversationDiffReviewPane.test.ts):521 构造该 Sources Pane，522 create、524 setInput、527–532核真实 DiffEditorWidget及模型。它没有继承 lease `ConversationEditorPane`。
- [Panel host](../../../../src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts):119 是 `SourcesDiffPanelView extends ViewPane`，constructor153起；[Panel test](../../../../src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts):4541构造 `SourcesDiffPanelService`、4543构造 Panel、4544 render、4547 public `service.show`。controller是独立 source facts/planner，不构造UI Pane。这些均为源码调用路径，尚非本scope运行到达证据。
- [sourcesConversationOpenHarness](../../../../src/vs/workbench/contrib/sources/test/browser/sourcesConversationOpenHarness.ts):25 创建的是 `ConversationChatInput`；30–32的mock chat root `openEditor`会抛错，37–40的sideGroup只调用传入回调。Panel test三处2576–2582、2640–2647、2961–2967回调仅捕获/持有 `ConversationDiffReviewInput` 并返回 `undefined`；2659–2669的普通editor分支至多构造 `DiffEditorInput`。此夹具不构造 lease Pane。JSON另保从Panel test到该harness、`conversation/common/conversationChatInput.js`等模块的parent witnesses；模块可达不等于构造到达。
- [官方 renderer](../../../../test/unit/electron/renderer.js):187–196逐 `loadFn(file)` 载入选择的模块；201–209在 `opts.run` 有值时，仅把指定文件列表去 `src/` 前缀和 `.js/.ts` 后缀后交 `loadModules`。这是测试入口选择边界，不能推出renderer/bootstrap只加载这些脚本或没有注册表带来的额外模块。

### 6.4 d8e actual loaded 与恢复证据单列

以下原件仍在 `/tmp/vscode-conversation-visible-lease-d8e-validation-20261027-prep1/`，本轮逐份只读核 bytes/SHA；**没有把原件复制入Git或宣称已经出版接入**。来源为root明确给出的accepted scratch证据及root直接恢复核验消息；本页只是身份/事实引用。scratch当轮HEAD `b7dd43f1a523673bf5bdf65ae7950fe0c622adf3`，src `62996b35d6e417c0b46a1f7e79b632414008b5be`，sourceRef `d8e6f1c1a546bab726d17b5b7cda0c6ba319b3d3`，与D候选c5/src2597分开。

| `/tmp` 原件 | bytes | SHA-256 |
| --- | ---: | --- |
| `guard-after-restore.json` | 4212816 | `46fc959b355c9e922a7cb7e9a74919956c5647a595ad88347a083449d8cfb51e` |
| `validation-report.json` | 140258 | `55922b17101c035ac376b02ff6e29e647e2348af553cef3cb4134273bd2cbddd` |
| `old-L1.loaded-assets.json` | 28688722 | `328127b6b141671024b066ad809c979c99a3ce93936f73cbb2f9094dc21cc3e7` |
| `old-L1.native-provenance.json` | 30310933 | `8284fff2b3bc78b0d26528cd0b29628aea763f6ba37d213b91b71d1c396603e2` |

`old-L1.native-provenance.json` 的 qualification=true、1130 observed assets、observerErrors/problems均0；lease Pane与contribution确为observed。Pane当时42101B/SHA-256 `74b65707aa69404258e9d3b759f93b5808b21ec4a311e1af953132d5c7729629`，runtime source与disk bytes相同，current source blob `98ba56dacc166c24d263112940c7aee0a0363357`、embedded/producer旧blob `8678204094b429fd4280dd528a70e83b9fcf5289`，`currentSourceEmittedToNative=false`。compile10只保历史归属，不把当前lease源码称为该旧native的producer。

同一份actual old-L1证据里，**五个Sources起点及sourcesConversationOpenHarness均只有manifest，未observed**。固定 c5 和 d8e [Reveal test](../../../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts):26–27直接导入 `conversationEditor.contribution.js` 和 `ConversationEditorPane`，解释这是不同测试入口；不能把其Pane加载事实转成Sources actual loaded。scriptParsed/observed不证明constructor/createEditor/setInput或lease业务路径到达；该old-L1未达qualified business red，不能证明真实Pane打开成功。

root直接独核恢复事实为：live15500 metadata与 `guard-after-restore.json` 精确相同、native256＋额外Reveal/freeze4/cache3保持；仅Reveal实际emit/restore、仅其ctime例外，旧Pane bytes/mode/mtime/ctime不变，**没有emit Pane或运行新完整套**。本轮984份静态native metadata匹配46fc是较窄的补核，不替代上述root的全量恢复核验，也不把/tmp原件变成Git已接入证据。

### 6.5 后续资格仍未释放

原静态Pane62business＋meta1=63/hook251、Panel195business＋meta1=196/hook783、114新增（60/54）预期保持，均不是实际注册/通过数。**五target与无第六target仍是假设**：未来仅在另行获准的既定完整Sources运行内，按两个官方模块分别保实际script URL/hash、runtime-source与sealed disk对应，并明确五起点及lease Pane/contribution是否observed；若出现后两者，须分清只解析与实际构造/打开/lease调用，不凭加载即推源码覆盖，也不暗增第六target。若实际路径触及scope外行为，先另审依赖及资格，不在本轮准备新工具或产物。

未来runtime授权时还须由root**重新固定并接受当时恢复身份**；46fc只记录本次已恢复检查点，54fe也不自动成为未来基准。plan保持accepted/runtime pending，源码/混合producer/完整组件资格/独立非作者after合同均不变；未释新准备、merge、compile/emit/tests/UI或运行。
