---
title: "Sources 已登记回归与可执行合同对齐"
type: plan
status: draft
phase: M7
created: 2026-11-02
updated: 2026-11-02
summary: "修正三项已登记 Sources 测试失配，以真实写入能力夹具、局部 TypeScript AST 源码门和打开事件异常回归保留原合同；保留四测试合同，并修正 Sources Node 测试入口与独立 JUnit 门禁；不改生产实现。"
---

# Sources 已登记回归与可执行合同对齐
状态：执行中。负责：agent:sources_final_integration。原方案与 §9 增量均已独立审查通过；第五轮真实五域已收，三旧失配和新增38项通过，完整入口因Sources五pending严格退出1；49继承lint与真实焦点/产品验收保留，独立OV/CommitGate与正常提交待。

覆盖需求：PRD-005、PRD-009（维护既有行为的测试合同，不扩展需求或提升验收状态）。

## 1. 权威与固定输入

需求以 [PRD-005 / PRD-009 正文](../../docs/product/requirements.md) 为准；模块合同见 [Sources 系统概览](../../docs/systems/sources/overview.md) §2、§4：Changes 按目录投影并提供三态勾选，暂存能力受既有连接、会话、写 hook、pairing 与 leftover 门限制；Changes 打开不标 Review 已审阅，打开失败写自己的状态；Accept 实时读取 FileDiff，只暂存光标单 hunk，不从 Monaco 文本或携带载荷构造整段提交。

问题沿用 [D17 验证债登记](../progress/deferred-gaps.md)，不建第二份问题表，不重新打开 D677 的产品修复。固定分析输入为 C 已提交的 `be2dafb29c80cda0fb363d9f0644b9c6b6ad0c24`。该提交的实际组合 Sources 结果为 790 passing / 5 pending / 3 failing；三败与精确 b83 参考同名、同断言。原件在 `/sdd/tmp/vscode-integration-20261102/context-ownership-wave2/E-validation/` 与 `C-EF-combination/`，包括原日志、退出码、输入 manifest 和精确失败名单比较；旧参考是两生产模块与 95 源码扫描输入的对象对照，不是完整旧版本重编译。

## 2. 三项失配的依据

1. **目录行为用例没有提供写能力。** `sourcesChangesList.test.ts:4580–4616` 期待勾选文件后 Stage Selected 可用，但其 `createGitReadConnection`（1824–1859）只装读取 hook，没有 writeGitStagePaths。生产 `SourcesChangesList.canWriteStage`（707 起）与 `isEntryCheckboxEnabled` / `setEntryChecked` 依既有 hook 和会话门拒绝无能力勾选，符合权威合同。forceClick 改 DOM disabled 不会赋予模型写资格。此失败还令后续折叠/展开断言未被执行，必须恢复其覆盖。
2. **D677 扫描截错了调用层。** `sourcesLeftoverCatchScan.test.ts:56–65` 截取 onDidOpen listener 后要求出现 openSourcesChangeEntry。现 listener（生产 878–894）以带双 catch 的 IIFE await this.openChangeEntry，helper（816–849）才真正 await openSourcesChangeEntry 并维护打开状态。产品保护链仍在；不能退回内联代码迎合旧字符串。
3. **Accept 扫描把注释当依赖。** `sourcesWiringScan.test.ts:239–250` 对整个 sourcesGitHunkPatch.ts 使用禁词 includes。当前 parser 名仅在第 112、165 行的行号语义注释出现，没有导入或调用。生产 runAccept 仍在实时 FileDiff 返回后切单 hunk。不能删除或改写正确注释换绿，也不能取消对真实 parser、Monaco 文本和反向 argv 的保护。

以上为起始源码与既有运行原件的交叉核对；其后正式第三轮通过记录见 §8，最终入口候选的运行结果另由 integration 记录，不把本次作者静态检查称为新产物通过。

## 3. 唯一实施范围

| 测试文件（均位于 contrib/sources/test） | 本主题修改 |
|:---|:---|
| `browser/sourcesChangesList.test.ts` | 修正该目录用例的正向写 hook 夹具与请求记录，保留计数、勾选、折叠/展开断言；补无能力负门 |
| `browser/sourcesReviewList.test.ts` | 通过真实 Changes / Review onDidOpen 增加异常链行为回归；复用既有等待和 error-handler 恢复模式 |
| `node/sourcesLeftoverCatchScan.test.ts` | 局部 AST 检查真实 listener、委托 helper、await 与双 catch；加入扫描控制用例 |
| `node/sourcesWiringScan.test.ts` | 局部 AST 检查 Accept 的可执行依赖和调用、固定 argv；加入注释正控与可执行负控 |

上述四测试之外，已独立通过并获 root 授权的 §9 追加范围为本地 Sources runner 路由、JUnit 比较器、仅增 sourcesNode 阈值头的既有基线和有限脚本回归；加本方案共九个 E 路径。权威测试说明与 health-gates 由唯一 integration 同步，不由 E 作者写入。

不修改生产 TS、生产注释、按钮启用条件、Accept 行为、权限、协议、PRD-029、Files/Diff 布局、IPC 或共享工作流。已有 sourcesGitHunkPatch、Panel / Pane Accept 行为测试继续作为验证输入，不为此扩展产品文件范围。编码如发现真实产品缺陷，先回父调度者与 Astra 重新裁决并修订本方案，不能借测试修复静默改产品。

已只读核查主工位、A/B/D/E/F、merge、ui-adaptation 与三棵 evoflow 树：八个相关候选产品/测试路径当时无未提交修改；当前主工位已提交差异只涉及上一轮 E 的 Review 测试增量。此为一次占用观察，编码前仍须重查，不能据此取得其他工作树的写权。

## 4. Astra 已裁决的测试合同

agent:astra_registered_wave_arch 批准四测试文件的 test-only batch。两个 node 测试只使用现有 devDependency TypeScript AST，不加依赖，不新建通用扫描框架，不把类型检查器或整个仓库语义分析搬进该测试。

- **目录夹具保留授权。** 正向夹具明确提供可计数的 writeGitStagePaths，既有会话 ready、连接和能力事实一致；正常点击勾选后才允许 Stage Selected，真实暂存请求核对捕获的 session/path。负门覆盖无 hook、显式 UNSUPPORTED 和 pairing hold，有函数不代表能力可用，强制点击也必须零写 RPC。不得为该用例放宽生产门。
- **D677 检查真实调用链。** AST 定位 list.onDidOpen 的实际注册：外层 listener 不能是 async；Changes 内部 IIFE 必须 await this.openChangeEntry，并以两层 onUnexpectedError catch 收尾，对应 helper 必须真实 await openSourcesChangeEntry。Review 保留当前非 async listener 内直接 void this.openReviewEntryMarkingReviewed 并接双 catch 的形状，helper 内部实际 await 打开与标阅链；不要求将正确的 Review listener 改成 IIFE 或添加 await。缺少真实 await 点、单 catch、委托改名后断链的负控都要被拒绝，不能以旁边注释或另一函数中的保护冒充当前注册点。
- **Accept 检查可执行语义。** AST 检查 import/export 的模块和 parser specifier / alias，以及实际 CallExpression、PropertyAccess 和字符串 element access。parser 的直接、alias 与 member 调用，以及 getValue / getLineContent 调用必须被检出；注释和普通无害文字不能算依赖。固定 argv 中的真实 `-R` 仍必须被拒绝，不能把全部字符串剥去而放过反向应用。只覆盖本文件可见的静态引用和调用，不承诺追踪任意动态数据流。
- **源码门不能替代事件行为。** 真实 onDidOpen 必须触发打开拒绝、随后状态绘制抛错，error handler 第一次记录后重抛、第二次接住；最终没有 unhandled rejection。每条测试在 finally 恢复原全局 error handler 与监听器，防止同域其他测试被污染。

## 5. 必须保留的正负矩阵

| 入口或控制 | 必须证明 |
|:---|:---|
| 正常写能力 + 两个嵌套文件 | 目录计数和文件/目录勾选真实；Stage Selected 随有效勾选可用；暂存请求 session/path 正确，不因渲染或勾选自行发送写入 |
| 目录折叠后再展开 | 保留原 list.length、隐藏 anchor 文件行与重新显示断言，不删除原后半段；勾选不会误触折叠 |
| 无 write hook、显式 UNSUPPORTED、pairing hold | 不获得写资格；普通与强制点击均不发送写 RPC；保留原原因提示与会话门 |
| Changes / Review 正常打开与打开拒绝 | 既有成功/失败状态合同仍过；失败不标 Review，Changes 始终不改变 Review 进度 |
| 两种真实 onDidOpen 的拒绝 + catch-path 绘制抛错 | 原 listener 保护链真实执行，handler 首次重抛后仍无 unhandled；测试结束全局状态恢复 |
| D677 当前源与合法委托 | 检中实际注册和 helper，不依赖旧内联字符串；当前链通过 |
| D677 缺 await、少一层 catch、委托断链 | 对局部受控源码 fixture 明确失败，不能靠其他注册点的 await/catch 通过 |
| Accept 注释或无害普通字符串提及禁词 | 通过；保留现有生产注释，不通过改注释避测 |
| Accept parser 直接/alias import 与调用、member / 字符串 element access 调用 | 负控被拒绝；不能只查导入或只查直接函数名 |
| Accept getValue / getLineContent 与真实 argv `-R` | 负控被拒绝；保留固定 cached argv 和禁止编辑器文本构造载荷的合同 |
| 既有 hunk / Panel / Pane 行为 | 实时 ReadGitFileDiff 使用 Unstaged；只发光标单 hunk与固定 argv；空/二进制/光标不命中零 Apply；无本地 Git fallback，既有生命周期和写前授权仍通过 |

扫描控制 fixture 是证明测试本身能分辨合法注释与真实违规，不宣称旧生产含这些违规。新增事件回归可能在现有正确保护链上直接通过，不伪造“旧产品红”；本主题的旧红依据是三项已有失败，运行时须区分测试失配、控制负例和产品回归。

## 6. 实施、验证与提交顺序

1. 本稿先独立只读审查。两条不交模块方案通过后，唯一 integration 对方案与行动记录做正常独立文档提交，再分配编码工作树；不直接在 C 编码。Astra 已批准本主题复用 E 工位并新建 codex 分支，从该固定文档提交开工；保留旧 `codex/sources-context-owner-E` 的 8fc 引用，不移动或覆盖旧候选 refs，具体新分支与 SHA 由父调度冻结后下发。
2. Sources 唯一编码者只改 §3 与 §9 合并授权的九路径，不能编译、测试、lint 或提交。公共索引、进度、D17 与提交由 integration 统一维护；与另一模块并行编码但不并行产品验证。
3. 唯一 integration 固定精确输入，以本聊天稳定锁和私有输出/TMP/XDG/cache串行运行，检查实际外部进程但不声称全机排他。新产物运行原三个用例、完整新控制矩阵、相关 hunk / Accept 行为与完整 Sources 正式域；命令沿用 [本仓健康检查](../progress/health-gates.md)，不在此另抄命令表。
4. 原三败在 be2 的 fresh 组合原件已经存在。使用该信用时先核当前输入与原件匹配；若需重跑，仅由 integration 执行。控制负例必须实际触发预期检查失败，不能用加载错误、TypeError、缺新接口或超时冒充业务旧红。修后计数据实记录，不预设总数，也不删弱断言换绿。
5. 精确目标 lint、文档门与非作者 OV / Commit Gate 收口后正常本地提交。所有主题代码、测试与必要行动文档同次实施提交；不 fetch/push，不动 shared merge/main、不访问真实 Engine/Hub、不跨聊天协调。两模块最终本地组合另以实际组合输入验证，单槽结果不代组合结果。

## 7. 完成边界与剩余债务

本主题的停止条件是：原三项失配均被修正且通过，新增扫描负控确实拒绝违规、注释正控通过，事件异常回归真实执行，原目录折叠后半段恢复覆盖，完整 Sources 没有新增失败，目标 lint 与文档门按实际证据独立签收。生产代码与合同保持原字节；若做不到，回方案修订，不缩成仅删除字符串断言。

五项 Files 焦点 pending 仍需有焦点宿主验证；隐藏 Electron skip 不能记为视觉通过。原 C 七条与原 E 一条 lint 警告、真实 Engine/Hub/默认产品窗口、共享接纳与 PRD 整体验收均不在本主题关闭范围，不增加额外清理。新目标文件集合如暴露其他既有诊断，须按原 blob 与原件单独归因，不能自动并入原七条或 E 一条；本次新增诊断必须修正，不增加 suppression。D17 只更新本主题已完成的子项与证据，不整行关闭；D677 产品保护不重新宣称新实现。

## 8. E 实施候选说明

候选位于 E 新分支 `codex/sources-regression-contract-E`，固定父提交 `68e82413c9cfb80c2c644e2b7ba126906abd36ed`（方案文档提交，产品输入与 be2 相同）；旧 `codex/sources-context-owner-E` 引用保留。本节只记录写入事实，不替代运行凭据或独立签收。

- 目录原用例提供可计数写 hook，普通 DOM 点击验证文件/目录勾选、mixed→checked，再执行原折叠/展开断言及实际 session/path 写请求；新增无 hook、UNSUPPORTED、pairing hold 三种负门。
- D677 使用本文件局部 TypeScript AST 检查真实注册、同一 Promise 链的双 catch、Changes IIFE 与委托 helper 的真实 await，以及 Review 当前直接 void 委托形状。注释正控与缺 await、单 catch、断链、async listener 等负控同时保留；Changes 负控额外带无关正确保护的 decoy，避免扫描跑偏。
- Accept 源码门使用本文件局部 AST 检查实际 import/export、parser alias、member/element 引用与调用、Monaco 文本调用、本地 staging 调用及固定 cached argv。注释/无害字符串正控、直接/alias/member/element 等违规负控和真实 `-R` argv 负控均已写入。
- Changes / Review 两项真实 onDidOpen 回归在列表就绪后装入仅打开错误绘制抛错的夹具，验证实际 opener 失败进入该分支、Review 不标阅，复用 finally 恢复 error handler 与 unhandledRejection 监听器的既有辅助函数。

首版四测试候选只写四测试与本方案；未修改生产实现、生产注释、依赖、框架或既有 forceClick lint 行。后续已批准的入口修订实施记录见 §10。编码者仅做静态差异空白检查，未运行编译、测试、lint 或文档门，也未暂存、提交。下一步由唯一 integration 核 frozen hash、串行 fresh 产物与完整 Sources/相关 Accept 行为、目标 lint 和文档门，再交非作者 OV / Commit Gate。旧三项红与控制负例必须按 §5–§6 分开记录，不把未运行候选称为通过。

首轮唯一 integration 的 fresh compile 报两项 TS2339：Node assert 对空数组的深相等断言把后续请求元素窄化为 never；未进入测试或 lint，不计业务旧红。窄修将写前零请求改为长度断言，写后全部 session/path 请求断言保留。独立 Astra 同时指出 AST 门不能把未调用嵌套函数/类中的 await、其他类同名 helper 或错误 Review callback 中的 await 当作实际链；候选已改为当前词法执行体遍历、实际所属类 helper，以及真实 awaited markReviewed 的第一个 async opening callback 绑定，并加入对应正负控制。该窄修尚未重跑，仍须原独立审查者复核与 integration 新产物验证；旧日志保留。

第二轮唯一 integration 的 compile 仍报一项 TS2339，定位为新测试误用了不存在的 request.paths，不能当作业务红。已实际核对 universeAgentTypes 的正式请求、sourcesChangesGitWrite 的构造器及既有写请求测试：Stage 请求为 sessionId 与 commands，每条 command 的 argv 只有原样路径，不发明 git add 前缀。候选改为直接深相等核对两个完整请求对象，分别是 session-1 / commands[{argv:[src/a.ts]}] 与 session-1 / commands[{argv:[src/nested/b.ts]}]，不使用 any、类型强转或仅检查请求数。新增负门只接受零请求，打开异常夹具与 AST 控制没有另造写入请求形状。AST d7f57638 修订保持原字节；本次仅 Changes 测试与本段说明变化，尚未再次运行，前两次编译原件均保留。

残余 I1 经父调度采纳 Astra 的有界身份策略后，D677 又补三个已知 callee 的真实 named-import 来源和导出名校验：onUnexpectedError 来自既有 errors 模块；Changes opener 来自 sourcesChangeEntryOpen，Review opener 保留 sourcesChangesList 的既有 re-export；Review mark 函数来自 sourcesReviewListModel。在实际 listener 所处执行 scope、IIFE、所属 helper 和真实 opening callback 内，拒绝这些已知名字的参数/局部 binding 遮蔽；未调用嵌套 scope 不作误判。不使用类型检查器，不追踪任意 alias 数据流或新增通用作用域框架。正向 fixture 已补真实 imports；局部空 mark 函数、opener/handler 参数遮蔽、错误来源和错误导出 alias 的负控以及不相干 dormant shadow 正控均已写入。该次仅 Leftover 测试与本说明变化，正式 Stage DTO 断言保留 267ccb3e 版本，其余两个测试不动；尚待原独立审查者收束和唯一 integration 运行。

第三轮唯一 integration 的 fresh compile 已通过；正式 Node 两套件 59 passing，正式 browser 27 文件 773 passing / 5 pending / 0 failing，按分环境合并覆盖完整 29 文件，旧三个实际用例与新增 38 个控制/行为用例均已命中。原单 Electron 全 glob 因 Node 测试中 TypeScript bare import 的 ESM 加载失败已留存，不能计成业务断言失败或假称该 wrapper 已修复。精确四文件 lint 为 61 warning / 0 error、退出 1，其中 12 条来自本主题新增行，49 条由相同 ESLint 对原始 68e blob 的 lintText 对照确认是留存诊断；历史参考共 51 条，本主题替换的旧文本扫描同时移除了其中两条。此归因不代替独立接受，也不合并为原 C7/E1。原件在 sources-clipboard-wave/E-validation/r3 的 runtime-results-and-case-receipt.json、target-eslint.log 与 lint-baseline-exact-comparison.json。

父调度授权后，先将 10 条新增字符串诊断对应的 fixture 外层引号改为单引号并转义，实际被解析的源码字符与 AST 控制语义保持不变。两条 TypeScript import-patterns 诊断已核现有 Node 层依赖规则与 createRequire 先例，加载方案尚待独立 Astra 裁决；未自行增加允许列表、suppression、依赖或通用加载框架。上述运行通过是本次窄修前的第三轮证据，更新候选仍须唯一 integration 再验证。


## 9. 测试入口修订增量（已独立规则 16 审查通过）

本节是父调度根据第三轮真实加载失败采纳的追加方案。增量以方案 SHA aee8cd4b7409ff32de72c584fe3e76d8ebaece6a4263646824a83a06c439f1d6 经非作者规则 16 审查 C0/I0 PASS，随后 root 明确授权以下四追加路径；实施记录见 §10。原四测试控制矩阵、原三败关闭证据、五项焦点 pending、C7/E1 及独立留存 49 条 lint 边界继续有效；不以修改入口取消 Node 两测试或降低旧门槛。

### 9.1 已批准的 Node 测试工具接入

两 Node 测试通过现有 Node 层允许的 `module` 导入 `createRequire`，以 `createRequire(import.meta.url)('typescript') as typeof import('typescript')` 加载现有 TypeScript 开发依赖；节点类型只保留本文件所需的有限 `import('typescript').Node` 等类型查询别名。Leftover 使用 Node / Expression / CallExpression / SourceFile / BindingName，Wiring 使用 Node / Expression / VariableDeclaration；不使用 any、静态或 type-only TypeScript ImportDeclaration，不新增依赖或配置。它仍然真实依赖 TypeScript 测试工具，不能写成“移除了 TypeScript 依赖”，也不以某种语法未被 lint 扫到作为架构理由。正规 Node 加载先例为 universeAgentBrandRaster 与 capiReplayProxy；AST 行为、callee 来源/遮蔽约束、全部正负控制保留。两测试加载方式与 10 条 fixture 字符串修订已获单独授权并落盘，尚待 integration 再验证。

### 9.2 精确拟增文件与职责

| 路径 | 追加范围与负责人 |
|:---|:---|
| `scripts/run-unit-custom.sh` | E：只修 Sources 环境路由与本轮结果新鲜性；保留 conversation、universeAgent、universeAgentNode 选择和既有 print 接口，不承担编译，不调用自造 runner |
| `scripts/check-test-baseline.sh` | E：shell RESULT_XML / DOMAINS、内嵌 Python domains 增加 sourcesNode，独立检查其 XML、用例下限、skip 上限和失败集合 |
| `dev/progress/test-baseline-failures.txt` | E：只向现有 min_cases/max_skipped 头增加 `sourcesNode=59` / `sourcesNode=0`；不改任何现有数值、名单或历史叙述 |
| `scripts/tests/test_unit_custom_sources.py` | E：新增有限 Python unittest 临时仓根夹具，实际执行复制的 shell 脚本与内嵌 Python；stub 官方 runner，不编译或加载产品，不新增通用脚本框架 |
| `docs/architecture/cross-cutting/testing.md` | 唯一 integration：同步 Sources 27 browser + 2 Node 的当前环境与 29 文件完整覆盖，明确 official runner、XML 域与剩余 pending；不把工具加载失败记成业务红 |
| `dev/progress/health-gates.md` | 唯一 integration：原 unit-custom 行仅更正 Sources 分环境路由并引用权威测试说明，不复制新命令表或重写其他域政策 |

追加后 E 可实施输入为原四测试、自己的方案及前三个脚本/基线文件和一个新脚本测试，共九个路径；知识同步两路径由 integration 独占。增量实施前仅写原两 Node 测试与本方案，获授权后扩展为上述九路径。没有新建 Markdown，既有 `check-new` 方案结果继续保留；拟新增的是现有 scripts/tests 风格下的 Python 代码，根规则的新文档 check-new 不适用于该代码路径。不得修改 workflow、官方 runner、package/依赖或 ESLint 配置。

### 9.3 路由、参数与完整性

现脚本 `run-unit-custom.sh` 在 `set +e` 下调用 Sources 全 glob 的 Electron runner，再由比较脚本决定门禁；新 TypeScript Node 工具接入使该官方 Electron 全 glob 发生真实加载错误。修订后 Electron 只接受 Sources `test/browser/**/*.test.js`，继续 `--tfs sources`；Node 官方 `test/unit/node/index.js` 接受重复 `--run` 的两个精确 `.test.ts` 路径并使用 `--tfs sourcesNode`，不依赖当前不被传给 Mocha 的 grep。browser 实测 27 文件与 Node 两文件的并集等于完整 Sources 29 文件，没有重复或遗漏。目录新增或移位导致此闭包不成立时须重新审查，不能把文件静默丢出验证。

命令参数使用 shell 数组逐项传递，固定两个 Node 文件名为 sourcesLeftoverCatchScan.test.ts 与 sourcesWiringScan.test.ts；目录中不存在任一文件即失败。原两个 `--print-universeagent*` 查询分支继续原样且不启动测试或删除 XML；不新增泛化转发 CLI，不改变现有调用者的编译职责、Node 环境或其他域选择。每个域只写一个独立报告，不能多次同 `--tfs sources` 覆盖结果。Node reporter 会将域名小写，故新增文件精确为 `linux-x64-sourcesnode-results.xml`，原 browser 文件仍为 `linux-x64-sources-results.xml`；当前脚本继续是既有 Linux x64 门禁，不扩跨平台命名框架。

实际运行分支在首次 runner 启动前只删除五域各自明确的预期 XML，不能使用通配符删除其他报告；删除失败立即退出。结果根采用官方 reporter 已有的 `BUILD_ARTIFACTSTAGINGDIRECTORY` 优先、其次 `GITHUB_WORKSPACE`、最后仓根，wrapper 清理与比较器读取保持同一选择，避免已有环境变量把产物写到另一目录后错误消费旧报告。已有其他域文件名和 Python 比较语义保持。每轮清理后报告必须由本轮重新生成；读取缺失、空文件、坏 XML 或根目录不一致均非通过。独立调用比较器时只校验所给产物，不虚称有时间戳证明；新鲜性由 wrapper 的精确清理加失败关闭负责。

保留既有其他域允许在比较前非零退出的基线机制；SourcesNode 没有失败豁免，新增 Node runner 的退出码需被明确保留。即使产生看似绿色 XML，Node runner 非零也令 wrapper 非零；没有 XML 时由 missing 报错关闭；检查器非零同样使 wrapper 非零。不得用 `|| true`、最后一条 runner 的成功或残留 XML 覆盖 Node 工具错误。比较器 shell 和 Python 必须同时登记 sourcesNode，避免只有文件存在而没有解析它的假绿。

`min_cases sourcesNode=59` 按 r3 正式 Node 59 用例（含既有 Errors 元校验）冻结，`max_skipped sourcesNode=0`，不额外补失败名单。旧 sources 下限 89 和 skip 上限 0 保持原字节；实际 browser 五项焦点 pending 因此仍会挡此整体比较，不能把正式分环境测试 773 passing / 5 pending / 0 failing 写成该 wrapper 已绿。conversation 等旧域当前基线、失败或 pending 也单独报告，本主题不降阈值或掩盖其他域问题。

### 9.4 有限脚本回归与最终验收

新测试沿用 `scripts/tests/test_wiki_git_environment.py` 的标准 unittest / TemporaryDirectory / subprocess 风格，复制本主题两个真实 shell 脚本与基线到临时仓根，创建 UA 收集所需的既有列表假文件、Sources 两个精确 Node 路径，并提供记录 argv/结果路径/退出码的最小 `scripts/test.sh` 与 PATH Node stub。只用它们证明 shell 路由与真实比较器，不以 stub 代替正式 Sources 运行。基线 fixture 可设置小的用例门槛以覆盖分支，同时单独断言真实基线仅增加 Node 两头键、原所有键和值未变，不能以 fixture 小门槛改仓库门槛。

有限正负矩阵：

- 正控：五域新鲜合法 XML、Node 至少 59 且零 skip/失败时整体比较通过；记录的 Electron Sources 参数只选 browser，Node 参数含 sourcesNode 和两个独立 --run；原三个非 Sources 路由及 print 接口保留。
- Node 真实 failure 或 error：即使其他域绿色，也被 Python 失败差集拒绝；Node 用例少于 59 或出现一项 skip 时分别触发自己的头阈值。
- 缺失/损坏：Node 不写 XML、写空文件或坏 XML 均退出非零；Node 写绿色 XML 但 runner 非零也必须令 wrapper 非零。
- stale 负控：先在预期 Node 路径放旧绿色 XML，本轮 Node 不写并返回零或非零，旧文件必须已被清理，比较报告缺失并非零。不得用一份旧 sources XML冒充 sourcesNode。
- 目录与传参：含空格的临时工作区结果路径仍能清理/写入/读取；BUILD_ARTIFACTSTAGINGDIRECTORY 与 GITHUB_WORKSPACE 同时设置时消费前者，其他目录预放的旧绿色报告不能获通过；缺一个精确 Node 文件先失败。print 查询不写报告、不删除预放报告。
- 门槛保留：真实 sources 五 pending 按旧 max_skipped=0 仍失败；不借本主题调大旧阈值。其他域新增失败、旧名单 stale 的原比较语义保留。

顺序为：本节独立规则 16 审查 PASS → root 明确授权新四路径 → E 实施并做静态 diffcheck/manifest 后冻结 → 唯一 integration 串行跑 shell/Python 语法与上述有限回归、fresh compile、正式 Node 2 / browser 27 全 Sources、精确 lint、实际 wrapper 或按原真实域差异准确记录其失败 → integration 同步两处权威/门禁说明 → 非作者最终 OV 与正常提交。脚本正负回归必须实际执行预期失败分支，原 wrapper loader 错误原件保留；不重写旧三业务失配为新产品 red。停止条件是新增 12 条 lint 清零、脚本路由与新鲜性负控有效、完整 Sources 正式域无新增失败；wrapper 若因原五 pending 或其他域旧债失败，明确列出，不能虚报通过或扩大本波修复。


### 9.5 Sources 根节点 skipped 汇总补读（已独立规则 16 轻量审查通过）

第四轮真实 wrapper 已证实一个比较器缺口：官方 `sources` 日志为 773 passing / 5 pending，已保存的真实 XML 根为 `<testsuites tests="778" failures="0" skipped="5">`，其 testcase 只有 773 条且没有 skipped 子节点。并非 XML 完全丢失 pending，而是当前比较器只数 testcase 的 `<skipped>`，漏读了根汇总。`actual-five-domain-xml-analysis.json` 的 skipped=0 与早期 runtime receipt 的派生描述只反映该子节点计数，不能覆盖根节点实证。实际 wrapper 本轮因 UA Node 四项 socket EINVAL 而退出 1，不是本来应有的 Sources 焦点门拦截。

Astra 已按 installed mocha-junit-reporter 2.2.1 与官方 Electron/Node `--tfs` 的真实 options 核对：includePending 默认不生成具体 pending testcase，既有官方 tfs 入口没有支持的 includePending 环境变量/CLI 合并入口。本主题不新增假 flag/环境变量，不改 reporter、官方 runner 或依赖。最小机制以方案 SHA 90d1c345e05c059a2eb19869634627a3c3540c3416a8534cafc42ca6c2a11f1e 经另一独立规则 16 审查 C0/I0/M0 PASS，随后 root 明确授权原九路径中的比较器与 Python 回归窄修；该次方案审查前只改了本方案。

机制只作用于 `sources` / `sourcesNode`：保留既有 testcase case_count、失败名单和子节点 skipped_count；读取 `tree.getroot().get('skipped')` 的单个根属性，缺省为 0，存在时必须完整匹配 ASCII 非负整数字符串 `[0-9]+`，随后转换整数；空值、负数、带符号、小数、空白或其他非整数均报明域名并退出非零。有效跳过数为 `max(testcase_skipped, root_skipped)`，不能相加。只取根，不遍历或累加嵌套 testsuite 的汇总，避免重复计数；根汇总不能抬高 case_count。其他 conversation / universeAgent / universeAgentNode 三域的 skipped/case 计数、阈值、失败差集与 stale 名单行为完全不变。生产基线 sources 89/0、sourcesNode 59/0 以及所有旧头和失败名单不改，不接受阈值例外。

有限回归在现有 `scripts/tests/test_unit_custom_sources.py` 内追加，不新建文件或通用 XML 框架：

- root-only sources skipped=5、没有 testcase skipped：必须按原零上限拒绝；root-only sourcesNode skipped=1 同样拒绝，59 正常 testcase 不能掩盖 pending。
- 根与子节点各为 1：在专用临时 fixture 仅将测试夹具该域上限设为 1，必须通过，证明取 max 而非相加；仓库真实阈值保持零。另以 root=0 / child=1 拒绝证明不能仅信根，缺省根=0 的既有正负控制保留。
- 两个受影响域的非法根值（至少负数、空值与非整数字符串）必须失败关闭；可用带符号、小数、空白等有限 subTest 证明完整格式校验。没有根属性且零子节点 skipped 的正控仍通过。
- 嵌套 testsuite 带非零 skipped、根缺省/零且子节点不含 skipped 时，不累加该嵌套汇总；不会因嵌套重复汇总制造失败。
- 其他三个域仅有根 skipped（包括非法根文本）而无子节点 skipped 时，保持本主题之前的既有处理；真实子节点 skipped 超出这些域旧上限时仍拒绝，其他新增失败与 stale 名单控制继续保留。

验收必须由唯一 integration 实际运行修订后的真实比较器，对 r4 已存的五份官方 XML 以单独结果根核对，不修改其内容或阈值；必须明确报 `sources has 5 skipped testcase(s), above max_skipped=0` 并非零，保存 XML 原字节摘要和命令/退出/原日志。临时 stub 回归只能证明分支，不能替代该官方 XML 复读，也不能把此次比较器拒绝写成产品焦点已通过。新增机制无须以 Node 59 / browser 773 的历史通过替代自己的当前回归；原 r4 全部原件继续保留。


## 10. 九路径入口候选交接

已按独立通过的 §9 完成四追加路径，不改官方 runner、产品、依赖、lint 配置、suppression 或其他域参数。run-unit-custom 的 Sources browser 使用 `--glob '**/vs/workbench/contrib/sources/test/browser/**/*.test.js' --tfs sources`，Sources Node 使用官方 Node 入口、`--tfs sourcesNode` 和两个独立 `--run`；原 conversation / UA 两环境参数保留。两个原 print 分支仍在任何新清理和 runner 前返回。两精确 Node 源缺失或存在无环境路由的 Sources 测试时先失败，避免静默漏采。

wrapper 与比较器按官方 reporter 相同的结果根优先级工作；仅在实际运行分支清理五个明确报告，清理失败不启动 runner。Node 的非零退出码在比较结束后仍强制传播，其他域仍沿既有差集策略，不以最后一条成功遮盖 Node 错误。checker 的 shell/Python 同时增加 sourcesNode，基线只追加 59/0 两头键，原 sources 89/0 和其他域数值、失败名单与历史正文保留。

首版有限回归含 16 个 unittest 方法，分支覆盖真实 argv、原其他域与 print 行为、当前 27+2 文件并集、正式阈值保留、Node failure/error、少用例/skip、缺失/空/坏报告、绿色 XML 配非零 Node 退出、真实合法旧绿色 XML 加本轮无报告、五报告精确清理/清理失败、带空格结果根及 artifact 根优先级、缺源/漏路由和原其他域新失败/名单 stale。所有 runner stub 仅在临时仓根，不加载正式产品；它们证明脚本控制分支，不能替代 official Sources 运行。

作者只读回看落盘差异并执行 git diff --check，未运行 bash/Python 语法、unittest、编译、正式测试、lint 或任何产品门禁，也未暂存或提交。九路径输入已交 root 与唯一 integration 冻结；后续运行需使用新 manifest，不复用 r3 未修入口或未修 lint 的输入。预期严格 Sources skip 上限仍使原五项焦点 pending 令整体 wrapper 非零，其他域旧债另报；完整分环境通过和脚本回归通过均不能冒称该整体门禁零退出。


第四轮唯一 integration 已实际完成 shell 语法、16 个有限 Python 回归、fresh compile、Node 59 passing、browser 773 passing / 5 pending / 0 failing；新增 12 条 lint 已清除，精确目标仍为独立批准 PARTIAL 的 49 条旧 warning，不能称 lint 绿。真实整体 wrapper 退出 1，最初实际原因是 UA Node localEngineDiscovery 四项 UDS bind EINVAL。后续在同输入、同官方完整单文件与独立结果根下，仅将私有 TMP 改到 `/sdd/tmp/sc-e-*`，socket 实测由原 116 bytes 缩至 50 bytes，31 passing，四个原名均通过。该有界环境对照不改产品，不是整体 wrapper 重跑，也不证明整体门禁通过。原件见 r4/short-private-tmp-control 的 result.json、input-manifest.json、official-node.log 与 bind-syscalls.log。

第四轮 Sources 官方 XML 根保留 skipped=5、只省具体 pending testcase，现比较器漏读汇总的问题与 UA 环境对照分开记录；对应最小修订及当前验收边界见 §9.5。该次方案冻结时只更新本方案，checker/Python 保持九路径上次冻结字节；后已独立轻量规则 16 PASS 并获 root 再授权，下段记录两文件窄修实施。此前“严格门会拒绝五 pending”是目标验收口径，第四轮代码未实际实现该口径，不据整体非零推称它已正确拒绝。


根汇总窄修现已落盘：checker 只在 sources / sourcesNode 读取单个根 skipped 属性，以 `re.fullmatch(r"[0-9]+", value)` 校验后取它与 testcase skipped 的最大值；缺属性为零，其他三域、case_count、失败差集、阈值与名单不变。有限回归保留原 16 方法，新增 7 方法，共 23 方法；新增覆盖根独占 Source5 / Node1 拒绝、临时上限1的双表示不相加、零根不能掩盖子节点、非法根值（含 Unicode 数字与尾换行）、根缺省/零不累加嵌套套件、其他域原根策略和子节点阈值。XML serializer 将换行编码进属性，实际 XML parser 后仍须被完整匹配拒绝，不使用可容末尾换行的 `$`。

该次仅 checker、本 Python 回归和本方案改变；原四 TS、wrapper 与真实基线的冻结摘要保持。作者只静态回看和 diffcheck，未运行语法/23 方法/正式 XML 比较或产品门禁，未提交。唯一 integration 下一步须用修后真实 checker 对未改字节的 r4 五份官方 XML 实际得到 Sources5 超零上限、exit1；该次提前拒绝不抹除并列的 UA4 长 TMP 原件。后续若授权短私有 TMP 的整体 wrapper 重跑，仍须正式完整执行、保留结果，不以此前单文件31通过替代。


## 11. 第五轮实际凭据与收口边界（2026-11-02）

唯一 integration agent:sources_final_integration 接任后实核 E `68e82413c9cfb80c2c644e2b7ba126906abd36ed` 与九路径冻结 SHA；无旧编译/测试 pipeline，未触无关 msgsync Xvfb。固定本聊天 validation.lock 串行执行，Node 为绝对路径的 24.18.0。r5 新私有 TMP `/sdd/tmp/sc-e-insn55e4` 为 22 bytes、0700；XDG/cache 与全新报告根仍在 E 私有 `.build`。未修改产品、官方 runner/config/依赖或基线阈值/失败名单。

- 两 shell `bash -n` 退出 0；正式有限回归保留原 16 项并新增 7 项，实际 `Ran 23 tests`、退出 0。
- 对 r4 未修改的五份官方 XML 逐字复制到隔离结果根、保存来源 SHA 后复读真实 checker，明确报 `sources has 5 skipped testcase(s), above max_skipped=0`、退出 1。旧 UA Node 四项长 TMP 失败仍并列保留在分析中；提前拒绝 Sources 不抹掉旧失败原件。
- 相对 r4 只有 checker / Python / 本方案三路径改变。四 TS、四 JS、localEngineDiscovery 源与产物、官方 Node/reporter、package/lock、TS 与 ESLint 配置 SHA 全部相等，因此没有重复无变化的 compile、direct Node/browser 或 lint。r4 fresh compile0、Node59、browser773/5pending、目标 lint0error/49继承warnings exit1 的原信用与范围保留；49 是独立窄例外 PARTIAL，不是严格 lint 绿。
- 在全新短 TMP 与全新结果根，实际正常完整执行五域入口：Conversation 2970 passing / 5 pending / 0 failing；Sources browser 773 passing / 5 pending / 0 failing；Sources Node 59 passing；UA Electron 1013 passing；UA Node 836 passing / 0 failing。原 UA Node 四个环境失败同入口消失；不把前次单文件31通过当作本次 wholewrapper 的替代。
- 完整入口退出 1，原始末行仅为 Sources 的 `5 skipped` 超 `max_skipped=0`。其根 tests=778/skipped=5，具体 testcase=773/childSkipped=0/effectiveSkipped=5；其他三个域的根 pending 策略沿旧逻辑，Conversation 原5pending并未被本修订扩展处理。五 XML 全无 failure/error。
- 在本次 Sources 两域正式 XML 逐名再核原三项和新增38项控制/行为用例，全部真实 passed、无 skipped；扫描负控证明被测门拒绝受控违规，不宣称旧生产有这些缺陷。测试结束再次核九路径冻结输入、四 JS 与 runner/config 摘要保持。

全部 r5 原件在 `/sdd/tmp/vscode-integration-20261102/sources-clipboard-wave/E-validation/r5/`：`whole-unit-custom.log/.exit`、`whole-xml-manifest.json`、`whole-xml-analysis.json`、`whole-case-proof.json`、`whole-final-receipt.json`、`whole-input-equivalence.json`、`whole-environment.json`、`whole-process-check-before.json`、`whole-actual-commands.json`；快速门与未改 r4 XML 复读在 `wrapper-unit-tests.log/.exit`、`immutable-r4-checker.log/.exit`、`immutable-r4-report-manifest.json`、`immutable-r4-report-analysis.json`、`quick-done.json`。权威可复用命令与路径要求只写[测试与校验](../../docs/architecture/cross-cutting/testing.md#本地自定义五域与严格报告比较)，health-gates 仅引用。

本地实施候选保持 PARTIAL：本主题三项已登记测试失配已运行关闭；49 继承 lint warnings、Sources 五项有焦点宿主待验、Toggle mixed ARIA 仅静态待核、真实默认产品窗口/Engine/Hub、共享接纳与 PRD 整体验收分别保留，不整行关闭 D17。当前同步必要文档并准备精准暂存/文档门；最终非作者 OV、Commit Gate 与 root 正常提交授权仍待，不预写已提交或 implemented。
