/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, ok, strictEqual } from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { timeout } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IProcessDataEvent } from '../../../../../platform/terminal/common/terminal.js';
import type { UniverseAgentExpectedOwner } from '../../../../../platform/universeAgent/common/universeAgentExpectedOwner.js';
import { IUniverseAgentPty, type UniverseAgentPtyClientFrame, type UniverseAgentPtyServerFrame } from '../../../../../platform/universeAgent/common/universeAgentPty.js';
import { UniverseAgentCustomPty } from '../../browser/universeAgentPtyTerminal.js';

const owner: UniverseAgentExpectedOwner = { engineIdentityId: 'engine-1', linkId: 1 };

class MockUniverseAgentPtyBridge implements IUniverseAgentPty {
	declare readonly _serviceBrand: undefined;

	readonly onServerFrame = new Emitter<UniverseAgentPtyServerFrame>();
	readonly sentFrames: UniverseAgentPtyClientFrame[] = [];
	readonly openedOwners: (UniverseAgentExpectedOwner | undefined)[] = [];
	disposeStreamCalls = 0;

	isBridgeAvailable(): Promise<boolean> {
		return Promise.resolve(true);
	}

	openStream(expectedOwner: UniverseAgentExpectedOwner): Promise<string> {
		this.openedOwners.push(expectedOwner);
		return Promise.resolve('stream-1');
	}

	async sendClientMessage(_streamId: string, frame: UniverseAgentPtyClientFrame): Promise<void> {
		this.sentFrames.push(frame);
		if (frame[0] === 'openSession') {
			this.onServerFrame.fire(['openSessionResponse', {
				success: true,
				ptySessionId: 'pty-1',
				failureReason: '',
			}]);
		}
	}

	onDynamicPtyServerMessage(_streamId: string) {
		return this.onServerFrame.event;
	}

	disposeStream(_streamId: string): Promise<void> {
		this.disposeStreamCalls++;
		return Promise.resolve();
	}

	dispose(): void {
		this.onServerFrame.dispose();
	}
}

class SilentUniverseAgentPtyBridge implements IUniverseAgentPty {
	declare readonly _serviceBrand: undefined;

	readonly onServerFrame = new Emitter<UniverseAgentPtyServerFrame>();
	readonly openedOwners: (UniverseAgentExpectedOwner | undefined)[] = [];

	isBridgeAvailable(): Promise<boolean> {
		return Promise.resolve(true);
	}

	openStream(expectedOwner: UniverseAgentExpectedOwner): Promise<string> {
		this.openedOwners.push(expectedOwner);
		return Promise.resolve('stream-1');
	}

	sendClientMessage(_streamId: string, _frame: UniverseAgentPtyClientFrame): Promise<void> {
		return Promise.resolve();
	}

	onDynamicPtyServerMessage(_streamId: string) {
		return this.onServerFrame.event;
	}

	disposeStream(_streamId: string): Promise<void> {
		return Promise.resolve();
	}

	dispose(): void {
		this.onServerFrame.dispose();
	}
}

/** `openStream` never settles so the startup chain blocks on the first await. */
class PendingOpenBridge implements IUniverseAgentPty {
	declare readonly _serviceBrand: undefined;

	readonly onServerFrame = new Emitter<UniverseAgentPtyServerFrame>();
	readonly sentFrames: UniverseAgentPtyClientFrame[] = [];
	disposeStreamCalls = 0;

	isBridgeAvailable(): Promise<boolean> {
		return Promise.resolve(true);
	}

	openStream(): Promise<string> {
		return new Promise<string>(() => { /* intentionally never settles */ });
	}

	sendClientMessage(_streamId: string, frame: UniverseAgentPtyClientFrame): Promise<void> {
		this.sentFrames.push(frame);
		return Promise.resolve();
	}

	onDynamicPtyServerMessage(_streamId: string) {
		return this.onServerFrame.event;
	}

	disposeStream(_streamId: string): Promise<void> {
		this.disposeStreamCalls++;
		return Promise.resolve();
	}

	dispose(): void {
		this.onServerFrame.dispose();
	}
}

/** The `close` frame send never settles; `disposeStream` must still run. */
class HangingCloseBridge implements IUniverseAgentPty {
	declare readonly _serviceBrand: undefined;

	readonly onServerFrame = new Emitter<UniverseAgentPtyServerFrame>();
	disposeStreamCalls = 0;

	isBridgeAvailable(): Promise<boolean> {
		return Promise.resolve(true);
	}

	openStream(): Promise<string> {
		return Promise.resolve('stream-1');
	}

	sendClientMessage(_streamId: string, frame: UniverseAgentPtyClientFrame): Promise<void> {
		if (frame[0] === 'close') {
			return new Promise<void>(() => { /* close IPC never completes */ });
		}
		if (frame[0] === 'openSession') {
			this.onServerFrame.fire(['openSessionResponse', {
				success: true,
				ptySessionId: 'pty-1',
				failureReason: '',
			}]);
		}
		return Promise.resolve();
	}

	onDynamicPtyServerMessage(_streamId: string) {
		return this.onServerFrame.event;
	}

	disposeStream(_streamId: string): Promise<void> {
		this.disposeStreamCalls++;
		return Promise.resolve();
	}

	dispose(): void {
		this.onServerFrame.dispose();
	}
}

/** Fire-and-forget sends reject; the pty must consume those rejections. */
class RejectingBridge extends MockUniverseAgentPtyBridge {

	override sendClientMessage(_streamId: string, frame: UniverseAgentPtyClientFrame): Promise<void> {
		if (frame[0] !== 'openSession') {
			return Promise.reject(new Error('send failed'));
		}
		return super.sendClientMessage(_streamId, frame);
	}
}

suite('UniverseAgentCustomPty', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('openSession without a response fails the launch', async () => {
		const bridge = store.add(new SilentUniverseAgentPtyBridge());
		const pty = store.add(new UniverseAgentCustomPty(1, 80, 24, bridge, 'engine-session', () => owner, 20));

		const launchResult = await pty.start();

		ok(launchResult);
		strictEqual(typeof launchResult, 'object');
		ok('message' in launchResult);
		ok(launchResult.message.length > 0);
		deepStrictEqual(bridge.openedOwners, [owner]);
	});

	test('error frame after launch writes the message and exits with a non-zero code', async () => {
		const bridge = store.add(new MockUniverseAgentPtyBridge());
		const pty = store.add(new UniverseAgentCustomPty(1, 80, 24, bridge, 'engine-session', () => owner));
		const data: string[] = [];
		const exits: unknown[] = [];
		store.add(pty.onProcessData(event => data.push(processDataText(event))));
		store.add(pty.onProcessExit(code => exits.push(code)));

		const launchResult = await pty.start();
		strictEqual(launchResult, undefined);
		deepStrictEqual(exits, []);

		const message = 'engine pty failed';
		bridge.onServerFrame.fire(['error', { code: 'INTERNAL', message }]);

		deepStrictEqual(data, [message]);
		strictEqual(exits.length, 1);
		const exitCode = exits[0];
		strictEqual(typeof exitCode, 'number');
		ok(exitCode !== 0);
		strictEqual(exitCode, 1);
		ok(exitCode !== undefined);
		ok(exitCode === null || typeof exitCode !== 'object');
	});

	test('shutdown during the openStream await wakes start without waiting for the stream', async () => {
		const bridge = store.add(new PendingOpenBridge());
		const pty = store.add(new UniverseAgentCustomPty(1, 80, 24, bridge, 'engine-session', () => owner, 60_000));

		const started = pty.start();
		pty.shutdown(true);
		const launchResult = await started;

		ok(launchResult);
		ok('message' in launchResult);
		ok(launchResult.message.length > 0);
	});

	test('the deadline covers openStream, not only the openSession wait', async () => {
		const bridge = store.add(new PendingOpenBridge());
		const pty = store.add(new UniverseAgentCustomPty(1, 80, 24, bridge, 'engine-session', () => owner, 20));

		const launchResult = await pty.start();

		ok(launchResult);
		ok('message' in launchResult);
		ok(launchResult.message.length > 0);
	});

	test('missing owner fails the launch before any bridge call', async () => {
		const bridge = store.add(new MockUniverseAgentPtyBridge());
		const pty = store.add(new UniverseAgentCustomPty(1, 80, 24, bridge, 'engine-session', () => undefined, 60_000));

		const launchResult = await pty.start();

		ok(launchResult);
		ok('message' in launchResult);
		ok(launchResult.message.length > 0);
		deepStrictEqual(bridge.openedOwners, []);
	});

	test('close frame rejection does not block disposeStream', async () => {
		const bridge = store.add(new HangingCloseBridge());
		const pty = store.add(new UniverseAgentCustomPty(1, 80, 24, bridge, 'engine-session', () => owner));

		const launchResult = await pty.start();
		strictEqual(launchResult, undefined);

		pty.shutdown(true);

		// disposeStream is issued in the same turn, not chained on the hanging close.
		strictEqual(bridge.disposeStreamCalls, 1);
	});

	test('after exit late frames are dropped and input sends nothing', async () => {
		const bridge = store.add(new MockUniverseAgentPtyBridge());
		const pty = store.add(new UniverseAgentCustomPty(1, 80, 24, bridge, 'engine-session', () => owner));
		const data: string[] = [];
		const exits: unknown[] = [];
		const properties: unknown[] = [];
		store.add(pty.onProcessData(event => data.push(processDataText(event))));
		store.add(pty.onProcessExit(code => exits.push(code)));
		store.add(pty.onDidChangeProperty(e => properties.push(e)));

		const launchResult = await pty.start();
		strictEqual(launchResult, undefined);

		bridge.onServerFrame.fire(['sessionClosed', { exitCode: 0 }]);
		deepStrictEqual(exits, [0]);

		const frameCountAfterExit = bridge.sentFrames.length;
		pty.input('ls');
		pty.resize(120, 40);
		bridge.onServerFrame.fire(['read', VSBuffer.wrap(new Uint8Array([65]))]);
		bridge.onServerFrame.fire(['sessionClosed', { exitCode: 7 }]);
		bridge.onServerFrame.fire(['error', { code: 'X', message: 'late' }]);
		bridge.onServerFrame.fire(['openSessionResponse', { success: true, ptySessionId: '', failureReason: '', workingDirectory: '/late' }]);

		deepStrictEqual(exits, [0]);
		deepStrictEqual(data, []);
		deepStrictEqual(properties, []);
		strictEqual(bridge.sentFrames.length, frameCountAfterExit);
	});

	test('sessionClosed before launch fails the launch instead of firing exit', async () => {
		const bridge = store.add(new SilentUniverseAgentPtyBridge());
		const pty = store.add(new UniverseAgentCustomPty(1, 80, 24, bridge, 'engine-session', () => owner, 60_000));
		const exits: unknown[] = [];
		store.add(pty.onProcessExit(code => exits.push(code)));

		const started = pty.start();
		await timeout(5);
		bridge.onServerFrame.fire(['sessionClosed', { exitCode: 3 }]);
		const launchResult = await started;

		ok(launchResult);
		ok('message' in launchResult);
		deepStrictEqual(exits, []);
	});

	test('fire-and-forget send rejections are consumed', async () => {
		const bridge = store.add(new RejectingBridge());
		const pty = store.add(new UniverseAgentCustomPty(1, 80, 24, bridge, 'engine-session', () => owner));

		const launchResult = await pty.start();
		strictEqual(launchResult, undefined);

		pty.input('x');
		pty.resize(100, 50);
		await timeout(0);
		// No unhandled rejection surfaces; the pty stays usable for shutdown.
		pty.shutdown(true);
		await timeout(0);
	});
});

function processDataText(event: string | IProcessDataEvent): string {
	return typeof event === 'string' ? event : event.data;
}
