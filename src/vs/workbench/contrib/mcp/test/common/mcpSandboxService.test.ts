/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Event } from '../../../../../base/common/event.js';
import { OperatingSystem } from '../../../../../base/common/platform.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationTarget } from '../../../../../platform/configuration/common/configuration.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ILogService, LogLevel } from '../../../../../platform/log/common/log.js';
import { IMcpSandboxConfiguration } from '../../../../../platform/mcp/common/mcpPlatformTypes.js';
import { IMcpResourceScannerService } from '../../../../../platform/mcp/common/mcpResourceScannerService.js';
import { IRemoteAgentEnvironment } from '../../../../../platform/remote/common/remoteAgentEnvironment.js';
import { IRemoteAgentService } from '../../../../services/remote/common/remoteAgentService.js';
import { McpSandboxService, mcpDefaultCwdToFsPath, resolveMcpServerSandboxWorkingDirectory } from '../../common/mcpSandboxService.js';
import { McpServerDefinition, McpServerLaunch, McpServerTransportType } from '../../common/mcpTypes.js';

suite('MCP Sandbox Service', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('converts default cwd URIs for the target operating system', () => {
		assert.deepStrictEqual({
			linuxRemote: mcpDefaultCwdToFsPath(URI.parse('vscode-remote://ssh-remote+linux/home/test/workspace'), OperatingSystem.Linux),
			windowsRemote: mcpDefaultCwdToFsPath(URI.parse('vscode-remote://ssh-remote+windows/c:/Users/test/workspace'), OperatingSystem.Windows),
			windowsUnc: mcpDefaultCwdToFsPath(URI.parse('file://server/share/workspace'), OperatingSystem.Windows),
		}, {
			linuxRemote: '/home/test/workspace',
			windowsRemote: 'c:\\Users\\test\\workspace',
			windowsUnc: '\\\\server\\share\\workspace',
		});
	});

	test('resolves relative cwd against the target-side default cwd', () => {
		const linuxDefaultCwd = URI.parse('vscode-remote://ssh-remote+linux/home/test/workspace');
		const windowsDefaultCwd = URI.parse('vscode-remote://ssh-remote+windows/c:/Users/test/workspace');
		const linuxUserHome = URI.parse('vscode-remote://ssh-remote+linux/home/test');

		assert.deepStrictEqual({
			linuxRelative: resolveMcpServerSandboxWorkingDirectory('./server', linuxDefaultCwd, linuxUserHome, OperatingSystem.Linux),
			windowsRelative: resolveMcpServerSandboxWorkingDirectory('.\\server', windowsDefaultCwd, undefined, OperatingSystem.Windows),
			homeRelative: resolveMcpServerSandboxWorkingDirectory('./server', undefined, linuxUserHome, OperatingSystem.Linux),
			tildeRelative: resolveMcpServerSandboxWorkingDirectory('~/server', linuxDefaultCwd, linuxUserHome, OperatingSystem.Linux),
			explicitAbsolute: resolveMcpServerSandboxWorkingDirectory('/explicit/server', linuxDefaultCwd, linuxUserHome, OperatingSystem.Linux),
			implicit: resolveMcpServerSandboxWorkingDirectory(undefined, linuxDefaultCwd, linuxUserHome, OperatingSystem.Linux),
		}, {
			linuxRelative: '/home/test/workspace/server',
			windowsRelative: 'c:\\Users\\test\\workspace\\server',
			homeRelative: '/home/test/server',
			tildeRelative: '/home/test/server',
			explicitAbsolute: '/explicit/server',
			implicit: '/home/test/workspace',
		});
	});

	test('later launch does not inherit the previous cwd or overwrite its settings file', async () => {
		const firstCwd = '/work/server-a';
		const secondCwd = '/work/server-b';
		const firstAllowWrite = '/allowed/server-a';
		const secondAllowWrite = '/allowed/server-b';
		const written = new Map<string, string>();
		const createdUris: URI[] = [];
		const fileService = {
			async createFile(resource: URI, content?: VSBuffer): Promise<void> {
				createdUris.push(resource);
				written.set(resource.toString(), content?.toString() ?? '');
			}
		};
		const remoteEnvironment = {
			os: OperatingSystem.Linux,
			tmpDir: URI.from({ scheme: 'file', path: '/tmp/mcp-sandbox' }),
			userHome: URI.from({ scheme: 'file', path: '/home/test' }),
			appRoot: URI.from({ scheme: 'file', path: '/app' }),
		} as IRemoteAgentEnvironment;
		const logService: ILogService = {
			_serviceBrand: undefined,
			onDidChangeLogLevel: Event.None,
			getLevel: () => LogLevel.Info,
			setLevel: () => { },
			trace: () => { },
			debug: () => { },
			info: () => { },
			warn: () => { },
			error: () => { },
			flush: () => { },
			dispose: () => { },
		};
		const service = store.add(new McpSandboxService(
			fileService as unknown as IFileService,
			{} as IEnvironmentService,
			logService,
			{} as IMcpResourceScannerService,
			{ getEnvironment: async () => remoteEnvironment } as IRemoteAgentService,
		));

		const configTarget = ConfigurationTarget.USER;
		await service.launchInSandboxIfEnabled(serverDefinition(), launchFor(firstCwd, firstAllowWrite), 'test-remote', configTarget);
		const firstUri = createdUris[0];
		const firstBody = firstUri ? written.get(firstUri.toString()) : undefined;
		await service.launchInSandboxIfEnabled(serverDefinition(), launchFor(secondCwd, secondAllowWrite), 'test-remote', configTarget);

		assert.strictEqual(createdUris.length, 2);
		assert.notStrictEqual(createdUris[0].toString(), createdUris[1].toString());
		assert.strictEqual(written.get(createdUris[0].toString()), firstBody);
		const secondAllowWrites = [...allowWriteOf(written.get(createdUris[1].toString())!)];
		assert.deepStrictEqual(secondAllowWrites.sort(), [secondAllowWrite, secondCwd, '~/.npm'].sort());
		assert.ok(!secondAllowWrites.includes(firstCwd));
		assert.deepStrictEqual([...allowWriteOf(firstBody!)].sort(), [firstAllowWrite, firstCwd, '~/.npm'].sort());
	});

	test('calls getEnvironment again on the next remote read after rejection, then caches success', async () => {
		const error = new Error('remote env unavailable');
		const remoteEnvironment = { os: OperatingSystem.Windows } as IRemoteAgentEnvironment;
		let calls = 0;
		let releaseSuccess!: (value: IRemoteAgentEnvironment | null) => void;
		const service = store.add(new McpSandboxService(
			{} as IFileService,
			{} as IEnvironmentService,
			{} as ILogService,
			{} as IMcpResourceScannerService,
			{
				getEnvironment: () => {
					calls++;
					if (calls === 1) {
						return Promise.reject(error);
					}
					return new Promise(resolve => {
						releaseSuccess = resolve;
					});
				},
			} as IRemoteAgentService,
		));

		assert.strictEqual(calls, 1);
		await assert.rejects(
			() => service.isEnabled(serverDefinition(), 'test-remote'),
			(reason: unknown) => reason === error,
		);
		assert.strictEqual(calls, 1);

		await service.isEnabled(serverDefinition());
		assert.strictEqual(calls, 1);

		const firstRetry = service.isEnabled(serverDefinition(), 'test-remote');
		const sharedRetry = service.isEnabled(serverDefinition(), 'test-remote');
		assert.strictEqual(calls, 2);
		releaseSuccess(remoteEnvironment);
		assert.deepStrictEqual(await Promise.all([firstRetry, sharedRetry]), [false, false]);

		assert.strictEqual(await service.isEnabled(serverDefinition(), 'test-remote'), false);
		assert.strictEqual(calls, 2);
	});

	test('caches a getEnvironment result that resolves to null', async () => {
		let calls = 0;
		const service = store.add(new McpSandboxService(
			{} as IFileService,
			{} as IEnvironmentService,
			{} as ILogService,
			{} as IMcpResourceScannerService,
			{
				getEnvironment: async () => {
					calls++;
					return null;
				},
			} as IRemoteAgentService,
		));

		assert.strictEqual(calls, 1);
		await service.isEnabled(serverDefinition(), 'test-remote');
		await service.isEnabled(serverDefinition(), 'test-remote');
		assert.strictEqual(calls, 1);
	});

	test('a rejected remote environment read drops the promise only while it still points at that attempt', async () => {
		const error = new Error('remote env unavailable');
		let rejectFirst!: (reason: Error) => void;
		const firstRead = new Promise<IRemoteAgentEnvironment | null>((_resolve, reject) => {
			rejectFirst = reject;
		});
		let calls = 0;
		const service = store.add(new McpSandboxService(
			{} as IFileService,
			{} as IEnvironmentService,
			{} as ILogService,
			{} as IMcpResourceScannerService,
			{
				getEnvironment: () => {
					calls++;
					return calls === 1 ? firstRead : Promise.resolve({ os: OperatingSystem.Windows } as IRemoteAgentEnvironment);
				},
			} as IRemoteAgentService,
		));
		const probe = service as unknown as IRemoteEnvProbe;

		const reading = service.isEnabled(serverDefinition(), 'test-remote');
		const replacement = Promise.resolve<IRemoteAgentEnvironment | null>(null);
		probe._remoteEnvDetailsPromise = replacement;
		rejectFirst(error);

		await assert.rejects(() => reading, (reason: unknown) => reason === error);
		assert.strictEqual(probe._remoteEnvDetailsPromise, replacement);
		assert.strictEqual(calls, 1);

		await service.isEnabled(serverDefinition(), 'test-remote');
		assert.strictEqual(calls, 1);
		assert.strictEqual(probe._remoteEnvDetailsPromise, replacement);
	});
});

interface IRemoteEnvProbe {
	_remoteEnvDetailsPromise: Promise<IRemoteAgentEnvironment | null> | undefined;
}

function serverDefinition(): McpServerDefinition {
	return {
		id: 'server',
		label: 'Server',
		cacheNonce: 'nonce',
		sandboxEnabled: true,
		launch: launchFor('/unused', '/unused'),
	};
}

function launchFor(cwd: string, allowWrite: string): McpServerLaunch {
	return {
		type: McpServerTransportType.Stdio,
		command: 'server',
		args: [],
		env: {},
		envFile: undefined,
		cwd,
		sandbox: {
			filesystem: { allowWrite: [allowWrite] },
		},
	};
}

function allowWriteOf(body: string): readonly string[] {
	const parsed = JSON.parse(body) as IMcpSandboxConfiguration;
	return parsed.filesystem?.allowWrite ?? [];
}
