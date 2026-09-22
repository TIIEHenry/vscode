/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService, ServiceIdentifier, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { sourcesGitDiffOpenFailureMessage } from '../../common/sourcesChangesGitRead.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { ISourcesReviewHostService, ISourcesReviewListHost } from '../../common/sourcesReviewHostService.js';
import { ISourcesReviewProgressService } from '../../common/sourcesReviewProgress.js';
import { SourcesReviewHostService } from '../../browser/sourcesReviewHostService.js';
import { SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND } from '../../browser/sourcesReview.contribution.js';
import {
	SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND,
	SOURCES_REVIEW_OPEN_SELECTED_COMMAND,
	SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND,
} from '../../browser/sourcesReviewCommands.contribution.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { SourcesTabId } from '../../common/sourcesTabs.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';

suite('Sources - review showForPaths', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function stubOpenSelectedConnection(overrides: {
		readGitFileDiff?: IUniverseAgentConnection['readGitFileDiff'];
	} = {}): IUniverseAgentConnection {
		return {
			isEngineConnected: () => true,
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitFileDiff: overrides.readGitFileDiff,
		} as unknown as IUniverseAgentConnection;
	}

	function stubOpenSelectedRoster(): IConversationRosterService {
		return {
			getActiveSessionId: () => 'session-1',
		} as unknown as IConversationRosterService;
	}

	function stubAccessor(get: (id: unknown) => unknown): ServicesAccessor {
		return { get: <T,>(id: ServiceIdentifier<T>) => get(id) as T };
	}

	function stubReviewListHost(overrides: Partial<ISourcesReviewListHost> = {}): ISourcesReviewListHost {
		return {
			selectReviewTab: () => { },
			setPathFilter: () => { },
			getSelectedEntry: () => undefined,
			toggleReviewedSelected: () => { },
			markAllReviewed: () => { },
			setStatusMessage: () => { },
			isSourcesGitFileDiffOpenSkipped: () => false,
			isSourcesGitWriteClosed: () => false,
			readGitFileDiff: async () => undefined,
			...overrides,
		};
	}

	test('showForPaths selects review tab and applies path-set', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		let selectedTab: SourcesTabId | undefined;
		let pathFilter: typeof resource[] | undefined = ['initial'] as unknown as typeof resource[];

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost(stubReviewListHost({
			selectReviewTab: () => { selectedTab = SourcesTabId.Review; },
			setPathFilter: (paths: URI[] | undefined) => { pathFilter = paths; },
		}));

		hostService.showForPaths([resource]);

		assert.strictEqual(selectedTab, SourcesTabId.Review);
		assert.strictEqual(pathFilter?.length, 1);
		assert.strictEqual(pathFilter?.[0].toString(), resource.toString());
	});

	test('command shows hidden Sources part before navigating', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const setPartHiddenCalls: { hidden: boolean; part: Parts }[] = [];

		const layoutService = {
			isVisible: (part: Parts) => part === Parts.SOURCES_PART ? false : true,
			setPartHidden: (hidden: boolean, part: Parts) => {
				setPartHiddenCalls.push({ hidden, part });
			},
		} as unknown as IWorkbenchLayoutService;

		const hostService = store.add(new SourcesReviewHostService());
		let pathFilter: URI[] | undefined;
		hostService.registerReviewListHost(stubReviewListHost({
			setPathFilter: (paths: URI[] | undefined) => { pathFilter = paths; },
		}));

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IWorkbenchLayoutService, layoutService);
		instantiationService.stub(ISourcesReviewHostService, hostService);

		await CommandsRegistry.getCommand(SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND)?.handler?.(stubAccessor((id: unknown) => {
			if (id === IWorkbenchLayoutService) {
				return layoutService;
			}
			if (id === ISourcesReviewHostService) {
				return hostService;
			}
			throw new Error(`unexpected service ${String(id)}`);
		}), [resource]);

		assert.deepStrictEqual(setPartHiddenCalls, [{ hidden: false, part: Parts.SOURCES_PART }]);
		assert.strictEqual(pathFilter?.length, 1);
	});

	test('clear path-set passes undefined', () => {
		const hostService = store.add(new SourcesReviewHostService());
		let pathFilter: unknown = 'unset';
		hostService.registerReviewListHost(stubReviewListHost({
			setPathFilter: paths => { pathFilter = paths; },
		}));

		hostService.showForPaths([]);
		assert.strictEqual(pathFilter, undefined);
	});

	test('getSelectedEntry and markAllReviewed forward through the registered host', function () {
		const resource = toResource.call(this, '/project/a.ts');
		const entry = {
			resource,
			name: 'a.ts',
			description: 'Changes',
			groupId: 'workingTree',
		};
		let markedAll = false;
		let toggled = false;

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost(stubReviewListHost({
			getSelectedEntry: () => entry,
			toggleReviewedSelected: () => { toggled = true; },
			markAllReviewed: () => { markedAll = true; },
		}));

		assert.strictEqual(hostService.getReviewListHost()?.getSelectedEntry()?.resource.toString(), resource.toString());
		hostService.getReviewListHost()?.toggleReviewedSelected();
		hostService.getReviewListHost()?.markAllReviewed();
		assert.strictEqual(toggled, true);
		assert.strictEqual(markedAll, true);
	});

	test('review row commands are registered', () => {
		assert.ok(CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND));
		assert.ok(CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND));
		assert.ok(CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND));
	});

	test('toggle and markAll commands no-op without a host and forward when registered', async function () {
		const hostService = store.add(new SourcesReviewHostService());
		let toggled = 0;
		let markedAll = 0;
		const accessor = stubAccessor((id: unknown) => {
			if (id === ISourcesReviewHostService) {
				return hostService;
			}
			throw new Error(`unexpected service ${String(id)}`);
		});

		await CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND)?.handler?.(accessor);
		await CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND)?.handler?.(accessor);
		assert.strictEqual(toggled, 0);
		assert.strictEqual(markedAll, 0);

		hostService.registerReviewListHost(stubReviewListHost({
			toggleReviewedSelected: () => { toggled += 1; },
			markAllReviewed: () => { markedAll += 1; },
		}));

		await CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND)?.handler?.(accessor);
		await CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND)?.handler?.(accessor);
		assert.strictEqual(toggled, 1);
		assert.strictEqual(markedAll, 1);
	});

	test('openSelected surfaces open-diff failure on review status and does not mark reviewed', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const entry = {
			resource,
			name: 'a.ts',
			description: 'Changes',
			groupId: 'workingTree',
		};
		let status: string | undefined;
		let marked = 0;

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost(stubReviewListHost({
			getSelectedEntry: () => entry,
			setStatusMessage: message => { status = message; },
		}));

		const accessor = stubAccessor((id: unknown) => {
			if (id === ISourcesReviewHostService) {
				return hostService;
			}
			if (id === ISourcesReviewProgressService) {
				return {
					resolveKey: async () => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
					markReviewed: () => { marked += 1; },
				};
			}
			if (id === IEditorService) {
				return {};
			}
			if (id === IQuickDiffService) {
				return {
					getQuickDiffs: async () => { throw new Error('boom'); },
				};
			}
			if (id === IConfigurationService) {
				return { getValue: () => 'preview' };
			}
			if (id === IInstantiationService) {
				return {};
			}
			if (id === ISourcesDiffPanelService) {
				return {};
			}
			if (id === IModelService) {
				return {};
			}
			if (id === IUniverseAgentConnection) {
				return stubOpenSelectedConnection();
			}
			if (id === IConversationRosterService) {
				return stubOpenSelectedRoster();
			}
			throw new Error(`unexpected service ${String(id)}`);
		});

		await CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND)?.handler?.(accessor);

		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error('boom')));
		assert.ok(status?.includes('Unable to open diff'));
		assert.ok(status?.includes('boom'));
		assert.strictEqual(marked, 0);
	});

	test('openSelected leftover / pairing-hold skip does not fake preview or mark reviewed', async function () {
		const resource = toResource.call(this, '/project/leftover.ts');
		const entry = {
			resource,
			name: 'leftover.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/leftover.ts',
			indexState: 'WORKTREE',
		};
		let marked = 0;
		let diffCalls = 0;
		let openCalls = 0;

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost(stubReviewListHost({
			getSelectedEntry: () => entry,
			isSourcesGitFileDiffOpenSkipped: () => true,
			readGitFileDiff: async () => {
				diffCalls += 1;
				return {
					supported: true,
					reason: '',
					path: 'src/leftover.ts',
					unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n',
				};
			},
		}));

		const accessor = stubAccessor((id: unknown) => {
			if (id === ISourcesReviewHostService) {
				return hostService;
			}
			if (id === ISourcesReviewProgressService) {
				return {
					resolveKey: async () => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
					markReviewed: () => { marked += 1; },
				};
			}
			if (id === IEditorService) {
				return {
					openEditor: async () => {
						openCalls += 1;
						return undefined;
					},
				};
			}
			if (id === IQuickDiffService) {
				return { getQuickDiffs: async () => [] };
			}
			if (id === IConfigurationService) {
				return { getValue: () => 'preview' };
			}
			if (id === IInstantiationService) {
				return {};
			}
			if (id === ISourcesDiffPanelService) {
				return {};
			}
			if (id === IModelService) {
				return {};
			}
			throw new Error(`unexpected service ${String(id)}`);
		});

		await CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND)?.handler?.(accessor);

		assert.strictEqual(diffCalls, 0, 'leftover Open Selected must not readGitFileDiff');
		assert.strictEqual(openCalls, 0, 'leftover Open Selected must not fake preview');
		assert.strictEqual(marked, 0, 'leftover Open Selected must not mark reviewed');
	});

	test('openSelected live FileDiff uses connection readGitFileDiff', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const entry = {
			resource,
			name: 'a.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
		};
		let marked = 0;
		let diffCalls = 0;
		let openedDiff = false;
		const models = new Map<string, string>();

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost(stubReviewListHost({
			getSelectedEntry: () => entry,
		}));
		const connection = stubOpenSelectedConnection({
			readGitFileDiff: async () => {
				diffCalls += 1;
				return {
					supported: true,
					reason: '',
					path: 'src/a.ts',
					unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n',
				};
			},
		});

		const accessor = stubAccessor((id: unknown) => {
			if (id === ISourcesReviewHostService) {
				return hostService;
			}
			if (id === ISourcesReviewProgressService) {
				return {
					resolveKey: async () => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
					markReviewed: () => { marked += 1; },
				};
			}
			if (id === IEditorService) {
				return {
					openEditor: async (input: { original?: { resource?: unknown }; modified?: { resource?: unknown }; resource?: unknown }) => {
						openedDiff = !!(input.original && input.modified);
						return undefined;
					},
				};
			}
			if (id === IQuickDiffService) {
				return { getQuickDiffs: async () => [] };
			}
			if (id === IConfigurationService) {
				return { getValue: () => 'preview' };
			}
			if (id === IInstantiationService) {
				return {};
			}
			if (id === ISourcesDiffPanelService) {
				return {};
			}
			if (id === IModelService) {
				return {
					getModel: (uri: { toString(): string }) => models.has(uri.toString()) ? {} : undefined,
					updateModel: (model: { uri?: { toString(): string } }, value: string) => {
						if (model.uri) {
							models.set(model.uri.toString(), value);
						}
					},
					createModel: (_value: string, _language: unknown, uri: { toString(): string }) => {
						models.set(uri.toString(), _value);
						return { uri };
					},
				};
			}
			if (id === IUniverseAgentConnection) {
				return connection;
			}
			if (id === IConversationRosterService) {
				return stubOpenSelectedRoster();
			}
			throw new Error(`unexpected service ${String(id)}`);
		});

		await CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND)?.handler?.(accessor);

		assert.strictEqual(diffCalls, 1, 'live Open Selected must readGitFileDiff');
		assert.strictEqual(openedDiff, true, 'live Open Selected must open FileDiff sides, not a fake file preview');
		assert.strictEqual(marked, 1);
	});

	test('openSelected KEEP leftover write-closed still opens FileDiff and does not mark reviewed', async function () {
		const resource = toResource.call(this, '/project/leftover.ts');
		const entry = {
			resource,
			name: 'leftover.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/leftover.ts',
			indexState: 'WORKTREE',
		};
		let marked = 0;
		let diffCalls = 0;
		let openedDiff = false;
		const models = new Map<string, string>();

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost(stubReviewListHost({
			getSelectedEntry: () => entry,
			isSourcesGitFileDiffOpenSkipped: () => false,
			isSourcesGitWriteClosed: () => true,
		}));
		const connection = stubOpenSelectedConnection({
			readGitFileDiff: async () => {
				diffCalls += 1;
				return {
					supported: true,
					reason: '',
					path: 'src/leftover.ts',
					unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n',
				};
			},
		});

		const accessor = stubAccessor((id: unknown) => {
			if (id === ISourcesReviewHostService) {
				return hostService;
			}
			if (id === ISourcesReviewProgressService) {
				return {
					resolveKey: async () => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
					markReviewed: () => { marked += 1; },
				};
			}
			if (id === IEditorService) {
				return {
					openEditor: async (input: { original?: { resource?: unknown }; modified?: { resource?: unknown }; resource?: unknown }) => {
						openedDiff = !!(input.original && input.modified);
						return undefined;
					},
				};
			}
			if (id === IQuickDiffService) {
				return { getQuickDiffs: async () => [] };
			}
			if (id === IConfigurationService) {
				return { getValue: () => 'preview' };
			}
			if (id === IInstantiationService) {
				return {};
			}
			if (id === ISourcesDiffPanelService) {
				return {};
			}
			if (id === IModelService) {
				return {
					getModel: (uri: { toString(): string }) => models.has(uri.toString()) ? {} : undefined,
					updateModel: (model: { uri?: { toString(): string } }, value: string) => {
						if (model.uri) {
							models.set(model.uri.toString(), value);
						}
					},
					createModel: (_value: string, _language: unknown, uri: { toString(): string }) => {
						models.set(uri.toString(), _value);
						return { uri };
					},
				};
			}
			if (id === IUniverseAgentConnection) {
				return connection;
			}
			if (id === IConversationRosterService) {
				return stubOpenSelectedRoster();
			}
			throw new Error(`unexpected service ${String(id)}`);
		});

		await CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND)?.handler?.(accessor);

		assert.strictEqual(diffCalls, 1, 'KEEP leftover Open Selected must still readGitFileDiff');
		assert.strictEqual(openedDiff, true, 'KEEP leftover Open Selected must still open FileDiff');
		assert.strictEqual(marked, 0, 'KEEP leftover Open Selected must not markReviewed');
	});
});
