---
title: "D1385 首次录音授权集成运行证据"
type: reference
status: active
phase: M7
updated: 2026-10-26
summary: "C源与自槽补修已合入；修后测试精确旧948生产5个业务断言红，新action完整Contrib+Controller182过。七TS定向0，唯一新fullcompile45/27失败；保留初轮夹具错误与三诊断。"
---

> **2026-10-26 范围纠正：** 本报告保留原运行/类型检查点及当时的交接假设；“默认保留 CopilotChat 入口”前提随后被完整 gate 与独立 UI 核验推翻，原默认 pane/editor UI 验收未满足并停止。当前仅保留共享兼容修复，不再等待账号或构造宿主；方案 accepted、D1385 open 且移出当前产品执行队列。见[最终裁定](d1385-default-window-scope-decision.md) / [独立入口核验](d1385-default-window-ui-boundary.md)。以下旧运行结果不改写，也不换算为产品 UI 通过。

# D1385 首次录音授权运行证据

本检查点当时误判默认编辑器保留 Copilot Chat 入口（现已撤回）；共享 `agentsVoice.startVoiceInChat` 修复保留；不是Conversation真语音、不挂载浮窗、不开发src/vs/sessions。作者源 `8619bc47c8f623ae64e03dcb86f6f458e04eecda` 真三路合入 `d941c9458548d989ac548fb01a4b6c7861475e99`；C自槽补修 `e48f88b4ac0e9f025797495c690b83526a8a7aff`、`69ac16e02777e45980e2c55a8389fe928d5c474d` 三路合入 `6f82fe5b05210fd72852abc5df729a70b68b4401`。merge只反馈、接提交、验证，未悄改产品/测试。948的DOM Event注解与本功能修复分开。

## 第一次运行暴露的真实问题

原盘action JS正文不等于旧948源码同配置转译，未把它冒充旧基线；记录原盘hash/mtime后，安装精确旧948转译（其action源码与3e63逐字相同），再只fresh两测试，见[首轮身份](d1385-identity.json)、[测试刷新](d1385-test-refresh.json)。首轮5项red原日志保留为[初轮red](d1385-red.log)，最终red以修后重新取得的下节为准。

第一次新actionfresh后完整两套 **151 passing / 31 failing**，见[原始失败](d1385-green-full.log)。31个action用例的清理断言把Emitter.hasListeners方法当成属性；初始connecting=false场景同样如此。已精确退作者在C槽用hasListeners()修正，保留全部清理断言，e48单独提交。

第一次原project定向检查还有3条C诊断：action:301调用不存在的discardRecording；fake:160同名override；widgets的Composer[]用IChatWidget去indexOf。作者在C槽69ac统一既有公开`discardListening()`，并把集合正式标为IChatWidget[]、a/b具体Composer保留。未新增控制器API或强cast。见[三诊断原记录](d1385-d1386-types-first.json)。这两轮问题未冒充既有基线失败，也未在merge静默修补。

## 修后测试重新 old-red

重新记录6f82磁盘状态，安装精确旧948 action（body `781f53fe6cb66fc9c02826577386a18e73af8cec3e768c2f55f00c7556c72b48`），只fresh两份修后测试；controller生产未改，见[fixed身份](d1385-fixed-identity.json)、[fixed测试](d1385-fixed-test-refresh.json)。

官方Electron、隔离Xvfb、跳过prelaunch编译，同进程选择两测试文件和最小grep：**0 passing / 5 failing**，exit1，35ms，见[最终red](d1385-fixed-red.log)、[精确命令/时间](d1385-fixed-red-run.json)。逐条栈均为业务断言：

| 场景 | 旧生产实际失败 |
| --- | --- |
| connect resolve尚未准入 | down1/heldfalse/一次up，期望down0/heldtrue/零up |
| toolbar实际editor发起者 | target session-a，期望session-b |
| cold hold准入前release，handsFree=false | 旧down1/up1/heldfalse，期望0/0/true |
| cold hold准入前release，handsFree=true | 同上 |
| 真实公共命令等待五秒后准入短turn | turns0/releases0/idle，期望turn1/release1/processing |

没有cleanup断言、加载、超时或缺失取消机制造成的等待混入最终red；未对旧生产全跑取消矩阵。两条真实controller held API用例本来可以在旧controller通过，不冒充旧红。

## 只 fresh 新action后的完整 green

只fresh新action，修后测试整文件hash不变，controller生产未动，见[fixed生产身份](d1385-fixed-prod-refresh.json)。完整 `agentsVoice.contribution.test.ts` 与 `voiceSessionController.test.ts` 同进程 **182 passing / 0 failing**：31个新action、原palette1、controller149（核心142/live-transcription7，含3新增），另注册表清理检查1。见[最终green](d1385-fixed-green-full.log)、[命令/时间](d1385-fixed-green-full-run.json)。

覆盖connect resolve/ack准入差、通过公共CommandsRegistry与pane/editor替身widget区分owner、A→B各时机及A→B→A单向撤销、draft materialize/隐藏/移除、legacy异步/旧返回、取消后B恢复、cold手势/forceFinish/旧release隔离、终止清理、warm tap/hold/停止。真实controller经公开gate和生产ack/fallback证明held抑制/释放后才自动listen；真实公共命令+fake mic证明长连接后的短turn会结束。无真实WebSocket、getUserMedia、系统权限、账户或麦克风调用。

## 最终静态、编译与产物

七改动TS在未改src/tsconfig项目上下文逐文件semantic+syntactic noEmit **0**，ESLint七文件0errors/0warnings；[类型](d1385-d1386-types-final.json)、[lint](d1385-d1386-eslint.log)。本新波唯一compile-client source6f82实际exit1、**45诊断/27文件**，七改动TS无诊断，较前波source3e63的46/28新增0、只消失Event TS2314；[原始log](d1385-d1386-compile-client.log)、[对照](d1385-d1386-compile-summary.json)。没有第二次本波全量，未改sessions/tsconfig掩盖错误；旧46/28和55/36记录均保留。

编译后的六份D/C测试相关输出正文延续green；仅action生产因类静态字段类后赋值vsstatic block的emit差异，[diff](d1385-action-compile-emit-diff.txt)已记，最小fresh此一JS回已通过的同源正文。最终action source SHA `630f0d30b2b2ba809bb9951fbb77923d68fae31e326b423d0f751a213c10f098`，output SHA `26cd7c36dad55beab1f3c642bd3dd1347b6de428227996d6115db1f3742de992`，body SHA `c039623ccb2bbffc5ae57584ea1084ab8cf811868d98b0df3bf9c3e8aed3f6ae`，mtime `2026-10-26T11:04:56.994Z`。见[原始emit/最终hash与mtime](d1385-d1386-postcompile-outputs.json)。未重跑已经通过的套件；不宣称整file字节相同或整out同构建。

## 验收边界

独立正式方案与初次实施静态peer均C0/I0；C自己的补修是直接运行/正式类型暴露的API名称与断言调用纠正。运行证据已齐，C两次补修的独立复审、原假设中的默认 CopilotChat pane/editor owner 路由证明当时待到，现已核宿主关闭、该 UI 验收未满足并停止；公共命令fake widget测试不能单独证明这条实际UI来源。后续最终状态以父核验为准，本报告不冒充实际麦克风/后端或Conversation真语音交付。离开后回A须重新明确按下；cold hold释放结束、不把网络等待扩张为tap-toggle；安静连接可保留，无存储/config迁移，warm/协议/恢复合同保持。D1386真实界面独立after另外等待，不用本语音green代签。

## 日志字节保留

测试输出自带行尾空格和空白末行。为通过全文diff-check，链接的.log展示副本仅去除这些空白；受影响文件的字节原件另存同名.raw.log.gz，解压可恢复原始字节，[摘要清单](d1385-d1386-log-format.json)记录两份SHA256。诊断正文、ANSI、失败/通过和栈均保留；旧46/28及55/36原日志未改。
