---
title: "Conversation lease：engine Pane setup 失败诊断"
type: plan
status: draft
phase: M7
updated: 2026-10-27
summary: "d8e唯一lane在engine Pane setup失败、未到647；拟只补失败报告，后经规则16/源码peer/真实三路由唯一merge baseline另备一次诊断专用Reveal+旧Pane运行，任意结果stop/restore；未实施。"
---

# Conversation lease：engine Pane setup 失败诊断

本草案固定 E parent `19663010fddefe6193165962284e7f599c95d555` / src `923acdffaf236f826bc9d2e69d924159aa217ac0`，不追 merge/main。它补足[现 accepted lease 方案](conversation-visible-lease-recovery.md)之前的 setup 诊断，不更改其合同、业务断言或状态；[既有 after 只读输入](../progress/lease-after-inputs-20261027-evidence/INDEX.md)仍仅为输入。**待规则16只读审查；本次只写计划，未授权 A 实施、B 工具准备或执行。**

## 1. 已发生事实与原件

唯一 merge baseline 在 `b7dd43f1a523673bf5bdf65ae7950fe0c622adf3` / src `62996b35d6e417c0b46a1f7e79b632414008b5be` 对 d8e sourceRef 消费过一次 fresh driver，实际 exit1。已有 checker 两target syntax/semantic 0，lint/dry/emit-Reveal各exit0；不是本作者重跑或全项目semantic通过。old官方仅2tests：meta pass1、L1 fail1，10对hooks完整。实际失败是 `real engine ConversationEditorPane must open`，fresh map对应源栈 **445→455→433→517→628**，未到647的 lease 业务断言，故不是合格旧业务red。没有 emit Pane 或完整新矩阵。

原件目录为 `/tmp/vscode-conversation-visible-lease-d8e-validation-20261027-prep1`；下面都是已存在原件，本轮只读，不修订 consumed 输出或重用旧 driver。

| 原件 | bytes | SHA-256 |
| --- | ---: | --- |
| [validation-report.json](/tmp/vscode-conversation-visible-lease-d8e-validation-20261027-prep1/validation-report.json) | 140258 | `55922b17101c035ac376b02ff6e29e647e2348af553cef3cb4134273bd2cbddd` |
| [old-L1.qualification.json](/tmp/vscode-conversation-visible-lease-d8e-validation-20261027-prep1/old-L1.qualification.json) | 10157 | `6e725f896d57ac5194446e22f99a72a69f8ae2f84894f3edc7d97074411ac66d` |
| [fresh-Reveal-source-map-report.json](/tmp/vscode-conversation-visible-lease-d8e-validation-20261027-prep1/fresh-Reveal-source-map-report.json) | 436 | `51667f29e4d2573acc501fc0dcf554ef13ca46ad04eeabb610273d443a7f7243` |
| [guard-after-restore.json](/tmp/vscode-conversation-visible-lease-d8e-validation-20261027-prep1/guard-after-restore.json) | 4212816 | `46fc959b355c9e922a7cb7e9a74919956c5647a595ad88347a083449d8cfb51e` |
| [restoration-scope-audit.json](/tmp/vscode-conversation-visible-lease-d8e-validation-20261027-prep1/restoration-scope-audit.json) | 3105 | `2d8032eee4d4bd93bc5ad7b5061d3a7df60dead32018bb21cf35e9c339cad133` |
| [execution-consumed.json](/tmp/vscode-conversation-visible-lease-d8e-validation-20261027-prep1/execution-consumed.json) | 207 | `4550ba23e90b3264d934cb47fe8f1c098d6a11c5da8ea649fd910ae3a72db161` |

`validation-report.json`记录先全部 owned quiet 才还原，实际恢复集合仅 Reveal；`guard-after-restore.json`的唯一获准新ctime是 Reveal `1793092686521596622`，Pane未写。未来恢复起点须绑定该 **46fc959b…实际guard** 与它对应的 bytes/mode/mtime/ctime/source/native 身份，不盲用前一份54fe guard；若届时固定baseline另变，先重新授权核验，不能自行改基线。

root转述原Astra审查 **C0/I1/M1，root采纳**：I1为工具 `prerequisiteEvidence` 无条件误称已到647；M1为engine helper已有 `openErrors` 未输出且缺公开终态。本草案据此收窄，但不伪作完整raw peer。现有失败并未提供具体root cause，也没有生产缺陷、竞态或机器慢的依据。

## 2. A：仅 test 失败报告候选

未来获准后的唯一源码范围是[现 Reveal test](../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts)的engine setup helper及必要传参：把调用者已经收集的 `openErrors` 接入失败报告；不改生产Pane、默认Quiet路径或通用等待语义。

- 原 `3000ms` bounded、事件过滤等待、`finally ready.cancel()`、成功返回及所有业务断言原样保留；不延时、不重试、不改超时为成功，不把输出本身当业务断言。
- 只在原engine setup失败分支尽量读取一次公开终态：已有 `openErrors` 各项的类型/message/stack；目标part及其公开 `sessionKey`；`activeGroup.id`、`activeEditor.resource`、`activeEditorPane.getId()`及 `instanceof ConversationEditorPane`。缺值按缺值记录，不推断未观测的过程；诊断读取/格式化失败也不得遮蔽原始错误、message和stack。
- 不在成功路径额外采样，不新增observer、acquire、reopen、focus、restore、polling、服务替身或任何生产写；保持13新case、原26/defaultQuiet及原assertion预期。原 openErrors 收集方式不变，不安装新的错误监听器。
- A候选先交root固定身份核验和原reviewer源码peer，再经root真实三路接入唯一merge baseline；源码peer/接入本身不授予运行，也不把本draft视为已签收。

## 3. B：单独释放的一次诊断专用运行

只有规则16签收、A另行获准实施、源码peer与真实三路接入完成后，**唯一非作者merge baseline**才能另行准备fresh诊断专用一次性；准备与执行仍需root分别释放，不重试或改写已consumed d8e driver。冻结唯一source/native、输入与新driver身份，保留旧原件；本工位不准备工具。

该专用运行只把新Reveal配旧Pane，仅选 **L1与official meta**。checker/lint/dry/必要单Reveal刷新等具体前置由该fresh工具单独审查，不能借本草案授权。无论setup再败、到647、L1通过或其他结果，均 **stop → owned quiet → restore**；绝无自动Pane emit、fullnew、after或重试分支，任何结果均不升级业务red/green或after信用。

未来新qualification仅在真实映射证明 `boundary=true` 时写qualified前置说明；否则明确 **`not reached` + actual mapped frames**，不能从静态控制流、计数或预期失败推断647前置已完成。实际错误/官方计数、hooks、map与原始stack分开保留，不回写旧qualification中的错误文字。诊断通过也只证明本次setup结果，后续正式验证另需授权。

## 4. 写入资格、恢复与停止边界

继承已采纳I1恢复协议：以实际PID/start、parent单phase资格及同phase可信journal交叉确定实际写入/部分或不确定尝试的子集，不能仅凭文件漂移或successful report授权恢复。先确定全部owned quiet，再按真实子集还原；未写路径的ctime不修、不touch，不用统一列表覆盖输出。B最多具有单Reveal phase写入资格，Pane及全部其他out/native始终只读。新guard须以本次46fc实际guard核原身份与唯一Reveal ctime，保留全owned停机、写入journal、恢复集合和恢复后核验，失败即停交root。

本次计划落盘只运行docs generator/health/diff与只读保护核对；全部src、outputs、三Sources plan/dispatch JSON、旧static/docs及本次d8e工具/原件不动。不运行Program/typecheck/compile/transpile/emit/tests/UI/engine，不写out/cache，不升PRD/旧D/波，也不释放after准备。

## 5. 后续审查入口

- [ ] root与原Astra完成规则16，只读审查并由root裁定改稿；当前 `draft`。
- [ ] A独立实施授权 → test-only候选 → 源码peer → root真实三路。
- [ ] 唯一merge baseline另备fresh诊断专用工具并审查；root单独释放一次B。
- [ ] 任意结果停机/恢复/原件交付；正式业务验证另行裁定。
