---
title: "Development Progress"
type: progress
status: active
phase: M5
updated: 2026-09-02
summary: "loop/B：R5 草案 m6-engine-wave + ADR-003（draft）；规则 16 未跑不得实施；R6 仍 open"
---

# Development Progress

## Current Session

- **工位 B：** R5 草案 [m6-engine-wave](../plans/m6-engine-wave.md) + [ADR-003](../decisions/003-engine-adapter-boundary.md)（均 `draft`）。未改 `src/`。规则 16 未跑，不得实施。
- **集成 HEAD：** `0476e10d` — **agent-ide** 集成线。
- **已闭里程碑：** 壳层 PRD-001–016 / M5 / D1–D7；R5 研究产出已落档（方案仍 draft）。

## Blockers

- **valid-layers-check：** Node v26.7.0 环境红；`.nvmrc` 钉 24.18.0，疑为版本不匹配 → [D8](deferred-gaps.md)
- **EH 矩阵：** panel / terminal / decoration 次级探针仍待实测 → [D9](deferred-gaps.md)
- **PRD-008：** `blocked`；接线方案 [m6-engine-wave](../plans/m6-engine-wave.md) 仍 `draft`，待规则 16 → [R5](research-queue.md) closed
- **PRD-009：** `blocked`；Diff owner 未选 → [R6](research-queue.md)

## Next（后续开发任务排期，2026-09-02）

按依赖顺序；**阶段 0 与阶段 1 可并行**（不同冲突域）。

| 序 | 任务 | 类型 | 产出 / Exit | 工位建议 |
|:---|:-----|:-----|:------------|:---------|
| 0a | **D8** `nvm use`（24.18.0）后重跑 `npm run valid-layers-check`；仍红则定位 TS lib 差异 | infra | 门禁绿或落 root cause | merge |
| 0b | **D11** 收编未跟踪 `d4-evidence/82582fe8`、`rerun-2221`（补 README 或删）；修 `plans/INDEX.md` 指向不存在的 `dev/roadmap/` | docs | `git status` 干净；`check-docs-health` 0 warning | 主仓 |
| 0c | **D9** EH 矩阵 panel / terminal / `editor/decoration` 探针（复用 `launch-with-probes.sh`） | docs/验证 | 矩阵三行改「已实测」 | A |
| 1 | **R5 签收** [m6-engine-wave](../plans/m6-engine-wave.md) + [ADR-003](../decisions/003-engine-adapter-boundary.md) 规则 16 只读审查 | review | 两文 `accepted`；否则改稿保持 draft | 独立 reviewer |
| 2 | **R6** PRD-009 Diff owner 裁决（编辑器区 vs 底部 Panel vs Sources Changes 内嵌） | research → ADR-004 | ADR `accepted` | C |
| 3 | ~~R7~~ PRD-010 产品身份 — **已裁决**：名 **UniverseAgentStudio**，图标复用 Desktop/Singularity 资产，**引擎波后再改**（[D12](deferred-gaps.md)） | 已决 | M6 闭后开 plan | — |
| 4 | **M6 引擎波实施**（R5 签收后）：adapter 同 token 替换 stub → page-access 切片 5 → customizations E1 → trajectory T4 → Engine pane 能力探测 | 实施 | 各方案 blocked 行转 `implemented`；D4 式隔离 profile 验收 | A–D 并行 |
| 5 | **D10** PRD-012 T5 搜索 / 虚拟化 / Overview | 实施（低优先） | 记录数或用户需求触发 | 任一 |

**不做**（requirements.md 明确排除）：整仓迁移 Desktop 文档、Agents Window 当默认壳、Cursor/Codex trade dress、完整扩展分发。
