/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ChannelClient, ChannelServer, IMessagePassingProtocol, ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { UniverseAgentPtyChannel, type IUniverseAgentPtyStreamHost } from '../../electron-main/universeAgentPtyChannel.js';
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

suite('UniverseAgentPtyChannel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('IPC serialization round-trips openSession, read bytes, write, resize, and close', async () => {
		const host = new FakePtyHost();
		const [clientProtocol, serverProtocol] = createProtocolPair();
		store.add(clientProtocol);
		store.add(serverProtocol);
		const client = store.add(new ChannelClient(clientProtocol));
		const server = store.add(new ChannelServer(serverProtocol, 'window:1'));
		const channel = store.add(new UniverseAgentPtyChannel(host));
		server.registerChannel(universeAgentPtyChannelName, channel);
		const pty = ProxyChannel.toService<IUniverseAgentPty>(client.getChannel(universeAgentPtyChannelName));

		assert.strictEqual(await pty.isBridgeAvailable(), true);

		const streamId = await pty.openStream();
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
});
