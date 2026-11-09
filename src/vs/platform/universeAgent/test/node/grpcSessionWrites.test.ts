/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as grpc from '@grpc/grpc-js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { GrpcUniverseAgentClient } from '../../node/grpc/grpcClient.js';
import { encodeInt32Field, encodeMessageField, encodeStringField, lastString, lastVarint, readProtoFields } from '../../node/grpc/grpcProtoCodec.js';
import { loadGrpcModule } from '../../node/universeAgentChannel.js';

suite('UniverseAgent session write client', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('formal permission and trigger methods send proto bytes and map real responses', async () => {
		const server = new grpc.Server();
		const seen: string[] = [];
		const profilePath = '/agentservice.PermissionService/SetClientToolProfile';
		const triggerPath = '/agentservice.TriggerService/RegisterSessionEngineTrigger';
		const method = (path: string): grpc.MethodDefinition<Buffer, Buffer> => ({
			path, requestStream: false, responseStream: false,
			requestSerialize: value => value, requestDeserialize: value => value,
			responseSerialize: value => value, responseDeserialize: value => value,
		});
		server.addService({ SetClientToolProfile: method(profilePath) }, {
			SetClientToolProfile: (call: grpc.ServerUnaryCall<Buffer, Buffer>, reply: grpc.sendUnaryData<Buffer>) => {
				seen.push(profilePath);
				const fields = readProtoFields(call.request);
				assert.strictEqual(lastString(fields, 1), 'session');
				assert.strictEqual(lastVarint(fields, 2), 3n);
				reply(null, encodeStringField(2, 'Session not found'));
			},
		});
		server.addService({ RegisterSessionEngineTrigger: method(triggerPath) }, {
			RegisterSessionEngineTrigger: (call: grpc.ServerUnaryCall<Buffer, Buffer>, reply: grpc.sendUnaryData<Buffer>) => {
				seen.push(triggerPath);
				const fields = readProtoFields(call.request);
				assert.strictEqual(lastString(fields, 1), 'session');
				assert.strictEqual(lastString(fields, 3), 'webhook');
				assert.strictEqual(lastString(fields, 6), 'eventId');
				reply(null, encodeMessageField(1, Buffer.concat([
					encodeStringField(1, 'engine-trigger'), encodeStringField(2, 'Hook'),
					encodeStringField(3, 'webhook'), encodeInt32Field(5, 1),
				])));
			},
		});
		let client: GrpcUniverseAgentClient | undefined;
		try {
			const port = await new Promise<number>((resolve, reject) => {
				server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, boundPort) => error ? reject(error) : resolve(boundPort));
			});
			await loadGrpcModule();
			client = new GrpcUniverseAgentClient({ address: `127.0.0.1:${port}`, unaryDeadlineMs: 2_000 });
			assert.deepStrictEqual(await client.setClientToolProfile({ sessionId: 'session', profile: 'CLIENT_TOOL_PROFILE_NONE' }), { ok: false, error: 'Session not found' });
			const result = await client.registerSessionEngineTrigger({ sessionId: 'session', name: 'Hook', type: 'webhook', promptTemplate: 'Run', watchPaths: [], dedupeKeyField: 'eventId' });
			assert.strictEqual(result.trigger.triggerId, 'engine-trigger');
			assert.strictEqual(result.trigger.name, 'Hook');
			assert.strictEqual(result.trigger.enabled, true);
			assert.deepStrictEqual(seen, [profilePath, triggerPath]);
		} finally {
			client?.close();
			server.forceShutdown();
		}
	});

	test('GetPermissionMode sends the session id and maps the engine mode, unknown numbers read as unspecified', async () => {
		const server = new grpc.Server();
		const path = '/agentservice.PermissionService/GetPermissionMode';
		const sessions: (string | undefined)[] = [];
		const replies = [encodeInt32Field(1, 3), encodeInt32Field(1, 1), new Uint8Array(0), encodeInt32Field(1, 9)];
		server.addService({ GetPermissionMode: { path, requestStream: false, responseStream: false, requestSerialize: (value: Buffer) => value, requestDeserialize: (value: Buffer) => value, responseSerialize: (value: Buffer) => value, responseDeserialize: (value: Buffer) => value } }, {
			GetPermissionMode: (call: grpc.ServerUnaryCall<Buffer, Buffer>, reply: grpc.sendUnaryData<Buffer>) => {
				sessions.push(lastString(readProtoFields(call.request), 1));
				reply(null, Buffer.from(replies[sessions.length - 1]));
			},
		});
		let client: GrpcUniverseAgentClient | undefined;
		try {
			const port = await new Promise<number>((resolve, reject) => {
				server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, boundPort) => error ? reject(error) : resolve(boundPort));
			});
			await loadGrpcModule();
			client = new GrpcUniverseAgentClient({ address: `127.0.0.1:${port}`, unaryDeadlineMs: 2_000 });
			const modes = [];
			for (const sessionId of ['a', 'b', 'c', 'd']) {
				modes.push((await client.getPermissionMode({ sessionId })).mode);
			}
			assert.deepStrictEqual({ sessions, modes }, {
				sessions: ['a', 'b', 'c', 'd'],
				modes: ['SESSION_TOOL_PERMISSION_MODE_PERMIT', 'SESSION_TOOL_PERMISSION_MODE_ASK', 'SESSION_TOOL_PERMISSION_MODE_UNSPECIFIED', 'SESSION_TOOL_PERMISSION_MODE_UNSPECIFIED'],
			});
		} finally {
			client?.close();
			server.forceShutdown();
		}
	});
});
