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

表中分支只是预定，尚未创建或重占；原槽分支保留，后续用新 branch 创建，禁止 checkout -B 覆盖历史。两成员被冻结，不按函数拆更细，不纳 Task Inspect。作者不自行裁定最终 OV。

## 外部与工作区保全

主工位仍 `agent-ide=629d8b33df8` 加原 WIP；上一波 ff-only 因 status/roster 路径重叠被安全拒绝，81 文件 hash/状态字节不变，不 reset/stash/restore/clean。C `cabefc81b36`/D `9d4719459aa` 是其他候选，C 还有未知计划与过程 WIP，全部保留不接管、不把文件或状态复制成当前集成事实。

B 按已批准边界在独占槽先真三路 merge D 的 9d471 原 commit，再补残余；只采 wiki 主题，旧工位快照不盖本波/D1393，不整树合 C。integration 统一合成文档，B 不占共享账。其他旧 worktree 不在本波处置范围。

## 验证与当前事实

- 上一波完整发布与安全同步见[归档](../../../archive/dev/parallel/active/session-owner-wave-2026-11-02.md)。Tools 基线外部三套 163/1，唯一呈现债按 D17/[D1395](../../progress/deferred-gaps.md) 登记；D1393 已闭合，D1394/D1395 仍 open。
- 两份正式方案已分别完成实际文本规则16：Tools 首轮 C0/I3/M1、Wiki 首轮 C0/I1/M0，必要意见全部改入；Tools 修订正文及运行边界补充、Wiki 修订正文均获 C0/I0/M0 APPROVED。父调度采纳，方案 accepted，独立 docs commit 后才建新分支实施，不把签收当运行通过。
- 开发者仅写独占 production/tests，不起 compile/noEmit/transpile/tests/eslint；integration 所有检查串行，不并行安装、out/.build 各槽独立。验证失败按真实 baseline/新增分类，不删原断言/不伪造绿。
- 本波代码/工具验收不自动等于真实默认窗口、真实引擎或全产品验收。Tools 方案另列默认窗口与真实引擎持久化回读门；未实际验证则 D1395 保持 open、方案不升整体 implemented，代码自动层与 Wiki 仍可按各自证据推进。双域均可合入后同 wake 关仓，不能单域抢跑释放或扩成员。

## 门与下一动作

- [x] 两份方案规则16只读审查，必要修订落盘。
- [ ] 独立 docs commit；A/B ff-only 跟其 SHA 并创建新槽分支。
- [ ] 各域一名作者实施；B 保留 9d471 身份后续修；共享文档由 integration 维护。
- [ ] 唯一通道检查与非作者 OV，主题提交包含代码/测试/必要知识/行动层。
- [ ] merge 两边保留、组合检查、正常 push、P6/P7 安全同步与 WIP 对照。
