---
title: "D1385 取消顺序同合同裁定"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "只读设计或代码审查原报告；不冒充运行、设备或UI证据。"
---

# D1385 取消顺序只读裁定

2026-10-26。沿用此前 principled-design 录音授权/归属/生命周期决定。本轮只读源码与既有 accepted 方案；不改仓库、不编译、不写 out、不运行设备/网络。

## 决定

**允许 C 作为已签合同内的 bugfix：仅在当前意图拥有取消权、且本次确已开始 PTT 的原 gated 取消分支内，先同步调用现有 `discardListening()`，再调用 `setAutoListenHeld(true)`。两者之间不 await，不改 API/connect/协议。**

这不是新交互决策，也不用重开整份设计。取消的语义仍是撤销本次录音授权，不是用户松键提交；现有顺序违反这条已签语义。应补正式方案的取消顺序说明/验收、独立代码审查与针对性旧红新绿；不能以本报告冒充运行通过。

## 核对基线

- C HEAD `69ac16e0277`，工作树 clean；前置 `8619bc47c8f` 与 `e48f88b4ac0`。
- merge HEAD `57cdb48b010`，code merge `6f82fe5b052`。
- C/merge `agentsVoice.contribution.ts` SHA256 同为 `630f0d30b2b2ba809bb9951fbb77923d68fae31e326b423d0f751a213c10f098`。
- C/merge `voiceSessionController.ts` SHA256 同为 `51ce328ab83cdbec47dbadfbdd70e4630edcfdd271bcb4e5d2883ffeb721ca62`。
- 已读 C `dev/plans/copilot-chat-cold-voice-authorization.md`：当前 accepted，约束是 action 内短生命周期意图，旧返回/释放/finally 不写后来意图；cold 非 hands-free hold 取消与明确松键不同；正常 warm 合同保持。

## Strengths

- 取消已先写 `invalid=true`，并有 `gated && this.currentStart === intent`、`startedPtt`、target 所有权条件；这些边界应保留。
- 真实控制器已提供正确的 discard 公共合同；无需新增 `discardPtt`、改 held setter 含义，或深入私有字段。
- C 主动区分“源码可推出正常结束路径被调用”与“真实语音已误发送”；后者没有证据，不能宣称泄漏。

## Critical

无已证实 Critical。未运行真实麦克风、后端或消息发送；本报告不证明已有语音泄漏/误发送。

## Important

### 取消顺序必须先 abort、后 hold

当前 action `agentsVoice.contribution.ts:289–314` 在取消分支先 `setAutoListenHeld(true)`，再在 `startedPtt` 时 discard。

真实控制器 `voiceSessionController.ts:2907–2927`：held 从 false 变 true、且已连接且 `_pttHeld` 时同步 `_finishPtt('local','internal')`。`_finishPtt`（3038 起）先把 `_pttHeld=false`，然后 local 路径调用 `micCaptureService.pttUp()`。真实 mic 的 pttUp（322 起）可能进入尾音 drain/完成路径。后来的 discard（2964 起）看到 controller held 已 false，不能再调用 `_finishPtt('discard')` 去 abort 正在 drain 的 mic。这是确定的控制流缺陷，不能用“后面也调用了 discard”证明已取消。

建议顺序足以修复本次实际路径：

1. 保留 `invalid=true` 先发生，重复取消幂等。
2. 只在 `gated && currentStart===intent` 下处理 controller 副作用，并保留本 action 的 heldController 所有权。
3. `startedPtt` 才同步 `discardListening()`。它先设置 `_autoListenSuppressed=true`、清 toggle/auto-listen timer、写 send-to-chat 短期抑制；仍有 PTT 时 `_finishPtt('discard')` 同步清 controller held，再调用 mic `abortPtt()`。
4. 紧接 `setAutoListenHeld(true)`。此时 controller held 已 false，setter只留下握手/后续 auto-listen 闸，不再走 local finalize。若已经断开，discard是no-op，hold仍可跨握手；若尚未开始 PTT，不调用discard，直接hold。
5. 继续按原 target/draft 所有权判断清目标，再 dispose listeners、完成 cancelled；旧 finally 仅在仍是当前意图时清 currentStart。

`discardListening` 和 setter 都是同步 void；这段不需要、也不应增加 await、微任务、延迟或“等 mic abort 完成”的新 Promise。真实 mic `abortPtt`（360 起）同步停止 streaming/drain、递增 generation、终止 acquiring，不触发 onPttEnd；保持麦克风/AudioContext warm 是既有合同。

### 同步回调与代次边界

JavaScript 事件循环不会在相邻同步调用间插入另一轮浏览器事件/Promise continuation；但 `_finishPtt` 会同步更新 observable，不能把它称为完全没有回调。当前 action 的 voiceState admission observer可以同步执行；`invalid=true` 已先设置，递归 cancel 立即返回，既有 checkAdmission 不会启动另一个命令。本次路径没有需要等待的异步 abort。

保持“旧意图不能改新意图”的已签约束：controller调用之后若代码可能再次执行受保护的 hold/清target，允许紧邻写操作重验 `this.currentStart === intent`，避免把一次入口检查当永不过期的授权。不要在失去所有权时跳过该旧意图自己的 listener/cancelled 收尾。不得把取消改成 async finally 无条件 hold/clear。

本裁定不声称公开 controller 对任意外部监听者人为同步嵌套执行新 start 命令都具有原子性；源码读查未发现当前取消路径存在这种再入发起者，不为它新增控制器锁或排队框架。若 worker 的真实生产回调证据发现此类发起，带具体调用链退回裁定，不能仅靠 await 或猜想补锁。

### warm 与安静连接约束

- `startedPtt=false` 的冷握手放弃保持原 hold-only，不要无条件 discard：discard还会置 `_autoListenSuppressed`，并非只停止设备的无副作用函数。
- 正常 warm（`gated=false`）不因这次修复获得新的 discard/hold；warm tap toggle、正常松键 finalize维持原行为。
- cold hold 已准入但 owner 隐藏/移除/被新明确意图取代：这是本次要 abort 的路径；旧 hold Promise 后续 resolve不能再次 pttUp。
- 安静连接的恢复仍由下一次明确按下建立新 target后进行。非 hands-free 实际 pttDown会清已有 suppression；不得用全局自动释放/清 suppression偷换成后台重启。不要声称本次顺序调整已新增或全面验证设置在两次命令间切换等跨模式行为。

## Minor

无新增必须单独实施项。注释可明确“hold setter会正常结束活跃PTT，取消必须先discard”，防止以后把两调用顺序调回；不需要扩成新的接口。

## 验收与反例

至少增加一条公共 `CommandsRegistry` start命令 → 真实 VoiceSessionController → fake voice client/mic 的回归：

1. handsFree=false，cold hold；走生产 connect、socket-open与onSessionInit准入，不用 Reflect 私有方法伪造已录音；确认 fake mic down一次，命令仍等hold。
2. owner `onDidHide`，且使visible事实与事件一致；等待命令结束。断言 **mic abort=1、mic pttUp=0、没有由这次取消产生的ptt_end、voiceState=idle**。fake mic必须分别记录release/abort；如果fake的pttUp不会发end，不能只以client未见ptt_end判断正确，release=0断言不可删。
3. 再resolve旧hold，确认release/abort计数不增加，target/gate不再被旧continuation写；订阅已释放，连接保持可用且安静。
4. 新明确意图绑定B并可录音；旧A的最终返回/松键不能结束B或改B目标。B正常明确松键仍走正常finalize一次。

旧 `69ac` 生产应在 **abort/release值断言** 红（预计abort0/release1），不以超时/编译错误当作红证据；仅更新action后新绿。已有31条公共命令与真实controller相邻套件按merge现有验证约束回归；C不编译/out，父唯一merge工位做运行。

反例还须保持：准入前取消无mic release/abort；断开后取消不额外finalize；正常warm短按/松键不被变成abort；同一owner重复hide/移除只取消一次。替代冷hold的新命令最好也在真实controller夹具覆盖，不能只依赖现有fake controller的discardCalls计数。

## Assessment

结论是 **Important、既有已签合同内最小修bug允许实施**；采用“有本次PTT才先同步discard，随后hold”即可修正已发现路径。顺序修复不扩大已签scope、不改connect/API/协议、不接Conversation麦克风或Sessions浮窗。

本轮未改代码或仓库文档，未运行单测/编译/typecheck/transpile/Electron/设备/网络，未写out；报告仅写在 `/tmp/vscode-voice-cancel-order-astra.md`。所有验收都是下一步要求，不是本轮已通过结果。
