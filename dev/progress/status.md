---
title: "Development Progress"
type: progress
status: active
phase: M5
updated: 2026-09-02
summary: "HEAD 0476e10d：壳层 PRD-001–016 全落、D1–D7 全闭、工位池全 idle；后续排期 = 引擎波（R5/R6/R7 研究）+ 工具链尾巴（D8–D11）"
---

# Development Progress

## Current Session

- **集成 HEAD：** `0476e10d` — **agent-ide** 集成线；工位池与 merge 槽已对齐 `adc12ccf`/`c9716e28`。
- **已闭里程碑：** S3c @ `18b5e8d7`；S4 @ `28f1af5a`；S5 @ `3e287e65`；S6 @ `569ce371`；T5a @ `c7b2c17a` / `f66c36c9`；M5 **implemented** @ `9f67fb5a`；**D2** 工位池 compile 基线闭 @ `a047fe35`（记录 `aa71c27f`）。
- **无 in-flight 切片。** 壳层方案全部 `implemented`；下一波须先过研究/决策再开实施。

## Blockers

- **valid-layers-check：** Node v26.7.0 环境红；`.nvmrc` 钉 24.18.0，疑为版本不匹配 → [D8](deferred-gaps.md)
- **EH 矩阵：** panel / terminal / decoration 次级探针仍待实测 → [D9](deferred-gaps.md)
- **PRD-008 / PRD-009：** `blocked`；无已接受的引擎接线方案、Diff owner 未选 → [R5 / R6](research-queue.md)

## Next（后续开发任务排期，2026-09-02）

按依赖顺序；**阶段 0 与阶段 1 可并行**（不同冲突域）。

| 序 | 任务 | 类型 | 产出 / Exit | 工位建议 |
|:---|:-----|:-----|:------------|:---------|
| 0a | **D8** `nvm use`（24.18.0）后重跑 `npm run valid-layers-check`；仍红则定位 TS lib 差异 | infra | 门禁绿或落 root cause | merge |
| 0b | **D11** 收编未跟踪 `d4-evidence/82582fe8`、`rerun-2221`（补 README 或删）；修 `plans/INDEX.md` 指向不存在的 `dev/roadmap/` | docs | `git status` 干净；`check-docs-health` 0 warning | 主仓 |
| 0c | **D9** EH 矩阵 panel / terminal / `editor/decoration` 探针（复用 `launch-with-probes.sh`） | docs/验证 | 矩阵三行改「已实测」 | A |
| 1 | **R5** PRD-008 引擎接线发现：UA gRPC 面 vs 现有 `IConversationStubService` 契约；adapter 落层（`platform`/`workbench/services`）；能力探测三态 | research → plan + ADR-003 草案 | plan `accepted`（规则 16 独立审查） | B |
| 2 | **R6** PRD-009 Diff owner 裁决（编辑器区 vs 底部 Panel vs Sources Changes 内嵌） | research → ADR-004 | ADR `accepted` | C |
| 3 | ~~R7~~ PRD-010 产品身份 — **已裁决**：名 **UniverseAgentStudio**，图标复用 Desktop/Singularity 资产，**引擎波后再改**（[D12](deferred-gaps.md)） | 已决 | M6 闭后开 plan | — |
| 4 | **M6 引擎波实施**（R5 签收后）：adapter 同 token 替换 stub → page-access 切片 5 → customizations E1 → trajectory T4 → Engine pane 能力探测 | 实施 | 各方案 blocked 行转 `implemented`；D4 式隔离 profile 验收 | A–D 并行 |
| 5 | **D10** PRD-012 T5 搜索 / 虚拟化 / Overview | 实施（低优先） | 记录数或用户需求触发 | 任一 |

**不做**（requirements.md 明确排除）：整仓迁移 Desktop 文档、Agents Window 当默认壳、Cursor/Codex trade dress、完整扩展分发。
