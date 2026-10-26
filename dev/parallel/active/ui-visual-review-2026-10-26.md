---
title: "2026-10-26 UI 与权限审查集成看板"
type: progress
status: active
phase: M7
updated: 2026-10-26
summary: "2026-10-26：D1376 Catalog、D1377 Terminal、D1378 Output 三槽源提交齐，待 merge 当前新编译/运行；前轮结果仅保留历史，默认编辑器是本阶段产品验收范围。"
---

# 2026-10-26 UI 与权限审查集成

本看板按 [文档规则 15](../../../docs/DOCUMENTATION.md#规则-15并行看板) 记录本轮工位、提交与实际验证，不继承旧波次状态。当前主线基线为 `974e2fb5bc5`；只在仓外 `vscode-WorkTrees/merge` 集成与写入 `out/`，不推进主线、不 push。

## 分工与提交

| 工位 / 角色 | 范围 | 源提交与集成状态 |
|:---|:---|:---|
| J / 权限状态审计 | D1368 异步权限评估跨取消与 session 销毁边界 | `3f16bbaeeec`，已在 merge |
| D / Mobile sheet | D1369 模态键盘边界与关闭生命周期 | `2588e2b8db6`，三路合成 `f6727234fdd` |
| C / Sessions 响应式 | D1370 Host toolbar、header 与 chips；补正 D1367 context 早于 CSS 的竞态 | `5337c8e`，三路合成 `df7c5b1` |
| merge / 唯一集成验证 | 保留两边进度和历史归档，修编译诊断与真实测试夹具，统一写出产物和验证 | 核心验证提交 `2fec8eaf636`；其后设置页切片见下节 |
| Astra / 独立视觉复核 | 用真实运行画面复核现有设置页与 responsive UI | 发现 Direct Address 中窄 Host 竖条、Client Settings 窄 Preview 裁切；已交 D 修复 |
| D / 设置页视觉修复 | D1371 / D1372 局部响应式修复 | `292ec409fc1`，三路合成 `a514ec3d2a5`；最小刷新和行为复验已过，独立视觉 after 已通过 |
| J / Sources 编译基线 | D1375 正式服务注入、SCM null 结果与测试生命周期 | 基线 `0ea26634bed`；方案 `220db77` 已过 D 槽只读审查，实施 `7dd0c6d` 三路合成 `a4c5e30`；当前 Sources 0 诊断，官方 Electron 六套件 171 passing，D1375 closed |

| C / Terminal 投递合同 | D1377 sendPath / runCommand void 边界、三执行策略与沙箱安装 boolean | 方案 `1bfceca` 过 Astra 只读审查；源码与 27 条行为回归已补，尚未运行；merge 验证前保持 open |

两次源码合入均只有 `status.md` / `deferred-gaps.md` 文档冲突，按三路内容保留 D1368、D1369、D1370 的独立意图。D1369 迁出的 2026-10-11–12 历史仍在 [原归档](../../archive/status-2026-10-11-12-retained-2026-10-26.md)，没有删除。

### D1375 Sources 合同基线

[方案](../../plans/sources-compile-contracts.md) 收敛旧日志 Sources 的 9 条，而非全仓 176 条：三个装饰参数 optional/union 使 `GetLeadingNonServiceArgs` / singleton 合同失败 6 条；SCM 组空编辑器 `null` 未归一 2 条；list-mode 测试漏接 `store` 1 条。已按当前源码逐点修复；D1368–D1372 的已修日志不重做。J 只做静态分析与目标 ESLint（11 文件，0 errors / 31 既有 warnings），没有编译、转译、watch 或写 `out/`。新增 6 条运行回归已在 merge 当前新产物通过：`sourcesTabs` 1、`sourcesReviewProgress` 1、`sourcesChangesList` 4；同时运行夹具对齐的 `sourcesPartFocus`、`sourcesReviewList`、`sourcesFilesListMode`。当前 compile-client 已实证 Sources 0 诊断，原映射 9 条均消失；仅 D1375 合同范围闭合，全仓仍 160 条 / 58 文件。

## 首轮编译与修正

2026-10-26 `09:32:05+08:00`，确认没有现存 compile/watch 且 `out/` 可写后，在 `/tmp/vscode-compile.lock` 下执行首轮唯一一次 `npm run compile-client`。该命令真实进入源码检查并生成新 JS，22 秒后因 TS 检查退出 1，计 176 条诊断、69 个文件；不是旧 EROFS / 权限环境断言。原始 [编译日志](../../progress/ui-visual-review-2026-10-26-evidence/compile-client.log) 保留。

其中改动文件有 7 条诊断，均在本次集成内修正：取消 turn id 在回调前捕获；权限信号的 URI 归一为协议字符串；避免空数组断言把 Ready 数组收窄为 `never[]`；去掉两个只赋值未读取的局部变量；无关 context key 显式采用 boolean。四个文件的 TypeScript 6.0.3 API [定向语义检查](../../progress/ui-visual-review-2026-10-26-evidence/target-types.log) 为 0；补正的三份焦点测试 [定向语义检查](../../progress/ui-visual-review-2026-10-26-evidence/focus-test-types.log) 也为 0。没有第二次全仓编译，不以定向通过冒充全仓通过，也不推算未重跑的剩余诊断数。

只对变更过的文件在同一把锁内使用仓库开发编译相同的 esbuild 选项刷新：ES2024、ESM、inline sourcemap、experimentalDecorators、useDefineForClassFields=false。未并行运行 transpile/typecheck 全仓任务。

## 行为与文档验证

| 验证 | 实际结果 | 证据 |
|:---|:---|:---|
| Node `agentSideEffects.test.ts` | 202 passing；含 cancelled-auto-approve、cancelled-confirmation、removed-session、hook-continuation 四个受控评估屏障场景 | [完整日志](../../progress/ui-visual-review-2026-10-26-evidence/agent-side-effects.log) |
| Browser `mobileSortGroupSheet.test.ts` | 13 passing；Tab/Shift+Tab、五种关闭入口、重开与过期动画、不可用 opener、外部焦点保持 | [最终日志](../../progress/ui-visual-review-2026-10-26-evidence/browser-final.log) |
| Browser `agentHostShortcutsWidget.test.ts` | widget 2 + SessionsView responsive 3 passing；context 先于 CSS、两种初态、三次往返、旧监听释放、筛选保留、窗口门控与 flex 子项清理 | 同上 |
| Browser `sessionHeader.test.ts` | 7 passing；键盘入口与可编辑能力 hydration | 同上 |
| Browser 就近 Engine / Connection Preferences 测试 | Engine 3 + Connection 4 passing；dispose 晚到结果、窄导航打开与宽转窄焦点 | 同上 |
| 合计 browser | 32 passing / 0 failing，使用已安装的 `chromium-chrome` | 内置 Playwright headless shell 缺失，未下载；Chrome 使用独立测试 context |
| Targeted ESLint 10 文件 `--no-cache` | exit 0，0 errors / 31 warnings；warning 为就近旧测试目录的 import/DOM 规则 | [日志](../../progress/ui-visual-review-2026-10-26-evidence/eslint.log) |
| docs-health / generated-status | 0 errors / 46 既有链接 warnings；generated status OK | [健康日志](../../progress/ui-visual-review-2026-10-26-evidence/docs-health.log)、[生成列](../../progress/ui-visual-review-2026-10-26-evidence/generated-status.log) |
| docs-status unittest | 7 测，6 过 / 1 败；requirements 已有 29 PRD，夹具仍期望 28；在基线 `974e2fb5bc5` 同时存在 | [日志](../../progress/ui-visual-review-2026-10-26-evidence/docs-status-tests.log)；本轮未改需求或该夹具 |

第一次 browser 扩跑为 28 passing / 4 failing（[原始日志](../../progress/ui-visual-review-2026-10-26-evidence/browser.log)）：标题的合成键事件未带 `StandardKeyboardEvent` 读取的 keyCode，Engine 焦点夹具未登记 pane 清理，Connection 焦点夹具漏 Hub 服务。集成修正测试夹具后重跑上述完整五份套件，32 项全过，断言未删减。

命令入口：Node 用 `node test/unit/node/index.js --run src/vs/platform/agentHost/test/node/agentSideEffects.test.ts`；browser 用 `node test/unit/browser/index.js --browser chromium-chrome` 并为上述五份测试逐项传 `--run`。本轮不使用源码文本镜像测试替代 DOM 与事件行为。

## 输出与规格边界

新输出根为 `/home/clarence/Projects/Agents/vscode-WorkTrees/merge/out`；[fresh-output.json](../../progress/ui-visual-review-2026-10-26-evidence/fresh-output.json) 记录 10 个生产/测试文件的源码与 JS 摘要、产物时间，以及均晚于本轮编译开始的检查结果。视觉复核已收到该路径；D1371/1372 的六文件最小刷新见下节。

没有修改 `MOBILE.md` / `SESSIONS_LIST.md`：两份就近规格的 change gate 明确把 responsive、control、styling bugfix 留给代码与行为测试；本轮没有改变模型、所有权、导航或跨表面契约。没有新方案文档；设置页视觉修复复用现有 Client / Settings 方案契约。

## D1371 / D1372 设置页后续集成

D 的 `292ec409fc1` 基于 `df7c5b1`，在 merge 的 `2fec8eaf636` 上真三路合成为 `a514ec3d2a5`。只冲突进度文档：保留核心已经完成的真实验证与 closed 状态，同时加入两条新缺陷的待验状态；历史归档保留。设置接入规格的窄宽契约更新已随源提交进入 [Settings SSOT](../../../docs/reference/code-oss-b2/settings-ua-access.md)，不新建方案。

2026-10-26 `09:46:17+08:00`，持同一 `/tmp/vscode-compile.lock` 只刷新四份 TS 与两份 CSS；[刷新日志](../../progress/ui-visual-review-2026-10-26-evidence/settings-refresh.log) 与 [六文件 hash / 时间快照](../../progress/ui-visual-review-2026-10-26-evidence/settings-fresh-output.json) 保留。`settingsUaTocCssScan.test.ts` 已被真实 browser 样式回归替换，同时只删除它退休的 `out/.../settingsUaTocCssScan.test.js`，避免旧输出继续冒充当前测试。没有再跑全仓 compile / transpile / typecheck。

| 验证 | 实际结果 | 证据 |
|:---|:---|:---|
| Direct Address 实际 CSS+DOM | 1 passing；同一 pane 详情正文 560 / 480 / 479 / 320 / 560px 往返，Host / Port / Name 对齐、input 保值保焦点、checkbox 行独立 | [最终 browser 日志](../../progress/ui-visual-review-2026-10-26-evidence/settings-browser-final.log) |
| UA Client scope / chrome | 4 passing；300px 加载上游与 UA 真实 CSS，UA→普通→UA 时控件范围与上游宽度恢复；纯 UA / 混合 ID、TOC 分类、普通查询与 Agents 门控 | 同上 |
| Connection 就近焦点 / dispose | 4 passing；在新的 Connection 生产 JS 下复验 | 同上 |
| 本阶段 browser 合计 | 9 passing / 0 failing；其中 4 项与核心阶段重叠，因此本轮共覆盖 37 个不同 browser 用例 | 同上 |
| 4 文件 scoped semantic check | 初次 1 个新增 Event 契约诊断；SplitView 需要 `Event<number \| undefined>`，尺寸约束事件是 `Event<void>`，现用 `Event.map(..., () => undefined)` 适配；其余 3 文件初次为 0，修后该文件为 0 | [初次](../../progress/ui-visual-review-2026-10-26-evidence/settings-types.log)、[修后](../../progress/ui-visual-review-2026-10-26-evidence/settings-types-final.log)；TypeScript 6.0.3 API，未声称 tsgo 全仓通过 |
| Targeted ESLint / stylelint | 4 TS 0 errors / 3 既有 warnings；事件适配文件复查 0 errors；2 CSS stylelint exit 0，27 条 token 建议 | [ESLint](../../progress/ui-visual-review-2026-10-26-evidence/settings-eslint.log)、[事件适配](../../progress/ui-visual-review-2026-10-26-evidence/settings-eslint-final.log)、[CSS](../../progress/ui-visual-review-2026-10-26-evidence/settings-stylelint.log) |
| 文档 | docs-health 0 errors / 46 既有 warnings；generated-status --check 与 diff-check 通过 | [健康日志](../../progress/ui-visual-review-2026-10-26-evidence/settings-docs-health.log) |

本阶段 browser 命令为 `node test/unit/browser/index.js --browser chromium-chrome`，三份 `--run` 分别指向 `conversation/test/browser/connectionPreferencesPane.test.ts`、`preferences/test/browser/settingsEditor2.test.ts` 与 `conversation/browser/connectionPreferencesPane.test.ts`，再以 `--grep 'Direct Address input rows|UA Client responsive scope|ConnectionPreferencesPane \(browser\)'` 聚焦。实际编辑器中的尺寸约束变更、UA↔普通切换与 TOC / 重开由 Astra 独立视觉复核；独立视觉结论已通过，见 [入库视觉报告](../../progress/ui-visual-review-2026-10-26-evidence/visual-review.md)；截图与完整测量按要求留在主线 `.build/visual-review-astra/`，不入 git。

独立 after 已确认：Direct Address 305px 单列、479.19→480.00px 无坏带；UA exact / ordinary / mixed / return / TOC / 300px 叶重开往返通过。D1371 / D1372 已闭合。首轮结束时第三项 `Input needed` 文字低对比仅登记 D1373 open；其后 follow-up 已获授权实施并闭合，见下节；覆盖限制与本地截图 / JSON 路径见 [视觉报告](../../progress/ui-visual-review-2026-10-26-evidence/visual-review.md)。

## Follow-up D1373–D1375

本节承接上一轮完成线；D1373 后续已获授权实施，不再停留于初始的只登记状态。C / D / J 共同基线为 `0ea26634bed`，禁止各槽编译、转译、watch 或写 out；merge 仍是唯一产物与验证工位。

| 工位 | 范围 | 当前状态 |
|:---|:---|:---|
| D | D1373 `Input needed` 真实对比修复 | `9213459c87f` 已 fast-forward 进入 merge；真实生产 CSS + Permission/Question Seat browser 4 主题通过；独立四主题×三宽度实拍已通过，D1373 closed |
| C | D1374 SessionsService 异步打开被显式 focus / active-close / all-close / restore 覆盖后的取消边界 | `9b6d532fee4` 已三路合成 `88acc5c`；旧 `0ea` 生产输出 red 为 3 passing / 11 failing，刷新生产并修正空网格占位夹具后 green 14 passing |
| J | D1375 Sources 正式 DI、null/undefined、测试 store 三类根因 | 短方案经独立只读审查无 Critical / Important；方案 `220db777939`、实施 `7dd0c6d` 已三路合成 `a4c5e30`，当前编译与六套件通过；只处理九条命名诊断与相应文件 |
| merge | 唯一真实集成与验证 | 不重复上一轮已绿套件；新源码全齐后本 follow-up 只串行跑了一次 compile-client，当前 160 条 / 58 文件与首轮日志分别保存 |

D1373 只在 `/tmp/vscode-compile.lock` 内刷新新测试 JS 与 `conversationLens.css`，没有启动全仓编译；[刷新日志](../../progress/ui-visual-review-2026-10-26-evidence/d1373-refresh.log) 和 [两文件新输出清单](../../progress/ui-visual-review-2026-10-26-evidence/d1373-fresh-output.json) 保留。`node test/unit/browser/index.js --browser chromium-chrome --run src/vs/workbench/contrib/conversation/test/browser/conversationPendingBadgeStyle.test.ts` 为 4 passing，覆盖 Light / Dark Modern 与 HC light / dark、300→720→300、真实文字对比至少 4.5:1、紧凑/不裁切、HC 边界与方向键决策路径；见 [行为日志](../../progress/ui-visual-review-2026-10-26-evidence/d1373-browser.log)。

该测试 TypeScript 6.0.3 API 定向语义为 0（[日志](../../progress/ui-visual-review-2026-10-26-evidence/d1373-types.log)）；ESLint 0 errors（[日志](../../progress/ui-visual-review-2026-10-26-evidence/d1373-eslint.log)）；生产 CSS 的仓库 stylelint exit 0，15 条既有 unknown-variable 提示 / 179 条 token 建议（[日志](../../progress/ui-visual-review-2026-10-26-evidence/d1373-stylelint.log)）。独立四主题×三宽度实拍已通过，实测对比 7.75 / 9.06 / 16.48 / 11.55，100.69×20px；D1373 closed，见 [视觉报告](../../progress/ui-visual-review-2026-10-26-evidence/visual-review.md)。

### D1374 受控导航边界 red / green

先只刷新新 `sessionsManagementService.test.js`，逐字比对去除 inline source map 的旧生产 JS 正文与 `git show 0ea26634bed:src/.../sessionsService.ts` 的相同 esbuild 转译结果一致，保留其 SHA256 / 时间（[基线身份与 test-only 刷新日志](../../progress/ui-visual-review-2026-10-26-evidence/d1374-test-refresh.log)）。精确 suite `navigation while an open is resolving` 对旧生产运行，结果 3 passing / 11 failing，失败均为晚到 open / restore 覆盖新导航（[red 日志](../../progress/ui-visual-review-2026-10-26-evidence/d1374-red.log)）。

随后锁内仅刷新 `sessionsService.js`（[日志](../../progress/ui-visual-review-2026-10-26-evidence/d1374-production-refresh.log)），首次 13 passing / 1 failing；剩余失败是新 empty-grid 测试错误期望 `[]`。既有 `VisibleSessions` 的初始网格是 `[undefined]` 新会话 composer 占位，取消已正确阻止 pending 复活；集成仅把新测试期望改为保留占位，不改生产网格契约。最终同 suite 14 passing / 0 failing（[green 日志](../../progress/ui-visual-review-2026-10-26-evidence/d1374-green-final.log)）；覆盖 openSession / openChat 的 focus、active-close、all-close、inactive-close，同 active 显式 focus、空网格 all-close、正常加载 focus echo 与 restore 三类显式导航。没有重复运行上一轮已绿 suite。

两份 TS 定向语义 0（[日志](../../progress/ui-visual-review-2026-10-26-evidence/d1374-types.log)）、目标 ESLint 0 errors（[日志](../../progress/ui-visual-review-2026-10-26-evidence/d1374-eslint.log)）；[新产物快照](../../progress/ui-visual-review-2026-10-26-evidence/d1374-fresh-output.json) 保存根目录、源码/JS摘要与时间。D1374 行为证据已闭合；其后 Sources 源码到齐的当前统一构建证据见下节。

### D1375 当前编译与官方 Electron 回归

本 follow-up 的源提交 `9213459c87f`（D1373）、`9b6d532fee4`（D1374）、方案 `220db777939` + 实施 `7dd0c6d`（D1375）均到齐后，merge `a4c5e30896f` 确认没有 live compile/watch，持 `/tmp/vscode-compile.lock` 只执行一次 `npm run compile-client`。当前结果 **exit 1，160 条 TS 诊断 / 58 个文件**；不是全仓通过。Sources 目录与本 follow-up 所有改动 TS 均为 **0 诊断**；旧日志映射的 Sources 9 条全部消失，但不把首轮总计 176→本次 160 的完整差值都归因于 D1375（其中还包括之前已修的七条）。[当前原始日志](../../progress/ui-visual-review-2026-10-26-evidence/followup-compile-client.log)、[计数与58文件余量](../../progress/ui-visual-review-2026-10-26-evidence/followup-compile-summary.json) 独立保存。

六份 Sources browser 目录套件：`sourcesTabs`、`sourcesPartFocus`、`sourcesReviewProgress`、`sourcesReviewList`、`sourcesFilesListMode`、`sourcesChangesList`。Chrome 实跑 162 passing / 8 failing，8 项均为既有 warn-then-rethrow 测试读取 `process` 监听（纯 browser 不提供），新增六项均通过；保留 [browser 原始日志](../../progress/ui-visual-review-2026-10-26-evidence/d1375-browser.log)。随后使用官方 `scripts/test.sh`、隔离 `xvfb-run -a`、测试进程参数 `--no-sandbox --disable-gpu` 跑同六套件，**171 passing / 0 failing**，包含 `assertCleanState`；八项在 Electron 下全部通过。[Electron 完整日志](../../progress/ui-visual-review-2026-10-26-evidence/d1375-electron.log) 保留。没有修改产品 sandbox 设置，也没有改这些既有测试或增加 browser process shim。

新六项覆盖 TabsHost 注入会话事件的 tab 往返 / dispose 后停止响应、ReviewProgress 双会话工作根隔离与 SCM null/newTab/replace 的四条打开结果。11 TS 文件 targeted ESLint **0 errors / 31 既有 warnings**（[日志](../../progress/ui-visual-review-2026-10-26-evidence/d1375-eslint.log)）；D1374 占位夹具修后 ESLint **0 errors**（[日志](../../progress/ui-visual-review-2026-10-26-evidence/d1374-eslint-final.log)）。[当前15文件产物快照](../../progress/ui-visual-review-2026-10-26-evidence/followup-fresh-output.json) 记录全部 follow-up TS / CSS 的 source/output hash、mtime，均晚于本次编译开始；没有用旧 out 跑这些 Sources 验证。未重复上一轮已绿套件，也没有继续改其余 58 文件。

D1375 短方案按范围转 `implemented`，生成索引随源重建；D1373 / D1374 / D1375 均 closed。按文档规则 3c 检索知识层的 D 编号 / 方案名与 Sources 会话上下文合同，未发现需继续翻转的待实施叙述：D1373 的 Conversation 规格、D1374 的 Sessions 概览已随源提交同步；D1375 恢复正式 DI / 空值合同，不改变已接受的 Sources 系统所有权与呈现契约，既有 Sources 总方案和 PRD 状态不翻转。首轮 docs-status 29/28 旧夹具失败保留原证据，本 follow-up 未重复或扩范围修它。

## D1378 Extension Host 输出通道合同

本切片基线 `e2442d8b3ec`，J 方案 `2f04745` 已经 Astra 独立只读审查（Critical / Important 无），实施只覆盖 ExtHostOutput 与相邻 Search 配置夹具。普通输出目录用原生 Promise 吸收正式文件系统 Thenable；普通与 extension log 的 mkdir 原拒绝及 FileExists 例外保留。初始化错误集中报告一次，派生排队链不再扩散未处理拒绝，操作自身错误仍报告；日志句柄缓存释放不再依赖初始化成功。

3 个改动 TS 文件目标 ESLint `--no-cache` 0 errors / 0 warnings，diff-check 通过。新增输出回归 8 条，原 11 条保留；Search 原 4 条不改断言。仅 `.then` 夹具的链式返回也只有 `.then`，旧实现会先抛 `.catch` 缺失 TypeError；失败回归要求原始 mkdir 错误、恢复、一次报告、dispose 后同名重试与晚到资源释放，并用运行器观察 detached 未处理拒绝。错误 handler 在 finally 恢复。

J 没有编译、转译、watch、typecheck 或写 `out/`。merge 需以旧生产加新测试证明 red，再用新生产证明 green，并在统一新编译核对旧日志的 6 条输出诊断与 1 条 Search 夹具诊断；这些数目不是新编译结果。目标套件为 `src/vs/workbench/api/test/common/extHostOutput.test.ts`（19 条）与 `src/vs/workbench/api/test/node/extHostSearchNumThreads.test.ts`（4 条）；官方测试运行器会将未处理拒绝记为失败。尚未运行前 D1378 open、方案 accepted，不提升其他 D 项或 PRD。
## D1376 Engine Catalog 合同基线

D 工位以 `e2442d8b3ec` 开工，范围为当前 Engine Catalog 旧表单、连接 snapshot 事件与 readonly 能力构造、列表能力 namespace、工作根、对话框及回调断言类型；[短方案](../../plans/engine-catalog-test-contracts.md) 已获 J 独立只读审查（Critical 0 / Important 0）；方案 `b8ef18a4041` / 签收修稿 `1c4f891bc32`。D 不编译/转译/watch/写 out；最终编译与行为结果由 merge 统一记录，当前不宣称清零。

D1376 源码已按当前合同迁移，MCP 旧 14 项保留并扩展至预期 20 项，包含真实共享 BrowserDialogHandler DOM 生命周期与确认跨断连/选择变化；完整[场景映射/静态结果](../../progress/ui-visual-review-2026-10-26-evidence/d1376-catalog-contracts.md)。D 工位只执行 ESLint 与文档检查，统一编译和实际行为结果尚未产生，D1376 保持 open。status 超出的 2026-10-16 十二批历史已整体移入[归档](../../archive/status-wave-2026-10-16-retained-2026-10-26.md)，没有删除。
## D1377 终端投递合同待验收

C 仅静态修复 [短方案](../../plans/terminal-delivery-contracts.md) 的四类根因：void 包装消费 boolean；三执行策略等待投递；事件 / public void 入口使用通知出口；沙箱安装抽象声明 boolean 并清理拒绝等待。RunInTerminal 的 1822 / 1886 共用 options：`createTerminal` 返回真实 `ITerminalInstance`，平台 `ISandboxDependencyInstallTerminal.sendText(text, shouldExecute): Promise<boolean>` 对齐后，两条安装 / 修复调用无需加 cast 或修改调用文件。group 测试传正式下标；四个旧 sendText 替身返回 true。

新增 27 条受控行为：TerminalInstance 3（路径 void accepted / dropped、命令 dropped、Ctrl+C dropped）；安装 / 修复各 5 个屏障结果（accepted / dropped / throw / cancelled / disposed）共 10；三执行策略各 dropped / throw 共 6；Basic 清行 2、None 清行 1；Inline Chat accepted / refused 2；MainThread public void 通知 1；RunInTerminal 安装 / 修复拒绝后原命令不执行 2。Astra 只读复核核心实现未发现 Critical / Important；指出 send pending 时取消会释放监听，但方法仍等 send 解决，本文与方案按这个真实边界表述。

C 不编译、不转译、不启动 watch、不写 out、不运行旧产物冒充验证。目标 [ESLint 日志](../../progress/ui-visual-review-2026-10-26-evidence/terminal-delivery-eslint.log) 与 diff-check / docs-health 是静态检查；行为尚未验证，不推算全仓诊断下降。merge 需当前唯一新编译与新产物定向套件：`terminalInstance`、`terminalGroup`、`outputMonitor`、`terminalSandboxService`、`basicExecuteStrategy`、`noneExecuteStrategy`、`richExecuteStrategy`、`terminalExecutionDelivery`、`terminalChatWidget`、`mainThreadTerminalShellIntegration`、`runInTerminalTool`。
