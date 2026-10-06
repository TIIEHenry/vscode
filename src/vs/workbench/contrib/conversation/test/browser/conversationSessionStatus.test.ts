/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	getConversationEngineChipTone,
	getConversationEngineStatusText,
	getConnectionPhaseStatusBarText,
	getConversationModelEchoStatusText,
	getConversationSessionStatusText,
	getEngineStatusCommandArguments,
	getEngineStatusCommandId,
	isConversationPairingHold,
	shouldKeepLiveTreeLeaseWhilePairing,
	shouldRebindLiveTreeLeaseWhilePairing,
	shouldShowConversationModelEchoInStatusBar,
} from '../../browser/conversationSessionStatus.js';
import { CONNECTION_PROFILES_ZONE, OPEN_CONNECTION_PREFERENCES_COMMAND_ID, OPEN_ENGINE_PREFERENCES_COMMAND_ID } from '../../common/uaPreferencesPanes.js';
import { ConversationStubSession } from '../../browser/conversationStubModel.js';
import * as conversationSessionStatus from '../../browser/conversationSessionStatus.js';

suite('ConversationSessionStatus', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getConversationSessionStatusText returns session title when present', () => {
		const session: ConversationStubSession = {
			id: 'test',
			title: 'Product tour',
			turns: [],
		};
		assert.strictEqual(getConversationSessionStatusText(session), 'Product tour');
	});

	test('getConversationSessionStatusText returns empty label when session is missing', () => {
		assert.strictEqual(getConversationSessionStatusText(undefined), 'No session');
	});

	test('getConversationSessionStatusText returns empty label when title is blank', () => {
		const session: ConversationStubSession = {
			id: 'blank',
			title: '   ',
			turns: [],
		};
		assert.strictEqual(getConversationSessionStatusText(session), 'No session');
	});

	test('engine chip tone matches the identity strip: warning when offline, error when failed', () => {
		assert.strictEqual(getConversationEngineChipTone({ kind: 'disconnected' }), 'warning');
		assert.strictEqual(getConversationEngineChipTone({ kind: 'closed' }), 'warning');
		assert.strictEqual(getConversationEngineChipTone(undefined), 'warning');
		assert.strictEqual(getConversationEngineChipTone({ kind: 'connecting', reason: 'initial' }, true), 'warning');
		assert.strictEqual(getConversationEngineChipTone({ kind: 'connected', path: 'direct' }, true), 'warning');
		assert.strictEqual(getConversationEngineChipTone({ kind: 'connecting', reason: 'initial' }), 'standard');
		assert.strictEqual(getConversationEngineChipTone({ kind: 'connecting', reason: 'transport_lost' }), 'standard');
		assert.strictEqual(getConversationEngineChipTone({ kind: 'connected', path: 'loopback' }), 'standard');
		assert.strictEqual(getConversationEngineChipTone({ kind: 'failed', code: 'pin_mismatch', reason: 'pin' }), 'error');
		assert.strictEqual(getConversationEngineChipTone({ kind: 'failed', code: 'transport_failed', reason: 'transport' }, true), 'error');
	});

	test('getConversationEngineStatusText returns honest not-connected copy', () => {
		assert.strictEqual(getConversationEngineStatusText(), 'Engine not connected');
		assert.strictEqual(getConversationEngineStatusText(false), 'Engine not connected');
	});

	test('getConversationEngineStatusText returns connected copy when engine is connected', () => {
		assert.strictEqual(getConversationEngineStatusText(true), 'Engine connected');
	});

	test('getConversationModelEchoStatusText returns honest no-model copy', () => {
		assert.strictEqual(getConversationModelEchoStatusText(), 'No model');
	});

	test('shouldShowConversationModelEchoInStatusBar is true only when Conversation part is hidden', () => {
		assert.strictEqual(shouldShowConversationModelEchoInStatusBar(true), false);
		assert.strictEqual(shouldShowConversationModelEchoInStatusBar(false), true);
	});

	test('getEngineStatusCommandId opens Connection while pairingPending even if phase is connected', () => {
		assert.strictEqual(getEngineStatusCommandId({ kind: 'connected', path: 'direct' }), OPEN_ENGINE_PREFERENCES_COMMAND_ID);
		assert.strictEqual(getEngineStatusCommandId({ kind: 'connected', path: 'direct' }, true), OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		assert.strictEqual(getEngineStatusCommandId({ kind: 'connecting', reason: 'initial' }, true), OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		assert.strictEqual(getEngineStatusCommandId({ kind: 'disconnected' }), OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		assert.strictEqual(getEngineStatusCommandId({ kind: 'failed', code: 'transport_failed', reason: 'transport' }), OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
	});

	test('getEngineStatusCommandArguments opens Connection profiles unless the engine is live or pairing', () => {
		assert.deepStrictEqual(getEngineStatusCommandArguments({ kind: 'disconnected' }), [CONNECTION_PROFILES_ZONE]);
		assert.deepStrictEqual(getEngineStatusCommandArguments({ kind: 'closed' }), [CONNECTION_PROFILES_ZONE]);
		assert.deepStrictEqual(getEngineStatusCommandArguments({ kind: 'connecting', reason: 'initial' }), [CONNECTION_PROFILES_ZONE]);
		assert.deepStrictEqual(getEngineStatusCommandArguments({ kind: 'failed', code: 'transport_failed', reason: 'transport' }), [CONNECTION_PROFILES_ZONE]);
		assert.deepStrictEqual(getEngineStatusCommandArguments({ kind: 'connected', path: 'direct' }), []);
		assert.deepStrictEqual(getEngineStatusCommandArguments({ kind: 'connected', path: 'direct' }, true), []);
		assert.deepStrictEqual(getEngineStatusCommandArguments({ kind: 'disconnected' }, true), []);
	});

	test('getConnectionPhaseStatusBarText names pairing instead of a dead engine', () => {
		assert.strictEqual(getConnectionPhaseStatusBarText({ kind: 'connecting', reason: 'initial' }, true), 'Waiting for pairing');
		assert.strictEqual(getConnectionPhaseStatusBarText({ kind: 'connected', path: 'direct' }, true), 'Waiting for pairing');
		assert.strictEqual(getConnectionPhaseStatusBarText({ kind: 'disconnected' }), 'Engine not connected');
	});

	test('getConnectionPhaseStatusBarText ignores stale pairingPending when phase is disconnected or failed', () => {
		assert.strictEqual(getConnectionPhaseStatusBarText({ kind: 'disconnected' }, true), 'Engine not connected');
		assert.strictEqual(
			getConnectionPhaseStatusBarText({ kind: 'failed', code: 'sas_cancelled', reason: 'user cancelled SAS confirmation' }, true),
			'Pairing confirmation cancelled',
		);
	});

	test('getConnectionPhaseStatusBarText names pairing cancellation instead of a transport failure', () => {
		assert.strictEqual(getConnectionPhaseStatusBarText({ kind: 'failed', code: 'sas_cancelled', reason: 'user cancelled SAS confirmation' }), 'Pairing confirmation cancelled');
		assert.strictEqual(getConnectionPhaseStatusBarText({ kind: 'failed', code: 'recover_cancelled', reason: 'user cancelled recoverTrust confirmation' }), 'Trust recovery cancelled');
		assert.strictEqual(getConnectionPhaseStatusBarText({ kind: 'failed', code: 'signer_unavailable', reason: 'device auth signer unavailable' }), 'Engine signer unavailable');
		assert.strictEqual(getConnectionPhaseStatusBarText({ kind: 'failed', code: 'transport_failed', reason: 'down' }), 'Connection failed');
	});

	test('isConversationPairingHold is true for connecting or connected with pairingPending only', () => {
		const connectingPairing = {
			getConnectionPhase: () => ({ kind: 'connecting' as const, reason: 'initial' as const }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
		};
		const disconnectedPairing = {
			getConnectionPhase: () => ({ kind: 'disconnected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
		};
		const failedPairing = {
			getConnectionPhase: () => ({ kind: 'failed' as const, code: 'transport_failed' as const, reason: 'down' }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
		};
		const connectedNotPairing = {
			getConnectionPhase: () => ({ kind: 'connected' as const, path: 'loopback' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		};
		assert.strictEqual(isConversationPairingHold(connectingPairing), true);
		assert.strictEqual(isConversationPairingHold(disconnectedPairing), false);
		assert.strictEqual(isConversationPairingHold(failedPairing), false);
		assert.strictEqual(isConversationPairingHold(connectedNotPairing), false);
		assert.strictEqual(isConversationPairingHold(undefined), false);
	});

	test('D292 pairing live-tree guard keeps same session and rebinds on switch', () => {
		const pairing = {
			getConnectionPhase: () => ({ kind: 'connected' as const, path: 'loopback' as const }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
		};
		const disconnected = {
			getConnectionPhase: () => ({ kind: 'disconnected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		};
		assert.strictEqual(shouldKeepLiveTreeLeaseWhilePairing(pairing, 'ua-a', 'ua-a'), true);
		assert.strictEqual(shouldRebindLiveTreeLeaseWhilePairing(pairing, 'ua-a', 'ua-a'), false);
		assert.strictEqual(shouldKeepLiveTreeLeaseWhilePairing(pairing, 'ua-a', 'ua-b'), false);
		assert.strictEqual(shouldRebindLiveTreeLeaseWhilePairing(pairing, 'ua-a', 'ua-b'), true);
		assert.strictEqual(shouldKeepLiveTreeLeaseWhilePairing(pairing, undefined, 'ua-a'), false);
		assert.strictEqual(shouldRebindLiveTreeLeaseWhilePairing(pairing, undefined, 'ua-a'), false);
		assert.strictEqual(shouldKeepLiveTreeLeaseWhilePairing(disconnected, 'ua-a', 'ua-a'), false);
		assert.strictEqual(shouldRebindLiveTreeLeaseWhilePairing(disconnected, 'ua-a', 'ua-b'), false);
	});

	test('does not export session usage helpers that paint zero placeholders', () => {
		const exports = Object.keys(conversationSessionStatus);
		for (const key of exports) {
			assert.ok(!/usage|turns|tok/i.test(key), `unexpected usage-like export: ${key}`);
		}
	});
});
