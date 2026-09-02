/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $, append } from '../../../../../base/browser/dom.js';
import { KeyCode } from '../../../../../base/common/keyCodes.js';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { IWebviewElement, IWebviewService } from '../../../webview/browser/webview.js';
import { ConversationVisualizeOverlay } from '../../browser/conversationVisualizeOverlay.js';

suite('ConversationVisualizeOverlay', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountOverlay(): { overlay: ConversationVisualizeOverlay; container: HTMLElement } {
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
			createWebviewElement: () => {
				const element = document.createElement('div');
				element.setAttribute('data-mermaid-host', 'stub');
				return {
					mountTo(parent: HTMLElement) {
						parent.appendChild(element);
					},
					setHtml() { },
					postMessage() {
						return Promise.resolve(true);
					},
					onDidWheel: Event.None,
					onFatalError: Event.None,
					intrinsicContentSize: { get: () => undefined },
					dispose() { },
				} as unknown as IWebviewElement;
			},
		};

		const overlay = store.add(new ConversationVisualizeOverlay(layoutService));
		overlay.open({
			source: 'flowchart TD\n  A-->B',
			title: 'Stub overlay',
			extensionInfo: {
				extensionLocation: URI.file('/tmp/mermaid'),
				extensionId: new ExtensionIdentifier('vscode.mermaid-markdown-features'),
			},
			targetWindow: mainWindow,
			webviewService,
		});

		return { overlay, container };
	}

	test('open renders dialog chrome with mermaid host stub', () => {
		const { container } = mountOverlay();
		const dialog = container.querySelector('[role="dialog"][aria-modal="true"]');
		assert.ok(dialog);
		assert.ok(container.querySelector('.conversation-visualize-overlay-title')?.textContent?.includes('Stub overlay'));
		assert.ok(container.querySelector('[data-mermaid-host="stub"]'));
	});

	test('Escape closes overlay', () => {
		const { overlay, container } = mountOverlay();
		assert.ok(overlay.isOpen());

		const dialog = container.querySelector('.conversation-visualize-overlay') as HTMLElement;
		dialog.dispatchEvent(new KeyboardEvent('keydown', { keyCode: KeyCode.Escape, bubbles: true }));
		assert.strictEqual(overlay.isOpen(), false);
		assert.strictEqual(container.querySelector('[role="dialog"]'), null);
	});

	test('Close button disposes overlay', () => {
		const { overlay, container } = mountOverlay();
		const closeButton = container.querySelector('.conversation-visualize-overlay-close .monaco-button') as HTMLButtonElement | null;
		assert.ok(closeButton);
		closeButton!.click();
		assert.strictEqual(overlay.isOpen(), false);
	});

	test('Reset button is present when webview host mounts', () => {
		const { container } = mountOverlay();
		const resetButton = container.querySelector('.conversation-visualize-overlay-reset .monaco-button') as HTMLButtonElement | null;
		assert.ok(resetButton);
		assert.notStrictEqual(resetButton!.getAttribute('aria-disabled'), 'true');
	});
});
