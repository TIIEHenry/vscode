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
	UniverseAgentConnectionSnapshot,
	UniverseAgentCapabilitySnapshot,
	UniverseAgentListSkillsResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { EngineSkillsSection } from '../../browser/engineSkillsSection.js';
import { getCatalogFailedCopy, getCatalogListLoadingCopy, getCatalogUnknownCopy } from '../../browser/engineCatalog.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { getSkillsUnsupportedCopy } from '../../browser/engineSkillCatalog.js';
import { localize } from '../../../../../nls.js';

const SKILLS_FEATURE = localize('ua.engineSkillsFeatureLabel', "a skills API");
const SKILLS_EMPTY_COPY = localize('ua.engineSkillsEmpty', "No skills yet.");
const LEFTOVER_SKILL_BODY = '# Leftover skill body';
const INFLIGHT_LIVE_SKILL_BODY = '# Inflight live skill body';

suite('EngineSkillsSection (E1)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		skillsSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		looksLive?: boolean;
		listSkills?: () => Promise<UniverseAgentListSkillsResult>;
		getSkillInfo?: (request: { skillName: string }) => Promise<{ name: string; content: string; source: 'bundled' | 'user' | 'project' | 'unknown'; enabled: boolean }>;
		saveSkillContent?: (request: UniverseAgentSaveSkillContentRequest) => Promise<{ ok: boolean }>;
		setSkillEnabled?: (request: { skillName: string; enabled: boolean }) => Promise<{ ok: boolean }>;
	} = {}): IUniverseAgentConnection & {
		setConnected(value: boolean): void;
		setPairingPending(value: boolean): void;
		setPairingPendingQuiet(value: boolean): void;
		setLooksLive(value: boolean): void;
		setSkillsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'): void;
	} {
		const skillsCapability: { support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'; reason: string } = {
			support: options.skillsSupport ?? 'UNSUPPORTED',
			reason: 'UNIMPLEMENTED',
		};
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			skills: skillsCapability,
		};
		let connected = options.connected ?? false;
		let pairingPending = false;
		let looksLive = options.looksLive ?? false;
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
			listSkills: options.listSkills ?? (async () => ({
				skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
			})),
			setSkillEnabled: options.setSkillEnabled ?? (async () => ({ ok: true })),
			getSkillInfo: options.getSkillInfo ?? (async () => ({ name: 'demo-skill', content: '# Demo', source: 'bundled', enabled: true })),
			saveSkillContent: options.saveSkillContent ?? (async () => ({ ok: true })),
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
			setConnected(value: boolean) {
				connected = value;
				onDidChangeConnection.fire(snapshot());
			},
			setPairingPending(value: boolean) {
				pairingPending = value;
				onDidChangeConnection.fire(snapshot());
			},
			setPairingPendingQuiet(value: boolean) {
				pairingPending = value;
			},
			setLooksLive(value: boolean) {
				looksLive = value;
			},
			setSkillsSupport(support: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN') {
				skillsCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
		};
	}

	function mountSection(connection: IUniverseAgentConnection): EngineSkillsSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineSkillsSection, parent));
		section.layout(640, 400);
		return section;
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	function assertSkillsFailedHonesty(section: EngineSkillsSection, errorMessage: string, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(SKILLS_FEATURE, errorMessage)));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(SKILLS_EMPTY_COPY));
	}

	function assertSkillsLeftoverFailedHonesty(section: EngineSkillsSection, errorMessage: string, expectedRows: number): void {
		assertSkillsFailedHonesty(section, errorMessage, expectedRows);
		const listContainer = section.getDomNode().querySelector('.engine-skills-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
	}

	function assertSkillsLeftoverUnknownHonesty(section: EngineSkillsSection, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!status.textContent?.includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(SKILLS_EMPTY_COPY));
		const listContainer = section.getDomNode().querySelector('.engine-skills-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
	}

	function assertSkillsLeftoverPairingHonesty(section: EngineSkillsSection, expectedRows: number): void {
		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), expectedRows);
		assert.strictEqual(section.canWrite(), false);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(SKILLS_EMPTY_COPY));
		const listContainer = section.getDomNode().querySelector('.engine-skills-list') as HTMLElement;
		assert.ok(listContainer);
		assert.notStrictEqual(listContainer.style.display, 'none');
	}

	test('disconnected hides skills section (§8.3 #5 honest empty)', async () => {
		const connection = createConnectionStub({ connected: false, skillsSupport: 'SUPPORTED' });
		const section = mountSection(connection);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getDomNode().style.display, 'none');
		assert.strictEqual(section.getListEntryCount(), 0);
	});

	test('UNSUPPORTED shows honest message without fake skill names (§8.3 #6)', async () => {
		const connection = createConnectionStub({ connected: true, skillsSupport: 'UNSUPPORTED' });
		const section = mountSection(connection);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(section.getMode(), 'unsupported');
		assert.strictEqual(section.getListEntryCount(), 0);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.ok(status.textContent?.includes(getSkillsUnsupportedCopy('UNIMPLEMENTED')));
		assert.ok(!/copilot/i.test(section.getDomNode().textContent ?? ''));
	});

	test('disconnect clears RPC catalog rows (§8.3 #5)', async () => {
		const connection = createConnectionStub({ connected: true, skillsSupport: 'SUPPORTED' });
		const section = mountSection(connection);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);

		connection.setConnected(false);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.getDomNode().style.display, 'none');
	});

	test('connected phase with pairingPending keeps leftover catalog and paints not-connected', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listSkillsCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assertSkillsLeftoverPairingHonesty(section, leftoverRows);

		connection.setConnected(false);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
	});

	test('leftover-looks-live pairing-hold writes stay 0 unary', async () => {
		const saveCalls: UniverseAgentSaveSkillContentRequest[] = [];
		const toggleCalls: Array<{ skillName: string; enabled: boolean }> = [];
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'leftover-skill', source: 'user', enabled: true }] };
			},
			saveSkillContent: async (request) => {
				saveCalls.push(request);
				return { ok: true };
			},
			setSkillEnabled: async (request) => {
				toggleCalls.push(request);
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listSkillsCalls;
		assert.strictEqual(section.canWrite(), true);
		connection.setLooksLive(true);
		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assert.strictEqual(section.getListEntryCount(), leftoverRows);
		assert.strictEqual(section.canWrite(), false);
		assert.strictEqual(section.isWriteToolbarVisible(), false);
		assert.strictEqual(await section.createSkill({ skillName: 'should-not-create', content: '# Nope' }), false);
		await section.toggleSkillForTest('leftover-skill', false);
		assert.deepStrictEqual(saveCalls, []);
		assert.deepStrictEqual(toggleCalls, []);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
	});

	test('listSkills reject is failed with error status and no leftover catalog', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				throw new Error('listSkills exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assertSkillsFailedHonesty(section, 'listSkills exploded', 0);
		assert.ok(!/demo-skill/i.test(section.getDomNode().textContent ?? ''));
	});

	test('successful load then refresh throw keeps leftover catalog and paints failed', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				if (listSkillsCalls === 1) {
					return { skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] };
				}
				throw new Error('listSkills retry exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listSkillsCalls, 2);
		assertSkillsLeftoverFailedHonesty(section, 'listSkills retry exploded', 1);
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();
		assertSkillsLeftoverFailedHonesty(section, 'listSkills retry exploded', 1);
		assert.strictEqual(section.getSelectedSkillBody(), '');
	});

	test('successful load then capability UNKNOWN keeps leftover rows and paints capability loading', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);
		const listCallsAfterLoad = listSkillsCalls;

		connection.setSkillsSupport('UNKNOWN');
		await flushMicrotasks();

		assertSkillsLeftoverUnknownHonesty(section, 1);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assertSkillsLeftoverUnknownHonesty(section, 1);
		assert.strictEqual(section.getSelectedSkillBody(), '');
	});

	test('first fetch capability UNKNOWN is empty with capability loading', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'UNKNOWN',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'loading');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(listSkillsCalls, 0);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!status.textContent?.includes(getCatalogListLoadingCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(SKILLS_EMPTY_COPY));
		assert.ok(!/demo-skill/i.test(section.getDomNode().textContent ?? ''));
	});

	test('SUPPORTED connected shows New toolbar and createSkill calls saveSkillContent RPC', async () => {
		let saveCalled = false;
		let savedSkillName = '';
		let savedContent = '';
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [
					{ name: 'demo-skill', source: 'bundled', enabled: true },
					...(savedSkillName ? [{ name: savedSkillName, source: 'user' as const, enabled: true }] : []),
				],
			}),
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: savedContent || '# New',
				source: request.skillName === 'demo-skill' ? 'bundled' : 'user',
				enabled: true,
			}),
			saveSkillContent: async (request) => {
				saveCalled = true;
				savedSkillName = request.skillName;
				savedContent = request.content;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.canWrite(), true);
		assert.strictEqual(section.isWriteToolbarVisible(), true);

		const ok = await section.createSkill({ skillName: 'my-new-skill', content: '# My New Skill\n\nBody.' });
		assert.ok(saveCalled);
		assert.strictEqual(savedSkillName, 'my-new-skill');
		assert.strictEqual(savedContent, '# My New Skill\n\nBody.');
		assert.strictEqual(ok, true);
	});

	test('disconnected createSkill does not call saveSkillContent RPC', async () => {
		let saveCalled = false;
		const connection = createConnectionStub({
			connected: false,
			skillsSupport: 'SUPPORTED',
			saveSkillContent: async () => {
				saveCalled = true;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		const ok = await section.createSkill({ skillName: 'should-not-create', content: '# Nope' });
		assert.strictEqual(saveCalled, false);
		assert.strictEqual(ok, false);
		assert.strictEqual(section.isWriteToolbarVisible(), false);
	});

	test('createSkill ok:false paints write-status and does not add a fake row', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
			},
			saveSkillContent: async () => ({ ok: false }),
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
		const listCallsAfterLoad = listSkillsCalls;

		const ok = await section.createSkill({ skillName: 'should-not-appear', content: '# Nope' });
		assert.strictEqual(ok, false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assert.ok(!/should-not-appear/i.test(section.getDomNode().textContent ?? ''));

		const createFailed = localize('ua.engineSkillCreateFailed', "Could not create skill content on the engine.");
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(bodyStatus);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(createFailed));
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(createFailed));
	});

	test('toggleSkill ok:false paints write-status and keeps catalog', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
			}),
			setSkillEnabled: async () => ({ ok: false }),
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');

		await section.toggleSkillForTest('demo-skill', false);

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');

		const toggleFailed = localize('ua.engineSkillToggleFailed', "Could not update skill enablement on the engine.");
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(toggleFailed));
	});

	test('toggleSkill throw paints write-status and keeps catalog', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
			}),
			setSkillEnabled: async () => {
				throw new Error('setSkillEnabled exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');

		await section.toggleSkillForTest('demo-skill', false);

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');

		const toggleFailed = localize('ua.engineSkillToggleFailed', "Could not update skill enablement on the engine.");
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(toggleFailed));
	});

	test('toggleSkill success does not keep toggle-success when subsequent listSkills fails', async () => {
		let listSkillsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => {
					listSkillsCalls++;
					if (listSkillsCalls > 1) {
						throw new Error('listSkills exploded');
					}
					return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
				},
				setSkillEnabled: async () => ({ ok: true }),
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();

			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);

			await section.toggleSkillForTest('demo-skill', false);
			await flushMicrotasks();

			assert.ok(listSkillsCalls >= 2);
			const toggleSuccess = localize('ua.engineSkillToggleSuccess', "Updated.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			assert.ok(!(writeStatus.textContent ?? '').includes(toggleSuccess));

			assertSkillsLeftoverFailedHonesty(section, 'listSkills exploded', 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('toggleSkill success still shows toggle-success when subsequent getSkillInfo fails', async () => {
		let getSkillInfoCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => ({
					skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
				}),
				getSkillInfo: async (request) => {
					getSkillInfoCalls++;
					if (getSkillInfoCalls > 1) {
						throw new Error('getSkillInfo exploded');
					}
					return {
						name: request.skillName,
						content: '# Demo',
						source: 'bundled',
						enabled: true,
					};
				},
				setSkillEnabled: async () => ({ ok: true }),
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();

			section.selectSkillForTest('demo-skill');
			await flushMicrotasks();
			assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
			assert.ok(getSkillInfoCalls >= 1);

			await section.toggleSkillForTest('demo-skill', false);
			await flushMicrotasks();

			assert.ok(getSkillInfoCalls >= 2);
			const toggleSuccess = localize('ua.engineSkillToggleSuccess', "Updated.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			assert.notStrictEqual(writeStatus.style.display, 'none');
			assert.ok(writeStatus.textContent?.includes(toggleSuccess));
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('createSkill success does not keep create-success when subsequent listSkills fails', async () => {
		let listSkillsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => {
					listSkillsCalls++;
					if (listSkillsCalls > 1) {
						throw new Error('listSkills exploded');
					}
					return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
				},
				saveSkillContent: async () => ({ ok: true }),
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();

			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);

			await section.createSkill({ skillName: 'my-new-skill', content: '# My New Skill\n\nBody.' });
			await flushMicrotasks();

			assert.ok(listSkillsCalls >= 2);
			const createSuccess = localize('ua.engineSkillCreateSuccess', "Created.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			assert.ok(!(writeStatus.textContent ?? '').includes(createSuccess));

			assertSkillsLeftoverFailedHonesty(section, 'listSkills exploded', 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('createSkill throw paints write-status and does not add a fake row', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
			},
			saveSkillContent: async () => {
				throw new Error('saveSkillContent exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
		const listCallsAfterLoad = listSkillsCalls;

		const ok = await section.createSkill({ skillName: 'should-not-appear', content: '# Nope' });
		assert.strictEqual(ok, false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assert.ok(!/should-not-appear/i.test(section.getDomNode().textContent ?? ''));

		const createFailed = localize('ua.engineSkillCreateFailed', "Could not create skill content on the engine.");
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(bodyStatus);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(createFailed));
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(createFailed));
	});

	test('saveSelectedSkillBody ok:false paints write-status and keeps catalog', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'user-skill', source: 'user', enabled: true }] };
			},
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: '# Original',
				source: 'user',
				enabled: true,
			}),
			saveSkillContent: async () => ({ ok: false }),
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('user-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
		const listCallsAfterLoad = listSkillsCalls;

		const ok = await section.saveSelectedSkillBody('# should-not-persist');
		assert.strictEqual(ok, false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);

		const saveFailed = localize('ua.engineSkillBodySaveFailed', "Could not save skill content to the engine.");
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(bodyStatus);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(saveFailed));
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(saveFailed));
	});

	test('saveSelectedSkillBody throw paints write-status and keeps catalog', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'user-skill', source: 'user', enabled: true }] };
			},
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: '# Original',
				source: 'user',
				enabled: true,
			}),
			saveSkillContent: async () => {
				throw new Error('saveSkillContent exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('user-skill');
		await flushMicrotasks();
		assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
		const listCallsAfterLoad = listSkillsCalls;

		const ok = await section.saveSelectedSkillBody('# should-not-persist');
		assert.strictEqual(ok, false);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);

		const saveFailed = localize('ua.engineSkillBodySaveFailed', "Could not save skill content to the engine.");
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
		assert.ok(bodyStatus);
		assert.notStrictEqual(bodyStatus.style.display, 'none');
		assert.ok(bodyStatus.textContent?.includes(saveFailed));
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.style.display, 'none');
		assert.ok(writeStatus.textContent?.includes(saveFailed));
	});

	test('saveSelectedSkillBody success does not keep save-success when subsequent listSkills fails', async () => {
		let listSkillsCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => {
					listSkillsCalls++;
					if (listSkillsCalls > 1) {
						throw new Error('listSkills exploded');
					}
					return { skills: [{ name: 'user-skill', source: 'user', enabled: true }] };
				},
				getSkillInfo: async (request) => ({
					name: request.skillName,
					content: '# Original',
					source: 'user',
					enabled: true,
				}),
				saveSkillContent: async () => ({ ok: true }),
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();

			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);
			section.selectSkillForTest('user-skill');
			await flushMicrotasks();
			assert.strictEqual(section.getSelectedSkillName(), 'user-skill');

			const ok = await section.saveSelectedSkillBody('# Updated body');
			await flushMicrotasks();
			assert.strictEqual(ok, true);
			assert.ok(listSkillsCalls >= 2);

			const saveSuccess = localize('ua.engineSkillBodySaveSuccess', "Saved.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			assert.ok(!(writeStatus.textContent ?? '').includes(saveSuccess));

			assertSkillsLeftoverFailedHonesty(section, 'listSkills exploded', 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('saveSelectedSkillBody success still shows save-success when subsequent getSkillInfo fails', async () => {
		let getSkillInfoCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const connection = createConnectionStub({
				connected: true,
				skillsSupport: 'SUPPORTED',
				listSkills: async () => ({
					skills: [{ name: 'user-skill', source: 'user', enabled: true }],
				}),
				getSkillInfo: async (request) => {
					getSkillInfoCalls++;
					if (getSkillInfoCalls > 1) {
						throw new Error('getSkillInfo exploded');
					}
					return {
						name: request.skillName,
						content: '# Original',
						source: 'user',
						enabled: true,
					};
				},
				saveSkillContent: async () => ({ ok: true }),
			});
			const section = mountSection(connection);
			section.setSectionActive(true);
			await flushMicrotasks();

			section.selectSkillForTest('user-skill');
			await flushMicrotasks();
			assert.strictEqual(section.getSelectedSkillName(), 'user-skill');
			assert.ok(getSkillInfoCalls >= 1);

			const ok = await section.saveSelectedSkillBody('# Updated body');
			await flushMicrotasks();
			assert.strictEqual(ok, true);
			assert.ok(getSkillInfoCalls >= 2);

			const saveSuccess = localize('ua.engineSkillBodySaveSuccess', "Saved.");
			const writeStatus = section.getDomNode().querySelector('.engine-skill-write-status') as HTMLElement;
			assert.ok(writeStatus);
			assert.notStrictEqual(writeStatus.style.display, 'none');
			assert.ok(writeStatus.textContent?.includes(saveSuccess));
			assert.strictEqual(section.getMode(), 'ready');
			assert.strictEqual(section.getListEntryCount(), 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('SUPPORTED connected saveSelectedSkillBody calls saveSkillContent RPC', async () => {
		let saveCalled = false;
		let savedContent = '';
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [{ name: 'user-skill', source: 'user', enabled: true }],
			}),
			getSkillInfo: async (request) => ({
				name: request.skillName,
				content: '# Original',
				source: 'user',
				enabled: true,
			}),
			saveSkillContent: async (request) => {
				saveCalled = true;
				savedContent = request.content;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.canWrite(), true);
		assert.ok(section.isBodyEditorVisible());

		section.selectSkillForTest('user-skill');
		await flushMicrotasks();

		const textarea = section.getDomNode().querySelector('.engine-skill-body-input textarea') as HTMLTextAreaElement;
		assert.ok(textarea);
		assert.strictEqual(textarea.value, '# Original');
		assert.strictEqual(section.isSaveToolbarVisible(), true);

		textarea.value = '# Updated body';
		const ok = await section.saveSelectedSkillBody();
		assert.ok(saveCalled);
		assert.strictEqual(savedContent, '# Updated body');
		assert.strictEqual(ok, true);
	});

	test('bundled skill body is read-only and does not show save toolbar', async () => {
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			getSkillInfo: async () => ({
				name: 'demo-skill',
				content: '# Bundled',
				source: 'bundled',
				enabled: true,
			}),
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();

		const textarea = section.getDomNode().querySelector('.engine-skill-body-input textarea') as HTMLTextAreaElement;
		assert.ok(textarea.readOnly);
		assert.strictEqual(section.isSaveToolbarVisible(), false);

		const ok = await section.saveSelectedSkillBody('# hack');
		assert.strictEqual(ok, false);
	});

	test('successful refresh then getSkillInfo throw keeps leftover body and paints load-failed', async () => {
		let getSkillInfoCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => ({
				skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
			}),
			getSkillInfo: async (request) => {
				getSkillInfoCalls++;
				if (getSkillInfoCalls === 1) {
					return {
						name: request.skillName,
						content: '# Stale skill body',
						source: 'bundled',
						enabled: true,
					};
				}
				throw new Error('getSkillInfo exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('demo-skill');
		await flushMicrotasks();
		assert.ok(section.getSelectedSkillBody().includes('# Stale skill body'));

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.strictEqual(section.getSelectedSkillName(), 'demo-skill');
		const bodyStatus = section.getDomNode().querySelector('.engine-skill-body-status') as HTMLElement;
		assert.ok(bodyStatus);
		assert.ok(bodyStatus.textContent?.includes(localize(
			'ua.engineSkillBodyLoadFailed',
			"Could not load skill content from the engine.",
		)));
		const textarea = section.getDomNode().querySelector('.engine-skill-body-input textarea') as HTMLTextAreaElement | null;
		assert.ok(textarea);
		assert.ok(textarea.value.includes('# Stale skill body'));
		assert.ok(section.getSelectedSkillBody().includes('# Stale skill body'));
		assert.ok((section.getDomNode().textContent ?? '').includes('# Stale skill body'));
	});

	test('successful body then list throw then select leftover keeps body text', async () => {
		let listSkillsCalls = 0;
		let infoCalls = 0;
		const leftoverBody = '# Leftover skill body';
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				if (listSkillsCalls === 1) {
					return { skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] };
				}
				throw new Error('listSkills retry exploded');
			},
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: leftoverBody, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(listSkillsCalls, 2);
		assertSkillsLeftoverFailedHonesty(section, 'listSkills retry exploded', 1);
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assertSkillsLeftoverFailedHonesty(section, 'listSkills retry exploded', 1);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());
	});

	test('successful body then capability UNKNOWN then select leftover keeps body text', async () => {
		let listSkillsCalls = 0;
		let infoCalls = 0;
		const leftoverBody = '# Leftover skill body';
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] };
			},
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: leftoverBody, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());
		const listCallsAfterLoad = listSkillsCalls;

		connection.setSkillsSupport('UNKNOWN');
		await flushMicrotasks();

		assertSkillsLeftoverUnknownHonesty(section, 1);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assertSkillsLeftoverUnknownHonesty(section, 1);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());
	});

	test('leftover body stays after pairing re-select, then true disconnect clears', async () => {
		let listSkillsCalls = 0;
		let infoCalls = 0;
		const leftoverBody = '# Leftover skill body';
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				return { skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] };
			},
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: leftoverBody, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());
		const leftoverRows = section.getListEntryCount();
		const listCallsAfterLoad = listSkillsCalls;

		connection.setPairingPending(true);
		await flushMicrotasks();

		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assertSkillsLeftoverPairingHonesty(section, leftoverRows);
		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, 1);
		assert.strictEqual(listSkillsCalls, listCallsAfterLoad);
		assertSkillsLeftoverPairingHonesty(section, leftoverRows);
		assert.strictEqual(section.getSelectedSkillBody(), leftoverBody);
		assert.ok(section.isBodyEditorVisible());
		assert.ok((section.getDomNode().textContent ?? '').includes(getEngineSectionDisconnectedCopy()));

		connection.setConnected(false);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.getSelectedSkillBody(), '');
	});

	test('leftover-looks-live pairing-hold loadSkillBody skips extra getSkillInfo', async () => {
		let infoCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			looksLive: true,
			listSkills: async () => ({ skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] }),
			getSkillInfo: async () => {
				infoCalls++;
				return { name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		const infoCallsAfterLoad = infoCalls;
		assert.ok(infoCallsAfterLoad >= 1);
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		connection.setLooksLive(true);
		connection.setPairingPendingQuiet(true);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(infoCalls, infoCallsAfterLoad, 'leftover-looks-live must not extra getSkillInfo');
		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(section.isBodyEditorVisible());
		assert.ok((section.getDomNode().textContent ?? '').includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!(section.getDomNode().textContent ?? '').includes(INFLIGHT_LIVE_SKILL_BODY));
	});

	test('in-flight getSkillInfo leftover-looks-live keeps leftover and does not paint live', async () => {
		let infoCalls = 0;
		let releaseSecond: (() => void) | undefined;
		let secondStarted: (() => void) | undefined;
		const secondEntered = new Promise<void>(resolve => { secondStarted = resolve; });
		const secondHold = new Promise<void>(resolve => { releaseSecond = resolve; });
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			looksLive: true,
			listSkills: async () => ({ skills: [{ name: 'leftover-skill', source: 'bundled', enabled: true }] }),
			getSkillInfo: async () => {
				infoCalls++;
				if (infoCalls === 1) {
					return { name: 'leftover-skill', content: LEFTOVER_SKILL_BODY, source: 'bundled', enabled: true };
				}
				secondStarted?.();
				await secondHold;
				return { name: 'leftover-skill', content: INFLIGHT_LIVE_SKILL_BODY, source: 'bundled', enabled: true };
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		section.selectSkillForTest('leftover-skill');
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.strictEqual(isConversationPairingHold(connection), false);

		section.selectSkillForTest('leftover-skill');
		await secondEntered;
		assert.strictEqual(infoCalls, 2);

		connection.setLooksLive(true);
		connection.setPairingPendingQuiet(true);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		releaseSecond!();
		await flushMicrotasks();

		assert.strictEqual(section.getSelectedSkillBody(), LEFTOVER_SKILL_BODY);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(INFLIGHT_LIVE_SKILL_BODY), 'in-flight leftover-looks-live must not paint live');
		assert.ok((section.getDomNode().textContent ?? '').includes(getEngineSectionDisconnectedCopy()));
		assert.ok(section.isBodyEditorVisible());
	});

	test('disconnected saveSelectedSkillBody does not call saveSkillContent RPC', async () => {
		let saveCalled = false;
		const connection = createConnectionStub({
			connected: false,
			skillsSupport: 'SUPPORTED',
			saveSkillContent: async () => {
				saveCalled = true;
				return { ok: true };
			},
		});
		const section = mountSection(connection);
		await flushMicrotasks();

		const ok = await section.saveSelectedSkillBody('# should not save');
		assert.strictEqual(saveCalled, false);
		assert.strictEqual(ok, false);
		assert.strictEqual(section.canWrite(), false);
	});
});
