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
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionFolder, ISessionGitRepository, ISessionWorkspace } from '../../../../services/sessions/common/session.js';
import { resolveParentRepoApplyTarget } from '../../browser/applyChangesToParentRepo.js';

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

	async function run(sessionFolder: ISessionFolder | undefined): Promise<{ calls: { id: string; args: readonly unknown[] }[]; notifications: { severity: Severity; message: string }[] }> {
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
					return Promise.resolve('agents/session' as T);
				}
				return Promise.resolve('Merge made by the \'ort\' strategy.' as T);
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
		instantiationService.stub(ILogService, new class extends mock<ILogService>() { });
		instantiationService.stub(IOpenerService, new class extends mock<IOpenerService>() { });
		instantiationService.stub(IProductService, upcastPartial<IProductService>({ quality: 'stable' }));

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
				{ id: '_git.mergeBranch', args: [parent.fsPath, 'agents/session'] },
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
});
