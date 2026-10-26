---
title: "J 完整 after 与 E 两轮阶段证据（冻结 source800d）"
type: progress
status: accepted
phase: M7
updated: 2026-10-27
summary: "J 15真UI/2唯一路来源/1隔离通过；E attempt1观察者污染，attempt2八UI通过但断连权限假Allowed为Important失败，整波仍未验收。"
---

# 冻结生产的 J / E after 证据

J 的完整 after 在注明边界内通过。E 干净 attempt2 的八个可执行恢复项通过，但公开断连后，正常点击缓存权限的 Allow 会在两个实际 Pane 中显示 **Allowed**，引擎并未接受响应；独立审查裁为 **Important 产品失败**。E 的 `allRequiredCasesPassed`、`phaseComplete`、`waveComplete` 均为 false。方案保持 accepted；本报告不签收整波，也不把旧 J 完成当作后续修复源码的 after。

| 阶段 | 结果 | 原件与持久化入口 |
| --- | --- | --- |
| J r2 完整 after | 15 真 UI + 2 唯一路运行来源 + 1 隔离；510 观察断言、0 失败，67 快照 | [J-only completion](d1387-j-r2-phase-complete.json)、[矩阵](d1387-j-r2-matrix.json)、[断言](d1387-j-r2-assertions.json)、[完整归档](d1387-j-r2-after-evidence.tar.gz) |
| E attempt1 | `EXECUTED_WITH_OBSERVER_CONTAMINATION`；原 step64 确实绕过 UI 发出不支持的 GetQueue，不是干净验收 | [原矩阵](e-response-r2-attempt1-matrix.json)、[封存](e-response-r2-attempt1-seal.json)、[完整归档](e-response-r2-attempt1-evidence.tar.gz) |
| E attempt2 | 八个可执行 UI 恢复项通过，timeline-only 一项 BOUNDARY；断连权限假本地成功为 Important FAIL | [完整阶段报告](e-response-r2-attempt2-runtime-report.md)、[矩阵](e-response-r2-attempt2-matrix.json)、[阶段摘要](e-response-r2-attempt2-summary.json)、[阶段封存](e-response-r2-attempt2-seal.json)、[完整归档](e-response-r2-attempt2-evidence.tar.gz) |

## 冻结身份与证据边界

RunId `sources-m01-after-20261027-r2`；source `800d383ba65fdefb36da324b380941c7574c4bf3`；src tree `2b5df2b37ca926e38888443e371cf65e2883dba2`。原生生产者 `bd1b756066932d524f5de5f6b8fdc247c70d46f5` 实际 compile8、exit0。J notice raw SHA256 `671cb3c8d944cd785772b8c8326415f0c2263c29e47cc0bfc991f2454e62479b`，E notice `cacee49ecc452d69fbf6dd33557a6363b32ad269626f0d4aec9a444f80d38098`，common53 canonical outputs `f9dd6bc5f3923a4bd57f6b70ab01ac5070bcbd991c67cbef667d8cbfcbfc23d6`，full163 raw freeze `ba84c0c60db4de894d2b0276cda24665f48003a911dbb053570dc0c4e00cc022`。after guard 当时 merge 文档 HEAD4919bcc 的 src 仍等冻结 tree；D 的报告提交基点不充当运行源码身份。

仅使用默认编辑器窗口。隔离 launch 技能使用 `--skip-prelaunch`、空 seed、独立 profile/shared-data/home，`--new-window` 且没有 `--agents`；不接日常目录或测试配置，不启动钉死引擎。D 未编译、转译、改 source/out 或运行业务测试。J 的两个唯一路来源项只读核对已实际运行的 compile8 原日志，不能改称 D 真 UI。

## J 完整 after

Preview Review 鼠标 / 真 Enter / 相反槽菜单 / 无槽 openSelected，Changes 的 replace/newTab，Conversation 首次空侧组 replace/newTab、同输入 reveal、准确第二叶目标，以及独立 Panel 鼠标 / Enter 均通过。真实 `Open Diff in Preview` 按钮以实际 `conversationPane` 上下文转移捕获的比较输入，保留无关 Preview、两 Beta 标签顺序、另一 Alpha 比较叶和固定 chat 根。Panel→Conversation、Conversation→Preview、Preview→Conversation、Preview→Panel、Panel→Preview 五个方向均验证正确完整比较及源关闭策略；Conversation/Panel 只读，普通 Preview 修改侧保留受支持写入。

受控故障只临时注册针对自有 Git DTO 的公开 `_workbench.diff`，随后 dispose 恢复：真实拒绝不标 Reviewed，真实重开显示内容并清自己的错误。旧 reject/void 不覆盖更新成功状态；晚到 void 仅证明官方 SCM 委派完成，不证明 Beta Preview 已建立，也不证明 Reviewed 被取消。helper stale 与 public finder/fence 两项仅用唯一路 exact src2b5d 的实际 compile8 日志；其真正对象/id 正例与伪造、移除、错误组、普通文件/untitled/chat/writable diff 负例不混为 UI after。

J 的第一次观察者尝试因整个服务 bag 返回时触发两次 `toJSON` IPC 错误，原8步、PNG、日志及 cleanup 完整保留在 J 归档；新空 profile 从 P01 全量重跑后才形成当前67快照。初始 CSS raw-byte 断言507过/1败及原脚本也未覆盖。旧已提交的 partial-after、M01 失败和旧归档保持不变。

J-only completion 当时尚无 E 授权，并有意保留窗口给独立 E；这些历史字段和 SHA 未重写。后续 E attempt1 使用该窗口后执行了精确 owned cleanup；E attempt2 另启全新环境。J 原 launch/lease 字节仍保持历史原件，不能用于驱动后来的 E2 窗口。

## E 两轮与补充检查

E attempt1 的 GetQueue 污染、早期流协议观察者修复、force-click 仅补充历史、question Answered 错误观察断言与原快照全部封存，320原文件+1 inventory 成员逐字/SHA校验。其业务记录不被重新包装为干净 attempt；§24 可见 Pane lease 重绑缺口也保留为独立历史观察。

E attempt2 的实测细节以[阶段报告](e-response-r2-attempt2-runtime-report.md)和归档内00–73 JSON/PNG为准：六次 false/reject 运行覆盖八矩阵项；三类键盘重试均实际 focus+Enter。只取真实 light theme /1440×900样本；clientTool 发送后的 activeElement 是 BODY，保留为 Minor 焦点观察。46–54 不同请求并发隔离通过；55–65 真实停掉自有 fake 后同 main/profile 重连，link1→2/scope4→6，两实际 Pane 自动恢复，旧局部 response busy/failure 未携入新绑定；全局 CANCELLED 错误仍在 body，不写成全部错误消失。

69公开 disconnect 后 closed/channelAlive=false；70权限普通 Allow 点击造成两 Pane 假 Allowed、pending 清空，是 Important FAIL。71 question Submit 和72 clientTool Respond 已不存在，明确只算 absence boundary，不冒充点过 disabled 控件。断连前后三类真实控件、实际 Pane/snapshot/model、正常 action 和计数均随归档保留。transport“没发 RPC”只证明未发送，不能抵消产品假本地成功。

[全寿命 gRPC 汇总](e-response-r2-attempt2-grpc-summary.json)覆盖两 fake 各自完整 start→stop：29+14=43次 Received、39 unary dispatch、19响应 unary，GetQueue0、SaveSkillContent0、13注册路径外0；Chat 常驻流开2次、payload写入0，二者明确区分。trace 在 handler lookup 前记录方法，已与已知 unary/会话流握手逐项交叉核对。episode2 仅修相对 gate 元数据路径，12广告/13handler不扩展；独立空 IO/control 防止重放。inode数值复用造成的额外观察者断言 exit1原样记录；旧socket消失、新PID/startticks/bind/ctime证明换了运输寿命，不为换数值再重起。

## 身份核验、封存与清理

[运行时资产](e-response-r2-attempt2-runtime-assets.json)为40 renderer JS原字节匹配、1真实CSS、12manifest-only，缺必需renderer证据=[]，不从renderer宣称node/main加载。[CSS typed identity](e-response-r2-attempt2-css-typed-identity.json)保留raw CDP UTF8字节不等事实；全windows-1252逆映射恢复175386 native bytes，实际683 CSSOM规则逐条等冻结UTF8 detached参考，checkmark是✓；没有匹配的live glyph元素，不宣称computed glyph视觉通过。

[full163 guard](e-response-r2-attempt2-full163-guard.json)逐项核native / filesystem source / 冻结800d Git source全同。[J保全](e-response-r2-attempt2-j-preservation.json)六个关键原件SHA不变；[Git夹具](e-response-r2-attempt2-fixtures-after.json)的HEAD/index/worktree/file bytes等原baseline，不清理夹具。[精确cleanup](e-response-r2-attempt2-cleanup.json)保存最终live renderer/main/lease/process及50份profile日志，只停止自有fake/main/Xvfb和已证后代，剩余live0；本次profile与空home删除。

| 归档 | SHA256 | 成员验证 |
| --- | --- | --- |
| J 完整 after | `19a06c98431ae7a1c8aa04ce556a7695d40ca32ed17c5f445b7aa5115665cd80` | 原封存，J completion SHA `9c874a5ebacda7dad026db5c16c72d8cc3f6d8dfc77f3c566b62c4f8f2783d3e` |
| E attempt1 污染 | `4aff8e15b0a277f49fbef43a17188c7d9ecc5f8d8b74e9773d19f94e34f2a792` | 320原文件+1 inventory，逐字/SHA |
| E attempt2 产品失败阶段 | `7678841cb782513c8f030e0870470480cc6cc13831e7bc17cba50f0cc887c5a8` | 323原文件+1 inventory，逐字/SHA；[验证](e-response-r2-attempt2-archive-verification.json) |

所有持久化副本逐字等原件，映射、大小和SHA见[证据清单](j-e-r2-after-evidence-manifest.json)。根独立流式核过E2全324成员、7个seal引用、两原trace与69/70，并亲视70 PNG；Astra另独核trace、source163、J六SHA、CSS683规则及根因。修复、独立审查、唯一编译通路、新freeze和相应fresh after由父工位继续调度；不在本证据提交里改source/out或全局进度、方案和缺口账。
