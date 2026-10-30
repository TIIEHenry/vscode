/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { captureEngineWriteLink, classifyEngineWrite, EngineRefreshGate, engineWriteSelectionNotSentCopy, engineWriteUnconfirmedCopy, evaluateEngineWrite, isSameEngineWriteLink } from '../../browser/engineWriteGate.js';

suite('EngineWriteGate', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function connection(link: { engineIdentityId?: string; linkId?: number }): IUniverseAgentConnection {
		return {
			getConnectionSnapshot: () => ({
				transport: 'ok',
				authenticated: true,
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				engineIdentityId: link.engineIdentityId,
				linkId: link.linkId,
			}),
		} as IUniverseAgentConnection;
	}

	test('capture requires both identity and a positive link id', () => {
		assert.deepStrictEqual(captureEngineWriteLink(connection({ engineIdentityId: 'engine-a', linkId: 3 })), {
			engineIdentityId: 'engine-a',
			linkId: 3,
		});
		assert.strictEqual(captureEngineWriteLink(connection({ engineIdentityId: 'engine-a' })), undefined);
		assert.strictEqual(captureEngineWriteLink(connection({ linkId: 3 })), undefined);
		assert.strictEqual(captureEngineWriteLink(connection({ engineIdentityId: 'engine-a', linkId: 0 })), undefined);
	});

	test('same link compares identity and link id only', () => {
		const current = { engineIdentityId: 'engine-a', linkId: 3 };
		const linked = connection(current);
		assert.strictEqual(isSameEngineWriteLink(linked, { engineIdentityId: 'engine-a', linkId: 3 }), true);
		assert.strictEqual(isSameEngineWriteLink(linked, { engineIdentityId: 'engine-a', linkId: 4 }), false);
		assert.strictEqual(isSameEngineWriteLink(linked, { engineIdentityId: 'engine-b', linkId: 3 }), false);
	});

	test('classify stays current while a refresh would mark the catalog loading', () => {
		const gateStore = store.add(new DisposableStore());
		const linked = connection({ engineIdentityId: 'engine-a', linkId: 3 });
		assert.strictEqual(classifyEngineWrite(gateStore, linked, { engineIdentityId: 'engine-a', linkId: 3 }), 'current');
		assert.strictEqual(classifyEngineWrite(gateStore, linked, { engineIdentityId: 'engine-a', linkId: 9 }), 'changed');
		gateStore.dispose();
		assert.strictEqual(classifyEngineWrite(gateStore, linked, { engineIdentityId: 'engine-a', linkId: 3 }), 'disposed');
	});

	test('refresh token dies on a newer refresh, a link change, and dispose', () => {
		const gateStore = store.add(new DisposableStore());
		const published = { engineIdentityId: 'engine-a', linkId: 3 };
		const linked = connection(published);
		const gate = new EngineRefreshGate(linked, gateStore);
		const first = gate.begin();
		assert.strictEqual(gate.isCurrent(first), true);
		const second = gate.begin();
		assert.strictEqual(gate.isCurrent(first), false);
		assert.strictEqual(gate.isCurrent(second), true);
		published.linkId = 4;
		assert.strictEqual(gate.isCurrent(second), false);
		published.linkId = 3;
		const third = gate.begin();
		assert.strictEqual(gate.isCurrent(third), true);
		gateStore.dispose();
		assert.strictEqual(gate.isCurrent(third), false);
	});

	test('selection mismatch and in-flight generation reuse the existing copies', () => {
		const gateStore = store.add(new DisposableStore());
		const linked = connection({ engineIdentityId: 'engine-a', linkId: 3 });
		const link = { engineIdentityId: 'engine-a', linkId: 3 };
		assert.deepStrictEqual(evaluateEngineWrite(gateStore, linked, {
			link,
			sent: false,
			targetId: 'server-a',
			currentTargetId: 'server-b',
		}), { kind: 'rejected', message: engineWriteSelectionNotSentCopy() });
		assert.deepStrictEqual(evaluateEngineWrite(gateStore, linked, {
			link,
			sent: true,
			generation: 1,
			currentGeneration: 2,
		}), { kind: 'rejected', message: engineWriteUnconfirmedCopy() });
		assert.deepStrictEqual(evaluateEngineWrite(gateStore, linked, {
			link,
			sent: true,
			targetId: 'server-a',
			currentTargetId: 'server-a',
			generation: 4,
			currentGeneration: 4,
		}), { kind: 'current' });
		gateStore.dispose();
		assert.strictEqual(evaluateEngineWrite(gateStore, linked, { link, sent: true }).kind, 'disposed');
	});
});
