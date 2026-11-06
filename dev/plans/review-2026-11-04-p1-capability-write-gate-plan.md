---
title: "设计审查 2026-11-04 p1：能力判断与写闸收口"
type: plan
status: accepted
phase: N/A
updated: 2026-11-05
summary: "能力判断改读已有快照，引擎设置的断开刷新与刷新代次收口；不新造 RPC 或快照字段，也不并掉 Navigator 与 Sources 两套写入口。"
---

# 设计审查 2026-11-04 p1：能力判断与写闸收口
状态：执行中。
签收：签。签收人：agent:cursor（用户委托），日期：2026-11-05。待定项的决定见文末「待定项」。
覆盖需求：无（正文未引用需求编号）。

行号按 2026-11-04 工作区（含未提交改动）。产品面是默认编辑器窗口里的 Engine 设置、Navigator、Sources。[产品愿景](../../docs/product/vision.md) 不把 Agents Window 当交付面。分层见 [架构概览](../../docs/architecture/overview.md)。Engine 页节与能力键的现况见 [engine-catalog](../../docs/systems/workbench/engine-catalog.md)。会话就绪见 [stub-and-fixtures](../../docs/systems/conversation/stub-and-fixtures.md)。

## 与已签收合同

[引擎写入结果闸门](engine-write-gate-unification.md) 已签收，S1–S5 已落。它定的是**写结果**怎么显示：link、视图还在、尚未被这次写清掉的目标 id、MCP Remove 的在途代次。刷新代次不属于写结果。本稿只用它留下的 `EngineRefreshGate`，不改 `engineWriteGate.ts` 里这句的含义。

本稿不推翻该方案的不推翻项：

- `linkId` 仍按 transport 铸号（`universeAgentConnectionService.ts` 的 `_publishCommittedLink`）。
- `isEngineConnected()` 仍以 `ConnectionPhase.connected` 为闸。
- 未配对 profile 的 Test Connection 仍不建未 pin 的探测链。
- 不发明新 RPC、新快照字段、写操作幂等键。缺字段才能表达的能力见文末待定项，未拍板不动代码。

下列已落地合同把「不要把桌面代理函数当成已广告」做成专用快照字段，并且写明不把这些方法加进 `UniverseAgentCapabilityKey`、不把可选方法改成必填：

- `12b096615dc`：FireTrigger、剪贴板、上下文读、快照恢复/删除、`readGitChanges` 改看能力快照。
- `c7d53074df5`：[Sources Git 写能力](sources-git-write-capability.md)，字段 `gitWriteCapability`。
- `3cb1f1055bb`：[对话入口](conversation-entry-capability.md)，字段 `conversationEntryCapability`。
- `b6bccf8ff2c`：[Sources 文件列表](../../archive/dev/plans/sources-files-list-capability.md)，字段 `listFilesCapability`。

这三份方案还锁住：`UNSUPPORTED` 即使方法是函数也关闭；`UNKNOWN` 或字段缺失时仍看方法是否安装；`SUPPORTED` 时 `isAdvertisedEngineRpcSupport` 直接为真，调用前若不是函数则不发 RPC。`isAdvertisedEngineRpc` 的这三态本稿不改。Hooks / Rules / Provider 列表上的 `typeof`、`probeEngine()` 的 `typeof`，对话入口方案明确留在那一刀之外。本稿只处理它没覆盖、且不用新字段就能改的部分；要新字段的写在待定项。

工作区已经收过、本稿不再动：

- `keepLeftoverCatalogForPairingHold` 在 `conversationSessionStatus.ts:71`。
- 共享判断是 `isConversationSessionNotReady`（`conversationSessionReadiness.ts:36`）。若干视图仍保留私有方法 `isKeepLeftoverListFailWrite`，正文转调这个共享函数（例如 `conversationSessionsView.ts:295`、`conversationInboxOverlay.ts:303`、`conversationEngineSnapshotsList.ts:324`）。本稿不改这些私有方法，也不再收一次。

## 改法约束

遵守 `.claude/CLAUDE.md`：服务只在构造函数注入；订阅和 `DisposableStore` 创建后立刻登记；用户可见字符串走 `nls.localize`，不拼接句子。新帮助放在 `workbench/contrib/.../browser` 或已有的 `sources/common`，不放进 `platform`，不让 `platform` 依赖 `workbench`。`sessions` 不引用。不用继承。控制器是分区自己 new 的普通对象，不是 DI 服务。不使用 `IInstantiationService` 在方法里现取服务。

## 冲突域与切片顺序

| 区域 | 文件 |
|------|------|
| 能力扫描 | 新增 `conversation/test/node/connectionCapabilityTypeofScan.test.ts`。只读 conversation、navigator、sources 的生产 `.ts`，不改这些目录的生产文件 |
| 链接通知 | `engineMemorySection.ts`、`engineRulesSection.ts`、`engineSkillsSection.ts`、`enginePluginsSection.ts`、`engineMcpSection.ts`。函数放在新建的 `engineCatalogSectionController.ts` |
| 断开刷新控制器 | 上表里除 Memory 以外的四份，加上 `engineHooksSection.ts`、`engineToolsSection.ts`、`engineAgentsSection.ts`、`engineMcpRuntimePanel.ts`。断开函数与链接通知同文件 |
| 刷新代次 | `engineHooksSection.ts`、`engineToolsSection.ts`、`engineAgentsSection.ts`、`engineTokenUsageSection.ts`、`engineMcpRuntimePanel.ts`、`engineSkillsSection.ts`、`engineProviderModelSection.ts`、`engineOverviewSection.ts`；已有 `engineWriteGate.ts` 只调用，不改语义 |
| Sources 写事实 | `sourcesDiffPanelView.ts`、`conversationDiffReviewPane.ts`、`sourcesChangesList.ts`、`sourcesReviewList.ts`、`sourcesChangesReadModel.ts`；帮助放在 `sourcesChangesGitWrite.ts` |
| Navigator 上下文键 | `navigatorAgentsView.ts`、`navigatorTeamList.ts`；函数放在 `conversationSessionAvailability.ts`（该文件已经同时用 pairing-hold 和会话就绪） |

同一分区文件的顺序：链接通知，然后刷新代次，然后断开刷新控制器。该文件没有的步骤跳过。Sources 的 ready 帮助先于两个 Diff 的事实组装（这两片都改 `sourcesDiffPanelView.ts` 与 `conversationDiffReviewPane.ts`）。能力扫描不改生产文件。Navigator 布尔式单独改 Agents / Team 视图。待定项通过之前，不改 Memory / Token Usage 的门闩，不改写方法的 `typeof`，不改 `listTeamsForInfo`，不新增服务。

不改 `dev/plans/INDEX.md`（索引由父 agent 更新）、CSS、`universeAgentConnectionService.ts` 的铸号与 phase、`IUniverseAgentConnection` 的可选成员、连接页 6 个代次、Composer 的 `SessionPermissionEpoch` / `SessionModelEpoch`。

## 1. 能力判断

问题类：桌面渲染端把任意方法名都变成函数，`typeof connection.方法 === 'function'` 不能表示引擎广告过这个 RPC。

证据：

- `ProxyChannel.toService`（`src/vs/base/parts/ipc/common/ipc.ts:1256`）：`then` 返回 `undefined`；`on` 加首字母大写的属性走 `channel.listen`；其余字符串属性返回 `async function`，再 `channel.call`。能力方法不是事件，所以在这个代理上是函数。
- 桌面渲染端在 `universeAgentConnectionChannelClient.ts:92` `return createRemoteForwardingProxy(this, this.remote)`。代理见 `universeAgentRendererSync.ts:162`。本地没有的方法落到远程；远程是上面的代理，所以未在类里声明的方法在桌面也是函数。
- `IUniverseAgentConnection`（`universeAgentConnection.ts:426` 起）可选成员 171 个。接口在 `2301` 行结束。
- `isAdvertisedEngineRpcSupport`（`universeAgentCapabilities.ts:190`）：`UNSUPPORTED` 为假；`SUPPORTED` 为真，不再看方法；其余才 `typeof method === 'function'`。
- `UniverseAgentCapabilityKey`（`universeAgentTypes.ts:16`）没有 memory、没有 `getGlobalUsage`。Token Usage 与 Memory 无键，[engine-catalog](../../docs/systems/workbench/engine-catalog.md) 写的是「方法缺失即为 unsupported」。在桌面上方法不会缺失。
- 工作区里 `typeof this.connection.<成员> === 'function'` 与 `typeof this.uaConnection.listTeams !== 'function'` 共 20 处，加上 `enginePluginsSection.ts:175` 的 `typeof connection[method] === 'function'`，是 21 处：
  - Rules：`engineRulesSection.ts:179`（`listProjectRules`）、`373` / `376` / `536` / `537`（upsert / delete）。
  - Hooks：`engineHooksSection.ts:126`（`listHookPoints`）。
  - Provider / Model：`engineProviderModelSection.ts:256` / `593`（`listProviderPresetCatalog`）、`328`（`listProviderStatus`）、`578` / `579`（凭据写）、`1144`（`testModelProfile`）、`1160`–`1162`（模型写）。
  - Memory：`engineMemorySection.ts:162` / `163` / `423`。同文件 `252`、`272`、`444`、`464`、`507`、`521` 是局部变量上的调用前检查，同一缺口，不重复计入 21。
  - Token Usage：`engineTokenUsageSection.ts:124`。
  - Team：`navigatorTeamList.ts:662`。唯一调用点是 `refreshTeamData` 的 `541`。该函数在 `517`–`532` 已经对 `getNavigatorCapability(..., 'team')` 为 `UNSUPPORTED` 或 `UNKNOWN` 直接返回。`662` 只在能力已是 `SUPPORTED` 时执行。`getNavigatorCapability` 在 `navigatorEngineBridge.ts:13`，转到 `connection.getNavigatorCapability`，再读 `capabilities.team`（`universeAgentRendererSync.ts:323`）。
- `WebUniverseAgentConnection`（`browser/universeAgentConnectionService.ts:92`）实现了一批方法，未实现的引擎能力走 `rejectUnsupportedEnvironment`。`332`–`346` 的 `listProviderStatus` / `listProjectRules` / `listHookPoints` / `listTeams` 只是其中四条。同类里还有会话、技能、MCP、插件（含 `enablePlugin` / `reloadPlugin` / `unloadPlugin` / `scanNewPlugins`）。网页类在 `probeEngine`（`348`）结束。网页类**没有**的是：`listMemory`、`searchMemory`、`saveMemory`、`deleteMemory`、`getGlobalUsage`、`upsertProjectRule`、`deleteProjectRule`、`upsertProviderCredentials`、`clearProviderCredentials`、`listProviderPresetCatalog`、`upsertModel`、`deleteModel`、`setModelEnabled`、`testModelProfile`。`searchMemory` 的局部检查在 `engineMemorySection.ts:272`。待定项 1 仍把 Memory 整节搁下，这里只补进名单。核查说的「其余未实现」过宽。
- 因此这 21 处在生产里分成两截。网页也实现了的列表方法（四条 list，以及插件四个写方法）：桌面和网页 `typeof` 都为真，节是否打开由已有能力键决定，`typeof` 只影响「快照写了 SUPPORTED、替身却没装方法」。网页没实现的写方法、Memory、Token Usage、`listProviderPresetCatalog`：网页为假所以不画按钮，桌面为真所以照画。桌面画不画不再看引擎有没有广告。

不变量：

- `UNSUPPORTED` 关闭入口，即使方法是函数。
- `isAdvertisedEngineRpc` / `conversationEntryHookPresent` / `sourcesGitWriteHookPresent` / `sourcesFilesListHookPresent` 的三态保持现有单测。
- 调用前方法不是函数，仍不发 RPC。
- 不新增快照字段，不加 `UniverseAgentCapabilityKey`。
- `listProviderPresetCatalog` 是桌面拉取 models.dev，不是引擎 RPC（engine-catalog）。网页类没有该方法，按钮因此不出现。这处 `typeof` 留下。
- `probeEngine` 的 `typeof` 留下（`connectionPreferencesPane.ts:2196`、`enginePreferencesPane.ts:330`）。它是客户端探测。
- Clipboard / Triggers / Context 已经按 `conversationEntryCapability` 或对应写键决定，`typeof` 只是 SUPPORTED 之后的调用前检查（`engineClipboardSection.ts:197`、`engineTriggersSection.ts:282` 与 `518`、`engineContextVariableSection.ts:155`）。不改。
- Memory、Token Usage、以及上列网页没有的写方法，在待定项 1 的另开合同签收前不改。

要动的符号与文件：

- 新增扫描测试，禁止再增加「用 `typeof` 连接成员决定能力」的生产代码。扫描目录是 `contrib/conversation`、`contrib/navigator`、`contrib/sources` 的生产 `.ts`（跳过 `test/` 与 `*.test.ts`）。
- 失败式是下面三条，不是字面的 `typeof <连接>.<成员> === 'function'`。只按点成员写正则时，`enginePluginsSection.ts:175` 的 `connection[method]` 和 Memory 的局部变量都不会红，新增同形也不会红。允许清单若按「漏了会红」去写、失败式却扫不到它们，清单锁不住这道门。
  1. 点成员。`typeof` 的操作数是接收者的点成员，比较是 `=== 'function'` 或 `!== 'function'`。接收者标识符是 `connection`、`uaConnection`、`connectionService`、`connectionEvents`，可以带 `this.`。
  2. 括号成员。同一接收者的 `typeof connection[expr]`（以及 `this.connection[expr]`）算命中。`175` 的 `connection[method]` 算命中。
  3. 局部变量。同一函数里，`const` / `let` 的初值是上面两种接收者成员，后面对该名字做同样的 `typeof` 比较，算命中。Memory 的 `252`（`listMemory`）、`272`（`searchMemory`）、`444` 与 `464`（`saveMemory`）、`507` 与 `521`（`deleteMemory`）算命中。不追踪跨函数，不追踪再改名传参。参数上的 `typeof hook === 'function'`（`sourcesChangesGitWrite.ts:318` 的 `hook` 参数）不算。与这四个接收者无关的名字（例如 `ResizeObserver`）不算。
- 允许清单写死路径和名字，覆盖这三条的现存命中。漏一处，第一片会红。至少包括：上面 21 处（含括号形式的 `175`）；Memory 那六处；Rules 的 `upsert` / `remove`（`395`、`432`、`482`、`497`）；Clipboard `197`、Context `155`、Triggers `282` 的 `hook`（Triggers `518` 的 `method` 是参数，不进清单）；Plugins `651` 的 `pluginInfo`；Runtime `537` 的 `mcpTools`；连接页 `1448` 的 `listDevices`、`1525` 的 `listPending`；`sourcesChangesReadModel.ts` 的 `242`、`251`、`259`，以及 `236` 的 `isEngineConnected`；`sourcesFilesList.ts` 的 `223`、`437`、`468`；`sourcesFilesExplorer.ts:445` 的 `onDidChangeConnection`；`probeEngine`（`connectionPreferencesPane.ts:2196`、`enginePreferencesPane.ts:330`）；`agentSessionContext.ts:93`、`130`、`196`。`onDidChangeConnection`、`getConnectionSnapshot`、`getConnectionPhase`、`isEngineConnected` 是事件或必有成员的空值防护，不是能力键。快照帮助已经为真、并且操作数落在这三条里的 `typeof`，同样进清单。只出现在参数上的不算命中，不必为了「漏了会红」写进去。扫描第一次若多扫出同形，补进清单，本片仍不改生产代码。
- 不改 `listTeamsForInfo`。`UNSUPPORTED` / `UNKNOWN` 已经在调用前返回，删掉 `662` 的 `typeof` 不会少发 RPC。`SUPPORTED` 时桌面和网页都有 `listTeams`。留下这行，写进允许清单。

分切片：

1. **扫描。** 新测试从 `import.meta.url` 找仓库 `src`（学 `conversationImportBoundaryScan.ts`，不扫 `out/`）。命中允许清单以外的上述三条即失败。本片不改生产行为。回退：删测试。

明确不改什么：见不变量。不改 `createRemoteForwardingProxy`。不把可选成员改成必填。不改插件 `hasPluginWriteMethod`（网页类有这些方法，`typeof` 分不开桌面和网页；按钮由 `canWrite()` 决定）。不改 `listTeamsForInfo`。第 3 节仍会改同一文件里的 `updateEngineConnectedContextKey`，两处不在同一切片。

本地验证：

- 单跑：`node test/unit/node/index.js --run src/vs/workbench/contrib/conversation/test/node/connectionCapabilityTypeofScan.test.ts`。Node 入口把 `src` 换成 `out`、`.ts` 换成 `.js`（`test/unit/node/index.js:208`–`209`）。
- Electron 收集 `**/test/**/*.test.js`（`test/unit/electron/renderer.js:90`）。`scripts/run-unit-custom.sh` 的 conversation glob 是 `**/vs/workbench/contrib/conversation/test/**/*.test.js`，包含 `conversation/test/node`。D17 跳过的只是路径含 `/universeAgent/test/node/`、且 basename 在 `d17-ua-node-unloadable.json` 里的模块。这份扫描放在 `conversation/test/node` 会被 Electron 门禁一起加载，必须能在 Electron 里 import。不要写成「Electron 不加载这类 `test/node`」。

风险与回退：允许清单若漏写一处，现有生产代码会红。先按上面三条把现存命中写进清单，再禁止新增。不在这片删除 `listTeams` 的 `typeof`，避免把「生产路径已经不发」写成「这行还在挡 UNSUPPORTED」。

## 2. 引擎设置分区的断开刷新

问题类：各分区各自写一份断开刷新、链接通知和状态渲染，KEEP 分支的签名和善后不一致，下一处容易漏画残留控件。

证据（名为 `applyDisconnectedRefresh` 的私有方法是 13 个，核查说的 10 个对不上）：

| 方法 | 签名 | KEEP 时多做的事 |
|------|------|-----------------|
| `engineAgentsSection.ts:1589` | `(support, hadLiveCatalog) => boolean` | 关掉写工具栏后补画残留 AGENTS.md、工具、Model |
| `engineSkillsSection.ts:730` | 同上，boolean | 补画残留正文并关掉行开关 |
| `enginePluginsSection.ts:457` | 同上，boolean | 残留钩子表 |
| `engineMcpSection.ts:1067` | 同上，boolean | 残留定义行 |
| `engineMcpRuntimePanel.ts:306` | `(support, hadLiveCatalog) => void` | 残留运行时工具 |
| `engineToolsSection.ts:738` | 同上，void | 残留工具行 |
| `engineRulesSection.ts:194` | 同上，void | `renderStatus(resolveMode(false, support))` |
| `engineHooksSection.ts:141` | 同上，void | 同上，位置参数 |
| `engineClipboardSection.ts:290` | `(hadLiveCatalog) => boolean` | 先递增写/读/清三代次。写路径在 `478`、`512` 也读 `renderGeneration` |
| `engineContextVariableSection.ts:229` | `(hadLiveCatalog) => void` | 无 support 参数；先递增 `readGeneration`。`refresh`（`148`）还会再加 |
| `engineTriggersSection.ts:401` | `(hadLiveCatalog) => boolean` | 无 support 参数；先递增 enable / fire / delete / upsert 四代次。`refresh`（`271`）还会再加。写路径（如 `731`）也读这些代次 |
| `conversationEngineSnapshotsList.ts:366` | `() => boolean` | 自己的 `keepLeftoverCatalogForPairingHold` |
| `conversationEngineHistoryList.ts:241` | `() => void` | 不收 support |

另外：`engineProviderModelSection.ts` 用 `applyDisconnectedProvidersRefresh` / `applyDisconnectedModelsRefresh`；`engineOverviewSection.ts:210` 用 `applyDisconnectedOverview`。Memory 与 Token Usage 没有这份函数。`connectionPreferencesPane.ts:1390` 还有一份私有 `keepLeftoverCatalogForPairingHold`，不走 `conversationSessionStatus.ts:71`。

`showLinkNotice` 五份正文相同（赋 `linkNotice` 再画）：`enginePluginsSection.ts:906`、`engineMcpSection.ts:976`、`engineRulesSection.ts:344`、`engineSkillsSection.ts:994`、`engineMemorySection.ts:210`。`paintLinkNotice` 只差状态节点：Plugins / MCP 用 `catalogWriteStatus`，Rules / Skills / Memory 用 `writeStatus`。

`renderStatus` 八份、两套参数。选项对象：Agents `1725`、Runtime `627`、Plugins `959`、Skills `873`、Tools `875`、MCP `1182`。位置参数 `(mode, reason, loadingKind, onRetry)`：Rules `308`、Hooks `241`。

`refresh` 外壳都是「代次、能力、断连、UNSUPPORTED、UNKNOWN、再列表」，返回值和 owner 检查不一致：Agents / Plugins / Skills / Rules / Clipboard / Triggers / MCP / Memory 返回 `Promise<boolean>`；Runtime / Tools / Hooks / Context / Token Usage 返回 `Promise<void>`；Provider 的 `refresh` 是同步外壳，`refreshModels` 返回 `EngineCatalogRefreshResult`。Skills 另要 `expectedOwner`。

不变量：

- 配对挂起且已有活目录：留行，关写控件，不发列表。真断连或从未活过：清目录。判断继续用 `keepLeftoverCatalogForPairingHold`，不在控制器里重写。
- 各分区 KEEP 时多画的残留（正文、工具、Model、开关）一处不漏。
- `refresh` 的返回值保持。今天 boolean 实现在断开路径返回 `false`。
- Clipboard、Context、Triggers 在 `applyDisconnectedRefresh` 里递增的那些代次留下，语句仍在分区里，不搬进控制器。这些代次也被写路径或读路径使用。并进控制器会把写结果闸和刷新骨架缠在一起。

要动的符号与文件：新增 `engineCatalogSectionController.ts`。分区改为调用它。五份 `showLinkNotice` / `paintLinkNotice` 改为共用函数，调用方传入状态节点。

分切片（每片可单独提交）：

1. **链接通知。** 在 `engineCatalogSectionController.ts` 放纯函数 `paintEngineLinkNotice(disposed, node, message)`。五份分区改调用。文案仍由调用方用现有的 `engineWriteNotSentCopy` 等产生，函数自己不 `localize`。行为不变。回退：五份改回私有方法，文件里只剩这个函数时连文件一起删。
2. **控制器 + Hooks。** 控制器不是基类。分区传入 `hadLiveCatalog`、`paintKept`、`clear`。内部只做：`keepLeftoverCatalogForPairingHold` 为真则 `paintKept`，否则 `clear`。返回 `false`。Hooks 的 `paintKept` / `clear` 里仍调用现有的 `renderStatus(resolveMode(...))`。`refresh` 外壳留在 Hooks。行为不变。回退：Hooks 收回私有方法，控制器文件可留到没有调用者再删。
3. **Rules。** 同 Hooks，位置参数的 `renderStatus` 留在分区。
4. **Tools，然后 Runtime。** 各一片。`void` 调用方忽略返回值。KEEP 时的残留善后放在 `paintKept`。Runtime 的测试用 `src/vs/workbench/contrib/conversation/test/browser/engineMcpRuntimePanel.test.ts`。同目录源码旁还有一份 `browser/engineMcpRuntimePanel.test.ts`，本稿不搬、不合并。
5. **Agents、Skills、Plugins、MCP 定义。** 各一片。boolean 返回值仍是 `false`。Skills 的正文悬挂、Agents 的三段残留都留在 `paintKept`，不塞进控制器。

明确不改什么：Snapshots、History、Overview、Provider 两段、Memory、Token Usage、Connection 页私有 KEEP、Clipboard / Context / Triggers 的 `applyDisconnectedRefresh`。这三节没有 catalog support 参数，Clipboard 还改写代次。`renderStatus` 两套参数本稿不合并；分区继续画自己的状态。`refresh` 里的列表 RPC、owner、代次不进控制器。

本地验证：每片跑该分区已有测试，不断言新的空目录或新文案。

- Hooks / Rules：`scripts/test.sh --grep "disconnected|pairing" --run src/vs/workbench/contrib/conversation/test/browser/engineHooksSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineRulesSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineRulesHooksSection.test.ts`
- Tools：`scripts/test.sh --grep "disconnected|pairing|leftover" --run src/vs/workbench/contrib/conversation/test/browser/engineToolsSection.test.ts`
- Agents / Skills / Plugins / MCP / Memory 通知：`scripts/test.sh --grep "link notice|disconnected|pairing|leftover" --run src/vs/workbench/contrib/conversation/test/browser/engineCatalogSections.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineSkillsSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/enginePluginsSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineMcpSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineMemorySection.test.ts`

Runtime：`scripts/test.sh --grep "disconnected|pairing|leftover" --run src/vs/workbench/contrib/conversation/test/browser/engineMcpRuntimePanel.test.ts`。补一条：配对挂起且已有服务器行时不调用 `getMcpServerStatuses`，残留工具按今天的 KEEP 关掉写外观。

风险与回退：控制器若把 `paintKept` 收成公共实现，Agents 的残留编辑器会漏画。所以公共部分只有「留还是清」。一片只迁一个分区，红了只回退该分区。链接通知一片若把节点画错，写失败文案会出现在另一块状态上；五份的单测已锁 `writeStatus` 或目录状态节点，先跑再合。

## 3. 写闸口径

问题类：Navigator 和 Sources 各有一套「现在能不能写」的入口；两个 Diff 视图把同一套事实各写了一遍。

证据：

- Navigator Agents / Team 的上下文键逐字相同（`navigatorAgentsView.ts:417`、`navigatorTeamList.ts:839`）：非 pairing-hold、roster `isEngineConnected()`、且 `!isConversationSessionNotReady(roster)`。Projects 没有这把上下文键，它在 `navigatorProjectsList.ts` 里直接拼 pairing-hold 与 `isConversationSessionNotReady`。
- `getConversationSessionReadiness`（`conversationSessionReadiness.ts:19`）：roster 缺失、未连接、或没有 `isEngineSessionReady` 时视为 `ready`。所以 Navigator 必须自己再看 `roster.isEngineConnected()`。断连时 `isConversationSessionNotReady` 为假，上下文键靠 `isEngineConnected()` 关掉。
- Sources 五处走 `conversationSessionReadinessProbe`（`conversationSessionReadiness.ts:46`）。注释写明：Sources 的写闸已经单独看了传输是否连接和是否配对；会话对象若没有 `isEngineConnected`，通用函数会把未就绪短路成 ready。探针把 `isEngineConnected` 固定为 true，再让显式三态获胜。五处是 `sourcesChangesList.ts:699`、`conversationDiffReviewPane.ts:357`、`sourcesDiffPanelView.ts:384`、`sourcesReviewList.ts:372`、`sourcesChangesReadModel.ts:141`。
- 两个 Diff 视图里下面三份相同，只有 `getGitSessionId` 的 modified URI 来源不同（面板用 `currentRef`，对话 Diff 用 `ConversationDiffReviewInput`）：`getEngineSessionReady`、`isReadFailed`（`isSourcesChangesReadFailed(snapshot.state)`）、`isSourcesKeepLeftoverWrite`（连接、`pairingPending`、ready）。`isSourcesDiffWriteHold` 都是 `changesModel.isWriteClosed()`。`sourcesDiffWriteController.ts` 已经吃 DOM 之外的事实（`ISourcesDiffWriteFacts`），视图仍自己算这三份布尔。

这是两套入口。Navigator 的名册对象有 `isEngineConnected`。Sources 的会话上下文没有，所以探针强制为 true。合成一个布尔会把其中一套的短路带进另一套。

不变量：

- 探针继续强制 `isEngineConnected: () => true`。不改 `getConversationSessionReadiness` 的「未连接视为 ready」。
- Navigator 上下文键的三个合取不增不减。Projects 的按钮条件不改。
- `isSourcesKeepLeftoverWrite` 的定义留在 `sourcesChangesGitWrite.ts`。
- 写结果闸（link / dispose / 目标 id / MCP Remove 代次）不进这套「能不能写」的布尔。
- `getGitSessionId` 留在各自视图。

要动的符号与文件：

- `sourcesChangesGitWrite.ts` 增加 `sourcesEngineSessionReady(session)`，正文就是今天的探针比较。五处改为调用。
- 同文件增加组装函数，入参是连接是否已连接、`pairingPending`、session、changes snapshot state，返回 `{ engineSessionReady, readFailed, keepLeftover }`。两个 Diff 视图改调用。`isSourcesDiffWriteHold` 留在视图（只有一行）。
- `conversationSessionAvailability.ts` 增加 `isNavigatorEngineWriteLive(connection, roster)`，正文是上下文键那三个合取。Agents 与 Team 的 `updateEngineConnectedContextKey` 改调用。键仍由视图 `bindTo` 自己的 scoped context，函数不碰 `IContextKeyService`。

分切片：

1. **Sources ready。** 五处改调用。行为不变。回退：五处写回内联探针。
2. **两个 Diff 的事实组装。** 行为不变。回退：两个视图写回私有方法。
3. **Navigator 布尔式。** 行为不变。上下文键仍是 `ua.engineConnected`。回退：两处写回三行合取。

明确不改什么：不新增 workbench 服务，不让服务拥有 context key。服务要不要做见待定项 3。不改 `sourcesDiffWriteController` 的可见性规则。不改 Composer、SessionBar、Inbox 已经在用的 `isConversationSessionNotReady`。

本地验证：

Mocha 的 `--grep` 匹配套件名加用例标题，区分大小写。不匹配断言字符串，也不匹配夹具里写进输入框的句子。

- Sources ready 与 KEEP：`scripts/test.sh --grep "engine session not ready|KEEP leftover" --run src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts --run src/vs/workbench/contrib/sources/test/browser/sourcesChangesList.test.ts --run src/vs/workbench/contrib/sources/test/browser/sourcesReviewList.test.ts`。`engine session ready` 对不上 `engine session not ready`（`sourcesDiffPanel.test.ts:4282`）。`keep leftover` 对不上标题里的 `KEEP leftover`（`sourcesChangesList.test.ts:3281`、`sourcesDiffPanel.test.ts:2068`、`sourcesReviewList.test.ts:2031`）。`sourcesChangesList.test.ts:3077` 的 `keep leftover` 是提交说明，不是标题。`write hold` 不在这些标题里。
- `conversationDiffReviewPane.test.ts` 的标题没有 `engine session not ready` 或 `KEEP leftover`。套用上一条 grep 会启动但跑到 0 条。该文件现有标题是 Accept 与写代次（`ApplyHunks`、套件 `Local Git completion ownership`）。第 3 节不改写结果闸。跑它用：`scripts/test.sh --grep "ApplyHunks|Local Git completion" --run src/vs/workbench/contrib/sources/test/browser/conversationDiffReviewPane.test.ts`。Review pane 的 KEEP 与 session-ready 在 `sourcesDiffPanel.test.ts`。
- Navigator 上下文键：`scripts/test.sh --grep "session readiness flip updates ua.engineConnected|Refresh is unavailable when engine is disconnected|KEEP leftover list-fail closes Inspect|ViewTitle exposes a read-only Refresh" --run src/vs/workbench/contrib/navigator/test/browser/navigatorAgentsSubviews.test.ts --run src/vs/workbench/contrib/navigator/test/browser/navigatorTeamList.test.ts --run src/vs/workbench/contrib/navigator/test/browser/navigatorTeamSubviews.test.ts`。`ua.engineConnected|engineConnected` 只命中 `navigatorTeamSubviews.test.ts:2199`。Agents 与 Team 列表的标题里没有这个字符串。Agents 的键在 `Refresh is unavailable when engine is disconnected`（`navigatorAgentsSubviews.test.ts:381`）和 `KEEP leftover list-fail closes Inspect`（`519`，断言在 `559`）。Team 列表的键在 `ViewTitle exposes a read-only Refresh`（`navigatorTeamList.test.ts:161`，断言在 `172`）。

风险与回退：组装函数若把 `pairingPending` 改成 `isConversationPairingHold`，配对开始、phase 仍是 `connecting` 时的写闸会变。入参保持视图今天传入的 `pairingPending` 布尔。每片只搬表达式，不改运算符。

## 4. 代次与在途请求

问题类：`EngineRefreshGate` 只盖住一部分分区。其余分区自己加代次；其中 Agents 和 Tools 落地时不看已发布链路。

证据：

- `EngineRefreshGate` 在 `engineWriteGate.ts:88`。`begin` 加代次并记下当时的 `engineIdentityId` 与 `linkId`。`isCurrent`（`103`–`109`）要求未 dispose、代次相同、且当前已发布身份与 linkId 仍是 begin 时那一对。
- 已用该闸的分区：Memory、Rules、Plugins、MCP 定义（各自 `new EngineRefreshGate`）。
- 仍手写列表代次、落地时**不**比链路：
  - Agents `engineAgentsSection.ts:1629`，落地 `1674` 与 `1698` 只比 `refreshGeneration`。`dispose`（`515`）会先加代次。`onDidChangeConnection`（`488`）会 `refresh()`，从而加代次。
  - Tools `engineToolsSection.ts:778`，落地 `823` 与 `853` 只比代次。`dispose`（`394`）加代次。`543` 与 `598` 在保存成功时加代次，用来丢掉保存前发出的列表（已签收写闸方案的 Tools 条款）。
  - Hooks `engineHooksSection.ts:155`，落地 `201` 与 `221` 比代次和 dispose，不比链路。`dispose`（`83`）加代次。
  - Token Usage `engineTokenUsageSection.ts:144`，`isCurrent`（`128`）比代次和 dispose。`dispose`（`97`）加代次。
  - MCP Runtime `engineMcpRuntimePanel.ts:326`，落地 `372` 与 `397` 比代次和 dispose。`dispose`（`200`）加代次。
- 已经比链路，只是没走这个类：
  - Skills 在 `engineSkillsSection.ts:767` 做 `++this.refreshGeneration`。比代次的是 `817`（配 `sameReadOwner`）、`830`、`837`（配 `sameReadableOwner`）、`845` 的 `catch`（配 `sameReadOwner`）、`1121`、`1123`（配 `sameReadableOwner`）。`845` 与 `817` 同一条件。`767` 改走闸之后，若 `845` 仍比不再递增的 `refreshGeneration`，列表失败会被当成过期丢掉。`sameReadOwner`（`470`）看 dispose、`invalidatedOwner`、身份与 linkId，不看是否已连接。`sameReadableOwner`（`477`）经 `captureReadOwner`（`460`）在未连接、pairing-hold 或 `invalidatedOwner` 时失败。`dispose`（`355`）和 `closeInvalidOwnerChrome`（`513`）也加代次。`bodyLoadGeneration`（约 `1227`）是正文加载，不是列表代次。
  - 这一文件有两个类、三套代次。Provider 列表用 `providerRefreshGeneration`（`213`），递增在 `366`。直接比 `generation !== this.providerRefreshGeneration` 的是 `414` 与 `431`。`ownsProviderResult`（`582`–`585`）用 `generation === this.providerRefreshGeneration`，并要求未 dispose、已连接、非 pairing-hold、link 相同。调用点是 `428`（列表已经画上之后）、`537`、`539`、`551`、`732`、`759`、`805`。`366` 不再递增旧字段之后，若 `428` 仍走这份相等判断，会在列表画上之后返回 discarded。`364` 在递增前把该字段放进 discarded 结果，不是落地比较。Models 用 `refreshGeneration`（`889`），递增在 `994`。直接比 `generation !== this.refreshGeneration` 的是 `1036` 与 `1054`。`ownsModelResult`（`1165`–`1168`）用 `generation === this.refreshGeneration`，条件与 Provider 相同。调用点是 `1050`、`1124`、`1126`、`1149`、`1249`、`1266`、`1296`。`992` 与 `364` 一样，是递增前的 discarded 计数。第三套 `catalogGeneration`（`205`，递增 `599`，比较 `605` 与 `614`）只管 models.dev 目录，不是 `providerRefreshGeneration`。两套列表代次都用文件顶部的 `sameWriteLink`（`60`）。`canWriteProviders` / `canWriteModels` 也用它。`dispose`：Provider 方法在 `280`，递增在 `281`；Models 方法在 `929`，递增在 `930`。
  - Overview `engineOverviewSection.ts:239` 的 `renderGeneration`，落地 `283` 与失败路径 `295` 都比代次、dispose 和 `ownsRead()`（身份与 linkId）。

行为变化（Agents、Tools、Hooks、Token Usage、MCP Runtime 换上 `EngineRefreshGate.isCurrent` 时才有）：

连接事件已经调用了 `refresh()` 的，新旧实现都丢掉旧列表，因为新的 `refresh` 一进门就加代次。差别在已发布身份或 linkId 变了、而这节没有再进 `refresh()`：今天列表仍会画上；换闸之后 `isCurrent` 为假，不画。dispose 今天已经用加代次挡住，换闸后改为看 `store.isDisposed`，结果仍是不画。Tools 保存成功时的作废改为 `invalidate()`，仍让保存前发出的列表对不上代次。

Skills、Provider、Models、Overview 已经比链路。换成 `isCurrent` 时，`isCurrent` 替换每一处 `generation !== this.refreshGeneration`、`generation !== this.providerRefreshGeneration`，以及 `ownsProviderResult` / `ownsModelResult` 里的代次相等。Skills 的 `845` 算在里面。只改递增和两处直接落地、留下 helper 里的旧相等，列表画上之后的收尾仍会 discarded。Skills 每一处原来调用 `sameReadOwner` 的仍调用它，原来调用 `sameReadableOwner` 的仍调用它，不要收成一个函数。收成 `sameReadOwner` 之后，`setSkills` 期间进入 pairing-hold、link 未变，工具栏仍可能画上。Provider 与 Models 各持有一个 `EngineRefreshGate`，计数不共用。`ownsProviderResult` / `ownsModelResult` 里的已连接与非 pairing-hold 留下。`canWriteProviders` / `canWriteModels` 继续用本地 link 比较，那是写路径，不并进刷新闸。`catalogGeneration` 不迁。Overview 的 `ownsRead` 与已连接判断留下。

不变量：

- 写结果仍不看刷新代次。不改 `evaluateEngineWrite`。
- 刷新结果过期仍静默丢掉，不新增提示。
- Tools 保存成功仍作废在途列表。
- Skills 的 `invalidatedOwner` 与 `bodyLoadGeneration` 留下。
- Clipboard / Triggers / Context 的 `renderGeneration` 以及 Triggers 的四份写代次、Context 的 `readGeneration` 不迁。写路径也读这些代次（Clipboard 写在 `engineClipboardSection.ts:478` 与 `512`，Triggers upsert 在 `engineTriggersSection.ts:731`）。并进 `EngineRefreshGate` 会把写结果重新绑到刷新代次上，推翻已签收合同。

要动的符号与文件：上表仍手写的分区。类用现成的 `EngineRefreshGate`，不新增 `LatestRequest`。

列表 `dispose` 一律 `invalidate()`，不留「只看 dispose」的另一选项。`isCurrent` 在 store 已 dispose 时为假；`invalidate()` 在 `super.dispose()` 之前就让令牌对不上，和今天先递增再 dispose 一致。

分切片（每片一个分区，先于该分区的控制器切片）：

1. **Hooks。** `refreshGeneration` 改为闸。落地改 `isCurrent`。`dispose`（`83`）改为 `invalidate()`。断开与失败路径的其他判断不动。
2. **Token Usage。** 同上。`dispose`（`97`）改为 `invalidate()`。`hasGlobalUsageHook` 的 `typeof` 不动（待定项 1）。
3. **MCP Runtime。** 同上。`dispose`（`200`）改为 `invalidate()`。
4. **Tools。** 落地改 `isCurrent`。`543` 与 `598` 改为 `invalidate()`。`dispose`（`394`）改为 `invalidate()`。不改保存本身的写结果闸。
5. **Agents。** 落地 `1674` 与 `1698` 改 `isCurrent`。`dispose`（`515`）改为刷新闸的 `invalidate()`。紧跟着的 `516` `agentToolsLoadGeneration++` 必须留下。残留编辑器加载在 `1413` 递增，在 `1433` 与 `1439` 比较，仍看这一字段。
6. **Skills。** `767` 的递增改为 `begin()`。`817`、`830`、`837`、`845`、`1121`、`1123` 只把 `generation !== this.refreshGeneration` 换成 `!isCurrent`，owner 函数保持原样。`845` 的 `catch` 不能留旧比较。`dispose`（`355`）和 `closeInvalidOwnerChrome`（`513`）改为 `invalidate()`。`invalidatedOwner` 仍使「link 没变但这次 owner 已作废」不落地。删掉 `sameReadableOwner` 会让 `setSkills` 期间进入 pairing-hold 的结果画上工具栏，禁止。
7. **Provider 与 Models。** 两个类各一个 `EngineRefreshGate`，计数不共用。凡是 `generation !== this.providerRefreshGeneration`、`generation !== this.refreshGeneration`，以及 `ownsProviderResult` / `ownsModelResult` 里的代次相等，都换成 `isCurrent`。已连接和非 pairing-hold 留在 `owns*Result` 里。原来 if 里的 `sameWriteLink` 留下。
   - Provider：`366` 改为 `begin()`。`414`、`431` 的代次比较改为 `isCurrent`。`ownsProviderResult`（`582`–`585`）的 `generation === this.providerRefreshGeneration` 改为 `isCurrent`。漏改 helper 时，`428` 在列表画上之后仍返回 discarded；`537`、`539`、`551`、`732`、`759`、`805` 同样走这个 helper。
   - Models：`994` 改为 `begin()`。`1036`、`1054` 改为 `isCurrent`。`ownsModelResult`（`1165`–`1168`）的代次相等改为 `isCurrent`，覆盖 `1050`、`1124`、`1126`、`1149`、`1249`、`1266`、`1296`。
   - `364` 与 `992` 在 `begin()` 之前把旧字段放进 discarded 结果。调用方在 kind 为 discarded 时不把这个数送进 `owns*Result`。字段删除后这两处不得再读它。不为了读当前计数给 `EngineRefreshGate` 加 getter。
   - `catalogGeneration`（`205`、`599`、`605`、`614`）不迁。它管 models.dev 目录，不是列表刷新闸。
   - Provider `dispose`（`281`）与 Models `dispose`（`930`）各 `invalidate()` 自己的闸。`canWriteProviders` / `canWriteModels` 不改。
8. **Overview。** `renderGeneration` 改为闸。`283` 与 `295` 的代次比较改为 `isCurrent`。`ownsRead` 与已连接判断留下。Model 摘要的留下/清掉规则不动。

Composer 的 `SessionPermissionEpoch` / `SessionModelEpoch`（`conversationLensComposerChrome.ts:1143`–`1160`）和连接页六个代次（`engineDevicesRefreshGeneration`、`hubDirectoryRefreshGeneration`、`enginePendingRefreshGeneration`、`testGeneration`、`latestTestRunGeneration`、`_forgetProfileGeneration`，`connectionPreferencesPane.ts:486`–`500`）不在本稿。交给 p4。

p4 仍是草案。`review-2026-11-04-p4-conversation-class-split-plan.md` 里「和 p1 第 4 条的边界」写的分区名单没有 Overview。本稿第 8 片要改 Overview。两稿同时实施时，那句补上 Overview。与已签收的写闸方案没有冲突：本稿仍不改 `isCurrent` 的三个条件，也不把 Composer epoch 或连接页六代次迁进刷新闸。

明确不改什么：见不变量。不改 `EngineRefreshGate.isCurrent` 的三个条件。不迁 `catalogGeneration`。不为了让 Agents 保持「链路变了仍落地」去加一个开关。那是换闸要接受的行为，不是实现时再选。

本地验证：每片跑该分区测试，并补一条「列表 RPC 未返回时把已发布 linkId 改掉，且不调用 `refresh()`，返回后不画新列表」。连接事件触发的 `refresh()` 仍丢掉旧列表（现有用例）。Tools 另保持：保存提交前发出的 list 在保存返回后不得盖掉新值和 pending。

Mocha `--grep` 只看标题。`refresh generation|stale|link` 能匹配 Runtime 的 `stale`（`engineMcpRuntimePanel.test.ts:870`）和标题里带 `link` 的写路径。Hooks（`engineHooksSection.test.ts:93`–`217`）、Token Usage（`engineTokenUsageSection.test.ts:134`–`336`）、Overview（`engineOverviewSection.test.ts:62`–`746`）的标题里没有这三词。原命令把这三份放进 `--run`，启动后跑不到它们。Runtime 文件原先不在同一条 `--run` 里。

- `scripts/test.sh --grep "pairing-hold still paints disconnected|true disconnect still paints disconnected|refresh catch-path|late response after dispose|refresh calls getGlobalUsage|expected owner|keeps leftover summary|list refresh issued before a save|stale|link" --run src/vs/workbench/contrib/conversation/test/browser/engineHooksSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineTokenUsageSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineMcpRuntimePanel.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineToolsSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineCatalogSections.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineSkillsSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineProviderModelSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineOverviewSection.test.ts --run src/vs/workbench/contrib/conversation/test/browser/engineWriteGate.test.ts`

Hooks 靠 `pairing-hold still paints disconnected`、`true disconnect still paints disconnected`、`refresh catch-path`。Token Usage 靠 `late response after dispose`、`refresh calls getGlobalUsage`。Overview 靠 `expected owner`、`keeps leftover summary`。Tools 的保存前列表靠 `list refresh issued before a save`（`engineToolsSection.test.ts:831`）。`stale` 与 `link` 仍覆盖 Runtime 和写路径。新断言的标题里要带 `link` 或 `stale`，否则这条 grep 跑不到它。Agents 的新断言放在 `engineCatalogSections.test.ts`，同样带 `link`。`engineWriteGate.test.ts` 已锁闸本身，本条不改闸的单测期望，除非编译签名被迫改动——不改签名。源码旁的 `browser/engineMcpRuntimePanel.test.ts` 不搬。

风险与回退：Agents / Tools 的行为变化会让「链路已换、刷新没跑」的晚到列表消失，用户看到的是上一次成功列表或空的加载失败，而不是旧链的目录。这是刷新闸已有的定义。一片回退只恢复该分区的手写代次。Skills 片若把 `sameReadableOwner` 收成 `sameReadOwner`，`setSkills` 期间进入 pairing-hold 仍会画工具栏。新断言锁两件：link 相同且 owner 已作废则不落地；列表返回后进入 pairing-hold 则不画工具栏。

## 待定项

2026-11-05 用户拍板，四项都按推荐：1 选 A，专用快照字段另开合同（[D1399](../progress/deferred-gaps.md)），合同签收前按 C 保留 `typeof`；2 本稿不做；3 选 C，不新增服务；4 不新增 `LatestRequest`。下面的选项留作记录。

### 1. Memory、Token Usage，以及网页类没有的写方法

这些成员没有能力键，也没有 `gitWriteCapability` 那种专用字段。桌面 `typeof` 恒真，网页因为类上没有方法而为假。不新增字段就无法在桌面区分「代理函数」和「引擎广告过」。

| 选项 | 含义 |
|------|------|
| A | 为这些成员加专用快照字段，三态，不进 `UniverseAgentCapabilityKey`，Overview 不因此多行。做法对齐 `gitWriteCapability` / `conversationEntryCapability` / `listFilesCapability`。探测哪些 RPC、未广告是否 `UNSUPPORTED`，要另写合同 |
| B | 把它们加进 `UniverseAgentCapabilityKey`。Overview 按该键画行，和三份已落地合同「不塞进该键」相反 |
| C | 维持今天的 `typeof`。桌面在已连接时仍显示这些按钮 |

推荐 A，而且单独开合同，不放进本稿切片。推荐不做 B。在 A 被签收前按 C 留着代码。A 是新快照字段，和本稿「不发明快照字段」冲突，所以不能由实施方案自行加上。

### 2. 可选方法改必填，网页一律 unsupported

`IUniverseAgentConnection` 有 171 个可选成员。改成必填后，网页要给每个方法一个拒绝实现，桌面代理本来就是函数。三份已落地合同写明不把可选方法改成必填。

改完之后，今天靠「网页没有该方法」隐藏的 Rules / Provider / Model / Memory 写按钮会变成函数。`typeof` 不再能当网页开关。必须先有待定项 1 的字段，按钮才看字段。

推荐本稿不做。以后要做，也得排在待定项 1 之后，并改掉那些 `typeof` 开关。

### 3. workbench 级写闸服务

服务返回 `{ live, reason }`，并负责 `ua.engineConnected`。

| 选项 | 含义 |
|------|------|
| A | 新服务。Navigator 与 Sources 仍各走各的入口，服务只是注册 context key 和转发原因句 |
| B | 新服务，内部合成一个 live。探针的「强制已连接」和名册的「未连接视为 ready」并成一次判断 |
| C | 不新增服务。本稿第 3 节的纯函数就够 |

推荐 C。写结果闸已经是 `engineWriteGate.ts` 里的函数，不是服务。context key 绑在视图自己的 scoped context 上，服务要再持有每个视图的 key。B 会改其中一套入口的短路，和 `conversationSessionReadiness.ts:40` 的注释相反。若以后仍要 A，服务不得调用 `evaluateEngineWrite`，也不得把两套入口收成一个布尔。

### 4. 通用 LatestRequest

`EngineRefreshGate` 已经是列表刷新的代次原语（代次 + 已发布链路 + dispose）。写路径的在途代次按已签收合同只进 `evaluateEngineWrite` 的 generation 字段，今天用它的是 MCP Remove。Skills 的正文代次和 `invalidatedOwner` 不是同一种东西。

推荐不新增 `LatestRequest`。再加一个类型，分区会有两个代次对象。

## 切片依赖

```text
扫描
    不改生产文件，与下面各片并行

Sources ready
    → Diff 事实组装
      （两片都改 sourcesDiffPanelView.ts 与 conversationDiffReviewPane.ts）

Navigator 布尔式
    只改 navigatorAgentsView.ts 与 navigatorTeamList.ts

链接通知（Memory、Rules、Skills、Plugins、MCP）
    同一文件上，先于该文件的刷新代次和控制器

刷新代次（Hooks → Token Usage → Runtime → Tools → Agents → Skills → Provider/Models → Overview）
    同一文件上，先于该文件的控制器

控制器（Hooks → Rules → Tools → Runtime → Agents → Skills → Plugins → MCP）
```

Skills 的三步都落在 `engineSkillsSection.ts`：链接通知，刷新代次，控制器。Rules、Plugins、MCP 已有 `EngineRefreshGate`，只有链接通知然后控制器。Memory 只有链接通知。

待定项 1–4 不在上面的依赖里。

## 上一轮已经写进正文的决定

这些决定在第 1–4 节，不依赖另一份旧稿：

- Team 的 `typeof` 不单开行为切片。`refreshTeamData` 在调用 `listTeamsForInfo` 之前已经对 `UNSUPPORTED` 和 `UNKNOWN` 返回。删掉 `662` 不减少 RPC。
- `isKeepLeftoverListFailWrite` 仍是多处私有方法，转调 `isConversationSessionNotReady`。本稿不改这些私有方法。
- Skills 的代次比较在 `817`、`830`、`837`、`845`、`1121`、`1123`。owner 函数不能收成一个。`767` 改为 `begin()`。
- Provider 与 Models 是两套列表代次、两个 `dispose`，各用一个 `EngineRefreshGate`。`catalogGeneration` 不迁。
- 扫描按第 1 节的三条失败式建允许清单，范围含 navigator 与 sources。
- Sources ready 与 Diff 组装改同一对文件，先后进行。
- Triggers / Context 的断开刷新也会递增写代次或读代次，和 Clipboard 一样不进控制器。
- Runtime 用已有的 `test/browser/engineMcpRuntimePanel.test.ts`。Hooks、Token Usage、Runtime、Tools、Agents 的列表 `dispose` 都改为 `invalidate()`。Agents 的 `516` 仍递增 `agentToolsLoadGeneration`。

上一轮未采纳，本轮仍然有效：不把 Team 的 `typeof` 删掉。生产路径在 `SUPPORTED` 才走到它。删了不减少 RPC，只会让「SUPPORTED 但替身没有方法」从返回 `[]` 变成抛错。

## 审查处理

2026-11-04 只读审查。frontmatter `status` 保持 `draft`。对照活码后，下面没有与 HEAD 或已签收写闸方案冲突的条，也没有核验后不成立的条。

### 保留

- 不发明 RPC 或快照字段。能力键、三态、可选方法不改必填，与 `conversation-entry-capability.md`、`sources-git-write-capability.md`、`sources-files-list-capability.md` 一致。待定项 1 仍是未拍板，不能由实施自行加字段。
- `EngineRefreshGate` 的代次、link、dispose，以及「刷新代次只属于刷新闸」，沿用已签收写闸方案。不改 `isCurrent` 三条件。Clipboard / Triggers / Context 的写代次不迁。
- 第 1–3 节行为不变。第 4 节「链路变了且没再进 `refresh()` 则晚到列表不画」仍是要接受的行为，不加开关。
- 切片按文件先后。Navigator 与 Sources 两套短路不合成一个布尔。待定项 1–4 不进切片。

### 采纳

**Critical。** 第 4 节 Skills / Provider / Models 的落地行号补全。活码里 `engineSkillsSection.ts:845` 的 `catch` 仍是 `generation !== this.refreshGeneration` 且配 `sameReadOwner`。`ownsProviderResult`（`582`–`585`）以及 `428`、`537`、`539`、`551`、`732`、`759`、`805` 仍比 `providerRefreshGeneration`。`ownsModelResult`（`1165`–`1168`）以及 `1050`、`1124`、`1126`、`1149`、`1249`、`1266`、`1296` 仍比 `refreshGeneration`。只改递增和原先列出的几处直接比较，失败或成功收尾会判错。第 6、7 片改为：这些代次比较和 `owns*Result` 里的代次相等都换成 `isCurrent`；已连接和非 pairing-hold 留在 `owns*Result`。

**Important。**

- 扫描失败式改成三条：四个接收者上的点成员、括号成员、同一函数里从这些接收者取出的局部。括号形式和 Memory 六处因此算命中，漏了会红，新增同形也会红。参数和跨函数不算命中，避免把 `sourcesChangesGitWrite.ts` 的 `hook` 参数算进去。
- 第 3 节 `--grep` 改成标题里真实有的片段。`engine session not ready` 与 `KEEP leftover` 覆盖 Diff 面板、变更列表、Review 列表。`conversationDiffReviewPane.test.ts` 另用 `ApplyHunks|Local Git completion`，因为该文件标题里没有前两句。Navigator 三份分别用 `ua.engineConnected`、`Refresh is unavailable when engine is disconnected`、`KEEP leftover list-fail closes Inspect`、`ViewTitle exposes a read-only Refresh`。
- 第 4 节 `--grep` 补上 Hooks、Token Usage、Overview 标题里有的片段，并保留 `stale|link`。`engineMcpRuntimePanel.test.ts` 加入同一条 `--run`。新断言标题要带 `link` 或 `stale`。
- 「Electron 不加载这类 `test/node`」不成立。Electron 收集 `**/test/**/*.test.js`，conversation 的自定义门禁 glob 包含 `conversation/test/node`。D17 只跳过 `universeAgent/test/node` 名单。扫描测试会进 Electron 门禁，Node 入口仍可单跑。

**Minor。**

- Hooks / Token Usage / Runtime / Tools / Agents 的列表 `dispose` 收成一句：改为 `invalidate()`。删掉「或只看 dispose，二选一」。
- Agents `516` 的 `agentToolsLoadGeneration++` 写明必须留下。`1433` 与 `1439` 仍比这一字段。
- 第 7 片把 `catalogGeneration` 写进不迁。它在 `205`、`599`、`605`、`614`，管 models.dev 目录。
- 网页类没有的方法补上 `searchMemory`。网页类在 `probeEngine`（`universeAgentConnectionService.ts:348`）结束；局部检查在 `engineMemorySection.ts:272`。
- 上一节改成直接陈述决定，不再用读者看不到的旧稿原话做对照。
- p4 未签收。本稿第 8 片改 Overview，并写明两稿同时实施时，p4 边界那句要补上 Overview。本轮只改本稿。Composer epoch 与连接页六代次的边界与 p4 后半一致，不迁。

### 不采纳

无。
