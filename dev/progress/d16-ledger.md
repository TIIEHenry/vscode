---
title: "D16 三文件失败账本"
type: progress
status: active
phase: N/A
created: 2026-09-07
updated: 2026-09-07
summary: "test-baseline 切片 0：SHA 42eba1e6ff4 三文件实测 0 failing，账本 0 数据行；D16 仍开"
---

# D16 三文件失败账本

> [test-baseline-ci](../plans/test-baseline-ci.md) **切片 0 盘点**。行数 = 当前 HEAD 实测失败数。「15」是 `0649602d` 历史观测，不是行数合同。  
> **本文件不宣布 D16 closed。** 三文件 0 failing 是切片 0 合法结果；闭合仍须满足方案 §3（compile 门禁 / S2 leftover / 进口界下限等）。未开切片 1。

## 采集头

| 项 | 值 |
|:---|:---|
| 工位 | A · `loop/A` · `/home/clarence/Projects/Agents/vscode-WorkTrees/A` |
| SHA | `42eba1e6ff4`（`git rev-parse HEAD` = `42eba1e6ff4b186366a0b02fe85353bd2f546ff7`） |
| 命令 | `VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run <file>`（另加 `--tfs` 仅用于抽 JUnit `<testcase>` / skipped；未改断言） |
| 实测失败数 | **0** |
| 数据行 | **0**（三文件均 0 failing，无 mocha fullTitle 可入账） |

### 分文件 mocha / JUnit

每趟 Electron runner 会多注册 1 条 `assertCleanState`（计入下表 `<testcase>`，不是 conversation 套件失败）。

| 文件 | mocha pass | mocha fail | mocha skip/pending | JUnit `<testcase>` | JUnit `<skipped/>` | exit |
|:-----|----------:|-----------:|-------------------:|-------------------:|-------------------:|:-----|
| `src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts` | 97 | 0 | 0 | 97 | 0 | 0 |
| `src/vs/workbench/contrib/conversation/test/browser/conversationIdentityStrip.test.ts` | 14 | 0 | 0 | 14 | 0 | 0 |
| `src/vs/workbench/contrib/conversation/test/browser/conversationStubService.test.ts` | 29 | 0 | 0 | 29 | 0 | 0 |

**结论：** 当前 tip 上这三文件没有可分类的 A/B/C 失败。切片 0 **不得**据此把 [D16](deferred-gaps.md) 标 `closed`，也不得开始切片 1 的「已归零」声明。

## 失败行

表头固定（方案 §2.3）。**无数据行。**

| # | 文件 | mocha fullTitle（`suite` + 空格 + `test`） | 旧断言（源码表达式或期望值） | HEAD 实测 | 档 (A/B/C) | 改档理由（仅改档时填） | 新期望（一句话） | 改的路径 | 关闭 SHA |
|---|------|------------------------------------------|------------------------------|-----------|------------|------------------------|------------------|----------|----------|
