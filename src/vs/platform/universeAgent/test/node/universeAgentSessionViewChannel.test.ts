/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { Event } from '../../../../base/common/event.js';
import * as path from '../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ConversationWriteMessage } from '../../common/conversationViewFrame.js';
import {
	UniverseAgentSessionViewChannel,
	windowConnectionContext,
	type UniverseAgentSessionViewChannelService,
} from '../../electron-main/universeAgentSessionViewChannel.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(thisDir, '../../../../../../');
const MAIN_PROCESS_SERVICE_PATH = path.join(REPO_ROOT, 'src/vs/platform/ipc/electron-browser/mainProcessService.ts');

class FakeSessionViewService implements UniverseAgentSessionViewChannelService {
	readonly acquireLeaseForCalls: Array<{ readonly owner: string; readonly sessionId: string }> = [];
	readonly forwarded: string[] = [];

	async acquireLeaseFor(owner: string, sessionId: string): Promise<string> {
		this.acquireLeaseForCalls.push({ owner, sessionId });
		return `lease:${owner}:${sessionId}`;
	}

	async whenEngineSessionReady(sessionId: string): Promise<string> {
		this.forwarded.push(`whenEngineSessionReady:${sessionId}`);
		return sessionId;
	}

	async releaseLease(leaseId: string): Promise<void> {
		this.forwarded.push(`releaseLease:${leaseId}`);
	}

	async post(leaseId: string, _msg: ConversationWriteMessage) {
		this.forwarded.push(`post:${leaseId}`);
		return { accepted: true as const, correlation: { id: 'c' } };
	}

	async requestResync(leaseId: string): Promise<void> {
		this.forwarded.push(`requestResync:${leaseId}`);
	}

	async acknowledge(leaseId: string): Promise<void> {
		this.forwarded.push(`acknowledge:${leaseId}`);
	}

	async requestDetail(leaseId: string, ref: string) {
		this.forwarded.push(`requestDetail:${leaseId}:${ref}`);
		return { ok: false as const, reason: 'unavailable' as const };
	}

	onDynamicDidApplyFrame(leaseId: string) {
		this.forwarded.push(`onDynamicDidApplyFrame:${leaseId}`);
		return Event.None;
	}
}

suite('UniverseAgentSessionViewChannel', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('acquireLease uses IPC ctx as owner', async () => {
		const service = new FakeSessionViewService();
		const channel = new UniverseAgentSessionViewChannel(service);
		const leaseId = await channel.call('window:3', 'acquireLease', ['sess-1']);
		assert.strictEqual(leaseId, 'lease:window:3:sess-1');
		assert.deepStrictEqual(service.acquireLeaseForCalls, [{ owner: 'window:3', sessionId: 'sess-1' }]);
	});

	test('forwards the six methods plus acknowledge', async () => {
		const service = new FakeSessionViewService();
		const channel = new UniverseAgentSessionViewChannel(service);
		await channel.call('window:1', 'whenEngineSessionReady', ['sess']);
		await channel.call('window:1', 'releaseLease', ['lease-1']);
		await channel.call('window:1', 'post', ['lease-1', { kind: 'submitInput', text: 'x' }]);
		await channel.call('window:1', 'requestResync', ['lease-1']);
		await channel.call('window:1', 'acknowledge', ['lease-1', { generation: 1, frameId: 1, appliedVersion: 1 }]);
		await channel.call('window:1', 'requestDetail', ['lease-1', 'ref-1']);
		channel.listen('window:1', 'onDynamicDidApplyFrame', 'lease-1');
		assert.deepStrictEqual(service.forwarded, [
			'whenEngineSessionReady:sess',
			'releaseLease:lease-1',
			'post:lease-1',
			'requestResync:lease-1',
			'acknowledge:lease-1',
			'requestDetail:lease-1:ref-1',
			'onDynamicDidApplyFrame:lease-1',
		]);
	});

	test('unknown command and event throw', () => {
		const channel = new UniverseAgentSessionViewChannel(new FakeSessionViewService());
		assert.throws(
			() => channel.call('window:1', 'inventedMethod', []),
			(error: unknown) => error instanceof Error && error.message === 'Method not found: inventedMethod',
		);
		assert.throws(
			() => channel.listen('window:1', 'onDidApplyFrame', 'lease-1'),
			(error: unknown) => error instanceof Error && error.message === 'Event not found: onDidApplyFrame',
		);
	});

	test('windowConnectionContext matches mainProcessService literal', () => {
		assert.strictEqual(windowConnectionContext(7), 'window:7');
		const source = fs.readFileSync(MAIN_PROCESS_SERVICE_PATH, 'utf8');
		assert.ok(source.includes('`window:${windowId}`'), 'mainProcessService.ts must keep window:${windowId} hello ctx');
	});
});
