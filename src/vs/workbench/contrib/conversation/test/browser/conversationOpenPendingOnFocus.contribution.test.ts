/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationOpenPendingOnFocusContribution } from '../../browser/conversationOpenPendingOnFocus.contribution.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS } from '../../common/uaClientSettingsKeys.js';
import { shouldOpenPendingOnFocus } from '../../common/uaClientSettingsHelpers.js';

suite('ConversationOpenPendingOnFocusContribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mount(options?: {
		readonly configuration?: Record<string, unknown>;
	}): {
		readonly roster: ConversationStubService;
		readonly revealCalls: string[];
		readonly fireFocus: () => void;
	} {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const roster = store.add(new ConversationStubService());
		const revealCalls: string[] = [];
		const onDidFocus = store.add(new Emitter<void>());
		const configuration = new TestConfigurationService({
			[UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS]: true,
			...options?.configuration,
		});
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IConfigurationService, configuration);
		instantiationService.stub(IConversationPartService, {
			onDidFocus: onDidFocus.event,
			focus: () => onDidFocus.fire(),
		} as IConversationPartService);
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => revealCalls.push('scroll'),
		});
		store.add(instantiationService.createInstance(ConversationOpenPendingOnFocusContribution));
		return {
			roster,
			revealCalls,
			fireFocus: () => onDidFocus.fire(),
		};
	}

	test('helper reads the CS-4 key', () => {
		const configuration = new TestConfigurationService({
			[UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS]: false,
		});
		assert.strictEqual(shouldOpenPendingOnFocus(configuration), false);
		assert.strictEqual(shouldOpenPendingOnFocus(), true);
		assert.strictEqual(shouldOpenPendingOnFocus(new TestConfigurationService({
			[UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS]: true,
		})), true);
	});

	test('Part focus with a pending confirmation scrolls and does not authorize', () => {
		const { roster, revealCalls, fireFocus } = mount();
		roster.appendConfirmationTurn(roster.getActiveSessionId(), 'Allow write?');
		assert.ok(roster.countPendingConfirmations(roster.getActiveSessionId()) > 0);
		fireFocus();
		assert.deepStrictEqual(revealCalls, ['scroll']);
		assert.ok(roster.getTurns(roster.getActiveSessionId()).some(turn => turn.kind === 'confirmation' && turn.status === 'pending'));
	});

	test('Part focus with no pending seats does not scroll', () => {
		const { roster, revealCalls, fireFocus } = mount();
		assert.strictEqual(roster.countPendingConfirmations(roster.getActiveSessionId()), 0);
		fireFocus();
		assert.deepStrictEqual(revealCalls, []);
	});

	test('setting off does not scroll even when pending seats exist', () => {
		const { roster, revealCalls, fireFocus } = mount({
			configuration: { [UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS]: false },
		});
		roster.appendConfirmationTurn(roster.getActiveSessionId(), 'Allow write?');
		fireFocus();
		assert.deepStrictEqual(revealCalls, []);
	});
});
