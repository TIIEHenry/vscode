/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	syncComposerPlacement,
	updateComposerEditChrome,
	type IConversationLensComposerChromeHost,
} from './conversationLensComposerChrome.js';
import { conversationLensDockEditingMessage } from './conversationLensDockStrings.js';

suite('ConversationLensComposerChrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function flushAnimationFrames(): Promise<void> {
		return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	}

	test('turnEdit placement rAF after composer disconnect does not mount into timeline edit host', async () => {
		const composerCluster = document.createElement('div');
		const composer = document.createElement('div');
		composerCluster.appendChild(composer);
		const dockRoot = document.createElement('div');
		const prefirstHero = document.createElement('div');
		const editHost = document.createElement('div');
		document.body.append(composerCluster, dockRoot, prefirstHero, editHost);

		let editHostReady = false;
		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'turn-1',
			composer,
			composerCluster,
			dockRoot,
			prefirstHero,
			isPreFirst: () => false,
			timelineTree: {
				getTurnEditHost: (turnId: string) => (turnId === 'turn-1' && editHostReady ? editHost : undefined),
			},
		} as unknown as IConversationLensComposerChromeHost;

		try {
			syncComposerPlacement(host);
			composer.remove();
			editHostReady = true;
			await flushAnimationFrames();
			assert.strictEqual(editHost.contains(composer), false);
		} finally {
			composerCluster.remove();
			dockRoot.remove();
			prefirstHero.remove();
			editHost.remove();
		}
	});

	test('turnEdit while the edit surface is live puts a disconnected composer back in the cluster', () => {
		const composerCluster = document.createElement('div');
		const composer = document.createElement('div');
		composerCluster.appendChild(composer);
		const dockRoot = document.createElement('div');
		const prefirstHero = document.createElement('div');
		const editHost = document.createElement('div');
		document.body.append(composerCluster, dockRoot, prefirstHero, editHost);

		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'turn-1',
			composer,
			composerCluster,
			dockRoot,
			prefirstHero,
			isPreFirst: () => false,
			timelineTree: {
				getTurnEditHost: () => editHost,
			},
		} as unknown as IConversationLensComposerChromeHost;

		try {
			composer.remove();
			assert.strictEqual(composer.isConnected, false);
			syncComposerPlacement(host);
			assert.strictEqual(composerCluster.contains(composer), true);
			assert.strictEqual(composer.isConnected, true);
			assert.strictEqual(editHost.contains(composer), false);

			syncComposerPlacement(host);
			assert.strictEqual(editHost.contains(composer), true);
			assert.strictEqual(composer.parentElement, editHost);
		} finally {
			composerCluster.remove();
			dockRoot.remove();
			prefirstHero.remove();
			editHost.remove();
		}
	});

	test('turnEdit after user turn disappears hides edit chrome and skips timeline editHost placement', async () => {
		const composerCluster = document.createElement('div');
		const composer = document.createElement('div');
		composerCluster.appendChild(composer);
		const composerEditHeader = document.createElement('div');
		composerEditHeader.hidden = false;
		const composerEditTitle = document.createElement('span');
		composerEditTitle.textContent = conversationLensDockEditingMessage;
		composerEditHeader.append(composerEditTitle);
		composer.classList.add('conversation-lens-composer--edit');
		const dockRoot = document.createElement('div');
		const prefirstHero = document.createElement('div');
		const editHost = document.createElement('div');
		document.body.append(composerCluster, dockRoot, prefirstHero, editHost);

		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'turn-gone',
			composer,
			composerCluster,
			composerEditHeader,
			composerEditTitle,
			dockRoot,
			prefirstHero,
			sendButton: {
				setTitle() { },
				setAriaLabel() { },
			},
			isPreFirst: () => false,
			getBoundSessionId: () => 'sess-1',
			stubService: {
				getTurns: () => [],
			},
			timelineTree: {
				getTurnEditHost: () => editHost,
			},
		} as unknown as IConversationLensComposerChromeHost;

		try {
			updateComposerEditChrome(host);
			assert.strictEqual(composerEditHeader.hidden, true);
			assert.ok(!composer.classList.contains('conversation-lens-composer--edit'));

			syncComposerPlacement(host);
			assert.strictEqual(composerCluster.contains(composer), true);
			assert.strictEqual(editHost.contains(composer), false);
			await flushAnimationFrames();
			assert.strictEqual(editHost.contains(composer), false);
		} finally {
			composerCluster.remove();
			dockRoot.remove();
			prefirstHero.remove();
			editHost.remove();
		}
	});

	test('turnEdit when composer is disconnected restores into cluster and later mounts into editHost when reconnected', () => {
		const composerCluster = document.createElement('div');
		const composer = document.createElement('div');
		composerCluster.appendChild(composer);
		const dockRoot = document.createElement('div');
		const prefirstHero = document.createElement('div');
		const editHost = document.createElement('div');
		document.body.append(composerCluster, dockRoot, prefirstHero, editHost);

		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'turn-1',
			composer,
			composerCluster,
			dockRoot,
			prefirstHero,
			isPreFirst: () => false,
			timelineTree: {
				getTurnEditHost: (turnId: string) => (turnId === 'turn-1' ? editHost : undefined),
			},
		} as unknown as IConversationLensComposerChromeHost;

		try {
			// Disconnect composer from document
			composer.remove();
			assert.strictEqual(composer.isConnected, false);

			// Call syncComposerPlacement while disconnected
			syncComposerPlacement(host);
			assert.strictEqual(composerCluster.contains(composer), true);
			assert.strictEqual(composer.isConnected, true);
			assert.strictEqual(editHost.contains(composer), false);

			// Calling syncComposerPlacement again now that composer is connected moves it into editHost
			syncComposerPlacement(host);
			assert.strictEqual(editHost.contains(composer), true);
		} finally {
			composerCluster.remove();
			dockRoot.remove();
			prefirstHero.remove();
			editHost.remove();
		}
	});
});
