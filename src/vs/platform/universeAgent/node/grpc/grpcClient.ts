/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as grpc from '@grpc/grpc-js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import type {
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentConnectRequest,
	UniverseAgentConnectResult,
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentDeleteSessionRequest,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentListSessionsRequest,
	UniverseAgentListSessionsResult,
	UniverseAgentSessionEvent,
} from '../../common/universeAgentTypes.js';
import {
	GrpcStatusCode,
	IUniverseAgentGrpcTransport,
	UniverseAgentGrpcServices,
	UniverseAgentTransportError,
} from './grpcTransport.js';

interface ConnectResponseWire {
	session_token?: string;
	work_dir?: string;
	pairing_nonce?: string;
	sas_code?: string;
	capabilities?: {
		methods?: string[];
		events?: string[];
	};
}

interface ListSessionsResponseWire {
	sessions?: Array<{
		session_id?: string;
		title?: string;
		status?: string;
		created_at?: number;
		last_accessed_at?: number;
		turn_count?: number;
		model?: string;
	}>;
	total_count?: number;
}

interface CreateSessionResponseWire {
	session_id?: string;
}

interface GetHistoryResponseWire {
	envelopes?: Array<{ cursor_seq?: string; payload?: unknown }>;
	next_cursor_seq?: string;
}

function grpcErrorCode(error: grpc.ServiceError | null | undefined): number {
	return error?.code ?? GrpcStatusCode.OK;
}

function makeUnaryClient<TRequest, TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (request: TRequest) => Promise<TResponse> {
	const path = `/${servicePath}/${method}`;
	return (request: TRequest) => new Promise<TResponse>((resolve, reject) => {
		channel.makeUnaryRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
			request,
			(error, response) => {
				if (error) {
					reject(new UniverseAgentTransportError(error.code, error.message));
					return;
				}
				resolve(response as TResponse);
			},
		);
	});
}

function makeServerStreamClient<TRequest, TEvent>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (request: TRequest, listener: (event: TEvent) => void) => { dispose(): void } {
	const path = `/${servicePath}/${method}`;
	return (request: TRequest, listener: (event: TEvent) => void) => {
		const disposables = new DisposableStore();
		const call = channel.makeServerStreamRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TEvent,
			request,
		);
		call.on('data', (data: TEvent) => listener(data));
		call.on('error', () => { /* stream errors surface on next RPC for v1 */ });
		disposables.add({ dispose: () => call.cancel() });
		return disposables;
	};
}

function makeBidiStreamClient<TRequest, TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (request: TRequest, onResponse: (response: TResponse) => void) => Promise<void> {
	const path = `/${servicePath}/${method}`;
	return (request: TRequest, onResponse: (response: TResponse) => void) => new Promise<void>((resolve, reject) => {
		const call = channel.makeBidiStreamRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
		);
		call.on('data', (data: TResponse) => onResponse(data));
		call.on('error', (error: grpc.ServiceError) => reject(new UniverseAgentTransportError(error.code, error.message)));
		call.on('end', () => resolve());
		call.write(request);
		call.end();
	});
}

function mapConnectResponse(wire: ConnectResponseWire): UniverseAgentConnectResult {
	return {
		sessionToken: wire.session_token,
		workDir: wire.work_dir,
		pairingNonce: wire.pairing_nonce,
		sasCode: wire.sas_code,
		methods: wire.capabilities?.methods ?? [],
		events: wire.capabilities?.events ?? [],
	};
}

function mapListSessionsResponse(wire: ListSessionsResponseWire): UniverseAgentListSessionsResult {
	return {
		sessions: (wire.sessions ?? []).map(session => ({
			sessionId: session.session_id ?? '',
			title: session.title,
			status: session.status,
			createdAt: session.created_at,
			lastAccessedAt: session.last_accessed_at,
			turnCount: session.turn_count,
			model: session.model,
		})),
		totalCount: wire.total_count,
	};
}

function mapGetHistoryResponse(wire: GetHistoryResponseWire): UniverseAgentGetHistoryResult {
	return {
		envelopes: (wire.envelopes ?? []).map(envelope => ({
			cursorSeq: envelope.cursor_seq ?? '',
			payload: envelope.payload,
		})),
		nextCursorSeq: wire.next_cursor_seq,
	};
}

export interface GrpcUniverseAgentClientOptions {
	readonly address: string;
	readonly credentials?: grpc.ChannelCredentials;
}

/**
 * Hand-written @grpc/grpc-js client using JSON marshalling for v1 transport primitives.
 */
export class GrpcUniverseAgentClient implements IUniverseAgentGrpcTransport {

	private readonly _channel: grpc.Client;
	private _alive = true;

	constructor(options: GrpcUniverseAgentClientOptions) {
		this._channel = new grpc.Client(
			options.address,
			options.credentials ?? grpc.credentials.createInsecure(),
		);
	}

	get isChannelAlive(): boolean {
		return this._alive;
	}

	async connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ConnectResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.Connect,
		);
		const wire = await unary({
			client_id: request.clientId,
			protocol_version: request.protocolVersion,
			work_dir: request.workDir,
		});
		return mapConnectResponse(wire);
	}

	close(): void {
		if (this._alive) {
			this._alive = false;
			this._channel.close();
		}
	}

	async probeRpc(service: string, method: string): Promise<number> {
		return new Promise<number>(resolve => {
			const path = `/${service}/${method}`;
			this._channel.makeUnaryRequest(
				path,
				() => Buffer.from('{}'),
				(buffer: Buffer) => buffer,
				{},
				(error: grpc.ServiceError | null) => resolve(grpcErrorCode(error)),
			);
		});
	}

	async listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListSessionsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.List,
		);
		const wire = await unary({
			limit: request.limit,
			offset: request.offset,
		});
		return mapListSessionsResponse(wire);
	}

	async createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, CreateSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Create,
		);
		const wire = await unary({
			title: request.title,
			model: request.model,
		});
		return { sessionId: wire.session_id ?? '' };
	}

	async deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void> {
		const unary = makeUnaryClient<Record<string, unknown>, Record<string, never>>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Delete,
		);
		await unary({ session_id: request.sessionId });
	}

	async getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetHistoryResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.GetHistory,
		);
		const wire = await unary({
			session_id: request.sessionId,
			cursor_seq: request.cursorSeq,
			limit: request.limit,
		});
		return mapGetHistoryResponse(wire);
	}

	subscribeSessionEventStream(sessionId: string, listener: (event: UniverseAgentSessionEvent) => void): { dispose(): void } {
		const stream = makeServerStreamClient<Record<string, unknown>, UniverseAgentSessionEvent>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.SessionEventStream,
		);
		return stream({ session_id: sessionId }, listener);
	}

	async chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void> {
		const bidi = makeBidiStreamClient<Record<string, unknown>, UniverseAgentChatResponse>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Chat,
		);
		await bidi({ session_id: request.sessionId, payload: request.payload }, onResponse);
	}
}

export function createGrpcUniverseAgentClient(address: string): IUniverseAgentGrpcTransport {
	return new GrpcUniverseAgentClient({ address });
}
