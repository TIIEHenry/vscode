/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentGetGlobalUsageResult, UniverseAgentTokenUsageData } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { getCatalogFailedCopy } from '../../browser/engineCatalog.js';
import { EngineTokenUsageSection } from '../../browser/engineTokenUsageSection.js';
import { getEngineSectionApiUnavailableCopy, getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

const TOKEN_USAGE_FEATURE = 'token usage';
const REFRESH_LABEL = 'Refresh token usage';

const FIELD_LABELS = [
	'Input tokens',
	'Output tokens',
	'Thinking tokens',
	'Cache read tokens',
	'Cache write tokens',
	'Request count',
	'Total cost (micros)',
	'Currency',
] as const;

const SAMPLE_USAGE: UniverseAgentTokenUsageData = {
	inputTokens: 11,
	outputTokens: 22,
	thinkingTokens: 33,
	cacheReadTokens: 44,
	cacheWriteTokens: 55,
	totalCostMicros: 8901234,
	currency: '',
	requestCount: 0,
};

const REFRESHED_USAGE: UniverseAgentTokenUsageData = {
	inputTokens: 101,
	outputTokens: 202,
	thinkingTokens: 303,
	cacheReadTokens: 404,
	cacheWriteTokens: 505,
	totalCostMicros: 8901235,
	currency: 'USD',
	requestCount: 9,
};

suite('EngineTokenUsageSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createUsageConnection(options: {
		connected?: boolean;
		pairingPending?: boolean;
		looksLive?: boolean;
		getGlobalUsage?: IUniverseAgentConnection['getGlobalUsage'];
	} = {}): IUniverseAgentConnection {
		const connected = options.connected ?? false;
		const pairingPending = options.pairingPending ?? false;
		const looksLive = options.looksLive ?? false;
		const capabilities = createEmptyTestCapabilitySnapshot();
		return createConversationConnectionTestStub({
			isEngineConnected: () => connected && (looksLive || !pairingPending),
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: connected ? 'ok' : 'idle',
				authenticated: connected,
				pairingPending,
				channelAlive: connected,
				sharedFsRootSent: false,
				capabilities,
			}),
			getCapabilitySnapshot: () => capabilities,
			getGlobalUsage: options.getGlobalUsage,
		});
	}

	function mountSection(connection: IUniverseAgentConnection): EngineTokenUsageSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineTokenUsageSection, parent));
		section.setSectionActive(true);
		section.setShowSectionHeading(false);
		section.layout(640, 480);
		return section;
	}

	async function flush(): Promise<void> {
		await timeout(0);
	}

	function catalogStatus(root: HTMLElement): HTMLElement {
		return root.querySelector('.engine-catalog-status-widget') as HTMLElement;
	}

	function refreshButton(root: HTMLElement): HTMLButtonElement | null {
		return root.querySelector('.engine-catalog-icon-actions [aria-label="Refresh token usage"]') as HTMLButtonElement | null;
	}

	function forceClick(button: HTMLButtonElement | null): void {
		if (!button) {
			return;
		}
		button.classList.remove('disabled');
		button.removeAttribute('disabled');
		button.setAttribute('aria-disabled', 'false');
		button.click();
	}

	function assertField(root: HTMLElement, label: string, value: string): void {
		const name = [...root.querySelectorAll('.engine-catalog-name')].find(element => element.textContent === label);
		assert.ok(name, label);
		const description = name.nextElementSibling as HTMLElement | null;
		assert.ok(description?.classList.contains('engine-catalog-description'), label);
		assert.strictEqual(description?.textContent, value, label);
	}

	function assertNoUsageRows(root: HTMLElement): void {
		assert.strictEqual(root.querySelector('.engine-catalog-list.engine-catalog-row, .engine-catalog-list .engine-catalog-row'), null);
		const text = root.textContent ?? '';
		for (const label of FIELD_LABELS) {
			assert.ok(!text.includes(label), text);
		}
	}

	test('paints the eight fields from a stub result', async () => {
		let calls = 0;
		const section = mountSection(createUsageConnection({
			connected: true,
			getGlobalUsage() {
				calls++;
				assert.strictEqual(arguments.length, 0);
				return Promise.resolve({ usage: SAMPLE_USAGE });
			},
		}));
		await flush();

		const root = section.getDomNode();
		assert.strictEqual(calls, 1);
		assert.strictEqual(section.getItemCount(), undefined);
		assert.ok(root.querySelector('.engine-catalog-list'));
		assert.deepStrictEqual(
			[...root.querySelectorAll('.engine-catalog-name')].map(element => element.textContent),
			[...FIELD_LABELS],
		);
		assertField(root, 'Input tokens', '11');
		assertField(root, 'Output tokens', '22');
		assertField(root, 'Thinking tokens', '33');
		assertField(root, 'Cache read tokens', '44');
		assertField(root, 'Cache write tokens', '55');
		assertField(root, 'Request count', '0');
		assertField(root, 'Total cost (micros)', '8901234');
		assertField(root, 'Currency', '');
		assert.ok(!(root.textContent ?? '').includes('$'));
		assert.ok(!(root.textContent ?? '').includes('8.901234'));

		const button = refreshButton(root);
		assert.ok(button);
		assert.strictEqual(button.getAttribute('aria-label'), REFRESH_LABEL);
		assert.strictEqual(button.textContent, '');
		assert.ok(button.classList.contains('codicon-refresh'));
		assert.notStrictEqual(button.parentElement?.style.display, 'none');
		assert.strictEqual(catalogStatus(root).style.display, 'none');

		root.parentElement?.remove();
	});

	test('refresh calls getGlobalUsage again', async () => {
		let calls = 0;
		let usage = SAMPLE_USAGE;
		const section = mountSection(createUsageConnection({
			connected: true,
			getGlobalUsage() {
				calls++;
				assert.strictEqual(arguments.length, 0);
				return Promise.resolve({ usage });
			},
		}));
		await flush();
		assert.strictEqual(calls, 1);
		assertField(section.getDomNode(), 'Input tokens', '11');

		usage = REFRESHED_USAGE;
		const button = refreshButton(section.getDomNode());
		assert.ok(button);
		button.click();
		await flush();

		assert.strictEqual(calls, 2);
		const root = section.getDomNode();
		assert.strictEqual(root.querySelectorAll('.engine-catalog-row').length, 8);
		assertField(root, 'Input tokens', '101');
		assertField(root, 'Output tokens', '202');
		assertField(root, 'Thinking tokens', '303');
		assertField(root, 'Cache read tokens', '404');
		assertField(root, 'Cache write tokens', '505');
		assertField(root, 'Request count', '9');
		assertField(root, 'Total cost (micros)', '8901235');
		assertField(root, 'Currency', 'USD');
		assert.ok(!(root.textContent ?? '').includes('8.901235'));

		root.parentElement?.remove();
	});

	test('missing method shows unavailable and does not throw', async () => {
		const section = mountSection(createUsageConnection({ connected: true }));
		await flush();

		const root = section.getDomNode();
		const status = catalogStatus(root);
		const text = status?.textContent ?? '';
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.ok(text.includes(getEngineSectionApiUnavailableCopy(TOKEN_USAGE_FEATURE)), text);
		assert.ok(!text.includes(getEngineSectionDisconnectedCopy()), text);
		assertNoUsageRows(root);
		assert.strictEqual(refreshButton(root)?.parentElement?.style.display, 'none');
		assert.doesNotThrow(() => forceClick(refreshButton(root)));
		await flush();
		assertNoUsageRows(root);
		assert.strictEqual(catalogStatus(root).dataset['catalogMode'], 'unsupported');

		root.parentElement?.remove();
	});

	test('disconnected does not call', async () => {
		let calls = 0;
		const connection = createUsageConnection({
			connected: false,
			getGlobalUsage: () => {
				calls++;
				return Promise.resolve({ usage: SAMPLE_USAGE });
			},
		});
		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const section = mountSection(connection);
		await flush();
		const root = section.getDomNode();
		const status = catalogStatus(root);
		assert.strictEqual(calls, 0);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok((status.textContent ?? '').includes(getEngineSectionDisconnectedCopy()));
		assertNoUsageRows(root);

		forceClick(refreshButton(root));
		await flush();
		assert.strictEqual(calls, 0);
		assertNoUsageRows(root);

		root.parentElement?.remove();
	});

	test('pairing-hold does not call', async () => {
		let calls = 0;
		const connection = createUsageConnection({
			connected: true,
			pairingPending: true,
			looksLive: true,
			getGlobalUsage: () => {
				calls++;
				return Promise.resolve({ usage: SAMPLE_USAGE });
			},
		});
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(isConversationPairingHold(connection), true);

		const section = mountSection(connection);
		await flush();
		const root = section.getDomNode();
		const status = catalogStatus(root);
		const text = status?.textContent ?? '';
		assert.strictEqual(calls, 0);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(text.includes(getEngineSectionDisconnectedCopy()), text);
		assert.ok(!text.includes(getEngineSectionApiUnavailableCopy(TOKEN_USAGE_FEATURE)), text);
		assertNoUsageRows(root);

		forceClick(refreshButton(root));
		await flush();
		assert.strictEqual(calls, 0);
		assertNoUsageRows(root);

		root.parentElement?.remove();
	});

	test('late response after dispose does not paint', async () => {
		let calls = 0;
		let resolveUsage: (value: UniverseAgentGetGlobalUsageResult) => void = () => { };
		const section = mountSection(createUsageConnection({
			connected: true,
			getGlobalUsage: () => {
				calls++;
				return new Promise(resolve => {
					resolveUsage = resolve;
				});
			},
		}));
		assert.strictEqual(calls, 1);
		const root = section.getDomNode();
		assertNoUsageRows(root);

		section.dispose();
		resolveUsage({
			usage: {
				inputTokens: 8675309,
				outputTokens: 1,
				thinkingTokens: 1,
				cacheReadTokens: 1,
				cacheWriteTokens: 1,
				totalCostMicros: 1,
				currency: 'USD',
				requestCount: 1,
			},
		});
		await flush();

		assert.strictEqual(calls, 1);
		assert.strictEqual(root.querySelector('.engine-catalog-row'), null);
		assert.ok(!(root.textContent ?? '').includes('8675309'));
		assert.ok(!(root.textContent ?? '').includes('Input tokens'));

		root.parentElement?.remove();
	});

	test('error path does not show zeros as success', async () => {
		let calls = 0;
		const section = mountSection(createUsageConnection({
			connected: true,
			getGlobalUsage: () => {
				calls++;
				return Promise.reject(new Error('usage exploded'));
			},
		}));
		await flush();

		const root = section.getDomNode();
		const status = catalogStatus(root);
		const text = root.textContent ?? '';
		assert.strictEqual(calls, 1);
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'failed');
		assert.ok(status.textContent?.includes(getCatalogFailedCopy(TOKEN_USAGE_FEATURE, 'usage exploded')), status.textContent ?? '');
		assert.notStrictEqual(status.dataset['catalogMode'], 'ready');
		assertNoUsageRows(root);
		assert.ok(!text.includes('$'));
		assert.strictEqual(root.querySelectorAll('.engine-catalog-description').length, 0);

		root.parentElement?.remove();
	});
});
