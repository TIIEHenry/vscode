---
title: "打包 P0 只读证实（packaging-and-release §4.0–4.2）"
type: progress
status: in_progress
phase: packaging
updated: 2026-09-05
summary: "工位 B / loop/B：品牌源与 grpc 开发态证据已采；§4.3 gulp 未跑（P1）；22×22 hicolor 缺失且 I3a 生成器不含该档"
---

# 打包 P0 只读证实

> **方案：** [packaging-and-release.md](../plans/packaging-and-release.md) §4.0–4.2 / §8 P0。  
> **工位：** `/home/clarence/Projects/Agents/vscode-WorkTrees/B` · 分支 `loop/B`。  
> **禁止项已遵守：** 未改 gulp / `.moduleignore` / asar / 产品 chrome；未跑 `gulp vscode-linux-x64`（P1）。

## Current facts

| 项 | 结论 |
|:---|:-----|
| `resources/linux/code.png` | **存在** |
| 方案 §4.0 八档 hicolor（16/24/32/48/64/128/256/512，`NxN`） | **八档均在** |
| 工位提示八档（含 22×22） | **7/8**；`22x22` **缺失**；`generate-icons.mjs` 的 `HICOLOR_SIZES` 不含 22 |
| `build/brand/node_modules/sharp` | **缺失**（未跑 I3a 生成；方案八档已齐，无需补跑） |
| 仓内 `require('@grpc/grpc-js')` | **成功** |
| `node_modules/@grpc` / `protobufjs` 下 `.node` | **无**（`find` 空输出） |
| `npm ls --omit=dev @grpc/grpc-js` | **在树内** `@grpc/grpc-js@1.14.4` |
| production 依赖图（parseable） | 含 `@grpc/grpc-js`、`@grpc/proto-loader`、`protobufjs` 及 `@protobufjs/*` |
| `src/vs` 生产 import 点 | **2 处**（见下） |

**P0 裁定（本工位）：** grpc 开发态与 production 依赖图 **通过**；native `.node` **N/A**。品牌按方案 §4.0 **通过**；若 deb/rpm 元数据要求 22×22，属 **I3a 生成器档位缺口**（非 D18 环境不足），待扩 `HICOLOR_SIZES` 或记 D17。

---

## §4.0 品牌源

### `code.png`

```bash
test -f resources/linux/code.png
```

```
EXISTS: resources/linux/code.png
```

### hicolor（`NxN`，非 `hicolor/<N>/`）

**方案 §4.0 八档：**

```bash
for sz in 16 24 32 48 64 128 256 512; do
  test -f "resources/linux/icons/hicolor/${sz}x${sz}/apps/universe-agent-studio.png" \
    && echo "OK hicolor ${sz}x${sz}" || echo "MISSING hicolor ${sz}x${sz}"
done
```

```
OK hicolor 16x16
OK hicolor 24x24
OK hicolor 32x32
OK hicolor 48x48
OK hicolor 64x64
OK hicolor 128x128
OK hicolor 256x256
OK hicolor 512x512
```

**工位委派复核（含 22×22）：**

```bash
for N in 16 22 24 32 48 64 128 256; do
  p="resources/linux/icons/hicolor/${N}x${N}/apps/universe-agent-studio.png"
  test -f "$p" && echo "OK: $p" || echo "MISSING: $p"
done
```

```
OK: resources/linux/icons/hicolor/16x16/apps/universe-agent-studio.png
MISSING: resources/linux/icons/hicolor/22x22/apps/universe-agent-studio.png
OK: resources/linux/icons/hicolor/24x24/apps/universe-agent-studio.png
OK: resources/linux/icons/hicolor/32x32/apps/universe-agent-studio.png
OK: resources/linux/icons/hicolor/48x48/apps/universe-agent-studio.png
OK: resources/linux/icons/hicolor/64x64/apps/universe-agent-studio.png
OK: resources/linux/icons/hicolor/128x128/apps/universe-agent-studio.png
OK: resources/linux/icons/hicolor/256x256/apps/universe-agent-studio.png
```

**I3a / sharp：**

```bash
test -d build/brand/node_modules/sharp && echo "sharp: present" || echo "sharp: missing"
```

```
sharp: missing
```

未执行 `npm --prefix build/brand install && node build/brand/generate-icons.mjs`：方案八档 PNG 已在仓；且 `build/brand/generate-icons.mjs` 中 `HICOLOR_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]`，即使装 sharp 也不会生成 `22x22`。

---

## §4.1 开发态 grpc

```bash
test -d node_modules/@grpc/grpc-js
```

```
EXISTS: node_modules/@grpc/grpc-js
```

```bash
node -e "require('@grpc/grpc-js'); console.log('ok', require.resolve('@grpc/grpc-js'))"
```

```
ok /home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@grpc/grpc-js/build/src/index.js
```

```bash
find node_modules/@grpc node_modules/protobufjs -name '*.node' 2>/dev/null || true
```

```
（无输出 — 未发现 `.node` 二进制）
```

---

## §4.2 production 依赖图

```bash
npm ls --omit=dev @grpc/grpc-js
```

```
code-oss-dev@1.136.0 /home/clarence/Projects/Agents/vscode-WorkTrees/B
└── @grpc/grpc-js@1.14.4
```

（`npm warn Unknown project config` 若干，退出码 0。）

```bash
npm ls --all --omit=dev --parseable | rg 'grpc|protobufjs|proto-loader'
```

```
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@grpc/grpc-js
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@grpc/proto-loader
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/protobufjs
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@protobufjs/aspromise
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@protobufjs/base64
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@protobufjs/codegen
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@protobufjs/eventemitter
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@protobufjs/fetch
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@protobufjs/float
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@protobufjs/path
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@protobufjs/pool
/home/clarence/Projects/Agents/vscode-WorkTrees/B/node_modules/@protobufjs/utf8
```

`node_modules` **存在**（工位已 `npm install`）。

---

## 生产 import 点（`rg`，非抄表）

```bash
rg "from '@grpc/grpc-js'" src/vs
```

```
src/vs/platform/universeAgent/node/grpc/grpcClient.ts
  6:import * as grpc from '@grpc/grpc-js';

src/vs/platform/universeAgent/node/universeAgentChannel.ts
  6:import * as grpc from '@grpc/grpc-js';
```

---

## 未做（P1+）

- `npm run gulp vscode-linux-x64`（§4.3）
- 产物 asar 扫描、隔离 profile 启动、Settings 300px（§5 / D20）
- Web/REH 排除面（P2）
