---
title: "M7 UI 完成波并行看板"
type: roadmap
status: active
phase: M7
updated: 2026-09-03
summary: "M7 UI 代码完成线已尽（P0–P2b / E2 / Q / CS / I2–I5 / K/T/L1）；槽位 idle；余 W1/I6/V；看板仍 active，不因缺测升 completed"
---

# M7 UI 完成波并行看板

> **父方案：** [m7-ui-completion-wave](../../plans/m7-ui-completion-wave.md)。
> **原则：** 测试失败进入 V 槽与 D17，不冻结不冲突 UI 槽；编译/启动、安全/数据问题按父方案硬阻塞。

## 工位

| 槽 | 当前任务 | 状态 | 文件所有权 |
|----|----------|------|------------|
| P | P0–P2b 代码已落 | idle @ `5c53e8ba` | `platform/universeAgent/**`（含新建 `browser/`）、`workbench.web.main.ts` / `workbench.desktop.main.ts` 的 UA 注册行、`connectionHub.contribution.ts` 中对 electron-browser 的 import（P0 一次性移出）、`engine-protocol-surface.md` §1b/§2、`universeAgentConnection.test.ts` |
| A | E2-1 … E2-7 代码已落（含 Web 按 phase/capability 省略桌面控件） | idle @ `5c53e8ba` | `enginePreferencesPane*`、`engine*Section*`、`engineCatalog.ts`、`engineSkillCatalog.ts`、`engineToolProfile.ts`、`engineAgentAgentsMd.ts`、`media/enginePreferencesPane.css`、`connectionPreferencesPane*`、`connectionPreferencesPaneLabels.ts`、`connectionPreferencesPaneSas.ts`、`uaPreferencesPanes.contribution.ts`、`connectionHub.contribution.ts`（除 P0 那一行） |
| B | Q1 … Q6 + CS-1 … CS-6 代码已落 | idle @ `5c53e8ba` | `conversationLens*`、`conversationLensDockStrings.ts`、`conversationTrajectory*`、`conversationProcessFold*`、`conversationTimelineTree*`、`conversationConfirmationSeat*`、`conversationQuestionSeat*`（Q5a 新建）、`conversationSubAgentOverlay*`、`conversationVisualize*`、`conversationSessionView.ts`、`conversationStubModel.ts`、`conversationStubService.ts`、`conversationStubFrameSource.ts`、`conversationEngineRosterService.ts`、`conversationRosterStorage.ts`、`conversationIdentityStrip*`、`conversationAccessibility.ts`、`conversationEditorPane*`、`conversationEditor.contribution.ts`、`conversation.contribution.ts`（chat tab 命令注册、通知 contribution 挂载）、`conversationNotifications.contribution.ts`（CS-3 新建）、`media/conversationLens.css`、`uaClientSettings*`、`settingsLayout.ts` UA 段、`settingsUaToc.test.ts`；`conversationPart.ts` 的 `focus()` 一处经看板转交给 CS-1 |
| C | I2–I5 / I3a / I3b / K1 / K2 / T1 / L1 代码已落；余 W1 冒烟、I6 等发布方 | idle @ `5c53e8ba` | `product.json`、`platform/product/common/product.ts` 回退、`platform/environment/node/userDataPath.ts`（开发态目录名）、`resources/**`、`build/**` 品牌产物与图标脚本、`workbench/browser/media/code-icon.svg`、`layoutActions.ts` 四钮键位、`workbench/browser/parts/conversation/media/ua-common.css`（T1 公共规则）、`contrib/sources/**` 中 K2 触及的文件（新建 `sourcesReviewCommands.contribution.ts`、`sources.contribution.ts` 的 import 一行、`sourcesReviewHostService.ts` / `sourcesTabsHost.ts` / `sourcesReviewList.ts` 为暴露选中行而做的接口扩展）、迁移入口 contrib（I5 新建，注册在 `workbench.desktop.main.ts`，不碰 P 的 UA 行）、`platform/product/common/universeAgentScheme.ts`（I2 新建，下沉 `UNIVERSE_AGENT_SCHEME`）、`contrib/welcomeOnboarding` / `welcomeWalkthrough` / `issueReporterOverlay.ts` / `extensions.contribution.ts` 中 I4 的**字面文案替换**（仅字符串，不改逻辑）、`universeAgentDeepLink.contribution.ts`、Web 冒烟脚本与 `d15-evidence/` |
| V | 验证债与 evidence | active | test/evidence 文件；默认不改 P/A/B/C 生产文件 |

`conversationSessionStatus*.ts`（StatusBar 文案）默认归 C；A 的 E2-7 需要改 Engine 文案时先经看板转交。

## 入口条件

- 六份 M7 文档（总方案 + 五份子方案）已于 2026-09-02 完成规则 16（本会话一轮 + Cursor CLI Grok 三轮 7 路并行）升 `accepted`；各槽可按方案首切片开工。
- Wave 1（A: E2-1/E2-3；B: Q1 + Q2 壳；C: I2/I3a/K1）与 P0 **同时**开工；依赖平台合同的切片按下表等待对应 P 刀，等待期间先落壳与 unsupported 态。
- P 槽在每刀合入时更新 `engine-protocol-surface.md` 对应行、同步 browser 断连实现、并提供 `IUniverseAgentConnection` 测试替身字段，UI 槽据此写单测。
- C 的产品身份图标源已裁定（`Singular/logo/singularity.svg`，用户 2026-09-02 授权）；I3b 等 I3a 的生成脚本。
- B 的 Client Settings（CS-*）在 Q5a/Q5b 之后开工：消费点依赖四 kind 与座位/时间线结构落定。

## 冲突仲裁

1. `platform/universeAgent/**` 归 P；A/B 需要新方法时在看板登记「合同请求」，由 P 实现，UI 槽不 import `platform/universeAgent/node/**`。
2. Engine / Connection 两个 Preferences pane 及其 contribution 归 A；Web / `unsupported_environment` 下省略桌面连接控件由 A **只在 E2-1** 实施（E2-7 只做窄宽度与文案），C 的 W1 只复核。
3. `conversationLens.ts` 与 timeline / 座位 / 对话框 / roster / stub 文件归 B；A11Y-1、A11Y-2、RWD-1 由 B 在 Q5b/Q6 内实施，C 提供验收清单并复核。
4. Client Settings 的键注册与消费点同属 B（同一切片内注册 + 消费，不留无消费点的键）；A 不再碰 `uaClientSettings*`。
5. `conversationSessionStatus*.ts` 默认归 C；A 需要改 Engine 文案时先由看板转交。
6. `universeAgentDeepLink.contribution.ts` 归 C（协议名与 `product.json` `urlProtocol` 同步）。
7. `conversation.contribution.ts`：B 注册 chat tab 切换命令与键位；C 不改此文件（K1 只复核 `layoutActions.ts` 四钮键位）。
8. T1 的公共 reduced-motion / 高对比度规则放 `browser/parts/conversation/media/ua-common.css`（C 新建、`conversationPart.ts` import 一行由 C 加）；B/A 在自己的切片里给动画节点挂 `.ua-motion` class，C 不改 B/A 的 CSS。
9. V 槽发现生产缺陷时只登记复现与建议 owner，不直接抢生产文件。

## 依赖矩阵

| UI 切片 | 依赖 P 切片 | 未合入时的姿态 |
|---------|-------------|----------------|
| A E2-1 Web / unavailable 省略桌面控件 | P0（`getConnectionPhase` / capability reason） | 桌面照常；Web 不得声称已诚实 |
| A E2-2 Model 组 | P1b（`listModels`、`models` / `providerConfig` 键） | 节存在，显示 unsupported（reason 来自 capability） |
| A E2-4 MCP Runtime tab | P1a（`getMcpServerStatuses` / `getMcpServerTools`、`mcpRuntime` 键） | tab 存在，显示 unsupported |
| A E2-5 Plugins | P1a（`listPlugins` … `scanNewPlugins`、`plugins` 真探测） | 节存在，显示 unsupported |
| B Q2 壳 DetailRef inspector | — | preview / unavailable 两态即完成；不引用 `requestDetail` |
| B Q2 接通 DetailRef | P2a（lease `requestDetail` + `DetailPatch.truncated/totalBytes`） | 未合入时不开工；合入后落 loading（本地 in-flight）/ full / partial / failed 与 stub 本地 `requestDetail` |
| B Q3 compacted | P2b（`ItemAttribution.branchReason` / `compacted`） | 无 compacted 行（不伪造） |
| B CS-1 … CS-6 Client Settings | —（依赖 B 自己的 Q5a/Q5b） | — |
| C W1 Web 冒烟 / D15 | P0 + A E2-1（Web 省略桌面控件只在 E2-1，E2-7 不重复） | Web 冒烟不跑；不得声称 Web 已验证 |

## 非阻塞验证账

- 新失败统一登记 [D17](../../progress/deferred-gaps.md)。
- 每项记录：首次出现 SHA、受影响场景、是否为基线、建议 owner。
- 只有硬阻塞项进入 `status.md` Blockers；普通红测只进 Verification debt。
- 方案**逐条点名**的断言替换（目前仅 `settingsUaToc.test.ts:253` `ua.client.*` 负向 → 白名单）由切片自身完成，不记 D17；未点名的红测一律记 D17。

## 完成

P 槽五刀与三个 UI 槽切片全部代码落地后，本看板转 `completed` 并移入 `dev/parallel/archive/`；V 槽可继续清债，不影响看板结束，但 PRD 状态仍取决于证据。
