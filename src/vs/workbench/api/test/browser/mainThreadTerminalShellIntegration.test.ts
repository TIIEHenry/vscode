/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, strictEqual } from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../base/common/errors.js';
import { DynamicListEventMultiplexer, Event } from '../../../../base/common/event.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ITerminalService, ITerminalInstance } from '../../../contrib/terminal/browser/terminal.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { MainThreadTerminalShellIntegration } from '../../browser/mainThreadTerminalShellIntegration.js';
import { SingleProxyRPCProtocol } from '../common/testRPCProtocol.js';

suite('MainThreadTerminalShellIntegration delivery', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('public void command entry reports rejection through notifications', async () => {
		const failure = new Error('input delivery rejected');
		const notified: Parameters<INotificationService['error']>[0][] = [];
		const calls: [string, boolean | undefined][] = [];
		const instance = new class extends mock<ITerminalInstance>() {
			override async runCommand(command: string, shouldExecute?: boolean): Promise<void> {
				calls.push([command, shouldExecute]);
				throw failure;
			}
		};
		const instantiation = workbenchInstantiationService(undefined, store);
		instantiation.stub(ITerminalService, {
			instances: [],
			getInstanceFromId: id => id === 42 ? instance : undefined,
			createOnInstanceEvent: <T>(getEvent: (terminal: ITerminalInstance) => Event<T>) => new DynamicListEventMultiplexer<ITerminalInstance, T>([], Event.None, Event.None, getEvent),
			createOnInstanceCapabilityEvent: () => ({ event: Event.None, dispose: () => { } }),
			onDidDisposeInstance: Event.None,
		});
		instantiation.stub(INotificationService, { error: error => { notified.push(error); } });
		const mainThread = store.add(instantiation.createInstance(MainThreadTerminalShellIntegration, SingleProxyRPCProtocol({})));
		const previous = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { throw new Error('The global unexpected error handler must not be used for delivery refusal'); });
		try {
			strictEqual(mainThread.$executeCommand(42, 'echo test'), undefined);
			strictEqual(mainThread.$executeCommand(99, 'echo absent'), undefined);
			await timeout(0);
			deepStrictEqual({ calls, notified }, { calls: [['echo test', true]], notified: [failure] });
		} finally {
			setUnexpectedErrorHandler(previous);
		}
	});
});
