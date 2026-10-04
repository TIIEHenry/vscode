/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createUnknownConversationEntryCapability } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	isSessionPermissionModeAvailable,
	isSessionSwitchAgentAvailable,
	isSessionSwitchModelAvailable,
} from '../../browser/conversationLensComposerChrome.js';

suite('conversation entry capability', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function host(snapshot: Partial<UniverseAgentConnectionSnapshot> | undefined, methods: {
		setPermissionMode?: () => Promise<unknown>;
		switchModel?: () => Promise<unknown>;
		switchAgent?: () => Promise<unknown>;
	}) {
		return {
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected' as const, path: 'loopback' as const }),
				getConnectionSnapshot: () => snapshot ?? {},
				...methods,
			},
		} as Parameters<typeof isSessionPermissionModeAvailable>[0];
	}

	test('UNSUPPORTED conversation entry closes selects even when the proxy method exists', () => {
		const capability = {
			...createUnknownConversationEntryCapability(),
			setPermissionMode: 'UNSUPPORTED' as const,
			switchModel: 'UNSUPPORTED' as const,
			switchAgent: 'UNSUPPORTED' as const,
		};
		const blocked = host(
			{ pairingPending: false, conversationEntryCapability: capability },
			{
				setPermissionMode: async () => ({ ok: true }),
				switchModel: async () => ({ resolvedModelId: 'm' }),
				switchAgent: async () => ({ ok: true }),
			},
		);
		assert.strictEqual(isSessionPermissionModeAvailable(blocked), false);
		assert.strictEqual(isSessionSwitchModelAvailable(blocked), false);
		assert.strictEqual(isSessionSwitchAgentAvailable(blocked), false);
	});

	test('missing conversation entry field still follows whether the stub installed the method', () => {
		const installed = host({ pairingPending: false }, {
			setPermissionMode: async () => ({ ok: true }),
			switchModel: async () => ({ resolvedModelId: 'm' }),
			switchAgent: async () => ({ ok: true }),
		});
		assert.strictEqual(isSessionPermissionModeAvailable(installed), true);
		assert.strictEqual(isSessionSwitchModelAvailable(installed), true);
		assert.strictEqual(isSessionSwitchAgentAvailable(installed), true);

		const missing = host({ pairingPending: false }, {});
		assert.strictEqual(isSessionPermissionModeAvailable(missing), false);
		assert.strictEqual(isSessionSwitchModelAvailable(missing), false);
		assert.strictEqual(isSessionSwitchAgentAvailable(missing), false);
	});
});
