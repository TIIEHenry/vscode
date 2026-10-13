/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, strictEqual } from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { OperatingSystem, OS } from '../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IRemoteAgentEnvironment } from '../../../../platform/remote/common/remoteAgentEnvironment.js';
import { ITerminalProfile } from '../../../../platform/terminal/common/terminal.js';
import { ITerminalEditorService, ITerminalGroupService, ITerminalService } from '../../../contrib/terminal/browser/terminal.js';
import { IEnvironmentVariableService } from '../../../contrib/terminal/common/environmentVariable.js';
import { IShellLaunchConfigResolveOptions, ITerminalProfileResolverService, ITerminalProfileService } from '../../../contrib/terminal/common/terminal.js';
import { ITerminalLinkProviderService } from '../../../contrib/terminalContrib/links/browser/links.js';
import { ITerminalQuickFixService } from '../../../contrib/terminalContrib/quickFix/browser/quickFix.js';
import { ITerminalCompletionService } from '../../../contrib/terminalContrib/suggest/browser/terminalCompletionService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { MainThreadTerminalService } from '../../browser/mainThreadTerminalService.js';
import { SingleProxyRPCProtocol } from '../common/testRPCProtocol.js';

const remoteOs = OS === OperatingSystem.Windows ? OperatingSystem.Linux : OperatingSystem.Windows;

interface ProfileRead {
	readonly os: OperatingSystem;
	readonly allowAutomationShell: boolean;
}

function createService(
	getEnvironment: () => Promise<IRemoteAgentEnvironment | null>,
	onDidChangeAvailableProfiles: Event<ITerminalProfile[]>,
	profileReads: ProfileRead[],
): MainThreadTerminalService {
	const profile = { profileName: 'default', path: '/bin/bash', isDefault: true } satisfies ITerminalProfile;
	return new MainThreadTerminalService(
		SingleProxyRPCProtocol({ $acceptDefaultProfile() { } }),
		{
			onDidCreateInstance: Event.None,
			onDidDisposeInstance: Event.None,
			onAnyInstanceProcessIdReady: Event.None,
			onDidChangeInstanceDimensions: Event.None,
			onAnyInstanceMaximumDimensionsChange: Event.None,
			onDidRequestStartExtensionTerminal: Event.None,
			onDidChangeActiveInstance: Event.None,
			onAnyInstanceTitleChange: Event.None,
			onAnyInstanceDataInput: Event.None,
			onAnyInstanceSelectionChange: Event.None,
			onAnyInstanceShellTypeChanged: Event.None,
			instances: [],
			activeInstance: undefined,
		} as unknown as ITerminalService,
		{} as ITerminalLinkProviderService,
		{} as ITerminalQuickFixService,
		{} as IInstantiationService,
		{ collections: new Map() } as unknown as IEnvironmentVariableService,
		{} as ILogService,
		{
			getDefaultProfile: async (options: IShellLaunchConfigResolveOptions) => {
				profileReads.push({ os: options.os, allowAutomationShell: options.allowAutomationShell === true });
				return profile;
			},
		} as ITerminalProfileResolverService,
		{
			getEnvironment,
		} as IRemoteAgentService,
		{} as ITerminalGroupService,
		{} as ITerminalEditorService,
		{ onDidChangeAvailableProfiles } as ITerminalProfileService,
		{} as ITerminalCompletionService,
		{ remoteAuthority: 'test-remote' } as IWorkbenchEnvironmentService,
	);
}

suite('MainThreadTerminalService remote OS', () => {
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

	test('reads getEnvironment again on the next default profile update after rejection, then caches success', async () => {
		const failure = new Error('remote environment failed');
		let fail = true;
		let calls = 0;
		const profiles = store.add(new Emitter<ITerminalProfile[]>());
		const profileReads: ProfileRead[] = [];
		store.add(createService(() => {
			calls++;
			return fail ? Promise.reject(failure) : Promise.resolve({ os: remoteOs } as IRemoteAgentEnvironment);
		}, profiles.event, profileReads));

		strictEqual(calls, 1);
		await timeout(0);
		strictEqual(calls, 1, 'a rejected read does not retry inside the same update');
		deepStrictEqual(profileReads, []);

		profiles.fire([]);
		strictEqual(calls, 2, 'the next default profile update reads again');
		await timeout(0);
		strictEqual(calls, 2, 'a rejected read does not retry inside the same update');
		deepStrictEqual(profileReads, [
			{ os: OS, allowAutomationShell: false },
			{ os: OS, allowAutomationShell: true },
		]);

		fail = false;
		profiles.fire([]);
		strictEqual(calls, 3);
		await timeout(0);
		deepStrictEqual(profileReads, [
			{ os: OS, allowAutomationShell: false },
			{ os: OS, allowAutomationShell: true },
			{ os: remoteOs, allowAutomationShell: false },
			{ os: remoteOs, allowAutomationShell: true },
		]);

		profiles.fire([]);
		await timeout(0);
		strictEqual(calls, 3, 'a successful read stays cached');
		deepStrictEqual(profileReads.at(-1), { os: remoteOs, allowAutomationShell: true });
		strictEqual(profileReads.length, 6);
		strictEqual(unexpected.length, 2);
	});

	test('shares one in-flight getEnvironment across default profile updates', async () => {
		let calls = 0;
		let resolveEnv!: (env: IRemoteAgentEnvironment) => void;
		const gate = new Promise<IRemoteAgentEnvironment>(resolve => { resolveEnv = resolve; });
		const profiles = store.add(new Emitter<ITerminalProfile[]>());
		const profileReads: ProfileRead[] = [];
		store.add(createService(() => {
			calls++;
			return gate;
		}, profiles.event, profileReads));

		strictEqual(calls, 1);
		profiles.fire([]);
		profiles.fire([]);
		strictEqual(calls, 1, 'in-flight reads share one getEnvironment');
		resolveEnv({ os: remoteOs } as IRemoteAgentEnvironment);
		await timeout(0);
		strictEqual(calls, 1);
		deepStrictEqual(profileReads, [
			{ os: remoteOs, allowAutomationShell: false },
			{ os: remoteOs, allowAutomationShell: true },
		]);

		profiles.fire([]);
		await timeout(0);
		strictEqual(calls, 1, 'a successful read stays cached');
		strictEqual(profileReads.length, 4);
		strictEqual(unexpected.length, 0);
	});
});
