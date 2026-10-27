---
title: "Conversation lease：engine Pane setup 失败诊断"
type: plan
status: accepted
phase: M7
updated: 2026-10-27
summary: "root接受9a9a并采纳原Astra窄验C0/I0/M0关闭I1；仅A失败报告源码候选已写，原等待/业务断言不变、逆变换精确d8e；source peer与真实三路待，无作者AST/lint或运行，仍accepted。"
---

# Conversation lease：engine Pane setup 失败诊断

本方案原稿固定 E parent `19663010fddefe6193165962284e7f599c95d555`，本次审查修订固定 parent `247210e3920ea307260814fa606bfe016ff32b37` / src `923acdffaf236f826bc9d2e69d924159aa217ac0`，不追 merge/main。它补足[现 accepted lease 方案](conversation-visible-lease-recovery.md)之前的 setup 诊断，不更改其合同、业务断言或状态；[既有 after 只读输入](../progress/lease-after-inputs-20261027-evidence/INDEX.md)仍仅为输入。**root已接受9a9a并采纳原Astra窄验C0/I0/M0关闭I1，仅另授权A失败报告候选；现source peer与真实三路待，未授权B工具准备或执行。**

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

root转述原Astra审查 **C0/I1/M1，root采纳**：I1为工具 `prerequisiteEvidence` 无条件误称已到647；M1为engine helper已有 `openErrors` 未输出且缺公开终态。原稿据此收窄，但不伪作完整raw peer。现有失败并未提供具体root cause，也没有生产缺陷、竞态或机器慢的依据。

## 2. A：仅 test 失败报告候选

A获准后的唯一源码范围是[现 Reveal test](../../src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts)的engine setup helper及必要传参：把调用者已经收集的 `openErrors` 接入失败报告；不改生产Pane、默认Quiet路径或通用等待语义。

- 原 `3000ms` bounded、事件过滤等待、`finally ready.cancel()`、成功返回及所有业务断言原样保留；不延时、不重试、不改超时为成功，不把输出本身当业务断言。
- 只在原engine setup失败分支尽量读取一次公开终态：已有 `openErrors` 各项的类型/message/stack；目标part及其公开 `sessionKey`；`activeGroup.id`、`activeEditor.resource`、`activeEditorPane.getId()`及 `instanceof ConversationEditorPane`。缺值按缺值记录，不推断未观测的过程；诊断读取/格式化失败也不得遮蔽原始错误、message和stack。
- 不在成功路径额外采样，不新增observer、acquire、reopen、focus、restore、polling、服务替身或任何生产写；保持13新case、原26/defaultQuiet及原assertion预期。原 openErrors 收集方式不变，不安装新的错误监听器。
- A候选先交root固定身份核验和原reviewer源码peer，再经root真实三路接入唯一merge baseline；方案accepted及源码peer/接入本身均不授予A实施或运行。

## 3. B：单独释放的一次诊断专用运行

只有规则16签收、A另行获准实施、源码peer与真实三路接入完成后，**唯一非作者merge baseline**才能另行准备fresh诊断专用一次性；准备与执行仍需root分别释放，不重试或改写已consumed d8e driver。冻结唯一source/native、输入与新driver身份，保留旧原件；本工位不准备工具。

该专用运行只把新Reveal配旧Pane，仅选 **L1与official meta**。checker/lint/dry/必要单Reveal刷新等具体前置由该fresh工具单独审查，不能借本方案授权。无论setup再败、到647、L1通过或其他结果，均 **stop → owned quiet → restore**；绝无自动Pane emit、fullnew、after或重试分支，任何结果均不升级业务red/green或after信用。

未来新qualification只有实际 `boundary=true` 时才写与该次真实source map一致的qualified前置说明；其他结果写 **`expected old-red boundary not established`**，保留实际outcome、stack与mapped frames。只有如本次445/455能从actual stack与fixed controlflow定位setup先失败时，才明确未到647断言；L1 pass记录actual pass，但不授业务red/green信用；无法定位则记unknown。任何conditional false都不得抹掉已达事实，也不能从静态预期、计数或boundary=false反推未到647。实际错误/官方计数、hooks、map与原始stack分开保留，不回写旧consumed qualification。诊断结果仅属本次观察，后续正式验证另需授权。

## 4. 写入资格、恢复与停止边界

继承已采纳I1恢复协议：以实际PID/start、parent单phase资格及同phase可信journal交叉确定实际写入/部分或不确定尝试的子集，不能仅凭文件漂移或successful report授权恢复。先确定全部owned quiet，再按真实子集还原；未写路径的ctime不修、不touch，不用统一列表覆盖输出。B最多具有单Reveal phase写入资格，Pane及全部其他out/native始终只读。新guard须以本次46fc实际guard核原身份与唯一Reveal ctime，保留全owned停机、写入journal、恢复集合和恢复后核验，失败即停交root。

此前纯计划落盘只运行docs generator/health/diff与只读保护核对，当时全部src、outputs、三Sources plan/dispatch JSON、旧static/docs及d8e工具/原件不动；当前仅A源码候选的授权与边界见§7。任何本轮动作均不释放B或after准备，不升PRD/旧D/波。

## 5. 规则16审查与root裁定（2026-10-27）

root提供原reviewer Astra直接消息的正式规则16结果：对固定247210原稿 **C0/I1/M0**；root独核后全部采纳I1，并明确承认其此前“false→not reached”的建议同样过强。来源为reviewer/root会话消息，本仓没有对应formal raw peer，不伪造报告。I1要求boundary未建立时保留真实outcome与已达事实，按上文§3落入；本次445/455的具体setup定位事实保持，旧consumed原件一字不改。

依root明确裁定，本独立方案改为 `accepted`，只勾规则16；原3s/事件/finally cancel/成功返回/业务断言、A仅报告、B单Reveal+旧Pane/L1+official meta/任意结果stop/restore及独立工具gate全保持。本次固定commit交root逐字核与原Astra窄验，在root独核接受前不得实施；accepted不增加任何runtime或业务red/green信用。

## 6. 后续审查入口

- [x] 原Astra规则16 C0/I1/M0/root采纳；root接受9a9a并采纳原Astra窄验C0/I0/M0关闭I1，方案 `accepted`。
- [ ] A独立实施已授权、test-only候选已写 → 源码peer待 → root真实三路待。
- [ ] 唯一merge baseline另备fresh诊断专用工具并审查；root单独释放一次B。
- [ ] 任意结果停机/恢复/原件交付；正式业务验证另行裁定。


## 7. A失败报告源码候选与作者只读边界（2026-10-27）

root已独核固定9a9a，采纳原reviewer Astra正式窄验C0/I0/M0关闭规则16 I1，再单独授权本节A；来源为root提供的reviewer直接消息及root裁定，不伪作formal raw peer。本候选固定parent `9a9a833993803055f6f4427b5268ed93a57dc4d2`，不导入main/merge或Sources后来增量；现diagnostics及原lease方案仍accepted，source peer待，不自动进入B。

唯一源码改动为Reveal的`waitForEnginePane`与两处engine初始化调用的既有openErrors传参。原等待正文仅因局部try重缩进：3000ms/shared bounded、whenReady、事件filter、finally ready.cancel、成功返回及全部业务断言保持。catch只在原失败后取一次公开终态（part windowId/sessionKey、groupId、activeEditor resource、activePane getId/instanceof）与已有openErrors的type/message/stack，完整JSON成功后用`Object.defineProperty`给**同一原Error.stack**追加诊断后缀；原type/message与原stack完整前缀保持。读取/格式化/append失败由诊断内catch吞掉，再原样throw原错误；非Error值仍原样throw。没有成功路径额外读取、observer/acquire/reopen/focus/restore/polling/延时/替身或生产写。

源码peer必要输入：[官方renderer console机制](../../test/unit/electron/renderer.js#L266)的266–273把测试console输出标为unexpected，338–340会使teardown失败；现有391–400/445序列化并发送原错误stack。此为固定源码只读事实，**未运行runner**。root采纳范围内处理：不用console或新reporter，JSON构造完整后才附加原stack后缀，防止诊断另造hook失败或掩盖原错误。

可独立复核的字节逆变换：以Git d8e的完整`waitForEnginePane`替换候选同名helper（起于该函数签名，止于下一`createEngineRevealHarness`前），并把`waitForEnginePane(primaryPart, openErrors)`与`waitForEnginePane(partFor(harness.parts, harness.primaryId), harness.openErrors)`两条调用各自去掉新增参数；结果逐字等于**整份**d8e Reveal，80259B / SHA-256 `110f7f43b5808af9a01d3ea0fdf6ab68aa4fa4dc9309e029f7f912405ced8646`。候选81489B / SHA-256 `dbc9066b2206e8f74422aac7cc4b8ed14cb57800df91f800c3ff3efeb54adbb0`；完整13新/26旧/defaultQuiet、全部L1断言与生产Pane保护。647只指旧d8e历史定位；当前文本断言行674仅静态计数，未来candidate实际行须由其真实source map冻结，不能为守行号改断言。

作者只做只读字节/metadata/逆变换、diff与docs门禁；**没有AST/lint/Program/typecheck/compile/transpile/emit/tests/UI/engine或工具准备/out/cache写**，不声称语法/语义/业务通过。fresh保护仅本次区间：除该Reveal外src metadata、全部outputs metadata与旧consumed工具/原件保持；历史失败与after输入不改。固定candidate先交root核→原Astra源码peer，之后是否真实三路及准备B由root另行裁定。
