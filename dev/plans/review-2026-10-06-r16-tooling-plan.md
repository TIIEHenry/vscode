---
title: "方案 r16：tooling"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 2，drop 0，weaken 3。裸 commit 仍会按绝对路径或 .. 删到缓存外；品质前缀要更多 .. 才逃出。"
---

hold 2，drop 0，weaken 3。

# 方案 r16：tooling

对照 `dev/plans/review-2026-10-06-r16-tooling.md` 逐条打开引用后的结果。drop 不写节。

## r16-1（weaken，高 → 中）

- 问题类：更新服务的 `version` 和 serve-web 的裸 `commit` 会原样进入缓存路径。裸名字是绝对路径或含 `..` 时，`DownloadCache::create` 会在缓存根之外删除并创建目录。带品质前缀时，绝对路径不会换掉缓存根；要再多一层 `..` 才爬出去。
- 不变量：从更新 JSON 写入的 `Release.commit` 只接受 40 位十六进制。任何拼到缓存根上的条目名，在 `join`、`remove_dir_all`、`create_dir_all` 之前拒绝：绝对路径、空名、路径分量 `.` 或 `..`、以及含 `/` 或 `\` 的字符串。合法名字仍是 `get_server_folder_name` 的 `{Quality}-{40 位十六进制}`、`download_cli_into_cache` 的 `{Quality}-{40 位十六进制}-{Platform}`，以及 serve-web 缓存里的裸 40 位提交号。`Quality` 的 Display 保持 `Stable`、`Insiders`、`Exploration`。
- 要动的符号或文件：`cli/src/update_service.rs` 的 `get_latest_commit`（第 136–145 行）和 `get_release_by_semver_version`（第 103–109 行）。`is_commit_hash` 从 `serve_web.rs` 第 423–425 行抽到更新服务也能调用的位置，判定仍是长度 40 且全是十六进制。`cli/src/download_cache.rs` 的 `exists`（第 52–53 行）、`delete`（第 63–64 行）、`create`（第 87–96 行）、`touch`（第 130–133 行）共用名字检查。`cli/src/tunnels/paths.rs` 的 `InstalledServer::get_install_folder`（第 109–114 行）直接 `server_cache.path().join(...)`，不经过这四个方法，同一检查要接在这里，否则 `ServerBuilder::new`（`code_server.rs` 第 393–395 行）仍会先算出缓存外路径。
- 明确不改什么：不改 `KEEP_LRU`、`STAGING_SUFFIX`、重命名重试。不把整段缓存名收成裸提交号。不改 `get_release_from_path`（第 309–311 行）已有的拒绝。不改 `--commit-id` 和 `AcquireCliParams.commit_id` 的参数解析（`serve_web.rs` 第 699–702 行、`code_server.rs` 第 239–246 行、`control_server.rs` 第 1327–1334 行）；这些字符串进缓存前由名字检查拒绝。不改 `VSCODE_CLI_UPDATE_URL` 的读取（第 59–64 行）。
- 读到的反证：`get_release_from_path` 的 `is_commit_hash` 只罩住 URL 里的 quality-commit。`handle_proxied`（第 217–226 行）解析失败时走 `get_release_from_cache`，其 `commit` 来自 `get_latest_commit` 的 `res.version`、`--commit-id`，或构造时 `cache.get().first()`（第 618–624 行）。第 814 行是 `cache.create(&args.release.commit)`，裸名字。`/tmp/evil` 会换掉缓存根；`../outside` 会落到缓存根的父目录。带 `get_server_folder_name` 前缀时不同：`/tmp/evil` 变成 `Stable-/tmp/evil`，仍在缓存根下；`../outside` 的第一段是普通名 `Stable-..`，仍在缓存根下；`../../outside` 变成 `Stable-../../outside`，解析后是 `{缓存根}/outside`，也还在缓存根内。爬出缓存根要 `version` 为 `../../../outside`（名字 `Stable-../../../outside`，落到缓存根的父目录），或中间多一段再 `..`，例如 `foo/../../outside`。`agent_host.rs` 第 451–461 行、`code_server.rs` 第 465–473 行、`download_cli_into_cache`（第 935–940 行）走的是这条带前缀的名字。
- 怎样本地验证：`cli/` 下没有 `DownloadCache` 测试。在 `cli/src/download_cache.rs` 的测试里加断言，缓存根放在临时目录下：裸名字 `../outside` 与一个位于缓存根之外的绝对路径使 `create` 返回错误，这两处今天会被删掉或建出来的目录保持不动；`Stable-../../../outside` 同样返回错误，缓存根的父目录里不出现 `outside` 或 `outside.staging`。`Stable-/tmp/evil`、`Stable-../outside`、`Stable-../../outside` 也必须返回错误，不能把「今天仍落在缓存根内」算通过。`Stable-` 加 40 位十六进制仍能在缓存根下创建目录。`get_latest_commit` 与 `get_release_by_semver_version` 对非 40 位十六进制的 `version` 返回错误，且不产生 `Release`。`get_install_folder` 对上述坏名字返回错误，不返回缓存根之外的路径。在 `cli/` 执行 `cargo test`。

## r16-2（weaken，高 → 中）

- 问题类：gzip 解压创建符号链接时不校验 link name，指向提取根外的符号链接会被建在根内；随后若要穿过这条链接新建子目录，`create_dir_all` 会先在根外建目录，归属检查才失败。
- 不变量：符号链接条目在创建前必须通过 `validate_symlink_target`。`create_dir_all` 之前，从父路径向上找到最近的已存在祖先，该祖先必须通过 `ensure_canonical_within_root`。检查失败时提取根外不留下新文件或新目录，函数返回错误。
- 要动的符号或文件：`cli/src/util/tar.rs` 的 `decompress_tarball`（第 117–127 行：`safe_extract_join` 之后对父目录 `create_dir_all`，再 `ensure_canonical_within_root`，然后 `entry.unpack`）。符号链接分支在 `unpack` 前读取 `entry.link_name()`，调用 `cli/src/util/extract_safety.rs` 的 `validate_symlink_target`（第 112–150 行）。归属检查看最近的已存在祖先，而不是只在完整父路径已经存在时才检查：父路径 `link/new` 尚不存在、`link` 已是指向根外的符号链接时，今天的 `create_dir_all` 会先在根外建出 `new`。
- 明确不改什么：不改 `cli/src/util/zipper.rs` 第 114–127 行已有的符号链接校验。不改 tar 0.4.46 的 crate，不把它的 `unpack` 换成 `unpack_in`。不改 `update_service.rs` 第 181–183 行的 gzip / zip 分流。`validate_symlink_target` 保持 `cfg(unix)`。
- 读到的反证：同名普通文件不会跟着已存在的符号链接把内容写到根外。`cli/Cargo.lock` 里的 tar 0.4.46 中，`Entry::unpack` 对普通文件使用 `OpenOptions::create_new(true)`；`Archive::new` 把 `overwrite` 默认为 true，目标已存在时先 `remove_file`（最后一段不跟随符号链接）再在原路径新建。父路径被 canonicalize 到根外时，`ensure_canonical_within_root` 在 `unpack` 之前返回错误，文件内容不会写出。仍成立的是：符号链接条目的父目录在根内，父目录检查通过，`unpack` 按归档 link name 创建链接，没有调用 `validate_symlink_target`。链接若指向根外的已有目录，下一条要在其下新建子目录时，第 119–120 行的 `create_dir_all` 会跟着链接在根外建目录，第 122 行的检查随后才失败。
- 怎样本地验证：在 `cli/src/util/tar.rs` 的测试里加断言：gzip 中一条指向提取根外的符号链接使 `decompress_tarball` 返回错误，根外路径上没有新建文件或目录，提取根内也不留下这条链接；链接指向根外目录且后一条要在其下新建子目录时，根外也不出现该子目录。已有 `decompress_tarball_with_bare_top_level_dir_entry`、`validate_symlink_rejects_escapes`、`safe_extract_join_rejects_traversal` 保持通过。在 `cli/` 执行 `cargo test`。

## r16-3（hold，中）

- 问题类：非 Windows 的 `kill_tree` 在 `kill` 没送到时仍返回成功，`code agent kill` 随即删除注册表项并打印已杀死。
- 不变量：`kill` 启动失败或退出非零时，`kill_tree` 返回错误。`kill_standalone_endpoint` 只有在 `kill_tree` 成功且 `process_exists(selected.pid)` 为 false 之后，才调用 `remove_agent_host_endpoint` 并输出 `Killed agent host (pid …)`。进程忽略 SIGTERM 后仍存在，或等待后仍存在，都保留注册表项并返回错误。
- 要动的符号或文件：`cli/src/util/command.rs` 的非 Windows `kill_tree`（第 223–305 行）。`kill_single_pid`（第 228–229 行）现在调用 `capture_command(...).await.ok()`。`capture_command`（第 51–71 行）只在启动或等待失败时返回错误，退出非零仍是 `Ok`，因此这里要改用会检查退出状态的路径（已有 `capture_command_and_check_status`，第 13–28 行）。`join_all` 之后第 305 行的无条件 `Ok(())` 改为把任一 `kill` 失败传出。`cli/src/commands/agent_kill.rs` 的 `kill_standalone_endpoint`（第 97–105 行）在删除注册表前等待进程退出。轮询方式可以沿用 `cli/src/util/machine.rs` 的 `wait_until_process_exits`（第 48–54 行），但那个函数没有放弃条件，不能原样当作唯一等待，否则忽略 SIGTERM 的进程会把命令挂住。等待必须有上限；上限到达后用 `process_exists`（第 31–34 行）复查，仍存在则返回错误。
- 明确不改什么：不改 Windows 的 `kill_tree`（第 215–218 行）。那里的 `?` 只传播 `capture_command` 的启动或等待失败，`taskkill` 退出非零时第 218 行仍是 `Ok(())`。发现稿只覆盖非 Windows，Windows 这条保持不动。不改 `children_of` 对根进程 `pgrep` 失败的返回（第 280–287 行）。不改 `commands/agent_host.rs` 的 `replace_existing`（第 637–650 行，`kill_tree` 失败时只警告，随后仍删除注册表）。不改 `tunnels/agent_host.rs` 的 `kill_running_server`（第 589 行）和 `code_server.rs` 的 `kill`（第 315 行）对 `kill_tree` 结果的忽略。
- 怎样本地验证：已有 `kill_tree_terminates_full_descendant_tree` 保持通过。另加断言：`kill` 无法启动或退出非零时 `kill_tree` 返回错误；等待上限到达后 `process_exists` 仍为 true 时不调用 `remove_agent_host_endpoint`，也不产生 `Killed agent host` 结果行；会退出的进程在退出之后才删除注册表。在 `cli/` 执行 `cargo test`。

## r16-4（weaken，中 → 低）

- 问题类：`probe_host` 只请求一次 `listSessions`，未命中就当作会话不存在；协议允许服务端返回 `next_cursor`，`agent_ps` 会翻完，这条查找路径不会。
- 不变量：自动查找在 `next_cursor` 缺失之前把每一页的 `items` 都看完，再决定 `Found` 或 `NotFound`。某一页请求失败仍是 `Unreachable`，不把已看过的页当成全集。
- 要动的符号或文件：`cli/src/commands/agent_discovery.rs` 的 `probe_host`（第 134–151 行）。翻页循环与 `cli/src/commands/agent_ps.rs` 的 `list_sessions`（第 110–137 行）对齐：`cursor` 从 `None` 开始，响应里的 `next_cursor` 作为下一次的 `cursor`，没有则停止。可以把这个循环抽成两边共用的函数，避免两处各写一遍。
- 明确不改什么：不改 `src/vs/platform/agentHost/node/protocolServerHandler.ts` 的 `listSessions`（第 1526–1549 行，返回全部 `items`，不读 `limit` / `cursor`，不设置 `nextCursor`）。不改 `PaginatedParams` 的协议说明（`src/vs/platform/agentHost/common/state/protocol/common/commands.ts` 第 68–71 行）。不改 `agent_stop.rs` 第 27–33 行和 `agent_logs.rs` 第 27–33 行对 `connect_to_session_host` 的调用。不改 `agent_ps` 已经翻页的结果。
- 读到的反证：当前服务端这一处 `listSessions` 一次返回全部会话，响应里没有 `nextCursor`。协议写明省略 `limit` / `cursor` 且忽略 `nextCursor` 时看到分页前的全量（受服务端自己的上限约束），不分页的服务端会忽略输入并单页返回全部。因此对这份服务端，`code agent stop` 和 `code agent logs` 不会因为会话「不在第一页」报不存在。客户端仍在第一页未命中时返回 `ProbeResult::NotFound`（第 147–150 行），以后服务端若开始分页，后续页上的会话会被当成没有。
- 怎样本地验证：把翻页抽成可单测的循环后加断言：第一页没有目标会话且带 `next_cursor`，第二页的 `items` 含有该会话时结果为找到；两页都没有时为未找到；`next_cursor` 缺失时只请求一次。已有 `resolve_first_match_returns_immediately_and_cancels_remaining_probes`、`resolve_first_match_prefers_found_even_when_seen_after_unreachable`、`resolve_first_match_is_not_found_when_every_host_was_searched`、`resolve_first_match_is_incomplete_when_a_host_could_not_be_searched` 不覆盖翻页，保持通过。在 `cli/` 执行 `cargo test`。

## r16-5（hold，中）

- 问题类：gzip 解压把条目读取失败丢掉，后面的条目照常解开，函数最后仍返回成功。
- 不变量：`archive.entries()` 里任一条目为 `Err` 时，`decompress_tarball` 立即返回该错误，不继续 `unpack`，也不在结尾返回 `Ok(())`。
- 要动的符号或文件：`cli/src/util/tar.rs` 的 `decompress_tarball`（第 84–88 行的 `.filter_map(|e| e.ok())`，成功路径的 `Ok(())` 在第 134 行）。
- 明确不改什么：不改 `should_skip_first_segment` 第 47 行对前缀统计的 `flatten`。不改 `zipper.rs` 第 66–68 行 `by_index` 失败已经返回错误的路径。不改进度上报。
- 怎样本地验证：在 `cli/src/util/tar.rs` 的测试里加断言：条目迭代中途产生读取错误时 `decompress_tarball` 返回错误，目标目录里没有把这次解压当成成功收尾。已有 `decompress_tarball_with_bare_top_level_dir_entry` 保持通过。在 `cli/` 执行 `cargo test`。

## 审查

2026-10-06 只读审查后改稿。Critical：serve-web 第 814 行的 `commit` 不经过 `get_release_from_path` 的 `is_commit_hash`，裸绝对路径和 `../` 仍会删到缓存外；`get_install_folder` 直接 `path().join`。Important：品质前缀下 `Stable-../../outside` 仍在缓存根内，逃出父目录的例子改为 `Stable-../../../outside`；含 `/` 的名字必须返回错误；`code agent kill` 在删注册表前要有上限的等待。Minor：Windows 的 `?` 不看 `taskkill` 退出码；gzip 的归属检查改为最近的已存在祖先。均已写入正文。
