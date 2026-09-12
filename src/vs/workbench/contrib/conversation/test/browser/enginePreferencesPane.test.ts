/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	EnginePreferencesPane,
	getEngineTestStatusText,
} from '../../browser/enginePreferencesPane.js';
import { getUnsupportedEnvironmentCopy } from '../../browser/engineSectionChrome.js';
import { createWebUnsupportedCapabilitySnapshot, WEB_UNSUPPORTED_REASON } from '../../../../../platform/universeAgent/browser/webUnsupported.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentConnectionSnapshot,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { getConnectionPhaseStatusBarText, isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { Dimension } from '../../../../../base/browser/dom.js';

const ENGINE_DISCONNECTED_COPY = getConnectionPhaseStatusBarText({ kind: 'disconnected' });
const FAKE_ENGINE_LABELS = ['Local Engine', '127.0.0.1:8080'];

suite('EnginePreferencesPane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(
		connected = false,
		overrides: Partial<IUniverseAgentConnection> = {},
		options: { pairingPending?: boolean; looksLive?: boolean } = {},
	): IUniverseAgentConnection {
		const capabilities = createEmptyCapabilitySnapshot();
		const pairingPending = options.pairingPending ?? false;
		const looksLive = options.looksLive ?? false;
		return {
			_serviceBrand: undefined,
			isEngineConnected: () => connected && (looksLive || !pairingPending),
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getTransportState: () => (connected ? 'ok' : 'idle'),
			getConnectionSnapshot: () => ({
				transport: connected ? 'ok' : 'idle',
				sessionToken: connected ? 'tok' : undefined,
				pairingPending,
				channelAlive: connected,
				sharedFsRootSent: false,
				capabilities,
			}),
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: Event.None,
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
			disconnect: async () => { },
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
			listTools: async () => ({ tools: [] }),
			listModels: async () => ({ models: [] }),
			probeEngine: async () => ({ ok: false as const, reason: 'stub' }),
			...overrides,
		};
	}

	function mountPane(
		connected = false,
		overrides: Partial<IUniverseAgentConnection> = {},
		options: { pairingPending?: boolean; looksLive?: boolean } = {},
	): EnginePreferencesPane {
		return mountPaneWithConnection(createConnectionStub(connected, overrides, options));
	}

	function mountPaneWithConnection(connection: IUniverseAgentConnection): EnginePreferencesPane {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const pane = store.add(instantiationService.createInstance(EnginePreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		return pane;
	}

	function createMutableConnection(options: {
		connected?: boolean;
		pairingPending?: boolean;
		looksLive?: boolean;
	} = {}): IUniverseAgentConnection & {
		setPairingPending(value: boolean): void;
		setConnected(value: boolean): void;
	} {
		let connected = options.connected ?? false;
		let pairingPending = options.pairingPending ?? false;
		const looksLive = options.looksLive ?? false;
		const capabilities = createEmptyCapabilitySnapshot();
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sessionToken: connected ? 'tok' : undefined,
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities,
		});
		const connection = createConnectionStub(true, {
			isEngineConnected: () => connected && (looksLive || !pairingPending),
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
		});
		return Object.assign(connection, {
			setPairingPending(value: boolean) {
				pairingPending = value;
				onDidChangeConnection.fire(snapshot());
			},
			setConnected(value: boolean) {
				connected = value;
				onDidChangeConnection.fire(snapshot());
			},
		});
	}

	function disconnectedBanner(container: HTMLElement): HTMLElement {
		return container.querySelector('.engine-preferences-disconnected-banner') as HTMLElement;
	}

	test('getEngineTestStatusText reuses StatusBar phase copy', () => {
		assert.strictEqual(getEngineTestStatusText(), ENGINE_DISCONNECTED_COPY);
		assert.strictEqual(getEngineTestStatusText({ kind: 'connected', path: 'hubRelay' }), 'Engine · Hub relay');
	});

	test('empty capability snapshot does not throw while constructing the pane', () => {
		const pane = mountPane(false, {
			getCapabilitySnapshot: () => ({}) as UniverseAgentCapabilitySnapshot,
		});
		assert.ok(pane.getDomNode().querySelector('.engine-preferences-title'));
		pane.getDomNode().remove();
	});

	test('pane keeps the Engine heading for screen readers and leads with the section title', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		// The editor header tab paints "Engine"; the pane heading stays only for the a11y tree.
		const title = container.querySelector('h2.engine-preferences-title') as HTMLElement;
		assert.ok(title);
		assert.strictEqual(title.textContent, 'Engine');

		const detailTitle = container.querySelector('.engine-preferences-detail-title') as HTMLElement;
		assert.ok(detailTitle);
		assert.strictEqual(detailTitle.textContent, 'Overview');

		assert.strictEqual(container.querySelector('.engine-empty-welcome'), null);
		const banner = container.querySelector('.engine-preferences-disconnected-copy') as HTMLElement;
		assert.ok(banner);
		assert.strictEqual(banner.textContent, ENGINE_DISCONNECTED_COPY);
		assert.ok(!(container.textContent ?? '').includes('No engines yet'));

		container.remove();
	});

	test('layout under 600px applies is-narrow and Back returns to nav', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		pane.layout(new Dimension(599, 800));
		assert.ok(container.classList.contains('is-narrow'));
		assert.ok(!container.classList.contains('is-compact'));
		assert.ok(container.classList.contains('is-showing-detail'));
		const back = container.querySelector('.engine-preferences-back') as HTMLButtonElement;
		assert.ok(back);
		assert.strictEqual(back.hidden, false);

		back.click();
		assert.ok(!container.classList.contains('is-showing-detail'));
		assert.strictEqual(back.hidden, true);

		pane.layout(new Dimension(299, 800));
		assert.ok(container.classList.contains('is-narrow'));
		assert.ok(container.classList.contains('is-compact'));

		pane.layout(new Dimension(600, 800));
		assert.ok(!container.classList.contains('is-narrow'));
		assert.ok(!container.classList.contains('is-compact'));
		assert.ok(!container.classList.contains('is-showing-detail'));

		container.remove();
	});

	test('disconnected pane keeps twelve-section navigation with zero catalog rows and zero write buttons', async () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();
		pane.layout(new Dimension(900, 800));
		await new Promise(resolve => setTimeout(resolve, 0));

		const navLabels = [...container.querySelectorAll('.engine-preferences-nav-label')].map(el => el.textContent);
		assert.strictEqual(navLabels.length, 12);
		assert.ok(navLabels.includes('Triggers'));
		assert.ok(navLabels.includes('Clipboard'));
		assert.ok(navLabels.includes('Context Variables'));

		pane.selectSection('skills');
		const selectedNavLabel = container.querySelector('.engine-preferences-nav-row.selected .engine-preferences-nav-label');
		assert.strictEqual(selectedNavLabel?.textContent, 'Skills', 'nav selection follows the active section');
		const skillsSection = container.querySelector('.engine-skills-section') as HTMLElement;
		assert.ok(skillsSection);
		assert.strictEqual(skillsSection.style.display, '');
		assert.strictEqual(skillsSection.querySelectorAll('.engine-skill-row').length, 0);
		const writeToolbar = skillsSection.querySelector('.engine-catalog-write-toolbar') as HTMLElement | null;
		if (writeToolbar) {
			assert.strictEqual(writeToolbar.style.display, 'none');
		}

		const combined = container.textContent ?? '';
		assert.ok(!/Engine is connected\./.test(combined), 'pane must not wash disconnect into connected');
		assert.ok(!/copilot/i.test(combined), 'pane must not mention Copilot');
		assert.ok(!/open chat/i.test(combined), 'pane must not mention Open Chat');
		assert.ok(!/sync/i.test(combined.toLowerCase()), 'pane must not claim synced catalog when disconnected');

		container.remove();
	});

	test('pane has no chat widgets or editable engine fields', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		assert.strictEqual(container.querySelector('.chat-widget'), null);
		assert.strictEqual(container.querySelector('.chat-setup'), null);
		assert.strictEqual(container.querySelector('.engine-field-row'), null);
		assert.strictEqual(container.querySelector('.engine-field-input'), null);
		assert.ok(!/\(command:/.test(container.innerHTML), 'pane must not include command buttons');

		container.remove();
	});

	test('pane does not seed fake engine rows', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();
		const combined = container.textContent ?? '';

		for (const label of FAKE_ENGINE_LABELS) {
			assert.ok(!combined.includes(label), `pane must not seed fake ${label} row`);
		}

		container.remove();
	});

	test('Test Engine click probes the engine instead of echoing phase only', async () => {
		let probed = false;
		const pane = mountPane(false, {
			probeEngine: async () => {
				probed = true;
				return { ok: false as const, reason: 'Engine is not connected.' };
			},
		});
		const container = pane.getDomNode();

		const testButton = container.querySelector('.engine-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = container.querySelector('.engine-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);
		assert.strictEqual(testStatus.textContent, '');

		testButton.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(probed, true);
		assert.ok(testStatus.textContent?.startsWith('Unreachable —'));
		assert.notStrictEqual(testStatus.textContent, 'Connected');
		assert.notStrictEqual(testStatus.textContent, getEngineTestStatusText());

		container.remove();
	});

	test('Test Engine reachable probe uses Reachable prefix', async () => {
		let probed = false;
		const pane = mountPane(true, {
			probeEngine: async () => {
				probed = true;
				return { ok: true as const, engineIdentityId: 'eng-1' };
			},
		});
		const container = pane.getDomNode();

		const testButton = container.querySelector('.engine-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = container.querySelector('.engine-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);

		testButton.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(probed, true);
		assert.ok(testStatus.textContent?.startsWith('Reachable —'));
		assert.notStrictEqual(testStatus.textContent, 'Connected');

		container.remove();
	});

	test('E2-1: desktop disconnected still draws Test Engine and Engine not connected', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		const testRow = container.querySelector('.engine-test-row') as HTMLElement;
		const testButton = container.querySelector('.engine-test-row .monaco-button') as HTMLButtonElement;
		const banner = container.querySelector('.engine-preferences-disconnected-copy') as HTMLElement;
		assert.ok(testRow);
		assert.ok(testButton);
		assert.notStrictEqual(testRow.style.display, 'none');
		// Test Engine sits under the content as a footer utility, not above the section title.
		assert.strictEqual(container.lastElementChild, testRow);
		assert.strictEqual(banner.textContent, ENGINE_DISCONNECTED_COPY);
		assert.notStrictEqual(banner.textContent, getUnsupportedEnvironmentCopy());
		// A disconnected engine is an ordinary state, so the banner stays a neutral notice.
		assert.ok(!(container.querySelector('.engine-preferences-disconnected-banner') as HTMLElement).classList.contains('is-warning'));
		assert.ok((container.textContent ?? '').includes('Open Connection'));

		container.remove();
	});

	test('E2-1: Web unsupported_environment omits Test Engine and shows named copy', () => {
		const capabilities = createWebUnsupportedCapabilitySnapshot();
		const snapshot: UniverseAgentConnectionSnapshot = {
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities,
		};
		const pane = mountPane(false, {
			getConnectionPhase: () => ({ kind: 'disconnected' }),
			getCapabilitySnapshot: () => capabilities as UniverseAgentCapabilitySnapshot,
			getConnectionSnapshot: () => snapshot,
			connectProfile: async () => ({ ok: false, code: 'unsupported_environment', reason: WEB_UNSUPPORTED_REASON }),
		});
		const container = pane.getDomNode();

		const testRow = container.querySelector('.engine-test-row') as HTMLElement;
		const banner = container.querySelector('.engine-preferences-disconnected-copy') as HTMLElement;
		const bannerTest = [...container.querySelectorAll('.engine-preferences-disconnected-actions .monaco-button')]
			.find(el => (el.textContent ?? '').includes('Test Engine')) as HTMLElement | undefined;

		assert.ok(testRow);
		assert.strictEqual(testRow.style.display, 'none');
		assert.ok(bannerTest);
		assert.strictEqual(bannerTest.style.display, 'none');
		// An environment that cannot host an engine is the exception that earns the warning surface.
		assert.ok((container.querySelector('.engine-preferences-disconnected-banner') as HTMLElement).classList.contains('is-warning'));
		assert.strictEqual(banner.textContent, getUnsupportedEnvironmentCopy());
		assert.strictEqual(getUnsupportedEnvironmentCopy(), '此环境不支持本机 Engine 连接');
		assert.notStrictEqual(banner.textContent, ENGINE_DISCONNECTED_COPY);

		container.remove();
	});

	test('leftover-looks-live pairing-hold still shows disconnected banner', () => {
		const connection = createMutableConnection({ connected: true, pairingPending: true, looksLive: true });
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const pane = mountPaneWithConnection(connection);
		const container = pane.getDomNode();
		const banner = disconnectedBanner(container);
		const copy = container.querySelector('.engine-preferences-disconnected-copy') as HTMLElement;
		const testRow = container.querySelector('.engine-test-row') as HTMLElement;

		assert.ok(banner);
		assert.notStrictEqual(banner.style.display, 'none');
		assert.strictEqual(copy.textContent, getConnectionPhaseStatusBarText({ kind: 'connected', path: 'loopback' }, true));
		assert.strictEqual(copy.textContent, ENGINE_DISCONNECTED_COPY);
		assert.ok(!banner.classList.contains('is-warning'));
		// Chrome only: leftover-looks-live must not hide Test Engine / Open Connection.
		assert.notStrictEqual(testRow.style.display, 'none');
		assert.ok((container.textContent ?? '').includes('Open Connection'));

		container.remove();
	});

	test('pairing-hold with isEngineConnected false still shows disconnected banner', () => {
		const connection = createMutableConnection({ connected: true, pairingPending: true, looksLive: false });
		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const pane = mountPaneWithConnection(connection);
		const container = pane.getDomNode();
		const banner = disconnectedBanner(container);
		const copy = container.querySelector('.engine-preferences-disconnected-copy') as HTMLElement;

		assert.notStrictEqual(banner.style.display, 'none');
		assert.strictEqual(copy.textContent, ENGINE_DISCONNECTED_COPY);

		container.remove();
	});

	test('true connected without pairing hides disconnected banner', () => {
		const pane = mountPane(true);
		const container = pane.getDomNode();
		const banner = disconnectedBanner(container);

		assert.ok(banner);
		assert.strictEqual(banner.style.display, 'none');
		assert.ok(!(container.querySelector('.engine-preferences-disconnected-copy') as HTMLElement).textContent);

		container.remove();
	});

	test('leftover-looks-live then true disconnect still shows disconnected banner', () => {
		const connection = createMutableConnection({ connected: true, pairingPending: false, looksLive: true });
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const pane = mountPaneWithConnection(connection);
		const container = pane.getDomNode();
		const banner = disconnectedBanner(container);
		const copy = container.querySelector('.engine-preferences-disconnected-copy') as HTMLElement;
		assert.strictEqual(banner.style.display, 'none');

		connection.setPairingPending(true);
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.notStrictEqual(banner.style.display, 'none');
		assert.strictEqual(copy.textContent, ENGINE_DISCONNECTED_COPY);

		connection.setConnected(false);
		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'disconnected');
		assert.notStrictEqual(banner.style.display, 'none');
		assert.strictEqual(copy.textContent, ENGINE_DISCONNECTED_COPY);

		container.remove();
	});
});
