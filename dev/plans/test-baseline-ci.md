---
title: "测试基线治理 + agent-ide CI"
type: plan
status: accepted
phase: N/A
updated: 2026-09-04
summary: "先按账本修/改 D16 失败使三文件基线归零；新 workflow 只跟 agent-ide，github-hosted 跑 compile / eslint / docs-health / 三域单测；门禁用失败名单差集 + 用例数下限 + skipped 不增，不恢复 valid-layers-check；签收裁定：三域新增失败挡合入"
---

# 测试基线治理 + agent-ide CI

> **问题：** 验证债已系统化。[D8](../progress/deferred-gaps.md) 把 `valid-layers-check` 豁免出集成门；[D16](../progress/deferred-gaps.md) 十五个 conversation 失败挂着；其余失败进 [D17](../progress/deferred-gaps.md)「普通失败不进 Blockers」。[D15](../progress/deferred-gaps.md) Web 冒烟、[D18](../progress/deferred-gaps.md) 安装包、[D20](../progress/deferred-gaps.md) 300px 目视没跑过。用户要的是 **D16 基线归零 + `agent-ide` 上可落地的 compile / eslint / 三域单测门禁**，门禁语义是「不新增失败」，不是「全仓全绿」。  
> **命令 SSOT：** [health-gates.md](../progress/health-gates.md)、[.github/copilot-instructions.md](../../.github/copilot-instructions.md)、[`scripts/test.sh`](../../scripts/test.sh)、根 [`package.json`](../../package.json)。  
> **现有 CI：** [.github/workflows/pr.yml](../../.github/workflows/pr.yml) 只跟 `main` / `release/*`，且 `runs-on` 指向微软 1ES self-hosted pool——本仓不能假装有该 runner。  
> **不推翻：** [health-gates](../progress/health-gates.md) 的 D8 豁免与「测试不冻结不冲突 UI 槽」。  
> **明确修改（签收裁定 2026-09-04）：** [health-gates](../progress/health-gates.md) 与 [m7-ui-completion-wave §2](m7-ui-completion-wave.md)「单测失败不挡合入」在 **三自定义域** 上改为「**新增**失败挡合入 `agent-ide`（名单加行 PR 例外）」。这是政策翻转而不是补充，切片 5 须同时改这两份文档的原句。三域之外的验证债（D15 / D18 / D20、E2E、手测、axe）仍走 D17 非阻塞。  
> **对照体例：** [m4-validation-wave.md](m4-validation-wave.md)。

## 1. 目标 / 非目标

**目标**

1. 把 [D16](../progress/deferred-gaps.md) 点名的三文件失败逐条分类并收口（过时断言改测，产品 bug 修码），使 `conversationLens` / `conversationIdentityStrip` / `conversationStubService` 三文件在 `scripts/test.sh --run` 下 **exit 0 且 skipped 数不高于基线**。D16 记的「15」是它在 `0649602d` 上的观测值，**不是合同数字**：账本行数 = 切片 0 在当前 `agent-ide` HEAD 实测的失败数；多于或少于 15 都如实记，并回写 D16 行。
2. 顺手堵住 D16 脚注的 **假绿**：[`conversationImportBoundaries.test.ts`](../../src/vs/workbench/contrib/conversation/test/browser/conversationImportBoundaries.test.ts) 用 `__dirname` 扫 `out/` 下的 `.ts`，对照 HEAD [`universeAgentImportBoundaries.test.ts`](../../src/vs/platform/universeAgent/test/common/universeAgentImportBoundaries.test.ts)（`import.meta.url` + 扫描计数；D16 正文写「FileAccess」，与现文件不符，**以源码为准**）。
3. 在 `.github/workflows` **新建**只服务 `agent-ide` 的 workflow：`compile`、`eslint`、`docs-health`（`python3 scripts/check-docs-health.py`；[docs-burden-reduction](docs-burden-reduction.md) S1 落地后再加 `generate-docs-status.py --check`——这是该方案「忘跑则红」的唯一机器调用方）、三自定义模块单测（`contrib/conversation`、`contrib/sources`、`platform/universeAgent`）。
4. 三域单测的机器门禁用 **「本次失败集合 ⊆ 已登记基线名单」+「每域用例数 ≥ 名单登记下限」+「每域 skipped 数 ≤ 名单登记值」**，不是 mocha 全绿、也不是全仓单测。

**非目标**

| 不做 | 理由 |
|------|------|
| 把 `valid-layers-check` 恢复为硬门 | [D8](../progress/deferred-gaps.md) 仍 open；红在 node/worker checker 拉入 browser 源码却未套补充类型，与三域业务无关。D8 六域全绿之前，CI **不得**加该命令 |
| 为全绿冻结 UI 主线 | 与 [health-gates](../progress/health-gates.md) / [m7-ui-completion-wave §2](m7-ui-completion-wave.md) 冲突；D15 / D18 / D20 仍欠证据，不在本稿关门 |
| 删除、`skip`、`it.skip`、或把断言改成恒真来装绿 | 那是消灭信号，不是归零。未点名的红测一律进 D17，不得事后追认「本来就该绿」 |
| 改 [.github/workflows/pr.yml](../../.github/workflows/pr.yml) 或复用其 1ES pool | 触发分支不对；本仓没有上游 `1ES.Pool=1es-vscode-oss-*` |
| 在本稿关闭 D15 / D18 / D20，或把它们写进本 CI | 用户点名「没跑过」；继续记缺口，不假装有证据 |
| 全仓 `scripts/test.sh`、E2E、smoke、copilot 扩展测 | 门禁只覆盖三自定义域 + compile + eslint |

## 2. D16 十五败：分类策略与记账

### 2.1 先跑、再分类（禁止凭记忆填 15 行）

D16 记录的是 **不含** stream-timeline S1 的 HEAD `0649602d` 上同样失败的 15 条，按文件切：

| 文件 | 条数 | D16 已写的症状簇（不是用例标题） |
|------|------|----------------------------------|
| [`conversationLens.test.ts`](../../src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts) | 11 | DOM 高度 0；codicon 选择器对不上；种子会话数 `1 !== 2` |
| [`conversationIdentityStrip.test.ts`](../../src/vs/workbench/contrib/conversation/test/browser/conversationIdentityStrip.test.ts) | 1 | 未写标题；实施时用 mocha 标题钉死 |
| [`conversationStubService.test.ts`](../../src/vs/workbench/contrib/conversation/test/browser/conversationStubService.test.ts) | 3 | 假定种子为空，实际 `untitled` 有 7 条 fixture |

切片 0 **必须**在当前 `agent-ide` HEAD 重跑并导出标题，不得把上表症状簇直接当成 15 个 `test(...)` 名。命令（本机已有 `out/` 与 `.build/electron` 时）：

```bash
./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts
./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationIdentityStrip.test.ts
./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationStubService.test.ts
```

[`scripts/test.sh`](../../scripts/test.sh) 把参数交给 Electron runner（[`test/unit/electron/index.js`](../../test/unit/electron/index.js)）。`--run` / `--glob` 见 [test/unit/README.md](../../test/unit/README.md)。Linux CI 还要 xvfb，见 §4。

### 2.2 分类树（每条只落一档）

对每一条失败，先读 **生产代码现合同**，再选档：

| 档 | 判定 | 处置 | 记 D17？ |
|----|------|------|----------|
| **A 过时断言** | 产品行为已拍板且 UI/服务与断言不一致；断言仍描述更早的种子数、选择器、相位或文案 | **只改测**：写明旧断言 → 新期望；本切片点名，不记 D17（同 [health-gates](../progress/health-gates.md)「方案逐条点名的断言替换」） | 否 |
| **B 产品 bug** | 现合同（PRD / 已落 plan / 用户可见行为）要求测所断言的行为，实现缺了或回退了 | **修码**，断言保留或只做最小同步（例如稳定 selector） | 修完即闭；修不完才进 D17 且标 `product-bug` |
| **C 夹具/布局假红** | 断言依赖真实 `offsetHeight` / 字体度量，Electron 测试窗未灌 CSS 或未 `layout`，生产路径在隔离 profile 下是对的 | **改测**为合同可观察量（class、`hidden`、`getComputedStyle` 的作者样式、role）；禁止为过测试改生产 CSS 去「画出」测试专用高度 | 否（点名后改测） |
| **D 禁止** | 删用例、`skip`、空扫、`assert.ok(true)` | 驳回 | — |

**簇 → 档的默认倾向（切片 0 跑完后可推翻，推翻须在账本写理由）：**

- **种子 `1 !== 2`：** Node `assert.strictEqual(actual, expected)` 失败文案是 `actual !== expected`。D16 的 `1 !== 2` = **实测 1、期望 2**，不是「期望写大了」。HEAD 锚点：[`conversationLens.test.ts`](../../src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts) **L582** `assert.strictEqual(stubService.getSessions().length, 2)`。默认 **B**（产品/夹具：Lens mount 路径没给出合同要求的 2 个种子）。**禁止**默认把 L582 的 `2` 改成 `1`。同目录 `starts with untitled and visualize seed sessions` 已断言 `sessions.length === 2`、`turns.length === 7`（[`conversationStubService.test.ts`](../../src/vs/workbench/contrib/conversation/test/browser/conversationStubService.test.ts)）——若 Lens 只看到 1，先查 fixture / `getSessions()` 过滤（HEAD 排除 `engine-cache`）/ mount 装配。切片 0 用失败栈才能改档，改档须写理由。
- **stub 假定空会话：** 与上条拆开。**2026-09-04 复核：`conversationStubService.test.ts` 里找不到「假定种子为空」的断言**（文件开头即断言 2 种子 + 7 turns，全部 `new ConversationStubService()`）。D16 这条症状簇**可能是过时描述**。切片 0 以实测失败栈为准：若三条失败另有原因，按实测分档并回写 D16 行文案；**不得**为了凑「症状簇」去改任何未失败的断言。`1 !== 2` **不是**这条。
- **codicon 选择器：** 先对生产 dock 按钮 class。生产已换图标 class → **A**；按钮在产品里应存在却没画 → **B**。
- **DOM 高度 0 / `offsetHeight === 22`：** 先看夹具是否 `layout`、是否挂了工作台 CSS。未灌样式导致 0 → **C**；产品把 22px bar 改掉了 → **A**（改期望为现行 token / class，不要为测锁死像素，除非某条 PRD 把 22px 写成验收）。
- **IdentityStrip 单败：** 优先核对 `PreFirst: identity strip mounts in prefirst hero…`——该用例在 **已 mount、默认 Active 种子** 之后才 `createSession()`。若透镜不因后建空会话把 strip 移进 hero，判 **B**（相位切换漏了）或 **A**（测应一开始就用空 stub mount）。切片 0 用失败栈决定，禁止两种都改。

`conversationImportBoundaries` **不计入 15**。它若空扫，按 **假绿** 单独收口（切片 2），对照 universeAgent 测：从 `import.meta.url` 解析到 `src/vs/workbench/contrib/conversation/`，并断言扫描文件数 `>=` 一个保守下限（universeAgent 对 view 树用 `>= 7`）。

### 2.3 逐条账本（强制格式）

实施切片 0 新建 `dev/progress/d16-ledger.md`（本稿只规定格式，**不预建该文件**，避免断链；写账本是实施）。表头固定：

| # | 文件 | mocha fullTitle（`suite` + 空格 + `test`） | 旧断言（源码表达式或期望值） | HEAD 实测 | 档 (A/B/C) | 改档理由（仅改档时填） | 新期望（一句话） | 改的路径 | 关闭 SHA |
|---|------|------------------------------------------|------------------------------|-----------|------------|------------------------|------------------|----------|----------|

规则：

1. **一行一条失败**；行数 = 切片 0 在当前 HEAD 实测的失败数（账本表头写明 SHA 与实测数），全部闭合之前不得开切片 1 的「已归零」声明。「15」只是 D16 的历史观测，不是行数合同。
2. 旧断言抄测试里的 `assert.*`，不改写。新期望写产品合同，不写「以后再看」。
3. 档只能是 A/B/C；改档必须改「HEAD 实测」并填「改档理由」，禁止空改。
4. A/C 只列测试路径；B 必须列生产路径。一人一条，禁止一条失败同时改测又大改产品（除稳定 selector）。
5. 关闭 SHA 在合入该条的 commit 填写；未合入留空。
6. 账本全部行闭合后，D16 才能 `closed`（改 [`deferred-gaps.md`](../progress/deferred-gaps.md) 是实施收尾，见 §7）。[conversation-stream-timeline](conversation-stream-timeline.md) S2 曾写「`conversationLens.test.ts` 全绿」——以 D16 闭合为准，不再把 S2 的「已落」当成 Lens 基线证据。

## 3. 基线归零的退出条件

同时满足才算 D16 闭合、才允许把这三文件移出 §5 名单：

1. 账本全部行均有档、新期望、关闭 SHA。
2. 同一 SHA 上三条 `--run` **均 exit 0**（0 failing）。允许同目录其它测试文件仍红——那些走 D17 / 名单，不挡 D16。
3. `conversationImportBoundaries` 在该 SHA 扫描到的生产 `.ts` 数量 `>=` 账本写下的下限，且禁入 import 仍空数组（真扫，不是空目录）。
4. 没有新增 `skip` / 删除失败用例。**机器判定**：三文件 JUnit 的 `<skipped/>` 数与 `<testcase>` 总数分别 ≤ / ≥ 切片 0 记录值（Electron runner 对 `it.skip` 走 `pending`，`--run` 仍 exit 0，光看退出码抓不到）。A/C 的 diff 必须能在账本对上「旧断言 → 新期望」。
5. [`deferred-gaps.md`](../progress/deferred-gaps.md) D16 → `closed`，并在 [status.md](../progress/status.md) 写一行摘要（实施收尾）。

**未退出时的 CI：** 这 15 条（加上当时三域里其它已知红）写进 §5 名单；workflow 已合入也可以跑，只是名单非空。归零与「workflow 合入」不互为前置；**宣布 D16 closed** 必须以退出条件为准。

## 4. CI：为何 `pr.yml` 帮不上，以及可落点

### 4.1 现有 `pr.yml` 帮不上 `agent-ide`

[.github/workflows/pr.yml](../../.github/workflows/pr.yml)：

- `on.pull_request.branches` 只有 `main` 与 `release/*`，**没有** `agent-ide`。
- compile job 的 `runs-on` 是 `[ self-hosted, 1ES.Pool=1es-vscode-oss-ubuntu-22.04-x64, JobId=… ]`。这是 **microsoft/vscode** 组织的 1ES 池，本仓没有、也不得在方案里发明同名 runner。
- 同一文件还跑全量 `core-ci hygiene eslint valid-layers-check …` 与跨平台 electron/browser/remote。即使用得上，也和 [health-gates](../progress/health-gates.md)「D8 修好前不作集成门禁」以及「不为全绿冻结 UI」冲突。

本仓里**已经在用 github-hosted** 的先例（可抄，不可夸大）：

| 文件 | `runs-on` | 说明 |
|------|-----------|------|
| [sessions-e2e.yml](../../.github/workflows/sessions-e2e.yml) | `ubuntu-latest` | 本机工具链 + `npm ci` + `transpile-client` |
| [pr-linux-test.yml](../../.github/workflows/pr-linux-test.yml) | `ubuntu-24.04` | 上游 PR 的 Linux 测（`workflow_call` 可复用 job，不是独立 PR CI）；xvfb + `gulp transpile-client-esbuild` + 下载 Electron 后 `./scripts/test.sh`。只抄其环境 workaround，不 `uses:` 它 |
| [component-fixtures.yml](../../.github/workflows/component-fixtures.yml) | `ubuntu-latest` | 仍只跟 `main` / `release/*` |

**禁止**把 `pr.yml` 的 1ES label 抄进新 workflow。**禁止**写「本仓有 `vscode-large-runners` / 自建 runner」——[copilot-setup-steps.yml](../../.github/workflows/copilot-setup-steps.yml) 的 `vscode-large-runners` 同样是上游标签，本仓未证明可用。

### 4.2 新 workflow（落点）

**路径：** `.github/workflows/agent-ide.yml`（新建；不改 `pr.yml`）。

**触发**

```yaml
on:
  pull_request:
    branches: [agent-ide]
  push:
    branches: [agent-ide]
  workflow_dispatch:
```

`pull_request` 覆盖打进 `agent-ide` 的 PR；`push` 覆盖直推集成分支。不要加 `main`。

**Jobs（四个，互不 `needs`；禁止 artifact 互传 `out/`）**

选定 **并行、各自自备产物**。`unit-custom` 自己 `transpile-client-esbuild`，**不得** `needs: compile` 再下载 compile 的 `out/`。「互不 needs」与「compile → artifact → unit-custom」互斥，本稿删掉后者。

| Job id | 命令 | 说明 |
|--------|------|------|
| `compile` | `npm run compile` | 与 [health-gates](../progress/health-gates.md) 集成检查一致 = `compile-client` + `compile-copilot`（见根 `package.json`）。**不含** `valid-layers-check`。最低前置见下 |
| `eslint` | `npm run eslint` | `build/eslint.ts`；分层靠已有 `local/code-layering`，不靠 D8。同样要 `build/` + 根 `npm ci` |
| `docs-health` | `python3 scripts/check-docs-health.py`；docs-burden S1 落地后追加 `python3 scripts/generate-docs-status.py --check` | 只需 checkout + python3；无 `npm ci`。这是 [docs-burden-reduction](docs-burden-reduction.md)「忘跑生成脚本则红」的唯一机器调用方；health-gates 现只写「提交前建议」 |
| `unit-custom` | 见下 | 只跑三域；用 §5 名单判定，**不要**让 mocha 的非零退出直接当 job 失败 |
| `baseline-guard`（`unit-custom` 内一步，仅 `pull_request`） | `git diff --name-only $BASE...HEAD` | 若 `dev/progress/test-baseline-failures.txt` 有改动且同一 PR 还改了 `src/**` → exit 1。名单加行必须是**单独 PR**（§5「加行 = D17 登记 PR」的机器面） |

**`compile` 最低前置**（缺一则 gulp / 原生模块会红，禁止写成「只 checkout 再 `npm run compile`」）：

1. `actions/checkout`
2. `actions/setup-node` + `node-version-file: .nvmrc`（HEAD 为 `24.18.0`）
3. apt：`build-essential` / `pkg-config` / X11 头（对齐 [sessions-e2e.yml](../../.github/workflows/sessions-e2e.yml) 的 Install build tools）
4. `working-directory: build` 下 `npm ci`（gulp compile 脚本在 `build/`）
5. 根目录 `npm ci`（本 job 可设 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`，不启 Electron）
6. `npm run compile`

`eslint` 重复 1–2、4–5，再 `npm run eslint`。X11 头若实施证实 eslint 不链 GUI 原生模块可省略，但 **`build/` `npm ci` 不可省**。

**`unit-custom` 跑法**（对齐 [pr-linux-test.yml](../../.github/workflows/pr-linux-test.yml) 的 Electron 单测，而不是全仓）。glob 必须带 runner 默认后缀（HEAD [`test/unit/electron/renderer.js`](../../test/unit/electron/renderer.js) `_tests_glob = '**/test/**/*.test.js'`），禁止写成 `test/**` 目录前缀：

```yaml
- name: unit-custom + baseline
  env:
    DISPLAY: ":10"
    VSCODE_SKIP_PRELAUNCH: "1"
  run: |
    set +e
    ./scripts/test.sh --glob '**/vs/workbench/contrib/conversation/test/**/*.test.js' --tfs conversation
    ./scripts/test.sh --glob '**/vs/workbench/contrib/sources/test/**/*.test.js' --tfs sources
    ./scripts/test.sh --glob '**/vs/platform/universeAgent/test/**/*.test.js' --tfs universeAgent
    set -e
    ./scripts/check-test-baseline.sh
```

**选定：同一 shell step。** `set +e` 收齐三份 XML，再 `set -e` 跑比较脚本；**只以比较脚本的退出码**作为该 step / job 成败。禁止拆成三个 `test.sh` step（默认 fail-fast 会跳过比较）。不选 `if: always()` 方案。

`--tfs` 走 runner 已接的 `mocha-junit-reporter`。XML 路径（HEAD `test/unit/electron/index.js`）：`$GITHUB_WORKSPACE/test-results/${platform}-${arch}-${tfs}-results.xml`（`tfs` 经 `toLowerCase` + 非 `\w` 换成 `-`），即 `linux-x64-conversation-results.xml` / `linux-x64-sources-results.xml` / `linux-x64-universeagent-results.xml`。`mochaFile` 仅在 `BUILD_ARTIFACTSTAGINGDIRECTORY || GITHUB_WORKSPACE` 有值时设置；**为空时 reporter 并非「不写」，而是回落到默认 `test-results.xml`（cwd），三趟互相覆盖**。因此：本地必须 `export GITHUB_WORKSPACE="$PWD"`；比较脚本只认上述三个显式路径，任一缺失即 exit 1，**不**回读 `test-results.xml`。比较脚本读这三份 XML，不解析被 Electron 污染的 stdout。

三域目录（HEAD 事实）：conversation 在 `src/vs/workbench/contrib/conversation/test/`；sources 在 `src/vs/workbench/contrib/sources/test/browser/`；universeAgent 含 `test/common`、`test/browser`、`test/node`——Electron runner 同时有 DOM 与 Node API，**三域都走 `scripts/test.sh`**，不拆 `test-node`（避免两套过滤）。

**Runner（可落地，两档）**

| 档 | 何时用 | `runs-on` | 要点 |
|----|--------|-----------|------|
| **主档：github-hosted** | 该 remote 已开 GitHub Actions（本仓 workflow 里已有 `ubuntu-latest` / `ubuntu-24.04` 先例） | **`ubuntu-24.04`**（与 `pr-linux-test.yml` 相同，便于抄 xvfb / AppArmor / fontconfig） | 各 job 自备：`setup-node` + `.nvmrc`；`build/` `npm ci` + 根 `npm ci`。`unit-custom` **必须抄** [pr-linux-test.yml](../../.github/workflows/pr-linux-test.yml) 的 (1) expat/fontconfig 最小 `FONTCONFIG_FILE` workaround，(2) `libfcpreinit.so` + `LD_PRELOAD`（Pango 线程 `FcInit` 竞态），(3) AppArmor `kernel.apparmor_restrict_unprivileged_userns=0` + 同文件 xvfb。`ELECTRON_SKIP_BINARY_DOWNLOAD=1` **只在根 `npm ci` 时设**；随后另一步 `npm exec -- npm-run-all2 -lp "electron x64"`（此步不得带 SKIP）。再 `npm run gulp transpile-client-esbuild`（本 job 自跑，不吃 compile artifact）。`VSCODE_SKIP_PRELAUNCH=1`；`DISPLAY: ":10"`。内存：`eslint` 脚本已 `--max-old-space-size=8192` |
| **降档：文档化本地门禁** | remote **未**启用 Actions、分钟数不够、或 github-hosted 跑不动全量 `compile` | 无 runner | 与上表同一组命令写进 [health-gates.md](../progress/health-gates.md)「agent-ide 本地门禁」；打进 `agent-ide` 的 PR 描述必须贴退出码。workflow 文件仍要合入（`workflow_dispatch` 可空跑），**不得**改回 1ES label 碰运气 |

`compile` 若在 github-hosted 稳定超时：实施可将该 job **降为** `npm run compile-client`，并在 workflow 注释与 health-gates 写明「copilot 扩展编译不在本门」——这是超时后的文档化收缩，不是默认偷换。未超时保持 `npm run compile`。

**不要做的事：** `uses: ./.github/workflows/pr.yml`；把 `valid-layers-check` 加进 `npm exec npm-run-all2`；给 fork PR 要 1ES。

## 5. 「不新增失败」机制（选定）

**选定：基线 SHA + 仓内失败名单 + JUnit 差集。**

不选 mocha `--grep` / `--invert`。

| 方案 | 为何（不）选 |
|------|----------------|
| **选定：名单文件** | 与 [health-gates](../progress/health-gates.md)「既有基线失败标明 baseline SHA」和 [D17](../progress/deferred-gaps.md)「首次 SHA、baseline/新增」同构；名单可审、可缩；Electron runner **已经**能出 JUnit |
| mocha `--grep` + `--invert` | [`test/unit/electron/index.js`](../../test/unit/electron/index.js) 的 minimist 只声明 `grep`，**没有 `invert`**。要支持得改上游 runner。即便传入，跳过已知红等于 CI 装绿，且标题子串误伤、无法表达「名单条目已通过 → 必须删行」 |

**名单键（C1 选定：不改 runner）**

HEAD [`test/unit/electron/index.js`](../../test/unit/electron/index.js)：`deserializeRunnable`（约 L150–161）与 `deserializeSuite`（约 L135–148）**都不传 `file`**。`--tfs` 只给 `MochaJUnitReporter` 设 `testsuitesTitle` + `mochaFile`，**未设** `testCaseSwitchClassnameAndName` / `jenkinsMode`。因此 JUnit **无源路径**，禁止名单用 `file::fullTitle`（一边不改 runner 一边拼 file 是空话）。

`mocha-junit-reporter` 在此 runner 上的 `<testcase>` 键（包内 `getTestcaseData`，默认不 flip）：

| XML 属性 | 值 |
|----------|----|
| `name` | `test.fullTitle()` |
| `classname` | `test.title` |

**名单行格式（写死）：** `<classname>::<name>`，从 JUnit 原样抽取，禁止再映射回路径。

**名单文件（实施新建）：** `dev/progress/test-baseline-failures.txt`

```
# baseline_sha: <钉死采集时的 agent-ide SHA>
# min_cases: conversation=<N> sources=<N> universeAgent=<N>
# max_skipped: conversation=<N> sources=<N> universeAgent=<N>
# 格式：<classname>::<name>
# mocha-junit-reporter 本 runner：classname=test.title，name=test.fullTitle()
# 只登记 unit-custom 三域；D16 条目在归零后删除对应行
default session shows seeded untitled fixture without fake engine history::ConversationLens default session shows seeded untitled fixture without fake engine history
```

`min_cases` / `max_skipped` 在切片 3 采集时按实测写入（`min_cases` 取实测数的 90%，向下取整，给正常删测留余量；`max_skipped` 取实测值）。之后只许 `min_cases` 上调、`max_skipped` 下调；反向改动与名单加行同规，须单独 PR。

（上行为格式示例，**不是**把该用例预先判红。套件嵌套以切片 3 实测 XML 为准。）

**比较规则（`scripts/check-test-baseline.sh`，实施新建）：**

1. 输入：三份 JUnit + 名单文件。
2. 从每个 `<testcase>` 抽 `classname` + `name`，拼成与名单同一 `<classname>::<name>`。失败集 = 含 `<failure>` / `<error>` 的 testcase。
3. `actual_fail − listed` 非空 → **exit 1**（新增失败）。输出新增的 `classname::name`，提示记 D17 或当场修。
4. `listed − actual_fail` 非空 → **exit 1**（默认；比 warn 硬）。逼收缩名单，防止「永远豁免」。D16 归零 PR 必须同时删掉账本对应的全部名单行。
5. mocha / Electron 崩溃、三个显式路径任一缺失 → **exit 1**。**「0 个用例」检测不够**：Electron runner 在加载任何测试模块之前必注册 `assertCleanState` 用例（`test/unit/electron/renderer.js`），glob 写错也会有 ≥1 条 testcase——所以改为 **每域 `<testcase>` 数 ≥ 名单 `min_cases`**，否则 exit 1。
6. 每域 `<skipped/>` 数 > 名单 `max_skipped` → **exit 1**（堵 `it.skip` 装绿）。
7. `unit-custom` **同一 step** 对三趟 `test.sh` `set +e`，收齐 XML 后再跑本脚本；**最终只看比较脚本**。

**取舍**

- 优点：门禁语义就是 D17 的「baseline vs 新增」；归零后名单可空，空名单 ≡ 三域全绿；不改上游 Electron runner。
- 代价：多一个要维护的文本文件；改 `test()` / `suite()` 标题就要改行。禁止用文件级整文件豁免。跨域 `classname::name` 碰撞若切片 3 实测出现，再在键前加 `--tfs` stem（`conversation` / `sources` / `universeAgent`），不得改回 `file::`。
- 采集（I1）：切片 3 在钉死 SHA 跑一遍三域，**人审后**写入名单并写 `baseline_sha`。合入物必须是可审 diff：三域失败条数汇总 + 一行一条 `classname::name`。**禁止**脚本 stdout dump 整段粘进文件即 commit。此后只许删行或把新增失败修掉；**加行** = 明确的 D17 登记 PR，须在账或 D17 总账写首次 SHA。

## 6. 与 D17 总账的关系

[D17](../progress/deferred-gaps.md) 是 **M7 非阻塞验证债总账**（单测 / E2E / 视觉 / a11y / 性能 / 缺 Engine·Hub·Web 证据）。政策：普通失败不进 `status` Blockers，只挡对应 PRD/plan 升 `implemented`。

| 种类 | 谁记账 | 进不进 `unit-custom` 名单 | 挡不挡 `agent-ide` 合入 |
|------|--------|---------------------------|-------------------------|
| D16 十五败（未归零） | d16-ledger + 名单 | 是 | 否（属 baseline） |
| 三域里、D16 之外、采集 SHA 已红的单测 | D17 一行（首次 SHA、场景、`baseline`、owner） | 是 | 否 |
| 采集之后新出现的三域失败 | D17 一行，标 **`新增`** | 先修；例外才加名单 | **是**（比较脚本红） |
| compile / eslint 失败 | 不进 D17 | — | **是**（硬门，同 health-gates） |
| `code-layering` / boundary 生产破坏 | 不进「普通失败」 | boundary 测在三域内则按新增失败红 | **是**（health-gates 硬门） |
| D15 / D18 / D20、手测、axe | 只在 D17 / 各自 D 行 | 否 | 否 |
| 方案点名的断言替换（本计划账本 A/C） | 只在 d16-ledger | 归零后从名单删除 | 否 |

D17 **继续**装「本 CI 不跑的债」（Web 冒烟、安装包、300px 目视）。本 CI **不**把 D17 变成 Blockers；它只把「三域新增失败」从「记一笔就过」改成「合入 `agent-ide` 前必须修或走加名单 PR」。加名单 PR 不得与功能 PR 混在一起。

D8 仍豁免，不进名单、不进本 workflow。

## 7. 切片、文件互斥、验收

### 7.1 切片

| # | 内容 | 可改 | 禁止 |
|---|------|------|------|
| **0 盘点** | 重跑三文件；建 `d16-ledger.md`，一行一条实测失败（表头写 SHA、实测失败数、`<testcase>` 总数与 skipped 数） | 仅该账本 | 改生产、改断言、标 D16 closed |
| **1 归零** | 按账本 A/B/C 逐条 | 账本点名的测试；B 档点名的生产文件 | 未点名的 `src/**`；`skip`；动 D8 / `build/checker/**` |
| **2 假绿** | import boundaries 改扫 `src/` + 计数 | `conversationImportBoundaries.test.ts` | 改 eslint 分层规则顶替扫描 |
| **3 名单与脚本** | 钉 SHA、人审后写名单、比较脚本 | `dev/progress/test-baseline-failures.txt`、`scripts/check-test-baseline.sh` | 改 `test/unit/electron/index.js`（加 `--invert`、或为名单传 `file`——C1 已否）；脚本 dump 不经条数汇总/人审即合 |
| **4 CI** | 新 workflow | `.github/workflows/agent-ide.yml` | `pr.yml` 及其 1ES label；`valid-layers-check`；`needs` + `out/` artifact；拆成三个会 fail-fast 的 `test.sh` step；`ELECTRON_SKIP_BINARY_DOWNLOAD` 带到装 Electron / 跑测步骤 |
| **5 收口文案** | D16 closed；[health-gates.md](../progress/health-gates.md) 补 agent-ide 本地命令，并**改口**「单测失败不挡合入」为「三域新增失败挡合入 `agent-ide`（名单加行 PR 例外）」，[m7-ui-completion-wave §2](m7-ui-completion-wave.md) 同句同改；**D8 继续豁免**（不得借本句恢复 `valid-layers-check`）；[plans/INDEX.md](INDEX.md) 本方案行已存在，只改状态 | 上列文档 | 把 D15/D18/D20 标 closed；改 D8 裁决 |

切片 0 → 1 串行。2 可与 1 并行（不同文件）。3 可在 0 之后、1 完成前合入（名单先含账本全部条目）。4 依赖 3 的脚本路径，不依赖 D16 已闭。5 在 1+2 退出条件满足后。

### 7.2 文件互斥

| 切片 | 独占 | 谁 |
|------|------|----|
| 0 | `dev/progress/d16-ledger.md` | V |
| 1 | 账本点名的 conversation 测试；B 则另点名 `conversationLens.ts` / `conversationIdentityStrip.ts` / `conversationStubService.ts` 等 | V；B 档期间 P/A/B/C **不得**抢同一生产文件 |
| 2 | `conversationImportBoundaries.test.ts` | V |
| 3 | 名单 + `scripts/check-test-baseline.sh` | V |
| 4 | `.github/workflows/agent-ide.yml` | V |
| 5 | `deferred-gaps.md` D16 行、`health-gates.md`、`plans/INDEX.md`、`status.md` 摘要 | 与其它槽改 D 表其它行不冲突；禁止顺手改 D8 裁决 |

并发：切片 1 占用某生产文件时，其它槽禁止改该文件。切片 4 不改 `src/**`。

**与同批方案的顺序（签收裁定）：**

| 方案 | 关系 |
|------|------|
| [giant-file-split](giant-file-split.md) GFS-3 | GFS-3 独占 `conversationLens.ts`；**切片 1 的 B 档若点名该文件，GFS-3 须等切片 1 合入**（D16 归零先于拆 lens，否则红测搬家后无法归因） |
| [prd-020-turn-fixture-bench](prd-020-turn-fixture-bench.md) B0 | B0 改 `conversationStubService.ts` 测试钩子；切片 1 若点名该文件则 B0 等待。B1 新增的 bench 文件落在同一 `--glob`，无 env 时必须 `this.skip()` **且**其 skipped 计入 `max_skipped`（切片 3 采集时若 B1 已合入则把它算进去） |
| [session-view-frame-fanout](session-view-frame-fanout.md) F1 | F1 新增 `universeAgent` 测落入同一 `--glob`：若 F1 在切片 3 采集之后合入且带新失败，按「新增失败」处理，不追认 baseline |
| [docs-burden-reduction](docs-burden-reduction.md) S2 / S4 | 切片 5 改 `plans/INDEX.md` 与 `status.md`：若 S2 已落地，INDEX 状态列经脚本，不手改；S4 之后 `status.md` 只写一行链接 |
| [prd-008-engine-e2e](prd-008-engine-e2e.md) | 无文件重叠 |

### 7.3 验收

1. `d16-ledger.md` 全部行闭合；三 `--run` exit 0 且 skipped / 用例数满足 §3.4；import boundaries 非空扫。
2. `.github/workflows/agent-ide.yml` 存在，触发 `agent-ide`，四 job 如上（含 `docs-health`），`runs-on: ubuntu-24.04`，无 1ES / `vscode-large-runners`。
3. `unit-custom` 在「只存在名单内失败」时绿；人为加一个不在名单里的 `assert.fail` 时红；删掉一个已通过但仍在名单中的 `classname::name` 时红；把某域 `--glob` 改成不匹配任何文件时红（`min_cases`）；给一个用例加 `it.skip` 时红（`max_skipped`）；PR 同时改名单文件与 `src/**` 时红（`baseline-guard`）。
4. `compile` / `eslint` 失败 → workflow 红，与名单无关。
5. workflow **没有** `valid-layers-check`。
6. Actions 不可用时：health-gates 有同等本地命令（含 `export GITHUB_WORKSPACE="$PWD"`），PR 能贴退出码；不得改用未证明的 self-hosted。
7. D15 / D18 / D20 仍 open（除非其它工作另补证据）。
8. `python3 scripts/check-docs-health.py` 在切片 5 改索引后 0 error。

---

**选定机制：** 基线 SHA + `dev/progress/test-baseline-failures.txt`（键 = JUnit `classname::name`）+ JUnit 差集（`scripts/check-test-baseline.sh`）。  
**CI 落点：** `.github/workflows/agent-ide.yml`（github-hosted `ubuntu-24.04`；三 job 互不 `needs`；降档 = 同命令本地门禁，本地须 `export GITHUB_WORKSPACE="$PWD"`）。

---

## 审查记录（规则 16）

**2026-09-04 第一轮：** 只读审查 Critical / Important 已核 HEAD 后改入。当时 `status` 仍 `draft`；签收见第二轮。

| ID | 意见 | 处置 |
|----|------|------|
| C1 | `deserializeRunnable` 不传 `file`；`--tfs` JUnit 无源路径；禁止一边不改 runner 一边用 `file::fullTitle` | **选定不改 runner。** 名单键 = mocha-junit-reporter 默认 `classname`（`test.title`）+ `name`（`test.fullTitle()`），行格式 `<classname>::<name>`。未采纳「最小改 runner 传 file」 |
| C2 | 三步各自失败会跳过比较 | **选定同一 shell step**：`set +e` 收齐三份 XML，比较脚本为该 step 最后硬门。未采纳 `if: always()` |
| C3 | D16「`1 !== 2`」是 actual=1 expected=2；禁止默认改小期望 | 默认档 **B**；禁止先改 L582 `2→1`；与「stub 假定空会话」拆开 |
| I1 | 首份失败名单必须作为可审 diff 合入 | 切片 3：条数汇总 + 一行一条；禁止脚本 dump 即合 |
| I2 | 本地须 `export GITHUB_WORKSPACE="$PWD"` 才写 JUnit | 已写入 §4.2 / 文末落点 |
| I3 | unit-custom 必抄 expat/fontconfig + `libfcpreinit` `LD_PRELOAD`；`ELECTRON_SKIP_BINARY_DOWNLOAD` 只在 `npm ci` | 已写入主档 runner 要点 |
| I4 | compile 写最低前置；「互不 needs」与 artifact 互斥 | **选定互不 needs**，删 compile→`out/` artifact；compile 列出 checkout / setup-node / apt / `build/` `npm ci` / 根 `npm ci` |
| I5 | 切片 5 改 health-gates 一句 | 三域新增失败挡合入 `agent-ide`（名单加行 PR 例外）；D8 继续豁免 |
| I6 | glob 写成 `**/test/**/*.test.js` | 三域 `--glob` 已改为 `…/test/**/*.test.js` |

未采纳且与 HEAD / 已拍板合同冲突的意见：无。Minor：无单独记账。

### 第二轮：对抗性审查（Cursor CLI `cursor-grok-4.6-high`，只读）+ 架构裁定 + 签收（2026-09-04）

父会话逐条复核（`renderer.js` `assertCleanState` 注册、reporter `getSetting` 回落、`conversationStubService.test.ts` 开头断言、切片互斥）后改入。**Assessment：Approve with changes → 改入后签收 `accepted`。**

| 级别 | 意见（已复核属实） | 处理 |
|------|--------------------|------|
| **C1** | 空 glob 假绿：runner 必注册 `assertCleanState`，glob 写错仍有 ≥1 testcase，「0 用例 → exit 1」抓不到 | 名单文件增 `min_cases` 每域下限；比较规则 5 改为 `<testcase>` 数 ≥ 下限 |
| **C2** | 「15 行」是 `0649602d` 旧观测，当前 HEAD 实测数可能不同，硬填 15 会漏关或凑行 | 行数 = 切片 0 实测；15 只是历史值；回写 D16 |
| **C3** | 「stub 假定空会话」症状簇在测试文件里找不到对应断言 | 标为可能过时；切片 0 以失败栈为准，不为凑簇改未失败断言 |
| **C4** | `mochaFile` 为空时 reporter 回落 `test-results.xml`，三趟互盖，不是「不写」 | 改口；比较脚本只认三个显式路径，缺一即红 |
| I1 | 切片 5「加一句」实为政策翻转（health-gates / m7 §2「单测失败不挡合入」） | 文首新增「明确修改」段；切片 5 同改两处原句 |
| I2 | 与 GFS-3 / F1 / prd-020 B0 / docs-burden S2·S4 无互斥 | §7.2 新增「与同批方案的顺序」表 |
| I3 | `it.skip` 走 pending，`--run` 仍 exit 0，删名单行即可假闭 D16 | 名单增 `max_skipped`；退出条件 4 与比较规则 6 加机器判定 |
| I4 | 名单加行无机器门禁，功能 PR 可夹带 | 新增 `baseline-guard` 步：名单改动与 `src/**` 同 PR → 红 |
| Minor | INDEX 行已存在；`pr-linux-test.yml` 是 `workflow_call` | 已改口 |

**架构裁定（签收时）：** 新增 `docs-health` job，作为 [docs-burden-reduction](docs-burden-reduction.md) 生成列检查的唯一机器调用方；不加 `valid-layers-check`（D8 裁决不变）。

**签收（2026-09-04）：** `status` → `accepted`。实施顺序：切片 0 → 1（V 槽）；切片 2 / 3 / 4 可并行于切片 1；切片 5 最后。GFS-3 与 prd-020 B0 按上表等待。
