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
			connect: async () => ({ methods: [], events: [], sessionToken: 'tok' }),
			connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
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
			getSkillInfo: async () => ({ name: 'demo-skill', content: '# Demo', source: 'bundled', enabled: true }),
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
});
