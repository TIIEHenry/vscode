---
title: "引擎消息序号的呈现顺序"
type: plan
status: implemented
phase: N/A
updated: 2026-11-05
summary: "只在 wire envelope 的数字 seq 边界生成定宽排序键，修复两位序号排到一位序号之前并被时间线窗口裁掉的问题。"
---

# 引擎消息序号的呈现顺序
状态：已完成。负责：agent:codex。代码与本方案限定实测完成；持续 goal 和其他验收边界另记。

覆盖需求：无（修复既有真实消息呈现顺序，不新增产品功能）。

## 证据与问题

SGLang a3 的 seq12 最终回答已持久化并到达原窗口 actor admission；134 次 DOM 采样未见 marker。Sol 将 a3 原始14个 envelopes 经当前 demux、真实 SessionActor mailbox 与投影，再在 Chromium 的实际 ConversationTimelineHost 分阶段 applyEntries：先到 seq3 用户、seq5 工具前助手、seq7 工具结果，最后到 seq12 最终助手。

现 `sessionStreamDemux.ts::demuxEnvelope` 以 `String(seq)` 构造 orderKey，投影按 opaque key 词法排序，得到 12、3、5。Host 保留已挂用户行锚点，窗口起点由0变1；`latestRoots.slice(windowStart)` 将后来排到旧端的最终回答裁出 DOM，即使总共只有4个 root。实际重放 finalDOM=false、exit1；仅在临时快照把数字键补齐为16位的对照正确排列，finalDOM=true。证据为仅绑定 a3 来源的清理版 `/tmp/ua-a3-timeline-order-clean-replay-20261105.log`、同名 JSON；不是只凭 C 观察点推断 fold 成功。

先前“离线最终可见”只检查条目集合包含最终文本，没有验证顺序或挂载窗口，不能作为这两层通过的证据。真实模型四步仍未通过，详见[验证记录](../../../dev/progress/sglang-provider-validation-2026-11-05.md)。

## 最小修复

1. 仅在 `demuxEnvelope` 的已校验数字 seq→orderKey 边界使用十进制定宽16位键。现 `toSafeInt` 域为非负 safe integer，最大值9007199254740991恰16位；该域内左补零的词法顺序等于数值顺序。既有 number/string 输入接纳规则不变（包括字符串经 Number 转换时的空白包裹及指数形式），不额外放宽非法值；`event.seq` 保持原数字。
2. live appended、batch、range replacement 与 history 的 raw envelope 映射共用此边界，须验证各入口一致。ID、turnId、seq索引、游标、branch、正文与工具关联不变；工具结果复用原 call 的排序键继续成立。
3. 已经是 domain event 的 opaque orderKey 原样保留。不将全 UI 比较器改成 Number/parseInt，不改 actor fold 的 identity preserve、不改 TimelineHost 锚点/窗口策略，不改 renderer shape、引擎 PIN 或真实场景断言。overlay/chunk 的其他顺序问题不以本次证据扩修。
4. 旧运行/缓存只作为不可变证据，不改历史 DB 或落盘键。修复后的新订阅/history 从原 seq 重新映射。独立审查已核 FrameSource 快照缓存仅在内存，roster 落盘为 legacy turns，不含 SessionViewSnapshot/orderKey；未发现旧键直接重灌 actor 的持久化路径，因此本次无迁移改动。

## 回归与交接

- Sol 实施；规则16独立只读审查前不改源码。所有真实 a3 进程已清理，继续仅一个编译/测试通道。
- Node 行为验证按数值排序后所得 orderKey 严格递增，覆盖0、3/5/7/12、9/10、99/100及MAX_SAFE_INTEGER；raw live/batch/range/history一致（history 使用公开 historyFillRowFromGetHistoryEnvelope adapter，含 raw 包装分支），非法seq保持拒绝、opaque键不变、工具关联和数字seq不变。先用旧生产输出跑新增关键断言确认 red，再编译新生产输出确认 green。
- 永久回归必须检查顺序及最终 DOM挂载，而不是仅 some(finalText)。沿已有测试组织选择 Node 产生 actor 快照、Chromium 消费实际投影/TimelineHost 的脚本夹具，或等价跨层行为入口；不在 browser 代码/测试导入 node 层。节点使用合成 seq和正文，不依赖/tmp中的某次真实数据才能常规运行。当前 history 变体验证公开 history adapter→streamEvent→Actor，不冒称完整 historyResult mailbox；真实 reload 仍单独验证。夹具超时仅终止自己新建的进程组，TERM 后短等再 KILL/wait，确保浏览器子进程不会随 Node 被硬杀而遗留。
- 真实 a3 数据临时重放保留为精确诊断；修复后使用新编译输出、不再改临时快照键，验证真正生产路径正确。该 Chromium夹具使用简化内容适配器和合成页面，不冒称完整Electron视觉验收。
- 独立实现审查、对应 compile/ESLint/Node与Chromium回归通过后，Terra做一次新隔离SGLang真实默认编辑器四步。先生成新src/out来源清单；旧观察脚本中的out hash/行可能变化，须明确更新并复核新包，不能绕过其检查或改旧证据。
- 长期映射合同写入[引擎协议面](../../../docs/reference/universe-agent/engine-protocol-surface.md)；可重复测试命令写[测试与校验](../../../docs/architecture/cross-cutting/testing.md)，实际结果进入SGLang验证记录。本波不暂存、不提交、不推送。

## 审查

agent:sol_fixture_modes 已完成规则16独立只读审查，C0/I0；父窗口核 toSafeInt、共享 demux、实际 Host 锚点代码及清理版 a3 Chromium 重放后接受。Minor 已采纳：保持 Number 对字符串的既有接纳，history 使用公开 adapter。允许 Sol 实施本窄修复与永久回归；新输出须重新建立运行清单。首次源码 peer C0/I1：跨层夹具超时直接杀 Node 可能遗留浏览器，父窗口采纳并要求自有进程组收尾；已改为自有进程组 TERM→2秒→KILL/wait，原 reviewer 窄复核 C0/I0，I1关闭。工作目录显示的[已审方案](../../../dev/plans/new-session-workdir-hydration.md)顺延，先修本项真实回复不可见。

返回 [方案索引](../../../dev/plans/INDEX.md) · [持续优化看板](../../../dev/parallel/active/gpt-visual-sglang-goal.md)。

## 实施与自动层结果

生产仅 demuxEnvelope 的数字 seq 排序键补零为16位；源码与测试的独立 peer C0/I0。正式 compile-client exit0，编译前后12186个src完全一致；测试后src与11987个out均不变。Node history10通过、官方Electron demux38通过，永久跨Actor/ChromiumHost的live与history adapter两条变体通过；新编译输出重放a3真实记录，顺序与finalDOM均正确。旧生产回归的关键失败已保留。

ESLint与HEAD逐项rule/severity/message多集完全相同：生产0error/6warning，既有demux测试3个browser-import分层error/4warning，history0/0。原lint命令exit1，不写成全绿；本窄修无新增诊断，不扩移既有测试。证据根 `/tmp/engine-envelope-order-build-20261105/`；a4带观察点的真实SGLang Local/OpenAI Chat原四步全部通过，最终回复可见且reload身份保留；保护项不变，进程清理完成。此切片代码与约定实测已完成，持续goal与后续目录/UI工作保持进行中。
