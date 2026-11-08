/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { conversationIdentityStripClass } from './conversationIdentityStrip.js';
import {
	applyConnectionPaneIdentityStripReservation,
	connectionPaneIdentityReservationHostClass,
	connectionPaneIdentityReservedTopVar,
} from './connectionPaneIdentityStripReservation.js';

suite('connectionPaneIdentityStripReservation (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('reservation ignores identity strip rooted in a different monaco-workbench', () => {
		const foreignWorkbench = document.createElement('div');
		foreignWorkbench.className = 'monaco-workbench';
		const foreignPart = document.createElement('div');
		foreignPart.className = 'part conversation';
		const foreignStrip = document.createElement('div');
		foreignStrip.className = conversationIdentityStripClass;
		foreignPart.appendChild(foreignStrip);
		foreignWorkbench.appendChild(foreignPart);
		foreignStrip.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 8, width: 240, height: 32 });

		const activeWorkbench = document.createElement('div');
		activeWorkbench.className = 'monaco-workbench';
		const modalBlock = document.createElement('div');
		modalBlock.className = 'monaco-modal-editor-block';
		const pane = document.createElement('div');
		pane.className = 'connection-preferences-pane';
		modalBlock.appendChild(pane);
		activeWorkbench.appendChild(modalBlock);
		document.body.append(foreignWorkbench, activeWorkbench);
		store.add(toDisposable(() => {
			foreignWorkbench.remove();
			activeWorkbench.remove();
		}));

		applyConnectionPaneIdentityStripReservation(pane);

		assert.ok(modalBlock.classList.contains(connectionPaneIdentityReservationHostClass));
		assert.strictEqual(modalBlock.style.getPropertyValue(connectionPaneIdentityReservedTopVar), '0px');
		assert.strictEqual(modalBlock.style.top, '0px');
		assert.strictEqual(foreignStrip.isConnected, true);
	});
});
