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
	UniverseAgentListSkillsResult,
	UniverseAgentSaveSkillContentRequest,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { EngineSkillsSection } from '../../browser/engineSkillsSection.js';
import { getSkillsUnsupportedCopy } from '../../browser/engineSkillCatalog.js';

suite('EngineSkillsSection (E1)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		skillsSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		listSkills?: () => Promise<UniverseAgentListSkillsResult>;
		getSkillInfo?: (request: { skillName: string }) => Promise<{ name: string; content: string; source: 'bundled' | 'user' | 'project' | 'unknown'; enabled: boolean }>;
		saveSkillContent?: (request: UniverseAgentSaveSkillContentRequest) => Promise<{ ok: boolean }>;
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
			getHistory: async () => ({ envelopes: [] }),
			subscribeSessionEventStream: () => ({ dispose: () => { } }),
			chat: async () => { },
			listSkills: options.listSkills ?? (async () => ({
				skills: [{ name: 'demo-skill', source: 'bundled', enabled: true }],
			})),
			setSkillEnabled: async () => ({ ok: true }),
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
		const status = section.getDomNode().querySelector('.engine-skills-status') as HTMLElement;
		assert.ok(status);
		assert.ok(status.textContent?.includes(getSkillsUnsupportedCopy('UNIMPLEMENTED')));
		assert.ok(!/copilot/i.test(section.getDomNode().textContent ?? ''));
	});

	test('disconnect clears RPC catalog rows (§8.3 #5)', async () => {
		const connection = createConnectionStub({ connected: true, skillsSupport: 'SUPPORTED' });
		const section = mountSection(connection);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(section.getMode(), 'supported');
		assert.ok(section.getListEntryCount() > 0);

		connection.setConnected(false);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(section.getMode(), 'disconnected');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.getDomNode().style.display, 'none');
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

		assert.strictEqual(section.getMode(), 'supported');
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

		assert.strictEqual(section.getMode(), 'supported');
		assert.strictEqual(section.canWrite(), true);
		assert.ok(section.isBodyEditorVisible());

		section.selectSkillForTest('user-skill');
		await flushMicrotasks();

		const textarea = section.getDomNode().querySelector('textarea.engine-skill-body-textarea') as HTMLTextAreaElement;
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

		const textarea = section.getDomNode().querySelector('textarea.engine-skill-body-textarea') as HTMLTextAreaElement;
		assert.ok(textarea.readOnly);
		assert.strictEqual(section.isSaveToolbarVisible(), false);

		const ok = await section.saveSelectedSkillBody('# hack');
		assert.strictEqual(ok, false);
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
