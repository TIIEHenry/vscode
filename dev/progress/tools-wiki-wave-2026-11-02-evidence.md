---
title: "Tools/Wiki 双域集成与真实窗口分层证据"
type: report
status: accepted
phase: M7
created: 2026-11-02
updated: 2026-11-02
summary: "双域代码与Node24组合门通过；真实Tools交互子集通过，Save返回错误且来源关联未定，真实保存门保持open。"
---

# Tools/Wiki 双域集成与真实窗口分层证据
状态：当前有效。负责：agent:codex。范围：本波集成、唯一检查通道与真实默认窗口证据；不把自动层或可见子集升级为完整产品验收。

返回[本波看板](../parallel/active/tools-wiki-wave-2026-11-02.md)。方案：[Tools](../plans/tools-display-lifecycle.md) · [Wiki](../plans/wiki-git-context-isolation.md)。

## 1. 固定集成与代码门

| 项 | 实际输入与结果 |
| --- | --- |
| A 主题 | `1ec07a675d5b881ec5fdafcbd9f30598a72dcd31`，8路径同主题；compile-client0、三文件eslint0、官方Tools/Catalog/Agents三套206/0；Astra最终OV C0/I0/M0 PASS |
| B 主题 | 原D9d真三路基线db36339后，主题`cb784d9770602e6cbd29ff88dc98db27f3e87500`，8路径含生成INDEX；完整18方法真实Git矩阵0、原hooks无wrapper0；综合OV C0/I0/M1 PASS，报告selected-root Minor已改 |
| 共享记录与合并 | 共享5docs `7603314d3d2`；A真实merge `e8171f328ea`，B真实merge `6b3515f2135a383535f25484cd3667cbba97e561`；仅status/gaps冲突hunk语义合成，保留门分别10/16路径无失败，未整文件选边 |
| 生产/测试保持 | 最终3TS/2PY SHA256与已验候选逐项同；D1393旧19TS保持；D1393 closed、D1394本地代码/自动层closed、D1395/D1396 open |
| Node24固定环境组合全编译 | 明确PATH `/home/clarence/.nvm/versions/node/v24.18.0/bin`，实际Node v24.18.0/npm11.16.0；`npm exec -- npm-run-all2 -ls compile-client compile-copilot`，原compile两子任务强制串行，runner整体0证明两目标各0（session86201） |
| 额外环境记录 | 前次同命令Node26.7.0组合0保留为额外证据，不能替代Node24门；收到pin纠正时仅关闭尚未验收的自有38651窗口并随后重建，没有重启外部进程或JVM |
| 产物与共享包 | Node24复编前后Tools/Catalog相关3JS逐字同，沿用已验206/18不重复；208共享Copilot文件前后hash全同，实际可写包为私有副本 |
| 组合文档门 | health0errors；wiki working/staged均0；generated0；diff0；status64行；新Wiki原merge hooks正常0。此门对应合并树，后续证据文档变动仍需提交前再核 |

仓外日志根为 `/home/clarence/Projects/Agents/vscode-WorkTrees/.coordination-20261102/`。关键原件：`newwave-a-browser-3.log`（206/0）、`newwave-b-full-matrix-3.log`（18/0）、`newwave-node24-full-compile.log/.exit`、`newwave-node24-compile-receipt.json`、`newwave-combined-five-source-hashes.json`、`newwave-d1393-preservation.json`、两次merge-preservation JSON。前序失败与一次误启动编译143均保留在看板，不计成功。

## 2. 真实默认窗口与引擎

窗口从集成merge自身out启动，使用[测试配置](../../docs/guides/test-profile.md)的三目录、`--new-window`，不加`--agents`，显式Node24 PATH。自有新CDP38651，旧37567未接管。测试配置恢复5个默认编辑器workbench targets，实际均来自merge/out的`vs/code/electron-browser/workbench/workbench-dev.html`；脚本仅操作最后一个目标，不能把恢复多窗事实省略。

引擎为自有pinned JVM PID2104821，实际监听50061；启动前无监听，未二起。预包VERSION与PIN来源一致、clean，`lib.SHA256SUMS`核对0；实际版本与PID/日志/目录在`newwave-real-engine-receipt.json`。stdout/stderr fd均绑定本波`newwave-real-engine.log`，单行本身仍无PID/客户端call id。未用主工位WIP源码构建或临时换PIN。

| 真实动作 | 证据与结论 |
| --- | --- |
| 默认窗口连接与目录 | status为Engine · Loopback；Tools真实174项、21个虚拟行、24px。`newwave-real-tools-initial.json/.png` |
| 两profile准备 | 唯一自有ids `tools-lifecycle-20261102-6b3515-a/b`；公开SaveAgentProfile按PIN正式schema、非空prompt模板创建并成功返回，UI重载后可见。既有6用户profile未覆盖，只记录其内容hash |
| 鼠标/键盘/切profile | ownA鼠标改task_update=false；键盘切B看到true，再回A仍false；Space两次即时切值并保checkbox DOM焦点。`newwave-real-ui-mouse-keyboard.json`、`newwave-real-ui-pending.png`。这组没有后台Save |
| 大列表/滚动 | 按真实wheel逐步滚到indices52..72，仍21行/24px；中段checkbox Space两次恢复原值，焦点与offset -1250px保持。`newwave-real-ui-scroll3.json/.png`。没有后台Save |
| 实际UI Save | 一次owned Playwright `await save.click()`，UI显示13 INTERNAL/ALREADY_EXISTS并保稿；不计保存成功。独立公开List读回ownA为disabled_tools=[task_update]、ownB仍[]。两个Save执行的目标/来源关联未定，不能仅凭最终值宣称单失败请求部分写、同目标并发或数据损坏 |
| 保全与未验 | 既有6profile全字段hash复核未变；own2合法现场暂保供独立裁定，未再次Save、未重试、未chmod/STOP/断网注入。真实成功保存/页面重入回读、迟到List/失败重试组合门未完成，D1395 open |

首次临时样本漏system_prompt正文，PIN AgentPresetLoader:570-571会拒绝空正文，故返回“Saved profile but failed to reload”；这是测试准备不足，不当作有效Tools Save失败。仅核本波唯一marker及两文件后，将无效样本移至仓外`invalid-empty-profile-fixture`保原件并移出engine home。有效模板与清理规则已同步测试配置/钉死引擎指南。合法own2不在裁定前清理。

## 3. Save来源的有限只读核对

原件在仓外`newwave-real-save-failure-evidence/`：文件hash/stat/副本、成功公开创建响应（仅自有profile）、UI错误JSON/截图、独立List、相关server错误链55行、实际动作转录与各artifact时间。

- 公开有效创建回调最晚10:16:02.953804Z完成；UI鼠标/键盘观测10:18:55.021461Z；唯一owned Save点击约10:19:22Z，脚本15秒只读等待后在10:19:37Z记录失败。没有第二owned click或protocol Save；不能据此证明只有一个wire请求。
- `Debugger.getScriptSource`实际加载`engineToolsSection.js` SHA256为`caf527e408a52bbfab353fe9debaf02ac942c40518bdc2104a65c4a2428cbacb`，与已验磁盘产物逐字同，含writeOperations、busy guard及saveToolEnablement；实际模块仅一处saveAgentProfile调用。
- `DOMDebugger.getEventListeners`只读检查Save及27层节点，并含document/window；Save本体1click、1gesturetap、1keydown，局部祖先无附加写监听，顶层为通用工作台/键盘/Playwright事件，完整函数位置保留。未改setter/getter或触发Save。
- 未保当时逐wire call id、客户端channel归属、CDP输入trace/视频，不能排除其他客户端/物理输入或未知来源。线程号不等于目标profile证明。已完成有限probe，不无限追未知来源或重复触发写入。

来源未定的真实Save失败保持产品验收缺口；独立代码/组合绿不冒充该门通过。随后父与Astra owning-source审计另确认[D1397/P1](deferred-gaps.md)：Profile Save/Delete/Reset缺main发前归属链。它与上述真实来源未定P2不同，不能拿最终字段变化直接认定现场损坏；现已撤回push批准、恢复产品发布hard hold。已验代码/Node24组合成果保留；随后19入口正式补充合同已获规则16签收并独立提交c7ec04b6，唯一作者实施后的最终运行签收仍待。自有合法两profile现场暂保，只读，不再Save/Delete/Reset或追加注入；本页不授权push。

## Catalog owner 自动层补充（仍待最终签收）

当前19入口合同见[正式方案](../plans/engine-catalog-mutation-ownership.md)，源码与过程发现见[本波看板](../parallel/active/tools-wiki-wave-2026-11-02.md)。c2源/测试设计独立OV C0/I0/M0 READY；Node24 compile-client exit0，官方Node/common完整747/0、browser九文件445/0，均正式exit0。24TS聚焦eslint真实exit1、0errors/12条逐字c7基线warning，新增0/未定0；父/Astra批准已知基线例外，未改runner或称lint全绿。

私有对照采用新编译测试、固定公开runner上下文与完整私有out副本，无hardlink连接真实out。新runtime同目标19/0；仅叠旧6模块后19fail中18为actual.writesOnB对expected空数组的业务错侧断言，1个Add MCP因旧DTO增加own undefined workDir在currentA前置断言停下。最初15+4分类已按raw报告更正为18+1，保误报过程，不计为19wrongB。原out11973文件逐字保持；raw与逐case实际/期待值在仓外`catalog-owner-private-old-c2-1/`。

c3仅按父/Astra批准在Add intent加合法captured workDir，24TS清单仅node test一行变、production全部同c2；等待唯一通道复编、Node与完整19私有新绿旧红，然后Copilot/docs/独立最终OV。私有mock证明13可写族与6结构族的IDE归属门，不声称六项已对PIN真实写入。D1397未关闭、未提交源码/未push；D1395真实Save来源未定P2不因自动层通过而关闭。

### 独立 New／空正文只读发现（未作真实复现）

唯一作者与父另核IDE New未带systemPrompt、Markdown允许空body；PIN027ab loader先写AGENTS/tools再reload，空正文返回null而无多文件回滚。已有有效user profile清空保存可落入List跳过、公开同id Save/Delete不能修复的条件链；New也可留下不可加载项。四个PIN源码hash/行链保存在仓外`agent-profile-blank-prompt-readonly-finding.json`。这是只读源码发现，未操作实际New/空保存，正式gap与发布门等待Astra裁决，不扩c3 owner实施。正常PIN Model/Tools派生链保非空prompt，应排除；它与own2有效profile的D1395真实Save来源未定不是同根，不据此宣称现场损坏或清理现场。

## Candidate3 精确19闭环与完整本地编译

- 固定24TS manifest `catalog-owner-candidate-3.sha256` SHA256 `4f44585455610c2127da21ae26fe4ed35800ceea7d17537acb829e5e75d78aab`，production与c2全同，仅Add intent夹具一行获批变更。Node24 compile-client0、完整Node/common747/0；browser388JS/相关源码同，复用c2九套445/0。
- 私有`catalog-owner-private-old-c3-1` NEW精确19/0、exit0；仅overlay旧6后OLD 0/19、exit1。`old-red-business-classification.json`逐项actual/expected证明19个wrongB（13P1族+6结构mock），无前置/加载/缺export失败。`real-out-preservation-after-replay.json`证明原out11973文件及私有测试不变。新旧实际绝对JS路径、runner补丁/模块hash与原始report同目录保留。
- client与Copilot在同Node24唯一通道先后执行，后者session61405 exit0，共同完成原compile两个目标；非声称另跑了compile wrapper。208共享Copilot文件前后同，可写两包真实私有副本。c3变更node test另focused lint exit1/0errors/1既有warning，与c7七行context同；其余23未变沿用11条，总12baseline/0新增，不称lint全绿。
- docs门和最终独立运行/范围OV仍待，D1397未闭。本地保护性owner主题提交获准进入签收流程，整体push还受新增[D1398/P1](deferred-gaps.md)约束：上一段New/空正文只读链现经Astra初裁、父采纳，正式内容合同/方案待。仅New准备为P2，现有有效profile空正文保存为P1，不和D1395真实来源未定混同；现场未追加任何写/清理。

working文档门正式exit0：health716页/0errors/46warnings、wiki working0errors/337warnings、generated check0、docs-status8/8、diff check0；remind0errors/95warnings，无[user]。本主题稳定知识同步到engine-catalog与getting-started，其他历史归档提醒仅review记录、不自行归档。当前staged/原hooks及独立最终运行OV待，不提前claim总交付；D1398已获Astra正式P1裁决，后续内容校验方向获采但本主题未实施。

## Owner专题最终签收边界

Astra已实读24TS/运行原件、文档、精确32path暂存与原precommit预验，最终CommitGate PASS C0/I0/M0，父采纳。D1397仅本地owner代码/自动层closed，方案implemented；固定c3源不变，最终状态/生成plans INDEX和working/staged/原hooks门刷新后可创建保护性本地主题commit，不在此宣称已经提交或推送。此前working health716页/0errors/46warnings、wiki337warnings；staged与原precommit预验均0errors/338warnings，比working仅多1条baseline-stale（旧finding已不出现，未改baseline），不是零告警。D1398全局push hold、D1395真实Save来源未定P2与own2只读现场保持，PRD不升；后续Profile内容合同不纳本19实现。
