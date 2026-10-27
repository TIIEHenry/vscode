---
title: "Sources Accept 读后授权：方案作者检查点"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "5f4 same-ref窄peer C0/I0/M0经父采纳/I1关；root核f5a后另授权共同预stub最小Pane test-only候选，旧default/helper/resolver/cases及生产/Panel保护，仅静态待新窄peer/唯一lane，历史/out保持。"
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

## Panel 生命周期方案规则16与父级采纳

正式审查输入为独立 draft commit `a04aed40c8c7ba4697ca42be2b80fae3e7e1d6c2`，plan 为 17490 bytes / SHA-256 `e8cf41f71cd3a5664f6738ce09f79ce1294e903c4df41321740555fce8097b97`，parent b2、src `3ce82089efd4230dc020c5401b2f4e9bc0b1475a`。root 已亲自核 parent/src/clean、8 个文档路径、status 200 行、plan 全文和旧 Accept plan 的保护字节，再交原 **Astra / architecture_audit** 正式规则16。其结论为 **Critical 0 / Important 0 / Minor 0**；root 独立核验后采纳，确认公开 `ICodeEditorService` 配真实 resolver/provider 计数可实现验证观察。

本次没有必改项、没有未采纳意见。方案仅改为独立 accepted、同步必要文档，不实质更改已审的生命周期/refs合同，不把设计咨询或 b2 窄 peer 当成此次方案审查。未授权源码、fixture、checker/emit/业务运行或 out 释放，不请求 baseline 接 D HEAD；accepted 独立提交供 root 再核后另发实施授权。

以下由 **root 逐字转发原 Astra 正式规则16原文**，不是设计咨询摘要；行号属于不可变 a04 draft：

```text
规则16正式只读结论：固定 draft a04aed40c8c7ba4697ca42be2b80fae3e7e1d6c2；已独立核plan 17490 bytes / SHA256 e8cf41f71cd3a5664f6738ce09f79ce1294e903c4df41321740555fce8097b97。Critical 0 / Important 0 / Minor 0。Strengths：(1) plan:63-76以显式VM holder和唯一双/单refs owner消除真实缺口，body仅listeners，统一detach→widget→VM→refs，未把Pane签收外推；(2) :80-82区分dispose代次失效与clearEditors，不破坏renderRef已捕获代次，覆盖双await成功/拒绝与单ref迟到、局部/已转交资源、不得清后来owner；(3) :92-104真实观察可实现：ICodeEditorService公开listDiffEditors/listCodeEditors（:34/:39）可捕获旧widget后查getModel，真实resolver包装记录每ref dispose，公开provider onDidChange转发计订阅，保留tracker，不必私有VM清理；(4) :86只新resolveModels=true预注入connection，保留旧helper/default/case；(5) :18-26与:106诚实保留run1的双A1业务red、3阳性body/2afterEachfail、Panel A3未达及A4setup失败。Assessment：方案满足规则16，可由root核验后独立accepted，再另授权实施。只签设计，不签源码/运行，不回写draft之后的父级恢复事实。未修改文件、编译、emit或运行测试。
```


### draft 后收到的 root 原件与恢复核验

以下是 a04 draft 固化后收到的父级核验追加，**不回写 draft 当时的证据等级**：root 对正式 proof `d51ce65f86605b47f31c8d99bfbd98fd9f43564d` 独立全核，54 份镜像共 15,022,205 bytes 的来源 `/tmp`、repo filesystem、commit blob 各 bytes / SHA 全相同，61 个 commit 路径与 filesystem 全精确；merge clean、src a2c 保持。root 另实际执行仓内 `verify-restored.py`，`2026-10-27T02:36:40Z` 实测 exit 0，254 + extra 2 输出资格、全部 12554 files / 2946 dirs 恢复基准、freeze 4 与 cache 3 全稳，只保留原授权 5 文件 ctime 差。这里记录 root 实测，不冒充 D 新执行或再次恢复。

该核验接受 A1 双宿主业务红及原始恢复边界；A2/A3 仍仅三个业务 body 过、Panel A3 未达、独立 input.dispose setup 未达。没有新 emit/重跑，不代表新 green、完整54运行或生命周期已修。正式入口仍为 `dev/progress/sources-accept-post-read-authorization-old-red-evidence/INDEX.md`；D 不复制原件、不跟随 merge，按精确 proof 路径引用。

### a04 draft status 首条逐字保留

本次 accepted 状态更新只替换 status summary 与首条，其余每行保持 a04 原文，总行数仍 200。被替换首条含末尾换行 SHA-256 `1582d515db672da6ba025ded59e78146b3b32b8ee0b86c650a3c73ec046ac95c`；更早五版原文块 / hash 均保持。

```markdown
- **Sources Panel 生命周期独立 draft（2026-10-27）**：Accept b2四增量经父核/Astra窄peer C0/I0/M0、M1关闭；run1旧A1两宿主业务红成立，阳性仅Pane A2/A3和Panel A2共3过、Panel A2 afterEach三泄漏/console meta、Panel A3未达，独立input.dispose setup未达。Astra/root定界Panel真实VM owner缺陷，现仅写[独立draft](../plans/sources-panel-diff-view-model-lifetime.md)：显式owner、detach→VM→refs含body/dispose/迟到resolver、仅新真实模型路径预stub连接；未改代码/test/Accept方案，待父核/原Astra规则16，out冻结。[原首条/边界](sources-accept-post-read-authorization-checkpoint.md#panel-生命周期-draft-与-b2-status-首条)。
```

### accepted 方案作者文档检查

- `generate-docs-status.py` 实际 exit 0，仅将 Panel plan 的索引生成状态更新为 accepted；随后 `--check` exit 0，旧 Accept plan 保持原 accepted 字节。
- `check-docs-health.py --format json` 实际 exit 0：600 Markdown、0 errors / 46 既有 links warnings，Panel/Accept 主题 warning 0；`git diff --check` exit 0。
- 源码与全部测试对 a04 / b2 无差异，src 仍 `3ce82089efd4230dc020c5401b2f4e9bc0b1475a`；原 Accept plan 17436B / SHA-256 `5d5c2a72fcb9d555b15d0442d0c7d47ae9238998cea2eb25b4b7917af8362e61`，原 JSON 2859B / SHA-256 `fbf75cdbb5d197a2863dd654afe71a7ce71d78fb62668787514d3c98fa0ce028` 均逐字相同。
- Panel plan §1–§5 与受审 a04 原稿字节完全相同，只更新 frontmatter、当前阶段与规则16结论；status 仍 200 行，除 summary/首条外每行与 a04 相同，被替换首条含末尾换行已留存并核 hash。

这些是 accepted 文档与保护字节检查；没有源码、fixture 修改或新 checker/emit/业务运行，不是实施完成或 out 释放。

## Panel 生命周期实施候选作者静态检查

root 已独立核验 accepted `e949e1b1a5fb98f6c2eb1daa40e41263282666e2`（Panel plan 18145B / SHA-256 `c41d14021ebc4eb04eae28835d455debb3258019ef3ffdcd1f0c07d4de9b6b4b`、§1–§5 逐字等于受审 a04）后，另行明确授权 D 实施窄 Panel 生命周期、仅新真实模型路径 fixture 预注入、真实资源回归与必要文档。当前是源码候选，两个 plan 都保持 accepted，不称 implemented；此前 draft / accepted 章节保留原时点事实，本节记录之后的实施授权。

生产只改 `sourcesDiffPanelView.ts` 的 owner / create / render / clear / dispose / await guard 与所需 import：显式私有 VM holder、双 refs 仅 model wrapper 持有、单 ref 仅原 holder 持有，body 仅 listeners。统一 teardown 停 listeners/cursor、detach diff/code model、销毁 widgets/VM 后再释放 refs；host dispose 先失效 render 代次并在 super 前走相同入口。await 返回后核 host alive / captured generation，class 字段发布前再次核对。partial construction 由预先登记的局部 cleanup 持有，finally 只 detach / 清局部未转交 widget / VM / refs；已发布后的异常也核 captured generation 与实际 widget identity，只清自己，不能清后代。没有 generic DiffEditorWidget / RefCounted 或公共框架改动。

`conversationDiffReviewPane.test.ts` 仅在 `resolveModels=true` 的新路径、调用旧 helper 前预注入传入 connection；其余整个文件字节保持（包括旧默认 false、旧 helper 正文、case/header/assertion）。root 后来已通报旧 default-false 的独立 exact c7 setup probe 也实际失败；这是另一个 setup 资格，不计业务 red 或 54，当前授权仍只 true，不偷改默认分支。后续 §3.4 的共同预注入须另交极窄 docs proposal / 规则16 / accepted / 源码授权，当前候选先独立提交给 peer，不以保旧失败为最终交付目标。

新增 `Panel diff model lifetime` suite 只用公开 `ICodeEditorService.listDiffEditors/listCodeEditors` 捕获真实旧 widget 句柄并查 `getModel()`，包装并转发真实 resolver / diff provider 记录每份 ref 释放与 provider 事件订阅。旧 refs 释放时检查 widget 已 detach、provider 订阅为 0、release 恰 1 次；继任 editor 真模型仍可读取、其 refs 尚未释放，最终正常 clear/dispose 后全部收束。没有捞私有 VM、替它清理、豁免 tracker、延时洗绿或修改旧断言。

**静态新增 18 个生命周期 case，全部未运行**：6 个同步出口（replace / clear / dispose / same-ref / diff-to-single / single-to-diff）+ 12 个 resolver pending（diff 的第二 ref、single 的唯一 ref × replace/clear/dispose × resolve/reject）。显式 started/release 门配 show 提前返回拒绝；旧 pending 迟到 / 拒绝后只释放自己的 acquired refs，继任模型/refs 保持。原 `Accept post-read authorization` 静态 54 个调用展开保持，不能把它们或这 18 个写成 green。

| 精确 grep | 静态 case 数 / 用途 |
| --- | --- |
| `Panel diff model lifetime` | 18；本轮全部新生命周期回归。 |
| `Panel diff model lifetime (replace|clear|dispose|same-ref|diff-to-single|single-to-diff) detaches real widgets and releases each old reference once$` | 6；真实同步出口与每份引用释放。 |
| `Panel diff model lifetime (diff|single) pending modified reference (resolved|rejected) after (replace|clear|dispose) releases only its own references$` | 12；迟到/拒绝、原 refs 释放与后代保持。 |
| `Accept post-read authorization` | 54；既有矩阵调用正文/夹具不变，运行边界仍以独立 lane 实际记录为准。 |

作者静态实测：三改动 TS `createSourceFile` parseDiagnostics 全 0，不建 Program / semantic checker / transpile / emit；三 TS `eslint --no-cache` exit 0，0 errors / 1 既有 warning，因新增 import 原 `in` operator 行从 :632 移到 :636，旧行内容未变。AST 对 e949 的 Pane 2 / Panel 74 个 test 调用与旧 patch 声明逐个字节核对，全保留，只新增 2 个模板调用展开为 18。进一步实际核对 c7 的 Panel70 / Pane1、ab43 的 Panel73 / Pane2、e949 的 Panel74 / Pane2 个 test 调用全原字节；两份旧 patch 声明相同。Pane 生产文件整体、两宿主 runAccept、Panel currentWriteFacts 均与 e949 原字节一致；Pane 测试删去唯一的 true 预stub三行增量后整体字节等于 e949，旧 helper/default/case 全保留。两个 accepted plan 原字节与原 JSON 均未变。`generate-docs-status.py --check` 实际 exit0；`check-docs-health.py --format json` exit0、0 errors / 46既有link warnings、本主题0；`git diff --check` exit0。没有编译/typecheck/业务测试/真或假窗口/out/cache/freeze写入或 push；正式源码 peer 与唯一 lane 验证仍待父核后释放。

### e949 accepted status 首条逐字保留

此次仅替换 status summary 与首条，其余行与固定 e949 完全相同，总行数仍 200。原首条含末尾换行 SHA-256 `fd80d2d4ed3d1c292e9d1259c72db12f5eb8c02e749eee367d3b8f34aaa093c7`；更早六版原文块 / hash 保持。

```markdown
- **Sources Panel 生命周期方案签收（2026-10-27）**：精确a04draft/17490B经父核与原Astra规则16 C0/I0/M0，root采纳、无必改项，独立[方案accepted](../plans/sources-panel-diff-view-model-lifetime.md)；只签文档，未实施/运行，原src3ce/生产测试/Accept方案保护、out冻结，不请求baseline接D HEAD。旧A1双主业务红、阳性仅3/Panel A3与独立setup未达保持；draft后root核d51ce65全54原件及02:36:40恢复exit0单独[追加留证与原首条](sources-accept-post-read-authorization-checkpoint.md#panel-生命周期方案规则16与父级采纳)，不借此称新green，待另行源码授权。
```

## 共同 factory 预注入连接窄修订 proposal

生命周期候选已固定为 `44edbd2b5ba562ce6503237069cba0cd763830a4`（parent e949、src `c478d07f29331d164bf4b80259abee83937cc7c9`），其代码与18新例/原54保护身份不改，仍待父核/原Astra源码peer/唯一lane。root 又先安排唯一lane验证旧default-false资格，再明确授权单独交[Panel §3.4窄修订draft](../plans/sources-panel-fixture-preinjection-amendment.md)；当前只提共同factory在旧helper之前预stub同一UA这一放宽，不直接改原18145B accepted plan或test。

D已只读原 probe 的 reporter/validation-report，确为exact c7原Pane.test 8391B、原default-false case 1test/0pass/1setup TypeError，JS栈ChangesModel59→helper88→factory114→oldcase159；read-start/clearInput/Apply/原断言全未达，业务red0，不计54或18。root亦独立核原reporter/栈/input=Git与单输出恢复资格。正式入口已在merge实际创建 `dev/progress/sources-accept-default-false-probe-20261027-evidence/INDEX.md`（28原件/driver/分类、12,168,523B，proof commit待baseline通报），D不复制/追HEAD。原临时来源 `/tmp/vscode-sources-accept-default-false-probe-20261027-run1/`；报告03:04:01Z finally恢复1文件原bytes/mode/mtime、其余12553files/2946dirs、254+extra2/freeze/cache全稳，仅授权ctime差，不是D新执行。

proposal规则16尚待固定SHA后父核/原Astra；独立accepted文档commit才可应用§3.4唯一段落替换，之后另授权共同预stub源码。旧helper正文/旧case/标题/header/assertions/defaultfalse resolver行为仍须原字节。原setup失败保留；修正后的真实业务结果另记，不承诺green/不修builder。源码/out均未在本次proposal改动。

### 44 生命周期候选 status 首条逐字保留

本次仅替换status summary与首条，其他行与44完全相同、保持200行。原首条含末尾换行SHA-256 `94fcc14763a024a93b724a111f7bbff2fc57a328d23f01d55d1dda6a1272320c`；更早七版原文块/hash全保留。

```markdown
- **Sources Panel 生命周期实施候选（2026-10-27）**：父核e949 accepted后授权，Panel显式VM/refs唯一owner、统一detach→widget→VM→refs，dispose失效代次/await双门，异常只清本地未交资源不碰后代；新增6同步+12迟到resolver真资源回归，共18未运行。仅resolveModels=true预stub，旧默认false/helper正文/原54与旧71调用/旧patch保持；三TS AST0、lint0error/1旧warning，仅静态，未编译/typecheck/emit/业务/out。两plan仍accepted，待父核候选/原Astra peer/唯一lane；[当前检查点与原首条](sources-accept-post-read-authorization-checkpoint.md#panel-生命周期实施候选作者静态检查)，默认false窄修订另门，PRD/D1387/宽方案不升。
```

### 窄修订proposal作者文档检查

实际文档检查：`generate-docs-status.py` exit0只填新proposal draft生成列，随后`--check` exit0；`check-docs-health.py --format json` exit0，601 Markdown、0 errors / 46既有link warnings，新proposal/现post-read主题warning0；`git diff --check` exit0。原Panel§3.4被引用段落与18145B原文逐字相同。全部44 src/test不变，两accepted plan分别18145B/c41d1402…与17436B/5d5c2a72…、原JSON2859B/fbf75cdb…均原字节；status200除summary/首条外与44各行相同，旧首条含newline已保留核hash。没有源码/测试或运行修改，不预写规则16通过。

### 外部工位边界追加（父级通报）

root于`2026-10-27T03:13:42.701550Z`观察main仍为`d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`，status53行/SHA-256 `4e18cb0056e2d47c0432694b213f59eeb91ed7c268a28e87e2035bdb45c39de7`，tracked diff SHA-256 `2cf0b50ba4891d6cc6c1df6ca8e9d84e575f9a8a21a66f87a3e7e565e1e59194`。这是外部WIP变动的父通报，不由D复写日志或归因；D不追随/导入/清理该工位，当前proposal仍固定44源码身份。

## same-ref 新夹具 I1 独立修订

固定 `44edbd2b5ba562ce6503237069cba0cd763830a4` 的原 Astra 正式源码 peer 为 **Critical 0 / Important 1 / Minor 0**；生产静态符合已签 owner / teardown / await 边界，唯一 I1 是新 same-ref case 的夹具。root 独立核验并采纳：`store.add(models.createModel(...))` 只登记 raw model，不是 resolver refcount keeper；旧 Panel refs 释放后真实 `TextModelResolverService` 异步销毁排队，第二次 show 顺序 await 两侧 ref 时，modified 可先被销毁，inmemory 无内容 provider 重建。因此是新夹具静态资格缺陷，18 个新例尚未运行，不写成实际业务失败。

root 只授权独立 test-only 修订：在新 `mountLifetimeHost` 增加通过**未包装 underlying resolver**取得的临时 keepers；仅新 same-ref 在第二次 show 前取得两侧 keepers，show 完成即由 finally 释放，异常也兜底。keepers 不进入 Panel `references` 记录、不登记到 suite store、不跨 case 保活；取得 modified 失败时局部释放 original。旧 Panel refs 的 release=1、旧 widget detach、旧 provider subscriptions=0、继任 refs 未释放及最终全部 owner 释放的原断言逐字保留，且全部在临时 keepers 释放之后检查。

本次不改生产顺序/释放时机、不改 generic widget、不捞或私自清 VM、不豁免 tracker、不加延时、不改原54/旧case、不改 Pane true-only 预stub，也不实施共同factory修订。`d0c5f685331b4950b4b9c262a6a0c19bb8be7476` 的 proposal 本轮仍保持 7509B / SHA-256 `8d34097cea4dc5a487d4b151bd8924260a91fb4705566bde624423ca45fa0401` 原字节；共同预stub合同及源码分别继续走独立授权门，不把本次 I1 代替其规则16。

### 后续收到的 default-false proof 身份

root 此后通报旧 default-false 独立 probe 的正式 proof 为 `942d0652065d7aafe085d2e54a95c17bcd4f4c1c`，入口仍为 `dev/progress/sources-accept-default-false-probe-20261027-evidence/INDEX.md`。这是对上节“proof commit待baseline通报”的后续身份追加，不回写当时文字；原 1/0/1 setup TypeError、业务 red=0、未计54/18及03:04:01Z恢复资格保持。D 未接入/复制 proof、跟随 merge 或新运行。

### d0 proposal status 首条逐字保留

此次 status 只替换 summary 与首条，其余行与固定 d0 完全相同，总行数仍 200。原首条连末尾换行 SHA-256 `07ee7d18930c441815d00b63ccca5332f9df17ab261d6270e55c294116f1b184`；此前所有原文块与 hash 保持。

```markdown
- **Sources 共同fixture预注入窄修订 proposal（2026-10-27）**：生命周期44edbd2候选已固定，18新例仅静态、待源码peer；root独立确认exact c7旧default-false原case实际1/0/1 setup TypeError，未达业务、不计54。现仅另写[§3.4独立draft](../plans/sources-panel-fixture-preinjection-amendment.md)，提议共同factory在旧helper前预stub同一UA，保旧helper/case/header/assert/defaultresolver；原18145B/17436B两accepted方案与44全部source/test不动，待父核/原Astra规则16/独立accepted后才另授权代码。[当前边界与原首条](sources-accept-post-read-authorization-checkpoint.md#共同-factory-预注入连接窄修订-proposal)，out仍冻，不预称旧case业务green。
```

### I1 作者静态检查

改变的 Panel test `createSourceFile` parseDiagnostics=0，仅 parse、不建 Program / semantic checker / transpile / emit；`eslint --no-cache` 实际 exit0，0 errors / 1 既有 `in` operator warning（:636）。对44所有 test 调用逐个核字节，只有既有新增同步生命周期模板中 same-ref 条件支改变；pending模板、18个case选择器、原54/旧71调用与旧patch声明全保留。Panel生产和Pane生产/测试、两accepted plan与原JSON保持固定原字节。`generate-docs-status.py --check` 实际 exit0；`check-docs-health.py --format json` 实际 exit0，601 Markdown / 0 errors / 46既有 link warnings，现post-read/proposal主题warning0；`git diff --check` exit0。没有运行任何业务、checker、emit、窗口或写out/cache/freeze。当前只是作者静态修订，窄peer及唯一lane业务仍待父级安排。

### root 后续实际 restored 守卫通报

root 通报其于 `2026-10-27T03:23:57.161510Z` 在 merge 固定 `942d0652065d7aafe085d2e54a95c17bcd4f4c1c` 实际执行最新 probe 证据的 `verify-restored.py`，exit0；254 + extra2 输出资格、12554 files / 2946 dirs、freeze4 / cache3 均与 actual post-probe restored baseline 精确，src仍a2c。此为root实际只读守卫，无compile/emit/tests；D不冒充新执行、不覆盖03:04:01Z或此前原guard文件。

## 共同 factory 窄修订规则16与独立签收

root 已全文/源链独立核验并采纳原 Astra 对精确 `d0c5f685331b4950b4b9c262a6a0c19bb8be7476` 的规则16结论 **Critical 0 / Important 0 / Minor 1**。proposal原稿7509B / SHA-256 `8d34097cea4dc5a487d4b151bd8924260a91fb4705566bde624423ca45fa0401` / Git blob `a066c461e7dfb92d3d59e04d686e572edc60659f`，原Panel accepted plan18145B / SHA-256 `c41d14021ebc4eb04eae28835d455debb3258019ef3ffdcd1f0c07d4de9b6b4b` / blob `75f4e71ca02cc4bd03355c38a933e69c678f8d73`，均可在不可变d0取得；不把draft正文历史洗成已签收。

本次按父级授权单独accepted docs：原Panel§3.4第一段应用d0共同factory在旧helper前预stub同一UA的提议；唯一Minor把标题“仅新真实模型夹具预装连接”改为“共同夹具预装连接”，并只更新全仓实际唯一旧导航anchor（proposal固定输入）。其余原§1–§5合同逐字保护，原quoted旧段落与draft历史保留；未采纳意见0。Strengths / Assessment原Astra消息摘录、父级采纳与proof942后续身份见[窄修订§5](../plans/sources-panel-fixture-preinjection-amendment.md#5-d0-规则16与父级采纳)。原a04生命周期与本d0窄修订是分别发生的方案门，44代码peer/5f4修订又是独立源码门。

源码固定 `5f4f2d132f972af871fb4451c82ef2ab6ee30e61` / src `7d43a2a5f2a74f0ef2a28976fe0067748a028cc1`。5f4仅新same-ref真实underlying resolver短期keeper修订尚待窄peer，18及原54未新运行；当前Pane源码仍true-only，与已签共同factory合同的实施阶段明确分开。root核本accepted docs SHA后才另授权共同预stub源码；本次原Accept plan/JSON及所有src/test原字节、不做checker/emit/业务/窗口或写out/cache/freeze。default-false proof942、setup1/0/1/业务red0和03:23:57 root restored实际通报均以上节后续身份为准，不覆盖旧证据或追merge。

### 5f4 status 首条逐字保留

此次仅替换status summary与首条，其余行与固定5f4完全相同，总行数仍200。旧首条含末尾换行SHA-256 `834a0a9a3948a298f9f44dfaa26fcf02a238d19a47fd6a84b3ceb356f6f792d7`；所有更早status原文块/hash和checkpoint历史前缀保留。

```markdown
- **Sources Panel same-ref夹具窄修订（2026-10-27）**：44源码正式peer C0/I1/M0，生产静态符合签收边界；root采纳I1：新same-ref需真实resolver短期keeper，现仅该新夹具经未包装resolver保两模型，第二show完成/异常finally即释放，Panel引用计数/旧widget detach/provider0/最终owner断言不减。18选择器/原54与旧71/44生产及Pane true-only预stub全保，仅AST/lint静态、待窄peer；共同factory修订仍d0 draft另门、out冻结。[当前修订与原首条](sources-accept-post-read-authorization-checkpoint.md#same-ref-新夹具-i1-独立修订)。
```

### 本次被替换的概览与行动条目原文

以下在当前叙述同步前逐字留存；每块SHA按显示原文追加一个末尾换行计算，历史时点的draft/true限定/未实施不代表当前合同。

`dev/plans/INDEX.md`，SHA-256 `f6c6b0b75ddcd0517345ccba4245b9c0a84b6641eb6121883c7f14bcd7bdae08`：

```markdown
| [Sources Panel方案§3.4：共同factory预注入连接的窄修订](sources-panel-fixture-preinjection-amendment.md) | `draft` | 独立draft，exact c7旧default-false实际setup失败后提唯一预stub放宽；原plan/source/test不动，待规则16。 |
```

`dev/plans/INDEX.md`，SHA-256 `67d33936554c06f951713f673e55e6fb33a633040bb461f68deacc4d1f7de323`：

```markdown
仅新same-ref临时resolver keeper修订待窄peer，18真实资源例未运行；仍accepted。
```

`dev/parallel/INDEX.md`，SHA-256 `b2edde874a7696a0e09b829ad719813e948b43ceb2006b6bc3560de7da5e7e9c`：

```markdown
44源码peer C0/I1/M0后仅新same-ref短期keeper修订待窄peer，18未运行；共同预stub仍d0独立draft门，out冻结。
```

`dev/progress/INDEX.md`，SHA-256 `7e3a8284db3035b1cdfb6d20c90c7585e6fca1d1ce4538f66725fe535aadd621`：

```markdown
44源码peer C0/I1/M0后仅新same-ref短期resolver keeper修订待窄peer、18未运行；共同预stub仍d0独立draft门，生产/Pane/旧plan/历史全保。
```

`dev/parallel/active/sources-accept-post-read-authorization.md`，SHA-256 `c2cf30a9a561fc64f68bb06cb9469e5045f91de47dc8dadc78606a68506887e6`：

```markdown
| 角色 | 范围 | 当前门禁 |
| --- | --- | --- |
| D / sources_audit | 仅两宿主 Accept 读后写前当前授权的方案，规则16后才实施 | b2不可变、原54/旧71调用/旧patch保留；四例窄peer C0/I0/M0已交，不写out/运行业务。父核e949后已获生命周期实施授权，44正式源码peer C0/I1/M0、生产静态符合边界；仅新same-ref短期真实resolver keeper修订待窄peer，18新例未运行，Pane仍仅true预stub。 |
| root | scope 与合同选择、draft路径/原文保留核验、安排独立评审 | 已核draft/规则16/accepted及ab43，采纳源码peer唯一A7 Minor并授权补4；已核b2并确认Astra窄peer关闭M1；亲核旧run1边界，生命周期独立a04规则16 C0/I0/M0已采纳、仅签方案，业务仅baseline lane，不借旧波验收。 |
| Astra / architecture_audit | 当前授权取舍、规则16只读方案审查，实施后独立源码 peer | 精确draft规则16 C0/I0/M2后，ab43正式源码peer C0/I0/M1已交；唯一A7覆盖Minor经父核采纳、b2补4窄peer C0/I0/M0关闭；生产VM泄漏独立a04方案规则16 C0/I0/M0，root已采纳，仅签方案。 |
| baseline_executor | 唯一源码 checker / emit / 官方 Electron 业务验证 lane | run1精确c7生产3+ab43测试2：A1双业务红；阳性只3 body过、Panel A2 afterEach leak/console、Panel A3未达；独立input setup未达。正式原件proof d51ce65已由baseline提交，后续green需另获释放。 |
推进顺序：draft/父核/规则16/两Minor实改/独立accepted → 父核5c并授权源码 → ab43两宿主与50新例候选 → 父核及Astra源码peer C0/I0/M1 → 父采纳A7 Minor、D补4成54 → 父核b2/Astra窄peer C0/I0/M0关闭M1 → 唯一lane旧red已得、阳性/夹具阻塞独立生命周期方案已accepted、未实施 → 后续新green与父级验收。不得把作者静态检查代替源码peer或业务门禁。
| 独立范围 | 当前阶段与入口 |
| --- | --- |
| Panel VM lifetime | root 采纳原 Astra 生产 Important 与 DI setup 定界；[独立方案](../../plans/sources-panel-diff-view-model-lifetime.md)原 a04draft 经 root 核验与原 Astra 规则16 C0/I0/M0、root采纳后为 accepted；显式 VM / refs 唯一 owner、detach→VM→refs、body / dispose / 迟到 resolver 全路径与仅新真实模型路径预stub合同保持。root核e949后已另行授权：44正式源码peer C0/I1/M0、生产静态符合签收边界，root采纳新same-ref夹具I1；现仅通过underlying resolver临时keeper保活到第二show后finally释放，Panel计数/detach/provider0/最终owner断言不减。18例仍未运行、仅AST/lint待窄peer/唯一lane；两runAccept/Pane生产及true-only预stub/原54/旧71/旧patch不变，两个plan仍accepted。 |
| §3.4 共同factory预stub | [独立窄proposal](../../plans/sources-panel-fixture-preinjection-amendment.md)为draft；exact c7旧default-false原case实际setup失败、不计业务red/54。仅提共同factory在旧helper前预stub同一UA，原18145B plan/44源码/test不动，待父核/原Astra规则16/独立accepted后另授权源码；旧helper/case/header/assert/defaultresolver保持。 |
```

`docs/systems/sources/overview.md`，SHA-256 `bd53f29771215e0f32c28ac06bd86222aede20a58a1c46c76caf08acf4088ab2`：

```markdown
- **Accept 读后写前授权**：Pane / Panel 在 FileDiff 返回后复核原 input/ref 与局部生命周期代次，input 自身销毁也算失效；以 fresh facts 重跑既有 Accept planner，只有当前 write session 与捕获的 read session 相同、当前能力/连接/hold/readiness/Changes 写门全开才发原 session 的单 hunk，不重定向或 fallback 本地 Git。采用写前当前授权，s1→s2→s1、同 id 重连或故障恢复后若当前门满足可继续；Session/List 失败的 catalog readiness 与 Git Changes 的 read-failed leftover 分别判断。已发写不假取消/补偿，迟到结果只向仍存活的原宿主写 UI。实现候选已写、[独立方案](../../../dev/plans/sources-accept-post-read-authorization.md)仍 accepted，54 新回归已有源码；ab43 的 A7 Minor 经 b2 补 4 例及原 Astra 窄 peer C0/I0/M0 关闭。旧 run1 已得双宿主授权业务红，阳性仅 3 个业务通过、Panel A3 与独立 input.dispose 业务未达，Panel VM owner 泄漏另立[生命周期方案](../../../dev/plans/sources-panel-diff-view-model-lifetime.md)，精确 a04draft 经规则16 C0/I0/M0 后 accepted 保持，父核 e949 后授权的 Panel 显式 VM/refs owner 与 detach→VM→refs 候选及 18 真实资源回归已写、仅静态未运行，待源码 peer / 唯一 lane；仅新真实模型路径预stub连接，原 Accept 合同与旧调用不变；[作者静态边界](../../../dev/progress/sources-accept-post-read-authorization-checkpoint.md#源码-peer-后补齐-a7)不代 peer / red / green，跨 engine 同 session 字符串归属不在本 scope。
```

### 共同预stub accepted docs作者检查

实际 `generate-docs-status.py` exit0，仅将新窄修订索引生成状态改为accepted；随后 `--check` exit0。`check-docs-health.py --format json` 实际exit0：601 Markdown / 0 errors / 46既有link warnings，现post-read/proposal主题warning0；`git diff --check` exit0。原Panel§1–§5反向还原获准的§3.4首段/标题后与旧稿完全同字节（原合同区SHA-256 `0bde86ee5003d48a740c73fe47286df61dbbb1346bfce90b806f9daee4169e81`）；proposal固定输入及原§1–§4只改变唯一导航anchor，旧段落引文原字节保留。status实测200行，只summary/首条变化且原行含newline已核hash；旧checkpoint前缀/更早raw均保留。全部src/test对5f4无diff、原Accept plan17436B/5d5c2a72…及原JSON2859B/fbf75cdb…原字节。本轮无源码改动或新的业务资格，不编译/checker/emit/业务/窗口/out/cache/freeze或push；当前方案保持accepted，不标implemented。

## 共同 factory 预stub 最小源码候选

root 已独立核 `5f4f2d132f972af871fb4451c82ef2ab6ee30e61` 全7路径/hash和14行test增量，及 `f5a74df01faf7a024ac4f69f4448a0da65f3e186` 全9docs/hash、parent/src/status200/两版原首条/原Accept plan与JSON保护；反向还原唯一§3.4段落+heading后原§1–§5逐字相同、SHA-256 `0bde86ee5003d48a740c73fe47286df61dbbb1346bfce90b806f9daee4169e81`。root采纳f5a accepted后，**另行明确授权**共同pre-stub最小test-only源码；这不是从docs accepted自行推导的授权。

本候选从精确f5a（src `7d43a2a5f2a74f0ef2a28976fe0067748a028cc1`）出发，仅将Pane测试 `createInstantiationService` 里旧helper前的 `if (resolveModels) { stub(IUniverseAgentConnection, connection) }` 收为一次无条件stub，仍为当前传入同一connection。`resolveModels = false` 默认值、true/false resolver分支、旧helper完整正文/其内部次序、全部旧case/标题/header/断言/patch builder原字节；Pane生产、Panel生产和Panel.test全文件保持。不增加case/隐藏旧case或改业务期望。

### 5f4 I1 窄peer与父级采纳后续

原Astra直接通报5f4窄peer **Critical 0 / Important 0 / Minor 0**、44 I1关闭；root亦实读14行及完整h上下文，明确采纳其符合短期raw-resolver keeper合同。原审查消息的观察点为：raw resolver keepers与Panel wrapper计数分离；第二ref失败释放first，same-ref第二show success/failure由finally即时释放；不永久pin，原detach/ref=1/provider0/最终clear-dispose断言保留，不mask VM或tracker。此结论仅签5f4修正，不外推本候选共同pre-stub/运行结果；此前“待窄peer”历史原文不回写。

### f5a status 首条逐字保留

此次status只替换summary与首条，其余行对固定f5a逐字保持，总行数仍200。旧首条含末尾换行SHA-256 `bed531d785d7d4eb644c0668d3a57a3d400b8dc8738d849190f9794f355b2e15`；更早所有原文块/hash与checkpoint旧前缀均保留。

```markdown
- **Sources 共同fixture预注入窄修订签收（2026-10-27）**：精确d0 proposal经root全文/源链核验、原Astra规则16 C0/I0/M1后采纳；唯一Minor改§3.4标题为共同夹具预装连接并同步唯一锚点，已将共同factory旧helper前预stub同一UA合同独立accepted，其他§1–§5逐字保护。源码固定5f4：仅same-ref短期resolver keeper修订待窄peer，18/54未新运行，Pane当前仍true-only，须root核本docs SHA后另授权共同预stub代码；旧setup1/0/1与业务red0保留，out冻结。[签收与原首条](sources-accept-post-read-authorization-checkpoint.md#共同-factory-窄修订规则16与独立签收)。
```

### f5a 原当前阶段措辞保留

下列措辞属于f5a文档签收时点；本次得到独立源码授权后更新当前叙述，原draft与accepted事件记录不洗掉。

`dev/plans/INDEX.md`，原文含末尾换行SHA-256 `0ac3be9dccc3ee81eca3b1f0e7f790d1dd026531920d5007f9e1a39816f0db75`：

```markdown
§3.4共同预stub首段及Minor标题/唯一锚点已改，其他合同/源码5f4保护；共同预stub代码另授权。
```

`dev/plans/INDEX.md`，原文含末尾换行SHA-256 `d006ad1b74383e0c725535c5c4035060de5c56eb3ec02a599ad537c4d10ba515`：

```markdown
仅新same-ref临时resolver keeper修订5f4待窄peer、18例未运行；§3.4共同预stub窄修订已accepted，代码另授权；仍accepted。
```

`dev/parallel/INDEX.md`，原文含末尾换行SHA-256 `138b45a219763407466bdb4d746ee39f064fa90d7d4655fd7d24fbd76ad37589`：

```markdown
44源码peer C0/I1/M0后新same-ref修订5f4待窄peer，18未运行；共同预stubd0规则16 C0/I0/M1/root采纳后独立accepted，代码另授权，out冻结。
```

`dev/progress/INDEX.md`，原文含末尾换行SHA-256 `0d81a4881f0355f6b75856a0ca3b0f2529047ac6b4091ac58db0a5080c8494c5`：

```markdown
44源码peer C0/I1/M0后same-ref修订5f4待窄peer、18未运行；共同预stubd0规则16 C0/I0/M1/root采纳后独立accepted，仅§3.4首段/标题/锚点变，源码5f4/其余合同/历史保护。
```

`dev/plans/sources-panel-diff-view-model-lifetime.md`，原文含末尾换行SHA-256 `a0012729255f5bf4e7f8cb3612f75b60ebf70add9d17002931636bdd102f4401`：

```markdown
> **当前阶段与授权（d0窄修订后）**：原a04生命周期accepted保持；[共同factory预注入窄修订](sources-panel-fixture-preinjection-amendment.md#5-d0-规则16与父级采纳)经原Astra规则16 C0/I0/M1、root全文与源链核验采纳，本次只应用§3.4首段替换及标题/唯一锚点导航改名，其他§1–§5逐字保护。44源码peer C0/I1/M0的same-ref夹具I1已独立修订为5f4，尚待窄peer；共同预stub源码待root核本docs SHA后另授权，当前18/54未新运行、out仍冻。
```

`dev/plans/sources-panel-diff-view-model-lifetime.md`，原文含末尾换行SHA-256 `050e634fa37576f2686a2104e087eac6cebcbdf0223527f7ea36334d98a3083b`：

```markdown
源码固定 `5f4f2d132f972af871fb4451c82ef2ab6ee30e61` / src `7d43a2a5f2a74f0ef2a28976fe0067748a028cc1`，包括原44 Panel生产与Pane true-only预stub、仅新same-ref短期underlying resolver keepers；正式44代码peer C0/I1/M0中的I1修订仍待窄peer。共同factory源码尚未授权；修后真实旧default-false/独立true case、54矩阵与18生命周期结果须唯一lane另取，不预称green/implemented。
```

`dev/plans/sources-panel-fixture-preinjection-amendment.md`，原文含末尾换行SHA-256 `90de7255efab9d808dc02f979e718b06edb1ea87942b22a0d16bb99421c2b085`：

```markdown
> **当前阶段**：精确 d0 proposal 已经原 Astra 规则16 **C0/I0/M1**，root 全文与源链核验后采纳；本次是独立 accepted **文档**修订，已应用原 Panel §3.4 首段替换及唯一 Minor 的标题/链接导航改名。源码固定 `5f4f2d132f972af871fb4451c82ef2ab6ee30e61`，共同预stub源码仍须root核本accepted SHA后另授权，不把方案签收当业务通过。
```

### 共同预stub候选作者静态检查与未达边界

Pane测试AST `createSourceFile` parseDiagnostics=0，不建Program/semantic checker/transpile/emit；完整文件逐字还原检查表明唯一源码差异是获准的条件wrapper移除，helper/两test调用与旧patch声明相同。c7 Pane1/Panel70、ab43 Pane2/Panel73、e949 Pane2/Panel74调用逐个原字节，Panel.test全文件等于5f4/f5a，所以原54/18选择器不变。Pane测试 `eslint --no-cache` 实际exit0、0 errors / 0 warnings；`generate-docs-status.py --check` exit0；`check-docs-health.py --format json` exit0，601 Markdown / 0 errors / 46既有link warnings、现post-read/proposal主题warning0；`git diff --check` exit0。实际核对src只有Pane test单路径变化，Panel生产34142B/094f73d7…、Pane生产34365B/712520e3…、Panel.test189054B/ef287320…全等f5a；原Accept plan17436B/5d5c2a72…与原JSON2859B/fbf75cdb…原字节。Panel方案§1–§5与f5a合同完整相同，proposal原draft正文及accepted§5保持原字节；status200仅summary/首条变、旧首条及checkpoint前缀/全部历史raw均精确保留。Pane测试本候选13078B / SHA-256 `93d4b2f612e21212558c890f5a0cdb3c16b5fc657c47635f6e6a942dbac372fc`。仍是作者静态候选，不预写新窄peer或运行通过。

旧default-false原case proof `942d0652065d7aafe085d2e54a95c17bcd4f4c1c` 保持1/0/1 setup TypeError、业务red0；独立true input.dispose在run1同样setup失败/业务未达，二者身份与旧原件均不覆盖。固定新候选后root实核，再原Astra窄peer，最后才另释放唯一lane的两test旧生产资格run2；本作者不运行该资格或任何54/18业务，不typecheck/compile/emit/窗口/out/cache/freeze/push。两方案及窄修订仍accepted，不升implemented/PRD/D1387/宽Sources状态。


## 独立后续：Conversation可见叶 lease 恢复 draft

root 采纳原 Astra 对固定 a4a 的源码范围裁定后，仅授权 [Conversation 可见叶恢复 draft](../plans/conversation-visible-lease-recovery.md)。固定输入 `a4a70322795c509e8e9b8274cf295a1b65db663a` / `src=d78a48e5feee57fcaf5811c8425859d0a2400af0`，不追 main / WIP；当前 Sources lane 若报告源码 / fixture 问题，先响应原候选。本记录复用既有行动入口，不新建长期日志；上述 Sources 原历史、计划和 raw 原文不改，本段不是 Sources 当前验证资格的更新。

已查重 session-windows / bound-session / subscription-lifecycle / availability / unary-recovery：它们分别是窗口、身份、宿主订阅、readiness、响应座位的 SSOT，§24 保留候选，没有本窄对齐方案。新稿只提 Pane 的现 visibility 生命周期增加 roster session 通知，按当前 owner / bound / visible / suspended / 真实引擎live且非pairing / ready / 自身缺lease逐门核验后调用既有bind；不按event active id筛掉另一pinned visible叶，不改原reveal、KEEP或断连缓存。真实EditorParts→EditorService→Pane/Lens加真实EngineRoster、UA emitter、Deferred listSessions和session-view frame的主red及负控合同详见方案，不复制长期正文。local Git迟到notice后置。

本轮只有独立draft与相关索引/行动文档，源码树必须仍为d78a；没有源码/测试/out变更，没有typecheck/compile/emit/业务/窗口运行，不请求baseline接入DHEAD。固定docs commit后由root核路径/bytes，再交原Astra规则16；独立accepted与源码授权前不实施。原scope裁定不是Rule16通过，旧54/18无新运行结论；PRD/D1387/宽方案边界保持。

为保持status原200行，本轮只替换其summary与Current Session首条。固定a4a的旧summary与首条逐字保留如下；旧首条（含末尾换行）SHA-256 `f227340555a304d19a2ed3ae989d06fcd1c27ec4074397eaf63a6847151cfc60`：

```markdown
summary: "root核f5a后授权共同预stub最小test-only候选；只收Pane factory预注入if为一次无条件stub，旧默认/helper/resolver/cases及生产/Panel不变；5f4窄peer通过I1关，新候选待窄peer/唯一lane，out冻结。"
- **Sources 共同fixture预注入源码候选（2026-10-27）**：root精确核f5a accepted后明确授权，仅Pane测试factory旧helper前的同一connection预stub由if(resolveModels)收为无条件一次；default=false/resolver/helper正文/全部旧case/header/assert/patch逐字保，Panel.test与生产不动。5f4窄peer C0/I0/M0经父采纳、44 I1关闭；新共同预stub候选仅AST/lint/docs，待父核/原Astra窄peer，之后才由唯一lane另取旧default-false/true实际资格，旧setup失败/业务red0保持；18/54未新运行、out冻结。[候选与原首条](sources-accept-post-read-authorization-checkpoint.md#共同-factory-预stub-最小源码候选)。
```

### 独立draft作者文档检查

新plan为draft，17039 bytes / SHA-256 `f5b430ece9dc23e3065b60cc42d216be12ca3bc074113452f95494c09884bc8f`；本轮共8个文档路径，无生产/测试改动。`generate-docs-status.py`只生成新plan索引行的draft状态，随后`--check` exit0；`check-docs-health.py --format json`实际exit0，602 Markdown / 0 errors / 46既有link warnings，本轮8路径warning0；`git diff --check` exit0。固定a4a的全部src无diff，HEAD:src仍d78a；三个Sources方案与dispatch JSON全字节等于a4a，原54/18源码未动。checkpoint及board原全文是新文件的逐字前缀；status仍200行，仅第7行summary与第12行首条替换，旧两行在上方原样保留。没有typecheck/compile/emit/测试/窗口/out/cache/freeze操作。以上只是作者文档静态结果，未经过新plan Rule16或任何业务red/green。


## 独立accepted文档与规则16来源

固定draft `89d08368cf4f889e1a815f8670a0e2ffd7ea9911`，parent a4a / src d78a；plan Git blob `2903caa5a1b2684fc3cf83b1eb076573fc42d128`，17039 bytes / SHA-256 `f5b430ece9dc23e3065b60cc42d216be12ca3bc074113452f95494c09884bc8f`。root已逐8docs/path hash/全文/sourceTree/原三Sourcesplans+JSON/status200+a4a原首条独核，原Astra对该精确draft正式Rule16 C0/I0/M2，root采纳并仅授权本次accepted文档；审查身份、Strengths/Assessment与两Minor处置在[方案§6](../plans/conversation-visible-lease-recovery.md#6-规则16原审查与独立accepted文档)。不把原scope裁定代本次审查，不把本次方案门当源码/运行通过。

M1已改L2：真实live、pairing=false、同identity/active/bound的公开UA状态通知触发catalog refresh，整个引用身份窗口不送新frame；若有新frame只保lease身份和内容。L1真disconnect可合法清旧lease并取得缓存，不套KEEP身份合同。M2已写定源码资格链：自然loading缺lease之后分别发布disconnect/connected-pairing/connecting-pairing；Roster内部engine监听的QueueReader live→stale同步真实session通知，由Pane前后注册的公开observer在同次UA通知内夹住新增callback，晚于queue变化而早于Lens合法connection重绑。root独核Roster129–145/1745–1790与QueueReader34–54后接受该静态路径；实际夹具仍未运行，未形成独立missing窗口则资格未达，不以总acquire0/已有lease/hidden短路或改生产API造覆盖。

源码仍a4a/srcd78a，未修改/运行生产或测试；当前Sources run3由父及唯一lane按原资格推进，无新实现green，本作者未读其新proof原件或执行该运行，其结果不提供本lease资格。原54/18、三Sources方案/JSON、历史after及PRD/D1387/宽方案边界保持；不请求baseline接DHEAD，待root核本accepted SHA后另行决定源码授权。

status保持200行，本轮只替换89d的summary与Current Session首条；其原文如下（旧首条含末尾换行SHA-256 `d4992d34f986c69647dffbdd6b40a34249f26150d33313e736e0a7376a4cf1db`），a4a更早原首条仍在上节逐字保留：

```markdown
summary: "固定a4a/srcd78a仅写Conversation可见叶catalog-ready后缺lease恢复独立draft；复用Pane visibility生命周期、真实EditorParts/EngineRoster回归合同，待root核与原Astra规则16，未实施；当前Sources资格与out冻结保持。"
- **Conversation 可见叶 lease 恢复独立 draft（2026-10-27）**：原Astra新鲜源码裁定后，root仅授权固定a4a/srcd78a写[窄方案](../plans/conversation-visible-lease-recovery.md)：Pane现visibility生命周期内session通知只为当前存活bound且visible/未suspended/真实引擎live/catalog-ready/自身缺lease者补领；真实EditorParts→Pane/Lens＋EngineRoster/UA/Deferred/frame主red与负控合同待审查。未改源码/测试、未运行/写out，不请求baseline接DHEAD，待父核固定draft→原Astra规则16→独立accepted才另议实施；当前Sources问题优先，54/18、两Sourceplan/JSON及PRD/D1387/宽方案保持。[行动记录与原首条](sources-accept-post-read-authorization-checkpoint.md#独立后续conversation可见叶-lease-恢复-draft)。
```

### accepted文档作者检查

本次plan仅文档accepted，26461 bytes / SHA-256 `6602a6d3203fa324e97f946d711ab8d175f598efad3c414896960210307f0e68`；共8个主题文档路径，原89d draft SHA/blob/17039B与两段审查消息摘录保留。generated-status生成器只刷新新plan索引列，随后`--check` exit0；docs health实际exit0，602 Markdown / 0 errors / 46既有link warnings，本轮8路径warning0；`git diff --check` exit0。全部src无diff、HEAD:src仍d78a；三Sources方案及JSON逐字等于a4a，54/18测试源码未动。checkpoint/board的89d全文仍是本轮文件逐字前缀；status仍200行，只第7/12行变，89d原summary/首条及更早a4a原首条均原样保留。仅方案门及文档静态结果，不代源码peer、主red、新green或after，也不提供源码实施授权。


## E 可见叶lease最小源码候选（2026-10-27）

root 核独立 accepted ff55 后已另行明确授权 E 最小源码实施；上文“无源码授权”均保留其原签收时点，本节为当前候选状态。E 仅从干净 e7c246315db77aa8277775338522bb9a1cb8ff84 一次普通 ff-only 到 ff55db8937f08f116ad23e95b21fa071091b245f，再建未用分支 `fix/e-conversation-visible-lease-recovery-20261027`；不追 main、不复制工位、不动旧 out 或失败 checkout。原 accepted plan 26461B / SHA-256 `6602a6d3203fa324e97f946d711ab8d175f598efad3c414896960210307f0e68` 与 Rule16 原稿 / C0/I0/M2 摘录均由不可变对象保留。

候选只改 Pane 的现 visibility 生命周期 listener / import，以及现 Reveal 文件专用真实引擎夹具 / L1–L7 静态展开13条（先前进展14为计数误差），对应 fullTitle 与公开观察资格见[plan §7](../plans/conversation-visible-lease-recovery.md#7-e-最小源码候选与作者静态边界2026-10-27)。真实 Roster 先于 Pane；通过公开 UA / Deferred list / SessionView host frame 边界，保留 FrameSource 与实际 Pane lease / DOM；没有私填 lease / readiness、手动 bind / applyFrame 或修改事件顺序。L1 有 lease→自然 missing / same active0 / 自己 lease与正文pending，L3三个独立QueueReader回调窗口均只是已写断言，**实际夹具资格和业务结果待唯一lane**。L4另含真实公开prune后的removed非hidden与未挂载控制；L5清空/销毁/换input，L7双pinned各ownbound。

作者两TS `createSourceFile` parseDiagnostics0，不建Program/checker、不transpile/emit。两文件 no-cache ESLint 实际exit0，Pane0error/4个既有selector warnings、Reveal0/0；精确反向还原确认原26个test全文与默认QuietRoster路径保持，原生产syncLease正文/调用不变，全部src仅这两路径差异。三Sourcesplan和dispatch JSON与ff55完全同bytes/hash，故四Sources源码与原54/18 selector保持。out/.build/node_modules分别14865/416/47159项 metadata hash与ff前后相同：`25b6963a5ea5af29a6e9556a8c959ee65b8ab4a8566e48b031d8959265535601` / `f407a3fe5ef16c79808ea2ab1a74f6171c5d554374829d0427896e146cfc3ccb` / `fedada5fe2fcdb0b1ede2ee404c7cf27f02d839ad797f8d33eec1d1fe963d124`；路径按workspace-relative含root名，排atime。没有运行测试、UI、引擎或写out/cache/freeze。

本轮主题一并提交两TS与5份必要文档，plan仍accepted；源码peer、旧a4a主red、新矩阵green/原reveal回归、非作者after全部待，不提升PRD/D1387/宽方案，不借Sources运行或既有响应恢复局部结论外推。固定commit交root逐路径/bytes/hash核后再由原reviewer正式只读peer，不提前请求唯一lane运行。

### ff55 status 原summary与首条逐字保留

status只替换summary与Current Session首条、总行数仍200；ff55其余行逐字保持。原首条不含末尾换行SHA-256 `bc12ff2dc9c25b0dfdf46d2136a428f53d7d31f0bd3a7aaa3d59be7a0ac47651`：

```markdown
summary: "Conversation可见叶恢复89d经root逐8docs核与原Astra规则16 C0/I0/M2；持续live的KEEP及QueueReader真实公开事件采样两Minor已澄清，仅accepted文档/srcd78a，无源码授权及lease运行资格；Sources/out原门禁保持。"
- **Conversation 可见叶 lease 恢复方案签收（2026-10-27）**：root已核89d全8docs/hash/全文/srcd78a/原三Sourcesplan+JSON/status200，原Astra规则16 C0/I0/M2经父采纳；[窄方案](../plans/conversation-visible-lease-recovery.md)已澄清L2持续真实live同identity且无新frame的KEEP引用合同，以及自然missing→QueueReader真实session通知→同UA内早于Lens连接重绑的前后采样。仅独立accepted文档，未改源码/测试，lease主red/green/after未达、无源码授权、不请求baseline接DHEAD；54/18、PRD/D1387/宽方案及out保持。[审查来源与原首条](sources-accept-post-read-authorization-checkpoint.md#独立accepted文档与规则16来源)。
```

### E 作者静态原件与文档检查

`/tmp/vscode-e-visible-lease-static.json`保存两TS bytes/hash、createSourceFile诊断、原26 tests逐字保护、13个预期fullTitle与Source范围/保护检查；`/tmp/vscode-e-visible-lease-eslint.json`为实际no-cache lint原件，`/tmp/vscode-e-visible-lease-preservation.json`保存三目录metadata复核。`generate-docs-status.py --check`实际exit0；`check-docs-health.py --format json`实际exit0，E当前checkout扫描555 Markdown / 0 errors / 73 link warnings，5个theme docs warning0；对这5文件仅以内存read_text替换为ff55原文的只读基线检查结果与当前JSON逐字结构相同，没有新增warning。先前其他checkout的602/46历史数字不代本工位结果。`git diff --check`实际exit0；status200、只第7/12行变，checkpoint/board完整ff55前缀不变。以上均不代runtime资格。

本工位docs输入边界：脚本按现文件系统枚举`docs/**/*.md`与`dev/**/*.md`再加`AGENTS.md`，排除任一`archive/iterations/tmp/.git/node_modules/out`路径段；本轮无文档增删移，因此baseline overlay仅拦截上述5个changed Markdown的`Path.read_text`为ff55原文，不变更rglob/exists/is_file/link目标或其他输入。`git config`未列core.sparseCheckout/core.sparseCheckoutCone/extensions.worktreeConfig，`git sparse-checkout list`仅报告本工位非稀疏模式；未修复checkout或猜测扫描差异原因。可复核overlay脚本`/tmp/vscode-e-visible-lease-docs-overlay.py`、555路径bytes/hash输入清单`/tmp/vscode-e-visible-lease-docs-inputs.json`与current/baseline原始health JSON随固定候选manifest交root。


## E 新L4 dispose合同窄修订（2026-10-27）

root已独核固定5fd七path/mode/blob/bytesSHA/parent/src/clean、Sources四TS+三plan+JSON、原prefix/status200、8artifact与docs current==overlay；原Astra正式只读源码peer **C0/I1/M0**。I1仅新L4旧断言把普通Lens dispose误作清空lease字段：registered lifetime释放与Lens字段清空不是同一合同。root已独读对应source并采纳，明确授权本轮从clean5fd只修新L4测试与必要theme docs；完整Strengths/Critical/Important/Minor/Assessment、消息来源和静态边界见[plan§8](../plans/conversation-visible-lease-recovery.md#8-5fd-正式源码-peer-与新-l4-合同修订2026-10-27)。原正式结论保留，不提前宣称I1关闭或窄peer通过。

修订用现有公开接口记录实际Pane旧lease与其snapshot/frame计数；保留独立s2 observer使真实host在prune后仍有消费者，真实frame须到达observer而旧Pane lease不变，释放最后observer后再核公开SessionView.releaseLease记录。保留Lens disposed、leaf absent/not hidden/not visible、late bind0和surviving s1帧正控；不要求disposed Lens字段undefined，不手动dispose旧Pane lease，不改getter/FrameSource/生产API。root只读确认每consumer replica getter638–639、dispose695–702与notifyApplied617–625的源码依据，修法已获父采纳；**实际release与帧隔离仍未运行，L4 runtime=false**。L1/L3及其他矩阵获5fd静态peer未发现源码问题不等于运行资格。

相对5fd，反向以原L4完整call替回即可还原整个Reveal文件；其余12新case/原26/defaultQuiet保持，动态仍13。Pane15270B / SHA-256 `90c0719d26183f27ae8e4fbcbead63d6f7e6c4aef64c1bbc39a898a65b1501d3`与所有其他src全字节保护，Sources四TS/三plan/JSON不动；两TS仅createSourceFile parse0，本轮Reveal no-cache ESLint exit0/0error/0warning。新原件独立`/tmp/vscode-e-visible-lease-i1-*`，5fd artifact不覆盖。`generate-docs-status.py --check`实际exit0，docs health实际exit0：555 Markdown/0error/73 link warnings、5theme docs warning0；只对5changed Markdown内容以内存Path.read_text回映5fd的只读baseline overlay结果与current完全相同，脚本/输入规则沿原交付且独立命名，未新增warning。`git diff --check`实际exit0，status仍200且只第7/12行替换、5fd原summary/首条及其NoLF/LF hash下方保留；checkpoint/board原5fd全文保持前缀。

保护schema补明：三目录14865/416/47159为含各目录名前缀的后代entries，**不含root inode**；ff55旧首条NoNewline hash `bc12ff2dc9c25b0dfdf46d2136a428f53d7d31f0bd3a7aaa3d59be7a0ac47651`与含LF hash `9ea9515f78c69966800dfac437b0da8a212be6ba6d9a716480dcb4f5a5d94dc7`各有明确边界。root报告其两次初比不一致均为比较schema（root多一行、LF边界），随后正确schema独扫全匹配，不是作者漂移或实际门禁失败。root补核E全H=22250/skipWorktree0、commit内docs/dev tracked Markdown的FS missing0；不猜555与其他工位扫描差异原因，也不修checkout。

### 5fd status 原summary与首条保留

本轮仍只替summary与Current Session首条，status200；下列原首条NoNewline SHA-256 `52e6cefc90238051a3336369776227f1e3dd3e12973fd2d0a8ae748bc1184e9f`，含末尾LF SHA-256 `17a1ba817cd3c7e2eb27446ff3a3d45ae1dc27d91819065fc1b1a88903145ddd`。ff55更早原首条与其他历史保留在上文，5fd checkpoint/board原全文仍为本轮逐字前缀。

```markdown
summary: "root核ff55 accepted后另授权E可见叶lease最小源码候选：Pane原visibility listener与真实EngineRoster Reveal矩阵13条；仅AST/lint/保护检查，源码peer及旧red/新green/after待，Sources54/18/三plan/JSON/out保持。"
- **Conversation 可见叶 lease 恢复源码候选（2026-10-27）**：root核ff55独立accepted后另授权E一次ff-only/独立分支，仅Pane现visibility生命周期加同步session reconcile及现Reveal真实EngineRoster矩阵13条；当前owner/bound/visible/live/ready/自身missing逐门核，原hide/reveal/default QuietRoster与26 tests保。两TS AST0、no-cache lint0error/Pane4旧warning，L1自然missing与L3三QueueReader独立窗口只写断言未获runtime资格；固定commit待root核/原reviewer源码peer，唯一lane旧a4a主red/新green/原reveal与非作者after均待，plan仍accepted。Sources54/18、三plan/JSON、PRD/D1387/宽方案及out保持。[候选与原首条](sources-accept-post-read-authorization-checkpoint.md#e-可见叶lease最小源码候选2026-10-27)。
```

本轮固定commit先交root核再原Astra窄peer，无执行授权；plan仍accepted，不升PRD/旧波。无Program/checker/compile/transpile/emit/runtime/UI/engine/out/cache/freeze写，不把新静态候选或5fd静态Strengths当运行green。


## E 783窄peer静态签收（2026-10-27，纯文档）

root已独核78338484340843a91f2babbf8a690989a1790bdd六path、源码仅新L4块、mode/blob/bytes/hash、parent/src/clean、manifest及8artifact、status200/仅7、12行/旧raw含LF17a1…、board/checkpoint原prefix与后代metadata，正式接收固定静态候选；采纳原Astra对精确783窄peer **C0/I0/M0**，关闭5fd新L4测试合同I1。原5fd C0/I1/M0报告、修订及所有外部静态原件原样保留。原Strengths、C/I/M均0与Assessment来源见[plan§9](../plans/conversation-visible-lease-recovery.md#9-783-窄-peer-签收与下一门2026-10-27纯文档)：保留独立observer真实frame/snapshot正控时旧Pane lease snapshot/事件不变，最后observer释放host的同步源码链成立；L4外完整test字节/Pane不变，仍仅静态，不提供13case运行资格。

root报告其此次初扫曾以旧`entries`字段读新`descendantEntries`导致KeyError，改读新schema后精确通过；仅root读取器错误，不是作者产物漂移或守卫失败。后代计数不含root inode、路径含目录名前缀、排atime与LF/NoLF定义保持。同行既有历史不丢，当前来源独立不合merge。

本轮从clean783只更新4文档，源码仍783/src `eefc0c95737b4f66c4e9581a3500b2497a15d766`，Pane90c0719d…/Revealee287ba1…、原26/new13/defaultQuiet、全部其他src及Sources三plan/JSON不动。plan仍accepted，未升PRD/旧波；此纯文档不是formalmerge/green或outputs交付。唯一lane先完成既有Sources新源验证，之后才另行准备本lease旧a4a L1合格red/新13矩阵/原Reveal/非作者after，**全部runtimeObserved=false**。无本轮执行授权；不再AST/lint，不Program/checker/compile/transpile/emit/runtime/UI/engine/out/cache写。原tmp静态原件不覆盖，不建新证据目录、不复制out；后续lane证据入库再统一持久化必要manifest。

### 783 status 原summary与首条保留

本轮status仍200且仅替summary/Current Session首条。下列783原首条不含LF SHA-256 `c75b8eccd90e1027cd18c80eea5fa97e32692f32ba96b8b7e3bacf7e47338ecd`，含末尾LF SHA-256 `93f26c8fe6addfb1976a716ebfd8df7847d560975a782bc44ec2405f79855ec1`，原文（含换行）完整保留；更早原首条与hash继续留在上文。checkpoint/board的783原全文为本轮逐字前缀。

```markdown
summary: "5fd正式源码peer C0/I1/M0后，root另授权仅新L4 dispose合同修订：公开活observer帧/旧owner隔离与最后host release，不清生产字段；仅AST/lint待窄peer，Pane/其余12+原26/Sources/out保持，运行未达。"
- **Conversation 新L4 dispose合同修订候选（2026-10-27）**：root已核5fd七路径/原件与保护，原Astra正式源码peer C0/I1/M0；I1只因新L4误要求disposed Lens清lease字段，root采纳并另授权仅该case+必要docs。修订以实际旧Pane lease、prune后活observer接帧/旧owner不更新、最后observer释放host公开观察替代两错误断言，保leaf absent/非hidden/非visible、Lens disposed、latebind0与存活owner正控。两TS AST0、本轮Reveal no-cache lint0/0，其他12新case/原26/defaultQuiet及Pane完整保护、矩阵仍13；实际release/隔离runtime false，待root固定核/原Astra窄peer，无执行授权，plan仍accepted；Sources54/18/三planJSON、历史/out保持。[审查来源与原首条](sources-accept-post-read-authorization-checkpoint.md#e-新l4-dispose合同窄修订2026-10-27)。
```

本轮仅文档门禁：`generate-docs-status.py --check`实际exit0；docs health实际exit0，555 Markdown/0error/73既有link warnings，4theme docs warning0；只对这4文档read_text回映783原文的只读overlay结果与current完全相同。`git diff --check`实际exit0；原783设计正文与§8 I1报告不改，全部src/三个Sourcesplan/JSON无diff，status200且仅7/12行变、旧raw含LF完整保留，board/checkpoint原783全文前缀保持。未再AST/lint、未运行或写out/cache；固定纯doc SHA交root，不导入移动HEAD。


## E 新L4 checker收窄窄修订（2026-10-27）

root报告真实三路固定736171b1abc34e36e4991709240625827b566396/src `90d6092dbbca80114db7f55a75e137bb1d7bef76`后，唯一lane prep2首实际run的source checker因Reveal TS2339 `never`五诊断失败：1-based809 sessionId、818 onDidApplyFrame、829/836/850 snapshot；Pane无诊断，**无emit/测试，failed run已consumed不可重试**。原件由root转发：`/tmp/vscode-conversation-visible-lease-f33-validation-20261027-prep2/source-checker-report.json` 1353902B / SHA-256 `24789f8d0fb98af456d2dfaf4c9dbab2ee74145d4eeb73b3d436d62b13377ba3`，正式失败证据由baseline另交，本作者未执行/重试或触碰其工具/HEAD。原783/f33/I1报告与所有静态原件完整保留，不用本修订覆写失败。

root采纳原Astra只读裁定：原790/797/805的undefined断言对同lens字段收窄跨restore/await保留，原809/811读取根传播never。只获准在原809前公开重读`pane.activeConversationLens`为restoredLens、assert.ok并核与lens同对象，sessionId与retiredLease两处读取根改该变量，后者仍在原绘制await之后。原missing gates/其他L4字节、observer/frames/snapshot/最后release/latebind/存活owner正控与其他12新/原26/defaultQuiet不动；不加type测试、helper/cast/any/非空断言，不改生产或生命周期，父明确无需新plan amendment。来源/精确边界见[plan§10](../plans/conversation-visible-lease-recovery.md#10-实际-prep2-checker-阻断与新-l4-读取根窄修订2026-10-27)。

E已先核clean f33、Pane15270B/90c071…与Reveal80119B/ee287…；选择仍以f33作parent，不ff/复制同步至7361，不追主/WIP、不碰B。此baseline的三Sourcesplan/JSON原字节保，未导入或假称具有merge后来第四plan/52B stub；后续root三路保留其merge增量。精确逆还原新块即可还原整份f33 Reveal，整L4其余字节与其他case/default保持；全部其他src包括Pane完整保护，矩阵仍13。

改后只对Reveal一次createSourceFile AST-only诊断0、无Program/checker；Reveal `eslint --no-cache --no-fix`实际exit0/0error0warning，均显式NODE_DISABLE_COMPILE_CACHE=1，Pane不重复AST/lint。原件独立`/tmp/vscode-e-visible-lease-narrowing-static.json`与`/tmp/vscode-e-visible-lease-narrowing-eslint.json`，不覆盖旧静态原件；不把语法/lint0当checker通过。`generate-docs-status.py --check`实际exit0；docs health实际exit0、555 Markdown/0error/73既有link warnings、4theme docs warning0，4文档read_text回映f33的只读baseline overlay结果与current完全相同。`git diff --check`实际exit0；status200仅7/12行变、原f33首条含LF7cdd…与NoLF9ef4…下方保留，board/checkpoint原f33全文保持前缀。plan仍accepted，旧L1 red/新13矩阵/原Reveal/非作者after全部未达/runtimeObserved=false；待root固定核/原Astra窄peer，无新的checker/执行授权，不重试consumed run。

### f33 status 原summary与首条保留

status仍200、本轮只替summary与Current Session首条。f33原首条NoLF SHA-256 `9ef4c503894c29b719e0fb8f657aad6e69b425683b7f4ae5e8e484f180cd8186`，含LF SHA-256 `7cdd2c6b3354cb48030295dc4ed69571700b7848e755e2a74dc275fc7fa1875c`；原文含换行完整保留，board/checkpoint原f33全文仍为本轮逐字前缀，同行全部历史不丢。

```markdown
summary: "root独核783静态源码候选并采纳原Astra窄peer C0/I0/M0关闭5fd I1；本轮仅4docs签收，src eefc0c不变，13仅静态、全部运行/after待；plan accepted，非formalmerge/green/outputs，Sources/out保持。"
- **Conversation 783窄peer静态签收（2026-10-27）**：root已独核固定783/src eefc0c六路径与manifest/artifact、保护和status200，采纳原Astra窄peer C0/I0/M0，关闭5fd新L4合同I1；独立observer真实frame/旧owner snapshot与事件隔离、最后observer释放host的源码链获签，L4外test/Pane不变，原I1报告/原件保留。本次仅4docs记录，全部src仍783、原26/new13/defaultQuiet及Sources三plan/JSON/out保护；13仅静态case、旧a4a L1red/新矩阵/原Reveal/非作者after全部runtimeObserved=false，待唯一lane先完成Sources新源验证后另行准备，无执行授权，plan仍accepted；此纯doc不是formalmerge/green/outputs交付。[来源与原首条](sources-accept-post-read-authorization-checkpoint.md#e-783窄peer静态签收2026-10-27纯文档)。
```
