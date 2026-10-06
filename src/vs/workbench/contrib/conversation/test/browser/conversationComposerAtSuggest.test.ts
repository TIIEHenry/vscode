/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { KeyCode } from '../../../../../base/common/keyCodes.js';
import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IConversationSessionChatService } from '../../common/conversationSessionChat.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { IComposerAtHost, noteComposerAtInput, onComposerAtKeyDown, wireComposerAt } from '../../browser/conversationComposerAt.js';

suite('Conversation composer @ suggest', () => {

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
		textarea.setAttribute('aria-label', 'Message');
		const host = {
			composerRefRow: document.createElement('div'),
			composerAtSuggest: document.createElement('div'),
			composerRefResources: [],
			composerPolicy: 'compose' as const,
			dockTextarea: textarea,
			stubService: {
				getSessions: () => [
					{ id: 's1', title: 'Alpha' },
					{ id: 's2', title: 'Beta' },
				],
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

	function typeAt(textarea: HTMLTextAreaElement, host: IComposerAtHost, value: string): void {
		textarea.value = value;
		textarea.selectionStart = value.length;
		textarea.selectionEnd = value.length;
		noteComposerAtInput(host);
	}

	test('composer at listbox active descendant follows the highlighted session', () => {
		const { host, textarea } = mount();
		typeAt(textarea, host, '@');

		const options = [...host.composerAtSuggest.querySelectorAll<HTMLElement>('[role="option"]')];
		assert.deepStrictEqual(options.map(option => option.textContent), ['Alpha', 'Beta']);
		assert.strictEqual(options[0].tabIndex, -1);
		assert.strictEqual(options[0].getAttribute('aria-selected'), 'true');
		assert.strictEqual(host.composerAtSuggest.getAttribute('role'), 'listbox');
		assert.strictEqual(host.composerAtSuggest.getAttribute('aria-label'), 'Matching sessions');
		assert.strictEqual(textarea.getAttribute('role'), 'combobox');
		assert.strictEqual(textarea.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(textarea.getAttribute('aria-autocomplete'), 'list');
		assert.strictEqual(textarea.getAttribute('aria-controls'), host.composerAtSuggest.id);
		assert.ok(options[0].id);
		assert.strictEqual(textarea.getAttribute('aria-activedescendant'), options[0].id);
		assert.strictEqual(host.composerAtSuggest.getAttribute('aria-activedescendant'), options[0].id);
		assert.strictEqual(textarea.getAttribute('aria-label'), 'Message');

		const down = key(KeyCode.DownArrow);
		assert.strictEqual(onComposerAtKeyDown(host, down), true);
		assert.strictEqual(down.prevented, true);
		const next = [...host.composerAtSuggest.querySelectorAll<HTMLElement>('[role="option"]')];
		assert.strictEqual(next[1].getAttribute('aria-selected'), 'true');
		assert.strictEqual(next[0].getAttribute('aria-selected'), 'false');
		assert.strictEqual(textarea.getAttribute('aria-activedescendant'), next[1].id);
		assert.strictEqual(host.composerAtSuggest.getAttribute('aria-activedescendant'), next[1].id);

		const up = key(KeyCode.UpArrow);
		assert.strictEqual(onComposerAtKeyDown(host, up), true);
		assert.strictEqual(up.prevented, true);
		assert.strictEqual(textarea.getAttribute('aria-activedescendant'), host.composerAtSuggest.querySelector('[role="option"]')?.id);
	});

	test('open composer at list with no matches swallows arrows and clears on escape', () => {
		const { host, textarea } = mount();
		typeAt(textarea, host, '@zzz');

		const empty = host.composerAtSuggest.querySelector('.conversation-composer-at-suggest-empty');
		assert.strictEqual(empty?.textContent, 'No matching sessions');
		assert.strictEqual(host.composerAtSuggest.querySelector('[role="option"]'), null);
		assert.strictEqual(textarea.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(textarea.getAttribute('aria-activedescendant'), null);
		assert.strictEqual(host.composerAtSuggest.getAttribute('aria-activedescendant'), null);
		assert.strictEqual(textarea.getAttribute('aria-describedby'), empty?.id ?? '');

		const up = key(KeyCode.UpArrow);
		assert.strictEqual(onComposerAtKeyDown(host, up), true);
		assert.strictEqual(up.prevented, true);
		assert.strictEqual(textarea.value, '@zzz');

		const escape = key(KeyCode.Escape);
		assert.strictEqual(onComposerAtKeyDown(host, escape), true);
		assert.strictEqual(host.composerAtSuggest.hidden, true);
		assert.strictEqual(textarea.getAttribute('role'), null);
		assert.strictEqual(textarea.getAttribute('aria-expanded'), null);
		assert.strictEqual(textarea.getAttribute('aria-controls'), null);
		assert.strictEqual(textarea.getAttribute('aria-autocomplete'), null);
		assert.strictEqual(textarea.getAttribute('aria-activedescendant'), null);
		assert.strictEqual(textarea.getAttribute('aria-describedby'), null);
		assert.strictEqual(onComposerAtKeyDown(host, key(KeyCode.UpArrow)), false);
	});

	test('enter on an empty composer at list does not swallow send or newline', () => {
		const { host, textarea } = mount();
		typeAt(textarea, host, '@zzz');

		const enter = key(KeyCode.Enter);
		assert.strictEqual(onComposerAtKeyDown(host, enter), false);
		assert.strictEqual(enter.prevented, false);
		assert.strictEqual(textarea.value, '@zzz');
		assert.strictEqual(host.composerAtSuggest.hidden, false);
		assert.strictEqual(host.composerRefResources.length, 0);
	});

	test('enter selects the highlighted session and does not send the query', () => {
		const { host, textarea } = mount();
		typeAt(textarea, host, '@');

		const down = key(KeyCode.DownArrow);
		assert.strictEqual(onComposerAtKeyDown(host, down), true);

		const enter = key(KeyCode.Enter);
		assert.strictEqual(onComposerAtKeyDown(host, enter), true);
		assert.strictEqual(enter.prevented, true);
		assert.strictEqual(textarea.value, '');
		assert.strictEqual(host.composerRefResources.length, 1);
		assert.ok(host.composerRefResources[0].includes('s2'));
		assert.strictEqual(host.composerAtSuggest.hidden, true);
		assert.strictEqual(textarea.getAttribute('role'), null);
	});

	test('composer at highlight follows the session when roster order changes', () => {
		let sessions = [
			{ id: 's1', title: 'Alpha' },
			{ id: 's2', title: 'Beta' },
		];
		const { host, textarea } = mount();
		(host.stubService as { getSessions: () => typeof sessions }).getSessions = () => sessions;

		typeAt(textarea, host, '@');
		assert.strictEqual(onComposerAtKeyDown(host, key(KeyCode.DownArrow)), true);
		assert.strictEqual(
			[...host.composerAtSuggest.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.getAttribute('aria-selected') === 'true')?.textContent,
			'Beta',
		);

		sessions = [
			{ id: 's2', title: 'Beta' },
			{ id: 's1', title: 'Alpha' },
		];
		noteComposerAtInput(host);

		const active = [...host.composerAtSuggest.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.getAttribute('aria-selected') === 'true');
		assert.strictEqual(active?.textContent, 'Beta');
		assert.strictEqual(textarea.getAttribute('aria-activedescendant'), active?.id);
	});
});
