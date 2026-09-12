/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { asUnaryProtoBytes } from '../../node/grpc/grpcClientCalls.js';
import {
	EMPTY_PROTO_MESSAGE,
	decodeAgentTreeResponse,
	decodeListAgentProfilesResponse,
	decodeListAgentsResponse,
	decodeListDevicesResponse,
	decodeListHookPointsResponse,
	decodeListModelsResponse,
	decodeListProjectRulesResponse,
	decodeListProviderStatusResponse,
	decodeListSessionsResponse,
	decodeListTeamsResponse,
	decodeProviderStatus,
	decodeSaveAgentProfileResponse,
	decodeSessionInfoResponse,
	encodeAgentTreeRequest,
	encodeEmptyProtoMessage,
	encodeListAgentProfilesRequest,
	encodeListAgentsRequest,
	encodeListDevicesRequest,
	encodeListHookPointsRequest,
	encodeListModelsRequest,
	encodeListProjectRulesRequest,
	encodeListSessionsRequest,
	encodeListTeamsRequest,
	encodeProbeRpcRequest,
	encodeSaveAgentProfileRequest,
	encodeUpsertProjectRuleRequest,
	encodeUpsertProviderCredentialsRequest,
	SESSION_LIST_FILTER_ALL,
} from '../../node/grpc/grpcCatalogUnaryWire.js';
import {
	mapAgentProfileDetail,
	mapListAgentProfilesResponse,
	mapListHookPointsResponse,
	mapListProjectRulesResponse,
	mapListProviderStatusResponse,
	mapListSessionsResponse,
	mapListTeamsResponse,
	mapProviderStatus,
	mapSessionInfoResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc catalog unary protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('empty proto is 0 payload bytes and is still framed as a unary request', () => {
		const encoded = encodeListDevicesRequest();
		assert.strictEqual(encoded.length, 0);
		assert.strictEqual(encodeEmptyProtoMessage().length, 0);
		assert.ok(encoded !== undefined);
		const framed = asUnaryProtoBytes(EMPTY_PROTO_MESSAGE);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
		assert.notStrictEqual(framed[0], 0x7b);
	});

	test('encodeProbeRpcRequest is empty proto, not JSON {}', () => {
		const encoded = encodeProbeRpcRequest();
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(JSON.stringify({}), Buffer.from(encoded).toString('utf8'));
		const framed = asUnaryProtoBytes(encoded);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
		assert.notStrictEqual(framed[0], 0x7b);
	});

	test('encodeListSessionsRequest writes limit/offset and ALL filter, not JSON', () => {
		const encoded = encodeListSessionsRequest({ limit: 20, offset: 5 });
		assert.notStrictEqual(encoded[0], 0x7b);
		const numbers = new Map<number, number>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(numbers.get(1), 20);
		assert.strictEqual(numbers.get(2), 5);
		assert.strictEqual(numbers.get(4), SESSION_LIST_FILTER_ALL);
	});

	test('encodeListSessionsRequest with no paging writes SESSION_LIST_FILTER_ALL, not JSON {}', () => {
		const encoded = encodeListSessionsRequest({});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		const numbers = new Map<number, number>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(numbers.get(4), SESSION_LIST_FILTER_ALL);
		assert.strictEqual(numbers.has(1), false);
		assert.strictEqual(numbers.has(2), false);
	});

	test('decodeListSessionsResponse reads session_id and total', () => {
		const summary = Buffer.concat([
			encodeStringField(1, 'eng-1'),
			encodeInt32Field(2, 1),
			encodeStringField(7, 'Hello'),
			encodeStringField(9, '/engine/work'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, summary),
			encodeInt32Field(2, 3),
		]);
		const decoded = decodeListSessionsResponse(encoded);
		assert.strictEqual(decoded.sessions?.[0]?.session_id, 'eng-1');
		assert.strictEqual(decoded.sessions?.[0]?.title, 'Hello');
		assert.strictEqual(decoded.sessions?.[0]?.work_dir, '/engine/work');
		assert.strictEqual(decoded.total_count, 3);
		const mapped = mapListSessionsResponse(decoded);
		assert.strictEqual(mapped.sessions[0]?.workDir, '/engine/work');
	});

	test('decode+map ListSessions yields sessionId for roster catalog', () => {
		const summary = Buffer.concat([
			encodeStringField(1, 'eng-listed'),
			encodeStringField(7, 'New session'),
		]);
		const mapped = mapListSessionsResponse(decodeListSessionsResponse(encodeMessageField(1, summary)));
		assert.strictEqual(mapped.sessions[0]?.sessionId, 'eng-listed');
		assert.strictEqual(mapped.sessions[0]?.title, 'New session');
	});

	test('encodeListAgentProfilesRequest writes project_path field 1', () => {
		const encoded = encodeListAgentProfilesRequest('/tmp/proj');
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields[0].field, 1);
		assert.strictEqual(Buffer.from(fields[0].wireType === 2 ? fields[0].bytes : []).toString('utf8'), '/tmp/proj');
	});

	test('encodeListAgentProfilesRequest without path is empty proto', () => {
		assert.strictEqual(encodeListAgentProfilesRequest(undefined).length, 0);
	});

	test('decodeListAgentProfilesResponse reads id/name/source', () => {
		const profile = Buffer.concat([
			encodeStringField(1, 'p1'),
			encodeStringField(2, 'Default'),
			encodeStringField(14, 'USER'),
		]);
		const decoded = decodeListAgentProfilesResponse(encodeMessageField(1, profile));
		assert.strictEqual(decoded.profiles?.[0]?.id, 'p1');
		assert.strictEqual(decoded.profiles?.[0]?.name, 'Default');
		assert.strictEqual(decoded.profiles?.[0]?.source, 'USER');
	});

	test('decodeListDevicesResponse reads device_id', () => {
		const device = encodeStringField(1, 'dev-1');
		const decoded = decodeListDevicesResponse(encodeMessageField(1, device));
		assert.strictEqual(decoded.devices?.[0]?.device_id, 'dev-1');
	});

	test('encodeListModelsRequest writes include_disabled true, not JSON', () => {
		const encoded = encodeListModelsRequest();
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields.length, 1);
		assert.strictEqual(fields[0].field, 2);
		assert.strictEqual(fields[0].wireType, 0);
		if (fields[0].wireType === 0) {
			assert.strictEqual(Number(fields[0].varint), 1);
		}
	});

	test('decodeListModelsResponse reads ModelEntryProto fields', () => {
		const model = Buffer.concat([
			encodeStringField(1, 'fast'),
			encodeStringField(2, 'chat'),
			encodeInt32Field(3, 1),
			encodeInt32Field(4, 7),
			encodeStringField(8, 'openai'),
			encodeStringField(9, 'gpt-fast'),
		]);
		const decoded = decodeListModelsResponse(encodeMessageField(1, model));
		assert.strictEqual(decoded.models?.[0]?.id, 'fast');
		assert.strictEqual(decoded.models?.[0]?.enabled, true);
		assert.strictEqual(decoded.models?.[0]?.level, 7);
		assert.strictEqual(decoded.models?.[0]?.provider, 'openai');
		assert.strictEqual(decoded.models?.[0]?.model_id, 'gpt-fast');
	});

	test('encodeListAgentsRequest with empty session_id is empty proto, not JSON {}', () => {
		const encoded = encodeListAgentsRequest('');
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(JSON.stringify({ session_id: '' }), Buffer.from(encoded).toString('utf8'));
		const framed = asUnaryProtoBytes(encoded);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
	});

	test('decodeListAgentsResponse reads agent_id', () => {
		const agent = Buffer.concat([
			encodeStringField(1, 'root'),
			encodeStringField(2, 'Root'),
		]);
		const decoded = decodeListAgentsResponse(encodeMessageField(1, agent));
		assert.strictEqual(decoded.agents?.[0]?.agent_id, 'root');
		assert.strictEqual(decoded.agents?.[0]?.name, 'Root');
	});

	test('encodeAgentTreeRequest writes session_id field 1', () => {
		const encoded = encodeAgentTreeRequest('eng-9');
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.strictEqual(Buffer.from(fields[0].wireType === 2 ? fields[0].bytes : []).toString('utf8'), 'eng-9');
	});

	test('decodeAgentTreeResponse reads root agent_id', () => {
		const root = Buffer.concat([
			encodeStringField(1, 'root'),
			encodeStringField(2, 'Root'),
			encodeInt32Field(3, 1),
		]);
		const decoded = decodeAgentTreeResponse(encodeMessageField(1, root));
		assert.strictEqual(decoded.root?.agent_id, 'root');
		assert.strictEqual(decoded.root?.type, 'AGENT_TYPE_SUB');
	});

	test('decodeSessionInfoResponse reads work_dir field 7', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeStringField(6, 'gpt-test'),
			encodeStringField(7, '/meta/work'),
		]);
		const decoded = decodeSessionInfoResponse(encoded);
		assert.strictEqual(decoded.session_id, 'sess-1');
		assert.strictEqual(decoded.work_dir, '/meta/work');
		assert.strictEqual(mapSessionInfoResponse(decoded).workDir, '/meta/work');
	});

	test('decodeListAgentProfilesResponse reads model/model_type/max_turns; 0 omitted', () => {
		const profile = Buffer.concat([
			encodeStringField(1, 'p1'),
			encodeStringField(2, 'Default'),
			encodeStringField(17, 'gpt-fast'),
			encodeStringField(18, 'chat'),
			encodeInt32Field(19, 12),
		]);
		const decoded = decodeListAgentProfilesResponse(encodeMessageField(1, profile));
		assert.strictEqual(decoded.profiles?.[0]?.model, 'gpt-fast');
		assert.strictEqual(decoded.profiles?.[0]?.model_type, 'chat');
		assert.strictEqual(decoded.profiles?.[0]?.max_turns, 12);
		const mapped = mapListAgentProfilesResponse(decoded).profiles[0];
		assert.strictEqual(mapped?.model, 'gpt-fast');
		assert.strictEqual(mapped?.modelType, 'chat');
		assert.strictEqual(mapped?.maxTurns, 12);

		const zeroProfile = Buffer.concat([
			encodeStringField(1, 'p0'),
			encodeStringField(2, 'Zero'),
			encodeInt32Field(19, 0),
		]);
		const zeroDecoded = decodeListAgentProfilesResponse(encodeMessageField(1, zeroProfile));
		assert.strictEqual(zeroDecoded.profiles?.[0]?.max_turns, undefined);
		assert.strictEqual(mapAgentProfileDetail(zeroDecoded.profiles![0]).maxTurns, undefined);
	});

	test('SaveAgentProfile proto roundtrip writes fields 17-19 and skips max_turns=0', () => {
		const encoded = encodeSaveAgentProfileRequest({
			id: 'p1',
			name: 'Reviewer',
			model: 'gpt-fast',
			modelType: 'chat',
			maxTurns: 8,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const saved = decodeSaveAgentProfileResponse(encoded);
		assert.strictEqual(saved.profile?.id, 'p1');
		assert.strictEqual(saved.profile?.model, 'gpt-fast');
		assert.strictEqual(saved.profile?.model_type, 'chat');
		assert.strictEqual(saved.profile?.max_turns, 8);

		const zeroEncoded = encodeSaveAgentProfileRequest({
			id: 'p0',
			name: 'Default',
			maxTurns: 0,
		});
		const fields = readProtoFields(zeroEncoded);
		assert.ok(fields[0] && fields[0].wireType === 2);
		const inner = readProtoFields(fields[0].bytes);
		assert.ok(!inner.some(field => field.field === 19));
	});

	test('ProviderStatus decode has no api_key; upsert writes field 2 outbound only', () => {
		const status = Buffer.concat([
			encodeStringField(1, 'openai'),
			encodeStringField(2, 'OpenAI'),
			encodeStringField(3, 'openai'),
			encodeInt32Field(4, 1),
			encodeStringField(5, 'FILE'),
			encodeInt32Field(6, 1),
			encodeInt32Field(7, 1),
		]);
		const decoded = decodeProviderStatus(status);
		assert.strictEqual(decoded.provider_id, 'openai');
		assert.strictEqual((decoded as { api_key?: string }).api_key, undefined);
		assert.ok(!Object.keys(decoded).includes('api_key'));
		const mapped = mapProviderStatus(decoded);
		assert.ok(!('apiKey' in mapped));
		assert.strictEqual(mapped.credentialSource, 'FILE');

		const upsert = encodeUpsertProviderCredentialsRequest({
			providerId: 'openai',
			apiKey: 'sk-test',
			baseUrl: 'https://api.example',
			protocol: 'openai',
		});
		const upsertFields = readProtoFields(upsert);
		const byField = new Map(upsertFields.map(field => [field.field, field]));
		assert.ok(byField.get(2) && byField.get(2)!.wireType === 2);
		assert.strictEqual(Buffer.from((byField.get(2) as { bytes: Uint8Array }).bytes).toString('utf8'), 'sk-test');
		const listed = decodeListProviderStatusResponse(encodeMessageField(1, status));
		assert.strictEqual(mapListProviderStatusResponse(listed).providers[0]?.providerId, 'openai');
	});

	test('ProjectRule List/Upsert encode scope+session_id only, never work_dir', () => {
		const encoded = encodeListProjectRulesRequest({ scope: 1, sessionId: 'sess-1' });
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.ok(fields.every(field => field.field === 1 || field.field === 2));
		assert.ok(!fields.some(field => field.wireType === 2 && Buffer.from(field.bytes).toString('utf8') === 'work_dir'));

		const upsert = encodeUpsertProjectRuleRequest({
			scope: 2,
			sessionId: 'sess-1',
			rule: {
				id: 'r1',
				title: 'Style',
				enabled: true,
				priority: 1,
				body: 'Use tabs',
				scope: 2,
				globs: ['*.ts'],
				appliesTo: ['agent'],
			},
		});
		const upsertFields = readProtoFields(upsert);
		assert.ok(upsertFields.every(field => field.field === 1 || field.field === 2 || field.field === 3));
		const rule = Buffer.concat([
			encodeStringField(1, 'r1'),
			encodeStringField(2, 'Style'),
			encodeInt32Field(3, 1),
			encodeInt32Field(4, 2),
			encodeStringField(5, 'Use tabs'),
			encodeInt32Field(6, 1),
			encodeStringField(7, '*.ts'),
		]);
		const listed = decodeListProjectRulesResponse(encodeMessageField(1, rule));
		const mapped = mapListProjectRulesResponse(listed).rules[0];
		assert.strictEqual(mapped?.id, 'r1');
		assert.strictEqual(mapped?.scope, 1);
		assert.deepStrictEqual(mapped?.globs, ['*.ts']);
	});

	test('ListHookPoints and ListTeams decode empty and populated catalogs', () => {
		assert.strictEqual(encodeListHookPointsRequest().length, 0);
		const emptyHooks = mapListHookPointsResponse(decodeListHookPointsResponse(new Uint8Array(0)));
		assert.deepStrictEqual(emptyHooks.points, []);
		assert.strictEqual(emptyHooks.catalogRevision, '');

		const point = Buffer.concat([
			encodeStringField(1, 'pre-tool'),
			encodeStringField(2, 'tool'),
			encodeStringField(3, 'ListTools'),
			encodeInt32Field(4, 2),
		]);
		const hooks = decodeListHookPointsResponse(Buffer.concat([
			encodeMessageField(1, point),
			encodeStringField(2, 'rev-1'),
		]));
		assert.strictEqual(mapListHookPointsResponse(hooks).points[0]?.methodName, 'ListTools');
		assert.strictEqual(mapListHookPointsResponse(hooks).catalogRevision, 'rev-1');

		const encodedTeams = encodeListTeamsRequest('sess-1');
		assert.notStrictEqual(encodedTeams[0], 0x7b);
		assert.strictEqual(Buffer.from(readProtoFields(encodedTeams)[0].wireType === 2 ? readProtoFields(encodedTeams)[0].bytes : []).toString('utf8'), 'sess-1');
		assert.deepStrictEqual(mapListTeamsResponse(decodeListTeamsResponse(new Uint8Array(0))).teams, []);
		const team = Buffer.concat([
			encodeInt32Field(1, 7),
			encodeStringField(2, 'ACTIVE'),
			encodeStringField(3, 'root'),
		]);
		const teams = mapListTeamsResponse(decodeListTeamsResponse(encodeMessageField(1, team)));
		assert.strictEqual(teams.teams[0]?.teamId, 7);
		assert.strictEqual(teams.teams[0]?.status, 'ACTIVE');
		assert.strictEqual(teams.teams[0]?.managerAgentId, 'root');
	});
});
