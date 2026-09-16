/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentCapabilitySupport,
	UniverseAgentConnectionSnapshot,
	UniverseAgentListToolsResult,
	UniverseAgentSaveAgentProfileRequest,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentToolInfoRequest,
	UniverseAgentToolInfoResult,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
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
		listTools?: () => Promise<UniverseAgentListToolsResult>;
		saveAgentProfile?: (request: UniverseAgentSaveAgentProfileRequest) => Promise<{ profile: UniverseAgentSaveAgentProfileRequest['profile'] }>;
		getToolInfo?: (request: UniverseAgentToolInfoRequest) => Promise<UniverseAgentToolInfoResult>;
	} = {}): IUniverseAgentConnection & {
		setConnected(value: boolean): void;
		setPairingPending(value: boolean): void;
		setToolsSupport(support: UniverseAgentCapabilitySupport): void;
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
			listAgentProfiles: async () => ({
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }],
			}),
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
			clearGetToolInfo() {
				getToolInfo = undefined;
			},
		};
	}

	function mountSection(connection: IUniverseAgentConnection): EngineToolsSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineToolsSection, parent));
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
});
