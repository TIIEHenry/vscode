/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentWriteGitApplyHunksRequest, UniverseAgentWriteGitStagePathsRequest, UniverseAgentWriteGitWriteResult } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IViewDescriptorService, IViewPaneContainer, ViewContainerLocation } from '../../../../common/views.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { workbenchInstantiationService, TestEditorGroupView } from '../../../../test/browser/workbenchTestServices.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { ISCMResource, ISCMService } from '../../../scm/common/scm.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { ConversationDiffReviewPane } from '../../browser/conversationDiffReviewPane.js';
import { SOURCES_DIFF_PANEL_CONTAINER_ID } from '../../browser/sourcesDiffPanelIds.js';
import { ISourcesChangesModel } from '../../common/sourcesChangesModel.js';
import { SourcesChangesModel } from '../../common/sourcesChangesReadModel.js';

suite('Conversation diff review pane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const acceptedWrite: UniverseAgentWriteGitWriteResult = {
		supported: true,
		reason: '',
		success: true,
		errorMessage: '',
		exitCode: 0,
		stdout: '',
	};

	const acceptCursorUnifiedDiff = [
		'diff --git a/src/a.ts b/src/a.ts',
		'--- a/src/a.ts',
		'+++ b/src/a.ts',
		'@@ -1,3 +1,4 @@',
		' line1',
		'-old',
		'+new',
		'+extra',
	].join('\n');

	function createLeftoverScmService(resource: URI, groupId = 'workingTree'): ISCMService {
		const group = {
			id: groupId,
			label: groupId === 'index' ? 'Staged Changes' : 'Changes',
			resources: [] as ISCMResource[],
		};
		const scmResource = {
			sourceUri: resource,
			resourceGroup: group,
			decorations: {},
			open: async () => { },
		} as unknown as ISCMResource;
		group.resources.push(scmResource);
		const repository = {
			provider: {
				groups: [group],
				rootUri: resource,
				onDidChangeResources: Event.None,
				onDidChangeResourceGroups: Event.None,
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

	function stubSessionAndChangesModel(
		instantiationService: ReturnType<typeof workbenchInstantiationService>,
		connection: IUniverseAgentConnection,
	): void {
		instantiationService.stub(IAgentSessionContext, {
			_serviceBrand: undefined,
			getActiveSessionId: () => 'session-1',
			isEngineSessionReady: () => true,
			isPairingHold: () => false,
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			acquireSessionView: () => { throw new Error('not used'); },
		} satisfies IAgentSessionContext);
		instantiationService.stub(ISourcesChangesModel, store.add(instantiationService.createInstance(SourcesChangesModel)));
		instantiationService.stub(IConversationRosterService, {
			getActiveSessionId: () => 'session-1',
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			isEngineSessionReady: () => true,
		} as unknown as IConversationRosterService);
		instantiationService.stub(IUniverseAgentConnection, connection);
	}

	function createInstantiationService(resource: URI, connection: IUniverseAgentConnection) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IViewDescriptorService, {
			getViewLocationById: () => ViewContainerLocation.Panel,
			onDidChangeLocation: Event.None,
			getViewDescriptorById: () => null,
			getViewContainerByViewId: () => ({
				id: SOURCES_DIFF_PANEL_CONTAINER_ID,
				title: { value: 'Diff', original: 'Diff' },
				ctorDescriptor: {} as SyncDescriptor<IViewPaneContainer>,
			}),
			getViewContainerModel: () => ({
				onDidChangeContainerInfo: Event.None,
			}),
			getDefaultContainerById: () => null,
		} as unknown as IViewDescriptorService);
		instantiationService.stub(ISCMService, createLeftoverScmService(resource));
		stubSessionAndChangesModel(instantiationService, connection);
		instantiationService.stub(ICommandService, {
			onWillExecuteCommand: Event.None,
			onDidExecuteCommand: Event.None,
			executeCommand: async () => undefined,
		} as unknown as ICommandService);
		instantiationService.stub(ITextModelService, {
			createModelReference: async () => {
				throw new Error('boom');
			},
		} as unknown as ITextModelService);
		return instantiationService;
	}

	function paintReviewWriteChrome(pane: ConversationDiffReviewPane): void {
		const host = pane as unknown as { comparisonLoadFailed: boolean; updateReviewActions: () => void };
		host.comparisonLoadFailed = false;
		host.updateReviewActions();
	}

	test('in-flight Accept does not ApplyHunks after clearInput bumps write generation', async function () {
		const resource = toResource.call(this, '/project/src/inflight-accept-clear.ts');
		const original = toResource.call(this, '/project/src/inflight-accept-clear.ts.git');
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		let releaseRead: (() => void) | undefined;
		const readGate = new Promise<void>(resolve => {
			releaseRead = resolve;
		});
		let readInFlight = false;
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitFileDiff: async () => {
				readInFlight = true;
				await readGate;
				return { supported: true, reason: '', path: 'src/a.ts', unifiedDiff: acceptCursorUnifiedDiff };
			},
			writeGitApplyHunks: async (request: UniverseAgentWriteGitApplyHunksRequest) => {
				applyCalls.push(request);
				return acceptedWrite;
			},
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				return acceptedWrite;
			},
		} as unknown as IUniverseAgentConnection;

		const instantiationService = createInstantiationService(resource, connection);
		const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		pane.create(parent);
		const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree', {
			origin: 'engine',
			sessionId: 'session-1',
			gitPath: 'src/a.ts',
			indexState: 'Unstaged',
			kind: 'Modified',
		}));
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		paintReviewWriteChrome(pane);
		(pane as unknown as { acceptCursor: { side: 'new'; line: number } }).acceptCursor = { side: 'new', line: 3 };

		const acceptPromise = (pane as unknown as { runAccept: () => Promise<void> }).runAccept();
		while (!readInFlight) {
			await Promise.resolve();
		}
		pane.clearInput();
		releaseRead!();
		await acceptPromise;

		assert.deepStrictEqual(applyCalls, []);
	});
});
