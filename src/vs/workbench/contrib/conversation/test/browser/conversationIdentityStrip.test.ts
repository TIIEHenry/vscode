/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ConnectionPhase } from '../../../../../platform/universeAgent/common/connectionHubTypes.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot, UniverseAgentReadGitSummaryResult } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService, toWorkspaceFolder, type IWorkspaceFoldersChangeEvent } from '../../../../../platform/workspace/common/workspace.js';
import { URI } from '../../../../../base/common/uri.js';
import { TestWorkspace, Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { ConversationPart, IConversationLensSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMRepository, ISCMService } from '../../../scm/common/scm.js';
import { TestContextService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { AgentSessionContext } from '../../browser/agentSessionContext.js';
import type { IAgentWorkRoot } from '../../../../services/agentSession/common/agentWorkRoot.js';

import { ConversationLens } from '../../browser/conversationLens.js';
import { stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';
import { ConversationTimelineHost } from '../../browser/conversationTimelineHost.js';
import {
	conversationIdentityBranchChipClass,
	conversationIdentityBranchReadOnlyClass,
	conversationIdentityEngineChipClass,
	conversationIdentityEngineOfflineClass,
	conversationIdentityFolderChipClass,
	conversationIdentityAddFolderClass,
	conversationIdentityFolderReadOnlyClass,
	conversationIdentityStripClass,
	getConversationIdentityBranchName,
} from '../../browser/conversationIdentityStrip.js';
import { getConnectionPhaseStatusBarText } from '../../browser/conversationSessionStatus.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import {
	conversationLensPhasePreFirstClass,
	conversationLensPrefirstHeroClass,
} from '../../browser/conversationLensDockStrings.js';
import { CONNECTION_PROFILES_ZONE, OPEN_CONNECTION_PREFERENCES_COMMAND_ID, OPEN_ENGINE_PREFERENCES_COMMAND_ID } from '../../common/uaPreferencesPanes.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';
import { flushConversationLensLayout, installConversationLensResizeObserverHarness } from './conversationLensLayoutHarness.js';
import { getWindow } from '../../../../../base/browser/dom.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ActionListItemKind, IActionListDelegate, IActionListItem, IActionListOptions } from '../../../../../platform/actionWidget/browser/actionList.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IWorkspacesService, IRecentlyOpened, IWorkspaceFolderCreationData } from '../../../../../platform/workspaces/common/workspaces.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IWorkspaceEditingService } from '../../../../services/workspaces/common/workspaceEditing.js';
import { IConversationWorkRootMount, type IWorkRootMountOffer } from '../../browser/conversationWorkRootMount.js';
import { TestHostService, TestWorkspacesService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';

declare function __readFileInTests(path: string): Promise<string>;

const LENS_LAYOUT_WIDTH = 640;
const LENS_LAYOUT_HEIGHT = 480;

interface IRecordedMenuShow {
	readonly user: string;
	readonly items: readonly IActionListItem<unknown>[];
	readonly delegate: IActionListDelegate<unknown>;
	readonly anchor: unknown;
	readonly listOptions?: IActionListOptions;
}

class RecordingActionWidget {
	declare readonly _serviceBrand: undefined;
	private _visible = false;
	readonly shows: IRecordedMenuShow[] = [];

	get isVisible(): boolean {
		return this._visible;
	}

	show(user: string, _supportsPreview: boolean, items: readonly IActionListItem<unknown>[], delegate: IActionListDelegate<unknown>, anchor: unknown, _container?: unknown, _actionBarActions?: unknown, _accessibilityProvider?: unknown, listOptions?: IActionListOptions): void {
		this._visible = true;
		this.shows.push({ user, items, delegate, anchor, listOptions });
	}

	updateItems(): void { }

	focusItemById(): void { }

	hide(didCancel?: boolean): void {
		this._visible = false;
		this.shows.at(-1)?.delegate.onHide(didCancel);
	}
}

async function assertWarnThenRethrowDoesNotLeak(paintBoom: Error, run: () => void | Promise<void>): Promise<void> {
	// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
	const unexpectedWarns: unknown[] = [];
	const unhandledRejections: unknown[] = [];
	const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
	process.on('unhandledRejection', onUnhandledRejection);
	const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
	setUnexpectedErrorHandler(error => {
		unexpectedWarns.push(error);
		if (unexpectedWarns.length === 1) {
			throw error;
		}
	});
	try {
		await run();
		await timeout(0);
		assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
			unhandledRejections: [],
			unexpectedWarns: [paintBoom, paintBoom],
		});
	} finally {
		setUnexpectedErrorHandler(originalErrorHandler);
		process.off('unhandledRejection', onUnhandledRejection);
	}
}

suite('ConversationIdentityStrip', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	installConversationLensResizeObserverHarness();

	teardown(async () => {
		await flushConversationLensLayout();
	});

	function layoutReadingColumn(lens: ConversationLens, slots: IConversationLensSlots): void {
		const readingColumn = slots.timeline.querySelector('.conversation-lens-reading-column') as HTMLElement | null;
		const timelineScroll = slots.timeline.querySelector('.conversation-lens-timeline-scroll') as HTMLElement | null;
		const contentHost = slots.timeline.querySelector('.conversation-lens-timeline-content') as HTMLElement | null;
		const treeContainer = (slots.timeline.querySelector('.conversation-timeline-stream') ?? slots.timeline.querySelector('.conversation-timeline-tree')) as HTMLElement | null;
		if (readingColumn) {
			readingColumn.style.width = `${LENS_LAYOUT_WIDTH}px`;
			readingColumn.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		}
		if (timelineScroll) {
			timelineScroll.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
			timelineScroll.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		if (contentHost) {
			contentHost.style.display = '';
			contentHost.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		if (treeContainer) {
			treeContainer.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		const timelineTree = (lens as unknown as { timelineTree: ConversationTimelineHost }).timelineTree;
		timelineTree.layout(LENS_LAYOUT_HEIGHT - 120, LENS_LAYOUT_WIDTH);
	}

	function createConnectionStub(overrides: Partial<IUniverseAgentConnection> = {}): IUniverseAgentConnection {
		return createConversationConnectionTestStub(overrides);
	}

	function createEmptyScmService(): ISCMService {
		return {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function createScmRepository(
		branchName: string | undefined,
		rootUri: URI,
		id = 'git',
		provideHistoryItemRefs: () => Promise<readonly { id: string; name: string }[]> = async () => [],
		branchUpdates: Event<string> = Event.None,
	): ISCMRepository {
		const historyItemRef = observableValue<{ id: string; name: string } | undefined>(
			'historyItemRef',
			branchName ? { id: 'HEAD', name: branchName } : undefined,
		);
		store.add(branchUpdates(name => historyItemRef.set({ id: 'HEAD', name }, undefined)));
		const historyProvider = {
			historyItemRef,
			historyItemRemoteRef: observableValue('remote', undefined),
			historyItemBaseRef: observableValue('base', undefined),
			historyItemRefChanges: observableValue('changes', { added: [], removed: [], modified: [], silent: true }),
			provideHistoryItemRefs,
		};
		const provider = {
			id,
			providerId: 'git',
			label: 'Git',
			name: 'Git',
			rootUri,
			groups: [],
			onDidChangeResourceGroups: Event.None,
			onDidChangeResources: Event.None,
			historyProvider: observableValue('historyProvider', historyProvider),
			dispose: () => { },
		};
		return { id, provider, dispose: () => { } } as unknown as ISCMRepository;
	}

	function createScmServiceWithRepositories(repositories: readonly ISCMRepository[]): ISCMService {
		return {
			_serviceBrand: undefined,
			get repositories() { return repositories; },
			get repositoryCount() { return repositories.length; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => repositories[0],
		} as unknown as ISCMService;
	}

	function createScmServiceWithBranch(branchName: string, rootUri: URI = TestWorkspace.folders[0].uri): ISCMService {
		return createScmServiceWithRepositories([createScmRepository(branchName, rootUri)]);
	}

	function mountLens(options?: {
		workspaceContextService?: IWorkspaceContextService;
		scmService?: ISCMService;
		commandService?: ICommandService;
		stubService?: ConversationStubService;
		sessionKey?: string;
		connection?: IUniverseAgentConnection;
		connectionOverrides?: Partial<IUniverseAgentConnection>;
		sessionContext?: IAgentSessionContext;
		addFolders?: (folders: IWorkspaceFolderCreationData[]) => Promise<void>;
		workRootMount?: IConversationWorkRootMount;
	}): { part: ConversationPart; slots: IConversationLensSlots; commandService: ICommandService; stubService: ConversationStubService; lens: ConversationLens; workbench: HTMLElement; actionWidget: RecordingActionWidget; host: TestHostService; workspaces: TestWorkspacesService; addedFolders: IWorkspaceFolderCreationData[][]; executedCommands: { id: string; args: unknown[] }[] } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const actionWidget = new RecordingActionWidget();
		instantiationService.stub(IActionWidgetService, actionWidget as unknown as IActionWidgetService);
		const storageService = store.add(new TestStorageService());
		instantiationService.stub(IStorageService, storageService);
		const stubService = options?.stubService ?? store.add(new ConversationStubService());
		const clipboardService = new TestClipboardService();
		const executedCommands: { id: string; args: unknown[] }[] = [];
		const commandService = options?.commandService ?? new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			readonly executed: string[] = [];
			readonly executedArgs: unknown[][] = [];
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string, ...args: unknown[]): Promise<T | undefined> {
				executedCommands.push({ id, args });
				this.executed.push(id);
				this.executedArgs.push(args);
				return Promise.resolve(undefined);
			}
		}();
		const explorerService = {
			_serviceBrand: undefined,
			select: async () => { },
		} as unknown as IExplorerService;

		instantiationService.stub(IConversationRosterService, stubService);
		stubConversationTimelineLinkServices(instantiationService);
		instantiationService.stub(IUniverseAgentConnection, options?.connection ?? createConnectionStub(options?.connectionOverrides));
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => { },
		});
		instantiationService.stub(IConversationReviewNavService, {
			_serviceBrand: undefined,
			onDidChange: Event.None,
			getReviewNavForSession: () => [],
		});
		instantiationService.stub(IClipboardService, clipboardService);
		instantiationService.stub(ICommandService, commandService);
		instantiationService.stub(IExplorerService, explorerService);
		instantiationService.stub(ISCMService, options?.scmService ?? createEmptyScmService());
		if (options?.workspaceContextService) {
			instantiationService.stub(IWorkspaceContextService, options.workspaceContextService);
		}
		if (options?.sessionContext) {
			instantiationService.stub(IAgentSessionContext, options.sessionContext);
		}
		const addedFolders: IWorkspaceFolderCreationData[][] = [];
		instantiationService.stub(IWorkspaceEditingService, {
			_serviceBrand: undefined,
			addFolders: async (folders: IWorkspaceFolderCreationData[]) => {
				addedFolders.push(folders);
				await options?.addFolders?.(folders);
			},
		} as unknown as IWorkspaceEditingService);
		instantiationService.stub(IConversationWorkRootMount, options?.workRootMount ?? {
			_serviceBrand: undefined,
			onDidChangeOffer: Event.None,
			getOffer: () => undefined,
			setOffer: () => { },
			acceptOffer: async () => { },
		});

		const part = store.add(instantiationService.createInstance(ConversationPart));
		const workbenchRoot = document.createElement('div');
		workbenchRoot.classList.add('monaco-workbench');
		const parent = document.createElement('div');
		parent.classList.add('part', 'conversation');
		parent.style.width = `${LENS_LAYOUT_WIDTH}px`;
		parent.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		workbenchRoot.appendChild(parent);
		document.body.appendChild(workbenchRoot);
		store.add(toDisposable(() => workbenchRoot.remove()));
		part.create(parent);
		const partSlots = part.getSlots();
		assert.ok(partSlots);
		const slots: IConversationLensSlots = {
			sessionKey: options?.sessionKey,
			sessionBar: partSlots.sessionBar,
			timeline: document.createElement('div'),
			dock: document.createElement('div'),
		};
		slots.timeline.classList.add('conversation-timeline', 'part', 'conversation');
		slots.dock.classList.add('conversation-dock');
		parent.appendChild(slots.timeline);
		parent.appendChild(slots.dock);
		part.layout(LENS_LAYOUT_WIDTH, LENS_LAYOUT_HEIGHT, 0, 0);
		const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
		layoutReadingColumn(lens, slots);

		return {
			part,
			slots,
			commandService,
			stubService,
			lens,
			workbench: parent,
			actionWidget,
			host: instantiationService.get(IHostService) as TestHostService,
			workspaces: instantiationService.get(IWorkspacesService) as TestWorkspacesService,
			addedFolders,
			executedCommands,
		};
	}

	function workRootHarness(paths: readonly (string | undefined)[], scmService: ISCMService, workspaceContextService: IWorkspaceContextService = new TestContextService()) {
		const stubService = store.add(new ConversationStubService());
		const sessionIds = paths.map((path, index) => {
			const id = index === 0 ? stubService.getActiveSessionId() : stubService.createSession();
			stubService.getSessions().find(session => session.id === id)!.workDir = path;
			return id;
		});
		stubService.switchSession(sessionIds[0]);
		const changes = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		let snapshot: UniverseAgentConnectionSnapshot = {
			...createConnectionStub().getConnectionSnapshot(), engineIdentityId: 'identity-engine', linkId: 1,
		};
		const summaries: { sessionId: string; resolve: (result: UniverseAgentReadGitSummaryResult) => void; reject: (error: Error) => void }[] = [];
		const connection = createConnectionStub({
			getConnectionSnapshot: () => snapshot,
			onDidChangeConnection: changes.event,
			readGitSummary: request => new Promise((resolve, reject) => summaries.push({ sessionId: request.sessionId, resolve, reject })),
		});
		const sessionContext = store.add(new AgentSessionContext(stubService, connection, workspaceContextService, scmService));
		return {
			sessionIds, summaries, stubService, sessionContext, connection, workspaceContextService, scmService,
			setWorkDir(sessionId: string, workDir: string | undefined) {
				const session = stubService.getSessions().find(candidate => candidate.id === sessionId)!;
				session.workDir = workDir;
				stubService.renameSession(sessionId, `${session.title}!`);
			},
			setConnection(change: Partial<UniverseAgentConnectionSnapshot>) {
				snapshot = { ...snapshot, ...change };
				changes.fire(snapshot);
			},
		};
	}

	function menuActions(show: IRecordedMenuShow): IActionListItem<unknown>[] {
		return show.items.filter(item => item.kind === ActionListItemKind.Action);
	}

	function getReadingColumn(slots: IConversationLensSlots): HTMLElement {
		const column = slots.timeline.querySelector('.conversation-lens-reading-column');
		assert.ok(column);
		return column as HTMLElement;
	}

	function getIdentityStrip(slots: IConversationLensSlots): HTMLElement {
		const strip = getReadingColumn(slots).querySelector(`.${conversationIdentityStripClass}`);
		assert.ok(strip);
		return strip as HTMLElement;
	}

	test('identity strip mounts in reading column before timeline scroll when Active', () => {
		const { slots } = mountLens();
		const readingColumn = getReadingColumn(slots);
		const children = [...readingColumn.children];

		assert.strictEqual(children[0]?.classList.contains(conversationIdentityStripClass), true);
		assert.ok(readingColumn.querySelector('.conversation-lens-timeline'));
		assert.ok(getIdentityStrip(slots).compareDocumentPosition(getReadingColumn(slots).querySelector('.conversation-lens-timeline-scroll')!) & Node.DOCUMENT_POSITION_FOLLOWING);
	});

	test('PreFirst: identity strip mounts in prefirst hero above composer, not at column top', () => {
		const { slots, stubService, lens } = mountLens();
		const emptySessionId = stubService.createSession();
		assert.strictEqual(stubService.getTurns(emptySessionId).length, 0);
		layoutReadingColumn(lens, slots);

		const readingColumn = getReadingColumn(slots);
		const prefirstHero = readingColumn.querySelector(`.${conversationLensPrefirstHeroClass}`) as HTMLElement | null;
		assert.ok(prefirstHero);
		assert.ok(!prefirstHero.hidden);
		assert.strictEqual(readingColumn.classList.contains(conversationLensPhasePreFirstClass), true);
		assert.strictEqual(readingColumn.firstElementChild?.classList.contains(conversationIdentityStripClass), false);
		assert.strictEqual(prefirstHero.querySelector(`.${conversationIdentityStripClass}`), getIdentityStrip(slots));
		assert.ok(prefirstHero.querySelector('.conversation-lens-composer'));
	});

	test('identity strip is absent from SessionBar and dock', () => {
		const { slots } = mountLens();

		assert.strictEqual(slots.sessionBar!.querySelector(`.${conversationIdentityStripClass}`), null);
		assert.strictEqual(slots.dock.querySelector(`.${conversationIdentityStripClass}`), null);
		assert.strictEqual(slots.sessionBar!.querySelector(`.${conversationIdentityEngineChipClass}`), null);
		assert.strictEqual(slots.dock.querySelector(`.${conversationIdentityEngineChipClass}`), null);
	});

	test('engine chip shows disconnected copy and opens Connection preferences', async () => {
		const { slots, commandService } = mountLens();
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.ok(engineChip);
		assert.strictEqual(engineChip.textContent, getConnectionPhaseStatusBarText({ kind: 'disconnected' }));
		assert.strictEqual(engineChip.textContent, 'Engine not connected');
		assert.strictEqual(engineChip.classList.contains(conversationIdentityEngineOfflineClass), true);
		assert.ok(engineChip.querySelector('.conversation-identity-chip-open'));

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[CONNECTION_PROFILES_ZONE]]);
	});

	test('engine chip stays the hit target when session bar / split-view chrome overlaps it', async () => {
		const { slots, commandService, workbench } = mountLens();
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;
		assert.ok(engineChip);
		if (engineChip.getBoundingClientRect().width === 0) {
			engineChip.style.display = 'inline-block';
			engineChip.style.width = '96px';
			engineChip.style.height = '24px';
		}

		const rect = engineChip.getBoundingClientRect();
		const overlay = document.createElement('div');
		overlay.className = 'conversation-session-bar monaco-split-view2';
		overlay.style.position = 'fixed';
		overlay.style.left = `${rect.left}px`;
		overlay.style.top = `${rect.top}px`;
		overlay.style.width = `${Math.max(rect.width, 8)}px`;
		overlay.style.height = `${Math.max(rect.height, 8)}px`;
		overlay.style.zIndex = '5';
		const sashContainer = document.createElement('div');
		sashContainer.className = 'sash-container';
		sashContainer.style.position = 'absolute';
		sashContainer.style.inset = '0';
		overlay.appendChild(sashContainer);
		workbench.appendChild(overlay);
		store.add(toDisposable(() => overlay.remove()));

		assert.strictEqual(getWindow(overlay).getComputedStyle(overlay).pointerEvents, 'none');
		assert.strictEqual(getWindow(engineChip).getComputedStyle(engineChip).pointerEvents, 'auto');

		const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
		assert.ok(hit === engineChip || engineChip.contains(hit), `expected engine chip under overlay, hit ${hit?.className ?? 'null'}`);

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
	});

	test('engine chip opens Connection when roster is connected but phase is not', async () => {
		const stubService = store.add(new ConversationStubService());
		stubService.setEngineConnected(true);

		const { slots, commandService } = mountLens({
			stubService,
			connectionOverrides: {
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'disconnected' }),
			},
		});
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;
		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[CONNECTION_PROFILES_ZONE]]);
	});

	test('engine chip shows connected copy and opens Engine preferences', async () => {
		const stubService = store.add(new ConversationStubService());
		stubService.setEngineConnected(true);

		const { slots, commandService } = mountLens({
			stubService,
			connectionOverrides: {
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'hubRelay' }),
			},
		});
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.ok(engineChip);
		assert.strictEqual(engineChip.textContent, getConnectionPhaseStatusBarText({ kind: 'connected', path: 'hubRelay' }));
		assert.strictEqual(engineChip.textContent, 'Engine · Hub relay');
		assert.strictEqual(engineChip.classList.contains(conversationIdentityEngineOfflineClass), false);
		assert.ok(engineChip.matches(`.${conversationIdentityEngineChipClass}:not(.${conversationIdentityEngineOfflineClass}):not(.conversation-identity-chip-engine--failed)`));

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_ENGINE_PREFERENCES_COMMAND_ID]);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[]]);
	});

	test('engine chip opens Connection while pairingPending even if phase is connected', async () => {
		const stubService = store.add(new ConversationStubService());
		stubService.setEngineConnected(true);

		const { slots, commandService } = mountLens({
			stubService,
			connectionOverrides: {
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
				getConnectionSnapshot: () => ({
					transport: 'ok',
					pairingPending: true,
					channelAlive: true,
					sharedFsRootSent: false,
					capabilities: createEmptyTestCapabilitySnapshot(),
				}),
			},
		});
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.ok(engineChip);
		assert.strictEqual(engineChip.textContent, getConnectionPhaseStatusBarText({ kind: 'connected', path: 'direct' }, true));
		assert.strictEqual(engineChip.textContent, 'Waiting for pairing');

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[]]);
	});

	test('engine chip updates when connection phase changes', () => {
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();
		let phase: ConnectionPhase = { kind: 'disconnected' };

		const { slots } = mountLens({
			connectionOverrides: {
				onDidChangeConnection: onDidChangeConnection.event,
				getConnectionPhase: () => phase,
			},
		});
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.strictEqual(engineChip.textContent, 'Engine not connected');
		assert.strictEqual(engineChip.classList.contains(conversationIdentityEngineOfflineClass), true);

		phase = { kind: 'connecting', reason: 'initial' };
		onDidChangeConnection.fire({
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		assert.strictEqual(engineChip.textContent, 'Connecting…');
		assert.strictEqual(engineChip.classList.contains(conversationIdentityEngineOfflineClass), false);
	});

	test('folder chip is hidden for empty workspace', () => {
		const emptyWorkspace = new TestContextService(new Workspace('empty-workspace', []));
		const { slots } = mountLens({ workspaceContextService: emptyWorkspace });
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;

		assert.ok(folderChip);
		assert.strictEqual(folderChip.hidden, true);
	});

	test('branch chip is hidden when SCM has no HEAD', () => {
		const { slots } = mountLens();
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement;

		assert.ok(branchChip);
		assert.strictEqual(branchChip.hidden, true);
		assert.strictEqual(getConversationIdentityBranchName(createEmptyScmService()), undefined);
	});

	test('branch chip shows SCM HEAD when available', () => {
		const { slots } = mountLens({ scmService: createScmServiceWithBranch('loop/B') });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement;

		assert.ok(branchChip);
		assert.strictEqual(branchChip.hidden, false);
		assert.strictEqual(branchChip.textContent, 'loop/B');
	});

	test('branch stays hidden when folders[0] has no HEAD and another repo does', () => {
		const folderUri = TestWorkspace.folders[0].uri;
		const scm = createScmServiceWithRepositories([
			createScmRepository(undefined, folderUri, 'folder'),
			createScmRepository('other-branch', URI.file('/other-repo'), 'other'),
		]);
		assert.strictEqual(getConversationIdentityBranchName(scm, folderUri), undefined);

		const { slots } = mountLens({ scmService: scm });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement;
		assert.strictEqual(branchChip.hidden, true);
	});

	test('branch chip uses the folders[0] repository HEAD', () => {
		const folderUri = TestWorkspace.folders[0].uri;
		const scm = createScmServiceWithRepositories([
			createScmRepository('folder-branch', folderUri, 'folder'),
			createScmRepository('other-branch', URI.file('/other-repo'), 'other'),
		]);
		assert.strictEqual(getConversationIdentityBranchName(scm, folderUri), 'folder-branch');
		assert.strictEqual(getConversationIdentityBranchName(scm), undefined);

		const { slots } = mountLens({ scmService: scm });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement;
		assert.strictEqual(branchChip.hidden, false);
		assert.strictEqual(branchChip.textContent, 'folder-branch');
	});

	test('identity strip copy does not mention Copilot or Open Chat', () => {
		const { slots } = mountLens({ scmService: createScmServiceWithBranch('main') });
		const text = getIdentityStrip(slots).textContent ?? '';

		assert.ok(!/copilot/i.test(text));
		assert.ok(!/open chat/i.test(text));
	});

	test('does not leak unhandled rejection when engine chip executeCommand rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('engine chip boom');
		const executed: string[] = [];
		const commandService = new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string): Promise<T | undefined> {
				executed.push(id);
				return Promise.reject(paintBoom);
			}
		}();
		const { slots } = mountLens({ commandService });
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;
			engineChip.click();
		});
		assert.deepStrictEqual(executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
	});

	test('folder chip lists workspace folders and adds a recent folder instead of reopening the window', async () => {
		const folderUri = TestWorkspace.folders[0].uri;
		const localUri = URI.file('/local-project');
		const otherUri = URI.file('/other-project');
		const opened: { toOpen: unknown; options: unknown }[] = [];
		const { slots, commandService, actionWidget, host, workspaces, addedFolders } = mountLens();
		host.openWindow = async (toOpen, options) => {
			opened.push({ toOpen, options });
		};
		workspaces.getRecentlyOpened = async () => ({
			files: [],
			workspaces: [
				{ folderUri, label: 'current-dup' },
				{ folderUri: localUri, label: 'Local' },
				{ folderUri: otherUri, label: 'Other', remoteAuthority: 'ssh-remote+dev' },
				{ workspace: { id: 'multi', configPath: URI.file('/multi.code-workspace') } },
			],
		});
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.strictEqual(folderChip.tagName, 'BUTTON');
		assert.strictEqual(folderChip.getAttribute('aria-haspopup'), 'listbox');
		assert.strictEqual(folderChip.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(folderChip.getAttribute('aria-label'), 'Session folder: testWorkspace. Add a folder to the workspace.');
		assert.ok(folderChip.querySelector('.codicon-chevron-down'));
		assert.ok(engineChip.querySelector('.codicon-chevron-down'));
		assert.strictEqual(engineChip.querySelector('.codicon-chevron-right'), null);
		assert.strictEqual(folderChip.textContent, 'testWorkspace');

		folderChip.click();
		await timeout(0);

		assert.strictEqual(actionWidget.shows.length, 1);
		assert.strictEqual(actionWidget.shows[0].user, 'conversationIdentityFolder');
		assert.strictEqual(actionWidget.shows[0].anchor, folderChip);
		assert.deepStrictEqual(actionWidget.shows[0].listOptions, {
			showFilter: true,
			filterPlaceholder: 'Search folders...',
			filterEmptyMessage: 'No matching folders.',
			minWidth: 280,
		});
		assert.strictEqual(folderChip.getAttribute('aria-expanded'), 'true');
		const headers = actionWidget.shows[0].items.filter(item => item.kind === ActionListItemKind.Header).map(item => item.label);
		assert.deepStrictEqual(headers, ['Workspace', 'Recents']);
		const actions = menuActions(actionWidget.shows[0]);
		assert.deepStrictEqual(actions.map(item => item.label), ['testWorkspace', 'Local', 'Other', 'Add Folder to Workspace…']);
		assert.strictEqual(actions[0].group?.icon, Codicon.check);
		assert.strictEqual(actions[1].group?.icon, Codicon.folder);
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, []);

		actionWidget.shows[0].delegate.onSelect(actions[0].item);
		assert.deepStrictEqual(opened, []);
		assert.strictEqual(addedFolders.length, 0);
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, []);

		folderChip.click();
		await timeout(0);
		actionWidget.shows.at(-1)!.delegate.onSelect(menuActions(actionWidget.shows.at(-1)!).find(item => item.label === 'Local')!.item);
		await timeout(0);
		assert.deepStrictEqual(addedFolders.map(folders => folders.map(folder => folder.uri.toString())), [[localUri.toString()]]);
		assert.deepStrictEqual(opened, []);

		folderChip.click();
		await timeout(0);
		actionWidget.shows.at(-1)!.delegate.onSelect(menuActions(actionWidget.shows.at(-1)!).find(item => item.label === 'Other')!.item);
		assert.deepStrictEqual(opened, [{
			toOpen: [{ folderUri: otherUri }],
			options: { forceNewWindow: true, remoteAuthority: 'ssh-remote+dev' },
		}]);
		assert.strictEqual(addedFolders.length, 1);

		folderChip.click();
		await timeout(0);
		actionWidget.shows.at(-1)!.delegate.onSelect(menuActions(actionWidget.shows.at(-1)!).find(item => item.label === 'Add Folder to Workspace…')!.item);
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, ['addRootFolder']);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[]]);
	});

	test('folder chip click toggles the open menu and cancels a menu that is still loading', async () => {
		const { slots, actionWidget, workspaces } = mountLens();
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;

		folderChip.click();
		await timeout(0);
		assert.strictEqual(actionWidget.isVisible, true);
		folderChip.click();
		assert.strictEqual(actionWidget.shows.length, 1);
		assert.strictEqual(actionWidget.isVisible, false);
		assert.strictEqual(folderChip.getAttribute('aria-expanded'), 'false');

		let resolveOpened!: (value: IRecentlyOpened) => void;
		workspaces.getRecentlyOpened = () => new Promise(resolve => { resolveOpened = resolve; });
		folderChip.click();
		assert.strictEqual(actionWidget.shows.length, 1);
		folderChip.click();
		resolveOpened({ files: [], workspaces: [] });
		await timeout(0);
		assert.strictEqual(actionWidget.shows.length, 1);
	});

	test('folder menu still opens when recent folders fail to load', async () => {
		const { slots, actionWidget, workspaces } = mountLens();
		workspaces.getRecentlyOpened = async () => { throw new Error('recents down'); };
		const leaks: unknown[] = [];
		const onLeak = (reason: unknown) => leaks.push(reason);
		process.on('unhandledRejection', onLeak);
		try {
			const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
			folderChip.click();
			await timeout(0);
			assert.deepStrictEqual(leaks, []);
			assert.deepStrictEqual(menuActions(actionWidget.shows[0]).map(item => item.label), ['testWorkspace', 'Add Folder to Workspace…']);
		} finally {
			process.off('unhandledRejection', onLeak);
		}
	});

	test('branch chip opens a searchable local-branch menu and checks out through git.checkout', async () => {
		const folderUri = TestWorkspace.folders[0].uri;
		const scm = createScmServiceWithRepositories([createScmRepository('edit', folderUri, 'git', async () => [
			{ id: 'refs/heads/edit', name: 'edit' },
			{ id: 'refs/heads/main', name: 'main' },
			{ id: 'refs/heads/backup/pre-rebase-1fd2e162', name: 'backup/pre-rebase-1fd2e162' },
			{ id: 'refs/tags/v1', name: 'v1' },
			{ id: 'refs/remotes/origin/main', name: 'origin/main' },
			{ id: 'refs/heads/edit', name: 'edit' },
		])]);
		const { slots, commandService, actionWidget } = mountLens({ scmService: scm });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;

		assert.strictEqual(branchChip.tagName, 'BUTTON');
		assert.strictEqual(branchChip.getAttribute('aria-haspopup'), 'listbox');
		assert.strictEqual(branchChip.getAttribute('role'), null);
		assert.ok(branchChip.querySelector('.codicon-chevron-down'));
		assert.strictEqual(branchChip.textContent, 'edit');

		branchChip.click();
		await timeout(0);

		assert.strictEqual(actionWidget.shows.length, 1);
		assert.strictEqual(actionWidget.shows[0].user, 'conversationIdentityBranch');
		assert.strictEqual(actionWidget.shows[0].anchor, branchChip);
		assert.deepStrictEqual(actionWidget.shows[0].listOptions, {
			showFilter: true,
			filterPlaceholder: 'Search branches...',
			filterEmptyMessage: 'No matching branches.',
			minWidth: 280,
		});
		const actions = menuActions(actionWidget.shows[0]);
		assert.deepStrictEqual(actions.map(item => item.label), ['edit', 'backup/pre-rebase-1fd2e162', 'main']);
		assert.strictEqual(actions[0].group?.icon, Codicon.check);
		assert.strictEqual(actions[1].group?.icon, Codicon.gitBranch);

		actionWidget.shows[0].delegate.onSelect('edit');
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, []);

		branchChip.click();
		await timeout(0);
		actionWidget.shows.at(-1)!.delegate.onSelect('main');
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, ['git.checkout']);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[folderUri, 'main']]);
	});

	test('branch menu keeps the current branch when history refs fail', async () => {
		const scm = createScmServiceWithBranch('edit');
		const repository = [...scm.repositories][0];
		const historyProvider = repository.provider.historyProvider.get() as { provideHistoryItemRefs: () => Promise<unknown> };
		historyProvider.provideHistoryItemRefs = async () => { throw new Error('refs down'); };
		const { slots, actionWidget } = mountLens({ scmService: scm });
		const leaks: unknown[] = [];
		const onLeak = (reason: unknown) => leaks.push(reason);
		process.on('unhandledRejection', onLeak);
		try {
			const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
			branchChip.click();
			await timeout(0);
			assert.deepStrictEqual(leaks, []);
			assert.deepStrictEqual(menuActions(actionWidget.shows[0]).map(item => item.label), ['edit']);
		} finally {
			process.off('unhandledRejection', onLeak);
		}
	});

	test('does not leak unhandled rejection when Add Folder to Workspace rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('folder chip boom');
		const executed: string[] = [];
		const commandService = new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string): Promise<T | undefined> {
				executed.push(id);
				return Promise.reject(paintBoom);
			}
		}();
		const { slots, actionWidget } = mountLens({ commandService });
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		folderChip.click();
		await timeout(0);
		const browse = menuActions(actionWidget.shows[0]).find(item => item.label === 'Add Folder to Workspace…');
		assert.ok(browse);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			actionWidget.shows[0].delegate.onSelect(browse.item);
		});
		assert.deepStrictEqual(executed, ['addRootFolder']);
	});

	test('does not leak unhandled rejection when branch checkout rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('checkout boom');
		const executed: string[] = [];
		const commandService = new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string): Promise<T | undefined> {
				executed.push(id);
				return Promise.reject(paintBoom);
			}
		}();
		const scm = createScmServiceWithRepositories([createScmRepository('edit', TestWorkspace.folders[0].uri, 'git', async () => [
			{ id: 'refs/heads/main', name: 'main' },
		])]);
		const { slots, actionWidget } = mountLens({ commandService, scmService: scm });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
		branchChip.click();
		await timeout(0);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			actionWidget.shows[0].delegate.onSelect('main');
		});
		assert.deepStrictEqual(executed, ['git.checkout']);
	});

	test('does not leak unhandled rejection when adding a folder rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('add folder boom');
		const otherUri = URI.file('/other-project');
		const { slots, actionWidget, workspaces } = mountLens({ addFolders: async () => { throw paintBoom; } });
		workspaces.getRecentlyOpened = async () => ({
			files: [],
			workspaces: [{ folderUri: otherUri, label: 'Other' }],
		});
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		folderChip.click();
		await timeout(0);
		const other = menuActions(actionWidget.shows[0]).find(item => item.label === 'Other');
		assert.ok(other);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			actionWidget.shows[0].delegate.onSelect(other.item);
		});
	});

	test('does not leak unhandled rejection when opening a folder from another remote rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('open window boom');
		const otherUri = URI.file('/other-project');
		const { slots, actionWidget, host, workspaces } = mountLens();
		workspaces.getRecentlyOpened = async () => ({
			files: [],
			workspaces: [{ folderUri: otherUri, label: 'Other', remoteAuthority: 'ssh-remote+dev' }],
		});
		host.openWindow = async () => { throw paintBoom; };
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		folderChip.click();
		await timeout(0);
		const other = menuActions(actionWidget.shows[0]).find(item => item.label === 'Other');
		assert.ok(other);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			actionWidget.shows[0].delegate.onSelect(other.item);
		});
	});

	test('identity strip menu commands double-catch onUnexpectedError', async () => {
		const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationIdentityStrip.ts`);
		assert.ok(source.includes(`void this.commandService.executeCommand(getEngineStatusCommandId(`));
		assert.ok(source.includes(`)).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(source.includes(`void this.commandService.executeCommand(ADD_ROOT_FOLDER_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(source.includes('void this.workspaceEditingService.addFolders([{ uri: folder.folderUri }]).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(!source.includes('forceReuseWindow'));
		assert.ok(source.includes(`void this.commandService.executeCommand(GIT_CHECKOUT_COMMAND_ID, folderUri, name).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(source.includes('void this.hostService.openWindow([{ folderUri: folder.folderUri }], {'));
		assert.ok(source.includes('remoteAuthority: folder.remoteAuthority ?? null,'));
		assert.ok(!source.includes('revealInExplorer'));
		assert.ok(!source.includes('this.commandService.executeCommand(getEngineStatusCommandId(\n\t\t\t\tthis.uaConnection.getConnectionPhase(),\n\t\t\t\tthis.uaConnection.getConnectionSnapshot().pairingPending,\n\t\t\t));'));
		assert.ok(source.includes('void this.workRootMount.acceptOffer().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\([\s\S]*?\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 3);
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 8);
	});

	test('engine folder offers Add and trust and the click accepts the offer', async () => {
		const onDidChangeActiveWorkRoot = store.add(new Emitter<IAgentWorkRoot>());
		const offer: IWorkRootMountOffer = { uri: URI.file('/remote/gamma'), reason: 'trust' };
		let accepts = 0;
		const sessionContext = {
			getActiveWorkRoot: () => ({
				sessionId: 's-engine',
				engineIdentityId: 'eng',
				workDir: '/remote/gamma',
				source: 'session',
				access: 'engine',
				localRoot: undefined,
				projectKey: 'eng\n/remote/gamma',
			}),
			onDidChangeActiveWorkRoot: onDidChangeActiveWorkRoot.event,
		} as IAgentSessionContext;
		const { slots } = mountLens({
			sessionContext,
			workRootMount: {
				_serviceBrand: undefined,
				onDidChangeOffer: Event.None,
				getOffer: () => offer,
				setOffer: () => { },
				acceptOffer: async () => { accepts++; },
			},
		});
		const button = getIdentityStrip(slots).querySelector(`.${conversationIdentityAddFolderClass}`) as HTMLButtonElement;
		assert.strictEqual(button.hidden, false);
		assert.strictEqual(button.textContent, 'Add and trust');
		assert.strictEqual(button.getAttribute('aria-label'), 'Session folder: gamma. Add and trust it.');
		button.click();
		await timeout(0);
		assert.strictEqual(accepts, 1);
	});

	test('folder and branch follow the active session work root and engine root has no branch menu', async () => {
		const onDidChangeActiveWorkRoot = store.add(new Emitter<IAgentWorkRoot>());
		const alpha = URI.file('/repo/alpha');
		const beta = URI.file('/repo/beta');
		let current: IAgentWorkRoot = {
			sessionId: 's-a',
			engineIdentityId: 'eng',
			workDir: alpha.path,
			source: 'session',
			access: 'local',
			localRoot: alpha,
			projectKey: `eng\n${alpha.path}`,
		};
		const scm = createScmServiceWithRepositories([
			createScmRepository('alpha-branch', alpha, 'alpha', async () => [
				{ id: 'refs/heads/alpha-branch', name: 'alpha-branch' },
				{ id: 'refs/heads/main', name: 'main' },
			]),
			createScmRepository('beta-branch', beta, 'beta'),
		]);
		const summaries: { sessionId: string; resolve: (value: UniverseAgentReadGitSummaryResult) => void }[] = [];
		const sessionContext = {
			getActiveWorkRoot: () => current,
			onDidChangeActiveWorkRoot: onDidChangeActiveWorkRoot.event,
		} as IAgentSessionContext;
		const { slots, commandService, actionWidget } = mountLens({
			scmService: scm,
			sessionContext,
			connectionOverrides: {
				readGitSummary: request => new Promise(resolve => {
					summaries.push({ sessionId: request.sessionId, resolve });
				}),
			},
		});
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
		const branchChevron = () => branchChip.querySelector('.conversation-identity-chip-open') as HTMLElement;
		const folderChevron = () => folderChip.querySelector('.conversation-identity-chip-open') as HTMLElement;

		assert.strictEqual(folderChip.textContent, 'alpha');
		assert.strictEqual(branchChip.hidden, false);
		assert.strictEqual(branchChip.textContent, 'alpha-branch');
		assert.strictEqual(branchChip.getAttribute('aria-haspopup'), 'listbox');
		assert.strictEqual(branchChevron().hidden, false);
		assert.strictEqual(branchChip.classList.contains(conversationIdentityBranchReadOnlyClass), false);

		branchChip.click();
		await timeout(0);
		actionWidget.shows.at(-1)!.delegate.onSelect('main');
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[alpha, 'main']]);

		folderChip.click();
		await timeout(0);
		assert.ok(menuActions(actionWidget.shows.at(-1)!).some(item => item.label === 'testWorkspace'));
		actionWidget.hide(true);

		current = {
			sessionId: 's-b',
			engineIdentityId: 'eng',
			workDir: beta.path,
			source: 'session',
			access: 'local',
			localRoot: beta,
			projectKey: `eng\n${beta.path}`,
		};
		onDidChangeActiveWorkRoot.fire(current);
		assert.strictEqual(folderChip.textContent, 'beta');
		assert.strictEqual(branchChip.textContent, 'beta-branch');
		assert.strictEqual(branchChip.getAttribute('aria-haspopup'), 'listbox');

		current = {
			sessionId: 's-engine',
			engineIdentityId: 'eng',
			workDir: '/remote/gamma',
			source: 'session',
			access: 'engine',
			localRoot: undefined,
			projectKey: 'eng\n/remote/gamma',
		};
		onDidChangeActiveWorkRoot.fire(current);
		assert.strictEqual(folderChip.textContent, 'gamma');
		assert.strictEqual(branchChip.hidden, true);
		assert.strictEqual(summaries.length, 1);
		assert.strictEqual(summaries[0].sessionId, 's-engine');

		current = {
			sessionId: 's-b',
			engineIdentityId: 'eng',
			workDir: beta.path,
			source: 'session',
			access: 'local',
			localRoot: beta,
			projectKey: `eng\n${beta.path}`,
		};
		onDidChangeActiveWorkRoot.fire(current);
		assert.strictEqual(folderChip.textContent, 'beta');
		assert.strictEqual(branchChip.textContent, 'beta-branch');
		summaries[0].resolve({ supported: true, reason: '', branch: 'stale-engine', changeCount: 0 });
		await timeout(0);
		assert.strictEqual(branchChip.textContent, 'beta-branch');
		assert.strictEqual(branchChip.getAttribute('aria-haspopup'), 'listbox');

		current = {
			sessionId: 's-engine',
			engineIdentityId: 'eng',
			workDir: '/remote/gamma',
			source: 'session',
			access: 'engine',
			localRoot: undefined,
			projectKey: 'eng\n/remote/gamma',
		};
		onDidChangeActiveWorkRoot.fire(current);
		assert.strictEqual(summaries.length, 2);
		summaries[1].resolve({ supported: true, reason: '', branch: 'engine-branch', changeCount: 1 });
		await timeout(0);
		assert.strictEqual(folderChip.textContent, 'gamma');
		assert.strictEqual(folderChip.getAttribute('aria-haspopup'), null);
		assert.strictEqual(folderChip.tabIndex, -1);
		assert.strictEqual(folderChevron().hidden, true);
		assert.strictEqual(folderChip.classList.contains(conversationIdentityFolderReadOnlyClass), true);
		assert.ok(!folderChip.getAttribute('aria-label')?.includes('Add a folder'));
		assert.strictEqual(folderChip.getAttribute('aria-label'), 'Session folder: gamma');
		assert.strictEqual(branchChip.hidden, false);
		assert.strictEqual(branchChip.textContent, 'engine-branch');
		assert.strictEqual(branchChip.getAttribute('aria-haspopup'), null);
		assert.strictEqual(branchChip.tabIndex, -1);
		assert.strictEqual(branchChevron().hidden, true);
		assert.strictEqual(branchChip.classList.contains(conversationIdentityBranchReadOnlyClass), true);
		assert.ok(!branchChip.getAttribute('aria-label')?.includes('Open the branch list'));
		const showsBeforeClick = actionWidget.shows.length;
		branchChip.click();
		await timeout(0);
		folderChip.click();
		await timeout(0);
		assert.strictEqual(actionWidget.shows.length, showsBeforeClick);

		current = {
			sessionId: 's-local-again',
			engineIdentityId: 'eng',
			workDir: alpha.path,
			source: 'session',
			access: 'local',
			localRoot: alpha,
			projectKey: `eng\n${alpha.path}`,
		};
		onDidChangeActiveWorkRoot.fire(current);
		assert.strictEqual(branchChip.classList.contains(conversationIdentityBranchReadOnlyClass), false);
		assert.strictEqual(folderChip.classList.contains(conversationIdentityFolderReadOnlyClass), false);
		assert.strictEqual(folderChevron().hidden, false);
		assert.strictEqual(folderChip.getAttribute('aria-haspopup'), 'listbox');
	});

	test('D1386 bound local and engine leaves keep their own folder aria and branch when global focus changes', async () => {
		const alpha = URI.file('/repo/alpha');
		const harness = workRootHarness([alpha.path, '/remote/beta'], createScmServiceWithBranch('alpha-head', alpha));
		const [sessionA, sessionB] = harness.sessionIds;
		const leafA = mountLens({ ...harness, sessionKey: sessionA });
		const leafB = mountLens({ ...harness, sessionKey: sessionB });
		const folderA = getIdentityStrip(leafA.slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		const folderB = getIdentityStrip(leafB.slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		const branchA = getIdentityStrip(leafA.slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
		const branchB = getIdentityStrip(leafB.slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
		assert.strictEqual(folderA.textContent, 'alpha');
		assert.strictEqual(folderB.textContent, 'beta');
		assert.strictEqual(folderB.getAttribute('aria-label'), 'Session folder: beta');
		assert.strictEqual(folderB.title, '/remote/beta');
		assert.strictEqual(folderB.tabIndex, -1);
		assert.strictEqual(branchA.textContent, 'alpha-head');
		assert.ok(harness.summaries.length > 0);
		assert.ok(harness.summaries.every(request => request.sessionId === sessionB));
		harness.stubService.switchSession(sessionB);
		assert.strictEqual(folderA.textContent, 'alpha');
		assert.strictEqual(branchA.textContent, 'alpha-head');
		harness.stubService.switchSession(sessionA);
		const previous = harness.summaries.at(-1)!;
		harness.setWorkDir(sessionB, '/remote/gamma');
		assert.strictEqual(folderB.textContent, 'gamma');
		assert.strictEqual(folderB.getAttribute('aria-label'), 'Session folder: gamma');
		harness.summaries.at(-1)!.resolve({ supported: true, reason: '', branch: 'gamma-head', changeCount: 0 });
		await timeout(0);
		previous.resolve({ supported: true, reason: '', branch: 'stale-beta', changeCount: 0 });
		await timeout(0);
		assert.strictEqual(branchB.textContent, 'gamma-head');
		assert.strictEqual(branchB.title, 'gamma-head');
		assert.strictEqual(branchB.getAttribute('aria-haspopup'), null);
		assert.strictEqual(branchB.tabIndex, -1);
		branchB.click();
		assert.strictEqual(leafB.actionWidget.shows.length, 0);
	});

	test('D1386 each local leaf checks its own workspace folder and checks out its own repository', async () => {
		const alphaFolder = URI.file('/repo/alpha');
		const alpha = URI.file('/repo/alpha/nested');
		const beta = URI.file('/repo/beta');
		const workspaceContextService = new TestContextService(new Workspace('identity-roots', [alphaFolder, beta].map(toWorkspaceFolder)));
		const scm = createScmServiceWithRepositories([alpha, beta].map((uri, index) => createScmRepository(index === 0 ? 'alpha-head' : 'beta-head', uri, String(index), async () => [{ id: 'refs/heads/main', name: 'main' }])));
		const harness = workRootHarness([alpha.path, beta.path], scm, workspaceContextService);
		for (const [index, sessionKey] of harness.sessionIds.entries()) {
			const leaf = mountLens({ ...harness, sessionKey });
			const folder = getIdentityStrip(leaf.slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
			folder.click();
			await timeout(0);
			const checked = menuActions(leaf.actionWidget.shows.at(-1)!).filter(item => item.group?.icon === Codicon.check);
			assert.deepStrictEqual(checked.map(item => item.label), [index === 0 ? 'alpha' : 'beta']);
			leaf.actionWidget.hide(true);
			const branch = getIdentityStrip(leaf.slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
			branch.focus();
			assert.strictEqual(document.activeElement, branch);
			branch.click();
			await timeout(0);
			assert.strictEqual(menuActions(leaf.actionWidget.shows.at(-1)!)[0].label, index === 0 ? 'alpha-head' : 'beta-head');
			leaf.actionWidget.shows.at(-1)!.delegate.onSelect('main');
			assert.deepStrictEqual(leaf.executedCommands, [{ id: 'git.checkout', args: [index === 0 ? alpha : beta, 'main'] }]);
		}
	});

	for (const outcome of ['resolve', 'reject'] as const) {
		test(`D1386 engine ${outcome} from before A to B to A binding cannot repaint the new branch`, async () => {
			const harness = workRootHarness(['/remote/alpha', '/remote/beta'], createEmptyScmService());
			const [sessionA, sessionB] = harness.sessionIds;
			const leaf = mountLens({ ...harness, sessionKey: sessionA });
			const original = harness.summaries.at(-1)!;
			leaf.lens.setBoundSessionId(sessionB);
			assert.strictEqual(getIdentityStrip(leaf.slots).querySelector(`.${conversationIdentityFolderChipClass}`)!.textContent, 'beta');
			leaf.lens.setBoundSessionId(sessionA);
			harness.summaries.at(-1)!.resolve({ supported: true, reason: '', branch: 'fresh-alpha', changeCount: 0 });
			await timeout(0);
			if (outcome === 'resolve') {
				original.resolve({ supported: true, reason: '', branch: 'stale-alpha', changeCount: 0 });
			} else {
				original.reject(new Error('stale read failed'));
			}
			await timeout(0);
			assert.strictEqual(getIdentityStrip(leaf.slots).querySelector(`.${conversationIdentityBranchChipClass}`)!.textContent, 'fresh-alpha');
		});
	}

	test('D1386 same-session root change closes branch menu and invalidates old checkout delegate', async () => {
		const alpha = URI.file('/repo/alpha');
		const beta = URI.file('/repo/beta');
		const scm = createScmServiceWithRepositories([alpha, beta].map(uri => createScmRepository(uri.path.endsWith('alpha') ? 'alpha-head' : 'beta-head', uri, uri.path, async () => [{ id: 'refs/heads/main', name: 'main' }])));
		const harness = workRootHarness([alpha.path], scm);
		const leaf = mountLens({ ...harness, sessionKey: harness.sessionIds[0] });
		const branch = getIdentityStrip(leaf.slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
		branch.click();
		await timeout(0);
		const oldMenu = leaf.actionWidget.shows.at(-1)!;
		harness.setWorkDir(harness.sessionIds[0], beta.path);
		assert.strictEqual(branch.textContent, 'beta-head');
		assert.strictEqual(leaf.actionWidget.isVisible, false);
		assert.strictEqual(branch.getAttribute('aria-expanded'), 'false');
		oldMenu.delegate.onSelect('main');
		assert.deepStrictEqual(leaf.executedCommands, []);
		branch.click();
		await timeout(0);
		leaf.actionWidget.shows.at(-1)!.delegate.onSelect('main');
		assert.deepStrictEqual(leaf.executedCommands, [{ id: 'git.checkout', args: [beta, 'main'] }]);
	});

	test('D1386 late refs from an old binding do not open a menu on the rebound local leaf', async () => {
		const alpha = URI.file('/repo/alpha');
		const beta = URI.file('/repo/beta');
		let resolveRefs!: (refs: readonly { id: string; name: string }[]) => void;
		const scm = createScmServiceWithRepositories([
			createScmRepository('alpha-head', alpha, 'alpha', () => new Promise(resolve => { resolveRefs = resolve; })),
			createScmRepository('beta-head', beta, 'beta'),
		]);
		const harness = workRootHarness([alpha.path, beta.path], scm);
		const leaf = mountLens({ ...harness, sessionKey: harness.sessionIds[0] });
		const branch = getIdentityStrip(leaf.slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
		branch.click();
		leaf.lens.setBoundSessionId(harness.sessionIds[1]);
		resolveRefs([{ id: 'refs/heads/stale', name: 'stale' }]);
		await timeout(0);
		assert.strictEqual(branch.textContent, 'beta-head');
		assert.strictEqual(leaf.actionWidget.shows.length, 0);
	});

	test('D1386 cancelled recents cannot overtake the next request on the same root', async () => {
		const leaf = mountLens();
		const pending: ((opened: IRecentlyOpened) => void)[] = [];
		leaf.workspaces.getRecentlyOpened = () => new Promise(resolve => pending.push(resolve));
		const folder = getIdentityStrip(leaf.slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		folder.click();
		folder.click();
		folder.click();
		pending[0]({ files: [], workspaces: [{ folderUri: URI.file('/old'), label: 'stale' }] });
		await timeout(0);
		assert.strictEqual(leaf.actionWidget.shows.length, 0);
		pending[1]({ files: [], workspaces: [{ folderUri: URI.file('/new'), label: 'fresh' }] });
		await timeout(0);
		assert.strictEqual(leaf.actionWidget.shows.length, 1);
		assert.ok(menuActions(leaf.actionWidget.shows[0]).some(item => item.label === 'fresh'));
		assert.ok(!menuActions(leaf.actionWidget.shows[0]).some(item => item.label === 'stale'));
	});

	test('D1386 old Add button cannot accept a replaced global offer even before a repaint', async () => {
		const harness = workRootHarness(['/remote/alpha', '/remote/beta'], createEmptyScmService());
		let offer: IWorkRootMountOffer | undefined = { uri: URI.file('/remote/alpha'), reason: 'confirm' };
		const offers = store.add(new Emitter<void>());
		const accepted: string[] = [];
		const workRootMount: IConversationWorkRootMount = {
			_serviceBrand: undefined, onDidChangeOffer: offers.event,
			getOffer: () => offer, setOffer: () => { },
			acceptOffer: async () => { accepted.push(offer!.uri.path); },
		};
		const leafA = mountLens({ ...harness, sessionKey: harness.sessionIds[0], workRootMount });
		const leafB = mountLens({ ...harness, sessionKey: harness.sessionIds[1], workRootMount });
		const buttonA = getIdentityStrip(leafA.slots).querySelector(`.${conversationIdentityAddFolderClass}`) as HTMLButtonElement;
		const buttonB = getIdentityStrip(leafB.slots).querySelector(`.${conversationIdentityAddFolderClass}`) as HTMLButtonElement;
		assert.strictEqual(buttonA.hidden, false);
		assert.strictEqual(buttonB.hidden, true);
		offer = { uri: URI.file('/remote/beta'), reason: 'trust' };
		buttonA.click();
		await timeout(0);
		assert.deepStrictEqual(accepted, []);
		offers.fire();
		assert.strictEqual(buttonA.hidden, true);
		assert.strictEqual(buttonB.hidden, false);
		buttonB.click();
		await timeout(0);
		assert.deepStrictEqual(accepted, ['/remote/beta']);
	});

	test('D1386 bound leaf does not borrow a window root when its root API is absent', () => {
		const legacy: IAgentSessionContext = {
			_serviceBrand: undefined, getActiveSessionId: () => 'active', isEngineSessionReady: () => true, isPairingHold: () => false,
			onDidChangeActiveSession: Event.None, onDidChangeSession: Event.None,
			acquireSessionView: () => { throw new Error('not used'); },
		};
		const bound = mountLens({ sessionContext: legacy, sessionKey: 'bound' });
		assert.strictEqual((getIdentityStrip(bound.slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLElement).hidden, true);
		const unbound = mountLens({ sessionContext: legacy });
		assert.strictEqual(getIdentityStrip(unbound.slots).querySelector(`.${conversationIdentityFolderChipClass}`)!.textContent, 'testWorkspace');
		const none = workRootHarness([undefined], createEmptyScmService(), new TestContextService(new Workspace('ambiguous', [URI.file('/one'), URI.file('/two')].map(toWorkspaceFolder))));
		const rootless = mountLens({ ...none, sessionKey: none.sessionIds[0] });
		assert.strictEqual((getIdentityStrip(rootless.slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLElement).hidden, true);
		assert.strictEqual((getIdentityStrip(rootless.slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement).hidden, true);
	});

	test('D1386 workspace SCM and connection changes refresh a nonactive leaf without borrowing active root', async () => {
		const alpha = URI.file('/repo/alpha');
		const beta = URI.file('/repo/beta');
		const folders = store.add(new Emitter<IWorkspaceFoldersChangeEvent>());
		const workspace = new class extends TestContextService {
			override get onDidChangeWorkspaceFolders() { return folders.event; }
		}(new Workspace('roots', [alpha, beta].map(toWorkspaceFolder)));
		const added = store.add(new Emitter<ISCMRepository>());
		const removed = store.add(new Emitter<ISCMRepository>());
		const repositories: ISCMRepository[] = [];
		const scm: ISCMService = {
			...createScmServiceWithRepositories(repositories),
			onDidAddRepository: added.event, onDidRemoveRepository: removed.event,
		};
		const harness = workRootHarness([alpha.path, beta.path], scm, workspace);
		const leaf = mountLens({ ...harness, sessionKey: harness.sessionIds[1] });
		const folder = getIdentityStrip(leaf.slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		const branch = getIdentityStrip(leaf.slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
		assert.strictEqual(folder.textContent, 'beta');
		assert.strictEqual(folder.tabIndex, 0);
		const betaFolder = workspace.getWorkspace().folders[1];
		workspace.setWorkspace(new Workspace('roots', [toWorkspaceFolder(alpha)]));
		folders.fire({ added: [], removed: [betaFolder], changed: [] });
		assert.strictEqual(folder.textContent, 'beta');
		assert.strictEqual(folder.tabIndex, -1);
		const headChanges = store.add(new Emitter<string>());
		const repository = createScmRepository('beta-head', beta, 'beta', async () => [], headChanges.event);
		repositories.push(repository);
		added.fire(repository);
		assert.strictEqual(folder.tabIndex, 0);
		assert.strictEqual(branch.textContent, 'beta-head');
		headChanges.fire('new-beta-head');
		assert.strictEqual(branch.textContent, 'new-beta-head');
		repositories.pop();
		removed.fire(repository);
		assert.strictEqual(folder.tabIndex, -1);
		assert.strictEqual(branch.hidden, true);
		harness.setConnection({ linkId: 2, workDir: '/fallback/delta' });
		harness.setWorkDir(harness.sessionIds[1], undefined);
		assert.strictEqual(folder.textContent, 'delta');
		assert.strictEqual(folder.getAttribute('aria-label'), 'Session folder: delta');
		harness.setConnection({ transport: 'idle', channelAlive: false, engineIdentityId: undefined, workDir: undefined });
		assert.strictEqual(folder.textContent, 'delta');
		assert.strictEqual(folder.tabIndex, -1);
	});

	test('D1386 disposed leaf closes its menu and ignores later engine and recents responses', async () => {
		const harness = workRootHarness(['/remote/alpha'], createEmptyScmService());
		const leaf = mountLens({ ...harness, sessionKey: harness.sessionIds[0] });
		const strip = getIdentityStrip(leaf.slots);
		const summary = harness.summaries.at(-1)!;
		leaf.lens.dispose();
		summary.resolve({ supported: true, reason: '', branch: 'late', changeCount: 0 });
		await timeout(0);
		assert.ok(!strip.textContent?.includes('late'));
		const restored = mountLens({ ...harness, sessionKey: harness.sessionIds[0] });
		assert.strictEqual(getIdentityStrip(restored.slots).querySelector(`.${conversationIdentityFolderChipClass}`)!.textContent, 'alpha');
		const local = mountLens({ scmService: createScmServiceWithBranch('main') });
		const folder = getIdentityStrip(local.slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		folder.click();
		await timeout(0);
		assert.strictEqual(local.actionWidget.isVisible, true);
		local.lens.dispose();
		assert.strictEqual(local.actionWidget.isVisible, false);
		const loading = mountLens();
		let resolveRecents!: (opened: IRecentlyOpened) => void;
		loading.workspaces.getRecentlyOpened = () => new Promise(resolve => { resolveRecents = resolve; });
		(getIdentityStrip(loading.slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement).click();
		loading.lens.dispose();
		resolveRecents({ files: [], workspaces: [] });
		await timeout(0);
		assert.strictEqual(loading.actionWidget.shows.length, 0);
	});
});
