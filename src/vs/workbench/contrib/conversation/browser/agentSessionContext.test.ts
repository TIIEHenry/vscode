/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { emptySessionViewSnapshot } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IWorkspaceContextService, IWorkspaceFolder, IWorkspaceFoldersChangeEvent, WorkspaceFolder } from '../../../../platform/workspace/common/workspace.js';
import { URI } from '../../../../base/common/uri.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { ISCMRepository, ISCMService } from '../../scm/common/scm.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';
import { AgentSessionContext } from './agentSessionContext.js';
import { ConversationStubSession } from './conversationStubModel.js';
import { IConversationRosterService } from './conversationStubService.js';

suite('AgentSessionContext (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('dispose releases session view leases acquired while releasing held leases', () => {
		const rosterActiveChange = store.add(new Emitter<string>());
		const innerDisposes: string[] = [];
		let releaseHook: (() => void) | undefined;

		const roster: IConversationRosterService = {
			_serviceBrand: undefined,
			getActiveSessionId: () => 'session-held',
			getSessions: () => [],
			isEngineSessionReady: () => true,
			onDidChangeActiveSession: rosterActiveChange.event,
			onDidChangeSession: Event.None,
			acquireSessionView: (sessionId: string) => ({
				snapshot: emptySessionViewSnapshot(sessionId as never),
				attribution: new Map(),
				dispose: () => {
					innerDisposes.push(sessionId);
					if (sessionId === 'session-held') {
						releaseHook?.();
					}
				},
			} as unknown as IConversationSessionViewLease),
		} as unknown as IConversationRosterService;

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		instantiationService.stub(ISCMService, emptyScmService());

		const context = store.add(instantiationService.createInstance(AgentSessionContext));
		store.add(context.onDidChangeActiveSession(() => {
			context.acquireSessionView('session-reentrant');
		}));

		releaseHook = () => rosterActiveChange.fire('session-reentrant');
		context.acquireSessionView('session-held');

		context.dispose();

		assert.deepStrictEqual(innerDisposes, ['session-held', 'session-reentrant']);
	});

	test('same work root does not fire, and switching session does', () => {
		const harness = createWorkRootHarness(store);
		harness.setSnapshot({ linkId: 1, engineIdentityId: 'eng', workDir: '/repo' });
		harness.sessions = [
			{ id: 'a', title: 'A', turns: [], workDir: '/repo' },
			{ id: 'b', title: 'B', turns: [], workDir: '/repo' },
		];
		harness.activeSessionId = 'a';
		const context = harness.create();
		const seen: string[] = [];
		store.add(context.onDidChangeActiveWorkRoot(root => seen.push(root.sessionId)));

		harness.fireConnection();
		assert.deepStrictEqual(seen, []);

		harness.activeSessionId = 'b';
		harness.fireActiveSession('b');
		assert.deepStrictEqual(seen, ['b']);
		assert.strictEqual(context.getActiveWorkRoot().workDir, '/repo');
	});

	test('a new engine link replaces the cached identity', () => {
		const harness = createWorkRootHarness(store);
		harness.setSnapshot({ linkId: 1, engineIdentityId: 'eng-a', workDir: '/a' });
		harness.activeSessionId = 'a';
		harness.sessions = [{ id: 'a', title: 'A', turns: [] }];
		const context = harness.create();
		const seen: string[] = [];
		store.add(context.onDidChangeActiveWorkRoot(root => seen.push(root.engineIdentityId ?? '')));

		harness.setSnapshot({ linkId: 2, engineIdentityId: 'eng-b', workDir: '/b' });
		harness.fireConnection();
		assert.strictEqual(context.getActiveWorkRoot().engineIdentityId, 'eng-b');
		assert.strictEqual(context.getActiveWorkRoot().workDir, '/b');
		assert.strictEqual(context.getActiveWorkRoot().source, 'connection');
		assert.deepStrictEqual(seen, ['eng-b']);
	});

	test('clearing the snapshot during disconnect keeps the work root and does not fire', () => {
		const harness = createWorkRootHarness(store);
		harness.setSnapshot({ linkId: 1, engineIdentityId: 'eng-a', workDir: '/a' });
		harness.activeSessionId = 'a';
		harness.sessions = [{ id: 'a', title: 'A', turns: [] }];
		const context = harness.create();
		const seen: number[] = [];
		store.add(context.onDidChangeActiveWorkRoot(() => seen.push(1)));

		harness.setSnapshot({});
		harness.fireConnection();
		const root = context.getActiveWorkRoot();
		assert.strictEqual(root.engineIdentityId, 'eng-a');
		assert.strictEqual(root.workDir, '/a');
		assert.deepStrictEqual(seen, []);
	});

	test('a new link without an identity does not keep the previous engine', () => {
		const harness = createWorkRootHarness(store);
		harness.setSnapshot({ linkId: 1, engineIdentityId: 'eng-a', workDir: '/a' });
		harness.activeSessionId = 'a';
		harness.sessions = [{ id: 'a', title: 'A', turns: [] }];
		const context = harness.create();

		harness.setSnapshot({ linkId: 2, workDir: '/fresh' });
		harness.fireConnection();
		const root = context.getActiveWorkRoot();
		assert.strictEqual(root.engineIdentityId, undefined);
		assert.strictEqual(root.projectKey, undefined);
		assert.strictEqual(root.workDir, '/fresh');
	});

	test('a workspace folder that matches the workDir changes access', () => {
		const harness = createWorkRootHarness(store);
		harness.setSnapshot({ linkId: 1, engineIdentityId: 'eng', workDir: '/repo' });
		harness.activeSessionId = 'a';
		harness.sessions = [{ id: 'a', title: 'A', turns: [], workDir: '/repo' }];
		const context = harness.create();
		assert.strictEqual(context.getActiveWorkRoot().access, 'engine');
		const seen: string[] = [];
		store.add(context.onDidChangeActiveWorkRoot(root => seen.push(root.access)));

		harness.folders = [new WorkspaceFolder({ uri: URI.file('/repo'), name: 'repo', index: 0 })];
		harness.fireFolders();
		assert.strictEqual(context.getActiveWorkRoot().access, 'local');
		assert.deepStrictEqual(seen, ['local']);
	});

	test('an SCM root that matches the workDir changes access', () => {
		const harness = createWorkRootHarness(store);
		harness.setSnapshot({ linkId: 1, engineIdentityId: 'eng', workDir: '/a' });
		harness.activeSessionId = 'a';
		harness.sessions = [{ id: 'a', title: 'A', turns: [], workDir: '/a/b' }];
		harness.folders = [new WorkspaceFolder({ uri: URI.file('/a'), name: 'a', index: 0 })];
		const context = harness.create();
		assert.strictEqual(context.getActiveWorkRoot().access, 'engine');
		const seen: string[] = [];
		store.add(context.onDidChangeActiveWorkRoot(root => seen.push(root.access)));

		harness.repositoryRoots = [URI.file('/a/b')];
		harness.fireRepository();
		assert.strictEqual(context.getActiveWorkRoot().access, 'local');
		assert.strictEqual(context.getActiveWorkRoot().localRoot?.path, URI.file('/a/b').path);
		assert.deepStrictEqual(seen, ['local']);
	});
});

function emptyScmService(): ISCMService {
	return {
		_serviceBrand: undefined,
		onDidAddRepository: Event.None,
		onDidRemoveRepository: Event.None,
		repositories: [],
		repositoryCount: 0,
	} as unknown as ISCMService;
}

function createWorkRootHarness(store: { add: <T extends { dispose(): void }>(disposable: T) => T }): {
	sessions: ConversationStubSession[];
	activeSessionId: string;
	folders: IWorkspaceFolder[];
	repositoryRoots: URI[];
	setSnapshot(partial: Partial<UniverseAgentConnectionSnapshot>): void;
	fireConnection(): void;
	fireActiveSession(sessionId: string): void;
	fireFolders(): void;
	fireRepository(): void;
	create(): AgentSessionContext;
} {
	const capabilities = createEmptyTestCapabilitySnapshot();
	let snapshot: UniverseAgentConnectionSnapshot = {
		transport: 'idle',
		pairingPending: false,
		channelAlive: false,
		sharedFsRootSent: false,
		capabilities,
	};
	const connectionEmitter = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
	const activeEmitter = store.add(new Emitter<string>());
	const sessionEmitter = store.add(new Emitter<string>());
	const folderEmitter = store.add(new Emitter<IWorkspaceFoldersChangeEvent>());
	const repositoryEmitter = store.add(new Emitter<ISCMRepository>());
	const harness = {
		sessions: [] as ConversationStubSession[],
		activeSessionId: 'a',
		folders: [] as IWorkspaceFolder[],
		repositoryRoots: [] as URI[],
		setSnapshot(partial: Partial<UniverseAgentConnectionSnapshot>): void {
			snapshot = {
				transport: 'idle',
				pairingPending: false,
				channelAlive: false,
				sharedFsRootSent: false,
				capabilities,
				...partial,
			};
		},
		fireConnection(): void {
			connectionEmitter.fire(snapshot);
		},
		fireActiveSession(sessionId: string): void {
			harness.activeSessionId = sessionId;
			activeEmitter.fire(sessionId);
		},
		fireFolders(): void {
			folderEmitter.fire({ added: [], removed: [], changed: [] });
		},
		fireRepository(): void {
			repositoryEmitter.fire({} as ISCMRepository);
		},
		create(): AgentSessionContext {
			const roster = {
				_serviceBrand: undefined,
				getActiveSessionId: () => harness.activeSessionId,
				getSessions: () => harness.sessions,
				isEngineSessionReady: () => true,
				onDidChangeActiveSession: activeEmitter.event,
				onDidChangeSession: sessionEmitter.event,
				acquireSessionView: () => ({ dispose() { } }),
			} as unknown as IConversationRosterService;
			const connection = createConversationConnectionTestStub({
				getConnectionSnapshot: () => snapshot,
				onDidChangeConnection: connectionEmitter.event,
			});
			const workspace = {
				_serviceBrand: undefined,
				getWorkspace: () => ({ folders: harness.folders }),
				onDidChangeWorkspaceFolders: folderEmitter.event,
			} as unknown as IWorkspaceContextService;
			const instantiationService = workbenchInstantiationService(undefined, store);
			instantiationService.stub(IConversationRosterService, roster);
			instantiationService.stub(IUniverseAgentConnection, connection);
			instantiationService.stub(IWorkspaceContextService, workspace);
			instantiationService.stub(ISCMService, {
				_serviceBrand: undefined,
				onDidAddRepository: repositoryEmitter.event,
				onDidRemoveRepository: Event.None,
				get repositories() {
					return harness.repositoryRoots.map(rootUri => ({ provider: { rootUri } }));
				},
				repositoryCount: harness.repositoryRoots.length,
			} as unknown as ISCMService);
			return store.add(instantiationService.createInstance(AgentSessionContext));
		},
	};
	return harness;
}
