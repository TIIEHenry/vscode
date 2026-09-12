---
title: "D389 packaging-p3-linux-deb-machine 无窗 Linux-deb 证据"
type: progress
status: in_progress
phase: packaging
updated: 2026-09-12
summary: "dest 身份锁绿、未再 gulp 桌面包；prepare-deb 两次 exit 1（同 GitHub sysroot TimeoutError）。未进树、未成包。未关 D18/D20/D12。"
---

# D389 无窗 Linux-deb 机器断言证据

> **切片：** [d389-packaging-p3-linux-deb-machine](../roadmap/active/d389-packaging-p3-linux-deb-machine.md)  
> **包装树：** `/home/clarence/Projects/Agents/vscode-WorkTrees/merge`  
> **PREPARE_HEAD：** `45185dd756ffab94b52c8869b374ce3e7faecea9`（`git rev-parse HEAD`；`== origin/agent-ide`；未 commit）  
> **DEST_SHA：** `3b4cc89f6e53f14935d8396e7061c11fc74907df`（D388 包装树写出 dest；复用允许 ≠ PREPARE_HEAD）  
> **dest 锁：** 仅 merge 槽；WT 池 dest = `/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64`  
> **裁定：** **blocker。** dest 身份锁绿 → **未**跑 `gulp vscode-linux-x64`。`prepare-deb` **两次** **exit 1**（首败保留；retry 2 同 URL / 同 `TimeoutError`）。失败诚实表行 = **sysroot**（`install-sysroot.ts` `fetchUrl` GitHub asset `TimeoutError`）。未跑 C/D/E。未改 `dep-lists.ts` / `gulpfile.vscode.linux.ts` / `install-sysroot.ts`。未发明镜像 / 代理。未关 D18 / D20（两行）/ D12。未启动产物。未提交 dest / `.deb`。

## Current facts

| 项 | 结论 |
|:---|:-----|
| 包装树 HEAD（PREPARE_HEAD） | `45185dd756ffab94b52c8869b374ce3e7faecea9` |
| dest 产出 SHA（DEST_SHA） | `3b4cc89f6e53f14935d8396e7061c11fc74907df`（D388） |
| DEST_SHA ≠ PREPARE_HEAD | **允许**（合同：复用 dest） |
| `$PRODUCT` | `/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64` |
| `test -x "$PRODUCT/universe-agent-studio"` | **绿**（219765976 字节；mtime `1980-01-01` electron 钉死） |
| `test -f "$PRODUCT/resources/app/node_modules.asar"` | **绿**（91339671 字节；mtime `2026-09-12 11:38:53 +08`，对齐 D388 第二次 gulp） |
| dest 身份锁后是否再 gulp 桌面包 | **否**（`FORBID gulp vscode-linux-x64`） |
| 准备前 leftover `.build/linux/deb` | **无** |
| `npm run gulp vscode-linux-x64-prepare-deb` | **两次 exit 1**。首败 2026-09-12T12:00:35 → 12:06:33 +08（5.95 min）；retry 2 12:09:52 → 12:15:34 +08（5.68 min） |
| 失败诚实表行 | **sysroot**（prepare-deb / getDependencies / sysroot） |
| 八档 hicolor 进树 | **未跑**（B 红） |
| `npm run gulp vscode-linux-x64-build-deb` | **未跑**（B 红） |
| `.deb` 路径 | **无**（`.build/linux/deb` 在失败后不存在；clean-amd64 已 rimraf，未写出树） |
| 八档 Linux deb 进包 | **未跑**（B 红） |
| `dep-lists.ts` | **未改**（未到硬比对） |
| `fakeroot` / `dpkg-deb` | **在 PATH**（未用到） |
| `rpmbuild` / `snapcraft` | **MISSING**（未发明） |
| D18 / D20（两行）/ D12 | **仍 open** |
| D389 | **仍 planned**（§5 未齐，不得关） |

---

## A. dest 身份锁（跳过 `vscode-linux-x64`）

```bash
set -e
REPO="$(pwd)"
PRODUCT="$(dirname "$REPO")/VSCode-linux-x64"
PREPARE_HEAD="$(git rev-parse HEAD)"
DEST_SHA="3b4cc89f6e53f14935d8396e7061c11fc74907df"
if test -x "$PRODUCT/universe-agent-studio" \
  && test -f "$PRODUCT/resources/app/node_modules.asar"; then
  echo "DEST_LIVE=yes; DEST_SHA=$DEST_SHA; PREPARE_HEAD=$PREPARE_HEAD"
  echo "FORBID gulp vscode-linux-x64"
fi
```

| 字段 | 值 |
|:-----|:---|
| `$REPO` | `/home/clarence/Projects/Agents/vscode-WorkTrees/merge` |
| `$PRODUCT` | `/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64` |
| `PREPARE_HEAD` | `45185dd756ffab94b52c8869b374ce3e7faecea9` |
| `DEST_SHA` | `3b4cc89f6e53f14935d8396e7061c11fc74907df` |
| `test -x` 二进制 | **绿** |
| `test -f` asar | **绿** |
| asar 路径 | `/home/clarence/Projects/Agents/vscode-WorkTrees/VSCode-linux-x64/resources/app/node_modules.asar` |
| 桌面包 gulp | **未跑** |

失败后复测 dest 仍活：asar mtime 仍为 `2026-09-12 11:38:53 +08`（D388 写出，本 tick **未** `rimraf` dest）。retry 2 后再测：`test -x` / asar 仍绿，asar mtime 未变。

---

## B. `npm run gulp vscode-linux-x64-prepare-deb`（exit 1）

```bash
npm run gulp vscode-linux-x64-prepare-deb
```

| 字段 | 值 |
|:-----|:---|
| 开始 | `2026-09-12T12:00:35+08:00` |
| 结束 | `2026-09-12T12:06:33+08:00` |
| exit | **1** |
| 任务 | `'vscode-linux-x64-prepare-deb' errored after 5.95 min` |
| 失败步 | `getVSCodeSysroot` → `fetchUrl`（`build/linux/debian/install-sysroot.ts`） |
| 失败诚实表行 | **sysroot**：GitHub asset / checksum / tarball。环境不足 + **prepare-deb / getDependencies / sysroot** |

**日志（原文）：**

```
[12:00:35] Starting 'vscode-linux-x64-prepare-deb'...
[12:00:35] Starting clean-amd64 ...
[12:00:35] Finished clean-amd64 after 1 ms
[12:00:35] Starting vscode-linux-x64-prepare-deb ...
Installing Debian amd64 root image: /tmp/debian_bullseye_amd64-sysroot
Downloading https://msftelectronbuild.z5.web.core.windows.net/sysroots/toolchain/f2e052b0cdab9b6f9bfe311c5269264d5f4e38a018bbc27ba2314b73ac8f7053
Fetching x86_64-linux-gnu-glibc-2.28-gcc-10.5.0.tar.gz for x86_64-linux-gnu
Installing amd64 root image: /tmp/vscode-amd64-sysroot
Found asset x86_64-linux-gnu-glibc-2.28-gcc-10.5.0.tar.gz @ https://api.github.com/repos/microsoft/vscode-linux-build-agent/releases/assets/354882747.
Fetching failed: TimeoutError: The operation was aborted due to timeout
（上句共 10 次 onRetry）
[12:06:33] 'vscode-linux-x64-prepare-deb' errored after 5.95 min
[12:06:33] TimeoutError: The operation was aborted due to timeout
```

`download.ts` 默认 `timeout=30_000`、`fetchUrl` `attempts: 11`。Chromium/Azure sysroot 已写出 stamp（`/tmp/debian_bullseye_amd64-sysroot/.stamp`，树约 222M）。VS Code GitHub sysroot **无** `.stamp`（`/tmp/vscode-amd64-sysroot` 空目录）。未改超时、未发明镜像、未设 `GITHUB_TOKEN`、未改 gulp。

仓外日志碎片：`/tmp/d389-prepare-deb-start.txt` / `/tmp/d389-prepare-deb-exit.txt`（`PREPARE_DEB_EXIT=1`）/ `/tmp/d389-prepare-deb-end.txt`。

---

## B retry 2（2026-09-12；同冻结命令；未改超时 / 镜像 / gulp）

```bash
npm run gulp vscode-linux-x64-prepare-deb
```

| 字段 | 值 |
|:-----|:---|
| 开始 | `2026-09-12T12:09:52+08:00`（gulp 任务 `12:09:53`） |
| 结束 | `2026-09-12T12:15:34+08:00` |
| 时长 | **5.68 min** |
| exit | **1** |
| 任务 | `'vscode-linux-x64-prepare-deb' errored after 5.68 min` |
| 失败步 | `getVSCodeSysroot` → `fetchUrl`（`build/linux/debian/install-sysroot.ts`） |
| URL | `https://api.github.com/repos/microsoft/vscode-linux-build-agent/releases/assets/354882747` |
| asset | `x86_64-linux-gnu-glibc-2.28-gcc-10.5.0.tar.gz`（`x86_64-linux-gnu`） |
| dest 目录 | `/tmp/vscode-amd64-sysroot`（仍空；**无** `.stamp`） |
| attempts | `Fetching failed: TimeoutError` **10 次** onRetry + 终局 throw（`download.ts` 默认 `timeout=30_000`、`fetchUrl` `attempts: 11`） |
| 失败诚实表行 | **sysroot**：环境不足 + **prepare-deb / getDependencies / sysroot** |

**日志（原文）：**

```
[12:09:53] Starting 'vscode-linux-x64-prepare-deb'...
[12:09:53] Starting clean-amd64 ...
[12:09:53] Finished clean-amd64 after 1 ms
[12:09:53] Starting vscode-linux-x64-prepare-deb ...
Fetching x86_64-linux-gnu-glibc-2.28-gcc-10.5.0.tar.gz for x86_64-linux-gnu
Installing amd64 root image: /tmp/vscode-amd64-sysroot
Found asset x86_64-linux-gnu-glibc-2.28-gcc-10.5.0.tar.gz @ https://api.github.com/repos/microsoft/vscode-linux-build-agent/releases/assets/354882747.
Fetching failed: TimeoutError: The operation was aborted due to timeout
（上句共 10 次 onRetry）
[12:15:34] 'vscode-linux-x64-prepare-deb' errored after 5.68 min
[12:15:34] TimeoutError: The operation was aborted due to timeout
```

retry 2 **未**再拉 Azure Chromium sysroot（`/tmp/debian_bullseye_amd64-sysroot/.stamp` 仍为首次 12:00 写出）。未改超时、未发明镜像 / 代理、未设 `GITHUB_TOKEN`、未改 `install-sysroot.ts` / gulp / `dep-lists.ts`。C/D/E **未跑**（不假绿）。

仓外日志碎片：`/tmp/d389-prepare-deb-retry2-start.txt` / `/tmp/d389-prepare-deb-retry2-exit.txt`（`PREPARE_DEB_EXIT=1`）/ `/tmp/d389-prepare-deb-retry2-end.txt`。

---

## 失败诚实表（本 tick 记账）

| 失败步 | 本 tick | 记录 |
|:-------|:--------|:-----|
| **sysroot 拉失败**（`install-sysroot.ts`：GitHub asset / checksum / `curl` `sysroots.json` / tarball 校验 / `tar` 解压） | **命中（两次）** | 环境不足 + **prepare-deb / getDependencies / sysroot**。具体：`getVSCodeSysroot` 拉 `x86_64-linux-gnu-glibc-2.28-gcc-10.5.0.tar.gz`（release tag `v20260212-405735`，asset `354882747` @ `https://api.github.com/repos/microsoft/vscode-linux-build-agent/releases/assets/354882747`）`TimeoutError`。首败 11 attempts / 5.95 min；retry 2 同 URL / 11 attempts / 5.68 min |
| `dpkg-shlibdeps` 红 | 未到 | — |
| `find` native `.node` 空返回 | 未到 | 不得把「prepare 未完成」当 native 扫描已过 |
| dep-lists 硬比对 | 未到 | **未改** `dep-lists.ts` |
| `fakeroot` / `dpkg-deb` 红 | 未到 | 两命令在 PATH；未跑 build-deb |

未发明 rpm/snap 工具。未改 `gulpfile.vscode.linux.ts`。

---

## C. 八档 hicolor 进树（未跑）

`TREE=".build/linux/deb/amd64/universe-agent-studio-amd64"` 不存在（`clean-amd64` 后未写出）。八条 `test -f` **未执行**。此处不写「进包」。

| sz | 进树 `test -f` |
|:---|:---------------|
| 16 / 24 / 32 / 48 / 64 / 128 / 256 / 512 | **未跑** |

---

## D. `npm run gulp vscode-linux-x64-build-deb`（未跑）

B 红，未启动。

---

## E. Linux deb 进包（未跑）

无 `.deb`。未对 `dpkg-deb -c` 做逐档循环。禁止把 leftover `.build` 当绿。本切片**唯一** in-package 断言未执行。不写「三平台已验」。

---

## 未提交

- 未 `git add` dest（`VSCode-linux-x64`）
- 未写出、未 `git add` `.deb`
- 未 commit
