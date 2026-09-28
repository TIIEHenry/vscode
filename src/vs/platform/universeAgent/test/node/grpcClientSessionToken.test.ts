/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as grpc from '@grpc/grpc-js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentSessionStreamCloseCause } from '../../common/universeAgentTypes.js';
import { GrpcUniverseAgentClient } from '../../node/grpc/grpcClient.js';
import { GrpcStatusCode, UniverseAgentGrpcServices } from '../../node/grpc/grpcTransport.js';
import { loadGrpcModule } from '../../node/universeAgentChannel.js';

const healthPath = `/${UniverseAgentGrpcServices.System.service}/${UniverseAgentGrpcServices.System.HealthCheck}`;
const connectPath = `/${UniverseAgentGrpcServices.System.service}/${UniverseAgentGrpcServices.System.Connect}`;
const noncePath = `/${UniverseAgentGrpcServices.System.service}/${UniverseAgentGrpcServices.System.GetAuthNonce}`;
const watchPath = `/${UniverseAgentGrpcServices.Config.service}/${UniverseAgentGrpcServices.Config.Watch}`;
const chatPath = `/${UniverseAgentGrpcServices.Agent.service}/${UniverseAgentGrpcServices.Agent.Chat}`;

function byteMethod(path: string, requestStream: boolean, responseStream: boolean): grpc.MethodDefinition<Buffer, Buffer> {
	return {
		path,
		requestStream,
		responseStream,
		requestSerialize: (value: Buffer) => Buffer.from(value),
		requestDeserialize: (value: Buffer) => value,
		responseSerialize: (value: Buffer) => Buffer.from(value),
		responseDeserialize: (value: Buffer) => value,
	};
}

const linkService: grpc.ServiceDefinition = {
	HealthCheck: byteMethod(healthPath, false, false),
	Connect: byteMethod(connectPath, false, false),
	GetAuthNonce: byteMethod(noncePath, false, false),
	Watch: byteMethod(watchPath, false, true),
	Chat: byteMethod(chatPath, true, true),
};

function authorizationOf(metadata: grpc.Metadata): string | undefined {
	const first = metadata.get('authorization')[0];
	return typeof first === 'string' ? first : undefined;
}

function statusError(code: grpc.status, details: string): { code: grpc.status; details: string } {
	return { code, details };
}

async function within(ms: number, work: Promise<void>): Promise<void> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
	});
	try {
		await Promise.race([work, timeoutPromise]);
	} finally {
		if (timer !== undefined) {
			clearTimeout(timer);
		}
	}
}

interface LinkServer {
	readonly address: string;
	readonly seen: Array<{ readonly path: string; readonly authorization: string | undefined }>;
	shutdown(): Promise<void>;
}

type UnaryHandler = (call: grpc.ServerUnaryCall<Buffer, Buffer>, callback: grpc.sendUnaryData<Buffer>) => void;
type ServerStreamHandler = (call: grpc.ServerWritableStream<Buffer, Buffer>) => void;
type BidiHandler = (call: grpc.ServerDuplexStream<Buffer, Buffer>) => void;

interface LinkHandlers {
	HealthCheck: UnaryHandler;
	Connect: UnaryHandler;
	GetAuthNonce: UnaryHandler;
	Watch: ServerStreamHandler;
	Chat: BidiHandler;
}

async function startLinkServer(impl: LinkHandlers): Promise<LinkServer> {
	await loadGrpcModule();
	const seen: LinkServer['seen'] = [];
	const server = new grpc.Server();
	const recording: grpc.UntypedServiceImplementation = {
		HealthCheck: (call: grpc.ServerUnaryCall<Buffer, Buffer>, callback: grpc.sendUnaryData<Buffer>) => {
			seen.push({ path: healthPath, authorization: authorizationOf(call.metadata) });
			impl.HealthCheck(call, callback);
		},
		Connect: (call: grpc.ServerUnaryCall<Buffer, Buffer>, callback: grpc.sendUnaryData<Buffer>) => {
			seen.push({ path: connectPath, authorization: authorizationOf(call.metadata) });
			impl.Connect(call, callback);
		},
		GetAuthNonce: (call: grpc.ServerUnaryCall<Buffer, Buffer>, callback: grpc.sendUnaryData<Buffer>) => {
			seen.push({ path: noncePath, authorization: authorizationOf(call.metadata) });
			impl.GetAuthNonce(call, callback);
		},
		Watch: (call: grpc.ServerWritableStream<Buffer, Buffer>) => {
			seen.push({ path: watchPath, authorization: authorizationOf(call.metadata) });
			impl.Watch(call);
		},
		Chat: (call: grpc.ServerDuplexStream<Buffer, Buffer>) => {
			seen.push({ path: chatPath, authorization: authorizationOf(call.metadata) });
			impl.Chat(call);
		},
	};
	server.addService(linkService, recording as grpc.UntypedServiceImplementation);
	const port = await new Promise<number>((resolve, reject) => {
		server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, boundPort) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(boundPort);
		});
	});
	return {
		address: `127.0.0.1:${port}`,
		seen,
		shutdown: () => new Promise(resolve => server.tryShutdown(() => resolve())),
	};
}

function okUnary(_call: grpc.ServerUnaryCall<Buffer, Buffer>, callback: grpc.sendUnaryData<Buffer>): void {
	callback(null, Buffer.alloc(0));
}

function endStream(call: { end: () => void }): void {
	call.end();
}

function clientFor(address: string): GrpcUniverseAgentClient {
	return new GrpcUniverseAgentClient({ address, unaryDeadlineMs: 2_000 });
}

function closedCause(): { promise: Promise<UniverseAgentSessionStreamCloseCause>; done: (cause: UniverseAgentSessionStreamCloseCause) => void } {
	let done: (cause: UniverseAgentSessionStreamCloseCause) => void = () => { };
	const promise = new Promise<UniverseAgentSessionStreamCloseCause>(resolve => {
		done = resolve;
	});
	return { promise, done };
}

suite('GrpcUniverseAgentClient session token', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('bearer is attached per call and per client, and status is forwarded', async () => {
		const server = await startLinkServer({
			HealthCheck: okUnary,
			Connect: okUnary,
			GetAuthNonce: okUnary,
			Watch: endStream,
			Chat: endStream,
		});
		const withToken = clientFor(server.address);
		const withoutToken = clientFor(server.address);
		try {
			await withToken.healthCheck();
			assert.strictEqual(server.seen.at(-1)?.authorization, undefined);

			withToken.installSessionToken('');
			await withToken.healthCheck();
			assert.strictEqual(server.seen.at(-1)?.authorization, undefined);

			withToken.installSessionToken('t1');
			const health = await withToken.healthCheck();
			assert.strictEqual(health.status, '');
			assert.strictEqual(server.seen.at(-1)?.authorization, 'Bearer t1');

			const watchClosed = closedCause();
			const watch = withToken.openWatchConfigStream({ keys: [] }, () => { }, watchClosed.done);
			await within(2_000, watchClosed.promise.then(cause => {
				assert.strictEqual(cause.kind, 'remote');
			}));
			watch.dispose();
			assert.strictEqual(server.seen.filter(call => call.path === watchPath).at(-1)?.authorization, 'Bearer t1');

			const chatClosed = closedCause();
			const chat = withToken.openChatStream('session-1', () => { }, chatClosed.done);
			chat.write({});
			await within(2_000, chatClosed.promise.then(() => undefined));
			chat.dispose();
			assert.strictEqual(server.seen.filter(call => call.path === chatPath).at(-1)?.authorization, 'Bearer t1');

			await withoutToken.healthCheck();
			assert.strictEqual(server.seen.at(-1)?.authorization, undefined);
		} finally {
			withToken.close();
			withoutToken.close();
			await server.shutdown();
		}
	});

	test('in-flight calls keep the metadata they started with', async () => {
		let releaseWatch: () => void = () => { };
		const watchHeld = new Promise<void>(resolve => {
			releaseWatch = resolve;
		});
		let watchSeen: (() => void) | undefined;
		const watchArrived = new Promise<void>(resolve => {
			watchSeen = resolve;
		});
		const server = await startLinkServer({
			HealthCheck: okUnary,
			Connect: okUnary,
			GetAuthNonce: okUnary,
			Watch: (call: grpc.ServerWritableStream<Buffer, Buffer>) => {
				watchSeen?.();
				watchHeld.then(() => call.end());
			},
			Chat: endStream,
		});
		const client = clientFor(server.address);
		try {
			const watchClosed = closedCause();
			const watch = client.openWatchConfigStream({ keys: [] }, () => { }, watchClosed.done);
			await within(2_000, watchArrived);
			client.installSessionToken('t1');
			await client.healthCheck();
			assert.strictEqual(server.seen.find(call => call.path === watchPath)?.authorization, undefined);
			assert.strictEqual(server.seen.filter(call => call.path === healthPath).at(-1)?.authorization, 'Bearer t1');
			releaseWatch();
			await within(2_000, watchClosed.promise.then(() => undefined));
			watch.dispose();
		} finally {
			client.close();
			await server.shutdown();
		}
	});

	test('UNAUTHENTICATED fires only when this call attached a token and the path is not a handshake', async () => {
		const server = await startLinkServer({
			HealthCheck: (_call, callback) => callback(statusError(grpc.status.UNAUTHENTICATED, 'no'), null),
			Connect: (_call, callback) => callback(statusError(grpc.status.UNAUTHENTICATED, 'no'), null),
			GetAuthNonce: (_call, callback) => callback(statusError(grpc.status.UNAUTHENTICATED, 'no'), null),
			Watch: endStream,
			Chat: endStream,
		});
		const client = clientFor(server.address);
		let rejected = 0;
		const subscription = client.onDidRejectSessionToken(() => {
			rejected++;
		});
		try {
			await assert.rejects(
				() => client.healthCheck(),
				(error: unknown) => error instanceof Error && 'code' in error && (error as { code: number }).code === GrpcStatusCode.UNAUTHENTICATED,
			);
			assert.strictEqual(rejected, 0);

			client.installSessionToken('t1');
			await assert.rejects(
				() => client.connectWithDeviceAuth({
					clientIdentityId: 'c',
					clientPublicKey: new Uint8Array(0),
					authNonce: new Uint8Array(0),
					signature: new Uint8Array(0),
					protocolVersion: '1',
				}),
				(error: unknown) => error instanceof Error && 'code' in error && (error as { code: number }).code === GrpcStatusCode.UNAUTHENTICATED,
			);
			await assert.rejects(() => client.getAuthNonce({
				clientIdentityId: 'c',
				clientPublicKey: new Uint8Array(0),
			}));
			assert.strictEqual(rejected, 0);
			assert.strictEqual(server.seen.find(call => call.path === connectPath)?.path, connectPath);

			await assert.rejects(
				() => client.healthCheck(),
				(error: unknown) => error instanceof Error && 'code' in error && (error as { code: number }).code === GrpcStatusCode.UNAUTHENTICATED,
			);
			assert.strictEqual(rejected, 1);
			assert.strictEqual(server.seen.filter(call => call.path === healthPath).at(-1)?.authorization, 'Bearer t1');
		} finally {
			subscription.dispose();
			client.close();
			await server.shutdown();
		}
	});

	test('server stream UNAVAILABLE fires onDidObserveUnavailable and DEADLINE_EXCEEDED does not', async () => {
		let mode: 'unavailable' | 'deadline' = 'unavailable';
		const server = await startLinkServer({
			HealthCheck: (_call, callback) => callback(statusError(grpc.status.DEADLINE_EXCEEDED, 'slow'), null),
			Connect: okUnary,
			GetAuthNonce: okUnary,
			Watch: (call: grpc.ServerWritableStream<Buffer, Buffer>) => {
				const code = mode === 'unavailable' ? grpc.status.UNAVAILABLE : grpc.status.DEADLINE_EXCEEDED;
				call.emit('error', statusError(code, mode));
			},
			Chat: endStream,
		});
		const client = clientFor(server.address);
		let unavailable = 0;
		let rejected = 0;
		const events = [
			client.onDidObserveUnavailable(() => { unavailable++; }),
			client.onDidRejectSessionToken(() => { rejected++; }),
		];
		try {
			client.installSessionToken('t1');
			const watchClosed = closedCause();
			const watch = client.openWatchConfigStream({ keys: [] }, () => { }, watchClosed.done);
			const cause = await withinResult(2_000, watchClosed.promise);
			watch.dispose();
			assert.strictEqual(cause.kind, 'error');
			assert.strictEqual(unavailable, 1);
			assert.strictEqual(rejected, 0);

			mode = 'deadline';
			const again = closedCause();
			const second = client.openWatchConfigStream({ keys: [] }, () => { }, again.done);
			await within(2_000, again.promise.then(() => undefined));
			second.dispose();
			await assert.rejects(() => client.healthCheck());
			assert.strictEqual(unavailable, 1);
			assert.strictEqual(rejected, 0);
		} finally {
			for (const event of events) {
				event.dispose();
			}
			client.close();
			await server.shutdown();
		}
	});
});

async function withinResult<T>(ms: number, work: Promise<T>): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
	});
	try {
		return await Promise.race([work, timeoutPromise]);
	} finally {
		if (timer !== undefined) {
			clearTimeout(timer);
		}
	}
}
