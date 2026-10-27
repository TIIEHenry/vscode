---
title: "Sources Accept：原 default-false 旧用例资格探针"
type: index
status: active
phase: M7
updated: 2026-10-27
summary: "精确c7原Pane test/helper/case实测setup TypeError，未达FileDiff/clearInput/Apply；三生产run1字节连续且未写，唯一test JS恢复，非业务red/非新54/无新绿。"
---

# Sources Accept：原 default-false 旧用例资格探针

[实际运行记录](validation-report.json) · [官方 reporter 原JSON](original-default-false.mocha.json) · [精确分类](result-classification.json) · [生产连续性](production-continuity.json) · [原件清单](artifact-inventory.json) · [文档门禁](docs-validation.json) · [先前 run1](../sources-accept-post-read-authorization-old-red-evidence/INDEX.md)

## 实际结果与资格边界

root 单独授权本次极小探针，与未来 run2 分开。运行中 repository 保持 clean `d51ce65f86605b47f31c8d99bfbd98fd9f43564d` / src `a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`。唯一输入是精确 `c7fefd780bd9720f3889e310d4706210189a3fc7:src/vs/workbench/contrib/sources/test/browser/conversationDiffReviewPane.test.ts`；原 helper、原 case、原 header 与全部断言逐字保留，没有 ab43 新 fixture。

官方 Electron 仅选择原 case：

```text
in-flight Accept does not ApplyHunks after clearInput bumps write generation$
```

进程实际 exit 1，reporter 为 **1 test / 0 pass / 1 failure**，14ms。原错误为 `TypeError: Cannot read properties of undefined (reading 'onDidChangeConnection')`，栈为 `SourcesChangesModel:59 → stubSessionAndChangesModel:88 → createInstantiationService:114 → 原case:159`。该 setup 发生在创建 Pane/输入与执行 `runAccept` 之前，未达 FileDiff/read-start、clearInput 或 Apply 断言。结论是**原 default-false 路径既有 setup 失败**，业务旧红 0，不计入新54，不把预测替代实测，也不把此结果当成生产授权问题的旧红。

该原用例每次新建 DI；原 helper 在 stub UA 之前 create ChangesModel，故不仅 ab43 的新 resolveModels=true 路径受这条顺序影响。本探针只提供下一步计划窄修订所需的实际资格，不自行修改已签方案 §3.4、生产、fixture、case 或断言，也不影响 D 的既有 WIP。后续修订仍由父级另行授权。

## 三份生产的真实 c7 连续性

本次生产 **0次 out 写入**。不是从旧 scoped254 对 controller 的遗漏推断生产者资格：实际逐项证明 committed run1 的 fresh c7 emitter report、其 emitted JS、sealed 原件、对应 Git blobs 与当前 native bytes 全部相等。原件来源、sourceRef/blob/SHA、report SHA 与逐步比较见 production-continuity JSON。

| 未写入的实际生产 JS | run1 fresh / seal / committed copies / 当前共同 SHA-256 |
| --- | --- |
| `out/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.js` | `79b5c7f0bededd758837b2cd138ae8065b82148ce76dcd3cad8911b09832d528` |
| `out/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.js` | `437050db9832f549a4db2d738c1763f976afac8b45438bffac885887543100e0` |
| `out/vs/workbench/contrib/sources/common/sourcesDiffWriteController.js` | `98b705105bf94df14c87d9c8a9cd7d0ab8e3c2ba1436085db6f287a9105671f8` |

run1 producer 精确以 c7 三份生产源码实际定向 emit；本次只沿用上述字节连续性，没有新生产编译，也不声称全量 final source compile。

## 单输入 emitter 与唯一实际写入

[新 driver](emitter.mjs)、[编排/恢复脚本](validate.py)、[与旧 driver 的派生说明](driver-derivation.json)、[输入manifest](input-manifest.json)、[工具/配置](emitter-options.json)、[dry枚举](dry-emitter-report.json)、[实际emit记录](emit-emitter-report.json)全部保留。旧 run1 driver 和记录原样不改。

唯一 TS 输入为 8391 bytes，SHA-256 `6225a728f46004f251a616308f879ba9a0dd8fcbac9307d59d5ba32d62e426c4`，Git blob `9a1d8792656f643fb2a1746d174f074de3ea7173`。真实管线是仓库 `createCompile` + `ESBuildTranspiler` + `streamToPromise`；canonical Vinyl path/base 保持本仓路径，contents 从精确 Git blob 注入，不写 repo TS。dry 和 emit 都先写本次 scratch generated 产物并枚举验证，然后才允许一次 `writeFileSync` 覆盖既有：

```text
out/vs/workbench/contrib/sources/test/browser/conversationDiffReviewPane.test.js
```

两次 emitter 实际 exit 0；恰1 JS、0独立 map、实际 out writeFile 恰1。没有其他 out 路径或目录写入。stdout/stderr 原件保留，stderr 只有实际 fs.Stats deprecation warning。`validate.py` 自身 exit 0 仅表示编排/恢复完成，不代表 Electron case 通过。

完整 actual commands、selector、环境和原 stdout/stderr SHA 都在 stages 中。使用本仓官方 `test/unit/electron/index.js` 及 `.build/electron/universe-agent-studio`，Xvfb、no-sandbox / disable-gpu / 15s timeout；直接官方入口将 crash path 放在 run-owned scratch，未 preLaunch、未使用真实 profile、未拉起引擎。

实际唯一 userData：

- `/tmp/vscode-sources-accept-default-false-probe-20261027-run1/runtime-original-default-false/vscode-tests-1793070233942-34316`

TMPDIR / XDG / crashes / Xvfb auth 均用 `/tmp/vscode-sources-accept-default-false-probe-20261027-run1/` 前缀；Xvfb 系统 socket/lock 的实际路径、时间、进程 argv 另在 manifest。观察到23个本次进程身份，事后按PID/startTime核验全部退出。

## seal、finally 与当前冻结基准

[seal](sealed-originals.json)、[完整运行前采样](guard-before.json)、[临时emit后采样](guard-after-emit-out-metadata.json)、[完整恢复后采样](guard-after-restore.json)均为本次实际原件。全程共享 compile lock，锁前/锁内 competing compiler/watch 扫描为空。

finally 唯一测试 JS 原 bytes/mode/mtime 精确恢复；254＋extra2 source/native/mode/blob 对、其他12,553个 out 文件与全部2,946目录的完整 metadata 精确相同，四份历史 freeze、三条原 cache symlink/metadata 精确不变。只有该测试 JS 本轮 ctimeNs 授权变化：`1793067560907405947 → 1793070236599634065`，不能声称原 ctime 恢复。

这是以 run1 实际恢复后基准起步的独立授权变化：没有覆盖 run1 的五条历史ctime差或修改旧 guard；run1 原 guard 现在会如实拒绝新增这一条ctime变化。本页的只读验证以本探针**实际恢复后**完整采样为基准：

```bash
rtk proxy python3 dev/progress/sources-accept-default-false-probe-20261027-evidence/verify-restored.py
```

release 在 finally 完成后结束，当前 out 再次冻结。未正式接入新代码、未新绿/全量编译/跑其他case；原 R3、run1、PRD、D1387和既有 plan 状态均未升级，overall goal active。

## 原件与前置独立签收摘要

本目录镜像 28 份本探针原件/driver/派生分类，共 12168523 bytes，逐份SHA和来源在inventory；本 run profile/cache继续留在scratch，其实际路径/metadata已记录，Xvfb/crash日志另镜像。旧 run1/R3 库存和原始失败均不改写。

root 在本探针之前独立签收 d51 run1：61路径、54镜像15,022,205B逐份scratch/repo/Git精确，02:36:40Z独立恢复guard exit0、254+extra2/files+dirs/freeze4/cache3全稳。此处仅为root工具回传的**前置历史摘要**，没有新增raw log，也不冒充root已独立复跑本探针。

## 父级独立复核本探针

root 随后独立实读本探针官方原JSON，确认 stats1/0/1、原case完整title、TypeError及59→88→114→159栈和未达业务边界；输入copy bytes/SHA独立等Git c7，当前唯一native原bytes/mode/mtime独立等seal。root实读三份生产连续性表，确认actual run1 fresh c7 → sealed → d51 committed copies → 当前SHA全部相同，接受该最小生产绑定；不以scoped254填补controller生产者资格。以上仅为root工具回传摘要，不制造独立raw log。

父级要求D先提交当前only-true预stub的Panel候选，再对§3.4共同预stub提出显式窄proposal，经过规则16与accepted后才实施；此探针不授权共同修改，也不授权新green。本证据保持当前原件与既有代码不动。

## 当前更新前 status 首条逐字保留

来源 `d51ce65f86605b47f31c8d99bfbd98fd9f43564d:dev/progress/status.md`，含末尾换行SHA-256 `b54be5d15b0cc69266cf1f192364a639711c25bd971271d93189041b542948e1`；本次只替换这一行，status仍200行，其余原文不动。[JSON原件](prior-status-entry.json)。

```markdown
- **Sources Accept 读后授权旧红资格（2026-10-27）**：精确c7旧3生产+ab43新2test、真实定向emit恰5JS/0独立map；A1双宿主read1后向旧s1实际Apply1，各纯业务AssertionError。A2/A3仅3业务body过，Panel A2后3资源泄漏+console hook败致Panel A3未达；独立input.dispose为setup TypeError、业务红0。finally五原bytes/mode/mtime、254+2pair、其余12549文件/2946目录metadata及freeze4/cache3恢复，仅5授权ctime差。[原件/分类/恢复](sources-accept-post-read-authorization-old-red-evidence/INDEX.md)；方案仍accepted，未formal合code/新绿/全矩阵/产品签收，旧R3/PRD/D1387/宽Sources保持，overall active。
```
