/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentHistoryEnvelope } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import {
	ConversationEngineHistoryList,
	conversationLensHistoryRowClass,
} from './conversationEngineHistoryList.js';
import { IConversationRosterService } from './conversationStubService.js';
import { createConversationConnectionTestStub } from '../test/common/conversationConnectionTestStub.js';

suite('ConversationEngineHistoryList (browser dispose gate)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late getHistory after show-then-dispose does not paint history rows', async () => {
		let releaseList: ((value: { envelopes: UniverseAgentHistoryEnvelope[] }) => void) | undefined;
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getHistory: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const roster: IConversationRosterService = {
			getActiveSessionId: () => 'sess-1',
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			onDidChangeEngineConnection: Event.None,
			isEngineConnected: () => true,
		} as IConversationRosterService;

		const buttonParent = document.createElement('div');
		const overlayParent = document.createElement('div');
		document.body.appendChild(buttonParent);
		document.body.appendChild(overlayParent);
		store.add({ dispose: () => { buttonParent.remove(); overlayParent.remove(); } });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(IConversationRosterService, roster);

		const list = instantiationService.createInstance(ConversationEngineHistoryList, buttonParent, overlayParent, undefined);
		list.show();
		list.dispose();
		await timeout(0);

		releaseList!({
			envelopes: [{
				cursorSeq: 'late-after-dispose',
				payload: { text: 'Late history' },
			}],
		});
		await timeout(0);

		assert.strictEqual(
			list.overlayElement.querySelectorAll(`.${conversationLensHistoryRowClass}`).length,
			0,
		);
		assert.ok(!(list.overlayElement.textContent ?? '').includes('late-after-dispose'));
	});
});
