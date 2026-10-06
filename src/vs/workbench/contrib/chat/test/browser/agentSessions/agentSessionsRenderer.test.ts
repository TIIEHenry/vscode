/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { FuzzyScore } from '../../../../../../base/common/filters.js';
import { ITreeNode } from '../../../../../../base/browser/ui/tree/tree.js';
import { observableValue } from '../../../../../../base/common/observable.js';
import { URI } from '../../../../../../base/common/uri.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { HoverPosition } from '../../../../../../base/browser/ui/hover/hoverWidget.js';
import { AgentSessionApprovalKind, AgentSessionApprovalModel, IAgentSessionApprovalInfo } from '../../../browser/agentSessions/agentSessionApprovalModel.js';
import { IAgentSession } from '../../../browser/agentSessions/agentSessionsModel.js';
import { ChatSessionStatus, IChatSessionsService } from '../../../common/chatSessionsService.js';
import { IVoicePlaybackService } from '../../../common/voicePlaybackService.js';
import { AgentSessionRenderer, AgentSessionSectionRenderer } from '../../../browser/agentSessions/agentSessionsViewer.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';

suite('AgentSessionsRenderer', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('adds item classes to a normal tree row', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IChatSessionsService, new class extends mock<IChatSessionsService>() { });
		instantiationService.stub(IVoicePlaybackService, new class extends mock<IVoicePlaybackService>() {
			override readonly pendingResponseVersion = observableValue('pendingResponseVersion', 0);
			override hasPendingResponse() { return false; }
		});
		const renderer = store.add(instantiationService.createInstance(
			AgentSessionRenderer,
			{ disableHover: true, getHoverPosition: () => HoverPosition.BELOW },
			undefined,
			observableValue<URI | undefined>('activeSessionResource', undefined),
		));
		const row = document.createElement('div');
		row.classList.add('monaco-list-row');
		const treeRow = document.createElement('div');
		const contents = document.createElement('div');
		row.appendChild(treeRow).appendChild(contents);

		const template = renderer.renderTemplate(contents);
		store.add({ dispose: () => renderer.disposeTemplate(template) });

		assert.deepStrictEqual([...row.classList], [
			'monaco-list-row',
			'agent-session-list-row',
			'agent-session-item-row',
		]);
	});

	test('adds section classes when the container is a sticky row', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const renderer = instantiationService.createInstance(AgentSessionSectionRenderer, {});
		const stickyRow = document.createElement('div');
		stickyRow.classList.add('monaco-list-row');

		const template = renderer.renderTemplate(stickyRow);
		store.add({ dispose: () => renderer.disposeTemplate(template) });

		assert.deepStrictEqual([...stickyRow.classList], [
			'monaco-list-row',
			'agent-session-list-row',
			'agent-session-section-row',
		]);
	});
	test('fires onDidChangeItemHeight when approval row height changes', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IChatSessionsService, new class extends mock<IChatSessionsService>() {
			override resolveChatSessionItem() { return Promise.resolve(undefined); }
		});
		instantiationService.stub(IVoicePlaybackService, new class extends mock<IVoicePlaybackService>() {
			override readonly pendingResponseVersion = observableValue('pendingResponseVersion', 0);
			override hasPendingResponse() { return false; }
		});

		const sessionResource = URI.parse('test://session/approval');
		const session: IAgentSession = {
			providerType: 'test',
			providerLabel: 'Test',
			resource: sessionResource,
			status: ChatSessionStatus.Completed,
			label: 'Session',
			icon: Codicon.terminal,
			timing: {
				created: Date.now(),
				lastRequestStarted: undefined,
				lastRequestEnded: undefined,
			},
			isArchived: () => false,
			setArchived: () => { },
			isPinned: () => false,
			setPinned: () => { },
			isRead: () => true,
			isMarkedUnread: () => false,
			setRead: () => { },
		};
		const sessionNode: ITreeNode<IAgentSession, FuzzyScore> = {
			element: session,
			children: [],
			depth: 0,
			visible: true,
			collapsed: false,
			collapsible: false,
			filterData: undefined,
			visibleChildrenCount: 0,
			visibleChildIndex: 0,
		};

		const approvalObservable = observableValue<IAgentSessionApprovalInfo | undefined>('approval', {
			approvalId: 'app-1',
			kind: AgentSessionApprovalKind.Terminal,
			label: 'single line command',
			languageId: 'sh',
			since: new Date(),
			confirm: () => { },
		});
		const approvalModel = {
			getApproval: (_resource: URI) => approvalObservable,
		} as unknown as AgentSessionApprovalModel;

		const activeSessionResource = observableValue<URI | undefined>('activeSessionResource', undefined);

		const renderer = store.add(instantiationService.createInstance(
			AgentSessionRenderer,
			{ disableHover: true, getHoverPosition: () => HoverPosition.BELOW },
			approvalModel,
			activeSessionResource,
		));

		const firedSessions: IAgentSession[] = [];
		store.add(renderer.onDidChangeItemHeight(s => firedSessions.push(s)));

		const row = document.createElement('div');
		row.classList.add('monaco-list-row');
		const treeRow = document.createElement('div');
		const contents = document.createElement('div');
		row.appendChild(treeRow).appendChild(contents);

		const template = renderer.renderTemplate(contents);
		store.add({ dispose: () => renderer.disposeTemplate(template) });

		renderer.renderElement(sessionNode, 0, template);

		// Initial render from current model state should not fire
		assert.strictEqual(firedSessions.length, 0);

		// Changing to another single-line label should not change height, so no fire
		approvalObservable.set({
			approvalId: 'app-2',
			kind: AgentSessionApprovalKind.Terminal,
			label: 'another single line',
			languageId: 'sh',
			since: new Date(),
			confirm: () => { },
		}, undefined);
		assert.strictEqual(firedSessions.length, 0);

		// Changing active session should not change height, so no fire
		activeSessionResource.set(sessionResource, undefined);
		assert.strictEqual(firedSessions.length, 0);

		// Changing to 3 lines should change height, fires for this session
		approvalObservable.set({
			approvalId: 'app-3',
			kind: AgentSessionApprovalKind.Terminal,
			label: 'line 1\nline 2\nline 3',
			languageId: 'sh',
			since: new Date(),
			confirm: () => { },
		}, undefined);
		assert.strictEqual(firedSessions.length, 1);
		assert.strictEqual(firedSessions[0], session);

		// Changing from approval to no approval should fire
		approvalObservable.set(undefined, undefined);
		assert.strictEqual(firedSessions.length, 2);
		assert.strictEqual(firedSessions[1], session);
	});
});
