---
title: "Engine IPC 共享 owner 合同验证"
type: reference
status: active
phase: M7
updated: 2026-10-28
summary: "S1最终新602过、原项目noEmit0、7TS lint0errors/2既有warnings；旧node76与IPC14业务红分轮证实，首失败及两次测试补修原件保留，UI待接线"
---

# Engine IPC 共享 owner 合同验证

## 范围与首轮冻结身份

本记录仅对应[方案](../../plans/engine-write-ownership.md)的S1：公共owner、connection interface、IPC、node与平台回归。C/F UI接线、真实依赖合并与产品集成均未完成。阶段一634项证据见[原Providers记录](providers-verification.md)及[并行看板](../../parallel/active/engine-lifecycle-recovery-2026-10-28.md)，不沿用作本阶段通过结果。

C的方案提交为`0e3310ee67482b9502503747826f0ef3aa78c863`，其提交内src树仍为阶段一`534f1b51b427bd7c3f712dfdd979b013a7888756`；下列是该HEAD上尚未提交的S1冻结字节，不能把HEAD:src误作新源码树。路径前缀均为`src/vs/platform/universeAgent/`。

| 路径 | SHA-256 |
|:---|:---|
| `common/universeAgentExpectedOwner.ts`（新增） | `e0e1b5357d81c0d77fdb3f106594c6c428576e271b5488f2cf0684952edc2616` |
| `common/universeAgentConnection.ts` | `b856d8d936edbf455319856fbf2da709b3cc79f4a46f962e5589b0c25b711735` |
| `common/universeAgentConnectionIpcChannel.ts` | `98eff55a5525169cc25c7b82aa9b5a5139c2ecb7d031222a9cc5b5825bcba476` |
| `node/universeAgentConnectionService.ts` | `75bbdec55e3298a6462c4a9ed6cbf31acfc2366f28ddeeb7d5415a0c31c53516` |
| `test/common/universeAgentExpectedOwner.test.ts`（新增） | `ebf7d6897970db0929e05a479a7e1ae9ad407868daf1ce7aba3336b713b25dd8` |
| `test/node/universeAgentConnection.test.ts` | `1cebeede10f2b09583809064697eb8a70101d80bcccb321a2c43deda636ba62b` |
| `test/node/universeAgentConnectionIpcChannel.test.ts` | `d673a925a9a9c6e392c3849dc9c8dee06135d3d134ff52f7231718feb3d80b94` |

自有方案冻结SHA-256为`c5cd6e1a80b30f5a079bddbf60a140b63b699032692e807a7f64e7e28b0e1546`。新增测试静态展开node96、IPC14、helper2，共112项；该数仅为新增用例数量。实现者`git diff --check`通过，运行由唯一执行者完成。首失败后仅撤销node测试文件的冻结用于pairing夹具补修，其余六文件不变；本表保留首轮身份，不替换成后修字节。

## 独立源码审查

`direction_review`（Astra）独立只读终审为**Critical 0 / Important 0 / Minor 0**，逐项核对上述七个SHA一致，没有改文件或运行测试。

- 13个strict方法与参数位准确；无request的list使用首参，owner不进入业务payload。
- IPC在业务request revive与动态方法lookup之前验证raw owner，畸形marshalling、缺owner、缺Save动态binding均按固定取消处理。提前审查发现的全参数revive抢先抛`SyntaxError`路径已补修并加回归。
- node同步复制main identity/link标量并固定transport，调用前无await；成功、业务返回与catch后复核，隔离同transport新link的健康、重连和动态能力副作用。
- legacy无owner Save不额外强加取消或新入口条件，正常结果/错误/UNIMPLEMENTED业务结果兼容；旧UNIMPLEMENTED不能清新binding。可信进程内省略与显式undefined同义，null等显式畸形不降级。
- 真实字节fixture经过ChannelClient/ChannelServer、allowlist、ProxyChannel到service：先证合法A载荷，再扣住B snapshot，联合检查B transport空调用与IPC重建Error的固定取消。检查了协议启动、hydrate、barrier与释放顺序，静态未见明显挂起路径。
- 业务回归只type-import新owner类型，旧生产运行时可擦除；新helper自身测试独立放在green阶段。实际renderer调用面仍为原批准四个UI文件，S1未改UI/proto/gRPC。

Assessment：可以进入唯一执行者的旧红/新绿及约定检查。该结论只签收冻结源码阶段，不表示测试通过或端到端完成。

## 运行准备与当前边界

执行者`integration_executor`准备文件在C私有`.build/engine-lifecycle-validation-20261028/ipc-s1-preparation/`，包括driver、官方transpileFile适配、manifest模板及精确reader tripwire。仅自身Python AST和JSON解析检查已执行，未据此宣称Node或业务测试通过。

- raw旧生产固定为阶段一`2f35686b611c60355c42d58a11c2e6d8638ba7cb`，搭配新node/IPC业务测试；helper单测和ChannelClient scan只放新阶段，不用缺模块的加载失败冒充业务红。
- 先固定精确依赖闭包及source/out身份，再在两锁与fresh进程检查通过后执行。源码快照、临时目录、npm/Node缓存和日志用本主题私有位置；不读取真实harness凭据，不写共享依赖/cache，不改HOME或merge。
- 每阶段独占目录，日志和逐命令结果使用exclusive-create，首失败原件不能覆盖；环境、加载、reader隔离、timeout或未处理异常单独报告，不算业务断言红。
- 外部任务于2026-10-27 18:43 UTC明确释放唯一运行通道，我方已协调至19:05 UTC。该协调不替代执行者的fresh锁、进程及容量检查；merge源码仍未移交。

## 首轮实际运行与分类更正

运行目录为`/sdd/tmp/vscode-expected-owner-s1-20261028-freeze-a2/`。旧raw2f搭配新业务测试完整运行598项：**508 passing / 90 failing**，准确分类为**88个业务AssertionError、2个fixture前置失败**。13个真实字节IPC用例均在renderer仍A/main已B条件观察到B实际调用，核心窗口业务红成立；整轮因两项夹具失败，不能标作纯业务红。

新shared完整运行602项：**600 passing / 2 failing**。两项同为`listSkills`、`saveSkillContent`的`cancels pending and captured calls after pairing`，停在`enterPairing`的`false !== true`，尚未触达后续业务归属断言。执行者立即停止，未跑quality、提交或merge；不得称新阶段已绿。旧新reader tripwire默认读取均0，无加载/未处理异常/官方meta失败；运行后冻结源码与输出身份保持，双锁已释放。

执行者首份资格报告曾把90项全部归为业务红，已另存`qualification-correction.json`明确更正；原报告、日志、JUnit及结果文件不覆盖。父只读核对了更正记录与两项完整stack。主要原件如下，路径相对运行目录：

| 原件 | SHA-256 |
|:---|:---|
| `stage-old/old-targets.log` | `e8bb57fbbbf696b1fb2083fcd876ee63f1d5d4a1e5d9269b74bf7e74945fc6ac` |
| `stage-old/artifacts/test-results/linux-x64-s1-old-targets-results.xml` | `890d69ce49a868c54b1ae29aa529f62511f441e34bd9a808713e35ac1efe7c3f` |
| `stage-new/new-targets.log` | `370e9b481331ee7366db2fc531cc5bf1a97d80a30f68e5e10013f03b3224efbc` |
| `stage-new/artifacts/test-results/linux-x64-s1-new-targets-results.xml` | `ca52bbda5f253bbe0b54825321f28c35dc2b9433dd88eae64b7bf0119e63b915` |

## Pairing夹具诊断与补修边界

C只读追到fixture的resolver始终返回`ok:true`的pinned endpoint；把profile trust清为null后，真实公开连接流程进入`trust_missing`，没有得到`pairing_required`，因此从未进入真正配对，`pairingPending`自然false。两旧新测试均在同一前置断言失败，不能借测试标题计为业务归属失败。

最小补修仅涉及node测试fixture：缺trust且非`forPairing`时返回`pairing_required`，配对解析给bootstrap endpoint；保留`pairingPending=true`和原全部owner业务断言，并验证公开配对返回。node测试新SHA-256为`67e6d264025979fe9fa8e67568f62132d689c866f66b2277adbc8f161f9bf5a7`，其余六源测文件与首轮冻结完全一致，生产文件未改。Astra独立窄审完整diff及七hash为C0/I0/M0，确认只有fixture两处差异，全部业务断言逐字保留。

父已授权唯一执行者使用新的独立attempt重验。官方Node runner不消费`--grep`，因此使用原官方完整node测试文件验证新fixture，不引入额外Mocha选择hook；原88业务红与13个B误调用证据保留。重建raw2f运行身份后才验证旧红，再跑新完整套件与quality。

## a3复验与首次类型门失败

第二运行目录为`/sdd/tmp/vscode-expected-owner-s1-20261028-freeze-a3/`，raw2f旧生产配新fixture的完整node文件**500 passing / 76 failing**（576项），全部失败已核为业务AssertionError，无fixture失败。两个pairing用例都通过公开配对与snapshot前置，最终在`beforeCancelled/afterCancelled`联合业务断言失败；13真实字节IPC仍观察到B实际调用。a2中未受fixture影响的IPC14项业务红保留，不重复计数。

新shared完整**602 passing / 0 failing**，由node575、IPC22、helper2、ChannelClient scan2与官方Errors meta1组成。两阶段reader默认读取均0，源码/out身份已保留；该运行通过只覆盖S1，C/F UI尚未接线。

随后原项目`tsc --project ./src/tsconfig.json --noEmit --skipLibCheck --incremental false`得到**3个TS2345**，都在新增node测试：`:2764:83`的ModelEntry可选字段不能满足UpsertModelRequest，`:2990:66`、`:2990:112`的`create`推宽为boolean，不能满足Save判别联合。执行者立即停止，未跑lint、提交或merge。原件为`stage-quality/noemit.log`（SHA-256 `c3a10762f0c05ce8ef36b4d41e73df3e013fb53ec8456b36b74f4868b638157f`），清单`noemit-first-failure-inventory.json`；双锁已释放。

C与Astra核实Model夹具实际缺必填`description/cost/speed`，不能用cast绕过。补修采用独立、明确类型的合法UpsertModelRequest，补三个空串并同步invoke/wire期望；Save请求加正式判别联合类型注解。node测试最终重冻结SHA-256为`fd7d797aa398522f80eddd366b4ac226bfc0595d6d4dfc1307b743e370d833a2`，其余六路径仍与首轮一致。Astra核完整diff恰三处hunk，无unsafe cast或删弱断言，窄审C0/I0/M0。

Save注解本身纯类型擦除，模型载荷确有runtime变化，a3的602不能绑定到新hash。父授权新独立attempt重建raw2f身份、用最终node测试再验旧业务红，然后完整602及quality；原a3通过和首次3诊断均保留。

## a4最终共享层验证

最终运行目录为`/sdd/tmp/vscode-expected-owner-s1-20261028-freeze-a4/`，使用上节最终node测试SHA及其余六个首轮冻结SHA。旧生产仍为raw2f原字节，新旧各自精确闭包重新构建，没有借用a3的新输出冒充旧生产。

| 检查 | 真实结果 | 原件 |
|:---|:---|:---|
| raw2f + 最终node测试完整文件 | 576项，500过/76业务AssertionError，无fixture失败；两pairing已到最终业务断言，13真实byteIPC均B调用>0 | `stage-old/old-driver-results-02.json`、`old-targets.log`及JUnit |
| raw2f + IPC新回归 | a2的14个业务失败保留；该文件后续未变，不重复计数 | a2原JUnit与更正报告 |
| 新shared相关四完整测试文件 | **602过/0败**，含官方Errors meta；新阶段reader默认读取0 | `stage-new/new-driver-results-02.json`、`new-targets.log`及JUnit |
| 原项目noEmit | **exit0、0诊断**，10.96秒 | `stage-quality/quality-driver-results-02.json`、`noemit.log` |
| 七个主题TS ESLint | **exit0、0errors、2warnings**，2.37秒 | 同上结果JSON及`lint.log` |

最终原项目命令为`npm run typecheck-client -- --incremental false`；ESLint实际命令为`node node_modules/eslint/bin/eslint.js --no-cache --format json`并列入本记录七个TS路径。实际transpile与官方Node runner子命令的完整argv、exit、日志SHA均保存在各阶段`driver-results-02.json`；Node runner使用精确reader tripwire preload，`--run`明确列出node connection、IPC、helper和ChannelClient scan四文件，`--tfs`保存JUnit。执行环境由driver清除Node编译缓存、启用禁缓存，TMPDIR/XDG/npm日志缓存均在阶段私有目录，HOME不变。

主要最终日志SHA-256：old目标`f201511af7b51401c0ca6199a6185cba8acd39ca9e7eb671eec2e485e849bb17`；new目标`8e4f32f0642692373fc3c8564a2576f8f9c74179205efc8034140bffa85d123c`；noEmit`e50959ea541e2971edaa328127437d74df16c703be42e80cab2f494ded4e02ca`；lint`a317cca368cf097509258ba1bc798c5027b548b40aaf8870887e8495ab45a3cc`。

两项warnings均在未改既有语句：node test当前15384行的in-operator语句在raw2f14951行逐字存在，IPC test当前344行的double-quoted语句在raw2f269行逐字存在；只读对照为`lint-warning-baseline-proof.json`，未额外跑旧lint。源码扫描实际读取的四源文件也逐字与raw2f对照，记录的是post-run采样时点，不冒称前置采样。

`validation-summary.json`确认七冻结SHA、新231项source/out身份与输出仍匹配；默认harness reader新旧均0。2026-10-27 19:03:47 UTC实核相关进程为空，两锁实际inode394208/442295在`/proc/locks`无记录。父已向外部明确提前释放唯一运行通道，此后只做Python证据封装、文档门禁和Git，不自动保留下一轮Node令牌。

S1共享层运行和质量门通过并已固定依赖、真三路接入F，见下节。C/F UI接线、实际产品集成与真实引擎默认窗口验收未完成；本阶段不提升PRD-025或整个方案状态。

## 归档与独立重放

- [原件归档](ipc-shared-runtime-artifacts.tar.gz)：4,539,837字节，SHA-256 `133aca73541c8e42c1609a566fc51bfe4db64f9fa33eac6ef6649030021ce1e2`；1475成员，未压缩26,967,532字节。包含a2首失败及分类更正、a3首次类型失败、a4最终命令/输入/输出身份和实际各版driver，未执行的selector准备不入包。
- [逐成员清单](ipc-shared-artifact-inventory.json)：每成员字节与SHA-256；该清单自身SHA为`221c5f623dea88998abaaa6adf6248b21949806d38b14a27a6c0a3163ce99901`。
- [执行与身份图](ipc-shared-execution-identities.json)、[质量结果](ipc-shared-quality-results.json)：各轮身份/边界、最终质量结果与既有warnings对照。
- [重放准备脚本](ipc-shared-replay-inputs.py)：SHA-256 `6daf9d12821d07e88405035c3f83fb908bcfbed9fcd52bad1a15df195630dada`；验证归档后提取到新的私有scratch，检查原2f与S1固定字节，准备manifest及driver，本身不启动Node、不改out。
- [实际准备检查](ipc-shared-replay-preparation-check.json)：Python-only验证1475成员、226旧输入/8新替换、18源码及control hash；未启动Node，231最终out身份仍不变。该检查不冒称独立重跑了旧红/新绿。

父独立只读核对上述六个产物的bytes/SHA均与执行者交接一致；执行者已逐成员全核。重放需依赖齐全、名为`C`的独立私有worktree保留S1固定源码/control字节，并使用全新的`/sdd/tmp/`私有目录。先运行准备脚本，再另行协调唯一执行车道才可执行其生成的old/new/quality驱动；共享依赖/cache和其他任务工作区保持原约束。后续C/F UI改变源码后，应用固定S1提交重建独立工位，不能直接把新UI字节混入本证据。

## 固定提交与F依赖同步

S1以`7821dea60cf64fd35f1c998e5a015ee884ab336a`一次提交20个主题路径，parent为`0e3310ee67482b9502503747826f0ef3aa78c863`，src树`ecba119506d5d19ae3c62b5dfa5867e0b4b8e13b`。提交前后20路径字节一致，七源测committed blob与a4冻结相同、231项out身份未变，C clean。生成/检查、docs health、diff/cached-diff门禁通过；status181行、plan仍accepted、PRD-025未改，没有push或释放后Node运行。

F以真实`git merge --no-ff --no-commit`接收固定S1并提交为`a99b2bfc4b94aa157ed62d957844344ce810e82e`，两parent为`541e5186bfed8215bb1cfc9851270f0853295f49`与`7821dea60cf64fd35f1c998e5a015ee884ab336a`，src树`471867fcb9173b45133ae27257c840471f14aa25`。没有复制文件或制造等价提交；原2f/2b均是真实祖先。

F的Skills生产SHA `9d5f00350454f439c2e767e4aaa51968a9a100941d6bc81be984343bf0bd3b24`、测试SHA `9c107bb93461bd6eddea91fc731a673fef60ff2daf88340b87367e669393f4a2`、新版方案SHA `86e25e04988e1def8e32cd38b2374fa1662e97f792c80a21862a637e871cc2f5`逐字保留。C平台七blob及阶段一Provider/Model两个blob全匹配，三份原件归档SHA未变。F相对C的源码差异仅Skills两文件，相对F原HEAD仅C平台七文件及Provider/Model两文件。

只冲突evidence INDEX与status两文档，语义保留双方历史和入口，F status183行，生成/健康/diff/cached-diff门禁通过、工作区clean。此步骤没有Node、测试、重放、out更新或产品merge操作；C/F在同步完成后才分别开始S2源码，仍须新回归、原项目检查及真实集成验证。

[依赖合并原始核验](ipc-shared-dependency-merge.json)保留两parent、十项保护hash、源码对照与冲突决定；5223字节，SHA-256 `db81fd01917e010afeb37b15c6467b6fcdeff94797efc9293647f2f3d3fd38d7`，由执行者从私有原件逐字提升，跟后续S2主题提交，不改写S1原件归档。
