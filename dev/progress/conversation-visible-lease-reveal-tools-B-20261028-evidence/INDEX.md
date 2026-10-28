---
title: "Conversation lease：fixture A提交与tools B源码门关闭"
type: index
status: accepted
phase: M7
updated: 2026-10-28
summary: "A片6e575实际提交与失败历史保留；B固定13经原Astra C0/I0/M0及root独核、唯一syntax3全0接收，仅关闭source门，业务/compile/after待。"
---

# Fixture A提交与tools B源码门关闭

本次基于 merge `6e57549da5cafa2f23d536f58f22ca428fe29e7b`、src `c1267f27d022ecaa417ef9065825fb53bacc21ea`，只出版130个获授路径：6现行docs、此INDEX/copy-map及122份逐字副本（B80/A22/syntax20）。[逐件来源与目标身份](copy-map-and-original-identities.json)保留原metadata、bytes/SHA、目录映射及副本metadata；没有大整树重复归档。主lease整文不变，[窄方案](../../plans/conversation-visible-lease-reveal-fixture-and-official-budget.md#10-fixture-a实际提交与tools-b-source-only门关闭2026-10-28)§2–§4字节不变，两份方案仍accepted。

## A片实际提交及失败历史

A片的原Astra源码peer C0/I0/M0已由root转述并采纳。实际提交为 `6e57549da5cafa2f23d536f58f22ca428fe29e7b`，parent `e37fc6c3419fae03f484a6d11e8c4b58e7e6b84e`，tree `fb49539bef168665304cf144f0c95decc163588f`，src `c1267f27d022ecaa417ef9065825fb53bacc21ea`；恰6路径为Reveal一行及必要五docs。Reveal81723B/blob `80434706a2e91218fa3f1c0c130b4697981db4b8`/SHA256 `d470c31670caf21b35698d8663ad7bcf6a72022fbf247910265e2a6f4af7498b`；原b078整份81721/8a9c及whole inverse保持，当前不再改src。

- 首次[scoped add failure128](A-commit/fixture-A.scoped-add.failure128.receipt.json)为ENOSPC，未尝试commit；原stdout/stderr一并保留。
- continuation1在add前因自有reader将 `git -C <path> ls-remote`误分类而停止；[实际错误](A-commit/fixture-A.conditional-continuation1.stopped.error.json)与fresh采样保留，无add/commit。不是源码或候选运行失败。
- [reader纠正收据](A-commit/fixture-A.conditional-reader-correction.receipt.json)及两份原/改执行源码文本完整保留。root另授纠正后continuation2仅识别精确PID/start/state/ppid/exe/cwd/full argv的既有只读ls-remote，其余unknown Git仍fail closed。
- continuation2 add actual0、**唯一commit attempt count=1 / actual exit0**；[attempt-start](A-commit/fixture-A.conditional-continuation2.commit-attempt-start.json)、[commit actual](A-commit/fixture-A.conditional-continuation2.commit.actual.json)及[最终outcome](A-commit/fixture-A.conditional-continuation2.commit-outcome.json)分列。三次容量1048391680/1047707648/1047699456B均≥64MiB；command-local `gc.auto=0`、`maintenance.auto=false`，没有持久配置/cleanup/repack/alternate/relocation/push/amend。合法loose Git objects可能写入，不声称common objects整体未变。root独核commit/raw/clean及main65/index后已接受A片提交。

## B固定13源码与谱系

B严格从Git `5f36ed8809300700cfebf9c140d3e938327c024b` 的source-v3/candidate产生独立后继；[original-5f](B-source/source-origin13.json)、[固定13库存](B-source/fixed-source13-inventory.json)、[handoff](B-source/B-source-only-fixed13.handoff.json)与[固定证明文件索引](B-source/fixed-source-and-proof-files-index.json)原字节均保留。handoff37535B/SHA256 `478bd1e90b392e22142841d7ddee1beeef926f336c8ccd76066fc7962d777352`。原5f/v3出版树和所有旧P/D/S/E不改；候选13份0444、source目录0555。

| changed文件 | bytes | SHA256 |
|---|---:|---|
| binding.mjs.raw | 14780 | `ce9bf85e25142f3b0d90719574dfcfe1f6227a68256c402edeb5b072599f2a8f` |
| business-profile.json | 67016 | `04b2c25b973f50e6f1ee9c93603b86865e7b8313e6a6c5212f35290858198b92` |
| guard.py.raw | 28913 | `2dc9a0277a56bc5c0964f31624371d6648a2a3e65de4d08dc518905c11aef2eb` |
| package-contract.schema.json | 14137 | `71a673fa66b7573caeaa812df07e308edd2540528baa218238d3937dcb29c92e` |
| validate.py.raw | 81766 | `5c359b64a16c0e725e37c11902b5f107f56ce689414c0fad36da83b9f72cd0d7` |

emitter/fs-isolation/linter/observing-reporter/parent-authority/poststream-guard/reporter/source-checker八份逐字同5f。每份完整正逆diff及whole-byte replay均在B-source/diffs，整体[正diff](B-source/all13.forward.diff)/[逆diff](B-source/all13.inverse.diff)分列；[消费者及范围](B-source/all13-consumers-and-scope.json)声明changed5/unchanged8。

新模式绑定真实A片6e575/80434706/81723/d470及src c1267，Pane仍b078/98ba/15270/90c0719；old模式、旧L1/Pane与新40/238选择保持。未来实际workspace HEAD仍须在新manifest/policy/release另绑定，不捏造未来HEAD。profile、EXPECTED_SRC与schema实际src常量一致；Reveal不在旧256 pairs中，该256原source/native及历史producer保持。

[严格谱系静态证明](B-source/strict-lineage-static-binding-proof.md.raw)保资格祖先old a5/6601与最新失败恢复的区别：715→old6601→failed manifest/fresh baseline6601→qualified2/restore2且仅两ctime的6dd→root f29→9e接收；按已有有向引用严格核九个唯一audit check全部passed/errors=[]及原身份，不造bridge/反向字段/bool，不把恢复当新业务green。Python accepted_failed_predecessor由validate与guard共享，parent→poststream→guard.verify沿用；JS验证固定raw引用/接收与整份fixture逆证，不用JS Number比较纳秒。

source保护的未来窄差异仅精确Reveal文件size/mtime/ctime及直接parent的mtime/ctime，其他src以及out/.build/node_modules tuple/pathset保持；旧256和独立target seal/native producer分列。OwnedStage固定五stage45/official180，attach不能续期；parent/两emit45、TERM5/KILL5、Mocha15/setup20、双RAF/assertions不变。[预算消费者证明](B-source/budget-consumer-text-bindings.json)只是源码绑定，不是official180实跑。

## 原Astra与root接收及唯一syntax3

原Astra正式direct FINAL完成固定37535/478bd1e9的13/13全文及原始谱系source peer **C0/I0/M0**，root采纳；这里是root直接消息转述并由本执行器整理的准确归因，**不是reviewer terminal raw、原消息字节或独立原审计文件**。root另独核77refs/直接Git13/双向整文回放/13 exact0444+目录0555/main65/index，均匹配。原handoff的sourcePeerPending及invocation0是冻结时历史，不回写。

root随后独立另授一次changed executable3 syntax；[实际receipt](B-syntax/syntax3.actual-receipt.json)5940B/SHA256 `a4be2c302825e7aca37dbb422dbf2b70e45bb54e3fa4176cc3e323a8bce57f39`，配[外锚](B-syntax/syntax3.actual-receipt.anchor.json)、[20文件索引](B-syntax/fixed-syntax-evidence-index.json)、[实际发生顺序](B-syntax/invocation-order.jsonl)、各command/stdout/stderr/exit及recorder源文本。binding精确bytes stdin至已绑定Node `--check --input-type=module`，guard/validate仅已绑定Python `compile(bytes,name,'exec')`，各恰1次、actual `[0,0,0]`，六份stdout/stderr均0B；未import/execute候选，无AST工具/runpy/pycache、unchanged8 syntax或重试。

外层显式GIT_OPTIONAL_LOCKS=0、NODE_DISABLE_COMPILE_CACHE=1，NODE_OPTIONS/NODE_PATH absent；Node/Python既有execution-binary身份从原manifest核对。前后candidate13/original13、source dirs、handoff/clarifications、manifest/binaries/main65/index/merge clean/index精确，processSample是非原子可见采样而非全机无writer证明。前置/proc reader的无关权限/一次自有PermissionError如实归因在authority记录，未伪造早期raw、未算候选失败。root独核20文件/commands/12项order/保护后正式接受**source B门含唯一syntax3关闭**，未授业务运行。

[Git环境及持久源说明](B-source/fixed13-git-environment-and-durable-source-clarification.md.raw)保持原字节。`/sdd/tmp/vscode-conversation-visible-lease-tools-B-source-only-20261028-v1-20261028T001632513526Z/candidate`是schema固定的持久只读sourceOnlyDirectory；本仓镜像不替代它，原路径不得移走/删除/重写。未来wrapper须另明确绑定GIT_OPTIONAL_LOCKS=0向validate/Node binding/parent/poststream继承，当前syntax环境不代未来包的环境证据。

## 原完整compile审计与未来设计边界

[原root-forwarded审计摘要副本](B-source/reference-root-forwarded-compile-architecture-audit.md.raw)是root直接消息的署名摘要，不是原Astra raw；以下将其已转述的构建事实落入仓内文档，不表示本出版执行了调查、prepare或compile。

- 标准入口保持原 `npm run compile`：根npm-run-all2并行compile-client与Copilot；npm compile-client调用完整Gulp compile，覆盖Monaco/core/extensions/media，不能用窄core gulp compile-client、private emit或typecheck替代。原dev esbuild emit＋完整tsgo是真实compile；现CLI无覆盖全图的统一private-out开关。
- 写面包括root/out、src内Monaco/proposal/extensionPoints/codicon生成、扩展out/incremental/media以及Copilot dist、依赖serverplugin和postinstall package/SDK/shims。只迁out或把I只读shared aliases变成可写构建目录不能闭合写面；历史out/native256/freeze保原物，不借新路径结果追认旧producer。
- 未来拟由merge owner持有SDD一次性完整源码Git树、独立真实Git metadata/objects/index/refs及私有依赖快照；完整H/T/S/tracked mode/blob与必要ignored/untracked/typings/gitlink、依赖donor/链接/inode和资源须另固定。不得链接原gitdir/index/alternates或共享可写inode，也不能仅造HEAD文本；路径改变可影响sourcemap，不要求新out等于旧字节。生成后tracked若改变，不因parent0称原H精确绿。
- 不全局设置BUILD_SOURCEVERSION绕开Git；它会触发Copilot package patch及quality/counter消费。未来环境仅用实际消费者支持的cache/temp入口，不改HOME/home/CODEX_HOME、不复制日常登录资料或dump秘密。
- 根exit0不能掩关键子任务失败。Monaco包装直接resolve子exit，必须另核实际Monaco compiler状态；npm两分支、core/extension/media编译和Copilot/postinstall的真实exit/signal、完整日志/输出及角色匹配均待未来合同。未知/缺exit不能绿；合法probe非0须有具体源码依据，不能把全部非0一概归失败或豁免。优先标准入口和进程观察，不另造复杂runner；observer/probe可用性、有限TERM/KILL收尾、所有自有writer quiet后保护及归lane均尚待正式审查/授权。

交叉线程私稿仅获root核index四rawrefs的identity/scope：`/sdd/tmp/vscode-full-build-snapshot-draft-20261028-a1/draft.md`20861B/SHA256 `f17748961c1b55b9954b466a6c076e41877910aa66d8506529960c1bb199fd51`；`draft-index.json`926B/SHA256 `c0ef8693ed22c5b92a7a79fae60d0d132ec16ded14d69bfeddd4e83b5d76fb9d`。不是正式Rule16/prepare/run报告，不复制为仓内accepted方案；prepareAuthorized/runtimeAuthorized=false，实际H/T/S、全部inventory/资源/observer/有限收尾/lane票据仍TBD。

严格后续顺序为：**M完整40/238及恢复验收→新snapshot plan原Astra Rule16→独立prepare与whole peer→sole lane原npm run compile→保护/root接受→slot gate书面裁定**。不提前review/prepare或开放G/H；merge持有snapshot代执行与worktrees门禁的对应尚未签收，不宣称已在merge cwd完整复跑。

## 当前出版与验收边界

本轮仅复制122份原字节、编写此入口/copy-map、更新6份主题docs及获授Python文档门禁/read-only Git diff --check；不重跑syntax或候选工具，不组新runtime包，不获取锁/lane，不stage/commit/push/amend。各门禁实际stdout/stderr/exit、容量、130路径及前后保护收据在独立外部publication记录交root，副本metadata不冒充原dev/inode/ctime。

new完整40/238、清理非干扰、自然loaded=disk=独立dry seal=emit、quiet/恢复、非作者真实默认editor after仍须另授包/whole peer/fresh/root release实证。原new-prep1失败及6dd恢复/old红资格、历史whole.build FAILED原封；主/窄plan accepted，I build/after/ready=false，Sources/产品/PRD/旧波与C/F无新信用，无main/C/F集成。
