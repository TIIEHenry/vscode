/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $, append } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import { ConversationVisualizeOverlay } from './conversationVisualizeOverlay.js';
import { URI } from '../../../../base/common/uri.js';

suite('ConversationVisualizeOverlay (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('open after dispose does not mount overlay chrome', () => {
		const container = append(document.body, $('.conversation-visualize-overlay-test-root'));
		store.add({ dispose: () => container.remove() });

		const layoutService = {
			_serviceBrand: undefined,
			getContainer: () => container,
		} as unknown as ILayoutService;

		const webviewService: IWebviewService = {
			_serviceBrand: undefined,
			activeWebview: undefined,
			webviews: [],
			onDidChangeActiveWebview: Event.None,
			createWebviewOverlay: () => { throw new Error('not used'); },
			createWebviewElement: () => { throw new Error('not used'); },
		};

		const openOptions = {
			source: 'flowchart TD\n  A-->B',
			title: 'Disposed guard',
			extensionInfo: {
				extensionLocation: URI.file('/tmp/mermaid'),
				extensionId: new ExtensionIdentifier('vscode.mermaid-markdown-features'),
			},
			targetWindow: mainWindow,
			webviewService,
			host: container,
		};

		const overlay = new ConversationVisualizeOverlay(layoutService);
		overlay.open(openOptions);
		assert.ok(overlay.isOpen());
		overlay.dispose();

		overlay.open(openOptions);
		assert.strictEqual(overlay.isOpen(), false);
		assert.strictEqual(container.querySelector('.conversation-visualize-overlay[role="dialog"]'), null);
	});
});
