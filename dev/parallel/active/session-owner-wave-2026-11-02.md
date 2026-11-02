---
title: "会话删除与绑定归属并行修复"
type: progress
status: active
phase: M7
created: 2026-11-02
updated: 2026-11-02
summary: "独立 merge 验证基线；A 删除确认与草稿、B Create 与 bind 归属；唯一编译执行者，保留既有 WIP"
---

# 会话删除与绑定归属并行修复

状态：执行中。负责：agent:codex。范围：默认编辑器会话删除与绑定的归属隔离；历史完成标记不作当前证据。

## 基线与启动裁决

- 产品集成分支为 `agent-ide`，遵守[本仓工位特例](../../progress/worktree-pool.md)，不对齐上游 `main`。
- 固定源码基线 `b99dc5cdf525be5f1d695ffdbe5a560e5d6d31ea`。2026-11-02 fetch 后 `origin/agent-ide=98aa1b2140fea195c2de055f34f3192fa87c9218` 是其祖先；本地领先 111 提交、落后 0，保留已提交历史，不 rebase。
- Astra 只读审查批准本次两项启动例外：主工作区已有 WIP 不清理；允许先创建仅验证/修基线的固定 merge 槽。字母槽仍须等待完整 compile 绿。
- 主工作区保持原分支与修改。启动快照在仓外 `/home/clarence/Projects/Agents/vscode-WorkTrees/.coordination-20261102/main-before.json`、`main-status-before.z` 与 `main-before.patch`，含 81 文件 hash。既有 `ui-adaptation` 和 `/sdd/Projects/vscode-WorkTrees/` 工位不接管。
- 父代理只调度，子代理执行；实施者不自行裁定最终验收。取舍交 Astra。全波只有 merge 执行者持有编译测试通道，noEmit 也不得另开；不并行安装。

## 冲突域与槽位

| 槽位 | 分支与基线 | 独占冲突域 | 当前事实 |
|---|---|---|---|
| merge | `codex/merge`，固定源码基线 | 集成、D1393 唯一源码作者、唯一编译测试、共享 status/board/gaps | 合同 `084a5c73a13` 后由 audit_transport 单作者实施；19 TS 最终冻结，Astra 最终 OV PASS / CommitGate READY，D1393 已关闭；待主题提交与正常发布 |
| A | `codex/slot-a-delete-owner`，固定源码基线 | `contrib/conversation` 的 Sessions View、Lens Session Bar 与 `contrib/navigator` 的 Projects List，及三入口删除测试 | 主题本地提交 `465be859ff5`，已本地合入 merge、OV 通过；待 P6 ff-only 同步 |
| B | `codex/slot-b-session-owner`，固定源码基线 | `platform/universeAgent/node` 的 Create、singleflight/recovery、`sessionViewHost` 及测试 | 主题本地提交 `457aca93b19`，已本地合入 merge、OV 通过；待 P6 ff-only 同步 |
| 人类工位 | `agent-ide`，固定源码基线 | 既有 WIP 保全 | 不切分支、不清理；关仓仅尝试保留修改的 ff-only |

同域唯一写者，每域本波集成一次。各槽仅记录本主题知识与 status，和代码/测试同一实施提交；merge 真三路合成 A/B 两条 status，最终共享账由 integration 维护。验证与独立审查后，经固定 merge 槽本地集成，不从字母槽推远程；D1393 硬门关闭前不交付。

## Astra 修订后批准的实施边界

原说明经 Astra 判定 required revisions，以下必要修订全部采纳后架构 approved；追加 Navigator 第三入口的最终审查 C0/I0/M0 APPROVED。它们是现有缺陷修复的执行约束，不新建计划或进入 plan 模式。

### A：删除确认与草稿

三个入口复用 `conversationDeleteSessionConfirm.ts` 的局部 owner guard。删除动作捕获 local/engine 模式及 published link/identity。`pendingDeleteDrafts` 记录归属，所有恢复入口先比对；失配丢弃旧记录，不向新归属 write/apply。engine 模式要求有效 linkId，identity 允许 undefined 以兼容 loopback。Sessions/Lens 保留 local 行为，Navigator 不新增 local 能力。

确认框等待期间局部观察明确断开或 owner 变化，永久作废本次删除；无关 capability 更新不取消，finally 释放监听。View 使用 `_store.isDisposed`，Lens 通过 host 的 `isDisposed` getter。范围仅覆盖 renderer 已观察的连接/归属变化；expectedOwner IPC 协议的迟到窗口另行登记，不声称全链安全。

### B：Create 与完整 bind 链

真实路径为 `node/sessionViewHost.ts`。`_captureTransportOwner` / `_runOwnedTransport` 使用已发布 link+transport，Create 在入口微任务前捕获归属；singleflight 按 owner 域隔离，finally 仅清自己的 promise。Create/List/Resume 调用前、结果或异常后断言 owner，过期以 CancellationError 结算。

Host 的 bindGeneration 传入完整链，每个 await 后、下一 RPC 前、删除映射前检查未 disposed 且仍为当前 generation，保留末尾 commit guard；兼容恢复 callbacks 同样包装。

## 真实验证记录

- Node 为 `.nvmrc` 的 `24.18.0`。隔离依赖布局、唯一通道、串行 compile 参数与临时路径的复用方法见[构建指南](../../../docs/guides/getting-started.md#隔离-worktree-的依赖与单路编译)。Electron 声明为私有副本，out/.build 独立。
- 完整命令：`npm run compile -- --max-parallel 1`。本地 runner 已核支持，使 compile-client 与 compile-copilot 串行。
- 14:37:42（Asia/Makassar）首跑，14:37:47 exit 1：聚合 `extensions/node_modules` 未链接，`extensions/esbuild-common.mts` 无法解析 esbuild。仅补隔离前置。
- 第二跑 14:38:42 exit 1：`.vscode/extensions/vscode-selfhost-test-provider` 缺少隔离槽依赖，报 `istanbul-to-vscode`、`cockatiel` 及三条连带隐式 any。对照主仓目录，补齐已有嵌套依赖链接；未安装或修改生产源码。
- 第三跑完整 compile-client 与 compile-copilot 通过，exit 0；client 于 14:40:35 完成，源码 0 errors。仓外日志与退出码在 `.coordination-20261102/baseline-compile{,-2,-3}.log` / `.exit`。随后创建 A/B，两槽初始均为固定基线、clean；依赖链接与 Electron 声明已备，未运行各槽编译。
- **首次共享依赖写入纠正**：第三跑 Copilot 通过整目录链接写了共享生成包 `@vscode/copilot-typescript-server-plugin`；postinstall 也可写 `@github/copilot`。未改 tracked 源码；发现后将 merge 的 Copilot 依赖入口改为逐包链接，将这两个可写包复制为本槽私有目录，后续完整编译不再写这两处共享来源。首次运行前未做这两包 hash 快照，不声称共享生成包字节未变化。
- 已提交基线的官方 Node runner：`grpcSessionWrites.test.ts` 与 `sessionViewHostEngineBind.test.ts`，27 passing / 0 failing，exit 0；日志 `baseline-owner-node.log` / `.exit`。官方 `scripts/test.sh --run` 的 Sessions View、Lens Session Bar、Navigator Projects List 三套，98 passing / 0 failing，exit 0；日志 `baseline-delete-electron.log` / `.exit`，未排除用例。Electron runtime 复制到 merge 私有 `.build/electron`，`VSCODE_SKIP_PRELAUNCH=1`，不触发下载。上述只验证已提交基线，主工位未提交 WIP 不在范围内。
- merge 曾出现外部未跟踪 `dev/parallel/active/async-owner-isolation-2026-11-02.md` 与 `dev/plans/async-owner-isolation-2026-11-02.md`，均不是本调度产物，不读作本波方案、不覆盖、不 stage。后者未登记 INDEX 曾导致 docs-health 唯一 error；后续状态查询两文件已不在，本调度未删除或转移，未知作者是否终态。
- 文档检查：docs-status 单测 8/8；wiki check 首跑因本槽 dev/loop 未初始化报 28 errors，检出固定 gitlink `44a684b04fc41098f5aa1373812606ed251c0d13` 后重跑 0 errors / 337 warnings、exit 0。不改子模块源码或指针；外部文件不再出现在工作树后 docs-health 重跑 0 errors / 46 warnings、exit 0，后续仍需核实际提交树。

### A/B 候选验证

- A 首候选 8 份源码 hash 固定于仓外 `a-validation-source-before.json`。聚焦 ESLint 0 errors / 4 条基线已有 warnings，脚本 exit 1；compile-client exit 1、13 条真实新增诊断：Leaf Session Bar 未提供新 host `isDisposed`，以及 Sessions View / Navigator 两处 Deferred 确认结果传错 boolean。原失败日志保留在 `a-eslint{,-lens-test}.log`、`a-compile-client.log`。Astra 另发现 Lens false 分支同步切同 owner 新 surface 后仍写回旧 draft 的 I1，已在下一条修订关闭；首候选不作最终验证。
- A 修订候选 11 TS hash 固定于 `a-validation-source-2.json`；实施者补 Leaf lifecycle getter、两处确认结果对象、两个旧 fixture 的真实 owner/events，并收口 I1 同步切 surface。Astra 复审 C0/I0/M0；第二跑 compile-client exit 0；官方 Electron 的 Confirm、Lens、Sessions View、Navigator、ComposerEditDraft、LensDisposeGate、LeafSessionBar、SessionWindowReveal 八套 507 passing / 0 failing、exit 0。11 文件聚焦 ESLint 0 errors / 6 条基线 warnings（脚本 exit 1），其中 Leaf 的两条 querySelector 原在 blob `723eb9f877831ef76008c66e0a9c5625b0d3e434:110/145`。日志 `a-compile-client-2.log`、`a-eslint-2.log`、`a-delete-electron-2.log`；补知识/status 后 11 TS hash 未变。仅组件自动层证据，未做真实默认编辑器或引擎验收。
- B 固定 6 份源码 hash 在 `b-validation-source-before.json`，补知识/status 后复核源码 hash 全相同。compile-client exit 0，官方 Node runner 三套 `sessionCreateRecover` / `universeAgentConnection` / `sessionViewHostEngineBind` 共 660 passing / 0 failing、exit 0。聚焦 ESLint 0 errors / 1 条基线已有 warning，脚本 exit 1；Astra 六文件独立只读 C0/I0/M0。日志为 `b-compile-client.log`、`b-owner-node.log`、`b-eslint.log`；后续主题本地提交及合入见下条。
- 告警基线均为 `b99dc5cdf52` 原字节：Sessions View blob `82fbe6776dcad28d6cebf7cb462cfca6a68a83f3:501` 的 `"altKey" in browserEvent`（两条）；Sessions View test blob `097244baca43de763e0f8e870204b3efdd8d27c9:33/36` 重复 Strings import；Lens test blob `7f332d7544777cdbe051f5ca96f918efdcab4b1f:22/82` 重复 SessionView import；B Connection test blob `b32236303ec43b3b5511a3b64ae24458462adcac:15425` 的 `'reason' in lost.phase`。未将脚本 exit 1 写成 ESLint 全绿，也不为旧告警扩改本波范围。
- A 本地提交 `465be859ff5956adee11308e51c614092bb9a393`，13 路径，代码/测试/知识/status 同主题；B 本地提交 `457aca93b191e156dca4e60c1e9d03b99b1f8ae3`，8 路径，同样完整。首 A commit 被 hook 的 Git 环境污染误报 28 子模块断链阻挡；清仓库定位变量、保留绝对本槽 index 后原 pre-commit/commit-msg 完整通过，未跳钩子。原失败、重试及 hook 环境 JSON 在仓外协调目录，复用方式已入构建指南。

完整本地集成结果 `e578aaf4f28934b70f6d9981ef8ef0017b2d1b4b`：A 合并 18 路径、B 合并 25 路径的逐 mode/blob 三路保留均通过，17 份 TS 与已验候选 SHA256 完全相同；`merged-ab-compile.log` / `.exit` 记录完整 compile exit 0。隔离后的两共享 Copilot 包 208 文件 hash 在本次编译前后相同。不是已推送或产品窗口/真实引擎验收。

## D1393 交付硬门的历史与解除

Astra 初始核定 [D1393/P1](../../progress/deferred-gaps.md)：renderer 尚未收到 main 已换连接的通知时，删除仍可能落到新 transport。本波 A 只覆盖 renderer 已观察变化。证据与完整协议 slice 的退出条件在延期账维护；独立 session-delete owner 要支持有效 link+undefined identity，不能直接放宽其他 mutator 的严格 ExpectedOwner。

**历史数据损坏硬门裁决（现已解除）**：D1393 当时阻塞本次交付。允许 A/B 主题在独立验证后本地 commit、merge，真三路保留与完整 compile 绿；P5 / 正式 push 暂停。两槽不标 idle，不释放重占，merge 不标 parked，本波不关闭、不增成员。在绿 merge 由一名开发者串行完成 D1393，先写合同并经 Astra 只读审查，再改代码；同一验证者继续独占编译测试与共享文档/Git。D1393 闭合前不宣称误删全链安全，不将硬门切成下一波逃避。

## D1393 解除合同

固定六条合同已获 Astra C0/I0/M0 APPROVED，trusted 断连缓存窄兼容亦获批准并同步第 2/3/5 条；合同文档独立提交后才准实施。A/B 已本地集成到 `e578aaf4f28`，完整 compile exit 0，17 TS hash 保留；随后只由一名开发者在 clean 绿 merge 实施 D1393，integration 独占文档/Git/编译测试。

合同已提交为 `084a5c73a13e047bc646b3200485a734e8a50815`，交接瞬间 `git status --porcelain` 为空。父调度正式授权 audit_transport 独占 merge 的 D1393 生产/测试修改；integration 继续独占文档/Git/所有检查。该交接时尚未实施；后续候选与验证结果见本节末尾，D1393 在最终 OV 前保持 open。

修前输出已保存在仓外 `d1393-old-production-out`，13 个必要生产 JS 共 1,287,615 字节，来源提交与 hash 在 `d1393-old-production-manifest.json`。新测试就绪后使用本槽私有 `out-build` 快照覆盖旧生产模块，以官方 `node test/unit/node/index.js --build --run out-build/vs/platform/universeAgent/test/node/universeAgentConnection.test.js` 跑目标所在文件；runner 不支持 grep，不自制 Mocha 配置。必须定位具名 byte IPC 用例 `session delete ownership byte IPC: renderer A/main B never deletes B` 的旧业务结果 cancelled=false / B 收到原删除请求与新 cancelled=true / B 零请求；加载错误或新增 export 缺失不算旧红，其他新 API 在旧 runtime 的失败单列。真实 out 不覆盖，不新增 worktree，检查串行。

首候选 19 TS hash 已固定在 `d1393-source-before.json`。首 compile-client exit 1，仅一条新增 TS2322：byte IPC fixture 的泛型 call 返回推断不兼容 Promise<T>；开发者已窄修为显式 async<T>/Promise<T>，未改生产语义。重跑前 Astra 另发现 strict-shape I1：common validator 未拒绝沿原型的 identity，stub owner copy 可将继承 link 洗成合法；开发者继续修 validator 与回归。检查通道保持 quiet，等新冻结再完整重验，首失败日志 `d1393-compile-client.log` / `.exit` 保留，不计通过。

strict-shape 与两行 Reflect.has 风格修订后，19 TS hash 固定到 `d1393-source-3.json`；上一语义版 compile-client 第二跑 exit 0，刷新最终两 JS 的 transpile-client exit 0。最终版 common helper 6/0、Node 六套 700/0（含原 B）均 exit 0。真实私有对照阳性 614/0、阴性 604/10，10 败均为业务断言、零加载错误；具名 rendererA/mainB 用例旧 cancelled=false/B 收到 `{sessionId:'same-id'}`、新 true/B 零请求。证据在仓外 `d1393-red-green-evidence.json`，含实际 out-build 模块 URL、13 old/new/private hash 与目标失败原文；真实 out 12170 文件 hash 前后相同。首两次传 src 的 614/0 实际误选 realout，单列 invalid controls，不计旧红/新绿；路径前置已入构建指南。

历史首轮：浏览器十套首跑终态 exit 1，753 passing / 1 failing，唯一新失败 `session delete ownership: rollback reentry cannot notify or persist into B`：B 名册保留、failures 为空，但 changes 实际三个 same-id、期望空。已释放 roster 与其测试给唯一开发者，区分旧链污染和 B 自身合法切换通知，不直接放宽期待；其他源码仍冻结。当时 full compile/lint 暂停、D1393 继续 open，日志 `d1393-browser.log` / `.exit` 保留。

开发者只在失败用例加入临时 event stack 诊断；以仓库 `transpileFile` 刷新该测试 JS，官方 Electron `--grep` 窄跑 0/1 exit 1（11ms）。三条通知分别来自 QueueReader→bindLiveTreeObservationLease→onDidChangeActiveSession（B 新选择重绑定）、doRefreshEngineCatalog 发 session change、QueueReader→bindLiveTreeObservationLease→doRefreshEngineCatalog，均未经过旧 rollback 栈。与 Astra 静态诊断一致：B 自身目录/队列刷新混入观测。日志 `d1393-rollback-diagnostic.log`；待开发者用 B List DeferredGate 隔离，保留零旧通知/持久化断言并移除临时诊断，生产保持冻结。

1. **独立 owner 类型**：在 `common/universeAgentExpectedOwner.ts` 新增 `UniverseAgentSessionDeleteOwner`，只含 readonly `linkId:number` 与可选 `engineIdentityId:string`，配独立 is/assert helper。仅允许 own linkId 与可选 identity，不允许额外 key 或 `$mid`；link 为正 safe integer，identity 可省略/undefined 或非空 string。字节 IPC 可丢 undefined 字段，但省略 identity 仍必须严格等于 main 当前 identity，绝不作 wildcard。整个 owner 缺失、null、array、非法 link 均以 CancellationError 拒绝。入口校验后复制 scalar，不保留 caller 可变对象。现有 `UniverseAgentExpectedOwner`、Skills/Models/Memory 严格规则不变。
2. **三入口与 roster**：`ConversationDeleteOwner` 的 local/engine union 移到 `conversationStubService.ts` 导出，confirm 模块 type-import/reexport，避免服务依赖 dialog。`IConversationRosterService.deleteSession(sessionId, owner?)` 接此值；Session Bar（含 More）、Sessions View、Navigator 透传确认前捕获值，不重新 capture。纯 StubService 也拒显式 engine/malformed owner，仅合法显式 local 或 trusted omission 可本地删。EngineRoster 显式 local 仅 never-connected 可用，不得在引擎出现后升格；显式 engine 严格比当前归属、复制 scalar 后才改 optimistic 状态；省略仅 trusted 同步入口 capture。已连但无合法 link、配对保持均 false；显式 owner 遇断连历史一律拒绝。仅 trusted roster 省略 owner 且当前为非 pairing 的断连 engine 缓存时，保留 `callRemote=false` 的同步本地清理，零 RPC、不制造 live owner、不回填 stub，不适用于 IPC。
3. **Delete 全生命周期**：roster 持永久失效 guard，link/identity、明确 disconnect/phase/pairing 任何失效后，即使同 link 恢复也不复活；覆盖完整 `remoteDeleteSettled.then`，最后才 finally 释放。`dispatchEngineAction` 仅 Delete 传 optional current 谓词，send 前、success、failure/recover 前后检查；旧结果 false，零 rollback、零 onDidFail/onDidDelete、零新 owner 桶 persist。`deleteEngineSession` 在 dispatch/send 可同步重入之后、每次 fire 或可通知 helper 之后复核；`rollback(snapshot,current)` 在入口、通知前后、persist 前复核。旧结算不得删除/恢复新 owner 同 id 的名册、草稿或选择，不能只在函数首尾检查。trusted 断连缓存路径另捕获内部 `connectionGeneration`、`boundEngineIdentityId` 与断连状态，scope 失效永久锁存；重连、换桶、pairing 或 dispose 后不得继续，每次同步通知后复核，重入 B 即停止 persist/deleteEvent/rollback；正常路径保留同步 onDidDelete。
4. **连接与 IPC**：`IUniverseAgentConnection.deleteSession(request, expectedOwner?)` 使用独立 session-delete owner。ChannelClient 显式 forward 第二参，通用 proxy 不替换、不重新 capture。IPC 对 Delete 独立严格校验 args[1]，在 inner/revive 前拒缺失、非法、陈旧 owner，远程 omission 一律取消。node 显式 owner 必须先逐字段严格比较 main published link+identity，不能仅 shapecheck 后捕获当前值；比较→同步 `_captureTransportOwner()`→assert→RPC 之间无 await、无重抓，再由 `_runOwnedTransport` 对返回/异常复核。node 与 roster 对通过校验的 caller owner 均复制 scalar，调用者随后修改对象不得改写授权。trusted node omission 单独捕获当前 owner，显式 null/malformed 不等同 omission。远端 grpc request/proto 不变，web 仍 unsupported。
5. **验证闭集**：common 独立 helper 覆盖 malformed/link-only 严格匹配并证明旧 owner helper 仍拒 link-only。IPC 在 inner-dispatch 前拦缺失/陈旧 owner；真实 byte IPC 扣住 renderer A 通知而 main 已 B、同 session id，证明 B 零 Delete RPC，含丢 snapshot、同 wrapper 新 link、gate 后 main 切换；有效 owner 原 request 不变。node 覆盖 trusted omission/显式非法、晚 success/unavailable 取消且 B 健康不变。roster 覆盖 pending Delete 切 B 后旧成功/失败/往返恢复不删、不回滚、不通知、不 persist B；rollback/active-change 的同步 listener 切 B 后不续写。三 UI 证明 owner 透传、pure stub 拒 engine、local 保持，并保留 A 草稿回归。新增 trusted roster 断连缓存同步清理的重入 B 矩阵：名册、选择、草稿、persist 不被旧路径污染且 RPC 为 0；node/roster 的 caller 对象修改同样有 scalar copy 回归。
6. **范围与交付**：真实 UA Delete 生产链仅三 UI→roster→uaConnection；Agent Host/SDK/chatStore/上游 Sessions 的其他 Delete 属不同服务，不迁移。预计修改既有生产/测试文件，不加远端 proto、不另开计划。D1393 未实证闭合前 P5/push/关仓 hold；A/B 占用保持，merge 不 parked。wiki 工具环境缺陷另记 [D1394/P2](../../progress/deferred-gaps.md)，只记录和保留安全 wrapper，不混生产修复。

## 交付检查

- [x] 完整基线 compile 绿后创建 A/B。
- [ ] A/B 实施与定向回归，报告发现的既有代码问题。
- [ ] 独立只读审查；status、gaps、必要知识与实施一致。
- [ ] 主题提交、真三路合并与两边保留核验。
- [ ] merge 完整编译、受控 push、槽位同步；主工作区 WIP 比对。

开工 remind 历史 `[agent]` 警告不批量改写；提交按主题说明 `Docs-Reviewed`，不以文档进度代替运行结果。

启动时远程落后 111 个本轮之前已有的本地提交，发布须区分这段既有历史和本波新增 SHA，不将其统称本波开发。最终 D1393 综合 OV PASS、硬门解除后，父调度已明确授权正常 push 与 P6/P7；本地修复验收通过，待提交和正常发布。主工位 status 等文件存在 WIP，最终 ff-only 可能因重叠拒绝；届时保留原修改并报告，不改用清理或转移操作。

最终 roster 测试仅用 B List DeferredGate 隔离 B 正常目录续体，B 同步初始化后才 arm 旧结算观测，严格核 changes/failures 为空及 storage 不变，再 disarm 放开 B 正常目录；临时 stack 与原 queueMicrotask 窗口均移除，生产未改。目标 grep 1/0、roster 整套 213/0 均 exit 0；其余九套先前 541/0 的源码不变，不重跑、不伪造单次十套全绿日志。最终 19 TS hash 在 `d1393-source-4.json`，完整 compile 已 exit 0。

最终完整 compile（client+Copilot 串行）exit 0，19 TS hash 前后不变，共享 Copilot 两包 208 文件 hash 前后相同。19 文件聚焦 ESLint 0 errors/6 条基线原字节 warnings/0 新 warning，脚本 exit 1；逐 blob/原行分类在 `d1393-eslint-baseline-classification.json`。docs-health 0 errors/46 warnings、wiki 0 errors/337 warnings、generated status check 0、文档工具 8/8；diff-check 0。运行检查现均终态，无 live 句柄；Astra 最终综合 OV PASS，C0/I0/M1、CommitGate READY；M1 仅本页早期私有 runner 命令已改为实际 out-build 路径。父调度采纳，D1393 closed、P1 交付硬门解除；本地修复验收通过，待提交/正常 push 与同步，D1394/P2 保持 open。

## 实施发布与外部提交接收

实施主题 `f3705ba4da04fdb5538c70bdb0ca51e5fa7ac2ba` 已正常 push，后续 `ls-remote` 独立核实相同 SHA。此推送包含启动前已有 111 提交与本波 7 提交，不把既有历史算作本波开发。A/B 已保留原分支 ff-only 到实施 SHA。主工位在执行期间由外部增加 `4a5ab41de9e`（3 份写闸测试）与 `629d8b33df8`（计划状态），首 ff-only 因非祖先 exit 128；HEAD/状态未动、P0 全部 81 hash 保持。

父调度要求先安全接收外部两提交再关仓，已在 merge 无冲突真三路合为 `51e790607b0a6747e9c2550e605c42496e007673`，39 路径 mode/blob 门禁通过；外部仅 4 路径，与本波源码不交，未改其原断言。外部三个官方 browser suite 首跑 163 passing / 1 failing，唯一新增 Tools 用例 `a list refresh issued before a save lands cannot repaint the saved enablement` 期望 aria-checked=false、实际 true；新失败已报告，等待父调度与开发者/Astra 定位。完整 compile 已自然终态 exit 0，D1393 的 19 TS hash 全部保持。Astra 独核固定高度 WorkbenchList 的 `rerender()` 是 no-op，失败揭示既有 Tools 呈现债，未证实旧 list 越过代次闸；原断言有效、不删不改。按 health-gates 普通红测记入 D17 与 [D1395](../../progress/deferred-gaps.md)，不阻止保全外部提交的安全发布，不将失败归于 D1393。下一独立 Tools 主题修复；本波不扩生产范围。

同步时发现本仓默认 fetch 仅 main；今后显式更新产品 ref 的长期命令见[工位池](../../progress/worktree-pool.md#产品远端指针的实际-fetch-限制)。首次旧 tracking 值不作真实远端证明，push 回执与独立 ls-remote 证据保持。

## 恢复收尾核验（2026-11-02）

恢复时远端独立 `ls-remote` 仍为 `f3705ba4da0`，merge 为 `51e790607b0`，主工位 `629d8b33df8`；本仓无活跃编译或测试。C `cabefc81b36` 与 D `9d4719459aa` 为其他在途候选：C 另有两篇未跟踪计划，全部保留，未测试、未合入、未接管。C 不含 f370 的 D1393 全链修复，禁止整树或整文件覆盖集成线。A/B 只参加本波最终 ff-only。

Tools 的 163/1 原日志为 `external-s3-browser.log`，完整 compile exit 0 原日志为 `external-s3-full-compile.log`；39 路径三路保留门及外部四路径 hash 均已保存，恢复时再次核对 D1393 19 TS。S3 源码已落不代表该 Tools 用例通过；既有测试债与后续主题见 D1395。
