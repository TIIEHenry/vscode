/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IWorkbenchLayoutService } from '../../../../../workbench/services/layout/browser/layoutService.js';
import { workbenchInstantiationService } from '../../../../../workbench/test/browser/workbenchTestServices.js';
import { SessionsBlockedReason, SessionsPolicyBlockedOverlay } from '../../browser/sessionsPolicyBlocked.js';

suite('SessionsPolicyBlockedOverlay', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mount(reason: SessionsBlockedReason): HTMLElement {
		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add({ dispose: () => container.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(ICommandService, new class extends mock<ICommandService>() { }());
		instantiationService.stub(IOpenerService, new class extends mock<IOpenerService>() { }());
		instantiationService.stub(IWorkbenchLayoutService, new class extends mock<IWorkbenchLayoutService>() {
			override readonly mainContainer = container;
		}());

		store.add(instantiationService.createInstance(
			SessionsPolicyBlockedOverlay,
			container,
			reason === SessionsBlockedReason.AccountPolicyGate
				? { reason, accountName: 'octocat', approvedOrganizations: ['github'] }
				: { reason },
		));
		return container;
	}

	test('initial focus is inside the card', () => {
		const container = mount(SessionsBlockedReason.AccountPolicyGate);
		const card = container.querySelector('.sessions-policy-blocked-card');
		const overlay = container.querySelector('.sessions-policy-blocked-overlay');
		assert.ok(card);
		assert.ok(overlay);
		const active = document.activeElement;
		assert.ok(active);
		assert.ok(card.contains(active));
		assert.notStrictEqual(active, overlay);
		assert.ok((active as HTMLElement).matches('button, a[href], [role="button"]'));

		const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
		overlay.dispatchEvent(event);
		assert.strictEqual(event.defaultPrevented, true);
	});

	test('loading focus is the card', () => {
		const container = mount(SessionsBlockedReason.Loading);
		const card = container.querySelector('.sessions-policy-blocked-card') as HTMLElement | null;
		assert.ok(card);
		assert.strictEqual(card.tabIndex, 0);
		assert.strictEqual(document.activeElement, card);
		assert.strictEqual(card.querySelector('button, a[href], [role="button"]'), null);
	});
});
