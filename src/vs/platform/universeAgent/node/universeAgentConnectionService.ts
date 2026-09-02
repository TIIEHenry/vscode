/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import type { IUniverseAgentConnection } from '../common/universeAgentConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentConnectRequest,
	UniverseAgentConnectResult,
	UniverseAgentConnectionSnapshot,
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentDeleteSessionRequest,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentListSessionsRequest,
	UniverseAgentListSessionsResult,
	UniverseAgentSessionEvent,
	UniverseAgentTransportState,
} from '../common/universeAgentTypes.js';
import { createEmptyCapabilitySnapshot, probeEngineCapabilities } from './grpcCapabilityProbe.js';
import { createGrpcUniverseAgentClient } from './grpc/grpcClient.js';
import { IUniverseAgentGrpcTransport, isTransportFailureCode, UniverseAgentTransportError } from './grpc/grpcTransport.js';

export interface UniverseAgentConnectionServiceOptions {
	readonly loopbackAddress?: string;
	readonly createTransport?: (address: string) => IUniverseAgentGrpcTransport;
}

function isPairingPending(sessionToken: string | undefined, pairingNonce: string | undefined): boolean {
	return !sessionToken && !!pairingNonce;
}

export class UniverseAgentConnectionService extends Disposable implements IUniverseAgentConnection {

	declare readonly _serviceBrand: undefined;

	readonly onDidFileMutation = Event.None;

	private readonly _onDidChangeConnection = this._register(new Emitter<UniverseAgentConnectionSnapshot>());
	readonly onDidChangeConnection = this._onDidChangeConnection.event;

	private _transport: IUniverseAgentGrpcTransport | undefined;
	private _transportState: UniverseAgentTransportState = 'idle';
	private _sessionToken: string | undefined;
	private _workDir: string | undefined;
	private _pairingPending = false;
	private _capabilities: UniverseAgentCapabilitySnapshot = createEmptyCapabilitySnapshot();

	private readonly _loopbackAddress: string;
	private readonly _createTransport: (address: string) => IUniverseAgentGrpcTransport;

	constructor(options: UniverseAgentConnectionServiceOptions = {}) {
		super();
		this._loopbackAddress = options.loopbackAddress ?? '127.0.0.1:50051';
		this._createTransport = options.createTransport ?? createGrpcUniverseAgentClient;
	}

	isEngineConnected(): boolean {
		return !!this._sessionToken
			&& !this._pairingPending
			&& !!this._transport?.isChannelAlive;
	}

	getTransportState(): UniverseAgentTransportState {
		return this._transportState;
	}

	getConnectionSnapshot(): UniverseAgentConnectionSnapshot {
		return this._buildSnapshot();
	}

	getCapabilitySnapshot(): UniverseAgentCapabilitySnapshot {
		return this._capabilities;
	}

	async connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult> {
		this._ensureTransport();
		try {
			const result = await this._transport!.connect(request);
			this._sessionToken = result.sessionToken;
			this._workDir = result.workDir;
			this._pairingPending = isPairingPending(result.sessionToken, result.pairingNonce);
			this._transportState = 'ok';
			if (!this._pairingPending && this._transport) {
				this._capabilities = await probeEngineCapabilities({
					methods: result.methods,
					transport: this._transport,
				});
			}
			this._fireSnapshotChanged();
			return result;
		} catch (error) {
			this._markTransportFailed(error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		this._transport?.close();
		this._transport = undefined;
		this._sessionToken = undefined;
		this._workDir = undefined;
		this._pairingPending = false;
		this._transportState = 'idle';
		this._capabilities = createEmptyCapabilitySnapshot();
		this._fireSnapshotChanged();
	}

	async listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult> {
		return this._withTransport(transport => transport.listSessions(request));
	}

	async createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult> {
		return this._withTransport(transport => transport.createSession(request));
	}

	async deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void> {
		await this._withTransport(transport => transport.deleteSession(request));
	}

	async getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> {
		return this._withTransport(transport => transport.getHistory(request));
	}

	subscribeSessionEventStream(sessionId: string, listener: (event: UniverseAgentSessionEvent) => void): { dispose(): void } {
		this._assertTransportReady();
		return this._transport!.subscribeSessionEventStream(sessionId, listener);
	}

	async chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void> {
		await this._withTransport(transport => transport.chat(request, onResponse));
	}

	override dispose(): void {
		this._transport?.close();
		this._transport = undefined;
		super.dispose();
	}

	private _ensureTransport(): void {
		if (!this._transport) {
			this._transport = this._createTransport(this._loopbackAddress);
		}
	}

	private _assertTransportReady(): void {
		if (!this._transport || this._transportState === 'failed') {
			throw new UniverseAgentTransportError(14, 'UniverseAgent transport is not available');
		}
	}

	private async _withTransport<T>(operation: (transport: IUniverseAgentGrpcTransport) => Promise<T>): Promise<T> {
		this._assertTransportReady();
		try {
			const result = await operation(this._transport!);
			if (this._transportState !== 'ok') {
				this._transportState = 'ok';
				this._fireSnapshotChanged();
			}
			return result;
		} catch (error) {
			this._markTransportFailed(error);
			throw error;
		}
	}

	private _markTransportFailed(error: unknown): void {
		if (error instanceof UniverseAgentTransportError && isTransportFailureCode(error.code)) {
			this._transportState = 'failed';
			this._fireSnapshotChanged();
		}
	}

	private _buildSnapshot(): UniverseAgentConnectionSnapshot {
		return {
			transport: this._transportState,
			sessionToken: this._sessionToken,
			workDir: this._workDir,
			pairingPending: this._pairingPending,
			channelAlive: !!this._transport?.isChannelAlive,
			capabilities: this._capabilities,
		};
	}

	private _fireSnapshotChanged(): void {
		this._onDidChangeConnection.fire(this._buildSnapshot());
	}
}
