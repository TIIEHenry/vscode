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
import { EngineSkillsSection } from '../../browser/engineSkillsSection.js';
import { getCatalogFailedCopy } from '../../browser/engineCatalog.js';
import { getSkillsUnsupportedCopy } from '../../browser/engineSkillCatalog.js';
import { localize } from '../../../../../nls.js';

const SKILLS_FEATURE = localize('ua.engineSkillsFeatureLabel', "a skills API");

suite('EngineSkillsSection (E1)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		skillsSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		listSkills?: () => Promise<UniverseAgentListSkillsResult>;
		getSkillInfo?: (request: { skillName: string }) => Promise<{ name: string; content: string; source: 'bundled' | 'user' | 'project' | 'unknown'; enabled: boolean }>;
		saveSkillContent?: (request: UniverseAgentSaveSkillContentRequest) => Promise<{ ok: boolean }>;
		setSkillEnabled?: (request: { skillName: string; enabled: boolean }) => Promise<{ ok: boolean }>;
	} = {}): IUniverseAgentConnection & { setConnected(value: boolean): void } {
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			skills: { support: options.skillsSupport ?? 'UNSUPPORTED', reason: 'UNIMPLEMENTED' },
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

		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 0);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(SKILLS_FEATURE, 'listSkills exploded')));
		assert.ok(!/demo-skill/i.test(section.getDomNode().textContent ?? ''));
	});

	test('successful load then refresh throw is failed with no leftover catalog', async () => {
		let listSkillsCalls = 0;
		const connection = createConnectionStub({
			connected: true,
			skillsSupport: 'SUPPORTED',
			listSkills: async () => {
				listSkillsCalls++;
				if (listSkillsCalls === 1) {
					return { skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }] };
				}
				throw new Error('listSkills retry exploded');
			},
		});
		const section = mountSection(connection);
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.ok(section.getListEntryCount() > 0);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 0);
		const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(SKILLS_FEATURE, 'listSkills retry exploded')));
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

			assert.strictEqual(section.getMode(), 'failed');
			assert.strictEqual(section.getListEntryCount(), 0);
			const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
			assert.ok(status);
			assert.strictEqual(status.dataset['catalogMode'], 'failed');
			assert.ok(status.textContent?.includes(getCatalogFailedCopy(SKILLS_FEATURE, 'listSkills exploded')));
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

			assert.strictEqual(section.getMode(), 'failed');
			assert.strictEqual(section.getListEntryCount(), 0);
			const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
			assert.ok(status);
			assert.strictEqual(status.dataset['catalogMode'], 'failed');
			assert.ok(status.textContent?.includes(getCatalogFailedCopy(SKILLS_FEATURE, 'listSkills exploded')));
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

			assert.strictEqual(section.getMode(), 'failed');
			assert.strictEqual(section.getListEntryCount(), 0);
			const status = section.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
			assert.ok(status);
			assert.strictEqual(status.dataset['catalogMode'], 'failed');
			assert.ok(status.textContent?.includes(getCatalogFailedCopy(SKILLS_FEATURE, 'listSkills exploded')));
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

	test('successful refresh reloads selected skill body and drops stale content', async () => {
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
		assert.ok(!textarea.value.includes('# Stale skill body'));
		assert.ok(!section.getSelectedSkillBody().includes('# Stale skill body'));
		assert.ok(!(section.getDomNode().textContent ?? '').includes('# Stale skill body'));
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
