/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { EditorOpenSource, IResourceEditorInput } from '../../../../../platform/editor/common/editor.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ISCMResource, ISCMService } from '../../../scm/common/scm.js';
import { ACTIVE_GROUP, CONVERSATION_GROUP, IEditorService } from '../../../../services/editor/common/editorService.js';
import { SourcesChangesList } from '../../browser/sourcesChangesList.js';
import { openSourcesChangeEntry, ISourcesChangeEntryOpenDeps } from '../../browser/sourcesChangeEntryOpen.js';
import { sourcesGitEmptyFileDiffMessage, sourcesGitLocalOnlyMessage, sourcesGitReadFailureMessage, sourcesGitReadUnavailableNoHookMessage } from '../../common/sourcesChangesGitRead.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { ISourcesChangeEntry } from '../../common/sourcesChangesModel.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';

suite('Sources - Changes list open', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createEntry(resource: URI, scmResource?: ISCMResource): ISourcesChangeEntry {
		return {
			resource,
			name: resource.path.split('/').pop() ?? '',
			description: 'Changes',
			groupId: 'workingTree',
			scmResource,
		};
	}

	function createDeps(overrides: Partial<ISourcesChangeEntryOpenDeps> & Pick<ISourcesChangeEntryOpenDeps, 'editorService'>): ISourcesChangeEntryOpenDeps {
		const configurationService = new TestConfigurationService();
		return {
			quickDiffService: {
				getQuickDiffs: async () => [],
			} as unknown as IQuickDiffService,
			configurationService,
			instantiationService: {
				createInstance: (ctor: typeof ConversationDiffReviewInput, modified: URI, original?: URI) =>
					store.add(new ctor(modified, original)),
			} as unknown as ISourcesChangeEntryOpenDeps['instantiationService'],
			sourcesDiffPanelService: {
				show: async () => { },
			} as unknown as ISourcesDiffPanelService,
			...overrides,
		};
	}

	test('openSourcesChangeEntry uses scmResource.open for working-tree diff', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let openedPreserveFocus: boolean | undefined;
		const scmResource = {
			open: async (preserveFocus: boolean) => {
				openedPreserveFocus = preserveFocus;
			},
		} as unknown as ISCMResource;

		await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
			editorService: {
				openEditor: async () => {
					assert.fail('must not open file preview when scmResource is present');
				},
			} as unknown as IEditorService,
		}), { preserveFocus: true });

		assert.strictEqual(openedPreserveFocus, true);
	});

	test('openSourcesChangeEntry falls back to file preview without scmResource', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let openedResource: URI | undefined;
		let openedGroup: unknown;

		await openSourcesChangeEntry(createEntry(resource), createDeps({
			editorService: {
				openEditor: async (input: IResourceEditorInput, group?: unknown) => {
					openedResource = input.resource;
					openedGroup = group;
					return undefined;
				},
			} as unknown as IEditorService,
		}), { preserveFocus: false, pinned: true });

		assert.strictEqual(openedResource?.toString(), resource.toString());
		assert.strictEqual(openedGroup, ACTIVE_GROUP);
	});

	test('openSourcesChangeEntry passes editor options on preview fallback', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let capturedOptions: { preserveFocus?: boolean; pinned?: boolean; source?: EditorOpenSource } | undefined;

		await openSourcesChangeEntry(createEntry(resource), createDeps({
			editorService: {
				openEditor: async (input: IResourceEditorInput) => {
					capturedOptions = input.options;
					return undefined;
				},
			} as unknown as IEditorService,
		}), { preserveFocus: true, pinned: true });

		assert.strictEqual(capturedOptions?.preserveFocus, true);
		assert.strictEqual(capturedOptions?.pinned, true);
		assert.strictEqual(capturedOptions?.source, EditorOpenSource.USER);
	});

	test('openSourcesChangeEntry opens conversation diff review input when default owner is conversation', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/src/a.ts.git');
		let openedInput: unknown;
		let openedGroup: unknown;

		const configurationService = new TestConfigurationService({ 'sources.diff.defaultOwner': 'conversation' });
		const store = new DisposableStore();

		await openSourcesChangeEntry(createEntry(resource), createDeps({
			editorService: {
				openEditor: async (input: unknown, _options: unknown, group?: unknown) => {
					if (input instanceof ConversationDiffReviewInput) {
						store.add(input);
					}
					openedInput = input;
					openedGroup = group;
					return undefined;
				},
			} as unknown as IEditorService,
			quickDiffService: {
				getQuickDiffs: async () => [{ originalResource: original, id: 'git', label: 'Git', kind: 'primary' }],
			} as unknown as IQuickDiffService,
			configurationService,
			instantiationService: {
				createInstance: (ctor: typeof ConversationDiffReviewInput, modified: URI, originalUri?: URI) => store.add(new ctor(modified, originalUri)),
			} as unknown as ISourcesChangeEntryOpenDeps['instantiationService'],
		}), { preserveFocus: false });

		assert.ok(openedInput instanceof ConversationDiffReviewInput);
		assert.strictEqual((openedInput as ConversationDiffReviewInput).modified.toString(), resource.toString());
		assert.strictEqual((openedInput as ConversationDiffReviewInput).original?.toString(), original.toString());
		assert.strictEqual(openedGroup, CONVERSATION_GROUP);
		store.dispose();
	});

	test('openSourcesChangeEntry reads Git file diff for git-sourced rows without local original', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'a.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
		};
		const diffCalls: { path: string; indexState: string }[] = [];
		const models = new Map<string, string>();
		let openedOriginal: string | undefined;
		let openedModified: string | undefined;

		await openSourcesChangeEntry(entry, createDeps({
			editorService: {
				openEditor: async (input: { original?: { resource?: URI }; modified?: { resource?: URI }; resource?: URI }) => {
					openedOriginal = input.original?.resource?.toString();
					openedModified = input.modified?.resource?.toString() ?? input.resource?.toString();
					return undefined;
				},
			} as unknown as IEditorService,
			modelService: {
				getModel: (uri: URI) => models.has(uri.toString()) ? { uri } : null,
				updateModel: (model: { uri: URI }, value: string) => {
					models.set(model.uri.toString(), value);
				},
				createModel: (value: string, _language: unknown, uri?: URI) => {
					if (uri) {
						models.set(uri.toString(), value);
					}
					return { uri };
				},
			} as unknown as ISourcesChangeEntryOpenDeps['modelService'],
			readGitFileDiff: async gitEntry => {
				diffCalls.push({ path: gitEntry.gitPath ?? '', indexState: gitEntry.indexState ?? '' });
				return {
					supported: true,
					reason: '',
					path: gitEntry.gitPath ?? '',
					unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n',
				};
			},
		}), { preserveFocus: false });

		assert.deepStrictEqual(diffCalls, [{ path: 'src/a.ts', indexState: 'WORKTREE' }]);
		assert.ok(openedOriginal?.includes('sources-git-diff'));
		assert.ok(openedModified?.includes('sources-git-diff'));
	});

	test('openSourcesChangeEntry does not invent a git diff when hook is missing or unsupported', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'a.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
		};

		let openedWithoutHook: string | undefined;
		await openSourcesChangeEntry(entry, createDeps({
			editorService: {
				openEditor: async (input: { resource?: URI }) => {
					openedWithoutHook = input.resource?.toString();
					return undefined;
				},
			} as unknown as IEditorService,
			modelService: {
				getModel: () => null,
				updateModel: () => { },
				createModel: () => { assert.fail('must not invent a diff model when hook is missing'); },
			} as unknown as ISourcesChangeEntryOpenDeps['modelService'],
		}), { preserveFocus: false });
		assert.strictEqual(openedWithoutHook, resource.toString());

		let openedUnsupported: string | undefined;
		const diffCalls: { path: string; indexState: string }[] = [];
		await openSourcesChangeEntry(entry, createDeps({
			editorService: {
				openEditor: async (input: { resource?: URI }) => {
					openedUnsupported = input.resource?.toString();
					return undefined;
				},
			} as unknown as IEditorService,
			modelService: {
				getModel: () => null,
				updateModel: () => { },
				createModel: () => { assert.fail('must not invent a diff model when GitService is unsupported'); },
			} as unknown as ISourcesChangeEntryOpenDeps['modelService'],
			readGitFileDiff: async gitEntry => {
				diffCalls.push({ path: gitEntry.gitPath ?? '', indexState: gitEntry.indexState ?? '' });
				return { supported: false, reason: '', path: '', unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n' };
			},
		}), { preserveFocus: false });
		assert.deepStrictEqual(diffCalls, [{ path: 'src/a.ts', indexState: 'WORKTREE' }]);
		assert.strictEqual(openedUnsupported, resource.toString());
	});

	test('openSourcesChangeEntry does not open supported empty unifiedDiff as a new file', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'a.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
		};
		let opened = false;

		await assert.rejects(async () => {
			await openSourcesChangeEntry(entry, createDeps({
				editorService: {
					openEditor: async () => {
						opened = true;
						return undefined;
					},
				} as unknown as IEditorService,
				modelService: {
					getModel: () => null,
					updateModel: () => { },
					createModel: () => { assert.fail('must not invent a diff model for empty unifiedDiff'); },
				} as unknown as ISourcesChangeEntryOpenDeps['modelService'],
				readGitFileDiff: async () => ({
					supported: true,
					reason: '',
					path: 'src/a.ts',
					unifiedDiff: '',
				}),
			}), { preserveFocus: false });
		}, (error: Error) => {
			assert.strictEqual(error.message, sourcesGitEmptyFileDiffMessage());
			return true;
		});
		assert.strictEqual(opened, false);
	});
});

suite('Sources - Changes list leftover honesty', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createEmptyScmService(): ISCMService {
		return {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function createRoster(sessionId = 'session-1'): IConversationRosterService {
		return {
			getActiveSessionId: () => sessionId,
			onDidChangeActiveSession: Event.None,
		} as unknown as IConversationRosterService;
	}

	function createGitReadConnection(options: {
		readonly onDidChangeConnection?: Event<UniverseAgentConnectionSnapshot>;
		readonly readGitChanges: () => Promise<{
			supported: boolean;
			reason: string;
			branch: string;
			entries: Array<{ path: string; oldPath: string; kind: string; indexState: string }>;
		}>;
	}): IUniverseAgentConnection {
		return {
			isEngineConnected: () => true,
			onDidChangeConnection: options.onDidChangeConnection ?? Event.None,
			readGitChanges: options.readGitChanges,
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;
	}

	function createIndexScmService(resource: URI): ISCMService {
		const group = {
			id: 'index',
			label: 'Staged Changes',
			resources: [] as ISCMResource[],
		};
		const scmResource = {
			sourceUri: resource,
			resourceGroup: group,
			decorations: {},
			contextValue: undefined,
			command: undefined,
			multiDiffEditorOriginalUri: undefined,
			multiDiffEditorModifiedUri: undefined,
			open: async () => { },
		} as unknown as ISCMResource;
		group.resources.push(scmResource);
		const repository = {
			provider: {
				groups: [group],
				onDidChangeResources: Event.None,
				onDidChangeResourceGroups: Event.None,
				inputBoxTextModel: { setValue: () => { } },
			},
			input: {
				value: '',
				setValue: () => { },
				onDidChange: Event.None,
			},
		};
		return {
			_serviceBrand: undefined,
			get repositories() { return [repository]; },
			get repositoryCount() { return 1; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function stubChangesListServices(connection: IUniverseAgentConnection, scmService: ISCMService = createEmptyScmService()) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(ISCMService, scmService);
		instantiationService.stub(IConversationRosterService, createRoster());
		instantiationService.stub(IQuickDiffService, {
			getQuickDiffs: async () => [],
		} as unknown as IQuickDiffService);
		instantiationService.stub(ISourcesDiffPanelService, {
			onDidChangeRef: Event.None,
			getCurrentRef: () => undefined,
			show: async () => { },
			clear: () => { },
		} as unknown as ISourcesDiffPanelService);
		instantiationService.stub(ICommandService, {
			onWillExecuteCommand: Event.None,
			onDidExecuteCommand: Event.None,
			executeCommand: async () => undefined,
		} as unknown as ICommandService);
		return instantiationService;
	}

	function mountHost(): HTMLElement {
		const host = document.createElement('div');
		host.style.width = '400px';
		host.style.height = '300px';
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });
		return host;
	}

	async function waitForStatusText(host: HTMLElement, contains?: string): Promise<string> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const text = host.querySelector('.sources-changes-status')?.textContent ?? '';
			if (text && (!contains || text.includes(contains))) {
				return text;
			}
			await timeout(20);
		}
		throw new Error(`status stayed empty${contains ? ` (wanted ${contains})` : ''}`);
	}

	async function waitForList(owner: { list?: WorkbenchList<ISourcesChangeEntry> }): Promise<WorkbenchList<ISourcesChangeEntry>> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const list = (owner as { list?: WorkbenchList<ISourcesChangeEntry> }).list;
			if (list && list.length > 0) {
				list.layout(120, 400);
				return list;
			}
			await timeout(20);
		}
		throw new Error('list stayed empty');
	}

	test('first git-read throw stays empty and paints failure', async function () {
		const host = mountHost();
		const widget = store.add(stubChangesListServices(createGitReadConnection({
			readGitChanges: async () => {
				throw new Error('boom');
			},
		})).createInstance(SourcesChangesList, host));

		const status = await waitForStatusText(host, 'Unable to read git changes');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.strictEqual((widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> }).list?.length ?? 0, 0);
		assert.ok(!host.querySelector('.sources-changes-list .monaco-list-row'));
		assert.ok(!(host.querySelector('.sources-changes-empty')?.textContent ?? '').includes('No changes.'));
	});

	test('success then git-read throw keeps leftover rows and paints failure', async function () {
		let readCalls = 0;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const connection = createGitReadConnection({
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls++;
				if (readCalls === 1) {
					return {
						supported: true,
						reason: '',
						branch: 'main',
						entries: [leftover],
					};
				}
				throw new Error('boom');
			},
		});

		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).name, 'leftover.ts');
		assert.strictEqual(readCalls, 1);

		onDidChangeConnection.fire({} as UniverseAgentConnectionSnapshot);

		const status = await waitForStatusText(host, 'Unable to read git changes');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.strictEqual(readCalls, 2);
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).name, 'leftover.ts');
		assert.ok(host.querySelector('.sources-changes-list .monaco-list-row'));
		assert.notStrictEqual((host.querySelector('.sources-changes-status') as HTMLElement).style.display, 'none');
	});

	test('success then missing readGitChanges keeps leftover rows and does not paint local-only', async function () {
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const connection = createGitReadConnection({
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [leftover],
			}),
		});
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub)).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);

		delete (connection as { readGitChanges?: unknown }).readGitChanges;
		onDidChangeConnection.fire({} as UniverseAgentConnectionSnapshot);

		const status = await waitForStatusText(host, 'no git changes API');
		assert.strictEqual(status, sourcesGitReadUnavailableNoHookMessage());
		assert.ok(!status.includes('local source control'));
		assert.notStrictEqual(status, sourcesGitLocalOnlyMessage());
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.strictEqual(list.element(0).scmResource, undefined);
	});
});
