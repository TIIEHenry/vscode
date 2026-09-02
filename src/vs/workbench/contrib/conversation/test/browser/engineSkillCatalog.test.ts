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

	test('connected + UNKNOWN => no catalog rows', () => {
		assert.strictEqual(resolveEngineSkillsPaneMode(true, 'UNKNOWN'), 'unknown');
		assert.strictEqual(shouldHideSkillCatalogRows('unknown'), true);
	});

	test('connected + SUPPORTED => supported mode shows catalog rows', () => {
		assert.strictEqual(resolveEngineSkillsPaneMode(true, 'SUPPORTED'), 'supported');
		assert.strictEqual(shouldHideSkillCatalogRows('supported'), false);
	});

	test('disconnect after connect must not keep supported mode when disconnected (§8.3 #5)', () => {
		const capabilities: UniverseAgentConnectionSnapshot['capabilities'] = {
			...createEmptyCapabilitySnapshot(),
			skills: { support: 'SUPPORTED' },
		};

		assert.strictEqual(resolveEngineSkillsPaneMode(true, capabilities.skills.support), 'supported');
		assert.strictEqual(resolveEngineSkillsPaneMode(false, capabilities.skills.support), 'disconnected');
		assert.strictEqual(shouldHideSkillCatalogRows('disconnected'), true);
	});

	test('connection snapshot transition clears supported rendering path', () => {
		const capabilities: UniverseAgentConnectionSnapshot['capabilities'] = {
			...createEmptyCapabilitySnapshot(),
			skills: { support: 'SUPPORTED' },
		};
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();
		let connected = true;

		const getMode = () => resolveEngineSkillsPaneMode(
			connected,
			capabilities.skills.support,
		);

		assert.strictEqual(getMode(), 'supported');

		connected = false;
		onDidChangeConnection.fire({
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			capabilities,
		});

		assert.strictEqual(getMode(), 'disconnected');
		onDidChangeConnection.dispose();
	});
});
