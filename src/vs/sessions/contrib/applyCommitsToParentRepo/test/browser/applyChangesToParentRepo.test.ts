/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { constObservable } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { INotification, INotificationService, NoOpNotification, Severity } from '../../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IGitRepository, IGitService } from '../../../../../workbench/contrib/git/common/gitService.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionFolder, ISessionGitRepository, ISessionWorkspace } from '../../../../services/sessions/common/session.js';
import { classifyParentApplyResult, isSameGitCheckout, resolveParentRepoApplyTarget, worktreeMergeRef } from '../../browser/applyChangesToParentRepo.js';

const APPLY_COMMAND = 'chatEditing.applyChangesToParentRepo';

function folder(root: URI, parent: URI, worktree: URI | undefined): ISessionFolder {
	const gitRepository: ISessionGitRepository = {
		uri: parent,
		workTreeUri: worktree,
		baseBranchName: 'main',
		gitHubInfo: constObservable(undefined),
	};
	return {
		root,
		workingDirectory: worktree ?? root,
		name: 'repo',
		description: undefined,
		gitRepository,
	};
}

suite('Apply changes to parent repository', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	interface IRunOptions {
		readonly worktreeRef?: string;
		readonly worktreeCommit?: string;
		readonly worktreeTop?: string;
		readonly parentTop?: string;
		readonly parentBefore?: string;
		readonly parentAfter?: string;
		readonly mergeResult?: string;
		readonly openRepositories?: readonly URI[];
	}

	async function run(sessionFolder: ISessionFolder | undefined, options?: IRunOptions): Promise<{ calls: { id: string; args: readonly unknown[] }[]; notifications: { severity: Severity; message: string }[] }> {
		const calls: { id: string; args: readonly unknown[] }[] = [];
		const notifications: { severity: Severity; message: string }[] = [];
		const workspace: ISessionWorkspace | undefined = sessionFolder ? {
			uri: sessionFolder.root,
			label: 'repo',
			icon: { id: 'folder' },
			folders: [sessionFolder],
			requiresWorkspaceTrust: false,
			isVirtualWorkspace: false,
		} : undefined;
		const worktreePath = sessionFolder?.gitRepository?.workTreeUri?.fsPath;
		const parentPath = sessionFolder?.gitRepository?.uri?.fsPath;
		let parentHeadReads = 0;
		const instantiationService = disposables.add(new TestInstantiationService());
		instantiationService.stub(ISessionsService, upcastPartial<ISessionsService>({
			activeSession: constObservable(upcastPartial<IActiveSession>({
				resource: URI.parse('test://session'),
				workspace: constObservable(workspace),
			})),
		}));
		instantiationService.stub(ICommandService, new class extends mock<ICommandService>() {
			override executeCommand<T>(id: string, ...args: unknown[]): Promise<T | undefined> {
				calls.push({ id, args });
				if (id === '_git.revParseAbbrevRef') {
					return Promise.resolve((options?.worktreeRef ?? 'agents/session') as T);
				}
				if (id === '_git.revParse') {
					const path = args[0];
					const ref = args[1];
					if (ref === '--show-toplevel') {
						const top = path === worktreePath
							? (options?.worktreeTop ?? '/repo.worktrees/session')
							: (options?.parentTop ?? '/repo');
						return Promise.resolve(top as T);
					}
					if (ref === 'HEAD' && path === worktreePath) {
						return Promise.resolve((options?.worktreeCommit ?? 'abc123') as T);
					}
					if (ref === 'HEAD' && path === parentPath) {
						parentHeadReads++;
						const head = parentHeadReads === 1
							? (options?.parentBefore ?? '1111111111111111111111111111111111111111')
							: (options?.parentAfter ?? '2222222222222222222222222222222222222222');
						return Promise.resolve(head as T);
					}
				}
				if (id === '_git.mergeBranch') {
					return Promise.resolve((options?.mergeResult ?? 'Merge made by the \'ort\' strategy.') as T);
				}
				return Promise.resolve(undefined);
			}
		});
		instantiationService.stub(INotificationService, new class extends mock<INotificationService>() {
			override notify(notification: INotification) {
				notifications.push({
					severity: notification.severity,
					message: typeof notification.message === 'string' ? notification.message : notification.message.message,
				});
				return new NoOpNotification();
			}
		});
		instantiationService.stub(ILogService, new class extends mock<ILogService>() {
			override warn(): void { }
			override error(): void { }
		});
		instantiationService.stub(IOpenerService, new class extends mock<IOpenerService>() { });
		instantiationService.stub(IProductService, upcastPartial<IProductService>({ quality: 'stable' }));
		instantiationService.stub(IGitService, upcastPartial<IGitService>({
			repositories: (options?.openRepositories ?? []).map(rootUri => upcastPartial<IGitRepository>({ rootUri })),
		}));

		const command = CommandsRegistry.getCommand(APPLY_COMMAND);
		assert.ok(command);
		await command.handler(instantiationService);

		return { calls, notifications };
	}

	test('merges the worktree branch into the source repository, not the folder root', async () => {
		const parent = URI.file('/repo');
		const worktree = URI.file('/repo.worktrees/session');
		const target = resolveParentRepoApplyTarget(folder(worktree, parent, worktree));
		const result = await run(folder(worktree, parent, worktree));

		assert.deepStrictEqual({
			parent: target?.parent.toString(),
			worktree: target?.worktree.toString(),
			calls: result.calls,
			notifications: result.notifications,
		}, {
			parent: parent.toString(),
			worktree: worktree.toString(),
			calls: [
				{ id: '_git.revParseAbbrevRef', args: [worktree.fsPath] },
				{ id: '_git.revParse', args: [worktree.fsPath, '--show-toplevel'] },
				{ id: '_git.revParse', args: [parent.fsPath, '--show-toplevel'] },
				{ id: '_git.revParse', args: [parent.fsPath, 'HEAD'] },
				{ id: '_git.mergeBranch', args: [parent.fsPath, 'agents/session'] },
				{ id: '_git.revParse', args: [parent.fsPath, 'HEAD'] },
			],
			notifications: [{
				severity: Severity.Info,
				message: 'Applied changes to parent repository.',
			}],
		});
	});

	test('does not merge when the parent path is the worktree, a non-file URI, or not a worktree', async () => {
		const repo = URI.file('/repo');
		const remoteParent = URI.from({ scheme: 'vscode-agent-host', authority: 'wsl', path: '/home/user/repo' });
		const remoteWorktree = URI.from({ scheme: 'vscode-agent-host', authority: 'wsl', path: '/home/user/repo.worktrees/session' });
		const dottedParent = URI.file('/repo/../repo');
		const sameCheckout = await run(folder(repo, repo, repo));
		const remote = await run(folder(remoteParent, remoteParent, remoteWorktree));
		const dotted = await run(folder(repo, dottedParent, repo));
		const plainFolder = await run(folder(repo, repo, undefined));
		const noSession = await run(undefined);

		assert.deepStrictEqual({
			sameCheckout: sameCheckout.calls,
			sameCheckoutNotice: sameCheckout.notifications,
			remoteCalls: remote.calls,
			remoteNotice: remote.notifications,
			dottedCalls: dotted.calls,
			dottedNotice: dotted.notifications,
			plainCalls: plainFolder.calls,
			plainNotice: plainFolder.notifications,
			noSessionCalls: noSession.calls,
			noSessionNotice: noSession.notifications,
		}, {
			sameCheckout: [],
			sameCheckoutNotice: [{ severity: Severity.Warning, message: 'Could not apply changes because this session has no separate local parent repository.' }],
			remoteCalls: [],
			remoteNotice: [{ severity: Severity.Warning, message: 'Could not apply changes because this session has no separate local parent repository.' }],
			dottedCalls: [],
			dottedNotice: [{ severity: Severity.Warning, message: 'Could not apply changes because this session has no separate local parent repository.' }],
			plainCalls: [],
			plainNotice: [],
			noSessionCalls: [],
			noSessionNotice: [],
		});
	});

	test('merges the detached worktree commit instead of the parent HEAD', async () => {
		const parent = URI.file('/repo');
		const worktree = URI.file('/repo.worktrees/session');
		const result = await run(folder(worktree, parent, worktree), {
			worktreeRef: 'HEAD',
			worktreeCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		});

		assert.deepStrictEqual({
			calls: result.calls,
			notifications: result.notifications,
		}, {
			calls: [
				{ id: '_git.revParseAbbrevRef', args: [worktree.fsPath] },
				{ id: '_git.revParse', args: [worktree.fsPath, 'HEAD'] },
				{ id: '_git.revParse', args: [worktree.fsPath, '--show-toplevel'] },
				{ id: '_git.revParse', args: [parent.fsPath, '--show-toplevel'] },
				{ id: '_git.revParse', args: [parent.fsPath, 'HEAD'] },
				{ id: '_git.mergeBranch', args: [parent.fsPath, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'] },
				{ id: '_git.revParse', args: [parent.fsPath, 'HEAD'] },
			],
			notifications: [{
				severity: Severity.Info,
				message: 'Applied changes to parent repository.',
			}],
		});
	});

	test('does not merge when symlink spellings resolve to the same checkout', async () => {
		const parent = URI.file('/private/repo');
		const worktree = URI.file('/tmp/repo');
		const result = await run(folder(worktree, parent, worktree), {
			worktreeTop: '/real/repo',
			parentTop: '/real/repo',
		});

		assert.deepStrictEqual({
			calls: result.calls.map(call => call.id),
			notifications: result.notifications,
		}, {
			calls: ['_git.revParseAbbrevRef', '_git.revParse', '_git.revParse'],
			notifications: [{
				severity: Severity.Warning,
				message: 'Could not apply changes because this session has no separate local parent repository.',
			}],
		});
	});

	test('warns when a merge reports nothing and the parent HEAD did not move', async () => {
		const parent = URI.file('/repo');
		const worktree = URI.file('/repo.worktrees/session');
		const head = '1111111111111111111111111111111111111111';
		const result = await run(folder(worktree, parent, worktree), {
			mergeResult: '',
			parentBefore: head,
			parentAfter: head,
			openRepositories: [parent],
		});

		assert.deepStrictEqual({
			refreshed: result.calls.some(call => call.id === 'git.refresh'),
			notifications: result.notifications,
		}, {
			refreshed: false,
			notifications: [{
				severity: Severity.Warning,
				message: 'Could not confirm that changes were applied to the parent repository.',
			}],
		});
	});

	test('refreshes an open parent repository after the merge moves its HEAD', async () => {
		const parent = URI.file('/repo');
		const worktree = URI.file('/repo.worktrees/session');
		const quiet = await run(folder(worktree, parent, worktree), {
			mergeResult: '',
			openRepositories: [parent],
		});
		const worktreeOnly = await run(folder(worktree, parent, worktree), {
			openRepositories: [worktree],
		});
		const already = await run(folder(worktree, parent, worktree), {
			mergeResult: '已经是最新的。',
			parentBefore: '1111111111111111111111111111111111111111',
			parentAfter: '1111111111111111111111111111111111111111',
			openRepositories: [parent],
		});

		assert.deepStrictEqual({
			quietNotice: quiet.notifications,
			quietRefresh: quiet.calls.filter(call => call.id === 'git.refresh'),
			worktreeOnlyRefresh: worktreeOnly.calls.filter(call => call.id === 'git.refresh'),
			alreadyNotice: already.notifications,
			alreadyRefresh: already.calls.filter(call => call.id === 'git.refresh'),
			mergeRef: worktreeMergeRef('HEAD', 'abc'),
			detachedMissing: worktreeMergeRef('HEAD', '  '),
			sameCheckout: isSameGitCheckout('/real/repo', '/real/repo'),
			distinctCheckout: isSameGitCheckout('/repo', '/repo.worktrees/session'),
			applied: classifyParentApplyResult('aaa', 'bbb', ''),
			upToDate: classifyParentApplyResult('aaa', 'aaa', '已经是最新的。'),
			unconfirmed: classifyParentApplyResult('aaa', 'aaa', ''),
		}, {
			quietNotice: [{ severity: Severity.Info, message: 'Applied changes to parent repository.' }],
			quietRefresh: [{ id: 'git.refresh', args: [parent.fsPath] }],
			worktreeOnlyRefresh: [],
			alreadyNotice: [{ severity: Severity.Info, message: 'Parent repository is up to date with worktree.' }],
			alreadyRefresh: [],
			mergeRef: 'abc',
			detachedMissing: undefined,
			sameCheckout: true,
			distinctCheckout: false,
			applied: 'applied',
			upToDate: 'upToDate',
			unconfirmed: 'unconfirmed',
		});
	});
});
