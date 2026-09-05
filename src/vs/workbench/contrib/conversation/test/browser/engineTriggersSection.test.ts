/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentFireTriggerRequest, UniverseAgentListTriggersRequest, UniverseAgentListTriggersResult } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ENGINE_TRIGGER_FIRE_LABEL } from '../../browser/engineTriggerList.js';
import { EngineTriggersSection } from '../../browser/engineTriggersSection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';

suite('EngineTriggersSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountSection(connection: IUniverseAgentConnection): EngineTriggersSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineTriggersSection, parent));
		section.setSectionActive(true);
		return section;
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	test('ListTriggers does not send when disconnected or hook missing', async () => {
		let listTriggersCalls = 0;
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			listTriggers: async () => {
				listTriggersCalls++;
				return { triggers: [] };
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 0);
		assert.ok((disconnected.getDomNode().textContent ?? '').length > 0);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 0);
		assert.ok((noHook.getDomNode().textContent ?? '').includes('does not expose'));
		noHook.getDomNode().parentElement?.remove();
	});

	test('ListTriggers sends empty scope / scopeId / typeFilter as-is when connected', async () => {
		const requests: UniverseAgentListTriggersRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (request): Promise<UniverseAgentListTriggersResult> => {
				requests.push(request);
				return {
					triggers: [{
						triggerId: '',
						name: '',
						type: '',
						promptTemplate: '',
						enabled: false,
						pauseReason: '',
						target: { kind: 'unspecified' },
						intervalMs: 0,
						cronExpression: '',
						runAtEpochMs: 0,
					}],
				};
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(requests.length, 1);
		assert.deepStrictEqual(requests[0], { scope: '', scopeId: '', typeFilter: '' });
		const row = pane.getDomNode().querySelector('.engine-triggers-row');
		assert.ok(row);
		assert.strictEqual(row.textContent, ' —  — ');
		pane.getDomNode().parentElement?.remove();
	});

	test('ListTriggers empty triggers[] is honest empty', async () => {
		let listTriggersCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => {
				listTriggersCalls++;
				return { triggers: [] };
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelector('.engine-triggers-row'), null);
		assert.ok((pane.getDomNode().textContent ?? '').includes('No triggers.'));
		pane.getDomNode().parentElement?.remove();
	});

	function findFireButton(root: HTMLElement): HTMLButtonElement | undefined {
		return [...root.querySelectorAll('.engine-triggers-actions .monaco-button')]
			.find(button => button.textContent === ENGINE_TRIGGER_FIRE_LABEL) as HTMLButtonElement | undefined;
	}

	test('FireTrigger does not send when disconnected or hook missing', async () => {
		const fireCalls: UniverseAgentFireTriggerRequest[] = [];
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			fireTrigger: async request => {
				fireCalls.push(request);
				return { status: '', eventId: '', reason: '' };
			},
		}));
		await flushMicrotasks();
		const disconnectedFire = findFireButton(disconnected.getDomNode());
		assert.ok(disconnectedFire);
		disconnectedFire.click();
		await flushMicrotasks();
		assert.deepStrictEqual(fireCalls, []);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		const noHookFire = findFireButton(noHook.getDomNode());
		assert.ok(noHookFire);
		noHookFire.click();
		await flushMicrotasks();
		assert.deepStrictEqual(fireCalls, []);
		noHook.getDomNode().parentElement?.remove();
	});

	test('FireTrigger sends empty ids as-is when connected with no selection', async () => {
		const fireCalls: UniverseAgentFireTriggerRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			fireTrigger: async request => {
				fireCalls.push(request);
				return { status: '', eventId: '', reason: '' };
			},
		}));
		await flushMicrotasks();
		const fire = findFireButton(pane.getDomNode());
		assert.ok(fire);
		fire.click();
		await flushMicrotasks();
		assert.deepStrictEqual(fireCalls, [{ scope: '', scopeId: '', triggerId: '' }]);
		pane.getDomNode().parentElement?.remove();
	});

	test('FireTrigger sends selected trigger_id without inventing defaults', async () => {
		const fireCalls: UniverseAgentFireTriggerRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => ({
				triggers: [{
					triggerId: '  trig  ',
					name: '  Nightly  ',
					type: 'cron',
					promptTemplate: '',
					enabled: false,
					pauseReason: '',
					target: { kind: 'self' },
					intervalMs: 0,
					cronExpression: '',
					runAtEpochMs: 0,
				}],
			}),
			fireTrigger: async request => {
				fireCalls.push(request);
				return { status: '', eventId: '', reason: '' };
			},
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const fire = findFireButton(pane.getDomNode());
		assert.ok(fire);
		fire.click();
		await flushMicrotasks();
		assert.deepStrictEqual(fireCalls, [{ scope: '', scopeId: '', triggerId: '  trig  ' }]);
		pane.getDomNode().parentElement?.remove();
	});
});
