/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentAgentTreeNode } from '../../common/universeAgentTypes.js';
import { AgentTreeCoordinator, type AgentTreeBoundFact } from '../../node/agentTreeCoordinator.js';

const ROOT: UniverseAgentAgentTreeNode = {
	agentId: 'root',
	name: 'Root',
	type: 'main',
	status: 'running',
	model: 'm',
	turnCount: 1,
	createdAt: 1,
	children: [],
};

suite('AgentTreeCoordinator', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a fetch that resolves after dispose does not call onBound', async () => {
		const pending = new DeferredPromise<UniverseAgentAgentTreeNode | undefined>();
		const coordinator = new AgentTreeCoordinator('s1', { fetchAgentTree: () => pending.p });
		const bound: AgentTreeBoundFact[] = [];

		const pull = coordinator.pullNow(fact => bound.push(fact));
		coordinator.dispose();
		pending.complete(ROOT);

		assert.deepStrictEqual({ result: await pull, bound }, { result: undefined, bound: [] });
	});
});
