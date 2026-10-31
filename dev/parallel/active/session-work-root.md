---
title: "会话工作根 S1–S4 并行实施"
type: progress
status: active
phase: N/A
updated: 2026-10-31
summary: "PRD-029 S1 由父会话落地。S2 路径、S3 换引擎提示、S4 分层存储分路改，写路径互斥。S1–S4 已全面落地合入（见方案 frontmatter：4615d3aa990 与 b6bccf8ff2c）；S3 换引擎提示不再待做。S5 不做。"
---

# 会话工作根 S1–S4

方案：[session-work-root-and-workbench-scope](../../plans/session-work-root-and-workbench-scope.md)。S5（Preview Code 类别换入换出）不在这一波。

父会话独占：`src/vs/workbench/services/agentSession/**`、`contrib/conversation/browser/agentSessionContext.ts` 及其测试、本看板、方案、PRD、`dev/plans/INDEX.md`、`dev/progress/status.md`。子路不改这些文件。

五份规范化已经改调 `agentWorkRoot.ts`。子路不要改回：`normalizeReviewPath`、`normalizeNavigatorWorkDirKey`、`sourcesFilesWorkDirIsWorkspaceRoot`、`resolveSourcesGitResourceRoot`。

| 路 | 可写路径 |
|:--|:--|
| S2a 归因 / 进度 / 查看更改 / Changes 打开 | `sourcesReviewAttribution.ts`、`sourcesReviewAttributionService.ts`、`sourcesReviewProgress.ts`、`sourcesReviewProgressService.ts`、`conversationReviewNavService.ts`、`conversationReviewEntry.ts`、`sourcesChangeEntryOpen.ts`、`sourcesChangesReadModel.ts`，以及对应测试 |
| S2b 身份条 / 引擎设置 / Navigator | `conversationIdentityStrip.ts`、`engineMcpSection.ts`、`engineAgentsSection.ts`、`engineToolsSection.ts`、`conversationLensComposer.ts`、`navigatorProjectsTree.ts`、`navigatorProjectsList.ts`，以及对应测试。`engineToolsSection.ts` 上已有无关未提交改动，只改带工作目录的调用 |
| S3 换引擎提示 | `connectionPreferencesPane.ts`、`contrib/conversation/test/browser/connectionPreferencesPane.test.ts`。不改文档。**已落地合入**（2026-10-31 更新：方案 frontmatter 记 S1–S4 已合入 `4615d3aa990` 与 `b6bccf8ff2c`，git 可证；换引擎提示与 Test Connection 探测拆闸均已进 agent-ide 主干） |
| S4 存储 | `conversationLensProjection.ts`、`sourcesFilesExplorer.ts`、`sourcesTabsHost.ts`，以及 `conversationLensProjection.test.ts`、`sourcesFilesListMode.test.ts`、Sources 标签测试 |
