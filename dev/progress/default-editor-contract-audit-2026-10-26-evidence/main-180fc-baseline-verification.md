---
title: "主工位180fc已提交UI基线安全接入与完整编译"
type: progress
status: active
phase: M7
updated: 2026-10-26
summary: "ad80真三路接入180fc，78路径保留且src精确030def；全量compile-client真实exit0，旧65d虚拟30JS已非live，J/E候选与after仍待。"
---

# 180fc 已提交基线接入与编译

唯一 merge 工位从 clean `54c53c4399d4a0c212ed0d8a3b59a0406503a3ed` 真三路吸收明确的主工位已提交 `180fcdbb4ec9fda12a15c3daa6fa48a5e4e742c1`，形成 **`ad80c9fe1cfaaa250ea0eac9e05de6d780f984c2`**。结果 **`src` 子树 `030defda3cc7cfac7148e84fac470a3bf5098d06` 精确等于 `180fc:src`**。随后实际执行 **`rtk proxy npm run compile-client`，exit 0、0 TypeScript 诊断**，原生日志记录 compile-src 0 errors。此源树是本次被实际完整编译的基线，不再把此前 932031 绿树称作当前已提交基线。

## 已提交范围与真三路保留

只读核验时 main 已提交 HEAD 就是 180fc；未读取或取用 root 文件系统 WIP。共同 merge-base 为 `3d522e76b9985181fa4bdfc654d52c9951f87aed`；ours 相对它只有文档，theirs 15 路径中 4 个生产 CSS 为 Connection / Engine 偏好、Sessions inline filter、Sources tabs，其余为既有控件精修方案/状态/验收证据。不是 J/E 字母槽代码正式接入，也没有重试主 ff。

[完整逐路径保留门禁](main-180fc-baseline-merge-identity.json) **78 路径全部 PASS**：用 `git ls-tree` 比较 base / ours / theirs / result 的 mode 与 blob；单侧修改逐字保留，双方相同结果一致。唯一 both-changed 为 `dev/progress/status.md`：合成保留 ours 四条新增历史与 main 一条控件精修记录，移去那条精确 main 新增行后，result 字节与 ours 完全相同；双方实际 diff、精确新增行和 SHA 均保存，未以任选一侧吞掉记录。[merge 原日志](main-180fc-baseline-merge.log)保留最初冲突；[合入前范围/旧pack快照](main-180fc-baseline-pre-merge.json)绑定不可变来源。新规范、状态、索引、控件精修方案及其验证原件均保留。

本仓没有 `scripts/check-merge-both-sides.sh`，没有执行不存在的 Bash 门禁；上面的逐路径 blob/mode 比较和 both-changed 字节/双 diff 证据是本次实际等价检查。项目入口见 [health-gates](../health-gates.md#合并两边保留门禁按需)。

## 本次完整编译与产物身份

[实际命令/源树/进程与34份前后产物身份](main-180fc-compile.json)、[原始完整编译日志](main-180fc-compile.log)与[原样执行runner](main-180fc-compile-runner.py)绑定本次运行。编译前全局 compile/typecheck/transpile 进程扫描无匹配，未重复起车道或终止外部任务。开始 `2026-10-26T15:33:04.837902+00:00`，结束 `2026-10-26T15:33:26.330800+00:00`；编译前后 HEAD、src 树、clean 状态都未变。没有当前 TypeScript 诊断需要抑制或修补。

原生 emit 已改写选定的 **30 个旧65d pack JS 和 4 个 CSS，34 个 SHA全部变化**；四份 CSS 产物与当前对应源码字节 SHA 一致。34 份记录是明确的相关产物身份范围，不冒称已逐文件枚举整 out。当前 native out 来自 180fc 对齐基线；旧65d pack身份已非live，未复用旧hash作freeze，也不消费其357绿作为当前新宿主算法的验证。实际输出范围不含 J bf50 后的宿主修复或 E unary 恢复。

此前 [65d不可变叠加验证](d1387-preintegration-verification.md) 的357过、R1/R2旧业务红、虚拟noEmit0、wiring既有红与51份原始artifact保持历史证据；最初 [编译合同45→3→0与Electron325/3基线](compile-baseline-verification.md)也完整保留，未复跑或覆盖这些计数。本轮没有重跑外部控件作者的UI矩阵或非作者after，不把其旧loadedJS记录改成当前native emit身份。

## 同步边界与后续

上轮单次 `ff-only a7123fb` 的拒绝是 **main已提交180fc而旧目标尚未包含该提交**，不是仅由未提交文档导致；独立WIP当时也被完整保留，见[原拒绝身份](d1387-main-ff-attempt.json)。本轮只把 merge 源码基线对齐，**没有再次主ff，没有写root out，没有push**。main之外部WIP和继续前进的Git提交由父后续重新核验，本报告不把其文件系统WIP算作已绿。

J/E 仍各自从既定09f6完整实施，候选不可变SHA到达后再对最新基线真三路保留、运行必要实际全量/完整相关测试/非作者after；当前不formal合J/E，不发D冻结通知，不关闭D1387或提升产品状态。唯一编译车道继续由 baseline_executor 持有。

[本轮原始证据清单](main-180fc-baseline-artifact-inventory.json)按字节保留原日志、命令、门禁、runner及SHA；日志ANSI/尾空格不清洗。文档门禁与后续纯文档HEAD不改变本次编译源树身份。

## 文档收尾门禁

本轮 `generate-docs-status.py --check` 通过；[最终文档健康原日志](main-180fc-final-docs-health.log)为 0 errors / 46 条既有链接 warning，扫描 579 份 Markdown；`status.md` 为 177 行。提交前逐字复核原51份artifact零变化，当前34份native产物及其源码SHA全部吻合本轮compile记录，4份CSS源/产物一致；`git diff --check` 排除保留ANSI/尾空格的原始 `*.log` 后通过。仅提交本主题文档与证据，不改变上述被编译的src树。
