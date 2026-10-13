/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { OperatingSystem, OS } from '../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IRemoteAgentEnvironment } from '../../../../../platform/remote/common/remoteAgentEnvironment.js';
import { ITerminalLogService, ITerminalProfile } from '../../../../../platform/terminal/common/terminal.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IConfigurationResolverService } from '../../../../services/configurationResolver/common/configurationResolver.js';
import { IHistoryService } from '../../../../services/history/common/history.js';
import { IRemoteAgentConnection, IRemoteAgentService } from '../../../../services/remote/common/remoteAgentService.js';
import { BaseTerminalProfileResolverService } from '../../browser/terminalProfileResolverService.js';
import { ITerminalProfileService } from '../../common/terminal.js';

const remoteOs = OS === OperatingSystem.Windows ? OperatingSystem.Linux : OperatingSystem.Windows;

class TestTerminalProfileResolverService extends BaseTerminalProfileResolverService {
	resolveDefaultProfileName(): Promise<void> {
		return (this as unknown as { _refreshDefaultProfileNameBody(): Promise<void> })._refreshDefaultProfileNameBody();
	}
}

function createResolver(remote: Pick<IRemoteAgentService, 'getConnection' | 'getEnvironment'>): TestTerminalProfileResolverService {
	return new TestTerminalProfileResolverService(
		{
			getDefaultSystemShell: async () => '/bin/bash',
			getEnvironment: async () => ({}),
		},
		{ onDidChangeConfiguration: Event.None } as IConfigurationService,
		{ resolveWithEnvironment: async (_env: unknown, _folder: unknown, value: string) => value } as IConfigurationResolverService,
		{ getLastActiveWorkspaceRoot: () => undefined } as IHistoryService,
		{} as ITerminalLogService,
		{
			profilesReady: Promise.resolve(),
			onDidChangeAvailableProfiles: Event.None,
			getDefaultProfile: (os?: OperatingSystem): ITerminalProfile | undefined => ({
				profileName: `profile-${os}`,
				path: '/bin/bash',
				isDefault: true,
			}),
		} as ITerminalProfileService,
		{} as IWorkspaceContextService,
		remote as IRemoteAgentService,
	);
}

suite('TerminalProfileResolverService remote OS', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	let unexpected: unknown[] = [];
	let originalHandler: (error: unknown) => void;

	setup(() => {
		unexpected = [];
		originalHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => { unexpected.push(error); });
	});

	teardown(() => {
		setUnexpectedErrorHandler(originalHandler);
	});

	test('reads the remote OS again on the next resolution after getEnvironment rejects', async () => {
		const failure = new Error('remote environment failed');
		let calls = 0;
		const connection = { remoteAuthority: 'ssh-remote' } as IRemoteAgentConnection;
		const resolver = store.add(createResolver({
			getConnection: () => connection,
			getEnvironment: () => {
				calls++;
				return Promise.reject(failure);
			},
		}));

		await timeout(0);
		strictEqual(calls, 1);
		await resolver.resolveDefaultProfileName();
		strictEqual(calls, 2, 'a later resolution reads again instead of spinning inside the failed one');
		await resolver.resolveDefaultProfileName();
		strictEqual(calls, 3, 'the next resolution reads the remote OS again');
		strictEqual(resolver.defaultProfileName, undefined);
		strictEqual(unexpected.length, 3);
	});

	test('does not read the remote OS again after getEnvironment succeeds', async () => {
		let calls = 0;
		const connection = { remoteAuthority: 'ssh-remote' } as IRemoteAgentConnection;
		const resolver = store.add(createResolver({
			getConnection: () => connection,
			getEnvironment: async () => {
				calls++;
				return { os: remoteOs } as IRemoteAgentEnvironment;
			},
		}));

		await timeout(0);
		strictEqual(calls, 1);
		await resolver.resolveDefaultProfileName();
		strictEqual(resolver.defaultProfileName, `profile-${remoteOs}`);
		await resolver.resolveDefaultProfileName();
		strictEqual(calls, 1);
		strictEqual(unexpected.length, 0);
	});

	test('shares one in-flight getEnvironment and does not read again after it succeeds', async () => {
		let calls = 0;
		let resolveEnv!: (env: IRemoteAgentEnvironment) => void;
		const gate = new Promise<IRemoteAgentEnvironment>(resolve => { resolveEnv = resolve; });
		const connection = { remoteAuthority: 'ssh-remote' } as IRemoteAgentConnection;
		const resolver = store.add(createResolver({
			getConnection: () => connection,
			getEnvironment: () => {
				calls++;
				return gate;
			},
		}));

		const first = resolver.resolveDefaultProfileName();
		const second = resolver.resolveDefaultProfileName();
		strictEqual(calls, 1);
		resolveEnv({ os: remoteOs } as IRemoteAgentEnvironment);
		await first;
		await second;
		strictEqual(resolver.defaultProfileName, `profile-${remoteOs}`);
		await resolver.resolveDefaultProfileName();
		strictEqual(calls, 1);
		strictEqual(unexpected.length, 0);
	});

	test('does not call getEnvironment when there is no remote connection', async () => {
		let calls = 0;
		const resolver = store.add(createResolver({
			getConnection: () => null,
			getEnvironment: () => {
				calls++;
				return Promise.reject(new Error('should not be called'));
			},
		}));

		await timeout(0);
		await resolver.resolveDefaultProfileName();
		await resolver.resolveDefaultProfileName();
		strictEqual(calls, 0);
		strictEqual(resolver.defaultProfileName, `profile-${OS}`);
		strictEqual(unexpected.length, 0);
	});
});
