/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { isEqualOrParent } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../../platform/workspace/common/workspace.js';
import { IExplorerService } from '../../../../../workbench/contrib/files/browser/files.js';
import { OpenEditorCommandId } from '../../../../../workbench/contrib/searchEditor/browser/constants.js';
import '../../browser/search.contribution.js';

suite('SessionsFindInFolder', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const root = URI.file('/repo');
	const src = URI.file('/repo/src');
	const lib = URI.file('/repo/lib');
	const file = URI.file('/repo/src/a.ts');
	const other = URI.file('/other/session/src');

	interface IOpenedSearch {
		readonly id: string;
		readonly args: unknown;
	}

	interface INotice {
		readonly level: 'error' | 'warn';
		readonly message: string;
	}

	function run(options: {
		readonly resource?: unknown;
		readonly forwarded?: unknown;
		readonly context?: readonly URI[];
		readonly unreadable?: readonly URI[];
		readonly onContext?: () => void;
	}): Promise<{ readonly opened: readonly IOpenedSearch[]; readonly notices: readonly INotice[]; readonly resolved: readonly (URI | 'invalid')[] }> {
		const opened: IOpenedSearch[] = [];
		const notices: INotice[] = [];
		const resolved: (URI | 'invalid')[] = [];
		const unreadable = new Set((options.unreadable ?? []).map(uri => uri.toString()));
		const directory = new Set([root.toString(), src.toString(), lib.toString(), other.toString()]);
		const folder = { uri: root, name: 'repo', index: 0, toResource: (relativePath: string) => URI.joinPath(root, relativePath) };
		const accessor = {
			get(id: unknown) {
				if (id === ICommandService) {
					return {
						executeCommand: async (commandId: string, args?: unknown) => {
							opened.push({ id: commandId, args });
						},
					};
				}
				if (id === INotificationService) {
					return {
						error(message: string | Error) {
							notices.push({ level: 'error', message: message instanceof Error ? message.message : String(message) });
						},
						warn(message: string | Error) {
							notices.push({ level: 'warn', message: message instanceof Error ? message.message : String(message) });
						},
					};
				}
				if (id === IFileService) {
					return {
						resolveAll: async (entries: readonly { resource: URI }[]) => entries.map(entry => {
							if (!URI.isUri(entry.resource)) {
								resolved.push('invalid');
								return { success: false, stat: undefined };
							}
							resolved.push(entry.resource);
							if (unreadable.has(entry.resource.toString())) {
								return { success: false, stat: undefined };
							}
							return {
								success: true,
								stat: { resource: entry.resource, isDirectory: directory.has(entry.resource.toString()) },
							};
						}),
					};
				}
				if (id === IWorkspaceContextService) {
					return {
						getWorkspace: () => ({ id: 'test', folders: [folder] }),
						getWorkbenchState: () => WorkbenchState.WORKSPACE,
						getWorkspaceFolder: (resource: URI) => isEqualOrParent(resource, root) ? folder : null,
						isInsideWorkspace: (resource: URI) => isEqualOrParent(resource, root),
					};
				}
				if (id === IExplorerService) {
					return {
						getContext: () => {
							options.onContext?.();
							return (options.context ?? []).map(resource => ({ resource }));
						},
					};
				}
				throw new Error(`unexpected service ${String(id)}`);
			},
		} as ServicesAccessor;

		const command = CommandsRegistry.getCommand('sessions.files.action.findInFolder');
		if (!command) {
			assert.fail('sessions.files.action.findInFolder is not registered');
		}
		return Promise.resolve(command.handler(accessor, options.resource, options.forwarded)).then(() => ({ opened, notices, resolved }));
	}

	function includesOf(opened: readonly IOpenedSearch[]): string | undefined {
		assert.strictEqual(opened.length, 1);
		assert.strictEqual(opened[0].id, OpenEditorCommandId);
		const args = opened[0].args as { filesToInclude?: string; showIncludesExcludes?: boolean; location?: string };
		assert.strictEqual(args.showIncludesExcludes, true);
		assert.strictEqual(args.location, 'reuse');
		return args.filesToInclude;
	}

	test('searches every folder in the context-menu selection, not only the clicked one', async () => {
		const result = await run({
			resource: src,
			forwarded: [src, lib],
			context: [URI.file('/wrong-session/only')],
			onContext: () => { throw new Error('menu selection must win over explorer context'); },
		});

		assert.deepStrictEqual(result.notices, []);
		assert.strictEqual(includesOf(result.opened), './repo/src, ./repo/lib');
	});

	test('does not replace an explicit folder with a different explorer selection', async () => {
		const result = await run({
			resource: src,
			context: [lib, URI.file('/repo/other')],
		});

		assert.deepStrictEqual(result.notices, []);
		assert.strictEqual(includesOf(result.opened), './repo/src');
	});

	test('keeps an explorer multi-selection that contains the clicked folder', async () => {
		const result = await run({
			resource: src,
			context: [lib, src],
		});

		assert.deepStrictEqual(result.notices, []);
		assert.strictEqual(includesOf(result.opened), './repo/lib, ./repo/src');
	});

	test('uses the focused explorer folder when the click argument is not a URI', async () => {
		const result = await run({
			resource: {},
			forwarded: [],
			context: [src],
		});

		assert.deepStrictEqual(result.notices, []);
		assert.deepStrictEqual(result.resolved.map(uri => uri.toString()), [src.toString()]);
		assert.strictEqual(includesOf(result.opened), './repo/src');
	});

	test('reports an empty target instead of searching the whole session', async () => {
		const result = await run({ resource: {}, forwarded: [] });

		assert.deepStrictEqual(result.opened, []);
		assert.deepStrictEqual(result.resolved, []);
		assert.deepStrictEqual(result.notices, [{
			level: 'error',
			message: 'Choose a folder in the Files view to search.',
		}]);
	});

	test('reports an unreadable folder instead of searching the whole session', async () => {
		const result = await run({ resource: src, unreadable: [src] });

		assert.deepStrictEqual(result.opened, []);
		assert.deepStrictEqual(result.notices, [{
			level: 'error',
			message: "Couldn't search src. It may have been moved or deleted.",
		}]);
	});

	test('does not search a folder from another session workspace', async () => {
		const result = await run({ resource: other });

		assert.deepStrictEqual(result.opened, []);
		assert.deepStrictEqual(result.notices, [{
			level: 'error',
			message: "Couldn't search src. It isn't in this session's workspace.",
		}]);
	});

	test('warns and still searches the folders that can be read', async () => {
		const result = await run({
			resource: src,
			forwarded: [src, lib],
			unreadable: [lib],
		});

		assert.deepStrictEqual(result.notices, [{
			level: 'warn',
			message: "Couldn't search lib. Searching the other selected folders.",
		}]);
		assert.strictEqual(includesOf(result.opened), './repo/src');
	});

	test('searches the parent folder of a selected file', async () => {
		const result = await run({ resource: file });

		assert.deepStrictEqual(result.notices, []);
		assert.strictEqual(includesOf(result.opened), './repo/src');
	});

	test('opens a search for the workspace root', async () => {
		const result = await run({ resource: root });

		assert.deepStrictEqual(result.notices, []);
		assert.strictEqual(includesOf(result.opened), './repo');
	});
});
