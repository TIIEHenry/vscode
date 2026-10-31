---
title: "Conversation lease：补齐本地 fixture 与隔离 emitter 附写"
type: plan
status: accepted
phase: M7
updated: 2026-10-27
summary: "A真实L1链达676断言；B固定3fc单次official-fail隔离/记录/限定恢复经原Astra C0/I0/M0/root采纳；正式old-red、新13/完整Reveal与默认编辑器after未达，plan仍accepted。"
---

# Conversation lease：补齐本地 fixture 与隔离 emitter 附写

原稿固定 E parent `8033a3c23ba2b0550e817c9cc4fdebf4d12a4478`；规则16窄改固定clean parent `b349f6c1c07de340a7119d20d420bdcaa7d67d73`；accepted文档收口固定clean parent `db02c9c815f1bb7517910ba3bf9583a562709e57`；本次A片候选固定clean parent `ea92e8da62ab9c12da0681867114acbe187c1004`，仍按两片边界推进，不导入 main / merge / Sources 后来增量。既有 [lease 合同](conversation-visible-lease-recovery.md)、[setup 诊断方案](conversation-visible-lease-setup-diagnostics.md)与[历史 after 输入边界](../progress/lease-after-inputs-20261027-evidence/INDEX.md)保持。**本窄plan已独立 `accepted`：root采纳原 Astra 固定db02c9窄验C0/I0/M0，I1/M1在方案层全关；方案已可供后续实施；root现另独立授权的A片最小候选见§8，A片静态peer与真实接入已完成见§9；B工具源码准备及v3审查完成见§10；后续整包与唯一诊断已独立授权并验收，当前范围及限制见§11。**

## 1. 固定事实、来源与未达门禁

唯一 baseline 已在 `3497bdc01caa188e5ff37e8877168d50b0a398d0` / src `fa6f7fe9f339963dd9f4190f44aa17e45f6ad731` 消费一次 `/tmp/vscode-conversation-visible-lease-setup-diagnostics-8033-20261027-prep2`。其 Reveal 与 E 8033 为同 blob `c7710eb939872d378394c7084ccf95bb50f4b4c2`，81494B / SHA-256 `404034f9dd15c2cf6143c44b624b0dbb398da25b27f16d962a2f01bef982388d`。本作者只读原件，没有重跑。

- driver 实际 exit0，official runner 实际 exit1；checker / lint / dry / emit-Reveal 各0。官方恰好2 tests：L1 fail1、meta pass1，10对 hooks 平衡。driver0表示该诊断协议按实际 outcome 收束，不是业务 green。
- 原错误仍为 `real engine ConversationEditorPane must open`；诊断显示 active Pane 为 `workbench.editors.errorEditor`、非 ConversationEditorPane，已有 openErrors 为 `TypeError: Cannot read properties of undefined (reading 'onDidChangeOffer')`，嵌套栈首在真实 ConversationIdentityStrip 构造。
- 主 stack 的 fresh map 为 **445→456→433→544→655**。结合固定 L1 先 await setup 的控制流，本次 setup 先败、未到该固定源的目标断言674；不是仅由 boundary=false 推断。qualification 原文保留 `expected old-red boundary not established`，不计业务 old-red / new-green 或 after。
- 全部 owned quiet 后，只恢复实际有资格的 Reveal out；实际完整 out 15500 路径保护 / 恢复结论仍成立。原报告的 restorationComplete 不扩大成完整仓库保护通过。
- root 另核本次 `.build/log` bytes 未变而 metadata 漂移，故**完整 `.build` 保护失败**。固定源码存在 reporter 附写调用链，但原运行没有覆盖该附写的逐阶段可信 writer journal，不能据静态链声称某次 dry / emit 的实际 writer。

结果入口 `dev/progress/conversation-visible-lease-setup-diagnostics-8033-outcome-20261027-evidence/` **发布中，E 尚未接入该目录或对应提交**；不能把计划发布写成已合入。下面绑定实际 tmp 原件；root 报告原始交付 closure 为281个 regular files / 83,460,780B，prep1原始 closure为85个 regular files，与作者递归 metadata 的含目录 path 对象计数不同。

| 实际 tmp 原件（均在上述 prep2 目录） | bytes | SHA-256 |
| --- | ---: | --- |
| `diagnostic-report.json` | 184385 | `349bf2a40b003c545da716f35a7d8b60213be08597502015e2488fc76eda8b21` |
| `diagnostic-L1.qualification.json` | 23799 | `ba8e5627074cd3923eeb03d2899922515c28debd21cbb370f3870d35aed042e0` |
| `fresh-Reveal-source-map-report.json` | 641 | `3f0f0dba2243cbe82675ca7c83b4b3e20713477d5316dc497ed8cd02696aa289` |
| `guard-after-restore.json` | 4214388 | `82129aa408f7688d8a48ed78da4cd6a7c8f0b34dec0d1156409d0cbaf432c6d1` |
| `restoration-scope-audit.json` | 3823 | `b4bd7cad9824a259ec07bc153cbde1cd5d3feda57cea06678ec773544d788e6c` |
| `execution-consumed.json` | 207 | `e2865cafdc2a0d5761539534a2c255c80afa48d2ce8e7828f8cc703453e4e659` |

原件、consumed 标记及原 guard 不改。该新 out guard只给 Reveal 新 ctime `1793100193532575159`，不能盲用旧46fc的 Reveal ctime；未来 baseline 须另获 root 核定实际起点，且不能把 `.build` 漂移纳入“恢复成功”或事后授权列表。

## 2. A：仅补 Reveal 本地 fixture 的既有服务

原 Astra 已高置信度确认、root 提供并采纳为本稿设计输入的固定源码事实如下；来源为原 reviewer / root 直接消息，不伪作作者运行或 formal raw peer：

| 固定3497源码位置 | 静态事实与含义 |
| --- | --- |
| [Reveal 本地 stubLensRuntimeServices](../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts#L348) | 已补 timeline / review / SCM 等并调用共享helper，漏 `IConversationWorkRootMount`；本地 TestInstantiationService 不继承生产 singleton 注册。 |
| [共享 stubConversationTimelineLinkServices](../../src/vs/workbench/contrib/conversation/test/browser/conversationTimelineLinkTestStubs.ts#L83) 的83–86 | 这里只补 window / chat；不能把共享helper内容或83行位置误写成本地helper。 |
| [IdentityStrip](../../src/vs/workbench/contrib/conversation/browser/conversationIdentityStrip.ts#L163) 的163 / 248 | 构造注入该 token，随后直接读其 `onDidChangeOffer`，与本次 openErrors 的缺值读取相符。 |
| [WorkRootMount](../../src/vs/workbench/contrib/conversation/browser/conversationWorkRootMount.ts) | 已有无服务依赖的真实 `ConversationWorkRootMountModel`；无需新建服务替身或改生产注册。 |
| [Lens.test](../../src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts#L560) / [SessionSplit.test](../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionSplit.test.ts#L94) | 已有 `store.add(new ConversationWorkRootMountModel())` 的本地 fixture 用法可对照。 |

A 获得独立实施授权后，源码白名单只有 Reveal 一个文件：从已有 WorkRootMount 模块导入 token 与真实 model，在现有 `stubLensRuntimeServices` 里沿用原 TestInstantiationService / DisposableStore，注册 `stub(IConversationWorkRootMount, store.add(new ConversationWorkRootMountModel()))`。实例归该 fixture 现有 store，保留原释放路径；不新建全局 / singleton / 跨 fixture 共享实例。

除上述 import 与一条本地 stub 外，原 DI 其余项、业务 fixture、engine helper 与诊断后缀、openErrors 收集 / 真实传参 / 默认参数、原3000ms / 事件 / finally cancel / cleanup、13新 / 26旧 / defaultQuiet 及全部 assertions 逐字保持。不给 model 填测试 offer，不手动 fire / bind / acquire，不延长等待，不把 setup 错误改成业务断言成功；生产 Pane / Lens / IdentityStrip / WorkRootMount / 注册均不改。

A 的候选交付应包含固定 commit / src / Reveal blob与SHA、精确 diff，以及仅逆掉新增 import成员与 stub 后整份 Reveal 等于8033的字节证明。先 root 独核，再原 Astra 源码 peer，再由 root 决定真实三路接入唯一 baseline；规则16或本稿通过均不能替代这些门禁。作者本轮不做 AST / lint / module import / checker / compile / emit / tests / runtime 或工具准备。

root 另提供既有 native 输入事实：本次实际1130 loaded集合含 `conversationWorkRootMount.js`，7615B / SHA-256 `77491aa9942ec2fb316ab3a5c705fbfa6602621c1d47632ad4223ef569cb2722`；其 inline sourcesContent 全字节等 fixed3497及当前源，source blob `ee7433788933ee407b5202a98a57bd4fb4bbeb93` / SHA-256 `736b683b191a9c54fa06fd221bab157897a4658c8eaa31f1dbd024c89cc34326`。producer compile10仍只具 `historical-declared-input-only` 资格；该 loaded 事实不证明 model 构造覆盖或新发射。未来新增 import 可读核定的既有 native，**不因此扩大单Reveal发射目标**；未来运行须重新采 actual loaded 字节身份。

## 3. B：唯一 baseline 后续隔离 reporter 附写

B 属于独立工具修订，只能由**非作者的唯一 baseline executor**在 root 单独释放工具准备后开展。E 不进入或修复 B 工位，不动主工位 WIP；不改产品 build 源码来方便测试，不回写 consumed prep2，不先运行再补保护。本稿不创建 bootstrap、patch、driver或新工具目录。

### 3.1 固定静态输入与待查选项

root 只读固定源码提供：仓库 `createCompile` 路径使用无 id reporter；[reporter.ts](../../build/lib/reporter.ts) 61在结束时 `fs.writeFileSync` 固定 `.build/log`，81–85在模块顶层 `fs.mkdirSync(buildLogFolder)` 并吞异常。只改 cwd不足以覆盖这两个调用。旧 scratch emitter 15先 require ts / gulp / es、17动态 import compilation、18 util、19 transpiler，55 createCompile / 56 stream；`binding.mjs` 只用 Node内置与Git读取。以上是静态附写能力，不是原运行逐次 writer 证据。

未来准备者先在届时固定源码上留存以下只读调查，再给出精确工具 diff；在隔离建立前不得 import 任何仓库 / 编译依赖：

1. 核 createCompile / reporter 的实际签名、默认参数、调用点、固定 path 的求值依据与 no-id 条件；核是否真有可关闭附写的现有接口。**本稿不假定存在 logDir / 环境变量 / reporter注入配置**，也不凭参数名猜测可用。
2. 核 reporter的 fs import 形式与最早导入链、顶层 mkdir 的实际 path/options、结束写的 path/data/options及是否有其他写API / 缓存；核 binding及所有预加载不会先捕获未隔离的 fs函数。
3. 核当前out单写 hook、streamToPromise、reporter结束和进程退出先后；隔离须在 require(ts/gulp/es)、import compilation / util / transpiler 之前安装，并持续至子进程所有流收尾 / 退出，不能在 await stream前撤掉。

| 选项 | 本稿取舍 |
| --- | --- |
| 现有受支持关闭 / 目录参数 | 必须先证实签名和作用域；若发现更小接口，交root / Astra重新核方案，不凭空采用或宣称已存在。 |
| 仅改 cwd，或给未知 reporter id | 前者不覆盖固定路径；后者未证实语义且可能改 reporter行为，本稿不采用。 |
| 改仓库 build / reporter源码、扩大 `.build` 可恢复白名单 | 不采用；会改变产品构建或放宽保护，超出本片。 |
| scratch子进程启动处的两项精确 fs 重定向 | **拟采用的最小候选**，下节列出可行性证明条件；尚未实现或经工具审查。 |

### 3.2 两项精确重定向候选

在每个有编译依赖的阶段子进程内，先保存 Node内置 fs原函数，只将**唯一核定 repo `.build/log` 的 writeFileSync**改到该阶段独占 scratch日志；将 reporter **唯一核定 buildLogFolder 的 mkdirSync**改到对应 scratch目录。实际 `data` / `options` 原样交给原函数；不伪造成功、不丢弃日志，也不采用整个 `.build` 路径前缀映射。路径用固定 repo身份与 source求值结果核定，限定实际参数类型 / 绝对目标 / symlink身份；fd、未审查别名或其他调用形态不得自动纳入。

可行性须由未来静态调查及工具 peer证明：

- 补丁先于任何相关依赖导入；若有 ESM named built-in fs导出，核 Node实际版本是否需要 `syncBuiltinESMExports()`，并确保没有提前捕获的函数绕过。不能默认 global patch 对全部模块透明。
- 仅这两个已核调用允许改目标，原调用的参数及结果 / 异常可审计；mkdir仍调用真实 fs到独占 scratch目录，覆盖原模块吞异常的路径。异常或未知调用须置不可吞的阶段失败标记，由 parent判定；不能因 reporter自身catch就判隔离通过。
- 只有这两个精确目标可重定向；其他受保护src / `.build` / node_modules路径写尝试保留实际参数 / 错误与拒绝记录，置不可吞的失败标记并拒绝，不能改成任意`.build`前缀重定向。固定依赖的其他写API也须先纳入静态调用清单，未覆盖则不得执行；正常的其他fs操作保原语义。既有唯一Reveal out单写hook保留，写入/恢复资格须另满足§3.3许可与§4交核；组合patch须证明无提前return、替换引用或恢复顺序绕过out单写，不扩大repo写权限。
- scratch审计用预先捕获的原函数避免递归。每次 redirected mkdir / write保留阶段、目标及实际PID/start、父资格、token、实际调用栈 / 来源、原 / 新路径、实际data bytes/SHA与options、调用次数、intent / completed / error；只记录真实事件，缺调用不填预期次数。原log及目录metadata始终受完整 `.build` guard保护。
- 两项 wrapper只存活于该独占子进程；不修改仓库模块、node_modules或主进程的全局fs。导入路径 / Node导出模式 / 并发语义若无法证明可隔离，即停止并交root重新定案，不退回生产源码patch、整体路径重定向或写后恢复 `.build`。

### 3.3 完整保护必须成为阶段停止条件

在第一项会加载编译依赖的动作之前，固定全量 `src` / `.build` / `node_modules` 起点：完整path-set及lstat：含ignored路径、root及所有descendants的类型 / mode / size / mtime_ns / ctime_ns / symlink target；固定HEAD/src、既有bound source/native/tool哈希、cache links和已有out guard。内容核验限于这些已绑定输入 / 产物与新增reporter精确日志data bytes/SHA，不要求每阶段对整个node_modules内容重新hash，也不声称所有文件内容已独立hash。schema / 排序 / 计数口径一次冻结，同一阶段前后不得更换或忽略新旧路径。所有证据写scratch，禁用Node compile cache与工具自身cache。

**emit阶段在编译stream真正完成后、首次Reveal journal intent / out write之前设置父写入许可门**。spawn前的parent单phase / 单path资格只允许启动该阶段，**不等于stream后的写入许可，也不单独授予恢复权**。child用本阶段唯一请求nonce/ID请求继续；parent独立复核src / `.build` / node_modules全metadata、限域bound bytes及该时点out基线，不能用child自报代替，也不能等Reveal写完才发现漂移。

parent实际授予的不可混用grant须先在可信parent记录落定，再向child发许可；绑定该唯一请求nonce/ID、parent核实的实际writer PID/start与token、phase / 唯一Reveal path、固定fresh bytes/SHA、该次独立guard结果及其证据hash、grant事件顺序 / 单调时间与本阶段有效期限，并给出permit ID/hash。有效期不能超过继承的本阶段单调deadline；拒绝、撤销或期限到达均有真实记录，不以预建phase对象或child请求记录冒充已授grant。child必须核到对应grant才可尝试首次intent；intent消费此许可一次，completed引用同一permit/intent，不是第二次消费，不得跨phase、跨path、重放或重复开始写入。

out journal的intent与completed均绑定该permit ID/hash及同一请求、PID/start/token、phase/path与固定fresh bytes/SHA；保留实际结果，partial / uncertain不能伪填completed。parent的实际grant记录、可信journal和恢复审计必须贯通，具体交叉资格见§4；只有旧spawn资格或未绑定permit的intent不够。

**许可请求、guard、回复与child等待均纳入既有ownership/watchdog的同一个单调deadline**。parent在现有alive监控loop内处理请求并继续监控退出/deadline，guard处理不得阻断该监控；guard完成后、grant前再核同一deadline。guard不能在期限内完成、parent失败/退出或无有效许可时，child不得无限等待、不得写intent / out，按既有停止收束处理。未来工具必须调整原仅监控退出/deadline的loop，不另加第二套超时、重新计时、延长预算或用旧spawn资格fallback。

每阶段终止并确认该阶段 owned quiet后，parent核全部保护范围与out资格；**检查通过才可进入下一阶段**。checker、lint、dry、emit、official run及finally都要核，不能只在最后报aggregate。任何src / `.build` / node_modules路径的新增、缺失或metadata漂移，以及限域bound bytes不符都是硬失败：停止后续业务、停所有owned、保留diff / 原件交root，不将漂移改成baseline、不事后扩大恢复集合。不以write后原bytes相同放过ctime改变，也不touch / utime / 重写未授权路径来伪造ctime恢复。

若发现附写未隔离或scope不足，该次新driver一经消费仍只算该次实际失败；不得自动重试。静态调用链、未看到漂移、成功report三者均不能代替实际writer journal。

## 4. 保留原单写、双观测与恢复协议

未来工具必须逐项继承既有单Reveal诊断协议，不能用本稿重建一个较宽的运行入口：

- 唯一baseline、共享锁 / 全局空闲核定、唯一source/native与fresh工具身份、root独立execution release及one-shot consumed；源自A的候选先完成peer / 真实接入。准备许可不等于执行许可。
- 只允许fresh Reveal测试JS作为潜在out写入目标；旧Pane及其他out / native / WorkRootMount始终只读，不自动Pane emit、model emit、fullnew或fullcompile。
- 两个真实renderer观察目标仍为fresh Reveal与旧Pane；分别收 `scriptParsed` + `getScriptSource`并核完整字节 / SHA，不靠manifest代替实际loaded、不force import制造观察。官方选择仍只L1 + official meta，真实outcome / 官方统计 / hooks / exitcode独立记录。
- 按唯一单个LF紧接 `Engine Pane setup diagnostics: `拆主stack与诊断JSON；只有主stack参与业务mapped frames，嵌套openErrors.stack只作诊断。目标断言按新固定源的真实map冻结，不为674保行号。boundary未建立写 `expected old-red boundary not established`并保实际outcome；仅actual stack + fixed控制流可定位时声明未达，不能定位为unknown；L1 pass如实记pass，不借本诊断授业务red/green。
- 恢复审计必须交叉核定**实际PID/start + parent启动phase/path资格 + parent实际已授grant + 同phase且绑定该permit的可信out journal**，独立核请求nonce/ID、permit ID/hash、PID/start/token、phase/path、固定fresh bytes/SHA与guard结果一致；parent grant必须先于intent，并在**该intent发生时**有效、未撤销且未过期，无跨phase、重放或重复消费。不能只检查spawn前资格、child自报许可或恢复时的当前permit状态。
- 缺失、错误、不匹配、parent未实际授予，或在intent之前已失效/撤销的许可下发生写入，均保留协议违例及实际证据；**不得由旧spawn资格、漂移或intent存在推导恢复权**，不自动将该路径纳入恢复。反之，已经在有效许可下发生的partial / uncertain intent，仍按原可信journal规则收窄实际恢复子集；不得因为之后阶段结束、permit到期或撤销就抹掉该intent发生时已取得的授权恢复资格。无法证明时间顺序/有效性的情况保持不确定并交root，不补造grant。
- 只有审计核定的实际completed / partial / uncertain out子集可在全部owned quiet后恢复；未写路径及ctime不动。以上不扩大out单写范围，不给src / `.build` / node_modules任何新恢复权限。
- **任何结果 stop → owned quiet → qualified restore → 全保护复核 → 原件交root。** 完整src / `.build` / node_modules保护失败不得被out恢复成功覆盖；无权限修复这些范围，失败如实保留。future起点须绑定当时root核定的实际guard，不盲用历史54fe / 46fc / 82129a。

## 5. 顺序、交付与完成边界

| 步骤 | 必要输入与输出 | 当前授权 |
| --- | --- | --- |
| 方案 | 本固定docs commit → 原Astra规则16只读 → root核验并改稿 | 方案文档`accepted`；各片授权按本表记录，不附带运行许可 |
| A候选 | root单独放行 → Reveal最小import/stub → 字节逆证 → 原Astra源码peer → root真实接入 | 已独立授权；固定4f264源码peer C0/I0/M0/root02ff采纳，ed565真实接入/src3dc120，A静态接入完成；本次真实L1前置到676断言见§11，仍无业务red/green信用 |
| B工具修订 | root单独放行唯一baseline准备 → 固定静态调查 / 两项隔离 / 全阶段guards / 新工具diff与哈希 → 工具peer与root核定 | 已独立准备并经v3源码/整包peer C0/I0/M0与root采纳；旧prep1根24不promote，新prep2实际使用v3，见§11 |
| 本次一次执行 | 独立root release、fresh身份 / 起点 / consumed、实际outcome、完整原件与恢复边界 | 独立root五字段激活后仅一次执行，已永久consumed；driver0/official1，原Astra实际验收C0/I0/M0/root采纳，不重跑 |
| 正式业务与产品验收 | 精确旧源合格L1业务old-red、固定新源完整矩阵与原Reveal回归；非作者真实默认编辑器after | 仍为未来门禁，不由本稿或诊断抵扣 |

- [x] 原Astra固定db02c9窄验C0/I0/M0，root020951独核采纳，I1/M1仅方案层全关；root另授本窄plan文档accepted，未授A/B实施、准备或执行。
- [x] A独立授权，固定4f264两新增源码peer C0/I0/M0/root02ff采纳，ed565真双亲正式接入/src3dc120；仅A静态完成，不代表真实setup已验证。
- [x] B另获准备授权、静态可行性/v3源码及独立整包peer C0/I0/M0/root采纳；本次完整保护阶段停止条件已核。
- [x] 固定3fc的prep2另获单次execution授权并如实交付；实际official-fail收束验收，不重跑，无after信用。
- [ ] 正式old-red / new-full与真实默认编辑器after另行完成，才评估旧lease方案实施状态；不升PRD / 旧D / 波。

## 6. 原Astra规则16与本次窄改（2026-10-27）

原reviewer Astra对固定b349f6正式为**C0/I1/M1**，由root直接转发会话消息，非terminal raw。root在ce09a4独核旧validate397/420–438/523–528后采纳I1/M1；本作者未新增源码/工具调查。[行动记录](../progress/sources-accept-post-read-authorization-checkpoint.md#e-lease-emitter父许可与恢复资格规则16窄修订2026-10-27)保留b349f6完整原plan、SHA、原Astra正式全文及署名/转发来源；原实际两项缺口C0/I2/M0与所有consumed原件保持。

I1仅将parent实际grant与journal/恢复审计连通，并区分intent时授权和事后permit状态；M1仅明确继承deadline及现有alive loop内的有界处理。原A片、B两项精确fs重定向候选、metadata/限域bytes、单写/双观测/实际outcome/停止恢复与未来业务门禁不扩大。db02c9提交时仍draft、待原reviewer窄验及root核验；后续方案签收见§7。两项重定向仍待未来静态证明/工具peer，未实施、准备或执行，不自动重跑或after。

## 7. 原Astra窄验全关与root独立accepted（2026-10-27）

原reviewer Astra对固定 `db02c9c815f1bb7517910ba3bf9583a562709e57` 的正式窄验为 **C0/I0/M0**，由root direct-message直接转发，非terminal raw。root020951 actual0独核parent/src、plan22659B/141行/SHA `e90e77d5398f3fa31f90d6ea8e351696b971e2c6f68897ccf3c194480bf7fcf9`、单篇plan diff及§1/§2/§3.1 wholeexact和完整grant/journal/恢复链后采纳；**I1/M1仅在方案层关闭**，现另授本窄plan文档accepted。[行动记录](../progress/sources-accept-post-read-authorization-checkpoint.md#e-lease-fixture与emitter窄方案accepted文档收口2026-10-27)保留完整db02c9 / b349f6原plan、原C0/I1/M1及新C0/I0/M0正式消息署名与直接转发来源，不洗掉历史。

差异口径：b349f6→db02c9的 **14240B / `f2a0d1e079e34ae4ac2b3c67c8b644be97421e967b730e69dfdc7e8aecf4af98`仅为单篇plan diff**；完整五文件diff为 **57962B / `ba5ed63cf5175c2e499726f8e57bc2a84ba277e467525a5209762c0ca0ec7de6`**。root另报其proof提交3a14d6已验，E未真实接入，不声称E合入或同步。

该次文档收口只勾规则16并将本窄plan由draft改accepted，表示方案已可供未来独立实施授权采用，当时未授A源码、B工具准备或运行。后续A片独立授权与最小候选见§8；B工具准备、任何运行仍待root分别授权，不自动重跑或after；两项fs重定向可行性/工具实现仍须未来独立审查。旧lease方案、产品/PRD/旧D/波状态不升，业务old-red / new-full及非作者真实默认编辑器after仍是未来门禁。

## 8. A片独立授权与本地最小候选（2026-10-27）

root d251c9 actual0独核ea92 accepted文档后，另以直接消息只授权A片source-only。本候选固定parent `ea92e8da62ab9c12da0681867114acbe187c1004`，不导入baseline/main/B槽后续增量。唯一源码范围仍是Reveal，新增两行：

| 位置 | 唯一新增行 |
| --- | --- |
| 既有import区 | `import { ConversationWorkRootMountModel, IConversationWorkRootMount } from '../../browser/conversationWorkRootMount.js';` |
| 既有本地stubLensRuntimeServices内 | `instantiationService.stub(IConversationWorkRootMount, store.add(new ConversationWorkRootMountModel()));` |

候选81721B / blob `feb55eeed2013c948ae487bdba8217887d2fc0b5` / SHA-256 `8a9c3245ae661b68e160c6a1c0d79924159618da7b342c5b09cd46caa1f35e61`。只删除新增import与stub整行，整份Reveal逐字还原8033/ea92的blob `c7710eb939872d378394c7084ccf95bb50f4b4c2`，81494B / SHA-256 `404034f9dd15c2cf6143c44b624b0dbb398da25b27f16d962a2f01bef982388d`。此整文件逆证保护原3s/事件/finallycancel、诊断/error处理、13新/26旧/defaultQuiet、全部case/assertions/cleanup及其余DI/helper；生产/model和其他源码不改。实例直接归原fixture store，不加offer或事件，不扩大未来单Reveal发射目标。[行动记录](../progress/sources-accept-post-read-authorization-checkpoint.md#e-lease-a本地workrootmount真实模型最小候选2026-10-27)保精确diff、正常metadata及原status。

当前只是**静态最小候选，源码peer待、未运行**，不是已修好真实setup的结论；plan继续accepted，B pending。作者不AST/lint/Program/checker/compile/transpile/emit/tests/runtime/toolprep/after或out/cache写，提交后停，交root固定身份核验及原Astra源码peer；root未来另裁正式接入/运行，不自动进入B或借方案peer取得源码/业务信用。

本次A片仅有上节两行授权源码变更及必要主题文档；作者校验只做docs generator/health/diff和只读字节/metadata核对。所有既有原件与历史失败保持，fresh保护仅界定本次候选区间，不补写旧连续性。


## 9. A静态源码peer与真实三路接入（2026-10-27）

§8是作者候选时点原记录，其当时“未peer”叙述保留。随后原Astra对固定4f264源码正式C0/I0/M0，经root02ff独核整文件逆证采纳；真实merge ed5650112ef887eb925a5f9ca8fc2c7055c2b7c4，双亲5e31574f7cc296f4cefe94ad7994d19559fd2522与4f2648d936508e300475c9cd52e5855a58c7ed93、base ea92，src3dc1205763451e60e70c1a8a84465613990aa526。仅Reveal取incoming，其余src全ours。两新增和整文件逆证逐字精确；helper/store管理和所有原case/断言未改变。root d278f5/e5c733已核全树/父身份；[完整接入证明](../progress/conversation-visible-lease-harness-work-root-mount-integration-20261027-evidence/INDEX.md)保所有历史/metadata/原件、五块两style重放及父首条LF。

这只完成A静态peer与源码接入，不证明实际Pane setup、L1业务红或新完整绿。Reveal source81721B与旧native147236B分列，Pane/native/out保持；没有Program/lint/compiler/emit/tests/UI/after/emitter准备或旧包再消费。整体plan继续accepted；B准备/静态可行性/工具peer及任何执行均另授。原driver0/protocol accounted/official1/out恢复complete与全.build保护FAILED/C0/I2/M0、lease accepted/Sources四窄implemented/产品门禁不改。

## 10. B 工具固定源码审查收口（2026-10-27）

本节仅记录§3–§4既定合同的工具源码实现/审查，不改原设计或扩大权限。固定70ee/src3dc120上的v1 C0/I4/M1与link补充、v2 C0/I1/M0均保留；v2已关闭I1/I3/I4/M1和link，v3以私有flag副本不可写/不可配置关掉剩余I2，原Astra窄审C0/I0/M0经root独核采纳。v3全24份快照/index/hash/line replay/unified精确，22份等v2，唯一代码diff为fs-isolation:166的两个布尔值；只有纯语法，没有候选运行。[完整源码证据与三轮原报告](../progress/conversation-emitter-isolation-source-review-20261027-evidence/INDEX.md)记录准确边界及后续工作流。

- [x] B静态可行性与parent-WAL选择预审、源码准备/修订；v3残余I2源码peer C0/I0/M0，root采纳。
- [x] 后续新prep2整包closure/178pins/独立whole-package peer C0/I0/M0/root采纳；旧prep1根目录仍未promote。
- [x] 后续另授五字段release/activation并单次诊断；冻结锚prepared0保持，实际consumed1分列，见§11。

本节源码收口时§5完整B门禁尚未勾选；后续整包/单次实际验收见§11，不能用源码peer替代。原8033 official1/全.build FAILED和业务未达不变，整体plan仍accepted，不升lease/产品；本次文档提交只改变docs/dev，未来包须另绑定届时HEAD，固定v1/v2/v3索引不追改。


## 11. 固定3fc单次隔离诊断及当前验收（2026-10-27）

本节是既定§3–§5合同的实际结果，不改协议或业务/产品门禁。唯一baseline在固定HEAD 3fc83b388a0977b36ecc8add7863d1f9a2a46eac / src 3dc1205763451e60e70c1a8a84465613990aa526 消费新prep2一次。整包与实际诊断均经原Astra C0/I0/M0、root独核采纳；[完整选中原件、授权时态与未出版清单](../progress/conversation-visible-lease-isolated-diagnostic-20261027-evidence/INDEX.md)是结果入口。

- A真实L1控制流已越过Pane-open前置，到固定Reveal源676:11的唯一lease断言。官方meta pass、L1 fail；主AssertionError为“catalog ready must restore this visible Pane lease without hide/reveal”，fresh JS645:14经本次inline map到676:11。接受真实前置链到达，不能把official1/L1fail写成测试通过或精确a4a业务old-red。
- B只验收本次official-fail路径：checker/lint/dry/emit各0，official1，driver0表示accounted-official-outcome。12份guard（阶段前后10加初始/最终2）、5份poststage与独立poststream证据通过。dry/emit各一次真实reporter mkdir与log写定向到各自scratch，原data [] / 2B、options、result、stack、PID/start/token均留；原.build/log bytes与实际mtime/ctime不变。
- parent真实grant持久化先于deadline内的唯一WAL intent；1 intent + 1 completed，partial0。仅Reveal发射254747B / SHA-256 dbbfdd84f16399d877f67e736204ba60fc7df71b63273bb2ba2218bb8001a9ea。25个owned PID/start quiet后仅恢复Reveal旧bytes/mode/mtime；Pane未emit、未写、未restore，双目标实际CDP观察各自精确，1130 loaded/10038 manifest-only不作coverage。
- 新实际恢复起点是guard SHA-256 715f604de0029670e213bf808f20a9b18184d303257d273142003cc5dd119f25；out15500仅Reveal资格ctime由1793100193532575159到1793113874206815079，其他元数据及src15716/.build6778/node_modules48773、native256+Reveal/freeze4/cache3/历史原件均精确。不得倒用旧821快照吸收差异，不回写.build/log或ctime。

本次失败体按原utils路径跳过computeLeakingDisposables；hooks平衡/owned quiet不等于leakfree。保护边界采样不证明所有syscall隔离或全部异常注入。v1/v2未过与旧8033 official1/whole .build FAILED均保持。当前窄plan及主lease仍accepted，Sources四窄、产品/PRD/旧D/波状态不升。

长期工作流保持三个时态：冻结包false/prepared0 → root仅五字段单独激活 → driver唯一一次consumed1；不改冻结锚或178pins，不自动retry。未来必须另准备业务包，绑定届时源码与本次新实际native恢复基准，先精确a4a旧生产L1业务red，再固定新13加完整Reveal，最后非作者真实默认编辑器after。新Pane发射、old/new切换、phase/selection/restore范围或判定扩展均是语义工具变更，须源码peer及整包peer，不能仅改manifest沿用旧授权。
