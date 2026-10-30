---
title: "审查 r16：tooling"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "CLI 下载缓存用未校验版本号拼删除路径，gzip 解压可经符号链接写出提取根，agent kill 与会话查找另有用户可见错误。"
---
# 审查 r16：tooling

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r16-1 高
- 症状：更新服务返回的 `version` 含 `..` 或绝对路径时，下载缓存会在缓存目录之外删除并创建目录。
- 位置：`cli/src/download_cache.rs` 第 87–134 行
- 引用：`let temp_dir = self.path.join(format!("{name}{STAGING_SUFFIX}")); let _ = remove_dir_all(&temp_dir).await;`，随后 `create_dir_all`；LRU 淘汰时对 `self.path.join(f)` 再 `remove_dir_all`。
- 为什么是问题：`cli/src/update_service.rs` 第 136–144 行把 HTTP JSON 的 `version` 原样放进 `Release.commit`，没有做提交号校验（`is_commit_hash` 只用于 serve-web 的 URL 路径解析）。`cli/src/tunnels/agent_host.rs` 第 451–461 行、`cli/src/tunnels/code_server.rs` 第 465–473 行用 `{quality}-{commit}` 当缓存名，`cli/src/commands/serve_web.rs` 第 814 行直接用 `commit`。`Path::join` 会把名字里的 `..` 当成上级目录；绝对路径会替换掉缓存根。`create` 先删掉 `名字.staging` 再在该路径建目录，LRU 超过 5 条时再按不带 `.staging` 的名字 `remove_dir_all`。自定义或被篡改的 `VSCODE_CLI_UPDATE_URL`（`update_service.rs` 第 59–64 行）只要返回这样的 `version`，就会删到缓存外的目录。
- 方向：缓存名只接受固定格式的提交号，拒绝 `..`、分隔符和绝对路径。

## r16-2 高
- 症状：Linux 上的 gzip 更新包可以在提取根之外覆盖文件。
- 位置：`cli/src/util/tar.rs` 第 117–127 行
- 引用：`let path = safe_extract_join(&canonical_root, &relative)?;` 只对父目录 `ensure_canonical_within_root`，然后 `entry.unpack(&path)`。
- 为什么是问题：`safe_extract_join` 只约束条目自己的路径。符号链接的目标来自归档的 link name，这里没有走 `cli/src/util/extract_safety.rs` 第 112–149 行的 `validate_symlink_target`。zip 解压在 `cli/src/util/zipper.rs` 第 114–127 行会先校验再创建符号链接。gzip 包可以先放一条指向提取根之外的符号链接（其父目录仍在根内，父目录检查通过），再放同名普通文件；`entry.unpack` 写该路径时会跟着已存在的符号链接把内容写到根外。`update_service.rs` 第 181–183 行对带 gzip 头的更新包走这条路径。
- 方向：创建符号链接前调用 `validate_symlink_target`，写入前再确认最终路径仍在提取根内。

## r16-3 中
- 症状：`code agent kill` 在进程仍在跑时打印已杀死，并删掉注册表项，之后发现不了这个宿主。
- 位置：`cli/src/util/command.rs` 第 223–305 行
- 引用：`capture_command("kill", &[&process_id_str]).await.ok();`，随后 `join_all` 之后无条件 `Ok(())`。
- 为什么是问题：非 Windows 的 `kill_tree` 把每次 `kill` 的失败丢掉，信号没送到也返回成功。`cli/src/commands/agent_kill.rs` 第 97–105 行在 `kill_tree` 返回成功后立刻 `remove_agent_host_endpoint`，并输出 `Killed agent host (pid …)`。进程忽略 SIGTERM 或信号发送失败时，宿主还在，注册表里已经没有它。
- 方向：`kill` 失败要返回错误，确认进程退出后再删注册表项。

## r16-4 中
- 症状：会话不在 `listSessions` 第一页时，`code agent stop` 和 `code agent logs` 会报会话不存在。
- 位置：`cli/src/commands/agent_discovery.rs` 第 134–150 行
- 引用：`ListSessionsParams { limit: None, cursor: None }` 只请求一次；`Ok(r) if r.items.iter().any(...)` 匹配失败就 `ProbeResult::NotFound`。
- 为什么是问题：`connect_to_session_host` 被 `cli/src/commands/agent_stop.rs` 第 27–33 行和 `cli/src/commands/agent_logs.rs` 第 27–33 行用来自动找会话。同一请求在 `cli/src/commands/agent_ps.rs` 第 117–135 行会顺着 `next_cursor` 翻完。查找路径丢掉 `next_cursor` 后，后续页上的会话被当成未找到。
- 方向：按 `agent_ps` 的循环把 `next_cursor` 翻完再判断会话是否存在。

## r16-5 中
- 症状：gzip 更新包里读失败的条目被悄悄丢掉，解压仍返回成功，装出来的服务端缺文件。
- 位置：`cli/src/util/tar.rs` 第 83–88 行
- 引用：`.entries()?.filter_map(|e| e.ok()).try_for_each(...)`
- 为什么是问题：条目迭代错误被 `filter_map` 吃掉，后面的 `unpack` 不会看到这些条目，函数最后仍 `Ok(())`。zip 解压在 `cli/src/util/zipper.rs` 第 66–68 行对 `by_index` 失败直接返回错误。更新安装会把残缺目录当成成功。
- 方向：条目读取失败时中止解压并返回错误。
