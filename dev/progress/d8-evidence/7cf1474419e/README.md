---
title: "PRD-008 冒烟 7cf1474419e"
type: progress
status: active
phase: M7
updated: 2026-10-01
summary: "PARTIAL。回环自动连接出现过，不算 E1。Direct Address 停在 Waiting for pairing，主进程配对框没有出现。PRD-008 仍 blocked。"
---

# PRD-008 冒烟 `7cf1474419e`

结果：**PARTIAL**。不是升档证据。PRD-008 保持 `blocked`。

| 项 | 值 |
|:---|:---|
| IDE | `7cf1474419e` |
| 引擎 PIN 短哈希 | `748e7698e6`（仓外 `PIN`） |
| 实际进程 | 打包二进制，`VERSION` 的 `source_sha` 为 `10635d612dac` |
| 监听 | `127.0.0.1:50061`，无 Hub |
| 配置 | 空源目录 `/tmp/d8-empty-udd`（首次配对，不是 reusedTrust） |
| P-GRPC | `node_modules/@grpc/grpc-js` 存在 |
| 编译 | `npm run compile` 已写出 `out/`，随后 tsgo 48 个既有类型错误，退出码 1。启动用了 `--skip-prelaunch` |

## 断言

| ID | 结果 |
|:---|:---|
| E1-phase | **失败**。先观察到 `Engine · Loopback`（回环免 SAS，**不算**通过）。断开后状态栏为 `Engine not connected`。手填 Direct Address `127.0.0.1:50061` 并允许私网后，相位停在 `Waiting for pairing`，横幅为 `Pairing pending — not connected yet.`。主进程配对框没有出现，没有点 `Verified on Engine`。芯片不是 `Engine · Direct`。 |
| E2–E5 | **未跑**。E1 未过。引擎日志有 `Auto-approve mode ENABLED`，即便配对完成，权限座位也可能不出现，E4 会是 `P-PERM` 阻塞而不是通过。 |

截图：`screenshots/startup.png`（回环已连接）、`screenshots/e1-pairing.png`（配对未完成）。`e1-phase.json` 记同一结论。
