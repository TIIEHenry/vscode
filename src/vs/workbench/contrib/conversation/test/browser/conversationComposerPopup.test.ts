/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IContextViewDelegate, IContextViewService } from '../../../../../platform/contextview/browser/contextView.js';
import { toggleComposerAddContext } from '../../browser/conversationComposerAt.js';
import { IConversationLensComposerChromeHost, toggleMoreContextView, toggleTuneContextView } from '../../browser/conversationLensComposerChrome.js';

suite('Conversation composer popup dismissal', () => {
	const document = mainWindow.document;
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function mount() {
		const root = document.createElement('div');
		document.body.append(root);
		const button = () => root.appendChild(document.createElement('button'));
		const add = button(), more = button(), tune = button(), destination = button();
		const textarea = root.appendChild(document.createElement('textarea'));
		let sessionId = 's1';
		let close: (() => void) | undefined;
		let container: HTMLElement;
		const contextViewService = {
			showContextView(delegate: IContextViewDelegate) {
				close?.();
				container = root.appendChild(document.createElement('div'));
				const rendered = delegate.render(container);
				const current = () => {
					if (close !== current) { return; }
					close = undefined;
					rendered?.dispose();
					container.remove();
					delegate.onHide?.();
				};
				close = current;
				return { close: current };
			},
		} as unknown as IContextViewService;
		const host = {
			contextViewService,
			addButton: { element: add }, moreButton: { element: more }, tuneButton: { element: tune },
			dockTextarea: textarea,
			getBoundSessionId: () => sessionId,
			lastReadingWidth: 375,
			sessionConfigBySessionId: new Map(), catalogToolNames: [] as string[],
			stubService: { isEngineConnected: () => false, getSessions: () => Array.from({ length: 10 }, (_, i) => ({ id: 's' + i, title: 'Session ' + i })) },
			commandService: { executeCommand: async () => { destination.focus(); } },
		} as unknown as IConversationLensComposerChromeHost;
		disposables.add({ dispose: () => { close?.(); root.remove(); } });
		const focus = (selector: string) => {
			const item = root.querySelector<HTMLElement>(selector)!;
			item.focus();
			assert.strictEqual(document.activeElement, item, 'precondition: focus must enter the popup');
			return item;
		};
		const escape = () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
		return { host, add, more, tune, textarea, destination, focus, escape, root, setSession: (id: string) => { sessionId = id; } };
	}

	for (const selector of ['.conversation-lens-dock-add-filter', '.conversation-lens-dock-add-option']) {
		test('Add Esc restores its owner from ' + selector, () => {
			const m = mount(); toggleComposerAddContext(m.host); m.focus(selector); m.escape();
			assert.strictEqual(m.host.addContextView, undefined);
			assert.strictEqual(document.activeElement, m.add);
		});
	}

	test('More Esc restores More from a menu item', () => {
		const m = mount(); toggleMoreContextView(m.host); m.focus('.conversation-lens-dock-more-item'); m.escape();
		assert.strictEqual(document.activeElement, m.more);
	});

	test('More to Add does not restore the closed parent, and child Esc returns More', () => {
		const m = mount(); toggleMoreContextView(m.host);
		m.focus('.conversation-lens-dock-more-item').click();
		assert.notStrictEqual(document.activeElement, m.more);
		m.focus('.conversation-lens-dock-add-filter'); m.escape();
		assert.strictEqual(document.activeElement, m.more);
	});

	test('Tools child Esc returns More; Preferences action keeps its destination', () => {
		const m = mount(); m.host.catalogToolNames = ['test tool'];
		toggleTuneContextView(m.host, m.more); m.focus('.conversation-lens-dock-tune-open'); m.escape();
		assert.strictEqual(document.activeElement, m.more);
		toggleTuneContextView(m.host); m.focus('.conversation-lens-dock-tune-open').click();
		assert.strictEqual(document.activeElement, m.destination);
	});

	for (const invalid of ['hidden', 'detached', 'disabled'] as const) {
		test('Esc falls back to same composer for ' + invalid + ' owner', () => {
			const m = mount(); toggleComposerAddContext(m.host); m.focus('.conversation-lens-dock-add-filter');
			if (invalid === 'detached') { m.add.remove(); } else if (invalid === 'hidden') { m.add.hidden = true; } else { m.add.disabled = true; }
			m.escape(); assert.strictEqual(document.activeElement, m.textarea);
		});
	}

	test('Esc never restores an old owner after session changes', () => {
		const m = mount(); toggleComposerAddContext(m.host); m.focus('.conversation-lens-dock-add-filter');
		m.setSession('s2'); m.escape();
		assert.notStrictEqual(document.activeElement, m.add);
		assert.notStrictEqual(document.activeElement, m.textarea);
	});
});
