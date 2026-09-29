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
import { encodeDetailRef, type ConversationWriteMessage, type DetailFetchOutcome, type PostOutcome } from '../../common/conversationViewFrame.js';
import { NullLogService } from '../../../log/common/log.js';
import {
	UniverseAgentSessionViewChannel,
	windowConnectionContext,
	type UniverseAgentSessionViewChannelService,
} from '../../electron-main/universeAgentSessionViewChannel.js';
import { UniverseAgentSessionViewService } from '../../electron-main/universeAgentSessionViewService.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

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

	async releaseLease(leaseId: string, owner: string): Promise<void> {
		this.forwarded.push(`releaseLease:${leaseId}:${owner}`);
	}

	async post(leaseId: string, _msg: ConversationWriteMessage, owner: string) {
		this.forwarded.push(`post:${leaseId}:${owner}`);
		return { accepted: true as const, correlation: { id: 'c' } };
	}

	async requestResync(leaseId: string, owner: string): Promise<void> {
		this.forwarded.push(`requestResync:${leaseId}:${owner}`);
	}

	async acknowledge(leaseId: string, _ack: { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }, owner: string): Promise<void> {
		this.forwarded.push(`acknowledge:${leaseId}:${owner}`);
	}

	async requestDetail(leaseId: string, ref: string, owner: string) {
		this.forwarded.push(`requestDetail:${leaseId}:${ref}:${owner}`);
		return { ok: false as const, reason: 'unavailable' as const };
	}

	onDynamicDidApplyFrame(leaseId: string) {
		this.forwarded.push(`onDynamicDidApplyFrame:${leaseId}`);
		return Event.None;
	}
}

class OwnerCheckConnection extends TestConnection {
	fetches = 0;
	readonly onRequestAgentTreeRefresh = Event.None;

	fetchAgentTree(): Promise<undefined> {
		return Promise.resolve(undefined);
	}

	isAgentTreeUnsupported(): boolean {
		return true;
	}

	async fetchToolDetail(): Promise<{ readonly ok: true; readonly truncated: false; readonly content: string }> {
		this.fetches += 1;
		return { ok: true, truncated: false, content: 'detail' };
	}

	notifyFileMutation(): void { }
	notifyTurnSettle(): void { }
	notifyTeamRuntimeChange(): void { }
}

suite('UniverseAgentSessionViewChannel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('acquireLease uses IPC ctx as owner', async () => {
		const service = new FakeSessionViewService();
		const channel = new UniverseAgentSessionViewChannel(service);
		const leaseId = await channel.call('window:3', 'acquireLease', ['sess-1']);
		assert.strictEqual(leaseId, 'lease:window:3:sess-1');
		assert.deepStrictEqual(service.acquireLeaseForCalls, [{ owner: 'window:3', sessionId: 'sess-1' }]);

		const connection = new OwnerCheckConnection();
		const sessionView = store.add(new UniverseAgentSessionViewService(connection, new NullLogService()));
		const viewHost = (sessionView as unknown as { host: SessionViewHost }).host;
		viewHost.onEngineConnectionChanged();
		const owned = new UniverseAgentSessionViewChannel(sessionView);
		const ownedLease = await owned.call<string>('window:1', 'acquireLease', ['sess-cross']);
		store.add(viewHost.onDynamicDidApplyFrame(ownedLease)(() => undefined));
		await owned.call('window:1', 'whenEngineSessionReady', ['sess-cross']);

		await owned.call('window:2', 'releaseLease', [ownedLease]);
		await owned.call('window:2', 'requestResync', [ownedLease]);
		await owned.call('window:2', 'acknowledge', [ownedLease, { generation: 1, frameId: 1, appliedVersion: 1 }]);
		const stillHeld = await owned.call<PostOutcome>('window:1', 'post', [ownedLease, { kind: 'submitInput', text: 'still here' }]);
		assert.strictEqual(stillHeld.accepted, true);
		const foreignPost = await owned.call<PostOutcome>('window:2', 'post', [ownedLease, { kind: 'submitInput', text: 'nope' }]);
		assert.strictEqual(foreignPost.accepted, false);
		if (!foreignPost.accepted) {
			assert.strictEqual(foreignPost.reason, 'not_authenticated');
		}
		const foreignDetail = await owned.call<DetailFetchOutcome>('window:2', 'requestDetail', [ownedLease, encodeDetailRef({
			toolCallId: 'tc',
			detailKind: 1,
			refId: 'tc',
		})]);
		assert.strictEqual(foreignDetail.ok, false);
		if (!foreignDetail.ok) {
			assert.strictEqual(foreignDetail.reason, 'failed');
		}
		assert.strictEqual(connection.fetches, 0);

		await owned.call('window:1', 'releaseLease', [ownedLease]);
		const released = await owned.call<PostOutcome>('window:1', 'post', [ownedLease, { kind: 'submitInput', text: 'gone' }]);
		assert.strictEqual(released.accepted, false);
		if (!released.accepted) {
			assert.strictEqual(released.reason, 'no_such_session');
		}

		const localConnection = new TestConnection();
		const localHost = store.add(new SessionViewHost(localConnection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		localHost.onEngineConnectionChanged();
		const localLease = localHost.acquireLease('sess-local');
		await localHost.whenEngineSessionReady('sess-local');
		assert.strictEqual(localHost.post(localLease, { kind: 'submitInput', text: 'held' }).accepted, true);
		localHost.releaseLease(localLease);
		const localGone = localHost.post(localLease, { kind: 'submitInput', text: 'gone' });
		assert.strictEqual(localGone.accepted, false);
		if (!localGone.accepted) {
			assert.strictEqual(localGone.reason, 'no_such_session');
		}
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
			'releaseLease:lease-1:window:1',
			'post:lease-1:window:1',
			'requestResync:lease-1:window:1',
			'acknowledge:lease-1:window:1',
			'requestDetail:lease-1:ref-1:window:1',
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
