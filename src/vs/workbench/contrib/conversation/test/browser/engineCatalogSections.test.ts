/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/node/grpcCapabilityProbe.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentConnectionSnapshot,
	UniverseAgentCapabilitySnapshot,
	UniverseAgentListAgentProfilesResult,
	UniverseAgentListMcpServersResult,
	UniverseAgentListToolsResult,
	UniverseAgentSaveAgentProfileRequest,
	UniverseAgentSaveAgentProfileResult,
	UniverseAgentDeleteAgentProfileRequest,
	UniverseAgentResetAgentProfileRequest,
	UniverseAgentAddMcpServerRequest,
	UniverseAgentUpdateMcpServerRequest,
	UniverseAgentRemoveMcpServerRequest,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { EngineAgentsSection } from '../../browser/engineAgentsSection.js';
import { EngineMcpSection } from '../../browser/engineMcpSection.js';
import { EngineToolsSection } from '../../browser/engineToolsSection.js';
import { canPerformCatalogWrite, getCatalogUnsupportedCopy } from '../../browser/engineCatalog.js';
import { localize } from '../../../../../nls.js';

const AGENTS_FEATURE = localize('ua.engineAgentsFeatureLabel', "agent profiles");
const MCP_FEATURE = localize('ua.engineMcpFeatureLabel', "MCP server definitions");
const TOOLS_FEATURE = localize('ua.engineToolsFeatureLabel', "engine tools");

suite('Engine catalog sections (Agents / MCP / Tools)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		capabilities?: Partial<UniverseAgentCapabilitySnapshot>;
		listAgentProfiles?: () => Promise<UniverseAgentListAgentProfilesResult>;
		listMcpServers?: () => Promise<UniverseAgentListMcpServersResult>;
		listTools?: () => Promise<UniverseAgentListToolsResult>;
		saveAgentProfile?: (request: UniverseAgentSaveAgentProfileRequest) => Promise<UniverseAgentSaveAgentProfileResult>;
		deleteAgentProfile?: (request: UniverseAgentDeleteAgentProfileRequest) => Promise<{ ok: boolean }>;
		resetAgentProfile?: (request: UniverseAgentResetAgentProfileRequest) => Promise<{ ok: boolean }>;
		addMcpServer?: (request: UniverseAgentAddMcpServerRequest) => Promise<{ ok: boolean }>;
		updateMcpServer?: (request: UniverseAgentUpdateMcpServerRequest) => Promise<{ ok: boolean }>;
		removeMcpServer?: (request: UniverseAgentRemoveMcpServerRequest) => Promise<{ ok: boolean }>;
	} = {}): IUniverseAgentConnection & { setConnected(value: boolean): void } {
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			...options.capabilities,
		};
		let connected = options.connected ?? false;
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();

		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sessionToken: connected ? 'tok' : undefined,
			pairingPending: false,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities,
		});

		return {
			_serviceBrand: undefined,
			isEngineConnected: () => connected,
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getTransportState: () => (connected ? 'ok' : 'idle'),
			getConnectionSnapshot: snapshot,
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: onDidChangeConnection.event,
			onDidFileMutation: Event.None,
			onDidTurnSettle: Event.None,
			onDidChangeTeamRuntime: Event.None,
			requestAgentTreeRefresh: () => { },
			getNavigatorCapability: () => 'UNKNOWN' as const,
			team: {
				memberStatus: async () => [],
				taskList: async () => [],
				teamInfo: async () => undefined,
			},
			connect: async () => ({ methods: [], events: [], sessionToken: 'tok' }),
			connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			disconnect: async () => { connected = false; onDidChangeConnection.fire(snapshot()); },
			listSessions: async () => ({ sessions: [] }),
			createSession: async () => ({ sessionId: 's' }),
			deleteSession: async () => { },
			getHistory: async () => ({ envelopes: [] }),
			subscribeSessionEventStream: () => ({ dispose: () => { } }),
			chat: async () => { },
			listSkills: async () => ({ skills: [] }),
			setSkillEnabled: async () => ({ ok: true }),
			getSkillInfo: async () => ({ name: '', content: '', source: 'unknown', enabled: false }),
			listAgentProfiles: options.listAgentProfiles ?? (async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }],
			})),
			saveAgentProfile: options.saveAgentProfile ?? (async (request) => ({ profile: request.profile })),
			deleteAgentProfile: options.deleteAgentProfile ?? (async () => ({ ok: true })),
			resetAgentProfile: options.resetAgentProfile ?? (async () => ({ ok: true })),
			listMcpServers: options.listMcpServers ?? (async () => ({ servers: [] })),
			toggleMcpServer: async () => ({ ok: true }),
			addMcpServer: options.addMcpServer ?? (async () => ({ ok: true })),
			updateMcpServer: options.updateMcpServer ?? (async () => ({ ok: true })),
			removeMcpServer: options.removeMcpServer ?? (async () => ({ ok: true })),
			listTools: options.listTools ?? (async () => ({ tools: [] })),
			setConnected(value: boolean) {
				connected = value;
				onDidChangeConnection.fire(snapshot());
			},
		};
	}

	function mountAgentsSection(connection: IUniverseAgentConnection): EngineAgentsSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineAgentsSection, parent));
		section.layout(640, 120);
		return section;
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	test('canPerformCatalogWrite is false when disconnected or unsupported', () => {
		assert.strictEqual(canPerformCatalogWrite('disconnected'), false);
		assert.strictEqual(canPerformCatalogWrite('unsupported'), false);
		assert.strictEqual(canPerformCatalogWrite('unknown'), false);
		assert.strictEqual(canPerformCatalogWrite('supported'), true);
	});

	for (const [label, capabilityKey, featureLabel] of [
		['Agents', 'agentProfiles', AGENTS_FEATURE],
		['MCP', 'mcp', MCP_FEATURE],
		['Tools', 'tools', TOOLS_FEATURE],
	] as const) {
		test(`${label}: disconnected hides section (§4 honest empty)`, async () => {
			const connection = createConnectionStub({
				connected: false,
				capabilities: { [capabilityKey]: { support: 'SUPPORTED' } },
			});
			const Ctor = label === 'Agents' ? EngineAgentsSection : label === 'MCP' ? EngineMcpSection : EngineToolsSection;
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			const instantiationService = workbenchInstantiationService(undefined, store);
			instantiationService.stub(IUniverseAgentConnection, connection);
			const section = store.add(instantiationService.createInstance(Ctor, parent));
			section.layout(640, 0);
			await flushMicrotasks();

			assert.strictEqual(section.getMode(), 'disconnected');
			assert.strictEqual(section.getDomNode().style.display, 'none');
			assert.strictEqual(section.getListEntryCount(), 0);
			assert.strictEqual(section.canWrite(), false);
		});

		test(`${label}: UNSUPPORTED shows honest message without fake rows`, async () => {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { [capabilityKey]: { support: 'UNSUPPORTED', reason: 'UNIMPLEMENTED' } },
			});
			const Ctor = label === 'Agents' ? EngineAgentsSection : label === 'MCP' ? EngineMcpSection : EngineToolsSection;
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			const instantiationService = workbenchInstantiationService(undefined, store);
			instantiationService.stub(IUniverseAgentConnection, connection);
			const section = store.add(instantiationService.createInstance(Ctor, parent));
			section.layout(640, 0);
			await flushMicrotasks();

			assert.strictEqual(section.getMode(), 'unsupported');
			assert.strictEqual(section.getListEntryCount(), 0);
			assert.strictEqual(section.canWrite(), false);
			const status = section.getDomNode().querySelector('.engine-catalog-status') as HTMLElement;
			assert.ok(status);
			assert.ok(status.textContent?.includes(getCatalogUnsupportedCopy(featureLabel, 'UNIMPLEMENTED')));
			const combined = section.getDomNode().parentElement?.textContent ?? '';
			assert.ok(!/copilot/i.test(combined));
			assert.ok(!/\.vscode\/mcp\.json/i.test(combined));
		});
	}

	test('Agents: SUPPORTED loads RPC catalog', async () => {
		let listCalled = false;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listCalled = true;
				return { profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }] };
			},
		});
		const section = mountAgentsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'supported');
		assert.ok(listCalled);
		assert.ok(section.getListEntryCount() > 0);
		assert.strictEqual(section.canWrite(), true);
		assert.strictEqual(section.isWriteToolbarVisible(), true);
	});

	test('Agents: SUPPORTED createProfile calls saveAgentProfile RPC', async () => {
		let saveCalled = false;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			saveAgentProfile: async (request) => {
				saveCalled = true;
				return { profile: request.profile };
			},
		});
		const section = mountAgentsSection(connection);
		await flushMicrotasks();

		const ok = await section.createProfile({ id: 'new-agent', name: 'New', source: 'user' });
		assert.ok(saveCalled);
		assert.strictEqual(ok, true);
	});

	test('Agents: disconnected createProfile is no-op', async () => {
		let saveCalled = false;
		const connection = createConnectionStub({
			connected: false,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			saveAgentProfile: async () => {
				saveCalled = true;
				return { profile: { id: 'x', name: 'x' } };
			},
		});
		const section = mountAgentsSection(connection);
		await flushMicrotasks();

		const ok = await section.createProfile({ id: 'new-agent', name: 'New', source: 'user' });
		assert.strictEqual(saveCalled, false);
		assert.strictEqual(ok, false);
	});

	test('MCP: write RPC stubs reachable when connected (no SetToolEnabled)', async () => {
		let addCalled = false;
		let removeCalled = false;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			addMcpServer: async () => { addCalled = true; return { ok: true }; },
			removeMcpServer: async () => { removeCalled = true; return { ok: true }; },
		});
		await connection.addMcpServer({
			config: { name: 'srv', transport: 'stdio', command: 'echo' },
			scope: 'global',
		});
		await connection.removeMcpServer({ serverId: 'srv', scope: 'global' });
		assert.ok(addCalled);
		assert.ok(removeCalled);
	});

	test('MCP: disconnected addMcpServer not invoked from stub when engine off', async () => {
		let addCalled = false;
		const connection = createConnectionStub({
			connected: false,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			addMcpServer: async () => { addCalled = true; return { ok: true }; },
		});
		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(addCalled, false);
	});

	test('Tools: toggleTool via saveAgentProfile when section mounted with empty catalog', async () => {
		let saveCalled = false;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const, disabledTools: [] }],
			}),
			listTools: async () => ({ tools: [] }),
			saveAgentProfile: async (request) => {
				saveCalled = true;
				return { profile: request.profile };
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineToolsSection, parent));
		section.layout(640, 0);
		await flushMicrotasks();

		assert.strictEqual(section.canWrite(), true);
		const ok = await section.toggleTool({ name: 'read_file' }, false);
		assert.ok(saveCalled);
		assert.strictEqual(ok, true);
	});

	test('Tools: disconnected saveAgentProfile not called from section', async () => {
		let saveCalled = false;
		const connection = createConnectionStub({
			connected: false,
			capabilities: { tools: { support: 'SUPPORTED' } },
			saveAgentProfile: async () => {
				saveCalled = true;
				return { profile: { id: 'demo', name: 'Demo' } };
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineToolsSection, parent));
		section.layout(640, 0);
		await flushMicrotasks();

		const ok = await section.toggleTool({ name: 'read_file' }, false);
		assert.strictEqual(saveCalled, false);
		assert.strictEqual(ok, false);
	});
});
