/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, strictEqual, rejects } from 'assert';
import { runWithFakedTimers } from '../../../../../../base/test/common/timeTravelScheduler.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { toDisposable } from '../../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import type { ITerminalLogService } from '../../../../../../platform/terminal/common/terminal.js';
import { BasicExecuteStrategy } from '../../browser/executeStrategy/basicExecuteStrategy.js';
import type { ITerminalInstance } from '../../../../terminal/browser/terminal.js';
import type { ICommandDetectionCapability } from '../../../../../../platform/terminal/common/capabilities/capabilities.js';

function createLogService(): ITerminalLogService {
	return new class extends NullLogService { readonly _logBrand = undefined; };
}

suite('BasicExecuteStrategy', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('completes when terminal process exits without shell integration sequences', async () => {
		const onCommandFinishedEmitter = new Emitter<{ getOutput(): string; exitCode: number }>();
		const onExitEmitter = new Emitter<number | undefined>();

		const marker = {
			line: 0,
			dispose: () => { },
			onDispose: Event.None,
		};
		const xterm = {
			raw: {
				registerMarker: () => marker,
				buffer: {
					active: {},
					alternate: {},
					onBufferChange: () => toDisposable(() => { }),
				},
				getContentsAsText: () => 'some output',
			}
		};
		const instance = {
			xtermReadyPromise: Promise.resolve(xterm),
			onData: Event.None,
			onDisposed: Event.None,
			onExit: onExitEmitter.event,
			sendText: async () => {
				// Simulate process exiting without firing onCommandFinished
				queueMicrotask(() => onExitEmitter.fire(1));
				return true;
			},
		} as unknown as ITerminalInstance;
		const commandDetection = {
			onCommandFinished: onCommandFinishedEmitter.event,
		} as unknown as ICommandDetectionCapability;
		const strategy = store.add(new BasicExecuteStrategy(
			instance,
			() => false,
			commandDetection,
			new TestConfigurationService(),
			createLogService(),
		));

		const result = await strategy.execute('exit 1', CancellationToken.None);

		strictEqual(result.exitCode, 1);
	});

	for (const isExecuting of [false, true]) {
		test(`does not send a command when clearing pending input is dropped (executing=${isExecuting})`, () => runWithFakedTimers({ useFakeTimers: true }, async () => {
			const sent: string[] = [];
			const instance = {
				xtermReadyPromise: Promise.resolve({ raw: { buffer: { active: {}, alternate: {}, onBufferChange: Event.None }, registerMarker: () => ({ line: 0, onDispose: Event.None, dispose: () => { } }) } }),
				onData: Event.None,
				onDisposed: Event.None,
				onExit: Event.None,
				sendText: async (text: string) => {
					sent.push(text);
					return false;
				},
			} as unknown as ITerminalInstance;
			const detection = { onCommandFinished: Event.None, executingCommandObject: isExecuting ? {} : undefined } as unknown as ICommandDetectionCapability;
			const strategy = store.add(new BasicExecuteStrategy(instance, () => true, detection, new TestConfigurationService(), createLogService()));

			await rejects(strategy.execute('echo delivery', CancellationToken.None), /could not be delivered/);
			deepStrictEqual(sent, [isExecuting ? '\x03' : '\x15']);
		}));
	}

	test('rejects when pty has already exited before execute()', async () => {
		// Simulates the scenario where the shell process from a previous command
		// has already died, so onExit has already fired and Event.toPromise(onExit)
		// would never resolve. The strategy must fail rather than reporting the
		// previous command's exit code as this command's result.
		const onCommandFinishedEmitter = new Emitter<{ getOutput(): string; exitCode: number }>();
		const onExitEmitter = new Emitter<number | undefined>();
		const instance = {
			xtermReadyPromise: Promise.resolve({}),
			onData: Event.None,
			onDisposed: Event.None,
			onExit: onExitEmitter.event,
			isDisposed: false,
			exitCode: 1,
			sendText: () => { throw new Error('sendText should not be called when pty already exited'); },
		} as unknown as ITerminalInstance;
		const commandDetection = {
			onCommandFinished: onCommandFinishedEmitter.event,
		} as unknown as ICommandDetectionCapability;
		const strategy = store.add(new BasicExecuteStrategy(
			instance,
			() => false,
			commandDetection,
			new TestConfigurationService(),
			createLogService(),
		));

		await rejects(
			() => strategy.execute('Rscript /app/ars.R', CancellationToken.None),
			/already exited/
		);
	});

	test('throws "The terminal was closed" when instance is already disposed before execute()', async () => {
		const onCommandFinishedEmitter = new Emitter<{ getOutput(): string; exitCode: number }>();
		const instance = {
			xtermReadyPromise: Promise.resolve({}),
			onData: Event.None,
			onDisposed: Event.None,
			onExit: Event.None,
			isDisposed: true,
			exitCode: undefined,
			sendText: () => { throw new Error('sendText should not be called when terminal is disposed'); },
		} as unknown as ITerminalInstance;
		const commandDetection = {
			onCommandFinished: onCommandFinishedEmitter.event,
		} as unknown as ICommandDetectionCapability;
		const strategy = store.add(new BasicExecuteStrategy(
			instance,
			() => false,
			commandDetection,
			new TestConfigurationService(),
			createLogService(),
		));

		await rejects(
			() => strategy.execute('echo hello', CancellationToken.None),
			/The terminal was closed/
		);
	});
});
