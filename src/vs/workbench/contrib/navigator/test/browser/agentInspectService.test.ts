/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All-------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { AgentInspectService } from '../../browser/agentInspectService.js';
import { AgentInspectTarget, IUniverseAgentConnectionOwner } from '../../common/agentInspect.js';
import { createNavigatorConnectionTestStub } from '../common/navigatorConnectionTestStub.js';

suite('AgentInspectService (connection owner transitions)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createAgentNode(partial: { agentId: string; name?: string; type?: string; status?: string }) {
		return {
			agentId: partial.agentId,
			name: partial.name ?? partial.agentId,
			type: partial.type ?? 'AGENT_TYPE_SUB',
			status: partial.status ?? 'AGENT_STATUS_IDLE',
			model: 'gpt',
			turnCount: 1,
			createdAt: 100,
			children: [],
		};
	}

	test('target retention across undefined to published connection owner transitions', () => {
		const changeEmitter = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		let currentSnapshot: UniverseAgentConnectionSnapshot = {
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createEmptyCapabilitySnapshot(),
			phase: { kind: 'connecting', reason: 'initial' },
			linkId: undefined,
			engineIdentityId: undefined,
		};
		const stubConnection = createNavigatorConnectionTestStub({
			getConnectionSnapshot: () => currentSnapshot,
			getConnectionPhase: () => currentSnapshot.phase ?? { kind: 'disconnected' },
			onDidChangeConnection: changeEmitter.event,
		});

		const inspectService = store.add(new AgentInspectService(stubConnection));
		assert.strictEqual(inspectService.getActiveOwner(), undefined, 'activeOwner should initially be undefined');

		const targetEvents: (AgentInspectTarget | undefined)[] = [];
		store.add(inspectService.onDidChangeTarget(t => targetEvents.push(t)));

		// Select a target while establishing identity (activeOwner === undefined)
		const unboundTarget: AgentInspectTarget = {
			kind: 'agent',
			sessionId: 'sess-initial',
			node: createAgentNode({ agentId: 'agent-early' }),
		};
		inspectService.setTarget(unboundTarget);

		assert.ok(inspectService.getTarget());
		assert.strictEqual(inspectService.getTarget()?.expectedOwner, undefined);
		assert.strictEqual(targetEvents.length, 1);

		// Engine finishes establishing connection and publishes identity
		const publishedOwner: IUniverseAgentConnectionOwner = { linkId: 10, engineIdentityId: 'engine-alpha' };
		currentSnapshot = {
			...currentSnapshot,
			transport: 'ok',
			channelAlive: true,
			phase: { kind: 'connected', path: 'direct' },
			linkId: publishedOwner.linkId,
			engineIdentityId: publishedOwner.engineIdentityId,
		};
		changeEmitter.fire(currentSnapshot);

		// Target must be retained and must adopt the newly published owner
		assert.deepStrictEqual(inspectService.getActiveOwner(), publishedOwner);
		const currentTarget = inspectService.getTarget();
		assert.ok(currentTarget, 'Target must not be prematurely cleared when engine publishes identity');
		assert.strictEqual(currentTarget.kind, 'agent');
		if (currentTarget.kind === 'agent') {
			assert.strictEqual(currentTarget.node.agentId, 'agent-early');
			assert.strictEqual(currentTarget.sessionId, 'sess-initial');
			assert.deepStrictEqual(currentTarget.expectedOwner, publishedOwner, 'Target must adopt newly published owner');
		}

		// Ensure target change event fired for adopting the owner
		assert.strictEqual(targetEvents.length, 2);
		assert.deepStrictEqual(targetEvents[1]?.expectedOwner, publishedOwner);
	});

	test('adopts published connection owner across different target kinds (member, task, activity)', () => {
		const changeEmitter = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		let currentSnapshot: UniverseAgentConnectionSnapshot = {
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createEmptyCapabilitySnapshot(),
			phase: { kind: 'connecting', reason: 'initial' },
			linkId: undefined,
			engineIdentityId: undefined,
		};
		const stubConnection = createNavigatorConnectionTestStub({
			getConnectionSnapshot: () => currentSnapshot,
			getConnectionPhase: () => currentSnapshot.phase ?? { kind: 'disconnected' },
			onDidChangeConnection: changeEmitter.event,
		});

		const inspectService = store.add(new AgentInspectService(stubConnection));

		// Test member target
		inspectService.setTarget({
			kind: 'member',
			sessionId: 'sess-team',
			info: { memberName: 'Member 1', memberAgentId: 'm-1', status: 'ACTIVE', preset: '', dynamic: '', turnCount: 1 },
		});
		assert.strictEqual(inspectService.getTarget()?.expectedOwner, undefined);

		const owner: IUniverseAgentConnectionOwner = { linkId: 12, engineIdentityId: 'engine-12' };
		currentSnapshot = {
			...currentSnapshot,
			transport: 'ok',
			channelAlive: true,
			phase: { kind: 'connected', path: 'direct' },
			linkId: owner.linkId,
			engineIdentityId: owner.engineIdentityId,
		};
		changeEmitter.fire(currentSnapshot);

		const adopted = inspectService.getTarget();
		assert.ok(adopted);
		assert.strictEqual(adopted.kind, 'member');
		assert.deepStrictEqual(adopted.expectedOwner, owner);
	});

	test('clears targets only when identity diverges from an existing active owner', () => {
		const changeEmitter = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		let currentSnapshot: UniverseAgentConnectionSnapshot = {
			transport: 'ok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: true,
			capabilities: createEmptyCapabilitySnapshot(),
			phase: { kind: 'connected', path: 'direct' },
			linkId: 1,
			engineIdentityId: 'engine-1',
		};
		const stubConnection = createNavigatorConnectionTestStub({
			getConnectionSnapshot: () => currentSnapshot,
			getConnectionPhase: () => currentSnapshot.phase ?? { kind: 'disconnected' },
			onDidChangeConnection: changeEmitter.event,
		});

		const inspectService = store.add(new AgentInspectService(stubConnection));
		inspectService.setTarget({
			kind: 'agent',
			sessionId: 'sess-1',
			node: createAgentNode({ agentId: 'agent-1' }),
		});
		assert.ok(inspectService.getTarget());

		// Diverging owner (linkId 2, engine-2)
		currentSnapshot = {
			...currentSnapshot,
			linkId: 2,
			engineIdentityId: 'engine-2',
		};
		changeEmitter.fire(currentSnapshot);

		assert.strictEqual(inspectService.getTarget(), undefined, 'Target must be invalidated when identity diverges from active owner');
		assert.deepStrictEqual(inspectService.getActiveOwner(), { linkId: 2, engineIdentityId: 'engine-2' });
	});

	test('preserves target and guards setLiveAgentIds during transient engine reconnection phases', () => {
		const changeEmitter = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		let currentSnapshot: UniverseAgentConnectionSnapshot = {
			transport: 'ok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: true,
			capabilities: createEmptyCapabilitySnapshot(),
			phase: { kind: 'connected', path: 'direct' },
			linkId: 7,
			engineIdentityId: 'engine-7',
		};
		const stubConnection = createNavigatorConnectionTestStub({
			getConnectionSnapshot: () => currentSnapshot,
			getConnectionPhase: () => currentSnapshot.phase ?? { kind: 'disconnected' },
			onDidChangeConnection: changeEmitter.event,
		});

		const inspectService = store.add(new AgentInspectService(stubConnection));
		inspectService.setTarget({
			kind: 'agent',
			sessionId: 'sess-7',
			node: createAgentNode({ agentId: 'agent-7' }),
		});
		inspectService.setLiveAgentIds('agents', new Set(['agent-7']), 'sess-7');
		assert.deepStrictEqual(inspectService.getLiveAgentIds(), new Set(['agent-7']));

		// Transient engine reconnection phase (transport_lost)
		currentSnapshot = {
			...currentSnapshot,
			transport: 'idle',
			channelAlive: false,
			phase: { kind: 'connecting', reason: 'transport_lost' },
			linkId: undefined,
			engineIdentityId: undefined,
		};
		changeEmitter.fire(currentSnapshot);

		// Target must remain preserved during transient reconnection
		const targetAfterDrop = inspectService.getTarget();
		assert.ok(targetAfterDrop, 'Target must be preserved during transient reconnection phase');
		if (targetAfterDrop?.kind === 'agent') {
			assert.strictEqual(targetAfterDrop.node.agentId, 'agent-7');
		} else {
			assert.fail('Target kind should be agent');
		}

		// Calls to setLiveAgentIds during connecting phase must be guarded to preserve target state
		inspectService.setLiveAgentIds('agents', new Set());
		assert.deepStrictEqual(inspectService.getLiveAgentIds(), new Set(['agent-7']), 'Live IDs must be guarded during reconnection phase');

		// Reconnection completes with the same engine owner
		currentSnapshot = {
			...currentSnapshot,
			transport: 'ok',
			channelAlive: true,
			phase: { kind: 'connected', path: 'direct' },
			linkId: 7,
			engineIdentityId: 'engine-7',
		};
		changeEmitter.fire(currentSnapshot);

		assert.ok(inspectService.getTarget(), 'Target must remain active after reconnecting to same owner');
		assert.deepStrictEqual(inspectService.getActiveOwner(), { linkId: 7, engineIdentityId: 'engine-7' });
	});
});
