---
title: "会话工作根与 Workbench 双层状态"
type: plan
status: draft
phase: N/A
updated: 2026-10-16
summary: "PRD-029：路径按会话工作根解析（会话 workDir，缺省连接 workDir），本地根沿用 SCM 根优先；项目层按引擎身份 + 工作根，v1 只装 Preview 的 Code 类别；会话层按会话 id。并排会话的 Preview 跟显式切换。换引擎留在原窗口，断旧连接前只提示本窗口等待确认的会话。S1–S4 已全面落地合入（提交 4615d3aa990 与 b6bccf8ff2c）。Preview 换入换出等 PRD-027 P3。不升 PRD。"
---

# 会话工作根与 Workbench 双层状态

> **落地：** S1–S4 已全面落地合入（提交 `4615d3aa990` 与 `b6bccf8ff2c`）。路径按会话工作根解析、消费方接入、换引擎提示门与会话/项目层存储已落地通过；Preview 换入换出（S5）等 PRD-027 P3。不升 PRD。

需求：[PRD-029](../../docs/product/requirements.md#prd-029-会话工作根与-workbench-状态跟随会话)（`proposed`）。

现在决定路径根的有三样东西：窗口打开的文件夹、连接快照的 `workDir`、会话自己的 `workDir`。各功能各取一样，切会话或换引擎时，有的跟着变，有的不变。本稿把根统一成**会话工作根**，再把 Workbench 状态分成项目层和会话层，按 Singularity 的双层模型处理切换。

## 1. 现状

| 功能 | 现在用哪个根 | 切会话或换引擎时 |
|:--|:--|:--|
| Sources Files（`sourcesFilesExplorer.ts`、`sourcesFilesList.ts`） | 会话 `workDir`；等于窗口根用本地 Explorer，否则走 `listFiles` | 跟着变 |
| Sources Changes 与 Review 列表（`sourcesChangesReadModel.ts`；`sourcesReviewList.ts` 272 / 419 行读同一份快照） | 列表来自 `ReadGitChanges(sessionId)`；行根由 `resolveSourcesGitResourceRoot`（`sourcesChangesGitRead.ts` 150–165 行）决定：会话 `workDir` 恰好等于一个 SCM 根，没有 SCM 根时才比窗口文件夹 | 匹配不上时行是 `sources-git-unrooted`，打不开 |
| Review 归因（`sourcesReviewAttributionService.ts`） | **连接** `workDir` 对比窗口根 | 不跟会话 |
| Review 审阅进度（`sourcesReviewProgressService.ts` 274 行） | **连接** `workDir`；按 `resource.fsPath` 匹配 | 不跟会话 |
| 「查看更改」（`conversationReviewNavService.ts`、`conversationReviewEntry.ts` 223 行） | 会话 `workDir`，缺省连接 `workDir`；仍要求等于窗口根且有 SCM provider | 半跟随 |
| 身份条（`conversationIdentityStrip.ts` 47 行） | `folders.at(0)` 与它的 SCM 分支；文件夹菜单在本窗口重开别的文件夹（322 行），分支菜单在该文件夹上本地 checkout（376 行） | 不跟会话 |
| Navigator Projects（`navigatorProjectsTree.ts`） | 按会话 `workDir` 分组，缺省连接 `workDir`；“current workspace”按窗口根 | 分组跟，标签不跟 |
| 引擎设置的项目作用域：`engineMcpSection.ts` 643 行、`engineAgentsSection.ts` 1491 行、`engineToolsSection.ts` 672 行、`conversationLensComposer.ts` 204 行，都不带参数；node 侧 `universeAgentConnectionService.ts` 1752–1840 行补连接 `workDir`（MCP 字段叫 `workDir`，AgentProfiles 叫 `projectPath`） | 连接 `workDir` | 不跟会话 |
| PTY 终端（`universeAgentPtyTerminal.ts`） | 引擎回报的 `workingDirectory` | 引擎决定，本稿不动 |

路径规范化至少有六份活跃函数：`sourcesGitChangeResource`（`sourcesChangesGitRead.ts` 168 行）、`sourcesFilesWorkDirIsWorkspaceRoot`（`sourcesFilesEngineRead.ts` 51 行）、`normalizeReviewPath` / `isWorkDirCompatible`（`sourcesReviewAttribution.ts`）、`normalizeNavigatorWorkDirKey`（`navigatorProjectsTree.ts` 46 行）、`normalizeAgentWorkDirKey`。

Workbench 状态全按窗口存：Preview 编辑器是窗口级的；`StorageScope.WORKSPACE` 存着 Files 列表模式（`sourcesFilesExplorer.ts` 142 / 175 行）、透镜 id（`conversationLensProjection.ts` 313 / 325 行）、编辑器工作集（`editorParts.ts` 847 行）；Sources 当前标签只在内存。

换引擎有两个入口，都在 Connection 首选项：选中 profile 后连接，以及 Direct Address。Direct Address（`handleDirectConnect`，1530–1537 行）先调 `ensureDirectAddressProfileForConnect`：忘掉同一端点的旧 profile，旧 profile 正连着就**先断开**（1548–1563 行），再以新的 `profileId` 加回来（1566 行），最后才进 `connectProfileWithPairing`（1722 行）。两个入口切换前都不看有没有待处理的会话。

引擎连接是 electron-main 里的单例，所有窗口共用（`app.ts` 1414–1423 行；[published-link-identity](published-link-identity.md)：全应用一条连接，roster 按 `engineIdentityId` 分桶）。快照上的 `engineIdentityId` 与 `workDir` 每次清掉已发布链路时都会清空（`universeAgentTypes.ts` 1606 行：“Must not keep a previous engine's id”）。

## 2. 外仓参照

只作 `source`，不继承正文。Desktop 文档在 [TIIEHenry/UniverseAgentDesktop](https://github.com/TIIEHenry/UniverseAgentDesktop)；Singularity ADR 本仓有镜像，在 `UniverseAgent/dev/decisions/singularity/`。

| 来源 | 取用的结论 |
|:--|:--|
| Singularity ADR-297 D4 | Navigator 作用域取当前会话的引擎（`scopedEngineProfileId = activeSessionEngineProfileId`）。点引擎树节点只折叠；只有显式入口才切换引擎级 store |
| Singularity `engine-scoped-workspace-sidebar`（已归档，IA 被取代，不变量仍在用） | 工作目录挂在会话上（`switchWorkDir(sessionId, …)` + `SessionLocation`），禁止改连接配置的 `workingDirectory` 来表示项目；同一路径在不同引擎上是不同项目 |
| Singularity ADR-243 | 会话绑定引擎时钉一次项目根（git toplevel），之后不随 cwd 漂移；无 git 退回会话私有 |
| Singularity ADR-250 | `ProjectWorkbenchState`（键 = 项目根 + 引擎 + locator）放标签目录与运行时，同项目共享；`SessionWorkbenchChrome`（键 = 会话 id）放 L1/L2 选择、过滤、几何。同项目切会话只换 chrome，禁止释放运行时；切子 Agent 不写 Workbench |
| Singularity detached session window | 单会话窗口只显示引擎、Workspace、workDir 上下文，没有引擎切换器；与主窗口共用订阅 |
| Desktop `dev/plans/attention-and-action-reachability.md` | 换引擎在原窗口进行。INV-ATTN-SWITCH-1：当前引擎有待处理或生成中的已打开会话时提示一次，不阻断。多引擎并发连接是选项 E，推迟到另一份 ADR |
| Desktop `dev/plans/scope-band-chrome.md` / `dev/plans/shell-typed-hosts-and-bottom-panel.md` | Desktop 的标签目录只做到会话私有；切会话关临时标签，钉住的终端属于项目，不卸下 |

## 3. 决定

### 3.1 换引擎留在原窗口

连接是全应用一份，“每个引擎开一个窗口”就等于 Desktop 推迟的选项 E（main 按 profile 持有多条连接，窗口绑定其中一条）。本稿不做，要做另立 ADR。

换引擎仍走 Connection 首选项。提示门放在**任何断开、忘记 profile、拨号之前**：选中 profile 连接时在 `connectProfileWithPairing` 入口；Direct Address 在 `handleDirectConnect` 调 `ensureDirectAddressProfileForConnect` 之前。取消就什么都不做，旧连接不动。

是否算“换引擎”：目标与当前连着的是同一端点就不提示。Direct Address 比规范化后的 `host:port`（它每次都会换新 `profileId`，不能比 id）；选中 profile 比 `profileId`。拨号前拿不到目标的 `engineIdentityId`，所以不能用身份判定。这样钉死引擎反复重连 `127.0.0.1:50061` 不会被提示。

提示里数的是**本窗口已打开、且有待确认座位**的会话（`hasPendingAttentionSeat(sessionId)`，引擎路径只看已缓存投影的会话，`conversationEngineRosterService.ts` 913–920 行）。“正在生成”只有 Inbox 浮层里的私有判定，只看自己那片叶的 `hasStreamingEntry()`（`conversationInboxOverlay.ts` 281–287 行），没有按会话的只读来源。v1 不数正在生成。连接是全应用的，其他窗口里的会话不计入，提示文案写明“本窗口”。

### 3.2 会话工作根

```ts
interface IAgentWorkRoot {
	readonly sessionId: string;
	readonly engineIdentityId: string | undefined;
	readonly workDir: string | undefined;            // 会话 workDir，缺省连接 workDir
	readonly source: 'session' | 'connection' | 'none';
	readonly access: 'local' | 'engine' | 'none';
	readonly localRoot: URI | undefined;            // access === 'local' 时才有
	readonly projectKey: string | undefined;        // 见 3.3
}
```

- 解析：会话 `workDir` 去空白后非空就用它；否则用连接 `workDir`；都没有则 `source: 'none'`。这与 BH-12-7 修复后「查看更改」的取法一致（会话优先，缺省连接），也与 Navigator 的分组一致。
- 本地根：沿用 `resolveSourcesGitResourceRoot` 的优先级。`workDir` 恰好等于一个 SCM 根时，用这个 SCM 根；没有 SCM 根时，恰好等于一个 `file:` 窗口文件夹就用它；多个候选或都不等时不猜。有 `localRoot` 就是 `access: 'local'`，否则有 `workDir` 就是 `'engine'`。这样嵌套仓库（窗口 `/a`，仓库 `/a/b`，会话在 `/a/b`）仍是本地，Changes 现有行为不退化。放宽到 loopback + `sharedFsRootSent` 不在本稿。
- 断连与配对：解析器自己缓存**最后一次提交的**连接 `workDir` 与 `engineIdentityId`。快照清掉它们（配对等待、断连、换链路途中）时继续用缓存；新链路提交后（`linkId` 变化且快照带回值）才替换缓存。新链路没有身份时缓存清空，不沿用旧引擎的身份。所以配对等待和真断连时工作根与 `projectKey` 都不变，事件不发。
- 不钉根：ADR-243 钉根防的是 cwd 漂移，本仓会话 `workDir` 只由引擎的 `List` / `Info` 写入，workbench 也不调 `switchWorkDir`，没有漂移来源。以后接 `switchWorkDir` 时再议。
- 不探测 git toplevel：远程引擎在客户端跑不了 `git rev-parse`，项目键直接用工作根。
- 规范化合成一份纯函数，放在 `workbench/services/agentSession/common/agentWorkRoot.ts`：反斜杠转斜杠、去尾斜杠，`file:` 比较走 `normalizePath` + `removeTrailingPathSeparator`。§1 的五份改为调用它。

服务挂在既有 `IAgentSessionContext` 上（`workbench/services/agentSession/common/agentSessionContext.ts`），实现在 `conversation/browser/agentSessionContext.ts`。那里已注入 roster 与连接，再加 `IWorkspaceContextService` 和 `ISCMService`。新增成员都是可选的（与已有的 `getSessionWorkDir?` 一样），免得约十个测试替身一起改：`getWorkRoot?(sessionId)`、`getActiveWorkRoot?()`、`onDidChangeActiveWorkRoot?`。以下变化会触发重新解析：roster 的 `onDidChangeActiveSession`、`onDidChangeSession`，连接的 `onDidChangeConnection`，`onDidChangeWorkspaceFolders`，以及 SCM 仓库增减。事件按 `sessionId|engineIdentityId|规范化 workDir|access|localRoot` 去重，只在变化时发出。

### 3.3 项目键

`projectKey = engineIdentityId + '\n' + 规范化 workDir`。引擎身份缺省或 `workDir` 缺省时，`projectKey` 为 `undefined`，项目层退回会话私有，存储键改用 `session:<sessionId>`。身份缺省时不共享，是为了避免两台引擎上的同一路径串在一起（PRD-029 验收 9）。

### 3.4 双层状态

| 层 | 键 | 内容 |
|:--|:--|:--|
| 项目层 | `projectKey`，缺省用 `session:<id>` | Preview **Code 类别**里的编辑器与分屏；Sources Files 列表模式 |
| 会话层 | `sessionId` | Code 类别里上次激活的编辑器；Sources 当前标签（Files / Changes / Review）；Conversation 透镜（对话 / 轨迹） |
| 窗口级，不动 | — | Preview 其他六个类别（Overview、Terminal、Web、Planning、History、Artifacts）与当前类别；浮动编辑器窗口；各 Part 尺寸与显隐、底部 Panel、窗口打开的文件夹 |

和 ADR-250 的差别：

- ADR-250 把宽度、布局放在会话层。本仓的 grid 布局是窗口级的，壳不变量见 [ADR-006](../decisions/006-shell-invariants.md)，切会话改宽度会让整窗跳动，所以几何留在窗口级。
- ADR-250 把终端放在项目层。PRD-027 的 Terminal 类别把编辑区终端放进 Preview，只换 Code 类别就不会动到它们；终端、Web、Artifacts 等类别要不要跟项目，见开放问题 4。

### 3.5 切换事件

| 事件 | 行为 |
|:--|:--|
| 切到同项目的会话 | 只加载会话层；Code 类别不保存也不换；如果该会话上次激活的编辑器仍开着，就激活它 |
| 切到不同项目的会话 | 先存当前 `projectKey` 的 Code 类别，再换成新 `projectKey` 的（没有就清空 Code 类别），然后加载会话层 |
| Conversation 里切子 Agent | 不写任何层 |
| 两个会话叶并排，在叶之间换焦点 | 聚焦叶就是当前会话（`conversationSessionWindowService.ts` 561–565、647–649 行），Sources 与会话层跟着换；**Preview 项目层不换**，仍是最后一次显式切换会话时的项目，免得每点一下整块 Preview 换一遍 |
| 换引擎 | 先按 3.1 提示；连上后 roster 换桶、当前会话换掉，按“不同项目”处理 |
| 配对等待、断连、名单未就绪 | 工作根按 3.2 保留；Preview 不存不换；Sources 按各自已有的 KEEP leftover 规则 |
| 会话被删除 | 删它的会话层存储；项目层留给同项目的其他会话 |

“显式切换会话”指从 Navigator、会话切换菜单、新建会话或打开会话窗口导致的当前会话变化。实现上需要 `switchSession` 区分“叶聚焦”和“显式切换”，S5 设计时定接口。

未保存的编辑器：换 Code 类别时，未保存的不关，留在 Preview 里，跟进新项目（PRD-029 验收 4 接受）。要不要加“来自另一项目”的标记，见开放问题 1。

### 3.6 与 PRD-027 的顺序

PRD-027 的 P2（组按类别归属与显隐）已于 2026-10-05 落地，P3 未做（[preview-category-isolation](preview-category-isolation.md)）。HEAD 的 `CategorizedMainEditorPart` 每个组属于一个类别，归属存在单独的 memento（`OWNERSHIP_KEY = 'previewCategory.groups'`），不在 `createState()` 里；`applyState` 之后靠 `adoptExistingGroups` 重新认领。

所以 S5 **不用** `saveWorkingSet` / `applyWorkingSet`：

- 应用工作集会关掉浮动编辑器窗口（`editorParts.ts` 740–753、818 行），并重建整个主编辑区，七个类别一起换，类别归属要么丢掉、要么被重新认领错。
- `saveWorkingSet` 每次新增一条 UUID 记录，从不覆盖（771–781 行），按项目反复保存会无限增长。

S5 只换 Code 类别组里的编辑器，按 `projectKey` 自己存一份 Code 类别的组与编辑器描述，换项目时只在 Code 类别组里关开编辑器。具体做法要等 P3 定稿后，按那时的组模型另写设计并走规则 16。S1–S4 不碰 Preview 网格，可以先做。

## 4. 不做什么

- 不按引擎开窗口，不做多引擎并发连接，不改 ADR-003。
- 不改窗口打开的文件夹（不调 `IWorkspaceEditingService.updateFolders`）。单文件夹窗口换文件夹会重载窗口、重启扩展宿主；远程引擎的路径本机不存在。
- 不给引擎目录做 FileSystemProvider，VS Code 自带的 Explorer、Search 不跟会话。
- 不做“在其他工作目录新建会话”：`CreateSessionRequest` 没有工作目录字段，Navigator 的 `+` 仍只在连接 `workDir` 那一组。要做先按 [cross-repo-protocol](cross-repo-protocol.md) 向引擎提 `CreateSession.work_dir`，或者改成先建会话再 `switchWorkDir`，另开方案。
- 不动 PTY 终端、底部 Panel、Part 尺寸、Preview 非 Code 类别。
- 不改 roster 缓存的存储作用域（`conversationRosterStorage.ts` 86 行，仍按窗口存）。

## 5. 切片

测试路径相对 `src/vs/workbench/`。

| 切片 | 内容 | 验证 |
|:--|:--|:--|
| **S0** | PRD-029 `proposed`、本稿 `draft`、规则 16 只读审查并改稿（见 §8）；用户签收后本稿 `accepted`，PRD-029 `accepted` | `python3 scripts/check-docs-health.py`；`python3 scripts/generate-docs-status.py` |
| **S1 工作根** | `agentWorkRoot.ts` 纯函数（解析、规范化、本地根、项目键）；`IAgentSessionContext` 加三个可选成员；`AgentSessionContext` 实现、缓存最后提交的身份与连接 `workDir`、事件去重。五份旧规范化改为调用它，行为保持 | 新 `services/agentSession/test/common/agentWorkRoot.test.ts`：会话优先、空白回落连接、都无为 `'none'`、尾斜杠与反斜杠、SCM 根优先于窗口文件夹、嵌套仓库仍是本地、多候选不猜、身份缺省时 `projectKey` 为 `undefined`。`contrib/conversation/browser/agentSessionContext.test.ts`：同值不发、切会话发、换引擎发、窗口文件夹或 SCM 仓库变化影响 `access` 时发；快照清掉身份与 `workDir`（配对、断连）时工作根不变、不发；新 `linkId` 提交后替换；新链路无身份时不沿用旧身份 |
| **S2 路径消费方** | 见下方清单 | 见下方清单 |
| **S3 换引擎提示** | 按 3.1 放提示门，两个入口都在断开、忘记、拨号之前；同端点不提示；只数本窗口待确认座位 | `contrib/conversation/test/browser/connectionPreferencesPane.test.ts`：选中 profile 时有待确认座位就提示并写明条数，取消不调 `connectProfile`；Direct Address 取消时不调 `forgetConnectionProfile`、不 `disconnect`；同一 `host:port` 重连不提示；没有待处理会话时不提示 |
| **S4 会话层与项目层存储** | 透镜 id 改按会话存；Sources 当前标签改为按会话记；Files 列表模式改按项目键存。旧的窗口级键只回读一次当种子，不迁移、不删除 | `contrib/conversation/test/browser/conversationLensProjection.test.ts`：两个会话各记各的透镜。`contrib/sources/test/browser/sourcesFilesListMode.test.ts`：同项目两个会话共用列表模式，不同项目各自独立。Sources 标签：切走再切回恢复该会话的标签（用例落在 Sources 视图既有测试，S4 动工时定） |
| **S5 Preview Code 类别** | 等 PRD-027 P3 后按 3.6 另写设计并审查 | 设计稿定。至少覆盖：同项目切会话不关不开编辑器并激活上次的编辑器；不同项目先存后换；目标没存过时 Code 类别为空；未保存编辑器仍在；其他六个类别与浮动窗口不动；叶间换焦点不换；断连不换；切回原项目恢复 |

S2 清单（每项一条验证）：

1. 归因按 `record.sessionId` 取工作根，路径索引按会话分。`access === 'engine'` 时用行的 `gitPath` 作键，不依赖窗口根。验证：`contrib/sources/test/browser/sourcesReviewAttribution.test.ts`，会话与连接 `workDir` 不同时，chip 落在会话根下；引擎根的行也有 chip。
2. 审阅进度改读工作根；`access === 'engine'` 时按 `gitPath` 匹配，不用 `resource.fsPath`。验证：`contrib/sources/test/browser/sourcesReviewProgress.test.ts`，引擎根的行能记进度并在重读后保留。
3. 「查看更改」改读工作根；`access === 'engine'` 时不要求 SCM provider，记录的路径解析成与 Changes 行相同的 `sources-git-unrooted` 引用，打开走第 4 项。验证：`contrib/conversation/test/browser/conversationReviewEntry.test.ts` 保留 `blank session workDir falls back to the connection workDir`，加引擎根有行；`contrib/conversation/test/browser/conversationReviewNavService.test.ts` 加会话与连接 `workDir` 不同时按会话根解析。
4. Changes 与 Review 行根改用 `localRoot`（与现在的 `resolveSourcesGitResourceRoot` 等价）。`access === 'engine'` 时打开走已有的 `ReadGitFileDiff`，去掉 `sourcesChangeEntryOpen.ts` 80–82 行的未定根拒绝；diff 只有 hunk，不补全文。引擎不支持 `ReadGitFileDiff`（`!result.supported`，121–123 行）时不打开 `sources-git-unrooted:`，行仍标为不可打开并给不支持的说明。验证：`contrib/sources/test/browser/sourcesChangesList.test.ts`，引擎根的行能打开 diff；不支持时不可打开。
5. 身份条显示当前会话工作根的文件夹与分支：本地读 `localRoot` 的 SCM，引擎读 `ReadGitSummary.branch`。文件夹菜单不变（它是用户显式重开窗口，不属于切会话）；分支菜单只在 `access === 'local'` 时可用，在 `localRoot` 上 checkout；引擎根时分支只读、没有菜单。验证：`contrib/conversation/test/browser/conversationIdentityStrip.test.ts`，切会话后文件夹和分支跟着变；引擎根时没有分支菜单。
6. 引擎设置的四个调用点（§1 表）显式带当前会话的 `workDir`（MCP 用 `workDir`，AgentProfiles 用 `projectPath`），MCP 写操作同理。验证：`contrib/conversation/browser/engineMcpSection.test.ts`、`contrib/conversation/browser/engineToolsSection.test.ts`，请求带会话的工作目录。
7. Navigator：当前会话所在组标“当前会话”，本地文件夹组仍标“current workspace”，两个含义用两个标签。验证：`contrib/navigator/test/browser/navigatorProjectsTree.test.ts`，“当前会话”跟着当前会话换组。
8. §1 的五份规范化函数已在 S1 改调 `agentWorkRoot.ts`。S2 不要再改这五处的规范化实现。原有用例不改仍通过。

每片命令：`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --grep "<用例名>" --run <测试文件>`，加上编译和 eslint，门禁见 [health-gates](../progress/health-gates.md)。

## 6. 风险

| 风险 | 缓解 |
|:--|:--|
| 工作根事件过密，各功能反复刷新 | S1 按五元组去重，断连不发；消费方本来就有 generation 闸（Changes 读模型），归因、身份条在 S2 补上，丢弃晚到结果 |
| 换项目时在途的 `listFiles`、`readGit*` 把旧项目结果写进新项目 | 同上，按工作根键丢弃晚到结果 |
| 并排两个不同项目的叶，Sources 跟焦点换，Preview 不换，两边看起来不一致 | 2026-10-11 用户定：Preview 跟显式切换。Sources 头部显示当前会话 |
| 引擎根的行只有 hunk，没有全文 | 与现在的引擎 diff 一致，不补全文；引擎不支持时行不可打开 |
| 未保存编辑器跟进别的项目，被误以为属于新项目 | 3.5 已写明；见开放问题 1 |
| 身份缺省的旧连接方式（本机跳过鉴权）项目层全部退回会话私有，同目录会话不共享 | 有意为之，见 3.3 |
| Code 类别与类别归属 memento 冲突 | S5 等 P3 后另行设计，见 3.6 |

## 7. 开放问题（签收时定）

已定：

- 2026-10-11，用户：并排两叶在不同项目时，Preview 跟最后一次显式切换的会话，不跟叶间换焦点。见 3.5。
- 2026-10-11，实施：换引擎提示只数本窗口待确认座位。正在生成没有按会话的只读来源。见 3.1。

仍开放：

1. 跟进新项目的未保存编辑器，要不要在标签上标“来自另一项目”？建议 v1 不标。S5 才用到。
2. 没有自己工作目录的会话退到连接 `workDir`，与该目录下的会话共用项目层。也可以改成会话私有。实施按共用，与 Navigator 分组一致。
3. Terminal、Web、Artifacts 等类别要不要也跟项目？建议 v1 只换 Code。S5 才用到。

## 8. 只读审查

按 [DOCUMENTATION 规则 16](../../docs/DOCUMENTATION.md)，2026-10-11 派一名只读审查员，结论 Approve with changes。逐条核实后已改：

- Critical：3.6 原写“HEAD 还是单组过滤”，不对，P2 组归属已落。改为按 P2 模型说明为什么不用工作集，S5 等 P3 后另行设计；项目层收窄到 Code 类别。同时改正 PRD-027 摘要与追踪表里过时的“单组过滤”。
- Critical：Direct Address 在拨号前就断开旧连接并换新 `profileId`，原提示门放在 `connectProfileWithPairing` 拦不住。改为两个入口都在断开、忘记、拨号之前提示，同端点按 `host:port` 判定。
- Important：`applyWorkingSet` 会关浮动窗口、存储只增不删，已在 3.6 写明不用；Terminal 类别与 PRD-027 的关系写进 3.4 和开放问题 4；本地根改为沿用 SCM 根优先；引擎根的归因、进度、「查看更改」改按 `gitPath`，补了不支持 diff 时的行为；断连时快照会清掉身份与 `workDir`，解析器改为缓存最后提交的值；“正在生成”没有按会话的来源，3.1 写明先补查询、做不到就降级，只数本窗口；补上 `engineToolsSection.ts` 与 `conversationLensComposer.ts` 两个调用点；身份条菜单按 `access` 定；并排叶换焦点不换 Preview。
- Minor：规范化函数改为五份；去掉没有切片承接的“树展开”；同项目激活上次编辑器写进 S5；Navigator 两个标签分开；测试路径写全，`agentWorkRoot.test.ts` 定位置；新接口成员改可选；补 Desktop 仓链接与文件路径。
