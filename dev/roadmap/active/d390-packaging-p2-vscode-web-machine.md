---
title: "D390 packaging-p2-vscode-web-machine（无窗 vscode-web 排除面）"
type: roadmap
status: active
phase: packaging
updated: 2026-09-12
summary: "实施 blocked：D391 后 mangler 过；8192/env/直接 CLI 16g·32g 仍 OOM exit 134；dest 未写；不关 D389/D18/D20/D12"
---

# D390 packaging-p2-vscode-web-machine

> **父方案：** [packaging-and-release.md](../../plans/packaging-and-release.md) §3.4 / §6 / §8 P2 / §9.5。  
> **P1 证据：** [d388-packaging-p1-asar-evidence](../../progress/d388-packaging-p1-asar-evidence.md)（桌面包 dest **仍活** → **禁止**再 gulp `vscode-linux-x64`）。  
> **P3 阻断：** [D389](d389-packaging-p3-linux-deb-machine.md) 仍 `planned` / 实施 blocked（`prepare-deb` 三次 GitHub sysroot `TimeoutError`）。**不得**把第四次 prepare-deb / sysroot 镜像折进本切片。  
> **延期行：** [deferred-gaps D390](../../progress/deferred-gaps.md)（`planned`；实施 blocked：compile-src 后 OOM）。  
> **冲突域：** `packaging / gulp-vscode-web`（WT 池 dest = `vscode-web`，**≠** D388/D389 的 `VSCode-linux-x64`）。  
> **本切片状态：** 实施 **blocked**（§4 A 首败 **exit 1** mangler；D391 后 8192 / env / 直接 CLI 16g·32g 均 **exit 134**；dest **未写出**）。§5 未齐，**不得**关 D390 / D391 / D392 / D389 / D18 / D20（两行）/ D12。D393 **未占用**。证据：[d390-packaging-p2-vscode-web-evidence](../../progress/d390-packaging-p2-vscode-web-evidence.md) §A4。  
> **Architecture-First：** 正文含问题类 / 选项 / 选定。**无新 ADR。主笔不自宣 Approve。**

## 1. 范围

**覆盖（无窗排除面加分项；不是 D18 closer）：**

1. `npm run gulp vscode-web` 退出 0。任务名已在 `build/gulpfile.vscode.web.ts` 核实（另有 `vscode-web-min` / `*-ci`；本切片**只**冻 `vscode-web`）。
2. dest = `$(dirname "$REPO")/vscode-web`。从 merge / 字母槽：`/home/clarence/Projects/Agents/vscode-WorkTrees/vscode-web`。
3. WT 池 dest **只有一份**；gulp 打包前 `rimraf` 该目录；实施选 **merge**；字母槽禁止并行再打同一 dest。
4. 产物树 **无** `@grpc/grpc-js`（`rg` / `test`；依赖根 = `remote/web`；**无 asar**）。
5. **禁止**再跑 `vscode-linux-x64` 或 `prepare-deb`。

旁注：dest 独占锁是实施不变量，**不是**新覆盖。父方案 §6：产物扫描是 **§1.3 排除清单的加分项**，不是本稿门槛，也**不够**当 D18（Linux 子集）完成。

**不覆盖（仍归父方案 / 原 D 行）：**

- 第四次 `prepare-deb`、sysroot timeout / 镜像 / 代理、改 `install-sysroot.ts`。
- D20 活窗、Settings 300px、Dial / `connect` / 引擎握手。
- leftover-looks-live 再扫、发明 proto。
- 关闭 D18 **原文** / D20 **两行** / D12 / **D389**。
- `vscode-web-min`、`vscode-reh-*` 全量产物、打桌面包、hicolor / `.deb`。
- 启动 `scripts/code-web.sh` / 开发态 Web 冒烟（D15 已闭，不重开）。

## 2. 代码基线（本工位只读；已对 gulpfile 核实）

**Discovery 路径裁定：** 命名 dest `$(dirname "$REPO")/vscode-web` → merge/A 落 `/home/clarence/Projects/Agents/vscode-WorkTrees/vscode-web`。与 `BUILD_ROOT = dirname(REPO_ROOT)` + `destinationFolderName = 'vscode-web'` **一致，不改**。

| 项 | 事实 | 出处 |
|:---|:-----|:-----|
| gulp 任务名 | `vscode-web` = `compileBuildWithManglingTask` + `vscode-web-ci`。另有 `vscode-web-min` / `vscode-web-ci` / `vscode-web-min-ci` | `build/gulpfile.vscode.web.ts` L241–254 |
| dest 公式 | `BUILD_ROOT = dirname(REPO_ROOT)`；`destination = path.join(BUILD_ROOT, 'vscode-web')` | 同文件 L24–25、L178、L239 |
| rimraf | `vscode-web-ci` 在 `packageTask` **前** `util.rimraf(path.join(BUILD_ROOT, destinationFolderName))` | L245–246 |
| **min 同 dest** | `['', 'min']` 循环里 `destinationFolderName` **恒为** `vscode-web`（不是 `vscode-web-min`）。并行 `vscode-web-min` 会 rimraf **同一** dest | L237–246 |
| 无 asar | `packageTask` 直接 `vfs.dest(destination)`；**无** `createAsar` | L177–224 |
| 依赖根 | `WEB_FOLDER = remote/web`；`getProductionDependencies(WEB_FOLDER)`；`package.json` 流自 `remote/web/package.json`（改 `name`/`version`/`type`） | L26、L190–200 |
| `.webignore` | `cleanNodeModules(.../.webignore)`；**无** `@grpc` 专条 | L200；本工位 `rg` |
| 排除源 | `remote/web/package.json`、`remote/package.json` **无** `grpc` 字样 | 本工位 `rg` |
| Web UA | `workbench.web.main.ts` 装配 `platform/universeAgent/browser/*`（browser stub），**不是** electron-main `grpcClient` | L76–78；父方案 §3.4 |
| 桌面包 dest | WT 池 `VSCode-linux-x64` **仍活**（D388 写出；D389 身份锁绿）。本切片 dest **另一份目录** | [D388 证据](../../progress/d388-packaging-p1-asar-evidence.md)；本工位 `ls`：`vscode-web` **不存在** |
| §6 / §9.5 | 依赖根静态检查 = 排除面下限（D388 已扫 remote 两份）；**产物扫描是加分项**，不是 D18 closer | 父方案 §6、§9.5 |

**仓外 vscode-web dest（公式与 gulp 一致）：** `PRODUCT="$(dirname "$REPO")/vscode-web"`。产物不进 git。

| 仓根 `$REPO` | `$PRODUCT` | 说明 |
|:-------------|:-----------|:-----|
| `/home/clarence/Projects/Agents/vscode`（主仓） | `/home/clarence/Projects/Agents/vscode-web` | 与 WT 池 **不撞** |
| `/home/clarence/Projects/Agents/vscode-WorkTrees/A` | `/home/clarence/Projects/Agents/vscode-WorkTrees/vscode-web` | 字母槽；dirname 与下两行相同 |
| `/home/clarence/Projects/Agents/vscode-WorkTrees/B` … `J` | **同上** | 字母槽；与 A / merge **同行 dest** |
| `/home/clarence/Projects/Agents/vscode-WorkTrees/merge` | **同上** | merge 槽；与字母槽 **同行 dest** |

**dest 锁：** WT 池内 vscode-web dest **只有一份**。gulp 打包前会 `rimraf` 该目录。A–J 与 merge 的 `dirname` 相同，并行第二工位（含 `vscode-web-min`）打同一 dest 会互删产物。主仓 dest 与 WT 池 dest 不同，不互撞。禁止只对比 A vs 主仓就当「不撞」。

**与 D388 dest 不互删：** `vscode-web` ≠ `VSCode-linux-x64`。本切片 gulp **不会** rimraf 桌面包 dest。仍 **禁止**再跑 `vscode-linux-x64` / `prepare-deb`（保住 D388 产物与 D389 合同；不折回 P3）。

## 3. Architecture-First（主笔草案；待独立审查；不自宣 Approve）

### 3.1 Problem class

| | |
|:--|:--|
| **症状** | 父方案 P2 把「两份 `package.json` 静态下限」与「可选 `vscode-web` 产物扫描」写在同一切片；§6 写明产物扫描是加分项、**不是** D18 closer。D389 被 GitHub sysroot 环境阻断。无独立合同则下一实施者会：闲等、第四次 prepare-deb、发明 sysroot 镜像、或把 Web 包当成 D18/D20 closer。 |
| **问题类** | **验收契约过宽 / P2 加分项与 D18 closer 未拆分**（与 D388「机器 vs 活窗」、D389「机器 vs 三平台」同类）。环境阻断下缺一条可执行、无窗的排除面合同。 |
| **复发机制** | 把「P2」读成关 D18/D20；或把空残留 dest 的「扫不到 grpc」当绿；或字母槽与 merge 并行 gulp 互删同一 `vscode-web` dest；或再跑 `vscode-linux-x64` 毁掉 D388 dest；或把 prepare-deb / sysroot 折进本切片。 |
| **防复发** | 单独冻结无窗 `vscode-web` 命令、产物路径、dest 独占锁、无 asar 树扫描、与桌面包 dest 隔离、以及禁令；D389/D18/D20（两行）/D12 原行保持 open / planned。 |

### 3.2 Options

| 选项 | 内容 | 裁定 |
|:-----|:-----|:-----|
| **A** | 本 tick 重试 P3（第四次 prepare-deb）或发明 GitHub sysroot 镜像 / 改 `install-sysroot.ts` | **Reject**：D389 三次同 URL `TimeoutError`；本 tick 禁止折回 prepare-deb / 无 GitHub sysroot |
| **B** | 只改父方案正文、不建 active 切片 | **Reject**：Loop 任务源是 `dev/roadmap/active/`；无 checkbox 则下次又并回 D18 closer / 活窗 / prepare-deb |
| **C** | 无窗 `vscode-web` 排除面扫描 = 本切片 + D390 `planned` 合同 | **选定** |
| **D** | D389 未解封则本 tick 闲等 | **Reject**：P2 可与 P3 在 dest 层并行（dest 不同）；环境阻断时仍须有可执行机器合同 |
| **E** | 把 vscode-web 产物扫描当成 D18 closer，或顺带关 D20/D12 | **Reject**：父方案 §6 / §9.5：产物扫描不够当 D18；D20 是活窗 300px；D12 是产品身份总行 |

不需要新 ADR：不改打包机制、不改 UA 协议、不把 gRPC 加进 Web / REH。

### 3.3 选定设计与不变量

**选定 C。** 不变量：

1. 本切片完成线 = §1 五条机器断言，**不含**窗、Dial、deb、三平台、D18 closer。
2. 产物树断言用 `rg` / `test` 扫 dest 目录；**禁止** `asar list`（本任务无 asar）。依赖来自 `remote/web`，不是仓根 `package.json`。
3. D18 / D20（[deferred-gaps](../../progress/deferred-gaps.md) **两行**）/ D12 / **D389** **不得**随本切片闭合。
4. WT 池 vscode-web dest **只有一份**：`/home/clarence/Projects/Agents/vscode-WorkTrees/vscode-web`。
5. 同一时刻 **只允许一个工位**打 `vscode-web`（实施选 merge；字母槽禁止并行）。禁止并行 `vscode-web-min`（同 dest）。
6. **禁止** `npm run gulp vscode-linux-x64` 与 `vscode-linux-x64-prepare-deb`（第四次亦不做）。
7. 证据 SHA **必须等于打包装树的 HEAD**；禁止拿别的槽留下的目录勾 checkbox。
8. 勾 `$PRODUCT` 存在之前，须确认该目录是**本包装树本次 gulp** 的产物（gulp 会先 rimraf；空目录 / 他槽残留「扫不到 grpc」= 假绿）。
9. 主笔 **不自宣** Architecture-First Approve。

## 4. 冻结命令（实施已原样跑 A；A 红后停）

**dest 独占（实施前必读）：**

- WT 池 dest 只有一份：`/home/clarence/Projects/Agents/vscode-WorkTrees/vscode-web`。gulp 会 `rimraf` 该目录。
- 实施选 **merge 槽**。字母槽禁止与 merge（或彼此）并行再打同一 dest；禁止并行 `vscode-web-min`。
- **禁止** `gulp vscode-linux-x64` / `vscode-linux-x64-prepare-deb`。桌面包 dest 仍活，与本 dest 不是同一目录。
- 证据 SHA **必须等于打包装树的 HEAD**；禁止拿别的槽留下的目录勾 checkbox。
- 勾 `$PRODUCT` 存在之前：确认该目录是**本包装树本次 gulp** 的产物（本次 gulp 刚写完、mtime/日志对得上），不是别人残留或空目录。

在**已有 `node_modules`** 的工位（**仅 merge 槽**；首次全量耗时长属预期）：

```bash
# A. Web 包（任务名已在 gulpfile 核实；不要跑 vscode-web-min）
npm run gulp vscode-web
# 验收：exit 0

# B. 仓外产物身份（无 asar / 无桌面二进制）
REPO="$(pwd)"
PRODUCT="$(dirname "$REPO")/vscode-web"
# 期望：$PRODUCT = /home/clarence/Projects/Agents/vscode-WorkTrees/vscode-web
test -f "$PRODUCT/package.json"
test -d "$PRODUCT/out"
# 验收：两处 test 成功。package.json 来自 remote/web（gulp 改 name/version）。
# 空目录或只剩残留文件不得当身份锁。

# C. 产物树排除面（无 asar；禁止 asar list）
rg -n --fixed-strings '@grpc/grpc-js' "$PRODUCT"
test ! -e "$PRODUCT/node_modules/@grpc/grpc-js"
# 验收：rg 无匹配（exit 1）；test 成功。
# 防空目录假绿：须先过 A+B。优先记命中「无 package.json / 无目录」而不是只记「rg 静默」。

# D. 依赖根源（本切片覆盖 remote/web；remote/package.json 仍是 D388 下限，不打 REH）
rg -n 'grpc' remote/web/package.json
# 验收：无匹配。
```

**缺包才允许改（实施后期，且仅当 C 命中 `@grpc/grpc-js`）：** 对照 `remote/web/package.json` / `getProductionDependencies(remote/web)` 后删回误写入的 grpc，或核对 `.webignore` 是否误留。改完重跑 A–C。禁止为「对称」把 grpc 加进 REH。未命中而改 gulp / `.webignore` = 越权。

证据写入新建 `dev/progress/` 目录即可（命令、exit、`$PRODUCT`、打包装树 HEAD SHA、rg/test 原文）。**不提交** `vscode-web`。

## 5. Checkbox（实施 tick 才勾）

- [ ] `npm run gulp vscode-web` exit 0（不要跑 `vscode-web-min`）— 首败 **exit 1**（mangler；记录保留）；D391 后 8192 / env / 直接 CLI 16g·32g 均 **exit 134**（dest 未写出）
- [ ] `$PRODUCT` 身份：`test -f "$PRODUCT/package.json"` **且** `test -d "$PRODUCT/out"`；`PRODUCT="$(dirname "$REPO")/vscode-web"` — **未跑**（A 红；dest 不存在；缺目录不得当身份）
- [ ] dest 独占 + SHA=包装树 HEAD：仅 merge 槽本次 gulp；`$PRODUCT` 经确认为本包装树本次 gulp 产物（gulp 会先 rimraf；空目录/他槽残留不得勾）— gulp **仅** merge；dest **未写出**，不得勾产物身份
- [ ] 产物树无 `@grpc/grpc-js`（`rg --fixed-strings` 无匹配 **且** `test ! -e "$PRODUCT/node_modules/@grpc/grpc-js"`；**不用** asar）— **未跑**（无 dest；禁止空目录假绿）
- [x] `remote/web/package.json` 无 grpc
- [x] 证据目录已记命令 / 路径 / 打包装树 HEAD SHA；未提交产物 — [d390-packaging-p2-vscode-web-evidence](../../progress/d390-packaging-p2-vscode-web-evidence.md)（首败 + D391 + 8192/env + 直接 CLI 16g/32g）
- [x] **仅当产物树见 grpc：** 已改 `remote/web` 依赖 / `.webignore*` 并重跑 A–C（未见到则本条 N/A，不得改）— **N/A**（dest 未写出，未见产物 grpc；未改 gulp / `.webignore` / `remote/web` / allowlist）
- [x] **N/A / 禁跑：** 未再跑 `vscode-linux-x64`；未再跑 `prepare-deb`（含第四次）

同质断言已合成上列 batch，不拆并行槽。

## 6. 禁令（实施 tick 仍有效）

| 禁止 | 理由 |
|:-----|:-----|
| 第四次 `prepare-deb` / sysroot 镜像 / 改 `install-sysroot.ts` | D389 仍 blocked；不折回 P3 |
| 再跑 `gulp vscode-linux-x64` | 会 `rimraf` WT 池唯一桌面包 dest；D388 产物作废 |
| 启动产物 / 活窗 / Settings 300px / Dial / `code-web.sh` | 本子集无窗；D20 两行仍开 |
| 关闭 D18 原文 / D20（两行，均为 CS-6 300px 活窗目视）/ D12 / D389 | 原退出条件未满足；本切片不是 D18 closer |
| 字母槽或第二工位并行 `gulp vscode-web` / `vscode-web-min`（同 dest） | WT 池 dest 只有一份；gulp 会 rimraf，互删产物 |
| 拿别的槽留下的 `$PRODUCT` 勾 checkbox / 证据 SHA ≠ 打包装树 HEAD / 空目录「无 grpc」 | 假绿 |
| `asar list` 当本切片验收 | Web 包无 asar |
| 未证实产物含 grpc 就改 `.webignore` / gulp / `src/`；为对称把 grpc 加进 REH | 父方案 §4 顺序锁 / §8 P2 禁止条 |
| leftover-looks-live 再切片、发明 proto、D8/D147、D16 切片 1、D26 引擎仓、F3/F4/A2/U2 | 父约束 |
| 改 `dev/loop/**`、本切片 commit、为本切片跑 `compile-client` | 父约束 |
| 自宣 Architecture-First Approve | 主笔只交草案；父 agent 派独立审查 |

## 7. 退出条件

**方案：** dest 独占锁与无 asar 排除面合同已写入 §3.3 / §4 / §5 / §6。**待独立 Arch-First 审查。** 不自宣 Approve。

**实施（本 tick）：** A 首败 **exit 1**（mangler；记录保留）。D391 可见性修复保留。8192 / env 仍 **exit 134**。直接 node CLI 16g / 32g 各一次仍 **exit 134**（heap 旗标已生效；GC ~3 GB）。dest **未写出**。B/C 未跑（不假绿）。§5 未齐 → **不关 D390**。D391 / D392 仍 planned。D393 未占用。仍不得关 D389 / D18 / D20（两行）/ D12。未改 gulp / `.webignore` / allowlist / `package.json`。未跑 `vscode-linux-x64` / `prepare-deb` / `vscode-web-min`。未提交产物。

## 8. 开放项

- 实施 **blocked** 于 A 重跑 OOM（D392）：D391 已消 implicit-public。直接 CLI 16g/32g heap **已生效**仍 exit 134（~3 GB）。只改 `package.json` 8192→16384 会复现已红命令。未见产物 grpc，**不得**改 gulp allowlist / `.webignore` / `package.json`（除非父再授权）。不自宣 Approve / 完成。
- 「不关 D20」对着 deferred-gaps **两行** D20（均 open、均 CS-6 Settings 300px 活窗目视）。不是 vscode-web 行。两行都不关。
- 「不关 D18」对着 **原文**三平台安装包行（open）。本切片即使产物树排除绿，也只关 **D390**，不改写、不闭合 D18。
- D389 仍 `planned` / blocked（sysroot）。本切片不承接第四次 prepare-deb。
- dest 路径见 §2；禁止只对比 A vs 主仓就当「不撞」。`vscode-web` 与 `VSCode-linux-x64` 不互删，仍禁再打桌面包。桌面包 dest 本 tick 仍活、未碰。
