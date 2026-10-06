/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { IConversationSessionChatService } from '../common/conversationSessionChat.js';
import { IComposerAtHost, noteComposerAtInput, onComposerAtKeyDown, wireComposerAt } from './conversationComposerAt.js';
import { IConversationRosterService } from './conversationStubService.js';

suite('Conversation composer @ (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function key(keyCode: KeyCode): { keyCode: number; preventDefault(): void; prevented: boolean } {
		const event = {
			keyCode,
			prevented: false,
			preventDefault() {
				this.prevented = true;
			},
		};
		return event;
	}

	function mount(): { host: IComposerAtHost; textarea: HTMLTextAreaElement } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IHoverService, {
			setupManagedHover: () => ({ dispose() { } }),
		} as unknown as IHoverService);
		instantiationService.stub(IConversationSessionChatService, {
			getCatalog: () => [],
			onDidChangeCatalog: Event.None,
		} as unknown as IConversationSessionChatService);
		const textarea = document.createElement('textarea');
		const host = {
			composerRefRow: document.createElement('div'),
			composerAtSuggest: document.createElement('div'),
			composerRefResources: [],
			composerPolicy: 'compose' as const,
			dockTextarea: textarea,
			stubService: {
				getSessions: () => [{ id: 's1', title: 'Alpha' }],
				onDidChangeSession: Event.None,
			} as unknown as IConversationRosterService,
			instantiationService,
			getBoundSessionId: () => 's1',
			register: <T extends IDisposable>(disposable: T) => store.add(disposable),
			writeComposerDraft: () => { },
			updateSendEnabled: () => { },
			activateConversationLink: async () => { },
		};
		wireComposerAt(host);
		return { host, textarea };
	}

	test('escape keeps the @ list closed after keyup refresh', () => {
		const { host, textarea } = mount();
		const value = '@';
		textarea.value = value;
		textarea.selectionStart = value.length;
		textarea.selectionEnd = value.length;
		noteComposerAtInput(host);
		assert.strictEqual(host.composerAtSuggest.hidden, false);

		const escape = key(KeyCode.Escape);
		assert.strictEqual(onComposerAtKeyDown(host, escape), true);
		assert.strictEqual(host.composerAtSuggest.hidden, true);

		noteComposerAtInput(host);
		assert.strictEqual(host.composerAtSuggest.hidden, true);
		assert.strictEqual(textarea.getAttribute('aria-expanded'), null);
		assert.strictEqual(onComposerAtKeyDown(host, key(KeyCode.Enter)), false);
		assert.strictEqual(host.composerRefResources.length, 0);
	});

	test('tab closes the open composer at list and keyup does not reopen it', () => {
		const { host, textarea } = mount();
		const value = '@';
		textarea.value = value;
		textarea.selectionStart = value.length;
		textarea.selectionEnd = value.length;
		noteComposerAtInput(host);
		assert.strictEqual(host.composerAtSuggest.hidden, false);

		assert.strictEqual(onComposerAtKeyDown(host, key(KeyCode.Tab)), false);
		assert.strictEqual(host.composerAtSuggest.hidden, true);
		assert.strictEqual(textarea.getAttribute('aria-expanded'), null);

		textarea.dispatchEvent(new KeyboardEvent('keyup', { keyCode: KeyCode.Tab, bubbles: true }));
		assert.strictEqual(host.composerAtSuggest.hidden, true);
		assert.strictEqual(textarea.getAttribute('aria-expanded'), null);
	});
});
