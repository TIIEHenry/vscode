/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { PROVIDER_CONFIG_UNSUPPORTED_REASON } from '../../common/universeAgentCapabilities.js';
import { isAdvertisedMethod, probeEngineCapabilities } from '../../node/grpcCapabilityProbe.js';
import { GrpcStatusCode, IUniverseAgentGrpcTransport, UniverseAgentGrpcServices } from '../../node/grpc/grpcTransport.js';

suite('grpc capability probe advertisement', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('FooService.* wildcard counts as advertised for that service method', () => {
		assert.strictEqual(isAdvertisedMethod(['TeamService.*'], 'TeamService.MemberStatus'), true);
		assert.strictEqual(isAdvertisedMethod(['SystemService.*'], 'SystemService.ListHookPoints'), true);
		assert.strictEqual(isAdvertisedMethod(['ProjectRuleService.*'], 'ProjectRuleService.List'), true);
		assert.strictEqual(isAdvertisedMethod(['TeamService.*'], 'AgentService.Tree'), false);
		assert.strictEqual(isAdvertisedMethod([], 'TeamService.MemberStatus'), false);
	});

	test('wildcard TeamService.* + probe OK => team SUPPORTED', async () => {
		const snapshot = await probeEngineCapabilities({
			methods: ['TeamService.*'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(snapshot.team.support, 'SUPPORTED');
	});

	test('no advertisement => team / rules / hooks / provider UNSUPPORTED', async () => {
		const snapshot = await probeEngineCapabilities({
			methods: [],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(snapshot.team.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.team.reason, 'method not advertised');
		assert.strictEqual(snapshot.globalRules.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.globalRules.reason, 'method not advertised');
		assert.strictEqual(snapshot.projectRules.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.projectRules.reason, 'method not advertised');
		assert.strictEqual(snapshot.hooksMetadata.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.hooksMetadata.reason, 'method not advertised');
		assert.strictEqual(snapshot.providerConfig.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.providerConfig.reason, PROVIDER_CONFIG_UNSUPPORTED_REASON);
	});

	test('ProjectRuleService.* + probe OK => globalRules and projectRules SUPPORTED', async () => {
		const snapshot = await probeEngineCapabilities({
			methods: ['ProjectRuleService.*'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(snapshot.globalRules.support, 'SUPPORTED');
		assert.strictEqual(snapshot.projectRules.support, 'SUPPORTED');
		assert.strictEqual(snapshot.globalRules.reason, undefined);
	});

	test('SystemService.* + probe OK => hooksMetadata SUPPORTED', async () => {
		const snapshot = await probeEngineCapabilities({
			methods: ['SystemService.*'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(snapshot.hooksMetadata.support, 'SUPPORTED');
		assert.strictEqual(snapshot.hooksMetadata.reason, undefined);
	});

	test('AgentService.ListProviderStatus + probe OK => providerConfig SUPPORTED', async () => {
		const snapshot = await probeEngineCapabilities({
			methods: ['AgentService.ListProviderStatus'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(snapshot.providerConfig.support, 'SUPPORTED');
		assert.notStrictEqual(snapshot.providerConfig.reason, PROVIDER_CONFIG_UNSUPPORTED_REASON);
	});

	test('advertised provider + UNIMPLEMENTED stays UNSUPPORTED', async () => {
		const snapshot = await probeEngineCapabilities({
			methods: ['AgentService.ListProviderStatus'],
			transport: probeTransport(GrpcStatusCode.UNIMPLEMENTED),
		});
		assert.strictEqual(snapshot.providerConfig.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.providerConfig.reason, 'UNIMPLEMENTED');
	});

	test('catalog paths used by probe match handshake keys', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Team.MemberStatus, 'MemberStatus');
		assert.strictEqual(UniverseAgentGrpcServices.System.ListHookPoints, 'ListHookPoints');
		assert.strictEqual(UniverseAgentGrpcServices.ProjectRule.List, 'List');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ListProviderStatus, 'ListProviderStatus');
		assert.strictEqual(UniverseAgentGrpcServices.Team.ListTeams, 'ListTeams');
	});
});

function probeTransport(status: number): IUniverseAgentGrpcTransport {
	return {
		probeRpc: async () => status,
	} as unknown as IUniverseAgentGrpcTransport;
}
