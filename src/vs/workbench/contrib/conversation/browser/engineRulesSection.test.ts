/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentConnectionSnapshot,
	UniverseAgentListProjectRulesResult,
	UniverseAgentProjectRule,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { EngineRulesSection } from './engineRulesSection.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

function sampleRule(id: string, title: string): UniverseAgentProjectRule {
	return {
		id,
		title,
		enabled: true,
		priority: 2,
		body: '',
		scope: 2,
		globs: [],
		appliesTo: [],
	};
}

suite('EngineRulesSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listProjectRules after dispose does not paint rule rows', async () => {
		const pending: Array<(value: UniverseAgentListProjectRulesResult) => void> = [];
		const capabilities = {
			...createEmptyTestCapabilitySnapshot(),
			globalRules: { support: 'SUPPORTED' as const },
			projectRules: { support: 'SUPPORTED' as const },
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			authenticated: true,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities,
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: onDidChangeConnection.event,
			listProjectRules: () => new Promise(resolve => {
				pending.push(resolve);
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = instantiationService.createInstance(EngineRulesSection, parent);
		section.setSectionActive(true);
		await timeout(0);

		section.dispose();
		for (const release of pending) {
			release({ rules: [sampleRule('late', 'after_dispose')] });
		}
		await timeout(0);

		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-rules-row').length, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes('after_dispose'));
	});
});
