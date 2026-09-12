---
title: "D389 packaging-p3-linux-deb-machine（无窗 Linux-deb 子集）"
type: roadmap
status: active
phase: packaging
updated: 2026-09-12
summary: "实施 blocked：prepare-deb 三次 sysroot GitHub TimeoutError；dest 身份锁绿未再 gulp；不关 D18/D20/D12"
---

# D389 packaging-p3-linux-deb-machine

> **父方案：** [packaging-and-release.md](../../plans/packaging-and-release.md) §7 / §8 P3 / §9.6。  
> **P1 证据：** [d388-packaging-p1-asar-evidence](../../progress/d388-packaging-p1-asar-evidence.md)（第二次 `vscode-linux-x64` exit 0；dest 仍活则**禁止**再 gulp 桌面包）。  
> **延期行：** [deferred-gaps D389](../../progress/deferred-gaps.md)（`planned`；实施 blocked：sysroot；retry 3 同红）。  
> **冲突域：** `packaging / gulp-linux-deb`（与 D388 同 WT 池 dest）。  
> **本切片状态：** 实施 **blocked**（§4 B `prepare-deb` **三次** exit 1；失败诚实表 **sysroot**）。dest 身份锁绿，**未**再 gulp 桌面包。§5 未齐，**不得**关 D389 / D18 / D20（两行）/ D12。证据：[d389-packaging-p3-linux-deb-evidence](../../progress/d389-packaging-p3-linux-deb-evidence.md)。规则 16 **Approve with changes** 已并入；**不自宣裸 Approve**。  
> **Architecture-First：** 正文含问题类 / 选项 / 选定。**无新 ADR。**

## 1. 范围

**覆盖（仅 Linux deb，无窗）：**

1. 复用仍活 dest：`PRODUCT="$(dirname "$REPO")/VSCode-linux-x64"`。存活探针 = **dest 身份锁**：`test -x "$PRODUCT/universe-agent-studio"` **且** `test -f "$PRODUCT/resources/app/node_modules.asar"`。仅两者都绿才算仍活 → **禁止**再跑 `vscode-linux-x64`。半残 / 他槽残留（有二进制无 asar，或无法证明 dest 产出 SHA）**不得**当「仍活」跳过 A，却把错误二进制打进 `.deb`。仅 dest **缺失或身份锁失败**才允许重 gulp。证据须记 dest 产出 SHA（D388 包装树：`3b4cc89f6e53f14935d8396e7061c11fc74907df`）**与**本次 prepare/build 的 HEAD。复用允许 dest SHA ≠ 当前 prepare HEAD，但不能只 `test -x`。WT 池 dest **只有一份**：`/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64`。与 D388 同一把独占锁（`binaryDir='../VSCode-linux-x64'`）。
2. `npm run gulp vscode-linux-x64-prepare-deb` exit 0。
3. 八档 hicolor **在 prepare 树**（`NxN`；`hicolor/<N>/` **不算**）：
   `.build/linux/deb/amd64/universe-agent-studio-amd64/usr/share/icons/hicolor/${sz}x${sz}/apps/universe-agent-studio.png`  
   `sz ∈ {16,24,32,48,64,128,256,512}`
4. `npm run gulp vscode-linux-x64-build-deb` exit 0（本机已有 `fakeroot` + `dpkg-deb`）。
5. `.build/linux/deb/amd64/deb/` 有一个 `.deb`；对 `dpkg-deb -c` 输出按 `for sz in 16 24 32 48 64 128 256 512` **逐档**断言同一八条路径，缺一 `exit 1` → 只写 **Linux deb 进包**。这是本切片**唯一** in-package 断言。**永远不要**写「三平台已验」。禁止单条 `rg` 交替正则（任一档命中即 exit 0 → 假绿）。

旁注：dest 独占锁与「仍活则禁再 gulp」是实施不变量，**不是**新覆盖。仓内 `resources/linux/icons/hicolor/` 八档是**源**，不是「已进包」。

**不覆盖（仍归父方案 / 原 D 行）：**

- `prepare-rpm` / `build-rpm`（本机 `rpmbuild` **MISSING**）。
- snap / Inno / Darwin。
- I6、产物启动、Settings 300px、Dial / `connect` / 引擎握手。
- 关闭 D18 **原文**行 / D20 **两行** / D12。
- 父方案 §7「拆分后 Linux 子集可关」的全套门槛（含产物+隔离 profile 启动、拆行改写 D18、建议 `prepare-rpm`）。

## 2. 代码基线（本工位只读；已对 gulpfile 核实）

| 项 | 事实 | 出处 |
|:---|:-----|:-----|
| dest / `binaryDir` | `prepareDebPackage`：`binaryDir = '../VSCode-linux-' + arch`；x64 → **`../VSCode-linux-x64`**。与 D388 `PRODUCT="$(dirname "$REPO")/VSCode-linux-x64"` 同一仓外目录 | `build/gulpfile.vscode.linux.ts` L43 |
| 桌面包任务 | 仅 dest **缺失或身份锁失败**才跑；任务名 **`vscode-linux-x64`**（D388 已绿） | `build/gulpfile.vscode.ts`；D388 证据 |
| prepare-deb 任务名 | `BUILD_TARGETS` 含 `{ arch:'x64' }` → **`vscode-linux-x64-prepare-deb`**（先 `rimraf(.build/linux/deb/amd64)`） | 同 linux gulpfile L293–302 |
| build-deb 任务名 | **`vscode-linux-x64-build-deb`**；`fakeroot dpkg-deb -Zxz -b ${applicationName}-${debArch} deb` | L130–138、L303–304 |
| deb 架构目录 | `getDebPackageArch('x64')` → **`amd64`** | L33–35 |
| prepare 树根 | `destination = '.build/linux/deb/' + debArch + '/' + product.applicationName + '-' + debArch` → **`.build/linux/deb/amd64/universe-agent-studio-amd64`** | L45；`product.json` `applicationName` |
| hicolor 落点 | `linuxHicolorIcons('usr/share/icons/')`；`gulp.src('resources/linux/icons/hicolor/**', { base: 'resources/linux/icons' })` → 树内 `usr/share/icons/` + 源相对路径。Discovery 前缀与代码一致，**未改** | L27–30、L78 |
| 成包目录 | `cwd = .build/linux/deb/amd64`；`mkdir -p deb` 后写出 **`.build/linux/deb/amd64/deb/`** 下的 `.deb` | L130–137 |
| 二进制 / 图标名 | `applicationName` = **`universe-agent-studio`**；`linuxIconName` = **`universe-agent-studio`**（pixmap / desktop `@@ICON@@`；**不是**本切片八档断言对象） | `product.json` |
| 源八档 | `resources/linux/icons/hicolor/{16,24,32,48,64,128,256,512}x{同}/apps/universe-agent-studio.png` **在仓**。`hicolor/<N>/` 目录名不存在。源 ≠ 进树 ≠ 进包 | 本工位 `find`；P0 证据 |
| dest 方案时点 | 2026-09-12 本工位 `test -x` **仍绿**（实施时须重测身份锁：`test -x` **且** asar；仅两者都绿才跳过 A） | WT 池 dest；D388 dest SHA=`3b4cc89f6e53f14935d8396e7061c11fc74907df` |
| 本机工具 | `fakeroot` / `dpkg-deb` **在**；`rpmbuild` **MISSING**；`snapcraft` **MISSING** | 本工位 `command -v`（只记，未跑 gulp） |
| 依赖失败面 | `getDependencies('deb', binaryDir, …)`：Azure/GitHub **sysroot**（`install-sysroot.ts`）+ Chromium **`dpkg-shlibdeps.pl`**（`calculate-deps.ts`，需 `curl` / `perl`）+ 与 `debian/dep-lists.ts` **硬比对**（`FAIL_BUILD_FOR_NEW_DEPENDENCIES === true` 则 throw）。另：`find` native `.node` 失败时 **`return []`（不 throw）** | `build/linux/dependencies-generator.ts` L36–97（`find` 空返回 L49–53）；`install-sysroot.ts`；`debian/calculate-deps.ts` |

**仓外桌面包 dest（与 D388 同锁）：**

| 仓根 `$REPO` | `$PRODUCT` | 说明 |
|:-------------|:-----------|:-----|
| `/home/clarence/Projects/Agents/vscode`（主仓） | `/home/clarence/Projects/Agents/VSCode-linux-x64` | 与 WT 池 **不撞** |
| `/home/clarence/Projects/Agents/vscode-WorkTrees/A` … `J` / `merge` | **`/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64`** | dirname 相同；**一份** dest |

`prepare-deb` **读**该 dest，**不** `rimraf` dest；它 `rimraf` 的是工位内 `.build/linux/deb/amd64`。并行第二工位再打 `vscode-linux-x64` 仍会互删 dest。禁止只对比 A vs 主仓就当「不撞」。

**路径前缀裁定：** Discovery 的 `.build/linux/deb/amd64/universe-agent-studio-amd64/usr/share/icons/hicolor/${sz}x${sz}/apps/universe-agent-studio.png` 与 `destination` + `linuxHicolorIcons` **一致**，冻结时不改前缀。

## 3. Architecture-First（规则 16 Approve with changes 已并入；实施 **blocked**（sysroot；retry 3 同红）；不自宣裸 Approve）

### 3.1 Problem class

| | |
|:--|:--|
| **症状** | 父方案 P3 / §7 把「Linux 子集」写成 prepare-deb **加**建议 prepare-rpm / 能做的 build-deb\|rpm，并在 P4 拆行后关改写后的 D18。D18 **原文** closer 仍是三平台安装包。本机有 fakeroot+dpkg-deb，无 rpmbuild。P1 dest 已活，再 gulp 桌面包会 `rimraf` 同一 dest。 |
| **问题类** | **验收契约过宽 / 机器断言与三平台发行面未拆分**（与 D388「机器 vs 活窗」同类：父切片把可跑命令和原文 closer 绑在一起）。 |
| **复发机制** | 下一实施者把「P3」读成关 D18 原文、或把 prepare 树写成「进包」、或 dest 仍活再跑 `vscode-linux-x64` 互删产物、或只 `test -x` 把半残 dest 打进 `.deb`、或单条 `rg` 交替正则假绿进包、或 invent rpm/snap 工具、或写「三平台已验」。 |
| **防复发** | 单独冻结无窗 Linux-deb 命令、dest **身份锁**（asar + dest SHA）、进包八档**逐档硬计数**、进树 vs 进包用词、失败诚实与禁令；D18/D20（两行）/D12 原行保持 open。 |

### 3.2 Options

| 选项 | 内容 | 裁定 |
|:-----|:-----|:-----|
| **A** | 本 tick 做完父方案 P3 全套（prepare-deb+rpm、能做的 build-deb\|rpm、按 §7 关 Linux 子集 D18 / 拆行） | **Reject**：`rpmbuild` MISSING；本 tick 禁止关 D18 原文；§7 关 Linux 子集还要求产物启动（§7.2），本切片无窗 |
| **B** | 只改父方案正文、不建 active 切片 | **Reject**：Loop 任务源是 `dev/roadmap/active/`；无 checkbox 则下次又并回 rpm / 关原行 |
| **C** | 无窗 Linux-deb 机器子集 = 本切片 + D389 `planned` 合同 | **选定** |
| **D** | 先改 `dep-lists.ts` / gulp / 发明 rpm 工具，再谈成包 | **Reject**：失败须记环境不足 + 失败步；未与 dep-lists 比对不得改清单；改了也**不**关 D18 原文 |

不需要新 ADR：不改打包机制、不改 UA 协议、不把发行面迁出 gulp linux 任务。

### 3.3 选定设计与不变量

**选定 C。** 不变量：

1. 本切片完成线 = §1 五条机器断言，**不含**窗、Dial、rpm/snap/Inno/Darwin、三平台声明。
2. dest 仍活 = dest **身份锁**通过：`test -x "$PRODUCT/universe-agent-studio"` **且** `test -f "$PRODUCT/resources/app/node_modules.asar"` → **禁止** `npm run gulp vscode-linux-x64`。半残 / 他槽残留不得当「仍活」跳过 A。仅 dest 缺失或身份锁失败才允许重 gulp，且仍受 D388 独占锁。
3. 八档只认 `hicolor/${sz}x${sz}/`；`hicolor/<N>/` 假绿。源在仓 **不算** 进树；进树 **不算** 进包。
4. 进包是本切片**唯一** in-package 断言：对 `dpkg-deb -c` 输出按 `for sz in 16 24 32 48 64 128 256 512` **逐档**断言，缺一 `exit 1`。禁止单条 `rg` 交替正则（任一档命中即 exit 0 → 假绿）。见八条路径才写 **Linux deb 进包**。禁止「三平台已验」。
5. sysroot / `dpkg-shlibdeps` / dep-lists 硬比对失败 → 记 **环境不足 + 哪一步失败**；不发明工具；**除非**已与 `build/linux/debian/dep-lists.ts` 比对，否则不改清单。可改的是对照后的 `dep-lists.ts`，不是随便改 `gulpfile.vscode.linux.ts`（hicolor/包名未进树才动 linux gulpfile，见父 P3）。即使改了也**不**关 D18 原文。
6. D18 / D20（[deferred-gaps](../../progress/deferred-gaps.md) **两行**）/ D12 **不得**随本切片闭合。
7. WT 池 dest **只有一份**（§2 表）。证据须同时记录 dest 产出 SHA（复用 D388 dest 时为 `3b4cc89f6e53f14935d8396e7061c11fc74907df`）**与**跑 prepare/build 的包装树 HEAD。复用允许 dest SHA ≠ 当前 prepare HEAD，但必须能证明 dest 身份（asar + SHA 入证），不是只 `test -x`。禁止拿别的槽 `.build` 勾 checkbox。
8. 规则 16 Approve with changes 已并入本切片合同；实施 **blocked**（§4 B sysroot；retry 3 同 URL `TimeoutError`）。不自宣裸 Approve。

## 4. 冻结命令（实施时原样跑；本方案 tick **不跑**）

**dest 独占 + 身份锁（实施前必读）：**

- WT 池 dest 只有一份：`/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64`。
- 实施选 **merge 槽**。字母槽禁止与 merge（或彼此）并行再打 `vscode-linux-x64`。
- **先测 dest 身份锁。** `test -x` **且** `test -f "$PRODUCT/resources/app/node_modules.asar"` 都绿 → 跳过 A，直接 B；证据记 dest 产出 SHA（D388 包装树：`3b4cc89f6e53f14935d8396e7061c11fc74907df`）**与**本次 prepare/build HEAD。半残 / 他槽残留（缺 asar 或无法证明 dest SHA）**不得**跳过 A。缺失或身份锁失败 → 才允许 A（gulp 会 `rimraf` dest）。
- 复用允许 dest SHA ≠ 当前 prepare HEAD。禁止拿别的槽 `.build` 勾 checkbox。
- 冻结脚本建议 `set -e`（Minor）；进包逐档断言须硬失败（Important）。

在**已有 `node_modules`、D388 dest 合同仍适用**的工位（**仅 merge 槽**）：

```bash
set -e
# A. 桌面包 — 仅 dest 缺失或身份锁失败时
REPO="$(pwd)"
PRODUCT="$(dirname "$REPO")/VSCode-linux-x64"
# 期望：$PRODUCT = /home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64
PREPARE_HEAD="$(git rev-parse HEAD)"
# dest 产出 SHA：复用 D388 dest 时记 D388 包装树；本步重 gulp 则改记本次写出 dest 的 HEAD
DEST_SHA="3b4cc89f6e53f14935d8396e7061c11fc74907df"
if test -x "$PRODUCT/universe-agent-studio" \
  && test -f "$PRODUCT/resources/app/node_modules.asar"; then
  echo "DEST_LIVE=yes; DEST_SHA=$DEST_SHA; PREPARE_HEAD=$PREPARE_HEAD"
  echo "FORBID gulp vscode-linux-x64"
else
  echo "DEST_MISSING_OR_IDENTITY_FAIL; exclusive lock then:"
  npm run gulp vscode-linux-x64
  # 验收：exit 0 且 test -x 且 test -f asar；DEST_SHA 改记本次 gulp 的 HEAD
fi
# 证据必含：asar 存在、DEST_SHA、PREPARE_HEAD。复用允许 DEST_SHA ≠ PREPARE_HEAD。

# B. prepare-deb（任务名已在 gulpfile 核实）
npm run gulp vscode-linux-x64-prepare-deb
# 验收：exit 0
# 冻结注（Minor）：B 之后 .build/linux/deb/amd64/deb/ 应只有一个 .deb；勿 find | head -n 1 捡旧包。

# C. 八档 hicolor 进树（NxN；hicolor/<N>/ 不算）
TREE=".build/linux/deb/amd64/universe-agent-studio-amd64"
for sz in 16 24 32 48 64 128 256 512; do
  test -f "$TREE/usr/share/icons/hicolor/${sz}x${sz}/apps/universe-agent-studio.png" \
    || { echo "MISSING in-tree ${sz}x${sz}"; exit 1; }
done
# 验收：八条 test -f 成功。此处只写「进树」，禁止写「进包」。

# D. build-deb（本机已有 fakeroot + dpkg-deb）
npm run gulp vscode-linux-x64-build-deb
# 验收：exit 0

# E. Linux deb 进包（本切片唯一 in-package 断言：与进树相同的逐档循环）
DEBDIR=".build/linux/deb/amd64/deb"
# 冻结注（Minor）：此处应只有一个 .deb；禁止 find | head -n 1 捡旧包。实施者须确认 $DEB 为本轮 B/D 写出。
DEB="$(find "$DEBDIR" -maxdepth 1 -name '*.deb' -print)"
LISTING="$(dpkg-deb -c "$DEB")"
for sz in 16 24 32 48 64 128 256 512; do
  echo "$LISTING" | rg -q "usr/share/icons/hicolor/${sz}x${sz}/apps/universe-agent-studio.png" \
    || { echo "MISSING in-package ${sz}x${sz}"; exit 1; }
done
# 验收：八档逐条命中。缺一 exit 1。禁止单条交替正则 rg（任一档命中即 exit 0 → 假绿）。
# 只写「Linux deb 进包」。禁止「三平台已验」。
```

**失败诚实（实施时按步记账，不发明工具）：**

| 失败步 | 代码出处（点名，不发明） | 记录 |
|:-------|:------------------------|:-----|
| sysroot 拉失败 | `install-sysroot.ts`：GitHub asset / checksum / `curl` `sysroots.json` / tarball 校验 / `tar` 解压 | 环境不足 + **prepare-deb / getDependencies / sysroot** |
| `dpkg-shlibdeps` 红 | `calculate-deps.ts`：`curl` `dpkg-shlibdeps.pl` 失败，或 `perl` 非 0 | 环境不足 + **prepare-deb / dpkg-shlibdeps** |
| `find` native `.node` 失败 | `dependencies-generator.ts` L49–53：`spawnSync('find', [nativeModulesPath, '-name', '*.node'])` 非 0 则 **`return []`（不 throw）** | 记 **getDependencies / find .node 空返回**；依赖列表可能偏空。不把「prepare exit 0」当 native 扫描已过 |
| dep-lists 硬比对 | `dependencies-generator.ts` L88–93：`JSON.stringify` ≠ `referenceGeneratedDepsByArch` 且 `FAIL_BUILD_FOR_NEW_DEPENDENCIES` | 记 Old/New；**除非**已对照 `build/linux/debian/dep-lists.ts`，否则不改清单（对照后改 `dep-lists.ts`，不是随便改 `gulpfile.vscode.linux.ts`）；改了也**不**关 D18 原文 |
| `fakeroot` / `dpkg-deb` 红 | `buildDebPackage` L137 | 环境不足 + **build-deb**（本机方案时点两命令在 PATH；实施时重测） |

证据写入新建 `dev/progress/` 目录即可（命令、exit、失败步、`$PRODUCT`、asar 路径、dest 产出 SHA、`.deb` 路径、包装树 HEAD SHA）。**不提交** `VSCode-linux-x64` 与 `.deb`。

## 5. Checkbox（实施 tick 才勾）

- [x] dest 身份锁：`test -x "$PRODUCT/universe-agent-studio"` **且** `test -f "$PRODUCT/resources/app/node_modules.asar"` 都绿则**未**再跑 `vscode-linux-x64`；半残 / 他槽残留不得当仍活；仅缺失或身份锁失败才重 gulp 且 exit 0
- [x] dest 独占 + 双 SHA 入证：仅 merge 槽；WT 池 dest 一份；证据记 dest 产出 SHA（复用 D388 dest = `3b4cc89f6e53f14935d8396e7061c11fc74907df`）**与**跑 prepare/build 的 HEAD（允许 dest SHA ≠ HEAD）
- [ ] `npm run gulp vscode-linux-x64-prepare-deb` exit 0 — **三次 exit 1**（失败诚实表 **sysroot**；retry 3 同红，未假绿）
- [ ] 八档 hicolor **进树**（`NxN` 八条 `test -f`；`hicolor/<N>/` 不算）— **未跑**（B 三次红）
- [ ] `npm run gulp vscode-linux-x64-build-deb` exit 0 — **未跑**（B 三次红）
- [ ] `.build/linux/deb/amd64/deb/` 有 `.deb`；`dpkg-deb -c` 按 `for sz in 16 24 32 48 64 128 256 512` **逐档**断言同一八条路径，缺一 `exit 1`；证据只写 **Linux deb 进包**（本切片唯一 in-package 断言；禁止单条 `rg` 交替正则）— **未跑**（无 `.deb`）
- [x] 证据目录已记命令 / 路径 / asar / dest 产出 SHA / 失败诚实（若红）/ 包装树 HEAD SHA；未提交产物 — [d389-packaging-p3-linux-deb-evidence](../../progress/d389-packaging-p3-linux-deb-evidence.md)
- [x] **N/A** dep-lists：未到硬比对、未改 `dep-lists.ts` / `gulpfile.vscode.linux.ts`。**即使改了也不关 D18 原文**

同质断言已合成上列 batch，不拆并行槽。

## 6. 禁令（实施 tick 仍有效）

| 禁止 | 理由 |
|:-----|:-----|
| dest 仍活再跑 `gulp vscode-linux-x64` | 会 `rimraf` WT 池唯一 dest；D388 产物作废 |
| 只 `test -x`、无 asar / 无 dest 产出 SHA 就复用 dest | 半残或他槽残留会被打进 `.deb`；复用须 asar + dest SHA 入证 |
| 单条 `rg` 交替正则对 `dpkg-deb -c` 断言进包 | 任一档命中即 exit 0 → 假绿；须 `for sz in 16…512` 逐档，缺一 `exit 1` |
| 启动产物 / 活窗 / Settings 300px / Dial | 本子集无窗；D20 两行仍开 |
| 关闭 D18 原文 / D20（两行，均为 CS-6 300px 活窗目视）/ D12 | 原退出条件未满足；本切片不关原行 |
| `prepare-rpm` / `build-rpm` / snap / Inno / Darwin | 不覆盖；`rpmbuild` MISSING |
| 把 prepare 树八档写成「进包」或写「三平台已验」 | 父方案 §7 用词锁 |
| 未对照 dep-lists 就改 gulp / `dep-lists.ts`；随便改 `gulpfile.vscode.linux.ts`；invent 工具补 rpm | 失败诚实；对照后只改 `dep-lists.ts`；hicolor/包名未进树才动 linux gulpfile；不关 D18 原文 |
| leftover-looks-live 再切片、发明 proto、D8/D147、D16 切片 1、D26 引擎仓、F3/F4/A2/U2 | 父约束 |
| 改 `dev/loop/**`、`src/`、本切片 commit、为本切片跑 `compile-client` | 父约束 |
| 自宣裸 Architecture-First Approve | 规则 16 只记 Approve with changes 已并入合同；实施 blocked 不得自宣完成 |

## 7. 退出条件

**方案：** dest 身份锁与进包八档硬计数已写入 §3.3 / §4 / §5 / §6。规则 16 **Approve with changes** 已并入（进包硬计数 + dest 身份锁）。不自宣裸 Approve。

**实施（本 tick + retry 2 + retry 3）：** dest 身份锁绿，跳过 A（retry 2 / retry 3 复测仍绿）。B `prepare-deb` **三次 exit 1**。失败诚实表行 = **sysroot**（`install-sysroot.ts` `fetchUrl` GitHub asset `354882747` `TimeoutError`；retry 3 同 URL / 11 attempts / 5.7 min）。C/D/E 未跑（不假绿）。§5 未齐 → **不关 D389**。仍不得关 D18/D20（两行）/D12。未发明镜像。未改 `install-sysroot.ts` / gulp / `dep-lists.ts`。未提交产物。不假绿 leftover `.build`。

## 8. 开放项

- 规则 16 **Approve with changes** 已并入进包硬计数 + dest 身份锁。实施 **blocked** 于 B sysroot（retry 3 同红）。不自宣裸 Approve。不再「待审」。
- dest 身份锁已重测（`test -x` **且** asar）都绿 → 跳过 A；retry 2 / retry 3 后再测仍绿。DEST_SHA=`3b4cc89f6e53f14935d8396e7061c11fc74907df`；PREPARE_HEAD（retry 3）=`442b5457e39e563e4d8c2fce0a46b5d20bf44df6`。
- 「不关 D20」对着 deferred-gaps **两行** D20（均 open、均 CS-6 Settings 300px 活窗目视）。不是 deb 行。两行都不关。
- 「不关 D18」对着 **原文**三平台安装包行（open）。本切片即使 Linux deb 进包绿，也只关 **D389**，不改写、不闭合 D18。
- dest 路径见 §2；禁止只对比 A vs 主仓就当「不撞」。

**Minor（不升格覆盖、不阻塞 §5）：**

- B 之后 `.build/linux/deb/amd64/deb/` 应只有一个 `.deb`；勿 `find | head -n 1` 捡旧包。
- 「不改 gulp 清单」对齐父方案：可改的是对照后的 `dep-lists.ts`，不是随便改 `gulpfile.vscode.linux.ts`；hicolor/包名未进树才动 linux gulpfile（父 P3）。
- `getDependencies` 在 `find` native `.node` 失败时 `return []`（不 throw）— 已列入 §4 失败诚实表。
- 冻结脚本建议 `set -e`；进包逐档断言须硬失败（后者已升格为 §4 E / §5 Important）。
