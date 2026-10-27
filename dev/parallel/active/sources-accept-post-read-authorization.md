---
title: "Sources Accept 读后授权：分工与门禁"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "b2原54与5f4 same-ref窄peer均C0/I0/M0经父采纳、44 I1关；root核f5a后授权共同预stub最小Pane test-only候选，旧helper/default/resolver/cases及生产/Panel保持，仅静态待新窄peer/唯一lane/out冻结。"
---

# Sources Accept 读后授权：分工与门禁

本看板仅跟踪[独立方案](../../plans/sources-accept-post-read-authorization.md)的推进，不重复 Sources 长期 SSOT。固定基线 `c7fefd780bd9720f3889e310d4706210189a3fc7` / `src=a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`，不追 main；原 draft 为 `4b0d3d62e65e54e71d3b1748f100fac7ca5f6ce3`，经父核验与 Astra 规则16 C0/I0/M2、两Minor实改后为 accepted 方案阶段；父级独立核验 accepted `5c0916b71070c5f75742fcbd831cd8c31be0bd34` 后已明确授权实施；两生产宿主+两测试候选 ab43 已经父核与 Astra 正式源码 peer C0/I0/M1；父级采纳 A7 覆盖 Minor，本轮只补测试与必要文档，静态计数共 54。b2 四例增量已由 root 核验、原 Astra 窄 peer C0/I0/M0，原 M1 关闭；作者不运行任何业务测试。旧 run1 暴露的 Panel 生产 VM 泄漏与独立 Pane DI setup 另立[生命周期方案](../../plans/sources-panel-diff-view-model-lifetime.md)，不混入既有 Accept plan。

| 角色 | 范围 | 当前门禁 |
| --- | --- | --- |
| D / sources_audit | 仅两宿主 Accept 读后写前当前授权的方案，规则16后才实施 | b2不可变、原54/旧71调用/旧patch保留；四例窄peer C0/I0/M0已交，不写out/运行业务。父核e949后已获生命周期实施授权，44正式源码peer C0/I1/M0、生产静态符合边界；5f4 same-ref窄peer C0/I0/M0经父采纳、I1关闭，18新例未运行；root核f5a后已授权仅Pane factory预注入收为无条件一次stub，当前最小test-only候选待父核/新窄peer/唯一lane。 |
| root | scope 与合同选择、draft路径/原文保留核验、安排独立评审 | 已核draft/规则16/accepted及ab43，采纳源码peer唯一A7 Minor并授权补4；已核b2并确认Astra窄peer关闭M1；亲核旧run1边界、a04规则16 C0/I0/M0已采纳；5f4窄peer C0/I0/M0已采纳/I1关，已独立核f5a全部9docs并采纳；现明确授权共同pre-stub最小test-only候选，固定后另核/窄peer才释放唯一lane两case旧生产资格run2。 |
| Astra / architecture_audit | 当前授权取舍、规则16只读方案审查，实施后独立源码 peer | 精确draft规则16 C0/I0/M2后，ab43正式源码peer C0/I0/M1已交；唯一A7覆盖Minor经父核采纳、b2补4窄peer C0/I0/M0关闭；生产VM泄漏独立a04规则16 C0/I0/M0；44代码peer C0/I1/M0已交，same-ref修订5f4窄peer C0/I0/M0已交且父采纳/I1关；d0规则16 C0/I0/M1已采纳/Minor已改，现共同预stub源码候选仍待新窄peer，不借5f4结论外推。 |
| baseline_executor | 唯一源码 checker / emit / 官方 Electron 业务验证 lane | run1精确c7生产3+ab43测试2：A1双业务红；阳性只3 body过、Panel A2 afterEach leak/console、Panel A3未达；独立input setup未达。正式原件proof d51ce65已由baseline提交，后续green需另获释放。 |

推进顺序：draft/父核/规则16/两Minor实改/独立accepted → 父核5c并授权源码 → ab43两宿主与50新例候选 → 父核及Astra源码peer C0/I0/M1 → 父采纳A7 Minor、D补4成54 → 父核b2/Astra窄peer C0/I0/M0关闭M1 → 唯一lane旧red已得、生命周期44候选I1已修为5f4窄peer C0/I0/M0/父采纳关闭 → d0共同预stub规则16 C0/I0/M1/root采纳后f5a独立accepted → root核f5a并授权共同预stub最小test-only候选 → 父核固定候选/新窄peer后才唯一lane旧生产两case资格run2 → 后续新green与父级验收。不得把作者静态检查代替源码peer或业务门禁。

旧 J/E R3 是已局部签收的独立波，D1387 closed / 两窄方案 implemented 保持；其证据与失败不改。本 scope 不升级 PRD 或宽 Sources Diff 方案，也不重开 open/Move 修复。catalog-ready 后缺 lease 恢复、local Git 迟到结果的 notice 归属留后续独立候选；不同 engine 复用同 session 字符串的读归属仅记边界。

[作者检查点与空间/ff事实来源](../../progress/sources-accept-post-read-authorization-checkpoint.md)保留原 status 首条，B 的 ENOSPC 来自父通报、空间恢复原因不明、D 单次 ff 成功。本 scope 不碰 B 的失败 checkout，不写原 out/freeze/cache 或旧封存证据。

## 实测验证先决：Panel VM lifetime

| 独立范围 | 当前阶段与入口 |
| --- | --- |
| Panel VM lifetime | root 采纳原 Astra 生产 Important 与 DI setup 定界；[独立方案](../../plans/sources-panel-diff-view-model-lifetime.md)原 a04draft 经 root 核验与原 Astra 规则16 C0/I0/M0、root采纳后为 accepted；显式 VM / refs 唯一 owner、detach→VM→refs、body / dispose / 迟到 resolver 全路径合同保持；§3.4共同factory预stub合同已另经d0规则16/root采纳后accepted。root核e949后已另行授权：44正式源码peer C0/I1/M0、生产静态符合签收边界，root采纳新same-ref夹具I1，5f4窄peer C0/I0/M0经父采纳关闭；短期underlying resolver keepers、Panel计数/detach/provider0/最终owner断言保持。18例仍未运行；当前仅Pane factory预注入由if收为无条件一次stub的新候选待窄peer/唯一lane，两runAccept/Pane生产/Panel.test/原54/旧71/旧patch不变；Accept/Panel及共同预stub窄修订均accepted，源码实施授权分别记录。 |
| §3.4 共同factory预stub | [独立窄修订](../../plans/sources-panel-fixture-preinjection-amendment.md)经原Astra对精确d0规则16 C0/I0/M1、root全文/源链核验采纳后独立accepted；已应用原Panel§3.4首段及唯一标题Minor/锚点，其他§1–§5逐字保护。exact c7旧default-false原case仍为setup1/0/1、业务red0；root已精确核f5a并明确授权最小源码：当前仅Pane factory旧helper前预stub从if(resolveModels)收为一次无条件；旧helper/default=false/resolver/case/header/assert保持，生产/Panel.test不动；待新候选父核/原Astra窄peer后才唯一lane另取资格。 |

该 scope 复用本看板与现作者检查点，不新建长期日志。方案阶段只读精确 Git，不请求 baseline 接入含 ab43 / b2 源码的 D HEAD；当前完整 Panel 实施候选统一 peer / 绑定验证，作者不编译/业务运行；旧默认false DI资格与d0窄合同签收已分别记录，共同预stub最小源码已另获父级授权，尚待新窄peer/唯一lane。旧 run1 正式入口 `dev/progress/sources-accept-post-read-authorization-old-red-evidence/INDEX.md` 属 baseline proof `d51ce65f86605b47f31c8d99bfbd98fd9f43564d`，D 未同步/复制；原结果与恢复资格保持。


## 独立后续：Conversation可见叶 lease 恢复

[独立draft](../../plans/conversation-visible-lease-recovery.md)仅跟踪root在原Astra新鲜源码裁定后授权的§24后续范围，固定a4a/srcd78a；复用本板，不改上文Sources历史或其验证门禁。D只写docs draft与索引/行动记录，不改源码/测试/out、不请求baseline接DHEAD；root核固定commit/path hash后，仍交原Astra规则16，再独立accepted及另行源码授权。当前Sources候选如报源码/fixture问题优先响应。

仅Pane现visibility生命周期中的session reconcile；当前input/lens存活、明确bound一致、实际visible、未suspended、真实引擎live/非pairing、catalog ready且自身缺lease才沿原bind补领。回归须真实EditorParts→EditorService→Pane/Lens＋真实EngineRoster/UA emitter/Deferred listSessions/session-view frames，主red不能先hide/reveal/resetInput/manualbind；双pinned叶、KEEP与门关闭/owner撤销合同见plan。local Git迟到notice继续后置；Source两plan/原54+18/JSON及PRD/D1387/宽方案保持。


### 89d规则16后独立accepted文档

上节保留draft时点原文；当前以本节为准。root已逐8docs/hash/全文/sourceTree/status200独核89d，原Astra正式Rule16 C0/I0/M2经root采纳，两Minor已在[方案L2/§3.3及审查记录](../../plans/conversation-visible-lease-recovery.md#6-规则16原审查与独立accepted文档)澄清：KEEP测试持续live同identity且限定无新frame的引用窗口；三种非live状态采用自然missing→QueueReader真实session通知→同次UA内早于合法Lens重绑的前后采样，静态可行/实际fixture未达则资格未达。这里只签accepted文档，无源码授权，lease主red/新green/after未达，src仍d78a；root核accepted SHA后另议实施，不请求baseline接DHEAD，不借Sources54/18或run3外推。当前Sources问题优先，原三plan/JSON及PRD/D1387/宽方案保持。


### E 独立可见叶lease源码候选（2026-10-27）

上文保留ff55 accepted时点；root核该SHA后已另行明确授权E实施。E从干净e7一次普通ff-only到ff55，在独立分支形成仅Pane listener/import＋现Reveal真实EngineRoster矩阵的候选，原默认QuietRoster/26 tests、所有其他src、三Sourcesplan/JSON及54/18保持。L1–L7静态展开13条，L3三种非live的真实QueueReader before/after窗口、主L1资格及业务结果全部待runtime；L4含公开prune removed及未挂载控制。作者仅AST/no-cache lint/保护与docs检查，不Program/compile/emit/业务/UI/out/cache/freeze写。[当前候选与原首条](../../progress/sources-accept-post-read-authorization-checkpoint.md#e-可见叶lease最小源码候选2026-10-27) / [plan §7](../../plans/conversation-visible-lease-recovery.md#7-e-最小源码候选与作者静态边界2026-10-27)；plan仍accepted，固定commit先交root核，再原reviewer源码peer，唯一lane旧red/新green/原reveal及非作者after均另待。当前Sources候选仍由D负责，问题优先，不混接E HEAD。


### E 新L4 dispose合同修订候选（2026-10-27）

固定5fd已获root静态身份接收，原Astra正式源码peer C0/I1/M0；I1只针对新L4将disposed Lens字段误要求undefined。root采纳后另授权仅该case与必要docs：公开记录旧Pane lease、prune后活observer接帧/旧owner不接帧，再放最后observer核host release；保留leaf absent/非hidden/非visible、Lens disposed、latebind0和存活owner正控。Pane完整15270B/90c0719d…、其他12新case/原26/defaultQuiet/Sources四TS+三planJSON与历史/out保护，矩阵仍13；实际L4 release/帧隔离及全部运行资格仍false，待root固定核→原Astra窄peer。审查来源与metadata root-inode/LF schema边界见[plan§8](../../plans/conversation-visible-lease-recovery.md#8-5fd-正式源码-peer-与新-l4-合同修订2026-10-27)及[行动记录](../../progress/sources-accept-post-read-authorization-checkpoint.md#e-新l4-dispose合同窄修订2026-10-27)。本轮仅AST/no-cache lint/docs，无执行授权，plan仍accepted。


### E 783窄peer签收（2026-10-27，纯文档）

root已独核固定783（src eefc0c）并正式接收静态候选，采纳原Astra窄peer C0/I0/M0关闭5fd I1；原I1报告/静态原件保持。独立observer真实帧与旧owner隔离、最后observer释放host的源码链获签，L4外test/Pane不变；仅静态13case，所有runtimeObserved=false。详见[plan§9](../../plans/conversation-visible-lease-recovery.md#9-783-窄-peer-签收与下一门2026-10-27纯文档)与[checkpoint](../../progress/sources-accept-post-read-authorization-checkpoint.md#e-783窄peer静态签收2026-10-27纯文档)。本次仅4docs签收，源码仍783，plan accepted；不是formalmerge/green/outputs交付，不升PRD/旧波。唯一lane先完成Sources新源验证，之后另准备旧L1red/新13矩阵/原Reveal/非作者after；无执行授权，不再AST/lint或任何runtime/out/cache写。


### E 新L4 checker收窄修订（2026-10-27）

root报告固定7361唯一lane prep2首run checker在新L4报TS2339 never五诊断、Pane无诊断、无emit/测试，run已consumed不得重试；原件/hash与原Astra根因/父采纳来源保留[plan§10](../../plans/conversation-visible-lease-recovery.md#10-实际-prep2-checker-阻断与新-l4-读取根窄修订2026-10-27)。E先核clean f33后留该窄parent，仅公开重读restoredLens并断言sameLens、替换两处读取根，retiredLease仍在原绘制await之后；不删missing gates、不改其余L4/12新/26旧/defaultQuiet或生产Pane。一次Reveal AST0、no-cache/no-fix lint0/0，显式禁Node compilecache；无Program/checker/emit/runtime/out/cache写。三Sourcesplan/JSON按E固定baseline保护，不导入merge后来第四plan/52B stub。候选待root固定核/原Astra窄peer，语法/lint不代checker通过，planaccepted/业务全未达，旧失败原件与此前I1签收保持。


### E Lease after只读输入落盘（2026-10-27）

固定E d8e/src923acd；root转述其与原Astra输入决策审查C0/I0/M3并全部采纳，仅授权纯docs。已完成只读调查及三条Minor的来源、wire/三个真实transport lifetime/公开own-lease观察边界、R3工具hash与loaded限制统一落入[独立证据索引](../../progress/lease-after-inputs-20261027-evidence/INDEX.md)，现lease plan只追加该证据入口，合同与accepted不变。E历史`.build` aggregate不匹配、前轮末guard exit1/AssertionError且未生成narrowing delivery/preservation、缺旧逐项tuple与前轮起点的边界如实保留，不修旧guard、不归因。原static/docs原件与全部source/out/三Sources plan/JSON保护；本轮fresh起止仅界定本docs区间，不能替代历史缺失证据。只做docs generator/health/diff及只读保护核对，结果见证据页；没有工具准备、执行release或runtime信用，无AST/lint/Program/checker/emit/tests/server/browser/engine/out/cache操作，不ff/同步merge、不升PRD/旧波。


### E lease setup诊断草案（2026-10-27）

root报告并提供唯一lane d8e实际exit1原件：checker两target语法语义/lint/dry/emitReveal0，old L1在engine Pane setup失败、map445→455→433→517→628、未到647业务断言；无Paneemit/fullnew，实际只还原Reveal、46fc afterguard及唯一Reveal新ctime、全owned已停。原Astra C0/I1/M1经root采纳；已有错误前置文案不回写，rootcause未知。E固定19663010只新增[setup诊断draft](../../plans/conversation-visible-lease-setup-diagnostics.md)：A仅失败报告，B未来经规则16/源码peer/真实三路后由唯一merge baseline另备一次诊断专用Reveal+旧Pane/L1+official meta，任意结果stop/restore，不升级业务red/green、不自动Paneemit/fullnew/after；当前不实施、不准备/运行，原件与全部src/out保持。待交root与原Astra规则16，现lease plan仍accepted，原看板全文保持前缀。


### E lease setup规则16 I1窄改签收（2026-10-27）

root提供原reviewer Astra直接消息：固定247210规则16 C0/I1/M0，root独核后全部采纳I1，并承认其先前false→not reached建议同样过强；来源为会话消息，不伪作formal raw。已对[独立diagnostics方案§3/§5](../../plans/conversation-visible-lease-setup-diagnostics.md#3-b单独释放的一次诊断专用运行)窄改：只有实际boundary=true写与本次真实source map一致的qualified前置，其他写expected old-red boundary not established并保actual outcome/stack/mapped frames；仅actual stack+fixed controlflow能定位setup先败才写未到647，L1pass记actualpass且无业务red/green信用，不能定位记unknown，conditional false不得抹掉已达事实。按root裁定独立方案accepted且只勾规则16；本次固定修订仍待root独核/原Astra窄验，不实施。原A/B范围、3s/事件/全部断言、单Reveal+旧Pane/L1meta/任何结果stoprestore/独立tool gate保持；旧lease accepted、src923acd、旧consumed工具原件及全部输出不动，无runtime升级。原看板全文保持前缀。


### E lease setup A失败报告源码候选（2026-10-27）

root已接受固定9a9a并采纳原Astra正式窄验C0/I0/M0关闭I1，另仅授权[diagnostics plan§2/§7](../../plans/conversation-visible-lease-setup-diagnostics.md#7-a失败报告源码候选与作者只读边界2026-10-27)的A。E留9a9a parent，只改Reveal engine helper/两处初始化原openErrors传参；原等待正文只局部重缩进，3s/sharedbounded/事件filter/finallycancel/成功返回与全部cases断言保持。失败时一次公开snapshot+已有openErrors JSON构造完整后给同一Error.stack追加后缀，诊断自身失败仍原样throw；不用console，官方renderer266–273/338–340会把其记为teardown败，来源与root采纳处理已列peer输入，未运行runner。整helper/两call逆还原即完整d8e80259B/110f7f43；候选81489B/dbc9066b，13新/26旧/defaultQuiet/Pane/其他src与历史原件保护。旧647非candidate冻结行号。仅只读字节/metadata/diff/docs，无AST/lint/Program/emit/tests/UI/工具准备/out/cache写；sourcepeer待，plan仍accepted，不自动B或升级runtime。


### E lease setup A默认参数一行修订（2026-10-27）

原Astra正式A源码peer对fb708为C0/I1/M0，root独核全采纳I1：449 required openErrors与811/907/966三旧单参静态不匹配，未跑checker、不称实际TS2554；其他catch/原Error/等待等无发现，原peer与候选记录保留。E从clean fb708只加openErrors默认空数组，不optional/cast、不改其他源；两真实数组传参/三旧调用/所有断言保持，候选81494B/404034f9，逆唯一默认值精确还原整份fb70881489B/dbc9066b。后续toolpeer须先以唯一LF+Engine Pane setup diagnostics: 分开主stack与JSON，仅主stack用于业务frames，嵌套openErrors.stack不混入；只记输入，无工具授权。详见diagnostics plan§8；待root固定核/原Astra窄验，accepted/runtimefalse，不进B，无AST/lint/Program/checker/emit/tests/UI/工具prep/out/cache写，历史/原件与fresh metadata保护。


### E lease fixture / emitter隔离方案待规则16（2026-10-27）

root仅释放E固定8033纯docs；[新两片方案](../../plans/conversation-visible-lease-harness-and-emitter-isolation.md)status draft，规则16只读审查待/root裁定。A仅Reveal导入WorkRootMount token/真实无依赖model并在原fixture store本地stub；B只由未来唯一baseline核静态可行性、在编译依赖导入前精确隔离reporter固定log及顶层mkdir，完整src/.build/node_modules逐阶段硬门禁，保单Reveal写/旧Pane双观测/实际outcome/可信journal/全部ownedquiet后仅实际out子集恢复，不扩大白名单或伪修ctime。3497/srcfa6 prep2实际driver0/official1，setup先败未达674；out15500保护及Reveal恢复成立，完整.build保护失败，静态链不称逐次writer。结果目录发布中、E未接入，实际tmp哈希见plan；本轮不源码/编译/lint/AST/module/tests/runtime/toolprep，不动B工位/主WIP，不重跑/after，业务old-red/new-full/真实默认编辑器after仍未来门禁。原看板全文保持前缀。
