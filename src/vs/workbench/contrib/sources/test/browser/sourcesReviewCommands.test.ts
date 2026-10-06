/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService, ServiceIdentifier, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { ISourcesChangesModel } from '../../common/sourcesChangesModel.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { ISourcesReviewHostService, ISourcesReviewListHost } from '../../common/sourcesReviewHostService.js';
import { ISourcesReviewProgressService } from '../../common/sourcesReviewProgress.js';
import { SourcesReviewHostService } from '../../browser/sourcesReviewHostService.js';
import { SOURCES_REVIEW_OPEN_SELECTED_COMMAND } from '../../browser/sourcesReviewCommands.contribution.js';
import '../../browser/sourcesReviewCommands.contribution.js';

suite('Sources - review commands', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function stubAccessor(get: (id: unknown) => unknown): ServicesAccessor {
		return {
			get: <T,>(id: ServiceIdentifier<T>) => get(id) as T,
		};
	}

	function stubReviewListHost(overrides: Partial<ISourcesReviewListHost> = {}): ISourcesReviewListHost {
		return {
			selectReviewTab: () => { },
			setPathFilter: () => { },
			getSelectedEntry: () => undefined,
			toggleReviewedSelected: () => { },
			markAllReviewed: () => { },
			setStatusMessage: () => { },
			...overrides,
		};
	}

	test('openSelected does not mark reviewed during pairing-hold when write door is still open', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const entry = {
			resource,
			name: 'a.ts',
			description: 'Changes',
			groupId: 'workingTree',
		};
		let marked = 0;

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost(stubReviewListHost({
			getSelectedEntry: () => entry,
		}));

		const accessor = stubAccessor((id: unknown) => {
			if (id === ISourcesReviewHostService) {
				return hostService;
			}
			if (id === ISourcesReviewProgressService) {
				return {
					resolveKey: async () => ({ origin: 'scm' as const, sessionId: '', scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
					markReviewed: () => { marked += 1; },
				};
			}
			if (id === IEditorService) {
				return {
					openEditor: async () => ({}),
					activeEditorPane: undefined,
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
			if (id === IUniverseAgentConnection) {
				return {
					isEngineConnected: () => false,
					getConnectionPhase: () => ({ kind: 'connecting' as const, reason: 'initial' }),
					getConnectionSnapshot: () => ({ pairingPending: true }),
					onDidChangeConnection: Event.None,
				} as unknown as IUniverseAgentConnection;
			}
			if (id === ISourcesChangesModel) {
				return {
					isFileDiffOpenSkipped: () => false,
					isWriteClosed: () => false,
					getSnapshot: () => ({
						generation: 1,
						settled: true,
						state: { kind: 'scm' },
						entries: [],
					}),
				} as unknown as ISourcesChangesModel;
			}
			if (id === IAgentSessionContext) {
				return {
					getActiveSessionId: () => 'session-1',
					isEngineSessionReady: () => false,
					isPairingHold: () => true,
					onDidChangeActiveSession: Event.None,
					onDidChangeSession: Event.None,
				} as unknown as IAgentSessionContext;
			}
			if (id === IEditorGroupsService) {
				return { conversationParts: [] };
			}
			throw new Error(`unexpected service ${String(id)}`);
		});

		await CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND)?.handler?.(accessor);

		assert.strictEqual(marked, 0);
	});
});
