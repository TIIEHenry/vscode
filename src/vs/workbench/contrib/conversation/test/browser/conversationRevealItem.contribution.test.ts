/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import type { IConversationSessionViewLease } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import { emptySessionViewSnapshot, type SessionViewSnapshot, type TimelineItemSummary } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { CONVERSATION_REVEAL_ITEM_COMMAND_ID } from '../../browser/conversationRevealItem.contribution.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';

suite('ConversationRevealItemContribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const textSummary: TimelineItemSummary = { kind: 'text', title: 'You', preview: 'hello' };

	function makeSnapshot(timeline: SessionViewSnapshot['timeline']): SessionViewSnapshot {
		return {
			...emptySessionViewSnapshot('session-1' as SessionViewSnapshot['sessionId']),
			sync: { kind: 'live' },
			timeline,
		};
	}

	function runRevealCommand(options: {
		readonly args: { readonly toolCallId?: string; readonly itemId?: string };
		readonly lease: IConversationSessionViewLease;
	}): { readonly infos: string[]; readonly revealCalls: { readonly itemId: string; readonly sessionId: string }[] } {
		const infos: string[] = [];
		const revealCalls: { itemId: string; sessionId: string }[] = [];
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, {
			getActiveSessionId: () => 'session-1',
			acquireSessionView: () => options.lease,
		} as IConversationRosterService);
		instantiationService.stub(IConversationPartService, { focus: () => { } } as IConversationPartService);
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: (itemId: string, sessionId: string) => revealCalls.push({ itemId, sessionId }),
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => { },
		});
		instantiationService.stub(INotificationService, {
			info: (message: string) => infos.push(message),
		} as INotificationService);

		const command = CommandsRegistry.getCommand(CONVERSATION_REVEAL_ITEM_COMMAND_ID);
		assert.ok(command);
		void instantiationService.invokeFunction(accessor => command.handler(accessor, options.args));
		return { infos, revealCalls };
	}

	test('toolCallId does not resolve to a non-tool timeline item with the same id', () => {
		const lease: IConversationSessionViewLease = {
			sessionId: 'session-1',
			snapshot: makeSnapshot([
				{ id: 'tc-collide' as never, orderKey: '0000000000000001', summary: textSummary },
			]),
			attribution: new Map([['tc-collide', { role: 'user' }]]),
			details: new Map(),
			onDidApplyFrame: Event.None,
			post: async () => ({ accepted: false, reason: 'no_such_session' }),
			requestResync: () => undefined,
			dispose: () => undefined,
		};

		const { infos, revealCalls } = runRevealCommand({ args: { toolCallId: 'tc-collide' }, lease });
		assert.strictEqual(revealCalls.length, 0);
		assert.strictEqual(infos.length, 1);
		assert.ok(infos[0]?.includes('not found'));
	});

	test('toolCallId resolves via tool summary when timeline id differs', () => {
		const toolSummary: TimelineItemSummary = {
			kind: 'tool',
			title: 'read',
			toolName: 'read',
			status: 'completed',
			toolCallId: 'tc-read',
		};
		const lease: IConversationSessionViewLease = {
			sessionId: 'session-1',
			snapshot: makeSnapshot([
				{ id: 'item-read' as never, orderKey: '0000000000000001', summary: toolSummary },
			]),
			attribution: new Map(),
			details: new Map(),
			onDidApplyFrame: Event.None,
			post: async () => ({ accepted: false, reason: 'no_such_session' }),
			requestResync: () => undefined,
			dispose: () => undefined,
		};

		const { infos, revealCalls } = runRevealCommand({ args: { toolCallId: 'tc-read' }, lease });
		assert.deepStrictEqual(revealCalls, [{ itemId: 'item-read', sessionId: 'session-1' }]);
		assert.deepStrictEqual(infos, []);
	});
});
