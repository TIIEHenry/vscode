---
title: "D1385 取消顺序补修独立审查"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "只读设计或代码审查原报告；不冒充运行、设备或UI证据。"
---

# D1385 取消顺序补修独立只读 peer

审查者 D `/root/leaf_root_identity`，2026-10-26。已读 Astra `/tmp/vscode-voice-cancel-order-astra.md`、C 当前两 TS 与正式方案实际 diff，并核对真实 `setAutoListenHeld`、`discardListening`、`_finishPtt` 和 mic 公共事件/abort 合同。未改 C/D 产品，未编译/typecheck/transpile/out、未运行单测/Electron/mic/网络。

## Strengths

- `invalid=true` 仍在任何 controller 副作用前，阻止当前 observable 回调递归 cancel；随后的 cleanup 没有调用 `validOwner()` 或用 invalid 再拦自己，所以不会因已失效而跳过必要 abort/hold。
- 只有原 `gated && currentStart===intent` 分支，且 `startedPtt` 才同步 discard。discard 先 `_finishPtt('discard')` 清 controller held 并走真实 mic.abortPtt；随后 hold 不再走 `_finishPtt('local')` 的正常 release。两者间无 await、新 API、锁或微任务。
- discard 后重验 current 再 hold，hold 后再验 current/owned target 再清目标。旧意图失去所有权时仍执行自身 listeners.dispose/cancelled.complete，原 finally 只清仍为自己的 currentStart，符合 Astra 代次边界。
- `!startedPtt` 冷取消仍 hold-only；正常 warm gated=false不扩 discard/hold，正常 release 原路径不变。
- 回归经真实 public CommandsRegistry→真实 controller→fake I/O，区分 mic release 与 abort，micStart/micEnd 是正式 IMicCaptureService 边界而非自造 auto-listen hook。owner visible=false与hide事件一致且重复hide，断言abort1/release0/ptt_end0/idle；随后B显式录音后旧A release不结束B，B持350ms后正常finalize一次。原长等待短release用例保留为同一参数化另一分支，没有删既有行为覆盖。
- 正式方案同步说明顺序与旧69ac/red→仅action/green门槛，不把裁定或静态审查写成运行通过。

## Critical

0。

## Important

0。当前源码与 Astra 已裁定机制一致，没有发现阻止提交给唯一merge的缺口。

## Minor

0 个新增必须改码项。

## Assessment

C0/I0/M0；这是既有取消授权合同内的最小顺序修复，无新设计。可完成作者门禁并正式提交。唯一merge仍须固定69ac旧顺序产物，fresh新测试取得abort/release/end的真实业务red，再仅fresh action取green并回归两完整套；本审查未运行这些，不提前签D1385或真实CopilotChat owner UI阶段。D的CSS补修b774不在本次复审中变更。
