/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	EnginePreferencesPane,
	getEngineEmptyCopy,
	getEngineTestStatusText,
	IEngineEntry,
} from '../../browser/enginePreferencesPane.js';

const ENGINE_EMPTY_COPY = 'No engines yet';
const FAKE_ENGINE_LABELS = ['Local Engine', '127.0.0.1:8080'];

suite('EnginePreferencesPane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function getPaneList(pane: EnginePreferencesPane): WorkbenchList<IEngineEntry> {
		return (pane as unknown as { list: WorkbenchList<IEngineEntry> }).list;
	}

	function getPaneEntries(pane: EnginePreferencesPane): IEngineEntry[] {
		return (pane as unknown as { entries: IEngineEntry[] }).entries;
	}

	function mountPane(): EnginePreferencesPane {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const pane = store.add(instantiationService.createInstance(EnginePreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		return pane;
	}

	test('getEngineTestStatusText returns honest not-connected copy', () => {
		assert.strictEqual(getEngineTestStatusText(), 'Not connected — no engine.');
	});

	test('getEngineEmptyCopy returns honest roster-empty copy', () => {
		assert.strictEqual(getEngineEmptyCopy(), ENGINE_EMPTY_COPY);
	});

	test('pane title remains Engine with honest empty welcome', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		const title = container.querySelector('h2') as HTMLElement;
		assert.ok(title);
		assert.strictEqual(title.textContent, 'Engine');

		const emptyWelcome = container.querySelector('.engine-empty-welcome') as HTMLElement;
		assert.ok(emptyWelcome);
		assert.strictEqual(emptyWelcome.textContent, ENGINE_EMPTY_COPY);

		container.remove();
	});

	test('pane has empty WorkbenchList without service-disconnected wording in welcome', () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		const list = getPaneList(pane);

		assert.ok(list instanceof WorkbenchList, 'Engine pane must construct WorkbenchList');
		assert.ok(container.querySelector('.engine-list'));
		assert.deepStrictEqual(getPaneEntries(pane), []);
		assert.strictEqual(list.length, 0);

		assert.strictEqual(container.querySelector('.engine-empty-state'), null);

		const emptyWelcome = container.querySelector('.engine-empty-welcome') as HTMLElement;
		const welcomeText = emptyWelcome.textContent ?? '';
		assert.ok(!/not connected/i.test(welcomeText), 'empty welcome must not say not connected');
		assert.ok(!/no engine/i.test(welcomeText), 'empty welcome must not say no engine');

		const combined = container.textContent ?? '';
		assert.ok(!/copilot/i.test(combined), 'pane must not mention Copilot');
		assert.ok(!/open chat/i.test(combined), 'pane must not mention Open Chat');

		container.remove();
	});

	test('pane has no chat widgets or editable engine fields', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		assert.strictEqual(container.querySelector('.chat-widget'), null);
		assert.strictEqual(container.querySelector('.chat-setup'), null);
		assert.strictEqual(container.querySelector('.engine-field-row'), null);
		assert.strictEqual(container.querySelector('.engine-field-input'), null);
		assert.strictEqual(container.querySelector('.monaco-checkbox'), null);
		assert.ok(!/\(command:/.test(container.innerHTML), 'pane must not include command buttons');

		container.remove();
	});

	test('pane does not seed fake engine rows', () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		const combined = container.textContent ?? '';

		for (const label of FAKE_ENGINE_LABELS) {
			assert.ok(!combined.includes(label), `pane must not seed fake ${label} row`);
		}

		assert.strictEqual(getPaneEntries(pane).length, 0);
		assert.strictEqual(getPaneList(pane).length, 0);

		container.remove();
	});

	test('Test Engine click surfaces honest status without faking success', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		const testButton = container.querySelector('.engine-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = container.querySelector('.engine-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);
		assert.strictEqual(testStatus.textContent, '');

		testButton.click();
		assert.strictEqual(testStatus.textContent, getEngineTestStatusText());
		assert.notStrictEqual(testStatus.textContent, 'Connected');

		container.remove();
	});
});
