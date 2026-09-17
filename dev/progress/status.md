---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-17
summary: "合入 Usage context_window=10 + session_usage=11。compile-client 0；聚焦 5 passing。D24 仍开。不是 leftover/pills 完成。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。历史 → [归档](../archive/status-current-session-slot-catalog-2026-09-05.md)。
## Current Session
### 已合入（`MERGE_SHA` 见下；compile-client 0；聚焦 5 passing）
| 切片 | 提交 |
|:-----|:-----|
| **A Usage 10/11** | `564a4645b0b` — Usage `context_window`=10 + `session_usage`=11；仍 `mapUsageResponse` |
| **A Usage spans** | `7f42b796fe9` — `recent_request_spans`=12 |
| **F decode** | `0e6ca17a9ec` — CheckConnection 复用 GetNode |
| **A Upload** | `8405657fd37` / `330ce8cafc0` — UploadAttachment bytes |
| **C decode** | `db2d394e63b` — ListNodes capabilities/load |
| **D nested** | `36faa3fe32e` — RemoteAgentConfig 5/6/10/11 |
| **A 四流 bytes** | `d7754adb481` — SubscribeToolDetail / Rebuild / RemoteChat / Download |
| **A D24 流** | `ae31bd96fc7` — Continue/Regenerate/Resume bytes；[D24](deferred-gaps.md) 仍开 |

**D25/D26 已闭**。不是 leftover/pills 完成。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **D** | Session.Resume `root_agent`=3（未合入） |
| **H** | File/Memory/Team leftover nested 猎 |
| **B** | 脏 `worktree-pool.md`；跳过；勿 `-B` |
| **C** | gitlink 脏 `dev/loop`；勿 add |
| **E** | `blocked` `fix/ci-gate-reds` |
| **edit** | ff-only 失败；勿 reset |

子 agent 发现：
| ID | 问题 |
|:---|:-----|
| [D24](deferred-gaps.md) | **仍开**：Usage 10/11/12 已 decode；Connect/SaveSkillContent/Watch/Resolve/Pty 仍 JSON；`model_info`=9 unread |
| — | GetConfig 省略 tags=`[]` vs GetNode `undefined`（测锁 `[]`） |
| — | `decodeAgentProfile` 读测锁 17–19；J 无这三号；8/9 无公共 createdAt |
| [D487](deferred-gaps.md) | **closed** Memory `score`=4 |
| [D550](deferred-gaps.md)–[D674](deferred-gaps.md) | leftover catch **closed**；leftover **未**全局完成 |
## Next
| 项 | 指针 |
|:---|:-----|
| **loop** | D24 仍开。D Resume `root_agent`。不得宣称 leftover/pills 完成 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
