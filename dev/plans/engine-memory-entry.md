---
title: "Engine Memory 记忆入口补齐"
type: plan
status: draft
phase: N/A
updated: 2026-11-07
summary: "V1 只改页面、命令、测试与文档：命令面板直达 Memory 节，全局与引擎项目两种作用域，只读详情，诊断显示引擎返回的说明文字，新增对话框提示写事实。整理预览（引擎 M4，且要引擎声明支持预览）、来源显示（M4 的 A7 字段）、单个文件的历史与回退（引擎 M6）还要改 IPC、owner 合同与线上解码，等引擎面落地后修订本稿并重新审查。依据引擎 ADR-491（记忆只记录事实）。第 1 轮规则 16 审查驳回，本稿为第 2 稿，待重审。"
---

# Engine Memory 记忆入口补齐

状态：草案第 2 稿。第 1 轮规则 16 审查驳回后修订，待第 2 轮审查。
覆盖需求：PRD-025（PRD-025.9）。

> 依据：引擎仓库 `UniverseAgent/dev/plans/memory-facts-evidence-2026-11-07.md` 与 `UniverseAgent/dev/decisions/491-memory-records-facts-with-sources.md`。2026-11-07 人类签收，要求 VS Code 也有记忆入口；同日确认引擎切片 M6（单个文件的历史与定点回退）排在 M1、M2 之后。引擎仓这些改动目前只在其工作树，尚未提交。本稿基于 `agent-ide` 分支工作区的只读核对，不含工期。

## 1. 现状

### 1.1 本仓

| 事实 | 证据 |
|:---|:---|
| Memory 节作用域写死为 `global`，只有列表、搜索、新增、删除 | `engineMemorySection.ts:31`（`MEMORY_SCOPE`）；[engine-catalog](../../docs/systems/workbench/engine-catalog.md) Memory 行 |
| 命令面板只有 `Open Engine Preferences`（`workbench.action.openEnginePreferences`），zone 参数只认 `tools`、`models`，到 Memory 节要先打开再点左栏 | `uaPreferencesNavigation.ts:83-101`；zone 常量在 `common/uaPreferencesPanes.ts:19-25` |
| 列表行是不可聚焦的 `div`，行内唯一的控件是 Delete；搜索结果里 `forgot` 为真的条目也显示 Delete | `engineMemorySection.ts` 行渲染 |
| 列表读取失败一律进 failed 并给 Retry，不区分 `UNIMPLEMENTED`。Skills 节已有先例：运行时收到 `UNIMPLEMENTED` 就撤掉对应入口 | `engineMemorySection.ts:352-377`；`engineSkillsSection.ts:1223` |
| 保存与删除按 strict owner 传 link（[D1391](../progress/deferred-gaps.md) 已闭）。新增对话框的说明写着保存到全局作用域 | `engineMemorySection.ts:503,521,575` |
| 连接层的 `readMemory?`、`reflectMemory?`、`revertMemory?`、`historyMemory?`、`searchDeepMemory?` 在 IPC 白名单里，渲染进程能调用；`openRebuildMemoryStream?` 在拒绝名单里（回调流过不了 ProxyChannel），渲染进程调不到 | `universeAgentConnectionIpcChannel.ts:38,69,271-276` |
| `revertMemory(request)` 没有 expectedOwner 参数：node 侧经 `_withTransport` 取当前 transport，它也不在 `EXPECTED_OWNER_ARGUMENT_INDEXES` 里 | `universeAgentConnection.ts:1558`；`universeAgentConnectionService.ts:2047-2048`；`universeAgentConnectionIpcChannel.ts:85` |
| 元数据解码只读字段 1–7；Rebuild 只编码 `scope`、`dry_run`，只解码 5 个事件字段 | `node/grpc/grpcMemoryUnaryWire.ts`、`node/grpc/grpcMemoryRebuildStreamWire.ts` |
| Memory 没有能力键，也没有专用快照字段。桌面的转发代理让 `typeof connection.<记忆方法>` 恒为真。D1399 已定：专用三态字段另开合同，签收前保留现有 `typeof`；能力写门禁方案加了扫描测试，禁止新增 `typeof` 能力开关 | [D1399](../progress/deferred-gaps.md)；[能力写门禁方案](review-2026-11-04-p1-capability-write-gate-plan.md) |
| 网页连接没有记忆方法，Memory 节在网页恒为 unsupported | `browser/universeAgentConnectionService.ts` |
| 搜索结果每条带自己的 `scope` 和 `forgot`；列表里的条目都不在 `forgot/` 下 | `universeAgentTypes.ts:2474-2482`（`UniverseAgentMemorySearchEntry`） |

### 1.2 引擎 HEAD（`grpc-server/.../MemoryGrpcService.kt`）

| 事实 | 证据 |
|:---|:---|
| `Read`：`mode` 为空时把 `section` 当作 mode，两者都空按 `content` 处理；只有 `metadata`、`full` 返回元数据。`forgot` 为真的条目不带 `forgot` 读会 NOT_FOUND。`version` 从不填 | `read` / `resolveReadMode` |
| `Reflect` 只填 `summary` 文本，`diagnoses` 为空，`categories` 被忽略。它只读配置、front matter 与访问日志，不写文件 | `reflect`；`MemoryReflectTrigger.generateDiagnosticSummary` |
| `History` 忽略作用域、分类和文件，返回整个记忆库的版本记录（版本库只建在全局根上），每条只有时间和说明，没有版本号。`Revert` 恒返回 `UNIMPLEMENTED`：这是 H7 的 fail-closed，底层回退会整库回滚 | `history` / `revert`；引擎缺口 `D-MEM-HISTORY-PER-FILE-1` |
| `MemoryRebuildRequest.dry_run` 不生效，发出去直接改记忆。没有 M4 的引擎也会忽略将来加上的计划 id | `rebuild`；引擎缺口 `D-MEM-REBUILD-DRYRUN-1` |
| 项目作用域是引擎启动时的目录。请求里没有目录字段，也没有 RPC 能改它。项目目录缺失时 `list` 返回 INTERNAL 加自由文本，和传输失败分不开 | `MemoryModule.projectDir()`；`HeadlessServer` |
| 全局记忆目录固定在用户主目录下，不跟随 `UNIVERSE_AGENT_HOME` | 引擎缺口 `D-MEM-GLOBAL-HOME-1` |
| 经 `Save` 写入的条目，列表标题目前是来源标签 `grpc-save`，引擎切片 M1 修 | `MemoryModule.saveDirect`；`list` 用 front matter 的 `context` 作标题 |

## 2. 目标

V1：用户能从命令面板直接打开 Memory 节；能在全局和引擎项目两种作用域之间切换，看列表、搜索、读正文；能运行诊断并看到引擎返回的说明文字；新增时界面提示写事实。V1 只改页面、命令、测试与文档，不改连接层、IPC 或线上解码。

之后要等引擎的三项：整理先预览再应用（M4，且引擎要声明支持预览）；详情显示来源、写入方、有效期和冲突（M4 的 A7 字段）；单个文件的历史与回退（M6）。这三项都要改连接层，见 §4。

记忆写什么由引擎定（ADR-491：只记录事实）。页面只在新增对话框里提示写事实，不改引擎行为。

## 3. V1

### 3.1 共同约束

**作用域与目标绑定。** 列表、搜索、详情读取、诊断各用自己的代次，并记下发起时的目标：列表、搜索、诊断记作用域，详情另记分类、文件名和 `forgot`。晚到的结果目标对不上就丢弃。切换作用域时关闭详情，丢弃进行中的诊断结果。

**写入绑定。** 新增在打开对话框时、删除在确认时记下作用域，请求发这个作用域。完成后用 `evaluateEngineWrite` 带 `targetId`（作用域）判断，作用域已变就不画结果、不刷新当前列表（`engineWriteGate.ts:85-107`；`EngineRefreshGate` 只管列表）。保存与删除已有的 strict owner 与 link 合同不变。删除当前打开的条目时关闭详情。

**能力与 unsupported。** 不新增 `typeof` 能力开关（D1399 与扫描测试）。Memory 节整体是否可用沿用现有判断；节内新调用（`readMemory`、`reflectMemory`）收到 `UNIMPLEMENTED` 时显示 unsupported 并写原因，不显示 failed 加 Retry（照 Skills 节的先例）。Memory 没有能力键，所以没有 probing 态。D1399 的专用字段签收后，改看该字段。网页上整节 unsupported，V1 不改。

**各面状态。**

| 面 | 加载 | 空 | 失败 | unsupported | 断连 | 配对等待 |
|:---|:---|:---|:---|:---|:---|:---|
| 列表与搜索 | 现有 | 现有 | 现有（消息与 Retry） | 现有（网页）；新增 `UNIMPLEMENTED` 映射 | 现有 | 现有 |
| 详情 | `Loading…` | 正文为空写 `This memory is empty.` | 在详情内显示错误与 Retry，不清列表 | 收到 `UNIMPLEMENTED` 时写原因 | 关闭详情回到列表 | 与列表的可用判断一致 |
| 诊断 | 按钮进入运行中 | `summary` 为空写 `The engine returned no diagnosis.` | 显示错误与 Retry | 收到 `UNIMPLEMENTED` 后按钮禁用，原因写进 `title` 与 `aria-label` | 按钮禁用并写原因 | 与列表的可用判断一致（`Reflect` 只读） |

**窄宽度、键盘与无障碍。**

- 行可以用鼠标、Enter、Space 打开详情：行可聚焦，Delete 仍是行内单独的幽灵图标。
- 详情是 Memory 节内的二级视图，有自己的 Back，返回后焦点回到原行。窄宽度下整页已有左栏与详情的切换和自己的 Back（`enginePreferencesPane.ts:239-250,460-483`）；Memory 详情的 Back 只回列表，不回左栏。
- 作用域切换沿用 MCP 节的 tablist（`engineMcpSection.ts:452-493`）：两个 tab，`Global` 与 `Engine Project`，方向键切换。
- Diagnose 是带 `aria-label` 的幽灵图标按钮；禁用原因写进 `title` 和 `aria-label`（[engine-catalog](../../docs/systems/workbench/engine-catalog.md) 第 120 行的约定，另见 D1318）。

**文案。** 界面文字一律经 `localize` / `localize2`，源文案用英文。本稿里的中文只是说明。

**状态保留。** 作用域和搜索词只存在当前节实例里。重新打开 Engine 页时从 Global、空搜索开始；切换作用域时清空搜索词。

### 3.2 切片

| 切片 | 内容 | 退出条件 |
|:---|:---|:---|
| V1a | 命令入口。`common/uaPreferencesPanes.ts` 加 `ENGINE_MEMORY_ZONE = 'memory'`，`Open Engine Preferences` 收到它时选中 Memory 节。在 `registerUaPreferencesNavigationActions` 里沿用现有「未注册才注册」的守卫，注册 f1 命令 `workbench.action.openEngineMemory`，标题 `localize2('openEngineMemory', "Open Engine Memory")`，效果等于带该 zone 打开 Engine 页。Memory 节正开着详情时再触发，回到列表 | `uaPreferencesNavigation.test.ts`：两条命令都打开 Engine 页并选中 Memory。`enginePreferencesPane.test.ts`：reveal 选中 Memory；详情打开时 reveal 回到列表 |
| V1b | 作用域切换。tablist 两项 `Global`、`Engine Project`。Engine Project 下的说明是 `The engine's own project directory, which may differ from this window's work root.`，与 Rules 节「Project rules follow the open work root」相对（`engineRulesSection.ts:103`）。新增对话框保留作用域一行，按当前作用域写。左栏徽标只数当前作用域。不设「引擎没有项目」的专门状态，引擎返回的错误照常显示在失败态里 | `engineMemorySection.test.ts`：两种作用域请求里的 `scope` 正确；切换后旧作用域晚到的列表和搜索结果不画进来；对话框打开后切换作用域，保存仍发打开时的作用域，且不刷新新作用域的列表 |
| V1c | 只读详情。点行或搜索结果打开详情。`readMemory` 发 `{ scope, category, filename, section: '', mode: 'full', forgot }`，`scope` 和 `forgot` 取自该行。显示分类、文件名、标签和更新时间；时间为 0 写 `Unknown`；不显示 `version`。正文按纯文本渲染，不解析 Markdown，不插入 HTML，因为记忆内容是不可信数据（ADR-491 第 5 条）。`forgot` 为真的条目标 `Forgotten`，不显示 Delete（引擎的删除是把文件移进 `forgot/`） | 单测：请求带 `mode: 'full'`、`section: ''` 和该行的 `scope`、`forgot`；A 的读取晚到而详情已切到 B 时不画；正文里的 HTML 按文字显示；时间为 0 显示 `Unknown`；`UNIMPLEMENTED` 显示 unsupported；读取失败只影响详情；`forgot` 行没有 Delete |
| V1e | 诊断。列表工具栏加 Diagnose 幽灵图标，调用 `reflectMemory({ scope, categories: [] })`，以纯文本显示 `summary`。`diagnoses` 为空不代表没有问题，不画「无问题」 | 单测：照原文显示 `summary`；`summary` 为空时的文案；`UNIMPLEMENTED` 后按钮禁用并写原因；切换作用域丢弃进行中的结果 |
| V1f | 新增对话框的说明改为 `Write what happened and when: what someone said or decided, or a result you observed. Leave out conclusions.`，保留作用域一行（现为 `engineMemorySection.ts:503`） | 单测断言说明文案和作用域一行 |

V1d 原为「历史与回退」，2026-11-07 移为 V2c，编号不复用。

## 4. 等引擎的切片

这三项开工前都要做到三件事：引擎面合入，并按 [cross-repo-protocol](cross-repo-protocol.md) §3.3 钉到含它的引擎版本；修订本稿，展开切片；重新做规则 16 审查。在那之前，页面不调用 `openRebuildMemoryStream`、`historyMemory`、`revertMemory`。

| 切片 | 引擎前提 | 本仓还要改的 | 登记 |
|:---|:---|:---|:---|
| V2a 整理先预览再应用；预览后文件变过就提示重新预览 | M4，且引擎对外声明支持预览：可以是能探测的独立 RPC，也可以是 D1399 那类专用快照字段。不能只靠「客户端比引擎新」的先后顺序，因为没有 M4 的引擎会忽略 `dry_run` 和计划 id，照常重建 | Rebuild 是回调流，在 IPC 拒绝名单上，要在 node 侧适配或改用 unary；应用是写操作，要进 strict owner 合同；预览内容的形状等 M4 的 proto | [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md)「记忆整理预览要引擎声明支持」 |
| V2b 详情显示来源、写入方、有效期（`valid_until`）和冲突条数 | M4 交付的 A7 元数据字段 | 元数据解码加字段，补类型与映射 | 不另登记，A7 已在引擎方案内 |
| V2c 单个文件的历史与回退：列出该文件的版本，选中后确认才回退 | M6：按作用域、分类、文件过滤并带版本号的历史；只恢复指定文件指定版本的回退 | `revertMemory` 加 expectedOwner，改接口、IPC 的 owner 参数索引、node 与测试（`universeAgentConnectionIpcChannel.test.ts`、`universeAgentConnection.test.ts`），否则 D1391 修掉的旧写入问题会在回退上重现 | [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md)「按文件、按作用域的记忆历史与定点回退」 |

M6 与引擎 `feature-chain-12-memory.md` 的关系：那份方案把「versionControl 的 GLOBAL 根」和「再启用 revert」列为它自己的出界项，并禁止把 CP-11、H7 已闭的缺口重新标为 open（第 26、537 行）。M6 在引擎的记忆事实方案里另起，用新缺口 `D-MEM-HISTORY-PER-FILE-1`，不改已闭的行。它也不是要求放宽 H7：H7 拒绝的是整库回滚，M6 交付的是只动单个文件的回退。

## 5. 不在本方案

- 记忆开关（memory-enabled）：现页没有，本方案不加。
- SearchDeep 高级检索面板。
- 结构化诊断列表。引擎 `Reflect` 只给 `summary`。PRD-025.9 只要求能运行诊断，`summary` 文本已满足；分条列出、点进条目需要引擎做新设计，超出已签收的 ADR-491 与引擎方案。用户确有需要时，按 cross-repo §3.2 另提。
- 显示引擎项目目录的路径。引擎没有返回该路径的 RPC，界面只说明它是引擎自己的目录。需要时按 §3.2 另提。
- 引擎的保存、整理和来源逻辑，这些在引擎仓库改。

## 6. 文档

需求已按规则 10a 先加 PRD-025.9，本稿第 2 稿同次补了来源显示一句。各切片同次更新下表的正文；产品状态等有用户可观察的证据后再改。

| 文档 | 位置 | 何时改 |
|:---|:---|:---|
| [requirements](../../docs/product/requirements.md) | 第 410 行 PRD-025 的用户可观察陈述（现写 scope 恒为 `global`，read、reflect 等不在页上） | V1b、V1c、V1e 落地时 |
| [requirements](../../docs/product/requirements.md) | PRD-025.9 | 每个切片落地时注明已实施部分 |
| [engine-catalog](../../docs/systems/workbench/engine-catalog.md) | 摘要和第 18、20、78、86、97、139、159、176、194、211 行的 Memory 陈述；第 52 行的 owner 合同在 V2c 加回退时改 | 对应切片 |
| [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) | 摘要，第 12 行，Memory 各 RPC 行（第 165、168–171 行）与第 213、282–288、469 行的页面调用情况，§4 两行缺口 | 对应切片；§4 两行已在第 2 稿同次登记 |
| [ide-engine-feature-gaps](../../docs/reference/universe-agent/ide-engine-feature-gaps.md) | 第 46 行高级 Memory | V1 落地时注明 read、reflect 已接 |
| [traceability](../../docs/product/traceability.md) | PRD-025 行的实施方案列加本稿 | 本稿签收时 |
| [status](../progress/status.md) | Next 与已完成 | 每个切片 |

## 7. 验证

- 编译：`npm run compile`。
- browser 单测：`scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/engineMemorySection.test.ts`，`uaPreferencesNavigation.test.ts` 与 `enginePreferencesPane.test.ts` 同样跑。
- 合入前跑 [health-gates](../progress/health-gates.md) 列的本地门禁：eslint、docs-health、`scripts/run-unit-custom.sh`。
- 用户可观察的证据：按 AGENTS.md「启动」打开默认编辑器窗口，连钉死的引擎（[debug-engine](../../docs/guides/debug-engine.md)），实际操作一遍：从命令面板打开 Memory；Global 与 Engine Project 各列出、搜索、打开一条详情；在 Engine Project 新增一条再删除；运行 Diagnose 看到说明文字。证据写入 `dev/progress/` 下的证据文件。桩测看不出引擎的真实行为，第 1 轮审查发现的回退禁用、整库历史都属于这类。
- 冒烟只在 Engine Project 里写。引擎的全局记忆目录不跟随 `UNIVERSE_AGENT_HOME`（`D-MEM-GLOBAL-HOME-1`），在 Global 里新增会写进用户真实的记忆。

## 8. 风险

| 风险 | 应对 |
|:---|:---|
| 引擎 M4 之前误发整理请求 | V2a 之前不调用 `openRebuildMemoryStream`；V2a 还要求引擎声明支持预览 |
| 引擎 M6 之前把全局版本记录当成单个文件的历史 | V2c 之前不调用 `historyMemory` 和 `revertMemory` |
| 项目作用域和本窗口的工作区目录不一致 | 说明写明它是引擎自己的目录，不按工作区目录推断 |
| 引擎 M1 之前，经 Save 写入的条目列表标题都是 `grpc-save` | 详情显示文件名与正文；M1 之后标题恢复 |
| 冒烟写进用户真实的全局记忆 | 冒烟只在 Engine Project 写，见 §7 |
| 节内功能变多，页面变挤 | 详情放二级视图；列表页只多一个作用域 tablist 和一个 Diagnose 图标 |

## 9. 审查记录（规则 16）

### 第 1 轮（2026-11-07）

结论：驳回，修订后重审。

| 编号 | 级别 | 问题 | 处理 |
|:---|:---|:---|:---|
| C1 | Critical | 历史与回退在引擎 HEAD 做不出来：回退恒为 `UNIMPLEMENTED`，历史是整库的、没有版本号 | 采纳。移为 V2c，依赖 M6。引擎侧已在工作树登记 `D-MEM-HISTORY-PER-FILE-1` 与 M6，人类 2026-11-07 确认排期；本仓 surface §4 登记要功能行；PRD-025.9 改为引擎支持后提供；§4 写明 M6 与 feature-chain-12 的关系，不要求放宽 H7 |
| C2 | Critical | `Reflect` 只有 `summary`，没有分条诊断 | 部分采纳。V1e 显示 `summary` 文本，`diagnoses` 为空不画「无问题」。不采纳「向引擎要结构化诊断」，理由见 §5 |
| C3 | Critical | 「连接层已全，只改页面、命令与文档」不实 | 采纳。重写 §1.1；V1 只用已放行且不需要新 owner 的方法；§4 写明 V2 各项要改的 IPC、owner 与解码 |
| C4 | Critical | 预览的安全不能靠先后顺序 | 采纳。V2a 要求引擎声明支持预览；surface §4 登记；引擎方案 M4 的退出条件同步加上 |
| I1 | Important | 读取请求错，会丢元数据、读不到已遗忘条目 | 采纳，见 V1c |
| I2 | Important | 「引擎返回无项目」不是引擎会报的状态 | 采纳，见 V1b |
| I3 | Important | 缺各面状态与能力判断 | 采纳，见 §3.1 |
| I4 | Important | 列表之外也要代次与目标检查 | 采纳，见 §3.1 |
| I5 | Important | 窄宽度、键盘、文案未定 | 采纳，见 §3.1 |
| I6 | Important | 文档清单不全 | 采纳，见 §6；PRD-025.9 补来源显示 |
| I7 | Important | 缺测试文件、命令与用户可观察的证据 | 采纳，见 §7 |
| I8 | Important | V2 要单独修订，V2b 漏了 `valid_until` | 采纳，见 §4 |
| Minor | Minor | `grpc-save` 标题、已遗忘条目的 Delete、命令 id 与注册、网页、状态保留、审查记录格式 | 均采纳，分别见 §8、V1c、V1a、§1.1、§3.1 和本节 |
| 建议 | — | 向引擎要项目目录的路径 | 不采纳，理由见 §5 |

### 第 2 轮

待审。
