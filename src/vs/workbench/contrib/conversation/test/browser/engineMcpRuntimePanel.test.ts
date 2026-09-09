/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentConnectionSnapshot,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { getCatalogFailedCopy } from '../../browser/engineCatalog.js';
import { EngineMcpRuntimePanel } from '../../browser/engineMcpRuntimePanel.js';
import { localize } from '../../../../../nls.js';

const MCP_RUNTIME_TOOLS_FEATURE = localize('ua.engineMcpRuntimeToolsFeature', "MCP server tools");
const RUNTIME_SERVER_ID = 'stdio-runtime';
const LEFTOVER_TOOL_NAME = 'leftover-mcp-tool';

suite('EngineMcpRuntimePanel tools leftover (D67)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		getMcpServerStatuses?: IUniverseAgentConnection['getMcpServerStatuses'];
		getMcpServerTools?: IUniverseAgentConnection['getMcpServerTools'];
	} = {}): IUniverseAgentConnection & { setConnected(value: boolean): void } {
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			mcpRuntime: { support: 'SUPPORTED' },
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
			isAgentTreeFetchFailed: () => false,
			team: {
				memberStatus: async () => [],
				taskList: async () => [],
				teamInfo: async () => undefined,
			},
			connect: async () => ({ methods: [], events: [], sessionToken: 'tok' }),
			connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			confirmPairing: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			cancelPairing: async () => { },
			probeConnectionProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			disconnect: async () => { connected = false; onDidChangeConnection.fire(snapshot()); },
			listSessions: async () => ({ sessions: [] }),
			createSession: async () => ({ sessionId: 's' }),
			deleteSession: async () => { },
			renameSession: async () => ({ ok: false, message: 'stub' }),
			cancelGeneration: async () => ({ ok: false, message: 'stub' }),
			enqueueQueueItem: async () => ({ ok: false, error: 'stub' }),
			pauseQueue: async () => ({ ok: false, error: 'stub' }),
			resumeQueue: async () => ({ ok: false, error: 'stub' }),
			clearQueue: async () => ({ ok: false, error: 'stub' }),
			holdQueueItem: async () => ({ ok: false, error: 'stub' }),
			releaseQueueItemHold: async () => ({ ok: false, error: 'stub' }),
			editQueueItem: async () => ({ ok: false, error: 'stub' }),
			getHistory: async () => ({ envelopes: [] }),
			subscribeSessionEventStream: (
				_sessionId: string,
				_listener: (event: UniverseAgentSessionEvent) => void,
				_onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
			) => ({ dispose: () => { } }),
			chat: async () => { },
			listSkills: async () => ({ skills: [] }),
			setSkillEnabled: async () => ({ ok: true }),
			getSkillInfo: async () => ({ name: '', content: '', source: 'unknown', enabled: false }),
			listAgentProfiles: async () => ({ profiles: [] }),
			saveAgentProfile: async (request) => ({ profile: request.profile }),
			deleteAgentProfile: async () => ({ ok: true }),
			resetAgentProfile: async () => ({ ok: true }),
			listMcpServers: async () => ({ servers: [] }),
			getMcpServerStatuses: options.getMcpServerStatuses ?? (async () => ({
				statuses: [{ serverId: RUNTIME_SERVER_ID, status: 'connected' }],
			})),
			getMcpServerTools: options.getMcpServerTools ?? (async () => ({ tools: [] })),
			listPlugins: async () => ({ plugins: [] }),
			getPluginInfo: async () => ({ summary: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const }, hooks: [] }),
			enablePlugin: async () => ({ plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }),
			reloadPlugin: async () => ({ plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }),
			unloadPlugin: async () => ({ removedHookCount: 0 }),
			scanNewPlugins: async () => ({ newPlugins: [], skippedCount: 0 }),
			toggleMcpServer: async () => ({ ok: true }),
			addMcpServer: async () => ({ ok: true }),
			updateMcpServer: async () => ({ ok: true }),
			removeMcpServer: async () => ({ ok: true }),
			listTools: async () => ({ tools: [] }),
			listModels: async () => ({ models: [] }),
			probeEngine: async () => ({ ok: false as const, reason: 'stub' }),
			setConnected(value: boolean) {
				connected = value;
				onDidChangeConnection.fire(snapshot());
			},
		};
	}

	function mountPanel(connection: IUniverseAgentConnection): EngineMcpRuntimePanel {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const panel = store.add(instantiationService.createInstance(EngineMcpRuntimePanel, parent));
		panel.layout(640, 240);
		return panel;
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	function assertToolsFailed(panel: EngineMcpRuntimePanel, reason: string): void {
		assert.strictEqual(panel.getMode(), 'ready');
		assert.strictEqual(panel.getListEntryCount(), 1);
		assert.strictEqual(panel.getToolsCount(), 0);
		const toolsStatus = panel.getDomNode().querySelector(
			'.engine-catalog-status-widget[data-catalog-mode="failed"]',
		) as HTMLElement | null;
		assert.ok(toolsStatus);
		assert.ok(toolsStatus.textContent?.includes(getCatalogFailedCopy(MCP_RUNTIME_TOOLS_FEATURE, reason)));
		const toolsList = panel.getDomNode().querySelector('.engine-mcp-runtime-tools') as HTMLElement | null;
		assert.ok(toolsList);
		assert.ok(!new RegExp(LEFTOVER_TOOL_NAME, 'i').test(toolsList.textContent ?? ''));
		assert.ok(!new RegExp(LEFTOVER_TOOL_NAME, 'i').test(panel.getDomNode().textContent ?? ''));
	}

	test('getMcpServerTools first throw paints failed toolsStatus without leftover', async () => {
		const connection = createConnectionStub({
			connected: true,
			getMcpServerTools: async () => {
				throw new Error('getMcpServerTools exploded');
			},
		});
		const panel = mountPanel(connection);
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'ready');
		assert.ok(panel.selectServerForTest(RUNTIME_SERVER_ID));
		await flushMicrotasks();

		assertToolsFailed(panel, 'getMcpServerTools exploded');
	});

	test('getMcpServerTools success then throw clears leftover tool name and paints failed', async () => {
		let toolsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			getMcpServerTools: async () => {
				toolsCalls++;
				if (toolsCalls === 1) {
					return { tools: [{ name: LEFTOVER_TOOL_NAME, description: 'keep me' }] };
				}
				throw new Error('getMcpServerTools retry exploded');
			},
		});
		const panel = mountPanel(connection);
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'ready');
		assert.ok(panel.selectServerForTest(RUNTIME_SERVER_ID));
		await flushMicrotasks();

		const toolsList = panel.getDomNode().querySelector('.engine-mcp-runtime-tools') as HTMLElement | null;
		assert.ok(toolsList);
		assert.ok(toolsList.textContent?.includes(LEFTOVER_TOOL_NAME));
		assert.strictEqual(panel.getToolsCount(), 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assertToolsFailed(panel, 'getMcpServerTools retry exploded');
	});
});
