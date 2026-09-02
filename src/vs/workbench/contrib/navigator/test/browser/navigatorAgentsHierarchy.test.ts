/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { LiveAgentTreeNodeView } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import {
	formatAgentStatusLabel,
	isRootOnlyAgentTree,
	liveAgentTreeToHierarchyNodes,
} from '../../common/navigatorAgentHierarchy.js';

suite('NavigatorAgentsHierarchy (N2)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const sampleTree: LiveAgentTreeNodeView = {
		agentId: 'root',
		name: 'Root',
		type: 'AGENT_TYPE_ROOT',
		status: 'AGENT_STATUS_UNKNOWN',
		model: 'gpt-test',
		turnCount: 1,
		createdAt: 1,
		children: [{
			agentId: 'sub:alpha',
			name: 'Alpha',
			type: 'AGENT_TYPE_SUB',
			status: 'AGENT_STATUS_GENERATING',
			model: 'gpt-test',
			turnCount: 2,
			createdAt: 2,
			children: [],
		}],
	};

	test('liveAgentTree maps to three-level hierarchy', () => {
		const root = liveAgentTreeToHierarchyNodes(sampleTree);
		assert.strictEqual(root.agentId, 'root');
		assert.strictEqual(root.children?.length, 1);
		assert.strictEqual(root.children?.[0]?.agentId, 'sub:alpha');
	});

	test('UNKNOWN agent status maps to 状态未知', () => {
		assert.strictEqual(formatAgentStatusLabel('AGENT_STATUS_UNKNOWN'), '状态未知');
	});

	test('only root agent tree is detectable', () => {
		const onlyRoot: LiveAgentTreeNodeView = { ...sampleTree, children: [] };
		assert.strictEqual(isRootOnlyAgentTree(onlyRoot), true);
		assert.strictEqual(isRootOnlyAgentTree(sampleTree), false);
	});
});
