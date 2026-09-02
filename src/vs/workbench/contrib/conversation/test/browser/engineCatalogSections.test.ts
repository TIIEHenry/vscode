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
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { EngineAgentsSection } from '../../browser/engineAgentsSection.js';
import { EngineMcpSection } from '../../browser/engineMcpSection.js';
import { EngineToolsSection } from '../../browser/engineToolsSection.js';
import { getCatalogUnsupportedCopy } from '../../browser/engineCatalog.js';
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
			listMcpServers: options.listMcpServers ?? (async () => ({
				servers: [{ id: 'mcp-1', name: 'Demo MCP', transport: 'stdio' as const, origin: 'global' as const, enabled: true }],
			})),
			toggleMcpServer: async () => ({ ok: true }),
			listTools: options.listTools ?? (async () => ({
				tools: [{ name: 'read_file', description: 'Read a file', category: 'fs' }],
			})),
			setConnected(value: boolean) {
				connected = value;
				onDidChangeConnection.fire(snapshot());
			},
		};
	}

	function mountSection<T extends EngineAgentsSection | EngineMcpSection | EngineToolsSection>(
		ctor: new (parent: HTMLElement, ...args: never[]) => T,
		connection: IUniverseAgentConnection,
	): T {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(ctor, parent));
		section.layout(640, 200);
		return section;
	}

	for (const [label, Ctor, capabilityKey, featureLabel] of [
		['Agents', EngineAgentsSection, 'agentProfiles', AGENTS_FEATURE],
		['MCP', EngineMcpSection, 'mcp', MCP_FEATURE],
		['Tools', EngineToolsSection, 'tools', TOOLS_FEATURE],
	] as const) {
		test(`${label}: disconnected hides section (§4 honest empty)`, async () => {
			const connection = createConnectionStub({
				connected: false,
				capabilities: { [capabilityKey]: { support: 'SUPPORTED' } },
			});
			const section = mountSection(Ctor, connection);
			await new Promise(resolve => setTimeout(resolve, 0));

			assert.strictEqual(section.getMode(), 'disconnected');
			assert.strictEqual(section.getDomNode().style.display, 'none');
			assert.strictEqual(section.getListEntryCount(), 0);
			section.getDomNode().parentElement?.remove();
		});

		test(`${label}: UNSUPPORTED shows honest message without fake rows`, async () => {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { [capabilityKey]: { support: 'UNSUPPORTED', reason: 'UNIMPLEMENTED' } },
			});
			const section = mountSection(Ctor, connection);
			await new Promise(resolve => setTimeout(resolve, 0));

			assert.strictEqual(section.getMode(), 'unsupported');
			assert.strictEqual(section.getListEntryCount(), 0);
			const status = section.getDomNode().querySelector('.engine-catalog-status') as HTMLElement;
			assert.ok(status);
			assert.ok(status.textContent?.includes(getCatalogUnsupportedCopy(featureLabel, 'UNIMPLEMENTED')));
			const combined = section.getDomNode().parentElement?.textContent ?? '';
			assert.ok(!/copilot/i.test(combined));
			assert.ok(!/\.vscode\/mcp\.json/i.test(combined));
			section.getDomNode().parentElement?.remove();
		});

		test(`${label}: SUPPORTED loads RPC catalog`, async () => {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { [capabilityKey]: { support: 'SUPPORTED' } },
			});
			const section = mountSection(Ctor, connection);
			await new Promise(resolve => setTimeout(resolve, 0));

			assert.strictEqual(section.getMode(), 'supported');
			assert.ok(section.getListEntryCount() > 0);
			section.getDomNode().parentElement?.remove();
		});
	}
});
