---
title: "D388 packaging-p1-asar-machine（无窗 P1 子集）"
type: roadmap
status: closed
phase: packaging
updated: 2026-09-12
summary: "空 .map 已复原；第二次 gulp exit 0；asar 见 grpc-js 与 proto-loader；D388 已闭（未提交）"
---

# D388 packaging-p1-asar-machine

> **父方案：** [packaging-and-release.md](../../plans/packaging-and-release.md) §4.3 / §6 / §8 P1。  
> **P0 证据：** [packaging-p0-evidence.md](../../progress/packaging-p0-evidence.md)（仓内 require 绿；production 图含 `@grpc/grpc-js` + `@grpc/proto-loader`；无 `.node`）。  
> **延期行：** [deferred-gaps D388](../../progress/deferred-gaps.md)（`closed`；第二次 gulp 绿；首次红记录保留）。  
> **冲突域：** `packaging / gulp-desktop`。  
> **本切片状态：** 空 `.map` 已从兄弟扩展复原（gitignored，未 `git add`）；第二次冻结 gulp **exit 0**。dest 为本包装树本次产物。asar 见 `@grpc/grpc-js` 与 `@grpc/proto-loader` 的 `package.json`。证据：[d388-packaging-p1-asar-evidence](../../progress/d388-packaging-p1-asar-evidence.md)。未改 gulp / `.moduleignore`。  
> **Architecture-First：** 审查 verdict = Approve with changes（dest 独占锁已并入）。**不自宣裸 Approve**。不再开放「待审」。

## 1. 范围

**覆盖（无窗机器子集）：**

1. `npm run gulp vscode-linux-x64` 退出 0。
2. 仓外产物根存在可执行文件 `universe-agent-studio`（名来自 `product.json` `applicationName`，不是 `nameShort`；对象是产物根，不是 `bin/` 包装脚本）。
3. `npx asar list` 见到 `@grpc/grpc-js` **与** `@grpc/proto-loader`（P0 生产图已列后者）。
4. `remote/package.json` 与 `remote/web/package.json` **无** grpc。

旁注：dest 独占锁（§2 / §3.3 / §4）是实施不变量，**不是**新覆盖。

**不覆盖（仍归父方案 / 原 D 行）：**

- 产物启动、隔离 profile、Settings 300px、Dial / `connect` / 引擎握手（§5 / D20 **两行**，见 §8）。
- D18 原文三平台安装包、prepare-deb/rpm、成包、hicolor 进树/进包。
- D12 产品身份总行、I6。
- 开发态 `launch.sh` / `code.sh` 根因（§5.3 第 2 条）。
- 打 `vscode-web` / `vscode-reh-*` 全量产物（§6 下限=两份依赖根静态检查）。

## 2. 代码基线（本工位只读）

| 项 | 事实 | 出处 |
|:---|:-----|:-----|
| gulp 任务名 | `BUILD_TARGETS` 含 `{ platform:'linux', arch:'x64' }` → **`vscode-linux-x64`**（另有 `-ci`） | `build/gulpfile.vscode.ts` L701–731、L747 |
| 产物目录 | `buildRoot = dirname(repo)` + `VSCode-linux-x64` | 同文件 L699、L718；`packageTask` dest = `path.dirname(root)/destinationFolderName` |
| 二进制名 | `product.applicationName` = **`universe-agent-studio`**；`nameShort` = `UniverseAgentStudio`（窗口名，**不是** Linux 可执行文件名） | `product.json`；`build/lib/electron.ts` `linuxExecutableName`；gulp Linux 另写 `bin/universe-agent-studio` |
| asar | `createAsar(..., 'node_modules.asar')`；unpack 含 `**/*.node`；**无** `@grpc` 专条 | `build/gulpfile.vscode.ts` L402–442 |
| `.moduleignore` | **无** `@grpc` / `proto-loader` 专条 | `build/.moduleignore` |
| 仓内 asar CLI | 根 `package.json` **devDependency `asar`** `^3.0.3`（不是 `@electron/asar`） | 与父方案 §4.3 一致 |
| 生产 import | 三处 `import type * as grpc from '@grpc/grpc-js'`；运行时 **`await import('@grpc/grpc-js')`**（`loadGrpcModule`） | `universeAgentChannel.ts` L6 / L26–28；`grpcClient.ts` / `grpcClientCalls.ts` 仅 type |
| P0 | 仓内 `require` 绿；`npm ls --omit=dev` 有 `@grpc/grpc-js@1.14.4`；parseable 含 proto-loader、protobufjs；`find` **无** `.node` | [packaging-p0-evidence](../../progress/packaging-p0-evidence.md) |
| 排除根 | `remote/package.json`、`remote/web/package.json` 当前 **无** `grpc` 字样 | 本工位 `rg` |
| §4.3 | **从未跑** `gulp vscode-linux-x64` | 同上证据「未做（P1+）」 |

**仓外桌面包 dest（公式与 gulp 一致）：** `PRODUCT="$(dirname "$REPO")/VSCode-linux-x64"`。产物不进 git。

| 仓根 `$REPO` | `$PRODUCT` | 说明 |
|:-------------|:-----------|:-----|
| `/home/clarence/Projects/Agents/vscode`（主仓） | `/home/clarence/Projects/Agents/VSCode-linux-x64` | 与 WT 池 **不撞** |
| `/home/clarence/Projects/Agents/vscode-WorkTrees/A` | `/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64` | 字母槽；dirname 与下两行相同 |
| `/home/clarence/Projects/Agents/vscode-WorkTrees/B` … `J` | **同上** | 字母槽；与 A / merge **同行 dest** |
| `/home/clarence/Projects/Agents/vscode-WorkTrees/merge` | **同上** | merge 槽；与字母槽 **同行 dest** |

**dest 锁：** WT 池内桌面包 dest **只有一份**（上列 `vscode-WorkTrees/VSCode-linux-x64`）。gulp 打包前会 `rimraf` 该目录。A–J 与 merge 的 `dirname` 相同，并行第二工位打同一 dest 会互删产物。主仓 dest 与 WT 池 dest 不同，不互撞。禁止只对比 A vs 主仓就当「不撞」。

## 3. Architecture-First（Approve with changes 已并入 dest 锁；实施已跑）

### 3.1 Problem class

| | |
|:--|:--|
| **症状** | P0 已证开发态与 production 图含 grpc，但 §4.3 产物 asar **从未扫过**。父方案 P1 把 gulp/asar 与「产物启动 + 300px + 关 D20/D18」绑在同一切片。 |
| **问题类** | **验收契约过宽 / 机器断言与活窗未拆分**。 |
| **复发机制** | 下一实施者把「P1」读成启动产品或关 D18/D20；或未证实缺包就改 `.moduleignore`；或字母槽与 merge 并行 gulp 互删同一 dest。HEAD 已把 grpc 改成 Dial 路径 `import()`：即使将来窗起来，也**不再**等于 asar 里有包（父方案 §5.2「启动成功即强证据」对 HEAD 已弱）。 |
| **防复发** | 单独冻结无窗命令、产物路径、dest 独占锁、asar 断言、排除面与禁令；D18/D20（两行）/D12 原行保持 open。 |

### 3.2 Options

| 选项 | 内容 | 裁定 |
|:-----|:-----|:-----|
| **A** | 本 tick 做完父方案 P1 全套（gulp + 启动 + 300px + 关 D20/D18） | **Reject**：本 tick 禁止启动/300px/Dial/关原行；gulp 属 merge 长任务 |
| **B** | 只改父方案正文、不建 active 切片 | **Reject**：Loop 任务源是 `dev/roadmap/active/`；无 checkbox 则下次又并回活窗 |
| **C** | 无窗机器子集 = 本切片 + D388 `planned` 合同 | **选定** |
| **D** | 先改 gulp / `.moduleignore` / 发明 proto，再谈 asar | **Reject**：P0 图已有包；父方案 §4「未完成 4.3 禁止改清单」 |

不需要新 ADR：不改打包机制、不改 UA 协议、不把 gRPC 迁出 electron-main。

### 3.3 选定设计与不变量

**选定 C。** 不变量：

1. 本切片完成线 = 四条机器断言（§4），**不含**窗、Dial、安装包。
2. 缺包才允许改 `gulpfile.vscode.ts` / `.moduleignore*`；改完必须重跑 gulp + 复扫。未缺包而改清单 = 越权。
3. D18 / D20（[deferred-gaps](../../progress/deferred-gaps.md) **两行**，均为 CS-6 Settings 300px 活窗目视）/ D12 **不得**随本切片闭合。
4. native `.node`：P0 为 N/A；禁止为不存在的 addon 改 unpack。
5. WT 池内桌面包 dest **只有一份**：`/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64`。
6. 同一时刻 **只允许一个工位**打 `vscode-linux-x64`（实施选 merge 槽；字母槽禁止并行再打同一 dest）。
7. 证据 SHA **必须等于打包装树的 HEAD**；禁止拿别的槽留下的目录勾 checkbox。
8. 勾 `$PRODUCT` 存在之前，须确认该目录是**本包装树本次 gulp** 的产物，不是别人残留。

## 4. 冻结命令（实施时原样跑）

**dest 独占（实施前必读）：**

- WT 池 dest 只有一份：`/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64`。gulp 会 `rimraf` 该目录。
- 实施选 **merge 槽**。字母槽禁止与 merge（或彼此）并行再打同一 dest。
- 证据 SHA **必须等于打包装树的 HEAD**；禁止拿别的槽留下的目录勾 checkbox。
- 勾 `$PRODUCT` 存在之前：确认该目录是**本包装树本次 gulp** 的产物（本次 gulp 刚写完、mtime/日志对得上），不是别人残留。

在**已有 `node_modules`、P0 仍绿**的工位（**仅 merge 槽**；首次全量耗时长属预期）：

```bash
# A. 桌面包（任务名已在 gulpfile 核实）
npm run gulp vscode-linux-x64
# 验收：exit 0

# B. 仓外产物 + 二进制名（验收对象是产物根，不是 bin/ 包装脚本）
REPO="$(pwd)"
PRODUCT="$(dirname "$REPO")/VSCode-linux-x64"
test -x "$PRODUCT/universe-agent-studio"
test -f "$PRODUCT/resources/app/node_modules.asar"
# 验收：两处 test 成功。二进制名必须是产物根 universe-agent-studio。
# test -e 只证存在；本条用 test -x 验根可执行文件。
# bin/universe-agent-studio 是 gulp Linux 另写的包装脚本，不是同一条验收。

# C. asar 进包（devDependency asar，不是 @electron/asar）
npx asar list "$PRODUCT/resources/app/node_modules.asar" | rg '@grpc/grpc-js'
npx asar list "$PRODUCT/resources/app/node_modules.asar" | rg '@grpc/proto-loader'
# 验收：两行均有命中（路径可能带或不带 node_modules/ 前缀，以 list 原文含包名即可）。
# 证据优先记 …/package.json 命中行（父方案 §4.3：
#   node_modules/@grpc/grpc-js/package.json
#   node_modules/@grpc/proto-loader/package.json）
# 防空目录 / 许可文件假绿。list 含包名仍可过本切片 checkbox。
# protobufjs 在 P0 图内；本切片不强制 list，可选补记。
# P0 无 .node → 不要求 node_modules.asar.unpacked 下存在 grpc native。

# D. 排除面下限（不打 vscode-web / reh）
rg -n 'grpc' remote/package.json remote/web/package.json
# 验收：无匹配。
```

**缺包才允许改（实施后期，且仅当 C 未命中）：** 对照 P0/`npm ls --omit=dev` 后改 `packageTask` 的 `dependenciesSrc` / `createAsar` unpack，或核对 `.moduleignore*` 是否误剥 `@grpc/**`。改完重跑 A–C。禁止无证据抄 `ensureCopilotPlatformPackage`。

证据写入新建 `dev/progress/` 目录即可（命令、exit、asar 优先 `…/package.json` 命中行、`$PRODUCT`、打包装树 HEAD SHA）。**不提交** `VSCode-linux-x64`。

## 5. Checkbox（实施 tick 才勾）

- [x] `npm run gulp vscode-linux-x64` exit 0 — 第二次 exit 0（`Finished 'vscode-linux-x64' after 2.83 min`）；首次 exit 1 记录保留
- [x] `$PRODUCT/universe-agent-studio` 产物根可执行（`test -x`；不是 `bin/` 包装脚本；`PRODUCT="$(dirname "$REPO")/VSCode-linux-x64"`）
- [x] dest 独占 + SHA=包装树 HEAD：仅 merge 槽本次 gulp；证据 SHA = `3b4cc89f6e53f14935d8396e7061c11fc74907df`；`$PRODUCT` 经确认为本包装树第二次 gulp 产物（gulp 前 dest 不存在；asar mtime 对齐 `package-linux-x64`）
- [x] `npx asar list` 见 `@grpc/grpc-js`（证据优先记 `…/package.json` 命中行）— `/@grpc/grpc-js/package.json`
- [x] `npx asar list` 见 `@grpc/proto-loader`（证据优先记 `…/package.json` 命中行）— `/@grpc/proto-loader/package.json`
- [x] `remote/package.json` + `remote/web/package.json` 无 grpc
- [x] 证据目录已记命令 / 路径 / 打包装树 HEAD SHA；未提交产物
- [x] **仅当 asar 缺包：** 已改 gulp / `.moduleignore*` 并重跑 A–C（未缺则本条 N/A，不得改）— **N/A**（asar 未缺包；未改 gulp / `.moduleignore`）

同质断言已合成上列 batch，不拆并行槽。

## 6. 禁令（实施 tick 仍有效）

| 禁止 | 理由 |
|:-----|:-----|
| 启动产物 / `launch.sh` / 活窗 / Settings 300px / Dial | 本子集无窗；D20 两行仍开 |
| 关闭 D18 / D20（两行，均为 CS-6 Settings 300px 活窗目视）/ D12 | 原退出条件未满足；本切片不关活窗行 |
| 字母槽或第二工位并行 `gulp vscode-linux-x64`（同 dest） | WT 池 dest 只有一份；gulp 会 rimraf，互删产物 |
| 拿别的槽留下的 `$PRODUCT` 勾 checkbox / 证据 SHA ≠ 打包装树 HEAD | 假绿 |
| 未证实缺包就改 `.moduleignore` / `gulpfile` / `src/` | 父方案 §4 顺序锁 |
| leftover-looks-live 再切片、发明 proto、D8/D147、D16 切片 1、D26 引擎仓、F3/F4/A2/U2 | 父约束 |
| Sessions New chrome、Hub pairing、pending-chip CSS、WriteGitUnstage | 父约束 |
| 改 `dev/loop/**`、本切片 commit、为本切片跑 `compile-client` | 父约束 |

## 7. 退出条件

**方案：** dest 独占锁已并入。

**实施：** 空 `.map` 已复原；第二次冻结 gulp exit 0；§5（缺包条 N/A）已齐。D388 可闭。仍不得关 D18/D20（两行）/D12。未提交。

## 8. 开放项

- 审查 verdict = Approve with changes；dest 独占锁已并入。第二次实施 gulp **exit 0**；首次 exit 1 记录保留。不再开放「待审」。不自宣裸 Approve。
- asar 断言：证据优先记 `…/package.json` 命中行（父方案 §4.3）；list 含包名仍可过 checkbox，但防空目录/许可文件假绿。
- `protobufjs` 在 P0 生产图内；本切片不强制 `asar list`，实施时可可选补记。
- `$PRODUCT/universe-agent-studio` 验收对象是产物根二进制（`test -x`）；`bin/universe-agent-studio` 包装脚本不是同一条。
- 「不关 D20」对着 [deferred-gaps](../../progress/deferred-gaps.md) **两行** D20（均 open、均 **CS-6 Settings 默认窗 300px 目视**）：较早行（「本轮禁止 electron / playwright」的 300px 目视）与较后行（`uaClientSettingsChrome.css` 已保证 narrow-width；隔离 launch 因缺 `@grpc/grpc-js` 未能开窗）。不是 asar/gulp 行。两行都不关。
- dest 路径见 §2；禁止只对比 A vs 主仓就当「不撞」。
