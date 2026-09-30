/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import assert from 'assert';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extensions, Uri } from 'vscode';
import type { GitExtension, API } from '../api/git';
import { joinRepositoryDotGitPath } from '../repository';

const OPERATION_STATE_FILES = [
	'REBASE_HEAD',
	'rebase-apply',
	'rebase-merge',
	'MERGE_HEAD',
	'CHERRY_PICK_HEAD',
] as const;

function exec(cwd: string, command: string): string {
	return cp.execSync(command, { cwd, encoding: 'utf8' }).trim();
}

function pathExists(filePath: string): Promise<boolean> {
	return new Promise(resolve => fs.exists(filePath, resolve));
}

function absoluteGitDir(cwd: string): string {
	return exec(cwd, 'git rev-parse --absolute-git-dir');
}

function initTempRepo(mainRoot: string): string {
	fs.mkdirSync(mainRoot, { recursive: true });
	fs.writeFileSync(path.join(mainRoot, 'file.txt'), 'content\n');
	exec(mainRoot, 'git init -b main');
	exec(mainRoot, 'git config user.email monacotools@example.com');
	exec(mainRoot, 'git config user.name testuser');
	exec(mainRoot, 'git config commit.gpgsign false');
	exec(mainRoot, 'git add file.txt');
	exec(mainRoot, 'git commit -m "initial commit"');
	return exec(mainRoot, 'git rev-parse HEAD');
}

function addWorktree(mainRoot: string, worktreeRoot: string, branch: string): void {
	fs.mkdirSync(path.dirname(worktreeRoot), { recursive: true });
	exec(mainRoot, `git worktree add "${worktreeRoot}" -b ${branch}`);
}

function setupRebaseState(gitDir: string, rebaseHead: string): void {
	const rebaseMergeDir = joinRepositoryDotGitPath(gitDir, 'rebase-merge');
	fs.mkdirSync(rebaseMergeDir, { recursive: true });
	fs.writeFileSync(path.join(rebaseMergeDir, 'head-name'), 'refs/heads/main\n');
	fs.writeFileSync(joinRepositoryDotGitPath(gitDir, 'REBASE_HEAD'), `${rebaseHead}\n`);
}

function removeDir(dir: string): void {
	fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}

suite('git dir operation state', function () {
	this.timeout(60000);

	let git: API;

	suiteSetup(async function () {
		const ext = extensions.getExtension<GitExtension>('vscode.git');
		await ext?.activate();
		git = ext!.exports.getAPI(1);
	});

	test('joinRepositoryDotGitPath places operation state files under git-dir not worktree root .git', () => {
		const root = '/repo';
		const dotGitPath = '/repo/.git/worktrees/wt';

		for (const fileName of OPERATION_STATE_FILES) {
			const resolved = joinRepositoryDotGitPath(dotGitPath, fileName);
			assert.strictEqual(resolved, path.join(dotGitPath, fileName));
			assert.notStrictEqual(resolved, path.join(root, '.git', fileName));
		}
	});

	test('reads rebaseCommit from linked worktree git-dir after status', async function () {
		const mainRoot = path.join(os.tmpdir(), `vscode-git-dir-op-${Date.now()}-rebase`);
		const worktreeRoot = path.join(mainRoot, 'linked-wt');

		try {
			const commitHash = initTempRepo(mainRoot);
			addWorktree(mainRoot, worktreeRoot, 'wt-rebase');

			const gitDir = absoluteGitDir(worktreeRoot);
			assert.ok(fs.statSync(path.join(worktreeRoot, '.git')).isFile());
			setupRebaseState(gitDir, commitHash);

			const repository = await git.openRepository(Uri.file(worktreeRoot));
			assert.ok(repository);

			await repository.status();
			assert.strictEqual(repository.state.rebaseCommit?.hash, commitHash);

			fs.writeFileSync(joinRepositoryDotGitPath(gitDir, 'REBASE_HEAD'), 'not-a-valid-commit\n');
			await repository.status();
			assert.strictEqual(repository.state.rebaseCommit, undefined);
		} finally {
			removeDir(mainRoot);
		}
	});

	test('retains rebaseCommit when status rejects after corrupt worktree index (separate fixture)', async function () {
		const mainRoot = path.join(os.tmpdir(), `vscode-git-dir-op-${Date.now()}-status-reject`);
		const worktreeRoot = path.join(mainRoot, 'linked-wt');

		try {
			const commitHash = initTempRepo(mainRoot);
			addWorktree(mainRoot, worktreeRoot, 'wt-status-reject');

			const gitDir = absoluteGitDir(worktreeRoot);
			setupRebaseState(gitDir, commitHash);
			fs.writeFileSync(path.join(gitDir, 'index'), 'bad');

			const repository = await git.openRepository(Uri.file(worktreeRoot));
			assert.ok(repository);

			let statusRejected = false;
			try {
				await repository.status();
			} catch {
				statusRejected = true;
			}

			assert.ok(statusRejected, 'status() must reject when git status exits 128');
			assert.strictEqual(repository.state.rebaseCommit?.hash, commitHash);
		} finally {
			removeDir(mainRoot);
		}
	});

	test('detects MERGE_HEAD and CHERRY_PICK_HEAD in worktree git-dir not under root/.git', async function () {
		const mainRoot = path.join(os.tmpdir(), `vscode-git-dir-op-${Date.now()}-merge-cherry`);
		const worktreeRoot = path.join(mainRoot, 'linked-wt');

		try {
			const commitHash = initTempRepo(mainRoot);
			addWorktree(mainRoot, worktreeRoot, 'wt-merge-cherry');

			const gitDir = absoluteGitDir(worktreeRoot);
			assert.ok(fs.statSync(path.join(worktreeRoot, '.git')).isFile());

			fs.writeFileSync(joinRepositoryDotGitPath(gitDir, 'MERGE_HEAD'), `${commitHash}\n`);
			fs.writeFileSync(joinRepositoryDotGitPath(gitDir, 'CHERRY_PICK_HEAD'), `${commitHash}\n`);

			assert.strictEqual(await pathExists(joinRepositoryDotGitPath(gitDir, 'MERGE_HEAD')), true);
			assert.strictEqual(await pathExists(joinRepositoryDotGitPath(gitDir, 'CHERRY_PICK_HEAD')), true);
			assert.strictEqual(await pathExists(path.join(worktreeRoot, '.git', 'MERGE_HEAD')), false);
			assert.strictEqual(await pathExists(path.join(worktreeRoot, '.git', 'CHERRY_PICK_HEAD')), false);
		} finally {
			removeDir(mainRoot);
		}
	});
});
