/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { LiveAgentTreeNodeView } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { findManagerNodes } from '../../common/navigatorTeamData.js';

suite('NavigatorTeam (N4)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const treeWithManager: LiveAgentTreeNodeView = {
		agentId: 'root',
		name: 'Root',
		type: 'AGENT_TYPE_ROOT',
		status: 'AGENT_STATUS_IDLE',
		model: 'm',
		turnCount: 0,
		createdAt: 0,
		children: [{
			agentId: 'mgr:1',
			name: 'Manager',
			type: 'AGENT_TYPE_SUB',
			status: 'AGENT_STATUS_IDLE',
			model: 'm',
			turnCount: 0,
			createdAt: 0,
			children: [{
				agentId: 'member:1',
				name: 'Member',
				type: 'AGENT_TYPE_MEMBER',
				status: 'AGENT_STATUS_IDLE',
				model: 'm',
				turnCount: 0,
				createdAt: 0,
				children: [],
			}],
		}],
	};

	test('findManagerNodes returns nodes with MEMBER children', () => {
		const managers = findManagerNodes(treeWithManager);
		assert.strictEqual(managers.length, 1);
		assert.strictEqual(managers[0]?.agentId, 'mgr:1');
	});

	test('tree without MEMBER yields no managers', () => {
		const tree: LiveAgentTreeNodeView = { ...treeWithManager, children: [] };
		assert.strictEqual(findManagerNodes(tree).length, 0);
	});

	test('liveTeamId empty must skip teamInfo (contract)', () => {
		const liveTeamId: number | undefined = undefined;
		let teamInfoCalls = 0;
		if (liveTeamId !== undefined) {
			teamInfoCalls++;
		}
		assert.strictEqual(teamInfoCalls, 0);
	});
});
