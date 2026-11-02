---
title: "Agent Profile 内容有效性与无损编辑"
type: plan
status: accepted
phase: M7
updated: 2026-11-02
summary: "D1398完整Profile合同已签收；A候选15源码及自动层已通过，仍accepted待专题Gate、集成和真实安全门，D1398全局push hold/D1395独立open。"
---

# Agent Profile 内容有效性与无损编辑
状态：执行中。负责：agent:codex。范围：D1398完整Profile模块；方案规则16 C0/I0/M0已签收，A候选源码/自动层完成，待专题Gate、集成与真实安全门，仍accepted且D1398open；未提交、未合入、未push。

覆盖需求：PRD-025已有Agent档案编辑能力的完整性修复；不新增PRD、不提升产品状态。关联：[D1398](../progress/deferred-gaps.md)、[Engine catalog SSOT](../../docs/systems/workbench/engine-catalog.md)、[本波看板](../parallel/active/tools-wiki-wave-2026-11-02.md)。

## 1. 已证问题与有界基线

基线为merge干净本地保护性提交`ca3c2de9c0a4d38211b758aa08ee65546a2475d4`：19owner专题已获独立CommitGate PASS，D1397仅本地代码/自动层closed；Node24两编译目标0、Node747/0、browser同源码/产物复用445/0、私有精确19新绿/旧19业务错侧证据保留。不是已发布基线，也不是D1398验收。

只读核IDE New未传systemPrompt、AGENTS编辑可组出空正文；PIN`027ab7ed03ac5b64023ed6090f8610b22cc2b8ac`的loader先写AGENTS及sidecar后reload，blank body返回null而无多文件rollback。现有有效custom profile可变不可load并被List跳过，公开同id Save因已有AGENTS、Delete因先loadnull而不能修，构成P1；New同形缺prompt为同域P2。正常PIN Model/Tools从完整baseline派生会保非空prompt，不能把这些正常路径当已证空写。实际New/空保存未执行，不声称用户数据已损坏；四PIN源码hash及排除链见[运行证据](../progress/tools-wiki-wave-2026-11-02-evidence.md)。

本slice一次覆盖New、AGENTS表示、全部最终Profile写与标准多行输入，保既有owner/reservation/draft。后端多文件事务缺陷是边界，不在本仓换PIN、改引擎源码、自动修删坏目录或虚构回滚；不解释或关闭D1395有效own2 Save来源未定P2。Config/raw等未审域不扩大到本slice。

## 2. 工位、授权与冲突域

Astra工作流裁决及父采纳：不变量1限制关仓中新功能轨；D1398是当前P1的必要closeout-remediation，允许仅A从已验ca3及本文正式docs commit创建`codex/profile-content-validity-A`。旧`codex/tools-display-lifecycle-A=1ec07a675d5b881ec5fdafcbd9f30598a72dcd31`保ref与tip，禁止checkout-B/reset/stash/restore/clean；准备时A干净、旧tip为ca3祖先、A cwd无活动写入进程，正式分支尚未创建。

B仅只读F候选/方案准备，不采F`ad6a35b50bc`、不继承其171结果，不实施独立Clipboard生命周期；C/D/E/F在途候选及人类主仓WIP不接管。旧wave尚未闭，不宣A/B idle、槽释放、P6完成或merge parked。D1398解除后真实P5–P7结束才可开启B独立F功能轨，无需另向人类确认。

| 唯一作者/执行者 | 冲突域与责任 |
| --- | --- |
| A生产/测试作者 | common纯内容helper与测试；node saveAgentProfile及真实字节测试；Agents/AGENTS/Tools及其测试；标准Dialog opt-in多行能力及真实DOM测试。按整个Profile模块一次实施，不拆19个入口任务。 |
| integration | 唯一docs/Git/编译、lint及测试通道；冻结manifest后先actual-process quiet再串行检查，Node显式24.18.0，各槽out/.build与可写Copilot包隔离。作者不自跑检查、不改共享文档。 |
| merge | 审签/文档/最终串行集成；本修复不在merge直接写prod。主仓、外部槽、旧own2现场与旧CDP37567不动。 |

具体源码域为`platform/universeAgent/common/universeAgentAgentProfileContent.ts`（新纯helper）及common测试、`node/universeAgentConnectionService.ts`/既有node与byteIPC测试；`conversation/browser/engineAgentsSection.ts`、`engineAgentAgentsMd.ts`、`engineToolsSection.ts`及对应`test/browser`现有文件；`platform/dialogs/common/dialogs.ts`、`base/browser/ui/dialog/dialog.ts`、`base/test/browser/ui/dialog/dialog.test.ts`，仅必要局部Dialog textarea样式。Model补丁helper原则不改，由最终Profile门保护。browser unsupported保持原unsupported；client、grpc、DTO/proto不扩，不碰Settings/native确认/新窗口架构。

## 3. 共同内容合同与node硬门

`DTO.systemPrompt`是原Instructions raw body权威，必须实际为string且有效非空。纯common helper只返回稳定内容问题：在临时检查值上，先仅去除尾部码点不大于U+0020的字符，再用与PIN Kotlin trim/isBlank相同的空白规则判非空。顺序不可互换；纯NUL必须拒绝，Unicode空白后尾NUL与NUL后Unicode空白须分别以PIN顺序给独立预期，不能把控制符/空白并集全删后混判。FEFF等JavaScript trim与Kotlin集合的差异必须据钉死JVM的独立golden实证确定，不能凭记忆指定。不以JavaScript trim代替、不全局删除C0、不改原串，也不解析raw body里看似frontmatter的内容。合法`---`、nested frontmatter样正文与CRLF都可为真实Instructions。

公开mapper把summary、usage、detailLevel三个proto-default字符串带入preset；PIN writer据非null字段写outer，并在raw body之前固定闭合。metadata值含换行/`---`可使first closing提前，却不能截掉raw后缀；metadata伪body不能代替原Instructions必填。用独立literal golden按PIN实际字段次序、默认空字符串、metadata换行分隔符、C0/Unicode混合证明原rawbody门对blank安全足够；生产不克隆PIN YAML/writer。该证明不等于metadata全roundtrip安全、引擎事务或完整YAML支持。

UI各层与main消费同一问题语义/本地化Instructions提示。node `saveAgentProfile`沿c3既有owner优先规则，先验证原owner并固定transport，再复制最终profile所需标量/数组形成不会受caller后续突变影响的快照，校验该快照并把同一快照原样交同一transport；不能验一份、发另一份或跨await重取profile/owner。current owner+无效内容0 transport调用、健康/重连不变；stale owner即使内容也无效仍优先固定Cancellation。原真实当前backend业务失败及晚结果/UNAVAILABLE归属规则保留，内容拒绝不走transport失败/健康降级路径；ChannelClient不从cache补owner。

## 4. 标准New对话框与单层AGENTS表示

New使用标准Dialog的Name+必填多行Instructions。仅Name trim；Instructions使用真实控件读回的DOM实际value，允许控件把CRLF/CR规范化为LF，不再额外trim或解析raw frontmatter，不造默认prompt、不新增本地profile draft。New没有旧DTO rawbody回填路径。无效输入保modal及字段，取消或原owner失效不发RPC。

`IInputElement`/`IDialogInputOptions`沿现有input→browserImpl→Dialog.inputs opt-in多行，复用InputBox flexibleHeight产生真实textarea；只适用于text，password误配仍单行password。限制最大高度、窄窗按钮可达；多行plain/Shift+Enter都不提交，单行Enter沿原行为；IME composition不误提交，Tab/ShiftTab/Escape、验证、主题和焦点仍走标准Dialog。不得renderBody塞独立textarea绕过Dialog输入/焦点收集，不改变native确认或所有现有单行调用者。

AGENTS产品formatter始终生成独立且可解析的outer，metadata全空也保空outer，例如`---\n\n---\n`后接raw body。Save只拆第一层，不递归、不按字段相等猜用户层意图；正文自己像frontmatter时保空outer，不能删这层后再猜哪层是metadata。删除outer单字段传undefined/明确空值，删全仍保空outer；用户去整个outer、剩普通body时保持既有清metadata语义；未闭合头保全文且不清旧metadata。合法raw `---`/nested不被额外递归解析；换行原串保持只限下面定义的“整份编辑内容未变”分支。edited/New使用DOM实际value，允许CRLF/CR→LF，不额外trim或解析raw body里的frontmatter。PIN读回本身会trim，不能承诺读回首尾空白字节不变。

每次合法load先保留原DTO rawbody，再在formatter内容赋给真实控件后读回完整display baseline；必须保存这两份不同值，dirty只比较DOM完整内容与display baseline，不能拿rawbody当显示基线。Save开始只有DOM全文严格等于该display baseline、且原profile/owner/编辑context仍有效，才允许使用配对的原DTO rawbody，随后仍走最终profile内容校验；不凭dirty bool授权，也不回填用户清空意图。只承诺最终整份编辑内容未变：用户编辑后又把DOM全文完整还原到display baseline，在原context仍有效时也可使用原rawbody；没有完整还原则按DOM实际编辑值组装并校验。

rawbody与赋值后读回的display baseline必须作为绑定原profile/owner/编辑context的一对同时建立、更新或失效，不能只刷新其中一份。clear、换目标、owner失效或dispose作废该pair；失效编辑context直接取消写，不能重捕当前新owner给旧raw授权，选回同id或再次收到同值也不能让旧pair复活，须合法新load建立新pair。测试编辑setter赋值后读取真实DOM value，与既有display baseline比较dirty，不得建立或更新rawbody/display baseline pair；仅合法加载或已接受重新加载可成对建基线。

明确迁移`engineAgentAgentsMd.test.ts`两条旧有损display预期及Engine catalog中“字段相同不再套第二层”旧规范，不保unused legacy分支假兼容。真实section必须覆盖load→不编辑Save→捕获DTO，不能只测formatter/helper自己。

## 5. UI最终写入门及既有合同保留

同一pure helper检查所有最终组装profile：Agents New/createProfile（含无参、partial及派生创建）、Markdown merge后、Model/AgentTools merge后、独立Tools Save/immediate toggle。只验dialog字段或旧baseline不够；不得用旧prompt回填掩盖用户清空意图。

无效内容0RPC，保现有dirty/draft/pending与原选择；不新建busy/reservation、不清除旧预约、不追加refresh或重新选目标。内容错误必须保同一Instructions原因，外层公有bool false不能又画成generic backend failure；owner取消仍unconfirmed，当前真实backend失败保原语义。可在局部内部结果表达区分原因，但不破坏既有bool公共合同，不重造整套late-edit生命周期。

既有Models/Skills/Memory strict、SessionDelete、19owner独立参数/IPC/node捕获，Tools per-target预约、late edit重基、Info scope、固定行刷新/焦点全部保留。旧owner19中意在表示“有效保存”的无prompt正例fixture逐条显式补合法body；不全局stub自动补prompt、不删/放宽旧断言，明确无效case仍保持无效。

## 6. 四步执行与可验DoD

1. **纯内容门与main边界**：落common issue/helper与独立literal/PIN-default顺序golden，node在原owner优先捕获后校验并发送同一最终profile快照；真实byteIPC验证绕UI无效0transport且health不变、stale owner优先取消、合法同owner恰一次原DTO；caller突变不能改变验证/发送内容。
2. **完整Profile产品流**：一次落标准opt-in多行Dialog、New字段、单层outer的无损formatter/parser及UI全部最终写门；同步必要旧测试/SSOT合同，保取消反馈、dirty/pending/reservation和正常Model/Tools派生，不拆散模块。
3. **冻结后唯一自动通道**：固定源码/产物manifest，Node24 compile-client→focused lint→common/Node/真实Dialog与相关section官方suite；内容literal含missing/空串/空白/C0/Unicode及真实metadata默认序列。真实Dialog验多行DOM粘贴、Enter/ShiftEnter/Name单行/必填/焦点/Tab/Escape/IME/password误配；真实section验samefields、no-meta custom、rawFM-only、nested、metadata逐项/全删、去整头普通body及未闭合头；专门用真实控件覆盖CRLF/CR原DTO经赋值规范化后未改保存仍发配对原rawbody、真实edit按DOM实际value、edit后完整还原display baseline按未变规则发送原rawbody。测试编辑setter赋值后读取真实DOM value，与既有display baseline比较dirty，不得建立或更新rawbody/display baseline pair；仅合法加载或已接受重新加载可成对建基线；clear不回填，profile/owner/编辑context切换后旧snapshot不得授权或复活，所有分支仍final校验。验New合法/空/取消/ownerlate、createProfile()无参/partial0写、Markdown清空保dirty、Model/两类Tools最终缺prompt保pending。旧红仅用旧已有runtime入口、独立新测试与同目标新正控，不因新helper export缺失当红；保c3 owner19/SessionDelete/strict和Tools预约/晚编辑/焦点/Info全部原合同。client/Copilot完整两目标串行、可写依赖私有、working/staged/generated/docs/原hooks及非作者OV后才签代码层。
4. **明确授权后的真实分层验收与集成**：自动源码门完成后由父明确授权runtime阶段，唯一checker从本波已集成源码启动独立默认editor和已钉死engine；先核50061不二起，不碰旧CDP37567。保护既有6项与当前own2只读现场，只用新唯一prefix的自有有效profile测试New多行成功/List读回（按PIN trim边界，内部多行/raw `---`保留）；无效New/清空自有正文应在IDE门阻断，不能故意向PIN发送badbody。transport spy证明0RPC，真实List/文件hash只证明0持久化，无wire计数不得宣称真engine零RPC。任何意外写立刻保全自有证据、停该写验证，不自动修删坏目录；只清理另获授权且仍合法可列出的本波新样本，旧无效目录/own2/既有数据不动。独立源码/运行/真实证据与父采纳齐后才可关闭D1398；再真实执行旧wave P5–P7，才启B独立后续轨，不把本地commit当全局交付。

知识同步在实施收尾更新Engine catalog、test-profile与必要测试合同，过程更新本方案、D1398、status/pool/旧波看板并跑生成索引；不改loop子模块。D1395真实Save来源未定独立保留，PRD不升级。环境不足或产品层未验则如实记具体边界，D1398不提前closed、不push。

## 7. 规则16与当前状态

本文独立全文规则16首审C0/I1/M0，父采纳I1：真实控件会规范化换行，原DTO rawbody与控件赋值后读回display baseline必须分离。§4/§6已改入整份未改与edited/New分支、context绑定及真实控件DoD；窄复审仅余两句测试编辑setter误建基线，已统一为读取DOM并与既有baseline比较dirty，不建立/更新pair，仅合法加载或已接受重新加载可成对建基线。Astra明示两句生效即可闭合I1，父实际核SHA acd8deea34fa8cc401128e5db5928de3f3953e29dc931a514de7834222a818e8及正文后采纳条件批准，最终APPROVED C0/I0/M0。

签收时accepted仅表示完整合同审签；随后独立docs19a7交接A新分支并保旧Tools ref/tip，父明确授权唯一作者后才实施。当前A源码/自动层已完成，但整体仍accepted，专题Gate、集成/真实安全门未完成，D1398不关闭。所有检查保持唯一actualquiet通道，旧wave未闭、B只读、global push hold与D1395边界不变。

## 8. A候选自动层与尚待门

固定c3 manifest `a82448d88067b218936a12706d88f765771efee36890f6717feec130863cb365`：15path/8prod7test，仅相对c2三处合法fixture/engagement迁移，8prod不变。Node24 client与Copilot原两目标顺序执行各0；官方Node/common774/0按c3十份JS逐字同复用，browser13实际526/0。lint两scope真实exit1、14TS联合覆盖0errors/11条逐19a7上下文既有warnings、0新增；Astra限定旧test位置/原imports的基线例外，不称lint全绿。

同一私有context25元数据中新Node2/0、browser10/0后，叠ca3旧18产物为Node0/2、browser0/10：Node仅首undefined未获Instructions错误，未到后续循环/tuple；UI5项实际Saved DTO丢body、2项outer显示先停、3项Tools观察save1及错误清dirty，不能概称12项真实PIN损坏。原loader/报告读取器错误保留，不计业务红。真实A out11975/merge out11973、私有3tests与15源码均保持；全证据见[阶段记录](../progress/tools-wiki-wave-2026-11-02-evidence.md)。

必要知识/行动层正与源码形成同一A主题候选，尚未commit/真合。D1398真实安全门只在源码/自动独立签收、A主题commit、真三路merge及merge Node24实际产物核定后，另获父明确授权才执行；现无窗口/engine写，旧own2/无效目录/既有6项只读保留。D1395独立open、PRD不升，不把本段自动门当整体implemented或全球可push。
