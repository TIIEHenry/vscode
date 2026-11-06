---
title: "测试与校验"
type: concept
status: accepted
phase: N/A
updated: 2026-11-02
summary: "官方单测与五域自定义入口；Sources pending严格读取根汇总，私有短TMP避免Unix socket路径过长；焦点与真实产品窗口分别验收。"
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

Node runner的文件选择以[`test/unit/node/index.js`](../../../test/unit/node/index.js)为准：`--run`可重复指定文件，`--runGlob`按out根下的glob选文件。当前runner未把`--grep`传给Mocha，附带该参数仍会运行选中文件的完整套件；报告聚焦数量前须核实际JUnit或输出计数。需要验证某文件内补修时直接运行该文件，并保留官方`Errors`元校验，不为缩小数量临时替换Mocha执行流程。

Electron runner的[`renderer.html`](../../../test/unit/electron/renderer.html)和[`renderer.js`](../../../test/unit/electron/renderer.js)会忽略name为`Canceled`的未处理异常。因此“取消已消费”的回归须直接await动作正常resolve，并核请求次数、正文/按钮/反馈等业务状态；DOM的void动作增加局部无泄漏观察或等效的明确收尾证据。`Errors`元校验通过不能单独证明取消已被调用方处理，也不应为此修改全局runner。

跑单测前若只要新鲜输出文件，用 `npm run transpile-client`，不要先 `compile` 再仪式性 typecheck。

### 本地自定义五域与严格报告比较

[`scripts/run-unit-custom.sh`](../../../scripts/run-unit-custom.sh) 是五域完整入口；它顺序调用官方 runner，最后由 [`scripts/check-test-baseline.sh`](../../../scripts/check-test-baseline.sh) 对照 [`test-baseline-failures.txt`](../../../dev/progress/test-baseline-failures.txt)。保持以下路由，不能用单个 Electron glob 代替 Sources 两种环境的并集：

| 域 | 官方选择范围 |
|:---|:---|
| `conversation` | Electron 的 `contrib/conversation/test` 完整 glob，排除 `conversationSessionsFocus.test.js`（真实焦点用例只在 browser runner 跑，见「验证真实焦点样式」） |
| `sources` | Electron 的 `contrib/sources/test/browser` 完整 glob |
| `sourcesNode` | Node 的 `sourcesLeftoverCatchScan.test.ts`、`sourcesWiringScan.test.ts` 两个 `--run` |
| `universeAgent` | 按现有收集器保留可在 Electron 加载的全部正式文件 |
| `universeAgentNode` | 现有 17 份 Electron 不可加载 `test/node` 文件改在官方 Node runner 运行；不从门禁中丢弃 |

Sources 新增文件必须进入可识别的 browser 路由或两份明确 Node 文件，否则入口直接拒绝。两个原 UA `--print-*` 分支只打印，不清报告或启动测试。实际入口按官方 reporter 相同优先级选择结果根：`BUILD_ARTIFACTSTAGINGDIRECTORY` → `GITHUB_WORKSPACE` → 仓根；仅清理该根 `test-results/` 内五个精确域文件，清理失败即停，避免复用上轮绿色 XML。Sources Node runner 非零退出在最后比较之后仍传播，绿色 XML 不能掩盖执行失败。

五个域都按同一严格 skipped 规则处理：有效值为 `max(testcase 子节点 skipped 数, 根 skipped)`，根缺省零，存在时须完整匹配 ASCII 非负整数字符串，否则报域名并失败关闭。不累加嵌套套件，不把根 tests 数补作 testcase 数；原 min_cases、max_skipped、失败差集与 stale 名单不变。Sources 的既有 89/0、Sources Node 的59/0及其他域原阈值均保持。官方 reporter可能只在根记录 pending，不能把子节点计0当焦点通过。

比较器按现有域顺序 fail-fast：2026-11-02 未改五份正式 XML 中 Conversation根skipped5/child0（1bench+4focus pending）超过原上限1，新五域规则首先拒绝它；旧只对Sources补根的版本先拒绝Sources5>0。未执行到的后三域不能称比较器通过，Sources原件根5/子0与零上限及独立合成Sources5拒绝须分别记录。此工具规则纠正报告完整性，不修复这些pending，也不提升真实焦点或产品验收。当前工具候选的23方法/192实际subtest与真实新旧报告重放见[报告汇总方案实际记录](../../../dev/plans/test-result-skipped-summary.md#10-e-工具候选实际验证2026-11-02)；在C原基线只处理Sources两域的历史行为不回写成已执行五域比较。

在已有依赖和当前私有编译产物的工作树运行；使用 Node 24.18.0。Linux 的 `localEngineDiscovery` 用例创建 Unix socket，完整 socket 路径必须短于 108 字节。私有 TMP 用 `/sdd/tmp/sc-e-*` 这种短目录（权限 0700），不要把长工作树路径下的 `.build/task-tmp` 当 socket 临时根。XDG、缓存和报告仍放本工作树的私有 `.build`；`out` 也必须是本轮冻结输入对应的本工作树产物。以下示例创建全新报告根，编译与其他产品测试须由本聊天唯一验证者串行执行：

```bash
rtk proxy bash <<'SH'
set -eu
umask 077
export PATH="/home/clarence/.nvm/versions/node/v24.18.0/bin:$PATH"
export TMPDIR="$(mktemp -d /sdd/tmp/sc-e-XXXXXXXX)"
task_artifacts="$(mktemp -d "$PWD/.build/unit-custom-XXXXXXXX")"
export XDG_CACHE_HOME="$task_artifacts/cache"
export XDG_CONFIG_HOME="$task_artifacts/config"
export XDG_DATA_HOME="$task_artifacts/data"
export npm_config_cache="$XDG_CACHE_HOME/npm"
export BUILD_ARTIFACTSTAGINGDIRECTORY="$task_artifacts/reports"
export GITHUB_WORKSPACE="$PWD"
export VSCODE_SKIP_PRELAUNCH=1 NODE_DISABLE_COMPILE_CACHE=1 PYTHONDONTWRITEBYTECODE=1
unset NODE_COMPILE_CACHE
mkdir -p "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$BUILD_ARTIFACTSTAGINGDIRECTORY"
bash -n scripts/run-unit-custom.sh scripts/check-test-baseline.sh
python3 -m unittest discover -s scripts/tests -p test_unit_custom_sources.py -v
xvfb-run -a ./scripts/run-unit-custom.sh
SH
```

脚本回归中的 runner stub 仅证明入口/比较器控制分支；正式五域日志、XML、退出码和输入/产物摘要另存，分域通过不等于完整门禁通过。2026-11-02 的真实短 TMP 全入口结果、旧三项合同失配关闭、23 项脚本回归及继承 lint 诊断见 [Sources 方案的实际凭据](../../../dev/plans/sources-regression-contract-alignment.md#11-第五轮实际凭据与收口边界2026-11-02)，不把历史运行写成当前工作树的新通过。

### 单次隔离诊断与恢复证据

需要临时发射受限目标时，按[fixture/emitter方案§11](../../../dev/plans/conversation-visible-lease-harness-and-emitter-isolation.md#11-固定3fc单次隔离诊断及当前验收2026-10-27)分离静态准备、独立整包peer、root单次release和实际消费。冻结锚prepared0、激活五字段与consumed1分别留原件；每阶段有完整保护，实际outcome后owned quiet再依父grant/WAL限定恢复，未来包绑定当时新实际guard。已有consumed包不重跑；发射目标、old/new、phase/selection/restore或判定的扩展须新源码peer+整包peer。driver0可表示官方失败已完整记账，不能当测试或业务通过；failed-body跳过泄漏计算不能称leakfree。实际原件见[固定3fc诊断](../../../dev/progress/conversation-visible-lease-isolated-diagnostic-20261027-evidence/INDEX.md)。

业务old-red/new-full双包扩展的[主lease§12](../../../dev/plans/conversation-visible-lease-recovery.md#126-原astra正式规则16与独立accepted文档2026-10-28)已获固定a761原Astra规则16 C0/I0/M0及root采纳，独立accepted仅关闭文档门；既有单Reveal诊断合同不变，语义工具source及guard-v2实现纠正已分别获原Astra源码peer/root采纳；每包whole peer/root独立release、业务和after仍是独立门，见[当前guard-v2证据](../../../dev/progress/conversation-visible-lease-business-guard-v2-20261028-evidence/INDEX.md)。

### 验证真实焦点样式

`test/unit/electron/index.js` 默认以 `show: false` 创建窗口。元素即使是 `activeElement`，文档仍可能没有原生焦点，`:focus` / `:focus-visible` 也不会生效。不能据此测活动选中颜色、焦点环或依靠焦点显露的操作，更不能把它当成缺陷已修复。

仅对依赖真实焦点的样式用例：挂载生产 View / List / Tree 和生产 CSS，先确认目标窗口的 `document.hasFocus()`，再检查目标元素 `matches(':focus')`。隐藏 Electron 无法聚焦时可明确 `this.skip()`；该 pending 只表示环境前提不满足，必须在可聚焦的官方浏览器 runner 中零 pending 补验。本机已装 Chrome 时可用：

```bash
rtk proxy node test/unit/browser/index.js --browser chromium-chrome \
  --run src/vs/workbench/contrib/conversation/test/browser/conversationSessionsFocus.test.ts \
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


共用old/new语义工具的[2026-10-28 source-only检查点](../../../dev/progress/conversation-visible-lease-business-semantic-source-20261028-evidence/INDEX.md)已另授完成：固定actual consumed v3来源、全部语义diff/逆证与profile/schema，4个Python各一次ast.parse、5MJS/1CJS各一次Node --check，全部0且compile cache禁用。这些检查只证明语法；其后固定dfe427的[完整semantic source peer已获原AstraC0/I0/M0/root独核采纳](../../../dev/progress/conversation-visible-lease-business-semantic-peer-accepted-20261028-evidence/INDEX.md)，source工具与133证据原字节保持。本次签收不重跑syntax或任何工具；每独立包scratch/pins/输入闭包/seals/native起点/whole peer/root release、实际旧red/新完整39＋meta和非作者默认编辑器after分别待。repo内源码快照为.raw，不能直接当运行工具；三份输入.raw也是inert证明，当前未组包/捕seal或baseline。未来包须独立容量/715实际恢复lineage preflight，不能将本source目录、历史821或consumed包当fresh运行基线。

当前[guard-v2签收及prep1拒绝](../../../dev/progress/conversation-visible-lease-business-guard-v2-20261028-evidence/INDEX.md)覆盖上段当时“未组包”的停止点：old-business prep1仅静态组装，whole peer C0/I1/root拒绝并原样保留；root-inclusive修正仅source C0/I0采纳，未在原包修库存/激活。下一fresh prep2须3238行（旧2018＋557＋385＋被拒原包278），封存库存文件不等于guard覆盖底层原件。每包whole peer/root release分别签收；本轮不重复syntax或数GB closure内容哈希，定向715只声称列明路径/内容。after仅既有I候选和独立产物/共享只读责任，未reserve/ready，不能由source或历史whole-build失败推导业务/after通过。

后续[old prep2真实失败与source-v3](../../../dev/progress/conversation-visible-lease-business-consumed-v3-20261028-evidence/INDEX.md)覆盖上段当时“下一prep2待”的时点：旧prep2静态whole通过、fresh前检及单次release后，实际checker0/lint1，未到dry/emit/official或业务；quiet/空restore/ctime保持/full guard获采纳，消耗原包不重跑。v3只修固定class/PascalCase无类型消费路径的精确资格，保真实type-checking metadata/typeAware=true、实际Program proof=null，未知配置仍block。原Astra窄source peer与唯一changed-MJS syntax0/root独核只关闭source门；34关键proof文件不替完整closure，下一独立包whole peer/release和业务/after仍分别待。原P/R/source/static/syntax历史不回写，I仅静态disjoint未reserve/ready。
