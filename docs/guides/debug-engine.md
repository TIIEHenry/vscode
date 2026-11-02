---
title: "钉死 UniverseAgent 引擎（IDE 调试）"
type: guide
status: accepted
phase: M7
updated: 2026-11-02
summary: "仓外隔离 worktree 编 HeadlessServer。IDE 用同一个 UNIVERSE_AGENT_HOME 发现 UDS 或 pinned TCP，不再扫固定端口。手填 Direct Address 仍走 Device Grant。换钉以仓外 PIN 为准。"
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
| 源码 | 分离头指针 worktree，实际目录与 SHA 以 `PIN` 的 worktree/pin_sha 为准 |
| 实际执行 | `start-engine.sh` 执行 PIN 登记的 `engine_bin` 预包，不执行当前 worktree 的 Gradle run；版本以该包 `VERSION` 与 `lib.SHA256SUMS` 为准 |
| 数据 / TLS / Grant | `vscode-debug-engine/agent-home/`（`UNIVERSE_AGENT_HOME`），**不是** `~/.universe-agent` |
| 监听 | `127.0.0.1:50061`（避开 UA 默认 `50051`） |
| 形态 | HeadlessServer TCP `--no-uds`，**不加** `--hub` |

这不是 Loop 字母槽，不要写进 [worktree-pool](../../dev/progress/worktree-pool.md) 的 A–D 表。

## 2. 命令

在 `vscode-debug-engine/`：

```bash
./compile.sh          # 换钉时构建运行集；完整模块与复制步骤按仓外 README，不在 UI 验收中临时换钉
./start-engine.sh     # 前台听 50061
./stop-engine.sh
./approve-grant.sh XXXX-XXXX   # 首次 Connect 的 SAS
```

当前钉与 TLS 指纹只写在 `PIN`，本页不复制（换钉会变）。

## 3. 在 Agent IDE 里连

IDE 要和引擎用同一个 `UNIVERSE_AGENT_HOME`（钉死工位是 `vscode-debug-engine/agent-home/`）。不再扫 `50061` / `50051`。`<home>/server.sock` 的父目录只有属主可访问时走 UDS；否则读仅属主可读写的 `server.lock` 取回环端口，并用同目录 `engine-tls.crt` 做叶证书 pin。没有这些锚就不自动连接。去掉 `--no-uds` 也能连。引擎是回环且没开 Hub 时，这条链路没有 session token，也不弹 SAS。无 token 时若 `Session/List` 回 `UNAUTHENTICATED`，这次进程不再自动发现。状态栏变成 **Engine · Loopback** 之后，Conversation / Engine 走真引擎。

引擎晚于 IDE 起来时，探测会按重连退避重试，直到连上或用户点 Disconnect。Disconnect 之后这次进程不再自动连。

手填 Direct Address 仍走 TLS pin + Device Grant。要测那条时：勾选 allowPrivateNetwork，Connect，若弹出 SAS 再跑 `approve-grant.sh`。不要用 Hub 登录冒充已连接。

IDE 已在已提交的 TLS 链路上给之后的调用带 `authorization: Bearer <session_token>`（[remote-link-auth-and-relay](../../dev/plans/remote-link-auth-and-relay.md) S1）。token 被拒或调用 `UNAVAILABLE` 会先摘掉这条链路再重连（中继即新票）。这份钉死引擎仍跳过鉴权拦截器，验不到这个头，也不经过 Hub 中继票。远程路径仍要在强制鉴权模式（非回环绑定，或 `--hub`）下另验。

## 4. 历史本地补丁（当前钉不使用）

以下是旧钉的历史记录；2026-11-02 实读当前 PIN 与预包 VERSION 均为 clean，PIN 记录 local_patch=none，不再把下面两处当作当前补丁。旧钉当时编不过，曾在隔离 worktree 留两处本地改，未 push 回 UniverseAgent：

1. `generationJob` 类型改为 `CompletableJob`（`Job.complete()` 不在接口上）。
2. `AgentHome.defaultHomePath()` 读取 `UNIVERSE_AGENT_HOME`（外仓文档写了，源码原先只认 `~/.universe-agent`）。

日志归属以本次owned进程实际fd和appender为准。启动时可把stdout/stderr重定向到本波专用文件，并用 `readlink /proc/<owned-pid>/fd/1` 与 `/fd/2` 核实；本波已实证两fd均绑定自有日志。旧文所记 `~/.universe-agent/logs` 是历史共享user.home日志位置，不能未经当前归属核验就视为本份JVM的专用完整日志。单行缺PID、client/call/target标识时，两个worker线程号不能证明同一请求、同profile或某次失败导致最终字段变化。身份、会话、Grant仍在隔离 `agent-home/`。

占位 `ANTHROPIC_API_KEY` 只够 Connect。Chat 还要 ConfigStore 里的 `provider:state`（或 `provider:providers` + `provider:model_profiles`）以及 `models.json`：进程环境变量不会自动变成 model profile。`start-engine.sh` 会从 `~/.claude/settings.json` 导出 key / base / model，并跑 `seed-model-catalog.sh` 写入隔离 `agent-home/`（不打印 key）。改完须重启引擎。Engine 设置页可以 upsert 凭据、导入本地 harness，并在引擎提供写 RPC 后改模型注册表；seed 脚本仍是这份钉死引擎的启动引导。当前钉上的进程要重新编译并重启后才有 `UpsertModel` / `DeleteModel` / `SetModelEnabled`。在那之前，设置页里的 provider 导入仍可完成，模型写入会记为未实现。**2026-09-12** 重启后 grpcurl `ListModels` 非空、`AgentService/Chat` 带 `SessionInput.model_profile_id` **PASS**（`turnComplete`/`end_turn`）。本仓 Composer 发送时带同一字段（选中 catalog 的 `id`；诚实空选项不带）。这不是 IDE 接通冒烟，不升 PRD-008。

### 启动前核对预包与测试数据

不要只依据 PIN 宣称运行版本。核对 `start-engine.sh` 实际 engine_bin，读取其相邻 VERSION（source_sha/source_dirty/built_at），并在预包根执行 `sha256sum -c lib.SHA256SUMS`；source_sha 应与 PIN 一致。实际记录监听 50061 的 PID/cwd、UNIVERSE_AGENT_HOME 与启动日志；端口已监听则不二起。JVM 预包与 IDE 的 Node 编译环境分开，IDE shell 仍按仓库 `.nvmrc`。

Tools 验收的数据准备必须遵循当前 PIN 的公开 proto 和 AgentPresetLoader：新 profile 的 `system_prompt` 必须有非空正文，只有 summary/frontmatter 不可加载。唯一前缀、自有无效样本保全、公开 Delete/List 清理及原有 profile 哈希核对见[测试配置](test-profile.md#4-tools-临时数据与真实验收)。真实 Save 返回失败和真实读回必须分别记录，不把测试准备 API 成功或错误后的部分写当成成功保存验收。

## 5. 换钉

换钉触发已满足：要吃进引擎仓已合并的 IDE 远程协议 A–F（以及 store 自愈）。步骤见仓外 README。**仓外 PIN 已换**；不要把新 SHA 抄进本页。

[D25](../../dev/progress/deferred-gaps.md) / [D26](../../dev/progress/deferred-gaps.md) 已在这份钉上复验 List / Create 后关闭。空 catalog 当时不并入那两行；seed 后 Chat 已过引擎面。本仓不加兼容层。

## 相关

- [ADR-003](../../dev/decisions/003-engine-adapter-boundary.md) · [connection-hub-client](../../dev/plans/connection-hub-client.md)（Direct Address / SAS）
- [壳冒烟](shell-smoke-verification.md)（IDE 侧隔离 profile，与本引擎正交）
