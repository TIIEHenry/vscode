/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationError } from '../../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	ConversationInboxOverlay,
	conversationLensInboxOverlayClass,
} from '../../browser/conversationInboxOverlay.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import {
	conversationLensDockGoal,
	conversationLensDockGoalUnavailable,
	conversationLensDockInboxNoQueue,
	conversationLensDockInboxQueueNotListed,
	conversationLensDockNoGoal,
	conversationLensDockStop,
	conversationLensDockStopGenerating,
	conversationLensDockStopNotGenerating,
	conversationLensInboxQueueEnqueue,
	conversationLensInboxQueueEnqueueUnavailable,
	conversationLensInboxQueueRetry,
	conversationLensInboxQueueRetryUnavailable,
	type ConversationComposerPostFailureReason,
} from '../../browser/conversationLensDockStrings.js';
import { ConversationMessageQueueItem } from '../../browser/conversationMessageQueueModel.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';

function stubInboxServices(
	instantiationService: ReturnType<typeof workbenchInstantiationService>,
	roster: ConversationStubService,
	connection: IUniverseAgentConnection = createConversationConnectionTestStub(),
): void {
	instantiationService.stub(IConversationRosterService, roster);
	instantiationService.stub(IUniverseAgentConnection, connection);
}

function connectionWithSetSessionGoal(): IUniverseAgentConnection {
	return createConversationConnectionTestStub({
		setSessionGoal: async () => ({ ok: true }),
	});
}

class GoalRoster extends ConversationStubService {
	readonly setGoalCalls: { sessionId: string; goal: string }[] = [];
	readonly cancelGoalCalls: string[] = [];
	private goal: string | undefined;
	setGoalResult = true;
	cancelGoalResult = true;
	connected = true;
	history = false;

	override isEngineConnected(): boolean {
		return this.connected;
	}

	override hasEngineConnectionHistory(): boolean {
		return this.history;
	}

	override setSessionGoal(sessionId: string, goal: string): boolean {
		this.setGoalCalls.push({ sessionId, goal });
		if (!this.setGoalResult) {
			return false;
		}
		this.goal = goal;
		return true;
	}

	override cancelSessionGoal(sessionId: string): boolean {
		this.cancelGoalCalls.push(sessionId);
		if (!this.cancelGoalResult) {
			return false;
		}
		this.goal = undefined;
		return true;
	}

	override getSessionGoal(_sessionId: string): string | undefined {
		return this.goal;
	}
}

class EnqueueRoster extends ConversationStubService {
	readonly enqueueCalls: { sessionId: string; text: string }[] = [];
	enqueueResult = true;
	connected = true;
	history = false;

	override isEngineConnected(): boolean {
		return this.connected;
	}

	override hasEngineConnectionHistory(): boolean {
		return this.history;
	}

	override enqueueMessageQueueItem(sessionId: string, text: string, _options?: { priority?: 'NORMAL' | 'HIGH' | 'LOW'; opId?: string }): boolean {
		this.enqueueCalls.push({ sessionId, text });
		return this.enqueueResult;
	}
}

class RetryRoster extends ConversationStubService {
	readonly retryCalls: { sessionId: string; itemId: string; upload?: boolean }[] = [];
	readonly holdCalls: { sessionId: string; itemId: string }[] = [];
	retryResult = true;

	override isEngineConnected(): boolean {
		return true;
	}

	override retryMessageQueueItem(sessionId: string, itemId: string, options?: { upload?: boolean }): boolean {
		this.retryCalls.push({ sessionId, itemId, upload: options?.upload });
		return this.retryResult;
	}

	override holdMessageQueueItem(sessionId: string, itemId: string, hold: 'EDITING'): void {
		this.holdCalls.push({ sessionId, itemId });
		super.holdMessageQueueItem(sessionId, itemId, hold);
	}
}

class RecordingStubRoster extends ConversationStubService {
	readonly enqueueCalls: { sessionId: string; text: string }[] = [];
	readonly retryCalls: { sessionId: string; itemId: string; upload?: boolean }[] = [];

	override enqueueMessageQueueItem(sessionId: string, text: string, options?: { priority?: 'NORMAL' | 'HIGH' | 'LOW'; opId?: string }): boolean {
		this.enqueueCalls.push({ sessionId, text });
		return super.enqueueMessageQueueItem(sessionId, text, options);
	}

	override retryMessageQueueItem(sessionId: string, itemId: string, options?: { upload?: boolean }): boolean {
		this.retryCalls.push({ sessionId, itemId, upload: options?.upload });
		return super.retryMessageQueueItem(sessionId, itemId, options);
	}
}

class GeneratingRoster extends ConversationStubService {
	readonly cancelCalls: { sessionId: string; agentId?: string }[] = [];
	cancelResult = true;
	connected = true;
	history = false;

	override isEngineConnected(): boolean {
		return this.connected;
	}

	override hasEngineConnectionHistory(): boolean {
		return this.history;
	}

	override getTurns(): readonly ConversationStubTurn[] {
		return [{ id: 'a1', kind: 'assistant', text: 'live', streaming: true, agentId: 'sub:a' }];
	}

	override cancelGeneration(sessionId: string, agentId?: string): boolean {
		this.cancelCalls.push({ sessionId, agentId });
		return this.cancelResult;
	}
}

suite('ConversationInboxOverlay Stop', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createOverlay(roster: ConversationStubService, failures: ConversationComposerPostFailureReason[] = []): ConversationInboxOverlay {
		const instantiationService = workbenchInstantiationService(undefined, store);
		stubInboxServices(instantiationService, roster);
		const parent = document.createElement('div');
		return store.add(instantiationService.createInstance(ConversationInboxOverlay, parent, {
			onQueueItemHold() { },
			onScrollToPendingConfirmation() { },
			showPostFailure(reason) { failures.push(reason); },
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
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new GeneratingRoster());
		const overlay = createOverlay(roster, failures);
		const stop = getStopButton(overlay);
		assert.strictEqual(stop.getAttribute('aria-disabled'), 'false');
		assert.strictEqual(stop.getAttribute('aria-label'), `${conversationLensDockStop}, ${conversationLensDockStopGenerating}`);
		stop.click();
		assert.deepStrictEqual(roster.cancelCalls, [{ sessionId: roster.getActiveSessionId(), agentId: undefined }]);
		assert.deepStrictEqual(failures, []);
	});

	test('Stop cancelGeneration false with history shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new GeneratingRoster());
		roster.cancelResult = false;
		roster.history = true;
		const overlay = createOverlay(roster, failures);
		roster.connected = false;
		getStopButton(overlay).click();
		assert.deepStrictEqual(roster.cancelCalls, [{ sessionId: roster.getActiveSessionId(), agentId: undefined }]);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('Stop cancelGeneration false without history shows failed', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new GeneratingRoster());
		roster.cancelResult = false;
		const overlay = createOverlay(roster, failures);
		getStopButton(overlay).click();
		assert.deepStrictEqual(roster.cancelCalls, [{ sessionId: roster.getActiveSessionId(), agentId: undefined }]);
		assert.deepStrictEqual(failures, ['failed']);
	});
});

suite('ConversationInboxOverlay Goal', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createOverlay(
		roster: ConversationStubService,
		inputResult?: string,
		failures: ConversationComposerPostFailureReason[] = [],
		beforeResolve?: () => void,
		inputError?: unknown,
		connection: IUniverseAgentConnection = createConversationConnectionTestStub(),
	): ConversationInboxOverlay {
		const instantiationService = workbenchInstantiationService(undefined, store);
		stubInboxServices(instantiationService, roster, connection);
		instantiationService.stub(IQuickInputService, {
			input: async () => {
				beforeResolve?.();
				if (inputError !== undefined) {
					throw inputError;
				}
				return inputResult;
			},
		} as IQuickInputService);
		const parent = document.createElement('div');
		return store.add(instantiationService.createInstance(ConversationInboxOverlay, parent, {
			onQueueItemHold() { },
			onScrollToPendingConfirmation() { },
			showPostFailure(reason) { failures.push(reason); },
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
		assert.strictEqual(goal.getAttribute('aria-label'), `${conversationLensDockGoal} — ${conversationLensDockGoalUnavailable}`);
		goal.click();
		assert.strictEqual(roster.setSessionGoal(roster.getActiveSessionId(), 'Should not apply'), false);
		assert.strictEqual(roster.getSessionGoal(roster.getActiveSessionId()), undefined);
	});

	test('connected Goal without setSessionGoal stays disabled', () => {
		const roster = store.add(new GoalRoster());
		const overlay = createOverlay(roster, 'Should not apply');
		const goal = getGoalButton(overlay);
		assert.strictEqual(goal.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(goal.getAttribute('aria-label'), `${conversationLensDockGoal} — ${conversationLensDockGoalUnavailable}`);
		goal.click();
		assert.deepStrictEqual(roster.setGoalCalls, []);
	});

	test('connected Goal forwards setSessionGoal', async () => {
		const roster = store.add(new GoalRoster());
		const overlay = createOverlay(roster, '  Ship the slice  ', [], undefined, undefined, connectionWithSetSessionGoal());
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
		const overlay = createOverlay(roster, undefined, [], undefined, undefined, connectionWithSetSessionGoal());
		getGoalButton(overlay).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.setGoalCalls, []);
		assert.deepStrictEqual(roster.cancelGoalCalls, []);
	});

	test('connected Goal empty confirm cancels an existing goal', async () => {
		const roster = store.add(new GoalRoster());
		roster.setSessionGoal(roster.getActiveSessionId(), 'Existing');
		const overlay = createOverlay(roster, '   ', [], undefined, undefined, connectionWithSetSessionGoal());
		getGoalButton(overlay).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.cancelGoalCalls, [roster.getActiveSessionId()]);
		assert.strictEqual(roster.getSessionGoal(roster.getActiveSessionId()), undefined);
	});

	test('connected Goal setSessionGoal false shows failed and does not change goal', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new GoalRoster());
		roster.setGoalResult = false;
		const overlay = createOverlay(roster, 'Ship the slice', failures, undefined, undefined, connectionWithSetSessionGoal());
		getGoalButton(overlay).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.setGoalCalls, [{ sessionId: roster.getActiveSessionId(), goal: 'Ship the slice' }]);
		assert.strictEqual(roster.getSessionGoal(roster.getActiveSessionId()), undefined);
		assert.strictEqual(getGoalButton(overlay).getAttribute('aria-label'), `${conversationLensDockGoal}, ${conversationLensDockNoGoal}`);
		assert.deepStrictEqual(failures, ['failed']);
	});

	test('connected Goal cancelSessionGoal false shows failed and keeps existing goal', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new GoalRoster());
		roster.setSessionGoal(roster.getActiveSessionId(), 'Existing');
		roster.cancelGoalResult = false;
		const overlay = createOverlay(roster, '   ', failures, undefined, undefined, connectionWithSetSessionGoal());
		getGoalButton(overlay).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.cancelGoalCalls, [roster.getActiveSessionId()]);
		assert.strictEqual(roster.getSessionGoal(roster.getActiveSessionId()), 'Existing');
		assert.strictEqual(getGoalButton(overlay).getAttribute('aria-label'), `${conversationLensDockGoal}, Existing`);
		assert.deepStrictEqual(failures, ['failed']);
	});

	test('Goal setSessionGoal false after disconnect during prompt shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new GoalRoster());
		roster.setGoalResult = false;
		const overlay = createOverlay(roster, 'Ship the slice', failures, () => {
			roster.connected = false;
			roster.history = true;
		}, undefined, connectionWithSetSessionGoal());
		assert.strictEqual(getGoalButton(overlay).getAttribute('aria-disabled'), 'false');
		getGoalButton(overlay).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.setGoalCalls, [{ sessionId: roster.getActiveSessionId(), goal: 'Ship the slice' }]);
		assert.strictEqual(roster.getSessionGoal(roster.getActiveSessionId()), undefined);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('disconnected Goal stays disabled without setSessionGoal', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new GoalRoster());
		roster.connected = false;
		roster.history = true;
		const overlay = createOverlay(roster, 'Should not apply', failures, undefined, undefined, connectionWithSetSessionGoal());
		const goal = getGoalButton(overlay);
		assert.strictEqual(goal.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(goal.getAttribute('aria-label'), `${conversationLensDockGoal} — ${conversationLensDockGoalUnavailable}`);
		goal.click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(failures, []);
		assert.deepStrictEqual(roster.setGoalCalls, []);
		assert.deepStrictEqual(roster.cancelGoalCalls, []);
		assert.strictEqual(roster.getSessionGoal(roster.getActiveSessionId()), undefined);
	});

	test('connected Goal input reject does not leak unhandled rejection or show notice', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new GoalRoster());
		const overlay = createOverlay(roster, undefined, failures, undefined, new CancellationError(), connectionWithSetSessionGoal());
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			getGoalButton(overlay).click();
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			assert.deepStrictEqual(unhandledRejections, []);
			assert.deepStrictEqual(roster.setGoalCalls, []);
			assert.deepStrictEqual(roster.cancelGoalCalls, []);
			assert.deepStrictEqual(failures, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});

suite('ConversationInboxOverlay context ring', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createOverlay(roster: ConversationStubService): ConversationInboxOverlay {
		const instantiationService = workbenchInstantiationService(undefined, store);
		stubInboxServices(instantiationService, roster);
		const parent = document.createElement('div');
		return store.add(instantiationService.createInstance(ConversationInboxOverlay, parent, {
			onQueueItemHold() { },
			onScrollToPendingConfirmation() { },
			showPostFailure() { },
		}));
	}

	test('right cluster has Stop and no fake context-usage ring', () => {
		const overlay = createOverlay(store.add(new ConversationStubService()));
		const right = overlay.element.querySelector('.conversation-lens-inbox-right');
		assert.ok(right);
		assert.ok(right.querySelector('.conversation-lens-inbox-stop'));
		assert.strictEqual(right.querySelector('.conversation-lens-inbox-context-ring'), null);
	});
});

suite('ConversationInboxOverlay list panel host', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createOverlay(roster: ConversationStubService): ConversationInboxOverlay {
		const instantiationService = workbenchInstantiationService(undefined, store);
		stubInboxServices(instantiationService, roster);
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		return store.add(instantiationService.createInstance(ConversationInboxOverlay, parent, {
			onQueueItemHold() { },
			onScrollToPendingConfirmation() { },
			showPostFailure() { },
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

suite('ConversationInboxOverlay Enqueue', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createOverlay(
		roster: ConversationStubService,
		inputResult?: string,
		failures: ConversationComposerPostFailureReason[] = [],
		beforeResolve?: () => void,
		inputError?: unknown,
		connection?: IUniverseAgentConnection,
	): ConversationInboxOverlay {
		const instantiationService = workbenchInstantiationService(undefined, store);
		stubInboxServices(instantiationService, roster, connection);
		instantiationService.stub(IQuickInputService, {
			input: async () => {
				beforeResolve?.();
				if (inputError !== undefined) {
					throw inputError;
				}
				return inputResult;
			},
		} as IQuickInputService);
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		return store.add(instantiationService.createInstance(ConversationInboxOverlay, parent, {
			onQueueItemHold() { },
			onScrollToPendingConfirmation() { },
			showPostFailure(reason) { failures.push(reason); },
		}));
	}

	function openQueuePanel(overlay: ConversationInboxOverlay): HTMLElement {
		const queueChip = overlay.element.querySelector('.conversation-lens-inbox-queue') as HTMLButtonElement;
		queueChip.click();
		const panels = [...document.querySelectorAll('.conversation-lens-inbox-list-panel')]
			.filter(host => host.querySelector('.conversation-lens-message-queue-list'));
		const panel = panels.at(-1) as HTMLElement | undefined;
		assert.ok(panel);
		return panel;
	}

	function getEnqueueButton(panel: HTMLElement): HTMLButtonElement {
		const button = panel.querySelector('.conversation-lens-inbox-queue-enqueue') as HTMLButtonElement | null;
		assert.ok(button);
		return button;
	}

	test('PRD-015 验收 5: 无 Task 芯片，空队列诚实空且有 Enqueue 入口', () => {
		const overlay = createOverlay(store.add(new ConversationStubService()));
		const left = overlay.element.querySelector('.conversation-lens-inbox-left')!;
		assert.strictEqual(left.querySelector('.conversation-lens-inbox-task'), null);
		assert.ok(left.querySelector('.conversation-lens-inbox-queue'));

		const panel = openQueuePanel(overlay);
		assert.ok(panel.querySelector('.conversation-lens-inbox-list-empty')?.textContent?.includes(conversationLensDockInboxNoQueue));
		assert.ok(getEnqueueButton(panel));
		assert.strictEqual(panel.querySelector('.queue-item'), null);
	});

	test('stub Enqueue stays disabled and does not call enqueue', () => {
		const roster = store.add(new RecordingStubRoster());
		const overlay = createOverlay(roster, 'Should not enqueue');
		const button = getEnqueueButton(openQueuePanel(overlay));
		assert.strictEqual(button.disabled, true);
		assert.strictEqual(button.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(button.title, conversationLensInboxQueueEnqueueUnavailable);
		button.click();
		assert.deepStrictEqual(roster.enqueueCalls, []);
		assert.deepStrictEqual(roster.getMessageQueueState(roster.getActiveSessionId()).items, []);
		assert.strictEqual(roster.enqueueMessageQueueItem(roster.getActiveSessionId(), 'Should not enqueue'), false);
	});

	test('connected Enqueue forwards enqueueMessageQueueItem', async () => {
		const roster = store.add(new EnqueueRoster());
		const overlay = createOverlay(roster, '  later  ');
		const button = getEnqueueButton(openQueuePanel(overlay));
		assert.strictEqual(button.disabled, false);
		assert.strictEqual(button.getAttribute('aria-disabled'), 'false');
		assert.strictEqual(button.textContent, conversationLensInboxQueueEnqueue);
		button.click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.enqueueCalls, [{ sessionId: roster.getActiveSessionId(), text: 'later' }]);
	});

	test('connected Enqueue prompt cancel does not enqueue', async () => {
		const roster = store.add(new EnqueueRoster());
		getEnqueueButton(openQueuePanel(createOverlay(roster, undefined))).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.enqueueCalls, []);
	});

	test('connected Enqueue empty confirm fails honestly and does not add a fake item', async () => {
		const roster = store.add(new EnqueueRoster());
		roster.enqueueResult = false;
		getEnqueueButton(openQueuePanel(createOverlay(roster, '   '))).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.enqueueCalls, [{ sessionId: roster.getActiveSessionId(), text: '' }]);
		assert.deepStrictEqual(roster.getMessageQueueState(roster.getActiveSessionId()).items, []);
	});

	test('connected Enqueue false does not pretend the item landed in the list', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new EnqueueRoster());
		roster.enqueueResult = false;
		const overlay = createOverlay(roster, 'Nope', failures);
		const panel = openQueuePanel(overlay);
		getEnqueueButton(panel).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.enqueueCalls, [{ sessionId: roster.getActiveSessionId(), text: 'Nope' }]);
		assert.deepStrictEqual(roster.getMessageQueueState(roster.getActiveSessionId()).items, []);
		assert.ok(panel.querySelector('.conversation-lens-inbox-list-empty')?.textContent?.includes(conversationLensDockInboxQueueNotListed));
		assert.ok(!panel.querySelector('.conversation-lens-inbox-list-empty')?.textContent?.includes(conversationLensDockInboxNoQueue));
		assert.deepStrictEqual(failures, ['failed']);
	});

	test('Enqueue false after disconnect during prompt shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new EnqueueRoster());
		roster.enqueueResult = false;
		const overlay = createOverlay(roster, 'Nope', failures, () => {
			roster.connected = false;
			roster.history = true;
		});
		const panel = openQueuePanel(overlay);
		getEnqueueButton(panel).click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(roster.enqueueCalls, [{ sessionId: roster.getActiveSessionId(), text: 'Nope' }]);
		assert.deepStrictEqual(roster.getMessageQueueState(roster.getActiveSessionId()).items, []);
		assert.ok(panel.querySelector('.conversation-lens-inbox-list-empty')?.textContent?.includes(conversationLensDockInboxQueueNotListed));
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('live Enqueue disables when pairingPending', () => {
		const roster = store.add(new EnqueueRoster());
		let pairingPending = false;
		const base = createConversationConnectionTestStub();
		const connection = createConversationConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				...base.getConnectionSnapshot(),
				pairingPending,
			}),
		});
		const overlay = createOverlay(roster, undefined, [], undefined, undefined, connection);
		const panel = openQueuePanel(overlay);
		assert.strictEqual(getEnqueueButton(panel).disabled, false);
		assert.strictEqual(getEnqueueButton(panel).getAttribute('aria-disabled'), 'false');

		pairingPending = true;
		roster.connected = false;
		roster.history = true;
		overlay.render();
		assert.strictEqual(getEnqueueButton(panel).disabled, true);
		assert.strictEqual(getEnqueueButton(panel).getAttribute('aria-disabled'), 'true');
		assert.strictEqual(getEnqueueButton(panel).title, conversationLensInboxQueueEnqueueUnavailable);
		getEnqueueButton(panel).click();
		assert.deepStrictEqual(roster.enqueueCalls, []);
	});

	test('disconnected Enqueue with history is enabled and shows engine_disconnected without enqueue', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new EnqueueRoster());
		roster.connected = false;
		roster.history = true;
		const overlay = createOverlay(roster, 'Should not enqueue', failures);
		const button = getEnqueueButton(openQueuePanel(overlay));
		assert.strictEqual(button.disabled, false);
		assert.strictEqual(button.getAttribute('aria-disabled'), 'false');
		button.click();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.deepStrictEqual(roster.enqueueCalls, []);
	});

	test('connected Enqueue input reject does not leak unhandled rejection or show notice', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new EnqueueRoster());
		const overlay = createOverlay(roster, undefined, failures, undefined, new CancellationError());
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			getEnqueueButton(openQueuePanel(overlay)).click();
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			assert.deepStrictEqual(unhandledRejections, []);
			assert.deepStrictEqual(roster.enqueueCalls, []);
			assert.deepStrictEqual(failures, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('connected Inbox does not pose fixture as the engine queue', () => {
		const roster = store.add(new EnqueueRoster());
		const sessionId = roster.getActiveSessionId();
		roster.setMessageQueueFixture(sessionId, {
			isPaused: false,
			isProcessing: false,
			items: [{
				id: 'q-fail',
				content: 'fixture failed',
				status: 'FAILED',
				hold: undefined,
				uploadProgress: undefined,
				retryCount: 1,
				lastError: 'send rejected',
				locked: false,
				pinned: false,
			}],
		});
		const overlay = createOverlay(roster);
		const chip = overlay.element.querySelector('.conversation-lens-inbox-queue') as HTMLButtonElement;
		assert.ok(chip.textContent?.includes(conversationLensDockInboxQueueNotListed));
		assert.ok(!chip.textContent?.includes(conversationLensDockInboxNoQueue));
		assert.ok(!chip.textContent?.includes('queued'));
		assert.deepStrictEqual(roster.getMessageQueueState(sessionId).items, []);

		const panel = openQueuePanel(overlay);
		assert.strictEqual(panel.querySelector('.queue-item'), null);
		assert.strictEqual(panel.querySelector('.queue-failed'), null);
		assert.strictEqual(panel.querySelector('.conversation-lens-inbox-queue-retry'), null);
		assert.ok(panel.querySelector('.conversation-lens-inbox-list-empty')?.textContent?.includes(conversationLensDockInboxQueueNotListed));
		assert.ok(!panel.textContent?.includes('fixture failed'));
		assert.ok(!panel.textContent?.includes('send rejected'));
	});
});

suite('ConversationInboxOverlay Retry', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function failedItem(id: string, status: 'FAILED' | 'UPLOAD_FAILED', lastError: string): ConversationMessageQueueItem {
		return {
			id,
			content: `body-${id}`,
			status,
			hold: undefined,
			uploadProgress: undefined,
			retryCount: 1,
			lastError,
			locked: false,
			pinned: false,
		};
	}

	function createOverlay(
		roster: ConversationStubService,
		failures: ConversationComposerPostFailureReason[] = [],
	): ConversationInboxOverlay {
		const instantiationService = workbenchInstantiationService(undefined, store);
		stubInboxServices(instantiationService, roster);
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		return store.add(instantiationService.createInstance(ConversationInboxOverlay, parent, {
			onQueueItemHold() { },
			onScrollToPendingConfirmation() { },
			showPostFailure(reason) { failures.push(reason); },
		}));
	}

	function openQueuePanel(overlay: ConversationInboxOverlay): HTMLElement {
		const queueChip = overlay.element.querySelector('.conversation-lens-inbox-queue') as HTMLButtonElement;
		queueChip.click();
		const panels = [...document.querySelectorAll('.conversation-lens-inbox-list-panel')]
			.filter(host => host.querySelector('.conversation-lens-message-queue-list'));
		const panel = panels.at(-1) as HTMLElement | undefined;
		assert.ok(panel);
		return panel;
	}

	function getRetryButton(panel: HTMLElement, itemId: string): HTMLButtonElement | null {
		const row = panel.querySelector(`.queue-item[data-item-id="${itemId}"]`);
		return row?.querySelector('.conversation-lens-inbox-queue-retry') as HTMLButtonElement | null;
	}

	test('FAILED and UPLOAD_FAILED rows expose Retry; PENDING does not', () => {
		const roster = store.add(new ConversationStubService());
		const sessionId = roster.getActiveSessionId();
		roster.setMessageQueueFixture(sessionId, {
			isPaused: false,
			isProcessing: false,
			items: [
				failedItem('q-fail', 'FAILED', 'send rejected'),
				failedItem('q-upload', 'UPLOAD_FAILED', 'upload rejected'),
				{
					id: 'q-pending',
					content: 'later',
					status: 'PENDING',
					hold: undefined,
					uploadProgress: undefined,
					retryCount: 0,
					lastError: undefined,
					locked: false,
					pinned: false,
				},
			],
		});
		const panel = openQueuePanel(createOverlay(roster));
		const failedRetry = getRetryButton(panel, 'q-fail');
		const uploadRetry = getRetryButton(panel, 'q-upload');
		assert.ok(failedRetry);
		assert.ok(uploadRetry);
		assert.strictEqual(failedRetry.textContent, conversationLensInboxQueueRetry);
		assert.strictEqual(uploadRetry.textContent, conversationLensInboxQueueRetry);
		assert.ok(panel.querySelector('.queue-item[data-item-id="q-fail"]')?.textContent?.includes('send rejected'));
		assert.ok(panel.querySelector('.queue-item[data-item-id="q-upload"]')?.textContent?.includes('upload rejected'));
		assert.strictEqual(getRetryButton(panel, 'q-pending'), null);
	});

	test('FAILED and UPLOAD_FAILED rows use distinct DOM classes', () => {
		const roster = store.add(new ConversationStubService());
		const sessionId = roster.getActiveSessionId();
		roster.setMessageQueueFixture(sessionId, {
			isPaused: false,
			isProcessing: false,
			items: [
				failedItem('q-fail', 'FAILED', 'send rejected'),
				failedItem('q-upload', 'UPLOAD_FAILED', 'upload rejected'),
			],
		});
		const panel = openQueuePanel(createOverlay(roster));
		const failedRow = panel.querySelector('.queue-item[data-item-id="q-fail"]') as HTMLElement | null;
		const uploadRow = panel.querySelector('.queue-item[data-item-id="q-upload"]') as HTMLElement | null;
		assert.ok(failedRow);
		assert.ok(uploadRow);
		assert.ok(failedRow.classList.contains('queue-failed'));
		assert.ok(!failedRow.classList.contains('upload-failed'));
		assert.ok(uploadRow.classList.contains('upload-failed'));
		assert.ok(!uploadRow.classList.contains('queue-failed'));
		assert.notStrictEqual(failedRow.className, uploadRow.className);
	});

	test('stub Retry stays disabled and does not call retryMessageQueueItem', () => {
		const roster = store.add(new RecordingStubRoster());
		const sessionId = roster.getActiveSessionId();
		roster.setMessageQueueFixture(sessionId, {
			isPaused: false,
			isProcessing: false,
			items: [failedItem('q-fail', 'FAILED', 'send rejected')],
		});
		const panel = openQueuePanel(createOverlay(roster));
		const button = getRetryButton(panel, 'q-fail');
		assert.ok(button);
		assert.strictEqual(button.disabled, true);
		assert.strictEqual(button.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(button.title, conversationLensInboxQueueRetryUnavailable);
		button.click();
		assert.deepStrictEqual(roster.retryCalls, []);
		assert.strictEqual(roster.retryMessageQueueItem(sessionId, 'q-fail'), false);
		assert.strictEqual(roster.getMessageQueueState(sessionId).items[0]?.status, 'FAILED');
		assert.ok(getRetryButton(panel, 'q-fail'));
	});

	test('retryMessageQueueItem false shows failed and does not dress the row as retried', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const roster = store.add(new class extends RetryRoster {
			override isEngineConnected(): boolean {
				return this.connected;
			}
			connected = false;
		}());
		roster.retryResult = false;
		const sessionId = roster.getActiveSessionId();
		roster.setMessageQueueFixture(sessionId, {
			isPaused: false,
			isProcessing: false,
			items: [failedItem('q-fail', 'FAILED', 'send rejected')],
		});
		const overlay = createOverlay(roster, failures);
		const panel = openQueuePanel(overlay);
		const button = getRetryButton(panel, 'q-fail');
		assert.ok(button);
		roster.connected = true;
		button.disabled = false;
		button.removeAttribute('disabled');
		button.setAttribute('aria-disabled', 'false');
		button.click();
		assert.deepStrictEqual(roster.retryCalls, [{ sessionId, itemId: 'q-fail', upload: false }]);
		assert.deepStrictEqual(failures, ['failed']);
		assert.strictEqual(roster.getMessageQueueState(sessionId).items[0]?.status, 'FAILED');
		assert.ok(getRetryButton(panel, 'q-fail'));
		assert.ok(panel.querySelector('.queue-item[data-item-id="q-fail"]')?.classList.contains('queue-failed'));
		assert.ok(panel.querySelector('.queue-item[data-item-id="q-fail"]')?.textContent?.includes('send rejected'));
	});

	test('connected Inbox does not show fixture FAILED rows as the engine queue', () => {
		const roster = store.add(new RetryRoster());
		const sessionId = roster.getActiveSessionId();
		roster.setMessageQueueFixture(sessionId, {
			isPaused: false,
			isProcessing: false,
			items: [
				failedItem('q-fail', 'FAILED', 'send rejected'),
				failedItem('q-upload', 'UPLOAD_FAILED', 'upload rejected'),
			],
		});
		const overlay = createOverlay(roster);
		const chip = overlay.element.querySelector('.conversation-lens-inbox-queue') as HTMLButtonElement;
		assert.ok(chip.textContent?.includes(conversationLensDockInboxQueueNotListed));
		assert.ok(!chip.textContent?.includes(conversationLensDockInboxNoQueue));
		assert.deepStrictEqual(roster.getMessageQueueState(sessionId).items, []);

		const panel = openQueuePanel(overlay);
		assert.ok(!getRetryButton(panel, 'q-fail'));
		assert.ok(!getRetryButton(panel, 'q-upload'));
		assert.strictEqual(panel.querySelector('.queue-item'), null);
		assert.strictEqual(panel.querySelector('.queue-failed'), null);
		assert.strictEqual(panel.querySelector('.upload-failed'), null);
		assert.ok(panel.querySelector('.conversation-lens-inbox-list-empty')?.textContent?.includes(conversationLensDockInboxQueueNotListed));
		assert.deepStrictEqual(roster.retryCalls, []);
		assert.deepStrictEqual(roster.holdCalls, []);
	});
});
