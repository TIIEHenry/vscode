/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from '../../../base/common/errors.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { IChannel, ProxyChannel } from '../../../base/parts/ipc/common/ipc.js';
import { finalizeConnectProfileResult } from './connectProfileResult.js';
import type { ConnectionPhase, UniverseAgentConnectProfileResult } from './connectionHubTypes.js';
import {
	IUniverseAgentConnection,
	type IUniverseAgentTeamApi,
	type UniverseAgentConfirmPairingRequest,
	type UniverseAgentNavigatorCapabilityKey,
} from './universeAgentConnection.js';
import {
	navigatorTeamInfoCommand,
	navigatorTeamMemberStatusCommand,
	navigatorTeamTaskListCommand,
} from './universeAgentNavigatorTeamIpc.js';
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
	UniverseAgentTeamInfo,
	UniverseAgentTeamMemberInfo,
	UniverseAgentTeamTaskInfo,
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
	/**
	 * Snapshot pushes that arrive while hydrate's getConnectionSnapshot is in flight.
	 * A newer push wins; the stale read is dropped.
	 */
	private _snapshotGeneration = 0;
	private readonly _onDidChangeConnection = this._register(new Emitter<UniverseAgentConnectionSnapshot>());

	readonly onDidChangeConnection = this._onDidChangeConnection.event;
	readonly onDidFileMutation: IUniverseAgentConnection['onDidFileMutation'];
	readonly onDidTurnSettle: IUniverseAgentConnection['onDidTurnSettle'];
	readonly onDidChangeTeamRuntime: IUniverseAgentConnection['onDidChangeTeamRuntime'];
	/**
	 * Local object. The remote proxy would expose `team` as one async function,
	 * so Navigator could not call memberStatus / taskList / teamInfo.
	 */
	readonly team: IUniverseAgentTeamApi;
	private readonly _ipcChannel: IChannel;

	constructor(channel: IChannel) {
		super();
		this._ipcChannel = channel;
		this.team = {
			memberStatus: (sessionId, agentId) => this._ipcChannel.call<readonly UniverseAgentTeamMemberInfo[]>(navigatorTeamMemberStatusCommand, [sessionId, agentId]),
			taskList: (sessionId, agentId) => this._ipcChannel.call<readonly UniverseAgentTeamTaskInfo[]>(navigatorTeamTaskListCommand, [sessionId, agentId]),
			teamInfo: (sessionId, agentId, teamId) => this._ipcChannel.call<UniverseAgentTeamInfo | undefined>(navigatorTeamInfoCommand, [sessionId, agentId, teamId]),
		};
		this.remote = ProxyChannel.toService<IUniverseAgentConnection>(channel);
		this.onDidFileMutation = this.remote.onDidFileMutation;
		this.onDidTurnSettle = this.remote.onDidTurnSettle;
		this.onDidChangeTeamRuntime = this.remote.onDidChangeTeamRuntime;
		this._register(this.remote.onDidChangeConnection(snapshot => {
			this._snapshotGeneration++;
			this._applyRemoteSnapshot(snapshot);
		}));
		void this.hydrate().catch(onUnexpectedError).catch(onUnexpectedError);
		return createRemoteForwardingProxy(this, this.remote) as this;
	}

	/** H4b: `isConversationEngineLive(phase, snapshot.pairingPending)` via cache.connected. */
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

	async confirmPairing(options?: UniverseAgentConfirmPairingRequest): Promise<UniverseAgentConnectProfileResult> {
		const result = await this.remote.confirmPairing(options);
		return finalizeConnectProfileResult(result);
	}

	requestAgentTreeRefresh(sessionId: string): void {
		// Interface is void; ProxyChannel.toService still returns a Promise.
		void Promise.resolve(this.remote.requestAgentTreeRefresh(sessionId)).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	/**
	 * Required on the desktop facade so SessionViewHost / recover never see
	 * `typeof resumeSession !== 'function'` and skip SessionService.Resume.
	 * ProxyChannel.toService always materializes this as an IPC call.
	 */
	async resumeSession(request: UniverseAgentResumeSessionRequest): Promise<UniverseAgentResumeSessionResult> {
		return this.remote.resumeSession!(request);
	}

	private _applyRemoteSnapshot(snapshot: UniverseAgentConnectionSnapshot): void {
		this.cache.applySnapshot(snapshot);
		this._onDidChangeConnection.fire(this.cache.snapshot);
	}

	private async hydrate(): Promise<void> {
		const generation = this._snapshotGeneration;
		try {
			const snapshot = await resolveMaybePromise(this.remote.getConnectionSnapshot());
			if (generation !== this._snapshotGeneration) {
				return;
			}
			this._applyRemoteSnapshot(snapshot);
		} catch {
			// Keep last-good cache; do not notify a half-applied snapshot.
		}
	}
}
