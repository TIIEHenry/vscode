---
title: "Sources 系统概览：Files | Changes | Review"
type: overview
status: accepted
phase: N/A
updated: 2026-10-27
summary: "SOURCES_PART 槽 + SourcesTabsHost；Files 挂资源管理器同一棵工作区树，列表模式只把树换成当前目录的一级列表，面包屑和标题操作仍在。列表模式在当前目录解析完成后，没有子项写 This folder is empty.，有子项但筛选后没有可见行写 No matching files.，解析未完成不写。Part 宽至少 600px 时三个 tab 的筛选收到标题栏。不注册活动栏图标，打开不带动侧栏。Changes/Review 接通走 readGit* 否则 SCM；Accept 定为暂存光标 hunk（方案未实施前无载荷不显示）；Diff 默认 Preview。Sources 变更读收成 ISourcesChangesModel；Changes 与 Review 投影同一快照，会话事实走 IAgentSessionContext。Accept 仍无载荷不显示。P3 身份跟着条目走已落。P6 与 P7 已落；方案 sources-architecture 仍 accepted。禁用钮带原因 title / aria-label；首拉失败且无旧条目时错误只进空区，不重复写底栏。Changes 右键另一种标签打开失败时，状态行与单击一样写打开失败，成功则清掉，不标已审阅。"
---

# Sources 系统概览

> 导航：[系统索引](INDEX.md)。需求：[PRD-005](../../product/requirements.md#prd-005-preview-与-sources)。Diff：[PRD-009](../../product/requirements.md#prd-009-changes-与-diff) · [ADR-005](../../../dev/decisions/005-changes-diff-owner.md)（`accepted`；ADR-004 已 superseded）· 实施 plan [sources-changes-diff](../../../dev/plans/sources-changes-diff.md)。

## 1. 结构

```text
SOURCES_PART（End 列下格；minimum 尺寸与 hide 关闭控件在 Part）
├── tabHost      ← SourcesTabsHost 画 Files | Changes | Review tab strip
└── contentHost  ← 当前 tab 的面板：Files 资源管理器（标题操作、面包屑、树或一级列表）/ Changes·Review 列表
    标题栏宽 ≥ 600px 时，当前 tab 的筛选在 tab 与隐藏按钮之间；更窄时筛选回到各面板
```

`SourcesTabsContribution`（`workbench.contrib.sourcesTabs`，`AfterRestored`）等 `ISourcesPartService` 的两个槽都注册后挂 `SourcesTabsHost`。tab 状态在 `common/sourcesTabs.ts`：`SourcesTabId = files | changes | review`，默认 Files，`nextSourcesTab` 循环。

## 2. 三个 tab

| tab | 模型（`common/`） | 视图（`browser/`） | 数据源 | 行点击 | 列表操作 |
|-----|-------------------|--------------------|--------|--------|----------|
| Files | `IExplorerService` / `ExplorerModel`（与侧栏同一份） | `sourcesFilesExplorer.ts`（`SourcesFilesExplorer` 继承 `ExplorerView`，`SourcesFilesExplorerHost` 用 `PaneView` 挂进 `#sources-panel-files`） | 工作区文件夹树。标题是工作区名，旁边是新建文件、新建文件夹、刷新、全部折叠，再往后是「按树查看 / 按列表查看」。下面是位置面包屑。列表模式只把树换成当前目录的一级：文件夹单击进入该目录并延长面包屑，文件单击仍按打开方式；面包屑点到工作区之外会回到工作区文件夹。模式记在工作区存储 `sources.files.listMode`，设置里不提供 `sources.files.viewMode`。没打开文件夹时不挂树。不注册视图容器，所以活动栏不新增图标，侧栏那棵树也不被换掉。`sourcesFilesList.ts` 仍留在仓里，Files 面板不再构造它 | 单击和 Enter 按 `sources.editorOpenMode` 打开；分屏不读这项。打开和在这里新建文件都不带动侧栏定位。列表里没有选中项时，新建落在当前列出的目录 | 新建、重命名、删除、复制、拖放、刷新、折叠，与侧栏资源管理器相同。列表里「全部折叠」回到当前工作区根 |
| Changes | `sourcesChangesGitRead.ts::tryLoadSourcesGitChangeEntries` · `sourcesChangesModel.ts::collectSourcesChangeEntries` | `sourcesChangesList.ts` | 接通且 `readGitChanges` hook 在且 `IAgentSessionContext.getActiveSessionId()` 非空：`readGitChanges` / `readGitSummary`（引擎行 `sessionId` 是该次 ReadGitChanges 的会话；leftover 写入沿用条目上的 sessionId）；空 session / 断连 / 首拉无 hook / `supported:false` / `supported:true` 且 `entries=[]`：`ISCMService` 各仓库资源组（快照保持 `scm`）。已引擎行 leftover 后再失 hook（仍 connected）保引擎行，不切 SCM、不画 `sourcesGitLocalOnlyMessage()` | `openSourcesChangeEntry`：按 `sources.diff.defaultOwner` 分派 — `preview`（默认）内置 API open/diff 应执行资源携带的主线程 command DTO；其余资源委托 `ISCMResource.open()`。D1387旧缺口已修复，窄合同经精确旧红/新绿及R3独立真实Git after签收；git 行且无本地 original 时再 `readGitFileDiff`（同样要非空 session）；无 SCM 时 `openEditor` 文件本体；`conversation` → `ConversationDiffReviewInput`；`panel` → `SourcesDiffPanelView` | 行内 / 选中 **stage** / **unstage**（`scm` 快照的 stage 只走 `git.stage`，0 次 `writeGitStagePaths`；`origin: engine` 的 stage 用条目 `gitPath` 与 `sessionId` 写 `writeGitStagePaths`，活动会话不一致、没有 `sessionId` 或 `gitPath === ''` 时不写也不退回 `git.stage`；unstage 始终是 `git.unstage`，仅在有 `scmResource` 且组可 unstage 时，0 次 `writeGitStagePaths`）；底部 **commit**（`scm` 快照只走 `acceptInputCommand` / `git.commit`，0 次 `writeGitCommit`；`engine-live` 与 leftover 只用快照或条目 `sessionId` 调 `writeGitCommit`，未接受、unsupported 或抛错只写状态行，不退回本地提交） |
| Review | 投影同一份 `ISourcesChangesModel` 快照 | `sourcesReviewList.ts` | 同 Changes | 同 Changes（`openSourcesChangeEntry`）。单击、Enter、右键另一种和 Open Selected 共用打开完成合同：明确 `false`、helper 返回 `stale` 或抛错不标；内置命令与 custom resource 的 void 委托完成不等于可见 pane 证明。当前一代正常完成清自己的打开错误；Changes 打开不标 | 窗口内存审阅进度（●/○，`ISourcesReviewProgressService`）；Mark reviewed / Mark all /「仅未审阅」；`sources.review.showForPaths` path-set。横幅 “Showing N files from this turn” 数当前列表行（文本 + path-set + 仅未审阅）。进度 “Reviewed x / y” 和 Mark all 仍只看文本 + path-set，不因仅未审阅把已审行从分母拿掉。引擎接通后归因 chip（`onDidFileMutation` sidecar，按路径取记录，同一会话超过 500 条丢掉最旧的一条）；**无** stage/commit/写回 SCM |

行点击的标签槽和资源管理器分开。资源管理器单击文件默认在当前组新开标签（`explorer.editorOpenMode`，默认 `newTab`）。Sources 的 Files / Changes / Review 在打开到编辑器组时默认替换当前标签（`sources.editorOpenMode`，默认 `replace`）；文件已经在该组打开时改为切到那个标签。右键保留没被选成默认的那一种。Review 用这一种打开时，和单击一样：只有打开成功才标已审阅，失败写同一条状态且不标。Changes 右键打开不标已审阅；这次打开失败时，`.sources-changes-status` 和单击一样写 `sourcesGitDiffOpenFailureMessage`，成功则清掉这条打开状态，过期结果不写。Ctrl/Alt 单击和 Open to the Side 仍是分屏，不读这两项。目标是 Panel 时没有编辑器标签，不受 `sources.editorOpenMode` 影响。没传 `slot` 的移动动作保持原来的打开方式。Sources 打开编辑器时压住资源管理器的自动定位，导航树不跟着跳；之后再点到那个标签，仍按 `explorer.autoReveal` 定位。

Files 用资源管理器的 “Filter files”。Changes / Review 用紧凑 filter（`sourcesListFilterBox.ts` / `common/sourcesFilterModel.ts::filterSourcesEntries`，按文件名 / 路径子串）。Sources 部分宽至少 600px 时，当前 tab 的筛选框挪到标题栏 tab 和隐藏按钮之间，三个 tab 用同一套 22px 圆角输入；各自的文字还留在自己的框里，切换 tab 不会串。更窄时筛选回到面板里原来的位置。Review 的「仅未审阅」仍留在面板。空态节点 `flex: 1` 居中，JS 设 `display: ''` 好让 CSS 生效。Changes 行内描述是父目录（`sourcesChangesPresentation.ts`），分组名只出现在该组第一行的组头并带数量；休息态是状态字母，stage / unstage 在行悬停或焦点时出现，全部 stage / unstage 在组头。选中项工具条只在选中了可 stage / unstage 的行时出现。底部 commit 是多行说明加按钮。`sourcesGitLocalOnlyMessage()` 画在提交条上的状态点（`.sources-changes-provenance`），不另占一行；失败文案仍在 `.sources-changes-status`。Diff 宿主标题统一底边与 4px 8px 内边距；无 ref / 打开失败时藏 Panel 头与 Conversation「Open Diff in Preview」。

## 3. 诚实空文案

| 情形 | 文案（`*Strings.ts`） |
|------|------|
| Files 没打开文件夹 | `You have not yet opened a folder.`（不挂树） |
| Files 列表模式，当前目录已解析且没有子项 | `This folder is empty.`（查询非空也写这句，不写成筛选落空）。侧栏树模式不写。目录还在解析时不写 |
| Files 列表模式，目录里仍有子项，查询去掉空白后非空，可见行是 0 | `No matching files.`。有可见行（含筛选仍显示的文件夹）不写。侧栏树模式不写 |
| Changes 筛选无匹配 | `No matching changes.`。引擎 `sourcesFilesList`（Files 面板不再构造）自己的空目录 / 筛选句仍是 `This folder is empty.` / `No matching files.` |
| Changes/Review 首拉 `readGit*` throw | 没有旧条目时空区写 `Unable to read git changes: …`，**不**写 `No changes.` / `No changes to review.`，底栏状态行不重复同一句、Commit 行也收起；已有旧条目时错误留在底栏失败色 + `role=status`，列表照旧 |
| 无 SCM 提供者 | Changes / Review 空列表；不造假变更。Commit 在引擎回 `supported:false` 或没有可用写 hook 时写 `Git stage/commit commands are not available.`，不写「Unable to commit」 |
| Review | 有变更时 hint `Review progress stays in this window.`；无仓库时只留空态、不画 hint；**无假 review comment** |

## 4. 边界

- **同一棵资源管理器，两个视图**：Files 用 `SourcesFilesExplorer` 挂 `ExplorerView`，模型和侧栏共用 `IExplorerService`。侧栏仍是先注册的主视图，活动栏不新增图标。新建、重命名、删除、拖放、刷新和折叠在这一页可用。列表模式只换这一页的树，不换侧栏。当前目录解析完成且没有可见行时，空目录写 `This folder is empty.`，有子项但筛选后没有可见行写 `No matching files.`；解析未完成、侧栏树模式、或仍有可见行时不写。从 Sources 打开或新建文件压住侧栏的自动定位，导航树不跟着跳。`sourcesFilesModel.ts` 不增加 `fetchChildren`。Changes / Review 仍是列表投影。
- **不是** SCM 视图：接通后列表权威是引擎 `ReadGit*`（须非空 `IAgentSessionContext.getActiveSessionId()` **且** 非空 `entries`）；空 session / 断连 / 首拉无 hook / `supported:false` / 空引擎列表才投影本地 SCM。已活画引擎行后再失 `readGitChanges`（仍 connected）保 leftover，不把 SCM 装成权威（[D273](../../../dev/progress/deferred-gaps.md)）。`ReadGitChanges` / `ReadGitSummary` throw 与读失败同级（`sourcesGitReadFailureMessage`），不把 Summary 失败画成「无摘要」仍用引擎 entries。stage / commit 写出同样要非空 session；unstage 仍走 git 扩展命令。桌面 IPC 上 `writeGitStagePaths` / `writeGitCommit` / `writeGitApplyHunks` 恒为函数，Stage、Commit、Accept 改看连接快照 `gitWriteCapability`：未广告或探测为 UNIMPLEMENTED 时不发这三条写，能力未知时仍看方法是否安装。这三项不进 Engine Overview 的能力键。Review / Panel **Accept** 的产品语义（2026-09-25）是暂存光标所在 hunk：点击时现拉 `ReadGitFileDiff`，客户端切出单个 hunk，`argv` 为 `git apply --cached --whitespace=nowarn`。两侧 diff 会同步移动光标；Accept 只认仍聚焦的那一侧。点 Accept 时焦点已离开编辑器，沿用最后一次仍聚焦的那一侧记下的行。对侧同步过来的光标不改 hunk。从未聚焦过才退回修改侧当前位置。见 [sources-accept-stage-hunk](../../../dev/plans/sources-accept-stage-hunk.md)。该方案落地前，无真实载荷不得显示 Accept，不得把整段 `unified_diff` 或 monaco 两侧当 `patches`，不得把 `git.stage` 当 Accept 成功。空 `patches` 仍由宿主拒送。
- **Accept 读后写前授权**：Pane / Panel 在 FileDiff 返回后复核原 input/ref 与局部生命周期代次，input 自身销毁也算失效；以 fresh facts 重跑既有 Accept planner，只有当前 write session 与捕获的 read session 相同、当前能力/连接/hold/readiness/Changes 写门全开才发原 session 的单 hunk，不重定向或 fallback 本地 Git。采用写前当前授权，s1→s2→s1、同 id 重连或故障恢复后若当前门满足可继续；Session/List 失败的 catalog readiness 与 Git Changes 的 read-failed leftover 分别判断。已发写不假取消/补偿，迟到结果只向仍存活的原宿主写 UI。实现候选已写、[独立方案](../../../dev/plans/sources-accept-post-read-authorization.md)仍 accepted，54 新回归已有源码；ab43 的 A7 Minor 经 b2 补 4 例及原 Astra 窄 peer C0/I0/M0 关闭。旧 run1 已得双宿主授权业务红，阳性仅 3 个业务通过、Panel A3 与独立 input.dispose 业务未达，Panel VM owner 泄漏另立[生命周期方案](../../../dev/plans/sources-panel-diff-view-model-lifetime.md)，精确 a04draft 经规则16 C0/I0/M0 后 accepted 保持，父核 e949 后授权的 Panel 显式 VM/refs owner 与 detach→VM→refs 候选及 18 真实资源回归已写、仅静态未运行；44正式源码peer C0/I1/M0、生产静态符合边界，新same-ref短期resolver keeper修订5f4经原Astra窄peer C0/I0/M0及父采纳，I1关闭。连接先决已由[共同factory窄修订](../../../dev/plans/sources-panel-fixture-preinjection-amendment.md)经原Astra规则16 C0/I0/M1/root采纳后独立accepted，§3.4首段及标题/唯一锚点已改；root精确核f5a后另授权的最小Pane test-only共同预stub候选已写，仅factory旧helper前将条件收为一次无条件同connection stub；默认false/resolver/helper/旧case与生产/Panel.test保持，候选仍待新窄peer/唯一lane，不预称旧setup已到业务。原 Accept 合同与旧调用不变；[作者静态边界](../../../dev/progress/sources-accept-post-read-authorization-checkpoint.md#源码-peer-后补齐-a7)不代 peer / red / green，跨 engine 同 session 字符串归属不在本 scope。
- **Diff 归属**（[ADR-005](../../../dev/decisions/005-changes-diff-owner.md) / [sources-changes-diff](../../../dev/plans/sources-changes-diff.md)）：Changes / Review 行点击经 `openSourcesChangeEntry` 解析 `ISourcesChangeRef`，按 `sources.diff.defaultOwner`（默认 `preview`）分派。三 owner 保留：Preview 的 SCM 内置 API open/diff 应按已有常量分派资源携带的 command DTO，其他资源仍委托 `resource.open`；无 SCM 资源时按 original/modified 打开真实 diff 或文件。Conversation 使用只读 `ConversationDiffReviewInput`，由当前活动 session 找到准确 part 与根旁 side group，复用公共 slot helper；不以全局最近叶 token 重新选目标。Panel 使用 `SourcesDiffPanelView`，`renderRef` 用代数闸丢弃过期 await。`matches()` 与打开身份仍包含 original、modified、groupId 及既有会话身份。**D1387当前结论（2026-10-27）**：Preview API DTO分派、准确Conversation组和M01来源已修复；M0139/J425与[R3独立真实Git after](../../../dev/progress/default-editor-contract-audit-2026-10-26-evidence/r3-actual-after.md)签收，J67快照/510断言0败，真实Pane按钮+四公开Move共五路径。D1387 closed、[窄方案](../../../dev/plans/sources-open-dispatch-and-conversation-target.md)implemented；宽sources-changes-diff和PRD不升，不扩成F4/F5整体通过。git-read 首拉失败空列表藏 Commit，不画「No changes.」。Sources 自身不做 inline diff（选项 C 已否决）。
- **打开与状态边界（D1387 合同）**：`sources.editorOpenMode` 的 newTab/replace/已开 reveal 同时适用于 Preview 与 Conversation；分派一次，不在 command 后再调 resource.open 兜底。内置 open/diff 的 context 使用官方参数位，provider 的显式 options 优先；API newTab 不预pin旧标签，以默认pinned新input保留旧preview。custom.open 只有 preserveFocus / void 合同，保留 await 与拒绝传播；仅 custom newTab 为保留旧preview继续预pin动作发起组的旧标签，即使no-op/reject/另组/外部打开也可能留下该pin，这是兼容成本，不能宣称零pin。命令 resolve<void> 不是失败，也不是可见完成证明；直接 editorService/slot 的 pane/undefined、Conversation load、Panel boolean 与 stale 维持各自门。分派后记录identity、pin新input或replace关旧tab只对核对了实际目标与宿主的input：API diff匹配DTO有序双侧，API open匹配单资源类型与URI；custom只用成对multiDiff URI或已记同resource/group的可信身份。单侧sourceUri/quickDiff不能把同文件另一比较或保留的别库diff冒认成本条，缺可信身份仍保持void且不做这些后置副作用。Review list 与 Open Selected 共用当前 open generation；成功只清自己的旧打开错误，stale 不改新状态，读失败/写失败不被顺带清除。`vscode.changes` 虽也可被 extHost 预转换，本波没有公共运行证据，不泛化任意 command 或声称所有 SCM API 已支持。
- **委托宿主核对（D1387窄合同已签收）**：相同完整比较tuple可同时存在于多个组，active/requested/visible次序不能代表provider实际目标。一次API/custom dispatch可局部观察既有`IEditorService.onWillOpenEditor`，但事件无operationId，只能给出匹配input/group候选。用同IEditorService实例的WeakMap活动registry，在listener/dispatch前同步登记；API key为不同file/diff类型+完整有序URI tuple，key/实际分派/匹配使用同一次同步捕获的command/args，不重读可变command。重叠同API key双方各自sticky ambiguous到自己的finally退出；所有custom按wildcard与同服务全部活动Sources委托冲突，不阻止dispatch。任一方先settle不能给仍pending者解锁，三操作后续直接冲突也须继续标记；finally及时移除自己的记录/监听。ambiguous只跳全部后置identity、新input pin及replace close，void仍true/reject原样，custom预pin窄例外不回滚。
- **候选与真实成员的边界**：未被上述Sources重叠污染时，await后仍须验证同一有效group及其真实已开完整身份成员（含组模型规范成的既有同matches实例），仅唯一可验证候选优先；will未落实/多候选不猜。完全无相关观测才扫描全部parts/groups的所有tabs作唯一可信fallback，不能裸active补宿主、再解析column造组或永远跳过多匹配替代B正例。provider明确inactive/activation保留A active而在B打开同tuple时，A原identity保留、B身份与move归属准确；inactive成功undefined不改变官方void合同，pane也不是万能因果证明。这项有界保护只覆盖Sources之间所定义的重叠，不声称非Sources同tuple外部打开的因果归属或任意窗口并发安全；不新增全局串行/服务/RPC/EditorService拦截。此澄清已按[方案§3.2](../../../dev/plans/sources-open-dispatch-and-conversation-target.md#32-slot打开身份与局部副作用)独立规则16 C0/I0签收，独立方案bf50后源码、29项回归、唯一lane验证与独立peer已完成；R3真实after已签收，身份和有限范围见[R3证据](../../../dev/progress/default-editor-contract-audit-2026-10-26-evidence/r3-actual-after.md)。
- **Conversation Pane Move来源（2026-10-27 M01增量，已签收）**：D真实after发现Pane内“Open Diff in Preview”按钮丢失来源，命令只看排除Conversation后的全局active导致no-op。已实施的定向补修见[方案§3.5](../../../dev/plans/sources-open-dispatch-and-conversation-target.md#35-m01conversation-pane-的-move-显式来源本轮增量已签收)：Pane传真实input/group/Pane的窄typed上下文，命令入口捕获当前注册Conversation part对象/sessionKey；ref与close共用同一来源，入口及await后关闭前以严格对象/成员校验，invalid显式来源不fallback全局/别叶。原生toolbar仅传`{groupId}`，无index只取该明确组入口时的active input；context菜单为`URI, {groupId,editorIndex}`，从完整参数识别，显式非法index拒绝。数字context只在入口解析当前对象、不证明入队前代次，之后按capture对象复核。SCM group、内容session与宿主sessionKey不混用；保留原false/stale/void及非leaf异常关闭代数、缺leaf保源例外，只在仍当前的原Pane显示/恢复属于该次move的错误。此增量经原Astra规则16 C0/I0/M1、native参数Minor实改后accepted，独立accepted方案265b后实施，新增生命周期后的39项公共回归和完整J425通过；R3真实Pane按钮与四公开Move共五路径通过，D1387当前Sources关闭。窄验收不改全局聚合或Panel合同，不提升PRD/宽方案。
- **Diff 模型内容提供者**：`ReadGitFileDiff` 写出的 `sources-git-diff:` 模型已由 `sourcesDiff.contribution.ts` 注册文本模型内容提供者（`registerTextModelContentProvider(SOURCES_GIT_DIFF_SCHEME, ...)`），支持打开 Diff（[sources-architecture](../../../dev/plans/sources-architecture.md) P1 已落）。原 2026-09-28 审查记录（SAR-1）中未注册提供者与打不开 Diff 的已知偏差已消除（P1 无与提供者无关的未做项）。
- **不自动撑开**：打开 Diff / 文件不得把已收起的 Sources 下格撑开（companion-contribs §5）。
- **Review**：只导航面（Desktop ADR-043 / UI-INV-09 口径；本仓审阅进度在 Review 不在 Changes）；审阅进度窗口内存（R1 @ HEAD）；归因 chip 与 Conversation「查看更改」行依赖引擎 `onDidFileMutation` join（R3 / R4 @ HEAD；历史会话经 G-REV-1 `file_mutation` 走同一事件）。**无** review comment、approve、写回引擎或 git。
- **禁用钮写原因**：Changes 行内 / 组头 stage / unstage、Stage Selected / Unstage Selected、Commit，Review 行内 Mark reviewed 与 Mark all，以及 Panel / Conversation Diff 的 Stage，禁用时都把原因写进 `title` 与 `aria-label`（写闸用 pairing-hold / 会话未就绪文案，stage 用会话已切或空路径文案，Commit 用缺消息或 git 命令不可用文案，Review 用没有可标条目或已全部审阅文案）。可点时 title 回到动作名。只改提示，不改这些按钮的启用条件。

## 5. 与 PRD-005 验收的对应

| 验收 | 落点 |
|------|------|
| 1 Files 与侧栏同一棵可新建、重命名、拖放的树；打开不带动侧栏 | §2 Files · §4 |
| 2 stage / unstage / commit 走 SCM 提供者命令 | §2 Changes · `sourcesChangesGit.ts` |
| 3 Diff 归 PRD-009 | §4 |
| 4 Review 无假评审；无 SCM 时诚实空 | §3 |

## 6. 测试与验证

`contrib/sources/test/browser/`：`sourcesTabs`、`sourcesFilesModel`、`sourcesFilesList`、`sourcesFilesListMode`、`sourcesFilesListStrings`、`sourcesFilterModel`、`sourcesChangesModel`、`sourcesChangesList`、`sourcesChangesGitRead`、`sourcesReviewModel`、`sourcesReviewListStrings`、`sourcesReviewProgress`、`sourcesReviewList`、`sourcesReviewShowForPaths`。
