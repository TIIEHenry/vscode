/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationError } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableMap } from '../../../../../base/common/lifecycle.js';
import { constObservable, IObservable } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ISession } from '../../../../services/sessions/common/session.js';
import { ISendRequestOptions } from '../../../../services/sessions/common/sessionsProvider.js';
import { NewChatInSessionWidget } from '../../browser/newChatInSessionWidget.js';
import { NewChatWidget } from '../../browser/newChatWidget.js';

const sendNewSession = Reflect.get(NewChatWidget.prototype, '_send') as (
	this: INewSessionSendHarness,
	query: string,
	attachedContext?: unknown[],
	background?: boolean,
) => Promise<boolean>;

const sendInSession = Reflect.get(NewChatInSessionWidget.prototype, '_send') as (
	this: IInSessionSendHarness,
	query: string,
	attachedContext?: unknown[],
	background?: boolean,
) => Promise<boolean>;

interface INewSessionSendHarness {
	readonly _session: IObservable<ISession | undefined>;
	readonly _feedbackItems: IObservable<readonly never[]>;
	readonly _workspacePicker: {
		readonly selectedFolderUri: URI | undefined;
		clearAttachedContext(): void;
		showPicker(): void;
	};
	readonly _isQuickChatComposer: IObservable<boolean>;
	readonly agentFeedbackService: { removeFeedback(resource: URI, id: string): void };
	readonly sessionsManagementService: {
		sendNewChatRequest(session: ISession, options: ISendRequestOptions): Promise<void>;
		readonly onDidSendRequest: Event<unknown>;
	};
	readonly logService: { error(message: string, ...args: unknown[]): void };
	readonly notificationService: { error(message: string): void };
	readonly _pendingBackgroundSends: DisposableMap<object>;
	readonly _store: { readonly isDisposed: boolean };
}

interface IInSessionSendHarness {
	readonly _session: IObservable<{ readonly activeChat: IObservable<unknown> } | undefined>;
	readonly sessionsManagementService: {
		sendRequest(session: unknown, chat: unknown, options: { query: string; attachedContext?: unknown; background?: boolean }): Promise<void>;
	};
	readonly sessionsService: {
		openNewChatInSession(session: unknown, options: { forceNew: boolean }): Promise<void>;
	};
	readonly logService: { error(message: string, ...args: unknown[]): void };
	readonly notificationService: { error(message: string): void };
}

suite('Composer send failure', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function newSessionHarness(sendNewChatRequest: (session: ISession, options: ISendRequestOptions) => Promise<void>): { harness: INewSessionSendHarness; errors: string[]; cleared: number } {
		const errors: string[] = [];
		let cleared = 0;
		const pending = disposables.add(new DisposableMap<object>());
		const harness: INewSessionSendHarness = {
			_session: constObservable(upcastPartial<ISession>({ workspace: constObservable(undefined) })),
			_feedbackItems: constObservable([]),
			_workspacePicker: {
				selectedFolderUri: URI.file('/workspace'),
				clearAttachedContext: () => { cleared++; },
				showPicker: () => { },
			},
			_isQuickChatComposer: constObservable(false),
			agentFeedbackService: { removeFeedback: () => { } },
			sessionsManagementService: {
				sendNewChatRequest,
				onDidSendRequest: Event.None,
			},
			logService: { error: () => { } },
			notificationService: { error: message => errors.push(message) },
			_pendingBackgroundSends: pending,
			_store: { isDisposed: false },
		};
		return { harness, errors, get cleared() { return cleared; } };
	}

	test('foreground new-session send failure notifies and keeps the draft context', async () => {
		const captured = newSessionHarness(async () => {
			throw new Error('provider down');
		});

		const sent = await sendNewSession.call(captured.harness, 'ship the fix');

		assert.strictEqual(sent, false);
		assert.strictEqual(captured.cleared, 0);
		assert.deepStrictEqual(captured.errors, ['Couldn\'t send: provider down']);
	});

	test('cancelled new-session send does not notify', async () => {
		const { harness, errors } = newSessionHarness(async () => {
			throw new CancellationError();
		});

		const sent = await sendNewSession.call(harness, 'ship the fix');

		assert.strictEqual(sent, false);
		assert.deepStrictEqual(errors, []);
	});

	test('new-session send that fails before the background call returns notifies once', async () => {
		const { harness, errors } = newSessionHarness(async () => {
			throw new Error('provider down');
		});

		const sent = await sendNewSession.call(harness, 'ship the fix', undefined, true);

		assert.strictEqual(sent, false);
		assert.deepStrictEqual(errors, ['Couldn\'t send in the background: provider down']);
	});

	test('successful new-session send does not notify', async () => {
		const captured = newSessionHarness(async () => { });

		const sent = await sendNewSession.call(captured.harness, 'ship the fix');

		assert.strictEqual(sent, true);
		assert.strictEqual(captured.cleared, 1);
		assert.deepStrictEqual(captured.errors, []);
	});

	function inSessionHarness(sendRequest: IInSessionSendHarness['sessionsManagementService']['sendRequest'], openNewChatInSession: IInSessionSendHarness['sessionsService']['openNewChatInSession'] = async () => { }): { harness: IInSessionSendHarness; errors: string[] } {
		const errors: string[] = [];
		const harness: IInSessionSendHarness = {
			_session: constObservable({ activeChat: constObservable({ resource: URI.parse('test://chat') }) }),
			sessionsManagementService: { sendRequest },
			sessionsService: { openNewChatInSession },
			logService: { error: () => { } },
			notificationService: { error: message => errors.push(message) },
		};
		return { harness, errors };
	}

	test('foreground follow-up send failure notifies', async () => {
		const { harness, errors } = inSessionHarness(async () => {
			throw new Error('chat missing');
		});

		const sent = await sendInSession.call(harness, 'follow up');

		assert.strictEqual(sent, false);
		assert.deepStrictEqual(errors, ['Couldn\'t send: chat missing']);
	});

	test('cancelled follow-up send does not notify', async () => {
		const { harness, errors } = inSessionHarness(async () => {
			throw new CancellationError();
		});

		const sent = await sendInSession.call(harness, 'follow up');

		assert.strictEqual(sent, false);
		assert.deepStrictEqual(errors, []);
	});

	test('follow-up that fails before the background send starts notifies once and does not send', async () => {
		let sendCount = 0;
		const { harness, errors } = inSessionHarness(async () => {
			sendCount++;
		}, async () => {
			throw new Error('no slot');
		});

		const sent = await sendInSession.call(harness, 'follow up', undefined, true);

		assert.strictEqual(sent, false);
		assert.strictEqual(sendCount, 0);
		assert.deepStrictEqual(errors, ['Couldn\'t send in the background: no slot']);
	});

	test('follow-up without a session does not notify', async () => {
		const { harness, errors } = inSessionHarness(async () => {
			throw new Error('should not send');
		});
		const quiet: IInSessionSendHarness = { ...harness, _session: constObservable(undefined) };

		const sent = await sendInSession.call(quiet, 'follow up');

		assert.strictEqual(sent, false);
		assert.deepStrictEqual(errors, []);
	});
});
