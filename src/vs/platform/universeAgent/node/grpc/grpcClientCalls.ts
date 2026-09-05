/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as grpc from '@grpc/grpc-js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { createStreamCloseGate } from '../../common/sessionStreamClose.js';
import type { UniverseAgentSessionStreamCloseCause, UniverseAgentChatStream } from '../../common/universeAgentTypes.js';
import { GrpcStatusCode, UniverseAgentTransportError } from './grpcTransport.js';

export function grpcErrorCode(error: grpc.ServiceError | null | undefined): number {
	return error?.code ?? GrpcStatusCode.OK;
}

export function makeUnaryClient<TRequest, TResponse>(
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

export function makeServerStreamClient<TRequest, TEvent>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (
	request: TRequest,
	listener: (event: TEvent) => void,
	onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
) => { dispose(): void } {
	const path = `/${servicePath}/${method}`;
	return (request, listener, onClosed) => {
		const disposables = new DisposableStore();
		const gate = createStreamCloseGate(onClosed);
		const call = channel.makeServerStreamRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TEvent,
			request,
		);
		call.on('data', (data: TEvent) => listener(data));
		call.on('error', (error: grpc.ServiceError) => {
			if (gate.closed) {
				return;
			}
			const message = typeof error?.message === 'string' && error.message ? error.message : 'stream error';
			gate.finish({ kind: 'error', message });
		});
		call.on('end', () => {
			gate.finish({ kind: 'remote' });
		});
		disposables.add({
			dispose: () => {
				gate.closeLocal();
				call.cancel();
			},
		});
		return disposables;
	};
}

export function makeClientStreamClient<TChunk, TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (
	onResponse: (response: TResponse) => void,
	onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
) => { write(chunk: TChunk): void; end(): void; dispose(): void } {
	const path = `/${servicePath}/${method}`;
	return (onResponse, onClosed) => {
		const gate = createStreamCloseGate(onClosed);
		const call = channel.makeClientStreamRequest(
			path,
			(value: TChunk) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
			(error: grpc.ServiceError | null, response?: TResponse) => {
				if (gate.closed) {
					return;
				}
				if (error) {
					const message = typeof error?.message === 'string' && error.message ? error.message : 'stream error';
					gate.finish({ kind: 'error', message });
					return;
				}
				if (response !== undefined) {
					onResponse(response);
				}
				gate.finish({ kind: 'remote' });
			},
		);
		return {
			write(chunk: TChunk): void {
				if (gate.closed) {
					return;
				}
				call.write(chunk);
			},
			end(): void {
				if (gate.closed) {
					return;
				}
				call.end();
			},
			dispose(): void {
				if (gate.closed) {
					call.cancel();
					return;
				}
				gate.closeLocal();
				call.cancel();
			},
		};
	};
}

export function makeResidentBidiStreamClient<TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (
	sessionId: string,
	onResponse: (response: TResponse) => void,
	onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
) => UniverseAgentChatStream {
	const path = `/${servicePath}/${method}`;
	return (sessionId, onResponse, onClosed) => {
		const call = channel.makeBidiStreamRequest(
			path,
			(value: Record<string, unknown>) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
		);
		const gate = createStreamCloseGate(onClosed);
		call.on('data', (data: TResponse) => onResponse(data));
		call.on('error', (error: grpc.ServiceError) => {
			if (gate.closed) {
				return;
			}
			const message = typeof error?.message === 'string' && error.message ? error.message : 'stream error';
			gate.finish({ kind: 'error', message });
		});
		call.on('end', () => {
			gate.finish({ kind: 'remote' });
		});
		return {
			write(payload: unknown): void {
				if (gate.closed) {
					return;
				}
				call.write({ session_id: sessionId, payload });
			},
			dispose(): void {
				if (gate.closed) {
					call.cancel();
					return;
				}
				gate.closeLocal();
				call.end();
				call.cancel();
			},
		};
	};
}

export function makeResidentBidiHandleClient<TRequest, TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (
	onResponse: (response: TResponse) => void,
	onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
) => { write(chunk: TRequest): void; end(): void; dispose(): void } {
	const path = `/${servicePath}/${method}`;
	return (onResponse, onClosed) => {
		const call = channel.makeBidiStreamRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
		);
		const gate = createStreamCloseGate(onClosed);
		call.on('data', (data: TResponse) => onResponse(data));
		call.on('error', (error: grpc.ServiceError) => {
			if (gate.closed) {
				return;
			}
			const message = typeof error?.message === 'string' && error.message ? error.message : 'stream error';
			gate.finish({ kind: 'error', message });
		});
		call.on('end', () => {
			gate.finish({ kind: 'remote' });
		});
		return {
			write(chunk: TRequest): void {
				if (gate.closed) {
					return;
				}
				call.write(chunk);
			},
			end(): void {
				if (gate.closed) {
					return;
				}
				call.end();
			},
			dispose(): void {
				if (gate.closed) {
					call.cancel();
					return;
				}
				gate.closeLocal();
				call.end();
				call.cancel();
			},
		};
	};
}

export function makeBidiStreamClient<TRequest, TResponse>(
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
