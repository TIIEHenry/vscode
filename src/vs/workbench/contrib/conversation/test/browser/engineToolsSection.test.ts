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
	UniverseAgentListToolsResult,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentToolInfoRequest,
	UniverseAgentToolInfoResult,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { EngineToolsSection } from '../../browser/engineToolsSection.js';
import { localize } from '../../../../../nls.js';

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
		listTools?: () => Promise<UniverseAgentListToolsResult>;
		getToolInfo?: (request: UniverseAgentToolInfoRequest) => Promise<UniverseAgentToolInfoResult>;
	} = {}): IUniverseAgentConnection & {
		setConnected(value: boolean): void;
		setPairingPending(value: boolean): void;
		clearGetToolInfo(): void;
	} {
		const toolsCapability = {
			...createEmptyCapabilitySnapshot().tools,
			support: 'SUPPORTED' as const,
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
			saveAgentProfile: async (request) => ({ profile: request.profile }),
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
});
