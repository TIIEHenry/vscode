/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ChannelClient, ChannelServer, IMessagePassingProtocol, ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { UniverseAgentPtyChannel, type IUniverseAgentPtyStreamHost } from '../../electron-main/universeAgentPtyChannel.js';
import type { UniverseAgentExpectedOwner } from '../../common/universeAgentExpectedOwner.js';
import { IUniverseAgentPty, universeAgentPtyChannelName } from '../../common/universeAgentPty.js';
import type {
	UniverseAgentPtyClientMessage,
	UniverseAgentPtyServerMessage,
	UniverseAgentPtyStream,
	UniverseAgentSessionStreamCloseCause,
} from '../../common/universeAgentTypes.js';

class QueueProtocol extends Disposable implements IMessagePassingProtocol {

	private buffering = true;
	private buffers: VSBuffer[] = [];
	other: QueueProtocol | undefined;

	private readonly _onMessage: Emitter<VSBuffer>;
	readonly onMessage: Event<VSBuffer>;

	constructor() {
		super();
		this._onMessage = this._register(new Emitter<VSBuffer>({
			onDidAddFirstListener: () => {
				const buffered = this.buffers;
				this.buffers = [];
				this.buffering = false;
				for (const buffer of buffered) {
					this._onMessage.fire(buffer);
				}
			},
			onDidRemoveLastListener: () => {
				this.buffering = true;
			},
		}));
		this.onMessage = this._onMessage.event;
	}

	send(buffer: VSBuffer): void {
		const other = this.other;
		if (!other) {
			throw new Error('Pty IPC test protocol is not paired');
		}
		other.receive(buffer);
	}

	private receive(buffer: VSBuffer): void {
		if (this.buffering) {
			this.buffers.push(buffer);
			return;
		}
		this._onMessage.fire(buffer);
	}
}

function createProtocolPair(): [QueueProtocol, QueueProtocol] {
	const one = new QueueProtocol();
	const other = new QueueProtocol();
	one.other = other;
	other.other = one;
	return [one, other];
}

class FakePtyHost implements IUniverseAgentPtyStreamHost {
	readonly writes: UniverseAgentPtyClientMessage[] = [];
	onResponse: ((message: UniverseAgentPtyServerMessage) => void) | undefined;
	onClosed: ((cause: UniverseAgentSessionStreamCloseCause) => void) | undefined;
	ended = 0;
	disposed = 0;
	connected = true;
	snapshot: { engineIdentityId?: string; linkId?: number; pairingPending: boolean } = {
		engineIdentityId: 'engine-1',
		linkId: 1,
		pairingPending: false,
	};

	getConnectionSnapshot() {
		return this.snapshot;
	}

	isEngineConnected(): boolean {
		return this.connected;
	}

	openPtyStream(
		onResponse: (message: UniverseAgentPtyServerMessage) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentPtyStream {
		this.onResponse = onResponse;
		this.onClosed = onClosed;
		return {
			write: message => { this.writes.push(message); },
			end: () => { this.ended += 1; },
			dispose: () => { this.disposed += 1; },
		};
	}
}

function assertUint8(data: Uint8Array, expected: readonly number[]): void {
	assert.ok(data instanceof Uint8Array, 'openPtyStream write data must be Uint8Array');
	assert.strictEqual(typeof data, 'object');
	assert.strictEqual(data.byteLength, expected.length);
	assert.deepStrictEqual(Array.from(data), [...expected]);
}

function assertVSBuffer(value: VSBuffer, expected: readonly number[]): void {
	assert.ok(value instanceof VSBuffer);
	assert.strictEqual(value.byteLength, expected.length);
	for (let i = 0; i < expected.length; i++) {
		assert.strictEqual(value.readUInt8(i), expected[i]);
	}
}

const owner: UniverseAgentExpectedOwner = { engineIdentityId: 'engine-1', linkId: 1 };

async function createHarness(store: ReturnType<typeof ensureNoDisposablesAreLeakedInTestSuite>) {
	const host = new FakePtyHost();
	const [clientProtocol, serverProtocol] = createProtocolPair();
	store.add(clientProtocol);
	store.add(serverProtocol);
	const client = store.add(new ChannelClient(clientProtocol));
	const server = store.add(new ChannelServer(serverProtocol, 'window:1'));
	const channel = store.add(new UniverseAgentPtyChannel(host));
	server.registerChannel(universeAgentPtyChannelName, channel);
	const pty = ProxyChannel.toService<IUniverseAgentPty>(client.getChannel(universeAgentPtyChannelName));
	return { host, pty };
}

suite('UniverseAgentPtyChannel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('IPC serialization round-trips openSession, read bytes, write, resize, and close', async () => {
		const { host, pty } = await createHarness(store);

		assert.strictEqual(await pty.isBridgeAvailable(), true);

		const streamId = await pty.openStream(owner);
		assert.strictEqual(typeof streamId, 'string');
		assert.ok(streamId.length > 0);
		assert.ok(host.onResponse);

		host.onResponse({
			openSessionResponse: {
				success: false,
				ptySessionId: '',
				failureReason: '',
				errorMessage: '',
			},
		});
		host.onResponse({ read: { data: new Uint8Array(0) } });
		host.onResponse({ read: { data: Uint8Array.from([0x00, 0xFF]) } });
		host.onResponse({ sessionClosed: { exitCode: 0, title: '' } });

		const frames: unknown[] = [];
		store.add(pty.onDynamicPtyServerMessage(streamId)(frame => frames.push(frame)));

		assert.strictEqual(frames.length, 4);
		assert.deepStrictEqual(frames[0], ['openSessionResponse', {
			success: false,
			ptySessionId: '',
			failureReason: '',
			errorMessage: '',
		}]);
		assert.strictEqual((frames[1] as readonly [string, VSBuffer])[0], 'read');
		assertVSBuffer((frames[1] as readonly [string, VSBuffer])[1], []);
		assert.strictEqual((frames[2] as readonly [string, VSBuffer])[0], 'read');
		assertVSBuffer((frames[2] as readonly [string, VSBuffer])[1], [0x00, 0xFF]);
		assert.deepStrictEqual(frames[3], ['sessionClosed', { exitCode: 0, title: '' }]);

		await pty.sendClientMessage(streamId, ['openSession', {
			engineSessionId: '',
			clientSessionId: '',
			tabId: '',
			workingDirectory: '',
			shellCommand: '',
			shellArgs: [''],
			environment: { '': '' },
			initialCommand: '',
			columns: 0,
			rows: 0,
		}]);
		await pty.sendClientMessage(streamId, ['write', VSBuffer.wrap(Uint8Array.from([0x00, 0xFF]))]);
		await pty.sendClientMessage(streamId, ['write', VSBuffer.wrap(new Uint8Array(0))]);
		await pty.sendClientMessage(streamId, ['resize', 0, 0]);
		await pty.sendClientMessage(streamId, ['close', false]);

		assert.strictEqual(host.writes.length, 5);
		assert.deepStrictEqual(host.writes[0].openSession, {
			engineSessionId: '',
			clientSessionId: '',
			tabId: '',
			workingDirectory: '',
			shellCommand: '',
			shellArgs: [''],
			environment: { '': '' },
			initialCommand: '',
			columns: 0,
			rows: 0,
		});
		const binaryWrite = host.writes[1].write;
		const emptyWrite = host.writes[2].write;
		if (!binaryWrite || !emptyWrite) {
			assert.fail('write payloads missing');
		}
		assertUint8(binaryWrite.data, [0x00, 0xFF]);
		assertUint8(emptyWrite.data, []);
		assert.deepStrictEqual(host.writes[3].resize, { columns: 0, rows: 0 });
		assert.deepStrictEqual(host.writes[4].close, { interruptOnly: false });
	});

	test('openStream fails closed without a matching expectedOwner', async () => {
		const { host, pty } = await createHarness(store);

		const attempts: Promise<string>[] = [
			pty.openStream(undefined as unknown as UniverseAgentExpectedOwner),
			pty.openStream({} as UniverseAgentExpectedOwner),
			pty.openStream({ engineIdentityId: 'engine-other', linkId: 1 }),
			pty.openStream({ engineIdentityId: 'engine-1', linkId: 99 }),
			pty.openStream({ engineIdentityId: 'engine-1', linkId: 0 }),
		];
		for (const attempt of attempts) {
			const result = await attempt.then(() => 'resolved', err => err);
			assert.ok(result !== 'resolved', 'openStream must reject fail-closed');
			assert.ok(isCancellationError(result), 'owner gate rejects with CancellationError');
		}

		host.connected = false;
		const disconnected = await pty.openStream(owner).then(() => 'resolved', err => err);
		assert.ok(disconnected !== 'resolved');
		assert.ok(isCancellationError(disconnected));
		host.connected = true;

		const streamId = await pty.openStream(owner);
		assert.ok(streamId.length > 0);
	});

	test('stream end after a formal exit does not emit a second error frame', async () => {
		const { host, pty } = await createHarness(store);
		const streamId = await pty.openStream(owner);
		const frames: unknown[] = [];
		store.add(pty.onDynamicPtyServerMessage(streamId)(frame => frames.push(frame)));

		host.onResponse!({ sessionClosed: { exitCode: 0, title: '' } });
		host.onClosed!({ kind: 'remote' });

		assert.deepStrictEqual(frames, [['sessionClosed', { exitCode: 0, title: '' }]]);
	});

	test('premature end without a formal exit emits a non-empty error frame', async () => {
		const { host, pty } = await createHarness(store);
		const streamId = await pty.openStream(owner);
		const frames: unknown[] = [];
		store.add(pty.onDynamicPtyServerMessage(streamId)(frame => frames.push(frame)));

		host.onClosed!({ kind: 'remote' });

		assert.strictEqual(frames.length, 1);
		assert.strictEqual((frames[0] as readonly [string, { code: string; message: string }])[0], 'error');
		const payload = (frames[0] as readonly [string, { code: string; message: string }])[1];
		assert.ok(payload.message.length > 0, 'premature end must map to a non-empty error');

		// A second close is idempotent: no additional terminal frame.
		host.onClosed!({ kind: 'error', message: 'boom' });
		assert.strictEqual(frames.length, 1);
	});

	test('disposeStream recycles the slot idempotently without ending a fresh handle twice', async () => {
		const { host, pty } = await createHarness(store);
		const streamId = await pty.openStream(owner);
		const frames: unknown[] = [];
		store.add(pty.onDynamicPtyServerMessage(streamId)(frame => frames.push(frame)));

		await pty.disposeStream(streamId);
		await pty.disposeStream(streamId);
		assert.strictEqual(host.ended, 1);
		assert.strictEqual(host.disposed, 1);

		// Late server frames after release are dropped, not delivered.
		host.onResponse!({ read: { data: Uint8Array.from([65]) } });
		assert.deepStrictEqual(frames, []);
	});

	test('terminal frames emitted before the first listen are flushed, not lost', async () => {
		const { host, pty } = await createHarness(store);
		const streamId = await pty.openStream(owner);

		// No listener yet: these must queue on the slot.
		host.onResponse!({ sessionClosed: { exitCode: 0, title: '' } });

		const frames: unknown[] = [];
		store.add(pty.onDynamicPtyServerMessage(streamId)(frame => frames.push(frame)));

		assert.deepStrictEqual(frames, [['sessionClosed', { exitCode: 0, title: '' }]]);
	});
});
