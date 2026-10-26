---
title: "远端用户配置初始化与重试合同"
type: plan
status: accepted
phase: M7
updated: 2026-10-26
summary: "D1384；实施已写入首次缓存、共享重试与销毁边界。静态检查后仍 accepted，统一运行前不升 implemented。"
---

# 远端用户配置初始化与重试合同

## 事实与范围

起点 `4963799b1e95`。仅默认编辑器共用的 `workbench/services/configuration`；不开发 `src/vs/sessions/` 产品面，不改配置作用域、读文件失败的既有空模型降级、环境 `null` 的既有终态和远端服务自身的连接策略。

- `RemoteUserConfiguration` 构造时启动环境读取；`initialize()` 在首次环境仍未完成时可先返回缓存，随后 `onDidInitialize` 发布真实远端模型。这是工作台启动合同，保留。
- 失败重试由第一路 `initialize()` 等待，但同轮第二路因 `_remoteUserConfigurationPromise` 已存在而走缓存路径；旧测试把第二路成功写成了预期，掩盖同轮失败归属差异。
- `reload()` 仅调用当前缓存/文件配置，失败后永不重新读环境；工作台 `reloadConfiguration(USER_REMOTE)` 因而不能恢复远端配置。
- `_register` 的全局临时收集与后台 `.catch`/外层重新 await 同时管理一次尝试，依赖共享字段追踪 candidate；销毁后环境晚到仍可创建、初始化和发布 candidate。
- 最新统一编译日志的 `configuration.ts:534 initialize on never` 来自跨异步副作用后的重复 narrowing，不单独证明运行故障。`remoteUserConfiguration.test.ts:162` 则是缺 `_serviceBrand`/`asCanonicalUri` 的夹具。禁止用 `unknown`/`never`/`any` 消诊断。

## 选择与代价

采用模块内的一次尝试记录，记录是否为首次后台尝试、完成 Promise 与可选文件初始化 Promise；candidate 与订阅放进该尝试自己的 `DisposableStore`，成功后只交给本实例持有，失败则当轮释放。远端/缓存事实分开持有，公共方法通过当前配置的获取方法读取，去掉全局 `_register` 劫持及隐含控制流。

原则是同一尝试只有一份完成事实、资源有明确 owner。代价是几项显式状态，换来失败和销毁时可解释的资源/错误归属；不新增服务、通用任务调度器、依赖或迁移存量配置。

### 状态与公共入口

| 情况 | `initialize()` | `reload()` |
| --- | --- | --- |
| 首次环境 pending | 仍读缓存；若环境已进入文件初始化，则等待该文件初始化 | 保留首次环境等待时的缓存快返；文件初始化已开始则有意收紧为等待，避免交出半提交模型 |
| 首次后台尝试已失败，尚未被公共入口观察 | 第一个入口收到原始拒绝并消费该失败 | 同左，避免隐藏先前失败 |
| 已观察失败，发起显式重试 | 开始一轮；等待环境与文件初始化 | 同左，恢复工作台远端重载入口 |
| 显式重试 pending | 所有并发 initialize/reload 等待同轮 Promise，收到同一成功模型或原始拒绝 | 同左 |
| 真实远端已提交 | 使用当前文件配置，保持重载新内容 | 同左 |
| 环境为 `null` | 维持缓存终态，不自动轮询环境 | 同左 |
| 已销毁或等待后发现已销毁 | 依赖成功晚到时以 `CancellationError` 结束；依赖拒绝则保留原始拒绝。不得创建/提交/发事件；新的调用直接取消 | 同左 |

每轮拒绝只归属于该轮。清理、失败记录和消费都必须比较参与的 attempt 身份；调用方的 catch 不得无条件清全局状态。已加入拒绝轮次的所有调用方均失败；下一轮可以立即开始，不得由前轮 finally/error 清掉下一轮。失败使用显式记录 `{ error }` 区分“没有失败”，合法的 `undefined`/`null` 拒绝也原样传播。

首次 detached 尝试的异常报告有单独受控出口；显式重试由调用方接收，不再重复后台报告。已销毁的服务不报告 candidate 失败为后台 unexpected error。candidate 的配置变更订阅在成功提交后才接到外部出口，不发布半成品；`onDidInitialize` 只在真实远端配置成功提交一次后发出。

## 夹具与回归

`remoteUserConfiguration.test.ts` 改用真实 `FileService`、内存 provider、`UriIdentityService`、完整 `TestRemoteAgentService` 子类及完整 `IRemoteAgentEnvironment`。需要控制初始化失败时，仅子类化真实 `FileService.exists`，不伪造服务大对象。使用 `DeferredPromise` 控制屏障和公开结果/事件/活动 watcher 观察，不读私有状态，不靠睡眠猜完成。

1. 带缓存/空缓存的首次环境屏障均可先返回；随后完整远端提交一次。
2. 已进入文件初始化的首次调用等待它，不读到半提交模型。
3. 首次拒绝保持原始对象且不偷偷重复读；第二轮 initialize+initialize、initialize+reload、reload+reload 共享一次环境读取和成功/拒绝。
4. 同轮双 waiter 拒绝后，一路立即开启新轮，另一路延迟处理旧拒绝；旧消费/清理不污染新轮成功或失败。补 `undefined` 与 `null` 拒绝并验证原值，不靠 truthiness。重试成功只发布一次，之后 reload 能读取新文件内容。
5. 文件初始化失败的 candidate watcher/订阅释放；下一轮成功可恢复。
6. 环境 pending、文件初始化 pending 时销毁，成功晚到结果取消且不发事件、不保留/重建 watcher；依赖晚到拒绝仍给已加入的 caller 原始错误且不后台报告。销毁后新的 initialize/reload 直接取消。
7. `null` 维持缓存终态；已成功 initialize 不重读环境；远端作用域与 restricted 配置沿用解析器。

受生产结构替换影响的 D747 远端环境源码字符串 pin 退役（仅该分支与七项计数），保留其余六项独立 catch 守卫与历史证据。它原保障的 fire-and-forget 拒绝处理，转由公共回归“首次后台失败报告一次且原拒绝可观察”“显式重试拒绝不重复后台报告”“销毁后晚到拒绝不后台报告”及完整套件未处理拒绝监测承担。不会为新实现增添源码字符串测试。

## 文件与验收

- 生产：`src/vs/workbench/services/configuration/browser/configuration.ts`。
- 测试：`test/browser/remoteUserConfiguration.test.ts`、直接受影响的 `test/node/configurationLeftoverPromiseCatchScan.test.ts`。若真实 WorkspaceService 夹具需要扩张，先向父报告，不顺手改无关服务。
- 知识层：`docs/modules/workbench/services.md` 记稳定初始化/重试合同；行动层本方案、索引、status 与 D1384。

J 禁止编译、typecheck、transpile、写 `out/` 或启动 watch。仅静态检查和准备正式测试。统一 merge 工位须先确认旧生产产物对应起点，刷新测试后跑新场景 old-production red，再只刷新生产跑 new-production green；拒绝用装载失败、超时或陈旧产物代替行为 red。正式命令：`rtk scripts/test.sh --runGlob '**/configuration/test/browser/remoteUserConfiguration.test.js'`，另跑受影响 node scan 及 configurationService 远端套件。定向语义/ESLint 在正式项目上下文执行，原两条诊断须核实消失；全量编译仍由父统筹。运行证据回来前方案不升 `implemented`、D1384 不关。

## 审查与进度

- [x] Astra 独立只读审查；初审 C0/I3：attempt 身份、falsy 拒绝、取消/原拒绝优先三项已改稿，复核 C0/I0/M0，可签收。
- [x] 方案独立提交 `f3006a5f30e`。
- [x] 实施与 21 条公共屏障已写入。本工位只做静态检查，未跑依赖 `out/` 的测试。
- [ ] merge old-production red/new-production green、完整目标套件、语义诊断和独立 after。
