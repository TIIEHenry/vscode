/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { EngineMcpSection } from '../../browser/engineMcpSection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { createCatalogSessionContext } from '../common/engineCatalogTestFixtures.js';

suite('EngineMcpSection ARIA', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('MCP tabs expose tabpanel relationships and keep selection in sync', () => {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		instantiationService.stub(IAgentSessionContext, createCatalogSessionContext());
		const section = store.add(instantiationService.createInstance(EngineMcpSection, parent));
		section.setSectionActive(true);
		section.layout(640, 200);

		const tablist = section.getDomNode().querySelector('[role="tablist"]');
		const tabs = [...section.getDomNode().querySelectorAll('[role="tab"]')] as HTMLElement[];
		const panels = [...section.getDomNode().querySelectorAll('[role="tabpanel"]')] as HTMLElement[];
		assert.ok(tablist);
		assert.strictEqual(tabs.length, 2);
		assert.strictEqual(panels.length, 2);
		for (const tab of tabs) {
			const panelId = tab.getAttribute('aria-controls');
			assert.ok(panelId);
			const panel = section.getDomNode().querySelector(`#${panelId}`) as HTMLElement | null;
			assert.ok(panel);
			assert.strictEqual(panel!.getAttribute('aria-labelledby'), tab.id);
		}

		const definitionsTab = tabs.find(tab => tab.textContent?.includes('Definitions'))!;
		const runtimeTab = tabs.find(tab => tab.textContent?.includes('Runtime'))!;
		const definitionsPanel = section.getDomNode().querySelector(`#${definitionsTab.getAttribute('aria-controls')}`) as HTMLElement;
		const runtimePanel = section.getDomNode().querySelector(`#${runtimeTab.getAttribute('aria-controls')}`) as HTMLElement;
		const runtimeContent = runtimePanel.querySelector('.engine-mcp-runtime-panel') as HTMLElement;
		assert.strictEqual(definitionsTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(runtimeTab.getAttribute('aria-selected'), 'false');
		assert.notStrictEqual(definitionsPanel.style.display, 'none');
		assert.strictEqual(runtimeContent.style.display, 'none');

		runtimeTab.click();
		assert.strictEqual(definitionsTab.getAttribute('aria-selected'), 'false');
		assert.strictEqual(runtimeTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(definitionsPanel.style.display, 'none');
		assert.notStrictEqual(runtimeContent.style.display, 'none');
	});
});
