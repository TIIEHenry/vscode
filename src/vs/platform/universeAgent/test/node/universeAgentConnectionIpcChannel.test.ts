/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { Emitter, Event } from '../../../../base/common/event.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import * as path from '../../../../base/common/path.js';
import { ProxyChannel, type IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { universeAgentHubChannelName } from '../../common/hub.js';
import { universeAgentConnectionChannelName } from '../../common/universeAgentConnection.js';
import { UniverseAgentConnectionChannelClient } from '../../common/universeAgentConnectionChannelClient.js';
import { UniverseAgentConnectionIpcChannel, UniverseAgentHubIpcChannel } from '../../common/universeAgentConnectionIpcChannel.js';
import {
	navigatorTeamInfoCommand,
	navigatorTeamMemberStatusCommand,
	navigatorTeamTaskListCommand,
} from '../../common/universeAgentNavigatorTeamIpc.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(thisDir, '../../../../../../');

class FakeWindowService {
	readonly forwarded: string[] = [];
	readonly teamCalls: unknown[][] = [];
	onDidChangeConnection = Event.None;
	onDidChangeAuthStatus = Event.None;
	onRequestAgentTreeRefresh = Event.None;
	onDidFileMutation = Event.None;

	readonly team = {
		memberStatus: (sessionId: string, agentId: string) => {
			this.teamCalls.push(['memberStatus', sessionId, agentId]);
			return Promise.resolve([{
				memberAgentId: 'm',
				memberName: 'M',
				status: 'IDLE',
				preset: '',
				dynamic: '',
				turnCount: 0,
			}]);
		},
		taskList: (sessionId: string, agentId: string) => {
			this.teamCalls.push(['taskList', sessionId, agentId]);
			return Promise.resolve([]);
		},
		teamInfo: (sessionId: string, agentId: string, teamId: number) => {
			this.teamCalls.push(['teamInfo', sessionId, agentId, teamId]);
			return Promise.resolve({ teamId, status: 'READY' });
		},
	};

	disconnect(): Promise<void> {
		this.forwarded.push('disconnect');
		return Promise.resolve();
	}

	isEngineConnected(): boolean {
		this.forwarded.push('isEngineConnected');
		return false;
	}

	probeEngine(): Promise<{ readonly ok: false; readonly reason: string }> {
		this.forwarded.push('probeEngine');
		return Promise.resolve({ ok: false, reason: 'x' });
	}

	connect(): Promise<void> {
		this.forwarded.push('connect');
		return Promise.resolve();
	}

	openChatStream(): { dispose(): void } {
		this.forwarded.push('openChatStream');
		return { dispose() { } };
	}

	openPtyStream(): { dispose(): void } {
		this.forwarded.push('openPtyStream');
		return { dispose() { } };
	}

	fetchAgentTree(): Promise<undefined> {
		this.forwarded.push('fetchAgentTree');
		return Promise.resolve(undefined);
	}

	notifyFileMutation(): void {
		this.forwarded.push('notifyFileMutation');
	}

	dispose(): void {
		this.forwarded.push('dispose');
	}

	login(): Promise<{ readonly ok: true }> {
		this.forwarded.push('login');
		return Promise.resolve({ ok: true });
	}

	_leakSecret(): string {
		this.forwarded.push('_leakSecret');
		return 'secret';
	}
}

function assertMethodNotFound(error: unknown, command: string): boolean {
	return error instanceof Error && error.message === `Method not found: ${command}`;
}

suite('UniverseAgentConnectionIpcChannel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function open() {
		const disposables = store.add(new DisposableStore());
		const service = new FakeWindowService();
		const connectionEmitter = disposables.add(new Emitter<string>());
		const authEmitter = disposables.add(new Emitter<string>());
		service.onDidChangeConnection = connectionEmitter.event;
		service.onDidChangeAuthStatus = authEmitter.event;
		const inner = ProxyChannel.fromService<string>(service, disposables);
		const connection = new UniverseAgentConnectionIpcChannel(service, inner);
		const hub = new UniverseAgentHubIpcChannel(inner);
		return { service, connection, hub, connectionEmitter, authEmitter };
	}

	test('allowlist forwards unary calls and blocks host, connect, streams, and extras', async () => {
		const { service, connection } = open();
		await connection.call('ctx', 'disconnect');
		assert.strictEqual(await connection.call('ctx', 'isEngineConnected'), false);
		assert.deepStrictEqual(await connection.call('ctx', 'probeEngine'), { ok: false, reason: 'x' });
		for (const command of ['notifyFileMutation', 'fetchAgentTree', 'connect', 'openChatStream', 'openPtyStream', 'dispose', '_leakSecret', 'login']) {
			assert.throws(
				() => connection.call('ctx', command, [{}]),
				(error: unknown) => assertMethodNotFound(error, command),
			);
		}
		assert.deepStrictEqual(service.forwarded, ['disconnect', 'isEngineConnected', 'probeEngine']);
	});

	test('connection events pass and the host refresh event does not', async () => {
		const { connection, connectionEmitter } = open();
		const heard: string[] = [];
		store.add(connection.listen<string>('ctx', 'onDidChangeConnection')(value => heard.push(value)));
		connectionEmitter.fire('snap');
		// ProxyChannel buffers events and flushes on a timeout after the first listener.
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(heard, ['snap']);
		assert.throws(
			() => connection.listen('ctx', 'onRequestAgentTreeRefresh'),
			(error: unknown) => error instanceof Error && error.message === 'Event not found: onRequestAgentTreeRefresh',
		);
	});

	test('team commands hit the nested object and reject a bad team id', async () => {
		const { service, connection } = open();
		const members = await connection.call('ctx', navigatorTeamMemberStatusCommand, ['sess', 'agent']);
		assert.strictEqual((members as { memberAgentId: string }[])[0].memberAgentId, 'm');
		await connection.call('ctx', navigatorTeamTaskListCommand, ['sess', 'agent']);
		const info = await connection.call<{ teamId: number }>('ctx', navigatorTeamInfoCommand, ['sess', 'agent', 4]);
		assert.strictEqual(info.teamId, 4);
		await connection.call('ctx', navigatorTeamMemberStatusCommand, undefined);
		assert.throws(
			() => connection.call('ctx', navigatorTeamInfoCommand, ['sess', 'agent', 'nope']),
			(error: unknown) => error instanceof Error && error.message === 'Invalid team id',
		);
		assert.deepStrictEqual(service.teamCalls, [
			['memberStatus', 'sess', 'agent'],
			['taskList', 'sess', 'agent'],
			['teamInfo', 'sess', 'agent', 4],
			['memberStatus', '', ''],
		]);
	});

	test('hub channel forwards hub calls only', async () => {
		const { service, hub, authEmitter } = open();
		assert.deepStrictEqual(await hub.call('ctx', 'login', ['https://hub.example', 'a@b.c', 'pw']), { ok: true });
		assert.throws(
			() => hub.call('ctx', 'notifyFileMutation', [{}]),
			(error: unknown) => assertMethodNotFound(error, 'notifyFileMutation'),
		);
		assert.throws(
			() => hub.listen('ctx', 'onDidFileMutation'),
			(error: unknown) => error instanceof Error && error.message === 'Event not found: onDidFileMutation',
		);
		const heard: string[] = [];
		store.add(hub.listen<string>('ctx', 'onDidChangeAuthStatus')(value => heard.push(value)));
		authEmitter.fire('signed-in');
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(heard, ['signed-in']);
		assert.deepStrictEqual(service.forwarded, ['login']);
	});

	test('desktop client team is an object of unary IPC calls', async () => {
		const calls: Array<{ command: string; arg: unknown }> = [];
		const ipc: IChannel = {
			call: <T>(command: string, arg?: unknown) => {
				calls.push({ command, arg });
				if (command === navigatorTeamMemberStatusCommand) {
					return Promise.resolve([] as T);
				}
				if (command === navigatorTeamTaskListCommand) {
					return Promise.resolve([] as T);
				}
				if (command === navigatorTeamInfoCommand) {
					return Promise.resolve({ teamId: 3, status: 'READY' } as T);
				}
				return Promise.reject(new Error(`unexpected ${command}`));
			},
			listen: () => Event.None,
		};
		const client = store.add(new UniverseAgentConnectionChannelClient(ipc));
		assert.strictEqual(typeof client.team, 'object');
		assert.strictEqual(typeof client.team.memberStatus, 'function');
		assert.deepStrictEqual(await client.team.memberStatus('sess', 'mgr'), []);
		assert.deepStrictEqual(await client.team.taskList('sess', 'mgr'), []);
		assert.deepStrictEqual(await client.team.teamInfo('sess', 'mgr', 3), { teamId: 3, status: 'READY' });
		assert.deepStrictEqual(calls.filter(call => call.command.startsWith('navigatorTeam')), [
			{ command: navigatorTeamMemberStatusCommand, arg: ['sess', 'mgr'] },
			{ command: navigatorTeamTaskListCommand, arg: ['sess', 'mgr'] },
			{ command: navigatorTeamInfoCommand, arg: ['sess', 'mgr', 3] },
		]);
	});

	test('registration source keeps the allowlist, hub name, and host token', () => {
		const app = fs.readFileSync(path.join(REPO_ROOT, 'src/vs/code/electron-main/app.ts'), 'utf8');
		const hub = fs.readFileSync(path.join(REPO_ROOT, 'src/vs/platform/universeAgent/common/hub.ts'), 'utf8');
		const sessionView = fs.readFileSync(path.join(REPO_ROOT, 'src/vs/platform/universeAgent/electron-main/universeAgentSessionViewService.ts'), 'utf8');
		assert.strictEqual(universeAgentHubChannelName, 'universeAgentHub');
		assert.notStrictEqual(universeAgentHubChannelName, universeAgentConnectionChannelName);
		assert.ok(app.includes('new UniverseAgentConnectionIpcChannel(universeAgentConnection, universeAgentInnerChannel)'));
		assert.ok(app.includes('registerChannel(universeAgentConnectionChannelName, universeAgentConnectionChannel)'));
		assert.ok(app.includes('new UniverseAgentHubIpcChannel(universeAgentInnerChannel)'));
		assert.ok(app.includes('registerChannel(universeAgentHubChannelName, universeAgentHubChannel)'));
		assert.ok(app.includes('services.set(IUniverseAgentHostConnection, new SyncDescriptor(UniverseAgentHostConnectionAdapter, undefined, false /* main-only host token */));'));
		assert.ok(!app.includes('registerChannel(universeAgentConnectionChannelName, ProxyChannel'));
		assert.ok(hub.includes("export const universeAgentHubChannelName = 'universeAgentHub';"));
		assert.ok(sessionView.includes('@IUniverseAgentHostConnection hostConnection: IUniverseAgentHostConnection'));
		assert.ok(!sessionView.includes('as unknown as'));
	});
});
