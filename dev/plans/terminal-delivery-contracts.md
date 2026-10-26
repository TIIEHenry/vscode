---
title: "终端命令投递与沙箱安装的送达合同"
type: plan
status: implemented
phase: M7
updated: 2026-10-26
summary: "D1377：正式送达/拒绝合同与27项新行为已验证；原11套件加Xterm共512 passing、109既有pending；marker wrapper归属和Delayer Promise补修恢复已有合同，独立审查无阻断。"
---

# 终端命令投递与沙箱安装合同

## 根因与边界

当前 [follow-up 编译日志](../progress/ui-visual-review-2026-10-26-evidence/followup-compile-client.log) 的终端组为 8 条：`sendPath` 直接返回 boolean；3 个 `terminalInstance` 测试替身和 `outputMonitor` 替身仍返回 void；分栏移动测试把目标实例当下标；两个 RunInTerminal 前置条件入口共用的安装 terminal 抽象仍声明 void。

现有 [r10 终端方案](review-2026-10-24-r10-terminal-notebook-plan.md) 已规定 `sendText: Promise<boolean>`：true 仅表示输入已交给当前进程，不表示命令成功；false 不发送已送达/已执行事件。按用户指定的原则驱动设计（来源 `/home/clarence/Projects/UniverseSoftware/skills/principled-design/SKILL.md`），保持底层拒绝可表达且不制造无处理的 Promise rejection；在需要完成或失败的上层边界处理结果。

## 修复与取舍

1. `sendPath` 保留 `Promise<void>` 正式 API，显式等待 `sendText`；false 转为本地化投递失败。Run Active File 由命令框架处理错误；tab 拖放在路径投递处也交给通知服务（外层既有异常链保留处理其他拖放错误）；终端本身的文件拖放监听补就地通知，避免异步事件漏 rejection。成功仍解决为 undefined，不能为了消除诊断把原 void API 改成 boolean。
2. `runCommand` 保留 `Promise<void>`，发送 Ctrl+C 或命令本身返回 false 时立即拒绝；Ctrl+C 被拒绝不得继续发命令。Rich 策略 await 这份 Promise；Basic / None 等待 `sendText` 并检查 false，清提示输入的 Ctrl+C / Ctrl+U 也相同。拒绝先于后续 shell 完成 / idle 判断，避免借旧退出码或空输出报告成功。三种策略的 finally 继续清理其局部监听。
3. 逐个封住 void 调用方：history picker 与 quick-fix 事件使用终端通知出口；inline chat 的 `acceptCommand` 自行捕获并交给通知出口，投递成功才清掉建议；free-port retry await；MainThreadTerminalShellIntegration `$executeCommand` 保留 public void 方法，显式 catch 交给通知出口，不改 Ext Host RPC / API 类型。命令框架内的 await 继续原样传播，不把 false 当 accepted。所有裸事件 Promise 都有 catch；终端 UI / MainThread 注入既有 `INotificationService`，失败交给 `error()` 通知，不依赖可能再抛的全局 unexpected handler，也不以重复 catch 伪装成绝对安全。
4. `ISandboxDependencyInstallTerminal.sendText` 改为 `Promise<boolean>`，参数与 `ITerminalInstance.sendText` 的必需 `shouldExecute` 相同。RunInTerminal 继续传真实 terminal，不加 cast 伪装不兼容。安装与 remediation 共用实现：监听先安装；false 立即返回 `{ exitCode: undefined }` 并清理事件、超时与密码提示；throw 也在 finally 清理后原样传播。仅 true 才设置 installCommandSent 并等待完成。取消或 terminal dispose 在 send pending 时到达立即释放监听；方法仍等待 send 解决，晚到 true 后返回 unknown，且不得复活已清理监听。sendText 尚未解决时的同步完成帧保留，解决为 false 时不得使用该帧报告成功。
5. 替身准确返回 true；分栏移动测试传目标下标 0，继续锁住原 active identity 与无焦点抢占。

架构选择经 Astra 预审：采用现有 void Promise 的失败传播与调用边界适配；不新增 `runCommandWithResult` 双入口，不扩散同一动作的两套送达语义。底层 boolean 继续用于 xterm 输入等无需异常的调用方。所有改动仍在 terminal 职责；不触及 Catalog 或 ExtHostOutput/Search。

## 受控回归与验证

- 真实 TerminalInstance + 受控 sendText：sendPath accepted 解决为 undefined，false 拒绝且保留 path preparation / execute 参数；runCommand 的前置 Ctrl+C false 不再送命令，命令 false 拒绝，原等待提示与 accepted 路径继续。
- 三种真实执行策略 + 屏障替身：投递尚未完成即收到完成帧时，不先解决为成功；false / rejected Promise 均走工具失败，Basic/None 的清行拒绝不再写命令；accepted 保持原输出/退出码。
- inline chat 投递失败保留建议；MainThread void 入口捕获 runCommand rejection，不发伪 shell-start/end，不产生 unhandled rejection。
- 真实 TerminalSandboxService + 受控 terminal：安装与 remediation 的 false 立即 unknown，不依赖 5 分钟超时；sendText 同步触发 exit 0 但返回 false 仍 unknown；监听均已释放。
- accepted 延迟 send：完成帧先到、send 仍 pending 时不得完成安装；send true 后仍得到 exit 0。throw / 取消出口清理监听。
- C 只运行目标 ESLint、diff-check、文档健康与生成状态检查；不编译、不转译、不写 out。merge 的唯一新编译决定 8 条诊断是否消失，并用新产物跑 terminalInstance、terminalGroup、outputMonitor、terminalSandboxService、三种执行策略、inline chat / MainThread 边界与 RunInTerminal 定向套件。
- D1377 在真实行为验证前保持 open；不升 PRD、不复写旧方案验收结论。

## 只读审查与实施

- [x] 规则 16：Astra / engine_catalog_contract_repair 于 2026-10-26 只读审查：Critical 无；Important 两条已改入（最终失败出口用通知、send pending 期间取消/销毁的晚到 true 不复活）；Minor 两条已改入（accepted 状态、仓外技能仅记来源文字）。Assessment 可进入方案独立提交及实施。
- [x] 方案独立提交：`1bfceca`。
- [x] 正式合同、实现与 27 条受控回归已补；C 目标 ESLint、diff-check 与文档静态检查；Astra 只读复核核心实现无 Critical / Important。实际完整套件与集成补修结果见下节。
- [x] merge 当前唯一新编译与新产物行为验证：旧映射8条已消失，新增MainThread夹具改用真实DynamicListEventMultiplexer并定向语义0；12套件512 passing / 0 failing、109既有pending，未新增skip。

## 集成真实运行补修

首轮11套件251过/5败，包含hook连带失败。Ctrl+C测试原OSC批次未建立真实非空Execute prompt，现分步解析并先断言状态与非空内容，保留原发送Ctrl+C的强断言。Basic拒绝清行路径发现setupRecreatingStartMarker返回的wrapper未登记owner；将wrapper纳入传入store，修复disposable生命周期。原listener/marker已有清理，不声称此前必然有活listener泄漏。

另两项TerminalInstance真实运行失败来自Xterm的两个@debounce(100)方法：声明Promise却实际返回undefined，调用者.catch会抛。改用注册释放的Delayer<void>(100)，保留100ms合并与原串行链，并让调用者拿到真实共享完成Promise。新增4项回归检验两种refresh的共享Promise与pending销毁取消；因此本次确有生产行为修复，不只更新夹具。它恢复现有异步返回/销毁合同，未引入新终端功能或真实安装器操作。

官方Electron隔离Xvfb在当前产物运行原11套件加xtermTerminal，共512 passing、109既有skip/条件pending；新增27送达场景与4个Delayer场景都执行，未新增skip。Astra静态逐路径核验4个caller catch、CancellationError过滤、body销毁闸、串行与失败恢复以及marker所有权，Critical0/Important0；新增4项运行测试本身不独立证明运行中串行/失败恢复，静态与运行证据不互换。当前唯一fullcompile原始59条/37文件未过，11补修TS定向语义0，没有第二次全量；见[本轮看板](../parallel/active/ui-visual-review-2026-10-26.md)。
