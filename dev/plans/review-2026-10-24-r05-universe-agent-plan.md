---
title: "方案 r05：universe-agent"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "3 hold 已实施，r05-1 维持 drop；换链后的旧探测结果与旧 Chat 帧作废，服务级通配广告放行保存技能和工具详情。"
---

# 方案 r05：universe-agent

## 核查

- r05-1 drop：连接着的提问和客户端工具分别调用 `respondQuestion` 与 `sendClientToolResponse`，不会走进 `onQuestionRespond` / `onClientToolRespond`；提问的待办清理只发生在 unary 接受之后。
- r05-2 hold：`fetchAgentTree` 在传输对象已经换掉之后仍按这次结算改能力标志并返回旧树，`doFetch` 会把这棵树绑进当前会话；`fetchToolDetail` 的 `UNIMPLEMENTED` 同样不核对传输对象就置粘性标志。
- r05-3 hold：`isAdvertisedMethod` 承认 `Service.*`，`_probeSaveSkill` 和 `fetchToolDetail` 仍用全字符串 `includes`。
- r05-4 hold：`makeResidentBidiBytesHandleClient` 的 data 监听不读关闭门；本地 dispose 之后的错误帧仍会进 `noteChatRunFailed`。换链先关掉旧 Chat 流并同步 `connectionDown`，actor 的 `connectionUp` 要到 `finishBringUp` 里的 `postConnectionUp` 才恢复，恢复之后迟到的错误帧写的是同一个 actor。

## r05-2 hold

- 问题类：过期传输上的 Agent 树探测写进了当前连接。
- 不变量：当前连接的传输对象持有能力快照和探测标志。一次 `fetchAgentTree` 或 `fetchToolDetail` 开始时抓住的传输对象，结算时必须仍是 `this._transport`，这棵树、这次 `UNIMPLEMENTED` 和失败标志才能落下来。对象已经换成另一条时，这次结算作废：`agentTree` 支持度、`_agentTreeProbeUnsupported`、`_agentTreeFetchFailed`、`_fetchToolDetailUnsupported` 保持新连接提交后的值，旧树不进入当前会话。
- 要动的符号或文件：
  - `UniverseAgentConnectionService.fetchAgentTree`：进入 `_withTransport` 之前记下传输对象。结算时若它已不是 `this._transport`，不调用 `_setAgentTreeFetchFailed`，不写 `_agentTreeProbeUnsupported` 和 `agentTree` 能力，不把树返回给调用方，也不把这次错误抛出去。`AgentTreeCoordinator` 跨换链留在同一个侧车里，抛出的 `UNIMPLEMENTED` 会把它的 `agentTreeUnsupported` 闩住；作废的结算必须在 `fetchAgentTree` 内丢掉，让 `doFetch` 看不到根节点。传输对象未换时，成功、`UNIMPLEMENTED` 和其它错误三条路径保持现状。
  - `UniverseAgentConnectionService.fetchToolDetail`：发起调用前记下传输对象。结算时若它已不是 `this._transport`，返回 `{ ok: false, reason: 'failed' }`，不带正文，不把 `_fetchToolDetailUnsupported` 置真，也不返回 `unavailable`。传输对象未换时，`UNIMPLEMENTED` 仍置该标志并返回 `unavailable`；成功仍返回正文。
- 不改：
  - `_withTransport` 在传输对象已换时不改连接状态：成功原样返回，错误重新抛出。
  - 同一次传输上，`UNIMPLEMENTED` 仍把 agent tree 标成不支持，其它错误仍标拉取失败。
  - `AgentTreeCoordinator.doFetch` 在本次调用返回根节点时调用 `onBound`。
  - 提交新连接时对 `_agentTreeProbeUnsupported` 的清零，以及 `_rememberAdvertisedMethods` 对 `_fetchToolDetailUnsupported` 的清零。
  - 换链不拆 `AgentTreeCoordinator`。结算当时传输对象仍是 `this._transport`、因而已经闩上的 `agentTreeUnsupported`，这次不放开。
  - `requestDetail` 只在 `fetchToolDetail` 返回 `ok` 时把正文写入当前 lease 的 `leaseDetails`。
- 本地验证：
  - 既有 `switching profile after AgentService.Tree UNIMPLEMENTED resets probe flag and allows engine B to fetchAgentTree (B1)` 仍通过。
  - 新增：传输 A 的 `fetchAgentTree` 尚未结算时换成传输 B；A 以 `UNIMPLEMENTED` 或一棵树结算后，B 的 `isAgentTreeUnsupported()`、`isAgentTreeFetchFailed()` 和能力快照里的 `agentTree` 仍是 B 提交时的值，返回值不是 A 的树，当前会话不出现这次 `agentTreeBound`。
  - 新增：传输 A 的 `fetchToolDetail` 以成功正文或 `UNIMPLEMENTED` 结算时传输已是 B，这次结果是 `{ ok: false, reason: 'failed' }`，B 的 `_fetchToolDetailUnsupported` 仍为 false，`requestDetail` 不把 A 的正文写入当前 lease 的 `leaseDetails`。B 上随后的 `fetchToolDetail` 仍打到 B 的传输。

## r05-3 hold

- 问题类：保存技能和工具详情没有承认服务级通配广告。
- 不变量：握手返回的方法清单是「已广告」的唯一事实。`ToolService.*` 对清单成立时，`ToolService.SaveSkillContent` 算已广告；`AgentService.*` 成立时，`AgentService.FetchToolDetail` 算已广告。保存技能仍只有探针返回 OK 才绑定。清单里没有对应精确名、也没有该服务通配时，保存技能保持未绑定，工具详情保持 `unavailable`。
- 要动的符号或文件：
  - `UniverseAgentConnectionService._probeSaveSkill`：广告判断从 `methods.includes(UniverseAgentSaveSkillContentMethodKey)` 改为 `isAdvertisedMethod(methods, UniverseAgentSaveSkillContentMethodKey)`。通过之后仍对 `SaveSkillContent` 做 `probeRpc`，只有 OK 才返回 true。
  - `UniverseAgentConnectionService.fetchToolDetail`：广告判断从 `_advertisedMethods.includes(UniverseAgentFetchToolDetailMethodKey)` 改为 `isAdvertisedMethod(this._advertisedMethods, UniverseAgentFetchToolDetailMethodKey)`。未广告时仍返回 `unavailable` 且不发起调用。
- 不改：
  - `isAdvertisedMethod` 的通配规则，以及 `probeEngineCapabilities` 里探针状态到支持度的映射。
  - 精确方法名仍只匹配它自己。
  - 当前传输上 `fetchToolDetail` 收到 `UNIMPLEMENTED` 时仍置 `_fetchToolDetailUnsupported`。
- 本地验证：
  - 既有 `FooService.* wildcard counts as advertised for that service method`。
  - 既有 `SaveSkillContent advertised + probe OK => saveSkillContent writes via transport`。
  - 既有 `SaveSkillContent UNIMPLEMENTED probe => saveSkillContent absent`。
  - 新增：方法清单只有 `ToolService.*` 且探针 OK 时绑定 `saveSkillContent`；只有 `ToolService.ListSkills` 时不绑定。
  - 新增：方法清单只有 `AgentService.*` 时 `fetchToolDetail` 调用传输；既无 `AgentService.FetchToolDetail` 也无 `AgentService.*` 时返回 `unavailable` 且不调用传输。

## r05-4 hold

- 问题类：本地已经关掉的 Chat 双向流仍把迟到的错误帧折进当前会话。
- 不变量：这条 resident Chat 流的关闭门持有「这扇流是否还允许进入会话」。`closeLocal` 之后，这扇流上的 data 帧不得调用 `onResponse`，也不得经 `noteChatRunFailed` 折成 `chatRunFailed`，因此这扇流不得再改待发、overlay 或失败行。`end()` 半关闭不关这扇门，半关闭之后的 data 仍可以进入。
- 要动的符号或文件：
  - `makeResidentBidiBytesHandleClient` 的 `call.on('data')`：`gate.closed` 时直接返回，不调用 `onResponse`；门还开着才把 data 交给 `onResponse`。同文件 `makeServerStreamClient` 的 data 监听已经是这个顺序。这个助手同时供 Chat、会话事件流和 Pty 使用，门闩加在这一处。
  - `SessionViewHost.openResidentChat` 的响应回调：该流的 `disposed` 已为真时返回，不调用 `noteChatRunFailed`。`dispose` 先把 `disposed` 置真，再 `handle.dispose()`。
- 不改：
  - `onChatRunFailed` 对一次仍开着的流上报的失败所做的补丁。
  - error 与 end 已经读关闭门的路径。
  - `noteChatRunFailed` 在整个 host 已销毁时返回。
  - 会话事件流回调里已有的 `disposed` 判断。
  - `end()` 不调用 `closeLocal`，半关闭后的服务端帧仍交给 `onResponse`。
  - 一次性 `chat()` 使用的 `makeBidiBytesClient`。
- 本地验证：
  - 既有 `openChatStream dispose silences later onClosed` 仍通过。
  - 新增：`makeResidentBidiBytesHandleClient` 在 `dispose` 之后收到 data，`onResponse` 次数为 0；只 `end()` 未 `dispose` 时 data 仍进入 `onResponse`。
  - 新增：`applyPublishedLinkChange` 在同一次调用里关掉旧 Chat 流并抬起新连接之后，旧流上的 Chat 错误帧不再插入失败行，也不删除新连接上的待发。

## 落地

- 2026-10-25 实施 r05-2：`fetchAgentTree` 与 `fetchToolDetail` 在调用前抓住传输对象；结算时对象已换则丢弃结果，不写能力快照、探测标志或失败标志，也不把旧树交给协调器。
- 2026-10-25 实施 r05-3：保存技能与工具详情改用 `isAdvertisedMethod`，`ToolService.*` / `AgentService.*` 通配广告可放行；精确名仍优先。
- 2026-10-25 实施 r05-4：resident bidi 的 data 监听读关闭门，本地 `dispose` 后迟到帧不再进入 `noteChatRunFailed`；`end()` 半关闭仍收服务端帧。
- r05-1 维持 drop：连接着的提问与客户端工具仍走 unary，不接 `onQuestionRespond` / `onClientToolRespond`。
- 验证：`universeAgentConnection.test.ts` 466 passing（Node runner，D17 Electron 不可加载）；`grpcClientCalls.test.ts` 5 passing。
- 既有失败：无。
