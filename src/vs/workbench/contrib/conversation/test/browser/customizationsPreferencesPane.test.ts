/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	CustomizationsPreferencesPane,
	getCustomizationsEmptyCopy,
	ICustomizationEntry,
} from '../../browser/customizationsPreferencesPane.js';

const CUSTOMIZATIONS_EMPTY_COPY = 'No customizations yet';
const FAKE_KIND_LABELS = ['Agents', 'Skills', 'MCP', 'Plugins', 'Tools', 'Hooks'];

suite('CustomizationsPreferencesPane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function getPaneList(pane: CustomizationsPreferencesPane): WorkbenchList<ICustomizationEntry> {
		return (pane as unknown as { list: WorkbenchList<ICustomizationEntry> }).list;
	}

	function getPaneEntries(pane: CustomizationsPreferencesPane): ICustomizationEntry[] {
		return (pane as unknown as { entries: ICustomizationEntry[] }).entries;
	}

	function mountPane(): CustomizationsPreferencesPane {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const pane = store.add(instantiationService.createInstance(CustomizationsPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		return pane;
	}

	test('getCustomizationsEmptyCopy returns honest roster-empty copy', () => {
		assert.strictEqual(getCustomizationsEmptyCopy(), CUSTOMIZATIONS_EMPTY_COPY);
	});

	test('pane title remains Customizations with honest empty welcome', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		const title = container.querySelector('h2') as HTMLElement;
		assert.ok(title);
		assert.strictEqual(title.textContent, 'Customizations');

		const emptyWelcome = container.querySelector('.customizations-empty-welcome') as HTMLElement;
		assert.ok(emptyWelcome);
		assert.strictEqual(emptyWelcome.textContent, CUSTOMIZATIONS_EMPTY_COPY);

		container.remove();
	});

	test('pane has empty WorkbenchList without service-disconnected wording', () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		const list = getPaneList(pane);

		assert.ok(list instanceof WorkbenchList, 'Customizations pane must construct WorkbenchList');
		assert.ok(container.querySelector('.customizations-list'));
		assert.deepStrictEqual(getPaneEntries(pane), []);
		assert.strictEqual(list.length, 0);

		assert.strictEqual(container.querySelector('.customizations-empty-state'), null);

		const combined = container.textContent ?? '';
		assert.ok(!/not connected/i.test(combined), 'pane must not say not connected');
		assert.ok(!/no engine/i.test(combined), 'pane must not say no engine');
		assert.ok(!/copilot/i.test(combined), 'pane must not mention Copilot');
		assert.ok(!/open chat/i.test(combined), 'pane must not mention Open Chat');

		container.remove();
	});

	test('pane has no chat widgets or connection-style field rows', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		assert.strictEqual(container.querySelector('.chat-widget'), null);
		assert.strictEqual(container.querySelector('.chat-setup'), null);
		assert.strictEqual(container.querySelector('.connection-field-row'), null);
		assert.strictEqual(container.querySelector('.connection-field-input'), null);
		assert.strictEqual(container.querySelector('.engine-field-row'), null);
		assert.strictEqual(container.querySelector('.engine-field-input'), null);
		assert.ok(!/\(command:/.test(container.innerHTML), 'pane must not include command buttons');

		container.remove();
	});

	test('pane does not seed fake customization kind rows', () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		const combined = container.textContent ?? '';

		for (const label of FAKE_KIND_LABELS) {
			assert.ok(!combined.includes(label), `pane must not seed fake ${label} row`);
		}

		assert.strictEqual(getPaneEntries(pane).length, 0);
		assert.strictEqual(getPaneList(pane).length, 0);

		container.remove();
	});
});
