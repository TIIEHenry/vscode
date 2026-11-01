---
title: "功能缺口审查 2026-11-01：可直接修复项并行实施"
type: progress
status: in_progress
phase: M7
updated: 2026-11-01
summary: "五路并行修复已回收：F1 Projects 删除确认、F6 会话状态徽标文案、F8/F9 Overview 与 FireTrigger、F12/F13/F19 Preview 空态与类别命令、写闸 S4 补丁；L6 已补 Projects 不可用动作的原因提示与 New session 禁用态。typecheck-client 0 错误；Navigator 定向测试 36 通过 / 1 条既有失败。已按主题提交 5 个修复提交，L6 尚未提交。"
---

# 功能缺口审查 2026-11-01：可直接修复项并行实施
状态：执行中。负责：agent:kiro。

来源：[功能缺口审查 2026-11-01](../../plans/review-2026-11-01-feature-gaps.md)。工作区：主工位 `agent-ide`，基线 HEAD `e0640256333`。

## 冲突域

工作区另有他人未提交改动（Conversation 时间线 / Composer / 阅读列、Sources Changes / Files、编辑器标签栏、Navigator CSS，以及同期在改的 conversation 测试）。本波各路只改下表自己的文件，不暂存、不提交、不 restore 他人改动。

| 路 | 条目 | 改动文件 |
|:---|:-----|:---------|
| L1 | F1 Projects 删除确认 | `navigator/browser/navigatorProjectsList.ts`、`navigator/test/browser/navigatorProjectsList.test.ts`；`conversationDeleteSessionConfirm.ts` 注释 |
| L2 | F6 会话状态徽标文案 | `conversationSessionView.ts`、`conversationLensProjection.ts`、`conversationStubService.ts`、`conversationLens.test.ts`、`conversationLensDisposeGate.test.ts`、`streamScripts.ts` |
| L3 | F8 Overview 模型行、F9 FireTrigger 色调 | `engineOverviewSection.ts`、`engineTriggersSection.ts`、`engineOverviewSection.test.ts`、`engineTriggersSection.test.ts` |
| L4 | F12 / F13 Preview 空态、F19 类别命令 | `editorGroupWatermark.ts`、`editorCommands.ts`、`editorGroupWatermark.test.ts`、`previewEditorGroupHeader.test.ts` |
| L5 | 写闸 S4 补丁 | `connectionPreferencesPane.ts`、`enginePreferencesPane.ts`、`connectionPreferencesPane.test.ts`、`test/browser/enginePreferencesPane.test.ts` |

不在本波：写闸 S3（与槽 G 已合入的「换链不画结果」语义需先对齐）；F2、F3、F5、F14、DD1（待用户决定）；F4（等 PRD-027 P3）；F7、F10、F15–F18（需另行设计）。

## 父 agent 改动

- L2 原把引擎缓存会话的 "Cached snapshot (read-only)" 也移出徽标，可见信息变少。改为产品文案保留在徽标（"Session disconnected: cached snapshot (read-only)"），`conversationEngineCacheSyncReason()` 由 `conversationSessionView.ts` 导出，stub 改用它；引擎 roster（他人 WIP）仍用同 key 同文案。
- L3 测试里一处 `includes` 在 `strictEqual` 收窄后类型为 never，typecheck 报错，删去（上一行已固定全文）。

## 验证

- `npm run typecheck-client`：exit 0，0 个 TS 错误。
- 目标文件 `npx eslint --no-cache`：0 error。
- `npm run transpile-client` 后 `scripts/test.sh`：
  - Navigator Projects、Preview 水印与类别头、Overview、Triggers、Connection 与 Engine 偏好页：366 passing / 1 failing。
  - Conversation Lens、dispose gate、stub service、stream scripts、Lens projection：379 passing / 6 failing。
  - Triggers 修正后单跑：55 passing / 0 failing。
- 7 条失败（`connected dock hides gate…`、5 条 `shouldShowReadingColumnLiveChrome…` / `reading column live chrome…`、Navigator `hover new-session is only on the current engine workDir`）在把本轮 L1、L2 文件临时换回 HEAD 后同样失败（347 passing / 7 failing），不是本轮引入；与他人在途的阅读列 / Dock / Navigator WIP 有关，未在 `dev/progress/test-baseline-failures.txt` 名单内。
- 没有开窗口做真实验收。
- L6：`npm run typecheck-client` 0 错误，目标文件 ESLint 0 error；转译后 Navigator Projects 定向测试 36 通过 / 1 失败。失败仍是既有 `hover new-session is only on the current engine workDir`，本轮新增的不可用行动测试通过。

## 进度

| 路 | 状态 | 结果 | 提交 |
|:---|:-----|:-----|:-----|
| L1 | 已提交 | 删除先确认；PRD-022.6 已按用户裁定改写 | `7d0e264e49e` |
| L2 | 已提交 | 徽标文案修复；断连快照条在他人 WIP 文件，未接 | `19eb5b3f345` |
| L3 | 已提交 | Overview 文案与 FireTrigger 色调修复 | `3e625f480ec` |
| L4 | 已提交 | 空态说明、Planning 操作、命令面板 | `bc74159a9ea` |
| L5 | 已提交 | S4 已在 HEAD；补旧结果不清新 Testing… | `3506f333bfe` |
| L6 | 工作区修改 | Projects 不可用动作复用门禁原因；当前 workDir 的 New session 保留为禁用态 | 待提交 |

发现稿与本看板：`7261de87e58`。

## 未完

- PRD-022.6 已按用户裁定改写（保留 Projects 的 Delete 与 New session）。L6 已补齐：不可用时复用断线、配对挂起、会话未就绪原因；New session 不可用时保留为禁用态（navigator-engine-segments V-N7）。
- PRD-002.6 删除入口与 navigator-tabs-access.md 已随 PRD-022.6 改写同步；PRD-027 依赖段 Planning 一句仍未改。
- 断连快照条（`conversationLensReadingColumn.ts`，他人在途改动）未接新的同步原因文案。
- 写闸 S3 与槽 G「换链不画结果」语义冲突，需先对齐。
