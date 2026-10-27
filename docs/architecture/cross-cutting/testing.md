---
title: "测试与校验"
type: concept
status: accepted
phase: N/A
updated: 2026-10-27
summary: "单测、集成测与默认编辑器产品壳入口；焦点样式需真实聚焦浏览器，隐藏 Electron 的 pending 不算通过；何时 typecheck、valid-layers-check。"
---

# 测试与校验

权威约定：[Copilot Instructions · Validating TypeScript changes](../../../.github/copilot-instructions.md)。本页只整理**入口与选用**，不另定一套流程。

原则：按变更范围与风险选最小验证。全量构建和 typecheck 很慢，不要当收尾仪式。优先用已有编辑器 / watch 诊断，以及能盖住改动行为的针对性测试。不要仅为「做完了」再开一份 build、watch 或全仓 typecheck。

在已打开本仓库的 VS Code 窗口里：先看现有 task 输出，用已有构建/watch 任务，不要再起一份等价 shell。Agents 窗口或独立 worktree 没有 workspace task 时，再用下面的仓库命令。

## 测试种类

[test/README.md](../../../test/README.md) 把 runner 分成：

| 种类 | 位置 | 跑法 |
|------|------|------|
| **unit** | 核心单测在 `src/vs/*/test/`；基础设施在 `test/unit/` | `scripts/test.sh`（Windows：`scripts\test.bat`） |
| **integration** | `test/integration/`（含 API 测试） | `scripts/test-integration.sh`（Windows：`scripts\test-integration.bat`） |
| **smoke** | `test/smoke/` | 见该目录 README；`package.json` 有 `smoketest` |
| **sanity** | `test/sanity/` | 见该目录 README |

`package.json` 的 `npm test` **不会**执行测试，只会提示改用 `scripts/` 下的脚本。

## 单元测试与 `scripts/test.sh`

脚本头（[`scripts/test.sh`](../../../scripts/test.sh)）：保证 `node_modules`，必要时 `node build/lib/preLaunch.ts --only-electron`，然后在 **Electron** 里跑 `test/unit/electron/index.js`。可设 `VSCODE_SKIP_PRELAUNCH` 跳过预启动。

[test/unit/README.md](../../../test/unit/README.md) 核对到的用法：

```bash
./scripts/test.sh
./scripts/test.sh --dev                          # 打开 Electron 窗口以便调试
./scripts/test.sh --run <file>                   # 指定文件
./scripts/test.sh --glob '**/extHost*.test.js'   # 子集
./scripts/test.sh --debug --glob '**/extHost*.test.js'
./scripts/test.sh --coverage                     # 覆盖率写到 .build/coverage
```

Copilot Instructions 要求：尽量加针对性选择器（如 `--grep`）。

同一份 README 还记载了另外两条（`package.json` 有对应 script）：

- 浏览器单测（`common` / `browser` 层）：`npm run test-browser -- --browser chromium --browser webkit`
- Node 单测：`npm run test-node -- --run src/vs/editor/test/browser/controller/cursor.test.ts`

跑单测前若只要新鲜输出文件，用 `npm run transpile-client`，不要先 `compile` 再仪式性 typecheck。

### 单次隔离诊断与恢复证据

需要临时发射受限目标时，按[fixture/emitter方案§11](../../../dev/plans/conversation-visible-lease-harness-and-emitter-isolation.md#11-固定3fc单次隔离诊断及当前验收2026-10-27)分离静态准备、独立整包peer、root单次release和实际消费。冻结锚prepared0、激活五字段与consumed1分别留原件；每阶段有完整保护，实际outcome后owned quiet再依父grant/WAL限定恢复，未来包绑定当时新实际guard。已有consumed包不重跑；发射目标、old/new、phase/selection/restore或判定的扩展须新源码peer+整包peer。driver0可表示官方失败已完整记账，不能当测试或业务通过；failed-body跳过泄漏计算不能称leakfree。实际原件见[固定3fc诊断](../../../dev/progress/conversation-visible-lease-isolated-diagnostic-20261027-evidence/INDEX.md)。

### 验证真实焦点样式

`test/unit/electron/index.js` 默认以 `show: false` 创建窗口。元素即使是 `activeElement`，文档仍可能没有原生焦点，`:focus` / `:focus-visible` 也不会生效。不能据此测活动选中颜色、焦点环或依靠焦点显露的操作，更不能把它当成缺陷已修复。

仅对依赖真实焦点的样式用例：挂载生产 View / List / Tree 和生产 CSS，先确认目标窗口的 `document.hasFocus()`，再检查目标元素 `matches(':focus')`。隐藏 Electron 无法聚焦时可明确 `this.skip()`；该 pending 只表示环境前提不满足，必须在可聚焦的官方浏览器 runner 中零 pending 补验。本机已装 Chrome 时可用：

```bash
rtk proxy node test/unit/browser/index.js --browser chromium-chrome \
  --run src/vs/workbench/contrib/conversation/browser/conversationSessionsView.test.ts \
  --grep 'selected session text follows'
```

测量窗口与元素用 `getWindow(element)` 取得，避免多窗口下读错文档。对比度按真实层叠背景合成；主题允许图标前景与文字前景不同，分别核对配对 token 和可读性。焦点前景立即变化时，背景过渡也须核查，不能仅等过渡结束来掩盖切换瞬间的低对比。产品初始 palette 的 DOM 回归与完整主题、真实产品窗口实拍分别记录。

## 集成测试

[test/integration/browser/README.md](../../../test/integration/browser/README.md)：

```bash
scripts/test-integration.sh          # Electron
scripts/test-web-integration.sh --browser chromium   # 或 webkit；可加 --debug
```

可针对真实构建设置 `INTEGRATION_TEST_ELECTRON_PATH` 与 `VSCODE_REMOTE_SERVER_PATH`（该 README）。浏览器集成测首次需在 `test/integration/browser` 下 `npm i` 与 `npm run compile`。

## 产品壳剧本

本仓适配的产品壳是默认编辑器窗口。自动剧本、断言和证据目录见 [壳冒烟验证](../../guides/shell-smoke-verification.md) §8。入口是 `test/scenario/scenarios/editor-shell.cjs`。命令里不要加 `--agents`。

`src/vs/sessions/test/e2e` 里的 `npm test` 用 `scripts/code-sessions-web.js --mock` 打开 Sessions 网页工作台，测的是 Agents 窗口。主区域可以停在 “Connect a host to get started”。那不是编辑器窗口，也不能当作本仓产品壳联调。`scripts/test-integration.sh` 仍是上游 API / 扩展宿主集成测，同样不代替这条剧本。

## 何时 typecheck / 编译

开发用的 compile / watch **已经**对输入做 type-check。不要在 `npm run compile` 或 `npm run compile-client` 紧前面再跑一遍 `npm run typecheck-client`；选一个能覆盖所需验证的命令即可。

仅在以下情况再跑针对性 typecheck 或构建（Copilot Instructions）：对改动没有把握，且改动面宽或横切；改了构建/类型配置；或另一步验证已经报编译问题。

| 命令 | 用途 |
|------|------|
| `npm run typecheck-client` | 主源码 `src/`（`tsc --project ./src/tsconfig.json --noEmit`） |
| `npm run gulp compile-extensions` | 内置扩展 |
| `npm run typecheck`（在 `build/` 目录） | 构建工具链本身 |

Workspace task 可用时优先用 task，不要重复开进程。

## `valid-layers-check`

```bash
npm run valid-layers-check
```

对应 `package.json`：`node build/checker/layersChecker.ts && node build/checker/layersTypeCheck.ts`。

**只在改动可能影响模块分层时运行**（Copilot Instructions）。日常功能修补不必跑。分层规则正文见 [layers.md](layers.md)。

## 相关文档

- [横切索引](INDEX.md)
- [快速开始](../../guides/getting-started.md)
- [术语表](../../glossary.md)（unit test / integration test / valid-layers-check）
