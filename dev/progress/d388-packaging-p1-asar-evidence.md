---
title: "D388 packaging-p1-asar-machine 无窗断言证据"
type: progress
status: in_progress
phase: packaging
updated: 2026-09-12
summary: "空 .map 已从兄弟扩展复原；第二次 gulp exit 0；asar 见 grpc-js 与 proto-loader package.json；首次 gulp 红记录保留"
---

# D388 无窗 P1 机器断言证据

> **切片：** [d388-packaging-p1-asar-machine](../roadmap/active/d388-packaging-p1-asar-machine.md)  
> **包装树：** `/home/clarence/Projects/Agents/vscode-WorkTrees/merge`  
> **HEAD SHA：** `3b4cc89f6e53f14935d8396e7061c11fc74907df`（`git rev-parse HEAD`；未 commit）  
> **dest 锁：** 仅本槽跑 `gulp vscode-linux-x64`；WT 池 dest = `/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64`  
> **裁定：** **第二次 gulp 绿（exit 0）。** dest 为本包装树本次 gulp 写出（gulp 前 dest 不存在）。未改 gulp / `.moduleignore`。未关 D18 / D20（两行）/ D12。未启动产物。首次 gulp 红记录见下「第一次 gulp（保留）」。

## Current facts

| 项 | 结论 |
|:---|:-----|
| 包装树 HEAD | `3b4cc89f6e53f14935d8396e7061c11fc74907df` |
| `node_modules` | **存在** |
| P0 `require('@grpc/grpc-js')` | **成功**（`…/merge/node_modules/@grpc/grpc-js/build/src/index.js`） |
| `@grpc` / `protobufjs` 下 `.node` | **无** |
| 空 `.map` 修复 | **已复原**（见下）；gitignored，未 `git add` |
| 第一次 `npm run gulp vscode-linux-x64` | **exit 1**（2026-09-12T11:30:27 → 11:33:01 +08）；dest 未写出 |
| 第二次 `npm run gulp vscode-linux-x64` | **exit 0**（2026-09-12T11:36:10 → 11:39:01 +08） |
| `$PRODUCT` | **存在**；为本包装树第二次 gulp 写出（gulp 前 dest 不存在；asar mtime `2026-09-12 11:38:53 +08` 对齐 `Finished package-linux-x64`） |
| asar list `@grpc/grpc-js` | **命中** `/@grpc/grpc-js/package.json` |
| asar list `@grpc/proto-loader` | **命中** `/@grpc/proto-loader/package.json` |
| `rg grpc` remote 两份 `package.json` | **无匹配**（`rg` exit 1） |
| gulp / `.moduleignore` | **未改**（asar 未缺包；缺包条 N/A） |

---

## P0 仍绿（未重跑全套）

```bash
test -d node_modules
node -e "require('@grpc/grpc-js'); console.log('ok', require.resolve('@grpc/grpc-js'))"
find node_modules/@grpc node_modules/protobufjs -name '*.node' 2>/dev/null
```

```
node_modules: EXISTS
ok /home/clarence/Projects/Agents/vscode-WorkTrees/merge/node_modules/@grpc/grpc-js/build/src/index.js
（find 无输出）
```

---

## 空 `.map` 修复（本地 `node_modules`，未入 git）

**不是** asar-missing-package 事件。未改 gulp / `.moduleignore` / `src/`。

路径：`extensions/microsoft-authentication/node_modules/@microsoft/applicationinsights-core-js/dist-es5/JavaScriptSDK/AsyncUtils.js.map`

| 时刻 | 字节 | md5 |
|:-----|:-----|:----|
| 修复前 | **0**（mtime `2026-08-31 09:34`） | （空文件） |
| 同源兄弟（`extensions/git/` 等同路径） | 2529 | `5ff9b5a2978aecc18e5268216173315a` |
| 修复后（从 `extensions/git/` 同包副本 `cp`） | **2529**（mtime `2026-09-12 11:36`） | `5ff9b5a2978aecc18e5268216173315a` |

`git check-ignore`：`.gitignore:6:node_modules`。未 `git add`。

同包另两处兄弟（`github-authentication/`、`simple-browser/`）同为 2529 字节、同一 md5。

---

## A. `npm run gulp vscode-linux-x64`

### 第一次 gulp（保留；exit 1）

```bash
npm run gulp vscode-linux-x64
```

| 字段 | 值 |
|:-----|:---|
| 开始 | `2026-09-12T11:30:27+08:00` |
| 结束 | `2026-09-12T11:33:01+08:00` |
| exit | **1** |
| 任务 | `'vscode-linux-x64' errored after 2.53 min` |
| 失败步 | `compile-native-extensions-build` → `extensions/microsoft-authentication/esbuild.mts` |

**日志尾（原文）：**

```
[11:33:01] Finished esbuild-bundle-linux-x64 after 59140 ms
[11:33:01] Starting compile-native-extensions-build ...
[11:33:01] Finished typechecking extension (tsgo) /home/clarence/Projects/Agents/vscode-WorkTrees/merge/extensions/git/tsconfig.json with 0 errors.
[11:33:01] Finished typechecking extension (tsgo) /home/clarence/Projects/Agents/vscode-WorkTrees/merge/extensions/microsoft-authentication/tsconfig.json with 0 errors.
[11:33:01] Bundled extension: git/esbuild.mts with 0 errors.
/home/clarence/Projects/Agents/vscode-WorkTrees/merge/extensions/microsoft-authentication
[]
[11:33:01] 'vscode-linux-x64' errored after 2.53 min
[11:33:01] Error: Command failed: /home/clarence/.hermes/node/bin/node /home/clarence/Projects/Agents/vscode-WorkTrees/merge/extensions/microsoft-authentication/esbuild.mts
✘ [ERROR] Unexpected end of file in source map

    node_modules/@microsoft/applicationinsights-core-js/dist-es5/JavaScriptSDK/AsyncUtils.js.map:1:0:
      1 │
        ╵ ^

  The source map "node_modules/@microsoft/applicationinsights-core-js/dist-es5/JavaScriptSDK/AsyncUtils.js.map" was referenced by the file "node_modules/@microsoft/applicationinsights-core-js/dist-es5/JavaScriptSDK/AsyncUtils.js" here:

    node_modules/@microsoft/applicationinsights-core-js/dist-es5/JavaScriptSDK/AsyncUtils.js:49:21:
      49 │ //# sourceMappingURL=AsyncUtils.js.map
         ╵                      ~~~~~~~~~~~~~~~~~
```

**根因（本工位）：** 该 `.map` **0 字节**（mtime `2026-08-31`）。同包共 14 个 `.map`，空文件仅此一份。路径：

`extensions/microsoft-authentication/node_modules/@microsoft/applicationinsights-core-js/dist-es5/JavaScriptSDK/AsyncUtils.js.map`

完整 gulp 日志（仓外，不入 git）：`/tmp/d388-gulp-vscode-linux-x64.log`

旁注：`esbuild-bundle-linux-x64` 对 `ua-common.css` 报过 css-syntax-error **WARNING**（未作为本次 exit 原因）。

### 第二次 gulp（修复后；exit 0）

```bash
npm run gulp vscode-linux-x64
```

| 字段 | 值 |
|:-----|:---|
| 开始 | `2026-09-12T11:36:10+08:00` |
| 结束 | `2026-09-12T11:39:01+08:00` |
| exit | **0** |
| 任务 | `Finished 'vscode-linux-x64' after 2.83 min` |
| 过原失败步 | `Bundled extension: microsoft-authentication/esbuild.mts with 0 errors.` → `Finished compile-native-extensions-build after 397 ms` |

**日志尾（原文）：**

```
[11:38:29] Bundled extension: microsoft-authentication/esbuild.mts with 0 errors.
[11:38:29] Bundled extension: git/esbuild.mts with 0 errors.
[11:38:29] Finished compile-native-extensions-build after 397 ms
[11:38:29] Starting clean-vscode-linux-x64 ...
[11:38:29] Finished clean-vscode-linux-x64 after 0 ms
[11:38:29] Starting package-linux-x64 ...
[11:38:53] Finished package-linux-x64 after 24300 ms
[11:38:53] Starting vscode-linux-x64-ci ...
[11:39:01] Finished vscode-linux-x64-ci after 7600 ms
[11:39:01] Starting vscode-linux-x64 ...
[11:39:01] Finished vscode-linux-x64 after 0 ms
[11:39:01] Finished 'vscode-linux-x64' after 2.83 min
GULP_EXIT=0
```

完整第二次 gulp 日志（仓外，不入 git）：`/tmp/d388-gulp-vscode-linux-x64-2.log`

旁注：第二次仍对 `ua-common.css` 报 css-syntax-error **WARNING**（未导致 exit 非 0）。

---

## B. dest / 根二进制

```bash
REPO="$(pwd)"
PRODUCT="$(dirname "$REPO")/VSCode-linux-x64"
# 期望：/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64
test -x "$PRODUCT/universe-agent-studio"
test -f "$PRODUCT/resources/app/node_modules.asar"
```

第二次 gulp **前** dest 不存在（第一次失败未写出）。第二次 gulp **后**：

```
BINARY_X=OK
ASAR_FILE=OK
```

| 项 | 值 |
|:---|:---|
| `$PRODUCT` | `/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64` |
| dest 目录 mtime | `2026-09-12 11:38:47 +08` |
| `node_modules.asar` mtime | `2026-09-12 11:38:53 +08`（对齐 `Finished package-linux-x64`） |
| 根二进制 | `universe-agent-studio`：`test -x` 成功；ELF 64-bit x86-64；`applicationName=universe-agent-studio` |
| 非验收对象 | `bin/universe-agent-studio` 包装脚本（未当本条） |

**确认为本包装树本次产物：** gulp 前 dest 不存在；asar / dest mtime 落在第二次 gulp `package-linux-x64` 窗口内；`vscode-linux-x64-ci` 写入 `…/VSCode-linux-x64/resources/app/extensions/copilot`。不是残留。

---

## C. asar

```bash
npx asar list "$PRODUCT/resources/app/node_modules.asar" | rg '@grpc/grpc-js'
npx asar list "$PRODUCT/resources/app/node_modules.asar" | rg '@grpc/proto-loader'
```

**优先 `…/package.json` 命中行：**

```
/@grpc/grpc-js/package.json
/@grpc/proto-loader/package.json
```

可选补记：`/protobufjs/package.json` 亦命中。P0 无 `.node` → 未要求 `node_modules.asar.unpacked` 下 grpc native。

---

## D. 排除面下限

```bash
rg -n 'grpc' remote/package.json remote/web/package.json
```

```
（无输出）
rg_exit=1
```

---

## 未做 / 禁令

- 未启动产物 / 未 300px / 未 Dial
- 未关 D18 / D20（两行）/ D12
- 未改 `gulpfile` / `.moduleignore*`
- 未 `compile-client` / 未 commit / 未 `git add -A` / 未 `git add` `node_modules`
- 未宣称 leftover-honesty 完成
- 未把 `VSCode-linux-x64` 加入 git
