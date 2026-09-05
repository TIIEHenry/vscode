---
title: "打包与发行验证（grpc 运行时 / D18 / D20）"
type: plan
status: accepted
phase: N/A
updated: 2026-09-04
summary: "先证实开发态与 gulp 产物对 @grpc/grpc-js 的处理差，再按需修打包清单；D20 关闭=300px 活窗 + 开发态 launch 缺 grpc 已根因；D18 拆成 Linux 子集（本稿可关）与新 D 行（Win/mac/snap，环境不足，open）；品牌 PNG 生成链先装 sharp"
---

# 打包与发行验证（grpc 运行时 / D18 / D20）

> **触发：** [D20](../progress/deferred-gaps.md) 把隔离启动时 `@grpc/grpc-js` 缺失记成「CS-6 目视欠账」，实际是 **electron-main 启动即 `require('@grpc/grpc-js')`**（`app.ts` 装配 `UniverseAgentConnectionService`，其 node 实现静态 import `grpcClient.ts` / `universeAgentChannel.ts`）。**不是**启动就 Dial 引擎。缺模块会在主进程加载期失败，工作台开不了窗。[D18](../progress/deferred-gaps.md) 原文 closer 是三平台安装包未验。用户要求跑一次 `gulp vscode-linux-x64`，从产物启动，确认进包与 Web 排除；**D20** 按 §5.3（300px 活窗 + 开发态缺失已根因）闭合；**D18** 按 §7 拆成 Linux 子集与新 D 行，禁止把 Win/mac 部分隐进脚注。
> **身份方案：** [product-identity](product-identity.md)（I3b 接线已落；I6 Darwin/Appx 发行标识仍归发布方；D18 原文三平台安装包未验）。
> **需求边界：** [PRD-010](../../docs/product/requirements.md#prd-010-产品身份) 仍 `accepted`；本方案不把它升 `implemented`。
> **引擎边界：** [ADR-003](../decisions/003-engine-adapter-boundary.md) · [debug-engine](../../docs/guides/debug-engine.md)。

## 1. 目标

1. **证实** 开发态 `./scripts/code.sh` 与 `gulp vscode-linux-x64` 产物对 `@grpc/grpc-js`（及其**实际存在的**传递 / native 文件）处理是否不同；缺包才改 gulp 清单，不臆造。
2. 走通 **Linux x64 黄金路径**：真实 gulp 桌面包 → 隔离 profile 从产物启动 → 断言 gRPC 可 `require` / 主进程可构造 UA 连接服务 → 再开默认窗 Settings 缩到约 300px（给 D20 活窗证据）。启动成功只证明模块已解析，**不**要求 Dial 引擎。
3. 钉死 **进包 / 排除清单**：桌面包含 `@grpc/grpc-js` 及经证实的 `.node`；Web（`vscode-web`）与 server/REH（`vscode-reh-*`）入口不得带入该运行时。
4. **拆分 D18**（§7，签收裁定）：D18 行改写为 **Linux 子集**（目录包 + prepare 树 + 本机能做的 deb/rpm 成包），由本稿可关；原文的 Win/mac/snap installer 元数据部分**搬到新开的 D 行**（取 deferred-gaps 下一空号；D21 已被 m7-gap-closeout 预留），标环境不足、保持 open。拆分在 deferred-gaps 表内可见，不丢原退出条件。**prepare 树 ≠ 进包**。
5. 启动失败或进包失败记 [D17](../progress/deferred-gaps.md)；**只有改 gulp / `.moduleignore` / asar unpack 清单并复验产物，才算打包缺陷修复**。**D20 的原始失败场景是开发态隔离 `launch.sh` 缺 `@grpc/grpc-js`**（deferred-gaps D20 行原文）：D20 关闭须同时满足 300px 活窗证据 **与** 该开发态缺失已根因（修复，或证明是工位 `node_modules` / `--repo` 指错并写明）；不得只换产物载体绕过它。

## 2. 非目标

- 不发布应用商店、更新通道、签名发行物；不做正式渠道分发。
- **I6**（`darwinBundleIdentifier` / Appx `Publisher` / 签名主体）仍归发布方，见 [product-identity §6 I6](product-identity.md)；本方案不定稿、不产出面向用户的 macOS / Appx 包。
- 本机不是 Windows / macOS、或缺 Inno / `osx` 工具链时，**不假装**做 `vscode-win32-*` / Darwin 包。
- 不改 UA 协议、不把 gRPC 迁出 electron-main、不放松 renderer 禁 `require('@grpc/grpc-js')`。
- 不把 D15 Web 冒烟、PRD-008 引擎接通、I5 迁移验收绑进本方案完成线。
- 不把「worktree 没 `npm install`」修成 gulp 变更。
- 不把「启动即 require 模块」写成「启动即 Dial」；引擎接通仍归 [prd-008-engine-e2e](prd-008-engine-e2e.md) / [debug-engine](../../docs/guides/debug-engine.md)。

## 3. 已核实的代码事实（起草时 HEAD）

下列是读仓结论，实施时仍须用第 4 节命令复证，不得把假设写成已修。

### 3.1 谁在什么进程 `require` grpc

| 位置 | 事实 |
|------|------|
| `package.json` `dependencies` | `"@grpc/grpc-js": "^1.14.4"`（lock 钉 `1.14.4`） |
| **唯一生产 import 点** | 三处（`loop/B` @ `a48a0c5` `rg` 2026-09-05）：`src/vs/platform/universeAgent/node/grpc/grpcClient.ts`（L6）、`grpc/grpcClientCalls.ts`（L6）、`universeAgentChannel.ts`（L6）— 均为 `import * as grpc from '@grpc/grpc-js'`；无 `require()` / side-effect import |
| 服务实现 | `node/universeAgentConnectionService.ts` → `createGrpcUniverseAgentClient` / `createPinnedGrpcUniverseAgentClient` |
| **桌面宿主** | `src/vs/code/electron-main/app.ts` 将 `UniverseAgentConnectionService`（`electron-main/universeAgentMainService.ts`，继承 node 实现）`SyncDescriptor` 进 `IUniverseAgentConnection`。主进程加载该装配即静态 `require('@grpc/grpc-js')`。**构造服务 ≠ Dial**；Dial / `connect` / `connectProfile` 是用户或 Connection 流程之后的事。 |
| renderer | `workbench.desktop.main.ts` 只 import `electron-browser/universeAgentConnectionService.ts`：`registerMainProcessRemoteService`，**无** `@grpc/grpc-js` |
| Web | `workbench.web.main.ts` → `browser/universeAgentConnectionService.ts` 的 `WebUniverseAgentConnection`（`unsupported_environment`），**无** grpc |
| 分层门禁 | [ADR-003](../decisions/003-engine-adapter-boundary.md)：renderer 禁 import `platform/universeAgent/node/**`；`universeAgentImportBoundaries.test.ts` 扫 workbench / sessions 生产文件 |

`deviceGrant/tls-pin.ts` 注释写「sole `@grpc/grpc-js` import site」，与 HEAD 不符：该文件**不** import grpc；真正 import 是 `grpcClient.ts` + `grpcClientCalls.ts` + `universeAgentChannel.ts`。不要按注释当加载点。

因此：隔离 `code.sh` 若报 `@grpc/grpc-js` 缺失，工作台往往**开不了窗**——这是运行时/打包缺陷，不是 Settings CSS 目视债。D20 活窗（产物载体）以前必须先让主进程能解析该模块。开发态 `code.sh` / `launch.sh` 仍红另记 D17，见 §5.3。

### 3.2 开发态 vs gulp 产物（机制差，待产物复证）

| 路径 | 机制 |
|------|------|
| 开发态 `scripts/code.sh` | `VSCODE_DEV=1`，启动 `.build/electron/${product.applicationName}`（Linux 读 `product.json` `applicationName`，HEAD = `universe-agent-studio`），**应用根是仓根 `.`**。`node_modules` 即仓内安装树。 |
| 打包桌面 | `build/gulpfile.vscode.ts` `packageTask`：`getProductionDependencies(root)` = `npm ls --all --omit=dev --parseable`，再 `cleanNodeModules(.moduleignore` + `.moduleignore.${process.platform}`——注意是**构建机** platform，不是目标 platform），`createAsar(..., unpack: ['**/*.node', …])` 打进 `node_modules.asar` / `node_modules.asar.unpacked`。Linux 分支 `gulp.src('resources/linux/code.png')` **无 `allowEmpty`**：该文件缺失时 gulp 直接失败（HEAD 上文件存在，见 §4.0）。 |
| 打包输出目录 | `buildRoot = dirname(repo)`，`destinationFolderName = VSCode-linux-x64` → **仓外** `../VSCode-linux-x64/`（本机即 `/home/clarence/Projects/Agents/VSCode-linux-x64`）。Linux 可执行文件名为 `applicationName`。 |
| 打包时 JS 依赖如何进主进程 | `build/lib/optimize.ts` esbuild `packages: 'external'`——`@grpc/grpc-js` **不会打进 bundle**，运行时必须从产物 `node_modules.asar` 解析。 |

`.moduleignore` **没有** `@grpc` 专条；`.moduleignore.linux` 只剥 Windows native 包。`createAsar` 已对所有 `**/*.node` unpack。桌面 gulp **没有** 类似 `ensureCopilotPlatformPackage` 的 grpc 补拷——若 `npm ls --omit=dev` 漏掉该包或其传递依赖，产物会缺，开发态却可能仍能从完整 `node_modules` 启动。

### 3.3 lock 里 grpc 树（先当线索，不当 native 已存在）

`package-lock.json`：`@grpc/grpc-js@1.14.4` 依赖 `@grpc/proto-loader`、`@js-sdsl/ordered-map`；`proto-loader` 再拉 `protobufjs`、`yargs`、`long`、`lodash.camelcase`。**lock 未声明 `.node` addon**。根 `package.json` `allowScripts["protobufjs@7.6.5"] = false`（[connection-hub-client R4](connection-hub-client.md) 已点名，当时推给 M6-A1）。

**不要预设「必须有 native」。** 第 4 节先 `find` 证实；无 `.node` 则验收改为「JS 包进 asar + 主进程可 load」，禁止为不存在的 addon 改 gulp。

### 3.4 Web / server 入口（排除面）

| 入口 | gulp 任务（动态名） | 依赖根 | UA 接线 |
|------|---------------------|--------|---------|
| 桌面 | `vscode-linux-x64`（见 §3.5） | 仓根 `package.json`（含 `@grpc/grpc-js`） | electron-main |
| Web | `vscode-web`（`gulpfile.vscode.web.ts`） | `remote/web/package.json`——**无** `@grpc/grpc-js` | `workbench.web.main.ts` → browser stub |
| REH / server | `vscode-reh-<platform>-<arch>`（`gulpfile.reh.ts`，`type === 'reh'`） | `remote/package.json`——**无** `@grpc/grpc-js` | 不装配 electron-main UA 宿主 |

排除验收看这两份 `package.json` + 对应产物 `node_modules` / asar **零** `@grpc/grpc-js`，而不是只扫源码 import。

### 3.5 gulp 任务名是否存在

**存在。** `build/gulpfile.ts` glob `gulpfile.*.ts`；`gulpfile.vscode.ts` `BUILD_TARGETS` 含 `{ platform: 'linux', arch: 'x64' }`，任务名为：

`vscode${dashed(platform)}${dashed(arch)}${dashed(minified)}` → **`vscode-linux-x64`**（另有 `vscode-linux-x64-ci`）。

linux 安装包任务在 `build/gulpfile.vscode.linux.ts`（由 `gulpfile.ts` 一并 glob 加载）：

- `vscode-linux-x64-prepare-deb` / `vscode-linux-x64-build-deb`（`build-deb` 调 `fakeroot dpkg-deb`）
- `vscode-linux-x64-prepare-rpm` / `vscode-linux-x64-build-rpm`（`build-rpm` 调 `rpmbuild`）
- `vscode-linux-x64-prepare-snap` / `vscode-linux-x64-build-snap`（`snapcraft`）

`prepare-*` 读仓外 `../VSCode-linux-x64`，须先有桌面产物。prepare 产出的是 **准备树**，不是 `.deb` / `.rpm` / snap；**prepare 树 ≠ 进包**。

## 4. 先证实，再改 gulp 文件列表

实施顺序锁定。**未完成 4.1–4.3 禁止改** `.moduleignore` / `createAsar` unpack / `packageTask` 的 `dependenciesSrc`。§4.0 与 4.1–4.2 同属 P0，可并行；品牌源缺失走 I3a / D17，**不是**改 grpc gulp 清单的理由。

### 4.0 品牌源待证（P0）

起草时**不得**把「I3a 代码已落」写成源文件仍在。**2026-09-04 复核：`resources/linux/code.png` 在仓；`resources/linux/icons/hicolor/` 目录存在但为空**（八档 PNG 是生成物，未入仓）。`build/brand/generate-icons.mjs` 的落点是 `hicolor/${size}x${size}/apps/universe-agent-studio.png`（freedesktop 目录名 `NxN`），且它依赖 `build/brand/node_modules/sharp`，缺则 exit 1 不写 PNG。P0 必须先跑：

```bash
test -f resources/linux/code.png
for sz in 16 24 32 48 64 128 256 512; do
  test -f "resources/linux/icons/hicolor/${sz}x${sz}/apps/universe-agent-studio.png" \
    || echo "MISSING hicolor ${sz}x${sz}"
done
```

| 结果 | 含义 |
|------|------|
| `code.png` 与八档 hicolor 均在 | 源待证通过；后续 prepare 树 / 成包才能谈「进树 / 进包」 |
| hicolor 任一缺失（HEAD 预期如此） | **先跑 I3a**：`npm --prefix build/brand install && node build/brand/generate-icons.mjs`（见 [product-identity I3a](product-identity.md)），再复检。`hicolor/<N>/`（无 `x`）目录**不算**——`gulpfile.vscode.linux.ts` 会原样打进 prepare 树但桌面环境不识别。仍缺 → 记 [D17](../progress/deferred-gaps.md) |
| `code.png` 缺失 | 同上先 I3a；否则 `gulp vscode-linux-x64` 会在 `gulp.src` 处直接失败，黄金路径不可开 |

**禁止**把品牌源缺失写成 D18「环境不足」并假闭。缺的是仓内源，不是 `fakeroot` / `rpmbuild` / 跨平台工具。

### 4.1 开发态：模块是否真的在仓内

在**将要打包的那棵树**（有 `node_modules` 的工位）：

```bash
test -d node_modules/@grpc/grpc-js
node -e "require('@grpc/grpc-js'); console.log('ok', require.resolve('@grpc/grpc-js'))"
find node_modules/@grpc node_modules/protobufjs -name '*.node' 2>/dev/null || true
```

| 结果 | 含义 |
|------|------|
| `require` 失败 | 先 `npm install`；仍失败才是依赖声明问题，**不是** gulp 清单 |
| 无 `.node` | 与 lock 一致；后续「native 进包」条款标 N/A，只验 JS 树 |
| 有 `.node` | 记下相对路径，4.3 / 5.2 必须在产物 `node_modules.asar.unpacked` 见到 |

对照：`scripts/code.sh` 是否仍报缺失。若仓内 `require` 已绿而隔离 launch 仍红，记启动命令、`VSCODE_DEV`、`--user-data-dir`、工位路径——可能是 launch 指到另一棵无 `node_modules` 的树，仍先证实再改 gulp。该红记 D17；**不**挡 §5 产物路径上的 D20。

### 4.2 production 依赖图是否含 grpc

```bash
# 首选（与 getProductionDependencies 同一条命令）：
npm ls --all --omit=dev --parseable | rg 'grpc|protobufjs|proto-loader'
# 备选（直接调 build/lib）：仓根 node 没开 strip-types，须显式加旗
node --experimental-strip-types -e "import('./build/lib/dependencies.ts').then(m => console.log(m.getProductionDependencies(process.cwd()).filter(p => /grpc|protobufjs|proto-loader/.test(p)).join('\n')))"
```

`getProductionDependencies` 失败或列表无 `node_modules/@grpc/grpc-js` → 查 `dependencies` vs `devDependencies`、lock、`npm ls` ELSPROBLEMS。此时改 gulp 文件列表**无效**。

### 4.3 打一次真实桌面包并扫产物

```bash
# 任务名已核实存在；首次全量耗时长，属预期
npm run gulp vscode-linux-x64
```

产物根：`dirname($REPO)/VSCode-linux-x64`。至少检查：

```text
$PRODUCT/universe-agent-studio
$PRODUCT/resources/app/package.json
$PRODUCT/resources/app/node_modules.asar
$PRODUCT/resources/app/node_modules.asar.unpacked/   # 仅当有 .node
```

用仓内已装的 `asar` 包（`package.json` devDependencies，不是 `@electron/asar`）`npx asar list` 列出 asar 内是否含：

- `node_modules/@grpc/grpc-js/package.json`
- `node_modules/@grpc/proto-loader/package.json`（若 4.2 图里有）
- 4.1 记下的每个 `.node`

目录包里的 `resources/linux/code.png` 是桌面产物资源，仍须 `test -f`；**不是** deb/rpm 进包证据。

**缺包** → 才允许改 gulp（候选锚点，改前仍须对照 4.1/4.2 的缺口）：

1. `build/gulpfile.vscode.ts` `packageTask` 的 `dependenciesSrc` / `createAsar` unpack 列表；
2. `build/.moduleignore` 是否误剥 `@grpc/**` 或 `protobufjs` 运行所需文件（`**/*.ts` 只剥 TS，一般应保留其 `build/*.js`）；
3. 仅当 `npm ls` 含包但 vinyl glob 漏拷时，才加显式 `gulp.src`（对标 `ensureCopilotPlatformPackage`，**不要**无证据抄一份）。

改完必须重跑 `vscode-linux-x64` 并重复本小节扫描。只改源码注释或 D20 CSS **不算**本方案缺陷修复。

### 4.4 开发态仍缺、产物却绿

这本身就是 §5.3 第 2 条要求的「根因」：写明工位 `node_modules` / launch `--repo` 指错，修复是安装依赖或改正启动树，不是 gulp。根因写清后 D20 可按 §5.3 关闭；根因不明则 D20 保持 open 并记 D17。

## 5. Linux x64 黄金路径（D20 关闭载体 = 产物 + 隔离 profile）

`.claude/skills/launch/scripts/launch.sh` 走 `scripts/code.sh` + `.build/electron`，**不能**代替产物启动，也**不是** D20 关闭载体。黄金路径必须打产物二进制。

### 5.1 启动

```bash
PRODUCT="$(dirname "$REPO")/VSCode-linux-x64"
UDD="$(mktemp -d /tmp/ua-pack-udd-XXXX)"
EXT="$(mktemp -d /tmp/ua-pack-ext-XXXX)"
"$PRODUCT/universe-agent-studio" \
  --user-data-dir="$UDD" \
  --extensions-dir="$EXT" \
  --disable-workspace-trust
```

不要用仓内 `~/.vscode-oss-dev` 或 `universe-agent-studio-dev` 当本步 profile（避免和开发态 secret 混读；I5 不在范围）。需要 CDP 时另加工作台 remote-debugging 口，**不要**把 launch.sh 的 `--repo` 指到产物目录假装开发态。

### 5.2 断言 grpc 可 load（require，不是 Dial）

启动成功（窗起来、主进程未因 `Cannot find module '@grpc/grpc-js'` 退出）即强证据：主进程已 `require('@grpc/grpc-js')` 并构造 `UniverseAgentConnectionService`。**不**要求 Dial / `connect` / 引擎握手。此外至少做一项：

- 主进程 / `ELECTRON_RUN_AS_NODE` 在**产物** `resources/app` 上下文 `require('@grpc/grpc-js')` 成功；或
- Connection pane Direct Address 能走到「缺引擎 / pairing」等**业务**失败，而不是模块解析失败（引擎本身见 [debug-engine](../../docs/guides/debug-engine.md)，本方案不要求接通）。

### 5.3 顺带 D20（CS-6 300px）

**D20 关闭 = 两件事同时成立**（签收裁定，见 §1.5）：

1. **300px 活窗证据**：载体可以是仓外 `VSCode-linux-x64` 产物二进制 + 本节隔离 profile，**也可以**是修好后的开发态 `launch.sh`；任一即可。
2. **D20 原始失败已根因**：deferred-gaps D20 行记的是「本机隔离 launch 因 `@grpc/grpc-js` 缺失未能开窗」。关闭记录里必须写明该缺失的原因（§4.1 / §4.4：工位无 `node_modules`、`--repo` 指错、或真的依赖声明 / 打包问题）与处置。只换产物载体、让开发态继续红而不解释，**不算**关闭。这条同时是 [prd-008-engine-e2e](prd-008-engine-e2e.md) P-GRPC 的前置。

同一活窗：打开默认窗 Settings → Client 相关组 → 缩到约 300px。

| 断言 | 来源 |
|------|------|
| 搜索框可见，未被 `display:none` | D20 / `uaClientSettingsChrome.css` |
| Client 组标题可见 | 同上 |
| 七组无 `emptyCopy` | [client-settings CS-6](client-settings-completion.md) |

截图 + 命令 + SHA 写入 `dev/progress/` 证据目录（新建即可，本方案不规定目录名以外的索引卫生）。**失败记 D17，不得把 D20 标 closed。** 代码完成线已落，本步只补活窗。

`scripts/code.sh` 或 `launch.sh` 若仍红且根因未明：D20 **保持 open**，D17 记「开发态 grpc 缺失待根因」。两条启动树分开记账，但 D20 的关闭同时要求两条都有交代（§5.3 第 2 条）。

## 6. 进包清单

桌面 `VSCode-linux-x64` **必须**：

| 项 | 规则 |
|----|------|
| `@grpc/grpc-js` | asar 或 unpacked 中有可 `require` 的入口 |
| 4.2 图上的传递依赖 | 至少 `@grpc/proto-loader`（及 lock 实树）；缺则主进程 load 仍可能炸 |
| `.node` | **仅当 4.1 证实存在**：须在 `node_modules.asar.unpacked`，且未被 `.moduleignore.linux` 剥掉 |
| Web `vscode-web` 产物 | 无 `@grpc/grpc-js` |
| REH `vscode-reh-linux-x64`（本机可跑则跑；本方案**不**把打 REH 包当作 D18 closer） | 无 `@grpc/grpc-js`。静态下限：`remote/package.json` / `remote/web/package.json` 保持无该依赖 |

本方案**不要求**为排除面再打一份完整 `vscode-web`（耗时大）。Web 依赖根静态检查是排除面下限，失败记 D17，不得假称「已排除进包」。静态检查**不够**当 D18（Linux 子集）完成；D20 按 §5.3 两条同时成立关。**§1.3「钉死排除清单」的可落地下限就是这两份依赖根静态检查**；产物扫描是加分项，不是本稿门槛。

## 7. D18：拆成 Linux 子集（本稿可关）+ 新 D 行（Win/mac/snap，open）

[D18](../progress/deferred-gaps.md) **原文** closer 是：V 槽确认八档 hicolor **进包**，Win/mac 检查 ico/bmp/icns 与 exe/plist 元数据（三平台安装包）。[product-identity I3b](product-identity.md) 已把 hicolor 进 deb/rpm gulp、改 `electron.ts` 公司名/HelpBook。

**签收裁定：不在本稿内「改写」D18 的退出条件，而是在 deferred-gaps 表内把它拆成两行：**

| 行 | 内容 | 谁关 |
|----|------|------|
| **D18**（改写为 Linux 子集） | `vscode-linux-x64` 目录包 + `prepare-deb`（建议 `prepare-rpm`）八档 hicolor 进树 + 本机能做的 `build-deb` / `build-rpm` 成包检查 | 本稿 P3 / P4 |
| **新 D 行**（取下一空号；D21 已被 m7-gap-closeout 预留） | 原文的 Win（ico/bmp、exe 元数据）/ mac（icns、plist）/ snap installer 验证 | 环境不足（非 Linux、无 Inno / osx 工具链）；open，归 D12 / I6 线 |

拆分让读者在表内仍能看到原退出条件的全部内容，而不是「新合同」把 Win/mac 隐进脚注。禁止把「Linux 目录包 + prepare 树」标成原文三平台已验。

**Linux 本机可做的：**

| 步骤 | 命令 / 检查 | 缺工具时 |
|------|-------------|----------|
| 桌面目录包 | `gulp vscode-linux-x64`；二进制名 = `universe-agent-studio`；产物内 `test -f` `resources/linux/code.png`（§4.0 源须已待证通过） | 不可豁免（本机 Linux x64 黄金路径） |
| prepare 树 | `prepare-deb` 应跑；建议加 `prepare-rpm`。列目录确认 `.build/linux/deb/amd64/.../usr/share/icons/hicolor/**` **八档进树**。**注意 `prepare-deb` 不只是拷文件**：`gulpfile.vscode.linux.ts` → `getDependencies` 会拉 Azure sysroot（`install-sysroot.ts`）并调 `dpkg-shlibdeps`（需 `curl` / `perl` / `dpkg-dev`），依赖列表与 `dependencies-generator.ts` 硬编码不一致时直接 throw | 不需要 fakeroot，但需要网络 + `dpkg-dev`。sysroot 下载失败或 shlibdeps 缺失 → 记 **环境不足 + 具体失败步骤**（不是「prepare 已过」） |
| deb 成包 | `gulp vscode-linux-x64-build-deb`（`fakeroot dpkg-deb`）。只有打开 `.deb` / 安装后的包内容，才能写「hicolor 进包」 | 无 `fakeroot` 或 `dpkg-deb` → 记 **环境不足**（缺哪条命令）。prepare 树已验 **不算** 进包 |
| rpm 成包 | `prepare-rpm` 应跑；`build-rpm` 需 `rpmbuild`。同样：只有成包后才写「进包」 | 无 `rpmbuild` → **环境不足**，不写「rpm 已发行 / 已进包」 |
| snap / Inno / Darwin | 本机无 `snapcraft` / Windows / macOS 则整段 **环境不足** | **不得**用目录包或 prepare 树冒充 installer；**不得**据此关 D18 原文三平台退出 |

**本稿可以把（拆分后的 Linux 子集）D18 标 closed，当且仅当同时满足：**

1. deferred-gaps 表已完成拆分：D18 行改写为 Linux 子集，新 D 行承接 Win/mac/snap 并标 open；
2. `vscode-linux-x64` 已跑，且 §5 能从产物 + 隔离 profile 启动（require 通过即可，不要求 Dial）；
3. `prepare-deb`（建议加 `prepare-rpm`）已跑通（含 sysroot / shlibdeps），八档 hicolor **在 prepare 树**（写「进树」，禁止写「进包」）；
4. 本机能做的 `build-deb` / `build-rpm` 已做并检查成包；做不到的在 D18 行或证据写明 **环境不足 + 具体失败命令**，且明确 **未进包**；
5. 未把 I6 占位包标成发行物。

**禁止：**

- 不拆行、直接在 D18 原行上用「环境不足」把 Win/mac 部分带过。
- 把 prepare 树有八档写成「hicolor 已进包」。
- 把 §4.0 品牌源缺失（应跑 I3a 或记 D17）写成 D18 环境不足并假闭。
- 未跑 `vscode-linux-x64` 时用「代码已接线」关 D18。
- 把 sysroot 下载 / `dpkg-shlibdeps` 失败写成「prepare 已过」。

I6 字段不在本方案改（`darwinBundleIdentifier` / Appx Publisher）；保持 [product-identity I6](product-identity.md)。

## 8. 切片

| 切片 | 内容 | 可改 | 禁止 |
|------|------|------|------|
| P0 证实 | §4.0 品牌源待证（`test -f resources/linux/code.png` + 八档 hicolor）+ §4.1–4.2：仓内 require、`.node` 扫描、`getProductionDependencies` | 只记证据（进度文件）；**不改 gulp**。源缺失：先 I3a 或记 D17 | 未证实就改 ignore / asar；源缺失当 D18 环境不足假闭 |
| P1 黄金路径 | `gulp vscode-linux-x64` + §5 产物启动 + grpc `require` + Settings 300px | 仅当 P0/产物扫描证明缺包：`gulpfile.vscode.ts` / `.moduleignore*` | 改 UA 协议、renderer 引入 grpc、改 CS-6 产品行为来「躲」开窗；把 require 写成必须 Dial |
| P2 排除面 | `remote/package.json`、`remote/web/package.json`、可选 `vscode-web` 扫描 | 若误把 grpc 写进 remote 依赖则删回；Web 装配保持 browser stub | 为「对称」把 grpc 加进 REH |
| P3 D18 Linux 子集 | `prepare-deb`（含 sysroot / shlibdeps）/ 能做的 `build-deb\|rpm`；缺工具写环境不足 + 具体失败命令且 **未进包** | `gulpfile.vscode.linux.ts` 仅当 hicolor/包名未进 **prepare 树**（对照 I3b 已落代码，先证实再改） | 无工具却标 installer 已验；prepare 树写成进包；不拆行就关 D18；动 I6 |
| P4 收口 | deferred-gaps：D18 拆行（Linux 子集 + 新 D 行）；D18 Linux 子集按 §7 关；D20 按 §5.3 两条关；开发态缺失根因写入 D20 关闭记录；本方案 status | `deferred-gaps.md`、本文件 `updated`、[plans/INDEX.md](INDEX.md) 摘要（去掉「顺带闭合 D18/D20」） | 把 PRD-010 / product-identity 升 `implemented`；换载体绕开开发态根因 |

P0 → P1 串行；P2 可与 P3 在 P1 产物存在后并行。P4 最后。

## 9. 验收

1. **P0 记录齐全**：§4.0 `code.png` + 八档 hicolor 待证结果（缺失则 I3a 或 D17）；仓内 `require` 结果、是否有 `.node`、`npm ls --omit=dev` 是否含 `@grpc/grpc-js`。
2. **`gulp vscode-linux-x64` 退出 0**，仓外 `VSCode-linux-x64/universe-agent-studio` 存在。
3. **产物内**能解析 `@grpc/grpc-js`；有 `.node` 则 unpacked 可见。
4. **隔离 profile 从产物启动**成功（`require` 通过、窗起来）；Settings ≈300px 满足 §5.3 第 1 条；**且**开发态 `launch.sh` 缺 grpc 已根因（§5.3 第 2 条）→ **D20 closed**。根因不明 → D20 open + D17。
5. Web/REH **依赖根**无 `@grpc/grpc-js`；可选产物扫描。
6. **D18** 已在 deferred-gaps 拆行；Linux 子集按 §7 关闭；新 D 行（Win/mac/snap）open 且标环境不足。prepare 树只写进树。I6 仍 open。
7. 任何红：D17 记 SHA、场景、baseline/新增、owner；**不**进 `status.md` Blockers。
8. 若改了 gulp 清单：同一 SHA 的产物复扫通过，才写「打包缺陷已修」。只跑通开发态 `code.sh` **不够**闭 D18，也**不够**闭 D20。

## 10. 与 PRD-010 / product-identity 的边界

| 文档 | 本方案做 | 本方案不做 |
|------|----------|------------|
| [PRD-010](../../docs/product/requirements.md#prd-010-产品身份) | 为验收 1 的「安装产物」提供 **Linux x64 目录包 + prepare 树 + 能做的 deb/rpm 检查** 证据 | 不升 `implemented`（还缺 I6、跨平台发行、商店） |
| [product-identity](product-identity.md) | 承担其 §7「测试/打包由 V 槽并行」里 **Linux 真包 + D18 Linux 子集**；失败走 D17 | 不重开 I2–I5 字段/图标生成（§4.0 缺失除外：可跑 I3a 或记 D17）；不完成 I6 |
| I3a | P0 源缺失时重跑生成脚本或记 D17 | 不把「源仍在」当已证 |
| I3b | 复用已接线的 hicolor / desktop / `electron.ts` 元数据 | 不把 I3b 代码完成线当 D18 已验；不把 prepare 树当进包 |
| D12 | 不关 | 产品身份总行仍等 I1–I5 + 可识别发行面；Win/mac/snap/I6 剩余在**新 D 行**与本行下 open。本稿只关拆分后的 D18 Linux 子集 |
| PRD-019 / D15 | 只保证 Web **不进** grpc 运行时 | 不跑 W1 冒烟 |
| PRD-026 / CS-6 | 只补 300px 活窗（D20，产物+隔离 profile） | 不改 9 键闭集；不把开发态 launch 绑进 D20 |

`product-identity` 保持 `accepted`。本方案已签收 `accepted`；实施中不把本文升 `implemented`，除非 §9 全过。

## 11. 失败与缺陷判定

- **验证失败**（启动红、300px 不符、prepare 树缺图标、§4.0 源缺失未处理）→ [D17](../progress/deferred-gaps.md) 分项。D20 保持 open（除非 §5.3 两条同时成立）。D18 Linux 子集未满足 §7 则保持 open。
- **打包缺陷** = 4.2 图有包，但 4.3 产物没有、或主进程 `Cannot find module '@grpc/grpc-js'`。修复 = gulp / moduleignore / asar，并重跑黄金路径。
- **环境不足** ≠ 缺陷修复，也 ≠ 按原文三平台假闭。写清缺 `fakeroot` / `dpkg-deb` / `rpmbuild` / `snapcraft` / 非 Linux OS。Win/mac/snap 环境不足 **仍 open 于 D12/I6**。
- **品牌源缺失** ≠ 环境不足（§4.0 → I3a 或 D17）。
- **开发态缺 node_modules** ≠ 打包缺陷（§4.4）；也 ≠ D20 未闭（D20 看产物）。
- **未 Dial 引擎** ≠ 启动失败。本方案启动线只断言 `require`。

## 12. 开放项

- 规则 16 两轮审查已改入（见文末）；`status` 已 `accepted`。
- [plans/INDEX.md](INDEX.md) 已有本方案行；P4 时把摘要「顺带闭合 D18/D20」改为「D20 + D18 Linux 子集」。
- `@grpc/grpc-js` 是否在目标 Electron/Node ABI 下需要未写入 lock 的可选 native：以 §4.1 `find` 为准。
- 仓外 `VSCode-linux-x64` 不进本仓 git；证据只引用路径与 SHA，不提交产物。
- D18 拆行与 Linux 子集收口时改 [deferred-gaps.md](../progress/deferred-gaps.md)（规则 3c）：D18 行改写 + 新 D 行承接 Win/mac/snap；**实施 commit（P4）才改**，本稿不改该文件。
- 与 [prd-008-engine-e2e](prd-008-engine-e2e.md) 的关系：P-GRPC 共享。GC-1b 改 `universeAgentConnectionService.ts` 时，§3.1 的 import 点结论须在 P0 复证（`rg "from '@grpc/grpc-js'" src/vs`），不抄本稿。
- 与 [giant-file-split](giant-file-split.md) GFS-1 的关系：@ `loop/B` `a48a0c5` 经 `rg` 复证生产 import 点为三处（`grpcClient.ts`、`grpcClientCalls.ts`、`universeAgentChannel.ts`）；§3.1 已回写，打包机制不变（esbuild `packages: 'external'`）。

## 13. 审查记录（规则 16）

**2026-09-04 第一轮：** 只读 reviewer（Cursor Task `generalPurpose` / inherit）。**Assessment：Approve with changes**。Critical：无。父 agent 核验后当轮改入全部 Important。当时 `status` 仍 `draft`；签收见第二轮。

| 级别 | 意见 | 本稿处理 |
|------|------|----------|
| Critical | — | 无 |
| Important | D18 退出须改写成新合同：Linux 本机可做目录包 + prepare 树 + 能做的 deb/rpm；Win/mac/snap/缺工具 = 环境不足，仍 open 于 D12/I6。禁止按原文三平台退出标 closed。prepare 树 ≠ 进包 | 改入 §1.4 / §3.5 / §6 / **§7 整节重写** / §8 P3–P4 / §9.6 / §10 D12 行 / §11 |
| Important | D20 关闭载体 = 产物 + 隔离 profile；`code.sh` / `launch.sh` 若仍红记 D17；D20 closed 不表示开发启动已通 | 改入 §1.5 / §4.4 / **§5 标题与 §5.3** / §8 P4 / §9.4 / §10 CS-6 行 |
| Important | P0 增加 `test -f resources/linux/code.png` + 八档 hicolor；缺失先跑 I3a 或记 D17，禁止当 D18 环境不足假闭。「源仍在」改成待证 | 改入 **§4.0**、§8 P0、§9.1、§7 禁止条、§10 I3a 行 |
| Important | 启动触发改成「启动即 `require('@grpc/grpc-js')`」，不是「启动就 Dial 引擎」 | 改入触发段、§1.2、§2、§3.1、§5.2、§9.4、§11 |

Minor 未列，不阻塞。

### 第二轮：对抗性审查（Cursor CLI `cursor-grok-4.6-high`，只读）+ 架构裁定 + 签收（2026-09-04）

Reviewer 判 **Reject**（4 Critical）。父会话逐条复核：`generate-icons.mjs` 落点 `NxN` 属实；`resources/linux/code.png` **在仓**（reviewer 说「仓内无」有误），hicolor 八档确实未入仓且生成器依赖 `build/brand/node_modules/sharp`；D18 / D20 降格属实；`prepare-deb` 走 sysroot + shlibdeps 属实。改入后签收。

| 级别 | 意见 | 处理 |
|------|------|------|
| **C1** | P0 hicolor 路径 `hicolor/${sz}/` 与生成器 `hicolor/${size}x${size}/` 互斥；按字面 I3a 成功仍 MISSING，或为过 P0 造错目录仍能勾「进树」 | §4.0 改为 `NxN`；写明 `hicolor/<N>/` 不算 |
| **C2** | D20 SSOT 记的失败是开发态隔离 launch，本稿换成产物载体即可 closed，原失败仍红 | §1.5 / §5.3 / §9.4：D20 关闭 = 300px 活窗（任一载体）**且**开发态缺失已根因；不得换载体绕开 |
| **C3** | 「D18 新合同」在别的 ticket 里降格 SSOT 退出条件，Win/mac 隐进脚注 | §7 改为在 deferred-gaps **拆行**：D18 → Linux 子集；新 D 行承接 Win/mac/snap（open，环境不足）。原退出内容表内可见 |
| **C4** | 品牌栅格无生产路径：hicolor 未入仓、生成器需 sharp、`gulp.src(code.png)` 无 `allowEmpty` | §4.0 补 `npm --prefix build/brand install`；写明 `code.png` 在仓、hicolor 缺；§3.2 补 `allowEmpty` 事实。「仓内无 code.png」不采纳（`ls` 可见） |
| I1 | `prepare-deb` 需 sysroot 下载 + `dpkg-shlibdeps`（curl/perl/dpkg-dev），不是「不需要 fakeroot 即可」 | §7 prepare 行改口；环境不足须写具体失败步骤 |
| I2 | §4.2 `import('./build/lib/dependencies.ts')` 无 strip-types 旗会红 | 首选 `npm ls`；备选加 `--experimental-strip-types` |
| I3 | §12「未写入 INDEX」为假 | 改口；P4 改 INDEX 摘要 |
| I4 | §1.3「钉死排除」与 §6「只扫两份 package.json」不一致 | §6 写明依赖根静态检查即是 §1.3 的可落地下限 |
| I5 | 与 prd-008 P-GRPC、GC-1b 改 connectionService 无顺序声明 | §12 补两条关系；GFS-1 拆出 `grpcClientCalls.ts` 后 import 点复证 |
| I6 | `.moduleignore.${platform}` 实为 `process.platform` | §3.2 改口 |
| Minor | `asar` 不是 `@electron/asar`；lock 无 `.node` | §4.3 改口；native 专章保留为「先证实」不删 |

**架构裁定：** 拆 D18 而不是「新合同」；D20 双条件。**签收（2026-09-04）：** `status` → `accepted`。实施顺序：P0（只读证实，可立即在有 `node_modules` 的工位跑）→ P1（merge 槽，耗时长）→ P2 ∥ P3 → P4。
