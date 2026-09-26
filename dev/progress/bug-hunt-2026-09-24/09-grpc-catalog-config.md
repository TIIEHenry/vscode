---
title: "潜在缺陷：gRPC 目录与配置"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "目录、配置、权限、队列和循环的 gRPC 接线没有单独成立的用户可观察缺陷。"
---

# 潜在缺陷：gRPC 目录与配置

## 结论

扫完指定的 34 个接线文件，以及 `grpcClient.ts`、`grpcClientMappersSession.ts`、`universeAgentTypes.ts` 和若干调用点。配置字段、权限枚举、队列 item/op 和循环 session/agent 在本层是对齐的，缺省省略走的是 proto3，拒绝路径把缺省成功位当成失败。没有能单独写成「写错对象、权限变松、队列或循环状态丢掉、id 串掉」的条目。

## 发现

无。

## 看过但未立条

- 配置 Get/Set 与远程节点 GetConfig/SaveConfig 是两套 `encodeGetConfigRequest`。`grpcClient.ts` 用别名分开调用，不会把会话配置写到节点上，也不会把节点 id 写进 Config.Set。
- `encodeSetPermissionPolicyRequest` 与 `permissionRuleActionWire` 把未知策略和未知规则动作编成 0。`encodeRespondPermissionRequest` 在 `granted` 不为 true 时省略该字段，线上缺省是拒绝。这是收紧，不是放宽。
- `encodeSetPermissionModeRequest` 只写调用方已经换好的枚举数。Composer 的下标顺序是 ASK、AGENT、PERMIT，越界回落到 ASK。
- `encodeQueueItemRefRequest` 是 session、item、op，不是 JSON 键序。`decodeQueueMutationResponse` 读出 `itemId`。接通后的队列列表为空是 roster 不保存引擎队列，`dev/progress/deferred-gaps.md` 的 D37 已说明没有 GetQueue，不在这层把 id 弄丢。
- Suspend、Resume、Stop 的请求是 session 再 agent，响应只带 success 与 message。调用方也只看这两项，没有把循环 id 读丢。
- `decodeStatusResponse` 不读 `model_info`=9。这与 D24 的 Status 残留相同。公开树类型没有对应字段，树上的模型名仍来自 `model`=5，没有证据会显示成另一个模型。
- D24 写 Usage 的 `context_window`=10 和 `session_usage`=11 仍未读。现行 `decodeUsageResponse` 已经读取这两段，不按那句旧描述立条。
- `encodeMcpServerConfig` 省略空的 command、args、env、url。残缺更新来自调用方没有带回这些字段；编码器按 proto3 处理空值。不在本文件再立一条。
- `encodeEnablePluginRequest` 在 `enabled` 缺省时写成启用。接口注释就是 `enablePlugin(id)` 默认启用，设置页调用时传入 true。
- `decodeSetSkillEnabledResponse` 不带失败原因，测试锁定 `reason` 为 undefined。用户仍得到 `ok: false`，没有被改成启用成功。
- `mapWriteFileStatus` 把不认识的状态看成 SAVED。本范围没有写文件的编码器，现有 0、1、2 与测试一致，没有一条会发出未知状态的路径。
- `mapContextVariableScope` 把缺省和未知数字看成 `VARIABLE_GLOBAL`。类型只有 0 全局和 1 本地，缺省 0 就是全局。
- `decodeTeamInfoResponse` 不读 members 和 tasks。导航里的成员和任务走 `memberStatus` 与 `taskList`，TeamInfo 的公开类型只有 team id 和 status。
- 加载 AGENTS.md 时用只带 id、name、source 的 `saveAgentProfile` 当读取。D275 把这条用法留在调用方，本层没有另写一份会改权限或工具集的请求。

## 未读完

- 按范围未读 `grpcDevicePairUnaryWire.ts`。
- 未打开仓外 proto 原文；字段号以这些文件的注释、同目录测试和 `docs/reference/universe-agent/engine-protocol-surface.md` 的已写合同为准。
- `grpcClientMappersCatalog.ts` 里文件、git、用量的展示映射已对过字段名，没有逐行对仓外 proto。
