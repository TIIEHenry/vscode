---
title: "D1385 独立默认产品入口核验"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "D独立源码复审C0/I0/M0；默认宿主gate阻断原UI验收，组件探索excluded、voice零派发，临时进程已清理。"
---

原报告按字节正文保存；其 `/tmp` / `.build` 引用是原运行位置，不是新的执行步骤。本目录保存的最终裁定、UI 核验及关键机器记录互相参见：

- [范围裁定](d1385-default-window-scope-decision.md) / [独立核验](d1385-default-window-ui-boundary.md)
- [初探](d1385-ui-probe.json) / [完整 gate](d1385-ui-final-gates.json) / [openView 精确更正](d1385-ui-open-view-correction.json) / [清理复核](d1385-ui-cleanup-verification.json)

原报告正文 SHA256：`2a4bf410a152d7e5057d3f76b4caff309f949ea915083fcdd9ff601d8227d7b0`。以下为原文；原 UI 验收未满足，不计为产品 after 通过。

---

# D1385 独立非作者源码复审与默认编辑器入口核验

2026-10-26。审查者 D `/root/leaf_root_identity`，不是 C 语音作者；此前只做过两轮静态 peer。本轮没有改产品、tracked docs、merge、out，没有编译/typecheck/transpile/watch，没有新 commit。D HEAD仍b774373、tracked tree clean。

## Assessment（先说结论）

**源码独立复审 C0/I0/M0；原要求的“默认窗口保留 Copilot Chat pane/editor 的真实 toolbar/快捷键 owner”产品 UI 验收无法满足，未通过。** 原因是本项目已经落实的 INV-NO-COPILOT/INV-TOPO 默认窗口门闩，非账号/网络/设备故障；不能把手工构造组件、注入 eligibility 或已有公共命令单测当作真实默认产品路径通过。

Astra在本轮复查后明确修正先前“默认窗口可达”前提，要求停止强凑fixture和改门闩；父已收到。该结论不要求用户登录、不修改window类型、不新增Copilot入口。D1385是否作为兼容代码维护范围收口，交父按修正后的产品范围决定；本报告不自签其默认产品after。

最终范围裁定见 `/tmp/vscode-voice-default-window-scope-astra.md`：本轮D1385仍open、方案accepted；保留共享兼容实现修复与已运行证据，纠正错误产品可达性陈述，停止当前默认产品UI验收，不继续探测或要求账号。

## 隔离与已加载身份

使用launch skill，显式自建空seed，独立user-data/extensions/shared-data、Xvfb。默认entry为merge/out/vs/code/electron-browser/workbench/workbench-dev.html，agents:false、runtime isSessionsWindow=false；无日常/test登录目录，无真实引擎。

merge源码实际后读HEAD `d4725424a23f863d72d6b8015a86eb00dea0c2bc`；该提交较f75只加文档/证据，唯一merge确认out未再写。源码action包含f9取消顺序；D自身57旧语音文件未用作已加载新产物证明。

Debugger.scriptParsed + Debugger.getScriptSource实际捕获：

| 模块 | 实际loaded SHA256 |
| --- | --- |
| agentsVoice.contribution.js | 8668ea87d321488bbdec3e4b193ad6984d914a3b9b9bd139e4ebf213c13633bc |
| voiceSessionController.js | 691dfab95e8346717b3a06eb810c2a5640f02e0a388f493a04138c3766902645 |
| chatWidget.js | 7bf12a0a6a6097351ac515618727f2a6a0a7a7359de97dd7c89c7b67660a28f8 |
| chatEditor.js | df4972da3658c0b4e50dacc54facaa3961c3ec48bcc5196f56a3d49d450dd4e9 |
| chatViewPane.js | dfa0e5f690ac746062c7f5cfba7d872f93f2536d5971bb3ffd5ce200eba9f78d |

前两项与merge磁盘实读相同。action源TS SHA256 a01616784b90eb513450e78b7ada2a958661cdce67b9440a6f5de487406bba68；不扩大为全out同构建。全部loaded原文、probe.json、launch.json保留本目录。

## Strengths（源码复审）

- e48把Emitter.hasListeners方法对象改为真实布尔方法调用，保留清理期望；69ac使用正式已有discardListening与IChatWidget[]，不造fake产品API。
- f9按Astra顺序先invalid，再在原gated/current且startedPtt时同步discard；真实discard先走mic.abortPtt，随后hold不再先正常release。两次current重验保护hold/owned target，invalid不阻自己cleanup，旧listener/cancelled/finally仍按代次收尾。
- !startedPtt的cold放弃仍hold-only，正常warm不扩discard/hold；无新锁/await/connect/协议变化。
- 公共command→real controller→fake mic/client的abort/release/end区分与A晚松键不动B、B350ms正常finalize由merge实际旧红/新绿和完整183通过；本轮只读复核证据，不冒充复跑。

## 真实默认产品入口矩阵

| 路径 | 实际观测 | 判定 |
| --- | --- | --- |
| IViewsService.openView(ChatViewId,true) | 初始widgets空、没有pane；复核返回null（先前通信概述为undefined已更正，open-view-correction.json） | 无默认pane宿主 |
| ChatWidgetService.revealWidget | runtime返回undefined；源码canOpenChatViewOrEditor只返回isSessionsWindow | 默认早退 |
| ChatWidgetService.openSession(existingResource) | runtime返回undefined，即使已有被手工组件注册的resource也早退 | 无服务旁路 |
| 用户New Chat Editor action | 源码openNewChatEditorSession在isDefaultCodeWindow时focusConversationPart并return | 不创建默认Chat editor |
| chat.shared resolver | shouldRegisterChatEditorResolver(isSessionsWindow)，默认构造早退 | 无URI resolver旁路 |
| ChatEditorInputWorkbenchSerializer | runtime canSerialize=false，deserialize('{}')=undefined | 无历史恢复旁路 |
| 实际默认Conversation Message下Ctrl+Shift+Space | 真按键前后voice command/sideeffect事件均0；焦点保持Message | 无Chat输入上下文，不是owner通过 |

源码另有pane descriptor.when包含IsSessionsWindowContext。证据probe.json、final-gates.json、open-view-correction.json与01/05截图。final-gates.json的publicOpenView字段误用===undefined所得false，**以open-view-correction.json的nullish=true/result='null'为准**，不把此字段解释为创建了view。正常关闭手工editor后服务有一份invisible editor widget缓存，visible widgets=[]；初探时确实widgets=[]。

## 已产生但明确排除的组件夹具

父最初允许actual production ChatWidget/toolbar组件夹具并要求明确宿主边界，因此曾做：

1. 用IEditorService.openEditor(实际ChatEditorInput)直接创建真实ChatEditor/ChatWidget。这绕过了用户New Chat Editor action的default重定向，**不是**产品入口验收。
2. 用inst.createInstance(ChatViewPane)在本地fixture host渲染真实pane/ChatWidget，没有手画Voice按钮，也没有改IsSessionsWindowContext。该host**不是**IViewsService正常打开的默认pane。
3. 空profile没有真实entitlement/default participant，为看组件菜单，仅在两widget的scoped context人为设chatIsEnabled/agentsVoiceEntitled=true，并在自建profile设agents.voice.enabled=true、dictation.showButton=false。04图显示的是生产MenuWorkbenchToolBar的真实Voice Mode按钮；**这些eligibility是夹具，不是登录/授权事实**。
4. 在创建这些组件前，公开voice connect/PTT/hold/activate等方法已安装记录spy/pending boundary，WebSocket/getUserMedia额外拒绝；仅setTargetSession/setDraftTarget的纯目标更新允许原实现，但本轮从未触发它们。
5. Astra确认完整产品gate后立即停止；没有点任何Voice toolbar，也没有对组件输入触发语音快捷键，voice events始终[]、actualConnected=false、无真实voice connect/mic/backend调用。组件keys已reset，pane dispose/移除、editor正常关闭；其构造图与脚本仅保留为探索证据，**不计owner路由/取消/warm stop通过**。

editor.json/02图、component.json/03图、entry-dom.json/04图保留以审计这段探索，不删除失败/排除证据。不得把这些图写成默认用户可达Copilot UI。

## Critical

未发现可在本次证据下成立的Critical；没有真实录音、发送、泄露或错误checkout证据。

## Important

I1（验收阻断，非新增产品缺陷）：本次默认pane/editor真实owner UI矩阵前提不成立。toolbar发起者与最近聚焦另一widget、pane/editor切换/owner失效、warm stop不额外hold等**产品UI项均未运行/未通过**。只能保留源码C0/I0/M0与merge已有可控I/O行为测试，不给默认产品after C0/I0签收。

## Minor

0个新增必须改产品项。openView返回null与undefined的口述差别已按机器记录纠正。

## 未运行与清理

未编译/typecheck/transpile/out/watch、未运行单测或真实麦克风/系统权限/语音WebSocket/后端/用户账号。没有开启Sessions或Conversation假麦，没有改产品/window gate。正常公开入口证据之后清理仅本轮自建Electron/Xvfb/三份临时profile；结果见cleanup.json。screenshots/脚本/JSON/loaded源码保留D/.build，不提交。

清理后实读：Electron PID481218不存在，Xvfb PID477932不存在，CDP37199关闭，临时user-data不存在（cleanup-verification.json）。首次substring cleanup同时终止自己的shell，后按精确owned profile argv独立脚本复核完成；其他窗口/进程未作为清理目标。D tracked status仍clean。
