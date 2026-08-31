/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	ConnectionPreferencesPane,
	getConnectionEmptyCopy,
	getConnectionTestStatusText,
	IConnectionProfileEntry,
} from '../../browser/connectionPreferencesPane.js';

const CONNECTION_EMPTY_COPY = 'No connection profiles yet';
const FAKE_PROFILE_LABELS = ['Local Engine', 'Home Server'];

suite('ConnectionPreferencesPane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function getPaneList(pane: ConnectionPreferencesPane): WorkbenchList<IConnectionProfileEntry> {
		return (pane as unknown as { list: WorkbenchList<IConnectionProfileEntry> }).list;
	}

	function getPaneEntries(pane: ConnectionPreferencesPane): IConnectionProfileEntry[] {
		return (pane as unknown as { entries: IConnectionProfileEntry[] }).entries;
	}

	function mountPane(): ConnectionPreferencesPane {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const pane = store.add(instantiationService.createInstance(ConnectionPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		return pane;
	}

	test('getConnectionTestStatusText returns honest not-connected copy', () => {
		assert.strictEqual(getConnectionTestStatusText(), 'Not connected — no engine.');
	});

	test('getConnectionEmptyCopy returns honest roster-empty copy', () => {
		assert.strictEqual(getConnectionEmptyCopy(), CONNECTION_EMPTY_COPY);
	});

	test('pane title remains Connection with honest empty welcome', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		const title = container.querySelector('h2') as HTMLElement;
		assert.ok(title);
		assert.strictEqual(title.textContent, 'Connection');

		const emptyWelcome = container.querySelector('.connection-empty-welcome') as HTMLElement;
		assert.ok(emptyWelcome);
		assert.strictEqual(emptyWelcome.textContent, CONNECTION_EMPTY_COPY);

		container.remove();
	});

	test('pane has empty WorkbenchList without service-disconnected wording in welcome', () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		const list = getPaneList(pane);

		assert.ok(list instanceof WorkbenchList, 'Connection pane must construct WorkbenchList');
		assert.ok(container.querySelector('.connection-list'));
		assert.deepStrictEqual(getPaneEntries(pane), []);
		assert.strictEqual(list.length, 0);

		assert.strictEqual(container.querySelector('.connection-empty-state'), null);

		const emptyWelcome = container.querySelector('.connection-empty-welcome') as HTMLElement;
		const welcomeText = emptyWelcome.textContent ?? '';
		assert.ok(!/not connected/i.test(welcomeText), 'empty welcome must not say not connected');
		assert.ok(!/no engine/i.test(welcomeText), 'empty welcome must not say no engine');

		const combined = container.textContent ?? '';
		assert.ok(!/copilot/i.test(combined), 'pane must not mention Copilot');
		assert.ok(!/open chat/i.test(combined), 'pane must not mention Open Chat');

		container.remove();
	});

	test('pane has no chat widgets or editable connection fields', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		assert.strictEqual(container.querySelector('.chat-widget'), null);
		assert.strictEqual(container.querySelector('.chat-setup'), null);
		assert.strictEqual(container.querySelector('.connection-field-row'), null);
		assert.strictEqual(container.querySelector('.connection-field-input'), null);
		assert.strictEqual(container.querySelector('.monaco-checkbox'), null);
		assert.ok(!/\(command:/.test(container.innerHTML), 'pane must not include command buttons');

		container.remove();
	});

	test('pane does not seed fake connection profile rows', () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		const combined = container.textContent ?? '';

		for (const label of FAKE_PROFILE_LABELS) {
			assert.ok(!combined.includes(label), `pane must not seed fake ${label} row`);
		}

		assert.strictEqual(getPaneEntries(pane).length, 0);
		assert.strictEqual(getPaneList(pane).length, 0);

		container.remove();
	});

	test('Test Connection click surfaces honest status without faking success', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		const testButton = container.querySelector('.connection-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);
		assert.strictEqual(testStatus.textContent, '');

		testButton.click();
		assert.strictEqual(testStatus.textContent, getConnectionTestStatusText());
		assert.notStrictEqual(testStatus.textContent, 'Connected');

		container.remove();
	});
});
