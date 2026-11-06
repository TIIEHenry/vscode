/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentListHookPointsResult,
	UniverseAgentListProjectRulesRequest,
	UniverseAgentListProjectRulesResult,
	UniverseAgentProjectRule,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { getCatalogFailedCopy } from '../../browser/engineCatalog.js';
import { EngineHooksSection } from '../../browser/engineHooksSection.js';
import { EngineRulesSection } from '../../browser/engineRulesSection.js';
import { createMutableConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';

const RULES_FEATURE = 'rules catalog';
const HOOKS_FEATURE = 'hook metadata';

function sampleRule(id: string, title: string): UniverseAgentProjectRule {
	return {
		id,
		title,
		enabled: true,
		priority: 2,
		body: '',
		scope: 2,
		globs: [],
		appliesTo: [],
	};
}

suite('Engine Rules / Hooks list (G-ENG-2/3)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(options: {
		connected?: boolean;
		rulesSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		hooksSupport?: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';
		listProjectRules?: (request: UniverseAgentListProjectRulesRequest) => Promise<UniverseAgentListProjectRulesResult>;
		listHookPoints?: () => Promise<UniverseAgentListHookPointsResult>;
	} = {}): IUniverseAgentConnection & {
		setConnected(next: boolean): void;
	} {
		const capabilities: UniverseAgentCapabilitySnapshot = {
			...createEmptyCapabilitySnapshot(),
			globalRules: { support: options.rulesSupport ?? 'UNSUPPORTED' },
			projectRules: { support: options.rulesSupport ?? 'UNSUPPORTED' },
			hooksMetadata: { support: options.hooksSupport ?? 'UNSUPPORTED' },
		};
		const stub = createMutableConversationConnectionTestStub({
			connected: options.connected ?? true,
			pairingPending: false,
			looksLive: false,
			capabilities,
			engineIdentityId: undefined,
			linkId: undefined,
			publishedLink: 'never',
			overrides: {
				listProjectRules: options.listProjectRules,
				listHookPoints: options.listHookPoints,
			},
		});

		return Object.assign(stub.connection, {
			setConnected(next: boolean) {
				stub.state.connected = next;
				stub.notify();
			},
		});
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	test('Rules lists Global + Project from proto scopes 2/1 without work_dir', async () => {
		const scopes: number[] = [];
		const connection = createConnectionStub({
			connected: true,
			rulesSupport: 'SUPPORTED',
			listProjectRules: async (request) => {
				scopes.push(request.scope);
				assert.strictEqual(request.sessionId, '');
				assert.ok(!('workDir' in request));
				if (request.scope === 2) {
					return { rules: [sampleRule('g1', 'Always apply')] };
				}
				return { rules: [sampleRule('p1', 'Repo style')] };
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineRulesSection, parent));
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.deepStrictEqual(scopes.slice().sort(), [1, 2]);
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 2);
		const text = section.getDomNode().textContent ?? '';
		assert.ok(text.includes('Always apply'), text);
		assert.ok(text.includes('Repo style'), text);
		parent.remove();
	});

	test('Rules first-pull throw is failed with no leftover rows', async () => {
		const connection = createConnectionStub({
			connected: true,
			rulesSupport: 'SUPPORTED',
			listProjectRules: async () => {
				throw new Error('listProjectRules exploded');
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineRulesSection, parent));
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 0);
		assert.ok((section.getDomNode().textContent ?? '').includes(getCatalogFailedCopy(RULES_FEATURE, 'listProjectRules exploded')));
		parent.remove();
	});

	test('Rules success then throw keeps leftover rows', async () => {
		let calls = 0;
		const connection = createConnectionStub({
			connected: true,
			rulesSupport: 'SUPPORTED',
			listProjectRules: async (request) => {
				calls++;
				if (calls <= 2) {
					return { rules: request.scope === 2 ? [sampleRule('g1', 'Leftover global')] : [] };
				}
				throw new Error('listProjectRules retry exploded');
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineRulesSection, parent));
		section.setSectionActive(true);
		await flushMicrotasks();
		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes('Leftover global'));
		parent.remove();
	});

	test('Hooks lists points and keeps leftover after throw', async () => {
		let calls = 0;
		const connection = createConnectionStub({
			connected: true,
			hooksSupport: 'SUPPORTED',
			listHookPoints: async () => {
				calls++;
				if (calls === 1) {
					return {
						points: [{ id: 'pre', family: 'session', methodName: 'before_turn', installedCount: 2 }],
						catalogRevision: 'r1',
					};
				}
				throw new Error('listHookPoints retry exploded');
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineHooksSection, parent));
		section.setSectionActive(true);
		await flushMicrotasks();

		assert.strictEqual(section.getMode(), 'ready');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes('before_turn'));

		connection.setConnected(true);
		await flushMicrotasks();

		assert.strictEqual(calls, 2);
		assert.strictEqual(section.getMode(), 'failed');
		assert.strictEqual(section.getListEntryCount(), 1);
		assert.ok((section.getDomNode().textContent ?? '').includes('before_turn'));
		assert.ok((section.getDomNode().textContent ?? '').includes(getCatalogFailedCopy(HOOKS_FEATURE, 'listHookPoints retry exploded')));
		parent.remove();
	});

	test('Rules and Hooks sections detach DOM container upon disposal', () => {
		const connection = createConnectionStub({ connected: true });
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const rulesSection = instantiationService.createInstance(EngineRulesSection, parent);
		const hooksSection = instantiationService.createInstance(EngineHooksSection, parent);

		assert.strictEqual(rulesSection.getDomNode().parentElement, parent);
		assert.strictEqual(hooksSection.getDomNode().parentElement, parent);

		rulesSection.dispose();
		hooksSection.dispose();

		assert.strictEqual(rulesSection.getDomNode().parentElement, null);
		assert.strictEqual(hooksSection.getDomNode().parentElement, null);
		assert.strictEqual(rulesSection.getDomNode().childNodes.length, 0);
		assert.strictEqual(hooksSection.getDomNode().childNodes.length, 0);
		parent.remove();
	});
});
