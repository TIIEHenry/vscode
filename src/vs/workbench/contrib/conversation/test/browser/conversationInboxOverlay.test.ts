/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	ConversationInboxOverlay,
	conversationLensInboxOverlayClass,
} from '../../browser/conversationInboxOverlay.js';
import {
	conversationLensDockStop,
	conversationLensDockStopNotGenerating,
} from '../../browser/conversationLensDockStrings.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';

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
		assert.strictEqual(stop.getAttribute('aria-label'), conversationLensDockStop);
		stop.click();
		assert.deepStrictEqual(roster.cancelCalls, [{ sessionId: roster.getActiveSessionId(), agentId: undefined }]);
	});
});
