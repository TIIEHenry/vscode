---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-28
summary: "2026-09-28：UI 视觉审查与连续优化：信息密度与微间距体系重构、全工作台按压微动效（active tactile feedback）、以面代线消解 1px 细线、子代理浮层与架构图毛玻璃模态、Preview 与 Sources 空态页面补全。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session

1. **首选项遮罩预留与边界收拢**：收紧身份条视口判定阈值，防止工作台停靠身份条导致首选项遮罩高度被裁切；补充 ConnectionPreferencesPane 停靠身份条 fail-closed 单测（Commit `03678fb1a5b`）。
2. **Preview 类别空态 UI 补全**：为各类别（Overview, Terminal, Code, Web, Planning, History, Artifacts）补齐专属快捷动作按钮、图标与快捷键徽标；注入 `ICommandService` 调度真实命令；配置 active 按压（scale 0.97）与微间距；扩展 EditorGroupWatermark 单元测试（Commit `81619096a9a`）。
3. **全仓按压微动效与触感交互（Tactile Feedback）**：为全局 `action-bar` 图标、编辑器标签操作、会话身份条（标题重命名、新建会话、更多、快照、历史）、Trajectory 时间线记录与全景分段、Sources（变更列表行、文件列表行、待审切换）、首选项（连接与引擎按钮/卡片/标签）统一落地 active 按压动效（scale 0.90~0.99）与 4pt 间距体系（Commit `870fe003a6a`）。
4. **活动栏、子代理浮层与会话控件按压与毛玻璃质感**：为活动栏（Activity Bar）图标与指示器配置 active 按压（scale 0.90/0.94）与柔和边界；子代理浮层（SubAgent Overlay）升级 12px 圆角、毛玻璃模糊与柔和半透明描边；落地会话 Diff 展开切换、折叠按钮、Tool 取消/回复按钮与身份条芯片 active 触感动效（Commit `d43b71d5015`）。
5. **快速选择、通知弹窗、命令中心与状态栏按压触感和圆角层级**：快速选择（Quick Input）升级 12px 悬浮圆角并为列表行/动作按钮注入 active 触感反馈（scale 0.985/0.90）；通知弹窗（Toasts/Center）统一 8px 圆角与柔和阴影；标题栏命令中心注入按压微缩放；状态栏消除生硬焦点边框并增加 4px 微圆角与按压动效（Commit `0eccceaaf24`）。
6. **轨迹表与检查器微间距、源码空态信噪比及架构图全屏模态**：轨迹表（Trajectory Table）与检查器升级 8px 圆角、半透明描边与柔和阴影，增加全景导航折叠开关按压微动效；源码（Changes / Review / Stub）空态重构为舒适居中排版与呼吸内衬；架构图（Visualize）全屏模态升级 12px 圆角与毛玻璃背景（Commit `dc8de2645c9`）。


> **后注（2026-09-21 · UA 工具结果 metadata_json 入站，ADR-395 S4）**：ChatSync `decodeToolResultEvent` 解 field 6 `metadata_json` → 域模型 `metadataJson` → demux `parseMetadataJson`（fail-closed `{}`）→ view-patch 并行 `toolCallMetadataMap`（vendored sessionView 本体不动）→ `ItemAttribution.metadata` → 时间线 `file_edit` 行 diff stats 徽章 + `parseUnifiedDiff`/`DiffEditorPool` 展开区（折叠行与独立行两路）。测：node 三套 11+26+10 全绿；transpile/eslint/layers 0；browser 测试已写未跑（需浏览器 runner）。**注意**：① UA envelope `ToolResultBlock` 尚无 metadata 字段，主时间线需等 UA S5（envelope 持久化+回放）供数，当前仅 ChatSync 聚合路径有值；② 本 commit `378b9e6c` 的 `sessionViewHost.ts` 误带入了并发会话的 fail-closed 修复 hunk（`git add` 覆盖了 `apply --cached` 的部分暂存）——该修复已随本 commit 推送，配套 reopen 测已随 `b6264a3cb06` 入库（11/0）；③ L3 `tool_call_lifecycle` 的 `metadata_json` 不解码是有意选择（注释已注明 envelope 路线）。

### 已合入（`MERGE_SHA` 见关仓；compile-client 0）
| 切片 | 提交 |
|:-----|:-----|
| **A SessionStream / L2** | 16/23/30–32/34–39/44/46/50–52；envelope leftover |
| **catch** | D677–D751、D753–D782、D784–D821、D823–D829、D834–D835、D837、D839–D841、D843–D844、D847、D850–D851、D854–D858、D860–D868、D871、D875–D876、D881、D883、D886、D895、D898、D917、D922、D939、D943、D955、D964、D972、D974、D978、D980、D983、D1015、D1032、D1254、D1258、D1278、D1294、D1295（D752 仍不入库） |
| **UA chrome** | 人类 `agent-ide`：Maximize Inbox 文档流、pairing-hold 禁 Connect、Diff SIDE_GROUP、live SAS/Stop 可达、本地 health-gates 门禁说明 |
| **四份方案** | 活流 decoder/thinking 已与 SessionStream 波重叠，Chat 11/13/20 与 recover 仍开；拨号 / 绑定叶 / Sources 打开身份未实施。跟踪 [D944](deferred-gaps.md) |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **loop** | leftover 未完成。关仓代码尖 `dd33706fb00` 已合进人类工位，本地文档与工作区提交仍在。A/B/E/F/G/H/I/J `idle`。C `blocked`（仅脏 `dev/loop` gitlink，不入库）。D `occupied`（`592fa2cddbb` 保留本地合并，未推）。D752 不入库。 |

子 agent 发现（扫描笔记；D724 在延期表已 closed，D736 / D739 / D740 为 skipped，都不是当前阻塞）：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Connect/Watch/Resolve/Pty 仍 JSON |
| setRemoteEnvironment | `await` 的是 `Promise[]`，不会等各 host；应 `Promise.all`，不是 leftover |
| D736 extensions | 合法 leftover <4（veto PromiseLike.then、latency openEditor）；extensions 跳过。veto then 回调抛错会未处理；openEditor 可裸拒 |
| extHostTask fetch | `fetchPromise.then` / `Promise.all(...).then` 只 resolve，reject 挂起外层 Promise（D724 文件未动） |
| CodeMain.startup | `main()` try/catch 接不住 `startup()` async reject（D740 未凑刀） |
| native loadURL | `openChildWindow` `window.loadURL` 无 catch（D739 native 仅 1 点） |
| treeView tooltip | `treeView.ts` resolve.then reject 不拒外层 tooltip Promise |
| breadcrumbs catch | 自定义 catch 会 fire-on-error，不能直接改 D480 双链 |
| createEditorInset | 协议 `$createEditorInset: Promise<void>` vs `$disposeEditorInset: void` |
| theme leftover | D751 已双链；assigned/two-arg/Watch 仍跳过 |
| localTerminalBackend revive | `localTerminalBackend.ts` revive `.then` 只 `r()`，reject 挂起 `Promise.all` |
| notebook custom catch | `notebookEditorModel.setSaveDelegate().catch(log)`；stickyScroll `init().catch(console.error)` |
| userDataProfile | `onProfileAwareDidUpdateExtensionMetadata` 缺括号；`replace('/\\s+/', '_')` 替换字面量 |
| terminalContrib | 赋值 `_osBackend` reject 挂起后续 await；chat `Promise.all(getCodeBlockInfo)` leftover reject 未处理 |
| dialogs | `showSaveDialog` 在 `pickResource` reject 时外层挂起；`onDidAccept` reject 卡住 resolving；`updateItems` reject 留 `busy`；`preferredHome` 把 Promise 打成 `[object Promise]` |
| TextMate progress | debug progress `new Promise` 永不 settle |
| workspace Resolve | `resolveCanonicalUris` / `resolveAuthority` `.then().finally()` leftover reject 仍未处理（Resolve 跳过） |
| host restart | browser `restart()` 未 return/await `reload()`，调用方提前 resolve |
| variableResolver | `columnNumber` 抛 `Error`，`lineNumber`/`selectedText` 抛 `VariableError` |
| timeline handleRequest | 空 `catch` 吞掉 provider 失败 |
| workingCopy whenReady | 赋值 `resolveBackupsToRestore()` / leftover `limiter.queue` reject 可未处理 |
## 槽位（2026-09-26 关仓）

| 槽 | 状态 | HEAD |
|:---|:-----|:-----|
| merge | `parked` | 推送后的 `origin/agent-ide`（含本槽位账；代码尖 `dd33706fb00`） |
| A B E F G H I J | `idle` | 同推送后的 `MERGE_SHA`，干净 |
| C | `blocked` | `34b6ca17caa`，仅脏 `dev/loop` |
| D | `occupied` | `592fa2cddbb`，未推 |
| edit（人类 `agent-ide`） | 已合并 | 含 `9128b870dbe` 与本地 `1fe23f074bd`、`e1a637e8aa8` |

## Next
| 项 | 指针 |
|:-----|:-----|
| **loop** | D24 仍开。不得宣称 leftover/pills 完成（pill 与叶级 SessionBar 代码在仓，方案未升 `implemented`）。四份修补见 [D944](deferred-gaps.md) |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
