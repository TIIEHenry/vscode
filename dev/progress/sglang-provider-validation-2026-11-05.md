---
title: "SGLang Provider 与任务评测验证（2026-11-05）"
type: progress
status: in_progress
phase: N/A
updated: 2026-11-07
summary: "retry10 八个场景完成且 strict gate 仍失败；真实默认编辑器 SGLang a5 与 b2 无观察器原四步通过；F21 第二真实模型是本机 magpie 网关，默认编辑器 magpie 路径尚未运行。"
---

# SGLang Provider 与任务评测验证

## 范围与证据位置

服务为 `http://192.168.10.68:8192`，模型 `Local`；此配置不能代表其他模型、Provider 或 IDE Composer。
retry10 的 UniverseAgent commit 为 `1e253d6aeeb856b13e02e6db14868f95ca0dbc26`，所有报告记录 `dirty=false`、`protocol=openai-response`、`fixtureVersion=workspace-v2`。
仓外根目录 `/sdd/tmpworkteees/UniverseAgent-continue`，以下路径相对该根：

- JSONL：`build/reports/task-level-eval/sglang-workspace-v2-responses-ablation-k3-retry10-1e253d6aee-20261105/`。
- XML：`integration-tests/build/test-results/test/TEST-universe.agentic.integration.tests.OpenAiResponseTaskLevelEvalTest.xml`。该通用测试输出可能被后续执行覆盖，应结合本轮 JSONL 的 runId `f55892d1-7b68-4f04-998f-ec6dee7295b2` 和终态记录识别。
- 进程 `3965789/3966906` 已退出，八个 JSONL 均有 summary，随后 hash/mtime 复核稳定。没有保留直接 Gradle shell exit code，不能代报具体数字。

## 协议与认证历史

同 commit 的 campaign `sglang-l4-1e253d6aee-20261105` 曾记录 Anthropic、Chat、Responses 各三个场景、五次尝试共 45/45 pass（78 次 LLM 请求、30 次 root tool start，`usageQuality=unverified`）。覆盖文本流终止、工具结果回灌、权限拒绝，不是 F21 两模型稳定性矩阵，也不是默认编辑器端到端验收。

随后最小请求发现三协议均接受无认证与无效 token（HTTP 200）。Anthropic 和 Chat 的 1-token 请求报告输入 11 / 输出 1；Responses 使用 `max_output_tokens=16` 时输入 11 / 输出 14 / reasoning 14。`max_output_tokens=1` 的 HTTP 400 属预算约束，不是认证拒绝。认证拒绝门禁未验证。

后续通过脚本重跑 all/Anthropic 曾在 Kotlin 编译阶段遇到 Gradle daemon disappeared，降低堆后仍复现，没有产生新 L4 记录。当时根盘约 18G、/sdd 约 528G 可用，swap 已满；没有 OOM 文本，不能据此断言 OOM 根因。

retry9 是不完整的前序记录：short-alerts 两侧 3/3；short-orders normal 3/3、ablated 2/3；parallel-checkout 两侧 2/3 且路由诊断失败；parallel-collections 当时两次结果通过但路由失败；两个 long 场景未产报告。它不替代下面完整的 retry10。

## retry10 终态

XML 记录 tests=1、failures=1、errors=0、time=2323.441s；异常为 `L5 ablation strict failures`，列出 parallel-checkout(normal-failures=2)、long-ledger(3)、long-inventory(3)、deep-queue(1)。

下表统计的是 `result`，不把独立的 `routeConformance` 当作相同指标：

| case | normal 通过/尝试 | ablated 通过/尝试 | 路由与失败观察 |
| --- | --- | --- | --- |
| short-alerts | 3/3 | 3/3 | route 不适用 |
| short-orders | 3/3 | 2/3 | ablated 一次 fixture assertion；route 不适用 |
| parallel-checkout | 1/3 | 3/3 | 两侧均缺所需 subagent / agent_spawn 路由 |
| parallel-collections | 3/3 | 3/3 | 两侧均缺所需 subagent / agent_spawn 路由 |
| long-ledger | 0/3 | 0/3 | 各一次 executor 异常，其余 fixture assertion 与 compact route 缺失并存 |
| long-inventory | 0/3 | 0/3 | 六次 fixture assertion；ablated attempt 4 的 route 为 pass，其余 compact route 缺失 |
| deep-storage | 3/3 | 3/3 | 六次均缺 deep_think route/tool |
| deep-queue | 2/3 | 3/3 | normal 一次 executor IllegalStateException，其余均缺 deep_think route/tool |

long-ledger 的 normal 首次为 IllegalStateException、ablated 首次为 IllegalArgumentException，均 `routeConformance=not_applicable`。异常捕获后没有 observation，空工具列表不能证明执行中从未调用工具。

**勘误：**先前“long 场景因缺少 compact 而 fixture 失败”的因果描述不成立。任务 verifier 和路由诊断独立；long-inventory ablated attempt 4 已满足 route，但仍任务失败。JSONL 中的异常类也不足以定位 executor 根因。

## Terra 代码诊断与最小实测

以下源码路径相对 UniverseAgent 的 `integration-tests/src/test/kotlin/universe/agentic/integration/tests/`，针对上述 commit：

- `ProductTaskAgentExecutor.kt:98-113,165-173` 使用生产 root agent、prompt 组装、registry、compact bootstrap 和 AgentLoop 执行任务；不是绕开产品工具的普通文本请求。
- `ProductTaskAgentExecutorTest.kt:28-35` 的合同包含 normal 的 agent_spawn/deep_think/context_compact；ablated 移除派生路由，保留 compact。源码/测试合同并不等于已捕获最终发给服务的工具 schema。
- `TaskLevelWorkspaceFixtures.kt:104-107,117-137` 的 parallel 提示只要求独立处理，deep 任务为简单约束三选一，未强制调用 deep_think。当前观察与模型直接读写完成简单任务相符；尚不能证明适配器丢调用。
- 路由 adapter 根据 ToolCallStart、DeepThinkDimensionStarted、CompactStarted 等实际事件计数；需要完整 runtime trace 才能进一步排除事件缺失。
- `TaskLevelEval.kt:182-187` 给 normal/ablated 使用同一任务合同，没有移除 ablated 禁用的 required routes。因此 ablated 的 parallel/deep route fail 是对照诊断，不能直接当作模型在可用工具上的能力失败。
- `TaskLevelLiveAgentLoopTest.kt:166-175` 的 strict gate 检查 normal 任务失败和 passAtK 可用性，未将 routeConformance 或 ablated 失败纳入 gate；strict green 也不足以证明路由和两侧结果全部通过。

2026-11-05 Terra 两次直接调用同一 `/v1/responses`，显式提供简化 deep_think 函数 schema，并要求从 reliability、simplicity 两个维度分析。两次均收到 function_call；保留的请求使用 `tool_choice=auto`、`max_output_tokens=300`。这证明显式引导下的函数调用协议能力，**没有执行该函数，也不证明生产工具执行、自主路由或完整 AgentLoop 成功**。

仓外保留请求/响应：`/tmp/ua-sglang-deep-think-probe-20261105-terra.json`；SHA256 `9215c3b5aa2fee955504feee8eddcf1856699c3fd6cc244cb2e7f8411712ba15`，UTC 时间 `2026-11-04T23:59:42.254256+00:00`，HTTP 200，响应函数参数为 `{"dimensions":["reliability","simplicity"]}`，无认证信息。

### 显式 deep_think 运行时探针

随后 Terra 使用既有编译产物、独立 JUnit Platform/JShell 运行 `MultiAgentRealLlmIntegrationTests.deepThink_shouldRunTwoDimensionAnalysis`，服务仍为 SGLang `Local`。终态为 1 found / 1 started / 1 successful、0 skipped / 0 failed，64823ms，进程 exit 0。输出位于 `/tmp/ua-sglang-deep-runtime-20261105-terra/`（`output.log`、`exit.txt`、`probe.jsh`），未调用 Gradle，也未覆盖共享 `test-results`。

该方法在 system/user prompt 中明确要求 deep_think，断言确实出现工具调用、工具结果与 TurnComplete；但结果断言为 `content contains deep_think || !isError`，不足以保证工具结果非错误或两个维度均成功。日志出现 ConflictValidator 和结果 spill 提示，只能支持进入工具内部，不能据并发 worker 推断子调用全部成功。`Local` context window 未知，运行中回退到 agent window 200000。

编译产物 mtime 为 2026-11-05 05:09:41.979 +0800，源码为 00:32:53.623 +0800；产物较新及工作树 clean 不能单独证明字节码严格对应上述 commit，因此此结果仅作为受控运行时诊断。默认 logback 还写入 `/home/clarence/.universe-agent/logs/universe-agent.log`，并非所有输出都隔离在临时目录；没有清理该共享日志。后续独立探针必须在 JVM 启动前指定独立日志配置或隔离的 user.home。

### 结构化维度运行结果

同日追加一次显式只读探针，仍使用既有 class 与 Responses/Local 配置，但直接订阅事件并收集返回 flow，以对象身份去重。输出目录 `/tmp/ua-sglang-deep-structured-20261105-terra/`，`output.log` SHA256 为 `d7a86acf4b18181317dc53b2d1943c8373f6c8715ad359ad22a03b2c358ffe4c`，`exit.txt` 为 0。实际观察为：

- 112 个事件，1 次 root deep_think 调用、1 个工具结果，`isError=false`。
- simplicity 和 maintainability 各有 1 次 started / completed，均 `success=true`、`cancelled=false`，两份模型分析正文已记录。
- DeepThinkCompleted 为 `outcome=SUCCESS`、`success=true`，汇总正文存在；未观察到 QueryEvent.Error。

探针实际创建 `OpenAiResponseProfile`，配置 `OPENAI_RESPONSE_BASE_URL=http://192.168.10.68:8192/v1`、`OPENAI_RESPONSE_MODEL=Local`，仅使用非秘密占位 key。日志开头 endpoint 为脚本打印的配置，运行时事件记录 model_id=Local；没有 HTTP wire trace，不能声称独立抓包验证了请求地址。脚本 `probe.jsh` 的 SHA256 为 `0ff8f4f1cc0623836a2020ee8e28c5914418b02672c3c040346e6d2fa1459b43`。classpath 来自既有 Gradle worker 文件，执行时未完整封存 classpath/各 class 哈希，仍只作诊断证据。

此结果补足上一单方法未检查的维度结果，证明本次显式要求下的双维度工具执行成功；不证明生产自主路由、质量稳定性、所有异常路径或两模型矩阵。未知 context window 回退与缺 session context 的 spill 跳过仍出现；既有 class 的来源限制也仍保留。

预检先发现 JShell `-J-Duser.home` 只影响启动器，执行 JVM 仍加载共享日志；该预检写入共享日志，未清理。改用 `-R-D` 并指定独立 logback 后，实际确认执行 JVM 的 home、cwd、日志目标均在本次临时目录，才开始本次 LLM 请求。

## 单次 long-inventory 产品执行器诊断

为定位缺失的失败细节，随后只采样 normal `long-inventory` 一次，保留原 fixture 提示、生产 registry/prompt/权限/compact 配置，未强制路由或修改验证器。配置为 OpenAiResponseProfile、同一 SGLang/Local。执行前后源码均为 clean `1e253d6a…`；150 项 classpath 路径、目录内类与资源已在运行前后做 SHA256，0 项变化，manifest hash 均为 `286d690f64d0b7f83f57e7da3a1c3936bbb2639d67f083d5b418e3b281433998`。这能固定所用字节，不能替代从该 HEAD 的可追溯构建。

运行根 `/tmp/ua-sglang-long-inventory-product-20261105-terra/` 保留完整 workspace、输入哈希、预期输出、事件、验证器重放和退出码。实际执行 JVM 的 home/cwd/tmp/logback 均已预检在该目录；请求前没有把预期答案交给 agent。

执行器正常返回，耗时 231071ms、14 turns、29 tool calls，但原 `fixture.verify` 为 failed。`exit.txt=0` 仅是诊断脚本完成，不是任务通过。独立重放原验证器得到 `FileNotFoundError`：**要求的 availability.json 没有生成**；12 个不可变输入的内容哈希未变。这解释本次验证器的失败，不反推 retry10 每次失败原因。

运行中实际观察到：

- 一次 shell_run 被拒，原因是 `Auto-approve blocked: declared capability supplied no evaluable judgment facts`；命令包含 cd/for/wc/命令替换。后续模型读取文件、搜索工具，部分重复 file_grep 又被循环检测阻断，最终没有写出结果。该拒绝是可见障碍，尚无证据证明它单独导致失败；不得通过关闭权限检查换取通过。
- 四次 pre_routing CompactStarted 均对应 CompactCompleted FAILED，摘要为 `summarize returned null`。当前路由观察按 started 计数，route pass 只证明选择/尝试了该路线，不能当作压缩成功。也不能仅凭本次观测证明压缩失败导致未产文件。

`output.log` SHA256 为 `16e47c2eebf97a018d87dcd3e14228db7688e6cf01faad081b181a068cc160f5`；`verifier-replay.log` 保存原验证命令的非零终态，`workspace-diff.json` 保存文件比较。保留该失败，不进行无变化的全 catalog 重跑。

### 对诊断原因的源码复核

UniverseAgent 的 `integration-tests/docs/task-level-eval.md:35` 对 LONG 只要求一个 compact event，当前 CompactStarted 计数符合这个“曾启动”的合同；不将它直接判为统计 bug，也不将 route pass 升格为 compact 成功。若将成功结果纳入门禁，须先明确新合同。

`summarize returned null` 在 `CompactExecutionCore.kt:80-103` 对应摘要函数返回空；异常另走捕获分支。`LlmCompactStrategy.kt:50-88`、`CompactSummarization.kt:104-137` 及 `TranscriptSlice.kt:67-81` 可涉及空 prefix、client 空结果、空文本或解析失败等不同原因。四次失败耗时约 6–32ms，未见空摘要/解析 WARN 或摘要请求事件；这不足以确定命中了哪条分支。单条 user 加多轮工具是否被 keepTurns 全部保留、导致 prefix 为空，是下一步本地回归假设，不是本次已证明的运行时原因。

权限源码将不可解析 shell 信息作为 opaque，并按 fail-closed 合同拒绝。原命令包含 shell 变量与命令替换，但现有日志未输出判断事实投影，不能从通用错误文本断言具体触发项；不关闭权限检查。下一步可在本地验证该命令的 opaque/拒绝行为，并为压缩空结果增加不含正文或凭据的结构化原因。

### 空 prefix 的本地合成对照

随后用同一冻结 classpath 做纯本地 `TranscriptSlice.from` 对照，不创建 LLM、不读真实会话。`keepTurns=3`，每个 user 后接五组配对 assistant/tool：1 user 共 11 条得到 prefix=0/keep=11；3 user 共 33 条得到 prefix=0/keep=33；4 user 共 44 条得到 prefix=11/keep=33，exit 0。脚本与结果在上述运行根的 `slice-synthetic.jsh` / `slice-synthetic.log`。该行为说明单用户多工具长任务值得补永久回归；仍不能替代 live prefix 计数。

## 默认编辑器的首次真实模型配置采样

本轮执行官方 `test/scenario/scripts/run-universe-agent-real-editor.sh`，使用 clean `027ab7ed03ac5b64023ed6090f8610b22cc2b8ac` 生产预包（built_at 2026-11-01T08:51:44+08:00；121 项库哈希匹配）。它与上面 `1e253d6a…` 的集成测试不是同一引擎版本。外层只配置 OpenAI Chat 协议、SGLang `/v1` 和 Local 合成模型目录，没有启动本地 SSE fixture。

运行根 `/tmp/ua-real-editor-sglang-20261105-rgpn0679`；报告及截图在 `artifacts/evidence/universe-agent-real-editor-2026-11-05T00-29-25-723Z/`。原四步断言保持：

| 步骤 | 结果 |
| --- | --- |
| production-loopback | pass：默认 editor 连接真实本地引擎 |
| submit-real-input | pass：Composer 点击提交；不证明模型已调用 |
| tool-and-assistant | fail：30 秒内没有真实 process fold |
| reload-history | 未运行 |

wrapper exit 1，报告 outcome=failed。失败截图显示 `MODEL_PROFILE_REQUIRED: No model profile selected for this session`，Composer 显示 No model。引擎日志确认 registry 加载一个 coding 模型，隔离配置形状符合 pinned 代码；但该轮未记录 ListModels 响应或 UI 映射结果，不能归因为用户没手选，也不能称 SGLang Provider 调用失败。

当前 Composer 对非空有效 catalog 会自动选首个 enabled 模型；空槽省略 modelProfileId 是既有兼容合同。仅凭本次错误，不把所有 No model 一律改成禁发。后续先比较公开 ListModels 与 UI 实际 options/选中值，再决定配置、映射或时序修复。

隔离工具已修复并验证：wrapper 保持 EXIT trap、统一 artifact 根、Electron 显式 shared-data；Node 24 正式 automation/scenario 编译和 9 项路径/参数/真实子进程回归通过。实际 user-data/extensions/shared-data 均落在本波唯一 TMPDIR/vscsmoke，JVM user.home/cwd/日志也独立。全部已记录自有 PID 退出，50161 关闭，外部 PID774085 保留。

公共 artifact 的 141 文件与旧 engine home 的 66 文件前后内容哈希完全相同。没有采集日常 shared-data 的 before/after 哈希，只能按实际参数与目录落位证明隔离，不称全部用户目录内容未变。`source-artifact-manifest.json` 的 182 文件覆盖 engine VERSION/manifest、wrapper/scenario、scenario 与 automation 源码/产物，不包含产品 client src/out；不能用它替代 client 运行模块身份核验。

### 同配置公开模型目录复核

同一合成 home 随后只启动新 owned 引擎 PID581838，用已安装 grpc-js/proto-loader 和公开 proto 调用 Config.ListModels；没有 editor 或 LLM 请求。使用该 home 的证书为信任锚并验证名称，gRPC status=0，返回 Local / enabled=true / type=coding / provider=openai / modelId=Local。记录在 `catalog-probe/rpc.log`；预包哈希匹配，结束 TERM exit143，50161 再次空闲。

这证明该配置能够通过 RPC 暴露模型，下一步转向 IDE 的 capability/owner、拉取/映射与选中时序。它是后续新启动的只读采样，不能倒推先前 editor 那次 ListModels 已调用或成功。

### 本地身份发布缺口与公开 nonce 复核

修复前核验的 source 和 out 中，`_connectLocalSkipAuth` 最终提交均未提供 engineIdentityId；Composer 的 `readComposerModelOwner` 要求 engineIdentityId/linkId 齐全，缺失时跳过 ListModels。ConnectResult 与对应 wire 本来没有该身份字段，不能通过增加假定字段或放宽 owner 检查解决。修复方案见[本地身份发布](../../archive/dev/plans/loopback-engine-identity-publication.md)。

Terra 在同一隔离 home 另启 owned 引擎 PID600981，使用内存生成的合法 Ed25519 公钥/hash 调用公开 System.GetAuthNonce。`nonce-probe/rpc.log` 记录 gRPC status=0、32字节 nonce、非空 engineIdentityId，响应指纹等于实际 TLS 证书 DER SHA256；请求仍验证该隔离证书与名称。没有 DeviceAuth Connect、Grant、SAS 或模型调用；进程 TERM exit143、50161 释放。此证据支持通过已锚定 transport 获取真实身份，不是 IDE 修复后的结果；UDS 未做实际引擎采样。

### 本地身份修复的代码与自动层验证

Sol 已按已审方案实现：在同一可信 transport、arm 之后用内存 Ed25519 challenge 获取引擎身份；TCP 对开 transport 前捕获的 pin 交叉校验；缺身份/nonce、指纹错或 RPC 失败不发布 owner，失效的 resolve/reject 不覆盖赢家。identity、link 与 capabilities 一次提交；不依赖持久 keyring，未放宽 Composer owner 或空模型提交合同。

- 红证据 `/tmp/loopback-identity-red-20261105.log`：旧生产 out，UDS/TCP 新身份断言均 actual undefined，整套 29 passing / 2 failing。
- `/tmp/loopback-identity-build-20261105/`：最终 `compile-client-final.log` exit0，`node-final.log` 746 passing / exit0，`composer-catalog-electron.log` 40 passing / exit0。Node24.18；最终正式编译 src 前后 SHA 清单一致，测试后 src/out 均未变，见 `compile-final-result.json` 与 `post-test-integrity.json`。
- `composer-catalog.log` 是 Chromium 37 passing / 2 failing，两项原测试依赖 process.on；官方 Electron 通过不代表 Chromium 套件全绿。`eslint.log` exit0，3 条原有 import/disposable warning。
- 独立 Sol 实现审查 C0/I0，父窗口复核通过。最终仅连接服务与 localEngineDiscovery 测试改动；真实 TCP editor、真实 UDS 及完整 SGLang 四步另记，不以自动层替代。

随后仅删除新增测试的一行多余空行并单文件转译，生产 source/out 未变。`post-format-diff.json` 明列这两个测试文件差异；最终运行清单为 `src-post-format.sha256.tsv` / `out-post-format.sha256.tsv`，`node-post-format.log` 再验 746 passing / exit0。没有为格式修改重复全量编译，也不声称最后一次测试源码字节等于正式编译前清单。

### 失败窗口的工作目录复核

截图的工作根显示 agent-home，文件树也挂载它，但这不能证明实际工具在该目录执行。Terra 只读查询本次 `workspace/.sessions/session-100/messages.db` 的 session_meta，work_dir 是本次隔离 workspace；marker.txt 同样在此。PIN 以进程 cwd 作为默认 AgentEnv.workDir，Session.Create 无指定目录时继承该值，wrapper 确实从 UA_REAL_EDITOR_WORKDIR 启动。尚未有 file_read，所以只确认创建与持久元数据。

Connect.workDir 固定返回 agentHome；IDE 在没有会话 workDir 时回退连接目录并可挂载本地根。这与显示偏差一致，后续须采样会话目录何时传播，不能复制 marker 到 engine home 掩盖问题。失败截图的 Loading queue 也可能受缺失 owner 影响；下一次真实运行独立检查其收敛，不凭单帧断言持续时长。

## 身份修复后的真实默认 editor 重跑

运行根 `/tmp/ua-real-editor-sglang-20261105-1c068e7430e7/`，原 scenario 四步、prompt、marker、断言和 timeout 均未修改，也没有本地模型 fixture 或代理。报告为 `artifacts/evidence/universe-agent-real-editor-2026-11-05T00-56-01-007Z/report.html`，整体 failed，wrapper exit1：前两步通过，第三步等待最终 marker 的原 60000ms 超时，第四步未运行。

只读观察器通过自有 Code PID/临时 CDP 端点接入，未点击、改 DOM 或关浏览器。45 次 DOM 采样确认 native model select 的 value=Local、selectedIndex=0，唯一选项 enabled/selected；队列是 No queue。截图 `composer-local-observed.png` 同时显示一次成功 file_read 与工具前的助手说明。由此确认缺身份造成的 No model/Loading queue 已在本次运行消除，不等于完整四步通过。

引擎记录 Local 第一轮 tool_calls、file_read 成功读取精确 marker；第二轮 end_turn、output_tokens=72。UI 最后仍仅显示 “I'll read the marker.txt file to check its contents.”，没有最终 marker。Terra 只读解码合成会话数据库：message_envelope seq12 的 ASSISTANT 正文已经包含完整最终回答和两次 marker，id=`session-100:msg:t-f52c5be9:a4`、is_active=1，parent_turn_id 指工具 turn；seq13 branch 关联最终 turn。UI 只呈现 seq5 的工具前正文。因此已排除该次模型空回复/未持久化，尚未区分持久化后事件发送、wire 消费与 IDE 投影。后续先离线重放真实 envelopes，不盲目重复模型请求。

会话 session_meta.work_dir 为隔离 workspace；UI 工作根仍为 agent-home。SessionInfo.work_dir field7 在 PIN 与 IDE wire/mapping 中均存在，但新会话 adopt 未补元数据为候选断点，尚未修复。该显示偏差未阻止本次 file_read 正确读取 workspace。

来源与隔离：运行前后 12186 个 src、11987 个 out 均匹配最终 manifest；实际 app 为本仓 out 默认 workbench，三项目录参数和 PID 已留证。日常 shared、test shared、公共 artifact、旧 engine home 内容哈希及原本不存在目录状态均保持；见 protection-before/after.json、result-summary.json。所有自有 wrapper/engine/runner/Code/观察器退出，50161 关闭，外部窗口 PID774085 保留。模型与结果归属有配置、运行日志及持久记录支持，没有独立 HTTP wire 或服务端 access log，不把 Electron network.log 冒充 SGLang HTTP 证据。

### 真实记录离线投影

只读事务导出 seq1–14 到上述运行根的 `offline-projection-input/envelopes-seq1-14.json`，SHA256 `f96d62b0fe84411fa5a1504c4202f92a8361536f6dc0761970bdd34a53231806`；manifest 记录原 DB SHA、连续顺序及 mode=ro，未改原库。Sol 用临时 Chromium 承载当前 compiled demux → domain fold → applyViewPatches → entries/renderable turns，最终 seq12 助手正文可见，marker 两次，exit0；日志 `/tmp/ua-browser-projection-replay-20261105.log`，结果同名 `.json`。仅做 DB→wire 的枚举/arguments 表示适配，未生成文本或替换 ID。

这排除“正常 envelope 经纯投影必然吞掉第二轮正文”，单凭该步未覆盖 actor/mailbox。随后追加真正 SessionActor 的 acquireLease→connectionUp→日志所见 hello→enqueue streamEvent：从同一 14 行得到的 seq3/5/7/12 四个 domain 事件均被接纳，seqIndex 含 12→a4，snapshot 保留最终文本，6 个 frames，exit0。再用该 actor snapshot 经浏览器投影仍 finalVisible=true、marker 两次、exit0。记录为 `/tmp/ua-sessionactor-replay-20261105.log` / `.json` 与 `/tmp/ua-sessionactor-browser-projection-20261105.json`；src/out 未改。

hello0 的 unknown_cursor bootstrap 没有 history fill 请求，cursor 仍 known:false；本次重放没有因 seq 间隙丢掉最终记录。仍未覆盖真实 L3 lifecycle、branch_topology_notified 事件交错，也不证明原运行客户端已收到 seq12，不能宣布单方根因。PIN 的 SessionEventStream 发送 hello/headSeq 和实时 L2，历史补读另走 GetHistory；不能表述为同一个 cursor 重放流。下一步检查持久化→实时 L2 发送与当时交错顺序。

Terra 静态追到同一生产链：每轮 assistant/tool_result → onMessageCreated → EventPublishingMessageStore 的提交后 append/batch 通知 → SessionEventBus → SessionStreamMapper → 同一 SessionEventStream collector/bridge。未找到 tool_calls/首轮 TurnComplete 特别关闭订阅的规则。Bus 无订阅时不保留实时 replay，DB 落盘不能证明通知已送到 IDE；连接直到场景结束才取消也不能证明期间 collector 正常消费。后续应先捕获 seq range/event arm 在发布、发送、客户端接纳的边界，不凭现有证据重写投影或宣布服务端根因。

另补真实二进制 decoder：Sol 使用 PIN 的公开 proto 与已装 protobufjs，从同一真实记录重建逐条 append、全14行 oneBatch、1–11/12–14 splitBatch 三组 protobuf bytes，依次进入当前 decodeSessionStreamEvent→demux→SessionActor。三组均保留 seq12/a4 的最终文本；oneBatch snapshot 再走浏览器投影可见 marker 两次，exit0。日志 `/tmp/ua-protobuf-batch-replay-20261105.log`、`/tmp/ua-protobuf-browser-projection-20261105.log`；bytes 在 `/tmp/ua-pin-proto-replay-20261105/`。这是按 PIN 协议重建的批次边界/outer seq/sessionVersion，不能当作现场抓包或已覆盖未知 branch/L3 交错。

原窗口的临时 inspector 元数据取证补充已通过独立规则16复审 C0/I0：在自有 main 启动 resume 前注册 A/B/C，之后核脚本 hash/resolved，用单独 observer-ready 前置步骤同步放行原四步。该前置步骤不计产品验收，原四步函数/断言/超时保持。实现与实际新请求结果另记；不新增独立 engine subscriber，因为它会分配 runtimeEpoch/队列，不能当原 UI 的无影响观察。

### 首次观察脚本启动与独立修正

临时包 `/tmp/ua-live-stream-observer-20261105-sol/` 经表达式 VM 52 次检查和 Node24 启动握手预检后，由 Terra 执行一次 `/tmp/ua-real-editor-sglang-observed-20261105-terra-a1/`。三个观察点在实际脚本解析后均 resolved/hash 匹配，随后首次 hello 附近 A 条件触发 OBS_ERROR；supervisor exit1、runner/engine TERM exit143。原四步未开始，launcher.log 为空，session-100 的 message_envelope 也为空，无 AGENT_TURN_START/TOOL_EXECUTED；这是观察器失败，不能称产品或 SGLang 失败。

保护摘要确认所有保护项不变，src/out 无增删改，owned PID 为空、50161 关闭、外部窗口保留。原 v1 包与本次失败证据冻结，不覆盖或盲重跑。

Sol 随后用独立 Node24 的真实异步闭包和 inspector 复现：engineSessionId 只在回调外作参数，V8 未保留该闭包变量，调试条件读取为 ReferenceError；event/sessionId/attemptId/disposed 均可见。A 改为 event.payload.session_id 后正常输出元数据且 false，exit0；日志 `/tmp/ua-real-closure-inspector-check-20261105.log`。该检查未启动 Electron/引擎/模型。后续 v2 只修诊断变量、带点名的错误类别，并要求实际初始 hello 成功经过 A/B/C 后才放行；不是产品逻辑改动。

v2 包 `/tmp/ua-live-stream-observer-20261105-sol-v2/` 冻结后独立复核 C0/I0：新 A 的真实 Node24 闭包复验无 OBS_ERROR、exit0；readiness 13 项行为验证覆盖同 context 齐备、C先B后、缺任一点、accepted=false、inactive entry、跨 session/attempt，全部符合门控。日志 `/tmp/ua-real-closure-inspector-check-v2-20261105.log`、`/tmp/ua-observer-v2-gate-check-20261105.log`；这些是观察脚本验证，不是产品或模型测试。Terra 获准在新的 a2 运行根做一次真实诊断，具体结果后续记录。

### a2：实时送达已确认，场景多行等待失败

运行根 `/tmp/ua-real-editor-sglang-observed-20261105-terra-a2/`；报告位于 `artifacts/evidence/universe-agent-real-editor-2026-11-05T01-37-27-277Z/`。v2 初始 hello 已在同 session/attempt 命中 A/B/C，observer diagnosticFailure=false，最终完整分离并保留 223 条元数据。原四步前两步通过；第三步 01:37:40.677Z 开始、01:37:41.230Z 失败（553ms），原因是助手 locator 同时匹配持久的工具前正文与流式 overlay，触发 strict-mode violation；不是实际等待满 60 秒。第四步未运行。

本轮冷 DB seq12 最终助手 `session-100:msg:t-7efafcff:a4` 含 marker，seq13 branch 存在。实际原窗口 A ordinal196、C ordinal202、B ordinal203 在 01:37:40.994–.996Z 接收并接纳相同 seq12/message id，发生在第三步期间；不再把本轮判为最终消息未送达。UI 后续持久合并尚需核验，且不能用本轮推翻前轮未观察运行的缺失事实。

runner exit1、engine TERM143；自有进程全部退出、50161 释放，外部窗口保留；保护内容及 src/out 均未变化。最后 DOM 采样为 01:37:41.220Z（晚于 seq12 到达），仍有 assistant=2/tool=1/error=0；观察器只记录数量，未记录该时刻行身份或 busy，不能确认最终持久行显示。失败截图仍见工具前正文和 Thinking · Loading，采样未覆盖稳定完成期。DB 正文 151 字符含两个前导换行，trim 后 149 与 B/C preview 长度相符；仅长度不是逐字符一致证明。

针对 singleton 等待及读错 article busy 的窄修正已写入隔离方案，独立规则16复审 C0/I0 后由 Sol 实施；原四步验收条件保留并加严完成态。a2 不计产品四步通过。

a2 Playwright trace 仅有截图帧，没有 frame-snapshot；严格等待 call@91 在约 9.7ms 内报错，无法从 trace 补出 article busy/身份。为避免下一轮仍只有数量证据，v3 仅给原只读 DOM 采样新增 rootId、turnId、busy 和合成 marker 的布尔，不记录新增正文。包 `/tmp/ua-live-stream-observer-20261105-sol-v3/` 的 points/observer/launcher/readiness 与 v2 逐字节相同；dom_read SHA256 为 `6d90d24a078b8e2e7f5e568f66d98db1093ddf1f98d9c4d804f5b71100d336b1`，Node24 语法与三个合成 DOM 例通过，父窗口复核 diff 与加载路径后接受。null root 表示缺容器，busy=false 本身不证明持久完成。场景修正的源码 peer 先报 I1（等待期间晚到失败），补 live/reload 完成后复查与四个动态反例后复核 C0/I0。Node24 针对性测试 19 个实际 Chromium DOM 子例通过（Python harness 1 test、2.798s、exit0）；这是夹具行为层，不是 SGLang。初次 HTTP 夹具因未指定 UTF-8 造成 Loopback 状态文字乱码，已修响应 charset，失败保留。CJS 语法/diff-check 通过；定向 ESLint 仅在关闭该既有 CJS 的 no-new-JS 语言门后通过，不称原样 lint 全绿。场景 SHA `77fab4b3316a69c39566ffa5da63b79df66f376ac264a6523f75046436226aae`，验证摘要 `/tmp/ua-real-editor-scenario-check-20261105.json`；生产 src/out 未改。允许 Terra 独占运行通道执行一次 a3。

### a3：完成等待仍失败，原窗口 admission 已确认

运行根 `/tmp/ua-real-editor-sglang-observed-20261105-terra-a3/`，报告 `artifacts/evidence/universe-agent-real-editor-2026-11-05T01-55-13-467Z/`。采用上述修正后场景与 v3 只读 DOM 采样；observer setup/runtimeProof 通过但不计产品步骤。原前两步通过，第三步实际等待 60 秒后 marker 完成条件超时，第四步未跑。

冷 DB seq12 最终助手 `session-100:msg:t-2153ac72:a4` 正文148字符且含 marker，seq13 branch/seq14 status 存在。原窗口 A ordinal202/207 于 01:55:29.053–.054Z 收到 seq12/13，C208 与 B209 在 29.055Z 对同 id/seq 接纳；A218 在29.094Z 收到 turn_completed。C 位于 stale-attempt 守卫之后、onStreamEvent 之前，因此证明 admission，不单独证明 fold、patch 或 UI 应用。

v3 有134个 DOM 样本，marker 命中始终为0。工具前正文 `session-100:msg:t-83f041ab:a1:body` 非busy；流式 overlay:t-f69618cd 随后消失，最后仅该首段正文、tool=1/error=0。没有把已清除 overlay 误算完成。observer完整分离，232条元数据、diagnosticFailure=false；runner1、engine TERM143、自有进程0、50161空，所有保护目录及src/out清单无变化。

下一步优先核最终消息的投影顺序与实际渲染窗口。既有离线重放只检查最终条目存在，未验证顺序；Sol 发现其 seq12 排在 seq3 之前，正在核实十进制字符串 orderKey 的比较是否把最终消息插入旧端。随后精确机制已复现，见下一段；不再发模型请求，不改场景断言。

a3 只读导出14行 envelopes，SHA `a825920cf60dd931856399e614fa43ac3e45ad1fb39e9632be4b52f4f4d5758c`。清理版重放 `/tmp/ua-a3-timeline-order-clean-replay-20261105.cjs/log/json` 仅绑定该输入及 a3 actor 快照，旧含无用前轮输入的探针原件保留但不作为清理版来源。实际 Node Actor 分阶段输出，再由 Chromium 导入当前 browser projector 与真实 TimelineHost：旧输出将 seq12 放首位，user锚点变 index1，最终root存在于entries却不在DOM；明确断言失败 exit1。临时快照只将numeric key左补零16位的对照 windowStart0、finalDOM=true。该对照不修改生产source/out，也不是修复后验收；简化内容适配器/CSS不代表真实Electron视觉。

live/history 的 raw envelope 共用 demuxEnvelope；现非负safe-integer序号以普通十进制字符串作opaque排序键导致9/10等边界反序。[顺序修复方案](../../archive/dev/plans/engine-envelope-sequence-order.md)已规则16 C0/I0，保留opaque key、数字游标、renderer比较及Host锚点，由Sol修producer边界并补永久跨层回归。前述“离线finalVisible”仅集合存在，不是顺序或DOM正确，已明确收窄。

工作根显示的独立补全方案已通过[规则16审查](../plans/new-session-workdir-hydration.md)，但最终回答定位优先，尚未实施；不能声称已阻止或移除了 agent-home 挂载。

### 排序修复与自动层验证

Sol 只改数字 seq→orderKey 为16位左补零，其他domain opaque key、数字游标、内容、Host锚点均未改。旧生产新增关键回归：跨层live/history均缺final DOM（exit1）；Node history9过1败；官方Electron demux35过3败。正式 Node24 compile-client exit0 后，Node history10过、Electron demux38过，永久跨NodeActor→ChromiumHost夹具1个Python测试（live/history adapter两条变体）通过。Node runner不能载入既有demux测试的browser/CSS依赖，browser runner会drop node suite而得到0项，均未作为通过证据。

a3真实输入重新经新compiled demux/Actor生成快照后，实际Host finalDOM=true且顺序正确，`a3-green-fresh.log/json` exit0。一次错误沿用旧red快照的探针仍失败，已保留为不同文件，不替换原red，也不作为新生产失败归因。永久夹具不含临时pad-control，不依赖该次真实DB；history变体为公开adapter→streamEvent→Actor，不冒称完整historyResult mailbox。

独立源码peer的夹具超时清理I1已关闭，最终C0/I0；正常关闭browser/server，超时仅自有进程组TERM→2秒→KILL/wait。编译证据根 `/tmp/engine-envelope-order-build-20261105/` 包含 metadata-before、compile-result、src-before/after、out-after 与 post-test-integrity；12186 src编前后不变，测试后src/out均无变化（out11987）。ESLint与HEAD诊断多集相同，原命令exit1：生产0error6warning，demux既有test3个browser-import error/4warning，history0/0；无新增诊断但不是lint全绿。

v4临时包 `/tmp/ua-live-stream-observer-20261105-sol-v4/` 只把启动器适配到新工位真实证据文件名，完整前后src/out增删改校验不变；root已复核diff，Terra重核三个观察点hash与代码语义均未改变。旧v3与旧构建清单保留。a4已获单次真实运行授权，使用新build根与原SGLang Local/openai配置；结果另记，暂不计真实四步通过。

### a4：新排序键下原四步全部通过

运行根 `/tmp/ua-real-editor-sglang-observed-20261105-terra-a4/`，报告 `artifacts/evidence/universe-agent-real-editor-2026-11-05T02-11-18-184Z/report.html`。v4 runtimeProof 齐备后，production-loopback、submit-real-input、tool-and-assistant、reload-history 四步均 PASS；observer-ready 是独立诊断设置，不计第五项产品通过。runner与launcher exit0，engine正常TERM143。

冷DB seq12 final `session-100:msg:t-942a006d:a4` 长160且含marker；A202收到该seq，C208/B209 admission/accepted，orderKey=`0000000000000012`。DOM29个样本中9个含marker，最终持久final root/turn存在、busy=false、tool=1。报告UTC：第三步于02:11:33.980Z通过，reload于02:11:40.196Z通过并保留3个唯一durable timeline root。父窗口独读manifest与通过截图，确认最终回复可见。

observer正常detach/complete，245条元数据、diagnosticFailure=false。protectedUnchanged五项全true，src/out新增/缺失/修改均0，remainingOwnedPids=[]、50161空，外部PID774085保留。此为带观察点的一次真实SGLang Local/OpenAI Chat路径通过；不代表无观察器运行、独立HTTP wire、F21两模型、真实UDS或人工多主题视觉全验收。历史失败证据全部保留。

工作根另记：DOM采样02:11:24.751–34.772均为agent-home；reload开始35.189后经历元素空隙，39.022首次采到workspace。冷DB work_dir始终是该run的workspace。因此reload正确不等于首次adopt正确；[工作目录补全方案](../plans/new-session-workdir-hydration.md)已开始实施，下一次必须在reload前验证。不会删除已挂工作区。

### a5：初始工作目录与原四步真实通过

为验证首次 adopt 时的工作目录，Sol 先完成了 fresh client build `/tmp/session-workdir-build-20261105-fresh`：`npm run compile-client` exit 0，`src` 12186/12186 与 `out` 11987/11987 的相对路径清单均零差异；设置 `VSCODE_SKIP_PRELAUNCH=1` 后，Node 连接/IPC 753、Chromium 新绑定 16、Electron roster/context 237 均通过，ESLint 0 errors/6 warnings，测试后 src/out 仍 unchanged。旧 `/tmp/session-workdir-build-20261105` 清单曾被 `scripts/test.sh` 默认 preLaunch 重写，保留为不可用历史，不混入本次运行。

Terra 使用 v6 观察包 `/tmp/ua-live-stream-observer-20261105-sol-v6`，SGLang Local/OpenAI Chat `/v1` 预检返回 Local，真实运行根为 `/tmp/ua-real-editor-sglang-observed-20261105-terra-a5`，报告为 `artifacts/evidence/universe-agent-real-editor-2026-11-05T03-05-55-947Z/report.html`。runtimeProof 在真实 SessionViewHost/Actor 路径命中 AEntry=8、AHello=9、CHello=10、BHello=11；A/B/C 源码哈希分别为 sessionViewHost `55306a7f…`、session-actor `f434fc82…`。

产品步骤逐项通过：production-loopback、`initial-session-workdir`（提交前唯一可见 folder chip 为该 run 的 workspace）、submit-real-input、tool-and-assistant、reload-history。报告中的工具/回答根为 `write:4`、`session-100:msg:t-f74ed8ac:a1:body`、`session-100:msg:t-57faa2e2:a4`，reload 后保留 3 个唯一 durable timeline roots。DOM 采样选择 Local，身份显示 `Engine · Loopback / workspace`；这次证明首次 adopt 的 workspace 显示和真实模型工具/回答/持久化路径。

runner 与 launcher exit 0，engine exit 143 为受控 TERM；cleanup `diagnosticFailure=false`，五项保护目录 unchanged，src/out 增删改均0，remainingOwnedPids=[]、50161 空、外部 PID774085 保留。该运行仍带观察点，不能升格为无观察器、独立 HTTP wire、F21 两模型、UDS 或人工多主题视觉全验收；旧 a3/a4 失败与通过证据继续保留。

### b1/b2：无观察器默认编辑器回归

为补齐 a5 的观察器边界，Terra 先用官方 `test/scenario/scripts/run-universe-agent-real-editor.sh` 做无 observer 运行。b1 根为 `/tmp/ua-real-editor-sglang-no-observer-20261105-terra-b1`；启动器未传 `OPENAI_API_KEY`，引擎明确以 `API key is required for provider openai` 退出，wrapper exit 1，未启动产品场景。该失败保留为配置前置证据，不与产品或 SGLang 请求失败混算。

b2 在同一隔离形状补上非秘密占位 key 后通过：运行根为 `/tmp/ua-real-editor-sglang-no-observer-20261105-terra-b2`，报告为 `artifacts/evidence/universe-agent-real-editor-2026-11-05T11-00-32-269Z/report.html`。环境为 Node v24.18.0、默认编辑器、SGLang OpenAI Chat `/v1`；没有 inspector、SessionEventStream 观察器或额外 DOM 观察器。官方四步全部通过：`production-loopback`、`submit-real-input`、`tool-and-assistant`、`reload-history`，wrapper exit 0，报告 outcome=passed，workspace 为该运行根下的 `workspace`。退出后 50161 已释放，自有引擎/runner/editor 已退出。

b2 证明无 observer 时真实 Local 模型仍能完成工具结果、唯一完成回答和 reload 持久化；它不提供 wire-level、事件 admission 或 observer-ready 的运行时定位。引擎日志的 unknown context window、客户端取消及受控退出 cleanup warning 仍按生命周期日志记录，不改变 wrapper 与四步结果。

本轮执行前后查询 SGLang `GET /v1/models` 只返回一个 `Local`（`root=Local`、`max_model_len=262144`）。本轮只读复核时 `/health` 返回 HTTP 200；`GET /v1/models/Local` 返回 200，而以实际权重目录名 `Ornith-1.5-35B-A3B-NVFP4` 作为第二候选请求返回 HTTP 404 `model_not_found`。`/get_model_info` 与 `/model_info` 均只报告一个 `served_model_name=Local`，唯一权重和 tokenizer 为 `/home/clarence/AI/sglang/models/Ornith-1.5-35B-A3B-NVFP4`；这说明当前缺口在 SGLang 服务端的模型暴露/启动配置，不是 VS Code 隔离 catalog 漏列。因而 F21 双模型矩阵当前缺少第二个真实模型，不能把同一 Local 的重复配置冒称双模型覆盖；待服务暴露第二个不同 served id 后再做矩阵。无 observer b2 已补齐，F21、独立 HTTP wire、UDS 与人工多主题视觉验收仍保持未完成。

### c1：当前工作树的无观察器 GPU-off 复跑

Terra 在当前 dirty worktree 以 `--dev` 加载本 checkout 的 `out`，使用 Node v24.18、共享 `.build/electron` shell 与官方 `test/scenario/scripts/run-universe-agent-real-editor.sh` 做了新的隔离复跑。运行根为 `/tmp/ua-real-editor-current-terra-WIMpai`，报告为 `artifacts/evidence/universe-agent-real-editor-2026-11-05T13-41-02-948Z/report.html`。配置使用 SGLang `http://192.168.10.68:8192/v1`、`OPENAI_MODEL=Local`、`OPENAI_API_TYPE=openai` 和非秘密占位 `OPENAI_API_KEY`；为绕过本机 Electron GPU 崩溃，本次显式设置 `ELECTRON_DISABLE_GPU=1`。没有 inspector、SessionEventStream 观察器或额外 DOM 观察器。

原四步 `production-loopback`、`submit-real-input`、`tool-and-assistant`、`reload-history` 全部通过，wrapper exit 0，manifest 为 Node v24.18.0 / VS Code 1.136.0；工具与助手根为 `write:4`、`session-100:msg:t-388f2e9a:a4`，reload 保留 2 个唯一 durable roots。运行后 50161/50061 均无监听，自有 editor/engine/runner 进程清空，`agent-home/server.lock` 与 `server.sock` 已释放。

本次只读预检仍显示 `/health` HTTP 200、`/v1/models` 仅有 `Local`（`max_model_len=262144`），`/get_model_info` 与 `/model_info` 也只报告该 served id；引擎日志包含 Local context warning、客户端受控 CANCEL 与 shutdown cleanup warning。没有独立 HTTP access/wire log，且 file appender 指向共享历史日志路径，因此这次是默认编辑器真实 Local/OpenAI Chat 路径的四步证据，不升级为抓包级 provider 证明。无 key 的前置失败和 GPU-on Electron SIGSEGV 对照根保留；当前 F21 第二 served model、有效认证拒绝、独立 wire/UDS 与人工多主题视觉验收仍未完成。

### c2：当前 HEAD 配置注入复核失败（2026-11-05）

为确认 c1 是否能在当前 checkout 重现，Terra 以同一官方无 observer runner 做了两次隔离复跑。第一次根为 `/tmp/ua-real-editor-terra-current-2dqwev`，使用空的隔离 `agent-home`：`production-loopback` 与 `submit-real-input` 通过，`tool-and-assistant` 30 秒超时；引擎日志明确记录 `HTTP 401 Incorrect API key`。这说明仅设置 `OPENAI_API_BASE` / `OPENAI_MODEL` 环境变量不会让钉死引擎采用 SGLang 配置，不能把前两步通过当成模型接入成功。

第二次根为 `/tmp/ua-real-editor-terra-current-config-HYihoh`，尝试带入既有 `config.json`；引擎启动仍因 `API key required` 失败。随后第三次根为 `/tmp/ua-real-editor-terra-current-both-KcUycj`，同时提供非秘密 `OPENAI_API_KEY`，引擎虽启动但 banner 显示 `Provider openai / Model gpt-4o`，不是目标 SGLang `Local`；`tool-and-assistant` 再次超时，未形成新的四步通过。三次 wrapper/自有进程均已清理。

本轮把 c1 的 4/4 通过保留为既有条件性证据，同时新增 c2 失败作为当前 HEAD 的配置注入缺口：模型环境变量、agent-home 配置与引擎实际 provider/model 选择之间仍没有可复现的一致合同。只有在引擎 banner、独立请求证据和报告中的 served model 同时指向 SGLang `Local` 后，才能把新的运行计为真实 SGLang 接入；不能用 `gpt-4o` 或前两步 UI 通过替代。

### c3：显式 OpenAI-compatible Local 配置的身份矛盾（2026-11-05）

Terra 只在隔离根 `/tmp/ua-terra-config-JKogkx` 写入一份临时 `provider:state` / `models.json`：provider 为 `openai`，`protocol=openai`，`apiBaseUrl=http://192.168.10.68:8192/v1`，profile 的 `id` 与 `modelId` 均为 `Local`，并以非秘密占位 key 启动官方 wrapper。`production-loopback` 与 `submit-real-input` 通过；真实工具路径随后出现两个 process-fold（`file_glob` 与 `file_read`），说明请求已经进入工具执行链，但 harness 在严格等待单一 process-fold header 时失败，wrapper exit 1。

该根的 engine banner 仍显示 `Provider openai / Model gpt-4o`，但 `ConfigStore.buildDefaultGlobalConfig()` 的全局默认值可能解释这行；它不足以推翻会话日志三次出现的 target model `Local`。SGLang metrics 当前也能看到 `Local` 的模型名，但没有运行前快照，不能把 counters 归因给本次。当前不能把这次当成完整 SGLang 通过，原因是 strict locator 没处理两个真实 process-fold，且没有本次运行前后的独立 HTTP wire/metrics 对照；两个工具折叠也不能替代助手完成或 reload 持久化。wrapper 已清理自有进程，config、models、engine log 与场景产物保留供复核。下一步是让修正后的 runner 明确验收两个工具折叠，并建立 served model 与 SGLang 请求的前后计数后再重跑。

### runner 多 process-fold 合同修复（2026-11-05）

Sol 按规则16 C0 将 `test/scenario/scenarios/universe-agent-real-editor.cjs` 的折叠处理改为逐个等待、逐个展开，并在工具行出现后再次扫描以接住晚到的 fold；失败检查遍历全部工具行。场景现在要求至少一个工具行、每行不含 `Failed`、唯一 completed assistant marker、持久 root/turn 和 reload 前后 durable identity 集合不变，未把任意一个工具行扩大成成功。

无引擎回归已通过：`python3 scripts/tests/test_real_editor_scenario.py` 20 cases，`python3 scripts/tests/test_real_editor_engine_lifecycle.py` 7 cases，Node `--check` 通过。c4 真实 SGLang 复跑待 Terra 使用该修复后的 runner 执行，旧 c3 结果不回写成完整通过。

### c4：修正 runner 后的显式 Local 真实通过（2026-11-05）

Terra 使用当前修正后的 runner、隔离根 `/tmp/ua-real-editor-terra-c4b-w0c06n`、端口 50175、Node v24 与 `ELECTRON_DISABLE_GPU=1`，在隔离 `provider:state` / `models.json` 中显式写入 OpenAI-compatible SGLang `Local`（`apiBaseUrl=http://192.168.10.68:8192/v1`、placeholder key、profile `id/modelId=Local`）。官方 wrapper 四步全部通过：`production-loopback`、`submit-real-input`、`tool-and-assistant`、`reload-history`；wrapper exit 0，报告为 `/home/clarence/Projects/Agents/vscode/.build/vscode-playwright-mcp/evidence/universe-agent-real-editor-2026-11-05T14-57-07-159Z/report.html`，Outcome=passed。reload 后 durable roots 保持，端口 50175 和自有 editor/engine/runner 均已清理；共享 debug engine 50061 仍由默认测试配置持有。

SGLang `/metrics` 在同一运行前后分别保存于 `metrics-before.txt` / `metrics-after.txt`：streaming e2e、generation_tokens、prompt_tokens、TTFT streaming 各由 5045→5047、5091→5093、5091→5093、5055→5057，均增加 2；非 streaming 计数不变。由于这些是共享服务累计计数而非请求级 wire capture，只能证明该运行区间与 SGLang `Local` 请求增量相符，不能宣称独立抓包或排除并发服务流量。engine banner 的 `gpt-4o` 仍是全局默认显示，不能单独覆盖隔离配置和 target `Local` 的日志证据。

此前 c3 的 strict 单折叠失败保留为历史；c4 的通过依赖 Sol 的多 process-fold 修复，仍未覆盖 F21 第二真实模型、有效认证拒绝、独立 wire/UDS 或默认窗口人工多主题视觉验收。

### c5b：当前 HEAD 显式 Local 复跑与 SGLang 计数增量（2026-11-05 16:22 UTC）

Terra 在隔离根 `/tmp/ua-real-editor-terra-c5b-20261105T162226Z`、Node `v24.18.0`、`ELECTRON_DISABLE_GPU=1`、端口 50176 下重跑当前 HEAD。隔离 `provider:state` / `models.json` 明确写入 provider=openai、protocol=openai、SGLang `/v1`、profile/model=`Local`、placeholder key，并以 `OPENAI_API_KEY` 环境变量满足启动前提。官方 wrapper 四步全部通过：`production-loopback`、`submit-real-input`、`tool-and-assistant`、`reload-history`；wrapper exit 0。报告为 `/home/clarence/Projects/Agents/vscode/.build/vscode-playwright-mcp/evidence/universe-agent-real-editor-2026-11-05T16-22-31-453Z/report.html`，运行摘要 SHA256 为 `0d2fa8e25637b76db95264ba8a2a2a49128adbfadf94655661df32d834a70420`。

运行前后保留 `/metrics` 快照与端点响应：`Local` 的 streaming `num_requests_total`、streaming e2e、TTFT streaming 各 5047→5049 / 5047→5049 / 5057→5059，prompt tokens 117630028→117691597（+61569），generation tokens 2897080→2897190（+110）；non-streaming 计数未变。`/v1/models` 前后仍只列 `Local`，`/get_model_info` 与 `/model_info` 仍只报告唯一 Local/Ornith 权重，`/metrics`=200、`/v1/metrics`=404，`/get_load` 收尾为零。计数是共享服务累计值而非独立 HTTP wire capture，结合显式隔离配置和 served Local 只加强 Local 路径证据，不宣称独立抓包、认证闭环或排除并发流量。共享 50061 仍由 PID 67939 持有；50176、自有进程与 c5 agent-home socket 已清理。首次未注入 `OPENAI_API_KEY` 的启动失败根 `/tmp/ua-real-editor-terra-c5-20261105T162102Z` 保留为前置失败对照。

### F21 当前服务配置复查（2026-11-06）

Terra 只读查询当前 `192.168.10.68:8192`，未启动/停止服务、未重复 editor runner，也未改仓库或共享配置。`/health`、`/v1/models`、`/v1/models/Local`、`/api/tags`、`/metrics`、`/v1/loads` 均可达；`/v1/models` 和 `/api/tags` 仍各只返回 `Local`（`max_model_len=262144`），权重目录名 `Ornith-1.5-35B-A3B-NVFP4` 与 `gpt-4o` 作为 model id 都返回 404 `model_not_found`。`/metrics` 的所有 `model_name` label 唯一为 `Local`，`/v1/metrics` 仍为 404，`/v1/loads` 收到时 `num_running=0`、`num_waiting=0`。

权威 `/server_info` 与 `/get_server_info` 内容一致（32740 bytes，SHA256 `b7f139f6d797224dd1f2da344430374b17c8f39231231e06e8a54dd9b29aa8e2`）：SGLang `0.5.20.dev1+g44804731f`、ready、监听 `0.0.0.0:8192`，唯一 model/tokenizer 路径为 `/home/clarence/AI/sglang/models/Ornith-1.5-35B-A3B-NVFP4`，`served_model_name=Local`，tp=2/pp=1/dp=1，`enable_lora`/`lora_paths`/`max_loaded_loras` 均为空，`speculative_draft_model_path=None`，`encoder_urls/register_urls=[]`，`api_key/admin_api_key=None`，只有一个 internal state。OpenAPI GET inventory 没有第二 served-model 注册/列表入口，只有 `/v1/models/{model}` 的单模型查询。F21 双模型矩阵因此仍缺第二个真实 served id；下一步需要外部重启/配置 SGLang 暴露不同 `served_model_name`（或另一实例/端口），不能用权重目录名、LoRA 或重复 Local profile 冒充第二模型。50061 共享引擎仍由 PID 67939 持有。

### F21 served-model 复查（2026-11-05 15:03 UTC）

Terra 重新只读查询 SGLang：`/health`=200；`/v1/models`=200 且仍只有 `Local`（`max_model_len=262144`）；`/v1/models/Local`=200；以权重目录名 `Ornith-1.5-35B-A3B-NVFP4` 请求返回 404 `model_not_found`。`/get_model_info` 与 `/model_info` 都只报告唯一 `served_model_name=Local` 和唯一权重/tokenizer `/home/clarence/AI/sglang/models/Ornith-1.5-35B-A3B-NVFP4`。

`/metrics`=200（104620 bytes），解析所有 `model_name` label、startup/weight/max-token 指标仍只有 `Local`；`/v1/metrics`=404，`/get_load`=200 且当前请求/等待/排队均为 0。服务端没有第二个不同 served id，因此 F21 两模型矩阵继续保持未完成，不能用同一 `Local` 的重复 profile 冒充第二模型。

### F21 当前服务短复核（2026-11-06）

Terra 再次只读复核，未启动/停止服务、未重跑 editor runner，也未改仓库或共享配置。`/v1/models` HTTP 200 仍只有 served id `Local`；`/server_info` HTTP 200、状态 ready，版本为 `0.5.20.dev1+g44804731f`，唯一模型仍是 Ornith-1.5-35B-A3B-NVFP4，`tp=2/pp=1/dp=1`，LoRA、draft、encoder 均为空，只有一个 internal state；`/metrics` HTTP 200 的 `model_name` 标签仍唯一为 `Local`。短复核快照为 `/tmp/sglang-f21-brief-20261105T173740Z/summary.json`，SHA256 `ddebe0f9417664329b76ecaaf83ac21d5d25150ea2651f860ccaa82d760457eb`。50061 仍由 PID 67939 监听。

F21 仍需要服务主机暴露不同 `served_model_name` 或第二实例/端口；本机不伪造第二 profile，也不重复已通过的 c5b 场景。

### F21 第二模型来源更正（2026-11-07）

引擎仓库 `docs/systems/infra/test-environment.md` 已把本机 magpie 网关定为与 SGLang 并列的第二套默认真实 LLM：`http://127.0.0.1:3425`，默认模型 `sub2api-mimo/mimo-v2.6-flash`。Anthropic、OpenAI Chat、Responses 三条协议都可走：Anthropic 的 base URL 不带 `/v1`，另两条带 `/v1`。口令默认 `magpie`，可用 `MAGPIE_API_KEY` 覆盖；它不是云厂商密钥，仍不写入证据。自 2026-11-05 起，引擎侧的两个真实 LLM 就是 SGLang `Local` 与这套 magpie，不再加第三个。

引擎侧 F21 已用 magpie 跑过 workspace-v2 消融，证据在引擎仓库 `dev/iterations/testing/live-evidence/2026-11-06-magpie-mimo-workspace-v2-responses-ablation-k3.md`。评测本身测不出路由价值，登记为引擎 `D-TEST-F21-ROUTING-DISCRIMINATION-1`，重设计见引擎 `dev/plans/f21-routing-eval-redesign-2026-11-06.md`。

所以上面各节「F21 需要 SGLang 暴露第二个 served id」的前提不成立：第二个真实模型不必来自同一 SGLang 实例。本仓默认编辑器的第二模型接入改用 magpie。magpie 是本机桌面网关程序（`~/.local/bin/magpie`），只在运行时监听 3425；2026-11-07 只读探测时它没有运行（连接被拒），默认编辑器的 magpie 路径还没跑过，本仓侧 F21 仍未验收。跑之前先启动 magpie，确认 `GET /v1/models` 含该模型；隔离 provider/model 配置照 c5b 的写法，把 base URL、模型和口令换成 magpie 的值。

## 后续验证边界

现有产品 catalog/ablation 入口会遍历全部八个 case；没有单 case 或外置 eventObserver 开关。显式 deepThink 单方法及随后结构化探针已完成，后者确认两维成功；单 case 产品执行器已进一步定位本次缺失输出及权限/压缩现象；下一步核实相应源码合同和可区分原因，保留字节码来源限制。请求元数据和异常堆栈应按一次运行归档，不通过无限重跑或弱化断言收敛失败。

F21 两模型矩阵、长任务成功、生产自主路由、有效认证拒绝仍未验收；默认编辑器的无观察器完整路径已由 b2 通过，a5 则单独通过带观察点的 Local/OpenAI Chat 初始工作目录与原四步。组件测试、协议函数调用与任务评测结果须分别报告。

返回 [进度索引](INDEX.md) · [钉死引擎与探针运行方式](../../docs/guides/debug-engine.md#6-sglang-真实-provider-探针)。


### Terra 当前监听边界复核（2026-11-05 18:24 UTC）

Terra 只读检查本机监听时未看到 SGLang/OpenAI-compatible 进程；共享钉死引擎 `50061` 仍由 Java PID `67939` 监听，但它不等同于 SGLang provider 服务。随后直接复核远端 `192.168.10.68:8192`，`/health`、`/v1/models`、`/server_info`、`/get_server_info` 与 `/metrics` 均返回 HTTP 200；未启动或停止任何服务，也未改仓库、共享配置或 `50061`。

远端当前仍只暴露 served id `Local`：`/v1/models` 只有一个 `Local`，`/server_info` 的 `served_model_name=Local`、模型与 tokenizer 均为 Ornith-1.5-35B-A3B-NVFP4，tp/pp/dp 为 2/1/1，LoRA、draft、encoder 均为空；metrics 的 `model_name` 标签也只有 `Local`。历史短复核快照 `/tmp/sglang-f21-brief-20261105T173740Z/summary.json` SHA256 为 `ddebe0f9417664329b76ecaaf83ac21d5d25150ea2651f860ccaa82d760457eb`，与本次边界一致。

因此当前真实接入验证仍只能保留既有 c4/c5b 的 Local 路径证据；F21 仍需服务主机暴露第二个 `served_model_name` 或第二端口/实例，不能用权重目录名、LoRA 或重复 Local profile 冒充多模型覆盖。

### F21 远端 served-model 复核（2026-11-05 18:34 UTC）

Terra 对远端 `192.168.10.68:8192` 做了只读复核：`/v1/models` 与 `/v1/models/Local` 均 HTTP 200，完整对象仍只有 `Local`（`max_model_len=262144`）；`/server_info` 继续报告 served model、model/tokenizer 为 `Local` / Ornith-1.5-35B-A3B-NVFP4，tp/pp/dp=2/1/1，LoRA、draft、encoder 和 key 配置均为空。`/metrics` HTTP 200，`model_name` 标签唯一为 `Local`。

以权重目录名 `Ornith-1.5-35B-A3B-NVFP4`、`gpt-4o` 及另一个拼写候选查询 `/v1/models/{model}` 均返回 404 `model_not_found`。本次未启动/停止服务、未重跑 editor runner、未改文件；F21 仍需第二个真实 served model 或第二端口实例。

### Terra 真实 Local 直连探针（2026-11-05 18:39 UTC）

Terra 对远端 SGLang `POST http://192.168.10.68:8192/v1/chat/completions` 发出最小非流式请求：`model=Local`、一条 `Reply with OK` 用户消息、`max_tokens=1`、`stream=false`。HTTP 200，响应 `object=chat.completion`、`model=Local`、`error=null`，usage 为 prompt 13 / completion 1 / total 14，`finish_reason=length`；由于 token 上限为 1，assistant content 为空且 reasoning 只返回一个 token，不能把它当成完整回答验收。

原始响应保存在 `/tmp/sglang-direct-probe-20261105T183916Z.json`。该探针证明远端 `Local` 端点确实接受并执行一次真实请求；它不证明完整长回答、第二模型、独立 wire capture 或默认编辑器人工验收。本次未启动/停止服务、未跑 editor runner、未改文件。

### Terra 真实 Local stop 探针（2026-11-05 18:40 UTC）

为补足上一探针的 token 截断边界，Terra 再次只读调用同一端点：`model=Local`、消息要求 `Return exactly OK and nothing else`、`max_tokens=32`、`stream=false`。HTTP 200，`object=chat.completion`、`model=Local`、`finish_reason=stop`、`error=null`；assistant 内容为 `OK`，reasoning 内容为模型对指令的简短解释，usage 为 prompt 16 / completion 19 / total 35 / reasoning 16。

该探针证明远端 `Local` 可完成一次非流式 stop 请求；它仍不证明第二模型、默认编辑器完整路径、独立 wire capture 或多主题人工验收。本次未启动/停止服务、未跑 editor runner、未改文件。

### Terra 当前 Local 复核（2026-11-05 19:07 UTC）

Terra 再次只读复核远端 `192.168.10.68:8192`：`/v1/models`、`/server_info`、`/metrics` 均 HTTP 200，served id 仍只有 `Local`，model/tokenizer 仍为 Ornith-1.5-35B-A3B-NVFP4，tp/pp/dp=2/1/1，LoRA、draft、encoder、register 均为空，metrics 的 `model_name` 标签唯一为 `Local`。

最小真实 `/v1/chat/completions`（`model=Local`、`Reply with OK`、`max_tokens=8`、`stream=false`）返回 HTTP 200、`object=chat.completion`、`model=Local`、`error=null`，但 `finish_reason=length`，content 为空且 reasoning 被 8 token 上限截断；usage 为 prompt 13 / completion 8 / total 21 / reasoning 8。该结果证明 Local 端点仍可调用，不证明完整回答或 F21 多模型覆盖。本次未启动/停止服务、未改代码/配置/文档、未跑 editor runner。

### Terra 真实 Local streaming stop 探针（2026-11-05 19:14 UTC）

Terra 对同一远端端点发出 `stream=true` 请求：`model=Local`、消息 `Reply exactly OK`、`max_tokens=64`。HTTP 200，收到 17 个 SSE JSON chunks（36 条非空原始行），`model=Local`，最终 `finish_reason=stop`，assistant 内容为 `OK`，reasoning 为完整短解释，未发生 token 截断，耗时约 0.258 秒。

该探针证明远端 `Local` 的 streaming stop 路径可完成；它仍不证明第二模型、默认编辑器完整路径、独立 wire capture 或多主题人工验收。本次未启动/停止服务、未改文件、未跑 editor runner。

### Terra F21 served-model 重核（2026-11-05 19:21 UTC）

Terra 只读重核远端 `192.168.10.68:8192`：`/v1/models`、`/server_info`、`/metrics` 均 HTTP 200，`/v1/models` 仍只有 `Local`（`max_model_len=262144`），`served_model_name=Local`，model/tokenizer 仍为 Ornith-1.5-35B-A3B-NVFP4，tp/pp/dp=2/1/1。LoRA、draft、encoder、register 均为空或 null；metrics 的 `model_name` 标签唯一为 `Local`。

F21 仍缺第二个真实 `served_model_name` 或第二端口/实例。本次未启动/停止服务、未发 chat 请求、未跑 editor runner、未改仓库或配置。

### Terra Local stop 直连补充（2026-11-05 19:40 UTC）

Terra 对远端 `192.168.10.68:8192` 做最小只读复核：`/v1/models`、`/server_info`、`/metrics` 仍 HTTP 200 且只显示 served id `Local`，`/v1/loads` 为空闲（`num_running=0`、`num_waiting=0`）。同一 `Local` 发送非流式 `max_tokens=32` 与流式 `max_tokens=64` 请求，均 HTTP 200、最终 `finish_reason=stop`，assistant 内容为 `OK`（分别带前导空行），没有 token 截断。

原始响应与快照保存在 `/tmp/sglang-terra-next20-20261105T194010Z/`（`nonstream.response.json`、`stream.sse`）。本次没有启动/停止服务、没有跑 editor runner、没有改配置或仓库；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义复核（2026-11-05 19:44:35 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读快照：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200；`/v1/models` 与 metrics 的 `model_name` 仍只有 `Local`，`/server_info` 仍为 Ornith-1.5-35B-A3B-NVFP4、tp2/pp1/dp1，LoRA、draft、encoder、register、key 均为空或 null，loads 空闲。动态响应 hash 因时间戳/计数变化，语义配置没有变化。

证据快照在 `/tmp/sglang-terra-next21-20261105T194435Z/`。本次未发 chat、未跑 runner、未启动/停止服务、未改配置或仓库；F21 第二真实 served model/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

与 next20 对比，`/server_info` 的 495 个顶层字段集合一致；仅 `internal_states[0]` 的运行时吞吐/接受长度小数变化，served-model 与配置字段没有变化。

### Terra served-model 精确一致性复核（2026-11-05 19:47:04 UTC）

Terra 再次只读读取远端服务：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。`/v1/models` 与 metrics 仍只有 `Local`；`server_info` 与 next21 的 495 个字段、SHA256 和 served-model 配置完全一致，模型仍为 Ornith-1.5-35B-A3B-NVFP4、tp2/pp1/dp1，无 LoRA/draft/encoder/register/key；loads running/waiting/utilization 均为 0。

证据快照在 `/tmp/sglang-terra-next22-20261105T194704Z/`。本次未发 chat、未跑 editor runner、未启动/停止服务、未改远端配置或仓库；F21 第二模型/端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义连续性复核（2026-11-05 19:51:35 UTC）

Terra 继续只读检查远端服务：六个健康、模型、server-info、metrics、loads 端点均 HTTP 200；`/v1/models` 与 metrics model label 仍只有 `Local`。`/server_info` 保持 495 个字段，SHA256 `d47d7c1c...` 与 next22 一致，served model、Ornith-1.5-35B-A3B-NVFP4、tp2/pp1/dp1、LoRA/draft/encoder/register/key 及空闲 loads 语义均未变化。

证据快照在 `/tmp/sglang-terra-next23-20261105T195134Z/`。本次未发 chat、未跑 editor runner、未启动/停止服务、未改远端配置或仓库；F21 第二模型/端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 时间戳差异复核（2026-11-05 19:57:05 UTC）

Terra 继续只读检查远端服务：六个健康、模型、server-info、metrics、loads 端点均 HTTP 200；唯一 served/model label 仍为 `Local`。`/server_info` 495 个字段与 next23 的 SHA256 完全一致，模型、tp2/pp1/dp1、空 LoRA/draft/encoder/register/key 与 idle loads 未变；`/v1/models` 仅 `data[0].created` 时间戳变化，id/root/owned_by 与 `max_model_len=262144` 不变。

证据快照在 `/tmp/sglang-terra-next24-20261105T195705Z/`。本次未发 chat、未跑 editor runner、未启动/停止服务、未改远端配置或仓库；F21 第二模型/端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 连续性复核（2026-11-05 20:00:17 UTC）

Terra 对远端服务做只读连续性检查：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200；唯一 served/model label 仍为 `Local`，`max_model_len=262144`。`server_info` 保持 495 个字段，原始 SHA256 与 next24 完全一致，模型、tp2/pp1/dp1、空 LoRA/draft/encoder/register/key 与 idle loads 均未变化；`/v1/models` 只有时间戳/排序差异。

证据快照在 `/tmp/sglang-terra-next25-20261105T200017Z/`。本次未发 chat、未跑 editor runner、未启动/停止服务、未改远端配置或仓库；F21 第二模型/端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:03:47 UTC）

Terra 对远端服务继续做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200；唯一 served/model label 仍为 `Local`，`max_model_len=262144`。`server_info` 495 个字段及 SHA256 与 next25 完全一致，模型、tp2/pp1/dp1、空 LoRA/draft/encoder/register/key、speculative 指标与 idle loads 均未变，仅动态时间戳/计数变化。

证据快照在 `/tmp/sglang-terra-next26-20261105T200346Z/`。本次未发 chat、未跑 editor runner、未启动/停止服务、未改远端配置或仓库；F21 第二模型/端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:07:22 UTC）

Terra 继续只读检查远端服务：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200；唯一 served/model label 仍为 `Local`，`max_model_len=262144`。`server_info` 保持 495 个字段，SHA256 `d47d7c1c...` 与 next26 完全一致，模型、tp2/pp1/dp1、空 LoRA/draft/encoder/register/key、idle loads 与 speculative 语义未变，仅 models/loads 动态时间戳和运行时计数变化。

证据快照在 `/tmp/sglang-terra-next27-20261105T200000Z/`。本次未发 chat、未跑 editor runner、未启动/停止服务、未改远端配置或仓库；F21 第二模型/端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:11:03 UTC）

Terra 对远端服务继续做只读检查：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200；唯一 served/model label 仍为 `Local`，`max_model_len=262144`。`server_info`/`get_server_info` 保持 495 个字段和 SHA256 `d47d7c1c...`，模型、tp2/pp1/dp1、空 LoRA/draft/encoder/register/key 与 idle loads 均未变，仅动态时间戳/运行时计数变化。

证据快照在 `/tmp/sglang-terra-next28-20261105T2008Z/`。本次未发 chat、未跑 editor runner、未启动/停止服务、未改远端配置或仓库；F21 第二模型/端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:16:25 UTC）

Terra 对远端服务继续做只读检查：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200；唯一 served/model label 仍为 `Local`，`max_model_len=262144`。`server_info`/`get_server_info` 保持 495 个字段和原始 SHA256 `d47d7c1c...`（规范化 JSON SHA256 `2fce283b...`），模型仍为 Ornith-1.5-35B-A3B-NVFP4、tp2/pp1/dp1，LoRA/draft/encoder/register/key 仍未启用；`/v1/loads` 的 running/waiting/active/utilization 均为 0，仅动态时间戳与累计运行计数变化。

证据快照在 `/tmp/sglang-terra-next29-20261105T201625Z/`。本次未发 chat、未跑 editor runner、未启动/停止服务、未改远端配置或仓库；F21 第二模型/端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:20:47 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `d47d7c1c...`、规范化 JSON SHA256 `2fce283b...` 与 next29 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4（`model_path` 为 `/home/clarence/AI/sglang/models/Ornith-1.5-35B-A3B-NVFP4`），`port=8192`、`tp2/pp1/dp1`，LoRA、draft、encoder、register、key 均未启用；`/v1/loads` 的 running/waiting/active/utilization 仍为 0，只有动态时间戳、累计计数及 metrics 内容长度变化。

证据快照在 `/tmp/sglang-terra-next30-20261105T202047Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:22:57 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1c...`、规范化 JSON SHA256 `2fce283b...`，与 next30 完全一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4（`model_path`/`tokenizer_path` 同路径），`port=8192`、tp2/pp1/dp1，`api_key`/`admin_api_key`、LoRA、draft、encoder/register/key 均未启用；`/v1/loads` 的 running/waiting/active/utilization 均为 0，只有动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next31-20261105T2030Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:24:55 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1c...`、规范化 JSON SHA256 `2fce283b...`，与 next31 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4（`model_path`/`tokenizer_path` 同路径），`port=8192`；配置仍为 EAGLE speculative（2 steps、3 draft tokens），LoRA、draft model path、encoder/register/key 与 API key 均未启用；`/v1/loads` 的 running/waiting/active/utilization 均为 0，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next32-20261105T202455Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:28:04 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next32 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next33-20261105T202804Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:30:25 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next33 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next34-20261105T203025Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:32:08 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next34 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next35-20261105T203208Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:34:08 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next35 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next36-20261105T203408Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:36:14 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next36 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next37-20261105T203614Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:37:36 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next37 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next38-20261105T203736Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:39:24 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next38 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next39-20261105T203924Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:40:56 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next39 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next40-20261105T204056Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:42:57 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next40 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next41-20261105T204257Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:44:44 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next41 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next42-20261105T204444Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:46:07 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next42 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next43-20261105T204607Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:47:33 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next43 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next44-20261105T204733Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:49:06 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next44 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next45-20261105T204906Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:50:35 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next45 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next46-20261105T205035Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:52:15 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next46 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next47-20261105T205215Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:53:41 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next47 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next48-20261105T205341Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:55:12 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next48 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next49-20261105T205512Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:56:38 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next49 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next50-20261105T205638Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:58:06 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next50 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next51-20261105T205806Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 20:59:55 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next51 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next52-20261105T205955Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 21:01:29 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next52 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next53-20261105T210129Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 21:03:09 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next53 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next54-20261105T210309Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义持续性复核（2026-11-05 21:04:37 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 各 495 个字段，原始 SHA256 `d47d7c1cbcd6c62021eb6548f46a39e92634707a781b1aeeabb0bb288114b9ac`、规范化 JSON SHA256 `2fce283bbed9f00e96f34a113904ce88461358eaa1aa0e1f742b531b72275472`，与 next54 一致。模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。

`/v1/loads` 仍为单个 `dp_rank=0`、`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 运行时统计仍为 `accept_length=2.2408645887384058`、`accept_rate=0.7375`，仅动态时间戳、累计计数及 metrics 长度变化。

证据快照在 `/tmp/sglang-terra-next55-20261105T210437Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:07:39 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。唯一 served model 与 metrics label 仍为 `Local`，`max_model_len=262144`；`server_info`/`get_server_info` 仍各 495 个字段，但本次原始 SHA256 为 `976336308e2e91f0209e3d29f5272f278ba6bc612f60a656a190a408079e789f`、规范化 JSON SHA256 为 `6e6210e8244355c662c12494f84f55486249f5a8309e726d3596920b65da9868`。与 next55 对比，配置与 served-model 语义字段未变，仅 `internal_states[0].avg_spec_accept_length` 从 `2.2408645887384058` 变为 `2.2408306801011`，`last_gen_throughput` 从 `0.05501053126927801` 变为 `0.008667162712060892`。

模型仍为 Ornith-1.5-35B-A3B-NVFP4，`model_path`/`tokenizer_path` 同路径，`port=8192`、`tp2/pp1/dp1`；EAGLE speculative 配置仍为 2 steps、3 draft tokens（`speculative_draft_model_path=null`），LoRA、encoder/register/key 与 API/admin key 均未启用。当前 `/v1/loads` 已回到单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；运行时 speculative 统计为 `accept_length=2.2408306801011`、`accept_rate=0.0625`。

证据快照在 `/tmp/sglang-terra-next56-20261105T210739Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:09:42 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `976336308e2e91f0209e3d29f5272f278ba6bc612f60a656a190a408079e789f`、规范化 JSON SHA256 `6e6210e8244355c662c12494f84f55486249f5a8309e726d3596920b65da9868`，与 next56 一致。与 next56 对比 `internal_states` 运行时计数没有继续变化。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2408306801011`、`accept_rate=0.0625`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next57-20261105T210942Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:11:15 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，但与 next57 对比原始 SHA256 更新为 `51e8cf696595ced5a625182a8de4ba7e9e3230c396cc42afb37d5c80014cfc0f`、规范化 JSON SHA256 更新为 `d2746913af93f2dd8610d4f9171f324dcc7aab1a4f39224f28935fd94f73d5c9`。唯一字段差异仍在 `internal_states[0]`：`avg_spec_accept_length` 从 `2.2408306801011` 变为 `2.2408393151108474`，`last_gen_throughput` 从 `0.008667162712060892` 变为 `0.5338686746448935`。

当前 `/v1/loads` 已回到单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计为 `accept_length=2.2408393151108474`、`accept_rate=0.7625`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next58-20261105T211115Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:12:47 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `51e8cf696595ced5a625182a8de4ba7e9e3230c396cc42afb37d5c80014cfc0f`、规范化 JSON SHA256 `d2746913af93f2dd8610d4f9171f324dcc7aab1a4f39224f28935fd94f73d5c9`，与 next58 一致；`internal_states` 运行时计数没有继续变化。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2408393151108474`、`accept_rate=0.7625`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next59-20261105T211247Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:14:28 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 六个端点全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，但与 next59 对比原始 SHA256 更新为 `01f00d7b9988758565b56b0c6be9acf630973e8e6525d61b3b884f453772f5cd`、规范化 JSON SHA256 更新为 `050031b88150c0874d8c3cb208b88eeb999debbe4b0e8dd607b723f6be67c92b`。唯一字段差异仍在 `internal_states[0]`：`avg_spec_accept_length` 从 `2.2408393151108474` 变为 `2.2408558239310747`，`last_gen_throughput` 从 `0.5338686746448935` 变为 `34.194288015822295`。

当前 `/v1/loads` 已回到单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计为 `accept_length=2.2408558239310747`、`accept_rate=0.725`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next60-20261105T211428Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:17:18 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `01f00d7b9988758565b56b0c6be9acf630973e8e6525d61b3b884f453772f5cd`、规范化 JSON SHA256 `050031b88150c0874d8c3cb208b88eeb999debbe4b0e8dd607b723f6be67c92b`，与 next60 一致；`internal_states` 运行时计数没有继续变化。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2408558239310747`、`accept_rate=0.725`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next61-20261105T211718Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:18:12 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `01f00d7b9988758565b56b0c6be9acf630973e8e6525d61b3b884f453772f5cd`、规范化 JSON SHA256 `050031b88150c0874d8c3cb208b88eeb999debbe4b0e8dd607b723f6be67c92b`，与 next61 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2408558239310747`、`accept_rate=0.725`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next62-20261105T211812Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:21:31 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，但与 next62 对比原始 SHA256 更新为 `5ffbef22ab19496cc57a001ef5fa4df324d28b141a1bfa793b8926a53937c871`、规范化 JSON SHA256 更新为 `510ed7c3e5d9562373f02be2817db20ed87b5b38f286a87b40587dd4d0ed1547`。唯一字段差异仍在 `internal_states[0]`：`avg_spec_accept_length` 从 `2.2408558239310747` 变为 `2.2409047857396214`，`last_gen_throughput` 从 `34.194288015822295` 变为 `1.5979667912665607`。

当前 `/v1/loads` 已回到单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计为 `accept_length=2.2409047857396214`、`accept_rate=0.875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next63-20261105T212131Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:23:22 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `5ffbef22ab19496cc57a001ef5fa4df324d28b141a1bfa793b8926a53937c871`、规范化 JSON SHA256 `510ed7c3e5d9562373f02be2817db20ed87b5b38f286a87b40587dd4d0ed1547`，与 next63 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409047857396214`、`accept_rate=0.875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next64-20261105T212322Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:25:01 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `5ffbef22ab19496cc57a001ef5fa4df324d28b141a1bfa793b8926a53937c871`、规范化 JSON SHA256 `510ed7c3e5d9562373f02be2817db20ed87b5b38f286a87b40587dd4d0ed1547`，与 next64 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409047857396214`、`accept_rate=0.875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next65-20261105T212501Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:26:44 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，但与 next65 对比原始 SHA256 更新为 `4538bf2ba342c1c5777c515bb82a009994e4aaa2daaaa1e9a80c926282621f34`、规范化 JSON SHA256 更新为 `c8e5bb21cbcbdd466a1889ee158c42e781feb676e93765d86e2621dc94cb31a6`。唯一字段差异仍在 `internal_states[0]`：`avg_spec_accept_length` 从 `2.2409047857396214` 变为 `2.2409141761712967`，`last_gen_throughput` 从 `1.5979667912665607` 变为 `0.3936528782964746`。

当前 `/v1/loads` 已回到单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计为 `accept_length=2.2409141761712967`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next66-20261105T212644Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:29:07 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `4538bf2ba342c1c5777c515bb82a009994e4aaa2daaaa1e9a80c926282621f34`、规范化 JSON SHA256 `c8e5bb21cbcbdd466a1889ee158c42e781feb676e93765d86e2621dc94cb31a6`，与 next66 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409141761712967`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next67-20261105T212907Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:30:44 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `4538bf2ba342c1c5777c515bb82a009994e4aaa2daaaa1e9a80c926282621f34`、规范化 JSON SHA256 `c8e5bb21cbcbdd466a1889ee158c42e781feb676e93765d86e2621dc94cb31a6`，与 next67 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409141761712967`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next68-20261105T213044Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:32:18 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `4538bf2ba342c1c5777c515bb82a009994e4aaa2daaaa1e9a80c926282621f34`、规范化 JSON SHA256 `c8e5bb21cbcbdd466a1889ee158c42e781feb676e93765d86e2621dc94cb31a6`，与 next68 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409141761712967`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next69-20261105T213218Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:34:08 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `4538bf2ba342c1c5777c515bb82a009994e4aaa2daaaa1e9a80c926282621f34`、规范化 JSON SHA256 `c8e5bb21cbcbdd466a1889ee158c42e781feb676e93765d86e2621dc94cb31a6`，与 next69 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409141761712967`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next70-20261105T213408Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:36:01 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，但与 next70 对比原始 SHA256 更新为 `5ce99c12fcc75cd404e938a981e96b2130d46fb5357f43038f3907f327d591a9`、规范化 JSON SHA256 更新为 `a1e2c7ddc9850664ec825770e31c5c412e231ea2448585b63e9902630a583d66`。唯一字段差异仍在 `internal_states[0]`：`avg_spec_accept_length` 从 `2.2409141761712967` 变为 `2.2409235660324196`，`last_gen_throughput` 从 `0.3936528782964746` 变为 `0.17032468324200653`。

当前 `/v1/loads` 已回到单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计为 `accept_length=2.2409235660324196`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next71-20261105T213601Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:38:25 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `5ce99c12fcc75cd404e938a981e96b2130d46fb5357f43038f3907f327d591a9`、规范化 JSON SHA256 `a1e2c7ddc9850664ec825770e31c5c412e231ea2448585b63e9902630a583d66`，与 next71 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409235660324196`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next72-20261105T213825Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:40:17 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `5ce99c12fcc75cd404e938a981e96b2130d46fb5357f43038f3907f327d591a9`、规范化 JSON SHA256 `a1e2c7ddc9850664ec825770e31c5c412e231ea2448585b63e9902630a583d66`，与 next72 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409235660324196`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next73-20261105T214017Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:42:09 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `5ce99c12fcc75cd404e938a981e96b2130d46fb5357f43038f3907f327d591a9`、规范化 JSON SHA256 `a1e2c7ddc9850664ec825770e31c5c412e231ea2448585b63e9902630a583d66`，与 next73 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409235660324196`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next74-20261105T214209Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:43:46 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `5ce99c12fcc75cd404e938a981e96b2130d46fb5357f43038f3907f327d591a9`、规范化 JSON SHA256 `a1e2c7ddc9850664ec825770e31c5c412e231ea2448585b63e9902630a583d66`，与 next74 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409235660324196`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next75-20261105T214346Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:45:48 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `5ce99c12fcc75cd404e938a981e96b2130d46fb5357f43038f3907f327d591a9`、规范化 JSON SHA256 `a1e2c7ddc9850664ec825770e31c5c412e231ea2448585b63e9902630a583d66`，与 next75 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409235660324196`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next76-20261105T214548Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:47:55 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `5ce99c12fcc75cd404e938a981e96b2130d46fb5357f43038f3907f327d591a9`、规范化 JSON SHA256 `a1e2c7ddc9850664ec825770e31c5c412e231ea2448585b63e9902630a583d66`，与 next76 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409235660324196`、`accept_rate=0.775`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next77-20261105T214755Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:49:35 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，但与 next77 对比原始 SHA256 更新为 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 更新为 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`。唯一字段差异仍在 `internal_states[0]`：`avg_spec_accept_length` 从 `2.2409235660324196` 变为 `2.2409276390786492`，`last_gen_throughput` 从 `0.17032468324200653` 变为 `0.12100113034833365`。

当前 `/v1/loads` 已回到单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计为 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next78-20261105T214935Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:51:27 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next78 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next79-20261105T215127Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:53:08 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next79 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next80-20261105T215308Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:54:42 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next80 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next81-20261105T215442Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:56:20 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next81 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next82-20261105T215620Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:58:07 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next82 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next83-20261105T215807Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 21:59:42 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next83 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next84-20261105T215942Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:01:20 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next84 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next85-20261105T220120Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:02:56 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next85 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next86-20261105T220256Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:04:33 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next86 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next87-20261105T220433Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:06:09 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next87 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next88-20261105T220609Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:10:16 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `149097697e07c787c315010d20494be87a37bd84295a8e28a6b9bd2a3508cc73`、规范化 JSON SHA256 `e64f0d23f95eafef9f7bad727425fc9950505490f07b65dc24513023a11a126e`，与 next88 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409276390786492`、`accept_rate=0.6875`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next89-20261105T221016Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:12:25 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，但与 next89 对比原始 SHA256 更新为 `56e418a8ed72307306ceacc42f58f5c687db28cfef9410dd0451ad5be3b12dc4`、规范化 JSON SHA256 更新为 `543167579b455d9ac59c55a4f0d7233e592b58aa717d74a82bbf6ffac92aec29`。唯一字段差异仍在 `internal_states[0]`：`avg_spec_accept_length` 从 `2.2409276390786492` 变为 `2.2409294335561785`，`last_gen_throughput` 从 `0.12100113034833365` 变为 `0.06979300424722117`。

当前 `/v1/loads` 已回到单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计为 `accept_length=2.2409294335561785`、`accept_rate=0.65`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next90-20261105T221225Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:16:15 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `56e418a8ed72307306ceacc42f58f5c687db28cfef9410dd0451ad5be3b12dc4`、规范化 JSON SHA256 `543167579b455d9ac59c55a4f0d7233e592b58aa717d74a82bbf6ffac92aec29`，与 next90 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409294335561785`、`accept_rate=0.65`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next91-20261105T221615Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:19:14 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `56e418a8ed72307306ceacc42f58f5c687db28cfef9410dd0451ad5be3b12dc4`、规范化 JSON SHA256 `543167579b455d9ac59c55a4f0d7233e592b58aa717d74a82bbf6ffac92aec29`，与 next91 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409294335561785`、`accept_rate=0.65`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next92-20261105T221914Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:20:49 UTC）

Terra 对远端 `192.168.10.68:8192` 做只读复核：六个端点 `/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads` 全部 HTTP 200。served model、`max_model_len=262144`、模型路径、`port=8192`、`tp2/pp1/dp1` 与 EAGLE 2 steps/3 draft tokens 均未变；`server_info`/`get_server_info` 仍各 495 个字段，原始 SHA256 `56e418a8ed72307306ceacc42f58f5c687db28cfef9410dd0451ad5be3b12dc4`、规范化 JSON SHA256 `543167579b455d9ac59c55a4f0d7233e592b58aa717d74a82bbf6ffac92aec29`，与 next92 一致；`internal_states` 运行时计数、speculative 指标均保持稳定。

当前 `/v1/loads` 仍为单个 `dp_rank=0` 空闲状态：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_active_tokens=0`、`utilization=0.0`，队列均为 0；speculative 统计保持 `accept_length=2.2409294335561785`、`accept_rate=0.65`。LoRA、encoder/register/key 与 API/admin key 仍未启用。

证据快照在 `/tmp/sglang-terra-next93-20261105T222049Z/`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时活动复核（2026-11-05 22:21:54 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 `server_info`/`get_server_info` 各 495 个字段，raw SHA256 `e54553b5200e7ad37e3f1d27e104b6874b8b07497d8cc5c1a946a6a84730ce98`、norm SHA256 `2b1ddafe66bcbac66aea8643734e5467e5bb18ad6172f38e929790b9fe4c8c08`；`internal_states[0]` 为 `avg_spec_accept_length=2.240944413098336`、`last_gen_throughput=100.92627353408403`。

首轮 `/v1/loads` 捕获到一个瞬时运行中请求：`num_running_reqs=1`、`num_active_tokens=3994`、`num_total_tokens=3994`、`num_used_tokens=3994`、`num_waiting_reqs=0`、`utilization=0.0`、`gen_throughput=100.93`，speculative `accept_length=2.240944413098336`、`accept_rate=0.725`。随后同一只读端点在 22:22:18 UTC 复核仍为 HTTP 200 且已回到空闲：`num_running_reqs=0`、`num_active_tokens=0`、`num_total_tokens=0`、`num_used_tokens=0`、`gen_throughput=0.0`，speculative `accept_length=2.2409176267958557`、`accept_rate=0.6375`；follow-up `server_info` 仍 495 字段，raw SHA256 `cc7eb75027be954ee60847c482c727293b7c101f45b3c0cad1511eb058493c3d`、norm SHA256 `6db6ecc8653e6de7fbdece059bcd1aeeedb03715723edeb03876459985b7ae08`，`internal_states[0].last_gen_throughput=257.345380925725`。这表明本轮服务曾有真实活动，不能把本轮计数归为全程 idle 稳定。

证据快照在 `/tmp/sglang-terra-next94-20261105T222154Z/`，其中包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时活动复核（2026-11-05 22:24:22 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 `server_info`/`get_server_info` 各 495 个字段，raw SHA256 `0b0e6c0c848d4d972cc83266830c308604b653f93997b36334f2c88d7b6ce5bf`、norm SHA256 `5169ac870c75f9f26e01a1161a6b67abb2f37776d79d70b0b0a56a1d8c361924`；相对 next94 follow-up 的 `internal_states[0]`，`avg_spec_accept_length` 从 `2.2409176267958557` 变为 `2.24093289003892`，`last_gen_throughput` 从 `257.345380925725` 变为 `54.766705483523424`。

首轮 `/v1/loads` 已回到空闲：`num_running_reqs=0`、`num_active_tokens=0`、`num_total_tokens=0`、`num_used_tokens=0`、`num_waiting_reqs=0`、`gen_throughput=0.0`、`utilization=0.0`，speculative `accept_length=2.24093289003892`、`accept_rate=0.475`。22:24:46 UTC follow-up 的 `/v1/loads` 与 `/server_info` 仍 HTTP 200 且数值稳定，未再次捕获运行中请求。说明本轮相对 next94 有运行时计数变化，但读取时服务已回到 idle。

证据快照在 `/tmp/sglang-terra-next95-20261105T222422Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:26:27 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。与 next95 follow-up 对比，server_info 各 495 字段，raw SHA256 `55c0225e1f3d679d74ddf1a0542bec8bb00afd2fc66ad4b32623ea852a2886fc`、norm SHA256 `58c800a0457065f192c7600739000896f7f17a4a1be44eee18cb5ca88e973201`；`avg_spec_accept_length` 从 `2.24093289003892` 变为 `2.240417045355041`，`last_gen_throughput` 从 `54.766705483523424` 变为 `264.9006637349603`。

本轮首轮与 follow-up 的 `/v1/loads` 都未捕获运行中请求：`num_running_reqs=0`、`num_active_tokens=0`、`num_total_tokens=0`、`num_used_tokens=0`、`num_waiting_reqs=0`、`gen_throughput=0.0`、`utilization=0.0`；speculative 保持 `accept_length=2.240417045355041`、`accept_rate=0.6625`。因此本轮观察到的是 counters 已变化但采样窗口内服务已 idle，不能声称捕获到 active request。

证据快照在 `/tmp/sglang-terra-next96-20261105T222627Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:29:40 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。与 next96 follow-up 对比，server_info 各 495 字段，raw SHA256 `b8e034fe389a7f5c5fb566b3aecc83d3c3b840023fa4fb5e6442b8a438a78fc0`、norm SHA256 `f146352638aa19b4b817238d57d1d9a3db17334cba7b7076c595488c4c9176aa`；`avg_spec_accept_length` 从 `2.240417045355041` 变为 `2.240454719732397`，`last_gen_throughput` 从 `264.9006637349603` 变为 `105.84895285363595`。

本轮首轮与 follow-up 的 `/v1/loads` 都未捕获运行中请求：`num_running_reqs=0`、`num_active_tokens=0`、`num_total_tokens=0`、`num_used_tokens=0`、`num_waiting_reqs=0`、`gen_throughput=0.0`、`utilization=0.0`；speculative 保持 `accept_length=2.240454719732397`、`accept_rate=0.8375`。因此本轮观察到 counters 继续变化，但采样窗口内服务已 idle。

证据快照在 `/tmp/sglang-terra-next97-20261105T222940Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时活动复核（2026-11-05 22:33:51 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next97 follow-up，首轮 `server_info` 各 495 字段，raw SHA256 `225a635eb555827fa5bb305610f7d183af0f86408d26ffb3263fdc04d28cdfa6`、norm SHA256 `10489034cf1086416df8701dc8ac9dbc633463e93165ae5ff2e1c871026ef1cb`；`avg_spec_accept_length` 从 `2.240454719732397` 变为 `2.23978465174736`，`last_gen_throughput` 从 `105.84895285363595` 变为 `2.4514824505970796`。

本轮首轮 `/v1/loads` 确实捕获到运行中请求：`num_running_reqs=1`、`num_active_tokens=3893`、`num_total_tokens=3893`、`num_used_tokens=3893`、`num_waiting_reqs=0`、`gen_throughput=0.0`、`utilization=0.0`，speculative `accept_length=2.23978465174736`、`accept_rate=0.6125`。随后 22:34:12 UTC follow-up 已回到 idle：running/active/total/used/waiting=0、gen_throughput=0、utilization=0，speculative `accept_length=2.239846323133964`、`accept_rate=0.8125`；follow-up server_info raw SHA256 `2279eae8b8862f5c52972c7bdf7fe63ec0307c7f9dd8ca02df9e1c47aa6d5f7b`、norm SHA256 `cf9ce0db605e2a1aef35bca6585d638baec2e2bdfb610b4cb24147856d24a7fe`，`last_gen_throughput=107.84222752732941`。

证据快照在 `/tmp/sglang-terra-next98-20261105T223351Z/`，包含首轮 active 与 follow-up idle 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:36:19 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next98 follow-up，首轮 `server_info` 各 495 字段，raw SHA256 `a5689fc9fc9a746e10eead27ec3de2aeb1ce36881d39ec2887cbc19a75b36e75`、norm SHA256 `92b976911aa0af7267f649f9d269e75ea992e33fddeff4c9121e4ae4ed2d6640`；`avg_spec_accept_length` 从 `2.239846323133964` 变为 `2.239707896553818`，`last_gen_throughput` 从 `107.84222752732941` 变为 `212.5738256456247`。

本轮首轮与 follow-up 的 `/v1/loads` 都未捕获运行中请求：`num_running_reqs=0`、`num_active_tokens=0`、`num_total_tokens=0`、`num_used_tokens=0`、`num_waiting_reqs=0`、`gen_throughput=0.0`、`utilization=0.0`；speculative 保持 `accept_length=2.239707896553818`、`accept_rate=0.4`。因此本轮只观察到 counters 变化，采样窗口内没有 active request。

证据快照在 `/tmp/sglang-terra-next99-20261105T223619Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:39:56 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 各 495 字段 raw SHA `a5689fc9fc9a746e10eead27ec3de2aeb1ce36881d39ec2887cbc19a75b36e75`、norm SHA `92b976911aa0af7267f649f9d269e75ea992e33fddeff4c9121e4ae4ed2d6640`，与 next99 follow-up 一致；首轮 internal/runtime counters 仍为 `avg_spec_accept_length=2.239707896553818`、`last_gen_throughput` 继承上一轮值，loads idle 且 speculative `accept_rate=0.4`。

22:40:18 UTC follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；但 runtime/speculative 计数更新为 `accept_length=2.2397115122965596`、`accept_rate=0.725`，follow-up server_info raw SHA `4b3ed7ecc2b443db0403a54b9fb8a2576379977cce08321b8c7c2ff10a85f885`、norm SHA `7ffbd0fd968a77464f8fac45e1bb67c2c73593196f7fd1e38ad36fd339f65e03`，`last_gen_throughput=70.14007092116857`。本轮采样窗口未捕获 active request，但 counters 继续变化。

证据快照在 `/tmp/sglang-terra-next100-20261105T223956Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:42:21 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next100 follow-up，首轮 server_info 各 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；`avg_spec_accept_length` 从 `2.2397115122965596` 变为 `2.239720066475217`，`last_gen_throughput` 从 `70.14007092116857` 变为 `0.8271177902718403`。

本轮首轮与 follow-up 的 `/v1/loads` 都未捕获运行中请求：`num_running_reqs=0`、`num_active_tokens=0`、`num_total_tokens=0`、`num_used_tokens=0`、`num_waiting_reqs=0`、`gen_throughput=0.0`、`utilization=0.0`；speculative 保持 `accept_length=2.239720066475217`、`accept_rate=0.7625`。本轮只观察到 counters 继续变化，采样窗口内没有 active request。

证据快照在 `/tmp/sglang-terra-next101-20261105T224221Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:45:42 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next101 follow-up，首轮 server_info 各 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`，internal counters/speculative 保持 `avg_spec_accept_length=2.239720066475217`；首轮 loads idle，accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next102-20261105T224542Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:47:19 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next103-20261105T224719Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:48:46 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next104-20261105T224846Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:51:20 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next105-20261105T225120Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:53:32 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next106-20261105T225332Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:55:17 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next107-20261105T225517Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:56:54 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next108-20261105T225654Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 22:58:21 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next109-20261105T225821Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:00:27 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next110-20261105T230027Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:02:06 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next111-20261105T230206Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:03:46 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next112-20261105T230346Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:05:20 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `21565e78cf29915a59bfae6b9912cf8a32d1c3b3a9f76f925b9bb55cb91fa097`、norm SHA `695cf40b2452e8f3caac3390f51efe02cac7717a136c6056dcb9124b0fe28024`；loads idle，accept_length `2.239720066475217`、accept_rate `0.7625`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239720066475217`、`accept_rate=0.7625`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.8271177902718403`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next113-20261105T230520Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:07:13 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next113 follow-up，首轮 server_info 495 字段 raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`；`avg_spec_accept_length` 从 `2.239720066475217` 变为 `2.239706132582149`，`last_gen_throughput` 从 `0.8271177902718403` 变为 `0.04724409932338081`。

首轮与 follow-up 的 `/v1/loads` 都未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative 保持 `accept_length=2.239706132582149`、`accept_rate=0.3875`。follow-up server_info raw/norm SHA 与首轮一致。说明本轮没有 active request，但 runtime counters/speculative 指标更新后稳定。

证据快照在 `/tmp/sglang-terra-next114-20261105T230713Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:08:40 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`；loads idle，accept_length `2.239706132582149`、accept_rate `0.3875`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.04724409932338081`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next115-20261105T230840Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:10:35 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`；loads idle，accept_length `2.239706132582149`、accept_rate `0.3875`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.04724409932338081`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next116-20261105T231035Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:12:09 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`；loads idle，accept_length `2.239706132582149`、accept_rate `0.3875`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.04724409932338081`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next117-20261105T231209Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:14:48 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`；loads idle，accept_length `2.239706132582149`、accept_rate `0.3875`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.04724409932338081`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next118-20261105T231448Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:16:22 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`；loads idle，accept_length `2.239706132582149`、accept_rate `0.3875`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.04724409932338081`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next119-20261105T231622Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:18:26 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`；loads idle，accept_length `2.239706132582149`、accept_rate `0.3875`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.04724409932338081`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next120-20261105T231826Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:20:40 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`；loads idle，accept_length `2.239706132582149`、accept_rate `0.3875`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.04724409932338081`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next121-20261105T232040Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:22:23 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`；loads idle，accept_length `2.239706132582149`、accept_rate `0.3875`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.04724409932338081`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next122-20261105T232223Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:24:10 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 server_info 495 字段 raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`；loads idle，accept_length `2.239706132582149`、accept_rate `0.3875`。

follow-up 仍未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，server_info raw/norm SHA 与首轮一致，`last_gen_throughput=0.04724409932338081`。本轮 activity 未捕获，counters/speculative/load 在 follow-up 稳定。

证据快照在 `/tmp/sglang-terra-next123-20261105T232410Z/`，包含首轮与 follow-up 的 loads/server-info 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:25:27 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。首轮 `/v1/models` norm SHA `db63bf2fc776f7316f0f3b2ee2edd4ef550ac763f94425331fa7168c0ec13d8d`、raw SHA `296f807262c58c661a63fa0887cffcee5984aaa6916c53cf0b50c14a3df7094f`；`server_info` 与 `get_server_info` 均为 495 字段，raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821`。

首轮 `/v1/loads` 未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`。follow-up 的 `/v1/loads` 仍为全 idle，speculative 与 counters 保持相同；仅 loads 原始/规范 SHA 因响应 timestamp 改变（follow-up raw `8a9aa2dd68099c11962ff654c84bc9c33770e276a3daacf178476a953e263c69`、norm `2fe8fb4fd5d27a6b116c5aab14d20f734b02a3f40f54ea73cf02cca9d559b030`）。follow-up `/server_info` 仍为 495 字段且 raw/norm SHA 与首轮一致。本轮未捕获 activity，runtime counters/speculative/load 稳定。

证据快照在 `/tmp/sglang-terra-next124-20261105T232527Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:28:32 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next124，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `115915ec98bef2d3de749c82778ac7f3b9c6c6080c835abd4d42c298631a060e`、norm SHA `bd893d31000a00f45b0a35ff1a620e086d34dea2d5bbeea360a455e6e18149d8` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp/序列化长度变化（首轮 raw `3972c1746b24d9af13cc167fe6064bdcc28ba12c3865007b5b90048c2ee02b74`、norm `efe81a714f3170c4db5c2863a267566cb5c2c84bd4e114883081b5cc1bcb8d5f`；follow-up raw `497a22279aa13ac8a48efe519fdd1a37f8f62ddd638095967d24905245d23439`、norm `57ff2ec25d3aa3769560f8eb7419c6262c6aa21b272a53479a5a3536b33e125a`）。

证据快照在 `/tmp/sglang-terra-next125-20261105T232832Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:30:22 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next125，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `bc6c062a297862dda9831f2714407c148b82d2ace967151e30b049b10708f6e5`、norm SHA `8bf916be21903df8ee33510026c6e40e0a78fc743f40bd498a68f48119180025` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `f59646a16264ddf686ff0a162cca9dd7d30c102c9341048fb79a2abba3281ab7`、norm `24e95403ffd54101b980edaed79c167a39271d61cad25ba3e329982fd33d83f8`；follow-up raw `0a63bfee170ffdbbd0f5adbdf0c307b7835a8b99d6c163288ff53ecd3fe58ad2`、norm `9ccd50a2bc979554e069e9d5917359b6833243b47e6e05120f383d0ac588e1bf`）。

证据快照在 `/tmp/sglang-terra-next126-20261105T233022Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:31:48 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next126，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `99aade88dc4556510127c7c5652e7dc93eb7da49321519773aff0ac909a98b7f`、norm SHA `1c327c1814a4959b5e7b481049ca2b3031214a7e320dff7c2a831e72cc0bc594` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `91e13c1725a574270b8f83150d2af3605d50f8464b3c73706514022f8164f63d`、norm `e29a633300f92b7d5829f6be4b3ac666525d02d40516caa6d68f8524dc1a9b4f`；follow-up raw `0f9aee22cc0cb4b932e9edfeb82966418bda5fbf3cc56fbc817945ca5024eb6a`、norm `84db2599522e2d9fb63419288fa1e8740bf992cb31914f80563dbf7b04f0d37e`）。

证据快照在 `/tmp/sglang-terra-next127-20261105T233148Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:33:53 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next127，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `462f858b0b42e7875c2497e733a0338dd7c3b14ae6f8b55ee1deedb62ec0da16`、norm SHA `b90ba32126048f4960a4295f1d8caa0c3fdb198f7848cb2f6cb306b4c62dd977` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `b0b3685aa1656a8fae5c750ba20f86f752d9abd9d3b8866be1a70130a4b0b07f`、norm `b8f5dccfdf3c049bfc65339a3cd987ae91a21fc9e97d4cbd04088978016e0e0c`；follow-up raw `ef655500ac153df506e8682a14abedef9a11cd01c1a47b67ac0762fd92b26db2`、norm `dc2e6196e1b2a587ab8e4829d87138c20fb3978403bb9de6033ae1cb966a0b1c`）。

证据快照在 `/tmp/sglang-terra-next128-20261105T233353Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:35:25 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next128，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `e4d402bac693a37565729eee434de1e3406acf222e7bfd4515230e437f23f4b8`、norm SHA `2f8660d1815e27d78652fd5f4076d435ca2c9f977dc4623b831d4807c4038f6c` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `3055696772f842eafcd7c85853d60ea119a3b0ce2ace8055f67f0bf6db7c979a`、norm `e7fd2764d3bd106d9a8ee65c2674a37202ddea3b7bf56311a634a0f4401fc1a3`；follow-up raw `4ec38111ddc10ddf72dc1f607c4a06afdbd66bf8ab6df200ac5b633de283895d`、norm `2a1d57513c2b52986d496f6c1aaade0d46bbadc64be88fe7072a1a6cd58858e0`）。

证据快照在 `/tmp/sglang-terra-next129-20261105T233525Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:37:56 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next129，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `ee492c03add7d1f66205638115d606de1510b3067b93a2bb36f59164cca6b48f`、norm SHA `699716e5d1f8f7052c1dc5796d9599289b79c292d5dfab5494ac74a4d094d43a` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `4ca1ffd305d7d7ffced35d3d1633a7684111bf201757558a22e59dd9e64e848b`、norm `5cf091738d3b160a814002001b43ef8abfec318f7c4f01ec950bd4aa226c5575`；follow-up raw `5b3b5c03037505bbf499821456b977d933e75e62042600d7aed961560ed8f9e8`、norm `b54db384edc9d69d18c3222896df6a1773cc98a41fd3a16d60e6225a8d890320`）。

证据快照在 `/tmp/sglang-terra-next130-20261105T233756Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:39:47 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next130，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `d27678aa1594a39133565f48a33f9ee3440deaf55b86e59244831443d63bbf9f`、norm SHA `64ebab843fec7da521556d61772bea7b72c62689f2453f9125803248d4874ac2` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `593023132fa899e73cbac9d111cd2231ae93d8926e79c6ead4618acfb15bfd28`、norm `c3035128437787450e49cbcfa1475b04e596accc6690bc4b45e98ab940b6ae4f`；follow-up raw `1c8818eea251873aa54161b1b2df40ddd2693e6a385cb0b51a557c8f30751e03`、norm `2c5acfdeb28e8d4f82edd54d268cc89e02c369d802ba8ebf4ac4ab3f36a44b29`）。

证据快照在 `/tmp/sglang-terra-next131-20261105T233947Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:41:13 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next131，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `0b4a9d959d05b7bcd6bf8906578f4ac04f12e3c1ea864755ad5746942fad3414`、norm SHA `989df1f3f6003fd722df17707cd996dce5bfd0ae4747de8a3f3b7c6767b86219` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `48b839dbb2d52bd1cc4ee6edd134eca81ced5ec5b1b1fd476800a3112f4c4235`、norm `aabbba0077bf95986df36f9d758c5f3c5a399c09d9be2e9281e471e2115e2d08`；follow-up raw `a4075de6778fce0d5820ebe2cde4acec44cbdf8a4b55201c2aeaa2597bcfd3ef`、norm `9dbd1b14d35d1544f9a75841712f60375b6c77cf3d0c752bb75951c845ff1fb9`）。

证据快照在 `/tmp/sglang-terra-next132-20261105T234113Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:42:44 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next132，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `40fb11d619d33a91e74bca568797edb625d3e8c5ef7f28117f7706892b2bfa2f`、norm SHA `02e944bfca71a629707be724c2a70e278a019c718a8721790806ec1cc1421def` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `623f7c1c033815d7fad2b8e327196280483a7f83f46e20ec5a416a97016b0d94`、norm `8092991727a6d8ea2027d1fc411919a7efe2b8f4fe243c19a179987594a21f50`；follow-up raw `c3a22e73adf944edbea9cd99291bb0d05f82527246a8239e9fd6c247bc185812`、norm `e22afc035732947f6ecb8a2d75cd1e5e5d58df3bf20264170a3eca7bfd0dec34`）。

证据快照在 `/tmp/sglang-terra-next133-20261105T234244Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:44:20 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next133，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `fc2ece352a557047c7f4f5021e57873af352dda0b3c7b28e31ee5b3919702048`、norm SHA `84e2a27c8e024fa49c10ad9c3361920d0a6a3c93b28692ceb564ced2a823ea38` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp/序列化长度变化（首轮 raw `07fec2e93e40552d820bbccf99baaa5c91105ae7bb306f7d550f0b5d3cbd8e40`、norm `0de2efe43b230e88a682b99ab0e4b9c775a5f08d78a8416c8225567cda6dc0c3`；follow-up raw `a7752ad99f058994e85c9cb09e2f7d2cf01df1c95a491915c4fe95e3e86e5c62`、norm `e90c90c1ef2ea3ea3221f346026d08017545e2a8d0db02dac2f5581f22f0723d`）。

证据快照在 `/tmp/sglang-terra-next134-20261105T234420Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:45:48 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next134，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `89f8e6f484f4d01ff1613b36321b90cd2e922c570ee29f5a52dd882828322267`、norm SHA `a20908a8aacf166048691f869e0eaf6a205a3d967fb859a7aee514480edd7a04` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `cfa106609b1110237ab718f3350c391e3ae4f08c8f9daf62a61c84c08587a557`、norm `e27fdfd4d2d583c5c8ff97c6b749b0a567ca9887afa64f0f46166f4f550aeb7a`；follow-up raw `26d6a94a3990e8414217dceb4a9ca32134427cdc85c9fdb9d4b284c4b992862f`、norm `3184f50c0dbaed85d6f55e9d3d082d3eb452995623b452dbd7cafa8c708597ee`）。

证据快照在 `/tmp/sglang-terra-next135-20261105T234548Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:47:11 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next135，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `47e1c67411795921e269e146ca100693f2e0af9cbbd29245ebf2b82bcde600a1`、norm SHA `142cf455899f1912961c3bc358b544799b2d521530094f36ab19299af896cefc` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `c6e4273f0032ca18ba794b4d0117e6fcedbb1f15feabf47e33c7f8fb8b9106f7`、norm `0f95c446a6bc24455cddc39566ca0d53ae03f53730b45c045219c37c9246c390`；follow-up raw `8c9cd95c5fab405387a5d548d6dc15f6ac2cbea52dadda6bbd464cf7b3423a86`、norm `cb20b0aea22766a2276c06b4a52d6ac7458959abe390b44283ba4846f50d2518`）。

证据快照在 `/tmp/sglang-terra-next136-20261105T234711Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:48:35 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next136，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `feef9ac22c5c6dc8781260cfa06a001346bb61fdf73520561e6d5b5954742892`、norm SHA `47d41447032e1101abaad5f8d9778b69125a3e5e6fd0d86584f2bd62765ebe87` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `768650db3182b0e3703dfc517a87e76f226f7ea0cad5b919855eec277a785739`、norm `103042141869ac90278e29c5167f51bbd91b7a1d1b2d4a6eaf1de7faecc6a5bb`；follow-up raw `e4a0298a45a171d0d8551b6ff867357e49245efb9c4a75d80e647f28ccf2b55c`、norm `734e71efd9a103cf5208a232afe1b02748fd7c0d4d693991cfd1a56cc3085759`）。

证据快照在 `/tmp/sglang-terra-next137-20261105T234835Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:50:06 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next137，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `d0d57e3c54f41fa3d0700552b07b932876cebef4f1527b84636ea40545abd1d6`、norm SHA `f46575b96ed62432f6ca3aa96389945685e2db8c2834e81a4170acba518c5737` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp/序列化长度变化（首轮 raw `0e19794df69769f36059e3efad42df69c3608c2b772904b229828048fd7c401a`、norm `2bf310925a5a2f38b4f66eaddd328191dee76f0ed33a9e474486636ef1ae585f`；follow-up raw `9cb2bc34a122b90b6e837dace6c9965df7ef271c368ed72054e96663f811b165`、norm `18e9f2d9474d2823b1ef270d8300c90de92b4b2e5845afcd382a3e548a24b712`）。

证据快照在 `/tmp/sglang-terra-next138-20261105T235006Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:51:30 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next138，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `7da4c302fe96ac0c40a03348d7b4b3f23932340e695af97f13023c8b0698452a`、norm SHA `351b0f9d411b42d3cce93bcb478f31b85b8b9cd1c62db4ecf3b85ba74005a8e8` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp/序列化长度变化（首轮 raw `473620b1ab6e45d0d0c078a1d4eaeeeba8159f5ef5a966403cfa0554ebaef19a`、norm `3732fad0299170848efa053b3516e9fe94b174ff91bfe42f746b3b8f4439b030`；follow-up raw `34930349a7d893d5df6dc432ed546fe4cea698a30d967e720266f1d23e9cbc07`、norm `c4f9354f0edfd3359282901fd4d513c088d7c0e5c520099b5186607ceb9dd3a2`）。

证据快照在 `/tmp/sglang-terra-next139-20261105T235130Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:52:44 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next139，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `bfc0b1dabbd0f48b39405ee24683462062ed97b3ca284227efe92551aded3e5a`、norm SHA `a14c4a6f7054a0a0413ef7db3adc4af4def4b068e631397f3d98e7658b7740eb` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `cb5c87f9a31fde213e46fc0e5e7600dc74930c119e00dccb7325852043be70b8`、norm `3638aa56926c37d91c87e119769a7e41292387414b9d0e4724510e48321ba988`；follow-up raw `f33f0bb872ba86115c66690bf8cfb71d7a49b44c509a5fc84ff40911d14546b8`、norm `b7557132dd8ee71d606007070f61d84de2a27f915e804610ad25d11940f9e90a`）。

证据快照在 `/tmp/sglang-terra-next140-20261105T235244Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:54:10 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next140，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `7525fd36a6f045a572832029ef6a911c83c78358e8aa8346e669edd0ff3a9b3d`、norm SHA `ecce8c8767de7f05ab5c92d995fad755ce0534c1ad4332ec43b598e94deb4502` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `e7a6f1840c09562a68bc547740cff251d1cbdc185b3da63cfbc9953ade50219c`、norm `e827cd22cbc10c06e973bda6624a5c5b20eb98d6af2414164dbc6307adb01313`；follow-up raw `748040f80b7afb6f11a42ce9e74c960325f8cfed799141f182af0c4ff4d2e1e1`、norm `9c73d92cd8e1661fc2da5a26ab14e2b59c208c79109000aded56549e64958d73`）。

证据快照在 `/tmp/sglang-terra-next141-20261105T235410Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:55:24 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next141，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `1bac7ed800affc6b4f2aa3a292e36e1ff9a2de5c5ae90fcf2f45425490675c11`、norm SHA `9dc7449d1467cb19a90269f07d1c9707fd4ea43640e4f8dbc0c2d21c434a5d7d` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp/序列化长度变化（首轮 raw `82bfdb924a4ac7afd435a9ea5b1250261d1127fd75d0fe14b0438aafd7fd1a20`、norm `b7f4b330b5e58fa4327788f2d17c58c870b17b0eb9d4bdedd8badf761db882f7`；follow-up raw `6222fb9cc2d46dfbf4387d26c0d81563e93c8ff999ed60463da2fe278928ea3a`、norm `5d634449bf24f93878689c37480080ada859fd366b4de7e0ff641e522261d7b7`）。

证据快照在 `/tmp/sglang-terra-next142-20261105T235524Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:56:40 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next142，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `391dbb93cf86e9bedac0a7ba0b13a0065d9d3d55daa66149cb6e2e8bd3473074`、norm SHA `33e720f663855457924ad7b6d2a55968dce70a239787ff33e6fe6a753b4b953f` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `eec9a31de47073d0b8beb7bddbf77f3f29debc0ec4e00a502f5aa69356c0ffbe`、norm `815125d306559a5f073d3ccfbc3915c8723ee128e18ea468fda3c17c04ed9d3f`；follow-up raw `0dee50174936d0bd8ddbd9c153af8ec0600dc87939b6df593c13bba1f29e42b9`、norm `f7add0a8a73ee94182f6635db090c658bfbbb9d5deaae4fc3b334b0e201688db`）。

证据快照在 `/tmp/sglang-terra-next143-20261105T235640Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:58:05 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next143，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `a7a000644f5db40fbfbeb035f5a2e2e0df4787a7abd5862781724ae7c1860b80`、norm SHA `9eee8c323b4fda62d3bcf143ba4de2141b5e00cbe42a182fa0c576c4f092b437` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `e02de5c7663b7c3b3b9f4724d998c1496e7d6fb8b606cfae6c61508fd1edc66c`、norm `06715407d7fba4caafa58c94b6ccc8213a0cb065f68fb182cfe5afaa20c3f50a`；follow-up raw `82084f7bbb75088f9a8dd54e89bfac07eb62df065aab41624e6d8f44b55ff8ab`、norm `bcd4b810f38ae3f62044a15a33c424a28cbba3b8d9a5ea5506af6f7c4154ec73`）。

证据快照在 `/tmp/sglang-terra-next144-20261105T235805Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-05 23:59:31 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next144，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `7e99850dc18015326b58a35565a48b79c1de7fc582d6358d7172323851ecc0db`、norm SHA `32f34c82a3453996b59ce441d1846d7a0e586db264181366d3ad29aeaa947cd3` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp/序列化长度变化（首轮 raw `672cd0ebde0e5fe179b08517bd12520fbf473c0350f3da897fff2148b01a7bf6`、norm `feb8a4b2c62e71e006b2f30111d9e696ee4d77c6ab9c18db3526c57d28c9aeee`；follow-up raw `e6c59017749d944d75325a35604031256605bb9998064724f4794a787e7b9d8f`、norm `a8e690c71aed55cf3a0e789b7fa597b100b9d2b8dfd36d475bbd1c9e049cd1d5`）。

证据快照在 `/tmp/sglang-terra-next145-20261105T235931Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:00:51 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next145，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `4b9b3f3f596f1486049a79e87d64e4b6bf399af780d9330ecf9ea460c276134d`、norm SHA `60dda7a640fce5b5638004c8b528682649c171fa2c17c7ac5a07297edae3f329` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `0577906a05e61bb529a7c89e86aadef5d14653d57543624e5b421680c2d1674d`、norm `0321c1a9eea2dc46d527afa30d14673d114dd05677a0447e9a76e32f412b16e4`；follow-up raw `47ab332051a2d17cef74674f454d78a7e57614e5f13c86b4ddecca901011170e`、norm `f8dd58bf9a3b4b5cb906c8b3605fef782dc9c03a936a1d14bc0a1133ea709ea8`）。

证据快照在 `/tmp/sglang-terra-next146-20261106T000051Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:02:08 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next146，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `9e5b393ddd967a24390d39f3744bde9c67a7d62861abcc3e2b481bfa102b7c4a`、norm SHA `83220b692f71839c24a7a3d38ca1ea9edb0721a0ab99e2222291033f80479093` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `31b18a3e096e2e1d9d6fbcd74402f3e8f8eecefe468bd15d4b86f05ad95cec58`、norm `98d5ea0f27bbb886c217167cf0031f38cf92e5e7dc1d88a91fe681e05e76dfab`；follow-up raw `45dde7a9cfc830c75e21c5ff7af8a7037e6c6fb11178cac952426c522a14ec5a`、norm `b74516e47d453b63228c53ec576768c064154ef3717f57896b9ed6920f6fb70c`）。

证据快照在 `/tmp/sglang-terra-next147-20261106T000208Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:04:39 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next147，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `5245040a4d75305d29dd832e8b0704eb7ac1539d2f2e3f701ee41629e563ed9a`、norm SHA `555ade6ee549613f7d435f059ed355e6e3824907387626bbd7c98a2b059093c4` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `d879e7f3fb6f0ab4d5b3fd370217187d983a7c10d7e9e614c0d83cbefc76921b`、norm SHA `71a55d0c548f2be3fa92efcc7d95bc3e37cd6760dd6e45640cae999b3d342821` 均一致。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；speculative `accept_length=2.239706132582149`、`accept_rate=0.3875`，`avg_spec_accept_length=2.239706132582149`、`last_gen_throughput=0.04724409932338081`，runtime counters/speculative/load 稳定。loads 原始/规范 SHA 仅因响应 timestamp 变化（首轮 raw `d6544c02cd294d66fcc87881dfe45906dd709c5047ae944b57affe2e2e45ae64`、norm `9d60c3b42942c6738cef0452c55b202f2086d14bf5983a9c4aec54b1c8f674d6`；follow-up raw `216c46b5776f93a64fc015a868ab8d8cb7a396624f99d3b4206aa362be04d216`、norm `09fb0d83b2634a0a074156daebc874411f9d8e9b8ee0e38aabc5581d28d0c09b`）。

证据快照在 `/tmp/sglang-terra-next148-20261106T000439Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:06:56 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next148，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `19ccade9fe626d73c3894a418b576fe48d92c4785914a4d4fd2be2d8691a1860`、norm SHA `1d2af64e247d8c7ced8f6006fbcb59f92a379b7ca19ac107c1c797204d713adb` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，但 runtime internal state 已推进，首轮与 follow-up raw SHA `999c69e9e6b595c03536c232709b23af6bea20e53d6e9030934962a677ae8088`、norm SHA `16b33fb00ea7708571f457f32134f19e997ff0bbea327f93aaddc52a33c87d03` 均一致。

相对 next148，`avg_spec_accept_length` 从 `2.239706132582149` 变为 `2.2397080224146224`，`last_gen_throughput` 从 `0.04724409932338081` 变为 `6.878036739821834`；这说明服务 runtime counters 在本轮前已发生真实推进。首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；两次 speculative 均为 `accept_length=2.2397080224146224`、`accept_rate=0.8375`，follow-up 稳定。loads 原始/规范 SHA 因 timestamp 与运行时值变化（首轮 raw `88c36446f4aed86211d687fddd6ded3f5ffb9990ff3b59f6fa9fdd478dc94158`、norm `3729fce2692ccf2995fb2def60fedac0b5b3db986474c72b3f645537de4c4a51`；follow-up raw `f8bf2d1afa2f2196ee9d1964700994aa6f10da470efb551ae1593180cf2d8b0b`、norm `331f4b70b2de6b7baf60c86e6a5f9697d6e61e12a50a82d7c5b03961b6bebd73`）。

证据快照在 `/tmp/sglang-terra-next149-20261106T000656Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:09:49 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next149，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `2be367bacef063c5288b6b6e3eb5729b8f06d802a4b6aa0e37f49ce000a4c683`、norm SHA `51d34fb1be08fa1385cce3835e15139aadae06d555d8eec46f2cd4aa2f94eead` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，但 runtime internal state 再次推进，首轮与 follow-up raw SHA `fe5ecb9333640c494fee98a2e8bfd4f27da5ef272ee5ca7ce25d929bb29311d7`、norm SHA `875dc7f2574352491e931d88e980837504574a8d554cd82fc6cc44694a4c2ee0` 均一致。

相对 next149，`avg_spec_accept_length` 从 `2.2397080224146224` 变为 `2.239705862523092`，`last_gen_throughput` 从 `6.878036739821834` 变为 `280.709231329015`；runtime counters 明显继续推进。首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；两次 speculative 均为 `accept_length=2.239705862523092`、`accept_rate=0.6625`，follow-up 稳定。loads 原始/规范 SHA 因 timestamp 与运行时值变化（首轮 raw `8da42b10099ecb177b7e99629f41ee66bb1f674001e3332006a5431b66e9a636`、norm `44def3001c013351153a7510513b357a7f5b388442dd9b2808e88c1e4392fc8e`；follow-up raw `b467903263426332060989f4c76bd2fe5090cf48c17a3a4a48b2d2bc24681fb1`、norm `67ed9b2781c737a629db5d9c9aa54d0b900706a7380c35cbaedc2a911c1d60a9`）。

证据快照在 `/tmp/sglang-terra-next150-20261106T000949Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:11:20 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next150，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `d6e096171732cd157d3762dcbfbc530e3b2e462d69f5fbb59e4800ca87f629ec`、norm SHA `5344dfdc293053e6348bbc17595696fc6768b655ab102146a997940e2d30ad24` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，runtime internal state 再次推进，首轮与 follow-up raw SHA `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307`、norm SHA `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959` 均一致。

相对 next150，`avg_spec_accept_length` 从 `2.239705862523092` 变为 `2.239731814484295`，`last_gen_throughput` 从 `280.709231329015` 变为 `253.25572234608495`；runtime counters/speculative 继续变化。首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；两次 speculative 均为 `accept_length=2.239731814484295`、`accept_rate=0.7`，follow-up 稳定。loads 原始/规范 SHA 因 timestamp 与运行时值变化（首轮 raw `dfa43370ab2ab5409146892f4a6841ebda3a1cd1fa5ab591387abc06b1fed013`、norm `7fe1cef96a3594f5d8af86df7269bd37b3ec2d9dc847336564130381de62ea85`；follow-up raw `b1b0c29a0d41cb4e992fa4f38a76b1d7a77ccde6a21d7ac2b7534f7c6c9d20be`、norm `f98168edc9f2b744d9e0df8e0dcfded6e2f6a364c343da8f3d38520cad52eaeb`）。

证据快照在 `/tmp/sglang-terra-next151-20261106T001120Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:16:21 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next151，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `c517fe629b835b7564cb7fdc91033e51a1b10abae7450453106d45da98681d56`、norm SHA `6cad1999dd141706dc2c68859362dcd49a5438a7cac9c810b7e17d00ba91f0b5` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，raw SHA `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307`、norm SHA `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959` 与 next151 一致。

相对 next151，`avg_spec_accept_length=2.239731814484295`、`last_gen_throughput=253.25572234608495` 均无变化；首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；两次 speculative 均为 `accept_length=2.239731814484295`、`accept_rate=0.7`，pair 内稳定。本轮未观察到新的 runtime/speculative 推进。loads 原始/规范 SHA 仅因 timestamp 变化（首轮 raw `e4126f7d115309c87c77ea5f7ec5f073ba63196d3f68d61bbed7159afea969a8`、norm `dba805496865be6bbd7be75bedf1c036cd30911c866e6983846cc011612085ba`；follow-up raw `8bb79c489cf087917278221ff59aa24d2e609d119781495e2db9fa064b71aaf4`、norm `4e17ef899610d373793e96ce446a1d4a649889fc3a90d5a761235f2632c91f06`）。

证据快照在 `/tmp/sglang-terra-next152-20261106T001621Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:33:05 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next152，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `6c44335ab6d5b7312ab4f61a6a7161b6c23961b26da7e541007fef1a4809f672`、norm SHA `b4218123b744b0dbce6e31cfca9703da31575d3a146f9574831a93bed97a1c5e` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，raw SHA `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307`、norm SHA `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959` 与 next152 一致。

相对 next152，`avg_spec_accept_length=2.239731814484295`、`last_gen_throughput=253.25572234608495` 均无变化；首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；两次 speculative 均为 `accept_length=2.239731814484295`、`accept_rate=0.7`，pair 内稳定。本轮未观察到新的 runtime/speculative 推进。loads 原始/规范 SHA 仅因 timestamp 变化（首轮 raw `3c73856014e2c527e3720114c40ad6b5a4940375d31258164a175ce5204c8adc`、norm `c1856dd76a557c6dd0f6f624f3d927882636f474f596ead93c5884f310a209ff`；follow-up raw `4613dcca28d51c6290bdc39c6a10e756ce7946e8bed0da36d7706dfa8d7740e5`、norm `ee50db3e9f53711db971889cdfaa056a93d1ee078a0d7bbce2595d437c003a89`）。

证据快照在 `/tmp/sglang-terra-next153-20261106T003305Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:34:16 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next153，`/v1/models` 的 created timestamp 变化导致首轮 raw SHA `a037d7360ecc551c1559e383c16a9850bdb022464492bd09a2de3dc6214fe283`、norm SHA `91ebcc7728092b934255bd724a63e190bc93ac57d15f200f8f5ea02170aa5ef7` 更新，语义字段保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，raw SHA `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307`、norm SHA `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959` 与 next153 一致。

相对 next153，`avg_spec_accept_length=2.239731814484295`、`last_gen_throughput=253.25572234608495` 均无变化；首轮与 follow-up `/v1/loads` 均未捕获运行中请求：running/active/total/used/waiting=0、gen_throughput=0、utilization=0；两次 speculative 均为 `accept_length=2.239731814484295`、`accept_rate=0.7`，pair 内稳定。本轮未观察到新的 runtime/speculative 推进。loads 原始/规范 SHA 仅因 timestamp 变化（首轮 raw `5e4c8f109f1819751378550e0eb2086371a13aa942c5d4e0db1046ac8b6680f7`、norm `1c6fc3a026e4c05f44cb9b1c0f4d036f419100069d658ffb4b6d01d00d059835`；follow-up raw `15e0891a3edaacf94f3071f9402045df9d14f2ecf91c065f001b6a40ba6d9f66`、norm `df5cccc07b68f151b68657de67ced0bbf7ba8317e8590bb614f0c55d2d77f405`）。

证据快照在 `/tmp/sglang-terra-next154-20261106T003416Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。
### Terra served-model 语义与运行时计数复核（2026-11-06 00:36:05 UTC）

Terra 对远端 `192.168.10.68:8192` 的六个端点首轮读取均为 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`。served model 仍为 `Local`，`max_model_len=262144`；模型仍为 Ornith-1.5-35B-A3B-NVFP4，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。相对 next154，`/v1/models` 的 created timestamp 变化导致本轮 raw SHA `df59c43fc02122a046e36162b18b1e6800e9b170b66948521b673620193fabff` 更新，唯一 served id 与配置语义保持一致；`server_info` 与 `get_server_info` 仍为 495 字段，首轮与 follow-up raw SHA `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307` 一致。

相对 next154，runtime/speculative 指标保持不变：`avg_spec_accept_length=2.239731814484295`、`last_gen_throughput=253.25572234608495`；首轮与 follow-up `/v1/loads` 均未捕获运行中请求：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；两次 speculative 均为 `accept_length=2.239731814484295`、`accept_rate=0.7`，pair 内稳定。本轮未观察到新的 runtime/speculative 推进。loads 原始 SHA 因 timestamp 变化（首轮 `327133753f1e53ed481a4096725c57e7c7eaa6dfdb84dcfaf5ed323b104d500d`；follow-up `3b149fa7d561f421393e0dd4d7ea613549f408c291ebeac40b26d837a76835ab`）。

证据快照在 `/tmp/sglang-terra-next155-20261106T004000Z/`，包含六端点首轮响应及 loads/server_info follow-up 原始响应。本次未发送 chat、未运行 editor runner、未启动/停止服务、未改远端配置或仓库、未提交/暂存；F21 第二模型/第二端口、认证拒绝、wire capture、默认窗口人工视觉仍未覆盖。


### Terra served-model 语义与运行时计数复核（2026-11-06 00:40:48 UTC，next156）

Terra 对远端 `192.168.10.68:8192` 的六个只读端点首轮均 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`；`/server_info` 与 `/get_server_info` follow-up 也均 HTTP 200。served model 仍为唯一的 `Local`，`/v1/models` 的 `max_model_len=262144`；配置仍为 `Ornith-1.5-35B-A3B-NVFP4`、`port=8192`、`tp2/pp1/dp1`、EAGLE 2 steps/3 draft tokens，LoRA、encoder/register/key 与 API/admin key 未启用。server_info/get_server_info 仍为 495 字段，首轮与 follow-up 规范化 SHA 均为 `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959`，raw SHA 均为 `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307`，与 next155 一致；`/v1/models` raw SHA 为 `1554c8887aacd7d42559ba2570bf78879c5a1fcd316148061b29113b4b32f085`，规范化（去除 created timestamp）SHA 为 `c7cd7f7e1a71e8fd5eca9ce31af28258fa8910e6d46bf3db948b6775d2adb464`。

首轮与 follow-up `/v1/loads` 都未捕获运行中请求：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative `accept_length=2.239731814484295`、`accept_rate=0.7`，与 next155 保持一致，pair 内也稳定。loads raw SHA 为首轮 `39b013cfd9f01e8a2daa9ab1a20e42ab29b568b1f0292245a487ab2471d2c017`、follow-up `155f031a68e2e48869b12c2914b3f380f15330e7619b7937e70b5f7953a44d86`；去除 timestamp 后两次规范化 SHA 均为 `4f46767d32daf1ba9241a92cf6401501b9adc0358c8b702f88983a2027eb6435`。`/metrics` 仍只出现 `model_name="Local"`，本轮 raw SHA 为 `f5eec07ff4347ec8258553e257d68cb2fd3a6adbf52c69a0441512e3929fe12d`。

证据快照在 `/tmp/sglang-terra-next156-20261106T004048Z/`，包含六端点首轮响应及 server_info/loads follow-up 原始响应与 `summary.json`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未修改远端配置或仓库代码、未暂存/提交/推送。F21 第二真实 served model/第二端口、认证拒绝、wire capture 与默认编辑器人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:44:32 UTC，next157）

Terra 对远端 `192.168.10.68:8192` 的六个只读端点首轮均 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`；`/server_info` 与 `/get_server_info` follow-up 也均 HTTP 200。相对 next156，served model 仍为唯一的 `Local`，模型仍为 `Ornith-1.5-35B-A3B-NVFP4`，`max_model_len=262144`，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens；LoRA、encoder/register/key 与 API/admin key 仍未启用。server_info/get_server_info 仍为 495 字段，首轮与 follow-up raw SHA 均为 `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307`，规范化 SHA 均为 `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959`；`/v1/models` raw SHA 为 `7237dbf90df924776a59162587cb939fbbdae7fd57673b8ed39b4259827e3a36`，去除 `created` timestamp 后规范化 SHA 仍为 `c7cd7f7e1a71e8fd5eca9ce31af28258fa8910e6d46bf3db948b6775d2adb464`。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative `accept_length=2.239731814484295`、`accept_rate=0.7`，与 next156 相同且 pair 内稳定。loads raw SHA 为首轮 `462d4fe53db6797073203915aedad921af65121a49d48b6854160f3e1841b26d`、follow-up `c61b44babc2bd63cebb22de6d26fda544ba864f91fffa741e70d65e2594de0c6`；两次去除 timestamp 后规范化 SHA 均为 `4f46767d32daf1ba9241a92cf6401501b9adc0358c8b702f88983a2027eb6435`。`/metrics` 仍只出现 `model_name="Local"`，本轮 raw SHA 为 `02f4068f87d0e1deb1ab8f47c8323573d5723e886dcfd193d503951a4447ec88`。

证据快照在 `/tmp/sglang-terra-next157-20261106T004432Z/`，包含六端点首轮响应、server_info/loads follow-up 原始响应与 `summary.json`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未修改远端配置或仓库代码、未暂存/提交/推送。F21 第二真实 served model/第二端口、认证拒绝、wire capture 与默认编辑器人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:46:26 UTC，next158）

Terra 对远端 `192.168.10.68:8192` 的六个只读端点首轮均 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`；`/server_info` 与 `/get_server_info` follow-up 也均 HTTP 200。相对 next157，served model 仍为唯一 `Local`，模型仍为 `Ornith-1.5-35B-A3B-NVFP4`，`max_model_len=262144`，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens；LoRA、encoder/register/key 与 API/admin key 仍未启用。server_info/get_server_info 仍为 495 字段，首轮与 follow-up raw SHA 均为 `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307`，规范化 SHA 均为 `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959`；`/v1/models` raw SHA 为 `99d2562459332c0c700f8600d08a7917c61afc8af308906eb5ceba41d2e2196e`，去除 `created` timestamp 后规范化 SHA 仍为 `c7cd7f7e1a71e8fd5eca9ce31af28258fa8910e6d46bf3db948b6775d2adb464`。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative `accept_length=2.239731814484295`、`accept_rate=0.7`，与 next157 相同且 pair 内稳定。loads raw SHA 为首轮 `5924176515f4e8e555da5483bed2417074ebd91da46125620ea07d4648bb54cd`、follow-up `2fc80d0b5e3d22d413f36a7a9a9a3e8b5ecb9196fe05cda00bb0fa5b2c8a4e40`；两次去除 timestamp 后规范化 SHA 均为 `4f46767d32daf1ba9241a92cf6401501b9adc0358c8b702f88983a2027eb6435`。`/metrics` 仍只出现 `model_name="Local"`，本轮 raw SHA 为 `0e01bbf2afed687632720a66a1b342d2ead51eca7b2d803005799a9d7c22ddd9`。

证据快照在 `/tmp/sglang-terra-next158-20261106T004626Z/`，包含六端点首轮响应、server_info/loads follow-up 原始响应与 `summary.json`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未修改远端配置或仓库代码、未暂存/提交/推送。F21 第二真实 served model/第二端口、认证拒绝、wire capture 与默认编辑器人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:49:36 UTC，next159）

Terra 对远端 `192.168.10.68:8192` 的六个只读端点首轮均 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`；`/server_info` 与 `/get_server_info` follow-up 也均 HTTP 200。相对 next158，served model 仍为唯一 `Local`，模型仍为 `Ornith-1.5-35B-A3B-NVFP4`，`max_model_len=262144`，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens；LoRA、encoder/register/key 与 API/admin key 仍未启用。server_info/get_server_info 仍为 495 字段，首轮与 follow-up raw SHA 均为 `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307`，规范化 SHA 均为 `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959`；`/v1/models` raw SHA 为 `c1e6aba908e31af627019abf1b497db2a6722d55b118f0beaf64757697044b15`，去除 `created` timestamp 后规范化 SHA 仍为 `c7cd7f7e1a71e8fd5eca9ce31af28258fa8910e6d46bf3db948b6775d2adb464`。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative `accept_length=2.239731814484295`、`accept_rate=0.7`，与 next158 相同且 pair 内稳定。loads raw SHA 为首轮 `8e4c96f2c1b5e80ec54f95e7da36db4692f42ff45a7e6403c7974b9c58f0458b`、follow-up `e0d14676869bf9d27b452f40bf41ec85a753433b1b82c77c13a4d5f6a421cd8b`；两次去除 timestamp 后规范化 SHA 均为 `4f46767d32daf1ba9241a92cf6401501b9adc0358c8b702f88983a2027eb6435`。`/metrics` 仍只出现 `model_name="Local"`，本轮 raw SHA 为 `f7a8c23f950294dfc564ed4db27c40510df1591c09fd45b48ed2180cc94e5e3d`。

证据快照在 `/tmp/sglang-terra-next159-20261106T004936Z/`，包含六端点首轮响应、server_info/loads follow-up 原始响应与 `summary.json`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未修改远端配置或仓库代码、未暂存/提交/推送。F21 第二真实 served model/第二端口、认证拒绝、wire capture 与默认编辑器人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:53:29 UTC，next160）

Terra 对远端 `192.168.10.68:8192` 的六个只读端点首轮均 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`；`/server_info` 与 `/get_server_info` follow-up 也均 HTTP 200。相对 next159，served model 仍为唯一 `Local`，模型仍为 `Ornith-1.5-35B-A3B-NVFP4`，`max_model_len=262144`，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens；LoRA、encoder/register/key 与 API/admin key 仍未启用。server_info/get_server_info 仍为 495 字段，首轮与 follow-up raw SHA 均为 `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307`，规范化 SHA 均为 `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959`；`/v1/models` raw SHA 为 `beaea39fffe777b503fd5a9f83ad8231120589a1b3ab70a261a4971e29a2ff67`，去除 `created` timestamp 后规范化 SHA 仍为 `c7cd7f7e1a71e8fd5eca9ce31af28258fa8910e6d46bf3db948b6775d2adb464`。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative `accept_length=2.239731814484295`、`accept_rate=0.7`，与 next159 相同且 pair 内稳定。loads raw SHA 为首轮 `cfe272bd14db7338cbf25090f7b9996b94d0c06fc26591b35577da42c4386c7b`、follow-up `4f2e080b44ce1bff2128777f01214f26f3bc6c5d992d617eea83c34d9f281d30`；两次去除 timestamp 后规范化 SHA 均为 `4f46767d32daf1ba9241a92cf6401501b9adc0358c8b702f88983a2027eb6435`。`/metrics` 仍只出现 `model_name="Local"`，本轮 raw SHA 为 `00f9896beed52ae17ecf2e223cda3d852f32833b144414ecb128aff82ffa4a2b`。

证据快照在 `/tmp/sglang-terra-next160-20261106T005329Z/`，包含六端点首轮响应、server_info/loads follow-up 原始响应与 `summary.json`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未修改远端配置或仓库代码、未暂存/提交/推送。F21 第二真实 served model/第二端口、认证拒绝、wire capture 与默认编辑器人工视觉仍未覆盖。

### Terra served-model 语义与运行时计数复核（2026-11-06 00:55:14 UTC，next161）

Terra 对远端 `192.168.10.68:8192` 的六个只读端点首轮均 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`；`/server_info` 与 `/get_server_info` follow-up 也均 HTTP 200。相对 next160，served model 仍为唯一 `Local`，模型仍为 `Ornith-1.5-35B-A3B-NVFP4`，`max_model_len=262144`，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens；LoRA、encoder/register/key 与 API/admin key 仍未启用。server_info/get_server_info 仍为 495 字段，首轮与 follow-up raw SHA 均为 `098bb8feee0f609490eb4995019d8f7203ae1a9a0b65a0246e4f377a3cac6307`，规范化 SHA 均为 `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959`；`/v1/models` raw SHA 为 `16da10c48d8ba2d0e2d1e69d025ef509d3f6a942807db40bcaaa1e9207695f9e`，去除 `created` timestamp 后规范化 SHA 仍为 `c7cd7f7e1a71e8fd5eca9ce31af28258fa8910e6d46bf3db948b6775d2adb464`。

首轮与 follow-up `/v1/loads` 均未捕获运行中请求：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative `accept_length=2.239731814484295`、`accept_rate=0.7`，与 next160 相同且 pair 内稳定。loads raw SHA 为首轮 `8947f8bda15a47eabb1b565745aa82f7f8b3a9f5cd80bd60a1222f39105027d8`、follow-up `bef69c3e1c4624b4315783e297f5b6dfb6202f8c83fb1da8833694149e0be7c4`；两次去除 timestamp 后规范化 SHA 均为 `4f46767d32daf1ba9241a92cf6401501b9adc0358c8b702f88983a2027eb6435`。`/metrics` 仍只出现 `model_name="Local"`，本轮 raw SHA 为 `21017b31ee8da34963793bdfdd31514afd10115684a407a62108173441fb6eb3`。

证据快照在 `/tmp/sglang-terra-next161-20261106T005514Z/`，包含六端点首轮响应、server_info/loads follow-up 原始响应与 `summary.json`。本次未发送 chat、未运行 editor runner、未启动/停止服务、未修改远端配置或仓库代码、未暂存/提交/推送。F21 第二真实 served model/第二端口、认证拒绝、wire capture 与默认编辑器人工视觉仍未覆盖。

### Terra 真实 Local 接入探针（2026-11-06 00:56:47–00:57:17 UTC）

按真实 provider 探针要求，对 `http://192.168.10.68:8192/v1/chat/completions` 发送了 `model="Local"` 的最小非流式请求，消息为 `Reply with exactly OK.`。第一次 `max_tokens=32` 返回 HTTP 200、`object=chat.completion`、`model=Local`，但 `finish_reason=length`；响应 assistant content 为 `\\n\\nOK`，`reasoning_content` 为模型的内部解释，usage 为 `prompt_tokens=15`、`completion_tokens=32`、`total_tokens=47`、`reasoning_tokens=30`。这次被 token 上限截断，单独记录为截断结果，不作为完整 stop 成功。

同一证据目录内将上限提高到 `max_tokens=64` 重试，仍为 HTTP 200、`object=chat.completion`、`model=Local`、`error=null`，`finish_reason=stop`，`matched_stop=248046`；assistant content 为 `\\n\\nOK`，usage 为 `prompt_tokens=15`、`completion_tokens=33`、`total_tokens=48`、`reasoning_tokens=30`。这证明当前远端 `Local` served model 可以完成一次真实非流式 stop 请求。loads 在重试前为 `num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`、speculative `accept_length=2.239731814484295` / `accept_rate=0.7`；请求完成后的 follow-up 仍为 running/waiting/used/active=0、throughput/utilization=0，speculative 变为 `accept_length=2.239724631971274`、`accept_rate=0.5`，队列已回到 idle。

完整证据（请求体、两次 HTTP 响应、重试前后 loads、summary）在 `/tmp/sglang-terra-real-probe-20261106T005647Z/`；重试结果另见 `retry_summary.json` 与 `chat_completion_retry.body`。本探针只证明单一 `Local` 模型的真实 HTTP 非流式 stop 路径，不关闭 F21 第二 served model/第二端口、有效认证拒绝、wire capture 或默认编辑器窗口人工证据缺口；未运行 editor runner、未启停服务、未改配置或仓库代码、未暂存/提交/推送。

### Terra served-model 语义与运行时计数复核（2026-11-06 01:00:34 UTC，next162）

在真实 Local 非流式 stop 探针后，Terra 对远端 `192.168.10.68:8192` 的六个只读端点首轮均 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`；server_info/get_server_info follow-up 也均 HTTP 200。served model 仍为唯一 `Local`，模型仍为 `Ornith-1.5-35B-A3B-NVFP4`，`max_model_len=262144`，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens；LoRA、encoder/register/key 与 API/admin key 未启用。server_info/get_server_info 仍为 495 字段，但 runtime 内部计数已随真实请求推进：规范化 SHA 从 next161 的 `df4e4cb1a2b19cb4936df243d7ce5f8161962a5608623fee2e5df9c7cdd02959` 变为 `8cd76abd34c31e3923650bc7243eb7d3e8bedadbc6ba8c89e478a6b2d011ffbe`，raw SHA 为 `2af3da92f5a918630b57a5328790445bd2b29282b20ab58f34deedd6ae390ea4`；差异仅为 `internal_states[0].avg_spec_accept_length=2.239724631971274` 与 `last_gen_throughput=0.028917885452626416`。`/v1/models` raw SHA 为 `cbed33c90f919d6c305a27e52b5af0db8552a3ece7f87afe0721bbe887821413`，去除 `created` timestamp 后规范化 SHA 仍为 `c7cd7f7e1a71e8fd5eca9ce31af28258fa8910e6d46bf3db948b6775d2adb464`。

next162 首轮与 follow-up `/v1/loads` 均回到 idle：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative `accept_length=2.239724631971274`、`accept_rate=0.5`，与真实非流式 stop 探针后的 loads 一致。loads 去除 timestamp 后规范化 SHA 为 `dfda8aa54f410c8e3cd9c045fece3c234f2961e7616e20eb8af6b67ea9b1d490`，首轮/follow-up raw SHA 分别为 `b4ee6c04b548e255b0ae7ab65e8c97ef5adead82c485a5e16fb2219686204013` 与 `aa7257d37cf09d1cb3904cfd63e0ebd2a8da732ecb33274b87f3e6da88288b49`。

证据快照在 `/tmp/sglang-terra-next162-20261106T010034Z/`，包含六端点首轮响应、server_info/loads follow-up 原始响应与 `summary.json`。本轮仍未发送新的 chat、未运行 editor runner、未启停服务、未修改远端配置或仓库代码、未暂存/提交/推送；F21 第二真实 served model/第二端口、认证拒绝、wire capture 与默认编辑器人工视觉仍未覆盖。

### Terra 真实 Local streaming stop 探针（2026-11-06 01:01:27 UTC）

在 next162 确认服务稳定后，对同一真实 endpoint 发送 `model="Local"`、`stream=true`、`max_tokens=64` 的非交互最小请求。HTTP 返回 200，SSE 原始响应包含 17 个 JSON data chunks，所有 chunk 的 model 均为 `Local`，无 error；合并后的 assistant content 为 `\\n\\nOK`，reasoning_content 为模型内部解释，最终唯一 `finish_reason=stop`，请求完整结束。

streaming 请求前 `/v1/loads` 为 idle（running/waiting/used/active=0、throughput/utilization=0，speculative `accept_length=2.239724631971274`、`accept_rate=0.5`）；请求结束后的 follow-up 仍为 idle，speculative pair 保持 `2.239724631971274` / `0.5`。完整请求、SSE 原文、前后 loads、解析摘要在 `/tmp/sglang-terra-real-probe-stream-20261106T010127Z/`，其中 `summary.json` 记录 17 chunks、content、finish reason 与错误列表。

该 streaming 探针只证明单一 `Local` 模型真实 HTTP/SSE stop 路径，不关闭 F21 第二 served model/第二端口、有效认证拒绝、wire capture 或默认编辑器窗口人工证据缺口；未运行 editor runner、未启停服务、未改配置或仓库代码、未暂存/提交/推送。

### Terra served-model 语义与运行时计数复核（2026-11-06 01:06:18 UTC，next163）

在 streaming stop 探针后，Terra 对远端 `192.168.10.68:8192` 的六个只读端点首轮均 HTTP 200：`/health`、`/v1/models`、`/server_info`、`/get_server_info`、`/metrics`、`/v1/loads`；server_info/get_server_info follow-up 也均 HTTP 200。served model 仍为唯一 `Local`，模型仍为 `Ornith-1.5-35B-A3B-NVFP4`，`max_model_len=262144`，`port=8192`、`tp2/pp1/dp1`，EAGLE 2 steps/3 draft tokens；LoRA、encoder/register/key 与 API/admin key 未启用。server_info/get_server_info 的 495 字段与 next162 语义一致，首轮与 follow-up raw SHA 均为 `2af3da92f5a918630b57a5328790445bd2b29282b20ab58f34deedd6ae390ea4`，规范化 SHA 均为 `8cd76abd34c31e3923650bc7243eb7d3e8bedadbc6ba8c89e478a6b2d011ffbe`；`/v1/models` raw SHA 为 `373bd7635ac953531f5a52c7eda2472c04357abf53dbcb7bb3350667f81d0d53`，去除 `created` timestamp 后规范化 SHA 仍为 `c7cd7f7e1a71e8fd5eca9ce31af28258fa8910e6d46bf3db948b6775d2adb464`。

next163 首轮与 follow-up `/v1/loads` 均回到 idle：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative `accept_length=2.239724631971274`、`accept_rate=0.5`，与 next162/streaming stop 后一致。loads 去除 timestamp 后规范化 SHA 为 `b62bf648a89d8727cca953c49b029926a975f7b5bec2fa2ce68462b694ee84c5`，首轮/follow-up raw SHA 分别为 `85a3ec0af3b548395ee1cff82e87502dd48b1fe0427f622b0f09ba800e5909a8` 与 `3f23f07819dc6ced37f318c1002dcaafad3ff7f4ae4d45bfb5a2b1f337d32515`。

证据快照在 `/tmp/sglang-terra-next163-20261106T010618Z/`，包含六端点首轮响应、server_info/loads follow-up 原始响应与 `summary.json`。本轮未发送新的 chat、未运行 editor runner、未启停服务、未修改远端配置或仓库代码、未暂存/提交/推送。

### Terra 认证边界只读探针（2026-11-06 01:06:49 UTC）

对同一远端只读端点 `/v1/models` 发送 `Authorization: Bearer terra-invalid-token`，返回 HTTP 200，仍只列出 `Local`，响应 body 151 bytes；server_info 已显示 `api_key=null` / admin key 未启用，因此该环境没有可验证的认证拒绝路径。本次只读探针没有发送 chat，也没有改服务或配置；证据在 `/tmp/sglang-terra-auth-boundary-20261106T010648Z/`。这不能证明有效认证拒绝，反而记录了“无 API key 配置时无效 Bearer 被接受”的边界事实。

F21 第二真实 served model/第二端口、有效认证拒绝、wire capture 与默认编辑器窗口人工视觉仍未覆盖。

### Terra 真实 Local streaming stop + usage 探针（2026-11-06 01:16:13 UTC，next164）

在 next163 认证边界只读探针后，对同一真实 endpoint 发送 `model="Local"`、`stream=true`、`max_tokens=64`、`stop=["OK"]`，并请求 `stream_options.include_usage=true`。HTTP 返回 200，SSE 原始响应包含 8 个 JSON data chunks 与 `[DONE]`；所有 JSON chunk 的 model 均为 `Local`，无 error，最终 `finish_reason=stop` 且 `matched_stop="OK"`。因为 stop 序列在正文边界被命中，assistant content 为空；reasoning_content 片段合计为模型解释。最后一个 JSON chunk 发送 usage：`prompt_tokens=15`、`completion_tokens=11`、`total_tokens=26`、`reasoning_tokens=11`，证明该服务在 streaming stop 路径下会按请求返回 usage 汇总。

请求前后 `/v1/loads` 均为 idle：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative 保持 `accept_length=2.239724631971274`、`accept_rate=0.5`。完整请求、SSE 原文、前后 loads 与解析摘要在 `/tmp/sglang-terra-next164-20261106T011612Z/`。

该探针只证明单一 `Local` 模型真实 HTTP/SSE stop + usage 路径，不关闭 F21 第二 served model/第二端口、有效认证拒绝、wire capture 或默认编辑器窗口人工证据缺口；未运行 editor runner、未启停服务、未改配置或仓库代码、未暂存/提交/推送。


### Terra 真实 Local response_format JSON streaming 探针（2026-11-06 01:22:10 UTC，next165）

在 next164 的 streaming stop + usage 后，对同一真实 endpoint 发送 `model="Local"`、`stream=true`、`stream_options.include_usage=true`、`response_format={"type":"json_object"}`，提示要求只输出 `{"answer":"OK"}`。HTTP 返回 200，响应 `Content-Type: text/event-stream; charset=utf-8`，原始 SSE 25 个 JSON chunks 加 `[DONE]`，所有 chunk 的 model 均为 `Local`，无 error；合并 assistant content 为格式化 JSON `{
  "answer": "OK"
}`，最终 `finish_reason=stop`。最后 usage chunk 为 `prompt_tokens=27`、`completion_tokens=53`、`total_tokens=80`、`reasoning_tokens=41`，证明当前服务真实支持 JSON-object response_format 与 streaming usage 汇总的组合路径。

请求前后 `/v1/loads` 均为 idle：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative 从 `accept_length=2.239724631971274` / `accept_rate=0.5` 变为 `2.239727186797351` / `0.6625`。完整请求、SSE 原文、前后 loads 与解析摘要在 `/tmp/sglang-terra-next165-20261106T012210Z/`。

该探针只证明单一 `Local` 模型真实 HTTP/SSE JSON-object + usage 路径，不关闭 F21 第二 served model/第二端口、有效认证拒绝、wire capture 或默认编辑器窗口人工证据缺口；未运行 editor runner、未启停服务、未改远端配置或仓库代码、未暂存/提交/推送。


### Terra 真实 Local tools/tool_calls streaming 探针（2026-11-06 01:31:00 UTC，next166）

对真实 endpoint `192.168.10.68:8192` 发送 OpenAI-compatible `model="Local"`、`stream=true`、`stream_options.include_usage=true` 的 `tools` 请求，并指定 `tool_choice` 为 `get_weather` 函数。首轮 `max_tokens=64` 返回 HTTP 200，SSE 25 个 JSON chunks、所有 model 均为 `Local`、无 error；产生 `tool_calls` 增量并命中函数名 `get_weather`，arguments 以 `{\"location\": \"Makassar\"` 前缀结束，`finish_reason=length`，usage 为 prompt/completion/total/reasoning=306/64/370/43，证明 token 边界会截断真实工具参数。

同一请求仅将 `max_tokens` 提高到 128 重试，仍 HTTP 200，SSE 26 个 JSON chunks、无 error；tool-call 增量完整拼出 `{"location":"Makassar"}`，最终 `finish_reason=tool_calls`，usage 为 prompt/completion/total/reasoning=306/69/375/41，`prompt_tokens_details.cached_tokens=256`。请求前后 `/v1/loads` 均 idle（running/waiting/active=0、utilization=0）；重试后 speculative 从 `2.239727186797351/0.6625` 变为 `2.239733486323049/0.725`。原始请求、SSE、loads 与解析摘要在 `/tmp/sglang-terra-next166-20261106T013100Z/`。

该探针只证明单一 `Local` 模型真实 HTTP/SSE `tools`、`tool_calls`、参数截断与 usage 路径，不关闭 F21 第二 served model/第二端口、有效认证拒绝、wire capture 或默认编辑器窗口人工视觉证据缺口；未运行 editor runner、未启停服务、未改远端配置或仓库代码、未暂存/提交/推送。

### Terra 当前时刻 Local 非流式接入探针（2026-11-06 当前时刻，next168）

对远端 `192.168.10.68:8192` 做了只读健康与真实请求复核：`/health`、`/v1/models`、`/get_server_info` 均 HTTP 200；`/v1/chat/completions` 使用 `model="Local"`、`temperature=0`、提示 `Reply with exactly OK.`。`max_tokens=32` 首次 HTTP 200，但 `finish_reason=length`、content 为 `\n\nOK`、usage 为 prompt/completion/total/reasoning `15/32/47/30`，记录为 token 上限截断；同请求以 `max_tokens=64` 重试后 HTTP 200、`finish_reason=stop`、content 为 `\n\nOK`、usage 为 `15/33/48/30`。两次响应均为 `application/json`，未见 error。

原始响应与请求证据在 `/tmp/sglang-terra-next168-current/`（`health`、`v1_models`、`get_server_info`、两次 chat body）。本探针只证明当前单一 `Local` served model 的非流式 HTTP 路径与 token 截断/stop 边界；没有声称第二模型/端口、有效认证拒绝、wire capture 或默认编辑器人工视觉已经覆盖。未启停服务、未改远端配置或仓库代码、未暂存/提交/推送。

### Terra 真实 Local 多轮 tool protocol 探针（2026-11-06 01:50:54–01:50:55 UTC，next167b）

在 next166 的真实 `tools/tool_calls` 流式成功基础上，本轮做了明确增量的两轮协议回灌：第一轮对 `model="Local"`、`stream=true`、`include_usage=true`、强制 `get_weather` 发送 HTTP 200，`Content-Type=text/event-stream; charset=utf-8`，26 个 JSON SSE chunks + `[DONE]`，无 error，最终 `finish_reason=tool_calls`；增量 tool-call id 为 `call_6355556f4550439bad2975f1`，完整 arguments 重组为 `{"location": "Makassar"}`，usage 为 `prompt/completion/total/reasoning=306/80/386/52`（cached prompt 256）。

随后将同一 assistant tool-call 与 `role="tool"`、匹配 `tool_call_id` 的天气 JSON 结果回传，再请求最终自然语言单句。第二轮同样 HTTP 200、27 个 JSON SSE chunks + `[DONE]`、无 error，最终 `finish_reason=stop`；合并 assistant content 为 `Makassar is currently 30°C and sunny.`，usage 为 `prompt/completion/total/reasoning=115/56/171/42`。第一轮前、第二轮前及第二轮后 `/v1/loads` 均 HTTP 200 且 idle（`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`）。

完整原始请求、HTTP/SSE body 与 headers、解析摘要和 loads 快照在 `/tmp/sglang-terra-next167b-20261106T015055Z/`。本轮未启动/停止服务、未改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。证据只覆盖单一 Local served model 的多轮 tool-call → `role=tool` → final natural-language HTTP/SSE 协议；F21 第二真实模型/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。

### Terra 真实 Local JSON Schema streaming + usage 探针（2026-11-06 03:24:37 UTC，next169）

为覆盖 next165 已有 `response_format={"type":"json_object"}` 之外的结构化输出边界，本轮对真实 endpoint `http://192.168.10.68:8192/v1/chat/completions` 发送 `model="Local"`、`stream=true`、`stream_options.include_usage=true`、`temperature=0`、`max_tokens=96`，并使用严格 `response_format={"type":"json_schema", "json_schema": {"name":"answer_schema", "strict":true, ...}}`，要求输出 `answer:string` 与 `count:integer` 两个必填字段。HTTP 返回 200，`Content-Type: text/event-stream; charset=utf-8`，原始 SSE 含 40 个 JSON chunks（无 error）及终止 `[DONE]`；合并 assistant content 为 `{"answer":"OK","count":1}` 的格式化 JSON，满足 schema，最终唯一 `finish_reason=stop`。

最后 usage chunk 为 `prompt_tokens=34`、`completion_tokens=94`、`total_tokens=128`、`reasoning_tokens=75`，`prompt_tokens_details=null`。请求前 `/v1/loads` 为 idle（`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative `accept_length=2.2397538804420924`、`accept_rate=0.725`）；请求完成后的 follow-up 仍为 idle，speculative 变为 `accept_length=2.2397609272941588`、`accept_rate=0.7375`。

完整请求、SSE 原文、前后 loads、解析摘要与脚本在 `/tmp/sglang-terra-next169-20261106T032438Z/`：`summary.json`、`chat.sse`、`loads_before.json`、`loads_after.json`、`run.log`、`SHA256SUMS`。本探针只覆盖单一 `Local` served model 的真实 HTTP/SSE JSON Schema + usage 路径；F21 第二真实模型/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local `n=2` 非流式多候选参数探针（2026-11-06 03:35:16–03:35:19 UTC，next170）

在 next169 JSON Schema streaming 后，先对 `http://192.168.10.68:8192/health` 与 `/v1/models` 做只读复核，均 HTTP 200；`/v1/models` 仍只列唯一 served id `Local`。随后发送 OpenAI-compatible 非流式请求 `model="Local"`、`temperature=0`、`max_tokens=64`、`n=2`、提示 `Reply with exactly OK.`。响应 HTTP 200、`content-type=application/json`、`object=chat.completion`，返回两个 `choices`（index 0/1），二者 `finish_reason=stop`、content 均为 `\n\nOK`、`matched_stop=248046`，无 error；usage 汇总为 `prompt_tokens=15`、`completion_tokens=66`、`total_tokens=81`、`reasoning_tokens=60`，与两候选各约 33 completion tokens 一致。这补充了此前单候选非流式与流式/结构化/工具协议之外的 `n` 多候选参数边界。

请求前后 `/v1/loads` 均 HTTP 200 且 idle：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative 保持 `accept_length=2.2397609272941588`、`accept_rate=0.7375`。loads raw SHA 分别为 before `166e50c63a40d128634254ff3187b395502a91a07a752499ce2cdd199be94cd9`、after `8761f3e2ab66e9f4df965559d00e575018108115a873533eb2eaf2106a05deea`；去除动态时间字段后规范化 SHA 分别为 `58d227036a2ab691836680e60db26cfefb2ab5d656f41cd5eb13a51756696e8c`、`09219f3988a615a6f45068b748d37ac3d1309be45e0bece347a1f7ee2ed6a8e3`。chat body raw SHA 为 `d2ba16aa96a803d93cb1b8118d7190f1484c9306f779e7322e518e97483c98dc`，request SHA 为 `c2e489aa61276e1d3c3df87538702145a306da45d5bda48049a343a2eb3f1769`；所有原始请求、响应、headers、loads、summary 与 `SHA256SUMS` 保存在 `/tmp/sglang-terra-next170-20261106T033516Z/`。

本探针只覆盖单一 `Local` served model 的真实 HTTP JSON `n=2` 多候选参数与 usage；HTTP/SSE streaming、JSON Schema、tools/tool_calls 与多轮 tool protocol 已由前序条目覆盖，但 F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local `stream=true,n=2` 多候选协议探针（2026-11-06 03:46:40–03:46:42 UTC，next171）

先对真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads` 做只读复核，三者均 HTTP 200；`/v1/models` 仍只列唯一 served id `Local`。随后发送 OpenAI-compatible 流式多候选请求：`model="Local"`、`stream=true`、`n=2`、`temperature=0`、`max_tokens=64`、`stream_options.include_usage=true`，提示为 `Reply with exactly OK.`。响应 HTTP 200、`content-type=text/event-stream; charset=utf-8`，原始 SSE 解析出 34 个 JSON 事件及终止 `[DONE]`，无 error；choice index 0/1 均收到 assistant role/content `\\n\\nOK`，各自 `finish_reason=stop`。末尾 usage 为 `prompt_tokens=15`、`completion_tokens=66`、`total_tokens=81`、`reasoning_tokens=60`，证明当前服务支持 `stream=true` 与 `n=2` 多候选及 usage 汇总组合。

请求前后 `/v1/loads` 均 HTTP 200 且 idle：`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`gen_throughput=0`、`utilization=0`；speculative `accept_length` 从 `2.2397609272941588` 变为 `2.2397692655617694`，`accept_rate` 从 `0.7375` 变为 `0.7096774193548387`。完整请求体、headers、原始 SSE/响应、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next171-20261106T034640Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP/SSE `n=2` 多候选协议边界；F21 的第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local streaming `logprobs` + usage 探针（2026-11-06 03:52:00–03:52:01 UTC，next172）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送 `model="Local"`、`stream=true`、`temperature=0`、`max_tokens=64`、`logprobs=true`、`top_logprobs=2`、`stream_options.include_usage=true` 的请求，提示为 `Reply with exactly OK.`。响应 HTTP 200、`content-type=text/event-stream; charset=utf-8`，解析出 18 个 JSON 事件和终止 `[DONE]`，无 error；合并 assistant content 为 `\\n\\nOK`，唯一 `finish_reason=stop`。15 个事件包含 logprobs，token entries 含 `token`、UTF-8 `bytes`、主 `logprob` 与最多两个 `top_logprobs` 候选，证明真实 streaming logprobs 与 usage 组合可用。末尾 usage 为 `prompt_tokens=15`、`completion_tokens=33`、`total_tokens=48`、`reasoning_tokens=30`。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（running/waiting/used/active=0、throughput/utilization=0）；speculative `accept_length=2.2397692655617694`、`accept_rate=0.7096774193548387` 在 pair 内保持不变。完整请求、响应 headers/raw SSE、前后 loads、summary 和 SHA256 在 `/tmp/sglang-terra-next172-20261106T035200Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP/SSE `logprobs` + usage 边界；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local JSON-object streaming + `logprobs` 探针（2026-11-06 04:01:13–04:01:14 UTC，next173）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送 `model="Local"`、`stream=true`、`response_format={"type":"json_object"}`、`logprobs=true`、`top_logprobs=2`、`temperature=0`、`max_tokens=96`、`stream_options.include_usage=true` 的组合请求，要求只返回 `answer=OK` JSON。响应 HTTP 200、`content-type=text/event-stream; charset=utf-8`，解析出 18 个 JSON 事件和 `[DONE]`，无 error；合并 content 为格式化 JSON `{"answer":"OK"}`，严格 JSON 解析成功，唯一 `finish_reason=stop`。共收到 34 个 logprob token entries（含 token bytes、主 logprob 与 top-2 候选），末尾 usage 为 `prompt_tokens=22`、`completion_tokens=34`、`total_tokens=56`、`reasoning_tokens=22`。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（running/waiting/used/active=0、throughput/utilization=0）；speculative `accept_length=2.2397692655617694`、`accept_rate=0.7096774193548387` 在 pair 内保持不变。完整 request、headers、raw SSE/response、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next173-20261106T040113Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP/SSE JSON-object + `logprobs` + usage 组合边界；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 非流式 JSON-object + `logprobs` 探针（2026-11-06 04:04:07–04:04:08 UTC，next174）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送非流式组合请求：`stream=false`、`response_format={"type":"json_object"}`、`logprobs=true`、`top_logprobs=2`、`temperature=0`、`max_tokens=96`、`stream_options.include_usage=true`，要求只返回 `answer=OK` JSON。响应 HTTP 200、`content-type=application/json`、`object=chat.completion`，无 error；assistant content 为格式化 JSON `{"answer":"OK"}`，`finish_reason=stop`，严格 JSON 解析成功。响应含 34 个 logprob token entries（token、UTF-8 bytes、主 logprob 与 top-2 候选），usage 为 `prompt_tokens=22`、`completion_tokens=34`、`total_tokens=56`、`reasoning_tokens=22`；该非流式路径接受 `stream_options.include_usage` 并照常返回 usage。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（running/waiting/used/active=0、throughput/utilization=0）；speculative `accept_length=2.2397692655617694`、`accept_rate=0.7096774193548387` 在 pair 内保持不变。完整 request、headers、raw JSON response、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next174-20261106T040407Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 非流式 JSON-object + `logprobs` + usage 组合边界；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local `seed` streaming + usage 探针（2026-11-06 04:06:59–04:07:00 UTC，next175）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送 `model="Local"`、`stream=true`、`temperature=0.7`、`seed=42`、`max_tokens=64`、`stream_options.include_usage=true` 的请求，提示为 `Reply with exactly OK.`。响应 HTTP 200、`content-type=text/event-stream; charset=utf-8`，解析出 16 个 JSON 事件和 `[DONE]`，无 error；合并 assistant content 为 `\\n\\nOK`，唯一 `finish_reason=stop`。末尾 usage 为 `prompt_tokens=15`、`completion_tokens=34`、`total_tokens=49`、`reasoning_tokens=31`，证明当前服务接受 seed 与 streaming usage 组合。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（running/waiting/used/active=0、throughput/utilization=0）；完整 request、headers、raw SSE/response、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next175-20261106T040659Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP/SSE `seed` + usage 边界；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 非流式 `seed` + stop + usage 探针（2026-11-06 04:09:21–04:09:22 UTC，next176）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送非流式 `stream=false`、`temperature=0.7`、`seed=42`、`stop=["OK"]`、`max_tokens=64`、`stream_options.include_usage=true` 的请求，提示为 `Reply with exactly OK.`。响应 HTTP 200、`content-type=application/json`、`object=chat.completion`，无 error；assistant content 为空（stop 序列在正文边界命中），`finish_reason=stop`、`matched_stop="OK"`。usage 为 `prompt_tokens=15`、`completion_tokens=11`、`total_tokens=26`、`reasoning_tokens=11`，记录了 seed + stop 的非流式终止与 usage 组合边界。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（running/waiting/used/active=0、throughput/utilization=0）。完整 request、headers、raw JSON response、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next176-20261106T040921Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 非流式 `seed` + stop + usage 边界；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local JSON Schema + `seed` 非流式探针（2026-11-06 04:12:01–04:12:03 UTC，next177）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。本轮发送非流式 `stream=false`、`response_format.type=json_schema`（strict，要求 `answer:string`、`count:integer`）、`temperature=0.7`、`seed=42`、`stream_options.include_usage=true` 的请求。首发 `max_tokens=96` 返回 HTTP 200、`application/json`、无 error，但因 reasoning 消耗达到上限，content 为空、`finish_reason=length`，usage `23/96/119/96`，记录为预算边界。随后仅将 `max_tokens` 提高到 192 重试，HTTP 200、`object=chat.completion`，content 为 `{"answer":"OK","count":1}`，严格 schema 解析成功，`finish_reason=stop`，usage `prompt/completion/total/reasoning=23/90/113/71`，无 error。

首发与重试各自前后 `/v1/loads` 均 HTTP 200 且 idle。完整首发/重试 request、headers、raw JSON response、loads、summary 与 SHA256 在 `/tmp/sglang-terra-next177-20261106T041201Z/`（含 `retry-summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 非流式 JSON Schema + `seed` + usage 与 token-budget 边界；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local JSON Schema + stop 边界探针（2026-11-06 04:15:50–04:15:51 UTC，next178）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送非流式 strict `response_format.type=json_schema`（要求 `answer:string`、`count:integer`）、`temperature=0.7`、`seed=42`、`stop=["OK"]`、`max_tokens=192`、`stream_options.include_usage=true` 请求。响应 HTTP 200、`application/json`、无 error；stop 序列在 JSON 字符串值 `OK` 处命中，assistant content 为空，`finish_reason=stop`、`matched_stop="OK"`，因此没有形成可解析 JSON；usage 为 `prompt_tokens=23`、`completion_tokens=15`、`total_tokens=38`、`reasoning_tokens=17`。该结果记录了 stop 优先于 schema 完整输出的边界。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（running/waiting/used/active=0、throughput/utilization=0）。完整 request、headers、raw JSON response、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next178-20261106T041550Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 非流式 JSON Schema + `seed` + `stop` + usage 终止边界；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local JSON Schema `n=2` + `seed` 探针（2026-11-06 04:18:28–04:18:30 UTC，next179）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送非流式 `stream=false`、`n=2`、`temperature=0.7`、`seed=42`、`max_tokens=192`、strict `response_format.type=json_schema`（要求 `answer:string`、`count:integer`）、`stream_options.include_usage=true` 请求。响应 HTTP 200、`application/json`、无 error；两个 choices 均返回 `{"answer":"OK","count":1}`，严格 JSON Schema 解析成功，均 `finish_reason=stop`。usage 汇总为 `prompt_tokens=23`、`completion_tokens=157`、`total_tokens=180`、`reasoning_tokens=119`。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（running/waiting/used/active=0、throughput/utilization=0）。完整 request、headers、raw JSON response、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next179-20261106T041828Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 非流式 strict JSON Schema + `seed` + `n=2` 多候选 + usage 边界；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 非流式 `tool_choice` + `parallel_tool_calls=false` + usage 探针（2026-11-06 04:24:53–04:24:55 UTC，next180）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送非流式 `stream=false`、显式 `tool_choice` 指定 `get_weather`、`parallel_tool_calls=false`、`temperature=0`、`max_tokens=128`、`stream_options.include_usage=true` 的 OpenAI-compatible 工具请求。响应 HTTP 200、`application/json`、无 error；返回单个 choice，`finish_reason=tool_calls`，assistant content 为空，工具名为 `get_weather`，arguments 完整解析为 `{"location":"Makassar"}`。usage 为 `prompt_tokens=296`、`completion_tokens=60`、`total_tokens=356`、`reasoning_tokens=32`。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`utilization=0`）。完整 request、response headers、raw JSON response、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next180-20261106T042453Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 非流式显式工具选择、禁止并行工具调用与 usage 组合路径；不证明工具执行器或生产 AgentLoop 已接通，F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 流式 tool-call + `parallel_tool_calls=true` + usage 探针（2026-11-06 04:39:26–04:39:27 UTC，next181）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送 OpenAI-compatible `stream=true`、显式 `tool_choice` 指定 `get_weather`、`parallel_tool_calls=true`、`stream_options.include_usage=true` 的工具请求。响应 HTTP 200、`text/event-stream`，22 个 JSON SSE 事件并以 `[DONE]` 结束，无 error；合并 tool-call 增量得到函数名 `get_weather` 与完整 arguments `{"location":"Makassar"}`，`finish_reason=tool_calls`。usage 为 `prompt_tokens=296`、`completion_tokens=60`、`total_tokens=356`、`reasoning_tokens=32`（cached prompt 256）。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`utilization=0`）。完整 request、response headers、原始 SSE、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next181-20261106T043926Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 流式工具调用、允许并行工具调用标志与 usage 组合路径；不证明工具执行器或生产 AgentLoop 已接通，F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 流式双工具 `tool_choice=auto` + `parallel_tool_calls=true` 探针（2026-11-06 04:46:57–04:46:59 UTC，next182）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送 OpenAI-compatible `stream=true`、两个函数工具 `get_weather` 与 `get_time`、`tool_choice=auto`、`parallel_tool_calls=true`、`stream_options.include_usage=true` 的请求，提示要求同时调用两个工具。响应 HTTP 200、`text/event-stream`，28 个 JSON SSE 事件并以 `[DONE]` 结束，无 error；合并得到两个 tool-call（`get_weather({"location":"Makassar"})`、`get_time({"location":"Makassar"})`），`finish_reason=tool_calls`。usage 为 `prompt_tokens=373`、`completion_tokens=96`、`total_tokens=469`、`reasoning_tokens=39`。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`utilization=0`）。完整 request、response headers、原始 SSE、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next182-20261106T044657Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 流式双工具自动选择、并行工具调用与 usage 组合路径；不证明工具执行器或生产 AgentLoop 已接通，F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 非流式双工具 `tool_choice=auto` + `parallel_tool_calls=true` 探针（2026-11-06 04:55:54–04:55:56 UTC，next183）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后发送非流式 `stream=false`、两个函数工具 `get_weather` 与 `get_time`、`tool_choice=auto`、`parallel_tool_calls=true`、`stream_options.include_usage=true` 的请求，提示要求同时调用两个工具。响应 HTTP 200、`application/json`、单个 choice、无 error；两个 tool-call 均完整解析为 `get_weather({"location":"Makassar"})` 与 `get_time({"location":"Makassar"})`，`finish_reason=tool_calls`。usage 为 `prompt_tokens=373`、`completion_tokens=95`、`total_tokens=468`、`reasoning_tokens=38`（cached prompt 64）。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`utilization=0`）。完整 request、response headers、raw JSON response、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next183-20261106T045554Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 非流式双工具自动选择、并行工具调用与 usage 组合路径，并与 next182 流式路径得到同样的两个函数和参数；不证明工具执行器或生产 AgentLoop 已接通，F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 工具调用回灌后非流式自然语言收束探针（2026-11-06 05:00:35–05:00:37 UTC，next184）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后把上一轮双工具 assistant `tool_calls`（`get_weather`、`get_time`）及两个 `role=tool` 结果按 OpenAI-compatible 消息协议回灌，发送非流式 `stream=false`、`stream_options.include_usage=true` 请求。响应 HTTP 200、`application/json`、单个 choice、无 error；`finish_reason=stop`，assistant content 为 `In Makassar, it's 12:34 PM and sunny with a temperature of 30°C.`，完成从工具调用到自然语言收束。usage 为 `prompt_tokens=134`、`completion_tokens=44`、`total_tokens=178`、`reasoning_tokens=19`。

请求前后 `/v1/loads` 均 HTTP 200 且 idle；完整 request、response headers、raw JSON response、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next184-20261106T050035Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实工具调用消息回灌与非流式最终文本收束，不证明生产工具执行器、自主路由或完整 AgentLoop；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 流式工具回灌 + 最终文本收束探针（2026-11-06 05:05:26–05:05:28 UTC，next185）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后把双工具 assistant `tool_calls` 与两个 `role=tool` 结果回灌到真实 `Local`，发送 `stream=true`、`stream_options.include_usage=true` 请求。响应 HTTP 200、`text/event-stream`，21 个 JSON SSE 事件并以 `[DONE]` 结束，无 error；合并文本为 `In Makassar, it's currently 12:34 with sunny skies and a temperature of 30°C.`，`finish_reason=stop`。usage 为 `prompt_tokens=130`、`completion_tokens=43`、`total_tokens=173`、`reasoning_tokens=17`。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`utilization=0`）。完整 request、response headers、原始 SSE、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next185-20261106T050525Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的流式工具调用消息回灌与最终自然语言收束，并与 next184 非流式回灌路径形成互补；不证明生产工具执行器或完整 AgentLoop 已接通，F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 工具回灌缺失结果 + `response_format=json_object` 边界探针（2026-11-06 05:12:00–05:14:35 UTC，next186）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后回灌包含两个 assistant `tool_calls`、但只提供第一个 `role=tool` 结果的消息，并组合 `stream=true`、`response_format={"type":"json_object"}`、`stream_options.include_usage=true`，用于观察缺失第二个工具结果时的真实收束行为。初始 `max_tokens=128` HTTP 200、`text/event-stream`，62 个 JSON SSE 事件 + `[DONE]`，`finish_reason=length`，usage `prompt/completion/total/reasoning=111/128/239/128`；将预算提高到 256 后仍 HTTP 200、119 个事件、`finish_reason=length`，模型输出已开始 JSON 但在说明缺失 `get_time` 结果处截断，usage `111/256/367/198`。最终受控重试 `max_tokens=512` HTTP 200、`text/event-stream`，124 个 JSON SSE 事件 + `[DONE]`，`finish_reason=stop`，输出合法 JSON `{"location":"Makassar","weather":{"temperature_c":30,"condition":"sunny"}}`，明确省略缺失的时间字段，usage `111/276/387/234`，无 error。

各次请求前后 `/v1/loads` 均 HTTP 200 且 idle；最终 loads 仍 `num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`utilization=0`。完整初始/重试 request、response headers、原始 SSE、loads、summary 与 SHA256 在 `/tmp/sglang-terra-next186-20261106T051200Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 在缺失一个 `role=tool` 结果并组合 JSON object 输出约束时的真实流式边界；结果表明服务返回 HTTP 200，并在足够预算下以合法 JSON 收束但省略缺失字段，不证明客户端应把缺失工具结果视为成功，也不证明生产工具执行器或完整 AgentLoop；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 双工具回灌 + strict `response_format=json_schema` 非流式探针（2026-11-06 05:22:21–05:22:23 UTC，next187）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后回灌两个 assistant `tool_calls` 与两个 `role=tool` 结果，发送非流式 `stream=false`、`response_format.type=json_schema`（strict schema 要求 `location`、`weather.temperature_c`、`weather.condition`、`time`）、`stream_options.include_usage=true` 请求。响应 HTTP 200、`application/json`、无 error，`finish_reason=stop`；返回 JSON 严格解析成功：`{"location":"Makassar","weather":{"temperature_c":30,"condition":"sunny"},"time":"12:34 WITA"}`。usage 为 `prompt_tokens=131`、`completion_tokens=70`、`total_tokens=201`、`reasoning_tokens=14`（cached prompt 64）。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`utilization=0`）。完整 request、response headers/raw response、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next187-20261106T052221Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 双工具消息回灌、strict JSON Schema 与 usage 组合路径；不证明工具执行器或完整生产 AgentLoop，F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 双工具回灌 + strict `response_format=json_schema` 流式探针（2026-11-06 05:27:19–05:27:21 UTC，next188）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后回灌两个 assistant `tool_calls` 与两个 `role=tool` 结果，发送流式 `stream=true`、strict `response_format.type=json_schema`（要求 `location`、`weather.temperature_c`、`weather.condition`、`time`）、`stream_options.include_usage=true` 请求。响应 HTTP 200、`text/event-stream`，31 个 JSON SSE 事件 + `[DONE]`，无 error；合并内容严格 JSON 解析成功：`{"location":"Makassar","weather":{"temperature_c":30,"condition":"sunny"},"time":"12:34 WITA"}`，`finish_reason=stop`。usage 为 `prompt_tokens=131`、`completion_tokens=67`、`total_tokens=198`、`reasoning_tokens=11`（cached prompt 128）。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`utilization=0`）。完整 request、response headers、原始 SSE、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next188-20261106T052719Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP 双工具消息回灌、strict JSON Schema 流式输出与 usage 组合路径；不证明工具执行器或完整生产 AgentLoop，F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local strict JSON Schema + `seed`/temperature 流式探针（2026-11-06 05:32:47–05:32:49 UTC，next189）

先复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`，均 HTTP 200；served id 仍唯一为 `Local`。随后在 next188 的双工具消息回灌基础上，发送流式 `stream=true`、`temperature=0.7`、`seed=42`、`response_format.type=json_schema`（strict schema 要求 `location`、`weather.temperature_c`、`weather.condition`、`time`）、`stream_options.include_usage=true` 请求。响应 HTTP 200、`text/event-stream`，35 个 JSON SSE 事件 + `[DONE]`，无 error；合并内容严格 JSON 解析成功：`{"location":"Makassar","weather":{"temperature_c":30,"condition":"sunny"},"time":"12:34 WITA"}`，`finish_reason=stop`。usage 为 `prompt_tokens=131`、`completion_tokens=72`、`total_tokens=203`、`reasoning_tokens=16`（cached prompt 128）。

请求前后 `/v1/loads` 均 HTTP 200 且 idle（`num_running_reqs=0`、`num_waiting_reqs=0`、`num_used_tokens=0`、`num_active_tokens=0`、`utilization=0`）。完整 request、response headers、原始 SSE、前后 loads、summary 与 SHA256 在 `/tmp/sglang-terra-next189-20261106T053247Z/`（`summary.json`、`SHA256SUMS`）。

本探针只覆盖单一 `Local` served model 的真实 HTTP strict JSON Schema、seed/temperature、双工具消息回灌与流式 usage 组合路径；不证明工具执行器或完整生产 AgentLoop，F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture 与默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。


### Terra 真实 Local strict JSON Schema + `n=2` + tool replay 非流式探针（2026-11-07 13:32:41–13:35:37 UTC，next190）

本轮选择与 next189 不重复的组合边界：把两个 assistant `tool_calls` 与两个 `role=tool` 结果回灌到 `Local`，并同时请求非流式 `stream=false`、严格 `response_format.type=json_schema`、`n=2`、`seed=190`、`stream_options.include_usage=true`。请求体固定 `model=Local`，schema 要求 `location`、`weather.temperature_c`、`weather.condition`、`time`，未改服务、配置或产品代码。

真实探针先后访问 `/health`、`/v1/models`、`/v1/loads`，再访问 `/v1/chat/completions`，并再次访问 `/v1/loads`。本轮 endpoint 在探针时段不可用：五次请求均经当前网络路径返回 HTTP 502、空响应体（`Connection: close`、`Content-Length: 0`）；直连 `192.168.10.68:8192` 同时得到 TCP connection refused。因而本轮没有可声称的 HTTP 模型兼容性通过，也没有 loads idle 快照（前后 loads 请求本身失败）；不能把 502/拒绝连接解释成 JSON Schema、`n=2` 或 tool replay 的服务语义结果。

完整失败请求/响应与 headers、前后 loads 原始文件、summary、SHA256 在 `/tmp/sglang-terra-next190-20261107T133241Z/`：`chat-request.json`、`request-headers.json`、`health.json`、`models.json`、`loads-before.json`、`loads-after.json`、对应 `*-headers.json`、`chat.json`、`summary.json`、`SHA256SUMS`。`summary.json` 记录 `health_status=models_status=loads_before_status=chat_status=loads_after_status=502`、`served_model_ids=[]`、`choice_count=0`；`SHA256SUMS` 自校验通过。13:35:37 UTC 追加健康复核仍为 HTTP 502，ICMP 可达但 TCP 8192 被拒绝；该直连与复核的 verbose 日志/headers/body 也保存在同一目录并纳入 SHA256SUMS。

本轮仅证明指定 endpoint 在该时段的可达性失败，未形成 Local 的 strict JSON Schema + `n=2` + tool replay 兼容性结论；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local strict JSON Schema + `n=2` + tool replay 流式探针（2026-11-07 14:35:00 UTC，next191）

本轮选择与 next189/190 互补的流式组合边界：把两个 assistant `tool_calls` 与两个 `role=tool` 结果回灌到 `Local`，并请求 `stream=true`、严格 `response_format.type=json_schema`、`n=2`、`seed=191`、`stream_options.include_usage=true`（`max_tokens=384`）。请求体固定 `model=Local`，schema 要求 `location`、`weather.temperature_c`、`weather.condition`、`time`，未改服务、配置或产品代码。

探针先后访问 `/health`、`/v1/models`、`/v1/loads`、`/v1/chat/completions`、`/v1/loads`，以及一次 `/health` 复核；六次请求均在当前网络路径 TCP connection refused，curl status 为 0、空响应体、无响应 headers。`--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 也均为 curl returncode 7 / HTTP 000（connection refused）。因此没有 served model、loads 快照、SSE 事件、choices、usage 或 schema 解析结果；不能把本轮失败解释成 JSON Schema、`n=2`、streaming 或 tool replay 的模型语义结果。

完整请求、响应体/headers、loads 前后文件、直连与复核日志、summary、脚本和 SHA256 在 `/tmp/sglang-terra-next191-20261107T143500Z/`；`SHA256SUMS` 自校验通过。`summary.json` 明确记录 `health_status=models_status=loads_before_status=chat_status=loads_after_status=proxy-health-recheck=0`、`served_model_ids=[]`、`choice_count=0` 与直连 TCP 拒绝证据。

本轮仅证明指定 endpoint 在该时段不可达，未形成 Local 的 strict JSON Schema + `n=2` + tool replay 流式兼容性结论；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 可达性复核（2026-11-07 16:03:11 UTC，next192）

本轮按先健康检查的顺序只读复核真实 endpoint `http://192.168.10.68:8192` 的 `/health`、`/v1/models`、`/v1/loads`。三次当前网络路径请求均为 curl returncode 7 / HTTP status 0，stderr 为 `Failed to connect to 192.168.10.68 port 8192: 连接被拒绝`，空响应体且无响应 headers；因此没有发出 chat completion 请求。随后 `--noproxy '*'` 的三个直连检查也全部 returncode 7 / HTTP 000，另做一次代理 `/health` 复核同样被拒绝。

完整失败证据在 `/tmp/sglang-terra-next192-20261107T160311Z/`：健康、模型、负载的原始 body/headers、规范化 `*-headers.json`、curl stderr、直连检查与复核、`run.log`、`probe.py`、`summary.json` 和 `SHA256SUMS`。`summary.json` 记录初始 `health/models/loads-before=0`、直连与复核均为 0、`all_initial_ready=false`、未发 chat；`sha256sum -c SHA256SUMS` 全部通过。

本轮仅证明指定 endpoint 在该时段不可达；没有 served model、loads 快照、choices、usage、SSE 或 schema 解析结果，不能把连接拒绝解释成 JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败。因未满足初始可达性门槛，原计划的非流式/流式 strict JSON Schema + `n=2` + 双工具回灌互补探针顺延。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 可达性复核（2026-11-07 16:11:29 UTC，next193）

在 next190–192 连续不可达后，本轮再次按 health → models → loads 顺序只读复核真实 endpoint `http://192.168.10.68:8192`。当前网络路径的 `/health`、`/v1/models`、`/v1/loads` 均 curl returncode 7 / HTTP status 000，stderr 为 `Failed to connect to 192.168.10.68 port 8192: 连接被拒绝`，空响应体且无响应 headers；`--noproxy '*'` 的三个直连检查也均 returncode 7 / HTTP 000，随后代理路径 `/health` 复核仍被拒绝。

初始 health/models/loads 门槛未满足，因此没有发送预置的互补边界请求（非流式 `strict response_format.type=json_schema` + `n=2` + 双 assistant `tool_calls`/双 `role=tool` 回灌，`seed=193`），`chat_attempted=false`；没有 served model、loads 快照、choices、usage、SSE 或 schema 解析结果。完整 `chat-request.json`（计划请求）、空响应 body/headers、各端点 headers/stderr/meta、直连与复核日志、`probe.py`、`summary.json` 和 `SHA256SUMS` 在 `/tmp/sglang-terra-next193-20261107T161105Z/`；`sha256sum -c SHA256SUMS` 全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 可达性复核（2026-11-07 16:29:21 UTC，next194）

在 next190–193 连续不可达后，本轮再次按 health → models → loads 顺序只读复核真实 endpoint `http://192.168.10.68:8192`。当前网络路径的 `/health`、`/v1/models`、`/v1/loads` 均 curl returncode 7 / HTTP status 000，stderr 为 `Failed to connect to 192.168.10.68 port 8192: 连接被拒绝`，空响应体且无响应 headers；`--noproxy *` 的三个直连检查及随后代理路径 `/health` 复核也均 returncode 7 / HTTP 000。

初始 health/models/loads 门槛未满足，因此没有发送预置的非流式 strict `response_format.type=json_schema` + `n=2` + 双工具回灌请求（`seed=194`，`chat_attempted=false`）；没有 served model、loads 快照、choices、usage、SSE 或 schema 解析结果。完整 `chat-request.json`（计划请求）、空响应 body/headers、各端点 headers/stderr/meta、直连与复核日志、`probe.py`、`summary.json` 和 `SHA256SUMS` 在 `/tmp/sglang-terra-next194-20261108T000000Z/`；`sha256sum -c SHA256SUMS` 已全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 可达性复核（2026-11-07 16:47:00 UTC，next195）

在 next190–194 连续不可达后，本轮再次按 health → models → loads 顺序只读复核真实 endpoint `http://192.168.10.68:8192`。当前网络路径与 `--noproxy '*'` 直连的 `/health`、`/v1/models`、`/v1/loads` 均 curl returncode 7 / HTTP status 000，空响应体且无响应 headers，TCP 8192 连接被拒绝；随后代理 `/health` 复核同样失败。

初始 health/models/loads 门槛未满足，因此没有发送预置的非流式 strict `response_format.type=json_schema` + `n=2` + 双工具回灌请求（`seed=195`，`chat_attempted=false`）；没有 served model、loads 快照、choices、usage、SSE 或 schema 解析结果。完整请求计划、空响应 body/headers、各端点 headers/stderr/meta、直连与复核日志、`probe.py`、`summary.json` 和 `SHA256SUMS` 在 `/tmp/sglang-terra-next195-20261107T164700Z/`；`sha256sum -c SHA256SUMS` 已全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 可达性复核（2026-11-07 16:58:31 UTC，next196）

在 next190–195 连续不可达后，本轮再次按 health → models → loads 顺序只读复核真实 endpoint `http://192.168.10.68:8192`。当前网络路径与 `--noproxy '*'` 直连的 `/health`、`/v1/models`、`/v1/loads` 均返回 curl status `000` / returncode `7`，空响应体且无响应 headers；TCP 8192 连接被拒绝；随后代理与直连 `/health` 复核同样失败。

初始 health/models/loads 门槛未满足，因此没有发送下一条真实 `Local` chat completion（`chat_attempted=false`）；没有 served model、loads 快照、choices、usage、SSE 或 schema 解析结果。本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败。

完整 availability-only 证据、代理/直连 headers、body、stderr、TCP 日志、`summary.json`、`probe.py` 和 `SHA256SUMS` 在 `/tmp/sglang-terra-next196-20261107T165831Z/`；`sha256sum -c SHA256SUMS` 已全部通过。F21 第二真实模型/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 可达性复核（2026-11-07 17:07:51 UTC，next197）

在 next190–196 连续不可达后，本轮按 health → models → loads 顺序只读复核真实 endpoint `http://192.168.10.68:8192`。当前网络路径与 `--noproxy '*'` 直连的 `/health`、`/v1/models`、`/v1/loads` 均返回 curl status `000` / returncode `7`，空响应体且无响应 headers；stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`。随后代理 `/health` 复核同样失败。

初始 health/models/loads 门槛未满足，因此没有发送下一条互补真实 `Local` chat completion（`chat_attempted=false`、`chat_request_sent=false`）；没有 served model、loads 快照、choices、usage、SSE 或 schema 解析结果。完整 request JSON、空 response body、headers/stderr、summary、`probe.py` 和 `SHA256SUMS` 在 `/tmp/sglang-terra-next197-20261107T170751Z/`；在该目录执行 `sha256sum -c SHA256SUMS` 全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra 真实 Local 可达性复核（2026-11-07 17:13:26 UTC，next198）

在 next190–197 连续不可达后，本轮再次按 health → models → loads 顺序只读复核真实 endpoint `http://192.168.10.68:8192`。当前网络路径与 `--noproxy '*'` 直连的 `/health`、`/v1/models`、`/v1/loads` 均返回 curl status `000` / returncode `7`，空响应体且无响应 headers；stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`。随后代理 `/health` 复核同样失败。

初始 health/models/loads 门槛未满足，因此没有发送下一条互补真实 `Local` chat completion（`chat_attempted=false`、`chat_request_sent=false`）；没有 served model、loads 快照、choices、usage、SSE 或 schema 解析结果。完整 request JSON、空 response body、headers/stderr、summary、`probe.py` 和 `SHA256SUMS` 在 `/tmp/sglang-terra-next198-20261107T171326Z/`；在该目录执行 `sha256sum -c SHA256SUMS` 全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。
### Terra 真实 Local 可达性复核（2026-11-07 17:16:37 UTC，next199）

在 next190–198 连续不可达后，本轮再次按 health → models → loads 顺序只读复核真实 endpoint `http://192.168.10.68:8192`。当前网络路径与 `--noproxy '*'` 直连的 `/health`、`/v1/models`、`/v1/loads` 均返回 curl status `000` / returncode `7`，空响应体且无响应 headers；stderr 为 `Failed to connect to 192.168.10.68 port 8192: 连接被拒绝`。随后代理 `/health` 复核同样失败。

初始 health/models/loads 门槛未满足，因此没有发送下一条互补真实 `Local` chat completion（`chat_attempted=false`、`chat_request_sent=false`）；没有 served model、loads 快照、choices、usage、SSE 或 schema 解析结果。完整 request JSON、空 response body、headers/stderr、summary、`probe.py` 和 `SHA256SUMS` 在 `/tmp/sglang-terra-next199-20261107T171637Z/`；在该目录执行 `sha256sum -c SHA256SUMS` 全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 17:34:10 UTC，next200c）

在 next190–199 连续不可达后，本轮按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：当前网络路径的 `/health`、`/v1/models`、`/v1/loads` 与 `--noproxy '*'` 的对应三个端点均 curl status `000` / returncode `7`，stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`，body/response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError`。随后 current `/health` recheck 仍 status `000` / returncode `7`。

availability gate 未通过，因此没有发送真实 `model=Local` chat（`chat_attempted=false`、`chat_request_sent` 未发生）；没有 served model、loads、choices、usage、SSE 或模型语义结论。完整 availability-only 请求计划、每个端点 response body/headers/stderr/status/meta、TCP JSON、health recheck、`summary.json`、`probe.py`、`run.log` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next200c-20261107T173410Z/`；目录内执行 `sha256sum -c SHA256SUMS` 全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉仍未覆盖。未启动/停止服务、未修改远端配置或仓库代码、未运行 editor runner、未暂存/提交/推送。


### Terra SGLang availability gate（2026-11-07 17:38:03 UTC，next200d）

在 next200c 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：当前网络路径的 `/health`、`/v1/models`、`/v1/loads` 与 `--noproxy '*'` 的对应三个端点均 status `000` / curl returncode `7`，stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`，body/response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError`。随后 current `/health` recheck 仍 status `000` / returncode `7`。

availability gate 未通过，因此没有发送真实 `model=Local` chat（`chat_attempted=false`、`chat_request_sent` 未发生）；没有 served model、loads、choices、usage、SSE 或模型语义结论。完整 availability-only 请求计划、每个端点 response body/headers/stderr/status/meta、TCP JSON、health recheck、`summary.json`、`probe.py`、`run.log` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next200d-20261107T173803Z/`；目录内执行 `sha256sum -c SHA256SUMS` 全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败；F21 第二真实 served model/第二端口、认证拒绝、独立 wire capture、默认窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 17:47:51 UTC，next201）

在 next200d 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：当前网络路径与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 均返回 curl status `000` / returncode `7`，stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`，body/response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError`。随后 current `/health` recheck 仍 status `000` / returncode `7`。

availability gate 未通过，因此没有发送真实 `model=Local` chat（`chat_attempted=false`、`chat_request_sent` 未发生）；没有 served model、loads、choices、usage、SSE 或模型语义结论。完整 availability-only 请求计划、每个端点 response body/headers/stderr/status/meta、TCP JSON、health recheck、`summary.json`、`probe.py`、`run.log` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next201-20261107T174751Z/`；目录内 `sha256sum -c SHA256SUMS` 全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、JSON Schema、`n=2`、streaming、tool replay 或其他模型语义失败；F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 17:55:25 UTC，next202）

本轮继续按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`。当前网络路径与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均 curl status `000` / returncode `7`，stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`，body/response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError`。随后 current `/health` recheck 仍 status `000` / returncode `7`。

availability gate 未通过，因此没有发送真实 chat（`chat_attempted=false`、`served_model_ids=[]`）；没有 served model、loads、choices、usage、SSE 或模型语义结论。完整 availability-only 证据、请求计划、代理/直连 body/headers/stderr/status/meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next202-20261107T175322Z/`；目录内 `sha256sum -c SHA256SUMS` 34 项全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat 或其他模型语义失败；F21 第二真实 served model/第二端口、认证拒绝、独立 wire capture、默认窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 18:00:31 UTC，next203）

本轮继续按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：当前网络路径与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均 curl status `000` / returncode `7`，stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`，body/response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError`。随后 current `/health` recheck 仍 status `000` / returncode `7`。

availability gate 未通过，因此没有读取 served model，也没有发送预置的最小非流式或流式真实 chat（`chat_attempted=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage 或模型语义结论。完整 availability-only 证据、计划请求、current/直连 body、headers、stderr、status/meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next203-20261107T175951Z/`；目录内 `sha256sum -c SHA256SUMS` 全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、认证拒绝、独立 wire capture、默认窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 18:09:30 UTC，next204）

在 next203 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：当前网络路径与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均返回 curl status `000` / returncode `7`，stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`，空响应体且无响应 headers；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError`。随后 current `/health` recheck 仍 status `000` / returncode `7`。

availability gate 未通过，因此没有读取 served model，也没有发送最小真实 non-stream 或 stream chat（`chat_attempted=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、计划请求、current/直连 body、headers、stderr、status/meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next204-20261107T180917Z/`；目录内 `sha256sum -c SHA256SUMS` 全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 19:51:54 UTC，next220）

在 next219 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next220-20261107T195154Z/`；`summary.json` SHA256 为 `caaae419e96e3763bb01034d9d8d421faa0b89204459d17d654215bff140e76c`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `e3d134a4ee6a94b989ad4a98de60bb4f84f5041907e9091a47dca4c08b218808`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 19:35:25 UTC，next216）

在 next215 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`。随后 current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next216-20261107T193525Z/`；`summary.json` SHA256 为 `57a9aa9bcd7a3981f8bae6c91df2acfb4b7594e211723cc5dde688b7eb254b57`，目录内 `sha256sum -c SHA256SUMS` 的 24 个列项全部通过，`SHA256SUMS` SHA256 为 `b4650c520a2e969d20fb98b759fc6173f8c047c9ee6e41f2d032a97163464dac`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 19:31:00 UTC，next215）

在 next214 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`。随后 current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送最小真实 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next215-20261107T193100Z/`；`summary.json` SHA256 为 `077f4f26c46059b2cf10087399457a5d0888d8dd1497344ada4d52bbd89b1a1f`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `858a017f7d20695685291ed2947eb9bb1e11e32b2cf558c016b54e37154548af`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 19:27:38 UTC，next214）

在 next213 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`。随后 current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next214-20261107T192738Z/`；`summary.json` SHA256 为 `b220f1bda25d0c37cd06c86c8ad9a965735b212da219427624350f82e032f45c`，目录内 `sha256sum -c SHA256SUMS` 的 25 个列项全部通过，`SHA256SUMS` SHA256 为 `6946b26fd00f1ea2d8042a35244d1da8def3064015249c11a76903a3d35a5f65`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 19:16:06 UTC，next212）

在 next211 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: [Errno 111] Connection refused`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、current/`--noproxy` body、headers、meta、TCP JSON、health recheck、probe、run log、summary 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next212-20261107T191606Z/`；`summary.json` SHA256 为 `df8a95c9af0e281c715e755d025a06fcaa9eb16a238705b5d98bed89e66f4486`，目录内 `sha256sum -c SHA256SUMS` 的 26 个列项全部通过，`SHA256SUMS` SHA256 为 `23eb927fb1f66445c16de6b8928a47aff85950e1efbf3778543c98b593ec5c59`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 19:10:03 UTC，next211）

在 next210 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError(<urlopen error [Errno 111] Connection refused>)`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError([Errno 111] Connection refused)`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送最小真实 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、current/`--noproxy` body、headers、meta、TCP JSON、health recheck、run log、summary 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next211-20261107T191003Z/`；`summary.json` SHA256 为 `46ca44aa30c3fe042d7b4592b883558ce378206eb1a6e9a2290949c809a6594c`，目录内 `sha256sum -c SHA256SUMS` 的 25 个列项全部通过，`SHA256SUMS` SHA256 为 `bdfc2607bbb08c38074c7e8a370deebdd4dfee1bf26f162b9f987db5a2b99335`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 18:58:47 UTC，next210）

在 next209 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError(ConnectionRefusedError(111, 'Connection refused'))`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError(111, 'Connection refused')`。随后 current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送最小真实 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、current/`--noproxy` body、headers、meta、TCP JSON、health recheck、summary 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next210-20261107T185847Z/`；`summary.json` SHA256 为 `017af4c004392ff487d330010b4c95deb7e6e77e07380a45c9c34928e14f35d1`，在该目录执行 `sha256sum -c SHA256SUMS` 的 21 个列项全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 18:36:08 UTC，next207）

在 next206 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：当前网络路径与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 均返回 curl status `000` / returncode `7`，stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`，空响应体且无响应 headers；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError`。随后 current `/health` recheck 仍 status `000` / returncode `7`。

availability gate 未通过，因此没有读取 served model，也没有发送最小真实 non-stream 或 stream chat（`chat_attempted=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、计划请求、current/直连 body、headers、stderr、status/meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next207-20261107T183550Z/`；目录内 `sha256sum -c SHA256SUMS` 的 34 项全部通过（`SHA256SUMS` SHA256 `cc2d917b1f0a6d466709cfc66cf99cf393b32c000a6d39d01c13e803c65046fc`）。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。


### Terra SGLang availability gate（2026-11-07 18:17:16 UTC，next205）

在 next204 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：当前网络路径与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 均返回 curl status `000` / returncode `7`，stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`，空响应体且无响应 headers；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError`。随后 current `/health` recheck 仍 status `000` / returncode `7`。

availability gate 未通过，因此没有读取 served model，也没有发送最小真实 non-stream 或 stream chat（`chat_attempted=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、计划请求、current/直连 body、headers、stderr、status/meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next205-20261107T181707Z/`；目录内 `sha256sum -c SHA256SUMS` 的 34 项全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 18:22:00 UTC，next206）

在 next205 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：当前网络路径与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 均返回 curl status `000` / returncode `7`，stderr 为 `Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`，空响应体且无响应 headers；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError`。随后 current `/health` recheck 仍 status `000` / returncode `7`。

availability gate 未通过，因此没有读取 served model，也没有发送最小真实 non-stream 或 stream chat（`chat_attempted=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、计划请求、current/直连 body、headers、stderr、status/meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next206-20261107T182151Z/`；目录内 `sha256sum -c SHA256SUMS` 的 34 项全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。
### Terra SGLang availability gate（2026-11-07 18:45:04 UTC，next208）

在 next207 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：当前网络路径与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 均返回 curl status `000` / returncode `7`，stderr 为 `curl: (7) Failed to connect to 192.168.10.68 port 8192 after 0 ms: 连接被拒绝`，空响应体且无响应 headers；TCP 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`。随后 current `/health` recheck 仍 status `000` / returncode `7`。

availability gate 未通过，因此没有读取 served model，也没有发送最小真实 non-stream 或 stream chat（`chat_attempted=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、current/`--noproxy` 的 body、headers、stderr、status/meta、TCP JSON、health recheck、summary 与 SHA256 在 `/tmp/sglang-terra-next208-20261107T184354Z/`；目录内执行 `sha256sum -c SHA256SUMS` 的 16 项全部通过，`SHA256SUMS` SHA256 为 `50d433cf9b1bc9089e6864f62e249b040dff327a89569224cc17ae3d0315c9d2`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 18:51:19 UTC，next209）

在 next208 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`。随后 current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送最小真实 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、current/`--noproxy` body、headers、meta、TCP JSON、health recheck、summary 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next209-20261107T185119Z/`；`summary.json` SHA256 为 `e39e3c84ab08ab6ee64f9bf09cd06e23a52dbf1753ad1f4079ca678dc6d3bc13`，在该目录执行 `sha256sum -c SHA256SUMS` 的 24 个列项全部通过。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 19:21:41 UTC，next213）

在 next212 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`。随后 current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next213-20261107T192141Z/`；`summary.json` SHA256 为 `55cc32dca72b3bf0fac76f20b597aa137fd7323efb0903c2b7aea828eccb76a3`，目录内 `sha256sum -c SHA256SUMS` 的 25 个列项全部通过，`SHA256SUMS` SHA256 为 `a2d63f874d8e2dfc36aeee634a56c71f69b233c4488f90fb75bc8cf491acf7ae`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 19:39:00 UTC，next217）

在 next216 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`。随后 current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next217-20261107T193900Z/`；`summary.json` SHA256 为 `fbf7b20617eff33715a1c70d29ff40c9d22b36dd629ff123d7590f959c45336c`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `88968f6a2526987b4119dba820201963ac7b9234ccb1c9d0c3ae417b5d9b7188`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成 Local chat、非流式/流式协议、JSON Schema、`n=2`、tool replay 或其他模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未运行 editor runner、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 19:42:16 UTC，next218）

在 next217 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next218-20261107T194216Z/`；`summary.json` SHA256 为 `218c24e9c4f17887acfdb4a69af316a02bc38c26556affc4155cedfa6018ecb1`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `dcc4f1cf7b2d8adfe3433ddb645416ba3028018cbbcdb588b3c7d7acbd47ed42`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate (2026-11-07 19:47:09 UTC, next219)

Availability-only recheck of http://192.168.10.68:8192 after next218: current and --noproxy /health, /v1/models, and /v1/loads all returned HTTP status 000 with connection refused; bodies and response headers were empty. Current and direct TCP checks both returned ConnectionRefusedError, and the current /health recheck also failed.

The availability gate was not met. No served model was read and no non-stream or stream chat was sent (chat_attempted=false, chat_request_sent=false, served_model_ids=[]). Evidence is in /tmp/sglang-terra-next219-20261107T194709Z/: summary.json SHA256 2bda3da35a22641846ad5695d20e092c9fdf01cf9892f3139d9a7d21ed40e2ea; sha256sum -c SHA256SUMS passes all 22 entries; SHA256SUMS SHA256 947c9dcdc62049739fbb3e528e5fed1e2c16107a5dee878bb3e22e211759a327.

This round proves only that the named endpoint was unreachable at that time. F21 second served model/port, valid-auth rejection, independent wire capture, and default editor manual visual evidence remain open. No service/config/repository changes, staging, commit, or push were made.

### Terra SGLang availability gate（2026-11-07 19:56:08 UTC，next221）

在 next220 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy *` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next221-20261107T195608Z/`；`summary.json` SHA256 为 `45715717a4b3d1062d68bc6ffc77247e1d7d74974266ea283fa9e014cd5a1755`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `d07a34a9ed9475535ee7173f325f9060bf50b29c938833b3766b1bea77d01652`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:02:41 UTC，next222）

在 next221 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next222-20261107T200241Z/`；`summary.json` SHA256 为 `2e90a7c73634fbec7c83ba9cce6a239c2af8c4c6b65189daa0efbc7db4e60cd3`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `d029a4b22d494eea503c0477d8a3dc2fc7dd39b6566d754f3819989fecfc4336`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:11:42 UTC，next223）

在 next222 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next223-20261107T201142Z/`；`summary.json` SHA256 为 `572319962e33367a35fa9f9b1fd3e1cd99211f4e01613a40994abcff71e18453`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `bcf2bebd4b8fbdc3dc92a4794c3cb72fe53ba4ca01545e621cf6accba5f43218`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:18:54 UTC，next224）

在 next223 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next224-20261107T201854Z/`；`summary.json` SHA256 为 `586c00d86f30e514898fc5b40f1f31af43be523630f0785450c2ec0131f0adfb`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `5447ed4e0228637b1472b6a1739cfd65c29a60d55b4c159cfcb3c1e5ede53530`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:25:15 UTC，next225）

在 next224 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next225-20261107T202515Z/`；`summary.json` SHA256 为 `a4bacbb4889f40448666b663ec8440f452f946be54726da01a3605d827f4980a`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `96b87ac69a4ee102855938c6851afde0fac9f023b1a2224f2ad2939b25af9764`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:28:18 UTC，next226）

在 next225 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next226-20261107T202818Z/`；`summary.json` SHA256 为 `2d972f330ffab314dde1791971596a5ed34d9d564b2458ed5dc1b012f378536f`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `df572453ea18b24b9431aaa64f0ab191da276127adc02abcbc9d5e8cd1fbe5ad`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:32:06 UTC，next227）

在 next226 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next227-20261107T203206Z/`；`summary.json` SHA256 为 `68f01ce37efcacac4157766d762d447f628577c0ef45fad6081edf494c288880`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `890c01d459d47c172946d8553857885eeb6914daa50841202d51afe17dee1092`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:34:01 UTC，next228）

在 next227 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next228-20261107T203401Z/`；`summary.json` SHA256 为 `3350bef5b60ca8b99f150779968199f3d99cbc80de8017873e4c6e4e26fa3ee0`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `627ab435bfff2a18939bb4ba9490e55071f13c925cff035c031924d70cfac882`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:38:00 UTC，next229）

在 next228 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next229-20261107T203800Z/`；`summary.json` SHA256 为 `00a4bfe0b429173392df21716a8029f7a246e13cbfc788979e05584f735a5420`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `fd47823919dc543fb46b16a14dfda32fcc563cede4b20f43a5c96d0049f900ef`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:41:31 UTC，next230）

在 next229 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next230-20261107T204131Z/`；`summary.json` SHA256 为 `eb86178a41dac3dc1970b21bed49e73d83b7e8f205c57dd423e296deaee6f64e`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `8dfaa9a9213b6434b4e8b5a8690701dba4297f369df67e363438f551902b80f3`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:47:30 UTC，next231）

在 next230 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next231-20261107T204730Z/`；`summary.json` SHA256 为 `337deb1aeccd2cb4ddbb39a5a95808bfed8529642da11e1d60edc841a86b03ce`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `8adb0896aec6ab34f013c90379e6bdb0cfa8580166f51f1412fa5671374e890b`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:50:50 UTC，next232）

在 next231 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next232-20261107T205050Z/`；`summary.json` SHA256 为 `c067d7baa9f7335fec3f732bf5d4c91fed9071a0413af66f006a75811000ec01`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `0f20b3a4c26313637c42025bba7753a3caa12331ad0b02d028ae121f84563295`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 20:56:14 UTC，next233）

在 next232 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next233-20261107T205614Z/`；`summary.json` SHA256 为 `3e9c0cad35bd46c0829fdb1012d143bfd3a4ce0d955cd3dc34fb90fa79df195d`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `a6318789b1d81f526868238d838dcade7c6ddb9f00d6f20064774b067369d436`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:01:01 UTC，next234）

在 next233 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next234-20261107T210101Z/`；`summary.json` SHA256 为 `f410e3266f2670b56246f7d0260a231cdf27db8d3a3f5202785f27e7bc10908b`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `b6c065c91d845a833ac27238d9218bc0b623ccad2617bd3fd73e61cfaa5b6729`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:05:03 UTC，next235）

在 next234 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next235-20261107T210503Z/`；`summary.json` SHA256 为 `350f1e83cf7874ff250878368d8d7c083733d77b39ab38e262ecdfd6745ed3d1`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `5e7a134ec7f71f7bb49ccf1b0965b4c1a527486496d267b4049600cb4aa61d4f`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:06:53 UTC，next236）

在 next235 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next236-20261107T210653Z/`；`summary.json` SHA256 为 `a7c67be2de6e057908cff77af10641625c14c5e8a8d77e11566e458c228cc25c`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `462558fa6ea358a2beaf0f22a415cea5086927448f1528fe173ebc4f26d134f7`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:09:50 UTC，next237）

在 next236 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next237-20261107T210950Z/`；`summary.json` SHA256 为 `4ba69ecc8331f3819c4bc619e938a895adb6bca9e4a5c52109d0ea21ad6d42f4`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `df3f3655cf164a4d3141e2081e68da91c862fddfbdb877a745736dc8b1f97c9e`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:12:23 UTC，next238）

在 next237 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next238-20261107T211223Z/`；`summary.json` SHA256 为 `6e0ff729733cdb9be10bf15af7685aba5ea63c9bce76b1f7ae66f4cd48692472`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `2d6a8885e3c0dd0b286960df116bd220e8255a6036945f0b1d3193a26301e317`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:16:56 UTC，next239）

在 next238 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next239-20261107T211656Z/`；`summary.json` SHA256 为 `c4b0aa6db37c80be97e90d4fad4cbb0c50d7d3f527ce7f67cfb4799fc60499a0`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `9da5ac22b29434984f504b7a3e4a6e5f7af241e9addd0e9e68fb9b5a3c68dc6c`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:19:12 UTC，next240）

在 next239 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next240-20261107T211912Z/`；`summary.json` SHA256 为 `3c4f1751f38df174604c094530a2ab143b84bf05178e92ad2ebc1624983dce0b`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `30e6074680e13846f3eb5a5f33580e499697053de2920ef6fa192c22a513996b`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:21:14 UTC，next241）

在 next240 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next241-20261107T212114Z/`；`summary.json` SHA256 为 `65bda089882d7550e7c848b2ae2b53bdadb7680d2865bc4b626ee5652af18420`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `dc9d864b1073d0fa86af5e293eb45138030a9399990d29957aefeffd2db07ed5`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:27:35 UTC，next242）

在 next241 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next242-20261107T212735Z/`；`summary.json` SHA256 为 `93681879f8ef2046d6f03c3eb52a79dd50f7a11ac3709ab86a82fd0593204748`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `66ff0c9a3646a473bc749c5c682211e8db8c67eb16f10ce84947eb768f87a006`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:35:05 UTC，next243）

在 next242 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next243-20261107T213505Z/`；`summary.json` SHA256 为 `8edd47a86935c65f7e693c094a1c261b8819db323365dff48dc8ecbe9a3fd03f`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `9e6d120e56f7f0cfd55851c87c7b4ba317181db428f9449d070bd593acb02a0c`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。

### Terra SGLang availability gate（2026-11-07 21:38:05 UTC，next244）

在 next243 后再次按 availability gate 只读检查真实 endpoint `http://192.168.10.68:8192`：current 与 `--noproxy '*'` 的 `/health`、`/v1/models`、`/v1/loads` 六次请求均为 HTTP status `000`（urllib `URLError: <urlopen error [Errno 111] Connection refused>`），body 与 response headers 均为空；current 与 direct TCP 8192 两次 `socket.create_connection` 均 `ConnectionRefusedError: [Errno 111] Connection refused`，current `/health` recheck 仍为 status `000` / connection refused。

availability gate 未通过，因此没有读取 served model，也没有发送 non-stream 或 stream chat（`chat_attempted=false`、`chat_request_sent=false`、`served_model_ids=[]`）；没有 response、SSE、choices、usage、loads 或模型语义结论。完整 availability-only 证据、body、headers、meta、TCP JSON、health recheck、`probe.py`、`run.log`、`summary.json` 与 `SHA256SUMS` 在 `/tmp/sglang-terra-next244-20261107T213805Z/`；`summary.json` SHA256 为 `28eaf0272bf86015831c17d2d424501d5fe4598da682fd98421e3325150db8c2`，目录内 `sha256sum -c SHA256SUMS` 的 22 个列项全部通过，`SHA256SUMS` SHA256 为 `777c367b93a9d28c5a4b06abd058e116a9b2e6cc2169a04fb3f96d4068183532`。

本轮仅证明指定 endpoint 在该时段不可达，不能把连接拒绝解释成模型语义失败；availability 恢复后才会读取真实 served model 并执行最小 non-stream/stream chat。F21 第二真实 served model/第二端口、有效认证拒绝、独立 wire capture、默认编辑器窗口人工视觉缺口保持。未启停服务、未修改远端配置、未修改仓库代码、未暂存/提交/推送。
