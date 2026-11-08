---
title: "十六路审查 2026-11-07 r03：universeAgent 平台层方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 0、weaken 1、drop 0；2026-11-07 已过规则 16 只读审查（可实施，无 Critical / Important）。会话视图通道的帧订阅改为与同通道其他租约调用一样核对 IPC 连接的 owner，外窗口订阅得到空事件，也不再抢走持有窗口的首帧缓冲。同日已实施（未编译、未跑测试），代码审查可接受。"
---

# 十六路审查 2026-11-07 r03：universeAgent 平台层方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无。本条只收紧主进程会话视图通道的帧订阅校验，产品渲染端只订阅自己领取的租约，默认编辑器窗口里没有用户可见行为或验收项因此改变。最接近的两条也不对应：PRD-016 的「会话窗口」是同一个工作台窗口里的中间叶，共用一个渲染进程和同一个 IPC `ctx`，本条的跨窗口校验碰不到它们；PRD-008 的验收是隔离 profile 启动冒烟，本条不推进它。

只改 r03-1 一条。范围停在会话视图通道的 `listen`、electron-main 会话视图服务和 `SessionViewHost.onDynamicDidApplyFrame` 三处转发、两份测试，以及两页知识文档里的对应句子；不碰渲染端、通用合同和 IPC 握手。

核对基准是 HEAD `841ea38816d` 加上工作区的未提交改动。发现稿所引通道、服务、宿主和 id 端口的行号都与工作区一致，这几份文件没有未提交改动。`conversationEngineFrameSource.ts` 有别人的未提交改动，但不碰订阅那几行。审查收口时（同日）按符号复核过一遍：HEAD 未变，所引源码行号没有漂移；`dev/plans/INDEX.md` 新出现了别人的未提交改动，登记步骤已据此写明。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r03-1 | weaken | 中→低 | 行为成立。`ChannelServer.onEventListen` 把连接 `ctx` 传给 `listen`（`src/vs/base/parts/ipc/common/ipc.ts` 467 行），本通道的 `listen` 丢掉它（`universeAgentSessionViewChannel.ts` 80–82 行），宿主只按 leaseId 取 emitter（`sessionViewHost.ts` 372–374 行）。这违背 F1 的两条目标：每个窗口只收到自己持有的租约的帧，首帧 baseline 必达（`dev/plans/session-view-frame-fanout.md` 70–71 行）。持有窗口丢了 baseline 之后，`applyViewFrame` 在 cursor 为空时照样接受 patches 帧（`common/sessionView/apply.ts` 731–783 行；F1 正是因为首帧必为 baseline 才没在这里设防，见 fanout 稿 82 行），时间线会缺历史，直到下一次重同步。这不算有意如此：fanout 稿 79 行不透传窗口身份，理由是按 leaseId 过滤已能达到 70 行的目标，前提是各窗口只订阅自己的 leaseId；116 行只规定未知或伪造的 id 得到 `Event.None`。之后 bug-hunt 03 的 BH-03-4 给调用引入了窗口 owner，S2 只是把 `listen` 划出切片（`dev/plans/bug-hunt-2026-09-24/03-session-view-host.md` 93、105 行），没有给理由；测试、`docs/` 和缺口表都没有锁定或承接这一点。降级理由有三。第一，读帧不算新增暴露：同一会话可以挂多条租约，这是合法路径（`sessionViewHostFanout.test.ts` 的 `frames on lease A do not reach lease B subscribers` 和 `releaseLeasesOwnedBy releases only that owner and ignores ownerless leases`），任何窗口都能用自己的 `ctx` 领一条，收到同样的帧。会话 id 和历史也经连接通道的 `listSessions`、`getHistory` 对所有窗口放行（`universeAgentConnectionIpcChannel.ts` 141、226 行）。借用别人的租约，多看到的只有对方还没确认的本地待发（`scopeLocalSends`，`sessionViewHost.ts` 1262–1292 行）。第二，抢首帧要赢一场竞速：租约建立之前查询只得到 `Event.None`，没法预先订阅，只能恰好落在持有窗口收到 `acquireLease` 回复之后、它自己订阅之前；而产品渲染端就在这个回复的 `then` 里立即订阅（`conversationEngineFrameSource.ts` 68–76 行）。第三，`ctx` 是渲染端在 IPC 握手里自报的（`ipc.ts` 870–878 行，`mainProcessService.ts` 25 行；预加载对 `vscode:` 前缀通道放行 `send`，`preload.ts` 16–19、112–115 行）。能伪造 leaseId 的页面同样能换成对方的 `ctx` 重连，所以 owner 门本来只挡得住持真实 `ctx` 的误用，而现有渲染端代码不会这样误用。 |

### r03-1

问题类：会话视图通道的帧订阅不核对租约 owner，跟同一通道上释放、提交、重同步、确认、拉详情的 owner 门不一致，持真实 `ctx` 的外窗口误用别人的 leaseId 时，既会收到对方的帧，又会抢先触发首个监听者的缓冲下发，让持有窗口丢掉首帧 baseline。

实施前提：本稿签收之后再开实施切片，签收不在本轮。动手前按符号重新定位所引行号，其他会话仍在改同一工作区。`conversationEngineFrameSource.ts` 上别人的未提交改动与本条无关，不必等它提交。

不变量：

- 经 `UniverseAgentSessionViewChannel.listen` 订阅 `onDynamicDidApplyFrame` 时，如果租约 `owner` 已设置且不等于该连接的 `ctx`，返回的事件不投递任何帧。
- 被拒的订阅不给租约的 emitter 加监听者：不触发 `onDidAddFirstListener`，不下发、也不清空 `pending`，不清 `needsBaseline`，不置 `hadSubscriber`，不撤孤儿定时器。持有窗口随后订阅时仍是首个监听者，收到的首帧仍是 baseline。
- 同一 `ctx` 订阅自己的租约时，行为与今日相同：首个监听者按序收到缓冲帧，缓冲溢出时改走重同步，`patches` 帧的 `changedIds` 仍转成数组。
- `owner` 未设置的租约，以及进程内不带 owner 调用 `SessionViewHost.onDynamicDidApplyFrame(leaseId)`，行为与今日相同，沿用 `leaseOwnerMismatch`「任一侧为空即放行」的语义。
- 未知或已释放的 leaseId 仍返回 `Event.None`，不抛错；未知事件名仍抛 `Event not found`。
- owner 只取自 IPC `ctx`，不进渲染端参数；`IUniverseAgentSessionView.onDynamicDidApplyFrame(leaseId)` 的签名不变。

要动的符号：`UniverseAgentSessionViewChannel.listen` 和该类的类注释（42–46 行）、`UniverseAgentSessionViewChannelService.onDynamicDidApplyFrame` 的参数类型（39 行）、`UniverseAgentSessionViewService.onDynamicDidApplyFrame`（36–38 行）、`SessionViewHost.onDynamicDidApplyFrame`（372–374 行，复用同文件 105–111 行的 `leaseOwnerMismatch` 和 `ActiveLease.owner`）。文件：`src/vs/platform/universeAgent/electron-main/universeAgentSessionViewChannel.ts`、`src/vs/platform/universeAgent/electron-main/universeAgentSessionViewService.ts`、`src/vs/platform/universeAgent/node/sessionViewHost.ts`；测试 `src/vs/platform/universeAgent/test/node/universeAgentSessionViewChannel.test.ts`、`src/vs/platform/universeAgent/test/node/sessionViewHostFanout.test.ts`；文档 `docs/reference/universe-agent/engine-protocol-surface.md`、`docs/modules/platform/overview.md`；索引 `dev/plans/INDEX.md`（提交时登记）。

改法：

1. 先改宿主。`SessionViewHost.onDynamicDidApplyFrame` 增加可选参数 `owner?: string`。先查 `this.leases`，查不到就返回 `Event.None`；查到之后用 `leaseOwnerMismatch(binding.owner, owner)` 判断，不一致也返回 `Event.None`，一致才返回 `binding.emitter.event`。这个判断必须在拿 emitter 之前做完，被拒的调用碰不到 emitter，首个监听者的回调也就不会被触发。owner 在 `acquireLease` 时写入，之后只读，所以订阅时判断一次就够，不用逐帧再查。不新增诊断计数，与其他调用 owner 不一致时一样静默。不需要新增导入。
2. 服务转发。`UniverseAgentSessionViewService.onDynamicDidApplyFrame` 增加可选参数 `owner?: string`，原样交给宿主，不做类型强转。可选参数仍满足 `IUniverseAgentSessionView` 的单参签名，写法与同一个类的 `releaseLease(leaseId, owner?)` 一致。
3. 通道传 `ctx`。`UniverseAgentSessionViewChannelService.onDynamicDidApplyFrame` 的类型加上 `owner: string`，与同一类型里的 `releaseLease(leaseId, owner)` 等并列。`listen` 不再忽略 `ctx`：事件名是 `onDynamicDidApplyFrame` 时，以 `String(ctx)` 作为 owner 调用服务，再照旧用 `Event.map` 把 `changedIds` 转成数组。未知事件名的抛错分支不动。类注释里，把帧订阅并进「传同一个 `ctx` 给宿主核对 owner」的调用列表。
4. 边界情况。没有 owner 的租约来自进程内 `acquireLease(sessionId)`，生产代码里没有调用方，只有测试在用；它对任何 owner 都放行。生产中所有经通道领取的租约都带 owner。外窗口拿到 `Event.None` 后，`ChannelServer` 照常登记这个空订阅，收到 `EventDispose` 时释放，不需要特殊处理。持有窗口的连接移除或窗口销毁时，`src/vs/code/electron-main/app.ts` 1440–1445 行的两条钩子用该窗口的 `ctx` 调 `releaseLeasesOwnedBy`，租约连同 emitter 一起释放；外窗口自己断开时只按它自己的 `ctx` 回收，碰不到持有窗口的租约。窗口重载后旧 leaseId 已被回收，仍然只得到 `Event.None`。
5. 文档（必做）。在同一个实施提交里改两处，并把两页 frontmatter 的 `updated` 改成实施当天（`docs/DOCUMENTATION.md` 要求每次编辑都更新 `updated`）：
   - `docs/reference/universe-agent/engine-protocol-surface.md` 回合流那一行（410 行）里 `onDynamicDidApplyFrame(leaseId)` 的括注，在「未知 / 已释放 id → `Event.None`」之后补上：租约 owner 与订阅连接的 IPC `ctx` 不一致时，同样返回 `Event.None`。
   - `docs/modules/platform/overview.md` universeAgent 段（127 行），在「宿主按 IPC owner 回收 lease」处补一句：经主进程通道的租约调用和帧订阅都核对 IPC owner。
6. 索引登记（必做）。本稿提交时（方案提交与实施提交分开，见 `docs/DOCUMENTATION.md` 规则 13），在 `dev/plans/INDEX.md` 加一行，格式与 `review-2026-10-30-r11-conversation-plan.md` 那一行相同：标题链接加一句摘要。「状态」列是脚本生成区，不手写，跑 `python3 scripts/generate-docs-status.py` 生成，再用 `--check` 复核。审查收口时 `dev/plans/INDEX.md` 有别人的未提交改动：只暂存本行（`git add -p`），不暂存、不还原、不 stash 别人的改动；如果本行和对方改动挤在同一段、无法单独暂存，就等对方先提交。发现稿 `review-2026-11-07-r03-universe-agent.md` 如果仍未登记，按 r11 的先例同时补一行。

明确不改什么：

- 不改 `call` 的各个命令。`whenEngineSessionReady` 按会话 id 工作、不涉及租约，不给它加 owner。保持 `acquireLease uses IPC ctx as owner`。
- 不改 `IUniverseAgentSessionView`（`common/universeAgentSessionView.ts`）、渲染端的通道注册（`electron-browser/universeAgentSessionViewService.ts`）、Web 空实现（`browser/universeAgentSessionViewService.ts`，`onDynamicDidApplyFrame` 恒为 `Event.None`），也不改 `conversationEngineFrameSource.ts` 的订阅方式。保持 `test/browser/universeAgentConnection.test.ts` 的 `session view lease is empty`。
- 不改 `createActiveLease` 的缓冲、首个监听者下发、溢出重同步和孤儿定时器，也不改 `onFrameEnqueued` 的投递。保持 `sessionViewHostFanout.test.ts` 的 `frames on lease A do not reach lease B subscribers`、`pre-subscribe burst flushes in order with baseline first`、`pending overflow triggers resync baseline on first subscribe`、`orphan timeout releases lease that never gained a subscriber`、`unsubscribe after subscribe does not trigger orphan release`、`released lease returns Event.None`。
- 不改 vendored 的 `common/sessionView/apply.ts`。`applyViewFrame` 在 cursor 为空时接受 patches，是 F1 有意不设防（fanout 稿 82 行）；本条从源头保证首帧 baseline 不被外窗口取走。
- 不改 `leaseOwnerMismatch` 的语义，不改 `releaseLeasesOwnedBy` 和 `app.ts` 的两条回收钩子。保持 `releaseLeasesOwnedBy releases only that owner and ignores ownerless leases`（它用不带 owner 的进程内调用断言带 owner 的租约仍返回非 `Event.None`），以及 `sessionViewHostPorts.test.ts` 的 `releaseLeasesOwnedBy logs view.lease_released_by_owner`。
- 不改 `changedIds` 转数组。保持 `onDynamicDidApplyFrame converts changedIds Set into JSON-serializable array across IPC`、`unknown command and event throw`、`windowConnectionContext matches mainProcessService literal`。
- 下面几条源码扫描测试锁住了要改的文件里的文本，改动不得碰这些文本：
  - `universeAgentConnectionIpcChannel.test.ts` 的 `registration source keeps the allowlist, hub name, and host token`（436–437 行）要求 `universeAgentSessionViewService.ts` 保留构造参数 `@IUniverseAgentHostConnection hostConnection: IUniverseAgentHostConnection`，并且全文不出现 `as unknown as`。所以服务里的 owner 直接按 `string` 转发。
  - `sessionViewHostPorts.test.ts` 的 `electron-main session view service injects logging diagnostics`（23–27 行）要求服务构造里保留 `@ILogService` 和 `createSessionViewDiagnosticsPort(logService)`。
  - `sessionViewHostPostDiscipline.test.ts` 的 `core.post and takeIntents each appear once inside postAndDrain / drainIntents` 和 `sessionViewHost fire-and-forget voids single-catch onUnexpectedError and eliminate double-catch`（55–89 行）。宿主的改动不新增 `this.core.post(` 或 `this.core.takeIntents(` 调用点，也不加 `.catch(() => undefined)` 或双层 catch。
  - `universeAgentLeftoverCatchScan.test.ts` 的 `sessionViewHost pullNow leftover is onError then single-chain; double-chain gone`（46–57 行）锁住宿主的 errors 导入行和 `pullNow` 调用；本条不动这两处。
- 不改同目录的 `UniverseAgentPtyChannel`。已核对：它的 `listen` 同样不读 `ctx`（`universeAgentPtyChannel.ts` 93–98 行），但流 id 由 `generateUuid()` 生成（105 行），只在 `openStream` 的回复里交给发起方（125 行），不能像 `attempt:N` 那样枚举；它也没有窗口 owner，`openStream` 只按引擎链路 owner 把门（79–81 行）。
- 本条不把 owner 变成防被攻破渲染进程的安全边界。`ctx` 仍由渲染端在 IPC 握手时自报。不改 `ipc.ts`、`ipc.electron.ts`、`mainProcessService.ts`、预加载脚本和 `windowConnectionContext`。按 webContents 认证窗口身份是另一件事，不在本方案。
- 不新增 `DiagnosticMetric`，不碰 vendored 的 `node/sessionCore/**`。

本地验证：

- `src/vs/platform/universeAgent/test/node/universeAgentSessionViewChannel.test.ts`：修改 `forwards the six methods plus acknowledge`，让 `FakeSessionViewService.onDynamicDidApplyFrame` 记录 owner，期望串从 `onDynamicDidApplyFrame:lease-1` 改为 `onDynamicDidApplyFrame:lease-1:window:1`，与其他转发项格式一致。
- 同一文件新增一条测试，用真实的 `UniverseAgentSessionViewService` 和 `OwnerCheckConnection`，按下面的顺序写：
  1. `window:1` 领租约，并等到 `whenEngineSessionReady`。
  2. 在服务层用 `assert.strictEqual` 断言 `onDynamicDidApplyFrame(leaseId, 'window:2')` 就是 `Event.None`。
  3. `window:2` 对这个 leaseId 调 `listen`，等一个微任务后收到 0 条。
  4. `window:1` 再 `listen`，先等一个微任务，再断言收到的第一条 `applied.kind` 为 `baseline`。
  5. 然后才 `pushStreamEvent` 推一条 `streaming_delta`，断言 `window:1` 收到 `patches`，`window:2` 仍是 0 条。

  第 4 步和第 5 步不能对调：emitter 一有监听者，`onFrameEnqueued` 就直接 `fire` 新帧（`sessionViewHost.ts` 1357–1358 行），而缓冲里的 baseline 要等 `createActiveLease` 在 `onDidAddFirstListener` 里排的微任务才下发（1383–1400 行）。先推流会让 patches 排到 baseline 前面。
- `src/vs/platform/universeAgent/test/node/sessionViewHostFanout.test.ts` 新增一条：`acquireLease('sess', 'A')` 之后，`onDynamicDidApplyFrame(lease, 'B')` 严格等于 `Event.None`；带 `'A'` 和不带 owner 的调用都不等于 `Event.None`；没有 owner 的租约用 `'B'` 查询也不等于 `Event.None`。
- 同一文件再新增一条：设 `orphanTimeoutMs: 50`，`acquireLease('sess', 'A')` 之后只用 `'B'` 订阅并一直持有这个订阅；80 ms 后租约已被孤儿回收（用 `'A'` 查询也得到 `Event.None`），`view.lease_orphaned` 计数为 1。这条证明被拒的订阅不会置 `hadSubscriber`。
- 同一文件再新增一条溢出变体，写法照 `pending overflow triggers resync baseline on first subscribe`：设 `pendingFrameLimit: 2`，`acquireLease('sess', 'A')` 之后用 `injectFrame` 注入 4 帧，使 `view.pending_overflow` 为 1；先用 `'B'` 订阅，等一个微任务后收到 0 条；再用 `'A'` 订阅，等一个微任务后第一条仍是 `baseline`。这条证明被拒的订阅不会提前消耗 `needsBaseline`。
- 跑法，全部是本地入口，按顺序：
  1. 先编译：`npm run compile`；只改局部 TypeScript 时可以用 `npm run compile-client`。`scripts/test.sh --run` 加载的是 `out/` 下的编译产物（`test/unit/electron/renderer.js` 114 行），不先编译就会跑到旧代码。
  2. 再跑测试：`./scripts/test.sh --run <文件>`，可以一次带多个 `--run`。范围是上面两个测试文件，加上「明确不改什么」里点名的 `universeAgentConnectionIpcChannel.test.ts`、`sessionViewHostPorts.test.ts`、`sessionViewHostPostDiscipline.test.ts`、`universeAgentLeftoverCatchScan.test.ts` 和 `test/browser/universeAgentConnection.test.ts`。这些文件都不在 `test/unit/electron/d17-ua-node-unloadable.json` 里，会进 `scripts/run-unit-custom.sh` 的 universeAgent 集合，整个域的回归用它跑。
  3. 然后跑 `npm run eslint`。
  4. 改了两页文档、登记了索引，最后跑 docs-health：`python3 scripts/check-docs-health.py` 和 `python3 scripts/wiki/wiki.py check --root .`，再跑 `python3 scripts/generate-docs-status.py --check`。

## 审查

2026-11-07 按规则 16 做了只读审查，结论是可实施：没有 Critical，也没有 Important，只有 Minor。Minor 当轮全部改入，没有不采纳的。文档更新改成必做步骤，`engine-protocol-surface.md` 410 行和 `overview.md` 127 行两处都改，去掉了写 `Docs-Reviewed` 的替代选项。通道测试写明 `listen` 之后先等微任务、断言 baseline，再推流。点名了四份源码扫描测试和它们对改动的约束。写明已核对 `UniverseAgentPtyChannel`。说明列引用了 `session-view-frame-fanout.md` 79、116 行，并补了 70–71、82 行。本地验证按编译、测试、eslint、docs-health 排序。三条可选项也采纳了：服务层的 `strictEqual` 断言、`pendingFrameLimit: 2` 的溢出变体，以及 `releaseLeasesOwnedBy` 回收钩子的说明。审查没有改变判定和严重度。同轮还把「覆盖需求」改成写明不对应的原因，并加入提交时登记 `dev/plans/INDEX.md` 的步骤。

## 实施记录（2026-11-07）

用户同意实施，并要求不编译。r03-1 已按改法第 1 到第 5 步落到代码、测试和文档；第 6 步登记索引按派工交给父 agent。实施时 HEAD 仍是 `841ea38816d`，所改的七个文件此前都没有别人的未提交改动。

生产代码：

- `src/vs/platform/universeAgent/node/sessionViewHost.ts`：`SessionViewHost.onDynamicDidApplyFrame` 增加可选参数 `owner?: string`。先按 leaseId 取租约，取不到或 `leaseOwnerMismatch(binding.owner, owner)` 为真时返回 `Event.None`，否则返回 `binding.emitter.event`。没有新增导入，也没有新增诊断计数。
- `src/vs/platform/universeAgent/electron-main/universeAgentSessionViewService.ts`：`UniverseAgentSessionViewService.onDynamicDidApplyFrame` 增加可选参数 `owner?: string`，原样交给宿主，没有类型强转。
- `src/vs/platform/universeAgent/electron-main/universeAgentSessionViewChannel.ts`：`UniverseAgentSessionViewChannelService.onDynamicDidApplyFrame` 的类型加上 `owner: string`；`listen` 不再忽略 `ctx`，以 `String(ctx)` 作为 owner 调服务，`changedIds` 转数组照旧；类注释把帧订阅并进核对 owner 的调用列表。

测试：

- `src/vs/platform/universeAgent/test/node/universeAgentSessionViewChannel.test.ts`：`FakeSessionViewService.onDynamicDidApplyFrame` 记录 owner，`forwards the six methods plus acknowledge` 的期望串改为 `onDynamicDidApplyFrame:lease-1:window:1`。新增 `onDynamicDidApplyFrame from another window gets no frames and leaves the owner baseline buffered`，按方案的五步顺序写，新增了 `IUniverseAgentSessionViewFrameEvent` 的类型导入。
- `src/vs/platform/universeAgent/test/node/sessionViewHostFanout.test.ts`：新增三条，`onDynamicDidApplyFrame rejects a foreign owner and keeps owner, in-process, and ownerless access`、`foreign-owner subscription does not count as a subscriber for orphan release`、`foreign-owner subscription does not consume the overflow resync baseline`。只复用文件里已有的 `CountingDiagnostics`、`injectFrame`、`makePatchFrame`，订阅都登记进 `store`。

文档：

- `docs/reference/universe-agent/engine-protocol-surface.md`：回合流那一行 `onDynamicDidApplyFrame(leaseId)` 的括注补上「租约 owner 与订阅连接的 IPC `ctx` 不一致时同样返回 `Event.None`，不触发首帧下发」；`updated` 改为 2026-11-07。
- `docs/modules/platform/overview.md`：universeAgent 段在「宿主按 IPC owner 回收 lease」之后补上「经主进程通道的租约调用和帧订阅都核对 IPC owner，帧订阅遇到 owner 不一致时得到 `Event.None`」；`updated` 改为 2026-11-07。

与方案的出入：

- 宿主 `onDynamicDidApplyFrame` 里加了一行注释，写明必须先判定、再碰 emitter，否则外窗口会触发首个监听者的缓冲下发。这个顺序约束从代码本身看不出来。
- 通道新测试对推流结果的断言只看首帧下发之后新到的事件，比方案写的「`window:1` 收到 `patches`」更严，避免把缓冲里已有的 patches 算成推流结果。测试里另有一行注释，写明先等微任务再推流的约束。
- `engine-protocol-surface.md` 比方案多写了「不触发首帧下发」半句，与同一括注里首帧缓冲的说法对应。

没做的部分：

- 改法第 6 步（在 `dev/plans/INDEX.md` 登记本稿）没做。按派工，共享登记表由父 agent 统一写；要登记的内容已在最终回复里交给父 agent。`dev/plans/INDEX.md` 目前有别人的未提交改动，提交时只暂存本行。
- 方案状态行和 frontmatter 没改，由父 agent 统一改。

依赖：不需要等其它会话先提交。`conversationEngineFrameSource.ts` 上别人的未提交改动与本条无关，本次没有碰它。

未编译，未跑测试，也未跑 eslint 和 docs-health。之后按顺序跑这些本地验证：

1. `npm run compile`；只看局部 TypeScript 时可以用 `npm run compile-client`。
2. `./scripts/test.sh --run src/vs/platform/universeAgent/test/node/universeAgentSessionViewChannel.test.ts --run src/vs/platform/universeAgent/test/node/sessionViewHostFanout.test.ts --run src/vs/platform/universeAgent/test/node/universeAgentConnectionIpcChannel.test.ts --run src/vs/platform/universeAgent/test/node/sessionViewHostPorts.test.ts --run src/vs/platform/universeAgent/test/node/sessionViewHostPostDiscipline.test.ts --run src/vs/platform/universeAgent/test/node/universeAgentLeftoverCatchScan.test.ts --run src/vs/platform/universeAgent/test/browser/universeAgentConnection.test.ts`
3. `scripts/run-unit-custom.sh`，跑整个 universeAgent 域的回归。
4. `npm run eslint`。
5. `python3 scripts/check-docs-health.py` 和 `python3 scripts/wiki/wiki.py check --root .`；父 agent 登记索引后再跑 `python3 scripts/generate-docs-status.py --check`。
