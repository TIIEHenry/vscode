---
title: "2026-10-26 默认编辑器壳独立视觉复验"
type: reference
status: completed
phase: M7
updated: 2026-10-26
summary: "Astra 使用唯一集成流水线的 fresh Electron 输出独立复验；D1371/1372 通过，D1373 Input needed 标签低对比只登记未实施。截图与测量留在本地 .build。"
---

# 结论与证据位置

Astra 独立只读视觉审查确认 D1371 / D1372 的 before/after 与模式退出回归通过，没有新增 Critical / Important。父代理另行查看 `after-dark-direct-760.png` 与 `after-light-client-1024.png`，确认字段和控件完整。集成侧新的 5 条 browser 行为回归与 4 条 Connection 焦点 / dispose 回归全部通过，类型契约诊断也已定向修正。

全部截图、运行报告和测量 JSON 按本轮要求留在主线工位的本地证据根目录：

`/home/clarence/Projects/Agents/vscode/.build/visual-review-astra/`

本页是入库的结论与覆盖限制摘要；PNG 和完整本地测量文件不加入 git。原只读报告为该目录的 `review.md`。精选 before→after 为 `fresh-dark-direct-760.png`→`after-dark-direct-760.png`、`fresh-light-client-1024.png`→`after-light-client-1024.png`。

## 被测产物与隔离环境

- 使用 merge `a514ec3d2a5915a562701db86bbc881107705d9b` 中的 D1371 / D1372；Connection / Settings JS 与两份 CSS 于 2026-10-26 `09:46:17+08:00` 最小刷新后重新隔离启动。产物与启动元数据在本地 `after-artifacts.json` / `after-launch.json`，本仓 [新输出清单](settings-fresh-output.json) 同时保留源码/JS摘要和时间。
- 入口为 merge/out 的实际 Electron 默认编辑器 `workbench-dev.html`，没有使用 Sessions 网页工作台，没有 `--agents`。空白 seed，独立 user-data / extensions / shared-data，禁用扩展，Xvfb `:117`；未登录、未连接引擎，没有外部写操作。
- 原始 `compile-client` 仍为退出 1；fresh emit 只证明本次测试使用新代码，不代表全仓类型门通过。截图载入09:46:17版本后，集成只增加 SplitView 事件类型适配 `Event.map(..., () => undefined)`；事件 payload 与视觉逻辑均不变，随后 browser 9 项再通过。
- 场景包括 1440×1000、1024×768、760×700、700×700；Default Dark Modern / Default Light Modern。`baseline-*` 旧产物图不用于修复通过结论。

## 真实 after 核验

| 检查 | 观察与数值 | 本地证据文件 |
|:---|:---|:---|
| Direct Address 中窄，760×700，浅/深色 | 三个输入行均为 305px 单列，Host 说明不再 49px 竖排；clientWidth 等于 scrollWidth | `after-dark-direct-760.png`、`after-light-direct-760.png`、`after-check.json` |
| Direct Address 宽窗，1440×1000 | Host / Port / Name 共用 304px 说明 + 240px 控件，左右对齐 | `after-dark-direct-wide.png` |
| 详情断点边界 | detail 479.19px 时采用 464.19px 单列；480.00px 时 209 + 240px 双列；无临界坏带或横向溢出 | `after-direct-boundary-959.png`、`after-direct-boundary-960.png`、`after-boundary.json` |
| Back to Client Settings，1024×768 | UA 根 300px、控件 215px；标题、说明与下拉箭头完整 | `after-light-client-1024.png`、`after-dark-client-1024.png` |
| UA exact→ordinary→mixed→UA | 作用域与宽度依次 UA300→普通500→普通500→UA356；例外没有污染普通/混合设置 | `after-check.json`、`after-dark-ordinary-settings-1024.png`、`after-dark-mixed-settings-1024.png`、`after-dark-client-return-1024.png` |
| 300px 叶宽关闭后重开 UA | 仍为 300px；长标题、说明正常换行，控件完整 | `after-dark-client-300-leaf.png`、`after-dark-client-reopen-300-leaf.png` |
| TOC Client→Text Editor→Client | 实测 300→500→300，700px TOC 规则保留 | `after-client-toc-300.png`、`after-ordinary-toc-500.png`、`after-client-toc-return-300.png`、`after-toc-threshold.json` |
| 原焦点修复 | Engine / Connection 在导航内获焦后宽转窄，实际 activeElement 是 Back 按钮，焦点环可见 | `fresh-dark-engine-narrow-keyboard.png`、`fresh-light-connection-narrow-keyboard.png` |

## D1373：只登记的高置信度待办

`Input needed` 使用 `badge.background` 当文字色，并用同色 16% 作底，视觉接近 disabled；标签实际表示等待用户处理。默认浅色文字 `#ccc`、合成底约 `#f1f1f1`，对比约 1.42:1；深色文字 `#616161`、合成底约 `#2f2f2f`，约 2.17:1。源码已核对：[conversationLens.css](../../../src/vs/workbench/contrib/conversation/browser/media/conversationLens.css) 的 `.conversation-lens-input-needed`（本轮行 2832 起）。

本地证据是 `fresh-light-shell-1024.png`、`fresh-dark-shell-navigator.png` 与 `fresh-pending-badge.json`。建议在这条标签语义内使用主题配对的 `badge.background` + `badge.foreground`，或浅底配正常 foreground；随后验证浅色、深色及高对比。此项只作为 [D1373](../deferred-gaps.md) open 登记，本轮没有改动该 CSS，不宣称已修复。

## 覆盖限制与清理

未连接引擎；Conversation 使用明确标注的 Stub fixture。真实流式内容、长会话、在线 Engine catalog、登录/配对状态未验证。CDP viewport 重排不代表手机触控或虚拟键盘验收。Direct Address 窄排增加纵向高度是可读性的取舍；深色原生滚动条轨道观感另留后续，不扩大本轮实现范围。

Astra 只清理自己创建的 fresh / after Electron 与 Xvfb `:117`，本地 `cleanup.json` 记录身份和 stopped=true。集成测试子进程均已结束；没有后台 compile/watch，其他既有用户进程未清理。
