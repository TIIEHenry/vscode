/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { getCatalogUnsupportedCopy } from '../../browser/engineCatalog.js';
import { EngineRulesSection } from '../../browser/engineRulesSection.js';
import { getEngineSectionApiUnavailableCopy, getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

const RULES_FEATURE = 'rules catalog';

suite('EngineRulesSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function unsupportedRulesCapabilities(): UniverseAgentCapabilitySnapshot {
		return {
			...createEmptyTestCapabilitySnapshot(),
			globalRules: { support: 'UNSUPPORTED', reason: 'no rules RPC' },
			projectRules: { support: 'UNSUPPORTED', reason: 'no rules RPC' },
		};
	}

	function createRulesConnection(options: {
		connected?: boolean;
		pairingPending?: boolean;
		looksLive?: boolean;
		capabilities?: UniverseAgentCapabilitySnapshot;
		listProjectRules?: IUniverseAgentConnection['listProjectRules'];
	} = {}): IUniverseAgentConnection {
		const connected = options.connected ?? false;
		const pairingPending = options.pairingPending ?? false;
		const looksLive = options.looksLive ?? false;
		const capabilities = options.capabilities ?? unsupportedRulesCapabilities();
		return createConversationConnectionTestStub({
			isEngineConnected: () => connected && (looksLive || !pairingPending),
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: connected ? 'ok' : 'idle',
				sessionToken: connected ? 'tok' : undefined,
				pairingPending,
				channelAlive: connected,
				sharedFsRootSent: false,
				capabilities,
			}),
			getCapabilitySnapshot: () => capabilities,
			listProjectRules: options.listProjectRules,
		});
	}

	function mountSection(connection: IUniverseAgentConnection): EngineRulesSection {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineRulesSection, parent));
		section.setSectionActive(true);
		return section;
	}

	function catalogStatus(root: HTMLElement): HTMLElement {
		return root.querySelector('.engine-catalog-status-widget') as HTMLElement;
	}

	test('leftover-looks-live pairing-hold paints disconnected status, not capability/unsupported-as-live', () => {
		const connection = createRulesConnection({ connected: true, pairingPending: true, looksLive: true });
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const section = mountSection(connection);
		const status = catalogStatus(section.getDomNode());
		const text = status?.textContent ?? '';
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(text.includes(getEngineSectionDisconnectedCopy()), text);
		assert.ok(!text.includes(getCatalogUnsupportedCopy(RULES_FEATURE, 'no rules RPC')), text);
		assert.ok(!text.includes(getEngineSectionApiUnavailableCopy(RULES_FEATURE)), text);
		assert.notStrictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.notStrictEqual(status.dataset['catalogMode'], 'loading');

		section.getDomNode().parentElement?.remove();
	});

	test('true connected without pairing keeps capability/unsupported path', () => {
		const connection = createRulesConnection({ connected: true, pairingPending: false });
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const section = mountSection(connection);
		const status = catalogStatus(section.getDomNode());
		const text = status?.textContent ?? '';
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.ok(text.includes(getCatalogUnsupportedCopy(RULES_FEATURE, 'no rules RPC')), text);
		assert.ok(!text.includes(getEngineSectionDisconnectedCopy()), text);

		section.getDomNode().parentElement?.remove();
	});

	test('true disconnect still paints disconnected status', () => {
		const connection = createRulesConnection({ connected: false, pairingPending: false });
		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'disconnected');
		assert.strictEqual(isConversationPairingHold(connection), false);

		const section = mountSection(connection);
		const status = catalogStatus(section.getDomNode());
		const text = status?.textContent ?? '';
		assert.ok(status);
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(text.includes(getEngineSectionDisconnectedCopy()), text);
		assert.ok(!text.includes(getEngineSectionApiUnavailableCopy(RULES_FEATURE)), text);

		section.getDomNode().parentElement?.remove();
	});

	test('does not leak unhandled rejection when refresh catch-path render throws and onUnexpectedError warn-then-rethrows', async () => {
		// refresh() already catches list throw; a lone inner reject does not leak.
		// The void call site still needs `.catch` when the catch-path render throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			const connection = createRulesConnection({
				connected: true,
				capabilities: {
					...createEmptyTestCapabilitySnapshot(),
					globalRules: { support: 'SUPPORTED' },
					projectRules: { support: 'SUPPORTED' },
				},
				listProjectRules: async () => {
					throw new Error('list boom');
				},
			});
			const section = mountSection(connection);
			const status = (section as unknown as { status: { render(options: { readonly mode: string }): void } }).status;
			const originalRender = status.render.bind(status);
			status.render = (options: { readonly mode: string }) => {
				if (options.mode === 'failed') {
					throw paintBoom;
				}
				originalRender(options);
			};
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
			section.getDomNode().parentElement?.remove();
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
