/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { IFileMutationRecord } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { ConversationReviewNavService } from '../../browser/conversationReviewNavService.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';

suite('ConversationReviewNavService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const WORKSPACE_ROOT = URI.file('/home/test/project');

	function makeRecord(overrides: Partial<IFileMutationRecord> & Pick<IFileMutationRecord, 'path' | 'toolCallId' | 'turnId'>): IFileMutationRecord {
		return {
			sessionId: 'session-1',
			agentId: 'coder',
			operation: 'modify',
			diffStats: { addedLines: 1, removedLines: 2, changedFiles: 1 },
			...overrides,
		};
	}

	test('late mutation after turn settle uses assistant turn id for review nav', () => {
		const mutationEmitter = store.add(new Emitter<IFileMutationRecord>());
		const connectionChangeEmitter = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const settleEmitter = store.add(new Emitter<import('../../browser/conversationReviewEntry.js').ITurnSettleSignal>());
		const connection = {
			isEngineConnected: () => false,
			getConnectionSnapshot: () => ({
				transport: 'idle' as const,
				workDir: WORKSPACE_ROOT.fsPath,
				pairingPending: false,
				channelAlive: false,
				sharedFsRootSent: false,
				capabilities: {} as never,
			}),
			onDidFileMutation: mutationEmitter.event,
			onDidChangeConnection: connectionChangeEmitter.event,
			onDidTurnSettle: settleEmitter.event,
		} as unknown as IUniverseAgentConnection;

		const roster = {
			getActiveSessionId: () => 'session-1',
			onDidChangeActiveSession: Event.None,
			getSessions: () => [],
			acquireSessionView: () => { throw new Error('not used'); },
		} as unknown as IConversationRosterService;

		const workspace = {
			getWorkspace: () => ({ folders: [{ uri: WORKSPACE_ROOT, name: 'project', index: 0, toResource: () => WORKSPACE_ROOT }] }),
		} as unknown as IWorkspaceContextService;

		const scm = { repositories: [{}] } as unknown as ISCMService;

		const service = store.add(new ConversationReviewNavService(connection, roster, workspace, scm));

		settleEmitter.fire({ sessionId: 'session-1', runtimeTurnId: 'runtime-1', assistantTurnId: 'assistant-1' });
		mutationEmitter.fire(makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'runtime-1' }));

		const records = service.getReviewNavForSession('session-1');
		assert.strictEqual(records.length, 1);
		assert.strictEqual(records[0]!.turnId, 'assistant-1');
		assert.deepStrictEqual(records[0]!.paths, [URI.joinPath(WORKSPACE_ROOT, 'src/a.ts').toString()]);
	});
});
