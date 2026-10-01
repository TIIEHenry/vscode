---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-10-01
summary: "2026-10-01：人类工位与 loop/A–J、loop/merge 对齐 7cf1474419e。D24 只剩 SaveSkillContent 走 JSON。十六路审查切片已落，方案仍 accepted。PRD-008 仍 blocked。"
---

# Development Progress
> **当前迭代账**（规则 3a）。延期 → [deferred-gaps](deferred-gaps.md)。2026-09-30 会话流水 → [归档](../archive/status-current-session-2026-09-30.md)。
## Current Session

- **对齐**：人类工位 `agent-ide` 快进到 `7cf1474419e`，与 `loop/A`–`loop/J`、`loop/merge` 同尖。C 槽 `dev/loop` gitlink 仍不入库。
- **一拖二**：宿主按发起 lease 裁剪 `localPendingSends`，baseline 补齐 attribution；已决 permission 不再和待决座位叠成两次点击。
- **合入的 4 个提交**：浏览器单测模块加载失败改为非 0 退出；`ResolveTurn` / `ResolveAnchor` / `PtyStream` / `WatchConfig` 改 proto bytes；渲染进程跳过只能在 Node 加载的会话令牌测试；选择器把 `id` 放在 `class` 前。
- **D24**：仍开。`Connect`、`WatchConfig`、`ResolveTurn`、`ResolveAnchor`、`PtyStream` 已是 proto bytes。仍走 JSON 的只有 `SaveSkillContent`（引擎 proto 无该 RPC，不新增）。
- **十六路审查**：hold 切片已有对应提交在 `7cf1474419e`。方案 frontmatter 仍 `accepted`，不升 `implemented`。
- **PRD-008**：仍 `blocked`。`d8-evidence/7cf1474419e` 为 PARTIAL：回环曾显示 `Engine · Loopback`（不算通过）；Direct Address 停在 `Waiting for pairing`，主进程配对框未出现。
- **PRD-028 密度**：Sessions roster、轨迹表、Engine 首选项导航都是 22px 单行。轨迹表类型列是图标加正常大小写，表头无大写无底色；Engine 导航计数是弱化数字。Overview 分段条与其余验收未齐。本条不升 `implemented`。
- **槽 E**：Sessions Changes 在 `pairingPending` 时卸掉标题栏写钮，并在确认前拦住 `invokeChangesetOperation`。文件列表仍可留着。不升 PRD-007 / PRD-008。
### 进行中
| 槽 | 状态 |
|:---|:-----|
| **loop** | A–J 与 merge 在 `7cf1474419e`。C 仅脏 `dev/loop` gitlink（`44a684b04fc` → `1cbc39cacae`），不入库，不 `checkout -B`。 |
## 槽位（2026-10-01）

| 槽 | 状态 | HEAD |
|:---|:-----|:-----|
| merge、A、B、D–J | `idle` | `7cf1474419e` |
| C | `blocked` | 同尖；仅脏 `dev/loop` gitlink |
| edit（人类 `agent-ide`） | 已快进 | `7cf1474419e`；未跟踪截图仍在 |
## Next
| 项 | 指针 |
|:-----|:-----|
| **loop** | D24 不因 `SaveSkillContent` 再切刀。不得宣称 leftover / pills 完成。打开身份 S1–S4 已落，方案仍 accepted，见 [D944](deferred-gaps.md) |
| **十六路审查** | 切片已落，方案仍 [accepted](../plans/review-2026-09-30.md)，不升 implemented |
| **PRD-008** | `d8-evidence/7cf1474419e` PARTIAL。下次要先让主进程配对框出现并点 Verified on Engine。全 PASS 之前不升档 |
| **Sources** | [sources-architecture](../plans/sources-architecture.md) P6/P7 已落，方案仍 accepted。Accept hunk S1 已落，不升 PRD-009 |
| **U2** | ADR-007 Decision 5 未满足前不开 |
## 不做：U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC。
