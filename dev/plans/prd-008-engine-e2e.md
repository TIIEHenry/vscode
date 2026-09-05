---
title: "PRD-008 引擎黄金路径：隔离 profile 接通钉死调试引擎"
type: plan
status: accepted
phase: N/A
updated: 2026-09-04
summary: "验证 closer：复用 D4 Playwright-over-CDP，对仓外钉死引擎跑 Direct Address 连接→名单→发送流式→权限座位→断连快照；当前唯一已定义的 PRD-008 升档路径；硬前置 GC-1b（HEAD 无生产 trust 写入）；证据落 `dev/progress/d8-evidence/`"
---

# PRD-008 引擎黄金路径

> **定位：** 本稿是 [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) 的**验证 closer**（把已合入接线跑出用户可观察证据），不是新功能方案。接线合同仍以 [m6-engine-wave](m6-engine-wave.md)、[conversation-stream-timeline](conversation-stream-timeline.md)、[ADR-003](../decisions/003-engine-adapter-boundary.md)、[connection-hub-client](connection-hub-client.md)（只借 Direct Address / SAS，不跑 H4a）为准。  
> **引擎工位：** [debug-engine](../../docs/guides/debug-engine.md) — 仓外 `/home/clarence/Projects/Agents/vscode-debug-engine/`。status.md 写明「钉死调试引擎**不**升 PRD-008」。  
> **证据口径（签收裁定 2026-09-04）：** 本稿是 **当前唯一已定义的** PRD-008 升 `implemented` 路径：升档证据必须满足 [§3 断言表](#3-断言表) 全部 PASS。任何替代路径（其他引擎、其他连接方式）须另立方案并过规则 16，**不得**以「本稿只是推荐」为由绕开。[connection-hub-client](connection-hub-client.md) §5 现仍写「PRD-008 升 `implemented` 的启动冒烟证据可来自 loopback（M6-A2）」——**该句被本稿取代**：loopback skip-auth **不算** 008 证据；E6 升档提交须同时把该句改口（规则 3c）。[conversation-stream-timeline](conversation-stream-timeline.md) S4 仍列 gap→syncing 冒烟；该项**不挡** 008。本路径证据落 `dev/progress/d8-evidence/`（目录名是 008 助记）。正文**禁止**简称「D8」（撞 [deferred-gaps](../progress/deferred-gaps.md) 的 D8 `valid-layers-check`）。  
> **壳启动：** [shell-smoke-verification](../../docs/guides/shell-smoke-verification.md) + [launch skill](../../.agents/skills/launch/SKILL.md)。脚本体例对照 [d4-evidence `run-v1-v8.sh`](../progress/d4-evidence/c7ed501d/run-v1-v8.sh)。  
> **协议口径：** [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md)。**禁止发明引擎 RPC。**

[PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) 今天 `blocked`。M6-A1/A2、stream-timeline S1–S6、Hub client H1–H5 代码已合入，但没有「隔离 profile 启动 → 连钉死调试引擎 → 发消息 → 流式回合 → 权限座位 → 断连快照」的证据。依赖活数据的 [PRD-003](../../docs/product/requirements.md#prd-003-时间线与输入) / [004](../../docs/product/requirements.md#prd-004-权限座位) / [007](../../docs/product/requirements.md#prd-007-诚实降级) / [012](../../docs/product/requirements.md#prd-012-conversation-轨迹透镜) / [013](../../docs/product/requirements.md#prd-013-conversation-过程折) / [021](../../docs/product/requirements.md#prd-021-未知内容与错误的诚实呈现) / [022](../../docs/product/requirements.md#prd-022-navigator-引擎段) / [023](../../docs/product/requirements.md#prd-023-sources-review-审阅进度与归因) 因此卡在 `accepted`。[PRD-024](../../docs/product/requirements.md#prd-024-远程引擎连接connection-hub) 仍是 `proposed`（另要 H4a，见 [§5](#5-与-d4--d15--d20--h4a-的边界)）。

本稿**不**把 PRD-008 标成 `implemented`。本路径 [§4](#4-证据目录约定) 全绿之后，才允许**另一次**知识层提交把 `blocked → implemented`。loopback skip-auth、单测绿、人手「我连上过」都不算。

---

## 1. 目标 / 非目标

**目标：** 在有构建产物的工位上，对**钉死调试引擎**（仓外隔离 HeadlessServer，听 `127.0.0.1:50061`，不加 `--hub`）跑一条可复现黄金路径，把 JSON + 截图落到 `dev/progress/d8-evidence/<sha>/`。这是当前唯一已定义的 PRD-008 升档路径；替代路径须另立方案。

| 要证明 | 不靠什么 |
|--------|----------|
| 连接级 `ConnectionPhase`（连接阶段枚举）走到 `connected{path:'direct'}`；StatusBar 文案 `Engine · Direct` | Hub 登录、relay ticket、**loopback skip-auth** 冒充已连接（skip-auth **不算** 008 证据） |
| 会话名单来自引擎 `SessionService.List`，不是 stub 种子（本地占位会话 id `untitled` / `visualize`） | 单测里的 `MockUniverseAgentConnection` |
| 发送后助手回合**流式**出现在当前会话，不是 stub echo | `appendStubEchoAssistant`、fixture 文案带 `Stub:` |
| 权限座位 Allow / Skip 经 `AgentService.Chat` 臂 `PermissionResponse` 打到引擎（[ADR-003 审查记录](../decisions/003-engine-adapter-boundary.md#审查记录) 已选定，不双写 `PermissionService.Respond`） | 只改本地 `pendingActions` 却写「已授权」 |
| 断连后保留 UA 快照只读，不回填 `untitled` / `visualize` | 从未连接时的 stub 壳 |

**非目标：**

| 不做 | 去哪 |
|------|------|
| 新功能、改 adapter、改 fold、改引擎仓 RPC / proto | 永久不在本稿 |
| 把 PRD-008（或 003/004/007/…）标成 `implemented` | 证据全绿后的**另一次**知识层提交 |
| 升 Hub H4a / PRD-024 | [connection-hub-client](connection-hub-client.md) §5：H4a 真 Hub 冒烟；证据目录 `h4a-evidence/`。024 仍是 `proposed` |
| 起 UA 开发树 `:grpc-server:run`、加 `--hub`、连 `~/.universe-agent` | [debug-engine](../../docs/guides/debug-engine.md) |
| 重跑 D4 V1–V8 壳布局、D15 Web、D20 300px | [§5](#5-与-d4--d15--d20--h4a-的边界) |
| Navigator 活树 / Review 归因 / 轨迹 DetailRef 全文 / visualize 活卡 | 依赖 PRD-008，但**不是**本黄金路径关门项（G2/G3、G-NAV-*、G-REV-1 仍 open） |
| 用占位 `ANTHROPIC_API_KEY=sk-vscode-debug-dummy` 声称「已发消息」 | [§1.1](#11-开放前置p-)：dummy **只够** Connect / catalog |
| 声称「不改 `src` 就能出升档证据」却未满足 [P-PAIR](#11-开放前置p-) | 空 UDD 上 HEAD Direct Address 必 `trust_missing`，见下 |

### 1.1 开放前置（P-*）

缺任一条就停在该步，记 [D17](../progress/deferred-gaps.md)，**不得**把后续断言标 PASS，更不得升 PRD-008。

| ID | 前置 | 怎么确认 | 不够时 |
|----|------|----------|--------|
| **P-BUILD** | 本仓有 `out/`、`node_modules/`、`.build/electron/` | 在 merge 或主仓跑；新工位先 `npm run compile` | 不启动；与 D4 首轮「没产物」同类 |
| **P-GRPC** | Electron 能加载 `@grpc/grpc-js` | `test -d node_modules/@grpc/grpc-js`；launch 后 renderer/main 日志无 missing module | [D20](../progress/deferred-gaps.md) 已见缺失挡活窗。缺则 E0 失败，记 D17 |
| **P-ENGINE** | 钉死引擎已编、听 `127.0.0.1:50061` | 仓外 `./compile.sh`（换钉后才要）+ `./start-engine.sh`；`ss -ltn \| grep 50061` | 不连；不改 PIN、不 invent 端口 |
| **P-PAIR** | **[m7-gap-closeout](m7-gap-closeout.md) GC-1b 已合入 `agent-ide`**（硬前置，无替代） | HEAD 事实（2026-09-04 复核）：生产代码里**唯一**写 trust 的是 `pairingOrchestrator.ts`（`confirmSas` → `engineTrustStore.put`），而 `PairingOrchestrator` **生产零引用**；`universeAgentHubService.ts` `createDraft` 固定 `trust: null`；`connectionResolver.ts` Direct 无 trust 直接 `trust_missing`；pane SAS 确认分支为空。**因此 HEAD 上不存在任何能产生「已有 trust 的 UDD」的产品路径**——`reusedTrust` 只能来自 GC-1b 合入后的一次成功配对（见 §1.2），手工往 profile store 植入 trust JSON **不算**证据 | 停在 E1 BLOCKED（P-PAIR），记 D17。**禁止**写「不改 `src` 就能出升档证据」；本 closer 的实施顺序固定为 **GC-1b → E1–E5** |
| **P-FANOUT**（软） | [session-view-frame-fanout](session-view-frame-fanout.md) F1 是否已合入 | README 记 `fanoutF1: merged|absent`。F1 未合时 E3 允许**最多 3 次**重跑；三次仍因帧丢失 / 首帧未达失败 → E3 BLOCKED 并在 D17 指向 F1 | 不阻塞开跑；只影响失败归因 |
| **P-SAS** | 仅**首次配对**（GC-1b 已合、无 trust）：能批准 Device Grant | 读对话框正文里的 **Crockford 真码**（`[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}`，不含 I/L/O/U；**不是**字面 `XXXX-XXXX`）；**另一终端**跑 `./approve-grant.sh <真码>`；再点英文按钮 `Verified on Engine`。`JAVA_HOME` 与 `UNIVERSE_AGENT_HOME` 与 start 脚本同一套。`reusedTrust` 分支**无 SAS**，本条跳过 | pairing-pending（已弹出 SAS、尚无 `session_token`）**不算** connected（ADR-003 D7）。无 trust → `trust_missing`。对话框取消 → `disconnect`。取消 / 批不准 **不是** `grant_pending`。E1 FAIL |
| **P-LLM** | 真模型凭据，不是占位 key；且 **provider 与 model 一致** | **以 `start-engine.sh` 读 `~/.claude/settings.json` 为准**（`ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` 及可选 `ANTHROPIC_BASE_URL`）。未设置时脚本导出 `sk-vscode-debug-dummy`，**只够 Connect / catalog**。[debug-engine](../../docs/guides/debug-engine.md) §4 写「真发消息须改 `agent-home/config.json`」**已过时**——`config.json` 现无 key 字段，改它也补不了 dummy。另核：`start-engine.sh` 传 `--provider anthropic`，而 `agent-home/config.json` 的 `modelId` 若仍是非 Anthropic 模型（复核时为 `gemini-*`），E3 会以「模型不可用」失败——这是 **P-LLM 未满足**，不是产品 bug；README 记实际 provider / modelId | **无真 key 或 provider/model 不匹配：E1/E2 仍可跑；E3/E4 必须标 BLOCKED，不得用 stub echo 或「发送失败」冒充流式 PASS** |
| **P-PERM** | 引擎会发出权限请求 | HEAD `agent-home/config.json` 已是 `permissions.mode=ask`。发送文案须能触发工具（见 E4 提示词）。模型只回纯文本 → 无座位 | 无座位不得编造 E4 PASS；可重发带工具的提示，或记 D17「引擎本轮未发 permission_request」 |

`allowPrivateNetwork`（允许私网 / loopback 拨号）必须由自动化勾选：resolver 把 loopback 与 RFC1918 一起拦，不勾则 `private_network_denied`。

### 1.2 首次配对 vs reusedTrust（两者都以 GC-1b 已合入为前提）

| 分支 | 条件 | E1 期望 |
|------|------|---------|
| **首次配对** | GC-1b 已合入；source UDD **无**该引擎 trust | 点 Connect → 弹 SAS → 终端 `approve-grant.sh` 真码 → 点 `Verified on Engine` → `connected{path:'direct'}` |
| **reusedTrust** | GC-1b 已合入；source UDD 的 trust 来自**本仓 GC-1b 代码在此前一次运行中完成的配对**（README 须链到那次运行的证据目录） | 勾 `allowPrivateNetwork` 后 Connect → **不弹 SAS** → 直接 `Engine · Direct`。README 写 `reusedTrust:true` + 来源运行目录 |

**升档证据（首份全 PASS）必须走「首次配对」分支**——SAS 回路本身是 PRD-024 验收 3 / ADR-003 D7 的用户可观察行为，只有首次配对能证明它。`reusedTrust` 只用于同 SHA 重跑或后续回归。HEAD（GC-1b 未合）无论 UDD 内容如何都只会 `trust_missing`；手工植入的 trust JSON 不是任何分支。不要把「launch 起来了」写成 E1 PASS。

---

## 2. 黄金路径步骤

在**有产物**的工位执行。引擎与 IDE 分两个终端。证据目录先定：

```bash
REPO=/home/clarence/Projects/Agents/vscode
ENGINE=/home/clarence/Projects/Agents/vscode-debug-engine
SHA=$(git -C "$REPO" rev-parse --short HEAD)
EVIDENCE="$REPO/dev/progress/d8-evidence/$SHA"
mkdir -p "$EVIDENCE/screenshots"
export EVIDENCE_DIR="$EVIDENCE"
```

### 2.1 起钉死引擎（终端 A，前台）

```bash
cd /home/clarence/Projects/Agents/vscode-debug-engine
# 换钉后才需要：./compile.sh
./start-engine.sh
# 听 127.0.0.1:50061；日志若打印 “LLM key dummy — Connect/catalog only”
# 则 P-LLM 未满足，E3/E4 不得开。
```

停：`./stop-engine.sh`。**仅首次配对**（见 [§1.2](#12-首次配对-vs-reusedtrust)）弹出 SAS 后，**第三个终端**把对话框里读到的 Crockford 真码传给脚本（示例形态 `0H4X-JVFQ`，以当场读数为准）：

```bash
/home/clarence/Projects/Agents/vscode-debug-engine/approve-grant.sh "$SAS_CODE"
```

不要把字面 `XXXX-XXXX` 传给脚本。不要 `git pull` 该 worktree，不要加 `--hub`，不要指向 `~/.universe-agent`。

### 2.2 隔离 profile 启动 IDE（终端 B）

对照 [shell-smoke-verification §3](../../docs/guides/shell-smoke-verification.md)。`~/.vscode-oss-dev` 不存在时先建空源目录，否则 `launch.sh` `exit 2`。**空源目录只够 launch 不崩，不够过 E1。**

```bash
REPO=/home/clarence/Projects/Agents/vscode
test -d "$REPO/node_modules/@grpc/grpc-js" || { echo "P-GRPC missing"; exit 1; }
SOURCE_UDD="${CODE_OSS_DEV_AUTHED_USER_DATA_DIR:-$HOME/.vscode-oss-dev}"
if [[ ! -d "$SOURCE_UDD" ]]; then
  SOURCE_UDD=/tmp/d8-empty-udd
  mkdir -p "$SOURCE_UDD"
  echo "P-PAIR: empty UDD — E1 will trust_missing unless GC-1b is merged"
fi
LAUNCH="$REPO/.agents/skills/launch/scripts/launch.sh"
INFO=$("$LAUNCH" \
  --repo "$REPO" \
  --source-user-data-dir "$SOURCE_UDD" \
  --disable-workspace-trust \
  --skip-prelaunch \
  | tail -n1)
echo "$INFO" | tee "$EVIDENCE_DIR/launch.json"
CDP=$(jq -r .cdpPort <<<"$INFO")
PID=$(jq -r .pid <<<"$INFO")
export CDP PW_SESSION="d8-$SHA-$$"
```

`--skip-prelaunch` 仅当 `out/` 已是当前树。产物过期则去掉该旗，或先 `npm run compile`。

`reusedTrust` 时 `SOURCE_UDD` 必须是**已有 trust** 的目录（`CODE_OSS_DEV_AUTHED_USER_DATA_DIR` 或确认过的 `~/.vscode-oss-dev`），不要用上面的空目录回退。

### 2.3 Playwright over CDP

复用 D4 附着合同（[launch skill](../../.agents/skills/launch/SKILL.md)：唯一 `-s=$PW_SESSION`）。**禁止** `focus-chat-input.ts` / `monaco-paste.sh`（只认 Copilot Chat / Monaco，对 Conversation dock 无效）。

```bash
pw() { npx @playwright/cli -s="$PW_SESSION" "$@"; }
pw attach --cdp="http://127.0.0.1:$CDP"
sleep 5
pw press Escape 2>/dev/null || true
```

实施切片把下列步骤收进 `dev/progress/d8-evidence/run-golden-path.sh`（体例抄 `run-v1-v8.sh`：`pw eval` 落 JSON，每步截图）。**不要**改 D4 脚本本身。

| 步 | 动作 | 命令 / 选择器锚点（HEAD） |
|----|------|---------------------------|
| E1a | 打开 Connection | **首选** `pw eval` 点 StatusBar「Engine not connected」条目。命令 `workbench.action.openConnectionPreferences` 注册为 `f1: false`（`uaPreferencesNavigation.ts`），**Palette 打不开、D4 的 `run_cmd_id` 走不通**；备选是 Settings 齿轮菜单里的 Connection 入口 |
| E1b | Direct Address（手填 host:port，不经 Hub） | Host `127.0.0.1`、Port `50061`；勾 `#connection-allow-private-network`；点「Connect」 |
| E1c | SAS（仅首次配对） | 读原生确认框正文中的 Crockford 真码（**不是**字面 `XXXX-XXXX`）；终端跑 `approve-grant.sh <真码>`；再点 `Verified on Engine`。**无跳过**。pairing 中 StatusBar 仍为 `Engine not connected`。对话框取消 → `disconnect`（不是 `grant_pending`）。`reusedTrust`：**跳过本步** |
| E1d | 连接级断言 | StatusBar / `.connection-phase-label` = `Engine · Direct`（**不是**「已连接 / connected」——该词只归会话级，见 PRD-007 验收 4）。HEAD 无 trust 且无 GC-1b → `trust_missing`，本步不得 PASS |
| E2 | 会话名单 | 聚焦 Sessions 视图：`workbench.view.sessions.focus`（D4 V5 已用，见 [commands §](../../docs/systems/conversation/commands.md)）；读 `.conversation-sessions-list` 行。**PASS 须至少一行引擎会话**（id 非 `untitled` / `visualize`）。HEAD `ConversationEngineRosterService.getSessions()` 在 **List 未完成或 List 失败**时同样返回 `[]`，空列表与「引擎真无会话」DOM 同形——**因此空名单不是 PASS**：名单为空则点 SessionBar **New**，等到出现带引擎 id 的新行（`createSession` 是异步 UA Create，同步返回值仍是旧 active id；须等 `onDidChangeActiveSession` 后 DOM 行出现且 SessionBar 当前会话切到该 id），再判 E2；New 也无行 → E2 FAIL（记 List/Create 失败） |
| E3 | 发送 + 流式 | **前置：E2 PASS 且 SessionBar 当前会话 = 该引擎会话 id**（否则输入会落到 stub `untitled`）。输入是 `textarea.conversation-lens-dock-input`（`pw fill` / `pw eval` 写 value + input 事件）。Enter。用户行先「发送中」占位，随后正式用户行 + **流式**助手行（`streaming` / in-progress / `Codicon.loading`）。文案不得含 `Stub:`。S4 的 gap→syncing **不是**本步门槛。P-FANOUT 未合时允许 ≤3 次重跑 |
| E4 | 权限座位 | 提示词须能触发工具，例如：`Please list the files in this workspace using a tool (do not only reply in text).` 出现 `[data-honest-kind="permission"]` 且 Allow / Skip 可点 → 点 Allow → 按钮消失、记录仍在。**「打到引擎」不能只靠按钮消失证明**（Actor 写出的是本地 `permissionRespond` intent，DOM 上本地 cleanup 与真送达同形）——PASS 还须二选一：(a) 该 tool call 随后出现**工具结果行**（引擎真执行了被批准的工具）；(b) `start-engine.sh` 前台日志出现该 tool call 的 permission 已应答 / 工具执行记录，摘录进 `e4-permission.json`。无座位 → E4 BLOCKED（P-PERM），不是 PASS |
| E5 | 断连快照 | Connection 页选该 profile →「Disconnect」（不要「Forget this Engine」，以免清 trust、逼下次重配）。会话级徽标不再是 `Session live`；应为 `Session disconnected: …`（HEAD `formatSyncChromeLabel`）。时间线仍是 E3/E4 的 UA 回合，只读；Send 拒发或显式 `Engine not connected`。名单 **不**冒出 `untitled` / `visualize` |

清理（证据写完后）：

```bash
npx @playwright/cli -s="$PW_SESSION" close || true
kill "$PID" 2>/dev/null || true
/home/clarence/Projects/Agents/vscode-debug-engine/stop-engine.sh
```

---

## 3. 断言表

每条 FAIL = 该步 JSON `pass:false` + 截图。部分步骤因 P-* 未满足而没跑 = `blocked`，**不是** PASS。

| ID | 观察 | PASS | 负向（假绿） |
|----|------|------|----------------|
| **E1-phase** | 连接级 `getConnectionPhase()` | `kind==='connected'` 且 `path==='direct'`；芯片 `Engine · Direct`。首次配对须走过 SAS；`reusedTrust` 须 README 标明 | pairing-pending / Hub signedIn / Test Connection 成功写成 connected；芯片出现「已连接」「Engine · Hub relay」「Engine · Loopback」；`private_network_denied` / `trust_missing` 却标 PASS；loopback skip-auth 冒充 Direct；空 UDD + 无 GC-1b 标 PASS；对话框取消写成 `grant_pending` |
| **E2-roster** | 会话列表 | **至少一行**引擎会话（id / 标题来自引擎 List 或 New 后的 Create 结果）；**零** `untitled`、`visualize`；SessionBar 当前会话 = 该引擎 id | 把 stub 种子当 UA 行；List 未完成前闪现种子；用从未连接的壳名单冒充；**空列表 `[]` 标 PASS**（List 未完成 / 失败与真空同形）；New 后未等 Create 回包就开 E3 |
| **E3-stream** | 发送后时间线 | 同一**已有** UA 会话（非 untitled/visualize）：用户行（占位→正式）+ 助手行；流式期间可辨（`streaming===true` 或 in-progress aria / loading 图标）；完成后与历史行同类；无 `Stub:` | dummy key 下的发送失败当「流式」；stub echo；跳到 Chat 插件；无助手增量却 PASS；空名单上发送；缺 gap→syncing 却据此挡 008 |
| **E4-seat** | 权限座位 → 引擎 | 待处理 Allow / Skip 可见；Allow 后按钮消失、行仍在；**且**（工具结果行出现 **或** 引擎日志摘录证明应答已达）；无「已授权」而座位回到可点 + 失败原因 | 无 `permission_request` 却 PASS；**只凭按钮消失判送达**；只改本地、引擎侧工具未获准；把 Ask-user 问题座位当成 Allow/Skip |
| **E5-snap** | 断连后 UA 快照 | 时间线仍是 E3/E4 内容；徽标 `Session disconnected: …`（或等价「断开前快照」）；**不**出现 `Session live` / 「已同步」；名单不含 `untitled`/`visualize`；输入拒发或诚实 `Engine not connected` | 回填 stub 种子或 visualize 图示卡；清空时间线再填 Untitled；断开后仍显示「已连接」 |

E1 的连接级与 E3/E5 的会话级（SyncChrome：会话订阅徽标，五态 `idle/syncing/live/degraded/closed`）**各说各的**。E3 期间会话级应为 `Session live`（HEAD 英文；PRD-007 里「已连接」只允许出现在这一层）。StatusBar 在 E1 之后仍只说 `Engine · Direct`。S4 冒烟里的 gap→syncing **不**作为 008 关门项。

RPC 名只引用已登记面：`SystemService.GetAuthNonce` / `Connect`、`SessionService.List` / `GetHistory` / `SessionEventStream`、`AgentService.Chat`（含 `permission_response`）。不写不存在的 `SwitchSession`，不把 `PermissionService.Respond` 当本仓路径。

---

## 4. 证据目录约定

```text
dev/progress/d8-evidence/<sha>/
  README.md              # SHA、引擎 PIN 短哈希、P-* 检查、首次配对|reusedTrust、命令、断言结果表
  launch.json            # launch.sh 一行 JSON
  e1-phase.json
  e2-roster.json
  e3-stream.json
  e4-permission.json     # 无座位时 { "blocked": "P-PERM", "pass": false }
  e5-disconnect.json
  screenshots/
    e1-connected.png
    e2-roster.png
    e3-streaming.png
    e4-seat.png          # 或 e4-no-seat.png
    e5-snapshot.png
```

- `<sha>` = 被测 IDE 提交短哈希；同 SHA 重跑用 `rerun-<HHMM>`（D4 先例）。
- README 必须写：仓外引擎 `PIN` 短哈希与 listen `127.0.0.1:50061`（**不要**把 TLS 指纹抄进本仓方案；PIN 在仓外）；`reusedTrust` 或首次配对；P-PAIR 如何满足（GC-1b SHA，或 source UDD 已有 trust）。
- 可复用 harness 放 `dev/progress/d8-evidence/run-golden-path.sh`（不进 `<sha>/` 亦可，避免每跑一份拷贝）。
- 不留未跟踪空目录（[D11](../progress/deferred-gaps.md) 教训）：跑完 `git add` 证据，或删除失败残骸。
- **本路径 E1–E5 全 PASS（首份须走首次配对分支），是 PRD-008 升档的必要证据。** 代码已合入、单测绿、人手「我连上过」、**loopback skip-auth** 都不算。升档提交须同时改 `requirements.md`（补验收标准）、`traceability.md`（若 docs-burden S2 已落地则经脚本）、`status.md`、[connection-hub-client §5](connection-hub-client.md) 的 loopback 句，并按 [DOCUMENTATION 规则 3c](../../docs/DOCUMENTATION.md) 扫知识层「仍 blocked / 待接通」改口。升档是 E6 切片，不与 E1–E5 同 commit。S4 gap→syncing 未跑**不**阻止这次升档。

部分通过（例如只有 E1/E2）：证据仍落盘，README 标 PARTIAL；PRD-008 **保持 `blocked`**。

---

## 5. 与 D4 / D15 / D20 / H4a 的边界

| 项 | 证明什么 | 证据 | 能否代替本稿 |
|----|----------|------|----------------|
| **D4** | 默认窗壳：Conversation 中心、四钮、Chat 路由、Sources 三 tab | `d4-evidence/` + [shell-smoke-verification](../../docs/guides/shell-smoke-verification.md) | 否。无引擎、无发送链 |
| **D15** | Web 入口仍是 Agent IDE；本机引擎控件省略 | `d15-evidence/`（尚无） | 否。Web 的 `IUniverseAgentConnection` 诚实 `disconnected`（PRD-019） |
| **D20** | Settings 默认窗约 300px 仍见搜索与 Client 组标题 | 活窗目视；曾被 `@grpc/grpc-js` 挡住 | 否。窄宽度视觉，不是会话权威 |
| **H4a** | 真 Hub：登录 → 设备目录 → SAS → 中继/直连 | `h4a-evidence/`；升 [PRD-024](../../docs/product/requirements.md#prd-024-远程引擎连接connection-hub)（024 仍 `proposed`） | 否。[connection-hub-client](connection-hub-client.md) 已钉：PRD-024 **必须**真 Hub。本稿是后者的**反面**：`--no-uds`、不加 `--hub`、手填 `127.0.0.1:50061`。同文「008 证据可来自 loopback」被本稿收紧为 **skip-auth 不算** |
| **本稿** | 钉死引擎 + Direct Address 黄金路径（当前唯一已定义的 008 升档路径） | `dev/progress/d8-evidence/` | — |

共用启动手段（`launch.sh` + CDP + Playwright），不共用断言、不共用证据目录。D4 的 `run-v1-v8.sh` 只读 layout；本稿脚本只读 phase / roster / timeline / seat。

---

## 6. 切片与文件互斥

验证 closer：harness 与证据默认**不改** `src/vs/**`。发现产品 bug → 停升档、记 D17，另开修复切片（不在本稿塞功能）。

**不得**写「不改 `src` 就能出升档证据」，除非 [P-PAIR](#11-开放前置p-) 已满足：GC-1b 已合入（首次配对可弹 SAS 并 `confirmPairing`），或 source UDD 已有 trust。空 UDD 上跑 harness 可以不改 `src`，但 E1 在 HEAD 会 `trust_missing`，那**不是**升档证据。GC-1b 接线属于 [m7-gap-closeout](m7-gap-closeout.md)，不在本稿塞功能。

| 切片 | 做什么 | 可改路径 | 禁止 |
|------|--------|----------|------|
| **E0** | harness：`run-golden-path.sh`、本方案命令校对 | `dev/progress/d8-evidence/run-golden-path.sh`、本稿 | 改 D4/D15 脚本；改仓外 `PIN` / UA 源码；在 P-PAIR 未满足时把空 UDD 跑通写成升档证据 |
| **E1–E5** | 跑黄金路径、落 JSON/截图/README | 仅 `dev/progress/d8-evidence/<sha>/**` | 改 `requirements.md` / 任何 PRD 状态；改 `h4a-evidence/` |
| **E6**（证据全绿之后） | 知识层升档 | `docs/product/requirements.md`、`traceability.md`、`status.md`、相关 systems 改口 | 与 E1–E5 **同一 commit**；无证据却升档；用 loopback skip-auth 当 008 证据 |

**并发：** UI 槽可继续改与引擎接线无关的 contrib。禁止与本稿同时改 `dev/progress/d8-evidence/`、禁止有人抢先把 PRD-008 标 `implemented`。仓外引擎工位不是 loop A–D 槽，不要写进 [worktree-pool](../progress/worktree-pool.md)。

**与同批方案的顺序（签收裁定）：**

| 方案 | 关系 |
|------|------|
| [m7-gap-closeout](m7-gap-closeout.md) GC-1b | **硬前置**。GC-1b 合入 `agent-ide` 之前只能做 E0（harness 起草，不改 `src`） |
| [session-view-frame-fanout](session-view-frame-fanout.md) F1 | 软前置（P-FANOUT）。不等它；失败归因用 |
| [giant-file-split](giant-file-split.md) GFS-1–3 | 证据按 SHA 目录落盘；GFS 切片合入后若重跑，按新 SHA 建目录。harness 只认 DOM 选择器与命令 id，不 import 源码，故不与拆分互斥 |
| [packaging-and-release](packaging-and-release.md) | 共享 P-GRPC：开发态 `launch.sh` 缺 `@grpc/grpc-js` 的根因由该方案 §4.1 / §4.4 查；本稿 E0 只检不修 |
| [test-baseline-ci](test-baseline-ci.md) | 无文件重叠。E1–E5 不受 D16 红测影响 |
| [docs-burden-reduction](docs-burden-reduction.md) S2 | 若 S2 已落地，E6 改 `requirements.md` 状态行后**必须**跑 `generate-docs-status.py`，不得手改 `traceability.md` 产品状态列 |

### 6.1 验收

1. `dev/progress/d8-evidence/<sha>/README.md` 存在，E1–E5 表均为 PASS（无 `blocked` 冒充）。
2. 五份 JSON 与五张（或 E4 缺座位时的 `e4-no-seat`，该情形**不能**当总 PASS）截图路径可点开。
3. README 写明 P-LLM / P-GRPC / P-SAS / P-PAIR 实测值（真 key 来源只写「claude settings / env」，**不写密钥**；配对分支写首次或 `reusedTrust`）。
4. `check-docs-health.py` 在增加本方案与证据 README 的 frontmatter 后 0 error（证据 JSON/PNG 不参与）。
5. **在 1–4 成立之前，PRD-008 保持 `blocked`。** loopback skip-auth 与 S4 gap→syncing 未跑都不改变本条。

### 6.2 失败怎么记 D17（不假装 implemented）

对照 [D17](../progress/deferred-gaps.md) 与 [health-gates](../progress/health-gates.md)：普通验证失败不进 `status` Blockers，但**阻止**对应 PRD 升 `implemented`。

在 `deferred-gaps.md` D17 节追加一条（不要新开 D 号，除非出现新的结构性缺口；**不要**用「D8」当本路径前缀，撞 deferred-gaps D8）：

```text
008/<sha> <E#> <场景> | baseline/新增 | 结果 FAIL|BLOCKED | 证据路径 | owner
```

| 失败类 | 记法 | 禁止 |
|--------|------|------|
| P-GRPC / 启动崩（D20 同类） | D17 + E0 BLOCKED | 「代码已接线」当通过 |
| P-PAIR：无 trust 且无 GC-1b | D17 + E1 BLOCKED（P-PAIR） | 「不改 src 已出升档证据」；空 UDD 当 E1 PASS |
| dummy key，E3 无助手流 | D17 + E3 BLOCKED（P-LLM） | 用 stub echo 或失败文案凑流式 |
| 无 trust / 对话框取消 | D17 + E1 FAIL（`trust_missing` 或 `disconnect`） | 写成 `grant_pending`；pairing-pending 当 connected |
| 引擎未发权限 | D17 + E4 BLOCKED（P-PERM） | 空座位 PASS |
| 断连回填 stub 种子 | D17 + E5 FAIL；**产品 bug**，另开修复，PRD-008 保持 blocked | 当「部分实现」升档 |
| 断言脚本自己的选择器漂 | 修 harness 重跑；不记产品 FAIL，除非 UI 真缺 | 改产品文案来迁就脚本 |

---

## 7. 风险

| 风险 | 缓解 |
|------|------|
| **`@grpc/grpc-js` 运行时缺失**（D20 已见：隔离 launch 开不了窗） | E0 先检 `node_modules/@grpc/grpc-js`；缺则 `npm install` 后重编，仍缺记 D17，不改断言放水 |
| **引擎无真模型 key** | P-LLM；以 `start-engine.sh` → `~/.claude/settings.json` 为准，**不要**按 debug-engine §4 去改 `config.json`。dummy 只跑到 E2。禁止改引擎仓「假流式」RPC |
| **SAS / Grant / 配对回路** | HEAD 无 `confirmPairing`：无 trust → `trust_missing`，不弹 SAS。首次配对阻塞 GC-1b；`reusedTrust` 可无 SAS。自动化须读对话框 Crockford 真码再调 `approve-grant.sh`，按钮是 `Verified on Engine`。取消 → `disconnect`。不要用 loopback skip-auth 绕 Grant（skip-auth 只跳过 session_token 拦截器，TLS pin 与 Grant 仍在；且 skip-auth **不算** 008 证据） |
| Palette 自动化不可靠 | 与 D4 相同：优先命令 id + `pw eval` 点已知控件 |
| Conversation 输入不是 Copilot Chat / Monaco | 只认 `textarea.conversation-lens-dock-input`。禁止 `focus-chat-input.ts` / `monaco-paste.sh` |
| 钉漂 / 端口被占 | 以仓外 `PIN` 为准；`50061` 被占先 `stop-engine.sh`。不连 UA 默认 `50051` |
| 与 H4a 口误 | 本稿零 Hub 账号、零 `--hub`。有人把 Direct Address 成功写成「Hub 已通」→ 驳回。024 仍是 `proposed` |

---

## 相关

- [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) · [PRD-003](../../docs/product/requirements.md#prd-003-时间线与输入) · [PRD-004](../../docs/product/requirements.md#prd-004-权限座位) · [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级)
- [m6-engine-wave](m6-engine-wave.md) §6 断连 · §8 A2 冒烟（hello→live、断连→closed 快照）
- [conversation-stream-timeline](conversation-stream-timeline.md) §3.5 发送 · §3.8 断连 · S4/S5（S4 gap→syncing **不挡** 008）
- [connection-hub-client](connection-hub-client.md) Direct Address / SAS；H4a **不是**本稿；loopback skip-auth **不算** 008 证据
- [m7-gap-closeout](m7-gap-closeout.md) **GC-1b** 配对回路（P-PAIR）
- [ADR-003](../decisions/003-engine-adapter-boundary.md) · [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md)
- [debug-engine](../../docs/guides/debug-engine.md)（§4「改 config.json」过时；key 以 `start-engine.sh` 为准）· [shell-smoke-verification](../../docs/guides/shell-smoke-verification.md)
- [status.md](../progress/status.md) · [deferred-gaps.md](../progress/deferred-gaps.md) D17 / D20（不要把本路径写成「D8」）
- 体例：[m4-validation-wave](m4-validation-wave.md)

## 规则 16 审查记录

**第一轮 Assessment：Approve with changes。** 2026-09-04 只读审查对照 HEAD 核验；Critical / Important 已改入本稿（当时 `status` 仍 `draft`；签收见第二轮）。

| 项 | 已改入 |
|----|--------|
| **C1** | 硬前置 **P-PAIR**：closer 阻塞 GC-1b，或 reusedTrust source UDD；空 UDD 不得默认可过 E1。禁止无条件写「不改 `src` 就能出升档证据」 |
| **C2** | 去掉「唯一门槛」；本稿 = 推荐 Direct+钉死引擎黄金路径；点名 loopback skip-auth **不算** 008 证据；S4 gap→syncing 不挡 008。目录仍 `dev/progress/d8-evidence/`（反引号，不链尚不存在的目录）；正文不简称「D8」 |
| **C3** | 取消 / 批不准不是 `grant_pending`。无 trust → `trust_missing`；对话框取消 → `disconnect` |
| **I1** | PRD-024 改为 `proposed`，不列入「卡在 accepted」 |
| **I2** | SAS 按钮改为英文 `Verified on Engine`；读 Crockford 真码，禁止字面 `XXXX-XXXX` |
| **I3** | 视图 id `workbench.view.conversationSessions`；删除 `workbench.view.sessions.focus` |
| **I4** | 空名单只过 E2；E3 须已有非 untitled/visualize 的 UA id |
| **I5** | 输入 `textarea.conversation-lens-dock-input`；禁止 `focus-chat-input.ts` / `monaco-paste.sh` |
| **I6** | 点名 debug-engine §4「改 config.json」过时；以 `start-engine.sh` 读 `~/.claude/settings.json` 为准 |
| **I7** | 见 C2：不与 deferred-gaps D8 撞号 |
| **I8** | 已有 trust 的 UDD 可无 SAS；§1.2 分首次配对 vs `reusedTrust` |
| **Minor** | `phase` 改为 `N/A`（仓库无 M8） |

### 第二轮：对抗性审查（Cursor CLI `cursor-grok-4.6-high`，只读）+ 架构裁定 + 签收（2026-09-04）

父会话逐条用 grep / 读文件复核后改入。**Assessment：Approve with changes → 改入后签收 `accepted`。**

| 级别 | 意见（已复核属实） | 处理 |
|------|--------------------|------|
| **C1** | `reusedTrust` 是幻影前置：生产唯一写 trust 的 `pairingOrchestrator.confirmSas` 零引用；`createDraft` 固定 `trust: null`；resolver Direct 无 trust 直接失败。HEAD 造不出「先前配对留下的 UDD」 | P-PAIR 改为 **GC-1b 硬前置、无替代**；§1.2 两分支都以 GC-1b 为前提；首份升档证据必须走首次配对；手工植入 trust 不算 |
| **C2** | 「推荐非唯一门槛」+ connection-hub-client §5「008 证据可来自 loopback」未改口，仍能凭 loopback / PARTIAL 升档 | 证据口径改为「当前唯一已定义路径」；替代路径须另立方案过规则 16；E6 须同时改口 hub-client §5 该句 |
| **C3** | E2 空名单可假 PASS：`getSessions()` 在 List 未完成 / 失败时同样返回 `[]` | E2 PASS 须至少一行引擎会话；空则 New 并等 Create 回包与 active 切换；空列表不再是 PASS |
| I1 | F1 fanout 未列为 E3 前置 | 新增软前置 P-FANOUT：不阻塞，≤3 次重跑，失败归因指向 F1 |
| I2 | 空名单点 New 会打到 `untitled`（`createSession` 同步返回旧 active id） | E2/E3 写明须等 `onDidChangeActiveSession` 且 SessionBar 当前会话 = 引擎 id |
| I3 | `openConnectionPreferences` 是 `f1: false`，Palette / `run_cmd_id` 走不通 | E1a 首选 StatusBar 点击，写明 Palette 不可用 |
| I4 | `workbench.view.sessions.focus` 存在且 D4 V5 用过，本稿误写「没有」 | E2 改用该命令 |
| I5 | E4 按钮消失 ≠ 打到引擎（Actor 写本地 `permissionRespond` intent） | E4 PASS 增加二选一：工具结果行 **或** 引擎日志摘录 |
| I6 | 与 giant-file-split 等同批方案无互斥 / 顺序 | §6 新增「与同批方案的顺序」表 |
| I7 | `config.json` `modelId` 与 `start-engine.sh --provider anthropic` 不一致会让 E3 假 BLOCKED | P-LLM 增加 provider / model 一致性检查并记 README |
| Minor | 上轮「Approve with changes」是自评；`-s=` / `--s=` 两种写法；`approve-grant.sh` usage 仍印 `XXXX-XXXX` | 记录于此；harness 以 launch SKILL 的 `-s=` 为准；脚本 usage 属仓外，不改 |

**签收（2026-09-04，用户委托「架构由本会话裁定」）：** `status` → `accepted`。实施顺序：**GC-1b（m7-gap-closeout，P 槽）→ E0 harness（可与 GC-1b 并行，不改 `src`）→ E1–E5（GC-1b 合入 `agent-ide` 后）→ E6 升档**。PRD-008 保持 `blocked` 直到 §4 全 PASS。
