/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { GrpcUniverseAgentClient } from '../../node/grpc/grpcClient.js';
import { decodeQueueState, encodeSaveSkillContentRequest } from '../../node/grpc/grpcQueueSkillWire.js';
import { encodeInt32Field, encodeInt64Field, encodeMessageField, encodeStringField, lastString, lastVarint, readProtoFields } from '../../node/grpc/grpcProtoCodec.js';
import { probeConversationEntryCapability } from '../../node/grpcCapabilityProbe.js';
import { GrpcStatusCode, type IUniverseAgentGrpcTransport } from '../../node/grpc/grpcTransport.js';

suite('Queue readback and skill content protocol', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('actual client methods send binary tags and decode responses', async () => {
		const requests: { path: string; bytes: Buffer }[] = [];
		const channel = { makeUnaryRequest(path: string, serialize: (v: Uint8Array) => Buffer, deserialize: (v: Buffer) => unknown, request: Uint8Array, callback: (error: null, result: unknown) => void) {
			requests.push({ path, bytes: serialize(request) });
			callback(null, deserialize(path.endsWith('/GetQueue') ? encodeInt64Field(7, 9007199254740993n) : encodeInt32Field(1, 1)));
		} };
		const client = Object.create(GrpcUniverseAgentClient.prototype) as GrpcUniverseAgentClient;
		Reflect.set(client, '_channel', channel);
		assert.strictEqual((await client.getQueue({ sessionId: 'real-engine-id' })).version, '9007199254740993');
		assert.deepStrictEqual(await client.saveSkillContent({ skillName: 'demo', content: '# New', create: false, expectedSource: 'project', expectedContent: '' }), { ok: true, reason: undefined });
		assert.strictEqual(requests[0].path, '/agentservice.AgentService/GetQueue');
		assert.strictEqual(lastString(readProtoFields(requests[0].bytes), 1), 'real-engine-id');
		assert.strictEqual(requests[1].path, '/agentservice.ToolService/SaveSkillContent');
		const fields = readProtoFields(requests[1].bytes);
		assert.strictEqual(lastString(fields, 1), 'demo');
		assert.strictEqual(lastString(fields, 2), '# New');
		assert.strictEqual(lastString(fields, 4), 'project');
		assert.strictEqual(lastString(fields, 5), '', 'optional empty original must retain presence');
		const create = readProtoFields(encodeSaveSkillContentRequest({ skillName: 'fresh', content: '', create: true }));
		assert.strictEqual(lastVarint(create, 3), 1n);
		assert.strictEqual(lastString(create, 5), undefined);
	});
	test('queue item fields, float and int64 values survive', () => {
		const float = Buffer.alloc(5); float[0] = (7 << 3) | 5; float.writeFloatLE(0.5, 1);
		const item = Buffer.concat([encodeStringField(1, 'q'), encodeStringField(2, 'client'), encodeStringField(3, 'Body'), encodeInt64Field(4, 9007199254740993n), encodeInt32Field(5, 1), encodeInt32Field(6, 1), float, encodeInt32Field(8, 2), encodeStringField(9, 'Upload failed'), encodeInt32Field(10, 1), encodeInt32Field(11, 1), encodeInt32Field(12, 1), encodeStringField(13, 'turn'), encodeStringField(14, 'preview'), encodeInt32Field(15, 3), encodeInt32Field(16, 4), encodeInt32Field(17, 2)]);
		const state = decodeQueueState(Buffer.concat([encodeMessageField(1, item), encodeInt32Field(2, 1), encodeInt32Field(3, 3), encodeStringField(4, 'q'), encodeStringField(5, 'op'), encodeInt32Field(6, 1), encodeInt64Field(7, 9007199254740994n)]));
		assert.strictEqual(state.version, '9007199254740994');
		assert.strictEqual(state.pauseReason, 'LOCK');
		assert.strictEqual(state.isPaused, true); assert.strictEqual(state.isProcessing, true);
		assert.deepStrictEqual(state.items[0], { id: 'q', clientMessageId: 'client', text: 'Body', createdAt: '9007199254740993', status: 'UPLOADING', hold: 'EDITING', uploadProgress: 0.5, retryCount: 2, lastError: 'Upload failed', priority: 'HIGH', pinned: true, locked: true, forkFromTurnId: 'turn', forkFromPreview: 'preview', version: 3, uploadTotalCount: 4, uploadCompletedCount: 2 });
	});
	test('unknown enums and truncated floats fail closed', () => {
		assert.throws(() => decodeQueueState(encodeMessageField(1, Buffer.concat([encodeStringField(1, 'q'), encodeInt32Field(5, 99)]))), /queue enum/);
		assert.throws(() => decodeQueueState(encodeMessageField(1, Buffer.from([0x3d, 0, 0]))), /truncated protobuf fixed32/);
		assert.throws(() => decodeQueueState(encodeInt64Field(7, -1n)), /Invalid queue int64/);
		assert.deepStrictEqual(decodeQueueState(Buffer.alloc(0)).items, []);
	});
	test('GetQueue advertisement and empty-request statuses stay three-state', async () => {
		for (const [methods, status, expected] of [[[], 0, 'UNSUPPORTED'], [['AgentService.*'], GrpcStatusCode.UNIMPLEMENTED, 'UNSUPPORTED'], [['AgentService.GetQueue'], GrpcStatusCode.INVALID_ARGUMENT, 'SUPPORTED'], [['AgentService.GetQueue'], GrpcStatusCode.UNAVAILABLE, 'UNKNOWN']] as const) {
			const transport = { probeRpc: async () => status } as unknown as IUniverseAgentGrpcTransport;
			assert.strictEqual((await probeConversationEntryCapability({ methods, transport })).getQueue, expected);
		}
	});
});
