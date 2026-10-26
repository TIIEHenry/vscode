/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { decodeListAgentProfilesResponse, decodeProviderStatus, decodeResetAgentProfileResponse, decodeSaveAgentProfileResponse, decodeSessionInfoResponse, encodeSaveAgentProfileRequest, encodeUpsertProviderCredentialsRequest } from '../../node/grpc/grpcCatalogUnaryWire.js';
import { mapAgentProfileDetail, mapAgentProfileSummary, mapProviderStatus } from '../../node/grpc/grpcClientMappersCatalog.js';
import { mapSessionInfoResponse } from '../../node/grpc/grpcClientMappersSession.js';
import { decodeSetClientToolProfileResponse, encodeSetClientToolProfileRequest } from '../../node/grpc/grpcConfigPermissionUnaryWire.js';
import { allLengthDelimited, encodeInt32Field, encodeMessageField, encodeStringField, lastBytes, lastString, lastVarint, readProtoFields } from '../../node/grpc/grpcProtoCodec.js';
import { decodeForkAgentResponse, encodeCreateSessionRequest, encodeForkAgentRequest } from '../../node/grpc/grpcSessionAttachWire.js';
import { encodeRegisterSessionEngineTriggerRequest } from '../../node/grpc/grpcTriggerUnaryWire.js';
import type { UniverseAgentSetClientToolProfileRequest } from '../../common/universeAgentTypes.js';

suite('UniverseAgent protocol consumption', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('client tool profiles use exact enum values and never default an invalid value to ALL', () => {
		for (const [profile, number] of [['CLIENT_TOOL_PROFILE_ALL', 1], ['CLIENT_TOOL_PROFILE_READ_ONLY', 2], ['CLIENT_TOOL_PROFILE_NONE', 3]] as const) {
			const fields = readProtoFields(encodeSetClientToolProfileRequest({ sessionId: 's', profile }));
			assert.strictEqual(lastString(fields, 1), 's');
			assert.strictEqual(lastVarint(fields, 2), BigInt(number));
		}
		assert.throws(() => encodeSetClientToolProfileRequest({ sessionId: 's', profile: 'CLIENT_TOOL_PROFILE_UNSPECIFIED' } as unknown as UniverseAgentSetClientToolProfileRequest), /Invalid client tool profile/);
		assert.deepStrictEqual(decodeSetClientToolProfileResponse(encodeStringField(2, 'Session missing')), { ok: false, error: 'Session missing' });
	});

	test('session trigger registration preserves repeated paths and optional dedupe presence', () => {
		const request = { sessionId: 's', name: 'Watch', type: 'file_changed' as const, promptTemplate: 'Changed {{path}}', watchPaths: ['src', 'docs'], dedupeKeyField: '' };
		const fields = readProtoFields(encodeRegisterSessionEngineTriggerRequest(request));
		assert.strictEqual(lastString(fields, 1), 's');
		assert.strictEqual(lastString(fields, 2), 'Watch');
		assert.strictEqual(lastString(fields, 3), 'file_changed');
		assert.strictEqual(lastString(fields, 4), 'Changed {{path}}');
		assert.deepStrictEqual(allLengthDelimited(fields, 5).map(value => Buffer.from(value).toString('utf8')), ['src', 'docs']);
		assert.strictEqual(lastString(fields, 6), '');
		const webhook = readProtoFields(encodeRegisterSessionEngineTriggerRequest({ ...request, type: 'webhook', watchPaths: [], dedupeKeyField: undefined }));
		assert.strictEqual(lastString(webhook, 6), undefined);
		assert.deepStrictEqual(allLengthDelimited(webhook, 5), []);
	});

	test('Create forwards explicit engine context without treating title as system prompt', () => {
		const request = {
			title: 'Local title', clientSessionId: 'local', model: 'model',
			systemPrompt: 'System', provider: 'provider', promptLocale: 'zh-CN', workDir: '/engine/work',
			clientHost: { os: 'linux', version: '26', versionId: '', kernel: '6.8', arch: 'x64', shell: '/bin/bash', locale: 'zh-CN', executionClient: 'vscode' },
		};
		const fields = readProtoFields(encodeCreateSessionRequest(request));
		for (const [tag, value] of [[1, 'System'], [2, 'provider'], [3, 'model'], [4, 'local'], [5, 'zh-CN'], [7, '/engine/work']] as const) {
			assert.strictEqual(lastString(fields, tag), value);
		}
		const host = lastBytes(fields, 6);
		assert.ok(host);
		const hostFields = readProtoFields(host);
		for (const [tag, value] of [[1, 'linux'], [2, '26'], [3, ''], [4, '6.8'], [5, 'x64'], [6, '/bin/bash'], [7, 'zh-CN'], [8, 'vscode']] as const) {
			assert.strictEqual(lastString(hostFields, tag), value);
		}
		const minimal = readProtoFields(encodeCreateSessionRequest({ title: 'Local', clientSessionId: 'id' }));
		assert.strictEqual(lastString(minimal, 1), undefined);
		assert.strictEqual(lastBytes(minimal, 6), undefined);
		assert.strictEqual(lastString(minimal, 7), undefined);
	});

	test('Info maps engine title alongside workDir', () => {
		const response = mapSessionInfoResponse(decodeSessionInfoResponse(Buffer.concat([
			encodeStringField(1, 's'), encodeStringField(7, '/engine'), encodeStringField(8, 'Title'),
		])));
		assert.strictEqual(Reflect.get(response, 'title'), 'Title');
		assert.strictEqual(response.workDir, '/engine');
	});

	test('Fork forwards stable turn anchor and preserves engine rejection message', () => {
		const request = { sessionId: 's', anchorTurnId: 'turn-uuid' };
		const fields = readProtoFields(encodeForkAgentRequest(request));
		assert.strictEqual(lastString(fields, 7), 'turn-uuid');
		assert.strictEqual(lastString(fields, 2), 'root');
		assert.deepStrictEqual(decodeForkAgentResponse(encodeStringField(4, 'Anchor missing')), { ok: false, message: 'Anchor missing' });
	});

	test('Provider discovery opt-in and outcome survive wire and mapper', () => {
		const request = { providerId: 'p', refreshModels: true };
		assert.strictEqual(lastVarint(readProtoFields(encodeUpsertProviderCredentialsRequest(request)), 5), 1n);
		assert.strictEqual(lastVarint(readProtoFields(encodeUpsertProviderCredentialsRequest({ providerId: 'p' })), 5), undefined);
		const result = mapProviderStatus(decodeProviderStatus(Buffer.concat([
			encodeStringField(1, 'p'), encodeInt32Field(8, 4), encodeStringField(9, 'Discovery failed'),
		])));
		assert.strictEqual(Reflect.get(result, 'discoveredModels'), 4);
		assert.strictEqual(Reflect.get(result, 'modelSyncError'), 'Discovery failed');
	});

	for (const maxRewinds of [undefined, 0, 5]) {
		test(`Profile list, save and reset retain optional maxRewinds=${maxRewinds}`, () => {
			// Explicit wire bytes distinguish absent from present zero (tag 20, wire type 0).
			const profileBytes = Buffer.concat([
				encodeStringField(1, 'p'), encodeStringField(2, 'Profile'),
				maxRewinds === undefined ? Buffer.alloc(0) : Buffer.from([0xa0, 0x01, maxRewinds]),
			]);
			const listed = decodeListAgentProfilesResponse(encodeMessageField(1, profileBytes)).profiles![0];
			const summary = mapAgentProfileSummary(listed);
			const detail = mapAgentProfileDetail(listed);
			assert.strictEqual(Reflect.get(summary, 'maxRewinds'), maxRewinds);
			assert.strictEqual(Reflect.get(detail, 'maxRewinds'), maxRewinds);
			const saved = encodeSaveAgentProfileRequest({ ...detail, systemPrompt: 'Edited' });
			const nested = lastBytes(readProtoFields(saved), 1)!;
			assert.strictEqual(lastVarint(readProtoFields(nested), 20), maxRewinds === undefined ? undefined : BigInt(maxRewinds));
			const saveResult = mapAgentProfileDetail(decodeSaveAgentProfileResponse(saved).profile!);
			assert.strictEqual(Reflect.get(saveResult, 'maxRewinds'), maxRewinds);
			const reset = decodeResetAgentProfileResponse(encodeMessageField(2, profileBytes));
			assert.strictEqual(Reflect.get(mapAgentProfileDetail(reset.profile!), 'maxRewinds'), maxRewinds);
		});
	}
});
