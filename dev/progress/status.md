---
title: "Development Progress"
type: progress
status: active
phase: M5
updated: 2026-09-02
summary: "loop/merge 集成：D11 closed；D8 open（TS lib）；D9 partial；R6 closed @ ADR-005；R5 草案待规则 16"
---

# Development Progress

## Current Session

- **集成 HEAD：** `707479cb` — **agent-ide**（`loop/merge` 已并入；工位 A–C + D8 文档已对齐）。
- **已闭里程碑：** 壳层 PRD-001–016 / M5 / D1–D7 / **D11**；R6 closed @ [ADR-005](../decisions/005-changes-diff-owner.md)；R5 草案 [m6-engine-wave](../plans/m6-engine-wave.md) + [ADR-003](../decisions/003-engine-adapter-boundary.md)（`draft`，待规则 16）。

## Blockers

- **valid-layers-check：** v24.18.0 下仍红（TS lib / checker 对齐问题，非单纯 Node 误跑）→ [D8](deferred-gaps.md)
- **EH 矩阵：** panel + decoration **已实测** @ [d9](d5-evidence/smoke-d9-0001/)；`terminal` xterm 自动化 blocked → [D9](deferred-gaps.md)
- **PRD-008：** `blocked`；[m6-engine-wave](../plans/m6-engine-wave.md) + [ADR-003](../decisions/003-engine-adapter-boundary.md) **草案 done**，待规则 16 → [R5](research-queue.md)

## Next（后续开发任务排期，2026-09-02）

按依赖顺序；**阶段 0 与阶段 1 可并行**（不同冲突域）。

| 序 | 任务 | 类型 | 产出 / Exit | 工位建议 |
|:---|:-----|:-----|:------------|:---------|
| 0a | **D8** `valid-layers-check` TS lib 对齐（非 Node 误跑）；见 [D8](deferred-gaps.md) 复测 | infra | **仍 open** | merge |
| 0b | ~~**D11**~~ 证据目录收编 + `plans/INDEX.md` 修链 — **closed** | docs | ✅ | 主仓 |
| 0c | **D9** EH 矩阵 panel / terminal / `editor/decoration` | docs/验证 | **partial**（panel + decoration 已实测；terminal 待人工） | A |
| 1 | **R5 签收** [m6-engine-wave](../plans/m6-engine-wave.md) + [ADR-003](../decisions/003-engine-adapter-boundary.md) 规则 16 只读审查 | review | 草案 **done**；两文 `accepted` 或保持 draft | 独立 reviewer |
| 2 | ~~**R6 签收**~~ [ADR-005](../decisions/005-changes-diff-owner.md) — **closed** @ 2026-09-02 | review | ✅ ADR-005 `accepted`；ADR-004 `superseded` | — |
| 3 | ~~R7~~ PRD-010 产品身份 — **已裁决**：名 **UniverseAgentStudio**，图标复用 Desktop/Singularity 资产，**引擎波后再改**（[D12](deferred-gaps.md)） | 已决 | M6 闭后开 plan | — |
| 4 | **M6 引擎波实施**（R5 签收后）：adapter 同 token 替换 stub → page-access 切片 5 → customizations E1 → trajectory T4 → Engine pane 能力探测 | 实施 | 各方案 blocked 行转 `implemented`；D4 式隔离 profile 验收 | A–D 并行 |
| 5 | **D10** PRD-012 T5 搜索 / 虚拟化 / Overview | 实施（低优先） | 记录数或用户需求触发 | 任一 |

**不做**（requirements.md 明确排除）：整仓迁移 Desktop 文档、Agents Window 当默认壳、Cursor/Codex trade dress、完整扩展分发。
