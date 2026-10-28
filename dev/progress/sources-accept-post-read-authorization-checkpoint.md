---
title: "Sources Accept 读后授权：方案作者检查点"
type: progress
status: active
phase: M7
updated: 2026-10-28
summary: "固定81723B/d470c316一行fixture A获原Astra源码C0/I0/M0/root采纳；整份逆证/全保护保，待root最终保护核与另授commit，tools/runtime未授。"
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

## 后续旧生产资格 run2：实际加载失败检查点

本节追加在原 draft / accepted 历史之后，不回写当时未运行的状态。root 固定 a4a 两test与独立窄peer后授权唯一 baseline lane 一次 run2：真实dry/emit精确2 test JS/0map、c7三生产连续资格与0写均通过，但三独立A4/Panel A3/原default-false均在runner导入 `out/test/unit/electron/index.js` 时失败，无Mocha reporter、业务red0/positive0；driver exit0仅编排恢复。36owned进程全部quiescent，finally两原bytes/mode/mtime、254+2pair、其余12552 files/2946 dirs/freeze4/cache3精确，仅2test ctime授权变化。[完整失败原件、源码归因与当前实际恢复基准](sources-accept-qualified-old-red-run2-20261027-evidence/INDEX.md)。

父级在2026-10-27T03:54:11.030512Z独立snapshot核全并签收原件，此为父通报摘要而非新造raw日志。后续只授权准备独立run3删除pre-entry user-data flag，未授权执行或正式合源；原dispatch JSON、accepted plan、旧run1/probe/R3结论与overall active保持。

## 后续旧生产资格 run3：独立 A4 业务旧红成立

本节追加真实run3资格，不回写旧历史。只删除run2 pre-entry user-data flag，固定a4a两test/三旧c7生产0写，真实dry/emit恰2JS/0map。独立input.dispose在live Pane/同input/read1后仍Apply1旧s1，唯一纯业务AssertionError；此例无refresh投影，不增报。Panel A3 body过后3VM/store/FunctionDisposable泄漏与console meta两hook败；跨run1/run3原4positive body累计到达，非clean4/4。原default-false header/body/assert字节保留，在共同factory已修的a4a fixture下1/1/0，旧c7 setup探针失败不改。完整原件与边界见[run3证据](sources-accept-qualified-old-red-run3-20261027-evidence/INDEX.md)。

root于2026-10-27T04:08:23.668980Z独立snapshot核全run3实际恢复基准、两native原bytes/mode/mtime、5stage logs和38owned quiescent；这里只作父通报，不造raw。finally两JS恢复、12552其它文件/2946目录、254+extra2/freeze4/cache3精确，仅两test授权ctime差；当前out重新冻结。只授权证据入库/scoped proofcommit，正式a4a真三路合源、checker/新生产/完整相关套与新green仍待父级另行明确授权，overall active。

<a id="a4a-formal-source-integration"></a>

## a4a 正式三路源码集成与双方 status 首条（2026-10-27）

root 接受 run3 proof `0165822eff368314d8fd0017e1137b56113e5bb5` 并于 `2026-10-27T04:17:26.163471Z` 独立只读复核实际run3恢复基准后，明确授权仅从该clean HEAD正式真三路接入固定 `a4a70322795c509e8e9b8274cf295a1b65db663a`，共同祖先 `5c0916b71070c5f75742fcbd831cd8c31be0bd34`。实际命令 `git merge --no-ff --no-commit a4a70322795c509e8e9b8274cf295a1b65db663a`；冲突只在progress INDEX/本检查点/status。INDEX保留incoming更新的作者入口与ours全部5个原件入口，本检查点双方新增历史段落原字节并存，status保留200行并以本次已合源/尚未新验证为当前首条。

四源码（Pane生产、Panel生产、Pane.test、Panel.test）逐path mode/type/blob完全等a4a，集成后src固定 `d78a48e5feee57fcaf5811c8425859d0a2400af0`。原Accept plan17436B/SHA `5d5c2a72fcb9d555b15d0442d0c7d47ae9238998cea2eb25b4b7917af8362e61` 与dispatch JSON2859B/SHA `fbf75cdbb5d197a2863dd654afe71a7ce71d78fb62668787514d3c98fa0ce028`、a4a Panel/fixture计划合同与全部旧证据均保留。incoming是精确a4a，后续lease draft属于另一scope，未接入。

这是源码集成授权，不是新的执行release。当前尚未source checker/compile/emit/新生产green或完整两宿主suite；完整outMetadata、freeze4/cache3仍逐项等实际run3恢复基准 `90f8cd36c22c0503061c8c6df9c1fe6654053043fad1b7857e80a62875955aa1`。旧native没有由新源编译；新4source身份、仍冻结旧native和4之外未变source/native分别记账。旧A1双业务红与run3 A4业务红、4positive body累计到达但Panel hooks仍红的资格及旧setup/load失败原件不升级、不改写。

以下完整保留这次两父提交的原status首条，均含末尾换行；精确hunk采纳、mode/type/blob矩阵及只读out守卫在随后的独立集成proof中持久化。父级独立核验时间只是父通报，不伪造另一份raw log。plan/PRD/旧波既定状态保持，overall active。

### ours 父 status 原首条

来源 `0165822eff368314d8fd0017e1137b56113e5bb5:dev/progress/status.md`，含末尾换行 SHA-256 `1c3564197481e459757f10d672203aa587811f95040c32e2f7f166787123f8da`。

```markdown
- **Sources Accept a4a旧生产资格run3（2026-10-27）**：仅修正runner入口参数，真实2test JS/0map/旧c7三生产0写；独立input.dispose在live Pane/同input下read1后仍Apply1，纯业务AssertionError成立；Panel A3 body过后3 VM资源泄漏+meta两hook败，原4阳性body累计到达而非干净4/4。共同factory修正后原default-false body1/1/0，旧c7 setup失败保留。38owned全退出，finally两JS原bytes/mode/mtime及其余12552文件/2946目录、254+2pair/freeze4/cache3精确，仅2ctime差。[原件/业务投影/当前恢复基准](sources-accept-qualified-old-red-run3-20261027-evidence/INDEX.md)；run2加载失败不改，未合源/新绿/升级plan，overall active。
```

### incoming 父 status 原首条

来源 `a4a70322795c509e8e9b8274cf295a1b65db663a:dev/progress/status.md`，含末尾换行 SHA-256 `f227340555a304d19a2ed3ae989d06fcd1c27ec4074397eaf63a6847151cfc60`。

```markdown
- **Sources 共同fixture预注入源码候选（2026-10-27）**：root精确核f5a accepted后明确授权，仅Pane测试factory旧helper前的同一connection预stub由if(resolveModels)收为无条件一次；default=false/resolver/helper正文/全部旧case/header/assert/patch逐字保，Panel.test与生产不动。5f4窄peer C0/I0/M0经父采纳、44 I1关闭；新共同预stub候选仅AST/lint/docs，待父核/原Astra窄peer，之后才由唯一lane另取旧default-false/true实际资格，旧setup失败/业务red0保持；18/54未新运行、out冻结。[候选与原首条](sources-accept-post-read-authorization-checkpoint.md#共同-factory-预stub-最小源码候选)。
```

## a4a 正式合源独立证明接入

真实双亲merge为`33b9b820701d7cfe20fe36fde56ba1ecfebbada4`（0165822、精确a4a7032），tree=`87e2ee5450e50e5edf34772bcfccafe62ce25109`、src=`d78a48e5feee57fcaf5811c8425859d0a2400af0`。[完整证明与只读重建/native守卫](sources-accept-a4a-formal-integration-20261027-evidence/INDEX.md)单独提交；原merge的冲突块外文字保持原样，此处proof追加、status摘要与证据链接是后续明确记录的文档更新。merge时继承的旧候选frontmatter摘要在proof中改为当前合源/待验证状态，原bytes与首条完整保留在proof-documentation-edits.json。root独核前后均不自动释放源码checker/compile/emit/test；native仍为run3冻结旧产物，未新green，overall active。

<a id="current-narrative-before-new-validation-preparation"></a>

## 当前叙述覆盖与下一轮仅准备（2026-10-27）

root已独立接收33b9/057c；本轮仅在overview、现看板和plan INDEX摘要增加当前覆盖说明并把旧作者阶段明标历史，原文仍在；三个Sources plan正文/JSON/source/旧证据不变，所有方案与产品状态不升。最终a4a原Astra窄peer C0/I0/M0已固定，run3共同factory下原default-false实测1/1/0与旧精确c7探针setup失败分列，新54/18完整suite未运行。下一轮只获准备五文件checker/ESLint/dry→emit与两官方完整Electron模块，executionAuthorized=false；不执行这些工具、不写out/cache/freeze。root本次读inventory误取run3字段mirroredArtifacts导致None，按本目录mirrors schema纠正后独立核验通过；这是父读取器schema错误的归属摘要，不是证据变化或伪造raw日志。

替换前`057c13494ce7ee28419d8908677c0cb65ef2f249:dev/progress/status.md`首条原文含末尾LF，SHA-256 `560e84aba57ba83d604b9750c131e63e9e7e2e153a48d2956dd083e66774cc17`：

```text
- **Sources Accept a4a正式真三路合源（2026-10-27）**：固定0165822/a4a7032/共同祖先5c0916，4源码mode/type/blob逐项等a4a，src=d78a48e5；Accept原plan/dispatch与Panel/fixture合同、双方证据入口/原status首条全部保留。当前尚未source checker/新compile/emit/新green/完整两宿主suite；native仍旧产物、out/freeze4/cache3逐项等run3实际恢复基准90f8cd，未称新源已编译。旧A1双红/run3 A4红与4正控body累计到达/Panel hooks红各保原边界。[集成检查点与双方原文](sources-accept-post-read-authorization-checkpoint.md#a4a-formal-source-integration)；待root独核后另释验证，plan/PRD/旧波不升，overall active。 [完整集成证据](sources-accept-a4a-formal-integration-20261027-evidence/INDEX.md)。
```

<a id="a4a-new-validation-actual-results"></a>

## a4a 新源码唯一一次实测与实际恢复基准（2026-10-27）

固定执行HEAD为`eefce63e1541625baa39a4abd1608fc3cdbb8c5b`、src=`d78a48e5feee57fcaf5811c8425859d0a2400af0`、sourceRef为精确a4a。前节“仅准备/未执行”是当时事实，不能再作当前结果。[本次独立原件目录](sources-accept-a4a-new-validation-20261027-evidence/INDEX.md)完整保留prep1静态C0/I2/M0阻断且未执行、原25文件与inventory/pins；prep2仅修6处LF转义和身份校验提前，纯语法5check实际exit0。修订工具经原Astra C0/I0/M0与root独核后，只释放一次真实执行；授权前release/inventory已sealed，原prepared inventory的旧release行只映射sealed original，不能指向后来active release。active release SHA `6922f196ad3762b903b5b2ea66ad21b51a1a010c0c7083793ef69e5a824d791c`已消费，禁止重跑。

实际项目上下文10316roots/11250Program文件，5目标syntactic/semantic与config/global/options、non-target syntactic均0；non-target semantic未请求，不称全项目语义干净。ESLint 0error/0fatal、1条Panel.test:636既有warning，cache/fix=false。真实createCompile/ESBuildTranspiler/streamToPromise dry与emit五份JS字节/SHA全同，3生产含未变controller+2test、0独立map。临时新输出只为本次验证，当前均已恢复旧native，`fullCompileOfFinalSourceTree=false`。

两个独立官方Electron完整module无grep：Conversation实际3tests/3passes/0fail/0pending；Panel实际142/141/1/0。全部72 unique fullTitle（54 Accept+18生命周期）在实际reporter中start/pass/end各1、pending/fail/missing/unknown均0；11/11与567/567 hooks无失败。唯一失败是旧`Sources diff panel superseded async render cannot paint an older file diff`：首严格相等断言actual空串、expected `stale-panel-b.ts`，后续断言未达；raw直接证明AssertionError，不把D/原Astra的旧fakeWidget缺新createViewModel静态解释写作运行诊断。完整Panel未绿、未修测试；单点夹具例外须另立docs-only方案并先规则16，不能借本次proof开实施。

32 unique owned PID/start全quiescent、6stage cleanup均完成、12 adopted reaps、0signals/0watchdog，kill分支未走。finally于`2026-10-27T05:08:24.020977Z`完成：5原JS bytes/mode/mtime精确恢复，只有5个ctime授权变化；其他12549文件/2946目录全metadata、256旧native bytes/mode、freeze4/cache3不变。root在`05:12:34.447518Z`独核当前15500 metadata等于新guard、32PID/start存活0；这里只记父通报，不伪造raw。新实际恢复guard SHA `8b5f45b3207be166685bc342025d899c3d237c955847681a41c4f1b9e48c4a04`是下一次适用metadata基准；原run3 `90f8cd…`不重写，二者仅精确5ctime不同，4新source/旧native与252未变pair继续分列。root最初raw事件名猜`test`，实读`testStart`纠正后核72通过，属于父读取器schema摘要，不是runner失败。

本次只持久化原件并做同主题proof/docs提交；三份Sources accepted plan正文、dispatch JSON、source与全部历史证据/inventory保护，未提升PRD/旧波，overall active。

替换前`eefce63e1541625baa39a4abd1608fc3cdbb8c5b:dev/progress/status.md`首条原文含末尾LF，SHA-256 `f3e833b8b08c28f3c5c49dc7a233cb9ce42b530b98c07fd56c2e6cb6979c7428`：

```markdown
- **Sources Accept 当前叙述同步与仅准备（2026-10-27）**：root已独立接收33b9真实双亲源码合并与057c证据；overview/并行看板/三plan索引摘要覆盖旧阶段待peer/未合/未到业务文字，保留全部历史原文。最终a4a窄peer C0/I0/M0、run3共同fixture下原default-false 1/1/0，旧c7探针setup失败不改；新54/18尚未完整运行。仅准备固定五文件checker/lint/dry→emit/两完整官方宿主与严格回滚，执行未授权，out/freeze/cache仍冻。原首条LF/hash与覆盖边界见[检查点](sources-accept-post-read-authorization-checkpoint.md#current-narrative-before-new-validation-preparation)，plan/PRD/旧波不升、overall active。
```


<a id="stale-render-stub-amendment-draft"></a>

## 旧 render stub 合同唯一例外 draft（2026-10-27）

root采纳作者与原Astra只读合同提案C0/I1/M0，仅授权新docs draft；不是本稿规则16，未授权stub实施/Program/checker/lint/compile/transpile/emit/runtime/UI/engine或out/cache/freeze。新[窄方案](../plans/sources-panel-stale-render-stub-amendment.md)保留prep2首title AssertionError与后三断言未达，明确缺createViewModel为静态解释；新54+18实际72全过不能代替完整Panel142/141/1或旧case修复资格。原件只读自`/tmp/vscode-sources-accept-a4a-new-validation-20261027-prep2/`，baseline正在独立proof入库，本作者不复制WIP/追HEAD。

### 独立分支与输出元数据守卫

切换前HEAD/`refs/heads/loop/D`均为`ff55db8937f08f116ad23e95b21fa071091b245f`，status、unstaged、staged均空；核前后src均`d78a48e5feee57fcaf5811c8425859d0a2400af0`。按root指定命令恰一次`rtk git switch -c fix/d-sources-stale-render-stub-amendment-20261027 eefce63e1541625baa39a4abd1608fc3cdbb8c5b`成功；新HEAD为固定eefce，原loop/D ref仍ff55。未reset/restore/stash/clean/重试checkout/迁缓存，不带入lease文档。

对本工位out/.build/node_modules分别递归lstat（不追symlink；含路径/type/mode/uid/gid/size/mtime_ns/ctime_ns/inode/dev/nlink/link target，不含atime）前后摘要精确相同：

| 根 | files / dirs / symlinks | 元数据SHA-256 |
| --- | --- | --- |
| `out` | 12129 / 2870 / 0 | `182d1edb2dde2184c404adfc5a328be177b7b43a4fa93b2f0b08c62183fe1a8b` |
| `.build` | 2537 / 213 / 1 | `0935283bb6362a78650afed1a82e1b86df5a1b54cece163f810a047e56b5f3d2` |
| `node_modules` | 40222 / 5876 / 111 | `a6d452d38dd033677570316d364f10b4dac0feb5bb305b23445ad79c11cc98c4` |

其中72个`.node`元数据摘要`cd69a85b014521cbc4ebfbae1e7de8947164fee90eae2e463f26247d7f708889`也不变；这是D工位元数据守卫，不是merge lane的native来源资格或新运行。当前3production/Pane.test/Panel.test及全部src对固定eefce保护；以下合同文件本draft亦不改：

| 路径 | bytes | SHA-256 |
| --- | --- | --- |
| `dev/plans/sources-accept-post-read-authorization.md` | 17436 | `5d5c2a72fcb9d555b15d0442d0c7d47ae9238998cea2eb25b4b7917af8362e61` |
| `dev/plans/sources-panel-diff-view-model-lifetime.md` | 20120 | `7b9104eb93d31062c7ae1a2504a0d8be38ff31ad44b3b4be9a92f5b9e3036536` |
| `dev/plans/sources-panel-fixture-preinjection-amendment.md` | 11980 | `583c430cfc3febb9dac8e96af1e40f25dc6bc256564cf492ce7d701dfbc65734` |
| `dev/progress/sources-accept-post-read-authorization-dispatch-checkpoint.json` | 2859 | `fbf75cdbb5d197a2863dd654afe71a7ce71d78fb62668787514d3c98fa0ce028` |

### displaced status 原首条（含末尾 LF）

来源`eefce63e1541625baa39a4abd1608fc3cdbb8c5b:dev/progress/status.md`；原首条711 bytes，SHA-256 `f3e833b8b08c28f3c5c49dc7a233cb9ce42b530b98c07fd56c2e6cb6979c7428`，含末尾LF，逐字保留如下。status仅替换summary与首条，仍200行；其余原行不改。

```text
- **Sources Accept 当前叙述同步与仅准备（2026-10-27）**：root已独立接收33b9真实双亲源码合并与057c证据；overview/并行看板/三plan索引摘要覆盖旧阶段待peer/未合/未到业务文字，保留全部历史原文。最终a4a窄peer C0/I0/M0、run3共同fixture下原default-false 1/1/0，旧c7探针setup失败不改；新54/18尚未完整运行。仅准备固定五文件checker/lint/dry→emit/两完整官方宿主与严格回滚，执行未授权，out/freeze/cache仍冻。原首条LF/hash与覆盖边界见[检查点](sources-accept-post-read-authorization-checkpoint.md#current-narrative-before-new-validation-preparation)，plan/PRD/旧波不升、overall active。
```

本检查点替换前frontmatter摘要（其余旧正文保留）：

```yaml
summary: "a4a已正式三路接入，保留作者候选/规则16与唯一lane历史；新source与冻结旧native分记，尚未checker/新green或升级产品。"
```

本docs draft检查：`generate-docs-status.py` exit0（already up to date）；`check-docs-health.py` exit0，608 Markdown / 0 errors / 46既有link warnings，本主题0；`git diff --check` exit0。只做文档门禁，不构成任何源码/运行资格。


<a id="stale-render-stub-amendment-accepted"></a>

## 旧 render stub 合同唯一例外 accepted（2026-10-27）

root独立核验精确draft `1dcd047bc0d7f5568eae496b61c644d98ed85732` 的7docs/parent eefce/src d78a/全部hash/status200/clean；原Astra正式规则16 C0/I0/M1。root采纳唯一Minor：生命周期现行合同同步不能可选，避免两份accepted合同矛盾。当前只授权独立docs-only accepted，源码/Program/checker/lint/compile/transpile/emit/test/UI/engine/out/cache/freeze仍未授权；不追baseline新proof HEAD或复制WIP。

本次严格将draft §3所提唯一blockquote段落（含原Markdown标记）追加于生命周期plan §5列表后、§6前；移除该唯一插入后须精确还原1d原文件，其他旧正文不改。原生命周期文件20120 bytes / SHA-256 `7b9104eb93d31062c7ae1a2504a0d8be38ff31ad44b3b4be9a92f5b9e3036536`；精确插入633 bytes / SHA-256 `4f3b7d48a8586f84f5b4c1eb3369df6ac27229f72c99aac82531e48673910337`（原段LF与分隔空行）；另两plan/JSON、全部src及旧证据继续保护。原Astra认可的单行toDisposable/唯一holder-local owner、原4断言/gate/timing/72与免额外old-c7兼容run设计不变；此accepted不代表stub已补或旧case已过。

### 生命周期精确追加内容

```markdown
> **旧 stub 合同唯一例外**：仅 `Sources diff panel superseded async render cannot paint an older file diff` 的本地 `fakeWidget` 允许新增 `createViewModel: () => toDisposable(() => { }),`。本段仅对 §3.4 与 §5 第 2 条的旧 case 字节保护放行这一个成员；原标题/header/四条断言/timing/gate/show/ref/render wrapper/finally 及其余字节、其他 cases/helpers、54+18 和生产合同保持。VM 由现有 Panel holder/local 唯一拥有；原 prep2 失败保留，修复结果另取实际证据。具体边界见 [旧 render stub 窄修订](sources-panel-stale-render-stub-amendment.md)。
```

### displaced draft status 原首条（含末尾 LF）

来源`1dcd047bc0d7f5568eae496b61c644d98ed85732:dev/progress/status.md`；原首条706 bytes，SHA-256 `ed3f49e5174df97ea2eeb6c927eb38014613c3e44b4fb1b65ab2eea7b46e2822`，含末尾LF，逐字保留如下；status只改summary/首条，仍200行：

```text
- **Sources 旧render stub合同窄修订draft（2026-10-27）**：prep2唯一lane新54+18实际72个各start/end/pass1、hook0；完整Pane3/3/0、Panel142/141/1，唯一旧case首title空断言败、后三条未达；缺createViewModel仅静态解释，不冒充caught TypeError。独立Sources分支只写[单case单成员例外提案](../plans/sources-panel-stale-render-stub-amendment.md)，三旧plan/JSON/全部src保护；待原Astra规则16/root采纳/独立accepted后另发源码与唯一lane授权，未实施或重跑。原首条LF/hash及工位元数据守卫见[检查点](sources-accept-post-read-authorization-checkpoint.md#stale-render-stub-amendment-draft)，plan/产品/旧波不升。
```

本检查点替换前frontmatter摘要（旧正文保留）：

```yaml
summary: "prep2新72实际全过、完整Panel仍旧case1败；Sources独立分支只交stub合同唯一例外draft，原首条/三旧plan/JSON/source与native元数据保护。"
```

本accepted文档门禁：status生成仅同步本amendment的accepted列；最终docs health exit0，608 Markdown / 0 errors / 46既有link warnings / 本主题0，diff-check0。D工位out/.build/node_modules及72个.node元数据继续精确等draft前基线；不构成merge native来源或业务资格。


<a id="stale-render-stub-single-line-candidate"></a>

## 旧 render stub 唯一单行源码候选（2026-10-27）

root独核接收b0 accepted的exact8docs/parent1d/src d78a/FS/hash、生命周期精确633B插入与两plan/JSON保护、status200/原首条LF/hash和clean；之后另明确授权仅指定旧case fakeWidget加一行，不借docs accepted自行实施。root原位置reader假设错误已用draft原段逐字remove纠正，非作者修改。本候选严格以b0为parent，不追新proof或复制WIP，方案accepted/设计保持，现行生命周期不再改。

唯一TS新增52 bytes（含缩进/末尾LF）；文件由189054B/SHA-256 `ef28732018c703848be327f384aa3edaeabd2e3d8b4fb1e890f168c443596967` 变为189106B/SHA-256 `414409d77aa0079fbe0fcc61eabb4be61a075bfc85ec392e83530e5aedafaaa6`。删除该唯一行逐字还原整个b0测试文件；其余TS字节、三production、Pane.test、其他case/helper/新72、原4断言/gate/show/ref/timing/wrapper/finally全部保护。生命周期/Accept/共同fixture三个现行plan、dispatch JSON及旧证据全字节不改。

```diff
 const fakeWidget = {
+    createViewModel: () => toDisposable(() => { }),
     setModel: () => { },
```

上方只展示diff语义，实际缩进为原对象4个tab、只新增一条成员；精确patch由固定Git对象交父核。待root核候选SHA/全部路径身份及原Astra窄source peer；唯一lane的新固定输入检查/精确emit/完整两个官方模块仍需另释。本次连AST/lint都不运行，仅docs门禁；不Program/checker/compile/transpile/emit/test/UI/engine/out/cache/freeze，不push。原prep2新72各start/end/pass1与完整Pane3/3/0、Panel142/141/1、旧首title AssertionError/后三未达保持，不预称修复已过。

### displaced accepted status 原首条（含末尾LF）

来源`b0e5377996c1a167b5b02d56cbd3699cae423a78:dev/progress/status.md`；原首条692 bytes/SHA-256 `79ec17014f45b719afd9a3179ea7e7f2e1e4b4fceaff166c4a39aafc2f204ee4`，含末尾LF逐字保留；status仅summary/首条变，仍200行：

```text
- **Sources 旧render stub合同窄修订accepted（2026-10-27）**：root独核1d draft七docs/parent/source/status200，原Astra规则16 C0/I0/M1；采纳唯一Minor，已在生命周期plan §5后/§6前精确追加单case单成员例外，其他正文及Accept/共同fixture/JSON/src保护。仅[文档accepted](../plans/sources-panel-stale-render-stub-amendment.md)，一行stub源码/peer/唯一lane复验仍须另授权；prep2新72全过与完整Panel142/141/1、旧首title败/后三未达保持。原首条LF/hash及精确patch见[检查点](sources-accept-post-read-authorization-checkpoint.md#stale-render-stub-amendment-accepted)，不升级产品/旧波，未实施或运行。
```

本检查点替换前frontmatter摘要（旧正文保留）：

```yaml
summary: "旧render stub合同唯一成员例外经规则16/root采纳后仅docs accepted，生命周期仅精确追加一段；原首条/其他合同/source与输出守卫保护。"
```

本单行候选仅docs门禁：generator exit0/already up to date；health608 Markdown/0 errors/46既有links warnings/主题0，diff-check0。仅文本字节/路径保护核验，不含AST/lint/Program或业务执行；out/.build/node_modules与72.node元数据继续等切分支前基线。

<a id="stale-render-6d-formal-integration"></a>

## 6d 唯一旧 stub 行正式三路接入（2026-10-27）

root独核接收`8438ef3f197367a493ab48232012c5a37c64f797`全部170路径与一次实测/恢复proof后，独立接收b0 accepted合同与固定`6d848eacc578dea0c5c6f39721b00047f9c12469`；原Astra对该精确source窄peer C0/I0/M0，root采纳，才明确授权本次真实双亲合入。共同祖先固定`eefce63e1541625baa39a4abd1608fc3cdbb8c5b`，不追D HEAD或接入lease。源码为`4243970658ddd668d1f89e0a97d7f41ba94d3300`，恰旧Panel.test单个fakeWidget新增52B行；三production/Pane.test与其余src逐字不变。新amendment与lifecycle的唯一633B例外精确取incoming；另两plan/dispatch与全部旧证据保留。

上方8438实测与D draft/accepted/单行候选追加段均按原bytes保留，不能将其中历史“未peer/未合”当当前。8438的新54+18实际通过与完整Panel旧1败/后三断言未达仍是唯一运行结果；本次只有source/docs合入，未Program/checker/lint/compile/transpile/emit/test/UI/engine，也未准备或释放新执行release。15500 out metadata仍精确实际恢复基准`8b5f45b3207be166685bc342025d899c3d237c955847681a41c4f1b9e48c4a04`、256旧native/freeze4/cache3不变；仅Panel.test新source映射改为6d，不能把native称fresh。原run3 90f8cd旧ctime/source断言不再无例外适用，`fullCompileOfFinalSourceTree=false`。

root采纳原Astra条件性最小验收边界：以后另获授权的固定5目标checker/noEmit、no-cache/no-fix lint、5JS dry=emit、完整Pane3/Panel142（旧stale四原assert均到达通过）、72逐名/hooks/meta/pending/missing/owned/finally恢复全部合格且root核原件后，本窄scope不额外要求default-editor after或未改controller suite；只签source/真实组件合同，不称实端Git索引/UI after已验。当前未执行这些检查，四窄plan均accepted、PRD/宽Sources/D1387旧签收/旧波保持。

root曾把cache symlink target放入metadata整字典比较而AssertionError，按target独立字段schema纠正后metadata全等；另有插入offset读取纠正。这些是父读取器纠正归属摘要，不是runner失败、证据或native变化。

### 双亲 displaced status 首条（含原末尾LF）

来源`8438ef3f197367a493ab48232012c5a37c64f797:dev/progress/status.md`，865B，SHA-256 `1f42bdc2bbcc12d726dde0bc7d1d02edeae391fade7c3c4ee248872e0050c683`：

```markdown
- **Sources Accept a4a一次实测与恢复（2026-10-27）**：prep1静态C0/I2阻断未执行；修订prep2经原Astra C0/I0/M0与root仅一次释放，项目上下文5目标checker0/noEmit、lint0error/1旧warning，真实dry/emit恰5JS/0map；官方完整Pane3/3过、Panel142/141过1旧stale用例首断言败。新54 Accept+18生命周期逐名start/pass/end各1、无pending/hooks败，不能称完整Panel绿。32owned全退出，finally5JS旧bytes/mode/mtime恢复、仅5ctime授权差；其余12549文件/2946目录、256旧native/freeze4/cache3精确，当前新恢复基准8b5f45、fullCompile=false。[原件与恢复边界](sources-accept-a4a-new-validation-20261027-evidence/INDEX.md)；原首条LF/hash见[检查点](sources-accept-post-read-authorization-checkpoint.md#a4a-new-validation-actual-results)，不升plan/PRD/旧波，overall active。
```

来源`6d848eacc578dea0c5c6f39721b00047f9c12469:dev/progress/status.md`，776B，SHA-256 `4a7d684bb63dc3e732ba885fd75995a692d23137c1c97c34f533c956d473786f`：

```markdown
- **Sources 旧render stub单行源码候选（2026-10-27）**：root独核b0 accepted后另授权，仅指定旧case fakeWidget新增createViewModel→toDisposable一行；删除即逐字还原原test，其余TS/三production/Pane.test/新72/原4断言与时序全保。现行lifecycle/另两plan/JSON不再改；[方案accepted设计保持](../plans/sources-panel-stale-render-stub-amendment.md#7-b0核验后的唯一单行源码候选)，待父核与原Astra窄source peer，唯一lane检查/emit/完整两模块另释。仅docs门禁、无AST/lint/业务或out写；原prep2 Panel142/141/1不改，未称修复已过。原首条LF/hash见[检查点](sources-accept-post-read-authorization-checkpoint.md#stale-render-stub-single-line-candidate)，不升级产品/旧波。
```

## 3029 固定6d合源独立proof接入

正式merge为`3029d800e3941130dd62a3a8e85deb33c3fff848`，双亲依次`8438ef3f197367a493ab48232012c5a37c64f797`与`6d848eacc578dea0c5c6f39721b00047f9c12469`，共同祖先eefce；tree=`b169bcc0ad8e3f364d9cd24c1021c54afe1e0e92`，src=`4243970658ddd668d1f89e0a97d7f41ba94d3300`。[独立证明/原始冲突与canonical解法/只读native守卫](sources-stale-render-6d-formal-integration-20261027-evidence/INDEX.md)单独提交，175union/171无争议项及22522外项精确保留，四docs七块外fragment保持原bytes顺序。source merge的冲突外片段不回写；本节及当前入口为随后proof明确记录的docs更新。新amendment/lifecycle精确incoming，两旧plan/JSON/source与8438原件不改。

合源前/候选tree/提交后只读guard均为15500metadata精确8b5f45实际恢复基准，256旧native/freeze4/cache3全等；Panel.test source单独更新为6d blob `1eb53d2f64343c465b02bebb99724b9a76a35561`、SHA `414409d77aa0079fbe0fcc61eabb4be61a075bfc85ec392e83530e5aedafaaa6`，native仍旧。root对8438最终170path scoped检查与审计schema纠正、固定6d source peer C0/I0/M0与条件性窄验收的采纳均为归属摘要，不伪造raw。无新checker/emit/test/Program/UI、无新release准备；原72pass和完整Panel旧1败仍为最新实际结果，四窄plan仍accepted、整体目标active。

proof前`3029d800e3941130dd62a3a8e85deb33c3fff848:dev/progress/status.md`首条含末尾LF，SHA-256 `45a7bf09845358bd601a9696fb66a6a6a48788d205419a1af2d4adf4d3bb7cf6`：

```markdown
- **Sources 旧stale stub精确三路接入（2026-10-27）**：8438一次实测/失败proof保全：新54+18逐名过、完整Pane3/3、Panel142/141过1旧stale首断言败，后三条未达。固定6d仅旧fakeWidget新增52B createViewModel→toDisposable行，另案b0 accepted与原Astra source peer C0/I0/M0经root采纳；正式三路保双亲/共同eefce，src424397。当前未做新checker/emit/完整套复验，不称旧case已绿；15500metadata精确8b5f45、256旧native/freeze4/cache3不变，fullCompile=false。双方首条LF/hash与追加历史保[检查点](sources-accept-post-read-authorization-checkpoint.md#stale-render-6d-formal-integration)，[8438原件](sources-accept-a4a-new-validation-20261027-evidence/INDEX.md)不改；四窄plan仍accepted，PRD/宽Sources/旧波不升，无新release准备或执行授权。
```

## fixed-6d-new-validation-accepted

root独立验收固定HEAD01c0/source6d/src424397的一次[新验证](sources-stale-render-6d-new-validation-20261027-evidence/INDEX.md)：六stage全0，新72逐名与完整Pane3/3、Panel142/142及旧stale本体通过；meta/hooks/owned/finally全部符合已审合同。原Astra prep1工具peer C0/I0/M1、四镜像行号机械修订及prep2窄peer C0/I0/M0、root激活/下一条另释单次执行分列原件；release已消费。当前metadata基准为新guard54fe37，旧native256/freeze4/cache3恢复、fullCompile=false。只签四窄plan/source真实组件为implemented，窄board完成；其他PRD/宽Sources/D/旧波与overall active保持，不声称实端Git索引/UI after/全srcsemantic或fullcompile已验。

本次收尾仍未再运行任何Program/AST/lint/checker/compile/transpile/emit/test/UI/engine，不准备lease。旧A1/run3A4/default-false及8438失败原件均保留。以下为父01c0当前status原首条，保留943B含末尾LF，SHA-256 `5c2d9469209c190af6c1c085035a4f69031663ab806c0d51a0f6216888b486fe`；[原字节](sources-stale-render-6d-new-validation-20261027-evidence/parent-status-first-entry.txt)独立保存：

```text
- **Sources 旧stale stub精确三路接入（2026-10-27）**：8438一次实测/失败proof保全：新54+18逐名过、完整Pane3/3、Panel142/141过1旧stale首断言败，后三条未达。固定6d仅旧fakeWidget新增52B createViewModel→toDisposable行，另案b0 accepted与原Astra source peer C0/I0/M0经root采纳；正式三路保双亲/共同eefce，src424397。当前未做新checker/emit/完整套复验，不称旧case已绿；15500metadata精确8b5f45、256旧native/freeze4/cache3不变，fullCompile=false。双方首条LF/hash与追加历史保[检查点](sources-accept-post-read-authorization-checkpoint.md#stale-render-6d-formal-integration)，[8438原件](sources-accept-a4a-new-validation-20261027-evidence/INDEX.md)不改；四窄plan仍accepted，PRD/宽Sources/旧波不升，无新release准备或执行授权。 [3029正式合源证明](sources-stale-render-6d-formal-integration-20261027-evidence/INDEX.md)。
```


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

## sources-lease-f33-formal-integration

本节是固定a4eb与f33/共同a4a的真实三路集成记录，双方各自已有历史原文并存。Sources四窄方案已由root核固定6d一次green后implemented，52B stub与旧新证据保持；Conversation可见叶lease固定783源码窄peer C0/I0/M0、I1关闭经root采纳，f33文档accepted与两lease源码正式接入，仍未获任何新checker/emit/test/after或工具准备授权。旧native256/freeze4/cache3与15500metadata精确54fe实际恢复基准，fullCompile=false；本集成不升级lease计划/PRD/宽Sources/旧波，overall active。合后源码树与全路径审计及独立proof待固定实际merge对象后追加，不把root预判当实际树。

以下完整保留双方父status原首条，各含原末尾LF；scope覆盖按Sources已验与lease待验分开：

### ours 父 status 原首条

来源 `a4eb1dc3e94b9240e6124ccd37e219801fc1aeb9`，986 bytes含LF / SHA-256 `17c10ac71aef43363a4d4fd69c6c525fcc852e5bf510033c58b8a87c88ae0f27`。

```text
- **Sources固定6d一次green与四窄方案签收（2026-10-27）**：父01c0/src424397，prep1原M1四行号镜像/false原稿保，prep2机械修订获原Astra C0/I0/M0/root采纳后唯一release单次消费。checker五目标noEmit全0、lint0error/1旧637 warning、dry=actual5JS/0map；新54+18逐名start/pass/end各1，完整Pane3/3、Panel142/142含旧stale本体，meta各1/hooks11/567平衡、pending/missing/unknown/fail0。root独核145实际body与43owned活0；finally旧native256/freeze4/cache3精确、15500metadata新基准54fe37（对8b5f仅5ctime），fullCompile=false。仅四窄plan implemented/窄board完成，原A1/run3A4/defaultfalse/8438旧败不改，PRD/宽Sources/D旧签收/旧波不升、overall active；不声称实端Git/UI after或全srcsemantic。[原件/验收/范围](sources-stale-render-6d-new-validation-20261027-evidence/INDEX.md)·[原首条LF/hash](sources-accept-post-read-authorization-checkpoint.md#fixed-6d-new-validation-accepted)。
```

### incoming 父 status 原首条

来源 `f33d16fbc5841119f5baa7ff2788060d39b8bb4f`，821 bytes含LF / SHA-256 `7cdd2c6b3354cb48030295dc4ed69571700b7848e755e2a74dc275fc7fa1875c`。

```text
- **Conversation 783窄peer静态签收（2026-10-27）**：root已独核固定783/src eefc0c六路径与manifest/artifact、保护和status200，采纳原Astra窄peer C0/I0/M0，关闭5fd新L4合同I1；独立observer真实frame/旧owner snapshot与事件隔离、最后observer释放host的源码链获签，L4外test/Pane不变，原I1报告/原件保留。本次仅4docs记录，全部src仍783、原26/new13/defaultQuiet及Sources三plan/JSON/out保护；13仅静态case、旧a4a L1red/新矩阵/原Reveal/非作者after全部runtimeObserved=false，待唯一lane先完成Sources新源验证后另行准备，无执行授权，plan仍accepted；此纯doc不是formalmerge/green/outputs交付。[来源与原首条](sources-accept-post-read-authorization-checkpoint.md#e-783窄peer静态签收2026-10-27纯文档)。
```

## f33-merge-proof-current-coverage

root已独立接受真实merge `5336c7f82565eb15de5aad3a125ab66cabdc1807`：parents固定a4eb/f33、basea4a、tree443af426、实际src90d609；793union/788无争议mode-type-blob/外22232全部核实，四冲突文件5canonical块与外fragment逐字重放等正式blob，board自动0块另记。[独立proof](sources-lease-f33-formal-integration-20261027-evidence/INDEX.md)完整保三方/actual/canonical/resolved原bytes。Sources四窄implemented保持；lease完整incoming accepted且sourcepeer C0/I0/M0采纳，不由合源获得运行资格。当前source/native guard将256重绑为Sources4+Pane1共5 mismatches与251未变，Reveal旧JS另列；15500metadata仍精确54fe、旧native256/freeze4/cache3未动/fullCompile=false。只修过时89d/docs-only/d78a当前导航与board Sources历史覆盖范围，原设计/规则16/源码peer/失败历史不改，未准备或运行任何lease工具。

以下是5336收尾前status首条，含末尾LF SHA-256 `277d1f969d91fc37c19470b2dbeaa3097d1cebd032aaca6c33e1c74090315a8b`，原789 bytes另存proof；a4eb/f33双方原首条继续按前节原字节保护。

```text
- **Sources完成与Conversation lease固定f33真三路接入（2026-10-27）**：固定ours a4eb/incoming f33/共同a4a；Sources新72及完整3/142/旧stale一次green和四窄implemented、52B stub/全部旧新原件保持；lease两源码783静态peer C0/I0/M0/I1关经root采纳，f33文档accepted接入，13只静态、旧red/新green/原Reveal/非作者after全待，尚无新工具准备或执行release。全path/src树按实际merge审计，15500metadata精确54fe、旧native256/freeze4/cache3未动/fullCompile=false。共享docs双方历史、首条LF/hash并存，PRD/宽Sources/旧波不升/overall active；不碰B仅objects、不追main WIP。[双方原首条与集成边界](sources-accept-post-read-authorization-checkpoint.md#sources-lease-f33-formal-integration)。
```


## lease-first-checker-failure-current-coverage

固定f33已由5336真三路合入，父736171b1/src90d609；prep1工具peer C0/I1/M0修订后，prep2静态peer C0/I0/M0获root采纳并单次release。实际driver/checker均exit1：Pane语法/语义0，Reveal语义5条TS2339；lint/dry/两次emit/旧L1+meta/完整Reveal均未到达，业务red、新矩阵green、meta/hooks与非作者after未运行。两JS无写入/恢复范围空，15500 metadata仍54fe；lease accepted、overall active，fullCompile=false。完整原件与归因见[首次失败证据](conversation-visible-lease-first-checker-failure-20261027-evidence/INDEX.md)。本节覆盖上方历史未准备/未release叙述；上方所有历史（含f33-merge-proof-current-coverage）原字节保留。

prep1 52文件、原工具peer C0/I1/M0/root采纳；prep2原109文件包（108 inventory rows/self除外）经I1窄修及原Astra frozen-runtime/final-package静态peer C0/I0/M0/root采纳。原sealing reader runtime-* glob AssertionError和静态metadata迁移原bytes/mode保留，不作产品失败。另行授权只改release四字段，原false release/inventory/pins封在prepared-state，active后另获“运行driver一次”，一次消费后checker失败停止、不重试。prep1 52+prep2当前122共174镜像逐字/模式/SHA/Git blob入库，原inventory不改写为active。

5条TS2339一基位置809:46、818:27、829:41、836:37、850:36；Pane语法/语义0、Reveal语法0/语义5，实际src项目10316roots/11250files，非目标语义未请求，noEmit/无emit调用/禁止写尝试0/fullCompile=false。其余lint、dry、emitReveal、old-L1+meta、emitPane、fullReveal未到；无业务red/green/title/meta/hooks/after结果。completed/uncertain/journal/restore/ctime差异全空，两原JS bytes/mode/mtime/ctime精确，native256/额外Reveal/freeze4/cache3及15500 metadata54fe精确，8个实际采样owned PID/start已停。原Astra/root指出新L4 undefined窄化，下一作者test-only restoredLens意见仅署名记录，本lane未修补/接新候选。

### 父736171b1的status原首条（含末尾LF）

原件[parent-status-first-entry.txt](conversation-visible-lease-first-checker-failure-20261027-evidence/parent-status-first-entry.txt)，884 bytes，SHA-256 `7e80f37f9f68fea5ebc18939fe0c0ed3c1a198e6f627e44005ff76808b8bede0`，来源`736171b1abc34e36e4991709240625827b566396`。以下围栏不替代raw末尾LF：

```text
- **Sources已验基线与Conversation lease正式合源（2026-10-27）**：5336真实双亲a4eb/f33/共同a4a，实际src90d609；793union中788无争议mode/type/blob与外22232精确，四文档5块逐块重建，board自动merge另记，checkpoint双方尾/原首条LF/hash并存，status200。Sources四窄implemented/52B stub/旧新证据保持，lease783 sourcepeer C0/I0/M0/I1关经root采纳、候选两源码精确incoming/plan accepted，13仅静态/所有red-green-Reveal-after待。15500metadata仍54fe、旧native256/freeze4/cache3不变；256内5新source/旧native+251未变、Reveal原JS单列无producer credit，fullCompile=false。只集成/proof/docs，无新工具准备或执行release、不碰B对象工位/主WIP；PRD/宽Sources/旧波不升/overall active。[三路原件与当前覆盖](sources-lease-f33-formal-integration-20261027-evidence/INDEX.md)。
```


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


## d8e-narrowing-merge-current-coverage

固定d8e新L4公开重读/sameLens窄修经原Astra C0/I0/M0/root采纳，以0ef352真双亲接入14e，当前src62996b35；仅Reveal80259B/110f7f…变更，Pane及其他src/Sources四窄implemented保持。7361首次checker五条TS2339失败与consumed原件不改；新checker、业务red/新13矩阵/完整Reveal/非作者after均待，尚无新prep或执行release。15500 metadata仍54fe、native256及额外Reveal旧JS/freeze4/cache3精确，lease accepted/overall active、fullCompile=false。[固定三方/canonical块/实际与prospective tree证明](conversation-visible-lease-narrowing-d8e-formal-integration-20261027-evidence/INDEX.md)保1104 union、1100无争议、外22233及所有5block。只有Reveal取incoming，生产Pane与其余src/Sources四plan/52Bstub/全部旧新evidence取ours；两尾（首次失败出版与E§10）及board/checkpoint双方历史原字节保持。

作者E只一次AST-only/no-cache-no-fix lint，原件固定bytes/hash入新proof，未由本lane重跑；E manifest的.build比较实际exit1（tool16c9eb），preservation/delivery未生成。旧guard仅aggregate：416/f407a3…与末次两扫描416/787cf7…不同；当前log2B/4f53…两ns1793082885390322213早于7361 commit。无原逐项tuple或任务初始快照，不能复原完整差异路径集合或归因actor；E工位与merge15500/54fe完全分开，源码正反变换可独立成立。旧checker失败/consumed不改，不准备或运行任何新checker/emit/业务/after。

### ours status 原首条（含LF）

来源`14e20696554e60c820863c0e79a70fa0ac2ad499`，890B/SHA-256 `a30c2825fb9e2ec72a9584ae875bf4922669514d8fe6289a500ffa95aa2c6579`；[raw](conversation-visible-lease-narrowing-d8e-formal-integration-20261027-evidence/ours-status-first-entry.txt)。

```text
- **Conversation lease首次checker失败（2026-10-27）**：父736171b1/src90d609、固定f33；prep1工具peer I1/原52文件保，prep2原109文件经C0/I0/M0/root采纳，false原稿封存、四字段激活后一次消费。driver/checker实际exit1，Pane语法/语义0、Reveal新L4语义5条TS2339；实际项目10316roots/11250files但非目标语义未请求，noEmit/无emit/禁止写0。lint/dry/emitReveal/旧L1+meta/emitPane/完整Reveal均未到，业务red/新green/title/meta/hooks/非作者after未运行。两JS未写/completed与uncertain及restore均空，8owned已停；15500metadata54fe/native256/额外Reveal/freeze4/cache3精确，fullCompile=false。Sources四窄implemented/旧新证据不变，lease accepted/overall active；未接新修补/未复跑。[原件/归因/父首条LF](conversation-visible-lease-first-checker-failure-20261027-evidence/INDEX.md)。
```

### incoming status 原首条（含LF）

来源`d8e6f1c1a546bab726d17b5b7cda0c6ba319b3d3`，885B/SHA-256 `6fae7bca0fe08354d4d11690f6d51432d71c747b1fc5744c10f00a04f9fe4321`；[raw](conversation-visible-lease-narrowing-d8e-formal-integration-20261027-evidence/incoming-status-first-entry.txt)。

```text
- **Conversation 新L4 checker收窄修订候选（2026-10-27）**：固定7361唯一lane prep2首实际run在Reveal报TS2339 never五诊断，Pane无诊断；无emit/测试，run已consumed不可重试。root采纳原Astra裁定后授权E留clean f33，仅在原restore后公开重读restoredLens/assert同对象，改sessionId与retiredLease两处读取根，后者仍在原绘制await后；原missing gates/其余L4、12新/26旧/defaultQuiet及Pane完整保护，矩阵仍13。只一次Reveal AST0、no-cache/no-fix lint0/0、禁Node compilecache，不代新checker通过，候选待root核/原Astra窄peer，业务red/新矩阵/原Reveal/after全未达、planaccepted；不导入merge后来Sources第四plan/52B stub，E三plan/JSON/out原件保持。[原失败/授权与原首条](sources-accept-post-read-authorization-checkpoint.md#e-新l4-checker收窄窄修订2026-10-27)。
```

### merge status 原首条（含LF）

来源`0ef3523047eb8825d97b2bc28ef0b05bec0bd977`，885B/SHA-256 `23b89d0eca9b64871ee38996394bccd2e3767ae456df2488c12c6dcd2b8b9a54`；[raw](conversation-visible-lease-narrowing-d8e-formal-integration-20261027-evidence/merge-status-first-entry.txt)。

```text
- **Conversation d8e读取根窄修订真三路接入（2026-10-27）**：固定ours14e/incomingd8e/共同f33；原Astra窄peer C0/I0/M0经root采纳，仅Reveal三行公开重读/sameLens与两receiver变更，Pane/其余src保ours。双方plan尾（无编号首次失败出版与E§10）、board/checkpoint历史并存，双方status原首条含LF/hash另存proof；Sources四窄implemented/52Bstub/旧新证据保持。7361唯一run五条TS2339失败与consumed不改，d8e作者一次AST/lint0不代checker通过；作者.build guard实际exit1独立署名保留，不等于merge54fe。当前无新prep或执行release，checker/业务red-green/完整Reveal/after全待，lease accepted/overall active；metadata54fe旧native256/额外Reveal/freeze4/cache3不写/fullCompile=false。[首失败原件](conversation-visible-lease-first-checker-failure-20261027-evidence/INDEX.md)。
```


## d8e prep1 单次旧 L1 前置失败与不可变原件（2026-10-27）

本次事实以[新证据入口](conversation-visible-lease-d8e-old-l1-failure-20261027-evidence/INDEX.md)及其原件为准，前述合源时点、首失败、作者窄修与所有历史原文保留。固定父 b7dd43f1a523673bf5bdf65ae7950fe0c622adf3 / src 62996b35d6e417c0b46a1f7e79b632414008b5be / sourceRef d8e6f1c1a546bab726d17b5b7cda0c6ba319b3d3，准备包经原 Astra/root 接收，四字段独立激活后 root 另授单次实际 driver。运行于 09:17:22.013183–09:18:06.878949 UTC，actual exec session 49496 / exit1 / stopped-no-retry；新旧 consumed 均不可重试。

checker TS6.0.3 实际项目 10316 roots / 11250 files，只两目标 syntax/semantic 0、config/global/options0、noEmit/emitInvoked=false；非目标语义未请求，不声称全源语义干净。lint0error4warning/no-cache/no-fix，dry2JS/0standalone maps/0out writes，随后仅 Reveal emit1。旧官方精确两 title 各 start/end1，meta1pass、L1fail1、hooks10 start/10 end、reporter/native qualified；但实际 AssertionError 为 real engine ConversationEditorPane must open，mappedFrames445/455/433/517/628、exactSource647=false、qualifiedExpectedOldRed=false。driver 正确停止，未 emit Pane、未新完整 Reveal、未新13/原26业务验证、未非作者 after。

### 工具固定叙述失真：执行器署名，原件不改

baseline_executor 明确指出冻结 validate.py 所产 old-L1.qualification.json 的固定 prerequisiteEvidence 文字错误声称已到 fixed assertion647 及此前自然缺失/同对象等门。它与本次 mappedFrames445/455/433/517/628、exactSource647=false、exactExpectedBusinessAssertion=false、qualifiedExpectedOldRed=false 冲突。原 JSON、driver 和原始流逐字镜像，不修原件，不授自然 missing/own lease/647 前置门信用，不授 failed-body leak 信用。oldFailedBodyLeakCheckClaim=false；本轮只建立实际 teardown/hooks 与 owned 清理。

root 转述并采纳原 Astra 最终只读 C0/I1/M1：I1 仅上述固定叙述失真，布尔 fail-closed 与停止恢复正确；M1 是 engine helper 丢失 openErrors/终态诊断。已达 initial catalog started/settled/ready509–515、ensurePrimaryWindow430、partFor431、part.whenReady450；未达 initial ownlease521、natural missing 与647。loaded editorParts/group/panes 的静态顺序不足以支持 polling/延时/重开，未证生产缺陷或事件竞态。[署名来源](conversation-visible-lease-d8e-old-l1-failure-20261027-evidence/peer-and-root-attribution.json)保存 root 转述，非伪造 reviewer raw。

全部28个实际PID/start已停止并回收，各阶段cleanup均早于恢复，X117 socket/lock不存在，watchdog均false/45+5+5不变。仅 journal-qualified Reveal JS completed write/restore1path、uncertain/notAdmitted/protocolFailures0；Reveal ctime1793053795897904105→1793092686521596622为唯一例外，原两JS bytes/mode/mtime精确，Pane未写且ctime精确。15500 live pathset/metadata等46fc afterguard，native256及源身份/额外Reveal/freeze4/cache3实读保持；loaded1130实际路径与10038manifest-only分开，不借加载为函数覆盖/after。fullCompile=false。原f33五TS2339和作者E.build guard实际exit1/旧aggregate边界完整保留，Sources四窄implemented不改、lease accepted/overall active。

下一项仅记录 root 采纳的边界：E另开诊断计划，只报告原捕获错误与公开终态；之后若获独立授权，才另备 fresh 诊断专用一次性 L1|meta，任何结果都停止恢复，绝不自动 emitPane/fullnew。此记录不是计划签收、新工具或执行授权，不重试任何 consumed 包。

### b7dd status 原首条（含末尾 LF）

来源 b7dd43f1a523673bf5bdf65ae7950fe0c622adf3，964 bytes / SHA-256 38e469d5a3b088293eefeca2a1781450a37344981752fce7cd4c32c89af9f547；[raw](conversation-visible-lease-d8e-old-l1-failure-20261027-evidence/parent-status-first-entry.txt)，[身份](conversation-visible-lease-d8e-old-l1-failure-20261027-evidence/parent-status-first-entry.json)。围栏不替代 raw 末尾 LF：

~~~text
- **Conversation d8e读取根窄修订合源证明（2026-10-27）**：实际merge0ef352双亲14e/d8e/共同f33，src62996b35；union1104中1100无争议mode/type/blob、外22233精确，三冲突文档5canonical块重放，board自动0。仅Reveal80259B/110f7f…/91a05c4取incoming，正反变换整份f33精确；Pane/其他src、Sources四implemented/52Bstub/全部旧新证据保持。双方plan尾/board/checkpoint历史及双方status原首条LF/hash并存，status200。原Astra窄peer C0/I0/M0/root采纳，作者一次AST/lint原件保，E.build guard实际exit1及旧aggregate限制署名分开；7361五条TS2339失败/consumed不改。新checker/业务red-green/完整Reveal/非作者after待，无新prep/release；15500metadata54fe/native256/额外Reveal旧JS/freeze4/cache3精确，fullCompile=false，lease accepted/overall active。[三路/原件/守卫](conversation-visible-lease-narrowing-d8e-formal-integration-20261027-evidence/INDEX.md)。
~~~

root补充独核JS整字节/inline sourcesContent与独立VLQ五帧无647、release/consumer/pins/inventory及174旧原件精确，见[署名来源](conversation-visible-lease-d8e-old-l1-failure-20261027-evidence/root-independent-verification-relay.json)。root另报一次探索rg误用不存在的conversation-visible-engine-lease-recovery路径exit2，随后确认正确lease路径；[读取错误归因](conversation-visible-lease-d8e-old-l1-failure-20261027-evidence/root-path-reader-error-attribution.json)，不是产品/driver/门禁故障，无额外运行或诊断。

root/Astra另轨247210诊断plan规则16 C0/I1/M0的署名纠正：未来boundary=false只能写 expected old-red boundary not established，加实际outcome/stack/map；仅有实际前置栈才可定位为未到断言，否则unknown，L1 pass或647之后失败亦可能boundary=false。[原简写及纠正](conversation-visible-lease-d8e-old-l1-failure-20261027-evidence/future-boundary-wording-correction.json)保留。本次445/455未到647结论不变，不改consumed原件；新诊断plan仍待E窄改，本次不签收/实现或授工具执行。



## E Lease after只读输入落盘与历史保护边界（2026-10-27）

本次固定parent `d8e6f1c1a546bab726d17b5b7cda0c6ba319b3d3` / src `923acdffaf236f826bc9d2e69d924159aa217ac0`，不ff、不同步merge。root直接消息转述其与原reviewer Astra完成只读输入决策审查C0/I0/M3并全部采纳；此次仅授权纯docs落盘，该转述不伪作完整raw peer。[独立证据索引](lease-after-inputs-20261027-evidence/INDEX.md)记录已完成的wire/公开API/owner与lease/退避隔离/R3身份只读调查，三条Minor为第三轮两session各自新body+pending、公开状态hidden负控、持久releaseFrames及v1/epoch/history账本；不是新plan/tools/config/可执行预期，也没有准备或运行授权。现lease plan仅尾追加证据link，accepted与合同正文保持；全部业务runtimeObserved仍false。

E历史旧901B guard的`.build`416项aggregate为`f407a3fe5ef16c79808ea2ab1a74f6171c5d554374829d0427896e146cfc3ccb`，前轮d8e末扫描仍416项但为`787cf7f760de1904a4765ea9721b7082564a12d4777f9c7cb27d9dc2fc1b0c76`；out/node_modules当时匹配旧guard。末guard实际exit1/AssertionError并提前退出，未生成narrowing delivery/preservation JSON。旧guard后ctime筛选仅报告`.build/log`，但无旧逐项tuple且缺前轮current起点，不能断言完整delta或actor。本轮只镜像原901B字节/mode与保留原static/docs文件，完整边界及来源在证据页，不修.build/旧guard、不归因，不把本轮fresh快照冒充历史修复。

[Fresh docs起点](lease-after-inputs-20261027-evidence/docs-start-observation.json)、[终点保护](lease-after-inputs-20261027-evidence/docs-end-preservation.json)及[docs门禁](lease-after-inputs-20261027-evidence/docs-validation.json)只描述此次文档区间。只允许docs generator/health/diff和只读保护检查；没有AST/lint/Program/checker/emit/tests/services/browser/engine/out/cache动作，不升PRD/旧D/波，不释放唯一lane。board/checkpoint固定d8e完整字节保持前缀；status仍≤200，仅更新summary与Current Session首条，原首条含LF全文如下保存。

### d8e status 原summary与首条（含LF）

原status 139946B / SHA-256 `02346dd18cc8cc1f1984a821c398f39b4ab73725234531a6536c07b415320a06`，200行。原首条含LF为885B / SHA-256 `6fae7bca0fe08354d4d11690f6d51432d71c747b1fc5744c10f00a04f9fe4321`；NoLF SHA-256 `ea37f62badec7aa7674f432e8475bee74b1d5724a5ab595d183fffe1ecc57bf5`。同一含LF文本另存fresh起点JSON；下方首条尾LF保留在closing fence之前。

```markdown
summary: "固定7361唯一lane prep2首run checker因新L4 TS2339 never五诊断失败、无emit/tests且consumed；root采纳原Astra后仅授权E留f33作公开重读restoredLens窄修订，一次Reveal AST/lint0不代checker过，Pane/其余case保护，plan accepted/业务未达。"
- **Conversation 新L4 checker收窄修订候选（2026-10-27）**：固定7361唯一lane prep2首实际run在Reveal报TS2339 never五诊断，Pane无诊断；无emit/测试，run已consumed不可重试。root采纳原Astra裁定后授权E留clean f33，仅在原restore后公开重读restoredLens/assert同对象，改sessionId与retiredLease两处读取根，后者仍在原绘制await后；原missing gates/其余L4、12新/26旧/defaultQuiet及Pane完整保护，矩阵仍13。只一次Reveal AST0、no-cache/no-fix lint0/0、禁Node compilecache，不代新checker通过，候选待root核/原Astra窄peer，业务red/新矩阵/原Reveal/after全未达、planaccepted；不导入merge后来Sources第四plan/52B stub，E三plan/JSON/out原件保持。[原失败/授权与原首条](sources-accept-post-read-authorization-checkpoint.md#e-新l4-checker收窄窄修订2026-10-27)。
```


## E lease setup诊断独立草案（2026-10-27）

固定E parent `19663010fddefe6193165962284e7f599c95d555` / src `923acdffaf236f826bc9d2e69d924159aa217ac0`；after只读输入docs尚未merge，不追merge/main。root提供真实raw目录`/tmp/vscode-conversation-visible-lease-d8e-validation-20261027-prep1`并转述原Astra C0/I1/M1/root采纳：已consumed实际exit1，checker双target syntax/semantic0、lint/dry/emitReveal0；官方2tests/meta1过/L1setup1败/hooks10，map445→455→433→517→628，非647业务red。原件误写的无条件prerequisiteEvidence不回改，具体rootcause未知，不归因为生产/竞态/机器慢。

新增[独立诊断方案](../plans/conversation-visible-lease-setup-diagnostics.md)为draft待规则16：A只补engine setup失败报告已有openErrors的类型/message/stack与公开终态，原3s/事件/finally cancel/成功返回/全部业务断言保持；B须未来源码peer/真实三路后，由唯一merge baseline另备fresh单次诊断专用新Reveal+旧Pane，仅L1+official meta，任意结果stop/restore，绝无Paneemit/fullnew/after自动分支或业务red/green升级信用。恢复须本次46fc959b355c9e922a7cb7e9a74919956c5647a595ad88347a083449d8cfb51e实际guard、唯一Reveal ctime1793092686521596622，实际PID/start+parent phase+journal定写入子集，全ownedquiet先还原，未写ctime不修。工具未来仅boundary=true写qualified前置，其余not reached+actual frames。当前仅计划与导航/行动docs，无源码/工具候选或准备/运行授权；现lease合同及accepted保持。

### 19663010 status 原summary与首条（含LF）

原status共200行，SHA-256 `33739790b501db8313fa3605e8da761ae033d426a5f121aabd0a6267ae464f6d`。原首条含LF 1030B / SHA-256 `7d43133be33aa69da2a0f11f66ca67d4055fb49e77c1828cd742f17c57ea1414`，NoLF SHA-256 `a63e80b87e8983400ce52e9085ebfe9fc8ddae8ef942afb5b08acb93b1c51b05`；下方首条尾LF保留在closing fence前。本次status只换summary与首条，board/checkpoint原19663010完整字节保持前缀。

```markdown
summary: "固定d8e只读lease after输入经root/原Astra决策C0/I0/M3全采纳，仅证据docs落盘；历史.build mismatch/失败guard与原件边界保留，fresh仅本docs区间；无工具准备或运行释放，plan accepted/业务未达。"
- **Conversation lease after只读输入落盘（2026-10-27）**：固定E d8e/src923acd，root转述其与原Astra输入决策审查C0/I0/M3全部采纳，仅授权纯docs。wire/三transport lifetime/公开own-lease观察、第三轮新正文pending/hidden公开负控/持久release与v1账本、R3工具及loaded边界已入[独立证据索引](lease-after-inputs-20261027-evidence/INDEX.md)；lease plan仅追加入口、合同仍accepted。历史.build aggregate不匹配与前轮末guard exit1/AssertionError、无narrowing delivery/preservation及缺前轮起点如实保留，不归因/修复；fresh起止仅本docs区间，原static/docs及src/out/三Sourcesplan/JSON保护。只做docs门禁/只读保护，无准备/执行release、AST/lint/Program/checker/emit/tests/服务/浏览器/out/cache操作；业务red/新矩阵/原Reveal/after仍全未达，不ff或升状态。[原summary/首条含LF](sources-accept-post-read-authorization-checkpoint.md#e-lease-after只读输入落盘与历史保护边界2026-10-27)。
```


## E lease setup规则16 I1窄改与方案签收（2026-10-27）

root提供原reviewer Astra直接消息对固定247210方案的正式规则16结果C0/I1/M0；root独核后全部采纳I1，同时明确承认其此前false→not reached建议同样过强。该来源为reviewer/root会话消息，不伪作仓库formal raw peer。本次纯docs修订固定parent `247210e3920ea307260814fa606bfe016ff32b37` / src `923acdffaf236f826bc9d2e69d924159aa217ac0`；不追merge/main，不改旧consumed原件。

**替代上方历史draft对应句**：“工具未来仅boundary=true写qualified前置，其余not reached+actual frames。”该句作为247210历史原稿保留以保护本checkpoint完整前缀，现明确撤回其中从条件false推未达的规则，不作为当前预期。当前[方案§3](../plans/conversation-visible-lease-setup-diagnostics.md#3-b单独释放的一次诊断专用运行)仅在实际boundary=true时写与该次真实source map一致的qualified前置说明；其他结果写expected old-red boundary not established，保实际outcome/stack/mapped frames。只有本次445/455这类actual stack+fixed controlflow可定位setup先失败时才明确未到647；L1pass记录actualpass但无业务red/green信用；无法定位记unknown，任何conditional false都不得抹掉已达事实。历史本次setup失败定位保持，不从general false反推未到断言。

按root明确裁定，独立diagnostics plan由draft改accepted，只勾规则16；本次固定commit仍待root逐字独核及原Astra窄验，root独核接受前不实施。原3s/事件等待/finally cancel/成功返回/全部业务断言、A仅失败报告、B单Reveal+旧Pane/L1+official meta/所有结果stoprestore/独立工具gate及46fc恢复边界全部保持；无源码/工具实现、准备或运行，无任何runtime升级，现lease plan accepted不动。原board/checkpoint完整247210字节仍为前缀，status仅换summary/首条且仍200行。

### 247210 status 原summary与首条（含LF）

原status SHA-256 `82596d364e2b59a09671cad8d88d76d249e54788deff08c3d2da231dbdc8639d`；原首条含LF 1128B / SHA-256 `678c09b72add5ee52f10ac294561eb84a0befedd52344e24359a5f76178145c4`，NoLF SHA-256 `84cf67b61bcd7af658ddfbcf304f89fd4f325fbee63e1e011fb7f03d4c49b5be`。首条尾LF完整保留于下方closing fence前。

```markdown
summary: "d8e唯一lane实际setup失败未到647；E固定19663010新增失败报告/单次诊断专用两阶段draft待规则16，原件与src/out保持；不实施、不准备或运行，lease accepted/业务未达。"
- **Conversation lease setup诊断草案（2026-10-27）**：root提供d8e已consumed实际exit1原件：双target syntax/semantic0、lint/dry/emitReveal0，官方meta1过/L1setup1败/hooks10；map445→455→433→517→628，未到647业务断言，无Paneemit/fullnew。原Astra C0/I1/M1经root采纳，旧prerequisiteEvidence误称不回写、rootcause未知。E固定19663010仅写[独立draft](../plans/conversation-visible-lease-setup-diagnostics.md)：A只补失败报告已有openErrors/公开终态，保3s/事件/finally cancel/成功返回与全部断言；B未来经源码peer/真实三路及独立释放，由唯一merge baseline另备一次诊断专用新Reveal+旧Pane/L1+official meta，任意结果stop/restore、无业务red/green信用或自动Paneemit/fullnew/after。恢复用46fc实际guard与PID/start+parent phase+journal写入子集、先全ownedquiet，未写ctime不修；未来前置文案按actual boundary条件化。当前只docs、未实施或准备/运行，现lease accepted。[旧首条含LF](sources-accept-post-read-authorization-checkpoint.md#e-lease-setup诊断独立草案2026-10-27)。
```


## E lease setup A失败报告最小源码候选（2026-10-27）

root已独核接受固定9a9a/src923acd，并采纳原reviewer Astra正式窄验C0/I0/M0关闭原规则16 I1；来源为root提供原reviewer直接消息和root裁定，不伪作formal raw。随后仅授权accepted diagnostics plan§2的A，E留clean `9a9a833993803055f6f4427b5268ed93a57dc4d2` parent，不追merge/main、不导入Sources后增量；[plan§7](../plans/conversation-visible-lease-setup-diagnostics.md#7-a失败报告源码候选与作者只读边界2026-10-27)记录当前候选与sourcepeer待。

仅Reveal engine helper及两处engine初始化调用接既有openErrors，等待原正文只重缩进，不改3s/shared bounded、事件filter、finally cancel、成功返回、13新/26旧/defaultQuiet或业务断言。失败catch读一次公开part windowId/sessionKey、groupid、activeEditor resource、activePaneid/instanceof与既有openErrors type/message/stack；完整JSON成功后Object.defineProperty给同一原Error.stack追加后缀，原type/message和stack完整前缀保持。诊断读取/格式化/append失败仍原样throw，非Error值原样throw；无console/新reporter/额外observer/acquire/reopen/focus/restore/polling/延时/替身/生产写。

源码peer输入为固定test/unit/electron/renderer.js：266–273标记console为unexpected、338–340据此teardown失败，391–400/445发送原stack。root已采纳完整JSON后仅append原stack作为范围内处理；本作者只读该源码，没有runner执行。旧d8e647只是历史源定位，当前候选文本断言行674仅静态计数，实际candidate行由后续真实source map冻结，不为守旧行号改断言。

### 可独立核的整文件逆变换

候选Reveal为81489B / SHA-256 `dbc9066b2206e8f74422aac7cc4b8ed14cb57800df91f800c3ff3efeb54adbb0`。从Git `d8e6f1c1a546bab726d17b5b7cda0c6ba319b3d3`读取整份Reveal；取该对象的完整waitForEnginePane（签名前缀`\tasync function waitForEnginePane(`至下一`\n\tasync function createEngineRevealHarness(`之前），替换候选相同边界，再逆以下两个唯一字符串：

```text
waitForEnginePane(primaryPart, openErrors) -> waitForEnginePane(primaryPart)
waitForEnginePane(partFor(harness.parts, harness.primaryId), harness.openErrors) -> waitForEnginePane(partFor(harness.parts, harness.primaryId))
```

作者只读字节检查已证逆变换后整份80259B / SHA-256 `110f7f43b5808af9a01d3ea0fdf6ab68aa4fa4dc9309e029f7f912405ced8646`精确等于d8e，故helper/两call外全部字节原样；原等待正文去一层新增缩进亦逐字相同。生产Pane15270B/90c0719d与其他src、三Sources plan/JSON、历史失败/after输入/旧consumed工具原件保护。没有AST/lint/Program/typecheck/compile/transpile/emit/tests/UI/engine或工具准备/out/cache操作，仅只读字节与fresh metadata/diff/docs门禁；不把静态候选当语法/语义/业务通过。plan仍accepted/sourcepeer待，不进入B，runtimeObserved仍false。

### 9a9a status 原summary与首条（含LF）

原status SHA-256 `e2be533f73fd2ddac019319fa14b655927df2ee843b58938eda90db3ba360b53`、200行；原首条含LF 1094B / SHA-256 `d9f98a69ef5608863f01a8d9c80bd1d41de51983d5abc4cdcdc83528198c414e`，NoLF SHA-256 `9b748e84a6184d22767339d016b5bce79a158dd3812cc95565bfc30e9e5e615a`。原summary及首条尾LF下方完整保留，board/checkpoint原9a9a全文保持前缀；本次status仅换summary/首条且仍200行。

```markdown
summary: "原Astra规则16 C0/I1/M0经root采纳；diagnostics仅窄改boundary未建立时保实际outcome/stack/map，独立plan accepted且只勾规则16；固定修订待root核/窄验，不实施或释放工具运行。"
- **Conversation lease setup规则16窄改签收（2026-10-27）**：root提供原reviewer Astra直接消息C0/I1/M0并独核采纳I1，承认此前false→not reached建议同样过强。独立[diagnostics方案](../plans/conversation-visible-lease-setup-diagnostics.md)已明确实际boundary=true才写与该次source map一致的qualified前置；其余写expected old-red boundary not established并保actual outcome/stack/mapped frames，仅能由actual stack+fixedcontrolflow定位setup先败才称未到647，L1pass记actualpass且无业务red/green信用，无法定位unknown，conditionalfalse不抹已达事实。按root裁定plan accepted、只勾规则16；原A仅报告/3s事件断言、B单Reveal+旧Pane/L1meta/任何结果stoprestore/独立工具gate及46fc恢复边界保持。固定本修订仍待root逐字核/原Astra窄验，未独核前不实施；src923acd/旧lease accepted/consumed原件/输出不动，无runtime升级。[旧首条LF与历史句替代](sources-accept-post-read-authorization-checkpoint.md#e-lease-setup规则16-i1窄改与方案签收2026-10-27)。
```

### 本次A fresh metadata保护摘要

只界定本次9a9a→A候选区间，不替代旧历史缺失起点。schema为排序descendant tuple `[workspace-relative path（原件目录为absolute）, full st_mode, size, mtime_ns, ctime_ns, symlink target或null]`，regular-file SHA仅用于原件目录；默认ensure_ascii的compact JSON SHA-256，排root inode与atime。开始/结束聚合一致：

| 范围 | entries | metadata SHA-256 |
| --- | ---: | --- |
| out | 14865 | `25b31cc67d5b7e445d4dfabbbc17c8908f413140566ff80d2319ff0aafad5add` |
| .build | 416 | `1f301d4d1e37d5a7a580ba62fbfc7c71ce56ea572ce9cc40a27235eb517027f4` |
| node_modules | 47159 | `3dfb0c2ec9524556bdc2275069b59b001806808535574d5ffcc08577a82ca61b` |
| src（仅排除获准Reveal文件，仍含目录） | 15035 | `c2c15c686e1feca4284a5c87b2315ce59fc8aa508ed90c7a394b5ca2f2017c8c` |
| d8e prep1原件目录（另含regular-file SHA） | 332 | `9e36edc4e6388ed89ed251e56a19384a64cd37b6f6226f999cfe77e3d9608972` |

唯一获准源码Reveal的原mode 33204保持；原mtime_ns/ctime_ns均为1793088860593462804，源码写后实际mtime_ns/ctime_ns均为1793094363979342759；旧/新字节hash与逆变换在上文，未修ctime。输出、其余src与全部旧原件无metadata变更，六份旧/tmp static/docs原件按既有docs-end-preservation逐项bytes/SHA/mode/mtime/ctime完整相同。


## E lease setup A源码peer I1默认参数窄修订（2026-10-27）

root转发原reviewer Astra对固定fb708的正式源码peer C0/I1/M0并独核全采纳I1。该来源为reviewer/root会话消息，不伪作formal raw；原I1/失败/peer记录与fb708候选保留。449 required openErrors与811/907/966三既有单参调用为静态不匹配，未运行checker，不称actual TS2554；原catch采样、同原Error/type/message/完整stack前缀及3s/事件/cancel等其余无发现，root已独立逆回完整d8e。

E从fixedclean fb708c01ab1d2267b304680fb8a65fe22673c6b5/src5e233c仅做source449一行openErrors: readonly unknown[] = []，不optional/cast、不加其他代码；两初始化真实数组参数、三业务单参/所有断言/其余整份源码完整不变。[plan§8](../plans/conversation-visible-lease-setup-diagnostics.md#8-a源码peer-i1与默认参数窄修订2026-10-27)记候选81494B / SHA-256 404034f9dd15c2cf6143c44b624b0dbb398da25b27f16d962a2f01bef982388d；仅逆默认值即完整fb70881489B/dbc9066b，原整helper/两call逆回d8e80259B/110f7f43仍成立，13新/26旧/defaultQuiet/Pane及历史/consumed原件全保护。

未来B工具peer必须先按唯一LF紧接Engine Pane setup diagnostics: 分开主stackprefix与诊断JSON；业务mappedframes只能来自主stack，嵌套openErrors.stack不计。此条只作后续toolpeer输入，不新授权工具或更动既有boundary诚实规则。当前仍待root核固定commit/原Astra窄验，原I1不先称closed；plan accepted/runtimeObserved false，不进入B。只读字节/逆变换/metadata/diff/docs门禁，无AST/lint/Program/checker/compile/transpile/emit/tests/UI/工具prep/out/cache动作。

### fb708 status 原summary与首条（含LF）

原status SHA-256 28be5ad45d7ac6343e1c4b1c57b2923f177d05a1c2cbd39be91ef77dc0d0cf2e，200行；原首条含LF 1149B / SHA-256 c4cd7ff952a5d02d6af9c7655a4af70c72ae5dcee59e32ca9b37c731b6c6fd9e，NoLF SHA-256 cb1b52fd1f17f469d9c95cd7372813da7a2cf90337c5e9874fcec92103249300。原summary/首条含LF下方完整保留，board/checkpoint原fb708完整前缀保持；status仅summary与首条更新。

```markdown
summary: "root接受9a9a/原Astra窄验C0/I0/M0关I1；仅A失败报告Reveal源码候选已写，原等待/断言全保且整文件逆回d8e，sourcepeer待；无作者AST/lint或运行，plan accepted，不释放B。"
- **Conversation lease setup A源码候选（2026-10-27）**：root接受9a9a并采纳原Astra正式窄验C0/I0/M0关I1，另只授权A。固定9a9a仅改Reveal engine helper/两处初始化原openErrors传参；失败时一次公开终态+已有openErrors type/message/stack构造完整JSON后append同一Error.stack，原type/message/完整stack前缀保持，诊断失败仍原样throw。官方runner console会另造teardown失败，root采纳不用console/新reporter，来源列[plan§7](../plans/conversation-visible-lease-setup-diagnostics.md#7-a失败报告源码候选与作者只读边界2026-10-27)供peer；原3s/sharedbounded/事件filter/finallycancel/成功返回/全部case与断言不变，13新/26旧/defaultQuiet/Pane保护。候选81489B/dbc9066b；替回d8e整helper/逆两call即整份80259B/110f7f43，旧647仅历史定位。仅只读字节/metadata/diff/docs，无AST/lint/Program/emit/tests/UI/工具准备/out/cache写；sourcepeer待、plan accepted、不自动B或升级runtime。[逆变换与原首条LF](sources-accept-post-read-authorization-checkpoint.md#e-lease-setup-a失败报告最小源码候选2026-10-27)。
```

### 本次默认参数修订fresh metadata边界

仅本fb708→一行修订区间；schema沿上节A的排序descendant fullmode/size/mtime_ns/ctime_ns/symlink或null、默认ensure_ascii compact JSON、排root inode/atime，原件目录另含file SHA。开始/结束相同：

| 范围 | entries | metadata SHA-256 |
| --- | ---: | --- |
| out | 14865 | `25b31cc67d5b7e445d4dfabbbc17c8908f413140566ff80d2319ff0aafad5add` |
| .build | 416 | `1f301d4d1e37d5a7a580ba62fbfc7c71ce56ea572ce9cc40a27235eb517027f4` |
| node_modules | 47159 | `3dfb0c2ec9524556bdc2275069b59b001806808535574d5ffcc08577a82ca61b` |
| src仅排除获准Reveal文件 | 15035 | `c2c15c686e1feca4284a5c87b2315ce59fc8aa508ed90c7a394b5ca2f2017c8c` |
| d8e prep1目录（含regular-file SHA） | 332 | `9e36edc4e6388ed89ed251e56a19384a64cd37b6f6226f999cfe77e3d9608972` |

唯一源码Reveal mode 33204保持，原mtime_ns/ctime_ns 1793094363979342759，正常源码写后实际mtime_ns/ctime_ns 1793094912226149949；不修ctime。其余源/outputs及旧原件metadata保护，不冒称旧历史连续性修复。


## 8033 A静态peer真实三路接入与当前边界（2026-10-27）

固定merge `e92f60426b1b7f731b46f793aab0301ff55a4d67`；parents `acf1aa064a0460d900bf37bc46df6a6e9cc4365a`、`8033a3c23ba2b0550e817c9cc4fdebf4d12a4478`；真实base `d8e6f1c1a546bab726d17b5b7cda0c6ba319b3d3`，tree `4af8bc589dca3d40f18781aa9ccbbfcdff8f00a5`，src `fa6f7fe9f339963dd9f4190f44aa17e45f6ad731`。全union1408/uncontested1402/outside22233精确，冲突6docs/7blocks、实际merge16paths；[固定输入/完整canonical与diff3两种重放/父首条/保护证明](conversation-visible-lease-setup-diagnostics-8033-formal-integration-20261027-evidence/INDEX.md)。board/lease/checkpoint为whole ours+LF+incoming独立尾，不把ours历史summary更新错说成base整文前缀；§1–§10、全部双方尾/原件保留。after8files仍仅只读输入，非after执行。

原Astra fb708源码peer C0/I1/M0/root采纳保留：三旧单参required openErrors是静态arity I1，未跑checker/不称实际TS2554；8033唯一默认参数窄修C0/I0/M0经root独核采纳、关闭I1。此前9a9a规则16窄peer另为C0/I0/M0，不混淆两种I1。均为reviewer/root会话署名，无formal raw不伪造。当前只认A静态peer/真实三路已完成，实际B诊断待另授；无新checker/业务red/green/after。旧f33五TS2339、d8e consumed setup前置失败/非647业务红、固定误前置叙述与后续boundary诚实纠正、E.build guard实际失败均不改。Sources四窄implemented/lease accepted/overall active、fullCompile=false。

15500 live metadata精确46fc（保留旧54fe溯源区别），native256与额外旧Reveal147236B/49a3a5、freeze4/cache3、257scratch/125mirrors、旧f33 174files/28784500B保持；28owned PID/start alive0与X117 socket/lock absent。旧46fc snapshot仍含旧source溯源且不回写，当前Reveal81494B/404034/blobc771与topHEAD/src只放新overlay。未来B解析先按唯一LF+Engine Pane setup diagnostics: 拆主stack/JSON，仅主stack映射，nested openErrors.stack不得算业务frames；单Reveal可写/旧Pane只读、移除Paneemit/fullnew调度和权限/任意结果停机还原仅是后续输入，不构成工具准备。

### ours 父status原首条（含LF）

来源 `acf1aa064a0460d900bf37bc46df6a6e9cc4365a`，1052B / SHA-256 `38a3cb1380598dea1e8e023d44419b1130f098a7a240d442eba7aad8f1599142`；[完整raw](conversation-visible-lease-setup-diagnostics-8033-formal-integration-20261027-evidence/ours-status-first-entry.txt)。尾LF保留于closing fence前。

```text
- **Conversation d8e单次验证在旧L1前置失败（2026-10-27）**：固定b7dd43f1/src62996b35/d8e，prep1准备/四字段激活/单次消费原件全保，driver exit1已停止不可重试。checker双目标syntax/semantic0，lint0error4warning，dry2JS/0maps/0out写，Reveal仅emit1；旧官方2tests/meta1pass/L1fail1/hooks10+10精确，但实际real engine ConversationEditorPane must open，mapped445/455/433/517/628、exact647/qualified=false；未emitPane/新完整Reveal/after。28owned清理早于恢复，只journal-qualified Reveal写/恢复1path及ctime例外，未写Pane全metadata精确；15500当前46fc守卫/native256/额外Reveal/freeze4/cache3保持。原Astra C0/I1/M1/root采纳：固定prerequisiteEvidence叙述失真、helper诊断缺失，不证生产缺陷/竞态；新诊断计划另轨尚无工具/执行。旧f33五TS2339/E.build失败不改，Sources四窄implemented/lease accepted/overall active、fullCompile=false。[原件与边界](conversation-visible-lease-d8e-old-l1-failure-20261027-evidence/INDEX.md)。
```

### incoming 父status原首条（含LF）

来源 `8033a3c23ba2b0550e817c9cc4fdebf4d12a4478`，1197B / SHA-256 `2a1b8f8f06dd8232a28a85a01a6ec1e0846140a27a0567103e75b061fef69e43`；[完整raw](conversation-visible-lease-setup-diagnostics-8033-formal-integration-20261027-evidence/incoming-status-first-entry.txt)。尾LF保留于closing fence前。

```text
- **Conversation lease setup A默认参数窄修订（2026-10-27）**：原Astra正式源码peer对fb708为C0/I1/M0，root独核全采纳I1：449 required openErrors与811/907/966三既有单参静态不匹配，未运行checker、不称实际TS2554；catch/同原Error/原等待等其余无发现，原peer记录保留。E固定clean fb708仅一行openErrors默认空数组，不optional/cast，保两初始化真实数组传参、三业务调用/全部断言/13新26旧/defaultQuiet/Pane与其余整份源；候选81494B/404034f9，逆唯一默认值即整份fb70881489B/dbc9066b。后续B工具peer须先按唯一LF+Engine Pane setup diagnostics: 分主stack/诊断JSON，仅主stack算业务frames，嵌套openErrors.stack不计；仅记输入、无工具授权。[plan§8](../plans/conversation-visible-lease-setup-diagnostics.md#8-a源码peer-i1与默认参数窄修订2026-10-27)。待root固定核/原Astra窄验，accepted/runtimefalse、不进B；只读字节/metadata/diff/docs，无AST/lint/Program/checker/emit/tests/UI/工具prep/out/cache写。[原首条LF/保护](sources-accept-post-read-authorization-checkpoint.md#e-lease-setup-a源码peer-i1默认参数窄修订2026-10-27)。
```

### e92f604 merge status首条（含LF）

930B / SHA-256 `a63af7e4edb977c1e2d4bc1ffdbf98c31e33096f339027cad9b7aac832322b06`；[raw](conversation-visible-lease-setup-diagnostics-8033-formal-integration-20261027-evidence/merge-status-first-entry.txt)。独立proof阶段仅把当前身份和proof导航补全；merge原首条不改。

```text
- **Conversation lease setup A静态接入（2026-10-27）**：固定8033a3c2的Reveal81494B/404034f9已按真实三路接入；fb708原源码peer C0/I1/M0与三旧单参静态不匹配保留，默认空数组唯一修订经原Astra窄peer C0/I0/M0/root独核采纳并关闭I1，均为会话署名、不伪造raw。原Error/type/message/完整stack前缀、3s/事件/finally cancel/全部断言保持；其他src/Pane/Sources四窄implemented与旧证据不变。这里只记A静态源码接入，无本次checker或实际B诊断；B仍待独立授权、准备与审查。未来parser先按唯一LF+Engine Pane setup diagnostics: 分主stack/JSON，仅主stack映射，nested openErrors.stack不算业务frames。旧d8e setup失败/非647业务红、f33五TS2339及E.build失败原件保持；lease accepted/overall active、fullCompile=false。[诊断方案与历史](../plans/conversation-visible-lease-setup-diagnostics.md)。
```


## 8033 固定单次诊断结果、正式审查与外层保护失败（2026-10-27）

[独立结果proof](conversation-visible-lease-setup-diagnostics-8033-outcome-20261027-evidence/INDEX.md)保固定父3497bdc01caa188e5ff37e8877168d50b0a398d0/srcfa6f7fe9、原setup prep1/prep2、全部旧consumed和reader失败。prep1 formal C0/I1/M0/root不接受运行；prep2只writer scalar/token guard窄修，20份完整diff/replay和8工具逆namespace证明经原Astra源码/整包C0/I0/M0/root采纳。false release与四字段激活原件、98文件activation闭包均不改；实际一次授权另存，driverPID3157445/session15200，实际11:22:27.901499–11:23:14.059768 UTC，不重试。

| 独立结果列 | 实际值与边界 |
| --- | --- |
| driver | actual exit0，五stage只调用一次 |
| protocol | accounted-official-outcome，不能据此称全部保护通过 |
| official runner | actual exit1，2tests/meta1pass/L1fail1/hooks10+10，无pending/缺失/未知 |
| out restoration | complete，15500项；仅本次parent/PID-start/token和可信intent/completed journal裁定的Reveal恢复，Pane未写 |

checker单Reveal在完整src语境noEmit0，config/options/global0、非目标semantic未请求；lint0error/0warning、noCache/noFix。dry1JS/0maps/0out写，emit新Reveal254098B/7bca885c；28owned quiet/reaped早于restore，无watchdog或signals。原始journal writer3159436/start155460683，唯一Reveal ctime1793092686521596622→1793100193532575159；Pane及其他out全metadata精确。

L1实际real engine ConversationEditorPane must open；primary445/456/433/544/655，唯一JSON suffix解析成功，nested stacks不map，动态674断言未达，expected old-red boundary not established。root采纳原Astra根因C0/I1/M0：fixture缺IConversationWorkRootMount，IdentityStrip JS192:39→TS248:37的onDidChangeOffer TypeError高置信度解释前置失败，不证生产回归或补齐后业务通过。新增保护C0/I1/M0合计C0/I2/M0：全.build6777仅log mtime/ctime1793092674886086457→1793100181156749660、内容[]，外层保护失败；src15715/node_modules48772精确。createCompile→reporter.writeBuildLog静态链与emit时序为高置信度，未捕syscall/PID/逐阶段快照，不声称唯一writer、确切次数或dry实际写日志。a70dcb实际exit1/f34306实际0与原始输入输出、当前2B/metadata均保，不修log、不扩大restore、不改真实报告。

root直接转发913f4f/ef64a7/022d0b及bc6ace只读核验单独归因：1130实际loaded=1047scripts/83styles、10038manifest-only、3unmapped styles及两个target getScriptSource身份；WorkRootMount模块加载不等于model构造或函数覆盖，compile10 producer仅historical-declared-input-only。797仓外文件完整preservation、234必要原始文本镜像、132runtime仅filesystem记录；原f33五TS2339、d8e setup/误叙述及纠正、E.build失败/全部队列保持。这里只作结果proof/docs准备，尚不commit；Sources四窄implemented、lease/diagnostics accepted、overall active，业务red/green/after无成绩。

后续缺口仅记队列：fixture窄片补真实无额外构造依赖model；新emitter在dry前隔离reporter输出并全.build守护，均须独立审查/root另授。当前无源码/工具准备、重跑或after授权。父status summary/首条含LF见[原文及身份](conversation-visible-lease-setup-diagnostics-8033-outcome-20261027-evidence/parent-status-first-entry.json)，六份父文档逐字存于proof/parent-documents，历史正文保留。

## E lease fixture与emitter隔离方案待规则16只读审查（2026-10-27）

root仅授权E固定8033纯方案：[新plan](../plans/conversation-visible-lease-harness-and-emitter-isolation.md)为review，A只补Reveal本地WorkRootMount真实模型stub，B由未来唯一baseline隔离reporter附写并把完整src/.build/node_modules纳入每阶段停止条件。root提供原Astra高置信fixture根因、固定reporter顶层mkdir/结束write及已有model native输入事实，均列明静态或historical资格，不伪作本作者运行或逐次writer。prep2实际driver0/official1、L1 setup先败未达674、out15500保护/Reveal恢复成立与完整.build保护失败并列；结果入口发布中/未接入，不伪造已合入，实际tmp六原件bytes/SHA在plan§1。

本轮不改源码，不编译/lint/AST/模块加载/tests/runtime/toolprep/out/cache，不进入B工位或动主工位WIP；不ff/同步merge、不重用consumed driver、不自动重跑/after。正式old-red/new-full与非作者真实默认编辑器after仍未来门禁。方案固定commit交root后由原Astra只读规则16；当前未签收，不标accepted或实施。原checkpoint/board8033全文保持前缀，status仍200行、只改summary与首条；下方原文含LF保留。

### 8033 status原summary与首条（含LF）

原首条 1197B / SHA-256 `2a1b8f8f06dd8232a28a85a01a6ec1e0846140a27a0567103e75b061fef69e43`；原summary及首条：

```markdown
summary: "fb708原Astra源码peer C0/I1/M0/root采纳；只给openErrors加默认空数组，保两真实参数/三旧单参/全部断言，整份逆回fb708；窄验待，plan accepted/runtimefalse，不进B或工具prep。"
- **Conversation lease setup A默认参数窄修订（2026-10-27）**：原Astra正式源码peer对fb708为C0/I1/M0，root独核全采纳I1：449 required openErrors与811/907/966三既有单参静态不匹配，未运行checker、不称实际TS2554；catch/同原Error/原等待等其余无发现，原peer记录保留。E固定clean fb708仅一行openErrors默认空数组，不optional/cast，保两初始化真实数组传参、三业务调用/全部断言/13新26旧/defaultQuiet/Pane与其余整份源；候选81494B/404034f9，逆唯一默认值即整份fb70881489B/dbc9066b。后续B工具peer须先按唯一LF+Engine Pane setup diagnostics: 分主stack/诊断JSON，仅主stack算业务frames，嵌套openErrors.stack不计；仅记输入、无工具授权。[plan§8](../plans/conversation-visible-lease-setup-diagnostics.md#8-a源码peer-i1与默认参数窄修订2026-10-27)。待root固定核/原Astra窄验，accepted/runtimefalse、不进B；只读字节/metadata/diff/docs，无AST/lint/Program/checker/emit/tests/UI/工具prep/out/cache写。[原首条LF/保护](sources-accept-post-read-authorization-checkpoint.md#e-lease-setup-a源码peer-i1默认参数窄修订2026-10-27)。
```


### 首稿review原文与第一次docs generator实际失败

以下原review稿 18154B / SHA-256 `29af77b76d2e89ae867cc69dda705d839d89a1046d06616047db783a55777d55`，是首个generator调用时的全文（含末LF）；随后由root裁定改为仓库真实枚举draft并纠正事实，只保历史原文，不作为当前实施合同。

```markdown
---
title: "Conversation lease：补齐本地 fixture 与隔离 emitter 附写"
type: plan
status: review
phase: M7
updated: 2026-10-27
summary: "仅方案待原 Astra 规则16：A只给Reveal本地fixture补真实WorkRootMount模型；B由唯一baseline未来隔离reporter日志并逐阶段保护完整src/.build/node_modules。未授权实施、工具准备、重跑或after。"
---

# Conversation lease：补齐本地 fixture 与隔离 emitter 附写

本稿固定 E parent `8033a3c23ba2b0550e817c9cc4fdebf4d12a4478`，只准备后续两片，不导入 main / merge / Sources 后来增量。既有 [lease 合同](conversation-visible-lease-recovery.md)、[setup 诊断方案](conversation-visible-lease-setup-diagnostics.md)与[历史 after 输入边界](../progress/lease-after-inputs-20261027-evidence/INDEX.md)保持。**本稿为 `review`，原 Astra 规则16只读审查及 root 裁定待；不授权 A 实施、B 工具准备或任何执行。**

## 1. 固定事实、来源与未达门禁

唯一 baseline 已在 `3497bdc01caa188e5ff37e8877168d50b0a398d0` / src `fa6f7fe9f339963dd9f4190f44aa17e45f6ad731` 消费一次 `/tmp/vscode-conversation-visible-lease-setup-diagnostics-8033-20261027-prep2`。其 Reveal 与 E 8033 为同 blob `c7710eb939872d378394c7084ccf95bb50f4b4c2`，81494B / SHA-256 `404034f9dd15c2cf6143c44b624b0dbb398da25b27f16d962a2f01bef982388d`。本作者只读原件，没有重跑。

- driver 实际 exit0，official runner 实际 exit1；checker / lint / dry / emit-Reveal 各0。官方恰好2 tests：L1 fail1、meta pass1，10对 hooks 平衡。driver0表示该诊断协议按实际 outcome 收束，不是业务 green。
- 原错误仍为 `real engine ConversationEditorPane must open`；诊断显示 active Pane 为 `workbench.editors.errorEditor`、非 ConversationEditorPane，已有 openErrors 为 `TypeError: Cannot read properties of undefined (reading 'onDidChangeOffer')`，嵌套栈首在真实 ConversationIdentityStrip 构造。
- 主 stack 的 fresh map 为 **445→456→433→544→655**。结合固定 L1 先 await setup 的控制流，本次 setup 先败、未到该固定源的目标断言674；不是仅由 boundary=false 推断。qualification 原文保留 `expected old-red boundary not established`，不计业务 old-red / new-green 或 after。
- 全部 owned quiet 后，只恢复实际有资格的 Reveal out；实际完整 out 15500 路径保护 / 恢复结论仍成立。原报告的 restorationComplete 不扩大成完整仓库保护通过。
- root 另核本次 `.build/log` bytes 未变而 metadata 漂移，故**完整 `.build` 保护失败**。固定源码存在 reporter 附写调用链，但原运行没有覆盖该附写的逐阶段可信 writer journal，不能据静态链声称某次 dry / emit 的实际 writer。

结果入口 `dev/progress/conversation-visible-lease-setup-diagnostics-8033-outcome-20261027-evidence/` **发布中，E 尚未接入该目录或对应提交**；不能把计划发布写成已合入。下面绑定实际 tmp 原件；root 报告原始交付 closure 为281个 regular files / 83,460,780B，prep1原始 closure为85个 regular files，与作者递归 metadata 的含目录 path 对象计数不同。

| 实际 tmp 原件（均在上述 prep2 目录） | bytes | SHA-256 |
| --- | ---: | --- |
| `diagnostic-report.json` | 184385 | `349bf2a40b003c545da716f35a7d8b60213be08597502015e2488fc76eda8b21` |
| `diagnostic-L1.qualification.json` | 23799 | `ba8e5627074cd3923eeb03d2899922515c28debd21cbb370f3870d35aed042e0` |
| `fresh-Reveal-source-map-report.json` | 641 | `3f0f0dba2243cbe82675ca7c83b4b3e20713477d5316dc497ed8cd02696aa289` |
| `guard-after-restore.json` | 4214388 | `82129aa408f7688d8a48ed78da4cd6a7c8f0b34dec0d1156409d0cbaf432c6d1` |
| `restoration-scope-audit.json` | 3823 | `b4bd7cad9824a259ec07bc153cbde1cd5d3feda57cea06678ec773544d788e6c` |
| `execution-consumed.json` | 207 | `e2865cafdc2a0d5761539534a2c255c80afa48d2ce8e7828f8cc703453e4e659` |

原件、consumed 标记及原 guard 不改。该新 out guard只给 Reveal 新 ctime `1793100193532575159`，不能盲用旧46fc的 Reveal ctime；未来 baseline 须另获 root 核定实际起点，且不能把 `.build` 漂移纳入“恢复成功”或事后授权列表。

## 2. A：仅补 Reveal 本地 fixture 的既有服务

原 Astra 已高置信度确认、root 提供并采纳为本稿设计输入的固定源码事实如下；来源为原 reviewer / root 直接消息，不伪作作者运行或 formal raw peer：

| 固定3497源码位置 | 静态事实与含义 |
| --- | --- |
| [Reveal 的 stubLensRuntimeServices](../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts#L83) | 只补 window / chat，漏 `IConversationWorkRootMount`；本地 TestInstantiationService 不继承生产 singleton 注册。 |
| [IdentityStrip](../../src/vs/workbench/contrib/conversation/browser/conversationIdentityStrip.ts#L163) 的163 / 248 | 构造注入该 token，随后直接读其 `onDidChangeOffer`，与本次 openErrors 的缺值读取相符。 |
| [WorkRootMount](../../src/vs/workbench/contrib/conversation/browser/conversationWorkRootMount.ts) | 已有无服务依赖的真实 `ConversationWorkRootMountModel`；无需新建服务替身或改生产注册。 |
| [Lens.test](../../src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts#L560) / [SessionSplit.test](../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionSplit.test.ts#L94) | 已有 `store.add(new ConversationWorkRootMountModel())` 的本地 fixture 用法可对照。 |

A 获得独立实施授权后，源码白名单只有 Reveal 一个文件：从已有 WorkRootMount 模块导入 token 与真实 model，在现有 `stubLensRuntimeServices` 里沿用原 TestInstantiationService / DisposableStore，注册 `stub(IConversationWorkRootMount, store.add(new ConversationWorkRootMountModel()))`。实例归该 fixture 现有 store，保留原释放路径；不新建全局 / singleton / 跨 fixture 共享实例。

除上述 import 与一条本地 stub 外，原 DI 其余项、业务 fixture、engine helper 与诊断后缀、openErrors 收集 / 真实传参 / 默认参数、原3000ms / 事件 / finally cancel / cleanup、13新 / 26旧 / defaultQuiet 及全部 assertions 逐字保持。不给 model 填测试 offer，不手动 fire / bind / acquire，不延长等待，不把 setup 错误改成业务断言成功；生产 Pane / Lens / IdentityStrip / WorkRootMount / 注册均不改。

A 的候选交付应包含固定 commit / src / Reveal blob与SHA、精确 diff，以及仅逆掉新增 import成员与 stub 后整份 Reveal 等于8033的字节证明。先 root 独核，再原 Astra 源码 peer，再由 root 决定真实三路接入唯一 baseline；规则16或本稿通过均不能替代这些门禁。作者本轮不做 AST / lint / module import / checker / compile / emit / tests / runtime 或工具准备。

root 另提供既有 native 输入事实：本次实际1130 loaded集合含 `conversationWorkRootMount.js`，7615B / SHA-256 `77491aa9942ec2fb316ab3a5c705fbfa6602621c1d47632ad4223ef569cb2722`；其 inline sourcesContent 全字节等 fixed3497及当前源，source blob `ee7433788933ee407b5202a98a57bd4fb4bbeb93` / SHA-256 `736b683b191a9c54fa06fd221bab157897a4658c8eaa31f1dbd024c89cc34326`。producer compile10仍只具 `historical-declared-input-only` 资格；该 loaded 事实不证明 model 构造覆盖或新发射。未来新增 import 可读核定的既有 native，**不因此扩大单Reveal发射目标**；未来运行须重新采 actual loaded 字节身份。

## 3. B：唯一 baseline 后续隔离 reporter 附写

B 属于独立工具修订，只能由**非作者的唯一 baseline executor**在 root 单独释放工具准备后开展。E / B 工位 / 主工位 WIP 均不进入或修复；不改产品 build 源码来方便测试，不回写 consumed prep2，不先运行再补保护。本稿不创建 bootstrap、patch、driver或新工具目录。

### 3.1 固定静态输入与待查选项

root 只读固定源码提供：仓库 `createCompile` 路径使用无 id reporter；[reporter.ts](../../build/lib/reporter.ts) 61在结束时 `fs.writeFileSync` 固定 `.build/log`，81–85在模块顶层 `fs.mkdirSync(buildLogFolder)` 并吞异常。只改 cwd不足以覆盖这两个调用。旧 scratch emitter 15先 require ts / gulp / es、17动态 import compilation、18 util、19 transpiler，55 createCompile / 56 stream；`binding.mjs` 只用 Node内置与Git读取。以上是静态附写能力，不是原运行逐次 writer 证据。

未来准备者先在届时固定源码上留存以下只读调查，再给出精确工具 diff；在隔离建立前不得 import 任何仓库 / 编译依赖：

1. 核 createCompile / reporter 的实际签名、默认参数、调用点、固定 path 的求值依据与 no-id 条件；核是否真有可关闭附写的现有接口。**本稿不假定存在 logDir / 环境变量 / reporter注入配置**，也不凭参数名猜测可用。
2. 核 reporter的 fs import 形式与最早导入链、顶层 mkdir 的实际 path/options、结束写的 path/data/options及是否有其他写API / 缓存；核 binding及所有预加载不会先捕获未隔离的 fs函数。
3. 核当前out单写 hook、streamToPromise、reporter结束和进程退出先后；隔离须在 require(ts/gulp/es)、import compilation / util / transpiler 之前安装，并持续至子进程所有流收尾 / 退出，不能在 await stream前撤掉。

| 选项 | 本稿取舍 |
| --- | --- |
| 现有受支持关闭 / 目录参数 | 必须先证实签名和作用域；若发现更小接口，交root / Astra重新核方案，不凭空采用或宣称已存在。 |
| 仅改 cwd，或给未知 reporter id | 前者不覆盖固定路径；后者未证实语义且可能改 reporter行为，本稿不采用。 |
| 改仓库 build / reporter源码、扩大 `.build` 可恢复白名单 | 不采用；会改变产品构建或放宽保护，超出本片。 |
| scratch子进程启动处的两项精确 fs 重定向 | **拟采用的最小候选**，下节列出可行性证明条件；尚未实现或经工具审查。 |

### 3.2 两项精确重定向候选

在每个有编译依赖的阶段子进程内，先保存 Node内置 fs原函数，只将**唯一核定 repo `.build/log` 的 writeFileSync**改到该阶段独占 scratch日志；将 reporter **唯一核定 buildLogFolder 的 mkdirSync**改到对应 scratch目录。实际 `data` / `options` 原样交给原函数；不伪造成功、不丢弃日志，也不采用整个 `.build` 路径前缀映射。路径用固定 repo身份与 source求值结果核定，限定实际参数类型 / 绝对目标 / symlink身份；fd、未审查别名或其他调用形态不得自动纳入。

可行性须由未来静态调查及工具 peer证明：

- 补丁先于任何相关依赖导入；若有 ESM named built-in fs导出，核 Node实际版本是否需要 `syncBuiltinESMExports()`，并确保没有提前捕获的函数绕过。不能默认 global patch 对全部模块透明。
- 仅这两个已核调用允许改目标，原调用的参数及结果 / 异常可审计；mkdir仍调用真实 fs到独占 scratch目录，覆盖原模块吞异常的路径。异常或未知调用须置不可吞的阶段失败标记，由 parent判定；不能因 reporter自身catch就判隔离通过。
- 只有这两个精确目标可重定向；其他受保护src / `.build` / node_modules路径写尝试保留实际参数 / 错误与拒绝记录，置不可吞的失败标记并拒绝，不能改成任意`.build`前缀重定向。固定依赖的其他写API也须先纳入静态调用清单，未覆盖则不得执行；正常的其他fs操作保原语义。既有唯一Reveal out写入资格和hook继续生效；组合patch须证明无提前return、替换引用或恢复顺序绕过out单写，不扩大repo写权限。
- scratch审计用预先捕获的原函数避免递归。每次 redirected mkdir / write保留阶段、目标及实际PID/start、父资格、token、实际调用栈 / 来源、原 / 新路径、实际data bytes/SHA与options、调用次数、intent / completed / error；只记录真实事件，缺调用不填预期次数。原log及目录metadata始终受完整 `.build` guard保护。
- 两项 wrapper只存活于该独占子进程；不修改仓库模块、node_modules或主进程的全局fs。导入路径 / Node导出模式 / 并发语义若无法证明可隔离，即停止并交root重新定案，不退回生产源码patch、整体路径重定向或写后恢复 `.build`。

### 3.3 完整保护必须成为阶段停止条件

在第一项会加载编译依赖的动作之前，固定全量 `src` / `.build` / `node_modules` 起点：含ignored内容、root及所有descendants的类型 / mode / size / mtime_ns / ctime_ns / symlink target，regular files另含bytes/SHA；固定HEAD/src、source/native、cache links和已有out guard。schema / 排序 / 计数口径一次冻结，同一阶段前后不得更换或忽略新旧路径。所有证据写scratch，禁用Node compile cache与工具自身cache。

**emit阶段还须在编译stream真正完成后、首次Reveal journal intent / out write之前设置一道停止门**：child等待parent独立复核完整src / `.build` / node_modules及该时点out基线，parent绑定实际PID/start/token与单phase资格给出一次继续许可后才可写Reveal journal / out。门禁失败或许可缺失则不写Reveal，停机交原件；不得只在Reveal已经写完后才发现`.build`漂移，也不得用child自报替代parent独立核验。

每阶段终止并确认该阶段 owned quiet后，parent核全部保护范围与out资格；**检查通过才可进入下一阶段**。checker、lint、dry、emit、official run及finally都要核，不能只在最后报aggregate。任何src / `.build` / node_modules的新增、缺失、内容或metadata漂移都是硬失败：停止后续业务、停所有owned、保留diff / 原件交root，不将漂移改成baseline、不事后扩大恢复集合。不以write后原bytes相同放过ctime改变，也不touch / utime / 重写未授权路径来伪造ctime恢复。

若发现附写未隔离或scope不足，该次新driver一经消费仍只算该次实际失败；不得自动重试。静态调用链、未看到漂移、成功report三者均不能代替实际writer journal。

## 4. 保留原单写、双观测与恢复协议

未来工具必须逐项继承既有单Reveal诊断协议，不能用本稿重建一个较宽的运行入口：

- 唯一baseline、共享锁 / 全局空闲核定、唯一source/native与fresh工具身份、root独立execution release及one-shot consumed；源自A的候选先完成peer / 真实接入。准备许可不等于执行许可。
- 只允许fresh Reveal测试JS作为潜在out写入目标；旧Pane及其他out / native / WorkRootMount始终只读，不自动Pane emit、model emit、fullnew或fullcompile。
- 两个真实renderer观察目标仍为fresh Reveal与旧Pane；分别收 `scriptParsed` + `getScriptSource`并核完整字节 / SHA，不靠manifest代替实际loaded、不force import制造观察。官方选择仍只L1 + official meta，真实outcome / 官方统计 / hooks / exitcode独立记录。
- 按唯一单个LF紧接 `Engine Pane setup diagnostics: `拆主stack与诊断JSON；只有主stack参与业务mapped frames，嵌套openErrors.stack只作诊断。目标断言按新固定源的真实map冻结，不为674保行号。boundary未建立写 `expected old-red boundary not established`并保实际outcome；仅actual stack + fixed控制流可定位时声明未达，不能定位为unknown；L1 pass如实记pass，不借本诊断授业务red/green。
- 由实际PID/start + parent单phase / 单path资格 + 同phase可信out journal交叉核定completed / partial / uncertain子集；不能从metadata漂移反推恢复权限。先全部owned quiet，再只恢复核定实际out写入子集；未写路径及ctime不动。
- **任何结果 stop → owned quiet → qualified restore → 全保护复核 → 原件交root。** 完整src / `.build` / node_modules保护失败不得被out恢复成功覆盖；无权限修复这些范围，失败如实保留。future起点须绑定当时root核定的实际guard，不盲用历史54fe / 46fc / 82129a。

## 5. 顺序、交付与完成边界

| 步骤 | 必要输入与输出 | 当前授权 |
| --- | --- | --- |
| 方案 | 本固定docs commit → 原Astra规则16只读 → root核验并改稿 | 仅本稿与必要索引 / 行动层落位；`review` |
| A候选 | root单独放行 → Reveal最小import/stub → 字节逆证 → 原Astra源码peer → root真实接入 | 未授权 |
| B工具修订 | root单独放行唯一baseline准备 → 固定静态调查 / 两项隔离 / 全阶段guards / 新工具diff与哈希 → 工具peer与root核定 | 未授权；本稿不准备工具 |
| 未来一次执行 | 独立root release、fresh身份 / 起点 / consumed、实际outcome、完整原件与恢复边界 | 未授权；不能重用prep2或自动重跑 |
| 正式业务与产品验收 | 精确旧源合格L1业务old-red、固定新源完整矩阵与原Reveal回归；非作者真实默认编辑器after | 仍为未来门禁，不由本稿或诊断抵扣 |

- [ ] 原Astra规则16审查已回，root核验并落所有Critical / Important；未完成不标accepted、不启实施。
- [ ] A另获授权并完成固定源码peer / root接入。
- [ ] B另获准备授权、静态可行性与工具peer通过，完整保护阶段停止条件已核。
- [ ] 未来一次execution另获授权并如实交付；无自动retry / after。
- [ ] 正式old-red / new-full与真实默认编辑器after另行完成，才评估旧lease方案实施状态；不升PRD / 旧D / 波。

本轮只运行docs generator / health / diff与只读字节 / metadata核对；不改源码，不作编译 / lint / AST / 模块加载 / 测试 / runtime / toolprep / out或cache写。所有既有原件与历史失败保持，当前fresh保护只界定E本次文档区间，不补写任何工位旧连续性。
```

第一次实际命令：`rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/generate-docs-status.py`；workdir为E，exit1。工具只返回下面精确combined output，stdout/stderr没有独立保留，不补造分流；没有第二次review复现。

```text
Traceback (most recent call last):
  File "/home/clarence/Projects/Agents/vscode-WorkTrees/E/scripts/generate-docs-status.py", line 52, in <module>
    sys.exit(main())
  File "/home/clarence/Projects/Agents/vscode-WorkTrees/E/scripts/generate-docs-status.py", line 38, in main
    changes = apply_generated_status(root, dry_run=False)
  File "/home/clarence/Projects/Agents/vscode-WorkTrees/E/scripts/docs_status.py", line 674, in apply_generated_status
    raise RuntimeError(
RuntimeError: cannot generate status while plan parsing has errors: dev/plans/conversation-visible-lease-harness-and-emitter-isolation.md: frontmatter status 'review' is not in closed set ['accepted', 'draft', 'implemented']
```

root核验：仓库plan closed set实际仅accepted/draft/implemented；不是产品/源码失败，不改generator。按其裁定将本稿frontmatter改draft、summary/正文明确规则16只读审查待；纠正Reveal本地helper348与共享helper83–86两行事实，并将B保护明确为全量metadata + 限域bound bytes核验，不强制逐阶段全node_modules内容hash。child→parent emit前许可候选保持待Astra评估；未实施或准备。


### draft修订后的实际docs门禁返回

以下保留工具真实返回的combined output及exit，不补造独立stdout/stderr。generator实际写入INDEX状态列后为draft；随后--check退出0。health实际558 Markdown、0 errors、73 warnings（链接）；不是源码/运行验证。未为处理原review枚举失败修改generator，也未重复review失败。

```json
[
  {
    "command": "rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/generate-docs-status.py",
    "exitCode": 0,
    "combinedOutput": "dev/plans/INDEX.md: 状态 column updated\n"
  },
  {
    "command": "rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/generate-docs-status.py --check",
    "exitCode": 0,
    "combinedOutput": "generated status: OK\n"
  },
  {
    "command": "rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-docs-health.py",
    "exitCode": 0,
    "combinedOutput": "Docs health check\n- markdown files checked: 558\n\nErrors: 0\n  required_entries: 0\n  module_indexes: 0\n  system_indexes: 0\n  generated_status: 0\nWarnings: 73\n  frontmatter: 0\n  links: 73\n    - AGENTS.md: broken local link: dev/loop/INDEX.md\n    - AGENTS.md: broken local link: dev/loop/worktrees.md\n    - dev/decisions/004-diff-owner.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/047-typed-slot-hosts-and-vscode-bottom-panel.md\n    - dev/decisions/004-diff-owner.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/051-workbench-preview-and-sources.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/systems/session/session-config-panel.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/input/chat-input-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-process-fold.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md\n    - dev/plans/conversation-process-fold.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/009-session-projection-core.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/012-chat-stream-lifecycle-and-outbox.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/013-engine-event-ingestion-reliable.md\n    - dev/plans/conversation-timeline-refactor.md: broken local link: ../loop/worktrees.md\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: ca38f5b8-c713-49a4-8dbf-dfe9728dec22\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: f52a7649-f824-4d57-9601-dc745d71870c\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: 77c10215-cd67-4db7-b240-cd9f7e6fcfe4\n    ... 43 more\n\nResult: passed with warnings\n"
  },
  {
    "command": "rtk proxy git diff --check",
    "exitCode": 0,
    "combinedOutput": ""
  }
]
```


### 本次纯文档fresh保护边界

固定E parent8033 / src `f49b512f27c83efc128e67028fb173aa1e1fa0ac`。以下本次开始/结束相同，计数为**后代path对象（含目录），不是regular-file closure**；root inode/atime不入表。tuple为排序`[path, full st_mode, size, mtime_ns, ctime_ns, symlink-or-null]`，默认ensure_ascii compact JSON SHA；src/out/.build/node_modules是metadata核验，只有prep1/prep2原件目录的regular files另附SHA，未声称全source/node_modules逐文件内容hash。此schema仅本次作者docs区间，不代替未来B完整保护方案的schema。

| 范围 | path对象数 | 开始=结束SHA-256 |
| --- | ---: | --- |
| src | 15036 | `a523d6684e113a9fb7d8b474d2c49ae3bd0599b0c66b00f6fb3d3ed59da1dd9b` |
| out | 14865 | `25b31cc67d5b7e445d4dfabbbc17c8908f413140566ff80d2319ff0aafad5add` |
| .build | 416 | `829445637c75055067dbba3ab6c7efa1edac1052d3f2fc7d8a0b1d8e0193bb7e` |
| node_modules | 47159 | `3dfb0c2ec9524556bdc2275069b59b001806808535574d5ffcc08577a82ca61b` |
| prep1 | 332 | `9e36edc4e6388ed89ed251e56a19384a64cd37b6f6226f999cfe77e3d9608972` |
| prep2 | 355 | `e6c964a3e7a66821b5d9ddf58e6c7b7c0f7cec4b6ead7fb57f7501f6b012835b` |

当前E `.build`起点82944563与此前历史记录1f301d4d不同；root已明确本次fresh起点可用，本稿不归因、不修复、不冒称补齐旧连续性，更不能扩为merge工位连续性。prep1/prep2原件目录在本次无新增path、字节或metadata变化，原始85/281 regular-file交付closure口径另见plan§1。本次没有源码/编译/lint/AST/module/tests/runtime/toolprep/out/cache写；六tmp原件表逐个bytes/SHA全核，checkpoint与board8033全文保持前缀，status200行且只7/12两行改变。


## E lease emitter父许可与恢复资格规则16窄修订（2026-10-27）

来源与署名：**原reviewer Astra，root直接转发正式规则16消息，非terminal raw**；对象为固定b349f6。root在ce09a4只读独核旧validate397/420–438/523–528后采纳C0/I1/M1，本作者未读取或执行这些工具。下方完整保留b349f6原plan及root转发的原Astra正式全文；原实际两项缺口审查C0/I2/M0、所有失败/consumed证据均保留。root仅授权纯方案/必要行动层改稿，不代表原I1/M1已关闭；本稿仍draft，待原Astra窄验和root另授accepted。

### 固定b349f6完整原plan（含末LF）

18783B / SHA-256 `3681fd5f5cba8bfc585279defc949455fd28b18e01c43095c16381b380239f21`；以下仅历史原文，当前合同见修订plan。

```markdown
---
title: "Conversation lease：补齐本地 fixture 与隔离 emitter 附写"
type: plan
status: draft
phase: M7
updated: 2026-10-27
summary: "仅方案draft，规则16只读审查待（原 Astra）：A只给Reveal本地fixture补真实WorkRootMount模型；B由唯一baseline未来隔离reporter日志并逐阶段保护完整src/.build/node_modules。未授权实施、工具准备、重跑或after。"
---

# Conversation lease：补齐本地 fixture 与隔离 emitter 附写

本稿固定 E parent `8033a3c23ba2b0550e817c9cc4fdebf4d12a4478`，只准备后续两片，不导入 main / merge / Sources 后来增量。既有 [lease 合同](conversation-visible-lease-recovery.md)、[setup 诊断方案](conversation-visible-lease-setup-diagnostics.md)与[历史 after 输入边界](../progress/lease-after-inputs-20261027-evidence/INDEX.md)保持。**本稿为 `draft`（规则16只读审查待），原 Astra 审查及 root 裁定待；不授权 A 实施、B 工具准备或任何执行。**

## 1. 固定事实、来源与未达门禁

唯一 baseline 已在 `3497bdc01caa188e5ff37e8877168d50b0a398d0` / src `fa6f7fe9f339963dd9f4190f44aa17e45f6ad731` 消费一次 `/tmp/vscode-conversation-visible-lease-setup-diagnostics-8033-20261027-prep2`。其 Reveal 与 E 8033 为同 blob `c7710eb939872d378394c7084ccf95bb50f4b4c2`，81494B / SHA-256 `404034f9dd15c2cf6143c44b624b0dbb398da25b27f16d962a2f01bef982388d`。本作者只读原件，没有重跑。

- driver 实际 exit0，official runner 实际 exit1；checker / lint / dry / emit-Reveal 各0。官方恰好2 tests：L1 fail1、meta pass1，10对 hooks 平衡。driver0表示该诊断协议按实际 outcome 收束，不是业务 green。
- 原错误仍为 `real engine ConversationEditorPane must open`；诊断显示 active Pane 为 `workbench.editors.errorEditor`、非 ConversationEditorPane，已有 openErrors 为 `TypeError: Cannot read properties of undefined (reading 'onDidChangeOffer')`，嵌套栈首在真实 ConversationIdentityStrip 构造。
- 主 stack 的 fresh map 为 **445→456→433→544→655**。结合固定 L1 先 await setup 的控制流，本次 setup 先败、未到该固定源的目标断言674；不是仅由 boundary=false 推断。qualification 原文保留 `expected old-red boundary not established`，不计业务 old-red / new-green 或 after。
- 全部 owned quiet 后，只恢复实际有资格的 Reveal out；实际完整 out 15500 路径保护 / 恢复结论仍成立。原报告的 restorationComplete 不扩大成完整仓库保护通过。
- root 另核本次 `.build/log` bytes 未变而 metadata 漂移，故**完整 `.build` 保护失败**。固定源码存在 reporter 附写调用链，但原运行没有覆盖该附写的逐阶段可信 writer journal，不能据静态链声称某次 dry / emit 的实际 writer。

结果入口 `dev/progress/conversation-visible-lease-setup-diagnostics-8033-outcome-20261027-evidence/` **发布中，E 尚未接入该目录或对应提交**；不能把计划发布写成已合入。下面绑定实际 tmp 原件；root 报告原始交付 closure 为281个 regular files / 83,460,780B，prep1原始 closure为85个 regular files，与作者递归 metadata 的含目录 path 对象计数不同。

| 实际 tmp 原件（均在上述 prep2 目录） | bytes | SHA-256 |
| --- | ---: | --- |
| `diagnostic-report.json` | 184385 | `349bf2a40b003c545da716f35a7d8b60213be08597502015e2488fc76eda8b21` |
| `diagnostic-L1.qualification.json` | 23799 | `ba8e5627074cd3923eeb03d2899922515c28debd21cbb370f3870d35aed042e0` |
| `fresh-Reveal-source-map-report.json` | 641 | `3f0f0dba2243cbe82675ca7c83b4b3e20713477d5316dc497ed8cd02696aa289` |
| `guard-after-restore.json` | 4214388 | `82129aa408f7688d8a48ed78da4cd6a7c8f0b34dec0d1156409d0cbaf432c6d1` |
| `restoration-scope-audit.json` | 3823 | `b4bd7cad9824a259ec07bc153cbde1cd5d3feda57cea06678ec773544d788e6c` |
| `execution-consumed.json` | 207 | `e2865cafdc2a0d5761539534a2c255c80afa48d2ce8e7828f8cc703453e4e659` |

原件、consumed 标记及原 guard 不改。该新 out guard只给 Reveal 新 ctime `1793100193532575159`，不能盲用旧46fc的 Reveal ctime；未来 baseline 须另获 root 核定实际起点，且不能把 `.build` 漂移纳入“恢复成功”或事后授权列表。

## 2. A：仅补 Reveal 本地 fixture 的既有服务

原 Astra 已高置信度确认、root 提供并采纳为本稿设计输入的固定源码事实如下；来源为原 reviewer / root 直接消息，不伪作作者运行或 formal raw peer：

| 固定3497源码位置 | 静态事实与含义 |
| --- | --- |
| [Reveal 本地 stubLensRuntimeServices](../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts#L348) | 已补 timeline / review / SCM 等并调用共享helper，漏 `IConversationWorkRootMount`；本地 TestInstantiationService 不继承生产 singleton 注册。 |
| [共享 stubConversationTimelineLinkServices](../../src/vs/workbench/contrib/conversation/test/browser/conversationTimelineLinkTestStubs.ts#L83) 的83–86 | 这里只补 window / chat；不能把共享helper内容或83行位置误写成本地helper。 |
| [IdentityStrip](../../src/vs/workbench/contrib/conversation/browser/conversationIdentityStrip.ts#L163) 的163 / 248 | 构造注入该 token，随后直接读其 `onDidChangeOffer`，与本次 openErrors 的缺值读取相符。 |
| [WorkRootMount](../../src/vs/workbench/contrib/conversation/browser/conversationWorkRootMount.ts) | 已有无服务依赖的真实 `ConversationWorkRootMountModel`；无需新建服务替身或改生产注册。 |
| [Lens.test](../../src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts#L560) / [SessionSplit.test](../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionSplit.test.ts#L94) | 已有 `store.add(new ConversationWorkRootMountModel())` 的本地 fixture 用法可对照。 |

A 获得独立实施授权后，源码白名单只有 Reveal 一个文件：从已有 WorkRootMount 模块导入 token 与真实 model，在现有 `stubLensRuntimeServices` 里沿用原 TestInstantiationService / DisposableStore，注册 `stub(IConversationWorkRootMount, store.add(new ConversationWorkRootMountModel()))`。实例归该 fixture 现有 store，保留原释放路径；不新建全局 / singleton / 跨 fixture 共享实例。

除上述 import 与一条本地 stub 外，原 DI 其余项、业务 fixture、engine helper 与诊断后缀、openErrors 收集 / 真实传参 / 默认参数、原3000ms / 事件 / finally cancel / cleanup、13新 / 26旧 / defaultQuiet 及全部 assertions 逐字保持。不给 model 填测试 offer，不手动 fire / bind / acquire，不延长等待，不把 setup 错误改成业务断言成功；生产 Pane / Lens / IdentityStrip / WorkRootMount / 注册均不改。

A 的候选交付应包含固定 commit / src / Reveal blob与SHA、精确 diff，以及仅逆掉新增 import成员与 stub 后整份 Reveal 等于8033的字节证明。先 root 独核，再原 Astra 源码 peer，再由 root 决定真实三路接入唯一 baseline；规则16或本稿通过均不能替代这些门禁。作者本轮不做 AST / lint / module import / checker / compile / emit / tests / runtime 或工具准备。

root 另提供既有 native 输入事实：本次实际1130 loaded集合含 `conversationWorkRootMount.js`，7615B / SHA-256 `77491aa9942ec2fb316ab3a5c705fbfa6602621c1d47632ad4223ef569cb2722`；其 inline sourcesContent 全字节等 fixed3497及当前源，source blob `ee7433788933ee407b5202a98a57bd4fb4bbeb93` / SHA-256 `736b683b191a9c54fa06fd221bab157897a4658c8eaa31f1dbd024c89cc34326`。producer compile10仍只具 `historical-declared-input-only` 资格；该 loaded 事实不证明 model 构造覆盖或新发射。未来新增 import 可读核定的既有 native，**不因此扩大单Reveal发射目标**；未来运行须重新采 actual loaded 字节身份。

## 3. B：唯一 baseline 后续隔离 reporter 附写

B 属于独立工具修订，只能由**非作者的唯一 baseline executor**在 root 单独释放工具准备后开展。E 不进入或修复 B 工位，不动主工位 WIP；不改产品 build 源码来方便测试，不回写 consumed prep2，不先运行再补保护。本稿不创建 bootstrap、patch、driver或新工具目录。

### 3.1 固定静态输入与待查选项

root 只读固定源码提供：仓库 `createCompile` 路径使用无 id reporter；[reporter.ts](../../build/lib/reporter.ts) 61在结束时 `fs.writeFileSync` 固定 `.build/log`，81–85在模块顶层 `fs.mkdirSync(buildLogFolder)` 并吞异常。只改 cwd不足以覆盖这两个调用。旧 scratch emitter 15先 require ts / gulp / es、17动态 import compilation、18 util、19 transpiler，55 createCompile / 56 stream；`binding.mjs` 只用 Node内置与Git读取。以上是静态附写能力，不是原运行逐次 writer 证据。

未来准备者先在届时固定源码上留存以下只读调查，再给出精确工具 diff；在隔离建立前不得 import 任何仓库 / 编译依赖：

1. 核 createCompile / reporter 的实际签名、默认参数、调用点、固定 path 的求值依据与 no-id 条件；核是否真有可关闭附写的现有接口。**本稿不假定存在 logDir / 环境变量 / reporter注入配置**，也不凭参数名猜测可用。
2. 核 reporter的 fs import 形式与最早导入链、顶层 mkdir 的实际 path/options、结束写的 path/data/options及是否有其他写API / 缓存；核 binding及所有预加载不会先捕获未隔离的 fs函数。
3. 核当前out单写 hook、streamToPromise、reporter结束和进程退出先后；隔离须在 require(ts/gulp/es)、import compilation / util / transpiler 之前安装，并持续至子进程所有流收尾 / 退出，不能在 await stream前撤掉。

| 选项 | 本稿取舍 |
| --- | --- |
| 现有受支持关闭 / 目录参数 | 必须先证实签名和作用域；若发现更小接口，交root / Astra重新核方案，不凭空采用或宣称已存在。 |
| 仅改 cwd，或给未知 reporter id | 前者不覆盖固定路径；后者未证实语义且可能改 reporter行为，本稿不采用。 |
| 改仓库 build / reporter源码、扩大 `.build` 可恢复白名单 | 不采用；会改变产品构建或放宽保护，超出本片。 |
| scratch子进程启动处的两项精确 fs 重定向 | **拟采用的最小候选**，下节列出可行性证明条件；尚未实现或经工具审查。 |

### 3.2 两项精确重定向候选

在每个有编译依赖的阶段子进程内，先保存 Node内置 fs原函数，只将**唯一核定 repo `.build/log` 的 writeFileSync**改到该阶段独占 scratch日志；将 reporter **唯一核定 buildLogFolder 的 mkdirSync**改到对应 scratch目录。实际 `data` / `options` 原样交给原函数；不伪造成功、不丢弃日志，也不采用整个 `.build` 路径前缀映射。路径用固定 repo身份与 source求值结果核定，限定实际参数类型 / 绝对目标 / symlink身份；fd、未审查别名或其他调用形态不得自动纳入。

可行性须由未来静态调查及工具 peer证明：

- 补丁先于任何相关依赖导入；若有 ESM named built-in fs导出，核 Node实际版本是否需要 `syncBuiltinESMExports()`，并确保没有提前捕获的函数绕过。不能默认 global patch 对全部模块透明。
- 仅这两个已核调用允许改目标，原调用的参数及结果 / 异常可审计；mkdir仍调用真实 fs到独占 scratch目录，覆盖原模块吞异常的路径。异常或未知调用须置不可吞的阶段失败标记，由 parent判定；不能因 reporter自身catch就判隔离通过。
- 只有这两个精确目标可重定向；其他受保护src / `.build` / node_modules路径写尝试保留实际参数 / 错误与拒绝记录，置不可吞的失败标记并拒绝，不能改成任意`.build`前缀重定向。固定依赖的其他写API也须先纳入静态调用清单，未覆盖则不得执行；正常的其他fs操作保原语义。既有唯一Reveal out写入资格和hook继续生效；组合patch须证明无提前return、替换引用或恢复顺序绕过out单写，不扩大repo写权限。
- scratch审计用预先捕获的原函数避免递归。每次 redirected mkdir / write保留阶段、目标及实际PID/start、父资格、token、实际调用栈 / 来源、原 / 新路径、实际data bytes/SHA与options、调用次数、intent / completed / error；只记录真实事件，缺调用不填预期次数。原log及目录metadata始终受完整 `.build` guard保护。
- 两项 wrapper只存活于该独占子进程；不修改仓库模块、node_modules或主进程的全局fs。导入路径 / Node导出模式 / 并发语义若无法证明可隔离，即停止并交root重新定案，不退回生产源码patch、整体路径重定向或写后恢复 `.build`。

### 3.3 完整保护必须成为阶段停止条件

在第一项会加载编译依赖的动作之前，固定全量 `src` / `.build` / `node_modules` 起点：完整path-set及lstat：含ignored路径、root及所有descendants的类型 / mode / size / mtime_ns / ctime_ns / symlink target；固定HEAD/src、既有bound source/native/tool哈希、cache links和已有out guard。内容核验限于这些已绑定输入 / 产物与新增reporter精确日志data bytes/SHA，不要求每阶段对整个node_modules内容重新hash，也不声称所有文件内容已独立hash。schema / 排序 / 计数口径一次冻结，同一阶段前后不得更换或忽略新旧路径。所有证据写scratch，禁用Node compile cache与工具自身cache。

**emit阶段还须在编译stream真正完成后、首次Reveal journal intent / out write之前设置一道停止门**：child等待parent独立复核src / `.build` / node_modules全metadata、限域bound bytes及该时点out基线，parent绑定实际PID/start/token与单phase资格给出一次继续许可后才可写Reveal journal / out。门禁失败或许可缺失则不写Reveal，停机交原件；不得只在Reveal已经写完后才发现`.build`漂移，也不得用child自报替代parent独立核验。

每阶段终止并确认该阶段 owned quiet后，parent核全部保护范围与out资格；**检查通过才可进入下一阶段**。checker、lint、dry、emit、official run及finally都要核，不能只在最后报aggregate。任何src / `.build` / node_modules路径的新增、缺失或metadata漂移，以及限域bound bytes不符都是硬失败：停止后续业务、停所有owned、保留diff / 原件交root，不将漂移改成baseline、不事后扩大恢复集合。不以write后原bytes相同放过ctime改变，也不touch / utime / 重写未授权路径来伪造ctime恢复。

若发现附写未隔离或scope不足，该次新driver一经消费仍只算该次实际失败；不得自动重试。静态调用链、未看到漂移、成功report三者均不能代替实际writer journal。

## 4. 保留原单写、双观测与恢复协议

未来工具必须逐项继承既有单Reveal诊断协议，不能用本稿重建一个较宽的运行入口：

- 唯一baseline、共享锁 / 全局空闲核定、唯一source/native与fresh工具身份、root独立execution release及one-shot consumed；源自A的候选先完成peer / 真实接入。准备许可不等于执行许可。
- 只允许fresh Reveal测试JS作为潜在out写入目标；旧Pane及其他out / native / WorkRootMount始终只读，不自动Pane emit、model emit、fullnew或fullcompile。
- 两个真实renderer观察目标仍为fresh Reveal与旧Pane；分别收 `scriptParsed` + `getScriptSource`并核完整字节 / SHA，不靠manifest代替实际loaded、不force import制造观察。官方选择仍只L1 + official meta，真实outcome / 官方统计 / hooks / exitcode独立记录。
- 按唯一单个LF紧接 `Engine Pane setup diagnostics: `拆主stack与诊断JSON；只有主stack参与业务mapped frames，嵌套openErrors.stack只作诊断。目标断言按新固定源的真实map冻结，不为674保行号。boundary未建立写 `expected old-red boundary not established`并保实际outcome；仅actual stack + fixed控制流可定位时声明未达，不能定位为unknown；L1 pass如实记pass，不借本诊断授业务red/green。
- 由实际PID/start + parent单phase / 单path资格 + 同phase可信out journal交叉核定completed / partial / uncertain子集；不能从metadata漂移反推恢复权限。先全部owned quiet，再只恢复核定实际out写入子集；未写路径及ctime不动。
- **任何结果 stop → owned quiet → qualified restore → 全保护复核 → 原件交root。** 完整src / `.build` / node_modules保护失败不得被out恢复成功覆盖；无权限修复这些范围，失败如实保留。future起点须绑定当时root核定的实际guard，不盲用历史54fe / 46fc / 82129a。

## 5. 顺序、交付与完成边界

| 步骤 | 必要输入与输出 | 当前授权 |
| --- | --- | --- |
| 方案 | 本固定docs commit → 原Astra规则16只读 → root核验并改稿 | 仅本稿与必要索引 / 行动层落位；`draft`、规则16只读审查待 |
| A候选 | root单独放行 → Reveal最小import/stub → 字节逆证 → 原Astra源码peer → root真实接入 | 未授权 |
| B工具修订 | root单独放行唯一baseline准备 → 固定静态调查 / 两项隔离 / 全阶段guards / 新工具diff与哈希 → 工具peer与root核定 | 未授权；本稿不准备工具 |
| 未来一次执行 | 独立root release、fresh身份 / 起点 / consumed、实际outcome、完整原件与恢复边界 | 未授权；不能重用prep2或自动重跑 |
| 正式业务与产品验收 | 精确旧源合格L1业务old-red、固定新源完整矩阵与原Reveal回归；非作者真实默认编辑器after | 仍为未来门禁，不由本稿或诊断抵扣 |

- [ ] 原Astra规则16审查已回，root核验并落所有Critical / Important；未完成不标accepted、不启实施。
- [ ] A另获授权并完成固定源码peer / root接入。
- [ ] B另获准备授权、静态可行性与工具peer通过，完整保护阶段停止条件已核。
- [ ] 未来一次execution另获授权并如实交付；无自动retry / after。
- [ ] 正式old-red / new-full与真实默认编辑器after另行完成，才评估旧lease方案实施状态；不升PRD / 旧D / 波。

本轮只运行docs generator / health / diff与只读字节 / metadata核对；不改源码，不作编译 / lint / AST / 模块加载 / 测试 / runtime / toolprep / out或cache写。所有既有原件与历史失败保持，当前fresh保护只界定E本次文档区间，不补写任何工位旧连续性。
```

### 原Astra正式规则16原文（署名/来源如上）

root转发消息正文（本地保存含末LF）2896B / SHA-256 `a5e93ae622f0710f6f706ccd2cd43ba7bc764b27f6fd963d3d8249df05ffdc6b`；这是会话消息保存，不伪作原Astra terminal raw。

```text
原Astra正式原文（root直接转发，非terminal raw）：
**Strengths**
固定审查对象为 `b349f6c1c07de340a7119d20d420bdcaa7d67d73`，方案127行/18783B，SHA256 `3681fd5f5cba8bfc585279defc949455fd28b18e01c43095c16381b380239f21`。
- A片严格限定为Reveal的import与真实model注入，沿用释放路径；能针对已确认的夹具缺口，不替换lease行为。
- B明确先隔离、后导入，考虑内置fs共享对象、named exports、提前捕获及其他写API；将未来静态调查和工具peer作为执行前条件，合理。
- 精确路径重定向保留实际data/options与日志；完整metadata配合限域bytes校验，足以捕获本次同内容重写导致的时间漂移，无须逐阶段hash全node_modules。
- 既有实际失败和恢复范围表述准确，未追认.build/log写入或扩大业务成绩。draft状态无需改动。
**Critical：0**
**Important：1**
**新增父许可没有明确纳入恢复资格交叉核验。**
方案:94新增stream完成后的parent继续许可；但:108仍列旧组合：实际PID/start、parent单phase/path资格和可信out journal，没有明确要求journal必须绑定这次许可。
这不是纯措辞问题：原prep2 validate.py:520–528在spawn之前建立phase资格。若未来仅增加child等待，而恢复审计继承旧组合，缺失、拒绝或过期许可之后出现的意外intent，仍可能被当作可恢复写入。新门禁违例会被旧资格接纳。
最小修订：
- 明确区分启动资格与stream后的写入许可。
- parent许可绑定唯一请求、PID/start/token、phase/path、固定fresh bytes/SHA、该次独立guard结果及有效阶段期限。
- out journal绑定该许可；恢复审计独立核对parent已授予且未撤销/过期、许可先于intent、无重复消费。
- 缺许可或不匹配的写入按协议违例保留证据，不由旧启动资格推导恢复权；已取得有效许可后发生的partial/uncertain写入仍按原规则收窄恢复。
无需扩大目标或新增执行轮次。
**Minor：1**
:94的等待协议应明确纳入继承的单调时钟deadline，parent在存活监控循环中处理请求；parent失败、退出或无法完成guard时，child不得无限等待或继续写入。
原run_owned:495–502当前只监控退出与deadline，未来必须调整该循环。方案已要求继承ownership/watchdog，因此这是需要写明的实现约束，不必新增第二套超时体系。
**Assessment**
本方案C0/I1/M1。方向可行、范围适当；建议补齐许可与恢复资格的组合规则后再判accepted。实际两项缺口的原审查C0/I2/M0保留。
两项fs重定向目前仍是待静态证明与工具审查的候选，不能据方案通过声称所有调用身份、API或异步收尾已被覆盖。本轮仅读取固定Git、现有工具文本与JSON，未修改、准备或执行候选工具。
```

### 本次窄改与原status首条

I1文案改入§3.3/§4：spawn资格不等于写入许可；parent grant绑定唯一请求nonce/ID、实际PID/start/token、phase/path、固定fresh bytes/SHA、独立guard及阶段期限；intent/completed绑定permit ID/hash，恢复审计独核实际授予、intent时有效、grant早于intent、无跨phase/重放/重复消费。缺错/未授/事前失效写入保违例，无旧spawn推导恢复权；有效intent的partial/uncertain原资格不因事后阶段结束被抹掉。M1文案改入§3.3：继承单调deadline，parent在既有alive loop处理请求；parent失败/退出/guard不能完成，child不无限等待/不写，不增第二套超时。仅文案候选，I1/M1关闭待原Astra/root。

b349f6原status200行，首条含LF 1170B / SHA-256 `92c1a362da7143a171bf2f447b430394490e668464b7fc009737eed2a6db5ffc`；原summary/首条含LF完整保留：

```markdown
summary: "prep2诊断已消费：driver0/official1，L1 setup未达674，out恢复成立但完整.build保护失败；仅新增本地fixture/隔离reporter两片draft方案，规则16只读审查待，不实施/工具prep/重跑。"
- **Conversation lease fixture / emitter隔离方案（2026-10-27）**：唯一3497/srcfa6的prep2已消费，driver0/official1；主栈445→456→433→544→655定位setup先败、未到674，meta过/10对hooks；Reveal单out恢复与完整out15500保护仍成立，root另核.build/log仅metadata漂移使完整.build保护失败，静态链不当逐次writer。原Astra高置信确认本地fixture漏WorkRootMount；本轮只写[两片draft待审方案](../plans/conversation-visible-lease-harness-and-emitter-isolation.md)：A仅Reveal导入token/真实无依赖model并在原store本地stub；B未来仅唯一baseline隔离reporter固定log/top-level mkdir，导入前安装、逐阶段完整src/.build/node_modules硬门禁，保原单写/双观测/真实outcome/可信journal，不扩大恢复、不伪修ctime。发布中结果入口及实际tmp哈希见plan；待原Astra规则16/root核，不实施、不准备工具、不重跑/after，业务old-red/new-full/真实默认编辑器after仍未来门禁。[原首条与fresh区间](sources-accept-post-read-authorization-checkpoint.md#e-lease-fixture与emitter隔离方案待规则16只读审查2026-10-27)。
```


### 本次b349f6→许可窄改的docs门禁与fresh保护

仅本轮纯文档区间；未源码/编译/lint/AST/module/checker/emit/tests/runtime/toolprep/out/cache写，不进入B或改主WIP。实际门禁返回如下（保combined，不伪造独立stdout/stderr）：

```json
[
  {
    "command": "rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/generate-docs-status.py --check",
    "exitCode": 0,
    "combinedOutput": "generated status: OK\n"
  },
  {
    "command": "rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-docs-health.py",
    "exitCode": 0,
    "combinedOutput": "Docs health check\n- markdown files checked: 558\n\nErrors: 0\n  required_entries: 0\n  module_indexes: 0\n  system_indexes: 0\n  generated_status: 0\nWarnings: 73\n  frontmatter: 0\n  links: 73\n    - AGENTS.md: broken local link: dev/loop/INDEX.md\n    - AGENTS.md: broken local link: dev/loop/worktrees.md\n    - dev/decisions/004-diff-owner.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/047-typed-slot-hosts-and-vscode-bottom-panel.md\n    - dev/decisions/004-diff-owner.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/051-workbench-preview-and-sources.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/systems/session/session-config-panel.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/input/chat-input-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-process-fold.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md\n    - dev/plans/conversation-process-fold.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/009-session-projection-core.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/012-chat-stream-lifecycle-and-outbox.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/013-engine-event-ingestion-reliable.md\n    - dev/plans/conversation-timeline-refactor.md: broken local link: ../loop/worktrees.md\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: ca38f5b8-c713-49a4-8dbf-dfe9728dec22\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: f52a7649-f824-4d57-9601-dc745d71870c\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: 77c10215-cd67-4db7-b240-cd9f7e6fcfe4\n    ... 43 more\n\nResult: passed with warnings\n"
  },
  {
    "command": "rtk proxy git diff --check",
    "exitCode": 0,
    "combinedOutput": ""
  }
]
```

只读字节核对实际返回：

```json
{
  "planBytes": 22659,
  "planLines": 141,
  "planSha256": "e90e77d5398f3fa31f90d6ea8e351696b971e2c6f68897ccf3c194480bf7fcf9",
  "planDiffBytes": 14240,
  "planDiffSha256": "f2a0d1e079e34ae4ac2b3c67c8b644be97421e967b730e69dfdc7e8aecf4af98",
  "b349PlanOriginalPreserved": true,
  "b349CheckpointBoardFullPrefix": true,
  "statusLines": 200,
  "statusChangedOnlyLines": [
    7,
    12
  ],
  "sections1_2_3_1Unchanged": true
}
```

精确plan diff以`rtk proxy git diff -- dev/plans/conversation-visible-lease-harness-and-emitter-isolation.md`（parent为b349f6）取得，14240B / SHA-256 `f2a0d1e079e34ae4ac2b3c67c8b644be97421e967b730e69dfdc7e8aecf4af98`；原§1/§2/§3.1全字节保持，A及既有事实/静态调查不扩。固定commit发布后可直接git diff parent..commit复核，不把差异文件伪作执行工具。

开始/结束完全一致的fresh摘要如下；schema沿前次作者docs表：后代path对象（含目录，非原件regular-file closure），排序full mode/size/mtime_ns/ctime_ns/symlink或null、默认ensure_ascii compact JSON SHA，排root inode与atime；只有prep1/prep2原件目录regular files另附SHA，src/out/.build/node_modules是metadata核对。本次不补齐历史缺失连续性或冒认merge工位保护，完整原plan/正式review及旧C0/I2/M0/失败保持。

| 范围 | path对象数 | 开始=结束SHA-256 |
| --- | ---: | --- |
| src | 15036 | `a523d6684e113a9fb7d8b474d2c49ae3bd0599b0c66b00f6fb3d3ed59da1dd9b` |
| out | 14865 | `25b31cc67d5b7e445d4dfabbbc17c8908f413140566ff80d2319ff0aafad5add` |
| .build | 416 | `829445637c75055067dbba3ab6c7efa1edac1052d3f2fc7d8a0b1d8e0193bb7e` |
| node_modules | 47159 | `3dfb0c2ec9524556bdc2275069b59b001806808535574d5ffcc08577a82ca61b` |
| prep1 | 332 | `9e36edc4e6388ed89ed251e56a19384a64cd37b6f6226f999cfe77e3d9608972` |
| prep2 | 355 | `e6c964a3e7a66821b5d9ddf58e6c7b7c0f7cec4b6ead7fb57f7501f6b012835b` |


## E lease fixture与emitter窄方案accepted文档收口（2026-10-27）

署名/来源：**原reviewer Astra对固定db02c9的正式窄验C0/I0/M0，由root direct-message直接转发，非terminal raw**。root020951 actual0只读独核parent/src、plan22659B/141行/e90e77d5、单篇plan diff14240B/f2a0d1及§1/§2/§3.1 wholeexact和grant/journal/恢复链后采纳；I1/M1仅在方案层关闭。root现只授权draft→accepted及必要文档commit，方案可供后续独立实施授权采用；A源码、B工具准备和运行均未授权，交付后停。root另报proof提交3a14d6已验，E未真实接入该提交，不称E合入/同步或真实三路。

### 固定db02c9完整原plan（含末LF）

22659B / SHA-256 `e90e77d5398f3fa31f90d6ea8e351696b971e2c6f68897ccf3c194480bf7fcf9`，141行；b349f6完整原plan及其C0/I1/M1正式全文已在此前章节保留，下方只加历史原稿，不替换旧证据。

```markdown
---
title: "Conversation lease：补齐本地 fixture 与隔离 emitter 附写"
type: plan
status: draft
phase: M7
updated: 2026-10-27
summary: "原Astra对b349f6规则16 C0/I1/M1/root采纳；只补父写入许可与恢复资格绑定及继承deadline，原稿/正式消息保留；仍draft待窄验，不实施/工具准备/执行。"
---

# Conversation lease：补齐本地 fixture 与隔离 emitter 附写

原稿固定 E parent `8033a3c23ba2b0550e817c9cc4fdebf4d12a4478`；本次规则16窄改固定clean parent `b349f6c1c07de340a7119d20d420bdcaa7d67d73`，仍只准备后续两片，不导入 main / merge / Sources 后来增量。既有 [lease 合同](conversation-visible-lease-recovery.md)、[setup 诊断方案](conversation-visible-lease-setup-diagnostics.md)与[历史 after 输入边界](../progress/lease-after-inputs-20261027-evidence/INDEX.md)保持。**本稿仍为 `draft`；原 Astra 固定b349f6规则16 C0/I1/M1经root采纳，以下窄改待原reviewer复核及root裁定；不授权 A 实施、B 工具准备或任何执行。**

## 1. 固定事实、来源与未达门禁

唯一 baseline 已在 `3497bdc01caa188e5ff37e8877168d50b0a398d0` / src `fa6f7fe9f339963dd9f4190f44aa17e45f6ad731` 消费一次 `/tmp/vscode-conversation-visible-lease-setup-diagnostics-8033-20261027-prep2`。其 Reveal 与 E 8033 为同 blob `c7710eb939872d378394c7084ccf95bb50f4b4c2`，81494B / SHA-256 `404034f9dd15c2cf6143c44b624b0dbb398da25b27f16d962a2f01bef982388d`。本作者只读原件，没有重跑。

- driver 实际 exit0，official runner 实际 exit1；checker / lint / dry / emit-Reveal 各0。官方恰好2 tests：L1 fail1、meta pass1，10对 hooks 平衡。driver0表示该诊断协议按实际 outcome 收束，不是业务 green。
- 原错误仍为 `real engine ConversationEditorPane must open`；诊断显示 active Pane 为 `workbench.editors.errorEditor`、非 ConversationEditorPane，已有 openErrors 为 `TypeError: Cannot read properties of undefined (reading 'onDidChangeOffer')`，嵌套栈首在真实 ConversationIdentityStrip 构造。
- 主 stack 的 fresh map 为 **445→456→433→544→655**。结合固定 L1 先 await setup 的控制流，本次 setup 先败、未到该固定源的目标断言674；不是仅由 boundary=false 推断。qualification 原文保留 `expected old-red boundary not established`，不计业务 old-red / new-green 或 after。
- 全部 owned quiet 后，只恢复实际有资格的 Reveal out；实际完整 out 15500 路径保护 / 恢复结论仍成立。原报告的 restorationComplete 不扩大成完整仓库保护通过。
- root 另核本次 `.build/log` bytes 未变而 metadata 漂移，故**完整 `.build` 保护失败**。固定源码存在 reporter 附写调用链，但原运行没有覆盖该附写的逐阶段可信 writer journal，不能据静态链声称某次 dry / emit 的实际 writer。

结果入口 `dev/progress/conversation-visible-lease-setup-diagnostics-8033-outcome-20261027-evidence/` **发布中，E 尚未接入该目录或对应提交**；不能把计划发布写成已合入。下面绑定实际 tmp 原件；root 报告原始交付 closure 为281个 regular files / 83,460,780B，prep1原始 closure为85个 regular files，与作者递归 metadata 的含目录 path 对象计数不同。

| 实际 tmp 原件（均在上述 prep2 目录） | bytes | SHA-256 |
| --- | ---: | --- |
| `diagnostic-report.json` | 184385 | `349bf2a40b003c545da716f35a7d8b60213be08597502015e2488fc76eda8b21` |
| `diagnostic-L1.qualification.json` | 23799 | `ba8e5627074cd3923eeb03d2899922515c28debd21cbb370f3870d35aed042e0` |
| `fresh-Reveal-source-map-report.json` | 641 | `3f0f0dba2243cbe82675ca7c83b4b3e20713477d5316dc497ed8cd02696aa289` |
| `guard-after-restore.json` | 4214388 | `82129aa408f7688d8a48ed78da4cd6a7c8f0b34dec0d1156409d0cbaf432c6d1` |
| `restoration-scope-audit.json` | 3823 | `b4bd7cad9824a259ec07bc153cbde1cd5d3feda57cea06678ec773544d788e6c` |
| `execution-consumed.json` | 207 | `e2865cafdc2a0d5761539534a2c255c80afa48d2ce8e7828f8cc703453e4e659` |

原件、consumed 标记及原 guard 不改。该新 out guard只给 Reveal 新 ctime `1793100193532575159`，不能盲用旧46fc的 Reveal ctime；未来 baseline 须另获 root 核定实际起点，且不能把 `.build` 漂移纳入“恢复成功”或事后授权列表。

## 2. A：仅补 Reveal 本地 fixture 的既有服务

原 Astra 已高置信度确认、root 提供并采纳为本稿设计输入的固定源码事实如下；来源为原 reviewer / root 直接消息，不伪作作者运行或 formal raw peer：

| 固定3497源码位置 | 静态事实与含义 |
| --- | --- |
| [Reveal 本地 stubLensRuntimeServices](../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts#L348) | 已补 timeline / review / SCM 等并调用共享helper，漏 `IConversationWorkRootMount`；本地 TestInstantiationService 不继承生产 singleton 注册。 |
| [共享 stubConversationTimelineLinkServices](../../src/vs/workbench/contrib/conversation/test/browser/conversationTimelineLinkTestStubs.ts#L83) 的83–86 | 这里只补 window / chat；不能把共享helper内容或83行位置误写成本地helper。 |
| [IdentityStrip](../../src/vs/workbench/contrib/conversation/browser/conversationIdentityStrip.ts#L163) 的163 / 248 | 构造注入该 token，随后直接读其 `onDidChangeOffer`，与本次 openErrors 的缺值读取相符。 |
| [WorkRootMount](../../src/vs/workbench/contrib/conversation/browser/conversationWorkRootMount.ts) | 已有无服务依赖的真实 `ConversationWorkRootMountModel`；无需新建服务替身或改生产注册。 |
| [Lens.test](../../src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts#L560) / [SessionSplit.test](../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionSplit.test.ts#L94) | 已有 `store.add(new ConversationWorkRootMountModel())` 的本地 fixture 用法可对照。 |

A 获得独立实施授权后，源码白名单只有 Reveal 一个文件：从已有 WorkRootMount 模块导入 token 与真实 model，在现有 `stubLensRuntimeServices` 里沿用原 TestInstantiationService / DisposableStore，注册 `stub(IConversationWorkRootMount, store.add(new ConversationWorkRootMountModel()))`。实例归该 fixture 现有 store，保留原释放路径；不新建全局 / singleton / 跨 fixture 共享实例。

除上述 import 与一条本地 stub 外，原 DI 其余项、业务 fixture、engine helper 与诊断后缀、openErrors 收集 / 真实传参 / 默认参数、原3000ms / 事件 / finally cancel / cleanup、13新 / 26旧 / defaultQuiet 及全部 assertions 逐字保持。不给 model 填测试 offer，不手动 fire / bind / acquire，不延长等待，不把 setup 错误改成业务断言成功；生产 Pane / Lens / IdentityStrip / WorkRootMount / 注册均不改。

A 的候选交付应包含固定 commit / src / Reveal blob与SHA、精确 diff，以及仅逆掉新增 import成员与 stub 后整份 Reveal 等于8033的字节证明。先 root 独核，再原 Astra 源码 peer，再由 root 决定真实三路接入唯一 baseline；规则16或本稿通过均不能替代这些门禁。作者本轮不做 AST / lint / module import / checker / compile / emit / tests / runtime 或工具准备。

root 另提供既有 native 输入事实：本次实际1130 loaded集合含 `conversationWorkRootMount.js`，7615B / SHA-256 `77491aa9942ec2fb316ab3a5c705fbfa6602621c1d47632ad4223ef569cb2722`；其 inline sourcesContent 全字节等 fixed3497及当前源，source blob `ee7433788933ee407b5202a98a57bd4fb4bbeb93` / SHA-256 `736b683b191a9c54fa06fd221bab157897a4658c8eaa31f1dbd024c89cc34326`。producer compile10仍只具 `historical-declared-input-only` 资格；该 loaded 事实不证明 model 构造覆盖或新发射。未来新增 import 可读核定的既有 native，**不因此扩大单Reveal发射目标**；未来运行须重新采 actual loaded 字节身份。

## 3. B：唯一 baseline 后续隔离 reporter 附写

B 属于独立工具修订，只能由**非作者的唯一 baseline executor**在 root 单独释放工具准备后开展。E 不进入或修复 B 工位，不动主工位 WIP；不改产品 build 源码来方便测试，不回写 consumed prep2，不先运行再补保护。本稿不创建 bootstrap、patch、driver或新工具目录。

### 3.1 固定静态输入与待查选项

root 只读固定源码提供：仓库 `createCompile` 路径使用无 id reporter；[reporter.ts](../../build/lib/reporter.ts) 61在结束时 `fs.writeFileSync` 固定 `.build/log`，81–85在模块顶层 `fs.mkdirSync(buildLogFolder)` 并吞异常。只改 cwd不足以覆盖这两个调用。旧 scratch emitter 15先 require ts / gulp / es、17动态 import compilation、18 util、19 transpiler，55 createCompile / 56 stream；`binding.mjs` 只用 Node内置与Git读取。以上是静态附写能力，不是原运行逐次 writer 证据。

未来准备者先在届时固定源码上留存以下只读调查，再给出精确工具 diff；在隔离建立前不得 import 任何仓库 / 编译依赖：

1. 核 createCompile / reporter 的实际签名、默认参数、调用点、固定 path 的求值依据与 no-id 条件；核是否真有可关闭附写的现有接口。**本稿不假定存在 logDir / 环境变量 / reporter注入配置**，也不凭参数名猜测可用。
2. 核 reporter的 fs import 形式与最早导入链、顶层 mkdir 的实际 path/options、结束写的 path/data/options及是否有其他写API / 缓存；核 binding及所有预加载不会先捕获未隔离的 fs函数。
3. 核当前out单写 hook、streamToPromise、reporter结束和进程退出先后；隔离须在 require(ts/gulp/es)、import compilation / util / transpiler 之前安装，并持续至子进程所有流收尾 / 退出，不能在 await stream前撤掉。

| 选项 | 本稿取舍 |
| --- | --- |
| 现有受支持关闭 / 目录参数 | 必须先证实签名和作用域；若发现更小接口，交root / Astra重新核方案，不凭空采用或宣称已存在。 |
| 仅改 cwd，或给未知 reporter id | 前者不覆盖固定路径；后者未证实语义且可能改 reporter行为，本稿不采用。 |
| 改仓库 build / reporter源码、扩大 `.build` 可恢复白名单 | 不采用；会改变产品构建或放宽保护，超出本片。 |
| scratch子进程启动处的两项精确 fs 重定向 | **拟采用的最小候选**，下节列出可行性证明条件；尚未实现或经工具审查。 |

### 3.2 两项精确重定向候选

在每个有编译依赖的阶段子进程内，先保存 Node内置 fs原函数，只将**唯一核定 repo `.build/log` 的 writeFileSync**改到该阶段独占 scratch日志；将 reporter **唯一核定 buildLogFolder 的 mkdirSync**改到对应 scratch目录。实际 `data` / `options` 原样交给原函数；不伪造成功、不丢弃日志，也不采用整个 `.build` 路径前缀映射。路径用固定 repo身份与 source求值结果核定，限定实际参数类型 / 绝对目标 / symlink身份；fd、未审查别名或其他调用形态不得自动纳入。

可行性须由未来静态调查及工具 peer证明：

- 补丁先于任何相关依赖导入；若有 ESM named built-in fs导出，核 Node实际版本是否需要 `syncBuiltinESMExports()`，并确保没有提前捕获的函数绕过。不能默认 global patch 对全部模块透明。
- 仅这两个已核调用允许改目标，原调用的参数及结果 / 异常可审计；mkdir仍调用真实 fs到独占 scratch目录，覆盖原模块吞异常的路径。异常或未知调用须置不可吞的阶段失败标记，由 parent判定；不能因 reporter自身catch就判隔离通过。
- 只有这两个精确目标可重定向；其他受保护src / `.build` / node_modules路径写尝试保留实际参数 / 错误与拒绝记录，置不可吞的失败标记并拒绝，不能改成任意`.build`前缀重定向。固定依赖的其他写API也须先纳入静态调用清单，未覆盖则不得执行；正常的其他fs操作保原语义。既有唯一Reveal out单写hook保留，写入/恢复资格须另满足§3.3许可与§4交核；组合patch须证明无提前return、替换引用或恢复顺序绕过out单写，不扩大repo写权限。
- scratch审计用预先捕获的原函数避免递归。每次 redirected mkdir / write保留阶段、目标及实际PID/start、父资格、token、实际调用栈 / 来源、原 / 新路径、实际data bytes/SHA与options、调用次数、intent / completed / error；只记录真实事件，缺调用不填预期次数。原log及目录metadata始终受完整 `.build` guard保护。
- 两项 wrapper只存活于该独占子进程；不修改仓库模块、node_modules或主进程的全局fs。导入路径 / Node导出模式 / 并发语义若无法证明可隔离，即停止并交root重新定案，不退回生产源码patch、整体路径重定向或写后恢复 `.build`。

### 3.3 完整保护必须成为阶段停止条件

在第一项会加载编译依赖的动作之前，固定全量 `src` / `.build` / `node_modules` 起点：完整path-set及lstat：含ignored路径、root及所有descendants的类型 / mode / size / mtime_ns / ctime_ns / symlink target；固定HEAD/src、既有bound source/native/tool哈希、cache links和已有out guard。内容核验限于这些已绑定输入 / 产物与新增reporter精确日志data bytes/SHA，不要求每阶段对整个node_modules内容重新hash，也不声称所有文件内容已独立hash。schema / 排序 / 计数口径一次冻结，同一阶段前后不得更换或忽略新旧路径。所有证据写scratch，禁用Node compile cache与工具自身cache。

**emit阶段在编译stream真正完成后、首次Reveal journal intent / out write之前设置父写入许可门**。spawn前的parent单phase / 单path资格只允许启动该阶段，**不等于stream后的写入许可，也不单独授予恢复权**。child用本阶段唯一请求nonce/ID请求继续；parent独立复核src / `.build` / node_modules全metadata、限域bound bytes及该时点out基线，不能用child自报代替，也不能等Reveal写完才发现漂移。

parent实际授予的不可混用grant须先在可信parent记录落定，再向child发许可；绑定该唯一请求nonce/ID、parent核实的实际writer PID/start与token、phase / 唯一Reveal path、固定fresh bytes/SHA、该次独立guard结果及其证据hash、grant事件顺序 / 单调时间与本阶段有效期限，并给出permit ID/hash。有效期不能超过继承的本阶段单调deadline；拒绝、撤销或期限到达均有真实记录，不以预建phase对象或child请求记录冒充已授grant。child必须核到对应grant才可尝试首次intent；intent消费此许可一次，completed引用同一permit/intent，不是第二次消费，不得跨phase、跨path、重放或重复开始写入。

out journal的intent与completed均绑定该permit ID/hash及同一请求、PID/start/token、phase/path与固定fresh bytes/SHA；保留实际结果，partial / uncertain不能伪填completed。parent的实际grant记录、可信journal和恢复审计必须贯通，具体交叉资格见§4；只有旧spawn资格或未绑定permit的intent不够。

**许可请求、guard、回复与child等待均纳入既有ownership/watchdog的同一个单调deadline**。parent在现有alive监控loop内处理请求并继续监控退出/deadline，guard处理不得阻断该监控；guard完成后、grant前再核同一deadline。guard不能在期限内完成、parent失败/退出或无有效许可时，child不得无限等待、不得写intent / out，按既有停止收束处理。未来工具必须调整原仅监控退出/deadline的loop，不另加第二套超时、重新计时、延长预算或用旧spawn资格fallback。

每阶段终止并确认该阶段 owned quiet后，parent核全部保护范围与out资格；**检查通过才可进入下一阶段**。checker、lint、dry、emit、official run及finally都要核，不能只在最后报aggregate。任何src / `.build` / node_modules路径的新增、缺失或metadata漂移，以及限域bound bytes不符都是硬失败：停止后续业务、停所有owned、保留diff / 原件交root，不将漂移改成baseline、不事后扩大恢复集合。不以write后原bytes相同放过ctime改变，也不touch / utime / 重写未授权路径来伪造ctime恢复。

若发现附写未隔离或scope不足，该次新driver一经消费仍只算该次实际失败；不得自动重试。静态调用链、未看到漂移、成功report三者均不能代替实际writer journal。

## 4. 保留原单写、双观测与恢复协议

未来工具必须逐项继承既有单Reveal诊断协议，不能用本稿重建一个较宽的运行入口：

- 唯一baseline、共享锁 / 全局空闲核定、唯一source/native与fresh工具身份、root独立execution release及one-shot consumed；源自A的候选先完成peer / 真实接入。准备许可不等于执行许可。
- 只允许fresh Reveal测试JS作为潜在out写入目标；旧Pane及其他out / native / WorkRootMount始终只读，不自动Pane emit、model emit、fullnew或fullcompile。
- 两个真实renderer观察目标仍为fresh Reveal与旧Pane；分别收 `scriptParsed` + `getScriptSource`并核完整字节 / SHA，不靠manifest代替实际loaded、不force import制造观察。官方选择仍只L1 + official meta，真实outcome / 官方统计 / hooks / exitcode独立记录。
- 按唯一单个LF紧接 `Engine Pane setup diagnostics: `拆主stack与诊断JSON；只有主stack参与业务mapped frames，嵌套openErrors.stack只作诊断。目标断言按新固定源的真实map冻结，不为674保行号。boundary未建立写 `expected old-red boundary not established`并保实际outcome；仅actual stack + fixed控制流可定位时声明未达，不能定位为unknown；L1 pass如实记pass，不借本诊断授业务red/green。
- 恢复审计必须交叉核定**实际PID/start + parent启动phase/path资格 + parent实际已授grant + 同phase且绑定该permit的可信out journal**，独立核请求nonce/ID、permit ID/hash、PID/start/token、phase/path、固定fresh bytes/SHA与guard结果一致；parent grant必须先于intent，并在**该intent发生时**有效、未撤销且未过期，无跨phase、重放或重复消费。不能只检查spawn前资格、child自报许可或恢复时的当前permit状态。
- 缺失、错误、不匹配、parent未实际授予，或在intent之前已失效/撤销的许可下发生写入，均保留协议违例及实际证据；**不得由旧spawn资格、漂移或intent存在推导恢复权**，不自动将该路径纳入恢复。反之，已经在有效许可下发生的partial / uncertain intent，仍按原可信journal规则收窄实际恢复子集；不得因为之后阶段结束、permit到期或撤销就抹掉该intent发生时已取得的授权恢复资格。无法证明时间顺序/有效性的情况保持不确定并交root，不补造grant。
- 只有审计核定的实际completed / partial / uncertain out子集可在全部owned quiet后恢复；未写路径及ctime不动。以上不扩大out单写范围，不给src / `.build` / node_modules任何新恢复权限。
- **任何结果 stop → owned quiet → qualified restore → 全保护复核 → 原件交root。** 完整src / `.build` / node_modules保护失败不得被out恢复成功覆盖；无权限修复这些范围，失败如实保留。future起点须绑定当时root核定的实际guard，不盲用历史54fe / 46fc / 82129a。

## 5. 顺序、交付与完成边界

| 步骤 | 必要输入与输出 | 当前授权 |
| --- | --- | --- |
| 方案 | 本固定docs commit → 原Astra规则16只读 → root核验并改稿 | 仅本稿与必要索引 / 行动层落位；`draft`、规则16只读审查待 |
| A候选 | root单独放行 → Reveal最小import/stub → 字节逆证 → 原Astra源码peer → root真实接入 | 未授权 |
| B工具修订 | root单独放行唯一baseline准备 → 固定静态调查 / 两项隔离 / 全阶段guards / 新工具diff与哈希 → 工具peer与root核定 | 未授权；本稿不准备工具 |
| 未来一次执行 | 独立root release、fresh身份 / 起点 / consumed、实际outcome、完整原件与恢复边界 | 未授权；不能重用prep2或自动重跑 |
| 正式业务与产品验收 | 精确旧源合格L1业务old-red、固定新源完整矩阵与原Reveal回归；非作者真实默认编辑器after | 仍为未来门禁，不由本稿或诊断抵扣 |

- [ ] 原Astra固定b349f6规则16 C0/I1/M1已回、root采纳；本稿I1/M1窄改须原reviewer复核并经root确认全关，再由root另授accepted，不自行判通过或启实施。
- [ ] A另获授权并完成固定源码peer / root接入。
- [ ] B另获准备授权、静态可行性与工具peer通过，完整保护阶段停止条件已核。
- [ ] 未来一次execution另获授权并如实交付；无自动retry / after。
- [ ] 正式old-red / new-full与真实默认编辑器after另行完成，才评估旧lease方案实施状态；不升PRD / 旧D / 波。

## 6. 原Astra规则16与本次窄改（2026-10-27）

原reviewer Astra对固定b349f6正式为**C0/I1/M1**，由root直接转发会话消息，非terminal raw。root在ce09a4独核旧validate397/420–438/523–528后采纳I1/M1；本作者未新增源码/工具调查。[行动记录](../progress/sources-accept-post-read-authorization-checkpoint.md#e-lease-emitter父许可与恢复资格规则16窄修订2026-10-27)保留b349f6完整原plan、SHA、原Astra正式全文及署名/转发来源；原实际两项缺口C0/I2/M0与所有consumed原件保持。

I1仅将parent实际grant与journal/恢复审计连通，并区分intent时授权和事后permit状态；M1仅明确继承deadline及现有alive loop内的有界处理。原A片、B两项精确fs重定向候选、metadata/限域bytes、单写/双观测/实际outcome/停止恢复与未来业务门禁不扩大。本稿仍draft、I1/M1关闭待原reviewer窄验及root核验；两项重定向仍待未来静态证明/工具peer，未实施、准备或执行，不自动重跑或after。

本轮只运行docs generator / health / diff与只读字节 / metadata核对；不改源码，不作编译 / lint / AST / 模块加载 / 测试 / runtime / toolprep / out或cache写。所有既有原件与历史失败保持，当前fresh保护只界定E本次文档区间，不补写任何工位旧连续性。
```

### 原Astra正式窄验全文（署名/直接消息来源如上）

root转发正文（本地含末LF）1454B / SHA-256 `10e40e0ce51989fce857a951a497d9bf1dd6295e6730a0bacd9c3f294539290f`，不伪造terminal raw：

```text
原Astra窄验原消息内容转发（direct-message，非terminal raw）：
**Strengths**
固定db02c9c815f1bb7517910ba3bf9583a562709e57已核，方案141行/22659B，SHA256 e90e77d5398f3fa31f90d6ea8e351696b971e2c6f68897ccf3c194480bf7fcf9。parent正确，src未变；§1、§2、§3.1全字节保持。
- I1已在方案层关闭。:94–98,114–116明确区分启动资格与实际grant，把请求、writer身份、phase/path、fresh bytes、guard证据、许可身份及时间顺序贯通到journal和恢复审计；旧启动资格不能兜底。按intent当时有效性判断，也保留之后过期情况下的合格partial/uncertain恢复资格。
- M1已在方案层关闭。:100将请求、guard、回复及等待纳入原monotonic deadline；监控不能被guard阻断，授予前再次核期限，parent失败或缺许可均不能继续写入。
- 未增加目标、恢复范围、超时体系或执行授权。
**Critical：0**
**Important：0**
**Minor：0**
**Assessment**
本次窄验C0/I0/M0，未发现修订引入新问题。原b349f6的C0/I1/M1历史结论保留；本结论仅关闭方案问题，工具实现与可行性仍须后续独立审查。状态继续draft，待root裁定。
证据口径更正：14240B/f2a0d1…4af98是单篇plan diff；完整五文件diff为57962B/ba5ed63cf5175c2e499726f8e57bc2a84ba277e467525a5209762c0ca0ec7de6。
本轮仅固定Git文本与字节核验，未改文件、运行候选工具或模块。
```

### 差异口径、知识层扫描与原status

14240B / f2a0d1e079e34ae4ac2b3c67c8b644be97421e967b730e69dfdc7e8aecf4af98仅为b349f6→db02c9的单篇plan diff；完整五文件diff为57962B / ba5ed63cf5175c2e499726f8e57bc2a84ba277e467525a5209762c0ca0ec7de6。本作者本轮只读git diff固定两commit复核完整五文件bytes/SHA吻合，不混称“完整diff”。原I1/M1、原C0/I2/M0、所有失败/consumed与完整历史前缀保持。

按DOCUMENTATION规则3c扫描docs/中本plan路径/标题与父许可/emitter隔离叙述，rg实际exit1、无匹配；另读conversation知识层/glossary/testing并核session-windows§1.1，叙述仍指旧lease候选及未来red/new/after门禁。本次只把独立窄plan签收，不实施、升级旧lease或产品状态，无知识层叙述需要改口，故不为状态收口修改既有系统规格。

db02c9原status200行，首条含LF 1179B / SHA-256 `189a61240c295bb67556967fa53063e3d402cc8e31920430ac0fc36a57a8ad42`；原summary/首条原样保留：

```markdown
summary: "原Astra规则16对b349f6 C0/I1/M1经root采纳；仅方案补父写入permit与恢复资格绑定、intent时有效性及继承deadline；仍draft待窄验，不实施/工具准备/执行。"
- **Conversation lease emitter许可/恢复规则16窄改（2026-10-27）**：原Astra正式b349f6 C0/I1/M1，root ce09a4独核旧工具后采纳；仅改[方案§3.3/§4/§6](../plans/conversation-visible-lease-harness-and-emitter-isolation.md#33-完整保护必须成为阶段停止条件)：spawn资格不等于写入许可；parent实际grant绑定唯一请求nonce/ID、PID/start/token、phase/path、fresh bytes/SHA、guard与阶段期限，intent/completed绑定permit ID/hash，恢复独核已授/intent时有效/先后/无重放重复。缺错未授/事前失效保违例不推导恢复权；有效intent的partial/uncertain仍按原子集恢复，不因事后阶段结束丢资格。M1继承单调deadline，在原alive loop处理，parent失败/退出/guard不能完成则child不无限等/不写；不加超时体系。b349f6完整原稿/正式消息与署名[保留](sources-accept-post-read-authorization-checkpoint.md#e-lease-emitter父许可与恢复资格规则16窄修订2026-10-27)，原C0/I2/M0/失败/consumed不动。仍draft，I1/M1全关待原Astra/root；不实施/工具prep/执行/重跑/after，old-red/new-full/真实默认编辑器after仍未来。
```


### accepted收口实际文档门禁与本次fresh保护

实际工具返回如下，保combined原样，不伪独立stdout/stderr；rg的exit1表示知识层直接题名/路径检索无匹配，不是文档门禁失败。generator实际更新INDEX生成状态列，再--check0；health558 Markdown/0errors/73链接warnings。无源码/业务/产品验证信用。

```json
[
  {
    "command": "rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/generate-docs-status.py",
    "exitCode": 0,
    "combinedOutput": "dev/plans/INDEX.md: 状态 column updated\n"
  },
  {
    "command": "rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/generate-docs-status.py --check",
    "exitCode": 0,
    "combinedOutput": "generated status: OK\n"
  },
  {
    "command": "rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-docs-health.py",
    "exitCode": 0,
    "combinedOutput": "Docs health check\n- markdown files checked: 558\n\nErrors: 0\n  required_entries: 0\n  module_indexes: 0\n  system_indexes: 0\n  generated_status: 0\nWarnings: 73\n  frontmatter: 0\n  links: 73\n    - AGENTS.md: broken local link: dev/loop/INDEX.md\n    - AGENTS.md: broken local link: dev/loop/worktrees.md\n    - dev/decisions/004-diff-owner.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/047-typed-slot-hosts-and-vscode-bottom-panel.md\n    - dev/decisions/004-diff-owner.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/051-workbench-preview-and-sources.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/systems/session/session-config-panel.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/input/chat-input-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-process-fold.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md\n    - dev/plans/conversation-process-fold.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/009-session-projection-core.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/012-chat-stream-lifecycle-and-outbox.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/013-engine-event-ingestion-reliable.md\n    - dev/plans/conversation-timeline-refactor.md: broken local link: ../loop/worktrees.md\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: ca38f5b8-c713-49a4-8dbf-dfe9728dec22\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: f52a7649-f824-4d57-9601-dc745d71870c\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: 77c10215-cd67-4db7-b240-cd9f7e6fcfe4\n    ... 43 more\n\nResult: passed with warnings\n"
  },
  {
    "command": "rtk proxy git diff --check",
    "exitCode": 0,
    "combinedOutput": ""
  },
  {
    "command": "rtk proxy rg -n 'conversation-visible-lease-harness-and-emitter-isolation|补齐本地 fixture|隔离 emitter|父许可.*恢复|emitter.*隔离' docs -g '*.md'",
    "exitCode": 1,
    "combinedOutput": ""
  }
]
```

只读字节核对实际返回：

```json
{
  "planBytes": 24338,
  "planLines": 149,
  "planSha256": "734fc7a49cb68187bcecc09a2c7fa2c45533a2794fff3bd383cd1b9957e6940c",
  "sections1Through4WholeExact": true,
  "db02PlanOriginalPreserved": true,
  "db02CheckpointBoardPrefixPreserved": true,
  "statusLines": 200,
  "statusChangedOnlyLines": [
    7,
    12
  ]
}
```

本次db02→accepted纯docs起止相同，schema沿此前作者docs fresh记录：排序descendant path对象（含目录，非原交付regular-file closure），full mode/size/mtime_ns/ctime_ns/symlink或null，默认ensure_ascii compact JSON SHA，排root inode与atime；仅prep1/prep2原件目录regular files另附SHA，其余是metadata核对，不声称全node_modules内容hash。只证明本次E区间，不补历史连续性、不扩为merge工位保护。

| 范围 | path对象数 | 开始=结束SHA-256 |
| --- | ---: | --- |
| src | 15036 | `a523d6684e113a9fb7d8b474d2c49ae3bd0599b0c66b00f6fb3d3ed59da1dd9b` |
| out | 14865 | `25b31cc67d5b7e445d4dfabbbc17c8908f413140566ff80d2319ff0aafad5add` |
| .build | 416 | `829445637c75055067dbba3ab6c7efa1edac1052d3f2fc7d8a0b1d8e0193bb7e` |
| node_modules | 47159 | `3dfb0c2ec9524556bdc2275069b59b001806808535574d5ffcc08577a82ca61b` |
| prep1 | 332 | `9e36edc4e6388ed89ed251e56a19384a64cd37b6f6226f999cfe77e3d9608972` |
| prep2 | 355 | `e6c964a3e7a66821b5d9ddf58e6c7b7c0f7cec4b6ead7fb57f7501f6b012835b` |

完整db02/b349原稿、原C0/I1/M1及新C0/I0/M0署名/直接来源、原C0/I2/M0与全部失败/consumed历史保留；checkpoint/board的db02全文保持前缀，status200行只7/12改。未源码/编译/lint/AST/module/checker/emit/tests/runtime/toolprep/out/cache写，未ff/同步merge/接入3a14d6，不进A片；普通scoped docs提交后停。


### 固定ea92窄方案真实双亲接入（2026-10-27）

真实merge 80dc02d8a98e1190dd9039c810431c3105786588，严格双亲3a14d6ed28c03f54668ae06ea47f45bc23b8f171与ea92e8da62ab9c12da0681867114acbe187c1004，真实base8033a3c23ba2b0550e817c9cc4fdebf4d12a4478；src完整保持ours fa6f7fe9f339963dd9f4190f44aa17e45f6ad731。只接入accepted两片plan及四docs真实冲突解法：四文档/五块分别保存default与diff3完整canonical、每块三方/outside/resolution及全文重放；union1931、无争议1927、外22242逐mode/type/blob精确。新plan24338B/SHA734fc7a49cb68187bcecc09a2c7fa2c45533a2794fff3bd383cd1b9957e6940c整篇incoming字节不改，原§1–4亦等于reviewed db02。Sources四窄implemented、lease accepted/overall active及旧原件/失败/consumed保持。

当前全局授权另作澄清：root已另授A片且原Astra对固定4f2648d936508e300475c9cd52e5855a58c7ed93源码候选C0/I0/M0，经root02ff独核采纳；它尚未接入本次plan-only/srcfa6。merge当前摘要沿用旧“源码待授”时态，原文字节仍在merge与重放raw；本次独立proof/docs仅将当前摘要/首条澄清为“候选已peer、未接入，B工具准备/运行待另授”，不改incoming plan当时历史叙述。没有新运行成绩或业务/coverage/after信用。3a14诊断driver0/protocol accounted-official-outcome/official1/out恢复complete、fixture缺WorkRootMount及全.build保护FAILED/合C0/I2/M0明确保留；.build/log仍为[]且旧mtime/ctime漂移不恢复、不加例外。

证据与双方首条含LF原件见[接入证明](conversation-visible-lease-harness-isolation-plan-integration-20261027-evidence/INDEX.md)；原审查署名来自root直接消息及incoming保留文本，不伪造原reviewer终端raw。797文件/223012410B及215非普通entry、旧结果proof280、out15500/native256/freeze4/cache3与ownedquiet本区间精确保留；src15715/node_modules48772全metadata同，.build6777仅已知log漂移。独立proof/docs待root检查和单独commit授权，不准备工具、不Program/lint/compile/tests/runtime/after，不push或同步main。

## E lease A本地WorkRootMount真实模型最小候选（2026-10-27）

root d251c9 actual0已独核固定ea92 accepted plan24338B/149行/734fc7a4、§1–§4 wholeexact、仅规则16checked/5docs/src不变/status200/clean并接受；其后root直接消息**独立只授权A片source-only**。本作者固定clean parent ea92e8da62ab9c12da0681867114acbe187c1004，不同步/merge baseline/main/B槽/后来文档或源，不碰原包。来源为root直接消息，不伪作reviewer raw；原Astra C0/I0/M0只关方案问题，不能挪作本候选源码peer。

唯一源码改动：Reveal新增一条从既有conversationWorkRootMount.js导入ConversationWorkRootMountModel/IConversationWorkRootMount的import，以及本地stubLensRuntimeServices首行instantiationService.stub(IConversationWorkRootMount, store.add(new ConversationWorkRootMountModel()))。真实无依赖model即时归原store，不另改DI/helper/服务/cleanup，不碰生产或其他test。

候选Reveal 81721B / blob `feb55eeed2013c948ae487bdba8217887d2fc0b5` / SHA-256 `8a9c3245ae661b68e160c6a1c0d79924159618da7b342c5b09cd46caa1f35e61`，正常写后mode33204、mtime_ns/ctime_ns 1793102573588466705/1793102573588466705；不修ctime。精确source diff 1839B / SHA-256 `a50b287e8edad10c307226f6f9853f8bd0ddc5fb685905b2161382cdbcb50aa3`：

```json
{
  "utf8GitSourceDiff": "diff --git a/src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts b/src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts\nindex c7710eb9398..feb55eeed20 100644\n--- a/src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts\n+++ b/src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts\n@@ -32,6 +32,7 @@ import { ConversationSessionChatService, IConversationSessionChatService } from\n import { switchToSession as switchToSessionHelper } from '../../browser/conversationLensSessionBar.js';\n import { ConversationSessionWindowService, IConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';\n import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';\n+import { ConversationWorkRootMountModel, IConversationWorkRootMount } from '../../browser/conversationWorkRootMount.js';\n import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';\n import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';\n import { ConversationEngineRosterService, ENGINE_BIND_FAILED_SESSION_ID, isEngineRosterPlaceholderSessionId } from '../../browser/conversationEngineRosterService.js';\n@@ -346,6 +347,7 @@ suite('Conversation session window reveal + leaf SessionBar (C)', () => {\n \t}\n \n \tfunction stubLensRuntimeServices(instantiationService: ReturnType<typeof workbenchInstantiationService>): void {\n+\t\tinstantiationService.stub(IConversationWorkRootMount, store.add(new ConversationWorkRootMountModel()));\n \t\tinstantiationService.stub(IConversationTimelineRevealService, {\n \t\t\t_serviceBrand: undefined,\n \t\t\tregisterLens: () => ({ dispose: () => { } }),\n"
}
```

逆变换：仅删除上面唯一新增import整行及stub整行，余下**整份Reveal**逐字等Git8033 / ea92的c7710eb939872d378394c7084ccf95bb50f4b4c2，81494B / SHA-256 404034f9dd15c2cf6143c44b624b0dbb398da25b27f16d962a2f01bef982388d。因此原3s/事件/finallycancel/诊断catch与同原error处理、全部13新/26旧/defaultQuiet/cases/assertions/cleanup的原字节均保持；不靠行号或局部摘取声称一致，未来实际source map仍须新冻结。

当前只记**静态最小候选，未peer、未运行**；plan仍accepted，B pending。没有AST/lint/Program/checker/compile/transpile/emit/tests/runtime/toolprep/after/out/cache，未改model生产源码或增加发射目标，不预称真实setup已修好。root独核固定候选→原Astra源码peer→root未来另裁真实接入/执行；候选提交后停。

ea92原status200行，首条含LF 1089B / SHA-256 `16526c9b11d49855659f4f3e9d71e630eeadfa0c30ce036189a7da240590c9fc`；原summary/首条含LF原样保留：

```markdown
summary: "root采纳原Astra固定db02c9窄验C0/I0/M0、I1/M1方案层全关；仅独立窄plan文档accepted并勾规则16，A源码/B工具准备/运行仍未授权，旧lease/产品与业务after门禁不升。"
- **Conversation lease fixture / emitter窄方案accepted（2026-10-27）**：原Astra对固定db02c9正式窄验C0/I0/M0，root020951 actual0独核身份/单篇plan diff/§1/2/3.1/完整grant-journal恢复链后采纳，I1/M1仅方案层全关；本轮仅[本窄plan](../plans/conversation-visible-lease-harness-and-emitter-isolation.md#7-原astra窄验全关与root独立accepted2026-10-27)draft→accepted及规则16勾选，A源码/B工具准备/运行仍分别待root授权，交付后停。完整db02/b349原稿及原C0/I1/M1/新C0/I0/M0署名与直接消息[保留](sources-accept-post-read-authorization-checkpoint.md#e-lease-fixture与emitter窄方案accepted文档收口2026-10-27)；14240/f2a0仅单篇plan diff，完整5文件57962/ba5ed63c，不混称。root报proof3a14d6已验但E未接入/不称合入。知识层叙述已扫，仅新窄plan签收无需改旧系统规格；旧lease/产品/PRD/旧D/波状态不升，业务old-red/new-full/真实默认编辑器after仍未来。纯docs/gates/fresh保护，不源码/工具准备/运行，不开A片或自动重跑/after。
```


### A片本次允许门禁、整份逆证与fresh保护

实际docs返回如下（combined原样，不伪独立stdout/stderr）。一次diff检查exit2仅因checkpoint中原样unified diff上下文的“空格+tab/空白context行”触发文档whitespace；随后把该精确diff作为JSON字符串无损保存，source一字不改，最后diff0。JSON还原UTF-8仍1839B/a50b287e，不以改动源码躲避检查。health558 Markdown/0errors/73链接warnings；未运行任何源码分析或业务验证。

```json
[
  {
    "command": "rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/generate-docs-status.py --check",
    "exitCode": 0,
    "combinedOutput": "generated status: OK\n"
  },
  {
    "command": "rtk proxy env PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-docs-health.py",
    "exitCode": 0,
    "combinedOutput": "Docs health check\n- markdown files checked: 558\n\nErrors: 0\n  required_entries: 0\n  module_indexes: 0\n  system_indexes: 0\n  generated_status: 0\nWarnings: 73\n  frontmatter: 0\n  links: 73\n    - AGENTS.md: broken local link: dev/loop/INDEX.md\n    - AGENTS.md: broken local link: dev/loop/worktrees.md\n    - dev/decisions/004-diff-owner.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/047-typed-slot-hosts-and-vscode-bottom-panel.md\n    - dev/decisions/004-diff-owner.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/051-workbench-preview-and-sources.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/decisions/007-upstream-sync.md: broken local link: ../loop/worktrees.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/systems/session/session-config-panel.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/input/chat-input-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/docs/ui/components/status/message-queue-bar.md\n    - dev/plans/conversation-empty-hero.md: broken local link: ../../../UniverseAgent/singularity/dev/plans/message-queue-layout-preview.html\n    - dev/plans/conversation-process-fold.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md\n    - dev/plans/conversation-process-fold.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/009-session-projection-core.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/012-chat-stream-lifecycle-and-outbox.md\n    - dev/plans/conversation-stream-timeline.md: broken local link: ../../../UniverseAgentDesktop/dev/decisions/013-engine-event-ingestion-reliable.md\n    - dev/plans/conversation-timeline-refactor.md: broken local link: ../loop/worktrees.md\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: ca38f5b8-c713-49a4-8dbf-dfe9728dec22\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: f52a7649-f824-4d57-9601-dc745d71870c\n    - dev/plans/conversation-timeline-session-pills.md: broken local link: 77c10215-cd67-4db7-b240-cd9f7e6fcfe4\n    ... 43 more\n\nResult: passed with warnings\n"
  },
  {
    "command": "rtk proxy git diff --check (before encoding the documentation copy of unified diff)",
    "exitCode": 2,
    "combinedOutput": "dev/progress/sources-accept-post-read-authorization-checkpoint.md:1418: space before tab in indent.\n+ \t}\ndev/progress/sources-accept-post-read-authorization-checkpoint.md:1419: trailing whitespace.\n+ \ndev/progress/sources-accept-post-read-authorization-checkpoint.md:1420: space before tab in indent.\n+ \tfunction stubLensRuntimeServices(instantiationService: ReturnType<typeof workbenchInstantiationService>): void {\ndev/progress/sources-accept-post-read-authorization-checkpoint.md:1422: space before tab in indent.\n+ \t\tinstantiationService.stub(IConversationTimelineRevealService, {\ndev/progress/sources-accept-post-read-authorization-checkpoint.md:1423: space before tab in indent.\n+ \t\t\t_serviceBrand: undefined,\ndev/progress/sources-accept-post-read-authorization-checkpoint.md:1424: space before tab in indent.\n+ \t\t\tregisterLens: () => ({ dispose: () => { } }),\n"
  },
  {
    "command": "rtk proxy git diff --check (after lossless JSON encoding of that documentation copy)",
    "exitCode": 0,
    "combinedOutput": ""
  }
]
```

只读字节核对实际返回：

```json
{
  "sourceBytes": 81721,
  "sourceBlob": "feb55eeed2013c948ae487bdba8217887d2fc0b5",
  "sourceSha256": "8a9c3245ae661b68e160c6a1c0d79924159618da7b342c5b09cd46caa1f35e61",
  "sourceDiffOnlyTwoAdditions": true,
  "inverseWholeEquals8033AndEa92": true,
  "otherTrackedSourceUnchanged": true,
  "planSections1Through4WholeExact": true,
  "checkpointBoardEa92FullPrefix": true,
  "statusLines": 200,
  "statusChangedOnlyLines": [
    7,
    12
  ]
}
```

授权Reveal的正常metadata起点/终点如下，不touch或修ctime：

```json
{
  "before": {
    "RevealOldMode": 33204,
    "RevealOldMtimeNs": 1793094912226150000,
    "RevealOldCtimeNs": 1793094912226150000
  },
  "after": {
    "RevealNewMode": 33204,
    "RevealNewMtimeNs": 1793102573588466700,
    "RevealNewCtimeNs": 1793102573588466700,
    "RevealNewSha256": "8a9c3245ae661b68e160c6a1c0d79924159618da7b342c5b09cd46caa1f35e61"
  }
}
```

其余范围fresh开始=结束。schema为排序descendant path对象（含目录、非regular-file交付closure），full st_mode/size/mtime_ns/ctime_ns/symlink或null，默认ensure_ascii compact JSON SHA；排root inode与atime。src仅排除获准Reveal，仍含其目录；只有prep1/prep2目录regular files另附SHA，不宣称其余全量内容独立hash。仅本次ea92→A片区间，不补旧连续性，不扩成merge工位证明。

| 范围 | path对象数 | 开始=结束SHA-256 |
| --- | ---: | --- |
| srcExceptReveal | 15035 | `c2c15c686e1feca4284a5c87b2315ce59fc8aa508ed90c7a394b5ca2f2017c8c` |
| out | 14865 | `25b31cc67d5b7e445d4dfabbbc17c8908f413140566ff80d2319ff0aafad5add` |
| .build | 416 | `829445637c75055067dbba3ab6c7efa1edac1052d3f2fc7d8a0b1d8e0193bb7e` |
| node_modules | 47159 | `3dfb0c2ec9524556bdc2275069b59b001806808535574d5ffcc08577a82ca61b` |
| prep1 | 332 | `9e36edc4e6388ed89ed251e56a19384a64cd37b6f6226f999cfe77e3d9608972` |
| prep2 | 355 | `e6c964a3e7a66821b5d9ddf58e6c7b7c0f7cec4b6ead7fb57f7501f6b012835b` |

本候选plan仍accepted，B pending；源码只授权两行，无AST/lint/Program/checker/compile/transpile/emit/tests/runtime/toolprep/after/out/cache写，不同步baseline/main/B槽，不碰consumed原包。提交后停，source peer与真实运行结论待root另行安排。


### 固定4f264 WorkRootMount fixture A静态源码真实接入（2026-10-27）

真实merge ed5650112ef887eb925a5f9ca8fc2c7055c2b7c4，严格双亲5e31574f7cc296f4cefe94ad7994d19559fd2522与固定4f2648d936508e300475c9cd52e5855a58c7ed93，base ea92e8da62ab9c12da0681867114acbe187c1004；tree7463da54bde14f5a22885c612c58cc63d92073f5，src3dc1205763451e60e70c1a8a84465613990aa526（非incoming整src）。仅Reveal取incoming两新增：既有token/model import与本地store.add真实model stub，81721B/blobfeb55eeed2013c948ae487bdba8217887d2fc0b5/SHA8a9c3245ae661b68e160c6a1c0d79924159618da7b342c5b09cd46caa1f35e61；逆两整行完整还原ours/base c771，其余全部src ours。原Astra正式源码C0/I0/M0经root02ff whole inverse采纳；root d278f5/e5c733独核24417路径/双亲/tree/src接受，只A静态peer+接入完成，不称真实setup已修好。

四docs/五blocks保存两种canonical和十块full/side/base/outside/resolution、八份整文重放。union2176/无争议2172/外22241全mode/type/blob精确；board/checkpoint保wholeours前缀，incoming独立尾914→913B/13659→13658B，前导2LF→1LF，所有非前导LF内容精确。INDEX保ours七key及四Sources implemented，只更新新A行摘要；status只当前summary/首条且200行，双方原首条含LF独立原件保留。[本次完整证明](conversation-visible-lease-harness-work-root-mount-integration-20261027-evidence/INDEX.md)。

源码Git改写只令Reveal文件与browser父目录metadata变化；含root15716项after快照与live全等，其余src metadata保持，不虚称旧全src tuple不变。新source overlay与旧native分列：Reveal旧JS147236B/49a3a5…be5d，Pane旧42101B/74b657…9629，out15500现有guard/Reveal原ctime不动；256pairs/freeze4/cache3、797文件+215非普通entry、旧outcomeproof280与已提交planproof244全FS不变。node_modules48772全metadata精确，.build6777仍只有历史log漂移、内容[]，原whole.build保护FAILED/旧driver0/protocol accounted/official1/out恢复complete及C0/I2/M0均保持。root ac0113 fresh独核本区间通过不倒改原失败。

plan仅A静态完成、整体仍accepted；B工具准备/独立peer、实际执行和业务old-red/new-full/非作者真实默认编辑器after仍分别待root授权/门禁。无Program/lint/compiler/transpile/emit/tests/UI/runtime/after或emitter准备；不消费旧包、不写native/cache，不同步main/B，不push。仅本proof/docs冻结交root，commit另授。

### Conversation B隔离工具源码三轮审查（2026-10-27）

固定70ee/src3dc120，原Astra静态可行性/parent-WAL选择预审C0/I0/M0不抵扣实现审查。v1正式C0/I4/M1未过：raw.writeFileSync Buffer重入已patch API、漏readFile写flag和Node26 disposable、audit失败可能被reporter吞、辅助记录可能跳过quiet/恢复/实际exit；M1旧current身份另列。root独核Node内嵌源码采纳；后增link/symlink真实类型/相对源解析补充归I2，不计I5。跨设备repo相对示例会EXDEV，同/tmp旧consumed file-URL反例是静态推导，未执行链接或写入。

v2整24只改5/其余19原字节，原Astra正式C0/I1/M0：I1/I3/I4/M1及link已在源码层关，残余I2是encoding getter可把已检查的私有flag改w+。root独核绑定Node getOptions offset57416846的读取顺序采纳。v3新副本整24只改fs-isolation:166的writable/configurable为false及报告、22份不变；原Astra窄SOURCE-ONLY C0/I0/M0/root采纳，剩余I2关闭。全24whole/hash/line/unified分别由root与原reviewer独核；v1/v2根/快照/index、旧consumed不动。[固定原件、源码24raw与重放、syntax及采纳记录](conversation-emitter-isolation-source-review-20261027-evidence/INDEX.md)。

只做Node --check/Python ast.parse，真实stdout/stderr/exit与早轮inline来源分开保存；未import候选/getter/link探针或运行checker/lint/emitter/compiler/tests/UI。根工具未promote，whole-package closure/finalpins NOT_DONE，release/activation=false、prepared0，无stage/runtime目录。该docs-only提交不改src/旧native/out/cache；source审查输入仍70ee，未来封包须另绑定届时HEAD，不追改固定索引。plan/lease accepted、Sources四窄implemented和旧8033 driver0/protocol accounted/official1/out恢复complete/全.build FAILED及业务未达均保持。当前本段覆盖上文“B准备待授”的历史时点，仅到源码层完成，不授后续阶段。


### new prep1唯一失败恢复接收与下一draft（2026-10-28）

此前各段保留历史时点。root另授且仅一次new-prep1，HEAD59e2411/src3dc120、source固定5f，prepared0原audit213113B/4cf752f8、外inventory211352B/98f1ce12、548项/426regular/424pins；原五字段激活/唯一driver与原raw均保留。六stage实际[0,0,0,0,0,-15]，driver/wrapper1；先发生original hidden-delete false≠true（generated1297:12→frozen源码1360:10），随后official45s watchdog终止afterEach，才有缺official.loaded-assets下游协议异常。22pass/1fail/17未完成、新13全未开始，134/133hooks对238，官方JSON/自然CDP终态未完成；lint0error/4warnings。不得称new业务绿、loaded相等或failed-body leak-clean。

固定driver完成qualified2/restore2；root独核并采纳原Astra actual C0/I0/M0后正式接受bytes/mode/mtime原样恢复、仅2授权ctime，当前43stage+outerRTK+realPython=45实际PID/start全quiet、Xvfb系统路径无残留、双kernel锁无holder，原5203/4094列明hash、main65/index、source/native256/bound149/freeze4/cache3/context119095/external27318/direct471/shared79021均保护。postrun889项/667regular/670182927B，完整9项只读审计0错误。finalguard20160038B/SHA2566dd885b1b070b9042e611c8db4e7170d6f029cbd712af57afbed3761f3a71f13是未来立即恢复前态；old6601/a5b历史链仍原封。new P/D永久consumed failed不改不重跑。root已正式回收compile lane，当前无人获运行权，不给after/C/F/I新资格。

外部证据根 `S=/sdd/tmp/vscode-conversation-visible-lease-new-business-20261028-prep1-review/new-once-driver-static-proposal-20261027T231237732486Z`，原件不复制成成功记录：

| S内文件 | bytes | SHA256 |
|---|---:|---|
| actual-new-business-terminal-handoff.anchor.json | 2077 | 789cfe6666497db9d52ae95bbbf87602c553239ca5343f7dad1e917d2e4a208f |
| actual-new-business-terminal-handoff.index.json | 25486 | 5ddccbadefd83d2bafb4d79f5943edee77f28dec187810807c05e3327f5e32ce |
| postrun-independent-readonly-audit.actual.json | 11947 | 908aba120f4f3fe553fee5c48bbf909272ea3045d6cc6b5dae3722b53f0585b0 |
| actual-failure-chronology-hook-cost-and-inline-map.json | 11705 | da2e969a1101f3fb30ae01b52b2ba2b8c157830aea5ff0e3c32b0e74564fddfb |
| root-formal-new-failed-recovery-acceptance.receipt.json | 4066 | 9e3979daa89704de65141182a607d799500d43fd5cdb3828145bbac54c31e00d |
| root-formal-new-failed-recovery-acceptance.anchor.json | 673 | f29dd7cd1b4dbba234006ff4a5668a7a78766b3261d203d20a5145df0d6d696c |
| next-fixture-and-official-budget.static-proposal.md | 6984 | 71d7c8009cba2addc5f3b1d9e8da7d8e5b3eb1984b7c10b28b74e2d7733c31f7 |
| next-fixture-and-official-budget.contract-amendment.addendum.md | 2355 | 0ea010da16be6f6e87261d2cc207c5596b9d4d7cc999599a1d96b47bace767e6 |

正式receipt准确署名为root直接消息摘录；原Astra C0/I0/M0及方向裁定是root转述，不伪造reviewer raw。root采纳Astra窄兼容方向并选择official180作draft候选：只改既有hidden-delete callback一行openSessionBeside→revealSessionWindow，保title/断言；不能继续称整份新Reveal等于old8a9c。old仅L1/meta未执行该callback的证据适用性、逐字不变范围/逆证及未来全40的清理非干扰条件，连同仅official180/其他45/Mocha15/双RAF不变，均须[新draft](../plans/conversation-visible-lease-reveal-fixture-and-official-budget.md)固定稿Rule16分别审查；方向裁定不是Rule16通过。计数精确为其余37业务case+meta，即40除L1/hidden-delete的38项。工具实际类名OwnedStage，独立新版本仅最少消费字段绑定，不原位改5f13或扩展全部schema；static proposal中的泛称由本draft精确化。

主lease仍accepted，new draft保持draft，未授source/tools/新包/运行/commit，不重跑old或本失败包，I build/after/ready=false保持。本轮前status原首条完整保留如下；新status仅用同一行数更新当前失败入口：

- **Conversation lease old prep3业务红及完整恢复接收（2026-10-28）**：workspace649/src3dc、runtime source固定5f，唯一driver0/official1、六exit[0,0,0,0,0,1]；meta过/L1主断言645:14→固定676:11，10/10hooks、4warnings保留。Pane/Reveal双fresh自然loaded=sealed dry=独立emit；qualified2/restore2、原bytes/mode/mtime全复、仅两ctime，12/6/2guards及4169原保护通过；41身份quiet/两锁unheld。postrun903项/686regular/727069378B、finalguard6601，原AstraC0/I0/M0/root正式接收及固定receipt a5b51b30，P/D封口不重跑。原失败/纠正与I static-only保持，失败体不称leak-clean/全编译/after；新40/238及非作者真实默认editor after待，I build/after/ready=false，plan accepted。[证据](conversation-visible-lease-old-prep3-qualified-20261028-evidence/INDEX.md) / [§12.12](../plans/conversation-visible-lease-recovery.md#1212-old-prep3合格业务红与完整恢复root接收2026-10-28)。

### 新draft首轮Rule16 I1窄补（2026-10-28）

root转述原Astra对固定9747B/SHA2b0367e1…的正式Rule16为C0/I1/M0并采纳；不是reviewer raw。本轮只补[新输入与最新恢复前态绑定](../plans/conversation-visible-lease-reveal-fixture-and-official-budget.md#51-新输入与最新恢复前态绑定首轮rule16-i1)：old a5/6601资格祖先与本次9e/f29/6dd恢复前态分开完整验链、715→6601→6dd不跳过；新Reveal实际inputs/workspace/src/HEAD/consumer合同重绑，旧256pairs完整不变、Reveal独立资产身份与未emit边界、仅单test及parent metadata范围。只允许fixture、输入/workspace、最新恢复lineage、official预算四类未来差异，原5f13/P/D原封；不靠删equal放宽，不修改工具。

原固定plan9747/2b0367与原六path handoff2883/e2819a独立保于S/rule16-I1-original-draft-and-handoff/，root-forwarded-rule16-I1.receipt.json准确归因root转述摘录，无伪造raw。§2/§3/§4原规范全文逐字保持；本稿仍draft/I1待窄复核，不accepted、不commit、无源码/工具/新包/runtime；失败actual及已接收恢复/归还lane不变。

### 新窄方案正式规则16关闭与accepted文档（2026-10-28）

root转述并采纳原Astra对固定13540B/SHAe6225637…的I1窄复核C0/I0/M0，设计门关闭；首轮9747/2b0367 C0/I1/M0及改稿均独立保留，绝非覆写原审。S/rule16-C0-original-draft-and-handoff/保原13540/e622与handoff3241/290f原字节，root-forwarded-rule16-C0-and-docs-acceptance.receipt.json准确标为root转述摘录，未造reviewer raw。[新窄方案§7](../plans/conversation-visible-lease-reveal-fixture-and-official-budget.md#7-原astra窄复核与独立accepted2026-10-28)仅作独立accepted/机器精度解释，§2–§4整段仍逐字同原稿，主lease accepted不升级。

实际对象引用只f29→9e→789c/5ddc/908a/6dd，不反向加字段；index恢复/保护/quiet锁及audit原九个唯一check全passed、failedCheckCount0/errors[]/两路径两ctime/finalguard核验，9e按真实顶层结构核准确consumedfailed/noRetry/laneReturn，不从prose补bool。原pending字节由后续9e接收闭合，不需另造bridge receipt。root仅另授本六docs生成状态/文档门禁/一次scope commit，不push/amend，不动main65/index；source仍3dc，无源码/工具/新包/runtime/after/C/F或I新资格。


### fixture A一行源码候选与独立保护（2026-10-28）

root独立接收 `e37fc6c3419fae03f484a6d11e8c4b58e7e6b84e`（parent59e、tree595ccd、src3dc）后，另授source slice A及必要五docs。只改 `src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts` 既有hidden-delete callback1357行 `openSessionBeside(secondaryId)` → `revealSessionWindow(secondaryId)`；其余全部源码字节/mode同，未格式化。工位始终merge；下称E只是独立外部evidence目录变量，未操作E历史worktree。

| 固定输入/候选 | bytes | Git blob / SHA256 |
|---|---:|---|
| b078 old整份Reveal | 81721 | `feb55eeed2013c948ae487bdba8217887d2fc0b5` / `8a9c3245ae661b68e160c6a1c0d79924159618da7b342c5b09cd46caa1f35e61` |
| 未提交A候选整份Reveal | 81723 | `80434706a2e91218fa3f1c0c130b4697981db4b8` / `d470c31670caf21b35698d8663ad7bcf6a72022fbf247910265e2a6f4af7498b` |
| Pane未变 | 15270 | `98ba56dacc166c24d263112940c7aee0a0363357` / `90c0719d26183f27ae8e4fbcbead63d6f7e6c4aef64c1bbc39a898a65b1501d3` |

E=`/sdd/tmp/vscode-conversation-visible-lease-fixture-A-20261028-candidate1-20261027T235336740102Z`，只写新独立证据目录，已封P/D/S只读。`fixture-A.exact-source.diff` 仅一行；`fixture-A.source-reverse-proof.json`（2647B/SHA256 `3ae30888d541b89ae3751e425f45cbcc9163d480b6dc43338aa788cb291d64db`）证明整段prefix/suffix相同，逆替换完整恢复old81721/8a9c且等于Git b078原文；old/candidate/reverse整份copy各固定0444。12,165 tracked source blobs全量活字节/模式比较仅目标改变，Python离线重建基线src恰3dc，再得候选src `c1267f27d022ecaa417ef9065825fb53bacc21ea`；未写Git objects/index，未来commit ref待。

`fixture-A.protection-before.json` 28411065B/SHA256 `24503f6fd12f30c736c270709f0cfcc8df5893360e757e7fc0aa37f6d9a2ac47`；`fixture-A.protection-result.json` 2796B/SHA256 `d033c5f5d76f9ec8f83acbc2bbc04ca9580eb92d3bea584d68eb24990da641dd` 及完整after快照证明：root-inclusive src15716/pathset同，metadata仅目标文件变、parent未变；out15500/.build6778/node_modules48773全pathset/metadata严格同。256 source/native pairs全原bytes/SHA/metadata，Reveal不在256内，不造1/255；freeze4/cache3、main65内容/status/HEAD/src与main index metadata/SHA全同，guard6dd原件同。merge HEAD仍e37、staged raw空；主/新plan仍accepted，§2–§4规范逐字保持。

reader偏差原文保留：首次 `rtk git status --short` 漏设OPTIONAL_LOCKS0、输出clean；未捕到该命令前的merge index metadata，不宣称此前tuple不变、不改回ctime。此后Git均显式optional0；单行写前所捕merge index样本到after严格同，main index始终有独立前态。after-source capture首试exit1/StopIteration因误猜Pane为test文件名，原错误存 `fixture-A.after-source-capture-attempt1.error.json`；按before准确身份改读 `conversationEditorPane.ts` 后只读capture成功，未放宽断言或吸收漂移。docs编排首试因Markdown反引号JavaScript SyntaxError未进shell、无写；次试在三docs写后因checkpoint保存多段历史summary而selector断言失败，未写checkpoint/board；改为只选当前frontmatter后继续，原错误与准确partial-write纠正均留E。

本次仅必要五docs与一test，Python文档门禁/精确diff检查结果随固定handoff另列。未AST/syntax/lint/Program/Node/compiler/emit/tests、新tool准备/编辑、新runtime包或锁/cache/freeze写入，未stage/commit。source peer待root交原Astra，commit另授；official180尚未实现。原new consumed failed/6dd恢复接收、old a5/6601已签红及历史全保、未重跑；I build/after/ready=false，new40/238、自然loaded、完整恢复/清理非干扰与非作者默认editor after/C/F无新信用。替换前status首条全文（含原换行）保留：

- **Conversation lease new prep1失败恢复接收/窄方案accepted（2026-10-28）**：唯一driver1/official-15，原hidden-delete Assertion→45s watchdog→缺loaded-assets；22pass/1fail/17未完成，new13未开始、hooks134/133对238。qualified2/restore2原bytes/mode/mtime精确仅2ctime，45ownedquiet/双锁释放、原5203/main65/index等保护经原AstraC0/I0/M0/root独核接收，finalguard6dd885b1为直接前态；old6601/a5b已签红原封，失败包永久consumed不重跑，lane归还。[actual/外锚](sources-accept-post-read-authorization-checkpoint.md#new-prep1唯一失败恢复接收与下一draft2026-10-28) / [新draft](../plans/conversation-visible-lease-reveal-fixture-and-official-budget.md)：一行前置/同输入例外/official180及I1绑定经C0/I0/M0/root采纳，仅设计accepted；主plan accepted，I build/after/ready=false；无source/tools/新包/runtime/after/C/F信用，未commit。


### fixture A源码peer正式签收（2026-10-28）

root直接消息转述原Astra正式FINAL C0/I0/M0并采纳固定81723B/d470c316/blob80434706静态资格与accepted§3有限兼容。准确署名为root转述，非reviewer raw，不伪造原消息、不另扩归档。独核exact one-line及whole inverse；真实reveal链在单primary初态提升新叶、隐藏并保留旧leaf/part；1360–1368全部assertions与真实delete disposal链保留，shared/L1/import/注册/hooks/全部assertions同；256 source/native+mode零差异，原native哈希同。

源码自81723固定后未再改，仅补本次必要docs与重做受改动影响的Python文档门禁/diff-check。仍未stage/commit；root核最终保护handoff后另授同主题commit，tools/新包/runtime未授。清理非干扰、full40/238、自然loaded、恢复仍须未来实证，official180未实施；主/新plan仍accepted，原失败/已接收恢复与old已签红不变，I build/after/ready=false及after/C/F无新信用。

最终保护handoff首试的reader断言另存E：docs-health errors/warnings为分组dict，误作平数组计数导致exit1；实际counts0errors/46warnings且before/after全文JSON相同。失败前source/root/256/freeze/cache/main/index全保护断言已过，最终report未生成；纠正为读取实际counts，不放宽保护或消去错误。重捕获结果随最终handoff列明。原“待source peer”status首条保留：

- **Conversation lease一行fixture A候选/待source peer（2026-10-28）**：root接收e37纯docs后另授merge既有hidden-delete1357行openSessionBeside→revealSessionWindow；Reveal81723B/blob80434706/SHAd470c316，精确一行逆证恢复b078原81721/8a9c，12,165 tracked源码仅此blob变，候选src离线c1267f。src15716仅目标metadata变；out15500/.build6778/node_modules48773全metadata/pathset、旧256pairs/freeze4/cache3及main65/index精确。[身份/保护/原首条](sources-accept-post-read-authorization-checkpoint.md#fixture-a一行源码候选与独立保护2026-10-28) / [plan§8](../plans/conversation-visible-lease-reveal-fixture-and-official-budget.md#8-root另授的一行fixture-a未提交候选2026-10-28)；主/新plan均accepted。候选未stage/commit，待root交原Astra源码peer；无tools/新包/AST/Node/compiler/emit/tests/runtime，official180未实施。原new失败/6dd恢复接收与old已签红原封，I build/after/ready=false，new40/238/after/C/F无新信用。
