---
title: "D1385 取消先discard后hold集成运行"
type: reference
status: active
phase: M7
updated: 2026-10-26
summary: "固定69ac/57旧action，只fresh真实controller测试取得abort0/release1/ptt_end1业务红；仅fresh新action后新项1绿、完整183过，目标2TS0/lint0。默认产品宿主前提随后撤回，原UI验收未满足并停止，D1385open。"
---

> **2026-10-26 范围纠正：** 本报告保留原运行/类型检查点及当时的交接假设；“默认保留 CopilotChat 入口”前提随后被完整 gate 与独立 UI 核验推翻，原默认 pane/editor UI 验收未满足并停止。当前仅保留共享兼容修复，不再等待账号或构造宿主；方案 accepted、D1385 open 且移出当前产品执行队列。见[最终裁定](d1385-default-window-scope-decision.md) / [独立入口核验](d1385-default-window-ui-boundary.md)。以下旧运行结果不改写，也不换算为产品 UI 通过。

# D1385 取消顺序后修

C正式提交 `f9c17e5e0692a6786e3403cb5c1761a7993dbdb3` 真三路合入 `f75bf2189418dc32007f67afed54cf02ec02eed3`，文档冲突保留57检查点的原红绿/补修/45-27历史与当前边界。[Astra同合同裁定](d1385-cancel-order-decision.md)与[D非作者peer](d1385-cancel-order-peer.md)均按实际原报告保存；peer C0/I0/M0，不是运行或UI验收。

生产仅在原gated/current/startedPtt分支先invalid、同步discardListening、重验current再hold及current/owned target后清目标；无await/新API/锁，不扩warm。原因是真实hold setter在活跃PTT会正常finalize，晚discard无法再走mic abort。不是以字符串顺序或fake controller API计数代替生命周期。

## 精确旧 action 与真实公共路径 red

原盘action整文件 `26cd7c36dad55beab1f3c642bd3dd1347b6de428227996d6115db1f3742de992`、body `c039623ccb2bbffc5ae57584ea1084ab8cf811868d98b0df3bf9c3e8aed3f6ae` 精确等69ac同配置转译正文；69ac source与57 source逐字相同。只fresh新的VoiceSessionController测试，旧action字节和真实controller生产不变，见[身份](d1385-cancel-test-refresh.json)。

官方Electron+隔离Xvfb、prelaunch跳过，精确grep `cold public command discards an admitted owner hide without finalizing and allows a new press`，为 **0 passing / 1 failing**，21ms业务AssertionError；[red](d1385-cancel-red.log)/[命令时间](d1385-cancel-red-run.json)。真实CommandsRegistry命令→真实VoiceSessionController→有状态fake mic/client，走生产connect/socket/sessionInit后owner可见性变false且两次hide。实际 `aborts:0,releases:1,ends:1` 对期望 `1,0,0`；capturingfalse、starts1、turn1、idle等其他字段相同。ends来自fake client正式pttEnd调用计数。没有cleanup/load/timeout，不以连接未准入或字符串扫描当red，也不声称真实用户已经发生发送/泄漏。

## 仅 fresh 新 action green

只fresh新action，test和真实controller生产字节不变；[刷新](d1385-cancel-action-refresh.json)。新项 **1 passing**，完整Contrib+Controller **183 passing**（全局清理1、palette1、action31、controller核心143/live7共150），见[新项green](d1385-cancel-green.log)、[完整green](d1385-cancel-green-full.log)。

新green证明两次hide只abort1、release0、ptt_end0、idle；随后B明确按下可录音，旧A hold晚resolve不改变B target/capture、不释放B；B正常持350ms松开仍正常finalize1。原长连接后短release分支保留，31action/warm tap/hold/stop/ack/fallback原回归同跑。无真实WebSocket/getUserMedia/系统权限/麦克风/账户访问。

sourceaction SHA `a01616784b90eb513450e78b7ada2a958661cdce67b9440a6f5de487406bba68`；newoutput SHA `8668ea87d321488bbdec3e4b193ad6984d914a3b9b9bd139e4ebf213c13633bc`，body `850684fae597348d54b3bbbfa44163977c5ef7cdf879e94de03fe629d2347d02`，mtime `2026-10-26T11:37:24.179Z`。两目标TS（与D测试合计3）原project noEmit0、ESLint0/0，[类型](d1385-d1386-followup-types.json)/[lint](d1385-d1386-followup-eslint.log)。

## 仍开放与历史边界

D1385保持open、[方案](../../plans/copilot-chat-cold-voice-authorization.md) accepted，本检查点当时仍待原假设中的默认 CopilotChat pane/editor owner 路由证明，现已核宿主关闭、该 UI 验收未满足并停止；公共命令fake widget上下文及本real-controller fake I/O不单独签整条实际UI来源。不是Conversation真voice、不挂浮窗，不改connect/API/协议；warm与安静连接成本保持。

本后修没有全量编译，也没有为后修声称新full计数。source6f82原45/27 exit1、旧46/28及55/36和原182/151+31/三诊断证据全部保留；新日志独立，运行后修不覆盖初轮成功或失败。测试日志展示副本只规范空白，原始字节同名.raw.log.gz与run metadata SHA保留。D1386 after只涵盖D三JS与正式CSS，不把新voice action借为已加载。
