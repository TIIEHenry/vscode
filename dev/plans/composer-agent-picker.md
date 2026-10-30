---
title: "Composer：不能切换的 Agent 控件改为只读"
type: plan
status: implemented
phase: M7
updated: 2026-10-24
summary: "switchAgent 没有握手方法，选择会立刻滚回。不可用时底栏只显示现有不可用文案。底栏的 agentIndex 不进发送载荷。已于 2e785907611 落地。不升 PRD。"
---

# Composer：不能切换的 Agent 控件改为只读
状态：已完成。
覆盖需求：无（正文未引用需求编号）。


> **触发：** [功能缺口审查 2026-10-16](review-2026-10-16-feature-gaps.md) G6。
>
> **2026-10-24 覆盖：** §2「不另写已连接但不能切换」由 [session-availability-and-delete-confirm](session-availability-and-delete-confirm.md) 覆盖：只读座按原因写，未连接是 Needs an engine connection，会话未就绪是 Loading session… / Session unavailable，会话就绪但没有 `switchAgent` 是 Not supported by this engine。其余不变。
> **不推翻：** [对话入口按广告探测](conversation-entry-capability.md) 对 `switchAgent` 的合同：没有握手方法，探测不发 `probeRpc`，提交后为 `UNSUPPORTED`。不升 PRD。
> **落地：** `status: implemented`。已于 `2e785907611`（Slot A）落地合入。

## 1. 现状

底栏 Agent 控件是 `SelectBox`（`conversationLensDock.ts:208-217`）。`onDidSelect` 立刻 `select` 回会话配置里的 `agentIndex`，选择不留下。

`isSessionSwitchAgentAvailable` 要同时满足会话可写，以及 `conversationEntryHookPresent(..., 'switchAgent', connection.switchAgent)`（`conversationLensComposerChrome.ts:808-811`）。`switchAgent` 不在连接接口的正式方法上，探测目标表里没有它，提交后能力是 `UNSUPPORTED`（`universeAgentTypes.ts:61-64`；`grpcCapabilityProbe.ts:366-376`）。生产上这个控件因此被 `updateAgentSelectEnabled` 关掉（`conversationLensComposerChrome.ts:814-825`），但节点仍是下拉框。

`agentProfiles` 为 `SUPPORTED` 时，`loadConnectedComposerCatalogs` 仍把档案名灌进这个下拉（`conversationLensComposer.ts:221-232`）。`submitDraft` 不读 `agentIndex`。`filterAgentId` 有值时仍把 `agentId` 放进 `submitInput`（`:373-377`）。

`COMPOSER_AGENT_OPTIONS` 在未连接时只有 “No agent”（`conversationComposerCatalog.ts:10-12`）。`composerAgentSelectOptions` 在这句之后接上档案名（`:15-19`）。

## 2. 本切片

`isSessionSwitchAgentAvailable` 为 false 时，底栏不渲染 Agent `SelectBox`。同一位置放只读标签，可见文案就是现有的 `conversationLensDockAgentUnavailable`（“Needs an engine connection”）。不另写「已连接但不能切换」。标签不是 `button`，没有 hover 手型，没有菜单。读屏名用同一句，不要再报成可切换的下拉。

为 false 时，这些路径不再调用 `agentSelectBox.setOptions` 或 `select`：`loadConnectedComposerCatalogs` 不为这个控件调用 `listAgentProfiles`；未连接回退（`conversationLensComposer.ts:85-88`）、`UNKNOWN` 回放（`:117-125`）、last-good / 抛错恢复（`:145-154`）、`syncSessionConfigSelects`（`conversationLensComposerChrome.ts:997-998`）同样跳过这个下拉。`updateAgentSelectEnabled` 今天在没有 `agentSelectBox` 时直接返回（`:816-818`）。互换必须发生在这次返回之前，并且与 `loadConnectedComposerCatalogs` 共用这一个 `isSessionSwitchAgentAvailable`。composer host 要能给出该函数需要的连接快照和 `switchAgent`，不复制判定。门闸为 false 时画出只读标签，为 true 时画出 `SelectBox`。构建时仍会先注册一个 `SelectBox`（`conversationLensDock.ts:209-217`）。连接变化会再次进入 `updateAgentSelectEnabled`（`:242-243`）。再次进入时替换 `agentContainer` 里的当前子节点，并卸掉不再使用的那一种控件。Engine 页的 Agents 列表自己的 `ListAgentProfiles` 不动。

窄宽把 `.conversation-lens-dock-agent` 设为不显示（`conversationLens.css:4245-4250`）。那时看得见的代理文案在 More 菜单。`getSelectedAgentName`（`conversationLensComposerChrome.ts:294-302`）在没有 `select` 时今天落到 `conversationLensDockNoAgent`。门闸为 false 时，这条回落改成同一句 `conversationLensDockAgentUnavailable`。门闸为 true 且 `select` 有选中项时，仍读选项文本。`agentContainer` 的现有显隐保持。

`isSessionSwitchAgentAvailable` 为 true 时（今天只有测试替身能走到），保留 `SelectBox`。`onDidSelect` 仍滚回 `agentIndex`。不在连接接口上增加 `switchAgent`，不把 `agentIndex` 写进 `submitDraft`。`filterAgentId` 进 `submitInput` 的现有路径不动。真要切换代理另立方案，先有握手方法名和协议面一行。

## 3. 明确不改

- 不改 `probeConversationEntryCapability` 对 `switchAgent` 的 `UNSUPPORTED`。
- 不把 `switchAgent` 加进 `IUniverseAgentConnection` 或 Engine Overview。
- 不改 Permission、Model 下拉。
- 不改 `submitDraft` 的 `submitInput` 字段。
- 生成中禁用 Send 仍归 [engine-gap-queue-send-attachments](engine-gap-queue-send-attachments.md)，本切片不碰。
- 不升 PRD。

## 4. 本地验证

- `conversationComposerCatalog.test.ts`：`COMPOSER_AGENT_OPTIONS` 仍只有 No agent。档案名仍只出现在 `composerAgentSelectOptions` 的返回值里。`createLoadCatalogHost` 不安装 `switchAgent`、快照也没有该字段时，门闸为 false。这些用例不再断言档案名被灌进下拉，也不再断言因此调用了 `listAgentProfiles`。已经在调用前装上 `switchAgent` 的用例（约 `:114-128`）可以保留档案名断言。不要给目录替身普遍装上 `switchAgent`。“UNKNOWN without last-good paints probing not empty-fail”（约 `:443-467`）里，`agentOptions` 停在调用前的 No agent，不再变成 `conversationLensDockCatalogProbing`；`modelOptions` 仍是 probing。“UNKNOWN keeps last successful catalogs”（约 `:470` 起）在没有 `switchAgent` 时，`listAgentProfilesCalls` 保持 0，`agentOptions` 不出现 Coder；Model 与 Tools 的 last-good 保持。“catch-path restore throws”（约 `:1080-1098`）的替身没有 `switchAgent`，门闸为 false。它在 `refreshComposerCatalogs` 之后把 `agentSelectBox.setOptions` 换成抛错，并期望 `paintBoom` 出现两次。门闸为 false 时 agent 的 `setOptions` 不会被调用，两次 `paintBoom` 不会出现。不要给这条替身装上 `switchAgent`。改为不再把 agent 下拉的 `setOptions` 当作抛错源。约 `:1101` 的源码双 `catch` 断言保持。
- `conversationEntryCapability.test.ts`：`switchAgent` 为 `UNSUPPORTED` 时没有可切换入口。快照已是 `UNSUPPORTED` 时，方法在也不开门。
- `conversationLens.test.ts`：门闸为 false 时 dock 内没有 Agent `select`，只读标签文本是 `conversationLensDockAgentUnavailable`，`agentIndex` 仍是 0，`listAgentProfiles` 不因这条底栏而调用。这包括约 `:936-967`，以及 `assertDisconnectedComposerCatalogsHonest`（`:455-464`，调用点 `:906`、`:1050`、`:1196`、`:1342`、`:1652`）里的 Agent 半边。“T3 SessionConfig XOR”（约 `:1338-1341`）不再锁选项文本 “No agent”、`disabled` 和复合读屏名。“connected dock hides gate…”（约 `:1691-1693`）和 “connected catalog RPC throws…”（约 `:1728-1731`）在没有 `switchAgent` 时与 helper 相同：没有 Agent `select`，只读标签是 `conversationLensDockAgentUnavailable`。不再读 Agent `select` 的选项，包括 “Coder”、“No agent” 和 “Stub agent”。Model 与 Tools 的断言保留。窄宽 More（约 `:1172-1183`）在门闸为 false 时，`.conversation-lens-dock-more-agent` 的文本是 `conversationLensDockAgentUnavailable`，不再是 `conversationLensDockNoAgent`。
- `conversationLensDisposeGate.test.ts` 约 `:3511-3522`：`isSessionSwitchAgentAvailable` 为 false 时不再断言 `agentSelect.disabled`。改为没有 Agent `select`、只读标签在。该夹具可以装着 `switchAgent`，false 来自会话未就绪。Permission 与 Model 的禁用断言保持。
- `conversationLensDisposeGate.test.ts` 约 `:3279-3286`：pairing-hold 的 More note 现在是 “No agent”。该夹具门闸为 false，但 `select` 仍在且有选中项。`getSelectedAgentName` 的回落只发生在没有 `select` 时，这条继续读选项文本。不要把「门闸为 false」理解成无视已有选中项。
- 替身提供 `switchAgent` 且门闸为真时，SelectBox 仍在，选择后下标回到原 `agentIndex`。约 `:936-967` 改成门闸为 false 的只读标签，不再承担真门闸回滚。真门闸回滚另写一条用例：夹具装着 `switchAgent` 且门闸为 true，选择后下标回到原 `agentIndex`。不要把 `:936-967` 改成装着 `switchAgent` 来保住回滚。`submitDraft` 仍不读 `agentIndex`。`conversationSessionView.test.ts` 里 “submitDraft from a filtered lens posts that agent id” 仍锁 `agentId: 'agent-sub'`。
