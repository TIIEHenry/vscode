/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { UniverseAgentCapabilitySupport, UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { EngineHooksSection } from '../../browser/engineHooksSection.js';
import { getCatalogUnknownCopy, getCatalogUnsupportedCopy } from '../../browser/engineCatalog.js';
import { getEngineSectionDisconnectedCopy } from '../../browser/engineSectionChrome.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

const HOOKS_FEATURE = 'hook metadata';
const HOOKS_UNSUPPORTED_REASON = 'no hooks RPC';

suite('EngineHooksSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createMutableHooksConnection(options: {
		connected?: boolean;
		pairingPending?: boolean;
		looksLive?: boolean;
		hooksSupport?: UniverseAgentCapabilitySupport;
		hooksReason?: string;
	} = {}): IUniverseAgentConnection & {
		setPairingPending(value: boolean): void;
		setConnected(value: boolean): void;
	} {
		const capabilities = createEmptyTestCapabilitySnapshot();
		capabilities.hooksMetadata = {
			support: options.hooksSupport ?? 'UNSUPPORTED',
			reason: options.hooksReason ?? HOOKS_UNSUPPORTED_REASON,
		};
		let connected = options.connected ?? true;
		let pairingPending = options.pairingPending ?? false;
		const looksLive = options.looksLive ?? false;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sessionToken: connected ? 'tok' : undefined,
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities,
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => connected && (looksLive || !pairingPending),
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: onDidChangeConnection.event,
		});
		return Object.assign(connection, {
			setPairingPending(value: boolean) {
				pairingPending = value;
				onDidChangeConnection.fire(snapshot());
			},
			setConnected(value: boolean) {
				connected = value;
				onDidChangeConnection.fire(snapshot());
			},
		});
	}

	function mountSection(connection: IUniverseAgentConnection): { section: EngineHooksSection; parent: HTMLElement } {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineHooksSection, parent));
		section.setSectionActive(true);
		return { section, parent };
	}

	function catalogStatus(root: HTMLElement): HTMLElement {
		const status = root.querySelector('.engine-catalog-status-widget') as HTMLElement | null;
		assert.ok(status);
		return status;
	}

	test('leftover-looks-live pairing-hold still paints disconnected status', () => {
		const connection = createMutableHooksConnection({
			connected: true,
			pairingPending: true,
			looksLive: true,
			hooksSupport: 'UNSUPPORTED',
		});
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const { section, parent } = mountSection(connection);
		const status = catalogStatus(section.getDomNode());
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		assert.ok(!status.textContent?.includes(getCatalogUnsupportedCopy(HOOKS_FEATURE, HOOKS_UNSUPPORTED_REASON)));
		assert.ok(!status.textContent?.includes(getCatalogUnknownCopy()));
		parent.remove();
	});

	test('true connected without pairing keeps capability unsupported path', () => {
		const connection = createMutableHooksConnection({
			connected: true,
			pairingPending: false,
			looksLive: false,
			hooksSupport: 'UNSUPPORTED',
		});
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const { section, parent } = mountSection(connection);
		const status = catalogStatus(section.getDomNode());
		assert.strictEqual(status.dataset['catalogMode'], 'unsupported');
		assert.ok(status.textContent?.includes(getCatalogUnsupportedCopy(HOOKS_FEATURE, HOOKS_UNSUPPORTED_REASON)));
		assert.ok(!status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		parent.remove();
	});

	test('true connected UNKNOWN capability still paints loading', () => {
		const connection = createMutableHooksConnection({
			connected: true,
			pairingPending: false,
			hooksSupport: 'UNKNOWN',
		});
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const { section, parent } = mountSection(connection);
		const status = catalogStatus(section.getDomNode());
		assert.strictEqual(status.dataset['catalogMode'], 'loading');
		assert.ok(status.textContent?.includes(getCatalogUnknownCopy()));
		assert.ok(!status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		parent.remove();
	});

	test('true disconnect still paints disconnected status', () => {
		const connection = createMutableHooksConnection({
			connected: true,
			pairingPending: false,
			looksLive: true,
			hooksSupport: 'UNSUPPORTED',
		});
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const { section, parent } = mountSection(connection);
		const status = catalogStatus(section.getDomNode());
		assert.strictEqual(status.dataset['catalogMode'], 'unsupported');

		connection.setConnected(false);
		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'disconnected');
		assert.strictEqual(status.dataset['catalogMode'], 'disconnected');
		assert.ok(status.textContent?.includes(getEngineSectionDisconnectedCopy()));
		parent.remove();
	});
});
