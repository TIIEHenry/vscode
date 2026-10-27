---
title: "Sources Accept ab43：精确旧生产运行与恢复证据"
type: index
status: active
phase: M7
updated: 2026-10-27
summary: "c7旧生产3+ab43新test2临时emit恰5JS；A1双宿主纯业务红，正控3body过/PanelA3未达，cleanup及A4夹具失败保留；五原件恢复，方案accepted、无新绿。"
---

# Sources Accept ab43：精确旧生产运行与恢复证据

[accepted 方案](../../plans/sources-accept-post-read-authorization.md) · [方案真实接入](../sources-accept-post-read-authorization-integration.md) · [运行原记录](validation-report.json) · [逐项分类](result-classification.json) · [54份镜像清单](artifact-inventory.json) · [文档门禁](docs-validation.json)

## 实际结果与未达边界

此次是 root 明确授权的一次临时旧红资格验证，未正式合入候选、未运行新版生产或完整矩阵。merge 在整个运行中保持 clean `93da1c80e58c02cf3b6c5d5a823738758f538507` / src `a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`；生产三输入全部来自精确 `c7fefd780bd9720f3889e310d4706210189a3fc7`，测试只取 `ab43d8617d6e5afa7ca18812395f8f39ab9aa132` 的两个原 blob。原件不追后续 test-only 修订。

| 选择组 | 实际到达 | 判定 |
| --- | --- | --- |
| A1 Pane / Panel active s1→s2 | 2 个独立真实宿主均 read1、Apply1 到旧 s1、local Git0、refresh1 | 两个 projection `AssertionError [ERR_ASSERTION]`；预期 Apply0/refresh0 被实际发送违反，纯业务旧红 2。无 fixture / API / load / timeout / meta 连带失败。 |
| A2 Pane，同会话合法 patch | 业务 body 通过 | 精确 read1 / Apply1 / local Git0 / refresh1，session/path/Unstaged/argv/patch 深比较已实际执行。 |
| A3 Pane，s1→s2→s1 | 业务 body 通过 | 当前授权正控，精确写回原 s1。 |
| A2 Panel，同会话合法 patch | 业务 body 通过；之后 afterEach 失败 | 三个未释放对象：DiffEditorViewModel、DisposableStore、FunctionDisposable；再触发 console meta hook 失败。不是业务断言红。 |
| A3 Panel，s1→s2→s1 | **未到达** | Panel A2 的 afterEach 阻止剩余 case；不能报正控 4/4 或 clean suite。 |
| 独立 A4 input.dispose / live Pane / identical input | case 实际被选择，但 setup TypeError | `SourcesChangesModel → stubSessionAndChangesModel → createInstantiationService` 读取 undefined 的 `onDidChangeConnection`；未到 read-start、input.dispose 或 Apply 业务断言，业务旧红 0。 |

正控组合进程 exit 1，官方统计为 3 business body passes / 2 hook failures，3 个 test bodies 实际到达；A1 进程 exit 1 为 0 pass / 2 business failures；独立 A4 进程 exit 1 为 0 pass / 1 setup failure。[primary 原JSON](primary-a1.mocha.json)、[正控原JSON](positive-a2-a3.mocha.json)、[A4原JSON](independent-input-dispose-a4.mocha.json)保留官方原始计数，不把 body pass 改写为整套通过。`validate.py` 自身 exit 0 只表示编排与恢复完成，绝不表示这三个 Electron 进程全通过。

A1 的官方 `err.actualJSON` 对两宿主各自直接保存实际 read / Apply 请求：`sessionId=session-1`、read `path=src/a.ts`、`indexState=Unstaged`、argv `['git','apply','--cached','--whitespace=nowarn']`，一个完整单 hunk patch 为 96 UTF-8 bytes、7 LF，SHA-256 `20f9d884a273fd3561dd79041a6af2c9b383a5ada4528082e6ff582faf97d0a1`，逐字等合法 expected。A1 随后的 session-changed notice 断言因 projection 先失败而未达，不推算其结果。三条通过的正控 body 已执行同一合法 patch 的精确 projection；成功请求没有被额外插桩或替换生产逻辑。

## emitter 的实际来源与五条写入

[实际 emitter](emitter.mjs)、[实际编排/恢复脚本](validate.py)、[输入身份](input-manifest.json)、[真实编译选项与工具版本](emitter-options.json)、[dry枚举](dry-emitter-report.json)、[实际emit](emit-emitter-report.json)均为本次命令原件。TypeScript / esbuild / gulp 的实际解析位置、package/runtime 版本与配置哈希保留在 options，不借旧版本标签。

管线使用仓库 `build/lib/compilation.ts:createCompile`、实际 `ESBuildTranspiler` 和 `build/lib/util.ts:streamToPromise`。canonical Vinyl path/base 保持本仓位置，进入 compiler 前将 contents 换为已独立核验的 Git 原 blob；没有写 repo TS。dry 和 emit 两次都先向本 run scratch 的独立 generated 目录输出，全部枚举且确认 bytes/路径完全相同后，审计过的 `writeFileSync` 才临时覆盖 out 中精确五个**已有**文件。实际 writeFile calls 恰 5，无第六路径、独立 `.map` 或 out 目录变化；两次 stderr 都只有实际 fs.Stats deprecation warning，exit 0。不是 test-only native 未动，也不是全量编译。

| 实际 out 路径 | 输入角色 | 新鲜旧红产物 SHA-256 |
| --- | --- | --- |
| `out/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.js` | exact-c7-old-production | `79b5c7f0bededd758837b2cd138ae8065b82148ce76dcd3cad8911b09832d528` |
| `out/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.js` | exact-c7-old-production | `437050db9832f549a4db2d738c1763f976afac8b45438bffac885887543100e0` |
| `out/vs/workbench/contrib/sources/common/sourcesDiffWriteController.js` | exact-c7-old-production | `98b705105bf94df14c87d9c8a9cd7d0ab8e3c2ba1436085db6f287a9105671f8` |
| `out/vs/workbench/contrib/sources/test/browser/conversationDiffReviewPane.test.js` | exact-ab43-new-test | `96f89191349f4f2c05f18aaac3f515c27ec781a96941061aef726a90f56d765f` |
| `out/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.js` | exact-ab43-new-test | `ee52c8e8531e64d175c32ba0c2d9b447c9e92b4005e17dda8829c5f769257895` |

三个生产输入都明确绑定 c7，两个测试输入分别为 Pane SHA-256 `46211283a6bb80d49fb45c69444e9da3cccb90e9d8714b3ed80984804bdee6b2`、Panel `3fc85e07f9616c1d2bdbee9ebf47707c26fa76d14a32bc260283977caf843a0a`。这五条临时混合身份与历史 v4 / compile10 身份分开；controller / Pane.test 不借 scoped253/254 获得新增生产者 credit。

## 官方 Electron 与运行路径

实际完整 command arrays、环境覆盖、起止时间、exit、stdout/stderr SHA 全在运行记录 `stages`。直接调用本仓官方 `test/unit/electron/index.js`，Electron 为 `.build/electron/universe-agent-studio`，通过 Xvfb 运行，保留 scripts/test.sh 的 no-sandbox / disable-gpu / 15s timeout 方式；直接入口使 crash 目录可以绑定 run-owned 路径，未调用 preLaunch、未下载 Electron、未触碰真实 profile/engine。

```bash
rtk proxy timeout --foreground -k 10s 180s node /tmp/vscode-sources-accept-ab43-old-red-20261027-run1/emitter.mjs dry
rtk proxy timeout --foreground -k 10s 180s node /tmp/vscode-sources-accept-ab43-old-red-20261027-run1/emitter.mjs emit
```

A1 selector 是 `Accept post-read authorization (Pane|Panel) A1 active session changes to s2 before write$`；正控为 `Accept post-read authorization (Pane|Panel) A[23] `；独立 A4 selector 与实际选中完整标题保留在原 command / reporter。未选旧生产完整 50 矩阵，也未运行未来修订 54 项。

三次实际独有 userData：

- `/tmp/vscode-sources-accept-ab43-old-red-20261027-run1/runtime-primary-a1/vscode-tests-1793067553863-3724888`
- `/tmp/vscode-sources-accept-ab43-old-red-20261027-run1/runtime-independent-input-dispose-a4/vscode-tests-1793067558975-3725574`
- `/tmp/vscode-sources-accept-ab43-old-red-20261027-run1/runtime-positive-a2-a3/vscode-tests-1793067556638-3725202`

每阶段 TMPDIR / XDG config/cache/data、crashes、Xvfb stderr 均在同一 scratch 前缀下。三次 Xvfb 实际各用独立 `xvfb-run.*/Xauthority`，系统 socket `/tmp/.X11-unix/X117` 与 lock `/tmp/.X117-lock` 的实际观察也保留于 manifest；这些系统临时路径随后由本次 Xvfb 正常移除。共观察本 run 43 个进程身份，事后按 PID/startTime 核验全部退出。没有复用真实 profile、拉起产品窗口或引擎；这是组件测试运行，不是默认编辑器实端 after。

## finally 恢复与完整守卫

[原封存索引](sealed-originals.json)、[运行前完整采样](guard-before.json)、[临时emit后采样](guard-after-emit-out-metadata.json)、[恢复后完整采样](guard-after-restore.json)保留实际证据。共享 `/tmp/vscode-compile.lock` 持有期间，锁前/锁内 competing compiler/watch 扫描均为空。三个业务阶段后，out 继续精确等于本次临时 mixed baseline。

finally 五文件原 bytes / mode / mtime 精确恢复；254 source/native/mode/blob 与额外 controller / Pane.test 两对原字节、四份历史 freeze 原 bytes/metadata、三条原 cache symlink/metadata 全相同。out 没有新增/删除文件：其余 12,549 文件和全部 2,946 目录的完整 metadata 精确相同。仅五条授权文件的 ctimeNs 变化，每条 before/after 数值在 `restoreGuard.authorizedCtimeDifferences`，不能声称 12,554 项原 ctime 全恢复。没有重写历史 v4 freeze 或为通过旧 guard 伪造 timestamp。

以前纯方案 integration guard 以当时所有 ctime 为基准，故现在会如实拒绝这五条已获授权的 ctime 差；本证据使用**实际恢复后**采样作新只读验证基准，不改旧审计记录：

```bash
rtk proxy python3 dev/progress/sources-accept-post-read-authorization-old-red-evidence/verify-restored.py
```

## 持久化与生命周期边界

本目录精确镜像 54 份本 run 原件/driver/派生分类，共 15022205 bytes，逐件 bytes/SHA 见 inventory；原始 stdout/stderr、失败、sealed originals、五个原始 Git TS blob、dry/emit 原 JS 均保留。390 份本 run profile/cache 文件继续留在 scratch，未当 raw failure 日志复制；全部观察路径/metadata 已在运行记录，Xvfb/crash日志另镜像。镜像未改写，派生 classification 明确标记，不伪造独立 raw log。旧 R3 的 737 份库存与其 inventory 完全不扩写。

root 在本次运行之前曾独立接受 `93da1c80` 纯方案 proof：parent / 6 path committed blob / FS、src / clean / status 200，以及 01:54:43Z 的仓内 guard、600/0/46 docs health 和父 dispatch 的 main HEAD/status/WIP hash 不变。此处只是来自 root 工具回传消息的**前置历史摘要**，没有额外 raw log，也不是 root 对本次 old-red 的独立复验。

当前 plan 保持 accepted，PRD、D1387 closed、两旧窄 plan implemented、宽 Sources 与原 R3 / 314–3 / 317–0 / J425 连续性结论全部不变。A1 旧红与部分正控资格不代表新代码通过、产品签收或 overall 完成；正式 source merge、新版生产 green、完整直接相关 suites 与是否需要实端 after 仍等父级明确授权。

## 文档提交门禁

状态生成与 `--check` 实际 exit 0，生成器未改变 tracked 内容；docs health 实查 601 Markdown、0 errors / 46 warnings，详情与旧 R3 完全相同；status 200 行。54 镜像逐 bytes/SHA 复核通过，恢复后只读 guard 也通过。

cached diff-check 首次实际失败仅为精确 ab43 输入镜像 `inputs/src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts:4071: new blank line at EOF`。这是绑定 blob 的原始末尾空行，证据不改字节求绿；原错误保留在 docs-validation，仅对此一个原件路径与既有 `*.log` 例外做显式排除，再检查其余 Included 路径。它不是运行失败，也未修改候选断言。

## 父级独立复核与失败定界

root 随后独立实读本 run 的官方 reporter 原 JSON、五个输入 copy 与精确 Git、五次 write 路径和 FS/seal：A1 两个 actualJSON / 96B patch SHA / commands0 与原分类一致；正控 3 个 body pass / 2 个 afterEach 失败、Panel A3 未达、A4 setup TypeError 均确认。五文件原 bytes/mode/mtime 独立比较精确相同。以上是 root 工具回传消息的摘要，没有新增或伪造独立 raw log；其核验不把未达项升级为通过。

root / Astra 还独立对照原件与源码，确认 Panel 的真实生产 VM 所有权 Important：`setModel` 隐式创建 ViewModel 的初始引用未释放，Panel 没有 VM owner；不是 fixture 忘记 `store.add`。D 将另写 Panel 生命周期独立 draft，经规则16和 accepted 后再实施，不改通用 Widget、不由测试清理未知 VM、不豁免泄漏。独立 input.dispose 的 setup 错误则是 helper 先 create ChangesModel 后 stub UA；后续只在 `resolveModels=true` 新路径预注入修正，旧默认 helper/case/header 保持。本 run 不修改任何生产、测试、断言或原记录来获取预期颜色，当前 output release 已在 finally 恢复后耗尽。

## 本次更新前 status 首条逐字保留

来源 `93da1c80e58c02cf3b6c5d5a823738758f538507:dev/progress/status.md`，含末尾换行 SHA-256 `f394723d5465b450eb0bfac7f27464b0cfe9114919da325da116044af608c4b3`。本次只替换 Current Session 这一行，status 仍 200 行，其余原文不动；[JSON原件](prior-status-entry.json)。

```markdown
- **Sources Accept 读后写前授权方案签收（2026-10-27）**：原draft4b0d3d经父逐路径核验与Astra规则16 C0/I0/M2，input独立销毁/统一UI存活门、catalog Session/List与Git Changes read-failed分控两Minor已实改，[方案accepted](../plans/sources-accept-post-read-authorization.md)；只签方案，未实施/运行，srca2c/out冻结、baseline唯一lane。旧R3/draft首条均[逐字保留](sources-accept-post-read-authorization-checkpoint.md)，D1387/旧plan/PRD保持，lease/local notice后续候选。 · [accepted方案接入守卫](sources-accept-post-read-authorization-integration.md)。
```
