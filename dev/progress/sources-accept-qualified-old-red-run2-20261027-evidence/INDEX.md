---
title: "Sources Accept：a4a 旧生产资格 run2 加载失败原件"
type: index
status: active
phase: M7
updated: 2026-10-27
summary: "两test真实emit、三旧生产0写；A4/Panel A3/原default-false均runner动态import失败，无Mocha/业务red/positive，36owned退出、两JS精确恢复。"
---

# Sources Accept：a4a 旧生产资格 run2 加载失败原件

[实际编排原记录](validation-report.json) · [原件与runtime分类清单](artifact-inventory.json) · [精确结果分类](result-classification.json) · [加载归因源码](loading-attribution.json) · [生产连续性](production-continuity.json) · [父级独立核验通报](parent-independent-review.json) · [文档门禁](docs-validation.json)

## 实际结论

root 单独授权一次 run2，输入固定 `a4a70322795c509e8e9b8274cf295a1b65db663a` 两份测试，候选 src `d78a48e5feee57fcaf5811c8425859d0a2400af0`。merge 始终是 `942d0652065d7aafe085d2e54a95c17bcd4f4c1c` / src `a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`，未正式合源。三份实际 [stdout A4](independent-input-dispose-a4.stdout.log)、[stdout Panel A3](panel-a3-positive.stdout.log)、[stdout 原default-false](original-default-false.stdout.log) 都在加载阶段报告：

```text
TypeError: Failed to fetch dynamically imported module: file:///.../out/test/unit/electron/index.js
```

三进程各 exit 1，均未触发外部 watchdog。**没有 Mocha reporter 或可用 stats**，不写成 Mocha 0/0/3；业务 red 0、positive body 0，未获得 read / ApplyHunks / refresh 投影。本次既不是 fixture 业务红，也不是 green；没有取得 A4 或原 default-false 的有效业务资格，Panel A3 正控也未运行到 body / afterEach 泄漏边界。`validate.py` 自身 exit 0 只说明编排与 finally 恢复完成。

| 独立组 | 精确 selector | 实际结果 |
| --- | --- | --- |
| A4 | `Accept post-read authorization input\.dispose with live Pane and identical input sends no ApplyHunks$` | runner 加载失败；无业务投影 |
| Panel A3 | `Accept post-read authorization Panel A3 s1 to s2 to s1 uses current authorization$` | runner 加载失败；无正控 body |
| 原 default-false | `in-flight Accept does not ApplyHunks after clearInput bumps write generation$` | runner 加载失败；未进入 clearInput 业务 |

原 [run1](../sources-accept-post-read-authorization-old-red-evidence/INDEX.md) 双 A1 业务旧红、三个正控 body 与 Panel VM cleanup 失败、独立 A4 setup 未达，以及 [c7原default-false探针](../sources-accept-default-false-probe-20261027-evidence/INDEX.md) setup TypeError 均保持原结论；本次加载失败不覆盖它们。

## 加载归因与授权状态

[源码归因 JSON](loading-attribution.json)保留固定 HEAD 的官方 runner 源码 hash、Git blob、行号原文与旧 run1 / run2 实际命令。run2 将 `--user-data-dir=<owned-path>` 放在 `test/unit/electron/index.js` 之前；官方入口 `process.argv.slice(2)` 后把 bare `.ts/.js` positional 加入 `run`，renderer 将其转换为 `out` 模块路径，`await loadTests` 因导入上述不存在的 entry 模块而先于 `mocha.run` 失败。没有运行额外 argv probe 或热改原 driver。

root 后续只授权下一独立 run3 的准备：删这一 pre-entry flag；官方 non-dev runner 会用 `tmpdir()` 将 userData 放入现有隔离 TMPDIR。不能把未来修正写成本次已成功，更不能自动重跑。

本次 [prepared release原件](prepared-state/execution-release.json)、[prepared清单原件](prepared-state/preparation-inventory.json)与 [授权态release](execution-release.json)、[授权身份](execution-authorization-identity.json)分别逐字保存。`preparation-inventory.json` 仍是当时 prepared-not-run 的历史原件，没有回写成已执行状态；一次实际 release 已消费，当前 out 再次冻结。

## 两测试输入与真实 emitter

[manifest](input-manifest.json)、[driver](validate.py)、[emitter](emitter.mjs)、[工具/配置](emitter-options.json)、[dry](dry-emitter-report.json)、[emit](emit-emitter-report.json)、[out write journal](out-write-journal.jsonl)保留实际身份。两份输入均从上述不可变 a4a Git blob 注入 canonical Vinyl contents，不写 repository TS：

| 测试 | TS bytes / SHA-256 | 实际临时 JS bytes / SHA-256 |
| --- | --- | --- |
| Pane | 13078 / `93d4b2f612e21212558c890f5a0cdb3c16b5fc657c47635f6e6a942dbac372fc` | 39356 / `6ebd9cd01fe19ece917086eb58a377ac4232638ed79e96d3d61dcbc284aa4935` |
| Panel | 189054 / `ef28732018c703848be327f384aa3edaeabd2e3d8b4fb1e890f168c443596967` | 600166 / `449619b442e1502d5396c70dce05d771dd5367d20569d4402cb23d1df34804ff` |

真实 `createCompile` / `ESBuildTranspiler` / `streamToPromise` 的 dry 与 emit 都 exit 0，精确2 JS、0独立 map；完整枚举及全部 original/generated 校验之后，实际只 writeFile 两份既有 test JS。生产写入0，没有 source checker、全量 compile、新生产、窗口或引擎运行。

三份未写旧生产 JS 的 actual run1 fresh-c7 emitter → seal → committed emit/seal copies → 当前 bytes 全连续，见 production-continuity；不从历史254对 controller 的遗漏推断 producer 资格。共同 SHA：Pane `79b5c7f0bededd758837b2cd138ae8065b82148ce76dcd3cad8911b09832d528`，Panel `437050db9832f549a4db2d738c1763f976afac8b45438bffac885887543100e0`，controller `98b705105bf94df14c87d9c8a9cd7d0ab8e3c2ba1436085db6f287a9105671f8`。

## 进程、隔离与精确恢复

三独立 Electron 进程各用自己的 TMPDIR / XDG / userData / crashes / Xvfb 路径；默认官方 non-dev userData 位于相应 TMPDIR 下。唯一继承 token、PID/startTime、session、subreaper 与 pidfd 的完整代码和观察账本保留。五阶段共观察36个唯一进程身份，全部停止并 reap，复核时原 PID/startTime 均不存在；实际 signals 0、watchdog expired 0，因此本次不声称实测触发了 45+5+5 超时收口分支。观察到的 Xvfb `/tmp/.X11-unix/X117` 与 `/tmp/.X117-lock` 在每组结束后均不存在。

[seal](sealed-originals.json)、[运行前完整采样](guard-before.json)、[emit后metadata](guard-after-emit-out-metadata.json)、[实际恢复后完整采样](guard-after-restore.json)均为原件。所有 owned 后代停止后才 finally 恢复两份测试原 bytes / mode / mtime；254+extra2 source/native 对、其余12552文件、全部2946目录完整metadata、freeze4/cache3精确。仅两条授权 ctimeNs 改变：

- Pane.test.js：`1793070236599634065 → 1793073162546924732`
- Panel.test.js：`1793067560909405986 → 1793073162547924782`

旧 probe / run1 guards 不改写。当前只读恢复验证绑定本 run2 **实际恢复后**完整基准，SHA-256 `0ad83388bd541c9271e79b425dd055f76a9acf28cba45ee350e72107a4f7870e`：

```bash
rtk proxy python3 dev/progress/sources-accept-qualified-old-red-run2-20261027-evidence/verify-restored.py
```

root 于 `2026-10-27T03:54:11.030512Z` 独立 snapshot 与该基准全等，核两 native 原bytes/mode/mtime、五阶段全部 stdout/stderr hash/bytes 及36进程 quiescent；此处明确是父级工具通报摘要，不制造另一份 raw log。最新外部 main 观察沿 policy 中 root 提供的 `03:13:42.701550Z / d91a7a8d / 53 status lines` 保存其准确 SHA；外部 WIP 变化未归因、未导入，不称整个 wave 主工位未变。

root 又于 `2026-10-27T03:58:43.698361Z` 按原report提取的36个唯一PID/startTime逐项读 `/proc`，无同identity存活，两个记录的Xvfb socket/lock实际不存在；prepared inventory八份历史文件（release取prepared-state副本）的bytes/SHA逐项精确。此处同为父通报，原report/guard/prepared inventory均不改。

## 原件分类与未升级范围

镜像数量与精确总字节以 artifact-inventory 为准；driver/emitter/inputs、dry/emit产物、seals、全部五阶段 stdout/stderr、Xvfb/crash原件、prepared-state及授权态逐份 scratch/repo bytes 与SHA相同。其余 run-owned profile/cache/runtime 文件只登记metadata并继续留在 scratch；不把 runtime缓存体积当成原件镜像数量。旧 run1/probe/R3 原件与 inventories 不改、不重扫。

本次只保存失败证据与当前恢复基准。accepted plan、PRD、D1387、旧波与更宽 Sources 状态全部保持；无正式新源码集成、新 green、fullCompileOfFinalSourceTree 或产品签收，overall goal active。

## 当前更新前 status 首条逐字保留

来源 `942d0652065d7aafe085d2e54a95c17bcd4f4c1c:dev/progress/status.md`；[原字节/hash](prior-status-entry.json)保存含末尾换行的旧首条。本轮只替换这一条，status保持200行，其余行逐字不动：

```markdown
- **Sources Accept 原default-false资格探针（2026-10-27）**：只取精确c7原Pane.test/helper/case，三旧生产经run1 fresh→seal→当前逐SHA连续且未写；真实定向仅1test JS/0map，官方旧clearInput case 0过1setup TypeError(undefined.onDidChangeConnection)，未达FileDiff/clear/Apply，不计业务red或新54。finally原bytes/mode/mtime、254+2pair、其余12553文件/2946目录及freeze4/cache3精确，只有该test ctime差。[原件/资格边界](sources-accept-default-false-probe-20261027-evidence/INDEX.md)；run1双A1红与3正控body/泄漏/A4未达原结论保持，未合code/新绿/升plan，overall active。
```
