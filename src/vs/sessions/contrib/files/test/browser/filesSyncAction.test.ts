/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ISCMService } from '../../../../../workbench/contrib/scm/common/scm.js';
import { SessionHasGitSyncActionRunningContext } from '../../../../common/contextkeys.js';
import '../../browser/files.contribution.js';

suite('FilesSyncAction', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	function accessorFor(options: {
		readonly folders: readonly { readonly uri: URI }[];
		readonly notifications: string[];
		readonly contextKeyService: MockContextKeyService;
		readonly onSync: () => void | Promise<void>;
		readonly repositories?: Iterable<{ provider: { rootUri: URI; isHidden?: boolean; statusBarCommands: { get(): readonly { id: string; title: string; tooltip?: string }[] | undefined } } }>;
		readonly executed?: { id: string; args: readonly unknown[] }[];
	}): ServicesAccessor {
		const commandService = {
			executeCommand: async (id: string, ...args: unknown[]) => {
				options.executed?.push({ id, args });
				if (id === 'git.sync' || id === 'git.publish') {
					await options.onSync();
				}
			},
		};
		return {
			get(id: unknown) {
				if (id === ICommandService) {
					return commandService;
				}
				if (id === IContextKeyService) {
					return options.contextKeyService;
				}
				if (id === IWorkspaceContextService) {
					return { getWorkspace: () => ({ id: 'test', folders: options.folders }) };
				}
				if (id === ISCMService) {
					return { repositories: options.repositories ?? [] };
				}
				if (id === INotificationService) {
					return {
						error(message: string | Error | readonly (string | Error)[]) {
							const text = Array.isArray(message)
								? message.map(part => part instanceof Error ? part.message : String(part)).join('\n')
								: message instanceof Error ? message.message : String(message);
							options.notifications.push(text);
						},
					};
				}
				throw new Error('unexpected service');
			},
		} as ServicesAccessor;
	}

	test('git sync failure notifies and clears the running flag', async () => {
		const command = CommandsRegistry.getCommand('sessions.files.action.syncChanges');
		if (!command) {
			assert.fail('sessions.files.action.syncChanges is not registered');
		}
		const contextKeyService = new MockContextKeyService();
		const notifications: string[] = [];
		let runningDuringSync: boolean | undefined;
		const accessor = accessorFor({
			folders: [{ uri: URI.file('/repo') }],
			notifications,
			contextKeyService,
			onSync: () => {
				runningDuringSync = contextKeyService.getContextKeyValue(SessionHasGitSyncActionRunningContext.key);
				throw new Error('sync failed');
			},
		});

		await command.handler(accessor);
		assert.strictEqual(runningDuringSync, true);
		assert.deepStrictEqual(notifications, ['sync failed']);
		assert.strictEqual(contextKeyService.getContextKeyValue(SessionHasGitSyncActionRunningContext.key), false);
	});

	test('publish status runs git.publish instead of git.sync', async () => {
		const command = CommandsRegistry.getCommand('sessions.files.action.syncChanges');
		if (!command) {
			assert.fail('sessions.files.action.syncChanges is not registered');
		}
		const folder = URI.file('/repo');
		const executed: { id: string; args: readonly unknown[] }[] = [];
		const accessor = accessorFor({
			folders: [{ uri: folder }],
			notifications: [],
			contextKeyService: new MockContextKeyService(),
			onSync: () => { },
			executed,
			repositories: [{
				provider: {
					rootUri: folder,
					statusBarCommands: {
						get: () => [
							{ id: 'git.checkout', title: '$(git-branch) main', tooltip: 'Checkout' },
							{ id: 'git.publish', title: '$(cloud-upload)', tooltip: 'Publish Branch' },
						],
					},
				},
			}],
		});

		await command.handler(accessor);
		assert.deepStrictEqual(executed.map(entry => entry.id), ['git.publish']);
		assert.strictEqual(executed[0].args[0], folder);
	});
});
