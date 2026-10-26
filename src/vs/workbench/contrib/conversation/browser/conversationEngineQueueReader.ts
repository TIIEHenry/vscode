/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RunOnceScheduler } from '../../../../base/common/async.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import type { UniverseAgentCapabilitySupport, UniverseAgentQueueState } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { createEmptyMessageQueueState, type ConversationMessageQueueState } from './conversationMessageQueueModel.js';

export interface ConversationQueueReadScope {
	readonly engineIdentityId?: string;
	readonly linkId?: number;
	readonly leaseGeneration: number;
	readonly localSessionId?: string;
	readonly engineSessionId?: string;
	readonly live: boolean;
	readonly support: UniverseAgentCapabilitySupport;
}

/** Independent read-only snapshot owner; no Chat stream and no optimistic queue items. */
export class ConversationEngineQueueReader extends Disposable {
	private scope: ConversationQueueReadScope | undefined;
	private lastEngineIdentityId: string | undefined;
	private epoch = 0;
	private inflightEpoch: number | undefined;
	private refreshPending = false;
	private readonly states = new Map<string, ConversationMessageQueueState>();
	private readonly versions = new Map<string, bigint>();
	private readonly timer = this._register(new RunOnceScheduler(() => { void this.read(); }, 1000));

	constructor(private readonly fetch: (engineSessionId: string) => Promise<UniverseAgentQueueState>, private readonly changed: (localSessionId: string) => void) { super(); }

	update(scope: ConversationQueueReadScope): void {
		if (this._store.isDisposed || JSON.stringify(scope) === JSON.stringify(this.scope)) { return; }
		this.scope = scope;
		this.epoch++;
		this.timer.cancel();
		this.refreshPending = false;
		this.versions.clear();
		if (scope.engineIdentityId) {
			if (this.lastEngineIdentityId !== scope.engineIdentityId) { this.states.clear(); }
			this.lastEngineIdentityId = scope.engineIdentityId;
		}
		for (const [id, state] of this.states) {
			this.states.set(id, { ...state, readState: 'stale' });
		}
		const id = scope.localSessionId;
		if (id) {
			const state = this.states.get(id) ?? createEmptyMessageQueueState();
			this.states.set(id, { ...state, readState: !scope.live ? 'stale' : scope.support === 'UNSUPPORTED' ? 'unsupported' : 'loading', readError: undefined });
			this.changed(id);
		}
		if (this.canRead()) { void this.read(); }
	}

	getState(localSessionId: string): ConversationMessageQueueState {
		return this.states.get(localSessionId) ?? { ...createEmptyMessageQueueState(), readState: 'stale' };
	}

	captureEpoch(): number { return this.epoch; }
	isCurrent(epoch: number): boolean { return epoch === this.epoch && this.canRead(); }

	readyEngineSessionId(localSessionId: string): string | undefined {
		return this.canRead() && this.scope?.localSessionId === localSessionId && this.getState(localSessionId).readState === 'ready' ? this.scope.engineSessionId : undefined;
	}

	refresh(localSessionId: string): void {
		if (!this.canRead() || this.scope?.localSessionId !== localSessionId) { return; }
		this.states.set(localSessionId, { ...this.getState(localSessionId), readState: 'loading' });
		this.changed(localSessionId);
		this.timer.cancel();
		if (this.inflightEpoch === this.epoch) { this.refreshPending = true; } else { void this.read(); }
	}

	private canRead(): boolean {
		const s = this.scope;
		return !this._store.isDisposed && !!s?.live && !!s.engineIdentityId && !!s.linkId && !!s.localSessionId && !!s.engineSessionId && s.support === 'SUPPORTED';
	}

	private async read(): Promise<void> {
		const scope = this.scope;
		const epoch = this.epoch;
		if (!this.canRead() || !scope?.localSessionId || !scope.engineSessionId || this.inflightEpoch === epoch) { return; }
		this.inflightEpoch = epoch;
		const id = scope.localSessionId;
		try {
			const result = await this.fetch(scope.engineSessionId);
			if (epoch !== this.epoch || !this.canRead()) { return; }
			if (!/^\d+$/.test(result.version)) { throw new Error('Invalid queue version'); }
			const version = BigInt(result.version);
			if (version > 0x7fffffffffffffffn || version < (this.versions.get(id) ?? 0n)) { throw new Error('Queue version moved backwards'); }
			this.versions.set(id, version);
			this.states.set(id, { items: result.items.map(item => ({ ...item, content: item.text, hold: item.hold, lastError: item.lastError })), isPaused: result.isPaused,
				isProcessing: result.isProcessing, version: result.version, readState: this.refreshPending ? 'loading' : 'ready' });
			this.changed(id);
		} catch (error) {
			if (epoch !== this.epoch || !this.canRead()) { return; }
			this.states.set(id, { ...this.getState(id), readState: 'error', readError: error instanceof Error ? error.message : String(error) });
			this.changed(id);
		} finally {
			if (epoch === this.epoch && !this._store.isDisposed) {
				this.inflightEpoch = undefined;
				if (this.refreshPending) { this.refreshPending = false; void this.read(); }
				else if (this.canRead()) { this.timer.schedule(); }
			}
		}
	}

	override dispose(): void { this.epoch++; super.dispose(); }
}
