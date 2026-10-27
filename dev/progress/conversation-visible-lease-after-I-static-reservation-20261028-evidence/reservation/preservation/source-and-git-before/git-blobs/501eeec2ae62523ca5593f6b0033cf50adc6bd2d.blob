/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
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
	decodeListSkillsResponse,
	decodeListTeamsResponse,
	decodeListToolsResponse,
	decodeListCommandsResponse,
	decodeGetCommandDefResponse,
	decodeSetSkillEnabledResponse,
	decodeSkillInfoResponse,
	decodeToolInfoResponse,
	decodeDeleteAgentProfileResponse,
	decodeMemberStatusResponse,
	decodeProviderStatus,
	decodeSaveAgentProfileResponse,
	decodeSessionInfoResponse,
	decodeSwitchModelResponse,
	decodeTaskListResponse,
	decodeTeamInfoResponse,
	decodeQueueMutationResponse,
	encodeAgentTreeRequest,
	encodeCancelSessionGoalRequest,
	encodeDeleteSessionRequest,
	encodeEditQueueItemRequest,
	encodeEmptyProtoMessage,
	encodeEnqueueQueueItemRequest,
	encodeGetSessionRulesRequest,
	encodeHoldQueueItemRequest,
	encodeInsertQueueItemRequest,
	encodeListAgentProfilesRequest,
	encodeListAgentsRequest,
	encodeListDevicesRequest,
	encodeListHookPointsRequest,
	encodeListModelsRequest,
	encodeListProjectRulesRequest,
	encodeListSessionsRequest,
	encodeListSkillsRequest,
	encodeListTeamsRequest,
	encodeListToolsRequest,
	encodeListCommandsRequest,
	encodeGetCommandDefRequest,
	encodeSetSkillEnabledRequest,
	encodeSkillInfoRequest,
	encodeToolInfoRequest,
	encodeDeleteAgentProfileRequest,
	encodeMemberStatusRequest,
	encodeProbeRpcRequest,
	encodePromotePermissionRuleRequest,
	encodeQueueItemRefRequest,
	encodeQueueRefRequest,
	encodeReorderQueueRequest,
	encodeRespondPermissionRequest,
	encodeSaveAgentProfileRequest,
	encodeSessionInfoRequest,
	encodeSetPermissionModeRequest,
	encodeSetQueueItemForkAnchorRequest,
	encodeSetQueueItemLockedRequest,
	encodeSetSessionGoalRequest,
	encodeSwitchModelRequest,
	encodeSyncPermissionRuleRequest,
	encodeTaskListRequest,
	encodeTeamInfoRequest,
	encodeUpsertProjectRuleRequest,
	encodeUpsertProviderCredentialsRequest,
	decodeGetSessionRulesResponse,
	decodePromotePermissionRuleResponse,
	decodeSyncPermissionRuleResponse,
	SESSION_LIST_FILTER_ALL,
} from '../../node/grpc/grpcCatalogUnaryWire.js';
import {
	mapAgentProfileDetail,
	mapListAgentProfilesResponse,
	mapListHookPointsResponse,
	mapListProjectRulesResponse,
	mapListProviderStatusResponse,
	mapListSessionsResponse,
	mapListSkillsResponse,
	mapListTeamsResponse,
	mapListToolsResponse,
	mapListCommandsResponse,
	mapGetCommandDefResponse,
	mapSetSkillEnabledResponse,
	mapSkillInfoResponse,
	mapToolInfoResponse,
	mapDeleteAgentProfileResponse,
	mapMemberInfo,
	mapProviderStatus,
	mapSessionInfoResponse,
	mapGetSessionRulesResponse,
	mapTaskInfo,
} from '../../node/grpc/grpcClientMappers.js';
import {
	encodeInt32Field,
	encodeInt64Field,
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
		const firstField = readProtoFields(encodedTeams)[0];
		assert.strictEqual(Buffer.from(firstField?.wireType === 2 ? firstField.bytes : []).toString('utf8'), 'sess-1');
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

	test('encodeDeleteSessionRequest reuses Session.Info session_id field 1, not JSON', () => {
		const encoded = encodeDeleteSessionRequest('sess-del');
		assert.notStrictEqual(encoded[0], 0x7b);
		const info = encodeSessionInfoRequest('sess-del');
		assert.deepStrictEqual(Buffer.from(encoded), Buffer.from(info));
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields[0]?.field, 1);
		assert.strictEqual(Buffer.from(fields[0]?.wireType === 2 ? fields[0].bytes : []).toString('utf8'), 'sess-del');
	});

	test('encodeSetPermissionModeRequest writes session_id field 1 and mode varint 2', () => {
		const encoded = encodeSetPermissionModeRequest('sess-1', 1);
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		const numbers = new Map<number, number>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(numbers.get(2), 1);
	});

	test('encodeSetPermissionModeRequest omits unspecified mode 0', () => {
		const encoded = encodeSetPermissionModeRequest('sess-1', 0);
		const numbers = new Map<number, number>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(numbers.has(2), false);
	});

	test('encodeSetSessionGoalRequest writes session_id field 1 and goal field 2, not JSON', () => {
		const encoded = encodeSetSessionGoalRequest({ sessionId: 'sess-1', goal: 'Ship the slice' });
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'Ship the slice');
		assert.strictEqual(strings.has(3), false);
	});

	test('encodeCancelSessionGoalRequest writes session_id field 1, not JSON', () => {
		const encoded = encodeCancelSessionGoalRequest({ sessionId: 'sess-1' });
		const info = encodeSessionInfoRequest('sess-1');
		assert.deepStrictEqual(Buffer.from(encoded), Buffer.from(info));
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields[0]?.field, 1);
		assert.strictEqual(Buffer.from(fields[0]?.wireType === 2 ? fields[0].bytes : []).toString('utf8'), 'sess-1');
		assert.strictEqual(fields.length, 1);
	});

	test('encodeRespondPermissionRequest writes fields 1-4; granted false omits field 3', () => {
		const allowed = encodeRespondPermissionRequest({
			sessionId: 'sess-1',
			requestId: 'perm-9',
			granted: true,
			metadataJson: '{"reason":"ok"}',
		});
		assert.notStrictEqual(allowed[0], 0x7b);
		const strings = new Map<number, string>();
		const numbers = new Map<number, number>();
		for (const field of readProtoFields(allowed)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'perm-9');
		assert.strictEqual(numbers.get(3), 1);
		assert.strictEqual(strings.get(4), '{"reason":"ok"}');

		const denied = encodeRespondPermissionRequest({
			sessionId: 'sess-1',
			requestId: 'perm-9',
			granted: false,
		});
		const deniedNumbers = new Map<number, number>();
		const deniedStrings = new Map<number, string>();
		for (const field of readProtoFields(denied)) {
			if (field.wireType === 0) {
				deniedNumbers.set(field.field, Number(field.varint));
			}
			if (field.wireType === 2) {
				deniedStrings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(deniedNumbers.has(3), false);
		assert.strictEqual(deniedStrings.has(4), false);
	});

	test('encodeSyncPermissionRuleRequest writes fields 1-5; omits empty and action 0', () => {
		const encoded = encodeSyncPermissionRuleRequest('sess-1', 'bash', 'command', 1, 'allow shell');
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'bash');
		assert.strictEqual(protoStrings(encoded).get(3), 'command');
		assert.strictEqual(protoVarints(encoded).get(4), 1);
		assert.strictEqual(protoStrings(encoded).get(5), 'allow shell');
		const omitted = encodeSyncPermissionRuleRequest('', '', '', 0, '');
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(4));
	});

	test('decodeSyncPermissionRuleResponse reads success=1 rule_id=2 and ignores unknown fields', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'rule-9'),
			encodeStringField(3, 'unused'),
		]);
		assert.deepStrictEqual(decodeSyncPermissionRuleResponse(encoded), { ok: true, ruleId: 'rule-9' });
		assert.deepStrictEqual(decodeSyncPermissionRuleResponse(new Uint8Array(0)), { ok: false, ruleId: '' });
	});

	test('encodePromotePermissionRuleRequest writes tool_name=1 scope=2 action=3; omits empty and action 0', () => {
		const encoded = encodePromotePermissionRuleRequest('bash', 'command', 2);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'bash');
		assert.strictEqual(protoStrings(encoded).get(2), 'command');
		assert.strictEqual(protoVarints(encoded).get(3), 2);
		assert.ok(!protoStrings(encoded).has(4));
		const omitted = encodePromotePermissionRuleRequest('', '', 0);
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(3));
	});

	test('decodePromotePermissionRuleResponse reads success=1 and ignores unknown fields', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'unused'),
		]);
		assert.deepStrictEqual(decodePromotePermissionRuleResponse(encoded), { ok: true });
		assert.deepStrictEqual(decodePromotePermissionRuleResponse(new Uint8Array(0)), { ok: false });
	});

	test('encodeGetSessionRulesRequest writes session_id field 1, not JSON', () => {
		const encoded = encodeGetSessionRulesRequest('sess-1');
		const info = encodeSessionInfoRequest('sess-1');
		assert.deepStrictEqual(Buffer.from(encoded), Buffer.from(info));
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.ok(!protoStrings(encoded).has(2));
		assert.strictEqual(encodeGetSessionRulesRequest('').length, 0);
	});

	test('decodeGetSessionRulesResponse maps SessionRule 1-8 then mapper; unknown fields unread', () => {
		const rule = Buffer.concat([
			encodeStringField(1, 'rule-1'),
			encodeStringField(2, 'bash'),
			encodeStringField(3, 'command'),
			encodeInt32Field(4, 1),
			encodeStringField(5, 'allow shell'),
			encodeInt64Field(6, 1700000000),
			encodeInt64Field(7, 1700003600),
			encodeInt32Field(8, 1),
			encodeStringField(9, 'unused-field'),
		]);
		const encoded = encodeMessageField(1, rule);
		const wire = decodeGetSessionRulesResponse(encoded);
		assert.deepStrictEqual(wire, {
			rules: [{
				id: 'rule-1',
				tool_name: 'bash',
				scope: 'command',
				action: 1,
				reason: 'allow shell',
				created_at: 1700000000,
				expires_at: 1700003600,
				source: 1,
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused-field'), false);
		assert.deepStrictEqual(mapGetSessionRulesResponse(wire), {
			rules: [{
				id: 'rule-1',
				toolName: 'bash',
				scope: 'command',
				action: 'ALLOW',
				reason: 'allow shell',
				createdAt: 1700000000,
				expiresAt: 1700003600,
				source: 'USER_INTERACTIVE',
			}],
		});
		assert.deepStrictEqual(decodeGetSessionRulesResponse(new Uint8Array(0)), { rules: [] });
		assert.deepStrictEqual(mapGetSessionRulesResponse(decodeGetSessionRulesResponse(new Uint8Array(0))), { rules: [] });
	});

	test('encodeMemberStatusRequest and encodeTaskListRequest write session_id/agent_id fields 1-2', () => {
		const member = encodeMemberStatusRequest('sess-1', 'root');
		const tasks = encodeTaskListRequest('sess-1', 'root');
		assert.deepStrictEqual(Buffer.from(member), Buffer.from(tasks));
		assert.notStrictEqual(member[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(member)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'root');
		assert.strictEqual(strings.has(3), false);
	});

	test('encodeTeamInfoRequest writes session_id/agent_id/team_id fields 1-3', () => {
		const encoded = encodeTeamInfoRequest('sess-1', 'root', 7);
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		const numbers = new Map<number, number>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'root');
		assert.strictEqual(numbers.get(3), 7);
	});

	test('decodeMemberStatusResponse reads MemberInfo fields 1-6; dynamic bool 5 is string', () => {
		const member = Buffer.concat([
			encodeStringField(1, 'Alice'),
			encodeStringField(2, 'member:1'),
			encodeStringField(3, 'IDLE'),
			encodeStringField(4, 'p'),
			encodeInt32Field(5, 1),
			encodeInt32Field(6, 4),
		]);
		const decoded = decodeMemberStatusResponse(encodeMessageField(1, member));
		const mapped = mapMemberInfo(decoded.members?.[0] ?? {});
		assert.deepStrictEqual(mapped, {
			memberName: 'Alice',
			memberAgentId: 'member:1',
			status: 'IDLE',
			preset: 'p',
			dynamic: 'true',
			turnCount: 4,
		});
	});

	test('decodeTaskListResponse reads BlackboardTask fields 1-7', () => {
		const task = Buffer.concat([
			encodeStringField(1, 'task-1'),
			encodeStringField(2, 'Alice'),
			encodeStringField(3, 'Investigate'),
			encodeStringField(4, 'IN_PROGRESS'),
			encodeStringField(5, 'wait-review'),
			encodeStringField(6, 'started'),
			encodeStringField(7, 'Look into the failure'),
		]);
		const decoded = decodeTaskListResponse(encodeMessageField(1, task));
		const mapped = mapTaskInfo(decoded.tasks?.[0] ?? {});
		assert.deepStrictEqual(mapped, {
			taskId: 'task-1',
			subject: 'Look into the failure',
			owner: 'Alice',
			status: 'IN_PROGRESS',
			blockedBy: 'wait-review',
			lastMessage: 'started',
			description: 'Investigate',
		});
	});

	test('decodeTeamInfoResponse reads team_id field 1 and status field 4', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 7),
			encodeStringField(2, 'ignored-member'),
			encodeStringField(3, 'ignored-task'),
			encodeStringField(4, 'ACTIVE'),
		]);
		const decoded = decodeTeamInfoResponse(encoded);
		assert.strictEqual(decoded.team_id, 7);
		assert.strictEqual(decoded.status, 'ACTIVE');
		assert.strictEqual(decodeTeamInfoResponse(new Uint8Array(0)).team_id, undefined);
	});

	test('encodeSwitchModelRequest writes oneof model_type field 10, not 3', () => {
		const encoded = encodeSwitchModelRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			modelType: 'quality',
			modelId: '',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'root');
		assert.strictEqual(strings.get(10), 'quality');
		assert.strictEqual(strings.has(3), false);
		assert.strictEqual(strings.has(11), false);
	});

	test('encodeSwitchModelRequest writes oneof model_id field 11, not 4', () => {
		const encoded = encodeSwitchModelRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			modelType: '',
			modelId: 'claude-sonnet',
		});
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(11), 'claude-sonnet');
		assert.strictEqual(strings.has(4), false);
		assert.strictEqual(strings.has(10), false);
	});

	test('decodeSwitchModelResponse reads resolved_model_id/provider/level/cost/speed', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'claude-sonnet'),
			encodeStringField(2, 'anthropic'),
			encodeInt32Field(3, 7),
			encodeStringField(4, 'middle'),
			encodeStringField(5, 'fast'),
		]);
		const decoded = decodeSwitchModelResponse(encoded);
		assert.deepStrictEqual(decoded, {
			resolvedModelId: 'claude-sonnet',
			provider: 'anthropic',
			level: 7,
			cost: 'middle',
			speed: 'fast',
		});
	});

	test('encodeQueueRefRequest writes session_id=1 op_id=2 and omits empty op_id', () => {
		const encoded = encodeQueueRefRequest({ sessionId: 'sess-1', opId: 'op-9' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), { 1: 'sess-1', 2: 'op-9' });
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encodeQueueRefRequest({ sessionId: 'sess-1', opId: '' }))), { 1: 'sess-1' });
	});

	test('encodeQueueItemRefRequest tags item_id=2 op_id=3, not JSON key order', () => {
		const encoded = encodeQueueItemRefRequest({ sessionId: 'sess-1', opId: 'op-9', itemId: 'item-4' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'item-4',
			3: 'op-9',
		});
		assert.notStrictEqual(protoStrings(encoded).get(2), 'op-9');
	});

	test('encodeEnqueueQueueItemRequest writes 1-5 and does not invent fields 6/7', () => {
		const high = encodeEnqueueQueueItemRequest({
			sessionId: 'sess-1',
			opId: 'op-9',
			clientMessageId: 'c-1',
			text: 'hello',
			priority: 'HIGH',
		});
		assert.deepStrictEqual(Object.fromEntries(protoStrings(high)), {
			1: 'sess-1',
			2: 'op-9',
			3: 'c-1',
			4: 'hello',
		});
		assert.strictEqual(protoVarints(high).get(5), 1);
		assert.ok(!protoVarints(high).has(6));
		assert.ok(!protoVarints(high).has(7));
		const normal = encodeEnqueueQueueItemRequest({ sessionId: 'sess-1', text: 'hello', clientMessageId: '', priority: 'NORMAL' });
		assert.ok(!protoStrings(normal).has(2));
		assert.ok(!protoStrings(normal).has(3));
		assert.ok(!protoVarints(normal).has(5));
	});

	test('encodeInsertQueueItemRequest writes before_item_id=6 and omits 7/8', () => {
		const encoded = encodeInsertQueueItemRequest({
			sessionId: 'sess-1',
			opId: 'op-9',
			clientMessageId: 'c-1',
			text: 'hello',
			priority: 'LOW',
			beforeItemId: 'item-0',
		});
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'op-9',
			3: 'c-1',
			4: 'hello',
			6: 'item-0',
		});
		assert.strictEqual(protoVarints(encoded).get(5), 2);
		assert.ok(!protoVarints(encoded).has(7));
		assert.ok(!protoVarints(encoded).has(8));
		assert.ok(!protoStrings(encodeInsertQueueItemRequest({ sessionId: 'sess-1', text: 'hello', beforeItemId: '' })).has(6));
	});

	test('encodeReorderQueueRequest writes repeated item_ids as field 3', () => {
		const encoded = encodeReorderQueueRequest({ sessionId: 'sess-1', opId: 'op-9', itemIds: ['a', '', 'b'] });
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'op-9');
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 3), ['a', 'b']);
	});

	test('encodeSetQueueItemLockedRequest writes locked=4 only when true', () => {
		const locked = encodeSetQueueItemLockedRequest({ sessionId: 'sess-1', itemId: 'item-4', opId: 'op-9', locked: true });
		assert.deepStrictEqual(Object.fromEntries(protoStrings(locked)), { 1: 'sess-1', 2: 'item-4', 3: 'op-9' });
		assert.strictEqual(protoVarints(locked).get(4), 1);
		assert.ok(!protoVarints(encodeSetQueueItemLockedRequest({ sessionId: 'sess-1', itemId: 'item-4', locked: false })).has(4));
	});

	test('encodeSetQueueItemForkAnchorRequest / Hold / Edit omit empty and do not invent extra fields', () => {
		const fork = encodeSetQueueItemForkAnchorRequest({
			sessionId: 'sess-1',
			itemId: 'item-4',
			opId: 'op-9',
			forkFromTurnId: 'turn-2',
			forkFromPreview: 'preview',
		});
		assert.deepStrictEqual(Object.fromEntries(protoStrings(fork)), {
			1: 'sess-1',
			2: 'item-4',
			3: 'op-9',
			4: 'turn-2',
			5: 'preview',
		});
		assert.ok(!protoStrings(encodeSetQueueItemForkAnchorRequest({ sessionId: 'sess-1', itemId: 'item-4', forkFromTurnId: '', forkFromPreview: '' })).has(4));

		const hold = encodeHoldQueueItemRequest({ sessionId: 'sess-1', itemId: 'item-4', opId: 'op-9', reason: 'EDITING' });
		assert.strictEqual(protoVarints(hold).get(4), 1);
		assert.ok(!protoVarints(encodeHoldQueueItemRequest({ sessionId: 'sess-1', itemId: 'item-4', reason: 'NONE' })).has(4));

		const edit = encodeEditQueueItemRequest({ sessionId: 'sess-1', itemId: 'item-4', opId: 'op-9', text: 'revised' });
		assert.strictEqual(protoStrings(edit).get(4), 'revised');
		assert.ok(!protoVarints(edit).has(5));
		assert.ok(!protoStrings(encodeEditQueueItemRequest({ sessionId: 'sess-1', itemId: 'item-4', text: '' })).has(4));
	});

	test('decodeQueueMutationResponse reads ok/error/op_id/item_id and ignores field 5', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'denied'),
			encodeStringField(3, 'op-9'),
			encodeStringField(4, 'item-4'),
			encodeMessageField(5, encodeStringField(1, 'unused-detail')),
		]);
		assert.deepStrictEqual(decodeQueueMutationResponse(encoded), {
			ok: true,
			error: 'denied',
			opId: 'op-9',
			itemId: 'item-4',
		});
		assert.deepStrictEqual(decodeQueueMutationResponse(new Uint8Array(0)), { ok: false, error: undefined, opId: undefined, itemId: undefined });
	});

	test('encodeListToolsRequest is empty proto; this client omits category and include_hidden', () => {
		const encoded = encodeListToolsRequest();
		assert.strictEqual(encoded.length, 0);
		assert.strictEqual(encodeEmptyProtoMessage().length, 0);
		assert.notStrictEqual(JSON.stringify({}), Buffer.from(encoded).toString('utf8'));
		assert.notStrictEqual(encoded[0], 0x7b);
		const framed = asUnaryProtoBytes(encoded);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
	});

	test('decodeListToolsResponse reads tools=1 total=2 then mapper; unknown fields unread', () => {
		const tool = Buffer.concat([
			encodeStringField(1, 'bash'),
			encodeStringField(2, 'Run a command'),
			encodeStringField(3, 'shell'),
			encodeInt32Field(4, 1),
			encodeInt32Field(5, 1),
			encodeStringField(6, 'unused-tool-field'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, tool),
			encodeInt32Field(2, 3),
			encodeStringField(3, 'unused-response-field'),
		]);
		const wire = decodeListToolsResponse(encoded);
		assert.deepStrictEqual(wire, {
			tools: [{
				name: 'bash',
				description: 'Run a command',
				category: 'shell',
				destructive: true,
				requires_permission: true,
			}],
			total: 3,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapListToolsResponse(wire), {
			tools: [{
				name: 'bash',
				description: 'Run a command',
				category: 'shell',
				destructive: true,
				requiresPermission: true,
			}],
		});
		assert.deepStrictEqual(decodeListToolsResponse(new Uint8Array(0)), { tools: [] });
		assert.deepStrictEqual(mapListToolsResponse(decodeListToolsResponse(new Uint8Array(0))), { tools: [] });
	});

	test('encodeListSkillsRequest is empty proto', () => {
		const encoded = encodeListSkillsRequest();
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		const framed = asUnaryProtoBytes(encoded);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
	});

	test('decodeListSkillsResponse reads skills=1 total=2 then mapper; unknown fields unread', () => {
		const skill = Buffer.concat([
			encodeStringField(1, 'review'),
			encodeStringField(2, 'Code review skill'),
			encodeStringField(3, 'project'),
			encodeInt32Field(4, 1),
			encodeInt32Field(5, 1),
			encodeStringField(6, 'unused-skill-field'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, skill),
			encodeInt32Field(2, 4),
			encodeStringField(3, 'unused-response-field'),
		]);
		const wire = decodeListSkillsResponse(encoded);
		assert.deepStrictEqual(wire, {
			skills: [{
				name: 'review',
				description: 'Code review skill',
				source: 'project',
				slash_enabled: true,
				enabled: true,
			}],
			total: 4,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapListSkillsResponse(wire), {
			skills: [{
				name: 'review',
				description: 'Code review skill',
				source: 'project',
				enabled: true,
				slashEnabled: true,
			}],
		});
		assert.deepStrictEqual(decodeListSkillsResponse(new Uint8Array(0)), { skills: [] });
		assert.deepStrictEqual(mapListSkillsResponse(decodeListSkillsResponse(new Uint8Array(0))), { skills: [] });
	});

	test('encodeSkillInfoRequest writes skill_name=1, not JSON', () => {
		const encoded = encodeSkillInfoRequest({ skillName: 'review' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'review');
		assert.strictEqual(encodeSkillInfoRequest({ skillName: '' }).length, 0);
	});

	test('decodeSkillInfoResponse reads name/source/content then mapper; unknown fields unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'review'),
			encodeStringField(2, 'Code review skill'),
			encodeStringField(3, 'project'),
			encodeStringField(4, '# Review'),
			encodeStringField(5, 'unused-skill-info'),
		]);
		const wire = decodeSkillInfoResponse(encoded);
		assert.deepStrictEqual(wire, {
			name: 'review',
			description: 'Code review skill',
			content: '# Review',
			source: 'project',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSkillInfoResponse(wire), {
			name: 'review',
			content: '# Review',
			source: 'project',
			enabled: false,
		});
		assert.deepStrictEqual(mapSkillInfoResponse(decodeSkillInfoResponse(new Uint8Array(0))), {
			name: '',
			content: '',
			source: 'unknown',
			enabled: false,
		});
	});

	test('encodeSetSkillEnabledRequest writes skill_name=1 and omits enabled false', () => {
		const disabled = encodeSetSkillEnabledRequest({ skillName: 'review', enabled: false });
		assert.notStrictEqual(disabled[0], 0x7b);
		assert.strictEqual(protoStrings(disabled).get(1), 'review');
		assert.ok(!protoVarints(disabled).has(2));
		const enabled = encodeSetSkillEnabledRequest({ skillName: 'review', enabled: true });
		assert.strictEqual(protoVarints(enabled).get(2), 1);
		assert.strictEqual(encodeSetSkillEnabledRequest({ skillName: '', enabled: false }).length, 0);
	});

	test('decodeSetSkillEnabledResponse maps status=3 OK=1 to mapper ok; 0 omit / NOT_FOUND / FAILED are not ok', () => {
		assert.deepStrictEqual(mapSetSkillEnabledResponse(decodeSetSkillEnabledResponse(encodeInt32Field(3, 1))), { ok: true, reason: undefined });
		assert.deepStrictEqual(mapSetSkillEnabledResponse(decodeSetSkillEnabledResponse(new Uint8Array(0))), { ok: false, reason: undefined });
		assert.deepStrictEqual(mapSetSkillEnabledResponse(decodeSetSkillEnabledResponse(encodeInt32Field(3, 2))), { ok: false, reason: undefined });
		assert.deepStrictEqual(mapSetSkillEnabledResponse(decodeSetSkillEnabledResponse(encodeInt32Field(3, 3))), { ok: false, reason: undefined });
		const unused = Buffer.concat([
			encodeStringField(1, 'review'),
			encodeInt32Field(2, 1),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'unused-status'),
		]);
		assert.deepStrictEqual(mapSetSkillEnabledResponse(decodeSetSkillEnabledResponse(unused)), { ok: true, reason: undefined });
		assert.strictEqual(JSON.stringify(decodeSetSkillEnabledResponse(unused)).includes('unused'), false);
	});

	test('encodeToolInfoRequest writes tool_name=1, not JSON', () => {
		const encoded = encodeToolInfoRequest({ toolName: 'bash' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'bash');
		assert.strictEqual(encodeToolInfoRequest({ toolName: '' }).length, 0);
	});

	test('decodeToolInfoResponse reads 1–7 then mapper; unknown fields unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'bash'),
			encodeStringField(2, 'Run a command'),
			encodeStringField(3, 'shell'),
			encodeStringField(4, '{"type":"object"}'),
			encodeInt32Field(5, 1),
			encodeInt32Field(6, 1),
			encodeStringField(7, 'sh'),
			encodeStringField(7, 'shell'),
			encodeStringField(8, 'unused-tool-info'),
		]);
		const wire = decodeToolInfoResponse(encoded);
		assert.deepStrictEqual(wire, {
			name: 'bash',
			description: 'Run a command',
			category: 'shell',
			input_schema_json: '{"type":"object"}',
			destructive: true,
			requires_permission: true,
			aliases: ['sh', 'shell'],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapToolInfoResponse(wire), {
			name: 'bash',
			description: 'Run a command',
			category: 'shell',
			inputSchemaJson: '{"type":"object"}',
			destructive: true,
			requiresPermission: true,
			aliases: ['sh', 'shell'],
		});
		assert.deepStrictEqual(decodeToolInfoResponse(new Uint8Array(0)), {
			name: '',
			description: undefined,
			category: undefined,
			input_schema_json: undefined,
			destructive: false,
			requires_permission: false,
			aliases: [],
		});
	});

	test('encodeListCommandsRequest is empty proto and still framed for sendMessage', () => {
		const encoded = encodeListCommandsRequest();
		assert.strictEqual(encoded.length, 0);
		assert.strictEqual(encodeEmptyProtoMessage().length, 0);
		assert.notStrictEqual(JSON.stringify({}), Buffer.from(encoded).toString('utf8'));
		assert.notStrictEqual(encoded[0], 0x7b);
		const framed = asUnaryProtoBytes(encoded);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
	});

	test('decodeListCommandsResponse empty payload maps to empty catalog; source varint uses existing mapper', () => {
		assert.deepStrictEqual(decodeListCommandsResponse(new Uint8Array(0)), { commands: [] });
		assert.deepStrictEqual(mapListCommandsResponse(decodeListCommandsResponse(new Uint8Array(0))), { commands: [], total: 0 });
		const command = Buffer.concat([
			encodeStringField(1, 'review'),
			encodeStringField(2, 'Review the diff'),
			encodeInt32Field(3, 1),
			encodeInt32Field(4, 1),
			encodeStringField(5, 'coder'),
			encodeStringField(6, 'fast'),
			encodeInt32Field(7, 1),
			encodeStringField(8, 'project'),
			encodeStringField(9, 'unused-command'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, command),
			encodeInt32Field(2, 1),
			encodeStringField(3, 'unused-list-commands'),
		]);
		const wire = decodeListCommandsResponse(encoded);
		assert.deepStrictEqual(wire, {
			commands: [{
				name: 'review',
				description: 'Review the diff',
				source: 1,
				slash_enabled: true,
				agent: 'coder',
				model: 'fast',
				subtask: true,
				skill_source: 'project',
			}],
			total: 1,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapListCommandsResponse(wire), {
			commands: [{
				name: 'review',
				description: 'Review the diff',
				source: 'SLASH_COMMAND_SOURCE_SKILL',
				slashEnabled: true,
				agent: 'coder',
				model: 'fast',
				subtask: true,
				skillSource: 'project',
			}],
			total: 1,
		});
	});

	test('encodeGetCommandDefRequest writes command_name=1, not JSON', () => {
		const encoded = encodeGetCommandDefRequest({ commandName: 'review' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'review');
		assert.strictEqual(encodeGetCommandDefRequest({ commandName: '' }).length, 0);
	});

	test('decodeGetCommandDefResponse reads 1–11 then mapper; source varint unchanged', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'review'),
			encodeStringField(2, 'Review the diff'),
			encodeInt32Field(3, 4),
			encodeStringField(4, 'do $ARGUMENTS'),
			encodeStringField(5, 'coder'),
			encodeStringField(6, 'fast'),
			encodeInt32Field(7, 1),
			encodeStringField(8, 'mcp-1'),
			encodeStringField(9, 'prompt'),
			encodeStringField(10, 'path'),
			encodeStringField(10, 'mode'),
			encodeStringField(11, 'project'),
			encodeStringField(12, 'unused-command-def'),
		]);
		const wire = decodeGetCommandDefResponse(encoded);
		assert.deepStrictEqual(wire, {
			name: 'review',
			description: 'Review the diff',
			source: 4,
			template: 'do $ARGUMENTS',
			agent: 'coder',
			model: 'fast',
			subtask: true,
			mcp_server_id: 'mcp-1',
			mcp_prompt_name: 'prompt',
			mcp_argument_names: ['path', 'mode'],
			skill_source: 'project',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapGetCommandDefResponse(wire), {
			name: 'review',
			description: 'Review the diff',
			source: 'SLASH_COMMAND_SOURCE_MCP',
			template: 'do $ARGUMENTS',
			agent: 'coder',
			model: 'fast',
			subtask: true,
			mcpServerId: 'mcp-1',
			mcpPromptName: 'prompt',
			mcpArgumentNames: ['path', 'mode'],
			skillSource: 'project',
		});
		assert.deepStrictEqual(mapGetCommandDefResponse(decodeGetCommandDefResponse(new Uint8Array(0))), {
			name: '',
			description: undefined,
			source: '',
			template: '',
			agent: '',
			model: '',
			subtask: false,
			mcpServerId: '',
			mcpPromptName: '',
			mcpArgumentNames: [],
			skillSource: '',
		});
	});

	test('encodeDeleteAgentProfileRequest writes id=1; decode success=1 then mapper', () => {
		const encoded = encodeDeleteAgentProfileRequest('profile-1');
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'profile-1');
		assert.strictEqual(encodeDeleteAgentProfileRequest('').length, 0);
		assert.deepStrictEqual(mapDeleteAgentProfileResponse(decodeDeleteAgentProfileResponse(encodeInt32Field(1, 1))), { ok: true });
		assert.deepStrictEqual(mapDeleteAgentProfileResponse(decodeDeleteAgentProfileResponse(new Uint8Array(0))), { ok: false });
	});

	test('grpcClient snapshots + next known unaries use bytes; listTools/listSkills use bytes; respondQuestion/sendClientToolResponse use bytes', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.join(thisDir, '../../../../../../');
		const clientPath = path.join(repoRoot, 'src/vs/platform/universeAgent/node/grpc/grpcClient.ts');
		const source = fs.readFileSync(clientPath, 'utf8');
		const bytesMethods: Array<{ name: string; encoder: string }> = [
			{ name: 'deleteSession', encoder: 'encodeDeleteSessionRequest' },
			{ name: 'renameSession', encoder: 'encodeRenameSessionRequest' },
			{ name: 'cancelGeneration', encoder: 'encodeCancelGenerationRequest' },
			{ name: 'setPermissionMode', encoder: 'encodeSetPermissionModeRequest' },
			{ name: 'switchModel', encoder: 'encodeSwitchModelRequest' },
			{ name: 'listSnapshots', encoder: 'encodeListSnapshotsRequest' },
			{ name: 'createSnapshot', encoder: 'encodeCreateSnapshotRequest' },
			{ name: 'restoreSnapshot', encoder: 'encodeRestoreSnapshotRequest' },
			{ name: 'deleteSnapshot', encoder: 'encodeDeleteSnapshotRequest' },
			{ name: 'cancelToolCall', encoder: 'encodeCancelToolCallRequest' },
			{ name: 'setSessionGoal', encoder: 'encodeSetSessionGoalRequest' },
			{ name: 'memberStatus', encoder: 'encodeMemberStatusRequest' },
			{ name: 'taskList', encoder: 'encodeTaskListRequest' },
			{ name: 'teamInfo', encoder: 'encodeTeamInfoRequest' },
			{ name: 'fetchToolDetail', encoder: 'encodeFetchToolDetailRequest' },
			{ name: 'cancelSessionGoal', encoder: 'encodeCancelSessionGoalRequest' },
			{ name: 'respondPermission', encoder: 'encodeRespondPermissionRequest' },
			{ name: 'syncPermissionRule', encoder: 'encodeSyncPermissionRuleRequest' },
			{ name: 'promotePermissionRule', encoder: 'encodePromotePermissionRuleRequest' },
			{ name: 'getSessionRules', encoder: 'encodeGetSessionRulesRequest' },
			{ name: 'forkAgent', encoder: 'encodeForkAgentRequest' },
			{ name: 'killAgent', encoder: 'encodeKillAgentRequest' },
			{ name: 'deleteMessage', encoder: 'encodeDeleteMessageRequest' },
			{ name: 'editMessage', encoder: 'encodeEditMessageRequest' },
			{ name: 'readGitSummary', encoder: 'encodeReadGitSummaryRequest' },
			{ name: 'readGitChanges', encoder: 'encodeReadGitChangesRequest' },
			{ name: 'readGitFileDiff', encoder: 'encodeReadGitFileDiffRequest' },
			{ name: 'writeGitStagePaths', encoder: 'encodeWriteGitStagePathsRequest' },
			{ name: 'writeGitCommit', encoder: 'encodeWriteGitCommitRequest' },
			{ name: 'writeGitApplyHunks', encoder: 'encodeWriteGitApplyHunksRequest' },
		];
		for (const { name, encoder } of bytesMethods) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
		}
		const permissionLeftover: Array<{ name: string; decoder: string }> = [
			{ name: 'syncPermissionRule', decoder: 'decodeSyncPermissionRuleResponse' },
			{ name: 'promotePermissionRule', decoder: 'decodePromotePermissionRuleResponse' },
			{ name: 'getSessionRules', decoder: 'decodeGetSessionRulesResponse' },
		];
		for (const { name, decoder } of permissionLeftover) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
		}
		assert.ok(extractAsyncMethod(source, 'getSessionRules').includes('mapGetSessionRulesResponse'));
		const gitLeftover: Array<{ name: string; decoder: string }> = [
			{ name: 'readGitSummary', decoder: 'decodeReadGitSummaryResponse' },
			{ name: 'readGitChanges', decoder: 'decodeReadGitChangesResponse' },
			{ name: 'readGitFileDiff', decoder: 'decodeReadGitFileDiffResponse' },
			{ name: 'writeGitStagePaths', decoder: 'decodeWriteGitWriteResponse' },
			{ name: 'writeGitCommit', decoder: 'decodeWriteGitWriteResponse' },
			{ name: 'writeGitApplyHunks', decoder: 'decodeWriteGitWriteResponse' },
		];
		for (const { name, decoder } of gitLeftover) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
		}
		const queueMethods: Array<{ name: string; encoder: string }> = [
			{ name: 'enqueueQueueItem', encoder: 'encodeEnqueueQueueItemRequest' },
			{ name: 'insertQueueItem', encoder: 'encodeInsertQueueItemRequest' },
			{ name: 'reorderQueue', encoder: 'encodeReorderQueueRequest' },
			{ name: 'deleteQueueItem', encoder: 'encodeQueueItemRefRequest' },
			{ name: 'retryQueueItem', encoder: 'encodeQueueItemRefRequest' },
			{ name: 'retryAllFailed', encoder: 'encodeQueueRefRequest' },
			{ name: 'retryQueueItemUpload', encoder: 'encodeQueueItemRefRequest' },
			{ name: 'pinQueueItem', encoder: 'encodeQueueItemRefRequest' },
			{ name: 'setQueueItemLocked', encoder: 'encodeSetQueueItemLockedRequest' },
			{ name: 'injectQueueItem', encoder: 'encodeQueueItemRefRequest' },
			{ name: 'setQueueItemForkAnchor', encoder: 'encodeSetQueueItemForkAnchorRequest' },
			{ name: 'pauseQueue', encoder: 'encodeQueueRefRequest' },
			{ name: 'resumeQueue', encoder: 'encodeQueueRefRequest' },
			{ name: 'clearQueue', encoder: 'encodeQueueRefRequest' },
			{ name: 'holdQueueItem', encoder: 'encodeHoldQueueItemRequest' },
			{ name: 'releaseQueueItemHold', encoder: 'encodeQueueItemRefRequest' },
			{ name: 'editQueueItem', encoder: 'encodeEditQueueItemRequest' },
		];
		for (const { name, encoder } of queueMethods) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('_queueMutation'), `${name} must go through _queueMutation`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
		}
		const mutation = extractPrivateAsyncMethod(source, '_queueMutation');
		assert.ok(mutation.includes('makeUnaryBytesClient'), '_queueMutation must use makeUnaryBytesClient');
		assert.ok(mutation.includes('decodeQueueMutationResponse'), '_queueMutation must decode QueueMutationResponse');
		assert.ok(!mutation.includes('makeUnaryClient<'), '_queueMutation must not use JSON makeUnaryClient');
		const toolCatalog: Array<{ name: string; encoder: string; decoder: string; mapper: string }> = [
			{ name: 'listTools', encoder: 'encodeListToolsRequest', decoder: 'decodeListToolsResponse', mapper: 'mapListToolsResponse' },
			{ name: 'listSkills', encoder: 'encodeListSkillsRequest', decoder: 'decodeListSkillsResponse', mapper: 'mapListSkillsResponse' },
			{ name: 'getSkillInfo', encoder: 'encodeSkillInfoRequest', decoder: 'decodeSkillInfoResponse', mapper: 'mapSkillInfoResponse' },
			{ name: 'setSkillEnabled', encoder: 'encodeSetSkillEnabledRequest', decoder: 'decodeSetSkillEnabledResponse', mapper: 'mapSetSkillEnabledResponse' },
			{ name: 'getToolInfo', encoder: 'encodeToolInfoRequest', decoder: 'decodeToolInfoResponse', mapper: 'mapToolInfoResponse' },
			{ name: 'listCommands', encoder: 'encodeListCommandsRequest', decoder: 'decodeListCommandsResponse', mapper: 'mapListCommandsResponse' },
			{ name: 'getCommandDef', encoder: 'encodeGetCommandDefRequest', decoder: 'decodeGetCommandDefResponse', mapper: 'mapGetCommandDefResponse' },
			{ name: 'deleteAgentProfile', encoder: 'encodeDeleteAgentProfileRequest', decoder: 'decodeDeleteAgentProfileResponse', mapper: 'mapDeleteAgentProfileResponse' },
		];
		for (const { name, encoder, decoder, mapper } of toolCatalog) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			assert.ok(body.includes(mapper), `${name} must call ${mapper}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
		}
		const saveSkill = extractAsyncMethod(source, 'saveSkillContent');
		assert.ok(saveSkill.includes('makeUnaryClient<'), 'saveSkillContent must stay JSON; J tool_service.proto has no SaveSkillContent RPC');
		assert.ok(!saveSkill.includes('makeUnaryBytesClient'), 'saveSkillContent must not use makeUnaryBytesClient');
		const questionTool: Array<{ name: string; encoder: string; decoder: string }> = [
			{ name: 'respondQuestion', encoder: 'encodeRespondQuestionRequest', decoder: 'decodeRespondQuestionResponse' },
			{ name: 'sendClientToolResponse', encoder: 'encodeSendClientToolResponseRequest', decoder: 'decodeSendClientToolResponseResponse' },
		];
		for (const { name, encoder, decoder } of questionTool) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
		}
	});
});

function protoStrings(encoded: Uint8Array): Map<number, string> {
	const strings = new Map<number, string>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 2) {
			strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return strings;
}

function protoRepeatedStrings(encoded: Uint8Array, fieldNumber: number): string[] {
	const values: string[] = [];
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			values.push(Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return values;
}

function protoVarints(encoded: Uint8Array): Map<number, number> {
	const numbers = new Map<number, number>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 0) {
			numbers.set(field.field, Number(field.varint));
		}
	}
	return numbers;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}

function extractPrivateAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tprivate async ${name}(`);
	assert.ok(start >= 0, `missing private async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}
