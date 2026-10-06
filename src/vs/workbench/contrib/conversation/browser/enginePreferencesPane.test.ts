/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { EnginePreferencesPane } from './enginePreferencesPane.js';
import { createConversationConnectionTestStub } from '../test/common/conversationConnectionTestStub.js';

suite('EnginePreferencesPane (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late probeEngine after dispose does not paint test status', async () => {
		let resolveProbe!: (value: { ok: true; engineIdentityId: string }) => void;
		const probe = new Promise<{ ok: true; engineIdentityId: string }>(resolve => {
			resolveProbe = resolve;
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			probeEngine: () => probe,
		});

		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add({ dispose: () => container.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const pane = instantiationService.createInstance(EnginePreferencesPane);
		container.appendChild(pane.getDomNode());

		const testButton = pane.getDomNode().querySelector('.engine-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = pane.getDomNode().querySelector('.engine-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);

		const paintBoom = new Error('paint after dispose');
		Object.defineProperty(testStatus, 'textContent', {
			configurable: true,
			get: () => '',
			set: (value: string) => {
				if (value.startsWith('Reachable')) {
					throw paintBoom;
				}
			},
		});

		testButton.click();
		await timeout(0);
		pane.dispose();

		resolveProbe({ ok: true, engineIdentityId: 'late-engine' });
		await timeout(0);

		assert.strictEqual(testStatus.textContent, '');
	});
});
