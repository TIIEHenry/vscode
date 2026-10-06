/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { syncComposerPlacement, type IConversationLensComposerChromeHost } from './conversationLensComposerChrome.js';

suite('ConversationLensComposerChrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function flushAnimationFrames(): Promise<void> {
		return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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
});
