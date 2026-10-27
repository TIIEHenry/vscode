---
title: "Sources Accept 读后授权：方案作者检查点"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "b2补4成54经父核/原Astra窄peer C0/I0/M0、原M1关闭；run1双主业务红与阳性/夹具未达另立Panel生命周期draft；旧阶段与四版status/原JSON不改。"
---

# Sources Accept 读后授权：方案作者检查点

[独立方案](../plans/sources-accept-post-read-authorization.md) · [分工看板](../parallel/active/sources-accept-post-read-authorization.md)

## draft 原始边界与证据等级

父级选择仅处理两宿主 Accept 的读后写前当前授权，D 在固定 `c7fefd780bd9720f3889e310d4706210189a3fc7` / `src=a2c34649ee88df907c03b70c9ec3235cb1b4a9d9` 上写 draft。方案、索引、行动记录是本轮全部改动；没有源码/测试改动，没有业务运行、编译、转译、窗口或 out/cache/freeze 写入。该 draft 提交时本 scope 的可执行 red、green、源码 peer 与规则 16 尚未发生，静态链不冒充运行证据；之后只读方案审查与本次 accepted 改稿见下节，不回写为 draft 时已通过。

原 J/E R3 已局部签收，D1387 closed 与两旧窄方案 implemented 保持；本稿不重开旧波，也不提升 PRD/宽 Sources 方案。catalog-ready 后缺 lease 恢复与本地 Git 迟到完成的 notice 归属仅作后续独立候选；不混进当前实施范围或另建长期 SSOT。

## 工位同步与空间事故的来源

以下为当轮工具回传/父级通报的摘要，**不是新造的原始日志**：

- 父级通报：B 的一次 `ff-only` 因 ENOSPC 失败，HEAD 未前进但 checkout 部分写入。D 当时未执行 ff，并立即停止切换；后续审计用精确 `git show c7fefd…:path` / `git grep c7fefd…` 只读 Git 对象。D 不恢复、清理、重试或改写 B 的工作树。B 的原始错误输出不在本作者持有范围，本文件不伪造 raw 失败日志。
- 随后父级通报 `/home` 外部空间恢复，父级测得 available `6108917760` bytes，停止 CLI 搬移。**恢复原因不明**；本稿不推断具体释放者、目录或操作。
- 父级重新授权 D 仅一次到精确 c7 的 ff。D 执行前实测 `statvfs('/home')` available `6083153920` bytes；HEAD 为 `536cf323cb49ca54b5cdb35b44670d207d588f2e`，`git status --porcelain=v1` 为空。
- D 唯一一次 `git merge --ff-only c7fefd780bd9720f3889e310d4706210189a3fc7` 实际 exit 0，输出 Fast-forward。后验 HEAD 精确为 c7；HEAD:src 精确为 a2c；porcelain 仍空。没有 checkout/merge 重试、reset/restore/clean/stash、push 或主工位 ff 重试，没有为同步写 out/编译产物。

父级另行实测的[调度检查点原字节 JSON](sources-accept-post-read-authorization-dispatch-checkpoint.json)已从 `/tmp/vscode-post-r3-dispatch-checkpoint-20261027.json` 持久化：2859 bytes，SHA-256 `fbf75cdbb5d197a2863dd654afe71a7ce71d78fb62668787514d3c98fa0ce028`。其中 main/merge/B/D 的 HEAD、状态数、hash 和空间是 `capturedAt=2026-10-27T01:33:26.643373+00:00` 的历史快照，D 当时有 7 份文档 WIP；`implementationAuthorized=false`、runtimeRedRun=false 与 output freeze 均原样保留，不回写成后来的状态。这份摘要不冒充 B 的原始 stderr。

## status 原首条逐字保留

`dev/progress/status.md` 原为 200 行。为在同一行数内更新当前方案阶段，本轮仅替换 Current Session 第一条；原条目（含当时全部链接）逐字保留如下，其余原状态行保留。来源是固定 c7 的同路径，不修改原签收证据。

原条目 UTF-8 bytes（含末尾换行）SHA-256：`0b58956d5b0799a6e1304d10cb23fd7924d02b74be951443525f14376182ea04`。

```markdown
- **R3 J/E局部签收（2026-10-27）**：Astra38ded真三路6d533/730路径、D536cf真三路f310/790路径保留，94原件镜像精确；J67快照/510断言0败（15UI+2历史输入+1隔离，真实按钮+四Move），E75快照/8执行行通过、canonical BOUNDARY，最终cached3/双Pane各timeline3无假Allowed、unary/Chat write增量0，父/Astra§30接受。D1387 closed、两窄plan implemented、§25修复实测关闭；§24缺lease候选未复现/未修、absence、焦点BODY Minor/globalCANCELLED及reasoning/Accept旧红保留。旧622原件/准确来源分类与新封存保持；source7ffe/srca2c、252compile10+2fresh/fullFinalCompile=false，254/12554metadata及三cache不变，out仍冻结。仅局部wave文档结束，PRD/旧D1356/57/59/宽Sources不升，overall active。[原件/边界](default-editor-contract-audit-2026-10-26-evidence/r3-actual-after.md) · [最终集成/门禁](default-editor-contract-audit-2026-10-26-evidence/je-formal-integration-verification.md)。
```

原链接仍指向 [R3 原件与边界](default-editor-contract-audit-2026-10-26-evidence/r3-actual-after.md) 与 [最终集成/门禁](default-editor-contract-audit-2026-10-26-evidence/je-formal-integration-verification.md)。以上旧条目是历史原文，不能用它证明本 scope 已实施。

## draft 交接门

本轮提交仅为规则 16 输入。父级先抽核不可变 draft commit 的全部路径、旧条目保留与源码树，再交 Astra 只读评审；Critical / Important 改稿、独立 accepted 方案 commit 之前不实施。baseline 是后续唯一源码 checker / emit / Electron 运行 lane；D 不启动第二验证车道。文档门禁结果在交接消息按实际 exit 回报，不预写通过。

## draft 文档门禁实测

- `scripts/generate-docs-status.py` 实际 exit 0，只生成新方案索引的 `draft` 状态；随后 `--check` exit 0。
- 首次对 `scripts/check-docs-health.py` 使用不支持的 `--json`，实际 exit 2，仅参数解析报错，未执行健康检查。改用该脚本现有 `--format json` 后实际 exit 0：0 errors / 46 links warnings；新 scope 路径没有 warning，不把前次参数失败改写成通过。
- `git diff --check` exit 0。程序逐字核对旧 status 第一条（含末尾换行）已在上方原文块，SHA 相同；除 frontmatter summary 与该首条外，其余 status 行与固定 c7 原文完全相同，总行数仍为 200。
- 本轮没有业务 red / green、source checker、emit 或产品运行。以上仅为 draft 文档检查，不代表方案已通过规则 16。

## 规则 16 只读审查与父级采纳

审查输入是独立 draft commit `4b0d3d62e65e54e71d3b1748f100fac7ca5f6ce3`，plan blob SHA-256 `82b9e0d1f2a64e5f8259f7e329fb9eae2d91844c6055451500dc30ad0b334726`。root 已逐项核验该 8 路径、parent/src/clean、status 200 行、原首条与父级 JSON 的原字节，随后交原 Astra 只读审查。以下是原 reviewer 消息中的结论摘录，行号属于该 draft；不是新增 R3 review，也不是运行结果。

**Strengths 原文**：

> L18–32准确区分静态链与运行red；L47–60遵守已拍板『写前当前授权』、ABA允许与跨engine边界；L74–80 fresh planner+捕获sessionId相等+fresh canWriteAccept+最终helper门形成真实预发送检查，没有local fallback或重定向旧patch；L86/L104明确已发写不假取消/补偿；L92–106真双宿主deferred read、合法patch阳性、逐宿主计数避免fake0。

**Critical 0 / Important 0 / Minor 2。** 两条 Minor 均被 root 核验采纳并本轮实改：

| 项 | 原建议与父级采纳理由 | 本轮落点 |
| --- | --- | --- |
| M1 | 原 input.dispose() 而 Pane 未 dispose 且 this.input 仍为同对象，是独立于 Pane.dispose 的存活负例；旧引用相等不能证明 input 有效。父级要求 A7 的 UI 写回复用同一存活谓词，覆盖已发写后单独销毁 input。 | 方案 §4.1 / §4.3 / A4 / A7 明文要求；预发送零 Apply、已发写只限制失效宿主 UI，不假取消或补偿写。 |
| M2 | catalog Session/List 失败对应 readiness unavailable；Git Changes 读取失败对应 engine-leftover(reason read-failed)。父级要求 A5/A6 分别构造与恢复，并保持另一门开放，避免一颗布尔值伪装两类覆盖。 | 方案 §3 / A5 / A6 明确两种状态与各自 fresh facts 负控/恢复正控；继续当前授权，不加事件 epoch。 |

**Assessment 原文**：

> C0/I0，可由root核验后按既定流程accepted；两Minor建议当轮顺手明确，不能把此静态通过当产品red/green或release out授权。lease与local Git反馈保持后续独立scope。

A4 的 renderGeneration 范围也经 reviewer 与 root 独立实读：Panel 仅在真实 ref/show/clear 的模型生命周期更新该代次，普通 active-session / connection / Changes / layout / 配置刷新不改代次；同 ref show 会重建模型，取消该旧未发 Accept 属宿主更替。root 据此确认不用为 session/连接 churn 新建 epoch 或 public API。

本轮全部采纳，无 Critical / Important 遗留或未采纳项。父级只授权实改 draft 并提交独立 accepted 方案；未授权源码实施。frontmatter / 生成列 / 看板与 status 同步为方案已 accepted，原 draft 和上述审查身份保持，不将 accepted 等同 implemented。可执行 red/green、正式源码 peer 与 out 释放均仍未发生。

## draft status 首条逐字保留

本次将当前 status 首条从 draft 阶段更新为 accepted 阶段，总行数仍 200；下面逐字保存 `4b0d3d62e65e54e71d3b1748f100fac7ca5f6ce3` 的原首条，含末尾换行 SHA-256 `28583bd6827951c77672129d8995864c26110c735d253205973fadd92fcc7e39`。更早 c7 的 R3 首条原文块与 hash 保持不变，其余 status 正文不动。

```markdown
- **Sources Accept 读后写前授权方案（2026-10-27）**：固定c7fefd/srca2c仅写[独立draft](../plans/sources-accept-post-read-authorization.md)，两真实宿主复核fresh active session与现有写门、捕获读目标不重定向；s1→s2→s1按当前门允许，不加epoch。未实施/运行，out冻结、baseline唯一lane，父核后交Astra规则16；旧R3局部签收首条[逐字保留与同步边界](sources-accept-post-read-authorization-checkpoint.md)，D1387/两旧plan/PRD结论不变，lease/local notice后续候选。
```

## 实施候选作者静态检查

父级独立核验 accepted commit `5c0916b71070c5f75742fcbd831cd8c31be0bd34`（plan SHA-256 `5d5c2a72fcb9d555b15d0442d0c7d47ae9238998cea2eb25b4b7917af8362e61`）后，明确授权 D 在该分支实施本 scope。方案正文与其 accepted 身份本次不改；这是源码候选交接，不标 implemented，不复用旧 R3 UI 结果背书。父级先前 JSON 的 `implementationAuthorized=false` 仍是其 capturedAt 的历史事实，原字节不变，不能据此倒写本次授权。

生产仅修改 `conversationDiffReviewPane.ts` / `sourcesDiffPanelView.ts` 的 `runAccept` 与所需既有消息 import：两宿主读后以 fresh facts 重跑原 planner、核 write session 等于捕获 read session、fresh canWriteAccept；最终 write helper 仍按当刻门复核，中间没有新 await。Pane 原 input 自身 dispose、Panel ref/render 代次变化纳入同一存活谓词，并共用于 read 后、write 响应及 catch 的 UI 保护。没有新 shared controller / 导出，没有 lease / local Git completion / patch builder 改动。

新测试实例化真实宿主、真实内存文本模型与 resolver refs；每例独立 mount / 请求计数，通过现有真实 runAccept → deferred FileDiff → ApplyHunks 链。显式 read-start Promise 配 operation 的提前完成拒绝，不用无限 microtask 轮询；合法 `@@ -1,2 +1,2 @@` patch 和精确完整 read / Apply session、argv、patch bytes 是阳性断言。13 类当前事实分别覆盖两宿主，包括 raw hook 仍在但 snapshot capability=UNSUPPORTED 与 hook 缺失的独立 case；catalog Session/List readiness 与 Git Changes read-failed 的负控/恢复也各自独立。

**源码静态计数共 50 个新 case，均未运行**：`sourcesDiffPanel.test.ts` 内 26 个当前事实（13×2）+ 8 个读中宿主失效（4×2）+ 15 个发写后宿主失效/三结果 = 49；`conversationDiffReviewPane.test.ts` 另 1 个 input.dispose 而 Pane 与同引用仍活的独立负例。两测试只使用精确 c7 已有生产导出，旧生产可加载新 case；没有仅新实现才有的测试依赖。

| 交给唯一 lane 的精确 grep | 新 case 静态数量 / 用途 |
| --- | --- |
| `Accept post-read authorization (Pane|Panel) A1 active session changes to s2 before write$` | 2；优先旧 c7 两宿主主业务 red，严格期望零 Apply，静态预测旧源码仍写旧 s1，不称已复现。 |
| `Accept post-read authorization (Pane|Panel) A[23] ` | 4；同 session 合法 patch 真到 Apply 与 s1→s2→s1 当前授权阳性。 |
| `Accept post-read authorization input\.dispose with live Pane and identical input sends no ApplyHunks$` | 1；独立 input 销毁、Pane 存活且同引用的读后零写。 |
| `Accept post-read authorization` | 50；修复后完整新矩阵；旧生产其余 red/夹具失败与主 red 分开记录。 |

作者实际静态检查：

- 四个改动 TS 用 TypeScript `createSourceFile` 解析，parseDiagnostics 全部 0；没有创建 Program、semantic/typecheck、transpile 或 emit。
- 四 TS `eslint --no-cache` 实际 exit 0，0 errors / 1 既有 warning；唯一 warning 为 `sourcesDiffPanel.test.ts:632` 的既有 `in` operator，新改动未触碰该行。未为求绿改旧断言。
- AST 与精确 c7 Git 对象逐个比较旧 `test(...)` 调用（包括模板标题）：Pane 1、Panel 70，全部调用源码字节相同；两份旧 `acceptCursorUnifiedDiff` 声明字节也相同。Pane 旧 helper 仅增加默认关闭的真实模型选项，旧 case 的默认行为保持。
- `git diff --check` 已实际 exit 0。以上是作者静态检查，不含 source project checker、编译、业务测试、Electron / 真或假窗口、Git 索引实端验收。源码独立 peer、旧 c7 red / 新 green 与直接相关完整 suites 均待父核验后交 Astra / baseline 唯一 lane；out/freeze/cache 不写、不释放。

## accepted status 首条逐字保留

本次更新源码候选进度前，accepted 方案 commit 的原 status 首条逐字保留如下，含末尾换行 SHA-256 `53b417f9b4f95c19cf11d6bd120ee9687bb3e4115f5198a09ba28674b39182c7`；早先 c7 R3 与 draft 两版原文块/hash 保持。除 summary 与当前首条外，其余 status 行原样不动，总行数仍 200。

```markdown
- **Sources Accept 读后写前授权方案签收（2026-10-27）**：原draft4b0d3d经父逐路径核验与Astra规则16 C0/I0/M2，input独立销毁/统一UI存活门、catalog Session/List与Git Changes read-failed分控两Minor已实改，[方案accepted](../plans/sources-accept-post-read-authorization.md)；只签方案，未实施/运行，srca2c/out冻结、baseline唯一lane。旧R3/draft首条均[逐字保留](sources-accept-post-read-authorization-checkpoint.md)，D1387/旧plan/PRD保持，lease/local notice后续候选。
```

## 源码 peer 后补齐 A7

父级已独立核验源码候选 `ab43d8617d6e5afa7ca18812395f8f39ab9aa132` 的全部 11 路径、hash、accepted plan、status 200 行与旧证据后，交原独立 reviewer **Astra / architecture_audit** 正式源码 peer。父级转述其结论为 **Critical 0 / Important 0 / Minor 1**：源码边界可接受，唯一 Minor 是现有 A7 静态矩阵仅覆盖已发写后 owner 失效，缺少方案明确要求的「Apply 已发后仅 active session 变化，原 owner 仍有效」。root 独立核验该缺口并采纳，本轮只授权补两宿主 accepted / failed 各一例。这里持久化原 reviewer 身份、C0/I0/M1 与父级采纳，不新建 R3 报告，也不把该旧候选的 peer 写成本次增量已审。

本轮只修改 `sourcesDiffPanel.test.ts` 的既有新测试 helper 与新增用例，以及必要文档。**两生产 TS、独立 Pane 测试、accepted 方案与原调度 JSON 均与 ab43 原字节相同**；旧 50 新 case 的已有 `test(...)` 调用、c7 的 71 个旧调用与旧 patch fixture 保持字节不变。原有章节中的 50 及「peer 待」保留为 ab43 作者交接时的事实，本节记录后续状态。

四个新增用例各自挂载真实宿主并 defer Apply：先等待 read 启动、释放合法 FileDiff、再确认原 `session-1` 的完整 Apply 请求已经发出；之后仅将 active 改为 `session-2` 并发正常 session / connection / Changes 通知，不换 input / ref / 生命周期代次。直接读取真实 owner identity 和实际代次，通知后与完成后均用引用/标量断言保持；原 input 也仍未 dispose。每例最后严格核对原 read 1、原 s1 Apply 1、local command 0，没有重放、补偿或本地 fallback。通过既有 notice 方法置入可见哨兵，验证 accepted 清空并隐藏提示、刷新 1 次；failed 保留引擎原错误 `late ApplyHunks failure`，错误态可见、刷新 0 次。active 变化不将已发送的写假装取消。

| 当前交给唯一 lane 的精确 grep | 新 case 静态数量 / 用途 |
| --- | --- |
| `Accept post-read authorization (Pane|Panel) A7 sent write then active session changes preserves (accepted|failed) response$` | 4；本轮增量，已发原 s1 写后 active 独变，仍有效原 owner 的两种响应。 |
| `Accept post-read authorization (Pane|Panel) A1 active session changes to s2 before write$` | 2；原主 red selector 不变。 |
| `Accept post-read authorization (Pane|Panel) A[23] ` | 4；同 session / ABA 阳性 selector 不变。 |
| `Accept post-read authorization input\.dispose with live Pane and identical input sends no ApplyHunks$` | 1；独立 input.dispose selector 不变。 |
| `Accept post-read authorization` | **54**；双宿主文件 53 + 独立 Pane 文件 1，原 50 + 本轮 4，均不称作者已运行。 |

本轮作者只做 TypeScript AST parse（不建 Program、不做 semantic / transpile / emit）、无 cache ESLint、文档及 diff 检查；实际结果在下节据工具回传补记。没有编译、typecheck、业务/Electron 测试、真或假窗口、out/cache/freeze 写入、push 或跟随 merge/main。baseline 当前旧 red 仍绑定不可变 c7 生产与 ab43 两测试；本次测试增量不改变该旧 red 输入，也不代表 baseline 已完成。源码增量仍待父级核验后再请原 Astra 窄 peer；plan 继续 accepted，不宣称 implemented / red / green / 产品验收。

### A7 补例作者静态实测

- 四个 TS `createSourceFile` 的 parseDiagnostics 均为 0；没有创建 Program / semantic checker / transpile / emit。两生产文件与独立 Pane 测试逐字等于 ab43；Panel 测试当前为 177444 bytes，SHA-256 `99e053de2e05b3c2f7a6e44bb32d7fa373ce277440cd10e0218148588399c3b8`。
- 仅本轮改动的 Panel 测试运行 `eslint --no-cache`，实际 exit 0：0 errors / 1 既有 warning，仍是未触碰的 `:632` `in` operator。
- AST 逐调用比较精确 Git 对象：c7 的 Pane 1 / Panel 70 个 `test(...)` 全部源码字节保留；ab43 的 Pane 2 / Panel 73 个调用也全部保留，本轮仅额外增加 1 个模板调用（2 hosts × 2 outcomes = 4 case）。两测试的旧 `acceptCursorUnifiedDiff` 声明原字节保留。
- 静态枚举矩阵唯一标题共 54，完整 selector 匹配 54，本次增量 selector 匹配 4，原主 red / 同 session 与 ABA 阳性 / 独立 input.dispose selector 分别匹配 2 / 4 / 1；未加载测试 runner 或执行这些 case。
- accepted plan 17436 bytes / SHA-256 `5d5c2a72fcb9d555b15d0442d0c7d47ae9238998cea2eb25b4b7917af8362e61` 与原 JSON 2859 bytes / SHA-256 `fbf75cdbb5d197a2863dd654afe71a7ce71d78fb62668787514d3c98fa0ce028` 均保持。status 仍 200 行，除 summary/首条外与 ab43 各行相同；被替换首条含末尾换行已保存且 hash 相同。
- `generate-docs-status.py --check` 实际 exit 0；`check-docs-health.py --format json` exit 0，0 errors / 46 既有 link warnings，本 scope warning 0；`git diff --check` exit 0。这些仅为作者静态与文档检查，不替代业务或独立 peer。

## ab43 status 首条逐字保留

本次替换 status 当前首条前，下面逐字保存 ab43 的该行（含末尾换行），SHA-256 `6348d1167bb628ceb3828737d0f290067bbee2c23ed6d9aa5f3bd38cbab1418d`。早先三版原文块/hash 不动；status 除 summary 与首条外均与 ab43 相同，总行数仍 200。

```markdown
- **Sources Accept 读后授权源码候选（2026-10-27）**：父核5c0916 accepted后授权仅两runAccept复核fresh planner/读session一致/canWriteAccept及原宿主存活；双宿主49+Pane独立input销毁1共50新例已写，旧71个test调用与旧patch字节保留。四TS AST0、ESLint0error/1旧warning，仅静态；未编译/typecheck/emit/业务运行，待父核→Astra peer→baseline唯一lane旧red/新green，out冻结。[候选/selector/历史原文](sources-accept-post-read-authorization-checkpoint.md#实施候选作者静态检查)；plan仍accepted、D1387/PRD/宽方案不升，lease/local notice不混。
```

## b2 四例窄 peer 与后续独立范围

`b2e31763207201841c5a7fb47b6859eab90fe134`（parent 精确 ab43）保留为不可变候选。root 已独立核全部 8 路径、生产两 TS / Pane 测试 / plan / 原 JSON 保护字节、Panel 测试 SHA-256 `99e053de2e05b3c2f7a6e44bb32d7fa373ce277440cd10e0218148588399c3b8`、status 200 行，并实读新增四例。原 **Astra / architecture_audit** 对该四例做窄源码 peer，结论 **Critical 0 / Important 0 / Minor 0**；root 确认原 ab43 的唯一 A7 Minor 已关闭。这仅关闭四例源码覆盖审查，不称原 54 个 case 已运行或业务验收。

随后 baseline run1 以 c7 旧生产与 ab43 两测试实际取得 A1 双宿主业务红；A2/A3 阳性只有 Pane A2/A3、Panel A2 共三个业务 body 通过，Panel A2 afterEach 三个 VM 类泄漏及 console meta、Panel A3 未达；独立 Pane input.dispose 在 DI setup 抛错、业务未达。原失败不回写为通过，旧结果仍绑定 ab43，不因 b2 补例改变输入。

原 Astra 独立定界并经 root 亲读采纳：Panel 为既有生产 VM owner 缺陷（Important），独立 Pane setup 为 helper 创建 ChangesModel 早于连接 stub。现另写[Panel 生命周期独立 draft](../plans/sources-panel-diff-view-model-lifetime.md)，先规则16与独立accepted后才能授权 Panel 生产与新真实模型路径先决修正；本次只 docs，不实质改本 accepted plan 或此前源码/test 候选。正式旧红入口已由 baseline 在 merge 创建 `dev/progress/sources-accept-post-read-authorization-old-red-evidence/INDEX.md`（baseline proof `d51ce65f86605b47f31c8d99bfbd98fd9f43564d`），当前 D 不复制证据或同步工位；事实边界见[Panel draft 与状态原文](#panel-生命周期-draft-与-b2-status-首条)。

## Panel 生命周期 draft 与 b2 status 首条

root 本轮仅授权[独立窄 draft](../plans/sources-panel-diff-view-model-lifetime.md)，行动层复用本检查点与[现分工看板](../parallel/active/sources-accept-post-read-authorization.md#实测验证先决panel-vm-lifetime)，不再新增并行日志。固定作者输入 b2 / src `3ce82089efd4230dc020c5401b2f4e9bc0b1475a`；全部源码/test、旧 accepted Accept plan 17436B 与原 JSON 保持原字节。原 Astra 对显式 VM owner、双/单 refs 唯一归属、body 仅 listeners、统一 teardown 与 dispose/await 失效形状的设计咨询已确认一致；该咨询不是新方案规则16。draft 先由 root 核验精确 Git 对象，再交原 Astra 只读审查与独立 accepted commit，之后才可另获生产/新夹具修正授权。方案阶段不请求 baseline 接 D HEAD，其祖先含源码；后续以统一实施候选做独立 peer 与绑定验证。

baseline 已通报旧 run1 正式 proof `d51ce65f86605b47f31c8d99bfbd98fd9f43564d`（parent `93da1c80`、src a2c 不变）与精确入口 `dev/progress/sources-accept-post-read-authorization-old-red-evidence/INDEX.md`。同名目录 54 份镜像 / 15,022,205 bytes，baseline 核 repo / Git / scratch 各 SHA / bytes 相同；D 不复制原件、跟随 merge 或为链接接入该提交。当前用精确路径登记，合入后 baseline 统一补正式链接；原临时来源保留于 `/tmp/vscode-sources-accept-ab43-old-red-20261027-run1/`。原 run1 的 3 业务阳性 / Panel A3 未达 / input setup 未达保持，不造 4/4。

本次替换 status 首条前，将 b2 的原行含末尾换行逐字保留，SHA-256 `21185c12e62416dfbc8f64282fd4ba70ca0337bdacfd708774e1cb98cde8b86d`；更早四版原文块 / hash 仍在本文件。status 除 summary 与首条外均与 b2 每行相同，总行数仍 200。

```markdown
- **Sources Accept 源码 peer 后补例（2026-10-27）**：Astra对ab43d861正式peer C0/I0/M1，父核采纳A7缺口：每宿主已发原s1 Apply后仅active变s2，原input/ref/代次不变，accepted/failed各1，共补4成54新例；仅测试/必要文档，生产两TS、Pane测试与accepted方案逐字不变。原50新例/旧71调用/旧patch保留，AST/lint静态检查与selector见[当前检查点](sources-accept-post-read-authorization-checkpoint.md#源码-peer-后补齐-a7)；待父核增量及Astra窄peer，业务redgreen仍归baseline唯一lane，out冻结、plan仍accepted、D1387/PRD/宽方案不升。
```

### Panel draft 作者文档检查

- `generate-docs-status.py` 实际 exit 0，只将新增 plan 索引生成列填为 draft；随后 `--check` exit 0，原 Accept plan 仍 accepted。
- 收敛为复用行动层后，`check-docs-health.py --format json` 实际 exit 0：600 Markdown、0 errors / 46 既有 link warnings；Panel / Accept 主题 warning 均 0。正式证据目前只在 merge，以精确路径登记，未造本地断链。
- `git diff --check` exit 0；全部 tracked `src/` 与固定 b2 无差异，源码树保持 `3ce82089efd4230dc020c5401b2f4e9bc0b1475a`。原 Accept plan 17436B / SHA-256 `5d5c2a72fcb9d555b15d0442d0c7d47ae9238998cea2eb25b4b7917af8362e61`，原 JSON 2859B / SHA-256 `fbf75cdbb5d197a2863dd654afe71a7ce71d78fb62668787514d3c98fa0ce028` 均与 b2 原 blob 相同。
- status 实测 200 行，除 summary/首条外每行与 b2 相同，旧首条连末尾换行已精确保留并核 hash。

本轮没有源码/测试修改、编译、typecheck、transpile、emit、业务/Electron运行、真/假窗口、out/cache/freeze写入、push或工位跟随；文档静态门不等于新方案规则16或业务通过。
