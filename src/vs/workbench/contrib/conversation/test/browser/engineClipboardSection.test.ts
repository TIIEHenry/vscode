/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentClearClipboardRequest,
	UniverseAgentConnectionSnapshot,
	UniverseAgentListClipboardRequest,
	UniverseAgentListClipboardResult,
	UniverseAgentReadClipboardRequest,
	UniverseAgentWriteClipboardRequest,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { getCatalogFailedCopy } from '../../browser/engineCatalog.js';
import { ENGINE_CLIPBOARD_CLEAR_LABEL, ENGINE_CLIPBOARD_LIST_EMPTY_COPY, ENGINE_CLIPBOARD_LIST_FEATURE, ENGINE_CLIPBOARD_READ_LABEL, ENGINE_CLIPBOARD_WRITE_LABEL, formatEngineClipboardClearLabel, formatEngineClipboardListLabel, formatEngineClipboardWriteLabel } from '../../browser/engineClipboardList.js';
import { EngineClipboardSection } from '../../browser/engineClipboardSection.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

suite('EngineClipboardSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountSection(connection: IUniverseAgentConnection): EngineClipboardSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineClipboardSection, parent));
		section.setSectionActive(true);
		return section;
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 0));
	}

	function findActionButton(root: HTMLElement, label: string): HTMLButtonElement | undefined {
		return [...root.querySelectorAll('.engine-clipboard-actions .monaco-button')]
			.find(button => button.textContent === label) as HTMLButtonElement | undefined;
	}

	function findReadButton(root: HTMLElement): HTMLButtonElement | undefined {
		return findActionButton(root, ENGINE_CLIPBOARD_READ_LABEL);
	}

	const WRITE_BUTTON_LABELS = [
		ENGINE_CLIPBOARD_WRITE_LABEL,
		ENGINE_CLIPBOARD_CLEAR_LABEL,
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
		writeCalls: unknown[],
		clearCalls: unknown[],
	): Promise<void> {
		const row = root.querySelector('.engine-clipboard-row') as HTMLElement | null;
		row?.click();
		for (const label of WRITE_BUTTON_LABELS) {
			forceClick(findActionButton(root, label));
		}
		await flushMicrotasks();
		assert.deepStrictEqual(writeCalls, []);
		assert.deepStrictEqual(clearCalls, []);
	}

	function assertReadButtonDisabled(root: HTMLElement): void {
		const button = findReadButton(root);
		assert.ok(button);
		assert.strictEqual(button.classList.contains('disabled'), true);
		assert.strictEqual(button.getAttribute('aria-disabled'), 'true');
	}

	async function assertForcedReadClickStaysUnary(root: HTMLElement, readCalls: unknown[]): Promise<void> {
		const row = root.querySelector('.engine-clipboard-row') as HTMLElement | null;
		row?.click();
		forceClick(findReadButton(root));
		await flushMicrotasks();
		assert.deepStrictEqual(readCalls, []);
	}

	test('List does not send when disconnected or hook missing', async () => {
		let listClipboardCalls = 0;
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			listClipboard: async () => {
				listClipboardCalls++;
				return { entries: [] };
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 0);
		assert.ok((disconnected.getDomNode().textContent ?? '').length > 0);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 0);
		assert.strictEqual(noHook.getDomNode().querySelectorAll('.engine-clipboard-row').length, 0);
		const noHookStatus = noHook.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(noHookStatus);
		assert.strictEqual(noHookStatus.dataset['catalogMode'], 'unsupported');
		assert.ok((noHook.getDomNode().textContent ?? '').includes('does not expose'));
		assert.ok(!(noHook.getDomNode().textContent ?? '').includes(ENGINE_CLIPBOARD_LIST_EMPTY_COPY));
		noHook.getDomNode().parentElement?.remove();
	});

	test('List sends empty sessionId as-is when connected', async () => {
		const requests: UniverseAgentListClipboardRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async (request): Promise<UniverseAgentListClipboardResult> => {
				requests.push(request);
				return {
					entries: [{
						clipId: '',
						label: '',
						type: 'CLIPBOARD_TEXT',
						createdBy: '',
						createdAt: 0,
					}],
				};
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(requests.length, 1);
		assert.deepStrictEqual(requests[0], { sessionId: '' });
		const row = pane.getDomNode().querySelector('.engine-clipboard-row');
		assert.ok(row);
		assert.strictEqual(row.textContent, ' — CLIPBOARD_TEXT — ');
		pane.getDomNode().parentElement?.remove();
	});

	test('List empty entries[] is honest empty', async () => {
		let listClipboardCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async () => {
				listClipboardCalls++;
				return { entries: [] };
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelector('.engine-clipboard-row'), null);
		assert.ok((pane.getDomNode().textContent ?? '').includes(ENGINE_CLIPBOARD_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('List first-pull throw is failed with no leftover rows', async () => {
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async () => {
				throw new Error('listClipboard exploded');
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelector('.engine-clipboard-row'), null);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(ENGINE_CLIPBOARD_LIST_FEATURE, 'listClipboard exploded')));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CLIPBOARD_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('List success then throw keeps leftover rows and paints failed', async () => {
		let listClipboardCalls = 0;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const leftover = {
			clipId: 'leftover-clip',
			label: 'Leftover Note',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
		};
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			onDidChangeConnection: onDidChangeConnection.event,
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				if (listClipboardCalls === 1) {
					return { entries: [leftover] };
				}
				throw new Error('listClipboard retry exploded');
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		const liveRow = pane.getDomNode().querySelector('.engine-clipboard-row');
		assert.ok(liveRow);
		assert.strictEqual(liveRow.textContent, formatEngineClipboardListLabel(leftover));
		assert.strictEqual(listClipboardCalls, 1);

		onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();

		assert.strictEqual(listClipboardCalls, 2);
		const leftoverRows = pane.getDomNode().querySelectorAll('.engine-clipboard-row');
		assert.strictEqual(leftoverRows.length, 1);
		assert.strictEqual(leftoverRows[0].textContent, formatEngineClipboardListLabel(leftover));
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(ENGINE_CLIPBOARD_LIST_FEATURE, 'listClipboard retry exploded')));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CLIPBOARD_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('List success then hook missing keeps leftover rows and paints unsupported', async () => {
		const leftover = {
			clipId: 'leftover-clip',
			label: 'Leftover Note',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			onDidChangeConnection: onDidChangeConnection.event,
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				return { entries: [leftover] };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);

		delete connection.listClipboard;
		onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();

		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CLIPBOARD_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('List success then disconnect clears leftover rows', async () => {
		let connected = true;
		const leftover = {
			clipId: 'leftover-clip',
			label: 'Leftover Note',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => connected,
			getConnectionPhase: () => connected ? { kind: 'connected', path: 'loopback' } : { kind: 'disconnected' },
			onDidChangeConnection: onDidChangeConnection.event,
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				return { entries: [leftover] };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);

		connected = false;
		onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await flushMicrotasks();

		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 0);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		pane.getDomNode().parentElement?.remove();
	});

	test('connected phase with pairingPending keeps leftover rows and paints not-connected', async () => {
		let connected = true;
		let pairingPending = false;
		let listClipboardCalls = 0;
		const leftover = {
			clipId: 'leftover-clip',
			label: 'Leftover Note',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		const writeCalls: UniverseAgentWriteClipboardRequest[] = [];
		const clearCalls: UniverseAgentClearClipboardRequest[] = [];
		const readCalls: UniverseAgentReadClipboardRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => connected && !pairingPending,
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				return { entries: [leftover] };
			},
			writeClipboard: async request => {
				writeCalls.push(request);
				return { clipId: leftover.clipId };
			},
			readClipboard: async request => {
				readCalls.push(request);
				return {
					entry: {
						clipId: leftover.clipId,
						label: leftover.label,
						type: leftover.type,
						content: leftover.label,
						createdBy: leftover.createdBy,
						createdAt: leftover.createdAt,
					},
				};
			},
			clearClipboard: async request => {
				clearCalls.push(request);
				return { removedCount: 0 };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);
		const listCallsAfterLoad = listClipboardCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listClipboardCalls, listCallsAfterLoad);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);
		const listHost = pane.getDomNode().querySelector('.engine-clipboard-list') as HTMLElement | null;
		assert.ok(listHost);
		assert.notStrictEqual(listHost.style.display, 'none');
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CLIPBOARD_LIST_EMPTY_COPY));
		assertWriteButtonsDisabled(pane.getDomNode());
		assertReadButtonDisabled(pane.getDomNode());
		await assertForcedWriteClicksStayUnary(pane.getDomNode(), writeCalls, clearCalls);
		await assertForcedReadClickStaysUnary(pane.getDomNode(), readCalls);
		assert.strictEqual(listClipboardCalls, listCallsAfterLoad);

		connected = false;
		onDidChangeConnection.fire(snapshot());
		await flushMicrotasks();

		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 0);
		const cleared = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(cleared);
		assert.strictEqual(cleared.dataset['catalogMode'], 'disconnected');
		pane.getDomNode().parentElement?.remove();
	});

	test('leftover-looks-live pairing-hold write buttons stay 0 unary and skip extra list', async () => {
		let pairingPending = false;
		let listClipboardCalls = 0;
		const leftover = {
			clipId: 'leftover-live',
			label: 'Looks Live Note',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			pairingPending,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		const writeCalls: UniverseAgentWriteClipboardRequest[] = [];
		const clearCalls: UniverseAgentClearClipboardRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				return { entries: [leftover] };
			},
			writeClipboard: async request => {
				writeCalls.push(request);
				return { clipId: leftover.clipId };
			},
			clearClipboard: async request => {
				clearCalls.push(request);
				return { removedCount: 0 };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);
		const listCallsAfterLoad = listClipboardCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listClipboardCalls, listCallsAfterLoad);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assertWriteButtonsDisabled(pane.getDomNode());
		await assertForcedWriteClicksStayUnary(pane.getDomNode(), writeCalls, clearCalls);
		assert.strictEqual(listClipboardCalls, listCallsAfterLoad);
		pane.getDomNode().parentElement?.remove();
	});

	test('leftover-looks-live pairing-hold Read stays 0 unary and skip extra list', async () => {
		let pairingPending = false;
		let listClipboardCalls = 0;
		const leftover = {
			clipId: 'leftover-live',
			label: 'Looks Live Note',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			pairingPending,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		const readCalls: UniverseAgentReadClipboardRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				return { entries: [leftover] };
			},
			readClipboard: async request => {
				readCalls.push(request);
				return {
					entry: {
						clipId: leftover.clipId,
						label: leftover.label,
						type: leftover.type,
						content: leftover.label,
						createdBy: leftover.createdBy,
						createdAt: leftover.createdAt,
					},
				};
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);
		const listCallsAfterLoad = listClipboardCalls;
		assert.strictEqual(connection.isEngineConnected(), true);

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());
		await flushMicrotasks();

		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(listClipboardCalls, listCallsAfterLoad);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);
		const status = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assertReadButtonDisabled(pane.getDomNode());
		await assertForcedReadClickStaysUnary(pane.getDomNode(), readCalls);
		assert.strictEqual(listClipboardCalls, listCallsAfterLoad);
		pane.getDomNode().parentElement?.remove();
	});

	test('connected leftover list-fail still Reads', async () => {
		let listClipboardCalls = 0;
		const leftover = {
			clipId: 'leftover-clip',
			label: 'Leftover Note',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const liveSnapshot: UniverseAgentConnectionSnapshot = {
			transport: 'ok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		};
		const readCalls: UniverseAgentReadClipboardRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => liveSnapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				if (listClipboardCalls === 1) {
					return { entries: [leftover] };
				}
				throw new Error('list boom');
			},
			readClipboard: async request => {
				readCalls.push(request);
				return {
					entry: {
						clipId: leftover.clipId,
						label: leftover.label,
						type: leftover.type,
						content: leftover.label,
						createdBy: leftover.createdBy,
						createdAt: leftover.createdAt,
					},
				};
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);

		onDidChangeConnection.fire(liveSnapshot);
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 2);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);

		const row = pane.getDomNode().querySelector('.engine-clipboard-row') as HTMLElement;
		assert.ok(row);
		row.click();
		const read = findReadButton(pane.getDomNode());
		assert.ok(read);
		assert.strictEqual(read.classList.contains('disabled'), false);
		read.click();
		await flushMicrotasks();
		assert.deepStrictEqual(readCalls, [{ sessionId: '', clipId: leftover.clipId }]);
		pane.getDomNode().parentElement?.remove();
	});

	test('connected leftover list-fail still writes and clears', async () => {
		let listClipboardCalls = 0;
		const leftover = {
			clipId: 'leftover-clip',
			label: 'Leftover Note',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const liveSnapshot: UniverseAgentConnectionSnapshot = {
			transport: 'ok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		};
		const writeCalls: UniverseAgentWriteClipboardRequest[] = [];
		const clearCalls: UniverseAgentClearClipboardRequest[] = [];
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => liveSnapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				if (listClipboardCalls === 1) {
					return { entries: [leftover] };
				}
				throw new Error('list boom');
			},
			writeClipboard: async request => {
				writeCalls.push(request);
				return { clipId: leftover.clipId };
			},
			clearClipboard: async request => {
				clearCalls.push(request);
				return { removedCount: 0 };
			},
		});
		const pane = mountSection(connection);
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);

		onDidChangeConnection.fire(liveSnapshot);
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 2);
		assert.strictEqual(pane.getDomNode().querySelectorAll('.engine-clipboard-row').length, 1);

		const write = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_WRITE_LABEL);
		assert.ok(write);
		assert.strictEqual(write.classList.contains('disabled'), false);
		write.click();
		await flushMicrotasks();
		assert.strictEqual(writeCalls.length, 1);

		const clear = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_CLEAR_LABEL);
		assert.ok(clear);
		assert.strictEqual(clear.classList.contains('disabled'), false);
		clear.click();
		await flushMicrotasks();
		assert.strictEqual(clearCalls.length, 1);
		pane.getDomNode().parentElement?.remove();
	});

	test('Read does not send when disconnected or hook missing', async () => {
		const readCalls: UniverseAgentReadClipboardRequest[] = [];
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			readClipboard: async request => {
				readCalls.push(request);
				return {
					entry: {
						clipId: '',
						label: '',
						type: 'CLIPBOARD_TEXT',
						content: '',
						createdBy: '',
						createdAt: 0,
					},
				};
			},
		}));
		await flushMicrotasks();
		const disconnectedRead = findReadButton(disconnected.getDomNode());
		assert.ok(disconnectedRead);
		disconnectedRead.click();
		await flushMicrotasks();
		assert.deepStrictEqual(readCalls, []);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		const noHookRead = findReadButton(noHook.getDomNode());
		assert.ok(noHookRead);
		noHookRead.click();
		await flushMicrotasks();
		assert.deepStrictEqual(readCalls, []);
		noHook.getDomNode().parentElement?.remove();
	});

	test('Read sends empty ids as-is when connected with no selection', async () => {
		const readCalls: UniverseAgentReadClipboardRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async () => ({ entries: [] }),
			readClipboard: async request => {
				readCalls.push(request);
				return {
					entry: {
						clipId: '',
						label: '',
						type: 'CLIPBOARD_TEXT',
						content: '',
						createdBy: '',
						createdAt: 0,
					},
				};
			},
		}));
		await flushMicrotasks();
		const read = findReadButton(pane.getDomNode());
		assert.ok(read);
		read.click();
		await flushMicrotasks();
		assert.deepStrictEqual(readCalls, [{ sessionId: '', clipId: '' }]);
		assert.ok((pane.getDomNode().textContent ?? '').includes(' —  — CLIPBOARD_TEXT —  —  — 0'));
		pane.getDomNode().parentElement?.remove();
	});

	test('Read sends selected clipId without inventing defaults', async () => {
		const readCalls: UniverseAgentReadClipboardRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => ({
				entries: [{
					clipId: '  clip  ',
					label: '  Note  ',
					type: 'CLIPBOARD_URL',
					createdBy: '',
					createdAt: 0,
				}],
			}),
			readClipboard: async request => {
				readCalls.push(request);
				return {
					entry: {
						clipId: '  clip  ',
						label: '  Note  ',
						type: 'CLIPBOARD_URL',
						content: '  https://example  ',
						createdBy: '',
						createdAt: 0,
					},
				};
			},
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-clipboard-row') as HTMLElement;
		assert.ok(row);
		row.click();
		const read = findReadButton(pane.getDomNode());
		assert.ok(read);
		read.click();
		await flushMicrotasks();
		assert.deepStrictEqual(readCalls, [{ sessionId: '', clipId: '  clip  ' }]);
		assert.ok((pane.getDomNode().textContent ?? '').includes('  clip   —   Note   — CLIPBOARD_URL —   https://example   —  — 0'));
		pane.getDomNode().parentElement?.remove();
	});

	test('Write does not send when disconnected or hook missing', async () => {
		const writeCalls: UniverseAgentWriteClipboardRequest[] = [];
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			writeClipboard: async request => {
				writeCalls.push(request);
				return { clipId: '' };
			},
		}));
		await flushMicrotasks();
		const disconnectedWrite = findActionButton(disconnected.getDomNode(), ENGINE_CLIPBOARD_WRITE_LABEL);
		assert.ok(disconnectedWrite);
		disconnectedWrite.click();
		await flushMicrotasks();
		assert.deepStrictEqual(writeCalls, []);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		const noHookWrite = findActionButton(noHook.getDomNode(), ENGINE_CLIPBOARD_WRITE_LABEL);
		assert.ok(noHookWrite);
		noHookWrite.click();
		await flushMicrotasks();
		assert.deepStrictEqual(writeCalls, []);
		noHook.getDomNode().parentElement?.remove();
	});

	test('Write sends empty ids as-is when connected', async () => {
		const writeCalls: UniverseAgentWriteClipboardRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async () => ({ entries: [] }),
			writeClipboard: async request => {
				writeCalls.push(request);
				return { clipId: '' };
			},
		}));
		await flushMicrotasks();
		const write = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_WRITE_LABEL);
		assert.ok(write);
		write.click();
		await flushMicrotasks();
		assert.deepStrictEqual(writeCalls, [{
			sessionId: '',
			agentId: '',
			label: '',
			type: 'CLIPBOARD_TEXT',
			content: '',
			filePath: '',
			url: '',
		}]);
		assert.strictEqual(pane.getDomNode().querySelector('.engine-clipboard-write-status')?.textContent, '');
		pane.getDomNode().parentElement?.remove();
	});

	test('Write still sends empty fields when a row is selected', async () => {
		const writeCalls: UniverseAgentWriteClipboardRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => ({
				entries: [{
					clipId: '  clip  ',
					label: '  Note  ',
					type: 'CLIPBOARD_URL',
					createdBy: '',
					createdAt: 0,
				}],
			}),
			writeClipboard: async request => {
				writeCalls.push(request);
				return { clipId: '  new  ' };
			},
		}));
		await flushMicrotasks();
		const row = pane.getDomNode().querySelector('.engine-clipboard-row') as HTMLElement;
		assert.ok(row);
		row.click();
		const write = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_WRITE_LABEL);
		assert.ok(write);
		write.click();
		await flushMicrotasks();
		assert.deepStrictEqual(writeCalls, [{
			sessionId: '',
			agentId: '',
			label: '',
			type: 'CLIPBOARD_TEXT',
			content: '',
			filePath: '',
			url: '',
		}]);
		assert.strictEqual(pane.getDomNode().querySelector('.engine-clipboard-write-status')?.textContent, '  new  ');
		pane.getDomNode().parentElement?.remove();
	});

	test('WriteClipboard success refreshes so the written row appears', async () => {
		let written = false;
		let listClipboardCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				if (written) {
					return {
						entries: [{
							clipId: '  new  ',
							label: '',
							type: 'CLIPBOARD_TEXT',
							createdBy: '',
							createdAt: 0,
						}],
					};
				}
				return { entries: [] };
			},
			writeClipboard: async () => {
				written = true;
				return { clipId: '  new  ' };
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		assert.strictEqual(pane.getDomNode().querySelector('.engine-clipboard-row'), null);
		const write = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_WRITE_LABEL);
		assert.ok(write);
		write.click();
		await flushMicrotasks();
		assert.ok(listClipboardCalls >= 2);
		const row = pane.getDomNode().querySelector('.engine-clipboard-row');
		assert.ok(row);
		const writeStatus = pane.getDomNode().querySelector('.engine-clipboard-write-status') as HTMLElement | null;
		assert.ok(writeStatus);
		assert.strictEqual(writeStatus.textContent, formatEngineClipboardWriteLabel('  new  '));
		assert.notStrictEqual(writeStatus.style.display, 'none');
		pane.getDomNode().parentElement?.remove();
	});

	test('WriteClipboard success does not keep write-success when subsequent ListClipboard fails', async () => {
		let listClipboardCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const pane = mountSection(createConversationConnectionTestStub({
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
					listClipboardCalls++;
					if (listClipboardCalls > 1) {
						throw new Error('list boom');
					}
					return { entries: [] };
				},
				writeClipboard: async () => {
					return { clipId: '  new  ' };
				},
			}));
			await flushMicrotasks();
			assert.strictEqual(listClipboardCalls, 1);
			const write = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_WRITE_LABEL);
			assert.ok(write);
			write.click();
			await flushMicrotasks();
			assert.ok(listClipboardCalls >= 2);
			assert.strictEqual(pane.getDomNode().querySelector('.engine-clipboard-row'), null);
			const writeStatus = pane.getDomNode().querySelector('.engine-clipboard-write-status') as HTMLElement | null;
			assert.ok(writeStatus);
			assert.notStrictEqual(writeStatus.textContent, formatEngineClipboardWriteLabel('  new  '));
			assert.ok(!(writeStatus.textContent ?? '').includes('  new  '));
			const catalog = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement | null;
			assert.ok(catalog);
			assert.strictEqual(catalog.dataset['catalogMode'], 'failed');
			assert.ok((catalog.textContent ?? '').includes(getCatalogFailedCopy(ENGINE_CLIPBOARD_LIST_FEATURE, 'list boom')));
			assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CLIPBOARD_LIST_EMPTY_COPY));
			assert.deepStrictEqual(unhandledRejections, []);
			pane.getDomNode().parentElement?.remove();
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('WriteClipboard leftover list-fail keeps leftover rows and hides write-success', async () => {
		let listClipboardCalls = 0;
		const leftover = {
			clipId: 'leftover-clip',
			label: 'Leftover Note',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
		};
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				if (listClipboardCalls > 1) {
					throw new Error('list boom');
				}
				return { entries: [leftover] };
			},
			writeClipboard: async () => {
				return { clipId: '  new  ' };
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		const liveRow = pane.getDomNode().querySelector('.engine-clipboard-row');
		assert.ok(liveRow);
		assert.strictEqual(liveRow.textContent, formatEngineClipboardListLabel(leftover));
		const write = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_WRITE_LABEL);
		assert.ok(write);
		write.click();
		await flushMicrotasks();
		assert.ok(listClipboardCalls >= 2);
		const leftoverRows = pane.getDomNode().querySelectorAll('.engine-clipboard-row');
		assert.strictEqual(leftoverRows.length, 1);
		assert.strictEqual(leftoverRows[0].textContent, formatEngineClipboardListLabel(leftover));
		const writeStatus = pane.getDomNode().querySelector('.engine-clipboard-write-status') as HTMLElement | null;
		assert.ok(writeStatus);
		assert.notStrictEqual(writeStatus.textContent, formatEngineClipboardWriteLabel('  new  '));
		assert.ok(!(writeStatus.textContent ?? '').includes('  new  '));
		const catalog = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement | null;
		assert.ok(catalog);
		assert.strictEqual(catalog.dataset['catalogMode'], 'failed');
		assert.ok((catalog.textContent ?? '').includes(getCatalogFailedCopy(ENGINE_CLIPBOARD_LIST_FEATURE, 'list boom')));
		assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CLIPBOARD_LIST_EMPTY_COPY));
		pane.getDomNode().parentElement?.remove();
	});

	test('WriteClipboard throw paints write-status and leaves the row', async () => {
		let listClipboardCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				return {
					entries: [{
						clipId: '  clip  ',
						label: '  Note  ',
						type: 'CLIPBOARD_TEXT',
						createdBy: '',
						createdAt: 0,
					}],
				};
			},
			writeClipboard: async () => {
				throw new Error('boom');
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		const row = pane.getDomNode().querySelector('.engine-clipboard-row') as HTMLElement | null;
		assert.ok(row);
		const write = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_WRITE_LABEL);
		assert.ok(write);
		write.click();
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		const leftover = pane.getDomNode().querySelector('.engine-clipboard-row');
		assert.ok(leftover);
		const writeStatus = pane.getDomNode().querySelector('.engine-clipboard-write-status') as HTMLElement | null;
		assert.ok(writeStatus);
		assert.strictEqual(writeStatus.textContent, 'boom');
		assert.notStrictEqual(writeStatus.style.display, 'none');
		pane.getDomNode().parentElement?.remove();
	});

	test('Clear does not send when disconnected or hook missing', async () => {
		const clearCalls: UniverseAgentClearClipboardRequest[] = [];
		const disconnected = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			clearClipboard: async request => {
				clearCalls.push(request);
				return { removedCount: 0 };
			},
		}));
		await flushMicrotasks();
		const disconnectedClear = findActionButton(disconnected.getDomNode(), ENGINE_CLIPBOARD_CLEAR_LABEL);
		assert.ok(disconnectedClear);
		disconnectedClear.click();
		await flushMicrotasks();
		assert.deepStrictEqual(clearCalls, []);
		disconnected.getDomNode().parentElement?.remove();

		const noHook = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		}));
		await flushMicrotasks();
		const noHookClear = findActionButton(noHook.getDomNode(), ENGINE_CLIPBOARD_CLEAR_LABEL);
		assert.ok(noHookClear);
		noHookClear.click();
		await flushMicrotasks();
		assert.deepStrictEqual(clearCalls, []);
		noHook.getDomNode().parentElement?.remove();
	});

	test('Clear sends empty sessionId as-is when connected', async () => {
		const clearCalls: UniverseAgentClearClipboardRequest[] = [];
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async () => ({ entries: [] }),
			clearClipboard: async request => {
				clearCalls.push(request);
				return { removedCount: 0 };
			},
		}));
		await flushMicrotasks();
		const clear = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_CLEAR_LABEL);
		assert.ok(clear);
		clear.click();
		await flushMicrotasks();
		assert.deepStrictEqual(clearCalls, [{ sessionId: '' }]);
		assert.ok((pane.getDomNode().textContent ?? '').includes('0'));
		pane.getDomNode().parentElement?.remove();
	});

	test('ClearClipboard success refreshes so the cleared row is gone', async () => {
		let cleared = false;
		let listClipboardCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				if (cleared) {
					return { entries: [] };
				}
				return {
					entries: [{
						clipId: '  clip  ',
						label: '  Note  ',
						type: 'CLIPBOARD_TEXT',
						createdBy: '',
						createdAt: 0,
					}],
				};
			},
			clearClipboard: async () => {
				cleared = true;
				return { removedCount: 1 };
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		const row = pane.getDomNode().querySelector('.engine-clipboard-row') as HTMLElement | null;
		assert.ok(row);
		const clear = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_CLEAR_LABEL);
		assert.ok(clear);
		clear.click();
		await flushMicrotasks();
		assert.ok(listClipboardCalls >= 2);
		assert.strictEqual(pane.getDomNode().querySelector('.engine-clipboard-row'), null);
		assert.ok((pane.getDomNode().textContent ?? '').includes('No clipboard entries.'));
		const clearStatus = pane.getDomNode().querySelector('.engine-clipboard-clear-status') as HTMLElement | null;
		assert.ok(clearStatus);
		assert.strictEqual(clearStatus.textContent, formatEngineClipboardClearLabel(1));
		assert.notStrictEqual(clearStatus.style.display, 'none');
		pane.getDomNode().parentElement?.remove();
	});

	test('ClearClipboard success does not keep clear-success when subsequent ListClipboard fails', async () => {
		let listClipboardCalls = 0;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const pane = mountSection(createConversationConnectionTestStub({
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
					listClipboardCalls++;
					if (listClipboardCalls > 1) {
						throw new Error('list boom');
					}
					return {
						entries: [{
							clipId: '  clip  ',
							label: '  Note  ',
							type: 'CLIPBOARD_TEXT',
							createdBy: '',
							createdAt: 0,
						}],
					};
				},
				clearClipboard: async () => {
					return { removedCount: 1 };
				},
			}));
			await flushMicrotasks();
			assert.strictEqual(listClipboardCalls, 1);
			const row = pane.getDomNode().querySelector('.engine-clipboard-row') as HTMLElement | null;
			assert.ok(row);
			const clear = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_CLEAR_LABEL);
			assert.ok(clear);
			clear.click();
			await flushMicrotasks();
			assert.ok(listClipboardCalls >= 2);
			const leftoverRows = pane.getDomNode().querySelectorAll('.engine-clipboard-row');
			assert.strictEqual(leftoverRows.length, 1);
			assert.strictEqual(leftoverRows[0].textContent, formatEngineClipboardListLabel({
				clipId: '  clip  ',
				label: '  Note  ',
				type: 'CLIPBOARD_TEXT',
				createdBy: '',
				createdAt: 0,
			}));
			const clearStatus = pane.getDomNode().querySelector('.engine-clipboard-clear-status') as HTMLElement | null;
			assert.ok(clearStatus);
			assert.notStrictEqual(clearStatus.textContent, formatEngineClipboardClearLabel(1));
			assert.ok(!(clearStatus.textContent ?? '').includes(formatEngineClipboardClearLabel(1)));
			const catalog = pane.getDomNode().querySelector('.engine-catalog-status-widget') as HTMLElement | null;
			assert.ok(catalog);
			assert.strictEqual(catalog.dataset['catalogMode'], 'failed');
			assert.ok((catalog.textContent ?? '').includes(getCatalogFailedCopy(ENGINE_CLIPBOARD_LIST_FEATURE, 'list boom')));
			assert.ok(!(pane.getDomNode().textContent ?? '').includes(ENGINE_CLIPBOARD_LIST_EMPTY_COPY));
			assert.deepStrictEqual(unhandledRejections, []);
			pane.getDomNode().parentElement?.remove();
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('ClearClipboard throw paints clear-status and leaves the row', async () => {
		let listClipboardCalls = 0;
		const pane = mountSection(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listClipboard: async (): Promise<UniverseAgentListClipboardResult> => {
				listClipboardCalls++;
				return {
					entries: [{
						clipId: '  clip  ',
						label: '  Note  ',
						type: 'CLIPBOARD_TEXT',
						createdBy: '',
						createdAt: 0,
					}],
				};
			},
			clearClipboard: async () => {
				throw new Error('boom');
			},
		}));
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		const row = pane.getDomNode().querySelector('.engine-clipboard-row') as HTMLElement | null;
		assert.ok(row);
		const clear = findActionButton(pane.getDomNode(), ENGINE_CLIPBOARD_CLEAR_LABEL);
		assert.ok(clear);
		clear.click();
		await flushMicrotasks();
		assert.strictEqual(listClipboardCalls, 1);
		const leftover = pane.getDomNode().querySelector('.engine-clipboard-row');
		assert.ok(leftover);
		const clearStatus = pane.getDomNode().querySelector('.engine-clipboard-clear-status') as HTMLElement | null;
		assert.ok(clearStatus);
		assert.strictEqual(clearStatus.textContent, 'boom');
		assert.notStrictEqual(clearStatus.style.display, 'none');
		pane.getDomNode().parentElement?.remove();
	});
});
