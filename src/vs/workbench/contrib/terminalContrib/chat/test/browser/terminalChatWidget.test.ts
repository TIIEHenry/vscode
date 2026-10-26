/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual } from 'assert';
import { DeferredPromise } from '../../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { TerminalChatWidget } from '../../browser/terminalChatWidget.js';

suite('TerminalChatWidget command delivery', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	for (const accepted of [true, false]) {
		test(`keeps the suggestion until delivery completes (accepted=${accepted})`, async () => {
			const delivery = new DeferredPromise<void>();
			const entered = new DeferredPromise<void>();
			const failure = new Error('input delivery rejected');
			const effects: string[] = [];
			// Exercise the actual public operation with controlled editor and terminal dependencies.
			const widget: TerminalChatWidget = Object.create(TerminalChatWidget.prototype);
			Object.defineProperties(widget, {
				_store: { value: { isDisposed: false } },
				_inlineChatWidget: { value: { getCodeBlockInfo: async () => ({ getValue: () => 'echo suggestion' }) } },
				_instance: { value: { isDisposed: false, runCommand: async () => { entered.complete(); return delivery.p; } } },
				_notificationService: { value: { error: (error: Error) => { effects.push(error.message); } } },
				clear: { value: () => { effects.push('cleared'); } },
			});
			const previous = errorHandler.getUnexpectedErrorHandler();
			setUnexpectedErrorHandler(() => { throw new Error('Delivery refusal must use notifications'); });
			try {
				const result = widget.acceptCommand(true);
				await entered.p;
				deepStrictEqual(effects, []);
				if (accepted) {
					delivery.complete();
				} else {
					delivery.error(failure);
				}
				await result;
				deepStrictEqual(effects, [accepted ? 'cleared' : failure.message]);
			} finally {
				setUnexpectedErrorHandler(previous);
			}
		});
	}
});
