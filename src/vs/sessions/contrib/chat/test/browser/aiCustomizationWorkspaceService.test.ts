/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IFileContent, IFileService, IFileStatWithMetadata } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IPromptsService } from '../../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js';
import { ISessionFolder, ISessionWorkspace } from '../../../../services/sessions/common/session.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { SessionsAICustomizationWorkspaceService } from '../../browser/aiCustomizationWorkspaceService.js';

suite('SessionsAICustomizationWorkspaceService commit paths', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const repo = URI.file('/repo');
	const worktree = URI.file('/repo/.worktrees/s1');
	const repoSkill = URI.file('/repo/.agents/skills/review/SKILL.md');
	const worktreeSkill = URI.file('/repo/.worktrees/s1/.agents/skills/review/SKILL.md');

	interface ICommitArg {
		readonly repositoryUri?: URI;
		readonly worktreeUri?: URI;
		readonly fileUri?: URI;
	}

	function folder(root: URI, workingDirectory: URI, name: string): ISessionFolder {
		return { root, workingDirectory, name, description: undefined };
	}

	function createService(folders: readonly ISessionFolder[], options?: {
		readonly resolvePath?: (path: string) => string;
		readonly realpath?: (resource: URI) => URI | undefined;
	}) {
		const writes: URI[] = [];
		const deletes: URI[] = [];
		const reads: URI[] = [];
		const commands: { id: string; arg: ICommitArg | undefined }[] = [];
		const resolvePath = options?.resolvePath ?? ((path: string) => path);
		const roots = folders.flatMap(folder => [folder.root, folder.workingDirectory]);
		const activeSession = observableValue<IActiveSession | undefined>('activeSession', upcastPartial<IActiveSession>({
			workspace: observableValue<ISessionWorkspace | undefined>('workspace', upcastPartial<ISessionWorkspace>({
				folders: [...folders],
			})),
		}));
		const sessionsService = new class extends mock<ISessionsService>() {
			override readonly activeSession = activeSession;
		}();
		const fileService = new class extends mock<IFileService>() {
			override async readFile(resource: URI): Promise<IFileContent> {
				reads.push(URI.file(resolvePath(resource.path)));
				return { value: VSBuffer.fromString('skill-body') } as IFileContent;
			}
			override async writeFile(resource: URI): Promise<IFileStatWithMetadata> {
				const resolved = URI.file(resolvePath(resource.path));
				writes.push(resolved);
				return { resource: resolved } as IFileStatWithMetadata;
			}
			override async exists(resource: URI): Promise<boolean> {
				return resource.path === repoSkill.path;
			}
			override async del(resource: URI): Promise<void> {
				deletes.push(URI.file(resolvePath(resource.path)));
			}
			override async realpath(resource: URI): Promise<URI | undefined> {
				if (options?.realpath) {
					return options.realpath(resource);
				}
				// Session roots exist; customization files may not. Disk realpath throws
				// for a missing path so the service has to walk up to the root.
				if (!roots.some(root => root.path === resource.path)) {
					throw new Error('ENOENT');
				}
				return resource;
			}
		}();
		const commandService = new class extends mock<ICommandService>() {
			override async executeCommand<T = unknown>(id: string, arg?: ICommitArg): Promise<T | undefined> {
				commands.push({ id, arg });
				return undefined;
			}
		}();
		const service = new SessionsAICustomizationWorkspaceService(
			sessionsService,
			new class extends mock<IInstantiationService>() { }(),
			new class extends mock<IPromptsService>() { }(),
			commandService,
			new class extends mock<ILogService>() { }(),
			fileService,
			new class extends mock<INotificationService>() { }(),
		);
		return { service, writes, deletes, reads, commands };
	}

	function paths(uris: readonly URI[]): string[] {
		return uris.map(uri => uri.path);
	}

	test('copies a worktree customization onto the repository without leaving it', async () => {
		const { service, writes, commands } = createService([folder(repo, worktree, 'repo')]);

		await service.commitFiles(worktree, [worktreeSkill]);

		assert.deepStrictEqual(paths(writes), [repoSkill.path]);
		assert.deepStrictEqual(commands.map(command => command.id), [
			'github.copilot.cli.sessions.commitToRepository',
			'github.copilot.cli.sessions.commitToWorktree',
		]);
		assert.deepStrictEqual({
			repository: commands[0].arg?.repositoryUri?.path,
			repoFile: commands[0].arg?.fileUri?.path,
			worktree: commands[1].arg?.worktreeUri?.path,
			worktreeFile: commands[1].arg?.fileUri?.path,
		}, {
			repository: '/repo',
			repoFile: repoSkill.path,
			worktree: worktree.path,
			worktreeFile: worktreeSkill.path,
		});
	});

	test('keeps a repository customization inside the repository when the worktree is nested', async () => {
		const { service, writes, commands } = createService([folder(repo, worktree, 'repo')]);

		await service.commitFiles(worktree, [repoSkill]);

		assert.deepStrictEqual(paths(writes), [worktreeSkill.path]);
		assert.deepStrictEqual(commands.map(command => ({
			id: command.id,
			root: (command.arg?.repositoryUri ?? command.arg?.worktreeUri)?.path,
			file: command.arg?.fileUri?.path,
		})), [
			{ id: 'github.copilot.cli.sessions.commitToRepository', root: '/repo', file: repoSkill.path },
			{ id: 'github.copilot.cli.sessions.commitToWorktree', root: worktree.path, file: worktreeSkill.path },
		]);
		assert.ok(writes.every(uri => uri.path === '/repo' || uri.path.startsWith('/repo/')));
		assert.ok(commands.every(command => command.arg?.fileUri?.path !== '/.agents/skills/review/SKILL.md'));
	});

	test('commits a customization in a later session folder to that folder', async () => {
		const repoB = URI.file('/repo-b');
		const worktreeB = URI.file('/repo-b/.worktrees/s2');
		const skillB = URI.file('/repo-b/.agents/skills/review/SKILL.md');
		const { service, writes, commands } = createService([
			folder(repo, worktree, 'repo-a'),
			folder(repoB, worktreeB, 'repo-b'),
		]);

		await service.commitFiles(worktree, [skillB]);

		assert.deepStrictEqual(paths(writes), [URI.file('/repo-b/.worktrees/s2/.agents/skills/review/SKILL.md').path]);
		assert.deepStrictEqual(commands.map(command => ({
			id: command.id,
			root: (command.arg?.repositoryUri ?? command.arg?.worktreeUri)?.path,
			file: command.arg?.fileUri?.path,
		})), [
			{ id: 'github.copilot.cli.sessions.commitToRepository', root: '/repo-b', file: skillB.path },
			{ id: 'github.copilot.cli.sessions.commitToWorktree', root: worktreeB.path, file: '/repo-b/.worktrees/s2/.agents/skills/review/SKILL.md' },
		]);
	});

	test('does not write or commit a file outside every session folder', async () => {
		const outside = URI.file('/tmp/notes.md');
		const { service, writes, deletes, commands } = createService([folder(repo, worktree, 'repo')]);

		await service.commitFiles(worktree, [outside]);
		await service.deleteFiles(worktree, [outside]);

		assert.deepStrictEqual(paths(writes), []);
		assert.deepStrictEqual(paths(deletes), []);
		assert.deepStrictEqual(commands, []);
	});

	test('commits a repository file named ..secret inside the repository', async () => {
		const secret = URI.file('/repo/..secret');
		const { service, writes, commands } = createService([folder(repo, worktree, 'repo')]);

		await service.commitFiles(worktree, [secret]);

		assert.deepStrictEqual(paths(writes), ['/repo/.worktrees/s1/..secret']);
		assert.strictEqual(commands[0].arg?.repositoryUri?.path, '/repo');
		assert.strictEqual(commands[0].arg?.fileUri?.path, '/repo/..secret');
		assert.ok(commands.every(command => !command.arg?.fileUri?.path.startsWith('/..secret') || command.arg?.fileUri?.path.startsWith('/repo/')));
	});

	test('deletes the repository file instead of a path outside the repository', async () => {
		const { service, deletes, commands } = createService([folder(repo, worktree, 'repo')]);

		await service.deleteFiles(worktree, [repoSkill]);

		assert.deepStrictEqual(paths(deletes), [repoSkill.path]);
		assert.deepStrictEqual(commands.map(command => ({
			id: command.id,
			root: (command.arg?.repositoryUri ?? command.arg?.worktreeUri)?.path,
			file: command.arg?.fileUri?.path,
		})), [
			{ id: 'github.copilot.cli.sessions.commitToRepository', root: '/repo', file: repoSkill.path },
			{ id: 'github.copilot.cli.sessions.commitToWorktree', root: worktree.path, file: worktreeSkill.path },
		]);
	});

	/**
	 * `/repo/.agents` is a directory symlink to `/tmp/outside`. Paths under it
	 * stay lexically inside the repository, but write and recursive delete follow
	 * the link.
	 */
	function symlinkedAgentsService() {
		const link = '/repo/.agents';
		const outside = '/tmp/outside';
		const existing = new Set([
			'/repo',
			'/repo/.worktrees/s1',
			'/repo/.agents',
			'/tmp/outside',
		]);
		const resolve = (path: string): string => {
			const parts = path.split('/').filter(part => part.length > 0);
			let acc = '';
			for (const part of parts) {
				acc += `/${part}`;
				if (acc === link) {
					acc = outside;
				}
			}
			return acc || '/';
		};
		const harness = createService([folder(repo, worktree, 'repo')], {
			resolvePath: resolve,
			realpath: resource => {
				const real = resolve(resource.path);
				if (!existing.has(real)) {
					throw new Error('ENOENT');
				}
				return URI.file(real);
			},
		});
		return { ...harness, resolve };
	}

	test('does not mirror a worktree customization through a repository symlink', async () => {
		const { service, reads, writes, deletes, commands, resolve } = symlinkedAgentsService();

		await service.commitFiles(worktree, [worktreeSkill]);
		await service.deleteFiles(worktree, [worktreeSkill]);

		assert.deepStrictEqual({
			reads: paths(reads),
			writes: paths(writes),
			deletes: paths(deletes),
			commands: commands.map(command => ({
				id: command.id,
				root: (command.arg?.repositoryUri ?? command.arg?.worktreeUri)?.path,
				file: command.arg?.fileUri ? resolve(command.arg.fileUri.path) : undefined,
			})),
		}, {
			reads: [],
			writes: [],
			deletes: [],
			commands: [
				{ id: 'github.copilot.cli.sessions.commitToWorktree', root: worktree.path, file: worktreeSkill.path },
				{ id: 'github.copilot.cli.sessions.commitToWorktree', root: worktree.path, file: worktreeSkill.path },
			],
		});
	});

	test('does not read, write, or delete a customization that resolves outside the repository', async () => {
		const { service, reads, writes, deletes, commands } = symlinkedAgentsService();

		await service.commitFiles(worktree, [repoSkill]);
		await service.deleteFiles(worktree, [repoSkill]);

		assert.deepStrictEqual({
			reads: paths(reads),
			writes: paths(writes),
			deletes: paths(deletes),
			commands,
		}, {
			reads: [],
			writes: [],
			deletes: [],
			commands: [],
		});
	});
});
