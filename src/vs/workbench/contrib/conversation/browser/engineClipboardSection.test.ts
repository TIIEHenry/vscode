/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentListClipboardResult } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { formatEngineClipboardListLabel } from './engineClipboardList.js';
import { EngineClipboardSection } from './engineClipboardSection.js';
import { createUnknownConversationEntryCapability } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineClipboardSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listClipboard after dispose does not paint clipboard rows', async () => {
		let releaseList: ((value: UniverseAgentListClipboardResult) => void) | undefined;
		const lateEntry = {
			clipId: 'late-after-dispose',
			label: 'Late Session Row',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
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
					listClipboard: 'SUPPORTED',
				},
			}),
			listClipboard: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = store.add(instantiationService.createInstance(EngineClipboardSection, parent));
		section.setSectionActive(true);
		await timeout(0);

		section.dispose();
		releaseList?.({ entries: [lateEntry] });
		await timeout(0);

		assert.strictEqual(section.getItemCount(), undefined);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-clipboard-row').length, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(formatEngineClipboardListLabel(lateEntry)));
	});
});
