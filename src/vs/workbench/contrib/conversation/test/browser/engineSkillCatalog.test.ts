/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/node/grpcCapabilityProbe.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	resolveEngineSkillsPaneMode,
	shouldHideSkillCatalogRows,
} from '../../browser/engineSkillCatalog.js';

suite('engineSkillCatalog (E1)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('disconnected => disconnected mode hides catalog rows', () => {
		assert.strictEqual(resolveEngineSkillsPaneMode(false, 'SUPPORTED'), 'disconnected');
		assert.strictEqual(shouldHideSkillCatalogRows('disconnected'), true);
	});

	test('connected + UNSUPPORTED => no catalog rows (§8.3 #6)', () => {
		assert.strictEqual(resolveEngineSkillsPaneMode(true, 'UNSUPPORTED'), 'unsupported');
		assert.strictEqual(shouldHideSkillCatalogRows('unsupported'), true);
	});

	test('connected + UNKNOWN => loading mode hides catalog rows', () => {
		assert.strictEqual(resolveEngineSkillsPaneMode(true, 'UNKNOWN'), 'loading');
		assert.strictEqual(shouldHideSkillCatalogRows('loading'), true);
	});

	test('connected + SUPPORTED + listed items => ready mode shows catalog rows', () => {
		assert.strictEqual(resolveEngineSkillsPaneMode(true, 'SUPPORTED', { kind: 'success', itemCount: 1 }), 'ready');
		assert.strictEqual(shouldHideSkillCatalogRows('ready'), false);
	});

	test('disconnect after connect must not keep ready mode when disconnected (§8.3 #5)', () => {
		const capabilities: UniverseAgentConnectionSnapshot['capabilities'] = {
			...createEmptyCapabilitySnapshot(),
			skills: { support: 'SUPPORTED' },
		};

		assert.strictEqual(resolveEngineSkillsPaneMode(true, capabilities.skills.support, { kind: 'success', itemCount: 1 }), 'ready');
		assert.strictEqual(resolveEngineSkillsPaneMode(false, capabilities.skills.support, { kind: 'success', itemCount: 1 }), 'disconnected');
		assert.strictEqual(shouldHideSkillCatalogRows('disconnected'), true);
	});

	test('connection snapshot transition clears ready rendering path', () => {
		const capabilities: UniverseAgentConnectionSnapshot['capabilities'] = {
			...createEmptyCapabilitySnapshot(),
			skills: { support: 'SUPPORTED' },
		};
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();
		let connected = true;

		const getMode = () => resolveEngineSkillsPaneMode(
			connected,
			capabilities.skills.support,
			{ kind: 'success', itemCount: 1 },
		);

		assert.strictEqual(getMode(), 'ready');

		connected = false;
		onDidChangeConnection.fire({
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities,
		});

		assert.strictEqual(getMode(), 'disconnected');
		onDidChangeConnection.dispose();
	});
});
