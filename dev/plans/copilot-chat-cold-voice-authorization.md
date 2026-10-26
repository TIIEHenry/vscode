---
title: "Copilot Chat 首次连接录音授权"
type: plan
status: accepted
phase: N/A
updated: 2026-10-26
summary: "D1385：默认编辑器保留的 Copilot Chat 首按授权绑定 composer 与手势，跨过真实准入；不接 Conversation 真语音。"
---

# Copilot Chat 首次连接录音授权

## 1. 范围与事实

本方案维护默认编辑器现有 `agentsVoice.startVoiceInChat`，不开发 `src/vs/sessions`，不挂载浮窗，不给 Conversation 添加麦克风。产品边界是 [PRD-015 验收 7](../../docs/product/requirements.md#prd-015-conversation-空会话与输入面) 与 [composer-and-inbox §5](../../docs/systems/conversation/composer-and-inbox.md#5-语音输入诚实省略)，不提高 PRD 状态。

`connect()` 只完成请求阶段；`isConnected` 由 backend ack 或既有 ack-grace fallback 准入。`setAutoListenHeld(true)` 可跨握手，释放时已连接 hands-free 会立即开麦。因此 target、归属和手势必须先稳定，后放 hold。controller 在 connecting 时也会跟随焦点改 target，不能声称初始 A 必然保留；缺陷是首按授权丢失或漂移。pane 的 `_chat.voice.getCurrentSession` 只返回自己的 widget，不能代表所有 Chat editor。

基线 `94893edf39b2f1b9ffdfd9e11b597c65bf6e1ba6` 仅是 DOM Event 类型修正，没有修冷连接行为。D1385 保持 open，合入后的公共回归与独立复审完成后才关闭。

## 2. 不变量与实现位置

仅在 `agentsVoice.contribution.ts` 的 action 内维护一个短生命周期意图（含取消信号、owner snapshot、订阅与是否已发起 PTT），不新建语音服务或改变 connect Promise/协议/自动恢复。后续显式命令替代前次；旧返回、旧释放与旧 finally 只有仍持有当前意图时才可写 target、放闸或 `pttUp`。

### 2.1 同步捕获与 owner

1. 在第一个 await 前同步捕获 `enableKeybindingHoldMode`，创建当前意图并取代旧意图。
2. 工具栏先取既有 `IChatExecuteActionContext.widget`；快捷键取 `IChatWidgetService.lastFocusedWidget`。保存 widget 对象、view model 对象及 session resource；草稿以同一 widget 与空 view model 为身份。不得把侧栏 pane 查询作为 editor 的身份来源。
3. 订阅 widget 的 view-model 变更、隐藏，widget service 的聚焦切换及移除。任一次离开/更换即单向取消；A→B→A 不复活。显式 context 所指 widget 是发起者，不能因另一个旧 lastFocusedWidget 先验覆盖它；捕获后的聚焦变更仍撤销。
4. 仅无具体 widget 的合法旧入口可查一次旧 bridge，并用返回 URI 通过 widget service 找回具体 owner；bridge 缺失、拒绝、URI 无效或无法找回 owner则保持安静退出，不沿用旧 target。该查询期间先观察焦点/移除变化，发现变化即撤销；不得等 async 返回才开始保护。

### 2.2 闸和目标所有权

未准入或上一取消仍由本 action 保持 held 时，在任何可能启动连接的 await 之前先 `setAutoListenHeld(true)`；目标设置/激活也在闸内。合法 concrete owner 设置 target 并 activate；合法草稿调用 `setDraftTarget()`。准入后再次同步核对意图、owner snapshot 与 release 状态，再按需验证 legacy async 来源；验证期间不放闸。

取消时保留 held，安静连接可以继续握手。只在该意图仍为当前、且 controller 当前 target/draft 仍对应它所写目标时清其 target；`setTargetSession(undefined)` 会回退活动会话，必须在 held 中执行。旧意图不能清后来 B 的 target。下一次明确按下先建立新 owner/target，再释放该 action 保留的闸；成功后清掉 action 的 gate 所有权。正常 warm 路径不无条件 hold/unhold，避免停止后立即重启。

### 2.3 等待与终止

等待真实 `isConnected`，并观察 `isConnecting` / `isReconnecting` / `voiceState`。初始 `isConnecting=false` 不判失败：连接调用完成前允许 auth/entitlement 阶段。已观察到 connecting/reconnecting 后两者结束且未准入，或调用完成后始终无连接状态、明确 error/断开，结束等待。沿用 controller watchdog/reconnect，不另加重试或超时。

调用 `connect` 的拒绝必须观察并传回当前命令；已取消的旧 connect 即使晚拒绝也有 rejection handler，不泄漏 unhandled rejection。取消、替代、owner 销毁、hold release 可让命令及时完成，不需要等不可取消的旧 connect 返回。成功、取消、失败、被替代时 dispose 所有临时监听。冷按住录音开始后的 release 仍只允许其当前代次结束该录音。

## 3. 手势合同与兼容代价

| 路径 | 准入/释放行为 |
| --- | --- |
| cold hands-free（click 或仍有效的 hold） | 准入前零 PTT；owner 有效才释放 hold，由真实 controller 自动 listen 一次；不补空转 pttDown/pttUp。冷 hold 在准入前松开会取消授权。 |
| cold 非 hands-free click | 设置 owner、连接并等准入后仅连接，零 PTT；不补录音。 |
| cold 非 hands-free hold | 准入时仍按住才 down 一次；release 调 `pttUp('explicit', true)`，即使连接等很久、录音不足 300ms 也结束。准入前 release 零录音且以后 ack 不补开。 |
| warm 正常连接 | 保留既有 down/up tap toggle、hold 与第二次 tap stop；不额外放 auto-listen 闸。 |
| warm 但上次取消留 held | 新明确意图先设置/验证 owner 再恢复；hands-free 释放 hold 自动 listen，避免再 down/up 双开；非 hands-free 正常按手势进入 PTT。 |

有意兼容变化：冷 hold 不再把网络等待后的短录音误判为 tap；离开后回到 A 必须重新按下。连接本身可留下，不迁移配置/存储、不新增网络/权限入口。已连接时期整体焦点策略、后端协议与恢复行为不变。

## 4. 验证矩阵（无真实设备/网络）

公共 `CommandsRegistry` 入口 harness 使用 observable fake controller，将 connect resolve 与准入拆开；fake 不模拟生产 auto-listen。当用真实 controller 时只注入 fake voice client、mic、auth 与信号服务，禁止真实 WebSocket、getUserMedia 或系统权限。

| 组 | 必须覆盖 |
| --- | --- |
| 准入 | connect resolve 后未准入零 PTT；有效 owner 等 ack/fallback 才释放；两者不双开。 |
| owner | A→B 在 resolve 前、resolve 后/ack 前、准入后的 async 重验中；A→B→A；view-model 改变（含草稿 undefined→concrete）、隐藏、移除、无 owner；context pane 与 editor 独立发起，pane session 与 widget 焦点分别变化。 |
| 代次 | A 取消后 B 新显式按下可恢复；A 旧 bridge/connect 晚返回、旧 finally、旧 release 不清 B target、不放 B hold、不 up B 录音。 |
| 手势 | cold manual click 仅连；cold hold 准入前 release 零录音；跨准入 down/up 各一次；长连接后不足 300ms release forceFinish；warm tap/hold/第二次停止保持。 |
| 终止 | connect 拒绝、entitlement/auth 早返回、失败/断开/watchdog 状态、替代均收尾，无悬空命令/订阅/unhandled rejection；初始 connecting false 不提前失败。 |
| 真实 controller | 至少 ack 与 fallback 各一条，经生产 connect→onSessionInit/ack-grace 与 `setAutoListenHeld` 验证 fake mic 在 held 期间 0、release 后 1；不用 Reflect 私有入口或自造自动 listen hook 代替。 |

唯一 merge 工位负责 fresh 测试产物对旧生产 red、仅 fresh 生产后 green、定向语义与必要编译；C 不编译/typecheck/transpile/写 out，不运行依赖 out 的测试。沿用 [测试与校验](../../docs/architecture/cross-cutting/testing.md) 与 [health-gates](../progress/health-gates.md)。旧两条只查 pane 两次的绿测会被真实入口矩阵取代，不能拿它们作本修复成功证据。

## 5. 实施与审查

- [x] 规则 16 独立只读审查正式方案，核验并改入 Critical/Important；不是把事前 Astra 决策当预签。
- [ ] 单独方案提交，再改 action 与公共行为测试。
- [ ] 实施只读 peer；C 的静态 lint/diff/docs 门禁；记录实际 SHA 与未运行项。
- [ ] merge 旧生产 red / 新生产 green 与独立复审；在此之前方案保持 accepted、D1385 open。

2026-10-26 正式方案由 D 原生同伴独立只读审查，Strengths 为真实 widget 身份、完整准入闸和公共/真实 controller 两层验证；Critical 0 / Important 0，作者已核验。Minor 两项已落验收：草稿 view model materialize 撤销；准入临时观察释放后仍保留 cold hold release 的代次所有权，直到 release/取消完成。该审查只通过方案，不构成代码/运行验收。

设计决定来源为 2026-10-26 Astra 只读裁定。任何超出上述合同的新重大决策先送父调度的 Astra，不自行扩设计、不问人类。
