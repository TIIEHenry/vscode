---
title: "语音 DOM Event 单行类型修复验证"
type: reference
status: accepted
phase: N/A
updated: 2026-10-26
summary: "94893edf39b真三路合入53ad4b1e5a；单TS原project noEmit 0，旧/新/原盘JS正文相同，仅fresh该JS。D1385功能/D1386身份仍open；唯一全量仍3e63的46/28失败。"
---

# DOM Event 注解检查点

C 作者提交 `94893edf39b2f1b9ffdfd9e11b597c65bf6e1ba6`，父为 `3e63f9e6f40e3c3c3dca1a55f47a978ddb02ed1a`。在 clean merge `5cc987d8ea50ca73af88452a0164386889587988` 以 `git merge --no-ff` 真三路合入为 `53ad4b1e5a2b94c9693bbe32ebbdc93544b0a185`，无冲突。唯一源码 diff 是 `agentsVoiceWidget.ts:893` 的 `e: Event` 改为 `e: globalThis.Event`。顶层工作台 `Event<T>` import 仍服务第73行，未删除；mousedown/keydown回调传DOM事件且调用preventDefault，修复类型指向，不改变录音或连接行为。

## 静态范围

原唯一全量日志 `d1384-compile-client.log:303` 在 source `3e63f9e` 记录 `agentsVoiceWidget.ts(893,20)` TS2314。此次 TypeScript6.0.3、8GB上限、未修改的 `src/tsconfig.json` 完整project上下文中，仅对这一个source file提取syntactic及semantic diagnostics，`noEmit:true`，结果0；[原始记录](voice-dom-event-types.json)。这不是全仓检查，也没有再次检查先前11份TS。目标ESLint exit0、无诊断，见[日志](voice-dom-event-eslint.log)。无运行语义变化，不新增镜像测试。

## 最小产物身份

唯一flock lane将旧3e63与新53ad源码按同一esbuild0.27.2配置转译到内存（ESM/es2024、experimentalDecorators、useDefineForClassFields:false），确认去source map正文完全相等后，仅fresh `out/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWidget.js`。旧源码/新源码转译正文与原盘JS正文均为 `1d65641979d1cc3bd505241203c0810448f0dd674c3bd2429a533da6481aac72`。

新源SHA256 `c4f8d64cf202ad25e318810a051c1f1deda797f6c9fb3e66e6be9ff9bf503665`，mtime `2026-10-26T10:36:16.027Z`。原盘JS整文件 `4bfb7aa5a3e95773f17e40eac04b6cd5bb9186ad7ab74523ab73789cf2239968`、158794bytes、mtime `2026-10-26T09:01:48.284Z`；fresh后为 `c256699cfb3e64324ed6715b7a74bb1a38fdc5d90900fad6ca8855a242918e4f`、77530bytes、mtime `2026-10-26T10:37:21.052Z`。整文件字节不同，运行正文相同；不能写成整文件hash一致。配置、全量摘要和mtime见[机器记录](voice-dom-event-refresh.json)。

刷新前比对[父快照](parent-sync-941-snapshot.json)的11份source和11份out，22个整文件摘要均相同，未改它们。这只证明延续其先前产物，不是本次重测。未重跑已过的Tunnel19、Review37、配置21+远端17+scan15。

## 仍开放与限制

- D1385首次录音归属功能仍open；类型注解不算功能修复。维护范围是默认编辑器保留的Copilot Chat入口 `agentsVoice.startVoiceInChat`，不是Conversation真语音或浮窗挂载。Astra纠正：ChatViewPane桥返回pane自己的widget，不能等同editor实际发起者；controller在connecting/connected时也可能随焦点修改target，因此不写“换composer后旧A必然仍为target”。真正缺口是首按授权没有跨过完整真实连接准入窗口。正式owner/代次/hold方案与审查/实施待独立作者交付。
- D1386叶级Session folder/branch归属为独立Important/open；原D after列Minor的判定已被Astra纠正，无实际错误checkout运行证据。不得借D1382关闭而签收身份条或PRD-029总体。
- 本次没有启动UI、真实麦克风、语音后端、网络或账户访问。D1382UI结论只引用其独立[after](d1382-independent-after.md)，不冒充本次重拍。
- 本轮唯一fullcompile仍是source `3e63f9e` 的exit1、46诊断/28文件；原55/36日志及原失败均保留。没有第二次全量，不把单TS诊断消失推算成新的45/27结果，不宣称全out同构建或全仓绿。

## 文档门禁

[状态生成](close-generated-status.log)、[生成列检查](close-generated-status-check.log)均exit0；[docs-health](close-docs-health.log)为0 errors / 46既有链接warnings，status156行，diff-check通过。旧阶段的未实拍/accepted记录保留并标明时序，知识层审阅通知叙述已对齐D1382闭合。

## 后续方案文档接入

上述a5fdcf326df检查点之后，仅三路合入正式方案3d291db与ab142cd（merge09ac7dbefd8、a2fbb411cda）。两份均accepted/规则16 C0/I0，D1385/D1386功能仍open；上文“待交付”保留为当阶段事实。没有合入运行实现、再次类型检查、编译、测试或out刷新。最终状态与两篇方案原文摘要见[来源核对](close-final-state.json)。
