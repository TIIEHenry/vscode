---
title: "D15 W1 Web 冒烟 — w1-1556dde3"
type: progress
status: completed
phase: M7
updated: 2026-09-07
summary: "工位 A 从已有 out/ 跑通 scripts/code-web.sh；V1–V3 PASS；phase=disconnected，桌面连接控件已省略"
---

# D15 W1 Web 冒烟 — 2026-09-07

**工位：** A · `loop/A`  
**SHA：** `1556dde3d326d344e175f9ca16d1a48c79a79686`  
**结果：** **PASS**（未跑 `npm run compile`；`out/` 已存在）

## 命令

```bash
./scripts/code-web.sh --browserType none --host 127.0.0.1 --port 18080
```

预检：`out/vs/code/browser/workbench/workbench.js` 与 `out/vs/platform/universeAgent/browser/universeAgentConnectionService.js` 已在。仓内钉死 Node `.build/node/v24.18.1/linux-x64/node` 启动前不存在；`code-web.sh` 自行 `npm run gulp node` 下载（约 33s），**不是** unused-import 编译战役。

监听：`http://127.0.0.1:18080/`  
浏览器：Chrome DevTools 打开该 URL，Command Palette → `Open Connection Preferences`，再切 Engine tab。

## 断言

| ID | 场景 | 结果 | 证据 |
|:---|:-----|:-----|:-----|
| V1 | Conversation 存在 | **PASS** | [v1-layout.json](v1-layout.json) · [screenshots/v1-conversation.png](screenshots/v1-conversation.png) — `.part.conversation` 可见；时间线 + SessionBar + Composer |
| V2 | Agent IDE chrome | **PASS** | [v2-chrome.json](v2-chrome.json) — 标题 `UniverseAgentStudio Dev`；四钮 Navigator / Conversation / Preview / Sources |
| V3 | Connection / Engine 省略桌面连接控件 | **PASS** | [v3-connection.json](v3-connection.json) · [v3-engine.json](v3-engine.json) · 截图 — Hub / Direct / Test Connection / Test Engine 几何 0×0；点名文案「此环境不支持本机 Engine 连接」 |

## `IUniverseAgentConnection`

| 面 | 值 |
|:---|:---|
| `getConnectionPhase()`（源码合同） | `{ kind: 'disconnected' }` |
| `connectProfile()`（源码合同） | `ok:false` · `code: 'unsupported_environment'` |
| 运行时状态栏 | `Engine connection: Engine not connected` |
| 运行时页内 | Connection / Engine 均显示「此环境不支持本机 Engine 连接」 |
| 桌面连接控件 | 不画（Hub / Direct / Test 隐藏） |

活页没有公开 DI 句柄可读单例；交叉见 [connection-phase.json](connection-phase.json)。phase 保持 `disconnected`，**不是**把 Web 画成 `failed`。

## 非阻塞噪声

- 若干内置扩展缺 `watch-web` dist（emmet / git-base / merge-conflict 等 404）。工作台仍起来，产品壳可测。
- 无打开文件时 Preview 几何为 0；四钮仍在且 Sources 可见。

## 未做

未升 PRD-019 `implemented`（产品状态留给父 agent / 合入门禁）。未跑桌面 F4、未改引擎仓、未 `npm run compile`。
