/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentListClipboardRequest,
	UniverseAgentListClipboardResult,
	UniverseAgentReadClipboardRequest,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ENGINE_CLIPBOARD_READ_LABEL } from '../../browser/engineClipboardList.js';
import { EngineClipboardSection } from '../../browser/engineClipboardSection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';

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

	function findReadButton(root: HTMLElement): HTMLButtonElement | undefined {
		return [...root.querySelectorAll('.engine-clipboard-actions .monaco-button')]
			.find(button => button.textContent === ENGINE_CLIPBOARD_READ_LABEL) as HTMLButtonElement | undefined;
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
		assert.ok((noHook.getDomNode().textContent ?? '').includes('does not expose'));
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
		assert.ok((pane.getDomNode().textContent ?? '').includes('No clipboard entries.'));
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
});
