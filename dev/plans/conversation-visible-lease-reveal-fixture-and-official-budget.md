---
title: "Conversation lease：hidden-delete 前置与 official 阶段预算"
type: plan
status: accepted
phase: M7
updated: 2026-10-28
summary: "固定81723B/d470c316一行fixture A获原Astra源码C0/I0/M0/root采纳；整份逆证/全保护保持，设计仍accepted，commit/tools/runtime另授。"
---

# Conversation lease：hidden-delete 前置与 official 阶段预算

本稿补充[主方案§12.1](conversation-visible-lease-recovery.md#121-状态输入与独立边界)，主方案仍 accepted。本稿 **draft / Rule16 待审**；root 与原 Astra 的方向裁定不代固定稿审查。当前只写文档，不授源码、工具、新包、运行或 commit；唯一 compile lane 已归还，当前无人获运行权。

## 1. 已接收的失败与直接恢复前态

new-prep1 在 HEAD `59e2411cf5ee24d1adb869b882c615129304efc6` / src `3dc1205763451e60e70c1a8a84465613990aa526` 恰一次执行：前五阶段0，official -15，driver/wrapper1。先发生原有 hidden-delete 业务 Assertion（false≠true，fresh Reveal1297:12→固定源码1360:10）；随后45s watchdog在 afterEach 终止；下游因缺 official.loaded-assets.json 记录协议异常。原 Assertion、终止和缺证据均保留，不归成一种失败。

实际22 pass/1 fail/17未完成；新13 start0，hooks134开始/133结束，预期238；无官方终态JSON或自然CDP资产终态，不授 new green、loaded相等、failed-body leak-clean、after或C/F资格。root独核及采纳原Astra actual C0/I0/M0后接收两qualified写入/两目标原bytes、mode、mtime恢复、仅两ctime变化，45实际身份quiet/双锁释放、原5203/main65/index/source等保护，并正式回收lane。包永久 consumed failed，不改不重跑；[完整接收与外锚](../progress/sources-accept-post-read-authorization-checkpoint.md#new-prep1唯一失败恢复接收与下一draft2026-10-28)。

未来新包的**直接恢复前态**是本次 guard-after-restore：20160038B / SHA256 `6dd885b1b070b9042e611c8db4e7170d6f029cbd712af57afbed3761f3a71f13`。原 old receipt `a5b51b30…` 与 guard `6601c143…` 继续保留历史链，6601不再称立即前态；原new P/D及终态外锚也须纳入未来不可变保护闭包。当前不准备新包、不重hash整个5GB依赖闭包。

## 2. 唯一测试前置修改

在既有 `onDidDeleteSession disposes a hidden leaf and its editor part` callback 内，仅将冻结 Reveal1357：

`await sessionWindowService.openSessionBeside(secondaryId);`

改为：

`await sessionWindowService.revealSessionWindow(secondaryId);`

保留 title、waitForSessionPane、fireDeletedSession 与全部 assertions 字节，无格式化或production变更。root另已逐字确认该原用例与a4a一致，本稿不改写继承失败的来源。

| 当前实现链 | TS行 | 恢复的native行 | 单叶初态的效果 |
|---|---:|---:|---|
| openSessionBeside | 222–254 | 135–162 | 仅满两叶才隐藏secondary；新叶primary:false，旧primary保持可见。 |
| revealSessionWindow→runReveal | 315–398 | 216–287 | 原子apply状态表、等pane与聚焦。 |
| 新session / visibleCount<=1分支 | 438–446 | 323–330 | 新叶升primary，旧primary降级并隐藏；旧leaf/editor part仍在。 |

TS/native分支一致；新前置建立“隐藏但仍挂载”，后续删除断言仍完整检查原问题。只改这一行，不通过放宽断言修绿。

## 3. 整份同输入要求的有限例外（独立Rule16审项）

一行改变后，新整份 Reveal **不再等于** old 的81721B / blob `feb55eeed2013c948ae487bdba8217887d2fc0b5` / SHA256 `8a9c3245ae661b68e160c6a1c0d79924159618da7b342c5b09cd46caa1f35e61`。不得继续引用主方案§12.1称整份同输入。新完整ref/blob/bytes/SHA须未来获准源码变更后另列，当前为待定；旧包、旧输入和old L1红receipt原封，不新跑old。

root采纳原Astra的窄兼容方向，固定稿须同时满足：

- exact diff仅既有hidden-delete callback内上述一行；逆补丁恢复old整份字节与8a9c，无格式化。
- L1、shared harness、imports、顶层初始化、注册顺序/title、hooks/doubleRAF、其余37个业务case及官方meta逐字同，即40项除L1与本case外的38项均不改；所有assertions字节相同。旧/新Pane各自固定身份分别保持14186B/`51cfc03a…`与15270B/`90c0719d…`，不能互换。
- old仅执行L1+meta，未执行hidden-delete callback；唯一变化只在该callback执行时生效，L1构造、触发、观测与预期均未变。因此可保留已签old红的证据适用性；这不是整文件等价，也不是新整套通过。
- 修订用例清理对后续L1的非干扰，仍须未来完整13新+26原+meta=40 unique /238 hooks、自然loaded与quiet/恢复实证。若后续触及shared/L1/注册/hooks，此兼容裁定立即失效重审。

## 4. 仅未来official的180s候选（独立Rule16审项）

选择 **180s有限观察硬上限**，不保证所有case接近自身timeout时仍完整完成。五个其他stage、emit及parent permit仍45s；Mocha test15000ms、既有setup hook20000ms override、双RAF及全部assertions保持。全套若超时仍失败，不自动重试。

### 4.1 已观察成本与新13显式等待

本次23个ended body合计2632ms；19个ended hooks>=1900ms，ended hooks总39132ms、max2033ms，其余ended hooks1141ms。最后body已pass，afterEach只开始未结束。双RAF在suite teardown157–159：适用39个业务case，外部meta无这条teardown。39×2.033=79.287s；按40项保守计费为81.320s，均是外推，**不是RAF上界**。show:false/无调度override仅为线索，未证明节流根因。

bounded每次为3000ms事件等待，超时即断言，不是固定睡眠。共同harness保守<=7次：initial catalog start/finish两次、两处waitForEnginePane各<=2次、条件initial baseline一次；故意把已完成/互斥条件也保守计入。其他helper：waitForEnginePane<=2、startEmptyCatalogRefresh=1、completeCatalog=1、assertEngineFramePaints<=3。

| 新case | 共同7之外最多次数 | 保守显式等待和 |
|---|---:|---:|
| L1 | 5 | 36s |
| L2 | 7 | 42s |
| L3 rejected list | 7 | 42s |
| L3 disconnected / connected pairing / connecting pairing，各项 | 7 | 各42s |
| L4 hidden/prune/observer/survivor | 17 | 72s |
| L4 unmounted | 7 | 42s |
| L5 clearInput / dispose / switch input，各项 | 2 | 各27s |
| L6两轮catalog/两次frame | 12 | 57s |
| L7两个owner/两次frame | 10 | 51s |

13项保守显式路径和549s，仅数bounded，不覆盖全部await或事件循环阻塞，也非可同时耗尽的成功耗时。13×Mocha15=195s已大于180，因此180不能保证所有case耗尽timeout后还完整收尾；事件循环阻塞时Mocha timer也非OS硬截止。新13本次未执行，不能用预算分配冒充实测。

### 4.2 同一official生命周期的互不重复分配

| 部分 | 计划容量 |
|---|---:|
| Electron/Xvfb/runner加载、reporter校验与初始加载 | 15s |
| 39次双RAF，含上述39/40项保守外推计费及取整余量 | 85s |
| 原26+meta setup/body及非RAF hooks | 15s |
| 新13 setup/body及非RAF hooks | 45s |
| runner end、官方JSON/stream drain、CDP getScriptSource/资产终态与退出 | 20s |
| 合计 | 180s |

85是计费余量，不是85s实测或硬RAF上界。old两项official全生命周期2.6534s含加载与收集，不能拆作分项上界。尾部20s明确给原observer drain逐项读源/写loaded-assets，是计划余量，非新子deadline或保证；不能改runner跳过case、提前结束或重复计时强制留量。若body耗尽180，仍按原失败与缺证据保留。

## 5. 未来最少必要改动与执行门

1. **源码另授**：仅§2一行；新Reveal身份/精确diff/逆证与§3不变范围证明齐备。当前不改src/out。
2. **工具另授**：独立新版本对5f fixed13逐项差异审查，原13及P/D不原位改。实际类为OwnedStage；未来仅按stage固定五45/official180，attach一次建立不可续期monotonic deadline；entry/watchdog与run_owned现硬编码monotonic-45s-deadline文案按实际stage反映。
3. ParentWriteAuthority仅对policy.emissionPhases创建；两emit仍45，继续共享该scope的原deadline。不得全局替换45000000000或放大parent grant/WAL/guard-worker窗口。只在实际消费处一致绑定预算，以新source freeze/发布/pins及实际report固定；不为未消费字段扩展全部schema/contract。若新增消费字段，消费双方与新包审计必须精确一致。
4. TERM5s+KILL5s保持：其他stage为45+5+5，official为180+5+5的stage操作/终止窗口；不是driver总时限。没有外层全流程timeout，guard、全量保护、finally恢复与锁释放不由180覆盖，不在180到时杀finally。
5. **完整门保持**：40逐名/官方stats、pending、238 hook multiset、自然scriptParsed/getScriptSource及loaded=disk=独立dry seal=emit、qualified2恢复/fullguard/ownedquiet/双锁均须实际成立。业务Assertion、unknown、终态assets缺失或恢复失败不能替代成success。

### 5.1 新输入与最新恢复前态绑定（首轮Rule16 I1）

原Astra正式Rule16经root转述为 **C0/I1/M0**，root采纳；此处保留I1修订时点，后续正式C0/I0/M0及独立accepted见§7，仅设计门关闭，未授实施。原9747B/SHA256 `2b0367e1d247c38bc537eb53ab74e11d6c51c1bd0d1092ad31cd9065ee84e12a` 固定稿及原六path handoff独立保留，review归因为root转述摘录，不伪造reviewer raw；§2、§3、§4规范不改。

**资格祖先与直接恢复前态分开验。** 当前guard.py90–96把new predecessor强制等于old receipt的final6601，不能用于下一直接6dd前态，亦不能只删除等号。未来独立工具须完整校验：

1. old资格祖先：原receipt `a5b51b306dcccea9c890dfae652c61f8f4804f4a67b06718ce416eb9b562f13b` 的bytes/SHA、acceptedBy=root、准确old package、businessOldRedQualified/restorationComplete/fullGuardPassed及所引用final guard6601仍按原合同验证；old L1/输入身份不变，不改原receipt或重跑old。
2. 最新失败恢复：本次root receipt `9e3979daa89704de65141182a607d799500d43fd5cdb3828145bbac54c31e00d` 与独立anchor `f29dd7cd1b4dbba234006ff4a5668a7a78766b3261d203d20a5145df0d6d696c` 的完整bytes/SHA和互引必须一致；继续解引用其原terminal anchor789c、index5ddc、audit908a、actual driver1/official-15与finalguard6dd885b1全文SHA。核验准确new-prep1/原HEAD59e/src3dc、两qualified恢复、授权两ctime、45quiet/双锁及root仅接受失败恢复/归还lane的范围，businessNewFullQualified仍false。
3. 中间链不可跳过：715锚→old实际恢复6601→本次new-prep1 manifest/fresh baseline绑定6601→实际qualified2写入/restore2及仅两ctime差的6dd→root失败恢复接收9e/f29→下一包新捕基线。下一currentNative.outMetadata须精确等于6dd，而非把715/6601改名成6dd；每一步原bytes/SHA及out全pathset/metadata关系可重建。若需机器可消费桥接receipt，只能另建并独立审查、绑定原9e/f29与原actual及全链，不能改旧对象或把restoration当业务green。

**新Reveal与workspace各自重绑。** binding.mjs38–42/validate.py30–32仍按profile固定8a9c，未来new分支须同时绑定新Reveal完整ref/blob/bytes/SHA、Git原文/不可变copy、精确一行diff/逆证、dry seal/inline map、emit与自然资产来源；old祖先的8a9c原身份另保。所有实际消费新Reveal身份的profile字段须一致，不能只改input-manifest或混用旧/新模式。未来workspace HEAD与src tree均另固定：EXPECTED_SRC、profile/schema中实际固定src、manifest/policy/release的HEAD/src及checker/report等消费者一致并重新peer，不能把当前59e/3dc或未来未产生的身份预宣为通过。

Reveal **不在既有256 source/native pairs中**；256条全原字节保留，禁止新增假Reveal条或写成1/255。Reveal以独立immutable input/seal/current-source/native asset身份绑定新源；原native bytes/mode/历史producer与“新源尚未emit”边界保留，不能将原native追认新producer。未来对repository/context的fresh capture只允许精确新test source文件与其parent目录metadata变化；用新ref/一行逆证解释该变化，其他src、out、.build/node_modules等tuple/pathset及原producer保持，不任意全量重基线吸收漂移。

未来允许差异仅四类：**一行fixture；新inputs/workspace实际消费绑定；最新恢复lineage的上述完整检查；official专属预算**。每个新版本文件逐项声明变化/未变并peer；只改实际消费字段，不无必要扩schema，原5f13及全部旧包仍原封。新prep1 P/D、终态inventory/原raw/失败与正式接收receipt/本轮固定稿和review记录整体纳入未来不可变保护，新旧original路径集分别说明；当前不准备包，不运行source/tools。

顺序：固定本draft→Rule16分别审§3/§4并改稿→独立accepted文档→源码与新工具各另授→新独立包whole peer→fresh preflight与唯一runtime另授→完整new资格后另授非作者真实默认editor after。old不重跑；I build/after/ready=false与C/F未获新信用保持。

## 6. draft交接时的验收边界（历史时点）

仅docs-only draft/行动更新及Python文档门禁；未syntax/import/AST/Node/compiler/tests、未新包或锁/cache/freeze写入，未stage/commit。外部建议与root/Astra方向摘录见检查点，不能代本稿Rule16。固定稿精确路径/bytes/SHA交root，由root派原Astra只读审查；未通过不得开实施切片。

## 7. 原Astra窄复核与独立accepted（2026-10-28）

审查来源均为root直接消息转述原Astra正式结论的准确摘录，非reviewer raw。首轮固定9747B/SHA2b0367e1…为C0/I1/M0；root采纳I1后仅补§5.1/摘要行动，§2–§4整段逐字同。改稿固定13540B/SHA256 `e6225637578eecd7d1d96c47dd7a212cfcf55c297b61524756796374ad3ca575`，原AstraI1窄复核 **C0/I0/M0**，root采纳并仅授权本次独立accepted文档、生成状态/gates及exact六docs的一次scope commit；未授源码、工具、新包或runtime，不push/amend。原两稿及各自六path handoff原件独立append-only保留，归因见[检查点](../progress/sources-accept-post-read-authorization-checkpoint.md#新窄方案正式规则16关闭与accepted文档2026-10-28)。

accepted机器实现精度解释（不修改任何原对象）：

- 实际引用方向是 **f29→9e→789c/5ddc/908a/6dd**；§5.1所称互引仅要求既有有向引用的身份/bytes/SHA一致，不要求对象互相新增反向字段。先验证f29引用原9e，再按9e原references逐项校验原终态anchor/index/audit/finalguard及其已有引用。
- index须核准确consumed包/actual exits、qualifiedRestorationComplete、finalguard、保护及allExactOwnedQuiet/bothLocksReleasedAtActualSample；不得由receipt存在推算这些资格。audit须严格对账原九个**唯一check身份**且全部passed，failedCheckCount=0、errors=[]，核其qualified union恰两路径、仅两ctime、原bytes/mode/mtime恢复内容及最终guard引用；不只比较数组长度。
- 9e须核其实际结构中的acceptedBy、permanentlyConsumedFailedPackage、noRetry、compileLaneFormallyReturned及currentlyAuthorizedRuntimeOwner等准确值与root接受范围；不存在的顶层bool不能从prose补造。new业务仍失败，恢复不能升格green。
- 原terminal记录中的pending字段保留原字节，由后续9e/root正式接收解决时序；**不需另造桥接receipt**，也不得为消除pending回写旧index/anchor。old a5/6601资格祖先仍独立验证，715→6601→6dd完整链及新inputs/workspace重绑按§5.1另做源码/whole-package peer。

本次只关闭文档设计门。未来source仅merge受控候选一行fixture与四类允许tool差异，仍分别等root另授；原E历史工位、旧5f13/P/D、本次失败与已接收恢复全保持。完整40/238/自然loaded/恢复、非作者默认editor after、I/C/F资格未因本次accepted而取得。

## 8. root另授的一行fixture A未提交候选（2026-10-28）

root独立接收docs commit `e37fc6c3419fae03f484a6d11e8c4b58e7e6b84e` 后，仅另授merge的§2一行与必要主题docs；上文“源码未授”是历史时点。实际只将既有hidden-delete callback1357行 `openSessionBeside(secondaryId)` 改为 `revealSessionWindow(secondaryId)`，未格式化。当前HEAD仍e37，候选未stage/commit，待root交原Astra源码peer；本节记录实施事实，不改§2–§4规范或设计状态。

| 固定对象 | bytes | 完整身份 |
|---|---:|---|
| old整份Reveal，b078原文 | 81721 | blob `feb55eeed2013c948ae487bdba8217887d2fc0b5`；SHA256 `8a9c3245ae661b68e160c6a1c0d79924159618da7b342c5b09cd46caa1f35e61` |
| 一行候选整份Reveal，未提交 | 81723 | blob `80434706a2e91218fa3f1c0c130b4697981db4b8`；SHA256 `d470c31670caf21b35698d8663ad7bcf6a72022fbf247910265e2a6f4af7498b` |

精确diff仅该行；整段prefix/suffix字节同，逆替换完整恢复b078原81721/8a9c。12,165 tracked源码全量逐blob比较仅此目标改变；基线src `3dc1205763451e60e70c1a8a84465613990aa526`，候选src由Python离线重建为 `c1267f27d022ecaa417ef9065825fb53bacc21ea`，未写Git objects/index。L1、shared/imports/注册/title/hooks/doubleRAF及全部assertions均在不变字节内；Pane仍15270B/90c0719d，不将静态证明称为清理非干扰或业务通过。

独立证据根 `/sdd/tmp/vscode-conversation-visible-lease-fixture-A-20261028-candidate1-20261027T235336740102Z` 不向已封P/D/S追加。src15716全pathset同，metadata仅目标文件变化、parent实际未变；out15500/.build6778/node_modules48773全metadata/pathset、旧256pairs/freeze4/cache3和main65/index严格同。Reveal不在旧256内。[检查点](../progress/sources-accept-post-read-authorization-checkpoint.md#fixture-a一行源码候选与独立保护2026-10-28)记录精确身份、保护及操作偏差。

主plan与本plan仍accepted；未准备/编辑工具、新包或锁/cache/freeze，未AST/syntax/lint/Program/Node/compiler/emit/tests/runtime/after。仅固定source+docs交root/原Astra源码peer，commit另授；official180尚未实施，new40/238、自然loaded、恢复、非作者默认editor after及I/C/F均无新信用。

## 9. 原Astra源码A片正式签收（2026-10-28）

root直接消息转述原Astra正式FINAL **C0/I0/M0** 并采纳固定81723B/d470c316/blob80434706的静态资格及§3有限兼容；此处准确记为root转述，非reviewer raw，不追造原消息或另扩归档。review核exact one-line/whole inverse，单primary经真实reveal提升新叶并隐藏保留旧leaf/editor part的实现链，以及1360–1368全部断言与真实delete disposal链；shared/L1/import/注册/hooks/全部assertions同，旧256 source/native+mode零差异、原native哈希同。

仅关闭本A片源码peer门。静态审查不代运行：修订case清理非干扰、完整40/238、自然loaded及恢复仍须未来实证，official180未实施；主/新plan仍accepted、I build/after/ready=false、after/C/F无新资格。源码从81723固定后未再改，当前仅补必要docs与Python门禁，未stage/commit；root核最终保护handoff后另授同主题commit，tools/新包/runtime仍未授。
