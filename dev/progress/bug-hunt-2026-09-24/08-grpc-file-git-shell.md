---
title: "潜在缺陷：gRPC 文件 Git Shell"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "上传同一帧双写 oneof 会丢掉会话头；空 chunk 只留 offset；Git 暂存空 argv 整段命令不会上线。"
---

# 潜在缺陷：gRPC 文件 Git Shell

## 结论

19 个 wire 文件都读过，并对照了 `grpcClient.ts` 接线、`grpcProtoCodec.ts` 的省略规则、Sources 暂存请求和问题座/客户端工具应答。达到立条门槛的有 3 条，都在「写出去的字节和调用方以为发出去的不一样」。取消流本身会 `call.cancel()`。proto3 标量空串/0/false 与缺省等价的省略没有另立。

## 发现

### BH-08-1

- 严重度：高
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/grpc/grpcUploadAttachmentStreamWire.ts` `encodeUploadChunk` 约 20–33 行；同一消息由 `src/vs/platform/universeAgent/node/grpc/grpcClient.ts` `openUploadAttachmentStream` 的 `write` 约 2916–2917 行原样送出
- 行为：注释写明 `UploadChunk` 是 `oneof`（`header`=1 / `chunk`=2）。`header` 与 `chunk` 同时存在时两个字段都会写上，`session_id` 在 header 的第 7 号字段。
- 为何是缺陷：oneof 按最后一次出现的臂生效。本函数先写 header 再写 chunk，解码端留下 chunk，header（含 `session_id`、`filename`、`transfer_id`）被丢掉。字节挂到这条流上一次的 transfer，或挂到没有会话的默认位置。
- 触发：同一次 `write` 里既带 `header` 又带非空 `chunk`（首包把头和第一段正文放在一起）。当前 workbench 还没有调用方；连接层已经把这种对象原样编码。
- 已知：否。`deferred-gaps.md` D24 只记录 UploadAttachment 已改走 bytes，不是这一条。
- 一句修复方向：同一帧只保留 oneof 的一臂；头和正文必须分成两次 `write`。

### BH-08-2

- 严重度：中
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/grpc/grpcUploadAttachmentStreamWire.ts` `encodeUploadChunk` 约 31–32 行，经 `grpcProtoCodec.ts` `encodeBytesField` 约 66–70 行丢掉长度为 0 的字节
- 行为：`chunk` 为空时字段 2 不出现，`offset` 非 0 仍写入字段 3。类型注释要求空 `chunk` 原样上线（`universeAgentTypes.ts` `UniverseAgentUploadChunk` 附近，以及 `universeAgentConnection.ts` 对 UploadAttachment 的说明）。
- 为何是缺陷：只有 offset、没有 chunk 臂，不是「这一段是空字节」。引擎会当成缺段（偏移非法或校验失败），或者按这个 offset 留下空洞，附件内容与本地文件不一致。
- 触发：分片器在非 0 偏移打出一个长度为 0 的片（收尾空片、按边界多切一刀）。单测把「空 chunk 省略、offset 仍在」锁成了现状。
- 已知：否
- 一句修复方向：空 chunk 仍要写出长度为 0 的字段 2，让 oneof 落在 chunk 臂上；不要只留 offset。

### BH-08-3

- 严重度：中
- 置信度：中
- 位置：`src/vs/platform/universeAgent/node/grpc/grpcGitUnaryWire.ts` `encodeWriteGitStagePathsRequest` / `encodeGitArgvCommand` / `encodeRepeatedString` 约 113–122 行与 165–169 行
- 行为：`argv` 里的空字符串被 `encodeStringField` 丢掉。若一条命令因此变成空消息，`encodeMessageField` 会把整段 `GitArgvCommand` 也丢掉。请求里可能只剩 `session_id`。
- 为何是缺陷：重复字段里的空字符串和「没有这一条命令」不是一回事。Sources 侧 `sourcesGitStagePathsRequest`（`sourcesChangesGitWrite.ts` 约 69–73 行）按路径原样组 `{ argv: [path] }`，空路径也保留。Changes 列表暂存用 `gitPath ?? fsPath`（`sourcesChangesList.ts` 约 765 行），`gitPath` 为 `''` 时不会改用本地绝对路径。线上只暂存其余非空路径，或变成一次没有命令的暂存；界面仍按这一次 RPC 的 `supported && success` 刷新整批。
- 触发：对引擎变更里 `path` 为空的行点 Stage，或一次暂存里混有空路径。非空路径不受影响。
- 已知：否
- 一句修复方向：空 argv 元素用长度 0 的 string 字段写上；空命令也要保留嵌套消息，不要在编码时删掉调用方传入的那条命令。

## 看过但未立条

- 文件读/写/强制写/合并、列表、Git 读 diff、提交、ApplyHunks、切换工作目录、Reset 的 `clear_profile_only`、暂停、Back、Prune、Compact、Branch 的 0 与 -1、问题答案、客户端工具 `is_error=false` 与空 `content`：标量空串、0、false 省略后，proto3 解码仍是空/0/false。`encodeBranchRequest` 对 0 和 -1 单独写了字段，单测锁住。这是省略规则，不是另一条路径。
- 把空文件内容写成「没带 content 就不会清空文件」没有立条：`bytes` 缺省就是空内容，与强制写空文件等价。
- `decodeWriteFileResponse` 在 `status` 缺省时交给映射变成 `SAVED`：注释写明 SAVED=0 会省略，与 proto3 一致。
- Sources 在 Git 写回 `supported` 缺省时回退本地 git：缺省 false 是 proto3；没有证据表明成功响应会漏写 `supported=true`。
- `decodeReadGitChangesResponse` 把 `kind` / `index_state` 当字符串。本仓单测和 Sources 夹具都用字符串（`WORKTREE` / `INDEX`）。引擎 proto 不在本仓，不能改判成枚举。
- StopShellTask、SendShellSessionClientControl、RunToolInBackground、Pause、SubscribeToolDetail、Download/Upload 的 `dispose`：`makeServerStreamBytesClient` / `makeClientStreamBytesClient` 在 `dispose` 里 `call.cancel()`，关闭后的 data 不再交给监听。没有「点了取消仍留下一条活流」的接线。StopShellTask 没有 workbench 调用方，空 `taskId` 省略后引擎看到的仍是空 id。
- 客户端工具应答：`conversationLensSessionBinding.ts` `respondClientTool` 固定传 `content: ''`，wire 再省略空串，引擎收到的仍是空结果。字段是调用方没给，不是编码丢掉非空正文或 `canvasRefs`。问题座把未选项编成空 `selectedLabels`，键还在，值缺省为空答案。
- FetchToolUsageDetail、SubscribeToolDetail 的 `content` / `context_sources`、DownloadChunk 的 `data`/`checksum_sha256`：注释里的字段都有解码。`content` 按 string 做 UTF-8，类型也是 string，没有 bytes 证据，不把二进制终端输出立成丢字段。
- Download / GetUploadProgress 在 `sessionId` 非空时会写上。Upload 响应注释里没有 `session_id`，解码没有少字段。没有产品代码在两条会话之间复用同一条上传流，故「响应回调对不上会话」不单独立条。
- `from_revision` / `detail_kind` / `tail_bytes` 的 0 与未设置都省略：`ToolDetailKind` 从 1 起，0 不是一种真实详情。与注释里的 proto3 省略一致。
- ClearSessionDemoFake、ResetError、Compact、Prune、Back、Branch 响应：成功位、计数字段与注释一致；Branch 响应的负索引没有引擎会回 -1 的证据，未把无符号 varint 当成缺陷。

## 未读完

- 引擎侧 `agent_service.proto` / `file_transfer_service.proto` / Git proto 不在本仓，字段号以 wire 注释和本仓单测为准，没有对引擎源码。
- `grpcClient.ts` 只读了这些 RPC 的方法体和上传/下载/订阅的开关流；文件其余 unary 未逐行读。
- `deferred-gaps.md` 按文件名、Upload、Git、Shell、attachment、cancel 检索，没有整表逐行读完。
- 未跑测试，未改产品源码。
