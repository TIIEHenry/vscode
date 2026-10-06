/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $, append } from '../../../../../base/browser/dom.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import {
	ConversationSubAgentOverlay,
	conversationSubAgentOverlayTitleElementId,
} from '../../browser/conversationSubAgentOverlay.js';

suite('ConversationSubAgentOverlay', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountOverlay(host: HTMLElement): ConversationSubAgentOverlay {
		const instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(IInstantiationService, instantiationService);
		return store.add(instantiationService.createInstance(ConversationSubAgentOverlay, host));
	}

	test('dual-leaf open dialogs use distinct title ids scoped to sessionKey', () => {
		const root = append(document.body, $('.conversation-subagent-overlay-test-root'));
		store.add({ dispose: () => root.remove() });

		const hostA = append(root, $('.host-a'));
		const hostB = append(root, $('.host-b'));
		const overlayA = mountOverlay(hostA);
		const overlayB = mountOverlay(hostB);

		overlayA.open({
			sessionKey: 'session-a',
			chatId: 'sub-a',
			title: 'Agent A',
			sessionTitle: 'Session A',
			breadcrumb: [],
		});
		overlayB.open({
			sessionKey: 'session-b',
			chatId: 'sub-b',
			title: 'Agent B',
			sessionTitle: 'Session B',
			breadcrumb: [],
		});

		const titleIdA = overlayA.element.getAttribute('aria-labelledby');
		const titleIdB = overlayB.element.getAttribute('aria-labelledby');
		assert.strictEqual(titleIdA, conversationSubAgentOverlayTitleElementId('session-a'));
		assert.strictEqual(titleIdB, conversationSubAgentOverlayTitleElementId('session-b'));
		assert.notStrictEqual(titleIdA, titleIdB);
		assert.strictEqual(overlayA.element.querySelector(`#${titleIdA}`)?.textContent, 'Agent A');
		assert.strictEqual(overlayB.element.querySelector(`#${titleIdB}`)?.textContent, 'Agent B');
		assert.strictEqual(document.getElementById(titleIdA!), overlayA.element.querySelector(`#${titleIdA}`));
		assert.strictEqual(document.getElementById(titleIdB!), overlayB.element.querySelector(`#${titleIdB}`));
	});

	test('close removes title id so closed overlays do not keep duplicate labels in the document', () => {
		const host = append(document.body, $('.conversation-subagent-overlay-test-host'));
		store.add({ dispose: () => host.remove() });
		const overlay = mountOverlay(host);
		overlay.open({
			sessionKey: 'session-a',
			chatId: 'sub-a',
			title: 'Agent A',
			sessionTitle: 'Session A',
			breadcrumb: [],
		});
		const titleId = conversationSubAgentOverlayTitleElementId('session-a');
		assert.ok(overlay.element.querySelector(`#${titleId}`));

		overlay.close();
		assert.strictEqual(overlay.element.querySelector(`#${titleId}`), null);
		assert.strictEqual(document.getElementById(titleId), null);
	});
});
