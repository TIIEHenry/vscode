---
title: "钉死 UniverseAgent 引擎（IDE 调试）"
type: guide
status: accepted
phase: M7
updated: 2026-11-01
summary: "仓外隔离 worktree 编 HeadlessServer。源码工位由 PIN 固定，线上二进制以 engine/VERSION 与 lib.SHA256SUMS 为准；IDE 用同一个 UNIVERSE_AGENT_HOME 发现 UDS 或 pinned TCP，不再扫固定端口。"
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
| 源码 | 分离头指针 worktree `vscode-debug-engine/universe-agent-027ab/`，SHA 以 `PIN` 为准 |
| 数据 / TLS / Grant | `vscode-debug-engine/agent-home/`（`UNIVERSE_AGENT_HOME`），**不是** `~/.universe-agent` |
| 监听 | `127.0.0.1:50061`（避开 UA 默认 `50051`） |
| 形态 | HeadlessServer TCP `--no-uds`，**不加** `--hub` |

这不是 Loop 字母槽，不要写进 [worktree-pool](../../dev/progress/worktree-pool.md) 的 A–D 表。

## 2. 命令

在 `vscode-debug-engine/`：

```bash
./compile.sh          # 编 HeadlessServer 及运行时模块；换钉后才需要
./start-engine.sh     # 前台听 50061
./stop-engine.sh
./approve-grant.sh XXXX-XXXX   # 首次 Connect 的 SAS
```

源码钉与 TLS 指纹只写在仓外 `PIN`。线上实际运行的版本以本仓 `engine/VERSION` 的 `source_sha`、`source_dirty`、`built_at` 和 `lib.SHA256SUMS` 为准；不能只拿 `PIN` 推断运行中二进制。

当前 50061 构建记录：`source_sha=027ab7ed03ac5b64023ed6090f8610b22cc2b8ac`，`source_dirty=false`，`built_at=2026-11-01T08:44:32+08:00`，运行时模块清单哈希见 `engine/VERSION`。旧 `10635d612dac` 构建保存在 `engine/VERSION-10635-20261101` 与 `engine/lib-10635-20261101/`，用于回滚对照。

## 3. 在 Agent IDE 里连

IDE 要和引擎用同一个 `UNIVERSE_AGENT_HOME`（钉死工位是 `vscode-debug-engine/agent-home/`）。不再扫 `50061` / `50051`。`<home>/server.sock` 的父目录只有属主可访问时走 UDS；否则读仅属主可读写的 `server.lock` 取回环端口，并用同目录 `engine-tls.crt` 做叶证书 pin。没有这些锚就不自动连接。去掉 `--no-uds` 也能连。引擎是回环且没开 Hub 时，这条链路没有 session token，也不弹 SAS。无 token 时若 `Session/List` 回 `UNAUTHENTICATED`，这次进程不再自动发现。状态栏变成 **Engine · Loopback** 之后，Conversation / Engine 走真引擎。

引擎晚于 IDE 起来时，探测会按重连退避重试，直到连上或用户点 Disconnect。Disconnect 之后这次进程不再自动连。

手填 Direct Address 仍走 TLS pin + Device Grant。要测那条时：勾选 allowPrivateNetwork，Connect，若弹出 SAS 再跑 `approve-grant.sh`。不要用 Hub 登录冒充已连接。

IDE 已在已提交的 TLS 链路上给之后的调用带 `authorization: Bearer <session_token>`（[remote-link-auth-and-relay](../../dev/plans/remote-link-auth-and-relay.md) S1）。token 被拒或调用 `UNAVAILABLE` 会先摘掉这条链路再重连（中继即新票）。这份钉死引擎仍跳过鉴权拦截器，验不到这个头，也不经过 Hub 中继票。远程路径仍要在强制鉴权模式（非回环绑定，或 `--hub`）下另验。

## 4. 构建边界

当前钉使用干净 detached worktree，没有本地源码补丁。`compile.sh` 会同时编 `grpc-server`、`remote-agent-server` 和 `hook-jvm`；只替换主包而遗漏运行时模块会在启动时产生二进制 ABI 错误。

Logback 仍写 `~/.universe-agent/logs`（硬编码 `user.home`）。身份、会话、Grant 在 `agent-home/`。

占位 `ANTHROPIC_API_KEY` 只够 Connect。Chat 还要 ConfigStore 里的 `provider:state`（或 `provider:providers` + `provider:model_profiles`）以及 `models.json`：进程环境变量不会自动变成 model profile。`start-engine.sh` 会从 `~/.claude/settings.json` 导出 key / base / model，并跑 `seed-model-catalog.sh` 写入隔离 `agent-home/`（不打印 key）。改完须重启引擎。当前 027ab 钉已包含 `UpsertModel` / `DeleteModel` / `SetModelEnabled` 与 `GetPermissionMode` 的引擎实现；这只证明二进制已换钉，不等于 IDE 产品路径已验收。模型目录仍由 seed 脚本提供启动基线。本仓 Composer 发送时带 `SessionInput.model_profile_id`（选中 catalog 的 `id`；诚实空选项不带）。

## 5. 换钉

换钉触发已满足：要吃进引擎仓已合并的 IDE 远程协议 A–F、权限模式读回和模型写 RPC。步骤见仓外 README。更新时先从干净 commit 建 detached worktree，再编完整运行时模块；启动后以 `engine/VERSION` 核对实际二进制，不把当前开发树的 dirty HEAD 当发布钉。

[D25](../../dev/progress/deferred-gaps.md) / [D26](../../dev/progress/deferred-gaps.md) 的 List / Create PASS 属旧钉历史；027ab 新钉尚未重跑业务验收，不能把旧证据迁移到当前版本。空 catalog 当时不并入那两行；本仓不加兼容层。

## 相关

- [ADR-003](../../dev/decisions/003-engine-adapter-boundary.md) · [connection-hub-client](../../dev/plans/connection-hub-client.md)（Direct Address / SAS）
- [壳冒烟](shell-smoke-verification.md)（IDE 侧隔离 profile，与本引擎正交）
