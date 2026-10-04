/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { PROVIDER_CONFIG_UNSUPPORTED_REASON } from '../../common/universeAgentCapabilities.js';
import { isAdvertisedMethod, probeConversationEntryCapability, probeEngineCapabilities, probeGitWriteCapability, probeListFilesCapability } from '../../node/grpcCapabilityProbe.js';
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
		assert.strictEqual(snapshot.fireTrigger.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.fireTrigger.reason, 'method not advertised');
		assert.strictEqual(snapshot.setTriggerEnabled.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.deleteTrigger.reason, 'method not advertised');
		assert.strictEqual(snapshot.upsertTrigger.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.writeClipboard.reason, 'method not advertised');
		assert.strictEqual(snapshot.readClipboard.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.clearClipboard.reason, 'method not advertised');
		assert.strictEqual(snapshot.readContextVariable.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.restoreSnapshot.reason, 'method not advertised');
		assert.strictEqual(snapshot.deleteSnapshot.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.readGitChanges.reason, 'method not advertised');
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

	test('TriggerService.FireTrigger + probe OK => fireTrigger SUPPORTED', async () => {
		const snapshot = await probeEngineCapabilities({
			methods: ['TriggerService.FireTrigger'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(snapshot.fireTrigger.support, 'SUPPORTED');
		assert.strictEqual(snapshot.setTriggerEnabled.support, 'UNSUPPORTED');
	});

	test('GitService.* + probe OK => readGitChanges SUPPORTED', async () => {
		const snapshot = await probeEngineCapabilities({
			methods: ['GitService.*'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(snapshot.readGitChanges.support, 'SUPPORTED');
		assert.strictEqual(snapshot.readGitChanges.reason, undefined);
	});

	test('git write capability stays off Overview keys and probes each write', async () => {
		const probed: string[] = [];
		const transport = {
			probeRpc: async (_service: string, method: string) => {
				probed.push(method);
				return method === UniverseAgentGrpcServices.Git.WriteGitStagePaths
					? GrpcStatusCode.UNIMPLEMENTED
					: GrpcStatusCode.OK;
			},
		} as unknown as IUniverseAgentGrpcTransport;
		const onlyRead = await probeGitWriteCapability({
			methods: ['GitService.ReadGitChanges'],
			transport,
		});
		assert.strictEqual(onlyRead.writeGitStagePaths, 'UNSUPPORTED');
		assert.strictEqual(onlyRead.writeGitCommit, 'UNSUPPORTED');
		assert.strictEqual(onlyRead.writeGitApplyHunks, 'UNSUPPORTED');
		assert.deepStrictEqual(probed, []);

		const writes = await probeGitWriteCapability({
			methods: ['GitService.*'],
			transport,
		});
		assert.strictEqual(writes.writeGitStagePaths, 'UNSUPPORTED');
		assert.strictEqual(writes.writeGitCommit, 'SUPPORTED');
		assert.strictEqual(writes.writeGitApplyHunks, 'SUPPORTED');
		assert.deepStrictEqual(probed, [
			UniverseAgentGrpcServices.Git.WriteGitStagePaths,
			UniverseAgentGrpcServices.Git.WriteGitCommit,
			UniverseAgentGrpcServices.Git.WriteGitApplyHunks,
		]);
		const overview = await probeEngineCapabilities({
			methods: ['GitService.*'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(Object.hasOwn(overview, 'writeGitStagePaths'), false);
	});

	test('ClipboardService.Write + probe OK => writeClipboard SUPPORTED and read stays unadvertised', async () => {
		const snapshot = await probeEngineCapabilities({
			methods: ['ClipboardService.Write'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(snapshot.writeClipboard.support, 'SUPPORTED');
		assert.strictEqual(snapshot.readClipboard.support, 'UNSUPPORTED');
		assert.strictEqual(snapshot.clearClipboard.support, 'UNSUPPORTED');
	});

	test('conversation entry capability probes only advertised methods', async () => {
		const probed: string[] = [];
		const transport = {
			probeRpc: async (_service: string, method: string) => {
				probed.push(method);
				return method === UniverseAgentGrpcServices.Clipboard.List
					? GrpcStatusCode.UNIMPLEMENTED
					: GrpcStatusCode.OK;
			},
		} as unknown as IUniverseAgentGrpcTransport;
		const hidden = await probeConversationEntryCapability({
			methods: ['ToolService.ListSkills'],
			transport,
		});
		assert.strictEqual(hidden.listClipboard, 'UNSUPPORTED');
		assert.strictEqual(hidden.listTriggers, 'UNSUPPORTED');
		assert.strictEqual(hidden.switchAgent, 'UNSUPPORTED');
		assert.deepStrictEqual(probed, []);

		const listed = await probeConversationEntryCapability({
			methods: ['ClipboardService.List', 'DeviceService.*'],
			transport,
		});
		assert.strictEqual(listed.listClipboard, 'UNSUPPORTED');
		assert.strictEqual(listed.listTriggers, 'UNSUPPORTED');
		assert.strictEqual(listed.listDevices, 'SUPPORTED');
		assert.strictEqual(listed.listPending, 'SUPPORTED');
		assert.strictEqual(listed.pairApprove, 'SUPPORTED');
		assert.strictEqual(listed.pairReject, 'SUPPORTED');
		assert.strictEqual(listed.rotateToken, 'SUPPORTED');
		assert.strictEqual(listed.revoke, 'SUPPORTED');
		assert.strictEqual(listed.switchAgent, 'UNSUPPORTED');
		assert.strictEqual(listed.switchModel, 'UNSUPPORTED');
		assert.deepStrictEqual(probed, [
			UniverseAgentGrpcServices.Clipboard.List,
			UniverseAgentGrpcServices.Device.ListDevices,
			UniverseAgentGrpcServices.Device.ListPending,
			UniverseAgentGrpcServices.Device.PairApprove,
			UniverseAgentGrpcServices.Device.PairReject,
			UniverseAgentGrpcServices.Device.RotateToken,
			UniverseAgentGrpcServices.Device.Revoke,
		]);
		const overview = await probeEngineCapabilities({
			methods: ['ClipboardService.List'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(Object.hasOwn(overview, 'listClipboard'), false);
	});

	test('listFiles capability probes only an advertised ListFiles', async () => {
		const probed: string[] = [];
		const transport = {
			probeRpc: async (_service: string, method: string) => {
				probed.push(method);
				return method === UniverseAgentGrpcServices.File.ListFiles
					? GrpcStatusCode.UNIMPLEMENTED
					: GrpcStatusCode.OK;
			},
		} as unknown as IUniverseAgentGrpcTransport;
		const hidden = await probeListFilesCapability({
			methods: ['GitService.ReadGitChanges'],
			transport,
		});
		assert.strictEqual(hidden, 'UNSUPPORTED');
		assert.deepStrictEqual(probed, []);

		const unimplemented = await probeListFilesCapability({
			methods: ['FileService.ListFiles'],
			transport,
		});
		assert.strictEqual(unimplemented, 'UNSUPPORTED');
		assert.deepStrictEqual(probed, [UniverseAgentGrpcServices.File.ListFiles]);

		const advertised = await probeListFilesCapability({
			methods: ['FileService.*'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(advertised, 'SUPPORTED');

		const other = await probeListFilesCapability({
			methods: ['FileService.ListFiles'],
			transport: probeTransport(GrpcStatusCode.UNAVAILABLE),
		});
		assert.strictEqual(other, 'UNKNOWN');

		const overview = await probeEngineCapabilities({
			methods: ['FileService.*'],
			transport: probeTransport(GrpcStatusCode.OK),
		});
		assert.strictEqual(Object.hasOwn(overview, 'listFiles'), false);
	});

	test('catalog paths used by probe match handshake keys', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Team.MemberStatus, 'MemberStatus');
		assert.strictEqual(UniverseAgentGrpcServices.System.ListHookPoints, 'ListHookPoints');
		assert.strictEqual(UniverseAgentGrpcServices.ProjectRule.List, 'List');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ListProviderStatus, 'ListProviderStatus');
		assert.strictEqual(UniverseAgentGrpcServices.Team.ListTeams, 'ListTeams');
		assert.strictEqual(UniverseAgentGrpcServices.Trigger.FireTrigger, 'FireTrigger');
		assert.strictEqual(UniverseAgentGrpcServices.Trigger.SetTriggerEnabled, 'SetTriggerEnabled');
		assert.strictEqual(UniverseAgentGrpcServices.Trigger.DeleteTrigger, 'DeleteTrigger');
		assert.strictEqual(UniverseAgentGrpcServices.Trigger.UpsertTrigger, 'UpsertTrigger');
		assert.strictEqual(UniverseAgentGrpcServices.Clipboard.Write, 'Write');
		assert.strictEqual(UniverseAgentGrpcServices.Clipboard.Read, 'Read');
		assert.strictEqual(UniverseAgentGrpcServices.Clipboard.Clear, 'Clear');
		assert.strictEqual(UniverseAgentGrpcServices.ContextVariable.Read, 'Read');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.RestoreSnapshot, 'RestoreSnapshot');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.DeleteSnapshot, 'DeleteSnapshot');
		assert.strictEqual(UniverseAgentGrpcServices.Git.ReadGitChanges, 'ReadGitChanges');
	});
});

function probeTransport(status: number): IUniverseAgentGrpcTransport {
	return {
		probeRpc: async () => status,
	} as unknown as IUniverseAgentGrpcTransport;
}
