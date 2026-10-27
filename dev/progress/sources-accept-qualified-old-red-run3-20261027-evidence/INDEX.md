---
title: "Sources Accept：a4a 旧生产资格 run3 业务实测"
type: index
status: active
phase: M7
updated: 2026-10-27
summary: "独立input.dispose业务旧红成立，Panel A3 body过但VM/meta hooks仍败；共同factory修正后原default-false通过，38owned退出，两测试JS精确恢复。"
---

# Sources Accept：a4a 旧生产资格 run3 业务实测

[实际编排记录](validation-report.json) · [三个官方reporter与精确分类](result-classification.json) · [原件/runtime分类清单](artifact-inventory.json) · [生产连续性](production-continuity.json) · [父级独立复核通报](parent-independent-review.json) · [文档门禁](docs-validation.json)

## 三独立组的实际结果

root 在接受 [run2加载失败 proof](../sources-accept-qualified-old-red-run2-20261027-evidence/INDEX.md) 后，只授权修正入口参数的独立 run3。repository 保持 `ca0b0603e2b29bd3c5cb403fa17e080488834452` / src `a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`；两测试输入精确为 `a4a70322795c509e8e9b8274cf295a1b65db663a`，候选 src `d78a48e5feee57fcaf5811c8425859d0a2400af0`。三份旧生产均为 c7 的已资格化实际 JS，本轮0写入；没有正式源码集成或新生产 green。

| 独立组 / 原官方 reporter | tests / passes / failures | 进程 / duration | 准确结论 |
| --- | --- | --- | --- |
| [input.dispose A4](independent-input-dispose-a4.mocha.json) | 1 / 0 / 1 | exit1 / 79ms | 唯一body纯业务AssertionError；无setup/load/API/timeout/cleanup失败 |
| [Panel A3](panel-a3-positive.mocha.json) | 1 / 1 / 2 | exit1 / 118ms | body通过，之后3 disposable泄漏与console meta两个afterEach失败；非clean suite |
| [原default-false clearInput](original-default-false.mocha.json) | 1 / 1 / 0 | exit0 / 17ms | 在a4a共同factory修正fixture下原body通过，不改写旧c7 helper探针setup失败 |

### A4：独立 input.dispose 旧红成立

[原stdout](independent-input-dispose-a4.stdout.log)与原JSON保留唯一 `AssertionError [ERR_ASSERTION]`。该例在 FileDiff read started 后只执行 input.dispose，已逐项通过 `pane.input === input` 与 `input.isDisposed() === true`；Pane仍live，随后释放read并await runAccept。actualJSON为：

```json
{"reads":[{"sessionId":"session-1","path":"src/a.ts","indexState":"Unstaged"}],"applies":[{"sessionId":"session-1","argv":["git","apply","--cached","--whitespace=nowarn"],"patches":["diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,2 +1,2 @@\n line1\n-old\n+new\n"]}],"commands":[]}
```

期望保留相同read，`applies: []`、`commands: []`。实际patch是96 bytes / 7 LF，SHA-256 `20f9d884a273fd3561dd79041a6af2c9b383a5ada4528082e6ff582faf97d0a1`。这例不跟踪refresh投影，也没有notice断言；不能从别例补填这些值。该次新业务旧红为1，不拿旧setup失败或run2加载失败充数。

### Panel A3：正控 body 到达，旧 VM hooks 仍红

[原stdout](panel-a3-positive.stdout.log)与reporter的passes明确列出 `Sources diff panel Accept post-read authorization Panel A3 s1 to s2 to s1 uses current authorization`。不可变输入的情景先等待read，再从s1→s2→s1、notify、恢复read；成功body的精确断言包含read1(s1/src/a.ts/Unstaged)、Apply1旧s1/正确argv与上述合法patch、commands[]、refreshes1，catalog ready / Git engine-live。通过的reporter本身不另输出passing actualJSON；该投影资格来自通过的原精确assertion，不伪造raw trace。

随后真实afterEach报告3个未dispose资源：DiffEditorViewModel、_DisposableStore、FunctionDisposable，栈经 DiffEditorWidget.setModel → SourcesDiffPanelView.renderDiff；另一个afterEach是Unexpected console output meta断言。它们保持为已识别的旧Panel生产VM所有权问题，未加未知VM清理、disposable豁免或改Widget。

[run1](../sources-accept-post-read-authorization-old-red-evidence/INDEX.md)已到达Pane A2、Pane A3、Panel A2三个positive body；本run3独立Panel A3补到第四个。结论是**原四个positive body跨两次固定输入实测累计到达**，不是某次clean4/4或Panel suite green。旧run1 Panel A3未达的历史不回写。

### 原 default-false：修正 fixture 身份后原 body 通过

[原stdout](original-default-false.stdout.log)与reporter为1/1/0。测试仍调用 `createInstantiationService(resource, connection)`，默认resolveModels=false；原header、body与assertions逐字保留，原case尾部与精确c7 Git字节比较相同，hash见分类JSON。它实际等到readInFlight，执行pane.clearInput，释放read、await acceptPromise，最后assert applyCalls=[]。

本轮整份输入是a4a，**共同factory已修正为无条件预stub连接再创建model**，所以不能称整份原c7测试/fixture直接通过。先前 [精确c7原helper探针](../sources-accept-default-false-probe-20261027-evidence/INDEX.md) 在setup报undefined.onDidChangeConnection的结果仍保留，不改写成当时已到业务。该原case不计入新54的业务red或四positive body。

## 输入、driver 与实际两JS emitter

[manifest](input-manifest.json)、[driver](validate.py)、[emitter](emitter.mjs)、[工具/配置](emitter-options.json)、[dry](dry-emitter-report.json)、[emit](emit-emitter-report.json)、[out写journal](out-write-journal.jsonl)均为实际原件。两份TS从明确a4a Git blobs注入canonical Vinyl contents，不写repo源：

| 测试 | TS bytes / SHA-256 | 实际临时JS bytes / SHA-256 |
| --- | --- | --- |
| Pane | 13078 / `93d4b2f612e21212558c890f5a0cdb3c16b5fc657c47635f6e6a942dbac372fc` | 39356 / `6ebd9cd01fe19ece917086eb58a377ac4232638ed79e96d3d61dcbc284aa4935` |
| Panel | 189054 / `ef28732018c703848be327f384aa3edaeabd2e3d8b4fb1e890f168c443596967` | 600166 / `449619b442e1502d5396c70dce05d771dd5367d20569d4402cb23d1df34804ff` |

真实createCompile / ESBuildTranspiler / streamToPromise的dry与emit均exit0，完整枚举恰2 JS / 0独立map、全部original/generated校验后只writeFile两个既有test JS，生成bytes与run2相同。三生产0写，当前与actual run1 fresh c7 emitter → sealed originals → Git emitted/sealed copies逐SHA连续，不从scoped254遗漏推断controller producer资格。

[完整driver差异](driver-mechanical-diff.patch)、[emitter机械差异](emitter-mechanical-diff.patch)、[派生检查](driver-derivation.json)与 [run2加载归因源码](loading-attribution.json)保留。唯一调用行为修正是删除官方entry之前的user-data-dir项：

```text
.build/electron/universe-agent-studio test/unit/electron/index.js --crash-reporter-directory=<owned> ... --run <exact source> --grep <exact selector>
```

官方non-dev runner自行把userData置于tmpdir()，已被本组TMPDIR隔离；其余flags、XDG/crash/Xvfb隔离、两个输入与三exact selectors不变。全部process helpers、OwnedStage、run_owned、finally恢复及实际emitter管线文本逐字同run2，run-id/HEAD/actual-restored-baseline只机械迁移。未改run2原driver，也未跑额外probe或自动重试。

[prepared release原件](prepared-state/execution-release.json)、[prepared inventory原件](prepared-state/preparation-inventory.json)、[授权态release](execution-release.json)和 [授权身份](execution-authorization-identity.json)各自保留。prepared inventory仍原prepared-not-run历史字节，未改成后来已执行；一次run3 release已消费。

## 进程、finally与当前实际恢复基准

五阶段观察38个唯一PID/startTime：dry3、emit5、三个Electron组各10。每组有独立session、唯一继承token、subreaper与pidfd；所有owned后代停止并reap后才恢复out。当前所有同identity均不存在，观察到的X117 socket/lock每组结束后均不存在；实际signals0、watchdog expired0，因此不声称实测触发超时TERM/KILL分支。15s Mocha与外部monotonic45+TERM5+KILL5均保留，没有run2同类加载错误。

[seal](sealed-originals.json)、[运行前基准](guard-before.json)、[emit后metadata](guard-after-emit-out-metadata.json)、[实际恢复后采样](guard-after-restore.json)保留。finally两原test JS bytes/mode/mtime精确恢复；其他12552 files与全部2946目录metadata、254+extra2 source/native pairs、freeze4/cache3全精确，仅两条授权ctimeNs差：

- Pane.test.js：`1793073162546924732 → 1793073994326817043`
- Panel.test.js：`1793073162547924782 → 1793073994328817105`

run2/旧probe/run1 guards均不改。当前只读验证绑定本run3实际恢复后完整采样，SHA-256 `90f8cd36c22c0503061c8c6df9c1fe6654053043fad1b7857e80a62875955aa1`：

```bash
rtk proxy python3 dev/progress/sources-accept-qualified-old-red-run3-20261027-evidence/verify-restored.py
```

root于`2026-10-27T04:08:23.668980Z`独立snapshot==该基准，核两native原bytes/mode/mtime、五阶段全部stdout/stderr SHA、38唯一PID/startTime无同identity存活且stage quiescent。此为父级工具通报摘要，不伪造另一份raw log。

## 镜像分类与未升级范围

精确镜像数/总bytes、每份scratch→repository SHA映射与其余runtime metadata分类见inventory。README原bytes映射为preparation-notes.txt，原prepared inventory路径文字不改；run-owned profile/cache仅metadata登记并留scratch，Xvfb/crash原件另镜像。run2失败、旧probe setup、run1未达历史与全部旧inventories不改、不重扫。

本次只建立A4旧红与有限正控/原case资格并持久化证据。原A1双业务旧红成立仍沿run1，不复跑；旧Panel VM lifecycle候选尚未在本lane新生产验证。未source checker/wholecompile/新生产/其它tests/窗口/引擎/正式源码集成/新green或产品签收；accepted plan、PRD、D1387与旧波既定状态保持，out再次冻结、overall goal active。

## 当前更新前 status 首条逐字保留

来源`ca0b0603e2b29bd3c5cb403fa17e080488834452:dev/progress/status.md`；[原字节/hash](prior-status-entry.json)保存含末尾换行的旧首条。本次只替换该首条，status仍200行，其余行逐字保持：

```markdown
- **Sources Accept a4a旧生产资格run2（2026-10-27）**：固定a4a两test配c7三旧生产连续资格，真实dry/emit恰2test JS/0map/0生产写；三独立A4/Panel A3/原default-false均加载out/test/unit/electron/index.js失败、无Mocha reporter，业务red0/positive0，driver exit0仅编排恢复。36owned全退出，finally两原bytes/mode/mtime、254+2pair、其余12552文件/2946目录及freeze4/cache3精确，仅2test ctime差。[失败原件/当前恢复基准](sources-accept-qualified-old-red-run2-20261027-evidence/INDEX.md)；未热改/重跑/合源/新绿，旧结论与plan/PRD保持，overall active。
```
