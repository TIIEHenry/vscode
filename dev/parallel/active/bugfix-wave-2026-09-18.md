---
title: "2026-09-18 十六路审查后四份修补方案并行看板"
type: progress
status: active
phase: M7
updated: 2026-09-19
summary: "四份方案 2026-09-19 已签收 accepted，待按冲突域实施。同 tick 最多 3 槽。不升 PRD-008。"
---

# 2026-09-18 十六路审查后四份修补方案并行看板

> 规则 15。本轮 **不**走多方评审（未点名）。一篇一文、文件互斥。方案写完走 [规则 16](../../../docs/DOCUMENTATION.md)。

## 冲突域矩阵

| 冲突域 | 方案 | 实施时禁与谁同 tick |
|:-------|:-----|:-------------------|
| `platform/universeAgent/node/grpc` + host bind + recover + join | [live-stream-bytes-decode](../../plans/live-stream-bytes-decode.md) | 不得与改同一 `grpcSessionAttachWire.ts` / `sessionViewHost.ts` 的刀并行 |
| `universeAgentConnectionService` + handshake + channel client | [connection-dial-generation](../../plans/connection-dial-generation.md) | 不得与改 connection service / channel client 的刀并行 |
| `contrib/conversation` 透镜/浮层/Kill（域 A）；`contrib/navigator`（域 B，可后并行） | [conversation-bound-session](../../plans/conversation-bound-session.md) | 域 A 不得与改同一 lens/composer 的刀并行；**禁止**本波实施 pills S3w |
| `contrib/sources` + SIDE_GROUP 复用条件 | [sources-review-open-identity](../../plans/sources-review-open-identity.md) | 不得与改 `sourcesChangeEntryOpen` / review model 的刀并行 |

**禁止：** 四份方案实施时抢 `sessionCore/**`（GFS-4）；抢 pills S3w 窗口服务；发明 proto；建议重开 GitHub Actions。

## 方案状态（手写过程；枚举以各 plan frontmatter 为准）

| 产物 | 写者 | 规则 16 | frontmatter |
|:-----|:-----|:--------|:------------|
| `dev/plans/live-stream-bytes-decode.md` | 父 | R9 Approve 无 C/I；2026-09-19 用户签收 | `accepted` |
| `dev/plans/connection-dial-generation.md` | 父 | R16 Approve 无 C/I；2026-09-19 用户签收 | `accepted` |
| `dev/plans/conversation-bound-session.md` | 父 | R6 Approve 无 C/I；2026-09-19 用户签收 | `accepted` |
| `dev/plans/sources-review-open-identity.md` | 父 | R14 Approve 无 C/I；2026-09-19 用户签收 | `accepted` |

## 实施顺序（已签收；切片未开）

1. **解锁 PRD-008 手测观感（不升档）：** live-stream S1/S2/S4 先于「接通了但没权限座 / 绑错会话」。
2. **可与 1 并行：** connection S1–S3（文件不交）。
3. **绑定叶 S1/S2** 可与 1–2 并行（contrib vs platform）。
4. Sources S1–S4 与 1–3 文件不交，可并行。
5. conversation S3/S4、navigator S5、connection S4/S5 按冲突域穿插。

实施跟踪见 [deferred-gaps](../../progress/deferred-gaps.md) **D944**（禁止本看板手抄 D 枚举）。不关 D8/D16/D22/D24/D31/D147/D405。不升 PRD-008。
