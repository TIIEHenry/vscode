---
title: "Engine IPC owner UI 接线验证"
type: reference
status: accepted
phase: M7
updated: 2026-10-28
summary: "S2独立C/F树最终新200/133全过、两原项目noEmit0；lint C0e4既有w/F0e0w，首失败保留，主题提交与产品集成待"
---

# Engine IPC owner UI 接线验证

## 最终结果与边界

| 独立源码树 | 最终旧生产＋同批新测试 | 最终冻结新生产 | 原项目noEmit | 定向ESLint |
|:---|:---|:---|:---|:---|
| C a3，HEAD `7821dea6`＋UI WIP | 200：117过、83业务红 | 200全过：198业务＋1 current源扫描＋1官方meta | 0诊断 | 6TS，0errors／4原字节既有warnings |
| F a2，HEAD `a99b2bfc`＋UI WIP | 133：93过、40业务红 | 133全过：132业务＋1官方meta | 0诊断 | 2TS，0errors／0warnings |

这是两棵独立C/F树的验证，不是组合树或产品merge验收；计划仍accepted、PRD-025不升级。最终源码窄审及各次补修均独立Astra C0/I0/M0。C a1六条测试类型失败、F a1两项layout夹具失败、C a2新增lint问题及分类更正均保留原件；不以最终绿覆盖首失败。旧红的首断言边界见下文：C多项先卡缺owner，F两count项未进入重入，源码扫描也不算raw生产业务证据。

C最后quality于20:56:07 UTC完成、F于20:49:09完成，全部owned进程组quiet、双锁释放；父20:57 UTC明确提前归还唯一车道，S2运行授权关闭。接下来仅Python证据/文档与另行协调的主题提交；外部产品merge `64934a`／src `3dc1205763451e60e70c1a8a84465613990aa526`仍hold，未移交源码。

## 归档与输入重建

最终a2封包及纯Python重建经独立Astra复核 **C0/I0/M0**，下列五文件在C/F使用同路径同字节，随各自主题提交；它们不改变两独立树的验证边界。

| 文件 | 字节数 | SHA256 |
|:---|---:|:---|
| [运行原件归档](ipc-ui-runtime-artifacts.tar.gz) | 24,857,106 | `4876b7ef0fa17cd78ff99a5afec57d10e8438cba449d43a66f2754a3aadc69f1` |
| [归档清单](ipc-ui-artifact-inventory.json) | 588,802 | `5979fcb8f5eecec3fb3760cfdd0e2989b7c91fe61c234178d899af6092414a7c` |
| [执行身份与结果索引](ipc-ui-execution-identities.json) | 294,138 | `83d4cfef667a4cc342571d1ffeb5cd33e902debfae9c851476fd08a01dfeb49d` |
| [输入重建脚本](ipc-ui-replay-inputs.py) | 11,083 | `9253d45908ed79a4f1d5a9ab6262956b19f1ec5f811907512b9e01f781ef73fc` |
| [实际解包与重建核验](ipc-ui-replay-preparation-check.json) | 8,702 | `d645cdb002c2f0dd22d06364a708efca26d8bee8a56d0bf6a788714d8fffa1c4` |

包保留C a1/a2/a3、F a1/a2全部五attempt的原JSON、日志、contract、资格分类、source/out及依赖身份、历史token与车道释放记录，另含准备脚本版本与静态输入。原25,342文件共519,497,279字节逐项清点；仅排除1,156个临时profile/TMP/XDG/npm缓存文件，共33,170,526字节，每项仍留原路径、大小、SHA与理由，私有原件未删除，npm日志/崩溃/报告不因缓存排除而丢弃。23,872份source/test闭包快照按SHA去重为2,422个对象、32,020,318字节；314份原审计文件保持原字节，配映射和元数据共2,748个regular归档成员。映射保留历史绝对路径与每份snapshot身份，不能把content去重理解为只保留最终一次。

C验证时方案原字节 `65e43cc2d7a0b99ac74dd6bb9d5763a7dc80dfd2f534de7cbfe9eba2bc078d71` 已真实保存，与验证后方案 `e3a616f3073135df2ff98108b12c50ed09c50fe0bbc43fc6f3db7c97ffe679a5` 分列。F验证时方案 `d9ad6cff4600ed56763c74683309988151c0f741950b47ecfe5b9011456839ac` **只存历史hash，没有原字节副本**，没有用diff重建冒充原件；验证后方案 `c49afc6937d733b3fb3b7b9982d13ade94ca8e3808fb5f41e1db9c9bc5da3f82` 另存。此边界不影响已完整保存的runtime源测快照。

从本证据目录运行以下命令，两个destination须为仓外现有真实父目录下尚不存在的新目录；示例路径用过后应换新名字：

```bash
rtk proxy python3 ipc-ui-replay-inputs.py extract --archive ipc-ui-runtime-artifacts.tar.gz --expected-sha256 4876b7ef0fa17cd78ff99a5afec57d10e8438cba449d43a66f2754a3aadc69f1 --destination /sdd/tmp/new-s2-bundle
rtk proxy python3 ipc-ui-replay-inputs.py verify --bundle /sdd/tmp/new-s2-bundle
rtk proxy python3 ipc-ui-replay-inputs.py prepare --bundle /sdd/tmp/new-s2-bundle --destination /sdd/tmp/new-s2-inputs --attempt all
```

实际核验已逐SHA验证2,748归档成员、完整恢复23,872快照，并生成五份 `runtimeAuthorized=false` 的派生manifest；历史raw manifest原字节保留。脚本只用Python标准库，不运行Node、历史runner或Git，不写out、不取锁、不授权运行；解包/prepare会写指定的新私有目录，verify只读。依赖包与Electron资源记录实际身份，未打入完整可执行依赖，未来runtime replay须另核依赖、资源与唯一车道并重新授权，不能复用包内历史token。

首a1封包预审发现destination仅排除out/.git/node_modules仍可落到仓内；a2在任何mkdir/open前检查字面与resolve路径全部祖先的 `.git`（目录、worktree文件、符号链接marker），六项真实主仓/C/F/符号链接目的地负例均拒绝且零目标创建。a1封包私有原件保留，最终交付只用上表a2。归档source快照用于审计和仓外输入重建，不作C S2→F源码同步、组合树测试或产品集成证据；S1原归档保持不变。

## 文档门禁与主题提交边界

两树分别执行 `rtk proxy python3 scripts/generate-docs-status.py`，均exit0、already up to date、零生成变更；`rtk proxy python3 scripts/check-docs-health.py --format json` 均exit0、0errors，frontmatter与generated检查均0。C为46项、F为73项本地断链warning，每一条raw链接均已存在于各自HEAD原文，本轮未引入；本轮定向本地链接及artifact/anchor检查的新增或改动失败为0。各有一条触及requirements的旧外仓断链，原文与来源保留，不以0errors称全仓无警告。

C/F当前status为182/184行，均低于200；两自有方案与PRD-025仍accepted。7个无分支历史差异的公共docs/JSON及5个归档产物共12路径在C/F逐字相同；status、证据INDEX、看板保留F独有原段和旧Skills入口。S1七源测逐字等固定7821，最终C六TS、F两TS逐字等各自已运行的最终snapshot，未复制C S2源码到F。

本次主题清单为C22路径、F18路径：各自源码＋测试＋自有方案＋必要公共docs/evidence一并提交。`git diff --check`已通过；暂存仍空、HEAD与index原字节未变。适用的commit hooks不存在，全部Included无clean filter、无working-tree-encoding/eol转换，文本源无CRLF；未运行hook或filter。主题提交需外部显式交付Git/common metadata窗口，届时逐路径stage并核暂存源测等于上述runtime pins，不以计划或时间到期代替提交或产品合入。

此次收口只运行Python文档脚本与只读核验，没有Node、测试、out刷新或新运行令牌；D1392既有文档单测失败未复跑。完成父记录后只复核实际修改的文档与最终清单，不重复S1/S2运行。

## 固定依赖与范围

平台合同固定为C `7821dea60cf64fd35f1c998e5a015ee884ab336a`，经F真实三路依赖merge `a99b2bfc4b94aa157ed62d957844344ce810e82e`接收。平台七源测文件在本阶段保持不变；S1完整602、原项目noEmit及lint通过只证明[S1共享层](ipc-shared-verification.md)，不作本阶段UI运行证据。

| 域 | 源码范围 | 旧生产基线 | 当前职责 |
|:---|:---|:---|:---|
| C | Providers/Models、Composer真实UA模型目录、Overview，及三个相关browser测试文件 | raw `2f35686b611c60355c42d58a11c2e6d8638ba7cb` | 开始owner贯穿dialog/confirm/preview/rename/import/读回，固定取消消费，普通读取与写门分开 |
| F | Skills UI与同域browser测试 | raw `2b604cb9cff686eb1b47e7b54f45007e42e304c0` | 四RPC owner、目录/选择/恢复/canonical链，取消只读保稿、撤CAS授权与独立token |

源码实施由各域子agent独占；父只调度、决策协调和公共文档，唯一executor负责运行及Git。计划仍accepted、PRD-025未升级，产品merge源码未移交。本阶段未修改proto或新增引擎RPC。

## 首冻结源码审查与撤回

C首冻结为三生产、三browser测试及自有方案，静态新增67项；F首冻结为两源测及自有方案，静态新增40项。这些只是静态用例数量，未运行。C既有65用例保留；一项missing-owner写入口用例改为先挂载后撤owner以继续命中真实按钮，另加初次missing-owner读覆盖。F既有89及原26新增回归正文、选择恢复幂等判断与原2b逐字保留。

Astra独立只读检查了两域各自冻结SHA及平台七SHA。C首审C0/I0/M0，随后F首审发现Important I1，交叉核C确认同类路径；C追加结论与F首审均为**Critical 0 / Important 1 / Minor 0**。C首轮C0/I0只保留历史，两首冻结均撤回最终候选资格，不能据此前结论进入运行。

I1触发：已显示A目录仍ready，published snapshot quiet变为B或同引擎新link；用户此时点击旧行。C的Edit/Clear/Delete/Toggle/Test、F的toggle若重新捕当前snapshot，会把旧A数据与B owner一起发给main。S1对这个B owner会合法通过，调用者却已改绑用户看到的目标。

最小补修限定各自UI：写门及动作capture必须匹配**已应用目录owner与当前可读owner**。目录发布先撤旧行监听和写授权，不能在旧rows或同步计数通知仍可重入时提前挂新owner；渲染/通知后重验generation与owner才开写chrome。补异引擎、同引擎新link的旧行零RPC和正式新目录恢复。普通读取独立于写门，初次loading与显式恢复仍可读取。其余已审的取消/草稿/token/三态反馈不得弱化。

F还把选择读取绑定到已应用目录owner：同步scope优先，否则沿所属catalog owner，queued selection也不能重捕新快照给旧行改归属；owner trace核对每次info，不假定只触发一次。

## 执行状态更正

2026-10-27 20:03 UTC父核实两补修子任务已completed：此前send_message仅排入收件箱，并未启动新的执行，原‘正补修’进度不准确。随后分别用followup_task恢复执行；20:07 UTC实时列表确认C/F均running，两域分别明确回执本turn已开始编辑。此前期间没有补修运行成果，不能由消息送达推断执行或完成。当前仍仅限定UI源测与各自方案修改，无Node、out或Git refs操作；新冻结及审查尚待收取。

## 既有兼容与验证约束

C写成功后的私有读回区分applied、failed、discarded及generation：Provider普通列表失败只显示原列表失败；Model已完成写可与普通list failed并存。结果归属门独立于含ready/empty的canWrite，不为显示成功把failed升ready。固定取消/失代不显示旧成功，也不误报普通写失败；旧pending不建立跨owner全局锁。

F取消必须显式识别raw CancellationError或IPC重建的Error，在renderer仍A时撤CAS授权、只读保留dirty/空串/inflight当前正文，不自动刷新/重试，不宣称服务器未写入。旧read先判generation/selection、旧save先判token，旧取消/finally不扰新保存。Create/toggle成功→list成功→晚info取消应最终撤回Created/Updated，普通info业务失败保持既有Updated语义。

两域新测试对owner仅type-import，其他runtime引用在各自旧基线已存在；按首冻结只读审查可用原旧生产配新测试取得业务红，不把新helper混入旧生产。补修后仍须重新核最终闭包与字节。Electron官方runner支持grep；其Errors会忽略Canceled异常，取消消费须直接await正常resolve或DOM局部无泄漏观察，并核实际正文/按钮/请求/反馈，见[测试规范](../../../docs/architecture/cross-cutting/testing.md)。

执行方案复用现成`.build/electron/code-oss`和官方`test/unit/electron/index.js`，入口/binary/资源身份记录，profile/crash/TMPDIR/XDG/npm缓存私有；不触发prelaunch写共享资源。静态准备在`/sdd/tmp/vscode-expected-owner-s2-20261028-preparation/`，尚无新运行令牌、Node/输出写/测试结果。两域I1补修重冻结及独立窄审后，父重新协调唯一车道，才由executor运行原基线业务红、最终新套件及质量检查。

## S2 driver只读审查

20:10 UTC Astra在实际v7 assembler发现Important：oldGrep被硬编码为`expected owner:`，F新套件名`expected owner IPC cancellation`并不匹配，会选零业务用例。当前driver仍未执行，不存在可采信的旧红。父采纳缺陷并选择完整旧受影响文件（C三、F一）取消grep，最终manifest须记预期用例数并与官方JSON实际计数核对；修正由唯一executor承担，静态复审和新令牌前仍不运行。

同轮第二Important：v3只等待主child，主进程正常退出或timeout后退出时仍可能留下本次process group的孙进程，记录lingering后就会抛错并释放锁。父采纳为本次进程组有界TERM→KILL→复查，保留原exit/timeout和清理记录；不杀无关进程。只有本次组确认安静才能称车道归还；若仍残留，中止后续并明确告知外部车道未归还，不能靠锁状态推定安全。

Astra完整静态结论为Critical0/Important2/Minor2。两Minor也采纳：Composer真实current源读取单列用例全名、实际路径/SHA和current-frozen角色，由runner检查；官方JSON reporter、stats-collector实际.js与必要本地依赖补显式身份，候选解析支持.js。20:11 UTC正式恢复唯一executor做新版本静态补修，保留v7/v3原件；不得Node语法检查、out或Git refs操作，源码最终freeze和新运行窗仍未具备。

## I1补修静态进展（未冻结、未运行）

C已实际写入16项I1回归：六类旧行动作×异引擎/同引擎新link共12项，各含新目录后的真实恢复；Provider/Model各两项计数观察重入/quiet换代，共4项，检查全部旧行与工具栏均零写及零对话/预览/确认。原67新增不变。作者首报完整三文件为ProviderModel140、ComposerCatalog39（38业务与1current源扫描）、Overview21，共200项声明；父与executor交叉发现历史browser65已含global meta1，不能直接当文件基数，已要求作者按声明与参数循环重新核数，未把200固定为manifest。最终SHA、静态计数、独立复审及实际runner计数尚待。

F已实际写入4项I1回归：静默异引擎/同引擎新link旧行DOM与hook零RPC及新目录恢复，计数观察中quiet再换owner或nested Refresh均丢弃旧候选。原40新增与既有选择幂等判断保持。作者静态最终为132项业务（历史完整89含meta1，故88+40+4）、官方meta另1；生产在目录与计数通知全程撤owner，通知后复核generation/owner再发布，行chrome不再splice触发额外读取。最终freeze与窄审仍待。

C逐声明与外层参数循环复核已更正：Provider139业务（原64+S2原59+I1 16），ComposerCatalog38业务+1current源扫描，Overview21业务；三文件同run为198业务+1source-scan+1官方meta，预期官方总200。历史完整65仍为64业务+1meta，原记录不改。静态声明与runtime总数明确分开，实际结果尚未运行。

## F二次冻结

F在20:16 UTC实际完成3自有文件二次freeze，父Python独立复核3个SHA一致，Astra只读I1窄审已正式恢复。HEAD仍`a99b2bfc4b94aa157ed62d957844344ce810e82e`；132业务+官方meta1仅为静态预期，未运行，未更新out或Git refs。

| F文件 | SHA256 |
|:---|:---|
| `browser/engineSkillsSection.ts` | `3408c37ab2b9920c51e2ad1491626a4879c8d356860ced1d46c174bbe7de862e` |
| `test/browser/engineSkillsSection.test.ts` | `e4f2d3c58713a472d3d397abb83b806b5672c3049a5d183b09ec91301b943505` |
| `dev/plans/skills-disconnect-draft-recovery.md` | `d44d79061cbc9b1385a74bfbb3ae276b8ac1caef080b6926bab3a22fa6da548b` |

源测短路径位于`src/vs/workbench/contrib/conversation/`；原26/业务88与原40新增正文、选择恢复幂等及S1共享七路径由作者静态确认保持。当前未取得源码窄审通过或运行资格。

F二次冻结独立Astra窄审已得Critical0/Important0/Minor0；确认目录写门、count/选择通知窗口、renderer直接更新chrome、普通reads与cancel/draft/token/CAS/canonical均保持。结论仅为静态可进唯一验证，未作运行通过。

## C二次冻结

C在20:18 UTC实际完成3自有文件二次freeze，父Python独立复核3个SHA一致，Astra独立I1窄审已正式恢复。HEAD仍`7821dea60cf64fd35f1c998e5a015ee884ab336a`；其余Composer/Overview四源测及S1共享七源测保持首冻结/固定依赖SHA，作者diff-check0。静态199声明+meta1预期总200，未运行、无out/refs变动。

| C文件 | SHA256 |
|:---|:---|
| `browser/engineProviderModelSection.ts` | `755bb16570c205624256e9c7cffd5b5ee976312070d3a2fc31754de99ffbddf4` |
| `test/browser/engineProviderModelSection.test.ts` | `df236ea6a678f549e906dba549b884077f9206b28bb41ec100738ea10cafac9b` |
| `dev/plans/engine-write-ownership.md` | `ce0dab92fd7f4c3600fb90fd5f98eefe52236d861bba9dee62d6351603344aae` |

源测短路径位于`src/vs/workbench/contrib/conversation/`。正式C窄审尚待，首冻结旧C0/I0与追加I1均不当作当前通过结论。

C二次冻结独立Astra窄审已得Critical0/Important0/Minor0，确认分pane目录owner、旧行原owner、工具栏、count/DOM重入、generation与写后结果门。C/F均静态可进唯一执行者验证；父已授权executor在新attempt做Python静态最终输入装配及manifest，driver v8/v4仍须窄审，独占Node窗与运行token尚未授予。

20:21 UTC executor回报新v8/v4已写并Python AST通过，原v7/v3及初版新稿均保留。已落完整旧文件无grep、业务/source-scan/globalmeta计数门、原始JSON先留档、own process group正常/异常/timeout统一有界TERM3秒→KILL3秒→复查及独立laneReturned、current源scan前后校验、mocha reporter实际文件与本地require闭包。开始新freeze-a1静态装配最终C/F manifest，所有runtimeAuthorized仍false；Astra对最终新脚本的窄审和父运行token尚待。

## 最终静态输入与driver窄审

新v8/v4及最终C/F freeze-a1输入已封，父独核assembler/runner/transpiler/AST及两manifest共6个SHA。Astra最终静态窄审Critical0/Important0/Minor0，先前I2/M2均已修；确认完整文件计数门、原JSON先保存、own-group清理与laneReturned、current源扫描及reporter实际闭包身份。每域93 controls、118包身份、75 Electron资源；C旧新闭包各2408，F各2356。C总200/F总133均为待运行预期。

| 输入 | SHA256 |
|:---|:---|
| assembler v8 | `2d08361b485a8d14fa2cbae573dfc396dc52ad6d652e665ee27edc40e9d084c5` |
| runner v4 | `156df85032d7b873807da7fdf8adef8ae6af046362b8cd9b65a53907a25748b6` |
| transpiler | `8addb85099b7b98b82147ab9eb76065aa07ddc027407a4d2ebe405ca72378e96` |
| C source-frozen manifest | `582cf6b58a9ded1102aabfac65cfb178ff756d22b76947bf77c7a63cd16dbd26` |
| F source-frozen manifest | `2da02a96caf42a0a5995e44a27cc72d84aa9aa7f9c73e389652f708d19224eb0` |

原始manifest均runtimeAuthorized=false，尚未发token。实际协调独占运行窗后才另建授权副本（保原件），以授权副本SHA及runner SHA绑定新令牌。Astra没有运行driver或实测清理效果。完整静态汇总在`/sdd/tmp/vscode-expected-owner-s2-20261028-preparation/S2-v8-v4-final-static-assembly.json`，后续随runtime证据封装。

## 首次S2运行授权

20:26 UTC外部明确同意现起至20:52 UTC C/F唯一Node/private-out窗；外部仅可继续Python文档验收与自己的merge文档commit，common Git对象/merge ref及父mtime可变，C/F HEAD/src/out与7shared不动。父静态核我方guard不冻结common Git或foreign refs，兼容成立。只签C old阶段令牌，新/quality/F均未授；实际fresh进程、双非阻塞锁、容量与全部身份仍由executor开跑前核验。

C授权副本`runtime-authorized-manifest-a1.json` SHA `f336b8c2f82c910427262ac2a42c250bcb8223f42f1119b02f8c39a9237c9357`，原source-frozen manifest逐字保留，token绑定该SHA及v4 runner SHA、只准old并到20:52过期。正式followup已启动唯一executor执行C old，须收实际运行回执与结果，不能把授权当已跑。旧结果父鉴别后另授new；此刻没有S2测试通过声明。

## C old实际结果及父鉴别

20:27:33 UTC C old实际完成：transpile0，官方完整200为117过/83失败/0pending，计数合同valid，current源scan与official meta均过；source/out stable，两个owned group quiet，laneReturned及locksReleased均true。父读取原JSON、contract及全部83项实际/期望，均为本轮expected-owner业务AssertionError，fixture/load/infrastructure/source-scan/meta失败均0。官方JSON SHA `34ebc13ee42c6c2f64da4342c3607de2987ee676f621f00c5687fbe8f69af75f`。

业务红体现未传原owner、普通读取缺owner仍派发、旧结果覆盖、旧行写/确认及count窗口操作chrome。取消标题中多项首先卡在missing-owner断言，不能宣称旧版本已到达后续取消消费断言。源码扫描用current源，虽通过也不算raw2f业务证据。

父资格`old-qualification-root-a1.json` SHA `3801a528021114f769b8b1a20702bd4702488822bc8988d7528d699a52943719`，20:28 UTC另授C new+quality token：先完整新200，只有完整绿才原项目noEmit与6份UI TS lint，仍expire20:52；F与Git refs未授。新结果尚待。

## C new实际结果

20:29:45 UTC C new完整200/200 passing、0失败/0pending，contract valid，198业务、1current源scan和1official meta均过。父直接复读官方JSON/contract/completed确认，官方JSON SHA `5a721c06fa6bd5c6e9941dab7ae27c99da1a6ab9b78800229ce184f0767a6290`。source/out stable、两个owned group quiet、laneReturned=true。实际已按条件开始C quality，原项目noEmit与6TS lint结果尚待，不称全仓编译通过或产品集成完成。

## C quality首失败与两域串行调度

C a1原项目noEmit实际失败6条、20:30:22 UTC停并归还双锁/车道，lint未跑：ComposerCatalog三条TS2322为snapshot capabilities缺失/可能undefined；ProviderModel测试三条TS2339为method/owner被收窄为never。原始`stage-quality/noemit.log` SHA `6252cf6c26113b603fbe7be36bedea26575ae4432780212497bdb563dd56a675`，C new200过仍为该轮事实，但不能称quality过。C owner已正式恢复，仅补两测试TS及自有plan，生产/Overview测/S1七冻结；下一候选须新freeze/窄审/attempt，首失败保留。

同一独占窗至20:52继续串行F old，F输入不含C两测试文件，F自身冻结不动。父20:32 UTC仅签F old token并正式followup执行，F授权副本SHA `a3ac1c0210c89663e6a2918be94220df8bd6045a6ac74d1f02fefd80afdd1a85`，完整133待实际结果；C与F不会同时Node，C补测试仅源写，无Git refs。

## F old首轮实际与夹具边界

20:33:40 UTC F old完整133为93过/40失败/0pending，contract valid、official meta过，source/out stable、两个owned group quiet、双锁已释放。父直接读取原40实际/期望及assertion stack；executor进一步定位其中两个quiet engine/link I1在切owner前的`assertLeftoverSkillsRowTogglesLive`前置失败，夹具mount/select未layout，而既有相同helper用例有layout(640,160)。因此当前仅38业务候选+2fixture，不把40统称业务红；F new/quality未授。原官方JSON SHA `662997f8e3894d10db2ff94bf5b651644141d8b28913fccefca1b064c3acf885`，所有原件保留，Astra已正式恢复做最小修法裁定。

两count用例observed undefined：旧listSkills未传owner、夹具依owner返回数量，未触发count变化。它们只能证明缺owner，不能称旧运行已到重入防护断言。原官方计数合同只查选择/meta/hook等，不会代替夹具/业务鉴别；父尚未签F新令牌。

同轮C类型补修已freeze：Provider测试SHA `c9f5e5c98f71a492803e56a04c8a0e8beb1f46137d7a86f6cddded3d4c3bc83a`，ComposerCatalog测试SHA `e7ff98720d8a38751a7e1d1a3732ea0aae62168b01126846f4aff3f25cc076da`，plan SHA `ea1833ee92f76867ba8a1c044420aea29236c0bd2e4598b224af10d7afa04b90`。仅3个合法snapshot补capabilities及两零写断言拷贝数组解除never收窄；声明和预期不变，但真实JS有变化，不称字节相同。生产/Overview测/S1七保持，静态数仍200，Astra窄审待。

## C类型补修通过窄审与F夹具裁定

Astra正式确认C五处测试补修Critical0/Important0/Minor0，可新a2完整old/new/quality；原a1不覆盖。父正式恢复executor仅先做C a2静态装配，等待新manifest后另授old-only令牌。

F夹具正式裁定Critical0/Important1/Minor0，确认quiet两项为fixture red。原因进一步收紧：全局mount确有layout(640,400)，但早于异步list创建，且本次I1 setup未activate。最小修正只在两个I1参数化test setup（共4展开）用既有activate→await初次目录→layout(640,160)→选择/断言的顺序，count两项也确认DOM toggle渲染，避免零行空循环；不改全局mount、生产或取消/token。F owner已正式恢复做此局部夹具补修，最终新freeze/窄审及F a2尚待。两count旧失败仍只证明missing owner，不声称到达重入。

## C a2静态输入与old-only授权

C a2 source-frozen manifest SHA `273976419e985a82b96b2f710d49ccb13c4290c77b815e5c2334a588dab8d6e7`，同已审v8/v4。新旧闭包各2408，和a1相比仅两测试bytes变化，生产/Overview测/S1七及93 controls/118包/75 Electron身份均保持；总200口径不变。父独核两test+plan三SHA及manifest，再另建授权副本SHA `167799b534df3fa986dfb5c47081e13ff4713fe384121bdd1c89b91538032925`，20:40 UTC只授C a2 old，仍expire20:52；实际结果父鉴别后才授new/quality。a1全部失败/通过/质量原件保留，不覆盖。

C a2 old于20:41:28 UTC实际完整200=117过/83业务AssertionError，Provider75、Composer4、Overview4；scan/meta过、source/out stable、双锁归还。父逐项对83 title/message/actual/expected与已独审a1对照完全一致，仍保留early missing-owner证据边界。官方JSON SHA `203e504064e062ec128ba82bac645a5234ee2c3f6c2e4c535e102d0bece43bfc`，父资格SHA `b11b91c464d3506992b0e695ecc3cc86671b936eefbb6f70ba526868cc97f3fd`。20:42另授C a2 new+quality，expire20:52，完整新200过才原项目noEmit/6TS lint。

## F a2夹具冻结及窄审

F局部两参数化test setup修订+14/-3、精确3 hunks；逆向三处后整文件回a1冻结SHA，原88/40及其余字节保留。新增count callback断言两个DOM toggle再点击，不允许零行空跑。父独核3SHA，Astra独立窄审Critical0/Important0/Minor0，可fresh old→父鉴别→new/quality；静态132业务+1meta仍待运行。生产SHA `3408c37ab2b9920c51e2ad1491626a4879c8d356860ced1d46c174bbe7de862e`保持；新test SHA `2526f3d1e417cabe2f4ececdf92f3f7a9cd2ef46ffddf93a9e6a73c5b3d17d35`，plan SHA `d9ad6cff4600ed56763c74683309988151c0f741950b47ecfe5b9011456839ac`。C quality结束后才由唯一executor做F a2静态装配，无F新Node令牌，a1首fixture失败原件保留。

## C a2完整与quality、F a2 old授权

C a2 new实际完整200/200，20:43:39 UTC quality完成：原项目noEmit0/0诊断，6TS ESLint0errors/11warnings；source/out 2408及13源pins稳定，owned组quiet、双锁归还。新官方JSON SHA `8674a1063b54e3a2c64850b93b3f34a8e5e1e9850d0be4144e68a187023de950`，noEmit SHA `e50959ea541e2971edaa328127437d74df16c703be42e80cab2f494ded4e02ca`，lint SHA `d5358740c571df95a987799aa4c1be83420fa233e94d7b920200eac49e9f8c66`。11warnings未统称既有：父解析messages确认Overview重复import/window、Provider window/in共7项本主题测试规范问题，已正式恢复C只清理3测试，生产/S1不动；两prefer-const和两production selector要求静态核provenance，不为清零改原逻辑。a2通过与a1首失败均保留，下一C a3仍新freeze/窄审/attempt。

F a2静态manifest SHA `cf9111f74415987682d540201acbe8871df6acabb4c3f529b5e059a26da214df`，旧新各2356，93 controls/118包/75 Electron及executables保持，test2526f3…两阶段相同，132业务+1meta。父20:46 UTC另建授权副本SHA `ab11b7a320c2d37f061636bc3147dc288e815fddee78467a7860a7a6e7d83859`，仅F a2 old，当前expiry仍20:52。已请求外部延至21:00以容C局部清理复验，未获明确同意前不自动延长。

F a2 old于20:46:48 UTC实际完整133=93过/40业务AssertionError：原两fixture现在通过初次live-DOM检查，换owner后真正canWrite门actual true/expected false；其余38与父已审a1实际/期望相同。父直接读原JSON与全部差异确认fixture/load/infrastructure/meta均0，count两项仍只证缺owner/count前提，不称到达重入。官方JSON SHA `58f030a59f6c5ab61af2cc1c19dddb1006cee61f9a2b10bdf6b58545f0aa8764`，父资格SHA `14235e897580a1393d2a48de01962cc20aae78794932676ff8e3b9d271d1a094`。外部明确同意延窗至21:00，父新F new+quality token才更新expiry，旧token原件保留。

F a2 new于20:48:36 UTC完整133/133 passing、0失败/0pending，count/meta及sourceOutStable过、owned groups quiet/两锁归还；父直接读原JSON/contract/completed再确认。实际已开始原项目noEmit/2TS lint，quality结果待，不称产品集成完成。

C警告provenance更正：Overview重复import也在raw2f/固定HEAD同5行上下文，故这轮实际清理6项新增test window/in＋1既有重复import；root已显式授权合并import，记录不能称七项全部新增。另两production querySelectorAll与Composer两prefer-const均原字节/上下文不变，4既有保留。

F a2 quality于20:49:09 UTC实际完成：原项目noEmit0/0诊断、2Skills TS ESLint0errors/0warnings；2356新out及9源pins复核稳定，owned组quiet/双锁归还。summary SHA `7ada3cbf58842862ef06558df5d49012bb36fc1e81c1107427e2976fb50b58d3`，新官方JSON SHA `3a8626000fefd0f0826c0374ee665e8578ee5ec2a974596199e1cd4d60fdc5e0`。F完整验证已在该冻结字节完成，不当作产品合入验收；F a1两fixture及全部旧原件保留。

## C a3 lint局部补修冻结

Provider test SHA `c11501e3c97832b270ec74e70d4dd94dd7bcf25ac48d2d382506e9075eebd3ee`，Overview test SHA `3705e0c68f3f040d66c2cdea8a82376c0614bda86e53f5afbe789f0139c7e13f`，Composer test仍`e7ff98720d8a38751a7e1d1a3732ea0aae62168b01126846f4aff3f25cc076da`，plan SHA `65e43cc2d7a0b99ac74dd6bb9d5763a7dc80dfd2f534de7cbfe9eba2bc078d71`。Astra独立窄审Critical0/Important0/Minor0，确认4监听换mainWindow定义等价、事件/回调/安卸/process监视不变，hasKey实际仍用in语义，合并import不改断言；helper两文件raw2f/HEAD/current全字节一致。三生产/S1七固定。父正式恢复executor只先做新C a3静态装配，尚无该attempt token；200仍为静态预期。

## 最终C a3与车道归还

C a3 old实际200=117过/83业务红，父逐项对title/message/actual/expected与已签a2完全一致；原JSON SHA `3c57fe9e020373ab91b38d438925582fecb72e9cd0899ee95268b251c7313d53`，父资格SHA `a587463379c84a72c2daf537aba24d5f2b1c43df1119e60551ded2e4cbdab2cc`。new200全过，原项目noEmit0/0诊断，6TS lint0errors/4既有warnings（两原production querySelectorAll、两原Composer prefer-const）。父复读最终C/F官方JSON、contract和quality日志再次确认。C new官方JSON SHA `2ff93dc4af8de6d8622097a54d793002e56ab815dca1ff231abaff2f1dd96ea8`，summary SHA `dc70f29ee4851b74d81741fdeb11a3161f1e6b4472c822a007cb6fc7d6e6a8a7`。最终2408输出/13源/plan验证时pin稳定，所有原attempt未覆盖。

后续收尾方案采用Astra只读裁定B：必要公共docs/evidence同路径同字节分别随C/F主题commit，status/INDEX/board按共同基线保留各自历史；不再做C UI→F源码依赖merge、不复制C src到F。F自有两status段与旧Skills证据入口必须保留。产品merge仍由外部持有，主题refs操作另约。
