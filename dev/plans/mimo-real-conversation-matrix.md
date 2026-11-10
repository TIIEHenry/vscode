---
title: "MiMo 双模型真实对话与过程显示矩阵"
type: plan
status: accepted
phase: M7
updated: 2026-11-11
summary: "方案、复合预算和 Electron 别名修订已签收；BYOK、automation/scenario 编译、Kotlin 与验收器离线整合通过，flash/pro × 三协议真实模型及默认窗口矩阵仍待执行。"
---

# MiMo 双模型真实对话与过程显示矩阵
状态：执行中。负责：agent:codex。
覆盖需求：PRD-003、PRD-004、PRD-008、PRD-012、PRD-013、PRD-016、PRD-021、PRD-028、PRD-029。

上述编号用于需求关联。本轮只按下文场景验证消息/过程显示、状态与身份，不构成关联 PRD 的整条验收；最终报告逐项注明实际子条款与未覆盖部分。

## 1. 目标与当前证据

用户要求继续自动推进高价值工作，包含真实 LLM 全矩阵、MiMo flash 与 pro、仅一个编译通道，必要时补复杂场景的真实路由测试；重点是对话消息及过程是否正确显示。

验收对象只包括默认编辑器窗口。依据为 [需求](../../docs/product/requirements.md)、[Conversation 系统](../../docs/systems/conversation/INDEX.md) 与[测试分层](../../docs/architecture/cross-cutting/testing.md)。Agents Window 不计入结果。

当前真实 Provider 矩阵入口在同级 UniverseAgent 的 `scripts/run-mimo-full-matrix.sh`，环境与范围见其 `docs/systems/infra/test-environment.md`。L4 文本/工具/权限探针、L5 workspace catalog 与 normal/ablated 对照没有经过 IDE 的 main、IPC 或 DOM，不能用于证明显示正确。旧 marker 场景不含复杂路由，旧完整 L5 记录也含真实失败，不继承为本轮通过。

实施前的 [真实编辑器场景](../../test/scenario/scenarios/universe-agent-real-editor.cjs) 和[启动包装器](../../test/scenario/scripts/run-universe-agent-real-editor.sh) 已覆盖生产发现、Composer 提交、工具与持久回答、reload，但当时只运行单工具任务，提示词含预期答案，包装器固定 openai。新矩阵承接并修正这些边界。

原钉死包为 027ab；干净 c4fa 候选已完成 JVM 构建，尚未换钉。版本、隔离与资源监控事实见[引擎指南](../../docs/guides/debug-engine.md)。当前主引擎工位有其他 WIP，不整体复制、提交或覆盖。

## 2. 矩阵与判据

### 2.1 模型与协议

| 模型 | Anthropic | OpenAI Chat | OpenAI Responses |
|---|---|---|---|
| `sub2api-mimo/mimo-v2.6-flash` | 独立 cell | 独立 cell | 独立 cell |
| `sub2api-mimo/mimo-v2.6-pro` | 独立 cell | 独立 cell | 独立 cell |

每个 cell 记录实际引擎 SHA/包摘要、IDE 源码与已加载产物身份、所选 model profile、实际 Provider 协议、任务、attempt 和终态。先检查网关确实声明两模型；任何回退到其他模型都不算目标 cell 通过。只做某个模型或协议的校准不能代替全表。

### 2.2 两条验证链

| 链路 | 执行范围 | 能证明什么 |
|---|---|---|
| 引擎真实 LLM | 冻结后的 `--suite all`：各 cell 的 L4、L5 marker/catalog/normal/ablated、routes；严格失败，保留原始 attempt | Provider、工具闭环、任务与路由行为；不证明窗口显示 |
| 默认编辑器显示 | 各 cell 均走生产 main → SessionViewHost → renderer；以下显示场景保留真实事件与 DOM 证据 | 输入、过程、正文、终态与恢复；不能只看数据库或 projector entries |

两条链路使用一致的模型/协议标识。若为显示修复使用真实记录离线重放，必须保留其来源与原始顺序；重放属于回归证据，仍须真实窗口复验。

执行前将期望集合、各任务/fixture/verifier 文件摘要和严格参数写入本轮 manifest，再编译封存；不能从实际产生的行反推期望集合。引擎每个 cell 固定执行以下集合：

- L4：`text_stream`、`echo_round_trip`、`permission_denied`，各一个独立 attempt。
- L5 marker：对应协议的 `write-marker-*`，一个 attempt。
- workspace-v2：`short-orders`、`short-alerts`、`parallel-checkout`、`parallel-collections`、`long-ledger`、`long-inventory`、`deep-storage`、`deep-queue`；每任务分别执行 catalog、normal、ablated，各一个 attempt。
- route-contract-v1：`route-spawn`、`route-deep-think`、`route-loop`，各一个 attempt；它们是指令路由合同，不是自主路由收益评测。

显式使用 `--models flash,pro --suite all --l4-attempts 1 --l5-attempts 1 --strict-l5 --task-timeout-ms 600000`；完整运行和最终审计清除 `MIMO_MATRIX_CELLS`、`MIMO_TASK_ID` 等过滤环境，不传 `--cells` 或 `--task-id`。定向诊断另记，不能充当最终全表。coverage 与 outcome 分别审计：缺项、重复 attempt、skip、失败都不能被摘要去重隐藏；严格执行或 outcome 审计非零必须保留为失败结果，不写全绿。

### 2.3 显示场景

| 场景 | 真实前置 | 必须检查 |
|---|---|---|
| 文本与流式 | 真实模型输出，含中文及 Markdown；通过工具读取本次新生成的数据，答案不出现在提示词中 | 用户消息只出现一次；工具前说明、最终回答可见且顺序正确；流式进行中与持久完成可辨；最终无残留 overlay 或 busy |
| 多工具与多轮 | 同一会话执行多个实际工具，再发送追问 | 同名工具按真实 `tool_call_id` 区分；名称、参数、结果与状态对应；不吞掉后一条助手正文，不串到其他会话 |
| 过程折与思考 | 实际 Thinking/工具事件；缺少某类事件则明确记未覆盖 | Thinking 与工具平级，正文、权限和用户消息在折外；展开选择不被后续增量重置；只显示引擎实际提供的内容与耗时 |
| 失败、权限与取消 | 在自有工作区产生真实工具失败、权限等待/拒绝或取消 | 对应过程显示真实失败/取消/未完成；权限控件送达后状态与事件一致；busy 能结束，错误就地呈现，不伪造成功 |
| 复杂路由 | 任务确实产生 fork/spawn/loop/deep_think/compact 中的目标事件 | 父子会话与回合归属、工具过程、子任务终态、主会话最终回答正确；没有目标事件就记路由未覆盖，不能用直聊代替 |
| 历史恢复 | 真实完成后 reload，并重新进入同一会话 | 正文、工具状态、顺序与 durable 身份一致；实际可见，不仅条目存在；未完成过程不能恢复成成功 |

实施前冻结以下 cell × scene 清单，全部六个 cell 均执行：U01 文本/流式/Markdown，U02 多工具与多轮追问，U03 真实工具失败，U04 权限等待→允许且引擎实际执行，U05 权限等待→拒绝且引擎实际未执行，U06 执行中取消→终态，U07 reload/切回后的历史一致性，U08 spawn 父子过程，U09 deep_think 过程，U10 loop 多轮过程。过程折展开状态、tool_call_id 对应和终态判据适用于其中产生过程的每个场景，不能仅在一格验证后推广全表。U07 至少核对该 cell 已完成的正文/工具/路由记录，并检查取消记录没有恢复成成功。

U01–U10 均为 required；缺事件、未触发、skip、timeout 或没有真实窗口均不能满足相应场景。Thinking 单列能力字段：仅核对引擎实际公开的内容；执行前证明确实不提供该能力时可登记 N/A 及依据，能力未知或期望有事件却未观察到只能记未覆盖，不得合成。fork/compact 的额外观察另列，不用它替代 U08–U10，也不据此签收引擎 F21 正式路由收益评测。

复杂路由优先复用现有真实任务，并给显示场景补独立结果 oracle。自然语言答案不同可被接受，事件/结果对应和显示不变量不能放宽。模型未执行目标路由、任务失败与 IDE 丢失显示分别记录；后两者不能靠降低任务要求互相掩盖。

### 2.4 显示复合场景预算（首次运行前修订）

显示场景不能把复合任务当作一轮请求计时。U02 包含初次任务与追问，共 2 个 episode；U07 在同一真实会话执行 U01、U02 及其追问、U08、U09、U10、U06，共 7 个 episode，随后切回与 reload；其余场景各 1 个 episode。旧独立路由样本的三项合计已达到 747.382 秒，而旧显示 driver 对整个 U07 的 watchdog 只有 720 秒。这只说明预算结构存在截断风险，不预测新候选必然耗时，也不继承旧样本为本轮结果。

首次真实窗口运行前，将以下固定策略登记到 manifest、oracle 和结果并交叉核对，不接受继承环境或命令行临时加时：

- 每个 episode 保持 `600000ms`，覆盖其设置权限、提交、真实终态及正文/工具 DOM 验收；同一 episode 的全部等待共享一个单调时钟 deadline，不因开始下一个 poll 或 permission/cancel 等待而重置。
- setup `60000ms` 从 driver 发起本轮 wrapper 前开始，覆盖 Bash 的引擎就绪、Electron/布局启动、连接和新会话流 hello；CJS 开始时仅消耗同一 setup 的剩余预算，不能重新开满 60 秒。driver 与 CJS 须核对同一主机单调时钟域及预算身份，未建立阶段进度或卡在 CJS 启动前同样受 setup deadline 限制。
- U07 的历史快照、切回、reload 和恢复后的可见 DOM 核验共用 history `120000ms`；全部场景另有 finalization `60000ms`，用于最后的身份、Thinking、fold 与整体显示判定。
- `caseBudgetMs = setup + episodeCount × episode + history + finalization`。wrapper watchdog 再加独立清理余量 `60000ms`，因此普通场景为 `780000ms`、U02 为 `1380000ms`、U07 为 `4500000ms`；该余量不能再发新的模型任务。
- CJS 中的 Playwright 动作、事件轮询、sample/fold 点击、逐行滚动检查、Electron main/page evaluate 均受当前阶段剩余预算限制；剩余时间非正数就先失败，不能给 Playwright 传表示不限时的 `timeout: 0`。无原生 timeout 的操作须受控等待，超时后将该阶段置为不可继续，不开始后续 episode，不把后到结果补成通过。结果记录预期/实际 episode 数、阶段与 episode 耗时、超时所在阶段、episode label 及 operation。setup、episode、history、finalization 与外层 watchdog 超时分别报告，不能仅凭超时推断产品显示错误。
- cleanup 的 60 秒是共享的一次单调时钟 deadline：正常完成、失败、超时或信号后即进入回收；包括 runner 的 evidence.finish/视频/章节后处理、wrapper/引擎、owned 进程组与 relay 的回收，不再发模型任务。所有 TERM/wait、handler join、reap/验证都只使用同一剩余时间，不能逐进程或逐 handler 重新给完整宽限；到期只对确认自有进程强杀并验证，不能在 watchdog 后再追加另一轮 15+5 秒。停止无法确认则保留私有状态、失败并停止后续 case。

此修订只分配完整显示场景已要求的工作，不删任务、不跨 case 拼历史，不改变引擎矩阵的 `--task-timeout-ms 600000`、严格参数或通过判据。修改后的 policy、验证器和场景身份须形成新的 seal/campaign。预算修订已独立复核并提交为 `cc79e1cb34d`，实现与离线验证见 §6；当前仍未执行新的真实显示矩阵。

## 3. 实施顺序

1. **规则 16 审查。** 同一会话由非作者只读审查本方案，核验 Critical/Important 后改稿，再进入实现。
2. **隔离矩阵 harness。** 从干净 c4fa 建测试专用工位，按文件提取已提交的 MiMo 测试及必要 snapshot/运行依赖准备工具；只迁本主题，不搬主工位 WIP。核对 ResponsesClient 构造签名等版本差异。保留原干净候选工位和运行包。
3. **显示场景与 cell runner。** 复用本仓 scenario runner，参数化模型/协议与场景数据；每 cell 单独配置、工作目录、证据目录和引擎实例。保留默认旧场景的兼容入口，新增矩阵显式选择，不静默替换旧验收含义。
4. **先验证判据。** 用现有离线测试证明“提示词泄露答案”“最终回答只在库/entries”“重复 overlay”“错误工具对应关系”等反例不能通过。离线测试用于检查验收器，不替代真实 LLM。
5. **统一编译并封存。** 在唯一通道串行完成必要的 Node/scenario 产物与 JVM 测试编译/运行依赖准备；来源、源码及本地运行产物摘要封存。旧 manifest 缺少身份字段时不能重新封存为新结果。没有相关变更时不重复全量编译。
6. **串行执行。** 全部 cell 使用同一已封存版本；真实 LLM 测试与默认窗口场景分别出结果。续跑保留原失败并核对 manifest，不以更改 timeout、任务或 verifier 静默覆盖旧 attempt。
7. **修复与复验。** 若定位显示错误，先将实际事件经 decoder → demux → Actor → projector → DOM 分层复现，修复拥有错误的层。定向复验只用于定位/回归；IDE 生产代码、decoder、DOM verifier 或场景变化后建立新 seal/campaign，在最终身份上重跑全部六个 cell 的 required 显示清单。引擎生产产物、harness、fixture/verifier 或协议配置变化则重建受其影响的引擎 campaign 并全表执行；未变化的引擎链证据可独立保留，明确版本和复用边界，不能拼成同一新版本的全绿结果。行为/契约变更按仓库规则同步对应规格，不提升无关产品状态。

## 4. 一个编译通道与隔离

- 编译包含 Gradle、Kotlin/Java、Node/TypeScript、scenario/automation 构建；任何时刻仅一个通道。子任务只能只读审查或准备文本，未经父窗口安排不得启动编译。
- 模型/协议切换不重编引擎。运行前后核对封存身份，禁止来源或产物漂移后继续标成同一 campaign。
- 产物遍历默认拒绝软链。Electron 预包的真实启动别名 `universe-agent-studio → code-oss` 可在该 runtime 根内作为文件别名封存：同时绑定逻辑路径、原始链接文本、最终 canonical 目标相对路径与目标实际字节。仅该 Electron 遍历启用此例外；目录、悬空、循环和最终目标越界均拒绝，不改现有缓存或 `.build` 链接。首次实际只读预检因该合法别名被默认策略拒绝的记录保留；窄实现及负例已复核，实际 Electron 包身份遍历复验已通过，正式 campaign 仍须使用最终封存身份。
- 不停止、改名规避或更改系统内存监控。以实际可用内存安排单 worker 构建，`-Xmx` 只作为堆限制。
- 引擎同时隔离 AgentHome、JVM user.home、cwd/项目数据与日志；显示自动化使用临时 user-data/extensions/shared-data、默认 editor、无 `--agents`。不复制日常或交互测试登录目录。MiMo 本地网关不依赖 Copilot/GitHub 登录。
- 密钥仅传给自有测试进程，不进入源码、截图说明或报告。固定当前包、原 PIN、50061 和其他工作区 WIP；候选测试不直接覆盖线上包。
- 只清理确证本轮自建的进程、临时会话和目录；异常时保留证据。既有 Profile/Tools 数据不属于本任务。

## 5. 验证与交付

代码/验收器按变更跑定向 ESLint、scenario/脚本测试和所需本地编译；提交前运行 `python3 scripts/check-docs-health.py`、`python3 scripts/generate-docs-status.py --check`、`python3 scripts/wiki/wiki.py check --root .`，行动层保持行数限制。

结果按 cell/场景分别给出：真实运行状态、任务结果、显示不变量、路由覆盖、错误与 skipped/环境缺口。截图和实际 DOM 可见性、真实事件身份/顺序、持久结果分别关联。只保留可公开的测试数据；大日志和原始事件放仓外，仓内保留命令、版本、位置与摘要。

完成要求：两模型三协议的完整现有真实 LLM 矩阵均已执行，显示场景具备真实窗口证据，必要路由事件已观察并核对归属，发现的项目缺陷已修复和复验。失败或未覆盖项不能写成全绿；仅构建成功、marker/直聊成功、离线回放成功或单个 cell 成功，都不足以宣布本目标完成。

## 6. 审查与实施记录

首轮规则 16 只读审查为 C0/I3：已补完整 expected set/严格参数，逐 cell required 显示清单，以及修复后的新 seal/campaign 与全表复验规则。第二轮复核 C0/I0/M1，可签收进入实施；Minor 的 PRD 范围限定已补到正文。尚未完成本方案的新矩阵或显示场景。当前候选构建通过不等于本方案验收通过。

2026-11-11 实施进度：干净 c4fa 的 124 jar 候选运行包、22 份包内 proto、隔离冷启动与自有空会话生命周期已核对，50061 未换钉。引擎 harness 的 schema 2 预注册、审计与真实 JVM 隔离修复经独立复核；随后移除了不符合宿主指令的 HOME 覆盖，保留 JVM user.home、AgentHome、cwd/tmp/log，引擎工位 Python 离线验证已通过。

显示 runner 已补三协议、实际响应模型核对、完整包来源核对、信号回收和本轮凭据配置清理，根窗口早期离线验证已通过。oracle 的持久回答闭集、完整工具结果、执行事实与持久投影一致性、精确路由路径/内容/阶段、相关 fold 内容与 DOM 增量修复已获独立 C0/I0；Node24 语法检查、合成 verifier controls 与旧场景 Chromium DOM 回归均通过，最终整合证据见下文。单工具无法观察选择后的相关增量时明确记 uncovered，Thinking 未知仍记未覆盖。

上述均不是新的真实模型或默认窗口通过。最初共享锁排队以等待码 75 结束，未启动编译；后续 BYOK 单测、automation/scenario 编译与 Kotlin 离线回归已在同一通道实际执行。各次失败及修正后的重跑独立保留，不将旧 attempt 改写成通过。

首次真实显示运行前，新增 §2.4 复合预算修订。首轮独立只读审查 C0/I2 指出 setup 漏算 CJS 启动前阶段、cleanup 可能逐操作叠加宽限，均已补入共同 deadline 和阶段边界；实际修订文本复核 C0/I0，并以 `cc79e1cb34d` 独立提交后实施。单 episode 和引擎矩阵仍为 600000ms，U02/U07 完整任务数量不变，未以旧样本签收或预测新候选通过。

预算实现固定点已独立联审 C0/I0，首次离线整合通过且源文件运行前后摘要相同，证据在仓外 `vscode-debug-engine/logs/2026-11-11-offline-mimo-budget-2caa367cf0.json`。包含实际 Node/Python bridge，仍未执行真实窗口或模型。随后实际产物遍历在 Electron 包内启动别名处被默认软链策略拒绝；§4 的文件别名窄例外经独立只读审查 C0/I0，以 `e05a362249b` 独立提交后实现。窄实现、原生 `ElectronApplication['evaluate']` bound getter 与相应负例均已独立复核 C0/I0，实际 Electron 包身份遍历复验通过；首次拒绝不被后续通过覆盖。

统一串行结果按原 attempt 保留在仓外 `vscode-debug-engine/logs/`：`2026-11-11-serialized-validation-zs37k6nf/status.json` 中 BYOK 定向单测通过，但 `test/scenario` 的 `npm run compile` 因 Electron 类型导入与泛型解包（TS2307/TS2769）退出 2；bound getter 窄修后，`2026-11-11-serialized-retry-jfow8dy1/status.json` 记录同一编译命令退出 0，随后 Kotlin 的 `MimoMatrixIsolationTest` 负例 fixture 未触发预期异常而退出 1。修正该 fixture 后，`2026-11-11-kotlin-retry-sdjysvnk/status.json` 记录隔离、profiles、路由合同离线回归及运行依赖准备退出 0。对应 `.log` 和首轮 Kotlin `engine-kotlin-unit-failure.xml` 留在各自目录；没有真实 Provider 请求。

最终 Python/Node 整合已通过，包含预算、oracle、旧场景 Chromium DOM、信号与凭据清理，以及实际 Node/Python 单调钟桥接；桥接覆盖逐阶段确认、U07 连续快跑漏轮询与双向 cleanup 认领。命令见[当前证据](../progress/status.md#当前工位与证据)，结果在仓外 `vscode-debug-engine/logs/2026-11-11-offline-mimo-final-307a999c02.json` 及同名 `.log`，JSON SHA-256 `019f75e8b4e283d9450a3d78b576f8adc7ea56a30df0ef0d678d8e9f91e87e3e`；退出码 0，运行前后源码摘要相同。这次整合没有编译或启动 Java，不能替代前述独立 Kotlin 与编译证据。

本轮串行验证已结束并释放自有 lane；随后发现外部 `routes-only --skip-compile` campaign（PID 407934）重新持有共享锁，后续必要产品 out 刷新仍需同锁排队。正式源码/产物身份仍待提交与封存，再建立新的真实 campaign；本方案的新真实模型矩阵和默认窗口显示矩阵均未执行，不能据本轮离线通过关闭该目标。
