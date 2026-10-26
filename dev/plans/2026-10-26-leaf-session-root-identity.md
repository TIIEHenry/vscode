---
title: "Conversation 叶级会话工作根身份条"
type: plan
status: accepted
phase: M7
updated: 2026-10-26
summary: "D1386：绑定叶统一 folder/aria/branch/menu/checkout 的工作根与失效代次；全局添加目录和 mount offer 合同保持。规则16 C0/I0；等待实施与 merge 运行。"
---

# Conversation 叶级会话工作根身份条

## 1. 问题、依据和范围

默认编辑器两叶各绑定一个 session（[PRD-016](../../docs/product/requirements.md#prd-016-conversation-session-窗口与-chat-tab)），但 `ConversationIdentityStrip` 的 folder、分支和动作都读 `getActiveWorkRoot()`。D1382 独立实拍记录两个叶同时投影活动根：中间截图两叶 beta，后续 DOM 两叶 alpha，分别是不同活动时刻；这不是 ReviewNav 归因缺陷。修复依据 [PRD-015 验收9](../../docs/product/requirements.md#prd-015-conversation-空会话与输入面)、[PRD-029 验收12](../../docs/product/requirements.md#prd-029-会话工作根与-workbench-状态跟随会话) 与 [身份条 SSOT](../../docs/systems/conversation/composer-and-inbox.md)。PRD-029 整体仍 proposed，原工作根方案仍 draft，S5 未签收。

本刀落实 2026-10-26 Astra 已裁定机制。身份和操作必须共用同一叶事实；复用已有 `getWorkRoot(sessionId)`、宿主绑定与 roster 事件，增加局部代次，不新增 Context 服务。代价是每条身份条保存绑定、根键及菜单请求代次，收益是旧结果无法跨叶/跨根生效。仅改默认编辑器 `workbench/contrib/conversation`，不实施 `src/vs/sessions`。

## 2. 机制与生命周期

1. `mountTimeline` 显式传宿主的原始 `boundSessionId`（允许 undefined，不能把 fallback 后的 active id 当成绑定）。身份条有 `setBoundSessionId`；Lens 重绑时调用它，不能只在构造时复制。绑定叶统一用 `getWorkRoot(id)`，无可用结果时省略，不回退到别的活动 session；只有真正未绑定宿主沿用 active root，旧服务无 root API 时保留首工作区文件夹兼容。
2. 身份条内部单一解析入口服务 folder 文本、title/aria、本地 SCM branch、engine `ReadGitSummary`、菜单当前项、checkout 与 mount 匹配。键含绑定模式、session、engine identity、规范化 workDir、access 与 localRoot；绑定/键改变推进根代次，取消菜单加载、关闭自身已开菜单、清掉旧分支/checkout 目标。A→B→A 不能复活旧请求。
3. 订阅 roster `onDidChangeSession`，按有效宿主 session id 过滤，让非活动叶 workDir 更新。保留 active-root（未绑定兼容）、workspace、SCM add/remove/HEAD、roster engine 与 UA connection 事件；workspace/SCM 变化也取消旧菜单并重算。隐藏叶随 Lens 释放；恢复新建时重新解析。dispose 关闭自身菜单，所有晚结果检查 disposed 与代次。
4. 引擎 branch 读取捕获完整根键/请求代次；成功与失败都只有仍匹配时可绘制，不只比 sessionId。根在同 session 变目录、引擎身份变化也使旧结果失效。本地 branch 只读该叶 `localRoot` 的 SCM；引擎 branch 没有菜单、chevron、Tab 停靠或 checkout 目标；unknown/无根省略。
5. 文件夹菜单仍添加到窗口。Workspace 勾选该叶 localRoot 所在的工作区文件夹（支持嵌套 SCM 根）；Recents / Browse 继续原 addFolders、远程 authority 与信任路径。异步 recents / refs 用菜单请求代次与根代次，二次点取消、关闭后重开、重绑或根变化均不能让旧请求开新菜单。已经显示的旧 delegate 再被触发也不执行。分支 checkout 捕获并复核该叶 URI；选当前项无动作。
6. mount model 仍只有活动 offer，不改模型/自动挂载贡献。只画 URI 与该叶 engine workDir 匹配的现有 offer。绘制时保存 offer 对象/URI 和根代次，点击同步重读根及 getOffer，确认仍为同一 offer、同 URI、同根后才 `acceptOffer()`。变成另根时旧 Add 不接受新 offer；同路径不同 session 按既有 URI 合同，不建立新授权策略。没有匹配 offer 的非活动叶不画 Add；切为活动后沿用既有贡献评估。
7. Engine chip 继续全局连接状态。保留原浅深/高对比样式、锚定菜单、只读 tabIndex=-1 和键盘 Enter/Space 原生 button 路径；文字截断配 title，folder title 指向该叶目录，branch title 指向该叶分支。

## 3. 非目标

不改 Sources 跟随活动会话、ReviewNav 路径归因、Preview 显式切换、PRD-029 根稳定性、协议、引擎缓存、每叶自动挂载/信任、全局项目选择器或语音。`1 files` 独立 Minor 不作为本刀完成依据。没有真实用户仓库 checkout；命令使用 spy 或隔离 fixture。

## 4. 验收与验证交接

公共行为测试落 `conversationIdentityStrip.test.ts`，通过真实 Lens/身份条 DOM、公开 roster/context 事件、按钮和菜单 delegate 检查，不镜像生产解析器，不用 getter 结果代替界面：

| 场景 | 必须观察的结果 |
| --- | --- |
| A(alpha/local)、B(beta/engine)，活动 A→B | 两叶 folder/aria 保持各自归属；B engine read 带 B session，branch 只读、无 A 菜单；A 本地 branch 不变 |
| 两 local 不同 HEAD，鼠标/键盘打开菜单 | 各自当前项勾选，checkout 参数是该叶 URI + ref；Workspace 勾所在 folder |
| 非活动 B workDir 改变、bind A→B→A | folder/aria/title/branch/可点性一起变；旧 summary/refs/recents 成功或失败不污染，不复活菜单/动作 |
| workspace/SCM 增删/HEAD，连接 fallback | 仍按该叶重算，旧 checkout delegate 无动作；未绑定单叶继续跟活动，旧无 root API 宿主仍兼容窗口根 |
| 全局 offer gamma→delta，旧 Add 未及时重画也点击 | 不接受 delta；匹配按钮才接受当前 offer，未匹配叶无按钮；addFolders/remote authority 原测试保持 |
| dispose / 隐藏恢复 / 无根 | 菜单关闭、晚回无 DOM 写入；恢复重新读取，无根省略 |

merge 是唯一可编译/转译/out 写入者。D 只提交源码/测试和静态 lint，禁止在本工位运行依赖 out 的测试。交付时给 merge 最小顺序：固定旧生产 `5cc987d8` IdentityStrip/Lens/ReadingColumn，先只刷新新增测试取真实 red；再刷新三生产文件取 green；跑完整 IdentityStrip 套与必要 Lens 绑定回归、定向语义与 ESLint。旧测试失败须同 HEAD 比较，不能统称本刀新增。

独立非作者在新 merge 产物上做默认编辑器 after：真实两叶截图与 DOM；A/B 不同根、活动/非活动更新；浅/深/高对比、窄叶；键盘焦点、只读跳过、菜单关闭恢复及 checkout command 参数；matching/stale offer。不得连接真实引擎写操作或在用户仓库 checkout。作者静态 peer 或 getter 断言不能代替实拍。运行结果/独立 after 完整前 plan 保持 accepted、D1386 open，不升 PRD。

## 5. 切片与审查

- P：PRD→生成状态→SSOT→本方案；独立规则16 reviewer 给 Strengths/Critical/Important/Minor/Assessment，C/I 当轮改入，单独方案 commit。
- I：统一绑定根、生命周期/菜单代次和 offer 验证；补真实 DOM/公共行为回归；更新行动层，提交实现但保持 accepted/open。
- V：merge red/green/定向校验，独立默认编辑器 after；证据确认后才决定 implemented/closed。

2026-10-26 规则16独立只读审查：C 原生执行者核对实际正式稿、PRD/SSOT diff 与源码，Strengths 为原始绑定/活动 fallback 分离、统一根与代次、offer 复核及验证门槛。Critical 0 / Important 0；Minor 1 为 SSOT 提前写 accepted，作者核验后随本次 accepted 对齐。准许单独方案提交后实施。该审查未运行代码/界面；未编译、未运行单测、未实拍本刀，不宣称通过。
