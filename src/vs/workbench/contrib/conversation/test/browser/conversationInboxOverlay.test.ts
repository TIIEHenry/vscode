/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { localize } from '../../../../../nls.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	ConversationInboxOverlay,
	conversationLensInboxOverlayClass,
} from '../../browser/conversationInboxOverlay.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import {
	conversationLensDockGoal,
	conversationLensDockNoGoal,
	conversationLensDockStop,
	conversationLensDockStopGenerating,
	conversationLensDockStopNotGenerating,
} from '../../browser/conversationLensDockStrings.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';

class GoalRoster extends ConversationStubService {
	readonly setGoalCalls: { sessionId: string; goal: string }[] = [];
	readonly cancelGoalCalls: string[] = [];
	private goal: string | undefined;

	override isEngineConnected(): boolean {
		return true;
	}

	override setSessionGoal(sessionId: string, goal: string): boolean {
		this.setGoalCalls.push({ sessionId, goal });
		this.goal = goal;
		return true;
	}

	override cancelSessionGoal(sessionId: string): boolean {
		this.cancelGoalCalls.push(sessionId);
		this.goal = undefined;
		return true;
	}

	override getSessionGoal(_sessionId: string): string | undefined {
		return this.goal;
	}
}

class GeneratingRoster extends ConversationStubService {
	readonly cancelCalls: { sessionId: string; agentId?: string }[] = [];

	override isEngineConnected(): boolean {
		return true;
	}

	override getTurns(): readonly ConversationStubTurn[] {
		return [{ id: 'a1', kind: 'assistant', text: 'live', streaming: true, agentId: 'sub:a' }];
	}

	override cancelGeneration(sessionId: string, agentId?: string): boolean {
		this.cancelCalls.push({ sessionId, agentId });
		return true;
	}
}

suite('ConversationInboxOverlay Stop', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createOverlay(roster: ConversationStubService): ConversationInboxOverlay {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		const parent = document.createElement('div');
		return store.add(instantiationService.createInstance(ConversationInboxOverlay, parent, {
			onQueueItemHold() { },
			onScrollToPendingConfirmation() { },
		}));
	}

	function getStopButton(overlay: ConversationInboxOverlay): HTMLElement {
		const button = overlay.element.querySelector('.conversation-lens-inbox-stop-button') as HTMLElement | null;
		assert.ok(button);
		return button;
	}

	test('stub Stop stays disabled and does not cancel', () => {
		const roster = store.add(new ConversationStubService());
		const overlay = createOverlay(roster);
		assert.ok(overlay.element.classList.contains(conversationLensInboxOverlayClass));
		const stop = getStopButton(overlay);
		assert.strictEqual(stop.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(stop.getAttribute('aria-label'), `${conversationLensDockStop}, ${conversationLensDockStopNotGenerating}`);
		stop.click();
		assert.strictEqual(roster.cancelGeneration(roster.getActiveSessionId()), false);
	});

	test('connected streaming Stop forwards cancelGeneration', () => {
		const roster = store.add(new GeneratingRoster());
		const overlay = createOverlay(roster);
		const stop = getStopButton(overlay);
		assert.strictEqual(stop.getAttribute('aria-disabled'), 'false');
		assert.strictEqual(stop.getAttribute('aria-label'), `${conversationLensDockStop}, ${conversationLensDockStopGenerating}`);
		stop.click();
		assert.deepStrictEqual(roster.cancelCalls, [{ sessionId: roster.getActiveSessionId(), agentId: undefined }]);
	});
});

suite('ConversationInboxOverlay Goal', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createOverlay(roster: ConversationStubService, inputResult?: string): ConversationInboxOverlay {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IQuickInputService, {
			input: async () => inputResult,
		} as IQuickInputService);
		const parent = document.createElement('div');
		return store.add(instantiationService.createInstance(ConversationInboxOverlay, parent, {
			onQueueItemHold() { },
			onScrollToPendingConfirmation() { },
		}));
	}

	function getGoalButton(overlay: ConversationInboxOverlay): HTMLElement {
		const button = overlay.element.querySelector('.conversation-lens-inbox-goal-button') as HTMLElement | null;
		assert.ok(button);
		return button;
	}

	test('stub Goal stays disabled and does not set', () => {
		const roster = store.add(new ConversationStubService());
		const overlay = createOverlay(roster, 'Should not apply');
		const goal = getGoalButton(overlay);
		assert.strictEqual(goal.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(goal.getAttribute('aria-label'), `${conversationLensDockGoal}, ${conversationLensDockNoGoal}`);
		goal.click();
		assert.strictEqual(roster.setSessionGoal(roster.getActiveSessionId(), 'Should not apply'), false);
		assert.strictEqual(roster.getSessionGoal(roster.getActiveSessionId()), undefined);
	});

	test('connected Goal forwards setSessionGoal', async () => {
		const roster = store.add(new GoalRoster());
		const overlay = createOverlay(roster, '  Ship the slice  ');
		const goal = getGoalButton(overlay);
		assert.strictEqual(goal.getAttribute('aria-disabled'), 'false');
		assert.strictEqual(goal.getAttribute('aria-label'), `${conversationLensDockGoal}, ${conversationLensDockNoGoal}`);
		goal.click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.setGoalCalls, [{ sessionId: roster.getActiveSessionId(), goal: 'Ship the slice' }]);
		assert.strictEqual(roster.getSessionGoal(roster.getActiveSessionId()), 'Ship the slice');
		assert.strictEqual(getGoalButton(overlay).getAttribute('aria-label'), `${conversationLensDockGoal}, Ship the slice`);
	});

	test('connected Goal prompt cancel does not set', async () => {
		const roster = store.add(new GoalRoster());
		const overlay = createOverlay(roster, undefined);
		getGoalButton(overlay).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.setGoalCalls, []);
		assert.deepStrictEqual(roster.cancelGoalCalls, []);
	});

	test('connected Goal empty confirm cancels an existing goal', async () => {
		const roster = store.add(new GoalRoster());
		roster.setSessionGoal(roster.getActiveSessionId(), 'Existing');
		const overlay = createOverlay(roster, '   ');
		getGoalButton(overlay).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.cancelGoalCalls, [roster.getActiveSessionId()]);
		assert.strictEqual(roster.getSessionGoal(roster.getActiveSessionId()), undefined);
	});
});

suite('ConversationInboxOverlay context ring', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createOverlay(roster: ConversationStubService): ConversationInboxOverlay {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		const parent = document.createElement('div');
		return store.add(instantiationService.createInstance(ConversationInboxOverlay, parent, {
			onQueueItemHold() { },
			onScrollToPendingConfirmation() { },
		}));
	}

	test('right cluster shows an honest empty context ring with no fake usage', () => {
		const overlay = createOverlay(store.add(new ConversationStubService()));
		const right = overlay.element.querySelector('.conversation-lens-inbox-right');
		assert.ok(right);
		assert.ok(right.querySelector('.conversation-lens-inbox-stop'));
		const ring = right.querySelector('.conversation-lens-inbox-context-ring') as HTMLElement | null;
		assert.ok(ring);
		const noContextUsage = localize('conversationLens.inboxNoContextUsage', "No context usage");
		assert.strictEqual(ring.getAttribute('aria-label'), noContextUsage);
		assert.strictEqual(ring.title, noContextUsage);
		assert.ok(!/\d/.test(ring.textContent ?? ''));
		assert.ok(!/%/.test(ring.textContent ?? ''));
		assert.ok(!/%/.test(ring.getAttribute('aria-label') ?? ''));
	});
});

suite('ConversationInboxOverlay list panel host', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createOverlay(roster: ConversationStubService): ConversationInboxOverlay {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		return store.add(instantiationService.createInstance(ConversationInboxOverlay, parent, {
			onQueueItemHold() { },
			onScrollToPendingConfirmation() { },
		}));
	}

	test('refreshing the open list ignores a decoy global panel', () => {
		const roster = store.add(new ConversationStubService());
		const sessionId = roster.getActiveSessionId();
		roster.setMessageQueueFixture(sessionId, {
			isPaused: false,
			isProcessing: false,
			items: [{
				id: 'q1',
				content: 'First queued',
				status: 'PENDING',
				hold: undefined,
				uploadProgress: undefined,
				retryCount: 0,
				lastError: undefined,
				locked: false,
				pinned: false,
			}],
		});
		const overlay = createOverlay(roster);
		const decoy = document.createElement('div');
		decoy.className = 'conversation-lens-inbox-list-panel';
		decoy.textContent = 'decoy';
		document.body.appendChild(decoy);
		store.add({ dispose: () => decoy.remove() });

		const queueChip = overlay.element.querySelector('.conversation-lens-inbox-queue') as HTMLButtonElement;
		queueChip.click();

		const ownPanel = [...document.querySelectorAll('.conversation-lens-inbox-list-panel')]
			.find(panel => panel !== decoy) as HTMLElement | undefined;
		assert.ok(ownPanel);
		assert.ok(ownPanel.querySelector('.queue-item[data-item-id="q1"]'));
		assert.strictEqual(decoy.textContent, 'decoy');

		roster.setMessageQueueFixture(sessionId, {
			isPaused: false,
			isProcessing: false,
			items: [{
				id: 'q2',
				content: 'Second queued',
				status: 'PENDING',
				hold: undefined,
				uploadProgress: undefined,
				retryCount: 0,
				lastError: undefined,
				locked: false,
				pinned: false,
			}],
		});
		overlay.render();

		assert.strictEqual(decoy.textContent, 'decoy');
		assert.strictEqual(ownPanel.querySelector('.queue-item[data-item-id="q1"]'), null);
		assert.ok(ownPanel.querySelector('.queue-item[data-item-id="q2"]'));
	});
});
