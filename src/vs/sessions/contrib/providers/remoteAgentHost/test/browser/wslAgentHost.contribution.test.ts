/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../../base/common/async.js';
import { CancellationError, errorHandler, setUnexpectedErrorHandler } from '../../../../../../base/common/errors.js';
import { Event } from '../../../../../../base/common/event.js';
import { toDisposable } from '../../../../../../base/common/lifecycle.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IRemoteAgentHostService, RemoteAgentHostAutoConnectSettingId, RemoteAgentHostsEnabledSettingId } from '../../../../../../platform/agentHost/common/remoteAgentHostService.js';
import { IWSLCachedDistro, IWSLRemoteAgentHostService, WSL_ADDRESS_PREFIX } from '../../../../../../platform/agentHost/common/wslRemoteAgentHost.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../../platform/notification/common/notification.js';
import { ISessionsProvidersService } from '../../../../../services/sessions/browser/sessionsProvidersService.js';
import { WSLAgentHostContribution, shouldPauseWSLReconnectAfterFailure } from '../../browser/wslAgentHost.contribution.js';

suite('shouldPauseWSLReconnectAfterFailure', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('pauses reconnect after cancellation but not after regular failures', () => {
		assert.deepStrictEqual({
			cancellation: shouldPauseWSLReconnectAfterFailure(new CancellationError()),
			regularError: shouldPauseWSLReconnectAfterFailure(new Error('boom')),
		}, {
			cancellation: true,
			regularError: false,
		});
	});
});

suite('WSLAgentHostContribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not leak unhandled rejection when scheduled WSL reconnect rejects and log error throws', async () => {
		// `_attemptManagedReconnect` already catches `reconnect`; a lone inner reject
		// does not leak. The scheduleRetry void site still needs `.catch` when `logService.error` throws.
		const distro = 'Ubuntu';
		const name = 'Ubuntu';
		const address = `${WSL_ADDRESS_PREFIX}${distro}`;
		let cached: readonly IWSLCachedDistro[] = [];
		let reconnectCalls = 0;
		let errorCalls = 0;
		let throwOnLogError = false;
		const configurationService = new TestConfigurationService({
			[RemoteAgentHostsEnabledSettingId]: true,
			[RemoteAgentHostAutoConnectSettingId]: true,
		});
		store.add(toDisposable(() => configurationService.onDidChangeConfigurationEmitter.dispose()));
		const logService = new class extends NullLogService {
			override error(message: string | Error): void {
				if (typeof message === 'string' && message.includes('WSL reconnect failed')) {
					errorCalls++;
					if (throwOnLogError) {
						throw new Error('error failed');
					}
				}
			}
		}();
		const contribution = store.add(new WSLAgentHostContribution(
			new class extends mock<IRemoteAgentHostService>() {
				override readonly onDidChangeConnections = Event.None;
				override readonly connections = [];
			}(),
			new class extends mock<IWSLRemoteAgentHostService>() {
				override readonly onDidReportConnectProgress = Event.None;
				override getCachedDistros(): readonly IWSLCachedDistro[] { return cached; }
				override listRunningDistros(): Promise<string[]> { return Promise.resolve([distro]); }
				override reconnect(): Promise<never> {
					reconnectCalls++;
					return Promise.reject(new Error('boom'));
				}
			}(),
			configurationService as IConfigurationService,
			logService,
			store.add(new TestInstantiationService()),
			new class extends mock<ISessionsProvidersService>() { }(),
			new class extends mock<INotificationService>() { }(),
		));
		cached = [{ distro, name }];

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
		try {
			// Seed the production scheduleRetry void site via a real failed attempt.
			// no-as-any: private reconnect entry is the only way off the `isWindows` poll gate.
			await (contribution as unknown as {
				_attemptWSLReconnect(d: string, n: string, a: string): Promise<void>;
			})._attemptWSLReconnect(distro, name, address);
			assert.deepStrictEqual({ reconnectCalls, errorCalls, unhandledRejections }, {
				reconnectCalls: 1,
				errorCalls: 1,
				unhandledRejections: [],
			});
			throwOnLogError = true;
			await timeout(1500);
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, reconnectCalls, errorCalls }, {
				unhandledRejections: [],
				reconnectCalls: 2,
				errorCalls: 2,
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
