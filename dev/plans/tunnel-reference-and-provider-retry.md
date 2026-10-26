---
title: "Tunnel 引用所有权与 provider 重试"
type: plan
status: accepted
phase: M7
updated: 2026-10-26
summary: "D1383：open/getExisting 引用身份与 provider 重试已写；两 TS ESLint 0/0，正式类型与 red/green 待 merge。empty/string 清理候选未证实不改。"
---

# Tunnel 引用所有权与 provider 重试

> 基线 `4963799b1e95`，工位 D。仅默认编辑器依赖的 `platform/tunnel`；编译、正式运行与旧生产 red / 新生产 green 交 merge 集成者。

## 1. 事实与范围

- `AbstractTunnelService.makeTunnel` 的 dispose 每次按地址查当前槽并减引用，没有句柄自身 released 标记，也没有请求身份校验。`open(A) → close(A) → open(B) → A.dispose()` 会减少 B 的引用；共享 A 的两个句柄中同一个重复释放会提前关闭另一个仍持有的连接。
- `getExistingTunnel` 增加引用后直接返回底层 RemoteTunnel。默认编辑器 `window.ts` 的 `openTunnel` 首选它，`resolveExternalUri` 返回的 disposable 调用该对象的 dispose，绕过引用计数。该入口必须与 open 的持有者使用同一释放语义。
- `createWithProvider` 在调用 provider 前设置 `_factoryInProgress`，同步 throw 未清标记，下一次同端口 open 被忽略；异步 reject 经原 Promise 向 caller 传播，但未接收的 `finally` 派生 Promise 再产生一次裸拒绝。
- 现有 retry 测试手写 `ILogService` 缺 `_serviceBrand`，且 `replace()` 直接添加槽模拟替换。改成正式 `NullLogService` / `TestConfigurationService`，旧 attempt 测试通过公共 close/reopen 产生替换。

候选排除：empty/string 清理 helper 确实等待“当前槽”，但 provider 的同端口 factory gate 阻止 A pending 时普通 open 建 B；桌面 shared-process / node 地址分支只返回 RemoteTunnel 或 reject。尚无真实公共生产路径证明三代 empty/string 旧清理删新槽，本轮不改 helper，也不靠自造 subclass 返回值将假设升级成缺陷。

## 2. 原则与机制

选择局部引用身份修复。资源由缓存条目持有，每个成功获取只拥有一份可释放引用；显式 close 终止该条目，后续同地址创建是新身份。稳定底线是旧持有者不能影响新连接，效率收益是复用已有缓存/事件，无新服务、队列或协议。代价为每个 wrapper 一个 released 状态并携带原 Promise 身份；不引入后台重试。

1. `makeTunnel` 接收本次缓存 Promise。wrapper 首次 dispose 标记 released，只有当前槽的 Promise 仍等于原 Promise 才减引用并调用现有 disposal；重复 dispose 无效。原返回地址与本次 requested host 不一致的既有警告保留，不在本轮扩大 host 归一规则。
2. `getExistingTunnel` 仍用既有 localhost / all-interface 查询顺序并增加一份引用；成功得到 RemoteTunnel 后经同一 `makeTunnel` 返回 wrapper，empty/string 原样返回，reject 保留原错误。失败条目仍由已有清理路径移除，不建立可释放 wrapper；不添加 `onTunnelOpened`。
3. `createWithProvider` 捕获同步 throw，清本次 factory 标记后重新抛出原错误。异步结算清理使用成对 success/rejection handler 消费清理分支，不用无人接收的 `finally`；对外仍返回原 Promise。保留 provider pending 时同端口重入忽略语义、同步 undefined 路径与其他端口正常打开。
4. 不改 close 的强制关闭语义：当下槽引用归零并立刻从 map 移除，等待该 attempt 的底层释放。只最后一次正常引用释放或显式 close 发既有 `onTunnelClosed`；重复/旧 wrapper 释放不产生额外事件。open 每次成功获取仍发既有 `onTunnelOpened`，getExisting 不发。

## 3. 公共行为验证

全部新回归只通过 open/getExisting/close/setTunnelProvider 及返回 wrapper；受控 deferred 屏障只控制工厂结果，不写私有/protected map。测试 subclass 的 retain/create 分支镜像三份生产实现，并调用实际 `createWithProvider`。地址分支仅用于真实允许的 RemoteTunnel/reject 场景。

| 场景 | 预期与旧生产 red 点 |
| --- | --- |
| 同连接 open 两次，第一个 dispose 两次 | 第二份仍在 tunnels，底层 dispose 0；最后一份 dispose 后一次 close |
| open A 成功，close A，open B，A.dispose | B 仍在 tunnels；B 正常释放才关闭，不再创建第三条 |
| A pending，公共 close A、open B，A 后成功并释放 wrapper | 旧释放不减 B；A 的显式 close 仍允许发一次 closed，旧 wrapper 不额外发事件；A 与 B 各释放一次 |
| open + getExisting（all-interface 槽由 localhost alias 获取） | getExisting 不发 opened，释放它仍对应原 value且不关另一个持有者；最后 open holder 释放才 close |
| getExisting 两次释放，或 close/reopen 后旧 getExisting wrapper 释放 | 与 open 一样幂等并隔离新槽 |
| pending A reject，close A、open B 后 A 拒绝 | open/close callers 收原错误，B 在 tunnels；替换现有私有 replace 用例 |
| provider 同步 throw 后重试 | 第一次原错误，第二次成功真正再调 factory；旧生产第二次 undefined |
| provider Promise reject 后重试 | caller 收原错误，可重试；无旁生未处理拒绝（完整套件 harness 捕获） |
| provider pending 同端口重入 / 其他端口 / 同步 undefined | 保持既有门禁与恢复，不把重入保护误改为共享或禁全部端口 |

保留原三测试的 reject retry、pending 分享和成功复用语义。merge 必须先仅刷新测试、保留旧生产正文跑 red，再刷新生产跑完整 `vs/platform/tunnel/test/common/tunnelOpenRetry.test`；补跑同目录现有 tunnel 套件。不得用超时或加载失败当 red，不得声称未运行已通过。

## 4. 文档与完成线

- [x] 本方案独立只读审查，Critical/Important 为 0；方案单独 commit。
- [x] `common/tunnel.ts` 与 `test/common/tunnelOpenRetry.test.ts` 实施，知识层 `docs/modules/platform/overview.md` 简述引用/失败语义，status 记录实际 diff。
- [x] 工位仅运行针对性 ESLint、diff 检查与 docs health；不编译、不 typecheck、不 transpile、不写 out、不启动 watcher。
- [ ] merge 集成者完成正式类型检查、旧生产 red / 新生产 green 并回填原日志；之前方案保持 accepted，D1383 不闭合。

不改 Agents Window、`platform/agentHost` tunnel relay、IPC 字段或 URI 归因；不处理 `dispose()` 总服务失败遍历、provider registration 替换句柄等其他独立合同。

## 5. 只读审查

2026-10-26，独立 J reviewer（`configuration_initialization_contracts`）只读核对方案、`tunnel.ts` 及默认编辑器 `window.ts` 调用：Strengths 为真实公共触发、局部 Promise 身份与幂等释放、getExisting 所有权一致、两类 provider 失败分离及候选排除；Critical 0、Important 0。Minor 两项已纳入 §3：all-interface 原槽通过 localhost alias 获取仍释放原 value；pending A 的旧 close 允许发一次 closed，而 wrapper 不得额外发事件。Assessment：可按方案实施。

实施后 J 再只读核验两 TS 实际 diff 与回归：Critical 0、Important 0。确认 `released` 在等待前设置、原 Promise 身份传递、getExisting 不发 opened、provider 同步/异步结算及 alias/pending/recursion 公共覆盖；未运行，不代替 merge 正式 red/green。

## 6. 实施证据与集成入口

方案提交 `e451d5d` 后生产改动仅 `getExistingTunnel`、`makeTunnel`、`createWithProvider`。原三个 retry 场景保留，其中 map replacement 改为公共 close/reopen 屏障；新增 14 个测试实例（含参数化 host/获取方式/失败返回值），总计 17 项。尚未运行，不把数量当通过证据。

工位实际执行 `rtk proxy node ./node_modules/eslint/bin/eslint.js src/vs/platform/tunnel/common/tunnel.ts src/vs/platform/tunnel/test/common/tunnelOpenRetry.test.ts`，exit 0、0 errors / 0 warnings；`rtk git diff --check` 通过；文档生成无漂移，docs health 0 errors / 46 既有链接 warnings。没有运行任何编译、转译、typecheck、测试或 out 写入。

merge 先核旧生产正文仍对应基线 `4963799b1e95`，只刷新测试取得真实行为 red（旧重复释放、旧句柄、getExisting 所有权和同步 provider throw 必须失败；原裸 finally 可能另触发 harness 未处理拒绝，须单列）。再仅刷新生产，运行 `rtk scripts/test.sh --runGlob '**/platform/tunnel/test/common/*.test.js'` 完整公共套件，核实 17 项全部执行且无裸拒绝；正式项目语义检查需确认旧 ILogService 诊断消失。记录 source/output 身份、原始 red/green 日志，结果回填前 D1383 保持 open。
