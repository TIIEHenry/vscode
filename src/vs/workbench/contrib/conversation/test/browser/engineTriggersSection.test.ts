/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentDeleteTriggerRequest, UniverseAgentFireTriggerRequest, UniverseAgentListTriggersRequest, UniverseAgentListTriggersResult, UniverseAgentSetTriggerEnabledRequest, UniverseAgentTrigger } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ENGINE_TRIGGER_DELETE_LABEL, ENGINE_TRIGGER_DISABLE_LABEL, ENGINE_TRIGGER_ENABLE_LABEL, ENGINE_TRIGGER_FIRE_LABEL } from '../../browser/engineTriggerList.js';
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

	function findActionButton(root: HTMLElement, label: string): HTMLButtonElement | undefined {
		return [...root.querySelectorAll('.engine-triggers-actions .monaco-button')]
			.find(button => button.textContent === label) as HTMLButtonElement | undefined;
	}

	function findFireButton(root: HTMLElement): HTMLButtonElement | undefined {
		return findActionButton(root, ENGINE_TRIGGER_FIRE_LABEL);
	}

	function emptyTrigger(overrides: Partial<UniverseAgentTrigger> = {}): UniverseAgentTrigger {
		return {
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
			...overrides,
		};
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

	test('SetTriggerEnabled does not send when disconnected or hook missing', async () => {
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			setTriggerEnabled: async request => {
				setCalls.push(request);
				return { trigger: emptyTrigger() };
			},
		}));
		await flushMicrotasks();
		const disconnectedDisable = findActionButton(disconnected.getDomNode(), ENGINE_TRIGGER_DISABLE_LABEL);
		assert.ok(disconnectedDisable);
		disconnectedDisable.click();
		await flushMicrotasks();
		assert.deepStrictEqual(setCalls, []);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		const noHookDisable = findActionButton(noHook.getDomNode(), ENGINE_TRIGGER_DISABLE_LABEL);
		assert.ok(noHookDisable);
		noHookDisable.click();
		await flushMicrotasks();
		assert.deepStrictEqual(setCalls, []);
		noHook.getDomNode().parentElement?.remove();
	});

	test('SetTriggerEnabled sends empty ids and enabled false as-is when connected with no selection', async () => {
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			setTriggerEnabled: async request => {
				setCalls.push(request);
				return { trigger: emptyTrigger({ enabled: request.enabled }) };
			},
		}));
		await flushMicrotasks();
		const disable = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_DISABLE_LABEL);
		assert.ok(disable);
		disable.click();
		await flushMicrotasks();
		assert.deepStrictEqual(setCalls, [{ scope: '', scopeId: '', triggerId: '', enabled: false }]);
		assert.ok((pane.getDomNode().textContent ?? '').includes(' —  —  — false'));
		pane.getDomNode().parentElement?.remove();
	});

	test('SetTriggerEnabled sends selected trigger_id and enabled without inventing defaults', async () => {
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => ({
				triggers: [emptyTrigger({
					triggerId: '  trig  ',
					name: '  Nightly  ',
					type: 'cron',
					target: { kind: 'self' },
				})],
			}),
			setTriggerEnabled: async request => {
				setCalls.push(request);
				return { trigger: emptyTrigger({ triggerId: request.triggerId, enabled: request.enabled }) };
			},
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const enable = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ENABLE_LABEL);
		assert.ok(enable);
		enable.click();
		await flushMicrotasks();
		assert.deepStrictEqual(setCalls, [{ scope: '', scopeId: '', triggerId: '  trig  ', enabled: true }]);
		const disable = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_DISABLE_LABEL);
		assert.ok(disable);
		disable.click();
		await flushMicrotasks();
		assert.deepStrictEqual(setCalls, [
			{ scope: '', scopeId: '', triggerId: '  trig  ', enabled: true },
			{ scope: '', scopeId: '', triggerId: '  trig  ', enabled: false },
		]);
		pane.getDomNode().parentElement?.remove();
	});

	test('DeleteTrigger does not send when disconnected or hook missing', async () => {
		const deleteCalls: UniverseAgentDeleteTriggerRequest[] = [];
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			deleteTrigger: async request => {
				deleteCalls.push(request);
				return {};
			},
		}));
		await flushMicrotasks();
		const disconnectedDelete = findActionButton(disconnected.getDomNode(), ENGINE_TRIGGER_DELETE_LABEL);
		assert.ok(disconnectedDelete);
		disconnectedDelete.click();
		await flushMicrotasks();
		assert.deepStrictEqual(deleteCalls, []);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		const noHookDelete = findActionButton(noHook.getDomNode(), ENGINE_TRIGGER_DELETE_LABEL);
		assert.ok(noHookDelete);
		noHookDelete.click();
		await flushMicrotasks();
		assert.deepStrictEqual(deleteCalls, []);
		noHook.getDomNode().parentElement?.remove();
	});

	test('DeleteTrigger sends empty ids as-is when connected with no selection', async () => {
		const deleteCalls: UniverseAgentDeleteTriggerRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			deleteTrigger: async request => {
				deleteCalls.push(request);
				return {};
			},
		}));
		await flushMicrotasks();
		const del = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_DELETE_LABEL);
		assert.ok(del);
		del.click();
		await flushMicrotasks();
		assert.deepStrictEqual(deleteCalls, [{ scope: '', scopeId: '', triggerId: '' }]);
		pane.getDomNode().parentElement?.remove();
	});

	test('DeleteTrigger sends selected trigger_id without inventing defaults', async () => {
		const deleteCalls: UniverseAgentDeleteTriggerRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => ({
				triggers: [emptyTrigger({
					triggerId: '  trig  ',
					name: '  Nightly  ',
					type: 'cron',
					target: { kind: 'self' },
				})],
			}),
			deleteTrigger: async request => {
				deleteCalls.push(request);
				return {};
			},
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const del = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_DELETE_LABEL);
		assert.ok(del);
		del.click();
		await flushMicrotasks();
		assert.deepStrictEqual(deleteCalls, [{ scope: '', scopeId: '', triggerId: '  trig  ' }]);
		pane.getDomNode().parentElement?.remove();
	});
});
