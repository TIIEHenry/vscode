/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, ok, strictEqual } from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IProcessDataEvent } from '../../../../../platform/terminal/common/terminal.js';
import { IUniverseAgentPty, type UniverseAgentPtyClientFrame, type UniverseAgentPtyServerFrame } from '../../../../../platform/universeAgent/common/universeAgentPty.js';
import { UniverseAgentCustomPty } from '../../browser/universeAgentPtyTerminal.js';

class MockUniverseAgentPtyBridge implements IUniverseAgentPty {
	declare readonly _serviceBrand: undefined;

	readonly onServerFrame = new Emitter<UniverseAgentPtyServerFrame>();

	isBridgeAvailable(): Promise<boolean> {
		return Promise.resolve(true);
	}

	openStream(): Promise<string> {
		return Promise.resolve('stream-1');
	}

	async sendClientMessage(_streamId: string, frame: UniverseAgentPtyClientFrame): Promise<void> {
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
		return Promise.resolve();
	}

	dispose(): void {
		this.onServerFrame.dispose();
	}
}

suite('UniverseAgentCustomPty', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('error frame after launch writes the message and exits with a non-zero code', async () => {
		const bridge = store.add(new MockUniverseAgentPtyBridge());
		const pty = store.add(new UniverseAgentCustomPty(1, 80, 24, bridge, 'engine-session'));
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
});

function processDataText(event: string | IProcessDataEvent): string {
	return typeof event === 'string' ? event : event.data;
}
