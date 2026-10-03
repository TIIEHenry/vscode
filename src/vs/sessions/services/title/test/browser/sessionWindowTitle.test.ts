/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { observableValue } from '../../../../../base/common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getUntitledSessionTitle } from '../../../sessions/common/session.js';
import { AGENTS_WINDOW_TITLE, formatSessionWindowTitle, IWindowTitleTarget, SessionWindowTitle, sessionWindowTitleSeparator } from '../../browser/sessionWindowTitle.js';

suite('Session window title', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('blank titles use the untitled fallback and leaving a session drops the old name', () => {
		assert.strictEqual(formatSessionWindowTitle(undefined), AGENTS_WINDOW_TITLE);
		assert.strictEqual(formatSessionWindowTitle({ title: '   ', isQuickChat: false }), `${getUntitledSessionTitle(false)}${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`);
		assert.strictEqual(formatSessionWindowTitle({ title: '\n', isQuickChat: true }), `${getUntitledSessionTitle(true)}${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`);
		assert.strictEqual(formatSessionWindowTitle({ title: '  Fix auth  ', isQuickChat: false }), `Fix auth${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`);
	});

	test('document title follows the active session and does not keep the previous name', () => {
		const title = observableValue('sessionTitle', '   ');
		const isQuickChat = observableValue('isQuickChat', false);
		const active = observableValue<{ title: typeof title; isQuickChat: typeof isQuickChat } | undefined>('activeSession', { title, isQuickChat });
		const main = fakeWindow('Agents');
		const binder = new SessionWindowTitle(active, main);
		try {
			const untitled = `${getUntitledSessionTitle(false)}${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`;
			assert.strictEqual(main.document.title, untitled);

			title.set('Fix auth', undefined);
			assert.strictEqual(main.document.title, `Fix auth${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`);

			title.set('  ', undefined);
			isQuickChat.set(true, undefined);
			assert.strictEqual(main.document.title, `${getUntitledSessionTitle(true)}${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`);

			const otherTitle = observableValue('otherTitle', 'Other');
			active.set({ title: otherTitle, isQuickChat: observableValue('otherQuick', false) }, undefined);
			assert.strictEqual(main.document.title, `Other${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`);

			const auxiliary = fakeWindow(`Fix auth${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`);
			binder.bind(auxiliary);
			assert.strictEqual(auxiliary.document.title, `Other${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`);

			main.document.title = 'stale editor';
			binder.reapply();
			assert.strictEqual(main.document.title, `Other${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`);

			active.set(undefined, undefined);
			assert.strictEqual(main.document.title, AGENTS_WINDOW_TITLE);
			assert.strictEqual(auxiliary.document.title, AGENTS_WINDOW_TITLE);

			binder.unbind(main);
			binder.unbind(auxiliary);
			active.set({ title: observableValue('returnTitle', 'Return'), isQuickChat: observableValue('returnQuick', false) }, undefined);
			assert.strictEqual(main.document.title, `Return${sessionWindowTitleSeparator}${AGENTS_WINDOW_TITLE}`);
			assert.strictEqual(auxiliary.document.title, AGENTS_WINDOW_TITLE);
		} finally {
			binder.dispose();
		}
	});
});

function fakeWindow(title: string): IWindowTitleTarget {
	return { document: { title } };
}
