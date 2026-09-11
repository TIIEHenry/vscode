/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot, UniverseAgentDeleteTriggerRequest, UniverseAgentFireTriggerRequest, UniverseAgentListTriggersRequest, UniverseAgentListTriggersResult, UniverseAgentSetTriggerEnabledRequest, UniverseAgentTrigger, UniverseAgentUpsertTriggerRequest } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { getCatalogFailedCopy } from '../../browser/engineCatalog.js';
import { ENGINE_TRIGGER_ADD_LABEL, ENGINE_TRIGGER_DELETE_LABEL, ENGINE_TRIGGER_DELETE_SUCCESS_COPY, ENGINE_TRIGGER_DISABLE_LABEL, ENGINE_TRIGGER_EDIT_LABEL, ENGINE_TRIGGER_ENABLE_LABEL, ENGINE_TRIGGER_FIRE_LABEL, ENGINE_TRIGGER_LIST_EMPTY_COPY, ENGINE_TRIGGER_LIST_FEATURE, formatEngineTriggerListLabel } from '../../browser/engineTriggerList.js';
import { EngineTriggersSection } from '../../browser/engineTriggersSection.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

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
		assert.strictEqual(noHook.getDomNode().querySelectorAll('.engine-triggers-row').length, 0);
		const noHookStatus = noHook.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(noHookStatus);
		assert.strictEqual(noHookStatus.dataset['catalogMode'], 'unsupported');
		assert.ok((noHook.getDomNode().textContent ?? '').includes('does not expose'));
		assert.ok(!(noHook.getDomNode().textContent ?? '').includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
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
		assert.ok((pane.getDomNode().textContent ?? '').includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('ListTriggers first-pull throw is failed with no leftover rows', async () => {
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => {
				throw new Error('listTriggers exploded');
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelector('.engine-triggers-row'), null);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(ENGINE_TRIGGER_LIST_FEATURE, 'listTriggers exploded')));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('ListTriggers success then throw keeps leftover rows and paints failed', async () => {
		let listTriggersCalls = 0;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const leftover = emptyTrigger({
			triggerId: 'leftover-trig',
			name: 'leftover-nightly',
			type: 'cron',
			target: { kind: 'self' },
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			onDidChangeConnection: onDidChangeConnection.event,
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				listTriggersCalls++;
				if (listTriggersCalls === 1) {
					return { triggers: [leftover] };
				}
				throw new Error('listTriggers retry exploded');
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		const liveRow = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(liveRow);
		assert.strictEqual(liveRow.textContent, formatEngineTriggerListLabel(leftover));
		assert.strictEqual(listTriggersCalls, 1);

		onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();

		assert.strictEqual(listTriggersCalls, 2);
		const leftoverRows = pane.getDomNode().querySelectorAll('.engine-triggers-row');
		assert.strictEqual(leftoverRows.length, 1);
		assert.strictEqual(leftoverRows[0].textContent, formatEngineTriggerListLabel(leftover));
		const listHost = pane.getDomNode().querySelector('.engine-triggers-list') as HTMLElement | null;
		assert.ok(listHost);
		assert.notStrictEqual(listHost.style.display, 'none');
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(ENGINE_TRIGGER_LIST_FEATURE, 'listTriggers retry exploded')));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('ListTriggers success then hook missing keeps leftover rows and paints unsupported', async () => {
		const leftover = emptyTrigger({
			triggerId: 'leftover-trig',
			name: 'leftover-nightly',
			type: 'cron',
			target: { kind: 'self' },
		});
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			onDidChangeConnection: onDidChangeConnection.event,
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				return { triggers: [leftover] };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);

		delete connection.listTriggers;
		onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();

		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);
		const leftoverRows = pane.getDomNode().querySelectorAll('.engine-triggers-row');
		assert.strictEqual(leftoverRows[0].textContent, formatEngineTriggerListLabel(leftover));
		const listHost = pane.getDomNode().querySelector('.engine-triggers-list') as HTMLElement | null;
		assert.ok(listHost);
		assert.notStrictEqual(listHost.style.display, 'none');
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('ListTriggers success then disconnect clears leftover rows', async () => {
		let connected = true;
		const leftover = emptyTrigger({
			triggerId: 'leftover-trig',
			name: 'leftover-nightly',
			type: 'cron',
			target: { kind: 'self' },
		});
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => connected,
			getConnectionPhase: () => connected ? { kind: 'connected', path: 'loopback' } : { kind: 'disconnected' },
			onDidChangeConnection: onDidChangeConnection.event,
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				return { triggers: [leftover] };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);

		connected = false;
		onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();

		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 0);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		pane.getDomNode().parentElement?.remove();
	});

	test('connected phase with pairingPending keeps leftover rows and paints not-connected', async () => {
		let connected = true;
		let pairingPending = false;
		let listTriggersCalls = 0;
		const leftover = emptyTrigger({
			triggerId: 'leftover-trig',
			name: 'leftover-nightly',
			type: 'cron',
			target: { kind: 'self' },
		});
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		const fireCalls: UniverseAgentFireTriggerRequest[] = [];
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		const deleteCalls: UniverseAgentDeleteTriggerRequest[] = [];
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => connected && !pairingPending,
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				listTriggersCalls++;
				return { triggers: [leftover] };
			},
			fireTrigger: async request => {
				fireCalls.push(request);
				return { status: '', eventId: '', reason: '' };
			},
			setTriggerEnabled: async request => {
				setCalls.push(request);
				return { trigger: leftover };
			},
			deleteTrigger: async request => {
				deleteCalls.push(request);
				return {};
			},
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: leftover };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);
		const listCallsAfterLoad = listTriggersCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listTriggersCalls, listCallsAfterLoad);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);
		const listHost = pane.getDomNode().querySelector('.engine-triggers-list') as HTMLElement | null;
		assert.ok(listHost);
		assert.notStrictEqual(listHost.style.display, 'none');
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
		assertWriteButtonsDisabled(pane.getDomNode());
		await assertForcedWriteClicksStayUnary(pane.getDomNode(), fireCalls, setCalls, deleteCalls, upsertCalls);
		assert.strictEqual(listTriggersCalls, listCallsAfterLoad);

		connected = false;
		onDidChangeConnection.fire(snapshot());
		await flushMicrotasks();

		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 0);
		const cleared = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(cleared);
		assert.strictEqual(cleared.dataset['catalogMode'], 'disconnected');
		pane.getDomNode().parentElement?.remove();
	});

	test('leftover-looks-live pairing-hold write buttons stay 0 unary and skip extra list', async () => {
		let pairingPending = false;
		let listTriggersCalls = 0;
		const leftover = emptyTrigger({
			triggerId: 'leftover-live',
			name: 'looks-live-nightly',
			type: 'cron',
			target: { kind: 'self' },
		});
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			pairingPending,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		const fireCalls: UniverseAgentFireTriggerRequest[] = [];
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		const deleteCalls: UniverseAgentDeleteTriggerRequest[] = [];
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				listTriggersCalls++;
				return { triggers: [leftover] };
			},
			fireTrigger: async request => {
				fireCalls.push(request);
				return { status: '', eventId: '', reason: '' };
			},
			setTriggerEnabled: async request => {
				setCalls.push(request);
				return { trigger: leftover };
			},
			deleteTrigger: async request => {
				deleteCalls.push(request);
				return {};
			},
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: leftover };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);
		const listCallsAfterLoad = listTriggersCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listTriggersCalls, listCallsAfterLoad);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assertWriteButtonsDisabled(pane.getDomNode());
		await assertForcedWriteClicksStayUnary(pane.getDomNode(), fireCalls, setCalls, deleteCalls, upsertCalls);
		assert.strictEqual(listTriggersCalls, listCallsAfterLoad);
		pane.getDomNode().parentElement?.remove();
	});

	test('connected leftover list-fail still fires and upserts', async () => {
		let listTriggersCalls = 0;
		const leftover = emptyTrigger({
			triggerId: 'leftover-trig',
			name: 'leftover-nightly',
			type: 'cron',
			target: { kind: 'self' },
		});
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const liveSnapshot: UniverseAgentConnectionSnapshot = {
			transport: 'ok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		};
		const fireCalls: UniverseAgentFireTriggerRequest[] = [];
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => liveSnapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				listTriggersCalls++;
				if (listTriggersCalls === 1) {
					return { triggers: [leftover] };
				}
				throw new Error('list boom');
			},
			fireTrigger: async request => {
				fireCalls.push(request);
				return { status: '', eventId: '', reason: '' };
			},
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: leftover };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);

		onDidChangeConnection.fire(liveSnapshot);
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 2);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);

		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const fire = findFireButton(pane.getDomNode());
		assert.ok(fire);
		assert.strictEqual(fire.classList.contains('disabled'), false);
		fire.click();
		await flushMicrotasks();
		assert.deepStrictEqual(fireCalls, [{ scope: '', scopeId: '', triggerId: leftover.triggerId }]);

		const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(add);
		assert.strictEqual(add.classList.contains('disabled'), false);
		add.click();
		await flushMicrotasks();
		assert.strictEqual(upsertCalls.length, 1);
		pane.getDomNode().parentElement?.remove();
	});

	function findActionButton(root: HTMLElement, label: string): HTMLButtonElement | undefined {
		return [...root.querySelectorAll('.engine-triggers-actions .monaco-button')]
			.find(button => button.textContent === label) as HTMLButtonElement | undefined;
	}

	function findFireButton(root: HTMLElement): HTMLButtonElement | undefined {
		return findActionButton(root, ENGINE_TRIGGER_FIRE_LABEL);
	}

	const WRITE_BUTTON_LABELS = [
		ENGINE_TRIGGER_ADD_LABEL,
		ENGINE_TRIGGER_EDIT_LABEL,
		ENGINE_TRIGGER_FIRE_LABEL,
		ENGINE_TRIGGER_ENABLE_LABEL,
		ENGINE_TRIGGER_DISABLE_LABEL,
		ENGINE_TRIGGER_DELETE_LABEL,
	] as const;

	function forceClick(button: HTMLButtonElement | undefined): void {
		if (!button) {
			return;
		}
		button.classList.remove('disabled');
		button.removeAttribute('disabled');
		button.setAttribute('aria-disabled', 'false');
		button.disabled = false;
		button.click();
	}

	function assertWriteButtonsDisabled(root: HTMLElement): void {
		for (const label of WRITE_BUTTON_LABELS) {
			const button = findActionButton(root, label);
			assert.ok(button, label);
			assert.strictEqual(button.classList.contains('disabled'), true, label);
			assert.strictEqual(button.getAttribute('aria-disabled'), 'true', label);
		}
	}

	async function assertForcedWriteClicksStayUnary(
		root: HTMLElement,
		fireCalls: unknown[],
		setCalls: unknown[],
		deleteCalls: unknown[],
		upsertCalls: unknown[],
	): Promise<void> {
		const row = root.querySelector('.engine-triggers-row') as HTMLElement | null;
		row?.click();
		for (const label of WRITE_BUTTON_LABELS) {
			forceClick(findActionButton(root, label));
		}
		await flushMicrotasks();
		assert.deepStrictEqual(fireCalls, []);
		assert.deepStrictEqual(setCalls, []);
		assert.deepStrictEqual(deleteCalls, []);
		assert.deepStrictEqual(upsertCalls, []);
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

	test('DeleteTrigger success refreshes so the deleted row is gone', async () => {
		const triggerId = '  trig  ';
		let deleted = false;
		let listTriggersCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				listTriggersCalls++;
				if (deleted) {
					return { triggers: [] };
				}
				return {
					triggers: [emptyTrigger({
						triggerId,
						name: '  Nightly  ',
						type: 'cron',
						target: { kind: 'self' },
					})],
				};
			},
			deleteTrigger: async () => {
				deleted = true;
				return {};
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const del = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_DELETE_LABEL);
		assert.ok(del);
		del.click();
		await flushMicrotasks();
		assert.ok(listTriggersCalls >= 2);
		assert.strictEqual(pane.getDomNode().querySelector('.engine-triggers-row'), null);
		assert.ok((pane.getDomNode().textContent ?? '').includes('No triggers.'));
		const deleteStatus = pane.getDomNode().querySelector('.engine-triggers-delete-status') as HTMLElement | null;
		assert.ok(deleteStatus);
		assert.strictEqual(deleteStatus.textContent, ENGINE_TRIGGER_DELETE_SUCCESS_COPY);
		assert.notStrictEqual(deleteStatus.style.display, 'none');
		pane.getDomNode().parentElement?.remove();
	});

	test('DeleteTrigger success does not keep delete-success when subsequent ListTriggers fails', async () => {
		let listTriggersCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const pane = mountSection(createConversationConnectionTestStub({
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
					listTriggersCalls++;
					if (listTriggersCalls > 1) {
						throw new Error('list boom');
					}
					return {
						triggers: [emptyTrigger({
							triggerId: '  trig  ',
							name: '  Nightly  ',
							type: 'cron',
							target: { kind: 'self' },
						})],
					};
				},
				deleteTrigger: async () => {
					return {};
				},
			}));
			await flushMicrotasks();
			assert.strictEqual(listTriggersCalls, 1);
			const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
			assert.ok(row);
			row.click();
			const del = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_DELETE_LABEL);
			assert.ok(del);
			del.click();
			await flushMicrotasks();
			assert.ok(listTriggersCalls >= 2);
			const leftover = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
			assert.ok(leftover);
			assert.strictEqual(leftover.textContent, formatEngineTriggerListLabel(emptyTrigger({
				triggerId: '  trig  ',
				name: '  Nightly  ',
				type: 'cron',
				target: { kind: 'self' },
			})));
			const listHost = pane.getDomNode().querySelector('.engine-triggers-list') as HTMLElement | null;
			assert.ok(listHost);
			assert.notStrictEqual(listHost.style.display, 'none');
			const deleteStatus = pane.getDomNode().querySelector('.engine-triggers-delete-status') as HTMLElement | null;
			assert.ok(deleteStatus);
			assert.notStrictEqual(deleteStatus.textContent, ENGINE_TRIGGER_DELETE_SUCCESS_COPY);
			assert.ok(!(deleteStatus.textContent ?? '').includes(ENGINE_TRIGGER_DELETE_SUCCESS_COPY));
			const catalog = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement | null;
			assert.ok(catalog);
			assert.strictEqual(catalog.dataset['catalogMode'], 'failed');
			assert.ok((catalog.textContent ?? '').includes(getCatalogFailedCopy(ENGINE_TRIGGER_LIST_FEATURE, 'list boom')));
			assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
			assert.deepStrictEqual(unhandledRejections, []);
			pane.getDomNode().parentElement?.remove();
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('DeleteTrigger throw paints delete-status and leaves the row', async () => {
		let listTriggersCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				listTriggersCalls++;
				return {
					triggers: [emptyTrigger({
						triggerId: '  trig  ',
						name: '  Nightly  ',
						type: 'cron',
						target: { kind: 'self' },
					})],
				};
			},
			deleteTrigger: async () => {
				throw new Error('boom');
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const del = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_DELETE_LABEL);
		assert.ok(del);
		del.click();
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		const leftover = pane.getDomNode().querySelector('.engine-triggers-row');
		assert.ok(leftover);
		const deleteStatus = pane.getDomNode().querySelector('.engine-triggers-delete-status') as HTMLElement | null;
		assert.ok(deleteStatus);
		assert.strictEqual(deleteStatus.textContent, 'boom');
		assert.notStrictEqual(deleteStatus.style.display, 'none');
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger does not send when disconnected or hook missing', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: emptyTrigger() };
			},
		}));
		await flushMicrotasks();
		const disconnectedAdd = findActionButton(disconnected.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(disconnectedAdd);
		disconnectedAdd.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, []);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		const noHookAdd = findActionButton(noHook.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(noHookAdd);
		noHookAdd.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, []);
		noHook.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Add sends empty trigger as-is when connected with no selection', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: request.trigger };
			},
		}));
		await flushMicrotasks();
		const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(add);
		add.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, [{ scope: '', scopeId: '', trigger: emptyTrigger() }]);
		assert.ok((pane.getDomNode().textContent ?? '').includes(' —  — '));
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Edit sends empty trigger as-is when connected with no selection', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: request.trigger };
			},
		}));
		await flushMicrotasks();
		const edit = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_EDIT_LABEL);
		assert.ok(edit);
		edit.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, [{ scope: '', scopeId: '', trigger: emptyTrigger() }]);
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Add still sends empty trigger when a row is selected', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const selected = emptyTrigger({
			triggerId: '  trig  ',
			name: '  Nightly  ',
			type: 'cron',
			target: { kind: 'self' },
		});
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => ({
				triggers: [selected],
			}),
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: request.trigger };
			},
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(add);
		add.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, [{ scope: '', scopeId: '', trigger: emptyTrigger() }]);
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Edit sends selected trigger as-is without inventing defaults', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const selected = emptyTrigger({
			triggerId: '  trig  ',
			name: '  Nightly  ',
			type: 'cron',
			target: { kind: 'self' },
		});
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => ({
				triggers: [selected],
			}),
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: request.trigger };
			},
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const edit = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_EDIT_LABEL);
		assert.ok(edit);
		edit.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, [{ scope: '', scopeId: '', trigger: selected }]);
		assert.ok((pane.getDomNode().textContent ?? '').includes('  Nightly   — cron —   trig  '));
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Add success refreshes so the new row appears', async () => {
		const created = emptyTrigger({
			triggerId: 'trig-nightly',
			name: 'Nightly',
			type: 'cron',
			target: { kind: 'self' },
		});
		let upserted = false;
		let listTriggersCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				listTriggersCalls++;
				if (upserted) {
					return { triggers: [created] };
				}
				return { triggers: [] };
			},
			upsertTrigger: async () => {
				upserted = true;
				return { trigger: created };
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelector('.engine-triggers-row'), null);
		const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(add);
		add.click();
		await flushMicrotasks();
		assert.ok(listTriggersCalls >= 2);
		const row = pane.getDomNode().querySelector('.engine-triggers-row');
		assert.ok(row);
		assert.strictEqual(row.textContent, formatEngineTriggerListLabel(created));
		const upsertStatus = pane.getDomNode().querySelector('.engine-triggers-upsert-status') as HTMLElement | null;
		assert.ok(upsertStatus);
		assert.strictEqual(upsertStatus.textContent, formatEngineTriggerListLabel(created));
		assert.notStrictEqual(upsertStatus.style.display, 'none');
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger success does not keep upsert-success when subsequent ListTriggers fails', async () => {
		const leftover = emptyTrigger({
			triggerId: 'leftover-trig',
			name: 'leftover-nightly',
			type: 'cron',
			target: { kind: 'self' },
		});
		const created = emptyTrigger({
			triggerId: 'trig-nightly',
			name: 'Nightly',
			type: 'cron',
			target: { kind: 'self' },
		});
		let listTriggersCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const pane = mountSection(createConversationConnectionTestStub({
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
					listTriggersCalls++;
					if (listTriggersCalls > 1) {
						throw new Error('list boom');
					}
					return { triggers: [leftover] };
				},
				upsertTrigger: async () => {
					return { trigger: created };
				},
			}));
			await flushMicrotasks();
			assert.strictEqual(listTriggersCalls, 1);
			const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
			assert.ok(add);
			add.click();
			await flushMicrotasks();
			assert.ok(listTriggersCalls >= 2);
			const leftoverRow = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
			assert.ok(leftoverRow);
			assert.strictEqual(leftoverRow.textContent, formatEngineTriggerListLabel(leftover));
			const upsertStatus = pane.getDomNode().querySelector('.engine-triggers-upsert-status') as HTMLElement | null;
			assert.ok(upsertStatus);
			assert.notStrictEqual(upsertStatus.textContent, formatEngineTriggerListLabel(created));
			assert.ok(!(upsertStatus.textContent ?? '').includes(formatEngineTriggerListLabel(created)));
			const catalog = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement | null;
			assert.ok(catalog);
			assert.strictEqual(catalog.dataset['catalogMode'], 'failed');
			assert.ok((catalog.textContent ?? '').includes(getCatalogFailedCopy(ENGINE_TRIGGER_LIST_FEATURE, 'list boom')));
			assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
			assert.deepStrictEqual(unhandledRejections, []);
			pane.getDomNode().parentElement?.remove();
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('UpsertTrigger throw paints upsert-status and leaves the row', async () => {
		let listTriggersCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				listTriggersCalls++;
				return {
					triggers: [emptyTrigger({
						triggerId: '  trig  ',
						name: '  Nightly  ',
						type: 'cron',
						target: { kind: 'self' },
					})],
				};
			},
			upsertTrigger: async () => {
				throw new Error('boom');
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(add);
		add.click();
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		const leftover = pane.getDomNode().querySelector('.engine-triggers-row');
		assert.ok(leftover);
		const upsertStatus = pane.getDomNode().querySelector('.engine-triggers-upsert-status') as HTMLElement | null;
		assert.ok(upsertStatus);
		assert.strictEqual(upsertStatus.textContent, 'boom');
		assert.notStrictEqual(upsertStatus.style.display, 'none');
		pane.getDomNode().parentElement?.remove();
	});
});
