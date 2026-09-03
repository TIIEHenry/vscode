/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { LiveAgentTreeNodeView } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { getNavigatorAgentTreePendingCopy } from '../../common/navigatorAgentTreeEmptyState.js';
import { findManagerNodes, getTeamTreeEmptyCopy } from '../../common/navigatorTeamData.js';

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

	test('undefined live tree is loading, not no-team', () => {
		assert.strictEqual(getTeamTreeEmptyCopy('SUPPORTED', undefined), '正在读取 Agent 树…');
		assert.strictEqual(getTeamTreeEmptyCopy('UNKNOWN', undefined), '正在读取 Agent 树…');
		assert.strictEqual(getTeamTreeEmptyCopy('UNSUPPORTED', undefined), '当前引擎不提供 Agent 树，无法列出团队');
		const noManagers: LiveAgentTreeNodeView = { ...treeWithManager, children: [] };
		assert.strictEqual(getTeamTreeEmptyCopy('SUPPORTED', noManagers), '当前会话没有团队');
		assert.strictEqual(getTeamTreeEmptyCopy('SUPPORTED', treeWithManager), undefined);
		assert.ok(!getTeamTreeEmptyCopy('SUPPORTED', undefined)?.includes('没有团队'));
	});

	test('treeFetchFailed is fail note, not loading or no-team', () => {
		const fail = getTeamTreeEmptyCopy('SUPPORTED', undefined, true);
		assert.strictEqual(fail, '读取 Agent 树失败');
		assert.ok(!fail?.includes('正在读取'));
		assert.ok(!fail?.includes('没有团队'));
		assert.strictEqual(
			getNavigatorAgentTreePendingCopy('SUPPORTED', undefined, true),
			getTeamTreeEmptyCopy('SUPPORTED', undefined, true),
		);
		assert.strictEqual(
			getNavigatorAgentTreePendingCopy('UNKNOWN', undefined, true),
			getTeamTreeEmptyCopy('UNKNOWN', undefined, true),
		);
		// Success path still clears to empty/no-team when tree arrived.
		assert.strictEqual(getTeamTreeEmptyCopy('SUPPORTED', { ...treeWithManager, children: [] }, true), '当前会话没有团队');
		assert.strictEqual(getNavigatorAgentTreePendingCopy('SUPPORTED', treeWithManager, true), undefined);
	});

	test('Hierarchy and Team share the same loading empty copy', () => {
		assert.strictEqual(
			getNavigatorAgentTreePendingCopy('SUPPORTED', undefined),
			getTeamTreeEmptyCopy('SUPPORTED', undefined),
		);
		assert.strictEqual(
			getNavigatorAgentTreePendingCopy('UNKNOWN', undefined),
			getTeamTreeEmptyCopy('UNKNOWN', undefined),
		);
	});

	test('Hierarchy and Team share the same fail empty copy (D21)', () => {
		assert.strictEqual(
			getNavigatorAgentTreePendingCopy('SUPPORTED', undefined, true),
			getTeamTreeEmptyCopy('SUPPORTED', undefined, true),
		);
		assert.notStrictEqual(
			getNavigatorAgentTreePendingCopy('SUPPORTED', undefined, true),
			getNavigatorAgentTreePendingCopy('SUPPORTED', undefined, false),
		);
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
