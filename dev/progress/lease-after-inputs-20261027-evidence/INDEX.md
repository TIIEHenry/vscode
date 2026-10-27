---
title: "可见叶 lease after：只读输入与历史保护边界"
type: index
status: accepted
phase: M7
updated: 2026-10-27
summary: "固定d8e/f33与R3原件的只读输入已获root采纳；记录wire、三生命周期与三Minor约束及E历史metadata失败，不准备工具、不运行、不改变accepted合同。"
---

# 可见叶 lease after 的只读输入

本页是已经完成的只读调查与 root 决策的证据记录，不是新方案、工具、执行配置或运行结果。[现 accepted lease 合同](../../plans/conversation-visible-lease-recovery.md)保持；旧 L1 业务 red、新13矩阵、原 Reveal 回归与非作者默认编辑器 after 在本工位仍未达。组件 green 本身也不释放 after 准备或执行；未来工具须原 Astra peer / root 另行释放，由唯一非作者 baseline 执行。本轮留在 E 的固定 parent `d8e6f1c1a546bab726d17b5b7cda0c6ba319b3d3`，src `923acdffaf236f826bc9d2e69d924159aa217ac0`，不 ff / 同步 merge，不消费移动 HEAD 或其他工位 WIP。

## 来源、决策与导航

| 入口 | 来源与资格 |
| --- | --- |
| [R3 实际 after](../default-editor-contract-audit-2026-10-26-evidence/r3-actual-after.md) / [正式集成边界](../default-editor-contract-audit-2026-10-26-evidence/je-formal-integration-verification.md) | 固定 d8e Git 对象；R3 是既有 unary after，不是本 lease after。 |
| [R3 E 完整 archive](../default-editor-contract-audit-2026-10-26-evidence/r3-e-evidence-sealed.tar.gz) / [durable manifest](../default-editor-contract-audit-2026-10-26-evidence/r3-durable-artifact-manifest.json) | 本作者内存读取 archive，读取原工具 / 日志并重算 bytes / SHA；未提取执行或写工具。 |
| [壳冒烟 §3.1](../../../docs/guides/shell-smoke-verification.md#31-受控引擎after的隔离与观察) | 固定 d8e/f33 字节相同；独立空 profile/home、fake 前实际 main 核验、真实退避观察的既有规范。 |
| [本轮 docs 起点](docs-start-observation.json) / [终点与范围保护](docs-end-preservation.json) | 本轮新增直接观察；仅保护本次 docs 区间，不能补前轮缺失起点。 |
| [旧 aggregate guard 的字节镜像](old-accepted-docs-preservation.raw.json) | 原 `/tmp/vscode-e-visible-lease-accepted-docs-preservation.json` 的901B镜像，FS mode `0o664`；历史声明不回写。 |
| [文档门禁记录](docs-validation.json) / [health 原始输出](docs-health.json) / [生成列原始输出](generated-status-check.log) / [diff 原始输出](diff-check.log) | 仅本轮 docs generator / health / diff；不是 source/runtime 验证。 |
| [行动检查点](../sources-accept-post-read-authorization-checkpoint.md#e-lease-after只读输入落盘与历史保护边界2026-10-27) / [分工看板](../../parallel/active/sources-accept-post-read-authorization.md#e-lease-after只读输入落盘2026-10-27) | 当轮导航与原 status 首条的含LF全文 / hash。 |

只读调查由 `/root/response_recovery_executor` 在固定 d8e/f33 完成。root 随后直接消息报告：root 与原 reviewer `/root/architecture_audit`（Astra）完成输入决策审查，**C0/I0/M3，root 全部采纳**，并仅授权本次纯 docs 落盘。该审查结果与下面三条 Minor 的来源是 **root 直接消息转述的 reviewer/root 决策**；本目录没有对应完整 raw peer 文件，不能伪作独立 raw 报告。作者此前分析报告属于会话直接报告，同样不伪作运行原件。只读推导、R3 已发生事实、本轮 fresh docs 观察三者分开登记。

## 真实 wire：空 probe 与 roster `2004`

固定 [Catalog wire](../../../src/vs/platform/universeAgent/node/grpc/grpcCatalogUnaryWire.ts) 的 `encodeProbeRpcRequest():115` 返回空 protobuf；`encodeListSessionsRequest():122` 默认 filter=ALL(4)，真实 `listSessions({})` 编码为 **`2004`**。[连接服务](../../../src/vs/platform/universeAgent/node/universeAgentConnectionService.ts) `:2621–2647` 的原 loopback 无 token 路径先 Connect，再空 List 确认 skip-auth，再空 List 探测能力，之后才提交 Connected；无需新增 token 或猜 ordinal。

R3 两个 lifetime 原 `fake-io.jsonl` 都实际记录 `HealthCheck → Connect(080210024802) → List(空) → List(空) → roster List(2004)`。第二 lifetime 的 Resume / SessionEventStream handshake 可早于 `2004`；故 Connected、空 List 成功、已订阅 stream 都不代表 catalog ready。未来 gate 只能针对该 lifetime 中实际收到的 `2004` 请求，逐请求记录 raw bytes / lifetime / held 标识 / ack / cancellation；空 probe 保持立即正常回应。**20s 从 actual held 开始算，超时记录失败，不自动 release**。这是未来工具约束，本轮没有实现 callback、控制文件或 server。

R3 原始 I/O：第一份25218B / `8d77f0f23d33f4aa3581c8965b73129db8e13a3c373fd3cd7a8642fd14782ebe`；episode2为7413B / `39ddf8f8edec8a7a65087a7cf16db745ae7cc054cf40e411e962456e80940287`，均在 archive 内。R3 server 只有一个 session 且 List 立即完成；原 driver 每次 inspect 的 `frameViews` 还 acquire/dispose 独立 observer lease，**不能直接复用为本任务合格观察器**。

## 三个真实 transport lifetime 的证据界面

下述是已审查输入对未来工具的限制，不是已写剧本或可执行预期，也不提供准备 / 运行授权。

1. **L1 初始空**：固定 s1/s2 同源 catalog，合法 hello / 空 overlay，使两真实 Pane 的 own lease 存在但 timeline / pending 均空，避免 nonempty KEEP 把 lease 留下。公开 `revealSessionWindow(s1, {replace:'untitled'})` 后 `openSessionBeside(s2)`；等真实 Pane 打开，对其现有 input 用公开 `group.pinEditor(input)`，核 `isPinned(input)`。默认 EditorParts 的 `openEditor(defaultInput)`不会自动 pin。再公开 reveal s1，确认 active/focused=s1、两叶 visible；至主恢复完成不再 reveal / switch / focus / connect / restore。
2. **L2 自动恢复**：真实停止 server1、socket 缺席后启动独立 lifetime server2；只 hold 实际 roster `2004`。server2 **全部 SessionEventStream 帧（含 hello / 空 overlay）**都先保持未发送，log 分别记录握手、账内 published 与实际 stream write。先观察自然 Connected/new link、catalog loading、同 owners 的两份 own lease 自然 undefined；旧 own lease disposed、内容仍空。若自然 missing 不成立，保原采样 / 失败，不私清字段补条件。releaseCatalog 后 ready notice 仍 active s1、active event delta0，同一同步 notice 可恢复 s1/s2 own lease；两份 own lease 恢复证据完成后才允许发帧。之后两 session 各自独有 body / pending 必须同时落入 ownsnapshot、timeline、DOM 与实际截图。
3. **L3 hidden 负控 / 公开 restore 正控**：完成 L2 后公开 hide s2，保留同 owner、hidden/suspended/missing；第三独立 transport lifetime 再经历真实 handshake / `2004` hold / release 的 ready notice。s2 只读观察仍 missing/suspended，旧 lease disposed 且不收 frame；结合公开同步 notice 边界与轮询、Pane guard 源码说明负控，**不声称 private acquire/bind 调用0，不 wrapper、不加 observer lease**。随后仅用公开 restore s2。第三轮 s1 与 restore 后 s2 都要用 **第三轮新且 session 独有 body / pending**，逐 ownsnapshot / timeline / DOM / 截图确认，不能 KEEP 旧正文冒通过。

每个 lifetime 的 Connect engine identity / workDir / session catalog 同源，防止换 episode 同时偷换引擎或会话。Resume 仅对实请求 s1/s2 成功；如返回 root_agent，其 ID 与本 session envelope.agent_id 一致；未知 ID fail closed。未来证据须 **Create=0** 与真实 session 路由日志，不能让未知会话创建掩盖 bind 错误。Resident Chat opens 与 Chat write payload 分开记，不能把打开 resident channel 当用户写入。

## 同 owner、双方 own lease 与事件因果

观察器可用自己的只读 WeakMap ID 冻结 part / group / input / Pane / `pane.activeConversationLens`，并读 resource、boundSessionId、pin、visible / hidden、DOM session 与矩形；不能把 getter 返回的对象替换或写回产品。两 owner 在断连、loading、ready、帧后与 hide/restore各窗口都核同对象。own lease 只从实际 Lens 读取；可订阅该 lease 的公开 `onDidApplyFrame`，不能调用 acquire、requestResync 或 whenBindReady 来改变取证条件。

初始不仅要核 lease sessionId 分别 s1/s2、未 disposed / 未 suspended，还要核真实 snapshot `timeline.length=0`、`pendingActions.length=0` 与 target DOM 无正文 / pending；不能混入本地 Untitled stub seat。自然 missing 必须发生在既有 [Lens Binding](../../../src/vs/workbench/contrib/conversation/browser/conversationLensSessionBinding.ts) 空内容 / not-ready 清 lease 的真实路径；静态源码支持该链，**当前没有本 lease after 的自然 missing 实测**。

真实 Roster `doRefreshEngineCatalog():2000` 先 listCompleted=false，await List 后置 ready；保留 active s1 时 `activateEngineSession():1013` 不发 active-change，`:2056` 同步 fire session(s1)。新 [Pane guard](../../../src/vs/workbench/contrib/conversation/browser/conversationEditorPane.ts) `:253–267` 不按 notice ID 过滤，只在当前 input/Lens 存活且 bound一致、visible、未suspended、缺 own lease、UA live/非pairing、Roster ready 时沿现 bind恢复。因此同 s1 notice 可恢复两个 bound session。可在 Pane 建立前 / 后分别注册公开 roster listener，夹住同步 notice并记录 ownlease 前后、active事件delta0与 connection事件序号；不可发客户端事件或改内部listener。

own lease 对象身份与共享物理 host lease ID 分开。s1 的物理 host lease 可能由 Roster 自己已有持有者保留，不能要求它必然换号；恢复前后两 Pane 的 **own lease 对象与正确 session**才是主证据。Disposed Lens 被变量保留时字段不保证清空；hidden负控读当前 Lens 的 missing/suspended，退休 lease 只核 disposed / snapshot与公开frame计数不再变化。组件 L4 允许的额外 observer 不适用于真实 after。

## 合法 frame 与第三轮账本（原 Astra Minor 全采纳）

固定 [Session attach wire](../../../src/vs/platform/universeAgent/node/grpc/grpcSessionAttachWire.ts) 与 [demux](../../../src/vs/platform/universeAgent/node/sessionStreamDemux.ts) 的字段如下；数字是 protobuf tag，值另写明。

| 内容 | 合法字段 |
| --- | --- |
| Stream handshake | session_id=1；protocol_major=3 值2；minor=4 默认0可省略。 |
| SessionStreamEvent | session_id=1；hello=10；envelope_appended=20；runtime_overlay_snapshot=44。 |
| hello | session_version=1；head_seq=2；runtime_epoch=3；last_mutated_from_seq=4。 |
| appended | seq=1；session_version=2；envelope=5。 |
| MessageEnvelope | id=1；session_id=2；seq=3；role=7（assistant值2）；agent_id=8；turn_id=10；blocks=17。 |
| 文本 block | block_type=1 值1；text_block=2，其 text=1。 |
| overlay / permission pending | overlay runtime_epoch=1、重复pending=6；pending request_id=1、kind=2 值1、tool_name=3、description=4、agent_id=5。 |

纯 append 的 **session_version 跨三 lifetime 固定值1，last_mutated_from_seq固定0**；只把每 session seq/head 递增，epoch可1→2→3且不回退。提高 version 也会触发 bootstrapResync，不能把纯append随意写成版本递增。两session的 envelope / turn / request ID、正文和pending描述独有。releaseFrames是 **每session持久release状态**；late attach要取得 hello→matching-epoch overlay，并用 GetHistory 从 **实际请求cursor**读取seq大于cursor的合法页、正确页尾，不能把一次release当仅广播现有stream。

已采纳的账例仅说明约束：L1 v1/head0/e1；L2 release时hello v1/head0/e2，之后各自seq1正文/pending；L3保seq1，s1hello v1/head1/e3后追加seq2。s2 hidden时server可记账seq2，公开restore late attach hello head2/e3，history依据实cursor取回。server账内published与实际streamwrite分别记录；s2 hidden时账有新内容不等于它已收帧。Minor1第三轮新body/pending、Minor2公开状态负控、Minor3持久release/版本/lateattach账本均为root直接消息采纳，无本轮实现或验证信用。

## 隔离、观察预算与 owned cleanup

在打开 server1 前，须从实际 Electron main inspector 读 PID、`process.env.UNIVERSE_AGENT_HOME`与所需argv，并用`/proc/PID/stat` startticks交叉核对；不能只信launch JSON。实际user-data、extensions、shared-data三目录都属于本次独立run，命令有`--new-window`、无`--agents`；空seed与独立home需确认，home当前用户所有/0700/非symlink、socket/lock缺席。使用默认编辑器；不使用正常test profile、日常目录、50061或真实引擎。这里只记录已审查输入，不写本轮启动命令或配置。

真实 connection与SessionEventStream两层退避都是base1000ms、指数、cap30000ms、±20%，故 **最长单timer36s**；discovery health deadline800ms，普通unary默认30000ms。**90s仅未来取证的整体观察预算，不是产品保证或总重连上限**；按事件/条件周期保存采样，超时保原失败，不自动connect/reveal。2004 gate的20s从actualheld计，不因budget到期自动release。R3原61早采样在fake2 ready+11704ms仍未Connected，923ms后才自动HealthCheck（ready+12627ms）；该失败不能回写成功。

每个lifetime记录server PID/startticks、socket bind/ctime、上一拥有进程退出与socket缺席、真实stream握手/取消/写入与reconnect序列；inode数值可复用，生命周期证据优先。未来held callback取消、stream cancelled/error/close、timer清理与forceShutdown均需记录。只在PID/startticks仍匹配时signal，只清仍匹配本次socket的路径；不unlink未知残留。结束核main/Xvfb/server及拥有descendants全停、独立profile/home清理，保存原错误/早采样及日志，不广扫同UID environ。所有公开事件订阅结束dispose，始终不额外acquire观察lease。

## R3 固定工具来源与 loaded 边界

所有下列R3成员均来自固定d8e所含archive，不来自可能变化的D live `.build`；archive为9077551B / SHA-256 `0caefd78492d7ead5e4527107ecaf40dfa4d9edee1e4603df2040bcbea6baeab`。本轮没有写出或运行这些工具，表内hash不授予修改后新工具资格。

| archive member | bytes | SHA-256 |
| --- | ---: | --- |
| `E/fake-uds-engine.cjs`；episode2副本相同 | 12018 | `1f3fba2627eb1927cac11549071bbc6c25748495067c673b53d020ccc9b824b9` |
| `E/driver.cjs` | 13095 | `35e712003c0978f0cc5f08f2156581ddcd0dd52e95d4c0710ed6450308f6fa23` |
| `E/probe.cjs` | 4520 | `97e38839211cff52a146169e0a2ccefdfdf501e850927feeb7df444adf521cb1` |
| `E/setup-two-panes.py` | 1837 | `7b65c7abb28d90f795d4c9cb071a93f9674374f3881d261efc366dca0fa744b0` |
| `E/transport-control.py` | 3852 | `9f68aec07a66f13d2c88ff57260377f668a31a7ad02b3133db77cb6fa167f609` |
| `E/run-transport-new-link.py` | 4757 | `4a787b1e57b6e6d1f49c3432365fde65535bee7321c9d3d8a4c4c1dccb2ae03f` |
| `E/run-transport-new-link-continuation-after-delayed-readonly.py` | 7128 | `640f63a166cba48e719cf40247a803014127b3cd267214b68b4802d9483bdad9` |
| `common/gate.cjs` | 1926 | `2ee7e9711910e283ed07ec09d31cf3be6ce7a70ad4a5d1aef2c7cd4dc57e7753` |
| `common/gates.py` | 16820 | `8bf14be1d91c41893bed7a8c1d81af75f8182e11a1365607dd0bcac0bb523f88` |
| `common/launch_runtime.py` | 3521 | `fc06a682531a627f96205ac071d8e932bf7f043d5039929e2ea9426a311b7a87` |
| `common/read-main-runtime.cjs` | 1784 | `63568166e39c75b8dcd450750a692e925230cd9329ac0ef76c1ba26ce16dc609` |
| `common/cleanup-owned.py` | 4194 | `7adcdebcab0c297d3d58f57cdd890b938fd833d5b7c30245245fd3d40930a3c0` |
| `common/collect-runtime-assets-final.cjs` | 7694 | `9c0d852c748ada816e18631a89f992c64184f6e7acb40adce0d9a1c9c0e42ef7` |

Tracked d8e/f33 [launch.sh](../../../.agents/skills/launch/scripts/launch.sh)同为13417B / `b992e3bb946320664979afd2f820d268873b84beae3a6d97953e55849e11bac6`，Git blob `ff8503efb1bd885ec52d6cee1d291fb9d1983c37`；其waitForCdp.ts为2193B / `e26e6a0de10fc56626588252e1d75efb7e8bd2179c79bb88172bec3c80ca6658`。此为固定Git工具身份，不冒称R3原运行曾额外封存并验证其运行时字节。

固定d8e/f33协议/源输入相同：Pane15270B / `90c0719d26183f27ae8e4fbcbead63d6f7e6c4aef64c1bbc39a898a65b1501d3`；Catalog wire37740B / `f2936fab2614f381a6ae51a478b928bafda76a85b9a198237cfe7e93b640f9b1`；Session attach wire55896B / `7c21429e5e1b04496c1a282774f6dff42cb9822c40df5d1cc81d0dec1e48b113`；SessionViewHost85066B / `b865f7437afc642e4cd7af47b3d975f296dc904207f19366bf9e6eb117d5929d`；Roster83773B / `20c867c00543b56fe57a04c0d4dcd67ba98cf2655f159b36fa922bcf766bf879`。

R3 `E/runtime-assets-final-E.json`为173465B / `5ca7155d676905c05aeb75bf97eb21289ae629c0a892ea3e2bb27fbe9797fb59`：实际124 renderer JS＋1 CSS，13 manifest-only。node discovery / connection / grpc client与wire / SessionViewHost均为manifest-only；renderer CDP不能证明main加载，完整test outputs也没有renderer loaded credit。R3实际loaded Pane的source SHA为旧`51cfc03a3be5dc2077c30e4a4ba72ca57b150a71c5a5649239087a0d339fcc65`，不是本次`90c0719d…`。

未来唯一baseline的新冻结须绑定实际source/native与renderer scriptParsed/getScriptSource：EditorParts / ConversationEditorPart、WindowService、Pane、Lens/Binding、Roster、FrameSource、Timeline。main成员如需loaded credit，另收真实main inspector scriptParsed/getScriptSource；未观察者仍manifest-only，不强制import制造loaded。截图证明实际窗口/目标DOM，不代替ownlease身份或loaded字节；空白初始、双方恢复前、分别新正文/pending、hidden、第三轮s1与restore后s2各保真实JSON+截图。本轮无新freeze、截图或module-loaded观察。

## E `.build` 历史 aggregate mismatch 与前轮退出

以下是本作者前轮已向root报告、且本轮root直接要求留证的历史观察摘述。来源是会话直接报告/已报告tool trace excerpt，**不是本轮fresh扫描倒推**；没有可补造的完整raw tool transcript。本目录只镜像确实存在的旧901B guard，未补造前轮delivery/preservation文件。

旧guard记录f33：out14865 / `25b6963a5ea5af29a6e9556a8c959ee65b8ab4a8566e48b031d8959265535601`，`.build`416 / `f407a3fe5ef16c79808ea2ab1a74f6171c5d554374829d0427896e146cfc3ccb`，node_modules47159 / `fedada5fe2fcdb0b1ede2ee404c7cf27f02d839ad797f8d33eec1d1fe963d124`。其原mtime为2026-10-27 05:06:17.900639 UTC（mtime_ns `1793077577900638925`）；901B / SHA-256 `dc4af6eed340f47c935246c7b1889924c41966777575d2d091b4618ac7e0d5d3` / FS mode `0o664`。旧schema为路径含目录前缀、不含root inode的sorted descendant tuple，mode/size/mtime_ns/ctime_ns/symlink target，排atime。

前轮d8e末扫描报告out与node_modules分别精确匹配旧hash；`.build`仍416项，aggregate变成 **`787cf7f760de1904a4765ea9721b7082564a12d4777f9c7cb27d9dc2fc1b0c76`**。根cache/eslintcache/node_modules cache当时仍缺席。末次guard **exit1 / AssertionError** 后提前退出，**未生成narrowing delivery与preservation JSON**。已报告trace excerpt仅能保留这些退出事实，不能复原未保存的完整stack/脚本文本，也不能把后续本轮fresh文件当它们。

前轮额外报告：旧guard时间后ctime较新的`.build`项仅发现`.build/log`，full mode `0o100664`，2B内容`[]` / SHA-256 `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`，mtime_ns=ctime_ns=`1793082885390322213`，2026-10-27 06:34:45.390322 UTC，早于所报告7361 commit的07:21 UTC。**没有旧逐entry tuple，也没有前轮开始时的current快照**，故这些事实不能证明完整差异集、写入actor或整个差异归因。本轮不修`.build`、不改旧guard或归因actor。

原作者static/docs原件不覆盖；[fresh起点](docs-start-observation.json)逐项保存它们的bytes/SHA/mode/mtime/ctime，终点再核。本轮fresh schema明确使用symlink target或null，独立声明，不拿其新aggregate冒称旧schema修复或历史连续性。

| 历史原件（仍在原 `/tmp`） | bytes | SHA-256 |
| --- | ---: | --- |
| `vscode-e-visible-lease-narrowing-static.json` | 3010 | `f840195eeef94d98c906c5adcfbd9e65c7c47c2f59b53fd19f3c2cc1ddcb5457` |
| `vscode-e-visible-lease-narrowing-eslint.json` | 1479 | `815853049c542fe00ce61d4af024005504f5f9d8e7d1ea2db2a169c955c63b84` |
| `vscode-e-visible-lease-narrowing-docs-health.json` | 12908 | `a66300ce26977b0a8341e9473041385b6a54207275d55a5cbead274222d025f4` |
| `vscode-e-visible-lease-narrowing-docs-health-f33.json` | 12908 | `a66300ce26977b0a8341e9473041385b6a54207275d55a5cbead274222d025f4` |
| `vscode-e-visible-lease-narrowing-docs-overlay.py` | 1138 | `609fba8143660b947345d2ad7f25ff897a4419b2e3900988b52430d3febe1862` |

本轮fresh开始/结束只界定此次docs区间；完整src仍固定d8e，Pane/Reveal与所有其他生产/测试、三个Sources plan/原JSON/历史证据保护。没有新AST/lint/Program/checker/emit/tests/server/browser/engine/out/cache操作，不修改accepted after合同、不升PRD/旧D/波状态，也不发工具准备或执行release。
