/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentContextVariableListResult } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { formatEngineContextVariableListLabel } from './engineContextVariableList.js';
import { EngineContextVariableSection } from './engineContextVariableSection.js';
import { createUnknownConversationEntryCapability } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineContextVariableSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listContextVariable after dispose does not paint context variable rows', async () => {
		let releaseList: ((value: UniverseAgentContextVariableListResult) => void) | undefined;
		const lateEntry = {
			name: 'late-after-dispose',
			scope: 'VARIABLE_GLOBAL' as const,
			updatedBy: '',
			updatedAt: 0,
			contentPreview: '',
		};
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: createEmptyTestCapabilitySnapshot(),
				conversationEntryCapability: {
					...createUnknownConversationEntryCapability(),
					listContextVariable: 'SUPPORTED',
				},
			}),
			listContextVariable: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = store.add(instantiationService.createInstance(EngineContextVariableSection, parent));
		section.setSectionActive(true);
		await timeout(0);

		section.dispose();
		releaseList?.({ current: [lateEntry], inherited: [] });
		await timeout(0);

		assert.strictEqual(section.getItemCount(), undefined);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-context-variable-row').length, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(formatEngineContextVariableListLabel('current', lateEntry)));
	});
});
