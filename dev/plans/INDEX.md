---
title: "方案索引"
type: index
status: accepted
phase: N/A
updated: 2026-10-06
summary: "未开启工具搜索时保留历史搜索结果的方案为 draft。聊天流缺失时的权限失败方案为 draft。删除旧明文 connect() 的代码已落，方案仍 draft。已发布链路身份方案为 draft。Sources 文件列表按广告探测的方案为 draft。对话入口按广告探测的方案为 draft。连接 IPC 白名单代码已落，方案仍 draft。未指定地址并进私网拒绝的代码已落，方案仍 draft。恢复信任新尝试已落在编排器，方案仍 draft。Agents 窗口登记引擎连接服务的方案为 draft。远程链路 S1–S4 已落。sources-architecture 保持 accepted，P7 已落。Accept 暂存 hunk S1 已落、方案仍 accepted。打开身份 S1–S4 已落、方案仍 accepted。Preview 两级标签仍 accepted。十六路审查切片已落（7cf1474419e），方案仍 accepted。对话阅读面方案 accepted。Sources Git 写能力方案为 draft。对话框与引导页遮罩去毛玻璃代码已落，方案仍 draft。视觉审查问题收口方案 accepted。不升 PRD-028。"
---

# 方案

方案文档放在本目录。完成后就地保留；任务排期与勾选见 [dev/progress/status.md](../progress/status.md) **Next** 段。

<!-- generated-col id="plans-index-status" source="plan-frontmatter-status" column="状态" key="first-link" -->
| 方案 | 状态 | 摘要 |
| --- | --- | --- |
| [未开启工具搜索时保留历史搜索结果](r15-5-tool-search-history.md) | `draft` | 谓词缺省时历史工具搜索保留 toolsMap 里命中的工具；这次请求没有工具搜索且组不出工具时，保留原文，不换成空的 tool_search_output。方案保持 draft。不升 PRD。不宣布 r15 完成。 |
| [聊天流缺失时权限回复不得假装成功](r12-permission-reply-fail-closed.md) | `draft` | 没有聊天流时权限回复返回拒绝并留下可再点的失败；后到的普通补洞继续并进已有重写丢弃范围；纪元前进清掉未写出的权限决定时同样留下可再点的失败。方案保持 draft。不升 PRD。 |
| [remove-legacy-plaintext-connect.md](remove-legacy-plaintext-connect.md) | `draft` | ELR-14：删掉连接服务和窗口契约上的明文 connect()，以及只为它服务的写死回环打开。命令名 connect 仍拒绝。测试改走无信任的明文 profile 或本机跳过鉴权。代码已落，方案仍 draft。不改身份合同。不升 PRD。 |
| [published-link-identity.md](published-link-identity.md) | `draft` | ELR-8：快照增加可选 engineIdentityId 与 linkId。换链路先断开再连，roster 按引擎身份分桶。全应用仍是一条连接。不改 ADR-003。不升 PRD。 |
| [sources-files-list-capability.md](sources-files-list-capability.md) | `draft` | Sources 文件列表的 listFiles 门闩改读快照 listFilesCapability。不进 Engine Overview。不重做 conversationEntryCapability 与 gitWriteCapability。不升 PRD。不宣布 ELR-13 全部完成。 |
| [conversation-entry-capability.md](conversation-entry-capability.md) | `draft` | 对话里用 typeof 连接方法决定入口的门闩改读快照 conversationEntryCapability。不进 Engine Overview。不重做 gitWriteCapability。不升 PRD。 |
| [connection-ipc-allowlist.md](connection-ipc-allowlist.md) | `draft` | ELR-12：连接 IPC 改为白名单，宿主方法、connect 与回调流不对窗口开放；Hub 使用 universeAgentHub 通道并仍打到同一连接实例；宿主 token 用适配器；桌面 Team 三元调用补上嵌套对象过不了 ProxyChannel 的缺口。代码已落，方案仍 draft。不升 PRD。 |
| [unspecified-address-private-denial.md](unspecified-address-private-denial.md) | `draft` | 未勾选 allowPrivateNetwork 时，直连与 Hub 中继在写入 resolvedIp 之前把 IPv4 0.0.0.0/8 与 IPv6 未指定地址 :: 并进既有私网分类器。失败码仍是 private_network_denied。loopback 目标形态不过闸。代码已落，方案仍 draft。不改已签收方案正文。不升 PRD。 |
| [recover-trust-new-attempt.md](recover-trust-new-attempt.md) | `draft` | ELR-3 剩余半边已落在编排器：身份就绪时先重新观测、中继各续一次票、再握手，指纹一致且拿到 session_token 才写信任。身份未就绪仍按连接服务测试锁住的批准即写信任。方案仍 draft。不改连接服务。不升 PRD-024。 |
| [sessions-window-connection-registration.md](sessions-window-connection-registration.md) | `draft` | Agents 桌面与 Web 入口侧载与对应工作台相同的 IUniverseAgentConnection 登记。Changes 与布局不再因服务未注册而起不来。不新开连接，不升 PRD。 |
| [sources-git-write-capability.md](sources-git-write-capability.md) | `draft` | Stage / Commit / Accept 看连接快照 gitWriteCapability，不把桌面代理函数当成已广告的 WriteGit*。不进 Engine Overview。不升 PRD-009。 |
| [live-stream-bytes-decode.md](live-stream-bytes-decode.md) | `accepted` | 2026-10-05 S1 剩余已落：turn_completed 解出 turn_id 与 assistant_turn_id，仅当前 turn 才 hold clear；overlay field 7 与 join 嵌套 37、根上 field 23 已接。S4/S5/S6 此前已落。不升 `implemented`。不升 PRD-008。 |
| [connection-dial-generation.md](connection-dial-generation.md) | `accepted` | 2026-09-19 用户签收：!tls 禁 this.connect()；失配不写提交集；pairing 第一行闸。不发明字段。S1–S5 已落，方案仍 accepted。 |
| [conversation-bound-session.md](conversation-bound-session.md) | `accepted` | 2026-09-19 用户签收：绑定叶不跟 roster、Kill 自写叶祖先查询、Reveal 对可见叶。不实施 pills S3w。S1–S5 已落，方案仍 accepted。 |
| [sources-review-open-identity.md](sources-review-open-identity.md) | `accepted` | 2026-09-19 用户签收：S1 一条序列；reveal 读已打开 tab；fail 仍交 pane 不 mark。不重开 A2。2026-09-28 勘误：sources-git-diff 须先有内容提供者。S1–S4 已落（2026-09-30），整稿不升 implemented |
| [conversation-timeline-session-pills.md](conversation-timeline-session-pills.md) | `accepted` | pill 与叶级 SessionBar 代码在仓（`conversationSessionPill` / `leafSessionBar`）；方案仍 `accepted`，不升 `implemented`；S3w 为方案 C |
| [conversation-chrome-visibility.md](conversation-chrome-visibility.md) | `implemented` | D403/D404 已闭；Maximize 不 hide gate/Stop/整槽 timeline；SAS 切 tab 不 dispose，窄 Back 留高并 trap Tab |
| [prd-008-engine-e2e.md](prd-008-engine-e2e.md) | `accepted` | PRD-008 唯一已定义升档路径：隔离 profile + 钉死引擎 + D4 CDP；硬前置 GC-1b 配对回路（首次配对即第一份证据） |
| [test-baseline-ci.md](test-baseline-ci.md) | `accepted` | D16 账本 + `agent-ide` workflow（四 job **已关**，见 DISABLED.md）；三域账本外新红阻断合入；`min_cases` / `max_skipped` 防空跑 |
| [packaging-and-release.md](packaging-and-release.md) | `accepted` | `gulp vscode-linux-x64` 验 `@grpc/grpc-js` 进包 + 活窗；无窗 asar [D388](../roadmap/active/d388-packaging-p1-asar-machine.md) 已闭（未提交）；无窗 Linux-deb [D389](../roadmap/active/d389-packaging-p3-linux-deb-machine.md) planned（prepare-deb 三次 sysroot blocked）；无窗 vscode-web [D390](../roadmap/active/d390-packaging-p2-vscode-web-machine.md) planned（直接 CLI 16g/32g 仍 OOM，dest 未写）；D18/D20/D12 仍开 |
| [giant-file-split.md](giant-file-split.md) | `accepted` | GFS-1–4 结构已在仓；grpcClient / timeline / lens / session-actor 按状态机·投影·IO 拆；GFS-4 每文件 800 硬上限；行数门未当闭合，不升 `implemented` |
| [docs-burden-reduction.md](docs-burden-reduction.md) | `implemented` | INDEX/traceability 状态列脚本生成（S1 一次接通；门禁改本地 health-gates）；status 单一真相；术语对外可读 |
| [cross-repo-protocol.md](cross-repo-protocol.md) | `accepted` | G-ENG/NAV/REV/G3 扩消息 vs G2 session-core 对引擎仓提案清单，每行有闭合条件；D1 docs-only 修正登记处过时句 |
| [prd-020-turn-fixture-bench.md](prd-020-turn-fixture-bench.md) | `accepted` | 1,000 回合 fixture 测 PRD-020 验收 1：Dock 提交 → 探针 user 行（含 16 ms 帧合并）p50 ≤ 200 ms；升格前先钉 requirements 操作化 |
| [m0-topology-surgery.md](m0-topology-surgery.md) | `implemented` | M0 壳代码已落；compile/演示/EH deferred |
| [m1-shell-followon.md](m1-shell-followon.md) | `implemented` | M0 之后三切片：四钮 chrome、Conversation 透镜、Sources Files 投影 |
| [m2-product-shell.md](m2-product-shell.md) | `implemented` | 无引擎产品壳剩余面：透镜产品化、Chat/Aux 卫生、文档诚实 |
| [m3-shell-closeout.md](m3-shell-closeout.md) | `implemented` | 可选壳收尾已落：ChatEditor 默认路径藏/转、Navigator stub 会话列表 |
| [m4-validation-wave.md](m4-validation-wave.md) | `implemented` | D3/D4/D5 closed；D3 valid-layers 环境红仍记 D2 脚注 |
| [m5-ui-shell-hardening.md](m5-ui-shell-hardening.md) | `implemented` | 切片 1–5 @ 18b5e8d7；D4/D5 closed；valid-layers environment-blocked（Node v26.7.0） |
| [m6-engine-wave.md](m6-engine-wave.md) | `accepted` | A1–A2/B/D 已落；C 已落 Skills/Agents/MCP/Tools 读写主体与正文编辑，九节 UI 余量转 M7；PRD-008 仍须冒烟才升 `implemented` |
| [m7-ui-completion-wave.md](m7-ui-completion-wave.md) | `accepted` | UI 主线代码已落（P0–P2b / E2 / Q / CS / I2–I5 / K/T/L1）；W1 冒烟已跑（D15 closed）；I6 发行标识未完；V 槽测试债非阻塞；不升 `implemented` |
| [session-view-frame-fanout.md](session-view-frame-fanout.md) | `implemented` | F1/F2 @ `c37bbc6e` / `917a7f8d`：`onDynamicDidApplyFrame(leaseId)` + 宿主首帧缓冲 + `postAndDrain`；G-CORE-1 已登记；F3 见 D22 |
| [session-subscription-lifecycle.md](session-subscription-lifecycle.md) | `draft` | lease 所有权回收、流级重开与 bind 有界化；S1–S3b 已合 `b2211b23fa5`；规则 16 回溯审查已做（2026-09-14）；S4a 已合入；S4b 闩只在连接 down 清（2026-09-20 snapshot 回归测）；仍 draft：§5 手测（D405） |
| [m7-gap-closeout.md](m7-gap-closeout.md) | `implemented` | GC-1–GC-6 @ merge `d98d888a`：hubDevice/配对、设备动作与 probe、catalog 观察 lease、Navigator/Inspect、Overview Model；PRD-024 仍待真 Hub 冒烟；D21 |
| [engine-preferences-completion.md](engine-preferences-completion.md) | `accepted` | E2-1–E2-7 **代码已落**；GC-6 Model 摘要已落；Overview Provider 行已省略（G-ENG-1 前不显示）；产品验证未做 |
| [client-settings-completion.md](client-settings-completion.md) | `accepted` | CS-1–CS-6 **代码已落**（9 键 + 迁移 + 七组无 emptyCopy）；PRD-026 §6 产品验证未做 |
| [conversation-ui-closeout.md](conversation-ui-closeout.md) | `accepted` | Q1–Q6 **代码已落**：Overview、DetailRef 六态、compacted、live fold、四 kind 停止洗白、键盘 ARIA、窄宽度；产品验证未做 |
| [product-identity.md](product-identity.md) | `accepted` | I2–I5 / I3a / I3b **代码已落**；I6 Darwin/Appx 发行标识等发布方；D18 安装包未验 |
| [accessibility-responsive-ui.md](accessibility-responsive-ui.md) | `accepted` | K1/K2/T1/L1 与 B/A 合同切片 **代码已落**；W1 已跑（`d15-evidence/w1-1556dde3`，D15 closed）；方案仍 `accepted`；D19 已闭 |
| [conversation-stream-timeline.md](conversation-stream-timeline.md) | `accepted` | M6 时间线专章：**S1–S6 代码已落** @ `a64caf1c`–`5104678e`；**G2/G3** 上游缺口仍记 §6；PRD-008 未升 `implemented` |
| [sources-changes-diff.md](sources-changes-diff.md) | `accepted` | PRD-009 / ADR-005：F1–F3 代码在仓；F4 隔离 profile 冒烟未跑（D31）；PRD-009 升档仍绑 F4 |
| [connection-hub-client.md](connection-hub-client.md) | `accepted` | Hub Client 接入：**H0–H5 已落**；**GC-1b/2/3** 配对/设备动作/probe 已落；**H6** GUA 直连仍 v2；H4a 真 Hub 冒烟 / PRD-024 `implemented` 未签收 |
| [navigator-engine-segments.md](navigator-engine-segments.md) | `accepted` | PRD-022：**N1–N4 已落**；**GC-5** Inspect/Team 读取态已落；**N5** 隔离 profile 验收待冒烟；缺口 G-NAV-1 / G-NAV-2 |
| [sources-review-progress.md](sources-review-progress.md) | `accepted` | PRD-023：**R1–R4b 已落** @ `05007b60`–`f1065288`；**R5** 验收 + 知识层待冒烟；缺口 G-REV-1 |
| [sources-accept-empty-success.md](sources-accept-empty-success.md) | `draft` | A1 拒空仍有效。2026-09-25 推翻 P5 停线：真 Accept 见 sources-accept-stage-hunk。本稿不升 accepted。D31 F4 仍开 |
| [sources-accept-stage-hunk.md](sources-accept-stage-hunk.md) | `accepted` | 2026-09-25：Accept 暂存光标 hunk。客户端切单个 hunk，argv 为 git apply --cached。S0 的实施位置改为 sources-architecture P1。S1 已落、方案仍 accepted。不升 PRD-009 |
| [sources-architecture.md](sources-architecture.md) | `accepted` | 2026-09-28 签收。SAR-1…8。P6 与 P7 已在 loop/merge 落。P7：命令 id、Diff 守卫只比 type id 与 scheme、归因按路径且每会话 500 条。方案保持 accepted |
| [composer-fake-chrome.md](composer-fake-chrome.md) | `accepted` | D194 出口选定「删」：无 voice/transcript/route capability，不门控不接 RPC；S1 四刀已落 `4156c6528f1`，本稿回补方案层与复开门禁 |
| [chat-compare-split.md](chat-compare-split.md) | `implemented` | PRD-011 并排比对已落；D4 已验 |
| [page-access-schemes.md](page-access-schemes.md) | `implemented` | 切片 1a–5 已落；M7 不重开混合宿主、同 token 与 Navigator 拓扑 |
| [settings-two-surfaces.md](settings-two-surfaces.md) | `implemented` | 两主面边界 + C5/H0–H3 已落；Engine E2 / Client CS 代码完成线见 M7 方案（仍 accepted） |
| [customizations-host-ui.md](customizations-host-ui.md) | `implemented` | H0–H3 donor chrome @ `77d6e7cc` |
| [customizations-engine.md](customizations-engine.md) | `accepted` | E1 已落 Skills/Agents/MCP/Tools 读写主体；九节宿主由 M7 E2-1–E2-7 承接（代码已落） |
| [product-requirements-layer.md](product-requirements-layer.md) | `implemented` | 建立本仓产品需求 SSOT |
| [conversation-trajectory-lens.md](conversation-trajectory-lens.md) | `implemented` | PRD-012 T1–T3 + **T4** @ `5104678e` + **T5** 搜索/虚拟化 @ `94267eef`；Overview / DetailRef / compacted 由 M7 Q1–Q3 承接（代码已落，产品验证未做） |
| [conversation-process-fold.md](conversation-process-fold.md) | `implemented` | PRD-013 P1–P3/P3t @ `19f3e7ba`–`42fa941e` |
| [thinkrail-visualize-port.md](thinkrail-visualize-port.md) | `implemented` | PRD-014 T1–T3 @ `5cad7c3b`–`0eb470f2` |
| [conversation-empty-hero.md](conversation-empty-hero.md) | `implemented` | PRD-015 T1–T6 @ `ea0104c0`–`d4064ba0` · [canvas](conversation-empty-hero.canvas.tsx) |
| [conversation-session-windows.md](conversation-session-windows.md) | `implemented` | PRD-016 S1–S6 @ `569ce371` |
| [conversation-session-bar-down.md](conversation-session-bar-down.md) | `accepted` | 会话栏下一级列出直接子代理；根上无父 fork 算孩子；窄宽与上一级一起留在栏上。不升 PRD。 |
| [conversation-reading-surface.md](conversation-reading-surface.md) | `accepted` | 对话阅读面不显示 You / Agent；非 default 代理名 11px；用户气泡无描边无投影。不升 PRD-028。 |
| [sessions-chat-composer-glass.md](sessions-chat-composer-glass.md) | `draft` | Agents 窗口追问卡去掉毛玻璃和投影；输入聚焦只换 focusBorder。无只读审查，不升 PRD-028。 |
| [modal-mask-no-glass.md](modal-mask-no-glass.md) | `draft` | 对话框与引导页遮罩去掉 backdrop-filter，半透明底色与浮层投影保留。2026-10-05 代码已落，方案仍 draft。不升 PRD-028。 |
| [preview-category-isolation.md](preview-category-isolation.md) | `accepted` | PRD-027 / ADR-011：两级标签，2026-09-28 签收；显隐与路由同一次合入 |
| [conversation-timeline-refactor.md](conversation-timeline-refactor.md) | `implemented` | v3.2 一次性重构（2026-09-28 已获用户明确签收并建立 ADR-010）：动画帧调度（16ms 兜底）+ 隐藏只停宿主 DOM + effects 接发送失败并回填文本 + 投影按输入身份缓存 + 宿主侧按 turn 的 H1 交接；原生文档流宿主（content-visibility、窗口化含未决座位、重资源预算），删除树与测高；marked 词法块冻结；HEAD 解锁语义 + 自身写入台账 + 发送上锁；性能挂 PRD-020 |
| [remote-link-auth-and-relay.md](remote-link-auth-and-relay.md) | `accepted` | S1–S4 已落：调用挂 Bearer；被拒或不可用先摘掉再换链路；Hub 首配逐段签票，已交出的票离开拨号缓存。不升 PRD-024。 |
| [方案 r01：base](review-2026-09-30-r01-base-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。五条均 hold：解压路径须落在目标内，尾点 rename 不得误删源，存储打开、关闭恢复和迁移须在写入确认前保留原数据。 |
| [审查 r01：base](review-2026-09-30-r01-base.md) | `draft` | base 中解压可写出目标目录外，失败的重命名会删源，存储打开、关闭恢复和迁移会在写入确认前丢掉原数据。 |
| [方案 r02：editor](review-2026-09-30-r02-editor-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。tree-sitter 编辑终点只按新文本以 0 基 UTF-16 推进；字面 \\n 软换行去掉双引号门槛，simple 与 advanced 共用行首也成立的奇数反斜杠判定；折行括号竖线仅在可见列不在首个折行片段时改横坐标。 |
| [审查 r02：editor](review-2026-09-30-r02-editor.md) | `draft` | tree-sitter 增量编辑终点算错，字面 \\n 软换行会漏，折行后括号引导线横坐标未换算。 |
| [方案 r03：sessions](review-2026-09-30-r03-sessions-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。多聊天审批、解析中的配置记忆、Agent 写入目标和分栏恢复仍要改；提交后被清掉的是用户文件，Changes 与 Files 在默认单栏会重开。 |
| [审查 r03：sessions](review-2026-09-30-r03-sessions.md) | `draft` | 多聊天的审批写到组内第一个会话，解析中的选择会被记住，提交和恢复时布局会错位。 |
| [方案 r04：entrypoint](review-2026-09-30-r04-entrypoint-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。修正连接令牌 cookie 覆盖、未鉴权的 delay-shutdown、许可证环境变量、Web UI 绑定地址日志和 IPv6 桥接 URL。 |
| [审查 r04：entrypoint](review-2026-09-30-r04-entrypoint.md) | `draft` | 连接令牌、自动退出、许可证环境和监听地址有 5 处会在特定请求或启动条件下出错。 |
| [方案 r05：tooling](review-2026-09-30-r05-tooling-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。收紧浏览器单测文件桥的仓库根边界，模块加载失败和页面崩溃改为非 0 退出，workbench 源码变更重生成扩展点清单，Node 单测把未处理拒绝计入退出码。 |
| [审查 r05：tooling](review-2026-09-30-r05-tooling.md) | `draft` | 浏览器单测会把模块加载失败和页面崩溃当成通过，文件接口不限制仓库路径；增量构建不随 workbench 源码重写扩展点清单；Node 单测吞掉未处理异常后仍以 0 退出。 |
| [方案 r06：chat](review-2026-09-30-r06-chat-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。发送被接受前保留编辑中的队列与检查点；工具确认只认本会话已记录的权限和本回合；本地队列在没有默认 agent 时不出队。 |
| [审查 r06：chat](review-2026-09-30-r06-chat.md) | `draft` | chat 在编辑队列、本地重发、后台工具确认、回合恢复和队列出队上会丢消息或跳过确认。 |
| [方案 r07：conversation](review-2026-09-30-r07-conversation-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。发送在途只清仍等于已提交文本的草稿；已打开的子代理标签直接激活；MCP 错误启动要结束队列；URL 授权在无请求或取消时收口；部分根搜索失败不当作完整列表。 |
| [审查 r07：conversation](review-2026-09-30-r07-conversation.md) | `draft` | 会话草稿、导航揭示、MCP 启动与授权、来源文件树有五处会丢内容或卡住。 |
| [方案 r08：terminal-debug](review-2026-09-30-r08-terminal-debug-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。Run to Line 在被继续线程再次停下时才删临时断点；多会话按 Verified 记任意暂停；重跑只补 Map 里缺的变量；测试先保存再启动。runCommand 不把空输入改成发 Ctrl+C。 |
| [审查 r08：terminal-debug](review-2026-09-30-r08-terminal-debug.md) | `draft` | Run to Line 会拆掉临时断点或继续错线程；重跑任务漏掉新变量；测试在保存前启动；忙终端上的 runCommand 把命令写进前台进程。 |
| [方案 r09：contrib-rest](review-2026-09-30-r09-contrib-rest-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。剪切标志只在路径与剪切集合一致时才移动，并在取消剪切时清掉；笔记本全部匹配装饰保留 webview 序号 0。 |
| [审查 r09：contrib-rest](review-2026-09-30-r09-contrib-rest.md) | `draft` | 剪切后的原生粘贴会移走源文件，快速搜索高亮错位，笔记本第一条输出匹配高亮被丢掉。 |
| [方案 r10：workbench-shell](review-2026-09-30-r10-workbench-shell-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。空数组不再吃到 stable 未设置实验的全放行；另存为先确认再替换并在失败时还原；文件不存在的还原保持脏和备份；磁盘写入失败不再改编辑器缓冲。 |
| [审查 r10：workbench-shell](review-2026-09-30-r10-workbench-shell.md) | `draft` | stable 上缺失的 proposed API 实验会放行全部提案；另存为、还原和代理写入会丢掉用户内容。 |
| [方案 r11：agent-codex](review-2026-09-30-r11-agent-codex-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。回放按 userMessage 切开；附件 steer 按发出文本认领；截断与 fork 用完成后仍在的 host→codex 映射；动态工具以 success 与 failed 判失败。 |
| [审查 r11：agent-codex](review-2026-09-30-r11-agent-codex.md) | `draft` | 回放丢掉同一回合里较早的用户消息；带附件的中途插入对不上原文；steer 与 fork 之后截断对不上 turn id；失败的动态工具被记成成功。 |
| [方案 r12：agent-host](review-2026-09-30-r12-agent-host-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。聊天流已关时提交与权限事实不再被接受；延迟重写的丢弃范围不被后到的普通补洞盖掉；epoch 前进时已排队的权限决定留到快照再收；MCP 认证取消后仍把工具失败写回等待中的 handler。 |
| [审查 r12：agent-host](review-2026-09-30-r12-agent-host.md) | `draft` | 聊天流已关但连接仍在时，已接受的用户消息和权限决定会被丢掉；并发 hello 还会让重写后的历史停在旧内容上。 |
| [方案 r13：platform](review-2026-09-30-r13-platform-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。非空损坏的 state 与可解析密文的解密失败不再覆盖原数据；热退出备份改名失败保留原条目；代理配置账号失败后仍进入登录对话框。 |
| [审查 r13：platform](review-2026-09-30-r13-platform.md) | `draft` | platform 层在状态文件损坏、密钥解密失败、热退出备份改名失败和同步本地备份清理时会丢掉已有数据，代理凭据第二次认证会被直接取消。 |
| [方案 r14：copilot-extension](review-2026-09-30-r14-copilot-extension-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。免确认只收紧会静默改 git 的四条命令；补丁整文件替换；历史缺结果仍留助手文本；外置路径留未读说明；模糊匹配只接受唯一最近位置。 |
| [审查 r14：copilot-extension](review-2026-09-30-r14-copilot-extension.md) | `draft` | 命令免确认会改 git 状态；补丁会改错位置或留下旧行；历史轮次和子代理文件引用会被丢掉。 |
| [方案 r15：copilot-core](review-2026-09-30-r15-copilot-core-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。并行工具按 index 归并且不撞已有 id 流；function_call 缺参、SSE 已完成事件收尾、Anthropic 非法参数各补一条不丢数据的路径。未开启延迟加载时的空 tool_search_output 保持现有 spec。 |
| [审查 r15：copilot-core](review-2026-09-30-r15-copilot-core.md) | `draft` | 聊天补全流会把并行工具参数拼错、function_call 缺字段会直接中断，SSE 收尾与工具搜索结果也会丢掉。 |
| [方案 r16：extensions](review-2026-09-30-r16-extensions-plan.md) | `accepted` | 2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。五条均 hold：登录写回须合并当时的会话列表，gitfile 仓库的 rebase/merge/cherry-pick 须读 git-dir，暂存选区按行边界取并集，blame 用修改后行号判断是否越过 hunk。 |
| [审查 r16：extensions](review-2026-09-30-r16-extensions.md) | `draft` | GitHub 登录写回会盖掉其他窗口的会话；worktree rebase、按选区暂存和 blame 行号会写错 Git 状态或标错提交。 |
| [十六路审查 2026-09-30](review-2026-09-30.md) | `draft` | 2026-09-30 用户签收。十六份方案 accepted。2026-10-01：切片已落（7cf1474419e），方案仍 accepted，不升 implemented。第二轮后 hold 57、weaken 17、drop 3。 |
| [ui-gap-closeout-2026-10-01.md](ui-gap-closeout-2026-10-01.md) | `draft` | UI 缺口收口：Changes 写闸、焦点环、配对框绑窗、诚实态与 Sessions 残留。status draft。不升 PRD-008。 |
| [自有界面视觉审查问题收口](visual-audit-remediation-2026-10-05.md) | `accepted` | 八项已确认问题分切片：窄宽裁切、焦点、Light+ 对比度、Sources 密度、减少动态；Customizations 窄模态先实测。 |
| [loopback-link-commit.md](loopback-link-commit.md) | `draft` | ELR-10：本机自动连接改经拨号提交闸。未签收。不升 PRD-008。 |
| [local-engine-trust-anchor.md](local-engine-trust-anchor.md) | `draft` | ELR-11：代码已落，方案仍 draft。本机自动连接只信同一用户可读的引擎 home 锚。未签收。不升 PRD-008。 |

上表只收本目录顶层方案。2026-09-24 自有代码缺陷扫描的方案在 [bug-hunt-2026-09-24](bug-hunt-2026-09-24/INDEX.md)，已签收，不进生成状态列。
