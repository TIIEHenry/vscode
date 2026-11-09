/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { MarshalledId } from '../../../../base/common/marshallingIds.js';
import { ChannelClient, ChannelServer, ProxyChannel, type IChannel, type IMessagePassingProtocol } from '../../../../base/parts/ipc/common/ipc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { universeAgentHubChannelName } from '../../common/hub.js';
import { universeAgentConnectionChannelName } from '../../common/universeAgentConnection.js';
import { UniverseAgentConnectionChannelClient } from '../../common/universeAgentConnectionChannelClient.js';
import { UniverseAgentConnectionIpcChannel, UniverseAgentHubIpcChannel, UNIVERSE_AGENT_CATALOG_MUTATION_OWNER_ARGUMENT_INDEXES } from '../../common/universeAgentConnectionIpcChannel.js';
import {
	navigatorTeamInfoCommand,
	navigatorTeamMemberStatusCommand,
	navigatorTeamTaskListCommand,
} from '../../common/universeAgentNavigatorTeamIpc.js';

class QueueProtocol implements IMessagePassingProtocol {

	private buffering = true;
	private buffers: VSBuffer[] = [];

	private readonly _onMessage = new Emitter<VSBuffer>({
		onDidAddFirstListener: () => {
			for (const buffer of this.buffers) {
				this._onMessage.fire(buffer);
			}
			this.buffers = [];
			this.buffering = false;
		},
		onDidRemoveLastListener: () => {
			this.buffering = true;
		}
	});

	readonly onMessage = this._onMessage.event;
	other!: QueueProtocol;

	send(buffer: VSBuffer): void {
		this.other.receive(buffer);
	}

	private receive(buffer: VSBuffer): void {
		if (this.buffering) {
			this.buffers.push(buffer);
		} else {
			this._onMessage.fire(buffer);
		}
	}
}

function createProtocolPair(): [IMessagePassingProtocol, IMessagePassingProtocol] {
	const one = new QueueProtocol();
	const other = new QueueProtocol();
	one.other = other;
	other.other = one;
	return [one, other];
}

class FakeWindowService {
	readonly forwarded: string[] = [];
	readonly teamCalls: unknown[][] = [];
	onDidChangeConnection = Event.None;
	onDidChangeAuthStatus = Event.None;
	onRequestAgentTreeRefresh = Event.None;
	onDidFileMutation = Event.None;

	getConnectionSnapshot() {
		return { pairingPending: false };
	}

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

	test('session tool profile and engine trigger requests cross the explicit IPC allowlist unchanged', async () => {
		const calls: unknown[] = [];
		const service = {
			team: new FakeWindowService().team,
			getConnectionSnapshot: () => ({ pairingPending: false }),
			isEngineConnected: () => false,
			setClientToolProfile: async (request: unknown) => { calls.push(request); return { ok: false, error: 'missing' }; },
			registerSessionEngineTrigger: async (request: unknown) => { calls.push(request); return { trigger: { triggerId: 't' } }; },
		};
		const inner = ProxyChannel.fromService<string>(service, store.add(new DisposableStore()));
		const channel = new UniverseAgentConnectionIpcChannel(service, inner);
		const profile = { sessionId: 's', profile: 'CLIENT_TOOL_PROFILE_NONE' };
		const trigger = { sessionId: 's', name: 'Watch', type: 'file_changed', promptTemplate: 'Changed', watchPaths: ['src'], dedupeKeyField: '' };
		assert.deepStrictEqual(await channel.call('ctx', 'setClientToolProfile', [profile]), { ok: false, error: 'missing' });
		assert.deepStrictEqual(await channel.call('ctx', 'registerSessionEngineTrigger', [trigger]), { trigger: { triggerId: 't' } });
		assert.deepStrictEqual(calls, [profile, trigger]);
	});

	test('GetPermissionMode crosses desktop client and host allowlist', async () => {
		const calls: string[] = [];
		const service = { team: new FakeWindowService().team, getConnectionSnapshot: () => ({ pairingPending: false }), isEngineConnected: () => false, getPermissionMode: async (request: { sessionId: string }) => { calls.push(request.sessionId); return { mode: 'SESSION_TOOL_PERMISSION_MODE_AGENT' }; } };
		const inner = ProxyChannel.fromService<string>(service, store.add(new DisposableStore()));
		const channel = new UniverseAgentConnectionIpcChannel(service, inner);
		const client = store.add(new UniverseAgentConnectionChannelClient({ call: (command, arg) => channel.call('ctx', command, arg), listen: () => Event.None }));
		assert.deepStrictEqual({ result: await client.getPermissionMode?.({ sessionId: 'actual' }), calls }, { result: { mode: 'SESSION_TOOL_PERMISSION_MODE_AGENT' }, calls: ['actual'] });
	});

	test('GetQueue crosses desktop client and host allowlist without losing version precision', async () => {
		const calls: string[] = [];
		const state = { items: [], isPaused: false, isProcessing: false, pauseReason: 'NONE', version: '9007199254740993' };
		const service = { team: new FakeWindowService().team, getConnectionSnapshot: () => ({ pairingPending: false }), isEngineConnected: () => false, getQueue: async (request: { sessionId: string }) => { calls.push(request.sessionId); return state; } };
		const inner = ProxyChannel.fromService<string>(service, store.add(new DisposableStore()));
		const channel = new UniverseAgentConnectionIpcChannel(service, inner);
		const client = store.add(new UniverseAgentConnectionChannelClient({ call: (command, arg) => channel.call('ctx', command, arg), listen: () => Event.None }));
		assert.deepStrictEqual(await client.getQueue?.({ sessionId: 'actual' }), state);
		assert.deepStrictEqual(calls, ['actual']);
	});

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

	const strictMethods = [
		['upsertProviderCredentials', 1], ['clearProviderCredentials', 1],
		['upsertModel', 1], ['deleteModel', 1], ['setModelEnabled', 1],
		['testModelProfile', 1], ['importHarnessProviders', 1],
		['listProviderStatus', 0], ['listModels', 0], ['getSessionInfo', 1],
		['setSkillEnabled', 1], ['saveSkillContent', 1], ['listSkills', 0], ['getSkillInfo', 1],
		['saveMemory', 1], ['deleteMemory', 1],
	] as const;
	// Independent literal: never derive the expected surface from the production registry.
	const catalogMethods = [
		['saveAgentProfile', 1], ['deleteAgentProfile', 1], ['resetAgentProfile', 1],
		['upsertProjectRule', 1], ['deleteProjectRule', 1],
		['addMcpServer', 1], ['updateMcpServer', 1], ['removeMcpServer', 1], ['toggleMcpServer', 1],
		['enablePlugin', 2], ['reloadPlugin', 1], ['unloadPlugin', 1], ['scanNewPlugins', 0],
		['upsertTrigger', 1], ['deleteTrigger', 1], ['setTriggerEnabled', 1], ['fireTrigger', 1],
		['writeClipboard', 1], ['clearClipboard', 1],
	] as const;

	test('catalog mutation registry exactly matches the independent nineteen owner argument positions', () => {
		assert.deepStrictEqual(Object.entries(UNIVERSE_AGENT_CATALOG_MUTATION_OWNER_ARGUMENT_INDEXES).sort(), [...catalogMethods].sort());
	});

	for (const [command, ownerIndex] of catalogMethods) {
		test(`catalog published owner IPC gate: ${command} refuses before business revive or inner lookup`, async () => {
			const forwarded: unknown[] = [];
			let connected = true;
			let pairingPending = false;
			let identity: string | undefined;
			const channel = new UniverseAgentConnectionIpcChannel({
				team: new FakeWindowService().team,
				getConnectionSnapshot: () => ({ linkId: 2, engineIdentityId: identity, pairingPending }),
				isEngineConnected: () => connected,
			}, {
				call: async <T>(_ctx: string, _command: string, args?: unknown): Promise<T> => { forwarded.push(args); return undefined as T; },
				listen: () => Event.None,
			});
			const argsFor = (owner: unknown) => {
				const args: unknown[] = Array.from({ length: ownerIndex }, () => ({ $mid: MarshalledId.Regexp, source: '[', flags: '' }));
				args.push(owner);
				return args;
			};
			const invalid: unknown[] = [undefined, null, [], {}, { linkId: 1 }, { linkId: 2, engineIdentityId: 'other' },
				{ linkId: 2, extra: true }, { linkId: 2, [Symbol('extra')]: true }, { linkId: 0 }, { linkId: 1.5 },
				Object.assign(Object.create({ engineIdentityId: undefined }), { linkId: 2 }),
				Object.defineProperty({}, 'linkId', { get: () => { throw new Error('must not read'); } })];
			for (const owner of invalid) {
				assert.throws(() => channel.call('ctx', command, argsFor(owner)), isCancellationError);
			}
			connected = false;
			assert.throws(() => channel.call('ctx', command, argsFor({ linkId: 2 })), isCancellationError);
			connected = true;
			pairingPending = true;
			assert.throws(() => channel.call('ctx', command, argsFor({ linkId: 2 })), isCancellationError);
			pairingPending = false;
			assert.deepStrictEqual(forwarded, []);
			for (identity of [undefined, 'engine']) {
				const args = argsFor({ linkId: 2, engineIdentityId: identity });
				await channel.call('ctx', command, args);
				assert.strictEqual(forwarded[forwarded.length - 1], args);
			}
		});
	}

	const currentOwner = { engineIdentityId: 'engine-b', linkId: 2 };

	for (const identity of [undefined, 'engine-b']) {
		test(`session Delete IPC requires exact ownership before inner dispatch (identity: ${identity})`, async () => {
			const forwarded: unknown[] = [];
			let connected = true;
			let pairingPending = false;
			const channel = new UniverseAgentConnectionIpcChannel({
				team: new FakeWindowService().team,
				getConnectionSnapshot: () => ({ linkId: 2, engineIdentityId: identity, pairingPending }),
				isEngineConnected: () => connected,
			}, {
				call: async <T>(_ctx: string, _command: string, args?: unknown): Promise<T> => { forwarded.push(args); return undefined as T; },
				listen: () => Event.None,
			});
			const expected = { linkId: 2, engineIdentityId: identity };
			const invalid: unknown[] = [undefined, null, {}, [], { ...expected, linkId: 1 }, { ...expected, linkId: '2' },
				{ ...expected, engineIdentityId: identity === undefined ? 'engine-b' : undefined }, { ...expected, extra: true }];
			for (const owner of invalid) {
				const error = await Promise.resolve().then(() => channel.call('ctx', 'deleteSession', [{ $mid: MarshalledId.Regexp, source: '[', flags: '' }, owner])).then(() => undefined, error => error);
				assert.strictEqual(isCancellationError(error), true);
			}
			for (const state of ['disconnected', 'pairing'] as const) {
				connected = state !== 'disconnected';
				pairingPending = state === 'pairing';
				const error = await Promise.resolve().then(() => channel.call('ctx', 'deleteSession', [{ sessionId: 'same-id' }, expected])).then(() => undefined, error => error);
				assert.strictEqual(isCancellationError(error), true);
			}
			assert.deepStrictEqual(forwarded, []);
			connected = true;
			pairingPending = false;
			const args = [{ sessionId: 'same-id' }, expected];
			await channel.call('ctx', 'deleteSession', args);
			assert.deepStrictEqual(forwarded, [args]);
		});
	}

	for (const [command, ownerIndex] of strictMethods) {
		test(`expected owner IPC gate: ${command} rejects missing malformed and stale owners before inner dispatch`, async () => {
			const forwarded: unknown[] = [];
			let connected = true;
			let pairingPending = false;
			const channel = new UniverseAgentConnectionIpcChannel({
				team: new FakeWindowService().team,
				getConnectionSnapshot: () => ({ ...currentOwner, pairingPending }),
				isEngineConnected: () => connected,
			}, {
				call: async <T>(_ctx: string, _command: string, args?: unknown): Promise<T> => { forwarded.push(args); return undefined as T; },
				listen: () => Event.None,
			});
			const invalidOwners: unknown[] = [
				undefined, null, {}, [],
				{ engineIdentityId: '', linkId: 2 }, { engineIdentityId: 'engine-b', linkId: 0 },
				{ engineIdentityId: 'engine-b', linkId: 1.5 }, { engineIdentityId: 'engine-b', linkId: Number.MAX_SAFE_INTEGER + 1 },
				{ engineIdentityId: 'engine-a', linkId: 1 }, { engineIdentityId: 'engine-b', linkId: 1 },
				{ $mid: MarshalledId.Regexp, source: '[', flags: '' },
				{ ...currentOwner, $mid: MarshalledId.Regexp, source: '[', flags: '' },
			];
			const cancelled: boolean[] = [];
			for (const owner of invalidOwners) {
				const args = ownerIndex === 0 ? [owner] : [{ business: 'unchanged' }, owner];
				const error = await Promise.resolve().then(() => channel.call('ctx', command, args)).then(() => undefined, error => error);
				cancelled.push(isCancellationError(error));
			}
			for (const state of ['disconnected', 'pairing'] as const) {
				connected = state !== 'disconnected';
				pairingPending = state === 'pairing';
				const args = ownerIndex === 0 ? [currentOwner] : [{ business: 'unchanged' }, currentOwner];
				const error = await Promise.resolve().then(() => channel.call('ctx', command, args)).then(() => undefined, error => error);
				cancelled.push(isCancellationError(error));
			}
			assert.deepStrictEqual({ forwarded, cancelled }, { forwarded: [], cancelled: Array(invalidOwners.length + 2).fill(true) });
			connected = true;
			pairingPending = false;
			const validArgs = ownerIndex === 0 ? [currentOwner] : [{ business: 'unchanged' }, currentOwner];
			await channel.call('ctx', command, validArgs);
			assert.deepStrictEqual(forwarded, [validArgs]);
		});
	}

	test('expected owner IPC gate: missing owner wins over malformed business marshalling', async () => {
		let dispatches = 0;
		const service = {
			team: new FakeWindowService().team,
			getConnectionSnapshot: () => ({ ...currentOwner, pairingPending: false }),
			isEngineConnected: () => true,
			saveSkillContent: async () => { dispatches++; return { ok: true }; },
		};
		const inner = ProxyChannel.fromService<string>(service, store.add(new DisposableStore()));
		const channel = new UniverseAgentConnectionIpcChannel(service, inner);
		const malformedRequest = { $mid: MarshalledId.Regexp, source: '[', flags: '' };
		const error = await Promise.resolve().then(() => channel.call('ctx', 'saveSkillContent', [malformedRequest])).then(() => undefined, error => error);
		assert.deepStrictEqual({ cancelled: isCancellationError(error), dispatches }, { cancelled: true, dispatches: 0 });
	});

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

	test('one inner proxy registered under the exported connection and hub names keeps each allowlist', async () => {
		const { service, connection, hub } = open();
		const [serverProtocol, clientProtocol] = createProtocolPair();
		const server = store.add(new ChannelServer<string>(serverProtocol, 'ctx'));
		server.registerChannel(universeAgentConnectionChannelName, connection);
		server.registerChannel(universeAgentHubChannelName, hub);
		const client = store.add(new ChannelClient(clientProtocol));
		const connectionChannel = client.getChannel(universeAgentConnectionChannelName);
		const hubChannel = client.getChannel(universeAgentHubChannelName);

		assert.strictEqual(universeAgentHubChannelName, 'universeAgentHub');
		assert.notStrictEqual(universeAgentHubChannelName, universeAgentConnectionChannelName);
		assert.deepStrictEqual(await connectionChannel.call('probeEngine'), { ok: false, reason: 'x' });
		assert.deepStrictEqual(await hubChannel.call('login', ['https://hub.example', 'a@b.c', 'pw']), { ok: true });
		await assert.rejects(connectionChannel.call('login', ['https://hub.example', 'a@b.c', 'pw']), /Method not found: login/);
		await assert.rejects(connectionChannel.call('notifyFileMutation', [{}]), /Method not found: notifyFileMutation/);
		await assert.rejects(hubChannel.call('probeEngine'), /Method not found: probeEngine/);
		assert.deepStrictEqual(service.forwarded, ['probeEngine', 'login']);
	});
});
