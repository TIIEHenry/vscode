---
title: "潜在缺陷：引擎设置"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "Connection 会在登录失败、忘记配置和直连替换时改掉当前 Hub 或引擎；MCP Update 会提交一份没有启动命令和 URL 的配置。"
---

# 潜在缺陷：引擎设置

## 结论

扫了 conversation 里引擎设置与 Connection 的生产 TypeScript。有用户可观察后果的 7 条：4 条会改错 Hub、断开当前引擎或批错配对，1 条会把残缺 MCP 配置写回引擎，2 条是页上状态与真实结果不一致。有意的空请求透传和 fail-closed 未立条。与 `dev/progress/deferred-gaps.md` 已关闭的抛错提示、列表残留条目不是同一缺陷。

## 发现

### BH-13-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts` `handleForgetSelectedProfile` 约 1462 行；选中行写入 `activeProfileId` 约 697 行
- 行为：忘记配置前无条件 `connectionService.disconnect()`，再按当前选中的 `activeProfileId` 调用 `forgetConnectionProfile`。选中行来自配置列表，不是当前已连接的 profile。
- 为何是缺陷：忘掉一份未在使用的配置时，已经连上的引擎会被断开。若忘记失败，断开已经发生，页面只显示失败原因。
- 触发：已连接引擎 A，在 Profiles 里选中另一份配置 B，点 Forget this Engine。
- 已知：否
- 修复方向：仅当快照里的已连接 profile 就是要忘记的那份时才断开。

### BH-13-2

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts` `ensureDirectAddressProfileForConnect` 约 1422 行，`findDirectAddressProfilesForEndpoint` 约 159 行。相邻类型 `ConnectionProfileProjection`（`src/vs/platform/universeAgent/common/hub.ts` 约 57 行）只有 `displayName` 与 `targetKind`，没有 host/port。
- 行为：直连 Connect 用显示名（或 `host:port` 标签）找出 `directAddress` 配置，对每个命中先 `disconnect()` 再 `forgetConnectionProfile`，然后才 `addDirectAddressProfile`。忘记失败则直接返回，不再添加、不再连接。
- 为何是缺陷：同名但指向另一地址的直连配置会被删掉，当前引擎先被断开。忘记失败时用户既失去原连接，也没有新配置。
- 触发：已保存直连配置显示名为 office，再对另一 host/port 填写 Name=office 并点 Connect；或忘记接口返回失败。
- 已知：否
- 修复方向：按保存的 host/port 匹配；只断开并删除确实是同一端点的旧配置，忘记失败时不要先断开无关连接。

### BH-13-3

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/connectionDevicePair.ts` `connectionDevicePairIds` 约 15 行；`connectionPreferencesPane.ts` `handleConfirmDeviceCode` 约 1878 行、`handleRejectDevicePair` 约 1927 行
- 行为：引擎 `pairApprove` / `pairReject` 使用 `selected?.pairingCode ?? inputPairingCode`。列表里只要有选中的 pending，输入框里的设备码就不会送出。
- 为何是缺陷：用户按输入框确认或拒绝时，实际批准或拒绝的是另一条待配对请求，从而连上或拒绝错误的设备。
- 触发：点过一条 pending 行，再在设备码框里改成另一条码，点 Confirm 或 Reject。引擎路径要求已连接且存在对应 hook。
- 已知：否
- 修复方向：输入框非空时以输入框为准；只有输入为空才用选中行。

### BH-13-4

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts` `handleLogin` 约 1036 行。相邻 `UniverseAgentHubService.setActiveHubBaseUrl`（`src/vs/platform/universeAgent/node/universeAgentHubService.ts` 约 134 行）会立刻改活动 Hub URL，并把目录置为 idle、刷新账号与目录。
- 行为：登录请求发出之前就 `setActiveHubBaseUrl(hubBaseUrl || undefined)`。登录失败或抛错只改账号徽章，不把活动 Hub 改回去。
- 为何是缺陷：失败的登录仍把账号指到新的 Hub URL，设备目录被清成空闲。原先已登录的 Hub 不再是活动地址。
- 触发：已登录 Hub A，把 Hub URL 改成 B，用错误密码点登录。
- 已知：否
- 修复方向：登录成功后再切换活动 Hub URL；失败保持原 URL 与目录。

### BH-13-5

- 严重度：high
- 置信度：中
- 位置：`src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts` Update 按钮约 262 行，`updateSelectedServer` 约 396 行。相邻 `encodeMcpServerConfig`（`src/vs/platform/universeAgent/node/grpc/grpcMcpPluginUnaryWire.ts` 约 405 行）在 command/url 为空时省略字段。`UniverseAgentMcpServerSummary` 不含 command、args、env、url。
- 行为：Update 不带表单调用 `updateSelectedServer()`。合并结果里 `command` 只有调用方传入时才有值，args/env/url 不从当前服务器回填，然后 `updateMcpServer`。成功文案是 Updated。
- 为何是缺陷：写回的配置没有启动命令和 URL。若引擎按整份 config 覆盖，stdio 命令或 HTTP URL 被清空，该 MCP 服务器随后无法按原定义启动。列表摘要本身也不足以把这些字段填回去。
- 触发：选中已有命令或 URL 的 MCP 服务器，点 Update。
- 已知：否（D55 只要求失败时有状态条，不覆盖这次写入内容）
- 修复方向：Update 前先取出完整配置再合并；列表摘要不够时不要发 Update。

### BH-13-6

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts` `getProfileStateLabel` 约 2038 行；`renderProfiles` 在没有选中时把 `activeProfileId` 设成列表第一项，约 2026 行
- 行为：全局连接阶段已是 connected、且快照不是 pairingPending 时，只要选中项自己的 `state` 是 `pairingPending`，或 `active` 且 `hasTrust` 为假，标签写成 Paired。比较的是选中 id，不是当前连接所用的 profile。
- 为何是缺陷：另一份仍在等待配对或尚未建立信任的配置，会显示成已配对。用户会以为当前引擎就是这一份。
- 触发：已连上某一配置，再选中另一份 state 为 pairingPending，或 active 且没有信任的配置。
- 已知：否
- 修复方向：Paired 只标在快照里实际连接的那份 profile 上。

### BH-13-7

- 严重度：medium
- 置信度：中
- 位置：`src/vs/workbench/contrib/conversation/browser/engineTriggersSection.ts` `handleFire` 约 380 行，`handleSetEnabled` 约 363 行
- 行为：Fire 与 Enable/Disable 在调用返回后一律 `writeStatus(..., 'success')`。Fire 把 `result.status`、`eventId`、`reason` 拼进同一条成功色状态。Enable/Disable 不比较请求的 enabled 与 `result.trigger.enabled`。
- 为何是缺陷：引擎返回失败状态或启用位没有变成所请求的值时，页面仍是成功色。用户会以为触发已执行或开关已生效。
- 触发：对一条触发器点 Fire 或 Enable，返回的 status 不是成功，或返回的 enabled 与点击不符。
- 已知：否
- 修复方向：按返回的 status 和 enabled 选择成功或错误色，启用位未改变时不要写成成功。

## 看过但未立条

- `shouldConfirmBeforeExternalOpen` 固定为 true，属有意 fail-closed。`shouldAdvertiseWorkspaceTools` 固定为 true，对应键已从 `UA_CLIENT_REMOVED_SETTING_KEYS` 删除，不再读未注册设置。
- `engineTriggerUpsertRequest` 的 Add、`engineClipboardWriteRequest` 的 Write 按注释故意发送空字段，不发明默认内容。
- `handleAddDirectAddress` 不在页面上挡非法端口；相邻 `addDirectAddressProfile` 会拒绝非 1–65535 的整数并返回失败原因。
- `uaClientSettingsStartup.contribution.ts` 在「不恢复上次会话」时切到列表第一项，与设置说明一致。`AfterRestored` 时列表仍为空则这次不会切换，未看到随后补跑，后果依赖 roster 是否已经有会话，未单独立条。
- D20 是 300px 目视未做，不是本次代码缺陷。D46、D49、D55–D74、D89、D128、D129、D131、D133、D134 等已关闭项与本次条目不是同一行为。

## 未读完

- `engineAgentsSection.ts` 工具页与模型页后半、`engineSkillsSection.ts` 正文保存以外的分支、`enginePluginsSection.ts` 的 refresh/loadInfo、`engineOverviewSection.ts`、`engineRulesSection.ts`、`engineHooksSection.ts`、`engineContextVariableSection.ts`、`engineMcpRuntimePanel.ts`、`connectionPreferencesPaneSas.ts` 未逐行读完，只核对了写入口或相邻调用。
- 样式文件不在本次生产 ts 范围内。
