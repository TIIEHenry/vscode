---
title: "钉死 UniverseAgent 引擎（IDE 调试）"
type: guide
status: accepted
phase: M7
updated: 2026-11-05
summary: "仓外隔离 worktree 编 HeadlessServer。源码工位由 PIN 固定，线上二进制以 engine/VERSION 与 lib.SHA256SUMS 为准；IDE 用同一个 UNIVERSE_AGENT_HOME 发现 UDS 或 pinned TCP，不再扫固定端口。手填 Direct Address 仍走 Device Grant。换钉以仓外 PIN 为准；真实 SGLang 探针走 UniverseAgent 的 integration-tests。"
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
| 源码 | 分离头指针 worktree `vscode-debug-engine/universe-agent-027ab/`，实际目录与 SHA 以 `PIN` 的 worktree/pin_sha 为准 |
| 实际执行 | `start-engine.sh` 执行 PIN 登记的 `engine_bin` 预包，不执行当前 worktree 的 Gradle run；版本以该包 `VERSION` 与 `lib.SHA256SUMS` 为准 |
| 数据 / TLS / Grant | `vscode-debug-engine/agent-home/`（`UNIVERSE_AGENT_HOME`），**不是** `~/.universe-agent` |
| 监听 | `127.0.0.1:50061`（避开 UA 默认 `50051`） |
| 形态 | HeadlessServer TCP `--no-uds`，**不加** `--hub` |

这不是 Loop 字母槽，不要写进 [worktree-pool](../../dev/progress/worktree-pool.md) 的 A–D 表。

## 2. 命令

在 `vscode-debug-engine/`：

```bash
./compile.sh          # 换钉时编 HeadlessServer 及运行时模块；完整模块与复制步骤按仓外 README，不在 UI 验收中临时换钉
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

### 历史本地补丁（当前钉不使用）

以下是旧钉的历史记录；2026-11-02 实读当前 PIN 与预包 VERSION 均为 clean，PIN 记录 local_patch=none，不再把下面两处当作当前补丁。旧钉当时编不过，曾在隔离 worktree 留两处本地改，未 push 回 UniverseAgent：

1. `generationJob` 类型改为 `CompletableJob`（`Job.complete()` 不在接口上）。
2. `AgentHome.defaultHomePath()` 读取 `UNIVERSE_AGENT_HOME`（外仓文档写了，源码原先只认 `~/.universe-agent`）。

日志归属以本次owned进程实际fd和appender为准。启动时可把stdout/stderr重定向到本波专用文件，并用 `readlink /proc/<owned-pid>/fd/1` 与 `/fd/2` 核实；本波已实证两fd均绑定自有日志。旧文所记 `~/.universe-agent/logs` 是历史共享user.home日志位置，不能未经当前归属核验就视为本份JVM的专用完整日志。单行缺PID、client/call/target标识时，两个worker线程号不能证明同一请求、同profile或某次失败导致最终字段变化。身份、会话、Grant仍在隔离 `agent-home/`。

占位 `ANTHROPIC_API_KEY` 只够 Connect。Chat 还要 ConfigStore 里的 `provider:state`（或 `provider:providers` + `provider:model_profiles`）以及 `models.json`：进程环境变量不会自动变成 model profile。`start-engine.sh` 会从 `~/.claude/settings.json` 导出 key / base / model，并跑 `seed-model-catalog.sh` 写入隔离 `agent-home/`（不打印 key）。改完须重启引擎。当前 027ab 钉已包含 `UpsertModel` / `DeleteModel` / `SetModelEnabled` 与 `GetPermissionMode` 的引擎实现；这只证明二进制已换钉，不等于 IDE 产品路径已验收。模型目录仍由 seed 脚本提供启动基线。本仓 Composer 发送时带 `SessionInput.model_profile_id`（选中 catalog 的 `id`；诚实空选项不带）。

### 启动前核对预包与测试数据

不要只依据 PIN 宣称运行版本。核对 `start-engine.sh` 实际 engine_bin，读取其相邻 VERSION（source_sha/source_dirty/built_at），并在预包根执行 `sha256sum -c lib.SHA256SUMS`；source_sha 应与 PIN 一致。实际记录监听 50061 的 PID/cwd、UNIVERSE_AGENT_HOME 与启动日志；端口已监听则不二起。JVM 预包与 IDE 的 Node 编译环境分开，IDE shell 仍按仓库 `.nvmrc`。

Tools 验收的数据准备必须遵循当前 PIN 的公开 proto 和 AgentPresetLoader：新 profile 的 `system_prompt` 必须有非空正文，只有 summary/frontmatter 不可加载。唯一前缀、自有无效样本保全、公开 Delete/List 清理及原有 profile 哈希核对见[测试配置](test-profile.md#4-tools-临时数据与真实验收)。真实 Save 返回失败和真实读回必须分别记录，不把测试准备 API 成功或错误后的部分写当成成功保存验收。

## 5. 换钉

换钉触发已满足：要吃进引擎仓已合并的 IDE 远程协议 A–F、权限模式读回和模型写 RPC。步骤见仓外 README。更新时先从干净 commit 建 detached worktree，再编完整运行时模块；启动后以 `engine/VERSION` 核对实际二进制，不把当前开发树的 dirty HEAD 当发布钉。

## 6. SGLang 真实 Provider 探针

当前 VS Code 仓没有独立的 SGLang 服务入口；真实模型协议探针沿用 UniverseAgent 仓的固定脚本。它会发现 `/v1/models`（或使用显式模型名），把 token 只放在当前进程环境中，不写入仓库或证据文件：

```bash
cd /home/clarence/Projects/Agents/UniverseAgent
export SGLANG_ANTHROPIC_BASE_URL="http://192.168.10.68:8192"
export SGLANG_MODEL="Local"                 # 省略时从 /v1/models 发现
export SGLANG_ANTHROPIC_AUTH_TOKEN="<token>" # 不要提交或打印
scripts/run-sglang-integration-tests.sh --protocol anthropic
```

也可用 `--protocol chat`、`responses`、`both` 或 `all` 验证对应的 OpenAI-compatible 路径。2026-11-05 在 UniverseAgent commit `1e253d6aeeb856b13e02e6db14868f95ca0dbc26`、campaign `sglang-l4-1e253d6aee-20261105`、同一 SGLang `Local` 模型上分别跑了 Anthropic、OpenAI Chat 和 OpenAI Responses 探针，三种协议各覆盖文本流终止、工具调用回灌和权限拒绝，汇总为 **9 个协议/场景组合通过**；五次尝试合计 **45/45 pass**，包含 78 次 LLM 请求和 30 次 root tool start，`usageQuality=unverified`。这里的证据只覆盖 UniverseAgent 三个协议适配器到该 endpoint/model 的这些真实调用场景，不代表其他 Provider、模型或业务任务；F21 两模型 `k=3` 稳定性矩阵也未覆盖。日志中的未知 context window 警告在本次调用中未导致这些 case 失败；本次 endpoint 对缺省或错误 token 也未表现出认证拒绝，因此认证门禁仍未验证。上述结果不等于默认编辑器窗口或 50061 引擎已经完成 UI / Composer 端到端验收。

同日 Terra 追加了真实最小请求探针：`/v1/messages` 带完整 `model=Local`、`messages=[ping]`、`max_tokens=1` 时，无 `Authorization`、`Bearer invalid` 和 `x-api-key invalid` 都返回 HTTP 200，并产生 thinking token（`usage input=11/output=1`）；`/v1/chat/completions` 也在无认证和 `Bearer invalid` 下 HTTP 200（`prompt=11/completion=1`）；`/v1/responses` 在满足 SGLang reasoning 最小预算的 `n=16`、`n=256` 下同样无认证和无效 token 都 HTTP 200。三协议 endpoint 均未执行有效认证校验；Responses 的 `n=1` HTTP 400 是 `max_new_tokens` 预算约束，不是认证拒绝，不能把此前的字段校验 400 当成认证通过。当前 `127.0.0.1:50061` 未监听，shell 中也没有可重跑 L4 的 SGLang token。

Terra 随后用临时环境凭据实际重跑 `--protocol all` 和 Anthropic 单协议，但两次都在 UniverseAgent Kotlin 编译阶段出现 Gradle daemon disappeared，未产生新的 live 记录；降低 Gradle 堆上限后仍复现。该次失败没有 OOM 文本，重跑时根盘约剩 18G、`/sdd` 约剩 528G，swap 已满，因此不能把它记作新的通过或替代 45/45 证据。

Terra 的后续只读刷新再次命中同一 endpoint：Anthropic 无认证/无效 Bearer 均 HTTP 200（usage input=11/output=1），Chat 同样 HTTP 200（prompt=11/completion=1），Responses 在 `max_output_tokens=16` 下无认证/无效 Bearer 均 HTTP 200（input=11/output=14/reasoning=14），三协议认证未执行有效校验。随后完成的 Responses ablation retry9（报告目录 `/sdd/tmpworkteees/UniverseAgent-continue/build/reports/task-level-eval/sglang-workspace-v2-responses-ablation-k3-retry9-1e253d6aee-20261105`，同一 commit 且 `dirty=false`）最终记录：`short-alerts` normal/ablated 各 3/3 通过；`short-orders` normal 3/3、ablated 2/3（1 次 assertion fail）；`parallel-checkout` normal/ablated 各 2/3，双方 `routeConformance=fail`；`parallel-collections` 2 次通过但 `routeConformance=fail`。`long-ledger`、`long-inventory` 仍无报告，因此 F21 / `k=3` 仍是 incomplete。retry10 的报告目录为 `/sdd/tmpworkteees/UniverseAgent-continue/build/reports/task-level-eval/sglang-workspace-v2-responses-ablation-k3-retry10-1e253d6aee-20261105`；已为 short/parallel、long-ledger、long-inventory 与 deep-storage 写出完整 `k=3` summary：short-alerts、parallel-collections、deep-storage 均 normal/ablated 3/3；short-orders normal 3/3、ablated 2/3；parallel-checkout normal 1/3、ablated 3/3；long-ledger 与 long-inventory normal/ablated 均 0/3。deep-storage 六次调用虽 result=pass，但每次 routeConformance 都因缺少 `deep_think` route/tool 失败；long 场景失败主要是 compact route 缺失。deep-queue summary 已完成：normal 2/3、ablated 3/3，normal 含 1 次 executor `IllegalStateException`，其余调用 result=pass 但 `deep_think` routeConformance 失败；retry10 的 Gradle worker 已退出，XML 终态记录 1 test / 1 failure / 0 errors（`L5 ablation strict failures`：parallel-checkout、long-ledger、long-inventory、deep-queue），报告齐全，但 F21 仍因 long-ledger/long-inventory 0/3 与多项 routeConformance 失败而 incomplete。

[D25](../../dev/progress/deferred-gaps.md) / [D26](../../dev/progress/deferred-gaps.md) 的 List / Create PASS 属旧钉历史；027ab 新钉尚未重跑业务验收，不能把旧证据迁移到当前版本。空 catalog 当时不并入那两行；本仓不加兼容层。

## 相关

- [ADR-003](../../dev/decisions/003-engine-adapter-boundary.md) · [connection-hub-client](../../dev/plans/connection-hub-client.md)（Direct Address / SAS）
- [壳冒烟](shell-smoke-verification.md)（IDE 侧隔离 profile，与本引擎正交）
- UniverseAgent 仓外脚本：`/home/clarence/Projects/Agents/UniverseAgent/scripts/run-sglang-integration-tests.sh`
