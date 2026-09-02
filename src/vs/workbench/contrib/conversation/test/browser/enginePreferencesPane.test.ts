/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/node/grpcCapabilityProbe.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	EnginePreferencesPane,
	getEngineEmptyCopy,
	getEngineTestStatusText,
} from '../../browser/enginePreferencesPane.js';

const ENGINE_EMPTY_COPY = 'No engines yet';
const FAKE_ENGINE_LABELS = ['Local Engine', '127.0.0.1:8080'];

suite('EnginePreferencesPane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(connected = false): IUniverseAgentConnection {
		const capabilities = createEmptyCapabilitySnapshot();
		return {
			_serviceBrand: undefined,
			isEngineConnected: () => connected,
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getTransportState: () => (connected ? 'ok' : 'idle'),
			getConnectionSnapshot: () => ({
				transport: connected ? 'ok' : 'idle',
				sessionToken: connected ? 'tok' : undefined,
				pairingPending: false,
				channelAlive: connected,
				capabilities,
			}),
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: Event.None,
			onDidFileMutation: Event.None,
			connect: async () => ({ methods: [], events: [], sessionToken: 'tok' }),
			connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			disconnect: async () => { },
			listSessions: async () => ({ sessions: [] }),
			createSession: async () => ({ sessionId: 's' }),
			deleteSession: async () => { },
			getHistory: async () => ({ envelopes: [] }),
			subscribeSessionEventStream: () => ({ dispose: () => { } }),
			chat: async () => { },
			listSkills: async () => ({ skills: [] }),
			setSkillEnabled: async () => ({ ok: true }),
			getSkillInfo: async () => ({ name: '', content: '', source: 'unknown', enabled: false }),
		};
	}

	function mountPane(connected = false): EnginePreferencesPane {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub(connected));
		const pane = store.add(instantiationService.createInstance(EnginePreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		return pane;
	}

	test('getEngineTestStatusText returns honest not-connected copy', () => {
		assert.strictEqual(getEngineTestStatusText(), 'Not connected — no engine.');
	});

	test('getEngineEmptyCopy returns honest roster-empty copy', () => {
		assert.strictEqual(getEngineEmptyCopy(), ENGINE_EMPTY_COPY);
	});

	test('pane title remains Engine with honest empty welcome when disconnected', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		const title = container.querySelector('h2') as HTMLElement;
		assert.ok(title);
		assert.strictEqual(title.textContent, 'Engine');

		const emptyWelcome = container.querySelector('.engine-empty-welcome') as HTMLElement;
		assert.ok(emptyWelcome);
		assert.strictEqual(emptyWelcome.textContent, ENGINE_EMPTY_COPY);

		container.remove();
	});

	test('disconnected pane hides skills section and does not seed catalog rows', async () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();
		await new Promise(resolve => setTimeout(resolve, 0));

		const skillsSection = container.querySelector('.engine-skills-section') as HTMLElement;
		assert.ok(skillsSection);
		assert.strictEqual(skillsSection.style.display, 'none');

		const combined = container.textContent ?? '';
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

	test('Test Engine click surfaces honest status without faking success when disconnected', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		const testButton = container.querySelector('.engine-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = container.querySelector('.engine-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);
		assert.strictEqual(testStatus.textContent, '');

		testButton.click();
		assert.strictEqual(testStatus.textContent, getEngineTestStatusText());
		assert.notStrictEqual(testStatus.textContent, 'Connected');

		container.remove();
	});
});
