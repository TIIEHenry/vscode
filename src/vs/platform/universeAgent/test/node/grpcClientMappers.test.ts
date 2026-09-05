/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	mapConnectResponse,
	mapListAgentProfilesResponse,
	mapListMcpServersResponse,
	mapListModelsResponse,
	mapListPluginsResponse,
	mapListSkillsResponse,
	mapListToolsResponse,
	mapMemberInfo,
	mapSessionInfoResponse,
	mapTaskInfo,
} from '../../node/grpc/grpcClientMappers.js';

suite('grpcClient mappers', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('mapConnectResponse maps Connect wire JSON', () => {
		const result = mapConnectResponse({
			session_token: 'sess-tok',
			work_dir: '/workspace/project',
			pairing_nonce: 'pair-nonce',
			sas_code: 'ABCD-1234',
			capabilities: {
				methods: ['Connect', 'ListSessions'],
				events: ['SessionEvent', 'ConfigChanged'],
			},
		});

		assert.deepStrictEqual(result, {
			sessionToken: 'sess-tok',
			workDir: '/workspace/project',
			pairingNonce: 'pair-nonce',
			sasCode: 'ABCD-1234',
			methods: ['Connect', 'ListSessions'],
			events: ['SessionEvent', 'ConfigChanged'],
		});
	});

	test('mapSessionInfoResponse maps Session wire JSON', () => {
		const result = mapSessionInfoResponse({
			session_id: 'sess-1',
			root_agent: {
				agent_id: 'agent-root',
				name: 'Root',
				type: 'AGENT_TYPE_LEAD',
				status: 'AGENT_STATUS_IDLE',
				model: 'gpt-test',
				turn_count: 3,
				created_at: 1700000000,
			},
			created_at: 1700000000,
			last_accessed_at: 1700001000,
			provider: 'openai',
			model: 'gpt-test',
		});

		assert.deepStrictEqual(result, {
			sessionId: 'sess-1',
			rootAgent: {
				agentId: 'agent-root',
				name: 'Root',
				type: 'AGENT_TYPE_LEAD',
				status: 'AGENT_STATUS_IDLE',
				model: 'gpt-test',
				turnCount: 3,
				createdAt: 1700000000,
				children: [],
			},
			createdAt: 1700000000,
			lastAccessedAt: 1700001000,
			provider: 'openai',
			model: 'gpt-test',
		});
	});

	test('mapListSkillsResponse maps Skill wire JSON', () => {
		const result = mapListSkillsResponse({
			skills: [{
				name: 'review',
				description: 'Code review skill',
				source: 'project',
				enabled: true,
				slash_enabled: true,
			}],
		});

		assert.deepStrictEqual(result, {
			skills: [{
				name: 'review',
				description: 'Code review skill',
				source: 'project',
				enabled: true,
				slashEnabled: true,
			}],
		});
	});

	test('mapListAgentProfilesResponse maps AgentProfile wire JSON', () => {
		const result = mapListAgentProfilesResponse({
			profiles: [{
				id: 'profile-1',
				name: 'Reviewer',
				source: 'built_in',
				summary: 'Reviews code',
				enabled: true,
				disabled_tools: ['bash'],
				enabled_tools: ['read'],
				whitelist_mode: false,
			}],
		});

		assert.deepStrictEqual(result, {
			profiles: [{
				id: 'profile-1',
				name: 'Reviewer',
				source: 'built_in',
				summary: 'Reviews code',
				enabled: true,
				disabledTools: ['bash'],
				enabledTools: ['read'],
				whitelistMode: false,
			}],
		});
	});

	test('mapListMcpServersResponse maps Mcp wire JSON', () => {
		const result = mapListMcpServersResponse({
			servers: [{
				id: 'mcp-1',
				name: 'filesystem',
				transport: 'stdio',
				origin: 'project',
				enabled: true,
				effective_enabled: true,
				has_project_override: false,
			}],
		});

		assert.deepStrictEqual(result, {
			servers: [{
				id: 'mcp-1',
				name: 'filesystem',
				transport: 'stdio',
				origin: 'project',
				enabled: true,
				effectiveEnabled: true,
				hasProjectOverride: false,
			}],
		});
	});

	test('mapListPluginsResponse maps Plugin wire JSON', () => {
		const result = mapListPluginsResponse({
			plugins: [{
				id: 'plugin-1',
				display_name: 'Hooks',
				version: '1.0.0',
				source: 'bundled',
				hook_count: 2,
				status: 'PLUGIN_ACTIVE',
				loaded_at: 1700000000000,
			}],
		});

		assert.deepStrictEqual(result, {
			plugins: [{
				id: 'plugin-1',
				displayName: 'Hooks',
				version: '1.0.0',
				source: 'bundled',
				hookCount: 2,
				status: 'active',
				loadedAt: 1700000000000,
			}],
		});
	});

	test('mapListToolsResponse maps Tool wire JSON', () => {
		const result = mapListToolsResponse({
			tools: [{
				name: 'read_file',
				description: 'Read a file',
				category: 'filesystem',
				destructive: false,
				requires_permission: true,
			}],
		});

		assert.deepStrictEqual(result, {
			tools: [{
				name: 'read_file',
				description: 'Read a file',
				category: 'filesystem',
				destructive: false,
				requiresPermission: true,
			}],
		});
	});

	test('mapListModelsResponse maps Model wire JSON', () => {
		const result = mapListModelsResponse({
			models: [{
				id: 'fast',
				type: 'chat',
				enabled: true,
				level: 1,
				description: 'Fast model',
				cost: 'low',
				speed: 'fast',
				provider: 'openai',
				model_id: 'gpt-fast',
			}],
		});

		assert.deepStrictEqual(result, {
			models: [{
				id: 'fast',
				type: 'chat',
				enabled: true,
				level: 1,
				description: 'Fast model',
				cost: 'low',
				speed: 'fast',
				provider: 'openai',
				modelId: 'gpt-fast',
			}],
		});
	});

	test('mapMemberInfo and mapTaskInfo map Team wire JSON', () => {
		const member = mapMemberInfo({
			member_name: 'researcher',
			member_agent_id: 'agent-2',
			status: 'running',
			preset: 'default',
			dynamic: 'explore',
			turn_count: 5,
		});
		const task = mapTaskInfo({
			task_id: 'task-1',
			subject: 'Investigate',
			owner: 'lead',
			status: 'open',
			blocked_by: '',
			last_message: 'started',
			description: 'Look into the failure',
		});

		assert.deepStrictEqual(member, {
			memberName: 'researcher',
			memberAgentId: 'agent-2',
			status: 'running',
			preset: 'default',
			dynamic: 'explore',
			turnCount: 5,
		});
		assert.deepStrictEqual(task, {
			taskId: 'task-1',
			subject: 'Investigate',
			owner: 'lead',
			status: 'open',
			blockedBy: '',
			lastMessage: 'started',
			description: 'Look into the failure',
		});
	});

	test('missing optional fields use HEAD defaults (Connect boundary)', () => {
		const result = mapConnectResponse({});

		assert.deepStrictEqual(result, {
			sessionToken: undefined,
			workDir: undefined,
			pairingNonce: undefined,
			sasCode: undefined,
			methods: [],
			events: [],
		});
	});
});
