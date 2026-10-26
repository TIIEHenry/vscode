---
title: "J监听夹具补修后的两项并发旧业务红"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "4d49新测对精确65d旧helper，2 settles-first均纯身份业务红，listening=false无夹具差异；34native身份恢复；D核心C0/I0及M1闭合报告已仅文档接入，E仍C0/I3补修。"
---

# 两项并发旧业务红复验

J不可变补修 **`4d4906163044929c1b7b7a7ed40693a2cd4a9a91`** 的测试全文精确等于1ac原测试8处`hasListeners`改成`hasListeners()`，新测试SHA256 **`02a6263e06688776dd5b86225857a1247624641c5f74ab6a804bfc2a1109dd3d`**。相对1ac生产diff空，候选新helper仍`45cf6d831abda7efd46ae2121b520c5f142282caa079f0e913da8312bf73741a`；本次**没有加载该新helper**。

[实际runner](j-4d49-overlap-old65d-red-runner.py)在clean`114fd4ee6df451040989d4f716c24628357f8b31`、src`7fa3c86d152420afeb66c6038bd961bb6d5b8f4b`上，只临时转译该新测试与精确旧生产`65d2288036fdad74ab607e231d3db758fa397aa8` helper（SHA256 `f13693e1de22a0a2b60e966ced1bcdef0d79a9257195b8637fa2cc474bccad37`）。先核全局compile/typecheck/transpile进程无匹配，并独占`/tmp/vscode-compile.lock`直至测试/恢复完成。实际UTC开始`2026-10-26T16:06:28.632293+00:00`、结束`2026-10-26T16:06:30.624155+00:00`，没有把本地日期回填运行时间。

selector `Sources overlap same tuple .*settles first` 实际只加载g1/g2两项，**0 passing / 2 failing、exit1，均AssertionError业务红**，见[完整原日志](j-4d49-overlap-old65d-red.log)：

| 实际结算顺序 | 旧实现实际身份 | 应保留身份 | 其他断言 |
| --- | --- | --- | --- |
| g1先结算 | `groupId:g2 / sameResource:false` | `groupId:old / sameResource:true` | `calls:[1,1]`、`listening:false`、`trace:[]`均符合 |
| g2先结算 | `groupId:g1 / sameResource:false` | `groupId:old / sameResource:true` | `calls:[1,1]`、`listening:false`、`trace:[]`均符合 |

失败只剩准确身份被最后结算者抢写；不再含函数对象/listener夹具差异，没有缺加载、TypeError、类型、scan或timeout充数。原[1ac两项混夹具失败](je-preintegration-old-red-verification.md)和原日志完整保留，由本次干净旧红补足门禁。已成立的4项official host旧业务红没有重复运行，原14根因、R1/R2及357历史套也未覆盖或重跑；新29项green与正式完整相关套仍待。

[本次源/JS/命令/锁/恢复身份](j-4d49-overlap-old65d-red-identity.json)记录两份临时JS在finally以原字节恢复；HEAD/src/clean前后不变，**34份明确native采样SHA全部恢复为ad80原生编译身份**。当前main5df/7fa3c86源码尚未由本lane新emit，不把此次旧业务测试组合或恢复范围称为整out与当前源同构建。

## 独立peer原件接入

D报告不可变 **`0aef80980ae42692562b163deaef7a01bda2e512`** 已实际读原文，确认核心peer C0/I0，8方法调用补修M1在源码层关闭，静态C0/I0/M0；不再把J列为peer待。[完整原报告与增量](d1387-host-observation-code-review.md)保持D原字节，D没有运行本次2 red或新green，也没有执行after。

仅把该D提交的两份peer/plan-review文档真三路接入 **`95ce8922efcce39b762da47105d74000fbb889d7`**，没有合J/E源码。[192路径mode/type/blob保留门禁](j-4d49-D-peer-docs-merge-identity.json)全PASS、无both-changed，src保持7fa3c86；[原合入前范围](j-4d49-D-peer-docs-pre-merge.json)、[merge原日志](j-4d49-D-peer-docs-merge.log)与[health原日志](j-4d49-D-peer-docs-health.log)保留。不存在的Bash门禁未执行，本次实际使用Git对象逐路径比较。

J4d49可保持模块queued，**E900f仍实现peer C0/I3、occupied补修**，三项及原报告未入库边界见[当前补修阶段](je-peer-rework-2026-10-27.md)。整波仍不formal合J/E、不全量emit、不freeze；E不可变修订/独立复读接受后再按父安排统一正式三路、完整编译/完整套/非作者after。无main WIP/root out写入、无主ff重试或push，D1387/方案/PRD不升级。

[本轮原件清单](j-4d49-overlap-red-artifact-inventory.json)保留runner、原日志、实际命令、源/产物身份和D纯文档门禁的完整字节，ANSI/尾空格不清洗。

最终文档收尾：生成状态`--check`通过，[health原日志](j-4d49-final-docs-health.log)0 errors / 46既有链接warnings、586 Markdown，status184行；排除原始`*.log`后的diff空白门禁通过。
