---
title: "队列读回与技能正文保存跨仓修复"
type: plan
status: implemented
phase: N/A
updated: 2026-10-27
summary: "新增正式队列快照与技能正文保存；保持生成中发送闸，按来源安全写回与连接代次恢复。"
---

# 队列读回与技能正文保存跨仓修复
状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 范围与依据

用户 2026-10-26 明确授权同时修改 UniverseAgent 与 IDE。承接 [协议消费修复](engine-protocol-consumption-closeout.md)；保留既有生成中 Send / submitInFlight 闸（[旧队列方案](engine-gap-queue-send-attachments.md)），本轮不开放生成中发送或 Enqueue，不做附件。默认编辑器为唯一产品范围，不改 vendored sessionCore。两个仓库的既有 WIP 均不纳入。

## 正式契约

引擎 ADR-435（同级 UniverseAgent/dev/decisions/435-queue-readback-and-skill-content-save.md）为 wire 决策源。新增 AgentService.GetQueue(GetQueueRequest session_id=1) returns QueueStateEvent；复用现有全量 mapper。空 id INVALID_ARGUMENT，非主/不存在 NOT_FOUND；使用 getWithoutTouch，不创建、不驱动 drain，queueSnapshot 不存在 FAILED_PRECONDITION。队列 version 为非负 int64，IDE 用十进制 string（BigInt 比较）跨 IPC，不转不安全 number；createdAt 同样 string。float upload_progress 需新增有边界检查的 wire5 解析；未知 status/hold 枚举拒绝整份快照，不猜成可操作 PENDING。

ToolService.SaveSkillContent request：skill_name=1/content=2/create=3/expected_source=4/optional expected_content=5。response ok=1/reason=2。create=true 仅 USER 新建，已有任一可见同名、目标文件已存在或目录冲突都拒绝，不自动更名；update 必须 expected_source 为 user/project，expected_content presence 必需（允许空正文），与当前原文一致才写。Bundled/CLIENT 拒写。创建采用严格 SkillNamePolicy 且拒绝连续点；更新接受现有 catalog 可读的中文/空格逻辑名称，仍拒绝斜杠、反斜杠和连续点。严格按当前目录 entry.contentPath/scope 写，不从逻辑名称猜路径。保留目录 identity（withName）与 manifest flags；update 不重写 manifest，新建默认启用。写路径经 WorkspaceOwnership forWrite，拒绝链接/越界。损坏 manifest 拒写；CancellationException 原样抛。正文 atomicWrite；create 的正文与 manifest 不是多文件事务，manifest 失败明确 ok=false 并说明正文可能已创建，不伪造成功或盲目重试。保存、SkillInstallWriter.install、EngineSkillCatalogService.setSkillEnabled 的本进程共享串行锁覆盖 winner解析/名称判冲突/正文与manifest读写（public wrapper → internal UnderMutationLock，不依赖重入）；CAS 必须从 fresh catalog 定位并用 PlatformFileSystem.readText 读取真实原文，不能用 size/mtime 内容缓存，跨进程外部编辑仍可竞态，记录实际边界。

## IDE 消费

1. types → bytes codec → grpc client/transport → node service → IPC allowlist。SaveSkillContent 去掉最后 JSON unary。GetQueue 增 conversationEntryCapability；广告+无副作用空请求 INVALID_ARGUMENT 探测为 SUPPORTED；UNIMPLEMENTED/无广告 UNSUPPORTED，其他 UNKNOWN。Save 原有广告探测/动态绑定保留并改为 bytes，空请求不得创建文件。
2. 新 queue reader 独立于 sessionCore，在 roster 的活动且已绑定会话启用。请求必须使用 engineFrameSource.boundEngineSessionId(lease) 返回的真实引擎id，投影按本地sessionId索引，真实id也纳入scope；localId≠engineId时读取和所有队列mutation均发真实id。单请求串行，1秒完成后再排下一次；连接代次、published identity+linkId（两者必需）、active session、pairing、绑定失效/dispose 都撤销投影资格。通知能力变化时重验，不开 Chat。断开留上次快照但状态 stale，换引擎清除；listed/pending lease bind成功处显式唤醒，bind开始撤ready；lease monitor代次进入读scope，不凭历史bound集合判断。不同连接代清版本，旧请求不能覆盖新状态。成功才 ready，失败 error 保留最后快照；版本倒退拒绝并保留错误，不能把失败当空。同步只读不影响会话TTL。
3. 现有 Pause/Resume/Clear/Hold/Release/Edit/Retry 只有 ready 才转发，ok 必须显式 true；修改完成立即刷新当前会话（若poll在途记pending-refresh，完成后立即再读，不吞请求）；刷新期间撤ready，写入错误和读失败分别报告。失败仍走现有 onDidFailEngineAction。Enqueue 与生成中 Send 继续关闭。
4. Inbox 移除无条件 empty 覆盖，显示 Loading queue / Queue unavailable / Queue not supported / Queue disconnected，成功才显示空或条目。失败及 stale 条目只读；Retry 与 header actions 同一 ready 闸；真实引擎行编辑入口关闭，原因见下方实施边界。能力缺失不出现写 chrome。沿用布局/token；不改当前 ComposerChrome/StubModel/样式 WIP。
5. Skills New 发 create=true；Save 发 create=false、已加载来源与原文（保留空正文 presence）。异步创建对话框、保存、刷新捕获同一 published link/对象，晚到结果不污染新连接/选中项；对话框中切换引擎不得把旧意图写到新引擎。失败保留草稿；成功重读引擎规范化后的原文，只更新CAS基线；捕获提交payload/编辑revision，同一link/selection且当前草稿仍等于payload才替换显示并清dirty，否则保留保存期间继续输入的新草稿并保持dirty。重读失败不以提交payload伪造规范化基线，保留草稿并显示读失败，后续显式刷新可恢复。覆盖保存期间继续输入在成功/失败及规范化重读三个路径。

## 验证与落地

- 引擎服务真实 unary：队列空/已有项目/版本、空 id、未知与非主不创建/不touch，snapshot缺失；技能新建往返/更新alias与disabled标志/冲突/只读/损坏manifest/空正文CAS/目录与链接越界/失败不伪成功。
- IDE bytes 行为覆盖实际 field tags、int64 > MAX_SAFE_INTEGER、未知枚举和optional空；IPC和能力三态；reader fake clock覆盖晚到、换引擎、断开重连、失败恢复/版本回退/dispose；真实 Inbox DOM 与 Skills create/update 请求回归。
- JDK21，flock /tmp/universeagent-gradle.lock ./gradlew :core:jvmTest --tests '*SkillContent*' :grpc-server:jvmTest --tests '*QueueRead*' --tests '*SkillContent*'（以实际类名为准）；仅本主题聚焦套件。同步 proto SSOT/两份消费者副本、hash并跑对应同步与breaking检查。
- IDE 所有转译/typecheck/out 写入持 /tmp/vscode-compile.lock，唯一父执行者，仅目标 transpileFile；Node、官方 Electron 最小套件、原project noEmit、ESLint。更新规格/报告/行动状态，文档门禁，方案与实施分提交，不 push。

## 只读评估

2026-10-26 reviewer review_protocol_closeout 只读评估，Critical 0；Important 三类已核实改入：共享锁扩到install/toggle完整winner解析与fresh原文CAS、listed/pending bind成功显式唤醒并绑定lease代次、保存中继续输入不能被成功重读覆盖。另纳入pending-refresh与wire5边界。父为唯一writer/build；评估未运行构建或写out。


## 2026-10-27 实施与证据

正式 GetQueue / SaveSkillContent 已在两仓实现。System.Connect 广播 GetQueue；空探测不创建；旧引擎无广告仍 unsupported。IDE 队列请求只使用绑定返回的真实引擎 session ID；read-only 轮询为**请求完成后再等 1 秒**，不是最多一秒延迟。断线时 published identity/link 被清空也保留 stale；只有新具体引擎 identity 才清缓存。

独立实现复核最终 C0/I0/M1；最后 Minor（基线标记绕过旧连接提示）已修。Important 对应修复：广播缺失、断连快照保留、保存读回失败恢复、中文 alias 与连续点验证、真实队列行编辑关闭。父唯一写入/编译，reviewer 未改文件或写 out。

**行编辑边界调整**：现有 Composer 用同步 dispatch=true 当保存成功，且 Edit/Release 无接受顺序保证。为避免丢草稿/提前释放，本切片关闭真实引擎行激活（鼠标与键盘）；Pause/Resume/Clear/Retry 仍按 ready 与显式 ok 门控。原第3项 Hold/Release/Edit 的底层转发保留且用真实id，但不作为可用产品入口。重新开放须补 awaited Hold→Edit→Release、失败草稿保持与断线恢复；此项仍未完成。Send/Enqueue/附件及同连接订阅溢出恢复仍未关闭。

Skills 增加显式 Refresh skills 幽灵按钮。保存失败不覆盖草稿；成功后规范化读回只更新 CAS 基线，revision 未变才替换显示。读回失败/写调用异常先刷新再保存；显式刷新在同一引擎 identity 下允许新link恢复，仍保留dirty草稿。异引擎旧稿只显示归属提示，不以新引擎正文自动重设基线。列表 description 等元数据通过显式 Refresh 更新。

验证（源码/自动测试，不冒充50061运行二进制）：Node 59套件833 passing；官方Electron reader/roster/Inbox/Skills 278 passing；原 src/tsconfig native tsc --noEmit 通过；主题ESLint通过。引擎 core 19、grpc-server 42，合计61 passing；proto copies/hash/buf breaking/reserved、KMP通过。命令：

- IDE：持 `/tmp/vscode-compile.lock` 使用 `build/next/transpile.ts` 的 `transpileFile` 仅转译目标文件；`node test/unit/node/index.js --run <test.ts>`；`bash scripts/test.sh --run <test.ts>`；`node node_modules/@typescript/native/bin/tsc -p src/tsconfig.json --noEmit`。
- 引擎：JDK21，持 `/tmp/universeagent-gradle.lock`；`./gradlew :core:jvmTest --tests '*SkillContentWriterTest' --tests '*SkillManifestWriterTest' --tests '*SkillStoreInstallerTest' :grpc-server:jvmTest --tests '*SkillContentRpcTest' --tests '*SessionAuthorizationTest' --tests '*SystemGrpcServiceTest' --console=plain`。
- 协议：`bash scripts/check-proto-copies-sync.sh`、`check-tui-proto-hash.sh`、`check-buf-breaking.sh`、`check-kmp-constraints.sh`。

CAS 只串行本进程save/install/toggle，外部进程仍可能竞态；新建正文与manifest不是多文件事务。未替换运行中50061，未执行默认编辑器连接新引擎的端到端验收，不升PRD总状态。两仓保留其他主题WIP，不push。

文档门禁：引擎docs-health通过（历史warning）；IDE generator已更新本方案生成状态列，generator/docs-health仍因其他主题未跟踪subscription-recovery-closeout.md未入索引而exit1（唯一error），不修改该草案。完整78个主题路径ESLint为0error/53条既有warning；新生产路径和新回归的定向ESLint无warning。

最终共享工作区复验：本主题最终代码曾通过原project noEmit；随后其他主题修改conversationStubModel.ts，在其新增session.turns行出现TS18048（session可能undefined），最新全项目检查exit1，仅此1项，未改该WIP。定向12文件ESLint无warning；全78文件53条既有warning未作为本主题修复。

引擎实施提交：`a03fc00c12`（26 paths，含代码/测试/协议副本/规格与行动层）。

提交范围：代码、测试与本主题规格均定向纳入；共享status.md中其他窗口刚写入的进度记录按整文件文档同步保留，不包含其UI/主题/StubModel实现。其余WIP文件未暂存。
