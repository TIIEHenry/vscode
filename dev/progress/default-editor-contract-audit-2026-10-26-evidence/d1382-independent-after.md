---
title: "D1382 ReviewNav 独立默认编辑器 after"
type: reference
status: accepted
phase: N/A
updated: 2026-10-26
summary: "非作者真实默认编辑器 Review 行、根失效、并列叶与命令参数通过；仅 ReviewNav 合同 C0/I0。保留 fixture、无真实 diff、折叠后未再失效及无独立720px限制。"
---

## 集成签收注记

以下原报告完整保留。D1382 按其 ReviewNav 工作根通知合同闭合，方案转 implemented；不是全产品 UI 通过。原报告列在 Minor 的两叶 Session folder 芯片归属问题，经独立 Astra 合同判定为 **Important，另记 D1386 open**；`1 files` 仍为独立 Minor。两者没有倒灌 ReviewNav 的 C0/I0。

父和本次集成分别核对了 `04-beta-folder-removed.png` 与 `11-both-leaves.png`。后者当时两芯片为 beta，后续 DOM 记录为 alpha，均随全局活动根投影；不混淆截图与 DOM 时刻。页面已加载 JS `27704b83…` 与后续磁盘 JS `3b10e51c…` 的 source map 不同，去掉 source map 的正文同为 `14942b9c1ccaaa3d059963b14afd17a996376f9f6405b82c7b839ec5fbb5fe5a`，见 [父摘要](parent-sync-941-snapshot.json)。只能签收这份模块正文，不能称整棵 out 同一次构建。

机器原记录按字节复制为 [初始](d1382-after-observations.json)、[续测](d1382-after-observations-continue.json)、[最终](d1382-after-observations-final.json)。[本地制品清单](d1382-after-artifacts.json)保存原路径、摘要和清理核对。图片只保留原 D 工位的绝对本地路径，未作为图片文件入 git：

- [03-beta-local-row.png](/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1382-independent-after/shots/03-beta-local-row.png)
- [04-beta-folder-removed.png](/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1382-independent-after/shots/04-beta-folder-removed.png)
- [11-both-leaves.png](/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1382-independent-after/shots/11-both-leaves.png)
- [12-alpha-file-click.png](/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1382-independent-after/shots/12-alpha-file-click.png)
- [13-fold-keyboard.png](/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1382-independent-after/shots/13-fold-keyboard.png)
- [theme-default-light-modern.png](/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1382-independent-after/shots/theme-default-light-modern.png)
- [theme-default-dark-modern.png](/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1382-independent-after/shots/theme-default-dark-modern.png)
- [theme-default-high-contrast.png](/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1382-independent-after/shots/theme-default-high-contrast.png)
- [theme-default-high-contrast-light.png](/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1382-independent-after/shots/theme-default-high-contrast-light.png)

---

# D1382 ReviewNav 独立 after（默认编辑器）

审查范围只含 `conversationReviewNavService` 这一份已加载模块。没有改产品，没有编译，没有把服务 getter 或首图当成 Review 行实拍。

## 加载身份

| 对象 | 值 |
|---|---|
| 页面解析的 JS | `vscode-file://.../merge/out/vs/workbench/contrib/conversation/browser/conversationReviewNavService.js` |
| 已加载 sha256 | `27704b8313bfffc6e03a373f02b4cdf46289b25bc7a56cfbb7ab046840270701`（9560 bytes，Debugger.getScriptSource） |
| 磁盘 JS（17:01:48，审查期间未再变） | `3b10e51c8a6f126e5c2b4e40ff5b89639a33ef07fe53a303424c059a19ed638b` |
| 源 TS sha256 | `8fb2ac3053f844f0458c9b3c9213602300de8fd12a048c2c5d6ceb5766aab4dd` |
| 源相对 b5f69d4d608 | 无 diff |
| 启动时 merge HEAD | `3e63f9e6f40` |
| 收尾时 merge HEAD | `9411311486b`（docs: D1384，该文件仍无 diff） |

已加载构造函数先读 `getSessionWorkRoot`，再订阅 file mutation、turn settle、active session、session、workspace folders、SCM add、SCM remove、connection。source map 的 `sources` 指向 merge 树里的 `conversationReviewNavService.ts`。磁盘 JS 与页面解析字节不是同一份。本报告不宣称整个 `merge/out` 是同一次构建。

窗口：Electron pid 39929，`agents:false`，`workbench-dev.html` 来自 merge/out，Xvfb `:188`。阶段 `disconnected`，transport `idle`，界面始终是 “Engine not connected”。`readGitFileDiff` 调用次数为 0。

## 夹具边界

这些不是产品行为，报告里单独标出：

- 本地 Stub 投影不带 timeline `turnId`。审查给 `kind === 'assistant'` 的条目补了 `turnId`，再 `refresh` 已有 lease。第一次误把 attribution role 为 assistant 的 thinking 行也标上了，随后清掉 mutation bucket，只重放到 `untitled-a1` 与 `session-100-102`。`shots/01-review-rows.png` 之后的结论用这次重放。
- 文件 mutation / turn settle 打在渲染器里 ReviewNav 已经订阅的 Emitter 上（监听函数源码含 `ingestMutation` / `applyTurnSettle`）。同 Emitter 上还有别的本地监听者。没有走 main 的 `notifyFileMutation`，也没有外部 RPC。
- 连接回退打在同一条本地 `onDidChangeConnection` Emitter 上。快照保持 `authenticated: false`、`phase.kind: disconnected`、`transport: idle`。没有 `connectProfile`。
- SCM 是 `registerSCMProvider` 的内存 provider，没有 git 资源。因此 Review 列表可以收到路径过滤，同时显示 0 条变更。
- 工作区是 `/tmp/d1382-review-fixture/review.code-workspace`，状态 `WORKSPACE`。`addFolders` / `removeFolders` 没有重载窗口（页面标记 `continue` 仍在）。

## Strengths

- 两个 `ConversationLens` 的 `reviewNavService` 都是同一个 delayed 单例。连接 Emitter 上，Context 的 `observeSnapshot` 监听排在 ReviewNav 写 `connectionSnapshot` 的监听之前。
- 本地根会画出 Review 行。Untitled 会话 `workDir` 为 alpha，SCM 与工作区都是 alpha 时，按钮 “View changes (1 files)” 出现在助手正文之后。记录路径是 `file:///tmp/d1382-review-fixture/alpha/README.md`。见 `shots/12-alpha-file-click.png`、`shots/13-fold-keyboard.png`。
- 非活动并列叶同时可见。`restoreSessionWindow('untitled')` 之后 visible 为 `untitled` 与 `session-100`。左叶 226px（`is-narrow is-compact`）是 Untitled，右叶 225px 是 Beta。两枚按钮都在 DOM 里，且不在 `aria-hidden` 下。见 `shots/11-both-leaves.png`。
- 工作区 / SCM 失效不重放 mutation。bucket 长度在加文件夹、加 SCM、删文件夹、删 SCM 时都保持 1。
  - 只加 beta 文件夹：Beta 仍是 `sources-git-unrooted:/README.md`（SCM 尚未匹配）。
  - 再注册 beta SCM：Beta 变成 `file:///tmp/d1382-review-fixture/beta/README.md`，Untitled 仍是 alpha 文件 URI。见 `shots/03-beta-local-row.png`（资源管理器同时有 alpha 与 beta）。
  - 去掉 beta 文件夹、SCM 仍在：Beta 的 `getReviewNavForSession` 变 `[]`，DOM 按钮变 0。`shots/04-beta-folder-removed.png` 里助手正文还在，View changes 不在。Context 仍是 access `local`。这是已签的工作区根门闩。
  - 再去掉 beta SCM：Beta 回到 unrooted 路径，alpha 文件 URI 不留在这条记录里。见 `shots/05-beta-scm-removed.png`。
- 连接回退：清掉 Beta 的 session `workDir` 后，linkId 41 + workDir alpha 使 source 为 `connection`、access `local`、路径为 alpha 文件 URI。linkId 42 + workDir gamma 使 source 仍为 `connection`、access `engine`、路径为 unrooted。Untitled 一直是 session / alpha。阶段保持 disconnected。
- SCM 子根：会话 `workDir` 与 provider 根都是 `alpha/sub`，工作区只有 alpha。Context access `local`、localRoot 为 `alpha/sub`，Review 记录为 `[]`。恢复 session `workDir` 后 alpha 文件 URI 回到记录。这与已签的归因缺口一致，不是新缺陷。
- 点击与键盘都打到产品命令。焦点先在 `reviewNav:untitled-a1` 上。鼠标 click 与 Enter 各发一次 `sources.review.showForPaths`，参数都是 `[['file:///tmp/d1382-review-fixture/alpha/README.md']]`。更早一次 Beta 按钮的参数是 `[['sources-git-unrooted:/README.md']]`（`shots/08-click-filter.png`）。Review 页出现 “Showing 0 files from this turn · Clear” 和 “No changes to review.”。`readGitFileDiff` 仍是 0。空列表来自没有 git 变更的夹具，不是命令没带路径。
- 可见的 “Stub · 4 steps” 折叠在键盘 Enter 后 `aria-expanded` 从 `false` 变为 `true`，焦点在该按钮上。见 `shots/13-fold-keyboard.png`。
- 四套主题都换上了，按钮文案仍是 “View changes (1 files)”，字号 12px，padding `4px 8px`。类名分别为 `vs` / light_modern、`vs-dark` / dark_modern、`hc-black`、`hc-light`。浅色下按钮色 `rgb(0, 95, 184)`，向上找到的不透明背景 `rgb(255, 255, 255)`，对比度 6.31。截图：`shots/theme-default-light-modern.png`、`theme-default-dark-modern.png`、`theme-default-high-contrast.png`、`theme-default-high-contrast-light.png`。
- 并列叶宽 225px 与 226px，带 `is-narrow is-compact`。按钮宽 133px，文案完整，`text-overflow` 为 clip。单叶时叶宽 612px（`shots/03-beta-local-row.png`）。没有另做一次恰好 720px 的叶宽。

## Critical

无。

## Important

无。Review 行的可打开路径随工作区、SCM 和连接根更换，旧的文件 URI 没有留在按钮命令里。

## Minor

- 按钮文案是 “View changes (1 files)”。单数仍用 files。文案在 `formatReviewNavLabel`（`conversationReviewEntry.ts`），不在这次改动的 service 文件里。四套主题和并列叶里都看得到。
- 两个叶子的文件夹芯片都显示 “alpha”，aria 为 “Session folder: alpha. Add a folder to the workspace.” 此时 Beta 的 `getWorkRoot` 是 workDir beta、access `engine`，它的 Review 记录是 unrooted 路径。身份条读的是 `getActiveWorkRoot()`，不是叶子自己的会话。这不在 `conversationReviewNavService.ts`。Review 行本身仍按各自会话更新。DOM 读取于并列叶展示之后；不要用图像描述里曾经写过的 “beta” 芯片代替这次 DOM。

## Assessment

已加载的 ReviewNav 在隔离默认编辑器里按已签合同更新了真实 Review 行：活动叶与非活动并列叶、工作区增删、SCM 增删、连接回退、SCM 子根空记录，以及按钮上的 `sources.review.showForPaths` 参数。证据是截图、DOM 按钮和命令参数，不是 getter 单独充当实拍。首图 `shots/probe-initial.png` 只证明默认编辑器加本地 Stub。

未覆盖：没有真实 git 仓库，所以过滤后的 Review 列表是 0 条，也没有打开 diff。没有在折叠展开之后再做一次根失效，因此不能说折叠状态跨过根更新仍然保持。深色和高对比的按钮背景在采样时是透明的，只对浅色算出了对比度。外层 sash 拖动后 part 宽是 471px，没有落到 300px；紧凑证据来自 225px 的并列叶。

机器记录：`observations.json`、`observations-continue.json`、`observations-final.json`。

D 的 git 树和 HEAD `c6ef5346127a4b05a88e4ecb5b4ef08ee1099b02` 保持原样。没有改产品，没有改 plan 状态。
