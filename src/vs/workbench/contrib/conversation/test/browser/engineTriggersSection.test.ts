/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type { UniverseAgentPublishedLinkOwner } from '../../../../../platform/universeAgent/common/universeAgentExpectedOwner.js';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot, UniverseAgentDeleteTriggerRequest, UniverseAgentFireTriggerRequest, UniverseAgentListTriggersRequest, UniverseAgentListTriggersResult, UniverseAgentSetTriggerEnabledRequest, UniverseAgentTrigger, UniverseAgentUpsertTriggerRequest } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IDialogService, type IInput, type IInputResult } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { getCatalogFailedCopy, getCatalogUnknownCopy } from '../../browser/engineCatalog.js';
import { ENGINE_TRIGGER_ADD_LABEL, ENGINE_TRIGGER_DELETE_LABEL, ENGINE_TRIGGER_DELETE_SUCCESS_COPY, ENGINE_TRIGGER_DISABLE_LABEL, ENGINE_TRIGGER_EDIT_LABEL, ENGINE_TRIGGER_ENABLE_LABEL, ENGINE_TRIGGER_FIRE_LABEL, ENGINE_TRIGGER_LIST_EMPTY_COPY, ENGINE_TRIGGER_LIST_FEATURE, formatEngineTriggerListLabel } from '../../browser/engineTriggerList.js';
import { EngineTriggersSection } from '../../browser/engineTriggersSection.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { createUnknownConversationEntryCapability, readConversationEntryCapability } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { createConversationConnectionTestStub as baseCreateConversationConnectionTestStub, createEmptyTestCapabilitySnapshot, createTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

function createConversationConnectionTestStub(overrides: Partial<IUniverseAgentConnection> = {}): IUniverseAgentConnection {
	const defaultCapabilities = overrides.getCapabilitySnapshot
		? overrides.getCapabilitySnapshot()
		: createTestCapabilitySnapshot({
			fireTrigger: { support: 'SUPPORTED' },
			setTriggerEnabled: { support: 'SUPPORTED' },
			deleteTrigger: { support: 'SUPPORTED' },
			upsertTrigger: { support: 'SUPPORTED' },
		});
	const stub = baseCreateConversationConnectionTestStub({
		getCapabilitySnapshot: () => defaultCapabilities,
		...overrides,
	});
	if (!overrides.getConnectionSnapshot) {
		const originalGetSnapshot = stub.getConnectionSnapshot;
		stub.getConnectionSnapshot = (): UniverseAgentConnectionSnapshot => {
			const base = originalGetSnapshot();
			return {
				...base,
				...(stub.isEngineConnected() ? { engineIdentityId: 'test-engine', linkId: 1 } : {}),
				capabilities: defaultCapabilities,
				conversationEntryCapability: {
					...readConversationEntryCapability(base),
					listTriggers: 'SUPPORTED',
				},
			};
		};
	}
	return stub;
}

suite('EngineTriggersSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountSection(connection: IUniverseAgentConnection, dialog?: TestDialogService): EngineTriggersSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		if (dialog) {
			instantiationService.stub(IDialogService, dialog);
		}
		const section = store.add(instantiationService.createInstance(EngineTriggersSection, parent));
		section.setSectionActive(true);
		return section;
	}

	function confirmTriggerDialog(options: {
		readonly name?: string;
		readonly type?: string;
		readonly prompt?: string;
		readonly interval?: string;
		readonly cron?: string;
		readonly target?: string;
		readonly checkboxChecked?: boolean;
		readonly confirmed?: boolean;
	} = {}): TestDialogService {
		const dialog = new TestDialogService();
		dialog.setInputResult({
			confirmed: options.confirmed ?? true,
			values: [
				options.name ?? '',
				options.type ?? '',
				options.prompt ?? '',
				options.interval ?? '',
				options.cron ?? '',
				options.target ?? '',
			],
			checkboxChecked: options.checkboxChecked,
		});
		return dialog;
	}

	function scriptedTriggerDialog(results: IInputResult[]): { readonly dialog: TestDialogService; readonly seen: IInput[] } {
		const pending = [...results];
		const seen: IInput[] = [];
		const dialog = new class extends TestDialogService {
			override async input(input: IInput): Promise<IInputResult> {
				seen.push(input);
				return pending.shift() ?? { confirmed: false };
			}
		}();
		return { dialog, seen };
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	test('ListTriggers does not send when listTriggers capability is UNKNOWN', async () => {
		let listTriggersCalls = 0;
		const baseStub = baseCreateConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => {
				listTriggersCalls++;
				return { triggers: [] };
			},
		});
		const pane = mountSection(baseStub);
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 0);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 0);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		const text = pane.getDomNode().textContent ?? '';
		assert.ok(text.includes(getCatalogUnknownCopy()));
		assert.ok(!text.includes('does not expose'));
		assert.ok(!text.includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('ListTriggers success then capability becomes UNKNOWN keeps leftover rows and does not call list', async () => {
		let listCalls = 0;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const leftover = emptyTrigger({
			triggerId: 'leftover-trig',
			name: 'leftover-nightly',
		});
		let capability: 'SUPPORTED' | 'UNKNOWN' = 'SUPPORTED';
		const connection = baseCreateConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: createEmptyTestCapabilitySnapshot(),
				conversationEntryCapability: {
					...createUnknownConversationEntryCapability(),
					listTriggers: capability,
				},
			}),
			onDidChangeConnection: onDidChangeConnection.event,
			listTriggers: async () => {
				listCalls++;
				return { triggers: [leftover] };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(listCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);

		capability = 'UNKNOWN';
		onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();
		assert.strictEqual(listCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);
		const listHost = pane.getDomNode().querySelector('.engine-triggers-list') as HTMLElement;
		assert.ok(listHost);
		assert.notStrictEqual(listHost.style.display, 'none');
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		const text = pane.getDomNode().textContent ?? '';
		assert.ok(text.includes(getCatalogUnknownCopy()));
		assert.ok(!text.includes('does not expose'));
		assert.ok(!text.includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

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
			conversationEntryCapability: {
				...readConversationEntryCapability(undefined),
				listTriggers: 'SUPPORTED',
			},
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
			conversationEntryCapability: {
				...readConversationEntryCapability(undefined),
				listTriggers: 'SUPPORTED',
			},
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

	test('leftover-looks-live first-pull pairing without leftover stays empty and skips list', async () => {
		let listTriggersCalls = 0;
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			pairingPending: true,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => {
				listTriggersCalls++;
				return {
					triggers: [emptyTrigger({
						triggerId: 'should-not-list',
						name: 'First Pull',
						type: 'cron',
						target: { kind: 'self' },
					})],
				};
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(listTriggersCalls, 0);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 0);
		const listHost = pane.getDomNode().querySelector('.engine-triggers-list') as HTMLElement | null;
		assert.ok(listHost);
		assert.strictEqual(listHost.style.display, 'none');
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_TRIGGER_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('list-fail leftover closes write chrome without reselect', async () => {
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
			capabilities: createTestCapabilitySnapshot({
				fireTrigger: { support: 'SUPPORTED' },
				setTriggerEnabled: { support: 'SUPPORTED' },
				deleteTrigger: { support: 'SUPPORTED' },
				upsertTrigger: { support: 'SUPPORTED' },
			}),
			conversationEntryCapability: {
				...readConversationEntryCapability(undefined),
				listTriggers: 'SUPPORTED',
			},
		};
		const fireCalls: UniverseAgentFireTriggerRequest[] = [];
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		const deleteCalls: UniverseAgentDeleteTriggerRequest[] = [];
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => liveSnapshot,
			getCapabilitySnapshot: () => liveSnapshot.capabilities,
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
		const liveFire = findFireButton(pane.getDomNode());
		assert.ok(liveFire);
		assert.strictEqual(liveFire.classList.contains('disabled'), false);

		onDidChangeConnection.fire(liveSnapshot);
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 2);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-triggers-row').length, 1);
		const leftoverRow = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(leftoverRow);
		assert.strictEqual(leftoverRow.textContent, formatEngineTriggerListLabel(leftover));
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assertWriteButtonsDisabled(pane.getDomNode());
		await assertForcedWriteClicksStayUnary(pane.getDomNode(), fireCalls, setCalls, deleteCalls, upsertCalls);
		assert.strictEqual(listTriggersCalls, 2);
		pane.getDomNode().parentElement?.remove();
	});

	const WRITE_ACTION_BUTTONS = [
		[ENGINE_TRIGGER_ADD_LABEL, 'codicon-add'],
		[ENGINE_TRIGGER_EDIT_LABEL, 'codicon-edit'],
		[ENGINE_TRIGGER_FIRE_LABEL, 'codicon-play'],
		[ENGINE_TRIGGER_ENABLE_LABEL, 'codicon-check'],
		[ENGINE_TRIGGER_DISABLE_LABEL, 'codicon-circle-slash'],
		[ENGINE_TRIGGER_DELETE_LABEL, 'codicon-trash'],
	] as const;

	function findActionButton(root: HTMLElement, label: string): HTMLButtonElement | undefined {
		const button = [...root.querySelectorAll('.engine-triggers-actions .monaco-button')]
			.find(candidate => candidate.getAttribute('aria-label') === label) as HTMLButtonElement | undefined;
		if (button) {
			const icon = WRITE_ACTION_BUTTONS.find(([actionLabel]) => actionLabel === label)?.[1];
			assert.ok(icon && button.classList.contains('codicon') && button.classList.contains(icon), label);
			assert.strictEqual(button.textContent, '', label);
		}
		return button;
	}

	function findFireButton(root: HTMLElement): HTMLButtonElement | undefined {
		return findActionButton(root, ENGINE_TRIGGER_FIRE_LABEL);
	}

	const WRITE_BUTTON_LABELS = WRITE_ACTION_BUTTONS.map(([label]) => label);

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
		for (const label of [ENGINE_TRIGGER_ADD_LABEL, ENGINE_TRIGGER_EDIT_LABEL, ENGINE_TRIGGER_FIRE_LABEL, ENGINE_TRIGGER_DELETE_LABEL]) {
			const button = findActionButton(root, label);
			assert.ok(button, label);
			assert.strictEqual(button.classList.contains('disabled'), true, label);
			assert.strictEqual(button.getAttribute('aria-disabled'), 'true', label);
		}
		const stateButtons = [
			findActionButton(root, ENGINE_TRIGGER_ENABLE_LABEL),
			findActionButton(root, ENGINE_TRIGGER_DISABLE_LABEL),
		].filter((button): button is HTMLButtonElement => !!button);
		assert.strictEqual(stateButtons.length, 1, 'exactly one state action is painted');
		assert.strictEqual(stateButtons[0].classList.contains('disabled'), true, 'state action');
		assert.strictEqual(stateButtons[0].getAttribute('aria-disabled'), 'true', 'state action');
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

	type PublishedTriggerState = {
		engineIdentityId?: string;
		linkId?: number;
	};

	function publishedTriggerSnapshot(state: PublishedTriggerState): UniverseAgentConnectionSnapshot {
		return {
			transport: 'ok',
			authenticated: true,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
			conversationEntryCapability: {
				...createUnknownConversationEntryCapability(),
				listTriggers: 'SUPPORTED',
			},
			engineIdentityId: state.engineIdentityId,
			linkId: state.linkId,
		};
	}

	class HeldTriggerDialog extends TestDialogService {
		private resolveInput: ((result: IInputResult) => void) | undefined;

		override input(_input: IInput): Promise<IInputResult> {
			return new Promise(resolve => { this.resolveInput = resolve; });
		}

		finish(result: IInputResult): void {
			const resolve = this.resolveInput;
			assert.ok(resolve, 'upsert opened the input dialog');
			this.resolveInput = undefined;
			resolve(result);
		}
	}

	function assertWriteStatusUnpainted(status: HTMLElement | null, label: string): void {
		assert.ok(status, label);
		assert.strictEqual(status.style.display, 'none', label);
		assert.strictEqual(status.textContent, '', label);
		assert.ok(!status.classList.contains('is-success'), label);
		assert.ok(!status.classList.contains('is-error'), label);
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

	test('write buttons stay off when proxy methods exist but the snapshot is UNSUPPORTED', async () => {
		const unsupported = { support: 'UNSUPPORTED' as const, reason: 'method not advertised' };
		const fireCalls: UniverseAgentFireTriggerRequest[] = [];
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		const deleteCalls: UniverseAgentDeleteTriggerRequest[] = [];
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => createTestCapabilitySnapshot({
				fireTrigger: unsupported,
				setTriggerEnabled: unsupported,
				deleteTrigger: unsupported,
				upsertTrigger: unsupported,
			}),
			listTriggers: async () => ({ triggers: [] }),
			fireTrigger: async request => {
				fireCalls.push(request);
				return { status: '', eventId: '', reason: '' };
			},
			setTriggerEnabled: async request => {
				setCalls.push(request);
				return { trigger: emptyTrigger() };
			},
			deleteTrigger: async request => {
				deleteCalls.push(request);
				return {};
			},
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: emptyTrigger() };
			},
		}));
		await flushMicrotasks();
		assertWriteButtonsDisabled(pane.getDomNode());
		await assertForcedWriteClicksStayUnary(pane.getDomNode(), fireCalls, setCalls, deleteCalls, upsertCalls);
		pane.getDomNode().parentElement?.remove();
	});

	test('write buttons stay disabled with hover hints when capability is UNKNOWN', async () => {
		const unknownCapability = { support: 'UNKNOWN' as const };
		const pane = mountSection(baseCreateConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: createTestCapabilitySnapshot({
					fireTrigger: unknownCapability,
					setTriggerEnabled: unknownCapability,
					deleteTrigger: unknownCapability,
					upsertTrigger: unknownCapability,
				}),
				conversationEntryCapability: {
					...readConversationEntryCapability(undefined),
					listTriggers: 'SUPPORTED',
				},
			}),
			getCapabilitySnapshot: () => createTestCapabilitySnapshot({
				fireTrigger: unknownCapability,
				setTriggerEnabled: unknownCapability,
				deleteTrigger: unknownCapability,
				upsertTrigger: unknownCapability,
			}),
			listTriggers: async () => ({ triggers: [] }),
			fireTrigger: async () => ({ status: '', eventId: '', reason: '' }),
			setTriggerEnabled: async () => ({ trigger: emptyTrigger() }),
			deleteTrigger: async () => ({}),
			upsertTrigger: async () => ({ trigger: emptyTrigger() }),
		}));
		await flushMicrotasks();
		assertWriteButtonsDisabled(pane.getDomNode());

		const fireButton = findFireButton(pane.getDomNode());
		assert.ok(fireButton);
		assert.ok(fireButton.title.length > 0);
		assert.ok(fireButton.title.includes('Fire'));

		const addButton = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(addButton);
		assert.ok(addButton.title.length > 0);
		assert.ok(addButton.title.includes('Add'));

		pane.getDomNode().parentElement?.remove();
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

	test('FireTrigger empty status is error; unknown status stays neutral; empty parts are dropped', async () => {
		let call = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			fireTrigger: async () => {
				call++;
				if (call === 1) {
					return { status: '', eventId: '', reason: '' };
				}
				if (call === 2) {
					return { status: 'FIRED', eventId: 'evt-1', reason: 'queued' };
				}
				return { status: '', eventId: 'evt-2', reason: 'rejected' };
			},
		}));
		await flushMicrotasks();
		const fire = findFireButton(pane.getDomNode());
		assert.ok(fire);
		fire.click();
		await flushMicrotasks();
		const status = pane.getDomNode().querySelector('.engine-triggers-fire-status') as HTMLElement | null;
		assert.ok(status);
		assert.strictEqual(status.textContent, 'The engine returned no fire status.');
		assert.ok(!status.classList.contains('is-success'));
		assert.ok(status.classList.contains('is-error'));
		assert.ok(!status.classList.contains('is-warning'));
		assert.ok(!status.classList.contains('is-pending'));
		assert.deepStrictEqual([...status.classList], ['engine-triggers-fire-status', 'is-error']);
		fire.click();
		await flushMicrotasks();
		assert.strictEqual(status.textContent, 'FIRED — evt-1 — queued');
		assert.ok(!status.classList.contains('is-success'));
		assert.ok(!status.classList.contains('is-error'));
		assert.deepStrictEqual([...status.classList], ['engine-triggers-fire-status']);
		fire.click();
		await flushMicrotasks();
		// The exact text also proves a missing status is dropped, not printed as "undefined".
		assert.strictEqual(status.textContent, 'evt-2 — rejected');
		assert.ok(status.classList.contains('is-error'));
		assert.deepStrictEqual([...status.classList], ['engine-triggers-fire-status', 'is-error']);
		pane.getDomNode().parentElement?.remove();
	});

	test('FireTrigger throw stays error tone', async () => {
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			fireTrigger: async () => {
				throw new Error('fire boom');
			},
		}));
		await flushMicrotasks();
		const fire = findFireButton(pane.getDomNode());
		assert.ok(fire);
		fire.click();
		await flushMicrotasks();
		const status = pane.getDomNode().querySelector('.engine-triggers-fire-status') as HTMLElement | null;
		assert.ok(status);
		assert.strictEqual(status.textContent, 'fire boom');
		assert.ok(status.classList.contains('is-error'));
		assert.ok(!status.classList.contains('is-success'));
		pane.getDomNode().parentElement?.remove();
	});

	test('FireTrigger tone follows engine status values only, not status words or reason', async () => {
		let call = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			fireTrigger: async () => {
				call++;
				if (call === 1) {
					return { status: 'FAILED', eventId: 'evt-fail', reason: 'quota exceeded' };
				}
				if (call === 2) {
					return { status: 'TRIGGER_FIRE_STATUS_REJECTED', eventId: 'evt-rej', reason: 'policy check rejected' };
				}
				if (call === 3) {
					return { status: 'ERROR', eventId: 'evt-err', reason: 'crash' };
				}
				if (call === 4) {
					return { status: 'CUSTOM_STATUS', eventId: 'evt-cn', reason: '触发失败：权限不足' };
				}
				if (call === 5) {
					return { status: 'FIRED', eventId: 'evt-ok', reason: 'no error' };
				}
				if (call === 6) {
				return { status: '   ', eventId: 'evt-ws', reason: 'whitespace status' };
				}
				if (call === 7) {
					return { status: 'queued', eventId: 'evt-q', reason: '' };
				}
				if (call === 8) {
					return { status: 'EXECUTED', eventId: 'evt-x', reason: '' };
				}
				if (call === 9) {
					return { status: 'rejected', eventId: '', reason: 'disabled' };
				}
				return { status: 'skipped', eventId: '', reason: 'duplicate' };
			},
		}));
		await flushMicrotasks();
		const fire = findFireButton(pane.getDomNode());
		assert.ok(fire);

		// Call 1: FAILED -> neutral
		fire.click();
		await flushMicrotasks();
		let status = pane.getDomNode().querySelector('.engine-triggers-fire-status') as HTMLElement | null;
		assert.ok(status);
		assert.strictEqual(status.textContent, 'FAILED — evt-fail — quota exceeded');
		assert.ok(!status.classList.contains('is-error'));

		// Call 2: REJECTED -> neutral
		fire.click();
		await flushMicrotasks();
		assert.strictEqual(status.textContent, 'TRIGGER_FIRE_STATUS_REJECTED — evt-rej — policy check rejected');
		assert.ok(!status.classList.contains('is-error'));

		// Call 3: ERROR -> neutral
		fire.click();
		await flushMicrotasks();
		assert.strictEqual(status.textContent, 'ERROR — evt-err — crash');
		assert.ok(!status.classList.contains('is-error'));

		// Call 4: Chinese failure reason -> neutral
		fire.click();
		await flushMicrotasks();
		assert.strictEqual(status.textContent, 'CUSTOM_STATUS — evt-cn — 触发失败：权限不足');
		assert.ok(!status.classList.contains('is-error'));

		// Call 5: FIRED with 'no error' -> neutral
		fire.click();
		await flushMicrotasks();
		assert.strictEqual(status.textContent, 'FIRED — evt-ok — no error');
		assert.ok(!status.classList.contains('is-error'));

		// Call 6: Whitespace-only status counts as empty -> error, part dropped
		fire.click();
		await flushMicrotasks();
		assert.strictEqual(status.textContent, 'evt-ws — whitespace status');
		assert.ok(status.classList.contains('is-error'));

		// Call 7: engine `queued` -> success
		fire.click();
		await flushMicrotasks();
		assert.strictEqual(status.textContent, 'queued — evt-q');
		assert.deepStrictEqual([...status.classList], ['engine-triggers-fire-status', 'is-success']);

		// Call 8: engine `executed`, compared case-insensitively -> success
		fire.click();
		await flushMicrotasks();
		assert.strictEqual(status.textContent, 'EXECUTED — evt-x');
		assert.deepStrictEqual([...status.classList], ['engine-triggers-fire-status', 'is-success']);

		// Call 9: engine `rejected` -> error
		fire.click();
		await flushMicrotasks();
		assert.strictEqual(status.textContent, 'rejected — disabled');
		assert.deepStrictEqual([...status.classList], ['engine-triggers-fire-status', 'is-error']);

		// Call 10: engine `skipped` -> neutral
		fire.click();
		await flushMicrotasks();
		assert.strictEqual(status.textContent, 'skipped — duplicate');
		assert.deepStrictEqual([...status.classList], ['engine-triggers-fire-status']);

		pane.getDomNode().parentElement?.remove();
	});

	test('SetTriggerEnabled stays disabled when disconnected or hook missing', async () => {
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			setTriggerEnabled: async request => {
				setCalls.push(request);
				return { trigger: emptyTrigger() };
			},
		}));
		await flushMicrotasks();
		const disconnectedEnable = findActionButton(disconnected.getDomNode(), ENGINE_TRIGGER_ENABLE_LABEL);
		assert.ok(disconnectedEnable);
		assert.strictEqual(disconnectedEnable.classList.contains('disabled'), true);
		disconnectedEnable.click();
		await flushMicrotasks();
		assert.deepStrictEqual(setCalls, []);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		const noHookEnable = findActionButton(noHook.getDomNode(), ENGINE_TRIGGER_ENABLE_LABEL);
		assert.ok(noHookEnable);
		assert.strictEqual(noHookEnable.classList.contains('disabled'), true);
		noHookEnable.click();
		await flushMicrotasks();
		assert.deepStrictEqual(setCalls, []);
		noHook.getDomNode().parentElement?.remove();
	});

	test('SetTriggerEnabled stays disabled when connected with no selection', async () => {
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
		const enable = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ENABLE_LABEL);
		assert.ok(enable);
		assert.strictEqual(enable.classList.contains('disabled'), true);
		enable.click();
		await flushMicrotasks();
		assert.deepStrictEqual(setCalls, []);
		const status = pane.getDomNode().querySelector<HTMLElement>('.engine-triggers-enabled-status');
		assert.ok(status);
		assert.strictEqual(status.style.display, 'none');
		assert.strictEqual(status.textContent, '');
		pane.getDomNode().parentElement?.remove();
	});

	test('SetTriggerEnabled tone is error when returned enabled does not match the request', async () => {
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		const trigger = emptyTrigger({
			triggerId: 'trig-1',
			name: 'Nightly',
			type: 'cron',
			target: { kind: 'self' },
			enabled: true,
		});
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => ({ triggers: [trigger] }),
			setTriggerEnabled: async request => {
				setCalls.push(request);
				return {
					trigger: emptyTrigger({
						triggerId: request.triggerId,
						name: 'Nightly',
						type: 'cron',
						target: { kind: 'self' },
						enabled: !request.enabled,
					}),
				};
			},
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const disable = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_DISABLE_LABEL);
		assert.ok(disable);
		disable.click();
		await flushMicrotasks();
		assert.deepStrictEqual(setCalls, [{ scope: '', scopeId: '', triggerId: 'trig-1', enabled: false }]);
		const status = pane.getDomNode().querySelector('.engine-triggers-enabled-status') as HTMLElement | null;
		assert.ok(status);
		assert.strictEqual(status.textContent, `${formatEngineTriggerListLabel(emptyTrigger({
			triggerId: 'trig-1',
			name: 'Nightly',
			type: 'cron',
			target: { kind: 'self' },
			enabled: true,
		}))} — true`);
		assert.ok(!status.classList.contains('is-success'));
		assert.ok(status.classList.contains('is-error'));
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
		assert.deepStrictEqual([...deleteStatus.classList], ['engine-triggers-delete-status', 'is-success']);
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
		assert.deepStrictEqual([...deleteStatus.classList], ['engine-triggers-delete-status', 'is-error']);
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

	test('UpsertTrigger Add does not send when the form has no name or type', async () => {
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
		assert.deepStrictEqual(upsertCalls, []);
		const upsertStatus = pane.getDomNode().querySelector('.engine-triggers-upsert-status') as HTMLElement | null;
		assert.ok(upsertStatus);
		assert.strictEqual(upsertStatus.textContent, 'Name is required.');
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Add does not send when type is blank', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: request.trigger };
			},
		}), confirmTriggerDialog({ name: 'Nightly', type: '   ', checkboxChecked: true }));
		await flushMicrotasks();
		const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(add);
		add.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, []);
		const upsertStatus = pane.getDomNode().querySelector('.engine-triggers-upsert-status') as HTMLElement | null;
		assert.ok(upsertStatus);
		assert.strictEqual(upsertStatus.textContent, 'Type is required.');
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Add does not send when interval or target is invalid', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const { dialog, seen } = scriptedTriggerDialog([
			{ confirmed: true, values: ['Nightly', 'cron', '', '1.5', '', 'self'], checkboxChecked: true },
			{ confirmed: true, values: ['Nightly', 'cron', '', '20', '', 'nope'], checkboxChecked: true },
			{ confirmed: false, values: ['Nightly', 'cron', '', '20', '', 'self'], checkboxChecked: true },
		]);
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: request.trigger };
			},
		}), dialog);
		await flushMicrotasks();
		const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(add);
		add.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, []);
		const upsertStatus = pane.getDomNode().querySelector('.engine-triggers-upsert-status') as HTMLElement | null;
		assert.ok(upsertStatus);
		assert.strictEqual(upsertStatus.textContent, 'Interval must be a whole number, or left blank.');
		add.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, []);
		assert.strictEqual(upsertStatus.textContent, 'Target must be self, bound:<sessionId>, or new:<profileId>.');
		add.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, []);
		assert.strictEqual(seen.length, 3);
		assert.strictEqual(seen[0].validate?.(['', 'cron']), 'Name is required.');
		assert.strictEqual(seen[0].validate?.(['Nightly', '']), 'Type is required.');
		assert.strictEqual(seen[0].validate?.(['Nightly', 'cron', '', 'nope', '', 'nope']), undefined);
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Edit does not send when nothing is selected', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const { dialog, seen } = scriptedTriggerDialog([
			{ confirmed: true, values: ['Nightly', 'cron'], checkboxChecked: true },
		]);
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: request.trigger };
			},
		}), dialog);
		await flushMicrotasks();
		const edit = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_EDIT_LABEL);
		assert.ok(edit);
		edit.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, []);
		assert.deepStrictEqual(seen, []);
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Edit does not resend the selected trigger when the dialog is empty', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const selected = emptyTrigger({
			triggerId: 'trig-keep',
			name: 'Nightly',
			type: 'cron',
			enabled: true,
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
		assert.deepStrictEqual(upsertCalls, []);
		assert.strictEqual(pane.getDomNode().querySelector('.engine-triggers-upsert-status')?.textContent, 'Name is required.');
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Add sends the dialog draft and does not copy the selected row', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const selected = emptyTrigger({
			triggerId: '  trig  ',
			name: '  Nightly  ',
			type: 'cron',
			promptTemplate: 'old prompt',
			enabled: true,
			pauseReason: 'held',
			target: { kind: 'self' },
			intervalMs: 1500,
			cronExpression: '0 * * * *',
			runAtEpochMs: 42,
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
		}), confirmTriggerDialog({
			name: 'Nightly',
			type: 'cron',
			prompt: 'run it',
			interval: '  2500  ',
			cron: '0 0 * * *',
			target: '  new:profile-1  ',
			checkboxChecked: true,
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(add);
		add.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, [{
			scope: '',
			scopeId: '',
			trigger: {
				triggerId: '',
				name: 'Nightly',
				type: 'cron',
				promptTemplate: 'run it',
				enabled: true,
				pauseReason: '',
				target: { kind: 'newSession', engineProfileId: 'profile-1' },
				intervalMs: 2500,
				cronExpression: '0 0 * * *',
				runAtEpochMs: 0,
			},
		}]);
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Add sends blanks as empty fields and enabled false when the checkbox is omitted', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const { dialog } = scriptedTriggerDialog([
			{ confirmed: true, values: ['Nightly', 'cron', '   ', '   ', '   ', '   '] },
			{ confirmed: true, values: ['Nightly', 'cron', '', '', '', 'self'] },
			{ confirmed: true, values: ['Nightly', 'cron', '', '', '', 'bound:sess-1'], checkboxChecked: false },
		]);
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: request.trigger };
			},
		}), dialog);
		await flushMicrotasks();
		const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(add);
		add.click();
		await flushMicrotasks();
		add.click();
		await flushMicrotasks();
		add.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls.map(call => call.trigger), [
			emptyTrigger({ name: 'Nightly', type: 'cron', enabled: false }),
			emptyTrigger({ name: 'Nightly', type: 'cron', enabled: false, target: { kind: 'self' } }),
			emptyTrigger({ name: 'Nightly', type: 'cron', enabled: false, target: { kind: 'boundSession', sessionId: 'sess-1' } }),
		]);
		assert.ok(upsertCalls.every(call => call.scope === '' && call.scopeId === ''));
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Edit sends dialog values and keeps fields the form left blank', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const selected = emptyTrigger({
			triggerId: '  trig  ',
			name: '  Nightly  ',
			type: 'cron',
			promptTemplate: 'keep-me',
			enabled: true,
			pauseReason: 'held',
			target: { kind: 'boundSession', sessionId: 'sess-9' },
			intervalMs: 1500,
			cronExpression: '0 * * * *',
			runAtEpochMs: 42,
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
		}), confirmTriggerDialog({
			name: 'Renamed',
			type: 'interval',
			checkboxChecked: false,
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const edit = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_EDIT_LABEL);
		assert.ok(edit);
		edit.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, [{
			scope: '',
			scopeId: '',
			trigger: {
				triggerId: '  trig  ',
				name: 'Renamed',
				type: 'interval',
				promptTemplate: 'keep-me',
				enabled: false,
				pauseReason: 'held',
				target: { kind: 'boundSession', sessionId: 'sess-9' },
				intervalMs: 1500,
				cronExpression: '0 * * * *',
				runAtEpochMs: 42,
			},
		}]);
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Edit replaces non-blank fields and does not keep enabled from the row', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const selected = emptyTrigger({
			triggerId: 'trig-keep',
			name: 'Old',
			type: 'interval',
			promptTemplate: 'old prompt',
			enabled: false,
			pauseReason: 'held',
			target: { kind: 'boundSession', sessionId: 'sess-9' },
			intervalMs: 5,
			cronExpression: 'old',
			runAtEpochMs: 77,
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
		}), confirmTriggerDialog({
			name: '  Renamed  ',
			type: 'cron',
			prompt: 'new prompt',
			interval: '0',
			cron: '*/5 * * * *',
			target: 'self',
			checkboxChecked: true,
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const edit = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_EDIT_LABEL);
		assert.ok(edit);
		edit.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, [{
			scope: '',
			scopeId: '',
			trigger: {
				triggerId: 'trig-keep',
				name: '  Renamed  ',
				type: 'cron',
				promptTemplate: 'new prompt',
				enabled: true,
				pauseReason: 'held',
				target: { kind: 'self' },
				intervalMs: 0,
				cronExpression: '*/5 * * * *',
				runAtEpochMs: 77,
			},
		}]);
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger dialog is prefilled for edit and empty for add', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const selected = emptyTrigger({
			triggerId: 'trig-1',
			name: 'Nightly',
			type: 'cron',
			promptTemplate: 'do the thing',
			enabled: true,
			pauseReason: 'manual',
			target: { kind: 'boundSession', sessionId: 'sess-9' },
			intervalMs: 1500,
			cronExpression: '0 0 * * *',
			runAtEpochMs: 99,
		});
		const { dialog, seen } = scriptedTriggerDialog([
			{ confirmed: false },
			{ confirmed: false },
		]);
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
		}), dialog);
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const edit = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_EDIT_LABEL);
		const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
		assert.ok(edit);
		assert.ok(add);
		edit.click();
		await flushMicrotasks();
		add.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertCalls, []);
		assert.strictEqual(seen.length, 2);
		assert.strictEqual(seen[0].message, 'Edit trigger');
		assert.strictEqual(seen[0].primaryButton, 'Save');
		assert.deepStrictEqual(seen[0].checkbox, { label: 'Enabled', checked: true });
		assert.deepStrictEqual(seen[0].inputs, [
			{ type: 'text', label: 'Name', placeholder: 'Name', value: 'Nightly' },
			{ type: 'text', label: 'Type', placeholder: 'Type', value: 'cron' },
			{ type: 'text', label: 'Prompt', placeholder: 'Prompt', value: 'do the thing' },
			{ type: 'text', label: 'Interval (ms)', placeholder: 'Interval (ms)', value: '1500' },
			{ type: 'text', label: 'Cron', placeholder: 'Cron', value: '0 0 * * *' },
			{ type: 'text', label: 'Target', placeholder: 'self, bound:<sessionId>, or new:<profileId>', value: 'bound:sess-9' },
		]);
		assert.strictEqual(seen[1].message, 'Add trigger');
		assert.strictEqual(seen[1].primaryButton, 'Add');
		assert.deepStrictEqual(seen[1].checkbox, { label: 'Enabled', checked: false });
		assert.deepStrictEqual(seen[1].inputs?.map(input => input.value), ['', '', '', '', '', '']);
		pane.getDomNode().parentElement?.remove();
	});

	test('UpsertTrigger Edit success refreshes so the updated row appears', async () => {
		const existing = emptyTrigger({
			triggerId: 'trig-nightly',
			name: 'Nightly',
			type: 'cron',
			target: { kind: 'self' },
		});
		const updated = emptyTrigger({
			triggerId: 'trig-nightly',
			name: 'Nightly Updated',
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
					return { triggers: [updated] };
				}
				return { triggers: [existing] };
			},
			upsertTrigger: async request => {
				assert.deepStrictEqual(request, {
					scope: '',
					scopeId: '',
					trigger: emptyTrigger({ triggerId: 'trig-nightly', name: 'Nightly', type: 'cron', enabled: true, target: { kind: 'self' } }),
				});
				upserted = true;
				return { trigger: updated };
			},
		}), confirmTriggerDialog({ name: 'Nightly', type: 'cron', checkboxChecked: true }));
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const edit = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_EDIT_LABEL);
		assert.ok(edit);
		edit.click();
		await flushMicrotasks();
		assert.ok(listTriggersCalls >= 2);
		const updatedRow = pane.getDomNode().querySelector('.engine-triggers-row');
		assert.ok(updatedRow);
		assert.strictEqual(updatedRow.textContent, formatEngineTriggerListLabel(updated));
		const upsertStatus = pane.getDomNode().querySelector('.engine-triggers-upsert-status') as HTMLElement | null;
		assert.ok(upsertStatus);
		assert.strictEqual(upsertStatus.textContent, formatEngineTriggerListLabel(updated));
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
				upsertTrigger: async request => {
					assert.deepStrictEqual(request, {
						scope: '',
						scopeId: '',
						trigger: emptyTrigger({ triggerId: 'leftover-trig', name: 'Nightly', type: 'cron', enabled: true, target: { kind: 'self' } }),
					});
					return { trigger: created };
				},
			}), confirmTriggerDialog({ name: 'Nightly', type: 'cron', checkboxChecked: true }));
			await flushMicrotasks();
			assert.strictEqual(listTriggersCalls, 1);
			const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
			assert.ok(row);
			row.click();
			const edit = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_EDIT_LABEL);
			assert.ok(edit);
		edit.click();
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
			upsertTrigger: async request => {
				assert.deepStrictEqual(request, {
					scope: '',
					scopeId: '',
					trigger: emptyTrigger({ triggerId: '  trig  ', name: 'Nightly', type: 'cron', enabled: false, target: { kind: 'self' } }),
				});
				throw new Error('boom');
			},
		}), confirmTriggerDialog({ name: 'Nightly', type: 'cron', checkboxChecked: false }));
		await flushMicrotasks();
		assert.strictEqual(listTriggersCalls, 1);
		const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
		assert.ok(row);
		row.click();
		const edit = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_EDIT_LABEL);
		assert.ok(edit);
		edit.click();
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

	test('does not leak unhandled rejection when refresh catch-path render throws and onUnexpectedError logs', async () => {
		// refresh() already catches list throw; a lone inner reject does not leak.
		// The void call site still needs `.catch` when the catch-path render throws.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
		});
		try {
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			const instantiationService = workbenchInstantiationService(undefined, store);
			instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub({
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				listTriggers: async () => {
					throw new Error('list boom');
				},
			}));
			const section = store.add(instantiationService.createInstance(EngineTriggersSection, parent));
			const status = (section as unknown as { status: { render(options: { readonly mode: string }): void } }).status;
			const originalRender = status.render.bind(status);
			status.render = (options: { readonly mode: string }) => {
				if (options.mode === 'failed') {
					throw paintBoom;
				}
				originalRender(options);
			};
			section.setSectionActive(true);
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom],
			});
			parent.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	async function assertWriteClickDoesNotLeakWhenCatchPathPaintWarnThenRethrows(options: {
		readonly buttonLabel: string;
		readonly statusSelector: string;
		readonly initialTriggers?: readonly UniverseAgentTrigger[];
		readonly fireTrigger?: IUniverseAgentConnection['fireTrigger'];
		readonly setTriggerEnabled?: IUniverseAgentConnection['setTriggerEnabled'];
		readonly deleteTrigger?: IUniverseAgentConnection['deleteTrigger'];
		readonly upsertTrigger?: IUniverseAgentConnection['upsertTrigger'];
		readonly dialog?: TestDialogService;
	}): Promise<void> {
		// handleUpsert / handleFire / handleSetEnabled / handleDelete already catch RPC throw;
		// a lone inner reject does not leak. The void click site still needs `.catch` when
		// the catch-path write-status paint throws.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
		});
		try {
			const pane = mountSection(createConversationConnectionTestStub({
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				listTriggers: async () => ({ triggers: [...(options.initialTriggers ?? [])] }),
				fireTrigger: options.fireTrigger,
				setTriggerEnabled: options.setTriggerEnabled,
				deleteTrigger: options.deleteTrigger,
				upsertTrigger: options.upsertTrigger,
			}), options.dialog);
			await flushMicrotasks();
			if (options.initialTriggers && options.initialTriggers.length > 0) {
				const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
				assert.ok(row);
				row.click();
			}
			const writeStatusEl = pane.getDomNode().querySelector(options.statusSelector) as HTMLElement | null;
			assert.ok(writeStatusEl);
			Object.defineProperty(writeStatusEl, 'textContent', {
				configurable: true,
				get: () => '',
				set: (value: string) => {
					if (value) {
						throw paintBoom;
					}
				},
			});
			const button = findActionButton(pane.getDomNode(), options.buttonLabel);
			assert.ok(button, `${options.buttonLabel} write button must be painted`);
			button.click();
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom],
			});
			pane.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	}

	test('does not leak unhandled rejection when handleUpsert catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		await assertWriteClickDoesNotLeakWhenCatchPathPaintWarnThenRethrows({
			buttonLabel: ENGINE_TRIGGER_ADD_LABEL,
			statusSelector: '.engine-triggers-upsert-status',
			dialog: confirmTriggerDialog({ name: 'Nightly', type: 'cron', checkboxChecked: true }),
			upsertTrigger: async request => {
				upsertCalls.push(request);
				throw new Error('upsert boom');
			},
		});
		assert.deepStrictEqual(upsertCalls, [{
			scope: '',
			scopeId: '',
			trigger: emptyTrigger({ name: 'Nightly', type: 'cron', enabled: true }),
		}]);
	});

	test('does not leak unhandled rejection when handleFire catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		await assertWriteClickDoesNotLeakWhenCatchPathPaintWarnThenRethrows({
			buttonLabel: ENGINE_TRIGGER_FIRE_LABEL,
			statusSelector: '.engine-triggers-fire-status',
			fireTrigger: async () => {
				throw new Error('fire boom');
			},
		});
	});

	test('does not leak unhandled rejection when handleSetEnabled catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		await assertWriteClickDoesNotLeakWhenCatchPathPaintWarnThenRethrows({
			buttonLabel: ENGINE_TRIGGER_ENABLE_LABEL,
			statusSelector: '.engine-triggers-enabled-status',
			initialTriggers: [emptyTrigger({ triggerId: 'disabled-trigger', enabled: false })],
			setTriggerEnabled: async request => {
				setCalls.push(request);
				throw new Error('setEnabled boom');
			},
		});
		assert.deepStrictEqual(setCalls, [{ scope: '', scopeId: '', triggerId: 'disabled-trigger', enabled: true }]);
	});

	test('does not leak unhandled rejection when handleDelete catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		await assertWriteClickDoesNotLeakWhenCatchPathPaintWarnThenRethrows({
			buttonLabel: ENGINE_TRIGGER_DELETE_LABEL,
			statusSelector: '.engine-triggers-delete-status',
			deleteTrigger: async () => {
				throw new Error('delete boom');
			},
		});
	});

	test('row is focusable and arrow keys do not fire', async () => {
		const fireCalls: UniverseAgentFireTriggerRequest[] = [];
		const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
		const deleteCalls: UniverseAgentDeleteTriggerRequest[] = [];
		const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
		const first = emptyTrigger({ triggerId: 'trig-a', name: 'Alpha', type: 'cron', target: { kind: 'self' } });
		const second = emptyTrigger({ triggerId: 'trig-b', name: 'Beta', type: 'interval', target: { kind: 'self' } });
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async (): Promise<UniverseAgentListTriggersResult> => ({
				triggers: [first, second],
			}),
			fireTrigger: async request => {
				fireCalls.push(request);
				return { status: '', eventId: '', reason: '' };
			},
			setTriggerEnabled: async request => {
				setCalls.push(request);
				return { trigger: emptyTrigger({ triggerId: request.triggerId, enabled: request.enabled }) };
			},
			deleteTrigger: async request => {
				deleteCalls.push(request);
				return {};
			},
			upsertTrigger: async request => {
				upsertCalls.push(request);
				return { trigger: request.trigger };
			},
		}));
		await flushMicrotasks();
		const root = pane.getDomNode();
		assert.strictEqual(root.querySelector('.engine-triggers-list')?.getAttribute('role'), 'list');
		const rows = [...root.querySelectorAll('.engine-triggers-row')] as HTMLElement[];
		assert.strictEqual(rows.length, 2);
		assert.strictEqual(rows[0].getAttribute('role'), 'listitem');
		assert.strictEqual(rows[1].getAttribute('role'), 'listitem');
		assert.strictEqual(rows[0].tabIndex, 0);
		assert.strictEqual(rows[1].tabIndex, 0);
		assert.strictEqual(rows[0].textContent, formatEngineTriggerListLabel(first));
		assert.strictEqual(rows[1].textContent, formatEngineTriggerListLabel(second));

		const assertSelected = (index: number) => {
			rows.forEach((row, i) => {
				const selected = i === index;
				assert.strictEqual(row.classList.contains('selected'), selected, `row ${i}`);
				assert.strictEqual(row.getAttribute('aria-selected'), String(selected), `row ${i}`);
			});
		};
		const dispatchRowKey = (row: HTMLElement, key: string, domKeyCode: number, modifiers?: { shiftKey?: boolean }) => {
			const event = new KeyboardEvent('keydown', { key, keyCode: domKeyCode, shiftKey: modifiers?.shiftKey, bubbles: true, cancelable: true });
			row.dispatchEvent(event);
			return event;
		};

		assertSelected(-1);
		const ignored = dispatchRowKey(rows[0], 'a', 65);
		assert.strictEqual(ignored.defaultPrevented, false);
		const shifted = dispatchRowKey(rows[0], 'Enter', 13, { shiftKey: true });
		assert.strictEqual(shifted.defaultPrevented, false);
		assertSelected(-1);

		const enter = dispatchRowKey(rows[0], 'Enter', 13);
		assert.strictEqual(enter.defaultPrevented, true);
		assertSelected(0);

		const up = dispatchRowKey(rows[0], 'ArrowUp', 38);
		assert.strictEqual(up.defaultPrevented, true);
		assertSelected(0);
		assert.strictEqual(root.ownerDocument.activeElement, rows[0]);

		const down = dispatchRowKey(rows[0], 'ArrowDown', 40);
		assert.strictEqual(down.defaultPrevented, true);
		assertSelected(1);
		assert.strictEqual(root.ownerDocument.activeElement, rows[1]);

		dispatchRowKey(rows[1], 'ArrowDown', 40);
		assertSelected(1);
		dispatchRowKey(rows[1], 'ArrowLeft', 37);
		assertSelected(0);
		dispatchRowKey(rows[0], 'ArrowRight', 39);
		assertSelected(1);
		rows[0].click();
		assertSelected(0);

		const space = dispatchRowKey(rows[1], ' ', 32);
		assert.strictEqual(space.defaultPrevented, true);
		assertSelected(1);
		assert.deepStrictEqual(fireCalls, []);
		assert.deepStrictEqual(setCalls, []);
		assert.deepStrictEqual(deleteCalls, []);
		assert.deepStrictEqual(upsertCalls, []);

		const fire = findFireButton(root);
		assert.ok(fire);
		fire.click();
		await flushMicrotasks();
		assert.deepStrictEqual(fireCalls, [{ scope: '', scopeId: '', triggerId: 'trig-b' }]);
		assert.deepStrictEqual(setCalls, []);
		assert.deepStrictEqual(deleteCalls, []);
		assert.deepStrictEqual(upsertCalls, []);
		root.parentElement?.remove();
	});

	test('upsert dialog does not send when the published link or identity changed', async () => {
		async function run(label: string, duringDialog: (state: PublishedTriggerState) => void, values: readonly string[]): Promise<void> {
			const state: PublishedTriggerState = { engineIdentityId: 'eng-start', linkId: 4 };
			const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
			const listCalls: string[] = [];
			const dialog = new HeldTriggerDialog();
			const pane = mountSection(createConversationConnectionTestStub({
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => publishedTriggerSnapshot(state),
				listTriggers: async () => {
					listCalls.push('list');
					return { triggers: [] };
				},
				upsertTrigger: async request => {
					upsertCalls.push(request);
					return { trigger: request.trigger };
				},
			}), dialog);
			await flushMicrotasks();
			assert.strictEqual(listCalls.length, 1, label);
			const add = findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL);
			assert.ok(add, label);
			add.click();
			await flushMicrotasks();
			duringDialog(state);
			dialog.finish({ confirmed: true, values: [...values], checkboxChecked: true });
			await flushMicrotasks();
			assert.deepStrictEqual(upsertCalls, [], label);
			assert.deepStrictEqual(listCalls, ['list'], label);
			assertWriteStatusUnpainted(pane.getDomNode().querySelector('.engine-triggers-upsert-status'), label);
			assert.ok(!(pane.getDomNode().textContent ?? '').includes('Name is required.'), label);
			pane.getDomNode().parentElement?.remove();
		}

		await run('link', state => { state.linkId = 9; }, ['Nightly', 'cron', '', '', '', '']);
		await run('identity', state => { state.engineIdentityId = 'eng-next'; }, ['Nightly', 'cron', '', '', '', '']);
		await run('link invalid form', state => { state.linkId = 9; }, ['', '', '', '', '', '']);
	});

	test('trigger write return does not paint success or refresh when the published link or identity changed', async () => {
		async function run(label: string, op: 'fire' | 'setEnabled' | 'delete' | 'upsert', during: (state: PublishedTriggerState) => void, fail: boolean): Promise<void> {
			const state: PublishedTriggerState = { engineIdentityId: 'eng-start', linkId: 4 };
			const listCalls: string[] = [];
			const fireCalls: UniverseAgentFireTriggerRequest[] = [];
			const setCalls: UniverseAgentSetTriggerEnabledRequest[] = [];
			const deleteCalls: UniverseAgentDeleteTriggerRequest[] = [];
			const upsertCalls: UniverseAgentUpsertTriggerRequest[] = [];
			const nightly = emptyTrigger({
				triggerId: 'trig-1',
				name: 'Nightly',
				type: 'cron',
				target: { kind: 'self' },
				enabled: false,
			});
			const painted = emptyTrigger({
				triggerId: 'paint-id',
				name: 'Should Not Paint',
				type: 'cron',
				target: { kind: 'self' },
				enabled: true,
			});
			const pane = mountSection(createConversationConnectionTestStub({
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => publishedTriggerSnapshot(state),
				listTriggers: async () => {
					listCalls.push('list');
					if (listCalls.length > 1) {
						return { triggers: [emptyTrigger({ triggerId: 'nope', name: 'Should Not List', type: 'cron', target: { kind: 'self' } })] };
					}
					return { triggers: [nightly] };
				},
				fireTrigger: async request => {
					fireCalls.push(request);
					during(state);
					if (fail) {
						throw new Error('fire boom');
					}
					return { status: 'FIRED', eventId: 'evt-late', reason: 'queued' };
				},
				setTriggerEnabled: async request => {
					setCalls.push(request);
					during(state);
					if (fail) {
						throw new Error('set boom');
					}
					return { trigger: painted };
				},
				deleteTrigger: async request => {
					deleteCalls.push(request);
					during(state);
					if (fail) {
						throw new Error('delete boom');
					}
					return {};
				},
				upsertTrigger: async request => {
					upsertCalls.push(request);
					during(state);
					if (fail) {
						throw new Error('upsert boom');
					}
					return { trigger: painted };
				},
			}), op === 'upsert' ? confirmTriggerDialog({ name: 'Nightly', type: 'cron', checkboxChecked: true }) : undefined);
			await flushMicrotasks();
			assert.strictEqual(listCalls.length, 1, label);
			const row = pane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement | null;
			assert.ok(row, label);
			row.click();
			if (op === 'fire') {
				findFireButton(pane.getDomNode())?.click();
			} else if (op === 'setEnabled') {
				findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ENABLE_LABEL)?.click();
			} else if (op === 'delete') {
				findActionButton(pane.getDomNode(), ENGINE_TRIGGER_DELETE_LABEL)?.click();
			} else {
				findActionButton(pane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL)?.click();
			}
			await flushMicrotasks();
			assert.strictEqual(fireCalls.length, op === 'fire' ? 1 : 0, label);
			assert.strictEqual(setCalls.length, op === 'setEnabled' ? 1 : 0, label);
			assert.strictEqual(deleteCalls.length, op === 'delete' ? 1 : 0, label);
			assert.strictEqual(upsertCalls.length, op === 'upsert' ? 1 : 0, label);
			assert.deepStrictEqual(listCalls, ['list'], label);
			const root = pane.getDomNode();
			assert.ok(!(root.textContent ?? '').includes('Should Not List'), label);
			assert.ok(!(root.textContent ?? '').includes('Should Not Paint'), label);
			assert.ok(!(root.textContent ?? '').includes('fire boom'), label);
			assert.ok(!(root.textContent ?? '').includes('set boom'), label);
			assert.ok(!(root.textContent ?? '').includes('delete boom'), label);
			assert.ok(!(root.textContent ?? '').includes('upsert boom'), label);
			assert.ok(!(root.textContent ?? '').includes('FIRED — evt-late — queued'), label);
			assert.ok(!(root.textContent ?? '').includes(ENGINE_TRIGGER_DELETE_SUCCESS_COPY), label);
			const still = root.querySelector('.engine-triggers-row') as HTMLElement | null;
			assert.ok(still, label);
			assert.strictEqual(still.textContent, formatEngineTriggerListLabel(nightly), label);
			assert.strictEqual(still.classList.contains('selected'), true, label);
			assertWriteStatusUnpainted(root.querySelector('.engine-triggers-fire-status'), label);
			assertWriteStatusUnpainted(root.querySelector('.engine-triggers-enabled-status'), label);
			assertWriteStatusUnpainted(root.querySelector('.engine-triggers-delete-status'), label);
			assertWriteStatusUnpainted(root.querySelector('.engine-triggers-upsert-status'), label);
			if (op === 'setEnabled') {
				assert.ok(findActionButton(root, ENGINE_TRIGGER_ENABLE_LABEL), label);
				assert.strictEqual(findActionButton(root, ENGINE_TRIGGER_DISABLE_LABEL), undefined, label);
			}
			root.parentElement?.remove();
		}

		for (const op of ['fire', 'setEnabled', 'delete', 'upsert'] as const) {
			await run(`${op} link`, op, state => { state.linkId = 9; }, false);
			await run(`${op} identity`, op, state => { state.engineIdentityId = 'eng-next'; }, false);
			await run(`${op} link throw`, op, state => { state.linkId = 9; }, true);
			await run(`${op} identity throw`, op, state => { state.engineIdentityId = 'eng-next'; }, true);
		}
	});

	test('trigger writes still paint success when the published identity and link stay', async () => {
		const state: PublishedTriggerState = { engineIdentityId: 'eng-start', linkId: 4 };
		const nightly = emptyTrigger({
			triggerId: 'trig-1',
			name: 'Nightly',
			type: 'cron',
			target: { kind: 'self' },
			enabled: false,
		});
		const enabled = emptyTrigger({
			triggerId: 'trig-1',
			name: 'Nightly',
			type: 'cron',
			target: { kind: 'self' },
			enabled: true,
		});

		const fireList: string[] = [];
		const firePane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedTriggerSnapshot(state),
			listTriggers: async () => {
				fireList.push('list');
				return { triggers: [nightly] };
			},
			fireTrigger: async () => ({ status: 'FIRED', eventId: 'evt-1', reason: 'queued' }),
		}));
		await flushMicrotasks();
		(firePane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement).click();
		findFireButton(firePane.getDomNode())?.click();
		await flushMicrotasks();
		assert.deepStrictEqual(fireList, ['list']);
		const fireStatus = firePane.getDomNode().querySelector('.engine-triggers-fire-status') as HTMLElement;
		assert.strictEqual(fireStatus.textContent, 'FIRED — evt-1 — queued');
		assert.notStrictEqual(fireStatus.style.display, 'none');
		assert.ok(firePane.getDomNode().querySelector('.engine-triggers-row')?.classList.contains('selected'));
		firePane.getDomNode().parentElement?.remove();

		const setList: string[] = [];
		const setPane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedTriggerSnapshot(state),
			listTriggers: async () => {
				setList.push('list');
				return { triggers: [nightly] };
			},
			setTriggerEnabled: async request => {
				assert.deepStrictEqual(request, { scope: '', scopeId: '', triggerId: 'trig-1', enabled: true });
				return { trigger: enabled };
			},
		}));
		await flushMicrotasks();
		(setPane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement).click();
		findActionButton(setPane.getDomNode(), ENGINE_TRIGGER_ENABLE_LABEL)?.click();
		await flushMicrotasks();
		assert.deepStrictEqual(setList, ['list']);
		const enabledStatus = setPane.getDomNode().querySelector('.engine-triggers-enabled-status') as HTMLElement;
		assert.strictEqual(enabledStatus.textContent, `${formatEngineTriggerListLabel(enabled)} — true`);
		assert.ok(enabledStatus.classList.contains('is-success'));
		assert.ok(findActionButton(setPane.getDomNode(), ENGINE_TRIGGER_DISABLE_LABEL));
		setPane.getDomNode().parentElement?.remove();

		const deleteList: string[] = [];
		let deleted = false;
		const deletePane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedTriggerSnapshot(state),
			listTriggers: async () => {
				deleteList.push('list');
				return { triggers: deleted ? [] : [nightly] };
			},
			deleteTrigger: async () => {
				deleted = true;
				return {};
			},
		}));
		await flushMicrotasks();
		(deletePane.getDomNode().querySelector('.engine-triggers-row') as HTMLElement).click();
		findActionButton(deletePane.getDomNode(), ENGINE_TRIGGER_DELETE_LABEL)?.click();
		await flushMicrotasks();
		assert.deepStrictEqual(deleteList, ['list', 'list']);
		assert.strictEqual(deletePane.getDomNode().querySelector('.engine-triggers-row'), null);
		const deleteStatus = deletePane.getDomNode().querySelector('.engine-triggers-delete-status') as HTMLElement;
		assert.strictEqual(deleteStatus.textContent, ENGINE_TRIGGER_DELETE_SUCCESS_COPY);
		assert.ok(deleteStatus.classList.contains('is-success'));
		deletePane.getDomNode().parentElement?.remove();

		const created = emptyTrigger({
			triggerId: 'trig-new',
			name: 'Nightly',
			type: 'cron',
			target: { kind: 'self' },
			enabled: true,
		});
		const upsertList: string[] = [];
		let upserted = false;
		const upsertPane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => publishedTriggerSnapshot(state),
			listTriggers: async () => {
				upsertList.push('list');
				return { triggers: upserted ? [created] : [] };
			},
			upsertTrigger: async request => {
				assert.strictEqual(request.trigger.name, 'Nightly');
				assert.strictEqual(request.trigger.type, 'cron');
				upserted = true;
				return { trigger: created };
			},
		}), confirmTriggerDialog({ name: 'Nightly', type: 'cron', checkboxChecked: true }));
		await flushMicrotasks();
		findActionButton(upsertPane.getDomNode(), ENGINE_TRIGGER_ADD_LABEL)?.click();
		await flushMicrotasks();
		assert.deepStrictEqual(upsertList, ['list', 'list']);
		const upsertRow = upsertPane.getDomNode().querySelector('.engine-triggers-row');
		assert.ok(upsertRow);
		assert.strictEqual(upsertRow.textContent, formatEngineTriggerListLabel(created));
		const upsertStatus = upsertPane.getDomNode().querySelector('.engine-triggers-upsert-status') as HTMLElement;
		assert.strictEqual(upsertStatus.textContent, formatEngineTriggerListLabel(created));
		assert.ok(upsertStatus.classList.contains('is-success'));
		assert.notStrictEqual(upsertStatus.style.display, 'none');
		upsertPane.getDomNode().parentElement?.remove();
	});
	for (const identity of [undefined, 'test-engine']) {
		test(`Trigger writes forward a legal published owner and keep empty business scope (identity: ${identity})`, async () => {
			const owners: UniverseAgentPublishedLinkOwner[] = [];
			const contexts: Array<{ scope: string; scopeId: string }> = [];
			const trigger = emptyTrigger({ triggerId: 'trigger', name: 'Nightly' });
			const connection = createConversationConnectionTestStub({
				isEngineConnected: () => true,
				getConnectionSnapshot: () => publishedTriggerSnapshot({ engineIdentityId: identity, linkId: 7 }),
				listTriggers: async () => ({ triggers: [trigger] }),
				fireTrigger: async (request, owner) => { owners.push(owner); contexts.push(request); return { status: 'queued', eventId: 'event', reason: '' }; },
				setTriggerEnabled: async (request, owner) => { owners.push(owner); contexts.push(request); return { trigger: { ...trigger, enabled: request.enabled } }; },
				deleteTrigger: async (request, owner) => { owners.push(owner); contexts.push(request); return {}; },
				upsertTrigger: async (request, owner) => { owners.push(owner); contexts.push(request); return { trigger: request.trigger }; },
			});
			const section = mountSection(connection, confirmTriggerDialog({ name: 'New', type: 'schedule' }));
			await flushMicrotasks();
			const row = section.getDomNode().querySelector<HTMLElement>('.engine-triggers-row');
			assert.ok(row);
			row.click();
			for (const label of [ENGINE_TRIGGER_FIRE_LABEL, ENGINE_TRIGGER_ENABLE_LABEL, ENGINE_TRIGGER_DELETE_LABEL, ENGINE_TRIGGER_ADD_LABEL]) {
				const button = findActionButton(section.getDomNode(), label);
				assert.ok(button);
				button.click();
				await flushMicrotasks();
			}
			assert.deepStrictEqual({ owners, contexts: contexts.map(request => ({ scope: request.scope, scopeId: request.scopeId })) }, {
				owners: Array.from({ length: 4 }, () => ({ engineIdentityId: identity, linkId: 7 })),
				contexts: Array.from({ length: 4 }, () => ({ scope: '', scopeId: '' })),
			});
		});
	}

	for (const method of ['fire', 'delete'] as const) {
		for (const fail of [false, true]) {
			test(`Trigger ${method} late ${fail ? 'error' : 'success'} after selecting B cannot paint B or refresh away its selection`, async () => {
				const result = new DeferredPromise<{ status: string; eventId: string; reason: string }>();
				let lists = 0;
				const writes: string[] = [];
				const triggers = [emptyTrigger({ triggerId: 'a', name: 'A' }), emptyTrigger({ triggerId: 'b', name: 'B' })];
				const section = mountSection(createConversationConnectionTestStub({
					isEngineConnected: () => true,
					listTriggers: async () => { lists++; return { triggers }; },
					fireTrigger: request => { writes.push(request.triggerId); return result.p; },
					deleteTrigger: async request => { writes.push(request.triggerId); await result.p; return {}; },
				}));
				await flushMicrotasks();
				const root = section.getDomNode();
				const rows = root.querySelectorAll<HTMLElement>('.engine-triggers-row');
				assert.strictEqual(rows.length, 2);
				rows[0].click();
				const button = findActionButton(root, method === 'fire' ? ENGINE_TRIGGER_FIRE_LABEL : ENGINE_TRIGGER_DELETE_LABEL);
				assert.ok(button);
				button.click();
				rows[1].click();
				const before = root.innerHTML;
				if (fail) { await result.error(new Error('old A rejection')); } else { await result.complete({ status: 'queued', eventId: 'old-A', reason: '' }); }
				await flushMicrotasks();
				assert.deepStrictEqual({ writes, lists, unchanged: root.innerHTML === before, selectedB: rows[1].classList.contains('selected') }, { writes: ['a'], lists: 1, unchanged: true, selectedB: true });
			});
		}
	}

	for (const method of ['delete', 'edit'] as const) {
		for (const fail of [false, true]) {
			test(`Trigger ${method} own List late ${fail ? 'reject' : 'success'} retires only its loading after selecting B`, async () => {
				const listed = new DeferredPromise<UniverseAgentListTriggersResult>();
				const triggers = [emptyTrigger({ triggerId: 'a', name: 'A' }), emptyTrigger({ triggerId: 'b', name: 'B' })];
				let lists = 0;
				const section = mountSection(createConversationConnectionTestStub({
					isEngineConnected: () => true,
					listTriggers: async () => ++lists === 1 ? { triggers } : listed.p,
					deleteTrigger: async () => ({}), upsertTrigger: async request => ({ trigger: request.trigger }),
				}), confirmTriggerDialog({ name: 'Edited', type: 'schedule' }));
				await flushMicrotasks();
				const root = section.getDomNode();
				const rows = root.querySelectorAll<HTMLElement>('.engine-triggers-row');
				rows[0].click();
				const button = findActionButton(root, method === 'delete' ? ENGINE_TRIGGER_DELETE_LABEL : ENGINE_TRIGGER_EDIT_LABEL);
				assert.ok(button);
				button.click();
				await flushMicrotasks();
				assert.strictEqual(lists, 2);
				rows[1].click();
				const list = root.querySelector<HTMLElement>('.engine-triggers-list');
				const status = root.querySelector<HTMLElement>('.engine-catalog-status-widget');
				assert.ok(list && status);
				const before = list.innerHTML;
				const feedback = root.querySelector<HTMLElement>(method === 'delete' ? '.engine-triggers-delete-status' : '.engine-triggers-upsert-status');
				assert.ok(feedback);
				const beforeFeedback = feedback.textContent;
				if (fail) { await listed.error(new Error('old list rejection')); } else { await listed.complete({ triggers: [triggers[0]] }); }
				await flushMicrotasks();
				assert.deepStrictEqual({ lists, sameRows: list.innerHTML === before, selectedB: rows[1].classList.contains('selected'), feedback: feedback.textContent, hidden: status.style.display, mode: status.dataset['catalogMode'] }, { lists: 2, sameRows: true, selectedB: true, feedback: beforeFeedback, hidden: 'none', mode: '' });
			});
		}
	}

	for (const fail of [false, true]) {
		test(`Trigger stale own List ${fail ? 'reject' : 'success'} cannot retire a successor public refresh`, async () => {
			const oldList = new DeferredPromise<UniverseAgentListTriggersResult>();
			const newList = new DeferredPromise<UniverseAgentListTriggersResult>();
			const changed = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
			const triggers = [emptyTrigger({ triggerId: 'a', name: 'A' }), emptyTrigger({ triggerId: 'b', name: 'B' })];
			let lists = 0;
			const snapshot = () => publishedTriggerSnapshot({ engineIdentityId: 'engine', linkId: 7 });
			const section = mountSection(createConversationConnectionTestStub({
				isEngineConnected: () => true, getConnectionSnapshot: snapshot, onDidChangeConnection: changed.event,
				listTriggers: async () => ++lists === 1 ? { triggers } : lists === 2 ? oldList.p : newList.p,
				deleteTrigger: async () => ({}),
			}));
			await flushMicrotasks();
			const root = section.getDomNode();
			const rows = root.querySelectorAll<HTMLElement>('.engine-triggers-row');
			rows[0].click();
			const button = findActionButton(root, ENGINE_TRIGGER_DELETE_LABEL);
			assert.ok(button);
			button.click();
			await flushMicrotasks();
			rows[1].click();
			changed.fire(snapshot());
			await flushMicrotasks();
			const status = root.querySelector<HTMLElement>('.engine-catalog-status-widget');
			assert.ok(status);
			if (fail) { await oldList.error(new Error('old own list')); } else { await oldList.complete({ triggers: [triggers[0]] }); }
			await flushMicrotasks();
			assert.deepStrictEqual({ lists, mode: status.dataset['catalogMode'], visible: status.style.display !== 'none', selectedB: rows[1].classList.contains('selected') }, { lists: 3, mode: 'loading', visible: true, selectedB: true });
			await newList.complete({ triggers: [triggers[1]] });
			await flushMicrotasks();
			assert.deepStrictEqual({ names: [...root.querySelectorAll<HTMLElement>('.engine-triggers-row')].map(row => row.textContent), hidden: status.style.display }, { names: [formatEngineTriggerListLabel(triggers[1])], hidden: 'none' });
		});
	}

	test('disposal detaches DOM container and clears nodes', () => {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listTriggers: async () => ({ triggers: [] }),
		}));
		const section = instantiationService.createInstance(EngineTriggersSection, parent);
		assert.strictEqual(section.getDomNode().parentElement, parent);
		section.dispose();
		assert.strictEqual(section.getDomNode().parentElement, null);
		assert.strictEqual(section.getDomNode().childNodes.length, 0);
		parent.remove();
	});
});
