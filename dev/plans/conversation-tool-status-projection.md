---
title: "本地工具状态投影与缓存兼容"
type: plan
status: accepted
phase: M7
updated: 2026-10-26
summary: "D1380：完整默认窗口发现缺失工具状态被Stub投影补为completed；保留正式五态协议，用本地sidecar承载缺失状态工具，并迁移旧completed省略缓存。"
---

# 本地工具状态投影与缓存兼容

基线 `330b68911b5`，工位 D。问题证据在主工位 `.build/visual-review-astra/followup825/review.md` 与 `unknown-frame-evidence.json`：真实默认编辑器中模型工具没有 toolStatus，展开后却有完成勾。`conversationSessionView.ts` 的 Stub→snapshot 使用 `toolStatus ?? 'completed'`；renderer 已经只在明确 completed 时画勾，不能继续修 renderer 掩盖上游。依据 [过程折 SSOT](../../docs/systems/conversation/lens-and-trajectory.md#4-过程折overlay不是列表身份) 与 [本轮视觉方案](default-editor-visual-state-followup.md)。

## 边界与机制

1. 保留 session-core `ToolSummaryStatus` 的 pending/running/completed/failed/cancelled 五态，不能加unknown、强转undefined或把缺失映射pending/completed。已知状态继续正常tool summary；缺失状态的本地工具用合法text summary保存标题，并在现有VS Code attribution sidecar增加明确的 `localTool` 数据（toolName、参数/结果预览、可用toolCallId）。该字段只由本地Stub/缓存适配器产生；投影在role=tool且stub=true且该字段存在时恢复本地tool entry，toolStatus保持缺失。工具顺序、ID、fold归组与详情不丢失。sidecar不是引擎wire或session-core状态，不另建第二张工具真相表。
2. `entriesToLegacyTurns` 不再省略明确completed；所有五态按原值写入。新runtime缺失保持缺失。由此明确completed的live→entry→本地缓存→snapshot→view闭环不再依赖默认猜测。
3. `conversation.roster.v1` 保持存储键和version，增加可选 `toolStatusEncoding: 'explicit'` 编码标记。新保存总写此标记；新标记下缺失即未知。加载无标记旧数据时，仅对kind=tool且toolStatus缺失的turn补明确completed，覆盖local、legacy engineCache与分engineCaches三类桶。历史格式本就省略completed，迁移只在加载边界一次解释，不在runtime视图猜测。旧数据原本缺失但真实未知的来源已不可分辨，保持旧呈现属于兼容代价，文档说明，不能宣称能恢复历史未知事实。已存在的其他五态原样保留。
4. 不改引擎传输/正式五态、权限/取消动作、工具聚合、Provider CSS或Sources。合法live工具本就总有五态；验收覆盖其五态与缓存roundtrip，不伪造非法wire字段作为正式状态。新本地未知工具及来自缺失本地entry的缓存必须无完成勾。

## 受控验收

- 真实`stubTurnsToSnapshot`→`projectSnapshotToEntries`→renderable turn：缺失工具保留tool kind/name/summary/payload/ID，状态缺失，不落pending/completed；含thinking的过程折仍保步骤数量，showLiveChrome false/true均无勾。
- 同路径覆盖五个已知状态；明确completed保勾、failed/cancelled保原状态，live snapshot→entries→legacy→snapshot的completed不能丢。
- 新保存/加载后未知仍未知，completed仍明确；无标记旧local/legacy engineCache/engineCaches中的省略完成仅在codec加载时补齐，失败/取消/待确认不变。真实ConversationStubService恢复时也检查frame投影。
- 同ID unknown→known→unknown走真实diff/frame应用，旧localTool必须被替换；role非tool或stub缺失的sidecar不得将普通text变为tool。旧无标记三桶先load迁移，再只更新一个engine桶并save/reload，另两桶completed保持，新unknown不被再次迁移。
- 现有roundtrip断言按明确completed的新编码更新，不放宽为只断长度、不删旧场景。副作用与权限路径不变。
- merge唯一流水线先新测试对旧生产red，再刷新生产green；跑SessionView、RosterStorage、StubFrameSource与ProcessFold相关最小套件及目标语义检查。D只lint/diff/docs，不编译、转译、typecheck、watch或写out。
- 新输出由独立reviewer重新隔离启动真实默认窗口，重复未知/完成/取消/混合fixture实拍。此作者不自签视觉通过；未知状态Important在证据齐前保持open。

## 文档与审查

同步既有`lens-and-trajectory`过程折与缓存边界、方案/索引、D1380与本轮看板/当前迭代。只按实际diff与测试结果落账，不提升产品PRD。规则13要求方案与实施提交分离，规则16由J技术只读审查，Critical/Important核验改入后再实施。

- [x] J于2026-10-26只读技术审查：Critical 0 / Important 0。两项Minor已纳入：同ID状态往返与伪sidecar负向；旧三桶迁移后局部更新的编码标记保护。可独立提交方案并实施。
- [ ] 本地投影/codec实现与受控回归，D静态门禁。
- [ ] merge新产物行为/类型与独立窗口复验后关闭。
