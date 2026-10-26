/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { IFileMutationRecord, ITurnSettleSignal, UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IWorkspaceContextService, IWorkspaceFoldersChangeEvent, Workspace, WorkspaceFolder } from '../../../../../platform/workspace/common/workspace.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import type { IAgentWorkRoot } from '../../../../services/agentSession/common/agentWorkRoot.js';
import { ISCMProvider, ISCMRepository, ISCMService } from '../../../scm/common/scm.js';
import { AgentSessionContext } from '../../browser/agentSessionContext.js';
import { ConversationReviewNavService } from '../../browser/conversationReviewNavService.js';
import type { ConversationStubSession } from '../../browser/conversationStubModel.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

interface IReviewNavTestOptions {
	readonly connectionWorkDir?: string;
	readonly sessionWorkDir?: string;
	readonly roots: readonly URI[];
	readonly hasScm?: boolean;
	/** Exercise the existing context-API fallback without a getWorkRoot method. */
	readonly legacyContext?: boolean;
	/** Match the production Context registration's delayed descriptor. */
	readonly delayedContext?: boolean;
	readonly workRoot?: IAgentWorkRoot;
}

/** Typed service inputs shared by ReviewNav and ReviewEntry public-contract tests. */
export class ConversationReviewNavTestHarness extends Disposable {

	readonly mutation = this._register(new Emitter<IFileMutationRecord>());
	readonly settle = this._register(new Emitter<ITurnSettleSignal>());
	readonly connectionChanged = this._register(new Emitter<UniverseAgentConnectionSnapshot>());
	readonly activeSessionChanged = this._register(new Emitter<string>());
	readonly sessionChanged = this._register(new Emitter<string>());
	readonly foldersChanged = this._register(new Emitter<IWorkspaceFoldersChangeEvent>());
	readonly repositoryAdded = this._register(new Emitter<ISCMRepository>());
	readonly repositoryRemoved = this._register(new Emitter<ISCMRepository>());

	readonly workspace = new Workspace('review-nav-test', [], false, null, () => false);
	readonly repositories: ISCMRepository[] = [];
	readonly sessions: ConversationStubSession[];
	activeSessionId = 'session-1';
	snapshot: UniverseAgentConnectionSnapshot;
	readonly session: IAgentSessionContext;
	readonly service: ConversationReviewNavService;

	constructor(options: IReviewNavTestOptions) {
		super();
		const harness = this;
		this.workspace.folders = options.roots.map((uri, index) => new WorkspaceFolder({ uri, name: `root-${index}`, index }));
		this.sessions = [{ id: 'session-1', title: 'Session 1', turns: [], workDir: options.sessionWorkDir }];
		this.snapshot = {
			transport: 'idle',
			linkId: 1,
			workDir: options.connectionWorkDir,
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		};
		if (options.hasScm !== false) {
			this.repositories.push(createRepository(options.roots[0] ?? URI.file('/review-nav-scm')));
		}
		const connection = createConversationConnectionTestStub({
			getConnectionSnapshot: () => this.snapshot,
			onDidFileMutation: this.mutation.event,
			onDidTurnSettle: this.settle.event,
			onDidChangeConnection: this.connectionChanged.event,
		});
		const roster = new class extends mock<IConversationRosterService>() {
			override getActiveSessionId = () => harness.activeSessionId;
			override getSessions = () => harness.sessions;
			override isEngineSessionReady = () => true;
			override readonly onDidChangeActiveSession = harness.activeSessionChanged.event;
			override readonly onDidChangeSession = harness.sessionChanged.event;
		}();
		const workspaceContext = new class extends mock<IWorkspaceContextService>() {
			override getWorkspace = () => harness.workspace;
			override readonly onDidChangeWorkspaceFolders = harness.foldersChanged.event;
		}();
		const scm = new class extends mock<ISCMService>() {
			override get repositories() { return harness.repositories; }
			override get repositoryCount() { return harness.repositories.length; }
			override readonly onDidAddRepository = harness.repositoryAdded.event;
			override readonly onDidRemoveRepository = harness.repositoryRemoved.event;
		}();
		if (options.delayedContext) {
			const instantiationService = this._register(new InstantiationService(new ServiceCollection(
				[IUniverseAgentConnection, connection],
				[IConversationRosterService, roster],
				[IWorkspaceContextService, workspaceContext],
				[ISCMService, scm],
				[IAgentSessionContext, new SyncDescriptor(AgentSessionContext, [], true)],
			), true));
			// ReviewNav must be the first consumer. Getting the delayed Context
			// first would register its connection listener before ReviewNav and
			// hide a constructor that subscribes too early. A later non-event
			// read instantiates Context only when ReviewNav did not, which then
			// leaves that listener second and the callback sees the old root.
			this.service = this._register(instantiationService.createInstance(ConversationReviewNavService));
			this.session = instantiationService.invokeFunction(accessor => accessor.get(IAgentSessionContext));
			this.session.getActiveSessionId();
			return;
		}
		if (options.legacyContext || options.workRoot) {
			const session = new class extends mock<IAgentSessionContext>() {
				override getActiveSessionId = () => harness.activeSessionId;
				override readonly onDidChangeActiveSession = harness.activeSessionChanged.event;
				override readonly onDidChangeSession = harness.sessionChanged.event;
			}();
			const root = options.workRoot;
			this.session = root ? Object.assign(session, { getWorkRoot: () => root }) : session;
		} else {
			// Cover the directly constructed Context as well as the delayed DI path.
			this.session = this._register(new AgentSessionContext(roster, connection, workspaceContext, scm));
		}
		this.service = this._register(new ConversationReviewNavService(connection, roster, workspaceContext, scm, this.session));
	}

	setWorkspaceRoots(roots: readonly URI[]): void {
		const removed = this.workspace.folders;
		const added = roots.map((uri, index) => new WorkspaceFolder({ uri, name: `root-${index}`, index }));
		this.workspace.folders = added;
		this.foldersChanged.fire({ added, removed, changed: [] });
	}

	addRepository(root: URI): ISCMRepository {
		const repository = createRepository(root);
		this.repositories.push(repository);
		this.repositoryAdded.fire(repository);
		return repository;
	}

	removeRepository(repository: ISCMRepository): void {
		this.repositories.splice(this.repositories.indexOf(repository), 1);
		this.repositoryRemoved.fire(repository);
	}
}

function createRepository(rootUri: URI): ISCMRepository {
	return new class extends mock<ISCMRepository>() {
		override readonly provider = new class extends mock<ISCMProvider>() {
			override readonly rootUri = rootUri;
		}();
	}();
}
