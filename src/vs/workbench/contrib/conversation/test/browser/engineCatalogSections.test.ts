/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
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
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentToggleMcpServerResult,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentToolInfoRequest,
	UniverseAgentToolInfoResult,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ENGINE_AGENTS_CREATE_SUCCESS_COPY, ENGINE_AGENTS_DELETE_SUCCESS_COPY, ENGINE_AGENTS_RESET_SUCCESS_COPY, ENGINE_AGENTS_SAVE_SUCCESS_COPY, EngineAgentsSection } from '../../browser/engineAgentsSection.js';
import { ENGINE_MCP_ADD_SUCCESS_COPY, ENGINE_MCP_REMOVE_SUCCESS_COPY, ENGINE_MCP_TOGGLE_SUCCESS_COPY, ENGINE_MCP_UPDATE_SUCCESS_COPY, EngineMcpSection } from '../../browser/engineMcpSection.js';
import { EngineToolsSection } from '../../browser/engineToolsSection.js';
import {
	canPerformCatalogWrite,
	getCatalogFailedCopy,
	getCatalogListLoadingCopy,
	getCatalogUnknownCopy,
	getCatalogUnsupportedCopy,
} from '../../browser/engineCatalog.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { localize } from '../../../../../nls.js';

const AGENTS_FEATURE = localize('ua.engineAgentsFeatureLabel', "agent profiles");
const AGENTS_EMPTY_COPY = localize('ua.engineAgentsEmpty', "No agent profiles yet.");
const AGENT_TOOLS_FEATURE = localize('ua.engineAgentToolsFeatureLabel', "agent profile tools");
const AGENT_TOOLS_EMPTY_COPY = localize('ua.engineAgentsToolsEmpty', "No engine tools to enable for this profile.");
const LEFTOVER_AGENT_TOOL_NAME = 'leftover-agent-tool';
const MCP_FEATURE = localize('ua.engineMcpFeatureLabel', "MCP server definitions");
const MCP_EMPTY_COPY = localize('ua.engineMcpEmpty', "No MCP servers yet.");
const TOOLS_FEATURE = localize('ua.engineToolsFeatureLabel', "engine tools");
const TOOLS_EMPTY_COPY = localize('ua.engineToolsEmpty', "No engine tools yet.");

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
		toggleMcpServer?: (request: UniverseAgentToggleMcpServerRequest) => Promise<UniverseAgentToggleMcpServerResult>;
		getToolInfo?: (request: UniverseAgentToolInfoRequest) => Promise<UniverseAgentToolInfoResult>;
	} = {}): IUniverseAgentConnection & {
		setConnected(value: boolean): void;
		setPairingPending(value: boolean): void;
		setMcpSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
		setAgentProfilesSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
		setToolsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
		clearGetToolInfo(): void;
	} {
		const emptyCapabilities = createEmptyCapabilitySnapshot();
		const mcpCapability = {
			...emptyCapabilities.mcp,
			...options.capabilities?.mcp,
		};
		const agentProfilesCapability = {
			...emptyCapabilities.agentProfiles,
			...options.capabilities?.agentProfiles,
		};
		const toolsCapability = {
			...emptyCapabilities.tools,
			...options.capabilities?.tools,
		};
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...emptyCapabilities,
			...options.capabilities,
			mcp: mcpCapability,
			agentProfiles: agentProfilesCapability,
			tools: toolsCapability,
		};
		let connected = options.connected ?? false;
		let pairingPending = false;
		let getToolInfo = options.getToolInfo;
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();

		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sessionToken: connected ? 'tok' : undefined,
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities,
		});

		return {
			_serviceBrand: undefined,
			isEngineConnected: () => connected && !pairingPending,
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
			listAgentProfiles: options.listAgentProfiles ?? (async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }],
			})),
			saveAgentProfile: options.saveAgentProfile ?? (async (request) => ({ profile: request.profile })),
			deleteAgentProfile: options.deleteAgentProfile ?? (async () => ({ ok: true })),
			resetAgentProfile: options.resetAgentProfile ?? (async () => ({ ok: true })),
			listMcpServers: options.listMcpServers ?? (async () => ({ servers: [] })),
			getMcpServerStatuses: async () => ({ statuses: [] }),
			getMcpServerTools: async () => ({ tools: [] }),
			listPlugins: async () => ({ plugins: [] }),
			getPluginInfo: async () => ({ summary: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const }, hooks: [] }),
			enablePlugin: async () => ({ plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }),
			reloadPlugin: async () => ({ plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }),
			unloadPlugin: async () => ({ removedHookCount: 0 }),
			scanNewPlugins: async () => ({ newPlugins: [], skippedCount: 0 }),
			toggleMcpServer: options.toggleMcpServer ?? (async () => ({ ok: true })),
			addMcpServer: options.addMcpServer ?? (async () => ({ ok: true })),
			updateMcpServer: options.updateMcpServer ?? (async () => ({ ok: true })),
			removeMcpServer: options.removeMcpServer ?? (async () => ({ ok: true })),
			listTools: options.listTools ?? (async () => ({ tools: [] })),
			get getToolInfo() {
				return getToolInfo;
			},
			listModels: async () => ({ models: [] }),
			probeEngine: async () => ({ ok: false as const, reason: 'stub' }),
			setConnected(value: boolean) {
				connected = value;
				onDidChangeConnection.fire(snapshot());
			},
			setPairingPending(value: boolean) {
				pairingPending = value;
				onDidChangeConnection.fire(snapshot());
			},
			setMcpSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') {
				mcpCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
			setAgentProfilesSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') {
				agentProfilesCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
			setToolsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') {
				toolsCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
			clearGetToolInfo() {
				getToolInfo = undefined;
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

	function mountMcpSection(connection: IUniverseAgentConnection): EngineMcpSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineMcpSection, parent));
		section.setSectionActive(true);
		section.layout(640, 160);
		return section;
	}

	function mountToolsSection(connection: IUniverseAgentConnection): EngineToolsSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineToolsSection, parent));
		section.setSectionActive(true);
		section.layout(640, 160);
		return section;
	}

	function assertFailedCatalogHonesty(
		section: EngineAgentsSection | EngineToolsSection | EngineMcpSection,
		featureLabel: string,
		errorMessage: string,
	): void {
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.canWrite(), false);
		section.setSectionActive(true);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(featureLabel, errorMessage)));
		const combined = (section.getDomNode().parentElement?.textContent ?? '') + (status.textContent ?? '');
		assert.ok(!/Demo Agent/i.test(combined));
		assert.ok(!/\bbash\b/i.test(combined));
		assert.ok(!/copilot/i.test(combined));
		assert.ok(!/\.vscode\/mcp\.json/i.test(combined));
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	test('canPerformCatalogWrite is false when disconnected or unsupported', () => {
		assert.strictEqual(canPerformCatalogWrite('disconnected'), false);
		assert.strictEqual(canPerformCatalogWrite('unsupported'), false);
		assert.strictEqual(canPerformCatalogWrite('loading'), false);
		assert.strictEqual(canPerformCatalogWrite('ready'), true);
		assert.strictEqual(canPerformCatalogWrite('empty'), true);
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
			section.setSectionActive(true);
			const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
			assert.ok(status);
			assert.ok(status.textContent?.includes(getCatalogUnsupportedCopy(featureLabel, 'UNIMPLEMENTED')));
			const combined = section.getDomNode().parentElement?.textContent ?? '';
			assert.ok(!/copilot/i.test(combined));
			assert.ok(!/\.vscode\/mcp\.json/i.test(combined));
		});
	}

	function assertCatalogLeftoverPairingHonesty(
		section: EngineAgentsSection | EngineToolsSection | EngineMcpSection,
		expectedRows: number,
		emptyCopy: string,
	): void {
		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		section.setSectionActive(true);
		const listContainer = section.getDomNode().querySelector('.engine-catalog-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(emptyCopy));
	}

	test('Tools: connected phase with pairingPending keeps leftover catalog and paints not-connected', async () => {
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => {
				listToolsCalls++;
				return { tools: [{ name: 'leftover-bash', description: 'shell tool', category: 'shell' }] };
			},
			listAgentProfiles: async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }],
			}),
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listToolsCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listToolsCalls, listCallsAfterLoad);
		assertCatalogLeftoverPairingHonesty(section, leftoverRows, TOOLS_EMPTY_COPY);

		connection.setConnected(false);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
	});

	test('Agents: connected phase with pairingPending keeps leftover catalog and paints not-connected', async () => {
		let listAgentProfilesCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [{ id: 'leftover', name: 'Leftover Agent', source: 'user' as const }] };
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listAgentProfilesCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);
		assertCatalogLeftoverPairingHonesty(section, leftoverRows, AGENTS_EMPTY_COPY);

		connection.setConnected(false);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
	});

	test('MCP: connected phase with pairingPending keeps leftover catalog and paints not-connected', async () => {
		let listMcpServersCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			listMcpServers: async () => {
				listMcpServersCalls++;
				return { servers: [demoMcpServer()] };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listMcpServersCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listMcpServersCalls, listCallsAfterLoad);
		assertCatalogLeftoverPairingHonesty(section, leftoverRows, MCP_EMPTY_COPY);

		connection.setConnected(false);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
	});

	test('Agents: disconnected Open Connection executeCommand reject does not leak unhandled rejection', async () => {
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
		try {
			let executeCommandCalls = 0;
			const connection = createConnectionStub({
				connected: false,
				capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			});
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			const instantiationService = workbenchInstantiationService(undefined, store);
			instantiationService.stub(IUniverseAgentConnection, connection);
			instantiationService.stub(ICommandService, {
				executeCommand: async () => {
					executeCommandCalls++;
					throw new Error('boom');
				},
			});
			const section = store.add(instantiationService.createInstance(EngineAgentsSection, parent));
			section.layout(640, 120);
			section.setSectionActive(true);
			await flushMicrotasks();

			const openConnection = Array.from(section.getDomNode().querySelectorAll('.engine-catalog-status-widget .monaco-button'))
				.find(button => (button.textContent ?? '').includes('Open Connection')) as HTMLElement | undefined;
			assert.ok(openConnection);
			openConnection.click();
			await flushMicrotasks();
			assert.deepStrictEqual(unhandledRejections, []);
			assert.strictEqual(executeCommandCalls, 1);
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

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

		assert.strictEqual(section.getMode(), 'ready');
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

	test('Agents: connected saveAgentsMarkdown persists body via SaveAgentProfile', async () => {
		const saves: UniverseAgentSaveAgentProfileRequest[] = [];
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const, summary: 'Short' }],
			}),
			saveAgentProfile: async (request) => {
				saves.push(request);
				return {
					profile: {
						...request.profile,
						systemPrompt: request.profile.systemPrompt ?? '# loaded from engine',
					},
				};
			},
		});
		const section = mountAgentsSection(connection);
		await flushMicrotasks();

		await section.selectProfileByIdForTest('demo');
		assert.ok(section.isAgentsEditorVisible());
		section.setAgentsMarkdownValue('---\nsummary: Updated\n---\n# Agent body');
		const ok = await section.saveAgentsMarkdown();
		assert.strictEqual(ok, true);
		const bodySave = saves.find(save => save.profile.systemPrompt === '# Agent body');
		assert.ok(bodySave);
		assert.strictEqual(bodySave!.profile.summary, 'Updated');
	});

	test('Agents: disconnected saveAgentsMarkdown does not call Save', async () => {
		let saveCalled = false;
		const connection = createConnectionStub({
			connected: false,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }],
			}),
			saveAgentProfile: async (request) => {
				saveCalled = true;
				return { profile: request.profile };
			},
		});
		const section = mountAgentsSection(connection);
		await flushMicrotasks();

		const ok = await section.saveAgentsMarkdown();
		assert.strictEqual(saveCalled, false);
		assert.strictEqual(ok, false);
		assert.strictEqual(section.isAgentsEditorVisible(), false);
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

	test('Tools: selecting a row loads ToolInfo detail without a schema editor', async () => {
		const calls: string[] = [];
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => ({ tools: [{ name: 'bash', description: 'list desc', category: 'shell' }] }),
			getToolInfo: async (request) => {
				calls.push(request.toolName);
				return {
					name: 'bash',
					description: 'Run a command',
					category: 'shell',
					destructive: true,
					requiresPermission: true,
					aliases: ['sh'],
					inputSchemaJson: '{"type":"object"}',
				};
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineToolsSection, parent));
		section.setSectionActive(true);
		section.layout(640, 160);
		await flushMicrotasks();

		assert.strictEqual(section.selectTool('bash'), true);
		await flushMicrotasks();
		assert.deepStrictEqual(calls, ['bash']);
		const detail = section.getToolInfoDetailText() ?? '';
		assert.ok(detail.includes('Run a command'));
		assert.ok(detail.includes('Destructive'));
		assert.ok(detail.includes('Requires permission'));
		assert.ok(detail.includes('Has input schema'));
		assert.strictEqual(parent.querySelector('textarea'), null);
	});

	test('Tools: successful refresh then getToolInfo throw keeps leftover detail and paints failed', async () => {
		let getToolInfoCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => ({ tools: [{ name: 'bash', description: 'list desc', category: 'shell' }] }),
			listAgentProfiles: async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }],
			}),
			getToolInfo: async (request) => {
				getToolInfoCalls++;
				if (getToolInfoCalls === 1) {
					return {
						name: request.toolName,
						description: 'Run a command',
						category: 'shell',
						destructive: false,
						requiresPermission: false,
						aliases: [],
					};
				}
				throw new Error('getToolInfo exploded');
			},
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.selectTool('bash'), true);
		await flushMicrotasks();
		assert.ok((section.getToolInfoDetailText() ?? '').includes('Run a command'));

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const infoHost = section.getDomNode().querySelector('.engine-tools-info') as HTMLElement | null;
		assert.ok(infoHost);
		const detail = (section.getToolInfoDetailText() ?? infoHost.textContent ?? '');
		assert.ok(detail.includes(localize(
			'ua.engineToolsInfoFailed',
			"Could not load tool details from the engine.",
		)));
		assert.ok(detail.includes('Run a command'));
	});

	test('Tools: missing getToolInfo hook explains the detail API is unavailable', async () => {
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => ({ tools: [{ name: 'bash' }] }),
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineToolsSection, parent));
		section.setSectionActive(true);
		section.layout(640, 160);
		await flushMicrotasks();

		assert.strictEqual(section.selectTool('bash'), true);
		await flushMicrotasks();
		assert.strictEqual(section.isToolInfoVisible(), true);
		assert.ok((section.getToolInfoDetailText() ?? '').includes('does not expose'));
	});

	test('Tools: live paint then missing getToolInfo keeps leftover detail and paints unavailable', async () => {
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => ({ tools: [{ name: 'bash', description: 'list desc', category: 'shell' }] }),
			listAgentProfiles: async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }],
			}),
			getToolInfo: async (request) => ({
				name: request.toolName,
				description: 'Run a command',
				category: 'shell',
				destructive: false,
				requiresPermission: false,
				aliases: [],
			}),
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.selectTool('bash'), true);
		await flushMicrotasks();
		assert.ok((section.getToolInfoDetailText() ?? '').includes('Run a command'));

		connection.clearGetToolInfo();
		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const detail = section.getToolInfoDetailText() ?? '';
		assert.ok(detail.includes('Run a command'));
		assert.ok(detail.includes('does not expose'));
		assert.strictEqual(section.isToolInfoVisible(), true);
	});

	test('Tools: listTools reject is failed with error status and no fake catalog', async () => {
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => {
				throw new Error('listTools exploded');
			},
			listAgentProfiles: async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }],
			}),
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assertFailedCatalogHonesty(section, TOOLS_FEATURE, 'listTools exploded');
		assert.ok(!(section.getDomNode().textContent ?? '').includes(TOOLS_EMPTY_COPY));
	});

	test('Tools: listAgentProfiles reject is failed with error status and no fake catalog', async () => {
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => ({ tools: [{ name: 'bash', description: 'should not paint' }] }),
			listAgentProfiles: async () => {
				throw new Error('listAgentProfiles exploded');
			},
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assertFailedCatalogHonesty(section, TOOLS_FEATURE, 'listAgentProfiles exploded');
		assert.ok(!(section.getDomNode().textContent ?? '').includes(TOOLS_EMPTY_COPY));
	});

	test('Agents: listAgentProfiles reject is failed with error status and no fake catalog', async () => {
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				throw new Error('listAgentProfiles exploded');
			},
		});
		const section = mountAgentsSection(connection);
		await flushMicrotasks();

		assertFailedCatalogHonesty(section, AGENTS_FEATURE, 'listAgentProfiles exploded');
		assert.ok(!(section.getDomNode().textContent ?? '').includes(AGENTS_EMPTY_COPY));
	});

	test('MCP: listMcpServers reject is failed with error status and no fake catalog', async () => {
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			listMcpServers: async () => {
				throw new Error('listMcpServers exploded');
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assertFailedCatalogHonesty(section, MCP_FEATURE, 'listMcpServers exploded');
		assert.ok(!(section.getDomNode().textContent ?? '').includes(MCP_EMPTY_COPY));
	});

	function assertToolsLeftoverFailedHonesty(
		section: EngineToolsSection,
		errorMessage: string,
		expectedRows: number,
	): void {
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const listContainer = section.getDomNode().querySelector('.engine-catalog-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(TOOLS_FEATURE, errorMessage)));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(TOOLS_EMPTY_COPY));
	}

	test('Tools: successful load then listTools throw keeps leftover catalog and paints failed', async () => {
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => {
				listToolsCalls++;
				if (listToolsCalls === 1) {
					return { tools: [{ name: 'leftover-bash', description: 'shell tool', category: 'shell' }] };
				}
				throw new Error('listTools retry exploded');
			},
			listAgentProfiles: async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }],
			}),
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listToolsCalls, 2);
		assertToolsLeftoverFailedHonesty(section, 'listTools retry exploded', 1);
	});

	test('Tools: successful load then listAgentProfiles throw keeps leftover catalog and paints failed', async () => {
		let listAgentProfilesCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => ({
				tools: [{ name: 'leftover-bash', description: 'shell tool', category: 'shell' }],
			}),
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				if (listAgentProfilesCalls === 1) {
					return { profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }] };
				}
				throw new Error('listAgentProfiles retry exploded');
			},
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listAgentProfilesCalls, 2);
		assertToolsLeftoverFailedHonesty(section, 'listAgentProfiles retry exploded', 1);
	});

	function demoToolsUserProfile() {
		return { id: 'demo', name: 'Demo Agent', source: 'user' as const, disabledTools: [] as string[] };
	}

	function demoBashTool() {
		return { name: 'bash', description: 'shell tool', category: 'shell' };
	}

	function assertToolsWriteFailureKeepsCatalog(
		section: EngineToolsSection,
		expectedReason: string,
		expectedRows: number,
		expectedDirty: boolean,
	): void {
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), true);
		assert.strictEqual(section.isToolEnablementDirty(), expectedDirty);
		assert.strictEqual(section.getActiveProfileId(), 'demo');
		const writeStatus = section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement;
		assert.ok(writeStatus);
		assert.strictEqual(writeStatus.getAttribute('role'), 'status');
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(expectedReason));
		assert.ok(writeStatus.textContent?.includes('Unable to save:'));
	}

	test('Tools: savePendingEnablement / toggleTool empty id paints write-status and keeps catalog rows', async () => {
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => {
				listToolsCalls++;
				return { tools: [demoBashTool()] };
			},
			listAgentProfiles: async () => ({
				profiles: [demoToolsUserProfile()],
			}),
			saveAgentProfile: async () => ({ profile: { id: '', name: 'should-not-appear' } }),
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		const listCallsAfterLoad = listToolsCalls;

		section.setPendingEnablement({ name: 'bash' }, false);
		assert.strictEqual(section.isToolEnablementDirty(), true);
		assert.strictEqual(await section.savePendingEnablement(), false);
		assertToolsWriteFailureKeepsCatalog(section, localize('ua.engineToolsWriteRejected', "The engine rejected the tool enablement write."), 1, true);
		assert.strictEqual(listToolsCalls, listCallsAfterLoad);
		assert.ok(!/should-not-appear/i.test(section.getDomNode().textContent ?? ''));

		assert.strictEqual(await section.toggleTool({ name: 'bash' }, false), false);
		assertToolsWriteFailureKeepsCatalog(section, localize('ua.engineToolsWriteRejected', "The engine rejected the tool enablement write."), 1, true);
		assert.strictEqual(listToolsCalls, listCallsAfterLoad);
	});

	test('Tools: savePendingEnablement / toggleTool throw paints write-status and keeps catalog rows', async () => {
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => {
				listToolsCalls++;
				return { tools: [demoBashTool()] };
			},
			listAgentProfiles: async () => ({
				profiles: [demoToolsUserProfile()],
			}),
			saveAgentProfile: async () => {
				throw new Error('save exploded');
			},
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		const listCallsAfterLoad = listToolsCalls;

		section.setPendingEnablement({ name: 'bash' }, false);
		assert.strictEqual(section.isToolEnablementDirty(), true);
		assert.strictEqual(await section.savePendingEnablement(), false);
		assertToolsWriteFailureKeepsCatalog(section, 'save exploded', 1, true);
		assert.strictEqual(listToolsCalls, listCallsAfterLoad);

		assert.strictEqual(await section.toggleTool({ name: 'bash' }, false), false);
		assertToolsWriteFailureKeepsCatalog(section, 'save exploded', 1, true);
		assert.strictEqual(listToolsCalls, listCallsAfterLoad);
	});

	test('Tools: successful reconnect refresh clears pending enablement and keeps catalog ready', async () => {
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => ({ tools: [demoBashTool()] }),
			listAgentProfiles: async () => ({
				profiles: [demoToolsUserProfile()],
			}),
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		section.setPendingEnablement({ name: 'bash' }, false);
		assert.strictEqual(section.isToolEnablementDirty(), true);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(section.isToolEnablementDirty(), false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
	});

	function assertAgentsLeftoverFailedHonesty(
		section: EngineAgentsSection,
		errorMessage: string,
		expectedRows: number,
	): void {
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		section.setSectionActive(true);
		const listContainer = section.getDomNode().querySelector('.engine-catalog-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(AGENTS_FEATURE, errorMessage)));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(AGENTS_EMPTY_COPY));
	}

	test('Agents: successful load then listAgentProfiles throw keeps leftover catalog and paints failed', async () => {
		let listAgentProfilesCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				if (listAgentProfilesCalls === 1) {
					return { profiles: [{ id: 'leftover', name: 'Leftover Agent', source: 'user' as const }] };
				}
				throw new Error('listAgentProfiles retry exploded');
			},
		});
		const section = mountAgentsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listAgentProfilesCalls, 2);
		assertAgentsLeftoverFailedHonesty(section, 'listAgentProfiles retry exploded', 1);
	});

	function demoUserAgent() {
		return { id: 'demo', name: 'Demo Agent', source: 'user' as const };
	}

	function demoBuiltInAgent() {
		return { id: 'builtin', name: 'Built-in Agent', source: 'built_in' as const };
	}

	function assertAgentsWriteFailureKeepsCatalog(
		section: EngineAgentsSection,
		expectedReason: string,
		expectedRows: number,
		expectedSelectedId?: string,
	): void {
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), true);
		if (expectedSelectedId !== undefined) {
			assert.strictEqual(section.getSelectedProfileId(), expectedSelectedId);
		}
		const writeStatus = section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement;
		assert.ok(writeStatus);
		assert.strictEqual(writeStatus.getAttribute('role'), 'status');
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(expectedReason));
	}

	test('Agents: create/delete/reset ok:false paints write-status and keeps catalog rows', async () => {
		let listAgentProfilesCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [demoUserAgent(), demoBuiltInAgent()] };
			},
			saveAgentProfile: async () => ({ profile: { id: '', name: 'should-not-appear' } }),
			deleteAgentProfile: async () => ({ ok: false, reason: 'delete denied' }),
			resetAgentProfile: async () => ({ ok: false, reason: 'reset denied' }),
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 2);
		const listCallsAfterLoad = listAgentProfilesCalls;

		assert.strictEqual(await section.createProfile({ id: 'should-not-appear', name: 'should-not-appear', source: 'user' }), false);
		assertAgentsWriteFailureKeepsCatalog(section, 'Unable to create:', 2);
		assert.ok((section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement).textContent?.includes(
			localize('ua.engineAgentsWriteRejected', "The engine rejected the agent profile write."),
		));
		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);
		assert.ok(!/should-not-appear/i.test(section.getDomNode().textContent ?? ''));

		await section.selectProfileByIdForTest('demo');
		assert.strictEqual(section.getSelectedProfileId(), 'demo');
		assert.strictEqual(await section.deleteSelectedProfile(), false);
		assertAgentsWriteFailureKeepsCatalog(section, 'delete denied', 2, 'demo');
		assert.ok((section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement).textContent?.includes('Unable to delete:'));
		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);

		await section.selectProfileByIdForTest('builtin');
		assert.strictEqual(section.getSelectedProfileId(), 'builtin');
		assert.strictEqual(await section.resetSelectedProfile(), false);
		assertAgentsWriteFailureKeepsCatalog(section, 'reset denied', 2, 'builtin');
		assert.ok((section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement).textContent?.includes('Unable to reset:'));
		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);
	});

	test('Agents: create/delete/reset throw paints write-status and keeps catalog rows', async () => {
		let listAgentProfilesCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [demoUserAgent(), demoBuiltInAgent()] };
			},
			saveAgentProfile: async () => {
				throw new Error('create exploded');
			},
			deleteAgentProfile: async () => {
				throw new Error('delete exploded');
			},
			resetAgentProfile: async () => {
				throw new Error('reset exploded');
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 2);
		const listCallsAfterLoad = listAgentProfilesCalls;

		assert.strictEqual(await section.createProfile({ id: 'should-not-appear', name: 'should-not-appear', source: 'user' }), false);
		assertAgentsWriteFailureKeepsCatalog(section, 'create exploded', 2);
		assert.ok((section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement).textContent?.includes('Unable to create:'));
		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);
		assert.ok(!/should-not-appear/i.test(section.getDomNode().textContent ?? ''));

		await section.selectProfileByIdForTest('demo');
		assert.strictEqual(section.getSelectedProfileId(), 'demo');
		assert.strictEqual(await section.deleteSelectedProfile(), false);
		assertAgentsWriteFailureKeepsCatalog(section, 'delete exploded', 2, 'demo');
		assert.ok((section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement).textContent?.includes('Unable to delete:'));
		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);

		await section.selectProfileByIdForTest('builtin');
		assert.strictEqual(section.getSelectedProfileId(), 'builtin');
		assert.strictEqual(await section.resetSelectedProfile(), false);
		assertAgentsWriteFailureKeepsCatalog(section, 'reset exploded', 2, 'builtin');
		assert.ok((section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement).textContent?.includes('Unable to reset:'));
		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);
	});

	test('Agents: saveAgentsMarkdown throw paints editor-status and keeps catalog rows', async () => {
		let listAgentProfilesCalls = 0;
		let saveCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [demoUserAgent()] };
			},
			saveAgentProfile: async (request) => {
				saveCalls++;
				if (saveCalls > 1) {
					throw new Error('save exploded');
				}
				return { profile: request.profile };
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		await section.selectProfileByIdForTest('demo');
		assert.ok(section.isAgentsEditorVisible());
		assert.strictEqual(section.getSelectedProfileId(), 'demo');
		const listCallsAfterLoad = listAgentProfilesCalls;
		section.setAgentsMarkdownValue('---\nsummary: Updated\n---\n# Agent body');

		assert.strictEqual(await section.saveAgentsMarkdown(), false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedProfileId(), 'demo');
		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);

		const editorStatus = section.getDomNode().querySelector('.engine-agents-editor-status') as HTMLElement;
		assert.ok(editorStatus);
		assert.notStrictEqual(editorStatus.style.display, 'none');
		assert.ok(editorStatus.textContent?.includes(localize(
			'ua.engineAgentsMdSaveFailed',
			"Could not save AGENTS.md to the engine.",
		)));
		assertAgentsWriteFailureKeepsCatalog(section, 'save exploded', 1, 'demo');
	});

	function assertAgentsWriteSuccessClearedAfterListFail(section: EngineAgentsSection, successCopy: string, listReason: string): void {
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 1);
		const writeStatus = section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement;
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.textContent, successCopy);
		assert.ok(!(writeStatus.textContent ?? '').includes(successCopy));

		const catalog = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(catalog);
		assert.strictEqual(catalog.dataset['catalogMode'], 'failed');
		assert.ok((catalog.textContent ?? '').includes(getCatalogFailedCopy(AGENTS_FEATURE, listReason)));
	}

	test('Agents: createProfile ok does not keep create-success when subsequent listAgentProfiles fails', async () => {
		let listAgentProfilesCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { agentProfiles: { support: 'SUPPORTED' } },
				listAgentProfiles: async () => {
					listAgentProfilesCalls++;
					if (listAgentProfilesCalls > 1) {
						throw new Error('list boom');
					}
					return { profiles: [demoUserAgent()] };
				},
				saveAgentProfile: async (request) => ({ profile: request.profile }),
			});
			const section = mountAgentsSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();
			assert.strictEqual(listAgentProfilesCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');

			assert.strictEqual(await section.createProfile({ id: 'new-agent', name: 'New', source: 'user' }), true);
			assert.ok(listAgentProfilesCalls >= 2);
			assertAgentsWriteSuccessClearedAfterListFail(section, ENGINE_AGENTS_CREATE_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('Agents: deleteSelectedProfile ok does not keep delete-success when subsequent listAgentProfiles fails', async () => {
		let listAgentProfilesCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { agentProfiles: { support: 'SUPPORTED' } },
				listAgentProfiles: async () => {
					listAgentProfilesCalls++;
					if (listAgentProfilesCalls > 1) {
						throw new Error('list boom');
					}
					return { profiles: [demoUserAgent()] };
				},
				deleteAgentProfile: async () => ({ ok: true }),
			});
			const section = mountAgentsSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();
			assert.strictEqual(listAgentProfilesCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');
			await section.selectProfileByIdForTest('demo');

			assert.strictEqual(await section.deleteSelectedProfile(), true);
			assert.ok(listAgentProfilesCalls >= 2);
			assertAgentsWriteSuccessClearedAfterListFail(section, ENGINE_AGENTS_DELETE_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('Agents: resetSelectedProfile ok does not keep reset-success when subsequent listAgentProfiles fails', async () => {
		let listAgentProfilesCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { agentProfiles: { support: 'SUPPORTED' } },
				listAgentProfiles: async () => {
					listAgentProfilesCalls++;
					if (listAgentProfilesCalls > 1) {
						throw new Error('list boom');
					}
					return { profiles: [demoBuiltInAgent()] };
				},
				resetAgentProfile: async () => ({ ok: true }),
			});
			const section = mountAgentsSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();
			assert.strictEqual(listAgentProfilesCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');
			await section.selectProfileByIdForTest('builtin');

			assert.strictEqual(await section.resetSelectedProfile(), true);
			assert.ok(listAgentProfilesCalls >= 2);
			assertAgentsWriteSuccessClearedAfterListFail(section, ENGINE_AGENTS_RESET_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('Agents: saveSelectedProfile ok does not keep save-success when subsequent listAgentProfiles fails', async () => {
		let listAgentProfilesCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { agentProfiles: { support: 'SUPPORTED' } },
				listAgentProfiles: async () => {
					listAgentProfilesCalls++;
					if (listAgentProfilesCalls > 1) {
						throw new Error('list boom');
					}
					return { profiles: [demoUserAgent()] };
				},
				saveAgentProfile: async (request) => ({ profile: request.profile }),
			});
			const section = mountAgentsSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();
			assert.strictEqual(listAgentProfilesCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');
			await section.selectProfileByIdForTest('demo');

			assert.strictEqual(await section.saveSelectedProfile({ summary: 'Updated' }), true);
			assert.ok(listAgentProfilesCalls >= 2);
			assertAgentsWriteSuccessClearedAfterListFail(section, ENGINE_AGENTS_SAVE_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('Agents: saveAgentsMarkdown ok does not keep save-success when subsequent listAgentProfiles fails', async () => {
		let listAgentProfilesCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { agentProfiles: { support: 'SUPPORTED' } },
				listAgentProfiles: async () => {
					listAgentProfilesCalls++;
					if (listAgentProfilesCalls > 1) {
						throw new Error('list boom');
					}
					return { profiles: [demoUserAgent()] };
				},
				saveAgentProfile: async (request) => ({ profile: request.profile }),
			});
			const section = mountAgentsSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();
			assert.strictEqual(listAgentProfilesCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');
			await section.selectProfileByIdForTest('demo');
			section.setAgentsMarkdownValue('---\nsummary: Updated\n---\n# Agent body');

			assert.strictEqual(await section.saveAgentsMarkdown(), true);
			assert.ok(listAgentProfilesCalls >= 2);
			assertAgentsWriteSuccessClearedAfterListFail(section, ENGINE_AGENTS_SAVE_SUCCESS_COPY, 'list boom');

			const editorStatus = section.getDomNode().querySelector('.engine-agents-editor-status') as HTMLElement;
			assert.ok(editorStatus);
			assert.notStrictEqual(editorStatus.textContent, ENGINE_AGENTS_SAVE_SUCCESS_COPY);
			assert.ok(!(editorStatus.textContent ?? '').includes(ENGINE_AGENTS_SAVE_SUCCESS_COPY));

			await section.restoreMarkdownSaveSuccessWithLeftoverReadyForTest('demo');
			assert.strictEqual(canPerformCatalogWrite(section.getMode()), true);
			assert.notStrictEqual(editorStatus.textContent, ENGINE_AGENTS_SAVE_SUCCESS_COPY);
			assert.ok(!(editorStatus.textContent ?? '').includes(ENGINE_AGENTS_SAVE_SUCCESS_COPY));
			const leftoverWriteStatus = section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement;
			assert.ok(leftoverWriteStatus);
			assert.notStrictEqual(leftoverWriteStatus.textContent, ENGINE_AGENTS_SAVE_SUCCESS_COPY);
			assert.ok(!(leftoverWriteStatus.textContent ?? '').includes(ENGINE_AGENTS_SAVE_SUCCESS_COPY));
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	function getAgentToolRows(section: EngineAgentsSection): NodeListOf<Element> {
		return section.getDomNode().querySelectorAll('.engine-agents-tools-panel .engine-catalog-row');
	}

	function getAgentToolsStatus(section: EngineAgentsSection): HTMLElement | null {
		return section.getDomNode().querySelector(
			'.engine-agents-tools-panel .engine-catalog-status-widget[data-catalog-mode="failed"]',
		) as HTMLElement | null;
	}

	function assertAgentToolsFailedHonesty(section: EngineAgentsSection, reason: string, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes('Demo Agent'));
		assert.strictEqual(section.getAgentToolRowCount(), expectedRows);
		assert.strictEqual(section.getAgentToolNames().length, expectedRows);
		assert.strictEqual(getAgentToolRows(section).length, expectedRows);
		const toolsStatus = getAgentToolsStatus(section);
		assert.ok(toolsStatus);
		assert.strictEqual(toolsStatus.dataset['catalogMode'], 'failed');
		assert.ok(toolsStatus.textContent?.includes(getCatalogFailedCopy(AGENT_TOOLS_FEATURE, reason)));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(AGENT_TOOLS_EMPTY_COPY));
		if (expectedRows > 0) {
			assert.ok(section.getAgentToolNames().includes(LEFTOVER_AGENT_TOOL_NAME));
			assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_AGENT_TOOL_NAME));
			const leftoverName = section.getDomNode().querySelector('.engine-agents-tools-panel .engine-catalog-name');
			assert.ok(leftoverName);
			assert.strictEqual(leftoverName.textContent, LEFTOVER_AGENT_TOOL_NAME);
			assert.notStrictEqual((leftoverName as HTMLElement).style.display, 'none');
		}
	}

	test('Agents: tools tab listTools throw paints failed toolsStatus', async () => {
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' }, tools: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => ({
				profiles: [demoUserAgent()],
			}),
			listTools: async () => {
				throw new Error('listTools exploded');
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		await section.selectProfileByIdForTest('demo');
		section.setActiveAgentDetailTabForTest('tools');
		await flushMicrotasks();

		assertAgentToolsFailedHonesty(section, 'listTools exploded', 0);
	});

	test('Agents: tools tab reconnect listTools throw keeps leftover rows and paints failed', async () => {
		let listToolsCalls = 0;
		let listAgentProfilesCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' }, tools: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [demoUserAgent()] };
			},
			listTools: async () => {
				listToolsCalls++;
				if (listToolsCalls === 1) {
					return { tools: [{ name: LEFTOVER_AGENT_TOOL_NAME }] };
				}
				throw new Error('listTools exploded');
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		await section.selectProfileByIdForTest('demo');
		section.setActiveAgentDetailTabForTest('tools');
		await flushMicrotasks();

		assert.strictEqual(section.getAgentToolRowCount(), 1);
		assert.deepStrictEqual([...section.getAgentToolNames()], [LEFTOVER_AGENT_TOOL_NAME]);
		assert.strictEqual(getAgentToolRows(section).length, 1);
		assert.ok((section.getDomNode().textContent ?? '').includes(LEFTOVER_AGENT_TOOL_NAME));
		assert.strictEqual(getAgentToolsStatus(section), null);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(AGENT_TOOLS_EMPTY_COPY));
		assert.strictEqual(listAgentProfilesCalls, 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assertAgentToolsFailedHonesty(section, 'listTools exploded', 1);
		assert.strictEqual(listAgentProfilesCalls, 2);
		assert.strictEqual(listToolsCalls, 2);
	});

	test('Agents: successful reconnect refresh clears agent tool pending and keeps catalog ready', async () => {
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' }, tools: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => ({
				profiles: [demoUserAgent()],
			}),
			listTools: async () => ({
				tools: [{ name: 'bash' }],
			}),
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		await section.selectProfileByIdForTest('demo');
		section.setActiveAgentDetailTabForTest('tools');
		await flushMicrotasks();

		section.setAgentToolPendingForTest({ name: 'bash' }, false);
		assert.strictEqual(section.isAgentToolEnablementDirty(), true);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(section.isAgentToolEnablementDirty(), false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		const toolsFailed = section.getDomNode().querySelector(
			'.engine-agents-tools-panel .engine-catalog-status-widget[data-catalog-mode="failed"]',
		);
		assert.strictEqual(toolsFailed, null);
		assert.ok((section.getDomNode().textContent ?? '').includes('bash'));
	});

	function assertAgentToolsUnknownCapabilityHonesty(
		section: EngineAgentsSection,
		expectedRows: number,
	): void {
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getAgentToolRowCount(), expectedRows);
		const rows = getAgentToolRows(section);
		assert.strictEqual(rows.length, expectedRows);
		const toolsPanel = section.getDomNode().querySelector('.engine-agents-tools-panel') as HTMLElement;
		assert.ok(toolsPanel);
		assert.notStrictEqual(toolsPanel.style.display, 'none');
		for (const row of rows) {
			assert.notStrictEqual((row as HTMLElement).style.display, 'none');
		}
		const toolsStatus = section.getDomNode().querySelector(
			'.engine-agents-tools-panel .engine-catalog-status-widget',
		) as HTMLElement;
		assert.ok(toolsStatus);
		assert.notStrictEqual(toolsStatus.style.display, 'none');
		assert.strictEqual(toolsStatus.dataset['catalogMode'], 'loading');
		assert.ok(toolsStatus.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(toolsStatus.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(AGENT_TOOLS_EMPTY_COPY));
	}

	test('Agents: tools tab first-pull capability UNKNOWN is empty with capability loading', async () => {
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' }, tools: { support: 'UNKNOWN' } },
			listAgentProfiles: async () => ({
				profiles: [demoUserAgent()],
			}),
			listTools: async () => {
				listToolsCalls++;
				return { tools: [{ name: LEFTOVER_AGENT_TOOL_NAME }] };
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		await section.selectProfileByIdForTest('demo');
		section.setActiveAgentDetailTabForTest('tools');
		await flushMicrotasks();

		assertAgentToolsUnknownCapabilityHonesty(section, 0);
		assert.strictEqual(listToolsCalls, 0);
	});

	test('Agents: tools tab successful load then capability UNKNOWN keeps leftover rows and paints capability loading', async () => {
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' }, tools: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => ({
				profiles: [demoUserAgent()],
			}),
			listTools: async () => {
				listToolsCalls++;
				return { tools: [{ name: LEFTOVER_AGENT_TOOL_NAME }] };
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		await section.selectProfileByIdForTest('demo');
		section.setActiveAgentDetailTabForTest('tools');
		await flushMicrotasks();

		assert.strictEqual(section.getAgentToolRowCount(), 1);
		const listToolsAfterLoad = listToolsCalls;
		assert.ok(listToolsAfterLoad >= 1);

		connection.setToolsSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(listToolsCalls, listToolsAfterLoad);
		assertAgentToolsUnknownCapabilityHonesty(section, 1);
	});

	test('Agents: instructions tab refresh then saveAgentProfile throw keeps leftover markdown and paints load-failed', async () => {
		let listAgentProfilesCalls = 0;
		let saveCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [demoUserAgent()] };
			},
			saveAgentProfile: async () => {
				saveCalls++;
				if (listAgentProfilesCalls > 1) {
					throw new Error('save exploded');
				}
				return {
					profile: {
						id: 'demo',
						name: 'Demo Agent',
						source: 'user' as const,
						systemPrompt: 'Stale agents md',
					},
				};
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		await section.selectProfileByIdForTest('demo');
		assert.strictEqual(section.getActiveAgentDetailTab(), 'instructions');
		assert.ok(section.isAgentsEditorVisible());
		assert.ok(section.getAgentsMarkdownValue().includes('Stale agents md'));
		assert.strictEqual(section.isAgentsMarkdownDirty(), false);
		assert.ok(saveCalls >= 1);
		assert.strictEqual(listAgentProfilesCalls, 1);

		connection.setConnected(true);
		await flushMicrotasks();

		const editorStatus = section.getDomNode().querySelector('.engine-agents-editor-status') as HTMLElement;
		assert.ok(editorStatus);
		assert.notStrictEqual(editorStatus.style.display, 'none');
		assert.ok(editorStatus.textContent?.includes(localize(
			'ua.engineAgentsMdLoadFailed',
			"Could not load AGENTS.md from the engine.",
		)));
		assert.ok(section.getAgentsMarkdownValue().includes('Stale agents md'));
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes('Demo Agent'));
		assert.strictEqual(section.getSelectedProfileId(), 'demo');
		assert.strictEqual(listAgentProfilesCalls, 2);
		assert.ok(saveCalls >= 2);
	});

	function assertMcpLeftoverFailedHonesty(
		section: EngineMcpSection,
		errorMessage: string,
		expectedRows: number,
	): void {
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const listContainer = section.getDomNode().querySelector('.engine-catalog-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(MCP_FEATURE, errorMessage)));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(MCP_EMPTY_COPY));
	}

	test('MCP: successful load then listMcpServers throw keeps leftover catalog and paints failed', async () => {
		let listMcpServersCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			listMcpServers: async () => {
				listMcpServersCalls++;
				if (listMcpServersCalls === 1) {
					return { servers: [demoMcpServer()] };
				}
				throw new Error('listMcpServers retry exploded');
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listMcpServersCalls, 2);
		assertMcpLeftoverFailedHonesty(section, 'listMcpServers retry exploded', 1);
	});

	function assertMcpUnknownCapabilityHonesty(
		section: EngineMcpSection,
		expectedRows: number,
	): void {
		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const listContainer = section.getDomNode().querySelector('.engine-catalog-list') as HTMLElement;
		assert.ok(listContainer);
		if (expectedRows > 0) {
			assert.notStrictEqual(listContainer.style.display, 'none');
		} else {
			assert.strictEqual(listContainer.style.display, 'none');
		}
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(MCP_EMPTY_COPY));
	}

	test('MCP: successful load then capability UNKNOWN keeps leftover rows and paints capability loading', async () => {
		let listMcpServersCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			listMcpServers: async () => {
				listMcpServersCalls++;
				return { servers: [demoMcpServer()] };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listMcpServersCalls;

		connection.setMcpSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(listMcpServersCalls, listCallsAfterLoad);
		assert.ok(section.getListEntryCount() > 0);
		assertMcpUnknownCapabilityHonesty(section, leftoverRows);
	});

	test('MCP: first-pull capability UNKNOWN is empty with capability loading', async () => {
		let listMcpServersCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'UNKNOWN' } },
			listMcpServers: async () => {
				listMcpServersCalls++;
				return { servers: [demoMcpServer()] };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assertMcpUnknownCapabilityHonesty(section, 0);
		assert.strictEqual(listMcpServersCalls, 0);
	});

	function assertAgentsUnknownCapabilityHonesty(
		section: EngineAgentsSection,
		expectedRows: number,
	): void {
		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		section.setSectionActive(true);
		const listContainer = section.getDomNode().querySelector('.engine-catalog-list') as HTMLElement;
		assert.ok(listContainer);
		if (expectedRows > 0) {
			assert.notStrictEqual(listContainer.style.display, 'none');
		}
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(AGENTS_EMPTY_COPY));
	}

	test('Agents: first-pull capability UNKNOWN is empty with capability loading', async () => {
		let listAgentProfilesCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'UNKNOWN' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }] };
			},
		});
		const section = mountAgentsSection(connection);
		await flushMicrotasks();

		assertAgentsUnknownCapabilityHonesty(section, 0);
		assert.strictEqual(listAgentProfilesCalls, 0);
	});

	test('Agents: successful load then capability UNKNOWN keeps leftover rows and paints capability loading', async () => {
		let listAgentProfilesCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [{ id: 'leftover', name: 'Leftover Agent', source: 'user' as const }] };
			},
		});
		const section = mountAgentsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		const listCallsAfterLoad = listAgentProfilesCalls;

		connection.setAgentProfilesSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);
		assertAgentsUnknownCapabilityHonesty(section, 1);
	});

	test('Agents: successful markdown load then list throw then select leftover keeps editor value', async () => {
		let listAgentProfilesCalls = 0;
		let saveCalls = 0;
		const leftoverMarkdown = 'Leftover agents md';
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				if (listAgentProfilesCalls === 1) {
					return { profiles: [{ id: 'leftover', name: 'Leftover Agent', source: 'user' as const }] };
				}
				throw new Error('listAgentProfiles retry exploded');
			},
			saveAgentProfile: async () => {
				saveCalls++;
				return {
					profile: {
						id: 'leftover',
						name: 'Leftover Agent',
						source: 'user' as const,
						systemPrompt: leftoverMarkdown,
					},
				};
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		await section.selectProfileByIdForTest('leftover');
		assert.ok(section.getAgentsMarkdownValue().includes(leftoverMarkdown));
		assert.strictEqual(section.isAgentsMarkdownDirty(), false);
		assert.ok(section.isAgentsEditorVisible());
		const saveCallsAfterLoad = saveCalls;
		assert.ok(saveCallsAfterLoad >= 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listAgentProfilesCalls, 2);
		assertAgentsLeftoverFailedHonesty(section, 'listAgentProfiles retry exploded', 1);
		await section.selectProfileByIdForTest('leftover');
		await flushMicrotasks();

		assert.ok(section.getAgentsMarkdownValue().includes(leftoverMarkdown));
		assert.strictEqual(section.isAgentsMarkdownDirty(), false);
		assert.ok(section.isAgentsEditorVisible());
		assert.strictEqual(saveCalls, saveCallsAfterLoad);
		assertAgentsLeftoverFailedHonesty(section, 'listAgentProfiles retry exploded', 1);
	});

	test('Agents: successful markdown load then capability UNKNOWN then select leftover keeps editor value', async () => {
		let listAgentProfilesCalls = 0;
		let saveCalls = 0;
		const leftoverMarkdown = 'Leftover agents md';
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [{ id: 'leftover', name: 'Leftover Agent', source: 'user' as const }] };
			},
			saveAgentProfile: async () => {
				saveCalls++;
				return {
					profile: {
						id: 'leftover',
						name: 'Leftover Agent',
						source: 'user' as const,
						systemPrompt: leftoverMarkdown,
					},
				};
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		await section.selectProfileByIdForTest('leftover');
		assert.ok(section.getAgentsMarkdownValue().includes(leftoverMarkdown));
		assert.strictEqual(section.isAgentsMarkdownDirty(), false);
		assert.ok(section.isAgentsEditorVisible());
		const saveCallsAfterLoad = saveCalls;
		const listCallsAfterLoad = listAgentProfilesCalls;
		assert.ok(saveCallsAfterLoad >= 1);

		connection.setAgentProfilesSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);
		assertAgentsUnknownCapabilityHonesty(section, 1);
		await section.selectProfileByIdForTest('leftover');
		await flushMicrotasks();

		assert.ok(section.getAgentsMarkdownValue().includes(leftoverMarkdown));
		assert.strictEqual(section.isAgentsMarkdownDirty(), false);
		assert.ok(section.isAgentsEditorVisible());
		assert.strictEqual(saveCalls, saveCallsAfterLoad);
		assertAgentsUnknownCapabilityHonesty(section, 1);
	});

	function leftoverAgentProfile() {
		return { id: 'leftover', name: 'Leftover Agent', source: 'user' as const };
	}

	function leftoverAgentTool() {
		return { name: LEFTOVER_AGENT_TOOL_NAME };
	}

	function assertAgentsToolsDetailHostLeftoverVisible(section: EngineAgentsSection, expectedToolRows: number): void {
		const detailHost = section.getDomNode().querySelector('.engine-agents-detail') as HTMLElement;
		assert.ok(detailHost);
		assert.notStrictEqual(detailHost.style.display, 'none');
		const toolsPanel = section.getDomNode().querySelector('.engine-agents-tools-panel') as HTMLElement;
		assert.ok(toolsPanel);
		assert.notStrictEqual(toolsPanel.style.display, 'none');
		assert.strictEqual(section.getAgentToolRowCount(), expectedToolRows);
		assert.strictEqual(section.getAgentToolNames().length, expectedToolRows);
		const rows = getAgentToolRows(section);
		assert.strictEqual(rows.length, expectedToolRows);
		for (const row of rows) {
			assert.notStrictEqual((row as HTMLElement).style.display, 'none');
		}
		assert.ok(!(section.getDomNode().textContent ?? '').includes(AGENT_TOOLS_EMPTY_COPY));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(AGENTS_EMPTY_COPY));
		if (expectedToolRows > 0) {
			assert.ok(section.getAgentToolNames().includes(LEFTOVER_AGENT_TOOL_NAME));
		}
	}

	test('Agents: successful tools panel then list throw then select leftover keeps tools panel', async () => {
		let listAgentProfilesCalls = 0;
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' }, tools: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				if (listAgentProfilesCalls === 1) {
					return { profiles: [leftoverAgentProfile()] };
				}
				throw new Error('listAgentProfiles retry exploded');
			},
			listTools: async () => {
				listToolsCalls++;
				return { tools: [leftoverAgentTool()] };
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		await section.selectProfileByIdForTest('leftover');
		section.setActiveAgentDetailTabForTest('tools');
		await flushMicrotasks();

		assert.strictEqual(section.getAgentToolRowCount(), 1);
		assertAgentsToolsDetailHostLeftoverVisible(section, 1);
		const listToolsAfterLoad = listToolsCalls;
		assert.ok(listToolsAfterLoad >= 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listAgentProfilesCalls, 2);
		assertAgentsLeftoverFailedHonesty(section, 'listAgentProfiles retry exploded', 1);
		await section.selectProfileByIdForTest('leftover');
		await flushMicrotasks();

		assert.strictEqual(listToolsCalls, listToolsAfterLoad);
		assertAgentsLeftoverFailedHonesty(section, 'listAgentProfiles retry exploded', 1);
		assertAgentsToolsDetailHostLeftoverVisible(section, 1);
	});

	test('Agents: successful tools panel then capability UNKNOWN then select leftover keeps tools panel', async () => {
		let listAgentProfilesCalls = 0;
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { agentProfiles: { support: 'SUPPORTED' }, tools: { support: 'SUPPORTED' } },
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [leftoverAgentProfile()] };
			},
			listTools: async () => {
				listToolsCalls++;
				return { tools: [leftoverAgentTool()] };
			},
		});
		const section = mountAgentsSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		await section.selectProfileByIdForTest('leftover');
		section.setActiveAgentDetailTabForTest('tools');
		await flushMicrotasks();

		assert.strictEqual(section.getAgentToolRowCount(), 1);
		assertAgentsToolsDetailHostLeftoverVisible(section, 1);
		const listCallsAfterLoad = listAgentProfilesCalls;
		const listToolsAfterLoad = listToolsCalls;
		assert.ok(listToolsAfterLoad >= 1);

		connection.setAgentProfilesSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(listAgentProfilesCalls, listCallsAfterLoad);
		assertAgentsUnknownCapabilityHonesty(section, 1);
		await section.selectProfileByIdForTest('leftover');
		await flushMicrotasks();

		assert.strictEqual(listToolsCalls, listToolsAfterLoad);
		assertAgentsUnknownCapabilityHonesty(section, 1);
		assertAgentsToolsDetailHostLeftoverVisible(section, 1);
	});

	function assertToolsUnknownCapabilityHonesty(
		section: EngineToolsSection,
		expectedRows: number,
	): void {
		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const listContainer = section.getDomNode().querySelector('.engine-catalog-list') as HTMLElement;
		assert.ok(listContainer);
		if (expectedRows > 0) {
			assert.notStrictEqual(listContainer.style.display, 'none');
		}
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(TOOLS_EMPTY_COPY));
	}

	test('Tools: first-pull capability UNKNOWN is empty with capability loading', async () => {
		let listToolsCalls = 0;
		let listAgentProfilesCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'UNKNOWN' } },
			listTools: async () => {
				listToolsCalls++;
				return { tools: [demoBashTool()] };
			},
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [demoToolsUserProfile()] };
			},
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assertToolsUnknownCapabilityHonesty(section, 0);
		assert.strictEqual(listToolsCalls, 0);
		assert.strictEqual(listAgentProfilesCalls, 0);
	});

	test('Tools: successful load then capability UNKNOWN keeps leftover rows and paints capability loading', async () => {
		let listToolsCalls = 0;
		let listAgentProfilesCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => {
				listToolsCalls++;
				return { tools: [demoBashTool()] };
			},
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [demoToolsUserProfile()] };
			},
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const leftoverRows = section.getListEntryCount();
		const listToolsAfterLoad = listToolsCalls;
		const listProfilesAfterLoad = listAgentProfilesCalls;

		connection.setToolsSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(listToolsCalls, listToolsAfterLoad);
		assert.strictEqual(listAgentProfilesCalls, listProfilesAfterLoad);
		assertToolsUnknownCapabilityHonesty(section, leftoverRows);
	});

	function leftoverBashTool() {
		return { name: 'leftover-bash', description: 'shell tool', category: 'shell' };
	}

	function leftoverBashToolInfo(): UniverseAgentToolInfoResult {
		return {
			name: 'leftover-bash',
			description: 'Run leftover command',
			category: 'shell',
			destructive: true,
			requiresPermission: true,
			aliases: ['sh'],
		};
	}

	test('Tools: successful info then list throw then select leftover keeps detail', async () => {
		let listToolsCalls = 0;
		let getToolInfoCalls = 0;
		const leftover = leftoverBashTool();
		const leftoverInfo = leftoverBashToolInfo();
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => {
				listToolsCalls++;
				if (listToolsCalls === 1) {
					return { tools: [leftover] };
				}
				throw new Error('listTools retry exploded');
			},
			listAgentProfiles: async () => ({
				profiles: [demoToolsUserProfile()],
			}),
			getToolInfo: async () => {
				getToolInfoCalls++;
				return leftoverInfo;
			},
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();

		assert.strictEqual(getToolInfoCalls, 1);
		assert.ok((section.getToolInfoDetailText() ?? '').includes('Run leftover command'));
		assert.strictEqual(section.isToolInfoVisible(), true);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listToolsCalls, 2);
		assertToolsLeftoverFailedHonesty(section, 'listTools retry exploded', 1);
		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();

		assert.strictEqual(getToolInfoCalls, 1);
		assertToolsLeftoverFailedHonesty(section, 'listTools retry exploded', 1);
		assert.ok((section.getToolInfoDetailText() ?? '').includes('Run leftover command'));
		assert.strictEqual(section.isToolInfoVisible(), true);
	});

	test('Tools: successful info then capability UNKNOWN then select leftover keeps detail', async () => {
		let listToolsCalls = 0;
		let getToolInfoCalls = 0;
		const leftover = leftoverBashTool();
		const leftoverInfo = leftoverBashToolInfo();
		const connection = createConnectionStub({
			connected: true,
			capabilities: { tools: { support: 'SUPPORTED' } },
			listTools: async () => {
				listToolsCalls++;
				return { tools: [leftover] };
			},
			listAgentProfiles: async () => ({
				profiles: [demoToolsUserProfile()],
			}),
			getToolInfo: async () => {
				getToolInfoCalls++;
				return leftoverInfo;
			},
		});
		const section = mountToolsSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();

		assert.strictEqual(getToolInfoCalls, 1);
		assert.ok((section.getToolInfoDetailText() ?? '').includes('Run leftover command'));
		assert.strictEqual(section.isToolInfoVisible(), true);
		const listCallsAfterLoad = listToolsCalls;

		connection.setToolsSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(listToolsCalls, listCallsAfterLoad);
		assertToolsUnknownCapabilityHonesty(section, 1);
		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();

		assert.strictEqual(getToolInfoCalls, 1);
		assertToolsUnknownCapabilityHonesty(section, 1);
		assert.ok((section.getToolInfoDetailText() ?? '').includes('Run leftover command'));
		assert.strictEqual(section.isToolInfoVisible(), true);
	});

	function demoMcpServer() {
		return {
			id: 'stdio-demo',
			name: 'Demo MCP',
			transport: 'stdio' as const,
			origin: 'global' as const,
			enabled: true,
		};
	}

	function completeMcpAddConfig() {
		return {
			name: 'Added MCP',
			transport: 'stdio' as const,
			command: 'npx',
		};
	}

	function assertMcpWriteFailureKeepsRows(section: EngineMcpSection, reason: string, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), true);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.notStrictEqual(status.style.display, 'none');
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(MCP_FEATURE, reason)));
	}

	test('MCP: add/update/remove ok:false shows write-failure status and keeps catalog rows', async () => {
		let listMcpServersCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			listMcpServers: async () => {
				listMcpServersCalls++;
				return { servers: [demoMcpServer()] };
			},
			addMcpServer: async () => ({ ok: false, reason: 'add denied' }),
			updateMcpServer: async () => ({ ok: false, reason: 'update denied' }),
			removeMcpServer: async () => ({ ok: false, reason: 'remove denied' }),
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(listMcpServersCalls, 1);

		assert.strictEqual(await section.addServer(completeMcpAddConfig()), false);
		assertMcpWriteFailureKeepsRows(section, 'add denied', 1);
		assert.strictEqual(listMcpServersCalls, 1);

		assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);
		assert.strictEqual(await section.updateSelectedServer({ name: 'Renamed' }), false);
		assertMcpWriteFailureKeepsRows(section, 'update denied', 1);
		assert.strictEqual(listMcpServersCalls, 1);

		assert.strictEqual(await section.removeSelectedServer(), false);
		assertMcpWriteFailureKeepsRows(section, 'remove denied', 1);
		assert.strictEqual(listMcpServersCalls, 1);
	});

	test('MCP: add/update/remove throw shows write-failure status and keeps catalog rows', async () => {
		let listMcpServersCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			listMcpServers: async () => {
				listMcpServersCalls++;
				return { servers: [demoMcpServer()] };
			},
			addMcpServer: async () => {
				throw new Error('add exploded');
			},
			updateMcpServer: async () => {
				throw new Error('update exploded');
			},
			removeMcpServer: async () => {
				throw new Error('remove exploded');
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(listMcpServersCalls, 1);

		assert.strictEqual(await section.addServer(completeMcpAddConfig()), false);
		assertMcpWriteFailureKeepsRows(section, 'add exploded', 1);
		assert.strictEqual(listMcpServersCalls, 1);

		assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);
		assert.strictEqual(await section.updateSelectedServer({ name: 'Renamed' }), false);
		assertMcpWriteFailureKeepsRows(section, 'update exploded', 1);
		assert.strictEqual(listMcpServersCalls, 1);

		assert.strictEqual(await section.removeSelectedServer(), false);
		assertMcpWriteFailureKeepsRows(section, 'remove exploded', 1);
		assert.strictEqual(listMcpServersCalls, 1);
	});

	test('MCP: addServer without complete config does not invent echo/mcp-stub and does not send RPC', async () => {
		const addRequests: UniverseAgentAddMcpServerRequest[] = [];
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			listMcpServers: async () => ({ servers: [demoMcpServer()] }),
			addMcpServer: async (request) => {
				addRequests.push(request);
				return { ok: true };
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);

		assert.strictEqual(await section.addServer(), false);
		assert.strictEqual(await section.addServer({ name: '', transport: 'stdio', command: 'echo', args: ['mcp-stub'] }), false);
		assert.strictEqual(await section.addServer({ name: 'x', transport: 'stdio' }), false);
		assert.strictEqual(await section.addServer({ name: 'x', transport: 'stdio', command: '   ' }), false);
		assert.strictEqual(await section.addServer({ name: 'x', transport: 'sse' }), false);
		assert.strictEqual(await section.addServer({ name: 'x', transport: 'streamable_http' }), false);

		assert.deepStrictEqual(addRequests, []);
		const serialized = JSON.stringify(addRequests);
		assert.ok(!/echo/i.test(serialized));
		assert.ok(!/mcp-stub/i.test(serialized));
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		const writeStatus = section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement | null;
		assert.ok(!writeStatus?.textContent || writeStatus.style.display === 'none');
	});

	test('MCP: addMcpServer ok does not keep add-success when subsequent listMcpServers fails', async () => {
		let listMcpServersCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { mcp: { support: 'SUPPORTED' } },
				listMcpServers: async () => {
					listMcpServersCalls++;
					if (listMcpServersCalls > 1) {
						throw new Error('list boom');
					}
					return { servers: [demoMcpServer()] };
				},
				addMcpServer: async () => ({ ok: true }),
			});
			const section = mountMcpSection(connection);
			await flushMicrotasks();
			assert.strictEqual(listMcpServersCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');

			assert.strictEqual(await section.addServer(completeMcpAddConfig()), true);
			assert.ok(listMcpServersCalls >= 2);

			assertMcpWriteSuccessClearedAfterListFail(section, ENGINE_MCP_ADD_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	function assertMcpWriteSuccessClearedAfterListFail(section: EngineMcpSection, successCopy: string, listReason: string): void {
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.canWrite(), false);
		const writeStatus = section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement;
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.textContent, successCopy);
		assert.ok(!(writeStatus.textContent ?? '').includes(successCopy));

		const catalog = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(catalog);
		assert.strictEqual(catalog.dataset['catalogMode'], 'failed');
		assert.ok((catalog.textContent ?? '').includes(getCatalogFailedCopy(MCP_FEATURE, listReason)));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(MCP_EMPTY_COPY));
	}

	test('MCP: updateMcpServer ok does not keep update-success when subsequent listMcpServers fails', async () => {
		let listMcpServersCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { mcp: { support: 'SUPPORTED' } },
				listMcpServers: async () => {
					listMcpServersCalls++;
					if (listMcpServersCalls > 1) {
						throw new Error('list boom');
					}
					return { servers: [demoMcpServer()] };
				},
				updateMcpServer: async () => ({ ok: true }),
			});
			const section = mountMcpSection(connection);
			await flushMicrotasks();
			assert.strictEqual(listMcpServersCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);

			assert.strictEqual(await section.updateSelectedServer({ name: 'Renamed' }), true);
			assert.ok(listMcpServersCalls >= 2);
			assertMcpWriteSuccessClearedAfterListFail(section, ENGINE_MCP_UPDATE_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('MCP: removeMcpServer ok does not keep remove-success when subsequent listMcpServers fails', async () => {
		let listMcpServersCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { mcp: { support: 'SUPPORTED' } },
				listMcpServers: async () => {
					listMcpServersCalls++;
					if (listMcpServersCalls > 1) {
						throw new Error('list boom');
					}
					return { servers: [demoMcpServer()] };
				},
				removeMcpServer: async () => ({ ok: true }),
			});
			const section = mountMcpSection(connection);
			await flushMicrotasks();
			assert.strictEqual(listMcpServersCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.selectServerByIdForTest('stdio-demo'), true);

			assert.strictEqual(await section.removeSelectedServer(), true);
			assert.ok(listMcpServersCalls >= 2);
			assertMcpWriteSuccessClearedAfterListFail(section, ENGINE_MCP_REMOVE_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('MCP: toggleServer ok does not keep toggle-success when subsequent listMcpServers fails', async () => {
		let listMcpServersCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				capabilities: { mcp: { support: 'SUPPORTED' } },
				listMcpServers: async () => {
					listMcpServersCalls++;
					if (listMcpServersCalls > 1) {
						throw new Error('list boom');
					}
					return { servers: [demoMcpServer()] };
				},
				toggleMcpServer: async () => ({ ok: true }),
			});
			const section = mountMcpSection(connection);
			await flushMicrotasks();
			assert.strictEqual(listMcpServersCalls, 1);
			assert.strictEqual(section.getMode(), 'ready');

			await section.toggleServerForTest('stdio-demo', false);
			assert.ok(listMcpServersCalls >= 2);
			assertMcpWriteSuccessClearedAfterListFail(section, ENGINE_MCP_TOGGLE_SUCCESS_COPY, 'list boom');
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('MCP: toggleServer ok:false shows write-failure status and keeps catalog rows', async () => {
		let listMcpServersCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			listMcpServers: async () => {
				listMcpServersCalls++;
				return { servers: [demoMcpServer()] };
			},
			toggleMcpServer: async () => ({ ok: false, reason: 'toggle denied' }),
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(listMcpServersCalls, 1);

		await section.toggleServerForTest('stdio-demo', false);
		assertMcpWriteFailureKeepsRows(section, 'toggle denied', 1);
		assert.ok(listMcpServersCalls >= 2);
	});

	test('MCP: toggleServer throw shows write-failure status and keeps catalog rows', async () => {
		let listMcpServersCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			capabilities: { mcp: { support: 'SUPPORTED' } },
			listMcpServers: async () => {
				listMcpServersCalls++;
				return { servers: [demoMcpServer()] };
			},
			toggleMcpServer: async () => {
				throw new Error('toggle exploded');
			},
		});
		const section = mountMcpSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(listMcpServersCalls, 1);

		await section.toggleServerForTest('stdio-demo', false);
		assertMcpWriteFailureKeepsRows(section, 'toggle exploded', 1);
		assert.ok(listMcpServersCalls >= 2);
	});
});
