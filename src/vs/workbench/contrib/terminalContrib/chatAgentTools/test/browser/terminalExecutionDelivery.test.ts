/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, rejects, strictEqual } from 'assert';
import { DeferredPromise } from '../../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { runWithFakedTimers } from '../../../../../../base/test/common/timeTravelScheduler.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import type { ICommandDetectionCapability } from '../../../../../../platform/terminal/common/capabilities/capabilities.js';
import type { ITerminalInstance } from '../../../../terminal/browser/terminal.js';
import { terminalStrings } from '../../../../terminal/common/terminalStrings.js';
import { BasicExecuteStrategy } from '../../browser/executeStrategy/basicExecuteStrategy.js';
import { NoneExecuteStrategy } from '../../browser/executeStrategy/noneExecuteStrategy.js';
import { RichExecuteStrategy } from '../../browser/executeStrategy/richExecuteStrategy.js';

suite('Terminal execution delivery', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	for (const kind of ['basic', 'none', 'rich'] as const) {
		for (const outcome of ['dropped', 'throw'] as const) {
			test(`${kind} rejects ${outcome} delivery even after an early success frame`, () => runWithFakedTimers({ useFakeTimers: true }, async () => {
				const finished = store.add(new Emitter<{ getOutput(): string; exitCode: number }>());
				const exited = store.add(new Emitter<number | undefined>());
				const disposed = store.add(new Emitter<ITerminalInstance>());
				const data = store.add(new Emitter<string>());
				const delivery = new DeferredPromise<boolean>();
				const entered = new DeferredPromise<void>();
				const failure = new Error(terminalStrings.inputDeliveryFailed);
				const marker = { line: 0, onDispose: Event.None, dispose: () => { } };
				const xterm = {
					raw: {
						registerMarker: () => marker,
						buffer: { active: {}, alternate: {}, onBufferChange: Event.None },
						onWriteParsed: Event.None,
					},
				};
				const sendText = async () => {
					entered.complete();
					return delivery.p;
				};
				const instance = {
					xtermReadyPromise: Promise.resolve(xterm),
					onData: data.event,
					onExit: exited.event,
					onDisposed: disposed.event,
					sendText,
					runCommand: async () => {
						if (!await sendText()) {
							throw failure;
						}
					},
				} as unknown as ITerminalInstance;
				const commandDetection = { onCommandFinished: finished.event } as unknown as ICommandDetectionCapability;
				const configuration = new TestConfigurationService();
				const log = new class extends NullLogService { readonly _logBrand = undefined; };
				const strategy = store.add(kind === 'basic'
					? new BasicExecuteStrategy(instance, () => false, commandDetection, configuration, log)
					: kind === 'rich'
						? new RichExecuteStrategy(instance, commandDetection, false, configuration, log)
						: new NoneExecuteStrategy(instance, () => false, configuration, log));
				let settled = false;
				const result = strategy.execute('echo delivery', CancellationToken.None).then(value => {
					settled = true;
					return value;
				});
				const rejected = rejects(result, /could not be delivered/);
				await entered.p;
				finished.fire({ getOutput: () => 'unrelated output', exitCode: 0 });
				await Promise.resolve();
				strictEqual(settled, false);
				if (outcome === 'throw') {
					delivery.error(failure);
				} else {
					delivery.complete(false);
				}
				await rejected;
				deepStrictEqual([finished.hasListeners(), exited.hasListeners(), disposed.hasListeners(), data.hasListeners()], [false, false, false, false]);
			}));
		}
	}
});
