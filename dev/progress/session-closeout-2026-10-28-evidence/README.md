---
title: "2026-10-28 收尾核对证据"
type: reference
status: accepted
phase: M7
updated: 2026-10-28
summary: "58972组合树当前fresh与官方521/0、Node97/2、49目标语义0/lint0error44warning；含完整三路/原日志身份与工位保全，未fullCompile/真实窗口验收。"
---

# 收尾证据

> 当前结论见文末“最终组合树验证”；下面保留收尾开始时的来源与待验判断，后续实际运行以该节替代。

用户要求收尾，停止新增功能；主工位当前 UI 与订阅恢复整文件保留，唯一 merge 负责集成和运行。源快照基于 `d91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42`，包含收尾开始时的未提交路径与字节身份，不作为最终运行证明。

- [开始时主工位清单](initial-main-inventory.json)：只记录当时路径，不锁住后来作者合法完成的补充。初始暂存证据随后由原作者补齐 Esc 三份，最终 Included 以提交为准。
- [订阅静态独立审计](subscription-static-audit.md)：八 TS 与旧产物不能完整对应，原始红绿日志未找到；当前需 fresh 后运行。Automation 仅属 Sessions 保留兼容，默认编辑器共用范围为 AHP / UniverseAgent；D405 / V-S5 真实引擎手测仍未完成。

已知 StubModel TS18048 为本 UI WIP 引入，收尾补显式 session 守卫；跨叶 Composer 全局归属风险交 Astra 判定并由子代理最小修复。修复与当前定向验证、合并后状态及未合入工位结论由最终收尾记录补充，未执行项不写成通过。

- [Astra 设计及源码复核](composer-design-and-peer.md)：修后 C0/I0/M2，当前尚未运行。双 Host 组件回归不冒充双 Lens 默认窗口。
- [完整归属修复差异](composer-ownership-only.diff.gz)与[前后来源](composer-ownership-identities.json)：包含 dispose 清引用；限定差异不代完整主题 diff。
- Esc 原始小日志：[red](popup-red.log.gz)、[green](popup-green.log.gz)、[lint](popup-lint.log)、[types](popup-types.log)，与[原截图摘要](popup-artifact-hashes.json)保留。三份原作者正式 Esc 报告/探针/结果在 UI 证据目录；不重跑历史矩阵。

原始日志/patch 的上下文空白保留于 gzip，解压逐字节等上一提交原件；[压缩身份](raw-artifact-compression.json)记录原件与归档 SHA。原 ae8297add7f 提交前 cached whitespace check 实际失败，随后误继续提交，未将其计作通过；本补修独立提交，不 amend、不改业务源码。

## 最终组合树验证（2026-10-28）

当前交付为组合源码 `58972a2f679b125f97fd488e823961491dee4bc3`：订阅恢复、默认 Conversation 控件/菜单/键盘与行内编辑、Stub 工具状态及 Dark Modern 中性按钮。订阅方案 implemented、D1389 仅代码与自动层 closed；真实窗口与引擎、D405 / V-S5 未签收，大视觉方案仍 draft，PRD 未提升。

| 本次实际步骤 | 范围与结果 |
| --- | --- |
| fresh | 官方 `build/next/transpile.ts` 的 `transpileFile`，**49 TS + 1 CSS，exit 0**；18既有生产依赖候选有3份与主改动重叠，不能将估算52当实际数量 |
| Electron 官方入口 | 13文件，**32 suites / 521 tests / 521 pass / 0 fail / 0 pending，exit 0**；包含当前订阅三测试文件与新增真实双 Host 回归 |
| Node 官方入口 | 5文件，**97 pass / 2 fail，exit 1**。UA reopen16、EngineBind25、ActorLoop6、ChatClose11，共**58 pass**；CSS38 pass / 2 fail，加 harness1 pass |
| 定向 noEmit | 沿未修改的 `src/tsconfig.json` 创建10317根文件上下文，TS6.0.3，只收49目标及options/global诊断，**0诊断，exit 0**；未收全项目语义诊断 |
| ESLint | 49 TS，**0 error / 44 warning，exit 0**；订阅八TS **0 error / 0 warning**。没有使用 `--max-warnings=0`，未逐条做基线差分，不将44条笼统称为既有，也不称零告警 |

新增双 Host 实际 passing 标题为 `ConversationTimelineHost applyEntries (plan §3.4) turn-edit composers stay with their own timeline across rerenders and another leaf exit`，验证同 turnId 两实例各有 composer、重绘及 A 退出/销毁不抢 B。它属于真实 Host 组件回归，不等于双 Lens 默认窗口视觉手测。

- [最终选择与边界](final-validation-selection.json)、[结果摘要](final-results.json)、[50份源码/产物SHA](final-fresh-source-output-identities.json)记录固定组合源；运行后再次复算50份source/output均相等。主题JSON由官方主题测试直接读源，SHA另在结果中记录。
- 实际命令/exit：[fresh](final-fresh.receipt.json)、[Electron](final-electron.receipt.json)、[Node](final-node.receipt.json)、[noEmit](final-target-noemit.receipt.json)、[lint](final-lint.receipt.json)。每步依次持有 `/tmp/vscode-compile.lock` 和 `/tmp/vscode-loop-compile.lock`，无并行编译。Electron真实会话70564、Node60939、noEmit55854、lint88134均观察到终态；不因首次返回运行中而重启。
- 原始 stdout/stderr 均无损 gzip；[原件与归档hash清单](final-raw-artifact-manifest.json)可定位，含 [Electron日志](final-electron.stdout.log.gz)、[Node日志](final-node.stdout.log.gz)、[lint日志](final-lint.stdout.log.gz)与两个CSS历史原始日志。原始执行小脚本也按字节保留，不新增仓库构建工作流。Node官方入口使用其spec报告，传入 `--reporter=json` 未改变该报告格式；没有为生成JSON重跑。
- CSS 两败分别是 `Maximize and session switch close History/Snapshots; More stays session actions` 的 `binding.includes("host.engineHistoryList?.close()")`，以及 `connection and provider chrome stay on small radii` 的 `assert.ok(provider)`。已与10/27 before/after原始日志的精确标题、断言核对相同；[比较记录](final-css-baseline-comparison.json)含当前测试、binding、enginePreferences CSS身份。当前测试与ad4a不完全同字节，两个失败被扫描目标与ad4a相同；**本轮未复跑旧HEAD对照**，不将历史39/2包装成当前全绿。

### 集成与保全

真三路 `24e4837daac8c8706889597a314a590ad8701c91` 的两亲为 `ad4a7bced198929239c4ed4b737f72f900a1dc80` 和 `ed5727da0f2a44d9b6ef1c5a4d7b1bbd2461efb1`；随后真三路 `58972a2f679b125f97fd488e823961491dee4bc3` 接外部UI作者 `1246e0ca3548fb1d4364cba84dc9493228efae9b`。外部作者的13 SessionBar结果是历史来源，本次结果独立保存。

- [首轮保留矩阵](final-merge-preservation.json)、[冲突处理](final-conflict-resolution.json)、[UI增量保留](final-incremental-ui-preservation.json)记录无争议Git对象精确保留及源码原生三路结果。手动只合并文档新增行、归档进度；完整冲突原件也在hash清单。第一次解析脚本因IndentationError在执行前失败，未写仓库；修正后才执行文档冲突处理，没有作为源码错误或门禁通过。
- 三份完整旧状态原文与SHA位于[merge归档](../../archive/status-before-closeout-merge-2026-10-28.md)、[main归档](../../archive/status-before-closeout-main-2026-10-28.md)、[UI增量归档](../../archive/status-before-closeout-ui-2026-10-28.md)。当前 status 保持≤200行，无正则截尾吞历史。
- [独立工位原始快照](preserved-worktrees.snapshot.md.gz)与[JSON](preserved-worktrees.snapshot.json)完整保留。快照中main三WIP是提交1246前的历史；[后续实测](final-main-followup.json)记录其已由原作者正式提交、主工位当时clean，未改写原始快照。B仍13文档修改+531证据；H仍4附件；I保留`.build`/`out`两symlink；C/F/D/J clean正式提交及分支未强行合入。其他字母槽不随此次主工位ff重置或同步。

本轮**未fullCompile、未新引擎run、未真实默认窗口视觉验收、未开启L5或Sources新run、未push**。lease原40项39过1败、238hooks、official1 / Mgreen=false保持；恢复已接收，L5方案draft/未审保持。旧popup图只证明其来源时点Esc，不证明后改Chrome的全部视觉。D405/V-S5及默认窗口验收仍open。唯一merge不直接写主工位；父调度者最后独立校验再ff，工作树整体保全不等于所有槽已同步。


### 文档门禁

`generate-docs-status.py` 与 `--check` 均 exit0；`check-docs-health.py` 检查647份Markdown，**0 error / 46 warning，exit0**。`python3 -m unittest scripts/tests/test_docs_status.py` 实际 **6过1败，exit1**，固定断言28与当前PRD解析29不符；[原始stderr](final-docs-status-tests.stderr.log.gz)与[源比较](final-docs-status-test-source-comparison.json)保留。测试和parser字节等ad4a，本轮未修该既有计数断言。D1389状态翻转后已读知识层相关合同，无需变更其恢复语义；仅索引、行动层验证状态同步，未改PRD。最终stage后须独立 `git diff --cached --check` 成功才提交，不以文档unit失败冒充全绿。
