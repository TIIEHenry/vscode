---
title: "Tools 呈现与 Wiki Git 上下文并行波"
type: progress
status: active
phase: M7
created: 2026-11-02
updated: 2026-11-02
summary: "固定两域 A Tools/B Wiki；正式方案规则16已通过；独立文档提交后授权实施，所有检查唯一通道，所有检查唯一通道。"
---

# Tools 呈现与 Wiki Git 上下文并行波
状态：执行中。负责：agent:codex。范围：两个完整冲突域；正式方案各自规则16 C0/I0/M0 APPROVED，独立文档提交前不编码，不进入 Plan 模式。

## 固定基线和分工

本波以已正常发布且远端独立核实的 `0ac6a61fe86087ed5fa690764ae98178239276b0` 为起点。merge/A/B 当前同 SHA 且 clean；src/build/scripts/extensions 四 tree 与完整 compile exit 0 的 `51e790607b0` 完全相同，D1393 19 TS hash 保持。复用该 testedSourceSame 编译证据，不把旧 Tools 红测说成绿。

| 成员 | 预定分支/路径 | 唯一生产/测试冲突域 | 完成线 |
| --- | --- | --- | --- |
| A | `codex/tools-display-lifecycle-A`，`../vscode-WorkTrees/A` | `engineToolsSection.ts` 与现 Tools 真实组件测试 | [Tools 方案](../../plans/tools-display-lifecycle.md) 完整呈现/保存生命周期，D1395 原业务红通过 |
| B | `codex/wiki-git-context-B`，`../vscode-WorkTrees/B` | `scripts/wiki/wiki.py` 与 `scripts/tests/test_wiki_git_environment.py` | [Wiki 方案](../../plans/wiki-git-context-isolation.md) 主仓真实 index、foreign 固定 pin、verify 覆盖及真实 hooks |
| integration | 固定 merge | 唯一文档/Git 与所有编译、测试、eslint、工具检查 | 范围审查、精确提交、三路保留、组合检查、正常发布与安全同步 |

正式方案独立提交 `5a48ed3cba2` 后，A/B 已各自 ff-only 跟该 SHA 并创建表中全新分支，原槽分支保留，未使用 checkout -B。A 获作者源码授权、尚无验证结果；B 真三路承接 D 后为 `db36339ae0f` 且 clean，残余实现仍待。两成员被冻结，不按函数拆更细，不纳 Task Inspect；该只读身份诚实性缺口另记 [D1396](../../progress/deferred-gaps.md) 排后。作者不自行裁定最终 OV。

## 外部与工作区保全

主工位仍 `agent-ide=629d8b33df8` 加原 WIP；上一波 ff-only 因 status/roster 路径重叠被安全拒绝，81 文件 hash/状态字节不变，不 reset/stash/restore/clean。C `cabefc81b36`/D `9d4719459aa` 是其他候选，C 还有未知计划与过程 WIP，全部保留不接管、不把文件或状态复制成当前集成事实。

B 已按批准边界真三路 merge D 的 9d471 原 commit 为 `db36339ae0f`，保留原身份；唯一 pool summary 冲突逐段合成，47 路径 mode/blob 门全过，原四项真实 Git 测试 4/0，原 hooks 无 wrapper 完整通过，TS src tree 与方案基线相同。此为残余实施前置，不代表 D1394 完整通过；只采 wiki 主题，旧工位快照不盖本波/D1393，不整树合 C。integration 统一合成文档，B 不占共享账。其他旧 worktree 不在本波处置范围。

## 验证与当前事实

- 上一波完整发布与安全同步见[归档](../../../archive/dev/parallel/active/session-owner-wave-2026-11-02.md)。Tools 基线外部三套 163/1，唯一呈现债按 D17/[D1395](../../progress/deferred-gaps.md) 登记；D1393 已闭合，D1394/D1395 仍 open。
- 两份正式方案已分别完成实际文本规则16：Tools 首轮 C0/I3/M1、Wiki 首轮 C0/I1/M0，必要意见全部改入；Tools 修订正文及运行边界补充、Wiki 修订正文均获 C0/I0/M0 APPROVED。父调度采纳，方案 accepted，独立 docs commit 后才建新分支实施，不把签收当运行通过。
- 开发者仅写独占 production/tests，不起 compile/noEmit/transpile/tests/eslint；integration 所有检查串行，不并行安装、out/.build 各槽独立。验证失败按真实 baseline/新增分类，不删原断言/不伪造绿。
- 本波代码/工具验收不自动等于真实默认窗口、真实引擎或全产品验收。Tools 方案另列默认窗口与真实引擎持久化回读门；未实际验证则 D1395 保持 open、方案不升整体 implemented，代码自动层与 Wiki 仍可按各自证据推进。双域均可合入后同 wake 关仓，不能单域抢跑释放或扩成员。

## 门与下一动作

- [x] 两份方案规则16只读审查，必要修订落盘。
- [x] 独立 docs commit `5a48ed3cba2`；A/B ff-only 跟其 SHA 并创建新槽分支。
- [ ] 各域一名作者实施；B 保留 9d471 身份后续修；共享文档由 integration 维护。
- [ ] 唯一通道检查与非作者 OV，主题提交包含代码/测试/必要知识/行动层。
- [ ] merge 两边保留、组合检查、正常 push、P6/P7 安全同步与 WIP 对照。

## 实施交接与通道观察

A 的真实后端写目标/profile in-flight reservationMap 补充已获 Astra C0/I0/M0：A1 未结可做 B1，回 A 禁 A2，终态且 map 身份仍匹配才释放；SaveAgentProfile 不带 projectPath，key 为 stable engine identity/profile id，workroot/source/link 不属于锁 namespace。任一方 identity 缺省时同 profile 保守拒并发，两个明确不同 identity 才可并行；展示授权与预约分开，普通切选/刷新/清稿/隐藏不解锁，不宣称跨窗口 CAS。该补充已写入正式 Tools 方案。

唯一检查通道在 B 合并原 hook 前实际发现外部 E 的 PID1685005/1685020 正跑 Sources suite，因此未新开检查。随后同 PID 均消失，重新核全进程无其他本仓验证才继续原 hook；不杀/重启 E、不接管其测试结果。C/E/F 外部在途工作不属本波。

A 的两项必要增量已各获 Astra C0/I0/M0：旧 RPC 终态只按身份退休自身预约，未 dispose 可按当前 reservation 更新 Save chrome，不能应用旧结果；ToolInfo success/catch 共同捕获并校验 engine/link/workroot/source、详情代次、选择及 dispose，scope 实变推进代次防往返复活，同 scope 普通 refresh 不机械取消。真实 DOM/Deferred 正反矩阵纳入 A 唯一通道验证，不改 pairing/disconnect leftover 或额外发 RPC。

A 最终两 TS 候选冻结：production SHA256 `eb34109e1009c511734321f55f0b68385345177f26e2f41845bb5a71db8c965b`，test SHA256 `02b11736e76a0d840026cf92db4a401181470698ee19f98032a9ff9417114366`；待唯一通道 compile-client、聚焦 eslint、Tools/原 catalog 官方 suite 和独立 OV。B 仍编写，未借 A 的结果或历史四例升级整域验收。

A 首轮唯一通道结果（上述 eb34109e/02b11736 固定候选）：`npm run compile-client` exit 0（session 16167）；两文件聚焦 eslint exit 1，production 两条 querySelector warning 与 test 一条全局 window warning；官方 `scripts/test.sh` 显式运行 Tools、engineCatalogSections、engineAgentsSection 原三套为 190 passing / 14 failing，exit 1（session 64745）。13 个新增 Tools DOM/状态断言失败，另有原 Catalog reconnect pending-clear 断言失败；原 stale-list 业务红本轮不在失败列表，不代表整域通过。首日志分别落仓外 `.coordination-20261102/newwave-a-compile-client.log`、`newwave-a-eslint.log`、`newwave-a-browser-1.log` 及各 `.exit`。最终 hash 检查一致，失败已交唯一作者，原断言保留；Catalog 合同冲突交 Astra 裁定，未擅改测试。此轮已终态，未启动真实窗口/引擎，也未检查未冻结 B。

A 首轮问题后经 Astra 实 diff 确认并签收两项窄修：首次异步 ensureList 必须仅一次重放 lastLayout，保 layout-before-deferred-list 实例不补后置 layout；Catalog 原所谓 reconnect 只有同 scope true→true，故第三测试文件按点名迁移为真 false→true（保原 false 断言及 disconnected/空行/dirtyfalse 中间证据），另加同 scope true→true 保稿/DOM/ready/零 Save 对照。A 尚待最终三文件 hash 与重新检查，未把 13 个 DOM 红都归为 fixture。

B 完整矩阵首候选冻结：wiki.py SHA256 `aad24c821d19baaa57b923c9625b4c02f45eeec2dc053370c625a53ba3607fad`，test SHA256 `2a383b2b67229a4362b8f6f91316c1eb5b99cd328196a0d9b73609efaf108f90`；运行前实际进程扫描为空，唯一通道完整 17 方法真实 Git 组合矩阵已终态：15 通过、2 失败，exit 1（session 66496），首日志 `.coordination-20261102/newwave-b-full-matrix-1.log`。config selection 期望 another worktree、实际 parent；non-Git root 报告仍出现 B 的 HEAD/dirty，期望无仓库；尚不先猜生产/fixture 归因，已交唯一作者。原 hooks/worktree alternate-index 等其余场景通过不代表整域绿，不关闭 D1394。

A 第二轮启动有一次调度执行错误：实际 precompile 扫描捕获外部 F 的 PID1837702 正跑 wiki staged check，但后续独立调用未受扫描退出码约束而误起 compile-client。integration 已立即只终止自己 A cwd 的 npm/gulp PID1838266/1838349/1838410，session 41607 终态 143；未触碰外部进程，保留 `newwave-a-compile-client-2.log/.exit`，本次中止不算通过。后续每次检查将 actual-process 扫描与启动以成功条件直接连接，外部占用时不启动。

A 同一三文件第二固定候选（production 309ae6f4 / ToolsTest 0c56e486 / Catalog ee6ca0c5）在外部检查消失、实际扫描为空后运行 compile-client，session 31925 自然终态 exit 1：ToolsTest 912/913 的 renderHeight/contentHeight 被 TypeScript 收窄为 never，两处 TS2339。日志 `newwave-a-compile-client-3.log/.exit`；未继续 lint/suite、不借旧 JS。另父调度指出新增测试 bind(this) 违反既有编码规范，交唯一作者在保持真实生产方法执行与事件次数断言下窄改。两域均已交回作者，当前没有自有检查 live。后续所有检查固定从仓外 `.coordination-20261102/run-validation.py <process-receipt> -- <command>` 单入口调用：实际进程扫描返回成功才 exec 检查，扫描非零直接退出，避免独立调用失去返回码依赖。

A 最终自动层固定三文件（production 309ae6f4 / ToolsTest d8820b09 / Catalog ee6ca0c5）：客户端编译 `newwave-a-compile-client-4.log/.exit` exit 0（session 45345）；三文件聚焦 eslint `newwave-a-eslint-2.log/.exit` exit 0（无规则 warning，session 32075）；官方 Tools/Catalog/Agents 三套 `newwave-a-browser-3.log/.exit` exit 0、206 passing（session 56578）。运行/终态指纹一致，不借别槽 JS。第一次本轮浏览器启动在 xvfb-run mktemp 即遇根盘 /tmp ENOSPC（根盘可用 0），`newwave-a-browser-2` exit 1 未启动 Electron；未删除任何文件，使用本波独占 TMPDIR 和已存在 DISPLAY=:1 后官方测试成功。自动层成功不代表独立 OV、真实默认窗口或真实引擎持久化已通过；D1395 仍 open，方案不升整体 implemented。

B 窄诊断候选（production aad24c82 未改 / test 8acf9192）在 A 全部终态后由唯一通道运行原两方法：non-Git 外部目录证明修正通过；config selection 仍失败，2 方法 1 pass / 1 fail，exit 1，日志 `newwave-b-two-diagnostics.log/.exit`。新增原生 Git 对照在同环境 COUNT/core.worktree 下也返回 parent，configured_identity 亦 parent；最终环境仍有 parent 的 GIT_WORK_TREE 与 alternate index，不能仅依据该失败就认定 Wiki 重分类错误或直接改期望。精确诊断已交父/Astra裁定后由唯一作者修改；未借局部结果关闭 D1394。

A 已完成同主题本地提交 `1ec07a675d5b881ec5fdafcbd9f30598a72dcd31`，8 paths 全部 Included（生产/两测试、catalog 知识、Tools 方案、S3 自动层证据、gaps 与行动层）；A 工作区 clean，提交 blob 与固定清单逐项相同。最终独立 OV C0/I0/M0 PASS；文档 health/wiki/generated/diff 均 0，原 hooks 正常执行 exit0（A 仍旧 wiki，使用已授权仓外定位清理 wrapper 保 absolute A index，无 skip）。A 状态为 merge queued，未单域 merge/push；D1395 真实验收仍 open。

B 最终 `cfb50ec4/d46c361d` 的完整 18 方法真实 Git 矩阵 exit0，独立源码/测试设计复审 READY C0/I0/M0。同主题知识/reference 两规范、README、plan/action/gaps 已同步；文档 health0errors、wiki working0errors337warnings、staged0（有 baseline-stale 既有警告）、generated0、docs-status8/0、diff0。7 paths 精确 scope/hash 在 `.coordination-20261102/newwave-b-docs-scope-hashes.json`；最终运行/文档签收待，D1394 暂 open、B 未主题提交，不借 D 原4项替代18矩阵。

B 综合 OV 最终 PASS C0/I0/M1、CommitGate READY，父调度采纳；报告 HEAD/dirty 改成 selected-root 实际所属仓库、primary 时保 alternate index 的 Minor 已改。D1394 本地代码/自动层 closed，Wiki plan implemented 并由生成器同步 INDEX；8 paths 同主题原 hooks 无 wrapper commit `cb784d97706`，clean，提交 blob 与精确 manifest 一致。两槽现均 merge queued，尚未集成/发布；Task Inspect D1396 open 后排、D1395真实验收 open。
