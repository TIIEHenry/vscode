---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-19
summary: "合入人类 agent-ide：UA chrome 视觉 + 四份修补方案签收（D944）。leftover catch 至 D1294。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 见关仓；compile-client 0）
| 切片 | 提交 |
|:-----|:-----|
| **A SessionStream / L2** | 16/23/30–32/34–39/44/46/50–52；envelope leftover |
| **catch** | D677–D782、D784–D821、D823–D829、D834–D835、D837、D839–D841、D843–D844、D847、D850–D851、D854–D858、D860–D868、D871、D875–D876、D881、D883、D886、D895、D898、D917、D922、D939、D943、D955、D964、D972、D974、D978、D980、D983、D1015、D1032、D1254、D1258、D1278、D1294 |
| **UA chrome** | 人类 `agent-ide`：Maximize Inbox 文档流、pairing-hold 禁 Connect、Diff SIDE_GROUP、live SAS/Stop 可达、本地 health-gates 门禁说明 |
| **四份方案** | 活流 bytes / 拨号 generation / 绑定叶身份 / Sources 打开身份已签收、未实施，跟踪 [D944](deferred-gaps.md) |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **loop** | leftover remaining unused 未完成。D1294 已合入（compile-client 0，mocha 5/0）。人类 UA chrome 在祖先，未 dual-push。D759 脏无 scan 不 `-B`。B 脏跳过；C gitlink 勿 add；E blocked。 |

子 agent 发现：
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
## Next
| 项 | 指针 |
|:-----|:-----|
| **loop** | D24 仍开。不得宣称 leftover/pills 完成。四份修补方案跟踪 [D944](deferred-gaps.md) |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
