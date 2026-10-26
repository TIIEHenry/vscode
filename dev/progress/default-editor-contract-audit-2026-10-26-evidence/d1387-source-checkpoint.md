---
title: "D1387 Sources 打开合同源码检查点"
type: progress
status: active
phase: M7
updated: 2026-10-26
summary: "J在独立澄清a76d062后补API预pin与完整比较身份，新增28项handler/真实组模型及负控回归源码；仅静态0语法/0lint错误，唯一车道运行与非作者after待"
---

# D1387 Sources 打开合同源码检查点

[正式方案](../../plans/sources-open-dispatch-and-conversation-target.md) accepted，独立规则16 C0/I0后于 `133ef4e5cfa06f9905dd83a4570c8d6b0369a317` 单独提交。[真实Git before/C1–C6](d1387-before.md)与两轮Astra已证两个根因；以下是源码检查点，不是after或运行通过。

## 本轮独立审查后的补修（2026-10-26）

原实现`23f8701c8d2`经D独立审查与Astra裁定，API newTab预pin旧preview及单侧URI误记比较身份两项Important成立；custom newTab保留旧preview的预pin窄例外由D规则16 C0/I0复核后，先单独提交澄清`a76d062f297`。方案§6记录审稿SHA与D原报告提交`cbac43bfde8`。本J执行者没有编译、typecheck、transpile、写out/watch、运行依赖out测试或启动窗口；父报告的merge绿基线只用于开工授权，不作为本补修验证。

- API open/diff不预pin旧标签，只把pinned默认值放在官方context；provider显式options仍优先。custom+newTab保留原预pin成本；replace/无slot不预pin。
- API diff以DTO实际original/modified的有序双侧匹配，API open只匹配单资源input的DTO URI，支持真实URI组件与open字符串；不拿quickDiff/sourceUri单侧认领旧diff。旧active比较不再遮住另一组可匹配的新比较。custom只用成对multiDiff URI或已记同resource/group身份，缺可信身份仍void完成，分派后不写identity/pin新input/关旧input。
- `sourcesChangesList.test.ts`新增28个业务用例：API open/diff newTab resolve/reject各自零旧pin/close；直接调用官方handler验证column和provider pinned:false/preserveFocus:false覆盖context；官方handler接真实EditorGroupModel验证默认pin新input保留旧preview，以及provider pinned:false确可替换旧preview；newTab/replace × 同modified不同original的no-op、同双侧reveal、另组背景新比较、当前组新比较；API file不能冒认同URI diff；custom三slot × no-op/reject/未知背景input只留下明确预pin成本；custom实际打开unpin新比较在真实组模型保住旧preview；既有可信身份reveal。
- 原custom正例改为真实DiffEditorInput与成对metadata，继续证明同条reveal与两slot顺序；没有把单侧URI夹具伪装成可信比较。其余三owner、真实调用方、状态恢复与finder/fence源码范围保持原完整实现。
- 本轮实际静态检查：两TS的AST语法解析0错误（没有program/typechecker/emit）；定向ESLint helper0错误/0警告、测试0错误/29警告，与`23f8701c8d2`同测试逐项按规则/消息/所在行文本比较，新增0、消失0。`git diff --check`与生成状态`--check`通过，status167行。本轮fresh docs health0errors/74warnings，较澄清link加入前本轮fresh73仅新增D已提交`cbac43bfde8`但本J未合入的同仓规则16报告link；不跨槽复制或以父工位warning数替代。下方原56警告、73warning等均为原23f检查点历史，不替代本轮结果。

唯一merge后续须用原`23f8701c8d2`生产与本补修新测试击中I1/I2业务red，再用本补修生产运行green及完整相关套/语义；非作者D随后核新冻结摘要并做真实Git三owner after。建议本次red选择`API SCM .*newTab (rejects|resolves) without pre-pinning`及`API diff .* (no-op|background comparison) uses the complete DTO comparison identity`，另将官方handler和真实组模型正负控全量运行。当前无任何本补修业务运行结论，方案accepted、D1387 open、PRD不升。

以下各节保留原`23f8701c8d2`源码检查点事实；原“公开URI”匹配的不足已由本段与当前方案§3.2纠正。

### R2 失败报告小投影补修（2026-10-26，J）

父转述唯一merge在`89f3e5a6a17`新测试配`23f8701c8d2`旧生产时，R1四项已得到业务AssertionError；首项R2后进程仍活但无Mocha结果，guard中断不计业务red。J只读确认R2把完整identity及带throwing `resourceGroup` getter的SCM对象交给失败报告；该对象展开是待验证的卡住原因，不把推测记为已复现根因。

本次只改R2断言harness：用identity存在性、准确`groupId`、`scmResource === expectedResource`布尔值与原完整调用trace作小投影。原no-op旧身份不变、新input无身份、同双侧reveal与后台/当前组新比较得到新身份、只在当前组replace关闭旧input的语义全部保留；资源检查由结构比较加强为严格对象身份。生产文件不变，原`89f3e5a6a17`生产审查仍有效。未改测试标题与selectors，未编译/typecheck/transpile/out/运行测试；须由唯一merge重跑原R2 red，卡住或超时仍不算业务red。宿主归属新Important另走方案澄清与独立规则16，不混入此小修。

父随后报告完整10文件Electron在首个官方handler测试后，per-test disposable gate检测到46个`setupEditorCommands()`全局启动注册，并触发unexpected-console后续失败（原日志`/tmp/vscode-d1387-89f-complete-electron.log`，J未亲自运行）。本次将真实setup移到一次性`suiteSetup`，仅当API open/diff未注册时执行；测试进程启动注册与每项测试的局部disposable scope分开，仍直接调用官方原handler并使用真实EditorGroupModel。没有关闭、绕过或ignore leak检测，没有改生产setup。

J本次实际静态检查：该TS的`createSourceFile`语法诊断0；ESLint 0错误/29警告，相对`89f3e5a6a17`逐项按rule/message/所在行文本比较新增0、消失0；`git diff --check`通过。生产`sourcesChangeEntryOpen.ts` SHA256仍为`f13693e1de22a0a2b60e966ced1bcdef0d79a9257195b8637fa2cc474bccad37`。以上不证明完整Electron套通过，运行归唯一merge。

## 生产切片

- `sourcesChangeEntryOpen.ts`：识别既有API open/diff常量，一次执行原DTO；官方context分别放第4/5参数。其他资源仅调用custom.open；二者void resolve保留委托完成语义，reject不兜底。无SCM的直接Preview文件/diff有pane才true。只对公开URI匹配input做Sources identity、custom pin和同组replace close；不同资源旧input不冒认，provider显式选项不被API分支post-pin覆盖。newTab保留旧preview语义照旧。
- Changes/Review列表、Open Selected和move动作依赖包全部提供真实ICommandService。未改extHost map，不执行任意其他resource.command，不扩大vscode.changes支持面，不复制slot算法。
- `editorGroupFinder.ts`：typed Conversation chat/review仍为白名单；既有token或准确有效具体组才承认。真实conversationParts/groups对象成员验证，对象必须同一实例，数字须实际getGroup解析到该成员；其他excluded旗/伪造同id/过期组不获授权。finder不重选会话或最近叶。
- Review与Changes分别保留局部open错误；当前true清自己错误，false用通用打开未完成文案，reject写打开错误，旧generation/stale不写新状态。Review host既有状态通道新增可选open来源；读失败与Changes写失败不被成功顺带清除。不改captured-entry标记与write/pairing门、move既有false/stale关闭策略。

## 回归源码与意义

| 套件 | 新增/调整的业务断言 |
| --- | --- |
| sourcesChangesList.test.ts | API open/diff × 无slot/newTab/replace × preserveFocus两值的12个生产DTO形状场景：execute一次/resource.open零次、正确context位、optional/provider tuple不改；API reject无fallback；不同资源旧input不改identity/close；custom同条reveal与reject；provider后台目标不pin/close聚焦组。 |
| conversationEditorFence.test.ts | 真实parts + public findGroup + actual EditorService对象/数字准确目标；实际共享slot首次空组replace/newTab、同条reveal、另一条replace与根保留。普通file/untitled/ChatEditorInput/可写Diff × token/对象/id负控；无目标/main错误/无效id/移除组/同id Proxy与其他excluded负控。 |
| sourcesReviewList.test.ts | Review右键API reject后公共Open Selected void成功清旧error、不清无关读状态；旧void晚到不清较新error且不发明通用Review取消策略；Changes右键reject→成功恢复provenance，后续成功仍留本地unstage写失败，0 Review mark。 |
| 既有相关测试 | REQUIRED命令依赖接入DiffPanel/DiffRefHelpers/GitDiffContent/ReviewCommands/ReviewShowForPaths；既有direct undefined夹具改断言false/不mark，未把空pane夹具伪装成真成功；false文案断言改通用文案；既有wiring scan仅同步Preview不再无条件true。 |

EditorService路由测试使用无行为覆盖的RoutingReviewInput子类及既有registerTestEditor轻量pane，隔离全套运行时pane注册顺序和文件模型加载；继承生产identity/matches/只读能力，未mock EditorService.openEditor或finder。它证明公共路由/slot，不证明实际Git两侧加载。真实production pane与真实provider仍须下面非作者after。

## 作者实际检查

- J始于clean d472，方案提交133ef4e后仅本主题paths；未合入后续他槽源码，没有写其他工位。
- 定向ESLint及TypeScript AST **语法解析**已执行；无emit/program/typechecker。初次14文件0 errors/35 warnings；扩大到全部17个变更TS后，与133ef逐条按规则/消息/所在行文本比对，均0 errors/56 warnings、0新增诊断；语法解析0错误、0新增any/unknown/never宽cast。含既有source scan的20个warning，不与首次14文件35个warning直接比较。
- `git diff --check`与生成状态--check已过；docs health 0 errors/73 warnings，与同工位方案检查点warning记录逐条相等，新/改D1387文档断链0，status165行。73是该隔离工位实际外仓/子模块可用性下的日志，不能替换父工位的46；未为清warning初始化或修改外仓。首次误用不支持的--json参数exit2已按--format json正确重跑成功。测试源不等于测试已运行。
- **未执行**编译、transpile、typecheck、out/watch或依赖out的测试。作者未重开应用；自己的before不作after。无engine RPC、无用户仓库/设备/账户操作。

## 唯一merge待运行顺序

1. 记录源/产物scope与摘要。仅刷新新测试，保留旧生产正文并核对旧源码；最小I1业务red选择 `API SCM .*dispatches its DTO once`，I2业务red选择 `public finder and EditorService retain the exact typed Conversation`。旧代码必须在command未执行或准确组被改投/拒绝的断言red，不以source scan/夹具类型/编译错误充数。
2. 串行刷新本主题生产，运行以上red对应green，再完整Sources Changes/Review/DiffRefHelpers/DiffPanel/GitDiffContent/ReviewCommands/ReviewShowForPaths、Conversation fence、shared slot和相关editorService/source scan套。语义/必要full由唯一merge按实际日志报；原始既有全量失败单列。
3. 非作者真实默认编辑器两Git fixture：Preview Review鼠标/真Enter/右键/OpenSelected、Changes先Beta后Alpha；Conversation C1/C2空组replace/newTab、C3无slot、C4replace另一条/newTab/reveal、C5精确叶、隐藏候选恢复；Panel；move Preview→Conversation→Panel→Preview及viewTitle。记录实际两侧全文/URI/part/sessionKey/group/readonly/root/focus/tabs/Reviewed/错误恢复，不用getter或命令参数替代真diff。
4. C准备材料 `/tmp/vscode-d1387-after-preparation.md`；实际after前再核最终commit/out加载身份。五相关Debugger模块URL/hash/副本与源码scope按最终采样，不称整out同构建。无引擎0 RPC、fixture HEAD/index/worktree前后不变，清理只自己profile/进程。
5. 迟到命令/active切换旧before夹具失败仍列未覆盖；本波若运行则用公共依赖受控Promise/加载事件，不能跨await保留ServicesAccessor或改Sources私有状态。

独立实现peer及运行/真实after到齐前，方案accepted、D1387 open、PRD实施状态不升；不重新打开已闭D1382/1386。
