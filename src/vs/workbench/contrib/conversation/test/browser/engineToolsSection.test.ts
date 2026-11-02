/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getWindow } from '../../../../../base/browser/dom.js';
import { createCatalogSessionContext, createCatalogWorkRoot } from '../common/engineCatalogTestFixtures.js';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentCapabilitySupport,
	UniverseAgentConnectionSnapshot,
	UniverseAgentListAgentProfilesResult,
	UniverseAgentListToolsResult,
	UniverseAgentSaveAgentProfileRequest,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentToolInfoRequest,
	UniverseAgentToolInfoResult,
	UniverseAgentToolSummary,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import type { IAgentWorkRoot } from '../../../../services/agentSession/common/agentWorkRoot.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { getCatalogFailedCopy, getCatalogListLoadingCopy, getCatalogUnknownCopy } from '../../browser/engineCatalog.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { EngineToolsSection } from '../../browser/engineToolsSection.js';
import { localize } from '../../../../../nls.js';

const TOOLS_FEATURE = localize('ua.engineToolsFeatureLabel', "engine tools");

const LEFTOVER_TOOL_INFO_DESC = 'Run leftover command';
const TOOLS_INFO_FAILED_COPY = localize('ua.engineToolsInfoFailed', "Could not load tool details from the engine.");

suite('EngineToolsSection leftover info tone (D414)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function leftoverBashTool() {
		return { name: 'leftover-bash', description: 'shell tool', category: 'shell' };
	}

	function leftoverBashToolInfo(): UniverseAgentToolInfoResult {
		return {
			name: 'leftover-bash',
			description: LEFTOVER_TOOL_INFO_DESC,
			category: 'shell',
			destructive: false,
			requiresPermission: false,
			aliases: [],
		};
	}

	function createConnectionStub(options: {
		connected?: boolean;
		looksLive?: boolean;
		toolsSupport?: UniverseAgentCapabilitySupport;
		listTools?: (request?: { readonly projectPath?: string }) => Promise<UniverseAgentListToolsResult>;
		listAgentProfiles?: (request?: { readonly projectPath?: string }) => Promise<UniverseAgentListAgentProfilesResult>;
		saveAgentProfile?: (request: UniverseAgentSaveAgentProfileRequest) => Promise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>;
		getToolInfo?: (request: UniverseAgentToolInfoRequest) => Promise<UniverseAgentToolInfoResult>;
	} = {}): IUniverseAgentConnection & {
		setConnected(value: boolean): void;
		setPairingPending(value: boolean): void;
		setToolsSupport(support: UniverseAgentCapabilitySupport): void;
		setLinkId(value: number): void;
		setPublishedLink(identity: string | undefined, value: number): void;
		clearGetToolInfo(): void;
	} {
		const toolsCapability = {
			...createEmptyCapabilitySnapshot().tools,
			support: options.toolsSupport ?? 'SUPPORTED',
		};
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			tools: toolsCapability,
		};
		let connected = options.connected ?? true;
		let pairingPending = false;
		const looksLive = options.looksLive ?? false;
		let getToolInfo = options.getToolInfo;
		let linkId = 1;
		let engineIdentityId: string | undefined = 'test-engine';
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();

		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			authenticated: connected,
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities,
			...(connected ? { engineIdentityId, linkId } : {}),
		});

		return {
			_serviceBrand: undefined,
			isEngineConnected: () => connected && (looksLive || !pairingPending),
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
			deleteAgentProfile: async () => ({ ok: true }),
			resetAgentProfile: async () => ({ ok: true }),
			listMcpServers: async () => ({ servers: [] }),
			getMcpServerStatuses: async () => ({ statuses: [] }),
			getMcpServerTools: async () => ({ tools: [] }),
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
			listTools: options.listTools ?? (async () => ({ tools: [leftoverBashTool()] })),
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
			setToolsSupport(support: UniverseAgentCapabilitySupport) {
				toolsCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
			setLinkId(value: number) {
				linkId = value;
			},
			setPublishedLink(identity: string | undefined, value: number) {
				engineIdentityId = identity;
				linkId = value;
				onDidChangeConnection.fire(snapshot());
			},
			clearGetToolInfo() {
				getToolInfo = undefined;
			},
		};
	}

	function mountSection(
		connection: IUniverseAgentConnection,
		sessionContext?: IAgentSessionContext,
		ctor: typeof EngineToolsSection = EngineToolsSection,
	): EngineToolsSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(IAgentSessionContext, sessionContext ?? createCatalogSessionContext());
		const section = store.add(instantiationService.createInstance(ctor, parent));
		section.setSectionActive(true);
		section.layout(640, 160);
		return section;
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	function leftoverInfoStatus(section: EngineToolsSection): HTMLElement {
		const status = section.getDomNode().querySelector('.engine-tools-info-status') as HTMLElement | null;
		assert.ok(status);
		return status;
	}

	function leftoverToolsRowToggles(section: EngineToolsSection): HTMLElement[] {
		return Array.from(section.getDomNode().querySelectorAll('.engine-catalog-row .monaco-custom-toggle'));
	}

	function assertLeftoverToolsRowTogglesClosed(section: EngineToolsSection): void {
		const toggles = leftoverToolsRowToggles(section);
		assert.ok(toggles.length > 0, 'KEEP leftover rows must paint toggle chrome');
		for (const toggle of toggles) {
			assert.strictEqual(toggle.getAttribute('aria-disabled'), 'true');
			assert.ok(toggle.classList.contains('disabled'));
		}
	}

	function assertLeftoverToolsRowTogglesLive(section: EngineToolsSection): void {
		const toggles = leftoverToolsRowToggles(section);
		assert.ok(toggles.length > 0, 'live leftover rows must paint toggle chrome');
		for (const toggle of toggles) {
			assert.notStrictEqual(toggle.getAttribute('aria-disabled'), 'true');
			assert.ok(!toggle.classList.contains('disabled'));
		}
	}

	test('tool name stays on the checkbox line', async () => {
		const connection = createConnectionStub({
			connected: true,
			listTools: async () => ({
				tools: [
					{ name: 'circle_invite', description: 'Invite someone', category: 'social' },
					{ name: 'sys_memory_info', description: 'Memory usage', category: 'SYSTEM' },
					{ name: 'yaml_process', description: 'Process YAML', category: 'DATA_PROCESSING' },
					{ name: 'sys_tool_search' },
					{ name: 'blank-desc', description: '  ', category: '  ' },
				],
			}),
		});
		const section = mountSection(connection);
		await flushMicrotasks();
		section.layout(640, 400);

		const rows = [...section.getDomNode().querySelectorAll('.monaco-list-row')] as HTMLElement[];
		const heights = rows.map(row => row.style.height);
		assert.ok(heights.length > 0);
		assert.ok(heights.every(height => height === '24px'));
		for (const row of rows) {
			assert.notStrictEqual(row.style.lineHeight, '48px');
		}

		const described = rows.find(row => row.textContent?.includes('circle_invite'));
		assert.ok(described);
		const description = described!.querySelector('.engine-catalog-description') as HTMLElement;
		assert.strictEqual(description.style.display, '');
		assert.strictEqual(description.textContent, 'Social — Invite someone');

		const system = rows.find(row => row.textContent?.includes('sys_memory_info'));
		assert.ok(system);
		assert.strictEqual(system!.querySelector('.engine-catalog-description')?.textContent, 'System — Memory usage');

		const dataProcessing = rows.find(row => row.textContent?.includes('yaml_process'));
		assert.ok(dataProcessing);
		assert.strictEqual(dataProcessing!.querySelector('.engine-catalog-description')?.textContent, 'Data Processing — Process YAML');

		for (const name of ['sys_tool_search', 'blank-desc']) {
			const plain = rows.find(row => row.querySelector('.engine-catalog-name')?.textContent === name);
			assert.ok(plain, name);
			assert.strictEqual(plain!.style.height, '24px');
			assert.strictEqual((plain!.querySelector('.engine-catalog-description') as HTMLElement).style.display, 'none');
		}
	});

	test('leftover getToolInfo throw keeps detail and paints info-status error', async () => {
		let getToolInfoCalls = 0;
		const connection = createConnectionStub({
			getToolInfo: async (request) => {
				getToolInfoCalls++;
				if (getToolInfoCalls === 1) {
					return leftoverBashToolInfo();
				}
				throw new Error('getToolInfo exploded');
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();
		assert.ok((section.getToolInfoDetailText() ?? '').includes(LEFTOVER_TOOL_INFO_DESC));

		connection.setConnected(true);
		await flushMicrotasks();

		const detail = section.getToolInfoDetailText() ?? '';
		assert.ok(detail.includes(LEFTOVER_TOOL_INFO_DESC));
		assert.ok(detail.includes(TOOLS_INFO_FAILED_COPY));
		assert.deepStrictEqual([...leftoverInfoStatus(section).classList], ['engine-tools-info-status', 'is-error']);
	});

	test('leftover pairing-hold keeps detail and paints info-status error', async () => {
		const connection = createConnectionStub({
			getToolInfo: async () => leftoverBashToolInfo(),
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();
		assert.ok((section.getToolInfoDetailText() ?? '').includes(LEFTOVER_TOOL_INFO_DESC));

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();

		assert.ok((section.getToolInfoDetailText() ?? '').includes(LEFTOVER_TOOL_INFO_DESC));
		assert.ok((section.getToolInfoDetailText() ?? '').includes(getEngineSectionDisconnectedCopy()));
		assert.deepStrictEqual([...leftoverInfoStatus(section).classList], ['engine-tools-info-status', 'is-error']);
	});

	test('pairing-hold refresh closes leftover row toggle chrome without reselect', async () => {
		const leftover = leftoverBashTool();
		const connection = createConnectionStub({
			getToolInfo: async () => leftoverBashToolInfo(),
		});
		const section = mountSection(connection);
		await flushMicrotasks();
		section.layout(640, 160);

		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();
		assert.strictEqual(section.canWrite(), true);
		assert.strictEqual(section.isSaveToolbarVisible(), true);
		assertLeftoverToolsRowTogglesLive(section);
		assert.strictEqual(section.getSelectedToolName(), 'leftover-bash');

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(section.getSelectedToolName(), 'leftover-bash');
		assert.strictEqual(section.canWrite(), false);
		assert.strictEqual(section.isSaveToolbarVisible(), false);
		assertLeftoverToolsRowTogglesClosed(section);
		assert.strictEqual(await section.toggleTool(leftover, false), false);
		assert.strictEqual(await section.savePendingEnablement(), false);
	});

	test('leftover-looks-live refresh closes leftover row toggle chrome without reselect', async () => {
		const leftover = leftoverBashTool();
		const connection = createConnectionStub({
			looksLive: true,
			getToolInfo: async () => leftoverBashToolInfo(),
		});
		const section = mountSection(connection);
		await flushMicrotasks();
		section.layout(640, 160);

		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();
		assert.strictEqual(section.canWrite(), true);
		assert.strictEqual(section.isSaveToolbarVisible(), true);
		assertLeftoverToolsRowTogglesLive(section);
		assert.strictEqual(section.getSelectedToolName(), 'leftover-bash');

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(section.getSelectedToolName(), 'leftover-bash');
		assert.strictEqual(section.canWrite(), false);
		assert.strictEqual(section.isSaveToolbarVisible(), false);
		assertLeftoverToolsRowTogglesClosed(section);
		assert.strictEqual(await section.toggleTool(leftover, false), false);
		assert.strictEqual(await section.savePendingEnablement(), false);
	});

	test('pairing-hold refresh paints leftover info honesty without reselect', async () => {
		const connection = createConnectionStub({
			getToolInfo: async () => leftoverBashToolInfo(),
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();
		assert.ok((section.getToolInfoDetailText() ?? '').includes(LEFTOVER_TOOL_INFO_DESC));
		assert.ok(!(section.getToolInfoDetailText() ?? '').includes(getEngineSectionDisconnectedCopy()));

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.ok((section.getToolInfoDetailText() ?? '').includes(LEFTOVER_TOOL_INFO_DESC));
		assert.ok((section.getToolInfoDetailText() ?? '').includes(getEngineSectionDisconnectedCopy()));
		assert.deepStrictEqual([...leftoverInfoStatus(section).classList], ['engine-tools-info-status', 'is-error']);
	});

	test('leftover-looks-live refresh paints leftover info honesty without reselect', async () => {
		const connection = createConnectionStub({
			looksLive: true,
			getToolInfo: async () => leftoverBashToolInfo(),
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();
		assert.ok((section.getToolInfoDetailText() ?? '').includes(LEFTOVER_TOOL_INFO_DESC));
		assert.ok(!(section.getToolInfoDetailText() ?? '').includes(getEngineSectionDisconnectedCopy()));

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.ok((section.getToolInfoDetailText() ?? '').includes(LEFTOVER_TOOL_INFO_DESC));
		assert.ok((section.getToolInfoDetailText() ?? '').includes(getEngineSectionDisconnectedCopy()));
		assert.deepStrictEqual([...leftoverInfoStatus(section).classList], ['engine-tools-info-status', 'is-error']);
	});

	test('leftover missing getToolInfo keeps detail and paints info-status error', async () => {
		const connection = createConnectionStub({
			getToolInfo: async () => leftoverBashToolInfo(),
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();
		assert.ok((section.getToolInfoDetailText() ?? '').includes(LEFTOVER_TOOL_INFO_DESC));

		connection.clearGetToolInfo();
		connection.setConnected(true);
		await flushMicrotasks();

		const detail = section.getToolInfoDetailText() ?? '';
		assert.ok(detail.includes(LEFTOVER_TOOL_INFO_DESC));
		assert.ok(detail.includes('does not expose'));
		assert.deepStrictEqual([...leftoverInfoStatus(section).classList], ['engine-tools-info-status', 'is-error']);
	});

	test('first-pull capability UNKNOWN is empty with capability loading', async () => {
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			toolsSupport: 'UNKNOWN',
			listTools: async () => {
				listToolsCalls++;
				return { tools: [leftoverBashTool()] };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.canWrite(), false);
		assert.strictEqual(listToolsCalls, 0, 'first-pull UNKNOWN must not listTools');
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
	});

	test('capability UNKNOWN leftover closes leftover row toggle chrome without reselect', async () => {
		const leftover = leftoverBashTool();
		const saveCalls: UniverseAgentSaveAgentProfileRequest[] = [];
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			getToolInfo: async () => leftoverBashToolInfo(),
			listTools: async () => {
				listToolsCalls++;
				return { tools: [leftover] };
			},
			saveAgentProfile: async (request) => {
				saveCalls.push(request);
				return { profile: request.profile };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();
		section.layout(640, 160);

		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedToolName(), 'leftover-bash');
		assert.strictEqual(section.canWrite(), true);
		assert.strictEqual(section.isSaveToolbarVisible(), true);
		assertLeftoverToolsRowTogglesLive(section);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listToolsCalls;

		connection.setToolsSupport('UNKNOWN');
		await flushMicrotasks();

		assert.strictEqual(listToolsCalls, listCallsAfterLoad, 'UNKNOWN leftover must not extra listTools');
		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), leftoverRows);
		assert.strictEqual(section.getSelectedToolName(), 'leftover-bash');
		assert.strictEqual(section.canWrite(), false);
		assert.strictEqual(section.isSaveToolbarVisible(), false);
		assertLeftoverToolsRowTogglesClosed(section);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!(status.textContent ?? '').includes(getCatalogListLoadingCopy()));
		assert.strictEqual(await section.toggleTool(leftover, false), false);
		assert.strictEqual(await section.savePendingEnablement(), false);
		assert.deepStrictEqual(saveCalls, []);
	});

	test('list-fail leftover closes leftover row toggle chrome without reselect', async () => {
		const leftover = leftoverBashTool();
		const saveCalls: UniverseAgentSaveAgentProfileRequest[] = [];
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			getToolInfo: async () => leftoverBashToolInfo(),
			listTools: async () => {
				listToolsCalls++;
				if (listToolsCalls === 1) {
					return { tools: [leftover] };
				}
				throw new Error('listTools retry exploded');
			},
			saveAgentProfile: async (request) => {
				saveCalls.push(request);
				return { profile: request.profile };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();
		section.layout(640, 160);

		assert.strictEqual(section.selectTool('leftover-bash'), true);
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedToolName(), 'leftover-bash');
		assert.strictEqual(section.canWrite(), true);
		assert.strictEqual(section.isSaveToolbarVisible(), true);
		assertLeftoverToolsRowTogglesLive(section);
		const leftoverRows = section.getListEntryCount();

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listToolsCalls, 2);
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), leftoverRows);
		assert.strictEqual(section.getSelectedToolName(), 'leftover-bash');
		assert.strictEqual(section.canWrite(), false);
		assert.strictEqual(section.isSaveToolbarVisible(), false);
		assertLeftoverToolsRowTogglesClosed(section);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(TOOLS_FEATURE, 'listTools retry exploded')));
		assert.strictEqual(await section.toggleTool(leftover, false), false);
		assert.strictEqual(await section.savePendingEnablement(), false);
		assert.deepStrictEqual(saveCalls, []);
	});

	test('does not leak unhandled rejection when refresh catch-path render throws and onUnexpectedError warn-then-rethrows', async () => {
		// refresh() already catches list throw; a lone inner reject does not leak.
		// The void call site still needs `.catch` when the catch-path render throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			const connection = createConnectionStub({
				listTools: async () => {
					throw new Error('list boom');
				},
			});
			const section = mountSection(connection);
			const status = (section as unknown as { status: { render(options: { readonly mode: string }): void } }).status;
			const originalRender = status.render.bind(status);
			status.render = (options: { readonly mode: string }) => {
				if (options.mode === 'failed') {
					throw paintBoom;
				}
				originalRender(options);
			};
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('does not leak unhandled rejection when loadToolInfo catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		// loadToolInfo() already catches getToolInfo throw; a lone inner reject does not leak.
		// The void call site still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			const connection = createConnectionStub({
				getToolInfo: async () => {
					throw new Error('getToolInfo boom');
				},
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			const infoHost = section.getDomNode().querySelector('.engine-tools-info') as HTMLElement | null;
			assert.ok(infoHost);
			Object.defineProperty(infoHost, 'textContent', {
				configurable: true,
				get: () => '',
				set: (value: string) => {
					if (value) {
						throw paintBoom;
					}
				},
			});
			assert.strictEqual(section.selectTool('leftover-bash'), true);
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('does not leak unhandled rejection when savePendingEnablement catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		// savePendingEnablement() already catches saveAgentProfile throw; a lone inner reject does not leak.
		// The void Save click still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			const leftover = leftoverBashTool();
			const connection = createConnectionStub({
				saveAgentProfile: async () => {
					throw new Error('saveAgentProfile exploded');
				},
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			section.layout(640, 160);
			assert.strictEqual(section.canWrite(), true);
			section.setPendingEnablement(leftover, false);
			assert.strictEqual(section.isToolEnablementDirty(), true);
			assert.strictEqual(section.isSaveToolbarVisible(), true);
			const saveFailed = localize('ua.engineToolsSaveFailed', "Unable to save: {0}", 'saveAgentProfile exploded');
			const writeStatus = section.getDomNode().querySelector('.engine-catalog-write-status') as HTMLElement;
			assert.ok(writeStatus);
			Object.defineProperty(writeStatus, 'textContent', {
				configurable: true,
				get: () => '',
				set: (value: string) => {
					if (value === saveFailed) {
						throw paintBoom;
					}
				},
			});
			const saveButton = Array.from(section.getDomNode().querySelectorAll('.monaco-button'))
				.find(button => (button.textContent ?? '').includes('Save')) as HTMLElement | undefined;
			assert.ok(saveButton, 'Save write button must be painted');
			saveButton.click();
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
	test('switching active session or work root triggers list refresh with projectPath', async () => {
		const listToolsRequests: Array<{ readonly projectPath?: string } | undefined> = [];
		const listProfilesRequests: Array<{ readonly projectPath?: string } | undefined> = [];

		const onDidChangeActiveSession = store.add(new Emitter<string>());
		const onDidChangeActiveWorkRoot = store.add(new Emitter<IAgentWorkRoot>());

		let currentWorkRoot: IAgentWorkRoot = createCatalogWorkRoot('/workspace/initial');

		const sessionContext = createCatalogSessionContext({
			getActiveSessionId: () => currentWorkRoot.sessionId,
			getActiveWorkRoot: () => currentWorkRoot,
			onDidChangeActiveSession: onDidChangeActiveSession.event,
			onDidChangeActiveWorkRoot: onDidChangeActiveWorkRoot.event,
		});

		const connection = createConnectionStub({
			listTools: async (request) => {
				listToolsRequests.push(request);
				return { tools: [leftoverBashTool()] };
			},
			listAgentProfiles: async (request) => {
				listProfilesRequests.push(request);
				return { profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' }] };
			},
		});

		const section = mountSection(connection, sessionContext);
		await flushMicrotasks();

		assert.strictEqual(listToolsRequests.length, 1);
		assert.deepStrictEqual(listToolsRequests[0], { projectPath: '/workspace/initial' });
		assert.strictEqual(listProfilesRequests.length, 1);
		assert.deepStrictEqual(listProfilesRequests[0], { projectPath: '/workspace/initial' });

		// 1. Change active session
		currentWorkRoot = createCatalogWorkRoot('/workspace/session-2', 'sess-2');
		onDidChangeActiveSession.fire('sess-2');
		await flushMicrotasks();

		assert.strictEqual(listToolsRequests.length, 2);
		assert.deepStrictEqual(listToolsRequests[1], { projectPath: '/workspace/session-2' });
		assert.strictEqual(listProfilesRequests.length, 2);
		assert.deepStrictEqual(listProfilesRequests[1], { projectPath: '/workspace/session-2' });

		// 2. Change active work root
		currentWorkRoot = createCatalogWorkRoot('/workspace/workroot-change', 'sess-2');
		onDidChangeActiveWorkRoot.fire(currentWorkRoot);
		await flushMicrotasks();

		assert.strictEqual(listToolsRequests.length, 3);
		assert.deepStrictEqual(listToolsRequests[2], { projectPath: '/workspace/workroot-change' });
		assert.strictEqual(listProfilesRequests.length, 3);
		assert.deepStrictEqual(listProfilesRequests[2], { projectPath: '/workspace/workroot-change' });

		// 3. Change work root to empty
		currentWorkRoot = createCatalogWorkRoot('', 'sess-2');
		onDidChangeActiveWorkRoot.fire(currentWorkRoot);
		await flushMicrotasks();

		assert.strictEqual(listToolsRequests.length, 4);
		assert.strictEqual(listToolsRequests[3], undefined);
		assert.strictEqual(listProfilesRequests.length, 4);
		assert.strictEqual(listProfilesRequests[3], undefined);

		section.getDomNode().parentElement?.remove();
	});

	test('toggleTool rejects the write when the engine link changes during the round trip', async () => {
		const leftover = leftoverBashTool();
		const connection = createConnectionStub({
			saveAgentProfile: async (request) => {
				connection.setLinkId(2);
				return { profile: request.profile };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.canWrite(), true);
		assert.strictEqual(await section.toggleTool(leftover, false), false);
	});

	test('save stays valid when a same-profile refresh lands mid-save', async () => {
		const leftover = leftoverBashTool();
		let releaseSave!: () => void;
		const connection = createConnectionStub({
			saveAgentProfile: (request) => new Promise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>(resolve => {
				releaseSave = () => resolve({ profile: request.profile });
			}),
		});
		const section = mountSection(connection);
		await flushMicrotasks();
		section.setPendingEnablement(leftover, false);
		assert.strictEqual(section.isToolEnablementDirty(), true);

		const savePromise = section.savePendingEnablement();
		// A refresh with the same profile id must not retarget the in-flight save.
		connection.setConnected(true);
		await flushMicrotasks();

		releaseSave();
		assert.strictEqual(await savePromise, true);
	});

	test('a list refresh issued before a save lands cannot repaint the saved enablement', async () => {
		const leftover = leftoverBashTool();
		let releaseSave!: () => void;
		let releaseList!: (value: UniverseAgentListToolsResult) => void;
		let listToolsCalls = 0;
		const connection = createConnectionStub({
			listTools: () => {
				listToolsCalls++;
				if (listToolsCalls === 1) {
					return Promise.resolve({ tools: [leftover] });
				}
				return new Promise<UniverseAgentListToolsResult>(resolve => { releaseList = resolve; });
			},
			saveAgentProfile: (request) => new Promise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>(resolve => {
				releaseSave = () => resolve({ profile: request.profile });
			}),
		});
		const section = mountSection(connection);
		await flushMicrotasks();
		section.layout(640, 160);
		section.setPendingEnablement(leftover, false);

		const savePromise = section.savePendingEnablement();
		// Refresh starts while the save RPC is still in flight.
		connection.setConnected(true);
		await flushMicrotasks();

		releaseSave();
		assert.strictEqual(await savePromise, true);

		// The pre-save list returns afterwards: it must not repaint the saved state.
		releaseList({ tools: [leftover] });
		await flushMicrotasks();

		const toggles = leftoverToolsRowToggles(section);
		assert.strictEqual(toggles[0]?.getAttribute('aria-checked'), 'false', 'stale list must not repaint the saved enablement');
	});
	function selectProfile(section: EngineToolsSection, id: string): HTMLSelectElement {
		const select = section.getDomNode().querySelector('select');
		assert.ok(select);
		const index = Array.from(select.options).findIndex(option => option.text === id);
		assert.ok(index >= 0, `Profile ${id} must be present`);
		select.selectedIndex = index;
		select.dispatchEvent(new (getWindow(select).Event)('change', { bubbles: true }));
		return select;
	}

	function rowState(section: EngineToolsSection): Array<{ checked: string | null; disabled: string | null }> {
		return leftoverToolsRowToggles(section).map(toggle => ({
			checked: toggle.getAttribute('aria-checked'),
			disabled: toggle.getAttribute('aria-disabled'),
		}));
	}

	function profiles(): UniverseAgentListAgentProfilesResult {
		return { profiles: [
			{ id: 'a', name: 'a', source: 'user', disabledTools: [] },
			{ id: 'b', name: 'b', source: 'user', disabledTools: ['leftover-bash'] },
		] };
	}

	test('the first deferred catalog replays the layout supplied before its real WorkbenchList exists', async () => {
		const listed = new DeferredPromise<UniverseAgentListToolsResult>();
		const connection = createConnectionStub({ listTools: () => listed.p });
		const section = mountSection(connection);
		const readList = () => section['list'];
		assert.strictEqual(readList(), undefined);
		assert.strictEqual(section.getMode(), 'loading');
		await listed.complete({ tools: [leftoverBashTool()] });
		await flushMicrotasks();
		// No post-load layout: this is the preferences pane's layout-before-RPC path.
		assert.deepStrictEqual(rowState(section), [{ checked: 'true', disabled: 'false' }]);
		const list = readList();
		assert.ok(list);
		assert.strictEqual(list.renderHeight, 160);
		assert.strictEqual(list.contentHeight, 2 * 24);
	});

	test('fixed-height rows paint initial, pending and profile state immediately without moving focus or reloading detail', async () => {
		const infoCalls: string[] = [];
		const connection = createConnectionStub({
			listAgentProfiles: async () => profiles(),
			getToolInfo: async request => {
				infoCalls.push(request.toolName);
				return leftoverBashToolInfo();
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();
		assert.deepStrictEqual(rowState(section), [{ checked: 'true', disabled: 'false' }]);
		section.selectTool(leftoverBashTool().name);
		await flushMicrotasks();
		const toggle = leftoverToolsRowToggles(section)[0];
		toggle.focus();
		toggle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true }));
		assert.deepStrictEqual({ rows: rowState(section), focused: document.activeElement === toggle, selected: section.getSelectedToolName(), infoCalls }, {
			rows: [{ checked: 'false', disabled: 'false' }], focused: true, selected: 'leftover-bash', infoCalls: ['leftover-bash'],
		});
		const select = selectProfile(section, 'b');
		select.focus();
		section.setPendingEnablement(leftoverBashTool(), true);
		assert.deepStrictEqual({ rows: rowState(section), focused: document.activeElement === select, infoCalls }, {
			rows: [{ checked: 'true', disabled: 'false' }], focused: true, infoCalls: ['leftover-bash'],
		});
		selectProfile(section, 'a');
		assert.strictEqual(rowState(section)[0].checked, 'false');
	});

	test('ordinary refresh rebases each profile draft and commits ready state before painting fixed-height rows', async () => {
		let listed = profiles();
		const connection = createConnectionStub({ listAgentProfiles: async () => listed });
		const section = mountSection(connection);
		await flushMicrotasks();
		section.setPendingEnablement(leftoverBashTool(), false);
		selectProfile(section, 'b');
		section.setPendingEnablement(leftoverBashTool(), true);
		connection.setConnected(true);
		assertLeftoverToolsRowTogglesClosed(section);
		await flushMicrotasks();
		assert.deepStrictEqual({ rows: rowState(section), dirty: section.isToolEnablementDirty(), mode: section.getMode() }, {
			rows: [{ checked: 'true', disabled: 'false' }], dirty: true, mode: 'ready',
		});
		selectProfile(section, 'a');
		assert.strictEqual(rowState(section)[0].checked, 'false');
		listed = { profiles: profiles().profiles.map(profile => ({ ...profile, disabledTools: profile.id === 'a' ? ['leftover-bash'] : [] })) };
		connection.setConnected(true);
		await flushMicrotasks();
		assert.strictEqual(section.isToolEnablementDirty(), false, 'equal baseline makes an unreserved override redundant');
		selectProfile(section, 'b');
		assert.deepStrictEqual({ dirty: section.isToolEnablementDirty(), checked: rowState(section)[0].checked }, { dirty: false, checked: 'true' });
	});

	test('same-profile refresh preserves submitted and late edits until the save settles against its returned baseline', async () => {
		const saved = new DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>();
		let request!: UniverseAgentSaveAgentProfileRequest;
		const connection = createConnectionStub({ saveAgentProfile: value => { request = value; return saved.p; } });
		const section = mountSection(connection);
		await flushMicrotasks();
		section.setPendingEnablement(leftoverBashTool(), false);
		const operation = section.savePendingEnablement();
		section.setPendingEnablement(leftoverBashTool(), true);
		connection.setConnected(true);
		await flushMicrotasks();
		assert.strictEqual(section.isToolEnablementDirty(), true, 'late edit equal to old baseline cannot be discarded while a save is pending');
		await saved.complete({ profile: request.profile });
		assert.strictEqual(await operation, true);
		assert.deepStrictEqual({ checked: rowState(section)[0].checked, dirty: section.isToolEnablementDirty() }, { checked: 'true', dirty: true });
	});

	for (const fails of [false, true]) {
		test(`a successful save retires stale List ${fails ? 'failure' : 'success'} and its loading mode`, async () => {
			const saved = new DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>();
			const listed = new DeferredPromise<UniverseAgentListToolsResult>();
			let request!: UniverseAgentSaveAgentProfileRequest;
			let listCalls = 0;
			const connection = createConnectionStub({
				listTools: () => ++listCalls === 1 ? Promise.resolve({ tools: [leftoverBashTool()] }) : listed.p,
				saveAgentProfile: value => { request = value; return saved.p; },
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			section.setPendingEnablement(leftoverBashTool(), false);
			const operation = section.savePendingEnablement();
			connection.setConnected(true);
			assert.strictEqual(section.getMode(), 'loading');
			await saved.complete({ profile: request.profile });
			assert.strictEqual(await operation, true);
			if (fails) {
				await listed.error(new Error('old List failed'));
			} else {
				await listed.complete({ tools: [leftoverBashTool()] });
			}
			await flushMicrotasks();
			assert.deepStrictEqual({ mode: section.getMode(), rows: rowState(section), dirty: section.isToolEnablementDirty(), listCalls }, {
				mode: 'ready', rows: [{ checked: 'false', disabled: 'false' }], dirty: false, listCalls: 2,
			});
		});
	}

	for (const resultId of ['', 'another-profile']) {
		test(`invalid save result '${resultId}' keeps the draft and can be retried`, async () => {
			let valid = false;
			const connection = createConnectionStub({ saveAgentProfile: async request => ({ profile: { ...request.profile, id: valid ? request.profile.id : resultId } }) });
			const section = mountSection(connection);
			await flushMicrotasks();
			section.setPendingEnablement(leftoverBashTool(), false);
			assert.strictEqual(await section.savePendingEnablement(), false);
			assert.deepStrictEqual({ dirty: section.isToolEnablementDirty(), checked: rowState(section)[0].checked }, { dirty: true, checked: 'false' });
			valid = true;
			assert.strictEqual(await section.savePendingEnablement(), true);
			assert.strictEqual(section.isToolEnablementDirty(), false);
		});
	}

	test('save paints returned enablement rather than assuming the submitted value was accepted', async () => {
		const connection = createConnectionStub({ saveAgentProfile: async request => ({ profile: { ...request.profile, disabledTools: [], enabledTools: [], whitelistMode: false } }) });
		const section = mountSection(connection);
		await flushMicrotasks();
		section.setPendingEnablement(leftoverBashTool(), false);
		assert.strictEqual(await section.savePendingEnablement(), true);
		assert.deepStrictEqual({ rows: rowState(section), dirty: section.isToolEnablementDirty() }, {
			rows: [{ checked: 'true', disabled: 'false' }], dirty: false,
		});
	});

	for (const bFirst of [false, true]) {
		test(`A1 and B1 reserve their own target until RPC settlement (B first: ${bFirst})`, async () => {
			const calls: Array<{ request: UniverseAgentSaveAgentProfileRequest; result: DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }> }> = [];
			const connection = createConnectionStub({
				listAgentProfiles: async () => profiles(),
				saveAgentProfile: request => {
					const result = new DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>();
					calls.push({ request, result });
					return result.p;
				},
			});
			const section = mountSection(connection);
			await flushMicrotasks();
			section.setPendingEnablement(leftoverBashTool(), false);
			const a1 = section.savePendingEnablement();
			selectProfile(section, 'b');
			section.setPendingEnablement(leftoverBashTool(), true);
			const b1 = section.savePendingEnablement();
			selectProfile(section, 'a');
			assert.strictEqual(await section.savePendingEnablement(), false);
			assert.strictEqual(await section.toggleTool(leftoverBashTool(), true), false);
			assert.strictEqual(calls.length, 2, 'returning to A must not create A2 while A1 is pending');
			if (bFirst) {
				await calls[1].result.complete({ profile: calls[1].request.profile });
				assert.strictEqual(await b1, false, 'B result must not act on selected A');
				assert.strictEqual(await section.savePendingEnablement(), false, 'B finally cannot release A reservation');
			}
			await calls[0].result.complete({ profile: calls[0].request.profile });
			assert.strictEqual(await a1, true, 'A→B→A keeps original A authorization');
			section.setPendingEnablement(leftoverBashTool(), true);
			const a2 = section.savePendingEnablement();
			assert.strictEqual(calls.length, 3);
			if (!bFirst) {
				await calls[1].result.complete({ profile: calls[1].request.profile });
				assert.strictEqual(await b1, false);
				assert.strictEqual(await section.savePendingEnablement(), false, 'old B finally cannot release A2');
			}
			await calls[2].result.complete({ profile: calls[2].request.profile });
			assert.strictEqual(await a2, true);
		});
	}

	test('a save settling while B remains selected retires only A and does not leave A permanently busy', async () => {
		const saved = new DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>();
		let request!: UniverseAgentSaveAgentProfileRequest;
		let calls = 0;
		const connection = createConnectionStub({ listAgentProfiles: async () => profiles(), saveAgentProfile: value => {
			calls++;
			request = value;
			return calls === 1 ? saved.p : Promise.resolve({ profile: value.profile });
		} });
		const section = mountSection(connection);
		await flushMicrotasks();
		section.setPendingEnablement(leftoverBashTool(), false);
		const operation = section.savePendingEnablement();
		selectProfile(section, 'b');
		const before = section.getDomNode().innerHTML;
		await saved.complete({ profile: request.profile });
		assert.strictEqual(await operation, false);
		assert.strictEqual(section.getDomNode().innerHTML, before, 'old A settlement must not repaint B');
		selectProfile(section, 'a');
		assert.strictEqual(await section.savePendingEnablement(), true);
		assert.strictEqual(calls, 2);
	});

	for (const failure of [false, true]) {
		for (const transition of ['profile', 'link', 'root', 'dispose'] as const) {
			test(`late save ${failure ? 'failure' : 'success'} does not paint changed ${transition} scope`, async () => {
				const saved = new DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>();
				let request!: UniverseAgentSaveAgentProfileRequest;
				let workRoot = createCatalogWorkRoot('/old');
				const changedRoot = store.add(new Emitter<IAgentWorkRoot>());
				const connection = createConnectionStub({ listAgentProfiles: async () => profiles(), saveAgentProfile: value => { request = value; return saved.p; } });
				const section = mountSection(connection, createCatalogSessionContext({ getActiveWorkRoot: () => workRoot, onDidChangeActiveWorkRoot: changedRoot.event }));
				await flushMicrotasks();
				section.setPendingEnablement(leftoverBashTool(), false);
				const operation = section.savePendingEnablement();
				if (transition === 'profile') {
					selectProfile(section, 'b');
				} else if (transition === 'link') {
					connection.setPublishedLink('test-engine', 2);
				} else if (transition === 'root') {
					workRoot = createCatalogWorkRoot('/new');
					changedRoot.fire(workRoot);
				} else {
					section.dispose();
				}
				await flushMicrotasks();
				const presentation = () => ({ rows: rowState(section), profile: section.getActiveProfileId(), dirty: section.isToolEnablementDirty(), status: section.getDomNode().querySelector('.engine-catalog-write-status')?.textContent });
				const before = presentation();
				if (failure) {
					await saved.error(new Error('old scope error'));
				} else {
					await saved.complete({ profile: request.profile });
				}
				assert.strictEqual(await operation, false);
				assert.deepStrictEqual(presentation(), before);
			});
		}
	}

	for (const identity of [undefined, 'test-engine'] as const) {
		test(`reservation survives reconnection and anonymous identity changes (initial identity: ${identity})`, async () => {
			const saved = new DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>();
			let request!: UniverseAgentSaveAgentProfileRequest;
			let calls = 0;
			const connection = createConnectionStub({ saveAgentProfile: value => {
				calls++;
				request = value;
				return calls === 1 ? saved.p : Promise.resolve({ profile: value.profile });
			} });
			connection.setPublishedLink(identity, 1);
			const section = mountSection(connection);
			await flushMicrotasks();
			section.setPendingEnablement(leftoverBashTool(), false);
			const operation = section.savePendingEnablement();
			connection.setPublishedLink(identity === undefined ? 'test-engine' : undefined, 2);
			await flushMicrotasks();
			section.setPendingEnablement(leftoverBashTool(), false);
			assert.strictEqual(await section.savePendingEnablement(), false);
			assert.strictEqual(calls, 1);
			await saved.complete({ profile: request.profile });
			assert.strictEqual(await operation, false);
			assert.strictEqual(await section.savePendingEnablement(), true);
			assert.strictEqual(calls, 2);
		});
	}

	test('profile removal retires display authority without releasing its pending RPC reservation', async () => {
		let listed = profiles();
		const saved = new DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>();
		let request!: UniverseAgentSaveAgentProfileRequest;
		const connection = createConnectionStub({ listAgentProfiles: async () => listed, saveAgentProfile: value => { request = value; return saved.p; } });
		const section = mountSection(connection);
		await flushMicrotasks();
		selectProfile(section, 'b');
		section.setPendingEnablement(leftoverBashTool(), true);
		selectProfile(section, 'a');
		section.setPendingEnablement(leftoverBashTool(), false);
		const operation = section.savePendingEnablement();
		listed = { profiles: profiles().profiles.filter(profile => profile.id === 'b') };
		connection.setConnected(true);
		await flushMicrotasks();
		assert.strictEqual(section.getActiveProfileId(), undefined);
		assertLeftoverToolsRowTogglesClosed(section);
		selectProfile(section, 'b');
		assert.strictEqual(section.isToolEnablementDirty(), true, 'removing A must not discard B draft');
		listed = profiles();
		connection.setConnected(true);
		await flushMicrotasks();
		selectProfile(section, 'a');
		section.setPendingEnablement(leftoverBashTool(), false);
		assert.strictEqual(await section.savePendingEnablement(), false, 'relisted A cannot bypass the original RPC reservation');
		await saved.complete({ profile: request.profile });
		assert.strictEqual(await operation, false);
	});

	test('large fixed-height lists preserve scroll, checkbox focus and one listener when rows are recycled', async () => {
		class ObservedEngineToolsSection extends EngineToolsSection {
			readonly pendingUpdates: Array<{ name: string; enabled: boolean }> = [];

			override setPendingEnablement(tool: UniverseAgentToolSummary, enabled: boolean): void {
				this.pendingUpdates.push({ name: tool.name, enabled });
				super.setPendingEnablement(tool, enabled);
			}
		}
		const tools = Array.from({ length: 120 }, (_, index) => ({ name: `tool-${index}`, category: 'shell' }));
		const calls: UniverseAgentSaveAgentProfileRequest[] = [];
		const connection = createConnectionStub({ listTools: async () => ({ tools }), saveAgentProfile: async request => { calls.push(request); return { profile: request.profile }; } });
		const section = mountSection(connection, undefined, ObservedEngineToolsSection);
		assert.ok(section instanceof ObservedEngineToolsSection);
		await flushMicrotasks();
		const pendingUpdates = section.pendingUpdates;
		for (let refresh = 0; refresh < 3; refresh++) {
			connection.setConnected(true);
			await flushMicrotasks();
		}
		assert.deepStrictEqual(pendingUpdates, [], 'repainting rows cannot invoke the pending edit handler');
		const list = section['list'];
		assert.ok(list);
		list.scrollTop = 24 * 40;
		await timeout(30);
		const rows = section.getDomNode().querySelectorAll<HTMLElement>('.engine-catalog-row');
		assert.ok(rows.length > 0 && rows.length < tools.length, 'real WorkbenchList must remain virtualized');
		const row = rows[Math.floor(rows.length / 2)];
		const name = row.querySelector('.engine-catalog-name')?.textContent;
		const tool = tools.find(entry => entry.name === name);
		assert.ok(tool);
		const toggle = row.querySelector<HTMLElement>('.monaco-custom-toggle');
		assert.ok(toggle);
		toggle.focus();
		const scrollTop = list.scrollTop;
		toggle.dispatchEvent(new (getWindow(toggle).KeyboardEvent)('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true }));
		assert.deepStrictEqual(pendingUpdates, [{ name: tool.name, enabled: false }], 'one Space must enter the original pending edit handler exactly once');
		assert.deepStrictEqual({ focused: document.activeElement === toggle, scrollTop: list.scrollTop, checked: toggle.getAttribute('aria-checked') }, { focused: true, scrollTop, checked: 'false' });
		assert.strictEqual(await section.savePendingEnablement(), true);
		assert.deepStrictEqual(calls.map(request => request.profile.disabledTools), [[tool.name]]);
		list.scrollTop = 0;
		await timeout(30);
		assert.strictEqual(leftoverToolsRowToggles(section)[0].getAttribute('aria-checked'), 'true', 'reused row cannot retain another tool checkbox value');
		const recycledRow = section.getDomNode().querySelector<HTMLElement>('.engine-catalog-row');
		assert.ok(recycledRow);
		const recycledName = recycledRow.querySelector('.engine-catalog-name')?.textContent;
		assert.ok(recycledName);
		const recycledToggle = recycledRow.querySelector<HTMLElement>('.monaco-custom-toggle');
		assert.ok(recycledToggle);
		recycledToggle.click();
		assert.deepStrictEqual(pendingUpdates, [{ name: tool.name, enabled: false }, { name: recycledName, enabled: false }], 'one click on a recycled row must enter the original pending edit handler exactly once');
		assert.strictEqual(recycledToggle.getAttribute('aria-checked'), 'false', 'the observed original handler must still apply the edit');
		assert.strictEqual(list.contentHeight, (tools.length + 1) * 24);
	});

	for (const transition of ['same-engine-link', 'workroot'] as const) {
		test(`same backend reservation survives ${transition} and updates only derived busy chrome when retired`, async () => {
			const saved = new DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>();
			let request!: UniverseAgentSaveAgentProfileRequest;
			let calls = 0;
			let workRoot = createCatalogWorkRoot('/old');
			const changedRoot = store.add(new Emitter<IAgentWorkRoot>());
			const connection = createConnectionStub({ saveAgentProfile: value => {
				calls++;
				request = value;
				return calls === 1 ? saved.p : Promise.resolve({ profile: value.profile });
			} });
			const section = mountSection(connection, createCatalogSessionContext({ getActiveWorkRoot: () => workRoot, onDidChangeActiveWorkRoot: changedRoot.event }));
			await flushMicrotasks();
			section.setPendingEnablement(leftoverBashTool(), false);
			const operation = section.savePendingEnablement();
			if (transition === 'same-engine-link') {
				connection.setPublishedLink('test-engine', 2);
			} else {
				workRoot = createCatalogWorkRoot('/new');
				changedRoot.fire(workRoot);
			}
			await flushMicrotasks();
			section.setPendingEnablement(leftoverBashTool(), false);
			assert.strictEqual(await section.savePendingEnablement(), false);
			const button = section.getDomNode().querySelector('.engine-catalog-write-toolbar .monaco-button');
			assert.strictEqual(button?.getAttribute('aria-busy'), 'true');
			await saved.complete({ profile: request.profile });
			assert.strictEqual(await operation, false);
			assert.deepStrictEqual({ busy: button?.getAttribute('aria-busy'), dirty: section.isToolEnablementDirty(), checked: rowState(section)[0].checked, calls }, {
				busy: 'false', dirty: true, checked: 'false', calls: 1,
			});
			assert.strictEqual(await section.savePendingEnablement(), true);
			assert.strictEqual(calls, 2);
		});
	}

	test('distinct identified engines may save the same profile without an old finally releasing the new reservation', async () => {
		const calls: Array<{ request: UniverseAgentSaveAgentProfileRequest; result: DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }> }> = [];
		const connection = createConnectionStub({ saveAgentProfile: request => {
			const result = new DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>();
			calls.push({ request, result });
			return result.p;
		} });
		const section = mountSection(connection);
		await flushMicrotasks();
		section.setPendingEnablement(leftoverBashTool(), false);
		const old = section.savePendingEnablement();
		connection.setPublishedLink('another-engine', 2);
		await flushMicrotasks();
		section.setPendingEnablement(leftoverBashTool(), false);
		const current = section.savePendingEnablement();
		assert.strictEqual(calls.length, 2);
		await calls[0].result.complete({ profile: calls[0].request.profile });
		assert.strictEqual(await old, false);
		assert.strictEqual(await section.savePendingEnablement(), false);
		assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-write-toolbar .monaco-button')?.getAttribute('aria-busy'), 'true');
		await calls[1].result.complete({ profile: calls[1].request.profile });
		assert.strictEqual(await current, true);
		assert.strictEqual(section.getDomNode().querySelector('.engine-catalog-write-toolbar .monaco-button')?.getAttribute('aria-busy'), 'false');
	});

	test('immediate toggle shares the save reservation and a rejection preserves late edits for retry', async () => {
		const saved = new DeferredPromise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>();
		let calls = 0;
		const connection = createConnectionStub({ saveAgentProfile: request => {
			calls++;
			return calls === 1 ? saved.p : Promise.resolve({ profile: request.profile });
		} });
		const section = mountSection(connection);
		await flushMicrotasks();
		const operation = section.toggleTool(leftoverBashTool(), false);
		section.setPendingEnablement(leftoverBashTool(), true);
		assert.strictEqual(await section.savePendingEnablement(), false);
		assert.strictEqual(await section.toggleTool(leftoverBashTool(), true), false);
		assert.strictEqual(calls, 1);
		await saved.error(new Error('write failed'));
		assert.strictEqual(await operation, false);
		assert.deepStrictEqual({ checked: rowState(section)[0].checked, dirty: section.isToolEnablementDirty(), busy: section.getDomNode().querySelector('.engine-catalog-write-toolbar .monaco-button')?.getAttribute('aria-busy') }, {
			checked: 'true', dirty: true, busy: 'false',
		});
		assert.ok(section.getDomNode().querySelector('.engine-catalog-write-status')?.textContent?.includes('write failed'));
		assert.strictEqual(await section.savePendingEnablement(), true);
		assert.strictEqual(calls, 2);
	});

	for (const transition of ['engine', 'link'] as const) {
		for (const failure of [false, true]) {
			test(`ToolInfo ${failure ? 'error' : 'success'} from an old ${transition} cannot paint while the new same-name List is pending`, async () => {
				const oldInfo = new DeferredPromise<UniverseAgentToolInfoResult>();
				const nextList = new DeferredPromise<UniverseAgentListToolsResult>();
				let listCalls = 0;
				let infoCalls = 0;
				const connection = createConnectionStub({
					listTools: () => ++listCalls === 1 ? Promise.resolve({ tools: [leftoverBashTool()] }) : nextList.p,
					getToolInfo: () => ++infoCalls === 1 ? oldInfo.p : Promise.resolve({ ...leftoverBashToolInfo(), description: 'new scope detail' }),
				});
				const section = mountSection(connection);
				await flushMicrotasks();
				section.selectTool('leftover-bash');
				assert.strictEqual(infoCalls, 1);
				connection.setPublishedLink(transition === 'engine' ? 'other-engine' : 'test-engine', 2);
				const before = section.getToolInfoDetailText();
				if (failure) {
					await oldInfo.error(new Error('old info error'));
				} else {
					await oldInfo.complete({ ...leftoverBashToolInfo(), description: 'old scope detail' });
				}
				await flushMicrotasks();
				assert.deepStrictEqual({ detail: section.getToolInfoDetailText(), infoCalls, mode: section.getMode() }, { detail: before, infoCalls: 1, mode: 'loading' });
				await nextList.complete({ tools: [leftoverBashTool()] });
				await flushMicrotasks();
				assert.ok(section.getToolInfoDetailText()?.includes('new scope detail'));
				assert.strictEqual(infoCalls, 2);
			});
		}
	}

	for (const transition of ['workroot', 'source', 'roundtrip'] as const) {
		for (const failure of [false, true]) {
			test(`ToolInfo ${failure ? 'error' : 'success'} cannot revive after ${transition} changes`, async () => {
				const oldInfo = new DeferredPromise<UniverseAgentToolInfoResult>();
				const lists: Array<DeferredPromise<UniverseAgentListToolsResult>> = [];
				let workRoot = createCatalogWorkRoot('/a');
				const originalRoot = workRoot;
				const changedRoot = store.add(new Emitter<IAgentWorkRoot>());
				let listCalls = 0;
				let infoCalls = 0;
				const connection = createConnectionStub({
					listTools: () => {
						if (++listCalls === 1) {
							return Promise.resolve({ tools: [leftoverBashTool()] });
						}
						const listed = new DeferredPromise<UniverseAgentListToolsResult>();
						lists.push(listed);
						return listed.p;
					},
					getToolInfo: () => ++infoCalls === 1 ? oldInfo.p : Promise.resolve({ ...leftoverBashToolInfo(), description: 'current source detail' }),
				});
				const section = mountSection(connection, createCatalogSessionContext({ getActiveWorkRoot: () => workRoot, onDidChangeActiveWorkRoot: changedRoot.event }));
				await flushMicrotasks();
				section.selectTool('leftover-bash');
				workRoot = transition === 'source' ? { ...workRoot, source: 'connection' } : createCatalogWorkRoot('/b');
				changedRoot.fire(workRoot);
				if (transition === 'roundtrip') {
					workRoot = originalRoot;
					changedRoot.fire(workRoot);
				}
				const before = section.getToolInfoDetailText();
				if (failure) {
					await oldInfo.error(new Error('old source info error'));
				} else {
					await oldInfo.complete({ ...leftoverBashToolInfo(), description: 'old source detail' });
				}
				await flushMicrotasks();
				assert.deepStrictEqual({ detail: section.getToolInfoDetailText(), infoCalls }, { detail: before, infoCalls: 1 });
				for (const listed of lists) {
					await listed.complete({ tools: [leftoverBashTool()] });
				}
				await flushMicrotasks();
				assert.ok(section.getToolInfoDetailText()?.includes('current source detail'));
				assert.strictEqual(infoCalls, 2);
			});
		}
	}

	test('a same-scope List pending does not cancel legitimate ToolInfo or add RPCs for row repaints', async () => {
		const info = new DeferredPromise<UniverseAgentToolInfoResult>();
		const listed = new DeferredPromise<UniverseAgentListToolsResult>();
		let listCalls = 0;
		let infoCalls = 0;
		const connection = createConnectionStub({
			listTools: () => ++listCalls === 1 ? Promise.resolve({ tools: [leftoverBashTool()] }) : listed.p,
			getToolInfo: () => { infoCalls++; return info.p; },
		});
		const section = mountSection(connection);
		await flushMicrotasks();
		section.selectTool('leftover-bash');
		section.setPendingEnablement(leftoverBashTool(), false);
		section.setPendingEnablement(leftoverBashTool(), true);
		assert.strictEqual(infoCalls, 1);
		connection.setConnected(true);
		await info.complete({ ...leftoverBashToolInfo(), description: 'same scope legitimate detail' });
		await flushMicrotasks();
		assert.ok(section.getToolInfoDetailText()?.includes('same scope legitimate detail'));
		assert.strictEqual(infoCalls, 1);
		await listed.complete({ tools: [leftoverBashTool()] });
		await flushMicrotasks();
		assert.strictEqual(infoCalls, 2, 'completed catalog refresh may explicitly update detail once');
	});

	for (const failure of [false, true]) {
		test(`disposed ToolInfo ${failure ? 'error' : 'success'} has no DOM effect`, async () => {
			const info = new DeferredPromise<UniverseAgentToolInfoResult>();
			const connection = createConnectionStub({ getToolInfo: () => info.p });
			const section = mountSection(connection);
			await flushMicrotasks();
			section.selectTool('leftover-bash');
			section.dispose();
			const before = section.getDomNode().innerHTML;
			if (failure) {
				await info.error(new Error('disposed info error'));
			} else {
				await info.complete(leftoverBashToolInfo());
			}
			await flushMicrotasks();
			assert.strictEqual(section.getDomNode().innerHTML, before);
		});
	}

});
