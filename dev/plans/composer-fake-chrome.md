---
title: "Composer 假铬条：假麦克风与假 Route 的删除出口"
type: plan
status: accepted
phase: N/A
updated: 2026-09-10
summary: "D194 出口选定「删」：引擎无 voice/transcript/route capability，既不门控也不接 RPC。S1 四刀已落 `4156c6528f1`；用户 2026-09-10 签收"
---

# Composer 假铬条：假麦克风与假 Route 的删除出口

> **slice_id**：`composer-fake-chrome-plan`
> **冲突域**：conversation composer chrome（`contrib/conversation/browser` 的 Composer / Dock / SessionBar 及其 CSS 与 Lens 测）
> **D194 出口**：两条互斥路径中选 **删**。不门控、不接 RPC、不留隐藏实现体。
> **禁止发明**：本仓不存在的 proto 字段、capability key、引擎 RPC。
> **本稿是方案，不是实施**：不改 `src/`。规则 16 只读审查（2026-09-10）**Approve with changes**；Important 已并入。**用户 2026-09-10 签收**，`status: accepted`。不升 PRD `implemented`。
> **时序偏差（须知）**：实施刀 `4156c6528f1` 先于本方案落盘，违反 [规则 13](../../docs/DOCUMENTATION.md) 方案/实施分离。本稿**回补方案层并把出口钉成合同**，不追认为「方案已批」，也不据此把任何 PRD 升 `implemented`。

## Problem class

- **症状**：Composer 底栏画麦克风钮，点下去起一条**全本地伪造**的录音→转写流水线：造一条 `durationLabel: '0:01'` 的假录音片段，30 ms 后从三条预设台词里轮取一条 **写进用户草稿**；同时 dock / SessionBar 画 Route SelectBox，选中值只存进本地 `routeIndex`，不进任何引擎请求。用户看到的是「已录音、已转写、已选路由」，实际后端全无。
- **类标签**：**无后端能力的产品控件**（UI 先行造出根本不存在的能力）+ **本地回显冒充引擎状态**（`routeIndex` 只回显自己）+ **预设台词污染用户输入**（伪造产物直接落到会提交的草稿里，比纯装饰更危险）。
- **复发机制**：三种。① 把「PRD 里写过这个槽位」当成「可以先画个能点的」；② 把「先接一个 stub、等引擎补 RPC 再换数据源」当成渐进式接线——但本仓根本没有那个 RPC，stub 永远不会被替换；③ 只把控件 `hidden` 或藏进 feature flag，实现体（`finishVoiceClip` / `appendVoiceTextToDraft`）留在仓里，下一个人看见「已有实现，只差打开」就打开。
- **防复发**：出口只能二选一——**删**，或**门控到真实引擎 capability**。门控的前提是 capability 存在；不存在时门控恒 false，等于把 ① ② ③ 全留在原地，所以本类问题在**无 capability**时唯一合法出口是删。删完必须有两层锁：**DOM 负向测**（控件不存在、草稿不含预设台词）+ **源码禁词扫描**（实现体与 CSS 类名整体不得回到 contrib）。只有 DOM 测会被「改个 class 名」绕过；只有源码扫描不覆盖运行时行为。两层缺一不可。

## 代码基线（HEAD `61c0d09d913`，S1 已合入）

| 证据 | 事实 |
|:-----|:-----|
| `universeAgentTypes.ts` L10–23 | `UniverseAgentCapabilityKey` 共 **13 键**：`skills` / `mcp` / `mcpRuntime` / `plugins` / `models` / `providerConfig` / `globalRules` / `agentProfiles` / `projectRules` / `tools` / `hooksMetadata` / `agentTree` / `team`。**无** voice / transcript / speech / route |
| `universeAgentTypes.ts` L25–32 | `UniverseAgentCapabilitySupport = 'SUPPORTED' \| 'UNSUPPORTED' \| 'UNKNOWN'`；`UniverseAgentCapabilitySnapshot` = 上述 13 键的 `Record`。快照形状**穷举**，加键即改类型 |
| `universeAgentConnection.ts` L386 起 `IUniverseAgentConnection` | 对 `voice` / `mic` / `transcript` / `speech` / `route` **零命中**（版权行的 `Microsoft` 对不上这些词）。**无**录音、转写、路由方法，可选方法里也没有 |
| `conversationLensComposerChrome.ts` L90–93 | `ConversationSessionConfigSelection = { agentIndex, permissionIndex }`。**无** `routeIndex` 字段 |
| `conversationLensComposerChrome.ts` L516–520 | `getSessionConfig` 默认 `{ agentIndex: 0, permissionIndex: 0 }`。无 route 缺省值可回显 |
| `conversationLensComposer.ts` L31–62 | `IConversationLensComposerHost` 成员里**无** `micButton` / `voiceTranscriptBar` / `voiceClipsBySessionId` / `voicePhraseIndexBySessionId` / `voiceTranscriptTimeouts` |
| `conversationLensComposer.ts` L66–89 / L91–132 | L66–89 只做断连诚实空 + 连上占位再 `void loadConnectedComposerCatalogs`；`caps.agentProfiles` / `caps.models` / `caps.tools` 三个**真实**键在 L91–132。无 voice / route 分支 |
| `conversationComposerCatalog.ts` L9–12 | `COMPOSER_AGENT_OPTIONS = [conversationLensDockNoAgent]`，注释 `Disconnected Agent options: honest empty only` |
| `conversationLensDockStrings.ts` L33 / L45 | 只剩 `No model` / `No agent` 两条诚实空；`conversationLensVoiceStubPhrase*` / `dockMicTitle` 全仓**零命中** |
| `media/conversationLens.css` | 全文 `mic` / `route` / `voice` **零命中**。无孤儿样式 |
| `conversationLens.test.ts` L1287–1324 | T3 XOR：leading 与 sessionBar 均查不到 `.conversation-lens-dock-route, .conversation-lens-session-route`；`assert.ok(!('routeIndex' in lens.getSessionConfig(sessionId)))` |
| `conversationLens.test.ts` L1326–1333 / L1349–1364 | SessionBar 无 Route（PreFirst 双会话）；发送前后 composer 与 SessionBar 均无 Route，`routeIndex` 始终不在 config |
| `conversationLens.test.ts` L2749–2792 | T6 第一条：默认断连 mount 后 `setEngineConnected(true)`（只跑接通监听器，**不重挂 dock**），等 50 ms，`.conversation-lens-dock-mic` 为 `null`，草稿逐字不含三条 stub phrase |
| `conversationLens.test.ts` L2794–2806 | T6 第二条：再翻一次连通旗、查 mic、查 `'Stub voice segment'`；**不等 50 ms**。锁的是「接通监听器不往已挂 dock 塞 mic」，**不是**「连着 mount 仍不画」 |
| `conversationLensCssScan.test.ts` L25–72 | 源码禁词扫描：遍历 `contrib/conversation` 下全部 `.ts`/`.css`（跳过 `test/`），**15 条**禁词：`getUserMedia` / `MediaRecorder` / `STUB_VOICE_TRANSCRIPT_PHRASES` / `durationLabel: '0:01'` / `Stub voice segment` / `Stub Balanced` / `finishVoiceClip` / 三个 mic·route CSS 类名 / `conversation-lens-voice-transcript-bar` / `Stub agent` / `Stub model` / `dockStubAgent` / `dockStubModel` |

## 删除前基线（`4156c6528f1^`，症状证据）

| 证据 | 事实 |
|:-----|:-----|
| `conversationVoiceTranscriptModel.ts` L9–13 | `ConversationVoiceClip` 带 `durationLabel: string`——时长是**构造出来的字符串**，不是测量值 |
| `conversationVoiceTranscriptModel.ts` L15–22 | `appendVoiceTextToDraft(current, incoming)`：把伪造文本拼进草稿的专用函数 |
| `conversationLensComposer.ts` L40–44 | `STUB_VOICE_TRANSCRIPT_PHRASES` = 三条 localize 预设台词 |
| `conversationLensComposer.ts` L418–437 `toggleVoiceRecording` | 无 `getUserMedia`、无 `MediaRecorder`：直接造 `{ status: 'recording', durationLabel: '0:01' }`。**从未请求过麦克风权限** |
| `conversationLensComposer.ts` L439–469 `finishVoiceClip` | L446 按 `voicePhraseIndexBySessionId` 轮取台词；L453–466 `setTimeout(…, 30)` 里 L461 `writeComposerDraft(host, sessionId, nextDraft)` —— **预设台词落进会被提交的草稿** |
| `4156c6528f1` diffstat | 删 `conversationVoiceTranscriptBar.ts`（72 行）+ `conversationVoiceTranscriptModel.ts`（22 行）；`conversationLensComposer.ts` −154、`…Chrome.ts` −47、`…Dock.ts` −43、`…DockStrings.ts` −17、`…SessionBar.ts` −20、`conversationLens.css` −80、`conversationLens.test.ts` 179 行改写 |

## 引擎面盘点（禁止发明；每行都必须为空才允许选「删」）

| 需要什么 | 本仓有吗 | 证据 |
|:---------|:---------|:-----|
| 录音 / 上传音频 RPC | **无** | `IUniverseAgentConnection` 全表无音频方法（`universeAgentConnection.ts` L386 起） |
| 转写（ASR）RPC 或事件 | **无** | 同上；`onDid*` 事件只有 connection / fileMutation / turnSettle / teamRuntime |
| 转写 capability key | **无** | `UniverseAgentCapabilityKey` 13 键穷举（`universeAgentTypes.ts` L10–23） |
| `routeIndex` / 路由策略 RPC | **无** | 同上两处；`route` 在 platform/universeAgent 下唯一命中是 `l2-seq-cursor-cover.ts` L8 注释里的英文动词，与路由策略无关 |
| `transcript` 同名物 | **有，但不是语音** | `deviceGrant/device-grant-crypto.ts` `DeviceAuthTranscriptInput` 是**配对握手签名串**；`conversationViewFrame.ts` L49 `TRANSCRIPT: 3` 是视图帧枚举。两者都不能当转写后端 |
| 现成语音特性可复用 | **有，但不同产品线** | `contrib/agentsVoice`（上游 Copilot 语音窗口，含 `voiceTranscriptStore.ts` 真实 JSONL 持久化 + 自有 backend）。它不是 UA 引擎 capability，也不在本冲突域 |

上表前四行（录音 / 转写 RPC / 转写键 / 路由 RPC）全空 ⇒ 「门控到真实 capability」在本仓**无法表达**：既没有可读的键，也没有可调的方法。后两行是同名物与另一产品线，不能拿来填这四个空位。

## Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 删整条流水线 + 删 Route 控件与 `routeIndex`** | 删 mic 钮、转写条、clip 模型、台词常量、写草稿路径；删 dock/sessionBar Route SelectBox 与 `ConversationSessionConfigSelection.routeIndex`；删所有锁定假造行为的测试；补负向测 + 源码禁词扫描 | **选定。** 是「引擎面盘点四行全空」下唯一不发明的出口。删后可用源码扫描把复发锁死，这是其余选项都做不到的 |
| B 门控到真实引擎转写 capability 后再放开 | 读 capability，`SUPPORTED` 才画 mic / Route | **拒绝。** 无键可读（13 键穷举）、无方法可调。写出来只能是恒 false 的死门 + 原封不动的 stub 实现体，等于把「先接 stub 等引擎」这条复发机制原地保留。**若为此新增 capability key 或 RPC，即为发明**，本方案禁止 |
| C 按钮可点但产出预设文案 | 维持现状 | **拒绝。** 用户 2026-09-07 裁定 DELETE；违反 [PRD-007 诚实降级](../../docs/product/requirements.md#prd-007-诚实降级)（无能力不画假按钮）与 [PRD-015 §7](../../docs/product/requirements.md#prd-015-conversation-空会话与输入面)（不把预设台词写入草稿） |
| D 只藏不删（`hidden` / feature flag） | 保留实现体，UI 不挂载 | **拒绝。** `finishVoiceClip` / `appendVoiceTextToDraft` 仍在仓里且仍可被命令或测试触达；禁词扫描无从落地（实现体本身就是禁词）；等于把复发机制 ③ 制度化 |
| E Route 真的进引擎（`routeIndex` 上到 RPC） | 把选中值送进引擎请求 | **拒绝。** 无路由 RPC、无 proto 字段、无 capability key。接线必须先发明协议 |
| F 复用 `contrib/agentsVoice` 当转写源 | 把上游 Copilot 语音的 ASR 结果喂进 Conversation Composer | **拒绝。** 那是独立窗口特性 + 独立后端，不是 UA 引擎 capability；接进来等于在两条产品线之间发明一份没人定义过的合同，且越出本冲突域。**不在本方案范围** |

## 选定设计（选项 A · 删）

1. **麦克风整条流水线删除**：控件（mic 钮、转写条）、模型（`ConversationVoiceClip`、`appendVoiceTextToDraft`）、台词常量（`STUB_VOICE_TRANSCRIPT_PHRASES` 及三条 localize 串）、host 上的四个 voice 状态字段与两个 render 方法、CSS 类名，**一并删除**，不留 `hidden` 版本、不留 feature flag、不留注释掉的实现。证据：HEAD 基线表第 6、9、10 行。
2. **Route 控件与 `routeIndex` 删除**：dock 与 SessionBar 两处 SelectBox 删除，`ConversationSessionConfigSelection` 不保留 `routeIndex` 字段（不是置 0，是**字段不存在**，这样 `'routeIndex' in config` 可以作为断言）。证据：HEAD 基线表第 4、5 行。
3. **断连态只保留诚实空**：Agent 只有 `No agent`、Model 只有 `No model`；发送路径不得 `select` 任何假索引。证据：HEAD 基线表第 7、8、9 行。
4. **两层防复发锁**（缺一不可）：
   - **DOM 负向测（现状力度）**：T3（L1287–1364）在**断连 mount** 下断言 Route SelectBox 不存在、`getSessionConfig` 只有 `agentIndex` / `permissionIndex`。T6（L2749–2806）在**先 mount 再翻连通旗**下断言 mic / 转写条不存在、草稿不含 stub phrase。T3 **从不** `setEngineConnected`；T6 **不**查 Route。两态里「连着 mount 仍不画 mic/Route」**未**被 DOM 测锁住。
   - **源码禁词扫描**：`conversationLensCssScan.test.ts` L25–72 的 15 条禁词清单。**「连着 mount 才画」这条复发交给扫描层**（旧类名 / 旧实现体回仓即红）。换类名绕扫描时须另补「先接通再 `mountLens`」的 DOM 测；本稿不把那条写成已落。
5. **不接、不门控、不等**：本方案不产生任何「将来接上」的半成品代码路径。真语音 / 真 Route 属**新方案**，前置见下节复开条件。

### 「连上」负向测实际锁什么

删除前的 `toggleVoiceRecording` 第一行是 `if (!host.stubService.isEngineConnected() …) return`，假流水线只在连上时跑。但当前 T6 **不是**「连着 mount」：`mountLens()` 默认断连，`setEngineConnected(true)` 只触发 `refreshComposerCatalogs` + `bindSessionView`，**不重挂 dock**。因此：

- L2749 锁「接通监听器不往已挂 dock 塞 mic、不写草稿」（等 50 ms）。
- L2794 是同路径的短复检，**可以与 L2749 合并**；它不能单独锁「连上就放开」。
- 若复发写成 `mountDock` 里 `if (isEngineConnected())` 才画 mic，两条 T6 都会假绿；挡这一类的是禁词扫描，不是 L2794。

## 不变量

- 禁止新增 `UniverseAgentCapabilityKey`、`IUniverseAgentConnection` 方法或 proto 字段来「让门控有东西可读」。
- 禁止把预设 / 随机 / 派生文案写入 Composer 草稿或任何会被提交的输入。
- 禁止以 `hidden`、`display:none`、feature flag、注释保留的方式留下假造实现体。
- 禁止把 `DeviceAuthTranscriptInput`、`conversationViewFrame.TRANSCRIPT`、`contrib/agentsVoice` 任一者当作 UA 引擎转写 capability。
- 禁止把 `routeIndex` 以任何本地字段形态复活（包括改名回显）。
- 禁止在未同步扩充禁词清单的前提下向 composer chrome 新增无后端控件。

## 切片（一小刀；S1 四项已落，S2 为本稿）

| Slice | Goal | Files / Modules | Tests | Exit Condition |
|:------|:-----|:----------------|:------|:---------------|
| **S1a 删控件与流水线** | mic / 转写条 / clip 模型 / 台词 / Route SelectBox / `routeIndex` 全删 | `conversationLensComposer.ts`、`…ComposerChrome.ts`、`…Dock.ts`、`…DockStrings.ts`、`…SessionBar.ts`、`…SessionBarStrings.ts`、`…SessionBinding.ts`、`conversationLens.ts`、`conversationComposerCatalog.ts`、`media/conversationLens.css`；删 `conversationVoiceTranscriptBar.ts` / `conversationVoiceTranscriptModel.ts` | — | **已落** `4156c6528f1`（merge `5270c954a2d` → `b6bc01e57d0`，基线 `61c0d09d913` 已含）。HEAD 基线表第 4–10 行为验收锚 |
| **S1b 删锁定假造的测试** | 断言「点 mic 出台词」「Route 可选」的旧测一并删除，不改成宽松断言 | `conversationLens.test.ts`、`conversationComposerCatalog.test.ts`、`conversationLensDisposeGate.test.ts` | 旧假造测 0 条 | **已落** 同刀（`conversationLens.test.ts` 179 行改写） |
| **S1c 补负向测** | 草稿不得出现 stub phrase；控件不得存在；`routeIndex` 不得在 config | `conversationLens.test.ts` | T3 三条 + T6 两条 | **已落**：L1287–1364 / L2749–2806。含**连上态**用例 |
| **S1d 源码禁词扫描** | 实现体与 CSS 类名整体不得回到 contrib | `conversationLensCssScan.test.ts` | 15 条禁词遍历 `contrib/conversation` 非 test 源码 | **已落**：L25–72 |
| **S2 复开门禁（本稿，无代码）** | 把出口、不变量、禁词清单合同化，防止「下次再画一个」 | 本文件 | — | 本文件落盘 + `check-docs-health.py` 无新增 warning。**不改 `src/`** |

**无未落实施刀。** 「先接通再 mount」的 DOM 测未写，明确交给 S1d 扫描层；不把缺测说成已锁。

## 复开条件（满足前，任何「接语音 / 接 Route」提案一律拒绝）

1. `IUniverseAgentConnection` 出现真实的音频上传或转写方法（不是本仓自造的本地实现）；**且**
2. `UniverseAgentCapabilityKey` 出现对应键，快照能三态回答 `SUPPORTED` / `UNSUPPORTED` / `UNKNOWN`；**且**
3. 另写新方案 + 走 [规则 16](../../docs/DOCUMENTATION.md) 只读审查。

Route 同理：须先有真实路由 RPC 与 capability 键。**本文件不是复开许可**，[D194](../progress/deferred-gaps.md) 残留行也不是。

## 不做

- 不改引擎仓、不提引擎侧改动（跨仓提案走 [cross-repo-protocol](cross-repo-protocol.md)，本稿不新增行）
- 不发明 proto 字段 / capability key / 引擎 RPC
- 不升 [PRD-002](../../docs/product/requirements.md#prd-002-会话上下文) / [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级) / [PRD-015](../../docs/product/requirements.md#prd-015-conversation-空会话与输入面) 的产品状态（其正文 2026-09-10 的改口属 S1 实施刀，本稿不再动；也不据本稿标 `implemented`）
- 不占 [D26](../progress/deferred-gaps.md)（引擎 store 迁移），不碰引擎会话仓
- 不动 `contrib/agentsVoice`（独立产品线，独立后端）
- 不改 `src/` 任何文件
- 不升本文件为 `implemented`（S1 代码已在基线；签收的是出口合同，不是新实施刀）

## 相关

- [D194](../progress/deferred-gaps.md)（Track `UI / conversation`；`closed`，残留为「引擎仍无 voice/transcript/routeIndex」）· [status.md](../progress/status.md) D194 行
- [conversation-empty-hero](conversation-empty-hero.md) T3 / T6 行与 §3.5/§3.6 已改口。**对照表 §1、Heal「Route 回 Composer」、布局 ASCII `[Route▾?]` 仍是删除前的 XOR 叙述**——以 D194 / 本稿为准，那些残留句**不是复开许可**，也不是「Route 还应画」的合同
- [composer-and-inbox](../../docs/systems/conversation/composer-and-inbox.md) · [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) §2 / §4 / §5
- [glossary](../../docs/glossary.md) `SessionBar`（无 `routeIndex` 时不画 Route）/ `MessageQueue`（Composer 无假语音转写队列）
