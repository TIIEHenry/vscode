---
title: "D390 packaging-p2-vscode-web-machine 无窗排除面证据"
type: progress
status: in_progress
phase: packaging
updated: 2026-09-12
summary: "首败与 8192/env 失败保留。直接 node CLI 16g/32g 各一次仍 exit 134；GC ~3 GB；dest 未写。未关 D390/D391/D392/D389/D18/D20/D12。"
---

# D390 无窗 vscode-web 排除面证据

> **切片：** [d390-packaging-p2-vscode-web-machine](../roadmap/active/d390-packaging-p2-vscode-web-machine.md)  
> **包装树：** `/home/clarence/Projects/Agents/vscode-WorkTrees/merge`  
> **HEAD SHA：** `311734f3ff561b612abc29de7737a188b2702e66`（`git rev-parse HEAD`；`== origin/agent-ide`；未 commit）  
> **dest 锁：** 仅 merge 槽跑 `gulp vscode-web`；WT 池 dest = `/home/clarence/Projects/Agents/vscode-WorkTrees/vscode-web`  
> **裁定：** **blocker。** 首败 A **exit 1**（mangler；§A 保留）。D391 可见性修复保留。`npm run gulp` 8192 两次 + env 16g/32g 仍 **exit 134**（§A2 / §A3 保留；env 未抬主进程）。本 tick 不改 `package.json`：直接 `node --experimental-strip-types --max-old-space-size=16384 ./node_modules/gulp/bin/gulp.js vscode-web` **exit 134**；再 `32768` **exit 134**（§A4）。CLI heap **已生效**（探针 `16384` → `heap_size_limit` 16480 MB），仍死在 compile-src 后约 2.9–3.1 GB。`$PRODUCT` **未写出**。B/C **未跑**（不假绿）。未改 `package.json` / gulpfile / `.webignore` / `remote/web` / allowlist。未换 `vscode-web-min` / 桌面 gulp。未关 D390 / D391 / D392 / D389 / D18 / D20（两行）/ D12。未提交 dest。D393 **未占用**。

## Current facts

| 项 | 结论 |
|:---|:-----|
| 包装树 HEAD | `311734f3ff561b612abc29de7737a188b2702e66` |
| `node_modules` | **存在** |
| dest gulp 前 | **不存在** |
| `npm run gulp vscode-web` 首败 | **exit 1**（2026-09-12T13:22:05 → 13:22:38 +08；约 30 s；mangler implicit-public） |
| D391 修复后重跑 1 | **exit 134**（2026-09-12T13:31:57 → 13:32:45 +08；mangler 过；compile-src 0 后 OOM） |
| D391 修复后重跑 2 | **exit 134**（2026-09-12T13:33:18 → 13:34:05 +08；同 OOM，复现） |
| 授权 env 16g | **exit 134**（2026-09-12T13:38:24 → 13:39:19 +08；`NODE_OPTIONS=16384`；CLI 仍 8192；compile-src 0 后 MarkCompact OOM） |
| 授权 env 32g | **exit 134**（2026-09-12T13:39:28 → 13:41:04 +08；`NODE_OPTIONS=32768`；CLI 仍 8192；compile-src 0 后 scavenger OOM） |
| 直接 node CLI 16g | **exit 134**（2026-09-12T13:44:39 → 13:45:41 +08；`--max-old-space-size=16384`；compile-src 0 后 MarkCompact OOM） |
| 直接 node CLI 32g | **exit 134**（2026-09-12T13:46:09 → 13:46:56 +08；`--max-old-space-size=32768`；compile-src 0 后 scavenger OOM） |
| 失败步（首败） | `compile-src` → `Mangler.computeNewFileContents`（`build/lib/mangle/index.ts` L568） |
| 失败步（重跑 / heap） | `compile-src` 已 `0 errors` 后 Node OOM（8192 / env / 直接 CLI 16g·32g 均同死区 ~3 GB） |
| `$PRODUCT` gulp 后 | **仍不存在**（未 rimraf、未 `vfs.dest`） |
| `$PRODUCT` 身份（`package.json` + `out/`） | **未跑**（无 dest） |
| 产物树 `@grpc/grpc-js` | **未扫**（无 dest；禁止空目录假绿） |
| `test ! -e "$PRODUCT/node_modules/@grpc/grpc-js"` | **未跑**（无 dest） |
| `rg -n 'grpc' remote/web/package.json` | **无匹配**（`rg` exit 1） |
| gulp / `.webignore` / `remote/web` | **未改**（未见产物 grpc；缺包条 N/A） |
| `vscode-linux-x64` / `prepare-deb` | **未跑** |
| 桌面包 dest | **仍活**（asar mtime `2026-09-12 11:38:53 +08`，对齐 D388；本 tick 未碰） |
| D390 / D391 / D392 / D389 / D18 / D20（两行）/ D12 | **仍 planned / open**（§5 未齐，不得关 D390；D393 未占用） |

---

## A. `npm run gulp vscode-web`（exit 1）

```bash
npm run gulp vscode-web
```

| 字段 | 值 |
|:-----|:---|
| 开始 | `2026-09-12T13:22:05+08:00` |
| 结束 | `2026-09-12T13:22:38+08:00` |
| exit | **1** |
| 任务 | `'vscode-web' errored after 30 s` |
| 失败步 | `compile-src` / `[mangler] ERROR: Protected fields have been made PUBLIC` |
| dest | 未写出 |

**日志尾（原文）：**

```
[13:22:07] Starting compile-src ...
[13:22:35] [mangler] Done collecting. Classes: 14792. Exported symbols: 19305
[13:22:37] [mangler] WARN: 'updateChecked' from /home/clarence/Projects/Agents/vscode-WorkTrees/merge/src/vs/base/browser/ui/toggle/toggle.ts:497 became PUBLIC because of: /home/clarence/Projects/Agents/vscode-WorkTrees/merge/src/vs/sessions/contrib/changes/browser/sessionChangesEditor.ts:471
[13:22:37] [mangler] WARN: 'updateChecked' from /home/clarence/Projects/Agents/vscode-WorkTrees/merge/src/vs/base/browser/ui/actionbar/actionViewItems.ts:262 became PUBLIC because of: /home/clarence/Projects/Agents/vscode-WorkTrees/merge/src/vs/sessions/contrib/changes/browser/sessionChangesEditor.ts:471
[13:22:37] [mangler] WARN: 'getTooltip' from /home/clarence/Projects/Agents/vscode-WorkTrees/merge/src/vs/base/browser/ui/actionbar/actionViewItems.ts:224 became PUBLIC because of: /home/clarence/Projects/Agents/vscode-WorkTrees/merge/src/vs/sessions/contrib/changes/browser/sessionChangesEditor.ts:478
[13:22:37] [mangler] ERROR: Protected fields have been made PUBLIC. This hurts minification and is therefore not allowed. Review the WARN messages further above
[13:22:37] Starting compilation...
[13:22:37] 'vscode-web' errored after 30 s
[13:22:37] Error: Protected fields have been made PUBLIC. This hurts minification and is therefore not allowed. Review the WARN messages further above
    at Mangler.computeNewFileContents (file:///home/clarence/Projects/Agents/vscode-WorkTrees/merge/build/lib/mangle/index.ts:568:10)
    at task (file:///home/clarence/Projects/Agents/vscode-WorkTrees/merge/build/lib/compilation.ts:144:47)
GULP_EXIT=1
```

完整 gulp 日志（仓外，不入 git）：`/tmp/d390-gulp-vscode-web.log`

**根因（本工位，只读）：**

`vscode-web` = `compileBuildWithManglingTask` + `vscode-web-ci`（`build/gulpfile.vscode.web.ts` L250–253）。mangler 在 `packageTask` 之前跑。`ChangesetReviewActionViewItem`（`sessionChangesEditor.ts` L471 / L478）override 基类 `protected updateChecked` / `protected getTooltip`，跨文件访问使上述成员 implicit-public；`strictImplicitPublicHandling` 仅放行 `saveState`（`compilation.ts` L144），故 throw。

对照：D388 的 `vscode-linux-x64`（非 min）走 `compileBuildWithoutManglingTask`（`gulpfile.vscode.ts` L758），故同树同文件未挡桌面包。本切片冻结任务是 `vscode-web`，**不得**改跑无 mangling 任务或 `vscode-web-min`。

该类在 D388 SHA `3b4cc89f6e53f14935d8396e7061c11fc74907df` 已存在。不是本 tick 新引入。

合同：未见产物 grpc → **未改** gulp / `.webignore` / `remote/web`。未把 `updateChecked`/`getTooltip` 加进 allowlist。

---

## A2. D391 可见性修复 + 重跑 A（exit 134）

**代码（最小、可见性安全）：** `ChangesetReviewActionViewItem` 去掉跨文件 `override updateChecked` / `override getTooltip`。`override render` 后按 `action.checked` 写 container `title` / `aria-label`（checked → “Mark as Not Viewed”，unchecked → “Mark as Viewed”）；capture `click`/`keydown` + `queueMicrotask` 在勾选翻转后刷新。不调跨文件 `protected updateAriaLabel` / `updateTooltip`。未改 `src/vs/base/**`。未改 mangler / `compilation.ts` allowlist。

**重跑 1（原样 `npm run gulp vscode-web`）：**

| 字段 | 值 |
|:---|:---|
| 开始 | `2026-09-12T13:31:57+08:00` |
| 结束 | `2026-09-12T13:32:45+08:00` |
| exit | **134**（Aborted / OOM） |
| mangler | **过**（无 implicit-public WARN/ERROR；`Done creating class replacements`） |
| compile-src | `Finished compile-src ... tsconfig.json with 0 errors` |
| 随后 | `FATAL ERROR: Scavenger: semi-space copy Allocation failed - JavaScript heap out of memory` |
| dest | 未写出 |

**重跑 2（同命令，未改 heap / 未改 gulpfile）：**

| 字段 | 值 |
|:---|:---|
| 开始 | `2026-09-12T13:33:18+08:00` |
| 结束 | `2026-09-12T13:34:05+08:00` |
| exit | **134**（同 OOM，复现） |
| mangler / compile-src | 同重跑 1（mangler 过；compile-src 0） |
| dest | 未写出 |

完整重跑摘录（仓外，不入 git）：`/tmp/d390-gulp-vscode-web-retry.log`。首败全文仍在 `/tmp/d390-gulp-vscode-web.log`。

新缺口 [D392](deferred-gaps.md)：冻结 npm gulp 脚本已是 `--max-old-space-size=8192`。授权 env heap 后仍红，见 §A3。

---

## A3. 授权 env heap bump（16g / 32g，均 exit 134）

父裁定：**仅** env heap；不改 gulp 任务名 / `package.json` / gulpfile / allowlist / `.webignore`。任务仍 `npm run gulp vscode-web`。

**16g：**

```bash
NODE_OPTIONS='--max-old-space-size=16384' npm run gulp vscode-web
```

| 字段 | 值 |
|:---|:---|
| 开始 | `2026-09-12T13:38:24+08:00` |
| 结束 | `2026-09-12T13:39:19+08:00` |
| exit | **134** |
| npm 回显 | `node --experimental-strip-types --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js vscode-web` |
| mangler | **过**（`Done creating class replacements`；无 implicit-public） |
| compile-src | `Finished compile-src ... tsconfig.json with 0 errors`（13:38:56） |
| 随后 | `FATAL ERROR: MarkCompactCollector: young object promotion failed Allocation failed - JavaScript heap out of memory` |
| GC 快照 | Scavenge ~2974.6 (3030.2) → 2950.6 (3037.9) MB |
| dest | 未写出 |

**32g（16g 仍 OOM 后的唯一再试）：**

```bash
NODE_OPTIONS='--max-old-space-size=32768' npm run gulp vscode-web
```

| 字段 | 值 |
|:---|:---|
| 开始 | `2026-09-12T13:39:28+08:00` |
| 结束 | `2026-09-12T13:41:04+08:00` |
| exit | **134** |
| npm 回显 | 同 16g（CLI 仍 `--max-old-space-size=8192`） |
| mangler / compile-src | mangler 过；`Finished compile-src ... 0 errors`（13:40:32） |
| 随后 | `FATAL ERROR: Scavenger: semi-space copy Allocation failed - JavaScript heap out of memory` |
| GC 快照 | Scavenge ~2865.1 (2921.8) → 2856.6 MB；Mark-Compact → 2847.8 (2919.9) MB |
| dest | 未写出 |

仓外日志（不入 git）：`/tmp/d390-gulp-vscode-web-heap16g.log`、`/tmp/d390-gulp-vscode-web-heap32g.log`。首败仍在 `/tmp/d390-gulp-vscode-web.log`；原两次 8192 仍在 `/tmp/d390-gulp-vscode-web-retry.log`。

**观察（未改脚本）：** `package.json` `"gulp"` 把 `--max-old-space-size=8192` 写在 CLI 上；Node 以 CLI 覆盖 `NODE_OPTIONS`。主进程 heap 未抬到 16g/32g。GC 死在约 2.8–3.0 GB（young / scavenger），不是 16/32 GB 上限。授权范围已用尽（16g 一次 + 32g 一次）。**不得**改 `package.json` / 换 `vscode-web-min` / 桌面 gulp。D392 **仍 planned**。直接 CLI 重跑见 §A4。

---

## A4. 直接 node gulp.js（CLI heap 16g / 32g，均 exit 134）

父裁定：**不**改 `package.json`。argv 与 npm `"gulp"` 相同，只把 `8192` 换成真实 heap。不经 `npm run gulp`。

**16g：**

```bash
node --experimental-strip-types --max-old-space-size=16384 ./node_modules/gulp/bin/gulp.js vscode-web
```

| 字段 | 值 |
|:---|:---|
| 开始 | `2026-09-12T13:44:39+08:00` |
| 结束 | `2026-09-12T13:45:41+08:00` |
| exit | **134**（Aborted / 核心已转储） |
| argv | CLI `--max-old-space-size=16384`（非 NODE_OPTIONS） |
| 探针 | 同旗标 `v8.getHeapStatistics().heap_size_limit` ≈ **16480 MB**（旗标生效） |
| mangler | **过**（`Done creating class replacements`；无 implicit-public） |
| compile-src | `Finished compile-src ... tsconfig.json with 0 errors`（13:45:12） |
| 随后 | `FATAL ERROR: MarkCompactCollector: young object promotion failed Allocation failed - JavaScript heap out of memory` |
| GC 快照 | Scavenge ~2939.8 (2992.6) → 2923.7 (2993.6) MB |
| dest | 未写出 |

**32g（16g 仍 OOM 后的唯一再试）：**

```bash
node --experimental-strip-types --max-old-space-size=32768 ./node_modules/gulp/bin/gulp.js vscode-web
```

| 字段 | 值 |
|:---|:---|
| 开始 | `2026-09-12T13:46:09+08:00` |
| 结束 | `2026-09-12T13:46:56+08:00` |
| exit | **134** |
| argv | 同形，`32768` |
| mangler / compile-src | mangler 过；`Finished compile-src ... 0 errors`（13:46:39） |
| 随后 | `FATAL ERROR: Scavenger: semi-space copy Allocation failed - JavaScript heap out of memory` |
| GC 快照 | Scavenge 3050.0 (3137.7) → 3035.1 (3137.7) MB |
| dest | 未写出 |

仓外日志（不入 git）：`/tmp/d390-gulp-vscode-web-direct16g.log`、`/tmp/d390-gulp-vscode-web-direct32g.log`。先前失败全文仍在 `/tmp/d390-gulp-vscode-web.log` / `-retry.log` / `-heap16g.log` / `-heap32g.log`。

**观察：** CLI heap **已抬**（非 npm 8192 覆盖）。仍死在 compile-src 后约 2.9–3.1 GB，与 8192 / env 同死区。当时 `free`：内存 used ~29Gi / available ~31–32Gi；**swap 9Gi 已满**。授权直接 node 两次已用尽。未改 `package.json`。只改 `package.json` 8192→16384 会复现本条 16g 命令，**不能**当已证明的修复。D390 / D391 / D392 **仍 planned**。

---

## B. 仓外产物身份（未跑）

```bash
REPO="$(pwd)"
PRODUCT="$(dirname "$REPO")/vscode-web"
test -f "$PRODUCT/package.json"
test -d "$PRODUCT/out"
```

| 字段 | 值 |
|:---|:---|
| `$REPO` | `/home/clarence/Projects/Agents/vscode-WorkTrees/merge` |
| `$PRODUCT` | `/home/clarence/Projects/Agents/vscode-WorkTrees/vscode-web` |
| gulp 前 `ls` | `没有那个文件或目录` |
| gulp 后 `ls`（首败 + 两次 8192 + env 16g/32g + 直接 CLI 16g/32g） | `没有那个文件或目录` |
| `test -f package.json` | **未跑**（无 dest） |
| `test -d out` | **未跑**（无 dest） |

空 / 缺 dest **不得**当身份锁。

---

## C. 产物树排除面（未跑）

```bash
rg -n --fixed-strings '@grpc/grpc-js' "$PRODUCT"
test ! -e "$PRODUCT/node_modules/@grpc/grpc-js"
```

**未跑。** A 仍红（首败 exit 1；8192 / env / 直接 CLI 16g·32g 均 exit 134）且 dest 不存在。禁止把「扫不到」写成绿。

---

## D. 依赖根源

```bash
rg -n 'grpc' remote/web/package.json
```

`rg` **exit 1**（无匹配）。本条不依赖 dest。`remote/package.json` 仍是 D388 下限，本切片未打 REH。

---

## 禁跑复证

| 禁令 | 本 tick |
|:-----|:--------|
| `npm run gulp vscode-linux-x64` | **未跑** |
| `vscode-linux-x64-prepare-deb`（含第四次） | **未跑** |
| `vscode-web-min` | **未跑** |
| `scripts/code-web.sh` / 活窗 | **未跑** |
| `compile-client` | **未跑** |
| 桌面包 dest asar mtime | `2026-09-12 11:38:53 +08`（未变） |

---

## 未关行

| 行 | 状态 |
|:---|:-----|
| D390 | **仍 planned**（§5 未齐；A 红，不得关） |
| D391 | **仍 planned**（src 已改；可见性修复保留；mangler implicit-public 已消；gulp 未 0） |
| D392 | **仍 planned**（8192 / env / 直接 CLI 16g·32g 均 OOM；CLI heap 已生效仍 ~3 GB） |
| D393 | **未占用** |
| D389 | **仍 planned** / blocked（sysroot） |
| D18 | **仍 open**（原文三平台；本切片不是 closer） |
| D20（两行） | **仍 open**（CS-6 300px 活窗） |
| D12 | **仍 open** |

未写「三平台已验」。未 `git add` dest（dest 不存在）。未 commit。
