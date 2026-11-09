---
title: "十六路审查 2026-11-07 r16：入口、其余扩展与工具链发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "只读看了 10-30 以后入口、扩展、scripts 与 test 的改动，重点读 wiki.py、单测门禁、真实引擎联测，并抽查 fork 自有的扩展修复，记录 2 条可证实问题。"
---

# 十六路审查 2026-11-07 r16：入口、其余扩展与工具链发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本次先按 2026-10-30 以后的提交筛文件，范围内没有未提交改动。逐段读了 `scripts/wiki/wiki.py` 的快照、Git 上下文、归档预览与执行、提交钩子、`remind`、`verify` 与 `export-okf`；读了 `scripts/run-unit-custom.sh`、`scripts/check-test-baseline.sh`、`test/unit/electron/renderer.js`、`test/unit/node/index.js` 的门禁接线；读了 `test/scenario` 新增的真实引擎联测包装脚本、剧本、产物目录与启动参数，以及 `src/vs/code` 这轮加的释放守卫。又抽查了 fork 自己改过、旧稿没有覆盖的 `merge-conflict`、`media-preview`、git 的 `updateModelState` 与 blame、`scripts/docs_status.py` 和 session-core 同步脚本。共 2 条。

### r16-1

- 严重度：中
- 症状：`wiki.py archive --apply` 归档目录时，若 `--apply` 重新算出计划之后、真正 `os.mkdir` 之前，目标 `archive/<原路径>` 被别的进程建了出来，这次执行报「Archive commit failed and was rolled back」，看起来什么都没改。实际上回滚把那个目标目录里的条目全部改名搬进源目录，再删掉目标目录。同一工作区里两次 `--apply` 处理同一目录、两次都已通过重读与清单核对时，后一次的「回滚」会把前一次刚搬进归档的条目搬回原路径并删掉归档目录；前一次已改写的入链和 `--summary` 追加的索引行仍指向已不存在的归档路径。目标目录里有与源目录同名而内容不同的文件时，源目录里的那份被直接替换。
- 代码：`scripts/wiki/wiki.py` 2176–2186（执行搬移）与 2156–2168（回滚搬回）；计算计划时的目标冲突检查在 1873–1876（预览与 `--apply` 各算一次）；异常进入回滚在 2197–2206。`scripts/wiki/reference.md` 第 274 行写明提交阶段失败会回滚。

```2176:2186:scripts/wiki/wiki.py
    try:
        ensure_parent(destination)
        if plan["is_directory"]:
            os.mkdir(destination)  # Fails if the target appeared since the plan was made.
            for entry in sorted(os.listdir(source)):
                os.rename(source / entry, destination / entry)
            os.rmdir(source)
            source_removed = True
        else:
            move_file_without_overwrite(source, destination)
            file_moved = True
```

```2156:2168:scripts/wiki/wiki.py
        try:
            if file_moved:
                move_file_without_overwrite(destination, source)
            elif destination.exists():
                if not source.exists():
                    source.mkdir()
                for entry in sorted(os.listdir(destination)):
                    os.rename(destination / entry, source / entry)
                os.rmdir(destination)
            elif source_removed:
                errors.append("archive directory destination disappeared before rollback")
        except OSError as exc:
            errors.append(f"move {plan['destination']} back to {plan['path']}: {exc}")
```

- 为什么是问题：`archive_apply` 开头重新调用 `archive_plan`，后者只在计算计划时用 `archive_destination_conflict` 确认目标不存在（1873–1876）。之后还要核对重读、目录清单并写暂存文件，才走到 2179 行的 `os.mkdir(destination)`。注释写明这一步就是为「计划算出之后目标出现」准备的：此时 `os.mkdir` 抛 `FileExistsError`，进入 2197 行的 `except` 并调用 `rollback()`。回滚不区分目标是不是本次建的：`file_moved` 为假、`destination.exists()` 为真，于是把目标里的每个条目 `os.rename` 到源目录，最后 `os.rmdir(destination)`。POSIX 的 `rename` 遇到同名文件会静默替换；遇到同名的非空子目录会失败并中途停下，已经搬过去的条目留在源目录。源目录已被先完成的那次删掉时，2160–2161 行还会把它重新建出来。所有改名都成功时 `errors` 为空，报告里只有 `archive-apply-failed`，没有 `archive-rollback-failed`，用户会按「已回滚、未改动」理解。单文件归档在 `move_file_without_overwrite` 因目标已存在而抛错后也走进这个分支：源文件已被另一边移走时，2160–2161 行在原路径建出一个与文档同名的空目录，随后 `os.listdir` 读到的是文件而报回滚不完整。
- 方向：只搬回本次自己建出并搬入的目标；`os.mkdir` 或单文件移动因目标已存在而失败时不进入搬回逻辑，原样报错退出。

### r16-2

- 严重度：低
- 症状：带冲突标记的文件在 `applyDecorations` 等待扫描期间又被改了一次时，合并冲突的高亮不再按最新内容刷新。旧装饰留在编辑器里，直到下一次文档改动或可见编辑器变化才重算。例如删掉 `>>>>>>>` 行之后那块仍按冲突着色，或刚贴进来的冲突块没有高亮。
- 代码：`extensions/merge-conflict/src/mergeDecorator.ts` 170–182，`finally` 在 234–236；扫描延迟在 `extensions/merge-conflict/src/documentTracker.ts` 49 与 72–78，`extensions/merge-conflict/src/delayer.ts` 44–48。180 行的版本比较由 fork 提交 `16c20bb8615`（2026-09-25）加入。

```170:182:extensions/merge-conflict/src/mergeDecorator.ts
		// If we have a pending scan from the same origin, exit early. (Cannot use this.tracker.isPending() because decorations are per editor.)
		if (this.updating.get(editor)) {
			return;
		}

		try {
			this.updating.set(editor, true);

			const documentVersion = editor.document.version;
			const conflicts = await this.tracker.getConflicts(editor.document);
			if (vscode.window.visibleTextEditors.indexOf(editor) === -1 || editor.document.version !== documentVersion) {
				return;
			}
```

```72:78:extensions/merge-conflict/src/documentTracker.ts
		return cacheItem.delayTask.trigger(() => {
			const conflicts = this.getConflictsOrEmpty(document, Array.from(cacheItem!.origins));

			this.cache?.delete(key!);

			return conflicts;
		});
```

- 为什么是问题：`delayExpireTime` 为 0，`Delayer.trigger` 用 `setTimeout` 推迟执行，扫描在定时器触发时才读取同一个 `TextDocument` 的当前内容。只要第二条文档改动在这个定时器之前被扩展宿主处理，版本号就先变了；这条改动触发的 `applyDecorations` 在 171–173 行因 `updating` 已置位直接返回。随后扫描读到的已是最新内容，第一次调用却在 180 行拿它和 178 行记下的旧版本比较，不相等就返回，把这份与当前文本一致的结果丢掉。`finally` 清掉 `updating` 后没有排队的调用，装饰停在上一轮。加这条比较之前，第一次调用会把刚扫出的结果写上去，而这份结果正对应当前文本。同期 fork 在 `media-preview` 里的类似修复是「后发起的渲染胜出」，git 的 `updateModelState` 是后一次取消前一次，都还有一次写回；这里被丢掉的那次没有后继。
- 方向：版本不一致时重新调度一次 `applyDecorations`，或在 `updating` 期间记下有新改动、在 `finally` 之后补跑一次，不要直接丢弃。

## 打开过的文件

- `dev/plans/review-2026-10-30-r16-entry-extensions.md`
- `dev/plans/review-2026-10-30-r16-entry-extensions-plan.md`
- `dev/plans/review-2026-10-24-r16-extensions-entry.md`
- `dev/plans/review-2026-10-11-r16-extensions-entry.md`
- `dev/plans/review-2026-10-06-r16-tooling.md`
- `dev/plans/review-2026-09-30-r05-tooling.md`
- `dev/plans/review-2026-11-04-p6-tests-and-process-plan.md`
- `dev/plans/review-2026-10-30-r11-conversation.md`
- `dev/plans/INDEX.md`
- `scripts/wiki/wiki.py`
- `scripts/wiki/hooks/pre-commit`
- `scripts/wiki/hooks/commit-msg`
- `scripts/wiki/install-hooks.sh`
- `scripts/run-unit-custom.sh`
- `scripts/check-test-baseline.sh`
- `scripts/check-docs-health.py`
- `scripts/generate-docs-status.py`
- `scripts/docs_status.py`
- `scripts/sync-universe-agent-session-core.ts`
- `scripts/prd-020-turn-fixture-bench.sh`
- `test/unit/electron/renderer.js`
- `test/unit/node/index.js`
- `test/scenario/scripts/run-universe-agent-real-editor.sh`
- `test/scenario/scenarios/universe-agent-real-editor.cjs`
- `test/scenario/src/application.ts`
- `test/scenario/src/artifactPaths.ts`
- `test/scenario/src/launchArguments.ts`
- `test/scenario/src/runScenario.ts`
- `test/componentFixtures/playwright/tests/editorTabBarModes.spec.ts`
- `src/vs/code/electron-main/app.ts`
- `src/vs/code/browser/workbench/workbench.ts`
- `src/vs/server/node/nlsConfigurationCache.ts`
- `src/vs/server/node/remoteLanguagePacks.ts`
- `src/vs/server/node/serverListenError.ts`
- `src/server-main-environment-args.ts`
- `extensions/merge-conflict/src/mergeDecorator.ts`
- `extensions/merge-conflict/src/documentTracker.ts`
- `extensions/merge-conflict/src/delayer.ts`
- `extensions/git/src/repository.ts`
- `extensions/git/src/worktreeIncludeFiles.ts`
- `docs/architecture/cross-cutting/testing.md`
- `docs/guides/test-profile.md`
- 只看了提交差异：`src/vs/code/electron-main/main.ts`、`src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts`、`src/vs/code/electron-utility/sharedProcess/contrib/` 下四个清理器、`extensions/media-preview/src/mediaPreview.ts`、`extensions/git/src/blame.ts`
