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
import { getCatalogFailedCopy, getCatalogListLoadingCopy, getCatalogUnknownCopy } from '../../browser/engineCatalog.js';
import { EngineMcpRuntimePanel } from '../../browser/engineMcpRuntimePanel.js';
import { localize } from '../../../../../nls.js';

const MCP_RUNTIME_FEATURE = localize('ua.engineMcpRuntimeFeatureLabel', "MCP server runtime");
const MCP_RUNTIME_TOOLS_FEATURE = localize('ua.engineMcpRuntimeToolsFeature', "MCP server tools");
const MCP_RUNTIME_EMPTY = localize('ua.engineMcpRuntimeEmpty', "No MCP servers in runtime.");
const MCP_RUNTIME_TOOLS_EMPTY = localize('ua.engineMcpRuntimeToolsEmpty', "No tools on this MCP server.");
const RUNTIME_SERVER_ID = 'stdio-runtime';
const LEFTOVER_RUNTIME_SERVER_ID = 'leftover-runtime-server';
const LEFTOVER_TOOL_NAME = 'leftover-mcp-tool';

suite('EngineMcpRuntimePanel leftover (D227 / D238 / D256 / D263)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		mcpRuntimeSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		getMcpServerStatuses?: IUniverseAgentConnection['getMcpServerStatuses'];
		getMcpServerTools?: IUniverseAgentConnection['getMcpServerTools'];
	} = {}): IUniverseAgentConnection & {
		setConnected(value: boolean): void;
		setMcpRuntimeSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
	} {
		const mcpRuntimeCapability: { support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN' } = {
			support: options.mcpRuntimeSupport ?? 'SUPPORTED',
		};
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			mcpRuntime: mcpRuntimeCapability,
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
			setMcpRuntimeSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') {
				mcpRuntimeCapability.support = support;
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

	function getToolsList(panel: EngineMcpRuntimePanel): HTMLElement | null {
		return panel.getDomNode().querySelector('.engine-mcp-runtime-tools') as HTMLElement | null;
	}

	function getToolsRowCount(panel: EngineMcpRuntimePanel): number {
		return panel.getDomNode().querySelectorAll('.engine-mcp-runtime-tools .engine-catalog-row').length;
	}

	function assertToolsFailedHonesty(panel: EngineMcpRuntimePanel, reason: string, expectedRows: number): void {
		assert.strictEqual(panel.getMode(), 'ready');
		assert.strictEqual(panel.getListEntryCount(), 1);
		assert.strictEqual(panel.getToolsCount(), expectedRows);
		const toolsStatus = panel.getDomNode().querySelector(
			'.engine-catalog-status-widget[data-catalog-mode="failed"]',
		) as HTMLElement | null;
		assert.ok(toolsStatus);
		assert.ok(toolsStatus.textContent?.includes(getCatalogFailedCopy(MCP_RUNTIME_TOOLS_FEATURE, reason)));
		const toolsList = getToolsList(panel);
		assert.ok(toolsList);
		assert.strictEqual(getToolsRowCount(panel), expectedRows);
		if (expectedRows === 0) {
			assert.strictEqual(toolsList.style.display, 'none');
		} else {
			assert.notStrictEqual(toolsList.style.display, 'none');
		}
		assert.ok(!(panel.getDomNode().textContent ?? '').includes(MCP_RUNTIME_TOOLS_EMPTY));
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

		assertToolsFailedHonesty(panel, 'getMcpServerTools exploded', 0);
	});

	test('getMcpServerTools success then throw keeps leftover tool rows and paints failed', async () => {
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

		const toolsList = getToolsList(panel);
		assert.ok(toolsList);
		assert.strictEqual(panel.getToolsCount(), 1);
		assert.strictEqual(getToolsRowCount(panel), 1);
		assert.notStrictEqual(toolsList.style.display, 'none');
		assert.ok(!(panel.getDomNode().textContent ?? '').includes(MCP_RUNTIME_TOOLS_EMPTY));

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(toolsCalls, 2);
		assertToolsFailedHonesty(panel, 'getMcpServerTools retry exploded', 1);
	});

	test('getMcpServerStatuses first throw is failed with no leftover rows', async () => {
		const connection = createConnectionStub({
			connected: true,
			getMcpServerStatuses: async () => {
				throw new Error('getMcpServerStatuses exploded');
			},
		});
		const panel = mountPanel(connection);
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'failed');
		assert.strictEqual(panel.getListEntryCount(), 0);
		assert.strictEqual(panel.selectServerForTest(RUNTIME_SERVER_ID), false);
		const status = panel.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(MCP_RUNTIME_FEATURE, 'getMcpServerStatuses exploded')));
		assert.ok(!(panel.getDomNode().textContent ?? '').includes(MCP_RUNTIME_EMPTY));
	});

	test('getMcpServerStatuses success then throw keeps leftover rows and paints failed', async () => {
		let statusCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			getMcpServerStatuses: async () => {
				statusCalls++;
				if (statusCalls === 1) {
					return { statuses: [{ serverId: LEFTOVER_RUNTIME_SERVER_ID, status: 'connected' }] };
				}
				throw new Error('getMcpServerStatuses retry exploded');
			},
		});
		const panel = mountPanel(connection);
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'ready');
		assert.strictEqual(panel.getListEntryCount(), 1);
		assert.ok(panel.selectServerForTest(LEFTOVER_RUNTIME_SERVER_ID));
		assert.strictEqual(statusCalls, 1);
		assert.ok(!(panel.getDomNode().textContent ?? '').includes(MCP_RUNTIME_EMPTY));

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(statusCalls, 2);
		assert.strictEqual(panel.getMode(), 'failed');
		assert.strictEqual(panel.getListEntryCount(), 1);
		assert.ok(panel.selectServerForTest(LEFTOVER_RUNTIME_SERVER_ID));
		const status = panel.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(MCP_RUNTIME_FEATURE, 'getMcpServerStatuses retry exploded')));
		assert.ok(!(panel.getDomNode().textContent ?? '').includes(MCP_RUNTIME_EMPTY));
		assert.strictEqual(panel.getToolsCount(), 0);
		assert.strictEqual(getToolsRowCount(panel), 0);
		const firstPullTools = getToolsList(panel);
		assert.ok(firstPullTools);
		assert.strictEqual(firstPullTools.style.display, 'none');
	});

	test('successful load then capability UNKNOWN keeps leftover rows and paints capability loading', async () => {
		let statusCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			getMcpServerStatuses: async () => {
				statusCalls++;
				return { statuses: [{ serverId: LEFTOVER_RUNTIME_SERVER_ID, status: 'connected' }] };
			},
		});
		const panel = mountPanel(connection);
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'ready');
		assert.strictEqual(panel.getListEntryCount(), 1);
		assert.ok(panel.selectServerForTest(LEFTOVER_RUNTIME_SERVER_ID));
		const listAfterLoad = panel.getDomNode().querySelector('.engine-mcp-runtime-list') as HTMLElement;
		assert.ok(listAfterLoad);
		assert.notStrictEqual(listAfterLoad.style.display, 'none');
		const statusCallsAfterLoad = statusCalls;

		connection.setMcpRuntimeSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'loading');
		assert.strictEqual(panel.getListEntryCount(), 1);
		assert.ok(panel.selectServerForTest(LEFTOVER_RUNTIME_SERVER_ID));
		assert.strictEqual(statusCalls, statusCallsAfterLoad);
		const leftoverList = panel.getDomNode().querySelector('.engine-mcp-runtime-list') as HTMLElement;
		assert.ok(leftoverList);
		assert.notStrictEqual(leftoverList.style.display, 'none');
		const status = panel.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.ok(!(panel.getDomNode().textContent ?? '').includes(MCP_RUNTIME_EMPTY));
		assert.strictEqual(panel.getToolsCount(), 0);
		assert.strictEqual(getToolsRowCount(panel), 0);
		const firstPullTools = getToolsList(panel);
		assert.ok(firstPullTools);
		assert.strictEqual(firstPullTools.style.display, 'none');
	});

	test('successful tools load then runtime UNKNOWN then select leftover keeps tool rows', async () => {
		const connection = createConnectionStub({
			connected: true,
			getMcpServerStatuses: async () => ({
				statuses: [{ serverId: LEFTOVER_RUNTIME_SERVER_ID, status: 'connected' }],
			}),
			getMcpServerTools: async () => ({
				tools: [{ name: LEFTOVER_TOOL_NAME, description: 'keep me' }],
			}),
		});
		const panel = mountPanel(connection);
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'ready');
		assert.ok(panel.selectServerForTest(LEFTOVER_RUNTIME_SERVER_ID));
		await flushMicrotasks();

		const toolsList = getToolsList(panel);
		assert.ok(toolsList);
		assert.strictEqual(panel.getToolsCount(), 1);
		assert.strictEqual(getToolsRowCount(panel), 1);
		assert.notStrictEqual(toolsList.style.display, 'none');

		connection.setMcpRuntimeSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'loading');
		assert.ok(panel.selectServerForTest(LEFTOVER_RUNTIME_SERVER_ID));
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'loading');
		assert.strictEqual(panel.getToolsCount(), 1);
		assert.strictEqual(getToolsRowCount(panel), 1);
		assert.notStrictEqual(toolsList.style.display, 'none');
		const status = panel.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.ok(!(panel.getDomNode().textContent ?? '').includes(MCP_RUNTIME_TOOLS_EMPTY));
	});

	test('successful tools load then runtime list throw then select leftover keeps tool rows', async () => {
		let statusCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			getMcpServerStatuses: async () => {
				statusCalls++;
				if (statusCalls === 1) {
					return { statuses: [{ serverId: LEFTOVER_RUNTIME_SERVER_ID, status: 'connected' }] };
				}
				throw new Error('getMcpServerStatuses retry exploded');
			},
			getMcpServerTools: async () => ({
				tools: [{ name: LEFTOVER_TOOL_NAME, description: 'keep me' }],
			}),
		});
		const panel = mountPanel(connection);
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'ready');
		assert.ok(panel.selectServerForTest(LEFTOVER_RUNTIME_SERVER_ID));
		await flushMicrotasks();

		const toolsList = getToolsList(panel);
		assert.ok(toolsList);
		assert.strictEqual(panel.getToolsCount(), 1);
		assert.strictEqual(getToolsRowCount(panel), 1);
		assert.notStrictEqual(toolsList.style.display, 'none');

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'failed');
		assert.ok(panel.selectServerForTest(LEFTOVER_RUNTIME_SERVER_ID));
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'failed');
		assert.strictEqual(panel.getToolsCount(), 1);
		assert.strictEqual(getToolsRowCount(panel), 1);
		assert.notStrictEqual(toolsList.style.display, 'none');
		const status = panel.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(MCP_RUNTIME_FEATURE, 'getMcpServerStatuses retry exploded')));
		assert.ok(!(panel.getDomNode().textContent ?? '').includes(MCP_RUNTIME_TOOLS_EMPTY));
	});

	test('first-pull capability UNKNOWN is empty with capability loading and does not list', async () => {
		let statusCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			mcpRuntimeSupport: 'UNKNOWN',
			getMcpServerStatuses: async () => {
				statusCalls++;
				return { statuses: [{ serverId: RUNTIME_SERVER_ID, status: 'connected' }] };
			},
		});
		const panel = mountPanel(connection);
		await flushMicrotasks();

		assert.strictEqual(panel.getMode(), 'loading');
		assert.strictEqual(panel.getListEntryCount(), 0);
		assert.strictEqual(panel.selectServerForTest(RUNTIME_SERVER_ID), false);
		assert.strictEqual(statusCalls, 0);
		const list = panel.getDomNode().querySelector('.engine-mcp-runtime-list') as HTMLElement;
		assert.ok(list);
		assert.strictEqual(list.style.display, 'none');
		const status = panel.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.ok(!(panel.getDomNode().textContent ?? '').includes(MCP_RUNTIME_EMPTY));
	});
});
