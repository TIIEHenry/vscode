/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { IChannel, ProxyChannel } from '../../../base/parts/ipc/common/ipc.js';
import { finalizeConnectProfileResult } from './connectProfileResult.js';
import type { ConnectionPhase, UniverseAgentConnectProfileResult } from './connectionHubTypes.js';
import {
	IUniverseAgentConnection,
	type UniverseAgentNavigatorCapabilityKey,
} from './universeAgentConnection.js';
import {
	createRemoteForwardingProxy,
	resolveMaybePromise,
	UniverseAgentConnectionSyncCache,
} from './universeAgentRendererSync.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentCapabilitySupport,
	UniverseAgentConnectionSnapshot,
	UniverseAgentResumeSessionRequest,
	UniverseAgentResumeSessionResult,
	UniverseAgentTransportState,
} from './universeAgentTypes.js';

/**
 * The constructor returns a forwarding proxy, so instances answer every
 * {@link IUniverseAgentConnection} member even though the class only spells out
 * the ones it overrides. This merge tells the type system the same thing.
 */
export interface UniverseAgentConnectionChannelClient extends IUniverseAgentConnection { }

/**
 * Renderer client for the main-process gRPC adapter.
 * ProxyChannel makes every method async; UI getters stay sync from this cache.
 */
export class UniverseAgentConnectionChannelClient extends Disposable {

	declare readonly _serviceBrand: undefined;

	private readonly remote: IUniverseAgentConnection;
	private readonly cache = new UniverseAgentConnectionSyncCache();
	private readonly _onDidChangeConnection = this._register(new Emitter<UniverseAgentConnectionSnapshot>());

	readonly onDidChangeConnection = this._onDidChangeConnection.event;
	readonly onDidFileMutation: IUniverseAgentConnection['onDidFileMutation'];
	readonly onDidTurnSettle: IUniverseAgentConnection['onDidTurnSettle'];
	readonly onDidChangeTeamRuntime: IUniverseAgentConnection['onDidChangeTeamRuntime'];

	constructor(channel: IChannel) {
		super();
		this.remote = ProxyChannel.toService<IUniverseAgentConnection>(channel);
		this.onDidFileMutation = this.remote.onDidFileMutation;
		this.onDidTurnSettle = this.remote.onDidTurnSettle;
		this.onDidChangeTeamRuntime = this.remote.onDidChangeTeamRuntime;
		this._register(this.remote.onDidChangeConnection(snapshot => {
			this.cache.applySnapshot(snapshot);
			void this.refreshPhaseAndNotify();
		}));
		void this.hydrate();
		return createRemoteForwardingProxy(this, this.remote) as this;
	}

	isEngineConnected(): boolean {
		return this.cache.connected;
	}

	getTransportState(): UniverseAgentTransportState {
		return this.cache.transport;
	}

	getConnectionSnapshot(): UniverseAgentConnectionSnapshot {
		return this.cache.snapshot;
	}

	getCapabilitySnapshot(): UniverseAgentCapabilitySnapshot {
		return this.cache.capabilities;
	}

	getConnectionPhase(): ConnectionPhase {
		return this.cache.phase;
	}

	getNavigatorCapability(key: UniverseAgentNavigatorCapabilityKey): UniverseAgentCapabilitySupport {
		return this.cache.navigatorCapability(key);
	}

	isAgentTreeFetchFailed(): boolean {
		return this.cache.agentTreeFetchFailed;
	}

	async connectProfile(profileId: string, options?: { readonly reconnect?: boolean }): Promise<UniverseAgentConnectProfileResult> {
		const result = await this.remote.connectProfile(profileId, options);
		return finalizeConnectProfileResult(result);
	}

	async confirmPairing(): Promise<UniverseAgentConnectProfileResult> {
		const result = await this.remote.confirmPairing();
		return finalizeConnectProfileResult(result);
	}

	requestAgentTreeRefresh(sessionId: string): void {
		void this.remote.requestAgentTreeRefresh(sessionId);
	}

	/**
	 * Required on the desktop facade so SessionViewHost / recover never see
	 * `typeof resumeSession !== 'function'` and skip SessionService.Resume.
	 * ProxyChannel.toService always materializes this as an IPC call.
	 */
	async resumeSession(request: UniverseAgentResumeSessionRequest): Promise<UniverseAgentResumeSessionResult> {
		return this.remote.resumeSession!(request);
	}

	private async hydrate(): Promise<void> {
		const [snapshot, phase, failed] = await Promise.all([
			resolveMaybePromise(this.remote.getConnectionSnapshot()),
			resolveMaybePromise(this.remote.getConnectionPhase()),
			resolveMaybePromise(this.remote.isAgentTreeFetchFailed()),
		]);
		this.cache.applySnapshot(snapshot);
		this.cache.applyPhase(phase);
		this.cache.applyAgentTreeFetchFailed(!!failed);
		this._onDidChangeConnection.fire(this.cache.snapshot);
	}

	private async refreshPhaseAndNotify(): Promise<void> {
		const [phase, failed] = await Promise.all([
			resolveMaybePromise(this.remote.getConnectionPhase()),
			resolveMaybePromise(this.remote.isAgentTreeFetchFailed()),
		]);
		this.cache.applyPhase(phase);
		this.cache.applyAgentTreeFetchFailed(!!failed);
		this._onDidChangeConnection.fire(this.cache.snapshot);
	}
}
