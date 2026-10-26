---
title: "D1387 Sources 打开合同源码检查点"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "M01 compile7通过、原38项全过，新增生命周期已释放旧VM但seed文本模型在替换时被resolver回收；现只在该case持有两侧公开refs并补三次load/live断言，生产不动，39green待"
---

# D1387 Sources 打开合同源码检查点

[正式方案](../../plans/sources-open-dispatch-and-conversation-target.md) accepted，独立规则16 C0/I0后于 `133ef4e5cfa06f9905dd83a4570c8d6b0369a317` 单独提交。[真实Git before/C1–C6](d1387-before.md)与两轮Astra已证两个根因；以下是源码检查点，不是after或运行通过。

## M01 显式 Move 来源源码检查点（2026-10-27，J）

原Astra规则16正式报告`3f299c3dc5b18c47209e6ccb23ba40a2fe0765e4`§11已只读核验，C0/I0/M1；native toolbar仅groupId、context菜单URI先/context后、可缺index/非法index拒绝及数字入队前代次边界已实改，并以`265b1fe8e01f88725169696976f6cc463a8b61dd`独立accepted方案提交后才实施。D原真实M01失败保留，父已看原Beta Pane按钮聚焦而Preview为空的图；本段不把源码/静态检查当新after。原冻结src928/native8b4的完整编译与green只属旧冻结身份，不延伸到本候选。

- `sourcesDiffRefHelpers.ts`：typed Pane携原input/group/Pane对象；native从完整args识别明确group/index，缺index仅取该组当时active，非法index/失效显式来源不fallback全局/别叶。入口捕获注册Conversation part对象/sessionKey、严格group/input/Pane成员，ref与close共用此capture；await后关前重核原对象/成员，global焦点改变仍关原live源，替代input/同id组/同key新part不误关。legacy无参global路径及Panel viewTitle clear保留；boolean/stale/void、缺leaf保源和其他异常关闭代数不改。
- `sourcesDiffActions.ts`：实际registered command转交完整参数并透传既有helper结果，不修改官方context位置。`conversationDiffReviewPane.ts`：真实按钮发送来源对象，按input/render/move尝试代次处理局部反馈；move notice复用既有样式但独立节点，不清比较载入或读写notice，clearInput/setInput/dispose失效旧attempt，catch自身异常仍有双catch无unhandled保护。
- 新独立`sourcesDiffMoveSource.test.ts`承载38项业务场景源码，便于唯一lane单独选择，不导入新runtime export：4项真实默认EditorParts/Conversation part、真实Pane按钮/registered command/helper链（global空、无关Preview、native toolbar、URI先行context菜单），A/B同tuple独立input/SCM组隔离、准确两侧与源/根保留；2 native公共helper正控、5非法index、9显式来源负控、6 await关闭复核、非leaf reject及缺leaf异常代数，另10项Pane局部错误/当前成功恢复/旧结果与clear/换input/dispose隔离、false/undefined/stale完成语义。新typed context/result仅type-only import；旧src928是否到业务断言以唯一lane实际重跑为准，首跑夹具失败见下节；真实入口等待原registered command实际settle，旧no-op不等待目标open屏障。真实两侧内容与实际按钮修复仍由D新freeze after证明。
- 既有`sourcesDiffPanel.test.ts`的Preview无unhandled负控适配为命令拒绝后的局部notice绘制异常，仍验证warn-then-rethrow两级catch；临时DOM setter用finally恢复，不污染teardown。原J29项与完整相关套、R1/R2、三owner/slot/finder/既有状态和关闭代数全部保留。

作者实际仅5TS `createSourceFile` AST解析0诊断、ESLint0errors/1既有warning；按rule/message/所在行文本与accepted基线4个既有文件逐条比较added=[]、removed=[]，新测试0warning。`git diff --check`通过；无编译、typecheck、transpile、写out/watch、业务测试或第二窗口。本次fresh文档门禁health 0errors/73warnings，相对同工位accepted方案基线逐条added=[]、removed=[]；generated-status --check与diff通过，status197行。源码SHA256：

| 文件 | SHA256 |
|---|---|
| sourcesDiffRefHelpers.ts | `7e3e913c1e2ed60fe271202a57be85c45d69f855c831da534c74c3c876a847b1` |
| sourcesDiffActions.ts | `fcfb757755ea9266012db87393924598eb948ed165a98bcc24cfbd473548c805` |
| conversationDiffReviewPane.ts | `54daab997ad5006d095ea674a0edb5e2d7d8d29fc367c3c6fa5367ab0fdc3ca0` |
| sourcesDiffMoveSource.test.ts | `70fc4664a2d93e8ee7b5f9b90779a79a38e93fbc125a30efb90358685d6aa3e5` |
| sourcesDiffPanel.test.ts | `bc55199a234cccf409073f9b76138d350196b29bc129e358ba7dd8ae76e91663` |

唯一baseline须先用冻结src928旧生产（三文件不变）配本轮新测试，selector `real Pane registered command`，4种入口均在未移动B/Preview缺失的业务断言red，加载/类型/夹具/timeout不计。新生产后运行整个`Sources M01 move source`套及既有Sources相关完整套/必要全编译；原29项与386套连续性不得丢。正式源码peer与D新freeze真实M01 after待，方案accepted、D1387/M01 open、PRD不升。


### M01 真实入口夹具与 wiring 扫描补修（2026-10-27）

不可变实施候选为`d04697351413f2e83a4745c3ab2b7fc37a03ea0c`。唯一lane实际旧src928配新测试首跑0passing/4failing，四项均在真实SourcesChangesModel构造缺IAgentSessionContext、读取onDidChangeActiveSession时TypeError，未到Preview或关闭业务断言；本次业务旧红为0。J已只读原`/tmp/vscode-m01-old928-red.log`，不将夹具失败计作产品red。Astra正式源码peer提交`88910e7b5da02d75df09dceacc9f3ea54e7e0486`的原报告§12为C0/I2/M0：I1是既有node扫描仍精确要求旧无参command表达式，I2是上述session夹具遗漏；3生产未发现额外确定缺陷。J已git show只读核验该正式报告§12，永久首跑原件在lane提交2df7ff7eda332de5aa8d5edf94e715a5fab78148；不复制他槽报告，本修订正式复读与运行待。

本次仅在4项真实入口构造SourcesChangesModel前stub完整公开IAgentSessionContext（session id、readiness、pairing及两公开事件，未使用的lease入口显式拒绝），仍实际构造真实model、两真实Conversation parts、Pane、注册命令与helper，不换为direct helper。node扫描精确检查按钮runMoveToPreview的双catch、方法捕获原input/严格input类型、窄typed来源的原input/group/Pane与实际command携source委托，并同时保留新方法/旧命令naked-call排除；浏览器unhandled负控、原AcceptPatchbuilder扫描和38项业务场景均保留。3生产和既有Panel测试未修改。

作者实际只做两测试TS的createSourceFile AST语法解析0诊断、ESLint0errors/20既有warnings；相对d046同两文件按rule/message/行文本逐条added=[]、removed=[]。测试SHA256更新为MoveSource `3e559440a02345efa67593097b98f2ee5b1e8b9ef76d553209f8f1cb82786c88`、WiringScan `bfe051c197f7e17df0dcefca79996fc8365afbb6700fd0e4f3fc70b77dea6753`；3生产仍为上节摘要。文档门禁health0errors/73warnings、相对同工位accepted方案逐条无增减，generated-status/diff通过，status197行。未compile/typecheck/transpile/out/watch/业务运行/第二窗口；唯一lane须先重跑同selector的4项旧入口，再新38及原完整覆盖，Astra定向复读与D新freeze真实M01 after待，accepted/open不升。


### M01 第五次完整编译后的类型合同补修（2026-10-27）

原Astra对a222两I定向复读提交`04ea96be19dc57cd128dfbea0206ca539587fb53`的原报告§13为C0/I0/M0，J已git show只读核验。唯一lane随后实际以准确旧src928/native8b4配a222新测试取得0passing/4failing，四项全为`registered Move must open B in Preview`业务AssertionError，无TypeError/加载/API/timeout，registered handler已settle；后续关闭及metadata断言未达，不越报覆盖。原始`/tmp/vscode-m01-old928-a222-second.log`及JSON由唯一lane保留；以上是a222测试身份的历史red，不替代下面修订的实际运行。

正式合源HEAD34a4/src8e6（等于受审a222完整src）实际第五次fullcompile exit1，仅4条M01 TS：Action run缺leaf通知catch未显式return；helper对object使用hasKey不产生kind类型；测试Registry公共getCommand默认void返回导致ICommandService generic与done.complete两条不匹配。J已只读`/tmp/vscode-m01-fifth-native-build.log`的四条准确诊断；失败compile5已真实emit，不当作旧928/native8b4，也不freeze，新业务green未跑。

本次精确补修：Action通知后显式return undefined，保留缺leaf通知和原void/no-op语义；helper用真实对象及Reflect.get(kind)值检查的类型谓词识别窄kind，继续拒绝失效显式来源，不用宽cast，不改ref/close及原关闭代数。真实入口测试通过现有公共CommandService.executeCommand<R>实际运行注册handler，wrapper原样返回result，仅将观察值经runtime boolean/stale/undefined联合检查后完成done；不将Registry默认void强转为Move结果或吞真实返回。真实model/parts/Pane/命令入口与38项业务expected、node精确scan、Panel无unhandled负控和原全部回归保持。

作者实际只做3个改动TS的createSourceFile AST语法解析0诊断、ESLint0errors/0warnings，相对a222逐条added=[]、removed=[]；没有program/typechecker/emit。SHA256：actions `0057a1546f0f77eca716c70ee0a5b13c657e010436d5319eaa335042c3dcfdbc`，helper `84dd59d318a28b8645a132a6861ab82297f6b77d301a52e4fc3011d7914fad52`，MoveSource测试 `86e90709a2ac0453c4b464f404e8cb41cd961963d2578a86b6313367d98a39ca`；Pane/Panel/WiringScan沿a222不变。文档门禁health0errors/73warnings、相对同工位accepted方案逐条无增减，generated-status/diff通过，status197行。作者未compile/typecheck/transpile/out/watch/业务运行/UI；修订独立peer、唯一lane第六次真实完整编译与新38/完整相关套、D新freeze真实M01 after待，方案accepted、D1387/M01 open、PRD不升。


### M01 第六次运行后的 Pane 视图模型所有权补修（2026-10-27）

0da定向peer正式提交`25bf24e8216fffda3060e31794b8d75716b07ff2`原报告§14为C0/I0/M0，J已git show只读核验。唯一lane以其新真实CommandService harness配准确旧928三生产实际重跑0过4纯Preview业务红，随后正式合源bb41/srcd5eca（精确0da）完整compile6 exit0/0TS。新native首次M01为24passing/2failing：23受控及首个真实button empty-global业务本体通过，afterEach报6资源泄漏，另一afterEach为泄漏输出触发Unexpected console output；余14未达，不能称38green。完整Sources11为410passing/2failing，同一泄漏及连带console失败，无新增独立业务断言；J29实际29过。node为23passing/1既有Accept builder扫描失败，新Move双catch/context扫描实过；不改原Accept预期。以上属于唯一lane实际原件，作者只读focused raw，其他结果按lane及Astra正式报告核对，不代运行业务。

Astra独立根因报告`5972836d932ff0cbde50c970b672743e0eee8563`原件§15为C0/I1/M0，J已git show只读核验；父接受其最小局部所有权判断，无新方案。真实Pane把raw模型交DiffEditorWidget.setModel，内部createViewModel/RefCounted初始base没有归属，setDiffModel只保存clone；既有detach/clear widget不能释放悬置base，两个A/B Pane各VM及其store/listener恰为6 leaks，等待tick只清额外prev clone不能修复。该缺口在产品生命周期，不能在test清理私有VM、忽略leak或压console掩盖。

本次只改ConversationDiffReviewPane：在已有异步text refs后的input/token/render/dispose守卫之后，公开createViewModel并登记Pane注册的MutableDisposable，再交给widget显示，中途不加await。共用clearEditors先detach/clear widget，再清Pane自有VM，最后清原/改text refs；setInput替换、clearInput、dispose共用此所有权，modified-only/失败/取消不虚造VM。不改全局widget、Panel、Move完成/关闭代数、三owner路由或共享文本模型。

原38场景不删，另加1个真实Pane生命周期业务用例，总39项源码。通过公共createViewModel的spy取得真实返回对象，只观察其公开dispose，依次验证替换input、clearInput及Pane.dispose及时释放各代VM，spy在finally恢复；不由测试调用VM.dispose，保留per-test泄漏门禁。原双真实Pane同tuple入口继续验证只关B而保留A/根及后续无关Preview，全部反馈/旧完成覆盖保留。新生命周期selector为`real Pane comparison view models release`；旧0da配该新测试应在“replacing input must release its comparison view model”业务断言red，是否成立由唯一lane实际运行，不先记red。

作者实际只做2个改动TS的createSourceFile AST语法解析0诊断、ESLint0errors/0warnings，相对0da按rule/message/行文本逐条added=[]、removed=[]。SHA256：Pane `e40ac060e2cc52e986b5326604858473e2a2128862e158ada7de45ac262e9f2a`，MoveSource测试 `5c0012d0814870c9aff596a764ae3cd0b4029c7d6192766347e3285558ab4f3b`；Actions/Helper/Panel/WiringScan沿0da不变。文档门禁health0errors/73warnings、相对同工位accepted方案逐条无增减，generated-status/diff通过，status197行。作者没有compile/typecheck/transpile/out/watch/业务运行/UI；修订peer、唯一lane新native首入口无leak/完整39/相关完整套和D新freeze真实after待，方案accepted、D1387/M01 open、PRD不升。


### M01 共享反馈夹具的完整 SCM 接口补齐（2026-10-27）

a166局部VM所有权独立peer正式提交`d31d4265bb4d9cb37bbd5105d8c4a2fc666da3c6`原件§16为C0/I0/M0，J已git show只读核验；这仅闭合生产所有权源码，不签运行。唯一lane精确旧0da Pane配a166新增生命周期测试实际0passing/1failing，失败为`this.scmService.onDidAddRepository is not a function`，位于真实SourcesChangesModel构造→共享feedbackPane，尚未创建VM或到替换释放断言，生命周期业务旧红为0。J已只读`/tmp/vscode-m01-old0da-a166-lifecycle.log`；原始log/JSON与163身份恢复由唯一lane保留，不能将此TypeError计作产品旧红。a166尚未正式合源或compile7。

根因是feedbackPane覆盖了SCM为仅repositories的mock，而真实model构造必订阅add/remove两事件。本次仅将该stub改为完整空仓ISCMService literal并用satisfies检查公共接口：repositories/count空仓、两Event.None、getRepository无结果、未用registerSCMProvider明确拒绝；不新增宽cast。未删真实model/禁scheduler、未吞异常，生产Pane VM补修及四真实Move入口/所有39项业务expected逐字保留。

作者系统读取共享feedbackPane余下依赖与SourcesChangesModel完整refresh、Pane订阅/写事实路径：既有connection helper提供phase/snapshot/connected/capabilities及连接事件；session提供active/pairing/readiness/两事件，workspace.getWorkspace由基座TestContextService提供，模型/解析器由基座提供并用真实inmemory模型，diffProvider与interaction已有正式测试服务。空repo不触发provider监听，断开连接且无read hook不调用engine RPC/lease。该核查与原Astra独立核对一致，正式18828520a95670cc4aa212552fb01cbc0929ed49原报告§17（SCM夹具C0/I1）已git show只读核验；未用source阅读宣称剩余反馈用例已运行。

本次唯一测试TS的createSourceFile AST语法解析0诊断、ESLint0errors/0warnings，相对a166按rule/message/行文本逐条added=[]、removed=[]；测试SHA256 `2011e14ecdd055a745f403e480afd00ffb9abfd799d3e9c6b5f249dfcee49df6`，Pane仍`e40ac060e2cc52e986b5326604858473e2a2128862e158ada7de45ac262e9f2a`。文档门禁health0errors/73warnings、相对同工位accepted方案逐条无增减，generated-status/diff通过，status197行。作者未compile/typecheck/transpile/out/watch/业务运行/UI；唯一lane须以准确旧0da Pane配修正test重跑同生命周期selector，实际业务旧红成立后新native及完整39/原相关套；修订peer、freeze和D真实after待，accepted/open不升。


### M01 直接创建 Pane 的组级 progress 夹具补齐（2026-10-27）

fccde完整SCM夹具独立peer提交`1d30f1ff5c67b0717a108a11a5a466665dbc50df`原件§18为C0/I0/M0，J已git show只读核验。随后唯一lane准确旧0da Pane配fccde新测试实际0passing/2failing：已到`replacing input must release its comparison view model`真实业务AssertionError（false !== true），同时DiffEditorWidget初始化报`Cannot read properties of undefined (reading 'show')`，另一afterEach为unexpected gate失败；尚未到clear/dispose。J只读`/tmp/vscode-m01-old0da-fccde4afb3ee-lifecycle.log`核完整栈，本次是1业务断言加1夹具异常的混合red，不签干净纯业务旧红；163身份恢复及永久原件由唯一lane记录，旧复合失败完整保留。

J与Astra独立定界为组级fixture缺IEditorProgressService，不是旧泄漏VM在widget销毁后的次生callback：widget TS404的初始化autorun在setDiffModel transaction中读取构造注入的_editorProgressService.show；真实EditorGroupView在scoped子服务明确注册EditorProgressIndicator，而反馈helper直接实例化Pane没有经过该组scope。未发现可导出复用的Null/TestEditorProgressService，基座TestProgressService属于不同IProgressService；不导入整个standalone注册副作用。本次仅补完整satisfies IEditorProgressService literal，show复用正式emptyProgressRunner，showWhile实际await传入Promise并传播原reject。不关progress autorun、不压unexpected/console、不改生产或expected。

在上节顶层model核查之外，本次扩查widget真实构造及异步/子组件：DiffEditorWidget的context/instantiation/codeEditor/accessibilitySignal来自workbench基座，VM唯一DI diffProvider为显式TestDiffProviderFactory；双CodeEditorWidget的theme/notification/accessibility/languageConfig/features/context/codeEditor/command/interaction均由基座或本fixture供应，diff子组件menu/keybinding/language/theme/contextMenu也由基座提供。clipboard仅用于未触发的内联viewzone复制交互，不是当前初始化show栈；不为未运行路径宣称全覆盖，也不堆未用stub。此核查与原Astra独立结论相同，后续仍须实际运行。

本次仅1测试与3行动文档，生产与四真实Move入口代码区逐字同fccde，39项业务expected与leak/unexpected/console门禁不变。唯一TS AST语法0、ESLint0errors/0warnings，相对fccde逐条added=[]、removed=[]；测试SHA256更新为`83653d3619affa62557b4c431cba6000cbe1e329943826c411fd9ca85695f75c`，Pane保持`e40ac060e2cc52e986b5326604858473e2a2128862e158ada7de45ac262e9f2a`。文档门禁health0errors/73warnings、相对同工位accepted方案逐条无增减，generated-status/diff通过，status197行。作者未compile/typecheck/transpile/out/watch/业务运行/UI；修订peer及唯一lane准确旧0da同selector重跑、新native完整39/相关套与D新freeze真实after待，accepted/open不升。


### M01 生命周期 seed 文本模型的夹具保活（2026-10-27）

64a4进度夹具独立peer正式提交`e5c25b4b33853e8d6b9da9476adfbe589e24a0b9`原报告§19为C0/I0/M0，J已git show只读核验。唯一lane以准确旧0da Pane配64a4测试实际0过1纯释放业务AssertionError，无TypeError/加载/API/timeout/afterEach独立失败；随后正式合源srcab952（精确64a4）完整compile7 exit0/0TS。首次新M01实际38passing/1failing，原38（含4真实Move和所有反馈）全部通过，无leak/console/TypeError；新增生命周期firstDispose.calledOnce已过，随后VM创建数预期2实1，clear/dispose未达；完整J11实际424passing/1failing，仍同一计数失败，无其他新业务失败。J已只读`/tmp/vscode-m01-seventh-M01-focused.log`核此准确边界，不将原38通过写成39green。

J/Astra独立读完整setInput/renderDiff、ResourceModelCollection及TextResourceEditorModel确定是生命周期fixture seed寿命，不是观察过早或index gate：setInput本身await完整renderDiff；clearEditors释放两侧最后resolver refs，真实collection异步回收。下一render先await重取original，只能撤销original的待销毁，modified在该await期间被TextResourceEditorModel.dispose强制destroyModel，之后modified无provider不能重建，renderDiff catch false，故第二VM未创建。store.add(seed ITextModel)只登记测试最终dispose，不是resolver引用保活。父接受原Astra判断，限定修fixture而不改生产、不sleep/改计数为1。

本次只在该生命周期case持有两侧真实公开ITextModelService references跨三次open，finally先dispose Pane，再释放夹具references；seed原由外层test store在其后清理。helper仅为传入case专用store的调用在首次open前取得两侧refs并返回，先登记Pane disposer再登记refs，原反馈调用不持额外refs；不访问或代清产品私有VM。原3次VM创建数及替换/clear/dispose释放断言全部保留，另断言每次getComparisonLoadState为ok、每阶段两侧文本模型未dispose，验证Pane释放自己的比较VM同时不销毁夹具仍持有的文本。原4真实入口与其余38场景源码区保持，production完全不变。

唯一改动TS AST语法0、ESLint0errors/0warnings，相对64a4逐条added=[]、removed=[]；测试SHA256 `eb81299cb0e6b170b888aa2e57ee5655d23613236b7a41c2d908c9132524577d`，Pane仍`e40ac060e2cc52e986b5326604858473e2a2128862e158ada7de45ac262e9f2a`。文档门禁health0errors/73warnings、相对同工位accepted方案逐条无增减，generated-status/diff通过，status197行。作者未compile/typecheck/transpile/out/watch/业务运行/UI；修订peer、唯一lane本fixture身份的准确old0da生命周期red及正式新native完整39/相关套、D新freeze真实after待，accepted/open不升。

## 宿主观测与 Sources 重叠补修（2026-10-26，J）

D/Astra确认完整tuple仍可能被旧active宿主遮住，D再指出事件没有operationId会把R2的同tuple input误记给pending/no-op的R1。本轮先按规则16完成两轮只读审查，正式报告`7c84e0167e3f5fef3db1e7dea5cd6f96ca3393c4`最终C0/I0、两Minor实改，并以`bf50c66b8b970a4e29a1e92f0d3968232e2d6987`独立提交accepted方案后才改源码。原`65d2288`模块357过/虚拟TS0仅为父转交的唯一车道历史运行，不作为以下新边界的green。

- `sourcesChangeEntryOpen.ts`只在单次SCM dispatch期间订阅公开`onWillOpenEditor`，事件只给候选。await后验证`getGroup(id)`仍是原对象、input未dispose且是完整身份的真实组成员；接受组模型保留的规范实例时使用`actual === event.editor || actual.matches(event.editor)`。唯一有效候选优先，有相关will却未落实或不唯一时不猜；完全没有相关will才扫描全部parts/groups的全部tabs取唯一可信fallback，不裸用active、重解析column或造组。
- 同一`IEditorService`的模块内WeakMap registry在listener/dispatch前同步登记。API key区分file/diff及完整有序URI tuple（含query/fragment）；key、matcher和实际dispatch使用同次同步捕获的command id/args。相同API key重叠双方sticky ambiguous；custom是wildcard，与同服务全部活动Sources委托冲突。另一方先settle不解锁仍pending者，活动歧义记录继续与第三调用冲突；每次finally清自己的登记和listener。观察范围止于dispatch await及紧接的同步宿主核对，先清理再开始后置动作。
- 歧义不阻断或串行dispatch，只跳过后置identity、新input pin和replace close；void仍true，reject原样传播。custom newTab的旧preview预pin窄例外保留，包括no-op/reject/另组成本，不回滚。仅覆盖Sources间定义的重叠，不声称非Sources同tuple外部打开或任意窗口并发因果安全。
- 新增29个用例源码：4项file/diff×newTab/replace的官方handler、真实默认`EditorParts`/`CategorizedMainEditorPart`、真实`EditorService`与组模型，A保留同tuple旧input且active，provider指定B inactive/activation:PRESERVE/pinned:false，B不在visible panes仍准确记身份，重复reveal保留规范成员，diff后续ref准确；2种同tuple双方settle顺序、发起组replace零close、三调用传递、4项custom wildcard组合、5项完整key/不同服务隔离、reject清理后顺序恢复；8项will未落实/disposed/移组/同id换组/多host/多fallback/单inactive fallback/规范成员，以及custom准确后pin、无组裸active负控、command/args变化的同次捕获。控制并发用公开依赖、事件与受控Promise，没有跨await保留ServicesAccessor或改Sources私有状态。
- 真实宿主测试只给A活动pane注册无行为覆盖的`DiffEditorInput`子类与既有轻量测试pane；B仍使用官方真实File/Diff input，identity/matches/组模型不改。teardown、输入/监听disposable和Memento清理保留per-test leak门禁。旧背景API/custom正例与workingTree→Conversation/Panel夹具补合法组成员，原严格SCM引用、准确group与缺信息负控继续保留。

本轮J实际检查：最终3TS仅`typescript.createSourceFile` AST语法解析均0诊断，无program/typechecker/emit；定向ESLint 0errors/29warnings，按rule/message/所在行文本与`bf50c66`三文件逐项比较added=[]、removed=[]；`git diff --check`通过。源码SHA256：helper `45cf6d831abda7efd46ae2121b520c5f142282caa079f0e913da8312bf73741a`；Changes测试 `45cf248ffa6588cefeb10bc1c36e371e5bf7d256549481ac56f42a3fcc7b2be9`；DiffRefHelpers测试 `f07dc9fe157ce53387f58fd08f0a5ae2ccef1fcc480aae9ca59f60716fb479ce`。没有编译、typecheck、transpile、写out/watch、业务测试或启动窗口。本次fresh文档门禁health 0errors/75warnings，与本工位bf50独立方案检查点逐条比较added=[]、removed=[]；既有未合入D宿主报告链接仍在原75中，不复制他槽或借父工位计数。生成状态`--check`、diff通过，status170行。

唯一merge须将旧`65d2288036fdad74ab607e231d3db758fa397aa8`生产与本轮新测试配对：宿主业务red selector `delegated host official`；并发业务red selector `Sources overlap same tuple .*settles first`，必须由实际旧身份误记断言失败而非scan/加载/类型/timeout充数。之后只刷新本轮生产，运行`delegated host|Sources overlap`全部29项，再完整原相关套件与语义检查；原R1/R2、14根因与其他完整覆盖继续保留。新源码独立peer与非作者默认编辑器真实Git三owner after仍待，方案accepted、D1387 open、PRD不升。不得把本轮WIP或原357过当本次集成结论。

### 监听清理断言调用补修（2026-10-27，J）

实施提交`1ac1fdc4ae2db39f4e2c3a49e014bcc629b40419`的D独立codepeer为C0/I0/M1，正式报告`8b2480351817d795af60b69d1b962c85dc5c2123`中的`d1387-host-observation-code-review.md`已由J只读核验，未复制他槽文件。M1与唯一lane反馈一致：新增测试8处将公开Emitter方法`hasListeners`作为函数对象比较false；这会污染red并使green必红。本次只将8处改成实际`hasListeners()`，全部listener释放、metadata、准确SCM引用与调用trace断言保留，29项新增与原全部回归不删改，生产文件不变。

父转交唯一lane旧65d生产配1ac测试已得4项official host纯身份业务red（0过/4败），无需因本夹具补修重跑。J只读`/tmp/vscode-d1387-host-overlap-old65d-red-overlap.log`确认并发两项0过/2败同时含旧identity误写为g1/g2与`[Function: hasListeners]`差异，因此不把这次混合失败计为两项纯业务red；唯一lane须仅重跑修正测试的两完成顺序旧red，再最终新生产29项green/原完整相关套/语义。J没有运行业务测试或写out。

本次实际静态检查：测试与生产helper AST语法均0；测试ESLint 0errors/29warnings，相对1ac逐条rule/message/所在行文本比较added=[]、removed=[]；diff-check通过。测试SHA256更新为`02a6263e06688776dd5b86225857a1247624641c5f74ab6a804bfc2a1109dd3d`，生产helper仍为`45cf6d831abda7efd46ae2121b520c5f142282caa079f0e913da8312bf73741a`。未编译、typecheck、transpile、out/watch或启动窗口；本次文档门禁health 0errors/75warnings，与1ac工位记录逐条无增减；generated-status/diff通过，status170行。方案accepted、D1387 open、PRD不升，新生产运行与非作者真实after仍待。

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

### 测试类型与既有合同夹具补修（2026-10-26，J）

父转交唯一merge虚拟noEmit的六处新测试诊断（`/tmp/vscode-d1387-89f-virtual-noemit.log`）：三个`getPart(IEditorGroup)`超出真实重载、一个Conversation root可空、两个官方diff DTO resource可空。J只改测试为精确group id及显式root类型/resource非空断言，保留准确组、根不可替换和完整两侧URI验证，没有宽cast或production/config修改；语义诊断是否消除须唯一merge复核，J未运行typecheck。

父另报告wiring 22过/2败（`/tmp/vscode-d1387-89f-wiring.log`）；Review error-tone扫描仍钉旧的两参数调用。本次对齐当前`setStatusMessage(..., true, 'open')`，保留错误色与非错误notice断言，并在既有“Review alternate API rejection then public Open Selected void success clears only its open error”业务用例显式断言真实拒绝状态为error tone。另一条Accept patch builder禁parse失败的生产路径本主题未改，留唯一merge精确基线核对，不修改或弱化该扫描。

独立九套248过/1败的父报告（`/tmp/vscode-d1387-89f-independent-nine-electron.log`）定位到“preview opened from workingTree keeps that group when the same URI is also staged”custom夹具只有sourceUri。本次给workingTree/index分别补真实有序multiDiff双侧，index original特意不同；仍打开既有DiffEditorInput，保留后续move到Conversation/Panel的workingTree和准确scmResource断言。它使用当前已签收的成对身份合同；相邻无open record、两组同URI的负控保持不猜group/resource，没有把实际合法单侧custom一概宣称可归属。

J实际只做五TS AST语法解析0错误、ESLint0错误/51警告；按rule/message/所在行文本与`4f7e49d`逐项比较新增0、消失0，`git diff --check`通过。生产未改，唯一merge运行/语义检查与宿主归属新Important仍待；accepted/open与PRD状态不升。

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
