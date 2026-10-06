/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import type { ConversationViewFrameApplied, IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ConversationSessionChatService } from './conversationSessionChatService.js';
import { ConversationStubService, IConversationRosterService } from './conversationStubService.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

const SESSION_KEY = 'ua-bind-fail';

function makeLiveAgentTree(children: LiveAgentTreeNodeView[] = []): LiveAgentTreeNodeView {
	return {
		agentId: 'root',
		name: 'Root',
		type: 'AGENT_TYPE_ROOT',
		status: 'AGENT_STATUS_IDLE',
		model: 'm',
		turnCount: 0,
		createdAt: 0,
		children,
	};
}

function makeSubAgent(agentId: string, name: string): LiveAgentTreeNodeView {
	return {
		agentId,
		name,
		type: 'AGENT_TYPE_SUB',
		status: 'AGENT_STATUS_IDLE',
		model: 'm',
		turnCount: 0,
		createdAt: 0,
		children: [],
	};
}

suite('ConversationSessionChatService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('bindLiveTreeLease disposes lease when initial apply fails instead of leaving a stale frame listener', () => {
		let snapshotReads = 0;
		let leaseDisposed = false;
		const tree = makeLiveAgentTree([makeSubAgent('web', 'Web search')]);
		const applyError = new Error('live-tree apply failed');

		class ApplyFailOnceRoster extends ConversationStubService {
			readonly frameEmitter = store.add(new Emitter<ConversationViewFrameApplied>());

			override isEngineConnected(): boolean {
				return true;
			}

			override isEngineSessionReady(): boolean {
				return true;
			}

			override getActiveSessionId(): string {
				return SESSION_KEY;
			}

			override acquireSessionView(sessionId: string): IConversationSessionViewLease {
				return {
					sessionId,
					get snapshot() {
						snapshotReads++;
						if (snapshotReads === 1) {
							throw applyError;
						}
						return { liveAgentTree: tree } as IConversationSessionViewLease['snapshot'];
					},
					attribution: new Map(),
					details: new Map(),
					onDidApplyFrame: this.frameEmitter.event,
					post: async () => ({ accepted: true, correlation: { id: 't' } }),
					requestResync: () => { },
					dispose: () => { leaseDisposed = true; },
				};
			}

			rebindLiveTree(): void {
				this._onDidChangeEngineConnection.fire(this.isEngineConnected());
			}
		}

		const errors: string[] = [];
		const roster = store.add(new ApplyFailOnceRoster());
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(INotificationService, {
			error: (message: string | Error) => {
				errors.push(typeof message === 'string' ? message : getErrorMessage(message));
			},
		} as INotificationService);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub({
			getConnectionSnapshot: () => ({
				transport: 'idle',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: true,
				capabilities: createEmptyTestCapabilitySnapshot(),
			}),
		}));

		const sessionChatService = store.add(instantiationService.createInstance(ConversationSessionChatService));
		assert.ok(errors.some(message => message === getErrorMessage(applyError)));
		assert.strictEqual(leaseDisposed, true, 'failed bind must dispose the acquired lease');
		assert.deepStrictEqual(sessionChatService.getCatalog(SESSION_KEY), []);

		roster.frameEmitter.fire({ kind: 'baseline' });
		assert.deepStrictEqual(sessionChatService.getCatalog(SESSION_KEY), [], 'stale frame listener must not sync after failed bind');

		roster.rebindLiveTree();
		assert.ok(sessionChatService.getCatalog(SESSION_KEY).some(entry => entry.chatId === 'web'));
	});
});
