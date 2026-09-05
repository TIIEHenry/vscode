---
title: "钉死 UniverseAgent 引擎（IDE 调试）"
type: guide
status: accepted
phase: M7
updated: 2026-09-03
summary: "仓外隔离 worktree 编 HeadlessServer，供本仓 Direct Address 调试；不对 UA 开发树与 ~/.universe-agent 共享身份"
---

# 钉死 UniverseAgent 引擎（IDE 调试）

> 返回 [指南索引](INDEX.md)。协议口径仍在 [engine-protocol-surface](../reference/universe-agent/INDEX.md)。本页只写**怎么起一份不受对面开发影响的引擎**。产品状态不因此升 `implemented`（[PRD-008](../product/requirements.md#prd-008-引擎与会话权威) 仍须接通冒烟证据）。

**操作 SSOT（仓外，不进本仓 git）：**  
`/home/clarence/Projects/Agents/vscode-debug-engine/` — `PIN`、`compile.sh`、`start-engine.sh`、`stop-engine.sh`、`approve-grant.sh`。[README](../../../vscode-debug-engine/README.md)。

## 1. 为什么单独一份

对面 `UniverseAgent/` 与 loop 工位会持续改源码。本仓调试若直接 `:grpc-server:run` 那棵树，协议与身份会跟着漂。

钉死工位是：

| 项 | 值 |
|----|-----|
| 源码 | 分离头指针 worktree `vscode-debug-engine/universe-agent/`，SHA 以 `PIN` 为准 |
| 数据 / TLS / Grant | `vscode-debug-engine/agent-home/`（`UNIVERSE_AGENT_HOME`），**不是** `~/.universe-agent` |
| 监听 | `127.0.0.1:50061`（避开 UA 默认 `50051`） |
| 形态 | HeadlessServer TCP `--no-uds`，**不加** `--hub` |

这不是 Loop 字母槽，不要写进 [worktree-pool](../../dev/progress/worktree-pool.md) 的 A–D 表。

## 2. 命令

在 `vscode-debug-engine/`：

```bash
./compile.sh          # 只编 :grpc-server JVM；换钉后才需要
./start-engine.sh     # 前台听 50061
./stop-engine.sh
./approve-grant.sh XXXX-XXXX   # 首次 Connect 的 SAS
```

当前钉与 TLS 指纹只写在 `PIN`，本页不复制（换钉会变）。

## 3. 在 Agent IDE 里连

1. 打开 **Connection** Preferences。
2. Direct Address：`127.0.0.1`、端口 `50061`。
3. **勾选 allowPrivateNetwork**（[connectionResolver](../../src/vs/platform/universeAgent/node/connectionResolver.ts) 把 loopback 与 RFC1918 一起拦）。
4. 连接。若弹出 SAS，引擎侧跑 `approve-grant.sh`。
5. StatusBar 走 `getConnectionPhase()`；connected 之后 Conversation / Engine 九节走真引擎，不再投影 stub 种子。

loopback skip-auth 只跳过 session_token 拦截器；TLS pin 与 Device Grant 仍在。不要用 Hub 登录冒充已连接。

## 4. 本地补丁（不回推 UA）

`PIN` 所钉的 UA `origin/main` 当时编不过。隔离 worktree 只留两处本地改，**禁止** push 回 UniverseAgent：

1. `generationJob` 类型改为 `CompletableJob`（`Job.complete()` 不在接口上）。
2. `AgentHome.defaultHomePath()` 读取 `UNIVERSE_AGENT_HOME`（外仓文档写了，源码原先只认 `~/.universe-agent`）。

Logback 仍写 `~/.universe-agent/logs`（硬编码 `user.home`）。身份、会话、Grant 在 `agent-home/`。

占位 `ANTHROPIC_API_KEY` 只够 Connect / catalog。真发消息须改 `agent-home/config.json`。

## 5. 换钉

只在本仓协议对不上、或要吃进已签收的引擎 RPC 时换。步骤见仓外 README。换完更新 `PIN`，不要把新 SHA 抄进本页。

## 相关

- [ADR-003](../../dev/decisions/003-engine-adapter-boundary.md) · [connection-hub-client](../../dev/plans/connection-hub-client.md)（Direct Address / SAS）
- [壳冒烟](shell-smoke-verification.md)（IDE 侧隔离 profile，与本引擎正交）
