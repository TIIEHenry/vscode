---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-10-26
summary: "D1386范围内closed；D1385共享兼容修复旧红/183绿保留，默认产品宿主前提失效，原UI验收未满足并停止；accepted/open且移出当前产品执行队列。"



---

# Deferred Gaps

> **SSOT**：当轮无法完成、但不阻塞当前目标的缺口写入本表。  
> 读路径：`dev/progress/status.md` → 本文件 → [research-queue.md](research-queue.md)。

| ID | Priority | Gap | Why Deferred | Exit Condition | Track | Status |
|:---|:---------|:----|:-------------|:---------------|:------|:-------|
| D1387 | P2 | Sources真实Git默认Preview漏API open/diff DTO，no-op却标Review；Conversation准确具体组在空组/newTab/reveal被finder改投主组拒绝。 | 两库真实before与C1–C6公共正负对照、Debugger组9/10→main0及五模块embedded源一致；无slot/typed replace/Panel通过不是修复after。 | [方案](../plans/sources-open-dispatch-and-conversation-target.md) accepted，规则16 C0/I0；源码实施待做；[before与设计](default-editor-contract-audit-2026-10-26-evidence/d1387-before.md)。三owner/slot/void边界，修复/旧红新绿/非作者after均未执行，不提前关。 | Sources open / editor routing | open |
| D1385 | P2 | 首次录音授权/冷取消的共享兼容实现修复已验证；原“默认CopilotChat pane/editor可达”前提失效，产品UI验收未满足并停止。 | 原5业务红/182绿；f9取消真实controller旧abort0/release1/ptt_end1红、新完整183绿，目标TS0/lint0与独立源码复审C0/I0/M0保留。默认公开入口按既有M5关闭，不是账号/设备缺失；组件fixture excluded。 | [方案](../plans/copilot-chat-cold-voice-authorization.md#10-默认产品可达性范围纠正2026-10-26) accepted；[最终范围裁定](default-editor-contract-audit-2026-10-26-evidence/d1385-default-window-scope-decision.md) / [独立入口核验](default-editor-contract-audit-2026-10-26-evidence/d1385-default-window-ui-boundary.md)。移出当前默认产品执行队列，不继续造入口或探测，不计Conversation真语音；未closed/implemented。 | agentsVoice / 共享兼容维护 | open |
