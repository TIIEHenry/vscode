---
title: "方案 r03：agent-host-codex"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "5 hold，0 weaken；过期 turn 不能改写当前 turn，结束或中断后的批准不能放行，未展示的权限不能授予，非末尾片段不能整 turn 留下，失败或未结束不能记成成功。"
---
# 方案 r03：agent-host-codex

状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 结论

- r03-1 hold — `_withHostTurn` 仍在 `currentTurnId` 有值时覆盖已有映射并改写 `currentAppTurnId`，完成处理紧接着用这个值清空当前 turn。
- r03-2 hold — 父会话的 `turn/completed` 仍只取消 guardian 卡；`_abort` 和 steering 不结算命令、文件、权限批准。
- r03-3 hold — 权限允许仍原样复制 `fileSystem` / `network`；命令批准仍不读 `cwd` 和 `additionalPermissions` 就返回 `accept`。
- r03-4 hold — 分叉和截断仍把 host 片段折成整条 codex turn；非拆分 id 没有末尾检查。
- r03-5 hold — `failed` 且 `error === null`，以及 `inProgress`，仍落到 `ChatTurnComplete`；回放的 `inProgress` 仍是 `TurnState.Complete`。

## r03-1 hold

- 问题类：过期的 app-server turn 通知改写并结束当前 host turn。
- 不变量：`hostTurnIdByAppTurnId` 持有已经见过的 app turn → host turn。`currentTurnId` 只在还没有绑定 app turn 时，由这一次新 turn 的 `turn/started` 领取一次。完成或开始通知不得把别的 app turn 写成当前 turn，也不得清掉当前 turn 的工具跟踪和计时。
- 要动的符号或文件：
  - `CodexAgent._withHostTurn`：已有映射就用映射，不要用 `currentTurnId` 覆盖。没有映射时，只有 `turn/started` 且 `currentAppTurnId` 仍为空，才把 `currentTurnId` 绑到这条 app turn，并写入 `currentAppTurnId`。其它通知不要改这两项。
  - `CodexAgent._handleTurnStartedNotification`：不是这次领取的通知，不要调用 `mapTurnStarted`（它会 `resetCodexTurnMapState`），也不要把别的 app turn 写进 `setTurnEventId`。
  - `CodexAgent._handleTurnCompletedNotification`：用调用 `_withHostTurn` 之前的 host id 调用 `mapTurnCompleted`。只有映射到的 host id 就是 `currentTurnId` 且 app id 就是 `currentAppTurnId` 时，才清空这两项、删映射、清 stopwatch。外来完成不要碰 `session.mapState`。
  - `sendMessage` 里 compact 与普通 `turn/start` 两处：在写下新的 `currentTurnId` 时清掉旧的 `currentAppTurnId`，避免旧 app id 仍被当成当前绑定。`turn/start` 的响应类型已有 `turn`，但不要改成另一套 id 来源；绑定仍以通知规则为准。
- 不改：`mapTurnStarted` / `mapTurnCompleted` 的纯映射语义；工作台已经发出的 turn start；steering 自己换 host id 的路径。
- 本地验证：新增断言。`currentTurnId` 已是新 host id、旧 app turn 仍有映射时，迟到的 `turn/completed` 和 `turn/started` 不改新 id 的映射、不发出新 id 的完成或取消、不清新 turn 的 item / preflight。新 turn 自己的 `turn/started` 仍能绑定一次。

## r03-2 hold

- 问题类：turn 已经结束、中断或被 steering 接管后，挂起的批准仍会返回允许。
- 不变量：`pendingCommandApprovals` 里尚未结算的命令、文件和权限请求，只属于还在等待的那一次 turn。该 turn 完成、中断或被 steering 换成新 host turn 之后，结果只能是 `cancel`，不能再变成 `accept`。
- 要动的符号或文件：
  - `CodexAgent._handleTurnCompletedNotification`：在返回动作之前，对父会话 `pendingCommandApprovals` 里仍挂起的项 `respond(..., 'cancel')`。guardian 卡已走这条，命令、文件、权限与同一登记表上的其它批准一并结算。
  - `CodexAgent._abort`：发出 `turn/interrupt` 的同时结算仍挂起的批准，不等待随后的 `turn/completed`。
  - `CodexAgent._beginSteeringTurn`：在 `finalizeCodexTurnMapState` 把未完成工具收成失败之前，结算被接管那一截的挂起批准。
- 不改：`_dispatchTurnCompleted` 里子代理路径已经 `denyAll('decline')`；断线和 dispose 已有的 `denyAll`；工作台确认卡片和 reducer。登记表 `respond` 在项已结算后返回 false，后到的允许不得再写回。
- 本地验证：新增断言。命令、文件、权限各挂起一项后，`turn/completed`、`_abort`、`_beginSteeringTurn` 都使等待方得到 `cancel`；之后 `respondToPermissionRequest(..., true)` 不再改成 `accept`。

## r03-3 hold

- 问题类：用户允许时，卡片没展示的文件系统、网络和工作目录被一起授予。
- 不变量：这次批准卡片上的文字持有用户看见的授权范围。权限响应只返回卡片上那一份 `fileSystem`、`network` 和 `cwd`。命令请求的响应只有整单 `decision`，看不到 `cwd` 或 `additionalPermissions` 时不能返回 `accept` / `acceptForSession`。
- 要动的符号或文件：
  - `CodexAgent._handlePermissionsApprovalRequestRpc` 与 `_requestItemApproval`：卡片要写上 `reason`、`cwd`，以及 `permissions.fileSystem`（`read` / `write` / `entries`）和 `permissions.network`。允许时只把这份放进 `GrantedPermissionProfile`；拒绝时仍是空 profile。
  - `CodexAgent._handleCommandApprovalRequest`：入参保留 `cwd`、`additionalPermissions`、`networkApprovalContext`。卡片除剥壳后的命令外还要写上这些字段。任一非空字段没有进卡片，就返回 `decline`。
  - `acceptedForSession`：键必须包含命令、`cwd` 和 `additionalPermissions`。只有三者与上次允许相同才可跳过提示。
- 不改：文件变更批准仍只返回 `narrowFileChangeDecision`；不要给命令响应发明协议里没有的部分授权字段；不要返回 `acceptWithExecpolicyAmendment` 或 `applyNetworkPolicyAmendment`。
- 本地验证：新增断言。权限允许的返回 profile 等于卡片展示的那一份，空 `reason` 时卡片仍含路径和网络。命令在带 `cwd` 或 `additionalPermissions` 且未写入卡片时得到 `decline`。同一命令但权限或 `cwd` 不同不能命中 session memo。

## r03-4 hold

- 问题类：同一条 codex turn 里较早的 host 片段被分叉或截断时，后半段仍留在线程里。
- 不变量：线程事实在 `thread/read` 的 turn items，以及 `codexTurnIdByHostTurnId` 的写入顺序。回滚边界只能是这条 codex turn 的最后一个带文本用户片段。更早的片段必须拒绝，不能靠整 turn 的 `numTurns` 留下后半段。
- 要动的符号或文件：
  - `codexReplayTurnIds.ts`：抽出与 `truncateChat` 共用的判断。拆分 id 继续用 `isLastUserMessageWithTextInCodexTurn`。没有拆分符时，若 items 里还有更晚的带文本用户消息（回放的第一段用 codex turn id 本身），拒绝。live 映射里同一个 codex turn 有多个 host id 时，只有最后写入的那个可以当作边界。
  - `CodexAgent.truncateChat`：在计算 `numTurns` 之前做上述判断。现有的「拆分 id 不是最后一条」拒绝保留。
  - `CodexAgent._forkChatBacking`：在 `thread/fork` 之前做同一判断。不通过就抛错，不要先复制再按整 turn 回滚。
- 不改：`resolveForkBoundary` 的整 turn 下标算法；已经是末尾片段时仍按整 turn 丢掉其后的 turn。协议没有 turn 内回滚。
- 本地验证：保留 `truncateChat rejects split replay host turn when later user messages remain in the parent codex turn`。改 `truncateChat rolls back the codex turn for the host id closed by steering`：较早的 steering host id 必须拒绝；较晚的那个仍只回滚其后的 turn。改 `fork resolves a split replay host turn id to the codex turn boundary`：items 证明该拆分 id 是最后一条时才 fork；其后还有用户消息时在 `thread/fork` 之前抛错。补一条第一段（host id 就是 codex turn id）且后面还有用户消息时，截断和分叉都拒绝。

## r03-5 hold

- 问题类：失败但没有 error，或仍是 `inProgress` 的 turn，被记成成功结束。
- 不变量：`Turn.status` 持有这次 turn 的结局。`failed` 必须带错误动作。`inProgress` 不是完成，不能写成 `ChatTurnComplete` 或 `TurnState.Complete`。
- 要动的符号或文件：
  - `mapTurnCompleted`：`status === 'failed'` 时无论 `turn.error` 是否为 null 都发 `ChatError`，再发 `ChatTurnComplete`。`error` 为 null 时用固定的 Codex 失败信息，不要调用要求 `TurnError` 的 `mapCodexTurnError`。`status === 'inProgress'` 时在清 `itemToPartId` / `currentTurnId` 之前返回，不发 `ChatTurnComplete`。
  - `turnStateFromStatus`：`inProgress` 单独分支，不要走现在的 `default` → `TurnState.Complete`。
  - `replayCodexTurnToHostTurns`：`inProgress` 的 codex turn 不要以 `TurnState.Complete` 放进回放结果。`TurnState` 没有「进行中」，省略这次 turn，不要改成 `Error` 或 `Cancelled`。
- 不改：已有 error 的 `failed` 仍是 `ChatError` 加 `ChatTurnComplete`；`interrupted` 仍是 `ChatTurnCancelled`；未知字符串的 `default` 仍按现有测试落到 `Complete`。
- 本地验证：扩展 `turn/completed with status=failed emits ChatError + ChatTurnComplete`，覆盖 `error: null` 仍有 `ChatError`。新增 `inProgress` 不发 `ChatTurnComplete`、也不清空进行中的 map。改 `turnStateFromStatus maps strings correctly`：`inProgress` 不是 `TurnState.Complete`，`weird` 仍是。回放新增：`inProgress` 的 turn 不出现为 `TurnState.Complete`。`failed turn maps to TurnState.Error` 保持。

## 落地

- 2026-10-25 实施 r03-1 至 r03-4：Codex 通知按 turn 身份解析，过期通知不再改写或结束当前 host turn；turn 结束、中断或被 steering 接管后，挂起批准返回拒绝；批准卡片渲染命令、工作目录、文件系统、网络与附加权限，卡片未展示的范围不授予；分叉或截断只作用于该 turn 的末尾片段。
- 2026-10-25 实施 r03-5：`turnStateFromStatus` 的 `inProgress` 单独分支，不再落到 `Complete`；`turn/completed` 的 `failed` 即使 `error: null` 也发 `ChatError`；回放跳过 `inProgress`，不把它写成完成。
- 验证：`codexCreateChat.test.ts`、`codexMapAppServerEvents.test.ts`、`codexReplayMapper.test.ts` 合计 146 passing。
- 既有失败：无。
