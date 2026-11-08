/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore, IDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextMenuService, IContextViewService } from '../../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { beginSessionTitleEdit, mountLensTablist, mountSessionBar, updateSessionTitle, formatSessionSwitchMeta, sessionSwitcherRows, type IConversationLensSessionBarHost } from '../../browser/conversationLensSessionBar.js';
import { conversationLensSessionBarTitleEmpty } from '../../browser/conversationLensSessionBarStrings.js';
import { createConversationLensAriaId } from '../../browser/conversationLensProjection.js';
import type { ConversationStubSession } from '../../browser/conversationStubModel.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';

suite('ConversationLensSessionBar', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('compact-capable lens tabs retain complete accessible names and hide decorative icons', () => {
		const listeners: { dispose(): void }[] = [];
		const host = { register: <T extends { dispose(): void }>(d: T) => { listeners.push(d); return d; }, setLensId: () => { }, handleLensTablistKeyDown: () => { } } as unknown as IConversationLensSessionBarHost;
		try {
			mountLensTablist(host, document.createElement('div'));
			for (const tab of [host.lensTabConversation, host.lensTabTrajectory]) {
				assert.strictEqual(tab.getAttribute('role'), 'tab');
				assert.strictEqual(tab.getAttribute('aria-label'), tab.textContent);
				assert.strictEqual(tab.title, tab.textContent);
				assert.strictEqual(tab.firstElementChild?.getAttribute('aria-hidden'), 'true');
			}
		} finally {
			listeners.forEach(d => d.dispose());
		}
	});

	test('lens aria ids are unique per mounted lens', () => {
		assert.notStrictEqual(createConversationLensAriaId(), createConversationLensAriaId());
	});

	function titleHost(options: {
		boundSessionId: string;
		sessions: { id: string; title: string }[];
		activeSession: { id: string; title: string };
		initialTitle?: string;
		uaConnection?: {
			getConnectionPhase: () => { kind: string; path?: string };
			getConnectionSnapshot: () => { pairingPending: boolean };
		};
	}): IConversationLensSessionBarHost {
		const sessionTitleButton = document.createElement('button');
		sessionTitleButton.textContent = options.initialTitle ?? 'Bound title';
		const sessionTitleLive = document.createElement('span');
		const sessionTitleInput = document.createElement('input');
		sessionTitleInput.hidden = true;
		return {
			getBoundSessionId: () => options.boundSessionId,
			sessionTitleButton,
			sessionTitleLive,
			sessionTitleInput,
			sessionTitleEditing: false,
			sessionTitleEditSnapshot: '',
			stubService: {
				getSessions: () => options.sessions,
				getActiveSession: () => options.activeSession,
			},
			...(options.uaConnection !== undefined ? { uaConnection: options.uaConnection } : {}),
		} as unknown as IConversationLensSessionBarHost;
	}

	test('updateSessionTitle does not borrow active session title when bound session left roster', () => {
		const host = titleHost({
			boundSessionId: 'bound-gone',
			sessions: [{ id: 'active-only', title: 'Active title' }],
			activeSession: { id: 'active-only', title: 'Active title' },
			initialTitle: 'Still bound',
		});

		updateSessionTitle(host);

		assert.strictEqual(host.sessionTitleButton.textContent, 'Still bound');
		assert.strictEqual(host.sessionTitleLive.textContent, '');
	});

	test('beginSessionTitleEdit does not open editor when bound session left roster', () => {
		const host = titleHost({
			boundSessionId: 'bound-gone',
			sessions: [{ id: 'active-only', title: 'Active title' }],
			activeSession: { id: 'active-only', title: 'Active title' },
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
		});
		host.stubService.isEngineConnected = () => true;
		host.stubService.isEngineSessionReady = () => true;

		beginSessionTitleEdit(host);

		assert.strictEqual(host.sessionTitleEditing, false);
		assert.ok(host.sessionTitleInput.hidden);
	});

	function mountBar(stubService: ConversationStubService): { host: IConversationLensSessionBarHost; switched: string[] } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const connection = createConversationConnectionTestStub();
		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const disposables = store.add(new DisposableStore());
		const barHost = document.createElement('div');
		barHost.classList.add('monaco-workbench');
		document.body.appendChild(barHost);
		disposables.add(toDisposable(() => barHost.remove()));
		const switched: string[] = [];
		const host = {
			isDisposed: false,
			lensAriaId: createConversationLensAriaId(),
			readingColumn: document.createElement('div'),
			dockTextarea: document.createElement('textarea'),
			composerPolicy: 'compose',
			composeDraftSnapshot: '',
			sessionTitleEditing: false,
			sessionTitleEditSnapshot: '',
			suppressSessionSelect: false,
			sessionMoreContextView: undefined,
			stubService,
			uaConnection: connection,
			dialogService: instantiationService.get(IDialogService),
			contextViewService: instantiationService.get(IContextViewService),
			contextMenuService: instantiationService.get(IContextMenuService),
			configurationService: instantiationService.get(IConfigurationService),
			instantiationService,
			visualizeOverlay: { close: () => { } },
			register: <T extends IDisposable>(disposable: T) => disposables.add(disposable),
			getBoundSessionId: () => stubService.getActiveSessionId(),
			listSessionId: () => stubService.getActiveSessionId(),
			switchLeafSession: async (sessionId: string) => { switched.push(sessionId); },
			writeComposerDraft: () => { },
			setInputMaximized: () => { },
			showPostFailure: () => { },
			handleLensTablistKeyDown: () => { },
			setLensId: () => { },
		} as unknown as IConversationLensSessionBarHost;
		mountSessionBar(host, barHost, { omitLensTablist: true });
		updateSessionTitle(host);
		return { host, switched };
	}

	function keydown(key: string, keyCode: number, target: Element | null = document.activeElement): void {
		target!.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true }));
	}

	function morePopup(): HTMLElement | null {
		return document.querySelector('.conversation-lens-dock-more-popup');
	}

	test('session More menu focuses the first item, moves with arrows and returns focus to the button', () => {
		const stubService = store.add(new ConversationStubService());
		const { host } = mountBar(stubService);
		const moreButton = host.sessionMoreButton.element;

		moreButton.click();
		const items = [...morePopup()!.querySelectorAll<HTMLButtonElement>('.conversation-lens-dock-more-item')];
		const opened = items.indexOf(document.activeElement as HTMLButtonElement);
		keydown('ArrowDown', 40);
		const down = items.indexOf(document.activeElement as HTMLButtonElement);
		keydown('ArrowUp', 38);
		keydown('ArrowUp', 38);
		const wrapped = items.indexOf(document.activeElement as HTMLButtonElement);
		keydown('Escape', 27);
		const afterEscape = { open: !!morePopup(), buttonFocused: document.activeElement === moreButton };

		moreButton.click();
		const current = morePopup()!.querySelector<HTMLButtonElement>('.conversation-lens-session-more-session[aria-checked="true"]')!;
		current.focus();
		current.click();
		const afterPick = { open: !!morePopup(), buttonFocused: document.activeElement === moreButton };

		assert.deepStrictEqual({ opened, down, wrapped, afterEscape, afterPick }, {
			opened: 0,
			down: 1,
			wrapped: items.length - 1,
			afterEscape: { open: false, buttonFocused: true },
			afterPick: { open: false, buttonFocused: true },
		});
	});

	test('session More menu rows follow the Sessions list order with muted meta and a check on the current session', () => {
		const stubService = store.add(new ConversationStubService());
		const [older, newer] = stubService.getSessions();
		older.lastAccessedAt = Date.now() - 60_000;
		newer.lastAccessedAt = Date.now() - 1_000;
		stubService.switchSession(older.id);
		const { host } = mountBar(stubService);

		host.sessionMoreButton.element.click();
		const rows = [...morePopup()!.querySelectorAll<HTMLElement>('.conversation-lens-session-more-session')].map(row => ({
			title: row.querySelector('.conversation-lens-session-more-session-title')?.textContent,
			meta: !!row.querySelector('.conversation-lens-session-more-session-meta')?.textContent,
			role: row.getAttribute('role'),
			checked: row.getAttribute('aria-checked'),
			check: !!row.querySelector('.conversation-lens-session-more-session-check.codicon-check'),
		}));
		keydown('Escape', 27);

		assert.deepStrictEqual(rows, [
			{ title: newer.title, meta: true, role: 'menuitemradio', checked: 'false', check: false },
			{ title: older.title, meta: true, role: 'menuitemradio', checked: 'true', check: true },
		]);
	});

	test('empty or failed rename keeps the editor open with the typed text and says why beside it', () => {
		const stubService = store.add(new class extends ConversationStubService {
			override renameSession(): boolean { return false; }
		}());
		const { host } = mountBar(stubService);
		const errorText = () => host.sessionTitleInput.parentElement!.querySelector<HTMLElement>('.conversation-lens-session-title-error');
		const snapshot = () => ({
			editing: host.sessionTitleEditing,
			inputHidden: host.sessionTitleInput.hidden,
			value: host.sessionTitleInput.value,
			invalid: host.sessionTitleInput.getAttribute('aria-invalid'),
			error: errorText()?.hidden === false ? errorText()!.textContent : undefined,
		});

		host.sessionTitleButton.click();
		host.sessionTitleInput.value = '   ';
		keydown('Enter', 13, host.sessionTitleInput);
		const empty = snapshot();
		host.sessionTitleInput.value = 'Renamed';
		host.sessionTitleInput.dispatchEvent(new Event('input'));
		const typing = snapshot();
		keydown('Enter', 13, host.sessionTitleInput);
		const failed = snapshot();
		keydown('Escape', 27, host.sessionTitleInput);
		const cancelled = snapshot();

		assert.deepStrictEqual({ empty, typing, failed, cancelled }, {
			empty: { editing: true, inputHidden: false, value: '   ', invalid: 'true', error: conversationLensSessionBarTitleEmpty },
			typing: { editing: true, inputHidden: false, value: 'Renamed', invalid: null, error: undefined },
			failed: { editing: true, inputHidden: false, value: 'Renamed', invalid: 'true', error: 'Could not rename the session.' },
			cancelled: { editing: false, inputHidden: true, value: stubService.getActiveSession().title, invalid: null, error: undefined },
		});
	});

	suite('formatSessionSwitchMeta', () => {
		test('returns undefined for undefined session', () => {
			assert.strictEqual(formatSessionSwitchMeta(undefined), undefined);
		});

		test('returns 1 message when turnCount is 1', () => {
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 1 };
			assert.strictEqual(formatSessionSwitchMeta(session), '1 message');
		});

		test('returns N messages when turnCount > 1', () => {
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 4 };
			assert.strictEqual(formatSessionSwitchMeta(session), '4 messages');
		});

		test('prioritizes turnCount over lastAccessedAt', () => {
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 3, lastAccessedAt: Date.now() - 60_000 };
			assert.strictEqual(formatSessionSwitchMeta(session), '3 messages');
		});

		test('falls back to lastAccessedAt when turnCount is 0', () => {
			const now = Date.now();
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 0, lastAccessedAt: now - 120_000 };
			assert.strictEqual(formatSessionSwitchMeta(session), '2 mins ago');
		});

		test('falls back to lastAccessedAt when turnCount is undefined and turns are empty', () => {
			const now = Date.now();
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], lastAccessedAt: now - 3600_000 };
			assert.strictEqual(formatSessionSwitchMeta(session), '1 hr ago');
		});

		test('converts seconds timestamp to milliseconds for relative time', () => {
			const nowSeconds = Math.floor(Date.now() / 1000);
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 0, lastAccessedAt: nowSeconds - 300 };
			assert.strictEqual(formatSessionSwitchMeta(session), '5 mins ago');
		});

		test('returns No messages when both turnCount and lastAccessedAt are 0 or empty', () => {
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 0, lastAccessedAt: 0 };
			assert.strictEqual(formatSessionSwitchMeta(session), 'No messages');
		});

		test('numbers only later rows that share a title and detail', () => {
			const rows = sessionSwitcherRows([
				{ id: 'a', title: 'Untitled session', turns: [], turnCount: 0, lastAccessedAt: 0 },
				{ id: 'b', title: 'Untitled session', turns: [], turnCount: 0, lastAccessedAt: 0 },
				{ id: 'c', title: 'Visualize', turns: [], turnCount: 2 },
			]);
			assert.deepStrictEqual(rows.map(row => row.label), ['Untitled session', 'Untitled session (2)', 'Visualize']);
			assert.deepStrictEqual(rows.map(row => row.detail), ['No messages', 'No messages', '2 messages']);
		});

		test('uses turns.length when turnCount is undefined and turns exist', () => {
			const session: ConversationStubSession = {
				id: 's1',
				title: 'Test',
				turns: [{ id: 't1', kind: 'user', text: 'Hi' }, { id: 't2', kind: 'assistant', text: 'Hello' }],
			};
			assert.strictEqual(formatSessionSwitchMeta(session), '2 messages');
		});
	});
});
