---
title: "Conversation lease：补齐本地 fixture 与隔离 emitter 附写"
type: plan
status: draft
phase: M7
updated: 2026-10-27
summary: "仅方案draft，规则16只读审查待（原 Astra）：A只给Reveal本地fixture补真实WorkRootMount模型；B由唯一baseline未来隔离reporter日志并逐阶段保护完整src/.build/node_modules。未授权实施、工具准备、重跑或after。"
---

# Conversation lease：补齐本地 fixture 与隔离 emitter 附写

本稿固定 E parent `8033a3c23ba2b0550e817c9cc4fdebf4d12a4478`，只准备后续两片，不导入 main / merge / Sources 后来增量。既有 [lease 合同](conversation-visible-lease-recovery.md)、[setup 诊断方案](conversation-visible-lease-setup-diagnostics.md)与[历史 after 输入边界](../progress/lease-after-inputs-20261027-evidence/INDEX.md)保持。**本稿为 `draft`（规则16只读审查待），原 Astra 审查及 root 裁定待；不授权 A 实施、B 工具准备或任何执行。**

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
- 只有这两个精确目标可重定向；其他受保护src / `.build` / node_modules路径写尝试保留实际参数 / 错误与拒绝记录，置不可吞的失败标记并拒绝，不能改成任意`.build`前缀重定向。固定依赖的其他写API也须先纳入静态调用清单，未覆盖则不得执行；正常的其他fs操作保原语义。既有唯一Reveal out写入资格和hook继续生效；组合patch须证明无提前return、替换引用或恢复顺序绕过out单写，不扩大repo写权限。
- scratch审计用预先捕获的原函数避免递归。每次 redirected mkdir / write保留阶段、目标及实际PID/start、父资格、token、实际调用栈 / 来源、原 / 新路径、实际data bytes/SHA与options、调用次数、intent / completed / error；只记录真实事件，缺调用不填预期次数。原log及目录metadata始终受完整 `.build` guard保护。
- 两项 wrapper只存活于该独占子进程；不修改仓库模块、node_modules或主进程的全局fs。导入路径 / Node导出模式 / 并发语义若无法证明可隔离，即停止并交root重新定案，不退回生产源码patch、整体路径重定向或写后恢复 `.build`。

### 3.3 完整保护必须成为阶段停止条件

在第一项会加载编译依赖的动作之前，固定全量 `src` / `.build` / `node_modules` 起点：完整path-set及lstat：含ignored路径、root及所有descendants的类型 / mode / size / mtime_ns / ctime_ns / symlink target；固定HEAD/src、既有bound source/native/tool哈希、cache links和已有out guard。内容核验限于这些已绑定输入 / 产物与新增reporter精确日志data bytes/SHA，不要求每阶段对整个node_modules内容重新hash，也不声称所有文件内容已独立hash。schema / 排序 / 计数口径一次冻结，同一阶段前后不得更换或忽略新旧路径。所有证据写scratch，禁用Node compile cache与工具自身cache。

**emit阶段还须在编译stream真正完成后、首次Reveal journal intent / out write之前设置一道停止门**：child等待parent独立复核src / `.build` / node_modules全metadata、限域bound bytes及该时点out基线，parent绑定实际PID/start/token与单phase资格给出一次继续许可后才可写Reveal journal / out。门禁失败或许可缺失则不写Reveal，停机交原件；不得只在Reveal已经写完后才发现`.build`漂移，也不得用child自报替代parent独立核验。

每阶段终止并确认该阶段 owned quiet后，parent核全部保护范围与out资格；**检查通过才可进入下一阶段**。checker、lint、dry、emit、official run及finally都要核，不能只在最后报aggregate。任何src / `.build` / node_modules路径的新增、缺失或metadata漂移，以及限域bound bytes不符都是硬失败：停止后续业务、停所有owned、保留diff / 原件交root，不将漂移改成baseline、不事后扩大恢复集合。不以write后原bytes相同放过ctime改变，也不touch / utime / 重写未授权路径来伪造ctime恢复。

若发现附写未隔离或scope不足，该次新driver一经消费仍只算该次实际失败；不得自动重试。静态调用链、未看到漂移、成功report三者均不能代替实际writer journal。

## 4. 保留原单写、双观测与恢复协议

未来工具必须逐项继承既有单Reveal诊断协议，不能用本稿重建一个较宽的运行入口：

- 唯一baseline、共享锁 / 全局空闲核定、唯一source/native与fresh工具身份、root独立execution release及one-shot consumed；源自A的候选先完成peer / 真实接入。准备许可不等于执行许可。
- 只允许fresh Reveal测试JS作为潜在out写入目标；旧Pane及其他out / native / WorkRootMount始终只读，不自动Pane emit、model emit、fullnew或fullcompile。
- 两个真实renderer观察目标仍为fresh Reveal与旧Pane；分别收 `scriptParsed` + `getScriptSource`并核完整字节 / SHA，不靠manifest代替实际loaded、不force import制造观察。官方选择仍只L1 + official meta，真实outcome / 官方统计 / hooks / exitcode独立记录。
- 按唯一单个LF紧接 `Engine Pane setup diagnostics: `拆主stack与诊断JSON；只有主stack参与业务mapped frames，嵌套openErrors.stack只作诊断。目标断言按新固定源的真实map冻结，不为674保行号。boundary未建立写 `expected old-red boundary not established`并保实际outcome；仅actual stack + fixed控制流可定位时声明未达，不能定位为unknown；L1 pass如实记pass，不借本诊断授业务red/green。
- 由实际PID/start + parent单phase / 单path资格 + 同phase可信out journal交叉核定completed / partial / uncertain子集；不能从metadata漂移反推恢复权限。先全部owned quiet，再只恢复核定实际out写入子集；未写路径及ctime不动。
- **任何结果 stop → owned quiet → qualified restore → 全保护复核 → 原件交root。** 完整src / `.build` / node_modules保护失败不得被out恢复成功覆盖；无权限修复这些范围，失败如实保留。future起点须绑定当时root核定的实际guard，不盲用历史54fe / 46fc / 82129a。

## 5. 顺序、交付与完成边界

| 步骤 | 必要输入与输出 | 当前授权 |
| --- | --- | --- |
| 方案 | 本固定docs commit → 原Astra规则16只读 → root核验并改稿 | 仅本稿与必要索引 / 行动层落位；`draft`、规则16只读审查待 |
| A候选 | root单独放行 → Reveal最小import/stub → 字节逆证 → 原Astra源码peer → root真实接入 | 未授权 |
| B工具修订 | root单独放行唯一baseline准备 → 固定静态调查 / 两项隔离 / 全阶段guards / 新工具diff与哈希 → 工具peer与root核定 | 未授权；本稿不准备工具 |
| 未来一次执行 | 独立root release、fresh身份 / 起点 / consumed、实际outcome、完整原件与恢复边界 | 未授权；不能重用prep2或自动重跑 |
| 正式业务与产品验收 | 精确旧源合格L1业务old-red、固定新源完整矩阵与原Reveal回归；非作者真实默认编辑器after | 仍为未来门禁，不由本稿或诊断抵扣 |

- [ ] 原Astra规则16审查已回，root核验并落所有Critical / Important；未完成不标accepted、不启实施。
- [ ] A另获授权并完成固定源码peer / root接入。
- [ ] B另获准备授权、静态可行性与工具peer通过，完整保护阶段停止条件已核。
- [ ] 未来一次execution另获授权并如实交付；无自动retry / after。
- [ ] 正式old-red / new-full与真实默认编辑器after另行完成，才评估旧lease方案实施状态；不升PRD / 旧D / 波。

本轮只运行docs generator / health / diff与只读字节 / metadata核对；不改源码，不作编译 / lint / AST / 模块加载 / 测试 / runtime / toolprep / out或cache写。所有既有原件与历史失败保持，当前fresh保护只界定E本次文档区间，不补写任何工位旧连续性。
