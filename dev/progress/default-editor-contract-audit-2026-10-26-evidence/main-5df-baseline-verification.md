---
title: "主工位5df已提交协议基线安全接入"
type: progress
status: active
phase: M7
updated: 2026-10-26
summary: "231b真三路接入明确main5df，119路径保留且src精确7fa3c86；无新emit，34native仍ad80身份，J/E正式接入/完整新绿待。"
---

# 5df 已提交源码基线接入

只读核到 main 已提交 `5df17cb7273f490ccd59818dccba479fa80848dc`（父为协议实施 `7cf3f7a9c12`），仅取该明确不可变Git提交从 clean `02261c77e180b46c719918c7b1dae90dd460b328` 真三路接入 **`231b7bb7529dcebd3faccf6aac0b13bf4f8460c8`**。结果 **src `7fa3c86d152420afeb66c6038bd961bb6d5b8f4b` 精确等于 `5df:src`**。未消费root文件系统WIP，未触碰root out、未重试主ff或push；J/E代码尚未正式接入。

相对共同base `180fcdbb4ec9fda12a15c3daa6fa48a5e4e742c1`，ours为85份文档/证据，theirs为35路径（25TS与10文档）。明确范围是已提交的协议字段、两条正式RPC、能力/IPC/transport/mappers及相关测试、engineToolProfile显式0保留，另含已经提交的队列/技能后续方案；未自行实施该后续方案，也未把外部作者验证当本车道新结果。

[119路径保留门禁](main-5df-baseline-merge-identity.json)全部PASS：逐路径比较base/ours/theirs/result的Git mode/type/blob；唯一both-changed `dev/progress/status.md` 以ours原字节加main精确3条新增记录合成，移去这3条后结果与ours原字节完全相同，双方diff/原精确行/字节SHA均存。没有任选一边吞掉旧red或外部协议/视觉记录。[合入前范围](main-5df-baseline-pre-merge.json)、[merge原日志](main-5df-baseline-merge.log)保留真实冲突与处理边界；不存在的`check-merge-both-sides.sh`仍未执行，实际方法沿用[本地门禁入口](../health-gates.md#合并两边保留门禁按需)。

**本次没有编译、typecheck、transpile或写out。** [ad80完整compile-client0](main-180fc-baseline-verification.md)只绑定030def源树；当前7fa3c86不能沿用为已全量编译0。34份明确native采样SHA仍逐字等ad80原生emit，不冒称现在整个out与最新已提交源码同构建。[J/E旧业务验证](je-preintegration-old-red-verification.md)的测试组合及恢复事实独立保留，不把它们称为5df新生产green。

最终J/E候选及独立peer可接受后，再真三路保留两模块、串行实际完整compile-client与完整相关新green；开车前同时核全局活跃compile/typecheck/transpile进程与共享`/tmp/vscode-compile.lock`，不杀外部任务或重复启动。原ad80编译及各历史raw清单不覆盖；不在过渡源码基线重复完整emit。无freeze/非作者after，方案/PRD不升级。

[本轮5份原始清单](main-5df-baseline-artifact-inventory.json)保留原字节与SHA；[合入文档health](main-5df-baseline-merge-docs-health.log)实际0 errors / 46既有链接warnings、582 Markdown，生成状态`--check`通过。后续纯文档HEAD不改变上述已提交src身份。

最终文档收尾[health原日志](main-5df-final-docs-health.log)为0 errors / 46既有链接warnings、583 Markdown；生成状态`--check`通过，status182行，排除原始`*.log`后的diff空白门禁通过。
