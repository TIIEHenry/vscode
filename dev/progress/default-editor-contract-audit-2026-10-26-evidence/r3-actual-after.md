---
title: "R3 J/E 默认编辑器真实 after：已签收的证据与保留边界"
type: reference
status: accepted
phase: M7
updated: 2026-10-27
summary: "J67/510与E75真实after已独立签收；持久化两份完整封存和主要control，保留两次E observer失败、canonical边界及旧残留，不改产品或方案状态。"
---

# R3 J/E 默认编辑器真实 after

本页持久化 root 已独立签收的 **J/E 局部实际 after**。本次提交只增加证据镜像与入口；D1387、两份窄方案和波次的最终状态由基线另行统一登记。PRD 不升档，旧 D 项和宽方案不因本页自动关闭。此前各轮失败、旧 seal 和库存原文保留。

## 可在仓库内复核的交付

| 完整原始封存 | 字节 | SHA-256 | 成员范围 |
| --- | ---: | --- | --- |
| [J archive](r3-j-evidence-sealed.tar.gz) | 10715849 | `eba7ee63112928d4dbc5c27fed46c886dbdabcbc60bb1ed7edeab3e1d89f3e0b` | 486 原件 + inventory，共 487 regular members |
| [E archive](r3-e-evidence-sealed.tar.gz) | 9077551 | `0caefd78492d7ead5e4527107ecaf40dfa4d9edee1e4603df2040bcbea6baeab` | 615 原件 + inventory，共 616 regular members |

[独立 durable manifest](r3-durable-artifact-manifest.json) 逐项列出 94 个镜像的 `originalPath`、`repositoryPath`、bytes、SHA 和 mode。两份 archive 含全部原始失败、JSON、PNG、loaded copies 与 lane 原件；没有把 615 个 E 成员逐个展开入仓。92 份主要 control 位于 `r3-actual-after-controls/`。无 frontmatter 的原始 Markdown 报告、原始脚本使用 `.raw.txt` 保存，字节未改；raw control 中的历史绝对路径和 archive 内 member 名保持原样，可通过 manifest 和 archive 定位。

主要接受入口：

- J：[phase-complete](r3-actual-after-controls/J/phase-complete.json)、[父独立 seal 核验](r3-actual-after-controls/J/seal-independent-verification.json)、[matrix](r3-actual-after-controls/J/matrix.json)、[510 条断言](r3-actual-after-controls/J/assertions.json)、[原始报告](r3-actual-after-controls/J/J-RUNTIME-REPORT.raw.txt)。J completion SHA 为 `3bdd49ea1623a535544c4c79d59e22a1068dd98b3a71f7567a04cf9689ab3186`。
- E：[root 独立接受](r3-actual-after-controls/E/root-independent-seal-acceptance.json)、[phase-complete](r3-actual-after-controls/E/phase-complete.json)、[matrix](r3-actual-after-controls/E/matrix.json)、[断言与脚本结果](r3-actual-after-controls/E/assertions.json)、[原始报告](r3-actual-after-controls/E/E-RUNTIME-REPORT.raw.txt)。接受 SHA 为 `04f0188b57f933990eef6895be43581fb8f003845f021e35a0eb269ecfb789da`；completion SHA 为 `3333231703b7146a6ad8b02444c6f2b51f529802c75ad399dec874df44f2dfda`。

这些是旧 seal 以外的后置接受记录。archive、inventory、报告、matrix 和 stage 中历史的 `awaiting` 字段未回写。root 已独立流读 J/E 全部成员，逐项核对安全路径、唯一 regular member、原件 bytes/SHA/FS mode；没有 symlink 或不安全 member。

## 源码、native 与 lane 身份

冻结 source 为 `7ffe4d9869a0caea76bab537d8d49f08e0776ecd`，src tree 为 `a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`。J/E 共享 common138，完整 full254；共享 canonical digest 为 `cf5b11a06613d2bf6b3df5dc5516212d535b158ddc5b7aeacd2a8a56ffc08900`，mixed-lineage digest 为 `c274e054889f59f9940a5156949b0641c8ec863b352a1a143aa2b76382a4be34`。见 [freeze-J](r3-actual-after-controls/common/freeze-J.json)、[freeze-E](r3-actual-after-controls/common/freeze-E.json)、[full freeze](r3-actual-after-controls/common/full-freeze.json) 和 [lane provenance](r3-actual-after-controls/common/lane-provenance.json)。

- **252 + 2 混合来源**：252 个 native 与 compile10 的精确 source/native 输入连续；另 2 个 Lens test 由 `test-refresh-e7c246315db7` 新 emit。compile10 producer/source 为 `db0981fca4f555176b5735a7055dd40242fbbb9a`（src58b3，exit0/0TS）；test emitter candidate 为 `e7c246315db77aa8277775338522bb9a1cb8ff84`，实际 emit/test source 为 `8ad5164da61fbfea94023d42c7be5c72071ec299`，src tree 与最终 a2c 相同。
- **`fullCompileOfFinalSourceTree=false`**：不称最终整棵源码已全量编译。真实 after 前后所有 254 路径的 native/source SHA、Git blob、源 tree、FS mode 与 Git executable-bit mode 均核验。
- **新旧测试范围分明**：new10 实际只运行 Roster.test 的指定 response-recovery grep，10/0；ReadingColumn.test 的 3/0 属于另一进程。两份刷新后的完整 Lens suites 为 317/0。历史 J lane 仅继承 28 个声明的精确连续输入，不继承 whole old E11 或 loaded-module 结论。本次证据包装未编译、emit 或重跑这些测试。
- **实际 loaded 与 manifest-only 分明**：J/E 各观察到 124 renderer JS + 1 CSS；13 项只保留 manifest provenance，完整 test outputs 也不获得 renderer loaded credit。CDP CSS raw 编码不同，但完整 windows1252 inverse 恢复全部 175386 native 字节至 `828212ceaf9d6457edc2de7896c8c801829c6e900c99766ea7106256ba5ce956`，683 条 CSSOM rule 逐字相等。没有打开菜单后的 glyph 渲染验收信用。

## J 实际 after

J 共 **67 个实际快照、510 条断言，0 失败**，覆盖 15 个实际 UI 行、2 个历史精确输入 provenance 行与 1 个隔离行。M01 的准确范围是 **1 个真实 Conversation → Preview Pane 按钮 + 4 个公开 Move 命令 = 5 条可达 owner 移动路径**。J 没有引擎 RPC。

J 的初次 cleanup 观察器曾过宽读取同 UID environ，遇 4 个预存非拥有进程的权限拒绝；[原失败](r3-actual-after-controls/J/cleanup-independent-verification-attempt1.failure.json) 永久保留。精确 PID/startticks、最早拥有根之后的 scope 复核通过，没有产品重跑。15 个拥有生命周期全部停止，profile/J home 移除，fixture 与旧 seal 字节不变。

## E 实际 after 与最终负控

E 有 **75 份实际 JSON+PNG**：74 个既定快照与独立只读 61a；真实默认编辑器，1440×900、Dark Modern、两个实际 Pane groups 8/9。8 个模板执行行通过，canonical timeline-only clientTool 保留 1 个 **BOUNDARY**，不授予该项 UI credit。13 次场景 orchestrator 调用为 11 成功、2 次保留的 observer 失败；没有伪造未集中计数的逐 assert 总数。

- permission/question/clientTool 的 false/reject 六组均实际出现双 Pane busy、普通第二 Pane duplicate blocked、busy 期间只有 1 个 unary、就地失败和可重试；retry payload 字节相同。false 用实际 focus+Enter 重试，reject 用普通点击。问题原 Pane 保留 Alpha/custom 草稿；成功在 authority publish 前变成双静态 Answered。
- 同会话并发 A 的失败、重试、成功不清 B 的 busy/failure/pending。真实停 fake1、观察 socket 消失、用相同 fake 字节启动新进程 fake2；同一 main/profile 自动 link1→2、scope4→6，未用公开 recovery。numeric socket inode 被复用，只以生命周期和 bind 时间证明更换。
- 最终公开 disconnect 后，**3 个真实 cached target、2 个不同实际 Pane 各 3 条 target timeline** 都实际存在；permission 仍 pending，没有假 Allowed/Skipped。70 的普通权限点击实际被 disabled 阻挡，71 question 和 72 clientTool 的响应控件真实缺失，分别记录 absence boundary。69–73 的 cached/public/pending/timeline/projection 逐值相等；响应 unary delta0、Chat write delta0。见[最终 negative](r3-actual-after-controls/E/disconnect-negative-live-precondition-continuation-result.json)。
- 两个 fake 完整 lifetime 的原始 pre-lookup Received trace 与全部 unary/handshake 交叉核对：**43 calls、19 response unary、2 resident Chat opens、0 Chat write payload**；GetQueue0、SaveSkillContent0、unknown0。19 响应按 Respond8 / RespondQuestion5 / SendClientToolResponse6 分布。见[完整 trace 汇总](r3-actual-after-controls/E/grpc-full-lifetime-summary.json)。未用真实引擎。
- E 的 13 个 main/Xvfb/descendant 生命周期加 2 个 fake 生命周期均停止，0 owned live；profile/E home 移除，J home 没有重建，fixture 不变。见[独立 cleanup](r3-actual-after-controls/E/cleanup-independent-verification.json)。

两次 observer 失败保持原件和 SHA：

1. [61 原失败](r3-actual-after-controls/E/transport-new-link-failure.json)：fake2 ready+11.704s 的观察真实未连接；923ms 后收到自动 HealthCheck，在 ready+12.627s 开始自动 HealthCheck，随后完成握手，符合独立源码审查的最长单 timer36s。61a 独立只读补观察证明实际新绑定。经 root 明确授权，[独立 continuation](r3-actual-after-controls/E/run-transport-new-link-continuation-after-delayed-readonly.raw.txt) 首次执行 62–65；[AST 证明](r3-actual-after-controls/E/transport-continuation-assertion-preservation.json) 原 9 assert 未变，新增 5 个身份/时序 assert。
2. [66 原失败](r3-actual-after-controls/E/disconnect-negative-driver-failure.json)：把断连后的 cache/timeline 校验误用于 live pending-only 前置；实际 public3、两 Pane 各 pending3、6 个 enabled seats 都存在。未重 emit 或重跑 66；经独立源码审查与 root 授权，[新 continuation](r3-actual-after-controls/E/run-final-disconnect-continuation-after-live-precondition-review.raw.txt) 首次执行 67–73。[静态证明](r3-actual-after-controls/E/disconnect-continuation-static-check.json) 确认 target() 源码/AST 及全部 69–73 验证逻辑完全保留，断连后仍严格要求非空目标与零写入。

root 的只读 reader 对 argv/environment、optional responseProjection、FS mode 与 Git mode 的初次误读及纠正，也保存在[父只读补充](r3-actual-after-controls/E/root-posthoc-readonly-review-notes.json)等 control 内；没有修改原件或产品来消除失败。

## 保留边界与状态责任

- canonical-only clientTool 不授予 respondable，未用 pending seat 代替；捕获的 stale callback/lease 是 new10 **core-only** 证明，没有在 UI 私注 callback。
- clientTool step38 的 Enter 前真实 focus 在 enabled Respond button，动作后为 BODY，既有 **Minor** 保留。global `sendClientToolResponse` CANCELLED 文本仍在 60–73 捕获的 body 中，与 local failure、空 uiErrors[] 分开记录。
- §24 缺 lease Important 候选、reasoning/Accept 历史红、D1356/D1357/D1359 的旧状态及其他历史缺口不由本页关闭；本轮最终负控仅为 §25 原假 Allowed 触发条件提供新冻结下的实际验证。
- 不整体关闭 `sources-changes-diff` 的 F4/F5 或提升 PRD-009，不复活 D1385 的产品执行前提。D1387 与两窄方案的状态由主基线结合最终独立审查另行收口。本提交不改 status、plan、PRD 或知识层。
