---
title: "D1387 非作者默认编辑器 J 部分 after（2026-10-27）"
type: reference
status: accepted
phase: M7
updated: 2026-10-27
summary: "真实双 Git / Preview、Conversation、Panel 与错误恢复已执行；14 UI过、隔离过、2项仅车道连续性、M01实际按钮no-op Important1；零引擎，句柄已清，D1387保持open，E未启动。"
---

# D1387 非作者默认编辑器 J 部分 after

**C0 / I1，部分验收，不关闭 D1387。** 非作者 `/root/sources_audit` 在 D 工位执行真实默认编辑器 J，发现 Conversation 内真实 **Open Diff in Preview** 按钮无效。其余实际入口、准确组、Panel 和受控失败恢复观察列在下表；E 阶段从未授权或启动。本报告不是最终修复后的 after，也不把初次 driver 选中错误计成产品失败或通过。

[18项准确矩阵](d1387-j-partial-after-matrix.json)、[144条观测核对](d1387-j-partial-after-assertions.json)、[250份原件及SHA清单](d1387-j-partial-after-artifact-inventory.json)、[原始证据包](d1387-j-partial-after-evidence.tar.gz)。144条是对真实状态、内容和已复现缺陷的核对，不表示产品144项全绿。包内保留全部 **101个成功状态采样**、driver失败原件、29张关键原截图、真实命令args、完整加载JS/CSS字节与独立车道不可变原件；未选截图仍保留在 D 忽略目录。

## 范围、冻结和真实夹具

- 实际消费 sourceHead `ce6d977a4316c1f903869089638a2cd7262dc7db`，src tree `92801b513611ed3ae1ba36862a58131c609f6aa2`；native producer `8b4ddaa99a8cc88ed645407ee42075a8497c4f34`。编译 exit0 / 0 TS 是唯一车道的第四次真实完整 compile，D 没有编译、转译、typecheck 或重跑业务测试。
- 真实 J notice SHA256 `44372cedc1f7ad94fc335cf0fa89c99961b39aa6fbcaed7a087a2179b410c114`；E notice `54bddec4715d26d37dc13feaea58dc1b633d1aec8845142e99e584e68d7829ee`。各52项 source/native 和 sourceTree/固定d91祖先 guard 在启动前、J动作后清理前均通过。后续原件/纯文档推进没有冒称新native。**这份旧 freeze 当时真实成立，历史不改写为从未 frozen。**
- 只启动 merge 的默认编辑器 `workbench-dev.html`，真实 `isSessionsWindow:false`。Electron `1643431`，CDP `37999`，main inspector `35563`，自有 Xvfb `1643371` / `:0`；自有 profile `/tmp/code-oss-dev-20261027-015532-1643378-8aigq6`。没有用 Agents/Sessions 窗口验收产品。
- 两个真实 Git 仓在 `/tmp/vscode-d1387-sources-audit-after-uvyx1ei3/{alpha,beta}`。Alpha HEAD `818ebdd52cc4c15969a4764243d2c6d004d992a2`，Beta `8a3f5c597490a43265e0661041aec81fb73a91c1`。各有未暂存 `shared.txt` 和 `other.txt`，Alpha/Beta、shared/other 的完整原文/修改文均有独立 sentinel。采集真实 Monaco 原/改 URI、完整模型文本、只读选项、可见矩形、tab pin、规范组成员、根聊天输入和 Sources Reviewed。
- Conversation 使用断连时产品自带的 `untitled`、`visualize` 两个真实叶子及 EditorParts；它们的聊天内容明确为内置 Stub，不是引擎会话信用。Git数据及比较模型来自真实本地仓库。检查服务由一次立即注销的公开 CommandsRegistry 命令捕获；没有注入假页面、替换 Sources 私有状态或修改 source/out。

## 已发生的18项结果

| 项目 | 实际结果与证据边界 |
| --- | --- |
| P01 | Review Alpha真实鼠标，在Beta实际Preview后replace；Alpha完整两侧正确，旧Beta被替换。 |
| P02 | Review Beta真实Enter，newTab保留Alpha，双方pin正确。 |
| P03 | 右键Alpha other时原选中仍Beta；真实 **Replace Current Tab** 精确打开被捕获Alpha other；后续公开 Open Selected按实际Beta选中打开Beta。 |
| P04 | Changes Alpha真实鼠标replace实际Beta，Alpha完整两侧正确；Reviewed不因Changes改变。 |
| P05 | Changes Alpha真实Enter/newTab保留Beta；两实际pin与完整模型正确，Reviewed不变。 |
| C01 | Conversation replace首次新边组成功：untitled根7、比较8，Alpha shared两侧只读，根保留，无多余split。 |
| C02 | 纠正driver后，真实Review Enter/newTab在 **只有visualize根9** 时创建唯一比较11，Beta shared完整两侧只读。此前清空既有10再打开的正例另保留，不代替这次真正新边组。 |
| C03 | 实际选中Beta shared后的公开无slot Open Selected正确揭示同输入，不新增空组。 |
| C04 | Beta shared→Beta other replace限制在同比较10，根9与Alpha根7/比较8保留。 |
| C05 | Beta shared追加到other旁；newTab/replace两种设置下同row重复揭示不重复tab/组，不产生Unable to open。 |
| C06 | 实际公共group.focus从Alpha起，真实roster.switchSession进入Beta后再开Beta row；仅Beta比较10接收，Alpha规范成员/根不变。 |
| B01 | Panel Review Alpha mouse与other Enter均为真实正确只读两侧，public panel ref正确；Beta Conversation输入不变。 |
| M01 | **PARTIAL_FAIL / I1**。Panel→Preview、Preview→Conversation、Preview→Panel、Panel→Conversation实际内容与关闭来源符合既有策略；Conversation→Preview真实按钮两次no-op，见下节。全局空active命令的早期no-op不计成功。 |
| E01（J内错误用例） | 仅自有Alpha other的公开官方diff DTO临时拒绝，恰1次；实际未打开/未Reviewed，行内错误可见。注销故障handler后真实重开内容成功、Reviewed=true、自己的旧open错误清除。 |
| E02（J内代次用例） | 公开controlled Promise的旧Beta请求分别晚reject/晚void，后续Alpha真实正常打开状态不被覆盖。晚void仍依SCM委托void合同将Beta Reviewed=true，**没有Beta other pane**；不把状态代次等同取消标记。 |
| E03 | **仅车道连续性，不是D窗口stale正例**。不可变实际J386日志含helper stale/false不mark及stale review不覆盖新失败；29 source/native逐字连续性成立。未伪造Sources私有状态。 |
| F01 | **仅车道连续性，不是D重跑**。原真实公共finder/EditorService object/id、missing/wrong/removed/same-id forged、excluded非Conversation及ordinary file/untitled/chat/writable diff fences均有实际通过断言；来源见后文。 |
| X01 | 自有fixture HEAD/index/工作树diff/文件全文与hash语义前后精确相同，index无暂存diff。J全程零引擎；自有进程/profile/home清理已实证，fixture保留。 |

合计 **14 PASS_RUNTIME、1 PASS_ISOLATION、2 PASS_LANE_CONTINUITY、1 PARTIAL_FAIL**。没有把18项都计作D真实UI通过。

Preview公开命令观察器最初正则遗漏 `_workbench.diff`，故不从早期空events推断零次或一次。补上公开command事件监听后，通过真实mouse、Enter、context alternate、Open Selected、Changes mouse/Enter重复正常入口；每次真实官方 `_workbench.diff` 增量均恰1，右键仅弹menu时增量0，原件为 `J/dispatch-counts.json` 和对应 `P01–P05-dispatch-counted-*`。

初次 `C02-conversation-beta-first-newTab` 的选中没有变化，实际仍Alpha，随后最初no-slot也确实打开Alpha。原因是切会话后Sources显示Files，driver曾对隐藏Review list调用focus。修订driver先真实点击Review tab，并在Enter前核 `aria-activedescendant` 等于目标row ID；原错误快照/截图和 `C03-conversation-beta-openSelected` 保留，既不当作产品red也不算Beta成功。Changes的早期虚拟列表定位失败亦保留 `.failure.json`，经真实滚动后再执行。

## Important 1：Conversation 的真实 Open Diff in Preview 按钮 no-op

**触发与期望：** Preview为空，visualize的真实Conversation比较页已打开Beta shared，两侧readonly=true；点击该页内产品按钮 **Open Diff in Preview**。应打开同一完整比较到Preview，并按原move关闭来源策略处理被捕获输入。

**实际：** 按钮获得真实DOM焦点；事件记录 `sources.diff.moveToPreview`、args `[]`。Preview仍无tab，Beta比较仍在11，页面无错误；全局 `IEditorService.activeEditor=null`、`IEditorGroupsService.activeGroup.id=0`。先由真实Panel→Preview→Conversation得到Alpha other时也同样发生。未把全局命令调用没有上下文的no-op独自当作产品证据；这里有两次实际产品按钮点击。

原件（均在证据包 `J/` 下）：

- `steps/37-normal-beta-conversation-reveal.json` → `steps/M01-normal-beta-conversation-preview-button.json` 及同名PNG：普通Review产生的Beta比较，UI按钮复现。
- `steps/M01-preview-to-conversation.json` → `steps/M01-conversation-to-preview-real-button.json` 及PNG：Alpha other第二比较来源复现。
- 状态含每个owner group、规范tab资源、完整Git原/改模型、按钮focus、全部command args与UIerrors；冻结源码原字节在 `frozen-source/`，真实加载JS在 `loaded/`。

冻结源的定位依据：`conversationDiffReviewPane.ts:199` 按钮执行无显式host的 `sources.diff.moveToPreview`；`sourcesDiffRefHelpers.ts:resolveMoveHostRef` 在 `editorTitle` 路径只读取全局 `editorService.activeEditor`，其为空则返回undefined。该次真实Conversation叶子与比较组存在，但被全局editor聚合排除。此处是观察到的缺陷和候选原因；后续设计/修复/规则16及旧red新green由父调度原作者和独立审查，不在D擅改产品或重新编译。

## 受控公开I/O边界

E01/E02只是18项J矩阵中的本地open错误编号，**不是E引擎阶段**。临时以公开 `CommandsRegistry.registerCommand('_workbench.diff', ...)` 遮盖官方handler，只在同步revive的modified URI精确等于自有目标时reject或返回controlled Promise；其他DTO同步委托捕获的官方handler。故障handler没有跨await保存ServicesAccessor，没有修改SCM DTO、Sources模型/错误代次或Reviewed私有字段，结束均dispose，官方handler恢复。

`E01-actual-open-rejected` 捕获真实Git original DTO和file modified DTO、provider title、`editorOptions:{preserveFocus:true,pinned:true,source:1}`。实际状态显示 `Unable to open diff: D1387 controlled own Git open rejection` 且未Reviewed；`E01-actual-reopen-success` 有完整真实内容、无旧open错误。E02晚reject保留Beta未Reviewed；晚void保持新状态但按原委托合同mark Beta，不能据此声称Beta内容已加载或stale helper被触发。

## 实际加载与既有回归来源

[证据清单](d1387-j-partial-after-artifact-inventory.json)中 `J/loaded-manifest.json` 为实际renderer Debugger的18份原JS、完整字节SHA及inline source-map source一致性，全部匹配冻结native；5个要求核心均实际观察到。52并集由 `support/runtime-assets-J.json` 给出：**39 renderer JS实际加载 + 1 Lens CSS实际加载；其余12项仅manifest**。CSS来自真实CDP样式/DOM字节，不以磁盘存在猜加载；node/main未观察资产维持manifest-only。18是39的子范围，不能相加成57。此收集只属J，不冒称E实际运行或整个out全模块已加载。

E03/F01原件只读取自不可变文档提交 `4173b3fea640124a50cbdaa6aa7ceb7892274641`，以 `git show` 精确导出到包内 `J/lane-provenance/` 并逐文件记SHA：

- `je-formal-J-full.json/.log`：实际sourceHead `0008234e2ebe23ca129cd36f8402b2ff71bf2dea`、src `1ee09f7185369bd3090ae7788e1bfc8ea413149a` 上10文件 **386 passing / exit0**；确有上表列出的公共finder与stale断言，不是只stub openEditor。
- `je-fourth-J-suite-continuity.json`：J18生产、10测试及harness共29 source/native pair与该实际386逐字一致、allPass=true。第四轮没有重跑386，D也没有重跑。
- `je-fourth-J-focused.json/.log`：第四native上新29宿主/重叠重点实际通过。`je-formal-fourth-native-build.json`、`je-fourth-source-native-identity.json`、`je-final-source-native-freeze.json` 分别绑定实际producer与154项来源。这些属于唯一车道运行，不归作D的运行次数。

完整相关255过/1旧reasoning红、外部133/880等车道结果不是本报告新增验证信用；仍按原正式集成报告的准确范围保留。本轮UI发现I1不能被这些自动回归绿覆盖。

## 零引擎、fixture与真实清理

`J/zero-engine-rpc.json` 汇总101次真实采样：始终 `disconnected`、transport `idle`、`channelAlive:false`、connectionEvents `[]`。自有engine home `/tmp/vscode-e-after-home-09nnytik` 为0700空目录，从未有server.sock或server.lock；真实main只读inspector确认实际 `process.env.UNIVERSE_AGENT_HOME` 正是该目录，见 `J/main-runtime.json`。未建立RPC传输，因此 `zeroEngineRpc:true` 依据实际隔离route/状态，不是捏造fake-server计数。没有碰50061，没有启动E fake或创建E phase authorization。

父明确后续修补需新窗口，已按其新调度关闭这次自有句柄。`J/cleanup.json` 记录只按精确profile/PID归属清理，`J/cleanup-exit-proof.json` 最后确认：**1643431、1643371、1643372均无/proc条目；37999/35563均不监听；自有profile已删除；自有空engine home已rmdir，从未有引擎anchor；两Git fixture保留。** 4份相关日志先原字节归档，首次driver错误与M01截图不随profile删除丢失。

D没有stage/revert/checkout/commit这两个fixture，也没有写用户仓库、产品src或out。文档与证据提交只在D分支，父维护共享status/INDEX。本轮后续待办是I1由原作者补修、规则16/实现peer、唯一lane重新编译/冻结后按新调度再次after；E仍未运行，不提前升PRD或关闭D1387。

## 本报告门禁

新增本报告前文档health实际0 errors / 46既有链接warnings。新增后[实际health日志](d1387-j-partial-after-docs-health.log)同为0 errors / 46既有链接warnings，593份Markdown；暂存diff-check通过。证据包250个条目已逐项解包核SHA/bytes完全一致。没有以再次跑业务测试替代本次真实窗口证据。
