/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { followUpOnExplanationChange, isExplanationFollowUpChatAllowed } from '../../../browser/chatEditing/chatEditingExplanationWidget.js';

suite('Chat editing explanation follow-up', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const file = URI.parse('file:///workspace/changed.ts');
	const range = new Range(4, 1, 6, 1);
	const session = URI.parse('chat://session/1');

	test('isExplanationFollowUpChatAllowed is true only in the Agents window', () => {
		assert.strictEqual(isExplanationFollowUpChatAllowed(false), false);
		assert.strictEqual(isExplanationFollowUpChatAllowed(undefined), false);
		assert.strictEqual(isExplanationFollowUpChatAllowed(true), true);
	});

	test('default Code window does not open a chat or attach the change', async () => {
		for (const isSessionsWindow of [false, undefined] as const) {
			const calls = recordCalls();
			const attached = await followUpOnExplanationChange({
				isSessionsWindow,
				uri: file,
				range,
				chatSessionResource: undefined,
				...calls.handlers,
			});
			assert.strictEqual(attached, false);
			assert.deepStrictEqual(calls.snapshot(), { openSession: 0, openChatView: 0, addContext: 0 });
		}
	});

	test('default Code window does not open the owning session', async () => {
		const calls = recordCalls();
		const attached = await followUpOnExplanationChange({
			isSessionsWindow: false,
			uri: file,
			range,
			chatSessionResource: session,
			...calls.handlers,
		});
		assert.strictEqual(attached, false);
		assert.deepStrictEqual(calls.snapshot(), { openSession: 0, openChatView: 0, addContext: 0 });
	});

	test('Agents window opens the owning session and attaches the range', async () => {
		const calls = recordCalls();
		const attached = await followUpOnExplanationChange({
			isSessionsWindow: true,
			uri: file,
			range,
			chatSessionResource: session,
			...calls.handlers,
		});
		assert.strictEqual(attached, true);
		assert.deepStrictEqual(calls.snapshot(), { openSession: 1, openChatView: 0, addContext: 1 });
		assert.strictEqual(calls.attached[0], calls.entry);
		assert.strictEqual(calls.openedSession?.toString(), session.toString());
	});

	test('Agents window does not attach when the opened session is a different chat', async () => {
		const calls = recordCalls(URI.parse('chat://session/other'));
		const attached = await followUpOnExplanationChange({
			isSessionsWindow: true,
			uri: file,
			range,
			chatSessionResource: session,
			...calls.handlers,
		});
		assert.strictEqual(attached, false);
		assert.deepStrictEqual(calls.snapshot(), { openSession: 1, openChatView: 0, addContext: 0 });
	});

	test('Agents window without a session opens the chat view and attaches the range', async () => {
		const calls = recordCalls();
		const attached = await followUpOnExplanationChange({
			isSessionsWindow: true,
			uri: file,
			range,
			chatSessionResource: undefined,
			...calls.handlers,
		});
		assert.strictEqual(attached, true);
		assert.deepStrictEqual(calls.snapshot(), { openSession: 0, openChatView: 1, addContext: 1 });
		assert.strictEqual(calls.attached[0], calls.entry);
	});

	test('Agents window without a session does not attach when no chat widget is focused', async () => {
		const calls = recordCalls(session, false);
		const attached = await followUpOnExplanationChange({
			isSessionsWindow: true,
			uri: file,
			range,
			chatSessionResource: undefined,
			...calls.handlers,
		});
		assert.strictEqual(attached, false);
		assert.deepStrictEqual(calls.snapshot(), { openSession: 0, openChatView: 1, addContext: 0 });
	});
});

function recordCalls(openedSessionResource: URI = URI.parse('chat://session/1'), hasFocusedWidget: boolean = true) {
	const attached: unknown[] = [];
	const entry = { kind: 'file', id: 'changed.ts' };
	let openSession = 0;
	let openChatView = 0;
	let openedSession: URI | undefined;
	const widget = {
		viewModel: { sessionResource: openedSessionResource },
		attachmentModel: {
			asFileVariableEntry: () => entry,
			addContext: (item: unknown) => { attached.push(item); },
		},
	};
	return {
		attached,
		entry,
		get openedSession() { return openedSession; },
		handlers: {
			openSession: async (sessionResource: URI) => {
				openSession++;
				openedSession = sessionResource;
				return widget;
			},
			openChatView: async () => {
				openChatView++;
			},
			getLastFocusedWidget: () => hasFocusedWidget ? widget : undefined,
		},
		snapshot: () => ({ openSession, openChatView, addContext: attached.length }),
	};
}
